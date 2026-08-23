# HMA Corrective Exercise Tracker — Project Progress

_Last updated: 2026-08-23_

## What This Is
A single-file web app (Vite-served `index.html`) built for ATI Worksite Solutions at
Hendrickson. It runs the Human Movement Assessment (HMA) workflow end to end:

- **Employee Records** — searchable, sortable table; edit / delete; JSON export / import / clipboard sync
- **New Assessment** — movement scoring for 5 movements (Forward Lunge, Single Leg Dip, Shoulder
  Reach, Trunk Rotation, Cervical Rotation), per-side scoring, pain flags, hypermobility flagging,
  OA flag, per-movement Observations and Quality-Focus inputs
- **Exercise Sheet Builder** — auto-suggests exercises from scores (mobility for low scorers,
  stability for hypermobility), cross-category redundancy detection/auto-resolution, OA cautions,
  editable sets/reps, session-time estimate + 20-minute volume warning
- **Printable plan** — grouped by movement with images, type badges, frequency, follow-up /
  re-assessment dates, plus a weekly calendar page (PDF via browser print)
- **Exercise Library** — searchable reference of all 60 exercises
- Dark mode, mobile-responsive layout

Data is stored per-device in browser `localStorage` **by design** — keeping employee health data
off the internet entirely. JSON export / import is the intentional backup and transfer mechanism.
No cloud backend.

---

## Status

### Done
- [x] Vite project scaffolded; `localStorage` polyfill for `window.storage`
- [x] All exercise content, scoring, suggestion, and dedup logic implemented
- [x] 36 of 60 exercises wired to bundled cartoon images (`public/images/`)
- [x] Sortable record columns, mobile responsiveness, dark mode
- [x] JSON export / import / copy / paste record sync
- [x] Cross-category redundancy detection + auto-resolution
- [x] Session-time estimate, volume warning, weekly calendar page
- [x] Plan auto-cutoff aligned to risk bands (plan auto-"Yes" only below 11)
- [x] Date-of-assessment validation on save
- [x] De-duplicated category composition into a single `CAT_EXERCISES` source of truth
- [x] Removed dead image-upload code
- [x] `npm install` / `npm run dev` / `npm run build` all working
- [x] Pushed to GitHub: `Dane-Lee/HMA-Correct-Exercise-Tracker`
- [x] Deployed to Vercel (live)

- [x] Re-import updates an existing record instead of skipping it, without destroying plan work
      (branch `tracker-merge-on-reimport`) — see Session 2026-07-31

### Pipeline work — built, on branch `phase1-badge-number`, NOT merged
See `../HMA-AI/PIPELINE-WORKFLOW-PLAN.md`. **Merging this branch deploys to Vercel.**
Verify first: `../HMA-AI/VERIFICATION-CHECKLIST.md`, sections B and C.

- [x] **Badge #** on the form, in `getFormData()` and `IMPORT_DETAIL_FIELDS` — an import can fill a
      blank badge but never wipes a recorded one. The record list shows `#badge · dept` and flags a
      missing badge inline, so the gap surfaces before a program is built rather than at plan issue.
- [x] **The finalized program persists** under `program` (never `plan`, which is already a
      "Yes"/"No" string). Written on preview; reopening the builder restores it verbatim instead of
      re-deriving suggestions; "Start Over" discards it behind a confirm.
- [x] **The printed sheet reads the stored days** rather than recomputing. `_computeSchedule`
      rebalances, so a recompute could print a different week than the one saved — and later a
      different week than the QR carries. Rescheduled only when the selection itself changes.
- [x] **Fixed a data-loss bug this would have inherited:** `saveRecord()` replaced the whole record
      with `getFormData()`, which knows only the form's own fields. Editing an assessment silently
      dropped the `_importedNotes` stamp — breaking the merge's edited-notes detection — and would
      have dropped `program` too. It merges onto the record now.
- [x] **Cadence plan payload** — `buildPlanPayload()` emits contract v1 from a persisted program;
      a "→ Cadence" button copies it for pasting into Cadence-Admin. Deliberately **no crypto and
      no QR encoder here** (E13): Cadence already has the envelope code and vectors, so this app
      stays dependency-free. Four gates refuse to build — no program, no badge, `plan` is "No"
      (pain flagged: referred, not programmed), or an exercise has left the library.
      `tests/cadence-payload.test.mjs` restates Cadence's validator rules and is negative-controlled.

