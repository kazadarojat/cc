import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { Card, Eyebrow, SectionHeading } from "@/components/ui";
import { addBiomarker, addClinicalAssessment, addImaging } from "@/lib/actions";

export const dynamic = "force-dynamic";

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm";
const label = "font-mono text-[11px] uppercase tracking-wide text-faint";
const submit =
  "rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:opacity-90";

export default async function DataPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [clin, bio, img] = await Promise.all([
    db.clinicalAssessment.findMany({ where: { patientId: id }, orderBy: { administeredAt: "desc" }, take: 5 }),
    db.biomarker.findMany({ where: { patientId: id }, orderBy: { drawnAt: "desc" }, take: 6 }),
    db.imaging.findMany({ where: { patientId: id }, orderBy: { acquiredAt: "desc" }, take: 4 }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Eyebrow>Clinician data entry</Eyebrow>
        <h2 className="mt-2 font-display text-2xl font-semibold">Add clinical, biological & imaging data</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Each submission re-runs the multimodal analysis and appends a point to the longitudinal
          record.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* cognitive assessment */}
        <Card className="p-5">
          <SectionHeading>Cognitive assessment</SectionHeading>
          <form action={addClinicalAssessment.bind(null, id)} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className={label}>Instrument</span>
              <select name="instrument" className={field} defaultValue="MoCA">
                <option value="MoCA">MoCA</option>
                <option value="MMSE">MMSE</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={label}>Score (/30)</span>
              <input name="score" type="number" min={0} max={30} step={1} required className={field} />
            </label>
            <button type="submit" className={submit}>
              Add assessment
            </button>
          </form>
        </Card>

        {/* clinical note */}
        <Card className="p-5">
          <SectionHeading>Clinical note</SectionHeading>
          <form action={addClinicalAssessment.bind(null, id)} className="flex flex-col gap-3">
            <input type="hidden" name="instrument" value="note" />
            <label className="flex flex-col gap-1">
              <span className={label}>Note</span>
              <textarea name="noteText" rows={5} required className={field} placeholder="History, examination, plan…" />
            </label>
            <button type="submit" className={submit}>
              Save note
            </button>
          </form>
        </Card>

        {/* biomarker */}
        <Card className="p-5">
          <SectionHeading>Blood biomarker</SectionHeading>
          <form action={addBiomarker.bind(null, id)} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className={label}>Analyte</span>
              <select name="analyte" className={field} defaultValue="p-tau217">
                <option value="p-tau217">p-tau217</option>
                <option value="p-tau181">p-tau181</option>
                <option value="Abeta42-40">Aβ42/Aβ40</option>
                <option value="NfL">NfL</option>
                <option value="GFAP">GFAP</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className={label}>Value</span>
                <input name="value" type="number" step="any" required className={field} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={label}>Unit</span>
                <input name="unit" defaultValue="pg/mL" className={field} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className={label}>Ref low</span>
                <input name="refLow" type="number" step="any" className={field} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={label}>Ref high</span>
                <input name="refHigh" type="number" step="any" className={field} />
              </label>
            </div>
            <button type="submit" className={submit}>
              Add result
            </button>
          </form>
        </Card>

        {/* imaging */}
        <Card className="p-5 lg:col-span-3">
          <SectionHeading>Imaging record</SectionHeading>
          <form action={addImaging.bind(null, id)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-1 sm:w-48">
              <span className={label}>Modality</span>
              <select name="modality" className={field} defaultValue="MRI">
                <option value="MRI">MRI</option>
                <option value="amyloid_PET">Amyloid PET</option>
                <option value="tau_PET">Tau PET</option>
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className={label}>Report / key findings</span>
              <input
                name="report"
                required
                className={field}
                placeholder="e.g. medial temporal atrophy MTA 2; amyloid PET visual read positive"
              />
            </label>
            <button type="submit" className={submit}>
              Add imaging
            </button>
          </form>
          <p className="mt-2 font-mono text-[11px] text-faint">
            The engine parses the report text for keywords (atrophy, amyloid-positive, tau-positive) to
            derive AT(N). Physician oversight of imaging interpretation is assumed.
          </p>
        </Card>
      </div>

      <section>
        <SectionHeading>On file</SectionHeading>
        <div className="grid gap-4 md:grid-cols-3">
          <RecentList
            title="Assessments"
            rows={clin.map((c) => ({
              a: c.instrument === "note" ? "Note" : `${c.instrument} ${c.score}/${c.maxScore}`,
              b: fmtDate(c.administeredAt),
            }))}
          />
          <RecentList
            title="Biomarkers"
            rows={bio.map((m) => ({ a: `${m.analyte} ${m.value} ${m.unit}`, b: fmtDate(m.drawnAt) }))}
          />
          <RecentList
            title="Imaging"
            rows={img.map((m) => ({ a: m.modality.replace(/_/g, " "), b: fmtDate(m.acquiredAt) }))}
          />
        </div>
      </section>
    </div>
  );
}

function RecentList({ title, rows }: { title: string; rows: { a: string; b: string }[] }) {
  return (
    <Card className="p-4">
      <Eyebrow>{title}</Eyebrow>
      <ul className="mt-2 flex flex-col gap-1.5">
        {rows.length === 0 ? (
          <li className="text-sm text-faint">none</li>
        ) : (
          rows.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-sm">
              <span>{r.a}</span>
              <span className="font-mono text-[11px] text-faint">{r.b}</span>
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}
