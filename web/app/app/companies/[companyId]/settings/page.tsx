import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getCompanyAccess } from "@/lib/permissions";
import { SETTINGS_SECTIONS, type SettingsSectionId } from "@/lib/settings/sections";
import { CompanySettingsForm } from "@/components/settings/company-settings-form";
import { CreateTeamForm } from "@/components/settings/create-team-form";
import { ResponsibilitiesSettings } from "@/components/settings/responsibilities-settings";
import { SettingsAccordion } from "@/components/settings/settings-accordion";
import { TeamSettings } from "@/components/settings/team-settings";
import { HoursSettings } from "@/components/settings/hours-settings";
import { SchedulingSettings } from "@/components/settings/scheduling-settings";
import { toHoursTemplateView } from "@/lib/scheduling/hours";

function parseSection(value?: string): SettingsSectionId {
  return SETTINGS_SECTIONS.some((item) => item.id === value)
    ? (value as SettingsSectionId)
    : "company";
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
  if (!access.support && !access.admin) {
    redirect("/account");
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      teams: {
        where: { archived: false },
        include: { jobs: { orderBy: { name: "asc" } } },
        orderBy: { name: "asc" },
      },
      directory: { include: { user: true }, orderBy: { user: { name: "asc" } } },
      responsibilities: { orderBy: { name: "asc" } },
      hoursTemplates: { include: { days: true }, orderBy: { name: "asc" } },
    },
  });
  if (!company) notFound();

  const hoursTemplates = company.hoursTemplates.map(toHoursTemplateView);

  const section = parseSection(sectionParam);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">Settings</h1>
      <SettingsAccordion
        companyId={companyId}
        section={section}
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
                    timezone: team.timezone,
                    dayWeekStarts: team.dayWeekStarts,
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
              responsibilities={company.responsibilities}
            />
          ),
          people: (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Manage employees, admin flags, and team membership on the{" "}
                <Link
                  href={`/app/companies/${companyId}/employees`}
                  className="text-teal hover:underline"
                >
                  Employees
                </Link>{" "}
                page.
              </p>
              <ul className="divide-y divide-border rounded-md border border-border">
                {company.directory
                  .filter((entry) => !entry.deactivated)
                  .map((entry) => (
                    <li key={entry.userId} className="px-3 py-2 text-sm">
                      {entry.user.name || entry.user.email}
                    </li>
                  ))}
              </ul>
            </div>
          ),
          account: null,
        }}
      />
    </div>
  );
}
