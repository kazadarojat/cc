import { db } from "@/lib/db";
import { fmtMonth, pct } from "@/lib/format";
import { Badge, Card, Disclaimer, SectionHeading } from "@/components/ui";
import { inferenceHistory, latestInference } from "@/lib/queries";
import { ModalityRadar } from "@/components/charts/ModalityRadar";
import { StageProbabilityBar } from "@/components/charts/StageProbabilityBar";
import { BiomarkerTrajectory, type BiomarkerPoint } from "@/components/charts/BiomarkerTrajectory";
import { TrajectoryMap, type TrajectoryPoint } from "@/components/charts/TrajectoryMap";
import { FeatureContributionsCard } from "@/components/clinician/DashCards";

export const dynamic = "force-dynamic";

const CONTRIB_TONE: Record<string, "ok" | "watch" | "alert"> = {
  Controlled: "ok",
  Review: "watch",
  "Significant factor": "alert",
};

export default async function AnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [inf, biomarkers, history] = await Promise.all([
    latestInference(id),
    db.biomarker.findMany({ where: { patientId: id }, orderBy: { drawnAt: "asc" } }),
    inferenceHistory(id),
  ]);
  if (!inf) return <p className="text-muted">No analysis available yet.</p>;

  const modalityScores: Record<string, number | null> = JSON.parse(inf.modalityScores || "{}");
  const stageProbs = JSON.parse(inf.stageProbabilities || "{}");
  const contributors: { category: string; status: string; recommendation: string }[] = JSON.parse(
    inf.reversibleContributors || "[]",
  );
  const featureContributions: {
    name: string;
    category: string;
    weightPercent: number;
    impact: string;
    rawValue: string;
    deltaVsBaseline?: string;
  }[] = JSON.parse(inf.featureContributions || "[]");

  const trajData: TrajectoryPoint[] = history
    .map((h) => {
      let sp: Record<string, number> = {};
      try {
        sp = JSON.parse(h.stageProbabilities || "{}");
      } catch {
        sp = {};
      }
      if (sp.Normal == null) return null;
      return {
        date: fmtMonth(h.producedAt),
        Normal: sp.Normal ?? 0,
        SCD: sp.SCD ?? 0,
        MCI: sp.MCI ?? 0,
        Dementia: sp.Dementia ?? 0,
      };
    })
    .filter((x): x is TrajectoryPoint => x != null);

  // biomarker trajectory: group by draw month, one column per analyte.
  // Normalise each analyte to a multiple of its reference limit so mixed-magnitude
  // markers (p-tau217 ~0.6, GFAP ~200) share one comparable axis. 1.0 = at the limit.
  const analytes = [...new Set(biomarkers.map((b) => b.analyte))];
  const byMonth = new Map<string, BiomarkerPoint>();
  for (const b of biomarkers) {
    const k = fmtMonth(b.drawnAt);
    const row: BiomarkerPoint = byMonth.get(k) ?? { date: k };
    const norm =
      b.analyte === "Abeta42-40"
        ? b.refLow && b.refLow > 0
          ? b.refLow / b.value // inverted: below the floor => > 1
          : b.value
        : b.refHigh && b.refHigh > 0
          ? b.value / b.refHigh
          : b.value;
    row[b.analyte] = Math.round(norm * 100) / 100;
    byMonth.set(k, row);
  }
  const bioData = [...byMonth.values()];

  return (
    <div className="flex flex-col gap-8">
      <Disclaimer />

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeading sub="Stage probability band for this analysis. The named state is the modal estimate, not a certainty.">
            Stage probability
          </SectionHeading>
          <StageProbabilityBar probs={stageProbs} current={inf.state} />
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-faint">
                Biological AD risk
              </p>
              <p className="mt-0.5 text-ink">{inf.biologicalAdRiskBand}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-faint">
                Progression, 12 / 24 mo
              </p>
              <p className="mt-0.5 tnum text-ink">
                {inf.progressionRisk != null ? pct(inf.progressionRisk) : "n/a"}
                {" / "}
                {inf.progressionRisk24m != null ? pct(inf.progressionRisk24m) : "n/a"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeading sub="Cross-sectional 0 to 100 risk per modality (Neurosight-merged).">
            Modality profile
          </SectionHeading>
          <ModalityRadar scores={modalityScores} />
        </Card>
      </section>

      <section>
        <SectionHeading sub="Stage probability bands across analyses on file — the model's confidence in each stage over time.">
          Cognitive trajectory map
        </SectionHeading>
        <Card className="p-5">
          <TrajectoryMap data={trajData} />
        </Card>
      </section>

      <section>
        <SectionHeading sub="Plasma biomarkers across draws, each as a multiple of its reference limit (1.0 = at the limit).">
          Biomarker trajectory
        </SectionHeading>
        <Card className="p-5">
          <BiomarkerTrajectory data={bioData} analytes={analytes} />
        </Card>
      </section>

      {featureContributions.length ? (
        <FeatureContributionsCard contributions={featureContributions} />
      ) : null}

      <section>
        <SectionHeading sub="Secondary and potentially reversible drivers to exclude before attributing decline to a neurodegenerative process.">
          Reversible contributors
        </SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2">
          {contributors.map((c, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{c.category}</span>
                <Badge tone={CONTRIB_TONE[c.status] ?? "neutral"}>{c.status}</Badge>
              </div>
              <p className="mt-1.5 text-xs text-muted">{c.recommendation}</p>
            </Card>
          ))}
        </div>
      </section>

      <p className="font-mono text-[11px] text-faint">
        Charts and bands merged from Neurosight&apos;s engine; gating, calibration and persistence
        follow CogniCare. Model {inf.modelVersion}.
      </p>
    </div>
  );
}
