import { convertElementToSVG, svgToPNG } from './converter.js';
import pickerCSS from './picker.css';

const HOVER_PREVIEW_MAX_DESCENDANTS = 500;

export class Picker {
  /**
   * @param {Object} options
   * @param {import('./adapter.js').PlatformAdapter} options.adapter
   * @param {HTMLElement} [options.container] - scoping container (defaults to document.body)
   * @param {() => void} [options.onCleanup] - called when picker deactivates
   */
  constructor({ adapter, container, onCleanup }) {
    this.adapter = adapter;
    this.container = container || document.body;
    this.onCleanup = onCleanup;
    this.active = false;
    this._scoped = this.container !== document.body;

    // State
    this._currentTarget = null;
    this._hoverTimer = null;
    this._previewAbort = null;
    this._cachedSvgString = null;
    this._pinned = false;
    this._depthOffset = 0;
    this._baseTarget = null;
    this._depthNavTimer = null;
    this._depthNavReady = false;
    this._pinnedCopySvg = null;
    this._mouseMoveQueued = false;
    this._lastMouseX = 0;
    this._lastMouseY = 0;
    this._converting = false;

    // DOM elements (created in activate)
    this._styleEl = null;
    this._shield = null;
    this._highlight = null;
    this._tooltip = null;
    this._preview = null;
    this._loader = null;
    this._loaderLabel = null;
    this._loaderBar = null;
    this._depthNav = null;
    this._scrollCursor = null;
    this._previewResizeObserver = null;
    this._clamping = false;

    // Bound handlers
    this._onMouseMove = this._onMouseMoveFn.bind(this);
    this._onWheel = this._onWheelFn.bind(this);
    this._onClick = this._onClickFn.bind(this);
    this._onKeyDown = this._onKeyDownFn.bind(this);
  }

  activate() {
    if (this.active) {
      this.deactivate();
      return;
    }
    this.active = true;
    this._injectStyles();
    this._createElements();
    this._attachListeners();
  }

  deactivate() {
    if (!this.active) return;
    this._pinned = false;
    this._pinnedCopySvg = null;
    if (this._preview?._docClickHandler) {
      document.removeEventListener('click', this._preview._docClickHandler, true);
      this._preview._docClickHandler = null;
    }
    this._detachListeners();
    this._hidePreview();
    this._removeElements();
    this.active = false;
    this.onCleanup?.();
  }

  // ── Styles ──

  _injectStyles() {
    this._styleEl = document.createElement('style');
    this._styleEl.textContent = pickerCSS;
    document.head.appendChild(this._styleEl);
  }

  // ── DOM creation ──

  _createElements() {
    const container = this.container;

    // Shield
    this._shield = document.createElement('div');
    this._shield.className = 'ets-shield';
    if (this._scoped) {
      this._shield.style.position = 'absolute';
      container.style.position = 'relative';
    }
    container.appendChild(this._shield);

    // Highlight
    this._highlight = document.createElement('div');
    this._highlight.className = 'ets-highlight';
    this._highlight.style.display = 'none';
    if (this._scoped) this._highlight.style.position = 'absolute';
    container.appendChild(this._highlight);

    // Tooltip
    this._tooltip = document.createElement('div');
    this._tooltip.className = 'ets-tooltip';
    this._tooltip.style.display = 'none';
    if (this._scoped) this._tooltip.style.position = 'absolute';
    container.appendChild(this._tooltip);

    // Preview
    this._preview = document.createElement('div');
    this._preview.className = 'ets-preview';
    this._preview.style.display = 'none';
    if (this._scoped) this._preview.style.position = 'absolute';
    container.appendChild(this._preview);

    // Loader
    this._loader = document.createElement('div');
    this._loader.className = 'ets-loader';
    this._loader.style.display = 'none';
    this._loaderLabel = document.createElement('div');
    this._loaderLabel.className = 'ets-loader-label';
    this._loaderLabel.textContent = 'Processing\u2026';
    const loaderTrack = document.createElement('div');
    loaderTrack.className = 'ets-loader-track';
    this._loaderBar = document.createElement('div');
    this._loaderBar.className = 'ets-loader-bar';
    loaderTrack.appendChild(this._loaderBar);
    this._loader.appendChild(this._loaderLabel);
    this._loader.appendChild(loaderTrack);
    this._preview.appendChild(this._loader);

    // Depth nav
    this._depthNav = document.createElement('div');
    this._depthNav.className = 'ets-depth-nav';
    this._depthNav.style.display = 'none';
    this._preview.appendChild(this._depthNav);

    // Scroll cursor
    this._scrollCursor = document.createElement('div');
    this._scrollCursor.className = 'ets-scroll-cursor';
    this._scrollCursor.innerHTML =
      '<span class="ets-sc-chevron ets-sc-up"></span>' +
      '<span class="ets-sc-dot"></span>' +
      '<span class="ets-sc-chevron ets-sc-down"></span>';
    this._scrollCursor.style.display = 'none';
    container.appendChild(this._scrollCursor);
  }

