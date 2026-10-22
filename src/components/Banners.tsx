import type { ReactNode } from "react";

/** Quiet page header. Same prop surface as the old gradient banner, no chrome. */
export function PageBanner({
  variant = "clinician",
  pill,
  title,
  meta,
  subtitle,
  actions,
}: {
  variant?: "clinician" | "patient";
  pill: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="border-b border-line pb-3">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[11px] uppercase tracking-[0.08em] text-faint">{pill}</span>
            {meta ? <span className="text-[11px] text-faint">{meta}</span> : null}
          </div>
          <h1 className="mt-1 text-[19px] font-semibold leading-tight tracking-[-0.01em] text-ink sm:text-[21px]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 max-w-[68ch] text-[12px] leading-[18px] text-muted">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-none flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <span className="sr-only">{variant}</span>
    </header>
  );
}

/** One line of context about the platform. Deliberately not a card. */
export function PlatformBanner() {
  return (
    <p className="border-b border-line py-2 text-[11px] leading-4 text-faint">
      Multimodal cognitive-progression risk: patient digital biomarkers (speech, sleep, AD8, behaviour) and
      clinician data (MoCA, plasma p-tau217, MRI) tracked across Normal → SCD → MCI → Dementia under the
      NIA-AA and IWG-2 framework.
    </p>
  );
}
