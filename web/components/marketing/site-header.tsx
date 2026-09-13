import Link from "next/link";
import { auth } from "@/auth";

export async function AuthHeader() {
  const session = await auth();
  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-bold text-teal">
          ESP Scheduler
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium">
          {session?.user ? (
            <>
              <Link href="/app" className="hover:text-teal">
                App
              </Link>
              <Link href="/logout" className="hover:text-teal">
                Log out
              </Link>
            </>
          ) : (
            <Link
              href="/signup"
              className="rounded-md bg-teal px-3 py-1.5 text-white hover:bg-teal-dark"
            >
              Sign up
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
