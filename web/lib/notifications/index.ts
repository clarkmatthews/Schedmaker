import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { escapeHtml } from "./html";
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

  const subject = `You've been added to ${company.name} on Schedmaker`;
  const body = `Hi ${user.name || "there"}, you were added to ${company.name}. Activate or log in to see your schedule.`;
  await sendEmail({ to: user.email, subject, html: `<p>${escapeHtml(body)}</p>` });
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
  const list = shifts.map((s) => escapeHtml(shiftWindow(s.start, s.stop))).join("<br>");
  await sendEmail({
    to: user.email,
    subject: shifts.length === 1 ? "New shift assigned" : "New shifts assigned",
    html: `<p>You have new published shift(s):</p><p>${list}</p>`,
  });
}

export async function notifyRemovedShifts(
  userId: string,
  shifts: { start: Date; stop: Date }[],
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const list = shifts.map((s) => escapeHtml(shiftWindow(s.start, s.stop))).join("<br>");
  await sendEmail({
    to: user.email,
    subject: shifts.length === 1 ? "Shift removed" : "Shifts removed",
    html: `<p>These published shift(s) were removed or unpublished:</p><p>${list}</p>`,
  });
}

export async function notifyChangedShift(
  userId: string,
  oldShift: { start: Date; stop: Date },
  newShift: { start: Date; stop: Date },
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const from = escapeHtml(shiftWindow(oldShift.start, oldShift.stop));
  const to = escapeHtml(shiftWindow(newShift.start, newShift.stop));
  await sendEmail({
    to: user.email,
    subject: "Shift updated",
    html: `<p>Your shift changed from ${from} to ${to}.</p>`,
  });
}

export async function notifyActivation(email: string, name: string, url: string) {
  const safeName = escapeHtml(name || "there");
  const safeUrl = escapeHtml(url);
  await sendEmail({
    to: email,
    subject: "Activate your Schedmaker account",
    html: `<p>Hi ${safeName},</p><p>Confirm your account and set a password:</p><p><a href="${safeUrl}">${safeUrl}</a></p>`,
  });
}

export async function notifyAccountExists(email: string) {
  await sendEmail({
    to: email,
    subject: "Schedmaker sign-up",
    html: "<p>An account with this email already exists. Log in, or reset your password if you need a new one.</p>",
  });
}

export async function notifyPasswordReset(email: string, url: string) {
  const safeUrl = escapeHtml(url);
  await sendEmail({
    to: email,
    subject: "Reset your Schedmaker password",
    html: `<p>Reset your password using this link (expires in 2 hours):</p><p><a href="${safeUrl}">${safeUrl}</a></p>`,
  });
}