  _removeElements() {
    this._shield?.remove();
    this._highlight?.remove();
    this._tooltip?.remove();
    this._preview?.remove();
    this._scrollCursor?.remove();
    this._styleEl?.remove();
    this._shield = null;
    this._highlight = null;
    this._tooltip = null;
    this._preview = null;
    this._scrollCursor = null;
    this._styleEl = null;
  }

  // ── Event listeners ──

  _attachListeners() {
    document.addEventListener('mousemove', this._onMouseMove, true);
    document.addEventListener('wheel', this._onWheel, { capture: true, passive: false });
    document.addEventListener('click', this._onClick, true);
    document.addEventListener('keydown', this._onKeyDown, true);
  }

  _detachListeners() {
    document.removeEventListener('mousemove', this._onMouseMove, true);
    document.removeEventListener('wheel', this._onWheel, true);
    document.removeEventListener('click', this._onClick, true);
    document.removeEventListener('keydown', this._onKeyDown, true);
  }

  // ── Helpers ──

  _isOwnElement(el) {
    return el === this._shield || el === this._highlight || el === this._tooltip ||
      el === this._preview || el === this._loader || this._preview?.contains(el);
  }

  _showScrollCursor() {
    this._scrollCursor.style.display = 'flex';
    document.documentElement.classList.add('ets-cursor-hidden');
  }

  _hideScrollCursor() {
    this._scrollCursor.style.display = 'none';
    document.documentElement.classList.remove('ets-cursor-hidden');
  }

  _positionScrollCursor(cx, cy) {
    if (this._scoped) {
      const cr = this.container.getBoundingClientRect();
      this._scrollCursor.style.left = (cx - cr.left) + 'px';
      this._scrollCursor.style.top = (cy - cr.top) + 'px';
    } else {
      this._scrollCursor.style.left = cx + 'px';
      this._scrollCursor.style.top = cy + 'px';
    }
  }

  _showToast(message) {
    const el = document.createElement('div');
    el.textContent = message;
    Object.assign(el.style, {
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#1b1d27',
      color: 'white',
      padding: '8px 16px',
      borderRadius: '6px',
      fontSize: '13px',
      fontFamily: "'Spline Sans Mono', monospace",
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

  _buildFilename(pattern, tagName, width, height) {
    return pattern
      .replace('{tagName}', tagName.toLowerCase())
      .replace('{width}', String(Math.round(width)))
      .replace('{height}', String(Math.round(height)));
  }

  _blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    });
  }

  // ── Preview ──

  _hidePreview() {
    clearTimeout(this._hoverTimer);
    this._hoverTimer = null;
    clearTimeout(this._depthNavTimer);
    this._depthNavTimer = null;
    this._previewAbort?.abort();
    this._previewAbort = null;
    this._cachedSvgString = null;
    this._hideScrollCursor();
    this._stopPreviewResizeObserver();
    if (!this._preview) return;
    this._loader.style.display = 'none';
    this._loaderLabel.textContent = 'Processing\u2026';
    this._loaderBar.style.display = '';
    this._loaderBar.style.animation = 'none';
    this._depthNav.style.display = 'none';
    this._depthNav.innerHTML = '';
    this._preview.style.display = 'none';
    this._preview.style.maxHeight = '';
    this._preview.classList.remove('ets-preview-pinned');
    for (const child of [...this._preview.children]) {
      if (child !== this._loader && child !== this._depthNav) child.remove();
    }
  }

