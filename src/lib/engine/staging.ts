/**
 * Stage-probability bands, 24-month projection, biological-AD risk band and the
 * reversible-contributors checklist. Ported from Neurosight's `cognitiveEngine.ts`
 * and adapted to CogniCare's state labels (AD -> Dementia) and data model.
 */
import type { PatientBundle } from "./markers";

const clampPct = (x: number) => Math.max(0, Math.min(100, x));

export type StageProbabilities = { Normal: number; SCD: number; MCI: number; Dementia: number };

export function stageProbabilities(
  state: "Normal" | "SCD" | "MCI" | "Dementia",
  composite: number, // 0..1
): StageProbabilities {
  const r = composite * 100; // Neurosight worked on a 0..100 risk score
  let pNormal: number, pSCD: number, pMCI: number, pAD: number;
  if (state === "Normal") {
    pNormal = Math.max(55, 90 - r * 0.7);
    pSCD = Math.max(5, r * 0.5);
    pMCI = Math.max(2, r * 0.2);
    pAD = 1;
  } else if (state === "SCD") {
    pNormal = Math.max(10, 35 - r * 0.3);
    pSCD = Math.max(45, 70 - Math.abs(r - 45) * 0.8);
    pMCI = Math.max(10, r * 0.4);
    pAD = Math.max(1, r * 0.1);
  } else if (state === "MCI") {
    pNormal = 4;
    pSCD = Math.max(8, 28 - r * 0.2);
    pMCI = Math.max(52, 80 - Math.abs(r - 65) * 0.6);
    pAD = Math.max(10, (r - 45) * 0.6);
  } else {
    pNormal = 1;
    pSCD = 4;
    pMCI = Math.max(15, 45 - (r - 70) * 0.7);
    pAD = Math.max(60, 75 + (r - 70) * 0.5);
  }
  const sum = pNormal + pSCD + pMCI + pAD || 1;
  return {
    Normal: Math.round((pNormal / sum) * 100),
    SCD: Math.round((pSCD / sum) * 100),
    MCI: Math.round((pMCI / sum) * 100),
    Dementia: Math.round((pAD / sum) * 100),
  };
}

export function projection24m(risk12m: number | null): number | null {
  if (risk12m == null) return null;
  return Math.min(0.98, Math.max(0.05, risk12m * 1.42));
}

export type BioAdRiskBand = "Low" | "Moderate" | "High" | "Unknown";

export function biologicalAdRiskBand(
  evidence: "None" | "Low" | "Moderate" | "Moderate-High" | "High" | "Unknown",
): BioAdRiskBand {
  if (evidence === "Unknown") return "Unknown";
  if (evidence === "High" || evidence === "Moderate-High") return "High";
  if (evidence === "Moderate" || evidence === "Low") return "Moderate";
  return "Low";
}

export type ReversibleContributor = {
  category: string;
  status: "Controlled" | "Review" | "Significant factor";
  recommendation: string;
};

function latest<T>(arr: T[], key: keyof T): T | undefined {
  if (!arr.length) return undefined;
  return [...arr].sort((a, b) => +new Date(b[key] as never) - +new Date(a[key] as never))[0];
}

export function reversibleContributors(
  bundle: PatientBundle,
  composite: number,
  clinicalHistory: Record<string, unknown>,
): ReversibleContributor[] {
  const sleep = latest(bundle.sleep, "night");
  const scd = latest(
    bundle.questionnaires.filter((q) => q.instrument === "SCD-Q"),
    "takenAt",
  );
  const scdFrac = scd ? (scd.maxScore ? scd.score / scd.maxScore : 0) : 0;
  const fragPerHr = sleep?.fragmentationIndex ?? 1.2;
  const vascular = String(clinicalHistory.vascularRisk ?? "").toLowerCase();
  const meds = Array.isArray(clinicalHistory.medications) ? (clinicalHistory.medications as string[]) : [];

  return [
    {
      category: "Sleep quality & obstructive sleep apnoea",
      status: fragPerHr >= 3 ? "Review" : "Controlled",
      recommendation:
        fragPerHr >= 3
          ? "Screen for snoring/apnoea or refer for polysomnography; nocturnal hypoxia and poor slow-wave sleep impair glymphatic clearance."
          : "Sleep architecture and continuity are adequate.",
    },
    {
      category: "Mood & depression (pseudodementia)",
      status: scdFrac >= 0.6 ? "Review" : "Controlled",
      recommendation:
        scdFrac >= 0.6
          ? "Administer a geriatric depression screen (GDS-15) to exclude affective pseudodementia driving the subjective complaints."
          : "No affective comorbidity distorting cognition indicated.",
    },
    {
      category: "Metabolic, thyroid (TSH), B12 / folate",
      status: "Controlled",
      recommendation:
        "Annual peripheral metabolic panel to exclude a reversible metabolic encephalopathy.",
    },
    {
      category: "Polypharmacy & anticholinergic / sedative burden",
      status: meds.length >= 3 ? "Review" : "Controlled",
      recommendation:
        "Routine medication review to minimise the anticholinergic and sedative burden.",
    },
    {
      category: "Cardiovascular risk (hypertension, glycaemia, lipids)",
      status:
        vascular.includes("high") || composite >= 0.55
          ? "Significant factor"
          : vascular.includes("moderate")
            ? "Review"
            : "Controlled",
      recommendation:
        "Target systolic blood pressure < 130 mmHg (SPRINT-MIND) and optimise glycaemic and lipid control to reduce the vascular contribution.",
    },
  ];
}
