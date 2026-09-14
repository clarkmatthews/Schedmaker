export type CalendarBreak = {
  id: string;
  start: string;
  stop: string;
};

export type CalendarShift = {
  id: string;
  start: string;
  stop: string;
  published: boolean;
  userId: string | null;
  jobId: string | null;
  userName: string | null;
  jobName: string | null;
  jobColor: string | null;
  breaks: CalendarBreak[];
  responsibilityIds: string[];
  warnings: { code: string; message: string }[];
  regularMs: number;
  otMs: number;
};

export type CalendarWorker = { id: string; name: string };
export type CalendarJob = { id: string; name: string; color: string };
export type CalendarResponsibility = { id: string; name: string; archived: boolean };
export type ViewBy = "employee" | "job";

export type CalendarRow = { id: string; label: string; color: string };

export const SHIFT_DRAG_TYPE = "application/x-esp-shift";
