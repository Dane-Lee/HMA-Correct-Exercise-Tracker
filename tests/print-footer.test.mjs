// The printed program's footer names the employee's own company. It said
// "Hendrickson" on every sheet, whoever the record belonged to (found by the
// management demo, 2026-10-15). Runs the real _footerCompany() out of index.html.
// Run with: npm test
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const raw = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const html = raw.split("\r\n").join("\n");

// Once, on the last page only (owner, 2026-11-23: get rid of it "at the bottom
// of every page except the very last page"). The Weekly Exercise Schedule is
// always the last page, so the footer lives there and nowhere else.
const footers = html.match(/<div class="print-footer">[^<]*/g) || [];
assert.equal(footers.length, 1, "the footer prints once");
const cal = html.indexOf("function _buildCalendarPage(");
const calEnd = html.indexOf("\n}\n", cal);
const at = html.indexOf('<div class="print-footer">');
assert.ok(cal > 0 && at > cal && at < calEnd, "and it is on the schedule page");
const sheet = html.slice(html.indexOf("function _renderPrintSheet("), html.indexOf("function backToBuilder("));
assert.ok(/\$\{_buildCalendarPage\(chosen,sched\)\}`;\s*$/.test(sheet.slice(0, sheet.indexOf("document.getElementById('ex-builder')")).trim()),
  "the schedule page is the last thing printed");
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
