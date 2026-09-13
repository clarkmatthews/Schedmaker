import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AuthHeader } from "@/components/marketing/site-header";
import { ResetConfirmForm } from "@/components/forms/auth-forms";

export default async function ResetConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const row = await prisma.emailToken.findUnique({ where: { token } });
  if (!row || row.type !== "reset" || row.expiresAt < new Date()) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      <AuthHeader />
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="mb-6 text-3xl font-bold text-ink">Choose a new password</h1>
        <div className="rounded-lg border border-border bg-white p-6">
          <ResetConfirmForm token={token} />
        </div>
      </main>
    </div>
  );
}
