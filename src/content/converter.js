import { elementToSVG, inlineResources } from 'dom-to-svg';
import { outlineTextInSVG } from './outliner.js';
import { optimizeForFigma } from './figma-optimizer.js';

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
 * Walk up the DOM from `el` collecting and compositing background colors
 * until we hit a fully opaque layer or the document root.
 * Returns a resolved color string or null.
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

  // Walk from outermost ancestor inward, compositing backgrounds
  let result = null;
  for (let i = chain.length - 1; i >= 0; i--) {
    const bg = parseColor(getComputedStyle(chain[i]).backgroundColor);
    if (!bg || bg.a === 0) continue;

    if (!result) {
      result = bg;
    } else {
      result = compositeOver(bg, result);
    }
    // If fully opaque, no point looking further up — this layer covers everything
    if (result.a >= 1) break;
  }

  if (!result || result.a === 0) return null;
  return colorToString(result);
}

/**
 * Insert a background <rect> as the first child of the SVG root element.
 */
function insertBackgroundRect(svgString, color) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.documentElement;

  const rect = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('width', '100%');
  rect.setAttribute('height', '100%');
  rect.setAttribute('fill', color);
  svg.insertBefore(rect, svg.firstChild);

  return new XMLSerializer().serializeToString(svg);
}

/**
 * Fetch a URL as a data URL string.
 * Routes through the service worker to bypass CORS restrictions
 * on cross-origin images (e.g. i.redd.it, cdn.example.com).
 * Falls back to direct fetch if the message fails.
 */
