/**
 * Per-modality risk scoring, merged from Neurosight's `cognitiveEngine.ts`.
 *
 * Neurosight scored each modality on a 0..100 "risk" scale with published-range
 * anchors. CogniCare keeps its own baseline-relative fusion, state estimation,
 * trajectory and the hard progression-risk sufficiency gate authoritative; these
 * scores are a cross-sectional companion view plus a data-sufficiency assessment
 * that feeds the confidence label.
 */
import type { PatientBundle } from "./markers";

const clamp = (x: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, x));
const lin = (v: number, zero: number, full: number) => clamp(((v - zero) / (full - zero)) * 100);

function latest<T>(arr: T[], key: keyof T): T | undefined {
  if (!arr.length) return undefined;
  return [...arr].sort((a, b) => +new Date(b[key] as never) - +new Date(a[key] as never))[0];
}

export type ModalityScores = {
  speech: number | null;
  sleep: number | null;
  cognitiveTask: number | null;
  questionnaire: number | null;
  digitalBehavior: number | null;
  clinicalCognitive: number | null;
  fluidBiomarker: number | null;
  imaging: number | null;
};

export type MissingDataStatus = {
  mriAvailable: boolean;
  amyloidPetAvailable: boolean;
  plasmaBiomarkerAvailable: boolean;
  speechAvailable: boolean;
  sleepAvailable: boolean;
  dataSufficiency: "Complete" | "Adequate" | "Limited" | "Insufficient";
  confidencePenaltyPercent: number;
  safeStagingFeasible: boolean;
  note: string;
};

// ---- per-modality scorers (adapted to CogniCare units) -----------------

export function speechScore(b: PatientBundle): number | null {
  const s = latest(b.speech, "capturedAt");
  if (!s) return null;
  // CogniCare units -> Neurosight-shaped anchors
  const pauseRatio = clamp(s.pauseFrequency * s.pauseDuration * 1.6, 0, 55); // approx % of speech in pauses
  const hesitationCount = s.hesitationRatio * 26;
  const wordFinding = s.wordFindingDelay * 6;
  const semantic100 = s.semanticRichness * 100;
  const speechRateRisk = lin(155 - s.speechRate, 0, 75);
  const pauseRatioRisk = lin(pauseRatio, 12, 38);
  const pauseDurRisk = lin(s.pauseDuration, 0.5, 2.0);
  const hesitationRisk = lin(hesitationCount + wordFinding, 2, 14);
  const semanticRisk = lin(85 - semantic100, 0, 50);
  const lexicalRisk = lin(0.7 - s.lexicalDiversity, 0, 0.35);
  return Math.round(
    pauseRatioRisk * 0.25 +
      speechRateRisk * 0.2 +
      pauseDurRisk * 0.17 +
      semanticRisk * 0.16 +
      lexicalRisk * 0.12 +
      hesitationRisk * 0.1,
  );
}

export function sleepScore(b: PatientBundle): number | null {
  const n = latest(b.sleep, "night");
  if (!n) return null;
  const fragScaled = n.fragmentationIndex * 12; // events/hr -> 0..100-ish
  const fragRisk = lin(fragScaled, 10, 65);
  const effRisk = lin(90 - n.efficiency * 100, 0, 30);
  const circRisk = lin(85 - n.regularityIndex * 100, 0, 50);
  const awakenRisk = lin(n.awakenings, 1, 5);
  return Math.round(fragRisk * 0.34 + effRisk * 0.28 + circRisk * 0.28 + awakenRisk * 0.1);
}

export function cognitiveTaskScore(b: PatientBundle): number | null {
  const t = latest(b.tasks, "takenAt");
  if (!t) return null;
  const recallDef = clamp((1 - t.delayedRecall) * 100);
  const attnDef = clamp((1 - t.attention) * 100);
  const orientDef = clamp((1 - t.orientation) * 100);
  const fluencyDef = lin(16 - t.fluency * 20, 0, 9);
  const execDef = clamp((1 - t.executive) * 100);
  return Math.round(
    recallDef * 0.35 + attnDef * 0.2 + orientDef * 0.15 + fluencyDef * 0.15 + execDef * 0.15,
  );
}

