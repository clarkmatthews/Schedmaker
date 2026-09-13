"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SETTINGS_SECTIONS, type SettingsSectionId } from "@/lib/settings/sections";
import { cn } from "@/lib/utils";

export function SettingsAccordion({
  companyId,
  section,
  panels,
}: {
  companyId: string;
  section: SettingsSectionId;
  panels: Record<SettingsSectionId, React.ReactNode>;
}) {
  const router = useRouter();

  return (
    <div className="space-y-3">
      {SETTINGS_SECTIONS.map((item) => {
        const open = item.id === section;
        return (
          <section
            key={item.id}
            className="overflow-hidden rounded-lg border border-border bg-white"
          >
            <button
              type="button"
              className={cn(
                "flex w-full items-center justify-between px-5 py-3 text-left font-semibold",
                open ? "bg-ink text-white" : "hover:bg-black/5",
              )}
              onClick={() =>
                router.push(`/app/companies/${companyId}/settings?section=${item.id}`)
              }
            >
              {item.label}
              <span>{open ? "−" : "+"}</span>
            </button>
            {open ? (
              <div className="border-t border-border p-5">
                {item.id === "account" ? (
                  <p className="text-sm">
                    Manage your profile, password, and calendar feed in{" "}
                    <Link href="/account" className="text-teal hover:underline">
                      My account
                    </Link>
                    .
                  </p>
                ) : (
                  panels[item.id]
                )}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
