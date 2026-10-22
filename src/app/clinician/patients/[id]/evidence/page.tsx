import { db } from "@/lib/db";
import { titleCase } from "@/lib/format";
import { Badge, Card, Disclaimer, Dot, Eyebrow, Meter, SectionHeading } from "@/components/ui";
import { analyzePatient, loadBundle } from "@/lib/engine";

export const dynamic = "force-dynamic";

export default async function EvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patient = await db.patient.findUniqueOrThrow({ where: { id } });
  const bundle = await loadBundle(id);
  const r = analyzePatient(patient, bundle);

  const grouped = {
    observed: r.factors.filter((f) => f.evidenceType === "observed"),
    inferred: r.factors.filter((f) => f.evidenceType === "inferred"),
  };
  const discord = await db.discordanceFlag.findMany({ where: { patientId: id } });

  const bySignalModality = new Map<string, typeof r.signals>();
  for (const s of r.signals) {
    if (!bySignalModality.has(s.modality)) bySignalModality.set(s.modality, []);
    bySignalModality.get(s.modality)!.push(s);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Eyebrow>Explainability</Eyebrow>
        <h2 className="mt-2 font-display text-2xl font-semibold">What the analysis is built on</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          The system separates <strong>observed evidence</strong> (measurements), <strong>model
          inference</strong> (what the engine concluded) and <strong>recommendation</strong> (decision
          support). Nothing here is a diagnosis.
        </p>
      </div>

      {discord.length > 0 && (
        <Card className="border-l-[3px] border-l-[var(--alert)] p-4">
          <Badge tone="alert">Multimodal discordance</Badge>
          {discord.map((d) => (
            <p key={d.id} className="mt-2 text-sm text-muted">
              {d.description}
            </p>
          ))}
        </Card>
      )}

      <section>
        <SectionHeading sub="Ranked by contribution to the current composite index.">
          Observed evidence
        </SectionHeading>
        <div className="flex flex-col gap-2">
          {grouped.observed.map((f, i) => (
            <div key={i} className="rounded-lg border border-line bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Dot tone={f.direction === "up" ? "alert" : "ok"} />
                  {f.label}
                </span>
                <span className="font-mono text-[11px] text-faint">
                  {titleCase(String(f.modality))} · {(f.weight * 100).toFixed(0)}%
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">{f.detail}</p>
              <div className="mt-2 max-w-xs">
                <Meter value={f.weight} tone={f.direction === "up" ? "alert" : "ok"} />
              </div>
            </div>
          ))}
          {grouped.observed.length === 0 && (
            <p className="text-sm text-muted">No signal is deviating materially from baseline.</p>
          )}
        </div>
      </section>

      <section>
        <SectionHeading sub="Conclusions the engine drew by combining the evidence above.">
          Model inference
        </SectionHeading>
        <div className="flex flex-col gap-2">
          {grouped.inferred.map((f, i) => (
            <div key={i} className="rounded-lg border border-line bg-surface p-3">
              <span className="text-sm font-medium">{f.label}</span>
              <p className="mt-1 text-xs text-muted">{f.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading sub="Signal-level detail: recent value vs the patient's own baseline. Robust z ≥ 1.5 flags a meaningful change.">
          Signal detail
        </SectionHeading>
        <div className="scroll-x rounded-xl border border-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-[var(--surface-2)] text-left font-mono text-[11px] uppercase tracking-wide text-muted">
                <th className="px-3 py-2">Marker</th>
                <th className="px-3 py-2">Modality</th>
                <th className="px-3 py-2 text-right">Baseline</th>
                <th className="px-3 py-2 text-right">Recent</th>
                <th className="px-3 py-2 text-right">Δ vs baseline</th>
                <th className="px-3 py-2 text-right">Robust z</th>
              </tr>
            </thead>
            <tbody>
              {r.signals
                .slice()
                .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))
                .map((s) => (
                  <tr key={s.markerKey} className="border-t border-line">
                    <td className="px-3 py-2">{s.label}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-faint">
                      {titleCase(String(s.modality))}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {s.baselineRaw.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {s.recentRaw.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {s.relChange >= 0 ? "+" : "−"}
                      {Math.abs(s.relChange * 100).toFixed(0)}%
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono tabular-nums ${
                        Math.abs(s.deviation) >= 1.5
                          ? s.deviation > 0
                            ? "text-[var(--alert)]"
                            : "text-[var(--ok)]"
                          : "text-faint"
                      }`}
                    >
                      {s.deviation >= 0 ? "+" : ""}
                      {s.deviation.toFixed(1)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionHeading>Data sufficiency</SectionHeading>
        <div className="grid gap-2 sm:grid-cols-2">
          <Card className="p-4">
            <Eyebrow>Modalities used</Eyebrow>
            <p className="mt-1 text-sm">{r.availableModalities.map((m) => titleCase(m)).join(", ")}</p>
          </Card>
          <Card className="p-4">
            <Eyebrow>Modalities missing</Eyebrow>
            <p className="mt-1 text-sm">
              {r.missingModalities.length ? r.missingModalities.map((m) => titleCase(m)).join(", ") : "none"}
            </p>
          </Card>
        </div>
        <p className="mt-3 text-sm text-muted">
          {r.progression.sufficiency === "sufficient"
            ? `Progression risk estimated over ${r.progression.horizonMonths} months at ${(
                (r.progression.risk ?? 0) * 100
              ).toFixed(0)}% with ${(
                (r.progression.confidence ?? 0) * 100
              ).toFixed(0)}% model confidence.`
            : r.progression.note}
        </p>
      </section>

      <Disclaimer />
    </div>
  );
}
