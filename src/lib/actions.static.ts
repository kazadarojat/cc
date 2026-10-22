/**
 * Client-side stand-in for the server actions, used only by the static
 * export (`next.config.export.mjs` aliases "@/lib/actions" and
 * "@/lib/admin-actions" here when NEXT_PUBLIC_STATIC_EXPORT=1).
 *
 * GitHub Pages has no server, so writes are journalled into localStorage
 * instead of SQLite. Reads still come from the prerendered build data.
 * Signatures mirror the real actions so the UI keeps compiling unchanged.
 */

export type NeuroCheckInput = {
  recallScore: number;
  recallAccuracy: number;
  attentionScore: number;
  digitSpanMax: number;
  executiveScore: number;
  reactionTimeMs: number;
  stroopInhibition: number;
  trailSeconds: number;
  visualScanningScore: number;
  fluencyCount: number;
  fluencyWords: string[];
  neuroScore: number;
};

export type ScenarioOverrides = {
  mocaDelta?: number;
  ptau217Mult?: number;
  pauseDurationMult?: number;
  sleepFragMult?: number;
  ad8Delta?: number;
};

export type ScenarioResult = {
  state: string;
  stateConfidence: number;
  trajectory: string;
  compositeIndex: number;
  progressionRisk: number | null;
  progressionRisk24m: number | null;
  biologicalAdRiskBand: string;
};

const KEY = "cognicare.static.journal";

type Entry = { kind: string; at: string; payload: Record<string, unknown> };

function journal(kind: string, payload: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KEY);
    const list: Entry[] = raw ? JSON.parse(raw) : [];
    list.push({ kind, at: new Date().toISOString(), payload });
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(-300)));
    window.dispatchEvent(new CustomEvent("cognicare:journal", { detail: { kind } }));
  } catch {
    /* storage disabled — demo continues without persistence */
  }
}

const formToObject = (fd: FormData): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  fd.forEach((value, key) => {
    out[key] = typeof value === "string" ? value : `[file ${(value as File).name}]`;
  });
  return out;
};

const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// ---- patient-side --------------------------------------------------------

export async function submitQuestionnaire(patientId: string, formData: FormData) {
  journal("questionnaire", { patientId, ...formToObject(formData) });
}

export async function submitCognitiveTask(patientId: string, scores: Record<string, number>) {
  journal("cognitiveTask", { patientId, scores });
}

export async function submitNeuroCheck(patientId: string, input: NeuroCheckInput) {
  journal("neurocheck", { patientId, ...input });
}

export async function submitDiary(patientId: string, formData: FormData) {
  journal("diary", { patientId, ...formToObject(formData) });
}

export async function simulateBehaviourWeek(patientId: string) {
  journal("behaviourWeek", { patientId });
}

export async function submitSpeechSample(
  patientId: string,
  task: string,
  quality: "clear" | "noisy",
) {
  journal("speech", { patientId, task, quality });
}

export async function updateConsent(patientId: string, modality: string, grant: boolean) {
  journal("consent", { patientId, modality, grant });
}

export async function addClinicalAssessment(patientId: string, formData: FormData) {
  journal("clinicalAssessment", { patientId, ...formToObject(formData) });
}

export async function addBiomarker(patientId: string, formData: FormData) {
  journal("biomarker", { patientId, ...formToObject(formData) });
}

export async function addImaging(patientId: string, formData: FormData) {
  journal("imaging", { patientId, ...formToObject(formData) });
}

export async function rerunInference(patientId: string) {
  journal("rerunInference", { patientId });
}

export async function acknowledgeAlert(alertId: string, patientId: string) {
  journal("acknowledgeAlert", { alertId, patientId });
}

// ---- clinician admin -----------------------------------------------------

export async function createPatient(formData: FormData): Promise<string> {
  const id = uid("pat");
  journal("createPatient", { id, ...formToObject(formData) });
  return id;
}

export async function updatePatient(patientId: string, formData: FormData) {
  journal("updatePatient", { patientId, ...formToObject(formData) });
}

export async function deletePatient(patientId: string) {
  journal("deletePatient", { patientId });
}

export async function createClinician(formData: FormData): Promise<string> {
  const id = uid("cli");
  journal("createClinician", { id, ...formToObject(formData) });
  return id;
}

export async function updateClinician(id: string, formData: FormData) {
  journal("updateClinician", { id, ...formToObject(formData) });
}

export async function deleteClinician(id: string) {
  journal("deleteClinician", { id });
}

export async function wipeAllPatients() {
  journal("wipeAllPatients", {});
}

export async function loadSamplePatient(): Promise<string> {
  journal("loadSamplePatient", {});
  const el = typeof document !== "undefined" ? document.querySelector("[data-demo-patient]") : null;
  return el?.getAttribute("data-demo-patient") ?? "";
}

export async function simulateScenario(
  patientId: string,
  ov: Record<string, number | undefined>,
): Promise<{
  state: string;
  stateConfidence: number;
  trajectory: string;
  compositeIndex: number;
  progressionRisk: number | null;
  progressionRisk24m: number | null;
  biologicalAdRiskBand: string;
}> {
  journal("simulateScenario", { patientId, ov });
  const moca = ov.mocaDelta ?? 0;
  const ptau = ov.ptau217Mult ?? 1;
  const composite = Math.max(0, Math.min(100, 72 - moca * 4 - (ptau - 1) * 18));
  const risk = Math.max(0, Math.min(100, 55 - moca * 5 + (ptau - 1) * 22));
  const band = ptau >= 1.6 ? "high" : ptau >= 1.25 ? "intermediate" : "low";
  return {
    state: moca <= -3 ? "Mild cognitive impairment" : moca <= -1 ? "Subtle decline" : "Cognitively stable",
    stateConfidence: 0.62 + Math.min(0.3, Math.abs(moca) * 0.05),
    trajectory: moca < 0 ? "Declining" : "Stable",
    compositeIndex: Math.round(composite),
    progressionRisk: Math.round(risk),
    progressionRisk24m: Math.round(Math.min(100, risk * 1.25)),
    biologicalAdRiskBand: band,
  };
}
