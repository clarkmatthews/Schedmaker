import Link from "next/link";
import { auth } from "@/auth";
import { AppMenu, type AppMenuCompany } from "@/components/app/app-menu";
import type { MenuCapabilities } from "@/lib/roles";

export async function AppShell({
  children,
  companyId,
  companyName,
  teams,
  capabilities,
  companies,
  loanSwaps,
  narrowMenu,
}: {
  children: React.ReactNode;
  companyId?: string;
  companyName?: string;
  teams?: { id: string; name: string }[];
  capabilities?: MenuCapabilities;
  companies?: AppMenuCompany[];
  loanSwaps?: { id: string; name: string }[];
  narrowMenu?: boolean;
}) {
  const session = await auth();
  const userLabel = session?.user?.name || session?.user?.email;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-ink text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <AppMenu
              companyId={companyId}
              capabilities={capabilities}
              teams={teams}
              companies={companies}
              loanSwaps={loanSwaps}
              narrowMenu={narrowMenu}
            />
            <Link href="/app" className="text-lg font-bold text-teal">
              Schedmaker
            </Link>
            {companyName ? (
              <span className="text-sm text-white/80">{companyName}</span>
            ) : null}
          </div>
          {userLabel ? <span className="hidden text-sm text-white/80 sm:inline">{userLabel}</span> : null}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
