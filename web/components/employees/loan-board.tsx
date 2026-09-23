"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setEmployeeLoansFromBoardAction } from "@/lib/actions/employees";
import type { LoanBoardRow } from "@/lib/loan-board";
import { CompanyChecklist } from "@/components/employees/employee-manager";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/input";

export function LoanBoard({
  rows,
  companies,
}: {
  rows: LoanBoardRow[];
  companies: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function save(userId: string, companyIds: string[]) {
    setPendingId(userId);
    const result = await setEmployeeLoansFromBoardAction(userId, companyIds);
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return false;
    }
    setError(null);
    router.refresh();
    return true;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-ink">Employee loans</h1>
      <p className="text-sm text-muted">
        People who are currently loaned out from a store you can administer.
      </p>
      <FieldError message={error} />
      {rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-white p-6 text-muted">
          No one is currently loaned out.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/3 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Employee</th>
                <th className="px-4 py-2 font-medium">Home store</th>
                <th className="px-4 py-2 font-medium">Loaned to</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.userId} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.name || "—"}</p>
                    <p className="text-muted">{row.email}</p>
                  </td>
                  <td className="px-4 py-3">{row.homeCompanyName}</td>
                  <td className="px-4 py-3">
                    <ul className="space-y-2">
                      {row.loans.map((loan) => (
                        <li key={loan.companyId} className="flex items-center justify-between gap-3">
                          <span>{loan.companyName}</span>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={pendingId === row.userId}
                            onClick={() =>
                              save(
                                row.userId,
                                row.loans
                                  .filter((item) => item.companyId !== loan.companyId)
                                  .map((item) => item.companyId),
                              )
                            }
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 max-w-sm">
                      <CompanyChecklist
                        label="Change"
                        companies={companies.filter((company) => company.id !== row.homeCompanyId)}
                        selectedIds={row.loans.map((loan) => loan.companyId)}
                        emptyLabel="Not loaned to another company"
                        onSave={(companyIds) => save(row.userId, companyIds)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
