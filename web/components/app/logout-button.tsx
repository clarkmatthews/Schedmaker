"use client";

import { logoutAction } from "@/lib/actions/auth";

export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logoutAction}>
      <button type="submit" className={className}>
        Log out
      </button>
    </form>
  );
}
