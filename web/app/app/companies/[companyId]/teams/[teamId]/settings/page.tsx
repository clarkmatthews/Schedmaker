import { redirect } from "next/navigation";

export default async function TeamSettingsPage({
  params,
}: {
  params: Promise<{ companyId: string; teamId: string }>;
}) {
  const { companyId } = await params;
  redirect(`/app/companies/${companyId}/settings?section=teams`);
}
