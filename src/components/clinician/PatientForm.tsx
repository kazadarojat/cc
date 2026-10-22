"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPatient, updatePatient, deletePatient } from "@/lib/admin-actions";
import { useToast } from "@/components/Toast";

type Doctor = { id: string; name: string };
type Existing = {
  id: string;
  name: string;
  sex: string;
  dateOfBirth: string; // yyyy-mm-dd
  phone: string;
  email: string;
  monitoringStatus: string;
  assignedDoctorId: string | null;
  cohortNote: string;
  history: {
    comorbidities?: string[];
    familyHistory?: string[];
    medications?: string[];
    vascularRisk?: string;
    functionalStatus?: string;
  };
};

const field = "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm";
const label = "font-mono text-[10px] font-bold uppercase tracking-wide text-faint";

export function PatientForm({ doctors, existing }: { doctors: Doctor[]; existing?: Existing }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const h = existing?.history ?? {};

  function submit(fd: FormData) {
    startTransition(async () => {
      try {
        if (existing) {
          await updatePatient(existing.id, fd);
          toast("Patient updated");
          router.push(`/clinician/patients/${existing.id}`);
        } else {
          const id = await createPatient(fd);
          toast("Patient registered");
          router.push(`/clinician/patients/${id}`);
        }
      } catch (e) {
        toast(e instanceof Error ? e.message : "Save failed", "warn");
      }
    });
  }

  return (
    <form action={submit} className="space-y-5 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
      <div className="grid gap-4 sm:grid-cols-2">
        <L t="Full name">
          <input name="name" required defaultValue={existing?.name} className={field} />
        </L>
        <L t="Sex">
          <select name="sex" defaultValue={existing?.sex ?? "F"} className={field}>
            <option value="F">Female</option>
            <option value="M">Male</option>
            <option value="other">Other</option>
          </select>
        </L>
        {!existing ? (
          <L t="Date of birth">
            <input type="date" name="dateOfBirth" required className={field} />
          </L>
        ) : null}
        <L t="Monitoring status">
          <select name="monitoringStatus" defaultValue={existing?.monitoringStatus ?? "baseline_forming"} className={field}>
            <option value="baseline_forming">Baseline forming</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </L>
        <L t="Phone">
          <input name="phone" defaultValue={existing?.phone} className={field} />
        </L>
        <L t="Email">
          <input name="email" type="email" defaultValue={existing?.email} className={field} />
        </L>
        <L t="Assigned clinician">
          <select name="assignedDoctorId" defaultValue={existing?.assignedDoctorId ?? ""} className={field}>
            <option value="">— none —</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </L>
        {!existing ? (
          <L t="Baseline MoCA (/30, optional)">
            <input type="number" name="baselineMoca" min={0} max={30} className={field} />
          </L>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <L t="Comorbidities (comma separated)">
          <input name="comorbidities" defaultValue={(h.comorbidities ?? []).join(", ")} className={field} />
        </L>
        <L t="Family history">
          <input name="familyHistory" defaultValue={(h.familyHistory ?? []).join(", ")} className={field} />
        </L>
        <L t="Medications">
          <input name="medications" defaultValue={(h.medications ?? []).join(", ")} className={field} />
        </L>
        <L t="Vascular risk">
          <select name="vascularRisk" defaultValue={h.vascularRisk ?? "low"} className={field}>
            <option value="low">Low</option>
            <option value="low-moderate">Low–moderate</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
          </select>
        </L>
        <L t="Functional status">
          <input name="functionalStatus" defaultValue={h.functionalStatus} className={field} />
        </L>
        <L t="Cohort note">
          <input name="cohortNote" defaultValue={existing?.cohortNote} className={field} />
        </L>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Saving…" : existing ? "Save changes" : "Register patient"}
        </button>
        {existing ? (
          <button
            type="button"
            onClick={() => {
              if (!confirm(`Delete ${existing.name} and all their data? This cannot be undone.`)) return;
              startTransition(async () => {
                await deletePatient(existing.id);
                toast("Patient deleted", "warn");
                router.push("/clinician");
              });
            }}
            className="rounded-xl border border-[var(--alert)] px-3 py-2 text-sm font-bold text-[var(--alert)] hover:bg-[color-mix(in_srgb,var(--alert)_8%,transparent)]"
          >
            Delete patient
          </button>
        ) : null}
      </div>
    </form>
  );
}

function L({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={label}>{t}</span>
      {children}
    </label>
  );
}
