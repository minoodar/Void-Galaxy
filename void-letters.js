/* Void Galaxy Music — «پیام‌های کهکشان».
   کلیک روی ناحیهٔ کهکشان یک ستارهٔ موقت در همان نقطه می‌سازد و نامه را در یک
   پنل شیشه‌ای نشان می‌دهد؛ Copy/Share دارد و با کلیک دوبارهٔ ستاره یا Escape
   بسته می‌شود. ویژوالایزر، شیدر و منطق پخش دست‌نخورده‌اند: این ماژول هیچ
   ستاره‌ای به آرایهٔ ویژوالایزر اضافه نمی‌کند. منبع داده و ثبتِ نامه از
   void-letters-api.js می‌آید. مجموعهٔ آزمایشی فقط با
   window.VoidLettersDevDemo === true فعال می‌شود و پیش‌فرض خاموش است. */
(function () {
  'use strict';

  var MAX_POINTS = 500;
  var PLAYER_KEYS = { ' ': 1, k: 1, m: 1, n: 1, p: 1, f: 1, w: 1, ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1 };

  var api = window.VoidLettersApi || null;
  var DEV_DEMO = window.VoidLettersDevDemo === true;
  /* The Worker stores the language of the letter itself, not of the interface. */
  var ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  var LATIN_SCRIPT = /[A-Za-z\u00C0-\u024F]/;

  function detectLang(text) {
    if (ARABIC_SCRIPT.test(text)) return 'fa';
    if (LATIN_SCRIPT.test(text)) return 'en';
    return null;
  }

  /* مجموعهٔ آزمایشی: متن‌های ثابت و واضحاً نمونه. هیچ‌کدام از کاربران واقعی نیستند
     و هیچ‌جا ذخیره نمی‌شوند. لایهٔ داده همان جایی است که فاز بک‌اند جایگزین می‌شود. */
  var DEMO_MESSAGES = [
    { id: 'demo-fa-1', lang: 'fa', text: 'به این کهکشان خوش آمدی. این پیام فقط یک نمونه است؛ ستاره‌ها هنوز نامهٔ واقعی کسی را نگه نمی‌دارند. ✨' },
    { id: 'demo-en-1', lang: 'en', text: 'Some nights the void answers back. Tonight it only says: keep a little wonder for later. 🌌' },
    { id: 'demo-fa-2', lang: 'fa', text: 'اگر جایی گم شدی، نگران نباش؛ گم‌شدن هم بخشی از سفر است. این یک پیام نمونه برای دیدنِ پنل است و ذخیره نمی‌شود.' },
    { id: 'demo-ja-1', lang: 'ja', text: '夜の銀河で、あなたの言葉を待っています。これはサンプルのメッセージです。' },
    { id: 'demo-ar-1', lang: 'ar', text: 'النجوم لا تسأل من أنت؛ فقط تستمع. هذه رسالة تجريبية ولا تُحفظ.' },
    { id: 'demo-en-2', lang: 'en', text: 'This is a longer sample so the panel has something to scroll: a handful of lines about light that takes years to arrive, about messages nobody may ever read, and about the quiet comfort of leaving something behind anyway. Nothing here is real, sent, stored, or shared unless you choose to share it yourself.' },
    { id: 'demo-emoji-1', text: '🌠 · ☾ · 🤍 · ✨' }
  ];

  /* متن ثابتِ اشتراک‌گذاری در X — هرگز متن نامه در آن نیست. */
  var X_LETTER_TEXT = 'I left a star in the galaxy. \u2726 Read it before it fades:';
  var X_LETTER_TEXT_FA = '\u0633\u062a\u0627\u0631\u0647\u200c\u0627\u06cc \u062f\u0631 \u06a9\u0647\u06a9\u0634\u0627\u0646 \u062c\u0627 \u06af\u0630\u0627\u0634\u062a\u0645. \u2726 \u062a\u0627 \u0645\u062d\u0648 \u0646\u0634\u062f\u0647 \u0628\u062e\u0648\u0627\u0646\u06cc\u062f\u0634:';
  var X_INTENT = 'https://twitter.com/intent/tweet?text=';

  /* لایهٔ داده. مسیر production از API واقعی می‌خواند؛ مجموعهٔ آزمایشی فقط با
     فلگ صریح توسعه فعال است و هرگز با دادهٔ production مخلوط نمی‌شود. */
  var source = DEV_DEMO
    ? {
        kind: 'demo',
        tag: 'Demo \u00b7 no real messages yet',
        next: nextDemo,
        submit: null
      }
    : {
        kind: 'api',
        tag: 'From the galaxy',
        next: nextRemote,
        submit: submitRemote
      };

  var el = null;
  var num = null;
  var hideTimer = 0;
  var showFrame = 0;
  var statsPanel = null;
  var statsRead = null;
  var statsOpen = false;
  var statsHoverTimer = 0;
  var pillShown = false;
  var visitorsN = null;
  var rowVisitors = null;
  var rowSessions = null;
  var rowReturned = null;
  var rowLetters = null;
  var letterTotal = null;
  var visitorTotal = null;

  var quillBtn = null;
  var galaxyLayer = null;
  var insetProbeEl = null;

  var panel = null;
  var panelText = null;
  var panelTag = null;
  var panelMeta = null;
  var panelCopy = null;
  var panelShare = null;
  var panelFeedback = null;
  var panelOpen = false;
  var currentMessage = null;
  var starX = 0;
  var starY = 0;
  var anchor = null;
  var ashNodes = [];
  var closeTimer = 0;
  var feedbackTimer = 0;
  var relayoutTimer = 0;

  var compose = null;
  var composeForm = null;
  var composer = null;
  var countEl = null;
  var hintEl = null;
  var ackEl = null;
  var submitBtn = null;
  var noticeEl = null;
  var successEl = null;
  var xShareBtn = null;
  var published = false;
  var shareUrl = null;
  var publishedBase = '';
  var publishedLang = null;
  var sending = false;
  var guardOn = false;
  var pool = [];
  var lastPickId = null;
  var feed = null;
  var remoteStarted = false;
  var successTitle = null;
  var successNote = null;
  var cooldownTimer = 0;
  var cooldownUntil = 0;

  function findRoot() {
    try {
      if (window.VoidMusic && typeof window.VoidMusic.getRoot === 'function') {
        var r = window.VoidMusic.getRoot();
        if (r) return r;
      }
    } catch (e) {}
    return document.getElementById('void-music-root');
  }

  function make(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function isShownBox(n) {
    if (!n) return false;
    var cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    var r = n.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  }

  /* ---- تبلتِ آمار کهکشان: بازدیدکننده‌ها و نامه‌ها در یک جا ------------------
     همان نشانگرِ پایین‌راست، ولی حالا دکمه‌ای است که هر دو عدد را نشان می‌دهد و
     با کلیک/هاور پنلی کوچک باز می‌کند: افراد، سشن‌ها، درصد بازگشت و نامه‌های
     فعال. داده‌ها همان‌هایی هستند که از قبل وجود دارند: void-counter.js آمار
     بازدید را می‌گیرد و از طریق رویداد voidcounter:stats منتشر می‌کند، و
     /letters/count تعداد نامه‌ها را می‌دهد. هیچ endpoint یا درخواست تازه‌ای
     ساخته نمی‌شود. */
  function fmt(n) {
    return new Intl.NumberFormat('en-US').format(Math.max(0, Math.floor(Number(n) || 0)));
  }

  function statRow(label, value) {
    var row = make('div', 'vm-gs-row');
    var b = make('b', null, value);
    row.appendChild(b);
    row.appendChild(make('span', null, label));
    return { row: row, value: b };
  }

  function buildBadge(host) {
    if (el) return;
    el = document.createElement('button');
    el.id = 'void-galaxy-stats';
    el.className = 'vm-gs';
    el.type = 'button';
    el.hidden = true;
    el.setAttribute('aria-haspopup', 'dialog');
    el.setAttribute('aria-expanded', 'false');
    el.setAttribute('aria-controls', 'void-galaxy-stats-panel');
    el.setAttribute('aria-label', 'Galaxy statistics');
    el.setAttribute('title', 'Galaxy statistics');
    var dot = make('span', 'vm-gs__dot');
    dot.setAttribute('aria-hidden', 'true');
    var people = make('span', 'vm-gs__fig');
    visitorsN = make('span', 'vm-gs__n', '\u2014');
    people.appendChild(visitorsN);
    people.appendChild(make('span', 'vm-gs__l', 'explorers'));
    var sep = make('span', 'vm-gs__sep');
    sep.setAttribute('aria-hidden', 'true');
    var letters = make('span', 'vm-gs__fig');
    num = make('span', 'vm-gs__n', '\u2014');
    letters.appendChild(num);
    letters.appendChild(make('span', 'vm-gs__l', 'letters'));
    el.appendChild(dot);
    el.appendChild(people);
    el.appendChild(sep);
    el.appendChild(letters);
    host.appendChild(el);

    statsPanel = make('div', 'vm-gs-panel');
    statsPanel.id = 'void-galaxy-stats-panel';
    statsPanel.hidden = true;
    statsPanel.setAttribute('role', 'dialog');
    statsPanel.setAttribute('aria-modal', 'false');
    statsPanel.setAttribute('aria-label', 'Galaxy statistics');
    var r1 = statRow('explorers', '\u2014');
    var r2 = statRow('sessions', '\u2014');
    var r3 = statRow('returned', '\u2014');
    var r4 = statRow('letters', '\u2014');
    rowVisitors = r1.value;
    rowSessions = r2.value;
    rowReturned = r3.value;
    rowLetters = r4.value;
    statsPanel.appendChild(r1.row);
    statsPanel.appendChild(r2.row);
    statsPanel.appendChild(r3.row);
    statsPanel.appendChild(r4.row);
    statsRead = make('button', 'void-god-btn vm-gs-read', 'No letters yet');
    statsRead.type = 'button';
    statsRead.disabled = true;
    statsPanel.appendChild(statsRead);
    host.appendChild(statsPanel);

    el.addEventListener('click', function () {
      if (statsOpen) closeStats(false);
      else openStats();
    });
    el.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'touch') return;
      clearTimeout(statsHoverTimer);
      statsHoverTimer = setTimeout(openStats, 140);
    });
    el.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'touch') return;
      clearTimeout(statsHoverTimer);
      statsHoverTimer = setTimeout(function () { closeStats(false); }, 1200);
    });
    statsPanel.addEventListener('pointerenter', function () {
      clearTimeout(statsHoverTimer);
    });
    statsPanel.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'touch') return;
      clearTimeout(statsHoverTimer);
      statsHoverTimer = setTimeout(function () { closeStats(false); }, 1200);
    });
    statsRead.addEventListener('click', readNewest);
    window.addEventListener('resize', function () {
      if (statsOpen) placeStats();
    });
    document.addEventListener('pointerdown', function (e) {
      if (!statsOpen) return;
      if (el.contains(e.target) || statsPanel.contains(e.target)) return;
      closeStats(false);
    }, true);
    /* از این لحظه تنها سطح آمار همین دکمه است؛ ویجت قدیمی باید کنار برود،
       حتی اگر داده‌اش پیش از ساخته‌شدنِ این دکمه رسیده باشد. */
    try { if (typeof window.VoidCounterSync === 'function') window.VoidCounterSync(); } catch (e) {}
  }

  function showPill() {
    if (!el || pillShown) return;
    pillShown = true;
    el.hidden = false;
    try { if (typeof window.VoidCounterSync === 'function') window.VoidCounterSync(); } catch (e) {}
    if (showFrame) cancelAnimationFrame(showFrame);
    showFrame = requestAnimationFrame(function () {
      showFrame = 0;
      if (el && !el.hidden) el.classList.add('is-on');
    });
  }

  /* پنل آمار به دکمه می‌چسبد ولی جای‌گذاری‌اش مثل پنلِ نامه است: بین چند
     کاندید، آن جایی انتخاب می‌شود که کمترین هم‌پوشانی با کنترل‌های صفحه
     (ستون آیکن‌ها، قلم، گوشه‌ها، خودِ دکمه) را دارد. */
  function placeStats() {
    if (!statsPanel || !el) return;
    var r = el.getBoundingClientRect();
    var W = statsPanel.offsetWidth, H = statsPanel.offsetHeight;
    var m = 10, gap = 8;
    var maxLeft = Math.max(m, window.innerWidth - m - W);
    var maxTop = Math.max(m, window.innerHeight - m - H);
    var cands = [
      { left: r.right - W, top: r.top - H - gap },
      { left: r.right - W, top: r.bottom + gap },
      { left: r.left, top: r.top - H - gap },
      { left: r.left, top: r.bottom + gap },
      { left: r.left - W - gap, top: r.bottom - H },
      { left: r.right + gap, top: r.bottom - H }
    ];
    var obs = obstacleRects();
    obs.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, weight: 10 });
    var best = null, bestArea = Infinity, bestOff = Infinity;
    for (var i = 0; i < cands.length; i++) {
      var left = clamp(cands[i].left, m, maxLeft);
      var top = clamp(cands[i].top, m, maxTop);
      var rect = { left: left, top: top, right: left + W, bottom: top + H };
      var area = 0;
      for (var j = 0; j < obs.length; j++) area += overlapArea(rect, obs[j]);
      var off = Math.abs(left - cands[i].left) + Math.abs(top - cands[i].top);
      if (area < bestArea - 0.5 || (area <= bestArea + 0.5 && off < bestOff)) {
        bestArea = area;
        bestOff = off;
        best = { left: left, top: top };
      }
    }
    if (!best) best = { left: maxLeft, top: maxTop };
    statsPanel.style.left = Math.round(best.left) + 'px';
    statsPanel.style.top = Math.round(best.top) + 'px';
  }

  function openStats() {
    if (!statsPanel || statsOpen) return;
    statsOpen = true;
    clearTimeout(statsHoverTimer);
    clearTimeout(hideTimer);
    statsPanel.hidden = false;
    el.setAttribute('aria-expanded', 'true');
    placeStats();
    requestAnimationFrame(function () {
      if (statsOpen && statsPanel) statsPanel.classList.add('is-on');
    });
    refreshCount();
  }

  function closeStats(focus) {
    clearTimeout(statsHoverTimer);
    if (!statsOpen) return;
    statsOpen = false;
    statsPanel.classList.remove('is-on');
    el.setAttribute('aria-expanded', 'false');
    setTimeout(function () {
      if (!statsOpen && statsPanel) statsPanel.hidden = true;
    }, 180);
    if (focus) { try { el.focus({ preventScroll: true }); } catch (e) {} }
  }

  function holeCenter() {
    try {
      var V = window.VoidMusicViz && window.VoidMusicViz._test && window.VoidMusicViz._test.V;
      if (V && V.ok && isFinite(V.cx) && isFinite(V.cy)) {
        return { x: Number(V.cx), y: Number(V.cy) };
      }
    } catch (e) {}
    return { x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight * 0.45) };
  }

  function readNewest() {
    if (!letterTotal) return;
    closeStats(true);
    var c = holeCenter();
    openMessageAt(c.x, c.y);
  }

  function hide() {
    if (!el) return false;
    pillShown = false;
    closeStats(false);
    clearTimeout(hideTimer);
    if (showFrame) { cancelAnimationFrame(showFrame); showFrame = 0; }
    el.classList.remove('is-on');
    hideTimer = setTimeout(function () {
      if (el && !el.classList.contains('is-on')) el.hidden = true;
    }, 420);
    return true;
  }

  function setCount(n) {
    if (!mount()) return false;
    clearTimeout(hideTimer);
    n = Math.floor(Number(n));
    var ok = isFinite(n) && n >= 0;
    letterTotal = ok ? n : null;
    num.textContent = ok ? fmt(n) : '\u2014';
    if (rowLetters) rowLetters.textContent = num.textContent;
    if (statsRead) {
      var can = ok && n > 0;
      statsRead.disabled = !can;
      statsRead.textContent = can ? 'Read the newest letter' : 'No letters yet';
      statsRead.title = can ? 'Open the newest letter' : 'The galaxy has no letters yet';
    }
    el.setAttribute('aria-label', 'Galaxy statistics' +
      (ok ? ': ' + n + (n === 1 ? ' letter' : ' letters') : ''));
    showPill();
    return true;
  }

  function setVisitors(s) {
    if (!s) return;
    var u = Number(s.u), t = Number(s.t), r = Number(s.r);
    if (!isFinite(u) || u < 0) return;
    visitorTotal = u;
    if (visitorsN) visitorsN.textContent = fmt(u);
    if (rowVisitors) rowVisitors.textContent = fmt(u);
    if (rowSessions) rowSessions.textContent = isFinite(t) && t >= 0 ? fmt(t) : '\u2014';
    if (rowReturned) rowReturned.textContent = isFinite(r) ? Math.round(r) + '%' : '\u2014';
    showPill();
  }

  /* آمار بازدید را void-counter.js می‌گیرد (با همان /hit و /stats همیشگی)؛
     این‌جا فقط منتظرش می‌مانیم تا ویجتِ دوم ساخته نشود. */
  function listenVisitors() {
    window.addEventListener('voidcounter:stats', function (e) { setVisitors(e.detail); });
    if (window.VoidCounterStats) { setVisitors(window.VoidCounterStats); return; }
    var tries = 0;
    (function poll() {
      if (!window.VoidCounterStats && ++tries < 80) return setTimeout(poll, 250);
      if (window.VoidCounterStats) setVisitors(window.VoidCounterStats);
    })();
  }

  /* ---- شمارشِ نقطه‌های کد (نه واحدهای UTF-16) ---- */
  function codePoints(s) {
    return Array.from(s).length;
  }

  var BAD_CHARS = /[\u202A-\u202E\u2066-\u2069]|[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;

  function updateState() {
    if (!composer) return;
    var text = composer.value;
    var n = codePoints(text);
    var over = n > MAX_POINTS;
    countEl.textContent = n + ' / ' + MAX_POINTS;
    countEl.classList.toggle('is-over', over);
    hintEl.textContent = over
      ? (n - MAX_POINTS) + (n - MAX_POINTS === 1 ? ' code point over the limit.' : ' code points over the limit.')
      : BAD_CHARS.test(text)
        ? 'Remove invisible formatting or control characters.'
        : '';
    syncSubmit();
  }

  function fmtLeft(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return m > 0 ? m + ':' + (s < 10 ? '0' + s : s) : s + 's';
  }

  /* The Worker's retry_after is a whole number of seconds. */
  function startCooldown(seconds) {
    var s = Number(seconds);
    if (!isFinite(s) || s <= 0) return;
    cooldownUntil = Date.now() + Math.min(s, 3600) * 1000;
    if (cooldownTimer) clearInterval(cooldownTimer);
    cooldownTimer = setInterval(function () {
      if (Date.now() >= cooldownUntil) {
        clearInterval(cooldownTimer);
        cooldownTimer = 0;
        cooldownUntil = 0;
      }
      syncSubmit();
    }, 1000);
    syncSubmit();
  }

  function syncSubmit() {
    if (!submitBtn) return;
    submitBtn.setAttribute('aria-busy', sending ? 'true' : 'false');
    var left = Math.ceil((cooldownUntil - Date.now()) / 1000);
    if (sending) {
      submitBtn.textContent = 'Sending\u2026';
      submitBtn.disabled = true;
      return;
    }
    if (left > 0) {
      submitBtn.textContent = 'Try again in ' + fmtLeft(left);
      submitBtn.disabled = true;
      return;
    }
    submitBtn.textContent = 'Submit letter';
    if (published) { submitBtn.disabled = true; return; }
    var text = composer.value;
    var ok = codePoints(text) <= MAX_POINTS && !BAD_CHARS.test(text) &&
      text.trim().length > 0 && !!(ackEl && ackEl.checked);
    submitBtn.disabled = !ok;
  }

  function notice(text) {
    noticeEl.textContent = text;
    noticeEl.hidden = false;
  }

  function restoreFocus(primary) {
    var target = primary && document.contains(primary) ? primary : quillBtn;
    if (target) { try { target.focus({ preventScroll: true }); } catch (e) {} }
  }

  /* ==================================================================
     لایهٔ کلیکِ کهکشان
     بومِ ویژوالایزر pointer-events:none است؛ این لایه یک سطحِ شفاف است که
     داخلِ #void-music-root و پیش از داک/گوشه/عنوان قرار می‌گیرد، پس هر کنترلِ
     تعاملی که بالای آن است کلیک خودش را می‌گیرد و لایه فقط فضای خالیِ کهکشان
     را می‌گیرد. نوارِ پایینِ پلیر و جعبهٔ عنوان از پاسخ مستثنا هستند.
     ================================================================== */
  function buildGalaxy(host) {
    if (galaxyLayer) return;
    galaxyLayer = make('div', 'void-god-galaxy');
    galaxyLayer.id = 'void-god-galaxy';
    galaxyLayer.setAttribute('aria-hidden', 'true');
    host.insertBefore(galaxyLayer, host.firstChild);
    galaxyLayer.addEventListener('click', function (e) {
      if (e.button !== 0) return;
      if (!isGalaxyPoint(e.clientX, e.clientY)) return;
      openMessageAt(e.clientX, e.clientY);
    });
  }

  function insets() {
    if (!insetProbeEl) {
      var host = findRoot();
      if (!host) return { t: 0, r: 0, b: 0, l: 0 };
      insetProbeEl = make('div');
      insetProbeEl.setAttribute('aria-hidden', 'true');
      insetProbeEl.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
        'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
      host.appendChild(insetProbeEl);
    }
    var cs = getComputedStyle(insetProbeEl);
    return {
      t: parseFloat(cs.paddingTop) || 0,
      r: parseFloat(cs.paddingRight) || 0,
      b: parseFloat(cs.paddingBottom) || 0,
      l: parseFloat(cs.paddingLeft) || 0
    };
  }

  function safeTop() {
    return 10 + insets().t;
  }

  /* کفِ ناحیهٔ آزاد: بالای داک (نه روی کنترل‌های پخش). */
  function safeBottom() {
    var limit = window.innerHeight - 10 - insets().b;
    var dockEl = document.querySelector('#void-music-root .vm-dock');
    if (dockEl) {
      var r = dockEl.getBoundingClientRect();
      if (r.height > 1 && r.top < limit) limit = r.top - 10;
    }
    return limit;
  }

  /* The clickable region is the black hole sphere itself, not its bounding
     rectangle or the surrounding galaxy. void-music-viz.js draws that disk at
     (uCenter) with R = uHoleR * uScale, where uHoleR is HOLE_R and uScale is
     V.scale scaled by the camera breath. Reading the same live values keeps the
     circle aligned across viewport sizes and while the camera breathes; without
     a rendered hole (no WebGL / not initialised) the gate stays closed. */
  var HOLE_R = 0.11;

  function holeCircle() {
    try {
      var viz = window.VoidMusicViz;
      var V = viz && viz._test && viz._test.V;
      if (!V || !V.ok) return null;
      var cx = Number(V.cx), cy = Number(V.cy), scale = Number(V.scale);
      if (!isFinite(cx) || !isFinite(cy) || !isFinite(scale) || scale <= 0) return null;
      var b = V.breath || {};
      var mix = isFinite(Number(b.mix)) ? clamp(Number(b.mix), 0, 1) : 0;
      var zoom = isFinite(Number(b.zoom)) ? Number(b.zoom) : 1;
      return { cx: cx, cy: cy, r: HOLE_R * scale * (1 + (zoom - 1) * mix) };
    } catch (e) { return null; }
  }

  function isGalaxyPoint(x, y) {
    var hole = holeCircle();
    if (!hole) return false;
    var dx = x - hole.cx, dy = y - hole.cy;
    return dx * dx + dy * dy <= hole.r * hole.r;
  }

  function overlaps(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  function overlapArea(a, b) {
    var w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    var h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return w > 0 && h > 0 ? w * h : 0;
  }

  /* کنترل‌هایی که ستاره/پنل نباید رویشان بنشیند. وزن ۱۰ کنترلِ تعاملی است
     (هرگز پوشانده نمی‌شود) و وزن ۱ اطلاعاتِ غیرتعاملی (عنوان/وضعیت) که فقط
     اگر جا باشد کنار گذاشته می‌شود. */
  function obstacleRects() {
    var out = [];
    function add(sel, pad, weight) {
      var nodes = document.querySelectorAll(sel);
      for (var k = 0; k < nodes.length; k++) {
        var n = nodes[k];
        if (!isShownBox(n)) continue;
        if (sel === '#void-golden-status' && n.getAttribute('aria-hidden') === 'true') continue;
        var cs = getComputedStyle(n);
        if (parseFloat(cs.opacity) < 0.05) continue;
        var r = n.getBoundingClientRect();
        out.push({
          left: r.left - pad, top: r.top - pad, right: r.right + pad, bottom: r.bottom + pad,
          weight: sel === '#void-golden-status' && !n.classList.contains('is-action') ? 1 : weight
        });
      }
    }
    add('#void-topnav .void-topnav__link', 10, 10);
    add('#void-god-quill', 10, 10);
    add('.vm-corner', 10, 10);
    add('#void-counter', 10, 10);
    add('#void-golden-status', 10, 10);
    add('#void-music-root .vm-meta', 8, 1);
    return out;
  }

  /* نوار وضعیت «Playing» بیرون از ریشه و روی پنل کشیده می‌شود، پس اگر پنل در
     باند افقی‌اش بنشیند متنِ بالای پنل زیرش گم می‌شود؛ تا جای ممکن پایین‌تر از آن
     قرار می‌گیرد. */
  function statusPillBand() {
    var pill = document.querySelector('#void-golden-status');
    if (!isShownBox(pill)) return null;
    if (pill.getAttribute('aria-hidden') === 'true') return null;
    if (pill.classList.contains('is-action')) return null;
    if (parseFloat(getComputedStyle(pill).opacity) < 0.05) return null;
    var r = pill.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top - 8, bottom: r.bottom + 8 };
  }

  function anchorPoint(x, y) {
    var R = 22, m = 8, top = safeTop(), bottom = safeBottom();
    var bx = clamp(x, m + R, window.innerWidth - m - R);
    var by = clamp(y, top + R, Math.max(top + R, bottom - R));
    var obs = obstacleRects();
    var offsets = [[0, 0], [-78, 0], [78, 0], [0, -78], [0, 78], [-78, -60], [78, 60], [0, -140], [0, 140], [78, -140], [-78, 140]];
    for (var i = 0; i < offsets.length; i++) {
      var cx = clamp(bx + offsets[i][0], m + R, window.innerWidth - m - R);
      var cy = clamp(by + offsets[i][1], top + R, Math.max(top + R, bottom - R));
      var rect = { left: cx - R, top: cy - R, right: cx + R, bottom: cy + R };
      var hit = false;
      for (var j = 0; j < obs.length; j++) if (overlaps(rect, obs[j])) { hit = true; break; }
      if (!hit) return { x: cx, y: cy };
    }
    return { x: bx, y: by };
  }

  function nextDemo() {
    if (!pool.length) pool = DEMO_MESSAGES.slice();
    var pick = null;
    for (var guard = 0; guard < 8 && pool.length; guard++) {
      var i = Math.floor(Math.random() * pool.length);
      pick = pool.splice(i, 1)[0];
      if (pick.id !== lastPickId || !pool.length) break;
      pool.push(pick);                                  // بی‌درنگ تکرار نشود
      pick = null;
    }
    if (!pick) pick = pool.pop() || DEMO_MESSAGES[0];
    lastPickId = pick.id;
    return pick;
  }

  /* ---- ستارهٔ موقت ---- */
  function buildAnchorAt(x, y) {
    anchor = make('button', 'void-god-anchor');
    anchor.id = 'void-god-anchor';
    anchor.type = 'button';
    anchor.title = 'Close this message';
    anchor.setAttribute('aria-label', 'Close this message');
    anchor.setAttribute('aria-controls', 'void-god-panel');
    anchor.setAttribute('aria-expanded', 'true');
    var glow = make('span', 'void-god-anchor__glow');
    glow.setAttribute('aria-hidden', 'true');
    var core = make('span', 'void-god-anchor__core');
    core.setAttribute('aria-hidden', 'true');
    anchor.appendChild(glow);
    anchor.appendChild(core);
    anchor.style.left = x + 'px';
    anchor.style.top = y + 'px';
    findRoot().appendChild(anchor);
    anchor.addEventListener('click', function (e) {
      e.stopPropagation();
      var byKeyboard = e.detail === 0;
      closePanel({ dissolve: true, focus: byKeyboard });
    });
  }

  function removeAnchorNow() {
    if (anchor && anchor.parentNode) anchor.parentNode.removeChild(anchor);
    anchor = null;
    var root = findRoot();
    if (root) {
      var dying = root.querySelectorAll('.void-god-anchor');
      for (var k = 0; k < dying.length; k++) if (dying[k].parentNode) dying[k].parentNode.removeChild(dying[k]);
    }
    for (var i = 0; i < ashNodes.length; i++) if (ashNodes[i].parentNode) ashNodes[i].parentNode.removeChild(ashNodes[i]);
    ashNodes = [];
    clearTimeout(closeTimer);
  }

  function spawnAsh(x, y) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var host = findRoot();
    if (!host) return;
    var ash = make('div', 'void-god-ash');
    ash.style.left = x + 'px';
    ash.style.top = y + 'px';
    ash.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 12; i++) {
      var bit = make('span');
      var a = Math.random() * Math.PI * 2;
      var d = 14 + Math.random() * 26;
      bit.style.setProperty('--dx', (Math.cos(a) * d).toFixed(1) + 'px');
      bit.style.setProperty('--dy', (Math.sin(a) * d).toFixed(1) + 'px');
      bit.style.setProperty('--d', (Math.random() * 0.12).toFixed(2) + 's');
      ash.appendChild(bit);
    }
    host.appendChild(ash);
    ashNodes.push(ash);
    setTimeout(function () {
      if (ash.parentNode) ash.parentNode.removeChild(ash);
      var idx = ashNodes.indexOf(ash);
      if (idx >= 0) ashNodes.splice(idx, 1);
    }, 760);
  }

  /* ---- پنل پیام ---- */
  function buildPanel(host) {
    panel = make('div', 'void-god-panel');
    panel.id = 'void-god-panel';
    panel.hidden = true;
    panel.tabIndex = -1;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'void-god-panel-title');
    panel.setAttribute('aria-describedby', 'void-god-panel-text void-god-panel-meta');
    panel.setAttribute('aria-hidden', 'true');

    var head = make('div', 'void-god-head');
    var titles = make('div', 'void-god-titles');
    var h = make('h2', 'void-god-msg-title', 'A message from the galaxy');
    h.id = 'void-god-panel-title';
    panelTag = make('span', 'void-god-msg-tag', source.tag);
    panelTag.id = 'void-god-panel-tag';
    titles.appendChild(h);
    titles.appendChild(panelTag);
    var x = make('button', 'void-god-x', '\u00D7');
    x.type = 'button';
    x.id = 'void-god-panel-close';
    x.setAttribute('aria-label', 'Close message');
    head.appendChild(titles);
    head.appendChild(x);

    panelText = make('p', 'void-god-msg-text');
    panelText.id = 'void-god-panel-text';
    panelText.setAttribute('dir', 'auto');

    panelMeta = make('p', 'void-god-msg-meta');
    panelMeta.id = 'void-god-panel-meta';

    var actions = make('div', 'void-god-panel__actions');
    panelCopy = make('button', 'void-god-btn', 'Copy');
    panelCopy.type = 'button';
    panelCopy.id = 'void-god-copy';
    panelShare = make('button', 'void-god-btn', 'Share');
    panelShare.type = 'button';
    panelShare.id = 'void-god-share';
    actions.appendChild(panelCopy);
    actions.appendChild(panelShare);

    panelFeedback = make('p', 'void-god-panel__status');
    panelFeedback.id = 'void-god-copy-status';
    panelFeedback.setAttribute('role', 'status');
    panelFeedback.setAttribute('aria-live', 'polite');
    panelFeedback.hidden = true;

    panel.appendChild(head);
    panel.appendChild(panelText);
    panel.appendChild(panelMeta);
    panel.appendChild(actions);
    panel.appendChild(panelFeedback);
    host.appendChild(panel);

    x.addEventListener('click', function () {
      closePanel({ dissolve: true, focus: true });
    });
    panelCopy.addEventListener('click', onCopy);
    panelShare.addEventListener('click', onShare);
  }

  function renderMessage(msg) {
    panelText.textContent = msg.text;
    if (msg.lang) panelText.setAttribute('lang', msg.lang);
    else panelText.removeAttribute('lang');
    panelTag.textContent = source.tag;
    panelMeta.textContent = source.kind === 'demo'
      ? 'Sample message from the local demo set \u2014 no real messages have arrived yet. Nothing is sent or stored.'
      : 'Anonymous public letter' + (msg.expires_at ? ' \u00b7 fades ' + fadeInLabel(msg.expires_at) : '');
    clearTimeout(feedbackTimer);
    panelFeedback.hidden = true;
    panelFeedback.textContent = '';
    panelCopy.textContent = 'Copy';
    panelCopy.disabled = false;
    var canShare = !!(navigator.share && typeof navigator.share === 'function');
    panelShare.disabled = false;
    panelShare.title = canShare
      ? 'Share this message'
      : 'Sharing is not available in this browser \u2014 the message will be copied instead';
    panelShare.setAttribute('aria-label', canShare
      ? 'Share this message'
      : 'Share unavailable \u2014 copy the message instead');
  }

  function fadeInLabel(expiresAt) {
    var ms = Number(expiresAt) * 1000 - Date.now();
    if (!isFinite(ms) || ms <= 60000) return 'soon';
    var mins = Math.round(ms / 60000);
    if (mins < 90) return 'in about ' + Math.max(1, mins) + ' min';
    var hours = Math.round(mins / 60);
    if (hours < 36) return 'in about ' + hours + ' hours';
    return 'in about ' + Math.round(hours / 24) + ' days';
  }

  /* Panel states reuse the existing tag/text/meta elements so the layout and
     styling stay untouched while the feed loads, is empty, or fails. */
  function showPanelState(state) {
    currentMessage = null;
    panelTag.textContent = source.tag;
    panelCopy.disabled = true;
    panelShare.disabled = true;
    clearTimeout(feedbackTimer);
    panelFeedback.hidden = true;
    panelFeedback.textContent = '';
    if (state === 'empty') {
      panelText.textContent = 'No letters in the galaxy yet.';
      panelMeta.textContent = 'Be the first to leave one \u2014 the quill is on the right.';
    } else if (state === 'gone') {
      panelText.textContent = 'This letter has faded.';
      panelMeta.textContent = 'Shared letters disappear when their time runs out. The galaxy keeps the others.';
    } else if (state === 'error') {
      panelText.textContent = 'The galaxy is out of reach right now.';
      panelMeta.textContent = 'Could not load letters. The send form still works.';
    } else {
      panelText.textContent = 'Looking for a letter\u2026';
      panelMeta.textContent = 'Loading the newest letters.';
    }
  }

  function nextRemote() {
    if (!api) return Promise.reject(new Error('api missing'));
    if (!feed) feed = api.createFeed();
    return feed.next().then(function (res) {
      if (res.status === 'ok') return res.letter;
      if (res.status === 'error') throw new Error('feed');
      return null;
    });
  }

  /* Feed and counter load independently: either can fail without blocking the
     other or the composer. */
  function refreshCount() {
    if (!api) return;
    api.count().then(function (n) {
      if (n !== null) setCount(n);
    });
  }

  function startRemote() {
    if (remoteStarted || source.kind !== 'api' || !api) return;
    remoteStarted = true;
    if (!feed) feed = api.createFeed();
    feed.prefetch();
    refreshCount();
  }

  function layoutPanel(x, y, focus) {
    var top = safeTop();
    var bottom = safeBottom();
    panel.hidden = false;
    panel.classList.remove('is-on');
    panel.style.left = '0px';
    panel.style.top = '0px';
    var cap = Math.min(380, window.innerHeight * 0.56, Math.max(120, bottom - top));
    var W = panel.offsetWidth;
    var R = 24, m = 12, gap = 26;
    var starRect = { left: x - R, top: y - R, right: x + R, bottom: y + R };
    var obs = obstacleRects();
    var pill = statusPillBand();
    var maxLeft = Math.max(m, window.innerWidth - m - W);
    /* Try the natural height first; when the panel cannot sit clear of the site
       column/status pill at that height, shrink it (it scrolls internally) until
       a placement with no interactive-control overlap exists and the temporary
       star stays visible. The play dock is excluded by safeBottom() and never
       covered. */
    function better(a, b) {
      if (!b) return true;
      if (a.hard !== b.hard) return a.hard < b.hard;
      if (a.star !== b.star) return a.star < b.star;
      if (a.pill !== b.pill) return a.pill < b.pill;
      if (a.info !== b.info) return a.info < b.info;
      return a.score < b.score;
    }
    var chosen = null, chosenRank = null;
    for (var f = 1; f >= 0.3; f -= 0.05) {
      var capH = Math.max(120, Math.round(cap * f));
      panel.style.maxHeight = capH + 'px';
      var H = Math.min(panel.offsetHeight, capH);
      var cands = [
        { left: x + gap, top: y - H / 2 },
        { left: x - gap - W, top: y - H / 2 },
        { left: x - W / 2, top: y + gap },
        { left: x - W / 2, top: y - gap - H }
      ];
      var best = null, bestRank = null;
      for (var i = 0; i < cands.length; i++) {
        var left = clamp(cands[i].left, m, maxLeft);
        var topY = clamp(cands[i].top, top, Math.max(top, bottom - H));
        /* slide down out of the status-pill band when the safe area allows it */
        if (pill && left < pill.right && left + W > pill.left &&
            topY < pill.bottom && topY + H > pill.top) {
          var slid = Math.min(pill.bottom, Math.max(top, bottom - H));
          if (slid > topY) topY = slid;
        }
        var rect = { left: left, top: topY, right: left + W, bottom: topY + H };
        var hard = 0, info = 0;
        for (var j = 0; j < obs.length; j++) {
          var area = overlapArea(rect, obs[j]);
          if (obs[j].weight >= 10) hard += area;
          else info += area;
        }
        var starArea = overlapArea(rect, starRect);
        var rank = {
          hard: hard,
          star: starArea,
          pill: pill ? overlapArea(rect, pill) : 0,
          info: info,
          score: info + starArea * 4 +
            (Math.abs(left - cands[i].left) + Math.abs(topY - cands[i].top)) * 2
        };
        if (better(rank, bestRank)) { bestRank = rank; best = rect; }
      }
      if (!best) {
        best = { left: m, top: top, right: m + W, bottom: top + H };
        bestRank = { hard: 0, star: 0, pill: 0, info: 0, score: 0 };
      }
      if (bestRank.hard <= 0 && bestRank.star <= 0 && bestRank.pill <= 0) {
        chosen = best; chosenRank = bestRank; break;
      }
      if (better(bestRank, chosenRank)) { chosen = best; chosenRank = bestRank; }
    }
    if (!chosen) chosen = { left: m, top: top, right: m + W, bottom: top + cap };
    panel.style.maxHeight = Math.round(chosen.bottom - chosen.top) + 'px';
    panel.style.left = chosen.left + 'px';
    panel.style.top = chosen.top + 'px';
    panel.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(function () {
      if (panelOpen) panel.classList.add('is-on');
    });
    if (focus) { try { panel.focus({ preventScroll: true }); } catch (e) {} }
  }

  function openMessageAt(x, y, load) {
    if (!ensureMounted()) return;
    clearScene();
    panelOpen = true;
    var p = anchorPoint(x, y);
    starX = p.x;
    starY = p.y;
    buildAnchorAt(starX, starY);
    layoutPanel(starX, starY, true);
    showPanelState('loading');
    Promise.resolve().then(function () { return load ? load() : source.next(); }).then(function (msg) {
      if (!panelOpen) return;
      if (msg && msg.state) { showPanelState(msg.state); layoutPanel(starX, starY, false); return; }
      if (!msg) { showPanelState('empty'); layoutPanel(starX, starY, false); return; }
      currentMessage = msg;
      renderMessage(msg);
      layoutPanel(starX, starY, false);
    }, function () {
      if (!panelOpen) return;
      showPanelState('error');
      layoutPanel(starX, starY, false);
    });
  }

  /* اشتراک‌گذاری با لینک مستقیم: ?letter=<id> در آدرس صفحه. فقط شناسه‌ای که خودِ
     API معتبر بداند پذیرفته می‌شود؛ نامهٔ منقضی همان «محو شده» را نشان می‌دهد. */
  function sharedLetterId() {
    if (source.kind !== 'api' || !api || typeof api.letterUrl !== 'function') return null;
    var id = null;
    try { id = new URLSearchParams(window.location.search).get('letter'); } catch (e) { id = null; }
    return id && api.letterUrl(id) ? id : null;
  }

  function openSharedLetter(id) {
    var c = holeCenter();
    openMessageAt(c.x, c.y, function () {
      return api.getLetter(id).then(function (res) {
        if (res.status === 'ok') return res.letter;
        if (res.status === 'not_found') return { state: 'gone' };
        throw new Error('letter');
      });
    });
  }

  var deepLinkDone = false;

  function openDeepLink() {
    if (deepLinkDone) return;
    var id = sharedLetterId();
    if (!id) return;
    deepLinkDone = true;
    /* دو فریم صبر تا بوم و مرکز سیاه‌چاله جای خود را بگیرند. */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { openSharedLetter(id); });
    });
  }

  function hidePanelNow() {
    panelOpen = false;
    if (!panel) return;
    panel.classList.remove('is-on');
    panel.setAttribute('aria-hidden', 'true');
    panel.hidden = true;
    clearTimeout(closeTimer);
  }

  function closePanel(opts) {
    opts = opts || {};
    if (!panelOpen) return;
    panelOpen = false;
    currentMessage = null;
    panel.classList.remove('is-on');
    panel.setAttribute('aria-hidden', 'true');
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function () {
      if (!panelOpen && panel) panel.hidden = true;
    }, 180);
    if (opts.dissolve && anchor) {
      var ax = starX, ay = starY;
      var dying = anchor;
      dying.classList.add('is-closing');
      dying.setAttribute('aria-expanded', 'false');
      spawnAsh(ax, ay);
      anchor = null;
      setTimeout(function () {
        if (dying.parentNode) dying.parentNode.removeChild(dying);
      }, 520);
    } else {
      removeAnchorNow();
    }
    if (opts.focus) restoreFocus(quillBtn);
  }

  function clearScene() {
    hidePanelNow();
    removeAnchorNow();
    currentMessage = null;
  }

  function relayout() {
    if (!panelOpen) return;
    var p = anchorPoint(starX, starY);
    starX = p.x;
    starY = p.y;
    if (anchor) {
      anchor.style.left = starX + 'px';
      anchor.style.top = starY + 'px';
    }
    layoutPanel(starX, starY, false);
  }

  /* ---- کپی و اشتراک‌گذاری ---- */
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0;';
    document.body.appendChild(ta);
    var ok = false;
    try { ta.select(); ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    return ok ? Promise.resolve() : Promise.reject(new Error('copy failed'));
  }

  function copyText(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return legacyCopy(text);
  }

  function feedback(label, copied) {
    if (!panelFeedback) return;
    clearTimeout(feedbackTimer);
    panelFeedback.textContent = label;
    panelFeedback.hidden = false;
    panelCopy.textContent = copied ? 'Copied' : 'Copy';
    feedbackTimer = setTimeout(function () {
      if (!panelFeedback) return;
      panelFeedback.hidden = true;
      panelFeedback.textContent = '';
      panelCopy.textContent = 'Copy';
    }, 2200);
  }

  function onCopy() {
    if (!currentMessage) return;
    var text = currentMessage.text;
    copyText(text).then(function () {
      feedback('Copied to clipboard.', true);
    }, function () {
      feedback('Could not copy automatically \u2014 select the message text and copy it.', false);
    });
  }

  function onShare() {
    if (!currentMessage) return;
    var msg = currentMessage;
    if (!navigator.share) { shareFallback(msg); return; }
    var payload = { title: 'A message from the Void Galaxy', text: msg.text };
    navigator.share(payload).then(function () {
      feedback('Shared.', false);
    }, function (err) {
      if (err && err.name === 'AbortError') return;      // لغوِ کاربر خطا نیست
      shareFallback(msg);
    });
  }

  function shareFallback(msg) {
    copyText(msg.text).then(function () {
      feedback('Sharing is unavailable \u2014 the message was copied instead.', true);
    }, function () {
      feedback('Could not share or copy \u2014 select the message text and copy it.', false);
    });
  }

  /* ==================================================================
     پنجرهٔ نوشتنِ نامه + مسیر ثبت و اشتراک در X
     submit فقط از پاسخِ واقعیِ source.submit (Worker) صدا زده می‌شود.
     ================================================================== */
  function closeCompose() {
    if (!compose || !compose.open) return;
    compose.close();
    if (quillBtn) quillBtn.setAttribute('aria-expanded', 'false');
    restoreFocus(quillBtn);
  }

  function openCompose() {
    closePanel({ dissolve: false, focus: false });
    try {
      if (window.VoidMusic && typeof window.VoidMusic.enter === 'function' &&
          (!window.VoidMusic.isOpen || !window.VoidMusic.isOpen())) window.VoidMusic.enter();
    } catch (e) {}
    if (!ensureMounted()) return;
    if (compose.open) return;
    composeForm.classList.remove('is-published');
    successEl.hidden = true;
    xShareBtn.disabled = true;
    published = false;
    shareUrl = null;
    publishedBase = '';
    publishedLang = null;
    sending = false;
    ackEl.checked = false;
    noticeEl.hidden = true;
    noticeEl.textContent = '';
    updateState();
    try { compose.showModal(); }
    catch (e) { compose.setAttribute('open', ''); }
    if (quillBtn) quillBtn.setAttribute('aria-expanded', 'true');
    try { composer.focus({ preventScroll: true }); } catch (e) {}
  }

  function buildCompose(host) {
    compose = make('dialog', 'void-god-dialog');
    compose.id = 'void-god-dialog';
    compose.setAttribute('aria-labelledby', 'void-god-title');
    compose.setAttribute('aria-describedby', 'void-god-intro void-god-demo');

    composeForm = make('form', 'void-god-form');
    composeForm.setAttribute('novalidate', '');

    var head = make('div', 'void-god-head');
    var titles = make('div', 'void-god-titles');
    var h = make('h2', 'void-god-title', '\u2726 Message to Galaxy');
    h.id = 'void-god-title';
    var fa = make('span', 'void-god-title-fa', '\u0646\u0627\u0645\u0647 \u0628\u0647 \u06a9\u0647\u06a9\u0634\u0627\u0646');
    fa.lang = 'fa';
    fa.dir = 'rtl';
    titles.appendChild(h);
    titles.appendChild(fa);
    var x = make('button', 'void-god-x', '\u00D7');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close without submitting');
    head.appendChild(titles);
    head.appendChild(x);

    var intro = make('p', 'void-god-intro',
      'Leave a thought among the stars. It becomes a small star in the galaxy: anonymous, public, and temporary. Write with care \u2014 once it leaves, it cannot be taken back.');
    intro.id = 'void-god-intro';

    var demo = make('p', 'void-god-demo', 'Your letter is stored anonymously on the public sky until it fades. Pressing Submit is final \u2014 it cannot be edited or deleted afterwards.');
    demo.id = 'void-god-demo';

    var label = make('label', 'void-god-label', 'Your letter');
    label.setAttribute('for', 'void-god-text');

    composer = make('textarea', 'void-god-text');
    composer.id = 'void-god-text';
    composer.setAttribute('rows', '6');
    composer.setAttribute('dir', 'auto');
    composer.setAttribute('placeholder', 'Write a few lines\u2026');
    composer.setAttribute('spellcheck', 'true');
    composer.setAttribute('autocomplete', 'off');
    composer.setAttribute('aria-describedby', 'void-god-count void-god-hint');

    var meta = make('div', 'void-god-count-row');
    countEl = make('span', 'void-god-count', '0 / 500');
    countEl.id = 'void-god-count';
    hintEl = make('span', 'void-god-hint', '');
    hintEl.id = 'void-god-hint';
    hintEl.setAttribute('aria-live', 'polite');
    meta.appendChild(countEl);
    meta.appendChild(hintEl);

    var fs = make('fieldset', 'void-god-exp');
    fs.appendChild(make('legend', 'void-god-legend', 'Fades after'));
    var row = make('div', 'void-god-exp-row');
    var opts = [['24h', '24 hours'], ['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days']];
    for (var i = 0; i < opts.length; i++) {
      var opt = make('label', 'void-god-exp-opt');
      var radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'void-god-expiry';
      radio.value = opts[i][0];
      radio.checked = opts[i][0] === '7d';
      opt.appendChild(radio);
      opt.appendChild(make('span', '', opts[i][1]));
      row.appendChild(opt);
    }
    fs.appendChild(row);

    var ackLab = make('label', 'void-god-ack');
    ackEl = document.createElement('input');
    ackEl.type = 'checkbox';
    ackEl.id = 'void-god-ack';
    ackLab.appendChild(ackEl);
    ackLab.appendChild(make('span', '',
      'I understand letters are anonymous and public, cannot be edited or deleted after submission, and may be seen or saved before they expire.'));

    noticeEl = make('p', 'void-god-notice');
    noticeEl.id = 'void-god-notice';
    noticeEl.setAttribute('role', 'status');
    noticeEl.hidden = true;

    var foot = make('div', 'void-god-foot');
    var cancel = make('button', 'void-god-btn', 'Cancel');
    cancel.type = 'button';
    submitBtn = make('button', 'void-god-btn void-god-btn--primary', 'Submit letter');
    submitBtn.type = 'submit';
    submitBtn.disabled = true;
    foot.appendChild(cancel);
    foot.appendChild(submitBtn);

    /* نمای موفقیت: فقط پس از پاسخِ واقعیِ ثبت آشکار می‌شود. */
    successEl = make('div', 'void-god-published');
    successEl.id = 'void-god-published';
    successEl.hidden = true;
    successEl.tabIndex = -1;
    successEl.setAttribute('role', 'status');
    successTitle = make('p', 'void-god-published__title', 'Your letter is in the galaxy');
    successEl.appendChild(successTitle);
    successNote = make('p', 'void-god-published__note', '');
    successEl.appendChild(successNote);
    var okFoot = make('div', 'void-god-foot');
    xShareBtn = make('button', 'void-god-btn', 'Share on X');
    xShareBtn.type = 'button';
    xShareBtn.id = 'void-god-x-share';
    xShareBtn.disabled = true;
    xShareBtn.title = 'Sharing unlocks once the letter has its public page';
    var done = make('button', 'void-god-btn void-god-btn--primary', 'Done');
    done.type = 'button';
    okFoot.appendChild(xShareBtn);
    okFoot.appendChild(done);
    successEl.appendChild(okFoot);

    composeForm.appendChild(head);
    composeForm.appendChild(intro);
    composeForm.appendChild(demo);
    composeForm.appendChild(label);
    composeForm.appendChild(composer);
    composeForm.appendChild(meta);
    composeForm.appendChild(fs);
    composeForm.appendChild(ackLab);
    composeForm.appendChild(noticeEl);
    composeForm.appendChild(foot);
    composeForm.appendChild(successEl);
    compose.appendChild(composeForm);
    host.appendChild(compose);

    composer.addEventListener('input', updateState);
    ackEl.addEventListener('change', updateState);
    x.addEventListener('click', closeCompose);
    cancel.addEventListener('click', closeCompose);
    done.addEventListener('click', closeCompose);
    xShareBtn.addEventListener('click', onShareX);
    compose.addEventListener('cancel', function (e) {
      e.preventDefault();
      closeCompose();
    });
    /* Backdrop clicks deliberately do not close the composer: an accidental click
       must not discard a draft. Cancel and the close button are the exits. */
    composeForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submitBtn.disabled || sending) return;
      if (typeof source.submit !== 'function') {
        notice('Sending is unavailable right now. Nothing was sent.');
        return;
      }
      submitLetter();
    });
  }

  function currentExpiry() {
    var checked = composeForm && composeForm.querySelector('input[name="void-god-expiry"]:checked');
    return checked ? checked.value : '7d';
  }

  function submitRemote(payload) {
    if (!api) return Promise.resolve({ kind: 'network' });
    var pending = api.begin(payload.text, payload.expiry, detectLang(payload.text));
    return api.submit(pending);
  }

  function submitLetter() {
    if (sending || typeof source.submit !== 'function') return;
    sending = true;
    updateState();
    noticeEl.hidden = true;
    var payload = { text: composer.value, expiry: currentExpiry() };
    source.submit(payload).then(function (result) {
      sending = false;
      handleSubmitResult(result || { kind: 'error' });
    }, function () {
      sending = false;
      handleSubmitResult({ kind: 'network' });
    });
  }

  var REASON_TEXT = {
    short: 'The letter is too short \u2014 at least 3 characters.',
    long: 'The letter is longer than 500 characters.',
    links: 'Links, domains and addresses are not allowed in a letter.',
    unicode: 'The letter contains characters that are not allowed.',
    control: 'The letter contains characters that are not allowed.',
    expiry: 'That fade time is not valid. Please pick another one.',
    request_id: 'The request could not be accepted. Please press Submit again.',
    body: 'The letter could not be read. Please try again.'
  };

  function handleSubmitResult(result) {
    if (result.kind === 'created' || result.kind === 'recovered') {
      onPublished(result);
      return;
    }
    if (result.kind === 'busy') return;
    if (result.kind === 'already') {
      var when = result.next_allowed_at
        ? new Date(result.next_allowed_at * 1000).toLocaleString()
        : '';
      notice('You already have an active letter.' + (when ? ' You can send a new one from ' + when + '.' : ''));
    } else if (result.kind === 'expired') {
      notice('The previous letter has expired. Press Submit again to send this one as a new letter.');
    } else if (result.kind === 'rate') {
      startCooldown(result.retry_after);
      notice('Too many attempts. Please try again shortly \u2014 your letter has not been lost.');
    } else if (result.kind === 'invalid') {
      notice(REASON_TEXT[result.reason] || 'The letter or its settings are not valid. Please check it and try again.');
    } else {
      notice('The service is temporarily unavailable. Your letter is still here \u2014 try again in a moment.');
    }
    syncSubmit();
  }

  function onPublished(result) {
    published = true;
    shareUrl = null;
    publishedLang = detectLang(composer.value);
    xShareBtn.disabled = true;
    xShareBtn.title = 'Sharing unlocks once the letter has its public page';
    xShareBtn.setAttribute('aria-label', 'Sharing is not available yet');
    successTitle.textContent = result.kind === 'recovered'
      ? 'This letter was already sent'
      : 'Your letter is in the galaxy';
    publishedBase = (result.kind === 'recovered' ? 'It was saved earlier, so nothing new was added. ' : '') +
      (result.expires_at ? 'It will fade ' + fadeInLabel(result.expires_at) + '. ' : '');
    shareNote(false);
    composeForm.classList.add('is-published');
    successEl.hidden = false;
    noticeEl.hidden = true;
    composer.value = '';
    ackEl.checked = false;
    refreshCount();
    if (api) {
      feed = api.createFeed();
      feed.prefetch();
      unlockShare(result.id);
    }
    updateState();
    try { successEl.focus({ preventScroll: true }); } catch (e) {}
  }

  function shareNote(unlocked) {
    successNote.textContent = publishedBase + (unlocked
      ? 'Share it on X so someone can find it.'
      : 'Sharing on X unlocks once the live service can serve this letter.');
  }

  /* لینک فقط وقتی باز می‌شود که خودِ سرویس همان نامه را با همین شناسه برگرداند.
     ورکرِ منتشرنشده ۴۰۴ می‌دهد و دکمه قفل می‌ماند تا لینک مرده ساخته نشود. */
  function unlockShare(id) {
    if (!api || typeof api.getLetter !== 'function' || typeof api.letterUrl !== 'function') return;
    var url = api.letterUrl(id);
    if (!url) return;
    api.getLetter(id).then(function (res) {
      if (!published || res.status !== 'ok' || res.letter.id !== id) return;
      shareUrl = url;
      shareNote(true);
      xShareBtn.disabled = false;
      xShareBtn.title = 'Share this letter on X';
      xShareBtn.setAttribute('aria-label', 'Share this letter on X');
    }, function () {});
  }

  /* اشتراک در X: فقط با اقدام صریحِ کاربر و فقط پس از ثبت واقعی. متنِ ثابت است
     و هرگز متن نامه را در بر نمی‌گیرد؛ فقط زبانِ نامه انتخابش می‌کند. */
  function onShareX() {
    if (!published || !shareUrl) return;
    var text = publishedLang === 'fa' ? X_LETTER_TEXT_FA : X_LETTER_TEXT;
    var url = X_INTENT + encodeURIComponent(text) + '&url=' + encodeURIComponent(shareUrl);
    try { window.open(url, '_blank', 'noopener,noreferrer'); } catch (e) {}
  }

  /* ---- دکمهٔ قلم ---- */
  function svgNode(tag, attrs) {
    var n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function buildQuill(host) {
    quillBtn = make('button', 'void-god-quill');
    quillBtn.id = 'void-god-quill';
    quillBtn.type = 'button';
    quillBtn.setAttribute('aria-label', 'Message to Galaxy');
    quillBtn.setAttribute('title', 'Message to Galaxy');
    quillBtn.setAttribute('aria-haspopup', 'dialog');
    quillBtn.setAttribute('aria-expanded', 'false');
    quillBtn.setAttribute('aria-controls', 'void-god-dialog');
    var svg = svgNode('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' });
    svg.appendChild(svgNode('path', { d: 'M21 3c0 7.8-4.7 12.5-12.5 12.5H7.1L4.8 19.8' }));
    svg.appendChild(svgNode('path', { d: 'M17.2 3.4c-1.3 5-4.3 8-9.3 9.3' }));
    svg.appendChild(svgNode('path', { d: 'M12.4 4.9c-.4 2.9-1.5 5-3.6 6.9' }));
    quillBtn.appendChild(svg);
    host.appendChild(quillBtn);
    quillBtn.addEventListener('click', openCompose);
  }

  function buildUi(host) {
    if (compose) return;
    buildQuill(host);
    buildGalaxy(host);
    buildPanel(host);
    buildCompose(host);
    startRemote();
    listenVisitors();
  }

  function onGuardKey(e) {
    var open = (compose && compose.open) || panelOpen || statsOpen;
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (compose && compose.open) closeCompose();
      else if (panelOpen) closePanel({ dissolve: true, focus: true });
      else closeStats(true);
      return;
    }
    /* Let the dialog own arrows/space (radios, buttons); only keep the player's
       document-capture shortcuts from firing underneath the open surface. */
    if (!e.ctrlKey && !e.metaKey && !e.altKey && PLAYER_KEYS[e.key]) e.stopPropagation();
  }

  function bindKeys() {
    if (guardOn) return;
    guardOn = true;
    window.addEventListener('keydown', onGuardKey, true);
    window.addEventListener('resize', function () {
      clearTimeout(relayoutTimer);
      relayoutTimer = setTimeout(relayout, 90);
    });
    window.addEventListener('voidmusic:mode', function (e) {
      if (e && e.detail && e.detail.open === false) clearScene();
    });
  }

  function ensureMounted() {
    if (compose) return true;
    var host = findRoot();
    if (!host) return false;
    buildBadge(host);
    buildUi(host);
    return true;
  }

  function mount() {
    if (el) return true;
    var host = findRoot();
    if (!host) return false;
    buildBadge(host);
    buildUi(host);
    return true;
  }

  function start() {
    bindKeys();
    if (mount()) { openDeepLink(); return; }
    var tries = 0;
    (function retry() {
      if (mount()) { openDeepLink(); return; }
      if (++tries > 120) return;            // ~۲ ثانیه صبر برای ساختِ ریشهٔ پلیر
      setTimeout(retry, 16);
    })();
  }

  window.VoidLetters = { setCount: setCount, hide: hide };

  if (document.readyState === 'complete') requestAnimationFrame(start);
  else window.addEventListener('load', function () { requestAnimationFrame(start); }, { once: true });
})();
