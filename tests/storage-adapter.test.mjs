// The shared storage adapter only ever asks the records store from a page this
// machine served (2026-10-06). The Tracker also deploys to Vercel, and the
// adapter's relative API path resolved THERE: every save PUT the whole record
// set to Vercel's servers, and every page load seeded each stored key the same
// way. Vercel refused them, but they had been sent. Nothing ran this code with a
// location before, so nothing could have noticed. This runs the real block out
// of index.html from both sides: off this machine it must make no request at
// all, and inside the suite it must still reach the store exactly as before.
//
// v4 put the store behind the suite's sign-in, so section 3 is the other
// failure that has to cost nothing: a sign-in that lapses with the page open,
// and a server stopped mid-work. In both the change must survive the reload.
// The Overlay carries the same block byte for byte (test_shared_adapter.py).
// Run with: npm test
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const start = html.indexOf("/* ==== HMA-SHARED-STORAGE-ADAPTER");
const end = html.indexOf("/* ==== END HMA-SHARED-STORAGE-ADAPTER ==== */");
assert.ok(start > 0 && end > start, "could not locate the shared storage adapter");
const source = html.slice(start, end);

const RECORDS = JSON.stringify([{ id: "r1", name: "Fictional Person", badge: "000" }]);
const NEWER = JSON.stringify([{ id: "r1", name: "Fictional Person", badge: "000", note: "edited" }]);
const UNSENT = "hma-unsent:hma-records";

// The suite's store as a fresh install answers it: nothing held yet, and it
// accepts writes. `respond` overrides that per method: a status, or "reject"
// for a server that is not there at all.
const freshStore = { GET: 404, PUT: 200 };

function load(href, { respond = freshStore, local = new Map([["hma-records", RECORDS]]) } = {}) {
  const url = new URL(href);
  const requests = [];
  const bars = [];
  const location = { protocol: url.protocol, hostname: url.hostname, pathname: url.pathname, href };
  const env = {
    location,
    localStorage: {
      getItem: (k) => (local.has(k) ? local.get(k) : null),
      setItem: (k, v) => { local.set(k, String(v)); },
      removeItem: (k) => { local.delete(k); },
    },
    fetch: (to, init = {}) => {
      const method = init.method || "GET";
      requests.push({ to, method, body: init.body });
      const answer = respond[method];
      if (answer === "reject") return Promise.reject(new TypeError("Failed to fetch"));
      const ok = answer >= 200 && answer < 300;
      return Promise.resolve({ status: answer, ok, json: () => Promise.resolve({ value: "stored-copy" }) });
    },
    console: { warn() {} },
    document: { createElement: () => ({ style: {} }), body: { appendChild: (el) => bars.push(el) } },
  };
  const make = new Function(...Object.keys(env), `${source}\nreturn makeSharedStorage();`);
  return { storage: make(...Object.values(env)), requests, local, bars, location };
}

// 1. Off this machine: no request of any kind, and the browser copy still works.
//    The offline bar keeps the timing it had before any of this (v3 in the
//    block): on opening from a file, but on the Vercel copy only after a save,
//    because the owner's manager shows that copy to people without saving.
for (const [href, barOnOpening] of [
  ["https://hma-tracker.vercel.app/", false],            // the deployed Tracker
  ["https://hma-tracker.vercel.app/tracker", false],     // even on the shell's own path
  ["file:///C:/Users/someone/HMA%20Overlay.html", true], // the Overlay opened from disk
  ["http://192.168.1.20:5182/", false],                  // another machine on the network
]) {
  const { storage, requests, local, bars } = load(href);

  const got = await storage.get("hma-records");
  assert.equal(got?.value, RECORDS, `${href}: reads this browser's copy`);
  assert.equal(bars.length, barOnOpening ? 1 : 0, `${href}: offline bar on opening is ${barOnOpening}`);

  const next = JSON.stringify([{ id: "r2", name: "Another Fictional Person" }]);
  await storage.set("hma-records", next);
  assert.equal(local.get("hma-records"), next, `${href}: writes this browser's copy`);

  assert.deepEqual(requests, [], `${href}: must send nothing anywhere, got ${JSON.stringify(requests)}`);
  assert.equal(bars.length, 1, `${href}: once saved, says once that it is saving to this browser only`);
  assert.equal(local.has(UNSENT), false, `${href}: nothing is waiting to be sent from here`);
}

