import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can, getCompanyAccess, getUserCompanies } from "@/lib/permissions";

export default async function LoansRedirectPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const companies = await getUserCompanies(session.user.id, session.user.support);
  for (const company of companies) {
    const access = await getCompanyAccess(session.user.id, company.id);
    if (can(access, "company", "edit")) {
      redirect(`/app/companies/${company.id}/loans`);
    }
  }
  redirect("/app");
}
