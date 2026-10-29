// حیاتی: memory-engine.js باید همین‌جا (Service Worker) لود شود تا حالتِ
// واقعیِ IndexedDB آن (buildRealEngine) فعال شود — چون تنها اینجا originِ
// پایدار و یکتای خودِ افزونه وجود دارد (نه در content scriptهای رویِ هر
// سایت). بدونِ این خط، AITreeMemoryEngine اینجا اصلاً تعریف نمی‌شود، پیامِ
// content scriptها/void-tab.html هیچ شنونده‌ای پیدا نمی‌کند، و هر فراخوانی
// بی‌صدا (بدونِ خطا) به null resolve می‌شود.
importScripts('memory-engine.js');

// AI Tree Launcher — background service worker (MV3)
// 1) Open standalone notepad tab (with return-to-widget context)
// 2) Refocus parent tab and close notepad tab
// 3) Inline translation (CSP-safe for content scripts + notepad)
// 4) Official public holidays (Iran: fully offline curated list; other countries: Nager.Date)

// فهرست کامل و آفلاینِ تعطیلات رسمی ایران — هم شمسی (j) هم قمری (h). عمداً «شب
// یلدا» در این لیست نیست چون جشن است نه تعطیل رسمی. تبدیل تاریخ قمری به سالِ
// جاری با Intl + تقویم islamic-umalqura در content.js انجام می‌شود (ممکن است
// در برخی سال‌ها ±۱ روز با رؤیت هلال رسمی مؤسسهٔ ژئوفیزیک تهران فرق داشته باشد).
const IRAN_HOLIDAYS = [
  { id: 'nowruz', label: 'عید نوروز', day: 1, month: 1, cal: 'j', golden: false, isPublic: true },
  { id: 'nowruz-2', label: 'عید نوروز', day: 2, month: 1, cal: 'j', golden: false, isPublic: true },
  { id: 'eid-fitr-2', label: 'تعطیل به مناسبت عید سعید فطر', day: 2, month: 10, cal: 'h', golden: false, isPublic: true },
  { id: 'nowruz-3', label: 'عید نوروز', day: 3, month: 1, cal: 'j', golden: false, isPublic: true },
  { id: 'nowruz-4', label: 'عید نوروز', day: 4, month: 1, cal: 'j', golden: false, isPublic: true },
  { id: 'islamic-republic', label: 'روز جمهوری اسلامی ایران', day: 12, month: 1, cal: 'j', golden: false, isPublic: true },
  { id: 'nature-day', label: 'روز طبیعت و سیزده‌به‌در', day: 13, month: 1, cal: 'j', golden: false, isPublic: true },
  { id: 'imam-sadiq-martyrdom', label: 'شهادت امام جعفر صادق (ع)', day: 25, month: 10, cal: 'h', golden: false, isPublic: true },
  { id: 'eid-adha', label: 'عید سعید قربان', day: 10, month: 12, cal: 'h', golden: false, isPublic: true },
  { id: 'ghadir', label: 'عید سعید غدیر خم', day: 18, month: 12, cal: 'h', golden: false, isPublic: true },
  { id: 'khomeini-death', label: 'رحلت امام خمینی (ره)', day: 14, month: 3, cal: 'j', golden: false, isPublic: true },
  { id: 'khordad-15', label: 'قیام خونین ۱۵ خرداد', day: 15, month: 3, cal: 'j', golden: false, isPublic: true },
  { id: "tasu'a", label: 'تاسوعای حسینی', day: 9, month: 1, cal: 'h', golden: false, isPublic: true },
  { id: 'ashura', label: 'عاشورای حسینی', day: 10, month: 1, cal: 'h', golden: false, isPublic: true },
  { id: 'arbaeen', label: 'اربعین حسینی', day: 20, month: 2, cal: 'h', golden: false, isPublic: true },
  { id: 'prophet-death-hasan-martyrdom', label: 'رحلت پیامبر اکرم (ص) و شهادت امام حسن مجتبی (ع)', day: 28, month: 2, cal: 'h', golden: false, isPublic: true },
  { id: 'imam-reza-martyrdom', label: 'شهادت امام رضا (ع)', day: 30, month: 2, cal: 'h', golden: false, isPublic: true },
  { id: 'mawlid-prophet', label: 'ولادت حضرت رسول اکرم (ص)', day: 17, month: 3, cal: 'h', golden: false, isPublic: true },
  { id: 'mawlid-imam-sadiq', label: 'ولادت امام جعفر صادق (ع)', day: 17, month: 3, cal: 'h', golden: false, isPublic: true },
  { id: 'fatima-martyrdom', label: 'شهادت حضرت فاطمه زهرا (س)', day: 3, month: 6, cal: 'h', golden: false, isPublic: true },
  { id: 'imam-ali-birth', label: 'ولادت حضرت علی (ع) و روز پدر', day: 13, month: 7, cal: 'h', golden: false, isPublic: true },
  { id: 'prophet-ascension', label: 'مبعث حضرت رسول اکرم (ص)', day: 27, month: 7, cal: 'h', golden: false, isPublic: true },
  { id: 'imam-mahdi-birth', label: 'ولادت حضرت قائم (عج) و نیمه شعبان', day: 15, month: 8, cal: 'h', golden: false, isPublic: true },
  { id: 'imam-ali-martyrdom', label: 'شهادت حضرت علی (ع)', day: 21, month: 9, cal: 'h', golden: false, isPublic: true },
  { id: 'eid-fitr-1', label: 'عید سعید فطر', day: 1, month: 10, cal: 'h', golden: false, isPublic: true },
  { id: 'oil-nationalization', label: 'روز ملی شدن صنعت نفت ایران', day: 29, month: 12, cal: 'j', golden: false, isPublic: true },
  { id: 'revolution-victory', label: 'پیروزی انقلاب اسلامی ایران', day: 22, month: 11, cal: 'j', golden: false, isPublic: true }
];

// فاز جهانی — برای کشورهای غیر ایران. پوشش Nager.Date همه‌جا یکسان نیست و
// تعطیلات قمری/رؤیت‌هلالی را اصلاً شامل نمی‌شود.
const NAGER_BASE_URL = 'https://date.nager.at/api/v3/PublicHolidays';

// ---------------------------------------------------------------------------
// کش سبک ترجمه (فقط در حافظه — با خواب Service Worker پاک می‌شود، همین‌قدر هم
// کافی است) — برای جلوگیری از فچ تکراری وقتی همان متن/زبان دوباره خواسته
// می‌شود (مثلاً کلیک دوباره روی دکمهٔ ترجمه، یا برگشتن به همان کلمه در
// دیکشنری). سقف اندازه دارد تا نشتی حافظه نداشته باشیم.
const TRANSLATE_CACHE = new Map();
const TRANSLATE_CACHE_MAX = 200;
const TRANSLATE_CACHE_TTL_MS = 10 * 60 * 1000; // ۱۰ دقیقه

