// The printed program is the employee's paper. It does not change.
//
// DESIGN-SYSTEM-PLAN.md rule 6, verbatim: "The Tracker's printed program keeps
// its own stylesheet and its embedded Barlow — that page is the employee's paper
// and nobody asked for it to change." Step 3 rewrites the SCREEN around it, and
// the plan already records that the obvious protection does not exist here: the
// print rules are interleaved in the same <style> block as the screen's, not in
// a separate stylesheet. One careless global replace reaches both.
//
// So this pins every rule the printed sheet actually uses, by name and by
// declaration, against a committed fixture. It is not a hash: a hash tells you
// something moved, and this tells you WHICH rule and HOW, which is the
// difference between a test you can act on and one you delete.
//
// The protected set is derived from what `_renderPrintSheet` emits, not guessed:
// every `print-*` class, the `cal-*` calendar (which is part of the printed
// program, not a screen view), the `ex-type-*` badges, and the `@media print`
// block itself.
//
// TO CHANGE THE PAPER ON PURPOSE: edit the CSS, run with UPDATE_PRINT_LOCK=1 to
// regenerate the fixture, and put the reason in the commit. The fixture diff is
// then the record of what moved on the page.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const fixturePath = fileURLToPath(new URL("./fixtures/print-css.json", import.meta.url));

// A selector is protected if it names anything the printed sheet renders.
// `cal-` is in here because the day calendar prints; `ex-type-` because the
// exercise-type badge appears on every printed card.
const PROTECTED = /(^|[\s,>.])(print-|cal-|ex-type-)|\.print-preview/;

function styleBlock(source) {
  const open = source.indexOf("<style>");
  const close = source.indexOf("</style>");
  assert.ok(open > 0 && close > open, "index.html has no <style> block");
  return source.slice(open + "<style>".length, close);
}

/** The `@media print{ ... }` block, matched by brace depth rather than by regex.
 *  A regex stops at the first `}`, which inside this block is `@page`'s. */
function mediaPrintBlock(css) {
  const at = css.indexOf("@media print{");
  if (at === -1) return null;
  let depth = 0;
  for (let i = css.indexOf("{", at); i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(at, i + 1);
  }
  return null;
}

/** Top-level `selector{declarations}` rules, skipping anything inside an at-rule.
 *
 *  Written as a scanner rather than a split on "}" because `@media` blocks nest
 *  and a split would hand back fragments of them as if they were rules. */
function topLevelRules(css) {
  const rules = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === "{") {
      if (depth === 0) {
        // Comments come out of the SELECTOR, not the body. A `/* PRINT */`
        // banner sitting above a rule is part of the text preceding its `{`,
        // and leaving it in made `.print-preview` key as
        // "/* PRINT */ .print-preview" (with the newline) -- present in the
        // fixture, absent under
        // the name every assertion looks it up by.
        const selector = css.slice(start, i).replace(/\/\*[\s\S]*?\*\//g, "").trim();
        const open = i;
        let d = 0;
        for (; i < css.length; i++) {
          if (css[i] === "{") d++;
          else if (css[i] === "}" && --d === 0) break;
        }
        // An at-rule body holds rules of its own and is handled separately.
        if (!selector.startsWith("@")) {
          rules.push({ selector, body: css.slice(open + 1, i).trim() });
        }
        start = i + 1;
      }
    } else if (ch === "}" && depth === 0) {
      start = i + 1;
    }
  }
  return rules;
}

function protectedRules(source) {
  const css = styleBlock(source);
  const locked = {};
  for (const { selector, body } of topLevelRules(css)) {
    // A comma-joined selector counts if ANY of its parts prints. Splitting it
    // would let `body.dark .print-preview,body.dark .print-preview *` through
    // as two halves and lose the rule's real text.
    if (PROTECTED.test(selector)) {
      assert.ok(!(selector in locked), `duplicate protected selector: ${selector}`);
      locked[selector] = body;
    }
  }
  const media = mediaPrintBlock(css);
  assert.ok(media, "the @media print block is gone");
  locked["@media print"] = media;
  return locked;
}

const current = protectedRules(html);

if (process.env.UPDATE_PRINT_LOCK === "1") {
  writeFileSync(fixturePath, JSON.stringify(current, null, 2) + "\n", "utf8");
  console.log(`print lock regenerated: ${Object.keys(current).length} rules`);
}

const expected = JSON.parse(readFileSync(fixturePath, "utf8"));

test("every rule the printed program uses is byte-identical to the fixture", () => {
  for (const [selector, body] of Object.entries(expected)) {
    assert.ok(
      selector in current,
      `the printed program lost a rule: ${selector} is no longer in index.html`,
    );
    assert.equal(
      current[selector],
      body,
      `the printed program's ${selector} changed. That page is the employee's ` +
        `paper (DESIGN-SYSTEM-PLAN rule 6) and the screen rewrite must not reach ` +
        `it. If the change is deliberate, rerun with UPDATE_PRINT_LOCK=1.`,
    );
  }
});

test("no new rule quietly joins the printed program", () => {
  // The other direction, and not symmetric with the test above: a rule ADDED to
  // a print selector changes the paper just as surely as one edited, and would
  // otherwise pass unnoticed because every locked rule still matched.
  const added = Object.keys(current).filter((selector) => !(selector in expected));
  assert.deepEqual(
    added,
    [],
    `new rules now target the printed program: ${added.join(", ")}`,
  );
});

test("the print sheet's font is pinned to Barlow, independently of the screen", () => {
  // The whole reason the screen's type can move at all. Pinned as its own
  // assertion because it is the load-bearing half of "print stays what it is":
  // if `.print-preview` ever inherits the body face, changing the screen changes
  // the paper, and the fixture above would still pass on the day it happened.
  assert.match(
    current[".print-preview"] ?? "",
    /font-family:'Barlow',Arial,sans-serif/,
    ".print-preview no longer names Barlow itself, so it will inherit the screen's face",
  );
  assert.match(
    html,
    /@font-face\{font-family:'Barlow'/,
    "the embedded Barlow faces are gone; the printed program has nothing to render in",
  );
});
