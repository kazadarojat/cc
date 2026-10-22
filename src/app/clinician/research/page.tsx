import { db } from "@/lib/db";
import { Card, Disclaimer, Eyebrow, SectionHeading } from "@/components/ui";

type Row = { score: number; label: 1 | 0; sex: string; risk: number | null };

function auroc(rows: Row[]): number {
  const pos = rows.filter((r) => r.label === 1);
  const neg = rows.filter((r) => r.label === 0);
  if (!pos.length || !neg.length) return 0.5;
  let wins = 0;
  for (const p of pos) for (const n of neg) wins += p.score > n.score ? 1 : p.score === n.score ? 0.5 : 0;
  return wins / (pos.length * neg.length);
}

function rocPoints(rows: Row[]): { x: number; y: number }[] {
  const P = rows.filter((r) => r.label === 1).length || 1;
  const N = rows.filter((r) => r.label === 0).length || 1;
  const thresholds = [...new Set(rows.map((r) => r.score))].sort((a, b) => b - a);
  const pts = [{ x: 0, y: 0 }];
  for (const t of thresholds) {
    const tp = rows.filter((r) => r.score >= t && r.label === 1).length;
    const fp = rows.filter((r) => r.score >= t && r.label === 0).length;
    pts.push({ x: fp / N, y: tp / P });
  }
  pts.push({ x: 1, y: 1 });
  return pts;
}

