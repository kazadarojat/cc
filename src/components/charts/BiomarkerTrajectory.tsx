"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const GRID = "#94a3b833";
const TEXT = "#94a3b8";
const SERIES: Record<string, string> = {
  "p-tau217": "#6366f1", // indigo
  "p-tau181": "#818cf8",
  NfL: "#f43f5e", // rose
  GFAP: "#f59e0b", // amber
  "Abeta42-40": "#10b981", // emerald
};

export type BiomarkerPoint = { date: string; [analyte: string]: number | string | undefined };

export function BiomarkerTrajectory({
  data,
  analytes,
}: {
  data: BiomarkerPoint[];
  analytes: string[];
}) {
  if (data.length < 2) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed border-line text-sm text-faint">
        Needs at least two biomarker draws to plot a trajectory.
      </div>
    );
  }
  return (
    <div style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tick={{ fill: TEXT, fontSize: 10 }} stroke={GRID} />
          <YAxis tick={{ fill: TEXT, fontSize: 10 }} stroke={GRID} width={44} />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--muted)" }}
          />
          {analytes.map((a) => (
            <Line
              key={a}
              type="monotone"
              dataKey={a}
              stroke={SERIES[a] ?? "#6b7684"}
              strokeWidth={2}
              dot={{ r: 2.5 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {analytes.map((a) => (
          <span key={a} className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: SERIES[a] ?? "#6b7684" }} />
            {a}
          </span>
        ))}
      </div>
    </div>
  );
}
