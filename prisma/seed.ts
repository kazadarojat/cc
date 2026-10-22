import { PrismaClient } from "@prisma/client";
import { classifyDiary } from "../src/lib/nlp";
import { analyzePatient, loadBundle, runInference } from "../src/lib/engine";
import type { PatientBundle } from "../src/lib/engine/markers";

const db = new PrismaClient();

// ---- deterministic RNG ----------------------------------------------------
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260907);
const noise = (amp: number) => (rnd() - 0.5) * 2 * amp;

const ENROL = new Date("2025-01-10T09:00:00Z");
function monthsAfter(base: Date, m: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + Math.round(m * 30.44));
  return d;
}

/** ramp a→b across progress p (0..1), eased toward the end when ease>1 */
const ramp = (a: number, b: number, p: number, ease = 1) => a + (b - a) * Math.pow(Math.max(0, p), ease);

type Profile = "declining" | "subjective" | "stable";

async function seedPatient(opts: {
  name: string;
  dateOfBirth: string;
  sex: string;
  monitoringStatus?: string;
  clinicalHistory: object;
  cohortNote: string;
  profile: Profile;
  nMonths: number;
  withBiomarkers: boolean;
  withImaging: boolean;
  consentModalities: string[];
}) {
  const p = await db.patient.create({
    data: {
      name: opts.name,
      dateOfBirth: new Date(opts.dateOfBirth),
      sex: opts.sex,
      enrolledAt: ENROL,
      monitoringStatus: opts.monitoringStatus ?? "active",
      clinicalHistory: JSON.stringify(opts.clinicalHistory),
      cohortNote: opts.cohortNote,
    },
  });

  await db.consentGrant.createMany({
    data: opts.consentModalities.map((m) => ({
      patientId: p.id,
      modality: m,
      purpose: m === "research" ? "research" : "care",
      grantedAt: ENROL,
    })),
  });

  const N = opts.nMonths;
  const prog = (i: number) => (N <= 1 ? 0 : i / (N - 1));

  // drift strengths per profile
  const objDrift = opts.profile === "declining" ? 0.8 : 0; // clinical/task/sleep
  const speechDrift = opts.profile === "declining" ? 0.7 : opts.profile === "subjective" ? 0.38 : 0;
  const subjDrift = opts.profile === "declining" ? 0.9 : opts.profile === "subjective" ? 0.9 : 0;

  // ---- speech (monthly) ----
  for (let i = 0; i < N; i++) {
    const t = prog(i);
    await db.speechSample.create({
      data: {
        patientId: p.id,
        task: i % 2 === 0 ? "picture_description" : "spontaneous",
        capturedAt: monthsAfter(ENROL, i),
        simulated: true,
        speechRate: ramp(132, 132 - 24 * speechDrift, t, 1.6) + noise(2.4),
        articulationRate: 4.6 - 0.5 * speechDrift * t + noise(0.12),
        pauseDuration: ramp(0.42, 0.42 + 0.5 * speechDrift, t, 1.7) + noise(0.022),
        pauseFrequency: ramp(6.2, 6.2 + 5.2 * speechDrift, t, 1.6) + noise(0.32),
        hesitationRatio: ramp(0.05, 0.05 + 0.07 * speechDrift, t, 1.6) + noise(0.005),
        lexicalDiversity: ramp(0.72, 0.72 - 0.15 * speechDrift, t, 1.5) + noise(0.012),
        semanticRichness: ramp(0.7, 0.7 - 0.17 * speechDrift, t, 1.5) + noise(0.014),
        wordFindingDelay: ramp(0.35, 0.35 + 0.5 * speechDrift, t, 1.7) + noise(0.022),
        syntacticComplexity: ramp(0.66, 0.66 - 0.13 * speechDrift, t, 1.4) + noise(0.016),
      },
    });
  }

  // ---- sleep (2 nights / month) ----
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < 2; k++) {
      const t = prog(i);
      await db.sleepNight.create({
        data: {
          patientId: p.id,
          night: monthsAfter(ENROL, i + k * 0.5),
          totalSleepMin: 402 - 42 * objDrift * t + noise(14),
          efficiency: ramp(0.87, 0.87 - 0.13 * objDrift, t, 1.4) + noise(0.014),
          fragmentationIndex: ramp(1.3, 1.3 + 2.0 * objDrift, t, 1.5) + noise(0.12),
          awakenings: ramp(1.4, 1.4 + 2.5 * objDrift, t, 1.4) + noise(0.22),
          midSleepTime: 3.2 + noise(0.25) + objDrift * t * 0.6,
          regularityIndex: ramp(0.82, 0.82 - 0.2 * objDrift, t, 1.3) + noise(0.014),
        },
      });
    }
  }

  // ---- cognitive tasks (monthly) ----
  for (let i = 0; i < N; i++) {
    const t = prog(i);
    await db.cognitiveTask.create({
      data: {
        patientId: p.id,
        takenAt: monthsAfter(ENROL, i + 0.2),
        memory: ramp(0.82, 0.82 - 0.24 * objDrift, t, 1.6) + noise(0.022),
        delayedRecall: ramp(0.8, 0.8 - 0.3 * objDrift, t, 1.7) + noise(0.026),
        attention: ramp(0.84, 0.84 - 0.15 * objDrift, t, 1.3) + noise(0.022),
        orientation: ramp(0.96, 0.96 - 0.09 * objDrift, t, 1.5) + noise(0.012),
        fluency: ramp(0.78, 0.78 - 0.18 * objDrift, t, 1.4) + noise(0.022),
        executive: ramp(0.8, 0.8 - 0.17 * objDrift, t, 1.4) + noise(0.022),
        abilityEstimate: ramp(0.82, 0.82 - 0.24 * objDrift, t, 1.6) + noise(0.016),
      },
    });
  }

  // ---- questionnaires (every 2 months) ----
  for (let i = 0; i < N; i += 2) {
    const t = prog(i);
    const ad8 = Math.round(ramp(1, 1 + 5 * subjDrift, t, 1.5) + Math.max(0, noise(0.5)));
    const scd = Math.round(ramp(3, 3 + 14 * subjDrift, t, 1.4) + Math.max(0, noise(0.8)));
    await db.questionnaire.create({
      data: {
        patientId: p.id,
        instrument: "AD8",
        takenAt: monthsAfter(ENROL, i + 0.3),
        score: Math.min(8, Math.max(0, ad8)),
        maxScore: 8,
        respondent: "informant",
        subscores: "{}",
      },
    });
    await db.questionnaire.create({
      data: {
        patientId: p.id,
        instrument: "SCD-Q",
        takenAt: monthsAfter(ENROL, i + 0.3),
        score: Math.min(24, Math.max(0, scd)),
        maxScore: 24,
        respondent: "patient",
        subscores: "{}",
      },
    });
  }

  // ---- cognitive diary ----
  const DIARY_TEXTS_DECL = [
    "Lupa menaruh kunci lagi pagi ini, akhirnya ketemu di kulkas.",
    "I could not find the word for 'colander' while cooking and had to point at it.",
    "Missed a dentist appointment even though it was on the calendar.",
    "Bingung hari apa waktu bangun tidur, harus cek ponsel.",
    "Started paying a bill online, got distracted, forgot to finish it.",
    "Repeated the same story to my daughter twice in one visit, she told me.",
    "Got briefly lost driving to the market I have used for years.",
    "Could not follow the steps in a recipe I have cooked many times.",
  ];
  const DIARY_TEXTS_SUBJ = [
    "Merasa lebih pelupa akhir-akhir ini, tapi masih bisa kerja normal.",
    "Took a moment to recall a neighbour's name at the gate.",
    "Kadang kehilangan fokus saat membaca koran panjang.",
    "Walked into a room and forgot why, happens more than before.",
    "Lupa nama pemeran film yang baru saja saya tonton.",
  ];
  const DIARY_TEXTS_STABLE = ["Sesekali lupa nama artis di TV, biasa saja.", "Forgot where I parked once at the mall, found it quickly."];

  let diaryPlan: { month: number; text: string }[] = [];
  if (opts.profile === "declining") {
    const counts = [1, 1, 2, 2, 3, 3, 4, 4];
    let idx = 0;
    for (let m = 0; m < N; m++) {
      for (let c = 0; c < (counts[m] ?? 3); c++) {
        diaryPlan.push({ month: m + c * 0.15, text: DIARY_TEXTS_DECL[idx % DIARY_TEXTS_DECL.length] });
        idx++;
      }
    }
  } else if (opts.profile === "subjective") {
    let idx = 0;
    for (let m = 1; m < N; m++) {
      const c = m > N - 3 ? 2 : 1;
      for (let k = 0; k < c; k++) {
        diaryPlan.push({ month: m + k * 0.2, text: DIARY_TEXTS_SUBJ[idx % DIARY_TEXTS_SUBJ.length] });
        idx++;
      }
    }
  } else {
    diaryPlan = [
      { month: 1.5, text: DIARY_TEXTS_STABLE[0] },
      { month: 3, text: DIARY_TEXTS_STABLE[1] },
    ];
  }
  const sevPlan =
    opts.profile === "declining"
      ? ["mild", "mild", "moderate", "moderate", "moderate", "significant", "significant", "significant"]
      : opts.profile === "subjective"
        ? ["mild", "mild", "mild", "moderate"]
        : ["mild"];
  const CTX = ["Grocery shopping", "Phone call", "Cooking", "Paying bills", "Family visit", "Driving"];
  let di = 0;
  for (const e of diaryPlan) {
    await db.diaryEntry.create({
      data: {
        patientId: p.id,
        createdAt: monthsAfter(ENROL, e.month),
        text: e.text,
        domains: JSON.stringify(classifyDiary(e.text)),
        severity: sevPlan[Math.min(di, sevPlan.length - 1)],
        context: CTX[di % CTX.length],
      },
    });
    di++;
  }

  // ---- digital behavioural biomarkers (opt-in; only if consent granted) ----
  if (opts.consentModalities.includes("behavioral")) {
    const nDays = 21;
    for (let i = 0; i < nDays; i++) {
      const t = i / (nDays - 1);
      const d =
        opts.profile === "declining" ? t : opts.profile === "subjective" ? t * 0.3 : 0;
      await db.behaviourDaily.create({
        data: {
          patientId: p.id,
          day: monthsAfter(ENROL, N - 1 - (nDays - 1 - i) * 0.06),
          simulated: true,
          routineDisruptionIndex: ramp(14, 14 + 46 * d, t, 1.4) + Math.abs(noise(4)),
          activityOnsetShiftMin: ramp(6, 6 + 70 * d, t, 1.5) + Math.abs(noise(6)),
          typingSpeedCpm: ramp(168, 168 - 55 * d, t, 1.3) + noise(6),
          typingLatencyVarianceMs: ramp(38, 38 + 90 * d, t, 1.4) + Math.abs(noise(6)),
          screenInteractionLatencyMs: ramp(560, 560 + 780 * d, t, 1.5) + noise(30),
          mobilityRadiusKm: ramp(4.2, 4.2 - 2.6 * d, t, 1.2) + noise(0.3),
        },
      });
    }
  }

  // ---- clinician-administered assessments ----
  const mocaMonths = N >= 8 ? [0, 2, 5, 7] : N >= 6 ? [0, 3, 6] : [0, Math.max(1, N - 1)];
  for (const m of mocaMonths) {
    const t = prog(m);
    const moca =
      opts.profile === "declining"
        ? Math.round(ramp(26, 21, t, 1.35))
        : opts.profile === "subjective"
          ? 27
          : 29;
    await db.clinicalAssessment.create({
      data: {
        patientId: p.id,
        instrument: "MoCA",
        administeredAt: monthsAfter(ENROL, m + 0.1),
        administeredBy: "Dr. Andini (memory clinic)",
        score: moca,
        maxScore: 30,
      },
    });
  }
  if (opts.profile === "declining") {
    await db.clinicalAssessment.create({
      data: {
        patientId: p.id,
        instrument: "MMSE",
        administeredAt: monthsAfter(ENROL, 6.1),
        administeredBy: "Dr. Andini (memory clinic)",
        score: 26,
        maxScore: 30,
      },
    });
    await db.clinicalAssessment.create({
      data: {
        patientId: p.id,
        instrument: "note",
        administeredAt: monthsAfter(ENROL, 6.1),
        administeredBy: "Dr. Andini (memory clinic)",
        noteText:
          "62-yo informant reports progressive short-term memory difficulty over ~6 months, now affecting appointments and bill payment. IADL mildly affected. No focal neurology. Vascular risk: treated hypertension. Plan: plasma biomarkers, MRI, continue Cognicare monitoring.",
      },
    });
  }

  // ---- blood biomarkers (declining only in this seed) ----
  if (opts.withBiomarkers) {
    const draws = [1, N - 1];
    for (const m of draws) {
      const t = prog(m);
      await db.biomarker.createMany({
        data: [
          {
            patientId: p.id,
            drawnAt: monthsAfter(ENROL, m + 0.15),
            analyte: "p-tau217",
            value: +(ramp(0.55, 0.74, t) + noise(0.015)).toFixed(3),
            unit: "pg/mL",
            refLow: 0,
            refHigh: 0.4,
            assay: "research immunoassay",
          },
          {
            patientId: p.id,
            drawnAt: monthsAfter(ENROL, m + 0.15),
            analyte: "Abeta42-40",
            value: +(ramp(0.053, 0.047, t) + noise(0.0008)).toFixed(4),
            unit: "ratio",
            refLow: 0.059,
            refHigh: 0.2,
            assay: "research immunoassay",
          },
          {
            patientId: p.id,
            drawnAt: monthsAfter(ENROL, m + 0.15),
            analyte: "NfL",
            value: +(ramp(17, 23, t) + noise(0.8)).toFixed(1),
            unit: "pg/mL",
            refLow: 0,
            refHigh: 20,
            assay: "Simoa",
          },
          {
            patientId: p.id,
            drawnAt: monthsAfter(ENROL, m + 0.15),
            analyte: "GFAP",
            value: +(ramp(170, 220, t) + noise(6)).toFixed(0),
            unit: "pg/mL",
            refLow: 0,
            refHigh: 150,
            assay: "Simoa",
          },
        ],
      });
    }
  }

  // ---- imaging ----
  if (opts.withImaging) {
    await db.imaging.create({
      data: {
        patientId: p.id,
        acquiredAt: monthsAfter(ENROL, 2),
        modality: "MRI",
        report:
          "3T MRI brain: mild bilateral medial temporal / hippocampal volume loss (Scheltens MTA 2). Mild small-vessel white-matter change (Fazekas 1). No mass or infarct.",
        findings: JSON.stringify({ mta_score: 2, fazekas: 1, pattern: "medial temporal atrophy" }),
      },
    });
    await db.imaging.create({
      data: {
        patientId: p.id,
        acquiredAt: monthsAfter(ENROL, 2.2),
        modality: "amyloid_PET",
        report: "18F-florbetaben PET: cortical uptake consistent with an amyloid-positive scan (visual read positive).",
        findings: JSON.stringify({ visual_read: "positive", centiloid: 78 }),
      },
    });
  }

  return p;
}

