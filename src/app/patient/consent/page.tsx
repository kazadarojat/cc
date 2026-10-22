import { getSession } from "@/lib/session";
import { Eyebrow } from "@/components/ui";
import { consentRows } from "@/lib/queries";
import { ConsentToggles } from "@/components/ConsentToggles";

export const dynamic = "force-dynamic";

const ROWS = [
  { modality: "speech", label: "Speech", description: "Speaking check-ins for language and voice patterns.", optional: false },
  { modality: "sleep", label: "Sleep", description: "Nightly sleep summaries from a wearable or phone.", optional: false },
  { modality: "cognitive_task", label: "Thinking tasks", description: "Short in-app cognitive tasks.", optional: false },
  { modality: "questionnaire", label: "Questionnaires", description: "Validated cognitive questionnaires.", optional: false },
  { modality: "diary", label: "Cognitive diary", description: "Free-text notes about things you notice.", optional: false },
  { modality: "clinical", label: "Clinical data", description: "Assessments, notes and history entered by your clinician.", optional: false },
  {
    modality: "behavioral",
    label: "Behavioural patterns",
    description: "Optional. Activity, routine and typing patterns only, never message content.",
    optional: true,
  },
  {
    modality: "research",
    label: "Research use",
    description: "Optional. Allow a de-identified copy of your data to be used for research.",
    optional: true,
  },
];

export default async function ConsentPage() {
  const session = await getSession();
  const patientId = session!.subjectId;
  const active = await consentRows(patientId);
  const initial: Record<string, boolean> = {};
  for (const r of ROWS) initial[r.modality] = active.get(r.modality) ?? false;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Eyebrow>Data & consent</Eyebrow>
        <h1 className="mt-2 font-display text-2xl font-bold">What Cognicare may use</h1>
        <p className="mt-2 text-sm text-muted">
          You control which types of data feed your monitoring. Your clinician can see your current
          choices.
        </p>
      </div>
      <ConsentToggles patientId={patientId} rows={ROWS} initial={initial} />
    </div>
  );
}
