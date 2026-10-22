"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Palette, Play, CheckCircle2, Clock, Zap, Sparkles, Check, X } from 'lucide-react';
import { soundFx } from '@/lib/audioFeedback';

interface Props {
  onComplete: (data: {
    executiveScore: number; // 0 - 5
    inhibitionAccuracy: number; // %
    meanReactionTimeMs: number; // ms
    congruentLatencyMs: number;
    incongruentLatencyMs: number;
    interferenceCostMs: number;
  }) => void;
}

interface StroopTrial {
  word: string;
  inkColorName: string;
  inkColorClass: string;
  isCongruent: boolean;
}

const COLORS = [
  { name: 'Merah', colorClass: 'text-rose-600 dark:text-rose-400', bgClass: 'bg-rose-500 hover:bg-rose-600' },
  { name: 'Biru', colorClass: 'text-blue-600 dark:text-blue-400', bgClass: 'bg-blue-500 hover:bg-blue-600' },
  { name: 'Hijau', colorClass: 'text-emerald-600 dark:text-emerald-400', bgClass: 'bg-emerald-500 hover:bg-emerald-600' },
  { name: 'Kuning', colorClass: 'text-amber-500 dark:text-amber-400', bgClass: 'bg-amber-500 hover:bg-amber-600' },
];

const GENERATE_TRIALS = (): StroopTrial[] => [
  { word: 'Merah', inkColorName: 'Merah', inkColorClass: 'text-rose-600 dark:text-rose-400', isCongruent: true },
  { word: 'Biru', inkColorName: 'Hijau', inkColorClass: 'text-emerald-600 dark:text-emerald-400', isCongruent: false },
  { word: 'Kuning', inkColorName: 'Biru', inkColorClass: 'text-blue-600 dark:text-blue-400', isCongruent: false },
  { word: 'Hijau', inkColorName: 'Hijau', inkColorClass: 'text-emerald-600 dark:text-emerald-400', isCongruent: true },
  { word: 'Merah', inkColorName: 'Kuning', inkColorClass: 'text-amber-500 dark:text-amber-400', isCongruent: false },
  { word: 'Biru', inkColorName: 'Merah', inkColorClass: 'text-rose-600 dark:text-rose-400', isCongruent: false },
  { word: 'Hijau', inkColorName: 'Biru', inkColorClass: 'text-blue-600 dark:text-blue-400', isCongruent: false },
  { word: 'Kuning', inkColorName: 'Kuning', inkColorClass: 'text-amber-500 dark:text-amber-400', isCongruent: true },
];

