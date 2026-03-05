import { elementToSVG, inlineResources } from 'dom-to-svg';
import { outlineTextInSVG, outlineTextInSVGDoc } from './outliner.js';
import { optimizeForFigma, optimizeForFigmaDoc } from './figma-optimizer.js';

function get2dContext(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas 2D context');
  return ctx;
}

/**
 * Parse an rgba/rgb color string into { r, g, b, a } (0–255, a 0–1).
 * Handles both legacy comma syntax and modern space syntax:
 *   rgb(255, 0, 0)  rgba(255, 0, 0, 0.5)
 *   rgb(255 0 0)    rgb(255 0 0 / 0.5)
 * Returns null if unparseable.
 */
function parseColor(str) {
  if (!str || str === 'transparent' || str === 'rgba(0, 0, 0, 0)') return null;
  // Legacy comma-separated: rgb(r, g, b) / rgba(r, g, b, a)
  let m = str.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 };
  // Modern space-separated: rgb(r g b) / rgb(r g b / a)
  m = str.match(/rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?))?\s*\)/);
  if (m) {
    let a = 1;
    if (m[4] !== undefined) {
      a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4];
    }
    return { r: +m[1], g: +m[2], b: +m[3], a };
  }
  return null;
}

/**
 * Composite foreground color over background color (both { r, g, b, a }).
 */
