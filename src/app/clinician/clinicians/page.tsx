import { db } from "@/lib/db";
import { Eyebrow } from "@/components/ui";
import { ClinicianManager } from "@/components/clinician/ClinicianManager";

export default async function CliniciansPage() {
  const rows = await db.clinician.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { patients: true } } },
  });
  const clinicians = rows.map((c) => ({
    id: c.id,
    name: c.name,
    role: c.role,
    title: c.title,
    sipNumber: c.sipNumber,
    institution: c.institution,
    phone: c.phone,
    _count: c._count.patients,
  }));

  return (
    <div className="space-y-5">
      <div>
        <Eyebrow>Account management</Eyebrow>
        <h1 className="mt-2 text-2xl font-black">Clinicians</h1>
        <p className="mt-2 text-sm text-muted">
          Registered specialists and DPJP. Deleting a clinician unassigns their patients (records are
          kept).
        </p>
      </div>
      <ClinicianManager clinicians={clinicians} />
    </div>
  );
}
