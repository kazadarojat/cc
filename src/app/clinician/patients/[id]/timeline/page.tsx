import { fmtDate, fmtMonth, titleCase } from "@/lib/format";
import { Badge, Dot, Eyebrow } from "@/components/ui";
import { buildTimeline, type TimelineEvent } from "@/lib/queries";
import { patientStaticParams } from "@/lib/static-params";

export async function generateStaticParams() {
  return patientStaticParams();
}

export default async function TimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const events = await buildTimeline(id);
  const ordered = [...events].reverse(); // newest first

  // group by calendar month
  const groups: { month: string; items: TimelineEvent[] }[] = [];
  for (const e of ordered) {
    const key = fmtMonth(e.at);
    const g = groups.at(-1);
    if (g && g.month === key) g.items.push(e);
    else groups.push({ month: key, items: [e] });
  }

  return (
    <div>
      <Eyebrow>Longitudinal cognitive timeline</Eyebrow>
      <h2 className="mt-2 font-display text-2xl font-semibold">Every signal, in order</h2>
      <p className="mt-2 max-w-measure text-sm text-muted">
        Patient-generated and clinician-generated evidence on one axis. Analyses, detected changes and
        discordance flags are interleaved with the raw assessments that produced them.
      </p>

      <div className="mt-8 flex flex-col gap-8">
        {groups.map((g) => (
          <section key={g.month}>
            <h3 className="sticky top-0 z-10 -mx-1 bg-[color-mix(in_srgb,var(--paper)_90%,transparent)] px-1 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-accent-ink backdrop-blur">
              {g.month}
            </h3>
            <ol className="mt-2 border-l border-[var(--border-strong)]">
              {g.items.map((e, i) => (
                <li key={i} className="relative pb-5 pl-6">
                  <span className="absolute -left-[6px] top-[7px] rounded-full ring-4 ring-[var(--paper)]">
                    <Dot tone={e.tone} size={10} />
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tnum font-mono text-[11px] uppercase tracking-wide text-faint">
                      {fmtDate(e.at)}
                    </span>
                    <Badge tone={e.tone}>{titleCase(e.kind)}</Badge>
                  </div>
                  <p className="mt-1 text-sm font-medium">{e.title}</p>
                  {e.detail ? <p className="text-sm text-muted">{e.detail}</p> : null}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
