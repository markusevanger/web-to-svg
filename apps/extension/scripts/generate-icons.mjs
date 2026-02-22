import sharp from 'sharp';
import { mkdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..', '..');
const outDir = join(__dirname, '..', 'src', 'icons');

const logoSvg = await readFile(join(root, 'favicon.svg'), 'utf-8');
const paths = logoSvg.match(/<path[\s\S]*?\/>/g).join('\n    ');

// Original logo is 270x145 (wide rectangle).
// Center it on a transparent square background, filling ~90% width.
function makeSquareSvg(size) {
  const padding = size * 0.05;
  const availW = size - padding * 2;
  const scale = availW / 270;
  const logoH = 145 * scale;
  const offsetY = (size - logoH) / 2;
  const offsetX = padding;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <g transform="translate(${offsetX}, ${offsetY}) scale(${scale})">
    <rect width="270" height="145" rx="19" fill="#04E762"/>
    ${paths}
  </g>
</svg>`;
}

const sizes = [16, 48, 128];

await mkdir(outDir, { recursive: true });

for (const size of sizes) {
  const svg = Buffer.from(makeSquareSvg(size));
  await sharp(svg).resize(size, size).png().toFile(join(outDir, `icon${size}.png`));
  console.log(`Generated icon${size}.png`);
}
