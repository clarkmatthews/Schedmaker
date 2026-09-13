import { AuthHeader } from "@/components/marketing/site-header";
import { NewCompanyForm } from "@/components/forms/auth-forms";

export default function NewCompanyPage() {
  return (
    <div className="min-h-screen">
      <AuthHeader />
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="mb-6 text-3xl font-bold text-ink">Create your company</h1>
        <div className="rounded-lg border border-border bg-white p-6">
          <NewCompanyForm />
        </div>
      </main>
    </div>
  );
}