export default async function ResearchPage() {
  const patients = await db.patient.findMany({
    include: { inferences: { orderBy: { producedAt: "desc" }, take: 1 } },
  });
  // one row per historical analysis: does the composite predict "objective impairment" (state != Normal)?
  const infs = await db.inference.findMany({
    select: { compositeIndex: true, state: true, progressionRisk: true, patient: { select: { sex: true } } },
  });
  const rows: Row[] = infs.map((i) => ({
    score: i.compositeIndex,
    label: i.state === "Normal" ? 0 : 1,
    sex: i.patient.sex,
    risk: i.progressionRisk,
  }));

  const THRESH = 0.4;
  const tp = rows.filter((r) => r.score >= THRESH && r.label === 1).length;
  const fp = rows.filter((r) => r.score >= THRESH && r.label === 0).length;
  const tn = rows.filter((r) => r.score < THRESH && r.label === 0).length;
  const fn = rows.filter((r) => r.score < THRESH && r.label === 1).length;
  const sens = tp + fn ? tp / (tp + fn) : 0;
  const spec = tn + fp ? tn / (tn + fp) : 0;
  const ppv = tp + fp ? tp / (tp + fp) : 0;
  const f1 = 2 * ppv * sens ? (2 * ppv * sens) / (ppv + sens) : 0;
  const area = auroc(rows);
  const roc = rocPoints(rows);

  // calibration: bin predicted risk vs observed impairment rate
  const withRisk = rows.filter((r) => r.risk != null) as (Row & { risk: number })[];
  const bins = [0.15, 0.3, 0.45, 0.6, 1].map((hi, idx, arr) => {
    const lo = idx === 0 ? 0 : arr[idx - 1];
    const b = withRisk.filter((r) => r.risk >= lo && r.risk < hi);
    return {
      label: `${Math.round(lo * 100)}–${Math.round(hi * 100)}%`,
      n: b.length,
      predicted: b.length ? b.reduce((a, r) => a + r.risk, 0) / b.length : 0,
      observed: b.length ? b.filter((r) => r.label === 1).length / b.length : 0,
    };
  });

  const bySex = ["F", "M"].map((s) => {
    const sub = rows.filter((r) => r.sex === s);
    return { sex: s, n: sub.length, auroc: auroc(sub) };
  });

  const W = 260;
  const path = roc.map((p, i) => `${i === 0 ? "M" : "L"}${(p.x * W).toFixed(1)},${((1 - p.y) * W).toFixed(1)}`).join(" ");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>Research mode</Eyebrow>
        <h1 className="mt-2 text-2xl font-black">Cohort model evaluation</h1>
        <p className="mt-2 max-w-[72ch] text-sm text-muted">
          De-identified aggregate over {patients.length} patients / {rows.length} analyses. Task:
          does the multimodal composite index separate objective impairment (state ≠ Normal) from
          normal cognition? Illustrative on seeded synthetic data, not a validation study.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="AUROC" value={area.toFixed(3)} />
        <Metric label={`Sensitivity @ ${THRESH}`} value={`${Math.round(sens * 100)}%`} />
        <Metric label={`Specificity @ ${THRESH}`} value={`${Math.round(spec * 100)}%`} />
        <Metric label="F1 score" value={f1.toFixed(2)} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeading sub="True-positive rate vs false-positive rate across all thresholds.">
            ROC curve
          </SectionHeading>
          <svg viewBox={`-6 -6 ${W + 12} ${W + 12}`} className="w-full" style={{ maxHeight: 280 }} role="img" aria-label="ROC curve">
            <rect x={0} y={0} width={W} height={W} fill="none" stroke="var(--border)" />
            <line x1={0} y1={W} x2={W} y2={0} stroke="var(--border-strong)" strokeDasharray="3 3" />
            <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" />
            <text x={4} y={W - 4} fontSize="9" fill="var(--faint)">FPR 0</text>
            <text x={W - 4} y={W - 4} textAnchor="end" fontSize="9" fill="var(--faint)">FPR 1</text>
            <text x={4} y={12} fontSize="9" fill="var(--faint)">TPR 1</text>
          </svg>
        </Card>

        <Card className="p-5">
          <SectionHeading sub="Predicted 12-mo risk vs observed impairment rate per risk bin.">
            Calibration
          </SectionHeading>
          <div className="space-y-2.5">
            {bins.map((b) => (
              <div key={b.label} className="text-xs">
                <div className="flex justify-between font-mono text-[11px] text-muted">
                  <span>{b.label}</span>
                  <span>
                    n={b.n} · pred {Math.round(b.predicted * 100)}% · obs {Math.round(b.observed * 100)}%
                  </span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-[var(--surface-2)]">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${b.observed * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <Eyebrow>Confusion matrix @ {THRESH}</Eyebrow>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <Cell k="True positive" v={tp} tone="ok" />
            <Cell k="False positive" v={fp} tone="alert" />
            <Cell k="False negative" v={fn} tone="alert" />
            <Cell k="True negative" v={tn} tone="ok" />
          </div>
        </Card>
        <Card className="p-5">
          <Eyebrow>Subgroup AUROC (by sex)</Eyebrow>
          <ul className="mt-3 space-y-2 text-sm">
            {bySex.map((g) => (
              <li key={g.sex} className="flex justify-between border-b border-line py-1.5">
                <span>{g.sex === "F" ? "Female" : "Male"}</span>
                <span className="tnum font-mono">
                  {g.auroc.toFixed(3)} <span className="text-faint">(n={g.n})</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 font-mono text-[11px] text-faint">
            A real deployment gates model promotion on subgroup parity here.
          </p>
        </Card>
      </section>

      <Disclaimer>
        Research mode operates on de-identified aggregates only. Metrics here are computed on seeded
        synthetic data to demonstrate the evaluation surface (FR-29); they are not evidence of model
        performance.
      </Disclaimer>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-sm)]">
      <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-faint">{label}</p>
      <p className="tnum mt-1 text-2xl font-extrabold">{value}</p>
    </div>
  );
}

function Cell({ k, v, tone }: { k: string; v: number; tone: "ok" | "alert" }) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{
        borderColor: `var(--${tone === "ok" ? "ok" : "alert"})`,
        background: `color-mix(in srgb, var(--${tone === "ok" ? "ok" : "alert"}) 8%, transparent)`,
      }}
    >
      <p className="tnum text-xl font-extrabold">{v}</p>
      <p className="font-mono text-[10px] uppercase text-muted">{k}</p>
    </div>
  );
}
