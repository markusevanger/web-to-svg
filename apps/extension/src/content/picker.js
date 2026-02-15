import { convertElementToSVG, svgToPNG } from './converter.js';
import contentCSS from './content.css';

(function () {
  // Toggle guard — if already active, deactivate
  if (window.__elementToSvgActive) {
    window.__elementToSvgCleanup?.();
    return;
  }
  window.__elementToSvgActive = true;

  // Inject styles
  const styleEl = document.createElement('style');
  styleEl.textContent = contentCSS;
  document.head.appendChild(styleEl);

  // Full-viewport shield — sits on top of all page content so CSS :hover
  // states don't fire on page elements while the picker is active.
  // elementsFromPoint still returns elements underneath; isOwnElement filters it out.
  const shield = document.createElement('div');
  shield.className = 'ets-shield';
  document.body.appendChild(shield);

  // Create highlight overlay
  const highlight = document.createElement('div');
  highlight.className = 'ets-highlight';
  highlight.style.display = 'none';
  document.body.appendChild(highlight);

  // Create tooltip
  const tooltip = document.createElement('div');
  tooltip.className = 'ets-tooltip';
  tooltip.style.display = 'none';
  document.body.appendChild(tooltip);

  // Preview thumbnail
  const preview = document.createElement('div');
  preview.className = 'ets-preview';
  preview.style.display = 'none';
  document.body.appendChild(preview);

  const HOVER_PREVIEW_MAX_DESCENDANTS = 500;

  let currentTarget = null;
  let hoverTimer = null;
  let previewAbort = null;
  let cachedSvgString = null;
  let pinned = false;
  let depthOffset = 0;       // scroll-wheel: 0 = topmost element, +N = N parents up
  let baseTarget = null;     // the raw topmost element under cursor (before depth walk)
  let depthNavTimer = null;  // auto-hide depth nav after scrolling stops
  let depthNavReady = false; // true once a preview has loaded for current baseTarget
  let pinnedCopySvg = null;  // set by pinPreview so keydown can trigger copy

  // Loading indicator (lives inside preview container)
  const loader = document.createElement('div');
  loader.className = 'ets-loader';
  loader.style.display = 'none';
  const loaderLabel = document.createElement('div');
  loaderLabel.className = 'ets-loader-label';
  loaderLabel.textContent = 'Processing\u2026';
  const loaderTrack = document.createElement('div');
  loaderTrack.className = 'ets-loader-track';
  const loaderBar = document.createElement('div');
  loaderBar.className = 'ets-loader-bar';
  loaderTrack.appendChild(loaderBar);
  loader.appendChild(loaderLabel);
  loader.appendChild(loaderTrack);
  preview.appendChild(loader);

  // Depth navigator — shows DOM ancestor chain as nested boxes
  const depthNav = document.createElement('div');
  depthNav.className = 'ets-depth-nav';
  depthNav.style.display = 'none';
  preview.appendChild(depthNav);

  // Custom scroll-hint cursor (dot + animated chevrons)
  const scrollCursor = document.createElement('div');
  scrollCursor.className = 'ets-scroll-cursor';
  scrollCursor.innerHTML =
    '<span class="ets-sc-chevron ets-sc-up"></span>' +
    '<span class="ets-sc-dot"></span>' +
    '<span class="ets-sc-chevron ets-sc-down"></span>';
  scrollCursor.style.display = 'none';
  document.body.appendChild(scrollCursor);

  function showScrollCursor() {
    scrollCursor.style.display = 'flex';
    document.documentElement.classList.add('ets-cursor-hidden');
  }

  function hideScrollCursor() {
    scrollCursor.style.display = 'none';
    document.documentElement.classList.remove('ets-cursor-hidden');
  }

  function positionScrollCursor(cx, cy) {
    scrollCursor.style.left = cx + 'px';
    scrollCursor.style.top = cy + 'px';
  }

  function showToast(message) {
    const el = document.createElement('div');
    el.textContent = message;
    Object.assign(el.style, {
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#1e293b',
      color: 'white',
      padding: '8px 16px',
      borderRadius: '6px',
      fontSize: '13px',
      fontFamily: 'sans-serif',
      zIndex: '2147483647',
      pointerEvents: 'none',
      transition: 'opacity 0.3s',
    });
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 2000);
  }

  function buildFilename(pattern, tagName, width, height) {
    return pattern
      .replace('{tagName}', tagName.toLowerCase())
      .replace('{width}', String(Math.round(width)))
      .replace('{height}', String(Math.round(height)));
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  function hidePreview() {
    clearTimeout(hoverTimer);
    hoverTimer = null;
    clearTimeout(depthNavTimer);
    depthNavTimer = null;
    previewAbort?.abort();
    previewAbort = null;
    cachedSvgString = null;
    hideScrollCursor();
    stopPreviewResizeObserver();
    loader.style.display = 'none';
    loaderLabel.textContent = 'Processing\u2026';
    loaderBar.style.display = '';
    loaderBar.style.animation = 'none';
    depthNav.style.display = 'none';
    depthNav.innerHTML = '';
    preview.style.display = 'none';
    preview.style.maxHeight = '';
    preview.classList.remove('ets-preview-pinned');
    // Remove everything except the loader and depth nav
    for (const child of [...preview.children]) {
      if (child !== loader && child !== depthNav) child.remove();
    }
  }

  function cleanup() {
    pinned = false;
    pinnedCopySvg = null;
    if (preview._docClickHandler) {
      document.removeEventListener('click', preview._docClickHandler, true);
      preview._docClickHandler = null;
    }
    window.__elementToSvgActive = false;
    window.__elementToSvgCleanup = undefined;
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('wheel', onWheel, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    hidePreview();
    shield.remove();
    highlight.remove();
    tooltip.remove();
    preview.remove();
    scrollCursor.remove();
    styleEl.remove();
  }

  window.__elementToSvgCleanup = cleanup;

  function isOwnElement(el) {
    return el === shield || el === highlight || el === tooltip || el === preview ||
      el === loader || preview.contains(el);
  }

  function positionPreview(cx, cy) {
    const previewW = 200;
    const previewH = 160;
    const gap = 16;
    let left = cx + gap;
    let top = cy + gap;
    if (left + previewW > window.innerWidth) left = cx - previewW - gap;
    if (top + previewH > window.innerHeight) top = cy - previewH - gap;
    if (left < 4) left = 4;
    if (top < 4) top = 4;
    preview.style.left = left + 'px';
    preview.style.top = top + 'px';
  }

  let previewResizeObserver = null;
  let clamping = false;

  function clampPreviewToViewport() {
    if (clamping) return;
    clamping = true;

    const margin = 20;

    // Temporarily remove max-height so we can measure natural height
    const prevMaxH = preview.style.maxHeight;
    preview.style.maxHeight = 'none';
    const rect = preview.getBoundingClientRect();

    let left = rect.left;
    let top = rect.top;
    const cardW = rect.width;
    const cardH = rect.height;

    // Clamp horizontally
    if (left + cardW > window.innerWidth - margin) {
      left = window.innerWidth - margin - cardW;
    }
    if (left < margin) left = margin;

    // Clamp vertically — try to move up first, then cap height for whatever remains
    if (top + cardH > window.innerHeight - margin) {
      top = window.innerHeight - margin - cardH;
    }
    if (top < margin) top = margin;

    const availableH = window.innerHeight - top - margin;

    preview.style.left = left + 'px';
    preview.style.top = top + 'px';
    preview.style.maxHeight = availableH + 'px';

    clamping = false;
  }

  function startPreviewResizeObserver() {
    if (previewResizeObserver) return;
    previewResizeObserver = new ResizeObserver(() => {
      if (pinned) clampPreviewToViewport();
    });
    previewResizeObserver.observe(preview);
  }

  function stopPreviewResizeObserver() {
    if (previewResizeObserver) {
      previewResizeObserver.disconnect();
      previewResizeObserver = null;
    }
  }

  function makeSplitBtn(label, primaryClass, primaryHandler, items, shortcutHint) {
    const wrap = document.createElement('div');
    wrap.className = 'ets-split-btn';

    const main = document.createElement('button');
    main.className = 'ets-btn ' + primaryClass + ' ets-split-main';
    if (shortcutHint) {
      const labelSpan = document.createElement('span');
      labelSpan.textContent = label;
      const kbd = document.createElement('kbd');
      kbd.className = 'ets-kbd';
      kbd.textContent = shortcutHint;
      main.appendChild(labelSpan);
      main.appendChild(kbd);
    } else {
      main.textContent = label;
    }
    main.addEventListener('click', primaryHandler);

    const toggle = document.createElement('button');
    toggle.className = 'ets-btn ' + primaryClass + ' ets-split-toggle';
    toggle.innerHTML = '&#9662;';

    const dropdown = document.createElement('div');
    dropdown.className = 'ets-dropdown';

    for (const [text, handler] of items) {
      const item = document.createElement('button');
      item.className = 'ets-dropdown-item';
      item.textContent = text;
      item.addEventListener('click', async () => {
        dropdown.classList.remove('ets-dropdown-open');
        await handler();
      });
      dropdown.appendChild(item);
    }

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close other open dropdowns
      preview.querySelectorAll('.ets-dropdown-open').forEach((d) => {
        if (d !== dropdown) d.classList.remove('ets-dropdown-open');
      });
      dropdown.classList.toggle('ets-dropdown-open');
    });

    wrap.appendChild(main);
    wrap.appendChild(toggle);
    wrap.appendChild(dropdown);
    return wrap;
  }

  function buildOptionsPanel(settings, onReconvert) {
    const panel = document.createElement('div');
    panel.className = 'ets-options';

    const toggle = document.createElement('button');
    toggle.className = 'ets-options-toggle';
    toggle.innerHTML = '<span class="ets-options-cog">&#9881;</span><span>Options</span><span class="ets-options-chevron">&#9662;</span>';
    panel.appendChild(toggle);

    const body = document.createElement('div');
    body.className = 'ets-options-body';
    panel.appendChild(body);

    toggle.addEventListener('click', () => {
      panel.classList.toggle('ets-options-open');
    });

    function makeCheckbox(id, label, description, checked, storageKey) {
      const wrap = document.createElement('div');
      wrap.className = 'ets-option-item';
      const lbl = document.createElement('label');
      lbl.className = 'ets-option-label';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = checked;
      input.addEventListener('change', () => {
        chrome.storage.sync.set({ [storageKey]: input.checked });
        onReconvert();
      });
      lbl.appendChild(input);
      lbl.appendChild(document.createTextNode(' ' + label));
      wrap.appendChild(lbl);
      if (description) {
        const desc = document.createElement('div');
        desc.className = 'ets-option-desc';
        desc.textContent = description;
        wrap.appendChild(desc);
      }
      body.appendChild(wrap);
    }

    function makeRadioGroup(legend, name, options, current, onChange, description) {
      const wrap = document.createElement('div');
      wrap.className = 'ets-option-item';
      const fs = document.createElement('fieldset');
      fs.className = 'ets-option-fieldset';
      const leg = document.createElement('legend');
      leg.textContent = legend;
      fs.appendChild(leg);
      for (const val of options) {
        const lbl = document.createElement('label');
        lbl.className = 'ets-option-radio';
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = name;
        input.value = val;
        input.checked = Number(val) === current;
        input.addEventListener('change', () => onChange(Number(input.value)));
        lbl.appendChild(input);
        lbl.appendChild(document.createTextNode(' ' + val + 'x'));
        fs.appendChild(lbl);
      }
      wrap.appendChild(fs);
      if (description) {
        const desc = document.createElement('div');
        desc.className = 'ets-option-desc';
        desc.textContent = description;
        wrap.appendChild(desc);
      }
      body.appendChild(wrap);
    }

    makeCheckbox('outline-text', 'Outline text', 'Convert text to vector paths so fonts render everywhere', settings.outlineText, 'outlineText');
    makeCheckbox('capture-bg', 'Capture background', 'Include the element\u2019s background color in the export', settings.captureBackground, 'captureBackground');
    makeCheckbox('optimize-figma', 'Optimize for Figma', 'Simplify groups and paths for cleaner Figma imports', settings.optimizeForFigma, 'optimizeForFigma');
    makeRadioGroup('PNG scale', 'ets-png-scale', ['1', '2', '3'], settings.pngScale, (v) => {
      chrome.storage.sync.set({ pngScale: v });
    }, 'Multiplier for PNG export resolution');

    return panel;
  }

  function pinPreview(element, svgString) {
    pinned = true;
    hideScrollCursor();

    // Mutable state — reconvert updates these
    const state = { svg: svgString };

    async function copySvg() {
      try {
        await navigator.clipboard.writeText(state.svg);
        showToast('SVG copied to clipboard');
      } catch {
        showToast('Copy failed \u2014 check permissions');
      }
    }
    pinnedCopySvg = copySvg;

    async function reconvert() {
      const thumb = preview.querySelector('.ets-thumb');
      if (thumb) thumb.classList.add('ets-thumb-loading');
      try {
        state.svg = await convertElementToSVG(element);
        // Update preview image
        const img = preview.querySelector('.ets-thumb img');
        if (img) {
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(state.svg);
        }
      } catch (err) {
        showToast('Re-conversion failed: ' + err.message);
      } finally {
        if (thumb) thumb.classList.remove('ets-thumb-loading');
      }
    }

    // Stop picker listeners
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('wheel', onWheel, true);
    document.removeEventListener('click', onClick, true);
    highlight.style.display = 'none';
    tooltip.style.display = 'none';

    // Pin the preview — wrap existing img in a checkered thumb container
    preview.classList.add('ets-preview-pinned');

    // Close button — top-right corner of the card
    const closeBtn = document.createElement('button');
    closeBtn.className = 'ets-btn-card-close';
    closeBtn.textContent = '\u2715';
    closeBtn.addEventListener('click', cleanup);
    preview.appendChild(closeBtn);

    const header = document.createElement('div');
    header.className = 'ets-header';
    const headerLink = document.createElement('a');
    headerLink.href = 'https://webtosvg.com';
    headerLink.target = '_blank';
    headerLink.rel = 'noopener';
    headerLink.className = 'ets-header-link';
    headerLink.textContent = 'webtosvg.com';
    header.appendChild(headerLink);

    const img = preview.querySelector('img');
    // Insert header before the img so it's the topmost visible element
    preview.insertBefore(header, img || loader);

    const rect = element.getBoundingClientRect();
    const tag = element.tagName.toLowerCase();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);

    if (img) {
      const thumb = document.createElement('div');
      thumb.className = 'ets-thumb';
      preview.insertBefore(thumb, img);
      thumb.appendChild(img);

      const badge = document.createElement('span');
      badge.className = 'ets-size-badge';
      badge.textContent = `${w}\u00D7${h}`;
      thumb.appendChild(badge);
    }

    // Actions area
    const actions = document.createElement('div');
    actions.className = 'ets-actions';

    const defaults = {
      filenamePattern: '{tagName}-{width}x{height}',
      pngScale: 2,
      outlineText: true,
      captureBackground: true,
      optimizeForFigma: false,
    };

    chrome.storage.sync.get(defaults, (settings) => {
      const baseName = buildFilename(settings.filenamePattern, tag, rect.width, rect.height);

      // Button row
      const btnRow = document.createElement('div');
      btnRow.className = 'ets-btn-row';

      // SVG split button
      const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
      const modKey = isMac ? '\u2318' : 'Ctrl+';
      btnRow.appendChild(makeSplitBtn('Copy SVG', 'ets-btn-primary', copySvg, [
        ['Copy SVG', copySvg],
        ['Download SVG', async () => {
          const blob = new Blob([state.svg], { type: 'image/svg+xml;charset=utf-8' });
          const dataUrl = await blobToDataUrl(blob);
          chrome.runtime.sendMessage({ action: 'download', dataUrl, filename: baseName + '.svg' });
          showToast('SVG downloaded');
        }],
      ], modKey + 'C'));

      // PNG split button
      btnRow.appendChild(makeSplitBtn('Copy PNG', 'ets-btn-secondary', async () => {
        try {
          const pngBlob = await svgToPNG(state.svg, rect.width, rect.height, settings.pngScale);
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
          showToast('PNG copied to clipboard');
        } catch (err) {
          showToast('Copy PNG failed: ' + err.message);
        }
      }, [
        ['Copy PNG', async () => {
          try {
            const pngBlob = await svgToPNG(state.svg, rect.width, rect.height, settings.pngScale);
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
            showToast('PNG copied to clipboard');
          } catch (err) {
            showToast('Copy PNG failed: ' + err.message);
          }
        }],
        ['Download PNG', async () => {
          try {
            const pngBlob = await svgToPNG(state.svg, rect.width, rect.height, settings.pngScale);
            const dataUrl = await blobToDataUrl(pngBlob);
            chrome.runtime.sendMessage({ action: 'download', dataUrl, filename: baseName + '.png' });
            showToast('PNG downloaded');
          } catch (err) {
            showToast('PNG export failed: ' + err.message);
          }
        }],
      ]));

      actions.appendChild(btnRow);

      // Options panel — reconvert on settings change
      actions.appendChild(buildOptionsPanel(settings, reconvert));

      // Clamp position to viewport now and whenever the card resizes (e.g. options toggle)
      requestAnimationFrame(() => {
        clampPreviewToViewport();
        startPreviewResizeObserver();
      });
    });

    preview.appendChild(actions);

    // Click outside to close; also close open dropdowns on interior clicks
    const onDocClick = (e) => {
      if (!preview.contains(e.target)) {
        cleanup();
        return;
      }
      for (const d of preview.querySelectorAll('.ets-dropdown-open')) {
        if (!d.parentElement.contains(e.target)) {
          d.classList.remove('ets-dropdown-open');
        }
      }
    };
    // Delay listener so the pinning click itself doesn't immediately close
    requestAnimationFrame(() => {
      document.addEventListener('click', onDocClick, true);
    });
    preview._docClickHandler = onDocClick;
  }

  /**
   * Short label for an element: tag + first class (truncated).
   */
  function elementLabel(el) {
    const tag = el.tagName.toLowerCase();
    if (el.id) return `${tag}#${el.id.substring(0, 12)}`;
    if (el.className && typeof el.className === 'string') {
      const cls = el.className.trim().split(/\s+/)[0];
      if (cls) return `${tag}.${cls.substring(0, 14)}`;
    }
    return tag;
  }

  /**
   * Build the ancestor chain from baseTarget up to the highest walkable ancestor.
   * Returns array from outermost to innermost (base).
   */
  function getAncestorChain(base) {
    const chain = [base];
    let node = base;
    while (node.parentElement && node.parentElement !== document.body && node.parentElement !== document.documentElement) {
      chain.push(node.parentElement);
      node = node.parentElement;
    }
    chain.reverse(); // outermost first
    return chain;
  }

  /**
   * Render the depth navigator showing nested boxes for the ancestor chain.
   * The selected depth level is highlighted.
   */
  function updateDepthNav() {
    if (!baseTarget || depthOffset === 0) {
      depthNav.style.display = 'none';
      return;
    }

    // When depth nav is active, hide the loader (they share the same space)
    loader.style.display = 'none';

    const chain = getAncestorChain(baseTarget);
    // Index of selected element in the chain (chain is outermost-first)
    const selectedIdx = chain.length - 1 - depthOffset;

    depthNav.innerHTML = '';
    depthNav.style.display = 'flex';

    // Build nested boxes — outermost wraps innermost
    // We show at most 5 levels to keep it compact, centered around the selection
    const maxVisible = 5;
    let startIdx = 0;
    let endIdx = chain.length - 1;
    if (chain.length > maxVisible) {
      const half = Math.floor(maxVisible / 2);
      startIdx = Math.max(0, selectedIdx - half);
      endIdx = startIdx + maxVisible - 1;
      if (endIdx >= chain.length) {
        endIdx = chain.length - 1;
        startIdx = endIdx - maxVisible + 1;
      }
    }

    // Truncation indicator at top
    if (startIdx > 0) {
      const dots = document.createElement('span');
      dots.className = 'ets-depth-dots';
      dots.textContent = `\u2191 ${startIdx} more`;
      depthNav.appendChild(dots);
    }

    // Create nested structure
    let container = depthNav;
    for (let i = startIdx; i <= endIdx; i++) {
      const el = chain[i];
      const isSelected = i === selectedIdx;
      const isBase = i === chain.length - 1;

      const box = document.createElement('div');
      box.className = 'ets-depth-box' +
        (isSelected ? ' ets-depth-selected' : '') +
        (isBase ? ' ets-depth-base' : '');

      const label = document.createElement('span');
      label.className = 'ets-depth-label';
      label.textContent = elementLabel(el);
      box.appendChild(label);

      container.appendChild(box);
      container = box;
    }

    // Scroll hint at bottom
    const hint = document.createElement('span');
    hint.className = 'ets-depth-hint';
    hint.textContent = 'scroll to navigate';
    depthNav.appendChild(hint);

    // Auto-hide after 500ms of no scrolling
    clearTimeout(depthNavTimer);
    depthNavTimer = setTimeout(() => {
      depthNav.style.display = 'none';
    }, 500);
  }

  /**
   * Walk up from `el` by `levels` parent steps, skipping body/html.
   * Returns the ancestor or the highest valid element if levels exceeds depth.
   */
  function walkUp(el, levels) {
    let node = el;
    for (let i = 0; i < levels; i++) {
      const parent = node.parentElement;
      if (!parent || parent === document.body || parent === document.documentElement) break;
      node = parent;
    }
    return node;
  }

  /**
   * Update highlight overlay and tooltip for the given target element.
   */
  function updateHighlight(target) {
    const rect = target.getBoundingClientRect();

    highlight.style.display = 'block';
    highlight.style.top = rect.top + 'px';
    highlight.style.left = rect.left + 'px';
    highlight.style.width = rect.width + 'px';
    highlight.style.height = rect.height + 'px';

    const tag = target.tagName.toLowerCase();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    const cls = target.className && typeof target.className === 'string'
      ? '.' + target.className.trim().split(/\s+/)[0]
      : '';
    const depthHint = depthOffset > 0 ? ` \u2191${depthOffset}` : '';
    tooltip.textContent = `<${tag}${cls}> ${w}\u00D7${h}${depthHint}`;
    tooltip.style.display = 'block';

    let tooltipTop = rect.top - 28;
    if (tooltipTop < 4) tooltipTop = rect.bottom + 4;
    tooltip.style.top = tooltipTop + 'px';
    tooltip.style.left = rect.left + 'px';
  }

  /**
   * Check if an element has more than `limit` descendants.
   * Uses TreeWalker with early exit to avoid counting every node.
   */
  function countDescendantsExceeds(el, limit) {
    let count = 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
    while (walker.nextNode()) {
      if (++count > limit) return true;
    }
    return false;
  }

  /**
   * Start the hover preview timer for a given element.
   */
  function startPreviewTimer(target, cx, cy) {
    const hoverTarget = target;
    positionPreview(cx, cy);
    preview.style.display = 'block';

    // Complexity gate: skip auto-preview for very large subtrees
    // Uses TreeWalker with early exit instead of querySelectorAll('*').length
    // to avoid counting every node in huge subtrees
    if (countDescendantsExceeds(target, HOVER_PREVIEW_MAX_DESCENDANTS)) {
      loader.style.display = 'flex';
      loaderLabel.textContent = `Large element (${HOVER_PREVIEW_MAX_DESCENDANTS}+ nodes) \u2014 click to convert`;
      loaderBar.style.display = 'none';
      updateDepthNav();
      // Set a dummy timer so hoverTimer is truthy (prevents re-entry)
      hoverTimer = setTimeout(() => {}, 0);
      return;
    }

    loader.style.display = 'flex';
    loaderLabel.textContent = 'Processing\u2026';
    loaderBar.style.display = '';
    loaderBar.style.animation = 'none';
    void loaderBar.offsetWidth;
    loaderBar.style.animation = 'ets-loader-fill 0.5s linear forwards';
    updateDepthNav();

    hoverTimer = setTimeout(async () => {
      if (currentTarget !== hoverTarget) return;
      loaderLabel.textContent = 'Converting\u2026';
      loaderBar.classList.add('ets-loader-bar-pulse');
      const ac = new AbortController();
      previewAbort = ac;
      try {
        const svgString = await convertElementToSVG(hoverTarget);
        if (ac.signal.aborted || currentTarget !== hoverTarget) return;
        cachedSvgString = svgString;
        depthNavReady = true;
        const img = document.createElement('img');
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
        img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
        preview.insertBefore(img, loader);
        loader.style.display = 'none';
        loaderBar.classList.remove('ets-loader-bar-pulse');
        showScrollCursor();
      } catch (err) {
        console.warn('[Element to SVG] Preview conversion failed:', err);
        loader.style.display = 'none';
        loaderBar.classList.remove('ets-loader-bar-pulse');
      }
    }, 500);
  }

  let mouseMoveQueued = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  function onMouseMove(e) {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    if (mouseMoveQueued) return;
    mouseMoveQueued = true;
    requestAnimationFrame(() => {
      mouseMoveQueued = false;
      processMouseMove(lastMouseX, lastMouseY);
    });
  }

  function processMouseMove(cx, cy) {
    if (pinned) return;
    const els = document.elementsFromPoint(cx, cy);
    const rawTarget = els.find((el) => !isOwnElement(el) && el !== document.body && el !== document.documentElement);

    if (!rawTarget) {
      highlight.style.display = 'none';
      tooltip.style.display = 'none';
      hidePreview();
      currentTarget = null;
      baseTarget = null;
      return;
    }

    // Reset depth when the raw element under cursor changes
    if (rawTarget !== baseTarget) {
      baseTarget = rawTarget;
      depthOffset = 0;
      depthNavReady = false;
    }

    const target = walkUp(rawTarget, depthOffset);

    if (target !== currentTarget) {
      hidePreview();
    }

    currentTarget = target;

    // Keep preview and scroll cursor following the mouse
    if (preview.style.display !== 'none') {
      positionPreview(cx, cy);
    }
    positionScrollCursor(cx, cy);

    // Start hover preview timer if not already running for this element
    if (!hoverTimer) {
      startPreviewTimer(target, cx, cy);
    }

    updateHighlight(target);
  }

  function onWheel(e) {
    // Only hijack scroll for depth navigation after preview has loaded.
    // Before that, let the wheel scroll the page normally.
    if (!baseTarget || !depthNavReady) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.deltaY < 0) {
      // Scroll up → select parent
      depthOffset++;
    } else if (e.deltaY > 0) {
      // Scroll down → select child (back toward original)
      depthOffset = Math.max(0, depthOffset - 1);
    }

    const target = walkUp(baseTarget, depthOffset);

    // Clamp: if walkUp couldn't go high enough, adjust depthOffset to match
    let actual = 0;
    let node = baseTarget;
    while (node !== target) {
      node = node.parentElement;
      actual++;
    }
    depthOffset = actual;

    if (target !== currentTarget) {
      hidePreview();
      currentTarget = target;
      startPreviewTimer(target, e.clientX, e.clientY);
    } else {
      // Same target but depth changed — update the nav highlight
      updateDepthNav();
    }

    updateHighlight(target);
  }

  async function onClick(e) {
    // Shield intercepts clicks to block :hover, but we still want to handle them
    if (!currentTarget || (isOwnElement(e.target) && e.target !== shield)) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const element = currentTarget;

    // If we already have a cached SVG from hover preview, use it directly
    if (cachedSvgString) {
      pinPreview(element, cachedSvgString);
      return;
    }

    // No cached SVG — need to convert (clicked before preview finished)
    // Cancel any in-flight hover conversion to avoid duplicate images
    clearTimeout(hoverTimer);
    hoverTimer = null;
    previewAbort?.abort();
    previewAbort = null;

    // Stop picker movement but keep preview visible with loader
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('wheel', onWheel, true);
    document.removeEventListener('click', onClick, true);
    highlight.style.display = 'none';
    tooltip.style.display = 'none';

    // Show loader in preview if not already visible
    if (preview.style.display === 'none') {
      preview.style.display = 'block';
      const rect = element.getBoundingClientRect();
      preview.style.left = (rect.left + rect.width / 2) + 'px';
      preview.style.top = (rect.top + rect.height / 2) + 'px';
    }
    loader.style.display = 'flex';
    loaderLabel.textContent = 'Converting\u2026';
    loaderBar.classList.add('ets-loader-bar-pulse');

    try {
      const svgString = await convertElementToSVG(element);
      loaderBar.classList.remove('ets-loader-bar-pulse');
      loader.style.display = 'none';
      const img = document.createElement('img');
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
      preview.insertBefore(img, loader);
      pinPreview(element, svgString);
    } catch (err) {
      console.error('[Element to SVG] Conversion failed:', err);
      showToast('SVG conversion failed: ' + err.message);
      cleanup();
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cleanup();
    }
    if (e.key === 'c' && (e.metaKey || e.ctrlKey) && !e.shiftKey && pinned && pinnedCopySvg) {
      e.preventDefault();
      e.stopPropagation();
      pinnedCopySvg();
    }
  }

  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('wheel', onWheel, { capture: true, passive: false });
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);
})();