function translateCacheKey(text, targetLang) {
  // Normalize whitespace so near-identical clipboard/selection variants share a cache hit
  return targetLang + '::' + String(text || '').trim().replace(/\s+/g, ' ');
}

function translateCacheGet(key) {
  const hit = TRANSLATE_CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > TRANSLATE_CACHE_TTL_MS) {
    TRANSLATE_CACHE.delete(key);
    return null;
  }
  return hit.value;
}

function translateCacheSet(key, value) {
  if (TRANSLATE_CACHE.size >= TRANSLATE_CACHE_MAX) {
    // قدیمی‌ترین کلید را حذف کن (اولین کلیدِ Map به ترتیب درج است)
    const oldestKey = TRANSLATE_CACHE.keys().next().value;
    if (oldestKey !== undefined) TRANSLATE_CACHE.delete(oldestKey);
  }
  TRANSLATE_CACHE.set(key, { value, ts: Date.now() });
}

// اندپوینتِ translate.googleapis.com یک API رسمی/مستند نیست — همان اندپوینتِ
// رایگانی است که translate.google.com خودش استفاده می‌کند و توسط گوگل بر
// اساس IP مبدأ محدود به نرخ می‌شود (Rate Limit)، نه بر اساس این افزونه به‌تنهایی.
// یعنی حتی با استفادهٔ معقول، ممکن است HTTP 429 برگردد (مثلاً وقتی IP شما با
// کاربران زیاد دیگری در همان شبکه/ISP/VPN مشترک است). اینجا با backoff نمایی
// + jitter (حداکثر ۳ تلاش مجدد) این خطای گذرا را تا حد امکان جبران می‌کنیم؛ اگر
// هدر Retry-After برگردد از همان استفاده می‌شود، وگرنه از تأخیر پیش‌فرض با
// jitter تصادفی تا درخواست‌های همزمان هم‌فاز نشوند.
function translateBackoffDelayMs(attempt, baseMs) {
  // Exponential: base * 2^attempt, plus half-jitter, capped so Service Worker
  // lifetime stays reasonable under repeated 429s.
  const exp = Math.min(baseMs * Math.pow(2, attempt), 8000);
  const jitter = Math.random() * exp;
  return Math.round(exp * 0.5 + jitter * 0.5);
}

async function fetchTranslateWithRetry(url, maxRetries) {
  if (maxRetries == null) maxRetries = 3;
  let attempt = 0;
  for (;;) {
    let res;
    try {
      res = await fetch(url);
    } catch (networkErr) {
      // خطای سطح شبکه (نه یک پاسخ HTTP با کد خطا) — یعنی fetch() اصلاً پاسخی
      // برنگردانده: قطعی موقت اینترنت، مسدودشدن این دامنه توسط فایروال/VPN/
      // ادبلاکر، یا افت لحظه‌ایِ خودِ سرور گوگل. قبلاً این حالت اصلاً retry
      // نمی‌شد (فقط ۴۲۹ پوشش داده می‌شد) — همینجا هم مثل ۴۲۹ چند بار دوباره
      // تلاش می‌کنیم، چون اکثر این خطاها گذرا هستند.
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, translateBackoffDelayMs(attempt, 600)));
        attempt += 1;
        continue;
      }
      // navigator.onLine در Service Worker هم در دسترس است؛ صرفاً یک راهنمای
      // سریع است (نه تضمین قطعی)، ولی برای تفکیک پیام «کلاً آفلاینی» از
      // «سرویس/دامنه در دسترس نیست» کافی است.
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      throw new Error(offline ? 'network_offline' : 'network_error');
    }
    if (res.ok) return res;
    if (res.status === 429 && attempt < maxRetries) {
      const retryAfterHeader = res.headers.get('Retry-After');
      const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
      let delayMs;
      if (!isNaN(retryAfterSec) && retryAfterSec >= 0) {
        // Honor server hint, then add a small jitter so parallel tabs don't
        // all retry on the same millisecond.
        delayMs = retryAfterSec * 1000 + Math.floor(Math.random() * 250);
      } else {
        delayMs = translateBackoffDelayMs(attempt, 700);
      }
      await new Promise((r) => setTimeout(r, delayMs));
      attempt += 1;
      continue;
    }
    throw new Error('HTTP ' + res.status);
  }
}


// ---- Iran holidays: packaged JSON + optional user override ----
const IRAN_HOLIDAYS_STORAGE_KEY = 'iranHolidaysOverride';

function normalizeIranHolidayEntry(raw, idx) {
  if (!raw || typeof raw !== 'object') return null;
  const day = parseInt(raw.day, 10);
  const month = parseInt(raw.month, 10);
  if (!day || !month || day < 1 || day > 31 || month < 1 || month > 12) return null;
  let cal = String(raw.cal || 'j').toLowerCase();
  if (cal === 'jalali' || cal === 'shamsi') cal = 'j';
  if (cal === 'hijri' || cal === 'qamari' || cal === 'lunar') cal = 'h';
  if (cal === 'gregorian') cal = 'g';
  if (cal !== 'j' && cal !== 'h' && cal !== 'g') cal = 'j';
  const label = String(raw.label || '').trim().slice(0, 120);
  if (!label) return null;
  const id = String(raw.id || ('ir-' + month + '-' + day + '-' + idx)).slice(0, 80);
  return { id, label, day, month, cal, golden: !!raw.golden, isPublic: raw.isPublic !== false };
}

function normalizeIranHolidayList(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  const seen = new Set();
  list.forEach((item, i) => {
    const n = normalizeIranHolidayEntry(item, i);
    if (!n) return;
    if (seen.has(n.id)) n.id = n.id + '-' + i;
    seen.add(n.id);
    out.push(n);
  });
  return out.length ? out : null;
}

function loadPackagedIranHolidays() {
  return fetch(chrome.runtime.getURL('iran-holidays.json'))
    .then((r) => { if (!r.ok) throw new Error('packaged json missing'); return r.json(); })
    .then((doc) => {
      const list = normalizeIranHolidayList(doc && (doc.events || doc.holidays || doc));
      if (!list) throw new Error('invalid packaged json');
      return list;
    });
}

function getIranHolidaysList() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([IRAN_HOLIDAYS_STORAGE_KEY], (res) => {
        const override = normalizeIranHolidayList(res[IRAN_HOLIDAYS_STORAGE_KEY]);
        if (override) {
          resolve({ data: override, source: 'iran-override' });
          return;
        }
        loadPackagedIranHolidays()
          .then((list) => resolve({ data: list, source: 'iran-json' }))
          .catch(() => resolve({ data: IRAN_HOLIDAYS, source: 'iran-static' }));
      });
    } catch (e) {
      resolve({ data: IRAN_HOLIDAYS, source: 'iran-static' });
    }
  });
}

function holidaysCacheKeyFor(countryCode, year) {
  return `aiTreeHolidays_${countryCode}_${year}`;
}

