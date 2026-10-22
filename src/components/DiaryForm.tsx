"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitDiary } from "@/lib/actions";
import { classifyDiary } from "@/lib/nlp";
import { titleCase } from "@/lib/format";

const SEVERITY = [
  { v: "mild", label: "Mild, recalled it on my own" },
  { v: "moderate", label: "Moderate, needed a note or a prompt" },
  { v: "significant", label: "Significant, it disrupted what I was doing" },
];

export function DiaryForm({ patientId }: { patientId: string }) {
  const [text, setText] = useState("");
  const [severity, setSeverity] = useState("mild");
  const [context, setContext] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const domains = useMemo(() => (text.trim().length >= 3 ? classifyDiary(text) : []), [text]);

  function submit() {
    if (text.trim().length < 3) return;
    const fd = new FormData();
    fd.set("text", text.trim());
    fd.set("severity", severity);
    fd.set("context", context.trim());
    startTransition(async () => {
      await submitDiary(patientId, fd);
      setText("");
      setContext("");
      setSeverity("mild");
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <label className="font-mono text-[11px] uppercase tracking-wide text-faint">
        Something you noticed
      </label>
      <textarea
        className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. Forgot where I put my keys again this morning. / Lupa nama tetangga tadi."
      />

      {domains.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wide text-faint">Suggested area:</span>
          {domains.map((d) => (
            <span
              key={d}
              className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted"
            >
              {titleCase(d)}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wide text-faint">How much it affected you</span>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="rounded-lg border border-line bg-surface px-2.5 py-2 text-sm"
          >
            {SEVERITY.map((s) => (
              <option key={s.v} value={s.v}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wide text-faint">Where / what you were doing</span>
          <input
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="e.g. phone call, at the market"
            className="rounded-lg border border-line bg-surface px-2.5 py-2 text-sm"
          />
        </label>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-faint">Write in English or Bahasa Indonesia.</span>
        <button
          type="button"
          onClick={submit}
          disabled={pending || text.trim().length < 3}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Add entry"}
        </button>
      </div>
    </div>
  );
}
