"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Stethoscope, Trash2, Pencil, Plus, X } from "lucide-react";
import { createClinician, updateClinician, deleteClinician } from "@/lib/admin-actions";
import { useToast } from "@/components/Toast";

type C = {
  id: string;
  name: string;
  role: string;
  title: string;
  sipNumber: string;
  institution: string;
  phone: string;
  _count: number;
};

const field = "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm";

const ROLES = ["memory_clinic", "neurologist", "geriatrician", "psychiatrist", "gp"];

export function ClinicianManager({ clinicians }: { clinicians: C[] }) {
  const [editing, setEditing] = useState<C | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function save(fd: FormData, id?: string) {
    startTransition(async () => {
      try {
        if (id) {
          await updateClinician(id, fd);
          toast("Clinician updated");
        } else {
          await createClinician(fd);
          toast("Clinician added");
        }
        setEditing(null);
        setAdding(false);
        router.refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Save failed", "warn");
      }
    });
  }

  const Form = ({ c }: { c?: C }) => (
    <form
      action={(fd) => save(fd, c?.id)}
      className="grid gap-3 rounded-xl border border-line bg-[var(--surface-2)] p-4 sm:grid-cols-2"
    >
      <input name="name" placeholder="Name" required defaultValue={c?.name} className={field} />
      <select name="role" defaultValue={c?.role ?? "memory_clinic"} className={field}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <input name="title" placeholder="Title (e.g. Sp.N)" defaultValue={c?.title} className={field} />
      <input name="sipNumber" placeholder="SIP number" defaultValue={c?.sipNumber} className={field} />
      <input name="institution" placeholder="Institution" defaultValue={c?.institution} className={field} />
      <input name="phone" placeholder="Phone" defaultValue={c?.phone} className={field} />
      {!c ? <input name="email" placeholder="Email" className={`${field} sm:col-span-2`} /> : null}
      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Saving…" : c ? "Save" : "Add clinician"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setAdding(false);
          }}
          className="inline-flex items-center gap-1 rounded-xl border border-line px-3 py-2 text-sm font-bold text-muted"
        >
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
      </div>
    </form>
  );

  return (
    <div className="space-y-3">
      {adding ? (
        <Form />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-bold text-white hover:brightness-110"
        >
          <Plus className="h-3.5 w-3.5" /> Add clinician
        </button>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {clinicians.map((c) =>
          editing?.id === c.id ? (
            <Form key={c.id} c={c} />
          ) : (
            <div key={c.id} className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-sm)]">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-accent-ink">
                    <Stethoscope className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-extrabold">{c.name}</p>
                    <p className="font-mono text-[11px] text-muted">
                      {c.title || c.role.replace(/_/g, " ")} · {c._count} patient{c._count === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(c)} className="rounded-lg p-1.5 text-faint hover:text-ink">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (!confirm(`Delete ${c.name}?`)) return;
                      startTransition(async () => {
                        await deleteClinician(c.id);
                        toast("Clinician deleted", "warn");
                        router.refresh();
                      });
                    }}
                    className="rounded-lg p-1.5 text-faint hover:text-[var(--alert)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {c.institution ? <p className="mt-2 text-xs text-muted">{c.institution}</p> : null}
              {c.sipNumber ? <p className="font-mono text-[10px] text-faint">SIP {c.sipNumber}</p> : null}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
