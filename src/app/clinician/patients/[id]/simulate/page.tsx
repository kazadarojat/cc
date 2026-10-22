import { db } from "@/lib/db";
import { analyzePatient, loadBundle } from "@/lib/engine";
import { Disclaimer, Eyebrow } from "@/components/ui";
import { Simulator } from "@/components/clinician/Simulator";
import type { ScenarioResult } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function SimulatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patient = await db.patient.findUniqueOrThrow({ where: { id } });
  const bundle = await loadBundle(id);
  const r = analyzePatient(patient, bundle);
  const baseline: ScenarioResult = {
    state: r.state,
    stateConfidence: r.stateConfidence,
    trajectory: r.trajectory,
    compositeIndex: r.compositeIndex,
    progressionRisk: r.progression.risk,
    progressionRisk24m: r.progression.probability24m,
    biologicalAdRiskBand: r.biologicalAdRiskBand,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>Multimodal simulator</Eyebrow>
        <h2 className="mt-2 text-xl font-extrabold">What-if progression modelling</h2>
      </div>
      <Simulator patientId={id} baseline={baseline} />
      <Disclaimer />
    </div>
  );
}