function mapNagerHolidays(data, countryCode) {
  return (Array.isArray(data) ? data : [])
    // فقط تعطیل رسمی واقعی؛ Bank/School/Optional/Observance را رد می‌کنیم
    .filter(item => Array.isArray(item.types) && item.types.includes('Public'))
    .map((item, index) => {
      const [, hMonth, hDay] = item.date.split('-');
      return {
        id: `pub-${countryCode}-${index}`,
        label: item.localName || item.name,
        day: parseInt(hDay, 10),
        month: parseInt(hMonth, 10),
        cal: 'g', // Nager.Date همیشه تاریخ میلادی برمی‌گرداند
        golden: false,
        isPublic: true
      };
    });
}

let musicOwnerTabId = null;
const MUSIC_OWNER_KEY = 'voidMusicPlaybackOwnerTabId';
const musicOwnerReady = chrome.storage.session.get(MUSIC_OWNER_KEY).then(async (stored) => {
  const savedId = stored && stored[MUSIC_OWNER_KEY];
  if (!Number.isInteger(savedId)) return;
  try { await chrome.tabs.get(savedId); musicOwnerTabId = savedId; }
  catch (e) { await chrome.storage.session.remove(MUSIC_OWNER_KEY); }
}).catch(() => {});
let musicClaimQueue = musicOwnerReady;

chrome.tabs.onRemoved.addListener((tabId) => {
  if (musicOwnerTabId === tabId) {
    musicOwnerTabId = null;
    musicClaimQueue = musicClaimQueue.then(() => chrome.storage.session.remove(MUSIC_OWNER_KEY)).catch(() => {});
  }
});

function isVoidTabUrl(url) {
  return typeof url === 'string' && url.startsWith(chrome.runtime.getURL('void-tab.html'));
}

function musicMessageTabId(message, sender) {
  if (!sender) return null;
  if (sender.tab && Number.isInteger(sender.tab.id)) {
    // New Tab overrides may expose the extension document URL on sender.url
    // while sender.tab.url reflects the browser's new-tab URL.
    if (isVoidTabUrl(sender.tab.url)) return sender.tab.id;
    if (sender.id === chrome.runtime.id && isVoidTabUrl(sender.url)) return sender.tab.id;
    return null;
  }
  // Extension-page messages have a sender.url but typically no sender.tab.
  if (sender.id === chrome.runtime.id && isVoidTabUrl(sender.url) && Number.isInteger(message.tabId)) {
    return message.tabId;
  }
  return null;
}

function musicCoordLog(event, detail) {
  try { console.info('[VoidMusicCoord]', new Date().toISOString(), event, detail || ''); } catch (e) {}
}

