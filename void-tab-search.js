// Multi-engine web search for Void Tab — same engines as the extension
// search panel (Google / Bing / DuckDuckGo / Brave + custom).
//
// Google has optional modes (classic | ai). Other engines stay single-submit.
// Sync keys: webSearchEngine, webSearchModes, webSearchEngineOverrides, webSearchCustomEngines
(() => {
  'use strict';

  const BUILTIN = [
    { id: 'google', label: 'Google', template: 'https://www.google.com/search?q={q}', accent: '#8ab4f8' },
    { id: 'bing', label: 'Bing', template: 'https://www.bing.com/search?q={q}', accent: '#4ec3f7' },
    { id: 'duckduckgo', label: 'DuckDuckGo', template: 'https://duckduckgo.com/?q={q}', accent: '#de5833' },
    { id: 'brave', label: 'Brave', template: 'https://search.brave.com/search?q={q}', accent: '#fb542b' }
  ];

  // AI-capable engines: Google AI Mode (udm=50) + Bing Copilot Search.
  // Override templates via webSearchEngineOverrides['google:ai'] / ['bing:ai'] if needed.
  // Both AI endpoints are undocumented — re-test by hand if behaviour drifts.
  const ENGINE_MODES = {
    google: {
      classic: { label: 'Search', template: 'https://www.google.com/search?q={q}' },
      ai: { label: 'AI', template: 'https://www.google.com/search?q={q}&udm=50' }
    },
    bing: {
      classic: { label: 'Search', template: 'https://www.bing.com/search?q={q}' },
      ai: { label: 'AI', template: 'https://www.bing.com/copilotsearch?q={q}' }
    }
  };

  const root = document.getElementById('ai-void-search');
  const brand = document.getElementById('ai-void-search-brand');
  const brandName = document.getElementById('ai-void-search-brand-name');
  const input = document.getElementById('ai-void-search-input');
  const goBtn = document.getElementById('ai-void-search-go');
  const dots = document.getElementById('ai-void-search-dots');
  const prevBtn = document.getElementById('ai-void-search-prev');
  const nextBtn = document.getElementById('ai-void-search-next');
  const form = document.getElementById('ai-void-search-form');
  if (!root || !brand || !brandName || !input || !goBtn || !dots) return;
  try { if (window.AIVoidEngineMarks && AIVoidEngineMarks.preloadAll) AIVoidEngineMarks.preloadAll(); } catch (_) {}
  // Ensure go button uses search icon (not a text arrow)
  if (goBtn && (!goBtn.querySelector('svg') || (goBtn.textContent || '').trim() === '→')) {
    goBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16.2 16.2L21 21"/></svg>';
  }

  // Ensure mode button exists (inject if HTML was not updated)
  let modeBtn = document.getElementById('ai-void-search-mode');
  if (!modeBtn && form) {
    modeBtn = document.createElement('button');
    modeBtn.type = 'button';
    modeBtn.id = 'ai-void-search-mode';
    modeBtn.innerHTML =
      '<span class="ai-mode-glyph" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>' +
          '<circle cx="12" cy="12" r="4.2"/>' +
          '<path d="M12 8.2c1.4 0 2.6.8 3.2 2"/>' +
        '</svg>' +
      '</span>' +
      '<span class="ai-mode-label">AI</span>' +
      '<span class="ai-mode-state">Off</span>';
    modeBtn.setAttribute('aria-pressed', 'false');
    modeBtn.title = 'Toggle AI Mode';
    modeBtn.hidden = true;
    if (goBtn.parentNode === form) form.insertBefore(modeBtn, goBtn);
    else form.appendChild(modeBtn);
  }

  let engines = BUILTIN.map((e) => Object.assign({}, e));
  let activeId = 'google';
  let index = 0;
  let modes = {};

  function current() { return engines[index] || engines[0]; }

  function findIndex(id) {
    const i = engines.findIndex((e) => e.id === id);
    return i >= 0 ? i : 0;
  }

  function hasModes(engineId) {
    return !!(ENGINE_MODES[engineId] && Object.keys(ENGINE_MODES[engineId]).length > 1);
  }

  function getMode(engineId) {
    const m = modes[engineId];
    if (m && ENGINE_MODES[engineId] && ENGINE_MODES[engineId][m]) return m;
    return 'classic';
  }

  function setMode(engineId, mode) {
    if (!hasModes(engineId)) return;
    if (!ENGINE_MODES[engineId][mode]) return;
    modes[engineId] = mode;
    try { chrome.storage.local.set({ webSearchModes: Object.assign({}, modes) }); } catch (e) {}
    applyModeUI();
  }

  function toggleMode() {
    const eng = current();
    if (!hasModes(eng.id)) return;
    const next = getMode(eng.id) === 'ai' ? 'classic' : 'ai';
    // Global sticky: same AI preference for every engine that supports modes
    Object.keys(ENGINE_MODES).forEach(function (id) {
      modes[id] = next;
    });
    try { chrome.storage.local.set({ webSearchModes: Object.assign({}, modes) }); } catch (e) {}
    applyModeUI();
  }

  function resolveTemplate(engine, oneShotMode) {
    const engId = engine && engine.id;
    const useMode = oneShotMode || (hasModes(engId) ? getMode(engId) : null);

    if (useMode && useMode !== 'classic') {
      if (engine._modeOverrides && engine._modeOverrides[useMode]) {
        return engine._modeOverrides[useMode];
      }
      if (ENGINE_MODES[engId] && ENGINE_MODES[engId][useMode]) {
        return ENGINE_MODES[engId][useMode].template;
      }
    }
    return (engine && engine.template) || 'https://www.google.com/search?q={q}';
  }

  function buildUrl(engine, query, oneShotMode) {
    const q = encodeURIComponent(query);
    const tpl = resolveTemplate(engine, oneShotMode);
    if (tpl.indexOf('{q}') >= 0) return tpl.split('{q}').join(q);
    return tpl + q;
  }

  function doSearch(oneShotMode) {
    const q = (input.value || '').trim();
    if (!q) { input.focus(); return; }
    window.location.href = buildUrl(current(), q, oneShotMode);
  }

  function renderDots() {
    dots.innerHTML = '';
    engines.forEach((eng, i) => {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'ai-void-search-dot' + (i === index ? ' is-active' : '');
      d.title = eng.label;
      d.setAttribute('aria-label', eng.label);
      d.addEventListener('click', (e) => { e.stopPropagation(); setIndex(i); });
      dots.appendChild(d);
    });
  }

  function applyModeUI() {
    const eng = current();
    const show = hasModes(eng.id);
    if (modeBtn) {
      if (show) {
        modeBtn.hidden = false;
        modeBtn.removeAttribute('hidden');
        const isAi = getMode(eng.id) === 'ai';
        modeBtn.classList.toggle('is-ai', isAi);
        modeBtn.setAttribute('aria-pressed', String(isAi));
        // Keep structure: glyph + label + state chip
        let stateEl = modeBtn.querySelector('.ai-mode-state');
        let labelEl = modeBtn.querySelector('.ai-mode-label');
        if (!labelEl || !stateEl) {
          modeBtn.innerHTML =
            '<span class="ai-mode-glyph" aria-hidden="true">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>' +
                '<circle cx="12" cy="12" r="4.2"/>' +
                '<path d="M12 8.2c1.4 0 2.6.8 3.2 2"/>' +
              '</svg>' +
            '</span>' +
            '<span class="ai-mode-label">AI</span>' +
            '<span class="ai-mode-state"></span>';
          stateEl = modeBtn.querySelector('.ai-mode-state');
          labelEl = modeBtn.querySelector('.ai-mode-label');
        }
        if (stateEl) stateEl.textContent = isAi ? 'On' : 'Off';
        modeBtn.title = isAi
          ? 'AI Mode on — click for classic search (Ctrl/⌘+Enter = one-shot classic)'
          : 'AI Mode off — click to enable (Ctrl/⌘+Enter = one-shot AI)';
        modeBtn.setAttribute('aria-label', (isAi ? 'AI on' : 'AI off') + ' — ' + (eng.label || eng.id));
      } else {
        modeBtn.hidden = true;
        modeBtn.setAttribute('hidden', '');
        modeBtn.classList.remove('is-ai');
        modeBtn.setAttribute('aria-pressed', 'false');
      }
    }
    if (eng.id === 'google' && getMode('google') === 'ai') {
      input.placeholder = 'Ask with AI Mode…';
    } else {
      input.placeholder = 'Search with ' + eng.label + '…';
    }
    root.dataset.mode = show ? getMode(eng.id) : '';
    root.dataset.engine = eng.id;
  }


  function homepageOf(engine) {
    if (!engine || typeof engine.template !== 'string') return null;
    try {
      const u = new URL(engine.template.split('{q}').join('x'));
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
      return u.origin + '/';
    } catch (_) {
      return null;
    }
  }

  function mountEngineLink(host, engine) {
    if (!host) return;
    try {
      const prev = host.querySelector('a[data-engine-link]');
      if (prev) prev.remove();
    } catch (_) {}

    const href = homepageOf(engine);
    if (!href) {
      host.style.cursor = '';
      return;
    }

    const a = document.createElement('a');
    a.dataset.engineLink = engine.id || 'engine';
    a.className = 'ai-void-engine-link';
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.draggable = false;
    const name = (engine && engine.label) || 'engine';
    const label = 'Open ' + name;
    a.setAttribute('aria-label', label);
    a.title = label;

    // Only stop engine-cycle handlers. Do NOT preventDefault and do NOT
    // also call window.open — that opened two tabs (native target=_blank + open).
    a.addEventListener('pointerdown', function (e) {
      e.stopPropagation();
    }, true);
    a.addEventListener('click', function (e) {
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    }, true);
    a.addEventListener('auxclick', function (e) {
      e.stopPropagation();
    }, true);

    host.appendChild(a);
    host.style.cursor = 'pointer';
  }

  function applyEngineUI(opts) {
    const eng = current();
    activeId = eng.id;
    brandName.textContent = eng.label;
    brand.dataset.engine = eng.id;
    brand.style.setProperty('--engine-accent', eng.accent || '#a5b4fc');
    root.style.setProperty('--engine-accent', eng.accent || '#a5b4fc');
    try {
      const markHost = brand.querySelector('.ai-void-search-brand-mark');
      if (window.AIVoidEngineMarks && typeof AIVoidEngineMarks.mount === 'function') {
        AIVoidEngineMarks.mount(markHost, eng);
      }
    } catch (_) {}
    if (!(opts && opts.skipPulse)) {
      brand.classList.remove('ai-void-search-brand-pulse');
      void brand.offsetWidth;
      brand.classList.add('ai-void-search-brand-pulse');
    }
    renderDots();
    applyModeUI();
  }

  function setIndex(i, opts) {
    if (!engines.length) return;
    const n = engines.length;
    index = ((i % n) + n) % n;
    activeId = current().id;
    try { chrome.storage.local.set({ webSearchEngine: activeId }); } catch (e) {}
    applyEngineUI(opts);
  }

  function prev() { setIndex(index - 1); }
  function next() { setIndex(index + 1); }

  function loadEngines() {
    try {
      chrome.storage.local.get(
        ['webSearchEngine', 'webSearchEngineOverrides', 'webSearchCustomEngines', 'webSearchModes'],
        (data) => {
          const overrides = (data && data.webSearchEngineOverrides && typeof data.webSearchEngineOverrides === 'object')
            ? data.webSearchEngineOverrides : {};

          engines = BUILTIN.map((e) => {
            const o = overrides[e.id];
            const copy = Object.assign({}, e);
            copy._modeOverrides = {};
            if (o && typeof o === 'object') {
              if (typeof o.label === 'string' && o.label.trim()) copy.label = o.label.trim().slice(0, 24);
              if (typeof o.template === 'string' && /^https?:\/\//i.test(o.template) && o.template.includes('{q}')) {
                copy.template = o.template;
              }
            }
            Object.keys(overrides).forEach((key) => {
              if (key.indexOf(e.id + ':') === 0) {
                const modeName = key.slice(e.id.length + 1);
                const ov = overrides[key];
                if (ov && typeof ov === 'object' && typeof ov.template === 'string' && ov.template.includes('{q}')) {
                  copy._modeOverrides[modeName] = ov.template;
                } else if (typeof ov === 'string' && ov.includes('{q}')) {
                  copy._modeOverrides[modeName] = ov;
                }
              }
            });
            return copy;
          });

          if (Array.isArray(data && data.webSearchCustomEngines)) {
            data.webSearchCustomEngines.forEach((c) => {
              if (!c || typeof c.id !== 'string' || typeof c.label !== 'string' || typeof c.template !== 'string') return;
              if (!/^https?:\/\//i.test(c.template) || !c.template.includes('{q}')) return;
              engines.push({
                id: c.id,
                label: String(c.label).slice(0, 24),
                template: c.template,
                accent: c.accent || '#a5b4fc'
              });
            });
          }

          if (data && data.webSearchModes && typeof data.webSearchModes === 'object') {
            modes = Object.assign({}, data.webSearchModes);
          }

          if (data && data.webSearchEngine) activeId = data.webSearchEngine;
          index = findIndex(activeId);
          applyEngineUI({ skipPulse: true });
        }
      );
    } catch (e) { applyEngineUI({ skipPulse: true }); }
  }

  if (form) form.addEventListener('submit', (e) => e.preventDefault());
  goBtn.addEventListener('click', (e) => { e.preventDefault(); doSearch(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && hasModes(current().id)) {
        const alt = getMode(current().id) === 'ai' ? 'classic' : 'ai';
        doSearch(alt);
      } else {
        doSearch();
      }
    } else if (e.key === 'ArrowLeft' && (e.altKey || e.metaKey || input.selectionStart === 0)) {
      e.preventDefault(); prev();
    } else if (e.key === 'ArrowRight' && (e.altKey || e.metaKey || input.selectionStart === input.value.length)) {
      e.preventDefault(); next();
    }
  });
  if (prevBtn) prevBtn.addEventListener('click', (e) => { e.preventDefault(); prev(); });
  if (nextBtn) nextBtn.addEventListener('click', (e) => { e.preventDefault(); next(); });
  if (modeBtn) {
    modeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleMode();
    });
  }

  let touchStartX = 0, touchStartY = 0, touching = false;
  root.addEventListener('touchstart', (e) => {
    if (!e.touches || !e.touches[0]) return;
    touching = true;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  root.addEventListener('touchend', (e) => {
    if (!touching) return;
    touching = false;
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0) next(); else prev();
  }, { passive: true });

  let ptrStartX = 0, ptrActive = false;
  function isMarkTarget(t) {
    try {
      return !!(t && t.closest && (
        t.closest('a[data-engine-link]') ||
        t.closest('.ai-void-search-brand-mark')
      ));
    } catch (_) { return false; }
  }
  brand.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (isMarkTarget(e.target)) return; // logo owns this gesture
    ptrActive = true;
    ptrStartX = e.clientX;
    try { brand.setPointerCapture(e.pointerId); } catch (_) {}
  });
  brand.addEventListener('pointerup', (e) => {
    if (!ptrActive) return;
    ptrActive = false;
    if (isMarkTarget(e.target)) return;
    const dx = e.clientX - ptrStartX;
    if (Math.abs(dx) < 36) return;
    if (dx < 0) next(); else prev();
  });
  brand.addEventListener('click', (e) => {
    if (isMarkTarget(e.target)) return;
    next();
  });

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.webSearchEngine || changes.webSearchCustomEngines || changes.webSearchEngineOverrides || changes.webSearchModes) {
        loadEngines();
      }
    });
  } catch (e) {}

  loadEngines();
  setTimeout(() => {
    try {
      if (document.activeElement === document.body || document.activeElement === document.documentElement) {
        input.focus({ preventScroll: true });
      }
    } catch (e) {}
  }, 280);
})();
