/* Void Galaxy Music — data layer for the "Message to God" Worker.
   Transport and request state only: no DOM access beyond sessionStorage.
   The panel and composer keep their existing UI; this file decides what is
   sent, which request_id is reused, and how a response is classified. */
(function (global) {
  'use strict';

  var BASE = 'https://void-galaxy-letters.minoodar.workers.dev';
  var PAGE_SIZE = 20;
  var TIMEOUT_MS = 15000;
  var PENDING_KEY = 'voidLetters.pending.v1';
  var EXPIRY_VALUES = { '24h': true, '7d': true, '30d': true, '90d': true };
  var UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  var LETTER_ID_REGEX = /^[0-9a-f]{32}$/;
  var SHARE_BASE = 'https://minoodar.github.io/void-galaxy-music/';
  /* The Worker serves GET /letters/:id, so a shared link can be built from an
     id. Only ids that match the Worker's own format are ever turned into URLs. */
  var HAS_PUBLIC_LETTER_ROUTE = true;

  function storage() {
    try { return global.sessionStorage || null; } catch (e) { return null; }
  }

  function num(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function newRequestId() {
    var c = global.crypto;
    if (c && typeof c.randomUUID === 'function') {
      var id = c.randomUUID();
      if (UUID_V4_REGEX.test(id)) return id;
    }
    var bytes = new Uint8Array(16);
    if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes);
    else for (var i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    var hex = '';
    for (var j = 0; j < 16; j++) hex += (bytes[j] + 256).toString(16).slice(1);
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' +
      hex.slice(16, 20) + '-' + hex.slice(20);
  }

  /* One request = one attempt. Timeouts and network errors are rejected with a
     plain {network:true} marker so callers never need to inspect raw errors. */
  function request(url, options) {
    var init = {};
    if (options) for (var k in options) if (Object.prototype.hasOwnProperty.call(options, k)) init[k] = options[k];
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = 0;
    if (controller) {
      init.signal = controller.signal;
      timer = setTimeout(function () { try { controller.abort(); } catch (e) {} }, TIMEOUT_MS);
    }
    var started;
    try {
      started = global.fetch(url, init);
    } catch (e) {
      clearTimeout(timer);
      return Promise.reject({ network: true });
    }
    return started.then(function (res) {
      return res.text().then(function (raw) {
        clearTimeout(timer);
        var data = null;
        try { data = raw ? JSON.parse(raw) : null; } catch (e) { data = null; }
        return { status: res.status, data: data };
      }, function () {
        clearTimeout(timer);
        throw { network: true };
      });
    }, function (err) {
      clearTimeout(timer);
      throw { network: true, aborted: !!(err && err.name === 'AbortError') };
    });
  }

  var REASON_MAP = [
    [/request_id/i, 'request_id'],
    [/expiry/i, 'expiry'],
    [/too short/i, 'short'],
    [/500 codepoints/i, 'long'],
    [/link|domain|protocol/i, 'links'],
    [/Unicode|surrogate/i, 'unicode'],
    [/control|bidi/i, 'control'],
    [/JSON/i, 'body'],
    [/payload/i, 'body']
  ];

  function reasonOf(data) {
    var msg = data && typeof data.error === 'string' ? data.error : '';
    if (!msg || msg.length > 120) return null;
    for (var i = 0; i < REASON_MAP.length; i++) if (REASON_MAP[i][0].test(msg)) return REASON_MAP[i][1];
    return null;
  }

  function isDefinitive(kind) {
    return kind === 'created' || kind === 'recovered' || kind === 'already' ||
      kind === 'expired' || kind === 'invalid';
  }

  function classify(status, data) {
    var ok = !!(data && data.ok === true);
    if ((status === 201 || status === 200) && ok && typeof data.id === 'string') {
      return {
        kind: status === 200 && data.recovered === true ? 'recovered' : 'created',
        id: data.id,
        created_at: num(data.created_at),
        expires_at: num(data.expires_at)
      };
    }
    if (status === 409 && data && data.error === 'already_submitted') {
      return { kind: 'already', next_allowed_at: num(data.next_allowed_at) };
    }
    if (status === 410 && data && data.error === 'expired') return { kind: 'expired' };
    if (status === 429) {
      var after = Number(data && data.retry_after);
      return { kind: 'rate', retry_after: isFinite(after) && after > 0 ? after : null };
    }
    if (status === 400) return { kind: 'invalid', reason: reasonOf(data) };
    if (status >= 500) return { kind: 'unavailable' };
    return { kind: 'error', status: status };
  }

  function loadPending() {
    var s = storage();
    if (!s) return null;
    try {
      var raw = s.getItem(PENDING_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (!p || typeof p.text !== 'string' || !EXPIRY_VALUES[p.expiry]) return null;
      if (typeof p.request_id !== 'string' || !UUID_V4_REGEX.test(p.request_id)) return null;
      return { request_id: p.request_id, text: p.text, expiry: p.expiry, lang: typeof p.lang === 'string' ? p.lang : null };
    } catch (e) { return null; }
  }

  function savePending(p) {
    var s = storage();
    if (!s) return;
    try { s.setItem(PENDING_KEY, JSON.stringify(p)); } catch (e) {}
  }

  function clearPending() {
    var s = storage();
    if (!s) return;
    try { s.removeItem(PENDING_KEY); } catch (e) {}
  }

  /* Reuses the stored UUID only for the exact same payload; any edit is a new
     letter and gets a new id. The record is written before the request starts
     so a reload in the same tab can still retry safely. */
  function begin(text, expiry, lang) {
    var normalizedLang = typeof lang === 'string' && lang ? lang : null;
    var stored = loadPending();
    if (stored && stored.text === text && stored.expiry === expiry && stored.lang === normalizedLang) return stored;
    var pending = { request_id: newRequestId(), text: text, expiry: expiry, lang: normalizedLang };
    savePending(pending);
    return pending;
  }

  var inFlight = false;

  function submit(pending) {
    if (inFlight) return Promise.resolve({ kind: 'busy' });
    inFlight = true;
    var payload = { text: pending.text, expiry: pending.expiry, request_id: pending.request_id };
    if (pending.lang) payload.lang = pending.lang;
    return request(BASE + '/letters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      inFlight = false;
      var out = classify(res.status, res.data);
      if (isDefinitive(out.kind)) clearPending();
      return out;
    }, function () {
      inFlight = false;
      return { kind: 'network' };
    });
  }

  /* Newest-first buffer. Pages append, ids are deduplicated, and taking a
     letter removes it so the reader never shows the same one twice. */
  function createFeed() {
    var items = [];
    var seen = {};
    var nextBefore = null;
    var hasMore = true;
    var loading = null;

    function appendPage(list) {
      for (var i = 0; i < list.length; i++) {
        var letter = list[i];
        if (!letter || typeof letter.id !== 'string' || typeof letter.body !== 'string') continue;
        if (seen[letter.id]) continue;
        seen[letter.id] = true;
        items.push({
          id: letter.id,
          lang: typeof letter.lang === 'string' ? letter.lang : null,
          text: letter.body,
          created_at: num(letter.created_at),
          expires_at: num(letter.expires_at)
        });
      }
    }

    function fetchPage() {
      var url = BASE + '/letters?limit=' + PAGE_SIZE +
        (nextBefore === null ? '' : '&before=' + encodeURIComponent(String(nextBefore)));
      loading = request(url, { method: 'GET' }).then(function (res) {
        loading = null;
        if (res.status !== 200 || !res.data || !Array.isArray(res.data.letters)) return { status: 'error' };
        appendPage(res.data.letters);
        var nb = res.data.next_before;
        if (nb === null || nb === undefined || !isFinite(Number(nb))) {
          nextBefore = null;
          hasMore = false;
        } else {
          nextBefore = Number(nb);
        }
        return { status: items.length ? 'ok' : 'empty' };
      }, function () {
        loading = null;
        return { status: 'error' };
      });
      return loading;
    }

    function next() {
      if (items.length) return Promise.resolve({ status: 'ok', letter: items.shift() });
      if (loading) {
        return loading.then(function (res) {
          if (items.length) return { status: 'ok', letter: items.shift() };
          return { status: res.status === 'error' ? 'error' : 'empty' };
        });
      }
      if (!hasMore) return Promise.resolve({ status: 'empty' });
      return fetchPage().then(function (res) {
        if (items.length) return { status: 'ok', letter: items.shift() };
        return { status: res.status === 'error' ? 'error' : 'empty' };
      });
    }

    function prefetch() {
      if (loading || !hasMore) return loading || Promise.resolve({ status: items.length ? 'ok' : 'empty' });
      return fetchPage();
    }

    return {
      next: next,
      prefetch: prefetch,
      size: function () { return items.length; },
      hasMore: function () { return hasMore; }
    };
  }

  function count() {
    return request(BASE + '/letters/count', { method: 'GET' }).then(function (res) {
      var n = res.status === 200 && res.data ? Number(res.data.active) : NaN;
      return isFinite(n) && n >= 0 ? n : null;
    }, function () { return null; });
  }

  /* Single letter behind a share link. An expired or unknown id is the same
     not_found, exactly like the Worker. Malformed ids never leave the browser. */
  function getLetter(id) {
    if (typeof id !== 'string' || !LETTER_ID_REGEX.test(id)) {
      return Promise.resolve({ status: 'not_found' });
    }
    return request(BASE + '/letters/' + id, { method: 'GET' }).then(function (res) {
      var raw = res.status === 200 && res.data ? res.data : null;
      if (raw && raw.id === id && typeof raw.text === 'string') {
        return {
          status: 'ok',
          letter: {
            id: raw.id,
            lang: typeof raw.lang === 'string' ? raw.lang : null,
            text: raw.text,
            created_at: num(raw.created_at),
            expires_at: num(raw.expires_at)
          }
        };
      }
      if (res.status === 404) return { status: 'not_found' };
      return { status: 'error' };
    }, function () {
      return { status: 'error' };
    });
  }

  function letterUrl(id) {
    if (!HAS_PUBLIC_LETTER_ROUTE) return null;
    if (typeof id !== 'string' || !LETTER_ID_REGEX.test(id)) return null;
    return SHARE_BASE + '?letter=' + id;
  }

  global.VoidLettersApi = {
    base: BASE,
    pageSize: PAGE_SIZE,
    hasPublicLetterRoute: HAS_PUBLIC_LETTER_ROUTE,
    newRequestId: newRequestId,
    begin: begin,
    submit: submit,
    clearPending: clearPending,
    loadPending: loadPending,
    createFeed: createFeed,
    count: count,
    getLetter: getLetter,
    letterUrl: letterUrl
  };
})(typeof window !== 'undefined' ? window : globalThis);
