import { db } from "@/lib/db";
import { fmtDate, titleCase } from "@/lib/format";
import { Badge, Card, Disclaimer, Eyebrow } from "@/components/ui";
import { latestInference, buildTimeline } from "@/lib/queries";
import { CopyButton } from "@/components/CopyButton";

export const dynamic = "force-dynamic";

export default async function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [patient, inf, timeline] = await Promise.all([
    db.patient.findUniqueOrThrow({ where: { id } }),
    latestInference(id),
    buildTimeline(id),
  ]);
  if (!inf) return <p className="text-muted">No analysis available.</p>;

  const changes = timeline.filter((e) => e.kind === "change").map((e) => e.title.replace("Change detected: ", ""));
  const firstAnalysis = timeline.find((e) => e.kind === "inference");
  const spanText = firstAnalysis
    ? `${Math.max(1, Math.round((inf.producedAt.getTime() - patient.enrolledAt.getTime()) / (1000 * 60 * 60 * 24 * 30.44)))} months since enrolment`
    : "";

  const plain = [
    `COGNICARE LONGITUDINAL SUMMARY | ${patient.name} | ${fmtDate(inf.producedAt)}`,
    `Model ${inf.modelVersion}, baseline v${inf.baselineVersion}. Decision support, not a diagnosis.`,
    ``,
    inf.explanation?.narrative ?? "",
    ``,
    `Suggested considerations:`,
    ...inf.recommendations.map((r) => `- [${r.category.replace(/_/g, " ")}] ${r.rationale}`),
  ].join("\n");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Automated longitudinal clinical summary</Eyebrow>
          <h2 className="mt-2 font-display text-2xl font-semibold">{patient.name}</h2>
          <p className="text-sm text-faint">
            {fmtDate(inf.producedAt)} · {spanText} · {inf.modelVersion}
          </p>
        </div>
        <CopyButton text={plain} />
      </div>

      <Card className="p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Block title="Current state">
            <Badge tone="accent">{inf.state}</Badge>{" "}
            <span className="text-sm text-muted">suspected, confidence {(inf.stateConfidence * 100).toFixed(0)}%</span>
          </Block>
          <Block title="Trajectory">{inf.trajectory} (composite {inf.compositeIndex.toFixed(2)})</Block>
          <Block title="Biological AD evidence">
            {inf.adEvidence}. A {inf.adAmyloid}, T {inf.adTau}, N {inf.adNeurodegeneration}
          </Block>
          <Block title="Progression risk">
            {inf.progressionRisk != null
              ? `${(inf.progressionRisk * 100).toFixed(0)}% over ${inf.progressionHorizonMonths} months (confidence ${((inf.progressionConfidence ?? 0) * 100).toFixed(0)}%)`
              : `Not estimated. ${inf.sufficiencyNote.replace(/^Insufficient evidence for progression estimation, /, "")}`}
          </Block>
          <Block title="Key changes vs baseline">
            {changes.length ? changes.slice(0, 6).join("; ") : "none exceeding threshold"}
          </Block>
          <Block title="Overall confidence">
            {inf.confidenceLabel}
            {JSON.parse(inf.missingModalities).length
              ? ` · missing: ${(JSON.parse(inf.missingModalities) as string[]).map(titleCase).join(", ")}`
              : ""}
          </Block>
        </div>

        <hr className="my-5 border-line" />

        <Eyebrow>Narrative</Eyebrow>
        <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">
          {inf.explanation?.narrative}
        </div>

        <hr className="my-5 border-line" />

        <Eyebrow>Suggested considerations (advisory)</Eyebrow>
        <ul className="mt-2 flex flex-col gap-2">
          {inf.recommendations.map((r) => (
            <li key={r.id} className="text-sm">
              <span className="font-mono text-[11px] uppercase tracking-wide text-accent-ink">
                {r.category.replace(/_/g, " ")}
              </span>
              <span className="text-muted">: {r.rationale}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Disclaimer>
        This summary is generated from the data on file at {fmtDate(inf.producedAt)}. It supports, and
        does not replace, the treating clinician&apos;s assessment and documentation.
      </Disclaimer>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wide text-faint">{title}</p>
      <p className="mt-0.5 text-sm text-ink">{children}</p>
    </div>
  );
}