// 2. Served by this machine: the suite reaches the shared store as it always did.
for (const href of [
  "http://localhost:8003/tracker",
  "http://127.0.0.1:8003/overlay",
  "http://[::1]:8003/tracker",
]) {
  const { storage, requests, bars } = load(href);

  const got = await storage.get("hma-records");
  assert.equal(got?.value, RECORDS, `${href}: returns the browser copy it seeded`);
  assert.deepEqual(
    requests.map((r) => r.method),
    ["GET", "PUT"],
    `${href}: asks the store, then seeds it from this browser`,
  );
  assert.equal(JSON.parse(requests[1].body).value, RECORDS, `${href}: the seed carries the records`);

  await storage.set("hma-records", "[]");
  assert.equal(requests.at(-1).method, "PUT", `${href}: a save goes to the store`);
  assert.equal(requests.at(-1).to, "/api/local-store/hma-records", `${href}: on this origin's store`);
  assert.equal(bars.length, 0, `${href}: no offline bar when the store answers`);
}

// 3a. The sign-in lapses with the page open. The save is kept, marked unsent,
//     and the page goes to sign-in -- not the offline bar, which would be wrong
//     about the cause.
{
  const before = load("http://localhost:8003/tracker", { respond: { GET: 200, PUT: 401 } });
  await before.storage.set("hma-records", NEWER);

  assert.equal(before.local.get("hma-records"), NEWER, "a refused save is still in this browser");
  assert.equal(before.local.get(UNSENT), "1", "and is marked as not yet sent");
  assert.equal(before.location.href, "/?next=%2Ftracker", "and the page goes to sign-in, then back here");
  assert.equal(before.bars.length, 0, "signed out is not offline");

  // Signed back in, the page reloads with the same browser storage. The stored
  // copy is OLDER, and must not win.
  const after = load("http://localhost:8003/tracker", { respond: { GET: 200, PUT: 200 }, local: before.local });
  const got = await after.storage.get("hma-records");

  assert.equal(got?.value, NEWER, "the reload shows the change, not the older stored copy");
  assert.deepEqual(after.requests.map((r) => r.method), ["PUT"], "it sends before it asks");
  assert.equal(JSON.parse(after.requests[0].body).value, NEWER, "and what it sends is the change");
  assert.equal(after.local.has(UNSENT), false, "once the store has it, it is no longer unsent");
}

// 3b. The server stops mid-work. Same promise: the change outlives the reload.
{
  const before = load("http://127.0.0.1:8003/overlay", { respond: { GET: "reject", PUT: "reject" } });
  await before.storage.set("hma-records", NEWER);

  assert.equal(before.local.get(UNSENT), "1", "a save the server never got is marked unsent");
  assert.equal(before.bars.length, 1, "and the offline bar says so");

  const after = load("http://127.0.0.1:8003/overlay", { respond: { GET: 200, PUT: 200 }, local: before.local });
  const got = await after.storage.get("hma-records");

  assert.equal(got?.value, NEWER, "back up, the change is what loads");
  assert.equal(JSON.parse(after.requests[0].body).value, NEWER, "and it reaches the store first");
  assert.equal(after.local.has(UNSENT), false, "and is no longer unsent");
}

// 3c. A read that meets a lapsed sign-in goes to sign-in too, and the address
//     it hands over is one the sign-in screen will honour.
{
  const { storage, location } = load("http://localhost:8003/overlay/", { respond: { GET: 401, PUT: 401 } });
  const got = await storage.get("hma-records");

  assert.equal(got?.value, RECORDS, "the page still has this browser's copy to show");
  assert.equal(location.href, "/?next=%2Foverlay", "a trailing slash is not passed on: /overlay is what the shell allows");
}

console.log("storage adapter: nothing leaves this machine; a lapsed sign-in or stopped server costs nothing");
