import { AuthHeader } from "@/components/marketing/site-header";
import { NewCompanyForm } from "@/components/forms/auth-forms";
import { HelpTip } from "@/components/ui/help-tip";

export default function NewCompanyPage() {
  return (
    <div className="min-h-screen">
      <AuthHeader />
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="mb-6 flex items-center gap-2 text-3xl font-bold text-ink">
          Create your company
          <HelpTip topic="companyVsTeam" />
        </h1>
        <div className="rounded-lg border border-border bg-white p-6">
          <NewCompanyForm />
        </div>
      </main>
    </div>
  );
}
