"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

type Scores = Record<string, number | null>;

// theme-neutral palette (recharts writes these as SVG attributes, so no CSS vars)
const ACCENT = "#6366f1"; // indigo-500
const GRID = "#94a3b855";
const TEXT = "#94a3b8";

const AXES: { key: string; label: string }[] = [
  { key: "speech", label: "Speech" },
  { key: "sleep", label: "Sleep" },
  { key: "cognitiveTask", label: "Tasks" },
  { key: "questionnaire", label: "Questnre" },
  { key: "clinicalCognitive", label: "Clinical" },
  { key: "fluidBiomarker", label: "Fluid bio" },
  { key: "imaging", label: "Imaging" },
  { key: "digitalBehavior", label: "Behaviour" },
];

export function ModalityRadar({ scores }: { scores: Scores }) {
  const data = AXES.map((a) => ({
    axis: a.label,
    value: scores[a.key] == null ? 0 : (scores[a.key] as number),
  }));

  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke={GRID} />
          <PolarAngleAxis dataKey="axis" tick={{ fill: TEXT, fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fill: TEXT, fontSize: 9 }} stroke={GRID} />
          <Radar dataKey="value" stroke={ACCENT} fill={ACCENT} fillOpacity={0.22} isAnimationActive={false} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
