# HMA Corrective Exercise Tracker

A single-page web app for ATI Worksite Solutions (Hendrickson) that runs the **Human Movement
Assessment** workflow: score employees on five movements, auto-suggest corrective exercises, and
print a personalized exercise plan with a weekly schedule.

> Built as one self-contained `index.html` (HTML + CSS + vanilla JS), served and bundled by Vite.

## Features

- **Employee Records** — searchable, sortable table; edit / delete; JSON export, import, and
  copy/paste clipboard sync.
- **New Assessment** — per-side movement scoring (Forward Lunge, Single Leg Dip, Shoulder Reach,
  Trunk Rotation, Cervical Rotation), pain flags, hypermobility flags, OA flag, and per-movement
  Observations + Quality-Focus inputs.
- **Exercise Sheet Builder** — auto-selects exercises from the assessment (mobility focus for low
  scorers, stability focus for hypermobility), detects and resolves cross-category redundancy,
  flags OA-cautionary exercises, supports editable sets/reps, and warns when a session exceeds the
  20-minute guideline.
- **Printable plan** — exercises grouped by movement with images, type badges, frequency, and
  follow-up / re-assessment dates, plus a weekly calendar page. Print to PDF from the browser.
- **Exercise Library** — searchable reference of all 60 exercises.
- Dark mode and mobile-responsive layout.

## Tech stack

- Vanilla HTML/CSS/JS in a single file — no framework, no build-time JS dependencies.
- [Vite](https://vitejs.dev/) for the dev server and production bundle.
- Browser `localStorage` for persistence (via a `window.storage` adapter). **Local-only by
  design** — there is no cloud backend, so employee health data never leaves the device. JSON
  export/import is the backup and device-to-device transfer mechanism.

## Local development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs to dist/
npm run preview  # serve the production build locally
```

## Deployment

Deployed on Vercel (framework preset: Vite, auto-detected). Pushing to the GitHub repo
(`Dane-Lee/HMA-Correct-Exercise-Tracker`) triggers a deploy.

## Project structure

```
index.html          # the entire app (markup, styles, logic)
public/images/       # bundled cartoon exercise images + ATI logo
package.json         # Vite scripts
PROGRESS.md          # current status, in-progress work, and backlog
```

## Data model

Records are stored as JSON under the `hma-records` key. Each record holds employee info, the
movement `scores` snapshot (per side), `total`, `hypermobile` flags, `hasOA`, `observations`,
`qualityFocus`, and follow-up/retest scheduling. Storage is **local-only by design** to keep
employee health data offline. The trade-off is that records are per-device and are deleted if
browser data is cleared, so **export to JSON regularly** — that is also how you move records
between devices.

## Notes

- Exercise definitions, scoring, suggestion maps, and the de-duplication logic live in the
  `<script>` block in `index.html`. Category exercise lists are composed once in `CAT_EXERCISES`
  (Balance folds into Single Leg Dip; Core folds into Trunk Rotation) — add or edit an exercise
  there and it flows to the builder, library, and print sheet.
```
