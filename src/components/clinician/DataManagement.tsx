"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Trash2 } from "lucide-react";
import { loadSamplePatient, wipeAllPatients } from "@/lib/admin-actions";
import { useToast } from "@/components/Toast";

export function DataManagement({ counts }: { counts: Record<string, number> }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(counts).map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-sm)]">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-faint">{k}</p>
            <p className="tnum mt-1 text-2xl font-extrabold">{v}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
        <h3 className="text-sm font-extrabold">Quick actions</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() =>
              startTransition(async () => {
                const id = await loadSamplePatient();
                toast("Sample patient loaded");
                router.push(`/clinician/patients/${id}`);
              })
            }
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-xs font-bold text-accent-ink hover:bg-[var(--surface-2)] disabled:opacity-60"
          >
            <Sparkles className="h-3.5 w-3.5" /> Load a sample patient
          </button>
        </div>
      </div>

      <div
        className="rounded-2xl border p-5"
        style={{ borderColor: "var(--alert)", background: "color-mix(in srgb, var(--alert) 6%, transparent)" }}
      >
        <h3 className="text-sm font-extrabold text-[var(--alert)]">Danger zone</h3>
        <p className="mt-1 text-xs text-muted">
          Permanently deletes every patient record and all associated data. Clinician accounts are kept.
        </p>
        <button
          onClick={() => {
            if (!confirm("Delete ALL patients and their data? This cannot be undone.")) return;
            startTransition(async () => {
              await wipeAllPatients();
              toast("All patient data deleted", "warn");
              router.refresh();
            });
          }}
          disabled={pending}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[var(--alert)] px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          <Trash2 className="h-3.5 w-3.5" /> Wipe all patient data
        </button>
      </div>
    </div>
  );
}
