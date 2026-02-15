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

  let currentTarget = null;
  let hoverTimer = null;
  let previewAbort = null;
  let cachedSvgString = null;
  let pinned = false;

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
    previewAbort?.abort();
    previewAbort = null;
    cachedSvgString = null;
    loader.style.display = 'none';
    loaderLabel.textContent = 'Processing\u2026';
    loaderBar.style.animation = 'none';
    preview.style.display = 'none';
    preview.classList.remove('ets-preview-pinned');
    // Remove everything except the loader
    for (const child of [...preview.children]) {
      if (child !== loader) child.remove();
    }
  }

  function cleanup() {
    pinned = false;
    if (preview._docClickHandler) {
      document.removeEventListener('click', preview._docClickHandler, true);
      preview._docClickHandler = null;
    }
    window.__elementToSvgActive = false;
    window.__elementToSvgCleanup = undefined;
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    hidePreview();
    highlight.remove();
    tooltip.remove();
    preview.remove();
    styleEl.remove();
  }

  window.__elementToSvgCleanup = cleanup;

  function isOwnElement(el) {
    return el === highlight || el === tooltip || el === preview ||
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

  function clampPreviewToViewport() {
    // Wait one frame so the pinned layout has been applied and we can measure
    requestAnimationFrame(() => {
      const margin = 8;
      const rect = preview.getBoundingClientRect();
      let left = rect.left;
      let top = rect.top;

      if (rect.right > window.innerWidth - margin) {
        left = window.innerWidth - margin - rect.width;
      }
      if (rect.bottom > window.innerHeight - margin) {
        top = window.innerHeight - margin - rect.height;
      }
      if (left < margin) left = margin;
      if (top < margin) top = margin;

      // If the panel is taller than the viewport, pin to top
      if (rect.height > window.innerHeight - margin * 2) {
        top = margin;
      }

      preview.style.left = left + 'px';
      preview.style.top = top + 'px';
    });
  }

  function makeSplitBtn(label, primaryClass, primaryHandler, items) {
    const wrap = document.createElement('div');
    wrap.className = 'ets-split-btn';

    const main = document.createElement('button');
    main.className = 'ets-btn ' + primaryClass + ' ets-split-main';
    main.textContent = label;
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

    const title = document.createElement('div');
    title.className = 'ets-options-title';
    title.textContent = 'Options';
    panel.appendChild(title);

    function makeCheckbox(id, label, checked, storageKey) {
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
      panel.appendChild(lbl);
    }

    function makeRadioGroup(legend, name, options, current, onChange) {
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
      panel.appendChild(fs);
    }

    makeCheckbox('outline-text', 'Outline text', settings.outlineText, 'outlineText');
    makeCheckbox('capture-bg', 'Capture background', settings.captureBackground, 'captureBackground');
    makeCheckbox('optimize-figma', 'Optimize for Figma', settings.optimizeForFigma, 'optimizeForFigma');
    makeRadioGroup('PNG scale', 'ets-png-scale', ['1', '2', '3'], settings.pngScale, (v) => {
      chrome.storage.sync.set({ pngScale: v });
    });

    return panel;
  }

  function pinPreview(element, svgString) {
    pinned = true;

    // Mutable state — reconvert updates these
    const state = { svg: svgString };

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

    const img = preview.querySelector('img');
    if (img) {
      const thumb = document.createElement('div');
      thumb.className = 'ets-thumb';
      preview.insertBefore(thumb, img);
      thumb.appendChild(img);
    }

    // Element info
    const rect = element.getBoundingClientRect();
    const tag = element.tagName.toLowerCase();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    const cls = element.className && typeof element.className === 'string'
      ? '.' + element.className.trim().split(/\s+/)[0]
      : '';

    const info = document.createElement('div');
    info.className = 'ets-info';
    info.innerHTML = `<strong>&lt;${tag}${cls}&gt;</strong> &mdash; ${w} &times; ${h}px`;
    preview.appendChild(info);

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
      btnRow.appendChild(makeSplitBtn('Copy SVG', 'ets-btn-primary', async () => {
        try {
          await navigator.clipboard.writeText(state.svg);
          showToast('SVG copied to clipboard');
        } catch {
          showToast('Copy failed — check permissions');
        }
      }, [
        ['Copy SVG', async () => {
          try {
            await navigator.clipboard.writeText(state.svg);
            showToast('SVG copied to clipboard');
          } catch {
            showToast('Copy failed — check permissions');
          }
        }],
        ['Download SVG', async () => {
          const blob = new Blob([state.svg], { type: 'image/svg+xml;charset=utf-8' });
          const dataUrl = await blobToDataUrl(blob);
          chrome.runtime.sendMessage({ action: 'download', dataUrl, filename: baseName + '.svg' });
          showToast('SVG downloaded');
        }],
      ]));

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

      // Clamp position to viewport now that all content is built
      clampPreviewToViewport();
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

  function onMouseMove(e) {
    const els = document.elementsFromPoint(e.clientX, e.clientY);
    const target = els.find((el) => !isOwnElement(el) && el !== document.body && el !== document.documentElement);

    if (!target) {
      highlight.style.display = 'none';
      tooltip.style.display = 'none';
      hidePreview();
      currentTarget = null;
      return;
    }

    if (target !== currentTarget) {
      hidePreview();
    }

    currentTarget = target;
    const rect = target.getBoundingClientRect();

    // Keep preview following the cursor
    if (preview.style.display !== 'none') {
      positionPreview(e.clientX, e.clientY);
    }

    // Start hover preview timer if not already running for this element
    if (!hoverTimer) {
      const hoverTarget = target;
      // Show preview container at cursor with loader bar
      positionPreview(e.clientX, e.clientY);
      preview.style.display = 'block';
      loader.style.display = 'flex';
      loaderLabel.textContent = 'Processing\u2026';
      loaderBar.style.animation = 'none';
      void loaderBar.offsetWidth; // force reflow to restart animation
      loaderBar.style.animation = 'ets-loader-fill 0.5s linear forwards';

      hoverTimer = setTimeout(async () => {
        if (currentTarget !== hoverTarget) return;
        // Keep loader visible with full bar while converting
        loaderLabel.textContent = 'Converting\u2026';
        loaderBar.classList.add('ets-loader-bar-pulse');
        const ac = new AbortController();
        previewAbort = ac;
        try {
          const svgString = await convertElementToSVG(hoverTarget);
          if (ac.signal.aborted || currentTarget !== hoverTarget) return;
          cachedSvgString = svgString;
          const img = document.createElement('img');
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
          img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
          preview.insertBefore(img, loader);
          loader.style.display = 'none';
          loaderBar.classList.remove('ets-loader-bar-pulse');
        } catch {
          loader.style.display = 'none';
          loaderBar.classList.remove('ets-loader-bar-pulse');
        }
      }, 500);
    }

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
    tooltip.textContent = `<${tag}${cls}> ${w}\u00D7${h}`;
    tooltip.style.display = 'block';

    // Position tooltip above the highlight
    let tooltipTop = rect.top - 28;
    if (tooltipTop < 4) tooltipTop = rect.bottom + 4;
    tooltip.style.top = tooltipTop + 'px';
    tooltip.style.left = rect.left + 'px';
  }

  async function onClick(e) {
    if (!currentTarget || isOwnElement(e.target)) return;

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
  }

  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);
})();
