"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { runInference } from "@/lib/engine";
import { classifyDiary } from "@/lib/nlp";
import { getSession } from "@/lib/session";

async function assertAccess(patientId: string) {
  const s = await getSession();
  if (!s) throw new Error("not signed in");
  if (s.role === "patient" && s.subjectId !== patientId) throw new Error("forbidden");
  return s;
}

function revalidatePatient(patientId: string) {
  revalidatePath("/clinician");
  revalidatePath(`/clinician/patients/${patientId}`, "layout");
  revalidatePath("/patient", "layout");
}

// ---- patient-side --------------------------------------------------------

export async function submitQuestionnaire(patientId: string, formData: FormData) {
  await assertAccess(patientId);
  const instrument = String(formData.get("instrument"));
  const score = Number(formData.get("score"));
  const maxScore = Number(formData.get("maxScore"));
  if (!instrument || Number.isNaN(score)) throw new Error("bad input");
  await db.questionnaire.create({
    data: {
      patientId,
      instrument,
      takenAt: new Date(),
      score,
      maxScore,
      respondent: instrument === "AD8" ? "informant" : "patient",
    },
  });
  await runInference(patientId);
  revalidatePatient(patientId);
}

export async function submitCognitiveTask(patientId: string, scores: Record<string, number>) {
  await assertAccess(patientId);
  const g = (k: string) => Math.max(0, Math.min(1, scores[k] ?? 0.7));
  const domains = ["memory", "delayedRecall", "attention", "orientation", "fluency", "executive"];
  const ability = domains.reduce((a, k) => a + g(k), 0) / domains.length;
  await db.cognitiveTask.create({
    data: {
      patientId,
      takenAt: new Date(),
      memory: g("memory"),
      delayedRecall: g("delayedRecall"),
      attention: g("attention"),
      orientation: g("orientation"),
      fluency: g("fluency"),
      executive: g("executive"),
      abilityEstimate: ability,
    },
  });
  await runInference(patientId);
  revalidatePatient(patientId);
}

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

export async function submitNeuroCheck(patientId: string, r: NeuroCheckInput) {
  await assertAccess(patientId);
  const g = (x: number) => Math.max(0, Math.min(1, x));
  const exec = g(((r.executiveScore + r.visualScanningScore) / 2) / 5);
  await db.cognitiveTask.create({
    data: {
      patientId,
      takenAt: new Date(),
      memory: g(r.recallScore / 5),
      delayedRecall: g(r.recallScore / 5),
      attention: g(r.attentionScore / 5),
      orientation: 0.95,
      fluency: g(Math.min(r.fluencyCount, 20) / 20),
      executive: exec,
      abilityEstimate: g(r.neuroScore / 100),
      source: "neurocheck",
      neuroScore: r.neuroScore,
      digitSpanMax: r.digitSpanMax,
      reactionTimeMs: r.reactionTimeMs,
      stroopInhibition: r.stroopInhibition,
      trailSeconds: r.trailSeconds,
      fluencyWords: JSON.stringify(r.fluencyWords ?? []),
    },
  });
  await runInference(patientId);
  revalidatePatient(patientId);
}

export async function submitDiary(patientId: string, formData: FormData) {
  await assertAccess(patientId);
  const text = String(formData.get("text") ?? "").trim();
  if (text.length < 3) throw new Error("empty");
  const severityRaw = String(formData.get("severity") ?? "mild");
  const severity = ["mild", "moderate", "significant"].includes(severityRaw) ? severityRaw : "mild";
  const context = String(formData.get("context") ?? "").trim().slice(0, 120);
  await db.diaryEntry.create({
    data: {
      patientId,
      createdAt: new Date(),
      text,
      domains: JSON.stringify(classifyDiary(text)),
      severity,
      context,
    },
  });
  await runInference(patientId);
  revalidatePatient(patientId);
}

/** Simulated passive behavioural data — patterns only, generated around the
 *  patient's recent profile and flagged as simulated. Opt-in (behavioural consent). */
export async function simulateBehaviourWeek(patientId: string) {
  await assertAccess(patientId);
  const grant = await db.consentGrant.findFirst({
    where: { patientId, modality: "behavioral", withdrawnAt: null },
  });
  if (!grant) throw new Error("behavioural consent not granted");
  const recent = await db.behaviourDaily.findFirst({
    where: { patientId },
    orderBy: { day: "desc" },
  });
  const base = recent ?? {
    routineDisruptionIndex: 18,
    activityOnsetShiftMin: 10,
    typingSpeedCpm: 160,
    typingLatencyVarianceMs: 42,
    screenInteractionLatencyMs: 620,
    mobilityRadiusKm: 4,
  };
  const j = (v: number, amp: number) => Math.max(0, v + (Math.random() - 0.5) * 2 * amp);
  const start = recent ? new Date(recent.day.getTime() + 86400000) : new Date(Date.now() - 7 * 86400000);
  for (let i = 0; i < 7; i++) {
    await db.behaviourDaily.create({
      data: {
        patientId,
        day: new Date(start.getTime() + i * 86400000),
        simulated: true,
        routineDisruptionIndex: Math.min(100, j(base.routineDisruptionIndex, 4)),
        activityOnsetShiftMin: j(base.activityOnsetShiftMin, 6),
        typingSpeedCpm: j(base.typingSpeedCpm, 8),
        typingLatencyVarianceMs: j(base.typingLatencyVarianceMs, 6),
        screenInteractionLatencyMs: j(base.screenInteractionLatencyMs, 40),
        mobilityRadiusKm: j(base.mobilityRadiusKm, 0.4),
      },
    });
  }
  await runInference(patientId);
  revalidatePatient(patientId);
}

