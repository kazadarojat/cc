"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Target, Play, CheckCircle2, RotateCcw, Clock, Sparkles, Check, X, ArrowRight } from 'lucide-react';
import { soundFx } from '@/lib/audioFeedback';

interface Props {
  onComplete: (data: {
    completionTimeSeconds: number;
    errorCount: number;
    visualScanningScore: number; // 0-5
  }) => void;
}

interface TrailNode {
  id: number;
  label: string;
  xPercent: number; // 10 to 90
  yPercent: number; // 10 to 80
}

const TRAIL_NODES: TrailNode[] = [
  { id: 1, label: '1', xPercent: 20, yPercent: 20 },
  { id: 2, label: 'A', xPercent: 75, yPercent: 25 },
  { id: 3, label: '2', xPercent: 35, yPercent: 75 },
  { id: 4, label: 'B', xPercent: 80, yPercent: 65 },
  { id: 5, label: '3', xPercent: 15, yPercent: 55 },
  { id: 6, label: 'C', xPercent: 50, yPercent: 40 },
  { id: 7, label: '4', xPercent: 60, yPercent: 80 },
  { id: 8, label: 'D', xPercent: 45, yPercent: 15 },
];

export const TrailConnectMinigame: React.FC<Props> = ({ onComplete }) => {
  const [gameState, setGameState] = useState<'intro' | 'playing' | 'result'>('intro');
  const [expectedNextIndex, setExpectedNextIndex] = useState(0);
  const [connectedNodes, setConnectedNodes] = useState<number[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const startTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (gameState === 'playing') {
      startTimeRef.current = Date.now();
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((Date.now() - startTimeRef.current) / 1000);
      }, 100);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [gameState]);

  const handleStart = () => {
    soundFx.playCorrect();
    setConnectedNodes([]);
    setExpectedNextIndex(0);
    setErrorCount(0);
    setElapsedSeconds(0);
    setGameState('playing');
  };

  const handleNodeClick = (node: TrailNode, index: number) => {
    if (gameState !== 'playing') return;

    if (index === expectedNextIndex) {
      // Correct node tapped
      soundFx.playTone(480 + index * 50, 'sine', 0.1, 0.08);
      const nextConnected = [...connectedNodes, node.id];
      setConnectedNodes(nextConnected);

      if (index + 1 < TRAIL_NODES.length) {
        setExpectedNextIndex(index + 1);
      } else {
        // Complete!
        const totalTime = (Date.now() - startTimeRef.current) / 1000;
        finishGame(totalTime);
      }
    } else if (!connectedNodes.includes(node.id)) {
      // Incorrect node tapped
      soundFx.playIncorrect();
      setErrorCount((prev) => prev + 1);
    }
  };

  const finishGame = (totalSeconds: number) => {
    soundFx.playCompleteFanfare();
    const finalSeconds = Math.round(totalSeconds * 10) / 10;
    
    // Scoring criteria (normal adult < 25s with 0 errors)
    let score = 3;
    if (finalSeconds < 20 && errorCount === 0) score = 5;
    else if (finalSeconds < 30 && errorCount <= 1) score = 4;
    else if (finalSeconds < 45) score = 3;
    else score = 2;

    onComplete({
      completionTimeSeconds: finalSeconds,
      errorCount,
      visualScanningScore: score,
    });

    setGameState('result');
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900/60 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-600 dark:text-teal-400 font-bold">
            <Target className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Minigame 4: Trail Making Sequence Connect (1-A-2-B)
              </h4>
              <span className="px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 text-[10px] font-bold">
                Visual Scanning &amp; Task Switching
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Uji fleksibilitas kognitif dengan menghubungkan angka dan huruf secara bergantian (1 → A → 2 → B → 3 → C → 4 → D).
            </p>
          </div>
        </div>

        {gameState === 'playing' && (
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/80 px-3 py-1 rounded-lg border border-teal-200 dark:border-teal-800">
            <Clock className="w-4 h-4" />
            <span>{elapsedSeconds.toFixed(1)}s</span>
            {errorCount > 0 && <span className="text-rose-500">({errorCount} salah)</span>}
          </div>
        )}
      </div>

      {/* INTRO */}
      {gameState === 'intro' && (
        <div className="max-w-md mx-auto py-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/80 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto">
            <Target className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h5 className="text-base font-black text-slate-900 dark:text-white">
              Hubungkan Angka dan Huruf Bergantian
            </h5>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Ketuk lingkaran sesuai urutan: <strong>1 → A → 2 → B → 3 → C → 4 → D</strong> secepat dan seakurat mungkin.
            </p>
          </div>
          <button
            onClick={handleStart}
            className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs inline-flex items-center gap-2 shadow-md shadow-teal-600/25 transition-all"
          >
            <Play className="w-4 h-4" /> Mulai Sambungkan Lingkaran
          </button>
        </div>
      )}

      {/* PLAYING (Interactive Canvas Board) */}
      {gameState === 'playing' && (
        <div className="relative w-full h-80 sm:h-96 bg-white dark:bg-slate-950 rounded-2xl border-2 border-dashed border-teal-300 dark:border-teal-900 overflow-hidden select-none p-4 shadow-inner">
          <div className="absolute top-2 left-3 text-[11px] font-bold text-slate-400">
            Target Berikutnya:{' '}
            <strong className="text-teal-600 dark:text-teal-400 font-mono text-sm">
              {TRAIL_NODES[expectedNextIndex]?.label}
            </strong>
          </div>

          {/* Render Nodes */}
          {TRAIL_NODES.map((node, idx) => {
            const isConnected = connectedNodes.includes(node.id);
            const isNext = idx === expectedNextIndex;

            return (
              <button
                key={node.id}
                onClick={() => handleNodeClick(node, idx)}
                style={{
                  left: `${node.xPercent}%`,
                  top: `${node.yPercent}%`,
                }}
                className={`absolute w-12 h-12 -ml-6 -mt-6 rounded-full font-black text-base flex items-center justify-center transition-all transform shadow-md ${
                  isConnected
                    ? 'bg-teal-600 text-white scale-95 border-2 border-teal-400'
                    : isNext
                    ? 'bg-teal-50 dark:bg-teal-900 text-teal-700 dark:text-teal-200 border-2 border-teal-500 animate-pulse scale-110'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:scale-105'
                }`}
              >
                {node.label}
              </button>
            );
          })}
        </div>
      )}

      {/* RESULT */}
      {gameState === 'result' && (
        <div className="max-w-md mx-auto py-3 space-y-4 text-center">
          <div className="inline-flex p-3 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h5 className="text-base font-black text-slate-900 dark:text-white">
              Trail Connect Selesai!
            </h5>
            <p className="text-xs text-slate-500">
              Waktu Selesai: <strong className="font-mono text-teal-600 font-bold">{elapsedSeconds.toFixed(1)} detik</strong> | Kesalahan: <strong className="font-mono">{errorCount} kali</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
