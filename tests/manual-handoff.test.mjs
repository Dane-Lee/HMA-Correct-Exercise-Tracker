// The Manual's "Send to Tracker" hands an assessment straight over (2026-10-20):
// it goes under the hand-off key and the Tracker opens and takes it -- no
// download, no Import, no "Continue?". The owner asked for a "Done!" in place of
// the file dance; this pins that it says so, and that a likely duplicate still asks.
// Runs the real import block out of index.html, through takeManualHandoff().
// Run with: npm test
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const raw = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const html = raw.split("\r\n").join("\n");
const start = html.indexOf("// ---- Import merge");
const end = html.indexOf("function copyRecords(evt)");
assert.ok(start > 0 && end > start, "could not locate the import block");
const source = html.slice(start, end);

function load({ pathname = "/tracker", waiting = null, held = [], answer = true } = {}) {
  const log = { confirms: [], alerts: [], toasts: [], stored: [] };
  let value = waiting === null || waiting === "" ? waiting : JSON.stringify(waiting);
  const env = {
    records_ref: { value: held },
    saveRecords: () => {},
    renderTable: () => {},
    confirm: (m) => { log.confirms.push(m); return answer; },
    alert: (m) => log.alerts.push(m),
    toast: (m) => log.toasts.push(m),
    inSuite: () => pathname.replace(/\/+$/, "") === "/tracker",
    window: {
      storage: {
        get: async (key) => { log.stored.push(`get ${key}`); return value === null ? null : { value }; },
        set: async (key, v) => { log.stored.push(`set ${key} ${JSON.stringify(v)}`); value = v; },
      },
    },
  };
  const scope = new Function(
    ...Object.keys(env),
    `let records = records_ref.value;
     ${source}
     return async () => { await takeManualHandoff(); records_ref.value = records; };`,
  )(...Object.values(env));
  return { take: scope, env, log, waitingNow: () => value };
}

const cap = {
  id: "cap-1", badge: "1007", fname: "Captain", lname: "America", name: "Captain America",
  date: "2026-10-20", scores: { lunge: [{ val: 2, pain: false }, { val: 2, pain: false }] }, total: 10,
  notes: "",
};

// 1. Inside the suite: added, emptied, no "Continue?", and a "Done!" naming him.
{
  const { take, env, log, waitingNow } = load({ waiting: [cap] });
  await take();
  assert.deepEqual(env.records_ref.value.map((r) => r.name), ["Captain America"]);
  assert.equal(waitingNow(), "", "taken, not read: the hand-off is emptied");
  assert.deepEqual(log.stored.slice(0, 2), ["get hma-tracker-handoff", 'set hma-tracker-handoff ""'],
    "emptied BEFORE it is applied, so a failure part-way cannot bring it in twice");
  assert.equal(log.confirms.length, 0, "the Send to Tracker click was the decision");
  assert.equal(log.alerts.length, 0);
  assert.deepEqual(log.toasts, ["Done! Captain America's scores are in the Tracker."]);
}

// 2. Sent again after a re-score: his scores change, the program built here stays.
{
  const built = { ...cap, scores: {}, program: { exercises: [{ id: "l1" }] }, plan: "Yes" };
  const { take, env, log } = load({ waiting: [{ ...cap, total: 11 }], held: [built] });
  await take();
  assert.equal(env.records_ref.value.length, 1, "the same assessment is updated, not duplicated");
  assert.equal(env.records_ref.value[0].total, 11);
  assert.deepEqual(env.records_ref.value[0].program, { exercises: [{ id: "l1" }] });
  assert.equal(log.confirms.length, 0);
  assert.equal(log.toasts.length, 1);
}

// 3. A likely duplicate -- a new id, the same badge and date -- still asks.
{
  const fromElsewhere = { ...cap, id: "ai-9" };
  const { take, env, log } = load({ waiting: [cap], held: [fromElsewhere], answer: false });
  await take();
  assert.equal(log.confirms.length, 1);
  assert.match(log.confirms[0], /Possible duplicate/);
  assert.deepEqual(env.records_ref.value.map((r) => r.id), ["ai-9"], "declined, so nothing added");
  assert.equal(log.toasts.length, 0);
}

// 4. Nothing waiting, or an emptied key: nothing happens.
for (const waiting of [null, ""]) {
  const { take, env, log } = load({ waiting });
  await take();
  assert.equal(env.records_ref.value.length, 0);
  assert.equal(log.toasts.length + log.alerts.length + log.confirms.length, 0);
}

// 5. On its own (Vercel, or a file): there is no Manual, and the store is not asked.
{
  const { take, log } = load({ pathname: "/", waiting: [cap] });
  await take();
  assert.deepEqual(log.stored, []);
}

console.log("manual-handoff: ok");
