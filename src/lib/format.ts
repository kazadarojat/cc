export function fmtDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtMonth(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export function monthsBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}

export function ageFrom(dob: Date | string): number {
  const d = typeof dob === "string" ? new Date(dob) : dob;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

export function pct(x: number | null | undefined, digits = 0): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "n/a";
  return `${(x * 100).toFixed(digits)}%`;
}

export function titleCase(s: string): string {
  return s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const MODALITY_LABEL: Record<string, string> = {
  speech: "Speech",
  sleep: "Sleep",
  questionnaire: "Questionnaire",
  cognitive_task: "Cognitive task",
  diary: "Cognitive diary",
  behavioral: "Behavioural",
  clinical: "Clinical assessment",
  biomarker: "Blood biomarker",
  imaging: "Imaging",
  research: "Research use",
};

export const TRAJECTORY_TONE: Record<string, "ok" | "watch" | "alert" | "uncertain"> = {
  Stable: "ok",
  Improving: "ok",
  Changing: "watch",
  Worsening: "alert",
  Uncertain: "uncertain",
};

export const STATE_TONE: Record<string, "ok" | "watch" | "alert" | "uncertain"> = {
  Normal: "ok",
  SCD: "watch",
  MCI: "watch",
  Dementia: "alert",
};

export const ALERT_TONE: Record<string, "ok" | "watch" | "alert" | "uncertain"> = {
  informational: "uncertain",
  change: "watch",
  multimodal: "watch",
  clinical_review: "alert",
};