function compositeOver(fg, bg) {
  const a = fg.a + bg.a * (1 - fg.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: Math.round((fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a),
    g: Math.round((fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a),
    b: Math.round((fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a),
    a,
  };
}

function colorToString(c) {
  if (c.a >= 1) return `rgb(${c.r}, ${c.g}, ${c.b})`;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`;
}

/**
 * Determine the browser's canvas color (the backdrop behind all CSS).
 * Browsers paint white by default, but honor color-scheme: dark by
 * switching to a dark canvas. getComputedStyle never reports this —
 * it's not a CSS background-color — so we infer it from color-scheme.
 */
function getCanvasColor() {
  const cs = getComputedStyle(document.documentElement).colorScheme;
  // color-scheme can be "dark", "light dark", "dark light", "normal", etc.
  // If "dark" comes first or is the only value, the canvas is dark.
  if (cs && /^\s*dark/i.test(cs)) return { r: 0, g: 0, b: 0, a: 1 };
  return { r: 255, g: 255, b: 255, a: 1 };
}

/**
 * Walk up the DOM from `el` collecting and compositing background colors
 * until we hit a fully opaque layer or the document root.
 * Falls back to the browser canvas color (white or dark depending on
 * color-scheme) so the exported SVG always has a background.
 */
function resolveBackgroundColor(el) {
  // Collect all ancestors from element up to <html>
  const chain = [];
  let node = el;
  while (node) {
    chain.push(node);
    if (node === document.documentElement) break;
    node = node.parentElement;
  }

  // Start with the browser canvas color as the base
  let result = getCanvasColor();

  // Walk from outermost ancestor inward, compositing backgrounds
  for (let i = chain.length - 1; i >= 0; i--) {
    const bg = parseColor(getComputedStyle(chain[i]).backgroundColor);
    if (!bg || bg.a === 0) continue;

    result = compositeOver(bg, result);
    // If fully opaque, no point looking further inward
    if (result.a >= 1) break;
  }

  return colorToString(result);
}

/**
 * Insert a background <rect> as the first child of the SVG root element.
 * Matches the viewBox so the rect covers the entire visible area,
 * even when the viewBox origin is non-zero (e.g. dom-to-svg output
 * uses page coordinates like viewBox="256 128 800 600").
 * Operates in-place on a parsed SVG document.
 */
function insertBackgroundRectDoc(svgDoc, color) {
  const svg = svgDoc.documentElement;
  const rect = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'rect');

  const vb = svg.getAttribute('viewBox');
  if (vb) {
    const parts = vb.split(/[\s,]+/).map(Number);
    if (parts.length >= 4 && parts.every(Number.isFinite)) {
      rect.setAttribute('x', String(parts[0]));
      rect.setAttribute('y', String(parts[1]));
      rect.setAttribute('width', String(parts[2]));
      rect.setAttribute('height', String(parts[3]));
    } else {
      rect.setAttribute('width', '100%');
      rect.setAttribute('height', '100%');
    }
  } else {
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
  }

  rect.setAttribute('fill', color);
  svg.insertBefore(rect, svg.firstChild);
}

/**
 * Parse all four border-radius corner values from computed style.
 * Returns { tl, tr, br, bl } in px (numbers), or null if no rounding.
 */
function parseBorderRadii(style) {
  const tl = parseFloat(style.borderTopLeftRadius) || 0;
  const tr = parseFloat(style.borderTopRightRadius) || 0;
  const br = parseFloat(style.borderBottomRightRadius) || 0;
  const bl = parseFloat(style.borderBottomLeftRadius) || 0;
  if (tl === 0 && tr === 0 && br === 0 && bl === 0) return null;
  return { tl, tr, br, bl };
}

/**
 * Build an SVG path `d` attribute for a rounded rectangle.
 */
function roundedRectPath(w, h, r) {
  // Clamp radii so they don't exceed half the dimension
  const maxR = Math.min(w / 2, h / 2);
  const tl = Math.min(r.tl, maxR);
  const tr = Math.min(r.tr, maxR);
  const br = Math.min(r.br, maxR);
  const bl = Math.min(r.bl, maxR);
  return `M${tl},0 H${w - tr} A${tr},${tr} 0 0 1 ${w},${tr} V${h - br} A${br},${br} 0 0 1 ${w - br},${h} H${bl} A${bl},${bl} 0 0 1 0,${h - bl} V${tl} A${tl},${tl} 0 0 1 ${tl},0 Z`;
}

/**
 * Compute image position/size for a given object-fit value.
 * Returns { x, y, drawW, drawH } for the <image> element.
 */
function computeObjectFit(fit, containerW, containerH, naturalW, naturalH) {
  if (!naturalW || !naturalH) return { x: 0, y: 0, drawW: containerW, drawH: containerH };
  const containerRatio = containerW / containerH;
  const imageRatio = naturalW / naturalH;

  switch (fit) {
    case 'contain': {
      let drawW, drawH;
      if (imageRatio > containerRatio) { drawW = containerW; drawH = containerW / imageRatio; }
      else { drawH = containerH; drawW = containerH * imageRatio; }
      return { x: (containerW - drawW) / 2, y: (containerH - drawH) / 2, drawW, drawH };
    }
    case 'cover': {
      let drawW, drawH;
      if (imageRatio > containerRatio) { drawH = containerH; drawW = containerH * imageRatio; }
      else { drawW = containerW; drawH = containerW / imageRatio; }
      return { x: (containerW - drawW) / 2, y: (containerH - drawH) / 2, drawW, drawH };
    }
    case 'none':
      return { x: (containerW - naturalW) / 2, y: (containerH - naturalH) / 2, drawW: naturalW, drawH: naturalH };
    case 'scale-down': {
      if (naturalW <= containerW && naturalH <= containerH) {
        return { x: (containerW - naturalW) / 2, y: (containerH - naturalH) / 2, drawW: naturalW, drawH: naturalH };
      }
      return computeObjectFit('contain', containerW, containerH, naturalW, naturalH);
    }
    default: // 'fill'
      return { x: 0, y: 0, drawW: containerW, drawH: containerH };
  }
}

/**
 * Parse CSS outline properties and return SVG stroke attributes.
 * Returns null if no visible outline.
 */
function parseOutline(style) {
  const outlineStyle = style.outlineStyle;
  if (!outlineStyle || outlineStyle === 'none') return null;
  const outlineWidth = parseFloat(style.outlineWidth) || 0;
  if (outlineWidth === 0) return null;
  const outlineColor = style.outlineColor;
  if (!outlineColor || outlineColor === 'transparent' || outlineColor === 'rgba(0, 0, 0, 0)') return null;
  const outlineOffset = parseFloat(style.outlineOffset) || 0;
  return { outlineWidth, outlineColor, outlineStyle, outlineOffset };
}

/**
 * Build SVG stroke-dasharray for outline styles.
 */
function outlineDashAttr(outlineStyle, outlineWidth) {
  if (outlineStyle === 'dashed') return ` stroke-dasharray="${outlineWidth * 3} ${outlineWidth}"`;
  if (outlineStyle === 'dotted') return ` stroke-dasharray="${outlineWidth} ${outlineWidth}"`;
  return '';
}

/**
 * Build SVG markup string for a CSS outline on an element of given size.
 * Returns empty string if no visible outline.
 */
function buildOutlineMarkup(width, height, elementStyle, radii) {
  const outline = parseOutline(elementStyle);
  if (!outline) return '';

  const { outlineWidth, outlineColor, outlineStyle, outlineOffset } = outline;
  const totalOffset = outlineOffset + outlineWidth / 2;
  const ox = -totalOffset;
  const oy = -totalOffset;
  const ow = width + totalOffset * 2;
  const oh = height + totalOffset * 2;
  const dash = outlineDashAttr(outlineStyle, outlineWidth);

  if (radii) {
    const expandedRadii = {
      tl: Math.max(0, radii.tl + outlineOffset + outlineWidth / 2),
      tr: Math.max(0, radii.tr + outlineOffset + outlineWidth / 2),
      br: Math.max(0, radii.br + outlineOffset + outlineWidth / 2),
      bl: Math.max(0, radii.bl + outlineOffset + outlineWidth / 2),
    };
    const pathD = roundedRectPath(ow, oh, expandedRadii);
    return `<path d="${pathD}" transform="translate(${ox},${oy})" fill="none" stroke="${outlineColor}" stroke-width="${outlineWidth}"${dash}/>`;
  }
  return `<rect x="${ox}" y="${oy}" width="${ow}" height="${oh}" fill="none" stroke="${outlineColor}" stroke-width="${outlineWidth}"${dash}/>`;
}

/**
 * Single-pass collection of border-radii, outlines, and inline image jobs
 * from all elements in the subtree. Replaces the three separate DOM walks
 * (collectBorderRadiiMap + collectOutlines + preInlineImages) with one
 * querySelectorAll('*') pass and one getComputedStyle per element.
 *
 * Returns { radiiMap, outlines, restoreImages() }.
 */
async function collectElementMetadata(root, fetchFn) {
  const radiiMap = new Map();
  const outlines = [];
  const restorers = [];

  // Note: querySelectorAll does not pierce Shadow DOM boundaries.
  const els = [root, ...root.querySelectorAll('*')];

  const imgJobs = [];
  const bgJobs = [];

  for (const el of els) {
    const style = getComputedStyle(el);

    // --- border-radius + CSS outlines (share one getBoundingClientRect) ---
    const radii = parseBorderRadii(style);
    const outline = parseOutline(style);
    const needsRect = radii || outline;
    const elRect = needsRect ? el.getBoundingClientRect() : null;

    if (radii) {
      const key = `${elRect.x.toFixed(1)},${elRect.y.toFixed(1)},${elRect.width.toFixed(1)},${elRect.height.toFixed(1)}`;
      radiiMap.set(key, radii);
    }

    if (outline) {
      outlines.push({
        x: elRect.x, y: elRect.y, w: elRect.width, h: elRect.height,
        radii,
        outlineWidth: outline.outlineWidth,
        outlineColor: outline.outlineColor,
        outlineStyle: outline.outlineStyle,
        outlineOffset: outline.outlineOffset,
      });
    }

    // --- <img> inlining ---
    if (el.tagName === 'IMG') {
      const src = el.currentSrc || el.src;
      if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
        imgJobs.push((async () => {
          try {
            const dataUrl = await fetchFn(src);
            const origSrc = el.src;
            const origSrcset = el.srcset;
            el.src = dataUrl;
            el.srcset = '';
            restorers.push(() => { el.src = origSrc; el.srcset = origSrcset; });
          } catch (err) { console.debug('[Web to SVG] Image inline failed:', err.message); }
        })());
      }
    }

    // --- CSS background-image inlining ---
    const bg = style.backgroundImage;
    if (bg && bg !== 'none') {
      const urlMatch = bg.match(/url\(["']?([^"')]+)["']?\)/);
      if (urlMatch) {
        const rawUrl = urlMatch[1];
        if (!rawUrl.startsWith('data:') && !rawUrl.startsWith('blob:')) {
          const url = new URL(rawUrl, document.baseURI).href;
          bgJobs.push((async () => {
            try {
              const dataUrl = await fetchFn(url);
              const origBg = el.style.backgroundImage;
              el.style.backgroundImage = bg.replace(urlMatch[0], `url("${dataUrl}")`);
              restorers.push(() => { el.style.backgroundImage = origBg; });
            } catch (err) { console.debug('[Web to SVG] Background image inline failed:', err.message); }
          })());
        }
      }
    }
  }

  await Promise.allSettled([...imgJobs, ...bgJobs]);

  return {
    radiiMap,
    outlines,
    restoreImages: () => restorers.forEach((fn) => fn()),
  };
}

/**
 * Add CSS outline rendering to a parsed SVG document.
 * Outlines are drawn outside the element bounds, accounting for outline-offset.
 * Operates in-place on a parsed SVG document.
 */
function applyOutlinesToSVGDoc(svgDoc, outlines) {
  if (outlines.length === 0) return;

  const svg = svgDoc.documentElement;
  const NS = 'http://www.w3.org/2000/svg';

  const vb = svg.getAttribute('viewBox');
  let vbMinX = 0, vbMinY = 0, vbW = 0, vbH = 0;
  if (vb) {
    [vbMinX, vbMinY, vbW, vbH] = vb.split(/[\s,]+/).map(Number);
  }

  let expandLeft = 0, expandTop = 0, expandRight = 0, expandBottom = 0;

  for (const o of outlines) {
    const { x, y, w, h, radii, outlineWidth, outlineColor, outlineStyle, outlineOffset } = o;

    const outerExpand = outlineOffset + outlineWidth;
    const outerLeft = x - outerExpand;
    const outerTop = y - outerExpand;
    const outerRight = x + w + outerExpand;
    const outerBottom = y + h + outerExpand;

    if (vb) {
      expandLeft = Math.max(expandLeft, vbMinX - outerLeft);
      expandTop = Math.max(expandTop, vbMinY - outerTop);
      expandRight = Math.max(expandRight, outerRight - (vbMinX + vbW));
      expandBottom = Math.max(expandBottom, outerBottom - (vbMinY + vbH));
    }

    const strokeCenter = outlineOffset + outlineWidth / 2;
    const ox = x - strokeCenter;
    const oy = y - strokeCenter;
    const ow = w + strokeCenter * 2;
    const oh = h + strokeCenter * 2;

    let el;
    if (radii) {
      const expandedRadii = {
        tl: Math.max(0, radii.tl + strokeCenter),
        tr: Math.max(0, radii.tr + strokeCenter),
        br: Math.max(0, radii.br + strokeCenter),
        bl: Math.max(0, radii.bl + strokeCenter),
      };
      el = svgDoc.createElementNS(NS, 'path');
      el.setAttribute('d', roundedRectPath(ow, oh, expandedRadii));
      el.setAttribute('transform', `translate(${ox},${oy})`);
    } else {
      el = svgDoc.createElementNS(NS, 'rect');
      el.setAttribute('x', String(ox));
      el.setAttribute('y', String(oy));
      el.setAttribute('width', String(ow));
      el.setAttribute('height', String(oh));
    }
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', outlineColor);
    el.setAttribute('stroke-width', String(outlineWidth));
    if (outlineStyle === 'dashed') el.setAttribute('stroke-dasharray', `${outlineWidth * 3} ${outlineWidth}`);
    else if (outlineStyle === 'dotted') el.setAttribute('stroke-dasharray', `${outlineWidth} ${outlineWidth}`);
    svg.appendChild(el);
  }

  if (vb && (expandLeft > 0 || expandTop > 0 || expandRight > 0 || expandBottom > 0)) {
    svg.setAttribute('viewBox', `${vbMinX - expandLeft} ${vbMinY - expandTop} ${vbW + expandLeft + expandRight} ${vbH + expandTop + expandBottom}`);
    const origW = parseFloat(svg.getAttribute('width')) || vbW;
    const origH = parseFloat(svg.getAttribute('height')) || vbH;
    svg.setAttribute('width', String(origW + expandLeft + expandRight));
    svg.setAttribute('height', String(origH + expandTop + expandBottom));
  }
}

/**
 * Wrap a raster data URL in an SVG <image> element,
 * preserving border-radius, object-fit, border, and outline from the source element.
 */
function wrapInSvgImage(dataUrl, width, height, elementStyle, naturalW, naturalH) {
  const radii = elementStyle ? parseBorderRadii(elementStyle) : null;
  const fit = elementStyle ? elementStyle.objectFit : 'fill';
  const pos = computeObjectFit(fit, width, height, naturalW, naturalH);

  let defs = '';
  let clipAttr = '';
  let borderMarkup = '';
  let outlineMarkup = '';

  if (radii) {
    const clipPath = roundedRectPath(width, height, radii);
    defs = `<defs><clipPath id="ets-clip"><path d="${clipPath}"/></clipPath></defs>`;
    clipAttr = ' clip-path="url(#ets-clip)"';
  }

  // Border
  if (elementStyle) {
    const bw = parseFloat(elementStyle.borderTopWidth) || 0;
    if (bw > 0) {
      const bc = elementStyle.borderTopColor || '#000';
      if (radii) {
        const inset = bw / 2;
        const innerRadii = {
          tl: Math.max(0, radii.tl - inset), tr: Math.max(0, radii.tr - inset),
          br: Math.max(0, radii.br - inset), bl: Math.max(0, radii.bl - inset),
        };
        const borderPath = roundedRectPath(width - bw, height - bw, innerRadii);
        borderMarkup = `<path d="${borderPath}" transform="translate(${inset},${inset})" fill="none" stroke="${bc}" stroke-width="${bw}"/>`;
      } else {
        const inset = bw / 2;
        borderMarkup = `<rect x="${inset}" y="${inset}" width="${width - bw}" height="${height - bw}" fill="none" stroke="${bc}" stroke-width="${bw}"/>`;
      }
    }
  }

  // Outline (drawn outside the element bounds)
  let outlineExpand = 0;
  if (elementStyle) {
    const outline = parseOutline(elementStyle);
    if (outline) {
      outlineMarkup = buildOutlineMarkup(width, height, elementStyle, radii);
      // Expand viewBox to fit the outline (outer edge = offset + full stroke width)
      outlineExpand = outline.outlineOffset + outline.outlineWidth;
    }
  }

  // If there's an outline, shift the viewBox origin to include it and expand dimensions
  const vbX = -outlineExpand;
  const vbY = -outlineExpand;
  const vbW = width + outlineExpand * 2;
  const vbH = height + outlineExpand * 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${vbW}" height="${vbH}" viewBox="${vbX} ${vbY} ${vbW} ${vbH}">` +
    defs +
    `<g${clipAttr}>` +
    `<image x="${pos.x}" y="${pos.y}" width="${pos.drawW}" height="${pos.drawH}" href="${dataUrl}" preserveAspectRatio="none"/>` +
    `</g>` +
    borderMarkup +
    outlineMarkup +
    `</svg>`;
}

/**
 * Post-process dom-to-svg output: find <mask> elements whose <rect> children
 * match a DOM element with border-radius, and replace the plain <rect> with
 * a rounded-rect <path> so the overflow clip respects border-radius.
 * Operates in-place on a parsed SVG document.
 */
function applyBorderRadiusToMasksDoc(svgDoc, radiiMap) {
  if (radiiMap.size === 0) return;

  const svg = svgDoc.documentElement;
  const NS = 'http://www.w3.org/2000/svg';

  const masks = svg.querySelectorAll('mask');
  for (const mask of masks) {
    const rects = mask.querySelectorAll('rect');
    for (const rect of rects) {
      const x = parseFloat(rect.getAttribute('x')) || 0;
      const y = parseFloat(rect.getAttribute('y')) || 0;
      const w = parseFloat(rect.getAttribute('width')) || 0;
      const h = parseFloat(rect.getAttribute('height')) || 0;
      const key = `${x.toFixed(1)},${y.toFixed(1)},${w.toFixed(1)},${h.toFixed(1)}`;
      const radii = radiiMap.get(key);
      if (!radii) continue;

      const pathD = roundedRectPath(w, h, radii);
      const path = svgDoc.createElementNS(NS, 'path');
      path.setAttribute('d', pathD);
      path.setAttribute('transform', `translate(${x},${y})`);
      path.setAttribute('fill', rect.getAttribute('fill') || '#ffffff');
      rect.replaceWith(path);
    }
  }
}

/**
 * Get the resolved src for an <img> or <picture> element,
 * preferring the currently-displayed source.
 */
function resolveImageSrc(element) {
  // <picture> → find its inner <img>
  if (element.tagName === 'PICTURE') {
    const img = element.querySelector('img');
    if (img) return img.currentSrc || img.src;
    return null;
  }
  return element.currentSrc || element.src;
}

/**
 * Resolve CSS custom properties (var(--…)), currentColor, and inherit in SVG
 * presentation attributes so the exported SVG is fully self-contained.
 */
function resolveCSSVariablesInSVG(original, clone) {
  const ATTRS = ['fill', 'stroke', 'color', 'stop-color', 'flood-color', 'lighting-color'];
  const origEls = [original, ...original.querySelectorAll('*')];
  const cloneEls = [clone, ...clone.querySelectorAll('*')];

  for (let i = 0; i < origEls.length && i < cloneEls.length; i++) {
    const style = getComputedStyle(origEls[i]);
    const cloneEl = cloneEls[i];

    for (const attr of ATTRS) {
      const val = cloneEl.getAttribute(attr);
      if (!val) continue;

      let resolved = val;

      // Replace var(--name) by directly looking up the CSS custom property
      if (val.includes('var(')) {
        resolved = val.replace(
          /var\(\s*(--[^,)]+)(?:\s*,\s*([^)]+))?\s*\)/g,
          (match, propName, fallback) => {
            const propVal = style.getPropertyValue(propName.trim()).trim();
            return propVal || (fallback ? fallback.trim() : match);
          },
        );
      }

      // Resolve currentColor / inherit via the computed presentation attribute
      if (resolved === 'currentColor' || resolved === 'inherit') {
        const computed = style.getPropertyValue(attr).trim();
        if (computed && computed !== 'currentColor' && computed !== 'inherit') {
          resolved = computed;
        }
      }

      if (resolved !== val) cloneEl.setAttribute(attr, resolved);
    }
  }
}

export async function convertElementToSVG(targetElement, adapter) {
  // If the element is an SVG child (circle, rect, polygon, path, etc.),
  // promote to the closest <svg> ancestor.
  const element = (targetElement.namespaceURI === 'http://www.w3.org/2000/svg' && targetElement.tagName !== 'svg')
    ? (targetElement.closest('svg') || targetElement)
    : targetElement;

  let svgString;

  // Resolve background color before conversion (need live DOM access)
  const bgColor = resolveBackgroundColor(element);

  // Read settings early so conditional pipeline steps can check them
  let settings;
  try {
    settings = await adapter.getSettings({ outlineText: true, captureBackground: true, optimizeForFigma: false });
  } catch (err) {
    console.warn('[Web to SVG] Could not read settings, using defaults:', err);
    settings = { outlineText: true, captureBackground: true, optimizeForFigma: false };
  }

  const tag = element.tagName;

  // If the element is already an SVG, clone and serialize directly.
  if (element.namespaceURI === 'http://www.w3.org/2000/svg' && tag === 'svg') {
    const clone = element.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    // Resolve CSS custom properties (e.g. var(--color-primary)) so the SVG is self-contained
    resolveCSSVariablesInSVG(element, clone);

    // Resolve dimensions to px (em/rem/% won't work in standalone SVG)
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      clone.setAttribute('width', String(Math.round(rect.width)));
      clone.setAttribute('height', String(Math.round(rect.height)));
    }

    // Remove all inline styles — cloneNode captures stale animation state
    // (Framer Motion WAAPI sets initial values like opacity:0, scale:0 that
    // persist in the style attribute even after animation completes).
    clone.removeAttribute('style');

    svgString = new XMLSerializer().serializeToString(clone);

  // <img> or <picture> handling
  } else if (tag === 'IMG' || tag === 'PICTURE') {
    const imgEl = tag === 'PICTURE' ? element.querySelector('img') : element;
    const src = resolveImageSrc(element);
    if (!src) throw new Error('Image has no source');

    const rect = element.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    const elStyle = getComputedStyle(element);
    const naturalW = imgEl?.naturalWidth || 0;
    const naturalH = imgEl?.naturalHeight || 0;

    const isSvgDataUri = src.startsWith('data:image/svg+xml');
    const isSvgUrl = !isSvgDataUri && /\.svg(?:[?#]|$)/i.test(src);

    if (isSvgDataUri) {
      const comma = src.indexOf(',');
      const encoded = src.substring(comma + 1);
      svgString = src.includes('base64') ? atob(encoded) : decodeURIComponent(encoded);
    } else if (isSvgUrl) {
      try {
        const dataUrl = await adapter.fetchAsDataUrl(src);
        if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/svg')) {
          const comma = dataUrl.indexOf(',');
          const encoded = dataUrl.substring(comma + 1);
          svgString = dataUrl.includes('base64') ? atob(encoded) : decodeURIComponent(encoded);
        } else {
          throw new Error('Not SVG');
        }
      } catch {
        const dataUrl = await adapter.fetchAsDataUrl(src);
        svgString = wrapInSvgImage(dataUrl, w, h, elStyle, naturalW, naturalH);
      }
    } else {
      const dataUrl = src.startsWith('data:') ? src : await adapter.fetchAsDataUrl(src);
      svgString = wrapInSvgImage(dataUrl, w, h, elStyle, naturalW, naturalH);
    }

  // <canvas> handling
  } else if (tag === 'CANVAS') {
    const rect = element.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    let dataUrl;
    try {
      dataUrl = element.toDataURL('image/png');
    } catch {
      throw new Error('Canvas is cross-origin tainted and cannot be exported');
    }
    svgString = wrapInSvgImage(dataUrl, w, h, getComputedStyle(element), element.width, element.height);

  // <video> handling
  } else if (tag === 'VIDEO') {
    if (element.readyState < 2) {
      throw new Error('Video has no frame data yet');
    }
    const rect = element.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    const natW = element.videoWidth || w;
    const natH = element.videoHeight || h;
    const canvas = document.createElement('canvas');
    canvas.width = natW;
    canvas.height = natH;
    const ctx = get2dContext(canvas);
    ctx.drawImage(element, 0, 0, natW, natH);
    const dataUrl = canvas.toDataURL('image/png');
    svgString = wrapInSvgImage(dataUrl, w, h, getComputedStyle(element), natW, natH);

  } else {
    // Generic DOM element — single-pass metadata collection + dom-to-svg
    const { radiiMap, outlines, restoreImages } = await collectElementMetadata(element, adapter.fetchAsDataUrl);

    let svgDocument;
    try {
      svgDocument = elementToSVG(element);

      await Promise.race([
        inlineResources(svgDocument.documentElement),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Inlining resources timed out')), 10000)),
      ]);
    } finally {
      restoreImages();
    }

    // --- Unified pipeline: operate in-place on the parsed SVG DOM ---
    // 1. Border-radius masks
    applyBorderRadiusToMasksDoc(svgDocument, radiiMap);

    // 2. CSS outlines
    applyOutlinesToSVGDoc(svgDocument, outlines);

    // 3. Background rect
    if (settings.captureBackground && bgColor) {
      insertBackgroundRectDoc(svgDocument, bgColor);
    }

    // 4. Text outlining
    if (settings.outlineText) {
      try {
        await outlineTextInSVGDoc(svgDocument, adapter);
      } catch (err) {
        console.warn('[Web to SVG] Text outlining failed, returning un-outlined SVG:', err);
      }
    }

    // 5. Figma optimization
    if (settings.optimizeForFigma) {
      try {
        optimizeForFigmaDoc(svgDocument);
      } catch (err) {
        console.warn('[Web to SVG] Figma optimization failed, returning unoptimized SVG:', err);
      }
    }

    // 6. Serialize once
    return new XMLSerializer().serializeToString(svgDocument.documentElement);
  }

  // --- For non-generic branches (SVG, IMG, CANVAS, VIDEO): parse → pipeline → serialize ---
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');

  if (svgDoc.querySelector('parsererror')) {
    console.warn('[Web to SVG] SVG parse error, returning raw SVG');
    return svgString;
  }

  if (settings.captureBackground && bgColor) {
    insertBackgroundRectDoc(svgDoc, bgColor);
  }

  if (settings.outlineText) {
    try {
      await outlineTextInSVGDoc(svgDoc, adapter);
    } catch (err) {
      console.warn('[Web to SVG] Text outlining failed, returning un-outlined SVG:', err);
    }
  }

  if (settings.optimizeForFigma) {
    try {
      optimizeForFigmaDoc(svgDoc);
    } catch (err) {
      console.warn('[Web to SVG] Figma optimization failed, returning unoptimized SVG:', err);
    }
  }

  return new XMLSerializer().serializeToString(svgDoc.documentElement);
}

export async function svgToPNG(svgString, width, height, scale = 2) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(scale) ||
      width <= 0 || height <= 0 || scale <= 0) {
    throw new Error('Invalid canvas dimensions');
  }

  const MAX_CANVAS_DIM = 4096;
  let canvasW = Math.round(width * scale);
  let canvasH = Math.round(height * scale);

  // Clamp to safe browser limit, scaling down proportionally
  if (canvasW > MAX_CANVAS_DIM || canvasH > MAX_CANVAS_DIM) {
    const ratio = Math.min(MAX_CANVAS_DIM / canvasW, MAX_CANVAS_DIM / canvasH);
    canvasW = Math.round(canvasW * ratio);
    canvasH = Math.round(canvasH * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = get2dContext(canvas);

  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const img = new Image();
    img.width = canvas.width;
    img.height = canvas.height;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Failed to render SVG to image'));
      img.src = url;
    });
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(url);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/png');
  });
}
