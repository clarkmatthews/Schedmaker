import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  firstCompanyHref,
  getCompanyAccess,
  getUserCompanies,
  userCanCreateCompanies,
} from "@/lib/permissions";
import { AppShell } from "@/components/app/app-shell";
import { HelpTip } from "@/components/ui/help-tip";

export default async function AppHomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const companies = await getUserCompanies(session.user.id, session.user.support);
  const canCreate = await userCanCreateCompanies(session.user.id, session.user.support);
  const cards = await Promise.all(
    companies.map(async (company) => {
      const access = await getCompanyAccess(session.user.id, company.id);
      return {
        id: company.id,
        name: company.name,
        teamCount: company.teams.length,
        href: firstCompanyHref(company.id, access, company.teams),
      };
    }),
  );

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-ink">
            Your companies
            <HelpTip topic="companyVsTeam" />
          </h1>
          {canCreate ? (
            <Link
              href="/new-company"
              className="rounded-md bg-teal px-3 py-2 text-sm font-semibold text-white hover:bg-teal-dark"
            >
              New company
            </Link>
          ) : null}
        </div>
        {cards.length === 0 ? (
          <p className="rounded-lg border border-border bg-white p-6 text-muted">
            You are not part of a company yet. Create one to start scheduling.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {cards.map((company) => (
              <Link
                key={company.id}
                href={company.href}
                className="rounded-lg border border-border bg-white p-5 hover:border-teal"
              >
                <h2 className="text-lg font-semibold">{company.name}</h2>
                <p className="mt-1 text-sm text-muted">
                  {company.teamCount} team{company.teamCount === 1 ? "" : "s"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