async function fetchAsDataUrl(url) {
  // Try fetching via the service worker (no CORS restrictions)
  try {
    const dataUrl = await chrome.runtime.sendMessage({ action: 'fetch-image', url });
    if (dataUrl && !dataUrl.error) return dataUrl;
  } catch {
    // Extension context may be invalidated, fall through
  }
  // Fallback: direct fetch (works for same-origin or CORS-enabled resources)
  const resp = await fetch(url);
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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
 * Collect CSS outline info from all elements in the subtree.
 * Called before dom-to-svg conversion while we still have live DOM access.
 * Returns a list of outline descriptors with absolute positions.
 */
function collectOutlines(root) {
  const outlines = [];
  const els = [root, ...root.querySelectorAll('*')];
  for (const el of els) {
    const style = getComputedStyle(el);
    const outline = parseOutline(style);
    if (!outline) continue;
    const rect = el.getBoundingClientRect();
    const radii = parseBorderRadii(style);
    outlines.push({
      x: rect.x, y: rect.y, w: rect.width, h: rect.height,
      radii,
      outlineWidth: outline.outlineWidth,
      outlineColor: outline.outlineColor,
      outlineStyle: outline.outlineStyle,
      outlineOffset: outline.outlineOffset,
    });
  }
  return outlines;
}

/**
 * Add CSS outline rendering to a serialized SVG string.
 * Outlines are drawn outside the element bounds, accounting for outline-offset.
 */
function applyOutlinesToSVG(svgString, outlines) {
  if (outlines.length === 0) return svgString;

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.documentElement;
  const NS = 'http://www.w3.org/2000/svg';

  // Parse current viewBox to expand it for outlines
  const vb = svg.getAttribute('viewBox');
  let vbMinX = 0, vbMinY = 0, vbW = 0, vbH = 0;
  if (vb) {
    [vbMinX, vbMinY, vbW, vbH] = vb.split(/[\s,]+/).map(Number);
  }

  // Track how much extra space outlines need beyond the current viewBox
  let expandLeft = 0, expandTop = 0, expandRight = 0, expandBottom = 0;

  for (const o of outlines) {
    const { x, y, w, h, radii, outlineWidth, outlineColor, outlineStyle, outlineOffset } = o;

    // Outer edge of the outline stroke (for viewBox expansion)
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

    // Stroke center position (offset from element edge + half stroke width)
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
      el = doc.createElementNS(NS, 'path');
      el.setAttribute('d', roundedRectPath(ow, oh, expandedRadii));
      el.setAttribute('transform', `translate(${ox},${oy})`);
    } else {
      el = doc.createElementNS(NS, 'rect');
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

  // Expand viewBox and dimensions to fit outlines
  if (vb && (expandLeft > 0 || expandTop > 0 || expandRight > 0 || expandBottom > 0)) {
    svg.setAttribute('viewBox', `${vbMinX - expandLeft} ${vbMinY - expandTop} ${vbW + expandLeft + expandRight} ${vbH + expandTop + expandBottom}`);
    const origW = parseFloat(svg.getAttribute('width')) || vbW;
    const origH = parseFloat(svg.getAttribute('height')) || vbH;
    svg.setAttribute('width', String(origW + expandLeft + expandRight));
    svg.setAttribute('height', String(origH + expandTop + expandBottom));
  }

  return new XMLSerializer().serializeToString(svg);
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
 * Collect a map of bounding-rect keys → border radii for every element
 * in the subtree that has border-radius (regardless of overflow).
 * dom-to-svg uses getBoundingClientRect() for mask <rect> positions,
 * so we match by the same coordinates.
 */
function collectBorderRadiiMap(root) {
  const map = new Map();
  const els = [root, ...root.querySelectorAll('*')];
  for (const el of els) {
    const style = getComputedStyle(el);
    const radii = parseBorderRadii(style);
    if (!radii) continue;
    const rect = el.getBoundingClientRect();
    // Key by x,y,w,h with 1-decimal precision to match dom-to-svg output
    const key = `${rect.x.toFixed(1)},${rect.y.toFixed(1)},${rect.width.toFixed(1)},${rect.height.toFixed(1)}`;
    map.set(key, radii);
  }
  return map;
}

/**
 * Post-process dom-to-svg output: find <mask> elements whose <rect> children
 * match a DOM element with border-radius, and replace the plain <rect> with
 * a rounded-rect <path> so the overflow clip respects border-radius.
 *
 * dom-to-svg creates masks like:
 *   <mask id="mask-for-...">
 *     <rect fill="#ffffff" x="..." y="..." width="..." height="..."/>
 *   </mask>
 * We replace the <rect> with a rounded <path> when border-radius applies.
 */
function applyBorderRadiusToMasks(svgString, radiiMap) {
  if (radiiMap.size === 0) return svgString;

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.documentElement;
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

      // Replace <rect> with a rounded-rect <path>
      const pathD = roundedRectPath(w, h, radii);
      const path = doc.createElementNS(NS, 'path');
      path.setAttribute('d', pathD);
      path.setAttribute('transform', `translate(${x},${y})`);
      path.setAttribute('fill', rect.getAttribute('fill') || '#ffffff');
      rect.replaceWith(path);
    }
  }

  return new XMLSerializer().serializeToString(svg);
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
 * Pre-inline all cross-origin images and CSS background images within an
 * element tree by replacing their URLs with data URLs fetched through the
 * service worker. Returns a restore function that reverts all changes.
 */
async function preInlineImages(root) {
  const restorers = [];

  // --- <img> elements ---
  const imgs = root.tagName === 'IMG' ? [root] : [...root.querySelectorAll('img')];
  const imgJobs = imgs.map(async (img) => {
    const src = img.currentSrc || img.src;
    if (!src || src.startsWith('data:') || src.startsWith('blob:')) return;
    try {
      const dataUrl = await fetchAsDataUrl(src);
      const origSrc = img.src;
      const origSrcset = img.srcset;
      img.src = dataUrl;
      img.srcset = '';
      restorers.push(() => { img.src = origSrc; img.srcset = origSrcset; });
    } catch {
      // leave original src in place
    }
  });

  // --- CSS background-image on all elements ---
  const allEls = [root, ...root.querySelectorAll('*')];
  const bgJobs = allEls.map(async (el) => {
    const style = getComputedStyle(el);
    const bg = style.backgroundImage;
    if (!bg || bg === 'none') return;
    // Extract url(...) values
    const urlMatch = bg.match(/url\(["']?(https?:\/\/[^"')]+)["']?\)/);
    if (!urlMatch) return;
    const url = urlMatch[1];
    try {
      const dataUrl = await fetchAsDataUrl(url);
      const origBg = el.style.backgroundImage;
      el.style.backgroundImage = bg.replace(urlMatch[0], `url("${dataUrl}")`);
      restorers.push(() => { el.style.backgroundImage = origBg; });
    } catch {
      // leave original background in place
    }
  });

  await Promise.allSettled([...imgJobs, ...bgJobs]);

  return () => restorers.forEach((fn) => fn());
}

export async function convertElementToSVG(element) {
  let svgString;

  // Resolve background color before conversion (need live DOM access)
  const bgColor = resolveBackgroundColor(element);

  const tag = element.tagName;

  // If the element is already an SVG, clone and serialize directly
  if (element instanceof SVGSVGElement) {
    const clone = element.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
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

    // Detect SVG source: data URI, .svg extension (ignoring query/hash), or svg+xml content type
    const isSvgDataUri = src.startsWith('data:image/svg');
    const isSvgUrl = !isSvgDataUri && /\.svg(?:[?#]|$)/i.test(src);

    if (isSvgDataUri) {
      const comma = src.indexOf(',');
      const encoded = src.substring(comma + 1);
      svgString = src.includes('base64') ? atob(encoded) : decodeURIComponent(encoded);
    } else if (isSvgUrl) {
      // Fetch raw SVG via service worker to bypass CORS
      try {
        const resp = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ action: 'fetch-image', url: src }, (r) => {
            if (r && !r.error && typeof r === 'string' && r.startsWith('data:image/svg')) resolve(r);
            else reject(new Error('Not SVG'));
          });
        });
        const comma = resp.indexOf(',');
        const encoded = resp.substring(comma + 1);
        svgString = resp.includes('base64') ? atob(encoded) : decodeURIComponent(encoded);
      } catch {
        // Wasn't actually SVG, treat as raster
        const dataUrl = await fetchAsDataUrl(src);
        svgString = wrapInSvgImage(dataUrl, w, h, elStyle, naturalW, naturalH);
      }
    } else {
      // Raster image — embed as data URL inside an SVG wrapper
      const dataUrl = src.startsWith('data:') ? src : await fetchAsDataUrl(src);
      svgString = wrapInSvgImage(dataUrl, w, h, elStyle, naturalW, naturalH);
    }

  // <canvas> handling — grab pixel data from the canvas
  } else if (tag === 'CANVAS') {
    const rect = element.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    const dataUrl = element.toDataURL('image/png');
    svgString = wrapInSvgImage(dataUrl, w, h, getComputedStyle(element), element.width, element.height);

  // <video> handling — capture current frame
  } else if (tag === 'VIDEO') {
    const rect = element.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    const natW = element.videoWidth || w;
    const natH = element.videoHeight || h;
    const canvas = document.createElement('canvas');
    canvas.width = natW;
    canvas.height = natH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(element, 0, 0, natW, natH);
    const dataUrl = canvas.toDataURL('image/png');
    svgString = wrapInSvgImage(dataUrl, w, h, getComputedStyle(element), natW, natH);

  } else {
    // Collect border-radius info and CSS outlines from all elements BEFORE dom-to-svg
    // (need live DOM access for getComputedStyle + getBoundingClientRect)
    const radiiMap = collectBorderRadiiMap(element);
    const outlines = collectOutlines(element);

    // Pre-inline cross-origin images so dom-to-svg sees data URLs instead
    const restore = await preInlineImages(element);
    try {
      const svgDocument = elementToSVG(element);

      // Inline remaining resources with a timeout
      await Promise.race([
        inlineResources(svgDocument.documentElement),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Inlining resources timed out')), 10000)),
      ]);

      svgString = new XMLSerializer().serializeToString(svgDocument);
    } finally {
      restore();
    }

    // Post-process: add border-radius to dom-to-svg's overflow masks
    svgString = applyBorderRadiusToMasks(svgString, radiiMap);

    // Post-process: add CSS outlines (not supported by dom-to-svg)
    svgString = applyOutlinesToSVG(svgString, outlines);
  }

  // Read settings (with fallback if storage access fails in content script)
  let settings;
  try {
    settings = await new Promise((resolve, reject) => {
      chrome.storage.sync.get({ outlineText: true, captureBackground: true, optimizeForFigma: false }, (result) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(result);
      });
    });
  } catch (err) {
    console.warn('[Element to SVG] Could not read settings, using defaults:', err);
    settings = { outlineText: true, captureBackground: true, optimizeForFigma: false };
  }

  // Insert background rect if enabled and a color was found
  if (settings.captureBackground && bgColor) {
    svgString = insertBackgroundRect(svgString, bgColor);
  }

  if (settings.outlineText) {
    try {
      svgString = await outlineTextInSVG(svgString);
    } catch (err) {
      console.warn('[Element to SVG] Text outlining failed, returning un-outlined SVG:', err);
    }
  }

  if (settings.optimizeForFigma) {
    try {
      svgString = optimizeForFigma(svgString);
    } catch (err) {
      console.warn('[Element to SVG] Figma optimization failed, returning unoptimized SVG:', err);
    }
  }

  return svgString;
}

export async function svgToPNG(svgString, width, height, scale = 2) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');

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
