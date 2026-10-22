import type {
  SpeechSample,
  SleepNight,
  CognitiveTask,
  Questionnaire,
  DiaryEntry,
  ClinicalAssessment,
  Biomarker,
  Imaging,
  BehaviourDaily,
} from "@prisma/client";
import type { MarkerPoint, ModalityKey } from "./types";

export type PatientBundle = {
  speech: SpeechSample[];
  sleep: SleepNight[];
  tasks: CognitiveTask[];
  questionnaires: Questionnaire[];
  diary: DiaryEntry[];
  clinical: ClinicalAssessment[];
  biomarkers: Biomarker[];
  imagingStudies: Imaging[];
  behaviour: BehaviourDaily[];
  behaviourConsent: boolean;
};

type Def = {
  key: string;
  modality: ModalityKey;
  label: string;
  worseWhen: "higher" | "lower";
  /** typical raw scale, used to turn a raw delta into a relative change when baseline ~ 0 */
  scale: number;
  /** expected within-person measurement noise (raw units); floors the robust spread */
  noise: number;
};

export const MARKER_DEFS: Def[] = [
  // speech
  { key: "speech.pauseDuration", modality: "speech", label: "Speech pause duration", worseWhen: "higher", scale: 0.6, noise: 0.04 },
  { key: "speech.pauseFrequency", modality: "speech", label: "Pause frequency", worseWhen: "higher", scale: 8, noise: 0.7 },
  { key: "speech.hesitationRatio", modality: "speech", label: "Hesitation ratio", worseWhen: "higher", scale: 0.08, noise: 0.009 },
  { key: "speech.wordFindingDelay", modality: "speech", label: "Word-finding delay", worseWhen: "higher", scale: 0.5, noise: 0.04 },
  { key: "speech.lexicalDiversity", modality: "speech", label: "Lexical diversity", worseWhen: "lower", scale: 0.5, noise: 0.022 },
  { key: "speech.semanticRichness", modality: "speech", label: "Semantic richness", worseWhen: "lower", scale: 0.5, noise: 0.025 },
  { key: "speech.speechRate", modality: "speech", label: "Speech rate", worseWhen: "lower", scale: 130, noise: 4.5 },
  { key: "speech.syntacticComplexity", modality: "speech", label: "Sentence complexity", worseWhen: "lower", scale: 0.5, noise: 0.03 },
  // sleep
  { key: "sleep.efficiency", modality: "sleep", label: "Sleep efficiency", worseWhen: "lower", scale: 0.85, noise: 0.03 },
  { key: "sleep.fragmentationIndex", modality: "sleep", label: "Sleep fragmentation", worseWhen: "higher", scale: 2, noise: 0.35 },
  { key: "sleep.regularityIndex", modality: "sleep", label: "Sleep regularity", worseWhen: "lower", scale: 0.8, noise: 0.03 },
  { key: "sleep.awakenings", modality: "sleep", label: "Night awakenings", worseWhen: "higher", scale: 2, noise: 0.55 },
  // cognitive task
  { key: "task.abilityEstimate", modality: "cognitive_task", label: "Cognitive task ability", worseWhen: "lower", scale: 0.8, noise: 0.035 },
  { key: "task.delayedRecall", modality: "cognitive_task", label: "Delayed recall", worseWhen: "lower", scale: 0.8, noise: 0.05 },
  { key: "task.memory", modality: "cognitive_task", label: "Memory task", worseWhen: "lower", scale: 0.8, noise: 0.04 },
  { key: "task.attention", modality: "cognitive_task", label: "Attention task", worseWhen: "lower", scale: 0.8, noise: 0.04 },
  { key: "task.executive", modality: "cognitive_task", label: "Executive task", worseWhen: "lower", scale: 0.8, noise: 0.04 },
  { key: "task.fluency", modality: "cognitive_task", label: "Verbal fluency task", worseWhen: "lower", scale: 0.8, noise: 0.045 },
  // questionnaires (fraction of max)
  { key: "q.AD8", modality: "questionnaire", label: "AD8", worseWhen: "higher", scale: 0.25, noise: 0.06 },
  { key: "q.SCD-Q", modality: "questionnaire", label: "SCD-Q", worseWhen: "higher", scale: 0.3, noise: 0.05 },
  { key: "q.MCQ", modality: "questionnaire", label: "Memory Complaint Questionnaire", worseWhen: "higher", scale: 0.3, noise: 0.05 },
  // diary
  { key: "diary.load", modality: "diary", label: "Subjective complaint load", worseWhen: "higher", scale: 3, noise: 0.9 },
  { key: "diary.domainSpread", modality: "diary", label: "Complaint domain spread", worseWhen: "higher", scale: 3, noise: 0.9 },
  // digital behaviour (opt-in)
  { key: "behav.routineDisruption", modality: "behavioral", label: "Routine disruption index", worseWhen: "higher", scale: 40, noise: 4 },
  { key: "behav.onsetShift", modality: "behavioral", label: "Activity onset shift", worseWhen: "higher", scale: 60, noise: 8 },
  { key: "behav.screenLatency", modality: "behavioral", label: "Screen interaction latency", worseWhen: "higher", scale: 800, noise: 45 },
  { key: "behav.typingVariance", modality: "behavioral", label: "Typing latency variance", worseWhen: "higher", scale: 90, noise: 8 },
  // clinical
  { key: "clinical.MMSE", modality: "clinical", label: "MMSE", worseWhen: "lower", scale: 30, noise: 1.2 },
  { key: "clinical.MoCA", modality: "clinical", label: "MoCA", worseWhen: "lower", scale: 30, noise: 1.4 },
  // biomarkers (as multiple of upper reference limit, or ratio for Abeta)
  { key: "bio.p-tau217", modality: "biomarker", label: "Plasma p-tau217", worseWhen: "higher", scale: 1, noise: 0.06 },
  { key: "bio.p-tau181", modality: "biomarker", label: "Plasma p-tau181", worseWhen: "higher", scale: 1, noise: 0.06 },
  { key: "bio.NfL", modality: "biomarker", label: "Neurofilament light (NfL)", worseWhen: "higher", scale: 1, noise: 0.08 },
  { key: "bio.GFAP", modality: "biomarker", label: "GFAP", worseWhen: "higher", scale: 1, noise: 0.08 },
  { key: "bio.Abeta42-40", modality: "biomarker", label: "Aβ42/Aβ40 ratio", worseWhen: "lower", scale: 0.07, noise: 0.002 },
];

