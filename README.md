# Cognicare — MVP prototype

**Live UI showcase (static):** https://kazadarojat.github.io/cc/ — snapshots of the real
interface with demo data. The app itself needs a Node host; Pages only serves the static preview.

Multimodal, longitudinal cognitive-health monitoring and clinical decision support.
This is a **working prototype** of the concept in the Cognicare PRD — not a medical device,
not for clinical use, seeded entirely with synthetic patients.

It demonstrates the core idea end to end: patient-generated digital biomarkers (speech, sleep,
cognitive tasks, questionnaires, a cognitive diary) fused with clinician-entered clinical,
biological and imaging data into three **separate** dimensions —

- **Cognitive state** — Normal / SCD / MCI / Dementia (with confidence)
- **Biological AD evidence** — an AT(N) summary, kept distinct from cognitive state
- **Progression risk** — a 12-month estimate, **gated** behind a data-sufficiency check

plus a trajectory classification, multimodal change + discordance detection, an explainability
breakdown (observed evidence / model inference / recommendation), and an automated longitudinal
clinical summary.

## Stack

- **Next.js 15** (App Router, React 19, TypeScript) + Tailwind CSS
- **Prisma** + **SQLite** (`prisma/dev.db`)
- Mock **multimodal AI engine** in TypeScript (`src/lib/engine/`) — deterministic:
  personal-baseline modelling, robust-z deviation, weighted late fusion, discrete trajectory,
  logistic progression model with a sufficiency gate, SHAP-style contribution attribution.
- No external AI/ML services. Speech "capture" is simulated — no audio is recorded or uploaded.

## Run it

```bash
npm install
npm run setup     # prisma generate + db push + seed 3 demo patients
npm run dev       # http://localhost:3000
```

If `npm install` reports skipped install scripts (hardened npm), approve them once:

```bash
npm approve-scripts @prisma/client @prisma/engines prisma esbuild
npx prisma generate
```

Re-seed at any time with `npm run db:reset`.

## Demo accounts (seeded)

No passwords — pick a role on the landing page.

**Clinicians:** Dr. Andini Kusuma · Dr. Rizal Pratama

**Patients:**

| Patient | Profile in the demo |
| --- | --- |
| **Sari Wibowo** | Progressive case — Normal → SCD → MCI over 6 analyses, High biological AD evidence, ~44% 12-month progression risk, multimodal-change and clinical-review alerts. |
| **Budi Hartono** | Subjective decline — SCD, digital signals drifting while MoCA stays stable → **multimodal discordance flag**; no biomarkers on file. |
| **Ratna Dewi** | Preventive monitoring — Normal / Stable; progression risk **not estimated** (insufficient longitudinal span) — demonstrates the "insufficient evidence" path. |

## What maps to the PRD

| PRD | Where |
| --- | --- |
| FR-01 profile & consent | `/patient/consent`, `ConsentGrant` model |
| FR-02–06 patient modalities | `/patient/assessments`, `/patient/task`, `/patient/diary`, `submitSpeechSample` |
| FR-08–10 clinician data | `/clinician/patients/[id]/data` |
| FR-11 personal baseline | `src/lib/engine/compute.ts` → `computeBaseline` |
| FR-12 longitudinal timeline | `/clinician/patients/[id]/timeline`, `/patient/timeline` |
| FR-13–17, 20 risk engine | `src/lib/engine/` → `analyzePatient` |
| FR-18 discordance | `src/lib/engine/explain.ts` → `detectDiscordance` |
| FR-19 explainability | `/clinician/patients/[id]/evidence` |
| FR-21 dashboard | `/clinician/patients/[id]` |
| FR-22–23 recommendations & summary | `/clinician/patients/[id]/summary` |
| FR-24 tiered alerts | `Alert` model, dashboard |
| FR-25 patient dashboard | `/patient` |
| FR-28 missing-data handling | sufficiency gate + confidence downgrade |

## Layout

```
prisma/schema.prisma        data model (append-only inferences, per-modality tables)
prisma/seed.ts              3 synthetic patients + backfilled analysis history
src/lib/engine/             the mock multimodal AI engine
  markers.ts                raw records → oriented marker time series
  compute.ts                baseline, signals, fusion, trajectory, AT(N), progression, confidence
  explain.ts                change / discordance detection, factors, narrative, recs, alerts
  index.ts                  analyzePatient() + runInference() persistence
src/lib/actions.ts          server actions (each re-runs the engine)
src/app/clinician/…         clinician portal
src/app/patient/…           patient portal
```

## Limitations (by design, for a prototype)

- Auth is a role cookie, not real identity. Two "trust zones" are modelled, not secured.
- The engine's coefficients are hand-tuned for plausible demo behaviour, **not** trained or
  calibrated on real data. Numbers are illustrative.
- Speech, imaging feature extraction and behavioural biomarkers are stubbed.
- No FHIR/DICOM integration, no research plane, no audit store.

See `cognicare-architecture` (the companion architecture plan) for how a real build would differ.
