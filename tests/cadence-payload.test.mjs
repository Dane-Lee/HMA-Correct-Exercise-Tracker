// Verifies the Cadence plan payload the Tracker emits.
//
// The rules asserted here mirror HMA-Cadence/src/lib/data/planValidation.js and
// docs/plan-payload-contract.md. They are restated rather than imported because
// the two apps are separate repos that must not build against each other -- the
// contract is the shared thing, not the code. If Cadence's validator changes,
// this file changes with it.
import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const start = html.indexOf("const CADENCE_MOVEMENT=");
const end = html.indexOf("function exportPlanForCadence(");
assert.ok(start > 0 && end > start, "could not locate the payload-builder block");

// Everything the block leans on from the wider app.
const prelude = ["IMAGE_REGISTRY", "EXERCISE_CATEGORY", "EX_TYPE", "EX_DURATION", "SCHED_WORK_DAYS", "SESSION_BUDGET_SEC"]
  .map((name) => {
    // No backslash escapes: this string passes through several layers before RegExp sees it.
    const m = html.match(new RegExp("(?:const|let)[ ]+" + name + "[ ]*=[ ]*"));
    const from = html.indexOf("=", m.index) + 1;
    let depth = 0, i = from;
    for (; i < html.length; i++) {
      const c = html[i];
      if ("{[".includes(c)) depth++;
      else if ("}]".includes(c)) { depth--; if (depth === 0) { i++; break; } }
      else if (depth === 0 && (c === ";" || c === "\n")) break;
    }
    return `const ${name}=${html.slice(from, i)};`;
  }).join("\n");

const TRACKER_MOVEMENTS = [
  { key: "lunge", label: "Lunge" }, { key: "sld", label: "Single Leg Dip" },
  { key: "shoulder", label: "Shoulder Reach" }, { key: "trunk", label: "Trunk Rotation" },
  { key: "cervical", label: "Cervical Rotation" }
];
// The parameter must be named MOVEMENTS -- that is what the extracted block
// references. The fixture is TRACKER_MOVEMENTS only to avoid clashing with
// Cadence's enum Set below.
const scope = new Function("getAllExercises", "MOVEMENTS", `${prelude}\n${html.slice(start, end)}\nreturn { buildPlanPayload };`);

const LIB = [
  { id: "l1", name: "Hip Flexor Stretch", inst: "Lie on a table at 45 degrees.", sets: "2x30 sec hold each side" },
  { id: "s3", name: "Bridge", inst: "On your back, knees bent.", sets: "3x10-15" },
  { id: "c4", name: "Chin Tuck", inst: "Look straight ahead.", sets: "3x10-second holds" }
];
const { buildPlanPayload } = scope(() => LIB, TRACKER_MOVEMENTS);

const record = (over = {}) => ({
  id: "a1", badge: "4412", fname: "Maria", lname: "Santos", name: "Maria Santos",
  company: "Hendrickson", dept: "Assembly", shift: "1st", location: "Navarre, OH",
  date: "2026-08-14", type: "Initial", total: 9, notes: "guarding on the left",
  scores: { lunge: [{ val: 2, pain: false }, { val: 3, pain: false }] },
  followup: "6", retest: "4", plan: "Yes",
  program: {
    plan_id: "11111111-1111-4111-8111-111111111111",
    work_days: [1, 2, 3, 4, 5], session_budget_sec: 1200,
    exercises: [
      { id: "l1", prescription: "2x30 sec hold each side", days: [1, 2, 3, 4, 5], sort_order: 0 },
      { id: "s3", prescription: "2x10", days: [1, 3, 5], sort_order: 1 },
      { id: "c4", prescription: "3x10-second holds", days: [2, 4], sort_order: 2 }
    ]
  },
  ...over
});

// -- Cadence's enums (src/lib/constants.js). Exhaustive on both sides. --
const MOVEMENTS = new Set(["lunge", "single_leg_dip", "shoulder_reach", "trunk_rotation", "cervical_rotation"]);
const TYPES = new Set(["flexibility", "mobility", "static_stabilization", "dynamic_stabilization", "strength"]);

const p = buildPlanPayload(record());

// 1. Cadence's validator rejects the payload wholesale if any of this is wrong.
assert.equal(p.schema_version, 1);
assert.equal(typeof p.plan_id, "string");
assert.equal(p.employee.employee_number, "4412", "badge is the identity key Cadence upserts on");
assert.ok(Array.isArray(p.schedule.work_days) && p.schedule.work_days.length);
assert.ok(Array.isArray(p.exercises) && p.exercises.length);

const seen = new Set();
for (const ex of p.exercises) {
  assert.ok(ex.source_exercise_id && !seen.has(ex.source_exercise_id), "ids present and unique");
  seen.add(ex.source_exercise_id);
  assert.ok(ex.name, "name required");
  assert.ok(MOVEMENTS.has(ex.movement_category), `movement_category "${ex.movement_category}" not in Cadence's enum`);
  assert.ok(TYPES.has(ex.exercise_type), `exercise_type "${ex.exercise_type}" not in Cadence's enum`);
  assert.ok(ex.days.length && ex.days.every((d) => Number.isInteger(d) && d >= 1 && d <= 7), "days are ISO weekdays");
  assert.ok(ex.days.every((d) => p.schedule.work_days.includes(d)), "days must fall inside work_days");
}

// 2. Weeks resolve to dates -- the Tracker stores counts, Cadence wants YYYY-MM-DD.
assert.equal(p.assessment.follow_up_date, "2026-09-25", "6 weeks from the assessment");
assert.equal(p.assessment.reassessment_date, "2026-09-11", "4 weeks from the assessment");

// 3. Overrides are per-assignment; the library default travels alongside.
assert.equal(p.exercises[0].prescription_override, null, "unchanged dosage sends no override");
assert.equal(p.exercises[1].default_prescription, "3x10-15");
assert.equal(p.exercises[1].prescription_override, "2x10", "an edited dosage travels as the override");

// 4. Image references are filenames, never paths or binaries.
assert.ok(!String(p.exercises[0].image_ref ?? "").includes("/"), "image_ref is a filename only");

// 5. The gates. Each of these would produce a plan Cadence rejects, or a plan for
//    someone who should have been referred instead of programmed.
assert.throws(() => buildPlanPayload(record({ program: undefined })), /no finalized exercise program/i);
assert.throws(() => buildPlanPayload(record({ badge: "" })), /badge number is required/i);
// A low-risk total auto-sets plan to "No" (updateTotals, the 11+ band). That must NOT
// block a program the EIS deliberately built -- only a pain flag does.
assert.doesNotThrow(() => buildPlanPayload(record({ plan: "No", total: 13 })), "a low-risk score must not block export");
assert.throws(
  () => buildPlanPayload(record({ scores: { lunge: [{ val: 1, pain: true }, { val: 2, pain: false }] } })),
  /referral, not a corrective program/i
);
assert.throws(
  () => buildPlanPayload(record({ program: { ...record().program, exercises: [{ id: "gone", prescription: "x", days: [1], sort_order: 0 }] } })),
  /no longer in the library/i
);

console.log("All Cadence payload checks passed.");
