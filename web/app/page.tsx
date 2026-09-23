import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthHeader } from "@/components/marketing/site-header";
import { LoginForm } from "@/components/forms/auth-forms";
import { signupEnabled } from "@/lib/signup";

export default async function HomePage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/app");
  }

  return (
    <div className="min-h-screen">
      <AuthHeader />
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="mb-2 text-3xl font-bold text-ink">Schedmaker</h1>
        <p className="mb-6 text-sm text-muted">Log in to manage your schedule.</p>
        <div className="rounded-lg border border-border bg-white p-6">
          <LoginForm />
        </div>
        {signupEnabled() ? (
          <p className="mt-4 text-center text-sm text-muted">
            No account?{" "}
            <Link href="/signup" className="text-teal hover:underline">
              Sign up
            </Link>
          </p>
        ) : null}
        {process.env.NODE_ENV !== "production" ? (
          <p className="mt-6 text-center text-sm text-muted">
            Development administrator: manager@schedmaker.local / scheduler123
          </p>
        ) : null}
      </main>
    </div>
  );
}
