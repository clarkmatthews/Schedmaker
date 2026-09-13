import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ActionError("You must be signed in.");
  }
  return session.user;
}

export async function getCompanyAccess(userId: string, companyId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { support: true },
  });

  const [admin, directory] = await Promise.all([
    prisma.admin.findUnique({
      where: { companyId_userId: { companyId, userId } },
    }),
    prisma.directory.findUnique({
      where: { companyId_userId: { companyId, userId } },
    }),
  ]);

  return {
    support: Boolean(user?.support),
    admin: Boolean(admin),
    inDirectory: Boolean(directory),
  };
}

export async function requireCompanyAdmin(companyId: string) {
  const user = await requireSession();
  const access = await getCompanyAccess(user.id, companyId);
  if (!access.support && !access.admin) {
    throw new ActionError("You do not have admin access to this company.");
  }
  return { user, access };
}

export async function requireDirectory(companyId: string) {
  const user = await requireSession();
  const access = await getCompanyAccess(user.id, companyId);
  if (!access.support && !access.inDirectory) {
    throw new ActionError("You are not associated with this company.");
  }
  return { user, access };
}

export async function requireTeamWorker(companyId: string, teamId: string) {
  const user = await requireSession();
  const access = await getCompanyAccess(user.id, companyId);
  if (access.support || access.admin) {
    return { user, access, worker: true };
  }

  const worker = await prisma.worker.findUnique({
    where: { teamId_userId: { teamId, userId: user.id } },
  });
  if (!worker) {
    throw new ActionError("You do not have worker access to this team.");
  }
  return { user, access, worker: true };
}

export async function getUserCompanies(userId: string, support: boolean) {
  if (support) {
    return prisma.company.findMany({
      where: { archived: false },
      include: { teams: { where: { archived: false }, orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    });
  }

  const [adminRows, directoryRows] = await Promise.all([
    prisma.admin.findMany({
      where: { userId },
      include: {
        company: {
          include: { teams: { where: { archived: false }, orderBy: { name: "asc" } } },
        },
      },
    }),
    prisma.directory.findMany({
      where: { userId },
      include: {
        company: {
          include: { teams: { where: { archived: false }, orderBy: { name: "asc" } } },
        },
      },
    }),
  ]);

  const map = new Map<string, (typeof adminRows)[number]["company"]>();
  for (const row of adminRows) {
    if (!row.company.archived) map.set(row.company.id, row.company);
  }
  for (const row of directoryRows) {
    if (!row.company.archived) map.set(row.company.id, row.company);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
