import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ForcePasswordForm } from "@/components/account/force-password-form";

export default async function ForcePasswordPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  if (!session.user.mustChangePassword) redirect("/app");

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/account/password" className="text-xl font-bold text-teal">
            Schedmaker
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="mb-2 text-3xl font-bold text-ink">Choose a new password</h1>
        <p className="mb-6 text-sm text-muted">
          An administrator reset your password. Choose a new one before continuing.
        </p>
        <div className="rounded-lg border border-border bg-white p-6">
          <ForcePasswordForm />
        </div>
      </main>
    </div>
  );
}
