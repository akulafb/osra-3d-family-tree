#!/usr/bin/env node
/**
 * Run a seed SQL file against dev Supabase via Supabase SQL Editor.
 * Usage: node scripts/run-seed-dev.mjs [path/to/seed.sql]
 * 
 * Usage: Copy the output SQL and run in Supabase Dashboard > SQL Editor
 * for your dev Supabase project
 * 
 * Or use: npx supabase link + supabase db push (for migrations)
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = process.argv[2] || join(__dirname, '../supabase/scripts/your-seed.sql');
const sql = readFileSync(sqlPath, 'utf8');

// Remove verification SELECT
const mainSql = sql.split('-- Verification')[0].trim();

console.log('SQL length:', mainSql.length);
console.log('\n--- Run this in Supabase SQL Editor (your dev project) ---\n');
console.log(mainSql);
