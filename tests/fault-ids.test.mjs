// Movement faults now carry stable ids. Two things must hold, and neither is
// visible by clicking around: ids must be unique and never silently change, and
// records written before ids existed — which key observations by array position —
// must still resolve to the right fault.
//
// This matters because fault ids are about to become the input to exercise
// selection (EXERCISE-SELECTION-LOGIC.md §5). A fault that resolves to the wrong
// id would prescribe the wrong corrective, quietly.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");

const start = html.indexOf("const MOVEMENT_FAULTS=");
const end = html.indexOf("const QUALITY_TYPES=");
assert.ok(start > 0 && end > start, "could not locate the fault block");

const { MOVEMENT_FAULTS, normalizeObservations, faultLabel, faultIdAt } = new Function(
  `${html.slice(start, end)}; return { MOVEMENT_FAULTS, normalizeObservations, faultLabel, faultIdAt };`,
)();

const KEYS = ["lunge", "sld", "shoulder", "trunk", "cervical"];

// --- shape --------------------------------------------------------------
for (const k of KEYS) {
  assert.ok(Array.isArray(MOVEMENT_FAULTS[k]) && MOVEMENT_FAULTS[k].length, `${k} has faults`);
  for (const f of MOVEMENT_FAULTS[k]) {
    assert.ok(f.id && typeof f.id === "string", `${k} fault has an id`);
    assert.ok(f.label && typeof f.label === "string", `${k} fault has a label`);
    assert.match(f.id, /^[a-z0-9-]+$/, `${k} id "${f.id}" is a safe slug (it goes in a DOM id)`);
  }
}

// --- ids unique across the WHOLE instrument, not just per movement -------
// Several faults repeat verbatim across movements ("Excessive effort/overexertion"),
// so ids must disambiguate or selection cannot tell which movement reported it.
const all = KEYS.flatMap((k) => MOVEMENT_FAULTS[k].map((f) => f.id));
assert.equal(new Set(all).size, all.length, `duplicate fault ids: ${all.filter((v, i) => all.indexOf(v) !== i)}`);

// --- labels are NOT unique, which is exactly why ids exist ---------------
const labels = KEYS.flatMap((k) => MOVEMENT_FAULTS[k].map((f) => f.label));
assert.ok(new Set(labels).size < labels.length,
  "labels repeat across movements — if this ever stops being true, ids are still the identifier");

// --- legacy records: observations keyed by array position ----------------
const legacy = { 1: "Knee valgus/varus (front knee)", 4: "Excessive effort/overexertion" };
const migrated = normalizeObservations("lunge", legacy);
assert.deepEqual(Object.keys(migrated).sort(), ["lunge-effort", "lunge-knee-valgus"],
  "positional keys migrate to the ids at those positions");
assert.equal(migrated["lunge-knee-valgus"], "Knee valgus/varus (front knee)",
  "the wording the EIS saw is preserved, not regenerated");

// --- current records pass through unchanged ------------------------------
const current = { "sld-hips-level": "Hips not level" };
assert.deepEqual(normalizeObservations("sld", current), current, "id-keyed records are untouched");

// --- mixed, which a record edited across the change will be --------------
const mixed = normalizeObservations("cervical", { 0: "old wording", "cerv-shoulder": "Shoulder movement during head rotation" });
assert.deepEqual(Object.keys(mixed).sort(), ["cerv-rom", "cerv-shoulder"]);

// --- an out-of-range legacy index is dropped, not mapped to something else
assert.deepEqual(normalizeObservations("trunk", { 99: "nonsense" }), {},
  "a position with no fault is discarded rather than guessed at");

// --- faultLabel resolves, and degrades to the id rather than throwing ----
assert.equal(faultLabel("shoulder", "sh-overlap"), "Hands overlapping");
assert.equal(faultLabel("shoulder", "sh-gone"), "sh-gone", "an unknown id shows itself, not undefined");
assert.equal(faultIdAt("lunge", 0), "lunge-rom");
assert.equal(faultIdAt("lunge", 99), null);

// --- the hypermobility fault is present and findable ---------------------
// §5c: "Hands overlapping" is the fault where stretching is contraindicated, so
// selection has to be able to find it by id.
assert.ok(MOVEMENT_FAULTS.shoulder.some((f) => f.id === "sh-overlap"),
  "the hypermobility-caution fault must keep a stable id");

console.log(`All fault-id checks passed (${all.length} faults across ${KEYS.length} movements).`);
