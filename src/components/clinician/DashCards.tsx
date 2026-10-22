import { titleCase } from "@/lib/format";
import { Badge, Card, Dot, Meter, SectionHeading } from "@/components/ui";

type SignalRow = {
  label: string;
  modality: string;
  baselineRaw: number;
  recentRaw: number;
  relChange: number;
  deviation: number;
  direction: "up" | "down";
};

type Tone = "ok" | "watch" | "alert" | "uncertain" | "accent" | "neutral";

function Panel({
  title,
  sub,
  meta,
  children,
}: {
  title: string;
  sub?: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1">
        <div className="min-w-0">
          <h2>{title}</h2>
          {sub ? <p className="mt-0.5 max-w-[62ch] text-[11px] leading-4 text-faint">{sub}</p> : null}
        </div>
        {meta ? <div className="flex-none pt-0.5">{meta}</div> : null}
      </div>
      <div className="mt-3">{children}</div>
    </Card>
  );
}

/* ---- follow-up recommendations + reversible contributors --------------- */

export function ClinicalRecommendationCard({
  recommendations,
  contributors,
}: {
  recommendations: { category: string; rationale: string }[];
  contributors: { category: string; status: string; recommendation: string }[];
}) {
  const tone = (s: string): Tone =>
    s === "Significant factor" ? "alert" : s === "Review" ? "watch" : "ok";

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Follow-up recommendations"
        sub="Non-diagnostic, evidence-based guidance for the treating clinician."
      >
        <ul className="flex flex-col divide-y divide-[var(--border)]">
          {recommendations.map((r, i) => (
            <li key={i} className="py-2.5">
              <span className="text-[11px] uppercase tracking-wide text-faint">
                {r.category.replace(/_/g, " ")}
              </span>
              <p className="mt-0.5 text-[13px] leading-[19px] text-ink">{r.rationale}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Potentially reversible contributors"
        sub="Screen for pseudodementia, anticholinergic load, metabolic deficiency and sleep apnoea before attributing change to neurodegeneration."
        meta={<span className="text-[11px] text-faint">{contributors.length} assessed</span>}
      >
        <ul className="flex flex-col divide-y divide-[var(--border)]">
          {contributors.map((f, i) => (
            <li key={i} className="grid gap-1 py-2.5 sm:grid-cols-[180px_1fr] sm:gap-4">
              <div className="flex items-center gap-2">
                <Dot tone={tone(f.status)} />
                <span className="text-[13px] font-medium text-ink">{f.category}</span>
              </div>
              <div>
                <Badge tone={tone(f.status)}>{f.status}</Badge>
                <p className="mt-1 text-[12px] leading-[18px] text-muted">{f.recommendation}</p>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

/* ---- change-detection alerts ------------------------------------------ */

export function ChangeAlertsCard({ signals }: { signals: SignalRow[] }) {
  const alerts = signals
    .filter((s) => Math.abs(s.deviation) >= 1.5)
    .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))
    .slice(0, 6);

  if (!alerts.length) {
    return (
      <Panel
        title="Change detection"
        sub="Fires when a parameter's rate of decline exceeds the individual tolerance threshold."
        meta={<Badge tone="ok">Stable</Badge>}
      >
        <p className="text-[13px] text-muted">
          No parameter deviates more than 1.5 SD from this patient&apos;s baseline.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title="Change detection"
      sub="Deviation against the personal baseline, in standard deviations (z)."
      meta={<Badge tone="alert">{alerts.length} above threshold</Badge>}
    >
      <div className="scroll-x">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              {["Signal", "Modality", "Baseline", "Current", "Change", "z"].map((h) => (
                <th key={h} scope="col" className="whitespace-nowrap px-2 py-1.5 text-[11px] font-medium text-faint first:pl-0">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alerts.map((a, i) => {
              const urgent = Math.abs(a.deviation) >= 2.5;
              return (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="px-2 py-2 pl-0">
                    <span className="flex items-center gap-2 text-[13px] text-ink">
                      <Dot tone={urgent ? "alert" : "watch"} />
                      {a.label}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-[11px] text-faint">{titleCase(a.modality)}</td>
                  <td className="tnum whitespace-nowrap px-2 py-2 text-[12px] text-muted">{a.baselineRaw.toFixed(2)}</td>
                  <td className="tnum whitespace-nowrap px-2 py-2 text-[12px] text-ink">{a.recentRaw.toFixed(2)}</td>
                  <td
                    className={`tnum whitespace-nowrap px-2 py-2 text-[12px] ${
                      urgent ? "text-[var(--alert)]" : "text-[var(--watch)]"
                    }`}
                  >
                    {a.relChange >= 0 ? "+" : "−"}
                    {Math.abs(Math.round(a.relChange * 100))}%
                  </td>
                  <td
                    className={`tnum whitespace-nowrap px-2 py-2 text-[12px] ${
                      urgent ? "text-[var(--alert)]" : "text-[var(--watch)]"
                    }`}
                  >
                    {a.deviation.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ---- discordance ------------------------------------------------------ */

export function DiscordanceCard({
  flag,
}: {
  flag: { description: string; modalities: string[] } | null;
}) {
  if (!flag) {
    return (
      <Panel
        title="Discordance detection"
        sub="A gap between subtle digital signals and formal bedside test scores."
        meta={<Badge tone="neutral">Aligned</Badge>}
      >
        <p className="text-[13px] text-muted">
          Digital and clinical modalities agree on this reading.
        </p>
      </Panel>
    );
  }
  return (
    <Panel
      title="Discordance detection"
      sub="Digital signals and bedside scores disagree; both are reported rather than averaged."
      meta={<Badge tone="watch">Discordant</Badge>}
    >
      <p className="text-[13px] leading-[19px] text-ink">{flag.description}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {flag.modalities.map((m) => (
          <Badge key={m} tone="neutral">
            {titleCase(m)}
          </Badge>
        ))}
      </div>
    </Panel>
  );
}

/* ---- personal baseline matrix ---------------------------------------- */

export function PersonalBaselineCard({ signals }: { signals: SignalRow[] }) {
  const rows = [...signals].sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation)).slice(0, 8);
  return (
    <Panel
      title="Personal baseline"
      sub="Each parameter against this patient's own starting point, not a population reference."
    >
      <div className="scroll-x">
        <table className="w-full min-w-[440px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              {["Parameter", "Baseline", "Current", "Change", "Deviation"].map((h) => (
                <th key={h} scope="col" className="whitespace-nowrap px-2 py-1.5 text-[11px] font-medium text-faint first:pl-0">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => {
              const worse = m.direction === "up";
              return (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="px-2 py-2 pl-0 text-[12px] text-ink">{m.label}</td>
                  <td className="tnum whitespace-nowrap px-2 py-2 text-[12px] text-muted">{m.baselineRaw.toFixed(2)}</td>
                  <td className="tnum whitespace-nowrap px-2 py-2 text-[12px] text-ink">{m.recentRaw.toFixed(2)}</td>
                  <td
                    className={`tnum whitespace-nowrap px-2 py-2 text-[12px] ${
                      worse ? "text-[var(--alert)]" : "text-[var(--ok)]"
                    }`}
                  >
                    {m.relChange >= 0 ? "+" : "−"}
                    {Math.abs(Math.round(m.relChange * 100))}%
                  </td>
                  <td className="w-[110px] px-2 py-2">
                    <div className="flex items-center gap-2">
                      <Meter value={Math.min(1, Math.abs(m.deviation) / 3)} tone={worse ? "alert" : "ok"} />
                      <span className="tnum w-7 flex-none text-right text-[11px] text-faint">
                        {m.deviation.toFixed(1)}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ---- AI safety & missing data ---------------------------------------- */

export function AISafetyCard({
  dataSufficiency,
  confidencePenalty,
  missing,
  note,
}: {
  dataSufficiency: string;
  confidencePenalty: number;
  missing: string[];
  note: string;
}) {
  const optimal = dataSufficiency === "Complete";
  return (
    <Panel
      title="Data sufficiency"
      sub="How much of the intended input set this reading had, and what that costs in confidence."
      meta={<Badge tone={optimal ? "ok" : "watch"}>{dataSufficiency || "n/a"}</Badge>}
    >
      <dl className="grid gap-x-8 gap-y-2 text-[12px] sm:grid-cols-2">
        <div>
          <dt className="text-[11px] text-faint">Confidence penalty</dt>
          <dd className="tnum text-[13px] text-ink">−{confidencePenalty}%</dd>
        </div>
        <div>
          <dt className="text-[11px] text-faint">Modalities available</dt>
          <dd className="text-[13px] text-ink">
            {missing.length ? `${missing.length} missing` : "All present"}
          </dd>
        </div>
      </dl>
      <p className="mt-2 max-w-[70ch] text-[12px] leading-[18px] text-muted">{note}</p>
      {missing.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-faint">Not available:</span>
          {missing.map((m) => (
            <Badge key={m} tone="uncertain">
              {titleCase(m)}
            </Badge>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

/* ---- explainable AI: feature contributions --------------------------- */

export function FeatureContributionsCard({
  contributions,
}: {
  contributions: {
    name: string;
    category: string;
    weightPercent: number;
    impact: string;
    rawValue: string;
    deltaVsBaseline?: string;
  }[];
}) {
  return (
    <Panel
      title="Feature contributions"
      sub="Share of the risk composite carried by each signal (SHAP-style)."
    >
      <ul className="flex flex-col divide-y divide-[var(--border)]">
        {contributions.map((f, i) => {
          const tone: Tone =
            f.impact === "Raises risk" ? "alert" : f.impact === "Lowers risk" ? "ok" : "uncertain";
          return (
            <li key={i} className="grid gap-1.5 py-2.5 sm:grid-cols-[1fr_160px] sm:items-center sm:gap-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[13px] font-medium text-ink">{f.name}</span>
                  <span className="text-[11px] text-faint">{f.category}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted">
                  {f.rawValue}
                  {f.deltaVsBaseline ? ` · ${f.deltaVsBaseline}` : ""} · {f.impact}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Meter value={Math.min(1, f.weightPercent / 100)} tone={tone} />
                <span className="tnum w-8 flex-none text-right text-[11px] text-faint">{f.weightPercent}%</span>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
