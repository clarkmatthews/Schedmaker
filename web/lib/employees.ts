import { displayPhone } from "@/lib/phone";

export type EmployeeRoleOption = {
  id: string;
  name: string;
  systemKey: string | null;
};

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
  roleId: string;
  roleName: string;
  teamIds: string[];
  canEditIdentity: boolean;
  canEditBirthDate: boolean;
  homeCompanyId: string | null;
  homeCompanyName: string | null;
  memberCompanyIds: string[];
  loaned: boolean;
  loans: { companyId: string; companyName: string }[];
  manages: { companyId: string; companyName: string }[];
  jobs: { jobId: string; jobName: string; teamName: string; primary: boolean; hourlyRate: number | null }[];
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

export function sanitizeHourlyRateInput(value: string) {
  const cleaned = value.replace(/[$,\s]/g, "").replace(/[^\d.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  if (rest.length === 0) return whole;
  return `${whole}.${rest.join("").slice(0, 2)}`;
}

export function formatHourlyRateInput(rate: number | null | undefined) {
  if (rate == null || !Number.isFinite(rate)) return "";
  return rate.toFixed(2);
}

export function parseHourlyRate(value: string): { rate: number | null; error?: string } {
  const raw = sanitizeHourlyRateInput(value).trim();
  if (!raw) return { rate: null };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return { rate: null, error: "Enter a valid hourly rate." };
  return { rate: Math.round(n * 100) / 100 };
}

export function hourlyRateNumber(rate: unknown): number | null {
  if (rate == null || rate === "") return null;
  const n = Number(rate);
  return Number.isFinite(n) ? n : null;
}

export function mapDirectoryEmployee(
  entry: {
    userId: string;
    roleId: string;
    internalId: string;
    deactivated: boolean;
    mealBreakWaiver: boolean;
    hourlyRate: unknown;
    role: { name: string };
    user: {
      name: string;
      email: string;
      phoneNumber: string | null;
      confirmedAndActive: boolean;
      birthDate: Date | null;
      profileOwnerCompanyId: string | null;
      homeCompanyId: string | null;
      directoryEntries: { companyId: string }[];
      workerOf: { teamId: string }[];
    };
  },
  teamIds: string[],
  companyId: string,
  homeCompanyName: string | null,
  loans: { companyId: string; companyName: string }[],
  manages: { companyId: string; companyName: string }[],
  jobs: { jobId: string; jobName: string; teamName: string; primary: boolean; hourlyRate: number | null }[],
): EmployeeRecord {
  const ownsProfile = entry.user.profileOwnerCompanyId === companyId;
  const sharedAccount = entry.user.directoryEntries.some((row) => row.companyId !== companyId);
  return {
    userId: entry.userId,
    name: entry.user.name,
    email: entry.user.email,
    phoneNumber: displayPhone(entry.user.phoneNumber) || null,
    internalId: entry.internalId,
    confirmedAndActive: entry.user.confirmedAndActive,
    deactivated: entry.deactivated,
    mealBreakWaiver: entry.mealBreakWaiver,
    birthDate: entry.user.birthDate ? entry.user.birthDate.toISOString().slice(0, 10) : null,
    hourlyRate: hourlyRateNumber(entry.hourlyRate),
    roleId: entry.roleId,
    roleName: entry.role.name,
    teamIds: entry.user.workerOf
      .filter((worker) => teamIds.includes(worker.teamId))
      .map((worker) => worker.teamId),
    canEditIdentity: ownsProfile && !entry.user.confirmedAndActive,
    canEditBirthDate: ownsProfile || !sharedAccount,
    homeCompanyId: entry.user.homeCompanyId,
    memberCompanyIds: entry.user.directoryEntries.map((row) => row.companyId),
    homeCompanyName,
    loaned: false,
    loans,
    manages,
    jobs,
  };
}
