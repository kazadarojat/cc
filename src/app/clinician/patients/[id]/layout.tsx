import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { ageFrom, fmtDate } from "@/lib/format";
import { PatientTabs } from "@/components/PatientTabs";

export const dynamic = "force-dynamic";

export default async function PatientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await db.patient.findUnique({
    where: { id },
    include: { inferences: { orderBy: { producedAt: "desc" }, take: 1 } },
  });
  if (!patient) notFound();

  let history: Record<string, unknown> = {};
  try {
    history = JSON.parse(patient.clinicalHistory);
  } catch {
    history = {};
  }
  const inf = patient.inferences[0];

  return (
    <div>
      <Link
        href="/clinician"
        className="inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-ink"
      >
        <ArrowLeft className="h-3 w-3" aria-hidden /> Cohort
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
        <div className="min-w-0">
          <h1 className="truncate">{patient.name}</h1>
          <p className="mt-1 text-[12px] leading-5 text-muted">
            {ageFrom(patient.dateOfBirth)} yr · {patient.sex} · enrolled {fmtDate(patient.enrolledAt)} ·{" "}
            {patient.monitoringStatus.replace(/_/g, " ")}
          </p>
          {patient.cohortNote ? (
            <p className="mt-1 max-w-[80ch] text-[12px] leading-5 text-faint">{patient.cohortNote}</p>
          ) : null}
        </div>
        {inf ? (
          <div className="flex-none text-right">
            <p className="font-mono text-[11px] leading-4 text-muted">{inf.modelVersion}</p>
            <p className="text-[11px] leading-4 text-faint">Analysed {fmtDate(inf.producedAt)}</p>
          </div>
        ) : null}
      </div>

      <dl className="panel mt-5 divide-y divide-[var(--border)]">
        <HistRow label="Comorbidities" value={arr(history.comorbidities)} />
        <HistRow label="Family history" value={arr(history.familyHistory)} />
        <HistRow label="Medications" value={arr(history.medications)} />
        <HistRow label="Vascular risk" value={String(history.vascularRisk ?? "not recorded")} />
        <HistRow label="Functional status" value={String(history.functionalStatus ?? "not recorded")} />
      </dl>

      <div className="mt-6">
        <PatientTabs id={id} />
      </div>

      <div className="pt-6">{children}</div>
    </div>
  );
}

function arr(v: unknown): string {
  if (Array.isArray(v)) return v.length ? v.join(", ") : "none recorded";
  return String(v ?? "not recorded");
}

function HistRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[124px_1fr] gap-4 px-4 py-2.5 sm:grid-cols-[152px_1fr]">
      <dt className="text-[12px] leading-5 text-faint">{label}</dt>
      <dd className="text-[13px] leading-5 text-ink">{value}</dd>
    </div>
  );
}
