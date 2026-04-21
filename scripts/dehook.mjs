#!/usr/bin/env node
// Codemod: de-hook entity systems.
// - Strips useCallback wrappers (pure memoization over stable refs).
// - Replaces useRef(X) with { current: X }.
// - Renames use*System exports to create*System.
// - Cleans unused useCallback/useRef/useMemo from react imports.
// - Renames call sites in CanvasIsometricGrid.tsx.

import { readFileSync, writeFileSync } from 'node:fs';

const TARGETS = [
  'src/components/game/vehicleSystems.ts',
  'src/components/game/boatSystem.ts',
  'src/components/game/bargeSystem.ts',
  'src/components/game/seaplaneSystem.ts',
  'src/components/game/aircraftSystems.ts',
  'src/components/game/effectsSystems.ts',
  'src/components/game/windSystem.ts',
];

const HOOK_NAMES = [
  'useVehicleSystems',
  'useBoatSystem',
  'useBargeSystem',
  'useSeaplaneSystem',
  'useAircraftSystems',
  'useEffectsSystems',
  'useWindSystem',
];

const CALLER = 'src/components/game/CanvasIsometricGrid.tsx';

function walkParens(src, openIdx) {
  if (src[openIdx] !== '(') throw new Error('expected ( at ' + openIdx);
  let pos = openIdx + 1;
  let depth = 1;
  const commas = [];
  const n = src.length;
  let str = null;
  let tplDepth = 0;
  let line = false;
  let block = false;
  while (pos < n && depth > 0) {
    const c = src[pos];
    const nx = src[pos + 1];
    if (line) {
      if (c === '\n') line = false;
      pos++;
      continue;
    }
    if (block) {
      if (c === '*' && nx === '/') {
        block = false;
        pos += 2;
        continue;
      }
      pos++;
      continue;
    }
    if (str) {
      if (c === '\\') {
        pos += 2;
        continue;
      }
      if (str === '`' && c === '$' && nx === '{') {
        tplDepth++;
        str = null;
        pos += 2;
        continue;
      }
      if (c === str) {
        str = null;
        pos++;
        continue;
      }
      pos++;
      continue;
    }
    if (tplDepth > 0 && c === '}') {
      tplDepth--;
      str = '`';
      pos++;
      continue;
    }
    if (c === '/' && nx === '/') {
      line = true;
      pos += 2;
      continue;
    }
    if (c === '/' && nx === '*') {
      block = true;
      pos += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      str = c;
      pos++;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') {
      depth++;
      pos++;
      continue;
    }
    if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth === 0) return { close: pos, commas };
      pos++;
      continue;
    }
    if (c === ',' && depth === 1) commas.push(pos);
    pos++;
  }
  throw new Error('unbalanced parens from ' + openIdx);
}

function findUseCallbacks(src) {
  const tag = 'useCallback';
  const positions = [];
  let i = 0;
  while (i < src.length) {
    const idx = src.indexOf(tag, i);
    if (idx === -1) break;
    const before = idx === 0 ? ' ' : src[idx - 1];
    if (/[\w$]/.test(before)) {
      i = idx + tag.length;
      continue;
    }
    let j = idx + tag.length;
    while (j < src.length && /\s/.test(src[j])) j++;
    if (src[j] !== '(') {
      i = idx + tag.length;
      continue;
    }
    positions.push({ start: idx, open: j });
    i = j + 1;
  }
  return positions;
}

function stripUseCallbacks(src) {
  let stripped = 0;
  let out = src;
  while (true) {
    const positions = findUseCallbacks(out);
    if (positions.length === 0) break;
    const { start, open } = positions[positions.length - 1];
    const { close, commas } = walkParens(out, open);
    if (commas.length === 0) {
      // No deps array — leave as-is and stop on this site to avoid infinite loop.
      console.warn('useCallback with no comma at', start, 'in current file');
      break;
    }
    const depsStart = commas[commas.length - 1];
    const fnText = out.substring(open + 1, depsStart);
    out = out.substring(0, start) + fnText.trim() + out.substring(close + 1);
    stripped++;
  }
  return { out, stripped };
}

function replaceUseRef(src) {
  let count = 0;
  const out = src.replace(/\buseRef\s*\(([^()]*)\)/g, (_, inner) => {
    count++;
    return `{ current: ${inner.trim()} }`;
  });
  return { out, replaced: count };
}

function renameHookExports(src) {
  let out = src;
  let renamed = 0;
  for (const n of HOOK_NAMES) {
    const newName = 'create' + n.slice(3);
    const re = new RegExp(`\\bexport\\s+function\\s+${n}\\b`, 'g');
    out = out.replace(re, (m) => {
      renamed++;
      return m.replace(n, newName);
    });
  }
  return { out, renamed };
}

function fixReactImport(src) {
  const re = /import\s+(?:(React)\s*,\s*)?\{\s*([^}]+)\s*\}\s*from\s*['"]react['"]\s*;?\s*\n?/g;
  return src.replace(re, (_, reactDefault, named) => {
    const drop = new Set(['useCallback', 'useRef', 'useMemo']);
    const kept = named
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && !drop.has(s));
    const parts = [];
    if (reactDefault) parts.push(reactDefault);
    if (kept.length) parts.push(`{ ${kept.join(', ')} }`);
    if (parts.length === 0) return '';
    return `import ${parts.join(', ')} from 'react';\n`;
  });
}

for (const file of TARGETS) {
  const before = readFileSync(file, 'utf8');
  const cb = stripUseCallbacks(before);
  const ur = replaceUseRef(cb.out);
  const rn = renameHookExports(ur.out);
  const after = fixReactImport(rn.out);
  writeFileSync(file, after);
  console.log(
    `[${file}] stripped=${cb.stripped} useRef=${ur.replaced} renamed=${rn.renamed} delta=${after.length - before.length}`,
  );
}

// Update call sites in CanvasIsometricGrid.tsx.
{
  let caller = readFileSync(CALLER, 'utf8');
  let renamed = 0;
  for (const n of HOOK_NAMES) {
    const newName = 'create' + n.slice(3);
    const re = new RegExp(`\\b${n}\\b`, 'g');
    caller = caller.replace(re, () => {
      renamed++;
      return newName;
    });
  }
  writeFileSync(CALLER, caller);
  console.log(`[${CALLER}] renamed=${renamed} call-site refs`);
}
