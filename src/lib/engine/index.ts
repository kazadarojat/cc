import type { Patient } from "@prisma/client";
import { db } from "@/lib/db";
import { extractMarkers, type PatientBundle } from "./markers";
import {
  baselineWindow,
  compositeNow,
  compositeSeries,
  computeAtn,
  computeBaseline,
  computeSignals,
  confidenceLabel,
  estimateState,
  progressionRisk,
  trajectory,
} from "./compute";
import {
  buildAlerts,
  buildFactors,
  buildFeatureContributions,
  buildNarrative,
  buildRecommendations,
  detectChanges,
  detectDiscordance,
} from "./explain";
import { computeMissingData, computeModalityScores } from "./modality";
import {
  biologicalAdRiskBand,
  projection24m,
  reversibleContributors,
  stageProbabilities,
} from "./staging";
import { ALL_MODALITIES, type EngineResult, type ModalityKey } from "./types";

export const MODEL_VERSION = "cognicare-fusion-mvp-0.3";

const DAY = 24 * 60 * 60 * 1000;

export function analyzePatient(patient: Patient, bundle: PatientBundle): EngineResult {
  const points = extractMarkers(bundle);
  const now = points.at(-1)?.at ?? new Date();

  const win = baselineWindow(patient.enrolledAt, points);
  const baseline = computeBaseline(points, win);
  const baselineEstablished = baseline.length >= 3;

  const signals = computeSignals(points, baseline);
  const series = compositeSeries(points, baseline);
  const { index: composite, nModalities } = compositeNow(signals);
  const traj = trajectory(series);
  const atn = computeAtn(bundle);

  const availableModalities: ModalityKey[] = [];
  if (bundle.speech.length) availableModalities.push("speech");
  if (bundle.sleep.length) availableModalities.push("sleep");
  if (bundle.tasks.length) availableModalities.push("cognitive_task");
  if (bundle.questionnaires.length) availableModalities.push("questionnaire");
  if (bundle.diary.length) availableModalities.push("diary");
  if (bundle.behaviour.length && bundle.behaviourConsent) availableModalities.push("behavioral");
  if (bundle.clinical.some((c) => c.score != null)) availableModalities.push("clinical");
  if (bundle.biomarkers.length) availableModalities.push("biomarker");
  if (bundle.imagingStudies.length) availableModalities.push("imaging");
  const missingModalities = ALL_MODALITIES.filter((m) => !availableModalities.includes(m));

  const spanDays = points.length ? (now.getTime() - points[0].at.getTime()) / DAY : 0;

  const lastClinical = (instrument: string) =>
    bundle.clinical
      .filter((c) => c.instrument === instrument && c.score != null)
      .sort((a, b) => b.administeredAt.getTime() - a.administeredAt.getTime())[0]?.score ?? undefined;
  const { state, confidence: stateConfidence } = estimateState(composite, atn, signals, nModalities, spanDays, {
    moca: lastClinical("MoCA"),
    mmse: lastClinical("MMSE"),
  });

  const age = Math.floor((Date.now() - patient.dateOfBirth.getTime()) / (365.25 * DAY));
  const prog = progressionRisk({
    composite,
    slopePerYear: traj.slopePerYear,
    atn,
    age,
    availableModalities,
    compositeSeriesLen: series.length,
    spanDays,
    baselineEstablished,
  });

  // Neurosight-merged: per-modality cross-sectional scores + data-sufficiency
  const modalityScores = computeModalityScores(bundle);
  const missingData = computeMissingData(bundle);

  // fold Neurosight's confidence penalty into CogniCare's label
  let cLabel = confidenceLabel(nModalities, series.length, stateConfidence, spanDays);
  if (missingData.confidencePenaltyPercent >= 20 && cLabel === "High") cLabel = "Moderate";
  if (missingData.dataSufficiency === "Insufficient") cLabel = "Insufficient data";

  const changes = detectChanges(signals, now);
  const discordance = detectDiscordance(signals);

  let clinHistory: Record<string, unknown> = {};
  try {
    clinHistory = JSON.parse(patient.clinicalHistory);
  } catch {
    clinHistory = {};
  }
  const stageProbs = stageProbabilities(state, composite);
  const bioAdBand = biologicalAdRiskBand(atn.evidence);
  const revContribs = reversibleContributors(bundle, composite, clinHistory);

  const partial = {
    state,
    stateConfidence,
    trajectory: traj.label,
    progression: {
      risk: prog.risk,
      horizonMonths: 12,
      confidence: prog.confidence,
      sufficiency: prog.sufficiency,
      note: prog.note,
      probability24m: projection24m(prog.risk),
    },
    stageProbabilities: stageProbs,
    biologicalAdRiskBand: bioAdBand,
    reversibleContributors: revContribs,
    atn,
    compositeSeries: series,
    changes,
    confidenceLabel: cLabel,
    missingModalities,
    compositeIndex: composite,
    signals,
    discordance,
  };

  const factors = buildFactors(signals, partial);
  const featureContributions = buildFeatureContributions(signals, atn);
  const narrative = buildNarrative(patient.name, partial);
  const recommendations = buildRecommendations(partial);
  const recentAssessment = points.some((p) => now.getTime() - p.at.getTime() <= 30 * DAY);
  const alerts = buildAlerts(partial, recentAssessment);

  const inputRefs: Record<string, number> = {
    speech: bundle.speech.length,
    sleep: bundle.sleep.length,
    cognitive_task: bundle.tasks.length,
    questionnaire: bundle.questionnaires.length,
    diary: bundle.diary.length,
    clinical: bundle.clinical.length,
    biomarker: bundle.biomarkers.length,
    imaging: bundle.imagingStudies.length,
  };

  return {
    modelVersion: MODEL_VERSION,
    baselineVersion: 1,
    baselineWindow: win,
    compositeIndex: composite,
    compositeSeries: series,
    trajectory: traj.label,
    trajectorySlopePerYear: traj.slopePerYear,
    state,
    stateConfidence,
    atn,
    progression: partial.progression,
    stageProbabilities: stageProbs,
    biologicalAdRiskBand: bioAdBand,
    reversibleContributors: revContribs,
    featureContributions,
    confidenceLabel: cLabel,
    modalityScores,
    missingData,
    availableModalities,
    missingModalities,
    inputRefs,
    signals,
    changes,
    discordance,
    factors,
    narrative,
    recommendations,
    alerts,
  };
}

