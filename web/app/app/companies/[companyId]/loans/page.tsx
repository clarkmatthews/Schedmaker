import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoanBoard } from "@/components/employees/loan-board";
import { loadLoanBoard } from "@/lib/loan-board";
import { can, getCompanyAccess } from "@/lib/permissions";

export default async function CompanyLoansPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const { companyId } = await params;
  const access = await getCompanyAccess(session.user.id, companyId);
  if (!can(access, "company", "edit")) redirect("/app");

  const board = await loadLoanBoard(session.user.id, session.user.support);
  if (!board.allowed) redirect("/app");

  return <LoanBoard rows={board.rows} companies={board.companies} />;
}
