"use client";

import { useEffect, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";

export function TimezoneClock({ timezone }: { timezone: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = window.setInterval(tick, 15000);
    return () => window.clearInterval(timer);
  }, []);

  if (!now) return <p className="text-sm text-muted">{timezone}</p>;

  return (
    <p className="text-sm text-muted">
      {formatInTimeZone(now, timezone, "h:mm a zzz")}
    </p>
  );
}
