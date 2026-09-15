import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { firstCompanyHref, getCompanyAccess } from "@/lib/permissions";

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const { companyId } = await params;
  const access = await getCompanyAccess(session.user.id, companyId);
  const teams = await prisma.team.findMany({
    where: { companyId, archived: false },
    select: { id: true },
    orderBy: { name: "asc" },
  });
  redirect(firstCompanyHref(companyId, access, teams));
}
