import type { EngineResult, MarkerSignal, ModalityKey } from "./types";
import { MODALITY_WEIGHT } from "./types";

const MOD_LABEL: Record<ModalityKey, string> = {
  speech: "speech",
  sleep: "sleep",
  cognitive_task: "cognitive task",
  questionnaire: "questionnaire",
  diary: "cognitive diary",
  behavioral: "digital behaviour",
  clinical: "clinical assessment",
  biomarker: "blood biomarker",
  imaging: "imaging",
};

function pctChange(rel: number): string {
  const p = Math.round(Math.abs(rel) * 100);
  return `${rel >= 0 ? "+" : "−"}${p}%`;
}

/** Detect meaningful per-marker changes vs baseline. */
export function detectChanges(signals: MarkerSignal[], asOf: Date) {
  return signals
    .filter((s) => Math.abs(s.deviation) >= 1.5 && s.nRecent >= 1)
    .map((s) => ({
      markerKey: s.markerKey,
      modality: s.modality,
      label: s.label,
      // direction = impairment direction ("up" = worse); magnitude = signed raw change vs baseline
      direction: s.deviation >= 0 ? ("up" as const) : ("down" as const),
      magnitude: s.relChange,
      deviation: Math.abs(s.deviation),
      at: asOf,
    }))
    // rank by statistical strength of the deviation, not raw percentage change
    .sort((a, b) => b.deviation - a.deviation);
}

/** Modalities moving in the impairment direction. */
function worseningModalities(signals: MarkerSignal[]): ModalityKey[] {
  const byMod = new Map<ModalityKey, number[]>();
  for (const s of signals) {
    if (!byMod.has(s.modality)) byMod.set(s.modality, []);
    byMod.get(s.modality)!.push(s.deviation);
  }
  const out: ModalityKey[] = [];
  for (const [mod, devs] of byMod) {
    const m = devs.reduce((a, b) => a + b, 0) / devs.length;
    if (m >= 1) out.push(mod);
  }
  return out;
}

export function detectDiscordance(signals: MarkerSignal[]): EngineResult["discordance"] {
  const digitalWorse = worseningModalities(signals).filter((m) =>
    ["speech", "sleep", "questionnaire", "diary"].includes(m),
  );
  const anchor = signals.filter((s) => s.markerKey === "clinical.MoCA" || s.markerKey === "clinical.MMSE");
  const anchorStable = anchor.length > 0 && anchor.every((s) => Math.abs(s.deviation) < 0.75);
  if (digitalWorse.length >= 2 && anchorStable) {
    return {
      description:
        "Patient-generated signals are moving while the validated clinical anchor is stable. Recommend clinical review rather than a change in disease status.",
      modalities: [...digitalWorse, "clinical"],
    };
  }
  return null;
}

/** Contributing-factor breakdown for the composite / risk movement. */
const PATIENT_MODALITIES: ModalityKey[] = ["speech", "sleep", "cognitive_task", "questionnaire", "diary", "behavioral"];

export type FeatureContribution = {
  name: string;
  category: "Patient digital" | "Clinician";
  weightPercent: number;
  impact: "Raises risk" | "Lowers risk" | "Neutral";
  rawValue: string;
  deltaVsBaseline?: string;
};

/** SHAP-style contribution breakdown, data-driven from the marker signals. */
export function buildFeatureContributions(
  signals: MarkerSignal[],
  atn: { evidence: string },
): FeatureContribution[] {
  const scored = signals
    .map((s) => ({ s, w: (MODALITY_WEIGHT[s.modality] ?? 0.05) * Math.abs(s.deviation) }))
    .filter((x) => x.w > 0.02)
    .sort((a, b) => b.w - a.w)
    .slice(0, 8);
  const total = scored.reduce((a, x) => a + x.w, 0) || 1;
  const out: FeatureContribution[] = scored.map(({ s, w }) => ({
    name: s.label,
    category: PATIENT_MODALITIES.includes(s.modality) ? "Patient digital" : "Clinician",
    weightPercent: Math.round((w / total) * 100),
    impact: Math.abs(s.deviation) < 0.5 ? "Neutral" : s.deviation > 0 ? "Raises risk" : "Lowers risk",
    rawValue: `${s.recentRaw.toFixed(2)} (baseline ${s.baselineRaw.toFixed(2)})`,
    deltaVsBaseline: `${s.relChange >= 0 ? "+" : "−"}${Math.abs(Math.round(s.relChange * 100))}% vs baseline`,
  }));
  if (atn.evidence !== "Unknown") {
    out.push({
      name: "Biological AD evidence (AT(N))",
      category: "Clinician",
      weightPercent: 0,
      impact: atn.evidence === "None" ? "Lowers risk" : "Raises risk",
      rawValue: atn.evidence,
    });
  }
  return out;
}

