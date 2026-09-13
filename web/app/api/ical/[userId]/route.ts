import { addMonths, subMonths } from "date-fns";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function escapeText(value: string) {
  return value.replace(/[\\,;]/g, "\\$&").replace(/\n/g, "\\n");
}

function formatIcsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const { userId } = await context.params;
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, icalToken: token },
  });
  if (!user) {
    return NextResponse.json({ error: "Invalid feed" }, { status: 401 });
  }

  const now = new Date();
  const shifts = await prisma.shift.findMany({
    where: {
      userId,
      published: true,
      start: { gte: subMonths(now, 1), lt: addMonths(now, 3) },
    },
    include: { team: true, job: true },
    orderBy: { start: "asc" },
  });

  const events = shifts
    .map((shift) => {
      const summary = shift.job?.name
        ? `${shift.job.name} @ ${shift.team.name}`
        : `Shift @ ${shift.team.name}`;
      return [
        "BEGIN:VEVENT",
        `UID:${shift.id}@esp-scheduler`,
        `DTSTAMP:${formatIcsDate(now)}`,
        `DTSTART:${formatIcsDate(shift.start)}`,
        `DTEND:${formatIcsDate(shift.stop)}`,
        `SUMMARY:${escapeText(summary)}`,
        "END:VEVENT",
      ].join("\r\n");
    })
    .join("\r\n");

  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ESP Scheduler//EN",
    "CALSCALE:GREGORIAN",
    events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${userId}.ics"`,
    },
  });
}
