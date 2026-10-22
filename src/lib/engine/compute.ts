import type {
  BaselineStat,
  CompositePoint,
  MarkerPoint,
  MarkerSignal,
  ModalityKey,
} from "./types";
import { MODALITY_WEIGHT } from "./types";
import { MARKER_LABEL, MARKER_NOISE, MARKER_SCALE, type PatientBundle } from "./markers";

const DAY = 24 * 60 * 60 * 1000;

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function mad(xs: number[], med: number): number {
  if (!xs.length) return 0;
  return median(xs.map((x) => Math.abs(x - med)));
}

export function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Baseline window: from enrolment to enrolment + `days`, but stretched to include
 *  at least `minPerMarker` points for markers that report slowly. */
export function baselineWindow(enrolledAt: Date, points: MarkerPoint[], days = 100): {
  start: Date;
  end: Date;
} {
  const start = new Date(enrolledAt.getTime() - 7 * DAY);
  let end = new Date(enrolledAt.getTime() + days * DAY);
  const last = points.at(-1);
  if (last && end > last.at) {
    // never let the baseline eat the whole record
    const span = last.at.getTime() - start.getTime();
    end = new Date(start.getTime() + Math.min(days * DAY, span * 0.45));
  }
  return { start, end };
}

export function computeBaseline(points: MarkerPoint[], win: { start: Date; end: Date }): BaselineStat[] {
  const byMarker = new Map<string, MarkerPoint[]>();
  for (const p of points) {
    if (p.at >= win.start && p.at <= win.end) {
      if (!byMarker.has(p.markerKey)) byMarker.set(p.markerKey, []);
      byMarker.get(p.markerKey)!.push(p);
    }
  }
  const stats: BaselineStat[] = [];
  for (const [key, pts] of byMarker) {
    const oriented = pts.map((p) => p.oriented);
    const med = median(oriented);
    // Robust spread, floored at the marker's expected measurement noise so that
    // ordinary test-retest variation does not read as a meaningful deviation.
    const rawMad = mad(oriented, med);
    const spread = Math.max(rawMad, MARKER_NOISE[key] ?? Math.abs(MARKER_SCALE[key] ?? 1) * 0.05);
    stats.push({
      markerKey: key,
      modality: pts[0].modality,
      median: med,
      medianRaw: median(pts.map((p) => p.raw)),
      mad: spread,
      n: pts.length,
    });
  }
  return stats;
}

/** Per-marker signal: recent median vs baseline, as a robust z (positive = worse). */
export function computeSignals(
  points: MarkerPoint[],
  baseline: BaselineStat[],
  recentDays = 100,
): MarkerSignal[] {
  const last = points.at(-1);
  if (!last) return [];
  const recentStart = new Date(last.at.getTime() - recentDays * DAY);
  const byMarker = new Map<string, MarkerPoint[]>();
  for (const p of points) {
    if (p.at >= recentStart) {
      if (!byMarker.has(p.markerKey)) byMarker.set(p.markerKey, []);
      byMarker.get(p.markerKey)!.push(p);
    }
  }
  const out: MarkerSignal[] = [];
  for (const bs of baseline) {
    const recent = byMarker.get(bs.markerKey);
    if (!recent || !recent.length) continue;
    const recentOriented = median(recent.map((p) => p.oriented));
    const recentRaw = median(recent.map((p) => p.raw));
    const dev = (recentOriented - bs.median) / (1.4826 * bs.mad);
    const scale = MARKER_SCALE[bs.markerKey] ?? 1;
    const denomRaw = Math.abs(bs.medianRaw) > 1e-6 ? Math.abs(bs.medianRaw) : scale;
    const relChange = (recentRaw - bs.medianRaw) / denomRaw;
    out.push({
      markerKey: bs.markerKey,
      modality: bs.modality,
      label: MARKER_LABEL[bs.markerKey] ?? bs.markerKey,
      baselineMedian: bs.median,
      recentMedian: recentOriented,
      baselineRaw: bs.medianRaw,
      recentRaw,
      deviation: clamp(dev, -4, 4),
      relChange: clamp(relChange, -2, 4),
      direction: dev >= 0 ? "up" : "down",
      nRecent: recent.length,
    });
  }
  return out;
}