### In Progress
- [x] ~~Verify the re-import merge end-to-end~~ — verified by the owner; `tracker-merge-on-reimport`
      merged to `main` (`b822a54`) and deployed. `mergeImportedRecord` is live.
- [ ] **Remaining exercise images** — 24 of 60 exercises still have no image
  (Trunk t1–t6; Balance b2/b3/b4/b6/b7; l2/l4/l7; s5/s8; sh1/sh3/sh6/sh8; c3/c9; co3/co5).
  App shows a graceful "No image" placeholder until added.

---

## Notes / Constraints
- **Local-only storage is intentional** — no cloud backend, so no employee health data ever leaves
  the device. Trade-off: records are per-device and are lost if browser data is cleared. **Manual
  JSON export is the backup and device-to-device transfer mechanism** — export regularly.
- **Not pursuing a cloud backend** (Supabase/Firebase/etc.). Considered and explicitly declined to
  keep personal data offline.
- **Printout uses a custom centered running header** (employee name + date, fixed in the reserved
  `@page` top margin, repeats on every page). For it to look right when saving the PDF, turn **off**
  "Headers and footers" in the browser print dialog — otherwise the browser's own off-center header
  is duplicated. This also removes browser page numbers; the plan has its own `.print-footer`.

---

## Session Log

### Session 1 — 2026-06-08
- Recovered the original no-extension HTML file; diagnosed `window.storage` as the blocker
- Scaffolded Vite project with `localStorage` polyfill and bundled images

### Sessions 2–N — through 2026-06-23
- Built out full feature set (see git history): sortable columns, redundancy detection, calendar
  page, volume warning, dark mode, JSON sync, observations/quality-focus, image additions

### Session — 2026-06-25
- Audit pass; refreshed this doc to match reality
- Plan cutoff → 11, added date validation, de-duplicated category lists, removed dead upload code
- Added README.md
- Considered a cloud backend for durability but declined it — local-only JSON is intentional to
  keep employee health data offline

### Session — 2026-07-02
- Print/PDF layout polish (commit `f4b72bb`, pushed to `main`):
  - Centered the "Corrective Exercise Plan" and "Weekly Exercise Schedule" titles by switching
    `.print-header` to a `1fr / auto / 1fr` grid with a right-hand spacer (logo stays left)
  - Added a centered running header (employee name + date) that repeats at the top of every printed
    page — fixed element inside a reserved `@page` top margin (see Notes re: print-dialog setting)
  - Centered the Weekly Schedule day blocks (`.cal-grid` → flex-wrap + `justify-content:center`) so a
    partial last row (e.g. Days 4–5) is centered instead of left-aligned under Day 3
  - Removed the "Auto-adjusted to fit ~20 min…" note from the schedule page
  - Kept each category banner + score together with its exercises across page breaks
    (`break-inside:avoid` on `.print-section`, `break-after:avoid` on `.print-section-header`)

### Session — 2026-07-31
- **Re-import now updates instead of skipping** (commit `a2f3fcf`, branch `tracker-merge-on-reimport`,
  pushed but **not merged to `main`** — pending the end-to-end check above).
  - The problem: both import paths filtered out any record whose `id` already existed, so a score
    corrected in the HMA Manual app and exported again was silently dropped.
  - Why not a blind overwrite: an assessment export carries **empty** `observations`, `qualityFocus`,
    `plan`, `pa`, `followup` and `retest` — all of which are authored *here* after import. Replacing
    the record wholesale would have erased the exercise program built for that person.
  - So the merge is field-classified (`applyImportedRecords` / `mergeImportedRecord`): assessment-owned
    fields always refresh, employee details refresh only when non-blank, plan work is never touched,
    and `notes` refresh only while they still match the `_importedNotes` stamp from the last import
    (i.e. they have not been edited here).
  - Added `npm test` → `tests/import-merge.test.mjs`: runs the real block extracted from `index.html`,
    covers all the rules above, and asserts every one of the 21 fields `getFormData()` writes is
    explicitly classified, so a new field cannot silently fall through.
  - Import button tooltips updated to describe the new behavior.
- Upstream counterpart: the Manual app now sends optional employee details (first/last name, company,
  department, shift, location) — `Dane-Lee/HMA-app`, branch `hma-manual-tracker-feed-v2`.
