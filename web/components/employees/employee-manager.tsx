"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createEmployeeAction,
  setEmployeeDeactivatedAction,
  setEmployeeLoansAction,
  setEmployeeMealWaiverAction,
  setEmployeeRoleAction,
  setEmployeeTeamAction,
  setEmployeeJobsAction,
  resetEmployeePasswordAction,
  setHomeCompanyAction,
  setManagedCompaniesAction,
  updateEmployeeAction,
} from "@/lib/actions/employees";
import {
  formatHourlyRateInput,
  parseHourlyRate,
  sanitizeHourlyRateInput,
  type EmployeeRecord,
  type EmployeeRoleOption,
} from "@/lib/employees";
import { ADMINISTRATOR_SYSTEM_KEY } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { HelpTip } from "@/components/ui/help-tip";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";

export function CompanyChecklist({
  label,
  companies,
  selectedIds,
  emptyLabel,
  onSave,
  onDraft,
}: {
  label: string;
  companies: { id: string; name: string }[];
  selectedIds: string[];
  emptyLabel: string;
  onSave?: (companyIds: string[]) => Promise<boolean>;
  onDraft?: (companyIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(selectedIds);
  const [pending, setPending] = useState(false);
  const selectedKey = selectedIds.slice().sort().join(",");
  useEffect(() => {
    setPicked(selectedKey ? selectedKey.split(",") : []);
  }, [selectedKey]);
  const summary =
    companies
      .filter((company) => picked.includes(company.id))
      .map((company) => company.name)
      .join(", ") || emptyLabel;

  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium">{label}</p>
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-md border border-border bg-white px-3 py-2 text-left"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="truncate">{summary}</span>
        <span className="text-muted">{open ? "▴" : "▾"}</span>
      </button>
      {open ? (
        <div className="space-y-2 rounded-md border border-border bg-white p-2">
          {companies.length === 0 ? (
            <p className="text-muted">No other companies.</p>
          ) : (
            companies.map((company) => (
              <label key={company.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={picked.includes(company.id)}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...picked, company.id]
                      : picked.filter((id) => id !== company.id);
                    setPicked(next);
                    onDraft?.(next);
                  }}
                />
                {company.name}
              </label>
            ))
          )}
          {onDraft ? null : (
          <Button
            type="button"
            variant="outline"
            disabled={pending || !onSave}
            onClick={async () => {
              if (!onSave) return;
              setPending(true);
              const saved = await onSave(picked);
              setPending(false);
              if (saved) setOpen(false);
            }}
          >
            {pending ? "Saving…" : "Done"}
          </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function JobChecklist({
  jobs,
  selected,
  onSave,
  onDraft,
}: {
  jobs: { id: string; name: string; teamName: string }[];
  selected: { jobId: string; primary: boolean }[];
  onSave?: (assignments: { jobId: string; primary: boolean }[]) => Promise<boolean>;
  onDraft?: (assignments: { jobId: string; primary: boolean }[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(selected.map((job) => job.jobId));
  const [primaryId, setPrimaryId] = useState(
    selected.find((job) => job.primary)?.jobId ?? "",
  );
  const [pending, setPending] = useState(false);
  const selectedKey = selected
    .map((job) => `${job.jobId}:${job.primary ? "1" : "0"}`)
    .sort()
    .join(",");
  useEffect(() => {
    const rows = selectedKey
      ? selectedKey.split(",").map((part) => {
          const [jobId, flag] = part.split(":");
          return { jobId, primary: flag === "1" };
        })
      : [];
    setPicked(rows.map((job) => job.jobId));
    setPrimaryId(rows.find((job) => job.primary)?.jobId ?? "");
  }, [selectedKey]);
  function draft(nextPicked: string[], nextPrimary: string) {
    onDraft?.(nextPicked.map((jobId) => ({ jobId, primary: jobId === nextPrimary })));
  }

  const summary =
    jobs
      .filter((job) => picked.includes(job.id))
      .map((job) => (job.id === primaryId ? `${job.name} (primary)` : job.name))
      .join(", ") || "No jobs assigned";

  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium">Jobs</p>
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-md border border-border bg-white px-3 py-2 text-left"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="truncate">{summary}</span>
        <span className="text-muted">{open ? "▴" : "▾"}</span>
      </button>
      {open ? (
        <div className="space-y-2 rounded-md border border-border bg-white p-2">
          {jobs.length === 0 ? (
            <p className="text-muted">No jobs at this store.</p>
          ) : (
            jobs.map((job) => {
              const checked = picked.includes(job.id);
              return (
                <div key={job.id} className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        if (event.target.checked) {
                          const nextPicked = [...picked, job.id];
                          const nextPrimary = primaryId || job.id;
                          setPicked(nextPicked);
                          setPrimaryId(nextPrimary);
                          draft(nextPicked, nextPrimary);
                        } else {
                          const nextPicked = picked.filter((id) => id !== job.id);
                          const nextPrimary = primaryId === job.id ? "" : primaryId;
                          setPicked(nextPicked);
                          setPrimaryId(nextPrimary);
                          draft(nextPicked, nextPrimary);
                        }
                      }}
                    />
                    {job.name}
                    {jobs.some((other) => other.id !== job.id && other.teamName !== job.teamName)
                      ? ` (${job.teamName})`
                      : ""}
                  </label>
                  {checked ? (
                    <label className="flex items-center gap-1 text-muted">
                      <input
                        type="radio"
                        name="primaryJob"
                        checked={primaryId === job.id}
                        onChange={() => {
                          setPrimaryId(job.id);
                          draft(picked, job.id);
                        }}
                      />
                      Primary
                    </label>
                  ) : null}
                </div>
              );
            })
          )}
          {onDraft ? null : (
          <Button
            type="button"
            variant="outline"
            disabled={pending || !onSave}
            onClick={async () => {
              if (!onSave) return;
              setPending(true);
              const saved = await onSave(
                picked.map((jobId) => ({ jobId, primary: jobId === primaryId })),
              );
              setPending(false);
              if (saved) setOpen(false);
            }}
          >
            {pending ? "Saving…" : "Done"}
          </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function primaryJobRate(
  assignments: { jobId: string; primary: boolean; hourlyRate?: number | null }[],
  catalog: { id: string; hourlyRate: number | null }[],
) {
  const primary = assignments.find((job) => job.primary);
  if (!primary) return null;
  if (primary.hourlyRate != null) return primary.hourlyRate;
  return catalog.find((job) => job.id === primary.jobId)?.hourlyRate ?? null;
}

function PayRateFields({
  primaryRate,
  overrideRate,
  disabled,
}: {
  primaryRate: number | null;
  overrideRate?: number | null;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label htmlFor="primaryJobRate">Primary job rate</Label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">
            $
          </span>
          <Input
            id="primaryJobRate"
            readOnly
            tabIndex={-1}
            value={primaryRate == null ? "" : formatHourlyRateInput(primaryRate)}
            placeholder="—"
            className="bg-black/3 pl-7 tabular-nums"
          />
        </div>
      </div>
      <div>
        <span className="inline-flex items-center gap-1">
          <Label htmlFor="hourlyRate">Override Hourly Rate</Label>
          <HelpTip topic="employeeRate" align="end" />
        </span>
        <HourlyRateField defaultRate={overrideRate} disabled={disabled} />
      </div>
    </div>
  );
}

function HourlyRateField({
  defaultRate,
  disabled,
}: {
  defaultRate?: number | null;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(() => formatHourlyRateInput(defaultRate));

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">
        $
      </span>
      <Input
        id="hourlyRate"
        name="hourlyRate"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        className="pl-7 tabular-nums"
        disabled={disabled}
        value={value}
        onChange={(event) => setValue(sanitizeHourlyRateInput(event.target.value))}
        onBlur={() => {
          const parsed = parseHourlyRate(value);
          if (parsed.error) return;
          setValue(formatHourlyRateInput(parsed.rate));
        }}
      />
    </div>
  );
}

function ResetPasswordPanel({
  companyId,
  userId,
}: {
  companyId: string;
  userId: string;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-2 rounded-md border border-border p-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setDone(false);
        const result = await resetEmployeePasswordAction(companyId, userId, password);
        setPending(false);
        if (result.error) {
          setError(result.error);
          return;
        }
        setError(null);
        setPassword("");
        setDone(true);
      }}
    >
      <p className="text-sm font-medium">Reset password</p>
      <p className="text-sm text-muted">
        Set a temporary password. The next time they sign in, they must choose a new one.
      </p>
      <div>
        <Label htmlFor={`reset-password-${userId}`}>Temporary password</Label>
        <Input
          id={`reset-password-${userId}`}
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <FieldError message={error} />
      {done ? (
        <p className="text-sm text-ink">
          Password reset. They must choose a new password the next time they sign in.
        </p>
      ) : null}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Resetting…" : "Reset password"}
      </Button>
    </form>
  );
}

export function EmployeeManager({
  companyId,
  employees,
  teams,
  roles,
  selectedId,
  showDeactivated,
  currentUserId,
  canEdit,
  canAssignAdministrator,
  canResetPasswords,
  companies,
  jobs,
}: {
  companyId: string;
  employees: EmployeeRecord[];
  teams: { id: string; name: string }[];
  roles: EmployeeRoleOption[];
  selectedId?: string;
  showDeactivated: boolean;
  currentUserId: string;
  canEdit: boolean;
  canAssignAdministrator: boolean;
  canResetPasswords: boolean;
  companies: { id: string; name: string }[];
  jobs: { id: string; name: string; teamName: string; hourlyRate: number | null }[];
}) {
  const router = useRouter();
  const selectedEmployee = employees.find((e) => e.userId === selectedId) ?? null;
  const selected =
    selectedEmployee && (showDeactivated || !selectedEmployee.deactivated)
      ? selectedEmployee
      : null;
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createHomeId, setCreateHomeId] = useState(companyId);
  const [createJobs, setCreateJobs] = useState<{ jobId: string; primary: boolean }[]>([]);
  const [createLoans, setCreateLoans] = useState<string[]>([]);
  const [createManages, setCreateManages] = useState<string[]>([]);
  const [homeStore, setHomeStore] = useState<string | null>(null);
  const [editorTick, setEditorTick] = useState(0);
  const homeSelectRef = useRef<HTMLSelectElement>(null);
  const homePick = useRef(false);
  const homeId = selected?.homeCompanyId ?? "";
  useLayoutEffect(() => {
    const apply = () => {
      const select = homeSelectRef.current;
      if (select && select.value !== homeId) select.value = homeId;
    };
    apply();
    const frame = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(frame);
  }, [homeId, editorTick, selected?.userId]);
  const canEditSelected = Boolean(
    selected &&
      canEdit &&
      !selected.loaned &&
      (selected.homeCompanyId == null || selected.homeCompanyId === companyId),
  );
  const visible = employees.filter(
    (employee) => showDeactivated || !employee.deactivated,
  );

  function employeeHref(userId?: string, deactivated = showDeactivated) {
    const base = userId
      ? `/app/companies/${companyId}/employees/${userId}`
      : `/app/companies/${companyId}/employees`;
    return deactivated ? `${base}?deactivated=1` : base;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <section className="overflow-hidden rounded-lg border border-border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h1 className="text-lg font-semibold">Employees</h1>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showDeactivated}
                  onChange={(event) => router.push(employeeHref(selectedId, event.target.checked))}
                />
                Show deactivated
              </label>
              <HelpTip topic="employeeDeactivated" align="end" />
            </div>
            {canEdit ? (
              <Button
                type="button"
                onClick={() => {
                  setCreateHomeId(companyId);
                  setCreateJobs([]);
                  setCreateLoans([]);
                  setCreateManages([]);
                  setError(null);
                  setCreating(true);
                }}
              >
                Add employee
              </Button>
            ) : null}
          </div>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-black/3 text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Teams</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((employee) => (
              <tr
                key={employee.userId}
                className={cn(
                  "cursor-pointer border-t border-border hover:bg-teal/5",
                  employee.deactivated && "text-muted",
                )}
                onClick={() => router.push(employeeHref(employee.userId))}
              >
                <td className="px-4 py-2 font-medium">{employee.name || "—"}</td>
                <td className="px-4 py-2">{employee.email}</td>
                <td className="px-4 py-2">
                  {teams
                    .filter((t) => employee.teamIds.includes(t.id))
                    .map((t) => t.name)
                    .join(", ") || "—"}
                </td>
                <td className="px-4 py-2">{employee.roleName}</td>
                <td className="px-4 py-2">
                  {employee.deactivated ? "Deactivated" : employee.loaned ? "Loaned" : "Active"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <aside className="rounded-lg border border-border bg-white p-4">
        {creating ? (
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const homeHere = createHomeId === companyId;
              formData.set("homeCompanyId", createHomeId);
              formData.set("jobAssignments", JSON.stringify(homeHere ? createJobs : []));
              formData.set("loanCompanyIds", JSON.stringify(homeHere ? createLoans : []));
              formData.set("manageCompanyIds", JSON.stringify(homeHere ? createManages : []));
              const result = await createEmployeeAction(companyId, formData);
              if ("homeCompanyName" in result && result.homeCompanyName) {
                setError(null);
                setHomeStore(result.homeCompanyName);
                return;
              }
              if (result.error) {
                setError(result.error);
                if ("userId" in result && result.userId) {
                  setCreating(false);
                  router.push(employeeHref(result.userId));
                  router.refresh();
                }
                return;
              }
              setCreating(false);
              setError(null);
              router.push(result.moved ? employeeHref() : employeeHref(result.userId));
              router.refresh();
            }}
          >
            <h2 className="font-semibold">New employee</h2>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div>
              <Label htmlFor="phoneNumber">Phone</Label>
              <PhoneInput id="phoneNumber" name="phoneNumber" />
            </div>
            <div>
              <Label htmlFor="internalId">Internal ID</Label>
              <Input id="internalId" name="internalId" />
            </div>
            <PayRateFields primaryRate={primaryJobRate(createJobs, jobs)} />
            <div>
              <Label htmlFor="birthDate">Date of birth</Label>
              <Input id="birthDate" name="birthDate" type="date" required />
            </div>
            <div className="flex items-start gap-2 text-sm">
              <label className="flex items-start gap-2">
                <input type="checkbox" name="mealBreakWaiver" className="mt-1" />
                <span>
                  Signed a first meal-break waiver
                  <span className="mt-0.5 block text-muted">
                    Suppresses the first meal warning only when the shift is within
                    the location’s waiver limit (6 hours in California).
                  </span>
                </span>
              </label>
              <HelpTip topic="employeeWaiver" align="end" />
            </div>
            <div>
              <Label htmlFor="teamId">Team</Label>
              <Select id="teamId" name="teamId" defaultValue={teams[0]?.id ?? ""}>
                <option value="">None yet</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="createHomeCompanyId">Home store</Label>
              <Select
                id="createHomeCompanyId"
                value={createHomeId}
                onChange={(event) => setCreateHomeId(event.target.value)}
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </Select>
            </div>
            {createHomeId === companyId ? (
              <>
                <JobChecklist
                  jobs={jobs}
                  selected={createJobs}
                  onDraft={setCreateJobs}
                />
                <CompanyChecklist
                  label="Loaned to"
                  companies={companies.filter((company) => company.id !== createHomeId)}
                  selectedIds={createLoans}
                  emptyLabel="Not loaned to another company"
                  onDraft={setCreateLoans}
                />
                <CompanyChecklist
                  label="Manages"
                  companies={companies.filter((company) => company.id !== createHomeId)}
                  selectedIds={createManages}
                  emptyLabel="Does not manage another company"
                  onDraft={setCreateManages}
                />
              </>
            ) : null}
            <FieldError message={error} />
            <div className="flex gap-2">
              <Button type="submit">Save</Button>
              <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : selected ? (
          <div key={selected.userId} className="space-y-3">
            <h2 className="font-semibold">{selected.name || selected.email}</h2>
            {selected.loaned ? (
              <p className="text-sm text-muted">
                Loaned from {selected.homeCompanyName || "their home store"}. Only a manager
                at that store can edit this employee.
              </p>
            ) : null}
            {selected.deactivated ? (
              <p className="text-sm text-muted">This employee is deactivated.</p>
            ) : null}
            {canEditSelected && !selected.canEditIdentity && !selected.confirmedAndActive ? (
              <p className="text-sm text-muted">
                This person already has a Schedmaker account. Name, email, and phone stay on that account.
              </p>
            ) : null}
            <form
              id={`employee-editor-${selected.userId}`}
              className="space-y-3"
              autoComplete="off"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!canEditSelected) return;
                const formData = new FormData(event.currentTarget);
                setEditorTick((tick) => tick + 1);
                const result = await updateEmployeeAction(
                  companyId,
                  selected.userId,
                  formData,
                );
                if (result.error) setError(result.error);
                else {
                  setError(null);
                  router.refresh();
                }
                setEditorTick((tick) => tick + 1);
              }}
            >
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={selected.name}
                disabled={!canEditSelected || !selected.canEditIdentity}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                defaultValue={selected.email}
                disabled={!canEditSelected || !selected.canEditIdentity}
              />
            </div>
            <div>
              <Label htmlFor="phoneNumber">Phone</Label>
              <PhoneInput
                id="phoneNumber"
                name="phoneNumber"
                key={selected.userId}
                defaultValue={selected.phoneNumber ?? ""}
                disabled={!canEditSelected || !selected.canEditIdentity}
              />
            </div>
            <div>
              <Label htmlFor="internalId">Internal ID</Label>
              <Input id="internalId" name="internalId" defaultValue={selected.internalId} disabled={!canEditSelected} />
            </div>
            <PayRateFields
              primaryRate={primaryJobRate(selected.jobs, jobs)}
              overrideRate={selected.hourlyRate}
              disabled={!canEditSelected}
            />
            <div>
              <Label htmlFor="birthDate">Date of birth</Label>
              <Input
                id="birthDate"
                name="birthDate"
                type="date"
                defaultValue={selected.birthDate ?? ""}
                required={canEditSelected && selected.canEditBirthDate}
                disabled={!canEditSelected || !selected.canEditBirthDate}
              />
              {canEditSelected && !selected.canEditBirthDate ? (
                <p className="mt-1 text-sm text-muted">
                  Date of birth stays on their account because they belong to another company.
                </p>
              ) : null}
            </div>
            </form>
            <div>
              <span className="inline-flex items-center gap-1">
                <Label htmlFor="roleId">Role</Label>
                <HelpTip topic="employeeRole" align="end" />
              </span>
              {selected.loaned ? (
                <Input id="roleId" value="Loaned" disabled readOnly />
              ) : (
              <Select
                id="roleId"
                name="roleId"
                defaultValue={selected.roleId}
                disabled={!canEditSelected || selected.userId === currentUserId}
                onChange={async (event) => {
                  const result = await setEmployeeRoleAction(
                    companyId,
                    selected.userId,
                    event.target.value,
                  );
                  if (result.error) setError(result.error);
                  else {
                    setError(null);
                    router.refresh();
                  }
                }}
              >
                {roles
                  .filter(
                    (role) =>
                      canAssignAdministrator ||
                      role.systemKey !== ADMINISTRATOR_SYSTEM_KEY ||
                      role.id === selected.roleId,
                  )
                  .map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
              </Select>
              )}
              {selected.userId === currentUserId ? (
                <p className="mt-1 text-xs text-muted">You cannot change your own role.</p>
              ) : null}
            </div>
            <div className="flex items-start gap-2 text-sm">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  defaultChecked={selected.mealBreakWaiver}
                  disabled={!canEditSelected}
                  onChange={async (event) => {
                    if (!canEditSelected) return;
                    await setEmployeeMealWaiverAction(
                      companyId,
                      selected.userId,
                      event.target.checked,
                    );
                    router.refresh();
                  }}
                />
                <span>
                  Signed a first meal-break waiver
                  <span className="mt-0.5 block text-muted">
                    Suppresses the first meal warning only when the shift is within
                    the location’s waiver limit (6 hours in California).
                  </span>
                </span>
              </label>
              <HelpTip topic="employeeWaiver" align="end" />
            </div>
            {selected.loaned ? (
              <p className="text-sm text-muted">
                This person can be scheduled on every team at this store.
              </p>
            ) : (
            <div className="space-y-1 text-sm">
              <p className="font-medium">Teams</p>
              {teams.map((team) => (
                <label key={team.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    defaultChecked={selected.teamIds.includes(team.id)}
                    disabled={!canEditSelected}
                    onChange={async (event) => {
                      if (!canEditSelected) return;
                      await setEmployeeTeamAction(
                        companyId,
                        selected.userId,
                        team.id,
                        event.target.checked,
                      );
                      router.refresh();
                    }}
                  />
                  {team.name}
                </label>
              ))}
            </div>
            )}
            <div>
              <Label htmlFor="homeCompanyId">Home store</Label>
              <Select
                ref={homeSelectRef}
                id="homeCompanyId"
                value={selected.homeCompanyId ?? ""}
                autoComplete="off"
                disabled={!canEditSelected}
                onPointerDown={() => {
                  homePick.current = true;
                }}
                onKeyDown={() => {
                  homePick.current = true;
                }}
                onChange={async (event) => {
                  const nextHomeId = event.target.value;
                  if (!homePick.current) {
                    event.currentTarget.value = selected.homeCompanyId ?? "";
                    return;
                  }
                  homePick.current = false;
                  if (!canEditSelected || !nextHomeId || nextHomeId === selected.homeCompanyId) return;
                  const result = await setHomeCompanyAction(
                    companyId,
                    selected.userId,
                    nextHomeId,
                  );
                  if (result.error) setError(result.error);
                  else {
                    setError(null);
                    if (result.moved) router.push(employeeHref());
                    else router.refresh();
                  }
                }}
              >
                {selected.homeCompanyId ? null : <option value="">Choose a home store</option>}
                {(selected.homeCompanyId
                  ? companies
                  : companies.filter((company) =>
                      selected.memberCompanyIds.includes(company.id),
                    )
                ).map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </Select>
            </div>
            {canEdit && selected.homeCompanyId === companyId ? (
              <>
                <JobChecklist
                  jobs={jobs}
                  selected={selected.jobs
                    .filter((job) => jobs.some((option) => option.id === job.jobId))
                    .map((job) => ({ jobId: job.jobId, primary: job.primary }))}
                  onSave={async (assignments) => {
                    const result = await setEmployeeJobsAction(
                      companyId,
                      selected.userId,
                      assignments,
                    );
                    if (result.error) {
                      setError(result.error);
                      return false;
                    }
                    setError(null);
                    router.refresh();
                    return true;
                  }}
                />
                <CompanyChecklist
                  label="Loaned to"
                  companies={companies.filter((company) => company.id !== selected.homeCompanyId)}
                  selectedIds={selected.loans.map((loan) => loan.companyId)}
                  emptyLabel="Not loaned to another company"
                  onSave={async (companyIds) => {
                    const result = await setEmployeeLoansAction(
                      companyId,
                      selected.userId,
                      companyIds,
                    );
                    if (result.error) {
                      setError(result.error);
                      return false;
                    }
                    setError(null);
                    router.refresh();
                    return true;
                  }}
                />
                <CompanyChecklist
                  label="Manages"
                  companies={companies.filter((company) => company.id !== selected.homeCompanyId)}
                  selectedIds={selected.manages.map((company) => company.companyId)}
                  emptyLabel="Does not manage another company"
                  onSave={async (companyIds) => {
                    const result = await setManagedCompaniesAction(
                      companyId,
                      selected.userId,
                      companyIds,
                    );
                    if (result.error) {
                      setError(result.error);
                      return false;
                    }
                    setError(null);
                    router.refresh();
                    return true;
                  }}
                />
              </>
            ) : (
              <div className="space-y-1 text-sm">
                <p className="font-medium">Jobs</p>
                <p className="text-muted">
                  {selected.jobs.length === 0
                    ? "No jobs assigned"
                    : selected.jobs
                        .map((job) => (job.primary ? `${job.jobName} (primary)` : job.jobName))
                        .join(", ")}
                </p>
              </div>
            )}
            {canResetPasswords ? (
              <ResetPasswordPanel companyId={companyId} userId={selected.userId} />
            ) : null}
            <FieldError message={error} />
            <div className="flex flex-wrap gap-2">
              {canEditSelected ? (
                <>
                  <Button type="submit" form={`employee-editor-${selected.userId}`}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant={selected.deactivated ? "primary" : "outline"}
                    onClick={async () => {
                      const nextDeactivated = !selected.deactivated;
                      const result = await setEmployeeDeactivatedAction(
                        companyId,
                        selected.userId,
                        nextDeactivated,
                      );
                      if (result.error) setError(result.error);
                      else {
                        setError(null);
                        if (nextDeactivated && !showDeactivated) {
                          router.push(employeeHref());
                        } else {
                          router.refresh();
                        }
                      }
                    }}
                  >
                    {selected.deactivated ? "Reactivate" : "Deactivate"}
                  </Button>
                </>
              ) : null}
              <Link
                href={employeeHref()}
                className="rounded-md px-3 py-2 text-sm hover:bg-black/5"
              >
                Close
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">
            Select an employee or add someone to the directory.
          </p>
        )}
      </aside>
      {homeStore ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5">
            <p className="text-sm text-ink">
              {homeStore} is this person’s home store. A manager there has to loan them to this company.
            </p>
            <div className="mt-4 flex justify-end">
              <Button type="button" onClick={() => setHomeStore(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
