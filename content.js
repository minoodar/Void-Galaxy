// AI Orbit Launcher — Core (V26.0 - Quantum Seed visual system)
(function () {
  'use strict';

  const isTopFrame = (window === window.top);
  // پنجره‌های پاپ‌آپ (مثلاً بازشده با window.open و toolbar=no) نوار ابزار مرورگر
  // ندارند — افزونه در این پنجره‌ها نیازی به فعال‌بودن ندارد.
  let isPopupWindow = false;
  try { isPopupWindow = !!(window.toolbar && window.toolbar.visible === false); } catch (e) {}
  // صفحات ورود/تأییدهویتِ گوگل و مشابه (مثلاً "انتخاب اکانت") معمولاً در یک تبِ
  // معمولی با نوار ابزار کامل باز می‌شوند، پس چک بالا (toolbar.visible) آن‌ها را
  // نمی‌گیرد. این دامنه‌ها اختصاصاً برای فرآیند ورود هستند، پس افزونه هرگز نباید
  // رویشان نمایش داده شود.
  let isAuthHost = false;
  try {
    const host = window.location.hostname;
    isAuthHost =
      /(^|\.)accounts\.google\.com$/.test(host) ||
      /(^|\.)appleid\.apple\.com$/.test(host) ||
      /(^|\.)login\.microsoftonline\.com$/.test(host) ||
      /(^|\.)login\.live\.com$/.test(host);
  } catch (e) {}
  if (!isTopFrame || isPopupWindow || isAuthHost || document.getElementById('ai-orbit-root')) return;

  // کمکیِ کوچک برای رشته‌های سخت‌کدشدهٔ چندزبانه‌ای که (برخلاف i18n.js) مستقیم
  // توی کد نوشته شده‌اند — با اضافه‌شدن هر زبانِ جدید فقط یک آرگومان اضافه
  // می‌شود، به‌جای زنجیرهٔ تکراریِ ?: در همه‌جای فایل. زبانی که مقدارش داده
  // نشده (یا undefined بماند) به انگلیسی برمی‌گردد.
  function langPick(map) {
    return (map && map[currentLang] !== undefined) ? map[currentLang] : map.en;
  }

  let linksData = [];
  let linksData2 = []; 
  let linksData3 = [];
  let linksData4 = []; // کهکشان NEWS — فقط با انتخاب کاربر پر می‌شود
  const HUB_COUNT = 4;
  const OVERFLOW_HUB_MAX = 3; // سرریز خودکار فقط بین کهکشان‌های ۱–۳
  const NEWS_HUB_INDEX = 4;
  function isNewsHub(hubIdx) { return hubIdx === NEWS_HUB_INDEX; }
  function hubData(hubIdx) {
    if (hubIdx === 1) return linksData;
    if (hubIdx === 2) return linksData2;
    if (hubIdx === 3) return linksData3;
    if (hubIdx === 4) return linksData4;
    return linksData;
  }
  let currentHubIndex = 1; 
  let hubNavDirection = 'forward'; // remembers last portal click direction so a "return trip" keeps showing 🌍 in the same slot
  let todosData = [];
  let activeTodoTab = 'daily';
  let addForTomorrow = false;
  const TODO_DAILY_TTL_MS = 24 * 60 * 60 * 1000;
  let userBirthYear = null;
  let userBirthMonth = null;
  let userBirthDay = null;
  let familyAges = [];
  let familyAgesExpanded = false;

  let markedDays = []; // مناسبت‌های نشانه‌گذاری‌شده: [{ id, label, day, month }]
  // رویدادهای ساعتی/روزانهٔ داشبورد زمان — کاملاً مستقل از سیستم TODO؛ ارتباط اختیاری با
  // یک TODO فقط از طریق linkedTodoId برقرار می‌شود (بدون ادغام دو آرایه در هم).
  // { id, title, date:'YYYY-MM-DD', startTime:'HH:mm', endTime, status, linkedTodoId, recurrence }
  let timeEventsData = [];
  // تعطیلات رسمی آنلاین (کشوری) — مجزا از markedDays شخصی؛ فقط در رندر با هم ترکیب می‌شوند
  // تا هرگز در بکاپ/خروجی JSON کاربر مخلوط نشوند و با یک fetch جدید کامل جایگزین شوند.
  let publicHolidays = [];
  let showPublicHolidays = true;
  let holidayRegionMode = 'auto'; // 'auto' | 'IR' | 'custom' — از پنل تنظیمات (popup)
  let holidayCustomCountry = '';
  let isNotePinned = false;
  // ایموجی‌های موردعلاقه — باید قبل از هر renderEmojiTray مقداردهی شود (جلوگیری از TDZ)
  const DEFAULT_FAVORITE_EMOJIS = ['✨', '📌', '🔥', '💡', '🌱', '🎯', '🚀', '⭐'];
  let favoriteEmojis = DEFAULT_FAVORITE_EMOJIS.slice();

  const systemLocale = (navigator.languages && navigator.languages[0]) || navigator.language || 'en-US';
  const RTL_LOCALE_PREFIXES = ['ar', 'fa', 'he', 'ur', 'ps', 'sd', 'ug', 'yi'];
  function isRTLLocale(locale) { return RTL_LOCALE_PREFIXES.includes((locale || '').split('-')[0].toLowerCase()); }
  
  const WIDGET1_DEFAULT_LEFT = '28px'; const WIDGET1_DEFAULT_BOTTOM = '108px';


  const GOLDEN_ANGLE = 137.51; let SPACING = 32; const START_RADIUS = 88; const MAX_NODES = 80;
  const MIN_SPACING = 18; const MAX_SPACING = 84;
  let currentLayerMode = 0; let showAllOverride = false; const MAX_LAYERS = 6; // ۵ ردهٔ ستاره‌ای + مجموعهٔ سرریزِ دنبال‌دار
  let isOpen = false; let isDragging = false; let dragMoved = false;
  let spiralNodeEls = []; 
  
  let editingNodeIndex = null; 
  let isLabelManuallyEdited = false;

  function extractDomainName(urlStr) {
    if (!urlStr) return '';
    try {
      let u = urlStr.trim(); if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
      const hostname = new URL(u).hostname.replace(/^www\./i, '');
      const parts = hostname.split('.'); if (parts.length > 1) parts.pop(); 
      let name = parts.join('.'); if (name) name = name.charAt(0).toUpperCase() + name.slice(1);
      return name.substring(0, 18); 
    } catch (e) { return ''; }
  }

  const RING_CONFIG = [
    { labelKey: 'hubCore', max: 5 },
    { label: '5★',   importance: 5,     max: 7  },
    { label: '4★',   importance: 4,     max: 14 },
    { label: '3★',   importance: 3,     max: 20 },
    { label: '1-2★', importanceMax: 2,  max: 30 },
    // مجموعه‌ی میکسِ سرریز: وقتی رده‌ی اصلی در همه‌ی کهکشان‌های قابل‌سرریز پر باشد،
    // به‌جای گم‌شدنِ بوک‌مارک، اینجا (با ظرفیت بیشتر) نگه داشته می‌شود.
    // نمایش فقط ایموجی 💫 است؛ عبارت «ستاره‌های دنبال‌دار» فقط در تولتیپ می‌آید.
    { label: '💫', titleKey: 'hubComet', comet: true, max: 50 }
  ];
  function ringDisplayLabel(ring) {
    if (!ring) return '';
    return ring.labelKey ? t(ring.labelKey) : (ring.label || '');
  }
  // برای تولتیپ‌ها همیشه عبارت کامل (نه ایموجی) برگردانده می‌شود
  function ringTooltipLabel(ring) {
    if (!ring) return '';
    if (ring.titleKey) return t(ring.titleKey);
    return ringDisplayLabel(ring);
  }

  function importanceMatchesRing(importance, ring) {
    return ring.importance !== undefined ? importance === ring.importance : importance <= ring.importanceMax;
  }
  function tierRingForImportance(importance) {
    for (let i = 1; i < RING_CONFIG.length; i++) { if (importanceMatchesRing(importance, RING_CONFIG[i])) return RING_CONFIG[i]; }
    return RING_CONFIG[RING_CONFIG.length - 2]; // آخرین رده‌ی واقعی ستاره‌ای (۱-۲★)؛ آخرِ آرایه مجموعه‌ی دنبال‌دار است
  }
  function tierCountInHub(hubIdx, ring) {
    const data = hubData(hubIdx); let n = 0;
    for (let i = 5; i < data.length; i++) {
      if (ring.comet) { if (data[i].overflow) n++; }
      else if (!data[i].overflow && importanceMatchesRing(data[i].importance || 3, ring)) n++;
    }
    return n;
  }
  // اولین جایگاه خالیِ هسته (اندیس ۰ تا ۴) در یک کهکشان — یا -1 اگر هر ۵ جایگاه پر باشند.
  function findEmptyCoreSlot(hubIdx) {
    const data = hubData(hubIdx);
    for (let i = 0; i < 5; i++) { if (!data[i] || !data[i].url) return i; }
    return -1;
  }
  function findTargetHubForImportance(importance, startHub) {
    const ring = tierRingForImportance(importance);
    const cometRing = RING_CONFIG[RING_CONFIG.length - 1];
    // کهکشان NEWS هرگز مقصد سرریز خودکار نیست و خودش هم به کهکشان‌های دیگر سرریز نمی‌کند؛
    // فقط اگر رده‌ی اصلی‌اش پر شود، به مجموعه‌ی دنبال‌دارِ داخلیِ خودش سرریز می‌کند.
    if (isNewsHub(startHub)) {
      const full = tierCountInHub(NEWS_HUB_INDEX, ring) >= ring.max || hubData(NEWS_HUB_INDEX).length >= MAX_NODES;
      if (!full) return { ring, targetHub: NEWS_HUB_INDEX };
      const cometFull = tierCountInHub(NEWS_HUB_INDEX, cometRing) >= cometRing.max || hubData(NEWS_HUB_INDEX).length >= MAX_NODES;
      if (!cometFull) return { ring: cometRing, targetHub: NEWS_HUB_INDEX, overflowFromRing: ring };
      return { ring, targetHub: HUB_COUNT + 1 };
    }
    let targetHub = Math.min(startHub, OVERFLOW_HUB_MAX);
    while (targetHub <= OVERFLOW_HUB_MAX && (tierCountInHub(targetHub, ring) >= ring.max || hubData(targetHub).length >= MAX_NODES)) {
      targetHub++;
    }
    if (targetHub <= OVERFLOW_HUB_MAX) return { ring, targetHub };
    // رده‌ی اصلی در همه‌ی کهکشان‌های قابل‌سرریز پر است؛ حالا به‌جای گم‌کردنِ بوک‌مارک،
    // مجموعه‌ی میکسِ «ستاره‌های دنبال‌دار» هر کهکشان را امتحان کن
    let cometHub = 1;
    while (cometHub <= OVERFLOW_HUB_MAX && (tierCountInHub(cometHub, cometRing) >= cometRing.max || hubData(cometHub).length >= MAX_NODES)) {
      cometHub++;
    }
    if (cometHub <= OVERFLOW_HUB_MAX) return { ring: cometRing, targetHub: cometHub, overflowFromRing: ring };
    return { ring, targetHub: HUB_COUNT + 1 }; // واقعاً همه‌جا پر است، حتی مجموعه‌ی دنبال‌دار
  }
  function hubHasTierItems(hubIdx, ring) { return tierCountInHub(hubIdx, ring) > 0; }
  // نصب‌های قدیمی ۴ اسلات هسته داشتند؛ این هسته الان ۵ اسلاته است. هر آرایهٔ لینک با ساختار
  // قدیمی (هستهٔ ۴تایی در ابتدا) که هنوز مهاجرت نکرده را با درج یک اسلات خالیِ پنجم اصلاح می‌کند
  // — هم موقع بارگذاری اولیه و هم موقع بازیابی از بکاپِ داخلی استفاده می‌شود.
  function migrateCoreSlotsTo5(arr) {
    if (!Array.isArray(arr) || arr.length < 4) return arr;
    const migrated = arr.slice();
    migrated.splice(4, 0, { label: '', url: '' });
    return migrated;
  }

  const CORE_COLORS = [
    { bg: "rgba(154, 52, 18, 0.82)", border: "rgba(249, 115, 22, 0.8)", glow: "rgba(249, 115, 22, 0.55)" }, 
    { bg: "rgba(26, 54, 153, 0.82)", border: "rgba(66, 133, 244, 0.8)", glow: "rgba(66, 133, 244, 0.55)" }, 
    { bg: "rgba(4, 90, 66, 0.82)",   border: "rgba(16, 185, 129, 0.8)", glow: "rgba(16, 185, 129, 0.55)" }, 
    { bg: "rgba(23, 49, 118, 0.82)", border: "rgba(77, 107, 254, 0.8)", glow: "rgba(77, 107, 254, 0.55)" },
    { bg: "rgba(133, 77, 14, 0.82)", border: "rgba(234, 179, 8, 0.8)",  glow: "rgba(234, 179, 8, 0.55)" }
  ];
  const EXTRA_COLORS = [
    { bg: "rgba(107, 33, 168, 0.75)", border: "rgba(168, 85, 247, 0.5)", glow: "rgba(168, 85, 247, 0.2)" }, 
    { bg: "rgba(79, 70, 229, 0.75)",  border: "rgba(99, 102, 241, 0.5)", glow: "rgba(99, 102, 241, 0.2)" },  
    { bg: "rgba(153, 27, 27, 0.75)",  border: "rgba(239, 68, 68, 0.5)",  glow: "rgba(239, 68, 68, 0.2)" }
  ];
  // همان منطقِ رنگ‌دهیِ نودهای اسپیرال، برای استفاده در نتایج جستجو (تا رنگ‌ها همیشه هم‌خوان بمانند)
  function colorSetForBookmark(link, idxInHub) {
    if (idxInHub < 5) return CORE_COLORS[idxInHub] || EXTRA_COLORS[0];
    const importance = (link && link.importance) || 3;
    const nodeLayer = Math.max(0, importance - 1);
    return EXTRA_COLORS[nodeLayer % EXTRA_COLORS.length];
  }

  // پالت رنگِ اختصاصیِ هر «دسته/تگ» — مستقل از رنگ‌بندیِ اهمیت/ستاره‌ی بالا. هدف:
  // هر تگ همیشه یک رنگ ثابت و قابل‌تشخیص داشته باشد (نه تصادفی در هر رندر)، تا
  // نقشِ دسته‌بندی در نگاه اول معلوم باشد. هش قطعی از خودِ نامِ تگ → یکی از این
  // ۸ رنگ؛ همان تگ همیشه همان رنگ را می‌گیرد، در همه‌ی رندرها و همه‌ی جلسات.
  const AI_TAG_GLOW_PALETTE = [
    'rgba(56, 189, 248, 0.75)',  // آبی
    'rgba(52, 211, 153, 0.75)',  // سبز
    'rgba(251, 191, 36, 0.75)',  // زرد
    'rgba(244, 114, 182, 0.75)', // صورتی
    'rgba(167, 139, 250, 0.75)', // بنفش (پیش‌فرض قبلی)
    'rgba(248, 113, 113, 0.75)', // قرمز
    'rgba(45, 212, 191, 0.75)',  // فیروزه‌ای
    'rgba(251, 146, 60, 0.75)'   // نارنجی
  ];
  function glowColorForTag(tag) {
    const str = String(tag || '');
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    return AI_TAG_GLOW_PALETTE[hash % AI_TAG_GLOW_PALETTE.length];
  }

  const root = document.createElement('div'); root.id = 'ai-orbit-root';
  const hub = document.createElement('div'); hub.id = 'ai-orbit-hub'; hub.innerHTML = mainAIIcon();
  const quantumBloom = document.createElement('div'); quantumBloom.className = 'ai-quantum-bloom'; quantumBloom.setAttribute('aria-hidden', 'true');
  quantumBloom.innerHTML = '<i></i><i></i><i></i><i></i>';
  
  const todoToggleDot = document.createElement('div'); todoToggleDot.id = 'ai-todo-toggle'; todoToggleDot.innerHTML = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`; hub.appendChild(todoToggleDot);
  const searchToggleDot = document.createElement('div'); searchToggleDot.id = 'ai-search-toggle'; searchToggleDot.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`; hub.appendChild(searchToggleDot);
  // Consistent 24px Lucide-style SVGs keep the action particles legible at any zoom.
  // Inline paths avoid a network dependency and are MIT-compatible icon geometry.
  const noteToggleDot = document.createElement('div'); noteToggleDot.id = 'ai-note-toggle'; noteToggleDot.setAttribute('role', 'button'); noteToggleDot.tabIndex = 0; noteToggleDot.setAttribute('aria-label', 'Quick note'); noteToggleDot.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>`; hub.appendChild(noteToggleDot);
  const allToggleDot = document.createElement('div'); allToggleDot.id = 'ai-all-toggle'; allToggleDot.setAttribute('role', 'button'); allToggleDot.tabIndex = 0; allToggleDot.setAttribute('aria-label', 'Show all'); allToggleDot.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"/></svg>`; hub.appendChild(allToggleDot);
  const collapseToggleDot = document.createElement('div'); collapseToggleDot.id = 'ai-collapse-toggle'; collapseToggleDot.setAttribute('role', 'button'); collapseToggleDot.tabIndex = 0; collapseToggleDot.setAttribute('aria-label', 'Collapse launcher'); collapseToggleDot.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`; hub.appendChild(collapseToggleDot);
  [noteToggleDot, allToggleDot, collapseToggleDot].forEach((control) => {
    control.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); control.click(); }
    });
  });
  const calcToggleDot = document.createElement('div'); calcToggleDot.id = 'ai-calc-hub-toggle'; calcToggleDot.innerHTML = `<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><line x1="8" y1="10" x2="16" y2="10"></line><line x1="8" y1="14" x2="16" y2="14"></line><line x1="8" y1="18" x2="16" y2="18"></line></svg>`; hub.appendChild(calcToggleDot);
  const clockToggleDot = document.createElement('div'); clockToggleDot.id = 'ai-clock-toggle'; clockToggleDot.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`; hub.appendChild(clockToggleDot);
  const undoToggleDot = document.createElement('div'); undoToggleDot.id = 'ai-undo-toggle';
  undoToggleDot.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/><path d="M16.2 5.2l0.7 1.5 1.5 0.7-1.5 0.7-0.7 1.5-0.7-1.5-1.5-0.7 1.5-0.7z" fill="#FBBF24" stroke="none"/></svg>`;
  undoToggleDot.setAttribute('aria-label', 'Undo last edit or deletion');
  hub.appendChild(undoToggleDot);

  // ---- LauncherSound wiring (hub + toggles) ----
  const LAUNCHER_SOUND_TOGGLES = [
    searchToggleDot, noteToggleDot, allToggleDot, collapseToggleDot,
    undoToggleDot, todoToggleDot, calcToggleDot, clockToggleDot
  ];
  function playLauncherOpen() {
    try { if (window.LauncherSound) LauncherSound.open(); } catch (e) {}
  }
  function playLauncherClick(i) {
    try { if (window.LauncherSound) LauncherSound.click(i); } catch (e) {}
  }
  function playLauncherHover(i) {
    try { if (window.LauncherSound) LauncherSound.hover(i); } catch (e) {}
  }
  LAUNCHER_SOUND_TOGGLES.forEach((el, i) => {
    if (!el) return;
    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      playLauncherHover(i);
    });
  });


  const spacingArc = document.createElement('div'); spacingArc.id = 'ai-spacing-arc';
  spacingArc.innerHTML = `
    <svg viewBox="0 0 104 104" width="104" height="104">
      <path id="ai-spacing-track" d="M94,52 A42,42 0 0 0 52,10" fill="none"></path>
      <path id="ai-spacing-fill" d="M94,52 A42,42 0 0 0 52,10" fill="none"></path>
    </svg>
    <div id="ai-spacing-thumb"></div>
    <div id="ai-spacing-value">42</div>`;
  hub.appendChild(spacingArc);

  const bookmarkCountEl = document.createElement('div');
  bookmarkCountEl.id = 'ai-bookmark-count';
  bookmarkCountEl.setAttribute('aria-live', 'polite');
  root.appendChild(bookmarkCountEl);

  const addNodeBtn = document.createElement('div'); addNodeBtn.id = 'ai-add-node'; addNodeBtn.textContent = '+';
  const inlineForm = document.createElement('div'); inlineForm.id = 'ai-inline-form';
  inlineForm.innerHTML = `
    <div class="ai-form-header">
      <span class="ai-form-title" id="ai-form-main-title"></span>
      <span class="ai-form-close" id="ai-form-close" title="✕">✕</span>
    </div>
    <input type="url" id="ai-form-url" dir="ltr" />
    <input type="text" id="ai-form-label" maxlength="18" dir="auto" />
    <input type="text" id="ai-form-description" maxlength="140" dir="auto" />
    <input type="text" id="ai-form-tags" maxlength="120" dir="auto" autocomplete="off" />
    <div class="ai-tags-suggest" id="ai-tags-suggest"></div>
    <div class="ai-cat-accordion" id="ai-form-cat-accordion">
      <button type="button" class="ai-cat-accordion-toggle" id="ai-form-cat-toggle">
        <span id="ai-form-cat-toggle-label"></span>
        <span class="ai-cat-accordion-chevron">▾</span>
      </button>
      <div class="ai-cat-grid" id="ai-form-cat-grid"></div>
    </div>
    <div class="ai-form-importance">
      <span class="ai-form-importance-label" id="ai-form-imp-label"></span>
      <div class="ai-star-rating" id="ai-form-stars">
        <span class="ai-star" data-value="1">★</span>
        <span class="ai-star" data-value="2">★</span>
        <span class="ai-star" data-value="3">★</span>
        <span class="ai-star" data-value="4">★</span>
        <span class="ai-star" data-value="5">★</span>
      </div>
    </div>
    <div class="ai-form-galaxy" id="ai-form-galaxy" style="display:none;">
      <span class="ai-form-galaxy-label" id="ai-form-galaxy-label"></span>
      <div class="ai-galaxy-track" id="ai-galaxy-track">
        <div class="ai-galaxy-stop" data-hub="1">🌌<b>۱</b></div>
        <div class="ai-galaxy-stop" data-hub="2">🌌<b>۲</b></div>
        <div class="ai-galaxy-stop" data-hub="3">🌌<b>۳</b></div>
        <div class="ai-galaxy-stop" data-hub="4">📰<b>N</b></div>
        <div class="ai-galaxy-knob" id="ai-galaxy-knob">🪐</div>
      </div>
    </div>
    <div class="ai-form-actions">
      <button id="ai-form-delete" class="ai-form-btn-delete" style="display:none;"></button>
      <button id="ai-form-move-galaxy" class="ai-form-btn-move" style="display:none;"></button>
      <button id="ai-form-move-core" class="ai-form-btn-move ai-form-btn-move-core" style="display:none;"></button>
      <button id="ai-form-cancel" class="ai-form-btn-cancel"></button>
      <button id="ai-form-save" class="ai-form-btn-save"></button>
    </div>`;

  const quickNoteForm = document.createElement('div'); quickNoteForm.id = 'ai-quick-note-form';
  quickNoteForm.innerHTML = `
    <div class="ai-note-header" id="ai-note-header">
      <span class="ai-note-header-title">NOTEPAD & AI</span>
      <div class="ai-note-header-actions">
        <button type="button" id="ai-note-newtab-btn" class="ai-note-newtab-btn" title="Open in new tab">⧉</button>
        <button type="button" id="ai-note-split-btn" class="ai-note-split-btn" title="Split view">▦</button>
        <button type="button" id="ai-note-pin-btn" class="ai-note-pin-btn" title="Pin Window">📌</button>
      </div>
    </div>
    <div class="ai-note-format-bar" id="ai-note-format-bar">
      <button type="button" id="ai-align-left-btn" class="ai-format-btn ai-align-icon ai-align-icon-left" title="Left"><span></span><span></span><span></span></button>
      <button type="button" id="ai-align-center-btn" class="ai-format-btn ai-align-icon ai-align-icon-center" title="Center"><span></span><span></span><span></span></button>
      <button type="button" id="ai-align-right-btn" class="ai-format-btn ai-align-icon ai-align-icon-right" title="Right"><span></span><span></span><span></span></button>
      <div class="ai-note-fontsize-wrap" id="ai-note-fontsize-wrap" title="Font size">
        <button type="button" id="ai-font-dec-btn" class="ai-format-btn ai-font-btn" aria-label="Decrease font size">A-</button>
        <span class="ai-font-size-label" id="ai-font-size-label">14</span>
        <button type="button" id="ai-font-inc-btn" class="ai-format-btn ai-font-btn" aria-label="Increase font size">A+</button>
      </div>
      <div class="ai-note-emoji-wrap" id="ai-note-emoji-wrap">
        <button type="button" id="ai-emoji-toggle-btn" class="ai-emoji-toggle-btn zt-btn" title="Emojis"><span data-zen-icon="emoji"></span></button>
        <button type="button" id="ai-emoji-online-btn" class="ai-emoji-online-btn zt-btn" title="Online"><span data-zen-icon="emojiOnline"></span></button>
        <div id="ai-emoji-popover" class="ai-emoji-popover" role="dialog"></div>
      </div>
      <button type="button" id="ai-note-mic-btn" class="ai-format-btn zt-btn zt-mic-btn" title="Voice Input" aria-label="Voice Input"><span data-zen-icon="mic"></span></button>
      <button type="button" id="ai-note-translate-btn" class="ai-format-btn ai-translate-btn zt-btn" title="Translate" aria-label="Translate text"><span data-zen-icon="translate"></span></button>
      <button type="button" id="ai-note-translate-lang-btn" class="ai-format-btn ai-translate-lang-btn zt-btn" title="Translate target language" aria-label="Translate target language">EN</button>
      <button type="button" id="ai-note-spellcheck-btn" class="ai-format-btn ai-spellcheck-btn zt-btn" title="Clean & Spell Check (FA/EN)" aria-label="Fix Spelling"><span data-zen-icon="spellcheck"></span></button>
      <button type="button" id="ai-note-tts-btn" class="ai-format-btn ai-tts-btn zt-btn" title="Read aloud" aria-label="Read aloud"><span data-zen-icon="tts"></span></button>
      <button type="button" id="ai-note-extract-doc-btn" class="ai-format-btn ai-extract-doc-btn zt-btn" title="Extract page to Markdown" aria-label="Extract page to Markdown"><span data-zen-icon="extractDoc"></span></button>
    </div>
    <input type="text" class="ai-note-tpl-search" id="ai-note-tpl-search" dir="auto" autocomplete="off" />
    <div class="ai-note-tpl-bar" id="ai-note-tpl-bar"></div>
    <div class="ai-note-text-wrap" id="ai-note-text-wrap">
      <textarea id="ai-note-text" rows="2" dir="auto"></textarea>
    </div>
    <div class="ai-note-status-row">
      <span id="ai-note-token-meter" class="ai-note-token-meter">0 chars · 0 tokens</span>
      <button type="button" id="ai-note-history-btn" class="ai-note-history-btn" title="Recent prompts">⏱</button>
      <div id="ai-note-history-menu" class="ai-note-history-menu"></div>
    </div>
    <div class="ai-note-toolbar">
      <button id="ai-note-clear-btn" class="ai-toolbar-btn" style="background: rgba(217, 119, 87, 0.22); color: #E8A088;"></button>
      <button id="ai-note-copy-btn" class="ai-toolbar-btn" style="background: rgba(16, 185, 129, 0.22); color: #34D399;"></button>
      <button id="ai-save-txt-btn" class="ai-toolbar-btn" style="background: rgba(255, 255, 255, 0.14); color: #fff;"></button>
      <div id="ai-social-share-wrap" class="ai-social-share-wrap">
        <button type="button" id="ai-social-toggle-btn" class="ai-social-toggle-btn" title="Share" aria-haspopup="menu" aria-expanded="false">
          <span id="ai-social-toggle-label">Share</span>
          <span class="ai-social-icon" aria-hidden="true">🔗</span>
        </button>
        <div id="ai-social-popover" class="ai-social-popover" role="menu"></div>
      </div>
      <div id="ai-smart-send-wrapper" class="ai-smart-send-wrapper" tabindex="0" role="listbox" aria-label="Ask AI">
        <button type="button" id="ai-send-action-btn" class="ai-send-action-btn">
          <span class="ai-send-dot" id="ai-send-dot"></span>
          <span class="ai-send-label" id="ai-send-label"></span>
          <span class="ai-send-method" id="ai-send-method"></span>
          <span class="ai-send-chevron" aria-hidden="true">⌄</span>
        </button>
        <div class="ai-wheel-popover" id="ai-wheel-popover">
          <div class="ai-wheel-viewport" id="ai-wheel-viewport">
            <div class="ai-wheel-list" id="ai-wheel-list"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="ai-note-resize-handle ai-note-resize-l" id="ai-note-resize-l" title="Resize width"></div>
    <div class="ai-note-resize-handle ai-note-resize-r" id="ai-note-resize-r" title="Resize width"></div>
    <div class="ai-note-resize-handle ai-note-resize-t" id="ai-note-resize-t" title="Resize height"></div>
    <div class="ai-note-resize-handle ai-note-resize-b" id="ai-note-resize-b" title="Resize height"></div>
    <div class="ai-note-resize-handle ai-note-resize-bl" id="ai-note-resize-bl" title="Resize"></div>
    <div class="ai-note-resize-handle ai-note-resize-br" id="ai-note-resize-br" title="Resize"></div>
  `;

  const calcPanel = document.createElement('div'); calcPanel.id = 'ai-calc-panel';
  calcPanel.innerHTML = `
    <div class="ai-calc-display">
      <div class="ai-calc-expr" id="calc-expr"></div>
      <div class="ai-calc-result" id="calc-display">0</div>
    </div>
    <div class="ai-calc-grid"></div>
  `;

const clockPanel = document.createElement('div'); clockPanel.id = 'ai-clock-panel';
  clockPanel.innerHTML = `
    <div class="ai-clock-halo"></div>
    <div class="ai-mark-event-sheet is-collapsed" id="ai-mark-event-sheet">
      <div class="ai-mark-event-body" id="ai-mark-event-body">
        <div class="ai-mark-event-inner">
          <div class="ai-mark-event-paper">
            <div class="ai-mark-event-badge" id="ai-mark-event-badge"></div>
            <div class="ai-mark-event-text" id="ai-mark-event-text"></div>
            <div class="ai-mark-event-meta" id="ai-mark-event-meta"></div>
            <label class="ai-mark-golden-toggle ai-mark-delete-toggle" id="ai-mark-delete-row">
              <input type="checkbox" id="ai-mark-delete-cb" class="ai-mark-golden-cb ai-mark-delete-cb" />
              <span class="ai-mark-star-btn ai-mark-delete-label" id="ai-mark-delete-label">🗑</span>
            </label>
            <div class="ai-mark-event-daily-list is-empty" id="ai-mark-event-daily-list"></div>
          </div>
        </div>
      </div>
      <button type="button" class="ai-mark-event-tab" id="ai-mark-event-tab" title="Event">
        <span class="ai-mark-event-tab-label" id="ai-mark-event-tab-label">📌</span>
        <span class="ai-mark-event-tab-chevron">▲</span>
      </button>
    </div>
    <div class="ai-clock-kicker"><span></span><span id="ai-clock-kicker-text">اکنون</span><span></span></div>
    <div class="ai-clock-time" id="ai-time">--:--</div>
    <div class="ai-clock-date-fa" id="ai-date-fa">...</div>
    <div class="ai-clock-date-en" id="ai-date-en">...</div>
    <div class="ai-clock-inline-row" id="ai-mark-dots-row">
      <button type="button" class="ai-clock-marks-toggle-btn ai-inline-toggle ai-inline-toggle-marks" id="ai-clock-marks-toggle" aria-label="Special days" aria-expanded="false">
        <svg viewBox="0 0 24 24" class="ai-inline-toggle-svg" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v3.2M16 3v3.2M4 9.5h16"/><path d="M9 14l2 2 4-4.4"/></svg>
      </button>
      <div class="ai-inline-dots" id="ai-mark-dots-inner"></div>
    </div>
    <div class="ai-clock-inline-row" id="ai-dash-dots-row">
      <button type="button" class="ai-clock-marks-toggle-btn ai-dash-toggle-btn ai-inline-toggle ai-inline-toggle-dash" id="ai-dash-toggle" aria-label="Today's agenda" aria-expanded="false">
        <svg viewBox="0 0 24 24" class="ai-inline-toggle-svg" aria-hidden="true"><circle cx="12" cy="12" r="8.3"/><path d="M12 7.6V12l2.9 1.9"/></svg>
        <span id="ai-dash-notify-dot" class="ai-dash-notify-dot"></span>
      </button>
      <div class="ai-inline-dots" id="ai-dash-dots-inner"></div>
    </div>
    <div class="ai-time-dashboard" id="ai-time-dashboard">
      <div class="ai-dash-next-event" id="ai-next-event-widget" style="display:none;"></div>
      <section class="ai-dash-todo-summary" id="ai-dash-todo-summary" aria-label="Today's tasks">
        <div class="ai-dash-todo-head"><span>✓</span><span id="ai-dash-todo-title">Today's tasks</span><span id="ai-dash-todo-count"></span></div>
        <div class="ai-dash-todo-list" id="ai-dash-todo-list"></div>
      </section>
      <div class="ai-timeline-container" id="ai-timeline-container">
        <div class="ai-timeline-now-line" id="ai-now-line" style="display:none;"><span class="ai-now-label" id="ai-now-label"></span></div>
        <div class="ai-timeline-content" id="ai-timeline-content"></div>
      </div>
      <button type="button" class="ai-dash-add-btn" id="ai-dash-add-btn" title="Add event" aria-label="Add event">+</button>
    </div>

    <!-- پنل کناری اختصاصی مناسبت‌ها و رویدادها (صفحه ۲) -->
    <div class="ai-clock-marks-panel" id="ai-clock-marks-panel">
      <!-- بخش ردیاب ۴ فصلی سال شمسی در بالای صفحه ثبت رویداد -->
      <section class="ai-season-context" id="ai-season-tracker" aria-live="polite">
        <div class="ai-season-tracker-head">
          <span class="ai-season-tracker-title" id="ai-season-current-title">--</span>
          <span class="ai-season-tracker-sub" id="ai-season-hemisphere">نیم‌کرهٔ شمالی</span>
        </div>
        <div class="ai-season-bars">
          <!-- بهار -->
          <div class="ai-season-card season-spring" data-season="spring" title="بهار">
            <div class="ai-season-fill"></div>
            <div class="ai-season-info">
              <span class="ai-season-name">بهار</span>
              <span class="ai-season-days" id="ai-days-spring">--</span>
            </div>
          </div>
          <!-- تابستان -->
          <div class="ai-season-card season-summer" data-season="summer" title="تابستان">
            <div class="ai-season-fill"></div>
            <div class="ai-season-info">
              <span class="ai-season-name">تابستان</span>
              <span class="ai-season-days" id="ai-days-summer">--</span>
            </div>
          </div>
          <!-- پاییز -->
          <div class="ai-season-card season-autumn" data-season="autumn" title="پاییز">
            <div class="ai-season-fill"></div>
            <div class="ai-season-info">
              <span class="ai-season-name">پاییز</span>
              <span class="ai-season-days" id="ai-days-autumn">--</span>
            </div>
          </div>
          <!-- زمستان -->
          <div class="ai-season-card season-winter" data-season="winter" title="زمستان">
            <div class="ai-season-fill"></div>
            <div class="ai-season-info">
              <span class="ai-season-name">زمستان</span>
              <span class="ai-season-days" id="ai-days-winter">--</span>
            </div>
          </div>
        </div>
      </section>

      <div class="ai-clock-birthday-row" id="ai-clock-birthday-row" hidden>
        <span class="ai-clock-birthday-label" id="ai-clock-birthday-label"></span>
        <div class="ai-clock-birthday-list" id="ai-clock-birthday-list"></div>
      </div>
      <ul class="ai-clock-marks-list" id="ai-clock-marks-list"></ul>
      <div class="ai-clock-marks-form">
        <!-- ردیف عنوان به همراه ستاره نشان‌دار (ماندگار) -->
        <div class="ai-mark-input-star-row">
          <input type="text" id="ai-mark-label-input" dir="auto" />
          <label class="ai-mark-golden-toggle" id="ai-mark-golden-row" title="رویداد سالانه و ماندگار">
            <input type="checkbox" id="ai-mark-golden-cb" class="ai-mark-golden-cb" />
            <span class="ai-mark-star-btn" id="ai-mark-golden-label">★</span>
          </label>
        </div>

        <div class="ai-smart-date-wrap">
          <input type="text" id="ai-smart-date" dir="ltr" autocomplete="off" inputmode="text" />
          <button type="button" id="ai-smart-date-picker-btn" title="Calendar">📅</button>
        </div>

        <div class="ai-dual-picker" id="ai-dual-picker" hidden>
          <div class="ai-dual-picker-header">
            <button type="button" id="ai-dual-prev" aria-label="Previous">‹</button>
            <span id="ai-dual-month-label"></span>
            <button type="button" id="ai-dual-next" aria-label="Next">›</button>
          </div>
          <div class="ai-dual-month-sublabel" id="ai-dual-month-sublabel"></div>
          <div class="ai-dual-weekdays" id="ai-dual-weekdays"></div>
          <div class="ai-dual-grid" id="ai-dual-grid"></div>
        </div>

      <button type="button" id="ai-mark-add-btn"></button>
      </div>
    </div>

 <!-- نوار افق مسیر زندگی و شمارنده سن (مربوط به صفحه اصلی ساعت) -->
    <div class="ai-life-journey" id="ai-life-journey" style="display: none;">
      <div class="ai-life-horizon">
        <span class="ai-life-origin"></span>
        <span class="ai-life-path"></span>
        <span class="ai-life-now"></span>
      </div>
      <div class="ai-life-copy">
        <span id="ai-life-start">آغاز</span>
        <span id="ai-life-caption"></span>
        <span id="ai-life-now-label">اکنون</span>
      </div>
      <div class="ai-life-birth" id="ai-life-birth" hidden></div>
      <button type="button" class="ai-family-paper-toggle" id="ai-family-ages-toggle" style="display:none;" aria-expanded="false">
        <span class="ai-family-paper-toggle-label" id="ai-family-ages-toggle-label"></span>
        <span class="ai-family-paper-toggle-chevron">▾</span>
      </button>
      <div class="ai-family-paper" id="ai-family-ages-list" style="display:none;" hidden></div>
    </div>
    <div class="ai-clock-age" id="ai-age" style="display: none;"></div>

    <div class="ai-clock-quote" id="ai-clock-quote">
      <button type="button" class="ai-rumi-tab" id="ai-rumi-tab" title="شعر روز">
        <span class="ai-rumi-tab-chevron" id="ai-rumi-tab-chevron">▼</span>
        <span class="ai-rumi-tab-label" id="ai-rumi-tab-label">🌙</span>
      </button>
      <div class="ai-clock-quote-body" id="ai-clock-quote-body">
        <div class="ai-clock-quote-inner">
          <div class="ai-clock-quote-paper">
            <button type="button" class="ai-quote-copy-btn" id="ai-rumi-copy-btn" title="Copy full text" aria-label="Copy full text">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
            <div class="ai-clock-quote-text" id="ai-clock-quote-text"></div>
            <div class="ai-clock-quote-title" id="ai-clock-quote-title"></div>
            <div class="ai-quote-source-tabs" id="ai-clock-quote-source-tabs">
              <button type="button" class="ai-quote-source-tab" data-key="rumi">🌙</button>
              <button type="button" class="ai-quote-source-tab" data-key="western">🖋️</button>
            </div>
            <svg class="ai-torn-edge" viewBox="0 0 500 18" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M0,0 L0,6 L14,12 L31,5 L52,14 L73,4 L91,15 L118,6 L139,13 L162,3 L185,11 L209,4 L231,14 L258,7 L284,15 L312,5 L337,12 L361,4 L389,14 L413,6 L438,13 L464,5 L485,11 L500,4 L500,0 Z"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  `;

  const searchPanel = document.createElement('div'); searchPanel.id = 'ai-search-panel';
  searchPanel.innerHTML = `
    <div class="ai-cat-accordion ai-cat-accordion-search" id="ai-search-cat-accordion">
      <button type="button" class="ai-cat-accordion-toggle" id="ai-search-cat-toggle">
        <span id="ai-search-cat-toggle-label"></span>
        <span class="ai-cat-accordion-chevron">▾</span>
      </button>
      <div class="ai-cat-grid" id="ai-search-cat-grid"></div>
    </div>
    <div class="ai-search-section-label" id="ai-bookmark-search-label"></div>
    <input type="text" id="ai-search-input" dir="auto" autocomplete="off" />
    <ul id="ai-search-results"></ul>
    <button type="button" class="ai-web-search-toggle" id="ai-web-search-toggle" aria-expanded="false">
      <span class="ai-web-search-toggle-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="M16.2 16.2L21 21"/></svg></span>
      <span id="ai-web-search-toggle-label"></span>
      <span class="ai-web-search-toggle-chevron">▾</span>
    </button>
    <div class="ai-web-search-drawer" id="ai-web-search-drawer" hidden>
      <div class="ai-web-search-meta">
        <div class="ai-web-search-heading">
          <span class="ai-web-search-section-label" id="ai-web-search-section-label"></span>
          <button type="button" class="ai-web-engine-add" id="ai-web-engine-add-btn">+</button>
        </div>
        <div class="ai-web-search-engines" id="ai-web-search-engines"></div>
        <div class="ai-web-engine-form" id="ai-web-engine-form" hidden>
          <input type="text" id="ai-web-engine-form-name" dir="auto" autocomplete="off" />
          <input type="text" id="ai-web-engine-form-url" dir="ltr" autocomplete="off" />
          <div class="ai-web-engine-form-actions">
            <button type="button" class="ai-web-engine-save" id="ai-web-engine-form-save"></button>
            <button type="button" class="ai-web-engine-cancel" id="ai-web-engine-form-cancel"></button>
            <button type="button" class="ai-web-engine-reset" id="ai-web-engine-form-reset" hidden></button>
            <button type="button" class="ai-web-engine-delete" id="ai-web-engine-form-delete" hidden></button>
          </div>
        </div>
      </div>
      <div class="ai-web-search-row">
        <input type="text" id="ai-web-search-input" dir="auto" autocomplete="off" />
        <button type="button" id="ai-web-search-mode" class="ai-web-search-mode-mini" aria-pressed="false" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="4.2"/><path d="M12 8.2c1.4 0 2.6.8 3.2 2"/></svg></button>
        <button type="button" id="ai-web-search-go" class="ai-web-search-go" aria-label="Search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="M16.2 16.2L21 21"/></svg></button>
      </div>
    </div>
  `;

  const tierDotsNav = document.createElement('div'); tierDotsNav.id = 'ai-tier-dots';
  const hubDotsNav = document.createElement('div'); hubDotsNav.id = 'ai-hub-dots';

  const todoPanel = document.createElement('div'); todoPanel.id = 'ai-todo-panel';
  todoPanel.innerHTML = `
    <div class="ai-todo-quote" id="ai-todo-quote">
      <button type="button" class="ai-quote-tab" id="ai-quote-tab" title="آیه روز">
        <span class="ai-quote-tab-label" id="ai-quote-tab-label">☀️</span>
        <span class="ai-quote-tab-chevron" id="ai-quote-tab-chevron">▲</span>
      </button>
      <div class="ai-todo-quote-body" id="ai-todo-quote-body">
        <button type="button" class="ai-quote-copy-btn" id="ai-quote-copy-btn" title="Copy full text" aria-label="Copy full text">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        </button>
        <div class="ai-todo-quote-fa" id="ai-todo-quote-fa"></div>
        <div class="ai-todo-quote-translation" id="ai-todo-quote-translation"></div>
        <div class="ai-todo-quote-title" id="ai-todo-quote-title"></div>
        <div class="ai-quote-source-tabs" id="ai-todo-quote-source-tabs">
          <button type="button" class="ai-quote-source-tab" data-key="islam">☪️</button>
          <button type="button" class="ai-quote-source-tab" data-key="judaism">✡️</button>
          <button type="button" class="ai-quote-source-tab" data-key="christianity">✝️</button>
          <button type="button" class="ai-quote-source-tab" data-key="eastern">☸️</button>
        </div>
      </div>
    </div>
    <div class="ai-todo-header">
      <span id="ai-todo-main-title"></span>
      <span class="ai-todo-count" id="ai-todo-count">0</span>
    </div>
    <div class="ai-todo-tabs">
      <button class="ai-todo-tab active" id="ai-todo-tab-daily" data-type="daily"></button>
      <button class="ai-todo-tab" id="ai-todo-tab-goal" data-type="goal"></button>
    </div>
    <div class="ai-todo-when-row" id="ai-todo-when-row">
      <button type="button" class="ai-todo-when-btn active" id="ai-todo-when-today" data-when="today"></button>
      <button type="button" class="ai-todo-when-btn" id="ai-todo-when-tomorrow" data-when="tomorrow"></button>
    </div>
    <div class="ai-todo-input-row">
      <input type="text" id="ai-todo-input" dir="auto" />
      <button id="ai-todo-add-btn"></button>
    </div>
    <ul id="ai-todo-list"></ul>
  `;

  const toastBox = document.createElement('div'); toastBox.className = 'ai-toast-notification';

  const starEditorPopup = document.createElement('div'); starEditorPopup.id = 'ai-star-editor-popup';
  starEditorPopup.innerHTML = `
    <span class="ai-star-edit" data-value="1">★</span>
    <span class="ai-star-edit" data-value="2">★</span>
    <span class="ai-star-edit" data-value="3">★</span>
    <span class="ai-star-edit" data-value="4">★</span>
    <span class="ai-star-edit" data-value="5">★</span>`;

  root.classList.add('orbit-root'); hub.classList.add('orbit-hub');
  root.appendChild(quantumBloom);
  addNodeBtn.classList.add('orbit-add-node'); inlineForm.classList.add('orbit-inline-form');
  starEditorPopup.classList.add('orbit-star-editor');

  root.appendChild(hub); root.appendChild(addNodeBtn);

  const mountFragment = document.createDocumentFragment();
  mountFragment.append(root, inlineForm, quickNoteForm, calcPanel, clockPanel, todoPanel, searchPanel, tierDotsNav, hubDotsNav, toastBox, starEditorPopup);

  function getProtectedMountTarget() {
    // Prefer <html> so React/Next route swaps of <body> children cannot wipe the launcher.
    return document.documentElement || document.body;
  }
  let launcherVisibilityReady = false;
  let lastLauncherVisibility = null;
  let launcherIdleHidden = false;
  function launcherIsActuallyVisible() {
    if (!root.isConnected || root.style.display === 'none' || root.style.visibility === 'hidden' ||
        root.style.opacity === '0' || root.style.pointerEvents === 'none' || root.hasAttribute('inert') || launcherIdleHidden) return false;
    try {
      const style = window.getComputedStyle(root);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse' &&
        style.pointerEvents !== 'none';
    } catch (err) { return false; }
  }
  function reportLauncherVisibility(force) {
    if (!launcherVisibilityReady) return;
    const visible = launcherIsActuallyVisible();
    if (!force && visible === lastLauncherVisibility) return;
    lastLauncherVisibility = visible;
    try {
      chrome.runtime.sendMessage({ type: 'void-launcher-visibility', visible: visible }, () => {
        void chrome.runtime.lastError;
      });
    } catch (err) {}
  }
  function mountWidget() {
    const target = getProtectedMountTarget();
    if (target) target.appendChild(mountFragment);
    reportLauncherVisibility();
  }
  if (document.body || document.documentElement) { mountWidget(); }
  else { document.addEventListener('DOMContentLoaded', mountWidget); }

  // اگر این دامنه قبلاً از طریق دکمه‌ی «Hide» در پاپ‌آپ مخفی شده، باید در تمام
  // زیرصفحه‌های همین دامنه (نه فقط همان تبی که مخفی‌اش کرده بود) مخفی بماند، تا
  // وقتی کاربر خودش دکمه‌ی «Show (Reset)» را بزند. برخلاف چک دامنه‌های ورود
  // (accounts.google.com و…) که کامل از تزریق صرف‌نظر می‌کند، اینجا باید عادی
  // mount شویم — چون همان دکمه‌ی Show باید بدون رفرش صفحه دوباره نشانش بدهد، و
  // برای آن پیام‌رسانی زنده به همین content script لازم است.
  try {
    if (chrome.runtime?.id) {
      chrome.storage.local.get(['aiTreeHiddenDomains'], (res) => {
        const hiddenDomains = Array.isArray(res.aiTreeHiddenDomains) ? res.aiTreeHiddenDomains : [];
        if (hiddenDomains.includes(window.location.hostname)) root.style.display = 'none';
        launcherVisibilityReady = true;
        reportLauncherVisibility();
      });
    } else {
      launcherVisibilityReady = true;
      reportLauncherVisibility();
    }
  } catch (e) {
    launcherVisibilityReady = true;
    reportLauncherVisibility();
  }

  const noteTextarea = quickNoteForm.querySelector('#ai-note-text');

  const uiEls = {
    formMainTitle: inlineForm.querySelector('#ai-form-main-title'),
    formUrl: inlineForm.querySelector('#ai-form-url'),
    formLabel: inlineForm.querySelector('#ai-form-label'),
    formDescription: inlineForm.querySelector('#ai-form-description'),
    formTags: inlineForm.querySelector('#ai-form-tags'),
    formTagsSuggest: inlineForm.querySelector('#ai-tags-suggest'),
    formCatToggle: inlineForm.querySelector('#ai-form-cat-toggle'),
    formCatToggleLabel: inlineForm.querySelector('#ai-form-cat-toggle-label'),
    formCatAccordion: inlineForm.querySelector('#ai-form-cat-accordion'),
    formCatGrid: inlineForm.querySelector('#ai-form-cat-grid'),
    formGalaxyWrap: inlineForm.querySelector('#ai-form-galaxy'),
    formGalaxyLabel: inlineForm.querySelector('#ai-form-galaxy-label'),
    formGalaxyTrack: inlineForm.querySelector('#ai-galaxy-track'),
    formGalaxyKnob: inlineForm.querySelector('#ai-galaxy-knob'),
    formImpLabel: inlineForm.querySelector('#ai-form-imp-label'),
    formImportanceWrap: inlineForm.querySelector('.ai-form-importance'),
    formCancel: inlineForm.querySelector('#ai-form-cancel'),
    formDelete: inlineForm.querySelector('#ai-form-delete'),
    formMoveGalaxy: inlineForm.querySelector('#ai-form-move-galaxy'),
    formMoveCore: inlineForm.querySelector('#ai-form-move-core'),
    formSave: inlineForm.querySelector('#ai-form-save'),
    noteText: quickNoteForm.querySelector('#ai-note-text'),
    noteNewTabBtn: quickNoteForm.querySelector('#ai-note-newtab-btn'),
    noteClearBtn: quickNoteForm.querySelector('#ai-note-clear-btn'),
    noteCopyBtn: quickNoteForm.querySelector('#ai-note-copy-btn'),
    saveTxtBtn: quickNoteForm.querySelector('#ai-save-txt-btn'),
    alignRightBtn: quickNoteForm.querySelector('#ai-align-right-btn'),
    alignCenterBtn: quickNoteForm.querySelector('#ai-align-center-btn'),
    alignLeftBtn: quickNoteForm.querySelector('#ai-align-left-btn'),
    fontDecBtn: quickNoteForm.querySelector('#ai-font-dec-btn'),
    fontIncBtn: quickNoteForm.querySelector('#ai-font-inc-btn'),
    fontSizeLabel: quickNoteForm.querySelector('#ai-font-size-label'),
    emojiWrap: quickNoteForm.querySelector('#ai-note-emoji-wrap'),
    emojiToggleBtn: quickNoteForm.querySelector('#ai-emoji-toggle-btn'),
    emojiOnlineBtn: quickNoteForm.querySelector('#ai-emoji-online-btn'),
    emojiPopover: quickNoteForm.querySelector('#ai-emoji-popover'),
    micBtn: quickNoteForm.querySelector('#ai-note-mic-btn'),
    formatBar: quickNoteForm.querySelector('#ai-note-format-bar'),
    translateBtn: quickNoteForm.querySelector('#ai-note-translate-btn'),
    translateLangBtn: quickNoteForm.querySelector('#ai-note-translate-lang-btn'),
    spellcheckBtn: quickNoteForm.querySelector('#ai-note-spellcheck-btn'),
    ttsBtn: quickNoteForm.querySelector('#ai-note-tts-btn'),
    extractDocBtn: quickNoteForm.querySelector('#ai-note-extract-doc-btn'),
    socialWrap: quickNoteForm.querySelector('#ai-social-share-wrap'),
    socialToggleBtn: quickNoteForm.querySelector('#ai-social-toggle-btn'),
    socialToggleLabel: quickNoteForm.querySelector('#ai-social-toggle-label'),
    socialPopover: quickNoteForm.querySelector('#ai-social-popover'),
    textWrap: quickNoteForm.querySelector('#ai-note-text-wrap'),
    tplBar: quickNoteForm.querySelector('#ai-note-tpl-bar'),
    tplSearch: quickNoteForm.querySelector('#ai-note-tpl-search'),
    tokenMeter: quickNoteForm.querySelector('#ai-note-token-meter'),
    historyBtn: quickNoteForm.querySelector('#ai-note-history-btn'),
    historyMenu: quickNoteForm.querySelector('#ai-note-history-menu'),
    sendWrapper: quickNoteForm.querySelector('#ai-smart-send-wrapper'),
    sendActionBtn: quickNoteForm.querySelector('#ai-send-action-btn'),
    sendDot: quickNoteForm.querySelector('#ai-send-dot'),
    sendLabelEl: quickNoteForm.querySelector('#ai-send-label'),
    sendMethodEl: quickNoteForm.querySelector('#ai-send-method'),
    wheelPopover: quickNoteForm.querySelector('#ai-wheel-popover'),
    wheelViewport: quickNoteForm.querySelector('#ai-wheel-viewport'),
    wheelList: quickNoteForm.querySelector('#ai-wheel-list'),
    todoMainTitle: todoPanel.querySelector('#ai-todo-main-title'),
    todoInput: todoPanel.querySelector('#ai-todo-input'),
    todoAddBtn: todoPanel.querySelector('#ai-todo-add-btn'),
    todoTabDaily: todoPanel.querySelector('#ai-todo-tab-daily'),
    todoTabGoal: todoPanel.querySelector('#ai-todo-tab-goal'),
    todoQuoteTitle: todoPanel.querySelector('#ai-todo-quote-title'),
    todoQuoteFa: todoPanel.querySelector('#ai-todo-quote-fa'),
    todoQuoteTranslation: todoPanel.querySelector('#ai-todo-quote-translation'),
    todoQuoteBody: todoPanel.querySelector('#ai-todo-quote-body'),
    todoQuoteCopy: todoPanel.querySelector('#ai-quote-copy-btn'),
    todoQuoteTab: todoPanel.querySelector('#ai-quote-tab'),
    todoQuoteChevron: todoPanel.querySelector('#ai-quote-tab-chevron'),
    todoQuoteLabel: todoPanel.querySelector('#ai-quote-tab-label'),
    todoQuote: todoPanel.querySelector('#ai-todo-quote'),
    todoQuoteSourceTabs: todoPanel.querySelector('#ai-todo-quote-source-tabs'),
    searchInput: searchPanel.querySelector('#ai-search-input'),
    searchResults: searchPanel.querySelector('#ai-search-results'),
    searchCatToggle: searchPanel.querySelector('#ai-search-cat-toggle'),
    searchCatToggleLabel: searchPanel.querySelector('#ai-search-cat-toggle-label'),
    searchCatAccordion: searchPanel.querySelector('#ai-search-cat-accordion'),
    searchCatGrid: searchPanel.querySelector('#ai-search-cat-grid'),
    bookmarkSearchLabel: searchPanel.querySelector('#ai-bookmark-search-label'),
    webSearchToggle: searchPanel.querySelector('#ai-web-search-toggle'),
    webSearchToggleLabel: searchPanel.querySelector('#ai-web-search-toggle-label'),
    webSearchDrawer: searchPanel.querySelector('#ai-web-search-drawer'),
    webSearchSectionLabel: searchPanel.querySelector('#ai-web-search-section-label'),
    webSearchAddBtn: searchPanel.querySelector('#ai-web-engine-add-btn'),
    webSearchEngines: searchPanel.querySelector('#ai-web-search-engines'),
    webSearchEngineForm: searchPanel.querySelector('#ai-web-engine-form'),
    webSearchEngineFormName: searchPanel.querySelector('#ai-web-engine-form-name'),
    webSearchEngineFormUrl: searchPanel.querySelector('#ai-web-engine-form-url'),
    webSearchEngineFormSave: searchPanel.querySelector('#ai-web-engine-form-save'),
    webSearchEngineFormCancel: searchPanel.querySelector('#ai-web-engine-form-cancel'),
    webSearchEngineFormReset: searchPanel.querySelector('#ai-web-engine-form-reset'),
    webSearchEngineFormDelete: searchPanel.querySelector('#ai-web-engine-form-delete'),
    webSearchInput: searchPanel.querySelector('#ai-web-search-input'),
    webSearchMode: searchPanel.querySelector('#ai-web-search-mode'),
    webSearchGo: searchPanel.querySelector('#ai-web-search-go'),
    todoWhenRow: todoPanel.querySelector('#ai-todo-when-row'),
    todoWhenToday: todoPanel.querySelector('#ai-todo-when-today'),
    todoWhenTomorrow: todoPanel.querySelector('#ai-todo-when-tomorrow'),
    markDotsRow: clockPanel.querySelector('#ai-mark-dots-row'),
    markDotsInner: clockPanel.querySelector('#ai-mark-dots-inner'),
    dashDotsRow: clockPanel.querySelector('#ai-dash-dots-row'),
    dashDotsInner: clockPanel.querySelector('#ai-dash-dots-inner'),
    markToggle: clockPanel.querySelector('#ai-clock-marks-toggle'),
    dashToggle: clockPanel.querySelector('#ai-dash-toggle'),
    dashPanel: clockPanel.querySelector('#ai-time-dashboard'),
    nextEventWidget: clockPanel.querySelector('#ai-next-event-widget'),
    timelineContainer: clockPanel.querySelector('#ai-timeline-container'),
    timelineContent: clockPanel.querySelector('#ai-timeline-content'),
    nowLine: clockPanel.querySelector('#ai-now-line'),
    nowLabel: clockPanel.querySelector('#ai-now-label'),
    dashAddBtn: clockPanel.querySelector('#ai-dash-add-btn'),
    dashTodoSummary: clockPanel.querySelector('#ai-dash-todo-summary'),
    dashTodoList: clockPanel.querySelector('#ai-dash-todo-list'),
    dashTodoCount: clockPanel.querySelector('#ai-dash-todo-count'),
    dashNotifyDot: clockPanel.querySelector('#ai-dash-notify-dot'),
    markPanel: clockPanel.querySelector('#ai-clock-marks-panel'),
    birthdayRow: clockPanel.querySelector('#ai-clock-birthday-row'),
    birthdayLabel: clockPanel.querySelector('#ai-clock-birthday-label'),
    birthdayList: clockPanel.querySelector('#ai-clock-birthday-list'),
    markList: clockPanel.querySelector('#ai-clock-marks-list'),
    markLabelInput: clockPanel.querySelector('#ai-mark-label-input'),
    smartDateInput: clockPanel.querySelector('#ai-smart-date'),
    smartDatePickerBtn: clockPanel.querySelector('#ai-smart-date-picker-btn'),
    dualPicker: clockPanel.querySelector('#ai-dual-picker'),
    dualPrev: clockPanel.querySelector('#ai-dual-prev'),
    dualNext: clockPanel.querySelector('#ai-dual-next'),
    dualMonthLabel: clockPanel.querySelector('#ai-dual-month-label'),
    dualMonthSublabel: clockPanel.querySelector('#ai-dual-month-sublabel'),
    dualWeekdays: clockPanel.querySelector('#ai-dual-weekdays'),
    dualGrid: clockPanel.querySelector('#ai-dual-grid'),
    markAddBtn: clockPanel.querySelector('#ai-mark-add-btn'),
    markGoldenCb: clockPanel.querySelector('#ai-mark-golden-cb'),
    markGoldenRow: clockPanel.querySelector('#ai-mark-golden-row'),
    markGoldenLabel: clockPanel.querySelector('#ai-mark-golden-label'),
    markEventSheet: clockPanel.querySelector('#ai-mark-event-sheet'),
    markEventTab: clockPanel.querySelector('#ai-mark-event-tab'),
    markEventBadge: clockPanel.querySelector('#ai-mark-event-badge'),
    markEventText: clockPanel.querySelector('#ai-mark-event-text'),
    markEventMeta: clockPanel.querySelector('#ai-mark-event-meta'),
    markDeleteRow: clockPanel.querySelector('#ai-mark-delete-row'),
    markDeleteCb: clockPanel.querySelector('#ai-mark-delete-cb'),
    markEventDailyList: clockPanel.querySelector('#ai-mark-event-daily-list'),
    clockQuote: clockPanel.querySelector('#ai-clock-quote'),
    clockQuoteTab: clockPanel.querySelector('#ai-rumi-tab'),
    clockQuoteChevron: clockPanel.querySelector('#ai-rumi-tab-chevron'),
    clockQuoteLabel: clockPanel.querySelector('#ai-rumi-tab-label'),
    clockQuoteBody: clockPanel.querySelector('#ai-clock-quote-body'),
    clockQuoteText: clockPanel.querySelector('#ai-clock-quote-text'),
    clockQuoteTitle: clockPanel.querySelector('#ai-clock-quote-title'),
    clockQuoteCopy: clockPanel.querySelector('#ai-rumi-copy-btn'),
    clockQuoteSourceTabs: clockPanel.querySelector('#ai-clock-quote-source-tabs'),
  };

  // --- Zen Toolbar: SVG icons + dock magnification + microphone wiring ---
  // (تعریف‌شده در toolbar-icons.js / toolbar-dock.js / voice-engine.js —
  // هر سه به‌عنوان content_scripts قبل از content.js لود می‌شوند)
  if (typeof mountZenIcons === 'function') mountZenIcons(quickNoteForm);
  if (typeof AITreeZenDock !== 'undefined' && uiEls.formatBar) {
    AITreeZenDock.initDock(uiEls.formatBar);
  }

  // --- میکروفون در ویجت شناور ---------------------------------------------
  // عمداً دیگر AITreeZenDock.wireMicButton اینجا صدا زده نمی‌شود، یعنی خودِ
  // فرایند ضبط/رونویسی دیگر داخل دفترچهٔ ویجت اجرا نمی‌شود. دلیل: این فرم
  // می‌تواند در میانهٔ ضبط بسته یا بازسازی شود (بستن ویجت، DOM Watchdog که پس
  // از تغییر مسیر SPA دوباره ویجت را تزریق می‌کند، حالت هول‌ریلانچ و غیره) —
  // در حالی که AITreeVoiceEngine و Offscreen Document مستقل از چرخهٔ حیات این
  // فرم به کارشان ادامه می‌دهند. نتیجه: ضبط یتیم می‌ماند و HUD/tooltipِ «در حال
  // شنیدن» هرگز پاک نمی‌شود چون چیزی دیگر آن را نمی‌بیند تا ببندد.
  // به‌جایش این دکمه فقط دفترچهٔ مستقل تمام‌صفحه را باز می‌کند (notepad.html —
  // یک‌بار لود می‌شود، چرخهٔ حیاتش پایدار است، هرگز توسط Watchdog بازسازی
  // نمی‌شود) و با ?autoVoice=1 همان‌جا خودکار ضبط را شروع می‌کند، تا کاربر
  // عملاً همان تجربهٔ یک‌کلیکی قبلی را حس کند.
  if (uiEls.micBtn) {
    if (typeof AITreeVoiceEngine === 'undefined' || !AITreeVoiceEngine.isSupported()) {
      uiEls.micBtn.style.display = 'none';
    } else {
      const micTitle = 'تایپ صوتی (باز شدن در دفترچهٔ کامل) / Voice input (opens in full notepad)';
      uiEls.micBtn.title = micTitle;
      uiEls.micBtn.setAttribute('aria-label', micTitle);
      uiEls.micBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        try {
          if (!chrome.runtime?.id) return;
          const flush = { savedPromptDraft: noteTextarea ? noteTextarea.value : '' };
          chrome.storage.local.set(flush, () => {
            chrome.runtime.sendMessage({ action: 'openNotepadTab', autoVoice: true }, () => {
              // No response handler needed; swallow "no receiver" errors when SW is asleep/waking.
              void chrome.runtime.lastError;
            });
          });
        } catch (err) {}
      });
    }
  }

  // --- Galactic Constellation tooltips (replaces native title on hub toggles) ---
  const GALAXY_ICONS = {
    note: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3.5l4.5 4.5-9.2 9.2-5.1 1.3 1.3-5.1L14 3.5z" stroke-opacity="0.75"/><path d="M13.2 4.3l4.5 4.5" stroke-opacity="0.45"/><circle cx="7.2" cy="16.8" r="1.6" fill="#10B981" stroke="none"/><circle cx="14" cy="3.5" r="1.35" fill="currentColor" stroke="none"/><circle cx="18.5" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="10.2" cy="12.2" r="1.1" fill="currentColor" stroke-opacity="0.7"/></svg>`,
    todo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="4.5" width="15" height="15" rx="2.5" stroke-opacity="0.55"/><path d="M8 12.2l2.2 2.2 5-5.2" stroke-opacity="0.85"/><circle cx="8" cy="12.2" r="1.35" fill="#818CF8" stroke="none"/><circle cx="10.2" cy="14.4" r="1.15" fill="currentColor" stroke="none"/><circle cx="15.2" cy="9.2" r="1.15" fill="currentColor" stroke="none"/><circle cx="12" cy="4.5" r="1.1" fill="currentColor" stroke-opacity="0.7"/></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.2" stroke-opacity="0.7"/><path d="M16 16l4.2 4.2" stroke-opacity="0.75"/><path d="M11 6.5v1.2M11 14.3v1.2M6.5 11h1.2M14.3 11h1.2" stroke-opacity="0.45"/><circle cx="11" cy="11" r="1.7" fill="#00D2FF" stroke="none"/><circle cx="20.2" cy="20.2" r="1.2" fill="currentColor" stroke="none"/><circle cx="7.2" cy="7.2" r="1.05" fill="currentColor" stroke-opacity="0.7"/></svg>`,
    all: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2.2" fill="#94A3B8" stroke="none"/><circle cx="12" cy="4.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="18.5" cy="8.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="18.5" cy="15.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="19.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="5.5" cy="15.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="5.5" cy="8.5" r="1.3" fill="currentColor" stroke="none"/><path d="M12 6.7v2.6M16.4 9.7l-2.2 1.3M16.4 14.3l-2.2-1.3M12 14.7v2.6M7.6 14.3l2.2-1.3M7.6 9.7l2.2 1.3" stroke-opacity="0.55"/></svg>`,
    calc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6h12M6 12h12M6 18h12M8 6v12M16 6v12" stroke-opacity="0.55"/><circle cx="8" cy="6" r="1.45" fill="currentColor" stroke="none"/><circle cx="16" cy="6" r="1.45" fill="currentColor" stroke="none"/><circle cx="8" cy="12" r="1.7" fill="#FA8072" stroke="none"/><circle cx="16" cy="12" r="1.45" fill="currentColor" stroke="none"/><circle cx="8" cy="18" r="1.45" fill="currentColor" stroke="none"/><circle cx="16" cy="18" r="1.45" fill="currentColor" stroke="none"/></svg>`,
    clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8" stroke-opacity="0.55"/><path d="M12 12l3.2-2.4" stroke-opacity="0.85"/><path d="M12 4.5v1.4M19.5 12h-1.4M12 19.5v-1.4M4.5 12h1.4" stroke-opacity="0.4"/><circle cx="12" cy="12" r="1.55" fill="#3B82F6" stroke="none"/><circle cx="15.2" cy="9.6" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="4.5" r="1.1" fill="currentColor" stroke-opacity="0.7"/></svg>`,
    undo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 8.2L5 11.7l3.5 3.5" stroke-opacity="0.85"/><path d="M5 11.7h9.2a5 5 0 0 1 0 10H11" stroke-opacity="0.55"/><circle cx="5" cy="11.7" r="1.55" fill="#FBBF24" stroke="none"/><path d="M17.2 5.4l0.85 1.75 1.75 0.85-1.75 0.85-0.85 1.75-0.85-1.75-1.75-0.85 1.75-0.85z" fill="#FBBF24" stroke="none"/><circle cx="14.2" cy="11.7" r="1.05" fill="currentColor" stroke="none"/><circle cx="19" cy="16.5" r="1" fill="currentColor" stroke-opacity="0.7"/></svg>`,
    collapse: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7.5" stroke-opacity="0.5"/><circle cx="12" cy="12" r="3.2" stroke-opacity="0.75"/><circle cx="12" cy="12" r="1.5" fill="#BAE6FD" stroke="none"/><circle cx="12" cy="4.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="19.5" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="19.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.1" fill="currentColor" stroke="none"/></svg>`
  };

  function setGalaxyTooltip(toggleEl, titleText, svgIconHtml, side) {
    if (!toggleEl) return;
    toggleEl.removeAttribute('title');

    // Remove legacy text tooltip if present
    const oldTip = toggleEl.querySelector('.ai-galaxy-tooltip');
    if (oldTip) oldTip.remove();

    // Side constellation badge: icon + compact text label (outward of hub) — no colored dots
    const sideClass = side === 'left' || side === 'right' || side === 'top' || side === 'bottom' ? side : 'right';
    let badge = toggleEl.querySelector('.ai-constellation-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'ai-constellation-badge';
      badge.innerHTML = `
        <div class="ai-constellation-icon-col">
          <div class="ai-constellation-icon"></div>
          <span class="ai-constellation-label"></span>
        </div>
      `;
      toggleEl.appendChild(badge);
    } else {
      // Remove legacy colored dots if present
      badge.querySelectorAll('.ai-constellation-dot').forEach(d => d.remove());
    }
    badge.className = 'ai-constellation-badge side-' + sideClass;
    if (titleText) badge.setAttribute('aria-label', titleText);
    const iconWrap = badge.querySelector('.ai-constellation-icon');
    if (iconWrap && svgIconHtml) iconWrap.innerHTML = svgIconHtml;
    let labelEl = badge.querySelector('.ai-constellation-label');
    if (!labelEl) {
      // Migrate older badge markup (icon-only) to include a text label under the icon
      const oldIcon = badge.querySelector('.ai-constellation-icon');
      const col = document.createElement('div');
      col.className = 'ai-constellation-icon-col';
      labelEl = document.createElement('span');
      labelEl.className = 'ai-constellation-label';
      if (oldIcon) {
        oldIcon.replaceWith(col);
        col.appendChild(oldIcon);
      } else {
        const iconDiv = document.createElement('div');
        iconDiv.className = 'ai-constellation-icon';
        col.appendChild(iconDiv);
        badge.appendChild(col);
      }
      col.appendChild(labelEl);
    }
    if (titleText) {
      // Strip leading emoji for a cleaner micro-label under the icon
      labelEl.textContent = String(titleText).replace(/^\s*[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*/u, '').trim() || titleText;
    }
  }

  // Hub-center hold hint: only after ~3s hover on the hub body (not on toggle dots)
  let hubHoldHintTimer = null;
  let hubHoldHintEl = null;
  function ensureHubHoldHintEl() {
    if (hubHoldHintEl && hubHoldHintEl.isConnected) return hubHoldHintEl;
    hubHoldHintEl = document.createElement('div');
    hubHoldHintEl.id = 'ai-hub-hold-hint';
    hubHoldHintEl.className = 'ai-hub-hold-hint';
    hubHoldHintEl.setAttribute('role', 'tooltip');
    root.appendChild(hubHoldHintEl);
    return hubHoldHintEl;
  }
  function hideHubHoldHint() {
    clearTimeout(hubHoldHintTimer);
    hubHoldHintTimer = null;
    if (hubHoldHintEl) hubHoldHintEl.classList.remove('visible');
  }
  function scheduleHubHoldHint() {
    clearTimeout(hubHoldHintTimer);
    hubHoldHintTimer = setTimeout(() => {
      if (hub.classList.contains('hub-collapsed') || isDragging || quickAddActive) return;
      const el = ensureHubHoldHintEl();
      el.textContent = t('hubHoldHint');
      el.classList.add('visible');
    }, 3000);
  }
  function isHubCenterTarget(target) {
    if (!target || !hub.contains(target)) return false;
    // Toggles / spacing arc should not trigger the hold-to-bookmark hint
    if (target.closest && (
      target.closest('#ai-todo-toggle, #ai-search-toggle, #ai-note-toggle, #ai-all-toggle, #ai-collapse-toggle, #ai-calc-hub-toggle, #ai-clock-toggle, #ai-undo-toggle, #ai-spacing-arc')
    )) return false;
    return true;
  }
  hub.addEventListener('mouseenter', (e) => {
    if (isHubCenterTarget(e.target)) scheduleHubHoldHint();
  });
  hub.addEventListener('mousemove', (e) => {
    if (isHubCenterTarget(e.target)) {
      if (!hubHoldHintTimer && !(hubHoldHintEl && hubHoldHintEl.classList.contains('visible'))) scheduleHubHoldHint();
    } else {
      hideHubHoldHint();
    }
  });
  hub.addEventListener('mouseleave', hideHubHoldHint);
  hub.addEventListener('mousedown', hideHubHoldHint);



function updateUITexts() {
    setGalaxyTooltip(noteToggleDot, t('noteTitle'), GALAXY_ICONS.note, 'left');
    setGalaxyTooltip(todoToggleDot, t('todoTitle'), GALAXY_ICONS.todo, 'left');
    setGalaxyTooltip(clockToggleDot, t('clockTitle'), GALAXY_ICONS.clock, 'left');
    setGalaxyTooltip(allToggleDot, t('allTitle'), GALAXY_ICONS.all, 'right');
    setGalaxyTooltip(searchToggleDot, t('searchTitle'), GALAXY_ICONS.search, 'right');
    setGalaxyTooltip(calcToggleDot, t('calcTitle'), GALAXY_ICONS.calc, 'right');
    setGalaxyTooltip(undoToggleDot, t('undoTitle'), GALAXY_ICONS.undo, 'top');
    if (undoToggleDot) undoToggleDot.setAttribute('aria-label', t('undoAria'));
    setGalaxyTooltip(collapseToggleDot, t('collapseTitle'), GALAXY_ICONS.collapse, 'bottom');
    spacingArc.title = t('spacingTitle');
    addNodeBtn.title = t('addNodeTitle');
    if (typeof renderRumiQuote === 'function') renderRumiQuote();
    if (typeof renderDailyQuote === 'function') renderDailyQuote();
    if (typeof adjustClockPosition === 'function') adjustClockPosition();
    if (typeof adjustTodoPosition === 'function') adjustTodoPosition();
    hub.removeAttribute('title');
    hideHubHoldHint();

    uiEls.formMainTitle.textContent = editingNodeIndex === null ? t('formAddTitle') : t('formEditTitle');
    uiEls.formUrl.placeholder = t('formUrlPlaceholder');
    uiEls.formLabel.placeholder = t('formLabelPlaceholder');
    uiEls.formDescription.placeholder = t('formDescPlaceholder');
    uiEls.formTags.placeholder = t('formTagsPlaceholder');
    uiEls.formCatToggleLabel.textContent = t('catAccordionLabel');
    uiEls.searchCatToggleLabel.textContent = t('catFilterLabel');
    if (typeof refreshFormCatGrid === 'function') refreshFormCatGrid();
    if (typeof refreshSearchCatGrid === 'function') refreshSearchCatGrid();
    uiEls.formGalaxyLabel.textContent = t('formGalaxyLabel');
    uiEls.formImpLabel.textContent = t('formImportanceLabel');
    uiEls.formCancel.textContent = t('formCancelBtn');
    uiEls.formDelete.textContent = t('formDeleteBtn');
    uiEls.formSave.textContent = editingNodeIndex === null ? t('formSaveBtn') : t('formUpdateBtn');

    uiEls.noteText.placeholder = t('noteInput');
    if (uiEls.tplSearch) uiEls.tplSearch.placeholder = t('noteTplSearchPlaceholder');
    uiEls.noteClearBtn.textContent = t('noteClearBtn');
    uiEls.noteCopyBtn.textContent = t('noteCopyBtn');
    uiEls.saveTxtBtn.textContent = t('noteTxtBtn');
    if (typeof renderNoteTemplates === 'function') renderNoteTemplates();
    if (typeof updateNoteTokenMeter === 'function') updateNoteTokenMeter();
    if (uiEls.historyBtn) uiEls.historyBtn.title = t('noteHistoryTitle');
    renderSmartRibbon();
    if (uiEls.socialToggleLabel) uiEls.socialToggleLabel.textContent = t('shareBtn');
    if (uiEls.socialToggleBtn) uiEls.socialToggleBtn.title = t('shareTitle');
    if (uiEls.emojiToggleBtn) uiEls.emojiToggleBtn.title = t('emojiMoreTitle');
    if (uiEls.emojiOnlineBtn) uiEls.emojiOnlineBtn.title = t('emojiOnlineBtn');
    if (uiEls.translateBtn) {
      uiEls.translateBtn.title = t('noteTranslateTitle');
      uiEls.translateBtn.setAttribute('aria-label', t('noteTranslateTitle'));
    }
    if (typeof updateTranslateLangBadge === 'function') updateTranslateLangBadge();
    if (uiEls.spellcheckBtn) {
      uiEls.spellcheckBtn.title = t('noteSpellcheckTitle');
      uiEls.spellcheckBtn.setAttribute('aria-label', t('noteSpellcheckTitle'));
    }
    if (uiEls.ttsBtn && !uiEls.ttsBtn.classList.contains('active')) {
      uiEls.ttsBtn.title = t('noteTtsTitle');
      uiEls.ttsBtn.setAttribute('aria-label', t('noteTtsTitle'));
    }
    if (uiEls.extractDocBtn) {
      uiEls.extractDocBtn.title = t('noteExtractTitle');
      uiEls.extractDocBtn.setAttribute('aria-label', t('noteExtractTitle'));
    }
    if (uiEls.noteNewTabBtn) {
      uiEls.noteNewTabBtn.title = t('noteNewTabTitle');
      uiEls.noteNewTabBtn.setAttribute('aria-label', t('noteNewTabTitle'));
    }
    if (typeof renderEmojiTray === 'function' && Array.isArray(favoriteEmojis)) renderEmojiTray();
    if (typeof renderSocialPopover === 'function') renderSocialPopover();
    if (typeof syncNoteSplitBtn === 'function') syncNoteSplitBtn();

    uiEls.todoMainTitle.textContent = t('todoTitle');
    uiEls.todoInput.placeholder = activeTodoTab === 'daily' ? t('todoDailyInput') : t('todoGoalInput');
    uiEls.todoAddBtn.textContent = t('todoAddBtn');
    uiEls.todoTabDaily.textContent = t('todoTabDaily');
    uiEls.todoTabGoal.textContent = t('todoTabGoals');

    uiEls.searchInput.placeholder = t('searchPlaceholder');
    if (uiEls.bookmarkSearchLabel) uiEls.bookmarkSearchLabel.textContent = t('bookmarkSearchLabel');
    if (uiEls.webSearchToggleLabel) uiEls.webSearchToggleLabel.textContent = t('webSearchToggleLabel');
    if (uiEls.webSearchSectionLabel) uiEls.webSearchSectionLabel.textContent = t('webSearchSectionLabel');
    if (uiEls.webSearchInput) uiEls.webSearchInput.placeholder = t('webSearchPlaceholder');
    if (uiEls.webSearchAddBtn) uiEls.webSearchAddBtn.title = t('webSearchAddEngineTitle');
    if (uiEls.webSearchEngineFormSave) uiEls.webSearchEngineFormSave.textContent = t('webSearchSaveBtn');
    if (uiEls.webSearchEngineFormCancel) uiEls.webSearchEngineFormCancel.textContent = t('webSearchCancelBtn');
    if (uiEls.webSearchEngineFormReset) uiEls.webSearchEngineFormReset.textContent = t('webSearchResetBtn');
    if (uiEls.webSearchEngineFormDelete) uiEls.webSearchEngineFormDelete.textContent = t('webSearchDeleteBtn');
    uiEls.todoWhenToday.textContent = t('todoWhenToday');
    uiEls.todoWhenTomorrow.textContent = t('todoWhenTomorrow');

    uiEls.markToggle.title = t('markToggleTitle');
    uiEls.markToggle.setAttribute('aria-label', t('markToggleTitle'));
    if (uiEls.dashToggle) {
      uiEls.dashToggle.title = t('dashToggleTitle');
      uiEls.dashToggle.setAttribute('aria-label', t('dashToggleTitle'));
    }
    uiEls.markLabelInput.placeholder = t('markAddPlaceholder');
    uiEls.markAddBtn.textContent = t('markAddBtn');
    if (uiEls.markGoldenRow) uiEls.markGoldenRow.title = t('markGoldenTitle');
    if (uiEls.markGoldenLabel) uiEls.markGoldenLabel.textContent = '★';

    // تولتیپ دکمه تقویم و دکمه‌های ناوبری ماه قبل/بعد
    if (uiEls.smartDatePickerBtn) {
      uiEls.smartDatePickerBtn.title = langPick({
        fa: 'تقویم', en: 'Calendar', ar: 'التقويم', es: 'Calendario',
        de: 'Kalender', fr: 'Calendrier', ja: 'カレンダー', ru: 'Календарь'
      });
    }
    if (uiEls.dualPrev) {
      uiEls.dualPrev.setAttribute('aria-label', langPick({
        fa: 'ماه قبل', en: 'Previous month', ar: 'الشهر السابق', es: 'Mes anterior',
        de: 'Vorheriger Monat', fr: 'Mois précédent', ja: '先月', ru: 'Предыдущий месяц'
      }));
    }
    if (uiEls.dualNext) {
      uiEls.dualNext.setAttribute('aria-label', langPick({
        fa: 'ماه بعد', en: 'Next month', ar: 'الشهر التالي', es: 'Mes siguiente',
        de: 'Nächster Monat', fr: 'Mois suivant', ja: '来月', ru: 'Следующий месяц'
      }));
    }

    if (uiEls.smartDateInput) {
      uiEls.smartDateInput.placeholder = currentLang === 'fa'
        ? 'امروز · فردا · ۱۴۰۳/۰۵/۱۶ · 2026-07-27'
        : currentLang === 'ar'
          ? 'اليوم · غدًا · 2026-07-27'
          : currentLang === 'es'
          ? 'hoy · mañana · 2026-07-27'
          : currentLang === 'de'
            ? 'heute · morgen · 2026-07-27'
            : currentLang === 'fr'
              ? "aujourd'hui · demain · 2026-07-27"
              : currentLang === 'ja'
                ? '今日 · 明日 · 2026-07-27'
                : currentLang === 'ru'
                  ? 'сегодня · завтра · 2026-07-27'
                  : currentLang === 'tr'
                    ? 'bugün · yarın · 2026-07-27'
                    : currentLang === 'zh-Hans'
                      ? '今天 · 明天 · 2026-07-27'
                      : currentLang === 'zh-Hant'
                        ? '今天 · 明天 · 2026-07-27'
                        : currentLang === 'pt-BR'
                          ? 'hoje · amanhã · 2026-07-27'
                          : 'today · tomorrow · 2026-07-27 · 1403/05/16';
    }

    root.style.direction = isRTL(currentLang) ? 'rtl' : 'ltr';
    inlineForm.style.direction = isRTL(currentLang) ? 'rtl' : 'ltr';
    quickNoteForm.style.direction = isRTL(currentLang) ? 'rtl' : 'ltr';
    todoPanel.style.direction = isRTL(currentLang) ? 'rtl' : 'ltr';
    searchPanel.style.direction = isRTL(currentLang) ? 'rtl' : 'ltr';
    
    if (uiEls.todoQuoteCopy) {
      uiEls.todoQuoteCopy.title = t('quoteCopyTitle');
      uiEls.todoQuoteCopy.setAttribute('aria-label', t('quoteCopyTitle'));
    }
    if (uiEls.clockQuoteCopy) {
      uiEls.clockQuoteCopy.title = t('quoteCopyTitle');
      uiEls.clockQuoteCopy.setAttribute('aria-label', t('quoteCopyTitle'));
    }

    if (uiEls.markEventTab) {
      uiEls.markEventTab.title = langPick({
        fa: 'رویداد', en: 'Event', ar: 'الحدث', es: 'Evento',
        de: 'Ereignis', fr: 'Événement', ja: 'イベント', ru: 'Событие'
      });
    }

    if (todoPanel.classList.contains('active')) renderTodos();

    if (clockPanel.classList.contains('active')) {
      updateClockAge();
      renderMarkedDays();
      if (typeof renderRumiQuote === 'function') renderRumiQuote();

      // ۱. اگر شبکه تقویم باز است، آن را فوراً با زبان و تولتیپ‌های جدید رندر کن
      if (typeof renderDualGrid === 'function' && dualPickerOpen) {
        renderDualGrid();
      }

      // ۲. اگر برگه کاغذی رویداد باز است، آن را هم درجا بازرسم کن.
      // اولویت با currentOpenMarkEvent است چون از هر مسیری (گرید، دات‌ها، لیست) باز
      // شده باشد، مرجع مستقیم رویداد را داریم؛ دیگر لازم نیست دوباره از روی iso حدس بزنیم.
      if (uiEls.markEventSheet && !uiEls.markEventSheet.classList.contains('is-collapsed')) {
        if (currentOpenMarkEvent) {
          openMarkEventSheet({
            ...currentOpenMarkEvent,
            days: daysUntilNext(currentOpenMarkEvent.day, currentOpenMarkEvent.month, currentOpenMarkEvent.cal)
          });
          // اگر زیرِ همین رویداد، لیست رویدادهای ساعتی همان روز هم نمایش داده شده
          // (وقتی از سلول گرید باز شده، dayEventSheetOpenIso هم ست می‌شود)، آن را هم
          // بازرسم کن تا تولتیپ و متنِ داخلش با زبان جدید هماهنگ شود.
          if (dayEventSheetOpenIso && getDayTimeEvents(dayEventSheetOpenIso).length) {
            renderMarkEventDailyList(dayEventSheetOpenIso);
          }
        } else if (dayEventSheetOpenIso === todayDashIso()) {
          openTodayGreetingSheet(dayEventSheetOpenIso);
        } else if (dayEventSheetOpenIso && getDayTimeEvents(dayEventSheetOpenIso).length) {
          openDayEventsSheet(dayEventSheetOpenIso);
        }
      }
    }

    if (uiEls.dashPanel && uiEls.dashPanel.classList.contains('active')) refreshDashUI();
    if (searchPanel.classList.contains('active')) renderSearchResults(uiEls.searchInput.value);
    renderTierDots();
    if (isOpen) setHubLabel(currentLayerMode === 0 ? t('hubCore') : ringDisplayLabel(RING_CONFIG[currentLayerMode]));
    updateBookmarkCount();
  }

  function updateClockAge() {
      // بهینه‌سازیِ کارایی: وقتی پنل ساعت باز نیست یا خودِ تب در پس‌زمینه است، این
      // محاسبات (تبدیل جلالی، فرمت‌بندیِ چندزبانه‌ی تاریخ و...) هر ثانیه بی‌فایده
      // اجرا می‌شدند حتی وقتی هیچ‌کس نمی‌دیدشون — این تیک‌های بی‌اثر رو حذف می‌کنیم.
      if (document.hidden || !clockPanel.classList.contains('active')) return;
      const timeEl = document.getElementById('ai-time'); if (!timeEl) return; 
      const now = new Date();
updateSeasonalTracker();
      // رنگ‌بندی نمایش فشردهٔ ساعت/تاریخ اصلی بر اساس ماه جلالیِ «امروز» — چرخهٔ
      // دوازده‌گانهٔ طبیعت (فروردین..اسفند)، مستقل از کارت اطلاعات فصل بالا.
      try {
        const jNow = gregorianToJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
        const calMonthKey = calMonthKeyFromJalali(jNow.jm);
        if (calMonthKey && clockPanel.dataset.calMonth !== calMonthKey) clockPanel.dataset.calMonth = calMonthKey;
      } catch (eCalMonth) {}
      timeEl.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute:'2-digit', hour12: false });
      const dateOpts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      const primaryDateEl = document.getElementById('ai-date-fa');   
      const secondaryDateEl = document.getElementById('ai-date-en'); 

      const primaryDate = now.toLocaleDateString(systemLocale, dateOpts);
      primaryDateEl.textContent = primaryDate;
      primaryDateEl.style.direction = isRTLLocale(systemLocale) ? 'rtl' : 'ltr';

      let systemCalendar = 'gregory';
      try { systemCalendar = new Intl.DateTimeFormat(systemLocale).resolvedOptions().calendar; } catch (e) {}

      if (currentLang === 'fa') {
        // وقتی زبان برنامه فارسی است، تاریخ شمسی را همیشه به‌عنوان خط دوم نشان بده —
        // مستقل از تقویم سیستم، پس روی زبان‌های دیگر (نسخه‌ی جهانی) هیچ اثری ندارد.
        try {
          secondaryDateEl.textContent = now.toLocaleDateString('fa-IR-u-ca-persian', dateOpts);
          secondaryDateEl.style.direction = 'rtl';
          secondaryDateEl.style.display = '';
        } catch (e) { secondaryDateEl.textContent = ''; secondaryDateEl.style.display = 'none'; }
      } else if (systemCalendar !== 'gregory') {
        secondaryDateEl.textContent = now.toLocaleDateString('en-US', dateOpts); secondaryDateEl.style.display = '';
      } else {
        secondaryDateEl.textContent = ''; secondaryDateEl.style.display = 'none';
      }
      
      const ageEl = document.getElementById('ai-age'); const journeyEl = document.getElementById('ai-life-journey'); const journeyCaption = document.getElementById('ai-life-caption');
      const journeyStart = document.getElementById('ai-life-start'); const journeyNow = document.getElementById('ai-life-now-label'); const clockKicker = document.getElementById('ai-clock-kicker-text');
      if (clockKicker) clockKicker.textContent = t('presentLabel');
      if (journeyStart) journeyStart.textContent = t('originLabel');
      if (journeyNow) journeyNow.textContent = t('nowLabel');

      const familyToggle = document.getElementById('ai-family-ages-toggle');
      const familyListEl = document.getElementById('ai-family-ages-list');
      const familyToggleLabel = document.getElementById('ai-family-ages-toggle-label');

      function computePreciseAge(year, month, day) {
        const y = parseInt(year, 10);
        if (!y || isNaN(y)) return { age: 0, birthLabel: '' };
        const isJalali = y < 1500;
        let m = parseInt(month, 10);
        let d = parseInt(day, 10);
        const hasFullDate = !!(month && day && m >= 1 && m <= 12 && d >= 1 && d <= 31);
        if (!m || m < 1 || m > 12) m = 1;
        if (!d || d < 1 || d > 31) d = 1;
        let gY, gM, gD;
        try {
          if (isJalali && typeof jalaaliToGregorian === 'function') {
            const g = jalaaliToGregorian(y, m, d); gY = g.gy; gM = g.gm; gD = g.gd;
          } else { gY = y; gM = m; gD = d; }
        } catch (e) { gY = isJalali ? y + 621 : y; gM = m; gD = d; }
        const nowD = new Date();
        let age;
        if (hasFullDate) {
          age = nowD.getFullYear() - gY;
          const had = (nowD.getMonth() + 1 > gM) || (nowD.getMonth() + 1 === gM && nowD.getDate() >= gD);
          if (!had) age -= 1;
        } else if (isJalali) {
          try {
            const jYearStr = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric' }).format(nowD);
            age = parseInt(jYearStr.replace(/\D/g, ''), 10) - y;
          } catch (e) { age = nowD.getFullYear() - gY; }
        } else { age = nowD.getFullYear() - gY; }
        age = Math.max(0, age);
        const J_MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
        let birthJalali = '';
        let birthGregorian = '';
        let birthLabel = '';
        try {
          if (hasFullDate) {
            const gregorianLabels = { fa: 'میلادی', ar: 'ميلادي', es: 'Greg.', de: 'Greg.', fr: 'Grég.', ja: '西暦', ru: 'григ.', tr: 'Miladi', 'zh-Hans': '公历', 'zh-Hant': '公曆', 'pt-BR': 'Greg.' };
            const gregorianLabel = gregorianLabels[currentLang] || 'Gregorian';
            birthGregorian = `${gregorianLabel} · ${gY}-${String(gM).padStart(2, '0')}-${String(gD).padStart(2, '0')}`;
            if (typeof gregorianToJalaali === 'function') {
              const j = gregorianToJalaali(gY, gM, gD);
              birthJalali = localizeDigits(String(j.jd)) + ' ' + J_MONTHS[Math.max(0, j.jm - 1)] + ' ' + localizeDigits(String(j.jy));
            } else if (isJalali) {
              birthJalali = localizeDigits(String(d)) + ' ' + J_MONTHS[Math.max(0, m - 1)] + ' ' + localizeDigits(String(y));
            }
            birthLabel = (birthJalali ? birthJalali + ' · ' : '') + birthGregorian;
          } else if (isJalali) {
            birthJalali = localizeDigits(String(y)) + (currentLang === 'fa' || currentLang === 'ar' ? ' شمسی' : ' Jalali');
            try { const g = jalaaliToGregorian(y, 1, 1); if (g) birthGregorian = '≈' + g.gy + ' CE'; } catch (e) {}
            birthLabel = birthJalali + (birthGregorian ? ' · ' + birthGregorian : '');
          } else {
            birthGregorian = String(y) + ' CE';
            try {
              const j = gregorianToJalaali(y, 1, 1);
              if (j) birthJalali = '≈' + localizeDigits(String(j.jy)) + (currentLang === 'fa' || currentLang === 'ar' ? ' شمسی' : ' Jalali');
            } catch (e) {}
            birthLabel = (birthJalali ? birthJalali + ' · ' : '') + birthGregorian;
          }
        } catch (e) {}
        return { age: age, birthLabel: birthLabel, birthJalali: birthJalali, birthGregorian: birthGregorian };
      }
      function getPrimaryBirth() {
        if (Array.isArray(familyAges) && familyAges.length) {
          const p = familyAges.find(m => m.primary) || familyAges[0];
          if (p && p.year) return p;
        }
        if (userBirthYear && !isNaN(userBirthYear)) {
          return { name: '', year: userBirthYear, month: userBirthMonth, day: userBirthDay, primary: true };
        }
        return null;
      }
      function familyToggleText(n, expanded) {
        const packs = {
          en: { open: n + ' more family member' + (n > 1 ? 's' : ''), close: 'Hide family' },
          fa: { open: n + ' عضو دیگر خانواده', close: 'بستن فهرست خانواده' },
          ar: { open: n + ' أفراد آخرون', close: 'إخفاء العائلة' },
          es: { open: n + ' más', close: 'Ocultar' },
          de: { open: n + ' weitere', close: 'Ausblenden' },
          fr: { open: n + ' autres', close: 'Masquer' },
          ja: { open: '他 ' + n + ' 人', close: '閉じる' },
          ru: { open: 'Ещё ' + n, close: 'Скрыть' },
          tr: { open: n + ' kişi daha', close: 'Gizle' },
          'zh-Hans': { open: '另外 ' + n + ' 人', close: '收起' },
          'zh-Hant': { open: '另外 ' + n + ' 人', close: '收合' },
          'pt-BR': { open: n + ' a mais', close: 'Ocultar' }
        };
        const pack = packs[currentLang] || packs.en;
        return expanded ? pack.close : pack.open;
      }
      function yearsWord() {
        const packs = { en:' yrs', fa:' سال', ar:' سنة', es:' años', de:' J.', fr:' ans', ja:'歳', ru:' лет', tr:' yaş', 'zh-Hans':' 岁', 'zh-Hant':' 歲', 'pt-BR':' anos' };
        return packs[currentLang] || packs.en;
      }
      function meFallback() {
        const packs = { en:'Me', fa:'من', ar:'أنا', es:'Yo', de:'Ich', fr:'Moi', ja:'自分', ru:'Я', tr:'Ben', 'zh-Hans':'我', 'zh-Hant':'我', 'pt-BR':'Eu' };
        return packs[currentLang] || packs.en;
      }
      function renderFamilyAgesPanel() {
        if (!familyToggle || !familyListEl) return;
        const others = (familyAges || []).filter(m => m && m.year && !m.primary);
        const total = (familyAges || []).filter(m => m && m.year).length;
        if (total <= 1 || !others.length) {
          familyToggle.style.display = 'none';
          familyListEl.style.display = 'none'; familyListEl.hidden = true;
          familyToggle.setAttribute('aria-expanded', 'false');
          familyListEl.classList.remove('is-open');
          return;
        }
        familyToggle.style.display = '';
        if (familyToggleLabel) familyToggleLabel.textContent = familyToggleText(others.length, familyAgesExpanded);
        familyToggle.setAttribute('aria-expanded', familyAgesExpanded ? 'true' : 'false');
        familyToggle.classList.toggle('is-open', familyAgesExpanded);
        if (!familyAgesExpanded) {
          familyListEl.style.display = 'none'; familyListEl.hidden = true;
          familyListEl.classList.remove('is-open'); familyListEl.innerHTML = '';
          return;
        }
        familyListEl.hidden = false; familyListEl.style.display = '';
        familyListEl.classList.add('is-open'); familyListEl.innerHTML = '';
        const ordered = (familyAges || []).filter(m => m && m.year).slice().sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0));
        ordered.forEach((m) => {
          const info = computePreciseAge(m.year, m.month, m.day);
          const row = document.createElement('div');
          row.className = 'ai-family-age-row' + (m.primary ? ' is-primary' : '');
          const nameEl = document.createElement('span'); nameEl.className = 'ai-family-age-name';
          nameEl.textContent = m.name || (m.primary ? meFallback() : '—');
          const ageSpan = document.createElement('span'); ageSpan.className = 'ai-family-age-years';
          ageSpan.textContent = localizeDigits(String(info.age)) + yearsWord();
          const birthSpan = document.createElement('span'); birthSpan.className = 'ai-family-age-birth';
          birthSpan.textContent = info.birthLabel || '';
          row.appendChild(nameEl); row.appendChild(ageSpan);
          if (info.birthLabel) row.appendChild(birthSpan);
          familyListEl.appendChild(row);
        });
      }
      if (familyToggle && !familyToggle.dataset.wired) {
        familyToggle.dataset.wired = '1';
        familyToggle.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          familyAgesExpanded = !familyAgesExpanded;
          renderFamilyAgesPanel();
        });
      }
      const primary = getPrimaryBirth();
      const birthEl = document.getElementById('ai-life-birth');
      if (primary && primary.year) {
         const ageInfo = computePreciseAge(primary.year, primary.month, primary.day);
         const age = ageInfo.age;
         const namePrefix = primary.name ? (primary.name + ' · ') : '';
         // Age lives on the journey caption — hide redundant age row
         if (ageEl) {
           ageEl.textContent = '';
           ageEl.style.display = 'none';
           ageEl.style.removeProperty('display');
         }
         if (journeyEl && journeyCaption) {
             const progress = Math.max(7, Math.min(93, (age / 100) * 100));
             journeyEl.style.setProperty('--life-progress', progress + '%');
             journeyCaption.textContent = namePrefix + t('journeyCaption').replace('{age}', localizeDigits(String(age)));
             journeyEl.style.display = 'block';
         }
         // Dual-line birth under life bar (same language as Today dock)
         if (birthEl) {
           birthEl.innerHTML = '';
           if (ageInfo.birthJalali) {
             const jLine = document.createElement('div');
             jLine.className = 'ai-life-birth-j';
             jLine.textContent = '🌱 ' + ageInfo.birthJalali;
             birthEl.appendChild(jLine);
           }
           if (ageInfo.birthGregorian) {
             const gLine = document.createElement('div');
             gLine.className = 'ai-life-birth-g';
             gLine.textContent = '✦ ' + ageInfo.birthGregorian;
             birthEl.appendChild(gLine);
           }
           if (!ageInfo.birthJalali && !ageInfo.birthGregorian && ageInfo.birthLabel) {
             birthEl.textContent = ageInfo.birthLabel;
           }
           birthEl.hidden = !(ageInfo.birthJalali || ageInfo.birthGregorian || ageInfo.birthLabel);
         }
         renderFamilyAgesPanel();
      } else {
         if (ageEl) { ageEl.textContent = ''; ageEl.style.display = 'none'; ageEl.style.removeProperty('display'); }
         if (birthEl) { birthEl.innerHTML = ''; birthEl.hidden = true; }
         if (journeyEl) journeyEl.style.display = 'none';
         if (familyToggle) familyToggle.style.display = 'none';
         if (familyListEl) { familyListEl.style.display = 'none'; familyListEl.hidden = true; }
      }
      // داشبورد زمان: خطِ «اکنون» هر ثانیه (سبک، فقط جابه‌جاییِ یک خط)، اما وضعیتِ کارت‌ها
      // (near/missed) و ویجتِ «رویداد بعدی» فقط هر دقیقه یک‌بار بازمحاسبه می‌شوند — تا با
      // بازرسمِ کاملِ تایم‌لاین هر ثانیه، پرش/فلیکرِ بصری ایجاد نشود.
      if (uiEls.dashPanel && uiEls.dashPanel.classList.contains('active')) {
        if (typeof updateNowLine === 'function') updateNowLine();
        if (now.getSeconds() === 0 && typeof renderTimeline === 'function') renderTimeline();
      }
      // نقطه‌ی هشدارِ روی خودِ دکمه‌ی تاگل باید حتی وقتی زیرپنلِ داشبورد بسته است هم
      // به‌روز بماند — چون کاربر قرار است بدونِ باز کردنِ پنل، فقط با نگاه به دکمه بفهمد.
      if (now.getSeconds() === 0 && typeof checkUpcomingEventsReminder === 'function') checkUpcomingEventsReminder();
  }
  // Registered with lifecycle controller once it is constructed (see below).
  let clockAgeIntervalId = setInterval(updateClockAge, 1000);

  function saveMarkedDays() { try { if (chrome.runtime?.id) chrome.storage.sync.set({ aiTreeMarkedDays: markedDays }); } catch (e) {} }

  // حذفِ یک مناسبتِ نشانه‌گذاری‌شده — یک نقطهٔ مشترک برای هر دو محلِ حذف
  // (دکمهٔ × روی فهرستِ کناری، و تاگلِ حذف داخلِ برگهٔ کاغذیِ خودِ رویداد).
  function deleteMarkedDayById(id) {
    if (!id) return;
    markedDays = markedDays.filter(x => x.id !== id);
    saveMarkedDays();
    renderMarkedDays();
    showToastNotification(t('markToastDeleted'));
  }

  // chrome.storage.local (نه sync) عمداً انتخاب شده: sync سقفِ حجمِ خیلی کمی دارد (~۸KB
  // برای هر کلید) و رویدادهای روزانه/ساعتیِ کاربرِ فعال به‌سرعت از آن رد می‌شوند.
  // ذخیرهٔ رویدادها دیگر «کلِ آرایهٔ داخل رمِ همین تب» را کورکورانه روی storage نمی‌نویسد.
  // قبلاً تبِ قدیمی (که از رویدادهای تبِ جدید خبر نداشت) با هر ذخیره — حتی یک prune خودکار
  // نیمه‌شب یا تایمرِ ۵ دقیقه‌ای — آرایهٔ کهنهٔ خودش را روی نسخهٔ تازه می‌نوشت. حالا
  // ادغامِ سه‌طرفه (base = آخرین نسخه‌ای که این تب دیده، mine = حافظهٔ فعلی، fresh = storage
  // در لحظهٔ ذخیره) انجام می‌شود: فقط «تغییراتِ واقعیِ همین تب» (افزودن/ویرایش/حذف) اعمال
  // می‌شود و بقیهٔ رویدادهای storage دست‌نخورده می‌ماند. حذف هم بدونِ tombstone ممکن است،
  // چون «حذف» یعنی: در base بود ولی در mine نیست.
  let timeEventsBaseline = [];
  let lastTimeEventsJson = '';
  let timeEventsSaveInFlight = false;
  let timeEventsResavePending = false;
  function cloneJsonSafe(v) { try { return JSON.parse(JSON.stringify(v)); } catch (e) { return []; } }
  function snapshotTimeEventsBaseline() { timeEventsBaseline = cloneJsonSafe(timeEventsData); }
  function timeEventKey(e) { return (e && e.id) ? String(e.id) : ('__' + JSON.stringify(e)); }
  function mergeTimeEvents(base, mine, fresh) {
    const baseJson = new Map((base || []).map(e => [timeEventKey(e), JSON.stringify(e)]));
    const mineKeys = new Set((mine || []).map(timeEventKey));
    const out = new Map();
    (fresh || []).forEach(e => { if (e) out.set(timeEventKey(e), e); });
    baseJson.forEach((_, k) => { if (!mineKeys.has(k)) out.delete(k); });          // حذف‌شده توسط همین تب
    (mine || []).forEach(e => {                                                        // جدید/ویرایش‌شده توسط همین تب
      if (!e) return;
      const k = timeEventKey(e);
      if (baseJson.get(k) !== JSON.stringify(e)) out.set(k, e);
    });
    return Array.from(out.values());
  }
  function saveTimeEvents() {
    try {
      if (!chrome.runtime?.id) return;
      if (timeEventsSaveInFlight) { timeEventsResavePending = true; return; }
      timeEventsSaveInFlight = true;
      const mine = cloneJsonSafe(timeEventsData);
      const mineJson = JSON.stringify(mine);
      chrome.storage.local.get(['aiTreeTimeEvents'], (res) => {
        try {
          let merged = mine;
          try {
            const fresh = Array.isArray(res && res.aiTreeTimeEvents) ? res.aiTreeTimeEvents : [];
            merged = mergeTimeEvents(timeEventsBaseline, mine, fresh);
          } catch (e) {}
          const mergedJson = JSON.stringify(merged);
          lastTimeEventsJson = mergedJson; // پژواکِ onChanged همین نوشتن نادیده گرفته شود
          chrome.storage.local.set({ aiTreeTimeEvents: merged }, () => {
            timeEventsSaveInFlight = false;
            if (chrome.runtime.lastError) { console.warn('[AI Tree] saveTimeEvents:', chrome.runtime.lastError.message); return; }
            if (JSON.stringify(timeEventsData) === mineJson) {
              // در فاصلهٔ ذخیره تغییری نبوده: نسخهٔ ادغام‌شده (شاملِ رویدادهای تبِ‌های دیگر) را بپذیر.
              timeEventsData = merged; snapshotTimeEventsBaseline();
              if (mergedJson !== mineJson) {
                try {
                  if (uiEls.dashPanel && uiEls.dashPanel.classList.contains('active')) refreshDashUI(); else checkUpcomingEventsReminder();
                } catch (e) {}
              }
            } else {
              timeEventsBaseline = mine; timeEventsResavePending = true; // تغییر تازه‌ای وسط راه آمد؛ یک دور دیگر
            }
            if (timeEventsResavePending) { timeEventsResavePending = false; saveTimeEvents(); }
          });
        } catch (e) { timeEventsSaveInFlight = false; }
      });
    } catch (e) { timeEventsSaveInFlight = false; }
  }
  // تغییرِ رویدادها از تبِ دیگر/Void Tab/popup (فقط وقتی واقعاً با حافظهٔ ما فرق دارد).
  function applyExternalTimeEvents(nv) {
    const incoming = Array.isArray(nv) ? nv : [];
    const json = JSON.stringify(incoming);
    if (json === lastTimeEventsJson || timeEventsSaveInFlight) return;
    timeEventsData = incoming; lastTimeEventsJson = json; snapshotTimeEventsBaseline();
    try {
      if (uiEls.dashPanel && uiEls.dashPanel.classList.contains('active')) refreshDashUI(); else checkUpcomingEventsReminder();
      if (dayEventSheetOpenIso) renderMarkEventDailyList(dayEventSheetOpenIso);
    } catch (e) {}
  }
  // مشابه بالا برای todos — بدونِ ادغام؛ فقط جلوگیری از اعمالِ پژواکِ نوشتنِ خودمان.
  function applyExternalTodos(nv) {
    const incoming = Array.isArray(nv) ? nv : [];
    if (JSON.stringify(incoming) === JSON.stringify(todosData)) return;
    todosData = incoming; migrateTodos(); pruneExpiredDailyTodos(); publishTodosToVoidTab();
    if (todoPanel.classList.contains('active')) renderTodos();
  }


  function pruneExpiredMarkedDays() {
    if (!Array.isArray(markedDays) || markedDays.length === 0) return false;
    const kept = markedDays.filter(m => m.golden || !isMarkedDayPast(m.day, m.month, m.cal));
    if (kept.length === markedDays.length) return false;
    markedDays = kept;
    saveMarkedDays();
    return true;
  }

  // تولدها از دادهٔ موجودِ عمرشمار ساخته می‌شوند و عمداً در aiTreeMarkedDays
  // ذخیره نمی‌شوند؛ بنابراین هر عضو فقط یک رخداد نمایشی دارد و حذف عضو، تولد را هم حذف می‌کند.
  function getBirthdayCalendarMarks() {
    let people = Array.isArray(familyAges) ? familyAges.filter(person => person && person.year) : [];
    const primary = people.find(person => person.primary) || people[0];
    if (primary && (!primary.month || !primary.day) && userBirthMonth && userBirthDay) {
      people = people.map(person => person === primary ? { ...person, month: person.month || userBirthMonth, day: person.day || userBirthDay } : person);
    }
    if (!people.length && userBirthYear) {
      people = [{ id: 'legacy-primary', name: '', year: userBirthYear, month: userBirthMonth, day: userBirthDay, primary: true }];
    }
    const birthdayWord = langPick({ fa: 'تولد', en: 'Birthday', ar: 'عيد ميلاد', es: 'Cumpleaños', de: 'Geburtstag', fr: 'Anniversaire', ja: '誕生日', ru: 'День рождения' });
    const familyWord = langPick({ fa: 'عضو خانواده', en: 'Family member', ar: 'أحد أفراد العائلة', es: 'Familiar', de: 'Familienmitglied', fr: 'Membre de la famille', ja: '家族', ru: 'Член семьи' });
    const meWord = langPick({ fa: 'تولد من', en: 'My birthday', ar: 'عيد ميلادي', es: 'Mi cumpleaños', de: 'Mein Geburtstag', fr: 'Mon anniversaire', ja: '自分の誕生日', ru: 'Мой день рождения' });
    return people.map((person, index) => {
      const year = parseInt(person.year, 10);
      const month = parseInt(person.month, 10);
      const day = parseInt(person.day, 10);
      if (!year || !Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) return null;
      const cal = year < 1500 ? 'j' : 'g';
      try {
        if (cal === 'j' && typeof jalaaliToGregorian === 'function' && typeof gregorianToJalaali === 'function') {
          const g = jalaaliToGregorian(year, month, day);
          const back = gregorianToJalaali(g.gy, g.gm, g.gd);
          if (!back || back.jm !== month || back.jd !== day) return null;
        } else if (cal === 'g') {
          const date = new Date(year, month - 1, day);
          if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) return null;
        }
      } catch (e) { return null; }
      const name = String(person.name || '').trim();
      const shortLabel = name || (person.primary ? meWord : familyWord);
      const label = name ? `${name} · ${birthdayWord}` : (person.primary ? meWord : `${birthdayWord} · ${familyWord}`);
      return { id: `birthday:${person.id || index}`, label, shortLabel, day, month, cal, golden: true, isBirthday: true };
    }).filter(Boolean);
  }

function openMarkEventSheet(m) {
    if (!uiEls.markEventSheet || !m) return;
    currentOpenMarkEvent = m;
    const isJ = m.cal === 'j' || m.cal === 'jalali';
    const isH = m.cal === 'h' || m.cal === 'hijri';

    // برچسب نوع تقویم به تفکیک ۸ زبان
    let calHint = '';
    if (isJ) {
      calHint = langPick({
        fa: 'شمسی', en: 'Jalali', ar: 'شمسي', es: 'jalalí',
        de: 'Dschalali', fr: 'jalali', ja: 'ジャラリ暦', ru: 'джалали'
      });
    } else if (isH) {
      calHint = langPick({
        fa: 'قمری', en: 'Hijri', ar: 'هجري', es: 'hijrí',
        de: 'Hidschri', fr: 'hijri', ja: 'ヒジュラ暦', ru: 'хиджра'
      });
    } else {
      calHint = langPick({
        fa: 'میلادی', en: 'Gregorian', ar: 'ميلادي', es: 'gregoriano',
        de: 'gregorianisch', fr: 'grégorien', ja: 'グレゴリオ暦', ru: 'григорианский'
      });
    }

    // نام ماه و قالب‌بندی ارقام بر اساس زبان فعال
    let dateStr = '';
    if (m.isBirthday) {
      const mm = localizeDigits(String(m.month).padStart(2, '0'));
      const dd = localizeDigits(String(m.day).padStart(2, '0'));
      dateStr = langPick({
        fa: `ماه ${mm} · روز ${dd}`, en: `Month ${mm} · Day ${dd}`, ar: `الشهر ${mm} · اليوم ${dd}`,
        es: `Mes ${mm} · Día ${dd}`, de: `Monat ${mm} · Tag ${dd}`, fr: `Mois ${mm} · Jour ${dd}`,
        ja: `${mm}月 · ${dd}日`, ru: `Месяц ${mm} · день ${dd}`
      });
    } else if (isJ) {
      const monthName = JALALI_MONTHS_FA[m.month - 1] || '';
      dateStr = `${localizeDigits(m.day)} ${monthName}`;
    } else if (isH) {
      const hijriNames = currentLang === 'fa' ? HIJRI_MONTHS_FA : currentLang === 'ar' ? HIJRI_MONTHS_AR : currentLang === 'es' ? HIJRI_MONTHS_ES : currentLang === 'de' ? HIJRI_MONTHS_DE : currentLang === 'fr' ? HIJRI_MONTHS_FR : currentLang === 'ja' ? HIJRI_MONTHS_JA : currentLang === 'ru' ? HIJRI_MONTHS_RU : currentLang === 'tr' ? HIJRI_MONTHS_TR : currentLang === 'zh-Hans' ? HIJRI_MONTHS_ZHHANS : currentLang === 'zh-Hant' ? HIJRI_MONTHS_ZHHANT : currentLang === 'pt-BR' ? HIJRI_MONTHS_PTBR : HIJRI_MONTHS_EN;
      const monthName = hijriNames[m.month - 1] || '';
      dateStr = `${localizeDigits(m.day)} ${monthName}`;
    } else {
      const monthName = getDisplayGregorianMonth(m.month - 1) || '';
      dateStr = `${localizeDigits(m.day)} ${monthName}`;
    }
    
    if (uiEls.markEventBadge) {
      uiEls.markEventBadge.textContent = m.isBirthday ? '🎂' : (m.days === 0 ? '🎉' : (m.isPublic ? '🔴' : (m.golden ? '★' : '📌')));
    }

    // تولتیپ تب باز/بسته‌کننده کشوی کاغذی به ۸ زبان
    if (uiEls.markEventTab) {
      uiEls.markEventTab.title = langPick({
        fa: 'رویداد', en: 'Event', ar: 'الحدث', es: 'Evento',
        de: 'Ereignis', fr: 'Événement', ja: 'イベント', ru: 'Событие'
      });
    }
    
    // متن رویداد + تولتیپ ویرایش کاملاً ۸ زبانه
    if (uiEls.markEventText) {
      uiEls.markEventText.textContent = m.label;

      if (!m.isPublic && !m.isBirthday) {
        uiEls.markEventText.title = langPick({
          fa: 'برای ویرایش متن کلیک کنید',
          en: 'Click to edit text',
          ar: 'انقر لتعديل النص',
          es: 'Haz clic para editar el texto',
          de: 'Klicken Sie, um den Text zu bearbeiten',
          fr: 'Cliquez pour modifier le texte',
          ja: 'クリックしてテキストを編集',
          ru: 'Нажмите, чтобы изменить текст'
        });
        uiEls.markEventText.style.cursor = 'text';

        uiEls.markEventText.onclick = (e) => {
          e.stopPropagation();
          if (uiEls.markEventText.querySelector('input')) return;

          const oldVal = m.label;
          const input = document.createElement('input');
          input.type = 'text';
          input.value = oldVal;
          input.dir = 'auto';

          Object.assign(input.style, {
            width: '100%',
            background: 'rgba(0, 0, 0, 0.06)',
            border: '1px dashed rgba(0, 0, 0, 0.25)',
            borderRadius: '4px',
            color: 'inherit',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            fontWeight: 'inherit',
            padding: '2px 4px',
            outline: 'none',
            boxSizing: 'border-box'
          });

          uiEls.markEventText.textContent = '';
          uiEls.markEventText.appendChild(input);
          input.focus();
          input.select();

          let committed = false;

          const commitEdit = () => {
            if (committed) return;
            committed = true;
            const updated = input.value.trim();
            if (updated && updated !== oldVal) {
              m.label = updated;
              const target = markedDays.find(item => item.id === m.id);
              if (target) target.label = updated;
              saveMarkedDays();
              renderMarkedDays();
              uiEls.markEventText.textContent = updated;
              showToastNotification(langPick({
                fa: 'رویداد ویرایش شد',
                en: 'Event updated',
                ar: 'تم تعديل الحدث',
                es: 'Evento actualizado',
                de: 'Ereignis aktualisiert',
                fr: 'Événement mis à jour',
                ja: 'イベントを更新しました',
                ru: 'Событие обновлено'
              }));
            } else {
              uiEls.markEventText.textContent = oldVal;
            }
          };

          const cancelEdit = () => {
            if (committed) return;
            committed = true;
            uiEls.markEventText.textContent = oldVal;
          };

          input.addEventListener('blur', commitEdit);
          input.addEventListener('keydown', (ev) => {
            ev.stopPropagation();
            if (ev.key === 'Enter') { ev.preventDefault(); commitEdit(); }
            else if (ev.key === 'Escape') { ev.preventDefault(); cancelEdit(); }
          });
          input.addEventListener('click', (ev) => ev.stopPropagation());
        };
      } else {
        uiEls.markEventText.onclick = null;
        uiEls.markEventText.style.cursor = 'default';
        uiEls.markEventText.title = '';
      }
    }
    
    // متن زمان‌بندی پایین برگه کاغذی به ۸ زبان
    if (uiEls.markEventMeta) {
  if (m.days === 0) {
    const todayWord = langPick({
      fa: 'امروز', en: 'Today', ar: 'اليوم', es: 'Hoy',
      de: 'Heute', fr: "Aujourd'hui", ja: '今日', ru: 'Сегодня'
    });
    uiEls.markEventMeta.textContent = `${todayWord} · ${dateStr} · ${calHint}`;
  } else {
    const daysLeftStr = langPick({
      // استفاده از RLE/PDF یا ایزوله‌سازی برای جلوگیری از پرش عدد به انتهای خط
      fa: `${localizeDigits(m.days)} روز مانده`,
      en: `in ${m.days}d`,
      ar: `بعد ${localizeDigits(m.days)} يوم`,
      es: `en ${m.days}d`,
      de: `in ${m.days}T`,
      fr: `dans ${m.days}j`,
      ja: `${m.days}日後`,
      ru: `через ${m.days}д`
    });

    // از جداکننده نقطه میانی (·) با ایزولاسیون جهت استفاده کنید
    uiEls.markEventMeta.textContent = `${daysLeftStr} · ${dateStr} · ${calHint}`;
  }
}

    // تاگلِ حذف — فقط برای مناسبت‌های شخصیِ خودِ کاربر (نه تعطیلاتِ رسمی، که
    // اصلاً داخلِ markedDays نیستند و حذف‌کردنی نیستند). هر بار که برگه برای
    // یک مناسبتِ تازه باز می‌شود، تاگل از نو به حالتِ خاموش برمی‌گردد — یک
    // کلیدِ ماندگار نیست، فقط لحظهٔ تیک‌خوردنش عملِ حذف را اجرا می‌کند.
    if (uiEls.markDeleteRow && uiEls.markDeleteCb) {
      uiEls.markDeleteRow.hidden = !!m.isPublic || !!m.isBirthday;
      uiEls.markDeleteRow.title = t('markDeleteTitle');
      uiEls.markDeleteCb.checked = false;
      uiEls.markDeleteCb.onchange = () => {
        if (!uiEls.markDeleteCb.checked) return;
        if (!m.isBirthday) deleteMarkedDayById(m.id);
        closeMarkEventSheet();
      };
    }

    uiEls.markEventSheet.classList.remove('is-collapsed');
  }

  function closeMarkEventSheet() {
    if (!uiEls.markEventSheet) return;
    uiEls.markEventSheet.classList.add('is-collapsed');
    dayEventSheetOpenIso = null;
    currentOpenMarkEvent = null;
    if (uiEls.markDotsRow) {
      uiEls.markDotsRow.querySelectorAll('.ai-mark-dot.is-active').forEach(d => d.classList.remove('is-active'));
    }
    if (uiEls.markEventDailyList) { uiEls.markEventDailyList.innerHTML = ''; uiEls.markEventDailyList.classList.add('is-empty'); }
  }

  // رویدادهای ساعتی/روزانهٔ داشبورد زمان (timeEventsData) برای یک تاریخ مشخص —
  // پلِ نمایشیِ یک‌طرفه بین «مناسبت‌های تقویم» (markedDays) و «داشبورد روزانه»،
  // بدون ادغام دو آرایه در هم؛ فقط برای نمایشِ هماهنگ زیر کشوی کاغذیِ روز.
  function getDayTimeEvents(iso) {
    return (timeEventsData || [])
      .filter(e => e.date === iso)
      .slice()
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  function renderMarkEventDailyList(iso) {
    if (!uiEls.markEventDailyList) return;
    const dayEvents = getDayTimeEvents(iso);
    uiEls.markEventDailyList.innerHTML = '';
    if (!dayEvents.length) {
      uiEls.markEventDailyList.classList.add('is-empty');
      return;
    }
    uiEls.markEventDailyList.classList.remove('is-empty');
    dayEvents.forEach(evt => {
      const status = evaluateEventStatus(evt);
      const row = document.createElement('div');
      row.className = `ai-mark-event-daily-row status-${status}`;
      const dot = document.createElement('span'); dot.className = 'ai-mark-event-daily-dot';
      const time = document.createElement('span'); time.className = 'ai-mark-event-daily-time'; time.textContent = evt.startTime;
      time.style.cursor = 'text';
      time.title = langPick({
        fa: 'برای ویرایش ساعت کلیک کنید',
        en: 'Click to edit time',
        ar: 'انقر لتعديل الوقت',
        es: 'Haz clic para editar la hora',
        de: 'Klicken Sie, um die Uhrzeit zu bearbeiten',
        fr: "Cliquez pour modifier l'heure",
        ja: 'クリックして時刻を編集',
        ru: 'Нажмите, чтобы изменить время'
      });
      time.addEventListener('click', (e) => {
        e.stopPropagation();
        if (time.querySelector('input')) return;

        const currentVal = evt.startTime;
        const input = document.createElement('input');
        input.type = 'time';
        input.value = currentVal;
        input.className = 'ai-mark-event-daily-time-inline-input';

        Object.assign(input.style, {
          width: '84px',
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          borderRadius: '6px',
          color: 'inherit',
          padding: '1px 4px',
          fontSize: 'inherit',
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box'
        });

        time.textContent = '';
        time.appendChild(input);
        input.focus();

        let isCommitted = false;

        const commitTimeChange = () => {
          if (isCommitted) return;
          isCommitted = true;
          const newVal = input.value;

          if (newVal && newVal !== currentVal) {
            evt.startTime = newVal;

            if (evt.linkedTodoId) {
              const linked = todosData.find(td => td.id === evt.linkedTodoId);
              if (linked) {
                linked.text = `${newVal} — ${evt.title}`;
                saveTodos();
                if (todoPanel.classList.contains('active')) renderTodos();
              }
            }

            saveTimeEvents();
            renderMarkEventDailyList(iso);
            if (uiEls.dashPanel && uiEls.dashPanel.classList.contains('active')) refreshDashUI();
            showToastNotification(langPick({
              fa: 'رویداد ویرایش شد',
              en: 'Event updated',
              ar: 'تم تعديل الحدث',
              es: 'Evento actualizado',
              de: 'Ereignis aktualisiert',
              fr: 'Événement mis à jour',
              ja: 'イベントを更新しました',
              ru: 'Событие обновлено'
            }));
          } else {
            time.textContent = currentVal;
          }
        };

        const revertTimeChange = () => {
          if (isCommitted) return;
          isCommitted = true;
          time.textContent = currentVal;
        };

        input.addEventListener('blur', commitTimeChange);
        input.addEventListener('keydown', (ev) => {
          ev.stopPropagation();
          if (ev.key === 'Enter') { ev.preventDefault(); commitTimeChange(); }
          else if (ev.key === 'Escape') { ev.preventDefault(); revertTimeChange(); }
        });
        input.addEventListener('click', (ev) => ev.stopPropagation());
      });
      const title = document.createElement('span'); title.className = 'ai-mark-event-daily-title'; title.textContent = evt.title;

      // عنوان رویداد ساعتی داخل برگه کاغذی هم قابل ویرایش درجا باشد، با همان تولتیپ ۸ زبانه
      title.title = langPick({
        fa: 'برای ویرایش متن کلیک کنید',
        en: 'Click to edit text',
        ar: 'انقر لتعديل النص',
        es: 'Haz clic para editar el texto',
        de: 'Klicken Sie, um den Text zu bearbeiten',
        fr: 'Cliquez pour modifier le texte',
        ja: 'クリックしてテキストを編集',
        ru: 'Нажмите, чтобы изменить текст'
      });
      title.style.cursor = 'text';

      title.addEventListener('click', (e) => {
        e.stopPropagation();
        if (title.querySelector('input')) return;

        const currentVal = evt.title;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentVal;
        input.dir = 'auto';
        input.className = 'ai-mark-event-daily-title-inline-input';

        Object.assign(input.style, {
          width: '100%',
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          borderRadius: '6px',
          color: 'inherit',
          padding: '1px 6px',
          fontSize: 'inherit',
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box'
        });

        title.textContent = '';
        title.appendChild(input);
        input.focus();
        input.select();

        let isCommitted = false;

        const commitChange = () => {
          if (isCommitted) return;
          isCommitted = true;
          const newText = input.value.trim();

          if (newText && newText !== currentVal) {
            evt.title = newText;

            if (evt.linkedTodoId) {
              const linked = todosData.find(td => td.id === evt.linkedTodoId);
              if (linked) {
                linked.text = `${evt.startTime} — ${newText}`;
                saveTodos();
                if (todoPanel.classList.contains('active')) renderTodos();
              }
            }

            saveTimeEvents();
            renderMarkEventDailyList(iso);
            if (uiEls.dashPanel && uiEls.dashPanel.classList.contains('active')) refreshDashUI();
            showToastNotification(langPick({
              fa: 'رویداد ویرایش شد',
              en: 'Event updated',
              ar: 'تم تعديل الحدث',
              es: 'Evento actualizado',
              de: 'Ereignis aktualisiert',
              fr: 'Événement mis à jour',
              ja: 'イベントを更新しました',
              ru: 'Событие обновлено'
            }));
          } else {
            title.textContent = currentVal;
          }
        };

        const revertChange = () => {
          if (isCommitted) return;
          isCommitted = true;
          title.textContent = currentVal;
        };

        input.addEventListener('blur', commitChange);
        input.addEventListener('keydown', (ev) => {
          ev.stopPropagation();
          if (ev.key === 'Enter') { ev.preventDefault(); commitChange(); }
          else if (ev.key === 'Escape') { ev.preventDefault(); revertChange(); }
        });
        input.addEventListener('click', (ev) => ev.stopPropagation());
      });

      row.appendChild(dot); row.appendChild(time); row.appendChild(title);
      if (evt.linkedTodoId) {
        const link = document.createElement('span'); link.className = 'ai-mark-event-daily-link'; link.textContent = '↗'; link.title = t('dashLinkedTodo');
        row.appendChild(link);
      }
      appendEventGoalControls(row, evt);
      const delBtn = document.createElement('button');
      delBtn.type = 'button'; delBtn.className = 'ai-mark-event-daily-del'; delBtn.title = t('markDeleteTitle'); delBtn.textContent = '×';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteDashEvent(evt.id);
        renderMarkEventDailyList(iso);
      });
      row.appendChild(delBtn);
      uiEls.markEventDailyList.appendChild(row);
    });
  }

  // وقتی روی «روز جاری» کلیک می‌شود ولی هیچ مناسبت ثبت‌شده‌ای ندارد، به‌جای سکوت،
  // همان بنر کاغذی رویداد را با یک پیام خلاقانهٔ مخصوص امروز باز می‌کنیم — و زیرِ آن،
  // رویدادهای ساعتی/روزانهٔ همان روز از داشبورد زمان را هم فهرست می‌کنیم.
  function openTodayGreetingSheet(iso) {
    if (!uiEls.markEventSheet) return;
    if (uiEls.markEventBadge) uiEls.markEventBadge.textContent = '✨';
    if (uiEls.markEventText) uiEls.markEventText.textContent = t('markEventText');
    if (uiEls.markEventMeta) uiEls.markEventMeta.textContent = t('markEventMeta');
    if (uiEls.markDeleteRow) uiEls.markDeleteRow.hidden = true;
    uiEls.markEventSheet.classList.remove('is-collapsed');
    dayEventSheetOpenIso = iso;
    currentOpenMarkEvent = null;
    renderMarkEventDailyList(iso);
  }

  // روزی غیر از امروز که مناسبتِ ثبت‌شده (markedDays) ندارد ولی در داشبورد زمان
  // رویداد ساعتی/روزانه برایش ثبت شده — به‌جای سکوتِ قبلی، همان کشوی کاغذی را با
  // عنوانی خنثی + فهرست رویدادهای همان روز باز می‌کنیم؛ هماهنگیِ منطقی بین دو محل ثبت.
  function openDayEventsSheet(iso) {
    if (!uiEls.markEventSheet) return;
    const [gy, gm, gd] = iso.split('-').map(Number);
    const fa = currentLang === 'fa';
    let dateStr;
    if (fa) {
      const j = gregorianToJalaali(gy, gm, gd);
      const monthName = JALALI_MONTHS_FA[j.jm - 1] || '';
      dateStr = `${toPersianDigits(j.jd)} ${monthName}`;
    } else {
      const monthName = getDisplayGregorianMonth(gm - 1) || '';
      dateStr = `${currentLang === 'ar' ? toArabicDigits(gd) : gd} ${monthName}`;
    }
    if (uiEls.markEventBadge) uiEls.markEventBadge.textContent = '🗓️';
    if (uiEls.markEventText) uiEls.markEventText.textContent = t('markDayAgenda');
    if (uiEls.markEventMeta) uiEls.markEventMeta.textContent = dateStr;
    if (uiEls.markDeleteRow) uiEls.markDeleteRow.hidden = true;
    uiEls.markEventSheet.classList.remove('is-collapsed');
    dayEventSheetOpenIso = iso;
    currentOpenMarkEvent = null;
    renderMarkEventDailyList(iso);
  }

  // تعطیلات رسمی آنلاین: کشور را حدس می‌زند (فعلاً بر پایهٔ زبان برنامه، تا وقتی
  // یک انتخاب‌گر کشور دستی در تنظیمات اضافه شود) و از background.js می‌خواهد.
  // «auto» هوشمند است: با تغییر زبان برنامه (fa↔en) هم‌زمان کشور را دوباره حدس می‌زند
  function resolveHolidayCountryCode() {
    if (holidayRegionMode === 'IR') return 'IR';
    if (holidayRegionMode === 'custom' && holidayCustomCountry) return holidayCustomCountry;
    if (currentLang === 'fa') return 'IR';
    if (currentLang === 'ru') return 'RU';
    if (currentLang === 'tr') return 'TR';
    if (currentLang === 'zh-Hans') return 'CN';
    if (currentLang === 'zh-Hant') return 'TW';
    if (currentLang === 'pt-BR') return 'BR';
    try {
      const loc = Intl.DateTimeFormat().resolvedOptions().locale || '';
      const region = loc.split('-').find(p => p.length === 2 && p === p.toUpperCase());
      if (region) return region;
    } catch (e) {}
    return 'US';
  }
  function loadRegionalHolidays() {
    if (!showPublicHolidays) {
      publicHolidays = [];
      renderMarkedDays();
      if (typeof renderDualGrid === 'function' && dualPickerOpen) renderDualGrid();
      return;
    }
    const countryCode = resolveHolidayCountryCode();
    try {
      if (!chrome.runtime?.id) return;
      chrome.runtime.sendMessage(
        { action: 'fetchGlobalHolidays', countryCode, year: new Date().getFullYear() },
        (response) => {
          if (chrome.runtime.lastError) {
            // معمولاً یعنی background.js هنوز listenerِ 'fetchGlobalHolidays' را ندارد —
            // این خط برای تشخیص همین حالت در کنسول توسعه‌دهنده است.
            console.warn('[AI Orbit] fetchGlobalHolidays failed — is the holidays block merged into background.js?', chrome.runtime.lastError.message);
            return;
          }
          if (response && response.success && Array.isArray(response.data)) {
            publicHolidays = response.data;
            console.info('[AI Orbit] Loaded', publicHolidays.length, 'public holidays for', countryCode, '(source:', response.source + ')');
            renderMarkedDays();
            if (typeof renderDualGrid === 'function' && dualPickerOpen) renderDualGrid();
          } else {
            console.warn('[AI Orbit] fetchGlobalHolidays responded without usable data:', response);
          }
        }
      );
    } catch (e) {}
  }

  function renderMarkedDays() {
    pruneExpiredMarkedDays();
    if (!uiEls.markDotsInner) return;
    const birthdayMarks = getBirthdayCalendarMarks();
    const manualMarks = Array.isArray(markedDays) ? markedDays : [];
    if (uiEls.birthdayRow && uiEls.birthdayList) {
      uiEls.birthdayList.innerHTML = '';
      uiEls.birthdayRow.hidden = birthdayMarks.length === 0;
      if (birthdayMarks.length) {
        if (uiEls.birthdayLabel) uiEls.birthdayLabel.textContent = langPick({ fa: 'تولدها', en: 'Birthdays', ar: 'أعياد الميلاد', es: 'Cumpleaños', de: 'Geburtstage', fr: 'Anniversaires', ja: '誕生日', ru: 'Дни рождения' });
        birthdayMarks
          .map(m => ({ ...m, days: daysUntilNext(m.day, m.month, m.cal) }))
          .sort((a, b) => a.days - b.days)
          .forEach(m => {
            const chip = document.createElement('button');
            chip.type = 'button'; chip.className = 'ai-clock-birthday-chip';
            const mm = String(m.month).padStart(2, '0'); const dd = String(m.day).padStart(2, '0');
            const dateLabel = langPick({ fa: `ماه ${localizeDigits(mm)} · روز ${localizeDigits(dd)}`, en: `Month ${mm} · Day ${dd}`, ar: `الشهر ${toArabicDigits(mm)} · اليوم ${toArabicDigits(dd)}` });
            chip.textContent = `${m.shortLabel} · ${mm}-${dd}`;
            chip.title = `${m.label} · ${dateLabel}`;
            chip.setAttribute('aria-label', chip.title);
            chip.addEventListener('click', (e) => {
              e.stopPropagation();
              openMarkEventSheet(m);
            });
            uiEls.birthdayList.appendChild(chip);
          });
      }
    }
    // تا ۵ مناسبت نزدیک — کلیک → کشوی کاغذی بالای تقویم
    uiEls.markDotsInner.innerHTML = '';
    if (birthdayMarks.length === 0 && manualMarks.length === 0) {
      if (uiEls.markToggle) uiEls.markToggle.classList.remove('has-items');
      closeMarkEventSheet();
    } else {
      if (uiEls.markToggle) uiEls.markToggle.classList.add('has-items');
      const nearestMarks = manualMarks
        .map(m => ({ ...m, days: daysUntilNext(m.day, m.month, m.cal) }))
        .sort((a, b) => a.days - b.days)
        .slice(0, 5);

      nearestMarks.forEach((m, idx) => {
        const wrap = document.createElement('div'); wrap.className = 'ai-mark-dot-wrap';
const dot = document.createElement('button'); dot.type = 'button';
const isExpired = !m.golden && isMarkedDayPast(m.day, m.month, m.cal);
dot.className = 'ai-mark-dot' + (m.days === 0 ? ' is-today' : '') + (m.golden ? ' is-golden' : '') + (m.isBirthday ? ' is-birthday' : '') + (isExpired ? ' is-expired' : '');
        dot.textContent = m.isBirthday ? '🎂' : String(idx + 1);
        dot.title = m.label;
        dot.addEventListener('mousedown', (e) => e.stopPropagation());
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          const already = dot.classList.contains('is-active');
          uiEls.markDotsRow.querySelectorAll('.ai-mark-dot.is-active').forEach(d => d.classList.remove('is-active'));
          if (already) {
            closeMarkEventSheet();
          } else {
            dot.classList.add('is-active');
            openMarkEventSheet(m);
          }
        });
        wrap.appendChild(dot);
        uiEls.markDotsInner.appendChild(wrap);
      });
    }

    // لیست مدیریت مناسبت‌ها داخل پنل
    if (!uiEls.markList) return;
    uiEls.markList.innerHTML = '';
    if (!Array.isArray(markedDays) || markedDays.length === 0) {
      const empty = document.createElement('li'); empty.className = 'ai-mark-empty';
      empty.textContent = birthdayMarks.length
        ? langPick({ fa: 'هنوز مناسبت موردی ثبت نشده', en: 'No one-off occasions yet', ar: 'لا توجد مناسبات يدوية بعد', es: 'Aún no hay ocasiones puntuales', de: 'Noch keine Einzeltermine', fr: 'Aucune occasion ponctuelle', ja: '個別の予定はまだありません', ru: 'Разовых событий пока нет' })
        : t('markEmpty');
      uiEls.markList.appendChild(empty);
      if (uiEls.markPanel) uiEls.markPanel.classList.remove('is-grown');
      if (uiEls.markPanel && uiEls.markPanel.classList.contains('active')) positionMarksPanelSide();
      return;
    }
    markedDays.slice().sort((a, b) => daysUntilNext(a.day, a.month, a.cal) - daysUntilNext(b.day, b.month, b.cal)).forEach(m => {
     const isExpired = !m.golden && isMarkedDayPast(m.day, m.month, m.cal);
      const li = document.createElement('li'); li.className = 'ai-mark-item' + (m.golden ? ' is-golden' : '') + (isExpired ? ' is-expired' : '');
      const span = document.createElement('span'); span.className = 'ai-mark-item-label';
      const dd = String(m.day).padStart(2, '0'); const mm = String(m.month).padStart(2, '0');
      const isJ = m.cal === 'j' || m.cal === 'jalali';
      const dateStr = (isJ && currentLang === 'fa') ? toPersianDigits(`${dd}/${mm}`) : (currentLang === 'ar' ? toArabicDigits(`${dd}/${mm}`) : `${dd}/${mm}`);
      
      const starPrefix = m.golden ? '★ ' : '';
      span.textContent = `${starPrefix}${m.label}  ·  ${dateStr}`;
      span.title = langPick({
        fa: 'دوبار کلیک برای ویرایش عنوان',
        en: 'Double click to edit label',
        ar: 'انقر مرتين لتعديل العنوان',
        es: 'Doble clic para editar la etiqueta',
        de: 'Doppelklick, um die Bezeichnung zu bearbeiten',
        fr: 'Double-cliquez pour modifier le libellé',
        ja: 'ダブルクリックしてラベルを編集',
        ru: 'Дважды щёлкните, чтобы изменить название'
      });

      // دابل کلیک روی عنوان رویداد جهت ویرایش درجا (Inline Edit)
      span.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (span.querySelector('input')) return;

        const currentLabel = m.label;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentLabel;
        input.dir = 'auto';
        input.className = 'ai-mark-inline-edit-input';

        Object.assign(input.style, {
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '4px',
          color: '#fff',
          padding: '1px 6px',
          fontFamily: 'inherit',
          fontSize: '12px',
          outline: 'none',
          width: '65%'
        });

        span.textContent = '';
        span.appendChild(input);
        const dateTag = document.createElement('span');
        dateTag.textContent = `  ·  ${dateStr}`;
        span.appendChild(dateTag);

        input.focus();
        input.select();

        let isCommitted = false;

        const commit = () => {
          if (isCommitted) return;
          isCommitted = true;
          const newLabel = input.value.trim();
          if (newLabel && newLabel !== currentLabel) {
            m.label = newLabel;
            saveMarkedDays();
            renderMarkedDays();
            showToastNotification(langPick({
              fa: 'عنوان مناسبت ویرایش شد',
              en: 'Event label updated',
              ar: 'تم تعديل عنوان الحدث',
              es: 'Etiqueta del evento actualizada',
              de: 'Ereignisbezeichnung aktualisiert',
              fr: "Libellé de l'événement mis à jour",
              ja: 'イベントのラベルを更新しました',
              ru: 'Название события обновлено'
            }));
          } else {
            span.textContent = `${starPrefix}${currentLabel}  ·  ${dateStr}`;
          }
        };

        const cancel = () => {
          if (isCommitted) return;
          isCommitted = true;
          span.textContent = `${starPrefix}${currentLabel}  ·  ${dateStr}`;
        };

        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (ev) => {
          ev.stopPropagation();
          if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
          else if (ev.key === 'Escape') { ev.preventDefault(); cancel(); }
        });
        input.addEventListener('click', (ev) => ev.stopPropagation());
      });

      const delBtn = document.createElement('button'); delBtn.type = 'button'; delBtn.className = 'ai-mark-item-del'; delBtn.title = t('markDeleteTitle'); delBtn.textContent = '×';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteMarkedDayById(m.id);
      });
      li.addEventListener('click', (e) => {
        if (e.target === delBtn || delBtn.contains(e.target) || e.target.tagName === 'INPUT') return;
        e.stopPropagation();
        const withDays = { ...m, days: daysUntilNext(m.day, m.month, m.cal) };
        openMarkEventSheet(withDays);
      });
      li.style.cursor = 'pointer';
      li.appendChild(span); li.appendChild(delBtn);
      uiEls.markList.appendChild(li);
    });
    // Panel grows a bit wider once the event list gets long, so entries stay comfortable to read/tap
    if (uiEls.markPanel) uiEls.markPanel.classList.toggle('is-grown', markedDays.length > 3);
    // Width/height may have just changed (grew or shrank) — re-clamp so it never sticks off-screen
    if (uiEls.markPanel && uiEls.markPanel.classList.contains('active')) positionMarksPanelSide();

    // ردیف دات‌های رزگلد/ساعتی همیشه همراه با ردیف دات‌های طلایی رفرش می‌شود
    renderDashDotsRow();
  }

  // موقعیت آماده‌به‌کار دکمهٔ تاگلِ مناسبت‌ها: حتی وقتی پنل هنوز باز نشده، بر اساس اینکه
  // ساعت در کدام نیمهٔ صفحه است تنظیم می‌شود — تا از همان ابتدا در سمتی باشد که تقویم
  // واقعاً قرار است باز شود، نه همیشه سمت راستِ پیش‌فرض.
  function syncMarksToggleRestSide() {
    if (!uiEls.markPanel) return;
    if (uiEls.markPanel.classList.contains('active')) { positionMarksPanelSide(); return; }
    const rect = clockPanel.getBoundingClientRect();
    const vw = window.innerWidth;
    const clockCenterX = rect.left + rect.width / 2;
    const openLeft = clockCenterX >= vw / 2; // ساعت در نیمهٔ راست صفحه → تاگل/تقویم به چپ می‌رود
    clockPanel.classList.toggle('marks-open-left', openLeft);
  }

  function positionMarksPanelSide() {
    if (!uiEls.markPanel || !uiEls.markPanel.classList.contains('active')) return;
    const rect = clockPanel.getBoundingClientRect();
    const panelW = (uiEls.markPanel.offsetWidth || 320) + 36; // gap so opener toggle never collides with page-2
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceRight = vw - rect.right;
    const spaceLeft = rect.left;
    const clockCenterX = rect.left + rect.width / 2;

    // اگر ساعت در نیمهٔ چپ صفحه است → تقویم سمت راست و مماس
    // اگر ساعت در نیمهٔ راست صفحه است → تقویم سمت چپ و مماس
    // در صورت کمبود فضا، طرفی که جا دارد انتخاب می‌شود
    let openLeft;
    if (clockCenterX < vw / 2) {
      openLeft = false; // سمت راست ساعت
      if (spaceRight < panelW && spaceLeft >= panelW) openLeft = true;
    } else {
      openLeft = true; // سمت چپ ساعت
      if (spaceLeft < panelW && spaceRight >= panelW) openLeft = false;
    }

    uiEls.markPanel.classList.toggle('side-left', openLeft);
    clockPanel.classList.toggle('marks-open-left', openLeft);

    // Vertical clamp: the panel defaults to top-aligned with the clock (CSS top:0), but if the
    // clock sits low/high on screen the (now taller) panel can run off the viewport — shift it
    // up/down with an inline offset so it always stays fully visible.
    const margin = 10;
    const panelH = uiEls.markPanel.offsetHeight || 300;
    let topOffset = 0;
    if (rect.top + panelH > vh - margin) topOffset = (vh - margin) - panelH - rect.top;
    if (rect.top + topOffset < margin) topOffset = margin - rect.top;
    uiEls.markPanel.style.top = `${topOffset}px`;
  }

  // ============================= داشبورد زمان (فقط برنامهٔ ساعتیِ «امروز» — طبق بازنگری) =============================
  // به‌درخواست کاربر، پیچیدگیِ نوارِ هفتگی/جابه‌جایی بین روزها به‌طور کامل حذف شد؛ فقط
  // «امروز» مدیریت می‌شود. هر رویداد هم‌زمان یک TODO روزانهٔ متناظر می‌سازد (linkedTodoId)
  // تا در پنل TODO هم دیده شود؛ حذف/تیک‌زدنِ رویداد، TODOِ لینک‌شده را هم همگام می‌کند.
  const expandedDashGroups = new Set(); // baseTime گروه‌هایی که کاربر باز کرده (تا رفرش بعدی حفظ شود)

  function pad2(n) { return String(n).padStart(2, '0'); }
  function isoFromDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
  function todayDashIso() { return isoFromDate(new Date()); }
  function tomorrowDashIso() { const d = new Date(); d.setDate(d.getDate() + 1); return isoFromDate(d); }
  // «فردا بودنِ» یک TODو با مقایسهٔ createdAt با نیمه‌شبِ پیشِ‌رو تعیین می‌شود
  // (نه با خودِ «الان»). قبلاً `createdAt > now` بود که برای TODوی «افزودن برای
  // فردا» درست کار می‌کرد (createdAt = نیمه‌شبِ امشب)، اما یک کارِ ساعتیِ همین
  // امروز (مثلاً رویدادی برای ساعت ۱۸ وقتی الان ۱۴ است) هم createdAt‌ش در
  // آینده است و به‌اشتباه «فردا» طبقه‌بندی می‌شد. مرزِ درست، نیمه‌شب است.
  function startOfTomorrowMs(ts) {
    const d = new Date(ts || Date.now());
    d.setHours(24, 0, 0, 0);
    return d.getTime();
  }
  // نمایشِ گرافیکیِ روز/شب کنار ساعتِ هر رویداد — بر اساسِ ساعتِ شروع (۰۶ تا ۱۸ = روز)
  function dayNightIcon(hhmm) {
    const hour = parseInt(String(hhmm).split(':')[0], 10);
    if (isNaN(hour)) return '';
    return (hour >= 6 && hour < 18) ? '☀️' : '🌙';
  }

  function evaluateEventStatus(evt) {
    if (evt.status === 'done') return 'done';
    const eventTime = new Date(`${evt.date}T${evt.startTime}:00`);
    if (isNaN(eventTime.getTime())) return 'future';
    const diffMinutes = (eventTime - new Date()) / 60000;
    if (diffMinutes < 0) return evt.recurring ? 'recurring-elapsed' : 'missed';
    if (diffMinutes <= 30) return 'near';
    return 'future';
  }
  // رویدادهای ساعتیِ سریع (دشبورد زمان) هیچ انتخاب‌گرِ تاریخ ندارند — فقط ساعت.
  // اگر ساعتِ انتخاب‌شده از «الان» گذشته باشد (مثلاً ساعت ۱۰ صبح، کاربر ۹ صبح را
  // انتخاب می‌کند)، قطعاً منظورش «فردا همین ساعت» است، نه «امروزِ گذشته» — وگرنه
  // evaluateEventStatus بالا بلافاصله آن را missed/خط‌خورده نشان می‌دهد. این تابع
  // تاریخِ درستِ رویداد را برمی‌گرداند (امروز یا فردا)، و در پیش‌نمایشِ اسلایدر هم
  // برای نشان‌دادنِ برچسبِ «فردا» به همان شکل استفاده می‌شود — یک منبعِ واحد.
  function resolveScheduledDashDate(hhmm) {
    const now = new Date();
    const [h, m] = String(hhmm).split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return todayDashIso();
    const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
    if (candidate <= now) candidate.setDate(candidate.getDate() + 1);
    return isoFromDate(candidate);
  }
  function isScheduledForTomorrow(hhmm) {
    return resolveScheduledDashDate(hhmm) !== todayDashIso();
  }
  function hhmmDiffMinutes(a, b) {
    const [ah, am] = a.split(':').map(Number); const [bh, bm] = b.split(':').map(Number);
    return Math.abs((bh * 60 + bm) - (ah * 60 + am));
  }
  function groupTimeEvents(events) {
    const grouped = []; let currentGroup = null;
    events.slice().sort((a, b) => a.startTime.localeCompare(b.startTime)).forEach(evt => {
      if (!currentGroup) { currentGroup = { isGroup: false, events: [evt], baseTime: evt.startTime }; }
      else if (hhmmDiffMinutes(currentGroup.baseTime, evt.startTime) <= 15) { currentGroup.isGroup = true; currentGroup.events.push(evt); }
      else { grouped.push(currentGroup); currentGroup = { isGroup: false, events: [evt], baseTime: evt.startTime }; }
    });
    if (currentGroup) grouped.push(currentGroup);
    return grouped;
  }
  function newLinkId(prefix) { return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function dashEventTimestamp(evt) {
    const t = new Date(`${evt.date}T${evt.startTime}:00`).getTime();
    return isNaN(t) ? Date.now() : t;
  }
  function saveDashEvent(evt) {
    // پل به TODO: هر رویداد ساعتیِ روزانه هم‌زمان یک TODو «روزانه» متناظر می‌سازد —
    // آرایه‌ها کاملاً جدا می‌مانند، فقط شناسه‌ها به هم لینک می‌شوند. createdAt برابرِ
    // خودِ لحظهٔ رویداد است (نه لحظهٔ ساخته‌شدنش) تا اگر رویداد برای فردا ثبت شده،
    // TODوی لینک‌شده هم در پنل TODO درست به‌عنوانِ «فردا» دیده شود، نه «امروز».
    const linkedTodo = { id: newLinkId('td'), text: `${evt.startTime} — ${evt.title}`, done: false, type: 'daily', createdAt: dashEventTimestamp(evt) };
    todosData.push(linkedTodo); saveTodos();
    if (todoPanel.classList.contains('active')) renderTodos();
    evt.linkedTodoId = linkedTodo.id;
    timeEventsData.push(evt); saveTimeEvents(); refreshDashUI();
  }
  function deleteDashEvent(id) {
    const evt = timeEventsData.find(e => e.id === id);
    if (evt && evt.linkedTodoId) {
      const idx = todosData.findIndex(td => td.id === evt.linkedTodoId);
      if (idx !== -1) {
        const linkedTodo = todosData[idx];
        // مثلِ منقضی‌شدنِ طبیعیِ یک کارِ روزانهٔ پیوندی: قبل از حذف، اگر انجام
        // شده و به یک هدف پیوند بود، سهمِ درصدش را روی هدف آرشیو کن تا با حذفِ
        // رویداد، پیشرفتِ هدف یک‌دفعه عقب نرود.
        if (linkedTodo.done && linkedTodo.linkedGoalId) {
          const g = getGoalById(linkedTodo.linkedGoalId);
          if (g) adjustGoalCompletedWeight(g, todoImpactPct(linkedTodo));
        }
        todosData.splice(idx, 1); saveTodos(); if (todoPanel.classList.contains('active')) renderTodos();
      }
    }
    // آرشیو در Memory Layer: فقط خودِ رویداد (نه TODوی لینک‌شده‌اش هم — چون آن
    // فقط آینه‌ای خودکار از همین رویداد است، نه یک چیزِ معنادارِ جدا؛ آرشیوِ
    // هردو یعنی شمارشِ دوتایی در ویجتِ Today's Echo).
    if (evt && typeof AITreeMemoryEngine !== 'undefined') {
      try {
        AITreeMemoryEngine.archiveEvent(evt, 'deleted');
        showToastNotification(t('toastEventDeleted') + ' · ' + t('toastSavedToMemory'));
      } catch (e) {}
    }
    timeEventsData = timeEventsData.filter(e => e.id !== id); saveTimeEvents(); refreshDashUI();
  }
  function toggleDashEventDone(id) {
    const evt = timeEventsData.find(e => e.id === id); if (!evt) return;
    const wasDone = evt.status === 'done';
    evt.status = wasDone ? 'future' : 'done';
    if (evt.linkedTodoId) {
      const linkedTodo = todosData.find(td => td.id === evt.linkedTodoId);
      if (linkedTodo) {
        // دقیقاً همان منطقِ toggleTodoDone: پیشرفتِ هدفِ پیوندی (اگر باشد) قبل
        // و بعدِ تیک را می‌سنجیم تا فقط موقعِ «تیک‌خوردن» (نه برداشتنِ تیک) و
        // فقط موقعِ عبور از یک آستانه، فشفشه جشن بگیرد.
        let goal = null, prev = 0;
        if (linkedTodo.linkedGoalId) {
          goal = getGoalById(linkedTodo.linkedGoalId);
          if (goal) prev = computeGoalProgress(goal);
        }
        linkedTodo.done = (evt.status === 'done');
        if (goal) {
          const next = syncGoalProgressFromChildren(goal);
          if (linkedTodo.done) {
            const locus = document.querySelector('.ai-goal-card') || todoPanel;
            celebrateGoalProgress(goal, prev, next, locus);
          }
        }
        saveTodos();
        if (todoPanel.classList.contains('active')) renderTodos();
      }
    }
    // فقط لحظه‌ی تیک‌خوردن (نه برعکسش) به حافظه آرشیو می‌شود — برداشتنِ تیک یعنی
    // «پشیمان شدم»، نه یک رخدادِ جدیدی که ارزشِ به‌خاطرسپردن داشته باشد.
    if (!wasDone && evt.status === 'done' && typeof AITreeMemoryEngine !== 'undefined') {
      try { AITreeMemoryEngine.archiveEvent(evt, 'completed'); } catch (e) {}
    }
    saveTimeEvents(); refreshDashUI();
  }
  function refreshDashUI() { pruneExpiredDashEvents(); renderTimeline(); checkUpcomingEventsReminder(); renderDashDotsRow(); }

  // رویدادهای ساعتی/روزانه پس از گذشتِ یک روز از تاریخِ ثبت‌شده‌شان به‌صورت خودکار حذف
  // می‌شوند — مگر آن‌هایی که با ستارهٔ طلایی «تکرارشونده» علامت خورده‌اند (مثلاً یادآور
  // دارو): این‌ها به‌جای حذف، برای همان روزِ جدید «تازه» می‌شوند — تاریخ به امروز
  // منتقل، وضعیت/تیک ریست، و یک TODوی روزانهٔ تازه برایشان ساخته می‌شود (چون TODوی
  // دیروز جداگانه و به‌مرور منقضی می‌شود).
  function pruneExpiredDashEvents() {
    const iso = todayDashIso();
    const stale = timeEventsData.filter(e => e.date < iso);
    if (!stale.length) return false;

    const deleteIds = new Set();
    let changed = false;
    stale.forEach(evt => {
      if (evt.recurring) {
        // این‌جا چیزی «حل» نشده — رویداد فقط برای روزِ جدید تازه می‌شود، پس آرشیو
        // نمی‌شود (نه completed است، نه deleted؛ ادامه‌دارِ همان رویداد است).
        if (evt.linkedTodoId) {
          const idx = todosData.findIndex(td => td.id === evt.linkedTodoId);
          if (idx !== -1) todosData.splice(idx, 1);
        }
        evt.date = iso;
        evt.status = 'future';
        const linkedTodo = { id: newLinkId('td'), text: `${evt.startTime} — ${evt.title}`, done: false, type: 'daily', createdAt: Date.now() };
        // پیوند به هدف را از خودِ رویداد (منبعِ حقیقتِ پایدار) به TODوی
        // آینه‌ایِ تازه منتقل کن — وگرنه هر تکرارِ روزانه پیوند را پاک می‌کرد.
        if (evt.linkedGoalId) {
          linkedTodo.linkedGoalId = evt.linkedGoalId;
          linkedTodo.impactPct = evt.impactPct || 10;
        }
        todosData.push(linkedTodo);
        evt.linkedTodoId = linkedTodo.id;
        changed = true;
      } else {
        // اینجا واقعاً «حل نشده رها شده» — بدونِ اینکه کاربر حذفش کرده یا تیکش زده
        // باشد، روزش گذشته. این خودش یک سیگنالِ معنادار است: resolution: 'expired'.
        if (typeof AITreeMemoryEngine !== 'undefined') {
          try { AITreeMemoryEngine.archiveEvent(evt, 'expired'); } catch (e) {}
        }
        deleteIds.add(evt.id);
        if (evt.linkedTodoId) {
          const idx = todosData.findIndex(td => td.id === evt.linkedTodoId);
          if (idx !== -1) { todosData.splice(idx, 1); changed = true; }
        }
      }
    });
    if (deleteIds.size) { timeEventsData = timeEventsData.filter(e => !deleteIds.has(e.id)); changed = true; }

    if (changed) { saveTodos(); saveTimeEvents(); if (todoPanel.classList.contains('active')) renderTodos(); }
    return changed;
  }

  // --- موتور یادآوریِ هوشمند: نقطه‌ی چشمک‌زن + یک اعلانِ محوشونده (toast) دقیقاً وقتی
  // یک ساعت تا نزدیک‌ترین رویدادِ امروز مانده — بدون باز کردنِ خودکارِ ویجت. ---
  const notifiedEventIds = new Set();
  function checkUpcomingEventsReminder() {
    const dot = uiEls.dashNotifyDot; if (!dot) return;
    const now = new Date();
    const iso = todayDashIso();
    const upcoming = (timeEventsData || [])
      .filter(e => e.date === iso && e.status !== 'done' && e.status !== 'missed')
      .map(e => ({ e, t: new Date(`${e.date}T${e.startTime}:00`) }))
      .filter(x => !isNaN(x.t.getTime()) && x.t >= now)
      .sort((a, b) => a.t - b.t)[0];

    if (!upcoming) { dot.className = 'ai-dash-notify-dot'; return; }

    const diffMinutes = (upcoming.t - now) / 60000;
    let pulseClass = 'pulse-slow';
    if (diffMinutes <= 15) pulseClass = 'pulse-fast';
    else if (diffMinutes <= 60) pulseClass = 'pulse-med';
    dot.className = `ai-dash-notify-dot visible ${pulseClass}`;

    // یک‌بار، دقیقاً همان لحظه‌ای که فاصله به ۶۰ دقیقه یا کمتر می‌رسد — یک toast محوشونده
    // (نه بازکردنِ خودکارِ ویجت، طبق تصمیمِ کاربر).
    if (diffMinutes <= 60 && !notifiedEventIds.has(upcoming.e.id)) {
      notifiedEventIds.add(upcoming.e.id);
      showToastNotification(t('toastEventOneHour').replace('{title}', upcoming.e.title));
    }
  }

function buildDashEventCard(evt) {
    const status = evaluateEventStatus(evt);
    const card = document.createElement('div');
    card.className = `ai-event-card status-${status}`;
    card.dataset.eventId = evt.id;
    const timeWrap = document.createElement('span'); timeWrap.className = 'ai-event-time-wrap';
    const timeIcon = document.createElement('span'); timeIcon.className = 'ai-event-time-icon'; timeIcon.textContent = dayNightIcon(evt.startTime);
    const timeLabel = document.createElement('span'); timeLabel.className = 'ai-event-time-label'; timeLabel.textContent = evt.startTime;
    timeLabel.style.cursor = 'text';
    timeLabel.title = langPick({
      fa: 'برای ویرایش ساعت کلیک کنید',
      en: 'Click to edit time',
      ar: 'انقر لتعديل الوقت',
      es: 'Haz clic para editar la hora',
      de: 'Klicken Sie, um die Uhrzeit zu bearbeiten',
      fr: "Cliquez pour modifier l'heure",
      ja: 'クリックして時刻を編集',
      ru: 'Нажмите, чтобы изменить время'
    });
    timeLabel.addEventListener('click', (e) => {
      e.stopPropagation();
      if (timeLabel.querySelector('input')) return;

      const currentVal = evt.startTime;
      const input = document.createElement('input');
      input.type = 'time';
      input.value = currentVal;
      input.className = 'ai-event-time-inline-input';

      Object.assign(input.style, {
        width: '84px',
        background: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        borderRadius: '6px',
        color: '#fff',
        padding: '2px 4px',
        fontSize: 'inherit',
        fontFamily: 'inherit',
        outline: 'none',
        boxSizing: 'border-box'
      });

      timeLabel.textContent = '';
      timeLabel.appendChild(input);
      input.focus();

      let isCommitted = false;

      const commitTimeChange = () => {
        if (isCommitted) return;
        isCommitted = true;
        const newVal = input.value;

        if (newVal && newVal !== currentVal) {
          evt.startTime = newVal;

          if (evt.linkedTodoId) {
            const linked = todosData.find(td => td.id === evt.linkedTodoId);
            if (linked) {
              linked.text = `${newVal} — ${evt.title}`;
              saveTodos();
              if (todoPanel.classList.contains('active')) renderTodos();
            }
          }

          saveTimeEvents();
          refreshDashUI();
          showToastNotification(langPick({
            fa: 'رویداد ویرایش شد',
            en: 'Event updated',
            ar: 'تم تعديل الحدث',
            es: 'Evento actualizado',
            de: 'Ereignis aktualisiert',
            fr: 'Événement mis à jour',
            ja: 'イベントを更新しました',
            ru: 'Событие обновлено'
          }));
        } else {
          timeLabel.textContent = currentVal;
        }
      };

      const revertTimeChange = () => {
        if (isCommitted) return;
        isCommitted = true;
        timeLabel.textContent = currentVal;
      };

      input.addEventListener('blur', commitTimeChange);
      input.addEventListener('keydown', (ev) => {
        ev.stopPropagation();
        if (ev.key === 'Enter') {
          ev.preventDefault();
          commitTimeChange();
        } else if (ev.key === 'Escape') {
          ev.preventDefault();
          revertTimeChange();
        }
      });
      input.addEventListener('click', (ev) => ev.stopPropagation());
    });
    const dot = document.createElement('div'); dot.className = 'ai-event-dot'; dot.title = t('dashToggleDoneTitle');
    dot.addEventListener('click', (e) => { e.stopPropagation(); toggleDashEventDone(evt.id); });
    timeWrap.appendChild(timeIcon); timeWrap.appendChild(timeLabel); timeWrap.appendChild(dot);

    // عنوان رویداد با قابلیت ویرایش درجا و ۸ زبانه
    const title = document.createElement('div'); 
    title.className = 'ai-event-title'; 
    title.textContent = evt.title;
    title.title = langPick({
      fa: 'برای ویرایش متن کلیک کنید',
      en: 'Click to edit text',
      ar: 'انقر لتعديل النص',
      es: 'Haz clic para editar el texto',
      de: 'Klicken Sie, um den Text zu bearbeiten',
      fr: 'Cliquez pour modifier le texte',
      ja: 'クリックしてテキストを編集',
      ru: 'Нажмите, чтобы изменить текст'
    });
    title.style.cursor = 'text';

    title.addEventListener('click', (e) => {
      e.stopPropagation();
      if (title.querySelector('input')) return;

      const currentVal = evt.title;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = currentVal;
      input.dir = 'auto';
      input.className = 'ai-event-title-inline-input';

      Object.assign(input.style, {
        width: '100%',
        background: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        borderRadius: '6px',
        color: '#fff',
        padding: '2px 6px',
        fontSize: 'inherit',
        fontFamily: 'inherit',
        outline: 'none',
        boxSizing: 'border-box'
      });

      title.textContent = '';
      title.appendChild(input);
      input.focus();
      input.select();

      let isCommitted = false;

      const commitChange = () => {
        if (isCommitted) return;
        isCommitted = true;
        const newText = input.value.trim();

        if (newText && newText !== currentVal) {
          evt.title = newText;

          if (evt.linkedTodoId) {
            const linked = todosData.find(td => td.id === evt.linkedTodoId);
            if (linked) {
              linked.text = `${evt.startTime} — ${newText}`;
              saveTodos();
              if (todoPanel.classList.contains('active')) renderTodos();
            }
          }

          saveTimeEvents();
          refreshDashUI();
          showToastNotification(langPick({
            fa: 'رویداد ویرایش شد',
            en: 'Event updated',
            ar: 'تم تعديل الحدث',
            es: 'Evento actualizado',
            de: 'Ereignis aktualisiert',
            fr: 'Événement mis à jour',
            ja: 'イベントを更新しました',
            ru: 'Событие обновлено'
          }));
        } else {
          title.textContent = currentVal;
        }
      };

      const revertChange = () => {
        if (isCommitted) return;
        isCommitted = true;
        title.textContent = currentVal;
      };

      input.addEventListener('blur', commitChange);
      input.addEventListener('keydown', (ev) => {
        ev.stopPropagation();
        if (ev.key === 'Enter') {
          ev.preventDefault();
          commitChange();
        } else if (ev.key === 'Escape') {
          ev.preventDefault();
          revertChange();
        }
      });
      input.addEventListener('click', (ev) => ev.stopPropagation());
    });

    const delBtn = document.createElement('button'); delBtn.type = 'button'; delBtn.className = 'ai-event-del'; delBtn.title = t('markDeleteTitle'); delBtn.textContent = '×';
    delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteDashEvent(evt.id); });
    card.appendChild(timeWrap); card.appendChild(title);
    if (evt.recurring) { const badge = document.createElement('span'); badge.className = 'ai-event-recur-badge'; badge.title = t('dashRecurringBadge'); badge.textContent = '★'; card.appendChild(badge); }
    if (status === 'recurring-elapsed') { const chip = document.createElement('span'); chip.className = 'ai-event-recur-elapsed-chip'; chip.textContent = '↻ ' + t('scrubberTomorrowBadge'); card.appendChild(chip); }
    appendEventGoalControls(card, evt);
    card.appendChild(delBtn);
    if (evt.linkedTodoId) { const meta = document.createElement('div'); meta.className = 'ai-event-meta'; meta.textContent = '↗ ' + t('dashLinkedTodo'); card.appendChild(meta); }
    return card;
  }

  function renderTimeline() {
    const container = uiEls.timelineContent; if (!container) return;
    const iso = todayDashIso();
    container.innerHTML = '';
    const todaysEvents = timeEventsData.filter(e => e.date === iso);
    if (!todaysEvents.length) {
      const empty = document.createElement('div'); empty.className = 'ai-dash-empty'; empty.textContent = t('dashNoEvents');
      container.appendChild(empty);
    } else {
      groupTimeEvents(todaysEvents).forEach(group => {
        if (group.isGroup && !expandedDashGroups.has(group.baseTime)) {
          const card = document.createElement('div'); card.className = 'ai-event-card ai-event-group';
          const timeWrap = document.createElement('span'); timeWrap.className = 'ai-event-time-wrap';
          const timeIcon = document.createElement('span'); timeIcon.className = 'ai-event-time-icon'; timeIcon.textContent = dayNightIcon(group.baseTime);
          const timeLabel = document.createElement('span'); timeLabel.className = 'ai-event-time-label'; timeLabel.textContent = group.baseTime;
          const dot = document.createElement('div'); dot.className = 'ai-event-dot';
          timeWrap.appendChild(timeIcon); timeWrap.appendChild(timeLabel); timeWrap.appendChild(dot);
          const title = document.createElement('div'); title.className = 'ai-event-title'; title.textContent = `${group.events.length} ${t('dashEventsWord')}`;
          card.appendChild(timeWrap); card.appendChild(title);
          card.addEventListener('click', (e) => { e.stopPropagation(); expandedDashGroups.add(group.baseTime); renderTimeline(); });
          container.appendChild(card);
        } else {
          group.events.forEach(evt => container.appendChild(buildDashEventCard(evt)));
        }
      });
    }
    renderTomorrowPreviewBox(container);
    renderDashTodoSummary();
    updateNextEventWidget();
    updateNowLine();
  }

  // «امروز-فقط» بودنِ داشبورد یعنی رویدادِ فردا در تایم‌لاینِ اصلی اصلاً دیده
  // نمی‌شود — دقیقاً همان چیزی که کاربر گزارش کرد: نشانِ «فردا» فقط در پنلِ
  // TODو دیده می‌شد، نه اینجا. این یک کادرِ فشردهٔ جدا (نه یک تایم‌لاینِ کامل
  // برای فردا — همان سادگیِ «فقط امروز» حفظ می‌شود) که فقط رویدادهای فردا را
  // پیش‌نمایش می‌دهد؛ کلیک روی آن، همان برگهٔ روزِ فردا را باز می‌کند (openDayEventsSheet).
  function renderTomorrowPreviewBox(container) {
    const tIso = tomorrowDashIso();
    const tomorrowEvents = timeEventsData.filter(e => e.date === tIso).slice().sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (!tomorrowEvents.length) return;

    const box = document.createElement('div'); box.className = 'ai-dash-tomorrow-box'; box.tabIndex = 0; box.setAttribute('role', 'button');
    const header = document.createElement('div'); header.className = 'ai-dash-tomorrow-header';
    const icon = document.createElement('span'); icon.className = 'ai-dash-tomorrow-icon'; icon.textContent = '↻';
    const label = document.createElement('span'); label.className = 'ai-dash-tomorrow-label'; label.textContent = `${t('scrubberTomorrowBadge')} · ${tomorrowEvents.length}`;
    header.append(icon, label);
    box.appendChild(header);

    const list = document.createElement('div'); list.className = 'ai-dash-tomorrow-list';
    tomorrowEvents.slice(0, 4).forEach(evt => {
      const row = document.createElement('div'); row.className = 'ai-dash-tomorrow-row';
      const time = document.createElement('span'); time.className = 'ai-dash-tomorrow-time'; time.textContent = evt.startTime;
      time.style.cursor = 'text';
      time.title = langPick({
        fa: 'برای ویرایش ساعت کلیک کنید', en: 'Click to edit time', ar: 'انقر لتعديل الوقت',
        es: 'Haz clic para editar la hora', de: 'Klicken Sie, um die Uhrzeit zu bearbeiten',
        fr: "Cliquez pour modifier l'heure", ja: 'クリックして時刻を編集', ru: 'Нажмите, чтобы изменить время'
      });
      time.addEventListener('click', (e) => {
        e.stopPropagation();
        if (time.querySelector('input')) return;
        const currentVal = evt.startTime;
        const input = document.createElement('input');
        input.type = 'time'; input.value = currentVal; input.className = 'ai-dash-tomorrow-time-input';
        Object.assign(input.style, { width: '78px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '6px', color: 'inherit', padding: '1px 4px', fontSize: 'inherit', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' });
        time.textContent = ''; time.appendChild(input); input.focus();
        let isCommitted = false;
        const commit = () => {
          if (isCommitted) return; isCommitted = true;
          const newVal = input.value;
          if (newVal && newVal !== currentVal) {
            evt.startTime = newVal;
            if (evt.linkedTodoId) {
              const linked = todosData.find(td => td.id === evt.linkedTodoId);
              if (linked) { linked.text = `${newVal} — ${evt.title}`; saveTodos(); if (todoPanel.classList.contains('active')) renderTodos(); }
            }
            saveTimeEvents(); refreshDashUI();
          } else {
            time.textContent = currentVal;
          }
        };
        const revert = () => { if (isCommitted) return; isCommitted = true; time.textContent = currentVal; };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') { ev.preventDefault(); commit(); } else if (ev.key === 'Escape') { ev.preventDefault(); revert(); } });
        input.addEventListener('click', (ev) => ev.stopPropagation());
      });
      const title = document.createElement('span'); title.className = 'ai-dash-tomorrow-title'; title.textContent = evt.title;
      const delBtn = document.createElement('button');
      delBtn.type = 'button'; delBtn.className = 'ai-dash-tomorrow-del'; delBtn.title = t('markDeleteTitle'); delBtn.textContent = '×';
      delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteDashEvent(evt.id); });
      row.append(time, title, delBtn);
      list.appendChild(row);
    });
    if (tomorrowEvents.length > 4) {
      const more = document.createElement('div'); more.className = 'ai-dash-tomorrow-more'; more.textContent = `+${tomorrowEvents.length - 4}`;
      list.appendChild(more);
    }
    box.appendChild(list);

    // کلیک روی خودِ کادر (نه روی یک ردیفِ رویداد، نه روی زمان/دکمهٔ حذفِ داخلش)
    // برگهٔ کاملِ روزِ فردا را باز می‌کند — برای افزودنِ رویدادِ جدید یا دیدنِ همه.
    const openTomorrow = (e) => {
      if (e.target.closest('.ai-dash-tomorrow-row')) return;
      if (typeof openDayEventsSheet === 'function') openDayEventsSheet(tIso);
    };
    box.addEventListener('click', openTomorrow);
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTomorrow(e); } });

    container.appendChild(box);
  }

  // فهرست کوتاهِ کارهای روزانه در کنار تقویم/داشبورد زمان. این نسخه مستقل از
  // رویدادهای ساعتی است تا هر کار روزانه، حتی اگر ساعت مشخصی ندارد، همان‌جا دیده شود.
  function renderDashTodoSummary() {
    const list = uiEls.dashTodoList;
    if (!list) return;
    const now = Date.now();
    const todayTodos = todosData.filter(todo => {
      const created = todo.createdAt || now;
      return (todo.type || 'daily') === 'daily' && created <= now && now - created < TODO_DAILY_TTL_MS;
    });
    const pending = todayTodos.filter(todo => !todo.done).length;
    if (uiEls.dashTodoCount) uiEls.dashTodoCount.textContent = todayTodos.length ? `${pending}/${todayTodos.length}` : '';
    list.innerHTML = '';

    if (!todayTodos.length) {
      const empty = document.createElement('div');
      empty.className = 'ai-dash-todo-empty';
      empty.textContent = t('todoNoDaily');
      list.appendChild(empty);
      return;
    }

    todayTodos.slice(0, 5).forEach(todo => {
      const row = document.createElement('button');
      row.type = 'button';
      const isLinked = !!(todo.linkedGoalId);
      row.className = 'ai-dash-todo-row' + (todo.done ? ' done' : '') + (isLinked ? ' is-linked' : '');
      row.title = todo.text || '';
      const check = document.createElement('span'); check.className = 'ai-dash-todo-check'; check.textContent = todo.done ? '✓' : '';
      const text = document.createElement('span'); text.className = 'ai-dash-todo-text'; text.textContent = todo.text || '';
      row.append(check, text);
      if (isLinked) {
        const star = document.createElement('span');
        star.className = 'ai-dash-todo-star';
        star.textContent = '★';
        star.setAttribute('aria-hidden', 'true');
        const imp = document.createElement('span');
        imp.className = 'ai-dash-todo-impact';
        imp.textContent = (typeof todoImpactPct === 'function' ? todoImpactPct(todo) : (todo.impactPct || 10)) + '%';
        row.append(star, imp);
      }
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof toggleTodoDone === 'function') toggleTodoDone(todo);
        else {
          todo.done = !todo.done;
          try { memoryOnTodoToggle(todo); } catch (err) {}
          saveTodos();
        }
        renderDashTodoSummary();
        if (todoPanel.classList.contains('active')) renderTodos();
      });
      list.appendChild(row);
    });
  }

  // === ردیف دات‌های رزگلد/نارنجی — رویدادهای ساعتیِ «امروز»، کنار همان تاگلِ داشبورد ===
  function renderDashDotsRow() {
    if (!uiEls.dashDotsInner) return;
    pruneExpiredDashEvents();
    uiEls.dashDotsInner.innerHTML = '';
    const iso = todayDashIso();
    const todaysEvents = timeEventsData
      .filter(e => e.date === iso)
      .slice()
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .slice(0, 5);

    if (!todaysEvents.length) {
      if (uiEls.dashToggle) uiEls.dashToggle.classList.remove('has-items');
    } else {
      if (uiEls.dashToggle) uiEls.dashToggle.classList.add('has-items');
      todaysEvents.forEach((evt, idx) => {
       const status = evaluateEventStatus(evt);
const wrap = document.createElement('div'); wrap.className = 'ai-mark-dot-wrap';
const dot = document.createElement('button'); dot.type = 'button';
const isExpired = (status === 'missed' || evt.status === 'done');
const isRecurringElapsed = status === 'recurring-elapsed';
dot.className = 'ai-dash-dot' + (status === 'near' ? ' is-now' : '') + (isExpired ? ' is-expired' : '') + (isRecurringElapsed ? ' is-recurring-elapsed' : '');        dot.textContent = String(idx + 1);
        dot.title = `${evt.startTime} — ${evt.title}`;
        dot.addEventListener('mousedown', (e) => e.stopPropagation());
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          const already = dot.classList.contains('is-active');
          uiEls.dashDotsRow.querySelectorAll('.ai-dash-dot.is-active').forEach(d => d.classList.remove('is-active'));
          if (!already) {
            dot.classList.add('is-active');
            openDashEventFromDot(evt);
          }
        });
        wrap.appendChild(dot);
        uiEls.dashDotsInner.appendChild(wrap);
      });
    }
  }

  // کلیک روی یک دات ساعتی: پنل داشبورد زمان را باز (اگر بسته است) یا رفرش می‌کند و
  // کارتِ همان رویداد را در تایم‌لاین با یک چشمک کوتاه پررنگ می‌کند
  function openDashEventFromDot(evt) {
    if (!uiEls.dashPanel) return;
    if (!uiEls.dashPanel.classList.contains('active')) {
      uiEls.dashToggle.click();
    } else {
      refreshDashUI();
    }
    requestAnimationFrame(() => {
      const card = uiEls.timelineContent && uiEls.timelineContent.querySelector(`[data-event-id="${evt.id}"]`);
      if (card) {
        card.scrollIntoView({ block: 'nearest' });
        card.classList.add('ai-event-flash');
        setTimeout(() => card.classList.remove('ai-event-flash'), 1400);
      }
    });
  }

  function updateNowLine() {
    if (!uiEls.nowLine || !uiEls.timelineContainer) return;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const percentOfDay = (now - startOfDay) / 86400000;
    const trackHeight = uiEls.timelineContainer.scrollHeight || uiEls.timelineContainer.clientHeight || 0;
    uiEls.nowLine.style.top = `${Math.max(0, Math.min(1, percentOfDay)) * trackHeight}px`;
    if (uiEls.nowLabel) uiEls.nowLabel.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  // نزدیک‌ترین رویدادِ آیندهٔ ثبت‌نشده‌به‌عنوان‌انجام‌شده — هم برای ویجت «بعدی» در
  // داشبورد استفاده می‌شود، هم برای نوتیفیکیشنِ هاوِر روی خودِ افزونه (پایین‌تر).
  function getNearestUpcomingEvent() {
    const now = new Date();
    return (timeEventsData || [])
      .filter(e => e.status !== 'done')
      .map(e => ({ e, t: new Date(`${e.date}T${e.startTime}:00`) }))
      .filter(x => !isNaN(x.t.getTime()) && x.t >= now)
      .sort((a, b) => a.t - b.t)[0];
  }

  function updateNextEventWidget() {
    const widget = uiEls.nextEventWidget; if (!widget) return;
    const upcoming = getNearestUpcomingEvent();
    if (!upcoming) { widget.style.display = 'none'; widget.textContent = ''; return; }
    widget.textContent = `${t('dashNextLabel')}: ${upcoming.e.title} · ${upcoming.e.startTime}`;
    widget.style.display = '';
  }

  // --- نوتیفیکیشنِ هاورِ روی افزونه: وقتی موس ~۳ ثانیه بدون حرکت روی هاب (در حالت
  // جمع‌شده) می‌ماند، نزدیک‌ترین رویدادِ آینده را به‌صورت toast نشان می‌دهد؛ بدون باز
  // کردنِ ویجت و بدون تکرار تا وقتی موس یک‌بار خارج و دوباره وارد شود. ---
  function formatNearestEventWhen(evt) {
    const fa = currentLang === 'fa';
    const ar = currentLang === 'ar';
    if (evt.date === todayDashIso()) {
      return fa ? `امروز ${evt.startTime}` : ar ? `اليوم ${evt.startTime}` : `Today ${evt.startTime}`;
    }
    const [gy, gm, gd] = evt.date.split('-').map(Number);
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const diffDays = Math.round((new Date(gy, gm - 1, gd) - startOfToday) / 86400000);
    const dayLabel = fa ? `${toPersianDigits(diffDays)} روز دیگر` : ar ? `بعد ${toArabicDigits(diffDays)} يوم` : `in ${diffDays}d`;
    return `${dayLabel} · ${evt.startTime}`;
  }
  function showNearestEventHoverToast() {
    const upcoming = getNearestUpcomingEvent();
    if (!upcoming) return;
    showToastNotification(`${t('dashNextLabel')}: ${upcoming.e.title} · ${formatNearestEventWhen(upcoming.e)}`);
  }
  let hubNearestEventTimer = null;
  let hubNearestEventShownThisHover = false;
  function scheduleHubNearestEventPeek() {
    if (hubNearestEventShownThisHover || isDragging) return;
    clearTimeout(hubNearestEventTimer);
    hubNearestEventTimer = setTimeout(() => {
      if (!hub.classList.contains('hub-collapsed') || isDragging) return;
      hubNearestEventShownThisHover = true;
      showNearestEventHoverToast();
    }, 3000);
  }
  function cancelHubNearestEventPeek() {
    clearTimeout(hubNearestEventTimer);
    hubNearestEventShownThisHover = false;
  }
  hub.addEventListener('mouseenter', () => {
    if (hub.classList.contains('hub-collapsed')) scheduleHubNearestEventPeek();
  });
  hub.addEventListener('mouseleave', cancelHubNearestEventPeek);
  hub.addEventListener('mousedown', cancelHubNearestEventPeek);

  // ---------- «افق آسمانی» — نوارِ لغزشیِ بصریِ انتخاب ساعت (جایگزین input زمان) ----------
  function initializeTimeScrubber(containerEl, defaultHours, defaultMinutes) {
    const track = containerEl.querySelector('.ai-scrubber-track');
    const thumb = containerEl.querySelector('.ai-scrubber-thumb');
    const progress = containerEl.querySelector('.ai-scrubber-progress');
    const timeInput = containerEl.querySelector('.ai-scrubber-time-input');
    const hintDisplay = containerEl.querySelector('.ai-scrubber-hint');
    const tomorrowBadge = containerEl.querySelector('.ai-scrubber-tomorrow-badge');
    const rootStyle = containerEl.style;

    let currentMinutes = (defaultHours * 60) + defaultMinutes; // 0 تا 1440
    let isDragging = false;

    function updateVisuals() {
      const percent = Math.max(0, Math.min(100, (currentMinutes / 1440) * 100));
      thumb.style.left = `${percent}%`;
      progress.style.width = `${percent}%`;
      const hrs = Math.floor(currentMinutes / 60);
      const mins = currentMinutes % 60;
      // وقتی خودِ کاربر داره توی این ورودی تایپ می‌کنه، مقدارش رو بازنویسی نکن —
      // وگرنه هر رویداد input وسطِ تایپ‌کردن، امتیازِ کرسر رو به‌هم می‌ریزه.
      if (document.activeElement !== timeInput) timeInput.value = `${pad2(hrs)}:${pad2(mins)}`;

      let icon = '🌙', hintKey = 'scrubberNight', color = '#818CF8', glow = 'rgba(129, 140, 248, 0.5)';
      if (hrs >= 5 && hrs < 9) { icon = '🌅'; hintKey = 'scrubberDawn'; color = '#FDE68A'; glow = 'rgba(253, 230, 138, 0.4)'; }
      else if (hrs >= 9 && hrs < 16) { icon = '☀️'; hintKey = 'scrubberDay'; color = '#38BDF8'; glow = 'rgba(56, 189, 248, 0.4)'; }
      else if (hrs >= 16 && hrs < 19) { icon = '🌇'; hintKey = 'scrubberDusk'; color = '#F59E0B'; glow = 'rgba(245, 158, 11, 0.4)'; }
      else if (hrs >= 19 && hrs <= 23) { icon = '✨'; hintKey = 'scrubberEvening'; color = '#C4B5FD'; glow = 'rgba(196, 181, 253, 0.4)'; }

      thumb.textContent = icon;
      hintDisplay.textContent = t(hintKey);
      rootStyle.setProperty('--scrubber-color', color);
      rootStyle.setProperty('--scrubber-glow', glow);

      // اگر ساعتِ انتخاب‌شده از الان گذشته، این رویداد برای «فردا» ثبت خواهد شد —
      // نه امروزِ گذشته — پس همین‌جا هم صادقانه نشانش می‌دهیم، پیش از ذخیره.
      if (tomorrowBadge) {
        const willBeTomorrow = isScheduledForTomorrow(`${pad2(hrs)}:${pad2(mins)}`);
        tomorrowBadge.textContent = willBeTomorrow ? t('scrubberTomorrowBadge') : '';
        tomorrowBadge.classList.toggle('visible', willBeTomorrow);
      }
    }

    function handleDrag(clientX) {
      const rect = track.getBoundingClientRect();
      let x = clientX - rect.left;
      x = Math.max(0, Math.min(x, rect.width));
      const percent = x / rect.width;
      let rawMinutes = percent * 1440;
      currentMinutes = Math.round(rawMinutes / 15) * 15; // اسنپ به بازه‌های ۱۵ دقیقه‌ای
      if (currentMinutes >= 1440) currentMinutes = 1439;
      updateVisuals();
    }

    function onPointerDown(e) { e.stopPropagation(); isDragging = true; handleDrag(e.touches ? e.touches[0].clientX : e.clientX); }
    function onPointerMove(e) { if (!isDragging) return; handleDrag(e.touches ? e.touches[0].clientX : e.clientX); }
    function onPointerUp() { isDragging = false; }

    track.addEventListener('mousedown', onPointerDown);
    track.addEventListener('touchstart', onPointerDown, { passive: true });
    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('touchmove', onPointerMove, { passive: true });
    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('touchend', onPointerUp);

    // همگام‌سازیِ دوطرفه: تایپِ مستقیمِ ساعت هم اسلایدر و هم رنگ/آیکون را به‌روز می‌کند
    function onTimeInputChange(e) {
      e.stopPropagation();
      const val = e.target.value; if (!val) return;
      const [h, m] = val.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) { currentMinutes = Math.max(0, Math.min(1439, h * 60 + m)); updateVisuals(); }
    }
    timeInput.addEventListener('input', onTimeInputChange);
    timeInput.addEventListener('change', onTimeInputChange);
    timeInput.addEventListener('mousedown', (e) => e.stopPropagation());
    timeInput.addEventListener('click', (e) => e.stopPropagation());

    updateVisuals();
    return {
      getValue: () => `${pad2(Math.floor(currentMinutes / 60))}:${pad2(currentMinutes % 60)}`,
      destroy: () => {
        document.removeEventListener('mousemove', onPointerMove); document.removeEventListener('touchmove', onPointerMove);
        document.removeEventListener('mouseup', onPointerUp); document.removeEventListener('touchend', onPointerUp);
      }
    };
  }
  function buildTimeScrubberEl() {
    const wrap = document.createElement('div'); wrap.className = 'ai-horizon-scrubber';
    const readout = document.createElement('div'); readout.className = 'ai-scrubber-readout';
    // input بومیِ ساعت به‌جای متنِ ثابت — کاربر می‌تونه هم تایپ کنه هم بکشه؛ ظاهرش
    // با CSS دقیقاً مثل همون متنِ درخشانِ قبلی استایل شده (بدون ظاهرِ پیش‌فرضِ مرورگر).
    const timeInput = document.createElement('input');
    timeInput.type = 'time'; timeInput.className = 'ai-scrubber-time-input'; timeInput.required = true;
    const hintSpan = document.createElement('span'); hintSpan.className = 'ai-scrubber-hint';
    const tomorrowBadge = document.createElement('span'); tomorrowBadge.className = 'ai-scrubber-tomorrow-badge';
    readout.appendChild(timeInput); readout.appendChild(hintSpan); readout.appendChild(tomorrowBadge);
    const track = document.createElement('div'); track.className = 'ai-scrubber-track';
    const progress = document.createElement('div'); progress.className = 'ai-scrubber-progress';
    const thumb = document.createElement('div'); thumb.className = 'ai-scrubber-thumb'; thumb.textContent = '☀️';
    const markDawn = document.createElement('div'); markDawn.className = 'ai-scrubber-mark mark-dawn';
    const markNoon = document.createElement('div'); markNoon.className = 'ai-scrubber-mark mark-noon';
    const markDusk = document.createElement('div'); markDusk.className = 'ai-scrubber-mark mark-dusk';
    track.append(progress, thumb, markDawn, markNoon, markDusk);
    wrap.append(readout, track);
    return wrap;
  }

  function closeDashQuickAdd() {
    if (uiEls.dashPanel) {
      const pop = uiEls.dashPanel.querySelector('.ai-time-quickadd-popover');
      if (pop) { if (pop._scrubber) pop._scrubber.destroy(); pop.remove(); }
      uiEls.dashPanel.classList.remove('quickadd-open');
      if (typeof positionDashPanelSide === 'function') positionDashPanelSide();
    }
  }

  function openDashQuickAdd() {
    if (!uiEls.dashPanel || !uiEls.timelineContainer) return;
    closeDashQuickAdd();
    uiEls.dashPanel.classList.add('quickadd-open'); // جای کافی برای عنوان + نشانگر ساعت + دکمه‌ها باز می‌کند
    const now = new Date();
    const popover = document.createElement('div'); popover.className = 'ai-time-quickadd-popover';
    const header = document.createElement('div'); header.className = 'ai-popover-header'; header.textContent = t('dashNewEventTitle');
    const titleRow = document.createElement('div'); titleRow.className = 'ai-quickadd-title-row';
    const titleInput = document.createElement('input'); titleInput.type = 'text'; titleInput.id = 'ai-quick-evt-title'; titleInput.placeholder = t('dashEventTitlePlaceholder'); titleInput.dir = 'auto';
    // ستارهٔ طلایی: علامت‌گذاریِ رویداد به‌عنوان «تکرارشونده» — برخلاف رویدادهای معمولی
    // که بعد از یک روز خودکار حذف می‌شوند، این‌ها هر روز به‌جای حذف، برای همان روز
    // تازه می‌شوند (وضعیت/تیک ریست می‌شود) — دقیقاً برای مواردی مثل یادآور دارو.
    const recurToggle = document.createElement('button');
    recurToggle.type = 'button'; recurToggle.className = 'ai-quickadd-recur-toggle';
    recurToggle.title = t('dashRecurringToggle'); recurToggle.textContent = '★';
    recurToggle.addEventListener('click', (e) => { e.stopPropagation(); recurToggle.classList.toggle('active'); });
    titleRow.appendChild(titleInput); titleRow.appendChild(recurToggle);
    const scrubberEl = buildTimeScrubberEl();

    const btnRow = document.createElement('div'); btnRow.className = 'ai-popover-btn-row';
    const saveBtn = document.createElement('button'); saveBtn.type = 'button'; saveBtn.id = 'ai-quick-evt-save'; saveBtn.textContent = t('dashSaveEnter');
    const cancelBtn = document.createElement('button'); cancelBtn.type = 'button'; cancelBtn.className = 'ai-popover-cancel'; cancelBtn.textContent = t('formCancelBtn');
    btnRow.appendChild(saveBtn); btnRow.appendChild(cancelBtn);
    popover.appendChild(header); popover.appendChild(titleRow); popover.appendChild(scrubberEl); popover.appendChild(btnRow);
    uiEls.dashPanel.appendChild(popover);
    popover.addEventListener('mousedown', (e) => e.stopPropagation());
    popover.addEventListener('click', (e) => e.stopPropagation());
    if (typeof positionDashPanelSide === 'function') positionDashPanelSide(); // پنل بزرگ‌تر شد، دوباره کلمپ کن تا از صفحه بیرون نزند

    const scrubber = initializeTimeScrubber(scrubberEl, now.getHours(), now.getMinutes());
    popover._scrubber = scrubber;

    function commitSave() {
      const title = titleInput.value.trim(); if (!title) { titleInput.focus(); return; }
      const startTime = scrubber.getValue();
      const evt = {
        id: newLinkId('evt'), title, date: resolveScheduledDashDate(startTime), startTime,
        endTime: null, status: 'future', linkedTodoId: null, recurring: recurToggle.classList.contains('active')
      };
      saveDashEvent(evt); closeDashQuickAdd();
    }
    saveBtn.addEventListener('click', commitSave);
    cancelBtn.addEventListener('click', closeDashQuickAdd);
    titleInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') commitSave(); else if (e.key === 'Escape') closeDashQuickAdd(); });
    titleInput.focus();
  }

  // موقعیت‌دهیِ پنل داشبورد — دقیقاً همان منطق هوشمندِ پنل مناسبت‌ها (سمتی که جا دارد)
  function positionDashPanelSide() {
    if (!uiEls.dashPanel || !uiEls.dashPanel.classList.contains('active')) return;
    const rect = clockPanel.getBoundingClientRect();
    const panelW = (uiEls.dashPanel.offsetWidth || 300) + 36;
    const vw = window.innerWidth; const vh = window.innerHeight;
    const spaceRight = vw - rect.right; const spaceLeft = rect.left;
    const clockCenterX = rect.left + rect.width / 2;
    let openLeft;
    if (clockCenterX < vw / 2) { openLeft = false; if (spaceRight < panelW && spaceLeft >= panelW) openLeft = true; }
    else { openLeft = true; if (spaceLeft < panelW && spaceRight >= panelW) openLeft = false; }
    uiEls.dashPanel.classList.toggle('side-left', openLeft);
    clockPanel.classList.toggle('dash-open-left', openLeft);
    const margin = 10; const panelH = uiEls.dashPanel.offsetHeight || 300; let topOffset = 0;
    if (rect.top + panelH > vh - margin) topOffset = (vh - margin) - panelH - rect.top;
    if (rect.top + topOffset < margin) topOffset = margin - rect.top;
    uiEls.dashPanel.style.top = `${topOffset}px`;
    updateNowLine();
  }
  function syncDashToggleRestSide() {
    if (!uiEls.dashPanel) return;
    if (uiEls.dashPanel.classList.contains('active')) { positionDashPanelSide(); return; }
    const rect = clockPanel.getBoundingClientRect(); const vw = window.innerWidth;
    const openLeft = (rect.left + rect.width / 2) >= vw / 2;
    clockPanel.classList.toggle('dash-open-left', openLeft);
  }

  function closeMarksPanelOnly() {
    if (!uiEls.markPanel || !uiEls.markPanel.classList.contains('active')) return;
    closeDualPicker();
    uiEls.markPanel.classList.remove('active', 'side-left');
    uiEls.markToggle.classList.remove('is-open');
    uiEls.markToggle.setAttribute('aria-expanded', 'false');
    if (uiEls.dashToggle) uiEls.dashToggle.classList.remove('is-dimmed');
    syncMarksToggleRestSide();
  }
  function closeDashPanelOnly() {
    if (!uiEls.dashPanel || !uiEls.dashPanel.classList.contains('active')) return;
    closeDashQuickAdd();
    uiEls.dashPanel.classList.remove('active', 'side-left');
    uiEls.dashToggle.classList.remove('is-open');
    uiEls.dashToggle.setAttribute('aria-expanded', 'false');
    if (uiEls.markToggle) uiEls.markToggle.classList.remove('is-dimmed');
    syncDashToggleRestSide();
  }

  uiEls.markToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = !uiEls.markPanel.classList.contains('active');
    if (willOpen) closeDashPanelOnly(); // فقط یکی از دو پنل کناری هم‌زمان باز باشد
    if (willOpen) renderMarkedDays(); // ردیف تولدها و فهرست مناسبت‌ها هنگام بازشدن تازه‌سازی شوند
    uiEls.markPanel.classList.toggle('active');
    const isOpen = uiEls.markPanel.classList.contains('active');
    uiEls.markToggle.classList.toggle('is-open', isOpen);
    uiEls.markToggle.setAttribute('aria-expanded', String(isOpen));
    if (uiEls.dashToggle) uiEls.dashToggle.classList.toggle('is-dimmed', isOpen);
    if (!isOpen) {
      closeDualPicker();
      uiEls.markPanel.classList.remove('side-left');
      syncMarksToggleRestSide();
    } else {
      positionMarksPanelSide();
    }
  });

  if (uiEls.birthdayList) {
    uiEls.birthdayList.addEventListener('wheel', (e) => {
      const list = uiEls.birthdayList;
      if (list.scrollWidth <= list.clientWidth) return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!delta) return;
      e.preventDefault();
      list.scrollLeft += delta;
    }, { passive: false });
  }

  if (uiEls.dashToggle) {
    uiEls.dashToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !uiEls.dashPanel.classList.contains('active');
      if (willOpen) closeMarksPanelOnly(); // فقط یکی از دو پنل کناری هم‌زمان باز باشد
      closeDashQuickAdd();
      uiEls.dashPanel.classList.toggle('active');
      const isOpen = uiEls.dashPanel.classList.contains('active');
      uiEls.dashToggle.classList.toggle('is-open', isOpen);
      uiEls.dashToggle.setAttribute('aria-expanded', String(isOpen));
      uiEls.markToggle.classList.toggle('is-dimmed', isOpen);
      if (!isOpen) {
        uiEls.dashPanel.classList.remove('side-left');
        syncDashToggleRestSide();
      } else {
        refreshDashUI();
        positionDashPanelSide();
      }
    });
  }
  if (uiEls.dashAddBtn) {
    uiEls.dashAddBtn.addEventListener('click', (e) => { e.stopPropagation(); openDashQuickAdd(); });
  }

  if (uiEls.markEventTab) {
    uiEls.markEventTab.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMarkEventSheet();
    });
  }

  // --- Smart Dual-Calendar: single omni-input + NLP + dual grid picker ---
  let smartDateISO = ''; // hidden canonical YYYY-MM-DD (Gregorian)
  let dualViewYear = null, dualViewMonth = null; // 1-based month of currently shown Gregorian month
  let dualPickerOpen = false;
  // کدام روز (iso) در حال حاضر بنر رویدادش باز است — برای رفتار دوکاره‌ی کلیک:
  // کلیک اول باز می‌کند، کلیک دوم روی همان روز می‌بندد.
  let dayEventSheetOpenIso = null;
  // آبجکت کامل رویداد فعلاً بازشده در برگه کاغذی — صرف‌نظر از این‌که از کجا باز شده
  // (سلول گرید، دات‌های بالای ساعت، یا لیست رویدادها)، تا updateUITexts بتواند بدون
  // نیاز به تطبیق دوبارهٔ iso، مستقیماً همان رویداد را با زبان جدید بازرسم کند.
  let currentOpenMarkEvent = null;

  function toAsciiDigits(str) {
    return String(str).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
              .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  }
  // toPersianDigits / toArabicDigits / isRTL / localizeDigits now live in
  // i18n.js (single shared source — it loads before this file), so calls
  // below just fall through to those global definitions.

  function isoFromYMD(y, m, d) {
    return `${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  function formatDisplayFromISO(iso, preferJalali) {
    if (!iso) return '';
    const [gy, gm, gd] = iso.split('-').map(Number);
    if (preferJalali) {
      const j = gregorianToJalaali(gy, gm, gd);
      const text = `${j.jy}/${String(j.jm).padStart(2,'0')}/${String(j.jd).padStart(2,'0')}`;
      return localizeDigits(text);
    }
    return iso;
  }
  function setSmartDate(iso, silent) {
    smartDateISO = iso || '';
    if (!uiEls.smartDateInput) return;
    if (!iso) { uiEls.smartDateInput.value = ''; uiEls.smartDateInput.classList.remove('invalid'); return; }
    const preferJalali = currentLang === 'fa';
    uiEls.smartDateInput.value = formatDisplayFromISO(iso, preferJalali);
    uiEls.smartDateInput.classList.remove('invalid');
    if (!silent && dualPickerOpen) renderDualGrid();
  }

  function parseSmartDateInput(raw) {
    const trimmed = (raw || '').trim();
    if (!trimmed) return { ok: false, empty: true };

    const lower = toAsciiDigits(trimmed).toLowerCase().replace(/\s+/g, ' ');

    const todayWords = ['today', 'امروز', 'hoy', 'heute', "aujourd'hui", 'aujourdhui', '今日', 'اليوم'];
    const tomorrowWords = ['tomorrow', 'فردا', 'mañana', 'manana', 'morgen', 'demain', '明日', 'غدا', 'غدًا'];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (todayWords.some(w => lower === w || lower === toAsciiDigits(w))) {
      return { ok: true, iso: isoFromYMD(today.getFullYear(), today.getMonth()+1, today.getDate()), nlp: 'today', source: currentLang === 'fa' ? 'jalali' : 'gregorian' };
    }
    if (tomorrowWords.some(w => lower === w || lower === toAsciiDigits(w))) {
      const tmr = new Date(today); tmr.setDate(tmr.getDate() + 1);
      return { ok: true, iso: isoFromYMD(tmr.getFullYear(), tmr.getMonth()+1, tmr.getDate()), nlp: 'tomorrow', source: currentLang === 'fa' ? 'jalali' : 'gregorian' };
    }

    let cleaned = toAsciiDigits(trimmed).replace(/[.\-]/g, '/').replace(/[^\d/]/g, '');
    const parts = cleaned.split('/').filter(Boolean).map(p => parseInt(p, 10));

    function isJalaliYear(y) { const s = String(y); return s.startsWith('13') || s.startsWith('14') || (y >= 1300 && y <= 1499); }
    function isGregYear(y) { const s = String(y); return s.startsWith('19') || s.startsWith('20') || y >= 1900; }

    // Resolve Y, M, D from flexible order: YYYY/MM/DD or DD/MM/YYYY (common in Iran)
    let y, m, d, source = null;
    if (parts.length === 3) {
      const [a, b, c] = parts;
      if (isJalaliYear(a) || isGregYear(a)) {
        // YYYY/MM/DD
        y = a; m = b; d = c;
        source = isJalaliYear(a) ? 'jalali' : 'gregorian';
      } else if (isJalaliYear(c) || isGregYear(c)) {
        // DD/MM/YYYY  (Iranian everyday form: 11/5/1405)
        d = a; m = b; y = c;
        source = isJalaliYear(c) ? 'jalali' : 'gregorian';
      } else if (a < 100 && c <= 31) {
        // short year first? rare — treat as YY/MM/DD
        y = currentLang === 'fa' ? (1400 + a) : (2000 + a);
        m = b; d = c;
        source = currentLang === 'fa' ? 'jalali' : 'gregorian';
      } else if (c < 100) {
        // DD/MM/YY
        d = a; m = b; y = currentLang === 'fa' ? (1400 + c) : (2000 + c);
        source = currentLang === 'fa' ? 'jalali' : 'gregorian';
      } else {
        return { ok: false };
      }
      if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return { ok: false };

      if (source === 'jalali') {
        try {
          const g = jalaaliToGregorian(y, m, d);
          if (!g || !g.gy) return { ok: false };
          return { ok: true, iso: isoFromYMD(g.gy, g.gm, g.gd), source: 'jalali', jy: y, jm: m, jd: d };
        } catch (e) { return { ok: false }; }
      }
      try {
        const j = gregorianToJalaali(y, m, d);
        if (!j) return { ok: false };
        return { ok: true, iso: isoFromYMD(y, m, d), source: 'gregorian', jy: j.jy, jm: j.jm, jd: j.jd };
      } catch (e) { return { ok: false }; }
    }

    // Compact 8-digit: always YYYYMMDD
    const digitsOnly = toAsciiDigits(trimmed).replace(/\D/g, '');
    if (digitsOnly.length === 8) {
      y = parseInt(digitsOnly.slice(0,4),10); m = parseInt(digitsOnly.slice(4,6),10); d = parseInt(digitsOnly.slice(6,8),10);
      if (m < 1 || m > 12 || d < 1 || d > 31) return { ok: false };
      if (isJalaliYear(y)) {
        try {
          const g = jalaaliToGregorian(y, m, d);
          return { ok: true, iso: isoFromYMD(g.gy, g.gm, g.gd), source: 'jalali', jy: y, jm: m, jd: d };
        } catch (e) { return { ok: false }; }
      }
      const j = gregorianToJalaali(y, m, d);
      return { ok: true, iso: isoFromYMD(y, m, d), source: 'gregorian', jy: j.jy, jm: j.jm, jd: j.jd };
    }

    return { ok: false };
  }

  let smartDateMeta = null; // { source, jy, jm, jd } from last successful parse

  function applySmartDateFromInput() {
    const raw = uiEls.smartDateInput.value;
    const result = parseSmartDateInput(raw);
    if (result.empty) { smartDateISO = ''; smartDateMeta = null; uiEls.smartDateInput.classList.remove('invalid'); return; }
    if (result.ok) {
      smartDateMeta = { source: result.source, jy: result.jy, jm: result.jm, jd: result.jd };
      setSmartDate(result.iso);
    } else if (raw.trim().length >= 6) {
      uiEls.smartDateInput.classList.add('invalid');
    } else {
      uiEls.smartDateInput.classList.remove('invalid');
    }
  }

  uiEls.smartDateInput.addEventListener('input', () => {
    applySmartDateFromInput();
  });
  uiEls.smartDateInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); applySmartDateFromInput(); closeDualPicker(); }
    if (e.key === 'Escape') { e.preventDefault(); closeDualPicker(); }
  });
  uiEls.smartDateInput.addEventListener('blur', () => {
    if (smartDateISO) setSmartDate(smartDateISO);
  });

  const JALALI_MONTHS_FA = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  // اسلاگ لاتین همان ترتیب بالا — فقط برای مقدار attribute رنگ‌بندیِ ماهانه (data-cal-month)
  const JALALI_MONTH_KEYS = ['farvardin','ordibehesht','khordad','tir','mordad','shahrivar','mehr','aban','azar','dey','bahman','esfand'];
  function calMonthKeyFromJalali(jm) { return JALALI_MONTH_KEYS[jm - 1] || ''; }
  // نام‌های نمایشیِ ماه‌های میلادی — همیشه نام استاندارد واقعیِ میلادی (بر پایهٔ
  // زبان رابط کاربری)، دیگر منطقه‌محور نیست و نام‌های قدیمیِ اوستایی/پارسی
  // حذف شده‌اند؛ چون این ماه میلادی همیشه در کنار معادل شمسی و قمری هم نمایش
  // داده می‌شود (تولتیپ روز و عنوان تقویم)، خودِ سه‌تقویمی‌بودن آن نمایشِ
  // «ملموس» و آشنایی است که قرار بود آن نام‌های تزئینی جایگزینش کنند.
  // فقط لایهٔ نمایش است — ایندکس‌گذاری (m-1) و محاسبهٔ تاریخ دست‌نخورده می‌ماند.
  const GREG_MONTHS_STD_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const GREG_MONTHS_STD_FA = ['ژانویه','فوریه','مارس','آوریل','مه','ژوئن','ژوئیه','اوت','سپتامبر','اکتبر','نوامبر','دسامبر'];
  const GREG_MONTHS_STD_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const GREG_MONTHS_STD_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  const GREG_MONTHS_STD_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const GREG_MONTHS_STD_JA = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  const GREG_MONTHS_STD_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const GREG_MONTHS_STD_RU = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
  const GREG_MONTHS_STD_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const GREG_MONTHS_STD_ZHHANS = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
  const GREG_MONTHS_STD_ZHHANT = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
  const GREG_MONTHS_STD_PTBR = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  function getDisplayGregorianMonth(mIndex) {
    return currentLang === 'fa' ? GREG_MONTHS_STD_FA[mIndex] : currentLang === 'ar' ? GREG_MONTHS_STD_AR[mIndex] : currentLang === 'es' ? GREG_MONTHS_STD_ES[mIndex] : currentLang === 'de' ? GREG_MONTHS_STD_DE[mIndex] : currentLang === 'fr' ? GREG_MONTHS_STD_FR[mIndex] : currentLang === 'ja' ? GREG_MONTHS_STD_JA[mIndex] : currentLang === 'ru' ? GREG_MONTHS_STD_RU[mIndex] : currentLang === 'tr' ? GREG_MONTHS_STD_TR[mIndex] : currentLang === 'zh-Hans' ? GREG_MONTHS_STD_ZHHANS[mIndex] : currentLang === 'zh-Hant' ? GREG_MONTHS_STD_ZHHANT[mIndex] : currentLang === 'pt-BR' ? GREG_MONTHS_STD_PTBR[mIndex] : GREG_MONTHS_STD_EN[mIndex];
  }
  const HIJRI_MONTHS_FA = ['محرم','صفر','ربیع‌الاول','ربیع‌الثانی','جمادی‌الاول','جمادی‌الثانی','رجب','شعبان','رمضان','شوال','ذوالقعده','ذوالحجه'];
  const HIJRI_MONTHS_AR = ['محرم','صفر','ربيع الأول','ربيع الآخر','جمادى الأولى','جمادى الآخرة','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'];
  const HIJRI_MONTHS_EN = ['Muharram','Safar',"Rabi' al-awwal","Rabi' al-thani",'Jumada al-awwal','Jumada al-thani','Rajab',"Sha'ban",'Ramadan','Shawwal',"Dhu al-Qi'dah",'Dhu al-Hijjah'];
  const HIJRI_MONTHS_ES = ['muharram','safar',"rabi al-awwal","rabi al-zani",'yumada al-ula','yumada al-zania','rayab',"shaaban",'ramadán','shawwal',"du al-qada",'du al-hiyya'];
  const HIJRI_MONTHS_DE = ['Muharram','Safar',"Rabi al-awwal","Rabi al-thani",'Dschumada al-ula','Dschumada al-thania','Radschab',"Schaban",'Ramadan','Schawwal',"Dhu l-Qada",'Dhu l-Hiddscha'];
  const HIJRI_MONTHS_FR = ['mouharram','safar',"rabi al-awwal","rabi al-thani",'joumada al-oula','joumada al-thania','rajab',"chaabane",'ramadan','chawwal',"dhou al-qi'da",'dhou al-hijja'];
  const HIJRI_MONTHS_JA = ['ムハッラム','サファル','ラビー・ウル・アウワル','ラビー・ウッサーニー','ジュマーダ・ル・ウーラー','ジュマーダ・ッサーニヤ','ラジャブ','シャアバーン','ラマダーン','シャウワール','ズー・ル・カアダ','ズー・ル・ヒッジャ'];
  const HIJRI_MONTHS_RU = ['мухаррам','сафар','раби аль-авваль','раби ас-сани','джумада аль-авваль','джумада ас-сани','раджаб','шаабан','рамадан','шавваль','зуль-када','зуль-хиджа'];
  const HIJRI_MONTHS_TR = ['Muharrem','Safer',"Rebîülevvel","Rebîülâhir",'Cemâziyelevvel','Cemâziyelâhir','Recep',"Şaban",'Ramazan','Şevval',"Zilkade",'Zilhicce'];
  const HIJRI_MONTHS_ZHHANS = ['穆哈兰姆月','色法尔月','赖比尔·敖外鲁月','赖比尔·阿色尼月','主马达·敖外鲁月','主马达·阿色尼月','赖哲卜月','舍尔邦月','莱麦丹月','闪瓦鲁月','都尔喀尔德月','都尔黑哲月'];
  const HIJRI_MONTHS_ZHHANT = ['穆哈蘭姆月','色法爾月','賴比爾·敖外魯月','賴比爾·阿色尼月','主馬達·敖外魯月','主馬達·阿色尼月','賴哲卜月','捨爾邦月','萊麥丹月','閃瓦魯月','都爾喀爾德月','都爾黑哲月'];
  const HIJRI_MONTHS_PTBR = ['Muharram','Safar',"Rabi al-Awwal","Rabi al-Thani",'Jumada al-Awwal','Jumada al-Thani','Rajab',"Sha'ban",'Ramadã','Shawwal',"Dhu al-Qi'dah",'Dhu al-Hijjah'];
  const WEEKDAYS_FA = ['ش','ی','د','س','چ','پ','ج'];
  const WEEKDAYS_EN = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  function daysInGregorianMonth(y, m) { return new Date(y, m, 0).getDate(); }

  function closeDualPicker() {
    dualPickerOpen = false;
    if (uiEls.dualPicker) { uiEls.dualPicker.hidden = true; uiEls.dualPicker.style.display = 'none'; }
    if (uiEls.markPanel) uiEls.markPanel.classList.remove('picker-open');
    // بستن تقویم (چه با کلیک بیرون، چه Esc، چه انتخاب روز، چه بستن کل پنل ساعت)
    // باید بنر نمایش رویداد را هم ببندد، تا بعد از تقویم روی صفحه باقی نماند.
    if (typeof closeMarkEventSheet === 'function') closeMarkEventSheet();
    if (uiEls.markPanel && uiEls.markPanel.classList.contains('active')) positionMarksPanelSide();
  }
  function openDualPicker() {
    const base = smartDateISO ? new Date(smartDateISO + 'T12:00:00') : new Date();
    dualViewYear = base.getFullYear();
    dualViewMonth = base.getMonth() + 1;
    dualPickerOpen = true;
    uiEls.dualPicker.hidden = false;
    uiEls.dualPicker.style.display = 'block';
    if (uiEls.markPanel) uiEls.markPanel.classList.add('picker-open');
    renderDualGrid();
    positionMarksPanelSide(); // the grid adds significant height — re-clamp so it doesn't run off-screen
  }

  function renderDualGrid() {
    if (!uiEls.dualGrid || dualViewYear == null) return;
    const preferJalali = currentLang === 'fa';
    const y = dualViewYear, m = dualViewMonth;
    const first = new Date(y, m - 1, 1);
    const startDow = first.getDay();
    const offset = preferJalali ? (startDow + 1) % 7 : startDow;
    const totalDays = daysInGregorianMonth(y, m);
    const birthdayMarks = getBirthdayCalendarMarks();

    // رنگ‌بندی تقویم کلی (پاپ‌آپ) بر اساس ماه جلالیِ همان بازهٔ نمایش‌داده‌شده —
    // چون هر گرید یک ماه میلادی است ولی می‌تواند بین دو ماه جلالی مشترک باشد،
    // ماهِ جلالیِ روز میانی (۱۵ام) به‌عنوان هویت رنگی کل گرید در نظر گرفته می‌شود.
    try {
      const midJ = gregorianToJalaali(y, m, Math.min(15, totalDays));
      const gridCalMonthKey = calMonthKeyFromJalali(midJ.jm);
      if (gridCalMonthKey && uiEls.dualPicker) uiEls.dualPicker.dataset.calMonth = gridCalMonthKey;
    } catch (eGridCalMonth) {}

    // One grid = one real (Gregorian) month, always — title just names that month.
    // (Its Jalali equivalent can span two Jalali months, but the grid itself never mixes days
    // from two different months, so the title shouldn't imply that either.)
    const monthLabelStr = getDisplayGregorianMonth(m - 1);
    uiEls.dualMonthLabel.textContent = preferJalali
      ? `${monthLabelStr} ${toPersianDigits(y)}`
      : currentLang === 'ar'
        ? `${monthLabelStr} ${toArabicDigits(y)}`
        : `${monthLabelStr} ${y}`;

    // زیرعنوانِ سه‌تقویمی: چون این گرید همیشه یک ماه میلادیِ کامل است، معادلش در
    // تقویم شمسی و قمری می‌تواند بین دو ماه مشترک باشد — پس به‌جای انتخاب یکی،
    // بازهٔ واقعی («ماه اول–ماه دوم») هر دو تقویم را زیر عنوان اصلی نشان می‌دهیم؛
    // همان درخواستِ دیدنِ هر سه تقویم در عنوان، نه فقط در تولتیپ روز.
    try {
      const jFirst = gregorianToJalaali(y, m, 1);
      const jLast = gregorianToJalaali(y, m, totalDays);
      const hFirst = gregorianToHijriDM(y, m, 1);
      const hLast = gregorianToHijriDM(y, m, totalDays);
      const spanLabel = (namesArr, mStart, mEnd) => {
        if (mStart == null || mEnd == null) return '';
        if (mStart === mEnd) return namesArr[mStart - 1] || '';
        return `${namesArr[mStart - 1] || ''}–${namesArr[mEnd - 1] || ''}`;
      };
      const jalaliSpan = spanLabel(JALALI_MONTHS_FA, jFirst.jm, jLast.jm);
      const hijriNames = currentLang === 'fa' ? HIJRI_MONTHS_FA : currentLang === 'ar' ? HIJRI_MONTHS_AR : currentLang === 'es' ? HIJRI_MONTHS_ES : currentLang === 'de' ? HIJRI_MONTHS_DE : currentLang === 'fr' ? HIJRI_MONTHS_FR : currentLang === 'ja' ? HIJRI_MONTHS_JA : currentLang === 'ru' ? HIJRI_MONTHS_RU : currentLang === 'tr' ? HIJRI_MONTHS_TR : currentLang === 'zh-Hans' ? HIJRI_MONTHS_ZHHANS : currentLang === 'zh-Hant' ? HIJRI_MONTHS_ZHHANT : currentLang === 'pt-BR' ? HIJRI_MONTHS_PTBR : HIJRI_MONTHS_EN;
      const hijriSpan = (hFirst && hLast) ? spanLabel(hijriNames, hFirst.hm, hLast.hm) : '';
      if (uiEls.dualMonthSublabel) {
        const shamsiLabel = currentLang === 'fa' ? 'شمسی' : currentLang === 'ar' ? 'جلالي' : currentLang === 'es' ? 'jalalí' : currentLang === 'de' ? 'Dschalali' : currentLang === 'fr' ? 'jalali' : currentLang === 'ja' ? 'ジャラリ暦' : currentLang === 'ru' ? 'джалали' : currentLang === 'tr' ? 'Celalî' : currentLang === 'zh-Hans' ? '波斯历' : currentLang === 'zh-Hant' ? '波斯曆' : currentLang === 'pt-BR' ? 'persa' : 'Jalali';
        const hijriLabel = currentLang === 'fa' ? 'قمری' : currentLang === 'ar' ? 'هجري' : currentLang === 'es' ? 'hijrí' : currentLang === 'de' ? 'Hidschri' : currentLang === 'fr' ? 'hijri' : currentLang === 'ja' ? 'ヒジュラ暦' : currentLang === 'ru' ? 'хиджра' : currentLang === 'tr' ? 'Hicrî' : currentLang === 'zh-Hans' ? '伊斯兰历' : currentLang === 'zh-Hant' ? '伊斯蘭曆' : currentLang === 'pt-BR' ? 'hégira' : 'Hijri';
        const parts = [];
        if (jalaliSpan) parts.push(`${jalaliSpan} ${shamsiLabel}`);
        if (hijriSpan) parts.push(`${hijriSpan} ${hijriLabel}`);
        uiEls.dualMonthSublabel.textContent = parts.join(' · ');
      }
    } catch (eSpanLabel) {
      if (uiEls.dualMonthSublabel) uiEls.dualMonthSublabel.textContent = '';
    }

    const wd = preferJalali ? WEEKDAYS_FA : WEEKDAYS_EN;
    uiEls.dualWeekdays.innerHTML = wd.map(d => `<span class="ai-dual-wd">${d}</span>`).join('');

    const todayISO = isoFromYMD(new Date().getFullYear(), new Date().getMonth()+1, new Date().getDate());

    // تطبیق یک مناسبت با یک روزِ گرید — بسته به cal آن مناسبت (شمسی/میلادی/قمری)
    function markMatchesGridDay(mk, gd, gm, jd, jm, hijriDM) {
      const isH = mk.cal === 'h' || mk.cal === 'hijri';
      if (isH) return !!hijriDM && mk.day === hijriDM.hd && mk.month === hijriDM.hm;
      const isJ = mk.cal === 'j' || mk.cal === 'jalali';
      if (isJ) return mk.day === jd && mk.month === jm;
      if (mk.isBirthday && mk.month === 2 && mk.day === 29) {
        const isLeapYear = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
        return isLeapYear ? (gm === 2 && gd === 29) : (gm === 3 && gd === 1);
      }
      return mk.day === gd && mk.month === gm;
    }
    function isMarkedDay(gy, gm, gd, jy, jm, jd) {
      const hijriDM = gregorianToHijriDM(gy, gm, gd);
      return markedDays.some(mk => markMatchesGridDay(mk, gd, gm, jd, jm, hijriDM))
        || birthdayMarks.some(mk => markMatchesGridDay(mk, gd, gm, jd, jm, hijriDM));
    }
    function isBirthdayDay(gy, gm, gd, jy, jm, jd) {
      const hijriDM = gregorianToHijriDM(gy, gm, gd);
      return birthdayMarks.some(mk => markMatchesGridDay(mk, gd, gm, jd, jm, hijriDM));
    }
    // فقط تعطیلات رسمیِ آنلاین (شخصی نیست) — برای کادر قرمز مجزا از is-marked
    function isPublicHolidayDay(gy, gm, gd, jy, jm, jd) {
      if (!showPublicHolidays || !publicHolidays.length) return false;
      const hijriDM = gregorianToHijriDM(gy, gm, gd);
      return publicHolidays.some(mk => markMatchesGridDay(mk, gd, gm, jd, jm, hijriDM));
    }
    function marksForDay(gy, gm, gd, jy, jm, jd) {
      const hijriDM = gregorianToHijriDM(gy, gm, gd);
      const birthdays = birthdayMarks.filter(mk => markMatchesGridDay(mk, gd, gm, jd, jm, hijriDM));
      const personal = markedDays.filter(mk => markMatchesGridDay(mk, gd, gm, jd, jm, hijriDM));
      const holidays = (showPublicHolidays ? publicHolidays : []).filter(mk => markMatchesGridDay(mk, gd, gm, jd, jm, hijriDM));
      // تولدها اول می‌آیند تا کلیک روی روز مشترک با مناسبت دیگری، ابتدا تولد را نشان دهد.
      return [...birthdays, ...personal, ...holidays].map(m => ({ ...m, days: daysUntilNext(m.day, m.month, m.cal) }));
    }

    let html = '';
    for (let i = 0; i < offset; i++) html += '<div class="day-cell empty"></div>';
    // هفت‌پیکر نظامی: هر روز هفته به یکی از هفت گنبد/رنگ آن نسبت داده می‌شود —
    // فقط برای بج رنگی روز در تولتیپ (گرافیک متمایز)، مستقل از رنگ خودِ سلول روز.
    const HAFT_PEYKAR_KEY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']; // index = Date.getDay()
    const WEEKDAY_FULL_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
    const WEEKDAY_FULL_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const WEEKDAY_FULL_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const WEEKDAY_FULL_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const WEEKDAY_FULL_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const WEEKDAY_FULL_JA = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
    const WEEKDAY_FULL_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const WEEKDAY_FULL_RU = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    const WEEKDAY_FULL_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const WEEKDAY_FULL_ZHHANS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const WEEKDAY_FULL_ZHHANT = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const WEEKDAY_FULL_PTBR = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    function dayHoverTip(gy, gm, gd) {
      const wdIdx = new Date(gy, gm - 1, gd).getDay();
      const weekdayKey = HAFT_PEYKAR_KEY[wdIdx];
      const weekdayLine = currentLang === 'fa' ? WEEKDAY_FULL_FA[wdIdx] : currentLang === 'ar' ? WEEKDAY_FULL_AR[wdIdx] : currentLang === 'es' ? WEEKDAY_FULL_ES[wdIdx] : currentLang === 'de' ? WEEKDAY_FULL_DE[wdIdx] : currentLang === 'fr' ? WEEKDAY_FULL_FR[wdIdx] : currentLang === 'ja' ? WEEKDAY_FULL_JA[wdIdx] : currentLang === 'ru' ? WEEKDAY_FULL_RU[wdIdx] : currentLang === 'tr' ? WEEKDAY_FULL_TR[wdIdx] : currentLang === 'zh-Hans' ? WEEKDAY_FULL_ZHHANS[wdIdx] : currentLang === 'zh-Hant' ? WEEKDAY_FULL_ZHHANT[wdIdx] : currentLang === 'pt-BR' ? WEEKDAY_FULL_PTBR[wdIdx] : WEEKDAY_FULL_EN[wdIdx];
      // Line 1 — Gregorian day/month, region-aware month name
      const monthName = getDisplayGregorianMonth(gm - 1);
      const dayStr = localizeDigits(gd);
      const gregLine = `${dayStr} ${monthName}`;
      // Line 2 — secondary calendar (day + month only)
      let secLine = '';
      try {
        const dt = new Date(gy, gm - 1, gd);
        const secOpts = { day: 'numeric', month: 'short' };
        if (currentLang === 'fa') {
          secLine = dt.toLocaleDateString('fa-IR-u-ca-persian', secOpts);
        } else {
          let usedSystemAlt = false;
          try {
            const cal = new Intl.DateTimeFormat(systemLocale).resolvedOptions().calendar;
            if (cal && cal !== 'gregory') {
              secLine = dt.toLocaleDateString(systemLocale, { ...secOpts, calendar: cal });
              usedSystemAlt = true;
            }
          } catch (e1) {}
          if (!usedSystemAlt) {
            secLine = dt.toLocaleDateString('en-US-u-ca-persian', secOpts);
          }
        }
      } catch (e) {
        try {
          const j2 = gregorianToJalaali(gy, gm, gd);
          secLine = currentLang === 'fa'
            ? `${toPersianDigits(j2.jd)} ${JALALI_MONTHS_FA[j2.jm - 1]}`
            : `${j2.jd}/${j2.jm}`;
        } catch (e2) {}
      }
      // Line 3 — Hijri (lunar/Qamari) calendar, day + month name
      let hijriLine = '';
      try {
        const dt = new Date(gy, gm - 1, gd);
        const hijriOpts = { day: 'numeric', month: 'long' };
        const hijriLocale = currentLang === 'fa' ? 'fa-IR-u-ca-islamic-umalqura' : 'en-US-u-ca-islamic-umalqura';
        hijriLine = dt.toLocaleDateString(hijriLocale, hijriOpts);
      } catch (e3) {}
      return { weekdayKey, weekdayLine, gregLine, secLine: (secLine || '').trim(), hijriLine: (hijriLine || '').trim() };
    }

    for (let d = 1; d <= totalDays; d++) {
      const iso = isoFromYMD(y, m, d);
      const j = gregorianToJalaali(y, m, d);
      const isToday = iso === todayISO;
      const isSelected = iso === smartDateISO;
      const isMarked = isMarkedDay(y, m, d, j.jy, j.jm, j.jd);
      const isBirthday = isBirthdayDay(y, m, d, j.jy, j.jm, j.jd);
      const isHoliday = isPublicHolidayDay(y, m, d, j.jy, j.jm, j.jd);
      const primary = preferJalali ? toPersianDigits(j.jd) : String(d);
      const sub = preferJalali ? String(d) : String(j.jd);
      const tip = dayHoverTip(y, m, d);
      // Hover tooltip stays date-only (Gregorian/Jalali/Hijri); events are shown
      // elsewhere (the special-days popup toggle / event sheet on click), not
      // stacked into this tooltip, so it keeps its own clear, uncluttered look.
      // The weekday gets its own bigger, color-coded badge (Haft Peykar palette)
      // so the tooltip is easier to scan at a glance.
      const tipHtml = `<div class="ai-day-tip" data-weekday="${tip.weekdayKey}">
          <span class="ai-day-tip-wd">${tip.weekdayLine}</span>
          <span class="ai-day-tip-greg">${tip.gregLine}</span>${tip.secLine ? `
          <span class="ai-day-tip-sec">${tip.secLine}</span>` : ''}${tip.hijriLine ? `
          <span class="ai-day-tip-hijri">${tip.hijriLine}</span>` : ''}
        </div>`;
      const cls = ['day-cell'];
      if (isToday) cls.push('is-today');
      if (isMarked) cls.push('is-marked');
      if (isBirthday) cls.push('is-birthday');
      if (isHoliday) cls.push('is-public-holiday');
      if (isSelected) cls.push('is-selected');
      html += `<div class="${cls.join(' ')}" data-iso="${iso}" data-weekday="${tip.weekdayKey}" role="button" tabindex="0">
        <span class="primary-day">${primary}</span>
        <span class="sub-day">${sub}</span>
        ${tipHtml}
      </div>`;
    }
    uiEls.dualGrid.innerHTML = html;

    uiEls.dualGrid.querySelectorAll('.day-cell[data-iso]').forEach(cell => {
      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        // کلیک باعث می‌شود تولتیپ همان لحظه پنهان شود؛ چون موس معمولاً بعد از
        // کلیک هنوز روی همان سلول است، صرفِ :hover در CSS آن را باز نگه می‌داشت.
        cell.classList.add('tip-suppressed');
        const iso = cell.dataset.iso;
        const [gy, gm, gd] = iso.split('-').map(Number);
        const j = gregorianToJalaali(gy, gm, gd);
        smartDateMeta = { source: currentLang === 'fa' ? 'jalali' : 'gregorian', jy: j.jy, jm: j.jm, jd: j.jd };
        setSmartDate(iso);

        // کلیک دوکاره: اگر بنر رویداد همین روز از قبل باز است، همین کلیک آن را می‌بندد
        if (dayEventSheetOpenIso === iso) {
          closeMarkEventSheet();
          return;
        }

        // If this day has special-day event(s), open the paper event sheet (same as mark dots)
        const hits = marksForDay(gy, gm, gd, j.jy, j.jm, j.jd);
        if (hits.length) {
          // Prefer today's event, else nearest (fewest days until)
          hits.sort((a, b) => a.days - b.days);
          openMarkEventSheet(hits[0]);
          dayEventSheetOpenIso = iso;
          // همان روز ممکن است هم مناسبتِ ثبت‌شده داشته باشد و هم رویدادِ ساعتی/روزانهٔ
          // داشبورد زمان — هر دو منبع را زیر هم نشان می‌دهیم، بدون ادغام دو آرایه.
          renderMarkEventDailyList(iso);
          // Highlight matching mark-dot if visible
          if (uiEls.markDotsRow) {
            uiEls.markDotsRow.querySelectorAll('.ai-mark-dot.is-active').forEach(d => d.classList.remove('is-active'));
            const dots = uiEls.markDotsRow.querySelectorAll('.ai-mark-dot');
            dots.forEach((dot) => {
              if (dot.title === hits[0].label) dot.classList.add('is-active');
            });
          }
          // Keep dual picker open so user still sees calendar context; don't force-close
        } else if (iso === todayISO) {
          // روز جاری حتی بدون مناسبتِ ثبت‌شده هم بی‌جواب نمی‌ماند
          openTodayGreetingSheet(iso);
        } else if (getDayTimeEvents(iso).length) {
          // بدون مناسبتِ ثبت‌شده، ولی داشبورد زمان برای این روز رویداد دارد —
          // به‌جای بستنِ سکوت‌آمیزِ قبلی، همان‌ها را نشان می‌دهیم
          openDayEventsSheet(iso);
        } else {
          closeMarkEventSheet();
          closeDualPicker();
          uiEls.smartDateInput.focus();
        }
      });
      cell.addEventListener('mouseleave', () => cell.classList.remove('tip-suppressed'));
      cell.addEventListener('pointerleave', () => cell.classList.remove('tip-suppressed'));
    });
  }

  uiEls.smartDatePickerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dualPickerOpen) closeDualPicker(); else openDualPicker();
  });
  uiEls.dualPrev.addEventListener('click', (e) => {
    e.stopPropagation();
    dualViewMonth -= 1;
    if (dualViewMonth < 1) { dualViewMonth = 12; dualViewYear -= 1; }
    renderDualGrid();
  });
  uiEls.dualNext.addEventListener('click', (e) => {
    e.stopPropagation();
    dualViewMonth += 1;
    if (dualViewMonth > 12) { dualViewMonth = 1; dualViewYear += 1; }
    renderDualGrid();
  });

 [uiEls.markToggle, uiEls.markLabelInput, uiEls.smartDateInput, uiEls.smartDatePickerBtn, uiEls.markAddBtn, uiEls.markGoldenRow, uiEls.markPanel, uiEls.markList, uiEls.dualPicker, uiEls.dashToggle, uiEls.dashPanel, uiEls.dashAddBtn].forEach(el => {
    if (!el) return;
    el.addEventListener('mousedown', (e) => e.stopPropagation());
    el.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: false });
    el.addEventListener('click', (e) => e.stopPropagation());
  });
  uiEls.markLabelInput.addEventListener('keydown', (e) => e.stopPropagation());

  document.addEventListener('mousedown', (e) => {
    if (!dualPickerOpen) return;
    if (uiEls.dualPicker.contains(e.target) || uiEls.smartDatePickerBtn.contains(e.target) || uiEls.smartDateInput.contains(e.target)) return;
    closeDualPicker();
  });

  uiEls.markAddBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const label = uiEls.markLabelInput.value.trim();
    applySmartDateFromInput();
    const dateVal = smartDateISO;
    if (!label || !dateVal) {
      showToastNotification(t('markInvalid'), true);
      if (!dateVal) uiEls.smartDateInput.classList.add('invalid');
      return;
    }
    // Prefer Jalali annual storage when input was Jalali or app language is FA
    let day, month, cal;
    if (smartDateMeta && (smartDateMeta.source === 'jalali' || currentLang === 'fa')) {
      if (smartDateMeta.jm && smartDateMeta.jd) {
        day = smartDateMeta.jd; month = smartDateMeta.jm; cal = 'j';
      } else {
        const [gy, gm, gd] = dateVal.split('-').map(Number);
        const j = gregorianToJalaali(gy, gm, gd);
        day = j.jd; month = j.jm; cal = 'j';
      }
    } else {
      const parts = dateVal.split('-');
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
      cal = 'g';
    }
    if (!day || !month || day < 1 || day > 31 || month < 1 || month > 12) {
      showToastNotification(t('markInvalid'), true);
      return;
    }
    const isGolden = !!(uiEls.markGoldenCb && uiEls.markGoldenCb.checked);
    markedDays.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), label, day, month, cal, golden: isGolden });
    saveMarkedDays(); renderMarkedDays();
    uiEls.markLabelInput.value = '';
    if (uiEls.markGoldenCb) uiEls.markGoldenCb.checked = false;
    smartDateMeta = null;
    setSmartDate('');
    closeDualPicker();
    showToastNotification(t('markToastAdded'));
  });

  function adjustClockPosition() {
      if (!clockPanel.classList.contains('active')) return;
      if (clockManuallyPositioned) return; // کاربر خودش کادر ساعت را جابه‌جا کرده

      // مثل یادداشت: چسبیده به هاب اصلی (فاصلهٔ کم)، نه با زاویه و فاصلهٔ دور
      const rect = hub.getBoundingClientRect();
      const panelWidth = clockPanel.offsetWidth || 244;
      const panelHeight = clockPanel.offsetHeight || 174;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const hubCenterX = rect.left + rect.width / 2;
      const hubCenterY = rect.top + rect.height / 2;
      const GAP = 12; // تقریباً چسبیده به ابزارک شناور

      // اگر پنل مناسبت‌ها باز است، عرض اضافه برای انتخاب سمت در نظر گرفته می‌شود
      const marksOpen = uiEls.markPanel && uiEls.markPanel.classList.contains('active');
      const marksW = marksOpen ? 224 : 0;

      let leftPos, topPos;

      if (hubCenterX < vw * 0.40) {
        // هاب سمت چپ → ساعت سمت راست هاب (تقویم بعداً باز هم به راست/چپ خودش می‌رود)
        leftPos = rect.right + GAP;
        topPos = hubCenterY - panelHeight / 2;
      } else if (hubCenterX > vw * 0.60) {
        // هاب سمت راست → ساعت سمت چپ هاب
        leftPos = rect.left - panelWidth - GAP;
        topPos = hubCenterY - panelHeight / 2;
      } else {
        // هاب وسط → ترجیح سمت راست؛ اگر جا نبود سمت چپ
        leftPos = rect.right + GAP;
        topPos = hubCenterY - panelHeight / 2;
        if (leftPos + panelWidth + marksW > vw - 12) {
          leftPos = rect.left - panelWidth - GAP;
        }
      }

      // اگر هنوز بیرون صفحه است، طرف دیگر
      if (leftPos < 12) leftPos = rect.right + GAP;
      if (leftPos + panelWidth > vw - 12) leftPos = rect.left - panelWidth - GAP;
      if (leftPos < 12) leftPos = 12;
      if (leftPos + panelWidth > vw - 12) leftPos = vw - panelWidth - 12;

      if (topPos < 12) topPos = 12;
      if (topPos + panelHeight > vh - 12) topPos = vh - panelHeight - 12;

      clockPanel.style.left = `${leftPos}px`;
      clockPanel.style.top = `${topPos}px`;
      if (typeof syncMarksToggleRestSide === 'function') syncMarksToggleRestSide();
      if (typeof syncDashToggleRestSide === 'function') syncDashToggleRestSide();
  }
  
  clockToggleDot.addEventListener('click', (e) => {
      e.stopPropagation(); playLauncherClick(7); closeTree(); const isActive = clockPanel.classList.contains('active'); closeAllPanelsExcept('');
      if (typeof collapseMotivationalQuotes === 'function') collapseMotivationalQuotes();
      if (!isActive) {
        // هر بار باز شدن: مثل یادداشت کنار هاب لنگر شود (موقعیت ذخیره‌شدهٔ دور قبلی نادیده)
        clockManuallyPositioned = false;
        try { if (chrome.runtime?.id) chrome.storage.sync.remove(['clockCustomX', 'clockCustomY']); } catch (err) {}
        clockPanel.classList.add('active');
        root.classList.add('show-clock');
        updateClockAge();
        renderMarkedDays();
        renderRumiQuote();
        adjustClockPosition();
      }
      resetToggleTimeout();
  });

  let isClockDragging = false;
  let clockDragMoved = false;
  let clockStartX, clockStartY, clockStartLeft, clockStartTop;
  let clockManuallyPositioned = false;

  function startClockDrag(clientX, clientY) {
    isClockDragging = true; clockDragMoved = false;
    clockStartX = clientX; clockStartY = clientY;

    // فقط موقعیت خودِ کادر ساعت گرفته می‌شود — نه کل سیستم/هاب
    clockStartLeft = clockPanel.offsetLeft;
    clockStartTop = clockPanel.offsetTop;

    clockPanel.style.transition = 'none'; clockPanel.classList.add('is-dragging');
  }

  clockPanel.addEventListener('mousedown', (e) => {
    e.stopPropagation(); startClockDrag(e.clientX, e.clientY);
  });
  clockPanel.addEventListener('touchstart', (e) => {
    e.stopPropagation(); startClockDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });

  document.addEventListener('mousemove', (e) => {
    if (!isClockDragging) return;
    const dx = e.clientX - clockStartX; const dy = e.clientY - clockStartY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) clockDragMoved = true;

    // فقط کادر ساعت جابه‌جا می‌شود؛ ابزار اصلی (هاب) سرجایش می‌ماند و پنهان نمی‌شود
    clockPanel.style.left = `${clockStartLeft + dx}px`;
    clockPanel.style.top = `${clockStartTop + dy}px`;
    if (clockDragMoved) clockManuallyPositioned = true;
  });
  document.addEventListener('touchmove', (e) => {
    if (!isClockDragging) return;
    const dx = e.touches[0].clientX - clockStartX; const dy = e.touches[0].clientY - clockStartY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) clockDragMoved = true;

    clockPanel.style.left = `${clockStartLeft + dx}px`;
    clockPanel.style.top = `${clockStartTop + dy}px`;
    if (clockDragMoved) clockManuallyPositioned = true;
  }, { passive: false });

  function endClockDrag() {
    if (isClockDragging) {
      isClockDragging = false; 
      clockPanel.style.transition = ''; clockPanel.classList.remove('is-dragging');
      if (clockDragMoved) {
        try {
          if (chrome.runtime?.id) {
            chrome.storage.sync.set({ clockCustomX: parseInt(clockPanel.style.left, 10), clockCustomY: parseInt(clockPanel.style.top, 10) });
          }
        } catch (err) {}
      }
      if (typeof syncMarksToggleRestSide === 'function') syncMarksToggleRestSide();
      if (typeof syncDashToggleRestSide === 'function') syncDashToggleRestSide();
    }
  }
  document.addEventListener('mouseup', endClockDrag);
  document.addEventListener('touchend', endClockDrag);

  clockPanel.addEventListener('click', (e) => {
      e.stopPropagation();
      // هاب دیگر مخفی نمی‌شود؛ کلیک روی ساعت نباید هاب را جابه‌جا کند یا پنل را ببندد
  });

  // Void Tab در همان صفحه می‌تواند این دادهٔ زنده را مستقیم دریافت کند؛ در نتیجه
  // نمایش آن هیچ‌وقت وابسته به تأخیر یا ناسازگاری storage نخواهد بود.
  function publishTodosToVoidTab() {
    try {
      window.__aiTreeTodosForVoid = todosData;
      window.dispatchEvent(new CustomEvent('ai-tree-todos-updated', { detail: todosData }));
    } catch (err) {}
  }

  // sync منبع اصلی است؛ آینهٔ local برای سازگاری با نصب‌های قدیمی حفظ می‌شود.
  function saveTodos() {
    try {
      if (chrome.runtime?.id) {
        chrome.storage.sync.set({ aiTreeTodos: todosData });
        chrome.storage.local.set({ aiTreeTodos: todosData });
      }
    } catch(e){}
    publishTodosToVoidTab();
  }

  function migrateTodos() {
    let changed = false;
    todosData.forEach(todo => {
      if (!todo.type) { todo.type = 'daily'; changed = true; }
      if (!todo.createdAt) { todo.createdAt = Date.now(); changed = true; }
      // بدون id پایدار، پیوند کار↔هدف ممکن نیست — برای اهداف قدیمی حتماً بساز
      if (!todo.id) {
        todo.id = (typeof newLinkId === 'function' ? newLinkId('td') : ('td_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)));
        changed = true;
      }
      if (todo.type === 'goal') {
        if (typeof todo.completedWeight !== 'number') { todo.completedWeight = 0; changed = true; }
        if (todo.manualProgress === undefined) { todo.manualProgress = null; changed = true; }
      }
    });
    return changed;
  }

  // —— Goal linkage (v1): star روی کار روزانه = linkedGoalId؛ پیشرفت هدف از وزن فرزندان ——
  const expandedGoalIds = new Set(); // فقط UI session
  let goalPopoverEl = null;


  function todoImpactPct(t) {
    if (!t) return 10;
    const n = Number(t.impactPct);
    if (!Number.isNaN(n) && n > 0) return Math.max(1, Math.min(100, Math.round(n)));
    // سازگاری با weight قدیمی (۱–۵ → تقریباً ۵–۲۵)
    if (typeof t.weight === 'number' && t.weight > 0) return Math.max(1, Math.min(100, Math.round(t.weight * 5)));
    return 10;
  }
  function getGoalById(id) {
    if (!id) return null;
    return todosData.find(td => td && td.id === id && (td.type || 'daily') === 'goal') || null;
  }
  function activeGoalsList() {
    return todosData.filter(td => td && (td.type || 'daily') === 'goal' && !td.done && td.id);
  }
  function childrenOfGoal(goalId) {
    if (!goalId) return [];
    return todosData.filter(td => td && (td.type || 'daily') === 'daily' && td.linkedGoalId === goalId);
  }
  /** پیشرفت هدف = جمع impactPct کارهای انجام‌شدهٔ پیوندی (سقف ۱۰۰) مگر override دستی */
  function computeGoalProgress(goal) {
    if (!goal) return 0;
    if (goal.manualProgress != null && goal.manualProgress !== '') {
      const m = Number(goal.manualProgress);
      if (!Number.isNaN(m)) return Math.max(0, Math.min(100, Math.round(m)));
    }
    const kids = childrenOfGoal(goal.id);
    if (!kids.length) {
      // اگر هنوز فرزندی نیست، completedWeight آرشیوی را نشان بده (کارهای منقضی‌شده)
      const archived = typeof goal.completedWeight === 'number' ? goal.completedWeight : 0;
      return Math.max(0, Math.min(100, Math.round(archived)));
    }
    const doneSum = kids.filter(k => k.done).reduce((s, k) => s + todoImpactPct(k), 0);
    // completedWeight = سهم کارهای انجام‌شده‌ای که TTL خورده‌اند و از لیست رفته‌اند
    const archived = typeof goal.completedWeight === 'number' ? goal.completedWeight : 0;
    return Math.max(0, Math.min(100, Math.round(doneSum + archived)));
  }
  function sumLinkedImpact(goalId, { doneOnly = false, excludeId = null } = {}) {
    return childrenOfGoal(goalId).reduce((s, k) => {
      if (excludeId && k.id === excludeId) return s;
      if (doneOnly && !k.done) return s;
      return s + todoImpactPct(k);
    }, 0);
  }
  function adjustGoalCompletedWeight(goal, delta) {
    if (!goal) return;
    goal.completedWeight = Math.max(0, (typeof goal.completedWeight === 'number' ? goal.completedWeight : 0) + delta);
  }
  // آستانه‌های فشفشه — همان منطق Void Tab (۳۰ / ۵۰ / ۷۰ / ۹۰ / ۱۰۰)
  const GOAL_FW_MARKS = [
    { tier: 1, up: 30 },
    { tier: 2, up: 50 },
    { tier: 3, up: 70 },
    { tier: 4, up: 90 }
  ];
  function goalCrossedTiers(fromP, toP) {
    fromP = Math.max(0, Math.min(100, Number(fromP) || 0));
    toP = Math.max(0, Math.min(100, Number(toP) || 0));
    if (toP <= fromP) return 0;
    let highest = 0;
    GOAL_FW_MARKS.forEach((m) => {
      if (fromP < m.up && toP >= m.up) highest = Math.max(highest, m.tier);
    });
    if (fromP < 100 && toP >= 100) highest = 5;
    return highest;
  }
  function ensurePanelFireworkSky() {
    try {
      if (!window.FireworkSky) return false;
      if (FireworkSky._panelInited) return true;
      let onEvent = null;
      try {
        if (typeof FireworkSky.createSynth === 'function') {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (AC) {
            const ac = window.__panelFireworkAC || new AC();
            window.__panelFireworkAC = ac;
            const g = ac.createGain();
            g.gain.value = 0.5;
            g.connect(ac.destination);
            onEvent = FireworkSky.createSynth(ac, g);
          }
        }
      } catch (eSynth) {}
      FireworkSky.init({ container: document.documentElement || document.body, zIndex: 2147483000, onEvent: onEvent });
      FireworkSky._panelInited = true;
      return true;
    } catch (e) { return false; }
  }
  function celebrateGoalProgress(goal, fromP, toP, locusEl) {
    const crossed = goalCrossedTiers(fromP, toP);
    if (crossed <= 0) return;
    try {
      if (!window.FireworkSky || typeof FireworkSky.play !== 'function') return;
      if (!ensurePanelFireworkSky()) return;
      try {
        if (window.__panelFireworkAC && window.__panelFireworkAC.state === 'suspended') {
          window.__panelFireworkAC.resume();
        }
      } catch (e3) {}
      let originX = 0.5;
      const el = locusEl || (todoPanel && todoPanel.classList.contains('active') ? todoPanel : null);
      if (el && el.getBoundingClientRect) {
        const r = el.getBoundingClientRect();
        originX = (r.left + r.width / 2) / Math.max(1, window.innerWidth);
      }
      // جلوگیری از تکرار فینال ۱۰۰٪
      if (crossed === 5) {
        if (goal && goal._fwCelebrated && fromP >= 90) return;
        if (goal) goal._fwCelebrated = true;
      } else if (goal && toP < 90) {
        goal._fwCelebrated = false;
      }
      FireworkSky.play(crossed, { originX: originX });
    } catch (e) {}
  }
  function syncGoalProgressFromChildren(goal) {
    if (!goal) return 0;
    // تیک کارها منبع حقیقت است — override دستی را کنار بگذار
    goal.manualProgress = null;
    const pct = computeGoalProgress(goal);
    goal.progress = pct; // برای اسلایدر Void Tab
    return pct;
  }
  function toggleTodoDone(task) {
    if (!task) return;
    let goal = null;
    let prev = 0;
    if (task.linkedGoalId) {
      goal = getGoalById(task.linkedGoalId);
      if (goal) prev = computeGoalProgress(goal);
    }
    task.done = !task.done;
    if (goal) {
      const next = syncGoalProgressFromChildren(goal);
      // فقط وقتی تیک «زده» می‌شود (نه برداشتن تیک) جشن بگیر
      if (task.done) {
        const locus = document.querySelector('.ai-goal-card') || todoPanel;
        celebrateGoalProgress(goal, prev, next, locus);
      }
    }
    memoryOnTodoToggle(task);
    saveTodos();
    renderTodos();
  }
  function unlinkTaskFromGoal(task, rerender = true) {
    if (!task || !task.linkedGoalId) return;
    // اگر کار done بود و بعداً TTL می‌خورد، سهمش را در completedWeight نگه نمی‌داریم مگر قبلاً archive شده
    task.linkedGoalId = null;
    // impactPct را نگه می‌داریم تا در پیوند بعدی پیش‌فرض باشد
    if (rerender) { saveTodos(); renderTodos(); syncEventGoalFieldsFromTask(task); }
  }
  function linkTaskToGoal(task, goalId, impactPct) {
    if (!task || !goalId) return;
    if (task.linkedGoalId && task.linkedGoalId !== goalId) {
      unlinkTaskFromGoal(task, false);
    }
    task.linkedGoalId = goalId;
    if (impactPct != null && impactPct !== '') {
      const n = Math.max(1, Math.min(100, Math.round(Number(impactPct) || 10)));
      task.impactPct = n;
    } else if (task.impactPct == null) {
      task.impactPct = 10;
    }
    saveTodos();
    renderTodos();
    syncEventGoalFieldsFromTask(task);
  }
  function setTaskImpactPct(task, pct) {
    if (!task) return;
    task.impactPct = Math.max(1, Math.min(100, Math.round(Number(pct) || 10)));
    saveTodos();
    renderTodos();
    syncEventGoalFieldsFromTask(task);
  }

  // ── همان مکانیزمِ ستاره/درصد را برای رویدادهای تقویمِ روزانه و ساعتی هم
  // فعال می‌کند — هر رویداد از قبل یک TODوی آینه‌ای دارد (evt.linkedTodoId،
  // بالا)؛ همان TODو را به یک هدف پیوند می‌دهیم و کل منطقِ محاسبهٔ پیشرفت/
  // فشفشه که برای کارهای روزانه نوشته شده، بدونِ تغییر همینجا هم کار می‌کند.
  // فقط باید evt خودش هم نسخه‌ای از linkedGoalId/impactPct را نگه دارد،
  // چون رویدادهای تکرارشونده هر روز TODوی آینه‌ای‌شان را دور می‌ریزند و از
  // نو می‌سازند (pruneExpiredDashEvents) — اگر پیوند فقط روی TODو بود، با
  // هر تکرار گم می‌شد. evt این‌جا منبعِ حقیقتِ پایدار است.
  function eventMirrorTask(evt) {
    if (!evt || !evt.linkedTodoId) return null;
    return todosData.find(td => td.id === evt.linkedTodoId) || null;
  }
  function syncEventGoalFieldsFromTask(task) {
    if (!task || !task.id || !Array.isArray(timeEventsData)) return;
    const evt = timeEventsData.find(e => e && e.linkedTodoId === task.id);
    if (!evt) return;
    evt.linkedGoalId = task.linkedGoalId || null;
    evt.impactPct = task.linkedGoalId ? todoImpactPct(task) : null;
    saveTimeEvents();
    refreshDashUI();
  }
  /** ستاره + چیپِ درصد را روی یک ردیفِ رویداد می‌سازد — هم برای کارتِ داشبوردِ
   * ساعتیِ «امروز» (buildDashEventCard) و هم برگهٔ تقویمِ روزانه
   * (renderMarkEventDailyList) از همین یک تابع استفاده می‌شود. */
  function appendEventGoalControls(row, evt) {
    const task = eventMirrorTask(evt);
    if (!task) return;
    const starButton = document.createElement('button');
    starButton.type = 'button';
    starButton.className = 'ai-todo-star' + (task.linkedGoalId ? ' on' : '');
    starButton.textContent = task.linkedGoalId ? '★' : '☆';
    const linkedGoal = task.linkedGoalId ? getGoalById(task.linkedGoalId) : null;
    if (task.linkedGoalId && linkedGoal) {
      const impact = todoImpactPct(task);
      starButton.title = (t('todoLinkedTo') || 'Linked to') + ': ' + (linkedGoal.text || '') + ' · ' + impact + '%';
      starButton.setAttribute('data-share', impact + '%');
    } else {
      starButton.title = t('todoLinkGoal') || 'Link to a goal';
      starButton.removeAttribute('data-share');
    }
    starButton.addEventListener('click', (e) => handleStarClick(e, task, starButton));
    row.appendChild(starButton);
    if (task.linkedGoalId) {
      row.classList.add('linked');
      const impactChip = document.createElement('button');
      impactChip.type = 'button';
      impactChip.className = 'ai-todo-impact';
      impactChip.textContent = todoImpactPct(task) + '%';
      impactChip.title = t('todoSetImpact') || 'Set impact %';
      impactChip.addEventListener('click', (e) => { e.stopPropagation(); handleStarClick(e, task, impactChip); });
      row.appendChild(impactChip);
    }
  }

  function createGoalFromText(textVal) {
    const g = {
      id: (typeof newLinkId === 'function' ? newLinkId('td') : ('td_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6))),
      text: textVal,
      done: false,
      type: 'goal',
      createdAt: Date.now(),
      completedWeight: 0,
      manualProgress: null
    };
    todosData.push(g);
    return g;
  }
  function closeGoalPopover() {
    if (goalPopoverEl && goalPopoverEl.parentNode) goalPopoverEl.parentNode.removeChild(goalPopoverEl);
    goalPopoverEl = null;
  }

  /** پاپ‌اور دو مرحله‌ای: ۱) انتخاب هدف  ۲) تعیین درصد تأثیر */
  function openGoalPopover(anchor, task) {
    closeGoalPopover();
    if (!task || !todoPanel) return;
    try { if (migrateTodos()) saveTodos(); } catch (err) {}

    const pop = document.createElement('div');
    pop.className = 'ai-goal-popover';
    pop.setAttribute('role', 'dialog');
    pop.addEventListener('mousedown', (e) => e.stopPropagation());
    pop.addEventListener('click', (e) => e.stopPropagation());

    function mount(el) {
      todoPanel.style.position = todoPanel.style.position || 'fixed';
      if (!pop.parentNode) todoPanel.appendChild(pop);
      pop.replaceChildren(el);
      positionPop();
    }
    function positionPop() {
      const a = anchor.getBoundingClientRect();
      const p = todoPanel.getBoundingClientRect();
      const popH = Math.min(pop.offsetHeight || 180, Math.max(120, p.height - 16));
      const popW = pop.offsetWidth || 210;
      let top = a.bottom - p.top + 4;
      let left = a.left - p.left;
      if (top + popH > p.height - 8) top = Math.max(8, a.top - p.top - popH - 4);
      if (left + popW > p.width - 8) left = Math.max(8, p.width - popW - 8);
      if (left < 8) left = 8;
      if (top < 8) top = 8;
      pop.style.top = top + 'px';
      pop.style.left = left + 'px';
      pop.style.maxHeight = (p.height - 16) + 'px';
    }

    function showImpactStep(goal) {
      const wrap = document.createElement('div');
      wrap.className = 'ai-goal-pop-step';

      const title = document.createElement('div');
      title.className = 'ai-goal-pop-title';
      title.textContent = t('todoSetImpact') || 'Impact on this goal';
      wrap.appendChild(title);

      const goalName = document.createElement('div');
      goalName.className = 'ai-goal-pop-goalname';
      goalName.textContent = goal.text || '';
      wrap.appendChild(goalName);

      const current = todoImpactPct(task);
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '1';
      input.max = '100';
      input.className = 'ai-goal-pop-impact-input';
      input.value = String(current);
      input.dir = 'ltr';

      const suffix = document.createElement('span');
      suffix.className = 'ai-goal-pop-impact-suffix';
      suffix.textContent = '%';

      const inputRow = document.createElement('div');
      inputRow.className = 'ai-goal-pop-impact-row';
      inputRow.append(input, suffix);
      wrap.appendChild(inputRow);

      const chips = document.createElement('div');
      chips.className = 'ai-goal-pop-chips';
      [5, 10, 15, 20, 25, 50].forEach((v) => {
        const c = document.createElement('button');
        c.type = 'button';
        c.className = 'ai-goal-pop-chip' + (v === current ? ' on' : '');
        c.textContent = v + '%';
        c.addEventListener('click', (e) => {
          e.stopPropagation();
          input.value = String(v);
          chips.querySelectorAll('.ai-goal-pop-chip').forEach(x => x.classList.remove('on'));
          c.classList.add('on');
        });
        chips.appendChild(c);
      });
      wrap.appendChild(chips);

      // هشدار اگر جمع درصدها از ۱۰۰ رد شود
      const others = sumLinkedImpact(goal.id, { excludeId: task.id });
      const hint = document.createElement('div');
      hint.className = 'ai-goal-pop-hint';
      const refreshHint = () => {
        const mine = Math.max(1, Math.min(100, Math.round(Number(input.value) || 10)));
        const total = others + mine;
        hint.textContent = (t('todoImpactSumHint') || 'With other tasks: {t}% allocated')
          .replace('{t}', String(total));
        hint.classList.toggle('over', total > 100);
      };
      input.addEventListener('input', refreshHint);
      refreshHint();
      wrap.appendChild(hint);

      const actions = document.createElement('div');
      actions.className = 'ai-goal-pop-actions';
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'ai-goal-pop-back';
      back.textContent = t('todoImpactBack') || 'Back';
      back.addEventListener('click', (e) => { e.stopPropagation(); showPickStep(); });
      const ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'ai-goal-pop-ok';
      ok.textContent = t('todoImpactConfirm') || 'Link';
      const commit = () => {
        const pct = Math.max(1, Math.min(100, Math.round(Number(input.value) || 10)));
        linkTaskToGoal(task, goal.id, pct);
        closeGoalPopover();
        try {
          showToastNotification(
            (t('toastTodoLinkedImpact') || 'Linked · {p}% of «{g}»')
              .replace('{p}', String(pct))
              .replace('{g}', goal.text || '')
          );
        } catch (err) {}
      };
      ok.addEventListener('click', (e) => { e.stopPropagation(); commit(); });
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        else if (e.key === 'Escape') { e.preventDefault(); closeGoalPopover(); }
      });
      actions.append(back, ok);
      wrap.appendChild(actions);
      mount(wrap);
      setTimeout(() => { try { input.focus(); input.select(); } catch (err) {} }, 30);
    }

    function showPickStep() {
      const wrap = document.createElement('div');
      wrap.className = 'ai-goal-pop-step';

      const title = document.createElement('div');
      title.className = 'ai-goal-pop-title';
      title.textContent = t('todoPickGoal') || 'Link to goal';
      wrap.appendChild(title);

      const goals = activeGoalsList();
      const listWrap = document.createElement('div');
      listWrap.className = 'ai-goal-pop-list';

      if (!goals.length) {
        const empty = document.createElement('div');
        empty.className = 'ai-goal-pop-empty';
        empty.textContent = t('todoNoGoals') || 'No goals yet';
        listWrap.appendChild(empty);
      } else {
        goals.forEach((g) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'ai-goal-pop-item' + (task.linkedGoalId === g.id ? ' current' : '');
          const label = document.createElement('span');
          label.className = 'ai-goal-pop-label';
          label.textContent = g.text || '';
          const prog = document.createElement('span');
          prog.className = 'ai-goal-pop-share';
          prog.textContent = computeGoalProgress(g) + '%';
          b.append(label, prog);
          b.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            showImpactStep(g);
          });
          listWrap.appendChild(b);
        });
      }
      wrap.appendChild(listWrap);

      const add = document.createElement('input');
      add.type = 'text';
      add.className = 'ai-goal-pop-new';
      add.placeholder = t('todoNewGoalPh') || '+ New goal';
      add.dir = 'auto';
      add.addEventListener('click', (e) => e.stopPropagation());
      add.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter' && add.value.trim()) {
          e.preventDefault();
          const g = createGoalFromText(add.value.trim());
          showImpactStep(g);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeGoalPopover();
        }
      });
      wrap.appendChild(add);

      if (task.linkedGoalId) {
        const un = document.createElement('button');
        un.type = 'button';
        un.className = 'ai-goal-pop-item ai-goal-pop-unlink';
        un.textContent = t('todoUnlinkGoal') || 'Remove link';
        un.addEventListener('click', (e) => {
          e.stopPropagation();
          unlinkTaskFromGoal(task);
          closeGoalPopover();
        });
        wrap.appendChild(un);
      }

      mount(wrap);
      if (!goals.length) setTimeout(() => { try { add.focus(); } catch (err) {} }, 30);
    }

    goalPopoverEl = pop;
    showPickStep();

    // اگر از قبل پیوند است و فقط می‌خواهد درصد را عوض کند → مستقیم مرحلهٔ درصد
    if (task.linkedGoalId) {
      const g = getGoalById(task.linkedGoalId);
      if (g) showImpactStep(g);
    }

    setTimeout(() => {
      const outside = (e) => {
        if (!goalPopoverEl) {
          document.removeEventListener('mousedown', outside, true);
          return;
        }
        if (goalPopoverEl.contains(e.target) || e.target === anchor || (anchor && anchor.contains && anchor.contains(e.target))) {
          return;
        }
        closeGoalPopover();
        document.removeEventListener('mousedown', outside, true);
      };
      document.addEventListener('mousedown', outside, true);
    }, 0);
  }

  function handleStarClick(e, task, starEl) {
    e.stopPropagation();
    e.preventDefault();
    // همیشه پاپ‌اور را باز کن تا اهداف قبلی قابل انتخاب باشند (نه فقط ساخت هدف جدید)
    openGoalPopover(starEl, task);
  }


  // ── Echo / Memory: goal-linked commitment tracking ────────────────────────
  // Only active when the memory engine understands goal context (it exposes
  // archiveGoalProgress). With an older engine every path below falls back to
  // the previous behaviour exactly, so this file is safe to ship first.
  function memoryGoalAware() {
    return typeof AITreeMemoryEngine !== 'undefined' &&
           typeof AITreeMemoryEngine.archiveGoalProgress === 'function';
  }
  // A TODO that is just the automatic mirror of an hourly event. The event
  // archives itself, so the mirror must never be archived (double counting).
  function isEventMirrorTodo(todo) {
    return !!(todo && todo.id && Array.isArray(timeEventsData) &&
              timeEventsData.some((e) => e && e.linkedTodoId === todo.id));
  }
  function memoryGoalCtx(todo) {
    const goal = todo && todo.linkedGoalId ? getGoalById(todo.linkedGoalId) : null;
    return { goalTitle: goal ? goal.text : null };
  }
  // Called right after task.done flips. 'completed' is archived at tick time
  // (so a task done on Monday is Monday's win even if it expires on Tuesday).
  // Archive ids are deterministic, so re-ticking overwrites instead of
  // duplicating, and un-ticking overwrites the record as 'reopened' (ignored
  // by the Echo). todo.memArchived remembers that the completion is on file.
  function memoryOnTodoToggle(todo) {
    if (!todo || !memoryGoalAware()) return;
    if ((todo.type || 'daily') !== 'daily' || isEventMirrorTodo(todo)) return;
    try {
      if (todo.done) {
        AITreeMemoryEngine.archiveTodo(todo, 'completed', memoryGoalCtx(todo));
        todo.memArchived = true;
      } else if (todo.memArchived) {
        AITreeMemoryEngine.archiveTodo(todo, 'reopened');
        todo.memArchived = false;
      }
    } catch (e) {}
  }
  function memoryOnTodoRestored(item) {
    if (!item || !memoryGoalAware()) return;
    if ((item.type || 'daily') !== 'daily' || item.done || isEventMirrorTodo(item)) return;
    try { AITreeMemoryEngine.archiveTodo(item, 'restored'); } catch (e) {}
  }

  function pruneExpiredDailyTodos() {
    const now = Date.now();
    const kept = [];
    const dropped = [];
    for (const todo of todosData) {
      const expired = (todo.type || 'daily') === 'daily' && (now - (todo.createdAt || now)) >= TODO_DAILY_TTL_MS;
      if (!expired) { kept.push(todo); continue; }
      dropped.push(todo);
      // کار انجام‌شدهٔ پیوندی: سهم درصدش را روی هدف آرشیو کن تا پیشرفت صفر نشود
      if (todo.done && todo.linkedGoalId) {
        const g = getGoalById(todo.linkedGoalId);
        if (g) adjustGoalCompletedWeight(g, todoImpactPct(todo));
      }
    }
    if (!dropped.length) return false;

    // Silent expiry used to leave no trace. Uncompleted tasks are now archived
    // as 'expired' (the engine turns linked ones into 'expired-linked').
    // Completed tasks are skipped: their completion was archived at tick time.
    // Event-mirror TODOs are skipped: the event itself is archived elsewhere.
    if (memoryGoalAware()) {
      dropped.forEach((todo) => {
        try {
          if (todo.done || isEventMirrorTodo(todo)) return;
          AITreeMemoryEngine.archiveTodo(todo, 'expired', memoryGoalCtx(todo));
        } catch (e) {}
      });
    }

    todosData = kept;
    saveTodos();
    return true;
  }

  function setAddForTomorrow(val) {
    addForTomorrow = val;
    uiEls.todoWhenToday.classList.toggle('active', !val);
    uiEls.todoWhenTomorrow.classList.toggle('active', val);
    renderTodos();
  }

  function switchTodoTab(type) {
    activeTodoTab = type;
    uiEls.todoTabDaily.classList.toggle('active', type === 'daily');
    uiEls.todoTabGoal.classList.toggle('active', type === 'goal');
    todoPanel.classList.toggle('goal-mode', type === 'goal');
    uiEls.todoInput.placeholder = type === 'daily' ? t('todoDailyInput') : t('todoGoalInput');
    uiEls.todoWhenRow.style.display = type === 'daily' ? '' : 'none';
    if (type !== 'daily') setAddForTomorrow(false);
    renderTodos();
  }
  uiEls.todoWhenToday.addEventListener('click', (e) => { e.stopPropagation(); setAddForTomorrow(false); });
  uiEls.todoWhenTomorrow.addEventListener('click', (e) => { e.stopPropagation(); setAddForTomorrow(true); });

  // تب‌های سوییچِ منبعِ گنجینه (دینی/ادبی) — هر دو ویجت (آیهٔ روز در Todo، شعر
  // روز در ساعت) قبلاً فقط از طریقِ تنظیمات (Vault در پاپ‌آپ) قابل تغییرِ منبع
  // بودند؛ حالا یک ردیف تبِ کوچک همان‌جا روی خودِ ویجت این کار را می‌کند، به‌اضافهٔ
  // یک swipe افقی روی بدنهٔ ویجت برای لمسی/موبایل — هر دو فقط «منبع» را عوض
  // می‌کنند، نه خودِ متنِ نمایش‌داده‌شده (چرخاندن به آیه/شعر تصادفیِ جدید همچنان با
  // تپ/کلیک ساده روی بدنه است، دست‌نخورده). سوییچ صرفاً کلید را در storage
  // می‌نویسد؛ بارگذاریِ فایل و رندر مجدد را همان listener موجودِ
  // chrome.storage.onChanged (پایین همین فایل) به‌طور خودکار انجام می‌دهد.
  function attachQuoteSwipe(el, getOrder, getActiveKey, switchFn, onSwiped) {
    if (!el) return;
    let startX = 0, startY = 0, tracking = false, swiped = false;
    el.addEventListener('touchstart', (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      startX = e.touches[0].clientX; startY = e.touches[0].clientY;
      tracking = true; swiped = false;
    }, { passive: true });
    el.addEventListener('touchmove', (e) => {
      if (!tracking || !e.touches || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy) * 1.4) swiped = true;
    }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (!tracking) return;
      tracking = false;
      if (!swiped) return;
      const endX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : startX;
      const dx = endX - startX;
      const order = getOrder();
      if (!order.length) return;
      const curIdx = Math.max(0, order.indexOf(getActiveKey()));
      const nextIdx = dx < 0 ? (curIdx + 1) % order.length : (curIdx - 1 + order.length) % order.length;
      switchFn(order[nextIdx]);
      if (onSwiped) onSwiped(Date.now()); // برای سرکوبِ کلیکِ همزمانِ «چرخش به مورد تصادفی» بلافاصله بعد از swipe
    }, { passive: true });
  }

  let isQuoteCollapsed = true; // Hidden by default — shows only the closed "🌙" tab until the user opens it

  // === کمک‌تابع‌های عمومیِ نقل‌قول ۸‌زبانه — یک‌بار تعریف، هم برای بخش
  // آیه/متن مذهبی (todoQuote) و هم بخش شعر (clockQuote) استفاده می‌شود.
  // قبلاً فقط بین q.fa/q.en سوییچ می‌کرد؛ حالا مستقیم بر اساس currentLang
  // انتخاب می‌کند (با fallback به en سپس fa اگر آن زبان ترجمه نداشت).
  function quoteText(q) { return (q && (q[currentLang] || q.en || q.fa)) || ''; }
  function quoteIsRtl() { return currentLang === 'fa' || currentLang === 'ar'; }
  function quoteDir() { return quoteIsRtl() ? 'rtl' : 'ltr'; }
  // مرجع/رفرنس: برای فارسی و عربی رفرنسِ بومی (q.ref) اولویت دارد، برای بقیهٔ
  // زبان‌ها رفرنسِ انگلیسی/لاتین (q.refEn) که بین‌المللی‌تر و شناخته‌شده‌تر است.
  function quoteRef(q) {
    if (!q) return '';
    return quoteIsRtl() ? (q.ref || q.refEn || '') : (q.refEn || q.ref || '');
  }
  function quoteCategoryLabel(cat) { return (cat && (cat[currentLang] || cat.en)) || ''; }

  function renderDailyQuote() {
    const q = AITreeQuoteEngine.religionFeature.current();
    if (!q) return;
    const religionCat = AITreeQuoteEngine.religions[AITreeQuoteEngine.activeReligionKey];
    // منبع فعال را روی خودِ ویجت می‌گذاریم تا CSS بتواند فقط برای بخش اسلام (آیات
    // کوتاه) ضخامت متن اصلی را جدا از بقیه‌ی منابع تنظیم کند.
    if (uiEls.todoQuote) uiEls.todoQuote.dataset.quoteSource = AITreeQuoteEngine.activeReligionKey || '';
    if (uiEls.todoQuoteFa) {
      uiEls.todoQuoteFa.textContent = q.text || '';
      uiEls.todoQuoteFa.dir = 'rtl';
      uiEls.todoQuoteFa.style.display = q.text ? '' : 'none';
    }    // خط ترجمه — متنِ زبانِ اصلی (اگر باشد) همیشه بالا ثابت می‌ماند، فقط
    // ترجمهٔ زیرش با زبان فعال برنامه عوض می‌شود (بین هر ۸ زبان، نه فقط fa/en).
    if (uiEls.todoQuoteTranslation) {
      const translation = quoteText(q);
      uiEls.todoQuoteTranslation.textContent = translation;
      uiEls.todoQuoteTranslation.dir = quoteDir();
      uiEls.todoQuoteTranslation.classList.toggle('is-fa', quoteIsRtl());
      uiEls.todoQuoteTranslation.classList.toggle('is-en', !quoteIsRtl());
      uiEls.todoQuoteTranslation.style.display = translation ? '' : 'none';
    }
    if (uiEls.todoQuoteTitle) {
      const ref = quoteRef(q);
      uiEls.todoQuoteTitle.textContent = ref ? `${religionCat.icon} ${ref}` : religionCat.icon;
      uiEls.todoQuoteTitle.dir = quoteDir();
      uiEls.todoQuoteTitle.style.display = '';
    }
    if (uiEls.todoQuote) uiEls.todoQuote.classList.toggle('is-collapsed', isQuoteCollapsed);
    if (uiEls.todoQuoteChevron) uiEls.todoQuoteChevron.textContent = isQuoteCollapsed ? '▼' : '▲';
    
    // کدی که آیکون خورشید و ماه را تغییر می‌دهد:
    if (uiEls.todoQuoteLabel) {
      uiEls.todoQuoteLabel.textContent = isQuoteCollapsed ? '🌙' : '☀️';
    }

    if (uiEls.todoQuoteTab) {
      uiEls.todoQuoteTab.title = isQuoteCollapsed ? t('quoteToggleShow') : t('quoteToggleHide');
    }
    // تب‌های کوچکِ سوییچِ منبع — همان‌جا، بدون نیاز به رفتن به تنظیمات؛ فعال‌سازیِ
    // تبِ درست + tooltip کامل (چون خودِ دکمه فقط ایموجی است، جای کافی برای متن ندارد)
    if (uiEls.todoQuoteSourceTabs) {
      uiEls.todoQuoteSourceTabs.querySelectorAll('.ai-quote-source-tab').forEach((btn) => {
        const key = btn.dataset.key;
        const cat = AITreeQuoteEngine.religions[key];
        btn.classList.toggle('active', key === AITreeQuoteEngine.activeReligionKey);
        if (cat) btn.title = quoteCategoryLabel(cat);
      });
    }
  }

  function toggleQuoteCollapse(e) {
    if (e) e.stopPropagation();
    isQuoteCollapsed = !isQuoteCollapsed;
    renderDailyQuote();
    if (typeof adjustTodoPosition === 'function') adjustTodoPosition();
  }

  function cycleToRandomQuote(e) {
    if (e) e.stopPropagation();
    if (isQuoteCollapsed) return; // body is invisible/inert while collapsed — nothing to cycle
    if (Date.now() - todoQuoteSwipedAt < 400) return; // just swiped to switch source — don't also cycle the quote
    if (Date.now() - todoQuoteScrolledAt < 400) return; // just scrolled inside a long quote — don't also cycle it
    AITreeQuoteEngine.religionFeature.cycleRandom();
    uiEls.todoQuote.classList.remove('pulse');
    void uiEls.todoQuote.offsetWidth;
    uiEls.todoQuote.classList.add('pulse');
    renderDailyQuote();
    if (typeof adjustTodoPosition === 'function') adjustTodoPosition();
  }

  if (uiEls.todoQuoteTab) {
    uiEls.todoQuoteTab.addEventListener('click', toggleQuoteCollapse);
  }
  // Left-click on the verse body itself cycles to a new random verse (previously this was right-click only)
  if (uiEls.todoQuoteBody) {
    uiEls.todoQuoteBody.addEventListener('click', cycleToRandomQuote);
  }

  // برای متن‌های بلندِ گنجینه که خودشان اسکرول می‌شوند: تا ۴۰۰ میلی‌ثانیه بعد از
  // اسکرول، کلیک روی بدنه باعث چرخش به نقل‌قول بعدی نشود — دقیقاً همان الگویی که
  // برای سوایپِ تعویضِ منبع هم استفاده شده.
  let todoQuoteScrolledAt = 0;
  if (uiEls.todoQuoteBody) {
    uiEls.todoQuoteBody.addEventListener('scroll', () => { todoQuoteScrolledAt = Date.now(); }, { passive: true });
  }

  let todoQuoteSwipedAt = 0;
  function switchQuoteReligion(key) {
    if (!AITreeQuoteEngine.religions[key] || key === AITreeQuoteEngine.activeReligionKey) return;
    try { if (chrome.runtime?.id) chrome.storage.local.set({ quoteReligionSource: key }); } catch (err) {}
  }
  if (uiEls.todoQuoteSourceTabs) {
    uiEls.todoQuoteSourceTabs.querySelectorAll('.ai-quote-source-tab').forEach((btn) => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); switchQuoteReligion(btn.dataset.key); });
    });
  }
  attachQuoteSwipe(
    uiEls.todoQuoteBody,
    () => Object.keys(AITreeQuoteEngine.religions),
    () => AITreeQuoteEngine.activeReligionKey,
    switchQuoteReligion,
    (ts) => { todoQuoteSwipedAt = ts; }
  );

  function buildDailyQuoteCopyText() {
    const q = AITreeQuoteEngine.religionFeature.current();
    if (!q) return '';
    const lines = [];
    if (q.text) lines.push(q.text);
    const translation = quoteText(q);
    if (translation) lines.push(translation);
    const ref = quoteRef(q);
    if (ref) lines.push(ref);
    return lines.join('\n\n');
  }

  function copyQuoteText(text, btn) {
    if (!text || !String(text).trim()) return;
    const finish = () => {
      showToastNotification(t('quoteCopied') || t('toastCopied'));
      if (btn) {
        btn.classList.add('is-copied');
        setTimeout(() => btn.classList.remove('is-copied'), 1200);
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(finish).catch(() => {
        try { fallbackCopyText(text); } catch (e) { finish(); }
      });
    } else {
      try { fallbackCopyText(text); } catch (e) { finish(); }
    }
  }

  if (uiEls.todoQuoteCopy) {
    uiEls.todoQuoteCopy.title = t('quoteCopyTitle');
    uiEls.todoQuoteCopy.setAttribute('aria-label', t('quoteCopyTitle'));
    uiEls.todoQuoteCopy.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      copyQuoteText(buildDailyQuoteCopyText(), uiEls.todoQuoteCopy);
    });
  }

  // === Rumi couplet toggle for the clock/calendar panel — same sun/moon pattern as the Quran ===
  // Difference: the Quran quote is single-language (Arabic) always; this one is bilingual —
  // only the Persian text shows in fa mode, only the English translation shows in en mode.
  let isRumiCollapsed = true; // Hidden by default, same as the Quran tab

  function renderRumiQuote() {
    const q = AITreeQuoteEngine.poetryFeature.current();
    if (!q) return;
    const cat = AITreeQuoteEngine.poetry[AITreeQuoteEngine.activePoetryKey];
    if (uiEls.clockQuoteText) {
      uiEls.clockQuoteText.textContent = quoteText(q);
      uiEls.clockQuoteText.dir = quoteDir();
      uiEls.clockQuoteText.classList.toggle('is-fa', quoteIsRtl());
      uiEls.clockQuoteText.classList.toggle('is-en', !quoteIsRtl());
    }
    if (uiEls.clockQuoteTitle) {
      const itemRef = quoteRef(q);
      uiEls.clockQuoteTitle.textContent = itemRef ? `${cat.icon} ${itemRef}` : `${cat.icon} ${quoteCategoryLabel(cat)}`;
      uiEls.clockQuoteTitle.dir = quoteDir();
    }
    if (uiEls.clockQuote) uiEls.clockQuote.classList.toggle('is-collapsed', isRumiCollapsed);
    if (uiEls.clockQuoteChevron) uiEls.clockQuoteChevron.textContent = isRumiCollapsed ? '▼' : '▲';

    if (uiEls.clockQuoteLabel) {
      uiEls.clockQuoteLabel.textContent = isRumiCollapsed ? '🌙' : '☀️';
    }
    if (uiEls.clockQuoteTab) {
      uiEls.clockQuoteTab.title = isRumiCollapsed ? t('quoteToggleShow') : t('quoteToggleHide');
    }
    if (uiEls.clockQuoteSourceTabs) {
      uiEls.clockQuoteSourceTabs.querySelectorAll('.ai-quote-source-tab').forEach((btn) => {
        const key = btn.dataset.key;
        const pCat = AITreeQuoteEngine.poetry[key];
        btn.classList.toggle('active', key === AITreeQuoteEngine.activePoetryKey);
        if (pCat) btn.title = quoteCategoryLabel(pCat);
      });
    }
  }

  function toggleRumiQuoteCollapse(e) {
    if (e) e.stopPropagation();
    isRumiCollapsed = !isRumiCollapsed;
    renderRumiQuote();
    if (typeof adjustClockPosition === 'function') adjustClockPosition();
  }

  function cycleToRandomRumiQuote(e) {
    if (e) e.stopPropagation();
    if (isRumiCollapsed) return;
    if (Date.now() - clockQuoteSwipedAt < 400) return; // just swiped to switch source — don't also cycle the quote
    AITreeQuoteEngine.poetryFeature.cycleRandom();
    uiEls.clockQuote.classList.remove('pulse');
    void uiEls.clockQuote.offsetWidth;
    uiEls.clockQuote.classList.add('pulse');
    renderRumiQuote();
    if (typeof adjustClockPosition === 'function') adjustClockPosition();
  }

  if (uiEls.clockQuoteTab) {
    uiEls.clockQuoteTab.addEventListener('click', toggleRumiQuoteCollapse);
  }
  if (uiEls.clockQuoteBody) {
    uiEls.clockQuoteBody.addEventListener('click', cycleToRandomRumiQuote);
  }

  let clockQuoteSwipedAt = 0;
  function switchQuotePoetry(key) {
    if (!AITreeQuoteEngine.poetry[key] || key === AITreeQuoteEngine.activePoetryKey) return;
    try { if (chrome.runtime?.id) chrome.storage.local.set({ quotePoetrySource: key }); } catch (err) {}
  }
  if (uiEls.clockQuoteSourceTabs) {
    uiEls.clockQuoteSourceTabs.querySelectorAll('.ai-quote-source-tab').forEach((btn) => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); switchQuotePoetry(btn.dataset.key); });
    });
  }
  attachQuoteSwipe(
    uiEls.clockQuoteBody,
    () => Object.keys(AITreeQuoteEngine.poetry),
    () => AITreeQuoteEngine.activePoetryKey,
    switchQuotePoetry,
    (ts) => { clockQuoteSwipedAt = ts; }
  );

  function buildRumiQuoteCopyText() {
    const q = AITreeQuoteEngine.poetryFeature.current();
    if (!q) return '';
    const lines = [];
    const body = quoteText(q);
    if (body) lines.push(body);
    // Include the English rendering too (when different) for a complete shareable block —
    // English stays the most universally readable second line regardless of active app language.
    const other = currentLang === 'en' ? (q.fa || '') : (q.en || '');
    if (other && other !== body) lines.push(other);
    const cat = AITreeQuoteEngine.poetry[AITreeQuoteEngine.activePoetryKey];
    const itemRef = quoteRef(q);
    lines.push(itemRef || quoteCategoryLabel(cat));
    return lines.join('\n\n');
  }

  if (uiEls.clockQuoteCopy) {
    uiEls.clockQuoteCopy.title = t('quoteCopyTitle');
    uiEls.clockQuoteCopy.setAttribute('aria-label', t('quoteCopyTitle'));
    uiEls.clockQuoteCopy.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      copyQuoteText(buildRumiQuoteCopyText(), uiEls.clockQuoteCopy);
    });
  }
  if (typeof AITreeQuoteEngine !== 'undefined' && AITreeQuoteEngine) {
    try {
      AITreeQuoteEngine.initReligion().then(renderDailyQuote);
      AITreeQuoteEngine.initPoetry().then(renderRumiQuote);
    } catch (e) {
      try { console.warn('[AI Tree] quote engine init failed:', e); } catch (err) {}
    }
  }

  // Both motivational drawers (religious verse / poetry couplet) keep their own open/closed
  // state independent of the panels that host them, so if the user leaves one expanded
  // and its panel then closes (via its own toggle, switching to another panel, or the
  // whole widget collapsing), it would silently stay "open" underneath and reappear
  // expanded next time. These force each one back to its default collapsed/hidden state.
  function collapseDailyQuote() {
    if (!isQuoteCollapsed) { isQuoteCollapsed = true; renderDailyQuote(); }
  }
  function collapseRumiQuote() {
    if (!isRumiCollapsed) { isRumiCollapsed = true; renderRumiQuote(); }
  }
  function collapseMotivationalQuotes() {
    collapseDailyQuote();
    collapseRumiQuote();
  }

  function renderTodos() {
    pruneExpiredDailyTodos();
    renderDailyQuote();
    renderDashTodoSummary();
    const list = document.getElementById('ai-todo-list'); const countEl = document.getElementById('ai-todo-count'); list.innerHTML = '';
    const now = Date.now();
    const visibleTodos = todosData.filter(td => {
      if ((td.type || 'daily') !== activeTodoTab) return false;
      if (activeTodoTab !== 'daily') return true;
      const isTomorrow = (td.createdAt || now) >= startOfTomorrowMs(now);
      return addForTomorrow ? isTomorrow : !isTomorrow;
    });
    const pendingCount = visibleTodos.filter(td => !td.done).length; if (countEl) countEl.textContent = `${pendingCount} ${activeTodoTab === 'goal' ? t('todoGoalPending') : t('todoPending')}`;

    if (visibleTodos.length === 0) {
      const empty = document.createElement('li'); empty.className = 'ai-todo-empty';
      empty.textContent = activeTodoTab === 'daily' ? (addForTomorrow ? t('todoNoTomorrow') : t('todoNoDaily')) : t('todoNoGoals');
      list.appendChild(empty); adjustTodoPosition(); return;
    }

    visibleTodos.forEach((todo) => {
      const idx = todosData.indexOf(todo);
      const isGoal = (todo.type || 'daily') === 'goal';
      const li = document.createElement('li'); li.className = (isGoal ? 'ai-goal-item' : 'ai-todo-item') + (todo.done ? ' done' : '');
      const check = document.createElement('div'); check.className = (isGoal ? 'ai-goal-check' : 'ai-todo-check') + (todo.done ? ' checked' : '');
      if (isGoal) {
        check.innerHTML = '<span class="ai-goal-star">★</span>';
        check.classList.add('ai-goal-badge');
      }
      const text = document.createElement('span'); text.className = isGoal ? 'ai-goal-text' : 'ai-todo-text'; text.textContent = String(todo.text || '');
      const chevron = document.createElement('div'); chevron.className = isGoal ? 'ai-goal-chevron' : 'ai-todo-chevron';
      chevron.innerHTML = `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"></path></svg>`;
      chevron.style.visibility = 'hidden'; // فقط اگر متن واقعاً بریده شده باشد نمایان می‌شود (پایین‌تر، بعد از اتصال به DOM)

      const copyButton = document.createElement('div'); copyButton.className = isGoal ? 'ai-goal-copy' : 'ai-todo-copy'; copyButton.title = t('todoCopyTitle');
      copyButton.innerHTML = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
      // ویرایش با کلیک روی خودِ متن (بدون دکمهٔ جدا) — مینیمال‌تر و سریع‌تر
      text.title = t('todoEditTitle');
      text.setAttribute('role', 'button');
      text.tabIndex = 0;

      // ستارهٔ پیوند به هدف — فقط روی کارهای روزانه (orthogonal به type)
      let starButton = null;
      if (!isGoal) {
        starButton = document.createElement('div');
        starButton.className = 'ai-todo-star' + (todo.linkedGoalId ? ' on' : '');
        starButton.textContent = todo.linkedGoalId ? '★' : '☆';
        const linkedGoal = todo.linkedGoalId ? getGoalById(todo.linkedGoalId) : null;
        if (todo.linkedGoalId && linkedGoal) {
          const impact = todoImpactPct(todo);
          starButton.title = (t('todoLinkedTo') || 'Linked to') + ': ' + (linkedGoal.text || '') + ' · ' + impact + '%';
          starButton.setAttribute('data-share', impact + '%');
        } else {
          starButton.title = t('todoLinkGoal') || 'Link to a goal';
          starButton.removeAttribute('data-share');
        }
        if (todo.linkedGoalId) li.classList.add('linked');
      }
      // «انتقال به فردا/امروز» — قبلاً برای آیتم‌های فردا این دکمه اصلاً نمایش
      // داده نمی‌شد (یعنی راهی برای برگرداندنش به امروز نبود). حالا برای هر دو
      // حالت نمایش داده می‌شود و رفتار/آیکون/عنوانش بسته به وضعیتِ فعلی عوض می‌شود.
      const isScheduledTomorrow = !isGoal && (todo.createdAt || now) >= startOfTomorrowMs(now);
      const postponeButton = !isGoal ? document.createElement('div') : null;
      if (postponeButton) {
        postponeButton.className = 'ai-todo-postpone';
        postponeButton.title = isScheduledTomorrow ? t('todoMoveTodayTitle') : t('todoPostponeTitle');
        postponeButton.textContent = isScheduledTomorrow ? '↻' : '📅';
      }
      const deleteButton = document.createElement('div'); deleteButton.className = isGoal ? 'ai-goal-del' : 'ai-todo-del'; deleteButton.title = t('todoDelTitle'); deleteButton.textContent = '✕';

      const rail = document.createElement('div'); rail.className = isGoal ? 'ai-goal-rail' : 'ai-todo-rail';
      if (starButton) rail.append(starButton);
      // نشان درصد تأثیر — هویت بصری طلایی کنار ستاره
      if (!isGoal && todo.linkedGoalId) {
        const impactChip = document.createElement('button');
        impactChip.type = 'button';
        impactChip.className = 'ai-todo-impact';
        impactChip.textContent = todoImpactPct(todo) + '%';
        impactChip.title = t('todoSetImpact') || 'Set impact %';
        impactChip.addEventListener('click', (e) => {
          e.stopPropagation();
          handleStarClick(e, todo, impactChip);
        });
        rail.append(impactChip);
      }
      rail.append(copyButton);
      if (postponeButton) rail.append(postponeButton);
      rail.append(deleteButton);

      // Same single-row layout for today and tomorrow:
      // [check] [text] [optional tomorrow chip] [chevron] [action rail]
      // Rail is always on the row — never appended underneath.
      let expiry = null;
      if (!isGoal) {
        expiry = document.createElement('span');
        expiry.className = 'ai-todo-expiry';
        if (isScheduledTomorrow) {
          expiry.classList.add('scheduled');
          expiry.textContent = t('todoScheduledTomorrow');
          expiry.title = t('todoScheduledTomorrow');
          li.classList.add('is-tomorrow');
        } else {
          const remainMs = TODO_DAILY_TTL_MS - (now - (todo.createdAt || now));
          const remainH = Math.max(0, Math.floor(remainMs / 3600000));
          expiry.textContent = remainH < 1 ? t('todoExpiresSoon') : t('todoExpiresIn').replace('{h}', remainH);
        }
      }

      if (expiry && isScheduledTomorrow) {
        li.append(check, text, expiry, chevron, rail);
      } else if (isGoal) {
        // ردیف هدف: سر + نوار پیشرفت + متا (فرزندان لینک‌شده)
        const pct = computeGoalProgress(todo);
        const kids = childrenOfGoal(todo.id);
        const doneKids = kids.filter(k => k.done).length;

        const head = document.createElement('div');
        head.className = 'ai-goal-head';
        head.append(check, text, chevron, rail);

        const pctEl = document.createElement('button');
        pctEl.type = 'button';
        pctEl.className = 'ai-goal-pct' + (todo.manualProgress != null && todo.manualProgress !== '' ? ' manual' : '');
        pctEl.textContent = pct + '%';
        pctEl.title = t('todoGoalProgressEdit') || 'Click to set progress manually';
        head.insertBefore(pctEl, rail);

        const bar = document.createElement('div');
        bar.className = 'ai-goal-bar';
        const fill = document.createElement('div');
        fill.className = 'ai-goal-bar-fill';
        fill.style.width = pct + '%';
        bar.appendChild(fill);

        const meta = document.createElement('div');
        meta.className = 'ai-goal-meta';
        meta.textContent = kids.length
          ? (t('todoGoalLinkedCount') || '{d} of {n} linked').replace('{d}', doneKids).replace('{n}', kids.length)
          : (t('todoGoalNoLinked') || 'No linked tasks yet');

        li.classList.add('ai-goal-card');
        li.append(head, bar, meta);

        if (pct >= 100 && !todo.done) {
          const finish = document.createElement('button');
          finish.type = 'button';
          finish.className = 'ai-goal-finish';
          finish.textContent = t('todoGoalMarkDone') || 'Mark as done?';
          finish.addEventListener('click', (e) => {
            e.stopPropagation();
            todo.done = true;
            saveTodos();
            renderTodos();
          });
          li.appendChild(finish);
        }

        // expand children under the goal (session state)
        if (kids.length) {
          const toggleKids = (e) => {
            if (e) e.stopPropagation();
            if (expandedGoalIds.has(todo.id)) expandedGoalIds.delete(todo.id);
            else expandedGoalIds.add(todo.id);
            renderTodos();
          };
          meta.style.cursor = 'pointer';
          meta.title = t('todoGoalToggleChildren') || 'Show linked tasks';
          meta.addEventListener('click', toggleKids);
          if (expandedGoalIds.has(todo.id)) {
            const sub = document.createElement('ul');
            sub.className = 'ai-goal-children';
            kids.forEach((k) => {
              const childLi = document.createElement('li');
              childLi.className = 'ai-todo-item ai-goal-child' + (k.done ? ' done' : '') + (k.linkedGoalId ? ' linked' : '');
              const cCheck = document.createElement('div');
              cCheck.className = 'ai-todo-check' + (k.done ? ' checked' : '');
              cCheck.onclick = (ev) => { ev.stopPropagation(); toggleTodoDone(k); };
              const cText = document.createElement('span');
              cText.className = 'ai-todo-text';
              cText.textContent = k.text || '';
              cText.title = t('todoEditTitle');
              // ویرایش سریع فرزند
              cText.addEventListener('click', (ev) => {
                ev.stopPropagation();
                if (childLi.classList.contains('is-editing')) return;
                childLi.classList.add('is-editing');
                const inp = document.createElement('input');
                inp.type = 'text';
                inp.className = 'ai-todo-text-input';
                inp.value = k.text || '';
                cText.replaceWith(inp);
                inp.focus();
                inp.setSelectionRange(0, inp.value.length);
                let settled = false;
                const commit = () => {
                  if (settled) return; settled = true;
                  const nt = inp.value.trim();
                  if (nt && nt !== k.text) { k.text = nt; saveTodos(); }
                  renderTodos();
                };
                inp.addEventListener('keydown', (ke) => {
                  ke.stopPropagation();
                  if (ke.key === 'Enter') { ke.preventDefault(); commit(); }
                  else if (ke.key === 'Escape') { ke.preventDefault(); settled = true; renderTodos(); }
                });
                inp.addEventListener('blur', commit);
              });
              const cImpact = document.createElement('button');
              cImpact.type = 'button';
              cImpact.className = 'ai-todo-impact';
              cImpact.textContent = todoImpactPct(k) + '%';
              cImpact.title = t('todoSetImpact') || 'Set impact %';
              cImpact.onclick = (ev) => {
                ev.stopPropagation();
                handleStarClick(ev, k, cImpact);
              };
              const cUnlink = document.createElement('div');
              cUnlink.className = 'ai-todo-star on';
              cUnlink.textContent = '★';
              cUnlink.title = t('todoUnlinkGoal') || 'Remove link';
              cUnlink.onclick = (ev) => { ev.stopPropagation(); unlinkTaskFromGoal(k); };
              childLi.append(cCheck, cText, cImpact, cUnlink);
              sub.appendChild(childLi);
            });
            li.appendChild(sub);
          }
        }

        // ویرایش دستی درصد
        pctEl.addEventListener('click', (e) => {
          e.stopPropagation();
          if (li.classList.contains('is-editing-pct')) return;
          li.classList.add('is-editing-pct');
          const inp = document.createElement('input');
          inp.type = 'number';
          inp.min = '0';
          inp.max = '100';
          inp.className = 'ai-goal-pct-input';
          inp.value = String(pct);
          const commit = () => {
            const before = computeGoalProgress(todo);
            const v = inp.value.trim();
            todo.manualProgress = v === '' ? null : Math.max(0, Math.min(100, Number(v) || 0));
            const after = computeGoalProgress(todo);
            saveTodos();
            renderTodos();
            // One signed-delta record per real change (Enter + blur can both
            // fire; the second call sees before === after and is a no-op).
            if (after !== before && memoryGoalAware()) {
              try { AITreeMemoryEngine.archiveGoalProgress(todo, after - before); } catch (err) {}
            }
          };
          inp.addEventListener('keydown', (ke) => {
            ke.stopPropagation();
            if (ke.key === 'Enter') { ke.preventDefault(); commit(); }
            else if (ke.key === 'Escape') { ke.preventDefault(); renderTodos(); }
          });
          inp.addEventListener('blur', commit);
          pctEl.replaceWith(inp);
          inp.focus();
          inp.select();
        });
      } else {
        // Today (daily): no chip in the flex row; TTL span omitted from layout
        li.append(check, text, chevron, rail);
      }

      // کار روزانه: تیک = done (+ به‌روز کردن وزن هدف در صورت پیوند)
      // هدف: چک‌باکس فقط نشان‌دهندهٔ تزئینی است — تکمیل از طریق پیشرفت / Mark as done
      if (!isGoal) {
        check.onclick = (e) => { e.stopPropagation(); toggleTodoDone(todo); };
      } else {
        check.style.pointerEvents = 'none';
        check.setAttribute('aria-hidden', 'true');
        check.title = '';
      }
      if (starButton) {
        starButton.onclick = (e) => handleStarClick(e, todo, starButton);
      }
      copyButton.onclick = (e) => {
        e.stopPropagation();
        const finish = () => showToastNotification(t('toastTodoCopied'));
        if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(todo.text || '').then(finish).catch(finish); }
        else { finish(); }
      };
      const beginInlineEdit = (e) => {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        if (li.classList.contains('is-editing')) return; // یک ادیت هم‌زمان کافیست
        li.classList.add('is-editing');
        const input = document.createElement('input');
        input.type = 'text';
        input.className = isGoal ? 'ai-goal-text-input' : 'ai-todo-text-input';
        input.value = todo.text || '';
        input.setAttribute('aria-label', t('todoEditTitle'));
        text.replaceWith(input);
        input.focus();
        input.setSelectionRange(0, input.value.length); // انتخاب کل متن برای جایگزینی سریع

        let settled = false;
        const commit = () => {
          if (settled) return; settled = true;
          const newText = input.value.trim();
          if (newText && newText !== todo.text) {
            todo.text = newText;
            saveTodos();
          }
          renderTodos(); // چه ذخیره شده باشد چه نه، رندرِ عادی متن درست را نشان می‌دهد
        };
        const cancel = () => {
          if (settled) return; settled = true;
          renderTodos(); // بدون تغییر در todo.text — یعنی انصراف
        };

        input.addEventListener('keydown', (ev) => {
          ev.stopPropagation();
          if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
          else if (ev.key === 'Escape') { ev.preventDefault(); cancel(); }
        });
        input.addEventListener('blur', commit);
      };
      text.addEventListener('click', beginInlineEdit);
      text.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { beginInlineEdit(ev); }
      });
      if (postponeButton) {
        postponeButton.onclick = (e) => {
          e.stopPropagation();
          if (isScheduledTomorrow) {
            todo.createdAt = Date.now(); // برگرداندن به امروز
            saveTodos(); renderTodos(); showToastNotification(t('toastTodoMovedToday'));
          } else {
            const tmrw = new Date(); tmrw.setHours(24, 0, 0, 0);
            todo.createdAt = tmrw.getTime();
            saveTodos(); renderTodos(); showToastNotification(t('toastTodoPostponed'));
          }
        };
      }
      deleteButton.onclick = (e) => {
        e.stopPropagation();
        let removeIdx = -1;
        if (todo && todo.id) removeIdx = todosData.findIndex((td) => td && td.id === todo.id);
        if (removeIdx < 0) removeIdx = todosData.indexOf(todo);
        if (removeIdx < 0) {
          removeIdx = todosData.findIndex((td) =>
            td && (td.text || '') === (todo.text || '') && (td.type || 'daily') === (todo.type || 'daily')
          );
        }
        if (removeIdx < 0) return;
        const [deletedTodo] = todosData.splice(removeIdx, 1);
        if (!deletedTodo) return;
        // حذف هدف → فقط unlink فرزندان (خودشان به‌عنوان کار روزانه می‌مانند)
        if ((deletedTodo.type || 'daily') === 'goal' && deletedTodo.id) {
          todosData.forEach((td) => {
            if (td && td.linkedGoalId === deletedTodo.id) td.linkedGoalId = null;
          });
        }
        // حذف کار لینک‌شدهٔ انجام‌شده: completedWeight دست‌نخورده می‌ماند (پیشرفت حفظ می‌شود)
        // حذفِ TODو یعنی حذفِ خودِ رویدادِ ساعتیِ لینک‌شده هم — نه فقط قطعِ لینک؛
        // چون از دیدِ کاربر این ردیفِ TODو خودِ همان رویداد است، نه چیزِ جداگانه.
        // برای اینکه Undo هم درست کار کند، رویدادهای حذف‌شده را همراهِ خودِ TODو
        // در payload آندو نگه می‌داریم تا در صورتِ Undo هر دو برگردند.
        let removedLinkedEvents = [];
        if (deletedTodo.id && Array.isArray(timeEventsData)) {
          removedLinkedEvents = timeEventsData.filter((evt) => evt && evt.linkedTodoId === deletedTodo.id);
          if (removedLinkedEvents.length) {
            timeEventsData = timeEventsData.filter((evt) => !(evt && evt.linkedTodoId === deletedTodo.id));
            try { saveTimeEvents(); refreshDashUI(); if (dayEventSheetOpenIso) renderMarkEventDailyList(dayEventSheetOpenIso); } catch (err) {}
          }
        }
        saveTodos();
        renderTodos();
        if (typeof AITreeMemoryEngine !== 'undefined') {
          try {
            if (removedLinkedEvents.length) {
              // خودِ رویداد(ها) آرشیو می‌شود، نه این TODوی خودکارِ آینه‌ای — تا در
              // Today's Echo یک چیزِ واحد دوبار شمرده نشود.
              removedLinkedEvents.forEach((evt) => AITreeMemoryEngine.archiveEvent(evt, 'deleted'));
            } else if (memoryGoalAware() && deletedTodo.done && deletedTodo.memArchived) {
              // completion already archived at tick time — don't re-archive it
              // with today's timestamp
            } else {
              AITreeMemoryEngine.archiveTodo(
                deletedTodo,
                deletedTodo.done ? 'completed' : 'deleted',
                memoryGoalCtx(deletedTodo)
              );
            }
          } catch (e) {}
        }
        showToastNotification(t('toastTodoDeleted'), true);
        setUndoState('todo', { item: deletedTodo, index: removeIdx, linkedEvents: removedLinkedEvents });
      };
      list.appendChild(li);

      // فقط اگر متن واقعاً در ۲ خط جا نمی‌شود، شِورون را نشان بده و کلیک‌پذیرش کن —
      // این اندازه‌گیری باید بعد از اتصال به DOM انجام شود (قبلش scrollHeight درست نیست)
      if (text.scrollHeight - text.clientHeight > 2) {
        text.classList.add('truncatable');
        chevron.style.visibility = 'visible';
        // شِورون تنها مسئول باز/بسته کردن متن بلند است؛ کلیک روی متن = ویرایش
        const toggleExpand = (e) => { e.stopPropagation(); li.classList.toggle('expanded'); };
        chevron.addEventListener('click', toggleExpand);
      }
    });
    adjustTodoPosition(); 
  }

  setInterval(() => { if (pruneExpiredDailyTodos() && todoPanel.classList.contains('active')) renderTodos(); }, 5 * 60 * 1000);
  setInterval(() => { if (pruneExpiredDashEvents()) renderTimeline(); }, 5 * 60 * 1000);
  // rollup/فشرده‌سازیِ آرشیوِ قدیمی — خودِ تابع حداکثر یک‌بار در روز واقعاً اجرا
  // می‌شود (RETENTION_LAST_RUN_KEY داخلِ memory-engine.js)، پس صدازدنش از هر
  // تب/صفحه‌ای که این افزونه رویش فعال است بی‌خطر است.
  if (typeof AITreeMemoryEngine !== 'undefined') {
    try { AITreeMemoryEngine.runRetention(); } catch (e) {}
    setInterval(() => { try { AITreeMemoryEngine.runRetention(); } catch (e) {} }, 6 * 60 * 60 * 1000);
  }

  document.getElementById('ai-todo-add-btn').onclick = (e) => {
    e.stopPropagation(); const input = document.getElementById('ai-todo-input'); const text = input.value.trim();
    if (text) {
      let createdAt = Date.now();
      if (activeTodoTab === 'daily' && addForTomorrow) {
        const tmrw = new Date(); tmrw.setHours(24, 0, 0, 0); 
        createdAt = tmrw.getTime();
      }
      const newItem = { id: (typeof newLinkId === 'function' ? newLinkId('td') : ('td_' + Date.now().toString(36))), text, done: false, type: activeTodoTab, createdAt };
      if (activeTodoTab === 'goal') { newItem.completedWeight = 0; newItem.manualProgress = null; }
      todosData.push(newItem); input.value = ''; saveTodos(); renderTodos();
    }
  };
  document.getElementById('ai-todo-input').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') document.getElementById('ai-todo-add-btn').click(); });
  uiEls.todoTabDaily.addEventListener('click', (e) => { e.stopPropagation(); switchTodoTab('daily'); });
  uiEls.todoTabGoal.addEventListener('click', (e) => { e.stopPropagation(); switchTodoTab('goal'); });
  
  function adjustTodoPosition() {
      if (!todoPanel.classList.contains('active')) return;
      const rect = hub.getBoundingClientRect();
      const panelWidth = todoPanel.offsetWidth || 280;
      const panelHeight = todoPanel.offsetHeight || 300;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const hubCenterX = rect.left + rect.width / 2;
      const hubCenterY = rect.top + rect.height / 2;
      const GAP = 14;
      const EDGE = 12;
      let leftPos, topPos;
      if (hubCenterX > vw * 0.55) {
        leftPos = rect.left - panelWidth - GAP;
        topPos = hubCenterY - panelHeight / 2;
      } else if (hubCenterX < vw * 0.35) {
        leftPos = rect.right + GAP;
        topPos = hubCenterY - panelHeight / 2;
      } else {
        leftPos = rect.left - panelWidth - GAP;
        topPos = hubCenterY - panelHeight / 2;
        if (leftPos < EDGE) leftPos = rect.right + GAP;
      }
      if (leftPos < EDGE) leftPos = rect.right + GAP;
      if (leftPos + panelWidth > vw - EDGE) leftPos = rect.left - panelWidth - GAP;
      if (leftPos < EDGE) leftPos = EDGE;
      if (leftPos + panelWidth > vw - EDGE) leftPos = vw - panelWidth - EDGE;
      if (topPos < EDGE) topPos = EDGE;
      if (topPos + panelHeight > vh - EDGE) topPos = vh - panelHeight - EDGE;
      todoPanel.style.left = `${leftPos}px`;
      todoPanel.style.top = `${topPos}px`;
  }
  todoToggleDot.addEventListener('click', (e) => {
      if (!chrome.runtime?.id) return; e.stopPropagation(); playLauncherClick(5); closeTree(); const isActive = todoPanel.classList.contains('active'); closeAllPanelsExcept(''); 
      if (!isActive) {
        todoPanel.classList.add('active'); root.classList.add('show-todo');
        uiEls.todoTabDaily.classList.toggle('active', activeTodoTab === 'daily');
        uiEls.todoTabGoal.classList.toggle('active', activeTodoTab === 'goal');
        todoPanel.classList.toggle('goal-mode', activeTodoTab === 'goal');
        uiEls.todoInput.placeholder = activeTodoTab === 'daily' ? t('todoDailyInput') : t('todoGoalInput');
        renderTodos(); adjustTodoPosition(); setTimeout(() => document.getElementById('ai-todo-input').focus(), 50);
      } resetToggleTimeout();
  });

  function allBookmarksFlat() {
    const out = [];
    [linksData, linksData2, linksData3, linksData4].forEach((arr, hubIdx) => {
      for (let i = 0; i < arr.length; i++) {
        const link = arr[i];
        if (!link) continue;
        const hasTags = Array.isArray(link.tags) && link.tags.some(tag => String(tag).trim());
        if (link.url || String(link.label || '').trim() || String(link.description || '').trim() || hasTags) {
          out.push({ link, hub: hubIdx + 1, idx: i });
        }
      }
    });
    return out;
  }

  // === Tag Engine (V33.0) ===================================================
  // مجموعه‌ی ثابت و انتخابیِ ۱۵ دسته‌ی پرکاربرد با آیکون — این‌ها یک آرایه‌ی جدا از bookmark.tags
  // نیستند؛ صرفاً یک لایه‌ی نمایشی/میانبر روی همان تگ‌های آزادِ موجودند. کلیک روی هرکدام دقیقاً
  // معادل نوشتن دستیِ همان کلمه در فیلد تگ‌هاست — یعنی هیچ فیلد جدیدی به مدل داده اضافه نشد،
  // مهاجرت/schema جدید لازم نیست، و بوک‌مارک می‌تواند هم‌زمان چند دسته‌ی ثابت + هر تگ آزاد دیگری داشته باشد.
  // هر دسته اکنون یک برچسب برای هر ۷ زبانِ افزونه دارد (en/fa/ar/es/de/fr/ja) —
  // قبلاً فقط fa/en داشت و categoryLabel برای بقیه‌ی زبان‌ها بی‌صدا به en
  // برمی‌گشت؛ همین ناهماهنگی گزارش‌شده (بعضی زبان‌ها ترجمه، بعضی انگلیسی) بود.
  const AI_TAG_CATEGORIES = [
    { key: 'music',     icon: '🎵',  en: 'Music',            fa: 'موسیقی',           ar: 'الموسيقى',              es: 'Música',              de: 'Musik',              fr: 'Musique',            ja: '音楽',        ru: 'Музыка' },
    { key: 'movies',    icon: '🎬',  en: 'Movies & Series',  fa: 'فیلم و سریال',     ar: 'الأفلام والمسلسلات',    es: 'Películas y series',  de: 'Filme & Serien',     fr: 'Films et séries',    ja: '映画・ドラマ', ru: 'Фильмы и сериалы' },
    { key: 'shopping',  icon: '🛒',  en: 'Shopping',         fa: 'خرید',             ar: 'التسوق',                es: 'Compras',             de: 'Einkaufen',          fr: 'Achats',             ja: 'ショッピング', ru: 'Покупки' },
    { key: 'finance',   icon: '💰',  en: 'Finance',          fa: 'مالی و ارز',       ar: 'المالية والعملات',      es: 'Finanzas',            de: 'Finanzen',           fr: 'Finance',            ja: '金融',        ru: 'Финансы' },
    { key: 'social',    icon: '🌐',  en: 'Social',           fa: 'شبکه اجتماعی',     ar: 'التواصل الاجتماعي',     es: 'Redes sociales',      de: 'Soziale Netzwerke',  fr: 'Réseaux sociaux',    ja: 'ソーシャル',   ru: 'Соцсети' },
    { key: 'news',      icon: '📰',  en: 'News',             fa: 'اخبار',            ar: 'الأخبار',               es: 'Noticias',            de: 'Nachrichten',        fr: 'Actualités',         ja: 'ニュース',     ru: 'Новости' },
    { key: 'tech',      icon: '💻',  en: 'Tech',             fa: 'فناوری',           ar: 'التقنية',               es: 'Tecnología',          de: 'Technik',            fr: 'Technologie',        ja: 'テクノロジー', ru: 'Технологии' },
    { key: 'ai',        icon: '🧠',  en: 'AI',               fa: 'هوش مصنوعی',       ar: 'الذكاء الاصطناعي',      es: 'IA',                  de: 'KI',                 fr: 'IA',                 ja: 'AI',          ru: 'ИИ' },
    { key: 'games',     icon: '🎮',  en: 'Games',            fa: 'بازی',             ar: 'الألعاب',               es: 'Juegos',              de: 'Spiele',             fr: 'Jeux',               ja: 'ゲーム',       ru: 'Игры' },
    { key: 'design',    icon: '🎨',  en: 'Design',           fa: 'طراحی',            ar: 'التصميم',               es: 'Diseño',              de: 'Design',             fr: 'Design',             ja: 'デザイン',     ru: 'Дизайн' },
    { key: 'education', icon: '📚',  en: 'Education',        fa: 'آموزش',            ar: 'التعليم',               es: 'Educación',           de: 'Bildung',            fr: 'Éducation',          ja: '教育',        ru: 'Образование' },
    { key: 'tools',     icon: '🛠️', en: 'Tools',            fa: 'ابزار',            ar: 'الأدوات',               es: 'Herramientas',        de: 'Werkzeuge',          fr: 'Outils',             ja: 'ツール',       ru: 'Инструменты' },
    { key: 'cloud',     icon: '☁️', en: 'Cloud',            fa: 'ابر و هاست',       ar: 'السحابة والاستضافة',    es: 'Nube y hosting',      de: 'Cloud & Hosting',    fr: 'Cloud et hébergement', ja: 'クラウド',   ru: 'Облако и хостинг' },
    { key: 'health',    icon: '🩺',  en: 'Health',           fa: 'سلامت',            ar: 'الصحة',                 es: 'Salud',               de: 'Gesundheit',         fr: 'Santé',              ja: '健康',        ru: 'Здоровье' },
    { key: 'travel',    icon: '✈️', en: 'Travel',           fa: 'سفر',              ar: 'السفر',                 es: 'Viajes',              de: 'Reisen',             fr: 'Voyage',             ja: '旅行',        ru: 'Путешествия' }
  ];
  function categoryLabel(cat) { return (cat && cat[currentLang]) || (cat && cat.en) || ''; }

  // نرمال‌سازی یک تگ تکی: کوچک‌شونده، فاصله‌های اضافه حذف، فاصله‌های داخلی به یک فاصله.
  // جلوگیری از تفرقه‌ی "Music" / "music " / "MUSIC" به عنوان سه تگ جدا.
  function normalizeTag(raw) {
    return String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  // رشته‌ی ورودیِ کاربر (جدا‌شده با کاما) را به آرایه‌ی تگِ نرمال‌شده و بدون تکرار تبدیل می‌کند.
  function parseTagsFromInput(str) {
    return Array.from(new Set(
      String(str || '')
        .split(',')
        .map(normalizeTag)
        .filter(Boolean)
    )).slice(0, 12); // سقف ۱۲ تگ به ازای هر بوک‌مارک، برای جلوگیری از انباشت بی‌رویه
  }

  // آرایه‌ی تگ‌های ذخیره‌شده را برای نمایش داخل input فرم به رشته برمی‌گرداند.
  function formatTagsForInput(tags) {
    return Array.isArray(tags) ? tags.join(', ') : '';
  }

  // فهرست یکتای همه‌ی تگ‌های استفاده‌شده در کل بوک‌مارک‌های ۴ کهکشان — برای اتوکامپلیت آینده (Phase 3.2).
  function getAllTags() {
    const set = new Set();
    [linksData, linksData2, linksData3, linksData4].forEach(arr => {
      (arr || []).forEach(link => { (link && Array.isArray(link.tags) ? link.tags : []).forEach(tg => set.add(tg)); });
    });
    return Array.from(set).sort();
  }

  // پیشنهادِ تگ بر اساس پیشوندِ تایپ‌شده (پرکاربردترین‌ها اول از طریق شمارش ساده).
  function suggestTags(prefix) {
    const p = normalizeTag(prefix);
    if (!p) return [];
    return getAllTags().filter(tg => tg.startsWith(p)).slice(0, 6);
  }

  // رندرِ مشترکِ گرید ۱۵ آیکونِ دسته — هم در فرم افزودن/ویرایش (چندانتخابی، روی فیلد تگ)
  // و هم در پنل جستجو (تک‌انتخابی، به‌عنوان فیلتر) استفاده می‌شود؛ فقط نحوه‌ی toggle فرق دارد.
  function renderCategoryGrid(gridEl, activeKeys, onToggle) {
    gridEl.innerHTML = '';
    AI_TAG_CATEGORIES.forEach(cat => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'ai-cat-chip'; btn.title = categoryLabel(cat);
      btn.setAttribute('aria-label', categoryLabel(cat));
      btn.classList.toggle('active', activeKeys.includes(cat.key));
      btn.innerHTML = `<span class="ai-cat-chip-icon">${cat.icon}</span><span class="ai-cat-chip-label">${categoryLabel(cat)}</span>`;
      btn.addEventListener('pointerenter', (e) => {
        if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
        try { if (window.LauncherSound) LauncherSound.tagHover(cat.key); } catch (err) {}
      });
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const willSelect = !activeKeys.includes(cat.key);
        try { if (window.LauncherSound) LauncherSound.tagClick(willSelect); } catch (err) {}
        onToggle(cat.key);
      });
      gridEl.appendChild(btn);
    });
  }

  // --- نسخه‌ی فرم: چندانتخابی، مستقیماً روی فیلد آزادِ تگ‌ها عمل می‌کند ---
  function refreshFormCatGrid() {
    const active = parseTagsFromInput(uiEls.formTags.value);
    renderCategoryGrid(uiEls.formCatGrid, active, (key) => {
      const current = parseTagsFromInput(uiEls.formTags.value);
      const idx = current.indexOf(key);
      if (idx === -1) current.push(key); else current.splice(idx, 1);
      uiEls.formTags.value = formatTagsForInput(current);
      refreshFormCatGrid();
    });
  }

  uiEls.formCatToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const opening = !uiEls.formCatAccordion.classList.contains('open');
    try { if (window.LauncherSound) LauncherSound.tagClick(opening); } catch (err) {}
    uiEls.formCatAccordion.classList.toggle('open');
  });

  // --- نسخه‌ی جستجو: تک‌انتخابی (فیلتر)، کلیک دوباره روی همان آیکون فیلتر را پاک می‌کند ---
  let activeSearchCategory = null;
  function refreshSearchCatGrid() {
    renderCategoryGrid(uiEls.searchCatGrid, activeSearchCategory ? [activeSearchCategory] : [], (key) => {
      activeSearchCategory = (activeSearchCategory === key) ? null : key;
      refreshSearchCatGrid();
      renderSearchResults(uiEls.searchInput.value);
    });
  }

  uiEls.searchCatToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const opening = !uiEls.searchCatAccordion.classList.contains('open');
    try { if (window.LauncherSound) LauncherSound.tagClick(opening); } catch (err) {}
    uiEls.searchCatAccordion.classList.toggle('open');
  });

  // امتیازدهی فازیِ سبک: مچ مستقیم بالاترین امتیاز را می‌گیرد؛ در غیر این صورت
  // اگر حروف کوئری به همان ترتیب (نه لزوماً پشت‌سرهم) در متن پیدا شوند امتیاز نسبی می‌گیرد.
  function fuzzyScore(text, query) {
  text = (text || '').toLowerCase(); query = (query || '').toLowerCase();
  if (!query) return 0;
  const len = Math.min(text.length, 500);

  if (text.startsWith(query)) return 3000 - len;          // شروع متن

  let pos = text.indexOf(query);
  if (pos > -1) {
    while (pos > -1) {                                      // شروع یک کلمه
      if (pos === 0 || /[\s\-_.\/:,()|]/.test(text[pos - 1])) return 2000 - len;
      pos = text.indexOf(query, pos + 1);
    }
    return 1000 - len;                                      // جایی وسط متن
  }

  let qi = 0, score = 0, lastIdx = -1;                      // تطبیق فازی ترتیبی
  for (let i = 0; i < text.length && qi < query.length; i++) {
    if (text[i] === query[qi]) {
      score += (lastIdx === i - 1) ? 5 : 1;
      lastIdx = i; qi++;
    }
  }
  return qi === query.length ? Math.max(1, score - len * 0.1) : -1;
}
  function renderSearchResults(rawQuery) {
    const list = uiEls.searchResults; list.innerHTML = '';
    const query = (rawQuery || '').trim().toLowerCase();
    if (!query && !activeSearchCategory) { adjustSearchPosition(); return; }

    const pool = activeSearchCategory
      ? allBookmarksFlat().filter(({ link }) => Array.isArray(link.tags) && link.tags.includes(activeSearchCategory))
      : allBookmarksFlat();

    const rankedMatches = pool
      .map(({ link, hub, idx }) => {
        // بدون کوئریِ متنی (فقط فیلترِ دسته فعال است)، امتیازِ عنوان صفر می‌ماند و همه هم‌رده
        // دیده می‌شوند؛ ترتیب نهایی بر اساسِ ستاره مرتب می‌شود، نه فازی‌مچ که بی‌معنا می‌شد.
        const titleScore = fuzzyScore(link.label, query);
        const tagsStr = Array.isArray(link.tags) ? link.tags.join(' ') : '';
        const tagScore = fuzzyScore(tagsStr, query);
        const descScore = fuzzyScore(link.description, query);
        // ترتیبِ اولویتِ رتبه‌بندی: مچ در عنوان > مچ در تگ‌ها > مچ در توضیحات
        let score = -1;
        if (titleScore > -1) score = titleScore;
        else if (tagScore > -1) score = tagScore - 10000;
        else if (descScore > -1) score = descScore - 20000;
        const matchedTag = titleScore === -1 && tagScore > -1;
        const matchedDesc = titleScore === -1 && tagScore === -1 && descScore > -1;
        return { link, hub, idx, score, matchedTag, matchedDesc };
      })
      .filter(x => query ? (x.score > -1 || x.matchedTag || x.matchedDesc) : true)
      .sort((a, b) => query ? (b.score - a.score) : ((b.link.importance || 0) - (a.link.importance || 0)));

    // Keep matching fixed core slots eligible within the result cap even when ordinary
    // bookmarks have higher scores or importance. Preserve the existing ranking in display.
    const compareSearchResults = (a, b) => query
      ? (b.score - a.score)
      : ((b.link.importance || 0) - (a.link.importance || 0));
    const coreMatches = rankedMatches.filter(match => match.idx < 5);
    const otherMatches = rankedMatches.filter(match => match.idx >= 5);
    const matches = [...coreMatches, ...otherMatches.slice(0, Math.max(0, 30 - coreMatches.length))]
      .sort(compareSearchResults);

    if (matches.length === 0) {
      const empty = document.createElement('li'); empty.className = 'ai-search-empty'; empty.textContent = t('searchNoResults');
      list.appendChild(empty);
    } else {
      matches.forEach(({ link, hub, idx, matchedDesc, matchedTag }) => {
        const li = document.createElement('li'); li.className = 'ai-search-result';

        // رنگ همان تیرِ بوک‌مارک در چرخ - همیشه محاسبه می‌شود، هرگز خالی نمی‌ماند
        const colorDot = document.createElement('span'); colorDot.className = 'ai-search-result-color';
        const colorSet = colorSetForBookmark(link, idx);
        colorDot.style.background = colorSet.border; colorDot.style.boxShadow = `0 0 5px ${colorSet.glow}`;

        const fav = document.createElement('img'); fav.className = 'ai-search-result-favicon';
        if (link.url) fav.src = getFaviconUrl(link.url);
        else fav.style.display = 'none';
        fav.addEventListener('error', () => fav.style.display = 'none');

        // عنوان و توضیحات هر دو در یک خط — توضیحات داخل پرانتز و کم‌رنگ‌تر، بدون برچسبِ اضافه
        const labelWrap = document.createElement('span'); labelWrap.className = 'ai-search-result-label';
        const span = document.createElement('span'); span.className = 'ai-search-result-label-title'; span.textContent = link.label;
        labelWrap.appendChild(span);
        if (link.description) {
          const descSpan = document.createElement('span'); descSpan.className = 'ai-search-result-desc-inline';
          descSpan.textContent = ` (${link.description})`;
          labelWrap.appendChild(descSpan);
        }

        // بج کهکشان همیشه و جدا از بج ستاره نشان داده می‌شود تا هیچ‌وقت گم نشود
        const badges = document.createElement('span'); badges.className = 'ai-search-result-badges';
        const hubStr = isNewsHub(hub)
          ? t('hubNews')
          : localizeDigits(hub);
        const galaxyBadge = document.createElement('span'); galaxyBadge.className = 'ai-search-result-galaxy';
        galaxyBadge.textContent = isNewsHub(hub) ? hubStr : t('searchMetaHubOnly').replace('{hub}', hubStr);
        badges.appendChild(galaxyBadge);
        if (link.importance != null) {
          const starBadge = document.createElement('span'); starBadge.className = 'ai-search-result-stars';
          starBadge.textContent = '★'.repeat(Math.max(1, Math.min(5, link.importance)));
          badges.appendChild(starBadge);
        }
        // چیپ‌های تگ: حداکثر ۲ تگ برای جلوگیری از شلوغی هر ردیف؛ اگر مچِ فعلی از طریقِ
        // تگ بوده، همان تگِ مچ‌شده اول نشان داده می‌شود تا کاربر بفهمد چرا این نتیجه آمد.
        if (Array.isArray(link.tags) && link.tags.length > 0) {
          let shownTags = link.tags;
          if (matchedTag) {
            const hit = link.tags.find(tg => fuzzyScore(tg, query) > -1);
            if (hit) shownTags = [hit, ...link.tags.filter(tg => tg !== hit)];
          }
          shownTags.slice(0, 2).forEach(tg => {
            const tagBadge = document.createElement('span'); tagBadge.className = 'ai-search-result-tag';
            tagBadge.textContent = '#' + tg;
            tagBadge.style.setProperty('--tag-glow-color', glowColorForTag(tg));
            badges.appendChild(tagBadge);
          });
        }

        li.appendChild(colorDot); li.appendChild(fav); li.appendChild(labelWrap); li.appendChild(badges);

        // ویرایش همیشه در دسترس است. برای ۴ اسلوت ثابت (هوش مصنوعی در کهکشان ۱،
        // یا جایگاه‌های خالی پیش‌فرض در کهکشان ۲ و ۳) دکمهٔ حذف به‌جای برداشتنِ کامل آیتم،
        // آن را به‌همان روشی که فرم ویرایش انجام می‌دهد خالی می‌کند.
        const isFixedSlot = idx < 5;
        const actions = document.createElement('span'); actions.className = 'ai-search-result-actions';
        const editBtn = document.createElement('button'); editBtn.type = 'button'; editBtn.className = 'ai-search-action-btn ai-search-action-edit';
        editBtn.title = t('searchEditBtn'); editBtn.setAttribute('aria-label', t('searchEditBtn')); editBtn.textContent = '✎';
        editBtn.addEventListener('click', (e) => { e.stopPropagation(); editBookmarkFromSearch(link, hub, idx); });
        const delBtn = document.createElement('button'); delBtn.type = 'button'; delBtn.className = 'ai-search-action-btn ai-search-action-delete';
        const delTitle = isFixedSlot ? t('formClearCoreBtn') : t('searchDeleteBtn');
        delBtn.title = delTitle; delBtn.setAttribute('aria-label', delTitle); delBtn.textContent = '✕';
        delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteBookmarkFromSearch(link, hub); });
        actions.appendChild(editBtn); actions.appendChild(delBtn);
        li.appendChild(actions);

        li.addEventListener('pointerenter', (e) => {
          if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
          try { if (window.LauncherSound) LauncherSound.tagHover('result:' + (link.url || idx)); } catch (err) {}
        });
        li.addEventListener('click', (e) => {
          e.stopPropagation();
          try { if (window.LauncherSound) LauncherSound.portal(); } catch (err) {}
          if (link.url) {
            window.open(link.url, '_blank', 'noopener,noreferrer');
            closeAllPanelsExcept(''); closeTree();
          } else {
            editBookmarkFromSearch(link, hub, idx);
          }
        });
        list.appendChild(li);
      });
    }
    adjustSearchPosition();
  }

  // باز کردن فرم ویرایش برای نتیجه‌ی جستجو: ابتدا به کهکشانِ واقعیِ بوک‌مارک سوییچ می‌کنیم
  // (باگ قبلی همین بود؛ فرم همیشه از روی کهکشانِ در حالِ نمایش می‌خواند، نه کهکشانِ واقعیِ آیتم)
  function editBookmarkFromSearch(link, hubIdx, idxInHub) {
    closeAllPanelsExcept('');
    if (currentHubIndex !== hubIdx) switchHub(hubIdx);
    openEditForm(idxInHub, null);
  }

  // حذف مستقیم از نتایج جستجو، با همان الگوی Undo موجود در برنامه
  function deleteBookmarkFromSearch(link, hubIdx) {
    const arr = hubData(hubIdx);
    const pos = arr.indexOf(link);
    if (pos === -1) return;
    if (pos < 5) {
      // اسلوت ثابت — مثل فرم ویرایش، به‌جای حذف از آرایه، خالی می‌شود
      arr[pos] = { label: '', url: '', description: '', tags: [], importance: DEFAULT_IMPORTANCE };
      saveLinksAll();
      if (currentHubIndex === hubIdx) renderSpiral();
      if (typeof renderTierDots === 'function') renderTierDots();
      showToastNotification(t('toastCoreCleared'));
      renderSearchResults(uiEls.searchInput.value);
      return;
    }
    const deletedItem = arr.splice(pos, 1)[0]; deletedItem._hub = hubIdx;
    saveLinksAll();
    if (currentHubIndex === hubIdx) renderSpiral();
    if (typeof renderTierDots === 'function') renderTierDots();
    showToastNotification(t('toastDeleted'), true);
    setUndoState('bookmark', deletedItem, hubIdx);
    renderSearchResults(uiEls.searchInput.value);
  }

  function adjustSearchPosition() {
      if (!searchPanel.classList.contains('active')) return;
      const rect = hub.getBoundingClientRect(); const panelWidth = 380; const panelHeight = searchPanel.offsetHeight || 260; const vw = window.innerWidth; const vh = window.innerHeight;
      const hubCenterX = rect.left + rect.width / 2; const hubCenterY = rect.top + rect.height / 2;
      let leftPos = hubCenterX + 55; if (leftPos + panelWidth > vw - 16) leftPos = hubCenterX - panelWidth - 55;
      let topPos = hubCenterY - (panelHeight / 2); if (topPos + panelHeight > vh - 16) topPos = vh - panelHeight - 16; if (topPos < 16) topPos = 16;
      searchPanel.style.left = `${leftPos}px`; searchPanel.style.top = `${topPos}px`;
  }

  uiEls.searchInput.addEventListener('input', () => renderSearchResults(uiEls.searchInput.value));
  uiEls.searchInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); searchToggleDot.click(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const first = uiEls.searchResults.querySelector('.ai-search-result');
      if (first) first.click();
    }
  });

  // ---------------------------------------------------------------------------
  // شکاف جستجوی وب — کاملاً جدا از جستجوی بوکمارک‌ها (که بالای همین باکس است و
  // دست‌نخورده می‌ماند)، پیش‌فرض بسته/مخفی، فقط با یک تاگلِ ظریف باز می‌شود.
  // موتورهای پیش‌فرض کاملاً قابل ویرایش (نام+آدرس) هستند و کاربر می‌تواند
  // موتورهای دلخواه هم اضافه/حذف کند — همه از طریق یک فرمِ داخلیِ هم‌سبک با
  // بقیهٔ افزونه (نه window.prompt که قبلاً استفاده می‌شد و ناقص/ناهمگون بود).
  // ---------------------------------------------------------------------------
  const AI_WEB_SEARCH_ENGINES = [
    { id: 'google', label: 'Google', template: 'https://www.google.com/search?q={q}', builtIn: true },
    { id: 'bing', label: 'Bing', template: 'https://www.bing.com/search?q={q}', builtIn: true },
    { id: 'duckduckgo', label: 'DuckDuckGo', template: 'https://duckduckgo.com/?q={q}', builtIn: true },
    { id: 'brave', label: 'Brave', template: 'https://search.brave.com/search?q={q}', builtIn: true }
  ];
  const AI_WEB_SEARCH_ENGINE_DEFAULTS = AI_WEB_SEARCH_ENGINES.map((e) => ({ ...e }));
  let customWebSearchEngines = [];
  let activeWebSearchEngine = 'google';

  // حالتِ AI برایِ Google/Bing — دقیقاً همون کلیدِ ذخیره‌سازیِ webSearchModes که
  // نوارِ سرچِ New Tab (void-tab-search.js) استفاده می‌کنه، پس این تاگل و اون
  // یکی خودکار sync می‌مونن، نه دو حالتِ جداگونه.
  const WEB_SEARCH_ENGINE_MODES = {
    google: { classic: 'https://www.google.com/search?q={q}', ai: 'https://www.google.com/search?q={q}&udm=50' },
    bing: { classic: 'https://www.bing.com/search?q={q}', ai: 'https://www.bing.com/copilotsearch?q={q}' }
  };
  let webSearchModes = {};
  function webEngineHasModes(id) { return !!WEB_SEARCH_ENGINE_MODES[id]; }
  function webEngineMode(id) { return webEngineHasModes(id) && webSearchModes[id] === 'ai' ? 'ai' : 'classic'; }
  function applyWebSearchModeUI() {
    if (!uiEls.webSearchMode) return;
    const has = webEngineHasModes(activeWebSearchEngine);
    uiEls.webSearchMode.hidden = !has;
    if (!has) return;
    const isAi = webEngineMode(activeWebSearchEngine) === 'ai';
    uiEls.webSearchMode.setAttribute('aria-pressed', String(isAi));
    uiEls.webSearchMode.classList.toggle('is-ai', isAi);
    uiEls.webSearchMode.title = (typeof t === 'function' && t('webSearchAiModeTitle')) || 'AI Mode';
  }
  function toggleWebSearchMode() {
    if (!webEngineHasModes(activeWebSearchEngine)) return;
    const next = webEngineMode(activeWebSearchEngine) === 'ai' ? 'classic' : 'ai';
    // مثل New Tab: ترجیحِ AI سراسری برای هر دو موتوریه که مُد دارن، نه فقط
    // موتورِ فعلی — یه‌بار روشن‌کردن یعنی «همیشه AI را ترجیح بده».
    Object.keys(WEB_SEARCH_ENGINE_MODES).forEach((id) => { webSearchModes[id] = next; });
    try { if (chrome.runtime?.id) chrome.storage.local.set({ webSearchModes: Object.assign({}, webSearchModes) }); } catch (e) {}
    applyWebSearchModeUI();
  }

  function allWebSearchEngines() { return AI_WEB_SEARCH_ENGINES.concat(customWebSearchEngines); }
  function persistCustomWebEngines() {
    try { if (chrome.runtime?.id) chrome.storage.local.set({ webSearchCustomEngines: customWebSearchEngines }); } catch (err) {}
  }
  function persistEngineOverride(id, label, template) {
    try {
      chrome.storage.local.get(['webSearchEngineOverrides'], (data) => {
        const overrides = (data && data.webSearchEngineOverrides && typeof data.webSearchEngineOverrides === 'object') ? data.webSearchEngineOverrides : {};
        overrides[id] = { label, template };
        chrome.storage.local.set({ webSearchEngineOverrides: overrides });
      });
    } catch (err) {}
  }
  function clearEngineOverride(id) {
    try {
      chrome.storage.local.get(['webSearchEngineOverrides'], (data) => {
        const overrides = (data && data.webSearchEngineOverrides && typeof data.webSearchEngineOverrides === 'object') ? data.webSearchEngineOverrides : {};
        delete overrides[id];
        chrome.storage.local.set({ webSearchEngineOverrides: overrides });
      });
    } catch (err) {}
  }

  const WEB_SEARCH_BUILTIN_IDS = new Set(['google', 'bing', 'duckduckgo', 'brave']);
  function webEngineIconMarkup(eng) {
    if (WEB_SEARCH_BUILTIN_IDS.has(eng.id) && eng.builtIn) {
      let src = '';
      try { src = chrome.runtime.getURL('assets/engines/' + eng.id + '.svg'); } catch (e) {}
      return '<img src="' + src + '" alt="" loading="lazy" />';
    }
    // موتورِ سفارشی: بدونِ لوگویِ رسمی — یه دایرهٔ خط‌آیکونیِ ژنریک، هم‌خانواده
    // با بقیهٔ آیکون‌های stroke=currentColor این افزونه (نه یه ایموجی).
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18"/></svg>';
  }
  function renderWebSearchEngineButtons() {
    if (!uiEls.webSearchEngines) return;
    uiEls.webSearchEngines.innerHTML = '';
    allWebSearchEngines().forEach((eng) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ai-web-engine-btn';
      btn.setAttribute('aria-pressed', String(eng.id === activeWebSearchEngine));
      btn.title = eng.template;

      const iconSpan = document.createElement('span');
      iconSpan.className = 'ai-web-engine-icon';
      iconSpan.innerHTML = webEngineIconMarkup(eng);
      btn.appendChild(iconSpan);

      const labelSpan = document.createElement('span');
      labelSpan.className = 'ai-web-engine-label';
      labelSpan.textContent = eng.label;
      btn.appendChild(labelSpan);

      const editIcon = document.createElement('span');
      editIcon.className = 'ai-web-engine-edit';
      editIcon.textContent = '✎';
      editIcon.title = t('webSearchEditEngineTitle');
      editIcon.addEventListener('click', (e) => { e.stopPropagation(); openWebEngineForm(eng.id); });
      btn.appendChild(editIcon);

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        activeWebSearchEngine = eng.id;
        try { if (chrome.runtime?.id) chrome.storage.local.set({ webSearchEngine: eng.id }); } catch (err) {}
        closeWebEngineForm();
        renderWebSearchEngineButtons();
        applyWebSearchModeUI();
      });
      uiEls.webSearchEngines.appendChild(btn);
    });
  }

  function closeWebEngineForm() {
    if (uiEls.webSearchEngineForm) uiEls.webSearchEngineForm.setAttribute('hidden', '');
  }

  function openWebEngineForm(engineId) {
    if (!uiEls.webSearchEngineForm) return;
    const isNew = engineId === '__new__';
    const eng = isNew ? null : allWebSearchEngines().find((e) => e.id === engineId);
    if (!isNew && !eng) return;

    uiEls.webSearchEngineForm.dataset.editingId = engineId;
    uiEls.webSearchEngineFormName.value = isNew ? '' : eng.label;
    uiEls.webSearchEngineFormUrl.value = isNew ? '' : eng.template;
    uiEls.webSearchEngineFormName.placeholder = t('webSearchNamePlaceholder');
    uiEls.webSearchEngineFormUrl.placeholder = t('webSearchUrlPlaceholder');

    const isCustom = !isNew && !eng.builtIn;
    if (uiEls.webSearchEngineFormDelete) uiEls.webSearchEngineFormDelete.toggleAttribute('hidden', !isCustom);
    if (uiEls.webSearchEngineFormReset) uiEls.webSearchEngineFormReset.toggleAttribute('hidden', isNew || isCustom);

    uiEls.webSearchEngineForm.removeAttribute('hidden');
    setTimeout(() => uiEls.webSearchEngineFormName && uiEls.webSearchEngineFormName.focus(), 30);
  }

  if (uiEls.webSearchAddBtn) {
    uiEls.webSearchAddBtn.title = t('webSearchAddEngineTitle');
    uiEls.webSearchAddBtn.addEventListener('click', (e) => { e.stopPropagation(); openWebEngineForm('__new__'); });
  }
  if (uiEls.webSearchEngineFormCancel) {
    uiEls.webSearchEngineFormCancel.addEventListener('click', (e) => { e.stopPropagation(); closeWebEngineForm(); });
  }
  if (uiEls.webSearchEngineFormSave) {
    uiEls.webSearchEngineFormSave.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = uiEls.webSearchEngineForm.dataset.editingId;
      const isNew = id === '__new__';
      const label = (uiEls.webSearchEngineFormName.value || '').trim().slice(0, 24);
      const template = (uiEls.webSearchEngineFormUrl.value || '').trim();
      if (!label) { showToastNotification(t('webSearchNameRequired'), true); return; }
      if (!/^https?:\/\//i.test(template) || !template.includes('{q}')) {
        showToastNotification(t('webSearchUrlInvalid'), true);
        return;
      }
      if (isNew) {
        const newId = 'custom_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        customWebSearchEngines.push({ id: newId, label, template, builtIn: false });
        persistCustomWebEngines();
        activeWebSearchEngine = newId;
        try { if (chrome.runtime?.id) chrome.storage.local.set({ webSearchEngine: newId }); } catch (err) {}
      } else {
        const eng = allWebSearchEngines().find((e) => e.id === id);
        if (!eng) { closeWebEngineForm(); return; }
        eng.label = label;
        eng.template = template;
        if (eng.builtIn) persistEngineOverride(id, label, template);
        else persistCustomWebEngines();
      }
      closeWebEngineForm();
      renderWebSearchEngineButtons();
    });
  }
  if (uiEls.webSearchEngineFormDelete) {
    uiEls.webSearchEngineFormDelete.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = uiEls.webSearchEngineForm.dataset.editingId;
      customWebSearchEngines = customWebSearchEngines.filter((e2) => e2.id !== id);
      persistCustomWebEngines();
      if (activeWebSearchEngine === id) {
        activeWebSearchEngine = 'google';
        try { if (chrome.runtime?.id) chrome.storage.local.set({ webSearchEngine: 'google' }); } catch (err) {}
      }
      closeWebEngineForm();
      renderWebSearchEngineButtons();
    });
  }
  if (uiEls.webSearchEngineFormReset) {
    uiEls.webSearchEngineFormReset.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = uiEls.webSearchEngineForm.dataset.editingId;
      const def = AI_WEB_SEARCH_ENGINE_DEFAULTS.find((e2) => e2.id === id);
      const eng = AI_WEB_SEARCH_ENGINES.find((e2) => e2.id === id);
      if (def && eng) { eng.label = def.label; eng.template = def.template; }
      clearEngineOverride(id);
      closeWebEngineForm();
      renderWebSearchEngineButtons();
    });
  }

  if (uiEls.webSearchEngines) {
    try {
      chrome.storage.local.get(['webSearchEngine', 'webSearchEngineOverrides', 'webSearchCustomEngines', 'webSearchModes'], (data) => {
        const overrides = data && data.webSearchEngineOverrides;
        if (overrides && typeof overrides === 'object') {
          AI_WEB_SEARCH_ENGINES.forEach((engine) => {
            const override = overrides[engine.id];
            if (!override || typeof override !== 'object') return;
            if (typeof override.label === 'string' && override.label.trim()) engine.label = override.label.trim().slice(0, 24);
            if (typeof override.template === 'string' && /^https?:\/\//i.test(override.template) && override.template.includes('{q}')) engine.template = override.template;
          });
        }
        if (Array.isArray(data && data.webSearchCustomEngines)) {
          customWebSearchEngines = data.webSearchCustomEngines
            .filter((e) => e && typeof e.id === 'string' && typeof e.label === 'string' && typeof e.template === 'string' && /^https?:\/\//i.test(e.template) && e.template.includes('{q}'))
            .map((e) => ({ id: e.id, label: e.label.slice(0, 24), template: e.template, builtIn: false }));
        }
        if (data && data.webSearchEngine && allWebSearchEngines().some((e) => e.id === data.webSearchEngine)) {
          activeWebSearchEngine = data.webSearchEngine;
        }
        if (data && data.webSearchModes && typeof data.webSearchModes === 'object') {
          webSearchModes = Object.assign({}, data.webSearchModes);
        }
        renderWebSearchEngineButtons();
        applyWebSearchModeUI();
      });
    } catch (e) { renderWebSearchEngineButtons(); }
  }

  function runWebSearch() {
    const q = (uiEls.webSearchInput && uiEls.webSearchInput.value || '').trim();
    if (!q) return;
    const engine = allWebSearchEngines().find((e) => e.id === activeWebSearchEngine) || AI_WEB_SEARCH_ENGINES[0];
    let template = engine.template;
    if (webEngineHasModes(engine.id) && webEngineMode(engine.id) === 'ai') {
      template = WEB_SEARCH_ENGINE_MODES[engine.id].ai;
    }
    window.open(template.replace('{q}', encodeURIComponent(q)), '_blank', 'noopener');
  }

  if (uiEls.webSearchMode) {
    uiEls.webSearchMode.addEventListener('click', (e) => { e.stopPropagation(); toggleWebSearchMode(); });
  }
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.webSearchModes) {
        webSearchModes = (changes.webSearchModes.newValue && typeof changes.webSearchModes.newValue === 'object') ? changes.webSearchModes.newValue : {};
        applyWebSearchModeUI();
      }
    });
  } catch (e) {}

  if (uiEls.webSearchToggle && uiEls.webSearchDrawer) {
    uiEls.webSearchToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const opening = uiEls.webSearchDrawer.hasAttribute('hidden');
      if (opening) {
        uiEls.webSearchDrawer.removeAttribute('hidden');
        requestAnimationFrame(() => uiEls.webSearchDrawer.classList.add('is-open'));
        uiEls.webSearchToggle.setAttribute('aria-expanded', 'true');
        setTimeout(() => uiEls.webSearchInput && uiEls.webSearchInput.focus(), 60);
      } else {
        uiEls.webSearchDrawer.classList.remove('is-open');
        uiEls.webSearchToggle.setAttribute('aria-expanded', 'false');
        closeWebEngineForm();
        setTimeout(() => { if (!uiEls.webSearchDrawer.classList.contains('is-open')) uiEls.webSearchDrawer.setAttribute('hidden', ''); }, 220);
      }
    });
  }
  if (uiEls.webSearchGo) uiEls.webSearchGo.addEventListener('click', (e) => { e.stopPropagation(); runWebSearch(); });
  if (uiEls.webSearchInput) {
    uiEls.webSearchInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); runWebSearch(); }
    });
  }

  searchToggleDot.addEventListener('click', (e) => {
      if (!chrome.runtime?.id) return; e.stopPropagation(); playLauncherClick(0); closeTree(); const isActive = searchPanel.classList.contains('active'); closeAllPanelsExcept('');
      if (!isActive) {
        searchPanel.classList.add('active'); root.classList.add('show-search');
        uiEls.searchInput.value = ''; activeSearchCategory = null;
        uiEls.searchCatAccordion.classList.add('open');
        refreshSearchCatGrid();
        renderSearchResults(''); adjustSearchPosition();
        setTimeout(() => uiEls.searchInput.focus(), 50);
      }
      resetToggleTimeout();
  });

  function renderTierDots() {
      tierDotsNav.innerHTML = '';
      for (let i = 0; i < MAX_LAYERS; i++) {
        const ring = RING_CONFIG[i];
        const dot = document.createElement('div'); dot.className = 'tier-dot' + (isOpen && !showAllOverride && i === currentLayerMode ? ' active' : '');
        dot.title = ringTooltipLabel(ring);
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          showAllOverride = false; root.classList.remove('show-all-active');
          if (!isOpen) { closeAllPanelsExcept(''); isOpen = true; root.classList.add('open'); }
          if (currentLayerMode === i) { resetToggleTimeout(); resetAutoCollapseTimer(); return; }
          currentLayerMode = i;
          let nextLabel = ring.labelKey ? t(ring.labelKey) : ring.label;
          setHubLabel(nextLabel); renderSpiral(); resetToggleTimeout(); resetAutoCollapseTimer();
        });
        tierDotsNav.appendChild(dot);
      }
      adjustDotsNavPosition(); syncDotsVisibility();
  }

  function renderHubDots() {
      hubDotsNav.innerHTML = '';
      for (let i = 1; i <= HUB_COUNT; i++) {
        const dot = document.createElement('div');
        dot.className = 'hub-dot' + (i === currentHubIndex ? ' active' : '') + (isNewsHub(i) ? ' hub-dot-news' : '');
        dot.title = i === 1 ? t('hubDotHome') : (isNewsHub(i) ? t('hubDotNews') : t('hubDotTitle').replace('{n}', i - 1));
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          if (i === currentHubIndex) { resetToggleTimeout(); resetAutoCollapseTimer(); return; }
          hubNavDirection = i > currentHubIndex ? 'forward' : 'backward';
          switchHub(i);
          resetToggleTimeout(); resetAutoCollapseTimer();
        });
        hubDotsNav.appendChild(dot);
      }
      adjustHubDotsPosition(); syncHubDotsVisibility();
  }

  function adjustHubDotsPosition() {
      const rect = hub.getBoundingClientRect(); const navWidth = hubDotsNav.offsetWidth || 40;
      let leftPos = rect.left + (rect.width / 2) - (navWidth / 2);
      leftPos = Math.max(8, Math.min(leftPos, window.innerWidth - navWidth - 8));
      // Prefer above the hub so it doesn't collide with the tier-dots row below.
      // فاصله از ۲۶ به ۳۸ افزایش یافت: هندل فاصله‌گذاری (ai-spacing-arc) وقتی در حال کشیده‌شدن است
      // برچسب مقدار را تا حدود ۳۰px بالاتر از لبهٔ هاب نشان می‌دهد؛ با ۳۸px همیشه فاصلهٔ امن دارد.
      let topPos = rect.top - 38;
      if (topPos < 8) topPos = rect.bottom + 10;
      hubDotsNav.style.left = `${leftPos}px`; hubDotsNav.style.top = `${topPos}px`;
  }

  function syncHubDotsVisibility() {
      const collapsed = hub.classList.contains('hub-collapsed');
      const shouldShow = !collapsed && isOpen && HUB_COUNT > 1;
      hubDotsNav.style.opacity = shouldShow ? '1' : '0';
      hubDotsNav.style.pointerEvents = shouldShow ? 'auto' : 'none';
  }
  new MutationObserver(syncHubDotsVisibility).observe(hub, { attributes: true, attributeFilter: ['class'] });
  [hubDotsNav].forEach(el => {
      el.addEventListener('mouseenter', () => { isHoveringWidget = true; clearTimeout(autoCollapseTimeout); clearTimeout(toggleHideTimeout); clearTimeout(treeAutoHideTimeout); });
      el.addEventListener('mousemove', () => { isHoveringWidget = true; clearTimeout(autoCollapseTimeout); clearTimeout(toggleHideTimeout); clearTimeout(treeAutoHideTimeout); });
      el.addEventListener('mouseleave', () => { isHoveringWidget = false; resetAutoCollapseTimer(); resetToggleTimeout(); });
  });

  function adjustDotsNavPosition() {
      const rect = hub.getBoundingClientRect(); const navWidth = tierDotsNav.offsetWidth || 60;
      let leftPos = rect.left + (rect.width / 2) - (navWidth / 2);
      leftPos = Math.max(8, Math.min(leftPos, window.innerWidth - navWidth - 8));
      let topPos = rect.bottom + 10;
      if (topPos + 20 > window.innerHeight) topPos = rect.top - 26;
      tierDotsNav.style.left = `${leftPos}px`; tierDotsNav.style.top = `${topPos}px`;
  }

  function syncDotsVisibility() {
      const collapsed = hub.classList.contains('hub-collapsed');
      const shouldShow = !collapsed && isOpen && currentLayerMode !== 0;
      tierDotsNav.style.opacity = shouldShow ? '1' : '0';
      tierDotsNav.style.pointerEvents = shouldShow ? 'auto' : 'none';
  }
  new MutationObserver(syncDotsVisibility).observe(hub, { attributes: true, attributeFilter: ['class'] });
  [tierDotsNav].forEach(el => {
      el.addEventListener('mouseenter', () => { isHoveringWidget = true; clearTimeout(autoCollapseTimeout); clearTimeout(toggleHideTimeout); clearTimeout(treeAutoHideTimeout); });
      el.addEventListener('mousemove', () => { isHoveringWidget = true; clearTimeout(autoCollapseTimeout); clearTimeout(toggleHideTimeout); clearTimeout(treeAutoHideTimeout); });
      el.addEventListener('mouseleave', () => { isHoveringWidget = false; resetAutoCollapseTimer(); resetToggleTimeout(); });
  });

  const calcGrid = calcPanel.querySelector('.ai-calc-grid'); const calcDisplay = calcPanel.querySelector('#calc-display'); const calcExprEl = calcPanel.querySelector('#calc-expr');
  const OPERATORS = ['+', '-', '*', '/']; const OP_SYMBOL = { '+': '+', '-': '−', '*': '×', '/': '÷' };
  const CALC_KEYS = [
    { label: 'C',  action: 'clear',   cls: 'fn' }, { label: '⌫',  action: 'back',    cls: 'fn' }, { label: '%',  action: 'percent', cls: 'fn' }, { label: '÷',  action: 'op', value: '/', cls: 'op' },
    { label: '7',  action: 'num' }, { label: '8', action: 'num' }, { label: '9', action: 'num' }, { label: '×',  action: 'op', value: '*', cls: 'op' },
    { label: '4',  action: 'num' }, { label: '5', action: 'num' }, { label: '6', action: 'num' }, { label: '−',  action: 'op', value: '-', cls: 'op' },
    { label: '1',  action: 'num' }, { label: '2', action: 'num' }, { label: '3', action: 'num' }, { label: '+',  action: 'op', value: '+', cls: 'op' },
    { label: '0',  action: 'num', wide: true }, { label: '.',  action: 'dot' }, { label: '=',  action: 'equals', cls: 'eq' }
  ];
  let calcExpr = ''; let calcHistory = ''; let isResultShown = false;
  function toDisplayString(expr) { return expr.replace(/[+\-*/]/g, (m) => OP_SYMBOL[m] || m); }
  const CALC_RESULT_FONT = { max: 30, min: 13 }; const CALC_EXPR_FONT = { max: 12, min: 9 };
  function fitTextToWidth(el, { max, min }) {
    const prevTransition = el.style.transition; el.style.transition = 'none';
    el.style.fontSize = max + 'px';
    if (el.scrollWidth <= el.clientWidth + 1) { void el.offsetWidth; el.style.transition = prevTransition; return; }
    let lo = min, hi = max, best = min;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      el.style.fontSize = mid + 'px';
      if (el.scrollWidth <= el.clientWidth + 1) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    el.style.fontSize = best + 'px';
    void el.offsetWidth; el.style.transition = prevTransition;
  }
  function updateCalcDisplay() { calcExprEl.textContent = calcHistory; calcDisplay.textContent = calcExpr === '' ? '0' : toDisplayString(calcExpr); fitTextToWidth(calcDisplay, CALC_RESULT_FONT); fitTextToWidth(calcExprEl, CALC_EXPR_FONT); }
  function evaluateExpression(expression) {
    const tokens = expression.match(/(\d+\.?\d*)|[+\-*/]/g); if (!tokens) return 0;
    const terms = []; let operator = '+'; let current = 0;
    for (let i = 0; i <= tokens.length; i++) {
      const token = tokens[i]; if (i < tokens.length && !isNaN(token)) { current = parseFloat(token); continue; }
      switch (operator) { case '+': terms.push(current); break; case '-': terms.push(-current); break; case '*': terms.push(terms.pop() * current); break; case '/': if (current === 0) throw new Error('Div0'); terms.push(terms.pop() / current); break; }
      if (i < tokens.length) operator = token;
    } return terms.reduce((sum, value) => sum + value, 0);
  }
  function clearCalc() { calcExpr = ''; calcHistory = ''; isResultShown = false; updateCalcDisplay(); }
  function backspaceCalc() { if (isResultShown) { clearCalc(); return; } calcExpr = calcExpr.slice(0, -1); updateCalcDisplay(); }
  function appendNumber(digit) { if (isResultShown || calcExpr === t('calcError')) { calcExpr = ''; calcHistory = ''; isResultShown = false; } const lastTerm = calcExpr.split(/[+\-*/]/).pop(); if (lastTerm === '0') calcExpr = calcExpr.slice(0, -1) + digit; else calcExpr += digit; updateCalcDisplay(); }
  function appendDot() { if (isResultShown || calcExpr === t('calcError')) { calcExpr = ''; calcHistory = ''; isResultShown = false; } const lastTerm = calcExpr.split(/[+\-*/]/).pop(); if (lastTerm.includes('.')) return; calcExpr += lastTerm === '' ? '0.' : '.'; updateCalcDisplay(); }
  function appendOperator(op) { if (calcExpr === '' || calcExpr === t('calcError')) { if (op === '-' && calcExpr === '') { calcExpr = '-'; updateCalcDisplay(); } return; } if (isResultShown) { isResultShown = false; calcHistory = ''; calcExpr += op; updateCalcDisplay(); return; } const lastChar = calcExpr.slice(-1); calcExpr = OPERATORS.includes(lastChar) ? calcExpr.slice(0, -1) + op : calcExpr + op; updateCalcDisplay(); }
  function applyPercent() { if (calcExpr === '' || calcExpr === t('calcError')) return; const match = calcExpr.match(/(\d+\.?\d*)$/); if (!match) return; const percentValue = (parseFloat(match[0]) / 100).toString(); calcExpr = calcExpr.slice(0, -match[0].length) + percentValue; updateCalcDisplay(); }
  function calcEquals() { let sanitized = calcExpr.replace(/[^-\d/*+.]/g, '').replace(/[+\-*/.]+$/, ''); if (!sanitized) return; try { const result = evaluateExpression(sanitized); if (!isFinite(result)) throw new Error('Inv'); calcHistory = `${toDisplayString(calcExpr)} =`; calcExpr = (Math.round(result * 1e8) / 1e8).toString(); } catch { calcHistory = ''; calcExpr = t('calcError'); } isResultShown = true; updateCalcDisplay(); }
  CALC_KEYS.forEach(key => {
    const b = document.createElement('div'); b.className = 'ai-calc-btn' + (key.cls ? ` ${key.cls}` : '') + (key.wide ? ' wide' : ''); b.textContent = key.label;
    b.onclick = (e) => {
      e.stopPropagation();
      try {
        if (window.LauncherSound && typeof LauncherSound.calc === 'function') {
          if (key.action === 'num') LauncherSound.calc('num', key.label);
          else if (key.action === 'op') LauncherSound.calc('op', key.value);
          else LauncherSound.calc(key.action);
        }
      } catch (err) {}
      switch (key.action) {
        case 'clear': clearCalc(); break;
        case 'back': backspaceCalc(); break;
        case 'percent': applyPercent(); break;
        case 'op': appendOperator(key.value); break;
        case 'dot': appendDot(); break;
        case 'equals': calcEquals(); break;
        case 'num': appendNumber(key.label); break;
      }
    };
    calcGrid.appendChild(b);
  });
  document.addEventListener('keydown', (e) => {
    if (!calcPanel.classList.contains('active')) return;
    if (/^[0-9]$/.test(e.key)) appendNumber(e.key); else if (OPERATORS.includes(e.key)) appendOperator(e.key); else if (e.key === '.') appendDot(); else if (e.key === '%') applyPercent(); else if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); calcEquals(); } else if (e.key === 'Backspace') backspaceCalc(); else if (e.key === 'Escape') clearCalc();
  });
  function adjustCalcPosition() {
      if (!calcPanel.classList.contains('active')) return;
      const rect = calcToggleDot.getBoundingClientRect(); const panelWidth = 240; const panelHeight = calcPanel.offsetHeight || 300; const vw = window.innerWidth; const vh = window.innerHeight;
      let leftPos = rect.right + 30; if (leftPos + panelWidth > vw - 16) leftPos = rect.left - panelWidth - 30; 
      let topPos = rect.top - (panelHeight / 2); if (topPos + panelHeight > vh - 16) topPos = vh - panelHeight - 16; if (topPos < 16) topPos = 16;
      calcPanel.style.left = `${leftPos}px`; calcPanel.style.top = `${topPos}px`;
  }
  calcToggleDot.addEventListener('click', (e) => {
      e.stopPropagation(); playLauncherClick(6); closeTree(); const isActive = calcPanel.classList.contains('active'); closeAllPanelsExcept(''); 
      if (!isActive) { calcPanel.classList.add('active'); root.classList.add('show-calc'); clearCalc(); adjustCalcPosition(); } resetToggleTimeout();
  });

  function showToastNotification(text, isError = false) {
    toastBox.textContent = text; toastBox.style.borderColor = isError ? "#EF4444" : "#10B981";
    toastBox.style.boxShadow = isError ? "0 8px 32px rgba(239, 68, 68, 0.3)" : "0 8px 32px rgba(16, 185, 129, 0.3)";
    toastBox.classList.add('show'); setTimeout(() => { toastBox.classList.remove('show'); }, 2500);
  }
  window.addEventListener('voidmusic:other-tab-playing', () => {
    showToastNotification(typeof t === 'function' ? (t('voidMusicAlreadyPlaying') || 'Music is already playing in another tab.') : 'Music is already playing in another tab.');
  });

  const uiToggles = ['ai-todo-toggle', 'ai-search-toggle', 'ai-note-toggle', 'ai-all-toggle', 'ai-collapse-toggle', 'ai-undo-toggle', 'ai-calc-hub-toggle', 'ai-clock-toggle', 'ai-spacing-arc', 'ai-spacing-thumb', 'ai-spacing-value'];

  let globalUndoTimeout = null; let pendingUndoState = { type: null, data: null, hub: 1 };
  /**
   * Global (TTL) undo is ONLY for bookmark / todo / storage recovery.
   * Notepad text uses NotepadUndoManager (multi-step, zero-TTL, session-persisted).
   * Calling setUndoState('text', ...) is kept as a thin compatibility shim that
   * routes into the notepad stack when the manager exists.
   */
  function setUndoState(type, data, targetHub = currentHubIndex, duration = 10000) {
      if (type === 'text') {
        // Compatibility bridge → dedicated multi-step notepad memory (no TTL).
        try {
          if (typeof notepadUndo !== 'undefined' && notepadUndo && data) {
            notepadUndo.pushExternal(data);
            syncUndoToggleVisual();
            return;
          }
        } catch (err) {}
        // Fallback if manager not ready yet: still avoid expiring text history.
        pendingUndoState = { type: 'text', data, hub: targetHub };
        root.classList.remove('hide-toggles');
        undoToggleDot.classList.add('active-undo');
        clearTimeout(globalUndoTimeout);
        return;
      }
      const previousType = pendingUndoState.type;
      pendingUndoState = { type, data, hub: targetHub };
      root.classList.remove('hide-toggles');
      undoToggleDot.classList.add('active-undo');
      clearTimeout(globalUndoTimeout);
      if ((previousType === 'bookmark' || previousType === 'storage') && type !== previousType) {
        try { chrome.storage.sync.remove('lastDeletedLink'); } catch (err) {}
      }
      globalUndoTimeout = setTimeout(() => {
          // Only clear TTL-backed states; never touch notepad multi-step memory.
          if (pendingUndoState.type === type) {
            undoToggleDot.classList.remove('active-undo');
            pendingUndoState = { type: null, data: null, hub: 1 };
          }
          if (type === 'bookmark' || type === 'storage') {
            try { chrome.storage.sync.remove('lastDeletedLink'); } catch (err) {}
          }
          syncUndoToggleVisual();
      }, duration);
  }

  function syncUndoToggleVisual() {
    try {
      const ttlActive = !!(pendingUndoState && pendingUndoState.type && pendingUndoState.type !== 'text');
      const noteActive = (typeof notepadUndo !== 'undefined' && notepadUndo && notepadUndo.canUndo());
      const legacyText = !!(pendingUndoState && pendingUndoState.type === 'text');
      if (ttlActive || noteActive || legacyText) {
        root.classList.remove('hide-toggles');
        undoToggleDot.classList.add('active-undo');
      } else if (!ttlActive) {
        // Keep active-undo only when something is actually recoverable.
        if (!noteActive && !legacyText) undoToggleDot.classList.remove('active-undo');
      }
    } catch (err) {}
  }
  // =========================================================================
  // ExtensionLifecycleController — Zero-Page-Reload Soft Relaunch
  // Teardown → Hydrate from chrome.storage → Protected remount + watchdog
  // Undo toggle is dual-purpose: active-undo = restore last action;
  // idle click = soft relaunch (no location.reload).
  // =========================================================================
  const EXTENSION_ROOT_IDS = [
    'ai-orbit-root',
    'ai-inline-form',
    'ai-quick-note-form',
    'ai-calc-panel',
    'ai-clock-panel',
    'ai-todo-panel',
    'ai-search-panel',
    'ai-tier-dots',
    'ai-hub-dots',
    'ai-star-editor-popup'
  ];

  class ExtensionLifecycleController {
    constructor() {
      this.activeTimers = new Set();
      this.activeIntervals = new Set();
      this.domWatchdog = null;
      this.isRelaunching = false;
      this._clockRegistered = false;
    }

    registerTimer(id) {
      if (typeof id === 'number') this.activeTimers.add(id);
      return id;
    }
    registerInterval(id) {
      if (typeof id === 'number') this.activeIntervals.add(id);
      return id;
    }
    clearTrackedTimers() {
      this.activeTimers.forEach((id) => { try { clearTimeout(id); } catch (e) {} });
      this.activeIntervals.forEach((id) => { try { clearInterval(id); } catch (e) {} });
      this.activeTimers.clear();
      this.activeIntervals.clear();
    }

    getMountTarget() {
      return document.documentElement || document.body;
    }

    /**
     * Soft detach of extension DOM from whatever parent currently holds them.
     * Does NOT destroy in-memory element references or event listeners —
     * listeners stay bound on the same Element nodes across relaunches.
     */
    detachDomArtifacts() {
      const nodes = [
        root, inlineForm, quickNoteForm, calcPanel, clockPanel,
        todoPanel, searchPanel, tierDotsNav, hubDotsNav, toastBox, starEditorPopup
      ];
      nodes.forEach((el) => {
        try {
          if (el && el.parentNode) el.parentNode.removeChild(el);
        } catch (err) {}
      });
      // Sweep any orphaned duplicates left by SPA clones / prior bugs
      EXTENSION_ROOT_IDS.forEach((id) => {
        try {
          const el = document.getElementById(id);
          if (el && el.parentNode) el.parentNode.removeChild(el);
        } catch (err) {}
      });
      try {
        document.querySelectorAll('.ai-toast-notification').forEach((el) => {
          if (el !== toastBox && el.parentNode) el.parentNode.removeChild(el);
        });
      } catch (err) {}
    }

    attachDomArtifacts() {
      const target = this.getMountTarget();
      if (!target) return;
      const nodes = [
        root, inlineForm, quickNoteForm, calcPanel, clockPanel,
        todoPanel, searchPanel, tierDotsNav, hubDotsNav, toastBox, starEditorPopup
      ];
      nodes.forEach((el) => {
        try {
          if (el && !target.contains(el)) target.appendChild(el);
        } catch (err) {}
      });
    }

    stopWatchdog() {
      if (this.domWatchdog) {
        try { this.domWatchdog.disconnect(); } catch (err) {}
        this.domWatchdog = null;
      }
    }

    startWatchdog() {
      this.stopWatchdog();
      const self = this;
      try {
        this.domWatchdog = new MutationObserver(() => {
          // در فیدهای پُرتغییر (اسکرول بی‌نهایتِ توییتر/اینستاگرام و مشابه)، ممکنه این
          // callback صدها بار در ثانیه صدا زده بشه. به‌جای اجرای فوریِ چکِ سنگین روی هر
          // رخداد، با یک تأخیر کوتاه batch می‌کنیم و تا وقتی یک چک در انتظار است، از
          // زمان‌بندیِ چک‌های تکراری خودداری می‌کنیم — فشار روی ترد اصلی به حداقل می‌رسد
          // بدون این‌که قابلیت خودترمیمی (re-attach بعد از پاک‌شدن توسط SPA) از دست برود.
          if (self.isRelaunching || self._watchdogPending) return;
          self._watchdogPending = true;
          setTimeout(() => {
            self._watchdogPending = false;
            if (self.isRelaunching) return;
            if (!document.getElementById('ai-orbit-root')) {
              // SPA wiped our root — soft re-attach without full storage round-trip
              try { self.attachDomArtifacts(); } catch (err) {}
              try {
                root.style.display = '';
                reportLauncherVisibility();
                hub.classList.remove('hub-collapsed');
                root.classList.remove('hide-toggles');
                if (typeof resetAutoCollapseTimer === 'function') resetAutoCollapseTimer();
                if (typeof resetToggleTimeout === 'function') resetToggleTimeout();
              } catch (err) {}
            }
          }, 500);
        });
        const observeTarget = document.body || document.documentElement;
        if (observeTarget) {
          this.domWatchdog.observe(observeTarget, { childList: true, subtree: false });
        }
        // Also watch documentElement when body is the primary observe target
        if (document.documentElement && observeTarget !== document.documentElement) {
          try {
            this.domWatchdog.observe(document.documentElement, { childList: true, subtree: false });
          } catch (err) {}
        }
      } catch (err) {}
    }

    /** Clear transient UI interaction state without destroying data. */
    resetTransientUi() {
      try {
        isDragging = false;
        dragMoved = false;
        quickAddActive = false;
        quickAddFired = false;
        if (typeof closeStarEditor === 'function') closeStarEditor();
        if (typeof closeInlineForm === 'function') closeInlineForm();
        if (typeof abortNoteClosing === 'function') abortNoteClosing();
        hub.classList.remove('hub-collapsed', 'quickadd-flash');
        root.classList.remove('hide-toggles', 'dragging');
        root.style.display = '';
        reportLauncherVisibility();
        if (!root.style.left && !root.style.bottom) {
          root.style.left = WIDGET1_DEFAULT_LEFT;
          root.style.top = 'auto';
          root.style.bottom = WIDGET1_DEFAULT_BOTTOM;
        }
      } catch (err) {}
    }

    /**
     * PHASE 1 — Idempotent teardown of timers + DOM placement.
     * Event listeners remain on live Element objects (no re-bind needed).
     */
    teardown() {
      // Transient interaction timers (auto-collapse, toggle hide, undo expiry, etc.)
      try { clearTimeout(globalUndoTimeout); } catch (e) {}
      try { if (typeof autoCollapseTimeout !== 'undefined') clearTimeout(autoCollapseTimeout); } catch (e) {}
      try { if (typeof toggleHideTimeout !== 'undefined') clearTimeout(toggleHideTimeout); } catch (e) {}
      try { if (typeof treeAutoHideTimeout !== 'undefined') clearTimeout(treeAutoHideTimeout); } catch (e) {}
      try { if (typeof holdGraceTimer !== 'undefined') clearTimeout(holdGraceTimer); } catch (e) {}
      try { if (typeof noteCollapseInterval !== 'undefined') clearInterval(noteCollapseInterval); } catch (e) {}
      try { if (typeof notepadIdleTimer !== 'undefined') clearTimeout(notepadIdleTimer); } catch (e) {}
      try { if (typeof noteEditSessionTimer !== 'undefined') clearTimeout(noteEditSessionTimer); } catch (e) {}
      try { if (typeof noteDraftSaveTimer !== 'undefined') clearTimeout(noteDraftSaveTimer); } catch (e) {}
      this.clearTrackedTimers();
      this.stopWatchdog();
      this.detachDomArtifacts();
    }

    /**
     * PHASE 2 — Authoritative hydration from chrome.storage via existing loader.
     */
    async hydrateState() {
      try {
        if (typeof loadDataAndRender === 'function') {
          await Promise.resolve(loadDataAndRender());
        }
        if (typeof restoreNoteDraft === 'function') {
          await Promise.resolve(restoreNoteDraft());
        }
        // Re-load multi-step notepad history after soft relaunch
        try {
          if (typeof notepadUndo !== 'undefined' && notepadUndo && chrome.runtime?.id) {
            await new Promise((resolve) => {
              try {
                chrome.storage.local.get(['aiTreeNotepadHistory'], (res) => {
                  try {
                    if (res && res.aiTreeNotepadHistory) notepadUndo.loadFromStorage(res.aiTreeNotepadHistory);
                  } catch (e) {}
                  resolve();
                });
              } catch (e) { resolve(); }
            });
          }
        } catch (e) {}
      } catch (err) {
        console.warn('[AI Tree] hydrateState:', err);
      }
    }

    /**
     * PHASE 3 — Protected mount + restart essential intervals + watchdog.
     */
    mountProtected() {
      this.attachDomArtifacts();
      this.resetTransientUi();
      try {
        adjustNotepadPosition(); adjustCalcPosition(); adjustClockPosition();
        adjustTodoPosition(); adjustSearchPosition(); adjustDotsNavPosition(); adjustHubDotsPosition();
      } catch (err) {}
      try {
        if (typeof renderSpiral === 'function' && isOpen) renderSpiral();
        if (typeof renderTierDots === 'function') renderTierDots();
        if (typeof renderHubDots === 'function') renderHubDots();
        if (typeof updateBookmarkCount === 'function') updateBookmarkCount();
      } catch (err) {}
      // Restart clock age tick if the previous interval was cleared
      try {
        if (typeof clockAgeIntervalId === 'number') {
          clearInterval(clockAgeIntervalId);
        }
        clockAgeIntervalId = setInterval(updateClockAge, 1000);
        this.registerInterval(clockAgeIntervalId);
      } catch (err) {}
      try {
        if (typeof resetAutoCollapseTimer === 'function') resetAutoCollapseTimer();
        if (typeof resetToggleTimeout === 'function') resetToggleTimeout();
      } catch (err) {}
      this.startWatchdog();
    }

    /**
     * Complete Zero-Reload Hot Restart (typically <80ms).
     */
    async relaunchSilently(reason, opts) {
      const silent = !!(opts && opts.silent);
      if (this.isRelaunching) return;
      this.isRelaunching = true;
      try {
        this.teardown();
        await this.hydrateState();
        this.mountProtected();
        if (!silent) {
          try {
            hub.classList.add('quickadd-flash');
            setTimeout(() => hub.classList.remove('quickadd-flash'), 450);
            showToastNotification(t('toastRevived'));
          } catch (err) {}
        }
      } catch (error) {
        console.error('[AI Tree] Soft relaunch failed:', error, reason || '');
        // Best-effort recovery: ensure DOM is at least visible
        try { this.attachDomArtifacts(); this.resetTransientUi(); this.startWatchdog(); } catch (e) {}
      } finally {
        this.isRelaunching = false;
      }
    }
  }

  const lifecycle = new ExtensionLifecycleController();
  // Register the initial clock interval created at boot
  try {
    if (typeof clockAgeIntervalId === 'number') lifecycle.registerInterval(clockAgeIntervalId);
  } catch (err) {}
  lifecycle.startWatchdog();

  /** @deprecated Prefer lifecycle.relaunchSilently — kept as stable call site for watchdog & messages */
  function reviveLauncher(opts) {
    const silent = !!(opts && opts.silent);
    lifecycle.relaunchSilently(opts && opts.reason ? opts.reason : 'reviveLauncher', { silent });
  }

  undoToggleDot.addEventListener('click', (e) => {
      e.stopPropagation();
      playLauncherClick(4);
      // Hybrid priority:
      //  1) TTL-backed bookmark / todo / storage recovery (existing 10s behaviour)
      //  2) Multi-step notepad undo (zero-TTL, survives for the session)
      //  3) Idle → soft relaunch
      const undoneType = pendingUndoState && pendingUndoState.type;
      const hasTtlUndo = undoneType === 'bookmark' || undoneType === 'storage' || undoneType === 'todo';
      const hasNoteUndo = (typeof notepadUndo !== 'undefined' && notepadUndo && notepadUndo.canUndo());
      const hasLegacyText = undoneType === 'text';

      if (!hasTtlUndo && !hasNoteUndo && !hasLegacyText) {
        lifecycle.relaunchSilently('undo_idle_click', { silent: false });
        return;
      }

      if (hasTtlUndo) {
        if (undoneType === 'bookmark' || undoneType === 'storage') {
          let linkToRestore = pendingUndoState.data; let targetHub = pendingUndoState.hub;
          if (!linkToRestore) {
            chrome.storage.sync.get(['lastDeletedLink'], (res) => {
              if (res.lastDeletedLink) restoreBookmark(res.lastDeletedLink, res.lastDeletedLink._hub || targetHub);
            });
          } else {
            restoreBookmark(linkToRestore, targetHub);
          }
        } else if (undoneType === 'todo') {
          const { item, index, linkedEvents } = pendingUndoState.data || {};
          if (item) {
            const insertAt = Math.min(index ?? todosData.length, todosData.length);
            todosData.splice(insertAt, 0, item);
            saveTodos();
            if (!(Array.isArray(linkedEvents) && linkedEvents.length)) memoryOnTodoRestored(item);
            if (Array.isArray(linkedEvents) && linkedEvents.length) {
              timeEventsData = timeEventsData.concat(linkedEvents);
              try { saveTimeEvents(); refreshDashUI(); if (dayEventSheetOpenIso) renderMarkEventDailyList(dayEventSheetOpenIso); } catch (err) {}
            }
            if ((item.type || 'daily') !== activeTodoTab) switchTodoTab(item.type || 'daily');
            else if (todoPanel.classList.contains('active')) renderTodos();
            showToastNotification(t('toastRestored'));
          }
        }
        clearTimeout(globalUndoTimeout);
        pendingUndoState = { type: null, data: null, hub: 1 };
        if (undoneType === 'bookmark' || undoneType === 'storage') {
          try { chrome.storage.sync.remove('lastDeletedLink'); } catch (err) {}
        }
        syncUndoToggleVisual();
        return;
      }

      // Notepad multi-step (preferred) or legacy single text snapshot
      if (hasNoteUndo) {
        notepadUndo.undo();
        return;
      }
      if (hasLegacyText) {
        if (typeof endNoteEditSession === 'function') endNoteEditSession();
        const textState = pendingUndoState.data;
        const restoredText = typeof textState === 'string' ? textState : (textState && textState.value) || '';
        if (noteTextarea) {
          noteTextarea.value = restoredText;
          if (typeof textState === 'object' && textState) {
            if (textState.prevWidth) { quickNoteForm.style.width = textState.prevWidth; noteManuallyPositioned = true; }
            if (textState.prevHeight) { quickNoteForm.style.height = textState.prevHeight; noteManuallyPositioned = true; }
            const caret = Math.min(textState.selectionStart ?? restoredText.length, restoredText.length);
            const caretEnd = Math.min(textState.selectionEnd ?? caret, restoredText.length);
            noteTextarea.focus();
            try { noteTextarea.setSelectionRange(caret, caretEnd); } catch (err) {}
          }
        }
        quickNoteForm.classList.add('active'); root.classList.add('show-notepad');
        if (typeof updateNoteTokenMeter === 'function') updateNoteTokenMeter();
        if (typeof saveNoteDraftDebounced === 'function') saveNoteDraftDebounced();
        adjustNotepadPosition();
        showToastNotification(t('toastRestored'));
        pendingUndoState = { type: null, data: null, hub: 1 };
        syncUndoToggleVisual();
      }
  });

  function restoreBookmark(link, targetHub = 1) { 
    hubData(targetHub).push(link); 
    saveLinksAll(); 
    if (currentHubIndex !== targetHub) switchHub(targetHub); else renderSpiral(); 
    showToastNotification(t('toastRestored')); 
  }

  const spacingTrack = spacingArc.querySelector('#ai-spacing-track'); const spacingFill = spacingArc.querySelector('#ai-spacing-fill');
  const spacingThumb = spacingArc.querySelector('#ai-spacing-thumb'); const spacingValueEl = spacingArc.querySelector('#ai-spacing-value');
  const ARC_R = 42, ARC_CX = 52, ARC_CY = 10 + 42; const ARC_LEN = Math.PI * ARC_R / 2; 
  spacingTrack.style.strokeDasharray = `${ARC_LEN}`; spacingFill.style.strokeDasharray = `${ARC_LEN}`;
  let spacingSaveDebounce = null;
  const HUB_ALPHA_MIN = 0.14, HUB_ALPHA_MAX = 0.55; const HUB_BLUR_MIN = 12, HUB_BLUR_MAX = 26;

  function spacingFraction() { return Math.min(1, Math.max(0, (SPACING - MIN_SPACING) / (MAX_SPACING - MIN_SPACING))); }
  function paintSpacingArc() {
    const frac = spacingFraction(); const angleDeg = frac * 90; const rad = angleDeg * (Math.PI / 180);
    const x = ARC_CX + ARC_R * Math.cos(rad); const y = ARC_CY - ARC_R * Math.sin(rad);
    spacingThumb.style.left = `${x}px`; spacingThumb.style.top = `${y}px`; spacingFill.style.strokeDashoffset = `${ARC_LEN * (1 - frac)}`;
    spacingValueEl.textContent = Math.round(SPACING); spacingValueEl.style.left = `${x}px`; spacingValueEl.style.top = `${y - 16}px`;
    const alpha = HUB_ALPHA_MIN + frac * (HUB_ALPHA_MAX - HUB_ALPHA_MIN); const blur = HUB_BLUR_MIN + frac * (HUB_BLUR_MAX - HUB_BLUR_MIN);
    hub.style.setProperty('--hub-alpha', alpha.toFixed(2)); hub.style.setProperty('--hub-blur', `${blur.toFixed(0)}px`);
  }

  let isSpacingDragging = false;
  function spacingAngleFromPointer(clientX, clientY) {
    const rect = spacingArc.getBoundingClientRect(); const cx = rect.left + rect.width / 2; const cy = rect.top + rect.height / 2;
    const dx = clientX - cx; const dy = -(clientY - cy); let angle = Math.atan2(dy, dx) * (180 / Math.PI); return Math.min(90, Math.max(0, angle));
  }
  function applySpacingFromPointer(clientX, clientY) {
    SPACING = MIN_SPACING + (spacingAngleFromPointer(clientX, clientY) / 90) * (MAX_SPACING - MIN_SPACING);
    paintSpacingArc(); if (isOpen) renderSpiral();
    clearTimeout(spacingSaveDebounce); spacingSaveDebounce = setTimeout(() => { try { if (chrome.runtime?.id) chrome.storage.sync.set({ nodeSpacing: SPACING }); } catch (err) {} }, 400);
  }
  function startSpacingDrag(e) { e.stopPropagation(); e.preventDefault(); isSpacingDragging = true; spacingArc.classList.add('active-drag'); clearTimeout(autoCollapseTimeout); clearTimeout(toggleHideTimeout); clearTimeout(treeAutoHideTimeout); const point = e.touches ? e.touches[0] : e; applySpacingFromPointer(point.clientX, point.clientY); }
  spacingThumb.addEventListener('mousedown', startSpacingDrag); spacingTrack.addEventListener('mousedown', startSpacingDrag);
  spacingThumb.addEventListener('touchstart', startSpacingDrag, { passive: false }); spacingTrack.addEventListener('touchstart', startSpacingDrag, { passive: false });
  spacingArc.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('mousemove', (e) => { if (!isSpacingDragging) return; applySpacingFromPointer(e.clientX, e.clientY); });
  document.addEventListener('touchmove', (e) => { if (!isSpacingDragging) return; const t = e.touches[0]; applySpacingFromPointer(t.clientX, t.clientY); }, { passive: true });
  function endSpacingDrag() { if (!isSpacingDragging) return; isSpacingDragging = false; spacingArc.classList.remove('active-drag'); resetAutoCollapseTimer(); resetToggleTimeout(); }
  document.addEventListener('mouseup', endSpacingDrag); document.addEventListener('touchend', endSpacingDrag);

  function closeAllPanelsExcept(exceptStr, force) {
      if (exceptStr !== 'note') {
        if (force || !isNotePinned) {
          if (typeof exitNoteSplit === 'function') exitNoteSplit(false);
          if (typeof stopNoteTTS === 'function') stopNoteTTS();
          quickNoteForm.classList.remove('active');
          root.classList.remove('show-notepad');
          isNotePinned = false;
          if (typeof abortNoteClosing === 'function') abortNoteClosing();
          else if (typeof stopCollapseCountdown === 'function') stopCollapseCountdown();
          if (typeof applyPinVisual === 'function') applyPinVisual(false);
        }
      }
      if (exceptStr !== 'calc') { calcPanel.classList.remove('active'); root.classList.remove('show-calc'); }
      if (exceptStr !== 'clock') {
        clockPanel.classList.remove('active');
        root.classList.remove('show-clock');
        if (uiEls.markPanel) {
          uiEls.markPanel.classList.remove('active', 'side-left');
          if (uiEls.markToggle) uiEls.markToggle.classList.remove('is-open', 'is-dimmed');
          if (uiEls.markToggle) uiEls.markToggle.setAttribute('aria-expanded', 'false');
          clockPanel.classList.remove('marks-open-left');
        }
        if (uiEls.dashPanel) {
          if (typeof closeDashQuickAdd === 'function') closeDashQuickAdd();
          uiEls.dashPanel.classList.remove('active', 'side-left');
          if (uiEls.dashToggle) uiEls.dashToggle.classList.remove('is-open', 'is-dimmed');
          if (uiEls.dashToggle) uiEls.dashToggle.setAttribute('aria-expanded', 'false');
          clockPanel.classList.remove('dash-open-left');
        }
        if (typeof closeDualPicker === 'function') { try { closeDualPicker(); } catch (_) {} }
        if (typeof collapseRumiQuote === 'function') collapseRumiQuote();
      }
      if (exceptStr !== 'todo') {
        todoPanel.classList.remove('active');
        root.classList.remove('show-todo');
        if (typeof collapseDailyQuote === 'function') collapseDailyQuote();
      }
      if (exceptStr !== 'search') { searchPanel.classList.remove('active'); root.classList.remove('show-search'); }
  }

  // --------------------------------------------------------------------------
  // وقتی هر ابزاری (دفترچه، جستجو، ماشین‌حساب، ساعت، کارها) باز است، خودِ هاب
  // باید از سرِ راه کنار برود، نه اینکه پنل رویش قرار بگیرد. به‌جای دست‌کاریِ
  // مستقیمِ transform هاب (که با سیستم درگ/کولاپس/هاورِ موجود تداخل پیدا
  // می‌کند)، از همان مکانیزمِ آزموده‌شدهٔ hub-collapsed استفاده می‌شود — دقیقاً
  // همان چیزی که در جاهای دیگرِ همین فایل (مثل collapseToggleDot) قبلاً هم
  // استفاده شده. یک ناظرِ واحد روی کلاس‌های show-* که خودِ کدِ بالا از قبل روی
  // root تنظیم می‌کند، مستقل از اینکه کدام مسیر کد باعثِ باز شدنِ پنل شده.
  // --------------------------------------------------------------------------
let hubAutoCollapsedByPanel = false;
  const panelVisibilityObserver = new MutationObserver(() => {
    const isDocked = quickNoteForm.classList.contains('split-docked');
    if (isDocked) {
      if (!hub.classList.contains('hub-collapsed')) {
        hub.classList.add('hub-collapsed');
        hubAutoCollapsedByPanel = true;
      }
    } else if (hubAutoCollapsedByPanel) {
      hub.classList.remove('hub-collapsed');
      hubAutoCollapsedByPanel = false;
    }
  });
  panelVisibilityObserver.observe(quickNoteForm, { attributes: true, attributeFilter: ['class'] });

  hub.addEventListener('click', (e) => {
    if (hub.classList.contains('hub-collapsed') && hubAutoCollapsedByPanel) {
      e.stopPropagation();
      if (typeof exitNoteSplit === 'function') exitNoteSplit(false);
    }
  });
  let autoCollapseTimeout = null; const AUTO_COLLAPSE_DELAY = 5200; let isInitialReveal = true;
  let isHoveringWidget = false;
  function triggerAutoCollapse() {
    if (isNotePinned) return;
    if (!isHoveringWidget && !isDragging && !inlineForm.classList.contains('active') && !quickNoteForm.classList.contains('active') && !calcPanel.classList.contains('active') && !clockPanel.classList.contains('active') && !todoPanel.classList.contains('active') && !searchPanel.classList.contains('active')) {
      isInitialReveal = false; root.classList.remove('initial-reveal'); closeTree(); hub.classList.add('hub-collapsed');
      if (typeof collapseMotivationalQuotes === 'function') collapseMotivationalQuotes();
    }
  }
  function resetAutoCollapseTimer() { clearTimeout(autoCollapseTimeout); if (!hub.classList.contains('hub-collapsed') && !isHoveringWidget && !isNotePinned) autoCollapseTimeout = setTimeout(triggerAutoCollapse, AUTO_COLLAPSE_DELAY); }

  let toggleHideTimeout = null; let treeAutoHideTimeout = null;
  function hideToggles() {
    if (isInitialReveal || isHoveringWidget || isNotePinned) return;
    // Notepad is owned by its own idle + visual countdown system.
    // Never close it here — that raced the 5s grace and killed the ⏳ animation.
    if (quickNoteForm.classList.contains('active')) return;
    if (!todoPanel.classList.contains('active') && !calcPanel.classList.contains('active') && !clockPanel.classList.contains('active') && !searchPanel.classList.contains('active') && !undoToggleDot.classList.contains('active-undo')) {
      root.classList.add('hide-toggles');
    }
  }
  function resetToggleTimeout() {
    if (isNotePinned) return;
    root.classList.remove('hide-toggles'); clearTimeout(toggleHideTimeout);
    if (!isInitialReveal) toggleHideTimeout = setTimeout(hideToggles, 4000);
    if (isOpen) {
      clearTimeout(treeAutoHideTimeout);
      treeAutoHideTimeout = setTimeout(() => {
        if (isOpen && !isDragging && !isHoveringWidget && !inlineForm.classList.contains('active') && !isNotePinned) closeTree();
      }, 6000);
    }
  }

  [root, quickNoteForm, calcPanel, clockPanel, todoPanel, searchPanel].forEach(el => {
      el.addEventListener('mouseenter', () => {
          isHoveringWidget = true;
          clearTimeout(autoCollapseTimeout);
          clearTimeout(toggleHideTimeout);
          clearTimeout(treeAutoHideTimeout);
          if (typeof abortNoteClosing === 'function') abortNoteClosing();
      });
      el.addEventListener('mousemove', () => {
          isHoveringWidget = true;
          clearTimeout(autoCollapseTimeout);
          clearTimeout(toggleHideTimeout);
          clearTimeout(treeAutoHideTimeout);
      });
      el.addEventListener('mouseleave', () => {
          isHoveringWidget = false;
          resetAutoCollapseTimer();
          resetToggleTimeout();
          // notepad idle is handled by quickNoteForm mouseleave only
      });
  });
  document.addEventListener('click', () => { if(!hub.classList.contains('hub-collapsed')) resetAutoCollapseTimer(); });

  function adjustNotepadPosition() {
    if (!quickNoteForm.classList.contains('active')) return;
    // If user manually dragged the notepad, keep their position
    if (noteManuallyPositioned) return;

    const rect = hub.getBoundingClientRect();
    const formWidth = quickNoteForm.offsetWidth || Math.min(640, window.innerWidth - 32);
    const formHeight = quickNoteForm.offsetHeight || 180;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const hubCenterX = rect.left + rect.width / 2;
    const hubCenterY = rect.top + rect.height / 2;

    let leftPos, topPos;
    if (hubCenterX < vw * 0.33) {
      leftPos = rect.right + 24;
      topPos = hubCenterY - formHeight / 2;
    } else if (hubCenterX > vw * 0.66) {
      leftPos = rect.left - formWidth - 24;
      topPos = hubCenterY - formHeight / 2;
    } else {
      leftPos = hubCenterX - formWidth / 2;
      topPos = rect.top - formHeight - 24;
      if (topPos < 16) topPos = rect.bottom + 24;
    }

    if (leftPos < 16) leftPos = 16;
    if (leftPos + formWidth > vw - 16) leftPos = vw - formWidth - 16;
    if (topPos < 16) topPos = 16;
    if (topPos + formHeight > vh - 16) topPos = vh - formHeight - 16;

    quickNoteForm.style.left = `${leftPos}px`;
    quickNoteForm.style.top = `${topPos}px`;
  }

  let noteManuallyPositioned = false;
  let isNoteDragging = false, noteDragMoved = false;
  let noteStartX, noteStartY, noteStartLeft, noteStartTop;
  let noteSplitSide = null; // null | 'left' | 'right' | 'top' | 'bottom'
  const NOTE_SPLIT_EDGE_PX = 48;
  const NOTE_SPLIT_TOP = 0;
  const NOTE_SPLIT_BOTTOM_GAP = 48; // keep toolbar above Windows taskbar
  const NOTE_SPLIT_EDGE_GAP = 20; // fixed breathing room on BOTH sides, always — same fixed-size idea as the bottom gap.
  // Sites like X/Twitter use virtualized, custom-scrolled layouts where the page's real
  // scrollbar gutter can't be reliably measured from documentElement/body/scrollingElement
  // (their scroll container is some inner div, not the page root). Rather than trying to
  // detect the exact scrollbar width per site, just always keep a comfortably large fixed
  // gap from both edges — simple, and correct everywhere regardless of the host page's
  // internal layout quirks.
  const NOTE_SPLIT_WIDTH_DEFAULT = 380;
  let noteSplitWidth = NOTE_SPLIT_WIDTH_DEFAULT; // user-adjustable while split left/right
  // Horizontal dock (top/bottom): full width, adjustable height instead of adjustable width.
  const NOTE_HDOCK_HEIGHT_DEFAULT = 340; // "acceptable" default height requested
  const NOTE_HDOCK_MIN_H = 200;
  let noteDockHeight = NOTE_HDOCK_HEIGHT_DEFAULT; // user-adjustable while docked top/bottom

  function isNoteHDock(side) { return side === 'top' || side === 'bottom'; }

  function getNoteSplitLeftPos(side, vw, width) {
    if (side === 'left') return NOTE_SPLIT_EDGE_GAP;
    if (side === 'right') return vw - width - NOTE_SPLIT_EDGE_GAP;
    return NOTE_SPLIT_EDGE_GAP; // top/bottom: always flush to the fixed side gap
  }

  function getNoteDockTopPos(side, vh, height) {
    if (side === 'top') return NOTE_SPLIT_TOP;
    return vh - height - NOTE_SPLIT_BOTTOM_GAP; // bottom: keep the bottom edge fixed
  }

  function getNoteSplitMetrics(side) {
    const s = side || noteSplitSide;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (isNoteHDock(s)) {
      const maxH = Math.max(NOTE_HDOCK_MIN_H, Math.round(vh * 0.85));
      const height = Math.max(NOTE_HDOCK_MIN_H, Math.min(maxH, noteDockHeight || NOTE_HDOCK_HEIGHT_DEFAULT));
      const width = Math.max(NOTE_MIN_W || NOTE_SPLIT_WIDTH_DEFAULT, vw - NOTE_SPLIT_EDGE_GAP * 2);
      return { vw, vh, width, height, minH: NOTE_HDOCK_MIN_H, maxH };
    }
    const minW = (typeof NOTE_MIN_W === 'number' ? NOTE_MIN_W : NOTE_SPLIT_WIDTH_DEFAULT);
    const maxW = Math.max(minW, Math.round(vw * 0.7));
    const width = Math.max(minW, Math.min(maxW, noteSplitWidth || minW));
    const height = Math.max(280, vh - NOTE_SPLIT_TOP - NOTE_SPLIT_BOTTOM_GAP);
    return { vw, vh, width, height, minW, maxW };
  }


  function syncNoteSplitBtn() {
    const btn = document.getElementById('ai-note-split-btn');
    if (!btn) return;
    const on = !!noteSplitSide;
    btn.classList.toggle('is-active', on);
    btn.title = on ? t('splitExitTitle') : t('splitEnterTitle');
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function exitNoteSplit(keepSize) {
    if (!noteSplitSide) { syncNoteSplitBtn(); return; }
    noteSplitSide = null;
    quickNoteForm.classList.remove(
      'split-docked', 'split-left', 'split-right', 'split-top', 'split-bottom',
      'split-preview-left', 'split-preview-right', 'split-preview-top', 'split-preview-bottom'
    );
    // Return to normal open state: unpin (same as first open)
    isNotePinned = false;
    quickNoteForm.classList.remove('is-pinned');
    if (typeof applyPinVisual === 'function') applyPinVisual(false);
    if (!keepSize) {
      // Restore compact floating size near hub
      noteManuallyPositioned = false;
      if (typeof resetNoteSizeToDefault === 'function') resetNoteSizeToDefault();
      else { quickNoteForm.style.width = ''; quickNoteForm.style.height = ''; }
      if (typeof adjustNotepadPosition === 'function') adjustNotepadPosition();
      if (typeof startNotepadIdleTimer === 'function') startNotepadIdleTimer();
    }
    syncNoteSplitBtn();
  }

  function enterNoteSplit(side) {
    const isH = isNoteHDock(side);
    const { vw, vh, width, height } = getNoteSplitMetrics(side);
    noteSplitSide = side;
    if (isH) noteDockHeight = height; else noteSplitWidth = width;
    noteManuallyPositioned = true;
    // Prevent autoGrowNotepad from collapsing split height back to content size
    if (typeof noteUserResized !== 'undefined') noteUserResized = true;
    isNotePinned = true;
    if (typeof applyPinVisual === 'function') applyPinVisual(true);
    quickNoteForm.classList.add('is-pinned', 'split-docked');
    quickNoteForm.classList.toggle('split-left', side === 'left');
    quickNoteForm.classList.toggle('split-right', side === 'right');
    quickNoteForm.classList.toggle('split-top', side === 'top');
    quickNoteForm.classList.toggle('split-bottom', side === 'bottom');
    quickNoteForm.classList.remove('split-preview-left', 'split-preview-right', 'split-preview-top', 'split-preview-bottom');
    quickNoteForm.style.width = width + 'px';
    quickNoteForm.style.height = height + 'px';
    if (isH) {
      quickNoteForm.style.left = NOTE_SPLIT_EDGE_GAP + 'px';
      quickNoteForm.style.top = getNoteDockTopPos(side, vh, height) + 'px';
    } else {
      quickNoteForm.style.top = NOTE_SPLIT_TOP + 'px';
      quickNoteForm.style.left = getNoteSplitLeftPos(side, vw, width) + 'px';
    }
    syncNoteSplitBtn();
  }

  function toggleNoteSplit() {
    if (!quickNoteForm.classList.contains('active')) return;
    if (noteSplitSide) {
      exitNoteSplit(false);
      return;
    }
    // Pick whichever edge (left/right/top/bottom) the notepad currently sits closest to,
    // measured as a fraction of the viewport so top/bottom aren't unfairly favored — this way
    // a notepad parked centrally (e.g. near a centered hub) can still reach a top/bottom dock
    // with one click, not just by dragging all the way to that exact edge.
    const r = quickNoteForm.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const candidates = [
      { side: 'left', d: cx / vw },
      { side: 'right', d: 1 - cx / vw },
      { side: 'top', d: cy / vh },
      { side: 'bottom', d: 1 - cy / vh }
    ];
    candidates.sort((a, b) => a.d - b.d);
    enterNoteSplit(candidates[0].side);
  }

  function detectNoteSplitSide(rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const candidates = [
      { side: 'left', d: rect.left },
      { side: 'right', d: vw - rect.right },
      { side: 'top', d: rect.top },
      { side: 'bottom', d: vh - rect.bottom }
    ].filter(c => c.d <= NOTE_SPLIT_EDGE_PX);
    if (!candidates.length) return null;
    candidates.sort((a, b) => a.d - b.d);
    return candidates[0].side;
  }

  const noteHeaderEl = quickNoteForm.querySelector('#ai-note-header');
  if (noteHeaderEl) {
    noteHeaderEl.addEventListener('mousedown', (e) => {
      if (e.target.closest('#ai-note-pin-btn') || e.target.closest('#ai-note-split-btn') || e.target.closest('#ai-note-newtab-btn')) return;
      e.stopPropagation(); e.preventDefault();
      // Leaving split mode when user starts dragging again
      if (noteSplitSide) {
        exitNoteSplit(true);
      }
      isNoteDragging = true; noteDragMoved = false;
      noteStartX = e.clientX; noteStartY = e.clientY;
      const r = quickNoteForm.getBoundingClientRect();
      noteStartLeft = r.left; noteStartTop = r.top;
      noteHeaderEl.style.cursor = 'grabbing';
    });
  }
  document.addEventListener('mousemove', (e) => {
    if (!isNoteDragging) return;
    const dx = e.clientX - noteStartX, dy = e.clientY - noteStartY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) noteDragMoved = true;
    if (noteDragMoved) {
      noteManuallyPositioned = true;
      quickNoteForm.style.left = `${noteStartLeft + dx}px`;
      quickNoteForm.style.top = `${noteStartTop + dy}px`;
      // Edge preview while dragging
      const r = quickNoteForm.getBoundingClientRect();
      const side = detectNoteSplitSide(r);
      quickNoteForm.classList.toggle('split-preview-left', side === 'left');
      quickNoteForm.classList.toggle('split-preview-right', side === 'right');
      quickNoteForm.classList.toggle('split-preview-top', side === 'top');
      quickNoteForm.classList.toggle('split-preview-bottom', side === 'bottom');
    }
  });
  document.addEventListener('mouseup', () => {
    if (!isNoteDragging) return;
    isNoteDragging = false;
    if (noteHeaderEl) noteHeaderEl.style.cursor = 'grab';
    if (noteDragMoved && quickNoteForm.classList.contains('active')) {
      const r = quickNoteForm.getBoundingClientRect();
      const side = detectNoteSplitSide(r);
      if (side) enterNoteSplit(side);
      else {
        quickNoteForm.classList.remove('split-preview-left', 'split-preview-right', 'split-preview-top', 'split-preview-bottom');
      }
    } else {
      quickNoteForm.classList.remove('split-preview-left', 'split-preview-right', 'split-preview-top', 'split-preview-bottom');
    }
  });

  window.addEventListener('resize', () => {
    if (noteSplitSide && quickNoteForm.classList.contains('active')) {
      enterNoteSplit(noteSplitSide);
      return;
    }
    // خود-ترمیمی: اگر پنجرهٔ مرورگر (نه خودِ دفترچه) کوچک شود، دفترچهٔ آزادِ
    // موقعیت‌یافته ممکن است دیگر کامل داخل صفحه نباشد. همان کلمپِ استفاده‌شده در
    // ریسایز را یک‌بار دیگر اجرا می‌کنیم تا کلیدهای تولبار همیشه در دسترس بمانند.
    if (quickNoteForm.classList.contains('active') && noteManuallyPositioned) {
      const r = quickNoteForm.getBoundingClientRect();
      const edgeMargin = 8;
      const clampedLeft = Math.min(Math.max(r.left, edgeMargin), window.innerWidth - r.width - edgeMargin);
      const clampedTop = Math.min(Math.max(r.top, edgeMargin), window.innerHeight - r.height - edgeMargin);
      if (clampedLeft !== r.left) quickNoteForm.style.left = `${clampedLeft}px`;
      if (clampedTop !== r.top) quickNoteForm.style.top = `${clampedTop}px`;
    }
  });

  // Pin button
  // --- Smart Notepad State & Timers ---
  let noteCollapseInterval = null;
  let noteCollapseSeconds = 5;
  let notepadIdleTimer = null;
  const IDLE_GRACE_PERIOD = 5000;
  // Editable work must never disappear merely because the pointer left its bounds.
  // Explicit close and an explicit unpin continue to use their existing actions.
  const NOTE_IDLE_AUTO_CLOSE_ENABLED = false;
  const pinBtn = quickNoteForm.querySelector('#ai-note-pin-btn');
  const splitBtn = quickNoteForm.querySelector('#ai-note-split-btn');
  const newTabBtn = quickNoteForm.querySelector('#ai-note-newtab-btn');
  if (newTabBtn) {
    newTabBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      try {
        if (!chrome.runtime?.id) return;
        const flush = { savedPromptDraft: noteTextarea ? noteTextarea.value : '' };
        chrome.storage.local.set(flush, () => {
          chrome.runtime.sendMessage({ action: 'openNotepadTab' }, () => {
            // No response handler needed; swallow "no receiver" errors when SW is asleep/waking.
            void chrome.runtime.lastError;
          });
        });
      } catch (err) {}
    });
  }
  if (splitBtn) {
    splitBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      toggleNoteSplit();
    });
  }
  syncNoteSplitBtn();

  function applyPinVisual(pinned) {
    if (!pinBtn) return;
    pinBtn.classList.remove('is-counting');
    pinBtn.classList.toggle('is-pinned', !!pinned);
    pinBtn.textContent = pinned ? '📍' : '📌';
    pinBtn.title = pinned ? t('unpinTitle') : t('pinTitle');
    quickNoteForm.classList.toggle('is-pinned', !!pinned);
  }

  function startCollapseCountdown() {
    if (!pinBtn || !quickNoteForm.classList.contains('active')) return;
    clearInterval(noteCollapseInterval);
    noteCollapseSeconds = 5;
    pinBtn.classList.add('is-counting');
    pinBtn.classList.remove('is-pinned');
    pinBtn.textContent = '⏳ ' + noteCollapseSeconds + 's';
    pinBtn.title = t('pinClosingTitle');

    noteCollapseInterval = setInterval(() => {
      noteCollapseSeconds--;
      if (noteCollapseSeconds > 0) {
        pinBtn.textContent = '⏳ ' + noteCollapseSeconds + 's';
      } else {
        clearInterval(noteCollapseInterval);
        noteCollapseInterval = null;
        pinBtn.classList.remove('is-counting');
        isNotePinned = false;
        applyPinVisual(false);
        closeAllPanelsExcept('', true);
        closeTree();
        hub.classList.add('hub-collapsed');
        if (typeof collapseMotivationalQuotes === 'function') collapseMotivationalQuotes();
      }
    }, 1000);
  }

  function stopCollapseCountdown() {
    if (noteCollapseInterval) {
      clearInterval(noteCollapseInterval);
      noteCollapseInterval = null;
    }
    if (pinBtn) {
      pinBtn.classList.remove('is-counting');
      applyPinVisual(isNotePinned);
    }
  }

  function startNotepadIdleTimer() {
    clearTimeout(notepadIdleTimer);
    if (!NOTE_IDLE_AUTO_CLOSE_ENABLED) return;
    if (isNotePinned || !quickNoteForm.classList.contains('active')) return;
    // Already showing visual countdown — don't restart grace period
    if (noteCollapseInterval) return;
    notepadIdleTimer = setTimeout(() => {
      if (!isNotePinned && quickNoteForm.classList.contains('active') && !isHoveringWidget && !noteCollapseInterval) {
        startCollapseCountdown();
      }
    }, IDLE_GRACE_PERIOD);
  }

  function stopNotepadIdleTimer() {
    // Only clear the silent grace timer — do not kill an active visual countdown
    clearTimeout(notepadIdleTimer);
    notepadIdleTimer = null;
  }

  function abortNoteClosing() {
    // Full abort: idle + visual countdown (hover re-enter, typing, explicit actions)
    stopNotepadIdleTimer();
    stopCollapseCountdown();
  }

  if (pinBtn) {
    pinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (!isNotePinned) {
        isNotePinned = true;
        abortNoteClosing();
        applyPinVisual(true);
        clearTimeout(autoCollapseTimeout);
        clearTimeout(treeAutoHideTimeout);
        clearTimeout(toggleHideTimeout);
        root.classList.remove('hide-toggles');
        if (!quickNoteForm.classList.contains('active')) {
          quickNoteForm.classList.add('active');
          root.classList.add('show-notepad');
        }
      } else {
        // UNPIN: start visual countdown; ignore mousemove so it is not cancelled immediately
        isNotePinned = false;
        stopNotepadIdleTimer();
        startCollapseCountdown();
      }
    });
  }

  // mouseenter = user returned → abort closing sequence
  quickNoteForm.addEventListener('mouseenter', abortNoteClosing);
  // mousemove only resets silent idle grace, never kills countdown
  quickNoteForm.addEventListener('mousemove', stopNotepadIdleTimer);
  // Chrome resyncs :hover state with a synthetic mouseleave/mouseenter pair when a tab
  // regains visibility (e.g. returning from the standalone notepad tab, or just alt-tabbing
  // back) — this has nothing to do with the user's real cursor, so it must not start the
  // idle-close countdown. Cancel any timer it may have started and briefly ignore mouseleave.
  let noteSuppressIdleUntil = 0;
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      stopNotepadIdleTimer();
      noteSuppressIdleUntil = Date.now() + 500;
    }
  });
  quickNoteForm.addEventListener('mouseleave', () => {
    if (Date.now() < noteSuppressIdleUntil) return;
    startNotepadIdleTimer();
  });

  noteToggleDot.addEventListener('click', (e) => {
    if (!chrome.runtime?.id) return;
    e.stopPropagation();
    playLauncherClick(1);
    closeTree();
    isInitialReveal = false;
    root.classList.remove('initial-reveal');

    const isActive = quickNoteForm.classList.contains('active');
    if (isActive) {
      isNotePinned = false;
      applyPinVisual(false);
      exitNoteSplit(false);
      closeAllPanelsExcept('', true);
      abortNoteClosing();
    } else {
      closeAllPanelsExcept('note');
      quickNoteForm.classList.add('active');
      root.classList.add('show-notepad');
      noteManuallyPositioned = false;
      if (typeof resetNoteSizeToDefault === 'function') resetNoteSizeToDefault();
      else { quickNoteForm.style.width = ''; quickNoteForm.style.height = ''; }
      if (noteTextarea) {
        adjustNotepadPosition();
        setTimeout(() => {
          noteTextarea.focus();
          if (typeof autoGrowNotepad === 'function') autoGrowNotepad();
          adjustNotepadPosition();
        }, 50);
      }
      startNotepadIdleTimer();
    }
    resetToggleTimeout();
  });

  // ========== اندازه یادداشت ==========
  // باز شدن: ارتفاعِ پیش‌فرض از روی «۴ خط مرجع» محاسبه می‌شود (نه یک عدد ثابتِ حدسی)
  // تا اگر فونت/line-height بعداً عوض شد خودش هماهنگ بماند؛ عرضِ پیش‌فرض هم به‌اندازه‌ای
  // بزرگ است که ردیف دکمه‌های پایین (پاک‌کردن/کپی/متنی/اشتراک/ارسال) در یک خط جا شوند.
  // تایپ: اول ارتفاع رشد می‌کند؛ اگر محتوا حتی در حداکثر ارتفاع هم جا نشد،
  // عرض هم متناسب با میزان سرریز رشد می‌کند.
  const NOTE_MIN_W = 380;
  const NOTE_MIN_H = 360; // enough for header + templates + full bottom toolbar
  const NOTE_DEFAULT_W = 500;
  const NOTE_TA_MIN_LINES = 4; // ارتفاع پیش‌فرضِ باز شدن، معادل ۴ خط تایپ
  const NOTE_TA_MAX_LINES = 10;
  // هر خط سرریزِ فراتر از حداکثر ارتفاع، عرض کادر را همین‌قدر پیکسل بیشتر می‌کند
  const NOTE_WIDTH_PER_OVERFLOW_LINE = 26;
  // کفِ chrome (هدر+فرمت+قالب+وضعیت+تولبار+gap+padding) — اگر DOM در دسترس باشد دقیق‌تر اندازه گرفته می‌شود
  const NOTE_CHROME_H = 230;
  let noteUserResized = false;

  function noteMaxW() { return Math.round(window.innerWidth * 0.9); }
  function noteMaxH() { return Math.round(window.innerHeight * 0.9); }

  // Use the rendered box, not a requested CSS size, so padding, borders and the
  // final frame of a size transition cannot leave any part of the note off-screen.
  // قبلاً هنگام رشد خودکار اندازه، دفترچه را به مرکز مانیتور می‌کشید —
  // این جابه‌جایی ناخواسته حذف شد. فقط در صورت خروج از viewport، لبه را اصلاح می‌کنیم.
  function clampNotepadInViewport() {
    if (!quickNoteForm.classList.contains('active') || noteSplitSide) return;
    const edgeMargin = 8;
    const formW = quickNoteForm.offsetWidth;
    const formH = quickNoteForm.offsetHeight;
    if (!formW || !formH) return;
    const maxLeft = Math.max(edgeMargin, window.innerWidth - formW - edgeMargin);
    const maxTop = Math.max(edgeMargin, window.innerHeight - formH - edgeMargin);
    const curLeft = parseFloat(quickNoteForm.style.left);
    const curTop = parseFloat(quickNoteForm.style.top);
    const left = Number.isFinite(curLeft) ? curLeft : quickNoteForm.getBoundingClientRect().left;
    const top = Number.isFinite(curTop) ? curTop : quickNoteForm.getBoundingClientRect().top;
    const nextLeft = Math.max(edgeMargin, Math.min(left, maxLeft));
    const nextTop = Math.max(edgeMargin, Math.min(top, maxTop));
    if (nextLeft !== left) quickNoteForm.style.left = nextLeft + 'px';
    if (nextTop !== top) quickNoteForm.style.top = nextTop + 'px';
  }
  // نام قدیمی برای سازگاری با هر ارجاع باقی‌مانده
  function centerExpandedNotepad() { clampNotepadInViewport(); }

  function resetNoteSizeToDefault() {
    noteUserResized = false;
    quickNoteForm.style.width = '';
    quickNoteForm.style.height = '';
    if (noteTextarea) {
      noteTextarea.style.height = '';
      noteTextarea.style.minHeight = '';
    }
  }

  function measureNoteLineMetrics() {
    if (!noteTextarea) return { lineH: 21, padY: 16 };
    const cs = window.getComputedStyle(noteTextarea);
    let lineH = parseFloat(cs.lineHeight);
    if (!lineH || Number.isNaN(lineH)) lineH = (parseFloat(cs.fontSize) || 13.5) * 1.55;
    const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    return { lineH, padY };
  }

  // Measure real chrome so bottom toolbar is never clipped
  function measureNoteChromeH() {
    if (!quickNoteForm) return NOTE_CHROME_H;
    const selectors = [
      '.ai-note-header',
      '.ai-note-format-bar',
      '.ai-note-tpl-search',
      '.ai-note-tpl-bar',
      '#ai-note-tpl-editor',
      '.ai-note-status-row',
      '.ai-note-toolbar'
    ];
    let sum = 0;
    let visible = 0;
    selectors.forEach((sel) => {
      const el = quickNoteForm.querySelector(sel);
      if (!el || el.hidden) return;
      const h = el.offsetHeight || 0;
      if (h > 0) { sum += h; visible += 1; }
    });
    // form padding (~28) + flex gaps between sections
    const extras = 28 + Math.max(0, visible - 1) * 6;
    const measured = sum + extras;
    return Math.max(NOTE_CHROME_H, measured);
  }

  // ارتفاع پیش‌فرض = chrome واقعی + جای ۴ خط تایپ
  function computeNoteDefaultH() {
    const { lineH, padY } = measureNoteLineMetrics();
    const chrome = measureNoteChromeH();
    return Math.max(NOTE_MIN_H, Math.round(chrome + NOTE_TA_MIN_LINES * lineH + padY));
  }
  let NOTE_DEFAULT_H = computeNoteDefaultH();

  function autoGrowNotepad() {
    if (!noteTextarea || !quickNoteForm.classList.contains('active')) return;
    if (noteSplitSide) return; // split mode manages its own full height
    if (noteUserResized) return;

    const { lineH, padY } = measureNoteLineMetrics();
    const minTaH = Math.ceil(NOTE_TA_MIN_LINES * lineH + padY);
    // اجازه بده کادر تا نزدیک ارتفاع کامل صفحه (سقفِ noteMaxH) رشد قائم داشته باشد،
    // نه فقط تا ۱۰ خط ثابت — وگرنه بعد از آن آستانه، رشد ارتفاع متوقف و به‌جایش
    // فقط عرض زیاد می‌شد که هنگام تایپ باعث تکان‌های ناگهانی می‌شد.
    const maxTaH = Math.max(
      Math.ceil(NOTE_TA_MAX_LINES * lineH + padY),
      Math.ceil(noteMaxH() - measureNoteChromeH())
    );

    const measureScrollH = () => {
      const prevMin = noteTextarea.style.minHeight;
      const prevH = noteTextarea.style.height;
      noteTextarea.style.minHeight = minTaH + 'px';
      noteTextarea.style.height = 'auto';
      const h = noteTextarea.scrollHeight || minTaH;
      noteTextarea.style.height = prevH;
      noteTextarea.style.minHeight = prevMin;
      return h;
    };

    // فقط ارتفاع محتوا — عرض را دست نزن (جلوگیری از بزرگ شدن با چند کلمه)
    let scrollH = measureScrollH();

    const plain = (noteTextarea.value || '').replace(/\s+/g, '');
    const newlineCount = (noteTextarea.value.match(/\n/g) || []).length;

    // عرض فقط وقتی رشد می‌کند که حتی در حداکثر ارتفاعِ مجاز هم محتوا جا نشود —
    // یعنی اول کادر عمودی کشیده می‌شود، و تنها اگر باز هم کم بود، عرض هم متناسب با
    // میزان سرریز رشد می‌کند. چون عرض بیشتر یعنی متن در خط‌های کمتری می‌شکند،
    // بعد از تغییر عرض، ارتفاعِ لازم را دوباره در همان عرض جدید اندازه می‌گیریم.
    let targetFormW = NOTE_DEFAULT_W;
    if (plain && scrollH > maxTaH) {
      const overflowLines = (scrollH - maxTaH) / lineH;
      targetFormW = Math.round(NOTE_DEFAULT_W + overflowLines * NOTE_WIDTH_PER_OVERFLOW_LINE);
      targetFormW = Math.max(NOTE_DEFAULT_W, Math.min(noteMaxW(), targetFormW));
      quickNoteForm.style.width = targetFormW + 'px';
      scrollH = measureScrollH();
    }

    const contentTaH = Math.max(minTaH, Math.min(maxTaH, scrollH));
    NOTE_DEFAULT_H = computeNoteDefaultH();
    const chrome = measureNoteChromeH();
    let targetFormH = Math.round(chrome + contentTaH);
    // کف: حداقل پیش‌فرض باز شدن (با تولبار کامل)؛ سقف: max viewport
    targetFormH = Math.max(NOTE_DEFAULT_H, NOTE_MIN_H, Math.min(noteMaxH(), targetFormH));

    // اگر متن خالی یا فقط ۱–۲ خط واقعی → ارتفاع/عرض پیش‌فرض، بدون رشد اضافه
    if (!plain) {
      targetFormH = NOTE_DEFAULT_H;
      targetFormW = NOTE_DEFAULT_W;
    } else if (newlineCount === 0 && scrollH <= minTaH + 4) {
      // چند کلمه در یک خط → رشد نکن
      targetFormH = NOTE_DEFAULT_H;
    } else {
      // ==== رشد مرحله‌ای (Stepped Growth) ====
      // مشکلِ نسخهٔ قبل: پلهٔ دوم مستقیم ۶۵٪ ارتفاعِ صفحه بود، پس همین‌که محتوا
      // فقط کمی از پلهٔ اول بیشتر می‌شد (مثلاً چند خط اضافه)، کادر یک‌مرتبه به
      // نزدیک دو-سومِ کل صفحه می‌پرید — دقیقاً همان جهشِ آزاردهنده‌ای که گزارش شد.
      // حالا هر پله فقط وقتی فعال می‌شود که محتوا واقعاً در پلهٔ قبلی جا نشود،
      // نه صرفاً به‌خاطر اینکه ارتفاعِ خامِ محاسبه‌شده زیر سقفِ آن پله بوده.
      const phase1 = NOTE_DEFAULT_H;
      const phase2 = Math.max(phase1, Math.round(noteMaxH() * 0.42));
      const phase3 = Math.max(phase2, Math.round(noteMaxH() * 0.7));
      const phase4 = Math.max(phase3, noteMaxH());
      const fitsAtStage = (stageFormH) => (stageFormH - chrome) >= contentTaH - 2;
      if (fitsAtStage(phase1)) targetFormH = phase1;
      else if (fitsAtStage(phase2)) targetFormH = phase2;
      else if (fitsAtStage(phase3)) targetFormH = phase3;
      else targetFormH = phase4;
    }

    // Re-center only when automatic content growth changes a size stage. This keeps
    // normal typing stable, but makes every expansion start from a safe, visible
    // position even if the note was previously dragged near an edge.
    const previousFormW = quickNoteForm.offsetWidth;
    const previousFormH = quickNoteForm.offsetHeight;
    const computedNoteStyle = window.getComputedStyle(quickNoteForm);
    const previousRequestedW = parseFloat(quickNoteForm.style.width) || parseFloat(computedNoteStyle.width) || previousFormW;
    const previousRequestedH = parseFloat(quickNoteForm.style.height) || parseFloat(computedNoteStyle.height) || previousFormH;
    const prevTrans = quickNoteForm.style.transition;
    quickNoteForm.style.transition = 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    quickNoteForm.style.width = targetFormW + 'px';
    quickNoteForm.style.height = targetFormH + 'px';
    noteTextarea.style.minHeight = minTaH + 'px';

    // رشدِ خودکارِ ناشی از تایپ هم باید همان تضمینِ «همیشه داخل صفحه» را داشته باشد
    // که روی کشیدنِ دستیِ گوشه اعمال شده — وگرنه اگر کادر قبلاً نزدیکِ لبه جابه‌جا
    // شده بود (noteManuallyPositioned=true، پس adjustNotepadPosition زیر اجرا
    // نمی‌شود)، رشدِ حاصل از تایپِ زیاد می‌توانست از صفحه بیرون بزند.
    let didAutoResize = false;
    if (!noteSplitSide) {
      const edgeMargin = 8;
      // Compare requested sizes rather than the immediately animated layout size:
      // during a CSS transition offsetWidth can still report the previous frame.
      didAutoResize = targetFormW > previousRequestedW + 1 || targetFormH > previousRequestedH + 1;
      const actualFormW = didAutoResize
        ? targetFormW + Math.max(0, previousFormW - previousRequestedW)
        : quickNoteForm.offsetWidth;
      const actualFormH = didAutoResize
        ? targetFormH + Math.max(0, previousFormH - previousRequestedH)
        : quickNoteForm.offsetHeight;
      // همیشه موقعیت فعلی را نگه می‌داریم — فقط در صورت خروج از صفحه، clamp
      const curLeft = parseFloat(quickNoteForm.style.left);
      const curTop = parseFloat(quickNoteForm.style.top);
      const leftBase = Number.isFinite(curLeft) ? curLeft : quickNoteForm.getBoundingClientRect().left;
      const topBase = Number.isFinite(curTop) ? curTop : quickNoteForm.getBoundingClientRect().top;
      const clampedLeft = Math.max(edgeMargin, Math.min(leftBase, window.innerWidth - actualFormW - edgeMargin));
      const clampedTop = Math.max(edgeMargin, Math.min(topBase, window.innerHeight - actualFormH - edgeMargin));
      if (clampedLeft !== leftBase || didAutoResize) quickNoteForm.style.left = clampedLeft + 'px';
      if (clampedTop !== topBase || didAutoResize) quickNoteForm.style.top = clampedTop + 'px';
    }

    requestAnimationFrame(() => {
      quickNoteForm.style.transition = prevTrans;
      if (didAutoResize) {
        // فقط لبه را اصلاح کن؛ هرگز به مرکز مانیتور نکش
        clampNotepadInViewport();
        window.setTimeout(clampNotepadInViewport, 320);
      } else if (!noteManuallyPositioned) {
        adjustNotepadPosition();
      }
    });
  }

  function setupNoteResizeHandle(handleEl, corner) {
    if (!handleEl) return;
    let dragging = false, startX, startY, startW, startH, startLeft, startTop;
    handleEl.addEventListener('mousedown', (e) => {
      e.stopPropagation(); e.preventDefault();
      dragging = true;
      quickNoteForm.style.transition = 'none';
      const r = quickNoteForm.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY;
      startW = r.width; startH = r.height; startLeft = r.left; startTop = r.top;
      document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      const minW = NOTE_MIN_W;
      const maxW = noteSplitSide ? Math.max(minW, Math.round(window.innerWidth * 0.7)) : noteMaxW();
      let newW = startW;
      let newH = startH;
      let newLeft = startLeft;
      let newTop = startTop;

      if (corner === 'br') {
        newW = startW + dx;
        newH = startH + dy;
      } else if (corner === 'bl') {
        newW = startW - dx;
        newH = startH + dy;
        newLeft = startLeft + (startW - Math.max(minW, Math.min(maxW, newW)));
      } else if (corner === 'r') {
        newW = startW + dx;
      } else if (corner === 'l') {
        newW = startW - dx;
        newLeft = startLeft + (startW - Math.max(minW, Math.min(maxW, newW)));
      } else if (corner === 'b') {
        newH = startH + dy;
      } else if (corner === 't') {
        newH = startH - dy;
        newTop = startTop + dy;
      }

      newW = Math.max(minW, Math.min(maxW, newW));
      if (corner === 'br' || corner === 'bl') {
        newH = Math.max(NOTE_MIN_H, Math.min(noteMaxH(), newH));
      } else if (corner === 't' || corner === 'b') {
        const maxHD = Math.max(NOTE_HDOCK_MIN_H, Math.round(window.innerHeight * 0.85));
        newH = Math.max(NOTE_HDOCK_MIN_H, Math.min(maxHD, newH));
      }

      // While docked: one axis is locked to the edge(s), only the other is user-adjustable
      if (noteSplitSide === 'left' || noteSplitSide === 'right') {
        // Vertical dock: full height, adjustable width
        newH = Math.max(280, window.innerHeight - NOTE_SPLIT_TOP - NOTE_SPLIT_BOTTOM_GAP);
        newLeft = getNoteSplitLeftPos(noteSplitSide, window.innerWidth, newW);
        newTop = NOTE_SPLIT_TOP;
        noteSplitWidth = newW;
      } else if (isNoteHDock(noteSplitSide)) {
        // Horizontal dock: full width, adjustable height
        newW = Math.max(NOTE_MIN_W, window.innerWidth - NOTE_SPLIT_EDGE_GAP * 2);
        newLeft = NOTE_SPLIT_EDGE_GAP;
        newTop = getNoteDockTopPos(noteSplitSide, window.innerHeight, newH);
        noteDockHeight = newH;
      } else {
        // آزاد (نه داکِ‌شده): هیچ تضمینی نیست که کشیدنِ سریعِ مؤشر بین دو فریمِ
        // mousemove باعث نشود لبه‌ای از جعبه از ویوپورت بیرون بزند — دقیقاً همان
        // چیزی که کلیدهای پایینِ دفترچه را غیرقابل‌دسترس می‌کرد (نیاز به پن‌کردن).
        // این کلمپِ نهایی، صرف‌نظر از اینکه کدام گوشه کشیده شده، تضمین می‌کند کل
        // جعبه همیشه کاملاً داخل صفحه بماند.
        const edgeMargin = 8;
        newLeft = Math.min(Math.max(newLeft, edgeMargin), window.innerWidth - newW - edgeMargin);
        newTop = Math.min(Math.max(newTop, edgeMargin), window.innerHeight - newH - edgeMargin);
      }

      noteManuallyPositioned = true;
      noteUserResized = true;
      quickNoteForm.style.width = `${newW}px`;
      quickNoteForm.style.height = `${newH}px`;
      quickNoteForm.style.left = `${newLeft}px`;
      quickNoteForm.style.top = `${newTop}px`;
    });
    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.userSelect = '';
      requestAnimationFrame(() => { quickNoteForm.style.transition = ''; });
    });
  }
  setupNoteResizeHandle(quickNoteForm.querySelector('#ai-note-resize-l'), 'l');
  setupNoteResizeHandle(quickNoteForm.querySelector('#ai-note-resize-r'), 'r');
  setupNoteResizeHandle(quickNoteForm.querySelector('#ai-note-resize-t'), 't');
  setupNoteResizeHandle(quickNoteForm.querySelector('#ai-note-resize-b'), 'b');
  setupNoteResizeHandle(quickNoteForm.querySelector('#ai-note-resize-bl'), 'bl');
  setupNoteResizeHandle(quickNoteForm.querySelector('#ai-note-resize-br'), 'br');

  // --- Minimal text formatting: alignment + line numbers ---
  function setNoteAlign(align) {
    noteTextarea.style.textAlign = align;
    [uiEls.alignRightBtn, uiEls.alignCenterBtn, uiEls.alignLeftBtn].forEach(b => b && b.classList.remove('active'));
    const btn = align === 'right' ? uiEls.alignRightBtn : align === 'center' ? uiEls.alignCenterBtn : uiEls.alignLeftBtn;
    if (btn) btn.classList.add('active');
    try { if (chrome.runtime?.id) chrome.storage.local.set({ noteTextAlign: align }); } catch (e) {}
  }
  if (uiEls.alignRightBtn) uiEls.alignRightBtn.addEventListener('click', (e) => { e.stopPropagation(); setNoteAlign('right'); });
  if (uiEls.alignCenterBtn) uiEls.alignCenterBtn.addEventListener('click', (e) => { e.stopPropagation(); setNoteAlign('center'); });
  if (uiEls.alignLeftBtn) uiEls.alignLeftBtn.addEventListener('click', (e) => { e.stopPropagation(); setNoteAlign('left'); });
  try {
    chrome.storage.local.get(['noteTextAlign'], (data) => {
      if (data.noteTextAlign) setNoteAlign(data.noteTextAlign);
    });
  } catch (e) {}

  // --- Notepad font size (persisted, clamped, drives autoGrow via computed style) ---
  const NOTE_FONT_MIN = 11;
  const NOTE_FONT_MAX = 24;
  const NOTE_FONT_DEFAULT = 14;
  const NOTE_FONT_STEP = 1;
  let noteFontSize = NOTE_FONT_DEFAULT;
  function applyNoteFontSize(size, opts) {
    const silent = opts && opts.silent;
    noteFontSize = Math.min(NOTE_FONT_MAX, Math.max(NOTE_FONT_MIN, Math.round(size)));
    if (noteTextarea) noteTextarea.style.fontSize = noteFontSize + 'px';
    if (uiEls.fontSizeLabel) uiEls.fontSizeLabel.textContent = String(noteFontSize);
    if (uiEls.fontDecBtn) uiEls.fontDecBtn.disabled = noteFontSize <= NOTE_FONT_MIN;
    if (uiEls.fontIncBtn) uiEls.fontIncBtn.disabled = noteFontSize >= NOTE_FONT_MAX;
    if (!silent) {
      try { if (chrome.runtime?.id) chrome.storage.local.set({ noteFontSize: noteFontSize }); } catch (e) {}
    }
    if (typeof autoGrowNotepad === 'function') autoGrowNotepad();
    else if (typeof adjustNotepadPosition === 'function') adjustNotepadPosition();
  }
  if (uiEls.fontIncBtn) uiEls.fontIncBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    applyNoteFontSize(noteFontSize + NOTE_FONT_STEP);
  });
  if (uiEls.fontDecBtn) uiEls.fontDecBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    applyNoteFontSize(noteFontSize - NOTE_FONT_STEP);
  });
  try {
    chrome.storage.local.get(['noteFontSize'], (data) => {
      applyNoteFontSize((data && data.noteFontSize) ? data.noteFontSize : NOTE_FONT_DEFAULT, { silent: true });
    });
  } catch (e) { applyNoteFontSize(NOTE_FONT_DEFAULT, { silent: true }); }

  // =========================================================================
  // NotepadUndoManager — multi-step LIFO memory (5–15 snapshots), zero-TTL.
  // Bookmark/todo recovery stays on pendingUndoState + 10s globalUndoTimeout.
  // Session grouping: continuous typing shares one snapshot (pushed at start);
  // paste / cut / bulk delete / clear each force a new boundary.
  // =========================================================================
  const NOTE_UNDO_MAX = 15;
  const NOTE_UNDO_MIN_KEEP = 5;
  const NOTE_EDIT_SESSION_IDLE_MS = 1200;
  const NOTE_HISTORY_STORAGE_KEY = 'aiTreeNotepadHistory';

  class NotepadUndoManager {
    constructor(textarea, opts) {
      this.ta = textarea;
      this.max = (opts && opts.max) || NOTE_UNDO_MAX;
      this.undoStack = [];
      this.redoStack = [];
      this.sessionOpen = false;
      this.sessionTimer = null;
      this.applying = false; // suppress push while restoring
      this.persistTimer = null;
      this._lastPushedValue = null;
    }

    snapshot(extra) {
      if (!this.ta) return null;
      return Object.assign({
        value: this.ta.value,
        selectionStart: this.ta.selectionStart,
        selectionEnd: this.ta.selectionEnd,
        prevWidth: quickNoteForm.style.width || '',
        prevHeight: quickNoteForm.style.height || '',
        ts: Date.now()
      }, extra || {});
    }

    _sameAsTop(snap) {
      if (!snap || !this.undoStack.length) return false;
      const top = this.undoStack[this.undoStack.length - 1];
      return top && top.value === snap.value;
    }

    push(snap) {
      if (!snap || this.applying) return false;
      if (this._sameAsTop(snap)) return false;
      this.undoStack.push(snap);
      while (this.undoStack.length > this.max) this.undoStack.shift();
      this.redoStack = [];
      this._lastPushedValue = snap.value;
      this.schedulePersist();
      syncUndoToggleVisual();
      return true;
    }

    /** External bridge used by setUndoState('text', data) compatibility path. */
    pushExternal(data) {
      if (!data) return;
      const snap = typeof data === 'string'
        ? { value: data, selectionStart: data.length, selectionEnd: data.length, prevWidth: '', prevHeight: '', ts: Date.now() }
        : Object.assign({ ts: Date.now() }, data);
      // Opening a new edit boundary
      this.sessionOpen = true;
      this._armSessionTimer();
      this.push(snap);
    }

    canUndo() { return this.undoStack.length > 0; }
    canRedo() { return this.redoStack.length > 0; }

    applySnapshot(snap) {
      if (!this.ta || !snap) return;
      this.applying = true;
      try {
        this.ta.value = snap.value != null ? snap.value : '';
        if (snap.prevWidth) { quickNoteForm.style.width = snap.prevWidth; noteManuallyPositioned = true; }
        if (snap.prevHeight) { quickNoteForm.style.height = snap.prevHeight; noteManuallyPositioned = true; }
        const len = this.ta.value.length;
        const a = Math.min(Math.max(0, snap.selectionStart ?? len), len);
        const b = Math.min(Math.max(0, snap.selectionEnd ?? a), len);
        try { this.ta.focus(); this.ta.setSelectionRange(a, b); } catch (err) {}
        quickNoteForm.classList.add('active');
        root.classList.add('show-notepad');
        if (typeof updateNoteTokenMeter === 'function') updateNoteTokenMeter();
        if (typeof saveNoteDraftDebounced === 'function') saveNoteDraftDebounced();
        if (typeof autoGrowNotepad === 'function') autoGrowNotepad();
        else if (typeof adjustNotepadPosition === 'function') adjustNotepadPosition();
      } finally {
        this.applying = false;
      }
    }

    undo() {
      if (!this.canUndo()) return false;
      this.endSession();
      const current = this.snapshot();
      const prev = this.undoStack.pop();
      if (current) this.redoStack.push(current);
      this.applySnapshot(prev);
      this.schedulePersist();
      syncUndoToggleVisual();
      showToastNotification(t('toastRestored'));
      return true;
    }

    redo() {
      if (!this.canRedo()) return false;
      this.endSession();
      const current = this.snapshot();
      const next = this.redoStack.pop();
      if (current) this.undoStack.push(current);
      this.applySnapshot(next);
      this.schedulePersist();
      syncUndoToggleVisual();
      showToastNotification(t('toastRestored'));
      return true;
    }

    beginSessionIfNeeded() {
      if (!this.ta || this.applying) return;
      if (!this.ta.value) return; // nothing meaningful to restore to
      if (this.sessionOpen) {
        this._armSessionTimer();
        return;
      }
      this.sessionOpen = true;
      this.push(this.snapshot());
      this._armSessionTimer();
    }

    forceBoundary() {
      if (!this.ta || this.applying) return;
      // Always capture current state as a recoverable step (even if empty → clear recovery)
      this.sessionOpen = true;
      this.push(this.snapshot());
      this._armSessionTimer();
    }

    endSession() {
      this.sessionOpen = false;
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }

    _armSessionTimer() {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = setTimeout(() => this.endSession(), NOTE_EDIT_SESSION_IDLE_MS);
    }

    schedulePersist() {
      clearTimeout(this.persistTimer);
      this.persistTimer = setTimeout(() => this.persist(), 400);
    }

    persist() {
      try {
        if (!chrome.runtime?.id) return;
        const payload = {
          undo: this.undoStack.slice(-NOTE_UNDO_MAX),
          redo: this.redoStack.slice(-NOTE_UNDO_MAX),
          savedAt: Date.now()
        };
        chrome.storage.local.set({ [NOTE_HISTORY_STORAGE_KEY]: payload });
      } catch (err) {}
    }

    loadFromStorage(data) {
      try {
        if (!data || !Array.isArray(data.undo)) return;
        this.undoStack = data.undo.slice(-NOTE_UNDO_MAX).filter(s => s && typeof s.value === 'string');
        this.redoStack = Array.isArray(data.redo)
          ? data.redo.slice(-NOTE_UNDO_MAX).filter(s => s && typeof s.value === 'string')
          : [];
        syncUndoToggleVisual();
      } catch (err) {}
    }

    clear() {
      this.undoStack = [];
      this.redoStack = [];
      this.endSession();
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
      try {
        if (chrome.runtime?.id) {
          chrome.storage.local.remove([NOTE_HISTORY_STORAGE_KEY]);
        }
      } catch (err) {}
      syncUndoToggleVisual();
    }
  }

  let noteEditSessionOpen = false; // legacy alias kept for external callers
  let noteEditSessionTimer = null;
  let notepadUndo = null;

  function snapshotNoteText(extra) {
    if (notepadUndo) return notepadUndo.snapshot(extra);
    if (!noteTextarea) return null;
    return Object.assign({
      value: noteTextarea.value,
      selectionStart: noteTextarea.selectionStart,
      selectionEnd: noteTextarea.selectionEnd,
      prevWidth: quickNoteForm.style.width || '',
      prevHeight: quickNoteForm.style.height || ''
    }, extra || {});
  }

  function beginNoteEditSessionIfNeeded() {
    if (notepadUndo) notepadUndo.beginSessionIfNeeded();
    noteEditSessionOpen = !!(notepadUndo && notepadUndo.sessionOpen);
  }

  function endNoteEditSession() {
    if (notepadUndo) notepadUndo.endSession();
    noteEditSessionOpen = false;
    clearTimeout(noteEditSessionTimer);
    noteEditSessionTimer = null;
  }

  function captureNoteUndoForBigChange(inputType, data) {
    if (!notepadUndo || !noteTextarea) return;
    const isDelete = inputType && inputType.startsWith('delete');
    const isInsert = inputType && (inputType.startsWith('insert') || inputType === 'historyUndo' || inputType === 'historyRedo');
    const selLen = Math.abs((noteTextarea.selectionEnd || 0) - (noteTextarea.selectionStart || 0));
    const incomingLen = (data && data.length) || 0;
    const significant =
      (isDelete && (selLen > 1 || noteTextarea.value.length > 0)) ||
      (isInsert && (selLen > 0 || incomingLen > 20));
    if (!significant && !(isDelete && noteTextarea.value.length > 0)) return;
    if (!notepadUndo.sessionOpen) notepadUndo.forceBoundary();
    else notepadUndo._armSessionTimer();
    noteEditSessionOpen = notepadUndo.sessionOpen;
  }

  if (noteTextarea) {
    notepadUndo = new NotepadUndoManager(noteTextarea, { max: NOTE_UNDO_MAX });
    // Hydrate multi-step history from local storage (survives soft relaunch)
    try {
      if (chrome.runtime?.id) {
        chrome.storage.local.get([NOTE_HISTORY_STORAGE_KEY], (res) => {
          if (res && res[NOTE_HISTORY_STORAGE_KEY]) notepadUndo.loadFromStorage(res[NOTE_HISTORY_STORAGE_KEY]);
        });
      }
    } catch (err) {}

    noteTextarea.addEventListener('beforeinput', function (e) {
      if (!e.inputType || !notepadUndo || notepadUndo.applying) return;
      if (e.inputType.startsWith('delete') || e.inputType.startsWith('insert') || e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') {
        const selLen = Math.abs((this.selectionEnd || 0) - (this.selectionStart || 0));
        if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop' || (e.inputType.startsWith('delete') && selLen > 1)) {
          if (this.value || selLen > 0) notepadUndo.forceBoundary();
        } else if (e.inputType.startsWith('delete') || e.inputType.startsWith('insertText') || e.inputType === 'insertLineBreak') {
          beginNoteEditSessionIfNeeded();
        }
        noteEditSessionOpen = notepadUndo.sessionOpen;
      }
    });
    noteTextarea.addEventListener('keydown', function (e) {
      if (typeof abortNoteClosing === 'function') abortNoteClosing();
      const mod = e.ctrlKey || e.metaKey;
      // Multi-step undo / redo shortcuts (do not interfere with native when manager empty)
      if (mod && !e.altKey && (e.key === 'z' || e.key === 'Z')) {
        if (e.shiftKey) {
          if (notepadUndo && notepadUndo.canRedo()) {
            e.preventDefault(); e.stopPropagation();
            notepadUndo.redo();
            return;
          }
        } else if (notepadUndo && notepadUndo.canUndo()) {
          e.preventDefault(); e.stopPropagation();
          notepadUndo.undo();
          return;
        }
      }
      if (mod && !e.altKey && (e.key === 'y' || e.key === 'Y')) {
        if (notepadUndo && notepadUndo.canRedo()) {
          e.preventDefault(); e.stopPropagation();
          notepadUndo.redo();
          return;
        }
      }
      // Ctrl/Cmd+A سپس Delete/Backspace — اسنپ‌شات قبل از پاک شدن کل متن
      if ((e.key === 'Backspace' || e.key === 'Delete') && this.selectionStart === 0 && this.selectionEnd === this.value.length && this.value.length > 0) {
        if (notepadUndo && !notepadUndo.sessionOpen) notepadUndo.forceBoundary();
        noteEditSessionOpen = !!(notepadUndo && notepadUndo.sessionOpen);
      }
    });
    let lastNoteValueForEmoji = noteTextarea ? noteTextarea.value : '';
    noteTextarea.addEventListener('input', function () {
      if (typeof harvestTypedEmoji === 'function') harvestTypedEmoji(lastNoteValueForEmoji, this.value);
      lastNoteValueForEmoji = this.value;
      if (typeof abortNoteClosing === 'function') abortNoteClosing();
      if (typeof updateNoteTokenMeter === 'function') updateNoteTokenMeter();
      if (typeof saveNoteDraftDebounced === 'function') saveNoteDraftDebounced();
      if (typeof autoGrowNotepad === 'function') autoGrowNotepad();
      else adjustNotepadPosition();
      resetToggleTimeout();
      if (notepadUndo && notepadUndo.sessionOpen) notepadUndo._armSessionTimer();
    });
    noteTextarea.addEventListener('blur', function () {
      endNoteEditSession();
    });
  }

  
  // --- Prompt Studio: templates, token meter, autosave, history ---
  // این ۶ پرامپتِ پیش‌فرض به‌عنوان محتوای اپ به انگلیسی نوشته شده‌اند، اما این یک قانون نیست:
  // عنوان و متن پرامپت‌های سفارشیِ کاربر (customPrompts) و بازنویسی‌های او (promptOverrides)
  // می‌توانند به هر زبانی باشند — هیچ‌جای این فایل زبان ورودی کاربر را بررسی/محدود نمی‌کند.
  const PROMPT_CATEGORIES = [
    { id: 'image', key: 'promptCatImage' },
    { id: 'writing', key: 'promptCatWriting' },
    { id: 'ai', key: 'promptCatAi' },
    { id: 'dev', key: 'promptCatDev' },
    { id: 'architecture', key: 'promptCatArchitecture' },
    { id: 'music', key: 'promptCatMusic' },
    { id: 'research', key: 'promptCatResearch' },
    { id: 'management', key: 'promptCatManagement' },
    { id: 'system', key: 'promptCatSystem' },
    { id: 'tools', key: 'promptCatTools' },
    { id: 'lab', key: 'promptCatLab' },
    { id: 'favorites', key: 'promptCatFavorites' },
    { id: 'general', key: 'promptCatGeneral' }
  ];
  const PROMPT_CATEGORY_IDS = new Set(PROMPT_CATEGORIES.map(c => c.id));
  function promptCategoryLabel(id) {
    const cat = PROMPT_CATEGORIES.find(c => c.id === id) || PROMPT_CATEGORIES[PROMPT_CATEGORIES.length - 1];
    return t(cat.key);
  }
  const BUILTIN_PROMPTS = [
    {
      id: 'builtin-refactor',
      title: 'Code Review',
      text: 'Act as a Principal Software Architect. Review the following code for efficiency, security, and edge-case resilience:\n\n',
      category: 'dev',
      builtIn: true
    },
    {
      id: 'builtin-summary',
      title: 'Summarize',
      text: 'Analyze the text below and provide a structured comparative table and bullet-point executive summary:\n\n',
      category: 'ai',
      builtIn: true
    },
    {
      id: 'builtin-critic',
      title: 'Critique',
      text: 'Critique the following thesis from first principles. Identify logical fallacies and hidden assumptions:\n\n',
      category: 'ai',
      builtIn: true
    },
    {
      id: 'builtin-translate',
      title: 'Translate',
      text: 'Translate the following text into clear, natural English while preserving technical meaning:\n\n',
      category: 'writing',
      builtIn: true
    },
    {
      id: 'builtin-song',
      title: 'Songwriter',
      text: 'Turn the following text into a beautiful song.\nThe song must not be a mere rewrite of the text; it should transform its feeling, meaning, and imagery into a musical work.\nUse rhyme and flowing words, and write the lyrics so a listener can easily remember them.\n\nText:\n',
      category: 'music',
      builtIn: true
    },
    {
      id: 'builtin-logo',
      title: 'Logo Maker',
      text: 'Act as an elite brand designer. Create a logo for [brand name] that captures [core value] and speaks directly to [audience]. Make it sophisticated, timeless, and instantly recognizable.\n\n',
      category: 'image',
      builtIn: true
    }
  ];

  const CUSTOM_PROMPT_MAX = 300; // سقف واقعی صرفاً یک محافظِ حجمِ storage است — دیگر محدودیت UI نیست چون پرامپت‌ها دسته‌بندی می‌شوند
  const CUSTOM_PROMPT_KEY = 'aiTreeCustomPrompts';
  const PROMPT_OVERRIDE_KEY = 'aiTreePromptOverrides';
  const PROMPT_HIDDEN_KEY = 'aiTreePromptHidden';
  let customPrompts = []; // [{ id, title, text, category }]
  let promptOverrides = {}; // { [builtinId]: { title, text, category } }
  let promptHiddenIds = []; // builtin ids removed by user
  let tplEditMode = false;
  let tplEditingId = null; // id being edited, or null for new
  let tplEditingBuiltIn = false;
  let expandedPromptCategory = null; // null = showing category folders; otherwise the open category's id
  let promptSearchQuery = ''; // جستجوی فازیِ زنده روی عنوان/متن پرامپت‌ها — وقتی پر باشد، نمای پوشه‌ای/دسته کنار می‌رود و نتایج به‌صورت مسطح نشان داده می‌شوند

  // تطبیق فازیِ سبک (زیررشته‌ایِ ترتیب‌دار): هر کاراکترِ عبارتِ جستجو باید به همان
  // ترتیب — نه لزوماً پشت‌سرهم — در متن هدف پیدا شود. سریع و بدون هیچ وابستگی
  // خارجی، و روی فارسی/عربی/انگلیسی یکسان کار می‌کند چون فقط مقایسه کاراکتری است.
  function fuzzyPromptMatch(query, text) {
    if (!query) return true;
    if (!text) return false;
    query = query.toLowerCase();
    text = text.toLowerCase();
    let qi = 0;
    for (let i = 0; i < text.length && qi < query.length; i++) {
      if (text[i] === query[qi]) qi++;
    }
    return qi === query.length;
  }

  let promptHistory = [];
  let noteDraftSaveTimer = null;

  function estimateTokens(text) {
    if (!text) return 0;
    const chars = text.length;
    const words = text.split(/\s+/).filter(Boolean).length;
    // Heuristic: Latin ~1.35 tok/word; extra weight for dense Unicode (fa/ar/cjk)
    return Math.max(1, Math.round(words * 1.35 + chars * 0.08));
  }

  function updateNoteTokenMeter() {
    if (!uiEls.tokenMeter || !noteTextarea) return;
    const text = noteTextarea.value;
    if (!text.trim()) {
      uiEls.tokenMeter.textContent = t('noteTokenEmpty');
      return;
    }
    uiEls.tokenMeter.textContent = t('noteTokenMeter')
      .replace('{chars}', String(text.length))
      .replace('{tokens}', String(estimateTokens(text)));
  }

  function saveNoteDraftDebounced() {
    clearTimeout(noteDraftSaveTimer);
    noteDraftSaveTimer = setTimeout(() => {
      try {
        if (chrome.runtime?.id && noteTextarea) {
          chrome.storage.local.set({ savedPromptDraft: noteTextarea.value });
        }
      } catch (e) {}
    }, 400);
  }

  function restoreNoteDraft() {
    try {
      chrome.storage.local.get(['savedPromptDraft', 'aiTreePromptHistory', CUSTOM_PROMPT_KEY, PROMPT_OVERRIDE_KEY, PROMPT_HIDDEN_KEY], (res) => {
        if (res && typeof res.savedPromptDraft === 'string' && noteTextarea && !noteTextarea.value) {
          noteTextarea.value = res.savedPromptDraft;
        }
        if (res && Array.isArray(res.aiTreePromptHistory)) {
          promptHistory = res.aiTreePromptHistory.slice(0, 10);
        }
        if (res && Array.isArray(res[CUSTOM_PROMPT_KEY])) {
          customPrompts = res[CUSTOM_PROMPT_KEY]
            .filter(p => p && typeof p.title === 'string' && typeof p.text === 'string')
            .slice(0, CUSTOM_PROMPT_MAX)
            .map(p => ({
              id: p.id || ('c-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
              title: String(p.title).slice(0, 40),
              text: String(p.text),
              category: normalizePromptCategory(p.category)
            }));
        }
        if (res && res[PROMPT_OVERRIDE_KEY] && typeof res[PROMPT_OVERRIDE_KEY] === 'object') {
          promptOverrides = res[PROMPT_OVERRIDE_KEY];
        }
        if (res && Array.isArray(res[PROMPT_HIDDEN_KEY])) {
          promptHiddenIds = res[PROMPT_HIDDEN_KEY].filter(id => typeof id === 'string');
        }
        updateNoteTokenMeter();
        renderNoteTemplates();
      });
    } catch (e) {}
  }

  function saveCustomPrompts() {
    try {
      if (chrome.runtime?.id) chrome.storage.local.set({ [CUSTOM_PROMPT_KEY]: customPrompts });
    } catch (e) {}
  }
  function savePromptOverrides() {
    try {
      if (chrome.runtime?.id) chrome.storage.local.set({ [PROMPT_OVERRIDE_KEY]: promptOverrides });
    } catch (e) {}
  }
  function savePromptHidden() {
    try {
      if (chrome.runtime?.id) chrome.storage.local.set({ [PROMPT_HIDDEN_KEY]: promptHiddenIds });
    } catch (e) {}
  }

  function pushPromptHistory(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    promptHistory = [{ ts: Date.now(), text: trimmed }, ...promptHistory.filter(h => h.text !== trimmed)].slice(0, 10);
    try {
      if (chrome.runtime?.id) chrome.storage.local.set({ aiTreePromptHistory: promptHistory });
    } catch (e) {}
  }

  function insertNoteTemplate(templateText) {
    if (!noteTextarea) return;
    if (noteTextarea.value) {
      endNoteEditSession();
      setUndoState('text', snapshotNoteText());
    }
    const start = noteTextarea.selectionStart || 0;
    const end = noteTextarea.selectionEnd || 0;
    const current = noteTextarea.value;
    noteTextarea.value = current.slice(0, start) + templateText + current.slice(end);
    const pos = start + templateText.length;
    noteTextarea.setSelectionRange(pos, pos);
    noteTextarea.focus();
    updateNoteTokenMeter();
    saveNoteDraftDebounced();
    if (typeof abortNoteClosing === 'function') abortNoteClosing();
    adjustNotepadPosition();
  }

  function normalizePromptCategory(id) {
    return PROMPT_CATEGORY_IDS.has(id) ? id : 'general';
  }

  function allPrompts() {
    const hidden = new Set(promptHiddenIds || []);
    const builtins = BUILTIN_PROMPTS
      .filter((p) => !hidden.has(p.id))
      .map((p) => {
        const ov = promptOverrides && promptOverrides[p.id];
        if (ov && (ov.title || ov.text || ov.category)) {
          return {
            ...p,
            title: (ov.title != null ? String(ov.title) : p.title).slice(0, 40),
            text: ov.text != null ? String(ov.text) : p.text,
            category: normalizePromptCategory(ov.category || p.category),
            overridden: true
          };
        }
        return { ...p, category: normalizePromptCategory(p.category), overridden: false };
      });
    return builtins.concat(customPrompts.map(p => ({ ...p, category: normalizePromptCategory(p.category), builtIn: false, overridden: false })));
  }

  function promptsByCategory() {
    const groups = {};
    const source = promptSearchQuery
      ? allPrompts().filter(p => fuzzyPromptMatch(promptSearchQuery, p.title) || fuzzyPromptMatch(promptSearchQuery, p.text))
      : allPrompts();
    source.forEach((p) => {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    });
    return groups;
  }

  function ensureTplEditorDom() {
    if (!quickNoteForm) return null;
    let ed = quickNoteForm.querySelector('#ai-note-tpl-editor');
    if (ed) return ed;
    ed = document.createElement('div');
    ed.id = 'ai-note-tpl-editor';
    ed.className = 'ai-note-tpl-editor';
    ed.hidden = true;
    ed.innerHTML = `
      <div class="ai-tpl-ed-head">
        <span class="ai-tpl-ed-title" id="ai-tpl-ed-title"></span>
        <button type="button" class="ai-tpl-ed-close" id="ai-tpl-ed-close" aria-label="Close">✕</button>
      </div>
      <input type="text" id="ai-tpl-ed-name" class="ai-tpl-ed-input" dir="auto" maxlength="40" autocomplete="off" />
      <select id="ai-tpl-ed-cat" class="ai-tpl-ed-input"></select>
      <textarea id="ai-tpl-ed-body" class="ai-tpl-ed-textarea" dir="auto" rows="5"></textarea>
      <div class="ai-tpl-ed-actions">
        <button type="button" id="ai-tpl-ed-use-note" class="ai-tpl-ed-btn ghost"></button>
        <span class="ai-tpl-ed-spacer"></span>
        <button type="button" id="ai-tpl-ed-delete" class="ai-tpl-ed-btn danger" hidden></button>
        <button type="button" id="ai-tpl-ed-cancel" class="ai-tpl-ed-btn ghost"></button>
        <button type="button" id="ai-tpl-ed-save" class="ai-tpl-ed-btn primary"></button>
      </div>`;
    // mount near tpl bar
    if (uiEls.tplBar && uiEls.tplBar.parentNode) {
      uiEls.tplBar.parentNode.insertBefore(ed, uiEls.tplBar.nextSibling);
    } else {
      quickNoteForm.appendChild(ed);
    }
    ed.querySelector('#ai-tpl-ed-close').addEventListener('click', (e) => { e.stopPropagation(); closeTplEditor(); });
    ed.querySelector('#ai-tpl-ed-cancel').addEventListener('click', (e) => { e.stopPropagation(); closeTplEditor(); });
    ed.querySelector('#ai-tpl-ed-save').addEventListener('click', (e) => { e.stopPropagation(); saveTplEditor(); });
    ed.querySelector('#ai-tpl-ed-delete').addEventListener('click', (e) => { e.stopPropagation(); deleteFromTplEditor(); });
    ed.querySelector('#ai-tpl-ed-use-note').addEventListener('click', (e) => {
      e.stopPropagation();
      const body = ed.querySelector('#ai-tpl-ed-body');
      if (!body || !noteTextarea) return;
      const selStart = noteTextarea.selectionStart;
      const selEnd = noteTextarea.selectionEnd;
      let chunk = '';
      if (typeof selStart === 'number' && typeof selEnd === 'number' && selEnd > selStart) {
        chunk = noteTextarea.value.slice(selStart, selEnd);
      } else {
        chunk = noteTextarea.value || '';
      }
      body.value = chunk;
      body.focus();
    });
    ['mousedown', 'click', 'keydown', 'keyup'].forEach(ev => {
      ed.addEventListener(ev, (e) => e.stopPropagation());
    });
    return ed;
  }

  function openTplEditor(promptOrNull) {
    const ed = ensureTplEditorDom();
    if (!ed) return;
    tplEditingId = promptOrNull ? promptOrNull.id : null;
    tplEditingBuiltIn = !!(promptOrNull && promptOrNull.builtIn);
    const isNew = !tplEditingId;
    ed.querySelector('#ai-tpl-ed-title').textContent = isNew ? t('noteTplFormTitleNew') : t('noteTplFormTitleEdit');
    const nameEl = ed.querySelector('#ai-tpl-ed-name');
    const bodyEl = ed.querySelector('#ai-tpl-ed-body');
    const catEl = ed.querySelector('#ai-tpl-ed-cat');
    nameEl.placeholder = t('noteTplFormName');
    bodyEl.placeholder = t('noteTplFormBody');
    // راهنمای نرم (فقط با هاور) نه محدودیت: عنوان و متن پرامپت هر دو می‌توانند به هر زبانی باشند
    bodyEl.title = t('noteTplFormBodyHint');
    nameEl.value = promptOrNull ? (promptOrNull.title || '') : '';
    bodyEl.value = promptOrNull ? (promptOrNull.text || '') : '';
    catEl.innerHTML = '';
    PROMPT_CATEGORIES.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = promptCategoryLabel(cat.id);
      catEl.appendChild(opt);
    });
    catEl.value = promptOrNull
      ? normalizePromptCategory(promptOrNull.category)
      : normalizePromptCategory(expandedPromptCategory);
    ed.querySelector('#ai-tpl-ed-use-note').textContent = t('noteTplFormUseNote');
    ed.querySelector('#ai-tpl-ed-cancel').textContent = t('noteTplFormCancel');
    ed.querySelector('#ai-tpl-ed-save').textContent = t('noteTplFormSave');
    const delBtn = ed.querySelector('#ai-tpl-ed-delete');
    if (isNew) {
      delBtn.hidden = true;
    } else {
      delBtn.hidden = false;
      delBtn.textContent = t('noteTplFormDelete');
    }
    ed.hidden = false;
    ed.classList.add('active');
    nameEl.focus();
    // The editor adds a chunk of height inside the panel (name + textarea + actions row) —
    // grow the notepad now so the Save/Cancel/Delete buttons are visible without a manual resize.
    if (typeof autoGrowNotepad === 'function') autoGrowNotepad();
  }

  function closeTplEditor() {
    const ed = quickNoteForm && quickNoteForm.querySelector('#ai-note-tpl-editor');
    if (!ed) return;
    ed.hidden = true;
    ed.classList.remove('active');
    tplEditingId = null;
    tplEditingBuiltIn = false;
    if (typeof autoGrowNotepad === 'function') autoGrowNotepad();
  }

  function saveTplEditor() {
    const ed = quickNoteForm && quickNoteForm.querySelector('#ai-note-tpl-editor');
    if (!ed) return;
    const title = (ed.querySelector('#ai-tpl-ed-name').value || '').trim().slice(0, 40);
    const body = (ed.querySelector('#ai-tpl-ed-body').value || '').trim();
    const category = normalizePromptCategory(ed.querySelector('#ai-tpl-ed-cat').value);
    if (!title || !body) {
      showToastNotification(t('noteTplToastNeedFields'), true);
      return;
    }
    if (tplEditingId && tplEditingBuiltIn) {
      promptOverrides[tplEditingId] = { title, text: body, category };
      savePromptOverrides();
    } else if (tplEditingId) {
      const idx = customPrompts.findIndex(p => p.id === tplEditingId);
      if (idx >= 0) {
        customPrompts[idx] = { ...customPrompts[idx], title, text: body, category };
      } else {
        customPrompts.push({ id: tplEditingId, title, text: body, category });
      }
      saveCustomPrompts();
    } else {
      if (customPrompts.length >= CUSTOM_PROMPT_MAX) {
        showToastNotification(t('noteTplToastLimit'), true);
        return;
      }
      customPrompts.push({
        id: 'c-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title,
        text: body,
        category
      });
      saveCustomPrompts();
    }
    expandedPromptCategory = category;
    closeTplEditor();
    renderNoteTemplates();
    showToastNotification(t('noteTplToastSaved'));
  }

  function deleteFromTplEditor() {
    if (!tplEditingId) return;
    if (tplEditingBuiltIn) {
      if (!promptHiddenIds.includes(tplEditingId)) {
        promptHiddenIds.push(tplEditingId);
        savePromptHidden();
      }
      if (promptOverrides[tplEditingId]) {
        delete promptOverrides[tplEditingId];
        savePromptOverrides();
      }
      closeTplEditor();
      renderNoteTemplates();
      showToastNotification(t('noteTplToastDeleted'));
      return;
    }
    customPrompts = customPrompts.filter(p => p.id !== tplEditingId);
    saveCustomPrompts();
    closeTplEditor();
    renderNoteTemplates();
    showToastNotification(t('noteTplToastDeleted'));
  }

  function renderNoteTemplates() {
    if (!uiEls.tplBar) return;
    uiEls.tplBar.innerHTML = '';
    uiEls.tplBar.classList.toggle('is-editing', tplEditMode);

    function makePromptChip(tpl) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'ai-note-tpl-chip' + (tpl.builtIn ? ' is-builtin' : ' is-custom');
      if (tpl.overridden) chip.classList.add('is-overridden');
      if (tplEditMode) chip.classList.add('is-editable');
      chip.dir = 'auto'; // عنوان پرامپت ممکن است با زبان رابط کاربری فرق داشته باشد
      chip.textContent = tpl.title;
      chip.title = tplEditMode ? t('noteTplFormTitleEdit') : tpl.title;
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        if (tplEditMode) {
          openTplEditor(tpl);
          return;
        }
        insertNoteTemplate(tpl.text);
      });
      return chip;
    }

    const groups = promptsByCategory();

    if (expandedPromptCategory && !groups[expandedPromptCategory]) {
      expandedPromptCategory = null; // آخرین پرامپت آن دسته حذف شده — برگرد به فهرست پوشه‌ها
    }

    if (promptSearchQuery) {
      // نمای نتایج جستجو: مسطح روی همه‌ی دسته‌ها، بدون چیپ پوشه و بدون چیپ بازگشت —
      // کاربر نباید برای دیدن نتیجه‌ی جستجو مجبور به بازکردن دستی یک دسته باشد.
      const matched = PROMPT_CATEGORIES.reduce((acc, cat) => acc.concat(groups[cat.id] || []), []);
      if (!matched.length) {
        const empty = document.createElement('span');
        empty.className = 'ai-note-tpl-empty';
        empty.dir = 'auto';
        empty.textContent = t('noteTplSearchEmpty');
        uiEls.tplBar.appendChild(empty);
      } else {
        matched.forEach((tpl) => uiEls.tplBar.appendChild(makePromptChip(tpl)));
      }
    } else if (!expandedPromptCategory) {
      // نمای پوشه‌ها: هر دسته یک چیپ با شمارنده، مرتب‌شده بر اساس ترتیب ثابتِ PROMPT_CATEGORIES
      PROMPT_CATEGORIES.forEach((cat) => {
        const items = groups[cat.id];
        if (!items || !items.length) return;
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'ai-note-tpl-chip is-category';
        chip.dir = 'auto';
        chip.textContent = `${promptCategoryLabel(cat.id)} · ${items.length}`;
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          expandedPromptCategory = cat.id;
          renderNoteTemplates();
        });
        uiEls.tplBar.appendChild(chip);
      });
    } else {
      // نمای داخل یک دسته: چیپ بازگشت + پرامپت‌های همان دسته
      const backChip = document.createElement('button');
      backChip.type = 'button';
      backChip.className = 'ai-note-tpl-chip is-category is-back';
      backChip.dir = 'auto';
      backChip.textContent = `${t('noteTplBack')} ${promptCategoryLabel(expandedPromptCategory)}`;
      backChip.addEventListener('click', (e) => {
        e.stopPropagation();
        expandedPromptCategory = null;
        renderNoteTemplates();
      });
      uiEls.tplBar.appendChild(backChip);

      (groups[expandedPromptCategory] || []).forEach((tpl) => uiEls.tplBar.appendChild(makePromptChip(tpl)));
    }

    // + add
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'ai-note-tpl-action ai-note-tpl-add';
    addBtn.textContent = '+';
    addBtn.title = t('noteTplAdd');
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (customPrompts.length >= CUSTOM_PROMPT_MAX) {
        showToastNotification(t('noteTplToastLimit'), true);
        return;
      }
      openTplEditor(null);
    });
    uiEls.tplBar.appendChild(addBtn);

    // edit toggle
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'ai-note-tpl-action ai-note-tpl-edit' + (tplEditMode ? ' is-active' : '');
    editBtn.textContent = tplEditMode ? '✓' : '✎';
    editBtn.title = tplEditMode ? t('noteTplDone') : t('noteTplEdit');
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      tplEditMode = !tplEditMode;
      if (!tplEditMode) closeTplEditor();
      renderNoteTemplates();
    });
    uiEls.tplBar.appendChild(editBtn);

    // Keep bottom toolbar fully visible after template bar height changes
    if (quickNoteForm.classList.contains('active') && !noteUserResized && !noteSplitSide) {
      requestAnimationFrame(() => {
        if (typeof autoGrowNotepad === 'function') autoGrowNotepad();
      });
    }
  }

  function renderPromptHistoryMenu() {
    if (!uiEls.historyMenu) return;
    uiEls.historyMenu.innerHTML = '';
    if (!promptHistory.length) {
      const empty = document.createElement('div');
      empty.className = 'ai-note-history-empty';
      empty.textContent = t('noteHistoryEmpty');
      uiEls.historyMenu.appendChild(empty);
      return;
    }
    promptHistory.forEach((item) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'ai-note-history-item';
      row.dir = 'auto'; // متن پرامپت ممکن است هر زبانی باشد، جدا از زبان رابط کاربری
      const preview = item.text.length > 72 ? item.text.slice(0, 72) + '…' : item.text;
      row.textContent = preview;
      row.title = item.text;
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        if (noteTextarea) {
          if (noteTextarea.value && noteTextarea.value !== item.text) {
            endNoteEditSession();
            setUndoState('text', snapshotNoteText());
          }
          noteTextarea.value = item.text;
          noteTextarea.focus();
          updateNoteTokenMeter();
          saveNoteDraftDebounced();
        }
        uiEls.historyMenu.classList.remove('active');
      });
      uiEls.historyMenu.appendChild(row);
    });
  }

  if (uiEls.historyBtn && uiEls.historyMenu) {
    uiEls.historyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      renderPromptHistoryMenu();
      uiEls.historyMenu.classList.toggle('active');
    });
    document.addEventListener('click', (e) => {
      if (!uiEls.historyMenu.classList.contains('active')) return;
      if (uiEls.historyMenu.contains(e.target) || e.target === uiEls.historyBtn) return;
      uiEls.historyMenu.classList.remove('active');
    });
  }

  restoreNoteDraft();
  renderNoteTemplates();
  updateNoteTokenMeter();

  /**
   * DOM-to-LLM-Ready-Markdown Extractor
   *
   * Lightweight client-side parser: strips noise and converts structural HTML
   * (headings, code, lists, tables, paragraphs) to Markdown suitable for LLMs.
   *
   * Acknowledgment & Attribution:
   * The DOM cleaning and Markdown conversion logic in this module is inspired by
   * and adapted from the 'anydoc' open-source project by Firecrawl.
   *
   * @source https://github.com/firecrawl/anydoc
   * @license MIT (or applicable open-source license of the original repository)
   */
  function extractPageToLLMMarkdown() {
    // 1. Target the primary content container (fallback to body)
    const candidateSelectors = ['article', 'main', '[role="main"]', '.post-content', '.article-body', '#content', '.entry-content', '.markdown-body'];
    let rootElement = null;
    for (const sel of candidateSelectors) {
      const found = document.querySelector(sel);
      if (found && found.innerText && found.innerText.trim().length > 300) {
        rootElement = found;
        break;
      }
    }
    if (!rootElement) rootElement = document.body;

    // 2. Clone DOM to avoid mutating the live web page
    const clone = rootElement.cloneNode(true);

    // 3. Strip noise & extension artifacts
    const removeSelectors = [
      'script', 'style', 'noscript', 'iframe', 'svg', 'canvas', 'video', 'audio',
      'nav', 'footer', 'aside', 'header', '[role="banner"]', '[role="navigation"]', '[role="complementary"]',
      '#ai-orbit-root', '.ai-toast-notification', '.orbit-root',
      '.advertisement', '.ads', '.ad', '[class*="cookie"]', '[id*="cookie"]'
    ];
    try {
      clone.querySelectorAll(removeSelectors.join(', ')).forEach(el => el.remove());
    } catch (err) {}

    // 4. Recursive DOM to Markdown converter
    function parseNode(node) {
      if (!node) return '';
      if (node.nodeType === Node.TEXT_NODE) {
        return (node.textContent || '').replace(/\s+/g, ' ');
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return '';

      const tag = node.tagName.toLowerCase();
      // Skip hidden nodes
      try {
        const style = node.getAttribute && node.getAttribute('style');
        if (style && /display\s*:\s*none|visibility\s*:\s*hidden/i.test(style)) return '';
        if (node.getAttribute && node.getAttribute('hidden') != null) return '';
        if (node.getAttribute && node.getAttribute('aria-hidden') === 'true') return '';
      } catch (err) {}

      if (tag === 'pre') {
        const codeEl = node.querySelector && node.querySelector('code');
        const raw = (codeEl ? codeEl.textContent : node.textContent) || '';
        return `\n\n\`\`\`\n${raw.trim()}\n\`\`\`\n\n`;
      }

      const childrenMarkdown = Array.from(node.childNodes).map(parseNode).join('');

      switch (tag) {
        case 'h1': return `\n\n# ${childrenMarkdown.trim()}\n\n`;
        case 'h2': return `\n\n## ${childrenMarkdown.trim()}\n\n`;
        case 'h3': return `\n\n### ${childrenMarkdown.trim()}\n\n`;
        case 'h4': case 'h5': case 'h6':
          return `\n\n#### ${childrenMarkdown.trim()}\n\n`;
        case 'p': return `\n\n${childrenMarkdown.trim()}\n\n`;
        case 'strong': case 'b':
          return childrenMarkdown.trim() ? ` **${childrenMarkdown.trim()}** ` : '';
        case 'em': case 'i':
          return childrenMarkdown.trim() ? ` *${childrenMarkdown.trim()}* ` : '';
        case 'a': {
          const href = node.getAttribute('href');
          const linkText = childrenMarkdown.trim();
          if (href && linkText && !/^javascript:/i.test(href)) {
            return ` [${linkText}](${href}) `;
          }
          return linkText ? ` ${linkText} ` : '';
        }
        case 'code':
          // Inline code only when not inside pre (pre handled above)
          return childrenMarkdown.trim() ? ` \`${childrenMarkdown.trim()}\` ` : '';
        case 'ul': case 'ol':
          return `\n\n${childrenMarkdown.trim()}\n\n`;
        case 'li':
          return `\n* ${childrenMarkdown.trim()}`;
        case 'blockquote':
          return `\n\n> ${childrenMarkdown.trim().replace(/\n/g, '\n> ')}\n\n`;
        case 'br':
          return '\n';
        case 'hr':
          return '\n\n---\n\n';
        case 'img': {
          const alt = (node.getAttribute('alt') || '').trim();
          const src = node.getAttribute('src') || '';
          if (src && !src.startsWith('data:')) return alt ? ` ![${alt}](${src}) ` : ` ![](${src}) `;
          return alt ? ` ${alt} ` : '';
        }
        case 'table': {
          const rows = Array.from(node.querySelectorAll('tr'));
          if (!rows.length) return childrenMarkdown;
          const lines = [];
          rows.forEach((tr, ri) => {
            const cells = Array.from(tr.querySelectorAll('th, td')).map(c => (c.textContent || '').replace(/\s+/g, ' ').trim());
            if (!cells.length) return;
            lines.push('| ' + cells.join(' | ') + ' |');
            if (ri === 0) lines.push('| ' + cells.map(() => '---').join(' | ') + ' |');
          });
          return lines.length ? `\n\n${lines.join('\n')}\n\n` : childrenMarkdown;
        }
        case 'tr': case 'td': case 'th': case 'thead': case 'tbody': case 'tfoot':
          return childrenMarkdown;
        default:
          return childrenMarkdown;
      }
    }

    // 5. Clean and format metadata header
    const title = document.title || 'Untitled Document';
    const url = window.location.href;
    const rawMarkdown = parseNode(clone);

    // Normalize excessive line breaks and spaced punctuation
    const cleanMarkdown = rawMarkdown
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/[ \t]+$/gm, '')
      .trim();

    if (!cleanMarkdown) {
      return `### Document: ${title}\n**Source:** ${url}\n\n---\n\n`;
    }

    return `### Document: ${title}\n**Source:** ${url}\n\n---\n\n${cleanMarkdown}`;
  }

  function insertExtractedMarkdownToNotepad() {
    if (!noteTextarea) return;
    let md = '';
    try {
      md = extractPageToLLMMarkdown();
    } catch (err) {
      showToastNotification(t('toastExtractEmpty'), true);
      return;
    }
    const body = (md || '').split(/\n---\n/).slice(1).join('\n---\n').trim();
    if (!body) {
      showToastNotification(t('toastExtractEmpty'), true);
      return;
    }
    // Capture undo boundary so Ctrl+Z / Undo toggle can restore previous note
    if (notepadUndo) {
      try { notepadUndo.forceBoundary(); } catch (err) {}
    }
    noteTextarea.value = md;
    try {
      const end = noteTextarea.value.length;
      noteTextarea.setSelectionRange(end, end);
      noteTextarea.focus();
    } catch (err) {}
    if (typeof updateNoteTokenMeter === 'function') updateNoteTokenMeter();
    if (typeof saveNoteDraftDebounced === 'function') saveNoteDraftDebounced();
    if (typeof autoGrowNotepad === 'function') autoGrowNotepad();
    if (typeof syncUndoToggleVisual === 'function') syncUndoToggleVisual();
    showToastNotification(t('toastExtracted'));
  }

  function clearNoteWithUndo({ focus = true, notify = true } = {}) {
    // Smart Clear / Close (one button, two intents — without splitting the control):
    //   • Text present  → CLEAR only. Keep notepad open so the user can pick/search
    //     a new prompt or keep typing. Do NOT start the close countdown (that was
    //     the bug: countdown ran even while the user stayed inside the panel).
    //   • Already empty → CLOSE. User pressed the same key a second time; treat as
    //     "I'm done" and collapse the notepad.
    const hadText = !!(noteTextarea && noteTextarea.value.trim() !== '');
    endNoteEditSession();

    // Shared cleanup of text / undo / draft (both intents clear residual state)
    if (notepadUndo) {
      try { notepadUndo.clear(); } catch (err) {}
    }
    if (pendingUndoState && pendingUndoState.type === 'text') {
      pendingUndoState = { type: null, data: null, hub: 1 };
    }
    try {
      if (chrome.runtime?.id) {
        chrome.storage.local.remove(['aiTreeNotepadHistory']);
        chrome.storage.local.set({ savedPromptDraft: '' });
      }
    } catch (e) {}
    if (noteTextarea) {
      noteTextarea.value = '';
    }
    if (typeof updateNoteTokenMeter === 'function') updateNoteTokenMeter();
    if (typeof syncUndoToggleVisual === 'function') syncUndoToggleVisual();

    if (hadText) {
      // --- CLEAR only: stay open, cancel any pending close, refocus editor ---
      if (typeof abortNoteClosing === 'function') abortNoteClosing();
      // Keep pin state as-is (if they had pinned while drafting, leave it pinned)
      if (typeof resetNoteSizeToDefault === 'function') resetNoteSizeToDefault();
      else { quickNoteForm.style.width = ''; quickNoteForm.style.height = ''; }
      adjustNotepadPosition();
      resetToggleTimeout();
      if (focus && quickNoteForm.classList.contains('active') && noteTextarea) {
        try { noteTextarea.focus(); } catch (e) {}
      }
      if (notify) showToastNotification(t('toastNoteClearedOnly') || t('toastCleared'));
      return true;
    }

    // --- CLOSE: empty panel → undock + collapse countdown ---
    if (noteSplitSide) {
      noteSplitSide = null;
      quickNoteForm.classList.remove(
        'split-docked', 'split-left', 'split-right', 'split-top', 'split-bottom',
        'split-preview-left', 'split-preview-right', 'split-preview-top', 'split-preview-bottom'
      );
      if (typeof syncNoteSplitBtn === 'function') syncNoteSplitBtn();
    }
    if (typeof resetNoteSizeToDefault === 'function') resetNoteSizeToDefault();
    else { quickNoteForm.style.width = ''; quickNoteForm.style.height = ''; }
    noteManuallyPositioned = false;
    adjustNotepadPosition();
    resetToggleTimeout();
    isNotePinned = false;
    if (typeof stopNotepadIdleTimer === 'function') stopNotepadIdleTimer();
    if (typeof startCollapseCountdown === 'function') startCollapseCountdown();
    if (notify) showToastNotification(t('toastNoteClosed') || t('toastCleared'));
    return false;
  }
  // --- Inline translate via background service worker (CSP-safe) ---
  let noteTranslateBusy = false;

  // --- انتخاب صریح زبان مقصد ترجمه (به‌جای حدسِ خودکارِ قدیمی که فقط fa/en را
  // تشخیص می‌داد) — بک‌اند (background.js با sl=auto) از قبل هر زبانی را
  // به‌عنوان مقصد قبول می‌کند؛ فقط لازم بود این‌جا صراحتاً پرسیده شود. با هر
  // ۱۲ زبان افزونه کار می‌کند و در chrome.storage.local ذخیره/همگام می‌شود
  // تا بین ویجت و صفحهٔ نوت‌پد مستقل یکسان بماند.
  const TRANSLATE_LANGS = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'fa', label: 'فارسی', short: 'FA' },
    { code: 'ar', label: 'العربية', short: 'AR' },
    { code: 'es', label: 'Español', short: 'ES' },
    { code: 'de', label: 'Deutsch', short: 'DE' },
    { code: 'fr', label: 'Français', short: 'FR' },
    { code: 'ja', label: '日本語', short: 'JA' },
    { code: 'ru', label: 'Русский', short: 'RU' },
    { code: 'tr', label: 'Türkçe', short: 'TR' },
    { code: 'zh-Hans', label: '简体中文', short: '简' },
    { code: 'zh-Hant', label: '繁體中文', short: '繁' },
    { code: 'pt-BR', label: 'Português', short: 'PT' }
  ];

  function defaultTranslateTargetLang() {
    // پیش‌فرضِ اولیه — فقط تا وقتی کاربر خودش یک‌بار از منو انتخاب کند؛ بعد
    // از آن، انتخاب کاربر همیشه ثابت می‌ماند و دیگر با تغییر زبان افزونه
    // عوض نمی‌شود (چون دیگر «حدس» نیست، انتخاب صریح است).
    return currentLang === 'en' ? 'fa' : 'en';
  }

  let translateTargetLang = defaultTranslateTargetLang();
  try {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['translateTargetLang'], (res) => {
        if (res && res.translateTargetLang) {
          translateTargetLang = res.translateTargetLang;
          updateTranslateLangBadge();
        }
      });
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.translateTargetLang) {
          translateTargetLang = changes.translateTargetLang.newValue || defaultTranslateTargetLang();
          updateTranslateLangBadge();
        }
      });
    }
  } catch (e) {}

  function setTranslateTargetLang(code) {
    translateTargetLang = code;
    updateTranslateLangBadge();
    try { chrome.storage.local.set({ translateTargetLang: code }); } catch (e) {}
  }

  function updateTranslateLangBadge() {
    if (!uiEls.translateLangBtn) return;
    const entry = TRANSLATE_LANGS.find((l) => l.code === translateTargetLang);
    uiEls.translateLangBtn.textContent = entry ? entry.short : String(translateTargetLang).toUpperCase();
    const label = entry ? entry.label : translateTargetLang;
    uiEls.translateLangBtn.title = (t('translateTargetLabel') || 'Translate to') + ': ' + label;
    uiEls.translateLangBtn.setAttribute('aria-label', (t('translateTargetLabel') || 'Translate to') + ': ' + label);
  }

  let translateLangPopoverEl = null;
  function onTranslateLangOutsideClick(e) {
    if (translateLangPopoverEl && !translateLangPopoverEl.contains(e.target) && e.target !== uiEls.translateLangBtn) {
      closeTranslateLangPopover();
    }
  }
  function closeTranslateLangPopover() {
    if (!translateLangPopoverEl) return;
    document.removeEventListener('mousedown', onTranslateLangOutsideClick, true);
    translateLangPopoverEl.remove();
    translateLangPopoverEl = null;
  }
  function openTranslateLangPopover() {
    if (translateLangPopoverEl || !uiEls.translateLangBtn) return;
    ensureTranslationPopoverCSS();
    const pop = document.createElement('div');
    pop.className = 'ai-translate-lang-popover';
    pop.setAttribute('role', 'menu');
    pop.style.direction = isRTL(currentLang) ? 'rtl' : 'ltr';
    pop.innerHTML = TRANSLATE_LANGS.map((l) =>
      `<button type="button" class="ai-translate-lang-opt${l.code === translateTargetLang ? ' is-active' : ''}" data-lang="${l.code}">${escapeHtml(l.label)}</button>`
    ).join('');

    const anchor = quickNoteForm;
    anchor.appendChild(pop);
    const btnRect = uiEls.translateLangBtn.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    pop.style.position = 'absolute';
    pop.style.top = (btnRect.bottom - anchorRect.top + 6) + 'px';
    // اگر سمتِ راست جا نداشت، به چپِ دکمه بچسبد (برای جلوگیری از خروج از صفحه)
    const roomRight = window.innerWidth - btnRect.left;
    if (roomRight < 160) {
      pop.style.right = (anchorRect.right - btnRect.right) + 'px';
    } else {
      pop.style.left = (btnRect.left - anchorRect.left) + 'px';
    }

    pop.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-lang]');
      if (!btn) return;
      setTranslateTargetLang(btn.getAttribute('data-lang'));
      closeTranslateLangPopover();
    });

    translateLangPopoverEl = pop;
    requestAnimationFrame(() => pop.classList.add('visible'));
    setTimeout(() => document.addEventListener('mousedown', onTranslateLangOutsideClick, true), 50);
  }

  if (uiEls.translateLangBtn) {
    updateTranslateLangBadge();
    uiEls.translateLangBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (translateLangPopoverEl) closeTranslateLangPopover();
      else openTranslateLangPopover();
    });
  }

  function applyTranslatedNote(response, context) {
    if (!noteTextarea || !response || !response.text) return;
    context = context || { hasSelection: false, startPos: 0, endPos: 0 };
    if (typeof notepadUndo !== 'undefined' && notepadUndo) {
      try { notepadUndo.forceBoundary(); } catch (err) {}
    } else if (typeof beginNoteEditSessionIfNeeded === 'function') {
      try { beginNoteEditSessionIfNeeded(); } catch (err) {}
    }

    // جایگزینی هوشمند: اگر کاربر بخشی از متن را انتخاب کرده بود، فقط همان بخش
    // با ترجمه عوض می‌شود (نه کل یادداشت) — هم از پاک‌شدن کل متن جلوگیری
    // می‌کند، هم اجازه می‌دهد فقط یک کلمه انتخاب و ترجمه شود تا مترادف‌ها
    // (که گوگل فقط برای کلمات/عبارات کوتاه برمی‌گرداند) واقعاً نمایش داده شوند.
    let newCursorPos;
    if (context.hasSelection) {
      const val = noteTextarea.value;
      noteTextarea.value = val.slice(0, context.startPos) + response.text + val.slice(context.endPos);
      newCursorPos = context.startPos + response.text.length;
      noteTextarea.setSelectionRange(context.startPos, newCursorPos);
    } else {
      noteTextarea.value = response.text;
      newCursorPos = response.text.length;
      noteTextarea.setSelectionRange(newCursorPos, newCursorPos);
    }
    try { noteTextarea.focus(); } catch (err) {}

    if (typeof updateNoteTokenMeter === 'function') updateNoteTokenMeter();
    if (typeof saveNoteDraftDebounced === 'function') saveNoteDraftDebounced();
    // ترجمه محتوا را عوض می‌کند، پس قفل «کاربر دستی سایز داده» دیگر معتبر
    // نیست — وگرنه اگر کاربر قبلاً حتی یک‌بار گوشهٔ دفترچه را کشیده باشد،
    // autoGrowNotepad برای همیشه no-op می‌ماند و کادر بعد از ترجمه رشد نمی‌کند.
    if (typeof noteUserResized !== 'undefined') noteUserResized = false;
    if (typeof autoGrowNotepad === 'function') autoGrowNotepad();
    if (typeof abortNoteClosing === 'function') abortNoteClosing();
    if (typeof syncUndoToggleVisual === 'function') syncUndoToggleVisual();

    if (response.synonyms && response.synonyms.length > 0) {
      const replaceRange = context.hasSelection
        ? { start: context.startPos, end: newCursorPos }
        : { start: 0, end: newCursorPos };
      showTranslationSynonymsPopover(response.synonyms, replaceRange);
    } else {
      showToastNotification(t('toastTranslated'));
    }
  }

  function ensureTranslationPopoverCSS() {
    if (document.getElementById('ai-trans-popover-styles')) return;
    const style = document.createElement('style');
    style.id = 'ai-trans-popover-styles';
    style.textContent = `
      .ai-translate-synonyms-popover {
        position: absolute; top: 0; bottom: 0;
        width: 240px; max-width: 46%;
        overflow-y: auto;
        background: var(--glass-bg); backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur);
        padding: 14px 12px; box-shadow: var(--glass-shadow), 0 0 24px rgba(var(--accent-note), 0.14);
        font-family: var(--font-ui), "Vazirmatn", sans-serif;
        z-index: 50; opacity: 0;
        transition: opacity 0.24s var(--ease-premium), transform 0.28s var(--ease-bounce);
        pointer-events: none;
      }
      /* چسبیده به لبهٔ راست فرم، هم‌ارتفاع با خودِ نوت‌پد (بدون افتادن پایین آن) */
      .ai-translate-synonyms-popover.dock-right {
        right: 0; border-left: 1px solid rgba(var(--accent-note), 0.4);
        border-radius: 0 var(--glass-radius) var(--glass-radius) 0;
        transform: scaleX(0.92); transform-origin: right center;
      }
      .ai-translate-synonyms-popover.dock-left {
        left: 0; border-right: 1px solid rgba(var(--accent-note), 0.4);
        border-radius: var(--glass-radius) 0 0 var(--glass-radius);
        transform: scaleX(0.92); transform-origin: left center;
      }
      .ai-translate-synonyms-popover.visible {
        opacity: 1; transform: scaleX(1); pointer-events: auto;
      }
      .ai-translate-synonyms-popover::-webkit-scrollbar { width: 6px; }
      .ai-translate-synonyms-popover::-webkit-scrollbar-thumb {
        background: rgba(var(--accent-note), 0.35); border-radius: 3px;
      }
      .ai-syn-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 10px; font-size: 12.5px; font-weight: 700;
        color: rgba(167, 243, 208, 0.85); letter-spacing: 0.2px;
        border-bottom: 1px solid rgba(var(--accent-note), 0.18); padding-bottom: 8px;
      }
      .ai-syn-close {
        background: none; border: none; color: var(--c-neutral); cursor: pointer;
        font-size: 15px; line-height: 1; padding: 2px 4px; border-radius: 6px;
        transition: color 0.15s, background 0.15s;
      }
      .ai-syn-close:hover { color: #fff; background: rgba(var(--c-red-rgb, 239, 68, 68), 0.18); }
      .ai-syn-group { margin-bottom: 12px; }
      .ai-syn-type {
        display: inline-flex; align-items: center; gap: 5px;
        font-size: 10.5px; color: var(--c-emerald-light);
        margin-bottom: 7px; font-weight: 700; letter-spacing: 0.3px;
      }
      .ai-syn-type::before {
        content: ''; width: 5px; height: 5px; border-radius: 50%;
        background: var(--c-emerald); box-shadow: 0 0 6px var(--c-emerald);
      }
      .ai-syn-words { display: flex; flex-wrap: wrap; gap: 6px; }
      .ai-syn-chip {
        background: var(--matte-bg); border: 1px solid var(--matte-border);
        color: #E5E7EB; padding: 5px 10px; border-radius: 999px; font-size: 12px;
        font-family: inherit; cursor: pointer;
        transition: all 0.2s var(--ease-premium);
      }
      .ai-syn-chip.is-active {
        background: rgba(var(--accent-note), 0.3); border-color: var(--c-emerald); color: #fff;
      }
      .ai-syn-chip:hover {
        background: rgba(var(--accent-note), 0.22); border-color: var(--c-emerald);
        color: #fff; transform: translateY(-1px);
      }
      .ai-syn-footer {
        margin-top: 10px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.1);
        font-size: 10px; color: rgba(167, 243, 208, 0.55); text-align: center;
      }
      .ai-translate-lang-popover {
        min-width: 150px; max-height: 260px; overflow-y: auto;
        background: var(--glass-bg); backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur);
        border-radius: var(--glass-radius); box-shadow: var(--glass-shadow), 0 0 20px rgba(var(--accent-note), 0.14);
        padding: 6px; z-index: 60; opacity: 0; transform: translateY(-4px);
        transition: opacity 0.18s var(--ease-premium), transform 0.18s var(--ease-premium);
        pointer-events: none; font-family: var(--font-ui), "Vazirmatn", sans-serif;
      }
      .ai-translate-lang-popover.visible { opacity: 1; transform: translateY(0); pointer-events: auto; }
      .ai-translate-lang-popover::-webkit-scrollbar { width: 6px; }
      .ai-translate-lang-popover::-webkit-scrollbar-thumb {
        background: rgba(var(--accent-note), 0.35); border-radius: 3px;
      }
      .ai-translate-lang-opt {
        display: block; width: 100%; text-align: inherit;
        background: none; border: none; color: #E5E7EB;
        padding: 7px 10px; border-radius: 8px; font-size: 12.5px;
        font-family: inherit; cursor: pointer; transition: background 0.15s, color 0.15s;
      }
      .ai-translate-lang-opt:hover { background: rgba(var(--accent-note), 0.18); color: #fff; }
      .ai-translate-lang-opt.is-active {
        background: rgba(var(--accent-note), 0.3); color: #fff; font-weight: 700;
      }
    `;
    document.head.appendChild(style);
  }

  // نقش‌های دستوری‌ای که دیکشنری گوگل برمی‌گرداند، به فارسی نمایش داده می‌شوند
  // تا برچسب‌ها به‌جای واژه‌های خام انگلیسی (noun/verb/...) قابل‌فهم باشند.
  const TRANSLATE_POS_FA = {
    noun: 'اسم', verb: 'فعل', adjective: 'صفت', adverb: 'قید',
    pronoun: 'ضمیر', preposition: 'حرف اضافه', conjunction: 'حرف ربط',
    interjection: 'صوت', determiner: 'حرف تعریف', article: 'حرف تعریف',
    abbreviation: 'مخفف', exclamation: 'صوت', number: 'عدد', numeral: 'عدد'
  };
  function localizePos(type) {
    const key = String(type || '').toLowerCase().trim();
    if (currentLang === 'fa') return TRANSLATE_POS_FA[key] || type;
    return type;
  }

  // synonyms: [{type, words[]}]  |  replaceRange: {start, end} — بازه‌ای از
  // noteTextarea.value که با کلیک روی هر چیپ باید عوض شود (نه کل متن)
  function showTranslationSynonymsPopover(synonyms, replaceRange) {
    ensureTranslationPopoverCSS();
    const oldPopover = document.getElementById('ai-translate-synonyms-popover');
    if (oldPopover) oldPopover.remove();

    const popover = document.createElement('div');
    popover.id = 'ai-translate-synonyms-popover';
    popover.className = 'ai-translate-synonyms-popover';
    popover.style.direction = isRTL(currentLang) ? 'rtl' : 'ltr';

    let html = `<div class="ai-syn-header">
      <span>💡 ${t('synonymsPopoverTitle')}</span>
      <button class="ai-syn-close" aria-label="Close">✕</button>
    </div>`;

    // نکته: break داخل .forEach() غیرمجاز است (خطای سینتکسی)؛ اینجا از
    // for...of استفاده می‌شود تا بشود در متن‌های خیلی طولانی زودتر خارج شد.
    for (const syn of synonyms) {
      html += `<div class="ai-syn-group">
        <span class="ai-syn-type">${escapeHtml(localizePos(syn.type))}</span>
        <div class="ai-syn-words">`;
      syn.words.forEach((word) => {
        html += `<button class="ai-syn-chip" style="direction: auto;" data-word="${escapeHtml(word)}" title="${t('synonymChipTitle')}">${escapeHtml(word)}</button>`;
      });
      html += `</div></div>`;
      if (html.length > 15000) break; // جلوگیری از bloated DOM در متن‌های خیلی طولانی
    }
    html += `<div class="ai-syn-footer">${t('synonymFooter')}</div>`;

    popover.innerHTML = html;

    // چسبیده به لبهٔ نوت‌پد، داخل خودِ quickNoteForm — هم‌ارتفاع کامل با آن
    // (top:0/bottom:0)، بدون نیاز به محاسبهٔ مختصاتِ شکنندهٔ «بالای کلمه».
    quickNoteForm.appendChild(popover);
    const formRect = quickNoteForm.getBoundingClientRect();
    const roomRight = window.innerWidth - formRect.right;
    const roomLeft = formRect.left;
    // اگر سمتِ راستِ نوت‌پد جا نداشت ولی چپش داشت، به چپ می‌چسبد؛ در غیر این
    // صورت جهتِ متن (fa=راست‌به‌چپ → سمت چپ طبیعی‌تر) تعیین‌کننده است.
    const dockLeft = roomRight < 40 && roomLeft >= 40 ? true
      : (roomLeft < 40 && roomRight >= 40 ? false : currentLang === 'fa');
    popover.classList.add(dockLeft ? 'dock-left' : 'dock-right');

    let outsideClickHandler = null;
    function closePopover() {
      if (outsideClickHandler) {
        document.removeEventListener('mousedown', outsideClickHandler, true);
        outsideClickHandler = null;
      }
      popover.classList.remove('visible');
      setTimeout(() => popover.remove(), 250);
    }

    requestAnimationFrame(() => popover.classList.add('visible'));

    // متنِ «تایید‌شده»ٔ فعلی — پیش‌نمایش هاور موقتاً آن را عوض می‌کند و با خروج
    // موس به همین مقدار برمی‌گردد؛ فقط کلیک این مقدار را برای همیشه به‌روز می‌کند.
    let baseText = noteTextarea.value;

    popover.querySelectorAll('.ai-syn-chip').forEach((chip) => {
      const word = chip.dataset.word;

      chip.addEventListener('mouseenter', () => {
        noteTextarea.value = baseText.slice(0, replaceRange.start) + word + baseText.slice(replaceRange.end);
      });

      chip.addEventListener('mouseleave', () => {
        noteTextarea.value = baseText;
      });

      chip.addEventListener('click', () => {
        baseText = baseText.slice(0, replaceRange.start) + word + baseText.slice(replaceRange.end);
        noteTextarea.value = baseText;
        const newPos = replaceRange.start + word.length;
        noteTextarea.setSelectionRange(replaceRange.start, newPos);
        replaceRange.end = newPos; // کلیک بعدی، همین کلمهٔ تازه را جایگزین می‌کند نه بازهٔ اصلی را

        popover.querySelectorAll('.ai-syn-chip.is-active').forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');

        if (typeof updateNoteTokenMeter === 'function') updateNoteTokenMeter();
        if (typeof saveNoteDraftDebounced === 'function') saveNoteDraftDebounced();
        if (typeof autoGrowNotepad === 'function') autoGrowNotepad();
        noteTextarea.focus();
      });
    });

    const closeBtn = popover.querySelector('.ai-syn-close');
    if (closeBtn) closeBtn.addEventListener('click', closePopover);

    outsideClickHandler = (e) => {
      if (!popover.contains(e.target) && e.target !== uiEls.translateBtn) closePopover();
    };
    setTimeout(() => document.addEventListener('mousedown', outsideClickHandler, true), 100);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function requestNoteTranslation(text, targetLang) {
    return new Promise((resolve, reject) => {
      try {
        if (!chrome.runtime || !chrome.runtime.id) {
          reject(new Error('no_extension_runtime'));
          return;
        }
        chrome.runtime.sendMessage(
          { action: 'translateText', text: text, targetLang: targetLang },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message || 'no_receiver'));
              return;
            }
            if (response && response.success && typeof response.text === 'string') {
              resolve(response); // کل آبجکت { text, synonyms } — نه فقط response.text
            } else {
              reject(new Error((response && response.error) || 'translate_failed'));
            }
          }
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  // After a hard rate-limit, ignore further translate clicks briefly so the
  // user cannot immediately re-flood the same endpoint that background.js
  // just finished backing off against.
  let noteTranslateCooldownUntil = 0;

  async function runNoteTranslate() {
    if (noteTranslateBusy) return;
    if (Date.now() < noteTranslateCooldownUntil) {
      showToastNotification(t('toastTranslateRateLimited'), true);
      return;
    }
    if (typeof abortNoteClosing === 'function') abortNoteClosing();

    // اگر کاربر بخشی از متن را انتخاب کرده باشد، فقط همان بخش ترجمه می‌شود —
    // این هم از پاک‌شدن کل یادداشت جلوگیری می‌کند و هم راه اصلیِ دیدن
    // مترادف‌هاست، چون دیکشنری گوگل فقط برای عبارات کوتاه/تک‌کلمه‌ای مترادف می‌دهد.
    const startPos = noteTextarea ? noteTextarea.selectionStart : 0;
    const endPos = noteTextarea ? noteTextarea.selectionEnd : 0;
    const hasSelection = startPos !== endPos;
    const textVal = hasSelection
      ? noteTextarea.value.slice(startPos, endPos).trim()
      : (noteTextarea ? noteTextarea.value.trim() : '');

    if (!textVal) {
      showToastNotification(t('toastTranslateEmpty') || t('dockEmptyPrompt'), true);
      return;
    }
    if (textVal.length > 4500) {
      showToastNotification(t('toastTranslateTooLong'), true);
      return;
    }
    const targetLang = translateTargetLang;
    const btn = uiEls.translateBtn;
    noteTranslateBusy = true;
    if (btn) {
      btn.classList.add('is-busy');
      btn.style.opacity = '0.55';
      btn.disabled = true;
    }
    showToastNotification(t('toastTranslateBusy'));
    try {
      const response = await requestNoteTranslation(textVal, targetLang);
      applyTranslatedNote(response, { hasSelection, startPos, endPos }); // toast/پاپ‌اور مناسب داخل خودِ این تابع نشان داده می‌شود
    } catch (err) {
      console.warn('[AI Tree] translate failed:', err);
      const errMsg = (err && err.message) || '';
      let toastMsg;
      if (/rate_limited/.test(errMsg)) {
        toastMsg = t('toastTranslateRateLimited');
        // ~4s client gate — background already retried with backoff; this only
        // stops an immediate manual re-click from starting a new burst.
        noteTranslateCooldownUntil = Date.now() + 4000;
      } else if (/network_offline/.test(errMsg)) toastMsg = t('toastTranslateOffline');
      else if (/network_error/.test(errMsg)) toastMsg = t('toastTranslateNetworkError');
      else toastMsg = t('toastTranslateFail');
      showToastNotification(toastMsg, true);
    } finally {
      noteTranslateBusy = false;
      if (btn) {
        btn.classList.remove('is-busy');
        btn.style.opacity = '';
        btn.disabled = false;
      }
    }
  }

  if (uiEls.translateBtn) {
    uiEls.translateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      runNoteTranslate();
    });
  }

  // --- خواندن با صدا (Web Speech API) — روی همان window میزبان اجرا می‌شود، بدون تب جدید ---
  let noteIsSpeaking = false;
  function detectNoteSpeechLang(text) {
    const fa = (text.match(/[\u0600-\u06FF]/g) || []).length;
    const la = (text.match(/[A-Za-z]/g) || []).length;
    return fa > la ? 'fa-IR' : 'en-US';
  }
  function stopNoteTTS() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    noteIsSpeaking = false;
    if (uiEls.ttsBtn) {
      uiEls.ttsBtn.classList.remove('active');
      uiEls.ttsBtn.title = t('noteTtsTitle');
      uiEls.ttsBtn.setAttribute('aria-label', t('noteTtsTitle'));
    }
  }
  function runNoteTTS() {
    if (!('speechSynthesis' in window)) {
      showToastNotification(t('toastTtsUnsupported'), true);
      return;
    }
    // اگر همین الان در حال خواندن است، همین دکمه نقش توقف را ایفا کند
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      stopNoteTTS();
      showToastNotification(t('toastTtsStopped'));
      return;
    }
    const textVal = noteTextarea ? noteTextarea.value.trim() : '';
    if (!textVal) {
      showToastNotification(t('toastTranslateEmpty') || t('dockEmptyPrompt'), true);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textVal);
    utterance.lang = detectNoteSpeechLang(textVal);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find(v => v.lang === utterance.lang)
      || voices.find(v => v.lang && v.lang.startsWith(utterance.lang.slice(0, 2)))
      || voices.find(v => v.name.includes('Google US English'));
    if (matchingVoice) utterance.voice = matchingVoice;

    utterance.onstart = () => {
      noteIsSpeaking = true;
      if (uiEls.ttsBtn) {
        uiEls.ttsBtn.classList.add('active');
        uiEls.ttsBtn.title = t('noteTtsStopTitle');
        uiEls.ttsBtn.setAttribute('aria-label', t('noteTtsStopTitle'));
      }
    };
    utterance.onend = () => stopNoteTTS();
    utterance.onerror = () => stopNoteTTS();

    window.speechSynthesis.speak(utterance);
  }
  if (uiEls.ttsBtn) {
    uiEls.ttsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      runNoteTTS();
    });
  }

  // --- Hybrid spell-check: offline Persian normalizer + LanguageTool for English ---
  let noteSpellcheckBusy = false;

  /**
   * Offline normalizer for Persian text.
   * Arabic→Persian chars, ZWNJ for prefixes/suffixes, punctuation spacing.
   */
  function normalizePersianText(raw) {
    if (!raw) return raw;
    let fixed = raw;
    const zwnj = '\u200C';

    // Arabic yeh/kaf → Persian
    fixed = fixed.replace(/\u064A/g, '\u06CC').replace(/\u0643/g, '\u06A9');

    // Prefixes: می / نمی + space → ZWNJ
    fixed = fixed.replace(/\b(ن?می)\s+(?=[\u0600-\u06FF])/g, '$1' + zwnj);

    // Common suffixes with ZWNJ
    fixed = fixed.replace(
      /(?<=[\u0600-\u06FF])\s+(ها|های|هایی|تر|ترین|ام|ات|اش|مان|تان|شان|ای|ایم|اید|اند)\b/g,
      zwnj + '$1'
    );

    // Punctuation: no space before, one space after
    fixed = fixed.replace(/\s+([،؛:?.!])/g, '$1');
    fixed = fixed.replace(/([،؛:?.!])(?=[\u0600-\u06FFa-zA-Z])/g, '$1 ');

    // Collapse multiple spaces (keep newlines)
    fixed = fixed.replace(/[^\S\n]{2,}/g, ' ');

    return fixed.trim();
  }

  function requestNoteSpellcheck(text, lang) {
    return new Promise((resolve, reject) => {
      try {
        if (!chrome.runtime || !chrome.runtime.id) {
          reject(new Error('no_extension_runtime'));
          return;
        }
        chrome.runtime.sendMessage(
          { action: 'checkSpelling', text: text, lang: lang },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message || 'no_receiver'));
              return;
            }
            if (response && response.success && Array.isArray(response.matches)) {
              resolve(response.matches);
            } else {
              reject(new Error((response && response.error) || 'spellcheck_failed'));
            }
          }
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  function applySpellcheckCorrections(originalText, matches) {
    if (!matches || !matches.length) return { text: originalText, count: 0 };
    const sorted = matches.slice().sort((a, b) => (b.offset || 0) - (a.offset || 0));
    let corrected = originalText;
    let count = 0;
    sorted.forEach((match) => {
      if (!match || !match.replacements || !match.replacements.length) return;
      const best = match.replacements[0] && match.replacements[0].value;
      if (best == null) return;
      const start = match.offset | 0;
      const length = match.length | 0;
      if (start < 0 || length <= 0 || start + length > corrected.length) return;
      corrected = corrected.slice(0, start) + best + corrected.slice(start + length);
      count++;
    });
    return { text: corrected, count };
  }

  function applyNoteTextAndRefresh(newText) {
    if (!noteTextarea) return;
    if (typeof notepadUndo !== 'undefined' && notepadUndo) {
      try { notepadUndo.forceBoundary(); } catch (err) {}
    } else if (typeof beginNoteEditSessionIfNeeded === 'function') {
      try { beginNoteEditSessionIfNeeded(); } catch (err) {}
    }
    noteTextarea.value = newText;
    try {
      const end = noteTextarea.value.length;
      noteTextarea.setSelectionRange(end, end);
      noteTextarea.focus();
    } catch (err) {}
    if (typeof updateNoteTokenMeter === 'function') updateNoteTokenMeter();
    if (typeof saveNoteDraftDebounced === 'function') saveNoteDraftDebounced();
    if (typeof autoGrowNotepad === 'function') autoGrowNotepad();
    if (typeof abortNoteClosing === 'function') abortNoteClosing();
    if (typeof syncUndoToggleVisual === 'function') syncUndoToggleVisual();
  }

  async function runNoteSpellcheck() {
    if (noteSpellcheckBusy) return;
    if (typeof abortNoteClosing === 'function') abortNoteClosing();
    const textVal = noteTextarea ? noteTextarea.value : '';
    if (!textVal || !textVal.trim()) {
      showToastNotification(t('toastTranslateEmpty') || t('dockEmptyPrompt'), true);
      return;
    }

    const isPersian = /[\u0600-\u06FF]/.test(textVal);
    const btn = uiEls.spellcheckBtn;

    // ---------- OFFLINE: Persian normalizer ----------
    if (isPersian) {
      const cleaned = normalizePersianText(textVal);
      if (cleaned === textVal) {
        showToastNotification(t('toastSpellcheckFaClean'));
        return;
      }
      applyNoteTextAndRefresh(cleaned);
      showToastNotification(t('toastSpellcheckFaFixed'));
      return;
    }

    // ---------- ONLINE: English via LanguageTool ----------
    if (textVal.length > 20000) {
      showToastNotification(t('toastSpellcheckLong'), true);
      return;
    }
    noteSpellcheckBusy = true;
    if (btn) {
      btn.classList.add('is-busy');
      btn.style.opacity = '0.55';
      btn.disabled = true;
    }
    showToastNotification(t('toastSpellcheckBusy'));
    try {
      const matches = await requestNoteSpellcheck(textVal, 'en-US');
      if (!matches.length) {
        showToastNotification(t('toastSpellcheckNone'));
        return;
      }
      const { text: corrected, count } = applySpellcheckCorrections(textVal, matches);
      if (count <= 0) {
        showToastNotification(t('toastSpellcheckNoSuggest'), true);
        return;
      }
      applyNoteTextAndRefresh(corrected);
      showToastNotification(t('toastSpellcheckFixed').replace('{n}', String(count)));
    } catch (err) {
      console.warn('[AI Tree] spellcheck failed:', err);
      showToastNotification(t('toastSpellcheckFail'), true);
    } finally {
      noteSpellcheckBusy = false;
      if (btn) {
        btn.classList.remove('is-busy');
        btn.style.opacity = '';
        btn.disabled = false;
      }
    }
  }

  if (uiEls.spellcheckBtn) {
    uiEls.spellcheckBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      runNoteSpellcheck();
    });
  }

  if (uiEls.extractDocBtn) {
    uiEls.extractDocBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      insertExtractedMarkdownToNotepad();
    });
  }
  if (uiEls.tplSearch) {
    uiEls.tplSearch.addEventListener('click', (e) => e.stopPropagation());
    uiEls.tplSearch.addEventListener('input', () => {
      promptSearchQuery = uiEls.tplSearch.value.trim();
      renderNoteTemplates();
    });
  }
  document.getElementById('ai-note-clear-btn').addEventListener('click', (e) => { e.stopPropagation(); clearNoteWithUndo(); });
  document.getElementById('ai-note-copy-btn').addEventListener('click', (e) => { e.stopPropagation(); const textToCopy = noteTextarea ? noteTextarea.value : ''; if (!textToCopy.trim()) return; if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(textToCopy).then(() => { showToastNotification(t('toastCopied')); }).catch(() => { fallbackCopyText(textToCopy); }); } else fallbackCopyText(textToCopy); });
  document.getElementById('ai-save-txt-btn').addEventListener('click', (e) => { e.stopPropagation(); const textToSave = noteTextarea ? noteTextarea.value : ''; if (!textToSave.trim()) return; const blob = new Blob([textToSave], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'AI_Note_' + new Date().getTime() + '.txt'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); showToastNotification(t('toastDownloaded')); });

  // --- Smart Split Button + Ribbon Popover: pick which Core AI gets the prompt, remember the choice ---
  // Note: most AI chat sites do NOT reliably support prefilling via a "?q=" URL parameter
  // (only ChatGPT documents it; Claude/Gemini/DeepSeek ignore it or have removed it).
  // So instead we copy the prompt to the clipboard and open the chat — this works with 100% of sites.
  // Fixed catalog of popular AIs for notepad dispatch (independent of core bookmark slots)

  // ============================================================================
  // Emoji memory tray + Social share (X / Telegram / LinkedIn / Facebook)
  // ============================================================================
  // DEFAULT_FAVORITE_EMOJIS + favoriteEmojis بالاتر تعریف شده‌اند
  const EMOJI_PICKER_GRID = [
    '😀','😊','🥰','😎','🤔','😂','🙌','👏',
    '✨','🔥','💡','📌','✅','❌','⚠️','💬',
    '🌱','🎯','🚀','⭐','❤️','💙','💜','🖤',
    '📝','📚','🧠','⚡','🛠️','🎨','🎵','☕'
  ];

  function loadEmojiMemory() {
    try {
      if (!chrome.runtime?.id) return;
      chrome.storage.local.get(['aiTreeEmojiMemory'], (res) => {
        if (res && Array.isArray(res.aiTreeEmojiMemory) && res.aiTreeEmojiMemory.length) {
          favoriteEmojis = res.aiTreeEmojiMemory.filter(e => typeof e === 'string' && e).slice(0, 12);
          renderEmojiTray();
        }
      });
    } catch (e) {}
  }

  function saveEmojiMemory() {
    try {
      if (chrome.runtime?.id) chrome.storage.local.set({ aiTreeEmojiMemory: favoriteEmojis });
    } catch (e) {}
  }

  function pushEmojiToMemory(emoji) {
    if (!emoji) return;
    favoriteEmojis = [emoji, ...favoriteEmojis.filter(e => e !== emoji)].slice(0, 10);
    renderEmojiTray();
    saveEmojiMemory();
  }

  function insertEmojiAtCursor(emoji) {
    if (!noteTextarea || !emoji) return;
    if (typeof abortNoteClosing === 'function') abortNoteClosing();
    if (typeof beginNoteEditSessionIfNeeded === 'function') beginNoteEditSessionIfNeeded();
    const start = noteTextarea.selectionStart || 0;
    const end = noteTextarea.selectionEnd || 0;
    const val = noteTextarea.value;
    noteTextarea.value = val.slice(0, start) + emoji + val.slice(end);
    const pos = start + [...emoji].length; // code-point safe-ish
    noteTextarea.setSelectionRange(pos, pos);
    noteTextarea.focus();
    pushEmojiToMemory(emoji);
    if (typeof updateNoteTokenMeter === 'function') updateNoteTokenMeter();
    if (typeof saveNoteDraftDebounced === 'function') saveNoteDraftDebounced();
    if (typeof autoGrowNotepad === 'function') autoGrowNotepad();
  }

  function renderEmojiTray() {
    // Inline tray removed — curated memory is shown inside the "more" popover only.
    if (!Array.isArray(favoriteEmojis) || !favoriteEmojis.length) {
      favoriteEmojis = (typeof DEFAULT_FAVORITE_EMOJIS !== 'undefined' ? DEFAULT_FAVORITE_EMOJIS : ['✨','📌','🔥','💡']).slice();
    }
  }

  function renderEmojiPopover() {
    const pop = uiEls.emojiPopover || document.getElementById('ai-emoji-popover');
    if (!pop) return;
    pop.innerHTML = '';
    if (!Array.isArray(favoriteEmojis) || !favoriteEmojis.length) {
      favoriteEmojis = (typeof DEFAULT_FAVORITE_EMOJIS !== 'undefined' ? DEFAULT_FAVORITE_EMOJIS : ['✨','📌','🔥','💡']).slice();
    }

    const addGrid = (titleText, list, extraClass) => {
      if (!list || !list.length) return;
      const title = document.createElement('div');
      title.className = 'ai-emoji-popover-title';
      title.textContent = titleText;
      pop.appendChild(title);
      const grid = document.createElement('div');
      grid.className = 'ai-emoji-grid' + (extraClass ? ' ' + extraClass : '');
      list.forEach((emoji) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ai-emoji-item';
        btn.textContent = emoji;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          insertEmojiAtCursor(emoji);
          pop.classList.remove('active');
        });
        grid.appendChild(btn);
      });
      pop.appendChild(grid);
    };

    addGrid(t('emojiTrayTitle'), favoriteEmojis.slice(), 'is-memory');
    const seen = new Set(favoriteEmojis);
    const more = (typeof EMOJI_PICKER_GRID !== 'undefined' ? EMOJI_PICKER_GRID : []).filter((e) => {
      if (seen.has(e)) return false;
      seen.add(e);
      return true;
    });
    addGrid(t('emojiMoreTitle'), more, '');
  }

  function toggleEmojiPopover(force) {
    const pop = uiEls.emojiPopover;
    if (!pop) return;
    const open = force === true ? true : force === false ? false : !pop.classList.contains('active');
    if (open) {
      // Mutual exclusion: close online vault while "more" is open
      if (typeof closeOnlineEmojiModal === 'function') closeOnlineEmojiModal();
      renderEmojiPopover();
      pop.classList.add('active');
      if (uiEls.socialPopover) uiEls.socialPopover.classList.remove('active');
    } else {
      pop.classList.remove('active');
    }
  }

  // سبک: اگر کاربر ایموجی از کیبورد تایپ کرد، به حافظه اضافه شود
  const EMOJI_CHAR_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  function harvestTypedEmoji(prev, next) {
    if (!next || next.length <= (prev || '').length) return;
    // فقط کاراکترهای اضافه‌شده را بررسی کن
    let i = 0;
    while (i < (prev || '').length && i < next.length && prev[i] === next[i]) i++;
    const added = next.slice(i, i + 8);
    const m = added.match(EMOJI_CHAR_RE);
    if (m) pushEmojiToMemory(m[0]);
  }

  // --- Social share ---
  // سقف طول متن قبل از انکود شدن در URL؛ هم از رسیدن به محدودیت طول URL مرورگر/سیستم‌عامل
  // جلوگیری می‌کند و هم از برش خاموش و بی‌اطلاع‌کننده‌ی خودِ شبکه‌های اجتماعی
  const SHARE_MAX_LEN = 3800;
  // رنگ هر بج مطابق برند خودِ شبکه، اما با همان الگوی «پس‌زمینه‌ی کم‌رنگ + متن پررنگ» که دکمه‌های
  // toolbar (پاک‌کردن/کپی/ذخیره) از قبل استفاده می‌کنند — برای هم‌خوانی بصری با بقیه‌ی نوت‌پد
  const TEXT_SOCIAL_NETWORKS = [
    { id: 'x', labelKey: 'shareX', icon: '𝕏', bg: 'rgba(255,255,255,0.16)', fg: '#fff', buildUrl: (text) => 'https://x.com/intent/post?text=' + encodeURIComponent(text) },
    // واتساپ: wa.me پارامتر text را مستقیماً در باکس پیام پر می‌کند (بدون مشکل og:tags که فیسبوک/لینکدین
    // دارند)، پس نیازی به کلیپ‌بورد نیست. عمداً از web.whatsapp.com/send استفاده نکردیم چون آن آدرس
    // صفحه‌ی واسط را رد می‌کند و برای کاربری که از قبل در WhatsApp Web لاگین نیست می‌شکند؛ wa.me آدرس
    // رسمی و مطمئنی است که هم به وب و هم به اپ دسکتاپ/موبایل به‌درستی می‌رسد
    { id: 'wa', labelKey: 'shareWhatsApp', icon: 'W', bg: 'rgba(37,211,102,0.20)', fg: '#25D366', buildUrl: (text) => 'https://wa.me/?text=' + encodeURIComponent(text) },
    // لینکدین هم دقیقاً مثل فیسبوک از سال ۲۰۱۸ پارامترهای متنی (title/summary/text) را در sharer نادیده
    // می‌گیرد؛ endpoint فعلی‌اش (share-offsite) فقط url می‌گیرد و پیش‌نمایش را از og:tags همان صفحه
    // می‌سازد. پس مثل فیسبوک به الگوی کپی‌در‌کلیپ‌بورد + بازکردن فید سوییچ می‌کنیم
    { id: 'in', labelKey: 'shareLinkedIn', icon: 'in', bg: 'rgba(10,102,194,0.20)', fg: '#5B9BD5', needsClipboard: true, buildUrl: () => 'https://www.linkedin.com/feed/' },
    // فیسبوک از سال ۲۰۱۸ پارامتر quote/متن دلخواه را در sharer.php نادیده می‌گیرد و کارت اشتراک را فقط
    // از og:tags آدرس u می‌سازد. راه‌حل u=آدرس‌فعلی هم ریسک دارد: همیشه کارت/پیش‌نمایش صفحه‌ای که کاربر
    // در همان لحظه باز داشته پیوست می‌شود، نه یادداشتش — همان مشکل اطلاعات اضافه‌ی گزارش‌شده، فقط با یک
    // سایت دیگر به‌جای x.com. چون فیسبوک اصلاً از اشتراک متن خام پشتیبانی نمی‌کند، ساده‌ترین و
    // صادقانه‌ترین راه: کپی در کلیپ‌بورد + باز کردن فید تمیز فیسبوک بدون هیچ لینک ضمیمه‌ای
    { id: 'fb', labelKey: 'shareFacebook', icon: 'f', bg: 'rgba(24,119,242,0.20)', fg: '#1877F2', needsClipboard: true, buildUrl: () => 'https://www.facebook.com/' }
  ];

  function renderSocialPopover() {
    const pop = uiEls.socialPopover || document.getElementById('ai-social-popover');
    if (!pop) return;
    pop.innerHTML = '';
    const frag = document.createDocumentFragment();
    TEXT_SOCIAL_NETWORKS.forEach((net, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ai-social-item';
      btn.setAttribute('data-network', net.id);
      btn.setAttribute('role', 'menuitem');
      // roving tabindex: فقط اولین آیتم قابل tab است، بقیه با arrow key در دسترس‌اند (الگوی استاندارد منوها)
      btn.tabIndex = i === 0 ? 0 : -1;
      btn.innerHTML = '<span>' + t(net.labelKey) + '</span>' +
        '<span class="ai-social-item-icon" style="background:' + net.bg + ';color:' + net.fg + ';">' + net.icon + '</span>';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        shareToTextNetwork(net.id);
        closeSocialPopover(true);
      });
      frag.appendChild(btn);
    });
    pop.appendChild(frag);
  }

  // موقعیت‌دهی پاپ‌اور نسبت به فضای واقعی ویوپورت — همان الگویی که پنل‌های دیگر (تودو/تقویم/جستجو)
  // در این فایل استفاده می‌کنند، تا وقتی نوت‌پد نزدیک لبه‌ی بالا/کنار صفحه یا در حالت split-docked باز
  // است، منوی اشتراک بیرون از دید کاربر کلیپ نشود
  function positionSocialPopover() {
    const pop = uiEls.socialPopover;
    const btn = uiEls.socialToggleBtn;
    if (!pop || !btn) return;
    const btnRect = btn.getBoundingClientRect();
    const popW = pop.offsetWidth || 158;
    const popH = pop.offsetHeight || 180;
    const vw = window.innerWidth, vh = window.innerHeight;
    const opensUp = (btnRect.top - popH - 8) >= 0 || (btnRect.top - popH - 8) > (vh - btnRect.bottom - popH - 8);
    pop.classList.toggle('flip-down', !opensUp);
    const fitsEnd = (btnRect.right - popW) >= 0; // با inset-inline-end:0 یعنی لبه‌ی راست پاپ‌اور روی لبه‌ی راست دکمه است
    pop.classList.toggle('align-start', !fitsEnd && (btnRect.left + popW) <= vw);
    pop.style.transformOrigin = (opensUp ? 'bottom' : 'top') + ' ' + (fitsEnd ? 'right' : 'left');
  }

  function closeSocialPopover(returnFocus) {
    if (!uiEls.socialPopover || !uiEls.socialPopover.classList.contains('active')) return;
    uiEls.socialPopover.classList.remove('active', 'flip-down', 'align-start');
    if (uiEls.socialToggleBtn) {
      uiEls.socialToggleBtn.setAttribute('aria-expanded', 'false');
      if (returnFocus) uiEls.socialToggleBtn.focus();
    }
  }

  function socialPopoverKeydown(e) {
    const items = Array.from(uiEls.socialPopover ? uiEls.socialPopover.querySelectorAll('.ai-social-item') : []);
    if (!items.length) return;
    const currentIdx = Math.max(0, items.findIndex(el => el === document.activeElement));
    const focusIdx = (idx) => {
      items.forEach((el, i) => { el.tabIndex = i === idx ? 0 : -1; });
      items[idx].focus();
    };
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      focusIdx((currentIdx + dir + items.length) % items.length);
    } else if (e.key === 'Home') {
      e.preventDefault(); focusIdx(0);
    } else if (e.key === 'End') {
      e.preventDefault(); focusIdx(items.length - 1);
    } else if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      closeSocialPopover(true);
    } else if (e.key === 'Tab') {
      closeSocialPopover(false);
    }
  }

  let lastShareAt = 0;
  function shareToTextNetwork(networkId) {
    // جلوگیری از باز شدن چند پنجره/کپی چندباره روی کلیک‌های پیاپی یا دوباره‌فراخوانی تصادفی؛
    // به‌جای شکست خاموش، دکمه‌ی toggle حالت "busy" می‌گیرد تا کاربر بفهمد کلیکش ثبت شده
    const now = Date.now();
    if (now - lastShareAt < 500) return;
    lastShareAt = now;
    if (uiEls.socialToggleBtn) {
      uiEls.socialToggleBtn.classList.add('is-busy');
      setTimeout(() => uiEls.socialToggleBtn.classList.remove('is-busy'), 500);
    }

    const raw = noteTextarea ? noteTextarea.value : '';
    // حذف کاراکترهای نامرئی (zero-width / BOM) پیش از بررسیِ خالی بودن، وگرنه trim() به‌تنهایی آن‌ها را نمی‌گیرد
    const text = raw.replace(/[\u200B\u200C\u200D\uFEFF]/g, '').trim();
    if (!text) {
      showToastNotification(t('shareEmpty'), true);
      return;
    }
    const net = TEXT_SOCIAL_NETWORKS.find(n => n.id === networkId);
    if (!net) return;

    const clipped = text.length > SHARE_MAX_LEN ? text.slice(0, SHARE_MAX_LEN) + '…' : text;
    if (clipped !== text) showToastNotification(t('shareTruncated'), true);

    const finish = () => {
      const url = net.buildUrl(clipped);
      window.open(url, '_blank', 'noopener,noreferrer');
      // برای شبکه‌هایی که فقط کپی می‌کنیم (لینکدین/فیسبوک) از همان کلید ترجمه‌ای استفاده می‌کنیم که
      // فیچر Ask-AI برای الگوی مشابهش دارد (dockCopiedOpen)، به‌جای تعریف پیام تکراری جدید
      showToastNotification(t(net.needsClipboard ? 'dockCopiedOpen' : 'shareOpened').replace('{name}', t(net.labelKey)));
    };

    if (net.needsClipboard) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(clipped).then(finish, () => {
          // اگر Clipboard API async شکست بخورد (دسترسی رد شده/کانتکست غیر امن)، از fallback همزمانِ
          // execCommand که همین‌الان برای دیسپچ Ask-AI در کدبیس وجود دارد استفاده می‌کنیم
          fallbackCopyTextForDispatch(clipped);
          finish();
        });
      } else {
        fallbackCopyTextForDispatch(clipped);
        finish();
      }
    } else {
      finish();
    }
    if (typeof abortNoteClosing === 'function') abortNoteClosing();
  }


  // ============================================================================
  // Online emoji vault — lazy fetch + chrome.storage.local cache (opt-in only)
  // نیاز به host_permissions برای CDN در manifest.json
  // ============================================================================
  const EMOJI_CDN_URLS = [
    'https://cdn.jsdelivr.net/npm/@emoji-mart/data@latest/sets/15/native.json',
    'https://unpkg.com/@emoji-mart/data@latest/sets/15/native.json',
    'https://cdn.jsdelivr.net/npm/unicode-emoji-json@latest/data-by-group.json',
    'https://unpkg.com/unicode-emoji-json@latest/data-by-group.json'
  ];
  const EMOJI_CACHE_KEY = 'aiTreeOnlineEmojiCache_v5'; // Unicode 15 / larger catalog
  const EMOJI_CACHE_MAX_ITEMS = 5000;
  let cachedOnlineEmojis = null; // [{ e, n }]
  let onlineEmojiLoadPromise = null;

  // --- Infinite scroll state for online emoji vault ---
  let currentEmojiResults = [];
  let currentEmojiRenderIndex = 0;
  const EMOJI_CHUNK_SIZE = 100;
  let emojiIntersectionObserver = null;

  // Expanded FA → EN search hints for the large catalog
  const EMOJI_FA_HINTS = {
    'آتش': 'fire', 'شعله': 'fire', 'قلب': 'heart', 'عشق': 'heart', 'دوست': 'love',
    'خنده': 'grin', 'لبخند': 'smile', 'گریه': 'cry', 'اشک': 'tear', 'ناراحت': 'sad',
    'کتاب': 'book', 'ستاره': 'star', 'ماه': 'moon', 'خورشید': 'sun', 'گل': 'flower',
    'درخت': 'tree', 'ماشین': 'car', 'هواپیما': 'airplane', 'موشک': 'rocket',
    'کامپیوتر': 'computer', 'کد': 'laptop', 'تلفن': 'phone', 'موسیقی': 'music', 'آهنگ': 'song',
    'غذا': 'food', 'قهوه': 'coffee', 'چای': 'tea', 'کیک': 'cake', 'سیب': 'apple',
    'ورزش': 'sport', 'فوتبال': 'soccer', 'برنده': 'trophy', 'هدیه': 'gift', 'کادو': 'present',
    'تیک': 'check', 'خطا': 'cross', 'هشدار': 'warning', 'ایده': 'bulb', 'فکر': 'think',
    'پین': 'pushpin', 'یادداشت': 'memo', 'چشم': 'eye', 'دست': 'hand', 'انگشت': 'finger',
    'حیوان': 'animal', 'سگ': 'dog', 'گربه': 'cat', 'پرنده': 'bird', 'پول': 'money',
    'زمان': 'time', 'ساعت': 'clock', 'خانه': 'house', 'خواب': 'sleep', 'بیمار': 'sick',
    'سلام': 'wave', 'تشویق': 'clap', 'آفرین': 'thumbs up', 'جشن': 'party tada',
    'تولد': 'birthday cake', 'ایران': 'flag'
  };

  function normalizeEmojiQuery(raw) {
    let q = String(raw || '').trim().toLowerCase();
    if (!q) return '';
    // اگر کلمه فارسی بود، معادل انگلیسی را هم اضافه کن
    Object.keys(EMOJI_FA_HINTS).forEach((fa) => {
      if (q.includes(fa)) q += ' ' + EMOJI_FA_HINTS[fa];
    });
    return q;
  }

  function flattenEmojiCdnData(data) {
    const out = [];
    const seen = new Set();
    const pushItem = (emoji, primaryName, extraTags) => {
      if (!emoji || seen.has(emoji)) return;
      seen.add(emoji);
      const primary = String(primaryName || '').trim();
      const tags = Array.isArray(extraTags) ? extraTags.filter(Boolean).join(' ') : String(extraTags || '');
      const blob = (primary + ' ' + tags).toLowerCase().replace(/\s+/g, ' ').trim();
      out.push({ e: emoji, n: blob });
    };
    // emoji-mart native.json: { emojis: { id: { name, keywords, skins:[{native}] } } }
    if (data && data.emojis && typeof data.emojis === 'object' && !Array.isArray(data.emojis)) {
      Object.keys(data.emojis).forEach((id) => {
        const entry = data.emojis[id];
        if (!entry || typeof entry !== 'object') return;
        const native = (entry.skins && entry.skins[0] && (entry.skins[0].native || entry.skins[0].emoji))
          || entry.native || entry.emoji || entry.char;
        const keywords = [].concat(entry.keywords || [], entry.emoticons || [], id, entry.name || []);
        pushItem(native, entry.name || id, keywords);
      });
      return out.slice(0, EMOJI_CACHE_MAX_ITEMS);
    }
    const walkGroup = (group) => {
      if (!group) return;
      const list = group.emojis || group.emoji || (Array.isArray(group) ? group : null);
      if (!Array.isArray(list)) return;
      list.forEach((item) => {
        if (typeof item === 'string') pushItem(item, '', '');
        else if (item && typeof item === 'object') {
          pushItem(item.emoji || item.char || item.e || item.native, item.name || item.slug || item.n || '', [].concat(item.slug || [], item.group || []));
        }
      });
    };
    if (Array.isArray(data)) {
      data.forEach(walkGroup);
    } else if (data && typeof data === 'object') {
      Object.keys(data).forEach((k) => {
        const v = data[k];
        if (v && typeof v === 'object' && (v.emoji || v.char || v.native) && !v.emojis) {
          pushItem(v.emoji || v.char || v.native, v.description || v.name || k, [].concat(v.aliases || [], v.tags || [], k));
        } else walkGroup(v);
      });
    }
    return out.slice(0, EMOJI_CACHE_MAX_ITEMS);
  }

  function loadOnlineEmojisFromStorage() {
    return new Promise((resolve) => {
      try {
        if (!chrome.runtime?.id) { resolve(null); return; }
        chrome.storage.local.get([EMOJI_CACHE_KEY], (res) => {
          const pack = res && res[EMOJI_CACHE_KEY];
          if (pack && Array.isArray(pack.items) && pack.items.length > 50) {
            resolve(pack.items);
          } else resolve(null);
        });
      } catch (e) { resolve(null); }
    });
  }

  function saveOnlineEmojisToStorage(items) {
    try {
      if (chrome.runtime?.id) {
        chrome.storage.local.set({
          [EMOJI_CACHE_KEY]: { ts: Date.now(), items: items.slice(0, EMOJI_CACHE_MAX_ITEMS) }
        });
      }
    } catch (e) {}
  }

  async function fetchOnlineEmojis() {
    if (cachedOnlineEmojis && cachedOnlineEmojis.length) return cachedOnlineEmojis;
    if (onlineEmojiLoadPromise) return onlineEmojiLoadPromise;

    onlineEmojiLoadPromise = (async () => {
      const fromStore = await loadOnlineEmojisFromStorage();
      if (fromStore && fromStore.length) {
        cachedOnlineEmojis = fromStore;
        return cachedOnlineEmojis;
      }

      let lastErr = null;
      for (let i = 0; i < EMOJI_CDN_URLS.length; i++) {
        try {
          const res = await fetch(EMOJI_CDN_URLS[i], { credentials: 'omit', cache: 'force-cache' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const data = await res.json();
          const flat = flattenEmojiCdnData(data);
          if (flat.length < 20) throw new Error('empty catalog');
          cachedOnlineEmojis = flat;
          saveOnlineEmojisToStorage(flat);
          return cachedOnlineEmojis;
        } catch (err) {
          lastErr = err;
        }
      }
      console.warn('[AI Tree] Online emoji fetch failed:', lastErr);
      // fallback: local picker grid only
      cachedOnlineEmojis = (typeof EMOJI_PICKER_GRID !== 'undefined' ? EMOJI_PICKER_GRID : []).map((e) => ({ e, n: '' }));
      return cachedOnlineEmojis;
    })();

    try {
      return await onlineEmojiLoadPromise;
    } finally {
      // allow retry later if completely empty
      if (!cachedOnlineEmojis || !cachedOnlineEmojis.length) onlineEmojiLoadPromise = null;
    }
  }

  function ensureOnlineEmojiModal() {
    let modal = document.getElementById('ai-emoji-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'ai-emoji-modal';
    modal.className = 'ai-emoji-modal';
    modal.innerHTML =
      '<div class="ai-emoji-modal-head">' +
        '<span class="ai-emoji-modal-title" id="ai-emoji-modal-title"></span>' +
        '<button type="button" class="ai-emoji-modal-close" id="ai-emoji-modal-close" aria-label="Close">✕</button>' +
      '</div>' +
      '<input type="text" id="ai-emoji-search-input" class="ai-emoji-search-input" autocomplete="off" dir="auto" />' +
      '<div id="ai-emoji-grid-wrap" class="ai-emoji-grid-wrap"></div>';
    quickNoteForm.appendChild(modal);

    const searchInput = modal.querySelector('#ai-emoji-search-input');
    let searchTimer = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => renderOnlineEmojiGrid(searchInput.value), 80);
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeOnlineEmojiModal(); }
    });
    modal.querySelector('#ai-emoji-modal-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closeOnlineEmojiModal();
    });
    return modal;
  }

  function renderOnlineEmojiGrid(queryRaw) {
    const grid = document.getElementById('ai-emoji-grid-wrap');
    if (!grid) return;

    // Disconnect previous infinite-scroll observer on new search
    if (emojiIntersectionObserver) {
      try { emojiIntersectionObserver.disconnect(); } catch (e) {}
      emojiIntersectionObserver = null;
    }

    const q = normalizeEmojiQuery(queryRaw);
    const source = cachedOnlineEmojis || [];

    if (!q) {
      currentEmojiResults = source;
    } else {
      const parts = q.split(/\s+/).filter(Boolean);
      currentEmojiResults = source.filter((item) => {
        const hay = ((item.n || '') + ' ' + (item.e || '')).toLowerCase();
        return parts.every((p) => hay.includes(p) || (item.e && item.e.includes(p)));
      });
    }

    currentEmojiRenderIndex = 0;
    grid.innerHTML = '';

    if (!currentEmojiResults.length) {
      const empty = document.createElement('div');
      empty.className = 'ai-emoji-loading';
      empty.textContent = t('emojiOnlineEmpty');
      grid.appendChild(empty);
      return;
    }

    renderNextEmojiChunk(grid);
  }

  function renderNextEmojiChunk(grid) {
    if (!grid) return;
    const frag = document.createDocumentFragment();
    const endIndex = Math.min(currentEmojiRenderIndex + EMOJI_CHUNK_SIZE, currentEmojiResults.length);

    for (let i = currentEmojiRenderIndex; i < endIndex; i++) {
      const item = currentEmojiResults[i];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ai-emoji-cell';
      btn.textContent = item.e;
      btn.title = item.n || item.e;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        insertEmojiAtCursor(item.e);
        closeOnlineEmojiModal();
      });
      frag.appendChild(btn);
    }

    currentEmojiRenderIndex = endIndex;

    const oldSentinel = grid.querySelector('.ai-emoji-sentinel');
    if (oldSentinel) oldSentinel.remove();

    grid.appendChild(frag);

    if (currentEmojiRenderIndex < currentEmojiResults.length) {
      const sentinel = document.createElement('div');
      sentinel.className = 'ai-emoji-sentinel';
      sentinel.style.gridColumn = '1 / -1';
      sentinel.style.height = '12px';
      grid.appendChild(sentinel);

      emojiIntersectionObserver = new IntersectionObserver((entries) => {
        if (entries[0] && entries[0].isIntersecting) {
          try { emojiIntersectionObserver.disconnect(); } catch (e) {}
          emojiIntersectionObserver = null;
          renderNextEmojiChunk(grid);
        }
      }, { root: grid, rootMargin: '120px' });

      emojiIntersectionObserver.observe(sentinel);
    }
  }

  function closeOnlineEmojiModal() {
    const modal = document.getElementById('ai-emoji-modal');
    if (modal) modal.classList.remove('active');
  }

  async function openOnlineEmojiRepository() {
    if (typeof abortNoteClosing === 'function') abortNoteClosing();
    // Mutual exclusion: close local "more" popover while online vault is open
    if (uiEls.emojiPopover) uiEls.emojiPopover.classList.remove('active');
    if (uiEls.socialPopover) uiEls.socialPopover.classList.remove('active');
    const modal = ensureOnlineEmojiModal();
    const titleEl = modal.querySelector('#ai-emoji-modal-title');
    const searchInput = modal.querySelector('#ai-emoji-search-input');
    const grid = modal.querySelector('#ai-emoji-grid-wrap');
    if (titleEl) titleEl.textContent = t('emojiOnlineTitle');
    if (searchInput) {
      searchInput.placeholder = t('emojiOnlineSearch');
      searchInput.value = '';
    }
    if (grid) {
      grid.innerHTML = '<div class="ai-emoji-loading">' + t('emojiOnlineLoading') + '</div>';
    }
    modal.classList.add('active');

    try {
      await fetchOnlineEmojis();
      renderOnlineEmojiGrid('');
      if (searchInput) setTimeout(() => searchInput.focus(), 30);
    } catch (err) {
      if (grid) grid.innerHTML = '<div class="ai-emoji-loading">' + t('emojiOnlineError') + '</div>';
    }
  }

  function ensureOnlineEmojiButton() {
    const btn = (uiEls && uiEls.emojiOnlineBtn) || document.getElementById('ai-emoji-online-btn');
    if (!btn || btn.dataset.wired === '1') return;
    btn.dataset.wired = '1';
    btn.title = t('emojiOnlineBtn');
    if (!btn.textContent.trim()) btn.textContent = '🌐';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const modal = document.getElementById('ai-emoji-modal');
      if (modal && modal.classList.contains('active')) closeOnlineEmojiModal();
      else openOnlineEmojiRepository();
    });
  }



  function setupEmojiAndShareUI() {
    loadEmojiMemory();
    renderEmojiTray();
    ensureOnlineEmojiButton();
    renderSocialPopover();
    if (uiEls.socialToggleLabel) uiEls.socialToggleLabel.textContent = t('shareBtn');
    if (uiEls.socialToggleBtn) uiEls.socialToggleBtn.title = t('shareTitle');
    if (uiEls.emojiToggleBtn) {
      uiEls.emojiToggleBtn.title = t('emojiMoreTitle');
      uiEls.emojiToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleEmojiPopover();
      });
    }
    if (uiEls.socialToggleBtn && uiEls.socialPopover) {
      uiEls.socialToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = !uiEls.socialPopover.classList.contains('active');
        if (open) {
          if (uiEls.emojiPopover) uiEls.emojiPopover.classList.remove('active');
          uiEls.socialPopover.classList.add('active');
          uiEls.socialToggleBtn.setAttribute('aria-expanded', 'true');
          positionSocialPopover();
          // فوکوس روی اولین آیتم برای کاربران کیبورد/screen-reader؛ کلیک ماوس هم مشکلی ندارد چون
          // بلافاصله روی یک آیتم واقعی قرار می‌گیرد که قابل کلیک است
          const first = uiEls.socialPopover.querySelector('.ai-social-item');
          if (first) first.focus();
        } else {
          closeSocialPopover(false);
        }
      });
      uiEls.socialPopover.addEventListener('keydown', socialPopoverKeydown);
    }
    document.addEventListener('click', (e) => {
      if (uiEls.emojiPopover && uiEls.emojiWrap && !uiEls.emojiWrap.contains(e.target)) {
        uiEls.emojiPopover.classList.remove('active');
      }
      if (uiEls.socialPopover && uiEls.socialWrap && !uiEls.socialWrap.contains(e.target)) {
        closeSocialPopover(false);
      }
      const modal = document.getElementById('ai-emoji-modal');
      if (modal && modal.classList.contains('active')) {
        if (!modal.contains(e.target) && !e.target.closest('#ai-emoji-online-btn')) {
          closeOnlineEmojiModal();
        }
      }
    });
    // اگر پنجره ریسایز شود یا نوت‌پد جابه‌جا/تغییر اندازه شود، پاپ‌اور بازِ اشتراک باید یا موقعیتش
    // به‌روز شود یا (ساده و امن‌تر) بسته شود تا هیچ‌وقت خارج از دید یا روی محل اشتباه نماند
    window.addEventListener('resize', () => closeSocialPopover(false));
  }
  // بعد از تعریف ماژول ایموجی/اشتراک — جلوگیری از TDZ روی favoriteEmojis
  setupEmojiAndShareUI();



  const AI_DISPATCH_CATALOG = [
    { id: 'chatgpt',    label: 'ChatGPT',    short: 'GPT',      url: 'https://chatgpt.com',              qParam: 'q',  color: '#10A37F' },
    { id: 'claude',     label: 'Claude',     short: 'Claude',   url: 'https://claude.ai',                qParam: null, color: '#D97757' },
    { id: 'gemini',     label: 'Gemini',     short: 'Gemini',   url: 'https://gemini.google.com/app',    qParam: null, color: '#4C8DF6' },
    { id: 'deepseek',   label: 'DeepSeek',   short: 'Seek',     url: 'https://chat.deepseek.com',        qParam: null, color: '#5B7CFA' },
    { id: 'grok',       label: 'Grok',       short: 'Grok',     url: 'https://grok.com',                 qParam: 'q',  color: '#B4B8C2' },
    { id: 'perplexity', label: 'Perplexity', short: 'Perplex',  url: 'https://www.perplexity.ai',        qParam: 'q',  color: '#22B8CF' },
    { id: 'copilot',    label: 'Copilot',    short: 'Copilot',  url: 'https://copilot.microsoft.com',    qParam: 'q',  color: '#3B9DF5' },
    { id: 'mistral',    label: 'Mistral',    short: 'Mistral',  url: 'https://chat.mistral.ai',          qParam: null, color: '#FF7A2F' },
    { id: 'qwen',       label: 'Qwen',       short: 'Qwen',     url: 'https://chat.qwen.ai',             qParam: null, color: '#9B6BF2' },
    { id: 'pi',         label: 'Pi',         short: 'Pi',       url: 'https://pi.ai/talk',               qParam: null, color: '#FF8FAE' },
    { id: 'metaai',     label: 'Meta AI',    short: 'Meta',     url: 'https://www.meta.ai',              qParam: null, color: '#0668E1' },
    { id: 'poe',        label: 'Poe',        short: 'Poe',      url: 'https://poe.com',                  qParam: null, color: '#6F42F5' },
    { id: 'you',        label: 'You.com',    short: 'You',      url: 'https://you.com',                  qParam: null, color: '#4E5EF2' },
    { id: 'huggingchat',label: 'HuggingChat',short: 'Hugging',  url: 'https://huggingface.co/chat',      qParam: null, color: '#FF9D00' },
    { id: 'kimi',       label: 'Kimi',       short: 'Kimi',     url: 'https://www.kimi.com',             qParam: null, color: '#6C4EFF' }
  ];
  const AI_WHEEL_VISIBLE_ROWS = 5; // چند ردیف هم‌زمان دیده شود (با ۱۵ مدل، ۵ ردیف زمینهٔ بهتری می‌دهد)

  // آیتم‌هایی که پارامتر q دارند مستقیماً پرشده باز می‌شوند؛ بقیه فقط با کپی/پیست
  function aiMethodGlyph(node) { return node && node.qParam ? '⚡' : '📋'; }
  function aiMethodLabel(node) { return (node && node.qParam) ? t('dockMethodAuto') : t('dockMethodCopy'); }

  // پیش‌فرض: ChatGPT (ارسال مستقیم با ?q=)
  const DEFAULT_NOTE_AI_ID = 'chatgpt';
  function indexOfAiId(id) {
    const i = AI_DISPATCH_CATALOG.findIndex(n => n && n.id === id);
    return i >= 0 ? i : 0;
  }
  let activeNoteAIIndex = indexOfAiId(DEFAULT_NOTE_AI_ID); // index into AI_DISPATCH_CATALOG

  /**
   * Builds a platform-optimized target URL.
   * Injects the catalog's qParam (e.g. ?q=) when that service supports prompt auto-fill.
   * AI_DISPATCH_CATALOG.qParam is the single source of truth for this — every entry
   * declares it explicitly ('q' or null), so no hostname guessing happens here.
   */
  function buildAiDispatchUrl(baseUrl, promptText, qParam) {
    if (!baseUrl || !promptText || !qParam) return baseUrl || '';
    try {
      const parsedUrl = new URL(baseUrl);
      parsedUrl.searchParams.set(qParam, promptText.trim());
      return parsedUrl.toString();
    } catch (err) {
      console.warn('[AI Tree] URL parse failed, falling back to raw base URL:', err);
      return baseUrl;
    }
  }

  /**
   * Shared low-level execCommand('copy') fallback (used by both the dispatch
   * flow below and the generic copy button near line ~4480, so the temp
   * textarea creation/cleanup logic lives in exactly one place).
   */
  function copyTextViaHiddenTextarea(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try { document.execCommand('copy'); } catch (err) { /* silent */ }
    document.body.removeChild(textArea);
  }

  /**
   * Lightweight clipboard fallback for dispatch only (does NOT clear notepad, no toast).
   */
  function fallbackCopyTextForDispatch(text) {
    copyTextViaHiddenTextarea(text);
  }

  /**
   * Hybrid dispatch:
   * 1. Always copy prompt to clipboard (universal safety net).
   * 2. Hosts with qParam → open URL with ?q= for auto-fill + clipboard fallback.
   * 3. Others → open base site; user pastes with Ctrl/Cmd+V.
   * 4. Apple-style zoom-out on notepad, then open tab.
   */
  function sendPromptToNode(node) {
    const promptText = (noteTextarea && noteTextarea.value) ? noteTextarea.value.trim() : '';
    if (!promptText) {
      showToastNotification(t('dockEmptyPrompt'), true);
      return;
    }

    if (typeof pushPromptHistory === 'function') pushPromptHistory(promptText);

    const targetUrl = buildAiDispatchUrl(node.url, promptText, node.qParam);

    const openTab = () => {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    };

    const notifyThenOpen = () => {
      const msgKey = node.qParam ? 'dockOpenedFilled' : 'dockCopiedOpen';
      showToastNotification(t(msgKey).replace('{name}', node.label));
      quickNoteForm.classList.add('dispatching');
      setTimeout(() => {
        openTab();
        closeTree();
        closeAllPanelsExcept('');
        quickNoteForm.classList.remove('dispatching');
      }, 600);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(promptText)
        .then(notifyThenOpen)
        .catch((err) => {
          console.warn('[AI Tree] Clipboard API failed, using fallback:', err);
          fallbackCopyTextForDispatch(promptText);
          notifyThenOpen();
        });
    } else {
      fallbackCopyTextForDispatch(promptText);
      notifyThenOpen();
    }
  }

  const AI_WHEEL_ITEM_H = 26; // px — باید با ارتفاع .ai-wheel-item در CSS یکی باشد

  // محدودهٔ سخت [0 .. n-1] — بدون چرخش دایره‌ای تا در ابتدا/انتها پرش نکند
  function clampAiIndex(idx) {
    const n = AI_DISPATCH_CATALOG.length;
    if (n === 0) return 0;
    if (idx < 0) return 0;
    if (idx > n - 1) return n - 1;
    return idx | 0;
  }

  let persistAiIndexTimer = null;
  function setActiveAiIndex(idx, persist) {
    activeNoteAIIndex = clampAiIndex(idx);
    if (persist !== false) {
      clearTimeout(persistAiIndexTimer);
      persistAiIndexTimer = setTimeout(() => {
        try { if (chrome.runtime?.id) chrome.storage.local.set({ activeNoteAIIndex }); } catch (err) {}
      }, 250);
    }
    renderSmartRibbon();
  }
  // انتخاب فعلی را فوراً (بدون تأخیر) ذخیره کن — پیش از ارسال یا وقتی چرخ بسته می‌شود
  function commitActiveAiIndex() {
    clearTimeout(persistAiIndexTimer);
    try { if (chrome.runtime?.id) chrome.storage.local.set({ activeNoteAIIndex }); } catch (err) {}
  }

  function isAiWheelOpen() {
    return !!(uiEls.wheelPopover && uiEls.wheelPopover.classList.contains('active'));
  }

  function openAiWheel() {
    if (!uiEls.wheelPopover || !uiEls.sendActionBtn) return;
    uiEls.wheelPopover.classList.add('active');
    uiEls.sendActionBtn.classList.add('wheel-open');
    renderSmartRibbon();
  }

  function closeAiWheel() {
    if (!uiEls.wheelPopover || !uiEls.sendActionBtn) return;
    uiEls.wheelPopover.classList.remove('active');
    uiEls.sendActionBtn.classList.remove('wheel-open');
    wheelScrubActive = false;
    wheelScrubStartY = null;
    commitActiveAiIndex();
  }

  function renderSmartRibbon() {
    const list = uiEls.wheelList;
    const viewport = uiEls.wheelViewport;
    const wrapper = uiEls.sendWrapper;
    const actionBtn = uiEls.sendActionBtn;
    if (!list || !viewport || !wrapper || !actionBtn) return;

    const catalog = AI_DISPATCH_CATALOG;
    if (!catalog.length) {
      list.innerHTML = '';
      uiEls.sendLabelEl.textContent = t('dockNoCore');
      actionBtn.disabled = true;
      wrapper.style.opacity = '0.5';
      return;
    }
    wrapper.style.opacity = '';
    actionBtn.disabled = false;
    activeNoteAIIndex = clampAiIndex(activeNoteAIIndex);
    const active = catalog[activeNoteAIIndex];

    // رنگ برند آیتم فعال را به کل ویجت (حاشیه/گلوی هاور + نوار هایلایت چرخ) تزریق می‌کند
    // تا انتخاب واقعاً «رنگی» به‌نظر برسد، نه یک سبز ثابت یکنواخت
    wrapper.style.setProperty('--ai-active-color', active.color || '#10B981');

    // دکمهٔ فشرده: نقطهٔ رنگی برند + نام + آیکن روش ارجاع (⚡ پرشونده خودکار / 📋 کپی-پیست)
    const actionLabelKey = active.verb === 'post' ? 'dockPostName' : 'dockAskName';
    if (uiEls.sendDot) {
      // هم background و هم color ست می‌شود چون گلوی CSS (box-shadow: 0 0 6px currentColor)
      // به‌جای رنگ زمینه، به «color» عنصر وابسته است — قبلاً فقط background ست می‌شد و گلو رنگ برند را نشان نمی‌داد
      uiEls.sendDot.style.background = active.color || '#fff';
      uiEls.sendDot.style.color = active.color || '#fff';
    }
    if (uiEls.sendLabelEl) uiEls.sendLabelEl.textContent = t(actionLabelKey).replace('{name}', active.short || active.label);
    if (uiEls.sendMethodEl) uiEls.sendMethodEl.textContent = aiMethodGlyph(active);
    actionBtn.title = t(actionLabelKey).replace('{name}', active.label) + ' · ' + aiMethodLabel(active);
    wrapper.title = actionBtn.title;

    list.innerHTML = '';
    const n = catalog.length;
    catalog.forEach((node, idx) => {
      // فاصلهٔ خطی تا مرکز (بدون wrap) تا در لبهٔ لیست پرش بصری نباشد
      const raw = idx - activeNoteAIIndex;
      const dist = Math.abs(raw);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ai-wheel-item' + (idx === activeNoteAIIndex ? ' is-active' : '');
      btn.dataset.index = String(idx);

      const dot = document.createElement('span'); dot.className = 'ai-wheel-item-dot'; dot.style.background = node.color || '#fff'; dot.style.color = node.color || '#fff';
      const label = document.createElement('span'); label.className = 'ai-wheel-item-label'; label.textContent = node.short || node.label;
      const method = document.createElement('span'); method.className = 'ai-wheel-item-method'; method.textContent = aiMethodGlyph(node);
      btn.appendChild(dot); btn.appendChild(label); btn.appendChild(method);
      btn.title = node.label + ' · ' + aiMethodLabel(node);

      // ذره‌بین: مرکز واضح، اطراف محو/کوچک — فقط برای آیتم‌های نزدیک به مرکز
      const scale = dist > 3 ? 0.72 : Math.max(0.78, 1 - dist * 0.08);
      const opacity = idx === activeNoteAIIndex ? 1 : (dist > 3 ? 0.12 : Math.max(0.22, 1 - dist * 0.28));
      const blur = idx === activeNoteAIIndex ? 0 : Math.min(1.6, dist * 0.4);
      const rotateX = Math.max(-28, Math.min(28, raw * 14));
      btn.style.opacity = String(opacity);
      btn.style.filter = blur ? `blur(${blur}px)` : 'none';
      btn.style.transform = `perspective(360px) rotateX(${rotateX}deg) scale(${scale})`;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (idx === activeNoteAIIndex) {
          closeAiWheel();
          sendPromptToNode(node);
        } else {
          setActiveAiIndex(idx);
        }
      });
      list.appendChild(btn);
    });

    const centerRow = Math.floor(AI_WHEEL_VISIBLE_ROWS / 2);
    const offset = (activeNoteAIIndex * AI_WHEEL_ITEM_H) - (centerRow * AI_WHEEL_ITEM_H);
    list.style.transform = `translateY(${-offset}px)`;
  }

  // --- باز/بسته شدن با هاور موس (بهینه برای کاربر ماوس) + پشتیبانی کلیک/کیبورد ---
  let wheelOpenTimer = null, wheelCloseTimer = null;
  function scheduleOpenWheel() { clearTimeout(wheelCloseTimer); wheelOpenTimer = setTimeout(openAiWheel, 150); }
  function scheduleCloseWheel() { clearTimeout(wheelOpenTimer); wheelCloseTimer = setTimeout(closeAiWheel, 260); }

  if (uiEls.sendWrapper) {
    uiEls.sendWrapper.addEventListener('mouseenter', scheduleOpenWheel);
    uiEls.sendWrapper.addEventListener('mouseleave', scheduleCloseWheel);
    uiEls.sendWrapper.addEventListener('focusin', () => { clearTimeout(wheelCloseTimer); openAiWheel(); });
    uiEls.sendWrapper.addEventListener('focusout', (e) => {
      if (uiEls.sendWrapper.contains(e.relatedTarget)) return;
      closeAiWheel();
    });
    uiEls.sendWrapper.addEventListener('keydown', (e) => {
      if (!isAiWheelOpen()) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAiWheel(); } return; }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (activeNoteAIIndex > 0) setActiveAiIndex(activeNoteAIIndex - 1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (activeNoteAIIndex < AI_DISPATCH_CATALOG.length - 1) setActiveAiIndex(activeNoteAIIndex + 1);
      } else if (e.key === 'PageUp') {
        // پرش ۵تایی — با ۱۵ مورد، رسیدن به انتهای لیست فقط با ArrowUp/Down کند است
        e.preventDefault();
        setActiveAiIndex(clampAiIndex(activeNoteAIIndex - 5));
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        setActiveAiIndex(clampAiIndex(activeNoteAIIndex + 5));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setActiveAiIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setActiveAiIndex(AI_DISPATCH_CATALOG.length - 1);
      }
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const node = AI_DISPATCH_CATALOG[clampAiIndex(activeNoteAIIndex)];
        if (node && node.url) { closeAiWheel(); sendPromptToNode(node); }
      } else if (e.key === 'Escape') { e.preventDefault(); closeAiWheel(); }
      else if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        // تایپ حرف اول اسم = جستجوی نوع‌ای (type-ahead)؛ به نزدیک‌ترین تطابق بعدی می‌پرد (چرخشی)
        e.preventDefault();
        const letter = e.key.toLowerCase();
        const n = AI_DISPATCH_CATALOG.length;
        for (let step = 1; step <= n; step++) {
          const idx = (activeNoteAIIndex + step) % n;
          if (AI_DISPATCH_CATALOG[idx].label.toLowerCase().startsWith(letter)) {
            setActiveAiIndex(idx);
            break;
          }
        }
      }
    });
  }

  // کلیک روی دکمهٔ فشرده: اگر چرخ بسته است بازش کن (لمسی/بدون‌ماوس)، اگر باز است یعنی مرکز را می‌فرستد
  if (uiEls.sendActionBtn) {
    uiEls.sendActionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isAiWheelOpen()) { openAiWheel(); return; }
      const node = AI_DISPATCH_CATALOG[clampAiIndex(activeNoteAIIndex)];
      if (!node || !node.url) return;
      closeAiWheel();
      sendPromptToNode(node);
    });
  }

  // اسکرول روی چرخ = یک پلهٔ گسسته؛ در ابتدا/انتها متوقف می‌شود (بدون wrap)
  if (uiEls.wheelViewport) {
    let wheelLock = false;
    uiEls.wheelViewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (wheelLock) return;
      const next = activeNoteAIIndex + (e.deltaY > 0 ? 1 : -1);
      const clamped = clampAiIndex(next);
      if (clamped === activeNoteAIIndex) return; // لبهٔ لیست — هیچ پرشی نباشد
      wheelLock = true;
      setActiveAiIndex(clamped);
      setTimeout(() => { wheelLock = false; }, 90);
    }, { passive: false });
  }

  // اسکراب فقط با «فشردن و کشیدنِ» موس فعال می‌شود، نه صرفِ عبور موس روی چرخ.
  // باگ قبلی: هر حرکتِ موس (حتی هنگام نزدیک شدن برای کلیک روی آیتم اول/آخر) لیست را
  // دوباره مرکزچین می‌کرد، پس دقیقاً همان آیتمی که کاربر می‌خواست کلیک کند زیر نشانگرش
  // جابه‌جا می‌شد — این «پرش» بیشترین اثر را روی لبه‌های لیست داشت چون بیشترین مسافتِ
  // حرکتِ موس (و در نتیجه بیشترین تعداد مرکزچینی‌های میانی) مربوط به رسیدن به همان لبه‌هاست.
  let wheelScrubActive = false, wheelScrubStartY = null, wheelScrubStartIndex = 0, wheelScrubRaf = null, wheelScrubLatestY = null;
  function endWheelScrub() {
    wheelScrubActive = false;
    wheelScrubStartY = null;
    if (wheelScrubRaf) { cancelAnimationFrame(wheelScrubRaf); wheelScrubRaf = null; }
  }
  if (uiEls.wheelViewport) {
    uiEls.wheelViewport.addEventListener('mousedown', (e) => {
      wheelScrubActive = true;
      wheelScrubStartY = e.clientY;
      wheelScrubLatestY = e.clientY;
      wheelScrubStartIndex = activeNoteAIIndex;
    });
    uiEls.wheelViewport.addEventListener('mousemove', (e) => {
      if (!wheelScrubActive || wheelScrubStartY === null) return;
      wheelScrubLatestY = e.clientY;
      if (wheelScrubRaf) return;
      wheelScrubRaf = requestAnimationFrame(() => {
        wheelScrubRaf = null;
        if (!wheelScrubActive || wheelScrubStartY === null) return;
        const deltaY = wheelScrubLatestY - wheelScrubStartY;
        const steps = Math.round(deltaY / AI_WHEEL_ITEM_H);
        const target = clampAiIndex(wheelScrubStartIndex + steps);
        if (target !== activeNoteAIIndex) {
          setActiveAiIndex(target, false);
          // اگر به لبه رسیدیم، مبدأ را به موقعیت فعلی بچسبان تا با برگشت موس پرش نکند
          if (target === 0 || target === AI_DISPATCH_CATALOG.length - 1) {
            wheelScrubStartY = wheelScrubLatestY;
            wheelScrubStartIndex = target;
          }
        }
      });
    });
    uiEls.wheelViewport.addEventListener('mouseup', endWheelScrub);
    uiEls.wheelViewport.addEventListener('mouseleave', endWheelScrub);
    // اگر دکمهٔ موس بیرون از چرخ رها شود هم اسکراب باید تمام شود
    document.addEventListener('mouseup', endWheelScrub);
  }

  // کلیک بیرون از ویجت، چرخ را می‌بندد
  document.addEventListener('click', (e) => {
    if (!isAiWheelOpen()) return;
    const wrap = uiEls.sendWrapper;
    if (wrap && wrap.contains(e.target)) return;
    closeAiWheel();
  });

  function fallbackCopyText(text) { copyTextViaHiddenTextarea(text); showToastNotification(t('toastCopied')); setTimeout(resetToggleTimeout, 100); }

  function getFaviconUrl(urlStr) { try { const domain = new URL(urlStr).hostname; return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`; } catch(e) { return ''; } }

  function isDuplicateNodeAll(newUrl, newLabel, skipIndex = null, skipHub = null) {
    const cleanUrl = newUrl.replace(/\/$/, '').toLowerCase(); const cleanLabel = newLabel.toLowerCase();
    const findInArr = (arr, hubId) => {
      for (let idx = 0; idx < arr.length; idx++) {
        if (hubId === skipHub && idx === skipIndex) continue;
        const link = arr[idx];
        if (!link || !link.url) continue;
        if (link.url.replace(/\/$/, '').toLowerCase() === cleanUrl || (link.label && link.label.toLowerCase() === cleanLabel)) {
          return hubId;
        }
      }
      return 0;
    };
    return findInArr(linksData, 1) || findInArr(linksData2, 2) || findInArr(linksData3, 3) || findInArr(linksData4, 4);
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync') {
          let langChanged = false;
          const birthCalendarChanged = !!(changes.userBirthYear || changes.userBirthMonth || changes.userBirthDay || changes.aiTreeFamilyAges);
          if (changes.appLanguage) { currentLang = changes.appLanguage.newValue || 'en'; langChanged = true; }
          if (changes.userBirthYear) userBirthYear = changes.userBirthYear.newValue ? parseInt(changes.userBirthYear.newValue, 10) : null;
          if (changes.userBirthMonth) userBirthMonth = changes.userBirthMonth.newValue ? parseInt(changes.userBirthMonth.newValue, 10) : null;
          if (changes.userBirthDay) userBirthDay = changes.userBirthDay.newValue ? parseInt(changes.userBirthDay.newValue, 10) : null;
          if (changes.aiTreeFamilyAges) {
            const list = Array.isArray(changes.aiTreeFamilyAges.newValue) ? changes.aiTreeFamilyAges.newValue : [];
            familyAges = list.filter(m => m && m.year).map(m => ({
              id: m.id || ('fa_' + Math.random().toString(36).slice(2, 8)),
              name: String(m.name || '').slice(0, 24), year: parseInt(m.year, 10),
              month: m.month ? parseInt(m.month, 10) : null, day: m.day ? parseInt(m.day, 10) : null, primary: !!m.primary
            }));
            if (familyAges.length && !familyAges.some(m => m.primary)) familyAges[0].primary = true;
            const prim = familyAges.find(m => m.primary) || familyAges[0];
            if (prim) { userBirthYear = prim.year; userBirthMonth = prim.month; userBirthDay = prim.day; }
          }
          if (birthCalendarChanged && clockPanel.classList.contains('active')) {
            updateClockAge();
            renderMarkedDays();
            if (dualPickerOpen) renderDualGrid();
          }
          if (changes.aiTreeTodos) applyExternalTodos(changes.aiTreeTodos.newValue);
          if (changes.aiTreeMarkedDays) { markedDays = changes.aiTreeMarkedDays.newValue || []; if (clockPanel.classList.contains('active')) renderMarkedDays(); }
          // aiTreeTimeEvents عمداً اینجا (sync) نیست: saveTimeEvents() روی chrome.storage.local می‌نویسد،
          // پس شنوندهٔ آن در شاخهٔ area === 'local' پایین‌تر است (قبلاً اینجا بود و هرگز اجرا نمی‌شد).
          if (changes.lastDeletedLink) {
              if (changes.lastDeletedLink.newValue) {
                  if (!pendingUndoState.type) setUndoState('storage', null);
              } else if (pendingUndoState.type === 'storage') {
                  clearTimeout(globalUndoTimeout); undoToggleDot.classList.remove('active-undo'); pendingUndoState = { type: null, data: null, hub: 1 };
              }
          }
          if (langChanged) {
            updateUITexts();
            // «هوشمند»: اگر حالت کشور روی auto است، با تغییر زبان برنامه کشورِ حدسی هم عوض می‌شود
            if (showPublicHolidays && holidayRegionMode === 'auto') loadRegionalHolidays();
          }
      }
      if (area === 'local') {
        // هماهنگی زندهٔ بین تب‌ها: رویدادها فقط در local ذخیره می‌شوند؛ todos هم همیشه آینهٔ local
        // دارد (sync بالای ~۸KB بی‌صدا شکست می‌خورد، پس شنوندهٔ sync به‌تنهایی کافی نیست).
        if (changes.aiTreeTimeEvents) applyExternalTimeEvents(changes.aiTreeTimeEvents.newValue);
        if (changes.aiTreeTodos) applyExternalTodos(changes.aiTreeTodos.newValue);
        if (changes.showPublicHolidays || changes.holidayRegionMode || changes.holidayCustomCountry) {
          if (changes.showPublicHolidays) showPublicHolidays = changes.showPublicHolidays.newValue !== undefined ? !!changes.showPublicHolidays.newValue : true;
          if (changes.holidayRegionMode) holidayRegionMode = changes.holidayRegionMode.newValue || 'auto';
          if (changes.holidayCustomCountry) holidayCustomCountry = changes.holidayCustomCountry.newValue || '';
          // اگر همین الان (از popup) تغییر کرده، بلافاصله بازخوانی/پاکسازی کن
          loadRegionalHolidays();
        }
        if (changes.quoteReligionSource) {
          AITreeQuoteEngine.initReligion().then(renderDailyQuote);
        }
        if (changes.quotePoetrySource) {
          AITreeQuoteEngine.initPoetry().then(renderRumiQuote);
        }
        // اگر «Hide»/«Show (Reset)» از پاپ‌آپ برای همین دامنه در یک تبِ دیگر (نه
        // لزوماً تبِ فعالی که پیام مستقیم گرفته) اجرا شده باشد، این تب هم بدون نیاز
        // به رفرش زنده هماهنگ شود.
        if (changes.aiTreeHiddenDomains) {
          const list = Array.isArray(changes.aiTreeHiddenDomains.newValue) ? changes.aiTreeHiddenDomains.newValue : [];
          const shouldBeHidden = list.includes(window.location.hostname);
          if (shouldBeHidden && root.style.display !== 'none') { root.style.display = 'none'; reportLauncherVisibility(); }
          else if (!shouldBeHidden && root.style.display === 'none' && !widgetHiddenByFullscreen) { root.style.display = ''; reportLauncherVisibility(); }
        }
        // Two-way live sync with the standalone notepad tab (see notepad.js).
        // Only overwrite when this widget's textarea isn't the one being typed in.
        if (changes.savedPromptDraft && noteTextarea && document.activeElement !== noteTextarea) {
          const newVal = changes.savedPromptDraft.newValue || '';
          if (newVal !== noteTextarea.value) {
            noteTextarea.value = newVal;
            if (typeof updateNoteTokenMeter === 'function') updateNoteTokenMeter();
            if (typeof autoGrowNotepad === 'function') autoGrowNotepad();
          }
        }
        if (changes.noteTextAlign && changes.noteTextAlign.newValue && typeof setNoteAlign === 'function') {
          setNoteAlign(changes.noteTextAlign.newValue);
        }
        if (changes.noteFontSize && changes.noteFontSize.newValue && typeof applyNoteFontSize === 'function') {
          applyNoteFontSize(changes.noteFontSize.newValue, { silent: true });
        }
        // Prompts / emoji memory can also be edited from the standalone notepad tab.
        if (changes[CUSTOM_PROMPT_KEY]) {
          customPrompts = Array.isArray(changes[CUSTOM_PROMPT_KEY].newValue) ? changes[CUSTOM_PROMPT_KEY].newValue : [];
          if (typeof renderNoteTemplates === 'function') renderNoteTemplates();
        }
        if (changes[PROMPT_OVERRIDE_KEY]) {
          promptOverrides = (changes[PROMPT_OVERRIDE_KEY].newValue && typeof changes[PROMPT_OVERRIDE_KEY].newValue === 'object') ? changes[PROMPT_OVERRIDE_KEY].newValue : {};
          if (typeof renderNoteTemplates === 'function') renderNoteTemplates();
        }
        if (changes[PROMPT_HIDDEN_KEY]) {
          promptHiddenIds = Array.isArray(changes[PROMPT_HIDDEN_KEY].newValue) ? changes[PROMPT_HIDDEN_KEY].newValue : [];
          if (typeof renderNoteTemplates === 'function') renderNoteTemplates();
        }
        if (changes.aiTreeEmojiMemory && Array.isArray(changes.aiTreeEmojiMemory.newValue)) {
          favoriteEmojis = changes.aiTreeEmojiMemory.newValue.filter(e => typeof e === 'string' && e).slice(0, 12);
          if (typeof renderEmojiTray === 'function') renderEmojiTray();
        }
      }
    });
  } catch (e) {}

  function storageGet(area, keys) {
    return new Promise((resolve) => {
      try { chrome.storage[area].get(keys, (res) => resolve(res || {})); }
      catch (e) { resolve({}); }
    });
  }

  async function loadDataAndRender() {
    const [syncData, localData] = await Promise.all([
      storageGet('sync', ['orbitX', 'orbitY', 'linksData', 'coreAIConfig', 'lastDeletedLink', 'userBirthYear', 'userBirthMonth', 'userBirthDay', 'aiTreeFamilyAges', 'nodeSpacing', 'aiTreeTodos', 'appLanguage', 'aiTreeMarkedDays', 'clockCustomX', 'clockCustomY', 'coreSlots5Migrated']),
      storageGet('local', ['linksData', 'linksData2', 'linksData3', 'linksData4', 'activeNoteAIIndex', 'aiTreeTimeEvents', 'aiTreeTodos'])
    ]);

    if (typeof localData.activeNoteAIIndex === 'number') {
      activeNoteAIIndex = clampAiIndex(localData.activeNoteAIIndex);
    } else {
      activeNoteAIIndex = indexOfAiId(DEFAULT_NOTE_AI_ID);
      try { if (chrome.runtime?.id) chrome.storage.local.set({ activeNoteAIIndex }); } catch (err) {}
    }

    let resolvedLinksData = localData.linksData;
    if ((!resolvedLinksData || resolvedLinksData.length === 0) && syncData.linksData && syncData.linksData.length > 0) {
      resolvedLinksData = syncData.linksData;
      try { chrome.storage.local.set({ linksData: resolvedLinksData }); chrome.storage.sync.remove('linksData'); } catch (err) {}
    }

    // مهاجرتِ یک‌باره: نصب‌های قدیمی ۴ اسلات هسته داشتند (ایندکس ۰ تا ۳) و بوک‌مارک‌های واقعی از
    // ایندکس ۴ شروع می‌شدند. حالا که هسته ۵ اسلاته شده، اگر این مهاجرت انجام نشود، همان بوک‌مارک
    // واقعیِ ایندکس ۴ به‌اشتباه «اسلات هستهٔ پنجم» خوانده و از شمارش رده‌اش گم می‌شود — پس یک
    // اسلات خالی جدید بین هستهٔ قدیمی و بوک‌مارک‌های واقعی درج می‌کنیم، فقط یک‌بار.
    if (!syncData.coreSlots5Migrated) {
      if (resolvedLinksData) resolvedLinksData = migrateCoreSlotsTo5(resolvedLinksData);
      if (localData.linksData2) localData.linksData2 = migrateCoreSlotsTo5(localData.linksData2);
      if (localData.linksData3) localData.linksData3 = migrateCoreSlotsTo5(localData.linksData3);
      if (localData.linksData4) localData.linksData4 = migrateCoreSlotsTo5(localData.linksData4);
      try {
        if (chrome.runtime?.id) {
          chrome.storage.local.set({ linksData: resolvedLinksData, linksData2: localData.linksData2, linksData3: localData.linksData3, linksData4: localData.linksData4 });
          chrome.storage.sync.set({ coreSlots5Migrated: true });
        }
      } catch (err) {}
    }

    if (syncData.appLanguage) currentLang = syncData.appLanguage;
    updateUITexts();

    if (syncData.orbitX !== undefined) { root.style.left = syncData.orbitX + 'px'; root.style.top = syncData.orbitY + 'px'; root.style.bottom = 'auto'; } else { root.style.left = WIDGET1_DEFAULT_LEFT; root.style.top = 'auto'; root.style.bottom = WIDGET1_DEFAULT_BOTTOM; }

    // هسته پیش‌فرض: ChatGPT اول (ارسال مستقیم با q) — پنجمین اسلات: Grok (قبلاً هم در فهرست Ask AI بود)
    let defaultCore = [{ label: 'ChatGPT', url: 'https://chatgpt.com' }, { label: 'Claude', url: 'https://claude.ai' }, { label: 'Gemini', url: 'https://gemini.google.com' }, { label: 'DeepSeek', url: 'https://chat.deepseek.com' }, { label: 'Grok', url: 'https://grok.com' }];
    if (syncData.coreAIConfig && syncData.coreAIConfig.length === 5) defaultCore = syncData.coreAIConfig;

    linksData = (resolvedLinksData && resolvedLinksData.length >= 5) ? resolvedLinksData : defaultCore;

    const blankQuad = () => [ { label: '', url: '' }, { label: '', url: '' }, { label: '', url: '' }, { label: '', url: '' }, { label: '', url: '' } ];
    linksData2 = (localData.linksData2 && localData.linksData2.length >= 5) ? localData.linksData2 : blankQuad();
    linksData3 = (localData.linksData3 && localData.linksData3.length >= 5) ? localData.linksData3 : blankQuad();
    linksData4 = (localData.linksData4 && localData.linksData4.length >= 5) ? localData.linksData4 : blankQuad();

    if(syncData.lastDeletedLink) setUndoState('storage', null);
    if(syncData.userBirthYear) userBirthYear = parseInt(syncData.userBirthYear, 10);
    if(syncData.userBirthMonth) userBirthMonth = parseInt(syncData.userBirthMonth, 10);
    if(syncData.userBirthDay) userBirthDay = parseInt(syncData.userBirthDay, 10);
    if (Array.isArray(syncData.aiTreeFamilyAges) && syncData.aiTreeFamilyAges.length) {
      familyAges = syncData.aiTreeFamilyAges.filter(m => m && m.year).map(m => ({
        id: m.id || ('fa_' + Math.random().toString(36).slice(2, 8)),
        name: String(m.name || '').slice(0, 24), year: parseInt(m.year, 10),
        month: m.month ? parseInt(m.month, 10) : null, day: m.day ? parseInt(m.day, 10) : null, primary: !!m.primary
      }));
      if (familyAges.length && !familyAges.some(m => m.primary)) familyAges[0].primary = true;
      const prim = familyAges.find(m => m.primary) || familyAges[0];
      if (prim) { userBirthYear = prim.year; userBirthMonth = prim.month; userBirthDay = prim.day; }
    } else if (userBirthYear) {
      familyAges = [{ id: 'legacy', name: '', year: userBirthYear, month: userBirthMonth, day: userBirthDay, primary: true }];
    }
    // local منبعِ معتبره؛ sync فقط best-effort و محدود به ۸KB به‌ازایِ هر
    // کلیده — برای کاربری با این‌همه کار/هدف، آرایه‌ی aiTreeTodos به‌راحتی از
    // اون سقف رد می‌شه و chrome.storage.sync.set بی‌صدا شکست می‌خوره (بدون
    // callback، بدون پرتاب خطا، فقط یک warning توی کنسول). قبلاً این بلوک
    // همیشه sync رو معتبر می‌دونست و local رو باهاش override می‌کرد — یعنی
    // با هر بار بازشدنِ یک تبِ جدید، نسخه‌ی قدیمیِ گیرکرده‌یِ sync دوباره
    // رو نسخه‌ی تازه‌ی local (که همین الان یک تیک واقعی توش ثبت شده) می‌نشست:
    // دقیقاً همون چیزی که باعث می‌شد تیک‌خوردن توی منوی Today «برنگرده».
    // الان local هروقت داده داشته باشه اولویت داره؛ sync فقط برایِ نصبِ کاملاً
    // تازه‌ای که هنوز local خالیه (یا یک دستگاهِ قدیمی‌تر که فقط sync داشته)
    // به‌کار می‌ره.
    if (Array.isArray(localData.aiTreeTodos) && localData.aiTreeTodos.length) {
      todosData = localData.aiTreeTodos;
      migrateTodos(); pruneExpiredDailyTodos();
    } else if (syncData.aiTreeTodos) {
      todosData = syncData.aiTreeTodos;
      migrateTodos(); pruneExpiredDailyTodos();
      // برای داده‌های قدیمی که فقط در sync بودند، یک‌بار آینهٔ local را بساز.
      try { if (chrome.runtime?.id) chrome.storage.local.set({ aiTreeTodos: todosData }); } catch (err) {}
    }
    publishTodosToVoidTab();
    if(Array.isArray(syncData.aiTreeMarkedDays)) { markedDays = syncData.aiTreeMarkedDays; pruneExpiredMarkedDays(); }
    if(Array.isArray(localData.aiTreeTimeEvents)) { timeEventsData = localData.aiTreeTimeEvents; lastTimeEventsJson = JSON.stringify(timeEventsData); snapshotTimeEventsBaseline(); pruneExpiredDashEvents(); }
    try {
      if (chrome.runtime?.id) {
        chrome.storage.local.get(['showPublicHolidays', 'holidayRegionMode', 'holidayCustomCountry'], (res) => {
          showPublicHolidays = res.showPublicHolidays !== undefined ? !!res.showPublicHolidays : true;
          holidayRegionMode = res.holidayRegionMode || 'auto';
          holidayCustomCountry = res.holidayCustomCountry || '';
          if (showPublicHolidays) loadRegionalHolidays();
        });
      }
    } catch (eHolidaysInit) {}
    if (typeof syncData.nodeSpacing === 'number' && !isNaN(syncData.nodeSpacing)) SPACING = Math.min(MAX_SPACING, Math.max(MIN_SPACING, syncData.nodeSpacing));
    if (syncData.clockCustomX !== undefined && syncData.clockCustomY !== undefined) {
      // فقط مختصات اولیه؛ لنگر دائمی نیست تا با باز شدن دوباره کنار هاب قرار بگیرد
      clockPanel.style.left = syncData.clockCustomX + 'px'; clockPanel.style.top = syncData.clockCustomY + 'px';
      clockManuallyPositioned = false;
    }
    paintSpacingArc();

    root.classList.add('initial-reveal'); resetAutoCollapseTimer(); resetToggleTimeout();
    // دات‌های ساعتی نباید منتظرِ کلیک روی تاگل بمانند؛ داده بعد از storage حالا
    // آماده است، پس همان ابتدا ردیف را پر می‌کنیم.
    renderDashDotsRow();
    renderDashTodoSummary();
    renderTierDots(); syncDotsVisibility();
    renderSmartRibbon();
  }
  loadDataAndRender();
  
  function saveLinksAll() { 
    try { 
      if (chrome.runtime?.id) { chrome.storage.local.set({ linksData: linksData, linksData2: linksData2, linksData3: linksData3, linksData4: linksData4 }); } 
      renderSmartRibbon();
      updateBookmarkCount();
    } catch (e) { showToastNotification(t('toastStorageErr'), true); } 
  }

  function countHubBookmarks(hubIdx) {
    const arr = hubData(hubIdx);
    let n = 0;
    for (let i = 5; i < arr.length; i++) {
      if (arr[i] && arr[i].url) n++;
    }
    return n;
  }

  function countHubCores(hubIdx) {
    const arr = hubData(hubIdx);
    let n = 0;
    for (let i = 0; i < 5 && i < arr.length; i++) {
      if (arr[i] && arr[i].url) n++;
    }
    return n;
  }

  function updateBookmarkCount() {
    if (!bookmarkCountEl) return;
    const bm = countHubBookmarks(currentHubIndex);
    const cores = countHubCores(currentHubIndex);
    bookmarkCountEl.innerHTML =
      `<span class="ai-count-bm">${t('bookmarkCount').replace('{n}', String(bm))}</span>` +
      `<span class="ai-count-core">${t('coreCount').replace('{n}', String(cores))}</span>`;
    bookmarkCountEl.classList.toggle('visible', !!showAllOverride);
  }

  // A short, compositor-friendly "seed blooming" signature whenever the orbit opens.
  function triggerQuantumBloom() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    root.querySelectorAll('.ai-node').forEach((node, index) => {
      node.style.setProperty('--quantum-bloom-delay', `${Math.min(index, 10) * 46}ms`);
    });
    root.classList.remove('quantum-blooming');
    void root.offsetWidth; // restart the one-shot animation without a timer race
    root.classList.add('quantum-blooming');
    clearTimeout(triggerQuantumBloom.timeout);
    triggerQuantumBloom.timeout = setTimeout(() => root.classList.remove('quantum-blooming'), 780);
  }

  allToggleDot.addEventListener('click', (e) => {
    if (!chrome.runtime?.id) return; e.stopPropagation(); playLauncherClick(2); 
    if (showAllOverride) { closeTree(); } else { closeAllPanelsExcept(''); isOpen = true; showAllOverride = true; root.classList.add('open', 'show-all-active'); setHubLabel(t('hubAll')); renderSpiral(); triggerQuantumBloom(); updateBookmarkCount(); resetToggleTimeout(); }
  });
  
  function cycleLayer() { 
      showAllOverride = false; root.classList.remove('show-all-active'); 
      currentLayerMode++; if (currentLayerMode >= MAX_LAYERS) currentLayerMode = 0; 
      let nextLabel = RING_CONFIG[currentLayerMode].label;
      if (RING_CONFIG[currentLayerMode].labelKey) nextLabel = t(RING_CONFIG[currentLayerMode].labelKey);
      setHubLabel(nextLabel); renderSpiral(); updateBookmarkCount();
  }

  function calculateSafePositions(countToGenerate) {
    const hubRect = hub.getBoundingClientRect(); const cx = hubRect.left + (hubRect.width / 2); const cy = hubRect.top + (hubRect.height / 2); const vw = window.innerWidth; const vh = window.innerHeight; const SAFE_W = 55; const SAFE_H = 24; const EDGE_PAD = 12; let validPositions = []; let attempt = 1; const MAX_ATTEMPTS = 900;
    const spaceLeft = cx - EDGE_PAD; const spaceRight = (vw - EDGE_PAD) - cx;
    const spaceTop = cy - EDGE_PAD; const spaceBottom = (vh - EDGE_PAD) - cy;
    const biasAngleDeg = Math.atan2(-(spaceBottom - spaceTop), (spaceRight - spaceLeft)) * (180 / Math.PI);
    const LEVER_ZONE_R = 88;
    // بوک‌مارک اول (attempt=1) در فرمول اصلی چون Math.sqrt(attempt-1)=0 بود، هیچ‌وقت با اسلایدر فاصله
    // جابه‌جا نمی‌شد و همیشه دقیقاً روی START_RADIUS+ثابت می‌ماند، بی‌ربط به SPACING.
    // فیکس: به‌جای صفر کردنِ کامل جملهٔ SPACING، از یک «نیم‌قدم» مارپیچ استفاده می‌کنیم — یعنی
    // بوک‌مارک اول هم دقیقاً روی همان منحنی مارپیچ طلایی می‌نشیند و با اسلایدر جابه‌جا می‌شود، فقط
    // نزدیک‌تر از بوک‌مارک دوم (attempt=2) به هاب می‌ماند. FIRST_NODE_RADIUS_BOOST و ضریب نیم‌قدم
    // طوری انتخاب شده‌اند که در کل بازهٔ MIN..MAX اسلایدر، ترتیبِ radius(اول) < radius(دوم) همیشه حفظ شود.
    const FIRST_NODE_RADIUS_BOOST = 6;
    const FIRST_NODE_SPIRAL_STEP = 0.5; // نصفِ فاصلهٔ بوک‌مارک دوم تا هاب — با MIN_SPACING=18 هم ترتیب را به‌هم نمی‌زند
    while (validPositions.length < countToGenerate && attempt < MAX_ATTEMPTS) { const angle = biasAngleDeg + (attempt * GOLDEN_ANGLE); const radius = attempt === 1 ? START_RADIUS + FIRST_NODE_RADIUS_BOOST + (SPACING * FIRST_NODE_SPIRAL_STEP) : START_RADIUS + (SPACING * Math.sqrt(attempt - 1)); const rad = angle * (Math.PI / 180); const x = Math.cos(rad) * radius; const y = -Math.sin(rad) * radius; const absX = cx + x; const absY = cy + y; const normAngle = ((angle % 360) + 360) % 360; const inLeverZone = radius < LEVER_ZONE_R && (normAngle <= 100 || normAngle >= 350); const isSafe = !inLeverZone && (absX - SAFE_W > EDGE_PAD && absX + SAFE_W < vw - EDGE_PAD && absY - SAFE_H > EDGE_PAD && absY + SAFE_H < vh - EDGE_PAD); if (isSafe) validPositions.push({ x, y }); attempt++; } return validPositions;
  }

  function renderSpiral() {
    document.querySelectorAll('.ai-node').forEach(el => el.remove()); spiralNodeEls = [];
    if (typeof closeStarEditor === 'function') closeStarEditor();
    if (typeof renderTierDots === 'function') renderTierDots();
    if (typeof renderHubDots === 'function') renderHubDots();
    
    const activeData = hubData(currentHubIndex);

    let visibleIndices = [];
    let ring = null;
    if (showAllOverride) {
        // Show-all: only bookmarks of this galaxy — core AI slots stay on Core layer
        for (let i = 5; i < activeData.length; i++) visibleIndices.push(i);
    } else {
        if (currentLayerMode === 0) {
            visibleIndices = [0, 1, 2, 3, 4].filter(i => i < activeData.length);
        } else {
            ring = RING_CONFIG[currentLayerMode];
            for (let i = 5; i < activeData.length; i++) {
                const item = activeData[i];
                const matchesRing = ring.comet
                  ? !!item.overflow
                  : (!item.overflow && importanceMatchesRing(item.importance || 3, ring));
                if (matchesRing) visibleIndices.push(i);
            }
            visibleIndices = visibleIndices.slice(0, ring.max);
        }
    }

    visibleIndices.sort((a, b) => {
        const aRank = a < 5 ? 999 : (activeData[a].importance || 3);
        const bRank = b < 5 ? 999 : (activeData[b].importance || 3);
        if (aRank !== bRank) return bRank - aRank;
        return a - b;
    });

    let coreIndices = visibleIndices.filter(i => i < 5);
    let bookmarkIndices = visibleIndices.filter(i => i >= 5);

    let portals = [];
    if (!showAllOverride) {
        // Slot order follows the direction the user is currently traveling in, so clicking the
        // *same spot* repeatedly continues the trip (forward keeps 🌌 in that slot, backward keeps 🌍).
        const nextHub = currentHubIndex + 1;
        const forwardLabel = isNewsHub(nextHub)
          ? t('portalNews')
          : t('portalForward').replace('{n}', currentHubIndex);
        const forwardIcon = isNewsHub(nextHub) ? '📰' : '🌌';
        const forwardPortal = (currentLayerMode === 0)
            ? (currentHubIndex < HUB_COUNT ? { isPortal: true, target: nextHub, label: forwardLabel, icon: forwardIcon } : null)
            : (currentHubIndex < HUB_COUNT && hubHasTierItems(nextHub, ring) ? { isPortal: true, target: nextHub, label: `${ringTooltipLabel(ring)} · ${forwardLabel}`, icon: forwardIcon, keepLayer: true } : null);
        const backPortal = (currentLayerMode === 0)
            ? (currentHubIndex > 1 ? { isPortal: true, target: 1, label: t('portalHome'), icon: '🌍' } : null)
            : (currentHubIndex > 1 && hubHasTierItems(1, ring) ? { isPortal: true, target: 1, label: `${ringTooltipLabel(ring)} · ${t('portalHome')}`, icon: '🌍', keepLayer: true } : null);

        if (hubNavDirection === 'backward') {
            if (backPortal) portals.push(backPortal);
            if (forwardPortal) portals.push(forwardPortal);
        } else {
            if (forwardPortal) portals.push(forwardPortal);
            if (backPortal) portals.push(backPortal);
        }
    }

    let renderItems = [];
    coreIndices.forEach(idx => renderItems.push({ type: 'node', globalIdx: idx, data: activeData[idx] }));
    portals.forEach(p => renderItems.push({ type: 'portal', data: p }));
    bookmarkIndices.forEach(idx => renderItems.push({ type: 'node', globalIdx: idx, data: activeData[idx] }));

    const safePositions = calculateSafePositions(renderItems.length + 1);

    renderItems.forEach((item, index) => {
      if (index >= MAX_NODES) return; const pos = safePositions[index]; if (!pos) return;

      if (item.type === 'node') {
          const globalIdx = item.globalIdx; const link = item.data;
          const isBlankCore = globalIdx < 5 && !link.url;

          const a = document.createElement('a'); a.className = 'ai-node'; a.target = "_blank";
          let colorSet; const content = document.createElement('div'); content.className = 'ai-node-content';

          if (isBlankCore) {
              a.classList.add('core-text-circle', 'ai-node-empty');
              a.removeAttribute('target'); a.href = 'javascript:void(0)';
              const plus = document.createElement('span'); plus.className = 'ai-node-empty-plus'; plus.textContent = '+';
              content.appendChild(plus);
              a.style.left = `${pos.x}px`; a.style.top = `${pos.y}px`; a.style.transitionDelay = `${index * 0.03}s`;
              a.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openEditForm(globalIdx, a); });
              a.appendChild(content); root.appendChild(a); spiralNodeEls.push(a);
              return;
          }

          const fav = document.createElement('img'); fav.className = 'ai-node-favicon'; fav.src = getFaviconUrl(link.url);
          fav.addEventListener('error', () => fav.style.display = 'none');
          const span = document.createElement('span');

          if (globalIdx < 5) {
            colorSet = CORE_COLORS[globalIdx]; a.classList.add('core-text-circle'); 
            let shortLabel = link.label; if (shortLabel.toLowerCase() === 'chatgpt') shortLabel = 'GPT'; if (shortLabel.toLowerCase() === 'deepseek') shortLabel = 'Seek';
            span.textContent = shortLabel; a.style.boxShadow = `0 0 16px ${colorSet.glow}, inset 0 0 8px ${colorSet.glow}`;

            const editBtn = document.createElement('div'); editBtn.className = 'edit-node-btn';
            editBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
            a.appendChild(editBtn); editBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openEditForm(globalIdx, a); });
          } else {
            const nodeLayer = Math.max(0, (link.importance || 3) - 1); const extraIdx = nodeLayer % EXTRA_COLORS.length;
            const importance = link.importance || 3; a.dataset.importance = importance; a.classList.add(`priority-${importance}`);
            colorSet = EXTRA_COLORS[extraIdx]; span.textContent = link.label;

            const hasTags = Array.isArray(link.tags) && link.tags.length > 0;
            if (hasTags) {
              // دسته‌بندی‌شده: حالهٔ برجسته و «زنده» — به رنگِ خودِ دسته/تگ (نه رنگِ
              // اهمیت)، تا با حلقهٔ دورش هم‌رنگ و هماهنگ باشد و افکتش قوی‌تر از قبل حس شود
              const tagGlow = glowColorForTag(link.tags[0]);
              a.style.boxShadow = `0 3px ${10 + importance * 2}px ${tagGlow}`;
            } else {
              // بدون تگ: عمداً بدون هیچ هاله‌ای — ساکت و بی‌جان، تا چشم مستقیم به‌سمتِ
              // بوکمارک‌های دسته‌بندی‌شده کشیده شود و نقشِ تگ واقعاً معلوم باشد
              a.style.boxShadow = `0 2px ${8 + importance * 2}px ${colorSet.glow}`;
            }

            const impBadge = document.createElement('div'); impBadge.className = 'importance-badge'; impBadge.textContent = '★'.repeat(importance); 
            a.appendChild(impBadge);
            impBadge.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
            impBadge.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openStarEditor(globalIdx, impBadge); });

            const editBtn = document.createElement('div'); editBtn.className = 'edit-node-btn';
            editBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
            a.appendChild(editBtn); editBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openEditForm(globalIdx, a); });

          }
          
          if (Array.isArray(link.tags) && link.tags.length > 0) {
            a.classList.add('ai-node-tagged');
            // رنگ حلقه از روی اولین تگ (دستهٔ اصلی) تعیین می‌شود؛ اگر بوکمارک چند
            // تگ داشته باشد، همان اولی تعیین‌کنندهٔ رنگ است — ساده و پیش‌بینی‌پذیر
            a.style.setProperty('--tag-glow-color', glowColorForTag(link.tags[0]));
          }

          content.appendChild(fav); content.appendChild(span); a.appendChild(content); a.href = link.url;
          if (link.description) {
            const descTip = document.createElement('div'); descTip.className = 'ai-node-desc-tooltip'; descTip.textContent = link.description;
            a.appendChild(descTip);
          }
          a.style.background = colorSet.bg; a.style.border = `1px solid ${colorSet.border}`; a.style.left = `${pos.x}px`; a.style.top = `${pos.y}px`; a.style.transitionDelay = `${index * 0.03}s`;
          
          a.addEventListener('click', (e) => { 
              if(e.target.closest('.edit-node-btn')) { e.preventDefault(); e.stopPropagation(); return; }
              e.stopPropagation(); closeTree(); 
          }); 
          root.appendChild(a); spiralNodeEls.push(a);

      } else if (item.type === 'portal') {
          const a = document.createElement('a'); a.className = 'ai-node portal-node core-text-circle'; a.href = 'javascript:void(0)';
          if (item.data.icon === '🌍') a.classList.add('portal-node-home'); 
          a.title = item.data.label;
          const content = document.createElement('div'); content.className = 'ai-node-content';
          const iconSpan = document.createElement('span'); iconSpan.className = 'portal-icon'; iconSpan.textContent = item.data.icon;
          content.appendChild(iconSpan); a.appendChild(content);

          a.style.left = `${pos.x}px`; a.style.top = `${pos.y}px`; a.style.transitionDelay = `${index * 0.03}s`;

          a.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); hubNavDirection = (item.data.icon === '🌍') ? 'backward' : 'forward'; switchHub(item.data.target, item.data.keepLayer); });
          root.appendChild(a); spiralNodeEls.push(a);
      }
    });

    if (activeData.length < MAX_NODES) {
      const addPos = safePositions[renderItems.length];
      if (addPos) { addNodeBtn.style.left = `${addPos.x}px`; addNodeBtn.style.top = `${addPos.y}px`; addNodeBtn.style.display = 'flex'; }
      else {
        const hubRect = hub.getBoundingClientRect(); const vw = window.innerWidth; const vh = window.innerHeight;
        const cx = hubRect.left + hubRect.width / 2; const cy = hubRect.top + hubRect.height / 2;
        const dirX = cx < vw / 2 ? 1 : -1; const dirY = cy < vh / 2 ? 1 : -1;
        addNodeBtn.style.left = `${dirX * 66}px`; addNodeBtn.style.top = `${dirY * 66}px`; addNodeBtn.style.display = 'flex';
      }
    } else addNodeBtn.style.display = 'none';

    hub.classList.toggle('hub-infinity', currentHubIndex > 1 && !isNewsHub(currentHubIndex));
    hub.classList.toggle('hub-news', isNewsHub(currentHubIndex));
  }

  function switchHub(targetIndex, keepLayer) {
      currentHubIndex = targetIndex;
      if (!keepLayer) currentLayerMode = 0;
      setHubLabel(showAllOverride ? t('hubAll') : (currentLayerMode === 0 ? t('hubCore') : ringDisplayLabel(RING_CONFIG[currentLayerMode])));
      renderSpiral(); renderTierDots();
      updateBookmarkCount();
  }

  function repositionSpiralNodes() {
    if (!isOpen || spiralNodeEls.length === 0) return;
    const activeData = hubData(currentHubIndex);
    const safePositions = calculateSafePositions(spiralNodeEls.length + 1);
    spiralNodeEls.forEach((el, index) => { const pos = safePositions[index]; if (pos) { el.style.left = `${pos.x}px`; el.style.top = `${pos.y}px`; } });
    if (activeData.length < MAX_NODES) {
      const addPos = safePositions[spiralNodeEls.length]; if (addPos) { addNodeBtn.style.left = `${addPos.x}px`; addNodeBtn.style.top = `${addPos.y}px`; }
    }
  }

  // فرم تنظیمات بوک‌مارک را دقیقاً وسط ویوپورت می‌گذارد — بر اساس اندازه‌ی واقعیِ رندرشده‌ی
  // خودِ فرم (offsetWidth/offsetHeight)، نه یک عدد ثابتِ حدسی؛ چون قابلیت‌های جدید (تگ، پیشنهاد
  // تگ، کادر کرکره‌ای دسته‌بندی) ارتفاعِ فرم را متغیر کرده‌اند. فرم همیشه position:fixed است،
  // پس این محاسبه نسبت‌به مانیتور/ویوپورت درست است، نه نسبت‌به اسکرول صفحه.
  function centerInlineForm() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = inlineForm.offsetWidth || 260;
    const h = inlineForm.offsetHeight || 300;
    inlineForm.style.left = `${Math.round((vw - w) / 2)}px`;
    inlineForm.style.top = `${Math.round((vh - h) / 2)}px`;
  }

  function openEditForm(globalIdx, anchorEl) {
    editingNodeIndex = globalIdx;
    const activeData = hubData(currentHubIndex);
    const link = activeData[globalIdx];
    const isAddFlow = !link || !link.url;
    isLabelManuallyEdited = !isAddFlow;

    document.querySelectorAll('.ai-node').forEach(node => node.classList.add('faded')); addNodeBtn.classList.remove('blinking');
    // در حالت «نمایش همه» (Show All)، تری باز می‌ماند و فقط نودها fade می‌شوند —
    // یعنی برخلاف حالت عادی، کلاس 'open' از root برداشته نمی‌شود، پس علامت + که
    // با همان کلاس نمایان می‌شود همچنان دیده و حتی قابل کلیک می‌ماند و ممکن است
    // درست زیرِ فرمِ ویرایشِ وسط‌چین‌شده بیفتد. صریحاً مخفی‌اش می‌کنیم؛ با بستن فرم
    // (closeInlineForm) دوباره با renderSpiral به حالت درستش برمی‌گردد.
    addNodeBtn.style.display = 'none';
    inlineForm.style.left = ''; inlineForm.style.top = '';
    
    uiEls.formUrl.value = link.url || ''; uiEls.formLabel.value = link.label || '';
    uiEls.formDescription.value = link.description || '';
    uiEls.formTags.value = formatTagsForInput(link.tags);
    refreshFormCatGrid();
    uiEls.formLabel.classList.remove('invalid'); uiEls.formUrl.classList.remove('invalid');
    selectedImportance = link.importance || DEFAULT_IMPORTANCE; paintStars(selectedImportance);
    uiEls.formImportanceWrap.style.display = (globalIdx < 5) ? 'none' : '';
    uiEls.formGalaxyWrap.style.display = isAddFlow ? 'none' : '';
    // مقدار selectedGalaxy همیشه با کهکشانِ فعلی هم‌تراز می‌شود — حتی در حالتِ
    // افزودن (add-flow، مثلاً پرکردنِ یک جایگاهِ خالیِ هسته). قبلاً این خط فقط
    // داخل شرطِ !isAddFlow بود، یعنی اگر selectedGalaxy از یک تعاملِ قبلی مقدارِ
    // قدیمی (مثلاً 1، باقی‌مانده از closeTree) داشت، پرکردنِ یک جایگاهِ خالیِ
    // هسته در کهکشانِ دیگر (مثلاً کهکشان ۲) در submitBookmarkForm به‌اشتباه
    // به‌عنوانِ «انتقال به کهکشان ۱» تفسیر می‌شد و بوک‌مارک به‌جای پر کردنِ همان
    // جایگاهِ هسته، به‌صورتِ یک آیتمِ عادیِ ۵ستاره در کهکشانِ ۱ ذخیره می‌شد.
    selectedGalaxy = currentHubIndex;
    if (!isAddFlow) {
      requestAnimationFrame(() => snapGalaxyKnobTo(selectedGalaxy, false));
    }
    if (isAddFlow) { uiEls.formMainTitle.textContent = t('formAddTitle'); uiEls.formSave.textContent = t('formSaveBtn'); }
    else { uiEls.formMainTitle.textContent = t('formEditTitle'); uiEls.formSave.textContent = t('formUpdateBtn'); }
    uiEls.formDelete.style.display = isAddFlow ? 'none' : '';
    uiEls.formDelete.textContent = (globalIdx < 5) ? t('formClearCoreBtn') : t('formDeleteBtn');
    uiEls.formMoveGalaxy.style.display = (!isAddFlow && globalIdx < 5) ? '' : 'none';
    uiEls.formMoveGalaxy.textContent = t('formMoveToGalaxyBtn');
    uiEls.formMoveCore.style.display = (!isAddFlow && globalIdx >= 5 && findEmptyCoreSlot(currentHubIndex) !== -1) ? '' : 'none';
    uiEls.formMoveCore.textContent = t('formMoveToCoreBtn');
    centerInlineForm();
    inlineForm.classList.add('active');
    if (isAddFlow) uiEls.formUrl.focus(); else uiEls.formLabel.focus();
  }

  let starEditorTargetIdx = null;
  function paintStarEditor(value) { starEditorPopup.querySelectorAll('.ai-star-edit').forEach(s => s.classList.toggle('active', parseInt(s.dataset.value, 10) <= value)); }
  
  function positionStarPopupAtHub() {
    const rect = hub.getBoundingClientRect(); const vw = window.innerWidth; const vh = window.innerHeight; const POP_W = 132; const POP_H = 32;
    let left = rect.left + (rect.width / 2) - (POP_W / 2); let top = rect.top - POP_H - 14;
    if (left < 8) left = 8; if (left + POP_W > vw - 8) left = vw - POP_W - 8; if (top < 8) top = rect.bottom + 14;
    starEditorPopup.style.left = `${left}px`; starEditorPopup.style.top = `${top}px`;
  }
  
  function openStarEditor(globalIdx, anchorEl) {
    starEditorTargetIdx = globalIdx;
    const rect = anchorEl.getBoundingClientRect(); const vw = window.innerWidth; const vh = window.innerHeight; const POP_W = 132; const POP_H = 32;
    let left = rect.left + (rect.width / 2) - (POP_W / 2); let top = rect.top - POP_H - 10;
    if (left < 8) left = 8; if (left + POP_W > vw - 8) left = vw - POP_W - 8; if (top < 8) top = rect.bottom + 10;
    starEditorPopup.style.left = `${left}px`; starEditorPopup.style.top = `${top}px`;
    const activeData = hubData(currentHubIndex);
    const link = activeData[globalIdx];
    paintStarEditor(link ? (link.importance || DEFAULT_IMPORTANCE) : DEFAULT_IMPORTANCE);
    starEditorPopup.classList.add('active');
  }
  
  function closeStarEditor() { 
    starEditorPopup.classList.remove('active', 'quickadd-mode'); 
    starEditorTargetIdx = null; 
    quickAddActive = false; 
    quickAddStars = 0;
  }

  starEditorPopup.querySelectorAll('.ai-star-edit').forEach(starEl => {
    starEl.addEventListener('click', (e) => {
      e.stopPropagation();
      
      if (quickAddActive) {
        const selectedStars = parseInt(starEl.dataset.value, 10);
        quickAddCurrentTab(selectedStars);
        closeStarEditor();
        return;
      }

      const activeData = hubData(currentHubIndex);
      if (starEditorTargetIdx === null || !activeData[starEditorTargetIdx]) { closeStarEditor(); return; }
      const link = activeData[starEditorTargetIdx];
      const newImportance = parseInt(starEl.dataset.value, 10);
      if (newImportance === (link.importance || DEFAULT_IMPORTANCE)) { closeStarEditor(); return; }

      const { ring, targetHub, overflowFromRing } = findTargetHubForImportance(newImportance, currentHubIndex);
      if (targetHub > HUB_COUNT) { closeStarEditor(); showToastNotification(t('toastTierFullEverywhere').replace('{tier}', ring.label), true); return; }

      link.importance = newImportance;
      if (ring.comet) { link.overflow = true; } else { delete link.overflow; }

      if (targetHub === currentHubIndex) {
        saveLinksAll(); closeStarEditor(); renderSpiral();
        showToastNotification(ring.comet
          ? t('toastOverflowedToComet').replace('{tier}', ringDisplayLabel(overflowFromRing)).replace('{hub}', targetHub)
          : t('toastStarUpdated'));
      } else {
        activeData.splice(starEditorTargetIdx, 1);
        hubData(targetHub).push(link);
        saveLinksAll(); closeStarEditor();
        showToastNotification(ring.comet
          ? t('toastOverflowedToComet').replace('{tier}', ringDisplayLabel(overflowFromRing)).replace('{hub}', targetHub)
          : t('toastOverflowed').replace('{tier}', ringDisplayLabel(ring)).replace('{hub}', targetHub - 1));
        currentLayerMode = RING_CONFIG.indexOf(ring);
        switchHub(targetHub, true);
      }
    });
    
    starEl.addEventListener('mouseenter', () => paintStarEditor(parseInt(starEl.dataset.value, 10)));
    starEl.addEventListener('mousedown', (e) => { e.stopPropagation(); });
  });

  starEditorPopup.addEventListener('mouseleave', () => {
    const activeData = hubData(currentHubIndex);
    if (starEditorTargetIdx !== null && activeData[starEditorTargetIdx]) paintStarEditor(activeData[starEditorTargetIdx].importance || DEFAULT_IMPORTANCE);
  });
  
  document.addEventListener('mousedown', (e) => {
    if (!starEditorPopup.classList.contains('active')) return;
    if (starEditorPopup.contains(e.target) || e.target.classList.contains('importance-badge')) return;
    closeStarEditor();
  });

  let selectedImportance = 3; const DEFAULT_IMPORTANCE = 3;
  const starEls = Array.from(inlineForm.querySelectorAll('.ai-star'));
  function paintStars(value) { starEls.forEach(s => s.classList.toggle('active', parseInt(s.dataset.value, 10) <= value)); }
  starEls.forEach(starEl => {
    starEl.addEventListener('click', (e) => { e.stopPropagation(); selectedImportance = parseInt(starEl.dataset.value, 10); paintStars(selectedImportance); });
    starEl.addEventListener('mouseenter', () => paintStars(parseInt(starEl.dataset.value, 10)));
  });
  const starsWrap = document.getElementById('ai-form-stars');
  starsWrap.addEventListener('mouseleave', () => paintStars(selectedImportance));

  let selectedGalaxy = 1;
  const galaxyStops = Array.from(uiEls.formGalaxyTrack.querySelectorAll('.ai-galaxy-stop'));
  function snapGalaxyKnobTo(hubNum, animate = true) {
    const stopEl = galaxyStops.find(s => parseInt(s.dataset.hub, 10) === hubNum);
    if (!stopEl) return;
    uiEls.formGalaxyKnob.classList.toggle('no-anim', !animate);
    const trackRect = uiEls.formGalaxyTrack.getBoundingClientRect();
    const stopRect = stopEl.getBoundingClientRect();
    const leftPx = stopRect.left + stopRect.width / 2 - trackRect.left - uiEls.formGalaxyKnob.offsetWidth / 2;
    uiEls.formGalaxyKnob.style.left = `${leftPx}px`;
    galaxyStops.forEach(s => s.classList.toggle('active', parseInt(s.dataset.hub, 10) === hubNum));
  }
  galaxyStops.forEach(stopEl => {
    stopEl.addEventListener('click', (e) => { e.stopPropagation(); selectedGalaxy = parseInt(stopEl.dataset.hub, 10); snapGalaxyKnobTo(selectedGalaxy); });
  });
  let isGalaxyDragging = false;
  function galaxyDragStart(e) { e.stopPropagation(); e.preventDefault(); isGalaxyDragging = true; uiEls.formGalaxyKnob.classList.add('dragging', 'no-anim'); }
  uiEls.formGalaxyKnob.addEventListener('mousedown', galaxyDragStart);
  uiEls.formGalaxyKnob.addEventListener('touchstart', galaxyDragStart, { passive: false });
  function galaxyDragMove(e) {
    if (!isGalaxyDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const trackRect = uiEls.formGalaxyTrack.getBoundingClientRect();
    let leftPx = clientX - trackRect.left - uiEls.formGalaxyKnob.offsetWidth / 2;
    leftPx = Math.max(0, Math.min(trackRect.width - uiEls.formGalaxyKnob.offsetWidth, leftPx));
    uiEls.formGalaxyKnob.style.left = `${leftPx}px`;
  }
  document.addEventListener('mousemove', galaxyDragMove);
  document.addEventListener('touchmove', galaxyDragMove, { passive: false });
  function galaxyDragEnd() {
    if (!isGalaxyDragging) return;
    isGalaxyDragging = false; uiEls.formGalaxyKnob.classList.remove('dragging');
    const knobRect = uiEls.formGalaxyKnob.getBoundingClientRect(); const knobCenterX = knobRect.left + knobRect.width / 2;
    let nearest = galaxyStops[0]; let nearestDist = Infinity;
    galaxyStops.forEach(s => {
      const r = s.getBoundingClientRect(); const dist = Math.abs((r.left + r.width / 2) - knobCenterX);
      if (dist < nearestDist) { nearestDist = dist; nearest = s; }
    });
    selectedGalaxy = parseInt(nearest.dataset.hub, 10);
    snapGalaxyKnobTo(selectedGalaxy);
  }
  document.addEventListener('mouseup', galaxyDragEnd);
  document.addEventListener('touchend', galaxyDragEnd);
  window.addEventListener('resize', () => { if (uiEls.formGalaxyWrap.style.display !== 'none') snapGalaxyKnobTo(selectedGalaxy, false); });

  addNodeBtn.addEventListener('click', (e) => {
    e.stopPropagation(); addNodeBtn.classList.add('blinking'); document.querySelectorAll('.ai-node').forEach(node => node.classList.add('faded'));
    editingNodeIndex = null; isLabelManuallyEdited = false; 
    uiEls.formMainTitle.textContent = t('formAddTitle'); uiEls.formSave.textContent = t('formSaveBtn');
    inlineForm.style.left = ''; inlineForm.style.top = '';
    uiEls.formUrl.value = ''; uiEls.formLabel.value = ''; uiEls.formDescription.value = ''; uiEls.formTags.value = '';
    refreshFormCatGrid();
    uiEls.formLabel.classList.remove('invalid'); uiEls.formUrl.classList.remove('invalid');
    uiEls.formImportanceWrap.style.display = '';
    uiEls.formDelete.style.display = 'none';
    uiEls.formMoveGalaxy.style.display = 'none';
    uiEls.formMoveCore.style.display = 'none';
    uiEls.formGalaxyWrap.style.display = 'none';
    selectedImportance = DEFAULT_IMPORTANCE; paintStars(selectedImportance);
    centerInlineForm();
    inlineForm.classList.add('active'); uiEls.formUrl.focus();
  });

  function closeInlineForm() {
    inlineForm.classList.remove('active'); addNodeBtn.classList.remove('blinking');
    document.querySelectorAll('.ai-node').forEach(node => node.classList.remove('faded'));
    if (uiEls.formTagsSuggest) uiEls.formTagsSuggest.classList.remove('active');
    if (uiEls.formCatAccordion) uiEls.formCatAccordion.classList.remove('open');
    // علامتِ + را که هنگام باز بودن فرم عمداً مخفی کرده بودیم، با محاسبه‌ی دوباره‌ی
    // موقعیت/نمایانی درستش (renderSpiral خودش تصمیم می‌گیرد جای خالی هست یا نه)
    // برمی‌گردانیم — نه صرفاً با یک display خام که ممکن است در جای غلط ظاهر شود.
    if (isOpen) renderSpiral();
  }

  function submitBookmarkForm() {
    const labelInput = uiEls.formLabel; const urlInput = uiEls.formUrl;
    const label = labelInput.value.trim(); let url = urlInput.value.trim();
    const description = uiEls.formDescription.value.trim();
    const tags = parseTagsFromInput(uiEls.formTags.value);
    labelInput.classList.remove('invalid'); urlInput.classList.remove('invalid');

    const activeDataForCheck = hubData(currentHubIndex);
    const isEditingCore = editingNodeIndex !== null && editingNodeIndex < 5 && !!activeDataForCheck[editingNodeIndex];
    if (isEditingCore && !label && !url) {
      activeDataForCheck[editingNodeIndex] = { label: '', url: '', description: '', tags: [], importance: DEFAULT_IMPORTANCE };
      editingNodeIndex = null; saveLinksAll(); renderSpiral(); closeTree();
      showToastNotification(t('toastDeleted'), true); return;
    }

    if (!label) { labelInput.classList.add('invalid'); labelInput.focus(); return; }
    if (!url) { urlInput.classList.add('invalid'); urlInput.focus(); return; }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try { new URL(url); } catch (err) { urlInput.classList.add('invalid'); urlInput.focus(); showToastNotification(t('toastInvalidUrl'), true); return; }

    const activeData = hubData(currentHubIndex);
    const isEditing = editingNodeIndex !== null && !!activeData[editingNodeIndex];

    const dupHub = isDuplicateNodeAll(url, label, isEditing ? editingNodeIndex : null, currentHubIndex);
    if (dupHub) { showToastNotification(t('toastExists').replace('{n}', String(dupHub)), true); return; }

    if (isEditing) {
        // هستهٔ ثابت دیگر جایگاه‌به‌جایگاه بین ۵ اسلاتِ همان کانون جابجا نمی‌شود (نمایشِ
        // مداری خطی نیست که «جایگاه» در آن معنا داشته باشد). به‌جایش، وقتی هستهٔ ثابت به
        // کهکشانِ دیگری منتقل می‌شود، دیگر «هسته» نیست: به یک بوک‌مارکِ عادیِ ردهٔ ۵ ستاره
        // در همان کهکشانِ مقصد تبدیل می‌شود — دقیقاً مثل انتقالِ یک بوک‌مارکِ عادی؛ جایگاهِ
        // هستهٔ مبدأ هم به حالتِ خالی برمی‌گردد (مثل «بازنشانی به خالی»).
        if (editingNodeIndex < 5 && selectedGalaxy && selectedGalaxy !== currentHubIndex) {
          const destGalaxy = selectedGalaxy;
          const destData = hubData(destGalaxy);
          const ring = RING_CONFIG[1]; // 5★
          const destFull = tierCountInHub(destGalaxy, ring) >= ring.max || destData.length >= MAX_NODES;

          // اگر ردهٔ ۵ ستارهٔ مقصد پر است، با قدیمی‌ترین موردِ همان رده در کهکشانِ مقصد
          // جا عوض کن — همان الگویِ سرریزِ کهکشانیِ بوک‌مارک‌های عادی.
          let swappedBackItem = null;
          if (destFull) {
            for (let i = 5; i < destData.length; i++) {
              const candidate = destData[i];
              const matches = !candidate.overflow && importanceMatchesRing(candidate.importance || 3, ring);
              if (matches) { swappedBackItem = destData.splice(i, 1)[0]; break; }
            }
          }

          const movedItem = { label, url, description, tags, importance: 5 };
          destData.push(movedItem);
          // جایگاهِ هستهٔ مبدأ ثابت می‌ماند (اندیس‌های ۰ تا ۴ همیشه باید وجود داشته باشند) — فقط خالی می‌شود
          activeData[editingNodeIndex] = { label: '', url: '', description: '', tags: [], importance: DEFAULT_IMPORTANCE };
          if (swappedBackItem) activeData.push(swappedBackItem);

          editingNodeIndex = null; selectedGalaxy = 1;
          saveLinksAll(); closeTree();
          switchHub(destGalaxy, true);
          showToastNotification(swappedBackItem
            ? t('toastGalaxySwapped').replace('{tier}', ringDisplayLabel(ring)).replace('{n}', destGalaxy)
            : t('toastGalaxyMoved').replace('{n}', destGalaxy));
          return;
        }
        if (editingNodeIndex >= 5 && selectedGalaxy && selectedGalaxy !== currentHubIndex) {
          const destData = hubData(selectedGalaxy);
          const ring = tierRingForImportance(selectedImportance);
          const destFull = tierCountInHub(selectedGalaxy, ring) >= ring.max || destData.length >= MAX_NODES;

          // اگر رده‌ی مقصد پر است، به‌جای رد کردن یا سرریزِ خودکار، با قدیمی‌ترین موردِ
          // همان رده در کهکشان مقصد جا عوض کن — کاربر می‌تواند با تکرار این کار،
          // کل یک کهکشان را قدم‌به‌قدم با کهکشان دیگر جابجا کند.
          let swappedBackItem = null;
          if (destFull) {
            for (let i = 5; i < destData.length; i++) {
              const candidate = destData[i];
              const matches = ring.comet ? !!candidate.overflow : (!candidate.overflow && importanceMatchesRing(candidate.importance || 3, ring));
              if (matches) { swappedBackItem = destData.splice(i, 1)[0]; break; }
            }
          }

          const movedItem = activeData.splice(editingNodeIndex, 1)[0];
          movedItem.label = label; movedItem.url = url; movedItem.importance = selectedImportance; movedItem.description = description; movedItem.tags = tags;
          destData.push(movedItem);
          if (swappedBackItem) activeData.push(swappedBackItem);

          const destGalaxy = selectedGalaxy;
          editingNodeIndex = null; saveLinksAll(); closeTree();
          switchHub(destGalaxy, true);
          showToastNotification(swappedBackItem
            ? t('toastGalaxySwapped').replace('{tier}', ringDisplayLabel(ring)).replace('{n}', destGalaxy)
            : t('toastGalaxyMoved').replace('{n}', destGalaxy));
          return;
        }
        activeData[editingNodeIndex].label = label; activeData[editingNodeIndex].url = url; activeData[editingNodeIndex].importance = selectedImportance; activeData[editingNodeIndex].description = description; activeData[editingNodeIndex].tags = tags;
        editingNodeIndex = null; showToastNotification(t('toastUpdated')); saveLinksAll(); renderSpiral(); closeTree(); return;
    }

    const { ring, targetHub, overflowFromRing } = findTargetHubForImportance(selectedImportance, currentHubIndex);

    if (targetHub > HUB_COUNT) {
        showToastNotification(t('toastTierFullEverywhere').replace('{tier}', ring.label), true);
        return;
    }

    const newBookmark = { label, url, description, tags, isCore: false, importance: selectedImportance };
    if (ring.comet) newBookmark.overflow = true;
    hubData(targetHub).push(newBookmark);

    if (ring.comet) {
        showToastNotification(t('toastOverflowedToComet').replace('{tier}', ringDisplayLabel(overflowFromRing)).replace('{hub}', targetHub));
        if (targetHub !== currentHubIndex) { currentLayerMode = RING_CONFIG.indexOf(ring); switchHub(targetHub, true); }
        else renderSpiral();
        saveLinksAll(); closeTree(); return;
    }

    if (targetHub !== currentHubIndex) {
        showToastNotification(t('toastOverflowed').replace('{tier}', ringDisplayLabel(ring)).replace('{hub}', targetHub - 1));
        currentLayerMode = RING_CONFIG.indexOf(ring);
        switchHub(targetHub, true); 
        saveLinksAll(); closeTree(); return;
    }

    showToastNotification(t('toastPlanted')); saveLinksAll(); renderSpiral(); closeTree();
  }

  function quickAddCurrentTab(importance) {
    importance = importance || DEFAULT_IMPORTANCE;
    let homeUrl, label;
    try {
      homeUrl = `${location.protocol}//${location.hostname}`;
      label = extractDomainName(homeUrl) || location.hostname;
    } catch (e) { return; }
    
    if (!homeUrl || !label) return;

    const dupHub = isDuplicateNodeAll(homeUrl, label, null, null);
    if (dupHub) { showToastNotification(t('toastExists').replace('{n}', String(dupHub)), true); return; }

    const startHub = isOpen ? currentHubIndex : 1;
    const { ring, targetHub, overflowFromRing } = findTargetHubForImportance(importance, startHub);
    if (targetHub > HUB_COUNT) { showToastNotification(t('toastTierFullEverywhere').replace('{tier}', ring.label), true); return; }

    const newItem = { label, url: homeUrl, description: '', tags: [], isCore: false, importance };
    if (ring.comet) newItem.overflow = true;
    hubData(targetHub).push(newItem);
    const newNodeIndex = hubData(targetHub).length - 1;
    saveLinksAll();
    
    closeAllPanelsExcept(''); 
    isOpen = true;
    root.classList.add('open');
    currentHubIndex = targetHub;
    
    const ringIndex = RING_CONFIG.indexOf(ring);
    currentLayerMode = ringIndex > 0 ? ringIndex : 1; 
    
    setHubLabel(ringDisplayLabel(RING_CONFIG[currentLayerMode]));
    renderSpiral(); renderTierDots();
    
    if (ring.comet) {
      showToastNotification(t('toastOverflowedToComet').replace('{tier}', ringDisplayLabel(overflowFromRing)).replace('{hub}', targetHub));
    } else {
      showToastNotification(t('toastQuickAdded').replace('{label}', label).replace('{stars}', '★'.repeat(importance)));
    }

    // ثبتِ خودکار بوک‌مارک بدون توضیح ذخیره می‌شود؛ برای این‌که کاربر مجبور نباشد جداگانه روی نود
    // کلیک کند تا توضیح اضافه کند، همان فرم ویرایش (که فیلد توضیحات را هم دارد) بلافاصله باز می‌شود
    // — فقط با فوکوس روی خودِ فیلد توضیحات، چون عنوان/آدرس از قبل درست پر شده‌اند.
    // بوک‌مارک از قبل با saveLinksAll() ذخیره شده؛ اگر کاربر این پنجره را لغو کند چیزی از دست نمی‌رود،
    // فقط توضیح خالی می‌ماند و می‌تواند بعداً از روی خودِ نود دوباره اضافه‌اش کند.
    openEditForm(newNodeIndex);
    if (uiEls.formDescription) uiEls.formDescription.focus();
  }

  // نگه‌داشتن ماوس دقیقاً وقتی که کاربر در نمای هستهٔ (بی‌ستاره) یک کهکشان است — همان‌طور که نگه‌داشتن
  // در نمای یک ردهٔ ستاره‌ای (مثلاً ۵★) بلافاصله به همان رده ثبت می‌کند، این تابع معادلش برای هسته است:
  // مستقیم در اولین جایگاه خالی از ۵ اسلاتِ ثابتِ هسته می‌نشیند (بدون باز شدن پاپ‌آپ انتخاب ستاره).
  function quickAddCurrentTabToCore() {
    let homeUrl, label;
    try {
      homeUrl = `${location.protocol}//${location.hostname}`;
      label = extractDomainName(homeUrl) || location.hostname;
    } catch (e) { return; }

    if (!homeUrl || !label) return;

    const dupHub = isDuplicateNodeAll(homeUrl, label, null, null);
    if (dupHub) { showToastNotification(t('toastExists').replace('{n}', String(dupHub)), true); return; }

    const startHub = isOpen ? currentHubIndex : 1;
    const slot = findEmptyCoreSlot(startHub);
    if (slot === -1) { showToastNotification(t('toastNoEmptyCoreSlot'), true); return; }

    hubData(startHub)[slot] = { label, url: homeUrl, description: '', tags: [], importance: DEFAULT_IMPORTANCE };
    saveLinksAll();

    closeAllPanelsExcept('');
    isOpen = true;
    root.classList.add('open');
    currentHubIndex = startHub;
    currentLayerMode = 0;

    setHubLabel(t('hubCore'));
    renderSpiral(); renderTierDots();

    showToastNotification(t('toastQuickAddedCore').replace('{label}', label));

    // همان الگوی quickAddCurrentTab: فرم ویرایش بلافاصله باز می‌شود تا کاربر توضیح اضافه کند؛
    // بوک‌مارک از قبل ذخیره شده، پس لغو این فرم چیزی را از دست نمی‌دهد.
    openEditForm(slot);
    if (uiEls.formDescription) uiEls.formDescription.focus();
  }

  uiEls.formSave.addEventListener('click', (e) => { e.stopPropagation(); submitBookmarkForm(); });
  uiEls.formCancel.addEventListener('click', (e) => { e.stopPropagation(); closeTree(); });
  uiEls.formDelete.addEventListener('click', (e) => {
    e.stopPropagation();
    if (editingNodeIndex === null) return;
    const activeData = hubData(currentHubIndex);
    if (!activeData[editingNodeIndex]) return;
    if (editingNodeIndex < 5) {
      activeData[editingNodeIndex] = { label: '', url: '', description: '', tags: [], importance: DEFAULT_IMPORTANCE };
      saveLinksAll(); renderSpiral(); showToastNotification(t('toastCoreCleared'));
      closeTree();
      return;
    }
    const deletedItem = activeData.splice(editingNodeIndex, 1)[0]; deletedItem._hub = currentHubIndex;
    try { chrome.storage.sync.set({ lastDeletedLink: deletedItem }); } catch (err) {}
    saveLinksAll(); renderSpiral(); showToastNotification(t('toastDeleted'), true); setUndoState('bookmark', deletedItem, currentHubIndex);
    closeTree();
  });
  // این هسته دیگر لازم نیست ثابت بماند — با این دکمه به‌عنوان یک بوک‌مارکِ عادیِ ۵ ستاره
  // وارد همین کهکشان می‌شود؛ دقیقاً با همان منطقِ سرریزِ استانداردِ افزودنِ بوک‌مارک
  // (اگر ردهٔ ۵ ستارهٔ همین کهکشان پر بود، به کهکشان بعدی، و در نهایت به ستاره‌های
  // دنباله‌دار سرریز می‌کند). جایگاه هستهٔ مبدأ (ثابت، همیشه موجود) خالی می‌شود.
  uiEls.formMoveGalaxy.addEventListener('click', (e) => {
    e.stopPropagation();
    if (editingNodeIndex === null || editingNodeIndex >= 5) return;
    const activeData = hubData(currentHubIndex);
    if (!activeData[editingNodeIndex]) return;

    const labelInput = uiEls.formLabel; const urlInput = uiEls.formUrl;
    const label = labelInput.value.trim(); let url = urlInput.value.trim();
    const description = uiEls.formDescription.value.trim();
    labelInput.classList.remove('invalid'); urlInput.classList.remove('invalid');
    if (!label) { labelInput.classList.add('invalid'); labelInput.focus(); return; }
    if (!url) { urlInput.classList.add('invalid'); urlInput.focus(); return; }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try { new URL(url); } catch (err) { urlInput.classList.add('invalid'); urlInput.focus(); showToastNotification(t('toastInvalidUrl'), true); return; }

    const dupHub = isDuplicateNodeAll(url, label, editingNodeIndex, currentHubIndex);
    if (dupHub) { showToastNotification(t('toastExists').replace('{n}', String(dupHub)), true); return; }

    // برخلافِ افزودنِ بوک‌مارکِ معمولی، این انتقال هرگز به کهکشانِ دیگری سرریز نمی‌کند —
    // مقصد همیشه همان کهکشانی‌ست که هسته الان در آن است: اول ردهٔ ۵ ستارهٔ همین کهکشان،
    // و فقط اگر آن پر بود، مجموعهٔ سرریزِ «ستاره‌های دنباله‌دار» همین کهکشان.
    const ring = RING_CONFIG[1]; // 5★
    const cometRing = RING_CONFIG[RING_CONFIG.length - 1];
    const star5Full = tierCountInHub(currentHubIndex, ring) >= ring.max || activeData.length >= MAX_NODES;
    let targetRing = ring;
    if (star5Full) {
      const cometFull = tierCountInHub(currentHubIndex, cometRing) >= cometRing.max || activeData.length >= MAX_NODES;
      if (cometFull) {
        showToastNotification(t('toastGalaxyFullNoOverflow'), true);
        return;
      }
      targetRing = cometRing;
    }

    const movedItem = { label, url, description, tags: parseTagsFromInput(uiEls.formTags.value), importance: 5 };
    if (targetRing.comet) movedItem.overflow = true;
    activeData.push(movedItem);
    activeData[editingNodeIndex] = { label: '', url: '', description: '', tags: [], importance: DEFAULT_IMPORTANCE };

    showToastNotification(targetRing.comet
      ? t('toastOverflowedToComet').replace('{tier}', ringDisplayLabel(ring)).replace('{hub}', currentHubIndex)
      : t('toastCoreToStar'));
    renderSpiral(); saveLinksAll(); closeTree();
  });
  // برعکسِ دکمهٔ بالا: یک بوک‌مارکِ معمولیِ همین کهکشان را به هسته (بی‌ستاره) می‌برد —
  // فقط وقتی حداقل یک جایگاه خالی در هستهٔ همین کهکشان وجود داشته باشد (مثلاً بعد از
  // اینکه یک هسته با دکمهٔ «انتقال به داخل کهکشان» خالی شده باشد).
  uiEls.formMoveCore.addEventListener('click', (e) => {
    e.stopPropagation();
    if (editingNodeIndex === null || editingNodeIndex < 5) return;
    const activeData = hubData(currentHubIndex);
    if (!activeData[editingNodeIndex]) return;

    const slot = findEmptyCoreSlot(currentHubIndex);
    if (slot === -1) { showToastNotification(t('toastNoEmptyCoreSlot'), true); return; }

    const labelInput = uiEls.formLabel; const urlInput = uiEls.formUrl;
    const label = labelInput.value.trim(); let url = urlInput.value.trim();
    const description = uiEls.formDescription.value.trim();
    labelInput.classList.remove('invalid'); urlInput.classList.remove('invalid');
    if (!label) { labelInput.classList.add('invalid'); labelInput.focus(); return; }
    if (!url) { urlInput.classList.add('invalid'); urlInput.focus(); return; }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try { new URL(url); } catch (err) { urlInput.classList.add('invalid'); urlInput.focus(); showToastNotification(t('toastInvalidUrl'), true); return; }

    const dupHub = isDuplicateNodeAll(url, label, editingNodeIndex, currentHubIndex);
    if (dupHub) { showToastNotification(t('toastExists').replace('{n}', String(dupHub)), true); return; }

    activeData[slot] = { label, url, description, tags: parseTagsFromInput(uiEls.formTags.value), importance: DEFAULT_IMPORTANCE };
    // چون این بوک‌مارک به یکی از ۵ جایگاه ثابتِ ابتدای آرایه منتقل شد، حالا با splice
    // از جای قبلی‌اش (اندیس ≥ ۵) برداشته می‌شود — بدون اینکه اندیس‌های ۰ تا ۴ دست بخورند.
    activeData.splice(editingNodeIndex, 1);

    showToastNotification(t('toastMovedToCore').replace('{n}', String(slot + 1)));
    renderSpiral(); saveLinksAll(); closeTree();
  });
  inlineForm.querySelector('#ai-form-close').addEventListener('click', (e) => { e.stopPropagation(); closeTree(); });

  // === Pan/drag برای فرم تنظیمات بوک‌مارک — دسته‌گیره: خودِ نوار عنوان (ai-form-header) ===
  // همان الگوی RAF-throttled جابه‌جاییِ خودِ هاب (پایین‌تر در فایل) اینجا هم تکرار شده تا
  // هم رفتار یکدست باشد هم مثل آن، هنگام درگ فریم افت نکند. کلیک روی دکمه‌ی ✕ عمداً از
  // شروع درگ مستثنی است تا کاربر بتواند فرم را ببندد بدون این‌که تصادفاً جابه‌جایش کند.
  (function setupInlineFormPan() {
    const header = inlineForm.querySelector('.ai-form-header');
    let panning = false, startX = 0, startY = 0, startLeft = 0, startTop = 0, panRafId = null;

    function onDown(e) {
      if (e.target.closest('#ai-form-close')) return;
      e.stopPropagation();
      panning = true; inlineForm.classList.add('panning');
      // این نشانگر همین الان (نه در onUp) ست می‌شود و در onUp با یک تأخیرِ صفر
      // پاک می‌شود — چون listenerِ mouseup پایین‌تر (که با کلیکِ بیرون فرم را
      // می‌بندد) هم روی document ثبت شده و در همان چرخه‌ی رویدادِ mouseup اجرا
      // می‌شود. بدونِ این نشانگر، اگر کاربر با سرعت درگ کند، به‌خاطر throttleِ
      // RAF موقعیتِ فرم ممکن است یک فریم عقب‌تر از نشانگرِ ماوس باشد؛ در لحظه‌ی
      // release، مرورگر e.target را از رویِ موقعیتِ واقعیِ ماوس حساب می‌کند که
      // ممکن است بیرون از کادرِ (هنوز جابه‌جا‌نشده‌ی) فرم باشد — و فرم را دقیقاً
      // وسطِ درگ‌کردن می‌بندد.
      inlineForm.dataset.justPanned = '1';
      const point = e.touches ? e.touches[0] : e;
      const rect = inlineForm.getBoundingClientRect();
      startX = point.clientX; startY = point.clientY; startLeft = rect.left; startTop = rect.top;
    }
    function onMove(e) {
      if (!panning) return;
      const point = e.touches ? e.touches[0] : e;
      const dx = point.clientX - startX; const dy = point.clientY - startY;
      if (!panRafId) {
        panRafId = requestAnimationFrame(() => {
          // محدودسازی به داخل ویوپورت: حداقل ۴۰ پیکسل از فرم همیشه در دیدرس بماند تا هیچ‌وقت
          // کاملاً از صفحه بیرون نرود و کاربر گیر نکند.
          const vw = window.innerWidth, vh = window.innerHeight;
          const w = inlineForm.offsetWidth, h = inlineForm.offsetHeight;
          let nextLeft = startLeft + dx; let nextTop = startTop + dy;
          nextLeft = Math.max(-w + 40, Math.min(vw - 40, nextLeft));
          nextTop = Math.max(0, Math.min(vh - 40, nextTop));
          inlineForm.style.left = `${nextLeft}px`; inlineForm.style.top = `${nextTop}px`;
          panRafId = null;
        });
      }
    }
    function onUp() {
      panning = false; inlineForm.classList.remove('panning');
      // پاک‌کردنِ نشانگر با تأخیرِ صفر (نه بلافاصله)، تا listenerِ بستنِ فرم که
      // پایین‌تر روی همین رویدادِ mouseup ثبت شده هنوز بتواند آن را ببیند —
      // چون هر دو listener روی document و روی همین یک mouseup به ترتیبِ ثبت
      // اجرا می‌شوند (این یکی زودتر ثبت شده، پس زودتر هم اجرا می‌شود).
      setTimeout(() => { delete inlineForm.dataset.justPanned; }, 0);
    }

    header.addEventListener('mousedown', onDown);
    header.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchend', onUp);
  })();


  uiEls.formUrl.addEventListener('input', function() {
    if (!isLabelManuallyEdited) { const autoName = extractDomainName(this.value); if (autoName) uiEls.formLabel.value = autoName; else if (this.value.trim() === '') uiEls.formLabel.value = ''; }
  });
  uiEls.formLabel.addEventListener('input', function() { isLabelManuallyEdited = true; });

  // === Tag autocomplete (V33.2) ==============================================
  // پیشنهاد بر اساس بخشِ در-حالِ-تایپِ ورودی (متن بعد از آخرین کاما)، نه کل رشته —
  // تا وقتی کاربر تگ دوم را می‌نویسد، پیشنهادها بر اساس تگ اول قاطی نشوند.
  function currentTagFragment() {
    const raw = uiEls.formTags.value;
    const lastComma = raw.lastIndexOf(',');
    return lastComma === -1 ? raw : raw.slice(lastComma + 1);
  }

  function renderTagSuggestions() {
    const box = uiEls.formTagsSuggest;
    const fragment = currentTagFragment().trim();
    box.innerHTML = '';
    if (!fragment) { box.classList.remove('active'); return; }
    const already = parseTagsFromInput(uiEls.formTags.value.replace(/[^,]*$/, ''));
    const suggestions = suggestTags(fragment).filter(tg => !already.includes(tg));
    if (suggestions.length === 0) { box.classList.remove('active'); return; }
    suggestions.forEach(tg => {
      const chip = document.createElement('span'); chip.className = 'ai-tags-suggest-chip'; chip.textContent = '#' + tg;
      chip.addEventListener('mousedown', (e) => {
        // mousedown نه click: تا blur خودکار اینپوت قبل از کلیک، پیشنهاد را نبندد
        e.preventDefault();
        const raw = uiEls.formTags.value;
        const lastComma = raw.lastIndexOf(',');
        const prefix = lastComma === -1 ? '' : raw.slice(0, lastComma + 1) + ' ';
        uiEls.formTags.value = prefix + tg + ', ';
        uiEls.formTags.focus();
        renderTagSuggestions();
      });
      box.appendChild(chip);
    });
    box.classList.add('active');
  }

  uiEls.formTags.addEventListener('input', renderTagSuggestions);
  uiEls.formTags.addEventListener('focus', renderTagSuggestions);
  uiEls.formTags.addEventListener('blur', () => { uiEls.formTagsSuggest.classList.remove('active'); });
  uiEls.formTags.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); submitBookmarkForm(); }
    else if (e.key === 'Escape') { e.preventDefault(); uiEls.formTagsSuggest.classList.remove('active'); closeTree(); }
  });

  [uiEls.formLabel, uiEls.formUrl].forEach(el => {
    el.addEventListener('input', () => el.classList.remove('invalid'));
    el.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); submitBookmarkForm(); } else if (e.key === 'Escape') { e.preventDefault(); closeTree(); } });
  });
  // برخلاف قبل که با mousedown روی هر نقطه‌ی بیرون از فرم بلافاصله فرم را می‌بست،
  // این رفتار مانع از انتخاب متنِ صفحه (مثلاً برای کپی‌کردن در توضیحات) می‌شد —
  // چون خودِ شروعِ درگ برای انتخاب متن هم یک mousedown بیرون از فرم است. حالا با
  // mouseup تصمیم می‌گیریم و اگر همین تعامل باعث ایجاد یک انتخاب متنیِ غیرخالی
  // شده باشد (یعنی کاربر داشت متن انتخاب می‌کرد، نه اینکه می‌خواست فرم را ببندد)،
  // فرم را باز نگه می‌داریم.
  document.addEventListener('mouseup', (e) => {
    if (!inlineForm.classList.contains('active')) return;
    if (inlineForm.dataset.justPanned) return; // همین الان داشتیم فرم را جابه‌جا (درگ) می‌کردیم — نبند
    if (inlineForm.contains(e.target) || e.target === addNodeBtn) return;
    const sel = window.getSelection ? window.getSelection().toString() : '';
    if (sel && sel.trim().length > 0) return; // درحال انتخاب/کپیِ متنِ صفحه بود — فرم بسته نشود
    closeInlineForm();
  });

  function closeTree() {
    isOpen = false; showAllOverride = false; currentLayerMode = 0; editingNodeIndex = null; selectedGalaxy = 1;
    root.classList.remove('open', 'show-all-active'); inlineForm.classList.remove('active'); addNodeBtn.classList.remove('blinking');
    setHubLabel('AI');
    document.querySelectorAll('.ai-node').forEach(node => { node.classList.remove('faded'); node.style.transitionDelay = '0s'; }); resetToggleTimeout();
    if (typeof renderTierDots === 'function') renderTierDots();
    if (typeof renderHubDots === 'function') renderHubDots();
    updateBookmarkCount();
    // بستنِ منو یعنی هاب دوباره جمع می‌شود روی همان نقطه‌ای که (احتمالاً) باز بوده —
    // اگر زیرش الان یک پلیر بزرگ افتاده باشد، باید همین‌جا دوباره چک شود، نه فقط
    // منتظر رویدادهای play/resize/scroll ویدیو ماند.
    if (typeof scheduleCinemaCheck === 'function') scheduleCinemaCheck();
  }

  collapseToggleDot.addEventListener('click', (e) => { if (!chrome.runtime?.id) return; e.stopPropagation(); playLauncherClick(3); closeTree(); closeAllPanelsExcept(''); hub.classList.add('hub-collapsed'); if (typeof collapseMotivationalQuotes === 'function') collapseMotivationalQuotes(); });

  let clickTimeout = null;
  let quickAddFired = false; let quickAddActive = false; let quickAddStars = 0;
  let holdGraceTimer = null;
  const QUICKADD_REVEAL_MS = 450; 

  function updateQuickAddStarsFromX(clientX) {
    const starEls = starEditorPopup.querySelectorAll('.ai-star-edit');
    let n = 0;
    starEls.forEach((el, i) => { const r = el.getBoundingClientRect(); if (clientX >= r.left + r.width * 0.35) n = i + 1; });
    if (n !== quickAddStars) { quickAddStars = n; paintStarEditor(quickAddStars); }
  }

  function commitQuickAddHold() {
    clearTimeout(holdGraceTimer);
    if (!quickAddActive) return;
    
    const stars = quickAddStars;

    if (stars === 0) {
      quickAddFired = true; 
      starEditorPopup.classList.remove('quickadd-mode');
      return; 
    }

    quickAddCurrentTab(stars);
    closeStarEditor(); 
    quickAddFired = true; 
    hub.classList.add('quickadd-flash'); setTimeout(() => hub.classList.remove('quickadd-flash'), 450);
  }

  hub.addEventListener('click', (e) => {
    e.stopPropagation(); 
    if (quickAddFired) { quickAddFired = false; return; } 
    if (hub.classList.contains('hub-collapsed')) { hub.classList.remove('hub-collapsed'); playLauncherOpen(); triggerQuantumBloom(); resetAutoCollapseTimer(); return; }
    if (dragMoved) { dragMoved = false; return; } 
    if (uiToggles.includes(e.target.id)) return;
    if (e.detail === 1) {
      clickTimeout = setTimeout(() => {
        if (!isOpen) { closeAllPanelsExcept(''); isOpen = true; currentLayerMode = 0; root.classList.add('open'); playLauncherOpen(); renderSpiral(); triggerQuantumBloom(); } 
        else { cycleLayer(); }
        resetToggleTimeout(); resetAutoCollapseTimer(); 
      }, 220); 
    }
  });

  hub.addEventListener('dblclick', (e) => { e.stopPropagation(); if (uiToggles.includes(e.target.id)) return; clearTimeout(clickTimeout); if (isOpen) closeTree(); });

  let startDragX, startDragY, startLeft, startTop;
  hub.addEventListener('mousedown', (e) => {
    if (uiToggles.includes(e.target.id)) return;
    // اگر کاربر وسطِ حالت سینمایی خودش دستی بکشدش، دیگر نباید با خروج از حالت
    // سینمایی به موقعیت قبلی برگردد — همین موقعیت جدید (دستی) از این پس معتبر است.
    if (cinemaModeActive) { cinemaModeActive = false; preCinemaPos = null; root.classList.remove('is-cinema-shifted'); }
    isDragging = true; dragMoved = false; root.classList.add('dragging'); 
    const rect = root.getBoundingClientRect(); 
    startDragX = e.clientX; startDragY = e.clientY; 
    startLeft = rect.left + (rect.width/2); startTop = rect.top + (rect.height/2); 
    e.preventDefault();

    quickAddFired = false; quickAddActive = false; quickAddStars = 0;
    if (!hub.classList.contains('hub-collapsed')) {
      clearTimeout(holdGraceTimer);
      const contextRing = (isOpen && currentLayerMode > 0 && !showAllOverride) ? RING_CONFIG[currentLayerMode] : null;
      // نمای هسته (بی‌ستاره) با یک جایگاه خالی — دقیقاً مثل نگه‌داشتن روی یک ردهٔ ستاره‌ای،
      // بلافاصله همان‌جا ثبت می‌شود؛ فقط وقتی هسته پر باشد به پاپ‌آپ انتخاب ستاره برمی‌گردیم.
      const coreHasEmptySlot = (isOpen && currentLayerMode === 0 && !showAllOverride && findEmptyCoreSlot(currentHubIndex) !== -1);
      holdGraceTimer = setTimeout(() => {
        if (!isDragging || dragMoved) return;
        if (contextRing) {
          quickAddFired = true;
          const importance = contextRing.importance !== undefined ? contextRing.importance : contextRing.importanceMax;
          quickAddCurrentTab(importance);
          hub.classList.add('quickadd-flash'); setTimeout(() => hub.classList.remove('quickadd-flash'), 450);
        } else if (coreHasEmptySlot) {
          quickAddFired = true;
          quickAddCurrentTabToCore();
          hub.classList.add('quickadd-flash'); setTimeout(() => hub.classList.remove('quickadd-flash'), 450);
        } else {
          quickAddActive = true;
          positionStarPopupAtHub(); starEditorPopup.classList.add('active', 'quickadd-mode');
          quickAddStars = 0; paintStarEditor(0); 
        }
      }, QUICKADD_REVEAL_MS);
    }
  });

  let rafId = null;
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return; 
    if (quickAddActive) { updateQuickAddStarsFromX(e.clientX); return; } 
    const dx = e.clientX - startDragX; const dy = e.clientY - startDragY; 
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      if (!dragMoved) clearTimeout(holdGraceTimer); 
      dragMoved = true;
    }
    if (!rafId) {
        rafId = requestAnimationFrame(() => {
            root.style.left = (startLeft + dx) + 'px'; root.style.top = (startTop + dy) + 'px'; root.style.bottom = 'auto'; 
            if (isOpen) repositionSpiralNodes(); 
            adjustNotepadPosition(); adjustCalcPosition(); adjustClockPosition(); adjustTodoPosition(); adjustSearchPosition(); adjustDotsNavPosition(); adjustHubDotsPosition();
            rafId = null;
        });
    }
  });
  
  document.addEventListener('mouseup', () => { 
    commitQuickAddHold(); 
    if (!isDragging) return; isDragging = false; root.classList.remove('dragging'); 
    try { if (chrome.runtime?.id) { chrome.storage.sync.set({ orbitX: parseInt(root.style.left), orbitY: parseInt(root.style.top) }); } } catch(err) {} 
  });

  // تماشای فیلم/استریم/بازی در حالت تمام‌صفحه — ویجت خودکار پنهان می‌شود تا مزاحم نباشد،
  // و با خروج از تمام‌صفحه به همان وضعیت قبلی برمی‌گردد. اگر کاربر خودش قبلاً از پاپ‌آپ
  // «Hide» زده بود، این منطق دخالت نمی‌کند — چون آن حالت را عوض نکرده بودیم.
  let widgetHiddenByFullscreen = false;
  // «Hide» از پاپ‌آپ حالا برای کلِ دامنه (تمام زیرصفحه‌ها) در chrome.storage.sync ثبت
  // می‌شود، نه فقط همین یک تب — پس خروج از فول‌اسکرین هم نباید آن را دوباره ظاهر کند.
  let widgetHiddenByDomain = false;
  function handleFullscreenChange() {
    const isFullscreen = !!document.fullscreenElement;
    if (isFullscreen) {
      if (root.style.display !== 'none') {
        widgetHiddenByFullscreen = true;
        root.style.display = 'none';
        reportLauncherVisibility();
      }
    } else if (widgetHiddenByFullscreen) {
      widgetHiddenByFullscreen = false;
      if (!widgetHiddenByDomain) root.style.display = '';
      reportLauncherVisibility();
    }
  }
  document.addEventListener('fullscreenchange', handleFullscreenChange);

  // ---------------------------------------------------------------------
  // «حالت سینمایی نرم» — برای سایت‌هایی که واقعاً Fullscreen API را صدا
  // نمی‌زنند و فقط پلیر را در همان صفحه بزرگ می‌کنند (تئاترمود یوتیوب، کارت
  // ویدیوی توییتر/ایکس، پلیرهای جاسازی‌شده و…). به‌جای شناسایی سایت‌به‌سایت
  // (که شکننده است)، هر <video> صفحه را زیر نظر می‌گیریم: اگر مستطیل نمایشِ
  // یکی از آن‌ها نسبت بزرگی از viewport را بپوشاند، ویجت را به‌جای پنهان‌شدن
  // کامل، به گوشهٔ واقعیِ صفحه (نه موقعیت ریست، نه موقعیت دستیِ کاربر) شیفت
  // می‌دهیم — چون معمولاً پلیرِ بزرگ‌شده (برخلاف فول‌اسکرین واقعی) تمام
  // viewport را نمی‌پوشاند، گوشهٔ واقعی صفحه اغلب بیرون از قاب پلیر و کنترل‌هایش
  // می‌ماند.
  const CINEMA_SHIFT_LEFT = '16px';
  const CINEMA_SHIFT_BOTTOM = '16px';
  let cinemaModeActive = false;
  let preCinemaPos = null; // { left, top, bottom } — دقیقاً همان چیزی که قبل از شیفت روی root بود

  function isLargeVideoRect(rect) {
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;
    const vw = window.innerWidth, vh = window.innerHeight;
    return rect.width >= vw * 0.55 && rect.height >= vh * 0.5;
  }

  function anyLargeVideoVisible() {
    const videos = document.querySelectorAll('video');
    for (const v of videos) {
      if (v.readyState === 0 && !v.currentSrc) continue; // منبعی هنوز بارنشده — پلیر واقعی نیست
      if (isLargeVideoRect(v.getBoundingClientRect())) return true;
    }
    return false;
  }

  function applyCinemaShift() {
    if (cinemaModeActive || widgetHiddenByFullscreen || root.style.display === 'none') return;
    cinemaModeActive = true;
    preCinemaPos = { left: root.style.left, top: root.style.top, bottom: root.style.bottom };
    root.style.left = CINEMA_SHIFT_LEFT;
    root.style.top = 'auto';
    root.style.bottom = CINEMA_SHIFT_BOTTOM;
    root.classList.add('is-cinema-shifted');
  }

  function releaseCinemaShift() {
    if (!cinemaModeActive) return;
    cinemaModeActive = false;
    root.classList.remove('is-cinema-shifted');
    if (preCinemaPos) {
      root.style.left = preCinemaPos.left;
      root.style.top = preCinemaPos.top;
      root.style.bottom = preCinemaPos.bottom;
    }
    preCinemaPos = null;
  }

  let cinemaCheckTimer = null;
  function scheduleCinemaCheck() {
    if (cinemaCheckTimer) return;
    cinemaCheckTimer = setTimeout(() => {
      cinemaCheckTimer = null;
      if (document.fullscreenElement) return; // فول‌اسکرین واقعی خودش قبلاً کل ویجت را پنهان کرده
      // وقتی تری باز است و کاربر دارد رویش کار می‌کند، نباید وسط تعامل (مثلاً با
      // اسکرول یا تغییر اندازه‌ی ویدیو) ناگهان جابه‌جا شود — این تصمیم را عمداً به
      // لحظه‌ی closeTree() موکول می‌کنیم که خودش دوباره همین تابع را صدا می‌زند.
      if (isOpen) return;
      if (anyLargeVideoVisible()) applyCinemaShift();
      else releaseCinemaShift();
    }, 350);
  }

  // رویداد play روی <video> بابل نمی‌کند، پس باید در فاز capture گوش داد.
  document.addEventListener('play', (e) => { if (e.target && e.target.tagName === 'VIDEO') scheduleCinemaCheck(); }, true);
  window.addEventListener('resize', scheduleCinemaCheck);
  window.addEventListener('scroll', scheduleCinemaCheck, { passive: true });
  document.addEventListener('fullscreenchange', scheduleCinemaCheck);

  // 'resize' یک event استاندارد روی المان‌های معمولی نیست (فقط window دارد)، پس
  // برای گرفتنِ لحظهٔ «تئاترمود شدن» یک ویدیوی مشخص (بدون تغییر اندازهٔ کل صفحه)
  // باید هر <video> را جدا با ResizeObserver دنبال کرد.
  const observedVideos = new WeakSet();
  const cinemaVideoResizeObserver = new ResizeObserver(scheduleCinemaCheck);
  function trackNewVideos() {
    document.querySelectorAll('video').forEach(v => {
      if (!observedVideos.has(v)) { observedVideos.add(v); cinemaVideoResizeObserver.observe(v); }
    });
  }
  trackNewVideos();
  // مثل domWatchdog (بالاتر در همین فایل، مدیریتِ SPA re-attach): این observer هم
  // روی کلِ درختِ سند گوش می‌دهد، پس در فیدهای پرتغییر (اسکرولِ بی‌نهایتِ
  // توییتر/اینستاگرام) callback می‌تواند صدها بار در ثانیه اجرا شود. قبلاً
  // trackNewVideos() (یک querySelectorAll('video') روی کلِ صفحه) بی‌درنگ و بدون
  // throttle داخل همان callback اجرا می‌شد؛ حالا با همان الگوی pending-flag که
  // domWatchdog استفاده می‌کند batch می‌شود.
  let _videoScanPending = false;
  function scheduleVideoScan() {
    if (_videoScanPending) return;
    _videoScanPending = true;
    setTimeout(() => { _videoScanPending = false; trackNewVideos(); }, 150);
  }
  new MutationObserver(() => { scheduleVideoScan(); scheduleCinemaCheck(); }).observe(document.documentElement, { childList: true, subtree: true });

  // ---------------------------------------------------------------------
  // «استراحتِ ویجت»:
  //   • ۱ دقیقه بی‌استفادگی  → اگر کاربر ویجت را جابه‌جا کرده بود، به گوشهٔ پیش‌فرضِ خودش برمی‌گردد.
  //   • ۵ دقیقه بی‌استفادگی → ویجت محو/غیرفعال می‌شود (display دست نمی‌خورد تا با منطقِ
  //     fullscreen/دامنه/سینمایی تداخل نکند) و با نزدیک‌شدنِ ماوس به جایش دوباره ظاهر می‌شود.
  // «استفاده» یعنی: تعامل با خودِ ویجت/پنل‌ها، یا بازبودنِ هر پنل/فرم/درگ. زمانِ تبِ پس‌زمینه
  // حساب نمی‌شود. روی صفحه‌های خودِ افزونه (Void Tab) غیرفعال است.
  // ---------------------------------------------------------------------
  const IDLE_RESET_POSITION_MS = 60 * 1000;
  const IDLE_HIDE_MS = 5 * 60 * 1000;
  const IDLE_WAKE_MARGIN_PX = 90;
  const IDLE_CLEARS_SAVED_POSITION = true; // true: orbitX/orbitY ذخیره‌شده هم پاک شود تا بعد از رفرش هم گوشه بماند
  let lastWidgetActivityTs = Date.now();
  let idleHidden = false;
  let idleFadeAnim = null;
  let idleWakeMoveHandler = null;

  function isWidgetAtDefaultPosition() {
    const st = root.style;
    if (!st.left && !st.top && !st.bottom) return true;
    return st.left === WIDGET1_DEFAULT_LEFT && st.top === 'auto' && st.bottom === WIDGET1_DEFAULT_BOTTOM;
  }
  function isWidgetBusy() {
    try {
      return !!(isDragging || quickAddActive || isHoveringWidget || isNotePinned || isOpen ||
        inlineForm.classList.contains('active') || quickNoteForm.classList.contains('active') ||
        calcPanel.classList.contains('active') || clockPanel.classList.contains('active') ||
        todoPanel.classList.contains('active') || searchPanel.classList.contains('active') ||
        starEditorPopup.classList.contains('active') ||
        (uiEls.webSearchDrawer && !uiEls.webSearchDrawer.hasAttribute('hidden')));
    } catch (e) { return true; } // در شک، «مشغول» حساب کن تا ویجتِ در حال استفاده هرگز پنهان نشود
  }
  function touchWidgetActivity() {
    lastWidgetActivityTs = Date.now();
    if (idleHidden) wakeFromIdle();
  }
  function idleResetPositionToCorner() {
    if (cinemaModeActive || widgetHiddenByFullscreen || widgetHiddenByDomain || root.style.display === 'none') return;
    if (isWidgetAtDefaultPosition()) return;
    const apply = () => {
      root.style.left = WIDGET1_DEFAULT_LEFT; root.style.top = 'auto'; root.style.bottom = WIDGET1_DEFAULT_BOTTOM;
      try { if (IDLE_CLEARS_SAVED_POSITION && chrome.runtime?.id) chrome.storage.sync.remove(['orbitX', 'orbitY']); } catch (err) {}
      try { adjustNotepadPosition(); adjustCalcPosition(); adjustClockPosition(); adjustTodoPosition(); adjustSearchPosition(); adjustDotsNavPosition(); adjustHubDotsPosition(); } catch (err) {}
    };
    try {
      const out = root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-out', fill: 'forwards' });
      out.onfinish = () => {
        apply();
        try { root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-in' }); } catch (err) {}
        out.cancel();
      };
    } catch (err) { apply(); }
  }
  function enterIdleHidden() {
    if (idleHidden) return;
    idleHidden = true;
    launcherIdleHidden = true;
    root.setAttribute('inert', '');
    root.style.pointerEvents = 'none';
    try {
      idleFadeAnim = root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, easing: 'ease-out', fill: 'forwards' });
      const a = idleFadeAnim;
      a.onfinish = () => { if (idleHidden) root.style.opacity = '0'; a.cancel(); if (idleFadeAnim === a) idleFadeAnim = null; };
    } catch (err) { root.style.opacity = '0'; }
    let lastCheck = 0;
    idleWakeMoveHandler = (e) => {
      const now = Date.now(); if (now - lastCheck < 120) return; lastCheck = now;
      const r = root.getBoundingClientRect(), m = IDLE_WAKE_MARGIN_PX;
      if (e.clientX >= r.left - m && e.clientX <= r.right + m && e.clientY >= r.top - m && e.clientY <= r.bottom + m) touchWidgetActivity();
    };
    document.addEventListener('mousemove', idleWakeMoveHandler, { passive: true });
    reportLauncherVisibility();
  }
  function wakeFromIdle() {
    if (!idleHidden) return;
    idleHidden = false;
    launcherIdleHidden = false;
    lastWidgetActivityTs = Date.now();
    if (idleWakeMoveHandler) { document.removeEventListener('mousemove', idleWakeMoveHandler); idleWakeMoveHandler = null; }
    try { if (idleFadeAnim) { idleFadeAnim.cancel(); idleFadeAnim = null; } } catch (err) {}
    root.removeAttribute('inert');
    root.style.pointerEvents = '';
    root.style.opacity = '';
    try { root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, easing: 'ease-in' }); } catch (err) {}
    reportLauncherVisibility();
  }
  if (location.protocol !== 'chrome-extension:') {
    [root, quickNoteForm, calcPanel, clockPanel, todoPanel, searchPanel].forEach((el) => {
      if (!el) return;
      ['pointerdown', 'keydown', 'wheel', 'focusin'].forEach((ev) => el.addEventListener(ev, touchWidgetActivity, { passive: true, capture: true }));
      el.addEventListener('mouseenter', touchWidgetActivity, { passive: true });
    });
    // پایانِ درگ هم «استفاده» است (مدتِ درگ از لحظهٔ mousedown حساب نشود).
    hub.addEventListener('mousedown', () => document.addEventListener('mouseup', touchWidgetActivity, { once: true }), true);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) lastWidgetActivityTs = Date.now(); });
    const idleTickId = setInterval(() => {
      if (!chrome.runtime?.id) { clearInterval(idleTickId); return; } // افزونه ری‌لود شده؛ این تبِ یتیم دیگر کاری نکند
      if (document.hidden || root.style.display === 'none') return;
      if (isWidgetBusy()) { lastWidgetActivityTs = Date.now(); if (idleHidden) wakeFromIdle(); return; }
      const idleFor = Date.now() - lastWidgetActivityTs;
      if (idleFor >= IDLE_RESET_POSITION_MS && !idleHidden) idleResetPositionToCorner();
      if (idleFor >= IDLE_HIDE_MS) enterIdleHidden();
    }, 5000);
    // بازراه‌اندازی/ریست از popup باید ویجتِ خوابیده را بیدار کند.
    chrome.runtime.onMessage.addListener((message) => {
      if (message && (message.action === 'relaunchLauncher' || message.action === 'softRelaunchAnly' || message.action === 'resetFloatingMenuPositionAnly')) touchWidgetActivity();
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'void-launcher-visibility-query') {
      sendResponse({ ready: launcherVisibilityReady, visible: launcherVisibilityReady && launcherIsActuallyVisible() });
      return;
    }
    if (message.action === "resetFloatingMenuPositionAnly") {
      widgetHiddenByFullscreen = false;
      widgetHiddenByDomain = false;
      cinemaModeActive = false; preCinemaPos = null; root.classList.remove('is-cinema-shifted');
      root.style.display = ''; root.style.left = WIDGET1_DEFAULT_LEFT; root.style.top = 'auto'; root.style.bottom = WIDGET1_DEFAULT_BOTTOM; 
      reportLauncherVisibility(true);
      clockManuallyPositioned = false; // کادر ساعت هم به حالت لنگرشده روی هاب برمی‌گردد
      try { if (chrome.runtime?.id) chrome.storage.sync.remove(['clockCustomX', 'clockCustomY']); } catch (err) {}
      if (isOpen) renderSpiral(); adjustNotepadPosition(); adjustCalcPosition(); adjustClockPosition(); adjustTodoPosition(); adjustSearchPosition(); adjustDotsNavPosition(); adjustHubDotsPosition();
    }
    if (message.action === "refreshSpiralUI") {
      loadDataAndRender();
      if (typeof restoreNoteDraft === 'function') restoreNoteDraft();
    }
    if (message.action === "softRelaunchAnly" || message.action === "relaunchLauncher") {
      try {
        lifecycle.relaunchSilently(message.reason || message.action, { silent: !!message.silent });
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: String(err && err.message || err) });
      }
      return true;
    }
    if (message.action === "hideLauncherAnly") { widgetHiddenByFullscreen = false; cinemaModeActive = false; preCinemaPos = null; root.classList.remove('is-cinema-shifted'); root.style.display = 'none'; reportLauncherVisibility(); }
    if (message.action === "getBookmarkBackups") {
      try { chrome.storage.local.get(['aiTreeBookmarkBackups'], (data) => sendResponse({ backups: data.aiTreeBookmarkBackups || [] })); return true; } catch (e) { sendResponse({ backups: [] }); }
    }
    if (message.action === "restoreBookmarkBackup" && message.ts) {
      try {
        chrome.storage.local.get(['aiTreeBookmarkBackups'], (data) => {
          const backups = data.aiTreeBookmarkBackups || []; const found = backups.find(b => b.ts === message.ts);
          if (found) {
            linksData = JSON.parse(JSON.stringify(found.main || found.data || []));
            linksData2 = JSON.parse(JSON.stringify(found.w2 || []));
            linksData3 = JSON.parse(JSON.stringify(found.w3 || []));
            linksData4 = JSON.parse(JSON.stringify(found.w4 || found.news || []));
            if (!linksData4 || linksData4.length < 5) linksData4 = [{ label: '', url: '' }, { label: '', url: '' }, { label: '', url: '' }, { label: '', url: '' }, { label: '', url: '' }];
            saveLinksAll(); currentHubIndex = 1; renderSpiral(); renderTierDots(); showToastNotification(t('toastRestored')); sendResponse({ ok: true });
          } else sendResponse({ ok: false });
        });
        return true;
      } catch (e) { sendResponse({ ok: false }); }
    }
  });

  function mainAIIcon() { return `<svg class="hub-main-icon" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="4" stroke="rgba(156,163,175,0.6)"></rect><text id="ai-hub-text" class="is-default-ai" x="12" y="16.5" font-family="sans-serif" font-size="11" font-weight="800" text-anchor="middle" dominant-baseline="middle" fill="#E5E7EB" stroke="none">AI</text></svg>`; }

  /**
   * Hub center label — must stay legible inside a 28×28 SVG for both fa/en
   * and for short ("AI", "∞2") vs medium ("News", "اخبار", "5★") strings.
   * CSS must NOT force a fixed font-size on hub-infinity (that caused overflow).
   */
  function setHubLabel(text) {
    const el = document.getElementById('ai-hub-text'); if (!el) return;
    const coreWord = t('hubCore');
    const newsWord = t('hubNews');
    const allWord = t('hubAll');
    let displayText = text == null ? '' : String(text);

    if (isNewsHub(currentHubIndex)) {
      if (displayText === 'AI' || displayText === coreWord || displayText === 'Core') {
        displayText = newsWord;
      }
    } else if (currentHubIndex > 1) {
      // Compact galaxy id only — avoid "∞2 Core" / "∞2 هسته" which never fits the disc
      if (displayText === 'AI' || displayText === coreWord || displayText === 'Core') {
        displayText = `∞${currentHubIndex}`;
      }
    }

    el.textContent = displayText;
    el.title = (displayText === '💫') ? t('hubComet') : '';
    el.classList.toggle('is-default-ai', displayText === 'AI' && currentHubIndex === 1);
    // ایموجی 💫 یک واحدِ بصریِ تکی است، اما در جاوااسکریپت طول رشته‌اش ۲ (سوروگیت‌پر) حساب
    // می‌شود — همین باعث می‌شد به‌اشتباه خیلی کوچک محاسبه شود. این‌جا جدا و بزرگ می‌گیریمش،
    // و کلاسی می‌گذاریم تا استروکِ متنیِ SVG (که روی گلیف رنگیِ ایموجی به‌شکل یک کادر
    // ناخواسته در می‌آمد) برایش خاموش شود.
    el.classList.toggle('is-emoji-glyph', displayText === '💫');
    if (displayText === '💫') {
      el.setAttribute('font-size', '17');
      el.setAttribute('font-weight', '400');
      el.setAttribute('y', '17.5');
      return;
    }

    // Visual length: CJK/Arabic glyphs read wider than Latin of the same char count
    const rawLen = displayText.length;
    const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(displayText);
    const hasHeavy = /[★∞]/.test(displayText);
    let units = rawLen + (hasArabic ? rawLen * 0.35 : 0) + (hasHeavy ? 0.4 : 0);

    let size;
    if (units <= 1.2) size = 11;
    else if (units <= 2.2) size = 10;
    else if (units <= 3.2) size = 8.5;
    else if (units <= 4.2) size = 7.5;
    else if (units <= 5.5) size = 6.8;
    else size = 6.2;

    // Persian/Arabic UI: slightly tighter so wider RTL glyphs stay inside the ring
    if (isRTL(currentLang)) size = Math.max(6.2, size - 0.4);

    // Known short tokens — keep a confident size
    if (displayText === 'AI' || /^∞[1-9]$/.test(displayText)) {
      size = isRTL(currentLang) ? 10 : 11;
    } else if (displayText === newsWord || displayText === allWord) {
      size = Math.min(size, isRTL(currentLang) ? 7.2 : 8);
    } else if (/^[1-5]★$/.test(displayText) || displayText === '1-2★') {
      size = 8.5;
    }

    el.setAttribute('font-size', String(size));
    el.setAttribute('font-weight', units > 3.5 ? '700' : '800');
    // Keep baseline optically centered as size changes
    el.setAttribute('y', size >= 10 ? '16.5' : (size >= 8 ? '16.2' : '15.8'));
  }
  let isSeasonDrawerCollapsed = true; // در ابتدا بسته و جمع‌شده باشد

  function updateSeasonalTracker() {
    const tracker = document.getElementById('ai-season-tracker');
    if (!tracker) return;

    const now = new Date();
    const jNow = gregorianToJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const jy = jNow.jy;
    const jm = jNow.jm;
    const jd = jNow.jd;

    let isLeapJalali = false;
    try {
      const gThisYear = jalaaliToGregorian(jy, 1, 1);
      const gNextYear = jalaaliToGregorian(jy + 1, 1, 1);
      const dayDiff = Math.round(
        (new Date(gNextYear.gy, gNextYear.gm - 1, gNextYear.gd) - 
         new Date(gThisYear.gy, gThisYear.gm - 1, gThisYear.gd)) / 86400000
      );
      isLeapJalali = (dayDiff === 366);
    } catch (e) {
      isLeapJalali = false;
    }

    const winterDays = isLeapJalali ? 90 : 89;

    let dayOfYear = 0;
    if (jm <= 6) {
      dayOfYear = (jm - 1) * 31 + jd;
    } else {
      dayOfYear = 6 * 31 + (jm - 7) * 30 + jd;
    }

    const seasonsConfig = [
      {
        key: 'spring',
        start: 1,
        end: 93,
        total: 93,
        name: langPick({
          fa: 'بهار', en: 'Spring', ar: 'الربيع', es: 'Primavera',
          de: 'Frühling', fr: 'Printemps', ja: '春', ru: 'Весна'
        })
      },
      {
        key: 'summer',
        start: 94,
        end: 186,
        total: 93,
        name: langPick({
          fa: 'تابستان', en: 'Summer', ar: 'الصيف', es: 'Verano',
          de: 'Sommer', fr: 'Été', ja: '夏', ru: 'Лето'
        })
      },
      {
        key: 'autumn',
        start: 187,
        end: 276,
        total: 90,
        name: langPick({
          fa: 'پاییز', en: 'Autumn', ar: 'الخريف', es: 'Otoño',
          de: 'Herbst', fr: 'Automne', ja: '秋', ru: 'Осень'
        })
      },
      {
        key: 'winter',
        start: 277,
        end: 276 + winterDays,
        total: winterDays,
        name: langPick({
          fa: 'زمستان', en: 'Winter', ar: 'الشتاء', es: 'Invierno',
          de: 'Winter', fr: 'Hiver', ja: '冬', ru: 'Зима'
        })
      }
    ];

    let currentSeason = seasonsConfig[0];

    seasonsConfig.forEach(season => {
      const card = tracker.querySelector(`.ai-season-card[data-season="${season.key}"]`);
      const fillEl = card ? card.querySelector('.ai-season-fill') : null;
      const daysEl = document.getElementById(`ai-days-${season.key}`);
      const nameEl = card ? card.querySelector('.ai-season-name') : null;

      if (nameEl) nameEl.textContent = season.name;
      if (!card || !fillEl || !daysEl) return;

      card.classList.remove('status-past', 'status-current', 'status-future');

      if (dayOfYear > season.end) {
        card.classList.add('status-past');
        fillEl.style.width = '100%';
        daysEl.textContent = '✓';
} else if (dayOfYear >= season.start && dayOfYear <= season.end) {
        currentSeason = season;
        card.classList.add('status-current');

        const passed = dayOfYear - season.start + 1;
        const percent = Math.min(100, Math.max(0, (passed / season.total) * 100));
        fillEl.style.width = `${percent}%`;

        // نمایش روزهای سپری‌شده از آغاز فصل
        daysEl.textContent = langPick({
          fa: `${localizeDigits(passed)} روز`,
          en: `${passed}d`,
          ar: `${localizeDigits(passed)} يوم`,
          es: `${passed}d`,
          de: `${passed}T`,
          fr: `${passed}j`,
          ja: `${passed}日`,
          ru: `${passed}д`
        });
      } else {
        card.classList.add('status-future');
        fillEl.style.width = '0%';
        daysEl.textContent = '-';
      }
    });

    const currentTitleEl = document.getElementById('ai-season-current-title');
    if (currentTitleEl && currentSeason) {
      currentTitleEl.textContent = currentSeason.name;
    }

    const hemisphereEl = document.getElementById('ai-season-hemisphere');
    if (hemisphereEl) {
      hemisphereEl.textContent = langPick({
        fa: 'نیم‌کرهٔ شمالی',
        en: 'Northern Hemisphere',
        ar: 'نصف الكرة الشمالي',
        es: 'Hemisferio norte',
        de: 'Nordhalbkugel',
        fr: 'Hémisphère nord',
        ja: '北半球',
        ru: 'Северное полушарие'
      });
    }
  }
})();
