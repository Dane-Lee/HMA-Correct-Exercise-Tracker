/* Integrity checks on the exercise library.

   These exist because the library is five parallel structures keyed by the same
   ids — the definition plus EX_TYPE, EX_DURATION, EXERCISE_TARGETS and
   EXERCISE_CATEGORY — and nothing enforces that they agree. Adding or removing an
   exercise means touching all five, and a miss is silent: the app still builds and
   the gap only shows up on a printed plan.

   Exercise ids are public identifiers shared with Overlay and Cadence, so the
   retirement check matters beyond this repo. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadLibrary, allExercises, imagesDir } from './extract.js';

const MAPS = ['EX_TYPE', 'EX_DURATION', 'EXERCISE_TARGETS', 'EXERCISE_CATEGORY'];
const lib = loadLibrary([
  'DEFAULT_IMAGES', 'EXERCISES', 'BALANCE_EX', 'CORE_EX', 'CAT_EXERCISES',
  'OA_CAUTION', ...MAPS,
]);
const ex = allExercises(lib);
const ids = Object.keys(ex);

/* Ids retired for a reason. Reusing one would silently repoint any plan or record
   that still references it, in this app or in Overlay and Cadence.
   s8 'Single Leg Balance Clock' — retired 2026-08-20 as a duplicate of b7. */
const RETIRED = ['s8'];

test('every exercise has an entry in all five parallel structures', () => {
  const gaps = [];
  for (const id of ids) {
    for (const m of MAPS) if (!(id in lib[m])) gaps.push(`${id} missing from ${m}`);
  }
  assert.deepEqual(gaps, []);
});

test('no map entry refers to an exercise that no longer exists', () => {
  const orphans = [];
  for (const m of [...MAPS, 'DEFAULT_IMAGES']) {
    for (const id of Object.keys(lib[m])) if (!(id in ex)) orphans.push(`${m}.${id}`);
  }
  assert.deepEqual(orphans, []);
});

test('exercise ids are unique across every group', () => {
  const seen = new Map();
  const dupes = [];
  const groups = [
    ...Object.entries(lib.EXERCISES).map(([g, v]) => [g, v.exercises || []]),
    ['BALANCE_EX', lib.BALANCE_EX || []],
    ['CORE_EX', lib.CORE_EX || []],
  ];
  for (const [group, list] of groups) {
    for (const e of list) {
      if (seen.has(e.id)) dupes.push(`${e.id} in both ${seen.get(e.id)} and ${group}`);
      else seen.set(e.id, group);
    }
  }
  assert.deepEqual(dupes, []);
});

test('retired ids are not reused', () => {
  const revived = RETIRED.filter((id) => id in ex);
  assert.deepEqual(revived, [], `retired ids must stay retired: ${revived.join(', ')}`);
});

/* This is the check that would have caught s8/b7 before it shipped: two entries
   describing the same movement, reachable from the same picker, so one plan could
   prescribe it twice. */
test('no two exercises in the same picker are near-duplicates', () => {
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const collisions = [];
  for (const [cat, list] of Object.entries(lib.CAT_EXERCISES)) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        // same words in a different order, or identical instructions
        const anagram = norm(a.name).split('').sort().join('') === norm(b.name).split('').sort().join('');
        if (anagram || (a.inst && a.inst === b.inst)) {
          collisions.push(`${cat}: ${a.id} "${a.name}" vs ${b.id} "${b.name}"`);
        }
      }
    }
  }
  assert.deepEqual(collisions, []);
});

test('every mapped image resolves to a file on disk', () => {
  const missing = Object.entries(lib.DEFAULT_IMAGES)
    .filter(([, p]) => !fs.existsSync(`${imagesDir}/${p.replace('/images/', '')}`))
    .map(([id, p]) => `${id} -> ${p}`);
  assert.deepEqual(missing, []);
});

/* The two brand marks are not exercise artwork and are referenced from the
   markup rather than from DEFAULT_IMAGES, so they are named here rather than
   discovered. TWO of them, and which is used where is the brand guide's rule,
   not a preference: §1.5/§1.6 say the white REVERSE lockup goes on dark grounds
   (the app header) and the 2/C POSITIVE on white (both printed sheets).
   `ati-logo.jpg` was the single non-compliant file both used to share -- wrong
   reds, wrong resolution -- and is gone. */
const BRAND_MARKS = new Set(['ati-logo-reverse.png', 'ati-logo-positive.png']);

test('no image file is shipped without being referenced', () => {
  const used = new Set(Object.values(lib.DEFAULT_IMAGES).map((p) => p.replace('/images/', '')));
  const strays = fs.readdirSync(imagesDir).filter((f) => !BRAND_MARKS.has(f) && !used.has(f));
  assert.deepEqual(strays, []);
});

test('both brand marks are on disk and each is used where the guide says', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const mark of BRAND_MARKS) {
    assert.ok(fs.existsSync(`${imagesDir}/${mark}`), `${mark} is missing from public/images`);
    assert.ok(html.includes(mark), `${mark} is shipped but never referenced`);
  }
  assert.ok(
    !html.includes('ati-logo.jpg'),
    'the non-compliant ati-logo.jpg is referenced again; its reds are not ATI Bright Red',
  );
  // The header is the dark ground; the two print sheets are white paper.
  const header = html.slice(html.indexOf('class="header-logo"'), html.indexOf('class="header-logo"') + 200);
  assert.match(header, /ati-logo-reverse\.png/, 'the dark header must carry the REVERSE lockup');
  const printUses = (html.match(/ati-logo-positive\.png/g) || []).length;
  assert.equal(printUses, 2, 'both printed sheets must carry the POSITIVE lockup');
});

test('OA_CAUTION only lists exercises that exist', () => {
  const ghosts = [...lib.OA_CAUTION].filter((id) => !(id in ex));
  assert.deepEqual(ghosts, []);
});

/* Cadence resolves an exercise's image against its own assets by bare filename,
   so a path or an extension it cannot render is a broken image on an employee's
   phone. That property is really a property of THIS map: since E12 was reversed
   (2026-09-15) the plan no longer carries `image_ref` at all, and Cadence's
   bundled library derives it from here instead — so if every entry is
   `/images/<name>.webp` with nothing nested, the filename cannot be anything
   else. Asserted here so the verification checklist does not have to ask a human
   to eyeball it. */
test('every image path is a flat /images/<name>.webp with no nested directory', () => {
  const bad = Object.entries(lib.DEFAULT_IMAGES)
    .filter(([, p]) => !/^\/images\/[^/]+\.webp$/.test(p))
    .map(([id, p]) => `${id} -> ${p}`);
  assert.deepEqual(bad, []);
});

/* Not a failure — the remaining artwork is tracked work, so surface it rather than
   letting it sit only in a chat log. */
test('report exercises still awaiting artwork', () => {
  const missing = ids.filter((id) => !(id in lib.DEFAULT_IMAGES));
  console.log(`    ${ids.length - missing.length}/${ids.length} exercises have an image`);
  for (const id of missing) console.log(`    still needed: ${id}  ${ex[id].name}`);
  assert.ok(Array.isArray(missing));
});