export function buildFactors(
  signals: MarkerSignal[],
  r: Pick<EngineResult, "state" | "trajectory" | "progression" | "atn">,
): EngineResult["factors"] {
  const contribs = signals
    .map((s) => ({
      s,
      contrib: (MODALITY_WEIGHT[s.modality] ?? 0) * s.deviation,
    }))
    .filter((c) => c.contrib > 0.04)
    .sort((a, b) => b.contrib - a.contrib);

  const total = contribs.reduce((a, c) => a + c.contrib, 0) || 1;

  const observed: EngineResult["factors"] = contribs.slice(0, 6).map((c) => ({
    label: c.s.label,
    modality: c.s.modality,
    direction: c.s.direction,
    weight: c.contrib / total,
    evidenceType: "observed" as const,
    detail: `${pctChange(c.s.relChange)} vs personal baseline (robust z ${c.s.deviation.toFixed(1)}), from ${c.s.nRecent} recent measurement${c.s.nRecent === 1 ? "" : "s"}.`,
  }));

  const inferred: EngineResult["factors"] = [
    {
      label: `Cognitive state estimate: ${r.state}`,
      modality: "engine" as const,
      direction: "none" as const,
      weight: 0,
      evidenceType: "inferred" as const,
      detail: "Fusion of the observed signals above against the patient's own baseline. Not a diagnosis.",
    },
    {
      label: `Trajectory: ${r.trajectory}`,
      modality: "engine" as const,
      direction: "none" as const,
      weight: 0,
      evidenceType: "inferred" as const,
      detail: "Least-squares trend of the multimodal composite index across monthly time points.",
    },
  ];
  if (r.atn.evidence !== "Unknown") {
    inferred.push({
      label: `Biological AD evidence: ${r.atn.evidence}`,
      modality: "engine",
      direction: "none",
      weight: 0,
      evidenceType: "inferred",
      detail: `AT(N): amyloid ${r.atn.amyloid}, tau ${r.atn.tau}, neurodegeneration ${r.atn.neurodegeneration}. Reported as a dimension separate from cognitive state.`,
    });
  }
  return [...observed, ...inferred];
}

export function buildNarrative(
  patientName: string,
  r: Pick<
    EngineResult,
    | "state"
    | "stateConfidence"
    | "trajectory"
    | "progression"
    | "atn"
    | "compositeSeries"
    | "changes"
    | "confidenceLabel"
    | "missingModalities"
  >,
): string {
  const months =
    r.compositeSeries.length >= 2
      ? Math.round(
          (r.compositeSeries.at(-1)!.at.getTime() - r.compositeSeries[0].at.getTime()) /
            (1000 * 60 * 60 * 24 * 30.44),
        )
      : 0;

  const lines: string[] = [];
  lines.push(
    `Current state: ${r.state} suspected (estimate confidence ${(r.stateConfidence * 100).toFixed(0)}%). This is decision support, not a diagnosis.`,
  );
  lines.push(
    `Trajectory: ${r.trajectory.toLowerCase()}${months ? ` over the last ${months} month${months === 1 ? "" : "s"}` : ""}.`,
  );
  if (r.changes.length) {
    const top = r.changes
      .slice(0, 4)
      .map((c) => `${c.label.toLowerCase()} ${c.magnitude >= 0 ? "↑" : "↓"}`)
      .join(", ");
    lines.push(`Key changes vs baseline: ${top}.`);
  } else {
    lines.push("Key changes: none exceeding the change-detection threshold this period.");
  }
  lines.push(
    r.atn.evidence === "Unknown"
      ? "Available biological evidence: no amyloid, tau or neurodegeneration markers on file."
      : `Available biological evidence: ${r.atn.evidence} (A ${r.atn.amyloid}, T ${r.atn.tau}, N ${r.atn.neurodegeneration}).`,
  );
  lines.push(
    r.progression.sufficiency === "sufficient" && r.progression.risk != null
      ? `Progression risk (${r.progression.horizonMonths}-month): ${(r.progression.risk * 100).toFixed(0)}%, model confidence ${((r.progression.confidence ?? 0) * 100).toFixed(0)}%.`
      : `Progression risk: not estimated. ${r.progression.note}`,
  );
  if (r.missingModalities.length) {
    lines.push(`Overall confidence ${r.confidenceLabel}. Unavailable modalities: ${r.missingModalities.join(", ")}.`);
  } else {
    lines.push(`Overall confidence ${r.confidenceLabel}.`);
  }
  lines.push("Recommended clinical consideration: review the contributing evidence; further evaluation may be warranted at the treating clinician's discretion.");
  return lines.join("\n");
}

