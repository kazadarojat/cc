"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { simulateBehaviourWeek } from "@/lib/actions";

export type BehaviourSummary = {
  days: number;
  routineDisruptionIndex: number;
  activityOnsetShiftMin: number;
  typingSpeedCpm: number;
  typingLatencyVarianceMs: number;
  screenInteractionLatencyMs: number;
  lastDay: string | null;
};

export function BehaviourView({
  patientId,
  summary,
}: {
  patientId: string;
  summary: BehaviourSummary | null;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function simulate() {
    startTransition(async () => {
      await simulateBehaviourWeek(patientId);
      router.refresh();
    });
  }

  const tiles = summary
    ? [
        {
          label: "Routine disruption",
          value: Math.round(summary.routineDisruptionIndex).toString(),
          unit: "/ 100",
          alert: summary.routineDisruptionIndex > 40,
        },
        {
          label: "Activity onset shift",
          value: `+${Math.round(summary.activityOnsetShiftMin)}`,
          unit: "min later",
          alert: summary.activityOnsetShiftMin > 45,
        },
        {
          label: "Typing speed",
          value: Math.round(summary.typingSpeedCpm).toString(),
          unit: "cpm",
          alert: summary.typingSpeedCpm < 110,
        },
        {
          label: "Interaction latency",
          value: Math.round(summary.screenInteractionLatencyMs).toString(),
          unit: "ms",
          alert: summary.screenInteractionLatencyMs > 900,
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-5">
      {summary ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-xl border border-line bg-surface p-3.5">
                <p className="font-mono text-[10px] uppercase tracking-wide text-faint">{t.label}</p>
                <p
                  className={`tnum mt-1 font-display text-xl font-semibold ${
                    t.alert ? "text-[var(--watch)]" : "text-ink"
                  }`}
                >
                  {t.value}
                  <span className="ml-1 text-xs font-normal text-faint">{t.unit}</span>
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-faint">
            {summary.days} day{summary.days === 1 ? "" : "s"} of passive data on file
            {summary.lastDay ? `, last ${summary.lastDay}` : ""}. Averaged over the most recent week.
            Patterns only; no message content is stored.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted">
          No passive data yet. Generate a sample week to see how routine, typing and interaction
          patterns feed the analysis.
        </p>
      )}

      <button
        type="button"
        onClick={simulate}
        disabled={pending}
        className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Generating…" : "Simulate a week of passive data"}
      </button>
      <p className="font-mono text-[11px] leading-relaxed text-faint">
        Simulated. This prototype does not access your device sensors; it generates plausible
        pattern values around your recent profile so the modality can be demonstrated end to end.
      </p>
    </div>
  );
}
