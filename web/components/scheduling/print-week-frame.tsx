"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export function PrintWeekFrame({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.classList.add("print-week");
    return () => document.body.classList.remove("print-week");
  }, []);

  return (
    <div className="print-week-frame">
      <div className="print-week-actions mb-4">
        <Button type="button" onClick={() => window.print()}>
          Print
        </Button>
      </div>
      {children}
    </div>
  );
}
