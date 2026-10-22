import { db } from "@/lib/db";
import { ageFrom, fmtDate, pct, titleCase } from "@/lib/format";
import { latestInference, buildTimeline } from "@/lib/queries";
import { PrintButton } from "@/components/clinician/PrintButton";
import { patientStaticParams } from "@/lib/static-params";

export async function generateStaticParams() {
  return patientStaticParams();
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [patient, inf, timeline] = await Promise.all([
    db.patient.findUniqueOrThrow({ where: { id }, include: { assignedDoctor: true } }),
    latestInference(id),
    buildTimeline(id),
  ]);
  if (!inf) return <p className="text-muted">No analysis available yet.</p>;

  const modalityScores: Record<string, number | null> = JSON.parse(inf.modalityScores || "{}");
  const contributors: { category: string; status: string; recommendation: string }[] = JSON.parse(
    inf.reversibleContributors || "[]",
  );
  const changes = timeline.filter((e) => e.kind === "change").map((e) => e.title.replace("Change detected: ", ""));
  let hist: Record<string, unknown> = {};
  try {
    hist = JSON.parse(patient.clinicalHistory);
  } catch {
    hist = {};
  }

  return (
    <div className="mx-auto max-w-3xl print:max-w-none">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h2 className="text-xl font-extrabold">Longitudinal clinical report</h2>
        <PrintButton />
      </div>

      <article className="space-y-6 rounded-2xl border border-line bg-surface p-8 text-sm shadow-[var(--shadow-sm)] print:border-0 print:p-0 print:shadow-none">
        <header className="border-b-2 border-[var(--ink)] pb-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
            Cognicare · Multimodal cognitive-health report · not a diagnosis
          </p>
          <h1 className="mt-1 text-2xl font-black">{patient.name}</h1>
          <p className="text-muted">
            MR {patient.medicalRecordNumber || "—"} · {ageFrom(patient.dateOfBirth)} yr · {patient.sex} ·
            enrolled {fmtDate(patient.enrolledAt)}
            {patient.assignedDoctor ? ` · ${patient.assignedDoctor.name}` : ""}
          </p>
          <p className="font-mono text-[11px] text-faint">
            Analysis {fmtDate(inf.producedAt)} · model {inf.modelVersion}
          </p>
        </header>

        <Section title="1. Cognitive state">
          <p>
            <strong>{inf.state}</strong> suspected (estimate confidence {pct(inf.stateConfidence)}). Trajectory:{" "}
            {inf.trajectory.toLowerCase()}. Composite impairment index {inf.compositeIndex.toFixed(2)}.
          </p>
        </Section>

        <Section title="2. Biological AD evidence">
          <p>
            {inf.adEvidence} ({inf.biologicalAdRiskBand} risk band). AT(N): amyloid {inf.adAmyloid}, tau{" "}
            {inf.adTau}, neurodegeneration {inf.adNeurodegeneration}.
          </p>
        </Section>

        <Section title="3. Progression risk">
          <p>
            {inf.progressionRisk != null
              ? `${pct(inf.progressionRisk)} over ${inf.progressionHorizonMonths} months (model confidence ${pct(inf.progressionConfidence ?? 0)}); ${inf.progressionRisk24m != null ? `${pct(inf.progressionRisk24m)} over 24 months` : ""}.`
              : `Not estimated. ${inf.sufficiencyNote}`}
          </p>
        </Section>

        <Section title="4. Per-modality risk (0–100)">
          <ul className="grid grid-cols-2 gap-x-6">
            {Object.entries(modalityScores).map(([k, v]) => (
              <li key={k} className="flex justify-between border-b border-line py-1">
                <span>{titleCase(k)}</span>
                <span className="tnum font-mono">{v == null ? "n/a" : v}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="5. Key changes vs baseline">
          <p>{changes.length ? changes.slice(0, 8).join("; ") : "None exceeding the change-detection threshold this period."}</p>
        </Section>

        <Section title="6. Data sufficiency">
          <p>
            {inf.dataSufficiency} (confidence penalty −{inf.confidencePenalty}%). {inf.missingDataNote}
          </p>
        </Section>

        <Section title="7. Reversible contributors">
          <ul>
            {contributors.map((c, i) => (
              <li key={i} className="border-b border-line py-1">
                <strong>{c.category}</strong> — {c.status}. {c.recommendation}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="8. Clinical history on file">
          <p>
            Comorbidities: {arr(hist.comorbidities)}. Family history: {arr(hist.familyHistory)}. Medications:{" "}
            {arr(hist.medications)}. Vascular risk: {String(hist.vascularRisk ?? "—")}. Functional status:{" "}
            {String(hist.functionalStatus ?? "—")}.
          </p>
        </Section>

        <Section title="9. Narrative & recommendations">
          <p className="whitespace-pre-wrap">{inf.explanation?.narrative}</p>
          <ul className="mt-2">
            {inf.recommendations.map((r) => (
              <li key={r.id} className="py-0.5">
                <span className="font-mono text-[11px] uppercase text-accent-ink">
                  {r.category.replace(/_/g, " ")}
                </span>{" "}
                — {r.rationale}
              </li>
            ))}
          </ul>
        </Section>

        <footer className="grid grid-cols-2 gap-8 border-t border-line pt-6 text-xs text-muted">
          <div>
            <div className="h-12 border-b border-[var(--border-strong)]" />
            <p className="mt-1">Reviewing clinician (signature &amp; date)</p>
          </div>
          <div>
            <div className="h-12 border-b border-[var(--border-strong)]" />
            <p className="mt-1">Notes</p>
          </div>
        </footer>
        <p className="font-mono text-[10px] text-faint">
          Decision support only. Generated from data on file at {fmtDate(inf.producedAt)}. Does not diagnose
          Alzheimer&apos;s disease or replace the treating clinician&apos;s assessment.
        </p>
      </article>
    </div>
  );
}

function arr(v: unknown): string {
  if (Array.isArray(v)) return v.length ? v.join(", ") : "none recorded";
  return String(v ?? "—");
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="mb-1 text-sm font-extrabold uppercase tracking-wide">{title}</h2>
      <div className="leading-relaxed text-ink">{children}</div>
    </section>
  );
}
