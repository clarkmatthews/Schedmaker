"use client";

import { useRouter } from "next/navigation";
import { SETTINGS_SECTIONS, type SettingsSection, type SettingsSectionId } from "@/lib/settings/sections";
import { cn } from "@/lib/utils";

export function SettingsAccordion({
  companyId,
  section,
  panels,
  sections = SETTINGS_SECTIONS,
  readOnly,
}: {
  companyId: string;
  section: SettingsSectionId;
  panels: Partial<Record<SettingsSectionId, React.ReactNode>>;
  sections?: SettingsSection[];
  readOnly?: Partial<Record<SettingsSectionId, boolean>>;
}) {
  const router = useRouter();

  return (
    <div className="space-y-3">
      {sections.map((item) => {
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
                <fieldset disabled={Boolean(readOnly?.[item.id])} className="min-w-0 space-y-4">
                  {panels[item.id]}
                </fieldset>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