/** Aggregate a set of per-marker deviations into one impairment index in 0..1. */
function fuse(devByModality: Map<ModalityKey, number[]>): { index: number; nModalities: number } {
  let wsum = 0;
  let acc = 0;
  let n = 0;
  for (const [mod, devs] of devByModality) {
    if (!devs.length) continue;
    const w = MODALITY_WEIGHT[mod] ?? 0;
    if (w <= 0) continue;
    // per-modality mean deviation, capped so one saturated modality cannot dominate
    const m = clamp(devs.reduce((a, b) => a + b, 0) / devs.length, -3.5, 3.5);
    acc += w * m;
    wsum += w;
    n += 1;
  }
  if (wsum === 0) return { index: 0, nModalities: 0 };
  const meanDev = acc / wsum; // robust-z units; 0 = at personal baseline
  // calibrated so meanDev 0 → ~0.10, 1 → ~0.30 (SCD), 2 → ~0.62 (MCI), 3 → ~0.86
  return { index: clamp(logistic(1.34 * meanDev - 2.2), 0, 1), nModalities: n };
}

/** Composite index now (recent window). */
export function compositeNow(signals: MarkerSignal[]): { index: number; nModalities: number } {
  const byMod = new Map<ModalityKey, number[]>();
  for (const s of signals) {
    if (!byMod.has(s.modality)) byMod.set(s.modality, []);
    byMod.get(s.modality)!.push(s.deviation);
  }
  return fuse(byMod);
}

/** Monthly composite series, each month scoring markers within ±45d vs baseline. */
export function compositeSeries(points: MarkerPoint[], baseline: BaselineStat[]): CompositePoint[] {
  if (!points.length) return [];
  const baseMap = new Map(baseline.map((b) => [b.markerKey, b]));
  const first = points[0].at;
  const last = points.at(-1)!.at;
  const out: CompositePoint[] = [];
  const startMonth = new Date(first.getFullYear(), first.getMonth(), 15);
  for (let t = new Date(startMonth); t <= last; t.setMonth(t.getMonth() + 1)) {
    const lo = t.getTime() - 45 * DAY;
    const hi = t.getTime() + 45 * DAY;
    const byMarker = new Map<string, number[]>();
    for (const p of points) {
      const ms = p.at.getTime();
      if (ms >= lo && ms <= hi) {
        if (!byMarker.has(p.markerKey)) byMarker.set(p.markerKey, []);
        byMarker.get(p.markerKey)!.push(p.oriented);
      }
    }
    if (!byMarker.size) continue;
    const byMod = new Map<ModalityKey, number[]>();
    for (const [key, vals] of byMarker) {
      const bs = baseMap.get(key);
      if (!bs) continue;
      const dev = (median(vals) - bs.median) / (1.4826 * bs.mad);
      if (!byMod.has(bs.modality)) byMod.set(bs.modality, []);
      byMod.get(bs.modality)!.push(clamp(dev, -4, 4));
    }
    const { index, nModalities } = fuse(byMod);
    if (nModalities > 0) out.push({ at: new Date(t), value: index, nModalities });
  }
  return out;
}

/** Least-squares slope of composite over time, per year, plus volatility. */
export function trajectory(series: CompositePoint[]): {
  label: "Stable" | "Improving" | "Changing" | "Worsening" | "Uncertain";
  slopePerYear: number;
} {
  const pts = series.slice(-9);
  if (pts.length < 4) return { label: "Uncertain", slopePerYear: 0 };
  const t0 = pts[0].at.getTime();
  const xs = pts.map((p) => (p.at.getTime() - t0) / (365.25 * DAY));
  const ys = pts.map((p) => p.value);
  const n = pts.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  // residual volatility
  let ss = 0;
  for (let i = 0; i < n; i++) {
    const pred = my + slope * (xs[i] - mx);
    ss += (ys[i] - pred) ** 2;
  }
  const rmse = Math.sqrt(ss / n);

  let label: "Stable" | "Improving" | "Changing" | "Worsening" | "Uncertain";
  if (slope > 0.16) label = "Worsening";
  else if (slope < -0.12) label = "Improving";
  else if (rmse > 0.11 || Math.abs(slope) > 0.09) label = "Changing";
  else label = "Stable";
  return { label, slopePerYear: slope };
}

