import { prisma } from "@/lib/db";
import { ActionError, can, getCompanyAccess, getUserCompanies } from "@/lib/permissions";

export type AvailabilityPerson = {
  id: string;
  name: string;
  canEdit: boolean;
};

export async function availabilityAudience(actorId: string, companyId?: string) {
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { id: true, support: true },
  });
  if (!actor) throw new ActionError("You must be signed in.");

  if (companyId) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { availabilityEnabled: true, archived: true },
    });
    if (!company || company.archived || !company.availabilityEnabled) {
      throw new ActionError("Availability is not enabled.");
    }
  }

  const companies = (await getUserCompanies(actorId, actor.support)).filter(
    (company) => company.availabilityEnabled && (companyId ? company.id === companyId : true),
  );
  if (!companyId && companies.length === 0) throw new ActionError("Availability is not enabled.");
  const visible = new Set<string>([actorId]);
  const editable = new Set<string>([actorId]);
  let canReview = false;

  for (const company of companies) {
    const access = await getCompanyAccess(actorId, company.id);
    const edit = can(access, "availability", "edit");
    const view = edit || can(access, "availability", "view");
    if (!view) continue;
    canReview = true;
    const [directory, loans] = await Promise.all([
      prisma.directory.findMany({
        where: { companyId: company.id },
        select: { userId: true },
      }),
      prisma.employeeLoan.findMany({
        where: { companyId: company.id, active: true },
        select: { userId: true },
      }),
    ]);
    for (const row of [...directory, ...loans]) {
      visible.add(row.userId);
      if (edit) editable.add(row.userId);
    }
  }

  const users = await prisma.user.findMany({
    where: { id: { in: [...visible] } },
    select: { id: true, name: true, email: true },
  });

  const people: AvailabilityPerson[] = users
    .map((user) => ({
      id: user.id,
      name: user.name || user.email,
      canEdit: editable.has(user.id),
    }))
    .sort((a, b) => {
      if (a.id === actorId) return -1;
      if (b.id === actorId) return 1;
      return a.name.localeCompare(b.name);
    });

  return { selfId: actorId, people, canReview };
}

export async function assertCanEditAvailability(actorId: string, targetUserId: string) {
  const { people } = await availabilityAudience(actorId);
  const person = people.find((item) => item.id === targetUserId);
  if (!person?.canEdit) {
    throw new ActionError("You do not have permission to change that availability.");
  }
}
