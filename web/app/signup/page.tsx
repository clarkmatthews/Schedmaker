import Link from "next/link";
import { AuthHeader } from "@/components/marketing/site-header";
import { SignupForm } from "@/components/forms/auth-forms";

export default function SignupPage() {
  return (
    <div className="min-h-screen">
      <AuthHeader />
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="mb-6 text-3xl font-bold text-ink">Create your account</h1>
        <div className="rounded-lg border border-border bg-white p-6">
          <SignupForm />
        </div>
        <p className="mt-4 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/" className="text-teal hover:underline">
            Log in
          </Link>
        </p>
      </main>
    </div>
  );
}
