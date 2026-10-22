import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";

export async function latestInference(patientId: string) {
  return db.inference.findFirst({
    where: { patientId },
    orderBy: { producedAt: "desc" },
    include: { explanation: true, recommendations: true },
  });
}

export async function inferenceHistory(patientId: string) {
  return db.inference.findMany({
    where: { patientId },
    orderBy: { producedAt: "asc" },
    select: {
      producedAt: true,
      compositeIndex: true,
      progressionRisk: true,
      progressionRisk24m: true,
      state: true,
      trajectory: true,
      stageProbabilities: true,
    },
  });
}

export async function openAlerts(patientId: string) {
  return db.alert.findMany({
    where: { patientId, readAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export async function consentRows(patientId: string) {
  const grants = await db.consentGrant.findMany({
    where: { patientId },
    orderBy: { grantedAt: "desc" },
  });
  const active = new Map<string, boolean>();
  for (const g of grants) {
    if (!active.has(g.modality)) active.set(g.modality, g.withdrawnAt === null);
  }
  return active;
}

export type TimelineEvent = {
  at: Date;
  kind: string;
  title: string;
  detail: string;
  tone: "ok" | "watch" | "alert" | "uncertain" | "accent" | "neutral";
};

export async function buildTimeline(patientId: string): Promise<TimelineEvent[]> {
  const [patient, speech, sleep, tasks, qs, diary, clinical, bio, imaging, inferences, changes, discord] =
    await Promise.all([
      db.patient.findUnique({ where: { id: patientId } }),
      db.speechSample.findMany({ where: { patientId }, orderBy: { capturedAt: "asc" } }),
      db.sleepNight.findMany({ where: { patientId }, orderBy: { night: "asc" } }),
      db.cognitiveTask.findMany({ where: { patientId }, orderBy: { takenAt: "asc" } }),
      db.questionnaire.findMany({ where: { patientId }, orderBy: { takenAt: "asc" } }),
      db.diaryEntry.findMany({ where: { patientId }, orderBy: { createdAt: "asc" } }),
      db.clinicalAssessment.findMany({ where: { patientId }, orderBy: { administeredAt: "asc" } }),
      db.biomarker.findMany({ where: { patientId }, orderBy: { drawnAt: "asc" } }),
      db.imaging.findMany({ where: { patientId }, orderBy: { acquiredAt: "asc" } }),
      db.inference.findMany({ where: { patientId }, orderBy: { producedAt: "asc" } }),
      db.changeEvent.findMany({ where: { patientId }, orderBy: { detectedAt: "asc" } }),
      db.discordanceFlag.findMany({ where: { patientId }, orderBy: { detectedAt: "asc" } }),
    ]);

  const ev: TimelineEvent[] = [];
  if (!patient) return ev; // stale session / deleted patient

  ev.push({
    at: patient.enrolledAt,
    kind: "enrolment",
    title: "Enrolled in Cognicare",
    detail: "Baseline assessment period begins.",
    tone: "accent",
  });

  // group speech monthly
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const speechByMonth = new Map<string, typeof speech>();
  for (const s of speech) {
    const k = monthKey(s.capturedAt);
    if (!speechByMonth.has(k)) speechByMonth.set(k, []);
    speechByMonth.get(k)!.push(s);
  }
  for (const [, group] of speechByMonth) {
    const mid = group[Math.floor(group.length / 2)];
    ev.push({
      at: mid.capturedAt,
      kind: "speech",
      title: `Speech samples ×${group.length}`,
      detail: `Mean pause ${(
        group.reduce((a, b) => a + b.pauseDuration, 0) / group.length
      ).toFixed(2)}s · lexical diversity ${(
        group.reduce((a, b) => a + b.lexicalDiversity, 0) / group.length
      ).toFixed(2)}`,
      tone: "neutral",
    });
  }

  // sleep monthly
  const sleepByMonth = new Map<string, typeof sleep>();
  for (const s of sleep) {
    const k = monthKey(s.night);
    if (!sleepByMonth.has(k)) sleepByMonth.set(k, []);
    sleepByMonth.get(k)!.push(s);
  }
  for (const [, group] of sleepByMonth) {
    const mid = group[Math.floor(group.length / 2)];
    ev.push({
      at: mid.night,
      kind: "sleep",
      title: `Sleep monitored ×${group.length} nights`,
      detail: `Efficiency ${(group.reduce((a, b) => a + b.efficiency, 0) / group.length).toFixed(
        2,
      )} · fragmentation ${(group.reduce((a, b) => a + b.fragmentationIndex, 0) / group.length).toFixed(1)}/h`,
      tone: "neutral",
    });
  }

  for (const t of tasks) {
    ev.push({
      at: t.takenAt,
      kind: "cognitive_task",
      title: "Digital cognitive task",
      detail: `Ability estimate ${t.abilityEstimate.toFixed(2)} · delayed recall ${t.delayedRecall.toFixed(2)}`,
      tone: "neutral",
    });
  }
  for (const q of qs) {
    ev.push({
      at: q.takenAt,
      kind: "questionnaire",
      title: `${q.instrument} questionnaire`,
      detail: `Score ${q.score}/${q.maxScore} (${q.respondent})`,
      tone: "neutral",
    });
  }
  // diary monthly
  const diaryByMonth = new Map<string, typeof diary>();
  for (const d of diary) {
    const k = monthKey(d.createdAt);
    if (!diaryByMonth.has(k)) diaryByMonth.set(k, []);
    diaryByMonth.get(k)!.push(d);
  }
  for (const [, group] of diaryByMonth) {
    const mid = group[Math.floor(group.length / 2)];
    const domains = new Set<string>();
    for (const d of group) {
      try {
        for (const x of JSON.parse(d.domains) as string[]) domains.add(x);
      } catch {
        /* noop */
      }
    }
    ev.push({
      at: mid.createdAt,
      kind: "diary",
      title: `Cognitive diary ×${group.length}`,
      detail: `Domains: ${[...domains].join(", ") || "none"}`,
      tone: group.length >= 3 ? "watch" : "neutral",
    });
  }
  for (const c of clinical) {
    ev.push({
      at: c.administeredAt,
      kind: "clinical",
      title: c.instrument === "note" ? "Clinical note" : `${c.instrument} administered`,
      detail:
        c.instrument === "note"
          ? c.noteText.slice(0, 160) + (c.noteText.length > 160 ? "…" : "")
          : `Score ${c.score}/${c.maxScore} · ${c.administeredBy}`,
      tone: "accent",
    });
  }
  for (const m of bio) {
    const flag = m.refHigh != null && m.value > m.refHigh ? " ↑ above ref" : m.refLow != null && m.value < m.refLow ? " ↓ below ref" : "";
    ev.push({
      at: m.drawnAt,
      kind: "biomarker",
      title: `Blood biomarker: ${m.analyte}`,
      detail: `${m.value} ${m.unit}${flag}`,
      tone: flag ? "watch" : "neutral",
    });
  }
  for (const im of imaging) {
    ev.push({
      at: im.acquiredAt,
      kind: "imaging",
      title: `Imaging: ${im.modality.replace(/_/g, " ")}`,
      detail: im.report.slice(0, 180) + (im.report.length > 180 ? "…" : ""),
      tone: "accent",
    });
  }
  for (const c of changes) {
    const rawWord = c.magnitude >= 0 ? "up" : "down";
    ev.push({
      at: c.detectedAt,
      kind: "change",
      title: `Change detected: ${c.feature}`,
      detail: `${rawWord} ${Math.abs(Math.round(c.magnitude * 100))}% vs personal baseline, ${
        c.direction === "up" ? "worsening" : "improving"
      } signal`,
      tone: c.direction === "up" ? "watch" : "ok",
    });
  }
  for (const d of discord) {
    ev.push({ at: d.detectedAt, kind: "discordance", title: "Multimodal discordance flagged", detail: d.description, tone: "alert" });
  }
  for (const inf of inferences) {
    ev.push({
      at: inf.producedAt,
      kind: "inference",
      title: `Analysis: ${inf.state}, trajectory ${inf.trajectory}`,
      detail:
        inf.progressionRisk != null
          ? `12-month progression risk ${(inf.progressionRisk * 100).toFixed(0)}% · confidence ${inf.confidenceLabel}`
          : `Progression risk not estimated (${inf.sufficiencyNote.replace(/^Insufficient evidence for progression estimation, /, "")})`,
      tone: "accent",
    });
  }

  ev.sort((a, b) => a.at.getTime() - b.at.getTime());
  return ev;
}

export function labelDate(d: Date) {
  return fmtDate(d);
}
