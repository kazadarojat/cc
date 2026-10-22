import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export function TopBar({
  role,
  name,
  home,
}: {
  role: "clinician" | "patient";
  name: string;
  home: string;
}) {
  const scope = role === "clinician" ? "Memory clinic" : "Patient portal";
  return (
    <header className="border-b border-line bg-[var(--paper)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={home} className="flex items-center gap-2.5">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-[5px] border border-[var(--border-strong)] text-ink"
              aria-hidden
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path
                  d="M1.2 9.6 4.4 6.4 7.2 8.1 11.8 2.6"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="11.8" cy="2.6" r="1.3" fill="currentColor" />
              </svg>
            </span>
            <span className="text-[15px] font-semibold tracking-[-0.01em]">CogniCare</span>
          </Link>
          <span className="hidden h-3.5 w-px bg-[var(--border-strong)] sm:block" aria-hidden />
          <span className="hidden truncate text-[12px] text-muted sm:block">{scope}</span>
        </div>

        <div className="flex flex-none items-center gap-3 text-[12px]">
          <ThemeToggle />
          <span className="hidden h-3.5 w-px bg-[var(--border-strong)] md:block" aria-hidden />
          <span className="hidden truncate text-muted md:inline">{name}</span>
          <span className="hidden h-3.5 w-px bg-[var(--border-strong)] md:block" aria-hidden />
          {process.env.NEXT_PUBLIC_STATIC_EXPORT === "1" ? (
            <Link
              href="/login"
              className="text-[12px] text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Sign out
            </Link>
          ) : (
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="text-[12px] text-muted underline-offset-4 hover:text-ink hover:underline">
                Sign out
              </button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