function probePlayingMusic(excludeTabId) {
  return chrome.tabs.query({}).then((tabs) => {
    const candidates = (tabs || []).filter((tab) => tab.id != null && tab.id !== excludeTabId && isVoidTabUrl(tab.url));
    return Promise.all(candidates.map((tab) => new Promise((resolve) => {
      let settled = false;
      const finish = (playing) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(playing ? tab.id : null);
      };
      const timer = setTimeout(() => finish(false), 1500);
      try {
        chrome.tabs.sendMessage(tab.id, { type: 'vm-owner-probe' }, (response) => {
          const failed = !!chrome.runtime.lastError;
          finish(!failed && !!(response && response.playing));
        });
      } catch (e) { finish(false); }
    }))).then((owners) => owners.find((id) => id != null) ?? null);
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && typeof message.type === 'string' && message.type.startsWith('vm-music-')) {
    musicCoordLog('message-received', { type: message.type, requestId: message.requestId, senderUrl: sender.url, senderTabUrl: sender.tab && sender.tab.url, senderTabId: sender.tab && sender.tab.id, payloadTabId: message.tabId });
  }
  if (message && message.type === 'vm-music-release') {
    const tabId = musicMessageTabId(message, sender);
    if (tabId != null && musicOwnerTabId === tabId) {
      musicOwnerTabId = null;
      musicClaimQueue = musicClaimQueue.then(() => chrome.storage.session.remove(MUSIC_OWNER_KEY))
        .then(() => { musicCoordLog('release', { tabId: tabId }); sendResponse({ ok: true }); })
        .catch(() => sendResponse({ ok: false, error: 'storage_failed' }));
      return true;
    }
    sendResponse({ ok: true });
    return;
  }

  if (message && message.type === 'vm-music-claim') {
    const tabId = musicMessageTabId(message, sender);
    const senderTabId = sender.tab && sender.tab.id != null ? sender.tab.id : null;
    const respondClaim = (response, decision, probeRan, probeOwnerTabId, error) => {
      musicCoordLog('claim-decision', {
        requestId: message.requestId,
        tabId: tabId,
        senderTabId: senderTabId,
        musicOwnerTabId: musicOwnerTabId,
        branch: decision,
        probeRan: probeRan,
        probeOwnerTabId: probeOwnerTabId,
        ownership: response && response.granted === true ? 'granted' : 'denied',
        response: response,
        error: error ? { name: error.name, message: error.message, stack: error.stack } : null
      });
      sendResponse(response);
    };
    if (tabId == null) {
      respondClaim({ ok: false, error: 'invalid_tab' }, 'invalid-tab', false, null, null);
      return;
    }
    // Serialize claims in the service worker and reserve before replying.
    let probeRan = false;
    let probeOwnerTabId = null;
    musicClaimQueue = musicClaimQueue.then(async () => {
      if (musicOwnerTabId != null) {
        const result = { ok: true, granted: musicOwnerTabId === tabId, ownerTabId: musicOwnerTabId };
        respondClaim(result, 'existing-owner', false, null, null);
        return;
      }
      probeRan = true;
      const ownerTabId = await probePlayingMusic(tabId);
      probeOwnerTabId = ownerTabId;
      if (ownerTabId != null) {
        musicOwnerTabId = ownerTabId;
        await chrome.storage.session.set({ [MUSIC_OWNER_KEY]: ownerTabId });
        respondClaim({ ok: true, granted: false, ownerTabId }, 'probe-found-playing-tab', true, ownerTabId, null);
        return;
      }
      // Reserve before replying: another near-simultaneous claim sees this
      // reservation even if the winning tab has not called audio.play() yet.
      musicOwnerTabId = tabId;
      await chrome.storage.session.set({ [MUSIC_OWNER_KEY]: tabId });
      const result = { ok: true, granted: true, ownerTabId: tabId };
      respondClaim(result, 'no-other-playing-tab-reserved-requester', true, null, null);
    }).catch((error) => {
      const result = { ok: false, granted: false, error: 'probe_failed' };
      respondClaim(result, 'claim-exception', probeRan, probeOwnerTabId, error);
    });
    return true;
  }

  if (message && message.type === 'vm-music-check') {
    const tabId = musicMessageTabId(message, sender);
    if (tabId == null) {
      sendResponse({ ok: false, error: 'invalid_sender', playing: false });
      return;
    }
    musicClaimQueue = musicClaimQueue.then(async () => {
      if (musicOwnerTabId != null && musicOwnerTabId !== tabId) {
        const result = { ok: true, playing: true, ownerTabId: musicOwnerTabId };
        musicCoordLog('status-response', { tabId: tabId, response: result });
        sendResponse(result);
        return;
      }
      const ownerTabId = await probePlayingMusic(tabId);
      if (musicOwnerTabId != null && musicOwnerTabId !== ownerTabId) {
        sendResponse({ ok: true, playing: true, ownerTabId: musicOwnerTabId });
        return;
      }
      if (ownerTabId != null && musicOwnerTabId !== ownerTabId) {
        musicOwnerTabId = ownerTabId;
        await chrome.storage.session.set({ [MUSIC_OWNER_KEY]: ownerTabId });
      } else if (ownerTabId == null && musicOwnerTabId != null) {
        // Reconcile an abandoned reservation when no other page is actually playing.
        musicOwnerTabId = null;
        await chrome.storage.session.remove(MUSIC_OWNER_KEY);
      }
      const result = { ok: true, playing: ownerTabId != null, ownerTabId: ownerTabId };
      musicCoordLog('status-response', { tabId: tabId, response: result });
      sendResponse(result);
    }).catch((error) => { musicCoordLog('status-error', { tabId: tabId, message: error && error.message }); sendResponse({ ok: false, error: 'coordinator_failed', playing: false }); });
    return true;
  }

  if (!message || !message.action) return;

  if (message.action === 'openNotepadTab') {
    const fromTabId = sender.tab && typeof sender.tab.id === 'number' ? sender.tab.id : null;
    const fromWindowId = sender.tab && typeof sender.tab.windowId === 'number' ? sender.tab.windowId : null;
    let url = chrome.runtime.getURL('notepad.html');
    const qp = new URLSearchParams();
    if (fromTabId != null) {
      qp.set('fromTab', String(fromTabId));
      if (fromWindowId != null) qp.set('fromWindow', String(fromWindowId));
    }
    if (message.grantMic) qp.set('grantMic', '1');
    if (message.autoVoice) qp.set('autoVoice', '1');
    if (typeof message.workNoteId === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(message.workNoteId)) qp.set('workNote', message.workNoteId);
    const qs = qp.toString();
    if (qs) url += '?' + qs;
    chrome.tabs.create({ url })
      .then((tab) => sendResponse({ ok: true, tabId: tab && tab.id }))
      .catch((err) => sendResponse({ ok: false, error: String(err && err.message || err) }));
    return true;
  }

  if (message.action === 'ensureOffscreenDocument') {
    // موتور تبدیل صدا به متن — فقط مسئول ساختن Offscreen Document است، اگر از
    // قبل وجود نداشته باشد. تمام پیام‌های واقعی صدا (voiceStart/voiceStop/
    // voiceCancel و نتیجهٔ رونویسی) مستقیماً بین content.js و offscreen.js رد
    // و بدل می‌شوند، بدون واسطه‌گری این Service Worker.
    (async () => {
      try {
        const already = await chrome.offscreen.hasDocument();
        if (!already) {
          await chrome.offscreen.createDocument({
            url: chrome.runtime.getURL('offscreen.html'),
            reasons: ['USER_MEDIA'],
            justification: 'ضبط میکروفون و اجرای مدل آفلاین Whisper برای تایپ صوتی در دفترچه یادداشت'
          });
        }
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: String((err && err.message) || err) });
      }
    })();
    return true;
  }

  if (message.action === 'returnToParentTab') {
    const targetTabId = Number(message.tabId);
    const targetWindowId = message.windowId != null ? Number(message.windowId) : null;
    const notepadTabId = sender.tab && typeof sender.tab.id === 'number' ? sender.tab.id : null;

    (async () => {
      let focused = false;
      try {
        if (!Number.isNaN(targetTabId)) {
          if (targetWindowId != null && !Number.isNaN(targetWindowId)) {
            await chrome.windows.update(targetWindowId, { focused: true });
          }
          await chrome.tabs.update(targetTabId, { active: true });
          focused = true;
        }
      } catch (e) {}
      if (notepadTabId != null) {
        try { await chrome.tabs.remove(notepadTabId); } catch (e) {}
      }
      sendResponse({ ok: true, focused });
    })();
    return true;
  }

  if (message.action === 'translateText') {
    const targetLang = String(message.targetLang || 'en').slice(0, 8);
    const text = String(message.text || '').trim();
    if (!text) {
      sendResponse({ success: false, error: 'empty' });
      return;
    }
    if (text.length > 4500) {
      sendResponse({ success: false, error: 'too_long' });
      return;
    }

    // اول کش را چک کن — اگر همین متن/زبان اخیراً ترجمه شده، بدون هیچ فچی جواب بده
    const cacheKey = translateCacheKey(text, targetLang);
    const cached = translateCacheGet(cacheKey);
    if (cached) {
      sendResponse({ success: true, text: cached.text, synonyms: cached.synonyms, cached: true });
      return;
    }

    // dt=t: ترجمه اصلی — dt=bd: دیکشنری/مترادف‌ها (فقط برای کلمات/عبارات کوتاه پر می‌شود)
    const url =
      'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' +
      encodeURIComponent(targetLang) +
      '&dt=t&dt=bd&q=' +
      encodeURIComponent(text);

    fetchTranslateWithRetry(url, 3)
      .then((res) => res.json())
      .then((data) => {
        let translatedText = '';
        if (Array.isArray(data) && Array.isArray(data[0])) {
          data[0].forEach((item) => {
            if (item && item[0]) translatedText += item[0];
          });
        }
        if (!translatedText) throw new Error('empty_translation');

        // استخراج مترادف‌ها و نقش‌های دستوری از دیکشنری گوگل (data[1])
        const synonyms = [];
        if (Array.isArray(data[1])) {
          data[1].forEach((partOfSpeech) => {
            if (partOfSpeech && partOfSpeech[0] && Array.isArray(partOfSpeech[1]) && partOfSpeech[1].length > 0) {
              // دفاعی: بسته به فرمت واقعیِ پاسخ گوگل، هر عنصر ممکن است خودش
              // رشته باشد یا یک آرایه که عنصر اولش رشته است. اگر همیشه w[0]
              // فرض شود ولی w در واقع رشته باشد، فقط حرف اول کلمه گرفته
              // می‌شود (باگ) — این نسخه هر دو حالت را پوشش می‌دهد.
              const words = partOfSpeech[1]
                .slice(0, 6)
                .map((w) => (typeof w === 'string' ? w : (w && w[0])))
                .filter(Boolean);
              if (words.length > 0) synonyms.push({ type: partOfSpeech[0], words: words });
            }
          });
        }

        translateCacheSet(cacheKey, { text: translatedText, synonyms: synonyms });
        sendResponse({ success: true, text: translatedText, synonyms: synonyms });
      })
      .catch((error) => {
        const msg = String((error && error.message) || error);
        // بعد از تمام‌شدن تلاش‌های مجدد هم اگر باز ۴۲۹ یا خطای شبکه بود، کدِ
        // مشخصی برمی‌گردانیم تا content.js/notepad.js بتوانند پیامِ مناسبِ
        // همان حالت را نشان دهند، نه یک پیام عمومیِ یکسان برای همه‌چیز
        const isRateLimited = /HTTP 429/.test(msg);
        sendResponse({ success: false, error: isRateLimited ? 'rate_limited' : msg });
      });

    return true;
  }

  if (message.action === 'checkSpelling') {
    const text = String(message.text || '');
    if (!text) {
      sendResponse({ success: false, error: 'empty' });
      return;
    }
    // LanguageTool public API soft limit; keep payload modest
    if (text.length > 20000) {
      sendResponse({ success: false, error: 'too_long' });
      return;
    }
    const lang = String(message.lang || 'auto').slice(0, 16);

    const params = new URLSearchParams();
    params.append('text', text);
    params.append('language', lang);

    fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    })
      .then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then((data) => {
        const matches = (data && Array.isArray(data.matches)) ? data.matches : [];
        sendResponse({ success: true, matches: matches });
      })
      .catch((error) => {
        sendResponse({ success: false, error: String((error && error.message) || error) });
      });

    return true;
  }

  if (message.action === 'fetchGlobalHolidays') {
    const countryCode = String(message.countryCode || '').toUpperCase();
    const year = message.year;

    if (countryCode === 'IR') {
      getIranHolidaysList().then((result) => {
        sendResponse({ success: true, data: result.data, source: result.source });
      }).catch(() => {
        sendResponse({ success: true, data: IRAN_HOLIDAYS, source: 'iran-static' });
      });
      return true;
    }

    const cacheKey = holidaysCacheKeyFor(countryCode, year);
    chrome.storage.local.get([cacheKey], (res) => {
      if (res[cacheKey]) {
        sendResponse({ success: true, data: res[cacheKey], source: 'cache' });
        return;
      }
      fetch(`${NAGER_BASE_URL}/${year}/${countryCode}`)
        .then((r) => { if (!r.ok) throw new Error('Nager API request failed'); return r.json(); })
        .then((data) => {
          const holidays = mapNagerHolidays(data, countryCode);
          chrome.storage.local.set({ [cacheKey]: holidays });
          sendResponse({ success: true, data: holidays, source: 'nager' });
        })
        .catch((error) => sendResponse({ success: false, error: String((error && error.message) || error) }));
    });

    return true;
  }

  if (message.action === 'getIranHolidays') {
    getIranHolidaysList().then((result) => {
      sendResponse({ success: true, data: result.data, source: result.source });
    }).catch(() => {
      sendResponse({ success: true, data: IRAN_HOLIDAYS, source: 'iran-static' });
    });
    return true;
  }

  if (message.action === 'setIranHolidays') {
    const list = normalizeIranHolidayList(message.data || message.events);
    if (!list) {
      sendResponse({ success: false, error: 'invalid_list' });
      return false;
    }
    chrome.storage.local.set({ [IRAN_HOLIDAYS_STORAGE_KEY]: list }, () => {
      sendResponse({ success: true, count: list.length, source: 'iran-override' });
    });
    return true;
  }

  if (message.action === 'resetIranHolidays') {
    chrome.storage.local.remove(IRAN_HOLIDAYS_STORAGE_KEY, () => {
      getIranHolidaysList().then((result) => {
        sendResponse({ success: true, data: result.data, source: result.source, reset: true });
      });
    });
    return true;
  }
});


