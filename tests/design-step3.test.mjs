// What step 3 of DESIGN-SYSTEM-PLAN.md promised the Tracker's SCREEN.
//
// The plan's step 3 is a list of specific reversals -- Barlow and Barlow
// Condensed off the screen, 22px kept, the red band replaced by a card header,
// the red-bordered cards replaced by the Manual's, ~120 hard-coded hexes
// replaced by tokens, the `!important` locked-field states moved onto tint
// tokens -- and none of them is visible in a passing build. A stylesheet that
// quietly reintroduces a literal `#cc2200` still compiles, still renders, and
// still looks approximately right.
//
// Its sibling, `print-css-lock.test.mjs`, guards the opposite direction: that
// this rewrite did NOT reach the printed program. Between them, one says what
// had to change and the other says what must not.
//
// The two are deliberately not merged. The print lock is a fixture someone
// regenerates on purpose; these are properties that should hold forever.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const styleOpen = html.indexOf("<style>");
const styleClose = html.indexOf("</style>");
assert.ok(styleOpen > 0 && styleClose > styleOpen, "index.html has no <style> block");

const css = html.slice(styleOpen + "<style>".length, styleClose);
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const markup = html.slice(0, styleOpen) + html.slice(styleClose);

/** CSS with the print rules removed, so "the screen" means the screen.
 *
 *  Anything the printed program uses is exempt from every assertion below: it
 *  keeps its Barlow, its literal hexes and its px sizes on purpose, and the
 *  print lock is what holds it to them. */
function screenCss() {
  const kept = [];
  let start = 0;
  for (let i = 0; i < cssNoComments.length; i++) {
    if (cssNoComments[i] !== "{") continue;
    const selector = cssNoComments.slice(start, i).trim();
    const open = i;
    let depth = 0;
    for (; i < cssNoComments.length; i++) {
      if (cssNoComments[i] === "{") depth++;
      else if (cssNoComments[i] === "}" && --depth === 0) break;
    }
    const isPrint =
      /(^|[\s,>.])(print-|cal-|ex-type-)/.test(selector) ||
      selector.startsWith("@media print") ||
      selector.startsWith("@font-face");
    if (!isPrint) kept.push(selector + "{" + cssNoComments.slice(open + 1, i) + "}");
    start = i + 1;
  }
  return kept.join("\n");
}

const screen = screenCss();

