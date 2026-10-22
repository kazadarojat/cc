import { db } from "@/lib/db";
import { fmtDate, fmtMonth, pct, STATE_TONE, TRAJECTORY_TONE, ALERT_TONE, titleCase } from "@/lib/format";
import { Badge, Card, Disclaimer, Dot, Meter, PageHeader, SectionHeading, Stat, StatStrip, TrendChart } from "@/components/ui";
import { StageLocator } from "@/components/StageLocator";
import {
  AISafetyCard,
  ChangeAlertsCard,
  ClinicalRecommendationCard,
  DiscordanceCard,
  PersonalBaselineCard,
} from "@/components/clinician/DashCards";
import { buildTimeline, inferenceHistory, latestInference, openAlerts } from "@/lib/queries";
import { rerunInference } from "@/lib/actions";
import { patientStaticParams } from "@/lib/static-params";
import { PatientActionForm } from "@/components/PatientActionForm";

export async function generateStaticParams() {
  return patientStaticParams();
}

type Tone = "ok" | "watch" | "alert" | "uncertain";

function riskTone(r: number | null): Tone {
  if (r == null) return "uncertain";
  if (r >= 0.35) return "alert";
  if (r >= 0.15) return "watch";
  return "ok";
}
function adTone(e: string): Tone {
  if (e === "High" || e === "Moderate-High") return "alert";
  if (e === "Moderate" || e === "Low") return "watch";
  if (e === "None") return "ok";
  return "uncertain";
}
function pointsDelta(now: number, prev: number | null | undefined) {
  if (prev == null) return null;
  const d = Math.round((now - prev) * 100);
  if (d === 0) return { text: "0 pts", tone: "uncertain" as Tone, dir: "flat" as const };
  return {
    text: `${Math.abs(d)} pts`,
    tone: (d > 0 ? "alert" : "ok") as Tone,
    dir: (d > 0 ? "up" : "down") as "up" | "down",
  };
}

