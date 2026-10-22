type Probs = { Normal: number; SCD: number; MCI: number; Dementia: number };

const SEG: { key: keyof Probs; label: string; color: string }[] = [
  { key: "Normal", label: "Normal", color: "var(--ok)" },
  { key: "SCD", label: "SCD", color: "var(--watch)" },
  { key: "MCI", label: "MCI", color: "#fb923c" },
  { key: "Dementia", label: "Dementia", color: "var(--alert)" },
];

export function StageProbabilityBar({ probs, current }: { probs: Probs; current: string }) {
  const total = SEG.reduce((a, s) => a + (probs[s.key] || 0), 0) || 1;
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full border border-line">
        {SEG.map((s) => {
          const pct = ((probs[s.key] || 0) / total) * 100;
          if (pct < 0.5) return null;
          return (
            <div
              key={s.key}
              style={{ width: `${pct}%`, background: s.color }}
              className={current === s.key || (current === "AD" && s.key === "Dementia") ? "" : "opacity-60"}
            />
          );
        })}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4">
        {SEG.map((s) => {
          const active = current === s.key || (current === "AD" && s.key === "Dementia");
          return (
            <li key={s.key} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                <span className={active ? "font-semibold text-ink" : "text-muted"}>{s.label}</span>
              </span>
              <span className="tnum font-mono text-xs text-ink">{probs[s.key] ?? 0}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