/* ======================================================================
   Void Music — Universal Audio Bridge (لایهٔ ۲): صدای واقعیِ تبِ موسیقی → Void Tab
   کاربر روی تبِ موسیقی میانبرِ «Alt+Shift+V» را می‌زند (این «فراخوانیِ افزونه» است و activeTab را برای همان تب می‌دهد).
   SW فقط شناسهٔ استریم را می‌گیرد و به Void Tab می‌دهد؛ دریافتِ صدا و تحلیل در خودِ Void Tab انجام می‌شود
   (consumerTabId)، پس نه offscreen لازم است نه صدایی از SW عبور می‌کند. هیچ صدایی ضبط/ذخیره/ارسال نمی‌شود.
   ====================================================================== */
(function () {
  /* §1.3 «کدام تب را capture کرده‌ایم» باید خوابیدن/مردنِ Service Worker را تاب بیاورد (همان الگوی
     musicOwnerTabId): در غیر این پس «بارِ دومِ میانبر روی همان تب = قطع» و toggle-off بعد از
     راه‌اندازیِ دوبارهٔ SW کار نمی‌کند. تنها یک شناسهٔ عددی ذخیره می‌شود؛ هیچ صدایی نه
     ضبط می‌شود نه از دستگاه بیرون می‌رود. */
  var CAP_TARGET_KEY = 'voidMusicCaptureTargetTabId';
  var capTarget = null;
  var capReady = chrome.storage.session.get(CAP_TARGET_KEY).then(function (stored) {
    var saved = stored && stored[CAP_TARGET_KEY];
    if (!Number.isInteger(saved)) return;
    return chrome.tabs.get(saved).then(function () { capTarget = saved; },
      function () { return chrome.storage.session.remove(CAP_TARGET_KEY); });
  }).catch(function () {});
  function setCapTarget(id, why) {
    capTarget = Number.isInteger(id) ? id : null;
    try {
      var p = capTarget != null ? chrome.storage.session.set({ voidMusicCaptureTargetTabId: capTarget })
                                : chrome.storage.session.remove(CAP_TARGET_KEY);
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
    try { console.info('[VoidMusicCapture]', 'capTarget=' + capTarget, why || ''); } catch (e) {}
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function voidTabIds() {
    var base = chrome.runtime.getURL('void-tab.html');
    return chrome.runtime.getContexts({ contextTypes: ['TAB'] }).then(function (ctxs) {
      return (ctxs || []).filter(function (c) { return c.documentUrl && c.documentUrl.indexOf(base) === 0 && c.tabId >= 0; })
        .map(function (c) { return c.tabId; });
    });
  }
  async function findVoidTab() {
    try {
      var hit = await voidTabIds();
      return hit.length ? hit[hit.length - 1] : null;
    } catch (e) { return null; }
  }
  /* §1.4 مصرف‌کنندهٔ میانبر: قبلاً همیشه «آخرین Void Tab» بود، پس صدای تبِ موسیقی به
     Void Tabِ پنجرهٔ دیگری می‌رفت. حالا مثلِ resolveConsumer عمل می‌کند: اول تبِ فعالِ
     پنجرهٔ متمرکز، بعد هر Void Tab همان پنجره، و تنها در نبودِ آن‌ها آخرین Void Tab. */
  async function pickVoidTab() {
    var hits; try { hits = await voidTabIds(); } catch (e) { return null; }
    if (!hits || !hits.length) return null;
    try {
      var wins = await chrome.windows.getAll({ populate: true });
      var focus = null;
      for (var i = 0; i < (wins || []).length; i++) if (wins[i] && wins[i].focused) { focus = wins[i]; break; }
      if (focus && focus.tabs) {
        for (var j = 0; j < focus.tabs.length; j++) {
          var tb = focus.tabs[j];
          if (tb && tb.active && hits.indexOf(tb.id) >= 0) return tb.id;
        }
        for (var k = focus.tabs.length - 1; k >= 0; k--) {
          var t2 = focus.tabs[k];
          if (t2 && hits.indexOf(t2.id) >= 0) return t2.id;
        }
      }
    } catch (e) {}
    return hits[hits.length - 1];
  }
  async function ensureVoidTab() {
    var id = await pickVoidTab();
    if (id != null) return id;
    try { await chrome.tabs.create({ url: 'chrome://newtab/', active: false }); } catch (e) { return null; }
    for (var i = 0; i < 40; i++) { await sleep(150); id = await pickVoidTab(); if (id != null) return id; }
    return null;
  }
  async function sendWithRetry(tabId, msg) {
    for (var i = 0; i < 25; i++) {
      try {
        var r = await chrome.tabs.sendMessage(tabId, msg);
        if (r && r.ok !== undefined) return r.ok;
      } catch (e) { /* صفحه هنوز گوش نمی‌دهد */ }
      await sleep(250);
    }
    return false;
  }
  chrome.commands.onCommand.addListener(async function (command, tab) {
    if (command !== 'vm-capture-tab') return;
    await capReady;                                              // §1.3 SW تازه بالا آمده: اول capTarget را از storage.session بخوان
    if (!tab || tab.id == null) { try { tab = (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]; } catch (e) {} }
    if (!tab || tab.id == null) return;
    var voidId = await ensureVoidTab();
    if (voidId == null || voidId === tab.id) return;
    if (capTarget === tab.id) {                                   // بار دوم روی همان تب = قطع
      setCapTarget(null, 'shortcut_toggle_off');
      /* stop به همهٔ Void Tabها: ممکن است صدای قبلی در تبِ دیگری نشسته باشد (چند پنجره)؛
         آن‌که capture نداشته باشد بی‌اثر رد می‌شود. وگرنه چیپِ «live» روی تبِ دیگر گیر می‌کند. */
      try { var ids = await voidTabIds(); for (var q = 0; q < ids.length; q++) { try { await chrome.tabs.sendMessage(ids[q], { type: 'vm-capture-stop' }); } catch (e) {} } } catch (e) {}
      return;
    }
    var streamId;
    try { streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id, consumerTabId: voidId }); }
    catch (e) { return; }                                         // صفحه‌های محدود (chrome://، فروشگاه) اجازه نمی‌دهند
    setCapTarget(tab.id, 'shortcut_start');
    var host = ''; try { host = new URL(tab.url || '').hostname.replace(/^www\./, ''); } catch (e) {}
    try { var vt = await chrome.tabs.get(voidId); await chrome.windows.update(vt.windowId, { focused: true }); await chrome.tabs.update(voidId, { active: true }); } catch (e) {}
    var ok = await sendWithRetry(voidId, { type: 'vm-capture-start', streamId: streamId, tabId: tab.id, host: host, title: tab.title || '' });
    if (!ok) setCapTarget(null, 'shortcut_send_failed');
  });
  chrome.runtime.onMessage.addListener(function (m) { if (m && m.type === 'vm-capture-ended') setCapTarget(null, 'consumer_released'); });

  /* ---- درخواستِ صوت از خودِ Void Tab (لایهٔ ۲، بدونِ میانبر) ----
     Void Tab تبِ موسیقی را شناسایی کرده و stream می‌خواهد. هیچ تبِ تازه‌ای نمی‌سازیم:
     consumer باید همان صفحه‌ای باشد که درخواست کرده (consumerTabId) و نشانی‌اش void-tab.html باشد؛
     در نبودِ آن، آخرین Void Tab موجود. شکست را صریح با reason برمی‌گردانیم تا صفحه وضعیت «خطا» را ببیند. */
  async function resolveConsumer(requested, sender) {
    var fromSender = sender && sender.tab && Number.isInteger(sender.tab.id) && isVoidTabUrl(sender.tab.url) ? sender.tab.id : null;
    if (fromSender != null) return fromSender;
    if (Number.isInteger(requested) && requested >= 0) {
      try {
        var t = await chrome.tabs.get(requested);
        if (t && t.url && isVoidTabUrl(t.url)) return requested;
      } catch (e) { /* بسته شده */ }
    }
    return await findVoidTab();
  }
  async function handleCaptureRequest(m, sender) {
    var tabId = Number.isInteger(m && m.tabId) ? m.tabId : null;
    if (tabId == null || tabId < 0) return { ok: false, reason: 'bad_tab' };
    var voidId = await resolveConsumer(m && m.consumerTabId, sender);
    if (voidId == null) return { ok: false, reason: 'no_void_tab' };
    if (voidId === tabId) return { ok: false, reason: 'self' };
    var t; try { t = await chrome.tabs.get(tabId); } catch (e) { return { ok: false, reason: 'tab_gone' }; }
    if (!t || !t.url || !/^https?:/i.test(t.url)) return { ok: false, reason: 'restricted_page' };
    var streamId;
    try { streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId, consumerTabId: voidId }); }
    catch (e) { return { ok: false, reason: 'capture_denied' }; }
    setCapTarget(tabId, 'page_request');
    var host = ''; try { host = new URL(t.url).hostname.replace(/^www\./, ''); } catch (e) {}
    return { ok: true, streamId: streamId, tabId: tabId, host: host, title: t.title || '' };
  }
  chrome.runtime.onMessage.addListener(function (m, sender, reply) {
    if (!m || m.type !== 'vm-capture-request') return;
    handleCaptureRequest(m, sender).then(function (r) { try { reply(r); } catch (e) {} },
      function () { try { reply({ ok: false, reason: 'error' }); } catch (e) {} });
    return true;
  });
  chrome.tabs.onRemoved.addListener(function (id) {
    if (capTarget === id) {
      setCapTarget(null, 'target_tab_closed');
      /* stop به همهٔ Void Tabها، نه فقط «آخرین»: آن‌که capture ندارد بی‌اثر رد می‌شود. */
      voidTabIds().then(function (ids) {
        ids.forEach(function (v) { try { chrome.tabs.sendMessage(v, { type: 'vm-capture-stop' }).catch(function () {}); } catch (e) {} });
      }).catch(function () {});
    }
  });
})();


