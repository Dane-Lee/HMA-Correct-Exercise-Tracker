// The per-record Overlay hand-off has one way to go wrong that no amount of
// clicking would reveal quickly: sending the record unwrapped. Overlay's
// looksLikeHma() gate is `Array.isArray(arr) && arr.length && arr[0].scores…`,
// so a bare object fails the gate and ingestHma() then throws "arr is not
// iterable". A one-element array ingests exactly like the bulk send.
//
// Pulls the real functions out of index.html rather than restating them.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
// Stop before copyForOverlay so the real clipboard helper stays out and the
// stub below is what the senders call — the assertion here is about what gets
// handed to the clipboard, not about the clipboard itself.
const start = html.indexOf("// ---- Overlay hand-off");
const end = html.indexOf("function copyForOverlay(");
assert.ok(start > 0 && end > start, "could not locate the Overlay hand-off block");

const records = [
  { id: "r1", name: "A B", badge: "4412", scores: { lunge: 2 }, hypermobile: false, program: { days: [] } },
  { id: "r2", name: "C D", badge: "9001", scores: { lunge: 3 }, hypermobile: true },
];

let copied = null;
let alerted = null;
const copyForOverlay = (json) => { copied = json; };
const alert = (m) => { alerted = m; };
const evt = { currentTarget: { textContent: "" } };

const fn = new Function(
  "records", "copyForOverlay", "alert", "JSON",
  `${html.slice(start, end)}; return { sendRecordToOverlay, sendToOverlay };`,
)(records, copyForOverlay, alert, JSON);

// --- a single record travels wrapped -------------------------------------
fn.sendRecordToOverlay("r1", evt);
const single = JSON.parse(copied);
assert.ok(Array.isArray(single), "single-record send MUST be an array — a bare object breaks Overlay");
assert.equal(single.length, 1, "sends exactly the one record asked for, not the roster");
assert.equal(single[0].id, "r1");
assert.equal(single[0].badge, "4412", "the whole record travels, not a projection of it");
assert.ok(single[0].program, "a persisted program rides along");

// --- it is genuinely per-record, not the roster with extra steps ----------
copied = null;
fn.sendRecordToOverlay("r2", evt);
const second = JSON.parse(copied);
assert.equal(second.length, 1);
assert.equal(second[0].id, "r2", "sends the record clicked, not the first one");

// --- the bulk send still sends everything --------------------------------
copied = null;
fn.sendToOverlay(evt);
assert.equal(JSON.parse(copied).length, records.length, "header button still syncs the roster");

// --- a stale row id complains instead of copying nothing ------------------
copied = null; alerted = null;
fn.sendRecordToOverlay("gone", evt);
assert.equal(copied, null, "nothing is copied for a record that no longer exists");
assert.match(alerted ?? "", /no longer exists/);

console.log("All Overlay hand-off checks passed.");
