import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { TopBar } from "@/components/TopBar";
import { PatientNav } from "@/components/PatientNav";

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession("patient");
  if (!session) redirect("/login");
  if (session.role !== "patient") redirect("/clinician");
  const exists = await db.patient.findUnique({ where: { id: session.subjectId }, select: { id: true } });
  if (!exists) redirect("/login");

  return (
    <div className="min-h-screen">
      <TopBar role="patient" name={session.name} home="/patient" />
      <div className="mx-auto max-w-3xl px-5 pb-16">
        <PatientNav />
        <main className="pt-6">{children}</main>
      </div>
    </div>
  );
}