export function questionnaireScore(b: PatientBundle): number | null {
  if (!b.questionnaires.length) return null;
  const byInstr = (name: string) => latest(b.questionnaires.filter((q) => q.instrument === name), "takenAt");
  const ad8 = byInstr("AD8");
  const scd = byInstr("SCD-Q");
  const mcq = byInstr("MCQ");
  const ad8Risk = ad8 ? (ad8.maxScore ? (ad8.score / ad8.maxScore) * 100 : ad8.score * 12.5) : 0;
  const scdRisk = scd ? (scd.maxScore ? (scd.score / scd.maxScore) * 100 : 0) : 0;
  const mcqRisk = mcq ? (mcq.maxScore ? (mcq.score / mcq.maxScore) * 100 : 0) : scdRisk;
  // diary domain spread as a rough "complaint count" proxy (0..6)
  const domains = new Set<string>();
  for (const d of b.diary) {
    try {
      for (const x of JSON.parse(d.domains) as string[]) domains.add(x);
    } catch {
      /* noop */
    }
  }
  const complaintRisk = (Math.min(domains.size, 6) / 6) * 100;
  return Math.round(ad8Risk * 0.4 + scdRisk * 0.28 + mcqRisk * 0.14 + complaintRisk * 0.18);
}

export function clinicalCognitiveScore(b: PatientBundle): number | null {
  const moca = latest(
    b.clinical.filter((c) => c.instrument === "MoCA" && c.score != null),
    "administeredAt",
  );
  const mmse = latest(
    b.clinical.filter((c) => c.instrument === "MMSE" && c.score != null),
    "administeredAt",
  );
  if (!moca && !mmse) return null;
  const parts: { risk: number; w: number }[] = [];
  if (moca?.score != null) parts.push({ risk: lin(30 - moca.score, 0, 16), w: 0.62 });
  if (mmse?.score != null) parts.push({ risk: lin(30 - mmse.score, 0, 14), w: 0.38 });
  const tw = parts.reduce((a, p) => a + p.w, 0);
  return Math.round(parts.reduce((a, p) => a + p.risk * p.w, 0) / tw);
}

export function fluidBiomarkerScore(b: PatientBundle): number | null {
  if (!b.biomarkers.length) return null;
  const val = (a: string) =>
    latest(b.biomarkers.filter((x) => x.analyte === a), "drawnAt")?.value ?? null;
  const ptau = val("p-tau217");
  const abeta = val("Abeta42-40");
  const nfl = val("NfL");
  const parts: { risk: number; w: number }[] = [];
  if (ptau != null) parts.push({ risk: lin(ptau - 0.15, 0, 0.3), w: 0.5 });
  if (abeta != null) parts.push({ risk: lin(0.095 - abeta, 0, 0.027), w: 0.3 });
  if (nfl != null) parts.push({ risk: lin(nfl - 10, 0, 22), w: 0.2 });
  if (!parts.length) return null;
  const tw = parts.reduce((a, p) => a + p.w, 0);
  return Math.round(parts.reduce((a, p) => a + p.risk * p.w, 0) / tw);
}

export function digitalBehaviorScore(b: PatientBundle): number | null {
  if (!b.behaviourConsent || !b.behaviour.length) return null;
  // average the most recent week of passive data
  const recent = b.behaviour.slice(-7);
  const avg = <K extends keyof (typeof recent)[number]>(k: K) =>
    recent.reduce((a, r) => a + (r[k] as number), 0) / recent.length;
  const routineRisk = clamp(avg("routineDisruptionIndex"));
  const onsetRisk = lin(avg("activityOnsetShiftMin"), 0, 120);
  const latencyRisk = lin(avg("screenInteractionLatencyMs") - 500, 0, 1100);
  const typingSpeedRisk = lin(180 - avg("typingSpeedCpm"), 0, 110);
  const varianceRisk = lin(avg("typingLatencyVarianceMs") - 35, 0, 115);
  return Math.round(
    routineRisk * 0.34 + onsetRisk * 0.14 + latencyRisk * 0.24 + typingSpeedRisk * 0.16 + varianceRisk * 0.12,
  );
}

