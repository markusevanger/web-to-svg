# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Turborepo monorepo with three apps:

1. **Extension** (`apps/extension/`) — Chrome Extension (Manifest V3) called "Web to SVG" that lets users click any webpage element and export it as a clean SVG or PNG file. Pure JavaScript, no TypeScript.
2. **Web** (`apps/web/`) — Next.js 16 + Sanity frontend website.
3. **Studio** (`apps/studio/`) — Sanity Studio for content management. Project ID: `wdqtle79`, dataset: `production`.

## Commands

```bash
pnpm install              # Install all dependencies
pnpm build                # Build all apps (via Turborepo)
pnpm dev                  # Dev all apps in parallel
pnpm dev:extension        # Dev extension only
pnpm dev:web              # Dev Next.js site only (localhost:3000)
pnpm dev:studio           # Dev Sanity Studio only (localhost:3333)
```

### Extension-specific (from `apps/extension/`)

```bash
pnpm icons               # Generate extension icons (requires sharp)
pnpm build               # Build extension with esbuild
pnpm dev                 # Generate icons + build
```

No automated tests or linting configured for the extension. Testing is manual — load `apps/extension/dist/` as an unpacked extension in `chrome://extensions/` (Developer mode).

## Architecture

### Extension (`apps/extension/`)

Three-part Chrome Extension MV3 architecture:

**Service Worker** (`src/background/service-worker.js`) — Handles keyboard shortcuts, content script injection, cross-origin image proxying (CORS workaround), and file downloads.

**Popup** (`src/popup/`) — Settings UI stored in `chrome.storage.sync`: outline text, capture background, Figma optimization, PNG scale, filename pattern.

**Content Scripts** (`src/content/`) — Injected on demand. Entry point is `picker.js`, which esbuild bundles into `dist/content/content.bundle.js` as an IIFE.

#### Content Script Modules

- `picker.js` — Element picker with hover highlight, tooltip, and 2-second delay before SVG preview
- `converter.js` — Core conversion: handles `<svg>`, `<img>`, `<canvas>`, `<video>`, and general DOM elements (via `dom-to-svg`). Also does background color compositing and PNG export.
- `outliner.js` — Text-to-path conversion: tries vector outlining via opentype.js, falls back to canvas rasterization. Caches fonts, handles cross-origin font fetching through service worker.
- `figma-optimizer.js` — SVG post-processing: collapses groups, converts paths to rects, normalizes coordinates, strips debug attributes
- `popover.js` — Shadow DOM export dialog with SVG/PNG download and clipboard copy

### Web (`apps/web/`)

Next.js 16 site with Sanity integration via `next-sanity`. Uses Tailwind CSS v4.

### Studio (`apps/studio/`)

Sanity Studio with presentation tool for visual editing, structure tool, and Unsplash image plugin.

## Build System

- **Monorepo**: Turborepo with pnpm workspaces
- **Extension**: esbuild bundles content scripts into a single IIFE and popup JS separately. CSS is imported as text (`{ '.css': 'text' }` loader). Static files copied to `dist/`.
- **Web**: Next.js built-in build
- **Studio**: Sanity CLI build

## Key Patterns

- **CORS proxy**: Content scripts send `fetch-image` messages to service worker for cross-origin resources
- **Shadow DOM**: Popover uses Shadow DOM for style isolation from page
- **Graceful degradation**: Text outlining falls back from vector to raster; image inlining has 10-second timeout
- **Extension uses pure JS**: No TypeScript/JSDoc, ES module imports/exports
- **Sanity typegen**: Schema extracted to root `sanity.schema.json`, shared by web and studio apps

## Frontend Design Rules (`apps/web/`)

### Typography
- **Sans (default)**: Spline Sans Mono — monospace feel, loaded as `--font-spline-sans-mono`
- **Serif (decorative)**: Tiro Devanagari Sanskrit — used for italic/display text (e.g. hero "ANYTHING")
- Headings: `font-medium tracking-tight` (base layer)
- Responsive text sizing: `text-sm md:text-base`, `text-2xl md:text-3xl lg:text-4xl`

### Colors
- **Primary**: `#04e762` (green), hover: `#03c754`
- **Accents**: blue `#008bf8`, yellow `#f5b700`, pink `#e80080`
- **Brand**: `#f50`, blue `#0052ff`, yellow `#cdea19`
- **Background**: white `#fff` with dot-grid pattern (`bg-dots`)
- **Text**: near-black `#0b0b0b`
- **Placeholder** (empty media): `#b3b3b3`
- Custom cool-toned gray scale (50–950)
- Color tokens are defined in `globals.css` `@theme` block (Tailwind v4 source of truth)

### Buttons
- Two variants: **primary** (solid green, `font-bold`) and **secondary** (green border, transparent bg)
- Shape: `rounded-full px-6 py-3 text-sm` — pill-shaped
- Hover: `transition-colors duration-200`
- Icons via Lucide, positioned left or right
- Always use the `Button` component — don't hard-code button styles inline

### Layout
- **Container**: centered, `padding: 0 2rem`, no max-width
- **Sections**: `px-6 lg:px-28 py-16`
- **Two-column grid**: `grid lg:grid-cols-2 gap-12 lg:gap-24 items-center`
- **Hero**: centered flex column, `min-h-[80vh]`, content capped at `max-w-5xl`
- **Header**: fixed, `h-24`, `z-50`; page has `pt-24` to compensate
- Default transition duration: `250ms`

### Media
- Images and video: `rounded-xl`
- Empty media placeholders: `bg-placeholder rounded-xl aspect-video`

### General
- No dark mode implemented (variant defined but unused)
- `hoverOnlyWhenSupported: true` for mobile
