"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitQuestionnaire } from "@/lib/actions";

export function QuestionnaireForm({
  patientId,
  instrument,
  intro,
  items,
}: {
  patientId: string;
  instrument: string;
  intro: string;
  items: string[];
}) {
  const [answers, setAnswers] = useState<Record<number, 0 | 1>>({});
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const router = useRouter();

  const answered = Object.keys(answers).length;
  const score = useMemo(
    () => Object.values(answers).reduce((a: number, b: number) => a + b, 0),
    [answers],
  );
  const complete = answered === items.length;

  function submit() {
    const fd = new FormData();
    fd.set("instrument", instrument);
    fd.set("score", String(score));
    fd.set("maxScore", String(items.length));
    startTransition(async () => {
      await submitQuestionnaire(patientId, fd);
      setDone(true);
      router.refresh();
    });
  }

  if (done) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6">
        <p className="font-display text-lg font-semibold">Thank you, saved.</p>
        <p className="mt-1 text-sm text-muted">
          Your score ({score}/{items.length}) has been added to your record and the analysis re-run.
        </p>
        <button
          onClick={() => router.push("/patient/assessments")}
          className="mt-4 rounded-lg border border-line px-3 py-2 text-sm hover:bg-[var(--surface-2)]"
        >
          Back to assessments
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{intro}</p>
      <ol className="flex flex-col gap-2">
        {items.map((q, i) => (
          <li key={i} className="rounded-lg border border-line bg-surface p-3">
            <p className="text-sm">{q}</p>
            <div className="mt-2 flex gap-2">
              {(
                [
                  ["Yes", 1],
                  ["No", 0],
                ] as const
              ).map(([label, val]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setAnswers((a) => ({ ...a, [i]: val }))}
                  className={`rounded-md border px-3 py-1 text-sm ${
                    answers[i] === val
                      ? "border-accent bg-accent-soft text-accent-ink"
                      : "border-line text-muted hover:bg-[var(--surface-2)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>

      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] text-faint">
          {answered}/{items.length} answered
        </span>
        <button
          type="button"
          disabled={!complete || pending}
          onClick={submit}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Submit"}
        </button>
      </div>
    </div>
  );
}
