/**
 * Post-process SVG output to produce cleaner layers when pasted into Figma.
 * Collapses empty/single-child <g> wrappers, strips debug attributes,
 * normalises coordinates to 0,0, and converts uniform-radius mask paths
 * to <rect rx ry> so Figma treats them as native rounded rectangles.
 */

const DATA_ATTRS = [
  'data-tag',
  'data-stacking-layer',
  'data-z-index',
  'data-stacking-context',
];

/**
 * Merge attributes from `source` onto `target`, skipping conflicts.
 */
function mergeAttributes(target, source) {
  for (const attr of Array.from(source.attributes)) {
    if (attr.name === 'xmlns' || attr.name.startsWith('xmlns:')) continue;
    if (!target.hasAttribute(attr.name)) {
      target.setAttribute(attr.name, attr.value);
    }
  }
}

/**
 * Strip data-* debug attributes from every element in the tree.
 */
function stripDataAttributes(root) {
  const all = root.querySelectorAll('*');
  for (const el of all) {
    for (const name of DATA_ATTRS) {
      el.removeAttribute(name);
    }
  }
  for (const name of DATA_ATTRS) {
    root.removeAttribute(name);
  }
}

/**
 * Remove textLength and lengthAdjust from <text> and <tspan> elements.
 */
function stripTextLengthAttrs(root) {
  const texts = root.querySelectorAll('text, tspan');
  for (const el of texts) {
    el.removeAttribute('textLength');
    el.removeAttribute('lengthAdjust');
  }
}

/**
 * Detect stacking-layer noise IDs (e.g. "stacking-layer-..." or hex-like uuids)
 * and remove them, keeping meaningful IDs derived from CSS classes or tag names.
 */
function cleanLayerIds(root) {
  const all = root.querySelectorAll('[id]');
  const noisePattern = /^(stacking-layer|stacking-context|mask-for-|mask-clip-|clip-)/i;
  for (const el of all) {
    const id = el.getAttribute('id');
    if (noisePattern.test(id)) {
      // Only remove if nothing in the document references this id
      if (!root.querySelector(`[href="#${CSS.escape(id)}"], [xlink\\:href="#${CSS.escape(id)}"], [clip-path="url(#${CSS.escape(id)})"], [mask="url(#${CSS.escape(id)})"]`)) {
        el.removeAttribute('id');
      }
    }
  }
}

/**
 * Collapse <g> elements that have no children (empty) or exactly one child
 * (single-child wrapper). For single-child groups with no meaningful attributes,
 * the child is promoted up and the wrapper removed.
 */
function collapseGroups(root) {
  // Multiple passes — collapsing may expose new collapsible groups
  let changed = true;
  while (changed) {
    changed = false;
    const groups = Array.from(root.querySelectorAll('g'));
    for (const g of groups) {
      // Skip <g> inside <defs> (masks, clipPaths, etc.)
      if (g.closest('defs')) continue;

      const children = Array.from(g.children);

      // Remove empty <g> (no element children, no text content)
      if (children.length === 0 && !g.textContent.trim()) {
        g.remove();
        changed = true;
        continue;
      }

      // Flatten single-child <g> wrappers
      if (children.length === 1) {
        const child = children[0];
        // Only flatten if the <g> has no critical presentation attributes
        const hasMask = g.hasAttribute('mask');
        const hasClipPath = g.hasAttribute('clip-path');
        const hasFilter = g.hasAttribute('filter');
        const hasOpacity = g.hasAttribute('opacity') && g.getAttribute('opacity') !== '1';
        const hasTransform = g.hasAttribute('transform');

        // If the group has structural attributes, keep it
        if (hasMask || hasClipPath || hasFilter || hasOpacity) continue;

        // Merge transform if both have one
        if (hasTransform) {
          const parentT = g.getAttribute('transform');
          const childT = child.getAttribute('transform');
          if (childT) {
            child.setAttribute('transform', `${parentT} ${childT}`);
          } else {
            child.setAttribute('transform', parentT);
          }
        }

        // Merge other non-conflicting attributes down
        mergeAttributes(child, g);

        g.replaceWith(child);
        changed = true;
      }
    }
  }
}

/**
 * Try to parse a <path> d attribute as a uniform rounded rectangle and
 * return { x, y, width, height, rx } if it matches, else null.
 *
 * Matches paths like: M rx,0 H w-rx A rx,rx 0 0 1 w,rx V h-rx A ... Z
 * produced by roundedRectPath() with all 4 radii equal and translated.
 */
