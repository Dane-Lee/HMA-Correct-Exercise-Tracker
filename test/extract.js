/* Pull the exercise-library data blocks out of index.html.
   The app is a single HTML file with inline script, so there is nothing to import.
   Rather than slice by line number (which silently rots whenever the file shifts),
   find each `const NAME =` and scan to its matching terminator, quote-aware. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const appRoot = path.resolve(here, '..');
export const indexPath = path.join(appRoot, 'index.html');

/* Scan from `=` to the end of the initialiser, tracking bracket depth and string
   state. Exercise instructions contain apostrophes, braces and quotes, so a naive
   brace count or a regex gets this wrong. */
function readInitialiser(src, from) {
  let i = src.indexOf('=', from) + 1;
  let depth = 0;
  let quote = null;
  const start = i;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{' || ch === '[' || ch === '(') depth++;
    else if (ch === '}' || ch === ']' || ch === ')') depth--;
    else if (ch === ';' && depth === 0) break;
  }
  return src.slice(start, i).trim();
}

/* Evaluate the named consts together, in source order, so later ones can refer to
   earlier ones (CAT_EXERCISES is built from EXERCISES and BALANCE_EX). */
export function loadLibrary(names) {
  const src = fs.readFileSync(indexPath, 'utf8');
  const parts = [];
  for (const name of names) {
    const at = src.search(new RegExp(`\\bconst\\s+${name}\\s*=`));
    if (at === -1) throw new Error(`const ${name} not found in index.html`);
    parts.push(`const ${name} = ${readInitialiser(src, at)};`);
  }
  const body = `${parts.join('\n')}\nreturn { ${names.join(', ')} };`;
  return new Function(body)();
}

/* Every exercise in the library, keyed by id, with the group it came from. */
export function allExercises(lib) {
  const out = {};
  for (const [group, val] of Object.entries(lib.EXERCISES)) {
    for (const ex of val.exercises || []) out[ex.id] = { ...ex, group };
  }
  for (const [group, arr] of [['BALANCE_EX', lib.BALANCE_EX], ['CORE_EX', lib.CORE_EX]]) {
    for (const ex of arr || []) if (!out[ex.id]) out[ex.id] = { ...ex, group };
  }
  return out;
}

export const imagesDir = path.join(appRoot, 'public', 'images');
