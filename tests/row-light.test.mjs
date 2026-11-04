// Each record's lights (owner, 2026-10-14; the seven states 2026-11-03/04).
// When the suite serves this page a row carries four small lights, the suite's
// own per-employee lights; anywhere else it carries the Tracker's light alone,
// worked out here by recordLight(). These cases restate the "records" ones in
// the suite's test_suite_status.py, run against the real code out of index.html.
// Run with: npm test
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const raw = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const html = raw.split("\r\n").join("\n");
const start = html.indexOf("const LIGHT_STAMP_INTRODUCED_AT=");
const end = html.indexOf("\nfunction renderTable(){", start);
assert.ok(start > 0 && end > start, "could not locate recordLight");
const lights = new Function(
  `${html.slice(start, end)}\nreturn { recordLight, rowLightHtml, setSuite: (v) => { suiteRowLights = v; } };`,
)();
const { recordLight, rowLightHtml, setSuite } = lights;

const AFTER = "2026-10-01T00:00:00Z";
const BEFORE = "2026-09-01T00:00:00Z";
const rec = ({ total = 6, pain = false, badge = "0001", program, pa_done, scored = true } = {}) => ({
  id: "a", badge, total,
  scores: { lunge: [{ val: scored ? 1 : null, pain }, { val: scored ? 2 : null, pain: false }] },
  ...(program ? { program } : {}),
  ...(pa_done ? { pa_done } : {}),
});
const prog = (finalized_at = AFTER, sent) => ({
  finalized_at, exercises: [{ id: "l1" }], ...(sent ? { sent_to_cadence_at: sent } : {}),
});

// White: nothing started -- not off, which only means "can't open here".
assert.deepEqual(recordLight(rec({ scored: false })), { status: "empty", detail: ["No scores yet"] });

// Blue: the next step is ready.
assert.deepEqual(recordLight(rec()), { status: "ready", detail: ["Needs a program built"] });
assert.deepEqual(recordLight(rec({ program: prog(AFTER) })).detail, ["Program not sent to Cadence"]);

// Red: pain, until Physical Assessment Done says Yes (owner, 2026-11-04, option A).
assert.equal(recordLight(rec({ pain: true })).status, "pain");
assert.deepEqual(recordLight(rec({ pain: true, pa_done: "Yes" })), { status: "good", detail: ["Referred for a physical assessment"] });
// The Tracker refuses to send a pain record's program, so it is never waiting to be sent.
assert.equal(recordLight(rec({ pain: true, pa_done: "Yes", program: prog(AFTER) })).status, "good");

// Amber: no badge number -- it replaced the 09-29 pulse -- and it outranks blue.
const noBadge = recordLight(rec({ badge: "" }));
assert.equal(noBadge.status, "hold");
assert.deepEqual(noBadge.detail, ["No badge number, so Cadence can't match them", "Needs a program built"]);

// Green: a low-risk score needs no program; a program from before the stamp counts as sent.
assert.equal(recordLight(rec({ total: 11 })).status, "good");
assert.equal(recordLight(rec({ total: 10 })).status, "ready");
assert.equal(recordLight(rec({ program: prog(AFTER, AFTER) })).status, "good");
assert.equal(recordLight(rec({ program: prog(BEFORE) })).status, "good");

// What a reader and a screen reader get: the Tracker's light alone off the suite...
const cell = rowLightHtml(rec());
assert.match(cell, /role="img"/);
assert.match(cell, /data-status="ready"/);
assert.match(cell, /aria-label="Blue: Needs a program built"/);
assert.doesNotMatch(cell, /row-lights/);

// ...and the suite's four, named by program, when the suite has answered.
const L = (status, text) => ({ status, detail: [text] });
setSuite({ a: { assess: L("good", "Scores are in"), records: L("pain", "Pain"), deliver: L("alert", "New pain report nobody has opened"), jobs: L("empty", "No scores yet") } });
const four = rowLightHtml(rec());
assert.equal((four.match(/class="row-light"/g) || []).length, 4);
assert.match(four, /aria-label="HMA-Manual — Green: Scores are in"/);
assert.match(four, /aria-label="HMA Cadence — Flashing Red: New pain report nobody has opened"/);
assert.match(four, /data-status="pain"/);
setSuite(null);

// The form: Physical Assessment Done exists, and starts disabled (rule 5).
assert.match(html, /<label>Physical Assessment Done<\/label><select id="f-pa-done" disabled/);
assert.match(html, /pa_done:document\.getElementById\('f-pa-done'\)\.value/);

console.log("row lights: the seven states, the Tracker's own and the suite's four");
