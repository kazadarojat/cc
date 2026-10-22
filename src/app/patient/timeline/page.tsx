import { getSession } from "@/lib/session";
import { fmtDate } from "@/lib/format";
import { Dot, Eyebrow } from "@/components/ui";
import { buildTimeline } from "@/lib/queries";

// patient-facing timeline: hide raw biomarker values and internal analysis detail
const PATIENT_KINDS: Record<string, string> = {
  enrolment: "Started monitoring",
  speech: "Speaking check-in",
  sleep: "Sleep tracked",
  cognitive_task: "Thinking tasks",
  questionnaire: "Questionnaire",
  diary: "Diary entries",
  clinical: "Clinic visit",
  imaging: "Scan on record",
  biomarker: "Blood test on record",
  change: "Change noticed",
  inference: "Analysis updated",
};

export default async function PatientTimeline() {
  const session = await getSession("patient");
  const events = (await buildTimeline(session!.subjectId))
    .filter((e) => PATIENT_KINDS[e.kind] && e.kind !== "discordance")
    .reverse();

  return (
    <div>
      <Eyebrow>My timeline</Eyebrow>
      <h1 className="mt-2 font-display text-2xl font-bold">Your check-ins over time</h1>
      <p className="mt-2 text-sm text-muted">
        A simple history of what you and your care team have added. The full clinical detail is on
        your clinician&apos;s dashboard.
      </p>

      <ol className="mt-6 border-l border-[var(--border-strong)]">
        {events.map((e, i) => (
          <li key={i} className="relative pb-5 pl-6">
            <span className="absolute -left-[6px] top-[7px] rounded-full ring-4 ring-[var(--paper)]">
              <Dot
                size={10}
                tone={
                  e.kind === "change"
                    ? "watch"
                    : e.kind === "clinical" || e.kind === "inference"
                      ? "accent"
                      : "neutral"
                }
              />
            </span>
            <span className="tnum font-mono text-[11px] uppercase tracking-wide text-faint">
              {fmtDate(e.at)}
            </span>
            <p className="text-sm font-medium">{PATIENT_KINDS[e.kind]}</p>
            {e.kind === "diary" || e.kind === "change" || e.kind === "clinical" ? (
              <p className="text-sm text-muted">{e.detail}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
