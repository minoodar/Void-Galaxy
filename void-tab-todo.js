// ============================================================================
// AI Tree Launcher — Void Tab "Today" panel
// ----------------------------------------------------------------------------
// قبلاً این داک فقط کارهای روزانه (TODO) را نشان می‌داد. حالا یک پنلِ کاملِ
// «امروز»ه، بخش‌بندی‌شده:
//   ۱) سرِ تاریخ/سن — همان منطقِ تاریخ/سنِ ویجتِ اصلی (updateClockAge در
//      content.js)، اما مستقل محاسبه می‌شود؛ چون آن تابع فقط وقتی پنلِ ساعتِ
//      اصلی باز است اجرا می‌شود و برای این داک که همیشه باید درست باشد کافی
//      نیست. فرمول و منابعِ داده (userBirthYear در storage.sync) دقیقاً همان‌هایی
//      است که content.js استفاده می‌کند — نه حدسی، مستقیماً از رویِ همان کد.
//   ۲) رویدادهای ساعتیِ امروز (از aiTreeTimeEvents در storage.local) + یک
//      کادرِ فشردهٔ پیش‌نمایشِ «فردا» — همان دادهٔ داشبوردِ زمانِ ویجتِ اصلی،
//      چون رندرِ زندهٔ #ai-timeline-content به رویدادن/بازشدنِ پنلِ اصلی وابسته
//      است و روی این صفحه همیشه در دسترس نیست، این بخش مستقیماً از storage
//      می‌خواند و evaluateEventStatus را (با همان قوانین) دوباره پیاده می‌کند.
//   ۳) کارهای روزانه (TODO) — همان منطقِ قبلی، بدون تغییر.
// ============================================================================
(() => {
  'use strict';

  const dock = document.getElementById('ai-void-todo-dock');
  const handle = document.getElementById('ai-void-todo-handle');
  const panelTitleEl = document.getElementById('ai-void-todo-title');
  const list = document.getElementById('ai-void-todo-list');
  const count = document.getElementById('ai-void-todo-count');
  const sideButton = document.getElementById('ai-void-todo-side');
  const dateHead = document.getElementById('ai-void-agenda-datehead');
  const eventsTitleEl = document.getElementById('ai-void-agenda-events-title');
  const eventsList = document.getElementById('ai-void-agenda-events');
  const tasksTitleEl = document.getElementById('ai-void-agenda-tasks-title');
  let goalsSection = document.getElementById('ai-void-agenda-goals-section');
  let goalsTitleEl = document.getElementById('ai-void-agenda-goals-title');
  let goalsList = document.getElementById('ai-void-goals-list');
  if (!dock || !handle || !list || !count || !sideButton || !dateHead || !eventsList) return;

  document.body.appendChild(dock);

  // اگر HTML قدیمی بدون بخش Goals باشد، همین‌جا می‌سازیم تا نمایش اهداف از کار نیفتد.
  // محلِ پیش‌فرضِ ساخت: کنارِ Today's Echo (نه داخلِ داکِ Today) — چون این
  // بخش دیگه به‌جای داک، زیرِ Echo زندگی می‌کنه.
  if (!goalsSection || !goalsList) {
    const echoEl = document.getElementById('ai-void-echo');
    const fallbackParent = (echoEl && echoEl.parentNode) || document.getElementById('ai-void-agenda-body') || dock;
    goalsSection = document.createElement('div');
    goalsSection.className = 'ai-void-agenda-section is-goals';
    goalsSection.id = 'ai-void-agenda-goals-section';
    goalsSection.hidden = true;
    goalsTitleEl = document.createElement('div');
    goalsTitleEl.className = 'ai-void-agenda-section-title';
    goalsTitleEl.id = 'ai-void-agenda-goals-title';
    goalsList = document.createElement('div');
    goalsList.className = 'ai-void-todo-list ai-void-goals-list';
    goalsList.id = 'ai-void-goals-list';
    goalsSection.append(goalsTitleEl, goalsList);
    if (echoEl && echoEl.nextSibling) fallbackParent.insertBefore(goalsSection, echoEl.nextSibling);
    else fallbackParent.appendChild(goalsSection);
  }

  function label(key, fallback) {
    try { if (typeof t === 'function') { const v = t(key); if (v) return v; } } catch (e) {}
    return fallback;
  }

  let todos = [];
  let timeEvents = [];
  let userBirthYear = null;
  let userBirthMonth = null;
  let userBirthDay = null;
  let familyAges = [];
  let voidAgeExpanded = false;

  let markedDays = [];
  const VISIBLE_KEY = 'voidTodoDockVisible';
  let position = { side: 'left', top: 0.22 };
  let collapsed = true;
  let dockVisible = true;
  let hasGoals = false;
  // applyDockVisibility() تا وقتی این true نشده هیچ کاری نمی‌کند. چرا لازم
  // است: قبل از این‌که void-tab-router.js صفحه رو reveal کنه، دقیقاً همین
  // وضعیتِ نهایی (dock.hidden/goalsSection.hidden) رو از روی storage از قبل
  // درست تنظیم کرده. اگه این فایل، قبل از خوندنِ storageِ خودش (که async
  // است)، با مقادیرِ پیش‌فرضِ بالا (dockVisible=true, hasGoals=false)
  // زودهنگام applyDockVisibility رو صدا بزنه — که ممکنه اتفاق بیفته، چون
  // رویدادِ ai-tree-todos-updated می‌تونه قبل از resolve شدنِ
  // chrome.storage.local.get فایر بشه — همون وضعیتِ درستِ router رو خراب
  // می‌کنه و بعد، وقتی مقدارِ واقعی از storage می‌رسه، دوباره تصحیحش می‌کنه.
  // حالا که Today/Echo/Goals رویِ موبایل داخلِ جریانِ فلکسِ Stage هستن (نه
  // یه overlayِ position:fixed جدا)، همین «نمایش-سپس-تصحیح» باعثِ یک
  // جابه‌جاییِ دیداریِ (پرش) واقعی توی چیدمان می‌شه، نه فقط یه فلشِ نامحسوس.
  let storageReady = false;

  // ---------------------------------------------------------------- عمومی —
  function pad2(n) { return String(n).padStart(2, '0'); }
  function isoFromDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
  function todayIso() { return isoFromDate(new Date()); }
  function tomorrowIso() { const d = new Date(); d.setDate(d.getDate() + 1); return isoFromDate(d); }

  // Match content.js daily list:
  // - type daily (not goals)
  // - createdAt before the next local midnight → today (tomorrow is stored
  //   as createdAt >= that midnight). Comparing against midnight (not
  //   against "now") matters because an hourly-dashboard task scheduled for
  //   later today also has a createdAt in the future — it must still count
  //   as today, not tomorrow.
  const TODO_DAILY_TTL_MS = 24 * 60 * 60 * 1000;
  function todoCreatedAt(todo, now) {
    const raw = todo && todo.createdAt;
    const parsed = typeof raw === 'number' ? raw : Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : (now || Date.now());
  }
  function startOfTomorrowMs(now) {
    const d = new Date(now || Date.now());
    d.setHours(24, 0, 0, 0);
    return d.getTime();
  }
  function isToday(todo, now) {
    now = now || Date.now();
    if (!todo) return false;
    if ((todo.type || 'daily') !== 'daily') return false;
    const created = todoCreatedAt(todo, now);
    if (created >= startOfTomorrowMs(now)) return false; // scheduled for tomorrow
    if (now - created >= TODO_DAILY_TTL_MS) return false; // expired daily
    return true;
  }
  function isTomorrowTodo(todo, now) {
    now = now || Date.now();
    if (!todo) return false;
    if ((todo.type || 'daily') !== 'daily') return false;
    return todoCreatedAt(todo, now) >= startOfTomorrowMs(now);
  }

  function applyCollapsed() {
    dock.classList.toggle('is-collapsed', collapsed);
    handle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  }
  function setCollapsed(next) {
    // اگه الان محوشونده (سیاه‌چاله)، دستِ کلاپسِ ساده بهش نرسه — این دو
    // سیستمِ toggle باید کاملاً مستقل بمونن، نه هم‌زمان روی یه چیز اثر بذارن.
    if (dock.classList.contains('ai-void-is-dissolved')) return;
    collapsed = !!next;
    applyCollapsed();
    try { chrome.storage.local.set({ voidTodoCollapsed: collapsed }); } catch (e) {}
  }

  // نمایش/پنهان‌کردنِ کاملِ داک (نه فقط جمع‌شدن) — از منوی سه‌تایی کنترل
  // می‌شه. Goals دیگه داخلِ داک نیست (کنارِ Today's Echo‌ست)، ولی هم‌زمان
  // با Today پنهان/آشکار می‌شه — عمداً یه آیتمِ جدا براش توی منو نذاشتم تا
  // منو شلوغ نشه؛ یه دکمهٔ «Today» هم داک و هم Goals رو با هم کنترل می‌کنه.
  // Goals remains available as an empty shell so its dissolve/restore control
  // can participate in constellation formation even before the first goal.
  // Goals visibility is independent of Today dock (separate dissolve + own flag).
  // Menu "Today" still toggles both for convenience; dissolve buttons act separately.
  let goalsVisible = true;

  function applyDockVisibility() {
    // ببین کامنتِ بالای اعلانِ storageReady — قبل از خوندنِ storageِ واقعی،
    // دست به dock/goalsSection نمی‌زنیم تا وضعیتِ درستی که router از قبل
    // چیده، به‌اشتباه خراب و بعد تصحیح نشه (= پرش).
    if (!storageReady) return;
    // یک منبعِ دومِ همون مشکل: VoidDissolve هم خودش یک chrome.storage.local
    // مجزا می‌خونه (async) و تا وقتی برنگشته، isDissolved('todo') به‌اشتباه
    // false برمی‌گردونه (نه چون واقعاً dissolved نیست، بلکه چون هنوز چیزی
    // نخونده). اگه همین‌جا به آن false اعتماد کنیم، یک Todayِ جمع‌شدهٔ عادی
    // (نه‌ ستاره‌شده) لحظه‌ای نمایش داده می‌شه و به‌محضِ این‌که VoidDissolve
    // جواب واقعی رو بده، دوباره پنهان می‌شه — دقیقاً همون پرش. پس تا
    // VoidDissolve آماده نشده، صبر می‌کنیم؛ روشن‌شدنِ آمادگی‌اش با
    // 'void-dissolve-ready' یک بارِ دیگه همین تابع رو صدا می‌زنه (پایینِ
    // همین فایل).
    if (window.VoidDissolve && typeof VoidDissolve.isReady === 'function' && !VoidDissolve.isReady()) return;
    // Only trust live dissolve state. Boot flag is a one-shot hint for first paint;
    // once VoidDissolve reports "not dissolved", clear the flag so restore can show panels.
    let todoDissolved = !!(window.VoidDissolve && VoidDissolve.isDissolved('todo'));
    if (!todoDissolved && dock.dataset && dock.dataset.voidBootDissolved === '1') {
      try { delete dock.dataset.voidBootDissolved; } catch (e) {}
    } else if (!window.VoidDissolve && dock.dataset && dock.dataset.voidBootDissolved === '1') {
      todoDissolved = true;
    }
    let goalsDissolved = !!(window.VoidDissolve && VoidDissolve.isDissolved('goals'));
    if (!goalsDissolved && goalsSection && goalsSection.dataset && goalsSection.dataset.voidBootDissolved === '1') {
      try { delete goalsSection.dataset.voidBootDissolved; } catch (e) {}
    } else if (!window.VoidDissolve && goalsSection && goalsSection.dataset && goalsSection.dataset.voidBootDissolved === '1') {
      goalsDissolved = true;
    }
    if (todoDissolved) {
      // Today dock is side panel — full hide is fine (nothing stacked under it in flow)
      dock.hidden = true;
      dock.classList.add('ai-void-is-dissolved');
    } else {
      dock.hidden = !dockVisible;
      if (dockVisible) {
        dock.classList.remove('ai-void-is-dissolved');
        dock.removeAttribute('hidden');
      }
    }
    dock.setAttribute('aria-hidden', (dock.hidden || dock.classList.contains('ai-void-is-dissolved')) ? 'true' : 'false');
    if (goalsSection) {
      if (goalsDissolved) {
        // Keep layout slot so position stays under Echo
        goalsSection.hidden = false;
        goalsSection.classList.add('ai-void-is-dissolved');
      } else if (!goalsVisible) {
        goalsSection.classList.remove('ai-void-is-dissolved');
        goalsSection.hidden = true;
      } else {
        goalsSection.classList.remove('ai-void-is-dissolved');
        goalsSection.hidden = false;
        goalsSection.removeAttribute('hidden');
      }
    }
    try {
      if (!isGoalsSliderOpen()) stopGoalFireworks();
    } catch (e) {}
  }
  function wireMenu() {
    const btn = document.getElementById('ai-ntp-menu-todo');
    if (!btn) return;
    const sync = () => {
      const on = window.VoidDissolve
        ? !VoidDissolve.isDissolved('todo') && dockVisible
        : dockVisible;
      btn.setAttribute('data-on', on ? '1' : '0');
      const labelEl = document.getElementById('ai-ntp-menu-todo-label');
      if (labelEl && !labelEl.textContent) labelEl.textContent = label('ntpMenuTodo', 'Today Task');
    };
    sync();
    if (btn.dataset.wired === '1') return;
    btn.dataset.wired = '1';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Unified with ◎ dissolve: hide → stars / constellation; show → restore
      if (window.VoidDissolve) {
        const todoGone = VoidDissolve.isDissolved('todo') || !dockVisible;
        if (todoGone) {
          if (VoidDissolve.isDissolved('todo')) {
            try { VoidDissolve.restore('todo'); } catch (err) {}
          } else {
            dockVisible = true;
           applyDockVisibility();

// **وقتی کلاپس می‌شود و اهداف محو می‌شوند، صور فلکی را دوباره تنظیم کن**
if (typeof repositionForLayoutChange === 'function') {
  requestAnimationFrame(() => {
    repositionForLayoutChange();
  });
}
          }
          if (VoidDissolve.isDissolved('goals')) {
            try { VoidDissolve.restore('goals'); } catch (err) {}
          } else {
            goalsVisible = true;
            applyDockVisibility();
          }
        } else {
          try { VoidDissolve.dissolve('todo'); } catch (err) {}
          // Goals travels with Today from the menu so the triad can form
          if (goalsSection && !VoidDissolve.isDissolved('goals')) {
            const goalsHiddenHard = goalsSection.hidden && !goalsSection.classList.contains('ai-void-is-dissolved');
            if (!goalsHiddenHard) {
              try { VoidDissolve.dissolve('goals'); } catch (err) {}
            }
          }
        }
        try {
          chrome.storage.local.set({
            [VISIBLE_KEY]: !VoidDissolve.isDissolved('todo'),
            voidGoalsVisible: !VoidDissolve.isDissolved('goals')
          });
        } catch (err) {}
        setTimeout(sync, 50);
        setTimeout(sync, 800);
        return;
      }
      dockVisible = !dockVisible;
      goalsVisible = dockVisible;
      applyDockVisibility();
      try {
        chrome.storage.local.set({
          [VISIBLE_KEY]: dockVisible,
          voidGoalsVisible: goalsVisible
        });
      } catch (err) {}
      sync();
    });
  }

  // Dissolve into stars — Today and Goals each have their own singularity
  function wireDissolve() {
    if (!window.VoidDissolve) return;

    const todoTrigger = document.getElementById('ai-void-todo-dissolve');
    if (dock) {
      if (todoTrigger) {
        todoTrigger.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
      }
      VoidDissolve.register('todo', {
        el: dock,
        label: (typeof label === 'function' ? label('ntpMenuTodo', 'Today') : 'Today'),
        trigger: todoTrigger || null,
        onHide: function () {
          dockVisible = false;
          try { chrome.storage.local.set({ [VISIBLE_KEY]: false }); } catch (e) {}
          const btn = document.getElementById('ai-ntp-menu-todo');
          if (btn) btn.setAttribute('data-on', '0');
        },
        onShow: function () {
          dockVisible = true;
          try { delete dock.dataset.voidBootDissolved; } catch (e) {}
          dock.classList.remove('ai-void-is-dissolved');
          dock.hidden = false;
          try { chrome.storage.local.set({ [VISIBLE_KEY]: true }); } catch (e) {}
          applyDockVisibility();
          const btn = document.getElementById('ai-ntp-menu-todo');
          if (btn) btn.setAttribute('data-on', '1');
        }
      });
    }

    const goalsTrigger = document.getElementById('ai-void-goals-dissolve');
    if (goalsSection) {
      if (goalsTrigger) {
        goalsTrigger.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
      }
      VoidDissolve.register('goals', {
        el: goalsSection,
        label: (typeof label === 'function' ? label('todoTabGoals', 'Goals') : 'Goals'),
        trigger: goalsTrigger || null,
        onHide: function () {
          goalsVisible = false;
          try { chrome.storage.local.set({ voidGoalsVisible: false }); } catch (e) {}
          try { stopGoalFireworks(); } catch (e) {}
        },
        onShow: function () {
          goalsVisible = true;
          if (goalsSection) {
            try { delete goalsSection.dataset.voidBootDissolved; } catch (e) {}
            goalsSection.classList.remove('ai-void-is-dissolved');
            // Keep the Goals shell available even when it has no cards.
          }
          try { chrome.storage.local.set({ voidGoalsVisible: true }); } catch (e) {}
          applyDockVisibility();
        }
      });
    }
  }
  try { wireDissolve(); } catch (e) {}


  // -------------------------------------------------------- سرِ تاریخ/سن —

  function computeVoidAge(year, month, day) {
    const y = parseInt(year, 10);
    if (!y || isNaN(y)) return 0;
    const isJalali = y < 1500;
    let m = parseInt(month, 10);
    let d = parseInt(day, 10);
    const hasFull = !!(month && day && m >= 1 && m <= 12 && d >= 1 && d <= 31);
    if (!m || m < 1 || m > 12) m = 1;
    if (!d || d < 1 || d > 31) d = 1;
    let gY, gM, gD;
    try {
      if (isJalali && typeof jalaaliToGregorian === 'function') {
        const g = jalaaliToGregorian(y, m, d); gY = g.gy; gM = g.gm; gD = g.gd;
      } else { gY = y; gM = m; gD = d; }
    } catch (e) { gY = isJalali ? y + 621 : y; gM = m; gD = d; }
    const now = new Date();
    let age;
    if (hasFull) {
      age = now.getFullYear() - gY;
      const had = (now.getMonth() + 1 > gM) || (now.getMonth() + 1 === gM && now.getDate() >= gD);
      if (!had) age -= 1;
    } else if (isJalali) {
      try {
        const jYearStr = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric' }).format(now);
        age = parseInt(jYearStr.replace(/\D/g, ''), 10) - y;
      } catch (e) { age = now.getFullYear() - gY; }
    } else { age = now.getFullYear() - gY; }
    return Math.max(0, age);
  }
  const VOID_JALALI_MONTHS_FA = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];

  function formatVoidBirthLines(year, month, day) {
    const y = parseInt(year, 10);
    if (!y || isNaN(y)) return { jalali: '', gregorian: '', plain: '' };
    const isJalali = y < 1500;
    let m = parseInt(month, 10);
    let d = parseInt(day, 10);
    const hasFull = !!(month && day && m >= 1 && m <= 12 && d >= 1 && d <= 31);
    if (!m || m < 1 || m > 12) m = 1;
    if (!d || d < 1 || d > 31) d = 1;
    try {
      let gY, gM, gD;
      if (isJalali && typeof jalaaliToGregorian === 'function') {
        const g = jalaaliToGregorian(y, m, d); gY = g.gy; gM = g.gm; gD = g.gd;
      } else { gY = y; gM = m; gD = d; }
      if (hasFull) {
        const gregorianLabels = { fa: 'میلادی', ar: 'ميلادي', es: 'Greg.', de: 'Greg.', fr: 'Grég.', ja: '西暦', ru: 'григ.', tr: 'Miladi', 'zh-Hans': '公历', 'zh-Hant': '公曆', 'pt-BR': 'Greg.' };
        const gregorianLabel = gregorianLabels[currentLang] || 'Gregorian';
        const gStr = `${gregorianLabel} · ${gY}-${String(gM).padStart(2, '0')}-${String(gD).padStart(2, '0')}`;
        let jStr = '';
        if (typeof gregorianToJalaali === 'function') {
          const j = gregorianToJalaali(gY, gM, gD);
          jStr = j.jd + ' ' + VOID_JALALI_MONTHS_FA[Math.max(0, j.jm - 1)] + ' ' + j.jy;
        } else if (isJalali) {
          jStr = d + ' ' + VOID_JALALI_MONTHS_FA[Math.max(0, m - 1)] + ' ' + y;
        }
        return { jalali: jStr, gregorian: gStr, plain: (jStr ? jStr + ' · ' : '') + gStr };
      }
      if (isJalali) {
        let s = y + ' شمسی';
        try { const g = jalaaliToGregorian(y, 1, 1); if (g) s += ' · ≈' + g.gy + ' CE'; } catch (e) {}
        return { jalali: s, gregorian: '', plain: s };
      }
      let s = y + ' CE';
      try { const j = gregorianToJalaali(y, 1, 1); if (j) s += ' · ≈' + j.jy + ' شمسی'; } catch (e) {}
      return { jalali: '', gregorian: s, plain: s };
    } catch (e) { return { jalali: '', gregorian: '', plain: '' }; }
  }

  function formatVoidBirthLabel(year, month, day) {
    return formatVoidBirthLines(year, month, day).plain;
  }
  function getVoidPrimary() {
    if (Array.isArray(familyAges) && familyAges.length) {
      const p = familyAges.find(m => m.primary) || familyAges[0];
      if (p && p.year) return p;
    }
    if (userBirthYear) return { name: '', year: userBirthYear, month: userBirthMonth, day: userBirthDay, primary: true };
    return null;
  }

  function renderDateHead() {
    const now = new Date();
    dateHead.innerHTML = '';
    // خطِ اصلیِ میلادی: روزِ هفته (برچسبِ کوچک) + تاریخِ کامل با سال. ترتیبِ
    // روز/ماه/سال را خودِ Intl بر اساسِ زبانِ مرورگر تعیین می‌کند (formatToParts)،
    // و سال یک span جدا می‌گیرد تا با وزنِ ملایم‌تر کنارِ روز و ماه بنشیند.
    const primary = document.createElement('div'); primary.className = 'ai-void-agenda-date-primary';
    const wd = document.createElement('span'); wd.className = 'ai-void-agenda-date-weekday';
    wd.textContent = now.toLocaleDateString(undefined, { weekday: 'long' });
    primary.appendChild(wd);
    const full = document.createElement('span'); full.className = 'ai-void-agenda-date-full';
    try {
      new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
        .formatToParts(now).forEach(p => {
          if (p.type === 'year') {
            const y = document.createElement('span'); y.className = 'ai-void-agenda-date-year';
            y.textContent = p.value; full.appendChild(y);
          } else { full.appendChild(document.createTextNode(p.value)); }
        });
    } catch (e) {
      full.textContent = now.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    }
    primary.appendChild(full);
    dateHead.appendChild(primary);
    try {
      const secondary = document.createElement('div'); secondary.className = 'ai-void-agenda-date-secondary';
      secondary.textContent = now.toLocaleDateString('fa-IR-u-ca-persian', { year: 'numeric', month: 'long', day: 'numeric' });
      secondary.dir = 'rtl';
      dateHead.appendChild(secondary);
    } catch (e) {}
    try {
      const tertiary = document.createElement('div'); tertiary.className = 'ai-void-agenda-date-tertiary';
      tertiary.textContent = now.toLocaleDateString('ar-SA-u-ca-islamic-umalqura', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
      tertiary.dir = 'rtl';
      dateHead.appendChild(tertiary);
    } catch (e) {
      try {
        const tertiary = document.createElement('div'); tertiary.className = 'ai-void-agenda-date-tertiary';
        tertiary.textContent = now.toLocaleDateString('en-US-u-ca-islamic-umalqura', {
          year: 'numeric', month: 'long', day: 'numeric'
        });
        dateHead.appendChild(tertiary);
      } catch (e2) {}
    }
    const primaryBirth = getVoidPrimary();
    if (primaryBirth && primaryBirth.year) {
      const age = computeVoidAge(primaryBirth.year, primaryBirth.month, primaryBirth.day);

      // ------------------------------------------------------------------
      // یک ردیفِ فشرده به‌جای ۴ خطِ همیشه‌بازِ قبلی (Origin/Now + نوار +
      // کپشنِ سن + تاریخ‌های تولد + دکمهٔ خانواده). حالا همهٔ این جزئیات زیرِ
      // یک تاگلِ واحد جمع می‌شوند و پیش‌فرض بسته‌اند؛ فقط این یک خط همیشه
      // دیده می‌شود. خودِ نوارِ سن («خط عمر») دیگر بخشی از این تاگل نیست —
      // پایین‌تر، بیرون از این بلوک، به‌عنوان یک جداکنندهٔ همیشه‌‌دیدنی بینِ
      // این هد و رویدادها/کارها رندر می‌شود.
      // ------------------------------------------------------------------
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'ai-void-agenda-age-toggle' + (voidAgeExpanded ? ' is-open' : '');
      toggle.setAttribute('aria-expanded', voidAgeExpanded ? 'true' : 'false');
      const nameBit = primaryBirth.name ? (primaryBirth.name + ' · ') : '';
      const summary = document.createElement('span');
      summary.className = 'ai-void-agenda-age-summary';
      summary.textContent = '\u{1F382} ' + nameBit + label('journeyCaption', '{age} years on the path').replace('{age}', String(age));
      const caret = document.createElement('span');
      caret.className = 'ai-void-agenda-age-caret';
      caret.textContent = '\u25BE';
      toggle.append(summary, caret);
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        voidAgeExpanded = !voidAgeExpanded;
        renderDateHead();
      });
      dateHead.appendChild(toggle);

      if (voidAgeExpanded) {
        const detail = document.createElement('div');
        detail.className = 'ai-void-agenda-age-detail';

        const birthLines = formatVoidBirthLines(primaryBirth.year, primaryBirth.month, primaryBirth.day);
        if (birthLines.jalali || birthLines.gregorian || birthLines.plain) {
          const birthWrap = document.createElement('div');
          birthWrap.className = 'ai-void-agenda-birth';
          if (birthLines.jalali) {
            const jLine = document.createElement('div');
            jLine.className = 'ai-void-agenda-birth-j';
            jLine.textContent = '🌱 ' + birthLines.jalali;
            birthWrap.appendChild(jLine);
          }
          if (birthLines.gregorian) {
            const gLine = document.createElement('div');
            gLine.className = 'ai-void-agenda-birth-g';
            gLine.textContent = '✦ ' + birthLines.gregorian;
            birthWrap.appendChild(gLine);
          }
          if (!birthLines.jalali && !birthLines.gregorian && birthLines.plain) {
            birthWrap.textContent = birthLines.plain;
          }
          detail.appendChild(birthWrap);
        }

        // اعضای خانواده دیگر دکمهٔ تاگلِ جدا ندارند — همان یک تاگلِ بیرونی
        // کافی است؛ وقتی باز است، کل فهرست همین‌جا دیده می‌شود.
        const others = (familyAges || []).filter(m => m && m.year && !m.primary);
        if (others.length) {
          const fam = document.createElement('div');
          fam.className = 'ai-void-agenda-family is-open';
          const ordered = (familyAges || []).filter(m => m && m.year).slice()
            .sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0));
          ordered.forEach((m) => {
            const a = computeVoidAge(m.year, m.month, m.day);
            const row = document.createElement('div');
            row.className = 'ai-void-agenda-family-row' + (m.primary ? ' is-primary' : '');
            const bl = formatVoidBirthLabel(m.year, m.month, m.day);
            const summary = document.createElement('span');
            summary.textContent = (m.name || (m.primary ? 'Me' : '—')) + ' · ' + a + ' yrs';
            row.appendChild(summary);
            if (bl) {
              const birth = document.createElement('span');
              birth.className = 'ai-void-agenda-family-birth';
              birth.textContent = bl;
              row.appendChild(birth);
            }
            fam.appendChild(row);
          });
          detail.appendChild(fam);
        }

        dateHead.appendChild(detail);
      }

      // «خط عمر» — نوارِ پیشرفتِ سن، حالا یک جداکنندهٔ همیشه‌‌دیدنی و مستقل
      // از تاگلِ بالا، دقیقاً روی مرزِ بینِ این هد (تقویم+سن) و رویدادها/
      // کارهای پایینِ داک. border-bottom قبلیِ خودِ .ai-void-agenda-datehead
      // (در CSS) عمداً برداشته شده تا این نوار جایگزینِ همان مرز بشود، نه
      // یک خط اضافه‌تر.
      const lifeline = document.createElement('div');
      lifeline.className = 'ai-void-agenda-lifeline';
      const track = document.createElement('div');
      track.className = 'ai-void-agenda-lifeline-track';
      const fill = document.createElement('div');
      fill.className = 'ai-void-agenda-lifeline-fill';
      const pct = Math.max(4, Math.min(96, (age / 90) * 100));
      fill.style.width = pct + '%';
      track.appendChild(fill);
      lifeline.appendChild(track);
      dateHead.appendChild(lifeline);
    } else {
      // بدون سالِ تولد: همان مرزِ سادهٔ قبلی، تا لایوت با/بدون این داده نپرد.
      const divider = document.createElement('div');
      divider.className = 'ai-void-agenda-divider';
      dateHead.appendChild(divider);
    }
    renderMarkedDayLine();
  }

  // ------------------------------------------------ خطِ عمرِ تقویم (مناسبت‌ها) —
  // «مناسبت‌های علامت‌گذاری‌شده» (تولد، سالگرد، یادآوری‌های سالانه) دقیقاً با
  // همان منطقِ خودِ افزونه (calendar-engine.js: daysUntilNext/isMarkedDayPast،
  // که همین‌جا به‌صورتِ سراسری در دسترسند چون این فایل بعد از آن لود می‌شود) —
  // نه یک فرمولِ حدسی. یک آیتمِ «امروز» با 🎉 برجسته می‌شود؛ در غیرِ این صورت
  // نزدیک‌ترین موردِ پیشِ‌رو (در بازهٔ ۴۵ روزِ آینده، تا شلوغ/بی‌ربط نشود).
  function renderMarkedDayLine() {
    if (typeof daysUntilNext !== 'function' || typeof isMarkedDayPast !== 'function') return;
    const kept = (markedDays || []).filter((m) => m && m.golden || !isMarkedDayPast(m.day, m.month, m.cal));
    if (!kept.length) return;

    const withDays = kept.map((m) => ({ m, days: daysUntilNext(m.day, m.month, m.cal) }));
    const todays = withDays.filter((x) => x.days === 0);
    const upcoming = withDays.filter((x) => x.days > 0).sort((a, b) => a.days - b.days);

    function formatDate(m) {
      const dd = String(m.day).padStart(2, '0');
      const mm = String(m.month).padStart(2, '0');
      const isJ = m.cal === 'j' || m.cal === 'jalali';
      let currentLangSafe = 'en';
      try { if (typeof currentLang !== 'undefined') currentLangSafe = currentLang; } catch (e) {}
      if (isJ && currentLangSafe === 'fa' && typeof toPersianDigits === 'function') return toPersianDigits(`${dd}/${mm}`);
      if (currentLangSafe === 'ar' && typeof toArabicDigits === 'function') return toArabicDigits(`${dd}/${mm}`);
      return `${dd}/${mm}`;
    }

    const line = document.createElement('div');
    line.className = 'ai-void-agenda-mark-line';

    if (todays.length) {
      line.classList.add('is-today');
      line.textContent = '\u{1F389} ' + todays.map((x) => (x.m.golden ? '\u2605 ' : '') + x.m.label).join(', ');
    } else if (upcoming.length && upcoming[0].days <= 45) {
      const { m, days } = upcoming[0];
      line.textContent = '\u{1F4CC} ' + (m.golden ? '\u2605 ' : '') + m.label + '  \u00b7  ' + formatDate(m);
    } else {
      return;
    }
    dateHead.appendChild(line);
  }

  function loadMarkedDays() {
    try {
      chrome.storage.sync.get(['aiTreeMarkedDays'], (res) => {
        markedDays = Array.isArray(res.aiTreeMarkedDays) ? res.aiTreeMarkedDays : [];
        renderDateHead();
      });
    } catch (e) {}
  }

  // ------------------------------------------------- رویدادهای ساعتی —
  // دقیقاً همان قوانینِ evaluateEventStatus در content.js (از جمله وضعیتِ
  // «recurring-elapsed» برای رویدادهای ستاره‌دارِ گذشته که دیگر «missed»
  // قرمز/خط‌خورده نشان داده نمی‌شوند، چون فردا خودشان تازه می‌شوند).
  function evaluateStatus(evt) {
    if (evt.status === 'done') return 'done';
    const eventTime = new Date(`${evt.date}T${evt.startTime}:00`);
    if (isNaN(eventTime.getTime())) return 'future';
    const diffMinutes = (eventTime - new Date()) / 60000;
    if (diffMinutes < 0) return evt.recurring ? 'recurring-elapsed' : 'missed';
    if (diffMinutes <= 30) return 'near';
    return 'future';
  }

  function saveTimeEventsToStorage() {
    try { chrome.storage.local.set({ aiTreeTimeEvents: timeEvents }); } catch (e) {}
  }

  // حذفِ یک رویداد: دقیقاً هم‌رفتار با deleteDashEvent در content.js — اگر
  // رویداد یک TODوی روزانهٔ لینک‌شده دارد (linkedTodoId)، آن هم حذف می‌شود تا
  // یک TODوی یتیم و بی‌معنی در پنلِ اصلی باقی نماند.
  function deleteEvent(id) {
    const evt = timeEvents.find(e => e.id === id);
    if (evt && evt.linkedTodoId) {
      const idx = todos.findIndex(td => td.id === evt.linkedTodoId);
      if (idx !== -1) {
        todos.splice(idx, 1);
        try { chrome.storage.sync.set({ aiTreeTodos: todos }); chrome.storage.local.set({ aiTreeTodos: todos }); } catch (e) {}
        renderTodos();
      }
    }
    timeEvents = timeEvents.filter(e => e.id !== id);
    saveTimeEventsToStorage();
    renderEvents();
  }

  function updateEventTime(id, newTime) {
    const evt = timeEvents.find(e => e.id === id);
    if (!evt || !/^\d{2}:\d{2}$/.test(newTime) || evt.startTime === newTime) return;
    evt.startTime = newTime;
    // TODوی لینک‌شده هم متنش با ساعتِ جدید هماهنگ شود (همان قالبِ content.js: "HH:mm — عنوان")
    if (evt.linkedTodoId) {
      const linked = todos.find(td => td.id === evt.linkedTodoId);
      if (linked) {
        linked.text = `${newTime} — ${evt.title}`;
        try { chrome.storage.sync.set({ aiTreeTodos: todos }); chrome.storage.local.set({ aiTreeTodos: todos }); } catch (e) {}
        renderTodos();
      }
    }
    saveTimeEventsToStorage();
    renderEvents();
  }

  function beginTimeEdit(row, timeEl, evt) {
    if (row.classList.contains('is-editing-time')) return;
    row.classList.add('is-editing-time');
    const input = document.createElement('input');
    input.type = 'time';
    input.className = 'ai-void-event-time-input';
    input.value = evt.startTime;
    timeEl.replaceWith(input);
    input.focus();
    let done = false;
    const commit = () => {
      if (done) return; done = true;
      const val = input.value || evt.startTime;
      input.replaceWith(timeEl);
      row.classList.remove('is-editing-time');
      if (val !== evt.startTime) updateEventTime(evt.id, val); else timeEl.textContent = evt.startTime;
    };
    const cancel = () => {
      if (done) return; done = true;
      input.replaceWith(timeEl);
      row.classList.remove('is-editing-time');
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
  }

  function buildEventRow(evt, status) {
    const row = document.createElement('div');
    row.className = 'ai-void-event-row' + (status === 'near' ? ' is-near' : status === 'missed' ? ' is-missed' : status === 'done' ? ' is-done' : status === 'recurring-elapsed' ? ' is-recurring-elapsed' : '');
    const time = document.createElement('span'); time.className = 'ai-void-event-time'; time.textContent = evt.startTime;
    time.title = label('voidEditShortcut', 'Edit');
    row.addEventListener('click', () => beginTimeEdit(row, time, evt));
    const title = document.createElement('span'); title.className = 'ai-void-event-title'; title.textContent = evt.title; title.title = evt.title;
    row.append(time, title);
    if (status === 'recurring-elapsed') {
      const chip = document.createElement('span'); chip.className = 'ai-void-event-badge';
      chip.textContent = '\u21bb ' + label('scrubberTomorrowBadge', 'Tomorrow');
      row.appendChild(chip);
    } else if (evt.recurring) {
      const star = document.createElement('span'); star.className = 'ai-void-event-badge'; star.textContent = '\u2605';
      row.appendChild(star);
    }
    const delBtn = document.createElement('button');
    delBtn.type = 'button'; delBtn.className = 'ai-void-event-del';
    delBtn.title = label('voidRemove', 'Remove');
    delBtn.setAttribute('aria-label', label('voidRemove', 'Remove') + ': ' + evt.title);
    delBtn.textContent = '\u00D7';
    delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteEvent(evt.id); });
    row.appendChild(delBtn);
    return row;
  }

  function renderEvents() {
    if (eventsTitleEl) eventsTitleEl.textContent = label('voidAgendaEventsLabel', "Today's schedule");
    eventsList.innerHTML = '';
    const iso = todayIso();
    const todays = timeEvents.filter(e => e && e.date === iso).slice().sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (!todays.length) {
      const empty = document.createElement('div'); empty.className = 'ai-void-event-empty';
      empty.textContent = label('dashNoEvents', 'No events');
      eventsList.appendChild(empty);
    } else {
      todays.forEach(evt => eventsList.appendChild(buildEventRow(evt, evaluateStatus(evt))));
    }

    const tIso = tomorrowIso();
    const tomorrows = timeEvents.filter(e => e && e.date === tIso).slice().sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (tomorrows.length) {
      const box = document.createElement('div'); box.className = 'ai-void-tomorrow-box';
      const head = document.createElement('div'); head.className = 'ai-void-tomorrow-head';
      head.textContent = `${label('scrubberTomorrowBadge', 'Tomorrow')} \u00b7 ${tomorrows.length}`;
      box.appendChild(head);
      tomorrows.slice(0, 3).forEach(evt => box.appendChild(buildEventRow(evt, evaluateStatus(evt))));
      eventsList.appendChild(box);
    }
  }

  function loadTimeEvents() {
    try {
      chrome.storage.local.get(['aiTreeTimeEvents'], (res) => {
        timeEvents = Array.isArray(res.aiTreeTimeEvents) ? res.aiTreeTimeEvents : [];
        renderEvents();
      });
    } catch (e) { renderEvents(); }
  }

  function loadBirthYear() {
    try {
      chrome.storage.sync.get(['userBirthYear', 'userBirthMonth', 'userBirthDay', 'aiTreeFamilyAges'], (res) => {
        userBirthYear = res.userBirthYear ? parseInt(res.userBirthYear, 10) : null;
        userBirthMonth = res.userBirthMonth ? parseInt(res.userBirthMonth, 10) : null;
        userBirthDay = res.userBirthDay ? parseInt(res.userBirthDay, 10) : null;
        if (Array.isArray(res.aiTreeFamilyAges) && res.aiTreeFamilyAges.length) {
          familyAges = res.aiTreeFamilyAges.filter(m => m && m.year).map(m => ({
            id: m.id, name: String(m.name || '').slice(0, 24),
            year: parseInt(m.year, 10),
            month: m.month ? parseInt(m.month, 10) : null,
            day: m.day ? parseInt(m.day, 10) : null,
            primary: !!m.primary
          }));
          if (familyAges.length && !familyAges.some(m => m.primary)) familyAges[0].primary = true;
          const prim = familyAges.find(m => m.primary) || familyAges[0];
          if (prim) { userBirthYear = prim.year; userBirthMonth = prim.month; userBirthDay = prim.day; }
        } else if (userBirthYear) {
          familyAges = [{ id: 'legacy', name: '', year: userBirthYear, month: userBirthMonth, day: userBirthDay, primary: true }];
        } else { familyAges = []; }
        renderDateHead();
      });
    } catch (e) { renderDateHead(); }
  }

  // ---------------------------------------------------------------- تودو —
  function acceptTodos(next, allowEmpty) {
    if (!Array.isArray(next)) return;
    if (!allowEmpty && next.length === 0 && todos.length > 0) return;
    const sig = function (arr) {
      return (arr || []).map(function (t) {
        if (!t) return '';
        return [t.id || '', t.text || '', t.done ? '1' : '0', t.type || 'daily', String(t.createdAt || ''), String(typeof t.progress === 'number' ? t.progress : '')].join('\x1f');
      }).join('\x1e');
    };
    if (sig(next) === sig(todos)) return;
    todos = next.slice();
    renderTodos();
  }

  function isGoal(todo) {
    if (!todo) return false;
    const ty = String(todo.type || '').toLowerCase();
    return ty === 'goal' || ty === 'goals';
  }

  // سقفِ نمایشِ هم‌زمانِ هدف‌ها — نگه‌داشتنش کوچک عمدیه: هم گرید بدونِ اسکرول
  // قد می‌کشد، هم بیشتر از این معمولاً یعنی پراکندگی، نه تمرکز.
  const GOALS_MAX_VISIBLE = 6;

  function todoImpactPct(t) {
    if (!t) return 10;
    var n = Number(t.impactPct);
    if (!isNaN(n) && n > 0) return Math.max(1, Math.min(100, Math.round(n)));
    if (typeof t.weight === 'number' && t.weight > 0) return Math.max(1, Math.min(100, Math.round(t.weight * 5)));
    return 10;
  }

  function goalProgress(todo) {
    if (!todo) return 0;
    // override دستی (اسلایدر یا پنل شناور)
    if (todo.manualProgress != null && todo.manualProgress !== '') {
      var m = Number(todo.manualProgress);
      if (!isNaN(m)) return Math.max(0, Math.min(100, Math.round(m)));
    }
    // جمع impactPct کارهای انجام‌شدهٔ پیوندی + آرشیو TTL
    var kids = (todos || []).filter(function (td) {
      return td && (td.type || 'daily') === 'daily' && td.linkedGoalId === todo.id;
    });
    var archived = typeof todo.completedWeight === 'number' ? todo.completedWeight : 0;
    if (kids.length || archived) {
      var doneSum = kids.filter(function (k) { return k.done; })
        .reduce(function (s, k) { return s + todoImpactPct(k); }, 0);
      return Math.max(0, Math.min(100, Math.round(doneSum + archived)));
    }
    if (typeof todo.progress === 'number' && isFinite(todo.progress)) {
      return Math.max(0, Math.min(100, Math.round(todo.progress)));
    }
    return todo.done ? 100 : 0;
  }


  // ---- Goal fireworks (FireworkSky) ----
  const GOAL_FW_MARKS = [
    { tier: 1, up: 30 },
    { tier: 2, up: 50 },
    { tier: 3, up: 70 },
    { tier: 4, up: 90 }
  ];

  function isGoalsSliderOpen() {
    if (!hasGoals) return false;
    if (!goalsVisible) return false;
    try {
      if (window.VoidDissolve && VoidDissolve.isDissolved('goals')) return false;
    } catch (e) {}
    if (!goalsSection) return false;
    if (goalsSection.classList.contains('ai-void-is-dissolved')) return false;
    if (goalsSection.hidden) return false;
    return true;
  }

  function goalsPanelLocus() {
    try {
      const sec = goalsSection || document.getElementById('ai-void-agenda-goals-section');
      if (sec && !sec.hidden) {
        const r = sec.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height * 0.7 };
      }
    } catch (e) {}
    return { x: window.innerWidth * 0.5, y: window.innerHeight * 0.75 };
  }

  function goalCrossedTiers(fromP, toP) {
    fromP = Math.max(0, Math.min(100, Number(fromP) || 0));
    toP = Math.max(0, Math.min(100, Number(toP) || 0));
    if (toP <= fromP) return 0;
    let highest = 0;
    GOAL_FW_MARKS.forEach(function (m) {
      if (fromP < m.up && toP >= m.up) highest = Math.max(highest, m.tier);
    });
    if (fromP < 100 && toP >= 100) highest = 5;
    return highest;
  }

  function ensureFireworkSky() {
    try {
      if (!window.FireworkSky || FireworkSky._inited) return;
      var onEvent = null;
      try {
        if (typeof FireworkSky.createSynth === 'function') {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (AC) {
            var ac = window.__voidFireworkAC || new AC();
            window.__voidFireworkAC = ac;
            var g = ac.createGain();
            g.gain.value = 0.55;
            g.connect(ac.destination);
            onEvent = FireworkSky.createSynth(ac, g);
            if (ac.state === 'suspended') {
              document.addEventListener('pointerdown', function () {
                try { ac.resume(); } catch (e2) {}
              }, { once: true, capture: true });
            }
          }
        }
      } catch (eSynth) {}
      FireworkSky.init({ container: document.body, zIndex: 5, onEvent: onEvent });
      FireworkSky._inited = true;
    } catch (e) {}
  }

  function stopGoalFireworks() {
    try {
      if (window.FireworkSky && FireworkSky.stop) FireworkSky.stop();
    } catch (e) {}
  }

  function eruptGoalTier(tier, locusEl) {
    try {
      if (!isGoalsSliderOpen()) return;
      if (!window.FireworkSky || typeof FireworkSky.play !== 'function') return;
      ensureFireworkSky();
      // Resume audio on this user gesture (slider release)
      try {
        if (window.__voidFireworkAC && window.__voidFireworkAC.state === 'suspended') {
          window.__voidFireworkAC.resume();
        }
      } catch (e3) {}
      let originX = 0.5;
      if (locusEl && locusEl.getBoundingClientRect) {
        const r = locusEl.getBoundingClientRect();
        originX = (r.left + r.width / 2) / Math.max(1, window.innerWidth);
      } else {
        const loc = goalsPanelLocus();
        originX = loc.x / Math.max(1, window.innerWidth);
      }
      FireworkSky.play(tier, { originX: originX });
    } catch (e) {}
  }


  function persistTodos() {
    try {
      chrome.storage.sync.set({ aiTreeTodos: todos });
      chrome.storage.local.set({ aiTreeTodos: todos });
    } catch (err) {}
    try {
      window.__aiTreeTodosForVoid = todos;
      window.dispatchEvent(new CustomEvent('ai-tree-todos-updated', { detail: todos }));
    } catch (err) {}
  }

  // ── Echo / Memory: goal-linked commitment tracking (mirrors content.js) ──
  // Active only when the memory engine understands goal context; otherwise
  // every hook below is a no-op and behaviour is unchanged.
  function memoryGoalAware() {
    return typeof AITreeMemoryEngine !== 'undefined' &&
           typeof AITreeMemoryEngine.archiveGoalProgress === 'function';
  }
  // Automatic mirror of an hourly event — the event archives itself.
  function isEventMirrorTodo(todo) {
    return !!(todo && todo.id && Array.isArray(timeEvents) &&
              timeEvents.some(function (e) { return e && e.linkedTodoId === todo.id; }));
  }
  function memoryGoalCtx(todo) {
    var goal = null;
    if (todo && todo.linkedGoalId) {
      goal = (todos || []).find(function (td) {
        return td && td.id === todo.linkedGoalId && (td.type || 'daily') === 'goal';
      }) || null;
    }
    return { goalTitle: goal ? goal.text : null };
  }
  // 'completed' is archived at tick time with deterministic ids, so re-ticking
  // never duplicates and un-ticking retracts it ('reopened' is ignored by the
  // Echo). todo.memArchived remembers that the completion is on file.
  function memoryOnTodoToggle(todo) {
    if (!todo || !todo.id || !memoryGoalAware()) return;
    if ((todo.type || 'daily') !== 'daily' || isEventMirrorTodo(todo)) return;
    try {
      if (todo.done) {
        AITreeMemoryEngine.archiveTodo(todo, 'completed', memoryGoalCtx(todo));
        todo.memArchived = true;
      } else if (todo.memArchived) {
        AITreeMemoryEngine.archiveTodo(todo, 'reopened');
        todo.memArchived = false;
      }
    } catch (err) {}
  }

  function buildTodoRow(todo, opts) {
    opts = opts || {};
    const isTomorrow = !!opts.isTomorrow;
    const row = document.createElement('button');
    row.type = 'button';
    const isLinked = !!(todo.linkedGoalId);
    row.className = 'ai-void-todo-row'
      + (isTomorrow ? ' is-tomorrow' : '')
      + (todo.done ? ' done' : '')
      + (isLinked ? ' is-linked' : '');
    row.title = todo.text || '';
    const check = document.createElement('span');
    check.className = 'ai-void-todo-check';
    check.textContent = todo.done ? '\u2713' : '';
    const textEl = document.createElement('span');
    textEl.className = 'ai-void-todo-text';
    textEl.textContent = todo.text || '';
    row.append(check, textEl);
    if (isLinked) {
      const star = document.createElement('span');
      star.className = 'ai-void-todo-star';
      star.textContent = '★';
      star.setAttribute('aria-hidden', 'true');
      const imp = document.createElement('span');
      imp.className = 'ai-void-todo-impact';
      imp.textContent = todoImpactPct(todo) + '%';
      row.append(star, imp);
    }
    if (isTomorrow) {
      const badge = document.createElement('span');
      badge.className = 'ai-void-tomorrow-badge';
      badge.textContent = label('todoWhenTomorrow', 'Tomorrow');
      row.appendChild(badge);
    }
    row.addEventListener('click', function (e) {
      e.stopPropagation();
      if (todo.sourceCheck && typeof todo.sourceCheck.click === 'function') {
        todo.sourceCheck.click();
        return;
      }
      var goal = null;
      var prev = 0;
      if (todo.linkedGoalId) {
        goal = (todos || []).find(function (td) {
          return td && td.id === todo.linkedGoalId && (td.type || 'daily') === 'goal';
        }) || null;
        if (goal) prev = goalProgress(goal);
      }
      todo.done = !todo.done;
      if (goal) {
        goal.manualProgress = null;
        var next = goalProgress(goal);
        goal.progress = next;
        if (todo.done) {
          var crossed = goalCrossedTiers(prev, next);
          if (crossed > 0) {
            if (crossed === 5) {
              if (!(goal._fwCelebrated && prev >= 90)) {
                goal._fwCelebrated = true;
                eruptGoalTier(5, null);
              }
            } else {
              if (next < 90) goal._fwCelebrated = false;
              eruptGoalTier(crossed, null);
            }
          }
        }
      }
      memoryOnTodoToggle(todo);
      persistTodos();
      renderTodos();
    });
    return row;
  }

  function buildGoalCard(todo) {
    const pct = goalProgress(todo);
    const card = document.createElement('div');
    card.className = 'ai-void-goal-card' + (pct >= 100 ? ' is-complete' : '');
    card.dataset.goalId = todo.id || '';

    const head = document.createElement('div');
    head.className = 'ai-void-goal-head';

    const spark = document.createElement('span');
    spark.className = 'ai-void-goal-spark';
    spark.textContent = '\u2728';
    spark.setAttribute('aria-hidden', 'true');

    const labelEl = document.createElement('div');
    labelEl.className = 'ai-void-goal-label';
    labelEl.textContent = todo.text || '';

    const pctEl = document.createElement('span');
    pctEl.className = 'ai-void-goal-pct' + (pct >= 70 ? ' is-high' : '');
    pctEl.textContent = pct + '%';

    head.append(spark, labelEl, pctEl);

    const wrap = document.createElement('div');
    wrap.className = 'ai-void-goal-slider-wrap';

    const track = document.createElement('div');
    track.className = 'ai-void-goal-slider-track';
    const veil = document.createElement('div');
    veil.className = 'ai-void-goal-slider-veil';
    veil.style.width = (100 - pct) + '%';
    track.appendChild(veil);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'ai-void-goal-slider';
    slider.min = '0';
    slider.max = '100';
    slider.step = '1';
    slider.value = String(pct);
    slider.setAttribute('aria-label', (todo.text || 'Goal') + ' progress');
    slider.setAttribute('aria-valuemin', '0');
    slider.setAttribute('aria-valuemax', '100');
    slider.setAttribute('aria-valuenow', String(pct));

    function applyVisual(val) {
      const v = Math.max(0, Math.min(100, Math.round(Number(val) || 0)));
      veil.style.width = (100 - v) + '%';
      pctEl.textContent = v + '%';
      pctEl.classList.toggle('is-high', v >= 70);
      card.classList.toggle('is-complete', v >= 100);
      slider.setAttribute('aria-valuenow', String(v));
      // Thumb glow scales with progress
      const glow = 6 + (v / 100) * 16;
      const gold = (v / 100) * 0.75;
      slider.style.setProperty('--thumb-glow', glow + 'px');
      slider.style.setProperty('--thumb-gold', gold);
    }

    function commit(val) {
      const prev = goalProgress(todo);
      const v = Math.max(0, Math.min(100, Math.round(Number(val) || 0)));
      const memDelta = v - prev;
      todo.progress = v;
      todo.manualProgress = v; // اسلایدر = override دستی تا تیک بعدی کار پیوندی
      todo.done = v >= 100;
      applyVisual(v);
      persistTodos();
      // One signed-delta record per slider release (the `input` handler stays
      // visual-only, so this fires once per drag).
      if (memDelta !== 0 && memoryGoalAware()) {
        try { AITreeMemoryEngine.archiveGoalProgress(todo, memDelta); } catch (err) {}
      }
      // Fireworks only on upward threshold cross at release
      const crossed = goalCrossedTiers(prev, v);
      if (crossed > 0) {
        if (crossed === 5) {
          if (!(todo._fwCelebrated && prev >= 90)) {
            todo._fwCelebrated = true;
            eruptGoalTier(5, card);
          }
        } else {
          if (v < 90) todo._fwCelebrated = false;
          eruptGoalTier(crossed, card);
        }
      }
      if (v < 90) todo._fwCelebrated = false;
    }

    slider.addEventListener('input', function () {
      applyVisual(slider.value);
    });
    slider.addEventListener('change', function () {
      commit(slider.value);
    });
    // Prevent dock drag / collapse when adjusting the lever
    slider.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    slider.addEventListener('click', function (e) { e.stopPropagation(); });

    wrap.append(track, slider);

    const ends = document.createElement('div');
    ends.className = 'ai-void-goal-ends';
    const dim = document.createElement('span');
    dim.textContent = label('goalDimLabel', 'Dim');
    const light = document.createElement('span');
    light.className = 'end-light';
    light.textContent = label('goalLightLabel', 'Radiant');
    ends.append(dim, light);

    card.append(head, wrap, ends);
    applyVisual(pct);
    return card;
  }

  function renderTodos() {
    if (tasksTitleEl) tasksTitleEl.textContent = label('voidAgendaTasksLabel', 'Tasks');
    const now = Date.now();
    const shown = todos.filter(function (t) { return isToday(t, now); });
    const tomorrow = todos.filter(function (t) { return isTomorrowTodo(t, now); });
    const goals = todos.filter(function (t) { return isGoal(t); });

    const pendingDaily = shown.filter(function (t) { return !t.done; }).length;
    const pendingTomorrow = tomorrow.filter(function (t) { return !t.done; }).length;
    const pendingGoals = goals.filter(function (t) { return goalProgress(t) < 100; }).length;
    const totalOpen = pendingDaily + pendingTomorrow + pendingGoals;
    const totalAll = shown.length + tomorrow.length + goals.length;
    count.textContent = totalAll ? (totalOpen + '/' + totalAll) : '';

    list.innerHTML = '';
    if (!shown.length && !tomorrow.length) {
      const empty = document.createElement('div');
      empty.className = 'ai-void-todo-empty';
      empty.textContent = label('todoNoDaily', 'No daily tasks');
      list.appendChild(empty);
    } else {
      shown.forEach(function (todo) {
        list.appendChild(buildTodoRow(todo, { isGoal: false }));
      });
      tomorrow.forEach(function (todo) {
        list.appendChild(buildTodoRow(todo, { isGoal: false, isTomorrow: true }));
      });
    }

    if (goalsSection && goalsList) {
      if (goalsTitleEl) goalsTitleEl.textContent = label('todoTabGoals', 'Goals');
      hasGoals = goals.length > 0;
      if (!hasGoals) {
        goalsList.innerHTML = '';
        const emptyGoals = document.createElement('div');
        emptyGoals.className = 'ai-void-todo-empty';
        emptyGoals.textContent = label('todoNoGoals', 'No goals yet — add a wish ✨');
        goalsList.appendChild(emptyGoals);
      } else {
        goalsList.innerHTML = '';
        // سقفِ سختِ ۶ هدف: هم برای این‌که گرید بدونِ اسکرول/بریدگی همیشه کامل
        // دیده بشه، هم چون بیشتر از این معمولاً یعنی تمرکز از دست رفته —
        // نزدیک‌ترین‌ها به اتمام (همون ترتیبِ پیشین) نشون داده می‌شن.
        const sortedGoals = goals.slice().sort(function (a, b) {
          return goalProgress(b) - goalProgress(a);
        });
        const shownGoals = sortedGoals.slice(0, GOALS_MAX_VISIBLE);
        shownGoals.forEach(function (todo) {
          goalsList.appendChild(buildGoalCard(todo));
        });
        const hiddenCount = sortedGoals.length - shownGoals.length;
        if (hiddenCount > 0) {
          const overflow = document.createElement('div');
          overflow.className = 'ai-void-goals-overflow';
          overflow.innerHTML = '<strong>+' + hiddenCount + '</strong> ' +
            label('voidGoalsOverflowLabel', 'more — worth narrowing your focus');
          goalsList.appendChild(overflow);
        }
      }
      // hidden واقعیِ Goals از applyDockVisibility میاد — چون هم به تعدادِ
      // Goals (hasGoals) و هم به روشن/خاموش‌بودنِ Today (dockVisible) بستگی داره.
      applyDockVisibility();
    }
  }

  function isMobileLayout() {
    try { return window.matchMedia('(max-width: 700px)').matches; } catch (e) { return window.innerWidth <= 700; }
  }
  function applyQuickbarOpposite() {
    const qb = document.getElementById('ai-ntp-quickbar');
    if (!qb) return;
    if (isMobileLayout()) { qb.dataset.side = 'right'; return; }
    const dockSide = position.side === 'left' ? 'left' : 'right';
    qb.dataset.side = dockSide === 'right' ? 'left' : 'right';
  }
  function applyPosition() {
    dock.dataset.side = position.side === 'left' ? 'left' : 'right';
    dock.style.top = (Math.max(0.04, Math.min(0.78, Number(position.top) || 0.22)) * 100) + 'vh';
    applyQuickbarOpposite();
  }
  function savePosition() {
    try { chrome.storage.local.set({ voidTodoDock: position }); } catch (e) {}
  }

  let dragMoved = false;
  function isDockChromeControl(target) {
    if (!target) return false;
    const dissolveBtn = document.getElementById('ai-void-todo-dissolve');
    if (sideButton && (target === sideButton || sideButton.contains(target))) return true;
    if (dissolveBtn && (target === dissolveBtn || dissolveBtn.contains(target))) return true;
    return false;
  }
  handle.addEventListener('click', function (event) {
    if (isDockChromeControl(event.target)) return;
    if (dragMoved) { dragMoved = false; return; }
    setCollapsed(!collapsed);
  });
  handle.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setCollapsed(!collapsed);
    }
  });

  window.addEventListener('ai-tree-todos-updated', function (event) {
    acceptTodos(event.detail, false);
  });
  // به‌محضِ این‌که VoidDissolve دادهٔ واقعی‌اش رو از storage خوند (نه قبلش)،
  // یک‌بار applyDockVisibility رو دوباره صدا می‌زنیم تا اگه توی بازهٔ
  // «آماده نبودنِ VoidDissolve» یک تصمیمِ نادرست گرفته بودیم (یا اصلاً هیچ
  // تصمیمی نگرفته بودیم، چون این تابع تا وقتیِ !isReady() خودش early-return
  // می‌کنه)، الان با دادهٔ درست تصحیح بشه — این تنها جاییه که بعد از اولین
  // رندر، دوباره دست به دید بودن/نبودنِ Today می‌زنیم.
  window.addEventListener('void-dissolve-ready', function () {
    applyDockVisibility();
  }, { once: true });
  if (Array.isArray(window.__aiTreeTodosForVoid) && window.__aiTreeTodosForVoid.length) {
    acceptTodos(window.__aiTreeTodosForVoid, false);
  }

  function loadFromStorage() {
    try {
      chrome.storage.local.get(['aiTreeTodos', 'voidTodoDock', 'voidTodoCollapsed', VISIBLE_KEY, 'voidGoalsVisible'], function (localData) {
        storageReady = true;
        if (localData.voidTodoDock && typeof localData.voidTodoDock === 'object') {
          position = Object.assign({}, position, localData.voidTodoDock);
        }
        if (typeof localData.voidTodoCollapsed === 'boolean') collapsed = localData.voidTodoCollapsed;
        if (typeof localData[VISIBLE_KEY] === 'boolean') dockVisible = localData[VISIBLE_KEY];
        if (typeof localData.voidGoalsVisible === 'boolean') goalsVisible = localData.voidGoalsVisible;
        else goalsVisible = dockVisible;
        applyPosition();
        applyCollapsed();
        applyDockVisibility();
        wireMenu();
        chrome.storage.sync.get(['aiTreeTodos'], function (syncData) {
          const localTodos = Array.isArray(localData.aiTreeTodos) ? localData.aiTreeTodos : [];
          const syncTodos = Array.isArray(syncData.aiTreeTodos) ? syncData.aiTreeTodos : [];
          // local همیشه اولویت داره وقتی داده داره — sync برایِ آرایه‌های
          // نسبتاً بزرگ (کاربرهایی با کار/هدفِ زیاد) به‌راحتی از سقفِ ۸KBِ
          // هر آیتم رد می‌شه و chrome.storage.sync.set بی‌صدا شکست می‌خوره؛
          // قبلاً منطقِ «هرکدوم غنی‌تره» می‌تونست همون نسخهٔ قدیمی/گیرکردهٔ
          // sync رو به‌جایِ local تازه انتخاب کنه (دقیقاً همون علتِ برنگشتنِ
          // تیک‌ها در منویِ Today). sync فقط وقتی به‌کار می‌ره که local واقعاً
          // خالیه (نصبِ تازه یا دستگاهِ دیگه‌ای که هنوز local نداره).
          const preferred = localTodos.length ? localTodos : syncTodos;
          acceptTodos(preferred, true);
        });
      });
    } catch (e) {
      applyPosition();
      applyCollapsed();
      applyDockVisibility();
      wireMenu();
    }
  }
  loadFromStorage();
  try {
    window.addEventListener('void-dissolve-ready', function onDissolveReady() {
      applyDockVisibility();
      try { window.removeEventListener('void-dissolve-ready', onDissolveReady); } catch (e) {}
    });
  } catch (e) {}

  loadTimeEvents();
  loadBirthYear();
  loadMarkedDays();
  renderDateHead();
  renderEvents();

  if (panelTitleEl) panelTitleEl.textContent = label('voidTodayPanelTitle', 'Today');

  try {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if ((area === 'sync' || area === 'local') && changes.aiTreeTodos) {
        acceptTodos(Array.isArray(changes.aiTreeTodos.newValue) ? changes.aiTreeTodos.newValue : [], true);
      }
      if (area === 'local' && changes.aiTreeTimeEvents) {
        timeEvents = Array.isArray(changes.aiTreeTimeEvents.newValue) ? changes.aiTreeTimeEvents.newValue : [];
        renderEvents();
      }
      if (area === 'sync' && (changes.userBirthYear || changes.userBirthMonth || changes.userBirthDay || changes.aiTreeFamilyAges)) {
        if (changes.userBirthYear) userBirthYear = changes.userBirthYear.newValue ? parseInt(changes.userBirthYear.newValue, 10) : null;
        if (changes.userBirthMonth) userBirthMonth = changes.userBirthMonth.newValue ? parseInt(changes.userBirthMonth.newValue, 10) : null;
        if (changes.userBirthDay) userBirthDay = changes.userBirthDay.newValue ? parseInt(changes.userBirthDay.newValue, 10) : null;
        if (changes.aiTreeFamilyAges) {
          const list = Array.isArray(changes.aiTreeFamilyAges.newValue) ? changes.aiTreeFamilyAges.newValue : [];
          familyAges = list.filter(m => m && m.year).map(m => ({
            id: m.id, name: String(m.name || '').slice(0, 24),
            year: parseInt(m.year, 10),
            month: m.month ? parseInt(m.month, 10) : null,
            day: m.day ? parseInt(m.day, 10) : null,
            primary: !!m.primary
          }));
          if (familyAges.length && !familyAges.some(m => m.primary)) familyAges[0].primary = true;
          const prim = familyAges.find(m => m.primary) || familyAges[0];
          if (prim) { userBirthYear = prim.year; userBirthMonth = prim.month; userBirthDay = prim.day; }
        }
        renderDateHead();
      }
      if (area === 'sync' && changes.aiTreeMarkedDays) {
        markedDays = Array.isArray(changes.aiTreeMarkedDays.newValue) ? changes.aiTreeMarkedDays.newValue : [];
        renderDateHead();
      }
      if (area === 'local' && changes[VISIBLE_KEY]) {
        dockVisible = changes[VISIBLE_KEY].newValue !== false;
        applyDockVisibility();
        wireMenu();
      }
    });
  } catch (e) {}

  // رفرشِ خفیفِ دوره‌ای: چون evaluateStatus (near/missed) وابسته به «الان» است،
  // بدون تغییرِ داده هم باید هر دقیقه یک‌بار خودش را به‌روز کند — درست مثل
  // رفتارِ ویجتِ اصلی (renderTimeline هر دقیقه).
  setInterval(() => { renderEvents(); renderDateHead(); }, 60 * 1000);

  function poll() {
    // منبع اصلی: آرایهٔ کامل (روزانه + فردا + اهداف) از content.js
    if (Array.isArray(window.__aiTreeTodosForVoid) && window.__aiTreeTodosForVoid.length) {
      acceptTodos(window.__aiTreeTodosForVoid, false);
      return;
    }
    // فقط وقتی هنوز هیچ todoای نداریم از DOM اسکرپ کن —
    // و هرگز لیستی که فقط daily است را روی لیست کامل‌تر (با goal) ننویس
    if (todos.length) return;
    const sources = [
      { el: document.getElementById('ai-todo-list'), row: '.ai-todo-item, .ai-goal-item', text: '.ai-todo-text, .ai-goal-text', check: '.ai-todo-check, .ai-goal-check' },
      { el: document.getElementById('ai-dash-todo-list'), row: '.ai-dash-todo-row', text: '.ai-dash-todo-text', check: '.ai-dash-todo-check' }
    ];
    for (let s = 0; s < sources.length; s++) {
      const src = sources[s];
      if (!src.el) continue;
      const rows = src.el.querySelectorAll(src.row);
      if (!rows.length) continue;
      const mapped = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const textEl = row.querySelector(src.text);
        const checkEl = row.querySelector(src.check);
        const text = textEl ? textEl.textContent.trim() : '';
        if (!text) continue;
        const isGoalRow = row.classList.contains('ai-goal-item');
        mapped.push({
          text: text,
          done: row.classList.contains('done'),
          sourceCheck: checkEl,
          type: isGoalRow ? 'goal' : 'daily',
          createdAt: Date.now() - 1000
        });
      }
      if (mapped.length) {
        acceptTodos(mapped, false);
        break;
      }
    }
  }
  poll();
  setInterval(poll, 400);

  sideButton.addEventListener('click', function (event) {
    event.stopPropagation();
    position.side = position.side === 'left' ? 'right' : 'left';
    applyPosition();
    savePosition();
  });

  let dragging = null;
  handle.addEventListener('pointerdown', function (event) {
    if (isDockChromeControl(event.target)) return;
    dragMoved = false;
    dragging = { y: event.clientY, top: dock.getBoundingClientRect().top };
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove', function (event) {
    if (!dragging) return;
    if (Math.abs(event.clientY - dragging.y) > 4) dragMoved = true;
    const maxTop = Math.max(16, window.innerHeight - dock.offsetHeight - 16);
    const top = Math.max(16, Math.min(maxTop, dragging.top + event.clientY - dragging.y));
    position.top = top / window.innerHeight;
    position.side = event.clientX < window.innerWidth / 2 ? 'left' : 'right';
    applyPosition();
  });
  function endDrag() {
    if (!dragging) return;
    dragging = null;
    if (dragMoved) savePosition();
  }
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);


  // ============================================================
  // Daily report — copy + download .txt (no mailto; unreliable on extension NTP)
  // ============================================================
  const reportBar = document.getElementById('ai-void-report-bar');
  const reportCopyBtn = document.getElementById('ai-void-report-copy');
  const reportLabel = document.getElementById('ai-void-report-label');
  const reportTxtBtn = document.getElementById('ai-void-report-txt');
  const reportHint = document.getElementById('ai-void-report-hint');
  let reportHintTimer = null;

  function showReportHint(msg, isError) {
    if (!reportHint) return;
    reportHint.textContent = msg || '';
    reportHint.classList.toggle('is-error', !!isError);
    reportHint.classList.add('is-visible');
    clearTimeout(reportHintTimer);
    reportHintTimer = setTimeout(() => { reportHint.classList.remove('is-visible'); }, 3200);
  }

  function statusLabel(status) {
    const map = { done: '✓', missed: '✗', near: '⚡', 'recurring-elapsed': '↻', future: '·' };
    return map[status] || '·';
  }
  function statusWord(status) {
    if (status === 'done') return 'done';
    if (status === 'missed') return 'missed';
    if (status === 'near') return 'soon';
    if (status === 'recurring-elapsed') return 'repeats';
    return '';
  }

  function buildDailyReport() {
    const now = new Date();
    const iso = todayIso();
    const tIso = tomorrowIso();
    const dateLine = now.toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const lines = [];
    lines.push('Void Galaxy — Daily Report');
    lines.push(dateLine);
    lines.push('='.repeat(Math.min(40, dateLine.length + 8)));
    lines.push('');

    const todaysEvents = timeEvents
      .filter((e) => e && e.date === iso)
      .slice()
      .sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
    lines.push(label('voidAgendaEventsLabel', "Today's schedule"));
    if (!todaysEvents.length) {
      lines.push('  — ' + label('dashNoEvents', 'No events'));
    } else {
      todaysEvents.forEach((evt) => {
        const st = evaluateStatus(evt);
        const mark = statusLabel(st);
        const extra = statusWord(st);
        const rec = evt.recurring ? ' ★' : '';
        const end = evt.endTime ? ('–' + evt.endTime) : '';
        lines.push('  ' + mark + ' ' + (evt.startTime || '--:--') + end + '  ' + (evt.title || '') + rec + (extra ? '  [' + extra + ']' : ''));
      });
    }
    lines.push('');

    const tomorrowEvents = timeEvents
      .filter((e) => e && e.date === tIso)
      .slice()
      .sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
    if (tomorrowEvents.length) {
      lines.push(label('scrubberTomorrowBadge', 'Tomorrow') + ' — ' + label('voidAgendaEventsLabel', "Today's schedule"));
      tomorrowEvents.forEach((evt) => {
        const rec = evt.recurring ? ' ★' : '';
        const end = evt.endTime ? ('–' + evt.endTime) : '';
        lines.push('  · ' + (evt.startTime || '--:--') + end + '  ' + (evt.title || '') + rec);
      });
      lines.push('');
    }

    const todayTasks = todos.filter((t) => isToday(t, now));
    const tomorrowTasks = todos.filter((t) => isTomorrowTodo(t, now));
    const goals = todos.filter((t) => isGoal(t));

    lines.push(label('voidAgendaTasksLabel', 'Tasks') + ' — ' + label('todoWhenToday', 'Today'));
    if (!todayTasks.length) {
      lines.push('  — ' + label('todoNoDaily', 'No daily tasks'));
    } else {
      todayTasks.forEach((t) => {
        lines.push('  ' + (t.done ? '[x]' : '[ ]') + ' ' + (t.text || ''));
      });
    }
    lines.push('');

    if (tomorrowTasks.length) {
      lines.push(label('voidAgendaTasksLabel', 'Tasks') + ' — ' + label('todoWhenTomorrow', 'Tomorrow'));
      tomorrowTasks.forEach((t) => {
        lines.push('  ' + (t.done ? '[x]' : '[ ]') + ' ' + (t.text || ''));
      });
      lines.push('');
    }

    if (goals.length) {
      lines.push(label('todoTabGoals', 'Goals'));
      goals.slice().sort((a, b) => goalProgress(b) - goalProgress(a)).forEach((g) => {
        const pct = goalProgress(g);
        const barLen = 10;
        const filled = Math.round((pct / 100) * barLen);
        const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);
        lines.push('  ' + bar + ' ' + pct + '%  ' + (g.text || ''));
      });
      lines.push('');
    }

    const openTasks = todayTasks.filter((t) => !t.done).length + tomorrowTasks.filter((t) => !t.done).length;
    const openGoals = goals.filter((g) => goalProgress(g) < 100).length;
    const openEvents = todaysEvents.filter((e) => {
      const s = evaluateStatus(e);
      return s !== 'done' && s !== 'missed' && s !== 'recurring-elapsed';
    }).length;
    lines.push('-'.repeat(28));
    lines.push(
      label('voidReportSummary', 'Open: {tasks} tasks · {events} events · {goals} goals')
        .replace('{tasks}', String(openTasks))
        .replace('{events}', String(openEvents))
        .replace('{goals}', String(openGoals))
    );
    lines.push('');
    lines.push('— Void Galaxy');
    return lines.join('\n');
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise((resolve, reject) => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        resolve();
      } catch (err) { reject(err); }
    });
  }
  function downloadReportTxt() {
    const body = buildDailyReport();
    const filename = 'AITree_Daily_' + todayIso() + '.txt';
    try {
      const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try { URL.revokeObjectURL(url); } catch (e) {}
        try { a.remove(); } catch (e) {}
      }, 1500);
      showReportHint(label('voidReportTxtSaved', 'Saved as {file}').replace('{file}', filename));
    } catch (err) {
      showReportHint(label('voidReportTxtFail', 'Could not save .txt file'), true);
    }
  }
  function copyReportOnly() {
    const body = buildDailyReport();
    copyText(body).then(() => {
      showReportHint(label('voidReportCopied', 'Report copied to clipboard'));
    }).catch(() => {
      showReportHint(label('voidReportCopyFail', 'Could not copy report'), true);
    });
  }
  function applyReportLabels() {
    if (reportLabel) {
      reportLabel.textContent = label('voidReportShareLabel', 'Share report');
    }
    if (reportCopyBtn) {
      reportCopyBtn.title = label('voidReportCopyTitle', 'Copy report');
      reportCopyBtn.setAttribute('aria-label', label('voidReportCopyTitle', 'Copy report'));
    }
    if (reportTxtBtn) {
      reportTxtBtn.title = label('voidReportTxtTitle', 'Download as .txt');
      reportTxtBtn.setAttribute('aria-label', label('voidReportTxtTitle', 'Download as .txt'));
    }
    const dissolveTitle = label('voidDissolveBtn', 'Dissolve into stars');
    ['ai-void-todo-dissolve', 'ai-void-goals-dissolve'].forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.title = dissolveTitle;
      btn.setAttribute('aria-label', dissolveTitle);
    });
  }

  if (reportCopyBtn) reportCopyBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); copyReportOnly(); });
  if (reportTxtBtn) reportTxtBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); downloadReportTxt(); });
  if (reportBar) reportBar.addEventListener('pointerdown', (e) => e.stopPropagation());

  applyReportLabels();
  try {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.appLanguage) applyReportLabels();
    });
  } catch (e) {}

  applyCollapsed();
  applyQuickbarOpposite();
  try { window.addEventListener('resize', applyQuickbarOpposite); } catch (e) {}
})();