/* ======================================================================
   Browser toolbar indicator for the actual per-tab floating launcher state.
   The default manifest icon stays untouched; only tabs reporting a visible
   launcher receive the composed active icon.
   ====================================================================== */
var VOID_LAUNCHER_ACTION_ICONS = {
  inactive: { 16: 'icons/icon16.png', 32: 'icons/icon32.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' },
  active: { 16: 'icons/icon16-active.png', 32: 'icons/icon32-active.png', 48: 'icons/icon48-active.png', 128: 'icons/icon128-active.png' }
};
function setVoidLauncherActionIcon(tabId, visible) {
  if (!Number.isInteger(tabId) || tabId < 0 || !chrome.action || typeof chrome.action.setIcon !== 'function') return;
  try {
    var result = chrome.action.setIcon(
      { tabId: tabId, path: visible ? VOID_LAUNCHER_ACTION_ICONS.active : VOID_LAUNCHER_ACTION_ICONS.inactive },
      function () { void chrome.runtime.lastError; }
    );
    if (result && typeof result.catch === 'function') result.catch(function () {});
  } catch (e) {}
}
(function () {
  if (!chrome.action || typeof chrome.action.setIcon !== 'function') return;
  function queryTab(tabId) {
    if (!Number.isInteger(tabId) || tabId < 0) return;
    try {
      chrome.tabs.sendMessage(tabId, { type: 'void-launcher-visibility-query' }, function (response) {
        var failed = !!chrome.runtime.lastError;
        if (failed || !response || response.ready !== true || typeof response.visible !== 'boolean') {
          setVoidLauncherActionIcon(tabId, false);
          return;
        }
        setVoidLauncherActionIcon(tabId, response.visible);
      });
    } catch (e) { setVoidLauncherActionIcon(tabId, false); }
  }
  function refreshOpenTabs() {
    try {
      chrome.tabs.query({}, function (tabs) {
        if (chrome.runtime.lastError || !Array.isArray(tabs)) return;
        tabs.forEach(function (tab) { if (tab && Number.isInteger(tab.id)) queryTab(tab.id); });
      });
    } catch (e) {}
  }

  chrome.runtime.onMessage.addListener(function (message, sender) {
    if (!message || message.type !== 'void-launcher-visibility' || typeof message.visible !== 'boolean') return;
    if (!sender || sender.id !== chrome.runtime.id || !sender.tab || !Number.isInteger(sender.tab.id)) return;
    setVoidLauncherActionIcon(sender.tab.id, message.visible);
  });
  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {
    if (changeInfo && changeInfo.status === 'loading') setVoidLauncherActionIcon(tabId, false);
    else if (changeInfo && changeInfo.status === 'complete') queryTab(tabId);
  });
  chrome.tabs.onActivated.addListener(function (activeInfo) { if (activeInfo) queryTab(activeInfo.tabId); });
  chrome.runtime.onStartup.addListener(refreshOpenTabs);
  chrome.runtime.onInstalled.addListener(refreshOpenTabs);
})();

