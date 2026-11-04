import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { TopBar } from "@/components/TopBar";
import { ClinicianNav } from "@/components/ClinicianNav";

// Authenticated server routes must never be prerendered without a request session.
// The static showcase builder temporarily removes this directive.
export const dynamic = "force-dynamic";

export default async function ClinicianLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession("clinician");
  if (!session) redirect("/login");
  if (session.role !== "clinician") redirect("/patient");
  const exists = await db.clinician.findUnique({ where: { id: session.subjectId }, select: { id: true } });
  if (!exists) redirect("/login");

  return (
    <div className="min-h-screen">
      <TopBar role="clinician" name={session.name} home="/clinician" />
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-5">
        <ClinicianNav />
        <div className="pt-6">{children}</div>
      </main>
    </div>
  );
}
