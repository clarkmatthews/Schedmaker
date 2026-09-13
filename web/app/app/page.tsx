import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserCompanies } from "@/lib/permissions";
import { AppShell } from "@/components/app/app-shell";

export default async function AppHomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const companies = await getUserCompanies(session.user.id, session.user.support);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-ink">Your companies</h1>
          <Link
            href="/new-company"
            className="rounded-md bg-teal px-3 py-2 text-sm font-semibold text-white hover:bg-teal-dark"
          >
            New company
          </Link>
        </div>
        {companies.length === 0 ? (
          <p className="rounded-lg border border-border bg-white p-6 text-muted">
            You are not part of a company yet. Create one to start scheduling.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {companies.map((company) => (
              <Link
                key={company.id}
                href={`/app/companies/${company.id}/employees`}
                className="rounded-lg border border-border bg-white p-5 hover:border-teal"
              >
                <h2 className="text-lg font-semibold">{company.name}</h2>
                <p className="mt-1 text-sm text-muted">
                  {company.teams.length} team{company.teams.length === 1 ? "" : "s"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