  _positionPreview(cx, cy) {
    const previewW = 200;
    const previewH = 160;
    const gap = 16;

    if (this._scoped) {
      const cr = this.container.getBoundingClientRect();
      const localX = cx - cr.left;
      const localY = cy - cr.top;
      let left = localX + gap;
      let top = localY + gap;
      if (left + previewW > cr.width) left = localX - previewW - gap;
      if (top + previewH > cr.height) top = localY - previewH - gap;
      if (left < 4) left = 4;
      if (top < 4) top = 4;
      this._preview.style.left = left + 'px';
      this._preview.style.top = top + 'px';
    } else {
      let left = cx + gap;
      let top = cy + gap;
      if (left + previewW > window.innerWidth) left = cx - previewW - gap;
      if (top + previewH > window.innerHeight) top = cy - previewH - gap;
      if (left < 4) left = 4;
      if (top < 4) top = 4;
      this._preview.style.left = left + 'px';
      this._preview.style.top = top + 'px';
    }
  }

  _clampPreviewToViewport() {
    if (this._clamping) return;
    this._clamping = true;

    const margin = 20;
    const prevMaxH = this._preview.style.maxHeight;
    this._preview.style.maxHeight = 'none';
    const rect = this._preview.getBoundingClientRect();

    let left = rect.left;
    let top = rect.top;
    const cardW = rect.width;
    const cardH = rect.height;

    if (left + cardW > window.innerWidth - margin) {
      left = window.innerWidth - margin - cardW;
    }
    if (left < margin) left = margin;
    if (top + cardH > window.innerHeight - margin) {
      top = window.innerHeight - margin - cardH;
    }
    if (top < margin) top = margin;

    const availableH = window.innerHeight - top - margin;
    this._preview.style.left = left + 'px';
    this._preview.style.top = top + 'px';
    this._preview.style.maxHeight = availableH + 'px';
    this._clamping = false;
  }

  _startPreviewResizeObserver() {
    if (this._previewResizeObserver) return;
    this._previewResizeObserver = new ResizeObserver(() => {
      if (this._pinned) this._clampPreviewToViewport();
    });
    this._previewResizeObserver.observe(this._preview);
  }

  _stopPreviewResizeObserver() {
    if (this._previewResizeObserver) {
      this._previewResizeObserver.disconnect();
      this._previewResizeObserver = null;
    }
  }

  // ── Split button ──

