export type EmployeeRecord = {
  userId: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  internalId: string;
  confirmedAndActive: boolean;
  deactivated: boolean;
  mealBreakWaiver: boolean;
  admin: boolean;
  teamIds: string[];
};

export function mapDirectoryEmployee(
  entry: {
    userId: string;
    internalId: string;
    deactivated: boolean;
    mealBreakWaiver: boolean;
    user: {
      name: string;
      email: string;
      phoneNumber: string | null;
      confirmedAndActive: boolean;
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
    admin: adminIds.has(entry.userId),
    teamIds: entry.user.workerOf
      .filter((worker) => teamIds.includes(worker.teamId))
      .map((worker) => worker.teamId),
  };
}
