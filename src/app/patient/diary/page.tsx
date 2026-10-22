import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { fmtDate, titleCase } from "@/lib/format";
import { Badge, Eyebrow } from "@/components/ui";
import { DiaryForm } from "@/components/DiaryForm";

export const dynamic = "force-dynamic";

export default async function DiaryPage() {
  const session = await getSession();
  const patientId = session!.subjectId;
  const entries = await db.diaryEntry.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Eyebrow>Cognitive diary</Eyebrow>
        <h1 className="mt-2 font-display text-2xl font-bold">Note things as they happen</h1>
        <p className="mt-2 text-sm text-muted">
          Small, specific notes over time are useful: when you forgot something, lost a word, or found
          a familiar task harder than usual.
        </p>
      </div>

      <DiaryForm patientId={patientId} />

      <div className="flex flex-col gap-2">
        {entries.length === 0 ? (
          <p className="text-sm text-faint">No entries yet.</p>
        ) : (
          entries.map((e) => {
            let domains: string[] = [];
            try {
              domains = JSON.parse(e.domains);
            } catch {
              domains = [];
            }
            const sevTone =
              e.severity === "significant" ? "alert" : e.severity === "moderate" ? "watch" : "neutral";
            return (
              <div key={e.id} className="rounded-lg border border-line bg-surface p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] text-faint">{fmtDate(e.createdAt)}</span>
                  {domains.map((d) => (
                    <Badge key={d} tone="neutral">
                      {titleCase(d)}
                    </Badge>
                  ))}
                  <Badge tone={sevTone}>{titleCase(e.severity)}</Badge>
                </div>
                <p className="mt-1.5 text-sm">{e.text}</p>
                {e.context ? (
                  <p className="mt-1 text-xs text-faint">Context: {e.context}</p>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
