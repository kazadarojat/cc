"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateConsent } from "@/lib/actions";

type Row = { modality: string; label: string; description: string; optional: boolean };

export function ConsentToggles({
  patientId,
  rows,
  initial,
}: {
  patientId: string;
  rows: Row[];
  initial: Record<string, boolean>;
}) {
  const [state, setState] = useState(initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle(modality: string, next: boolean) {
    setState((s) => ({ ...s, [modality]: next }));
    startTransition(async () => {
      await updateConsent(patientId, modality, next);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => {
        const on = state[r.modality] ?? false;
        return (
          <div
            key={r.modality}
            className="flex items-start justify-between gap-4 rounded-lg border border-line bg-surface p-3"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{r.label}</span>
                {r.optional ? (
                  <span className="font-mono text-[10px] uppercase tracking-wide text-faint">optional</span>
                ) : (
                  <span className="font-mono text-[10px] uppercase tracking-wide text-faint">core</span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted">{r.description}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              disabled={pending || (!r.optional && on)}
              onClick={() => toggle(r.modality, !on)}
              className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
                on ? "bg-accent" : "bg-[var(--surface-2)] border border-line"
              } disabled:opacity-50`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  on ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        );
      })}
      <p className="mt-1 font-mono text-[11px] text-faint">
        Core modalities are required for monitoring and cannot be withdrawn while enrolled. Optional
        data can be withdrawn at any time; withdrawal takes effect immediately and removes that data
        from future analysis.
      </p>
    </div>
  );
}