test("Barlow is gone from the screen and kept for the paper", () => {
  // The whole point of pinning `.print-preview`'s font in the print lock: the
  // embedded faces stay, and only the printed program may reach them.
  assert.ok(
    !/Barlow/.test(screen),
    "a screen rule still names Barlow; the four embedded faces exist for the " +
      "printed program only (see the FONTS block's own comment)",
  );
  assert.match(html, /@font-face\{font-family:'Barlow'/, "the embedded faces are gone entirely");
});

test("the screen's type scale is the owner's 22px, set where rem can see it", () => {
  // Owner, 2026-09-06: "I like Tracker's larger font size."
  //
  // `html`, not `body`. `rem` resolves against the root element, so setting the
  // size on body would leave every rem in this sheet resolving against the
  // browser's 16px -- the screen would come out SMALLER than before the
  // restyle, which is the opposite of what was decided.
  assert.match(screen, /--size-base:\s*22px/, "the Tracker no longer declares its own 22px");
  assert.match(
    screen,
    /html\{font-size:var\(--size-base\)\}/,
    "--size-base is not applied to the root element, so every rem below it is wrong",
  );
});

test("the screen carries no hard-coded brand or status hex", () => {
  // The old palette, by value. These are the ones that mean something -- the
  // ATI red, the ink, the hypermobility blue, the OA orange, the four status
  // tints -- and each now has a token name. A literal creeping back is drift
  // that no screenshot would catch.
  const banned = [
    "#cc2200", "#aa1a00", // the logo red the Manual's #c8192e replaced
    "#1a1a1a", "#111", "#222", "#333",  // the ink chrome
    "#1565c0", "#e65100", "#bf360c",    // hypermobility, OA
    "#fde8e8", "#e8f5e9", "#fff3cd", "#fff8e1", "#e8eeff", // the status tints
  ];
  const found = banned.filter((hex) => new RegExp(`${hex}\\b`, "i").test(screen));
  assert.deepEqual(
    found,
    [],
    `screen rules still hard-code ${found.join(", ")} instead of reaching for a token`,
  );
});

test("severity never borrows the brand accent", () => {
  // Plan rule 4, and the reason --bad and --accent are separate names for the
  // same hue: a risk block, a pain flag and a locked field are findings, not
  // branding, and the day the brand red moves they must not move with it.
  for (const [selector, token] of [
    [".pain-flag", "--bad"],
    [".field-locked-no", "--bad"],
    [".field-locked-yes", "--ok"],
    [".total-display.high", "--bad"],
    [".total-display.mod", "--warn"],
    [".total-display.low", "--ok"],
    [".badge-high", "--bad"],
    [".badge-hyper", "--hyper"],
    [".badge-oa", "--hot"],
  ]) {
    const rule = new RegExp(`\\${selector}\\{([^}]*)\\}`).exec(screen);
    assert.ok(rule, `${selector} has no rule`);
    assert.match(
      rule[1],
      new RegExp(token),
      `${selector} does not use ${token}; status colour must come from a semantic token`,
    );
    assert.ok(
      !/var\(--accent\)/.test(rule[1]),
      `${selector} uses --accent for a status, which plan rule 4 forbids`,
    );
  }
});

test("hypermobility and osteoarthritis never share a colour", () => {
  // Stated in the Overlay's stylesheet in as many words -- "so a colour never
  // means two things across the two apps" -- and now true by construction in
  // both. Blue is hypermobility, orange is OA, and they are different tokens.
  for (const selector of [".score-block.hypermobile", ".hyper-btn", ".hyper-summary", ".badge-hyper"]) {
    const rule = new RegExp(`\\${selector}\\{([^}]*)\\}`).exec(screen);
    assert.ok(rule, `${selector} has no rule`);
    assert.match(rule[1], /--hyper/, `${selector} is not blue`);
    assert.ok(!/--hot\b/.test(rule[1]), `${selector} has taken the OA orange`);
  }
  for (const selector of [".oa-summary", ".oa-caution-flag", ".badge-oa"]) {
    const rule = new RegExp(`\\${selector}\\{([^}]*)\\}`).exec(screen);
    assert.ok(rule, `${selector} has no rule`);
    assert.match(rule[1], /--hot/, `${selector} is not orange`);
    assert.ok(!/--hyper/.test(rule[1]), `${selector} has taken the hypermobility blue`);
  }
});

test("there is exactly one theme mechanism, and the app opens light", () => {
  // The shared file's bare :root is the DARK theme, with light as an override,
  // because both React apps open dark. The Tracker opens light and always has,
  // so the document has to say so -- pasting the shared block in without this
  // silently flips which theme the app starts in. (Recorded as finding (b)
  // against Cadence in plan step 5; the Tracker is where it first bit.)
  assert.match(markup, /<html[^>]*data-theme="light"/, "the document does not open in the light theme");
  assert.ok(
    !/body\.dark/.test(cssNoComments),
    "a body.dark rule survives; the 78-rule parallel dark stylesheet is what step 3 removed",
  );
  assert.ok(
    !/classList\.(add|toggle)\('dark'\)/.test(markup),
    "the theme is still being switched by a class on body, which cannot reach :root",
  );
  assert.match(
    markup,
    /documentElement\.dataset\.theme/,
    "nothing sets the theme on the root element, so design/tokens.css never sees it",
  );
});

test("the chrome is the Manual's card, not the red band", () => {
  // Plan rules 1 and 2. The header stops being a field of brand red and becomes
  // a card carrying the mark, which is what frees --accent to mean something
  // further down the page; the card loses the 4px red left rule and the
  // inverted black title band.
  const header = /\.header\{([^}]*)\}/.exec(screen);
  assert.ok(header, ".header has no rule");
  assert.match(header[1], /border-radius:var\(--r-card\)/, "the header is not a card");
  assert.ok(!/#cc2200/.test(header[1]), "the header is still a red band");

  const cardTitle = /\.card-title\{([^}]*)\}/.exec(screen);
  assert.ok(cardTitle, ".card-title has no rule");
  assert.match(cardTitle[1], /background:none/, "the card title is still an inverted band");

  // The two buttons that sat ON that band were white-on-transparent and would
  // have become white on a light card -- invisible. Regression-pinned because
  // nothing else would report it.
  assert.ok(
    !/rgba\(255,255,255,\.15\)/.test(markup),
    "a control still assumes it is sitting on the old dark title band",
  );
});

test("buttons are pills", () => {
  // Plan rule 3: the condensed uppercase buttons go.
  const btn = /\.btn\{([^}]*)\}/.exec(screen);
  assert.ok(btn, ".btn has no rule");
  assert.match(btn[1], /border-radius:var\(--r-pill\)/, "buttons are not pills");
  assert.match(btn[1], /text-transform:none/, "buttons are still uppercase");
});
