"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Play, Clock, Check, Plus, Volume2, Mic, CheckCircle2 } from 'lucide-react';
import { soundFx } from '@/lib/audioFeedback';

interface Props {
  onComplete: (data: {
    fluencyCount: number;
    wordsList: string[];
    fluencyScore: number; // 0 - 5
  }) => void;
}

const COMMON_ANIMALS = [
  'kucing', 'anjing', 'singa', 'harimau', 'gajah', 'sapi', 'kambing', 'kuda', 'ayam', 'bebek',
  'burung', 'ikan', 'kelinci', 'ular', 'monyet', 'kera', 'buaya', 'jerapah', 'zebra', 'beruang',
  'lumba-lumba', 'paus', 'serigala', 'unta', 'elang', 'rusa', 'kancil', 'badak', 'banteng', 'komodo',
];

export const SemanticFluencyMinigame: React.FC<Props> = ({ onComplete }) => {
  const [gameState, setGameState] = useState<'intro' | 'active' | 'result'>('intro');
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [inputText, setInputText] = useState('');
  const [words, setWords] = useState<string[]>([]);
  const [isListeningMic, setIsListeningMic] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (gameState === 'active' && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gameState, timerSeconds]);

  const handleStart = () => {
    soundFx.playCorrect();
    setWords([]);
    setInputText('');
    setTimerSeconds(30);
    setGameState('active');
    setTimeout(() => inputRef.current?.focus(), 200);
  };

  const handleAddWord = () => {
    const clean = inputText.trim().toLowerCase();
    if (!clean) return;

    if (!words.includes(clean)) {
      soundFx.playTone(600, 'sine', 0.08, 0.06);
      setWords((prev) => [...prev, clean]);
      setInputText('');
    } else {
      soundFx.playIncorrect();
      setInputText('');
    }
  };

  const handleMicSimulate = () => {
    setIsListeningMic(true);
    soundFx.playTone(550, 'sine', 0.1, 0.08);

    // Pick 3 realistic candidate words not yet in list
    const unpicked = COMMON_ANIMALS.filter((a) => !words.includes(a));
    setTimeout(() => {
      if (unpicked.length > 0) {
        const picked = unpicked[Math.floor(Math.random() * unpicked.length)];
        soundFx.playTone(720, 'sine', 0.1, 0.06);
        setWords((prev) => [...prev, picked]);
      }
      setIsListeningMic(false);
    }, 600);
  };

  const handleTimeUp = () => {
    soundFx.playCompleteFanfare();
    const count = words.length;
    let score = 3;
    if (count >= 14) score = 5;
    else if (count >= 10) score = 4;
    else if (count >= 7) score = 3;
    else score = 2;

    onComplete({
      fluencyCount: count,
      wordsList: words,
      fluencyScore: score,
    });

    setGameState('result');
  };

  const handleManualFinish = () => {
    handleTimeUp();
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900/60 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold">
            <Sparkles className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Minigame 5: Semantic Category Fluency (Nama Hewan)
              </h4>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                Akses Leksikal &amp; Semantik Temporal
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Menilai kecepatan akses jaringan semantik di lobus temporal dengan menyebutkan sebanyak mungkin nama hewan dalam 30 detik.
            </p>
          </div>
        </div>

        {gameState === 'active' && (
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/80 px-3 py-1 rounded-lg border border-blue-200 dark:border-blue-800">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>00:{timerSeconds < 10 ? '0' : ''}{timerSeconds}</span>
          </div>
        )}
      </div>

      {/* INTRO */}
      {gameState === 'intro' && (
        <div className="max-w-md mx-auto py-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
            <Sparkles className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h5 className="text-base font-black text-slate-900 dark:text-white">
              Sebutkan Nama Hewan Sebanyak-banyaknya
            </h5>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Anda memiliki waktu <strong>30 detik</strong> untuk memasukkan nama hewan (misal: Kucing, Gajah, Harimau, Burung). Anda bisa mengetik atau menggunakan tombol mikrofon.
            </p>
          </div>
          <button
            onClick={handleStart}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs inline-flex items-center gap-2 shadow-md shadow-blue-600/25 transition-all"
          >
            <Play className="w-4 h-4" /> Mulai Uji Kelancaran Verbal (30 Detik)
          </button>
        </div>
      )}

      {/* ACTIVE PLAY */}
      {gameState === 'active' && (
        <div className="max-w-lg mx-auto py-3 space-y-4">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddWord()}
              placeholder="Ketik nama hewan (misal: Gajah) lalu Enter..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white"
            />
            <button
              onClick={handleAddWord}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs flex items-center gap-1 shadow-md shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" /> Tambah
            </button>
            <button
              onClick={handleMicSimulate}
              disabled={isListeningMic}
              title="Simulasi Suara Speech-to-Text"
              className="p-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl"
            >
              <Mic className={`w-4 h-4 ${isListeningMic ? 'text-rose-500 animate-pulse' : ''}`} />
            </button>
          </div>

          {/* Word Cloud Tags */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 min-h-[100px] flex flex-wrap gap-2 items-center">
            {words.length === 0 ? (
              <span className="text-xs text-slate-400 italic mx-auto">
                Kata yang Anda masukkan akan muncul di sini...
              </span>
            ) : (
              words.map((w, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-bold text-xs"
                >
                  {w}
                </span>
              ))
            )}
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 font-bold">
              Total Kata Terkumpul: <strong className="text-blue-600 font-mono text-sm">{words.length}</strong>
            </span>
            <button
              onClick={handleManualFinish}
              className="px-4 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
            >
              Selesai Lebih Awal
            </button>
          </div>
        </div>
      )}

      {/* RESULT */}
      {gameState === 'result' && (
        <div className="max-w-md mx-auto py-3 space-y-4 text-center">
          <div className="inline-flex p-3 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h5 className="text-base font-black text-slate-900 dark:text-white">
              Kelancaran Verbal: {words.length} Kata
            </h5>
            <p className="text-xs text-slate-500">
              Tingkat Akses Leksikal: <strong className="text-blue-600 font-bold">{words.length >= 12 ? 'Sangat Baik' : words.length >= 8 ? 'Normal' : 'Perlu Latihan'}</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