export const StroopExecutiveMinigame: React.FC<Props> = ({ onComplete }) => {
  const [gameState, setGameState] = useState<'intro' | 'playing' | 'result'>('intro');
  const [trials] = useState<StroopTrial[]>(GENERATE_TRIALS);
  const [currentTrialIdx, setCurrentTrialIdx] = useState(0);
  const [trialStartTime, setTrialStartTime] = useState(0);

  // Results recorded
  const [results, setResults] = useState<{
    trial: StroopTrial;
    chosenColor: string;
    correct: boolean;
    latencyMs: number;
  }[]>([]);

  const handleStart = () => {
    soundFx.playCorrect();
    setCurrentTrialIdx(0);
    setResults([]);
    setGameState('playing');
    setTrialStartTime(Date.now());
  };

  const handleChoice = (colorName: string) => {
    if (gameState !== 'playing') return;
    const now = Date.now();
    const latency = now - trialStartTime;
    const currentTrial = trials[currentTrialIdx];
    const isCorrect = colorName === currentTrial.inkColorName;

    if (isCorrect) {
      soundFx.playCorrect();
    } else {
      soundFx.playIncorrect();
    }

    const trialResult = {
      trial: currentTrial,
      chosenColor: colorName,
      correct: isCorrect,
      latencyMs: latency,
    };

    const updated = [...results, trialResult];
    setResults(updated);

    if (currentTrialIdx + 1 < trials.length) {
      setCurrentTrialIdx((prev) => prev + 1);
      setTrialStartTime(Date.now());
    } else {
      // Game completed
      finishGame(updated);
    }
  };

  const finishGame = (allResults: typeof results) => {
    const correctCount = allResults.filter((r) => r.correct).length;
    const accuracy = Math.round((correctCount / allResults.length) * 100);

    const congruentTrials = allResults.filter((r) => r.trial.isCongruent);
    const incongruentTrials = allResults.filter((r) => !r.trial.isCongruent);

    const meanCongruent = congruentTrials.length > 0
      ? Math.round(congruentTrials.reduce((a, b) => a + b.latencyMs, 0) / congruentTrials.length)
      : 550;
    const meanIncongruent = incongruentTrials.length > 0
      ? Math.round(incongruentTrials.reduce((a, b) => a + b.latencyMs, 0) / incongruentTrials.length)
      : 780;

    const interferenceCost = Math.max(0, meanIncongruent - meanCongruent);
    const overallMeanLatency = Math.round(allResults.reduce((a, b) => a + b.latencyMs, 0) / allResults.length);

    let execScore = 3;
    if (accuracy >= 85 && overallMeanLatency < 750) execScore = 5;
    else if (accuracy >= 70 && overallMeanLatency < 950) execScore = 4;
    else if (accuracy >= 55) execScore = 3;
    else execScore = 2;

    soundFx.playCompleteFanfare();

    onComplete({
      executiveScore: execScore,
      inhibitionAccuracy: accuracy,
      meanReactionTimeMs: overallMeanLatency,
      congruentLatencyMs: meanCongruent,
      incongruentLatencyMs: meanIncongruent,
      interferenceCostMs: interferenceCost,
    });

    setGameState('result');
  };

  const currentTrial = trials[currentTrialIdx];

  return (
    <div className="bg-slate-50 dark:bg-slate-900/60 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 font-bold">
            <Palette className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Minigame 3: Stroop Color-Word Inhibitory Task
              </h4>
              <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                Inhibisi Eksekutif &amp; Kecepatan Reaksi
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Uji ketahanan korteks prefrontal dalam menahan dorongan otomatis membaca kata dan memilih warna tinta visual.
            </p>
          </div>
        </div>

        {gameState === 'playing' && (
          <span className="px-3 py-1 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 rounded-lg text-xs font-bold font-mono">
            Ronde {currentTrialIdx + 1} / {trials.length}
          </span>
        )}
      </div>

      {/* INTRO */}
      {gameState === 'intro' && (
        <div className="max-w-md mx-auto py-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <Zap className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h5 className="text-base font-black text-slate-900 dark:text-white">
              Tantangan Refleks Warna Stroop
            </h5>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Aturan Penting: <strong>Pilih WARNA TINTA</strong> dari tulisan di layar secepat mungkin. Abaikan arti kata teksnya!
            </p>
          </div>
          <button
            onClick={handleStart}
            className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs inline-flex items-center gap-2 shadow-md shadow-amber-600/25 transition-all"
          >
            <Play className="w-4 h-4" /> Mulai Stroop Test (8 Ronde Cepat)
          </button>
        </div>
      )}

      {/* PLAYING */}
      {gameState === 'playing' && currentTrial && (
        <div className="max-w-md mx-auto py-6 text-center space-y-6">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            PILIH WARNA TINTA TEKS INI:
          </span>

          {/* Central Stimulus Word */}
          <div className="p-8 rounded-3xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shadow-lg flex items-center justify-center">
            <span className={`text-4xl sm:text-5xl font-black tracking-widest ${currentTrial.inkColorClass}`}>
              {currentTrial.word}
            </span>
          </div>

          {/* 4 Choice Buttons */}
          <div className="grid grid-cols-2 gap-3">
            {COLORS.map((col) => (
              <button
                key={col.name}
                onClick={() => handleChoice(col.name)}
                className={`py-3.5 px-4 rounded-2xl text-white font-black text-sm shadow-md active:scale-95 transition-all ${col.bgClass}`}
              >
                {col.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* RESULT */}
      {gameState === 'result' && (
        <div className="max-w-md mx-auto py-3 space-y-4 text-center">
          <div className="inline-flex p-3 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h5 className="text-base font-black text-slate-900 dark:text-white">
              Stroop Test Selesai
            </h5>
            <p className="text-xs text-slate-500">
              Akurasi Inhibisi: <strong className="text-amber-600 font-bold">{Math.round((results.filter((r) => r.correct).length / results.length) * 100)}%</strong> | Rata-rata Latensi: <strong className="font-mono text-slate-800 dark:text-slate-200">{Math.round(results.reduce((a, b) => a + b.latencyMs, 0) / results.length)} ms</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
