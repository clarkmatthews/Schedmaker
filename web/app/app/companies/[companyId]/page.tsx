import { redirect } from "next/navigation";

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  redirect(`/app/companies/${companyId}/employees`);
}
