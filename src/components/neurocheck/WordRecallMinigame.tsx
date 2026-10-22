"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Brain, Play, CheckCircle2, RotateCcw, Clock, ArrowRight, Eye, Check, X, Sparkles, Volume2 } from 'lucide-react';
import { soundFx } from '@/lib/audioFeedback';

interface Props {
  onComplete: (data: {
    recallScore: number;
    accuracyPercent: number;
    meanLatencyMs: number;
    recalledWords: string[];
  }) => void;
}

const WORD_SETS = [
  {
    targetWords: ['Melati', 'Sutra', 'Masjid', 'Kuning', 'Jujur'],
    categoryHints: ['Bunga', 'Kain', 'Bangunan', 'Warna', 'Sifat'],
    decoys: ['Mawar', 'Katun', 'Gereja', 'Merah', 'Berani', 'Sepeda', 'Bintang', 'Kucing', 'Sungai', 'Emas'],
  },
  {
    targetWords: ['Jeruk', 'Kereta', 'Rumah', 'Biru', 'Sabar'],
    categoryHints: ['Buah', 'Kendaraan', 'Tempat', 'Warna', 'Karakter'],
    decoys: ['Apel', 'Pesawat', 'Toko', 'Hijau', 'Ramah', 'Lampu', 'Gunung', 'Kelinci', 'Danau', 'Perak'],
  },
];

