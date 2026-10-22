"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const GRID = "#94a3b833";
const TEXT = "#94a3b8";
const COL: Record<string, string> = {
  Normal: "#10b981",
  SCD: "#f59e0b",
  MCI: "#fb923c",
  Dementia: "#f43f5e",
};

export type TrajectoryPoint = {
  date: string;
  Normal: number;
  SCD: number;
  MCI: number;
  Dementia: number;
};

export function TrajectoryMap({ data }: { data: TrajectoryPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-line text-sm text-faint">
        Needs at least two analyses to plot a stage trajectory.
      </div>
    );
  }
  return (
    <div style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} stackOffset="expand" margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tick={{ fill: TEXT, fontSize: 10 }} stroke={GRID} />
          <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fill: TEXT, fontSize: 10 }} stroke={GRID} width={44} />
          <Tooltip
            formatter={(v: number) => `${Math.round(v)}%`}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--muted)" }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {(["Normal", "SCD", "MCI", "Dementia"] as const).map((k) => (
            <Area
              key={k}
              type="monotone"
              dataKey={k}
              stackId="1"
              stroke={COL[k]}
              fill={COL[k]}
              fillOpacity={0.55}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
