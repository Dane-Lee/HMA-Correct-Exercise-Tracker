// The shared storage adapter only ever asks the records store from a page this
// machine served (2026-10-06). The Tracker also deploys to Vercel, and the
// adapter's relative API path resolved THERE: every save PUT the whole record
// set to Vercel's servers, and every page load seeded each stored key the same
// way. Vercel refused them, but they had been sent. Nothing ran this code with a
// location before, so nothing could have noticed. This runs the real block out
// of index.html from both sides: off this machine it must make no request at
// all, and inside the suite it must still reach the store exactly as before.
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

function load(href) {
  const url = new URL(href);
  const requests = [];
  const local = new Map([["hma-records", RECORDS]]);
  const bars = [];
  const env = {
    location: { protocol: url.protocol, hostname: url.hostname, pathname: url.pathname },
    localStorage: {
      getItem: (k) => (local.has(k) ? local.get(k) : null),
      setItem: (k, v) => { local.set(k, String(v)); },
    },
    // The suite's store as a fresh install answers it: nothing held yet (404),
    // and it accepts the seed.
    fetch: (to, init = {}) => {
      const method = init.method || "GET";
      requests.push({ to, method, body: init.body });
      const ok = method === "PUT";
      return Promise.resolve({ status: ok ? 200 : 404, ok, json: () => Promise.resolve({}) });
    },
    console: { warn() {} },
    document: { createElement: () => ({ style: {} }), body: { appendChild: (el) => bars.push(el) } },
  };
  const make = new Function(...Object.keys(env), `${source}\nreturn makeSharedStorage();`);
  return { storage: make(...Object.values(env)), requests, local, bars };
}

// 1. Off this machine: no request of any kind, and the browser copy still works.
for (const href of [
  "https://hma-tracker.vercel.app/",            // the deployed Tracker
  "https://hma-tracker.vercel.app/tracker",     // even on the shell's own path
  "file:///C:/Users/someone/HMA%20Overlay.html", // the Overlay opened from disk
  "http://192.168.1.20:5182/",                  // another machine on the network
]) {
  const { storage, requests, local, bars } = load(href);

  const got = await storage.get("hma-records");
  assert.equal(got?.value, RECORDS, `${href}: reads this browser's copy`);

  const next = JSON.stringify([{ id: "r2", name: "Another Fictional Person" }]);
  await storage.set("hma-records", next);
  assert.equal(local.get("hma-records"), next, `${href}: writes this browser's copy`);

  assert.deepEqual(requests, [], `${href}: must send nothing anywhere, got ${JSON.stringify(requests)}`);
  assert.equal(bars.length, 1, `${href}: says once that it is saving to this browser only`);
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

console.log("storage adapter: sends nothing off this machine; the suite path unchanged");
