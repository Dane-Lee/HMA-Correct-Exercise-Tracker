// Pulls the real import-merge block out of index.html and exercises it, so the
// rules that protect exercise-plan work cannot silently regress.
// Run with: npm test
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const start = html.indexOf("// ---- Import merge");
const end = html.indexOf("function importRecords(event)");
assert.ok(start > 0 && end > start, "could not locate the import-merge block");
const source = html.slice(start, end);

let records = [];
let confirmAnswer = true;
const saveRecords = () => {};
const renderTable = () => {};
const confirm = () => confirmAnswer;
const alerts = [];
const alert = (m) => alerts.push(m);

const scope = new Function(
  "records_ref", "saveRecords", "renderTable", "confirm", "alert",
  `let records = records_ref.value;
   ${source}
   return {
     apply: (imported) => { const r = applyImportedRecords(imported); records_ref.value = records; return r; },
     merge: mergeImportedRecord
   };`
);
const ref = { value: records };
const api = scope(ref, saveRecords, renderTable, confirm, alert);

function trackerAuthored(over = {}) {
  return {
    id: "a1", fname: "Casey", lname: "Jones", name: "Casey Jones",
    company: "Navarre", dept: "Weld", shift: "2nd", location: "Line 3", type: "Initial",
    date: "2026-07-23",
    scores: { lunge: [{ val: 2, pain: false }, { val: 3, pain: false }] },
    total: 8, hypermobile: { lunge: false }, hasOA: false,
    notes: "lunge: knee valgus",
    _importedNotes: "lunge: knee valgus",
    // the work done inside the Tracker
    plan: "Yes", pa: "Yes", followup: "6", retest: "4",
    observations: { lunge: { 0: "Knee collapse" } },
    qualityFocus: { lunge: ["Control"] },
    ...over
  };
}

function reExport(over = {}) {
  // What the Manual app sends: real scores, empty Tracker-authored fields.
  return {
    id: "a1", fname: "Casey", lname: "Jones", name: "Casey Jones",
    company: "Navarre", dept: "", shift: "", location: "", type: "",
    date: "2026-07-23",
    scores: { lunge: [{ val: 1, pain: true }, { val: 3, pain: false }] },
    total: 6, hypermobile: { lunge: true }, hasOA: true,
    notes: "lunge: knee valgus",
    plan: "", pa: "", followup: "", retest: "",
    observations: { lunge: {} }, qualityFocus: { lunge: [] },
    ...over
  };
}

// 1. A re-score updates the scores.
let merged = api.merge(trackerAuthored(), reExport());
assert.deepEqual(merged.scores.lunge[0], { val: 1, pain: true }, "scores must refresh");
assert.equal(merged.total, 6, "total must refresh");
assert.equal(merged.hypermobile.lunge, true, "hypermobility must refresh");
assert.equal(merged.hasOA, true, "OA must refresh");

// 2. Tracker-authored work survives untouched.
assert.equal(merged.plan, "Yes");
assert.equal(merged.pa, "Yes");
assert.equal(merged.followup, "6");
assert.equal(merged.retest, "4");
assert.deepEqual(merged.observations, { lunge: { 0: "Knee collapse" } }, "observations must survive");
assert.deepEqual(merged.qualityFocus, { lunge: ["Control"] }, "quality focus must survive");

// 3. Blank incoming detail fields never wipe what was typed in the Tracker.
assert.equal(merged.dept, "Weld");
assert.equal(merged.shift, "2nd");
assert.equal(merged.location, "Line 3");
assert.equal(merged.type, "Initial");

// 4. Non-blank incoming detail fields DO update.
merged = api.merge(trackerAuthored(), reExport({ dept: "Paint", company: "Hendrickson" }));
assert.equal(merged.dept, "Paint");
assert.equal(merged.company, "Hendrickson");

// 4b. Badge #: an import can fill a blank badge, but a blank import never wipes
// one already recorded. Same rule as the other detail fields, asserted explicitly
// because a plan cannot reach Cadence without it.
merged = api.merge(trackerAuthored({ badge: "4412" }), reExport({ badge: "" }));
assert.equal(merged.badge, "4412", "a blank incoming badge must not wipe a recorded one");
merged = api.merge(trackerAuthored({ badge: "" }), reExport({ badge: "4412" }));
assert.equal(merged.badge, "4412", "an incoming badge must fill a blank one");

// 5. Notes: untouched since import -> refreshed.
merged = api.merge(trackerAuthored(), reExport({ notes: "lunge: improved" }));
assert.equal(merged.notes, "lunge: improved", "unedited notes should refresh");
assert.equal(merged._importedNotes, "lunge: improved", "stamp should follow");

// 6. Notes: edited in the Tracker -> kept.
merged = api.merge(
  trackerAuthored({ notes: "lunge: knee valgus\nspoke with supervisor" }),
  reExport({ notes: "lunge: improved" })
);
assert.equal(merged.notes, "lunge: knee valgus\nspoke with supervisor", "edited notes must be kept");

// 7. End to end through applyImportedRecords: one update, one add, order kept.
ref.value.length = 0;
ref.value.push(trackerAuthored(), trackerAuthored({ id: "a2", name: "Other Person" }));
const before = ref.value.map((r) => r.id);
api.apply([reExport(), { ...reExport(), id: "a3", name: "New Person" }]);
assert.equal(ref.value.length, 3, "one added");
assert.equal(ref.value[0].id, "a3", "new records go on top");
assert.deepEqual(ref.value.slice(1).map((r) => r.id), before, "existing order preserved");
assert.equal(ref.value[1].total, 6, "existing record updated in place");
assert.deepEqual(ref.value[1].observations, { lunge: { 0: "Knee collapse" } }, "its plan work survived");
assert.equal(ref.value[2].total, 8, "the untouched record is unchanged");
assert.match(alerts.at(-1), /1 record\(s\) added, 1 record\(s\) updated/);

// 8. New records get a notes stamp so the next re-import can detect edits.
assert.equal(ref.value[0]._importedNotes, "lunge: knee valgus");

// 9. Declining the confirm changes nothing.
confirmAnswer = false;
const snapshot = JSON.stringify(ref.value);
api.apply([reExport({ total: 999 })]);
assert.equal(JSON.stringify(ref.value), snapshot, "cancel must be a no-op");

// 10. Every field getFormData() writes must be classified by the merge, so a
// new field cannot quietly fall through as "refreshed" or "kept" by accident.
const formData = html.slice(html.indexOf("function getFormData()"), html.indexOf("function validateRecord("));
const formFields = [...formData.matchAll(/(?:^|[{,\s])([a-zA-Z_]+)\s*:/g)].map((m) => m[1]);
const classified = new Set([
  "id", "notes",
  ...source.match(/IMPORT_SCORE_FIELDS=\[([^\]]*)\]/)[1].replace(/'/g, "").split(","),
  ...source.match(/IMPORT_DETAIL_FIELDS=\[([^\]]*)\]/)[1].replace(/'/g, "").split(","),
  // deliberately preserved: authored in the Tracker after import
  "plan", "pa", "followup", "retest", "observations", "qualityFocus"
]);
const unclassified = formFields.filter((f) => !classified.has(f));
assert.deepEqual(
  unclassified, [],
  `record field(s) not classified by the import merge: ${unclassified.join(", ")}`
);

console.log("All import-merge checks passed.");
