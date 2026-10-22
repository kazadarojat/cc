import { db } from "@/lib/db";
import { Eyebrow } from "@/components/ui";
import { DataManagement } from "@/components/clinician/DataManagement";

export default async function AdminPage() {
  const [patients, clinicians, inferences, tasks, biomarkers, alerts] = await db.$transaction([
    db.patient.count(),
    db.clinician.count(),
    db.inference.count(),
    db.cognitiveTask.count(),
    db.biomarker.count(),
    db.alert.count(),
  ]);
  return (
    <div className="space-y-5">
      <div>
        <Eyebrow>Account management</Eyebrow>
        <h1 className="mt-2 text-2xl font-black">Data management &amp; reset</h1>
        <p className="mt-2 text-sm text-muted">
          Prototype database controls. Use <code className="rounded bg-[var(--surface-2)] px-1">npm run db:reset</code>{" "}
          from the terminal to restore the full seeded demo cohort.
        </p>
      </div>
      <DataManagement
        counts={{ patients, clinicians, analyses: inferences, "cognitive tasks": tasks, biomarkers, alerts }}
      />
    </div>
  );
}