  _makeSplitBtn(label, primaryClass, primaryHandler, items, shortcutHint) {
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
        try { await handler(); } catch (err) { this._showToast('Error: ' + err.message); }
      });
      dropdown.appendChild(item);
    }

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      this._preview.querySelectorAll('.ets-dropdown-open').forEach((d) => {
        if (d !== dropdown) d.classList.remove('ets-dropdown-open');
      });
      dropdown.classList.toggle('ets-dropdown-open');
    });

    wrap.appendChild(main);
    wrap.appendChild(toggle);
    wrap.appendChild(dropdown);
    return wrap;
  }

  // ── Options panel ──

  _buildOptionsPanel(settings, onReconvert) {
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

    const makeCheckbox = (id, label, description, checked, storageKey) => {
      const wrap = document.createElement('div');
      wrap.className = 'ets-option-item';
      const lbl = document.createElement('label');
      lbl.className = 'ets-option-label';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = checked;
      input.addEventListener('change', () => {
        this.adapter.setSettings({ [storageKey]: input.checked });
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
    };

    const makeRadioGroup = (legend, name, options, current, onChange, description) => {
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
    };

    makeCheckbox('outline-text', 'Outline text', 'Convert text to vector paths so fonts render everywhere', settings.outlineText, 'outlineText');
    makeCheckbox('capture-bg', 'Capture background', 'Include the element\u2019s background color in the export', settings.captureBackground, 'captureBackground');
    makeCheckbox('optimize-figma', 'Optimize for Figma', 'Simplify groups and paths for cleaner Figma imports', settings.optimizeForFigma, 'optimizeForFigma');
    makeRadioGroup('PNG scale', 'ets-png-scale', ['1', '2', '3'], settings.pngScale, (v) => {
      this.adapter.setSettings({ pngScale: v });
    }, 'Multiplier for PNG export resolution');

    return panel;
  }

  // ── Pinned preview ──

  _pinPreview(element, svgString) {
    this._pinned = true;
    this._hideScrollCursor();

    const state = { svg: svgString };

    const copySvg = async () => {
      try {
        await navigator.clipboard.writeText(state.svg);
        this._showToast('SVG copied to clipboard');
      } catch {
        this._showToast('Copy failed \u2014 check permissions');
      }
    };
    this._pinnedCopySvg = copySvg;

    const reconvert = async () => {
      const thumb = this._preview.querySelector('.ets-thumb');
      if (thumb) thumb.classList.add('ets-thumb-loading');
      try {
        state.svg = await convertElementToSVG(element, this.adapter);
        const img = this._preview.querySelector('.ets-thumb img');
        if (img) {
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(state.svg);
        }
      } catch (err) {
        this._showToast('Re-conversion failed: ' + err.message);
      } finally {
        if (thumb) thumb.classList.remove('ets-thumb-loading');
      }
    };

    // Stop picker listeners
    document.removeEventListener('mousemove', this._onMouseMove, true);
    document.removeEventListener('wheel', this._onWheel, true);
    document.removeEventListener('click', this._onClick, true);
    this._highlight.style.display = 'none';
    this._tooltip.style.display = 'none';

    // Pin the preview
    this._preview.classList.add('ets-preview-pinned');

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'ets-btn-card-close';
    closeBtn.textContent = '\u2715';
    closeBtn.addEventListener('click', () => this.deactivate());
    this._preview.appendChild(closeBtn);

    const header = document.createElement('div');
    header.className = 'ets-header';
    const headerLink = document.createElement('a');
    headerLink.href = 'https://webtosvg.com';
    headerLink.target = '_blank';
    headerLink.rel = 'noopener';
    headerLink.className = 'ets-header-link';
    headerLink.textContent = 'webtosvg.com';
    header.appendChild(headerLink);

    const img = this._preview.querySelector('img');
    this._preview.insertBefore(header, img || this._loader);

    const rect = element.getBoundingClientRect();
    const tag = element.tagName.toLowerCase();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);

    if (img) {
      const thumb = document.createElement('div');
      thumb.className = 'ets-thumb';
      this._preview.insertBefore(thumb, img);
      thumb.appendChild(img);

      const badge = document.createElement('span');
      badge.className = 'ets-size-badge';
      badge.textContent = `${w}\u00D7${h}`;
      thumb.appendChild(badge);
    }

    const actions = document.createElement('div');
    actions.className = 'ets-actions';

    const defaults = {
      filenamePattern: '{tagName}-{width}x{height}',
      pngScale: 2,
      outlineText: true,
      captureBackground: true,
      optimizeForFigma: false,
    };

    this.adapter.getSettings(defaults).then((settings) => {
      const baseName = this._buildFilename(settings.filenamePattern, tag, rect.width, rect.height);

      const btnRow = document.createElement('div');
      btnRow.className = 'ets-btn-row';

      const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
      const modKey = isMac ? '\u2318' : 'Ctrl+';
      btnRow.appendChild(this._makeSplitBtn('Copy SVG', 'ets-btn-primary', copySvg, [
        ['Copy SVG', copySvg],
        ['Download SVG', async () => {
          const blob = new Blob([state.svg], { type: 'image/svg+xml;charset=utf-8' });
          const dataUrl = await this._blobToDataUrl(blob);
          this.adapter.download(dataUrl, baseName + '.svg');
          this._showToast('SVG downloaded');
        }],
      ], modKey + 'C'));

      btnRow.appendChild(this._makeSplitBtn('Copy PNG', 'ets-btn-secondary', async () => {
        try {
          const pngBlob = await svgToPNG(state.svg, rect.width, rect.height, settings.pngScale);
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
          this._showToast('PNG copied to clipboard');
        } catch (err) {
          this._showToast('Copy PNG failed: ' + err.message);
        }
      }, [
        ['Copy PNG', async () => {
          try {
            const pngBlob = await svgToPNG(state.svg, rect.width, rect.height, settings.pngScale);
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
            this._showToast('PNG copied to clipboard');
          } catch (err) {
            this._showToast('Copy PNG failed: ' + err.message);
          }
        }],
        ['Download PNG', async () => {
          try {
            const pngBlob = await svgToPNG(state.svg, rect.width, rect.height, settings.pngScale);
            const dataUrl = await this._blobToDataUrl(pngBlob);
            this.adapter.download(dataUrl, baseName + '.png');
            this._showToast('PNG downloaded');
          } catch (err) {
            this._showToast('PNG export failed: ' + err.message);
          }
        }],
      ]));

      actions.appendChild(btnRow);
      actions.appendChild(this._buildOptionsPanel(settings, reconvert));

      requestAnimationFrame(() => {
        this._clampPreviewToViewport();
        this._startPreviewResizeObserver();
      });
    });

    this._preview.appendChild(actions);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'ets-footer';
    const footerLeft = document.createElement('a');
    footerLeft.href = 'https://webtosvg.com';
    footerLeft.target = '_blank';
    footerLeft.rel = 'noopener';
    footerLeft.className = 'ets-footer-link';
    footerLeft.textContent = '\u00A9 webtosvg.com';
    const footerRight = document.createElement('a');
    footerRight.href = 'https://markusevanger.no';
    footerRight.target = '_blank';
    footerRight.rel = 'noopener';
    footerRight.className = 'ets-footer-link';
    footerRight.textContent = 'By markusevanger.no';
    footer.appendChild(footerLeft);
    footer.appendChild(footerRight);
    this._preview.appendChild(footer);

    // Click outside to close
    const onDocClick = (e) => {
      if (!this._preview.contains(e.target)) {
        this.deactivate();
        return;
      }
      for (const d of this._preview.querySelectorAll('.ets-dropdown-open')) {
        if (!d.parentElement.contains(e.target)) {
          d.classList.remove('ets-dropdown-open');
        }
      }
    };
    requestAnimationFrame(() => {
      document.addEventListener('click', onDocClick, true);
    });
    this._preview._docClickHandler = onDocClick;
  }

  // ── Element helpers ──

  _elementLabel(el) {
    const tag = el.tagName.toLowerCase();
    if (el.id) return `${tag}#${el.id.substring(0, 12)}`;
    if (el.className && typeof el.className === 'string') {
      const cls = el.className.trim().split(/\s+/)[0];
      if (cls) return `${tag}.${cls.substring(0, 14)}`;
    }
    return tag;
  }

  _getAncestorChain(base) {
    const chain = [base];
    let node = base;
    const stopAt = this._scoped ? this.container : document.body;
    while (node.parentElement && node.parentElement !== stopAt && node.parentElement !== document.documentElement) {
      chain.push(node.parentElement);
      node = node.parentElement;
    }
    chain.reverse();
    return chain;
  }

  _updateDepthNav() {
    if (!this._baseTarget || this._depthOffset === 0) {
      this._depthNav.style.display = 'none';
      return;
    }

    this._loader.style.display = 'none';

    const chain = this._getAncestorChain(this._baseTarget);
    const selectedIdx = chain.length - 1 - this._depthOffset;

    this._depthNav.innerHTML = '';
    this._depthNav.style.display = 'flex';

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

    if (startIdx > 0) {
      const dots = document.createElement('span');
      dots.className = 'ets-depth-dots';
      dots.textContent = `\u2191 ${startIdx} more`;
      this._depthNav.appendChild(dots);
    }

    let container = this._depthNav;
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
      label.textContent = this._elementLabel(el);
      box.appendChild(label);

      container.appendChild(box);
      container = box;
    }

    const hint = document.createElement('span');
    hint.className = 'ets-depth-hint';
    hint.textContent = 'scroll to navigate';
    this._depthNav.appendChild(hint);

    clearTimeout(this._depthNavTimer);
    this._depthNavTimer = setTimeout(() => {
      this._depthNav.style.display = 'none';
    }, 500);
  }

  _walkUp(el, levels) {
    let node = el;
    const stopAt = this._scoped ? this.container : document.body;
    for (let i = 0; i < levels; i++) {
      const parent = node.parentElement;
      if (!parent || parent === stopAt || parent === document.documentElement) break;
      node = parent;
    }
    return node;
  }

  _updateHighlight(target) {
    const rect = target.getBoundingClientRect();

    if (this._scoped) {
      const cr = this.container.getBoundingClientRect();
      this._highlight.style.display = 'block';
      this._highlight.style.top = (rect.top - cr.top) + 'px';
      this._highlight.style.left = (rect.left - cr.left) + 'px';
      this._highlight.style.width = rect.width + 'px';
      this._highlight.style.height = rect.height + 'px';
    } else {
      this._highlight.style.display = 'block';
      this._highlight.style.top = rect.top + 'px';
      this._highlight.style.left = rect.left + 'px';
      this._highlight.style.width = rect.width + 'px';
      this._highlight.style.height = rect.height + 'px';
    }

    const tag = target.tagName.toLowerCase();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    const cls = target.className && typeof target.className === 'string'
      ? '.' + target.className.trim().split(/\s+/)[0]
      : '';
    const depthHint = this._depthOffset > 0 ? ` \u2191${this._depthOffset}` : '';
    this._tooltip.textContent = `<${tag}${cls}> ${w}\u00D7${h}${depthHint}`;
    this._tooltip.style.display = 'block';

    if (this._scoped) {
      const cr = this.container.getBoundingClientRect();
      let tooltipTop = rect.top - cr.top - 28;
      if (tooltipTop < 4) tooltipTop = rect.bottom - cr.top + 4;
      this._tooltip.style.top = tooltipTop + 'px';
      this._tooltip.style.left = (rect.left - cr.left) + 'px';
    } else {
      let tooltipTop = rect.top - 28;
      if (tooltipTop < 4) tooltipTop = rect.bottom + 4;
      this._tooltip.style.top = tooltipTop + 'px';
      this._tooltip.style.left = rect.left + 'px';
    }
  }

  _countDescendantsExceeds(el, limit) {
    let count = 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
    while (walker.nextNode()) {
      if (++count > limit) return true;
    }
    return false;
  }

  // ── Preview timer ──

  _startPreviewTimer(target, cx, cy) {
    const hoverTarget = target;
    this._positionPreview(cx, cy);
    this._preview.style.display = 'block';

    if (this._countDescendantsExceeds(target, HOVER_PREVIEW_MAX_DESCENDANTS)) {
      this._loader.style.display = 'flex';
      this._loaderLabel.textContent = `Large element (${HOVER_PREVIEW_MAX_DESCENDANTS}+ nodes) \u2014 click to convert`;
      this._loaderBar.style.display = 'none';
      this._updateDepthNav();
      this._hoverTimer = setTimeout(() => {}, 0);
      return;
    }

    this._loader.style.display = 'flex';
    this._loaderLabel.textContent = 'Processing\u2026';
    this._loaderBar.style.display = '';
    this._loaderBar.style.animation = 'none';
    void this._loaderBar.offsetWidth;
    this._loaderBar.style.animation = 'ets-loader-fill 0.5s linear forwards';
    this._updateDepthNav();

    this._hoverTimer = setTimeout(async () => {
      if (this._currentTarget !== hoverTarget) return;
      this._loaderLabel.textContent = 'Converting\u2026';
      this._loaderBar.classList.add('ets-loader-bar-pulse');
      const ac = new AbortController();
      this._previewAbort = ac;
      try {
        const svgString = await convertElementToSVG(hoverTarget, this.adapter);
        if (ac.signal.aborted || this._currentTarget !== hoverTarget) return;
        this._cachedSvgString = svgString;
        this._depthNavReady = true;
        const img = document.createElement('img');
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
        img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
        this._preview.insertBefore(img, this._loader);
        this._loader.style.display = 'none';
        this._loaderBar.classList.remove('ets-loader-bar-pulse');
        this._showScrollCursor();
      } catch (err) {
        console.warn('[Web to SVG] Preview conversion failed:', err);
        this._loader.style.display = 'none';
        this._loaderBar.classList.remove('ets-loader-bar-pulse');
      }
    }, 500);
  }

  // ── Event handlers ──

  _onMouseMoveFn(e) {
    this._lastMouseX = e.clientX;
    this._lastMouseY = e.clientY;
    if (this._mouseMoveQueued) return;
    this._mouseMoveQueued = true;
    requestAnimationFrame(() => {
      this._mouseMoveQueued = false;
      this._processMouseMove(this._lastMouseX, this._lastMouseY);
    });
  }

  _processMouseMove(cx, cy) {
    if (this._pinned) return;

    // In scoped mode, ignore events outside the container
    if (this._scoped) {
      const cr = this.container.getBoundingClientRect();
      if (cx < cr.left || cx > cr.right || cy < cr.top || cy > cr.bottom) {
        this._highlight.style.display = 'none';
        this._tooltip.style.display = 'none';
        this._hidePreview();
        this._currentTarget = null;
        this._baseTarget = null;
        return;
      }
    }

    const els = document.elementsFromPoint(cx, cy);
    let rawTarget = els.find((el) => !this._isOwnElement(el) && el !== document.body && el !== document.documentElement &&
      (!this._scoped || this.container.contains(el)));

    // If the hit element is an SVG child (circle, rect, polygon, path, etc.),
    // promote to the closest <svg> ancestor so we pick the whole shape.
    if (rawTarget?.namespaceURI === 'http://www.w3.org/2000/svg' && rawTarget.tagName !== 'svg') {
      const svgAncestor = rawTarget.closest('svg');
      if (svgAncestor) rawTarget = svgAncestor;
    }

    if (!rawTarget) {
      this._highlight.style.display = 'none';
      this._tooltip.style.display = 'none';
      this._hidePreview();
      this._currentTarget = null;
      this._baseTarget = null;
      return;
    }

    if (rawTarget !== this._baseTarget) {
      this._baseTarget = rawTarget;
      this._depthOffset = 0;
      this._depthNavReady = false;
    }

    const target = this._walkUp(rawTarget, this._depthOffset);

    if (target !== this._currentTarget) {
      this._hidePreview();
    }

    this._currentTarget = target;

    if (this._preview.style.display !== 'none') {
      this._positionPreview(cx, cy);
    }
    this._positionScrollCursor(cx, cy);

    if (!this._hoverTimer) {
      this._startPreviewTimer(target, cx, cy);
    }

    this._updateHighlight(target);
  }

  _onWheelFn(e) {
    if (!this._baseTarget || !this._depthNavReady) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.deltaY < 0) {
      this._depthOffset++;
    } else if (e.deltaY > 0) {
      this._depthOffset = Math.max(0, this._depthOffset - 1);
    }

    const target = this._walkUp(this._baseTarget, this._depthOffset);

    let actual = 0;
    let node = this._baseTarget;
    while (node !== target) {
      node = node.parentElement;
      actual++;
    }
    this._depthOffset = actual;

    if (target !== this._currentTarget) {
      this._hidePreview();
      this._currentTarget = target;
      this._startPreviewTimer(target, e.clientX, e.clientY);
    } else {
      this._updateDepthNav();
    }

    this._updateHighlight(target);
  }

  async _onClickFn(e) {
    if (this._converting) return;
    if (!this._currentTarget || (this._isOwnElement(e.target) && e.target !== this._shield)) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const element = this._currentTarget;

    if (this._cachedSvgString) {
      this._pinPreview(element, this._cachedSvgString);
      return;
    }

    clearTimeout(this._hoverTimer);
    this._hoverTimer = null;
    this._previewAbort?.abort();
    this._previewAbort = null;

    document.removeEventListener('mousemove', this._onMouseMove, true);
    document.removeEventListener('wheel', this._onWheel, true);
    document.removeEventListener('click', this._onClick, true);
    this._highlight.style.display = 'none';
    this._tooltip.style.display = 'none';

    if (this._preview.style.display === 'none') {
      this._preview.style.display = 'block';
      const rect = element.getBoundingClientRect();
      this._preview.style.left = (rect.left + rect.width / 2) + 'px';
      this._preview.style.top = (rect.top + rect.height / 2) + 'px';
    }
    this._loader.style.display = 'flex';
    this._loaderLabel.textContent = 'Converting\u2026';
    this._loaderBar.classList.add('ets-loader-bar-pulse');

    this._converting = true;
    try {
      const svgString = await convertElementToSVG(element, this.adapter);
      this._loaderBar.classList.remove('ets-loader-bar-pulse');
      this._loader.style.display = 'none';
      const img = document.createElement('img');
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
      this._preview.insertBefore(img, this._loader);
      this._pinPreview(element, svgString);
    } catch (err) {
      console.error('[Web to SVG] Conversion failed:', err);
      this._showToast('SVG conversion failed: ' + err.message);
      this.deactivate();
    } finally {
      this._converting = false;
    }
  }

  _onKeyDownFn(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      const openDropdowns = this._preview?.querySelectorAll('.ets-dropdown-open');
      if (openDropdowns?.length) {
        openDropdowns.forEach(d => d.classList.remove('ets-dropdown-open'));
        return;
      }
      this.deactivate();
    }
    if (e.key === 'c' && (e.metaKey || e.ctrlKey) && !e.shiftKey && this._pinned && this._pinnedCopySvg) {
      e.preventDefault();
      e.stopPropagation();
      this._pinnedCopySvg();
    }
  }
}
