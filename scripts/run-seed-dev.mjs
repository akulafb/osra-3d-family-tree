#!/usr/bin/env node
/**
 * Run bulk-upload-2-badran.sql against dev Supabase via Supabase SQL Editor.
 * 
 * Usage: Copy the output SQL and run in Supabase Dashboard > SQL Editor
 * for project djwqamcfllqziqiyvyjj (Osra 3D Family Tree - DEV)
 * 
 * Or use: npx supabase link + supabase db push (for migrations)
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, '../supabase/seed/bulk-upload-2-badran.sql');
const sql = readFileSync(sqlPath, 'utf8');

// Remove verification SELECT
const mainSql = sql.split('-- Verification')[0].trim();

console.log('SQL length:', mainSql.length);
console.log('\n--- Run this in Supabase SQL Editor (project djwqamcfllqziqiyvyjj) ---\n');
console.log(mainSql);