export async function loadBundle(patientId: string): Promise<PatientBundle> {
  const [speech, sleep, tasks, questionnaires, diary, clinical, biomarkers, imagingStudies, behaviour, behaviourGrant] =
    await Promise.all([
      db.speechSample.findMany({ where: { patientId }, orderBy: { capturedAt: "asc" } }),
      db.sleepNight.findMany({ where: { patientId }, orderBy: { night: "asc" } }),
      db.cognitiveTask.findMany({ where: { patientId }, orderBy: { takenAt: "asc" } }),
      db.questionnaire.findMany({ where: { patientId }, orderBy: { takenAt: "asc" } }),
      db.diaryEntry.findMany({ where: { patientId }, orderBy: { createdAt: "asc" } }),
      db.clinicalAssessment.findMany({ where: { patientId }, orderBy: { administeredAt: "asc" } }),
      db.biomarker.findMany({ where: { patientId }, orderBy: { drawnAt: "asc" } }),
      db.imaging.findMany({ where: { patientId }, orderBy: { acquiredAt: "asc" } }),
      db.behaviourDaily.findMany({ where: { patientId }, orderBy: { day: "asc" } }),
      db.consentGrant.findFirst({ where: { patientId, modality: "behavioral", withdrawnAt: null } }),
    ]);
  return {
    speech,
    sleep,
    tasks,
    questionnaires,
    diary,
    clinical,
    biomarkers,
    imagingStudies,
    behaviour,
    behaviourConsent: behaviourGrant != null,
  };
}

/** Run the engine and persist an immutable Inference plus its derived records. */
export async function runInference(patientId: string): Promise<string> {
  const patient = await db.patient.findUniqueOrThrow({ where: { id: patientId } });
  const bundle = await loadBundle(patientId);
  const r = analyzePatient(patient, bundle);

  const inference = await db.inference.create({
    data: {
      patientId,
      modelVersion: r.modelVersion,
      baselineVersion: r.baselineVersion,
      state: r.state,
      stateConfidence: r.stateConfidence,
      adEvidence: r.atn.evidence,
      adAmyloid: r.atn.amyloid,
      adTau: r.atn.tau,
      adNeurodegeneration: r.atn.neurodegeneration,
      progressionRisk: r.progression.risk,
      progressionHorizonMonths: r.progression.horizonMonths,
      progressionConfidence: r.progression.confidence,
      sufficiency: r.progression.sufficiency,
      sufficiencyNote: r.progression.note,
      trajectory: r.trajectory,
      compositeIndex: r.compositeIndex,
      confidenceLabel: r.confidenceLabel,
      availableModalities: JSON.stringify(r.availableModalities),
      missingModalities: JSON.stringify(r.missingModalities),
      inputRefs: JSON.stringify(r.inputRefs),
      modalityScores: JSON.stringify(r.modalityScores),
      dataSufficiency: r.missingData.dataSufficiency,
      confidencePenalty: r.missingData.confidencePenaltyPercent,
      missingDataNote: r.missingData.note,
      stageProbabilities: JSON.stringify(r.stageProbabilities),
      progressionRisk24m: r.progression.probability24m,
      biologicalAdRiskBand: r.biologicalAdRiskBand,
      reversibleContributors: JSON.stringify(r.reversibleContributors),
      featureContributions: JSON.stringify(r.featureContributions),
      signalSummary: JSON.stringify(
        r.signals
          .slice()
          .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))
          .slice(0, 16)
          .map((s) => ({
            label: s.label,
            modality: s.modality,
            baselineRaw: s.baselineRaw,
            recentRaw: s.recentRaw,
            relChange: s.relChange,
            deviation: s.deviation,
            direction: s.direction,
          })),
      ),
      explanation: {
        create: {
          factors: JSON.stringify(r.factors),
          narrative: r.narrative,
        },
      },
      recommendations: {
        create: r.recommendations.map((rec) => ({ category: rec.category, rationale: rec.rationale })),
      },
    },
  });

  const asOf = r.compositeSeries.at(-1)?.at ?? new Date();

  await db.changeEvent.deleteMany({ where: { patientId } });
  if (r.changes.length) {
    await db.changeEvent.createMany({
      data: r.changes.map((c) => ({
        patientId,
        detectedAt: asOf,
        feature: c.label,
        modality: c.modality,
        direction: c.direction,
        magnitude: c.magnitude,
      })),
    });
  }

  await db.discordanceFlag.deleteMany({ where: { patientId } });
  if (r.discordance) {
    await db.discordanceFlag.create({
      data: {
        patientId,
        detectedAt: asOf,
        description: r.discordance.description,
        modalities: JSON.stringify(r.discordance.modalities),
      },
    });
  }

  // refresh the open alert set for this patient
  await db.alert.deleteMany({ where: { patientId, readAt: null } });
  if (r.alerts.length) {
    await db.alert.createMany({
      data: r.alerts.map((a) => ({ patientId, tier: a.tier, title: a.title, body: a.body })),
    });
  }

  return inference.id;
}
