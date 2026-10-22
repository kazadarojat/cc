"use client";

import { useState } from "react";
import {
  addBiomarker,
  addClinicalAssessment,
  addImaging,
  rerunInference,
} from "@/lib/actions";

const IS_STATIC = process.env.NEXT_PUBLIC_STATIC_EXPORT === "1";

type Kind = "assessment" | "biomarker" | "imaging" | "rerun";

/**
 * Wraps the patient-scoped write forms so the action never has to cross the
 * server/client boundary as a value. A server action cannot be passed to a
 * client component, and a static export has no server at all — importing the
 * action module here keeps both builds working from one component.
 */
export function PatientActionForm({
  patientId,
  kind,
  className,
  children,
}: {
  patientId: string;
  kind: Kind;
  className?: string;
  children: React.ReactNode;
}) {
  const [saved, setSaved] = useState(false);

  async function submit(fd: FormData) {
    if (kind === "assessment") await addClinicalAssessment(patientId, fd);
    else if (kind === "biomarker") await addBiomarker(patientId, fd);
    else if (kind === "imaging") await addImaging(patientId, fd);
    else await rerunInference(patientId);

    if (IS_STATIC) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3500);
    }
  }

  return (
    <form action={submit} className={className}>
      {children}
      {IS_STATIC && saved ? (
        <p className="text-[11px] text-[var(--accent)]" role="status">
          Tersimpan di sesi demo ini (data tidak dikirim ke server).
        </p>
      ) : null}
    </form>
  );
}
