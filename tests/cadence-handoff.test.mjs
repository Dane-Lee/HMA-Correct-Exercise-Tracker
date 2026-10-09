// "→ Cadence" hands the plan straight to Cadence-Admin inside the suite
// (2026-10-07). Both live in the suite now and share its store, so the plan goes
// under the hand-off key and the Issue page opens and takes it -- no paste. On
// its own (the Vercel copy, or a file) there is no Cadence-Admin to hand to, and
// the button copies exactly as it always did.
// Runs the real exportPlanForCadence() out of index.html, in both places.
// Run with: npm test
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const raw = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const html = raw.split("\r\n").join("\n");
const start = html.indexOf("// The key Cadence-Admin's Issue page takes a handed-over plan from.");
const fnStart = html.indexOf("function exportPlanForCadence(", start);
const end = html.indexOf("\n}\n", fnStart) + 3;
assert.ok(start > 0 && fnStart > start && end > fnStart, "could not locate exportPlanForCadence");
const source = html.slice(start, end);

function load(pathname) {
  const calls = [];
  const env = {
    records: [{ id: "r1", program: {} }],
    buildPlanPayload: () => ({ plan_id: "plan-1", employee: { employee_number: "000" } }),
    saveRecords: async () => { calls.push("save"); },
    alert: () => {},
    fallbackCopy: () => { calls.push("fallback"); },
    location: { pathname, href: "where it was" },
    navigator: { clipboard: { writeText: async () => { calls.push("clipboard"); } } },
    window: { storage: { set: async (key) => { calls.push(`store ${key}`); } } },
    setTimeout: () => 0,
  };
  const run = new Function(...Object.keys(env), `${source}\nreturn exportPlanForCadence;`)(...Object.values(env));
  return { run, env, calls };
}

const button = { textContent: "→ Cadence" };

// 1. Inside the suite: saved, copied, handed over, then the Issue page -- in that order.
for (const pathname of ["/tracker", "/tracker/"]) {
  const { run, env, calls } = load(pathname);
  await run("r1", { currentTarget: button });

  assert.ok(env.records[0].program.sent_to_cadence_at, `${pathname}: the program is stamped as sent`);
  assert.deepEqual(
    calls,
    ["save", "clipboard", "store hma-cadence-handoff"],
    `${pathname}: saved, copied while the click still counts, then handed over`,
  );
  assert.equal(env.location.href, "/cadence/admin/issue", `${pathname}: opens Cadence-Admin's Issue page`);
}

// 2. On its own: a copy, exactly as before, and nothing written for a Cadence-Admin that is not there.
for (const pathname of ["/", "/index.html"]) {
  const { run, env, calls } = load(pathname);
  await run("r1", { currentTarget: button });

  assert.ok(env.records[0].program.sent_to_cadence_at, `${pathname}: still stamped`);
  assert.ok(calls.includes("clipboard"), `${pathname}: copied`);
  assert.ok(!calls.some((c) => c.startsWith("store ")), `${pathname}: no hand-off outside the suite`);
  assert.equal(env.location.href, "where it was", `${pathname}: stays on the page`);
}

console.log("cadence hand-off: straight to the Issue page inside the suite; a copy everywhere else");
