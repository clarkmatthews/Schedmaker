import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AuthHeader } from "@/components/marketing/site-header";
import { ActivateForm } from "@/components/forms/auth-forms";

export default async function ActivatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const row = await prisma.emailToken.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!row || row.type !== "activate" || row.expiresAt < new Date()) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      <AuthHeader />
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="mb-6 text-3xl font-bold text-ink">Activate your account</h1>
        <p className="mb-4 text-sm text-muted">{row.email}</p>
        <div className="rounded-lg border border-border bg-white p-6">
          <ActivateForm
            token={token}
            defaultName={row.user.name}
            defaultPhone={row.user.phoneNumber ?? ""}
          />
        </div>
      </main>
    </div>
  );
}
