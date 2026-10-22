# Neurosight → CogniCare merge plan

**Decision:** port Neurosight's features into the Next.js CogniCare app (keep Prisma
persistence + server actions), and **merge the engines** — Neurosight's per-modality
scoring + missing-data model on top of CogniCare's baseline-relative fusion,
sufficiency gate, calibration and persistence.

Neurosight source is vendored read-only at `neurosight-reference/` (git-ignored,
excluded from the build) as the porting reference.

---

## Phase 1 — done

| Area | What landed |
| --- | --- |
| Tooling | `lucide-react`, `recharts`, `motion`, `clsx`, `tailwind-merge`; `src/lib/cn.ts`; `dark:` variant now keys off `.dark` **or** `[data-theme]` with a sync script in `layout.tsx` so ported components stay theme-consistent |
| Engine merge v1 | `src/lib/engine/modality.ts` — per-modality 0–100 risk (`speech/sleep/cognitiveTask/questionnaire/clinicalCognitive/fluidBiomarker/imaging`) adapted to CogniCare's bundle; `MissingDataStatus` (sufficiency label + confidence penalty) folded into the confidence label. CogniCare's state/trajectory/**progression sufficiency gate** stay authoritative. Persisted on `Inference` (`modalityScores`, `dataSufficiency`, `confidencePenalty`, `missingDataNote`). Surfaced on the clinician overview ("Per-modality risk" + "Data sufficiency"). |
| Feature port #1 | **NeuroCheck battery** — 5 ported minigames (word recall, digit span, Stroop, trail making, verbal fluency) under `src/components/neurocheck/`, guided flow orchestrator, `/patient/neurocheck` route (replaces `/patient/task`), `submitNeuroCheck` server action writing richer `CognitiveTask` telemetry (`source`, `neuroScore`, `digitSpanMax`, `reactionTimeMs`, `stroopInhibition`, `trailSeconds`, `fluencyWords`) and re-running inference |

---

## Phase 2 — clinician analytics widgets + richer engine outputs — done

| Area | What landed |
| --- | --- |
| Engine | `src/lib/engine/staging.ts` — `stageProbabilities {Normal,SCD,MCI,Dementia}` (Neurosight bands, AD→Dementia), `projection24m` (12-month risk × 1.42, only when not gated), `biologicalAdRiskBand` (Low/Moderate/High/Unknown from AT(N)), `reversibleContributors[]` (sleep / mood / metabolic / polypharmacy / cardiovascular, each Controlled/Review/Significant factor + recommendation). Additive on `EngineResult`; persisted on `Inference` (`stageProbabilities`, `progressionRisk24m`, `biologicalAdRiskBand`, `reversibleContributors`). |
| Widgets | `src/components/charts/` — `StageProbabilityBar` (pure CSS segmented bar), `ModalityRadar` (recharts RadarChart of the 8 modality scores), `BiomarkerTrajectory` (recharts LineChart, per-analyte series over draws). `recharts` pinned at 2.15. |
| Route | New **Analytics** tab (`/clinician/patients/[id]/analytics`) — stage band + 12/24-mo projection + bio-AD band, modality radar, biomarker trajectory, reversible-contributors grid. |
| Fix | Stale-session guard in both layouts — a session pointing at a deleted patient/clinician (e.g. after a re-seed) now redirects to `/login` instead of throwing `findUniqueOrThrow`. |

### Still open in this area (Phase 2b)

- `featureContributions[]` (SHAP-style, richer than current `factors`) + `ExplainableAIModal`
- `ChangeDetectionAlertsCard` / `PersonalBaselineCard` as dedicated widgets (data already exists)
- `DiscordanceDetectionCard` richer than the evidence-tab banner
- `clinicalRecommendations` / `patientActionItems` stage-specific lists (Neurosight has fuller copy)
- recharts widgets currently use a fixed theme-neutral palette (recharts writes SVG attributes, not CSS vars); revisit for exact light/dark parity

## Phase 3 — patient assessment surfaces — partly done

| Area | What landed |
| --- | --- |
| Digital behavioural biomarkers (FR-07) — end to end | New `BehaviourDaily` model; `computeModalityScores.digitalBehavior` now a real score (was always `null`), gated by an active `behavioral` `ConsentGrant` **and** data on file; 4 behavioural markers added to `markers.ts` so it also feeds the baseline-relative composite; `behavioral` added to `ModalityKey` / `ALL_MODALITIES` / `MODALITY_WEIGHT`. Patient route `/patient/behaviour` — opt-in gated (prompts to consent settings when off; metric tiles + "simulate a week of passive data" when on). `simulateBehaviourWeek` action; toggling behavioural consent re-runs inference. Seed gives Sari 21 days (she consents); Budi/Ratna none. |
| Cognitive diary — Neurosight domain/severity model | `DiaryEntry` gains `severity` (mild/moderate/significant) + `context`; `DiaryForm` adds a severity select, a context field and a live NLP domain suggestion; diary list shows severity badge + context; `submitDiary` persists them. |

### Still open in this area (Phase 3b)

- Port `SpeechBiomarkerAssessment` richer flow (task picker → simulated record → feature readout);
  current `SpeechCapture` is a single button. Keep the `simulated` flag.
- `SleepBiomarkers` patient entry form (sleep data currently only from seed / clinician).
- `SubjectiveQuestionnaires` fuller item sets from Neurosight (IADL, the 6 memory-complaint booleans).
- `PatientDashboard` polish pass with the ported widgets.
- Behavioural score into `reversibleContributors` / discordance logic.

## Phase 4 — data model + workflow parity

- **Longitudinal visits**: Neurosight's `LongitudinalVisit` bundles all modalities per visit.
  CogniCare stores per-modality rows already; add a `Visit` grouping + a "record a visit" flow
  for clinicians (`ClinicalAssessmentForm` port).
- **Account management**: `AddPatient/EditPatient/PatientProfile` + doctor equivalents +
  `DataManagementModal` → real CRUD server actions against Prisma (replaces localStorage).
  Needs a proper `Clinician` auth story (currently a role cookie).
- **Imaging fields**: extend `Imaging` with `mriHippocampalVolume`, `scheltensAtrophyGrade`,
  `amyloidPetCentiloid`, `tauPetBraakStage`, `apoeStatus` on `Biomarker` — feeds `imagingScore`
  / `fluidBiomarkerScore` precisely instead of parsing report text.
- **MultimodalSimulator** port — "what-if" parameter sweep that writes a scenario patient.

## Phase 5 — Gemini narrative (optional, needs a key)

- `automatedClinicalSummary` via `@google/genai` behind a Next route handler
  (`/api/patients/[id]/summary/generate`), `GEMINI_API_KEY` server-side only.
  Falls back to the current deterministic `buildNarrative` when no key is set.

---

## Notes / risks

- **Two visual languages**: ported minigames keep Neurosight's indigo/slate look inside an
  "assessment mode" shell; the rest of the app stays on CogniCare's Source Serif + teal.
  Phase 2+ widgets should be restyled to CogniCare tokens as they land, not pasted verbatim.
- **recharts v2** pinned (v3 has React 19 peer issues in this setup); revisit.
- Backfilled historical `Inference` rows have empty `modalityScores` — only the live
  `runInference` populates them. Re-run analysis per patient to fill.
- The engine merge keeps **CogniCare's** progression-risk gate; Neurosight's looser
  `progressionProbability12m` is available as a secondary number if wanted (Phase 2).

---

## Phase 4 — full NeuroPredict feature parity — done

| Feature area | What landed |
| --- | --- |
| **Toast system** | `ToastProvider` + `useToast` + `<Toaster>` (bottom-right), wired in root layout; used by all CRUD client components |
| **Account management (real Prisma CRUD)** | `Patient` += `medicalRecordNumber`, `phone`, `email`, `assignedDoctorId`; `Clinician` += `title`, `sipNumber`, `institution`, `phone`. Actions in `src/lib/admin-actions.ts`: `createPatient` / `updatePatient` / `deletePatient` / `createClinician` / `updateClinician` / `deleteClinician` / `wipeAllPatients` / `loadSamplePatient`. Pages: `/clinician/patients/new`, `/clinician/patients/[id]/edit` (`PatientForm`), `/clinician/clinicians` (`ClinicianManager` inline add/edit/delete), `/clinician/admin` (counts + load-sample + danger-zone wipe). New `ClinicianNav`: Cohort / New patient / Clinicians / Research / Data. |
| **Clinician dashboard cards** (added to Overview) | `ChangeAlertsCard` (12), `DiscordanceCard` (13), `PersonalBaselineCard` (14 comparison matrix), `AISafetyCard` (19 missing-data resilience), `ClinicalRecommendationCard` (17 + 18 reversible contributors). Data from a new persisted `signalSummary` JSON on `Inference`. |
| **Explainable AI** | Engine `buildFeatureContributions` → SHAP-style `featureContributions` (name, category Patient/Clinician, weight%, impact, raw value, delta) persisted on `Inference`; `FeatureContributionsCard` (16) on the Analytics tab. |
| **Cognitive trajectory map** | `TrajectoryMap` recharts stacked-area of stage probabilities (`stageProbabilities`) across analyses; on the Analytics tab. |
| **Multimodal simulator** | `/clinician/patients/[id]/simulate` (Simulator tab) — sliders for MoCA / p-tau217 / speech pause / sleep fragmentation / AD8; `simulateScenario` server action clones the bundle, applies a single-variable perturbation to the latest record, re-runs `analyzePatient` (not persisted), returns before/after state, confidence, trajectory, composite, 12/24-mo risk, AD band. |
| **Research dashboard (FR-29)** | `/clinician/research` — de-identified cohort evaluation: AUROC (Mann–Whitney), sensitivity / specificity / PPV / F1 at threshold, SVG ROC curve, calibration bins (predicted vs observed), confusion matrix, subgroup AUROC by sex. Computed over the seeded cohort, clearly labelled illustrative. |
| **Clinical report** | `/clinician/patients/[id]/report` (Report tab) — a 9-section print-styled longitudinal report (state / AT(N) / progression / per-modality / changes / sufficiency / reversible contributors / history / narrative + recommendations) with a signature block and `window.print()` button (`print:` CSS). |

### Still open (Phase 4b — patient surfaces)

- Richer `SpeechBiomarkerAssessment` flow (task picker → simulated record → feature readout); current `SpeechCapture` is one button.
- `SleepBiomarkers` patient entry form.
- Fuller `SubjectiveQuestionnaires` (IADL score + the six memory-complaint booleans).
- Navbar role switcher / in-app patient selector (currently a separate login).
- Gemini-backed `automatedClinicalSummary` (optional, needs `GEMINI_API_KEY`).
