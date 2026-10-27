(() => {
  'use strict';
  const WARM_KEY = 'aiTreeMemoryWarm';
  const VISIBLE_KEY = 'voidMemoryEchoVisible';
  const COLLAPSED_KEY = 'voidEchoCollapsed';
  const root = document.getElementById('ai-void-echo');
  if (!root) return;
  const handle = document.getElementById('ai-void-echo-handle');
  const bodyEl = document.getElementById('ai-void-echo-body');
  const patternEl = document.getElementById('ai-void-echo-pattern');
  const titleEl = document.getElementById('ai-void-echo-title');
  const countEl = document.getElementById('ai-void-echo-count');
  let visiblePref = true;
  let collapsed = true;
  let lastHasData = false;

  function label(key, fallback) {
    try { if (typeof t === 'function') { const v = t(key); if (v) return v; } } catch (e) {}
    return fallback;
  }
  function applyDir() {
    try {
      if ((typeof isRTL === 'function' && typeof currentLang !== 'undefined' && isRTL(currentLang)) ||
          (typeof currentLang !== 'undefined' && (currentLang === 'fa' || currentLang === 'ar'))) {
        root.setAttribute('dir', 'rtl');
      } else root.setAttribute('dir', 'ltr');
    } catch (e) { root.setAttribute('dir', 'auto'); }
  }
  function startOfToday() { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); }
  function startOfMonth() { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d.getTime(); }
  /**
   * Echo v2 summariser. Dispatches on sourceType first so goal-progress records
   * never leak into the legacy counters, and splits todo activity into
   * "commitments" (linked to a goal) and everything else.
   *
   *   Kept    = linked task, resolution 'completed'
   *   Missed  = linked task, resolution 'expired-linked'
   *   Dropped = linked task deleted before it expired (neutral: shown, but not
   *             part of the follow-through ratio)
   *
   * Attribution day = resolvedAt (when it happened), not createdAt.
   * 'reopened' / 'restored' are retraction markers written by the todo
   * handlers (un-tick / undo-delete) and are ignored.
   */
  function summarizeToday(rows) {
    const start = startOfToday(), now = Date.now();
    const c = {
      committedKept: 0, committedMissed: 0, committedDropped: 0,
      keptItems: [], missedItems: [],
      progressDelta: 0, progressCount: 0,
      standardDone: 0, standardExpired: 0, standardCleared: 0,
      eventsDone: 0, eventsDeleted: 0,
      visible: 0
    };
    const tag = (r) => r.goalTitleSnapshot ? (r.title + ' \u2190 ' + r.goalTitleSnapshot) : String(r.title || '');
    (rows || []).forEach((r) => {
      if (!r || typeof r.resolvedAt !== 'number') return;
      if (r.resolvedAt < start || r.resolvedAt > now) return;
      if (r.resolution === 'reopened' || r.resolution === 'restored') return;
      const src = r.sourceType || 'todo';

      if (src === 'goalProgress') {
        if (r.resolution !== 'progress-moved') return;
        c.progressDelta += (typeof r.delta === 'number' ? r.delta : 0);
        c.progressCount += 1;
        return;
      }
      if (src === 'event') {
        if (r.resolution === 'completed') c.eventsDone += 1; else c.eventsDeleted += 1;
        c.visible += 1;
        return;
      }
      if (src === 'markedDay') { c.standardCleared += 1; c.visible += 1; return; }
      if (src !== 'todo') return;
      // A whole goal being deleted is a different signal; its linked children
      // are archived on their own.
      if (r.type === 'goal') return;

      if (r.linkedGoalId) {
        if (r.resolution === 'completed') { c.committedKept += 1; c.keptItems.push(tag(r)); }
        else if (r.resolution === 'expired-linked' || r.resolution === 'expired') { c.committedMissed += 1; c.missedItems.push(tag(r)); }
        else c.committedDropped += 1;
        c.visible += 1;
      } else {
        if (r.resolution === 'completed') c.standardDone += 1;
        else if (r.resolution === 'expired') c.standardExpired += 1;
        else c.standardCleared += 1;
        c.visible += 1;
      }
    });
    return c;
  }
  function summarizeMonth(rows) {
    const start = startOfMonth(), now = Date.now();
    const s = { total: 0, completed: 0, bySource: { todo: 0, event: 0, markedDay: 0 } };
    (rows || []).forEach((r) => {
      if (!r || typeof r.resolvedAt !== 'number') return;
      if (r.resolvedAt < start || r.resolvedAt > now) return;
      // Goal-progress deltas and retraction markers are state changes, not activity.
      if (r.sourceType === 'goalProgress' || r.resolution === 'reopened' || r.resolution === 'restored') return;
      s.total += 1;
      if (r.resolution === 'completed') s.completed += 1;
      if (r.sourceType && s.bySource[r.sourceType] != null) s.bySource[r.sourceType] += 1;
    });
    return s;
  }
  function dominantKey(map) {
    let best = null, n = 0;
    Object.keys(map).forEach((k) => { if (map[k] > n) { n = map[k]; best = k; } });
    return n > 0 ? { key: best, count: n } : null;
  }
  function applyCollapsed() {
    root.classList.toggle('is-collapsed', collapsed);
    if (handle) handle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  }
  function setCollapsed(next) {
    if (root.classList.contains('ai-void-is-dissolved')) return;
    collapsed = !!next;
    applyCollapsed();
    try { chrome.storage.local.set({ [COLLAPSED_KEY]: collapsed }); } catch (e) {}
  }
  function applyVisibility(hasData) {
    lastHasData = hasData;
    let dissolved = !!(window.VoidDissolve && VoidDissolve.isDissolved('echo'));
    if (!dissolved && root.dataset && root.dataset.voidBootDissolved === '1') {
      try { delete root.dataset.voidBootDissolved; } catch (e) {}
    } else if (!window.VoidDissolve && root.dataset && root.dataset.voidBootDissolved === '1') {
      dissolved = true;
    }
    const show = visiblePref;
    if (dissolved) {
      // Keep layout slot under stage so Goals does not jump up
      root.hidden = false;
      root.classList.add('ai-void-is-dissolved');
      root.setAttribute('aria-hidden', 'true');
    } else if (!show) {
      root.classList.remove('ai-void-is-dissolved');
      root.hidden = true;
      root.setAttribute('aria-hidden', 'true');
    } else {
      root.classList.remove('ai-void-is-dissolved');
      root.hidden = false;
      root.removeAttribute('hidden');
      root.setAttribute('aria-hidden', 'false');
    }
  }
  function num(n) {
    try { if (typeof localizeDigits === 'function') return localizeDigits(String(n)); } catch (e) {}
    return String(n);
  }
  function chip(cls, text, tip) {
    const span = document.createElement('span');
    span.className = 'ai-void-echo-chip ai-void-echo-chip--' + cls;
    span.textContent = text;
    if (tip) span.title = tip;
    return span;
  }
  function column(titleKey, titleFallback, cls) {
    const col = document.createElement('div');
    col.className = 'ai-void-echo-col ' + cls;
    const h = document.createElement('div');
    h.className = 'ai-void-echo-col-title';
    h.textContent = label(titleKey, titleFallback);
    col.appendChild(h);
    return col;
  }
  function tipList(items) { return items.slice(0, 8).join('\n'); }

  // Two columns: Commitments (goal-linked work) and Other (everything else).
  // Follow-through = kept / (kept + missed); hidden when there were no
  // commitments, so a day without linked tasks never reads as 0% or 100%.
  function renderTodayBody(c) {
    bodyEl.innerHTML = '';
    const denom = c.committedKept + c.committedMissed;
    const hasProgress = c.progressCount > 0 && c.progressDelta !== 0;

    if (denom > 0 || hasProgress || c.committedDropped > 0) {
      const col = column('voidEchoColCommitments', 'Commitments', 'ai-void-echo-col-commit');
      if (c.committedKept > 0)
        col.appendChild(chip('done', label('voidEchoKept', '{n} kept').replace('{n}', num(c.committedKept)), tipList(c.keptItems)));
      if (c.committedMissed > 0)
        col.appendChild(chip('missed', label('voidEchoMissed', '{n} missed').replace('{n}', num(c.committedMissed)), tipList(c.missedItems)));
      if (c.committedDropped > 0)
        col.appendChild(chip('cleared', label('voidEchoDropped', '{n} dropped').replace('{n}', num(c.committedDropped))));
      if (hasProgress) {
        const d = c.progressDelta;
        col.appendChild(chip(d > 0 ? 'progress' : 'cleared',
          label('voidEchoProgress', 'Progress {sign}{d}%')
            .replace('{sign}', d > 0 ? '+' : '\u2212').replace('{d}', num(Math.abs(d)))));
      }
      if (denom > 0) {
        const ratio = document.createElement('div');
        ratio.className = 'ai-void-echo-ratio';
        ratio.textContent = label('voidEchoFollowThrough', 'Follow-through: {p}%')
          .replace('{p}', num(Math.round((c.committedKept / denom) * 100)));
        col.appendChild(ratio);
      }
      bodyEl.appendChild(col);
    }

    const ev = c.eventsDone + c.eventsDeleted;
    if (c.standardDone + c.standardExpired + c.standardCleared + ev > 0) {
      const col = column('voidEchoColOther', 'Other', 'ai-void-echo-col-noise');
      if (c.standardDone > 0)
        col.appendChild(chip('done', label('voidEchoTasksDone', '{n} tasks done').replace('{n}', num(c.standardDone))));
      if (c.standardExpired > 0)
        col.appendChild(chip('cleared', label('voidEchoTasksExpired', '{n} expired').replace('{n}', num(c.standardExpired))));
      if (c.standardCleared > 0)
        col.appendChild(chip('cleared', label('voidEchoCleared', '{n} cleared').replace('{n}', num(c.standardCleared))));
      if (ev > 0)
        col.appendChild(chip('event', label('voidEchoEvents', '{n} events').replace('{n}', num(ev))));
      bodyEl.appendChild(col);
    }
  }

  function render(today, month) {
    applyDir();
    if (titleEl) titleEl.textContent = label('voidEchoTitle', "Today's Echo");
    if (countEl) {
      countEl.textContent = today.visible > 0 ? num(today.visible) : '';
      countEl.hidden = today.visible <= 0;
    }
    if (bodyEl) renderTodayBody(today);
    if (patternEl) {
      let patternText = '';
      if (month.total >= 3) {
        const domSource = dominantKey(month.bySource);
        const parts = [];
        if (month.completed > 0) parts.push(label('voidPatternCompleted', '{n} completed this month').replace('{n}', String(month.completed)));
        if (domSource && domSource.count >= 2) {
          const sourceLabel = domSource.key === 'event' ? label('voidPatternSourceEvent', 'events')
            : domSource.key === 'markedDay' ? label('voidPatternSourceMark', 'special days')
            : label('voidPatternSourceTodo', 'tasks');
          parts.push(label('voidPatternMostly', 'mostly {what}').replace('{what}', sourceLabel));
        }
        if (parts.length) patternText = parts.join(' · ');
      }
      patternEl.textContent = patternText;
      patternEl.hidden = !patternText;
    }
    applyCollapsed();
    applyVisibility(today.visible > 0 || today.progressCount > 0 || month.total >= 3);
  }
  function loadAndRender() {
    try {
      chrome.storage.local.get([WARM_KEY, VISIBLE_KEY, COLLAPSED_KEY], (res) => {
        if (chrome.runtime && chrome.runtime.lastError) { applyVisibility(false); return; }
        if (typeof res[VISIBLE_KEY] === 'boolean') visiblePref = res[VISIBLE_KEY];
        if (typeof res[COLLAPSED_KEY] === 'boolean') collapsed = res[COLLAPSED_KEY];
        const rows = Array.isArray(res[WARM_KEY]) ? res[WARM_KEY] : [];
        render(summarizeToday(rows), summarizeMonth(rows));
      });
    } catch (e) { applyVisibility(false); }
  }
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && (changes[WARM_KEY] || changes[VISIBLE_KEY] || changes[COLLAPSED_KEY])) loadAndRender();
      if (changes.appLanguage) {
        try { currentLang = changes.appLanguage.newValue || 'en'; } catch (e) {}
        loadAndRender();
        wireMenu();
      }
    });
  } catch (e) {}
  if (handle) {
    handle.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setCollapsed(!collapsed); });
    handle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCollapsed(!collapsed); }
    });
  }
  function wireMenu() {
    const btn = document.getElementById('ai-ntp-menu-echo');
    if (!btn) return;
    const sync = () => {
      const on = window.VoidDissolve
        ? !VoidDissolve.isDissolved('echo') && visiblePref
        : visiblePref;
      btn.setAttribute('data-on', on ? '1' : '0');
      const labelEl = document.getElementById('ai-ntp-menu-echo-label');
      if (labelEl) labelEl.textContent = label('voidEchoTitle', "Today's Echo");
      const dissolveBtn = document.getElementById('ai-void-echo-dissolve');
      if (dissolveBtn) {
        const dt = label('voidDissolveBtn', 'Dissolve into stars');
        dissolveBtn.title = dt;
        dissolveBtn.setAttribute('aria-label', dt);
      }
    };
    sync();
    if (btn.dataset.wired === '1') return;
    btn.dataset.wired = '1';
    btn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      // Same path as ◎ — dissolve into stars / restore from singularity
      if (window.VoidDissolve) {
        if (VoidDissolve.isDissolved('echo') || !visiblePref) {
          if (VoidDissolve.isDissolved('echo')) {
            try { VoidDissolve.restore('echo'); } catch (err) {}
          } else {
            visiblePref = true;
            try { chrome.storage.local.set({ [VISIBLE_KEY]: true }); } catch (err) {}
            applyVisibility(lastHasData);
          }
        } else {
          try { VoidDissolve.dissolve('echo'); } catch (err) {}
        }
        setTimeout(sync, 50);
        setTimeout(sync, 800);
        return;
      }
      visiblePref = !visiblePref;
      try { chrome.storage.local.set({ [VISIBLE_KEY]: visiblePref }); } catch (err) {}
      sync();
      applyVisibility(lastHasData);
    });
  }

  function wireEchoDissolve() {
    const trigger = document.getElementById('ai-void-echo-dissolve');
    if (!window.VoidDissolve || !root) return;
    if (trigger) {
      trigger.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
    }
    VoidDissolve.register('echo', {
      el: root,
      label: (typeof label === 'function' ? label('voidEchoTitle', "Today's Echo") : "Today's Echo"),
      trigger: trigger || null,
      onHide: function () {
        visiblePref = false;
        try { chrome.storage.local.set({ [VISIBLE_KEY]: false }); } catch (e) {}
        const btn = document.getElementById('ai-ntp-menu-echo');
        if (btn) btn.setAttribute('data-on', '0');
      },
      onShow: function () {
        visiblePref = true;
        try { delete root.dataset.voidBootDissolved; } catch (e) {}
        root.classList.remove('ai-void-is-dissolved');
        try { chrome.storage.local.set({ [VISIBLE_KEY]: true }); } catch (e) {}
        // Force a visibility pass; if data is still loading, show shell until render fills it
        if (!lastHasData) {
          root.hidden = false;
          root.removeAttribute('hidden');
          root.setAttribute('aria-hidden', 'false');
        }
        applyVisibility(lastHasData || true);
        const btn = document.getElementById('ai-ntp-menu-echo');
        if (btn) btn.setAttribute('data-on', '1');
      }
    });
  }
  try { wireEchoDissolve(); } catch (e) {}
  try {
    window.addEventListener('void-dissolve-ready', function onDissolveReady() {
      applyVisibility(lastHasData);
      try { window.removeEventListener('void-dissolve-ready', onDissolveReady); } catch (e) {}
    });
  } catch (e) {}


  try {
    chrome.storage.sync.get(['appLanguage'], (syncRes) => {
      const fromSync = syncRes && syncRes.appLanguage;
      chrome.storage.local.get(['appLanguage'], (localRes) => {
        const lang = fromSync || (localRes && localRes.appLanguage);
        if (lang) { try { currentLang = lang; } catch (e) {} }
        wireMenu();
        loadAndRender();
      });
    });
  } catch (e) {
    wireMenu();
    loadAndRender();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadAndRender(); });
})();
