/* ======================================================================
   Void Tab — Music Mode  (فاز ۱: هستهٔ پخش + کنترل‌های Stage 0)

   اصول:
   • <audio> مالکِ پخش است؛ فاز ۱ هیچ AudioContext/آنالیزی نمی‌سازد
     (گرافِ Web Audio در فاز ۲، موقعِ اولین Play ساخته می‌شود).
   • هیچ حلقهٔ rAF ندارد؛ پیشرفتِ زمان فقط با رویدادهای timeupdate (~۴Hz).
   • ترتیبِ پخش «کیسهٔ تصادفی» است: هر آهنگ یک بار، بدونِ تکرار، و هر بار
     (هر ورود به Music Mode) ترتیبِ تازه. seed تازه برای هر آهنگ، آمادهٔ
     فازهای بعدی (رویداد voidmusic:track).
   • نسخهٔ بدونِ build، بدونِ وابستگی. فقط وقتی کاربر منو را بزند ساخته می‌شود.
   ====================================================================== */
(function () {
  'use strict';
  if (window.VoidMusic) return;

  const NS = 'http://www.w3.org/2000/svg';
  const EXT = /\.(mp3|m4a|aac|ogg|oga|opus|flac|wav|weba)$/i;
  const PICKER_TYPES = [{
    description: 'Audio',
    accept: { 'audio/*': ['.mp3', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.flac', '.wav', '.weba'] }
  }];
  /* پوشه‌ها بدونِ سقفِ فایل بررسی می‌شوند: کاربر ممکن است هزاران فایل داشته باشد.
     تنها ترمز، عمقِ تودرتو است (سقفِ فایل = حذفِ خاموشِ موسیقی، که دقیقاً همان چیزی است
     که «فایل پیدا نشد» را می‌سازد). هر چیزی که بررسی نشد شمارش و گزارش می‌شود. */
  const SCAN_MAX_DEPTH = 12;
  const FAIL_STREAK_MAX = 12;    // پس از این تعداد خرابیِ پشت‌سرهم، چرخهٔ خودکارِ «بعدی» متوقف می‌شود
  const VOL_KEY = 'voidMusic.volume';
  const SINGLE_TAB_DIAGNOSTIC = new URLSearchParams(location.search).get('voidMusicSingleTabTest') === '1';
  function playbackLog(event, detail) {
    try { console.info('[VoidMusicPlayback]', new Date().toISOString(), event, detail || ''); } catch (e) {}
  }
  if (SINGLE_TAB_DIAGNOSTIC) playbackLog('single-tab-test-mode-enabled', { warning: 'Use only in an isolated Chrome profile; cross-tab claims and status are bypassed.' });

  const EN = {
    ntpMenuMusic: 'Music Mode', voidMusicOpen: 'Open music', voidMusicAddFiles: 'Add files',
    voidMusicAddFolder: 'Add folder', voidMusicPlay: 'Play', voidMusicPause: 'Pause',
    voidMusicPrev: 'Previous track', voidMusicNext: 'Next track', voidMusicVolume: 'Volume',
    voidMusicQueue: 'Queue', voidMusicClose: 'Close Music Mode', voidMusicSeek: 'Seek',
    voidMusicRemove: 'Remove from queue', voidMusicDrop: 'Release to add music',
    voidMusicUnsupported: "This file can't be played", voidMusicMissing: 'File not found or access denied',
    voidMusicAlreadyPlaying: 'Music is already playing in another tab.',
    voidMusicSwitchToPlayingTab: 'Switch to the playing tab',
    voidMusicPlaybackCheckFailed: 'Could not verify playback in other tabs. Please try again.',
    voidMusicRetry: 'Retry',
    voidMusicFullscreen: 'Full screen', voidMusicExitFullscreen: 'Exit full screen',
    voidMusicShowWidget: 'Show extension widget', voidMusicHideWidget: 'Hide extension widget'
  };
  // پیش‌فرض انگلیسیِ کلیدهای جستجو/شافل (ترجمهٔ ۱۲ زبانه در i18n.js است)
  EN.voidMusicSearch = 'Search tracks'; EN.voidMusicSearchClear = 'Clear search'; EN.voidMusicNoResults = 'No matching tracks';
  EN.voidMusicShuffle = 'Shuffle'; EN.voidMusicShuffleOn = 'Shuffle on'; EN.voidMusicShuffleOff = 'Shuffle off';
  Object.assign(EN, {
    voidMusicSound: 'Sound and picture', voidMusicEqualizer: 'Equalizer', voidMusicPreset: 'Preset', voidMusicPreamp: 'Preamp', voidMusicLimiter: 'Limiter', voidMusicAutoGain: 'Auto gain',
    voidMusicBgMode: 'When this tab is in the background', voidMusicBgAudio: 'Audio only', voidMusicBgLive: 'Live visuals', voidMusicVisQuality: 'Visual quality',
    voidMusicQAuto: 'Auto', voidMusicQLow: 'Low', voidMusicQHigh: 'High', voidMusicResetSound: 'Reset',
    voidMusicPrFlat: 'Flat', voidMusicPrBass: 'Bass boost', voidMusicPrTreble: 'Treble boost', voidMusicPrVocal: 'Vocal', voidMusicPrRock: 'Rock', voidMusicPrPop: 'Pop',
    voidMusicPrJazz: 'Jazz', voidMusicPrClassical: 'Classical', voidMusicPrElectronic: 'Electronic', voidMusicPrLounge: 'Lounge', voidMusicPrCustom: 'Custom',
    voidMusicRate: 'Rate this track', voidMusicRateN: '{n} of 5 stars',
    voidMusicWebSource: 'Web player', voidMusicWebPlaying: 'Playing from {site}', voidMusicWebHint: 'For live reactive visuals press Alt+Shift+V on that tab',
    voidMusicWebCaptureOn: 'Live audio linked', voidMusicWebCaptureOff: 'Live audio stopped',
    voidMusicWebAudioLive: 'Live audio linked', voidMusicWebAudioPending: 'Linking audio…', voidMusicWebAudioNone: 'Detected — no live audio',
    voidMusicWebAudioFailed: 'Audio link failed', voidMusicWebSiteBlocked: 'This site does not allow tab audio',
    voidMusicWebRetry: 'Click to retry', voidMusicWebPaused: 'Paused', voidMusicClock: 'Local time',
    voidMusicWebAnLive: 'The galaxy is reacting to this audio', voidMusicWebAnSilent: 'Audio stream linked but silent — no signal',
    voidMusicWebAnUntapped: 'Analyzers detached — the visuals are not reading the audio', voidMusicWebAnSuspended: 'The browser held the audio — one click on this page starts it',
    voidMusicWebAnBuilding: 'Building the audio graph…', voidMusicWebAnFailed: 'The audio graph could not start',
    voidMusicWebAnNoStream: 'No audio stream reaches the visual engine',
    voidMusicTipAddFiles: 'Add audio files to the queue', voidMusicTipAddFolder: 'Add every audio file in a folder; nothing is copied unless you ask',
    voidMusicTipKeepCopy: 'Keep a private copy of each track so playback never needs the folder again', voidMusicTipShuffle: 'Play the queue in random order',
    voidMusicTipSound: 'Equalizer, limiter, background mode and galaxy quality', voidMusicTipVolume: 'Playback volume for this tab',
    voidMusicTipSeek: 'Drag, click or use the arrow keys to move through the track', voidMusicTipSndOn: 'Turn the equalizer and limiter on or off',
    voidMusicTipSndReset: 'Restore the flat curve, the preset and the defaults', voidMusicTipPreset: 'Pick a starting EQ curve',
    voidMusicTipPreamp: 'Gain applied before the equalizer', voidMusicTipLimiter: 'Catches the peaks so loud tracks stop clipping',
    voidMusicTipAutoGain: 'Keeps the loudness steady between tracks', voidMusicTipBgAudio: 'Keep the audio playing and freeze the visuals',
    voidMusicTipBgLive: 'Keep the galaxy reacting while the tab is in the background', voidMusicTipQAuto: 'Chooses the galaxy quality from the measured frame rate',
    voidMusicTipQLow: 'Fewer particles — the lightest option', voidMusicTipQHigh: 'Maximum detail — needs a strong GPU',
    voidMusicTipEqBand: '{hz} band — drag up or down, or use the arrow keys', voidMusicTipSpectrum: 'Live spectrum of the track being analysed'
  });
  /* دلیل‌های جدا برای «صوت بالا نیامد»: سقفِ فایل حذف شد، پس حالا باید صادق بگوییم کدام علت بوده */
  Object.assign(EN, {
    voidMusicErrPrompt: 'Access to this folder has not been granted yet', voidMusicErrDenied: 'Access to this folder was denied',
    voidMusicErrGone: 'This file is no longer in the folder', voidMusicErrUnreadable: 'This file could not be read',
    voidMusicErrNoRoot: 'The folder this track came from is no longer known', voidMusicGrantAction: 'Click to grant access',
    voidMusicRegrantOk: 'Access granted — playback continues', voidMusicAddedN: '{n} tracks added',
    voidMusicSkippedOther: '{n} non-audio files skipped', voidMusicScanDeep: '{n} folders were too deep to scan',
    voidMusicScanError: '{n} folders could not be read', voidMusicFailStreak: '{n} files in a row failed to load; auto-advance stopped',
    voidMusicPermRoots: '{n} folders need your permission before they can play'
  });
  function L(key) {
    try {
      if (typeof t === 'function') { const v = t(key); if (v && v !== key) return v; }
    } catch (e) {}
    return EN[key] || key;
  }

  /* ------------------------------------------------------------------ */
  /* حالت                                                                 */
  /* ------------------------------------------------------------------ */
  const S = {
    open: false, built: false,
    tracks: [],              // {id,name,title,artist,file,handle,bad}
    curId: null, bag: [], history: [],
    audio: null, url: null, coverUrl: null,
    seed: 0, token: 0, failures: 0, failStreak: 0, grantAdvised: false, grantTrack: null, permRoots: 0, toastLog: [], scan: null,
    libLoaded: false, savedTitle: null,
    dragging: false, dragFrac: 0,
    vol: 0.8, muted: false, outGain: null,
    mini: null, fsByUs: false, widgetShown: false, widgetWasVisible: true, ptrDown: false,
    roots: new Map(), permCache: new Map(), copyMode: false, copyDone: 0, copyTotal: 0, swept: [],
    shuffle: false, query: '', starsFor: null, flownId: null, starsTimer: 0,
    web: null, localAudio: null, webKey: '', curIdBeforeWeb: null, webChipState: null
  };
  // پخش تصادفی: پیش‌فرض خاموش (ترتیبِ فهرست). برای برگرداندنِ رفتارِ قدیمی (همیشه تصادفی) این را true کن.
  const SHUFFLE_DEFAULT = false, SHUF_KEY = 'voidMusic.shuffle';
  try { const sv = localStorage.getItem(SHUF_KEY); S.shuffle = sv === null ? SHUFFLE_DEFAULT : sv === '1'; } catch (e) { S.shuffle = SHUFFLE_DEFAULT; }
  let root, dock, els = {};

  /* ------------------------------------------------------------------ */
  /* ابزارها                                                              */
  /* ------------------------------------------------------------------ */
  function rand32() { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0]; }
  function randInt(n) { return n <= 1 ? 0 : rand32() % n; }
  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); const x = a[i]; a[i] = a[j]; a[j] = x; }
    return a;
  }
  function uid() { try { return crypto.randomUUID(); } catch (e) { return 'm' + rand32().toString(36) + Date.now().toString(36); } }
  function fmt(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    sec = Math.floor(sec);
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function nameToTitle(name) {
    return String(name || '').replace(/\.[^.]+$/, '').replace(/^\s*\d{1,3}\s*[-._)]\s*/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim() || name;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  // نرمال‌سازیِ جستجو: حروف کوچک، بدون اعراب/کشیده/نیم‌فاصله، «ي ك» عربی ← «ی ک» فارسی، ارقامِ فارسی/عربی ← لاتین
  function normQ(str) {
    let x = String(str || '').toLowerCase();
    try { x = x.normalize('NFKD'); } catch (e) {}
    return x.replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640\u200c\u200d]/g, '')
      .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/\u0629/g, '\u0647')
      .replace(/[\u06f0-\u06f9]/g, function (d) { return String(d.charCodeAt(0) - 0x06f0); })
      .replace(/[\u0660-\u0669]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      .replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function el(tag, cls, attrs) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function svg(tag, attrs, cls) {
    const n = document.createElementNS(NS, tag);
    if (cls) n.setAttribute('class', cls);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function icon(paths, cls) {
    const s = svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' }, 'vm-ico' + (cls ? ' ' + cls : ''));
    paths.forEach(function (d) { s.appendChild(svg('path', { d: d })); });
    return s;
  }
  const ICON = {
    play: ['M8.5 5.5 L18.5 12 L8.5 18.5 Z'],
    pause: ['M9 6 V18', 'M15 6 V18'],
    prev: ['M6.5 6 V18', 'M18 6.5 L9.5 12 L18 17.5 Z'],
    next: ['M17.5 6 V18', 'M6 6.5 L14.5 12 L6 17.5 Z'],
    vol: ['M5 10 V14 H8 L12.5 17.5 V6.5 L8 10 Z'],
    waves: ['M15.6 9.4 A4 4 0 0 1 15.6 14.6', 'M18.2 7 A7.4 7.4 0 0 1 18.2 17'],
    slash: ['M16 9.5 L21 14.5', 'M21 9.5 L16 14.5'],
    queue: ['M5 7 H19', 'M5 12 H19', 'M5 17 H13'],
    open: ['M9 17 V6.5 L18 4.5 V15', 'M9 17 A2.5 2.5 0 1 1 4 17 A2.5 2.5 0 0 1 9 17 Z', 'M18 15 A2.5 2.5 0 1 1 13 15 A2.5 2.5 0 0 1 18 15 Z'],
    close: ['M7 7 L17 17', 'M17 7 L7 17'],
    fs: ['M4 9 V4 H9', 'M20 9 V4 H15', 'M4 15 V20 H9', 'M20 15 V20 H15'],
    fsExit: ['M9 4 V9 H4', 'M15 4 V9 H20', 'M9 20 V15 H4', 'M15 20 V15 H20'],
    orbit: ['M3 12 C3 9.2 7 7 12 7 S21 9.2 21 12 S17 17 12 17 S3 14.8 3 12 Z', 'M10 12 A2 2 0 1 0 14 12 A2 2 0 1 0 10 12 Z']
  };

  /* ------------------------------------------------------------------ */
  /* متادیتا: ID3v2 / FLAC / MP4 — فقط برای آهنگِ جاری، فقط سرِ فایل       */
  /* ------------------------------------------------------------------ */
  function ascii(b, s, n) { let r = ''; for (let i = 0; i < n && s + i < b.length; i++) r += String.fromCharCode(b[s + i]); return r; }
  function u32(b, p) { return ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0; }
  function u32le(b, p) { return (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0; }
  function synch(b, p) { return ((b[p] & 127) << 21) | ((b[p + 1] & 127) << 14) | ((b[p + 2] & 127) << 7) | (b[p + 3] & 127); }
  function dec(bytes, enc) {
    try {
      let s;
      if (enc === 1) {
        if (bytes[0] === 0xFE && bytes[1] === 0xFF) s = new TextDecoder('utf-16be').decode(bytes.subarray(2));
        else if (bytes[0] === 0xFF && bytes[1] === 0xFE) s = new TextDecoder('utf-16le').decode(bytes.subarray(2));
        else s = new TextDecoder('utf-16le').decode(bytes);
      } else if (enc === 2) s = new TextDecoder('utf-16be').decode(bytes);
      else if (enc === 3) s = new TextDecoder('utf-8').decode(bytes);
      else s = new TextDecoder('iso-8859-1').decode(bytes);
      return s.replace(/\u0000+$/g, '').split('\u0000')[0].trim();
    } catch (e) { return ''; }
  }
  function sniff(d, fallback) {
    if (d[0] === 0xFF && d[1] === 0xD8) return 'image/jpeg';
    if (d[0] === 0x89 && d[1] === 0x50 && d[2] === 0x4E && d[3] === 0x47) return 'image/png';
    if (d[0] === 0x47 && d[1] === 0x49 && d[2] === 0x46) return 'image/gif';
    if (d[0] === 0x52 && d[1] === 0x49 && d[2] === 0x46 && d[3] === 0x46) return 'image/webp';
    return fallback || 'image/jpeg';
  }
  function makeCover(data, mime) {
    if (!data || data.length < 64) return null;
    return new Blob([data], { type: sniff(data, mime) });
  }
  function unsync(b) {
    const o = new Uint8Array(b.length); let n = 0;
    for (let i = 0; i < b.length; i++) { o[n++] = b[i]; if (b[i] === 0xFF && b[i + 1] === 0) i++; }
    return o.subarray(0, n);
  }
  function findTerm(a, start, enc) {
    if (enc === 1 || enc === 2) {
      for (let i = start; i + 1 < a.length; i += 2) if (a[i] === 0 && a[i + 1] === 0) return { idx: i, len: 2 };
      return { idx: a.length, len: 0 };
    }
    for (let i = start; i < a.length; i++) if (a[i] === 0) return { idx: i, len: 1 };
    return { idx: a.length, len: 0 };
  }

  async function metaID3(file, head) {
    const ver = head[3];
    const size = synch(head, 6);
    const total = Math.min(size, 8 * 1024 * 1024);
    let buf = new Uint8Array(await file.slice(10, 10 + total).arrayBuffer());
    if (head[5] & 0x80) buf = unsync(buf);
    let p = 0;
    if (ver >= 3 && (head[5] & 0x40) && buf.length > 4) p = ver === 4 ? synch(buf, 0) : u32(buf, 0) + 4;
    const out = {};
    const idLen = ver === 2 ? 3 : 4, hdr = ver === 2 ? 6 : 10;
    while (p + hdr <= buf.length) {
      if (buf[p] === 0) break;
      const id = ascii(buf, p, idLen);
      const fs = ver === 2 ? ((buf[p + 3] << 16) | (buf[p + 4] << 8) | buf[p + 5]) : (ver === 4 ? synch(buf, p + 4) : u32(buf, p + 4));
      const body = p + hdr;
      if (fs <= 0 || body + fs > buf.length) break;
      const fr = buf.subarray(body, body + fs);
      if (id === 'TIT2' || id === 'TT2') out.title = dec(fr.subarray(1), fr[0]);
      else if (id === 'TPE1' || id === 'TP1') out.artist = dec(fr.subarray(1), fr[0]);
      else if ((id === 'APIC' || id === 'PIC') && !out.cover) {
        const enc = fr[0]; let q = 1, mime = '';
        if (ver === 2) { mime = 'image/' + ascii(fr, 1, 3).toLowerCase(); q = 4; }
        else { const e = fr.indexOf(0, 1); mime = ascii(fr, 1, Math.max(0, e - 1)); q = e + 1; }
        q++; // picture type
        const term = findTerm(fr, q, enc);
        out.cover = makeCover(fr.subarray(term.idx + term.len), mime);
      }
      p = body + fs;
    }
    return out;
  }

  // p = آغازِ «طولِ vendor»؛ مشترک بینِ FLAC و Ogg (Vorbis/Opus)
  function vorbisComments(b, p, out) {
    if (p + 4 > b.length) return;
    p += 4 + u32le(b, p);
    const cnt = u32le(b, p); p += 4;
    for (let i = 0; i < cnt && p + 4 <= b.length; i++) {
      const l = u32le(b, p); p += 4;
      if (p + l > b.length) break;
      const s = new TextDecoder('utf-8').decode(b.subarray(p, p + l)); p += l;
      const eq = s.indexOf('=');
      if (eq > 0) {
        const k = s.slice(0, eq).toUpperCase(), v = s.slice(eq + 1);
        if (k === 'TITLE' && !out.title) out.title = v;
        else if (k === 'ARTIST' && !out.artist) out.artist = v;
      }
    }
  }
  async function metaOgg(file) {
    const buf = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
    const out = {};
    for (let i = 0; i < buf.length - 8; i++) {
      if (buf[i] === 0x03 && ascii(buf, i + 1, 6) === 'vorbis') { vorbisComments(buf, i + 7, out); break; }
      if (buf[i] === 0x4F && ascii(buf, i, 8) === 'OpusTags') { vorbisComments(buf, i + 8, out); break; }
    }
    return out;
  }
  async function metaFLAC(file) {
    const out = {}; let pos = 4;
    for (let n = 0; n < 64; n++) {
      const h = new Uint8Array(await file.slice(pos, pos + 4).arrayBuffer());
      if (h.length < 4) break;
      const last = h[0] & 128, type = h[0] & 127, len = (h[1] << 16) | (h[2] << 8) | h[3];
      if ((type === 4 && len < (1 << 20)) || (type === 6 && len < (12 << 20))) {
        const b = new Uint8Array(await file.slice(pos + 4, pos + 4 + len).arrayBuffer());
        if (type === 4) {
          vorbisComments(b, 0, out);
        } else if (!out.cover) {
          let p = 4;
          const ml = u32(b, p); p += 4;
          const mime = ascii(b, p, ml); p += ml;
          const dl = u32(b, p); p += 4 + dl + 16;
          const dataLen = u32(b, p); p += 4;
          out.cover = makeCover(b.subarray(p, p + dataLen), mime);
        }
      }
      pos += 4 + len;
      if (last) break;
    }
    return out;
  }

  function boxes(buf, s, e, cb) {
    let p = s;
    while (p + 8 <= e) {
      let size = u32(buf, p), hs = 8;
      const type = ascii(buf, p + 4, 4);
      if (size === 1) { size = u32(buf, p + 12); hs = 16; } else if (size === 0) size = e - p;
      if (size < hs || p + size > e) break;
      cb(type, p + hs, p + size);
      p += size;
    }
  }
  function mp4Moov(buf, out) {
    boxes(buf, 0, buf.length, function (t1, s1, e1) {
      if (t1 !== 'udta') return;
      boxes(buf, s1, e1, function (t2, s2, e2) {
        if (t2 !== 'meta') return;
        boxes(buf, s2 + 4, e2, function (t3, s3, e3) {
          if (t3 !== 'ilst') return;
          boxes(buf, s3, e3, function (item, s4, e4) {
            boxes(buf, s4, e4, function (t5, s5, e5) {
              if (t5 !== 'data') return;
              const flags = u32(buf, s5) & 0xFFFFFF;
              const payload = buf.subarray(s5 + 8, e5);
              if (item === '\u00A9nam' && !out.title) out.title = dec(payload, 3);
              else if (item === '\u00A9ART' && !out.artist) out.artist = dec(payload, 3);
              else if (item === 'covr' && !out.cover) out.cover = makeCover(payload, flags === 14 ? 'image/png' : 'image/jpeg');
            });
          });
        });
      });
    });
  }
  async function metaMP4(file) {
    const out = {}; let pos = 0;
    for (let n = 0; n < 200 && pos < file.size; n++) {
      const dv = new DataView(await file.slice(pos, pos + 16).arrayBuffer());
      if (dv.byteLength < 8) break;
      let size = dv.getUint32(0), hs = 8;
      const type = String.fromCharCode(dv.getUint8(4), dv.getUint8(5), dv.getUint8(6), dv.getUint8(7));
      if (size === 1 && dv.byteLength >= 16) { size = Number(dv.getBigUint64(8)); hs = 16; } else if (size === 0) size = file.size - pos;
      if (size < hs) break;
      if (type === 'moov') {
        if (size > 24 * 1024 * 1024) break;
        mp4Moov(new Uint8Array(await file.slice(pos + hs, pos + size).arrayBuffer()), out);
        break;
      }
      pos += size;
    }
    return out;
  }
  async function readMeta(file) {
    try {
      const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      if (ascii(head, 0, 3) === 'ID3') return await metaID3(file, head);
      if (ascii(head, 0, 4) === 'fLaC') return await metaFLAC(file);
      if (ascii(head, 0, 4) === 'OggS') return await metaOgg(file);
      if (ascii(head, 4, 4) === 'ftyp') return await metaMP4(file);
    } catch (e) {}
    return {};
  }

  /* ------------------------------------------------------------------ */
  /* کتابخانهٔ ماندگار (دستگیره‌ها در IndexedDB؛ خودِ فایل هیچ‌وقت کپی نمی‌شود) */
  /* ------------------------------------------------------------------ */
  function idb() {
    return new Promise(function (res, rej) {
      const r = indexedDB.open('voidMusic', 2);
      r.onupgradeneeded = function () {
        const db = r.result;
        if (!db.objectStoreNames.contains('lib')) db.createObjectStore('lib', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('roots')) db.createObjectStore('roots', { keyPath: 'id' });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  async function dbPut(track) {
    try {
      const db = await idb();
      await new Promise(function (res, rej) {
        const tx = db.transaction('lib', 'readwrite');
        tx.objectStore('lib').put({ id: track.id, name: track.name, handle: track.rootId ? null : track.handle, rootId: track.rootId || null, path: track.path || null, copy: track.copy || null, ts: track.ts || 0, stars: track.stars || 0 });
        tx.oncomplete = res; tx.onerror = function () { rej(tx.error); };
      });
      db.close();
    } catch (e) {}
  }
  async function dbDelete(id) {
    try {
      const db = await idb();
      await new Promise(function (res, rej) {
        const tx = db.transaction('lib', 'readwrite');
        tx.objectStore('lib').delete(id);
        tx.oncomplete = res; tx.onerror = function () { rej(tx.error); };
      });
      db.close();
    } catch (e) {}
  }
  async function dbRoot(op, root) {
    try {
      const db = await idb();
      const out = await new Promise(function (res, rej) {
        const tx = db.transaction('roots', op === 'all' ? 'readonly' : 'readwrite'), st = tx.objectStore('roots');
        let rq = null;
        if (op === 'put') rq = st.put({ id: root.id, name: root.name, handle: root.handle });
        else if (op === 'del') rq = st.delete(root);
        else rq = st.getAll();
        tx.oncomplete = function () { res(rq ? rq.result : null); }; tx.onerror = function () { rej(tx.error); };
      });
      db.close();
      return out;
    } catch (e) { return op === 'all' ? [] : null; }
  }
  async function dbAll() {
    try {
      const db = await idb();
      const rows = await new Promise(function (res, rej) {
        const rq = db.transaction('lib').objectStore('lib').getAll();
        rq.onsuccess = function () { res(rq.result || []); };
        rq.onerror = function () { rej(rq.error); };
      });
      db.close();
      return rows;
    } catch (e) { return []; }
  }

  /* ------------------------------------------------------------------ */
  /* صف و افزودنِ فایل                                                    */
  /* ------------------------------------------------------------------ */
  function trackById(id) { for (let i = 0; i < S.tracks.length; i++) if (S.tracks[i].id === id) return S.tracks[i]; return null; }
  function isAudioName(name, file) { return EXT.test(name || '') || !!(file && file.type && file.type.indexOf('audio/') === 0); }

  // یک پوشه = یک ریشه؛ مجوزِ خواندن فقط برای ریشه گرفته می‌شود و همهٔ فایل‌های زیرش را می‌پوشاند
  function newScan() { return { audio: 0, other: 0, tooDeep: 0, dirErrors: 0, denied: false }; }
  // بدونِ سقفِ فایل: هر چیزی که به فهرست نمی‌رسد شمارش می‌شود، نه اینکه بی‌صدا کم شود
  async function walkDir(dirHandle, out, depth, rootObj, path, scan) {
    path = path || [];
    scan = scan || newScan();
    try {
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          if (EXT.test(entry.name)) {
            out.push({ handle: entry, root: rootObj || null, path: rootObj ? path.concat(entry.name) : null });
            scan.audio++;
          } else scan.other++;
        } else if (entry.kind === 'directory') {
          if (depth >= SCAN_MAX_DEPTH) { scan.tooDeep++; continue; }
          await walkDir(entry, out, depth + 1, rootObj, path.concat(entry.name), scan);
        }
      }
    } catch (e) {
      scan.dirErrors++;
      if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) scan.denied = true;
    }
    return scan;
  }
  async function addFolderHandle(dir) {
    let rootObj = null;
    for (const r of S.roots.values()) { try { if (await r.handle.isSameEntry(dir)) { rootObj = r; break; } } catch (e) {} }
    if (!rootObj) { rootObj = { id: uid(), name: dir.name, handle: dir }; S.roots.set(rootObj.id, rootObj); dbRoot('put', rootObj); }
    S.permCache.set(rootObj.handle, Promise.resolve());       // همین الان کاربر مجوز داده
    const list = [];
    const scan = await walkDir(dir, list, 0, rootObj, [], newScan());
    S.scan = scan;
    const added = await addEntries(list);
    reportScan(scan, added);
    return { added: added, scan: scan };
  }
  function reportScan(scan, added) {
    const parts = [L('voidMusicAddedN').replace('{n}', added)];
    if (scan.other) parts.push(L('voidMusicSkippedOther').replace('{n}', scan.other));
    if (scan.tooDeep) parts.push(L('voidMusicScanDeep').replace('{n}', scan.tooDeep));
    if (scan.dirErrors) parts.push(L('voidMusicScanError').replace('{n}', scan.dirErrors));
    if (scan.denied) parts.push(L('voidMusicErrPrompt'));
    toast(parts.join(' · '));
  }
  // مجوزِ خواندنِ یک دستگیره؛ اول بدونِ پرسش (queryPermission)، فقط اگر لازم بود یک بار می‌پرسد و در همین نشست حفظ می‌شود
  function grant(h) {
    let p = S.permCache.get(h);
    if (p) return p;
    p = (async function () {
      let st = 'granted';
      if (h.queryPermission) {
        try { st = await h.queryPermission({ mode: 'read' }); } catch (e) { throw new Error('permQuery'); }
      }
      if (st === 'granted') return;
      if (!h.requestPermission) throw new Error('permUnsupported');
      let r = null;
      try { r = await h.requestPermission({ mode: 'read' }); } catch (e) { throw new Error('permDenied'); }
      if (r === 'granted') return;
      throw new Error(r === 'prompt' ? 'permPrompt' : 'permDenied');
    })();
    S.permCache.set(h, p);
    p.catch(function () { S.permCache.delete(h); });       // شکست نباید در نشست قفل شود: هر کلیکِ کاربر دوباره می‌پرسد
    return p;
  }
  // هر علت را به یک پیامِ جدا تبدیل می‌کنیم؛ «پیدا نشد» و «اجازه نداری» دو چیزند و دو راه‌حل
  const FAIL_KEY = {
    permPrompt: 'voidMusicErrPrompt', permDenied: 'voidMusicErrDenied', permUnsupported: 'voidMusicErrDenied', permQuery: 'voidMusicErrUnreadable',
    noroot: 'voidMusicErrNoRoot', nofile: 'voidMusicErrNoRoot', notfound: 'voidMusicErrGone', unreadable: 'voidMusicErrUnreadable'
  };
  const FAIL_GRANTABLE = { permPrompt: 1, permDenied: 1, permQuery: 1 };
  // نسخهٔ خصوصی در OPFS (بدونِ هیچ درخواستِ دسترسی)
  async function copyToPrivate(file, name) {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('music', { create: true });
    const fname = uid() + ((/\.[A-Za-z0-9]+$/.exec(name) || ['.bin'])[0]);
    const fh = await dir.getFileHandle(fname, { create: true });
    const w = await fh.createWritable();
    await file.stream().pipeTo(w);
    return { handle: fh, copy: fname };
  }

  async function addEntries(entries, opts) {
    opts = opts || {};
    let added = 0, firstNew = null, firstTarget = null, dupTr = null;
    S.copyDone = 0; S.copyTotal = S.copyMode ? entries.length : 0;
    /* همان‌سازیِ پیشین برای هر ورودی کلِ صف را با await می‌پیمود؛ روی پوشه‌هایِ هزارفایلی همان
       حلقه صفحه را قفل می‌کرد. دو فایلِ یکسان حتماً یک نام دارند، پس فقط نام‌هایِ یکسان سنجیده می‌شوند. */
    const byName = new Map();
    function indexTrack(tr) { const a = byName.get(tr.name); if (a) a.push(tr); else byName.set(tr.name, [tr]); }
    for (const tr of S.tracks) indexTrack(tr);
    for (const en of entries) {
      let f = en.file || null, h = en.handle || null;
      const name = (h && h.name) || (f && f.name) || '';
      if (!isAudioName(name, f)) continue;
      let dup = false;
      const cands = byName.get(name);
      if (cands) for (const tr of cands) {
        if (en.root && tr.rootId === en.root.id && tr.path && tr.path.join('/') === en.path.join('/')) { dup = true; dupTr = tr; break; }
        if (!en.root && h && tr.handle && !tr.copy) { try { if (await tr.handle.isSameEntry(h)) { dup = true; dupTr = tr; break; } } catch (e) {} }
        else if (f && tr.file && tr.file.name === f.name && tr.file.size === f.size && tr.file.lastModified === f.lastModified) { dup = true; dupTr = tr; break; }
      }
      if (dup) { if (!firstTarget) firstTarget = dupTr; continue; }
      const tr = { stars: 0, ts: Date.now() + added, id: uid(), name: name, title: nameToTitle(name), artist: '', file: f, handle: h, bad: false, rootId: en.root ? en.root.id : null, path: en.root ? en.path : null, copy: null };
      if (S.copyMode) {
        // «نسخهٔ خصوصی»: فایل یک بار در OPFS کپی می‌شود؛ از آن به بعد هیچ مجوزی لازم نیست
        try {
          const src = f || await h.getFile();
          if (S.copyTotal) toast((S.copyDone + 1) + ' / ' + S.copyTotal);
          const c = await copyToPrivate(src, name);
          tr.handle = c.handle; tr.copy = c.copy; tr.file = null; tr.rootId = null; tr.path = null; f = null; h = c.handle;
        } catch (e) { toast(L(e && e.name === 'NotFoundError' ? 'voidMusicErrGone' : 'voidMusicErrUnreadable')); continue; }
        S.copyDone++;
      }
      S.tracks.push(tr);
      indexTrack(tr);
      // آهنگِ تازه در جای تصادفیِ کیسه می‌نشیند
      S.bag.splice(randInt(S.bag.length + 1), 0, tr.id);
      if (tr.rootId || tr.copy || (h && !f)) dbPut(tr);
      if (!firstNew) firstNew = tr;
      if (!firstTarget) firstTarget = tr;
      added++;
    }
    renderQueue();
    syncEmpty();
    // فایلِ تکی (یا انتخابِ صریحِ فایل از دکمهٔ «افزودن فایل»): همان فایل بلافاصله پخش شود، حتی اگر آهنگ دیگری جاری باشد.
    // اگر فایلِ انتخابی از قبل در فهرست بود، همان ردیفِ موجود پخش می‌شود.
    if (firstTarget && (entries.length === 1 || opts.playFirst)) {
      if (!(firstTarget.id === S.curId && S.audio && !S.audio.paused)) { playbackLog('play-now-after-pick', { added: added, picked: entries.length }); firstTarget.bad = false; playId(firstTarget.id); }
    } else if (added && (!S.audio || S.audio.paused) && S.curId === null) {
      // افزودنِ گروهی (پوشه/چندفایلِ رها‌شده): فقط وقتی هیچ آهنگی جاری نیست خودکار شروع شود
      playbackLog('auto-start-after-add', { added: added, readyState: S.audio ? S.audio.readyState : 0 });
      playId(S.shuffle ? (S.bag.pop() || firstNew.id) : firstNew.id);
    }
    return added;
  }

  async function pickFiles() {
    if (window.showOpenFilePicker) {
      try {
        const hs = await window.showOpenFilePicker({ multiple: true, types: PICKER_TYPES });
        playbackLog('file-picker-resolved', { count: hs.length });
        await addEntries(hs.map(function (h) { return { handle: h }; }), { playFirst: true });
        return;
      } catch (e) { playbackLog('file-picker-error', { name: e && e.name || 'Error', message: e && e.message || String(e) }); if (e && e.name === 'AbortError') return; }
    }
    els.file.value = '';
    els.file.click();
  }
  async function pickFolder() {
    if (window.showDirectoryPicker) {
      try {
        const dir = await window.showDirectoryPicker();
        await addFolderHandle(dir);
        return;
      } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    els.folder.value = '';
    els.folder.click();
  }

  /* ------------------------------------------------------------------ */
  /* پخش                                                                  */
  /* ------------------------------------------------------------------ */
  function ensureAudio() {
    if (S.audio) return S.audio;
    const a = new Audio();
    a.preload = 'metadata';
    try { const s = parseFloat(localStorage.getItem(VOL_KEY)); if (isFinite(s)) S.vol = clamp(s, 0, 1); } catch (e) {}
    S.audio = S.localAudio = a;
    applyVolume();
    a.addEventListener('play', onPlayState);
    a.addEventListener('pause', onPlayState);
    a.addEventListener('timeupdate', updateProgress);
    a.addEventListener('durationchange', function () { updateProgress(); posState(); });
    a.addEventListener('seeked', posState);
    a.addEventListener('ended', function () { next(); });
    a.addEventListener('error', onAudioError);
    ['playing', 'waiting', 'pause', 'ended', 'error', 'loadstart', 'canplay'].forEach(function (eventName) {
      a.addEventListener(eventName, function () {
        const err = a.error;
        playbackLog('audio-event-' + eventName, {
          readyState: a.readyState, paused: a.paused, ended: a.ended,
          muted: a.muted, volume: a.volume, hasSource: !!a.currentSrc,
          duration: isFinite(a.duration) ? a.duration : null,
          mediaError: err ? { code: err.code, message: err.message || '' } : null
        });
      });
    });
    S.audio = S.localAudio = a;
    playbackLog('audio-created', { readyState: a.readyState, paused: a.paused, muted: a.muted, volume: a.volume, diagnosticBypass: SINGLE_TAB_DIAGNOSTIC });
    return a;
  }

  async function fileOf(tr) {
    if (tr.file) return tr.file;
    if (tr.rootId) {
      const root = S.roots.get(tr.rootId);
      if (!root) throw new Error('noroot');
      if (!tr.path || !tr.path.length) throw new Error('nofile');
      await grant(root.handle);                                  // یک مجوز برای کلِ پوشه
      if (!tr.handle) {
        try {
          let d = root.handle;
          for (let i = 0; i < tr.path.length - 1; i++) d = await d.getDirectoryHandle(tr.path[i]);
          tr.handle = await d.getFileHandle(tr.path[tr.path.length - 1]);
        } catch (e) { throw new Error(e && e.name === 'NotFoundError' ? 'notfound' : 'unreadable'); }
      }
      try { return await tr.handle.getFile(); }
      catch (e) { throw new Error(e && e.name === 'NotFoundError' ? 'notfound' : 'unreadable'); }
    }
    const h = tr.handle;
    if (!h) throw new Error('nofile');
    if (!tr.copy) await grant(h);
    try { return await h.getFile(); }
    catch (e) { throw new Error(e && e.name === 'NotFoundError' ? 'notfound' : 'unreadable'); }
  }

  // ترتیبِ فهرست (وقتی شافل خاموش است): آهنگِ بعد از جاری، خرابها را رد می‌کند و در انتها به اول برمی‌گردد
  function seqNext() {
    const n = S.tracks.length;
    let i = -1;
    for (let k = 0; k < n; k++) if (S.tracks[k].id === S.curId) { i = k; break; }
    for (let step = 1; step <= n; step++) {
      const tr = S.tracks[(i + step) % n];
      if (!tr.bad) return tr.id;
    }
    return S.tracks[(i + 1) % n].id;
  }
  function setShuffle(on, announce) {
    S.shuffle = !!on;
    try { localStorage.setItem(SHUF_KEY, S.shuffle ? '1' : '0'); } catch (e) {}
    if (S.shuffle) S.bag = shuffled(S.tracks.map(function (t) { return t.id; }).filter(function (id) { return id !== S.curId; }));
    relabel();
    if (announce) toast(L(S.shuffle ? 'voidMusicShuffleOn' : 'voidMusicShuffleOff'));
    // با روشن‌کردنِ شافل وقتی چیزی پخش نمی‌شود، همان لحظه یک آهنگِ تصادفی شروع شود
    if (announce && S.shuffle && S.tracks.length && !(S.audio && !S.audio.paused)) { const id = drawNext(); if (id) playId(id); }
  }
  function drawNext() {
    const n = S.tracks.length;
    if (!n) return null;
    if (n === 1) return S.tracks[0].id;
    if (!S.shuffle) return seqNext();
    if (!S.bag.length) {
      S.bag = shuffled(S.tracks.map(function (t) { return t.id; }));
      // هرگز آهنگِ جاری بلافاصله تکرار نشود
      if (S.bag[S.bag.length - 1] === S.curId) { const k = randInt(S.bag.length - 1); const x = S.bag[k]; S.bag[k] = S.bag[S.bag.length - 1]; S.bag[S.bag.length - 1] = x; }
    }
    return S.bag.pop();
  }

  async function playId(id, opts) {
    opts = opts || {};
    if (S.web) detachWeb({ pauseSite: true });          // پخشِ محلی شروع شد: منبعِ وب جدا و مکث می‌شود
    const tr = trackById(id);
    if (!tr) { playbackLog('play-aborted-no-track', { trackId: id }); return; }
    playbackLog('play-requested', { sourceType: tr.file ? 'File' : (tr.copy ? 'private-copy' : 'file-handle'), hasHandle: !!tr.handle, hasCopy: !!tr.copy, token: S.token + 1 });
    const tok = ++S.token;
    let file;
    try { file = await fileOf(tr); }
    catch (e) {
      const cause = (e && e.message) || 'unreadable';
      playbackLog('source-load-failed', { cause: cause, name: e && e.name || 'Error', message: e && e.message || String(e), hasHandle: !!tr.handle, hasCopy: !!tr.copy, rootId: tr.rootId || null });
      if (tok === S.token) { trackFailed(tr, cause); releasePlayback(); }
      return;
    }
    if (tok !== S.token) { playbackLog('play-aborted-stale-token', { token: tok, currentToken: S.token }); return; }
    playbackLog('source-loaded', { type: file && file.type || '', size: file && file.size, readyState: S.audio ? S.audio.readyState : 0 });
    if (!await claimPlayback()) { playbackLog('play-aborted-claim-denied', { token: tok }); return; }
    if (tok !== S.token) { playbackLog('play-aborted-stale-after-claim', { token: tok, currentToken: S.token }); if (!isPlaying()) releasePlayback(); return; }
    const a = ensureAudio();
    if (S.curId && S.curId !== id && !opts.fromHistory) { S.history.push(S.curId); if (S.history.length > 60) S.history.shift(); }
    S.bag = S.bag.filter(function (x) { return x !== id; });
    S.curId = id;
    S.seed = rand32();
    poke();
    if (S.url) { try { URL.revokeObjectURL(S.url); } catch (e) {} }
    S.url = URL.createObjectURL(file);
    a.src = S.url;
    playbackLog('audio-source-set', { readyState: a.readyState, paused: a.paused, muted: a.muted, volume: a.volume, hasSource: !!a.currentSrc, fileType: file.type || '', fileSize: file.size });
    setMeta(tr.title, tr.artist, null);
    renderQueue();
    publishSession(tr, null);
    pushRemote(true);
    try { window.dispatchEvent(new CustomEvent('voidmusic:track', { detail: { id: id, title: tr.title, seed: S.seed } })); } catch (e) {}
    let playbackStarted = false;
    try { playbackLog('audio-play-invoked', { readyState: a.readyState, paused: a.paused, muted: a.muted, volume: a.volume, hasSource: !!a.currentSrc }); await a.play(); playbackStarted = true; playbackLog('audio-play-resolved', { readyState: a.readyState, paused: a.paused, ended: a.ended, muted: a.muted, volume: a.volume }); S.failures = 0; S.failStreak = 0; S.grantAdvised = false; S.grantTrack = null; tr.needGrant = null; }
    catch (e) {
      playbackLog('audio-play-rejected', { name: e && e.name || 'Error', message: e && e.message || String(e), readyState: a.readyState, paused: a.paused, ended: a.ended, muted: a.muted, volume: a.volume, mediaError: a.error ? { code: a.error.code, message: a.error.message || '' } : null });
      if (a.paused) releasePlayback();
    }
    if (tok !== S.token) return;
    readMeta(file).then(function (m) {
      if (tok !== S.token || !m) return;
      if (m.title) tr.title = m.title;
      if (m.artist) tr.artist = m.artist;
      let cu = null;
      if (m.cover) { cu = URL.createObjectURL(m.cover); }
      if (S.coverUrl) { try { URL.revokeObjectURL(S.coverUrl); } catch (e) {} }
      S.coverUrl = cu;
      setMeta(tr.title, tr.artist, cu, function () {
        if (!playbackStarted || tok !== S.token || S.curId !== id || a.paused) return;
        try { window.dispatchEvent(new CustomEvent('voidmusic:title-ready', { detail: { id: id, title: tr.title, artist: tr.artist, seed: S.seed, generation: tok } })); } catch (e) {}
      });
      publishSession(tr, cu);
      pushRemote(true);
      renderQueue();
    });
  }

  /* یک خرابی = یک پیام، نه پیام‌هایِ پشت‌سرهم. «اجازه نداری» فایل را خراب نمی‌کند:
     همان آهنگ با یک کلیکِ کاربر (ژستِ واقعی = activation) دوباره امتحان می‌شود. */
  function trackFailed(tr, cause) {
    const isKey = /^voidMusic/.test(String(cause || ''));
    const key = isKey ? cause : (FAIL_KEY[cause] || 'voidMusicErrUnreadable');
    const grantable = !isKey && !!FAIL_GRANTABLE[cause];
    if (grantable) tr.needGrant = cause; else tr.bad = true;
    S.failures++; S.failStreak++;
    if (grantable) {
      S.grantTrack = tr.id;
      if (!S.grantAdvised) {
        S.grantAdvised = true;
        toast(L(key), function () { regrantAndPlay(tr); }, L('voidMusicGrantAction'));
      }
      renderQueue();
      return;                                       // چرخهٔ خودکارِ «بعدی» متوقف: بقیهٔ این پوشه هم همین اجازه را می‌خواهند
    }
    if (S.failStreak === 1) toast(L(key));
    renderQueue();
    if (S.failStreak >= FAIL_STREAK_MAX) { toast(L('voidMusicFailStreak').replace('{n}', S.failStreak)); S.failStreak = 0; return; }
    if (S.failures < S.tracks.length && S.tracks.length > 1) setTimeout(function () { if (S.curId !== null) next(); }, 1200);
  }
  // از داخلِ کلیکِ کاربر صدا می‌زند، پس requestPermission مجاز است (بدونِ ژست، مرورگر رد می‌کند)
  async function regrantAndPlay(tr) {
    const root = tr && tr.rootId ? S.roots.get(tr.rootId) : null;
    const h = root ? root.handle : (tr && tr.handle);
    if (!h) { toast(L('voidMusicErrNoRoot')); return; }
    S.permCache.delete(h);
    try { await grant(h); }
    catch (e) {
      playbackLog('regrant-failed', { cause: e && e.message || String(e) });
      toast(L(FAIL_KEY[(e && e.message) || 'unreadable'] || 'voidMusicErrDenied'), function () { regrantAndPlay(tr); }, L('voidMusicGrantAction'));
      return;
    }
    playbackLog('regrant-ok', { trackId: tr.id });
    S.grantAdvised = false; S.grantTrack = null; S.failStreak = 0; S.failures = 0;
    tr.needGrant = null;
    toast(L('voidMusicRegrantOk'));
    playId(tr.id);
  }
  function onAudioError() {
    playbackLog('audio-error-handler', { readyState: S.audio ? S.audio.readyState : 0, paused: S.audio ? S.audio.paused : true, mediaError: S.audio && S.audio.error ? { code: S.audio.error.code, message: S.audio.error.message || '' } : null });
    releasePlayback();
    const tr = trackById(S.curId);
    if (tr && S.audio && S.audio.src) trackFailed(tr, 'voidMusicUnsupported');
  }

  function next() {
    if (S.web) { S.web.cmd('nexttrack'); return; }
    const id = drawNext();
    if (id) playId(id); else releasePlayback();
  }
  function prev() {
    if (S.web) { S.web.cmd('previoustrack'); return; }
    const a = S.audio;
    if (a && a.currentTime > 3) { a.currentTime = 0; return; }
    while (S.history.length) {
      const id = S.history.pop();
      if (trackById(id)) { playId(id, { fromHistory: true }); return; }
    }
    if (a) a.currentTime = 0;
  }
  function toggle() {
    if (S.web) { if (S.web.paused) S.web.play(); else S.web.pause(); return; }
    playbackLog('toggle-requested', { currentTrack: S.curId !== null, trackCount: S.tracks.length, audioExists: !!S.audio, paused: !S.audio || S.audio.paused, muted: !!(S.audio && S.audio.muted), volume: S.audio ? S.audio.volume : null });
    const a = S.audio;
    if (!a || S.curId === null) {
      if (S.tracks.length) { const id = drawNext(); if (id) playId(id); } else pickFiles();
      return;
    }
    if (a.paused) {
      claimPlayback().then(function (granted) {
        if (!granted) return;
        playbackLog('audio-play-invoked', { readyState: a.readyState, paused: a.paused, muted: a.muted, volume: a.volume, hasSource: !!a.currentSrc });
        const pr = a.play(); if (pr && pr.then) pr.then(function () { playbackLog('audio-play-resolved', { readyState: a.readyState, paused: a.paused, ended: a.ended, muted: a.muted, volume: a.volume }); }, function (e) { playbackLog('audio-play-rejected', { name: e && e.name || 'Error', message: e && e.message || String(e), readyState: a.readyState, paused: a.paused, muted: a.muted, volume: a.volume, mediaError: a.error ? { code: a.error.code, message: a.error.message || '' } : null }); if (a.paused) releasePlayback(); });
      });
    } else a.pause();
  }
  function seekTo(sec) {
    const a = S.audio;
    if (!a || !isFinite(a.duration)) return;
    a.currentTime = clamp(sec, 0, a.duration);
  }
  function seekBy(d) { if (S.audio) seekTo(S.audio.currentTime + d); }
  // یک مدلِ واحدِ صدا: اگر ویژولایزر گراف ساخته باشد، بلندی را GainNode می‌دهد (تا تحلیل
  // مستقل از ولوم بماند)، وگرنه خودِ <audio>. منبعِ تب استثناست: صدایش در Void Tab پخش نمی‌شود
  // (گراف فقط تحلیل می‌کند و خروجی‌اش بی‌صداست)، پس ولوم باید به همان تب فرستاده شود.
  function applyVolume() {
    const a = S.audio;
    if (!a) return;
    if (a.__web) {
      try { a.volume = S.muted ? 0 : S.vol; a.muted = S.muted; } catch (e) {}
      playbackLog('volume-web', { volume: a.volume, muted: a.muted });
      return;
    }
    if (S.outGain) {
      a.volume = 1; a.muted = false;
      try { S.outGain.gain.value = S.muted ? 0 : S.vol; } catch (e) {}
    } else {
      a.volume = S.vol; a.muted = S.muted;
    }
    playbackLog('volume-applied', { muted: a.muted, volume: a.volume, gain: S.outGain ? S.outGain.gain.value : null });
  }
  function setVolume(v) {
    ensureAudio();
    S.vol = clamp(v, 0, 1);
    if (S.vol > 0) S.muted = false;
    try { localStorage.setItem(VOL_KEY, String(S.vol)); } catch (e) {}
    applyVolume(); syncVolume();
  }
  function toggleMute() { ensureAudio(); S.muted = !S.muted; applyVolume(); syncVolume(); }

  /* ------------------------------------------------------------------ */
  /* Media Session (کلیدهای مدیایِ کیبورد/سیستم‌عامل — همان فرمان‌ها)       */
  /* ------------------------------------------------------------------ */
  function publishSession(tr, coverUrl) {
    if (!('mediaSession' in navigator)) return;
    try {
      const art = coverUrl ? [{ src: coverUrl, sizes: '300x300' }] : [];
      navigator.mediaSession.metadata = new MediaMetadata({ title: tr.title || '', artist: tr.artist || '', album: 'Void Galaxy', artwork: art });
    } catch (e) {}
  }
  function posState() {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    const a = S.audio;
    if (!a || !isFinite(a.duration) || a.duration <= 0) return;
    try { navigator.mediaSession.setPositionState({ duration: a.duration, playbackRate: a.playbackRate || 1, position: clamp(a.currentTime, 0, a.duration) }); } catch (e) {}
  }
  function bindSession() {
    if (!('mediaSession' in navigator)) return;
    const set = function (n, fn) { try { navigator.mediaSession.setActionHandler(n, fn); } catch (e) {} };
    set('play', function () { const a = ensureAudio(); if (S.curId === null) toggle(); else claimPlayback().then(function (granted) { if (granted) a.play().catch(function () { if (a.paused) releasePlayback(); }); }); });
    set('pause', function () { if (S.audio) S.audio.pause(); });
    set('previoustrack', prev);
    set('nexttrack', next);
    set('seekbackward', function (d) { seekBy(-((d && d.seekOffset) || 10)); });
    set('seekforward', function (d) { seekBy((d && d.seekOffset) || 10); });
    set('seekto', function (d) { if (d && typeof d.seekTime === 'number') seekTo(d.seekTime); });
    set('stop', function () { if (S.audio) S.audio.pause(); });
  }
  function unbindSession() {
    if (!('mediaSession' in navigator)) return;
    ['play', 'pause', 'previoustrack', 'nexttrack', 'seekbackward', 'seekforward', 'seekto', 'stop'].forEach(function (n) {
      try { navigator.mediaSession.setActionHandler(n, null); } catch (e) {}
    });
    try { navigator.mediaSession.metadata = null; } catch (e) {}
  }

  /* ------------------------------------------------------------------ */
  /* رابط                                                                 */
  /* ------------------------------------------------------------------ */
  function mkBtn(cls, key, ico) {
    const b = el('button', 'vm-btn ' + cls, { type: 'button' });
    b.dataset.k = key;
    if (ico) b.appendChild(ico);
    return b;
  }

  function build() {
    if (S.built) return;
    S.built = true;
    root = el('div', '', { id: 'void-music-root', role: 'region', hidden: '' });
    root.classList.add('vm-root-meta-empty');

    // عنوان + جلد
    els.meta = el('div', 'vm-meta is-blank');
    els.cover = el('img', 'vm-cover', { alt: '', hidden: '', draggable: 'false' });
    const tx = el('div', 'vm-text');
    els.title = el('div', 'vm-title', { dir: 'auto', 'aria-live': 'polite' });
    els.artist = el('div', 'vm-artist', { dir: 'auto' });
    tx.append(els.title, els.artist);
    els.meta.append(els.cover, tx);

    dock = el('div', 'vm-dock is-empty');
    // کمان + تیک‌ها
    els.arc = svg('svg', { class: 'vm-arc', 'aria-hidden': 'true' });
    const defs = svg('defs');
    els.grad = svg('linearGradient', { id: 'vmArcGrad', gradientUnits: 'userSpaceOnUse', x1: '0', y1: '0', x2: '1', y2: '0' });
    [['0%', 0], ['30%', .34], ['50%', .6], ['70%', .34], ['100%', 0]].forEach(function (s) {
      els.grad.appendChild(svg('stop', { offset: s[0], 'stop-color': '#c7d2fe', 'stop-opacity': String(s[1]) }));
    });
    defs.appendChild(els.grad);
    els.base = svg('path', { pathLength: '1000' }, 'vm-arc-base');
    els.fill = svg('path', { pathLength: '1000', 'stroke-dasharray': '1000', 'stroke-dashoffset': '1000' }, 'vm-arc-fill');
    els.ticks = svg('g');
    els.thumb = svg('circle', { r: '3.2', cx: '0', cy: '0' }, 'vm-thumb');
    els.arc.append(defs, els.base, els.ticks, els.fill, els.thumb);

    els.seek = el('div', 'vm-seek', { role: 'slider', tabindex: '0', 'aria-valuemin': '0', 'aria-valuemax': '0', 'aria-valuenow': '0' });
    els.time = el('div', 'vm-time');
    // ساعتِ محلیِ دستگاه (۲۴ساعته) بالای خطِ زمان: مستقل از پخش کار می‌کند و همان‌جا می‌ماند
    els.clock = el('div', 'vm-clock', { role: 'timer' });
    els.clockGlyph = el('span', 'vm-clock-g', { 'aria-hidden': 'true' });
    els.clockText = el('span', 'vm-clock-t');
    els.clock.append(els.clockGlyph, els.clockText);

    els.vol = mkBtn('vm-vol', 'voidMusicVolume');
    els.vol.append(icon(ICON.vol), icon(ICON.waves, 'vm-waves'), icon(ICON.slash, 'vm-slash'));
    els.vol.setAttribute('aria-haspopup', 'true'); els.vol.setAttribute('aria-expanded', 'false');
    els.prev = mkBtn('vm-prev', 'voidMusicPrev', icon(ICON.prev));
    els.play = mkBtn('vm-play', 'voidMusicPlay');
    els.play.append(icon(ICON.play, 'i-play'), icon(ICON.pause, 'i-pause'));
    els.play.setAttribute('aria-pressed', 'false');
    els.next = mkBtn('vm-next', 'voidMusicNext', icon(ICON.next));
    els.queueBtn = mkBtn('vm-queue-btn', 'voidMusicQueue', icon(ICON.queue));
    els.queueBtn.setAttribute('aria-haspopup', 'true'); els.queueBtn.setAttribute('aria-expanded', 'false');
    els.open = mkBtn('vm-open', 'voidMusicOpen', icon(ICON.open));
    els.openLabel = el('div', 'vm-open-label');

    // پاپ‌اورها
    els.volPop = el('div', 'vm-pop vm-vol-pop', { role: 'group' });
    els.volRange = el('input', '', { type: 'range', min: '0', max: '100', step: '1' });
    // نمایشِ کاملِ صدا: آیکونِ «کم» سمتِ چپ، آیکونِ «زیاد» سمتِ راست، پرشدنِ طلاییِ مسیر و عددِ درصد
    els.volVal = el('div', 'vm-vol-val', { 'aria-hidden': 'true' });
    const vrow = el('div', 'vm-vol-row');
    vrow.append(icon(ICON.vol, 'vm-vol-lo'), els.volRange, icon(ICON.vol.concat(ICON.waves), 'vm-vol-hi'));
    els.volPop.append(els.volVal, vrow);
    els.queuePop = el('div', 'vm-pop vm-queue-pop', { role: 'group' });
    const head = el('div', 'vm-queue-head');
    els.addFiles = el('button', 'vm-chip', { type: 'button' });
    els.addFolder = el('button', 'vm-chip', { type: 'button' });
    els.copyChip = el('button', 'vm-chip vm-copy', { type: 'button', 'aria-pressed': 'false' });
    head.append(els.addFiles, els.addFolder, els.copyChip);
    els.list = el('ul', 'vm-list');
    els.shuffleChip = el('button', 'vm-chip vm-shuffle', { type: 'button', 'aria-pressed': 'false' });
    head.insertBefore(els.shuffleChip, els.copyChip);
    els.soundBtn = el('button', 'vm-chip vm-snd-open', { type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false' });
    head.appendChild(els.soundBtn);
    els.webChip = el('button', 'vm-chip vm-web-chip', { type: 'button', 'aria-pressed': 'false', hidden: '' });
    head.appendChild(els.webChip);
    els.stars = el('div', 'vm-stars', { hidden: '' });
    buildSoundPop();
    // جستجو در فهرست (عنوان، هنرمند، نام فایل؛ فارسی/عربی/اعراب‌دار هم‌ارز)
    els.searchRow = el('div', 'vm-search-row', { hidden: '' });
    const swrap = el('div', 'vm-search-wrap');
    els.search = el('input', 'vm-search', { type: 'text', autocomplete: 'off', spellcheck: 'false', inputmode: 'search', enterkeyhint: 'search', dir: 'auto' });
    els.searchX = el('button', 'vm-search-x', { type: 'button', hidden: '' });
    els.searchX.appendChild(icon(ICON.close));
    els.searchCount = el('span', 'vm-search-count');
    swrap.append(els.search, els.searchX);
    els.searchRow.append(swrap, els.searchCount);
    els.queuePop.append(head, els.searchRow, els.list);
    injectSearchCss();

    els.toast = el('div', 'vm-toast', { role: 'status' });
    els.corner = el('div', 'vm-corner');
    els.close = mkBtn('vm-cbtn vm-close', 'voidMusicClose', icon(ICON.close));
    els.fs = mkBtn('vm-cbtn vm-fs', 'voidMusicFullscreen');
    els.fs.append(icon(ICON.fs, 'i-fs'), icon(ICON.fsExit, 'i-fsx'));
    els.fs.setAttribute('aria-pressed', 'false');
    els.widget = mkBtn('vm-cbtn vm-widget-btn', 'voidMusicShowWidget', icon(ICON.orbit));
    els.widget.setAttribute('aria-pressed', 'false');
    els.corner.append(els.close, els.fs, els.widget);
    els.file = el('input', 'vm-sr', { type: 'file', accept: 'audio/*,.flac,.m4a,.opus', multiple: '', tabindex: '-1', 'aria-hidden': 'true' });
    els.folder = el('input', 'vm-sr', { type: 'file', webkitdirectory: '', multiple: '', tabindex: '-1', 'aria-hidden': 'true' });

    dock.append(els.arc, els.seek, els.time, els.clock, els.vol, els.prev, els.play, els.next, els.queueBtn, els.open, els.openLabel, els.volPop, els.queuePop, els.soundPop, els.toast);
    root.append(els.meta, els.stars, dock, els.corner, els.file, els.folder);
    document.body.appendChild(root);
    clockWatch(true);

    wire();
    els.toast.addEventListener('click', function () { if (toastAction) toastAction(); });
    els.toast.addEventListener('keydown', function (e) {
      if (toastAction && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toastAction(); }
    });
    relabel();
  }

  function injectSearchCss() {
    if (document.getElementById('void-music-search-css')) return;
    const st = document.createElement('style'); st.id = 'void-music-search-css';
    st.textContent =
      '.vm-search-row{display:flex;align-items:center;gap:8px;flex:0 0 auto;padding:4px 2px 8px}' +
      '.vm-search-row[hidden],.vm-search-x[hidden]{display:none!important}' +
      '.vm-search-wrap{position:relative;flex:1;min-width:0}' +
      '.vm-search{width:100%;box-sizing:border-box;font:inherit;font-size:13px;color:inherit;background:rgba(255,255,255,.07);border:1px solid rgba(199,210,254,.22);border-radius:10px;padding:7px 28px;padding-inline:10px 28px;outline:none;transition:border-color .15s,background .15s}' +
      '.vm-search:focus{border-color:rgba(199,210,254,.6);background:rgba(255,255,255,.1)}' +
      '.vm-search::placeholder{color:inherit;opacity:.5}' +
      '.vm-search-x{position:absolute;top:50%;inset-inline-end:5px;transform:translateY(-50%);width:20px;height:20px;padding:0;display:flex;align-items:center;justify-content:center;background:transparent;border:0;border-radius:50%;color:inherit;opacity:.6;cursor:pointer}' +
      '.vm-search-x:hover,.vm-search-x:focus-visible{opacity:1;background:rgba(255,255,255,.12)}' +
      '.vm-search-x .vm-ico{width:12px;height:12px}' +
      '.vm-search-count{font-size:11px;opacity:.6;white-space:nowrap;font-variant-numeric:tabular-nums}' +
      '.vm-shuffle[aria-pressed="true"]{background:rgba(199,210,254,.2);border-color:rgba(199,210,254,.6);color:#fff}' +
      '.vm-empty{list-style:none;padding:14px 8px;text-align:center;font-size:12px;opacity:.6}' +
      '.vm-queue-head{flex-wrap:wrap;gap:6px}' +
      '.vm-rate{display:inline-flex;flex:0 0 auto;align-items:center;margin-inline:6px}' +
      '.vm-rate-s{all:unset;cursor:pointer;font-size:13px;line-height:1;padding:3px 1px;color:rgba(255,255,255,.26);transition:color .12s,transform .12s}' +
      '.vm-rate-s.is-on{color:#ffd68c}.vm-rate-s:hover{color:#ffe7b0;transform:scale(1.2)}' +
      '.vm-rate-s:focus-visible{outline:1px solid rgba(199,210,254,.7);border-radius:3px}' +
      '.vm-stars{position:fixed;z-index:3;display:flex;gap:7px;transform:translateX(-50%);pointer-events:none;direction:ltr}' +
      '.vm-stars[hidden]{display:none!important}' +
      '.vm-star{font-size:19px;line-height:1;color:#ffd68c;text-shadow:0 0 10px rgba(255,200,120,.65),0 0 2px rgba(255,255,255,.7);transition:opacity .35s,transform .35s}' +
      '.vm-star.is-gone{opacity:0;transform:scale(.3)}' +
      '.vm-stars{transition:opacity .6s ease}' +
      '.is-quiet .vm-stars{opacity:0}' +                                  // با خودکارپنهانِ رابط (همان رفتارِ عنوان) ستاره‌ها هم محو می‌شوند
      '.is-powder .vm-stars{opacity:0;transition:none}' +
      '.vm-sound-pop{width:min(440px,calc(100vw - 24px));box-sizing:border-box;padding:12px 14px 14px;display:flex;flex-direction:column;gap:10px;max-height:min(78vh,580px);overflow:auto}' +
      '.vm-sound-pop.is-unavailable .vm-eq-bands,.vm-sound-pop.is-unavailable .vm-snd-spec{opacity:.4;pointer-events:none}' +
      '.vm-snd-head{display:flex;align-items:center;gap:8px}.vm-snd-title{flex:1;font-size:13px;letter-spacing:.04em}' +
      '.vm-snd-spec{width:100%;height:84px;display:block;border-radius:10px;background:rgba(8,10,24,.55)}' +
      '.vm-eq-bands{display:flex;justify-content:space-between;gap:4px;direction:ltr}' +
      '.vm-eq-band{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;outline:none}' +
      '.vm-eq-db{font-size:9px;opacity:.65;font-variant-numeric:tabular-nums;height:11px}' +
      '.vm-eq-track{position:relative;width:100%;height:96px;cursor:ns-resize;touch-action:none}' +
      '.vm-eq-track::before{content:"";position:absolute;left:50%;top:0;bottom:0;width:3px;margin-left:-1.5px;border-radius:2px;background:rgba(255,255,255,.14)}' +
      '.vm-eq-track::after{content:"";position:absolute;left:25%;right:25%;top:50%;height:1px;background:rgba(255,255,255,.22)}' +
      '.vm-eq-fill{position:absolute;left:50%;width:3px;margin-left:-1.5px;border-radius:2px;background:linear-gradient(#ffd68c,#8b7cf6)}' +
      '.vm-eq-thumb{position:absolute;left:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#e9e7ff;box-shadow:0 0 0 2px rgba(139,124,246,.9),0 2px 8px rgba(0,0,0,.5)}' +
      '.vm-eq-band:focus-visible .vm-eq-thumb{box-shadow:0 0 0 3px #ffd68c}.vm-eq-band:not(.is-on) .vm-eq-thumb{opacity:.45}' +
      '.vm-eq-hz{font-size:10px;opacity:.7}' +
      '.vm-snd-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.vm-snd-lbl{font-size:11px;opacity:.75;min-width:78px}.vm-snd-wide{min-width:0;flex:1 1 100%}' +
      '.vm-snd-sel{flex:1;min-width:120px;font:inherit;font-size:12px;color:inherit;background:rgba(255,255,255,.07);border:1px solid rgba(199,210,254,.22);border-radius:8px;padding:5px 8px}' +
      '.vm-snd-sel option{color:#111}.vm-snd-range{flex:1;min-width:120px;accent-color:#a99cff}.vm-snd-val{font-size:11px;opacity:.7;min-width:56px;text-align:end;font-variant-numeric:tabular-nums}' +
      '.vm-seg{display:inline-flex;gap:4px;flex-wrap:wrap}' +
      '.vm-web-chip[hidden]{display:none!important}' +
      '.vm-web-chip[aria-pressed="true"],.vm-snd-on[aria-pressed="true"],.vm-snd-tg[aria-pressed="true"],.vm-seg .vm-chip[aria-pressed="true"]{background:rgba(199,210,254,.2);border-color:rgba(199,210,254,.6);color:#fff}';
    document.head.appendChild(st);
  }

  function relabel() {
    refreshMenuLabel();                       // دکمهٔ نوارِ بالا و منو حتی پیش از ساخته‌شدنِ پلیر
    if (!S.built) return;
    [els.vol, els.prev, els.next, els.queueBtn, els.open, els.close].forEach(function (b) {
      const s = L(b.dataset.k); b.setAttribute('aria-label', s); b.title = s;
    });
    const pk = els.play.getAttribute('aria-pressed') === 'true' ? 'voidMusicPause' : 'voidMusicPlay';
    els.play.dataset.k = pk; els.play.setAttribute('aria-label', L(pk)); els.play.title = L(pk);
    const fsOn = !!document.fullscreenElement;
    els.fs.setAttribute('aria-pressed', fsOn ? 'true' : 'false');
    els.fs.setAttribute('aria-label', L(fsOn ? 'voidMusicExitFullscreen' : 'voidMusicFullscreen')); els.fs.title = els.fs.getAttribute('aria-label');
    els.widget.setAttribute('aria-pressed', S.widgetShown ? 'true' : 'false');
    els.widget.setAttribute('aria-label', L(S.widgetShown ? 'voidMusicHideWidget' : 'voidMusicShowWidget')); els.widget.title = els.widget.getAttribute('aria-label');
    els.openLabel.textContent = L('voidMusicOpen');
    /* عنوانِ هر کلید: برچسبِ نیمه‌مانده با hover کامل خوانده می‌شود و خودِ کلید هم
       توضیح می‌خواهد — «صدا» برای پنلی که کیفیتِ کهکشان را هم ست می‌کند کم است. */
    els.addFiles.textContent = L('voidMusicAddFiles'); els.addFiles.title = L('voidMusicTipAddFiles');
    els.addFolder.textContent = L('voidMusicAddFolder'); els.addFolder.title = L('voidMusicTipAddFolder');
    els.copyChip.textContent = L('voidMusicKeepCopy'); els.copyChip.title = L('voidMusicTipKeepCopy');
    els.shuffleChip.textContent = L('voidMusicShuffle'); els.shuffleChip.title = L('voidMusicTipShuffle');
    els.soundBtn.textContent = L('voidMusicSound'); els.soundBtn.title = L('voidMusicTipSound'); relabelSound(); setWebChip(S.webChipState);
    els.shuffleChip.setAttribute('aria-pressed', S.shuffle ? 'true' : 'false');
    els.search.placeholder = L('voidMusicSearch'); els.search.setAttribute('aria-label', L('voidMusicSearch'));
    els.searchX.setAttribute('aria-label', L('voidMusicSearchClear')); els.searchX.title = L('voidMusicSearchClear');
    els.copyChip.setAttribute('aria-pressed', S.copyMode ? 'true' : 'false');
    els.queuePop.setAttribute('aria-label', L('voidMusicQueue'));
    els.volPop.setAttribute('aria-label', L('voidMusicVolume'));
    els.volRange.setAttribute('aria-label', L('voidMusicVolume')); els.volRange.title = L('voidMusicTipVolume');
    els.seek.setAttribute('aria-label', L('voidMusicSeek')); els.seek.title = L('voidMusicTipSeek');
    root.setAttribute('aria-label', L('ntpMenuMusic'));
    let rtl = false;
    try { rtl = typeof isRTL === 'function' && isRTL(currentLang); } catch (e) {}
    els.queuePop.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    els.volPop.setAttribute('dir', 'ltr');
    refreshMenuLabel();
  }
  function refreshMenuLabel() {
    const fb = document.getElementById('ai-ntp-fs-btn');
    if (fb) { const t = L(document.fullscreenElement ? 'voidMusicExitFullscreen' : 'voidMusicFullscreen'); fb.title = t; fb.setAttribute('aria-label', t); }
    const q = document.getElementById('ai-ntp-music-btn');
    if (q) { const t = L('ntpMenuMusic'); q.title = t; q.setAttribute('aria-label', t); }
  }
  // چهارمین دکمهٔ نوارِ بالا: هنگامِ پخش چشمک می‌زند (کلاسِ is-playing)
  function syncQuick() {
    const q = document.getElementById('ai-ntp-music-btn');
    if (q) q.classList.toggle('is-playing', isPlaying());
  }
  // تمام‌صفحه برای صفحهٔ اصلیِ Void Tab (جدا از fsByUs که فقط مالِ دکمهٔ داخلِ Music Mode است)
  async function togglePageFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch (e) {}
    syncFsMenu();                       // بدونِ انتظار برای رویدادِ fullscreenchange
  }
  function syncFsMenu() {
    const on = !!document.fullscreenElement;
    const b = document.getElementById('ai-ntp-fs-btn');
    if (b) { b.setAttribute('data-on', on ? '1' : '0'); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    refreshMenuLabel();
    if (S.widgetShown) forceWidgetVisible();     // در تمام‌صفحه ممکن است ابزارک خودش را مخفی کرده باشد
  }

  /* ---- چیدمانِ هندسی: دکمه‌ها روی یک کمانِ کم‌عمق (هم‌زبان با کمربندِ زودیاک) ---- */
  const POS = { vol: .08, prev: .31, play: .5, next: .69, queue: .92 };
  function layout() {
    if (!S.built) return;
    const vw = window.innerWidth;
    const compact = vw < 520;
    const W = Math.min(580, vw - 24);
    const sag = compact ? 16 : 26;
    const base = sag + 82;                // y خطِ کمان در لبه‌ها
    const H = base + 36;
    const yAt = function (u) { return base - 4 * sag * u * (1 - u); };
    dock.style.width = W + 'px';
    dock.style.height = H + 'px';
    els.arc.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    els.grad.setAttribute('x2', String(W));
    const d = 'M 0 ' + base + ' Q ' + (W / 2) + ' ' + (base - 2 * sag) + ' ' + W + ' ' + base;
    els.base.setAttribute('d', d); els.fill.setAttribute('d', d);
    S.layoutW = W; S.layoutBase = base; S.layoutSag = sag;
    const place = function (node, u, dy) { node.style.left = (u * W) + 'px'; node.style.top = (yAt(u) - dy) + 'px'; };
    const pu = compact ? { vol: .09, prev: .31, play: .5, next: .69, queue: .91 } : POS;
    place(els.vol, pu.vol, 46); place(els.prev, pu.prev, 46); place(els.play, pu.play, 52);
    place(els.next, pu.next, 46); place(els.queueBtn, pu.queue, 46);
    els.open.style.left = (W / 2) + 'px'; els.open.style.top = (yAt(.5) - 30) + 'px';
    els.openLabel.style.left = (W / 2) + 'px'; els.openLabel.style.top = (yAt(.5) + 12) + 'px';
    els.seek.style.top = (base - sag - 12) + 'px'; els.seek.style.width = W + 'px'; els.seek.style.height = (sag + 26) + 'px';
    // تیک‌ها: ۱۲ نشانه (اشاره به دوازده برج)
    els.ticks.textContent = '';
    for (let k = 0; k <= 12; k++) {
      const u = k / 12, x = u * W, y = yAt(u);
      const slope = -4 * sag * (1 - 2 * u) / W;      // dy/dx
      const nl = Math.sqrt(1 + slope * slope), nx = -slope / nl, ny = 1 / nl;
      els.ticks.appendChild(svg('line', { x1: (x + nx * 6).toFixed(1), y1: (y + ny * 6).toFixed(1), x2: (x + nx * 10).toFixed(1), y2: (y + ny * 10).toFixed(1) }, 'vm-tick'));
    }
    // پاپ‌اورها
    // پاپ‌اورها از پایین لنگر می‌شوند (همیشه بالای دکمه‌ها باز می‌شوند، نه روی آن‌ها)
    els.volPop.style.left = (pu.vol * W) + 'px'; els.volPop.style.top = ''; els.volPop.style.bottom = (H - (yAt(pu.vol) - 78)) + 'px';
    els.queuePop.style.right = '0px'; els.queuePop.style.top = ''; els.queuePop.style.bottom = (H - (yAt(pu.queue) - 78)) + 'px';
    els.soundPop.style.right = '0px'; els.soundPop.style.top = ''; els.soundPop.style.bottom = (H - (yAt(pu.queue) - 78)) + 'px';
    placeStars();
    els.toast.style.top = '-8px'; els.toast.style.transform = '';
    els.toast.style.left = '50%';
    updateProgress();
  }

  /* ---- هم‌گام‌سازی نمایش ---- */
  let metaTimer = 0;
  function setMeta(title, artist, coverUrl, onApplied) {
    const apply = function () {
      els.title.textContent = title || '';
      els.artist.textContent = artist || '';
      renderStars();
      if (coverUrl) { els.cover.src = coverUrl; els.cover.hidden = false; }
      else { els.cover.removeAttribute('src'); els.cover.hidden = true; }
      els.meta.classList.toggle('is-blank', !title);
      els.meta.classList.remove('is-out');
      if (title) document.title = '\u266A ' + title;
      if (typeof onApplied === 'function') onApplied();
    };
    clearTimeout(metaTimer);
    if (!title || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { apply(); return; }
    els.meta.classList.add('is-out');
    metaTimer = setTimeout(apply, 240);
  }
  function syncEmpty() {
    const empty = !S.tracks.length;
    dock.classList.toggle('is-empty', empty);
    root.classList.toggle('vm-root-meta-empty', empty);
  }
  function onPlayState() {
    const playing = !!(S.audio && !S.audio.paused);
    if (!playing) releasePlayback();
    els.play.setAttribute('aria-pressed', playing ? 'true' : 'false');
    root.classList.toggle('is-playing', playing);
    if (S.lastPlaying !== playing) {
      S.lastPlaying = playing;
      try { window.dispatchEvent(new CustomEvent('voidmusic:playing', { detail: { playing: playing } })); } catch (e) {}
    }
    relabel();
    poke();
    syncMini(); syncQuick(); syncRemoteTimer();
    if ('mediaSession' in navigator) { try { navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'; } catch (e) {} }
    posState();
  }
  function updateProgress() {
    if (!S.built) return;
    const a = S.audio;
    const dur = a && isFinite(a.duration) ? a.duration : 0;
    const cur = S.dragging ? S.dragFrac * dur : (a ? a.currentTime : 0);
    const frac = dur > 0 ? clamp(cur / dur, 0, 1) : 0;
    els.fill.setAttribute('stroke-dashoffset', String(1000 * (1 - frac)));
    try {
      const len = els.base.getTotalLength();
      const pt = els.base.getPointAtLength(frac * len);
      els.thumb.style.transform = 'translate(' + pt.x.toFixed(1) + 'px,' + pt.y.toFixed(1) + 'px)';
    } catch (e) {}
    els.time.textContent = fmt(cur) + ' \u00B7 ' + fmt(dur);
    els.seek.setAttribute('aria-valuemax', String(Math.round(dur)));
    els.seek.setAttribute('aria-valuenow', String(Math.round(cur)));
    els.seek.setAttribute('aria-valuetext', fmt(cur) + ' / ' + fmt(dur));
    if (S.mini && !S.open) syncMini();
  }

  /* ------------------------------------------------------------------ */
  /* ساعتِ محلیِ دستگاه: HH:MM بیست‌وچهارساعته + نشانِ خورشید/ماه            */
  /* مستقل از پخش کار می‌کند، حلقهٔ رندرِ جدیدی نمی‌سازد و DOM را فقط وقتی */
  /* مقدار واقعاً عوض شده می‌نویسد (یعنی حداکثر دقیقه‌ای یک بار).           */
  /* ------------------------------------------------------------------ */
  const CLK = { iv: 0, hhmm: '', day: null };
  const DAY_FROM = 6, DAY_UNTIL = 19;          // خورشید ۰۶:۰۰ تا ۱۸:۵۹ِ زمانِ دستگاه، بعدش ماه
  function tickClock() {
    const d = new Date();
    const h = d.getHours(), mi = d.getMinutes();
    const hhmm = (h < 10 ? '0' : '') + h + ':' + (mi < 10 ? '0' : '') + mi;
    const day = h >= DAY_FROM && h < DAY_UNTIL;
    if (hhmm === CLK.hhmm && day === CLK.day) return;
    CLK.hhmm = hhmm; CLK.day = day;
    els.clockGlyph.textContent = day ? '\u2600' : '\u263E';
    els.clockText.textContent = hhmm;
    els.clock.setAttribute('aria-label', L('voidMusicClock') + ' ' + hhmm);
    els.clock.title = L('voidMusicClock') + ' ' + hhmm;
  }
  function clockWatch(on) {
    if (on && S.built && !CLK.iv) { tickClock(); CLK.iv = setInterval(tickClock, 1000); }
    else if (!on && CLK.iv) { clearInterval(CLK.iv); CLK.iv = 0; }
  }
  function syncVolume() {
    const muted = !!(S.muted || S.vol === 0);
    els.vol.dataset.muted = muted ? '1' : '0';
    const pct = Math.round((muted ? 0 : S.vol) * 100);
    els.vol.dataset.level = muted ? '0' : (S.vol < 0.34 ? '1' : '2');
    els.volRange.value = String(Math.round(S.vol * 100));
    els.volRange.style.setProperty('--p', Math.round(S.vol * 100) + '%');
    els.volRange.setAttribute('aria-valuetext', pct + '%');
    els.volVal.textContent = muted ? '0%' : pct + '%';
  }
  let toastTimer = 0;
  let toastAction = null;
  function toast(msg, action, actionLabel) {
    S.toastLog.push({ msg: msg, action: typeof action === 'function' ? 1 : 0 });
    if (S.toastLog.length > 24) S.toastLog.shift();
    if (!S.built) return;
    els.toast.textContent = msg;
    toastAction = typeof action === 'function' ? action : null;
    els.toast.classList.toggle('is-actionable', !!toastAction);
    if (toastAction) {
      const lab = actionLabel || L('voidMusicSwitchToPlayingTab');
      els.toast.setAttribute('role', 'button');
      els.toast.tabIndex = 0;
      els.toast.title = lab;
      els.toast.setAttribute('aria-label', msg + ' ' + lab);
    } else {
      els.toast.setAttribute('role', 'status');
      els.toast.removeAttribute('tabindex');
      els.toast.removeAttribute('title');
      els.toast.removeAttribute('aria-label');
    }
    els.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.classList.remove('is-on', 'is-actionable');
      toastAction = null;
      els.toast.setAttribute('role', 'status');
      els.toast.removeAttribute('tabindex');
      els.toast.removeAttribute('title');
      els.toast.removeAttribute('aria-label');
    }, 2600);
  }

  /* ---- پنل صدا: اکولایزر ۱۰ باندِ استاندارد + نمایشگرِ طیف + کیفیت/مصرف ---- */
  const SND_PRESETS = ['flat', 'bass', 'treble', 'vocal', 'rock', 'pop', 'jazz', 'classical', 'electronic', 'lounge'];
  const PRESET_KEY = { flat: 'voidMusicPrFlat', bass: 'voidMusicPrBass', treble: 'voidMusicPrTreble', vocal: 'voidMusicPrVocal', rock: 'voidMusicPrRock', pop: 'voidMusicPrPop',
    jazz: 'voidMusicPrJazz', classical: 'voidMusicPrClassical', electronic: 'voidMusicPrElectronic', lounge: 'voidMusicPrLounge', custom: 'voidMusicPrCustom' };
  const BAND_LBL = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
  const BAND_HZ = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  const SPEC = { raf: 0, last: 0, buf: new Float32Array(32), peak: new Float32Array(32), w: 0, h: 0, g: null, vis: false };
  function sv() { return (window.VoidMusicViz && window.VoidMusicViz.sound) || null; }
  function fmtDb(v) { return (v > 0 ? '+' : '') + (v % 1 ? v.toFixed(1) : String(v)); }
  function buildSoundPop() {
    els.soundPop = el('div', 'vm-pop vm-sound-pop', { role: 'dialog' });
    const head = el('div', 'vm-snd-head');
    els.sndTitle = el('strong', 'vm-snd-title');
    els.sndOn = el('button', 'vm-chip vm-snd-on', { type: 'button', 'aria-pressed': 'true' });
    els.sndReset = el('button', 'vm-chip vm-snd-reset', { type: 'button' });
    head.append(els.sndTitle, els.sndOn, els.sndReset);
    els.spec = el('canvas', 'vm-snd-spec', { 'aria-hidden': 'true' });
    const bands = el('div', 'vm-eq-bands');
    els.eqEls = [];
    for (let i = 0; i < 10; i++) {
      const b = el('div', 'vm-eq-band', { tabindex: '0', role: 'slider', 'aria-orientation': 'vertical', 'aria-valuemin': '-12', 'aria-valuemax': '12', 'aria-valuenow': '0' });
      const db = el('span', 'vm-eq-db'), track = el('div', 'vm-eq-track'), fill = el('div', 'vm-eq-fill'), thumb = el('div', 'vm-eq-thumb'), hz = el('span', 'vm-eq-hz');
      hz.textContent = BAND_LBL[i]; track.append(fill, thumb); b.append(db, track, hz); bands.appendChild(b);
      els.eqEls.push({ b: b, db: db, fill: fill, thumb: thumb, track: track });
      wireBand(i);
    }
    const r1 = el('div', 'vm-snd-row');
    els.sndPresetLbl = el('label', 'vm-snd-lbl'); els.sndPreset = el('select', 'vm-snd-sel');
    SND_PRESETS.concat(['custom']).forEach(function (k) { const o = el('option'); o.value = k; els.sndPreset.appendChild(o); });
    r1.append(els.sndPresetLbl, els.sndPreset);
    const r2 = el('div', 'vm-snd-row');
    els.sndPreLbl = el('label', 'vm-snd-lbl'); els.sndPre = el('input', 'vm-snd-range', { type: 'range', min: '-12', max: '12', step: '0.5', value: '0' }); els.sndPreVal = el('span', 'vm-snd-val');
    r2.append(els.sndPreLbl, els.sndPre, els.sndPreVal);
    const r3 = el('div', 'vm-snd-row');
    els.sndLim = el('button', 'vm-chip vm-snd-tg', { type: 'button', 'aria-pressed': 'true' }); els.sndAuto = el('button', 'vm-chip vm-snd-tg', { type: 'button', 'aria-pressed': 'true' });
    r3.append(els.sndLim, els.sndAuto);
    const seg = function (items) { const w = el('div', 'vm-seg'); items.forEach(function (it) { it.btn = el('button', 'vm-chip', { type: 'button', 'aria-pressed': 'false' }); w.appendChild(it.btn); }); return w; };
    els.bgItems = [{ v: 'audio', k: 'voidMusicBgAudio', tp: 'voidMusicTipBgAudio' }, { v: 'live', k: 'voidMusicBgLive', tp: 'voidMusicTipBgLive' }];
    els.vqItems = [{ v: 'auto', k: 'voidMusicQAuto', tp: 'voidMusicTipQAuto' }, { v: 'low', k: 'voidMusicQLow', tp: 'voidMusicTipQLow' }, { v: 'high', k: 'voidMusicQHigh', tp: 'voidMusicTipQHigh' }];
    const r4 = el('div', 'vm-snd-row'); els.sndBgLbl = el('label', 'vm-snd-lbl vm-snd-wide'); r4.append(els.sndBgLbl, seg(els.bgItems));
    const r5 = el('div', 'vm-snd-row'); els.sndVqLbl = el('label', 'vm-snd-lbl vm-snd-wide'); r5.append(els.sndVqLbl, seg(els.vqItems));
    els.soundPop.append(head, els.spec, bands, r1, r2, r3, r4, r5);
    const set = function (patch) { const s = sv(); if (s) s.set(patch); syncSoundUI(); };
    els.sndOn.addEventListener('click', function () { const s = sv(); if (s) set({ on: !s.get().on }); });
    els.sndReset.addEventListener('click', function () { const s = sv(); if (s) { s.reset(); syncSoundUI(); } });
    els.sndPreset.addEventListener('change', function () { const s = sv(); if (s && els.sndPreset.value !== 'custom') { s.preset(els.sndPreset.value); syncSoundUI(); } });
    els.sndPre.addEventListener('input', function () { set({ pre: Number(els.sndPre.value) }); });
    els.sndLim.addEventListener('click', function () { const s = sv(); if (s) set({ limiter: !s.get().limiter }); });
    els.sndAuto.addEventListener('click', function () { const s = sv(); if (s) set({ auto: !s.get().auto }); });
    els.bgItems.forEach(function (it) { it.btn.addEventListener('click', function () { set({ bg: it.v }); }); });
    els.vqItems.forEach(function (it) { it.btn.addEventListener('click', function () { set({ vq: it.v }); }); });
    els.soundPop.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); closePops(); try { els.queueBtn.focus({ preventScroll: true }); } catch (x) {} } });
    document.addEventListener('visibilitychange', function () { if (!document.hidden && els.soundPop.classList.contains('is-open') && !SPEC.raf) SPEC.raf = requestAnimationFrame(specLoop); });
  }
  function wireBand(i) {
    const E = els.eqEls[i], tr = E.track;
    const valFromY = function (y) { const r = tr.getBoundingClientRect(); return Math.round((12 - clamp((y - r.top) / Math.max(1, r.height), 0, 1) * 24) * 2) / 2; };
    const apply = function (db) { const s = sv(); if (!s) return; const b = s.get().bands; b[i] = clamp(db, -12, 12); s.set({ bands: b }); syncSoundUI(); };
    let drag = false;
    tr.addEventListener('pointerdown', function (e) { drag = true; try { tr.setPointerCapture(e.pointerId); } catch (x) {} apply(valFromY(e.clientY)); e.preventDefault(); });
    tr.addEventListener('pointermove', function (e) { if (drag) apply(valFromY(e.clientY)); });
    const end = function () { drag = false; };
    tr.addEventListener('pointerup', end); tr.addEventListener('pointercancel', end);
    tr.addEventListener('dblclick', function () { apply(0); });
    E.b.addEventListener('keydown', function (e) {
      const s = sv(); if (!s) return;
      const cur = s.get().bands[i]; let nv = null;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') nv = cur + 0.5; else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') nv = cur - 0.5;
      else if (e.key === 'PageUp') nv = cur + 3; else if (e.key === 'PageDown') nv = cur - 3;
      else if (e.key === 'Home') nv = -12; else if (e.key === 'End') nv = 12; else if (e.key === '0') nv = 0;
      if (nv === null) return;
      e.preventDefault(); e.stopPropagation(); apply(nv);
    });
  }
  function syncSoundUI() {
    if (!S.built) return;
    const s = sv(), g = s ? s.get() : null;
    els.soundPop.classList.toggle('is-unavailable', !g);
    if (!g) return;
    els.sndOn.setAttribute('aria-pressed', g.on ? 'true' : 'false');
    els.eqEls.forEach(function (E, i) {
      const v = g.bands[i], pct = (12 - v) / 24 * 100;
      E.thumb.style.top = pct + '%'; E.fill.style.top = Math.min(pct, 50) + '%'; E.fill.style.height = Math.abs(pct - 50) + '%';
      E.db.textContent = fmtDb(v); E.b.setAttribute('aria-valuenow', String(v)); E.b.setAttribute('aria-valuetext', fmtDb(v) + ' dB'); E.b.classList.toggle('is-on', g.on);
    });
    els.sndPreset.value = g.preset; els.sndPre.value = String(g.pre); els.sndPreVal.textContent = fmtDb(g.pre) + ' dB';
    els.sndLim.setAttribute('aria-pressed', g.limiter ? 'true' : 'false'); els.sndAuto.setAttribute('aria-pressed', g.auto ? 'true' : 'false');
    els.bgItems.forEach(function (it) { it.btn.setAttribute('aria-pressed', g.bg === it.v ? 'true' : 'false'); });
    els.vqItems.forEach(function (it) { it.btn.setAttribute('aria-pressed', g.vq === it.v ? 'true' : 'false'); });
  }
  function relabelSound() {
    if (!els.soundPop) return;
    els.sndTitle.textContent = L('voidMusicSound'); els.sndOn.textContent = L('voidMusicEqualizer'); els.sndReset.textContent = L('voidMusicResetSound');
    els.sndPresetLbl.textContent = L('voidMusicPreset'); els.sndPreLbl.textContent = L('voidMusicPreamp');
    els.sndLim.textContent = L('voidMusicLimiter'); els.sndAuto.textContent = L('voidMusicAutoGain');
    /* برچسبِ متنیِ کنارِ هر کنترل هم نیمه‌می‌افتد و راهنما می‌خواهد؛ chrome در real DOM نشان داد
       که فقط sndBgLbl/sndVqLbl عنوان داشتند و «پیش‌تنظیم»/«پیش‌تقویت» بی‌عنوان مانده بودند. */
    els.sndPresetLbl.title = L('voidMusicTipPreset'); els.sndPreLbl.title = L('voidMusicTipPreamp');
    els.sndBgLbl.textContent = L('voidMusicBgMode'); els.sndVqLbl.textContent = L('voidMusicVisQuality');
    Array.prototype.forEach.call(els.sndPreset.options, function (o) { o.textContent = L(PRESET_KEY[o.value]); });
    els.bgItems.concat(els.vqItems).forEach(function (it) { it.btn.textContent = L(it.k); });
    els.spec.setAttribute('aria-label', L('voidMusicEqualizer')); els.soundPop.setAttribute('aria-label', L('voidMusicSound'));
    /* راهنمایِ هر کنترلِ پنلِ صدا؛ باندِ اکولایزر هیچ نامِ دسترسی‌پذیری نداشت
       (فقط اسلایدر + عددِ dB)، پس نامِ «باندِ 1000 Hz» همین‌جا ساخته می‌شود. */
    els.sndOn.title = L('voidMusicTipSndOn'); els.sndReset.title = L('voidMusicTipSndReset');
    els.sndPreset.title = L('voidMusicTipPreset'); els.sndPreset.setAttribute('aria-label', L('voidMusicPreset'));
    els.sndPre.title = L('voidMusicTipPreamp'); els.sndPre.setAttribute('aria-label', L('voidMusicPreamp'));
    els.sndLim.title = L('voidMusicTipLimiter'); els.sndAuto.title = L('voidMusicTipAutoGain');
    els.sndBgLbl.title = L('voidMusicTipSound'); els.sndVqLbl.title = L('voidMusicTipSound');
    els.spec.title = L('voidMusicTipSpectrum');
    els.bgItems.concat(els.vqItems).forEach(function (it) { it.btn.title = L(it.tp); it.btn.setAttribute('aria-label', L(it.k)); });
    els.eqEls.forEach(function (E, i) { const t = L('voidMusicTipEqBand').replace('{hz}', BAND_HZ[i] + ' Hz'); E.b.title = t; E.b.setAttribute('aria-label', t); });
    syncSoundUI();
  }
  function sizeSpec() {
    const r = els.spec.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    SPEC.w = Math.max(1, r.width); SPEC.h = Math.max(1, r.height);
    els.spec.width = Math.max(1, Math.round(SPEC.w * dpr)); els.spec.height = Math.max(1, Math.round(SPEC.h * dpr));
    SPEC.g = els.spec.getContext('2d'); if (SPEC.g) SPEC.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function drawSpec() {
    const g = SPEC.g; if (!g) return;
    const s = sv(), W = SPEC.w, H = SPEC.h, M = SPEC.buf.length;
    const live = !!(s && s.spectrum(SPEC.buf));
    if (!live) for (let i = 0; i < M; i++) SPEC.buf[i] *= 0.85;
    g.clearRect(0, 0, W, H);
    const bw = W / M;
    for (let i = 0; i < M; i++) {
      const v = clamp(SPEC.buf[i], 0, 1), h = Math.max(1.5, Math.pow(v, 1.15) * (H - 6));
      g.fillStyle = 'hsl(' + Math.round(255 - i * 6.6) + ',85%,' + Math.round(50 + v * 20) + '%)';
      g.fillRect(i * bw + 1, H - h, Math.max(1, bw - 2), h);
      SPEC.peak[i] = Math.max(v, SPEC.peak[i] - 0.012);
      g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(i * bw + 1, H - Math.max(2, SPEC.peak[i] * (H - 6)) - 2, Math.max(1, bw - 2), 1.5);
    }
    // منحنیِ پاسخِ اکولایزر روی نمودار
    const gs = s ? s.get() : null;
    if (gs && gs.on) {
      const pts = BAND_HZ.map(function (hz, i) { return [clamp(Math.log(hz / 40) / Math.log(400), 0, 1) * W, H * (0.5 - gs.bands[i] / 24 * 0.9)]; });
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); }
      g.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
      g.lineWidth = 2; g.strokeStyle = 'rgba(255,214,140,.95)'; g.shadowColor = 'rgba(255,200,120,.7)'; g.shadowBlur = 6; g.stroke(); g.shadowBlur = 0;
    }
  }
  function specLoop(now) {
    SPEC.raf = 0;
    if (!els.soundPop.classList.contains('is-open') || document.hidden) return;     // پنل بسته/تب پنهان: هیچ ترسیمی
    if (now - SPEC.last >= 33) { SPEC.last = now; drawSpec(); }
    SPEC.raf = requestAnimationFrame(specLoop);
  }
  function soundPanelOpen(on) {
    const s = sv();
    if (on) { relabelSound(); sizeSpec(); if (s) s.watch(true); if (!SPEC.raf) SPEC.raf = requestAnimationFrame(specLoop); }
    else { if (s) s.watch(false); if (SPEC.raf) { cancelAnimationFrame(SPEC.raf); SPEC.raf = 0; } }
  }

  /* ---- امتیاز ستاره‌ای آهنگ‌ها ---- */
  function curTrack() { for (let i = 0; i < S.tracks.length; i++) if (S.tracks[i].id === S.curId) return S.tracks[i]; return null; }
  function setStars(id, n) {
    const tr = S.tracks.find(function (t) { return t.id === id; }); if (!tr) return;
    tr.stars = clamp(n | 0, 0, 5);
    try { if (tr.rootId || tr.copy || (tr.handle && !tr.file)) dbPut(tr); } catch (e) {}
    if (tr.id === S.curId) S.flownId = null;               // کاربر امتیاز را عوض کرد: ستاره‌ها دوباره نشان داده شوند
    renderQueue(); renderStars();
  }
  function placeStars() {
    if (!S.built || !els.stars || els.stars.hidden) return;
    const tr = els.title.getBoundingClientRect(), ar = els.artist.getBoundingClientRect();
    const bottom = Math.max(tr.bottom, ar.height ? ar.bottom : 0);
    let cx = tr.left + tr.width / 2;
    try { const rg = document.createRange(); rg.selectNodeContents(els.title); const b = rg.getBoundingClientRect(); if (b.width) cx = b.left + b.width / 2; } catch (e) {}
    els.stars.style.left = Math.round(cx) + 'px'; els.stars.style.top = Math.round(bottom + 10) + 'px';
  }
  function renderStars() {
    if (!S.built) return;
    if (S.starsFor !== S.curId) { S.starsFor = S.curId; S.flownId = null; }
    const tr = curTrack(), n = tr ? (tr.stars || 0) : 0;
    els.stars.textContent = '';
    const flown = S.flownId === S.curId;
    for (let i = 0; i < n; i++) { const sp = el('span', 'vm-star' + (flown ? ' is-gone' : '')); sp.textContent = '\u2605'; els.stars.appendChild(sp); }
    els.stars.hidden = !n;
    els.stars.setAttribute('aria-label', n ? L('voidMusicRateN').replace('{n}', String(n)) : '');
    placeStars();
    scheduleStarsAutoHide();
  }
  // نمایشِ ستاره‌ها خودکار تمام می‌شود: اگر پروازِ دنباله‌دارها انجام نشد (مثلاً بدونِ پودرِ ورودی، مکث، یا امتیازدهیِ دستی)، پس از چند ثانیه محو می‌شوند
  const STAR_SHOW_MS = 10000;
  function scheduleStarsAutoHide() {
    clearTimeout(S.starsTimer); S.starsTimer = 0;
    if (!S.built || els.stars.hidden || S.flownId === S.curId) return;
    S.starsTimer = setTimeout(function () {
      S.starsTimer = 0;
      if (!S.built) return;
      Array.prototype.forEach.call(els.stars.children, function (c) { c.classList.add('is-gone'); });
      S.flownId = S.curId;
    }, STAR_SHOW_MS);
  }

  /* ---- منبعِ وب (SoundCloud / YouTube Music / …): «صدای مجازی» با رابطِ HTMLAudioElement جای S.audio می‌نشیند ---- */
  function webHandlers() {
    return S._wh || (S._wh = { play: onPlayState, pause: onPlayState, timeupdate: updateProgress, durationchange: function () { updateProgress(); posState(); }, seeked: posState });
  }
  function attachWeb(proxy, info) {
    if (!proxy) return;
    if (S.web === proxy) { setWebMeta(info); return; }
    if (S.web) detachWeb({ pauseSite: false, quiet: true });
    if (S.localAudio && !S.localAudio.paused) { try { S.localAudio.pause(); } catch (e) {} }
    S.curIdBeforeWeb = S.curId; S.curId = null; S.web = proxy; S.audio = proxy;
    const h = webHandlers(); Object.keys(h).forEach(function (k) { proxy.addEventListener(k, h[k]); });
    S.webKey = ''; setWebMeta(info);
    if (S.built) { renderQueue(); renderStars(); }
    onPlayState(); updateProgress();
  }
  function detachWeb(opts) {
    const p = S.web; if (!p) return;
    opts = opts || {};
    S.web = null;
    try { p.onDetach && p.onDetach(opts); } catch (e) {}
    const h = webHandlers(); Object.keys(h).forEach(function (k) { p.removeEventListener(k, h[k]); });
    if (S.localAudio) S.audio = S.localAudio; else { S.audio = null; ensureAudio(); }
    S.curId = S.curIdBeforeWeb == null ? null : S.curIdBeforeWeb; S.curIdBeforeWeb = null; S.webKey = '';
    if (!opts.quiet && S.built) { const tr = curTrack(); setMeta(tr ? tr.title : '', tr ? tr.artist : '', null); renderQueue(); renderStars(); }
    onPlayState(); updateProgress();
  }
  function setWebMeta(info) {
    if (!S.web || !info) return;
    const key = [info.title, info.artist, info.art].join('\u0001');
    if (key === S.webKey) return;
    S.webKey = key;
    const tok = ++S.token, id = 'web:' + S.web.tabId;
    S.seed = rand32();
    try { window.dispatchEvent(new CustomEvent('voidmusic:track', { detail: { id: id, title: info.title, seed: S.seed } })); } catch (e) {}
    setMeta(info.title, info.artist, info.art || null, function () {
      try { window.dispatchEvent(new CustomEvent('voidmusic:title-ready', { detail: { id: id, title: info.title, artist: info.artist, seed: S.seed, generation: tok } })); } catch (e) {}
    });
  }
  // دلیل‌هایی که «سایت اجازه نمی‌دهد» (نه خرابیِ اتصال): کاربر نباید آن را با خطای افزونه اشتباه بگیرد
  var WEB_FAIL_BLOCKED = { capture_denied: 1, restricted_page: 1, stream_denied: 1, self: 1, bad_tab: 1, tab_gone: 1 };
  // وضعیتِ «تحلیل» صادقانه از موتورِ ویژولایزر می‌آید: «stream گرفتم» با «کهکشان داده دارد» یکی نیست.
  var WEB_ANALYSIS_KEY = { live: 'voidMusicWebAnLive', silent: 'voidMusicWebAnSilent', untapped: 'voidMusicWebAnUntapped', suspended: 'voidMusicWebAnSuspended', building: 'voidMusicWebAnBuilding', failed: 'voidMusicWebAnFailed', nostream: 'voidMusicWebAnNoStream', noviz: 'voidMusicWebAnNoStream' };
  function setWebChip(c) {
    S.webChipState = c || null;
    if (!S.built || !els.webChip) return;
    if (!c) { els.webChip.hidden = true; return; }
    els.webChip.hidden = false;
    const audio = c.audio || 'none';
    const an = c.analysis || 'none';
    const state = an === 'live' ? 'live' : audio === 'pending' ? 'pending' : audio === 'failed' || an === 'failed' ? 'failed'
      : an === 'silent' || an === 'untapped' || an === 'suspended' || an === 'building' || an === 'nostream' || an === 'noviz' ? 'linked'
      : c.playing ? 'detected' : 'idle';
    // ◉ = وصل است ولی دادهٔ تحلیل نمی‌رسد؛ هرگز آن را با ● (کهکشان زنده) اشتباه نگیر
    const glyph = an === 'live' ? '●' : audio === 'pending' ? '◐' : (audio === 'failed' || an === 'failed') ? '✕'
      : state === 'linked' ? '◉' : '○';
    const site = c.label || L('voidMusicWebSource');
    els.webChip.textContent = site + (c.count > 1 ? ' +' + (c.count - 1) : '') + ' ' + glyph;
    els.webChip.className = 'vm-chip vm-web-chip is-' + state;
    els.webChip.setAttribute('aria-pressed', c.on ? 'true' : 'false');
    const parts = [site, c.playing ? L('voidMusicWebPlaying').replace('{site}', site) : L('voidMusicWebPaused')];
    if (audio === 'pending') parts.push(L('voidMusicWebAudioPending'));
    else if (audio === 'failed') parts.push((WEB_FAIL_BLOCKED[c.fail] ? L('voidMusicWebSiteBlocked') : L('voidMusicWebAudioFailed')) + ' — ' + L('voidMusicWebRetry') + ' · ' + (c.fail || 'unknown'));
    else if (audio === 'live' && WEB_ANALYSIS_KEY[an]) {
      parts.push(L(WEB_ANALYSIS_KEY[an]));
      if (typeof c.db === 'number' && (an === 'live' || an === 'silent')) parts.push(c.db + ' dB');
    } else if (c.on) parts.push(L('voidMusicWebAudioNone'));
    const title = parts.filter(Boolean).join(' · ');
    els.webChip.title = title; els.webChip.setAttribute('aria-label', title);
  }

  function setQuery(q) {
    S.query = q || '';
    if (S.built) { els.search.value = S.query; renderQueue(); }
  }
  function renderQueue() {
    if (!S.built) return;
    const toks = normQ(S.query).split(' ').filter(Boolean);
    els.list.textContent = '';
    let shown = 0;
    S.tracks.forEach(function (tr) {
      if (toks.length) {
        const hay = normQ(tr.title + ' ' + tr.artist + ' ' + tr.name);
        for (let k = 0; k < toks.length; k++) if (hay.indexOf(toks[k]) < 0) return;
      }
      shown++;
      /* دو حالتِ متمایز: «فایل واقعاً نیست» (is-bad، خط‌خورده) و «هست ولی پوشه اجازه می‌خواهد»
         (is-grant، نقطهٔ رُز + راهنما). بی‌این تفکیک، کاربرِ گرفتارِ «دسترسی باطل» ردیفِ سالم
         را خراب می‌پنداشت و روی همان کلیک نمی‌کرد. */
      const li = el('li', 'vm-row' + (tr.id === S.curId ? ' is-cur' : '') + (tr.bad ? ' is-bad' : '') + (tr.needGrant && !tr.bad ? ' is-grant' : ''));
      const main = el('button', 'vm-row-main', { type: 'button' });
      main.appendChild(el('span', 'dot'));
      const tt = el('span', 't'); tt.textContent = tr.title + (tr.artist ? ' \u2014 ' + tr.artist : ''); tt.setAttribute('dir', 'auto');
      main.appendChild(tt);
      if (tr.needGrant && !tr.bad) main.title = L(FAIL_KEY[tr.needGrant] || 'voidMusicErrPrompt') + ' — ' + L('voidMusicGrantAction');
      else if (tr.bad) main.title = L('voidMusicErrGone');
      main.addEventListener('click', function () { tr.bad = false; tr.needGrant = null; playId(tr.id); });
      const rate = el('div', 'vm-rate', { role: 'group', 'aria-label': L('voidMusicRate') });
      for (let n = 1; n <= 5; n++) {
        const on = n <= (tr.stars || 0);
        const sb = el('button', 'vm-rate-s' + (on ? ' is-on' : ''), { type: 'button', 'aria-pressed': on ? 'true' : 'false', 'aria-label': L('voidMusicRateN').replace('{n}', String(n)), title: L('voidMusicRateN').replace('{n}', String(n)) });
        sb.textContent = '\u2605';
        sb.addEventListener('click', function (e) { e.stopPropagation(); setStars(tr.id, tr.stars === n ? 0 : n); });
        rate.appendChild(sb);
      }
      const x = el('button', 'vm-row-x', { type: 'button', 'aria-label': L('voidMusicRemove'), title: L('voidMusicRemove') });
      x.appendChild(icon(ICON.close));
      x.addEventListener('click', function (e) { e.stopPropagation(); removeTrack(tr.id); });
      li.append(main, rate, x);
      els.list.appendChild(li);
    });
    if (!shown && S.tracks.length) { const em = el('li', 'vm-empty'); em.textContent = L('voidMusicNoResults'); els.list.appendChild(em); }
    els.searchRow.hidden = !S.tracks.length;                       // بدون آهنگ، جستجو لازم نیست
    els.searchX.hidden = !S.query;
    els.searchCount.textContent = !S.tracks.length ? '' : (toks.length ? shown + ' / ' + S.tracks.length : String(S.tracks.length));
  }
  function removeTrack(id) {
    const wasCur = id === S.curId;
    const gone = trackById(id);
    S.tracks = S.tracks.filter(function (t) { return t.id !== id; });
    S.bag = S.bag.filter(function (x) { return x !== id; });
    S.history = S.history.filter(function (x) { return x !== id; });
    dbDelete(id);
    if (gone && gone.copy) { navigator.storage.getDirectory().then(function (r) { return r.getDirectoryHandle('music'); }).then(function (d) { return d.removeEntry(gone.copy); }).catch(function () {}); }
    if (gone && gone.rootId && !S.tracks.some(function (t) { return t.rootId === gone.rootId; })) { S.roots.delete(gone.rootId); dbRoot('del', gone.rootId); }
    if (wasCur) {
      S.token++;
      if (S.audio) { S.audio.pause(); S.audio.removeAttribute('src'); S.audio.load(); }
      S.curId = null; setMeta('', '', null); document.title = S.savedTitle || document.title;
      if (S.tracks.length) next();
    }
    renderQueue(); syncEmpty(); updateProgress();
  }

  /* ---- مخفی‌شدنِ خودکار ----
     • وقتی موزیک پخش می‌شود و کاربر کاری نمی‌کند، کنترل‌ها و عنوان محو می‌شوند (پنهان نه؛
       با حرکتِ موس/لمس/کلید دوباره می‌آیند). موقعِ مکث همیشه دیده می‌شوند.
     • هر پاپ‌اور (صدا، صف) خودش بسته می‌شود؛ تا وقتی موس رویش است یا فوکوس دارد باز می‌ماند.
     • §CLOCK استثنا: ساعتِ محلیِ داخلِ داک با رابط مخفی نمی‌شود؛ تا CLOCK_SHOW_MS بعدِ آخرین
       تعامل دیده می‌شود و بعدِ آن محو می‌گردد (باقیهٔ رابط، زمان‌بندی و pointer-events دست‌نخورده). */
  const IDLE_MS = 3800, POP_MS = { vol: 3000, queue: 6500, sound: 12000 };
  /* §CLOCK پنجرهٔ ماندگاریِ ساعت: مخفی‌شدنِ خودکارِ رابط همان ۳۸۰۰ms می‌ماند؛ فقط ساعت
     (که داخلِ داک است) تا CLOCK_SHOW_MS بعدِ آخرین poke روی صفحه می‌ماند و بعد محو می‌شود.
     تایمرِ تازه‌ای ساخته نمی‌شود: همان idleTimer پس از goQuiet برای باقی‌ماندهٔ پنجره دوباره راه می‌افتد. */
  const CLOCK_SHOW_MS = 30000;
  let idleTimer = 0, popTimer = 0, lastPokeAt = -1;   // -1 = هیچ poke‌ای نشده (۰ یک زمانِ معتبر است، پس sentinel نمی‌تواند ۰ باشد)
  function isPlaying() { return !!(S.audio && !S.audio.paused); }
  const MUSIC_MESSAGE_TIMEOUT_MS = 3500;
  function musicCoordLog(event, detail) {
    try { console.info('[VoidMusicCoord]', new Date().toISOString(), event, detail || ''); } catch (e) {}
  }
  let musicTabIdPromise = null;
  function currentMusicTabId() {
    if (!musicTabIdPromise) {
      musicTabIdPromise = new Promise(function (resolve) {
        try {
          chrome.tabs.getCurrent(function (tab) {
            if (chrome.runtime.lastError || !tab || !Number.isInteger(tab.id)) { resolve(null); return; }
            musicCoordLog('page-tab-resolved', { tabId: tab.id });
            resolve(tab.id);
          });
        } catch (e) { resolve(null); }
      });
    }
    return musicTabIdPromise;
  }
  function runtimeMessage(message, timeoutMs) {
    return new Promise(function (resolve) {
      let settled = false;
      let resolvedTabId = null;
      const finish = function (result) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };
      const timer = setTimeout(function () {
        const error = { ok: false, error: 'timeout' };
        musicCoordLog('message-error', { type: message.type, requestId: message.requestId, tabId: resolvedTabId, error: error });
        finish(error);
      }, timeoutMs || MUSIC_MESSAGE_TIMEOUT_MS);
      currentMusicTabId().then(function (tabId) {
        resolvedTabId = tabId;
        if (tabId == null) {
          const error = { ok: false, error: 'tab_unavailable' };
          musicCoordLog('message-error', { type: message.type, requestId: message.requestId, tabId: tabId, error: error });
          finish(error);
          return;
        }
        try {
          chrome.runtime.sendMessage(Object.assign({}, message, { tabId: tabId }), function (response) {
            if (chrome.runtime.lastError) { const error = { ok: false, error: 'runtime', detail: chrome.runtime.lastError.message }; musicCoordLog('message-error', { type: message.type, requestId: message.requestId, tabId: tabId, error: error }); finish(error); return; }
            if (!response || typeof response !== 'object') { const error = { ok: false, error: 'empty_response' }; musicCoordLog('message-error', { type: message.type, requestId: message.requestId, tabId: tabId, error: error }); finish(error); return; }
            musicCoordLog('message-response', { type: message.type, requestId: message.requestId, tabId: tabId, response: response });
            finish(response);
          });
        } catch (e) {
          const error = { ok: false, error: 'send_failed', detail: e && e.message };
          musicCoordLog('message-error', { type: message.type, requestId: message.requestId, tabId: tabId, error: error });
          finish(error);
        }
      });
    });
  }
  async function claimPlayback() {
    if (SINGLE_TAB_DIAGNOSTIC) { playbackLog('diagnostic-claim-bypassed'); return true; }
    const requestId = 'vmc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    musicCoordLog('claim-request', { requestId: requestId });
    const response = await runtimeMessage({ type: 'vm-music-claim', requestId: requestId });
    const okStrict = response.ok === true;
    const grantedStrict = response.granted === true;
    const accepted = okStrict && grantedStrict;
    musicCoordLog('claim-decision', {
      requestId: requestId,
      response: response,
      checks: {
        'response.ok === true': okStrict,
        'response.granted === true': grantedStrict,
        'typeof response.ok': typeof response.ok,
        'typeof response.granted': typeof response.granted
      },
      decision: accepted ? 'accepted' : 'rejected'
    });
    if (accepted) return true;
    if (response.ok === true && response.ownerTabId != null) {
      toast(L('voidMusicAlreadyPlaying'), function () { focusPlaybackOwner(response.ownerTabId); });
    } else {
      showPlaybackCheckError(response.error);
    }
    return false;
  }
  function showPlaybackCheckError(reason) {
    const diagnostic = reason ? ' (' + reason + ')' : '';
    toast(L('voidMusicPlaybackCheckFailed') + diagnostic + ' · ' + L('voidMusicRetry'), function () { checkOtherPlayback(true); });
  }
  function focusPlaybackOwner(tabId) {
    try {
      chrome.tabs.get(tabId, function (tab) {
        if (chrome.runtime.lastError || !tab) return;
        chrome.windows.update(tab.windowId, { focused: true }, function () {
          void chrome.runtime.lastError;
          chrome.tabs.update(tabId, { active: true }, function () { void chrome.runtime.lastError; });
        });
      });
    } catch (e) {}
  }
  function releasePlayback() {
    if (SINGLE_TAB_DIAGNOSTIC) { playbackLog('diagnostic-release-bypassed'); return; }
    currentMusicTabId().then(function (tabId) {
      if (tabId == null) return;
      try { chrome.runtime.sendMessage({ type: 'vm-music-release', tabId: tabId }, function () { void chrome.runtime.lastError; }); } catch (e) {}
    });
  }
  async function checkOtherPlayback(showFailure) {
    if (SINGLE_TAB_DIAGNOSTIC) { playbackLog('diagnostic-status-check-bypassed'); return true; }
    musicCoordLog('status-request');
    const response = await runtimeMessage({ type: 'vm-music-check' });
    if (response.ok !== true || typeof response.playing !== 'boolean') {
      if (showFailure) showPlaybackCheckError(response.error);
      return false;
    }
    if (response.playing) {
      window.dispatchEvent(new CustomEvent('voidmusic:other-tab-playing', { detail: { ownerTabId: response.ownerTabId } }));
    }
    return true;
  }
  window.addEventListener('pagehide', releasePlayback);
  function keepAlive() {
    // موس روی داک/پاپ‌اور، یا فوکوسِ کیبوردی داخلِ پلیر
    if (S.ptrDown || S.dragging) return true;                       // وسطِ کشیدنِ اسلایدر/خطِ زمان هرگز پنهان نشود
    try {
      if (dock.matches(':hover') || els.corner.matches(':hover')) return true;
      const ae = document.activeElement;
      if (ae === els.volRange && ae.matches(':focus-visible')) return true;
      if (ae && root.contains(ae) && ae.matches && ae.matches(':focus-visible')) return true;
    } catch (e) {}
    return false;
  }
  function poke(ev) {
    if (!S.built || !S.open) return;
    lastPokeAt = Date.now();                                            // §CLOCK مبدأِ پنجرهٔ ساعت (همین تابع تایمرِ مخفی‌شدن را راه می‌اندازد)
    if (root.classList.contains('is-quiet')) { root.classList.remove('is-quiet'); document.body.classList.remove('vm-quiet'); }
    // هر تعامل، هم رابط را برمی‌گرداند هم پنجرهٔ ساعت را از نو باز می‌کند
    if (root.classList.contains('vm-clock-live')) root.classList.remove('vm-clock-live');
    clearTimeout(idleTimer); idleTimer = 0;
    if (isPlaying()) idleTimer = setTimeout(goQuiet, IDLE_MS);
    // حرکتِ موس در جاهای دیگر، تایمرِ بسته‌شدنِ پاپ‌اور را تمدید نمی‌کند (قبلاً تا موس حرکت می‌کرد باز می‌ماند)
    if (anyPop()) {
      const t = ev && ev.target;
      if (!ev || !t || !t.closest || t.closest('.vm-pop, .vm-vol, .vm-queue-btn')) armPop();
    }
  }
  function goQuiet() {
    idleTimer = 0;
    if (!S.open || !isPlaying()) return;
    if (keepAlive() || anyPop()) { idleTimer = setTimeout(goQuiet, 1200); return; }
    root.classList.add('is-quiet'); document.body.classList.add('vm-quiet');
    // §CLOCK ساعت خودش را نمی‌بلعد: تا پایانِ پنجرهٔ ۳۰ ثانیه‌ایِ آخرین poke روشن می‌ماند.
    // اگر موس فوکوسِ کیبوردی را گرم نگه داشته بود و goQuiet عقب افتاد، باقی‌ماندهٔ پنجره کاسته می‌شود.
    if (lastPokeAt >= 0) {
      const left = CLOCK_SHOW_MS - (Date.now() - lastPokeAt);
      if (left > 0) { root.classList.add('vm-clock-live'); idleTimer = setTimeout(dropClockLive, left); }
    }
  }
  function dropClockLive() { idleTimer = 0; root.classList.remove('vm-clock-live'); }
  function armPop() {
    clearTimeout(popTimer);
    if (!anyPop()) return;
    const ms = els.soundPop.classList.contains('is-open') ? POP_MS.sound : (els.queuePop.classList.contains('is-open') ? POP_MS.queue : POP_MS.vol);
    popTimer = setTimeout(function () {
      popTimer = 0;
      let hot = false;
      try {
        const ae = document.activeElement;
        const kb = !!(ae && (els.volPop.contains(ae) || els.queuePop.contains(ae) || els.soundPop.contains(ae)) && ae.matches && ae.matches(':focus-visible'));
        hot = S.ptrDown || els.volPop.matches(':hover') || els.queuePop.matches(':hover') || els.soundPop.matches(':hover') || kb;
      } catch (e) {}
      if (hot) { armPop(); return; }
      closePops();
    }, ms);
  }

  /* ---- پاپ‌اورها ---- */
  function setPop(which, on) {
    const pop = which === 'vol' ? els.volPop : (which === 'sound' ? els.soundPop : els.queuePop);
    const btn = which === 'vol' ? els.vol : (which === 'sound' ? els.soundBtn : els.queueBtn);
    pop.classList.toggle('is-open', on);
    if (which === 'sound') soundPanelOpen(on);
    btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (which === 'queue') {
      if (!on && S.query) setQuery('');                            // بستنِ فهرست = پاک‌شدنِ جستجو (فهرست کامل برمی‌گردد)
      if (on) { const cur = els.list.querySelector('.is-cur'); if (cur && cur.scrollIntoView) { try { cur.scrollIntoView({ block: 'nearest' }); } catch (e) {} } }
    }
    if (on) armPop(); else if (!anyPop()) { clearTimeout(popTimer); popTimer = 0; }
  }
  function closePops() { setPop('vol', false); setPop('queue', false); setPop('sound', false); }
  function anyPop() { return els.volPop.classList.contains('is-open') || els.queuePop.classList.contains('is-open') || els.soundPop.classList.contains('is-open'); }

  /* ---- رویدادها ---- */
  function fracFromEvent(e) {
    const r = els.seek.getBoundingClientRect();
    return clamp((e.clientX - r.left) / r.width, 0, 1);
  }
  function wire() {
    els.play.addEventListener('click', function (event) { playbackLog('play-button-click', { trustedActivation: !!(event && event.isTrusted), currentTrack: S.curId !== null, trackCount: S.tracks.length, audioExists: !!S.audio, paused: !S.audio || S.audio.paused, diagnosticBypass: SINGLE_TAB_DIAGNOSTIC }); toggle(); });
    els.prev.addEventListener('click', prev);
    els.next.addEventListener('click', next);
    els.open.addEventListener('click', pickFiles);
    els.close.addEventListener('click', exit);
    els.fs.addEventListener('click', toggleFullscreen);
    els.widget.addEventListener('click', function () { setWidget(!S.widgetShown); });
    document.addEventListener('fullscreenchange', function () { if (S.built) relabel(); if (!document.fullscreenElement) S.fsByUs = false; });
    els.vol.addEventListener('click', function (e) { e.stopPropagation(); const o = !els.volPop.classList.contains('is-open'); closePops(); setPop('vol', o); });
    els.queueBtn.addEventListener('click', function (e) { e.stopPropagation(); const o = !els.queuePop.classList.contains('is-open'); closePops(); setPop('queue', o); });
    els.volRange.addEventListener('input', function () { setVolume(parseInt(els.volRange.value, 10) / 100); });
    els.volRange.addEventListener('pointerup', function () { try { els.volRange.blur(); } catch (e) {} });   // فوکوسِ ماوس نباید پاپ‌اور را باز نگه دارد
    els.addFiles.addEventListener('click', pickFiles);
    els.addFolder.addEventListener('click', pickFolder);
    els.shuffleChip.addEventListener('click', function () { setShuffle(!S.shuffle, true); armPop(); });
    els.webChip.addEventListener('click', function () { try { window.dispatchEvent(new CustomEvent('voidmusic:web-chip')); } catch (e) {} armPop(); });
    els.soundBtn.addEventListener('click', function (e) { e.stopPropagation(); const o = !els.soundPop.classList.contains('is-open'); closePops(); setPop('sound', o); });
    window.addEventListener('resize', placeStars);
    els.search.addEventListener('input', function () { S.query = els.search.value; renderQueue(); armPop(); });
    els.search.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        if (els.search.value) setQuery('');
        else { closePops(); els.queueBtn.focus({ preventScroll: true }); }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const first = els.list.querySelector('.vm-row-main');
        if (first) first.click();                                 // اولین نتیجه پخش شود
      } else if (e.key === 'ArrowDown') {
        const r = els.list.querySelector('.vm-row-main');
        if (r) { e.preventDefault(); r.focus(); }
      }
    });
    els.searchX.addEventListener('click', function () { setQuery(''); els.search.focus(); });
    els.copyChip.addEventListener('click', function () {
      S.copyMode = !S.copyMode;
      try { localStorage.setItem('voidMusic.copy', S.copyMode ? '1' : '0'); } catch (e) {}
      if (S.copyMode && navigator.storage && navigator.storage.persist) { navigator.storage.persist().catch(function () {}); }
      relabel(); armPop();
    });
    els.file.addEventListener('change', function () { addEntries(Array.prototype.map.call(els.file.files, function (f) { return { file: f }; }), { playFirst: true }); });
    els.folder.addEventListener('change', function () {
      // بدونِ سقف: هر فایلِ صوتیِ انتخاب‌شده وارد می‌شود و شمارشِ ردشده‌ها گزارش می‌شود
      const all = Array.prototype.slice.call(els.folder.files || []);
      const audio = all.filter(function (f) { return EXT.test(f.name); });
      if (!all.length) return;
      addEntries(audio.map(function (f) { return { file: f }; })).then(function (added) {
        const parts = [L('voidMusicAddedN').replace('{n}', added)];
        if (all.length > audio.length) parts.push(L('voidMusicSkippedOther').replace('{n}', all.length - audio.length));
        toast(parts.join(' · '));
      });
    });
    root.addEventListener('pointerdown', function (e) { if (!e.target.closest('.vm-pop') && !e.target.closest('.vm-vol') && !e.target.closest('.vm-queue-btn')) closePops(); });

    // خطِ زمان: کشیدن = پیش‌نمایشِ زنده، رها کردن = اعمالِ seek
    els.seek.addEventListener('pointerdown', function (e) {
      if (!S.audio || !isFinite(S.audio.duration)) return;
      S.dragging = true; S.dragFrac = fracFromEvent(e);
      try { els.seek.setPointerCapture(e.pointerId); } catch (err) {}
      updateProgress();
    });
    els.seek.addEventListener('pointermove', function (e) { if (!S.dragging) return; S.dragFrac = fracFromEvent(e); updateProgress(); });
    const endDrag = function (e, commit) {
      if (!S.dragging) return;
      S.dragging = false;
      try { els.seek.releasePointerCapture(e.pointerId); } catch (err) {}
      if (commit && S.audio && isFinite(S.audio.duration)) seekTo(S.dragFrac * S.audio.duration);
      updateProgress();
    };
    els.seek.addEventListener('pointerup', function (e) { endDrag(e, true); });
    els.seek.addEventListener('pointercancel', function (e) { endDrag(e, false); });
    els.seek.addEventListener('keydown', function (e) {
      const step = e.shiftKey ? 15 : 5;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { seekBy(step); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { seekBy(-step); }
      else if (e.key === 'Home') seekTo(0);
      else if (e.key === 'End' && S.audio) seekTo(S.audio.duration - 0.1);
      else return;
      e.preventDefault(); e.stopPropagation();
    });

    // رها کردنِ فایل/پوشه روی صفحه
    let dragDepth = 0;
    S.onDragEnter = function (e) { if (!S.open || !hasFiles(e)) return; dragDepth++; root.classList.add('is-drop'); els.openLabel.textContent = L('voidMusicDrop'); };
    S.onDragOver = function (e) { if (!S.open || !hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
    S.onDragLeave = function (e) { if (!S.open) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) endDrop(); };
    S.onDrop = function (e) {
      if (!S.open || !hasFiles(e)) return;
      e.preventDefault(); dragDepth = 0; endDrop();
      const dt = e.dataTransfer;
      // باید همگام (قبل از هر await) جمع شوند، وگرنه items نامعتبر می‌شوند
      const jobs = [];
      const files = Array.prototype.slice.call(dt.files || []);
      Array.prototype.forEach.call(dt.items || [], function (it) {
        if (it.kind !== 'file') return;
        jobs.push(it.getAsFileSystemHandle ? it.getAsFileSystemHandle().catch(function () { return null; }) : Promise.resolve(null));
      });
      Promise.all(jobs).then(async function (hs) {
        const list = [];
        let usedHandles = false;
        for (const h of hs) {
          if (!h) continue;
          usedHandles = true;
          if (h.kind === 'file') list.push({ handle: h });
          else if (h.kind === 'directory') { await addFolderHandle(h); }
        }
        if (!usedHandles) files.forEach(function (f) { list.push({ file: f }); });
        addEntries(list);
      });
    };
    function endDrop() { root.classList.remove('is-drop'); els.openLabel.textContent = L('voidMusicOpen'); }
    function hasFiles(e) { return !!(e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0); }
    document.addEventListener('dragenter', S.onDragEnter);
    document.addEventListener('dragover', S.onDragOver);
    document.addEventListener('dragleave', S.onDragLeave);
    document.addEventListener('drop', S.onDrop);

    ['pointermove', 'pointerdown', 'touchstart', 'wheel'].forEach(function (ev) {
      document.addEventListener(ev, function (e) { if (S.open) poke(e); }, { passive: true, capture: true });
    });
    root.addEventListener('focusin', function () { if (S.open) poke(); });
    root.addEventListener('pointerdown', function () { S.ptrDown = true; }, true);
    const up = function () { if (S.ptrDown) { S.ptrDown = false; if (S.open) poke(); } };
    window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true); window.addEventListener('blur', up);
    ['scroll', 'input'].forEach(function (ev) { els.queuePop.addEventListener(ev, function () { armPop(); }, { passive: true, capture: true }); els.volPop.addEventListener(ev, armPop, true); });
    window.addEventListener('resize', function () { if (S.open) layout(); });
    window.addEventListener('orientationchange', function () { if (S.open) setTimeout(layout, 120); });
  }

  /* ---- کیبورد (فاز capture تا میانبرهای صفحهٔ پنهان نگیرند) ---- */
  const HANDLED = { ' ': 1, k: 1, m: 1, n: 1, p: 1, f: 1, w: 1, ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1, Escape: 1 };
  function onKey(e) {
    if (!S.open) return;
    const t0 = e.target, tag = t0 && t0.tagName;
    const typing = (tag === 'INPUT' && t0.type !== 'range' && t0.type !== 'file') || tag === 'TEXTAREA' || (t0 && t0.isContentEditable) || !!(t0 && t0.closest && t0.closest('.vm-sound-pop'));
    if (typing) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    poke();
    const k = e.key;
    if (k === 'Tab') return;
    if (!HANDLED[k]) { if (k.length === 1) e.stopImmediatePropagation(); return; }
    const onBtn = tag === 'BUTTON', onRange = tag === 'INPUT' && t0.type === 'range', onSeek = t0 === els.seek;
    if (k === 'Escape') { if (anyPop()) { closePops(); els.queueBtn.focus({ preventScroll: true }); } else exit(); }
    else if (k === ' ' || k === 'k') { if (onBtn) { e.stopImmediatePropagation(); return; } toggle(); }
    else if (k === 'ArrowLeft' || k === 'ArrowRight') { if (onRange || onSeek) { e.stopImmediatePropagation(); return; } seekBy((k === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 15 : 5)); }
    else if (k === 'ArrowUp' || k === 'ArrowDown') { if (onRange || onSeek) { e.stopImmediatePropagation(); return; } setVolume(S.vol + (k === 'ArrowUp' ? .05 : -.05)); closePops(); setPop('vol', true); }
    else if (k === 'm') toggleMute();
    else if (k === 'f') toggleFullscreen();
    else if (k === 'w') setWidget(!S.widgetShown);
    else if (k === 'n') next();
    else if (k === 'p') prev();
    e.preventDefault(); e.stopImmediatePropagation();
  }

  /* ---- تمام‌صفحه و ابزارکِ شناورِ افزونه ---- */
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) { await document.exitFullscreen(); S.fsByUs = false; }
      else { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); S.fsByUs = true; }
    } catch (e) {}
    if (S.built) relabel();
  }
  // ابزارکِ شناورِ افزونه (content.js) در Music Mode پیش‌فرض پنهان است؛ کاربر می‌تواند نشانش دهد
  let forcedWidget = null, forcedPrev = null;
  function releaseForcedWidget() {                // حالتِ قبلیِ display (که content.js ممکن است درون‌خطی گذاشته باشد) دقیقاً برمی‌گردد
    if (!forcedWidget) return;
    try { if (forcedPrev && forcedPrev.v) forcedWidget.style.setProperty('display', forcedPrev.v, forcedPrev.p); else forcedWidget.style.removeProperty('display'); } catch (e) {}
    forcedWidget = null; forcedPrev = null;
  }
  function forceWidgetVisible() {
    try {
      const w = document.querySelector(S.widgetSel || '#ai-orbit-root');
      if (!w) return;
      if (S.widgetShown && S.open) {
        if (!forcedWidget && getComputedStyle(w).display === 'none') { forcedPrev = { v: w.style.getPropertyValue('display'), p: w.style.getPropertyPriority('display') }; w.style.setProperty('display', 'block', 'important'); forcedWidget = w; }
      } else releaseForcedWidget();
    } catch (e) {}
  }
  // بازگشت به صفحهٔ اصلیِ New Tab: ابزارک دکمهٔ «نمایش/پنهان» ندارد، پس هرچه در صفحهٔ موسیقی با آن کردیم (نمایش/پنهان/جاروی سطح)
  // باید پاک شود و ابزارک همان‌طور که قبل از ورود دیده می‌شد، دیده شود.
  function restoreWidgetAfterExit() {
    try {
      S.widgetShown = false; document.documentElement.classList.remove('vm-widget');
      releaseForcedWidget();
      const w = document.querySelector(S.widgetSel || '#ai-orbit-root');
      if (!w || S.widgetWasVisible === false) return;
      w.removeAttribute('data-vm-swept');
      if (w.style.getPropertyValue('display') === 'none') w.style.removeProperty('display');
    } catch (e) {}
  }
  function setWidget(on) {
    S.widgetShown = !!on;
    try { localStorage.setItem('voidMusic.widget', S.widgetShown ? '1' : '0'); } catch (e) {}
    document.documentElement.classList.toggle('vm-widget', S.widgetShown);
    if (S.widgetShown) { unsweep(); forceWidgetVisible(); setTimeout(forceWidgetVisible, 250); } else { forceWidgetVisible(); if (S.open) scheduleSweep(650); }
    if (S.built) relabel();
  }
  // اگر ریشهٔ ابزارک داخلِ body باشد (نه کنارِ <body>)، سلکتورش را اینجا بده تا «نمایش» واقعاً آن را آشکار کند
  let widgetStyle = null;
  function setWidgetSelector(sel) {
    S.widgetSel = sel;
    if (!widgetStyle) { widgetStyle = document.createElement('style'); widgetStyle.id = 'void-music-widget-sel'; document.head.appendChild(widgetStyle); }
    widgetStyle.textContent = sel ? ('html.vm-on.vm-widget body.void-music-on ' + sel + ', html.vm-on.vm-widget ' + sel + ' { visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; }') : '';
  }

  /* ---- جاروبِ عناصرِ شناورِ سرکش ----
     CSS همه‌چیز را پنهان می‌کند؛ این جاروب فقط چیزهایی را می‌گیرد که با وجودِ آن هنوز دیده می‌شوند
     (مثلاً ابزاری که خودش !important می‌گذارد یا بعداً به <html>/<body> اضافه می‌شود). */
  const SKIP_TAGS = /^(HEAD|BODY|SCRIPT|STYLE|LINK|META|TITLE|NOSCRIPT|TEMPLATE)$/;
  let sweepObs = null, sweepT = 0;
  function isOurs(n) { return n.id === 'starfield' || n.id === 'void-music-root' || n.id === 'void-music-mini' || (n.classList && n.classList.contains('space-vignette')); }
  function visibleNow(n) {
    const cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.04) return false;
    const r = n.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
  }
  function sweep() {
    sweepT = 0;
    if (!S.open || S.widgetShown || !document.body) return;
    [document.documentElement, document.body].forEach(function (parent) {
      Array.prototype.forEach.call(parent.children, function (c) {
        if (SKIP_TAGS.test(c.tagName) || isOurs(c) || c.hasAttribute('data-vm-swept')) return;
        if (!visibleNow(c)) return;
        c.setAttribute('data-vm-swept', '1');
        if (visibleNow(c)) {                                  // هنوز دیده می‌شود (display:… !important داخلی) → درون‌خطی
          S.swept.push({ el: c, prev: c.style.getPropertyValue('display'), prio: c.style.getPropertyPriority('display') });
          c.style.setProperty('display', 'none', 'important');
        }
      });
    });
  }
  function scheduleSweep(ms) { if (sweepT || !S.open) return; sweepT = setTimeout(sweep, ms || 300); }
  function unsweep() {
    clearTimeout(sweepT); sweepT = 0;
    S.swept.forEach(function (o) { try { if (o.prev) o.el.style.setProperty('display', o.prev, o.prio); else o.el.style.removeProperty('display'); } catch (e) {} });
    S.swept = [];
    Array.prototype.forEach.call(document.querySelectorAll('[data-vm-swept]'), function (n) { n.removeAttribute('data-vm-swept'); });
  }
  function watchStrays(on) {
    if (on && !sweepObs && window.MutationObserver) {
      sweepObs = new MutationObserver(function (list) {
        for (let i = 0; i < list.length; i++) for (let j = 0; j < list[i].addedNodes.length; j++) if (list[i].addedNodes[j].nodeType === 1) { scheduleSweep(250); return; }
      });
      sweepObs.observe(document.documentElement, { childList: true });
      sweepObs.observe(document.body, { childList: true });
    } else if (!on && sweepObs) { sweepObs.disconnect(); sweepObs = null; }
  }

  /* ---- Orb شناور: وقتی Music Mode بسته است و موسیقی بارگذاری/پخش است ----
     دایره‌ای با ویژولایزرِ کوچک (void-music-viz.js روی canvasش می‌کشد)، نشانِ پخش/مکثِ جدا،
     کلیک = بازگشت به Music Mode، کشیدنی و چسبنده به لبهٔ چپ/راست (جایش ماندگار است). */
  const MINI_KEY = 'voidMusic.miniPos';
  function miniSize() { return S.miniWrap ? S.miniWrap.offsetWidth || 64 : 64; }
  function sizeMiniCanvas() {
    if (!S.miniCv) return;
    const px = Math.round(miniSize() * Math.min(window.devicePixelRatio || 1, 2));
    if (S.miniCv.width !== px) { S.miniCv.width = px; S.miniCv.height = px; }
  }
  function placeMini(l, t) {
    const w = miniSize(), vw = window.innerWidth, vh = window.innerHeight;
    S.miniWrap.style.left = clamp(l, 8, Math.max(8, vw - w - 8)) + 'px';
    S.miniWrap.style.top = clamp(t, 8, Math.max(8, vh - w - 8)) + 'px';
  }
  function applyMiniPos() {
    if (!S.miniWrap) return;
    const w = miniSize(), vw = window.innerWidth, vh = window.innerHeight, M = 16;
    let side = 'l', y = null;
    try { const o = JSON.parse(localStorage.getItem(MINI_KEY) || 'null'); if (o) { side = o.side === 'r' ? 'r' : 'l'; y = typeof o.y === 'number' ? o.y : null; } } catch (e) {}
    const top = y === null ? vh - w - M : clamp(y * vh, M + (side === 'r' ? 54 : 0), vh - w - M);   // سمتِ راست: زیرِ نوارِ بالا-راست
    placeMini(side === 'l' ? M : vw - w - M, top);
  }
  function snapMini() {
    const r = S.miniWrap.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight, M = 16;
    const side = (r.left + r.width / 2) < vw / 2 ? 'l' : 'r';
    S.miniWrap.classList.add('is-snapping');
    placeMini(side === 'l' ? M : vw - r.width - M, clamp(r.top, M + (side === 'r' ? 54 : 0), vh - r.height - M));
    try { localStorage.setItem(MINI_KEY, JSON.stringify({ side: side, y: parseFloat(S.miniWrap.style.top) / vh })); } catch (e) {}
    setTimeout(function () { if (S.miniWrap) S.miniWrap.classList.remove('is-snapping'); }, 320);
  }
  function ensureMini() {
    if (S.mini) return S.mini;
    const wrap = el('div', 'vm-mini-wrap', { id: 'void-music-mini-wrap' });
    const orb = el('button', 'vm-mini', { type: 'button', id: 'void-music-mini' });
    const cv = el('canvas', 'vm-orb-viz', { 'aria-hidden': 'true' });
    const ring = svg('svg', { viewBox: '0 0 44 44', 'aria-hidden': 'true' }, 'vm-mini-ring');
    ring.appendChild(svg('circle', { cx: '22', cy: '22', r: '21.4' }, 'vm-mini-track'));
    ring.appendChild(svg('circle', { cx: '22', cy: '22', r: '21.4', pathLength: '1000', 'stroke-dasharray': '1000', 'stroke-dashoffset': '1000', transform: 'rotate(-90 22 22)' }, 'vm-mini-prog'));
    orb.append(cv, ring);
    const play = el('button', 'vm-mini-play', { type: 'button', 'aria-pressed': 'false' });
    play.append(icon(ICON.play, 'i-play'), icon(ICON.pause, 'i-pause'));
    const stop = el('button', 'vm-mini-stop', { type: 'button' }); stop.dataset.k = 'voidMusicStop'; stop.appendChild(icon(ICON.close));
    wrap.append(orb, play, stop);
    document.body.appendChild(wrap);
    S.mini = orb; S.miniWrap = wrap; S.miniPlay = play; S.miniStop = stop; S.miniCv = cv;

    play.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
    stop.addEventListener('click', function (e) { e.stopPropagation(); dismissMini(); });
    orb.addEventListener('contextmenu', function (e) { e.preventDefault(); dismissMini(); });
    // کشیدن (آستانهٔ ۶px تا کلیکِ ساده خراب نشود) + کلیک = بازگشت به Music Mode
    let drag = null;
    orb.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const r = wrap.getBoundingClientRect();
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, l0: r.left, t0: r.top, moved: false };
      try { orb.setPointerCapture(e.pointerId); } catch (er) {}
    });
    orb.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      drag.moved = true; wrap.classList.add('is-dragging');
      placeMini(drag.l0 + dx, drag.t0 + dy);
    });
    const end = function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      try { orb.releasePointerCapture(e.pointerId); } catch (er) {}
      wrap.classList.remove('is-dragging');
      if (d.moved) { S.miniJustDragged = true; setTimeout(function () { S.miniJustDragged = false; }, 80); snapMini(); }
    };
    orb.addEventListener('pointerup', end); orb.addEventListener('pointercancel', end);
    orb.addEventListener('click', function () { if (S.miniJustDragged) return; enter(); });
    orb.addEventListener('keydown', function (e) { if (e.key === ' ') { e.preventDefault(); toggle(); } });   // Space = پخش/مکث، Enter = بازگشت
    window.addEventListener('resize', function () { if (S.mini) { sizeMiniCanvas(); applyMiniPos(); } });
    sizeMiniCanvas(); applyMiniPos();
    return orb;
  }
  function syncMini() {
    if (!S.audio && !S.mini) return;
    const show = !S.open && S.curId !== null;
    if (!show && !S.mini) return;
    const b = ensureMini();
    const playing = isPlaying(), tr = trackById(S.curId);
    S.miniWrap.classList.toggle('is-on', show);
    S.miniWrap.classList.toggle('is-playing', playing);
    if (show) { sizeMiniCanvas(); }
    const open = L('voidMusicExpand'), pl = L(playing ? 'voidMusicPause' : 'voidMusicPlay');
    b.setAttribute('aria-label', open + (tr && tr.title ? ' \u2014 ' + tr.title : '')); b.title = open + (tr && tr.title ? ' \u2014 ' + tr.title : '');
    S.miniPlay.setAttribute('aria-pressed', playing ? 'true' : 'false'); S.miniPlay.setAttribute('aria-label', pl); S.miniPlay.title = pl;
    const st = L('voidMusicStop'); S.miniStop.setAttribute('aria-label', st); S.miniStop.title = st;
    const a = S.audio, dur = a && isFinite(a.duration) ? a.duration : 0;
    const frac = dur > 0 ? clamp(a.currentTime / dur, 0, 1) : 0;
    const pr = b.querySelector('.vm-mini-prog'); if (pr) pr.setAttribute('stroke-dashoffset', String(1000 * (1 - frac)));
    if (S.miniShown !== show) {
      S.miniShown = show;
      try { window.dispatchEvent(new CustomEvent('voidmusic:mini', { detail: { shown: show } })); } catch (e) {}
    }
  }
  function dismissMini() {
    S.token++;
    if (S.audio) { S.audio.pause(); S.audio.removeAttribute('src'); try { S.audio.load(); } catch (e) {} }
    if (S.url) { try { URL.revokeObjectURL(S.url); } catch (e) {} S.url = null; }
    S.curId = null;
    unbindSession();
    if (S.built) onPlayState(); else syncQuick();     // load() رویدادِ pause نمی‌فرستد؛ حالت را خودمان همگام می‌کنیم
    syncRemoteTimer();
    syncMini();
    if (!S.open && S.savedTitle) document.title = S.savedTitle;
  }

  /* ------------------------------------------------------------------ */
  /* ورود / خروج                                                          */
  /* ------------------------------------------------------------------ */
  /* بعد ازِ بازگشتِ صفحه، دستگیره‌ها در IndexedDB هست‌اند ولی مجوز خواندن نه (سیاستِ مرورگر).
     این را زود و بدونِ پرسش (queryPermission) می‌فهمیم تا پیامِ «فایل پیدا نشد» با
     «اجازه ندارید» قاطی نشود و کاربر بداند یک کلیک کافی است. */
  async function probePermissions() {
    let n = 0;
    for (const r of S.roots.values()) {
      r.perm = 'granted';
      try {
        if (r.handle && r.handle.queryPermission && (await r.handle.queryPermission({ mode: 'read' })) !== 'granted') { r.perm = 'prompt'; n++; }
      } catch (e) { r.perm = 'unknown'; }
    }
    S.permRoots = n;
    playbackLog('permission-probe', { roots: S.roots.size, needsGrant: n });
    if (n) toast(L('voidMusicPermRoots').replace('{n}', n), grantAllRoots, L('voidMusicGrantAction'));
    return n;
  }
  async function grantAllRoots() {
    let granted = 0, asked = 0;
    for (const r of Array.from(S.roots.values())) {
      if (r.perm === 'granted') { granted++; continue; }
      S.permCache.delete(r.handle);
      asked++;
      try { await grant(r.handle); r.perm = 'granted'; granted++; }
      catch (e) { r.perm = (e && e.message) || 'permDenied'; break; }   // یک پرسش در هر ژست؛ بقیه برای کلیکِ بعد
    }
    let pending = 0;
    for (const r of S.roots.values()) if (r.perm !== 'granted') pending++;
    S.permRoots = pending;
    playbackLog('permission-sweep', { granted: granted, asked: asked, pending: pending });
    if (pending) { toast(L('voidMusicPermRoots').replace('{n}', pending), grantAllRoots, L('voidMusicGrantAction')); return pending; }
    toast(L('voidMusicRegrantOk'));
    const id = S.grantTrack;
    S.grantAdvised = false; S.grantTrack = null; S.failStreak = 0;
    if (id) { const tr = trackById(id); if (tr) { tr.needGrant = null; playId(tr.id); } }
    return 0;
  }

  async function restoreLibrary() {
    if (S.libLoaded) return;
    S.libLoaded = true;
    const roots = await dbRoot('all');
    (roots || []).forEach(function (r) { if (r && r.handle) S.roots.set(r.id, { id: r.id, name: r.name, handle: r.handle }); });
    const rows = (await dbAll()).slice().sort(function (a, b) { return ((a && a.ts) || 0) - ((b && b.ts) || 0); });   // ترتیبِ افزودن (برای پخشِ پشت‌سرهم)
    let n = 0;
    rows.forEach(function (r) {
      if (!r || trackById(r.id) || (!r.handle && !(r.rootId && S.roots.has(r.rootId)))) return;
      S.tracks.push({ id: r.id, name: r.name, title: nameToTitle(r.name), artist: '', file: null, handle: r.handle || null, bad: false, rootId: r.rootId || null, path: r.path || null, copy: r.copy || null, ts: r.ts || 0, stars: r.stars || 0 });
      S.bag.push(r.id); n++;
    });
    if (n) { S.bag = shuffled(S.bag); renderQueue(); syncEmpty(); }
  }

  function enter() {
    if (S.open) return;
    build();
    try { const w0 = document.querySelector(S.widgetSel || '#ai-orbit-root'); S.widgetWasVisible = !w0 || getComputedStyle(w0).display !== 'none'; } catch (e) { S.widgetWasVisible = true; }
    S.open = true;
    S.savedTitle = document.title;
    // منوی سه‌خطی را ببند
    try {
      const m = document.getElementById('ai-ntp-menu');
      if (m) m.classList.remove('open');
      const mb = document.getElementById('ai-ntp-menu-btn');
      if (mb) mb.setAttribute('aria-expanded', 'false');
    } catch (e) {}
    try { S.copyMode = localStorage.getItem('voidMusic.copy') === '1'; } catch (e) {}
    relabel(); layout(); syncVolume(); syncEmpty(); renderQueue(); onPlayState();
    root.hidden = false;
    checkOtherPlayback(true);
    document.body.classList.remove('void-music-leaving');
    document.documentElement.classList.add('vm-on');
    document.body.classList.add('void-music-on');
    setWidget(false);
    watchStrays(true); scheduleSweep(700);
    syncMini();
    requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('is-on'); }); });
    document.addEventListener('keydown', onKey, true);
    bindSession();
    restoreLibrary().then(function () {
      probePermissions();
      setTimeout(function () { if (S.open && !S.tracks.length) els.open.focus({ preventScroll: true }); else if (S.open) els.play.focus({ preventScroll: true }); }, 700);
    });
    try { window.dispatchEvent(new CustomEvent('voidmusic:mode', { detail: { open: true } })); } catch (e) {}
    // موزیک ممکن است از قبل (با آیکونِ شناور) پخش شود؛ ویژولایزر باید از نو شروع کند
    S.lastPlaying = null; onPlayState();
  }

  function exit() {
    if (!S.open) return;
    S.open = false;
    clearTimeout(idleTimer); clearTimeout(popTimer);
    watchStrays(false);
    clearTimeout(S.starsTimer); S.starsTimer = 0;
    restoreWidgetAfterExit();
    root.classList.remove('is-quiet', 'vm-clock-live'); document.body.classList.remove('vm-quiet');
    closePops();
    root.classList.remove('is-on');
    document.removeEventListener('keydown', onKey, true);
    document.body.classList.add('void-music-leaving');
    document.body.classList.remove('void-music-on');
    if (S.savedTitle) document.title = S.savedTitle;
    syncMini();
    setTimeout(function () {
      document.body.classList.remove('void-music-leaving');
      if (!S.open) { root.hidden = true; document.documentElement.classList.remove('vm-on'); unsweep(); restoreWidgetAfterExit(); }
    }, 650);
    try { const mb = document.getElementById('ai-ntp-menu-btn'); if (mb) mb.focus({ preventScroll: true }); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('voidmusic:mode', { detail: { open: false } })); } catch (e) {}
  }

  function hookMenu() {
    refreshMenuLabel();
    const closeMenu = function () {
      try { const m = document.getElementById('ai-ntp-menu'); if (m) m.classList.remove('open'); const b = document.getElementById('ai-ntp-menu-btn'); if (b) b.setAttribute('aria-expanded', 'false'); } catch (e) {}
    };
    const fsBtn = document.getElementById('ai-ntp-fs-btn');
    if (fsBtn) {
      fsBtn.addEventListener('click', function (e) { e.preventDefault(); togglePageFullscreen(); });
      ['pointerenter', 'focus', 'touchstart'].forEach(function (ev) { fsBtn.addEventListener(ev, refreshMenuLabel, { passive: true }); });
    }
    const qb = document.getElementById('ai-ntp-music-btn');
    if (qb) {
      qb.addEventListener('click', function (e) { e.preventDefault(); enter(); });
      // زبان بعد از بوت از storage می‌آید؛ برچسب را لحظهٔ استفاده تازه می‌کنیم (بدونِ polling)
      ['pointerenter', 'focus', 'touchstart'].forEach(function (ev) { qb.addEventListener(ev, refreshMenuLabel, { passive: true }); });
    }
    window.addEventListener('load', function () { setTimeout(refreshMenuLabel, 400); setTimeout(refreshMenuLabel, 2500); });
    document.addEventListener('fullscreenchange', syncFsMenu);
    // دابل‌کلیک روی زمینهٔ خالیِ صفحهٔ اصلی = تمام‌صفحه (روی دکمه/جستجو/پنل‌ها اثری ندارد)
    document.addEventListener('dblclick', function (e) {
      if (S.open) return;
      const t = e.target;
      if (!t || t.closest && t.closest('a, button, input, textarea, select, label, [contenteditable], [role="menu"], #ai-ntp-quickbar, #ai-orbit-root, #ai-void-stage > *, #ai-ntp-topsites, #ai-void-todo-dock, dialog')) return;
      if (t === document.body || t === document.documentElement || t.id === 'starfield' || t.id === 'ai-void-stage' || (t.classList && t.classList.contains('space-vignette'))) togglePageFullscreen();
    });
    syncFsMenu(); syncQuick();
    const mb = document.getElementById('ai-ntp-menu-btn');
    if (mb) mb.addEventListener('click', refreshMenuLabel, true);   // زبان ممکن است بعد از بوت عوض شده باشد
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener(function (ch) {
          if (ch && ch.appLanguage) setTimeout(function () { refreshMenuLabel(); if (S.built) relabel(); }, 60);
        });
      }
    } catch (e) {}
  }
  document.addEventListener('visibilitychange', function () {
    if (!S.built) return;
    clockWatch(!document.hidden);       // پس‌زمینه: هیچ تایمری نگه نمی‌داریم؛ هنگام نماش، ساعت بی درنگ درست می‌شود
    if (!document.hidden) relabel();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hookMenu); else hookMenu();
  setWidgetSelector('#ai-orbit-root');   // ریشهٔ ابزارکِ شناورِ content.js (همان که Focus Mode هم پنهانش می‌کند)


  /* ------------------------------------------------------------------ */
  /* کنترل از تب‌های دیگر: orb شناور روی صفحه‌های دیگر (void-music-remote.js) */
  /* ------------------------------------------------------------------ */
  const RM = { t: 0, heard: -1e9, viz: null, hb: 0 };
  function hasExt() { try { return !!(chrome && chrome.runtime && chrome.runtime.id && chrome.tabs && chrome.tabs.query); } catch (e) { return false; } }
  function remoteState() {
    const a = S.audio, tr = trackById(S.curId);
    let rtl = false; try { rtl = typeof isRTL === 'function' && isRTL(currentLang); } catch (e) {}
    return {
      type: 'vm-state', active: S.curId !== null && isPlaying(), playing: isPlaying(), title: tr ? tr.title : '', artist: tr ? tr.artist : '',
      pos: a ? a.currentTime : 0, dur: a && isFinite(a.duration) ? a.duration : 0, ts: Date.now(), rtl: rtl, viz: RM.viz,
      labels: { play: L('voidMusicPlay'), pause: L('voidMusicPause'), open: L('voidMusicExpand'), stop: L('voidMusicStop'), next: L('voidMusicNext') }
    };
  }
  function sendTo(tabId, msg) {
    try {
      chrome.tabs.sendMessage(tabId, msg, function () {
        if (!chrome.runtime.lastError) RM.heard = performance.now();     // کسی (یک تبِ دیگر) گوش می‌دهد
      });
    } catch (e) {}
  }
  function pushRemote(force, onlyTab) {
    if (!hasExt()) return;
    const now = performance.now();
    if (!force && now - RM.t < 230) return;
    RM.t = now;
    const msg = remoteState();
    if (onlyTab != null) { sendTo(onlyTab, msg); return; }
    try { chrome.tabs.query({ active: true }, function (tabs) { if (chrome.runtime.lastError || !tabs) return; tabs.forEach(function (t) { if (t.id != null) sendTo(t.id, msg); }); }); } catch (e) {}
  }
  function syncRemoteTimer() {
    if (!hasExt()) return;
    const want = S.curId !== null && isPlaying();
    if (want && !RM.hb) RM.hb = setInterval(function () { pushRemote(true); }, 1000);
    else if (!want && RM.hb) { clearInterval(RM.hb); RM.hb = 0; }
    pushRemote(true);
  }
  function focusSelf() {
    try { chrome.tabs.getCurrent(function (tab) { if (tab) { chrome.tabs.update(tab.id, { active: true }, function () { void chrome.runtime.lastError; }); chrome.windows.update(tab.windowId, { focused: true }, function () { void chrome.runtime.lastError; }); } }); } catch (e) {}
  }
  if (hasExt()) {
    musicCoordLog('player-page-initialized');
    try {
      chrome.runtime.onMessage.addListener(function (m, sender, respond) {
        if (m && m.type === 'vm-owner-probe') { try { respond({ playing: isPlaying() }); } catch (e) {} return; }
        if (!m || (m.type !== 'vm-hello' && m.type !== 'vm-cmd')) return;
        if (S.curId === null) return;                                  // فقط نمونه‌ای که آهنگ دارد پاسخ می‌دهد
        if (m.type === 'vm-hello') { pushRemote(true, sender && sender.tab ? sender.tab.id : undefined); return; }
        if (m.cmd === 'toggle') toggle();
        else if (m.cmd === 'next') next();
        else if (m.cmd === 'prev') prev();
        else if (m.cmd === 'stop') dismissMini();
        else if (m.cmd === 'open') { focusSelf(); enter(); }
        try { respond({ ok: true }); } catch (e) {}
      });
      chrome.tabs.onActivated.addListener(function () { pushRemote(true); });
      chrome.windows.onFocusChanged.addListener(function () { pushRemote(true); });
    } catch (e) {}
  }

  window.VoidMusic = {
    enter: enter, exit: exit, toggle: toggle, next: next, prev: prev,
    add: addEntries, addFolder: addFolderHandle, readMeta: readMeta, relabel: relabel,
    isOpen: function () { return S.open; },
    attachWeb: attachWeb, detachWeb: detachWeb, setWebMeta: setWebMeta, setWebChip: setWebChip, toast: toast,
    getLocalAudio: function () { return S.localAudio; }, isWeb: function () { return !!S.web; },
    // وضعیتِ سه‌محورِ منابعِ وب (detected / playing / connected) — برای بازرسیِ دستی و آزمون
    webState: function () { try { return window.VoidMusicWeb && window.VoidMusicWeb.getState ? window.VoidMusicWeb.getState() : null; } catch (e) { return null; } },
    // برای فازهای بعد (بصری‌سازی): seed تازه برای هر آهنگ، و المنتِ صدا
    getSeed: function () { return S.seed; },
    getAudio: function () { return S.audio; },
    getRoot: function () { return root; },
    // داده‌های ویژولایزر برای orbِ تب‌های دیگر (حداکثر ~۴ بار در ثانیه فرستاده می‌شود)
    pushViz: function (v) { RM.viz = v; if (S.curId !== null) pushRemote(false); },
    remoteWanted: function () { return performance.now() - RM.heard < 3500; },
    getMiniCanvas: function () { return S.miniCv || null; },
    isMiniVisible: function () { return !!(S.miniWrap && S.miniWrap.classList.contains('is-on')); },
    setWidgetSelector: setWidgetSelector, setWidget: setWidget, toggleFullscreen: toggleFullscreen, dismiss: dismissMini,
    // ویژولایزر گرافِ Web Audio می‌سازد و بلندی را به این GainNode می‌سپارد
    setOutputGain: function (node) { S.outGain = node || null; applyVolume(); },
    setPowder: function (on) { if (S.built) root.classList.toggle('is-powder', !!on); },
    // ستاره‌های امتیازِ آهنگِ جاری (زیرِ عنوان): مرکزِ هر ستاره برای شروعِ پروازِ دنباله‌دار، و پنهان‌کردنِ هر ستاره هم‌زمان با زادنِ دنباله‌دارش
    getStarRects: function () {
      if (!S.built || els.stars.hidden || S.flownId === S.curId) return [];
      return Array.prototype.map.call(els.stars.children, function (c) { const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    },
    setStarState: function (k, st) {
      if (!S.built) return;
      const c = els.stars.children[k]; if (c) c.classList.toggle('is-gone', st === 'gone');
      if (st === 'gone') S.flownId = S.curId;
    },
    getMetaInfo: function () {
      if (!S.built) return null;
      const rect = function (node) {
        if (!node || !node.firstChild) return null;
        const r = document.createRange(); r.selectNodeContents(node);
        const b = r.getBoundingClientRect(), nb = node.getBoundingClientRect();
        if (!b.width || !b.height) return null;
        const w = Math.min(b.width, nb.width || b.width);
        return { x: b.left, y: b.top, w: w, h: b.height, text: node.textContent, font: getComputedStyle(node).font };
      };
      // مرکزِ هر ستارهٔ امتیاز (حتی بعد از پروازشان) برای ساختنِ پودرِ ستاره‌ها همراهِ عنوان
      let stars = [];
      if (!els.stars.hidden && els.stars.children.length) {
        const cs = getComputedStyle(els.stars.firstChild);
        const size = parseFloat(cs.fontSize) || 19, font = size + 'px ' + (cs.fontFamily || 'sans-serif');
        stars = Array.prototype.map.call(els.stars.children, function (c) { const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, size: size, font: font }; });
      }
      return { title: rect(els.title), artist: rect(els.artist), stars: stars };
    },
    getState: function () { return { tracks: S.tracks.length, current: S.curId, playing: !!(S.audio && !S.audio.paused), bag: S.bag.length, history: S.history.length, vol: S.vol, muted: S.muted, quiet: !!(root && root.classList.contains('is-quiet')), popOpen: !!(S.built && anyPop()), widget: S.widgetShown, mini: !!(S.miniWrap && S.miniWrap.classList.contains('is-on')) }; },
    /* سطحِ آزمون، به همان الگوی void-music-viz.js: پیمایشِ پوشه، مجوز و علت‌هایِ خرابی
       بدونِ DOM و بدونِ تقلیدِ منطق قابلِ راندن باشند (آینه‌سازیِ مجدد = ریسکِ واگرایی). */
    _test: {
      S: S, newScan: newScan, walkDir: walkDir, addFolderHandle: addFolderHandle, addEntries: addEntries,
      grant: grant, fileOf: fileOf, trackFailed: trackFailed, regrantAndPlay: regrantAndPlay,
      probePermissions: probePermissions, grantAllRoots: grantAllRoots, renderQueue: renderQueue,
      FAIL_KEY: FAIL_KEY, FAIL_GRANTABLE: FAIL_GRANTABLE, SCAN_MAX_DEPTH: SCAN_MAX_DEPTH, FAIL_STREAK_MAX: FAIL_STREAK_MAX
    }
  };
})();
