import Link from "next/link";
import { db } from "@/lib/db";
import { ThemeToggle } from "@/components/ThemeToggle";

const IS_STATIC = process.env.NEXT_PUBLIC_STATIC_EXPORT === "1";

const ROLES = [
  {
    role: "clinician",
    href: "/clinician",
    title: "Clinician workspace",
    body: "Cohort overview, risk triage, inference review.",
  },
  {
    role: "patient",
    href: "/patient",
    title: "Patient portal",
    body: "Check-ins, diary, and personal results.",
  },
] as const;

const FIELD =
  "mt-1 block w-full rounded-[5px] border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-[var(--accent)]";
const LABEL = "block text-[11px] font-medium uppercase tracking-[0.06em] text-faint";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const error = IS_STATIC ? undefined : (await searchParams)?.error;
  const [clinicianCount, patientCount] = await Promise.all([
    db.clinician.count(),
    db.patient.count(),
  ]);

  const firstRun = clinicianCount === 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-ink">CogniCare</h1>
          <p className="mt-1 text-[12px] leading-[18px] text-muted">
            {firstRun
              ? "First run — create the clinician profile for this workspace."
              : IS_STATIC
                ? "Demo build — pick a workspace to enter."
                : "Choose a workspace to enter."}
          </p>
        </div>
        <ThemeToggle />
      </div>

      {firstRun && !IS_STATIC ? (
        <form action="/api/auth/login" method="post" className="mt-7 space-y-3 border-t border-line pt-5">
          <input type="hidden" name="role" value="clinician" />
          <input type="hidden" name="bootstrap" value="1" />
          <div>
            <label className={LABEL} htmlFor="name">
              Name
            </label>
            <input id="name" name="name" required autoComplete="name" className={FIELD} />
          </div>
          <div>
            <label className={LABEL} htmlFor="email">
              Email <span className="normal-case tracking-normal text-faint">(optional)</span>
            </label>
            <input id="email" name="email" type="email" autoComplete="email" className={FIELD} />
          </div>
          <div>
            <label className={LABEL} htmlFor="institution">
              Institution <span className="normal-case tracking-normal text-faint">(optional)</span>
            </label>
            <input id="institution" name="institution" className={FIELD} />
          </div>
          <button
            type="submit"
            className="w-full rounded-[5px] bg-[var(--primary)] px-3 py-2 text-[12px] font-medium text-[var(--primary-ink)]"
          >
            Create profile and enter
          </button>
          <p className="text-[11px] leading-4 text-faint">
            No demo records are loaded. You add your own patients afterwards.
          </p>
        </form>
      ) : (
        <>
          <div className="mt-7 border-t border-line">
            {ROLES.map((entry) => {
              const disabled = entry.role === "patient" && patientCount === 0;
              const inner = (
                <>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-ink">{entry.title}</span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-faint">
                      {disabled ? "No patient records yet — add one from the clinician workspace." : entry.body}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="flex-none text-[13px] text-faint group-hover:text-[var(--accent)]"
                  >
                    →
                  </span>
                </>
              );

              return IS_STATIC ? (
                <div key={entry.role} className="border-b border-line">
                  <Link
                    href={entry.href}
                    aria-disabled={disabled}
                    className={`group flex w-full items-center justify-between gap-4 py-3.5 text-left ${
                      disabled ? "pointer-events-none opacity-55" : ""
                    }`}
                  >
                    {inner}
                  </Link>
                </div>
              ) : (
                <form
                  key={entry.role}
                  action="/api/auth/login"
                  method="post"
                  className="border-b border-line"
                >
                  <input type="hidden" name="role" value={entry.role} />
                  <button
                    type="submit"
                    disabled={disabled}
                    className="group flex w-full items-center justify-between gap-4 py-3.5 text-left disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {inner}
                  </button>
                </form>
              );
            })}
          </div>
          <p className="mt-4 text-[11px] leading-4 text-faint">
            {patientCount === 0
              ? "Workspace is empty. Nothing is seeded or pre-filled."
              : `${patientCount} record${patientCount === 1 ? "" : "s"} in this workspace.`}
          </p>
        </>
      )}

      {error === "empty" ? (
        <p className="mt-4 text-[11px] leading-4 text-[var(--alert)]">
          No records are loaded in this build yet.
        </p>
      ) : null}

      <p className="mt-6 text-[11px] leading-4 text-faint">
        Prototype only. Not a medical device. Not for clinical use.
      </p>
    </main>
  );
}
