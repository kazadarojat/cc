"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitSpeechSample } from "@/lib/actions";

const TASKS = [
  { id: "picture_description", label: "Describe a picture" },
  { id: "spontaneous", label: "Talk about your day" },
  { id: "reading", label: "Read a short passage" },
];

export function SpeechCapture({ patientId }: { patientId: string }) {
  const [task, setTask] = useState(TASKS[0].id);
  const [phase, setPhase] = useState<"idle" | "recording" | "processing" | "done">("idle");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run() {
    setPhase("recording");
    // simulate a recording window, then a processing window
    setTimeout(() => {
      setPhase("processing");
      startTransition(async () => {
        await submitSpeechSample(patientId, task, "clear");
        setPhase("done");
        router.refresh();
        setTimeout(() => setPhase("idle"), 2500);
      });
    }, 1600);
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[11px] uppercase tracking-wide text-faint">Task</span>
        <select
          value={task}
          onChange={(e) => setTask(e.target.value)}
          disabled={phase !== "idle"}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        >
          {TASKS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={run}
        disabled={phase !== "idle" || pending}
        className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {phase === "idle" && "Start speaking check-in"}
        {phase === "recording" && "● Listening…"}
        {phase === "processing" && "Analysing speech…"}
        {phase === "done" && "Saved ✓"}
      </button>

      <p className="font-mono text-[11px] leading-relaxed text-faint">
        Simulated capture. This prototype does not record or upload audio. It generates plausible
        speech-biomarker values around your recent profile so the pipeline can be demonstrated end to
        end.
      </p>
    </div>
  );
}
