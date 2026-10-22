"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Hash, Play, CheckCircle2, RotateCcw, Volume2, ArrowRight, Check, X, ShieldAlert, Sparkles, Zap, Delete } from 'lucide-react';
import { soundFx } from '@/lib/audioFeedback';

interface Props {
  onComplete: (data: {
    maxSpanReached: number;
    forwardScore: number;
    backwardScore: number;
    totalAttentionScore: number; // 0-5
    accuracyPercent: number;
    meanResponseLatencyMs: number;
  }) => void;
}

type DigitMode = 'forward' | 'backward';

export const DigitSpanMinigame: React.FC<Props> = ({ onComplete }) => {
  const [gameState, setGameState] = useState<'intro' | 'flashing' | 'input' | 'feedback' | 'finished'>('intro');
  const [mode, setMode] = useState<DigitMode>('forward');
  const [currentLevel, setCurrentLevel] = useState<number>(3); // start at 3 digits
  const [sequence, setSequence] = useState<number[]>([]);
  const [flashIndex, setFlashIndex] = useState<number>(-1);
  const [userInput, setUserInput] = useState<string>('');
  const [isLastAttemptCorrect, setIsLastAttemptCorrect] = useState<boolean | null>(null);

  // Stats
  const [maxForwardSpan, setMaxForwardSpan] = useState<number>(0);
  const [maxBackwardSpan, setMaxBackwardSpan] = useState<number>(0);
  const [trialsHistory, setTrialsHistory] = useState<{
    mode: DigitMode;
    length: number;
    sequence: string;
    userEntered: string;
    correct: boolean;
    latencyMs: number;
  }[]>([]);

  const inputStartTimeRef = useRef<number>(0);

  // Generate random digits (no consecutive identical numbers)
  const generateSequence = (length: number): number[] => {
    const digits: number[] = [];
    while (digits.length < length) {
      const next = Math.floor(Math.random() * 9) + 1; // 1 to 9
      if (digits.length === 0 || digits[digits.length - 1] !== next) {
        digits.push(next);
      }
    }
    return digits;
  };

  const startLevelTrial = (lvl: number, currentMode: DigitMode) => {
    const seq = generateSequence(lvl);
    setSequence(seq);
    setUserInput('');
    setIsLastAttemptCorrect(null);
    setGameState('flashing');
    setFlashIndex(0);
  };

  // Flash digits sequentially
  useEffect(() => {
    if (gameState === 'flashing') {
      if (flashIndex < sequence.length) {
        soundFx.playDigitTick();
        const timer = setTimeout(() => {
          setFlashIndex((prev) => prev + 1);
        }, 900);
        return () => clearTimeout(timer);
      } else {
        // Sequence display finished, allow input
        const timer = setTimeout(() => {
          setGameState('input');
          inputStartTimeRef.current = Date.now();
        }, 400);
        return () => clearTimeout(timer);
      }
    }
  }, [gameState, flashIndex, sequence]);

  const handleNumpadClick = (num: number) => {
    if (gameState !== 'input') return;
    if (userInput.length < sequence.length) {
      soundFx.playTone(380 + num * 40, 'sine', 0.05, 0.04);
      setUserInput((prev) => prev + num.toString());
    }
  };

  const handleBackspace = () => {
    if (gameState !== 'input') return;
    setUserInput((prev) => prev.slice(0, -1));
  };

  const handleSubmitInput = () => {
    if (gameState !== 'input' || userInput.length === 0) return;
    const latency = Date.now() - inputStartTimeRef.current;
    
    let expected = '';
    if (mode === 'forward') {
      expected = sequence.join('');
    } else {
      expected = [...sequence].reverse().join('');
    }

    const isCorrect = userInput === expected;
    setIsLastAttemptCorrect(isCorrect);

    if (isCorrect) {
      soundFx.playCorrect();
      if (mode === 'forward') {
        setMaxForwardSpan((prev) => Math.max(prev, currentLevel));
      } else {
        setMaxBackwardSpan((prev) => Math.max(prev, currentLevel));
      }
    } else {
      soundFx.playIncorrect();
    }

    const trial = {
      mode,
      length: currentLevel,
      sequence: sequence.join('-'),
      userEntered: userInput,
      correct: isCorrect,
      latencyMs: latency,
    };

    const updatedHistory = [...trialsHistory, trial];
    setTrialsHistory(updatedHistory);
    setGameState('feedback');
  };

  const handleNextTrial = () => {
    if (isLastAttemptCorrect) {
      if (currentLevel < 7) {
        setCurrentLevel((prev) => prev + 1);
        startLevelTrial(currentLevel + 1, mode);
      } else {
        // Switch from forward to backward or finish
        if (mode === 'forward') {
          setMode('backward');
          setCurrentLevel(3);
          startLevelTrial(3, 'backward');
        } else {
          finishGame();
        }
      }
    } else {
      // Failed trial
      if (mode === 'forward') {
        // Switch to backward mode for complete assessment
        setMode('backward');
        setCurrentLevel(3);
        startLevelTrial(3, 'backward');
      } else {
        finishGame();
      }
    }
  };

  const finishGame = () => {
    const finalForward = maxForwardSpan || (isLastAttemptCorrect && mode === 'forward' ? currentLevel : Math.max(currentLevel - 1, 3));
    const finalBackward = maxBackwardSpan || (isLastAttemptCorrect && mode === 'backward' ? currentLevel : Math.max(currentLevel - 1, 2));
    const maxSpan = Math.max(finalForward, finalBackward);
    
    // Scale 0-5 attention score based on normal digit span norms (forward 6-7, backward 4-5)
    let score = 3;
    if (finalForward >= 6 && finalBackward >= 4) score = 5;
    else if (finalForward >= 5 && finalBackward >= 3) score = 4;
    else if (finalForward >= 4) score = 3;
    else score = 2;

    const correctTrials = trialsHistory.filter((t) => t.correct).length + (isLastAttemptCorrect ? 1 : 0);
    const totalTrials = trialsHistory.length + 1;
    const accuracy = Math.round((correctTrials / Math.max(totalTrials, 1)) * 100);

    const meanLatency = trialsHistory.length > 0
      ? Math.round(trialsHistory.reduce((a, b) => a + b.latencyMs, 0) / trialsHistory.length)
      : 2100;

    soundFx.playCompleteFanfare();

    onComplete({
      maxSpanReached: maxSpan,
      forwardScore: finalForward,
      backwardScore: finalBackward,
      totalAttentionScore: score,
      accuracyPercent: accuracy,
      meanResponseLatencyMs: meanLatency,
    });

    setGameState('finished');
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900/60 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 font-bold">
            <Hash className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Minigame 2: Adaptive Digit Span Task
              </h4>
              <span className="px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[10px] font-bold">
                Working Memory &amp; Attention Capacity
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Mengukur kapasitas memori kerja fonologis dan fokus selektif rentang angka maju &amp; mundur.
            </p>
          </div>
        </div>

        {/* Current Mode Badge */}
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${mode === 'forward' ? 'bg-indigo-600 text-white' : 'bg-purple-600 text-white'}`}>
            Mode: {mode === 'forward' ? 'Rentang Maju (Forward)' : 'Rentang Terbalik (Backward)'}
          </span>
          {gameState !== 'intro' && gameState !== 'finished' && (
            <span className="px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded-lg text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
              {currentLevel} Angka
            </span>
          )}
        </div>
      </div>

      {/* INTRO */}
      {gameState === 'intro' && (
        <div className="max-w-md mx-auto py-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
            <Zap className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h5 className="text-base font-black text-slate-900 dark:text-white">
              Tes Rentang Memori Kerja (Digit Span)
            </h5>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Angka akan berkedip satu per satu di layar. Tugas Anda adalah mengingat urutannya dan mengetikkannya kembali dengan tepat (Maju dan Terbalik).
            </p>
          </div>
          <button
            onClick={() => {
              setMode('forward');
              setCurrentLevel(3);
              startLevelTrial(3, 'forward');
            }}
            className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs inline-flex items-center gap-2 shadow-md shadow-purple-600/25 transition-all"
          >
            <Play className="w-4 h-4" /> Mulai Uji Rentang Angka
          </button>
        </div>
      )}

      {/* FLASHING SEQUENCE */}
      {gameState === 'flashing' && (
        <div className="max-w-md mx-auto py-8 text-center space-y-6">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Perhatikan Layar ({mode === 'forward' ? 'Urutan Maju' : 'Urutan Terbalik'})
          </span>

          <div className="h-32 flex items-center justify-center">
            {flashIndex < sequence.length ? (
              <div className="w-24 h-24 rounded-3xl bg-purple-600 text-white flex items-center justify-center font-mono font-black text-5xl shadow-xl shadow-purple-600/30 transform animate-bounce">
                {sequence[flashIndex]}
              </div>
            ) : (
              <div className="text-slate-400 text-sm font-bold animate-pulse">
                Siap-siap mengetik...
              </div>
            )}
          </div>

          <div className="flex justify-center gap-1.5">
            {sequence.map((_, idx) => (
              <span
                key={idx}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  idx <= flashIndex ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* USER INPUT (Tactile Numpad) */}
      {gameState === 'input' && (
        <div className="max-w-xs mx-auto py-2 space-y-4 text-center">
          <div className="space-y-1">
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 block">
              {mode === 'forward'
                ? 'Ketik urutan angka dari AWAL ke AKHIR:'
                : 'Ketik urutan angka dari AKHIR ke AWAL (Terbalik):'}
            </span>
            <div className="h-12 bg-white dark:bg-slate-800 rounded-xl border-2 border-purple-400 dark:border-purple-600 flex items-center justify-center text-xl font-mono font-black tracking-widest text-slate-900 dark:text-white px-4">
              {userInput || <span className="text-slate-300 dark:text-slate-600 font-normal text-sm">Gunakan keypad</span>}
            </div>
          </div>

          {/* Virtual Numpad Grid */}
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumpadClick(num)}
                className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-purple-50 dark:hover:bg-purple-950 font-mono font-black text-base text-slate-900 dark:text-white shadow-xs active:scale-95 transition-all"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleBackspace}
              className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 flex items-center justify-center hover:bg-rose-100 font-bold active:scale-95"
            >
              <Delete className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleNumpadClick(0)}
              className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-purple-50 dark:hover:bg-purple-950 font-mono font-black text-base text-slate-900 dark:text-white shadow-xs active:scale-95"
            >
              0
            </button>
            <button
              onClick={handleSubmitInput}
              disabled={userInput.length === 0}
              className="p-3.5 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xs disabled:opacity-50 active:scale-95 shadow-md shadow-purple-600/30"
            >
              <Check className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* TRIAL FEEDBACK */}
      {gameState === 'feedback' && (
        <div className="max-w-md mx-auto py-4 space-y-4 text-center">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${
              isLastAttemptCorrect
                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                : 'bg-rose-100 dark:bg-rose-950 text-rose-600'
            }`}
          >
            {isLastAttemptCorrect ? <Check className="w-6 h-6" /> : <X className="w-6 h-6" />}
          </div>
          <div className="space-y-1">
            <h5 className="text-base font-black text-slate-900 dark:text-white">
              {isLastAttemptCorrect ? 'Tepat Sekali!' : 'Urutan Kurang Tepat'}
            </h5>
            <p className="text-xs text-slate-500">
              Urutan Asli: <strong className="font-mono text-purple-600">{sequence.join(' - ')}</strong> | Jawaban Anda: <strong className="font-mono">{userInput}</strong>
            </p>
          </div>
          <button
            onClick={handleNextTrial}
            className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs inline-flex items-center gap-2 shadow-md shadow-purple-600/25"
          >
            Lanjut ke Babak Berikutnya <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* FINISHED SUMMARY */}
      {gameState === 'finished' && (
        <div className="max-w-md mx-auto py-3 space-y-4 text-center">
          <div className="inline-flex p-3 rounded-full bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h5 className="text-base font-black text-slate-900 dark:text-white">
              Kapasitas Rentang Atensi Selesai
            </h5>
            <p className="text-xs text-slate-500">
              Rentang Maju (Forward): <strong className="text-purple-600">{maxForwardSpan || 5} digit</strong> | Rentang Mundur (Backward): <strong className="text-purple-600">{maxBackwardSpan || 4} digit</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
