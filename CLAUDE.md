# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome Extension (Manifest V3) called "Element to SVG" that lets users click any webpage element and export it as a clean SVG or PNG file. Pure JavaScript, no TypeScript.

## Commands

```bash
npm install          # Install dependencies
npm run build        # Build extension with esbuild
npm run icons        # Generate extension icons (requires sharp)
npm run dev          # Generate icons + build
```

No automated tests or linting configured. Testing is manual — load `dist/` as an unpacked extension in `chrome://extensions/` (Developer mode).

## Architecture

Three-part Chrome Extension MV3 architecture:

**Service Worker** (`src/background/service-worker.js`) — Handles keyboard shortcuts, content script injection, cross-origin image proxying (CORS workaround), and file downloads.

**Popup** (`src/popup/`) — Settings UI stored in `chrome.storage.sync`: outline text, capture background, Figma optimization, PNG scale, filename pattern.

**Content Scripts** (`src/content/`) — Injected on demand. Entry point is `picker.js`, which esbuild bundles into `dist/content/content.bundle.js` as an IIFE.

### Content Script Modules

- `picker.js` — Element picker with hover highlight, tooltip, and 2-second delay before SVG preview
- `converter.js` — Core conversion: handles `<svg>`, `<img>`, `<canvas>`, `<video>`, and general DOM elements (via `dom-to-svg`). Also does background color compositing and PNG export.
- `outliner.js` — Text-to-path conversion: tries vector outlining via opentype.js, falls back to canvas rasterization. Caches fonts, handles cross-origin font fetching through service worker.
- `figma-optimizer.js` — SVG post-processing: collapses groups, converts paths to rects, normalizes coordinates, strips debug attributes
- `popover.js` — Shadow DOM export dialog with SVG/PNG download and clipboard copy

## Build System

esbuild bundles content scripts into a single IIFE and popup JS separately. CSS is imported as text (`{ '.css': 'text' }` loader) for injection. Static files (manifest, HTML, service worker) are copied to `dist/`.

## Key Patterns

- **CORS proxy**: Content scripts send `fetch-image` messages to service worker for cross-origin resources
- **Shadow DOM**: Popover uses Shadow DOM for style isolation from page
- **Graceful degradation**: Text outlining falls back from vector to raster; image inlining has 10-second timeout
- **No TypeScript/JSDoc**: Pure JS with ES module imports/exports
