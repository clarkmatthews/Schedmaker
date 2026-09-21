"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRoleAction, deleteRoleAction, updateRoleAction } from "@/lib/actions/roles";
import {
  ADMINISTRATOR_SYSTEM_KEY,
  PERMISSION_SECTIONS,
  parsePermissions,
  type AccessLevel,
  type PermissionSectionId,
  type RolePermissions,
} from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { HelpTip } from "@/components/ui/help-tip";
import { FieldError, Input, Label, Select } from "@/components/ui/input";

type RoleRow = {
  id: string;
  name: string;
  systemKey: string | null;
  permissions: unknown;
};

const LEVELS: { id: AccessLevel; label: string }[] = [
  { id: "none", label: "None" },
  { id: "view", label: "View" },
  { id: "edit", label: "Edit" },
];

const lastSaved = new Map<string, { name: string; permissions: RolePermissions }>();

export function RolesSettings({
  companyId,
  roles,
  canEdit,
}: {
  companyId: string;
  roles: RoleRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(roles[0]?.id ?? "");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = roles.find((role) => role.id === selectedId) ?? null;
  const locked = selected?.systemKey === ADMINISTRATOR_SYSTEM_KEY;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Each role controls None, View, or Edit for every section in the menu and
        settings. Administrator always has full access and cannot be deleted.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <Label htmlFor="roleSelect">Role</Label>
          <Select
            id="roleSelect"
            value={creating ? "" : selectedId}
            onChange={(event) => {
              setCreating(false);
              setSelectedId(event.target.value);
              setError(null);
            }}
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </Select>
        </div>
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setCreating(true);
              setError(null);
            }}
          >
            New role
          </Button>
        ) : null}
      </div>

      {creating ? (
        <form
          className="space-y-4"
          action={async (formData) => {
            const result = await createRoleAction(companyId, formData);
            if (result.error) setError(result.error);
            else {
              setCreating(false);
              setError(null);
              router.refresh();
            }
          }}
        >
          <div>
            <Label htmlFor="newRoleName">Name</Label>
            <Input id="newRoleName" name="name" required />
          </div>
          <PermissionGrid />
          <FieldError message={error} />
          <div className="flex gap-2">
            <Button type="submit">Create</Button>
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : selected ? (
        <RoleEditor
          key={selected.id}
          companyId={companyId}
          role={selected}
          canEdit={canEdit}
          locked={locked}
          error={error}
          onError={setError}
          onDeleted={() => {
            setSelectedId(roles.find((role) => role.id !== selected.id)?.id ?? "");
            router.refresh();
          }}
        />
      ) : (
        <p className="text-sm text-muted">No roles yet.</p>
      )}
    </div>
  );
}

function RoleEditor({
  companyId,
  role,
  canEdit,
  locked,
  error,
  onError,
  onDeleted,
}: {
  companyId: string;
  role: RoleRow;
  canEdit: boolean;
  locked: boolean;
  error: string | null;
  onError: (message: string | null) => void;
  onDeleted: () => void;
}) {
  const saved = lastSaved.get(role.id);
  const [name, setName] = useState(saved?.name ?? role.name);
  const [permissions, setPermissions] = useState(
    saved?.permissions ?? parsePermissions(role.permissions, role.systemKey),
  );

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const formData = new FormData();
        formData.set("name", name);
        for (const section of PERMISSION_SECTIONS) {
          formData.set(`perm_${section.id}`, permissions[section.id]);
        }
        const result = await updateRoleAction(companyId, role.id, formData);
        if (result.error) {
          onError(result.error);
          return;
        }
        lastSaved.set(role.id, { name, permissions: { ...permissions } });
        onError(null);
      }}
    >
      <div>
        <Label htmlFor="roleName">Name</Label>
        <Input
          id="roleName"
          name="name"
          value={name}
          required
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      {locked ? (
        <p className="flex items-start gap-1 text-sm text-muted">
          <span>Administrator permissions are locked to Edit on every section.</span>
          <HelpTip topic="administratorLock" />
        </p>
      ) : null}
      <PermissionGrid
        values={permissions}
        locked={locked}
        onChange={(section, level) =>
          setPermissions((current) => ({ ...current, [section]: level }))
        }
      />
      <FieldError message={error} />
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Save</Button>
          {locked ? null : (
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                const result = await deleteRoleAction(companyId, role.id);
                if (result.error) onError(result.error);
                else {
                  lastSaved.delete(role.id);
                  onError(null);
                  onDeleted();
                }
              }}
            >
              Delete
            </Button>
          )}
        </div>
      ) : null}
    </form>
  );
}

function PermissionGrid({
  values,
  locked,
  onChange,
}: {
  values?: ReturnType<typeof parsePermissions>;
  locked?: boolean;
  onChange?: (section: PermissionSectionId, level: AccessLevel) => void;
}) {
  return (
    <div className="overflow-auto rounded-md border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-black/3 text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">
              <span className="inline-flex items-center gap-1">
                Section
                <HelpTip topic="permissionLevels" />
              </span>
            </th>
            {LEVELS.map((level) => (
              <th key={level.id} className="px-3 py-2 font-medium">
                {level.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSION_SECTIONS.map((section) => {
            const current = values?.[section.id] ?? "none";
            return (
              <tr key={section.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{section.label}</td>
                {LEVELS.map((level) => (
                  <td key={level.id} className="px-3 py-2">
                    <input
                      type="radio"
                      name={`perm_${section.id}`}
                      value={level.id}
                      disabled={locked}
                      {...(onChange
                        ? {
                            checked: current === level.id,
                            onChange: () => onChange(section.id, level.id),
                          }
                        : { defaultChecked: current === level.id })}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
