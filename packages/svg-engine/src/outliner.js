import opentype from 'opentype.js';

/**
 * Parse @font-face rules from CSS text and add to fontMap.
 */
function parseFontFaceRulesFromText(cssText, baseUrl, fontMap) {
  // Match @font-face blocks
  const blocks = cssText.matchAll(/@font-face\s*\{([^}]+)\}/gi);
  for (const [, block] of blocks) {
    const get = (prop) => {
      const m = block.match(new RegExp(`${prop}\\s*:\\s*([^;]+)`, 'i'));
      return m ? m[1].trim() : null;
    };
    const family = (get('font-family') || '').replace(/['"]/g, '').trim().toLowerCase();
    if (!family) continue;
    const weight = normalizeWeight(get('font-weight') || '400');
    const style = (get('font-style') || 'normal').toLowerCase();
    const src = get('src');
    if (!src) continue;

    const urls = [...src.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((m) => m[1]);
    const pick =
      urls.find((u) => u.match(/\.woff2/i)) ||
      urls.find((u) => u.match(/\.woff/i)) ||
      urls.find((u) => u.match(/\.(ttf|otf)/i)) ||
      urls[0];
    if (pick) {
      const absolute = new URL(pick, baseUrl).href;
      const key = `${family}|${weight}|${style}`;
      fontMap.set(key, absolute);
    }
  }
}

/**
 * Collect @font-face source URLs from page stylesheets.
 * For cross-origin sheets, fetches the CSS text via the adapter.
 * Returns a Map keyed by "family|weight|style" → absolute URL.
 */
async function collectFontFaceUrls(fetchFn) {
  const fontMap = new Map();
  const crossOriginFetches = [];

  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      // CORS — fetch the stylesheet text via adapter
      if (sheet.href) {
        crossOriginFetches.push(
          (async () => {
            try {
              const dataUrl = await fetchFn(sheet.href);
              if (dataUrl && typeof dataUrl === 'string') {
                // data URL → text. Fetch the data URL to decode it.
                const resp = await fetch(dataUrl);
                const cssText = await resp.text();
                parseFontFaceRulesFromText(cssText, sheet.href, fontMap);
              }
            } catch (err) { console.debug('[Web to SVG] Cross-origin sheet fetch failed:', err.message); }
          })()
        );
      }
      continue;
    }
    for (const rule of rules) {
      if (!(rule instanceof CSSFontFaceRule)) continue;

      const family = rule.style
        .getPropertyValue('font-family')
        .replace(/['"]/g, '')
        .trim()
        .toLowerCase();
      const weight = normalizeWeight(rule.style.getPropertyValue('font-weight') || '400');
      const style = (rule.style.getPropertyValue('font-style') || 'normal').toLowerCase();
      const src = rule.style.getPropertyValue('src');

      // Extract the first url() — prefer woff2 > woff > ttf > otf
      const urls = [...src.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((m) => m[1]);
      const pick =
        urls.find((u) => u.match(/\.woff2/i)) ||
        urls.find((u) => u.match(/\.woff/i)) ||
        urls.find((u) => u.match(/\.(ttf|otf)/i)) ||
        urls[0];

      if (pick) {
        const absolute = new URL(pick, sheet.href || document.baseURI).href;
        const key = `${family}|${weight}|${style}`;
        fontMap.set(key, absolute);
      }
    }
  }

  // Wait for cross-origin stylesheet fetches
  if (crossOriginFetches.length > 0) {
    await Promise.allSettled(crossOriginFetches);
  }

  return fontMap;
}

function normalizeWeight(w) {
  const map = { thin: '100', hairline: '100', extralight: '200', ultralight: '200', light: '300', normal: '400', regular: '400', medium: '500', semibold: '600', demibold: '600', bold: '700', extrabold: '800', ultrabold: '800', black: '900', heavy: '900' };
  return map[w.toLowerCase()] || w;
}

/** Module-level cache for collectFontFaceUrls() — only fetched once per page load */
let fontFaceUrlCache = null;

/** Cache loaded opentype.Font instances by URL (LRU, max 30 entries) */
const FONT_CACHE_MAX = 30;
const fontCache = new Map();

async function loadFont(url, fetchFn) {
  if (fontCache.has(url)) {
    const cached = fontCache.get(url);
    // null means a previous parse failed — don't retry
    if (cached === null) throw new Error(`Font previously failed to parse: ${url}`);
    // Move to end (most recently used) by re-inserting
    fontCache.delete(url);
    fontCache.set(url, cached);
    return cached;
  }
  // Route through adapter to bypass CORS restrictions
  let buffer;
  try {
    const dataUrl = await fetchFn(url);
    if (dataUrl && typeof dataUrl === 'string') {
      // Convert data URL to ArrayBuffer
      const resp = await fetch(dataUrl);
      buffer = await resp.arrayBuffer();
    }
  } catch (err) {
    console.debug('[Web to SVG] Font load via adapter failed:', err.message);
  }
  if (!buffer) {
    // Fallback: direct fetch (works for same-origin fonts)
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Font fetch failed: ${resp.status}`);
    buffer = await resp.arrayBuffer();
  }
  let font;
  try {
    font = opentype.parse(buffer);
  } catch (err) {
    // Cache the failure so we don't re-fetch corrupt fonts
    fontCache.set(url, null);
    if (fontCache.size > FONT_CACHE_MAX) {
      fontCache.delete(fontCache.keys().next().value);
    }
    throw err;
  }
  fontCache.set(url, font);
  // Evict oldest entry if cache exceeds limit
  if (fontCache.size > FONT_CACHE_MAX) {
    fontCache.delete(fontCache.keys().next().value);
  }
  return font;
}

/**
 * Try to resolve a single font family name against the @font-face map.
 * Returns URL or null. Tries progressively looser matches.
 */
function resolveSingleFamily(fontMap, family, weight, style) {
  family = family.toLowerCase();

  // Exact match
  const exact = fontMap.get(`${family}|${weight}|${style}`);
  if (exact) return exact;

  // Try normal style if italic not found, and vice versa
  const altStyle = style === 'italic' ? 'normal' : 'italic';
  const alt1 = fontMap.get(`${family}|${weight}|${altStyle}`);
  if (alt1) return alt1;

  // Try 400/normal as fallback
  const fallback = fontMap.get(`${family}|400|normal`);
  if (fallback) return fallback;

  // Any variant of this family
  for (const [key, url] of fontMap) {
    if (key.startsWith(family + '|')) return url;
  }
  return null;
}

/**
 * Parse a CSS font-family string into an ordered list of family names.
 * e.g. "'JetBrains Mono', Menlo, monospace" → ["JetBrains Mono", "Menlo", "monospace"]
 */
function parseFontFamilyList(raw) {
  return raw
    .split(',')
    .map((f) => f.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

/**
 * Use document.fonts.check() to find which family from the list the
 * browser actually resolved. Returns the family name or null.
 */
function detectActiveFont(families, size, weight, style) {
  if (typeof document.fonts?.check !== 'function') return null;
  const spec = `${style} ${weight} ${size}px`;
  for (const family of families) {
    // Skip generic keywords — check() doesn't work with them
    if (/^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-monospace|ui-sans-serif|ui-serif|ui-rounded)$/.test(family)) continue;
    try {
      if (document.fonts.check(`${spec} "${family}"`)) return family;
    } catch { /* ignore */ }
  }
  return null;
}

/**
 * Resolve a font URL by trying each family in the font stack.
 * Priority: browser-resolved font → each family in order → null.
 */
function resolveFontUrl(fontMap, families, weight, style, size) {
  weight = normalizeWeight(weight);
  style = style.toLowerCase();

  // First: ask the browser which font it actually used
  const active = detectActiveFont(families, size, weight, style);
  if (active) {
    const url = resolveSingleFamily(fontMap, active, weight, style);
    if (url) return url;
  }

  // Fallback: try each family in the declared order
  for (const family of families) {
    // Skip generic keywords
    if (/^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-monospace|ui-sans-serif|ui-serif|ui-rounded)$/.test(family)) continue;
    const url = resolveSingleFamily(fontMap, family, weight, style);
    if (url) return url;
  }

  return null;
}

/**
 * Parse CSS font properties from a <text> element's style attribute.
 */
function getFontProps(textEl) {
  const s = textEl.getAttribute('style') || '';
  const get = (prop) => {
    const m = s.match(new RegExp(`${prop}\\s*:\\s*([^;]+)`));
    return m ? m[1].trim() : null;
  };

  const rawFamily = get('font-family') || textEl.getAttribute('font-family') || 'serif';
  const families = parseFontFamilyList(rawFamily);

  const size = parseFloat(get('font-size') || textEl.getAttribute('font-size') || '16');
  const weight = get('font-weight') || textEl.getAttribute('font-weight') || '400';
  const style = get('font-style') || textEl.getAttribute('font-style') || 'normal';
  const fill = get('fill') || textEl.getAttribute('fill') || '#000000';
  const dominantBaseline = get('dominant-baseline') || textEl.getAttribute('dominant-baseline') || 'auto';

  return { families, size, weight, style, fill, dominantBaseline };
}

/**
 * Compute the baseline y offset for an opentype.js font given the dominant-baseline.
 * dom-to-svg uses text-after-edge (y = bottom of text) and central (y = center of em box),
 * but opentype.js getPath() expects y = baseline.
 */
function adjustYForBaseline(y, fontSize, dominantBaseline, font) {
  if (dominantBaseline === 'text-after-edge') {
    // y is the after-edge (bottom). Baseline is above by the descent amount.
    return y + (font.descender / font.unitsPerEm) * fontSize;
  }
  if (dominantBaseline === 'central') {
    // y is the center of the em box. Baseline is below the center.
    return y + ((font.ascender + font.descender) / 2 / font.unitsPerEm) * fontSize;
  }
  // 'auto', 'alphabetic', or unknown — y is already the baseline
  return y;
}

/**
 * Get the effective x/y position of a text element,
 * accounting for x/y attributes and transforms.
 */
function getTextPosition(textEl) {
  const x = parseFloat(textEl.getAttribute('x') || '0');
  const y = parseFloat(textEl.getAttribute('y') || '0');
  return { x, y };
}

/**
 * Collect text content from a <text> element including <tspan> children.
 * Returns array of { text, x, y, dx, dy } segments.
 */
function collectTextSegments(textEl) {
  const segments = [];
  const basePos = getTextPosition(textEl);

  if (textEl.childNodes.length === 0) return segments;

  // Walk direct child nodes to handle mixed text + tspan content
  // e.g. <text>Hello <tspan>world</tspan></text>
  for (const child of textEl.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent;
      if (!text || !text.trim()) continue;
      segments.push({ text, x: basePos.x, y: basePos.y, dx: 0, dy: 0 });
    } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName === 'tspan') {
      const text = child.textContent;
      if (!text || !text.trim()) continue;
      const x = child.hasAttribute('x') ? parseFloat(child.getAttribute('x')) : null;
      const y = child.hasAttribute('y') ? parseFloat(child.getAttribute('y')) : null;
      const dx = parseFloat(child.getAttribute('dx') || '0');
      const dy = parseFloat(child.getAttribute('dy') || '0');
      segments.push({
        text,
        x: x !== null ? x : basePos.x,
        y: y !== null ? y : basePos.y,
        dx, dy,
      });
    }
  }

  return segments;
}

/**
 * Convert a text segment to an SVG <path> element using opentype.js.
 */
function textToPath(font, text, fontSize, x, y) {
  const path = font.getPath(text, x, y, fontSize);
  return path.toPathData(2); // 2 decimal places
}

/**
 * Rasterize a <text> element to a high-res canvas and return an <image>
 * replacement. Used as fallback when the font binary can't be obtained
 * for vector outlining (system fonts, unresolvable web fonts).
 */
function rasterizeTextElement(textEl, doc) {
  const NS = 'http://www.w3.org/2000/svg';
  const props = getFontProps(textEl);
  const segments = collectTextSegments(textEl);
  if (segments.length === 0) return null;

  const g = doc.createElementNS(NS, 'g');
  const transform = textEl.getAttribute('transform');
  if (transform) g.setAttribute('transform', transform);

  // Preserve opacity from style
  const elStyle = textEl.getAttribute('style') || '';
  const opacityMatch = elStyle.match(/opacity\s*:\s*([^;]+)/);
  if (opacityMatch) g.setAttribute('opacity', opacityMatch[1].trim());

  const scale = 3; // render at 3x for crisp text
  const fontStr = `${props.style} ${props.weight} ${props.size}px ${props.families.map(f => `"${f}"`).join(', ')}`;

  for (const seg of segments) {
    // Measure text
    const measureCanvas = document.createElement('canvas');
    const mCtx = measureCanvas.getContext('2d');
    if (!mCtx) throw new Error('Could not get canvas 2D context');
    mCtx.font = fontStr;
    const metrics = mCtx.measureText(seg.text);

    const ascent = metrics.actualBoundingBoxAscent || props.size * 0.8;
    const descent = metrics.actualBoundingBoxDescent || props.size * 0.2;
    const textWidth = metrics.width;
    const textHeight = ascent + descent;

    // Pad to avoid clipping
    const pad = Math.ceil(props.size * 0.15);
    const canvasW = Math.ceil(textWidth + pad * 2);
    const canvasH = Math.ceil(textHeight + pad * 2);

    const canvas = document.createElement('canvas');
    canvas.width = canvasW * scale;
    canvas.height = canvasH * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas 2D context');
    ctx.scale(scale, scale);
    ctx.font = fontStr;
    ctx.fillStyle = props.fill;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(seg.text, pad, ascent + pad);

    const dataUrl = canvas.toDataURL('image/png');
    const image = doc.createElementNS(NS, 'image');
    image.setAttribute('href', dataUrl);
    // Adjust y based on dominant-baseline before positioning
    let baselineY = seg.y + seg.dy;
    if (props.dominantBaseline === 'text-after-edge') {
      // y is the bottom of the text box; baseline is above by descent
      baselineY -= descent;
    } else if (props.dominantBaseline === 'central') {
      // y is the center of the em box; baseline is below center by ~(ascent-descent)/2
      baselineY += (ascent - descent) / 2;
    }
    image.setAttribute('x', (seg.x + seg.dx - pad).toString());
    image.setAttribute('y', (baselineY - ascent - pad).toString());
    image.setAttribute('width', canvasW.toString());
    image.setAttribute('height', canvasH.toString());
    g.appendChild(image);
  }

  return g;
}

/**
 * Outline all <text> elements in a parsed SVG document (in-place).
 * Operates directly on the DOM — no parse/serialize overhead.
 */
export async function outlineTextInSVGDoc(svgDoc, adapter) {
  const fetchFn = adapter.fetchAsDataUrl;
  if (!fontFaceUrlCache) fontFaceUrlCache = await collectFontFaceUrls(fetchFn);
  const fontMap = fontFaceUrlCache;

  const svgEl = svgDoc.documentElement;
  const NS = 'http://www.w3.org/2000/svg';

  const textEls = [...svgEl.querySelectorAll('text')];
  if (textEls.length === 0) return;

  let vectorOutlined = 0;
  let rasterOutlined = 0;

  for (const textEl of textEls) {
    const props = getFontProps(textEl);
    const segments = collectTextSegments(textEl);
    if (segments.length === 0) continue;

    // Try vector outlining first
    const url = resolveFontUrl(fontMap, props.families, props.weight, props.style, props.size);
    let vectorSuccess = false;

    if (url) {
      try {
        const font = await loadFont(url, fetchFn);
        const g = svgDoc.createElementNS(NS, 'g');
        const transform = textEl.getAttribute('transform');
        if (transform) g.setAttribute('transform', transform);

        for (const seg of segments) {
          const adjY = adjustYForBaseline(seg.y + seg.dy, props.size, props.dominantBaseline, font);
          const pathData = textToPath(font, seg.text, props.size, seg.x + seg.dx, adjY);
          if (!pathData) continue;

          const pathEl = svgDoc.createElementNS(NS, 'path');
          pathEl.setAttribute('d', pathData);
          pathEl.setAttribute('fill', props.fill);

          const style = textEl.getAttribute('style') || '';
          const opacityMatch = style.match(/opacity\s*:\s*([^;]+)/);
          if (opacityMatch) pathEl.setAttribute('opacity', opacityMatch[1].trim());

          g.appendChild(pathEl);
        }

        if (g.childNodes.length > 0) {
          textEl.parentNode.replaceChild(g, textEl);
          vectorOutlined++;
          vectorSuccess = true;
        }
      } catch {
        // Vector outlining failed, will fall back to raster
      }
    }

    // Fallback: rasterize via canvas (browser renders with the correct font)
    if (!vectorSuccess) {
      const replacement = rasterizeTextElement(textEl, svgDoc);
      if (replacement) {
        textEl.parentNode.replaceChild(replacement, textEl);
        rasterOutlined++;
      }
    }
  }

  console.log(`[Web to SVG] Outlined ${vectorOutlined} text(s) as vectors, ${rasterOutlined} as raster.`);
}

/**
 * Legacy string-based entry point — delegates to outlineTextInSVGDoc.
 */
export async function outlineTextInSVG(svgString, adapter) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  await outlineTextInSVGDoc(doc, adapter);
  return new XMLSerializer().serializeToString(doc.documentElement);
}
