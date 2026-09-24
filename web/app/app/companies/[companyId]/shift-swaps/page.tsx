import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ActionError } from "@/lib/permissions";
import { loadShiftSwapBoard } from "@/lib/shift-swap";
import { ShiftSwapBoard } from "@/components/shift-swap/shift-swap-board";

export default async function ShiftSwapsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const { companyId } = await params;

  try {
    const board = await loadShiftSwapBoard(session.user.id, companyId);
    return <ShiftSwapBoard companyId={companyId} {...board} />;
  } catch (error) {
    if (error instanceof ActionError && error.message === "Shift swapping is not enabled.") {
      notFound();
    }
    if (error instanceof ActionError && error.message === "Company not found.") notFound();
    redirect("/app");
  }
}