type ImgFindings = { mta_score?: number; centiloid?: number; visual_read?: string };

export function imagingScore(b: PatientBundle): number | null {
  if (!b.imagingStudies.length) return null;
  const parse = (s: string): ImgFindings => {
    try {
      return JSON.parse(s);
    } catch {
      return {};
    }
  };
  const mri = b.imagingStudies.find((i) => i.modality === "MRI");
  const pet = b.imagingStudies.find((i) => i.modality === "amyloid_PET");
  const parts: { risk: number; w: number }[] = [];
  if (pet) {
    const f = parse(pet.findings);
    const cl = f.centiloid ?? (/(positive|elevated)/i.test(pet.report) ? 60 : 10);
    parts.push({ risk: lin(cl - 10, 0, 50), w: 0.45 });
  }
  if (mri) {
    const f = parse(mri.findings);
    const mta = f.mta_score ?? (/atroph|hippocamp|medial temporal/i.test(mri.report) ? 2 : 0);
    const hippoPct = 35 - mta * 8;
    parts.push({ risk: lin(50 - hippoPct, 0, 45), w: 0.35 });
    parts.push({ risk: (mta / 4) * 100, w: 0.2 });
  }
  if (!parts.length) return null;
  const tw = parts.reduce((a, p) => a + p.w, 0);
  return Math.round(parts.reduce((a, p) => a + p.risk * p.w, 0) / tw);
}

export function computeModalityScores(b: PatientBundle): ModalityScores {
  return {
    speech: speechScore(b),
    sleep: sleepScore(b),
    cognitiveTask: cognitiveTaskScore(b),
    questionnaire: questionnaireScore(b),
    digitalBehavior: digitalBehaviorScore(b),
    clinicalCognitive: clinicalCognitiveScore(b),
    fluidBiomarker: fluidBiomarkerScore(b),
    imaging: imagingScore(b),
  };
}

export function computeMissingData(b: PatientBundle): MissingDataStatus {
  const parse = (s: string) => {
    try {
      return JSON.parse(s) as ImgFindings;
    } catch {
      return {} as ImgFindings;
    }
  };
  const mri = b.imagingStudies.find((i) => i.modality === "MRI");
  const pet = b.imagingStudies.find((i) => i.modality === "amyloid_PET");
  const mriAvailable = !!mri;
  const amyloidPetAvailable = !!pet && (parse(pet.findings).visual_read != null || /positive|negative/i.test(pet.report));
  const plasmaBiomarkerAvailable = b.biomarkers.some((x) => x.analyte === "p-tau217");
  const speechAvailable = b.speech.length > 0;
  const sleepAvailable = b.sleep.length > 0;
  const hasMoCA = b.clinical.some((c) => c.instrument === "MoCA" && c.score != null);

  let confidencePenaltyPercent = 0;
  const missing: string[] = [];
  if (!amyloidPetAvailable) {
    confidencePenaltyPercent += 6;
    missing.push("amyloid PET");
  }
  if (!mriAvailable) {
    confidencePenaltyPercent += 10;
    missing.push("volumetric MRI");
  }
  if (!plasmaBiomarkerAvailable) {
    confidencePenaltyPercent += 14;
    missing.push("plasma p-tau217");
  }

  let dataSufficiency: MissingDataStatus["dataSufficiency"] = "Complete";
  if (missing.length >= 2) dataSufficiency = "Limited";
  else if (missing.length === 1) dataSufficiency = "Adequate";
  const digitalCore = [speechAvailable, sleepAvailable, hasMoCA, b.tasks.length > 0].filter(Boolean).length;
  if (digitalCore < 2) dataSufficiency = "Insufficient";

  return {
    mriAvailable,
    amyloidPetAvailable,
    plasmaBiomarkerAvailable,
    speechAvailable,
    sleepAvailable,
    dataSufficiency,
    confidencePenaltyPercent,
    safeStagingFeasible: digitalCore >= 1 || plasmaBiomarkerAvailable,
    note: missing.length
      ? `${missing.join(" and ")} not on file. Weighting compensates adaptively from the available digital biomarkers (speech, sleep, cognitive tasks) and MoCA.`
      : "All clinical and digital modalities are present.",
  };
}
