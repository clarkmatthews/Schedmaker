import { addHours, format } from "date-fns";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { mmsConfigReady, sendMms } from "@/lib/notifications/mms";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "@/lib/secrets";
import {
  loadWeeklySchedule,
  publishedWeekBounds,
  scheduleMessageBody,
} from "@/lib/notifications/schedule-week";
import { weeklySchedulePng } from "@/lib/notifications/weekly-schedule-image";

function appBaseUrl() {
  return process.env.AUTH_URL ?? "http://localhost:3000";
}

function mmsPreviewDir() {
  return path.join(process.cwd(), "tmp", "mms");
}

function safeSegment(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "employee"
  );
}

async function saveMmsPreview(params: {
  employeeName: string;
  weekStart: Date;
  png: Buffer;
}) {
  const dir = mmsPreviewDir();
  await mkdir(dir, { recursive: true });
  const fileName = `${format(new Date(), "yyyyMMdd-HHmmss")}-${safeSegment(params.employeeName)}-${format(params.weekStart, "yyyy-MM-dd")}.png`;
  const filePath = path.join(dir, fileName);
  await writeFile(filePath, params.png);
  return filePath;
}

export async function notifyPublishedSchedule(params: {
  companyId: string;
  teamId: string;
  userId: string;
  rangeStart: Date;
}) {
  const company = await prisma.company.findUnique({
    where: { id: params.companyId },
  });
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { phoneNumber: true, name: true, email: true },
  });
  if (!company || !user) return;

  const { start: weekStart } = publishedWeekBounds(
    params.rangeStart,
    company.defaultDayWeekStarts,
  );
  const payload = await loadWeeklySchedule({
    companyId: params.companyId,
    teamId: params.teamId,
    userId: params.userId,
    weekStart,
  });
  if (!payload) return;

  const body = scheduleMessageBody(payload);
  const daySummary = payload.days.map((day) => ({
    day: `${day.weekday} ${day.dateLabel}`,
    times: day.windows.length ? day.windows.join(", ") : "Off",
  }));
  const to = user.phoneNumber || user.email;

  if (!mmsConfigReady(company)) {
    let previewPath: string | undefined;
    try {
      previewPath = await saveMmsPreview({
        employeeName: payload.employeeName,
        weekStart,
        png: await weeklySchedulePng(payload),
      });
    } catch (error) {
      console.error("[mms:dev] Could not save preview image", error);
    }
    console.info("[mms:dev]", to, body, daySummary, previewPath ?? null);
    return;
  }

  if (!user.phoneNumber) {
    console.info("[mms:skip]", user.email, "no phone number");
    return;
  }

  await prisma.mmsScheduleShare.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  const share = await prisma.mmsScheduleShare.create({
    data: {
      companyId: params.companyId,
      teamId: params.teamId,
      userId: params.userId,
      weekStart,
      expiresAt: addHours(new Date(), 24),
    },
  });

  let authToken: string;
  try {
    authToken = company.mmsAuthToken;
    if (authToken && !isEncryptedSecret(authToken)) {
      const plain = authToken;
      authToken = encryptSecret(plain);
      await prisma.company.update({
        where: { id: company.id },
        data: { mmsAuthToken: authToken },
      });
      authToken = plain;
    } else {
      authToken = decryptSecret(authToken);
    }
  } catch (error) {
    console.error("[mms] could not read Twilio token", error);
    return;
  }

  await sendMms({
    config: {
      accountSid: company.mmsAccountSid,
      authToken,
      fromNumber: company.mmsFromNumber,
    },
    to: user.phoneNumber,
    body,
    mediaUrl: `${appBaseUrl()}/api/mms/${share.id}`,
  });
}
