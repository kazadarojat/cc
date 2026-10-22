import Link from "next/link";
import { db } from "@/lib/db";
import { ageFrom, pct, STATE_TONE } from "@/lib/format";
import { Badge, Dot, PageHeader, StatStrip, Stat, Disclaimer } from "@/components/ui";
import { inferenceHistory } from "@/lib/queries";

export const dynamic = "force-dynamic";

function riskTone(r: number | null): "ok" | "watch" | "alert" | "uncertain" {
  if (r == null) return "uncertain";
  if (r >= 0.35) return "alert";
  if (r >= 0.15) return "watch";
  return "ok";
}

const TRAJ_TONE: Record<string, string> = {
  Worsening: "text-[var(--alert)]",
  Changing: "text-[var(--watch)]",
  Stable: "text-muted",
  Improving: "text-[var(--ok)]",
  Uncertain: "text-faint",
};

export default async function ClinicianHome() {
  const patients = await db.patient.findMany({
    orderBy: { name: "asc" },
    include: {
      inferences: { orderBy: { producedAt: "desc" }, take: 1 },
      alerts: { where: { readAt: null } },
    },
  });
  const histories = Object.fromEntries(
    await Promise.all(patients.map(async (p) => [p.id, await inferenceHistory(p.id)] as const)),
  );

  const rows = patients.map((p) => {
    const inf = p.inferences[0];
    const hist = histories[p.id] ?? [];
    const riskNow = inf?.progressionRisk ?? null;
    const riskPrev = hist.length > 1 ? hist[hist.length - 2].progressionRisk : null;
    const riskDelta =
      riskNow != null && riskPrev != null ? Math.round((riskNow - riskPrev) * 100) : null;
    const review = p.alerts.some((a) => a.tier === "clinical_review");
    return { p, inf, riskNow, riskDelta, review, unread: p.alerts.length };
  });

  // triage order: someone who needs a decision first, then the highest risk
  rows.sort((a, b) => {
    if (a.review !== b.review) return a.review ? -1 : 1;
    const ra = a.riskNow ?? -1;
    const rb = b.riskNow ?? -1;
    if (ra !== rb) return rb - ra;
    return a.p.name.localeCompare(b.p.name);
  });

  const reviewCount = rows.filter((r) => r.review).length;
  const worseningCount = rows.filter((r) => r.inf?.trajectory === "Worsening").length;

  return (
    <div className="space-y-7">
      <PageHeader
        title="Memory clinic cohort"
        sub={
          <>
            {patients.length} {patients.length === 1 ? "patient" : "patients"} under monitoring.
            {reviewCount > 0
              ? ` ${reviewCount} with an unread clinical-review alert, highest risk first.`
              : " No clinical-review alerts are open."}
          </>
        }
      />

      <StatStrip>
        <Stat label="Under monitoring" value={patients.length} detail="Active enrolments in this clinic" />
        <Stat
          label="Awaiting review"
          value={reviewCount}
          tone={reviewCount > 0 ? "alert" : "neutral"}
          detail={reviewCount > 0 ? "Unread clinical-review alerts" : "Nothing queued"}
        />
        <Stat
          label="Worsening trajectory"
          value={worseningCount}
          tone={worseningCount > 0 ? "alert" : "neutral"}
          detail="Composite index falling on the latest analysis"
        />
      </StatStrip>

      <section>
        <div className="mb-2 flex items-baseline justify-between gap-4">
          <h2>Triage</h2>
          <span className="text-[11px] text-faint">Sorted by review status, then 12-month risk</span>
        </div>

        {rows.length === 0 ? (
          <div className="panel px-4 py-10 text-center">
            <p className="text-[13px] text-muted">No patients are enrolled yet.</p>
          </div>
        ) : (
          <div className="scroll-x panel">
            <table className="w-full min-w-[660px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  {["Patient", "State", "12-mo risk", "Change", "Trajectory", "Alerts"].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="whitespace-nowrap px-4 py-2 text-[11px] font-medium text-faint"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, inf, riskNow, riskDelta, review, unread }) => {
                  const tone = riskTone(riskNow);
                  return (
                    <tr key={p.id} className="group border-b border-line last:border-0 hover:bg-[var(--surface-2)]">
                      <td className="px-4 py-2.5">
                        <Link href={`/clinician/patients/${p.id}`} className="flex items-center gap-2">
                          {review ? <Dot tone="alert" /> : null}
                          <span className="text-[13px] font-medium text-ink group-hover:underline group-hover:underline-offset-4">
                            {p.name}
                          </span>
                        </Link>
                        <span className="mt-0.5 block text-[11px] text-faint">
                          {ageFrom(p.dateOfBirth)} yr · {p.sex} · {p.monitoringStatus.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        {inf ? (
                          <Badge tone={STATE_TONE[inf.state] ?? "neutral"}>{inf.state}</Badge>
                        ) : (
                          <span className="text-[11px] text-faint">No analysis</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        {riskNow != null ? (
                          <span className="tnum text-[13px] text-ink">{pct(riskNow)}</span>
                        ) : (
                          <span className="text-[11px] text-faint" title="Not enough readings for a 12-month estimate">
                            Not estimable
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        {riskDelta != null && riskDelta !== 0 ? (
                          <span
                            className={`tnum text-[12px] ${
                              riskDelta > 0 ? "text-[var(--alert)]" : "text-[var(--ok)]"
                            }`}
                          >
                            {riskDelta > 0 ? "↑" : "↓"} {Math.abs(riskDelta)} pts
                          </span>
                        ) : (
                          <span className="text-[11px] text-faint">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <span className={`text-[12px] ${TRAJ_TONE[inf?.trajectory ?? "Uncertain"]}`}>
                          {inf?.trajectory ?? "—"}
                        </span>
                        {inf ? (
                          <span className="ml-2 text-[11px] text-faint">conf {inf.confidenceLabel.toLowerCase()}</span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        {unread > 0 ? (
                          <Badge tone={review ? "alert" : "watch"}>
                            {unread} {review ? "review" : "new"}
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-faint">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Disclaimer />
    </div>
  );
}
