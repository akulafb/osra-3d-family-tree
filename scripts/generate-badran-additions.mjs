#!/usr/bin/env node
/**
 * Generates SQL to add new Badran nodes (75-309) and their links.
 * Run: node scripts/generate-badran-additions.mjs
 * Output: supabase/seed/bulk-upload-3-badran.sql
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const jsonPath = join(root, 'supabase', 'seed', 'bulk-upload-3-badran.json');
const outPath = join(root, 'supabase', 'seed', 'bulk-upload-3-badran.sql');

const CREATOR_UUID = '00000000-0000-0000-0000-000000000001';

function idToUuid(n) {
  const hex = n.toString(16).padStart(12, '0');
  return `10000000-1000-4000-8000-${hex}`;
}

function escapeSql(str) {
  return str.replace(/'/g, "''");
}

const data = JSON.parse(readFileSync(jsonPath, 'utf8'));

// Merge: 242 (Mohammad Hasan) → 021, 398 (Aisha Qassas) → 022
const MERGE_242_TO_021 = 242;
const MERGE_398_TO_022 = 398;
const ORIGINAL_021 = '10000000-1000-4000-8000-000000000021';
const ORIGINAL_022 = '10000000-1000-4000-8000-000000000022';

// 11 بدوي: first بدوي in Badran tree (عثمان → مسعود → بدوي → عبد الحليم). Requires seed to have node 0x00b = بدوي.
const BADWI_11 = 11;
const ORIGINAL_00B = '10000000-1000-4000-8000-00000000000b';

// New nodes only (>= 75), excluding duplicates we're merging into originals
const newNodes = data.nodes.filter(
  (n) => n.id >= 75 && n.id !== MERGE_242_TO_021 && n.id !== MERGE_398_TO_022
);

// Valid endpoint: >= 75 (new nodes we insert) or 242/398 (merge to 021/022) or 11 (بدوي, seed).
// IDs 1-74 in JSON map to UUIDs that COLLIDE with original seed (e.g. 46→Salam Zabalawi, 74→Samira Zabalawi).
// Exception: 11 بدوي is in the Badran tree seed; we allow 11→132 to connect مسعود to first بدوي.
function isValidEndpoint(id) {
  return id >= 75 || id === MERGE_242_TO_021 || id === MERGE_398_TO_022 || id === BADWI_11;
}

// Links where BOTH endpoints are valid (>=75 or 242/398). Drop any link touching 1-74.
const newLinksRaw = data.links.filter(
  (l) => (l.source >= 75 || l.target >= 75) && isValidEndpoint(l.source) && isValidEndpoint(l.target)
);
const newLinks = newLinksRaw.map((l) => {
  const src = l.source === MERGE_242_TO_021 ? ORIGINAL_021
    : l.source === MERGE_398_TO_022 ? ORIGINAL_022
    : l.source === BADWI_11 ? ORIGINAL_00B
    : idToUuid(l.source);
  const tgt = l.target === MERGE_242_TO_021 ? ORIGINAL_021
    : l.target === MERGE_398_TO_022 ? ORIGINAL_022
    : l.target === BADWI_11 ? ORIGINAL_00B
    : idToUuid(l.target);
  return { ...l, sourceUuid: src, targetUuid: tgt };
}).filter((l) => {
  // Skip 242-398 marriage (duplicate of 021-022)
  if (l.source === MERGE_242_TO_021 && l.target === MERGE_398_TO_022) return false;
  if (l.source === MERGE_398_TO_022 && l.target === MERGE_242_TO_021) return false;
  return true;
});

// Do NOT add bridge links from 021 to orphaned roots. Mohammad Hasan (242) has exactly 4 children
// in the JSON: 245, 246, 247, 248. Orphaned roots (nodes whose parent was in 1-74) would require
// wrong parent links (021 → 75, 76, 77, etc.) — we omit those to preserve data integrity.

const lines = [
  '-- ============================================================================',
  '-- BADRAN ADDITIONS: New nodes (>=75), merge 242→021, 398→022',
  '-- Run in Supabase SQL Editor against dev database.',
  '-- Does NOT overwrite existing nodes. Use paternal_family_cluster.',
  '-- Mohammad Hasan (242) has exactly 3 children: 246, 247, 248 (عبد الرزاق/245 removed as duplicate of Abdulrazzaq Badran).',
  '-- ============================================================================',
  '',
  '-- Nodes (new, excluding 242 & 398 merged into originals)',
  'INSERT INTO public.nodes (id, name, paternal_family_cluster, maternal_family_cluster, created_by_user_id, created_at)',
  'VALUES',
];

const nodeValues = newNodes.map(
  (n) =>
    `  ('${idToUuid(n.id)}', '${escapeSql(n.name)}', '${escapeSql(n.familyCluster)}', NULL, '${CREATOR_UUID}', NOW())`
);
lines.push(nodeValues.join(',\n'));
lines.push('ON CONFLICT (id) DO NOTHING;');
lines.push('');

lines.push('-- Links involving new nodes');
lines.push(
  'INSERT INTO public.links (source_node_id, target_node_id, type, parent_role, created_by_user_id, created_at)'
);
lines.push('VALUES');

const linkValues = newLinks.map(
  (l) =>
    `  ('${l.sourceUuid}', '${l.targetUuid}', '${l.type}', NULL, '${CREATOR_UUID}', NOW())`
);
lines.push(linkValues.join(',\n'));
lines.push(';');
lines.push('');
lines.push('-- Verification');
lines.push('SELECT COUNT(*) AS new_nodes FROM nodes WHERE id::text LIKE \'10000000-1000-4000-8000-%\';');

writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`Wrote ${outPath}`);
console.log(`  Nodes: ${newNodes.length}`);
console.log(`  Links: ${newLinks.length}`);
