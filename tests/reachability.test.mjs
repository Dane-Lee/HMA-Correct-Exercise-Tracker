// Every exercise in the library is one the planner can choose.
//
// Owner, 2026-11-23, after the selection rework: list the exercises that are
// never chosen, "give the recommended fixes so that we can ensure that this
// stops happening". The audit found 11 that NO input can reach -- any score,
// any faults, any Quality Focus, hypermobile or not -- because a rival that
// does the same job (same body area, same direction) always outranks them, and
// a sheet takes one exercise per job. SELECTION-AUDIT.md in the suite has each
// one and the recommended fix.
//
// This is a ratchet. A NEW unreachable exercise fails, so adding an exercise
// the planner can never pick is caught the day it is added. An exercise on the
// list below that becomes reachable also fails, so the list only shrinks and
// never claims a problem that is gone.
//
// Synthetic inputs only.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const start = html.indexOf("const MOVEMENTS=");
const end = html.indexOf("const QUALITY_TYPES=");
assert.ok(start > 0 && end > start, "could not locate the planner block");
const { suggestPlan, CAT_EXERCISES, MOVEMENT_FAULTS } =
  new Function(`${html.slice(start, end)}; return { suggestPlan, CAT_EXERCISES, MOVEMENT_FAULTS };`)();

// Waiting on the owner's decision (SELECTION-AUDIT.md, 2026-11-23). Remove an
// entry when it becomes reachable; never add one to make this test pass.
const AWAITING = {
  l3: "Reverse Lunge",
  b1: "Single Leg Balance",
  b6: "Monster Walk",
  b7: "Single Leg Clock Balance",
  b8: "Single Leg Forward Balance",
  b9: "Cross Over Jumps",
  t5: 'Prone Scapular Retraction "T"',
  t9: 'Prone Scapular Retraction "I"',
  co5: "Anti Rotation Squat",
  co7: "Rotation Lunge",
  c2: "Cervical Side Bending",
};

const KEYS = ["lunge", "sld", "shoulder", "trunk", "cervical"];
const QUAL = ["flexibility", "mobility", "static stabilization", "dynamic stabilization", "strength"];
const ROWS = [[1, 1], [1, 2], [2, 1], [1, 3], [2, 2], [2, 3], [3, 3]];
const subsets = (arr) => { const s = [[]]; for (const x of arr) s.push(...s.map((t) => [...t, x])); return s; };
const NAME = Object.fromEntries(Object.values(CAT_EXERCISES).flat().map((e) => [e.id, e.name]));

function reachable() {
  const seen = new Set();
  // One movement alone: every score pair, every fault combination, no quality
  // or one, hypermobile or not.
  for (const key of KEYS) for (const fs of subsets(MOVEMENT_FAULTS[key].map((f) => f.id)))
    for (const [left, right] of ROWS) for (const isHyper of [false, true]) for (const q of [[], ...QUAL.map((x) => [x])])
      suggestPlan([{ key, left, right, isHyper, faultIds: fs, quality: q }])[key].ids.forEach((id) => seen.add(id));
  // Whole sheets, where one movement's pick pushes another's to its next
  // choice. Seeded, so the same code always gives the same answer.
  let seed = 11; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let n = 0; n < 30000; n++) {
    const entries = KEYS.map((key) => ({ key, left: 1 + Math.floor(rnd() * 3), right: 1 + Math.floor(rnd() * 3), isHyper: rnd() < 0.1,
      faultIds: MOVEMENT_FAULTS[key].map((f) => f.id).filter(() => rnd() < 0.3), quality: QUAL.filter(() => rnd() < 0.12) }));
    const plan = suggestPlan(entries);
    KEYS.forEach((k) => plan[k].ids.forEach((id) => seen.add(id)));
  }
  return seen;
}

test("every exercise can be chosen, apart from the ones awaiting a decision", () => {
  const seen = reachable();
  const never = Object.keys(NAME).filter((id) => !seen.has(id));
  const fresh = never.filter((id) => !(id in AWAITING));
  assert.deepEqual(fresh.map((id) => `${id} ${NAME[id]}`), [],
    "no input can choose these: give each one a way in (SELECTION-AUDIT.md) rather than adding it to AWAITING");
  const fixed = Object.keys(AWAITING).filter((id) => seen.has(id));
  assert.deepEqual(fixed.map((id) => `${id} ${AWAITING[id]}`), [], "these can be chosen now: take them off AWAITING");
});
