"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  assignHoursTemplateAction,
  createHoursTemplateAction,
  deleteHoursTemplateAction,
  updateHoursTemplateAction,
} from "@/lib/actions/hours";
import {
  DEFAULT_BUSINESS_END,
  DEFAULT_BUSINESS_START,
  defaultHoursDays,
  type HoursDay,
  type HoursTemplateView,
} from "@/lib/scheduling/hours";
import { endSlotOptions, slotOptions } from "@/lib/scheduling/time-grid";
import { WEEKDAYS } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { HelpTip } from "@/components/ui/help-tip";
import { FieldError, Input, Label, Select } from "@/components/ui/input";

const START_OPTIONS = slotOptions();
const END_OPTIONS = endSlotOptions();

type HoursDraft = { name: string; days: HoursDay[] };
type SavedHours = {
  assignedId: string;
  drafts: Record<string, HoursDraft>;
};

const lastSaved = new Map<string, SavedHours>();

function savedHours(companyId: string): SavedHours {
  return lastSaved.get(companyId) ?? { assignedId: "", drafts: {} };
}

function titleCase(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function SlotSelect({
  value,
  onChange,
  includeEnd,
  disabled,
}: {
  value: number;
  onChange: (index: number) => void;
  includeEnd?: boolean;
  disabled?: boolean;
}) {
  const options = includeEnd ? END_OPTIONS : START_OPTIONS;
  return (
    <Select
      value={String(value)}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {options.map((option) => (
        <option key={option.index} value={option.index}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

export function HoursSettings({
  companyId,
  companyName,
  assignedTemplateId,
  templates,
}: {
  companyId: string;
  companyName: string;
  assignedTemplateId: string | null;
  templates: HoursTemplateView[];
}) {
  const router = useRouter();
  const saved = lastSaved.get(companyId);
  const [error, setError] = useState<string | null>(null);
  const [assignedId, setAssignedId] = useState(saved?.assignedId ?? assignedTemplateId ?? "");
  const [editingId, setEditingId] = useState(assignedTemplateId ?? templates[0]?.id ?? "");
  const [newName, setNewName] = useState("");
  const editing = useMemo(
    () => templates.find((item) => item.id === editingId) ?? null,
    [editingId, templates],
  );
  const initialDraft = saved?.drafts[editing?.id ?? ""] ?? editing;
  const [name, setName] = useState(initialDraft?.name ?? "");
  const [days, setDays] = useState<HoursDay[]>(
    initialDraft?.days ? structuredClone(initialDraft.days) : defaultHoursDays(),
  );

  useEffect(() => {
    const remembered = lastSaved.get(companyId);
    setAssignedId(remembered?.assignedId ?? assignedTemplateId ?? "");
  }, [assignedTemplateId, companyId]);

  useEffect(() => {
    if (templates.length === 0) {
      if (editingId) setEditingId("");
      return;
    }
    if (!templates.some((item) => item.id === editingId)) {
      loadTemplate(templates[0]);
    }
  }, [editingId, templates]);

  useEffect(() => {
    if (!editing) return;
    const draft = lastSaved.get(companyId)?.drafts[editing.id];
    setName(draft?.name ?? editing.name);
    setDays(structuredClone(draft?.days ?? editing.days));
  }, [editing, companyId]);

  function loadTemplate(template: HoursTemplateView | null) {
    setEditingId(template?.id ?? "");
    setName(template?.name ?? "");
    setDays(template ? structuredClone(template.days) : defaultHoursDays());
  }

  function patchDay(weekday: HoursDay["weekday"], patch: Partial<HoursDay>) {
    setDays((current) =>
      current.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day)),
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted">
        Hours templates belong to this location and can differ by brand. Assign one
        template to <span className="font-medium text-ink">{companyName}</span> to
        set the day-view scheduling window and optional business-hour shading.
      </p>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const result = await assignHoursTemplateAction(companyId, formData);
          if (result.error) {
            setError(result.error);
            return;
          }
          const current = savedHours(companyId);
          lastSaved.set(companyId, { ...current, assignedId });
          setError(null);
        }}
      >
        <div className="min-w-64 flex-1">
          <Label htmlFor="hoursTemplateId">Assigned to this location</Label>
          <Select
            id="hoursTemplateId"
            name="hoursTemplateId"
            value={assignedId}
            onChange={(event) => setAssignedId(event.target.value)}
          >
            <option value="">None (full 24-hour grid)</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit">Assign template</Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {templates.map((template) => (
          <Button
            key={template.id}
            type="button"
            variant={editingId === template.id ? "primary" : "outline"}
            onClick={() => loadTemplate(template)}
          >
            {template.name}
          </Button>
        ))}
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        action={async (formData) => {
          formData.set("days", JSON.stringify(defaultHoursDays()));
          const result = await createHoursTemplateAction(companyId, formData);
          if (result.error) setError(result.error);
          else {
            setError(null);
            setNewName("");
            if (result.templateId) {
              setEditingId(result.templateId);
              if (!assignedId) {
                setAssignedId(result.templateId);
                const current = savedHours(companyId);
                lastSaved.set(companyId, { ...current, assignedId: result.templateId });
              }
            }
            router.refresh();
          }
        }}
      >
        <div className="min-w-64 flex-1">
          <Label htmlFor="new-template-name">New template</Label>
          <Input
            id="new-template-name"
            name="name"
            value={newName}
            placeholder="Restaurant hours"
            onChange={(event) => setNewName(event.target.value)}
          />
        </div>
        <Button type="submit">Create template</Button>
      </form>

      {editing ? (
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const formData = new FormData();
            formData.set("name", name);
            formData.set("days", JSON.stringify(days));
            const result = await updateHoursTemplateAction(companyId, editing.id, formData);
            if (result.error) {
              setError(result.error);
              return;
            }
            const current = savedHours(companyId);
            lastSaved.set(companyId, {
              assignedId: current.assignedId || assignedId,
              drafts: {
                ...current.drafts,
                [editing.id]: { name, days: structuredClone(days) },
              },
            });
            setError(null);
          }}
        >
          <div className="max-w-md">
            <Label htmlFor="template-name">Template name</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <p className="flex items-start gap-1 text-sm text-muted">
            <span>
              Earliest in and latest out define the scheduling grid. Optional business
              hours paint a lighter band inside that window.
            </span>
            <HelpTip topic="hoursWindows" />
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="pb-2 pr-2 font-medium">Day</th>
                  <th className="pb-2 pr-2 font-medium">Closed</th>
                  <th className="pb-2 pr-2 font-medium">Earliest in</th>
                  <th className="pb-2 pr-2 font-medium">Latest out</th>
                  <th className="pb-2 pr-2 font-medium">Business hours</th>
                  <th className="pb-2 pr-2 font-medium">Open</th>
                  <th className="pb-2 font-medium">Close</th>
                </tr>
              </thead>
              <tbody>
                {WEEKDAYS.map((weekday) => {
                  const day = days.find((item) => item.weekday === weekday);
                  if (!day) return null;
                  const hasBusiness =
                    day.businessStartSlot != null && day.businessEndSlot != null;
                  return (
                    <tr key={weekday} className="border-t border-border align-top">
                      <td className="py-2 pr-2 font-medium">{titleCase(weekday)}</td>
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={day.closed}
                          onChange={(event) =>
                            patchDay(weekday, { closed: event.target.checked })
                          }
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <SlotSelect
                          value={day.scheduleStartSlot}
                          disabled={day.closed}
                          onChange={(scheduleStartSlot) =>
                            patchDay(weekday, { scheduleStartSlot })
                          }
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <SlotSelect
                          includeEnd
                          value={day.scheduleEndSlot}
                          disabled={day.closed}
                          onChange={(scheduleEndSlot) =>
                            patchDay(weekday, { scheduleEndSlot })
                          }
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={hasBusiness}
                          disabled={day.closed}
                          onChange={(event) =>
                            patchDay(
                              weekday,
                              event.target.checked
                                ? {
                                    businessStartSlot: DEFAULT_BUSINESS_START,
                                    businessEndSlot: DEFAULT_BUSINESS_END,
                                  }
                                : { businessStartSlot: null, businessEndSlot: null },
                            )
                          }
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <SlotSelect
                          value={day.businessStartSlot ?? DEFAULT_BUSINESS_START}
                          disabled={day.closed || !hasBusiness}
                          onChange={(businessStartSlot) =>
                            patchDay(weekday, { businessStartSlot })
                          }
                        />
                      </td>
                      <td className="py-2">
                        <SlotSelect
                          includeEnd
                          value={day.businessEndSlot ?? DEFAULT_BUSINESS_END}
                          disabled={day.closed || !hasBusiness}
                          onChange={(businessEndSlot) =>
                            patchDay(weekday, { businessEndSlot })
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const monday = days.find((day) => day.weekday === "monday");
                if (!monday) return;
                setDays(
                  WEEKDAYS.map((weekday) => ({
                    ...monday,
                    weekday,
                  })),
                );
              }}
            >
              Copy Monday to all days
            </Button>
            <Button type="submit">Save hours</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                const result = await deleteHoursTemplateAction(companyId, editing.id);
                if (result.error) setError(result.error);
                else {
                  setError(null);
                  loadTemplate(templates.find((item) => item.id !== editing.id) ?? null);
                  router.refresh();
                }
              }}
            >
              Delete template
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted">Create a template to define hours for this location.</p>
      )}
      <FieldError message={error} />
    </div>
  );
}
