import { prisma } from "@/lib/db";
import { can, getCompanyAccess, getUserCompanies } from "@/lib/permissions";

export type LoanBoardRow = {
  userId: string;
  name: string;
  email: string;
  homeCompanyId: string;
  homeCompanyName: string;
  loans: { companyId: string; companyName: string }[];
};

export async function loadLoanBoard(userId: string, support: boolean) {
  const companies = await getUserCompanies(userId, support);
  const manageable = new Set<string>();
  if (support) {
    for (const company of companies) manageable.add(company.id);
  } else {
    await Promise.all(
      companies.map(async (company) => {
        const access = await getCompanyAccess(userId, company.id);
        if (can(access, "company", "edit")) manageable.add(company.id);
      }),
    );
  }

  const catalog = await prisma.company.findMany({
    where: { archived: false },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const companyName = new Map(catalog.map((company) => [company.id, company.name]));

  if (manageable.size === 0) {
    return { allowed: false, companies: catalog, rows: [] as LoanBoardRow[] };
  }

  const loans = await prisma.employeeLoan.findMany({
    where: {
      active: true,
      user: { homeCompanyId: { in: [...manageable] } },
    },
    select: {
      companyId: true,
      company: { select: { name: true } },
      user: {
        select: { id: true, name: true, email: true, homeCompanyId: true },
      },
    },
  });

  const byUser = new Map<string, LoanBoardRow>();
  for (const loan of loans) {
    const homeCompanyId = loan.user.homeCompanyId;
    if (!homeCompanyId || !manageable.has(homeCompanyId)) continue;
    const row = byUser.get(loan.user.id) ?? {
      userId: loan.user.id,
      name: loan.user.name,
      email: loan.user.email,
      homeCompanyId,
      homeCompanyName: companyName.get(homeCompanyId) ?? "Home store",
      loans: [],
    };
    row.loans.push({ companyId: loan.companyId, companyName: loan.company.name });
    byUser.set(loan.user.id, row);
  }

  const rows = [...byUser.values()]
    .map((row) => ({
      ...row,
      loans: [...row.loans].sort((a, b) => a.companyName.localeCompare(b.companyName)),
    }))
    .sort(
      (a, b) =>
        (a.name || a.email).localeCompare(b.name || b.email) ||
        a.homeCompanyName.localeCompare(b.homeCompanyName),
    );

  return { allowed: true, companies: catalog, rows };
}
