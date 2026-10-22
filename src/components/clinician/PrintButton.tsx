"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white hover:brightness-110 print:hidden"
    >
      <Printer className="h-4 w-4" /> Print / Save PDF
    </button>
  );
}