function parseUniformRoundedRect(pathD) {
  // Normalize: remove extra spaces, newlines
  const d = pathD.replace(/\s+/g, ' ').trim();

  // Pattern for: M rx,0 H w-rx A rx,rx 0 0 1 w,rx V h-rx A rx,rx 0 0 1 w-rx,h H rx A rx,rx 0 0 1 0,h-rx V rx A rx,rx 0 0 1 rx,0 Z
  const num = '([\\d.]+)';
  const re = new RegExp(
    `^M${num},0\\s*H${num}\\s*A${num},${num}\\s+0\\s+0\\s+1\\s+${num},${num}\\s*V${num}\\s*A${num},${num}\\s+0\\s+0\\s+1\\s+${num},${num}\\s*H${num}\\s*A${num},${num}\\s+0\\s+0\\s+1\\s+0,${num}\\s*V${num}\\s*A${num},${num}\\s+0\\s+0\\s+1\\s+${num},0\\s*Z$`
  );
  const m = d.match(re);
  if (!m) return null;

  const vals = m.slice(1).map(Number);
  // vals: [tl, w-tr, tr_rx, tr_ry, w, tr, h-br, br_rx, br_ry, w-br, h, bl, bl_rx, bl_ry, h-bl, tl2, tl_rx, tl_ry, tl3]
  const tl = vals[0];
  const tr = vals[2];
  const br = vals[7];
  const bl = vals[12];

  // Check all radii are equal
  if (tl !== tr || tr !== br || br !== bl) return null;

  const rx = tl;
  const width = vals[4];  // w
  const height = vals[10]; // h

  return { width, height, rx };
}

/**
 * In <mask> elements, replace <path> arcs with <rect rx ry> when
 * all four corner radii are equal. Figma treats these as native
 * rounded rectangles with editable corner radius.
 */
function convertUniformRadiusMasks(root, doc) {
  const NS = 'http://www.w3.org/2000/svg';
  const paths = root.querySelectorAll('mask path, clipPath path');
  for (const path of paths) {
    const d = path.getAttribute('d');
    if (!d) continue;
    const parsed = parseUniformRoundedRect(d);
    if (!parsed) continue;

    const rect = doc.createElementNS(NS, 'rect');
    // Carry over transform (used for positioning)
    const transform = path.getAttribute('transform');
    if (transform) rect.setAttribute('transform', transform);

    rect.setAttribute('width', String(parsed.width));
    rect.setAttribute('height', String(parsed.height));
    rect.setAttribute('rx', String(parsed.rx));
    rect.setAttribute('ry', String(parsed.rx));
    rect.setAttribute('fill', path.getAttribute('fill') || '#ffffff');

    path.replaceWith(rect);
  }
}

/**
 * Shift all absolute coordinates so the SVG content starts at 0,0.
 * Updates the viewBox and translates the root content group.
 */
function normalizeToOrigin(svg) {
  const vb = svg.getAttribute('viewBox');
  if (!vb) return;

  const parts = vb.split(/[\s,]+/).map(Number);
  if (parts.length !== 4) return;
  const [minX, minY, w, h] = parts;

  // Already at origin
  if (minX === 0 && minY === 0) return;

  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

  // Wrap all children in a translating group, or adjust existing transforms
  const children = Array.from(svg.children);
  for (const child of children) {
    const existing = child.getAttribute('transform') || '';
    const shift = `translate(${-minX},${-minY})`;
    child.setAttribute('transform', existing ? `${shift} ${existing}` : shift);
  }
}

/**
 * Optimize a parsed SVG document in-place for Figma.
 * Operates directly on the DOM — no parse/serialize overhead.
 */
export function optimizeForFigmaDoc(svgDoc) {
  const svg = svgDoc.documentElement;

  if (svg.querySelector('parsererror')) {
    console.warn('[Element to SVG] Figma optimizer: SVG parse error, skipping optimization');
    return;
  }

  stripDataAttributes(svg);
  stripTextLengthAttrs(svg);
  cleanLayerIds(svg);
  collapseGroups(svg);
  convertUniformRadiusMasks(svg, svgDoc);
  normalizeToOrigin(svg);
}

/**
 * Legacy string-based entry point — delegates to optimizeForFigmaDoc.
 */
export function optimizeForFigma(svgString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.documentElement;

  if (svg.querySelector('parsererror')) {
    console.warn('[Element to SVG] Figma optimizer: SVG parse error, skipping optimization');
    return svgString;
  }

  optimizeForFigmaDoc(doc);
  return new XMLSerializer().serializeToString(svg);
}
