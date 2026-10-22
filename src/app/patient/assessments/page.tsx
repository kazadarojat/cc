import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { fmtDate } from "@/lib/format";
import { ButtonLink, Card, Eyebrow } from "@/components/ui";
import { SpeechCapture } from "@/components/SpeechCapture";

export const dynamic = "force-dynamic";

export default async function AssessmentsPage() {
  const session = await getSession();
  const patientId = session!.subjectId;
  const [lastSpeech, lastTask, lastAD8, lastSCD, consents] = await Promise.all([
    db.speechSample.findFirst({ where: { patientId }, orderBy: { capturedAt: "desc" } }),
    db.cognitiveTask.findFirst({ where: { patientId }, orderBy: { takenAt: "desc" } }),
    db.questionnaire.findFirst({ where: { patientId, instrument: "AD8" }, orderBy: { takenAt: "desc" } }),
    db.questionnaire.findFirst({ where: { patientId, instrument: "SCD-Q" }, orderBy: { takenAt: "desc" } }),
    db.consentGrant.findMany({ where: { patientId, withdrawnAt: null } }),
  ]);
  const allowed = new Set(consents.map((c) => c.modality));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>Assessments</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-bold">Your check-ins</h1>
        <p className="mt-2 text-sm text-muted">
          Short, repeatable check-ins. Doing them regularly is what lets Cognicare see change over
          time.
        </p>
      </div>

      <Card className="p-5">
        <Eyebrow>Speaking check-in</Eyebrow>
        <p className="mt-1 text-sm text-muted">
          Last done: {lastSpeech ? fmtDate(lastSpeech.capturedAt) : "not yet"}
        </p>
        <div className="mt-4">
          {allowed.has("speech") ? (
            <SpeechCapture patientId={patientId} />
          ) : (
            <p className="text-sm text-faint">Speech data is turned off in your consent settings.</p>
          )}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <Eyebrow>NeuroCheck battery</Eyebrow>
          <p className="mt-1 text-sm text-muted">
            Last done: {lastTask ? fmtDate(lastTask.takenAt) : "not yet"}
          </p>
          <p className="mt-1 text-xs text-faint">
            Word recall, digit span, Stroop, trail making, verbal fluency.
          </p>
          <div className="mt-4">
            <ButtonLink href="/patient/neurocheck">Start NeuroCheck</ButtonLink>
          </div>
        </Card>

        <Card className="p-5">
          <Eyebrow>Questionnaires</Eyebrow>
          <ul className="mt-2 flex flex-col gap-2">
            <li className="flex items-center justify-between gap-2">
              <span className="text-sm">
                AD8 <span className="text-xs text-faint">· {lastAD8 ? fmtDate(lastAD8.takenAt) : "not yet"}</span>
              </span>
              <ButtonLink href="/patient/questionnaire/AD8" variant="ghost" className="!py-1 !text-xs">
                Open
              </ButtonLink>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="text-sm">
                SCD-Q <span className="text-xs text-faint">· {lastSCD ? fmtDate(lastSCD.takenAt) : "not yet"}</span>
              </span>
              <ButtonLink href="/patient/questionnaire/SCD-Q" variant="ghost" className="!py-1 !text-xs">
                Open
              </ButtonLink>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
