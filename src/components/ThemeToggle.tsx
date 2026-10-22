"use client";

import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";

const STORAGE_KEY = "cognicare-theme";

const OPTIONS: { value: Mode; label: string; title: string }[] = [
  { value: "system", label: "Auto", title: "Follow the operating system" },
  { value: "light", label: "Light", title: "Always light" },
  { value: "dark", label: "Dark", title: "Always dark" },
];

function applyMode(mode: Mode) {
  const root = document.documentElement;
  if (mode === "system") {
    root.removeAttribute("data-theme");
    root.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches);
  } else {
    root.setAttribute("data-theme", mode);
    root.classList.toggle("dark", mode === "dark");
  }
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stored: Mode = "system";
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "light" || raw === "dark" || raw === "system") stored = raw;
    } catch {
      /* storage blocked — fall back to the system preference */
    }
    setMode(stored);
    setReady(true);
  }, []);

  function choose(next: Mode) {
    setMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    applyMode(next);
  }

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className="inline-flex items-center rounded-[4px] border border-[var(--border)] p-[2px]"
    >
      {OPTIONS.map((option) => {
        const active = ready && mode === option.value;
        return (
          <button
            key={option.value}
            type="button"
            title={option.title}
            aria-pressed={active}
            onClick={() => choose(option.value)}
            className={`rounded-[3px] px-1.5 py-[3px] text-[11px] leading-4 ${
              active
                ? "bg-[var(--surface-3)] font-medium text-ink"
                : "text-faint hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
