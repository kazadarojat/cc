export type ModalityKey =
  | "speech"
  | "sleep"
  | "cognitive_task"
  | "questionnaire"
  | "diary"
  | "behavioral"
  | "clinical"
  | "biomarker"
  | "imaging";

export type Direction = "up" | "down";

/** A single measured feature at a point in time, already oriented so higher = more impairment signal. */
export type MarkerPoint = {
  markerKey: string;
  modality: ModalityKey;
  at: Date;
  /** raw value as stored (for display) */
  raw: number;
  /** value oriented so that higher = worse */
  oriented: number;
};

export type BaselineStat = {
  markerKey: string;
  modality: ModalityKey;
  median: number; // of oriented values in the baseline window
  medianRaw: number; // of raw (as-stored) values in the baseline window
  mad: number; // median absolute deviation (robust spread) of oriented values, floored
  n: number;
};

export type MarkerSignal = {
  markerKey: string;
  modality: ModalityKey;
  label: string;
  baselineMedian: number;
  recentMedian: number;
  baselineRaw: number;
  recentRaw: number;
  /** robust z: (recent - baseline) / (1.4826 * mad); positive = worse */
  deviation: number;
  /** relative change of the raw value vs baseline, as a fraction */
  relChange: number;
  direction: Direction;
  nRecent: number;
};

export type CompositePoint = { at: Date; value: number; nModalities: number };

export type EngineResult = {
  modelVersion: string;
  baselineVersion: number;
  baselineWindow: { start: Date; end: Date };
  compositeIndex: number;
  compositeSeries: CompositePoint[];
  trajectory: "Stable" | "Improving" | "Changing" | "Worsening" | "Uncertain";
  trajectorySlopePerYear: number;
  state: "Normal" | "SCD" | "MCI" | "Dementia";
  stateConfidence: number;
  atn: {
    amyloid: "positive" | "negative" | "unknown";
    tau: "positive" | "negative" | "unknown";
    neurodegeneration: "positive" | "negative" | "unknown";
    evidence: "None" | "Low" | "Moderate" | "Moderate-High" | "High" | "Unknown";
  };
  progression: {
    risk: number | null;
    horizonMonths: number;
    confidence: number | null;
    sufficiency: "sufficient" | "insufficient";
    note: string;
    /** Neurosight-merged: 24-month projection, only when the 12-month risk is not gated. */
    probability24m: number | null;
  };
  /** Neurosight-merged: 4-way stage probability band (sums to ~100). */
  stageProbabilities: import("./staging").StageProbabilities;
  /** Neurosight-merged: biological-AD risk collapsed to a Low/Moderate/High band. */
  biologicalAdRiskBand: import("./staging").BioAdRiskBand;
  /** Neurosight-merged: reversible-contributors checklist. */
  reversibleContributors: import("./staging").ReversibleContributor[];
  /** SHAP-style feature contribution breakdown. */
  featureContributions: import("./explain").FeatureContribution[];
  confidenceLabel: "High" | "Moderate" | "Low" | "Insufficient data";
  /** Neurosight-merged: cross-sectional 0..100 risk per modality (null = absent). */
  modalityScores: import("./modality").ModalityScores;
  /** Neurosight-merged: data-sufficiency assessment feeding the confidence label. */
  missingData: import("./modality").MissingDataStatus;
  availableModalities: ModalityKey[];
  missingModalities: ModalityKey[];
  inputRefs: Record<string, number>;
  signals: MarkerSignal[];
  changes: {
    markerKey: string;
    modality: ModalityKey;
    label: string;
    direction: Direction;
    magnitude: number;
    deviation: number;
    at: Date;
  }[];
  discordance: { description: string; modalities: ModalityKey[] } | null;
  factors: {
    label: string;
    modality: ModalityKey | "engine";
    direction: Direction | "none";
    weight: number; // share of explained movement, 0..1
    evidenceType: "observed" | "inferred" | "recommendation";
    detail: string;
  }[];
  narrative: string;
  recommendations: { category: string; rationale: string }[];
  alerts: { tier: string; title: string; body: string }[];
};

export const ALL_MODALITIES: ModalityKey[] = [
  "speech",
  "sleep",
  "cognitive_task",
  "questionnaire",
  "diary",
  "behavioral",
  "clinical",
  "biomarker",
  "imaging",
];

/** Fusion weight per modality (renormalised over what is actually available). */
export const MODALITY_WEIGHT: Record<ModalityKey, number> = {
  clinical: 0.24,
  cognitive_task: 0.2,
  speech: 0.18,
  questionnaire: 0.15,
  biomarker: 0.12,
  sleep: 0.07,
  diary: 0.04,
  behavioral: 0.06, // opt-in digital behavioural biomarkers
  imaging: 0.0, // imaging feeds AT(N) rather than the composite in this prototype
};
