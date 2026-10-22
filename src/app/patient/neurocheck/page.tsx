import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Eyebrow } from "@/components/ui";
import { NeuroCheckBattery } from "@/components/neurocheck/NeuroCheckBattery";

export default async function NeuroCheckPage() {
  const session = await getSession("patient");
  if (!session || session.role !== "patient") redirect("/login");
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Eyebrow>Thinking tasks</Eyebrow>
        <h1 className="mt-2 font-display text-2xl font-bold">NeuroCheck</h1>
      </div>
      <NeuroCheckBattery patientId={session.subjectId} />
      <p className="text-xs text-faint">
        Interactive micro-tasks merged from Neurosight. For longitudinal monitoring only; not a
        substitute for a clinician-administered assessment.
      </p>
    </div>
  );
}