export type AtnResult = {
  amyloid: "positive" | "negative" | "unknown";
  tau: "positive" | "negative" | "unknown";
  neurodegeneration: "positive" | "negative" | "unknown";
  evidence: "None" | "Low" | "Moderate" | "Moderate-High" | "High" | "Unknown";
};

export function computeAtn(b: PatientBundle): AtnResult {
  let amyloid: AtnResult["amyloid"] = "unknown";
  let tau: AtnResult["tau"] = "unknown";
  let nd: AtnResult["neurodegeneration"] = "unknown";

  const lastBio = (analyte: string) =>
    b.biomarkers.filter((x) => x.analyte === analyte).sort((a, c) => c.drawnAt.getTime() - a.drawnAt.getTime())[0];

  const abeta = lastBio("Abeta42-40");
  if (abeta) amyloid = abeta.refLow != null && abeta.value < abeta.refLow ? "positive" : "negative";
  const amyPet = b.imagingStudies.find((i) => i.modality === "amyloid_PET");
  if (amyPet) {
    const pos = /positive|elevated|amyloid[- ]?positive/i.test(amyPet.report);
    amyloid = pos ? "positive" : amyloid === "unknown" ? "negative" : amyloid;
  }

  const ptau217 = lastBio("p-tau217");
  const ptau181 = lastBio("p-tau181");
  for (const m of [ptau217, ptau181]) {
    if (m && m.refHigh != null) {
      if (m.value > m.refHigh) tau = "positive";
      else if (tau === "unknown") tau = "negative";
    }
  }
  const tauPet = b.imagingStudies.find((i) => i.modality === "tau_PET");
  if (tauPet) tau = /positive|elevated|tau[- ]?positive/i.test(tauPet.report) ? "positive" : tau === "unknown" ? "negative" : tau;

  const nfl = lastBio("NfL");
  if (nfl && nfl.refHigh != null) nd = nfl.value > nfl.refHigh ? "positive" : "negative";
  const mri = b.imagingStudies.find((i) => i.modality === "MRI");
  if (mri) {
    const neuro = /atroph|neurodegener|hippocamp|volume loss|medial temporal/i.test(mri.report);
    nd = neuro ? "positive" : nd === "unknown" ? "negative" : nd;
  }

  const measured = [amyloid, tau, nd].filter((x) => x !== "unknown").length;
  const positives = [amyloid, tau, nd].filter((x) => x === "positive").length;
  let evidence: AtnResult["evidence"];
  if (measured === 0) evidence = "Unknown";
  else if (positives === 0) evidence = "None";
  else if (positives === 1) evidence = "Low";
  else if (positives === 2) evidence = measured === 3 ? "Moderate-High" : "Moderate";
  else evidence = "High";

  return { amyloid, tau, neurodegeneration: nd, evidence };
}

const EVIDENCE_SCORE: Record<AtnResult["evidence"], number> = {
  None: 0,
  Low: 0.25,
  Moderate: 0.5,
  "Moderate-High": 0.7,
  High: 0.9,
  Unknown: 0.2,
};

