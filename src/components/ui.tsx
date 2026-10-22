import Link from "next/link";
import type { ReactNode } from "react";

type Tone = "ok" | "watch" | "alert" | "uncertain" | "accent" | "neutral";

const TONE_VAR: Record<Tone, string> = {
  ok: "var(--ok)",
  watch: "var(--watch)",
  alert: "var(--alert)",
  uncertain: "var(--uncertain)",
  accent: "var(--accent)",
  neutral: "var(--faint)",
};

const TONE_TEXT: Record<Tone, string> = {
  ok: "text-[var(--ok)]",
  watch: "text-[var(--watch)]",
  alert: "text-[var(--alert)]",
  uncertain: "text-[var(--uncertain)]",
  accent: "text-accent-ink",
  neutral: "text-muted",
};

/** pale tint of a tone, for pills only */
function softBg(tone: Tone) {
  return `color-mix(in srgb, ${TONE_VAR[tone]} 11%, transparent)`;
}

/* ---------- primitives -------------------------------------------------- */

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex flex-none items-center whitespace-nowrap rounded-[4px] px-1.5 py-[3px] text-[11px] font-medium leading-none ${TONE_TEXT[tone]}`}
      style={{ background: softBg(tone) }}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = "neutral", size = 6 }: { tone?: Tone; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: TONE_VAR[tone] }}
    />
  );
}

export function Card({
  children,
  className = "",
  as: As = "div",
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
  interactive?: boolean;
}) {
  return (
    <As
      className={`rounded-lg border border-line bg-surface ${
        interactive ? "card-interactive" : ""
      } ${className}`}
    >
      {children}
    </As>
  );
}

/** A small label above a value or a group. Sentence case, never tracked caps. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-medium leading-4 text-faint">{children}</p>;
}

export function SectionHeading({
  children,
  sub,
  action,
}: {
  children: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div>
        <h2>{children}</h2>
        {sub ? <p className="mt-1 max-w-[76ch] text-[12px] leading-[18px] text-muted">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** The one title of a screen: a noun, one sentence under it, real actions on the right. */
export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="truncate">{title}</h1>
        {sub ? <p className="mt-1 max-w-[82ch] text-[13px] leading-5 text-muted">{sub}</p> : null}
      </div>
      {actions ? <div className="flex flex-none items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function KeyValue({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5">
      <dt className="text-[11px] leading-4 text-faint">{label}</dt>
      <dd className="text-[13px] leading-5 text-ink">{children}</dd>
    </div>
  );
}

/* ---------- figures ------------------------------------------------------ */

/** One container split by hairlines. Peer figures only. */
export function StatStrip({ children }: { children: ReactNode }) {
  return <div className="strip">{children}</div>;
}

export function Stat({
  label,
  value,
  detail,
  delta,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  delta?: { text: string; tone: Tone; dir: "up" | "down" | "flat" } | null;
  tone?: Tone;
}) {
  return (
    <div>
      <p className="text-[12px] leading-4 text-muted">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span
          className={`tnum text-[24px] font-medium leading-none tracking-[-0.01em] ${
            tone === "neutral" ? "text-ink" : TONE_TEXT[tone]
          }`}
        >
          {value}
        </span>
        {delta ? (
          <span className={`tnum text-[11px] font-medium ${TONE_TEXT[delta.tone]}`}>
            {delta.dir === "up" ? "+" : delta.dir === "down" ? "−" : ""}
            {delta.text}
          </span>
        ) : null}
      </div>
      {detail ? <p className="mt-1.5 text-[11px] leading-4 text-faint">{detail}</p> : null}
    </div>
  );
}

/** Kept for existing callers: one cell of a stat strip. */
export function DimensionTile(props: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: Tone;
  delta?: { text: string; tone: Tone; dir: "up" | "down" | "flat" } | null;
}) {
  return <Stat {...props} />;
}

export function Disclaimer({ children }: { children?: ReactNode }) {
  return (
    <div className="border-l-2 border-[var(--border-strong)] pl-3">
      <p className="text-[12px] leading-[18px] text-muted">
        <span className="font-medium text-ink">Decision support, not a diagnosis.</span>{" "}
        {children ??
          "CogniCare integrates evidence and highlights change over time. It does not diagnose Alzheimer's disease or replace clinician evaluation; where evidence is thin it says so."}
      </p>
    </div>
  );
}

/* ---------- charts ------------------------------------------------------- */

function fmtTick(v: number, unit: "" | "%") {
  return unit === "%" ? `${Math.round(v * 100)}%` : v.toFixed(2);
}

/**
 * A single-series time chart: straight 2px line, 4 faint gridlines, a y scale,
 * first and last x labels, no point markers, no gradient.
 */
export function TrendChart({
  points,
  tone = "accent",
  height = 168,
  unit = "",
  emptyLabel = "One reading so far",
}: {
  points: { label: string; value: number }[];
  tone?: Tone;
  height?: number;
  unit?: "" | "%";
  emptyLabel?: string;
}) {
  const W = 560;
  const H = height;
  const padL = 34;
  const padR = 10;
  const padT = 12;
  const padB = 22;
  const c = TONE_VAR[tone];
  const plotH = H - padT - padB;

  if (points.length < 2) {
    return (
      <div className="relative" style={{ height: H }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label={emptyLabel}>
          <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="var(--grid)" strokeWidth={1} />
          <text x={padL} y={H - 6} fontSize="11" fill="var(--faint)">
            {emptyLabel}
          </text>
        </svg>
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const maxV = Math.max(...values);
  const minV = Math.min(0, ...values);
  // round the top tick up so the line never touches the plot's edge
  const step = unit === "%" ? 0.25 : 0.25;
  const top = Math.min(1, Math.ceil(Math.max(maxV, step) / step) * step);
  const bottom = minV < 0 ? Math.floor(minV / step) * step : 0;
  const span = top - bottom || 1;

  const x = (i: number) => padL + (i * (W - padL - padR)) / (points.length - 1);
  const y = (v: number) => padT + plotH * (1 - (v - bottom) / span);

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(" ");

  const ticks: number[] = [];
  for (let v = bottom; v <= top + 1e-9; v += step) ticks.push(Number(v.toFixed(4)));

  const last = points[points.length - 1];
  const first = points[0];
  const lx = x(points.length - 1);
  const ly = y(last.value);
  const anchorEnd = lx > W - 60;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`${first.label} to ${last.label}`}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={padL}
            y1={y(t)}
            x2={W - padR}
            y2={y(t)}
            stroke="var(--grid)"
            strokeWidth={1}
          />
          <text
            x={padL - 8}
            y={y(t) + 3.5}
            textAnchor="end"
            fontSize="11"
            fill="var(--faint)"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {fmtTick(t, unit)}
          </text>
        </g>
      ))}

      <path d={line} fill="none" stroke={c} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      <text
        x={anchorEnd ? lx - 6 : lx + 6}
        y={ly - 8}
        textAnchor={anchorEnd ? "end" : "start"}
        fontSize="11"
        fontWeight="500"
        fill={c}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {fmtTick(last.value, unit)}
      </text>

      <text x={padL} y={H - 5} fontSize="11" fill="var(--faint)">
        {first.label}
      </text>
      <text x={W - padR} y={H - 5} textAnchor="end" fontSize="11" fill="var(--faint)">
        {last.label}
      </text>
    </svg>
  );
}

/** A compact trend for a list row: 1.5px line, no fill, no markers, no axis. */
export function Sparkline({
  values,
  width = 88,
  height = 22,
  tone = "accent",
  min = 0,
  max = 1,
}: {
  values: number[];
  width?: number;
  height?: number;
  tone?: Tone;
  fill?: boolean;
  min?: number;
  max?: number;
}) {
  if (values.length < 2) {
    return <span className="text-[11px] text-faint">—</span>;
  }
  const lo = Math.min(min, ...values);
  const hi = Math.max(max, ...values);
  const span = hi - lo || 1;
  const pad = 2;
  const c = TONE_VAR[tone];
  const pts = values.map((v, i) => {
    const px = pad + (i * (width - pad * 2)) / (values.length - 1);
    const py = pad + (height - pad * 2) * (1 - (v - lo) / span);
    return `${px.toFixed(1)},${py.toFixed(1)}`;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={c}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Meter({ value, tone = "accent" }: { value: number; tone?: Tone }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-[3px] bg-[var(--surface-3)]">
      <div
        className="h-full rounded-[3px]"
        style={{ width: `${Math.max(1, Math.min(100, value * 100))}%`, background: TONE_VAR[tone] }}
      />
    </div>
  );
}

/* ---------- controls ---------------------------------------------------- */

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
  className?: string;
}) {
  const base =
    "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-[13px] font-medium leading-none";
  const styles =
    variant === "primary"
      ? "bg-[var(--primary)] text-[var(--primary-ink)] hover:opacity-90"
      : "border border-[var(--border-strong)] text-ink hover:bg-[var(--surface-2)]";
  return (
    <Link href={href} className={`${base} ${styles} ${className}`}>
      {children}
    </Link>
  );
}

export { TONE_VAR, TONE_TEXT, softBg };
