import * as esbuild from 'esbuild';
import { cp, mkdir, readdir } from 'fs/promises';
import { join } from 'path';

const dist = 'dist';

// Clean and prepare dist
await mkdir(dist, { recursive: true });

// Bundle content script (picker.js entry point → single IIFE)
await esbuild.build({
  entryPoints: ['src/content/picker.js'],
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  outfile: `${dist}/content/content.bundle.js`,
  loader: { '.css': 'text' },
});

// Bundle popup script
await esbuild.build({
  entryPoints: ['src/popup/popup.js'],
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  outfile: `${dist}/popup/popup.js`,
});

// Copy static files
const statics = [
  ['src/manifest.json', `${dist}/manifest.json`],
  ['src/popup/popup.html', `${dist}/popup/popup.html`],
  ['src/popup/popup.css', `${dist}/popup/popup.css`],
  ['src/background/service-worker.js', `${dist}/background/service-worker.js`],
];

for (const [src, dest] of statics) {
  await mkdir(join(dest, '..'), { recursive: true });
  await cp(src, dest);
}

// Copy icons
await mkdir(`${dist}/icons`, { recursive: true });
const icons = await readdir('src/icons');
for (const icon of icons) {
  await cp(join('src/icons', icon), join(dist, 'icons', icon));
}

console.log('Build complete.');
