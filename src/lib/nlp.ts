// Lightweight keyword classifier for the Cognitive Diary (FR-06).
// A stand-in for the multilingual clinical-NLP layer described in the PRD —
// deterministic, English + Bahasa Indonesia keywords, domain tags only.

const LEXICON: Record<string, string[]> = {
  memory: [
    "forgot", "forget", "forgetting", "remember", "misplaced", "lost my", "where i put",
    "appointment", "repeat myself", "repeated",
    "lupa", "ingat", "kelupaan", "menaruh", "hilang", "janji temu", "mengulang",
  ],
  language: [
    "word", "name", "tip of my tongue", "find the word", "wrong word", "spelling",
    "kata", "nama", "susah bicara", "salah kata", "lupa kata", "mengeja",
  ],
  attention: [
    "concentrate", "focus", "distracted", "lose track", "attention", "zoning out",
    "konsentrasi", "fokus", "terganggu", "kehilangan fokus", "perhatian",
  ],
  orientation: [
    "what day", "date", "got lost", "which way", "confused about time", "disorient",
    "hari apa", "tanggal", "tersesat", "bingung waktu", "arah",
  ],
  executive: [
    "plan", "organize", "organise", "decision", "multitask", "steps", "instructions",
    "manage", "rencana", "mengatur", "keputusan", "langkah", "instruksi", "mengelola",
  ],
  daily_function: [
    "cooking", "cook", "bill", "medication", "driving", "shopping", "chores", "bank",
    "masak", "tagihan", "obat", "menyetir", "belanja", "pekerjaan rumah",
  ],
};

export function classifyDiary(text: string): string[] {
  const t = text.toLowerCase();
  const hits = new Set<string>();
  for (const [domain, kws] of Object.entries(LEXICON)) {
    if (kws.some((k) => t.includes(k))) hits.add(domain);
  }
  if (hits.size === 0) hits.add("memory"); // default bucket for an un-matched complaint
  return [...hits];
}

export const DIARY_DOMAINS = Object.keys(LEXICON);
