import { AuthHeader } from "@/components/marketing/site-header";
import { ResetRequestForm } from "@/components/forms/auth-forms";

export default function ResetPage() {
  return (
    <div className="min-h-screen">
      <AuthHeader />
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="mb-6 text-3xl font-bold text-ink">Reset password</h1>
        <div className="rounded-lg border border-border bg-white p-6">
          <ResetRequestForm />
        </div>
      </main>
    </div>
  );
}
