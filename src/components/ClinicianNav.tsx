"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/clinician", label: "Cohort", exact: true },
  { href: "/clinician/patients/new", label: "New patient" },
  { href: "/clinician/clinicians", label: "Clinicians" },
  { href: "/clinician/research", label: "Research" },
  { href: "/clinician/admin", label: "Data" },
];

export function ClinicianNav() {
  const pathname = usePathname();
  return (
    <nav className="scroll-x -mb-px flex gap-6 border-b border-line" aria-label="Clinic sections">
      {NAV.map((n) => {
        const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
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