/** Simulated speech capture — no audio is processed; plausible feature values are
 *  generated around the patient's recent profile and clearly flagged as simulated. */
export async function submitSpeechSample(patientId: string, task: string, quality: "clear" | "noisy") {
  await assertAccess(patientId);
  const recent = await db.speechSample.findFirst({
    where: { patientId },
    orderBy: { capturedAt: "desc" },
  });
  const base = recent ?? {
    speechRate: 128,
    articulationRate: 4.5,
    pauseDuration: 0.46,
    pauseFrequency: 6.6,
    hesitationRatio: 0.06,
    lexicalDiversity: 0.69,
    semanticRichness: 0.67,
    wordFindingDelay: 0.4,
    syntacticComplexity: 0.63,
  };
  const j = (v: number, amp: number) => v + (Math.random() - 0.5) * 2 * amp * (quality === "noisy" ? 1.8 : 1);
  await db.speechSample.create({
    data: {
      patientId,
      task,
      capturedAt: new Date(),
      simulated: true,
      speechRate: j(base.speechRate, 4),
      articulationRate: j(base.articulationRate, 0.15),
      pauseDuration: Math.max(0.1, j(base.pauseDuration, 0.03)),
      pauseFrequency: Math.max(0, j(base.pauseFrequency, 0.4)),
      hesitationRatio: Math.max(0, j(base.hesitationRatio, 0.008)),
      lexicalDiversity: Math.max(0, Math.min(1, j(base.lexicalDiversity, 0.02))),
      semanticRichness: Math.max(0, Math.min(1, j(base.semanticRichness, 0.02))),
      wordFindingDelay: Math.max(0, j(base.wordFindingDelay, 0.03)),
      syntacticComplexity: Math.max(0, Math.min(1, j(base.syntacticComplexity, 0.02))),
    },
  });
  await runInference(patientId);
  revalidatePatient(patientId);
}

export async function updateConsent(patientId: string, modality: string, grant: boolean) {
  await assertAccess(patientId);
  const existing = await db.consentGrant.findFirst({
    where: { patientId, modality, withdrawnAt: null },
    orderBy: { grantedAt: "desc" },
  });
  let changed = false;
  if (grant && !existing) {
    await db.consentGrant.create({
      data: { patientId, modality, purpose: modality === "research" ? "research" : "care" },
    });
    changed = true;
  } else if (!grant && existing) {
    await db.consentGrant.update({ where: { id: existing.id }, data: { withdrawnAt: new Date() } });
    changed = true;
  }
  // toggling behavioural consent adds/removes a modality from the analysis
  if (changed && modality === "behavioral") await runInference(patientId);
  revalidatePatient(patientId);
}

// ---- clinician-side -----------------------------------------------------

export async function addClinicalAssessment(patientId: string, formData: FormData) {
  const s = await assertAccess(patientId);
  if (s.role !== "clinician") throw new Error("clinician only");
  const instrument = String(formData.get("instrument"));
  const by = s.name;
  if (instrument === "note") {
    const noteText = String(formData.get("noteText") ?? "").trim();
    if (!noteText) throw new Error("empty note");
    await db.clinicalAssessment.create({
      data: { patientId, instrument: "note", administeredAt: new Date(), administeredBy: by, noteText },
    });
  } else {
    const score = Number(formData.get("score"));
    if (Number.isNaN(score)) throw new Error("bad score");
    await db.clinicalAssessment.create({
      data: {
        patientId,
        instrument,
        administeredAt: new Date(),
        administeredBy: by,
        score,
        maxScore: 30,
      },
    });
  }
  await runInference(patientId);
  revalidatePatient(patientId);
}

export async function addBiomarker(patientId: string, formData: FormData) {
  const s = await assertAccess(patientId);
  if (s.role !== "clinician") throw new Error("clinician only");
  const analyte = String(formData.get("analyte"));
  const value = Number(formData.get("value"));
  const unit = String(formData.get("unit") ?? "");
  const refLow = formData.get("refLow") ? Number(formData.get("refLow")) : null;
  const refHigh = formData.get("refHigh") ? Number(formData.get("refHigh")) : null;
  if (!analyte || Number.isNaN(value)) throw new Error("bad input");
  await db.biomarker.create({
    data: { patientId, drawnAt: new Date(), analyte, value, unit, refLow, refHigh, assay: "manual entry" },
  });
  await runInference(patientId);
  revalidatePatient(patientId);
}

export async function addImaging(patientId: string, formData: FormData) {
  const s = await assertAccess(patientId);
  if (s.role !== "clinician") throw new Error("clinician only");
  const modality = String(formData.get("modality"));
  const report = String(formData.get("report") ?? "").trim();
  if (!modality || !report) throw new Error("bad input");
  await db.imaging.create({
    data: { patientId, acquiredAt: new Date(), modality, report, findings: "{}" },
  });
  await runInference(patientId);
  revalidatePatient(patientId);
}

export async function rerunInference(patientId: string) {
  await assertAccess(patientId);
  await runInference(patientId);
  revalidatePatient(patientId);
}

export async function acknowledgeAlert(alertId: string, patientId: string) {
  const s = await assertAccess(patientId);
  if (s.role !== "clinician") throw new Error("clinician only");
  await db.alert.update({ where: { id: alertId }, data: { readAt: new Date() } });
  revalidatePatient(patientId);
}
