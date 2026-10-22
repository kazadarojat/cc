import type { Config } from "tailwindcss";

const config: Config = {
  // `dark:` applies under an explicit .dark class OR data-theme="dark".
  // A small script in layout.tsx keeps .dark in sync with the resolved theme so
  // components ported from Neurosight (which use dark: utilities) stay consistent
  // with CogniCare's CSS-variable theming.
  darkMode: [
    "variant",
    [
      '&:where(.dark, .dark *)',
      '&:where([data-theme="dark"], [data-theme="dark"] *)',
    ],
  ],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        line: "var(--border)",
        "line-strong": "var(--border-strong)",
        accent: "var(--accent)",
        "accent-ink": "var(--accent-ink)",
        "accent-soft": "var(--accent-soft)",
        ok: "var(--ok)",
        watch: "var(--watch)",
        alert: "var(--alert)",
        uncertain: "var(--uncertain)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      maxWidth: {
        measure: "72ch",
      },
      boxShadow: {
        card: "0 1px 2px rgba(27,36,48,.06), 0 8px 24px -12px rgba(27,36,48,.18)",
      },
    },
  },
  plugins: [],
};

export default config;