export function buildRecommendations(
  r: Pick<EngineResult, "state" | "trajectory" | "progression" | "atn" | "compositeIndex" | "signals" | "discordance">,
): { category: string; rationale: string }[] {
  const recs: { category: string; rationale: string }[] = [];
  recs.push({
    category: "observe",
    rationale: "Continue periodic multimodal monitoring on the current schedule.",
  });
  if (r.trajectory === "Worsening" || r.trajectory === "Changing") {
    recs.push({
      category: "repeat_assessment",
      rationale: "Repeat a clinician-administered cognitive assessment (MMSE/MoCA) to corroborate the digital trend.",
    });
  }
  const sleepSignal = r.signals.find((s) => s.modality === "sleep" && s.deviation >= 1);
  if (sleepSignal || r.trajectory === "Worsening") {
    recs.push({
      category: "review_reversible",
      rationale:
        "Review potentially reversible contributors: sleep disturbance, mood, medication effects, metabolic and vascular factors.",
    });
  }
  if ((r.state === "MCI" || r.state === "Dementia") && r.trajectory === "Worsening") {
    recs.push({
      category: "specialist_referral",
      rationale: "Consider specialist (memory clinic / neurology) evaluation given impairment plus a worsening trajectory.",
    });
  }
  if ((r.atn.evidence === "Unknown" || r.atn.evidence === "Low") && r.compositeIndex >= 0.5) {
    recs.push({
      category: "additional_biomarkers",
      rationale: "Consider blood-based AD biomarkers (e.g. plasma p-tau217) to clarify the biological picture.",
    });
  }
  if (r.discordance) {
    recs.push({
      category: "repeat_assessment",
      rationale: "Multimodal discordance detected. Bring the patient in for review before revising any impression.",
    });
  }
  return recs;
}

export function buildAlerts(
  r: Pick<EngineResult, "changes" | "trajectory" | "progression" | "discordance" | "signals">,
  recentAssessment: boolean,
): { tier: string; title: string; body: string }[] {
  const alerts: { tier: string; title: string; body: string }[] = [];
  if (recentAssessment) {
    alerts.push({
      tier: "informational",
      title: "New assessment data available",
      body: "One or more assessments were completed in the last 30 days and are reflected in the current analysis.",
    });
  }
  if (r.changes.length) {
    alerts.push({
      tier: "change",
      title: "Change from personal baseline",
      body: `${r.changes.length} marker${r.changes.length === 1 ? "" : "s"} deviated meaningfully from baseline, led by ${r.changes[0].label.toLowerCase()}.`,
    });
  }
  const worseMods = new Set(r.changes.filter((c) => c.direction === "up").map((c) => c.modality));
  if (worseMods.size >= 3) {
    alerts.push({
      tier: "multimodal",
      title: "Multimodal change detected",
      body: `Concurrent movement across ${worseMods.size} domains (${[...worseMods].join(", ")}).`,
    });
  }
  const risk = r.progression.risk ?? 0;
  if (r.trajectory === "Worsening" && (risk >= 0.2 || r.discordance)) {
    alerts.push({
      tier: "clinical_review",
      title: "Pattern may warrant clinical evaluation",
      body: "A worsening trajectory is accompanied by elevated progression risk and/or discordant modalities. Clinician review is suggested.",
    });
  }
  return alerts;
}
