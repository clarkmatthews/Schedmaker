"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createEmployeeAction,
  setEmployeeDeactivatedAction,
  setEmployeeMealWaiverAction,
  setEmployeeRoleAction,
  setEmployeeTeamAction,
  updateEmployeeAction,
} from "@/lib/actions/employees";
import type { EmployeeRecord, EmployeeRoleOption } from "@/lib/employees";
import { ADMINISTRATOR_SYSTEM_KEY } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/input";

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
}) {
  const router = useRouter();
  const selectedEmployee = employees.find((e) => e.userId === selectedId) ?? null;
  const selected =
    selectedEmployee && (showDeactivated || !selectedEmployee.deactivated)
      ? selectedEmployee
      : null;
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
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
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="overflow-hidden rounded-lg border border-border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h1 className="text-lg font-semibold">Employees</h1>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showDeactivated}
                onChange={(event) => router.push(employeeHref(selectedId, event.target.checked))}
              />
              Show deactivated
            </label>
            {canEdit ? (
              <Button type="button" onClick={() => setCreating(true)}>
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
                  {employee.deactivated ? "Deactivated" : "Active"}
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
            action={async (formData) => {
              const result = await createEmployeeAction(companyId, formData);
              if (result.error) setError(result.error);
              else {
                setCreating(false);
                setError(null);
                router.refresh();
              }
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
              <Input id="phoneNumber" name="phoneNumber" />
            </div>
            <div>
              <Label htmlFor="internalId">Internal ID</Label>
              <Input id="internalId" name="internalId" />
            </div>
            <div>
              <Label htmlFor="hourlyRate">Hourly rate</Label>
              <Input
                id="hourlyRate"
                name="hourlyRate"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="birthDate">Date of birth</Label>
              <Input id="birthDate" name="birthDate" type="date" />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="mealBreakWaiver" className="mt-1" />
              <span>
                Signed a first meal-break waiver
                <span className="mt-0.5 block text-muted">
                  Suppresses the first meal warning only when the shift is within
                  the location’s waiver limit (6 hours in California).
                </span>
              </span>
            </label>
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
            <FieldError message={error} />
            <div className="flex gap-2">
              <Button type="submit">Save</Button>
              <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : selected ? (
          <form
            key={selected.userId}
            className="space-y-3"
            action={async (formData) => {
              if (!canEdit) return;
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
            }}
          >
            <h2 className="font-semibold">{selected.name || selected.email}</h2>
            {selected.deactivated ? (
              <p className="text-sm text-muted">This employee is deactivated.</p>
            ) : null}
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={selected.name}
                disabled={selected.confirmedAndActive}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                defaultValue={selected.email}
                disabled={selected.confirmedAndActive}
              />
            </div>
            <div>
              <Label htmlFor="phoneNumber">Phone</Label>
              <Input
                id="phoneNumber"
                name="phoneNumber"
                defaultValue={selected.phoneNumber ?? ""}
                disabled={selected.confirmedAndActive}
              />
            </div>
            <div>
              <Label htmlFor="internalId">Internal ID</Label>
              <Input id="internalId" name="internalId" defaultValue={selected.internalId} disabled={!canEdit} />
            </div>
            <div>
              <Label htmlFor="hourlyRate">Hourly rate</Label>
              <Input
                id="hourlyRate"
                name="hourlyRate"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                defaultValue={selected.hourlyRate ?? ""}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="birthDate">Date of birth</Label>
              <Input
                id="birthDate"
                name="birthDate"
                type="date"
                defaultValue={selected.birthDate ?? ""}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="roleId">Role</Label>
              <Select
                id="roleId"
                name="roleId"
                defaultValue={selected.roleId}
                disabled={!canEdit || selected.userId === currentUserId}
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
              {selected.userId === currentUserId ? (
                <p className="mt-1 text-xs text-muted">You cannot change your own role.</p>
              ) : null}
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                defaultChecked={selected.mealBreakWaiver}
                disabled={!canEdit}
                onChange={async (event) => {
                  if (!canEdit) return;
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
            <div className="space-y-1 text-sm">
              <p className="font-medium">Teams</p>
              {teams.map((team) => (
                <label key={team.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    defaultChecked={selected.teamIds.includes(team.id)}
                    disabled={!canEdit}
                    onChange={async (event) => {
                      if (!canEdit) return;
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
            <FieldError message={error} />
            <div className="flex flex-wrap gap-2">
              {canEdit ? (
                <>
                  <Button type="submit">Save</Button>
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
          </form>
        ) : (
          <p className="text-sm text-muted">
            Select an employee or add someone to the directory.
          </p>
        )}
      </aside>
    </div>
  );
}
