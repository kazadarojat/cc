"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Brain, Hash, Palette, Target, Sparkles, Play, Check } from "lucide-react";
import { submitNeuroCheck } from "@/lib/actions";
import { soundFx } from "@/lib/audioFeedback";
import { WordRecallMinigame } from "./WordRecallMinigame";
import { DigitSpanMinigame } from "./DigitSpanMinigame";
import { StroopExecutiveMinigame } from "./StroopExecutiveMinigame";
import { TrailConnectMinigame } from "./TrailConnectMinigame";
import { SemanticFluencyMinigame } from "./SemanticFluencyMinigame";

export type NeuroCheckPayload = {
  recallScore: number; // 0..5
  recallAccuracy: number; // %
  attentionScore: number; // 0..5
  digitSpanMax: number;
  executiveScore: number; // 0..5
  reactionTimeMs: number;
  stroopInhibition: number; // %
  trailSeconds: number;
  visualScanningScore: number; // 0..5
  fluencyCount: number;
  fluencyWords: string[];
  neuroScore: number; // 0..100 composite
};

const STEPS = [
  { key: "recall", label: "5-word recall", icon: Brain },
  { key: "digits", label: "Digit span", icon: Hash },
  { key: "stroop", label: "Stroop", icon: Palette },
  { key: "trail", label: "Trail connect", icon: Target },
  { key: "fluency", label: "Verbal fluency", icon: Sparkles },
] as const;

type Stage = "intro" | (typeof STEPS)[number]["key"] | "done";

function composite(recall: number, attention: number, exec: number, fluencyCount: number) {
  const recallPart = (recall / 5) * 30;
  const attnPart = (attention / 5) * 25;
  const execPart = (exec / 5) * 25;
  const fluencyPart = (Math.min(fluencyCount, 16) / 16) * 20;
  return Math.round(Math.min(100, recallPart + attnPart + execPart + fluencyPart));
}

export function NeuroCheckBattery({ patientId }: { patientId: string }) {
  const [stage, setStage] = useState<Stage>("intro");
  const [acc, setAcc] = useState<Partial<NeuroCheckPayload>>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const stepIndex = STEPS.findIndex((s) => s.key === stage);

  function finish(final: Partial<NeuroCheckPayload>) {
    const merged = { ...acc, ...final };
    const exec =
      ((merged.executiveScore ?? 3) + (merged.visualScanningScore ?? 3)) / 2;
    const neuroScore = composite(
      merged.recallScore ?? 3,
      merged.attentionScore ?? 3,
      exec,
      merged.fluencyCount ?? 12,
    );
    const payload: NeuroCheckPayload = {
      recallScore: merged.recallScore ?? 3,
      recallAccuracy: merged.recallAccuracy ?? 60,
      attentionScore: merged.attentionScore ?? 3,
      digitSpanMax: merged.digitSpanMax ?? 5,
      executiveScore: merged.executiveScore ?? 3,
      reactionTimeMs: merged.reactionTimeMs ?? 640,
      stroopInhibition: merged.stroopInhibition ?? 80,
      trailSeconds: merged.trailSeconds ?? 26,
      visualScanningScore: merged.visualScanningScore ?? 3,
      fluencyCount: merged.fluencyCount ?? 12,
      fluencyWords: merged.fluencyWords ?? [],
      neuroScore,
    };
    setAcc(payload);
    soundFx.playCompleteFanfare();
    startTransition(async () => {
      await submitNeuroCheck(patientId, payload);
      setStage("done");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* progress rail */}
      {stage !== "intro" && stage !== "done" ? (
        <ol className="flex items-center gap-1.5 overflow-x-auto">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const state = i < stepIndex ? "done" : i === stepIndex ? "active" : "todo";
            return (
              <li key={s.key} className="flex items-center gap-1.5">
                <span
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[11px] whitespace-nowrap ${
                    state === "active"
                      ? "border-accent text-accent-ink"
                      : state === "done"
                        ? "border-[var(--ok)] text-[var(--ok)]"
                        : "border-line text-faint"
                  }`}
                >
                  {state === "done" ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                  {s.label}
                </span>
                {i < STEPS.length - 1 ? <span className="text-faint">·</span> : null}
              </li>
            );
          })}
        </ol>
      ) : null}

      {stage === "intro" && (
        <div className="rounded-xl border border-line bg-surface p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent-ink">
            NeuroCheck battery
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold">Five short cognitive tasks</h2>
          <p className="mt-2 max-w-measure text-sm text-muted">
            About 3 to 4 minutes, done in one sitting somewhere quiet: word recall, digit span,
            Stroop colour-word inhibition, trail making, and verbal fluency. Results feed your
            longitudinal record; they do not replace a clinician-administered MMSE or MoCA.
          </p>
          <button
            onClick={() => {
              soundFx.playCorrect();
              setStage("recall");
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:brightness-110"
          >
            <Play className="h-4 w-4" /> Begin
          </button>
        </div>
      )}

      {stage === "recall" && (
        <WordRecallMinigame
          onComplete={(d) => {
            setAcc((a) => ({ ...a, recallScore: d.recallScore, recallAccuracy: d.accuracyPercent }));
            setStage("digits");
          }}
        />
      )}
      {stage === "digits" && (
        <DigitSpanMinigame
          onComplete={(d) => {
            setAcc((a) => ({
              ...a,
              attentionScore: d.totalAttentionScore,
              digitSpanMax: d.maxSpanReached,
            }));
            setStage("stroop");
          }}
        />
      )}
      {stage === "stroop" && (
        <StroopExecutiveMinigame
          onComplete={(d) => {
            setAcc((a) => ({
              ...a,
              executiveScore: d.executiveScore,
              reactionTimeMs: d.meanReactionTimeMs,
              stroopInhibition: d.inhibitionAccuracy,
            }));
            setStage("trail");
          }}
        />
      )}
      {stage === "trail" && (
        <TrailConnectMinigame
          onComplete={(d) => {
            setAcc((a) => ({
              ...a,
              trailSeconds: d.completionTimeSeconds,
              visualScanningScore: d.visualScanningScore,
            }));
            setStage("fluency");
          }}
        />
      )}
      {stage === "fluency" && (
        <SemanticFluencyMinigame
          onComplete={(d) => finish({ fluencyCount: d.fluencyCount, fluencyWords: d.wordsList })}
        />
      )}

      {stage === "done" && (
        <div className="rounded-xl border border-line bg-surface p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink">
            <Check className="h-7 w-7" />
          </div>
          <h2 className="mt-3 font-display text-xl font-semibold">
            {pending ? "Saving…" : "Session complete"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            NeuroCheck score {acc.neuroScore}/100 · digit span {acc.digitSpanMax} · reaction{" "}
            {acc.reactionTimeMs}ms · fluency {acc.fluencyCount} words. Added to your record and the
            analysis re-run.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={() => {
                setAcc({});
                setStage("intro");
              }}
              className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-[var(--surface-2)]"
            >
              Run again
            </button>
            <button
              onClick={() => router.push("/patient")}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:brightness-110"
            >
              Back to home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
