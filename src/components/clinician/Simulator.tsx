"use client";

import { useState, useTransition } from "react";
import { Sliders, RotateCcw } from "lucide-react";
import { simulateScenario, type ScenarioResult } from "@/lib/admin-actions";
import { STATE_TONE } from "@/lib/format";

const DIALS = [
  { key: "mocaDelta", label: "MoCA points", min: -10, max: 6, step: 1, base: 0, unit: "pts" },
  { key: "ptau217Mult", label: "Plasma p-tau217", min: 0.6, max: 2.2, step: 0.05, base: 1, unit: "×" },
  { key: "pauseDurationMult", label: "Speech pause duration", min: 0.7, max: 2.5, step: 0.05, base: 1, unit: "×" },
  { key: "sleepFragMult", label: "Sleep fragmentation", min: 0.6, max: 2.5, step: 0.05, base: 1, unit: "×" },
  { key: "ad8Delta", label: "AD8 points", min: -3, max: 5, step: 1, base: 0, unit: "pts" },
] as const;

const toneCls: Record<string, string> = {
  ok: "text-[var(--ok)]",
  watch: "text-[var(--watch)]",
  alert: "text-[var(--alert)]",
  uncertain: "text-muted",
};

export function Simulator({
  patientId,
  baseline,
}: {
  patientId: string;
  baseline: ScenarioResult;
}) {
  const [vals, setVals] = useState<Record<string, number>>(
    Object.fromEntries(DIALS.map((d) => [d.key, d.base])),
  );
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    const ov: Record<string, number> = {};
    for (const d of DIALS) if (vals[d.key] !== d.base) ov[d.key] = vals[d.key];
    startTransition(async () => {
      setResult(await simulateScenario(patientId, ov));
    });
  }
  function reset() {
    setVals(Object.fromEntries(DIALS.map((d) => [d.key, d.base])));
    setResult(null);
  }

  const shown = result ?? baseline;
  const riskDelta =
    result && baseline.progressionRisk != null && result.progressionRisk != null
      ? Math.round((result.progressionRisk - baseline.progressionRisk) * 100)
      : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-accent-ink">
            <Sliders className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-wider">Progression what-if</h3>
            <p className="text-xs text-muted">
              Adjust the latest value of a key input and re-run the engine. Nothing is saved.
            </p>
          </div>
        </div>
        {DIALS.map((d) => (
          <label key={d.key} className="block">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted">
              <span>{d.label}</span>
              <span className="tnum font-mono text-accent-ink">
                {vals[d.key] === d.base ? "baseline" : `${vals[d.key] > 0 && d.unit === "pts" ? "+" : ""}${vals[d.key]}${d.unit}`}
              </span>
            </div>
            <input
              type="range"
              min={d.min}
              max={d.max}
              step={d.step}
              value={vals[d.key]}
              onChange={(e) => setVals((v) => ({ ...v, [d.key]: Number(e.target.value) }))}
              className="mt-1 w-full accent-[var(--accent)]"
            />
          </label>
        ))}
        <div className="flex gap-2">
          <button
            onClick={run}
            disabled={pending}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-60"
          >
            {pending ? "Running…" : "Run scenario"}
          </button>
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-bold text-muted hover:bg-[var(--surface-2)]"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
        <h3 className="text-sm font-extrabold uppercase tracking-wider">
          {result ? "Scenario outcome" : "Current (baseline)"}
        </h3>
        <Row label="Cognitive state">
          <span className={`font-extrabold ${toneCls[STATE_TONE[shown.state] ?? "uncertain"]}`}>{shown.state}</span>
          {result && result.state !== baseline.state ? (
            <span className="ml-2 font-mono text-[11px] text-faint">was {baseline.state}</span>
          ) : null}
        </Row>
        <Row label="State confidence">
          <span className="tnum">{Math.round(shown.stateConfidence * 100)}%</span>
        </Row>
        <Row label="Trajectory">
          <span className="font-bold">{shown.trajectory}</span>
        </Row>
        <Row label="Composite index">
          <span className="tnum">{shown.compositeIndex.toFixed(2)}</span>
        </Row>
        <Row label="12-mo progression risk">
          <span className="tnum font-extrabold">
            {shown.progressionRisk != null ? `${Math.round(shown.progressionRisk * 100)}%` : "not estimated"}
          </span>
          {riskDelta != null && riskDelta !== 0 ? (
            <span
              className={`ml-2 tnum font-mono text-xs font-bold ${riskDelta > 0 ? "text-[var(--alert)]" : "text-[var(--ok)]"}`}
            >
              {riskDelta > 0 ? "▲" : "▼"} {Math.abs(riskDelta)} pts
            </span>
          ) : null}
        </Row>
        <Row label="24-mo projection">
          <span className="tnum">
            {shown.progressionRisk24m != null ? `${Math.round(shown.progressionRisk24m * 100)}%` : "n/a"}
          </span>
        </Row>
        <Row label="Biological AD risk">
          <span className="font-bold">{shown.biologicalAdRiskBand}</span>
        </Row>
        <p className="pt-2 font-mono text-[11px] text-faint">
          Illustrative only — a single-variable perturbation of the latest record, not a validated
          forecast.
        </p>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between border-b border-line py-2 text-sm last:border-0">
      <span className="font-mono text-[11px] uppercase tracking-wide text-faint">{label}</span>
      <span className="text-ink">{children}</span>
    </div>
  );
}
