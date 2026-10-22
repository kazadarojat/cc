import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { Eyebrow } from "@/components/ui";
import { QuestionnaireForm } from "@/components/QuestionnaireForm";

export const dynamic = "force-dynamic";

const INSTRUMENTS: Record<string, { title: string; intro: string; items: string[] }> = {
  AD8: {
    title: "AD8 Dementia Screening Interview",
    intro:
      "Answer based on changes over the last several years caused by thinking and memory problems. “Yes” means a change is present.",
    items: [
      "Problems with judgement (e.g. bad financial decisions, problems with thinking).",
      "Reduced interest in hobbies or activities.",
      "Repeats questions, stories or statements.",
      "Trouble learning to use a tool, appliance or gadget.",
      "Forgets the correct month or year.",
      "Difficulty handling complicated financial affairs (e.g. bills, cheques).",
      "Difficulty remembering appointments.",
      "Consistent problems with thinking and memory day to day.",
    ],
  },
  "SCD-Q": {
    title: "Subjective Cognitive Decline questionnaire",
    intro:
      "Compared with 2 years ago, and not just occasionally. Answer “Yes” only if it is a persistent change you have noticed yourself.",
    items: [
      "I need more effort to remember things than before.",
      "I more often forget where I put everyday objects.",
      "I forget appointments or planned activities more than before.",
      "I have more trouble finding the right word in conversation.",
      "I lose the thread of a conversation more easily.",
      "I find it harder to concentrate while reading.",
      "I take longer to do familiar mental tasks (e.g. calculations).",
      "I more often forget names of people I know.",
      "I need to write things down that I used to keep in my head.",
      "I get more easily confused about the day or date.",
      "I find planning several steps ahead harder than before.",
      "Others have commented that I am more forgetful.",
    ],
  },
};

export default async function QuestionnairePage({
  params,
}: {
  params: Promise<{ instrument: string }>;
}) {
  const { instrument } = await params;
  const cfg = INSTRUMENTS[instrument];
  if (!cfg) notFound();
  const session = await getSession();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Eyebrow>{instrument}</Eyebrow>
        <h1 className="mt-2 font-display text-2xl font-bold">{cfg.title}</h1>
      </div>
      <QuestionnaireForm
        patientId={session!.subjectId}
        instrument={instrument}
        intro={cfg.intro}
        items={cfg.items}
      />
    </div>
  );
}
