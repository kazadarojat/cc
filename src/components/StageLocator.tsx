type Stage = "Normal" | "SCD" | "MCI" | "Dementia";

const STAGES: { id: Stage; label: string; sub: string; criteria: string }[] = [
  {
    id: "Normal",
    label: "Normal",
    sub: "Cognitively unimpaired",
    criteria: "MoCA ≥ 26 · MMSE ≥ 27 · AD8 < 2 · plasma p-tau217 < 0.20 pg/mL",
  },
  {
    id: "SCD",
    label: "SCD",
    sub: "Subjective cognitive decline",
    criteria: "AD8 ≥ 2 or memory complaint > 6 months · MoCA ≥ 26 · early biomarkers may be borderline",
  },
  {
    id: "MCI",
    label: "MCI",
    sub: "Mild cognitive impairment",
    criteria: "MoCA 18–25 · CDR 0.5 · p-tau217 often > 0.30 · mild to moderate hippocampal atrophy",
  },
  {
    id: "Dementia",
    label: "Dementia",
    sub: "Alzheimer's disease",
    criteria: "MoCA < 18 · MMSE < 24 · CDR ≥ 1.0 · amyloid PET positive · p-tau217 > 0.45",
  },
];

export function StageLocator({
  state,
  stateConfidence,
}: {
  state: Stage;
  stateConfidence: number;
  trajectory?: string;
  progressionRisk?: number | null;
}) {
  const currentIndex = STAGES.findIndex((s) => s.id === state);
  const current = STAGES[currentIndex] ?? STAGES[0];

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 py-3">
        <h2>Stage on the cognitive spectrum</h2>
        <span className="text-[11px] text-faint">
          NIA-AA framework · estimate confidence {Math.round(stateConfidence * 100)}%
        </span>
      </div>

      <ol className="grid grid-cols-2 border-t border-line sm:grid-cols-4">
        {STAGES.map((stage, idx) => {
          const active = idx === currentIndex;
          const passed = idx < currentIndex;
          return (
            <li
              key={stage.id}
              className={`border-r border-line px-4 pb-3 pt-2.5 last:border-r-0 ${
                active ? "bg-[var(--surface-2)]" : ""
              }`}
              aria-current={active ? "step" : undefined}
            >
              <span
                className={`block h-[2px] w-full ${
                  active ? "bg-[var(--ink)]" : passed ? "bg-[var(--border-strong)]" : "bg-[var(--border)]"
                }`}
              />
              <span className="mt-2 flex items-baseline gap-1.5">
                <span className="tnum text-[11px] text-faint">{idx + 1}</span>
                <span className={`text-[13px] ${active ? "font-medium text-ink" : "text-muted"}`}>
                  {stage.label}
                </span>
              </span>
              <span className="mt-0.5 block text-[11px] leading-4 text-faint">{stage.sub}</span>
            </li>
          );
        })}
      </ol>

      <div className="border-t border-line bg-[var(--surface-2)] px-4 py-2.5">
        <p className="text-[12px] leading-[18px] text-muted">
          <span className="font-medium text-ink">Criteria for {current.label}:</span> {current.criteria}
        </p>
      </div>
    </section>
  );
}
