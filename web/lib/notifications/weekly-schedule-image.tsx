import { ImageResponse } from "next/og";
import type { WeeklySchedulePayload } from "@/lib/notifications/schedule-week";

export function weeklyScheduleImage(payload: WeeklySchedulePayload) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#ffffff",
          color: "#16302e",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#48b7ab",
            color: "#ffffff",
            padding: "28px 36px",
          }}
        >
          <div style={{ display: "flex", fontSize: 22, fontWeight: 600, opacity: 0.9 }}>
            {payload.companyName}
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, marginTop: 6 }}>
            {payload.employeeName}
          </div>
          <div style={{ display: "flex", fontSize: 22, marginTop: 8 }}>
            Week of {payload.weekLabel}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flex: 1,
            padding: "20px 16px 24px",
            gap: 8,
          }}
        >
          {payload.days.map((day) => (
            <div
              key={day.key}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                border: "1px solid #d7e3e1",
                borderRadius: 12,
                padding: "14px 10px",
                backgroundColor: "#f6faf9",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: 1,
                  color: "#3a9a90",
                }}
              >
                {day.weekday}
              </div>
              <div style={{ display: "flex", fontSize: 28, fontWeight: 700, marginTop: 4 }}>
                {day.dateLabel}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  marginTop: 16,
                  gap: 8,
                }}
              >
                {day.windows.length ? (
                  day.windows.map((window) => (
                    <div
                      key={`${day.key}-${window}`}
                      style={{
                        display: "flex",
                        fontSize: 16,
                        fontWeight: 600,
                        lineHeight: 1.3,
                      }}
                    >
                      {window}
                    </div>
                  ))
                ) : (
                  <div style={{ display: "flex", fontSize: 16, color: "#7a8c8a" }}>Off</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

export async function weeklySchedulePng(payload: WeeklySchedulePayload) {
  const image = weeklyScheduleImage(payload);
  return Buffer.from(await image.arrayBuffer());
}