export function estimateState(
  composite: number,
  atn: AtnResult,
  signals: MarkerSignal[],
  nModalities: number,
  spanDays: number,
  anchorScores: { moca?: number; mmse?: number },
): { state: "Normal" | "SCD" | "MCI" | "Dementia"; confidence: number } {
  // objective vs subjective split
  const objective = signals
    .filter((s) => s.modality === "clinical" || s.modality === "cognitive_task")
    .map((s) => s.deviation);
  const subjective = signals
    .filter((s) => s.modality === "questionnaire" || s.modality === "diary")
    .map((s) => s.deviation);
  const objMean = objective.length ? objective.reduce((a, b) => a + b, 0) / objective.length : null;
  const subjMean = subjective.length ? subjective.reduce((a, b) => a + b, 0) / subjective.length : null;

  let state: "Normal" | "SCD" | "MCI" | "Dementia";
  const frankImpairment =
    (anchorScores.moca != null && anchorScores.moca < 20) ||
    (anchorScores.mmse != null && anchorScores.mmse < 21);
  if (composite >= 0.82 && (objMean ?? 0) >= 2.4 && frankImpairment) state = "Dementia";
  else if (composite >= 0.62 || (objMean ?? 0) >= 1.5) state = "MCI";
  else if (composite >= 0.4 || (subjMean ?? 0) >= 1.0) state = "SCD";
  else state = "Normal";

  // strong subjective but clean objective → SCD, not MCI (the discordance signature)
  if (state === "MCI" && (objMean ?? 99) < 1.0 && (subjMean ?? 0) >= 1.2) state = "SCD";

  // confidence: modality coverage + signal agreement + biological corroboration + span
  const devs = signals.map((s) => s.deviation);
  const mean = devs.length ? devs.reduce((a, b) => a + b, 0) / devs.length : 0;
  const varc = devs.length ? devs.reduce((a, b) => a + (b - mean) ** 2, 0) / devs.length : 4;
  const agreement = clamp(1 - varc / 6, 0, 1);
  const coverage = clamp(nModalities / 6, 0, 1) * clamp(spanDays / 240, 0.4, 1);
  const bioBoost = atn.evidence === "Unknown" ? 0 : 0.08;
  const confidence = clamp(0.3 + 0.4 * coverage + 0.22 * agreement + bioBoost, 0.2, 0.94);
  return { state, confidence };
}

export function progressionRisk(opts: {
  composite: number;
  slopePerYear: number;
  atn: AtnResult;
  age: number;
  availableModalities: ModalityKey[];
  compositeSeriesLen: number;
  spanDays: number;
  baselineEstablished: boolean;
}): { risk: number | null; confidence: number | null; sufficiency: "sufficient" | "insufficient"; note: string } {
  const missing: string[] = [];
  const core = opts.availableModalities.filter((m) =>
    ["speech", "cognitive_task", "questionnaire", "clinical", "sleep", "diary"].includes(m),
  );
  if (core.length < 3) missing.push(`only ${core.length} of ≥3 required modalities present`);
  if (opts.spanDays < 120) missing.push(`longitudinal span ${Math.round(opts.spanDays)}d of ≥120d`);
  if (opts.compositeSeriesLen < 4) missing.push(`${opts.compositeSeriesLen} of ≥4 composite time points`);
  if (!opts.baselineEstablished) missing.push("personal baseline not established");

  if (missing.length) {
    return {
      risk: null,
      confidence: null,
      sufficiency: "insufficient",
      note: `Insufficient evidence for progression estimation, ${missing.join("; ")}.`,
    };
  }

  const z =
    -3.8 +
    2.2 * opts.composite +
    1.4 * clamp(opts.slopePerYear, -0.4, 0.6) +
    1.3 * EVIDENCE_SCORE[opts.atn.evidence] +
    0.02 * clamp(opts.age - 65, -10, 25);
  const risk = clamp(logistic(z), 0.02, 0.92);

  const imagingOrBio =
    opts.availableModalities.includes("imaging") || opts.availableModalities.includes("biomarker");
  const confidence = clamp(
    0.3 + 0.1 * core.length + (imagingOrBio ? 0.12 : 0) + 0.06 * Math.min(opts.compositeSeriesLen, 6) - 0.3,
    0.2,
    0.88,
  );
  return { risk, confidence, sufficiency: "sufficient", note: "" };
}

export function confidenceLabel(
  nModalities: number,
  seriesLen: number,
  stateConfidence: number,
  spanDays: number,
): "High" | "Moderate" | "Low" | "Insufficient data" {
  if (nModalities < 2 || seriesLen < 2) return "Insufficient data";
  const cov = clamp(nModalities / 6, 0, 1) * clamp(spanDays / 240, 0.35, 1);
  const score = 0.3 * cov + 0.25 * clamp(seriesLen / 8, 0, 1) + 0.45 * stateConfidence;
  if (score >= 0.74) return "High";
  if (score >= 0.5) return "Moderate";
  return "Low";
}
