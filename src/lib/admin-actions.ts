"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { analyzePatient, loadBundle, runInference } from "@/lib/engine";
import { getSession } from "@/lib/session";

async function assertClinician() {
  const s = await getSession();
  if (!s || s.role !== "clinician") throw new Error("clinician only");
  return s;
}

function splitList(v: FormDataEntryValue | null): string[] {
  return String(v ?? "")
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function mrn() {
  return "MR-" + Math.random().toString(36).slice(2, 7).toUpperCase();
}

// ---- patient CRUD ------------------------------------------------------

export async function createPatient(formData: FormData): Promise<string> {
  await assertClinician();
  const name = String(formData.get("name") ?? "").trim();
  const dob = String(formData.get("dateOfBirth") ?? "");
  const sex = String(formData.get("sex") ?? "F");
  if (!name || !dob) throw new Error("name and date of birth are required");
  const clinicalHistory = {
    comorbidities: splitList(formData.get("comorbidities")),
    familyHistory: splitList(formData.get("familyHistory")),
    medications: splitList(formData.get("medications")),
    vascularRisk: String(formData.get("vascularRisk") ?? "low"),
    functionalStatus: String(formData.get("functionalStatus") ?? "").trim() || "independent",
  };
  const p = await db.patient.create({
    data: {
      name,
      dateOfBirth: new Date(dob),
      sex,
      medicalRecordNumber: mrn(),
      phone: String(formData.get("phone") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      assignedDoctorId: String(formData.get("assignedDoctorId") ?? "") || null,
      monitoringStatus: "baseline_forming",
      clinicalHistory: JSON.stringify(clinicalHistory),
      cohortNote: String(formData.get("cohortNote") ?? "").trim(),
      consentGrants: {
        create: ["speech", "sleep", "questionnaire", "cognitive_task", "diary", "clinical"].map((m) => ({
          modality: m,
          purpose: "care",
        })),
      },
    },
  });
  const moca = Number(formData.get("baselineMoca"));
  if (!Number.isNaN(moca) && moca > 0) {
    await db.clinicalAssessment.create({
      data: {
        patientId: p.id,
        instrument: "MoCA",
        administeredAt: new Date(),
        administeredBy: "registration",
        score: moca,
        maxScore: 30,
      },
    });
  }
  await runInference(p.id).catch(() => {});
  revalidatePath("/clinician");
  return p.id;
}

export async function updatePatient(patientId: string, formData: FormData) {
  await assertClinician();
  const clinicalHistory = {
    comorbidities: splitList(formData.get("comorbidities")),
    familyHistory: splitList(formData.get("familyHistory")),
    medications: splitList(formData.get("medications")),
    vascularRisk: String(formData.get("vascularRisk") ?? "low"),
    functionalStatus: String(formData.get("functionalStatus") ?? "").trim() || "independent",
  };
  await db.patient.update({
    where: { id: patientId },
    data: {
      name: String(formData.get("name") ?? "").trim(),
      sex: String(formData.get("sex") ?? "F"),
      phone: String(formData.get("phone") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      monitoringStatus: String(formData.get("monitoringStatus") ?? "active"),
      assignedDoctorId: String(formData.get("assignedDoctorId") ?? "") || null,
      cohortNote: String(formData.get("cohortNote") ?? "").trim(),
      clinicalHistory: JSON.stringify(clinicalHistory),
    },
  });
  revalidatePath("/clinician");
  revalidatePath(`/clinician/patients/${patientId}`, "layout");
}

export async function deletePatient(patientId: string) {
  await assertClinician();
  await db.patient.delete({ where: { id: patientId } });
  revalidatePath("/clinician");
}

// ---- clinician CRUD --------------------------------------------------

export async function createClinician(formData: FormData): Promise<string> {
  await assertClinician();
  const c = await db.clinician.create({
    data: {
      name: String(formData.get("name") ?? "").trim(),
      role: String(formData.get("role") ?? "memory_clinic"),
      email: String(formData.get("email") ?? "").trim() || `dr${Date.now()}@clinic.id`,
      title: String(formData.get("title") ?? "").trim(),
      sipNumber: String(formData.get("sipNumber") ?? "").trim(),
      institution: String(formData.get("institution") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
    },
  });
  revalidatePath("/clinician/clinicians");
  return c.id;
}

export async function updateClinician(id: string, formData: FormData) {
  await assertClinician();
  await db.clinician.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? "").trim(),
      role: String(formData.get("role") ?? "memory_clinic"),
      title: String(formData.get("title") ?? "").trim(),
      sipNumber: String(formData.get("sipNumber") ?? "").trim(),
      institution: String(formData.get("institution") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
    },
  });
  revalidatePath("/clinician/clinicians");
}

export async function deleteClinician(id: string) {
  await assertClinician();
  await db.clinician.delete({ where: { id } });
  revalidatePath("/clinician/clinicians");
}

// ---- progression / multimodal simulator ----------------------------

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

export async function simulateScenario(
  patientId: string,
  ov: ScenarioOverrides,
): Promise<ScenarioResult> {
  await assertClinician();
  const patient = await db.patient.findUniqueOrThrow({ where: { id: patientId } });
  const bundle = await loadBundle(patientId);

  const clone = <T,>(x: T[]): T[] => x.map((r) => ({ ...(r as object) }) as T);
  const b = {
    ...bundle,
    speech: clone(bundle.speech),
    sleep: clone(bundle.sleep),
    clinical: clone(bundle.clinical),
    biomarkers: clone(bundle.biomarkers),
    questionnaires: clone(bundle.questionnaires),
  };
  const latestOf = <T,>(arr: T[], key: keyof T, pred: (r: T) => boolean): T | undefined =>
    arr.filter(pred).sort((a, c) => +new Date(c[key] as never) - +new Date(a[key] as never))[0];

  if (ov.mocaDelta) {
    const mo = latestOf(b.clinical, "administeredAt", (c) => c.instrument === "MoCA" && c.score != null);
    if (mo && mo.score != null) mo.score = Math.max(0, Math.min(30, mo.score + ov.mocaDelta));
  }
  if (ov.ptau217Mult) {
    const bio = latestOf(b.biomarkers, "drawnAt", (x) => x.analyte === "p-tau217");
    if (bio) bio.value = bio.value * ov.ptau217Mult;
  }
  if (ov.pauseDurationMult) {
    const s = latestOf(b.speech, "capturedAt", () => true);
    if (s) s.pauseDuration = s.pauseDuration * ov.pauseDurationMult;
  }
  if (ov.sleepFragMult) {
    const s = latestOf(b.sleep, "night", () => true);
    if (s) s.fragmentationIndex = s.fragmentationIndex * ov.sleepFragMult;
  }
  if (ov.ad8Delta) {
    const q = latestOf(b.questionnaires, "takenAt", (x) => x.instrument === "AD8");
    if (q) q.score = Math.max(0, Math.min(q.maxScore, q.score + ov.ad8Delta));
  }

  const r = analyzePatient(patient, b);
  return {
    state: r.state,
    stateConfidence: r.stateConfidence,
    trajectory: r.trajectory,
    compositeIndex: r.compositeIndex,
    progressionRisk: r.progression.risk,
    progressionRisk24m: r.progression.probability24m,
    biologicalAdRiskBand: r.biologicalAdRiskBand,
  };
}

// ---- data management -------------------------------------------------

export async function wipeAllPatients() {
  await assertClinician();
  await db.patient.deleteMany({});
  revalidatePath("/clinician");
  revalidatePath("/clinician/admin");
}

export async function loadSamplePatient(): Promise<string> {
  await assertClinician();
  const doc = await db.clinician.findFirst();
  const dob = new Date();
  dob.setFullYear(dob.getFullYear() - 68);
  const p = await db.patient.create({
    data: {
      name: "Sample Patient",
      dateOfBirth: dob,
      sex: "F",
      medicalRecordNumber: mrn(),
      monitoringStatus: "baseline_forming",
      assignedDoctorId: doc?.id ?? null,
      clinicalHistory: JSON.stringify({
        comorbidities: ["hypertension (treated)"],
        familyHistory: [],
        medications: ["amlodipine 5 mg"],
        vascularRisk: "moderate",
        functionalStatus: "independent",
      }),
      cohortNote: "Sample record loaded from data management.",
      consentGrants: {
        create: ["speech", "sleep", "questionnaire", "cognitive_task", "diary", "clinical"].map((m) => ({
          modality: m,
          purpose: "care",
        })),
      },
      clinicalAssessments: {
        create: [{ instrument: "MoCA", administeredAt: new Date(), administeredBy: "registration", score: 25, maxScore: 30 }],
      },
      questionnaires: {
        create: [
          { instrument: "AD8", takenAt: new Date(), score: 3, maxScore: 8, respondent: "informant" },
          { instrument: "SCD-Q", takenAt: new Date(), score: 9, maxScore: 24, respondent: "patient" },
        ],
      },
    },
  });
  await runInference(p.id).catch(() => {});
  revalidatePath("/clinician");
  revalidatePath("/clinician/admin");
  return p.id;
}
