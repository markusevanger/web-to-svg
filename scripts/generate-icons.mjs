import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'src', 'icons');

const sizes = [16, 48, 128];

function makeSvg(size) {
  const r = Math.round(size * 0.15);
  const fontSize = Math.round(size * 0.38);
  const strokeWidth = Math.max(1, Math.round(size * 0.06));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect x="${strokeWidth / 2}" y="${strokeWidth / 2}" width="${size - strokeWidth}" height="${size - strokeWidth}" rx="${r}" ry="${r}" fill="#3B82F6" stroke="#2563EB" stroke-width="${strokeWidth}"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="${fontSize}" fill="white">&lt;/&gt;</text>
</svg>`;
}

await mkdir(outDir, { recursive: true });

for (const size of sizes) {
  const svg = Buffer.from(makeSvg(size));
  await sharp(svg).resize(size, size).png().toFile(join(outDir, `icon${size}.png`));
  console.log(`Generated icon${size}.png`);
}
