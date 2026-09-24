"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { LogoutButton } from "@/components/app/logout-button";
import type { MenuCapabilities } from "@/lib/roles";

export type AppMenuCompany = {
  id: string;
  name: string;
  capabilities: MenuCapabilities;
  teams: { id: string; name: string }[];
};

function linkClass(extra = "") {
  return `block rounded px-3 py-2 text-sm font-medium hover:bg-black/5 ${extra}`.trim();
}

function CompanyNav({
  company,
  nested,
  openSection,
  toggle,
  onNavigate,
}: {
  company: AppMenuCompany;
  nested?: boolean;
  openSection: string | null;
  toggle: (id: string) => void;
  onNavigate: () => void;
}) {
  const pad = nested ? "pl-5" : "";
  return (
    <>
      {company.capabilities.employees ? (
        <Link
          href={`/app/companies/${company.id}/employees`}
          className={linkClass(pad)}
          onClick={onNavigate}
        >
          Employees
        </Link>
      ) : null}
      {company.capabilities.schedule
        ? company.teams.map((team) => {
            const key = `${company.id}-${team.id}`;
            return (
              <div key={team.id} className="border-t border-border">
                <button
                  type="button"
                  className={`flex w-full items-center justify-between py-2 text-left text-sm font-medium hover:bg-black/5 ${nested ? "px-5" : "px-3"}`}
                  onClick={() => toggle(key)}
                >
                  {team.name}
                  <span className="text-muted">{openSection === key ? "−" : "+"}</span>
                </button>
                {openSection === key ? (
                  <Link
                    href={`/app/companies/${company.id}/teams/${team.id}/scheduling`}
                    className={`block pb-3 text-sm font-medium text-teal hover:underline ${nested ? "px-5" : "px-3"}`}
                    onClick={onNavigate}
                  >
                    Scheduling
                  </Link>
                ) : null}
              </div>
            );
          })
        : null}
      {company.capabilities.settings ? (
        <Link
          href={`/app/companies/${company.id}/settings`}
          className={`${linkClass(pad)} border-t border-border`}
          onClick={onNavigate}
        >
          Company settings
        </Link>
      ) : null}
      {company.capabilities.loans ? (
        <Link
          href={`/app/companies/${company.id}/loans`}
          className={linkClass(pad)}
          onClick={onNavigate}
        >
          Employee loans
        </Link>
      ) : null}
      {company.capabilities.shiftSwap ? (
        <Link
          href={`/app/companies/${company.id}/shift-swaps`}
          className={linkClass(pad)}
          onClick={onNavigate}
        >
          Shift Swap
        </Link>
      ) : null}
    </>
  );
}

export function AppMenu({
  companyId,
  capabilities,
  teams = [],
  companies = [],
  loanSwaps = [],
  narrowMenu = false,
}: {
  companyId?: string;
  capabilities?: MenuCapabilities;
  teams?: { id: string; name: string }[];
  companies?: AppMenuCompany[];
  loanSwaps?: { id: string; name: string }[];
  narrowMenu?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  const currentCompany = companyId
    ? {
        id: companyId,
        name: "",
        capabilities: capabilities ?? {
          employees: false,
          schedule: false,
          settings: false,
          loans: false,
          switchCompany: false,
          shiftSwap: false,
          availability: false,
        },
        teams,
      }
    : null;
  const offCompany = !currentCompany && companies.length > 0;
  const showAvailability = currentCompany
    ? currentCompany.capabilities.availability
    : companies.some((company) => company.capabilities.availability);
  const canSwitchCompany = Boolean(
    capabilities?.switchCompany || companies.some((company) => company.capabilities.switchCompany),
  );

  function toggle(id: string) {
    setSection((current) => (current === id ? null : id));
  }

  function close() {
    setOpen(false);
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
          {currentCompany ? (
            <>
              <CompanyNav
                company={currentCompany}
                openSection={section}
                toggle={toggle}
                onNavigate={close}
              />
              {loanSwaps.map((loan) => (
                <Link
                  key={loan.id}
                  href={`/app/companies/${loan.id}/shift-swaps`}
                  className={linkClass()}
                  onClick={close}
                >
                  Shift Swap · {loan.name}
                </Link>
              ))}
            </>
          ) : null}
          {offCompany ? (
            <>
              <Link href="/app" className={linkClass()} onClick={close}>
                Companies
              </Link>
              {companies.length === 1 ? (
                <div className="border-t border-border">
                  <CompanyNav
                    company={companies[0]!}
                    openSection={section}
                    toggle={toggle}
                    onNavigate={close}
                  />
                </div>
              ) : (
                companies.map((company) => {
                  const key = `company-${company.id}`;
                  return (
                    <div key={company.id} className="border-t border-border">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium hover:bg-black/5"
                        onClick={() => toggle(key)}
                      >
                        {company.name}
                        <span className="text-muted">{section === key ? "−" : "+"}</span>
                      </button>
                      {section === key ? (
                        <CompanyNav
                          company={company}
                          nested
                          openSection={section}
                          toggle={toggle}
                          onNavigate={close}
                        />
                      ) : null}
                    </div>
                  );
                })
              )}
            </>
          ) : null}
          {narrowMenu || !showAvailability ? null : (
            <Link
              href={
                currentCompany
                  ? `/app/companies/${currentCompany.id}/availability`
                  : "/app/availability"
              }
              className={linkClass(currentCompany || companies.length > 0 ? "border-t border-border" : "")}
              onClick={close}
            >
              Availability
            </Link>
          )}
          <Link href="/account" className={linkClass()} onClick={close}>
            My account
          </Link>
          <LogoutButton className={`${linkClass()} w-full text-left`} />
          {canSwitchCompany ? (
            <Link href="/app" className={`${linkClass()} border-t border-border`} onClick={close}>
              Switch Company
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
