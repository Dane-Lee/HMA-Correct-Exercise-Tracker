# HMA Corrective Exercise Tracker — Project Progress

## What This Is
A single-file web app built for ATI Worksite Solutions at Hendrickson. Features:
- HMA employee records table (search, edit, delete)
- New Assessment form with movement scoring (Forward Lunge, Single Leg Dip, Shoulder Reach, Trunk Rotation, Cervical Rotation)
- Hypermobility flagging with stability-focused exercise auto-suggestion
- Exercise Sheet Builder with 28 bundled cartoon images
- Printable corrective exercise plan (PDF via browser print)
- All data stored in browser localStorage (per-device)

---

## Status

### Done
- [x] Identified source file: `HMA Corrective Exercise Tracker` (no extension, plain HTML)
- [x] Diagnosed blocker: `window.storage` API used in original file doesn't exist in a standard browser
- [x] Created project at `C:\Users\dane.lee\hma-tracker\`
- [x] Added `localStorage` polyfill for `window.storage`
- [x] Copied all 28 cartoon exercise images to `public/images/`
- [x] Pre-wired all 28 images to their exercise IDs (show automatically, no manual upload needed)
- [x] Created `package.json` with Vite (dev server + build)
- [x] Created `.gitignore`

### Blocked — Needs Node.js
- [ ] Run `npm install` (installs Vite)
- [ ] Run `npm run dev` (confirm app loads at localhost:5173)

### To Do — GitHub
- [ ] Install Git if not already installed
- [ ] Initialize repo and push:
  ```
  git init
  git add .
  git commit -m "initial commit"
  git remote add origin https://github.com/Dane-Lee/HMA-Correct-Exercise-Tracker.git
  git push -u origin main
  ```

### To Do — Vercel
- [ ] Go to vercel.com → Add New Project → Import from GitHub
- [ ] Select `hma-tracker` repo
- [ ] Framework: Vite (auto-detected)
- [ ] Click Deploy — done, live URL provided instantly

---

## Blockers / Open Questions
- **Node.js not installed** — must install before any npm commands work (see below)
- **Data is per-browser** — localStorage means records saved at work won't show on another device. If multi-device sync is needed later, a backend (Supabase, Firebase) would need to be added.

---

## Session Log

### Session 1 — 2026-06-08
- Found the project file buried in OneDrive as a no-extension HTML file
- Diagnosed `window.storage` as the blocker (custom API, not standard browser)
- Scaffolded full Vite project with localStorage polyfill and bundled images
- Discovered Node.js is not installed — next step is install Node

---

## Next Step Right Now
**Install Node.js:**
1. Go to: https://nodejs.org
2. Download the **LTS** version (left button)
3. Run the installer, accept all defaults
4. Open a new terminal and run: `npm run dev` from `C:\Users\dane.lee\hma-tracker\`
