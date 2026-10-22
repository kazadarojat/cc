"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { seg: "", label: "Overview" },
  { seg: "analytics", label: "Analytics" },
  { seg: "timeline", label: "Timeline" },
  { seg: "evidence", label: "Evidence" },
  { seg: "simulate", label: "Simulator" },
  { seg: "summary", label: "Summary" },
  { seg: "report", label: "Report" },
  { seg: "data", label: "Add data" },
  { seg: "edit", label: "Edit" },
];

export function PatientTabs({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/clinician/patients/${id}`;

  return (
    <nav className="scroll-x -mb-px flex gap-5 border-b border-line" aria-label="Patient sections">
      {TABS.map((t) => {
        const href = t.seg ? `${base}/${t.seg}` : base;
        const active = t.seg ? pathname === href || pathname.startsWith(`${href}/`) : pathname === base;
        return (
          <Link
            key={t.seg}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex-none whitespace-nowrap border-b-2 pb-2 pt-1 text-[13px] leading-5 ${
              active
                ? "border-[var(--ink)] font-medium text-ink"
                : "border-transparent text-muted hover:border-[var(--border-strong)] hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
