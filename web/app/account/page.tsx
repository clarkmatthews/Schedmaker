import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/app/app-shell";
import { AccountSettings } from "@/components/account/account-settings";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/");

  const base = process.env.AUTH_URL ?? "http://localhost:3000";
  const icalUrl = `${base}/api/ical/${user.id}?token=${user.icalToken}`;

  return (
    <AppShell>
      <AccountSettings
        user={{
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          photoUrl: user.photoUrl,
        }}
        icalUrl={icalUrl}
      />
    </AppShell>
  );
}
