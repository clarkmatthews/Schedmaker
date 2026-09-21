"use client";

import { useRouter } from "next/navigation";
import { SETTINGS_HELP } from "@/lib/help/topics";
import { SETTINGS_SECTIONS, type SettingsSection, type SettingsSectionId } from "@/lib/settings/sections";
import { cn } from "@/lib/utils";
import { HelpTip } from "@/components/ui/help-tip";

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
            <div
              className={cn(
                "flex w-full items-center gap-2 px-5 py-3",
                open ? "bg-ink text-white" : "hover:bg-black/5",
              )}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center justify-between text-left font-semibold"
                onClick={() =>
                  router.push(`/app/companies/${companyId}/settings?section=${item.id}`)
                }
              >
                {item.label}
                <span>{open ? "−" : "+"}</span>
              </button>
              {SETTINGS_HELP[item.id] ? (
                <HelpTip
                  topic={SETTINGS_HELP[item.id]}
                  tone={open ? "onDark" : "default"}
                  align="end"
                />
              ) : null}
            </div>
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
