import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { fmtDate } from "@/lib/format";
import { Card, Eyebrow } from "@/components/ui";
import { consentRows } from "@/lib/queries";
import { BehaviourView, type BehaviourSummary } from "@/components/BehaviourView";

export default async function BehaviourPage() {
  const session = await getSession("patient");
  if (!session || session.role !== "patient") redirect("/login");
  const patientId = session.subjectId;

  const active = await consentRows(patientId);
  const granted = active.get("behavioral") === true;

  const rows = granted
    ? await db.behaviourDaily.findMany({
        where: { patientId },
        orderBy: { day: "asc" },
      })
    : [];

  let summary: BehaviourSummary | null = null;
  if (rows.length) {
    const recent = rows.slice(-7);
    const avg = (f: (r: (typeof recent)[number]) => number) =>
      recent.reduce((a, r) => a + f(r), 0) / recent.length;
    summary = {
      days: rows.length,
      routineDisruptionIndex: avg((r) => r.routineDisruptionIndex),
      activityOnsetShiftMin: avg((r) => r.activityOnsetShiftMin),
      typingSpeedCpm: avg((r) => r.typingSpeedCpm),
      typingLatencyVarianceMs: avg((r) => r.typingLatencyVarianceMs),
      screenInteractionLatencyMs: avg((r) => r.screenInteractionLatencyMs),
      lastDay: fmtDate(rows[rows.length - 1].day),
    };
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Eyebrow>Digital behaviour</Eyebrow>
        <h1 className="mt-2 font-display text-2xl font-bold">Passive activity patterns</h1>
        <p className="mt-2 text-sm text-muted">
          Optional. Cognicare can watch the <em>shape</em> of daily activity (when your day starts,
          typing rhythm, how quickly you respond to prompts), never the content of anything you write.
        </p>
      </div>

      {granted ? (
        <BehaviourView patientId={patientId} summary={summary} />
      ) : (
        <Card className="p-6">
          <p className="font-mono text-[11px] uppercase tracking-wide text-faint">Opt-in required</p>
          <p className="mt-2 text-sm text-muted">
            This modality is off. Turn on <strong>Behavioural patterns</strong> in your data &amp;
            consent settings to enable it. You can withdraw at any time; withdrawal removes this data
            from future analysis immediately.
          </p>
          <Link
            href="/patient/consent"
            className="mt-4 inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:brightness-110"
          >
            Open consent settings
          </Link>
        </Card>
      )}
    </div>
  );
}
