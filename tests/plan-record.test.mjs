// The builder's own path: an assessment record to the suggested sheet.
//
// Owner, 2026-11-23, building a program with only Dynamic Stabilization ticked
// for the Single Leg Dip: "over half of the exercise selection options
// highlighted". The builder added every exercise of a ticked quality in the
// section AFTER the plan, past every rule in it. suggestion.test.mjs proves the
// planner keeps the rules; this proves the builder hands everything to the
// planner and adds nothing of its own.
//
// Synthetic records only.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const start = html.indexOf("const MOVEMENTS=");
const end = html.indexOf("const QUALITY_TYPES=");
assert.ok(start > 0 && end > start, "could not locate the planner block");
const api = new Function(`${html.slice(start, end)}; return { planForRecord, EX_TYPE, EX_STAGE, EXERCISE_CATEGORY, CAT_EXERCISES };`)();
const { planForRecord, EX_TYPE, EX_STAGE, EXERCISE_CATEGORY, CAT_EXERCISES } = api;

const KEYS = ["lunge", "sld", "shoulder", "trunk", "cervical"];
const record = (scores, extra = {}) => ({
  scores: Object.fromEntries(KEYS.map((k) => [k, (scores[k] || [3, 3]).map((val) => ({ val, pain: false }))])),
  hypermobile: {}, observations: {}, qualityFocus: {}, ...extra,
});
const inSection = (selected, key) => Object.keys(selected).filter((id) => EXERCISE_CATEGORY[id] === key);

test("his case: Single Leg Dip with only Dynamic Stabilization ticked", () => {
  for (const sld of [[1, 1], [2, 1], [2, 2], [3, 2]]) {
    const rec = record({ sld }, { qualityFocus: { sld: ["dynamic stabilization"] } });
    const { selected, notes } = planForRecord(rec);
    const ids = inSection(selected, "sld");
    assert.ok(ids.length <= 3, `${sld}: ${ids.length} of ${CAT_EXERCISES.sld.length} selected (was 8 to 11)`);
    for (const id of ids) assert.equal(EX_TYPE[id], "dynamic stabilization", `${sld}: ${id}`);
    if (Math.min(...sld) <= 1) for (const id of ids) assert.equal(EX_STAGE[id], "activate", `${sld}: ${id} is loaded at a 1`);
    assert.match(notes.sld.reason, /Dynamic Stabilization/, "the ⓘ says the quality decided the kind");
  }
});

test("every ticked quality, every section: bounded, and only the ticked kind", () => {
  for (const q of ["flexibility", "mobility", "static stabilization", "dynamic stabilization", "strength"]) {
    const rec = record({ lunge: [2, 2], sld: [1, 2], shoulder: [1, 1], trunk: [2, 3], cervical: [1, 3] },
      { qualityFocus: Object.fromEntries(KEYS.map((k) => [k, [q]])) });
    const { selected } = planForRecord(rec);
    const ids = Object.keys(selected);
    assert.ok(ids.length <= 13, `${q}: ${ids.length} on the sheet; the table allows 13 for these scores`);
    for (const id of ids) assert.equal(EX_TYPE[id], q, `${q}: ${id} is ${EX_TYPE[id]}`);
  }
});

test("pain still refers, ticked quality or not", () => {
  const rec = record({ sld: [0, 2] }, { qualityFocus: { sld: ["strength"] } });
  const { selected, notes } = planForRecord(rec);
  assert.deepEqual(inSection(selected, "sld"), []);
  assert.equal(notes.sld.phase, "refer");
});

test("nothing ticked, nothing flagged, clean scores: an empty sheet", () => {
  assert.deepEqual(Object.keys(planForRecord(record({})).selected), []);
});
