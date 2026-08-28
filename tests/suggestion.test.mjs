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
  `${block}; return { suggestForMovement, poolFor, EX_TYPE, EXERCISE_TARGETS, EXERCISE_CATEGORY,
     CAT_EXERCISES, MOBILITY_SUGGEST, HYPER_SUGGEST, RESTORE_TYPES, BUILD_TYPES,
     FAULT_IMPAIRMENT, MODIFIER_FAULTS };`,
)();
const { suggestForMovement, EX_TYPE, EXERCISE_TARGETS, EXERCISE_CATEGORY,
        RESTORE_TYPES, BUILD_TYPES, FAULT_IMPAIRMENT, MODIFIER_FAULTS } = api;

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

// ===================== fault-driven selection (§5) =========================

// --- every mapped impairment must be reachable in the library ---------------
const allTargets = new Set(Object.values(EXERCISE_TARGETS));
for (const [fault, targets] of Object.entries(FAULT_IMPAIRMENT)) {
  for (const t of targets) {
    assert.ok(allTargets.has(t), `${fault} maps to "${t}", which no exercise targets`);
  }
}

// --- the six modifier faults select nothing --------------------------------
// "Excessive effort" describes how a movement was produced, not what restricts
// it. If these ever start selecting, everyone drifts back to the same list.
for (const f of MODIFIER_FAULTS) {
  assert.ok(!(f in FAULT_IMPAIRMENT), `${f} is a modifier and must map to no impairment`);
}
const effortOnly = suggestForMovement("lunge", 2, 2, false, ["lunge-effort"]);
const noFaults = suggestForMovement("lunge", 2, 2, false, []);
assert.deepEqual(effortOnly.ids, noFaults.ids, "a modifier-only fault must not change selection");
assert.deepEqual(effortOnly.modifiers, ["lunge-effort"], "but it is still reported to the EIS");

// --- faults change WHICH exercise, at the same severity ---------------------
const valgus = suggestForMovement("sld", 2, 2, false, ["sld-knee-valgus"]);
const balance = suggestForMovement("sld", 2, 2, false, ["sld-control"]);
assert.notDeepEqual(valgus.ids, balance.ids,
  "two different faults at the same score must not produce the same exercises");
assert.equal(valgus.driver, "faults");
for (const id of valgus.ids) {
  assert.ok(FAULT_IMPAIRMENT["sld-knee-valgus"].includes(EXERCISE_TARGETS[id]),
    `${id} targets ${EXERCISE_TARGETS[id]}, which the valgus fault does not implicate`);
}

// --- cross-category reach: the point of mapping onto targets ---------------
// Three of five cervical faults should prescribe thoracic work.
// The claim is about the IMPAIRMENT reached, not the folder an exercise sits in
// — c9 targets thoracic-rotation while being filed under cervical, and at build
// phase the thoracic *mobility* work is correctly excluded as flexibility.
const fhp = suggestForMovement("cervical", 2, 2, false, ["cerv-forward-head"]);
assert.ok(fhp.ids.some((id) => EXERCISE_TARGETS[id].startsWith("thoracic")),
  "forward-head posture should reach thoracic work, not only cervical");

// At restore phase the thoracic exercises that live under trunk become
// reachable, which is the cross-category jump in its plainest form.
const fhpRestricted = suggestForMovement("cervical", 1, 1, false, ["cerv-forward-head"]);
assert.ok(fhpRestricted.ids.some((id) => EXERCISE_CATEGORY[id] === "trunk"),
  "a restricted forward-head pattern should prescribe trunk-category thoracic work");

const cervRom = suggestForMovement("cervical", 1, 1, false, ["cerv-rom"]);
assert.ok(cervRom.ids.length, "a cervical ROM limit must still find restore-phase work");

// A lunge fault reaching an ankle exercise that lives in the sld category.
const footFlat = suggestForMovement("lunge", 1, 1, false, ["lunge-foot-flat"]);
assert.ok(footFlat.ids.includes("s1"),
  "a heel-rise fault should reach the calf/ankle stretch even though it lives under sld");

// --- severity still sets the phase; faults choose within it (owner Q3) ------
const valgusRestricted = suggestForMovement("sld", 1, 1, false, ["sld-knee-valgus"]);
for (const t of valgusRestricted.ids.map((id) => EX_TYPE[id])) {
  assert.ok(RESTORE_TYPES.includes(t),
    `a restricted pattern must not be loaded even when the fault implies weakness — got ${t}`);
}
for (const t of valgus.ids.map((id) => EX_TYPE[id])) {
  assert.ok(BUILD_TYPES.includes(t), "full range with compensation should build");
}

// --- sh-overlap suppresses flexibility outright (owner Q4) ------------------
// Ticking it alongside a fault that would otherwise stretch must not stretch.
const overlapAlone = suggestForMovement("shoulder", 2, 2, false, ["sh-overlap"]);
const overlapPlusRounded = suggestForMovement("shoulder", 1, 1, false, ["sh-overlap", "sh-rounded"]);
for (const set of [overlapAlone, overlapPlusRounded]) {
  for (const id of set.ids) {
    assert.ok(!RESTORE_TYPES.includes(EX_TYPE[id]),
      `hands-overlapping is a hypermobility sign — ${id} (${EX_TYPE[id]}) must be suppressed`);
  }
}
// Without it, the same restricted shoulder DOES stretch — proving suppression bites.
const roundedOnly = suggestForMovement("shoulder", 1, 1, false, ["sh-rounded"]);
assert.ok(roundedOnly.ids.some((id) => RESTORE_TYPES.includes(EX_TYPE[id])),
  "control: a restricted shoulder without the overlap fault should get flexibility work");

// --- an impairment unreachable in this phase falls back, never empties ------
// hip-abductors has no flexibility exercise, so a restricted hips-level fault
// cannot be answered directly.
const hipsRestricted = suggestForMovement("sld", 1, 1, false, ["sld-hips-level"]);
assert.ok(hipsRestricted.ids.length, "must fall back rather than return nothing");
assert.equal(hipsRestricted.driver, "severity", "and should say it fell back");

// --- ranking: an impairment two faults agree on outranks one -----------------
const agreeing = suggestForMovement("sld", 2, 2, false,
  ["sld-knee-valgus", "sld-hips-level"], 1);
assert.equal(EXERCISE_TARGETS[agreeing.ids[0]], "hip-abductors",
  "both faults implicate hip abductors, so that should be picked first");

// --- how much does the fault layer widen the plan space? --------------------
const faultPlans = new Set();
const lungeFaults = Object.keys(FAULT_IMPAIRMENT).filter((f) => f.startsWith("lunge-"));
for (let mask = 0; mask < (1 << lungeFaults.length); mask++) {
  const ticked = lungeFaults.filter((_, i) => mask & (1 << i));
  for (const score of [1, 2]) {
    faultPlans.add(suggestForMovement("lunge", score, score, false, ticked).ids.sort().join(","));
  }
}

console.log(`All suggestion checks passed.`);
console.log(`  distinct plans from symmetric scores alone: ${plans.size} (was 32)`);
console.log(`  worst-case exercise count: ${total} (was 19)`);
console.log(`  distinct lunge selections from faults x severity: ${faultPlans.size}`);
