// Each record's light (owner, 2026-10-14): the home screen's Records light,
// worked out per record, so a blue row here is exactly a record that turns
// Records blue there. These cases restate the ones in the suite's
// test_suite_status.py, run against the real recordLight() out of index.html.
// Run with: npm test
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const raw = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const html = raw.split("\r\n").join("\n");
const start = html.indexOf("const LIGHT_STAMP_INTRODUCED_AT=");
const end = html.indexOf("\nfunction renderTable(){", start);
assert.ok(start > 0 && end > start, "could not locate recordLight");
const { recordLight, rowLightHtml } = new Function(`${html.slice(start, end)}\nreturn { recordLight, rowLightHtml };`)();

const AFTER = "2026-10-01T00:00:00Z";
const BEFORE = "2026-09-01T00:00:00Z";
const rec = ({ total = 6, pain = false, badge = "0001", program } = {}) => ({
  id: "a", badge, total,
  scores: { lunge: [{ val: 1, pain }, { val: 2, pain: false }] },
  ...(program ? { program } : {}),
});
const prog = (finalized_at = AFTER, sent) => ({
  finalized_at, exercises: [{ id: "l1" }], ...(sent ? { sent_to_cadence_at: sent } : {}),
});

// Blue: no program, and nothing that says it needs none.
assert.deepEqual(recordLight(rec()), { status: "ready", detail: ["Needs a program built"], pulse: false });

// Owner, 2026-09-29: a pain referral and a low-risk score need no program.
assert.equal(recordLight(rec({ pain: true })).status, "good");
assert.equal(recordLight(rec({ total: 11 })).status, "good");
assert.equal(recordLight(rec({ total: 10 })).status, "ready");

// A program finished after the stamp existed has to be sent; one from before counts as sent.
assert.deepEqual(recordLight(rec({ program: prog(AFTER) })).detail, ["Program not sent to Cadence"]);
assert.equal(recordLight(rec({ program: prog(AFTER, AFTER) })).status, "good");
assert.equal(recordLight(rec({ program: prog(BEFORE) })).status, "good");

// The Tracker refuses to send a pain record's program, so it is never waiting to be sent.
assert.equal(recordLight(rec({ pain: true, program: prog(AFTER) })).status, "good");

// A missing badge breathes; it does not change the colour.
const noBadge = recordLight(rec({ total: 12, badge: "" }));
assert.equal(noBadge.status, "good");
assert.equal(noBadge.pulse, true);
assert.deepEqual(noBadge.detail, ["No badge number"]);

// What a reader and a screen reader get.
const cell = rowLightHtml(rec());
assert.match(cell, /role="img"/);
assert.match(cell, /data-status="ready"/);
assert.match(cell, /aria-label="Ready: Needs a program built"/);
assert.doesNotMatch(cell, /data-pulse/);
assert.match(rowLightHtml(rec({ total: 12, badge: "" })), /data-pulse="true"/);

console.log("row lights: each record's light follows the home screen's Records rules");
