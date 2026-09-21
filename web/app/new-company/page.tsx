import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthHeader } from "@/components/marketing/site-header";
import { NewCompanyForm } from "@/components/forms/auth-forms";
import { HelpTip } from "@/components/ui/help-tip";
import { listDefinedTeamNames } from "@/lib/actions/company";
import { ActionError, userCanCreateCompanies } from "@/lib/permissions";
import { DEFAULT_TEAM_NAME } from "@/lib/teams";

export default async function NewCompanyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  if (!(await userCanCreateCompanies(session.user.id, session.user.support))) {
    redirect("/app");
  }

  let teamNames = [DEFAULT_TEAM_NAME];
  try {
    teamNames = await listDefinedTeamNames();
  } catch (error) {
    if (error instanceof ActionError) redirect("/");
    throw error;
  }

  return (
    <div className="min-h-screen">
      <AuthHeader />
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="mb-6 flex items-center gap-2 text-3xl font-bold text-ink">
          Create your company
          <HelpTip topic="companyVsTeam" />
        </h1>
        <div className="rounded-lg border border-border bg-white p-6">
          <NewCompanyForm teamNames={teamNames} />
        </div>
      </main>
    </div>
  );
}
