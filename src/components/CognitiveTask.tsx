"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitCognitiveTask } from "@/lib/actions";

const WORDS = ["APPLE", "TABLE", "RIVER", "PENCIL", "GARDEN", "CANDLE", "MARKET", "WINDOW"];
const DIGITS = [4, 9, 1, 7, 3, 6];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Step = "intro" | "study" | "digits" | "fluency" | "orientation" | "serial7" | "delayed" | "submitting" | "done";

function scoreWordRecall(input: string) {
  const given = new Set(
    input
      .toUpperCase()
      .split(/[\s,;]+/)
      .map((w) => w.trim())
      .filter(Boolean),
  );
  const hit = WORDS.filter((w) => given.has(w)).length;
  return hit / WORDS.length;
}

export function CognitiveTask({ patientId }: { patientId: string }) {
  const [step, setStep] = useState<Step>("intro");
  const [studyLeft, setStudyLeft] = useState(12);
  const [immediate, setImmediate] = useState("");
  const [digitsInput, setDigitsInput] = useState("");
  const [fluencyInput, setFluencyInput] = useState("");
  const [fluencyLeft, setFluencyLeft] = useState(30);
  const [orientation, setOrientation] = useState<string | null>(null);
  const [serial, setSerial] = useState("");
  const [delayed, setDelayed] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const scores = useRef<Record<string, number>>({});

  // study countdown
  useEffect(() => {
    if (step !== "study") return;
    if (studyLeft <= 0) {
      setStep("digits");
      return;
    }
    const t = setTimeout(() => setStudyLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [step, studyLeft]);

  // fluency countdown
  useEffect(() => {
    if (step !== "fluency") return;
    if (fluencyLeft <= 0) return;
    const t = setTimeout(() => setFluencyLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [step, fluencyLeft]);

  function finish() {
    scores.current.memory = scoreWordRecall(immediate);
    const digitsOk =
      digitsInput.replace(/\D/g, "") === DIGITS.join("") ? 1 : digitsInput.replace(/\D/g, "").length >= 4 ? 0.6 : 0.3;
    scores.current.attention = digitsOk;
    const animals = new Set(
      fluencyInput
        .toLowerCase()
        .split(/[\s,;]+/)
        .map((w) => w.trim())
        .filter((w) => w.length > 1),
    );
    scores.current.fluency = Math.max(0, Math.min(1, animals.size / 16));
    scores.current.orientation = orientation === DAYS[new Date().getDay()] ? 1 : 0.4;
    const expected = [93, 86, 79, 72];
    const got = serial.split(/[\s,;]+/).map((n) => parseInt(n, 10));
    const correct = expected.filter((e, i) => got[i] === e).length;
    scores.current.executive = correct / expected.length;
    scores.current.delayedRecall = scoreWordRecall(delayed);

    setStep("submitting");
    startTransition(async () => {
      await submitCognitiveTask(patientId, scores.current);
      setStep("done");
      router.refresh();
    });
  }

  const shell = "rounded-xl border border-line bg-surface p-6";
  const btn = "rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50";
  const ghost = "rounded-lg border border-line px-4 py-2 text-sm hover:bg-[var(--surface-2)]";
  const input = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm";

  if (step === "intro")
    return (
      <div className={shell}>
        <p className="text-sm text-muted">
          Five short tasks, about 5 minutes: remembering words, repeating numbers, naming animals, the
          date, and simple subtraction. Do it somewhere quiet, in one sitting.
        </p>
        <button className={`${btn} mt-4`} onClick={() => setStep("study")}>
          Begin
        </button>
      </div>
    );

  if (step === "study")
    return (
      <div className={shell}>
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] uppercase tracking-wide text-faint">
            Memorise these words
          </p>
          <span className="font-mono text-sm text-accent-ink">{studyLeft}s</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WORDS.map((w) => (
            <span key={w} className="rounded-lg bg-[var(--surface-2)] px-3 py-2 text-center font-display text-lg">
              {w}
            </span>
          ))}
        </div>
        <button className={`${ghost} mt-4`} onClick={() => setStep("digits")}>
          I&apos;ve got them
        </button>
      </div>
    );

  if (step === "digits")
    return (
      <div className={shell}>
        <p className="font-mono text-[11px] uppercase tracking-wide text-faint">Repeat the sequence</p>
        <p className="mt-3 font-display text-3xl tracking-[0.3em]">{DIGITS.join(" ")}</p>
        <p className="mt-1 text-xs text-faint">Type it back with no spaces once you&apos;re ready.</p>
        <input
          className={`${input} mt-3`}
          inputMode="numeric"
          value={digitsInput}
          onChange={(e) => setDigitsInput(e.target.value)}
          placeholder="e.g. 491736"
        />
        <button className={`${btn} mt-4`} onClick={() => setStep("fluency")}>
          Next
        </button>
      </div>
    );

  if (step === "fluency")
    return (
      <div className={shell}>
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] uppercase tracking-wide text-faint">
            Name as many animals as you can
          </p>
          <span className="font-mono text-sm text-accent-ink">{fluencyLeft}s</span>
        </div>
        <textarea
          className={`${input} mt-3`}
          rows={4}
          value={fluencyInput}
          onChange={(e) => setFluencyInput(e.target.value)}
          placeholder="dog, cat, elephant…"
          disabled={fluencyLeft <= 0}
        />
        <button className={`${btn} mt-4`} onClick={() => setStep("orientation")}>
          {fluencyLeft > 0 ? "Done early" : "Next"}
        </button>
      </div>
    );

  if (step === "orientation")
    return (
      <div className={shell}>
        <p className="font-mono text-[11px] uppercase tracking-wide text-faint">What day is it today?</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <button
              key={d}
              onClick={() => setOrientation(d)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                orientation === d ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-muted"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <button className={`${btn} mt-4`} disabled={!orientation} onClick={() => setStep("serial7")}>
          Next
        </button>
      </div>
    );

  if (step === "serial7")
    return (
      <div className={shell}>
        <p className="font-mono text-[11px] uppercase tracking-wide text-faint">
          Starting from 100, subtract 7 four times
        </p>
        <p className="mt-1 text-xs text-faint">Enter the four results, separated by spaces.</p>
        <input
          className={`${input} mt-3`}
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          placeholder="93 86 79 72"
        />
        <button className={`${btn} mt-4`} onClick={() => setStep("delayed")}>
          Next
        </button>
      </div>
    );

  if (step === "delayed")
    return (
      <div className={shell}>
        <p className="font-mono text-[11px] uppercase tracking-wide text-faint">
          Now, without scrolling back, recall the eight words from the start
        </p>
        <textarea
          className={`${input} mt-3`}
          rows={3}
          value={delayed}
          onChange={(e) => setDelayed(e.target.value)}
          placeholder="Type any you remember"
        />
        <button className={`${btn} mt-4`} disabled={pending} onClick={finish}>
          Finish
        </button>
      </div>
    );

  if (step === "submitting")
    return <div className={shell}>Scoring and updating your record…</div>;

  return (
    <div className={shell}>
      <p className="font-display text-lg font-semibold">Done. Thank you.</p>
      <p className="mt-1 text-sm text-muted">
        Your results have been added to your record and the analysis re-run. Your care team sees the
        detail.
      </p>
      <button className={`${ghost} mt-4`} onClick={() => router.push("/patient")}>
        Back to home
      </button>
    </div>
  );
}
