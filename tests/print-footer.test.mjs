// The printed program's footer names the employee's own company. It said
// "Hendrickson" on every sheet, whoever the record belonged to (found by the
// management demo, 2026-10-15). Runs the real _footerCompany() out of index.html.
// Run with: npm test
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const raw = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const html = raw.split("\r\n").join("\n");

const footers = html.match(/<div class="print-footer">[^<]*/g) || [];
assert.equal(footers.length, 2, "both printed pages carry a footer");
for (const footer of footers) {
  assert.match(footer, /ATI Worksite Solutions\$\{_footerCompany\(\)\}/, "the footer's company comes from the record");
  assert.doesNotMatch(footer, /Hendrickson/, "no company is written into the footer");
}

const start = html.indexOf("function _footerCompany(){");
const end = html.indexOf("\n}\n", start) + 3;
assert.ok(start > 0 && end > start, "could not locate _footerCompany");
const footerFor = (record) =>
  new Function("currentEmpForSheet", `${html.slice(start, end)}\nreturn _footerCompany();`)(record);

assert.equal(footerFor({ company: "Hendrickson" }), " — Hendrickson");
assert.equal(footerFor({ company: "Stark Industries" }), " — Stark Industries");
assert.equal(footerFor({ company: "  " }), "", "no company, no dash");
assert.equal(footerFor(null), "");
assert.equal(footerFor({ company: "A&B <Co>" }), " — A&amp;B &lt;Co&gt;", "escaped for the page");

console.log("print footer: the employee's own company, never a hardcoded one");
