// The sent-to-Cadence stamp the suite's home screen reads (ONE-APP-PLAN §6,
// owner 2026-09-29). Pulls the real persistProgram() out of index.html, because
// the failure this guards is quiet: a reprint that drops the stamp lights the
// home screen blue for a plan the employee already has, and one that KEEPS it
// across an edit hides a plan that needs re-sending.
// Run with: npm test
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const start = html.indexOf("// What the employee would actually receive.");
const end = html.indexOf("function _renderPrintSheet(");
assert.ok(start > 0 && end > start, "could not locate sameProgram/persistProgram");
const source = html.slice(start, end);

function load(records) {
  const scope = new Function(
    "state",
    `let records = state.records, currentEmpForSheet = state.records[0], customSetsReps = {};
     const SCHED_WORK_DAYS = [1, 2, 3, 4, 5], SESSION_BUDGET_SEC = 1200;
     const saveRecords = () => {}, renderTable = () => {}, self = globalThis;
     ${source}
     return { persistProgram, sameProgram };`
  );
  return scope({ records });
}

const chosen = [{ id: "l1", sets: "2x30 sec" }, { id: "s3", sets: "3x10" }];
const sched = { days: { l1: [1, 3, 5], s3: [2, 4] } };

// 1. First finalize: no stamp.
const records = [{ id: "a1", name: "Test" }];
let api = load(records);
api.persistProgram(chosen, sched);
const first = records[0].program;
assert.ok(first.finalized_at, "a first finalize is timestamped");
assert.equal(first.sent_to_cadence_at, undefined, "a new program has not been sent");

// 2. Sent, then the sheet is reprinted unchanged: stamp AND finalized time survive.
first.sent_to_cadence_at = "2026-09-29T18:00:00.000Z";
first.finalized_at = "2026-09-29T17:00:00.000Z";
api.persistProgram(chosen, sched);
assert.equal(records[0].program.sent_to_cadence_at, "2026-09-29T18:00:00.000Z", "an unchanged reprint keeps the stamp");
assert.equal(records[0].program.finalized_at, "2026-09-29T17:00:00.000Z", "an unchanged reprint keeps its finalized time");
assert.equal(records[0].program.plan_id, first.plan_id, "plan_id is stable");

// 3. The program is edited: the stamp goes, because the employee has the old one.
api.persistProgram([...chosen, { id: "t9", sets: "2x12" }], { days: { ...sched.days, t9: [1] } });
assert.equal(records[0].program.sent_to_cadence_at, undefined, "an edited program must be sent again");
assert.notEqual(records[0].program.finalized_at, "2026-09-29T17:00:00.000Z", "an edit is a new finalize");

// 4. sameProgram ignores stamps and timestamps, and sees days.
assert.ok(api.sameProgram(
  { work_days: [1], session_budget_sec: 1, exercises: [{ id: "l1", prescription: "x", days: [1], sort_order: 0 }], finalized_at: "a" },
  { work_days: [1], session_budget_sec: 1, exercises: [{ id: "l1", prescription: "x", days: [1], sort_order: 0 }], sent_to_cadence_at: "b" }
));
assert.ok(!api.sameProgram(
  { exercises: [{ id: "l1", prescription: "x", days: [1], sort_order: 0 }] },
  { exercises: [{ id: "l1", prescription: "x", days: [2], sort_order: 0 }] }
), "a change of days is a change of program");

// 5. The stamp is written on the → Cadence copy, and never enters the plan payload.
const exporter = html.slice(html.indexOf("function exportPlanForCadence("), html.indexOf("function openExerciseBuilderById("));
assert.match(exporter, /rec\.program\.sent_to_cadence_at=new Date\(\)\.toISOString\(\);\s*saveRecords\(\);/);
const payload = html.slice(html.indexOf("function buildPlanPayload("), html.indexOf("function exportPlanForCadence("));
assert.doesNotMatch(payload, /sent_to_cadence_at|\.\.\.prog/, "the stamp must not reach the Cadence contract");

console.log("All cadence-stamp checks passed.");