export const WordRecallMinigame: React.FC<Props> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'intro' | 'encoding' | 'interference' | 'delayed_recall' | 'result'>('intro');
  const [activeSetIndex] = useState(0);
  const currentSet = WORD_SETS[activeSetIndex];

  // Encoding step state
  const [currentWordIdx, setCurrentWordIdx] = useState(0);
  const [encodingTimeRemaining, setEncodingTimeRemaining] = useState(15);
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(true);

  // Interference mini task (Distractor simple math to prevent rehearsal)
  const [mathAnswers, setMathAnswers] = useState({ q1: '', q2: '' });
  const [mathSolved, setMathSolved] = useState(false);

  // Recall step state
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [recallStartTime, setRecallStartTime] = useState<number>(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // All choices for recall (targets + decoys shuffled)
  const [shuffledChoices, setShuffledChoices] = useState<string[]>([]);

  useEffect(() => {
    // Prepare shuffled choices
    const all = [...currentSet.targetWords, ...currentSet.decoys];
    // Deterministic shuffle
    const shuffled = all.sort(() => 0.5 - Math.random());
    setShuffledChoices(shuffled);
  }, [currentSet]);

  // Encoding timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (phase === 'encoding' && encodingTimeRemaining > 0) {
      timer = setInterval(() => {
        setEncodingTimeRemaining((prev) => {
          if (prev <= 1) {
            setPhase('interference');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [phase, encodingTimeRemaining]);

  const handleStartEncoding = () => {
    soundFx.playCorrect();
    setPhase('encoding');
    setEncodingTimeRemaining(15);
    setCurrentWordIdx(0);
  };

  const handleFinishInterference = () => {
    soundFx.playTone(660, 'sine', 0.15, 0.08);
    setPhase('delayed_recall');
    setRecallStartTime(Date.now());
  };

  const handleToggleWord = (word: string) => {
    if (isSubmitted) return;
    const now = Date.now();
    const latency = now - recallStartTime;
    setReactionTimes((prev) => [...prev, latency]);

    if (selectedWords.includes(word)) {
      setSelectedWords(selectedWords.filter((w) => w !== word));
    } else {
      if (selectedWords.length < 5) {
        soundFx.playTone(520, 'sine', 0.08, 0.06);
        setSelectedWords([...selectedWords, word]);
      }
    }
  };

  const handleFinalSubmit = () => {
    setIsSubmitted(true);
    const correctCount = selectedWords.filter((w) => currentSet.targetWords.includes(w)).length;
    const accuracy = Math.round((correctCount / currentSet.targetWords.length) * 100);
    const meanLatency = reactionTimes.length > 0
      ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
      : 1200;

    if (correctCount >= 4) {
      soundFx.playCompleteFanfare();
    } else {
      soundFx.playCorrect();
    }

    onComplete({
      recallScore: correctCount,
      accuracyPercent: accuracy,
      meanLatencyMs: meanLatency,
      recalledWords: selectedWords,
    });

    setPhase('result');
  };

  const correctCount = selectedWords.filter((w) => currentSet.targetWords.includes(w)).length;

  return (
    <div className="bg-slate-50 dark:bg-slate-900/60 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5">
      {/* Minigame Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold">
            <Brain className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Minigame 1: 5-Word Episodic Recall Test
              </h4>
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                Memori Episodik &amp; Delayed Retrieval
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Evaluasi fungsi hipokampus dalam mengkodekan, menyimpan, dan mengingat kembali informasi verbal.
            </p>
          </div>
        </div>

        {/* Phase Indicator */}
        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
          <span className={`px-2 py-0.5 rounded-md ${phase === 'encoding' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>1. Hafal</span>
          <span>→</span>
          <span className={`px-2 py-0.5 rounded-md ${phase === 'interference' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>2. Distraksi</span>
          <span>→</span>
          <span className={`px-2 py-0.5 rounded-md ${phase === 'delayed_recall' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>3. Recall</span>
        </div>
      </div>

      {/* PHASE 1: INTRO */}
      {phase === 'intro' && (
        <div className="max-w-md mx-auto py-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <Eye className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h5 className="text-base font-black text-slate-900 dark:text-white">
              Siap Menghafal 5 Kata?
            </h5>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Anda akan melihat 5 kata secara bersamaan selama 15 detik. Bacalah dalam hati atau ucapkan dengan jelas untuk membantu perekaman memori.
            </p>
          </div>
          <button
            onClick={handleStartEncoding}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs inline-flex items-center gap-2 shadow-md shadow-indigo-600/25 transition-all"
          >
            <Play className="w-4 h-4" /> Mulai Hafalkan Kata
          </button>
        </div>
      )}

      {/* PHASE 2: ENCODING */}
      {phase === 'encoding' && (
        <div className="max-w-lg mx-auto py-4 space-y-4 text-center">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-600" /> Waktu Tersisa:
            </span>
            <span className="text-sm font-mono font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-3 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
              {encodingTimeRemaining} Detik
            </span>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {currentSet.targetWords.map((word, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-white dark:bg-slate-800 border-2 border-indigo-300 dark:border-indigo-700 shadow-sm flex flex-col items-center justify-center gap-1 transform hover:scale-105 transition-transform"
              >
                <span className="text-[10px] font-bold text-indigo-500 uppercase">
                  {currentSet.categoryHints[idx]}
                </span>
                <span className="text-lg font-black text-slate-900 dark:text-white tracking-wide">
                  {word}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <button
              onClick={() => setPhase('interference')}
              className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs inline-flex items-center gap-1.5"
            >
              Sudah Hafal? Lanjut Lebih Cepat <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* PHASE 3: INTERFERENCE / DISTRACTOR */}
      {phase === 'interference' && (
        <div className="max-w-md mx-auto py-4 space-y-4 text-center">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs">
            <span className="font-bold block mb-1">Tugas Jeda Pengalih (Distractor Task):</span>
            Jawab 2 hitungan cepat berikut untuk menguji retensi memori tanpa pengulangan langsung:
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">14 + 7 = ?</span>
              <input
                type="number"
                value={mathAnswers.q1}
                onChange={(e) => setMathAnswers({ ...mathAnswers, q1: e.target.value })}
                placeholder="Hasil"
                className="w-24 text-center py-1 px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-bold"
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">30 - 8 = ?</span>
              <input
                type="number"
                value={mathAnswers.q2}
                onChange={(e) => setMathAnswers({ ...mathAnswers, q2: e.target.value })}
                placeholder="Hasil"
                className="w-24 text-center py-1 px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-bold"
              />
            </div>
          </div>

          <button
            onClick={handleFinishInterference}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs inline-flex items-center gap-2 shadow-md shadow-indigo-600/25"
          >
            Lanjut ke Uji Ingatan Kembali <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* PHASE 4: DELAYED RECALL CHOICES */}
      {phase === 'delayed_recall' && (
        <div className="max-w-xl mx-auto py-2 space-y-4">
          <div className="text-center space-y-1">
            <span className="text-[11px] font-extrabold text-indigo-600 uppercase tracking-wider">
              Pilih 5 Kata yang Muncul di Awal Tadi
            </span>
            <p className="text-xs text-slate-500">
              Pilih persis 5 kata yang telah Anda hafalkan. Dipilih: <strong className="text-indigo-600 font-bold">{selectedWords.length}/5</strong> kata.
            </p>
          </div>

          {/* Shuffled Choice Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
            {shuffledChoices.map((word) => {
              const isSelected = selectedWords.includes(word);
              return (
                <button
                  key={word}
                  disabled={isSubmitted}
                  onClick={() => handleToggleWord(word)}
                  className={`p-3 rounded-xl border text-center font-bold transition-all relative ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20 scale-102'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                  }`}
                >
                  {word}
                  {isSelected && (
                    <span className="absolute top-1 right-1">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex justify-center pt-2">
            <button
              onClick={handleFinalSubmit}
              disabled={selectedWords.length === 0}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs inline-flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" /> Kunci Jawaban &amp; Hitung Performa
            </button>
          </div>
        </div>
      )}

      {/* PHASE 5: RESULT SUMMARY */}
      {phase === 'result' && (
        <div className="max-w-md mx-auto py-3 space-y-4 text-center">
          <div className="inline-flex p-3 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h5 className="text-base font-black text-slate-900 dark:text-white">
              Hasil Recall: {correctCount} / 5 Kata Benar
            </h5>
            <p className="text-xs text-slate-500">
              Akurasi Pengenalan: <strong className="text-indigo-600">{Math.round((correctCount / 5) * 100)}%</strong>
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-left space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Kata Target Asli:</span>
            <div className="flex flex-wrap gap-1.5">
              {currentSet.targetWords.map((w, idx) => {
                const wasRecalled = selectedWords.includes(w);
                return (
                  <span
                    key={idx}
                    className={`px-2 py-0.5 rounded-md font-bold text-[11px] flex items-center gap-1 ${
                      wasRecalled
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {wasRecalled ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} {w}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
