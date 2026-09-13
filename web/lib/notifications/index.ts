import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { sendEmail } from "./email";
import { sendSms } from "./sms";

function shiftWindow(start: Date, stop: Date) {
  return `${format(start, "EEE MMM d h:mm a")} – ${format(stop, "h:mm a")}`;
}

export async function notifyOnboardWorker(companyId: string, userId: string) {
  const [company, user] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);
  if (!company || !user) return;

  const subject = `You've been added to ${company.name} on ESP Scheduler`;
  const body = `Hi ${user.name || "there"}, you were added to ${company.name}. Activate or log in to see your schedule.`;
  await sendEmail({ to: user.email, subject, html: `<p>${body}</p>` });
  if (user.phoneNumber) {
    await sendSms({ to: user.phoneNumber, body });
  }
}

export async function notifyNewShifts(
  userId: string,
  shifts: { start: Date; stop: Date }[],
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const list = shifts.map((s) => shiftWindow(s.start, s.stop)).join("<br>");
  const text = shifts.map((s) => shiftWindow(s.start, s.stop)).join(", ");
  await sendEmail({
    to: user.email,
    subject: shifts.length === 1 ? "New shift assigned" : "New shifts assigned",
    html: `<p>You have new published shift(s):</p><p>${list}</p>`,
  });
  if (user.phoneNumber) {
    await sendSms({ to: user.phoneNumber, body: `New ESP Scheduler shift(s): ${text}` });
  }
}

export async function notifyRemovedShifts(
  userId: string,
  shifts: { start: Date; stop: Date }[],
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const list = shifts.map((s) => shiftWindow(s.start, s.stop)).join("<br>");
  const text = shifts.map((s) => shiftWindow(s.start, s.stop)).join(", ");
  await sendEmail({
    to: user.email,
    subject: shifts.length === 1 ? "Shift removed" : "Shifts removed",
    html: `<p>These published shift(s) were removed or unpublished:</p><p>${list}</p>`,
  });
  if (user.phoneNumber) {
    await sendSms({ to: user.phoneNumber, body: `ESP Scheduler shift(s) removed: ${text}` });
  }
}

export async function notifyChangedShift(
  userId: string,
  oldShift: { start: Date; stop: Date },
  newShift: { start: Date; stop: Date },
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const from = shiftWindow(oldShift.start, oldShift.stop);
  const to = shiftWindow(newShift.start, newShift.stop);
  await sendEmail({
    to: user.email,
    subject: "Shift updated",
    html: `<p>Your shift changed from ${from} to ${to}.</p>`,
  });
  if (user.phoneNumber) {
    await sendSms({
      to: user.phoneNumber,
      body: `ESP Scheduler shift updated: ${from} -> ${to}`,
    });
  }
}

export async function notifyActivation(email: string, name: string, url: string) {
  await sendEmail({
    to: email,
    subject: "Activate your ESP Scheduler account",
    html: `<p>Hi ${name || "there"},</p><p>Confirm your account and set a password:</p><p><a href="${url}">${url}</a></p>`,
  });
}

export async function notifyPasswordReset(email: string, url: string) {
  await sendEmail({
    to: email,
    subject: "Reset your ESP Scheduler password",
    html: `<p>Reset your password using this link (expires in 2 hours):</p><p><a href="${url}">${url}</a></p>`,
  });
}
