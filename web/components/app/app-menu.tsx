"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export function AppMenu({
  companyId,
  isAdmin,
  teams = [],
}: {
  companyId?: string;
  isAdmin?: boolean;
  teams?: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  const showWorkspace = Boolean(companyId);
  const showAdmin = Boolean(companyId && isAdmin);

  function toggle(id: string) {
    setSection((current) => (current === id ? null : id));
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="rounded p-1.5 hover:bg-white/10"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {open ? (
        <div className="absolute left-0 z-30 mt-2 w-72 rounded-lg border border-border bg-white p-2 text-ink shadow-xl">
          {showWorkspace ? (
            <>
              <Link
                href={`/app/companies/${companyId}/employees`}
                className="block rounded px-3 py-2 text-sm font-medium hover:bg-black/5"
                onClick={() => setOpen(false)}
              >
                Employees
              </Link>
              {teams.map((team) => {
                const key = `team-${team.id}`;
                return (
                  <div key={team.id} className="border-t border-border">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium hover:bg-black/5"
                      onClick={() => toggle(key)}
                    >
                      {team.name}
                      <span className="text-muted">{section === key ? "−" : "+"}</span>
                    </button>
                    {section === key ? (
                      <Link
                        href={`/app/companies/${companyId}/teams/${team.id}/scheduling`}
                        className="block px-3 pb-3 text-sm font-medium text-teal hover:underline"
                        onClick={() => setOpen(false)}
                      >
                        Scheduling
                      </Link>
                    ) : null}
                  </div>
                );
              })}
            </>
          ) : null}
          {showAdmin ? (
            <Link
              href={`/app/companies/${companyId}/settings`}
              className="block rounded border-t border-border px-3 py-2 text-sm font-medium hover:bg-black/5"
              onClick={() => setOpen(false)}
            >
              Company settings
            </Link>
          ) : null}
          <Link
            href="/account"
            className="block rounded px-3 py-2 text-sm font-medium hover:bg-black/5"
            onClick={() => setOpen(false)}
          >
            My account
          </Link>
          <Link
            href="/logout"
            className="block rounded px-3 py-2 text-sm font-medium hover:bg-black/5"
            onClick={() => setOpen(false)}
          >
            Log out
          </Link>
        </div>
      ) : null}
    </div>
  );
}
