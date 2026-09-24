"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createUnavailabilityAction,
  deleteUnavailabilityAction,
} from "@/lib/actions/availability";
import type { AvailabilityPerson } from "@/lib/availability-access";
import {
  WEEKDAY_NAMES,
  entrySummary,
  type UnavailableEntry,
} from "@/lib/scheduling/availability";
import { endSlotOptions, slotOptions } from "@/lib/scheduling/time-grid";
import { Button } from "@/components/ui/button";
import { FieldError, Label, Select } from "@/components/ui/input";

function sortEntries(entries: UnavailableEntry[]) {
  return [...entries].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "weekday" ? -1 : 1;
    if (a.kind === "weekday") {
      return (a.weekday ?? 0) - (b.weekday ?? 0) || (a.startMinutes ?? -1) - (b.startMinutes ?? -1);
    }
    return (a.date ?? "").localeCompare(b.date ?? "") || (a.startMinutes ?? -1) - (b.startMinutes ?? -1);
  });
}

export function AvailabilityEditor({
  selfId,
  people,
  entries,
  canReview = false,
}: {
  selfId: string;
  people: AvailabilityPerson[];
  entries: UnavailableEntry[];
  canReview?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [personId, setPersonId] = useState(selfId);
  const [kind, setKind] = useState<"date" | "weekday">("weekday");
  const [allDay, setAllDay] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const person = people.find((item) => item.id === personId) ?? people[0];
  const canEdit = Boolean(person?.canEdit);
  const visible = useMemo(
    () => sortEntries(entries.filter((entry) => entry.userId === person?.id)),
    [entries, person?.id],
  );
  const defined = useMemo(() => {
    return people
      .map((item) => ({
        person: item,
        entries: sortEntries(entries.filter((entry) => entry.userId === item.id)),
      }))
      .filter((item) => item.entries.length > 0)
      .sort((a, b) => a.person.name.localeCompare(b.person.name));
  }, [people, entries]);
  const starts = slotOptions().filter((option) => option.index < 96);
  const ends = endSlotOptions().filter((option) => option.index > 0);

  function save(formData: FormData) {
    if (!person) return;
    setError(null);
    startTransition(async () => {
      const result = await createUnavailabilityAction(person.id, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setAllDay(true);
      setFormVersion((value) => value + 1);
      router.refresh();
    });
  }

  function openPerson(userId: string) {
    setPersonId(userId);
    setError(null);
    document.getElementById("availability-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function remove(entryId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteUnavailabilityAction(entryId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div id="availability-editor">
        <h1 className="text-2xl font-bold text-ink">Availability</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Record a calendar day or a weekly day when you cannot work, for the whole day or for a
          range of hours. Saved entries apply at every restaurant right away.
        </p>
      </div>

      {people.length > 1 ? (
        <div className="max-w-sm">
          <Label htmlFor="availabilityPerson">Person</Label>
          <Select
            id="availabilityPerson"
            value={person?.id ?? ""}
            onChange={(event) => {
              setPersonId(event.target.value);
              setError(null);
            }}
          >
            {people.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id === selfId ? `${item.name} (you)` : item.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {canEdit ? (
        <form
          key={formVersion}
          className="max-w-xl space-y-4 rounded-lg border border-border bg-white p-4"
          onSubmit={(event) => {
            event.preventDefault();
            save(new FormData(event.currentTarget));
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="availabilityKind">Kind</Label>
              <Select
                id="availabilityKind"
                name="kind"
                value={kind}
                onChange={(event) => setKind(event.target.value === "date" ? "date" : "weekday")}
              >
                <option value="weekday">Every week</option>
                <option value="date">One date</option>
              </Select>
            </div>
            {kind === "weekday" ? (
              <div>
                <Label htmlFor="availabilityWeekday">Day</Label>
                <Select id="availabilityWeekday" name="weekday" defaultValue="1">
                  {WEEKDAY_NAMES.map((name, index) => (
                    <option key={name} value={index}>
                      {name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <div>
                <Label htmlFor="availabilityDate">Date</Label>
                <input
                  id="availabilityDate"
                  name="date"
                  type="date"
                  required
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-teal"
                />
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(event) => setAllDay(event.target.checked)}
            />
            All day
          </label>
          <input type="hidden" name="allDay" value={allDay ? "true" : "false"} />
          {allDay ? null : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="availabilityStart">From</Label>
                <Select id="availabilityStart" name="startMinutes" defaultValue="540">
                  {starts.map((option) => (
                    <option key={option.index} value={option.index * 15}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="availabilityEnd">Until</Label>
                <Select id="availabilityEnd" name="endMinutes" defaultValue="1020">
                  {ends.map((option) => (
                    <option key={`end-${option.index}`} value={option.index * 15}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          )}
          <Button type="submit" disabled={pending}>
            Add
          </Button>
          <FieldError message={error} />
        </form>
      ) : (
        <p className="text-sm text-muted">You can view these entries.</p>
      )}

      {canEdit ? null : <FieldError message={error} />}

      <ul className="max-w-xl divide-y divide-border rounded-lg border border-border bg-white">
        {visible.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted">No unavailable times yet.</li>
        ) : (
          visible.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-ink">{entrySummary(entry)}</span>
              {canEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => remove(entry.id)}
                >
                  Remove
                </Button>
              ) : null}
            </li>
          ))
        )}
      </ul>

      {canReview ? (
        <section className="max-w-xl space-y-2">
          <h2 className="text-lg font-semibold text-ink">Defined availability</h2>
          <p className="text-sm text-muted">
            Employees who have recorded times they cannot work. Choose a name to open their entries.
          </p>
          {defined.length === 0 ? (
            <p className="rounded-lg border border-border bg-white px-4 py-3 text-sm text-muted">
              No employees have unavailable times yet.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-white">
              {defined.map((item) => (
                <li key={item.person.id}>
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left hover:bg-black/5"
                    onClick={() => openPerson(item.person.id)}
                  >
                    <span className="font-medium text-teal">
                      {item.person.id === selfId ? `${item.person.name} (you)` : item.person.name}
                    </span>
                    <ul className="mt-1 space-y-0.5">
                      {item.entries.map((entry) => (
                        <li key={entry.id} className="text-sm text-muted">
                          {entrySummary(entry)}
                        </li>
                      ))}
                    </ul>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
