import { db } from "@/lib/db";
import { Eyebrow } from "@/components/ui";
import { PatientForm } from "@/components/clinician/PatientForm";
import { patientStaticParams } from "@/lib/static-params";

export async function generateStaticParams() {
  return patientStaticParams();
}

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [patient, doctors] = await Promise.all([
    db.patient.findUniqueOrThrow({ where: { id } }),
    db.clinician.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  let history = {};
  try {
    history = JSON.parse(patient.clinicalHistory);
  } catch {
    history = {};
  }

  return (
    <div className="space-y-5">
      <div>
        <Eyebrow>Account management</Eyebrow>
        <h2 className="mt-2 text-xl font-extrabold">Edit patient record</h2>
      </div>
      <PatientForm
        doctors={doctors}
        existing={{
          id: patient.id,
          name: patient.name,
          sex: patient.sex,
          dateOfBirth: patient.dateOfBirth.toISOString().slice(0, 10),
          phone: patient.phone,
          email: patient.email,
          monitoringStatus: patient.monitoringStatus,
          assignedDoctorId: patient.assignedDoctorId,
          cohortNote: patient.cohortNote,
          history,
        }}
      />
    </div>
  );
}
