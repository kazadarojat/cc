import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { fmtDate } from "@/lib/format";
import { Badge, ButtonLink, Card, Disclaimer, Dot, Eyebrow, SectionHeading, Sparkline, Stat, StatStrip } from "@/components/ui";
import { PageBanner } from "@/components/Banners";
import { buildTimeline, inferenceHistory, latestInference } from "@/lib/queries";

const TREND_COPY: Record<string, { text: string; tone: "ok" | "watch" | "alert" | "uncertain" }> = {
  Stable: { text: "Your recent patterns look steady compared with your usual range.", tone: "ok" },
  Improving: { text: "Your recent patterns show improvement compared with your usual range.", tone: "ok" },
  Changing: {
    text: "A few day-to-day changes have been noticed. Keeping up your check-ins helps.",
    tone: "watch",
  },
  Worsening: {
    text: "Some changes have been detected across your check-ins and shared with your care team.",
    tone: "alert",
  },
  Uncertain: {
    text: "You are still in the early phase. CogniCare is learning your personal baseline.",
    tone: "uncertain",
  },
};

export default async function PatientHome() {
  const session = await getSession("patient");
  if (!session) redirect("/login");
  const patientId = session.subjectId;
  const patient = await db.patient.findUnique({ where: { id: patientId } });
  if (!patient) redirect("/login");
  const [inf, history, timeline] = await Promise.all([
    latestInference(patientId),
    inferenceHistory(patientId),
    buildTimeline(patientId),
  ]);

  const trend = inf ? (TREND_COPY[inf.trajectory] ?? TREND_COPY.Uncertain) : TREND_COPY.Uncertain;
  const series = history.map((h) => h.compositeIndex);

  const checkInKinds = ["speech", "sleep", "cognitive_task", "questionnaire", "diary"];
  const checkInsLogged = timeline.filter((e) => checkInKinds.includes(e.kind)).length;
  const changeRows = await db.changeEvent.findMany({ where: { patientId }, select: { modality: true } });
  const areasWatched = new Set(changeRows.map((c) => c.modality)).size;

  return (
    <div className="flex flex-col gap-8">
      <PageBanner
        variant="patient"
        pill="Digital hub"
        meta={`monitoring ${patient.monitoringStatus.replace(/_/g, " ")}`}
        title={`Hello, ${patient.name.split(" ")[0]}`}
        subtitle="Your speaking check-ins, thinking tasks, sleep and diary feed one longitudinal picture that you and your care team share."
      />

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Dot tone={trend.tone} />
          <span className="text-[11px] uppercase tracking-wide text-faint">
            Monitoring status · {patient.monitoringStatus.replace(/_/g, " ")}
          </span>
        </div>
        <p className="mt-3 text-[15px] leading-[22px] text-ink">{trend.text}</p>
        {inf && series.length > 1 ? (
          <div className="mt-4">
            <Sparkline
              values={series}
              width={280}
              height={48}
              tone={trend.tone === "ok" ? "ok" : trend.tone === "alert" ? "alert" : "accent"}
            />
            <p className="mt-2 text-[11px] text-faint">
              A general trend across your check-ins. Higher means more signals differ from your usual range.
              Your care team sees the detail.
            </p>
          </div>
        ) : null}
      </Card>

      <StatStrip>
        <Stat label="Check-ins logged" value={String(checkInsLogged)} />
        <Stat label="Areas being watched" value={String(areasWatched)} />
        <Stat label="Last analysis" value={inf ? fmtDate(inf.producedAt) : "not yet"} />
      </StatStrip>

      <SectionHeading>Suggested next</SectionHeading>
      <Card className="p-4">
        <ul className="flex flex-col divide-y divide-[var(--border)]">
          <li className="flex items-center justify-between py-2">
            <span className="text-[13px] text-ink">Speaking check-in, 2 to 3 minutes</span>
            <ButtonLink href="/patient/assessments" variant="ghost">Start</ButtonLink>
          </li>
          <li className="flex items-center justify-between py-2">
            <span className="text-[13px] text-ink">NeuroCheck tasks, about 4 minutes</span>
            <ButtonLink href="/patient/neurocheck" variant="ghost">Start</ButtonLink>
          </li>
          <li className="flex items-center justify-between py-2">
            <span className="text-[13px] text-ink">A quick questionnaire</span>
            <ButtonLink href="/patient/assessments" variant="ghost">Start</ButtonLink>
          </li>
          <li className="flex items-center justify-between py-2">
            <span className="text-[13px] text-ink">Note something you noticed</span>
            <ButtonLink href="/patient/diary" variant="ghost">Start</ButtonLink>
          </li>
        </ul>
      </Card>

      <Disclaimer />
    </div>
  );
}