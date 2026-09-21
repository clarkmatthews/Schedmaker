import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can, getCompanyAccess, hasSettingsAccess } from "@/lib/permissions";
import { SETTINGS_SECTIONS, type SettingsSectionId } from "@/lib/settings/sections";
import type { PermissionSectionId } from "@/lib/roles";
import { CompanySettingsForm } from "@/components/settings/company-settings-form";
import { CreateTeamForm } from "@/components/settings/create-team-form";
import { ResponsibilitiesSettings } from "@/components/settings/responsibilities-settings";
import { SettingsAccordion } from "@/components/settings/settings-accordion";
import { TeamSettings } from "@/components/settings/team-settings";
import { HoursSettings } from "@/components/settings/hours-settings";
import { SchedulingSettings } from "@/components/settings/scheduling-settings";
import { MmsSettings } from "@/components/settings/mms-settings";
import { RolesSettings } from "@/components/settings/roles-settings";
import { toHoursTemplateView } from "@/lib/scheduling/hours";

function parseSection(
  value: string | undefined,
  visible: { id: SettingsSectionId }[],
): SettingsSectionId {
  if (visible.some((item) => item.id === value)) return value as SettingsSectionId;
  return visible[0]?.id ?? "company";
}

export default async function CompanySettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const { companyId } = await params;
  const { section: sectionParam } = await searchParams;
  const access = await getCompanyAccess(session.user.id, companyId);
  if (!hasSettingsAccess(access, "view")) {
    redirect("/account");
  }

  const visibleSections = SETTINGS_SECTIONS.filter((item) =>
    can(access, item.id as PermissionSectionId, "view"),
  );
  const section = parseSection(sectionParam, visibleSections);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      teams: {
        where: { archived: false },
        include: { jobs: { orderBy: { name: "asc" } } },
        orderBy: { name: "asc" },
      },
      responsibilities: { orderBy: { name: "asc" } },
      hoursTemplates: { include: { days: true }, orderBy: { name: "asc" } },
      roles: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!company) notFound();

  const hoursTemplates = company.hoursTemplates.map(toHoursTemplateView);
  const readOnly = Object.fromEntries(
    visibleSections.map((item) => [
      item.id,
      !can(access, item.id as PermissionSectionId, "edit"),
    ]),
  ) as Partial<Record<SettingsSectionId, boolean>>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">Settings</h1>
      <SettingsAccordion
        companyId={companyId}
        section={section}
        sections={visibleSections}
        readOnly={readOnly}
        panels={{
          company: (
            <CompanySettingsForm
              company={{
                id: company.id,
                name: company.name,
                defaultTimezone: company.defaultTimezone,
                defaultDayWeekStarts: company.defaultDayWeekStarts,
              }}
            />
          ),
          hours: (
            <HoursSettings
              companyId={companyId}
              companyName={company.name}
              assignedTemplateId={company.hoursTemplateId}
              templates={hoursTemplates}
            />
          ),
          scheduling: (
            <SchedulingSettings
              companyId={companyId}
              companyName={company.name}
              lockHistoricalSchedule={company.lockHistoricalSchedule}
              laborState={company.laborState}
              mealRules={company.mealRules}
              overtimeRules={company.overtimeRules}
              minorRules={company.minorRules}
            />
          ),
          mms: (
            <MmsSettings
              companyId={companyId}
              enabled={company.mmsEnabled}
              accountSid={company.mmsAccountSid}
              fromNumber={company.mmsFromNumber}
              managerPhone={company.mmsManagerPhone}
              authTokenSet={Boolean(company.mmsAuthToken)}
            />
          ),
          teams: (
            <div className="space-y-8">
              {company.teams.map((team) => (
                <TeamSettings
                  key={team.id}
                  companyId={companyId}
                  team={{
                    id: team.id,
                    name: team.name,
                    color: team.color,
                  }}
                  jobs={team.jobs}
                />
              ))}
              <CreateTeamForm companyId={companyId} />
            </div>
          ),
          responsibilities: (
            <ResponsibilitiesSettings
              companyId={companyId}
              enabled={company.responsibilitiesEnabled}
              responsibilities={company.responsibilities}
            />
          ),
          roles: (
            <RolesSettings
              companyId={companyId}
              canEdit={can(access, "roles", "edit")}
              roles={company.roles}
            />
          ),
        }}
      />
    </div>
  );
}
