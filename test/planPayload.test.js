import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { indexPath } from './extract.js';

/* The plan payload no longer carries exercise text.
 *
 * Decision E12 was reversed by the owner on 2026-09-15 once the capacity was
 * measured rather than assumed. Carrying every exercise's full instructions put
 * a hard ceiling of 11-14 exercises on a plan, past which Cadence's issue page
 * refuses outright -- and the quality-focus picker can select 13 or 14
 * exercises in one go without warning anyone. The payload now carries identity
 * and dosage; Cadence resolves the words and the picture from a library
 * generated out of this file.
 *
 * THESE ARE SOURCE-LEVEL ASSERTIONS AND THAT IS A REAL LIMITATION, stated here
 * rather than glossed. `buildPlanPayload` is a function inside a single-file
 * app whose transitive dependencies run to a dozen consts, and `extract.js`
 * evaluates const initialisers only. Making it callable from a test is a
 * genuinely large change to the harness, and it would be proving something that
 * is already proved from the other end: `HMA-Cadence/test/slimPlanIngest.test.js`
 * exercises the real ingest against real payloads of both shapes.
 *
 * So what these do is narrow and worth having anyway -- they stop the two
 * fields being reinstated by a well-meaning edit that reads perfectly sensibly
 * on its own. Reinstating them would not break anything visibly; it would
 * quietly restore the ceiling, and the next person to hit it would be an EIS
 * with an employee waiting.
 */

const source = fs.readFileSync(indexPath, 'utf8');

/** The `return{...}` block inside `buildPlanPayload`'s per-exercise map. */
function perExerciseBlock() {
  const at = source.indexOf('function buildPlanPayload(');
  assert.notEqual(at, -1, 'buildPlanPayload is gone');
  const mapAt = source.indexOf('.map(pe=>{', at);
  assert.notEqual(mapAt, -1, 'the per-exercise map in buildPlanPayload has moved');
  const end = source.indexOf('});', mapAt);
  return source.slice(mapAt, end);
}

test('the plan payload does not carry exercise instructions', () => {
  assert.ok(
    !/\binstructions\s*:/.test(perExerciseBlock()),
    'buildPlanPayload is sending `instructions` again. That restores the 11-14 ' +
      'exercise ceiling on the plan QR — Cadence resolves the text from its own ' +
      'bundled library now (E12 reversed 2026-09-15).',
  );
});

test('the plan payload does not carry an image reference', () => {
  assert.ok(
    !/\bimage_ref\s*:/.test(perExerciseBlock()),
    'buildPlanPayload is sending `image_ref` again. Cadence resolves the image ' +
      'from its bundled library, keyed by source_exercise_id.',
  );
});

test('the plan payload still carries the id and the name', () => {
  /* The two fields that must survive the slimming, for different reasons.
   *
   * The id is the join key -- without it Cadence cannot resolve anything at
   * all. The name is the graceful degradation: if an exercise reaches a phone
   * whose library has not caught up, a heading with no description is a far
   * better failure than a blank card, and the plan contract requires it anyway,
   * which is why this change needed no version bump. */
  const block = perExerciseBlock();
  assert.match(block, /source_exercise_id\s*:/, 'the join key is gone');
  assert.match(block, /\bname\s*:/, 'the name is gone, so an unknown id would render blank');
});

test('the payload still carries the dosage Cadence cannot derive', () => {
  /* Everything the library CANNOT know, because it is about one person's
   * programme rather than about the exercise: which days, what order, and any
   * prescription the EIS overrode. Dropping one of these by accident while
   * slimming would be silent -- the plan would still apply, just wrong. */
  const block = perExerciseBlock();
  for (const field of ['days', 'sort_order', 'prescription_override']) {
    assert.match(block, new RegExp(`\\b${field}\\s*:`), `${field} is missing from the payload`);
  }
});
