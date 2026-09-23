import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, setHours, startOfWeek } from "date-fns";
import { CA_MEAL_RULES, CA_OVERTIME_RULES } from "../lib/scheduling/labor-rules";
import { CA_MINOR_RULES } from "../lib/scheduling/minor-rules";
import { ADMINISTRATOR_SYSTEM_KEY, ensureDefaultRoles } from "../lib/roles";

const prisma = new PrismaClient();

async function upsertUser(params: {
  email: string;
  name: string;
  password: string;
  support?: boolean;
  phoneNumber?: string;
}) {
  const passwordHash = await bcrypt.hash(params.password, 10);
  return prisma.user.upsert({
    where: { email: params.email },
    update: {
      name: params.name,
      passwordHash,
      confirmedAndActive: true,
      support: params.support ?? false,
      phoneNumber: params.phoneNumber,
    },
    create: {
      email: params.email,
      name: params.name,
      passwordHash,
      confirmedAndActive: true,
      support: params.support ?? false,
      phoneNumber: params.phoneNumber,
    },
  });
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW !== "1") {
    throw new Error(
      "Refusing to seed in production. The demo accounts use a published password and include a support user who can open every company. Set SEED_ALLOW=1 only for a disposable database.",
    );
  }

  const support = await upsertUser({
    email: "support@schedmaker.local",
    name: "Support Admin",
    password: "scheduler123",
    support: true,
  });
  const manager = await upsertUser({
    email: "manager@schedmaker.local",
    name: "Maya Manager",
    password: "scheduler123",
    phoneNumber: "(555) 555-0100",
  });
  const alice = await upsertUser({
    email: "alice@schedmaker.local",
    name: "Alice Nguyen",
    password: "scheduler123",
    phoneNumber: "(555) 555-0101",
  });
  const bob = await upsertUser({
    email: "bob@schedmaker.local",
    name: "Bob Alvarez",
    password: "scheduler123",
    phoneNumber: "(555) 555-0102",
  });
  const cara = await upsertUser({
    email: "cara@schedmaker.local",
    name: "Cara Patel",
    password: "scheduler123",
    phoneNumber: "(555) 555-0103",
  });

  const company =
    (await prisma.company.findFirst({ where: { name: "Demo Cafe" } })) ??
    (await prisma.company.create({
      data: {
        name: "Demo Cafe",
        defaultTimezone: "America/Los_Angeles",
        defaultDayWeekStarts: "monday",
        laborState: "CA",
        mealRules: CA_MEAL_RULES,
        overtimeRules: CA_OVERTIME_RULES,
        minorRules: CA_MINOR_RULES,
      },
    }));

  await prisma.company.update({
    where: { id: company.id },
    data: {
      laborState: "CA",
      mealRules: CA_MEAL_RULES,
      overtimeRules: CA_OVERTIME_RULES,
      minorRules: CA_MINOR_RULES,
    },
  });

  const team =
    (await prisma.team.findFirst({
      where: { companyId: company.id, name: "Floor" },
    })) ??
    (await prisma.team.create({
      data: {
        companyId: company.id,
        name: "Floor",
        timezone: "America/Los_Angeles",
        dayWeekStarts: "monday",
        color: "48B7AB",
      },
    }));

  const jobs = await Promise.all(
    [
      { name: "Server", color: "48B7AB" },
      { name: "Cook", color: "E07A3D" },
      { name: "Host", color: "744FC6" },
    ].map(async (job) => {
      const existing = await prisma.job.findFirst({
        where: { teamId: team.id, name: job.name },
      });
      return (
        existing ??
        prisma.job.create({
          data: { teamId: team.id, name: job.name, color: job.color },
        })
      );
    }),
  );

  const roles = await ensureDefaultRoles(prisma, company.id);
  const administrator =
    roles.find((role) => role.systemKey === ADMINISTRATOR_SYSTEM_KEY) ?? roles[0]!;
  const employee =
    roles.find((role) => role.name === "Employee") ??
    roles.find((role) => role.systemKey !== ADMINISTRATOR_SYSTEM_KEY) ??
    administrator;

  for (const user of [support, manager, alice, bob, cara]) {
    const roleId =
      user.id === manager.id || user.id === support.id ? administrator.id : employee.id;
    await prisma.directory.upsert({
      where: { companyId_userId: { companyId: company.id, userId: user.id } },
      update: { roleId },
      create: { companyId: company.id, userId: user.id, internalId: "", roleId },
    });
    await prisma.worker.upsert({
      where: { teamId_userId: { teamId: team.id, userId: user.id } },
      update: {},
      create: { teamId: team.id, userId: user.id },
    });
    if (!user.homeCompanyId) {
      const memberships = await prisma.directory.count({ where: { userId: user.id } });
      if (memberships === 1) {
        await prisma.user.update({
          where: { id: user.id },
          data: { homeCompanyId: company.id },
        });
      }
    }
  }

  const restaurantHours =
    (await prisma.hoursTemplate.findFirst({
      where: { companyId: company.id, name: "Restaurant hours" },
    })) ??
    (await prisma.hoursTemplate.create({
      data: {
        companyId: company.id,
        name: "Restaurant hours",
        days: {
          create: [
            "sunday",
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
          ].map((weekday) => ({
            weekday,
            closed: false,
            scheduleStartSlot: 32,
            scheduleEndSlot: 96,
            businessStartSlot: 40,
            businessEndSlot: 88,
          })),
        },
      },
    }));

  if (!company.hoursTemplateId) {
    await prisma.company.update({
      where: { id: company.id },
      data: { hoursTemplateId: restaurantHours.id },
    });
  }

  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const existingShifts = await prisma.shift.count({
    where: { teamId: team.id, start: { gte: monday } },
  });
  if (existingShifts === 0) {
    const assignments = [
      { user: alice, job: jobs[0], day: 0, startHour: 9, stopHour: 17 },
      { user: bob, job: jobs[1], day: 0, startHour: 10, stopHour: 18 },
      { user: cara, job: jobs[2], day: 1, startHour: 11, stopHour: 19 },
      { user: alice, job: jobs[0], day: 2, startHour: 9, stopHour: 15 },
      { user: bob, job: jobs[1], day: 3, startHour: 12, stopHour: 20 },
      { user: cara, job: jobs[2], day: 4, startHour: 9, stopHour: 17 },
    ];
    await prisma.shift.createMany({
      data: assignments.map((row) => {
        const day = addDays(monday, row.day);
        return {
          teamId: team.id,
          userId: row.user.id,
          jobId: row.job.id,
          published: true,
          start: setHours(day, row.startHour),
          stop: setHours(day, row.stopHour),
        };
      }),
    });
  }

  console.log("Seeded Demo Cafe. Log in as manager@schedmaker.local / scheduler123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
