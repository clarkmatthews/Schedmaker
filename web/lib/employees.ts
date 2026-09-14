export type EmployeeRecord = {
  userId: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  internalId: string;
  confirmedAndActive: boolean;
  deactivated: boolean;
  mealBreakWaiver: boolean;
  birthDate: string | null;
  hourlyRate: number | null;
  admin: boolean;
  teamIds: string[];
};

export function parseBirthDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function parseHourlyRate(value: string): { rate: number | null; error?: string } {
  const raw = value.trim();
  if (!raw) return { rate: null };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return { error: "Enter a valid hourly rate." };
  return { rate: Math.round(n * 100) / 100 };
}

export function mapDirectoryEmployee(
  entry: {
    userId: string;
    internalId: string;
    deactivated: boolean;
    mealBreakWaiver: boolean;
    hourlyRate: unknown;
    user: {
      name: string;
      email: string;
      phoneNumber: string | null;
      confirmedAndActive: boolean;
      birthDate: Date | null;
      workerOf: { teamId: string }[];
    };
  },
  adminIds: Set<string>,
  teamIds: string[],
): EmployeeRecord {
  return {
    userId: entry.userId,
    name: entry.user.name,
    email: entry.user.email,
    phoneNumber: entry.user.phoneNumber,
    internalId: entry.internalId,
    confirmedAndActive: entry.user.confirmedAndActive,
    deactivated: entry.deactivated,
    mealBreakWaiver: entry.mealBreakWaiver,
    birthDate: entry.user.birthDate ? entry.user.birthDate.toISOString().slice(0, 10) : null,
    hourlyRate: (() => {
      if (entry.hourlyRate == null || entry.hourlyRate === "") return null;
      const n = Number(entry.hourlyRate);
      return Number.isFinite(n) ? n : null;
    })(),
    admin: adminIds.has(entry.userId),
    teamIds: entry.user.workerOf
      .filter((worker) => teamIds.includes(worker.teamId))
      .map((worker) => worker.teamId),
  };
}
