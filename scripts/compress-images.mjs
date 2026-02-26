#!/usr/bin/env node
/**
 * Compresses planet textures to WebP for mobile (≤100KB target where possible).
 * Excludes starfield images (stars.jpg, 8K Stars Texture.jpg) - keep max quality.
 * Run: node scripts/compress-images.mjs
 */
import sharp from 'sharp';
import { readdir, stat } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '../public/planet-textures');
const MAX_DIM = 512;
const WEBP_QUALITY = 75;

async function compress() {
  const files = await readdir(SRC);
  const EXCLUDE = ['stars.jpg', '8K Stars Texture.jpg'];
  const images = files.filter(f =>
    /\.(jpg|jpeg|png)$/i.test(f) && !EXCLUDE.includes(f)
  );

  for (const file of images) {
    const input = join(SRC, file);
    const base = file.replace(extname(file), '');
    const output = join(SRC, `${base}.webp`);

    try {
      const meta = await sharp(input).metadata();
      const { width, height } = meta;
      const scale = width > MAX_DIM || height > MAX_DIM
        ? Math.min(MAX_DIM / (width || 1), MAX_DIM / (height || 1))
        : 1;
      const w = Math.round((width || 512) * scale);
      const h = Math.round((height || 512) * scale);

      await sharp(input)
        .resize(w, h)
        .webp({ quality: WEBP_QUALITY })
        .toFile(output);

      const { size } = await stat(output);
      console.log(`${file} → ${base}.webp (${(size / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.error(`Failed ${file}:`, err.message);
    }
  }
}

compress();
