import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadWeeklySchedule } from "@/lib/notifications/schedule-week";
import { weeklyScheduleImage } from "@/lib/notifications/weekly-schedule-image";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const share = await prisma.mmsScheduleShare.findFirst({
    where: { id, expiresAt: { gt: new Date() } },
  });
  if (!share) {
    return NextResponse.json({ error: "Schedule image expired." }, { status: 404 });
  }

  const payload = await loadWeeklySchedule({
    companyId: share.companyId,
    teamId: share.teamId,
    userId: share.userId,
    weekStart: share.weekStart,
  });
  if (!payload) {
    return NextResponse.json({ error: "Schedule not found." }, { status: 404 });
  }

  return weeklyScheduleImage(payload);
}