export const MARKER_LABEL: Record<string, string> = Object.fromEntries(
  MARKER_DEFS.map((d) => [d.key, d.label]),
);
export const MARKER_MODALITY: Record<string, ModalityKey> = Object.fromEntries(
  MARKER_DEFS.map((d) => [d.key, d.modality]),
);
export const MARKER_SCALE: Record<string, number> = Object.fromEntries(
  MARKER_DEFS.map((d) => [d.key, d.scale]),
);
export const MARKER_NOISE: Record<string, number> = Object.fromEntries(
  MARKER_DEFS.map((d) => [d.key, d.noise]),
);

function orient(worseWhen: "higher" | "lower", v: number): number {
  return worseWhen === "higher" ? v : -v;
}

function push(out: MarkerPoint[], key: string, at: Date, raw: number) {
  const def = MARKER_DEFS.find((d) => d.key === key)!;
  out.push({ markerKey: key, modality: def.modality, at, raw, oriented: orient(def.worseWhen, raw) });
}

/** Turn a patient's records into an oriented time series of marker points. */
export function extractMarkers(b: PatientBundle): MarkerPoint[] {
  const out: MarkerPoint[] = [];

  for (const s of b.speech) {
    push(out, "speech.pauseDuration", s.capturedAt, s.pauseDuration);
    push(out, "speech.pauseFrequency", s.capturedAt, s.pauseFrequency);
    push(out, "speech.hesitationRatio", s.capturedAt, s.hesitationRatio);
    push(out, "speech.wordFindingDelay", s.capturedAt, s.wordFindingDelay);
    push(out, "speech.lexicalDiversity", s.capturedAt, s.lexicalDiversity);
    push(out, "speech.semanticRichness", s.capturedAt, s.semanticRichness);
    push(out, "speech.speechRate", s.capturedAt, s.speechRate);
    push(out, "speech.syntacticComplexity", s.capturedAt, s.syntacticComplexity);
  }
  for (const n of b.sleep) {
    push(out, "sleep.efficiency", n.night, n.efficiency);
    push(out, "sleep.fragmentationIndex", n.night, n.fragmentationIndex);
    push(out, "sleep.regularityIndex", n.night, n.regularityIndex);
    push(out, "sleep.awakenings", n.night, n.awakenings);
  }
  for (const t of b.tasks) {
    push(out, "task.abilityEstimate", t.takenAt, t.abilityEstimate);
    push(out, "task.delayedRecall", t.takenAt, t.delayedRecall);
    push(out, "task.memory", t.takenAt, t.memory);
    push(out, "task.attention", t.takenAt, t.attention);
    push(out, "task.executive", t.takenAt, t.executive);
    push(out, "task.fluency", t.takenAt, t.fluency);
  }
  for (const q of b.questionnaires) {
    const key = `q.${q.instrument}`;
    if (MARKER_DEFS.some((d) => d.key === key)) {
      push(out, key, q.takenAt, q.maxScore > 0 ? q.score / q.maxScore : q.score);
    }
  }
  // diary: aggregate to a monthly complaint load + domain spread
  if (b.diary.length) {
    const byMonth = new Map<string, DiaryEntry[]>();
    for (const e of b.diary) {
      const k = `${e.createdAt.getFullYear()}-${e.createdAt.getMonth()}`;
      if (!byMonth.has(k)) byMonth.set(k, []);
      byMonth.get(k)!.push(e);
    }
    for (const entries of byMonth.values()) {
      const at = entries[Math.floor(entries.length / 2)].createdAt;
      const domains = new Set<string>();
      for (const e of entries) {
        try {
          for (const d of JSON.parse(e.domains) as string[]) domains.add(d);
        } catch {
          /* ignore */
        }
      }
      push(out, "diary.load", at, entries.length);
      push(out, "diary.domainSpread", at, domains.size);
    }
  }
  for (const c of b.clinical) {
    if (c.instrument === "MMSE" && c.score != null) push(out, "clinical.MMSE", c.administeredAt, c.score);
    if (c.instrument === "MoCA" && c.score != null) push(out, "clinical.MoCA", c.administeredAt, c.score);
  }
  for (const m of b.biomarkers) {
    const key = `bio.${m.analyte}`;
    if (!MARKER_DEFS.some((d) => d.key === key)) continue;
    if (m.analyte === "Abeta42-40") {
      push(out, key, m.drawnAt, m.value);
    } else {
      // express as multiple of the upper reference limit
      const denom = m.refHigh && m.refHigh > 0 ? m.refHigh : m.value || 1;
      push(out, key, m.drawnAt, m.value / denom);
    }
  }
  // digital behaviour: only when the opt-in consent is active
  if (b.behaviourConsent) {
    for (const d of b.behaviour) {
      push(out, "behav.routineDisruption", d.day, d.routineDisruptionIndex);
      push(out, "behav.onsetShift", d.day, d.activityOnsetShiftMin);
      push(out, "behav.screenLatency", d.day, d.screenInteractionLatencyMs);
      push(out, "behav.typingVariance", d.day, d.typingLatencyVarianceMs);
    }
  }

  out.sort((a, b2) => a.at.getTime() - b2.at.getTime());
  return out;
}