async function main() {
  console.log("Resetting data…");
  for (const t of [
    "explanation",
    "recommendation",
    "inference",
    "changeEvent",
    "discordanceFlag",
    "alert",
    "baselineVersion",
    "speechSample",
    "sleepNight",
    "cognitiveTask",
    "questionnaire",
    "diaryEntry",
    "clinicalAssessment",
    "biomarker",
    "imaging",
    "consentGrant",
    "patient",
    "clinician",
  ] as const) {
    // @ts-expect-error dynamic model access
    await db[t].deleteMany({});
  }

  await db.clinician.createMany({
    data: [
      { name: "Dr. Andini Kusuma", role: "memory_clinic", email: "andini@memoryclinic.id" },
      { name: "Dr. Rizal Pratama", role: "neurologist", email: "rizal@neuro.id" },
    ],
  });

  console.log("Seeding patients…");
  const sari = await seedPatient({
    name: "Sari Wibowo",
    dateOfBirth: "1957-04-22",
    sex: "F",
    clinicalHistory: {
      comorbidities: ["hypertension (treated)", "hyperlipidaemia"],
      familyHistory: ["mother, dementia, onset ~74"],
      medications: ["amlodipine 5 mg", "atorvastatin 20 mg"],
      vascularRisk: "moderate",
      functionalStatus: "IADL mildly affected (bills, appointments)",
    },
    cohortNote: "Referred for progressive memory complaints; full multimodal + biomarker + imaging workup.",
    profile: "declining",
    nMonths: 8,
    withBiomarkers: true,
    withImaging: true,
    consentModalities: [
      "speech", "sleep", "questionnaire", "cognitive_task", "diary", "behavioral",
      "clinical", "biomarker", "imaging", "research",
    ],
  });

  const budi = await seedPatient({
    name: "Budi Hartono",
    dateOfBirth: "1953-11-03",
    sex: "M",
    clinicalHistory: {
      comorbidities: ["type 2 diabetes (well controlled)"],
      familyHistory: [],
      medications: ["metformin 500 mg BID"],
      vascularRisk: "low-moderate",
      functionalStatus: "independent in all ADL/IADL",
    },
    cohortNote: "Subjective cognitive decline; worried well. No biomarkers yet; candidate for discordance review.",
    profile: "subjective",
    nMonths: 6,
    withBiomarkers: false,
    withImaging: false,
    consentModalities: ["speech", "sleep", "questionnaire", "cognitive_task", "diary", "clinical"],
  });

  const ratna = await seedPatient({
    name: "Ratna Dewi",
    dateOfBirth: "1964-07-19",
    sex: "F",
    monitoringStatus: "baseline_forming",
    clinicalHistory: {
      comorbidities: [],
      familyHistory: [],
      medications: [],
      vascularRisk: "low",
      functionalStatus: "fully independent",
    },
    cohortNote: "Preventive monitoring. Early in enrolment; progression risk still gated on data sufficiency.",
    profile: "stable",
    nMonths: 4,
    withBiomarkers: false,
    withImaging: false,
    consentModalities: ["speech", "sleep", "questionnaire", "cognitive_task", "diary", "clinical"],
  });

  // backfill a few historical analyses so the longitudinal charts are populated on first load
  async function backfill(patientId: string, cutoffMonths: number[]) {
    const patient = await db.patient.findUniqueOrThrow({ where: { id: patientId } });
    const full = await loadBundle(patientId);
    for (const m of cutoffMonths) {
      const asOf = monthsAfter(ENROL, m);
      const cut = <T,>(arr: T[], key: keyof T) => arr.filter((r) => (r[key] as Date) <= asOf);
      const filtered: PatientBundle = {
        speech: cut(full.speech, "capturedAt"),
        sleep: cut(full.sleep, "night"),
        tasks: cut(full.tasks, "takenAt"),
        questionnaires: cut(full.questionnaires, "takenAt"),
        diary: cut(full.diary, "createdAt"),
        clinical: cut(full.clinical, "administeredAt"),
        biomarkers: cut(full.biomarkers, "drawnAt"),
        imagingStudies: cut(full.imagingStudies, "acquiredAt"),
        behaviour: cut(full.behaviour, "day"),
        behaviourConsent: full.behaviourConsent,
      };
      const r = analyzePatient(patient, filtered);
      await db.inference.create({
        data: {
          patientId,
          producedAt: asOf,
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
          explanation: { create: { factors: JSON.stringify(r.factors), narrative: r.narrative } },
        },
      });
    }
  }

  await backfill(sari.id, [3, 4, 5, 6, 7]);
  await backfill(budi.id, [3, 4, 5]);
  await backfill(ratna.id, [2, 3]);

  for (const p of [sari, budi, ratna]) {
    console.log(`Running current inference for ${p.name}…`);
    const infId = await runInference(p.id);
    // back-date the "current" analysis to just after the last data point on file
    const lastSpeech = await db.speechSample.findFirst({
      where: { patientId: p.id },
      orderBy: { capturedAt: "desc" },
    });
    if (lastSpeech) {
      const producedAt = new Date(lastSpeech.capturedAt.getTime() + 2 * 24 * 60 * 60 * 1000);
      await db.inference.update({ where: { id: infId }, data: { producedAt } });
      await db.alert.updateMany({ where: { patientId: p.id, readAt: null }, data: { createdAt: producedAt } });
    }
  }

  const counts = await db.$transaction([
    db.patient.count(),
    db.speechSample.count(),
    db.sleepNight.count(),
    db.cognitiveTask.count(),
    db.questionnaire.count(),
    db.diaryEntry.count(),
    db.biomarker.count(),
    db.inference.count(),
    db.alert.count(),
  ]);
  console.log(
    `Done. patients=${counts[0]} speech=${counts[1]} sleep=${counts[2]} tasks=${counts[3]} q=${counts[4]} diary=${counts[5]} biomarker=${counts[6]} inference=${counts[7]} alerts=${counts[8]}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