const MODALITY_ROWS: { key: string; label: string }[] = [
  { key: "speech", label: "Speech" },
  { key: "sleep", label: "Sleep" },
  { key: "cognitiveTask", label: "Cognitive tasks" },
  { key: "questionnaire", label: "Questionnaires" },
  { key: "clinicalCognitive", label: "Clinical cognitive" },
  { key: "fluidBiomarker", label: "Fluid biomarkers" },
  { key: "imaging", label: "Imaging" },
  { key: "digitalBehavior", label: "Digital behaviour" },
];
const modTone = (v: number) => (v >= 60 ? "alert" : v >= 35 ? "watch" : "ok");

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [inf, alerts, history, timeline, discord] = await Promise.all([
    latestInference(id),
    openAlerts(id),
    inferenceHistory(id),
    buildTimeline(id),
    db.discordanceFlag.findFirst({ where: { patientId: id }, orderBy: { detectedAt: "desc" } }),
  ]);

  if (!inf) return <p className="text-[13px] text-muted">No analysis available yet.</p>;

  const signalSummary: {
    label: string;
    modality: string;
    baselineRaw: number;
    recentRaw: number;
    relChange: number;
    deviation: number;
    direction: "up" | "down";
  }[] = JSON.parse(inf.signalSummary || "[]");
  const contributors: { category: string; status: string; recommendation: string }[] = JSON.parse(
    inf.reversibleContributors || "[]",
  );
  const discordFlag = discord
    ? { description: discord.description, modalities: JSON.parse(discord.modalities) as string[] }
    : null;

  const factors: {
    label: string;
    modality: string;
    direction: string;
    weight: number;
    evidenceType: string;
    detail: string;
  }[] = JSON.parse(inf.explanation?.factors ?? "[]");
  const observed = factors.filter((f) => f.evidenceType === "observed").slice(0, 6);
  const missing: string[] = JSON.parse(inf.missingModalities);
  const available: string[] = JSON.parse(inf.availableModalities);
  const recentChanges = timeline.filter((e) => e.kind === "change").slice(0, 6);

  const modalityScores: Record<string, number | null> = JSON.parse(inf.modalityScores || "{}");

  const prev = history.length > 1 ? history[history.length - 2] : null;
  const compositeChart = history.map((h) => ({ label: fmtMonth(h.producedAt), value: h.compositeIndex }));
  const riskChart = history
    .filter((h) => h.progressionRisk != null)
    .map((h) => ({ label: fmtMonth(h.producedAt), value: h.progressionRisk as number }));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Overview"
        sub="Cognitive state, biological AD evidence and progression risk are reported separately and never fused into one number."
        actions={
          <PatientActionForm patientId={id} kind="rerun">
            <button
              type="submit"
              className="inline-flex h-8 items-center rounded-md border border-[var(--border-strong)] px-3 text-[13px] font-medium text-ink hover:bg-[var(--surface-2)]"
            >
              Re-run analysis
            </button>
          </PatientActionForm>
        }
      />

      <StageLocator
        state={inf.state as "Normal" | "SCD" | "MCI" | "Dementia"}
        stateConfidence={inf.stateConfidence}
        trajectory={inf.trajectory}
        progressionRisk={inf.progressionRisk}
      />

      <section>
        <SectionHeading sub="Each dimension carries its own confidence; read them side by side, not as a single verdict.">
          Current status
        </SectionHeading>
        <StatStrip>
          <Stat
            label="Cognitive state"
            tone={(STATE_TONE[inf.state] ?? "neutral") as Tone}
            value={inf.state}
            detail={`Estimate confidence ${pct(inf.stateConfidence)}${
              prev && prev.state !== inf.state ? ` · was ${prev.state}` : ""
            }`}
          />
          <Stat
            label="Biological AD evidence"
            tone={adTone(inf.adEvidence)}
            value={inf.adEvidence}
            detail={`AT(N): A ${inf.adAmyloid} · T ${inf.adTau} · N ${inf.adNeurodegeneration}`}
          />
          <Stat
            label={`Progression risk, ${inf.progressionHorizonMonths} mo`}
            tone={riskTone(inf.progressionRisk)}
            value={inf.progressionRisk != null ? pct(inf.progressionRisk) : "Not estimable"}
            delta={inf.progressionRisk != null ? pointsDelta(inf.progressionRisk, prev?.progressionRisk) : null}
            detail={
              inf.progressionRisk != null
                ? `Model confidence ${pct(inf.progressionConfidence ?? 0)}`
                : inf.sufficiencyNote.replace(/^Insufficient evidence for progression estimation, /, "")
            }
          />
          <Stat
            label="Trajectory"
            tone={(TRAJECTORY_TONE[inf.trajectory] ?? "neutral") as Tone}
            value={inf.trajectory}
            detail="Direction of the composite across time points"
          />
          <Stat
            label="Overall confidence"
            tone={inf.confidenceLabel === "High" ? "ok" : inf.confidenceLabel === "Low" ? "watch" : "uncertain"}
            value={inf.confidenceLabel}
            detail={missing.length ? `Unavailable: ${missing.map((m) => titleCase(m)).join(", ")}` : "All modalities present"}
          />
          <Stat
            label="Composite impairment index"
            tone="accent"
            value={inf.compositeIndex.toFixed(2)}
            delta={pointsDelta(inf.compositeIndex, prev?.compositeIndex)}
            detail="0 at personal baseline, 1 high impairment signal"
          />
        </StatStrip>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2>Composite index</h2>
            <span className="text-[11px] text-faint">
              {history.length} {history.length === 1 ? "reading" : "readings"}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-faint">Baseline-relative, 0 to 1</p>
          <div className="mt-3">
            <TrendChart points={compositeChart} tone="accent" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2>Progression risk</h2>
            <span className="text-[11px] text-faint">{inf.progressionHorizonMonths} months</span>
          </div>
          <p className="mt-0.5 text-[11px] text-faint">Model estimate, 0 to 100%</p>
          <div className="mt-3">
            {riskChart.length >= 2 ? (
              <TrendChart points={riskChart} tone={riskTone(inf.progressionRisk)} unit="%" />
            ) : (
              <div className="flex h-[168px] items-start pt-2">
                <p className="max-w-[46ch] text-[12px] leading-[18px] text-muted">
                  {inf.sufficiencyNote.replace(/^Insufficient evidence for progression estimation, /, "Not estimated. ")}
                </p>
              </div>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card className="p-4">
          <SectionHeading sub="Cross-sectional 0 to 100 risk per modality, reported next to the baseline-relative composite rather than merged into it.">
            Per-modality risk
          </SectionHeading>
          <ul className="flex flex-col">
            {MODALITY_ROWS.map((row) => {
              const v = modalityScores[row.key];
              return (
                <li
                  key={row.key}
                  className="grid grid-cols-[128px_1fr_44px] items-center gap-3 border-b border-line py-2 last:border-0"
                >
                  <span className="text-[12px] text-muted">{row.label}</span>
                  {v == null ? (
                    <>
                      <span className="h-1.5 rounded-[3px] bg-[var(--surface-3)]" />
                      <span className="text-right text-[11px] text-faint">n/a</span>
                    </>
                  ) : (
                    <>
                      <Meter value={v / 100} tone={modTone(v)} />
                      <span className="tnum text-right text-[12px] text-ink">{v}</span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[11px] leading-4 text-faint">
            Data sufficiency {inf.dataSufficiency || "n/a"} · confidence penalty {inf.confidencePenalty}% ·{" "}
            {inf.missingDataNote}
          </p>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <div className="flex items-baseline justify-between">
              <h2>Open alerts</h2>
              <span className="text-[11px] text-faint">{alerts.length}</span>
            </div>
            <ul className="mt-2 flex flex-col divide-y divide-[var(--border)]">
              {alerts.length === 0 ? (
                <li className="py-2 text-[12px] text-faint">None open.</li>
              ) : (
                alerts.map((a) => (
                  <li key={a.id} className="py-2.5">
                    <div className="flex items-center gap-2">
                      <Badge tone={ALERT_TONE[a.tier] ?? "neutral"}>{a.tier.replace(/_/g, " ")}</Badge>
                      <span className="text-[13px] font-medium text-ink">{a.title}</span>
                    </div>
                    <p className="mt-1 text-[12px] leading-[18px] text-muted">{a.body}</p>
                  </li>
                ))
              )}
            </ul>
          </Card>

          <Card className="p-4">
            <h2>Recent changes vs baseline</h2>
            <ul className="mt-2 flex flex-col divide-y divide-[var(--border)]">
              {recentChanges.length === 0 ? (
                <li className="py-2 text-[12px] text-faint">None this period.</li>
              ) : (
                recentChanges.map((c, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="text-[12px] leading-[18px] text-ink">
                      {c.title.replace("Change detected: ", "")}
                    </span>
                    <span
                      className={`tnum flex-none text-[11px] ${
                        c.tone === "ok" ? "text-[var(--ok)]" : "text-[var(--watch)]"
                      }`}
                    >
                      {c.detail.replace(" vs personal baseline", "").replace(" signal", "")}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </Card>
        </div>
      </section>

      <section>
        <Card className="p-4">
          <SectionHeading sub="Observed signals ranked by contribution to the current composite.">
            Why this reading
          </SectionHeading>
          {observed.length ? (
            <ul className="flex flex-col divide-y divide-[var(--border)]">
              {observed.map((f, i) => (
                <li key={i} className="grid grid-cols-[1fr_120px] items-start gap-4 py-2.5 sm:grid-cols-[1fr_180px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[13px] font-medium text-ink">{f.label}</span>
                      <span className="text-[11px] text-faint">{titleCase(f.modality)}</span>
                    </div>
                    <p className="mt-0.5 text-[12px] leading-[18px] text-muted">{f.detail}</p>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Meter value={f.weight} tone={f.direction === "up" ? "alert" : "ok"} />
                    <span className="tnum w-8 flex-none text-right text-[11px] text-faint">
                      {Math.round(f.weight * 100)}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">
              No individual signal is contributing materially. Values are close to this patient&apos;s baseline.
            </p>
          )}
          <p className="mt-3 text-[11px] text-faint">
            Full breakdown, model inferences and recommendations are on the Evidence tab.
          </p>
        </Card>
      </section>

      <ChangeAlertsCard signals={signalSummary} />
      <DiscordanceCard flag={discordFlag} />
      <PersonalBaselineCard signals={signalSummary} />
      <AISafetyCard
        dataSufficiency={inf.dataSufficiency}
        confidencePenalty={inf.confidencePenalty}
        missing={missing}
        note={inf.missingDataNote}
      />
      <ClinicalRecommendationCard
        recommendations={inf.recommendations.map((r) => ({ category: r.category, rationale: r.rationale }))}
        contributors={contributors}
      />

      <div className="border-t border-line pt-4">
        <Disclaimer />
        <p className="mt-3 text-[11px] leading-4 text-faint">
          Model {inf.modelVersion} · baseline v{inf.baselineVersion} · analysis {fmtDate(inf.producedAt)}
          <br />
          Inputs used: {available.map((m) => titleCase(m)).join(", ")}
        </p>
      </div>
    </div>
  );
}
