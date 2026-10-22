import { db } from "@/lib/db";

/** Patient ids for static export: one prerendered tree per seeded record. */
export async function patientStaticParams() {
  const patients = await db.patient.findMany({
    select: { id: true },
    orderBy: { id: "asc" },
  });
  return patients.map((p) => ({ id: p.id }));
}