/* ======================================================================
   Launcher on websites — mode-based, on-demand injection (default: off everywhere)
   ----------------------------------------------------------------------
   AI Orbit Launcher (content.js + helpers) is NOT in manifest content_scripts.
   One global mode (storage key voidLauncherMode) decides where it is registered/injected:
     'off'      → nowhere (default)
     'all'      → every ordinary http(s) site except the ones in voidLauncherExcluded
     'selected' → only the sites in voidLauncherSites
   Site lists hold match patterns like "https://example.com/*". Changes apply to already-open
   tabs at once. Music Orb (void-music-remote.js) and the media hook/bridge are unaffected.
   ====================================================================== */
(function () {
  if (!chrome.scripting || !chrome.scripting.registerContentScripts) return;   // permission missing: leave the rest of the worker alone
  var MODE_KEY = 'voidLauncherMode', SITES_KEY = 'voidLauncherSites', EXCL_KEY = 'voidLauncherExcluded';
  var SCRIPT_ID = 'void-launcher-sites';
  var LAUNCHER_CSS = ['styles.css', 'toolbar-zen.css'];
  var LAUNCHER_JS = ['i18n.js', 'calendar-engine.js', 'memory-engine.js', 'quote-engine.js', 'voice-engine.js',
    'toolbar-icons.js', 'toolbar-dock.js', 'launcher-sound.js', 'firework-sky.js', 'content.js'];
  var ALWAYS_EXCLUDE = ['*://accounts.google.com/*', '*://appleid.apple.com/*', '*://login.microsoftonline.com/*',
    '*://login.live.com/*', '*://chromewebstore.google.com/*', '*://chrome.google.com/webstore/*'];
  var MODES = ['off', 'all', 'selected'];
  var queue = Promise.resolve();

  function serial(fn) {
    var run = queue.then(function () { return fn(); });
    queue = run.catch(function () {});
    return run;
  }
  function patternFor(url) {
    var u; try { u = new URL(url); } catch (e) { return null; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    var h = u.hostname.toLowerCase();
    if (/(^|\.)accounts\.google\.com$/.test(h) || /(^|\.)appleid\.apple\.com$/.test(h) ||
        /(^|\.)login\.microsoftonline\.com$/.test(h) || /(^|\.)login\.live\.com$/.test(h)) return null;
    if (h === 'chromewebstore.google.com') return null;
    if (h === 'chrome.google.com' && u.pathname.indexOf('/webstore') === 0) return null;
    return u.protocol + '//' + u.hostname + '/*';
  }
  function cleanList(v) {
    if (!Array.isArray(v)) return [];
    var out = [];
    v.forEach(function (p) { if (typeof p === 'string' && /^https?:\/\/[^\/*]+\/\*$/.test(p) && out.indexOf(p) < 0) out.push(p); });
    return out;
  }
  function readState() {
    return chrome.storage.local.get([MODE_KEY, SITES_KEY, EXCL_KEY]).then(function (r) {
      r = r || {};
      return { mode: MODES.indexOf(r[MODE_KEY]) >= 0 ? r[MODE_KEY] : 'off', sites: cleanList(r[SITES_KEY]), excluded: cleanList(r[EXCL_KEY]) };
    });
  }
  function writeState(s) {
    var o = {}; o[MODE_KEY] = s.mode; o[SITES_KEY] = s.sites; o[EXCL_KEY] = s.excluded;
    return chrome.storage.local.set(o);
  }
  function effective(s, pattern) {
    if (!pattern) return false;
    if (s.mode === 'all') return s.excluded.indexOf(pattern) < 0;
    if (s.mode === 'selected') return s.sites.indexOf(pattern) >= 0;
    return false;
  }
  function describe(s, pattern) {
    return { ok: true, mode: s.mode, sites: s.sites.length, excluded: s.excluded.length, supported: !!pattern, siteOn: effective(s, pattern) };
  }
  function syncRegistration() {
    return serial(async function () {
      var s = await readState();
      var existing = [];
      try { existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] }); } catch (e) {}
      var matches = s.mode === 'all' ? ['http://*/*', 'https://*/*'] : (s.mode === 'selected' ? s.sites : []);
      if (!matches.length) {
        if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
        return s;
      }
      var def = { id: SCRIPT_ID, matches: matches, excludeMatches: ALWAYS_EXCLUDE.concat(s.mode === 'all' ? s.excluded : []),
                  css: LAUNCHER_CSS, js: LAUNCHER_JS, runAt: 'document_idle', allFrames: false, persistAcrossSessions: true };
      if (existing.length) await chrome.scripting.updateContentScripts([def]);
      else await chrome.scripting.registerContentScripts([def]);
      return s;
    });
  }
  /* Self-healing: after the extension is reloaded (or updated) a tab can keep an OLD copy of the launcher:
     its DOM is still there (maybe hidden) but its script is dead, so it can neither be revealed nor hidden by
     messages, and content.js refuses to mount a second copy while the old root exists. We detect that with a
     read-only ping, clear the dead copy and inject a fresh one. */
  var ROOT_IDS = ['ai-orbit-root', 'ai-inline-form', 'ai-quick-note-form', 'ai-calc-panel', 'ai-clock-panel',
    'ai-todo-panel', 'ai-search-panel', 'ai-tier-dots', 'ai-hub-dots', 'ai-star-editor-popup'];
  function domProbe() { var r = document.getElementById('ai-orbit-root'); return { root: !!r, visible: !!r && r.style.display !== 'none' }; }
  function domPurge(ids) {
    ids.forEach(function (id) { var n = document.getElementById(id); if (n && n.parentNode) n.parentNode.removeChild(n); });
    var t = document.querySelectorAll('.ai-toast-notification');
    for (var i = 0; i < t.length; i++) if (t[i].parentNode) t[i].parentNode.removeChild(t[i]);
    return true;
  }
  function domForceShow() { var r = document.getElementById('ai-orbit-root'); if (!r) return false; if (r.style.display === 'none') r.style.display = ''; return r.style.display !== 'none'; }
  function ping(tabId) {   // "getBookmarkBackups" is a read-only content.js action that answers with {backups:[…]}
    var asked = chrome.tabs.sendMessage(tabId, { action: 'getBookmarkBackups' }).then(
      function (r) { return !!(r && Array.isArray(r.backups)); }, function () { return false; });
    var timeout = new Promise(function (res) { setTimeout(function () { res(false); }, 1500); });
    return Promise.race([asked, timeout]);
  }
  async function probe(tabId) {
    try { var r = await chrome.scripting.executeScript({ target: { tabId: tabId }, func: domProbe }); return (r && r[0] && r[0].result) || null; }
    catch (e) { return null; }   // null = this page cannot be inspected
  }
  async function showNow(tab) {
    if (!tab || tab.id == null) return { ok: false, reason: 'bad_tab' };
    setVoidLauncherActionIcon(tab.id, false);    // wait for the content script's confirmed visible state
    if (tab.status !== 'complete') return { ok: true, injected: false, pending: true };   // the registered script injects when it finishes loading
    var p = await probe(tab.id);
    if (!p) return { ok: false, reason: 'inject_denied' };
    if (p.root) {
      if (await ping(tab.id)) {   // a live copy is mounted (hidden earlier): reveal it, never inject twice
        try { await chrome.tabs.sendMessage(tab.id, { action: 'resetFloatingMenuPositionAnly' }); } catch (e) {}
        try {
          var f = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: domForceShow });
          if (f && f[0] && f[0].result === false) return { ok: false, reason: 'still_hidden' };
        } catch (e) {}
        return { ok: true, injected: false };
      }
      try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: domPurge, args: [ROOT_IDS] }); }   // dead copy from an older extension load
      catch (e) { return { ok: false, reason: 'inject_denied' }; }
    }
    try {
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: LAUNCHER_CSS });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: LAUNCHER_JS });
    } catch (e) { return { ok: false, reason: 'inject_failed' }; }
    return { ok: true, injected: true, repaired: !!p.root };
  }
  async function hideNow(tab) {
    if (tab && Number.isInteger(tab.id)) setVoidLauncherActionIcon(tab.id, false);
    if (await ping(tab.id)) { try { await chrome.tabs.sendMessage(tab.id, { action: 'hideLauncherAnly' }); } catch (e) {} return; }
    var p = await probe(tab.id);
    if (p && p.root) { try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: domPurge, args: [ROOT_IDS] }); } catch (e) {} }   // dead copy: remove it
  }
  async function applyToTabs(s, urlFilter, activeTab) {
    var list = [];
    try { list = await chrome.tabs.query({ url: urlFilter }); } catch (e) { return null; }
    var activeResult = null;
    for (var i = 0; i < list.length; i++) {
      var t = list[i], p = patternFor(t.url);
      if (!p) continue;
      var res = effective(s, p) ? await showNow(t) : (await hideNow(t), null);
      if (activeTab && t.id === activeTab.id) activeResult = res;
    }
    return activeResult;
  }
  async function handle(m) {
    var tab = null;
    if (Number.isInteger(m.tabId)) { try { tab = await chrome.tabs.get(m.tabId); } catch (e) { tab = null; } }
    var pattern = tab ? patternFor(tab.url) : null;      // derived from the real tab, never from the message
    var s = await readState();
    if (m.op === 'status') return describe(s, pattern);
    if (m.op === 'setMode') {
      if (MODES.indexOf(m.mode) < 0) return { ok: false, reason: 'bad_mode' };
      s.mode = m.mode;
      await writeState(s); await syncRegistration();
      var ar = await applyToTabs(s, ['http://*/*', 'https://*/*'], tab);
      var out = describe(s, pattern); if (ar && ar.pending) out.pending = true; if (ar && !ar.ok) out.warn = ar.reason;
      return out;
    }
    if (m.op === 'toggleSite') {
      if (!pattern) return { ok: false, reason: 'unsupported_page' };
      var on = !!m.on;
      if (on) {
        if (s.mode === 'off') s.mode = 'selected';          // first "show here" while everything is off switches to "chosen sites"
        if (s.mode === 'selected') { if (s.sites.indexOf(pattern) < 0) s.sites.push(pattern); }
        else s.excluded = s.excluded.filter(function (p) { return p !== pattern; });
      } else {
        if (s.mode === 'selected') s.sites = s.sites.filter(function (p) { return p !== pattern; });
        else if (s.mode === 'all' && s.excluded.indexOf(pattern) < 0) s.excluded.push(pattern);
      }
      await writeState(s); await syncRegistration();
      var ar2 = await applyToTabs(s, pattern, tab);       // every open tab of this site
      var out2 = describe(s, pattern); if (ar2 && ar2.pending) out2.pending = true; if (ar2 && !ar2.ok) out2.warn = ar2.reason;
      return out2;
    }
    return { ok: false, reason: 'bad_op' };
  }
  chrome.runtime.onMessage.addListener(function (m, sender, reply) {
    if (!m || m.type !== 'vm-launcher-site') return;
    if (!sender || sender.id !== chrome.runtime.id || sender.tab) { try { reply({ ok: false, reason: 'forbidden' }); } catch (e) {} return; }   // popup only
    handle(m).then(function (r) { try { reply(r); } catch (e) {} },
                   function () { try { reply({ ok: false, reason: 'error' }); } catch (e) {} });
    return true;
  });
  chrome.runtime.onInstalled.addListener(function () { syncRegistration().catch(function () {}); });
  chrome.runtime.onStartup.addListener(function () { syncRegistration().catch(function () {}); });
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'local' && (changes[MODE_KEY] || changes[SITES_KEY] || changes[EXCL_KEY])) syncRegistration().catch(function () {});
  });
})();
