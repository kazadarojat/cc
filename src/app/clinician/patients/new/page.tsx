import { db } from "@/lib/db";
import { Eyebrow } from "@/components/ui";
import { PatientForm } from "@/components/clinician/PatientForm";

export const dynamic = "force-dynamic";

export default async function NewPatientPage() {
  const doctors = await db.clinician.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <div className="space-y-5">
      <div>
        <Eyebrow>Account management</Eyebrow>
        <h1 className="mt-2 text-2xl font-black">Register a new patient</h1>
        <p className="mt-2 text-sm text-muted">
          Creates the record, default care consents, an optional baseline MoCA, and runs a first
          analysis.
        </p>
      </div>
      <PatientForm doctors={doctors} />
    </div>
  );
}
