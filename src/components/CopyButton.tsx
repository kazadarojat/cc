"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          setCopied(false);
        }
      }}
      className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:bg-[var(--surface-2)]"
    >
      {copied ? "Copied" : "Copy as text"}
    </button>
  );
}
