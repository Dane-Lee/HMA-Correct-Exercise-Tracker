// The selection rule from EXERCISE-SELECTION-LOGIC.md §3–§4.
//
// The defect this replaces: a score of 1 and a score of 2 produced identical
// output, asymmetry was destroyed by Math.min(), and a triggered movement added
// its entire category list. The plan was a pure function of five booleans, so
// 55% of score sheets produced the same 19 exercises.
//
// These tests assert the properties that make plans differ. They pull the real
// library and the real functions out of index.html rather than restating them.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");

// Everything from the suggestion tables through the parallel maps, evaluated
// together so the functions see the consts they close over.
const start = html.indexOf("// ── MOBILITY-FOCUSED SUGGESTIONS");
const hyperStart = html.indexOf("const HYPER_SUGGEST=");
const end = html.indexOf("const MOVEMENT_FAULTS=");
assert.ok(hyperStart > 0 && start > 0 && end > start, "could not locate the library block");

const block = html.slice(Math.min(hyperStart, start), end)
  // IMAGE_REGISTRY and DEFAULT_IMAGES sit in the middle and are irrelevant here,
  // but harmless — they evaluate to plain data.
  ;

const api = new Function(
  `${block}; return { suggestForMovement, poolFor, EX_TYPE, CAT_EXERCISES, MOBILITY_SUGGEST, HYPER_SUGGEST, RESTORE_TYPES, BUILD_TYPES };`,
)();
const { suggestForMovement, EX_TYPE, RESTORE_TYPES, BUILD_TYPES } = api;

const KEYS = ["lunge", "sld", "shoulder", "trunk", "cervical"];
const typesOf = (ids) => ids.map((id) => EX_TYPE[id]);

// --- the core defect: severity must change the OUTPUT, not just trigger it ---
for (const k of KEYS) {
  const restricted = suggestForMovement(k, 1, 1, false);
  const compensating = suggestForMovement(k, 2, 2, false);
  assert.notDeepEqual(restricted.ids, compensating.ids,
    `${k}: a score of 1 and a score of 2 must not produce the same exercises`);
  assert.equal(restricted.phase, "restore");
  assert.equal(compensating.phase, "build");
}

// --- and the direction must be clinically right, not merely different -------
for (const k of KEYS) {
  const restricted = suggestForMovement(k, 1, 1, false);
  const compensating = suggestForMovement(k, 2, 2, false);
  for (const t of typesOf(restricted.ids)) {
    assert.ok(RESTORE_TYPES.includes(t), `${k}: a restricted score must not be loaded — got ${t}`);
  }
  for (const t of typesOf(compensating.ids)) {
    assert.ok(BUILD_TYPES.includes(t), `${k}: full range with compensation should build — got ${t}`);
  }
}

// --- a clean movement contributes nothing ----------------------------------
for (const k of KEYS) {
  assert.deepEqual(suggestForMovement(k, 3, 3, false).ids, [], `${k}: 3/3 needs no work`);
}

// --- asymmetry is a finding in its own right -------------------------------
for (const k of KEYS) {
  const even = suggestForMovement(k, 2, 2, false);
  const uneven = suggestForMovement(k, 2, 3, false);
  assert.equal(even.asymmetry, 0);
  assert.equal(uneven.asymmetry, 1);
  assert.ok(uneven.ids.length > even.ids.length,
    `${k}: a side-to-side difference should widen the selection, not vanish into Math.min()`);
  assert.equal(uneven.worseSide, 0, "the worse side is identified so it can be emphasised");
  assert.equal(even.worseSide, null);
}

// --- Math.min() is no longer the whole story --------------------------------
// Both of these have worst===2, but one is asymmetric. Under the old logic they
// were indistinguishable.
const sym = suggestForMovement("sld", 2, 2, false);
const asym = suggestForMovement("sld", 2, 3, false);
assert.notDeepEqual(sym.ids, asym.ids, "2/2 and 2/3 must differ");

// --- hypermobility outranks severity ---------------------------------------
// Stretching is contraindicated, so a hypermobile 1 must still get stabilization
// rather than the restore pool. This was existing behaviour and must not regress.
for (const k of KEYS) {
  const hyper = suggestForMovement(k, 1, 1, true);
  assert.equal(hyper.phase, "stabilize");
  for (const t of typesOf(hyper.ids)) {
    assert.ok(BUILD_TYPES.includes(t), `${k}: hypermobile must not be prescribed stretching — got ${t}`);
  }
}

// --- plans are bounded, so a full sheet no longer yields nineteen ------------
let total = 0;
for (const k of KEYS) total += suggestForMovement(k, 1, 1, false).ids.length;
assert.ok(total <= 12, `a worst-case sheet should stay small, got ${total}`);

// --- how many DISTINCT plans can the scoring now produce? --------------------
// The old logic could produce 32. Count what the new one can, over the same
// space plus severity.
const plans = new Set();
const vals = [1, 2, 3];
for (const a of vals) for (const b of vals) for (const c of vals) for (const d of vals) for (const e of vals) {
  const sc = { lunge: a, sld: b, shoulder: c, trunk: d, cervical: e };
  const ids = KEYS.flatMap((k) => suggestForMovement(k, sc[k], sc[k], false).ids);
  plans.add(ids.sort().join(","));
}
assert.ok(plans.size > 32,
  `severity should multiply the plan space beyond the old 32, got ${plans.size}`);

console.log(`All suggestion checks passed.`);
console.log(`  distinct plans from symmetric scores alone: ${plans.size} (was 32)`);
console.log(`  worst-case exercise count: ${total} (was 19)`);
