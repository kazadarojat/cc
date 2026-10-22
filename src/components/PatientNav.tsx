"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/patient", label: "Home" },
  { href: "/patient/assessments", label: "Assessments" },
  { href: "/patient/diary", label: "Diary" },
  { href: "/patient/behaviour", label: "Behaviour" },
  { href: "/patient/timeline", label: "Timeline" },
  { href: "/patient/consent", label: "Consent" },
];

export function PatientNav() {
  const pathname = usePathname();
  return (
    <nav className="scroll-x -mb-px flex gap-5 border-b border-line" aria-label="Patient sections">
      {NAV.map((n) => {
        const active = n.href === "/patient" ? pathname === "/patient" : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex-none whitespace-nowrap border-b-2 pb-2 pt-1 text-[13px] leading-5 ${
              active
                ? "border-[var(--ink)] font-medium text-ink"
                : "border-transparent text-muted hover:border-[var(--border-strong)] hover:text-ink"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
