/* Void Galaxy Music — album artwork resolution.
   Order: explicit artwork URL > embedded ID3 APIC/MP4 covr (remote, CORS
   permitting) > deterministic cosmic SVG from a title hash. Pure DOM/Blob
   APIs only; no network writes and no third-party code. */
(function (global) {
  'use strict';
  if (global.VoidArtwork) return;

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var MAX_ART_BYTES = 768 * 1024;
  var ART_TIMEOUT_MS = 8000;
  var id3Cache = new Map();

  function hash(text) {
    var h = 2166136261;
    var value = String(text || '');
    for (var i = 0; i < value.length; i++) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function fixed(value) {
    return Math.round(value * 100) / 100;
  }

  /* Deterministic celestial cover. The title is never embedded in the SVG,
     only hashed, so user text cannot break out of the markup. */
  function cosmic(title, key) {
    var seed = hash(String(title || '') + '\u0000' + String(key || ''));
    var rand = rng(seed);
    var hue = seed % 360;
    var hue2 = (hue + 55 + Math.floor(rand() * 120)) % 360;
    var hue3 = (hue + 300 - Math.floor(rand() * 80)) % 360;
    var cx = 110 + rand() * 100;
    var cy = 105 + rand() * 90;
    var radius = 46 + rand() * 30;
    var tilt = -28 + rand() * 56;
    var parts = [];

    parts.push('<svg xmlns="' + SVG_NS + '" viewBox="0 0 320 320" width="320" height="320">');
    parts.push('<defs>');
    parts.push('<radialGradient id="bg" cx="50%" cy="42%" r="78%">' +
      '<stop offset="0%" stop-color="hsl(' + hue + ',52%,13%)"/>' +
      '<stop offset="58%" stop-color="hsl(' + hue3 + ',46%,7%)"/>' +
      '<stop offset="100%" stop-color="#03020a"/></radialGradient>');
    parts.push('<linearGradient id="planet" x1="22%" y1="8%" x2="82%" y2="96%">' +
      '<stop offset="0%" stop-color="hsl(' + hue2 + ',88%,74%)"/>' +
      '<stop offset="46%" stop-color="hsl(' + hue + ',72%,48%)"/>' +
      '<stop offset="100%" stop-color="hsl(' + hue3 + ',68%,18%)"/></linearGradient>');
    parts.push('<radialGradient id="shine" cx="30%" cy="24%" r="62%">' +
      '<stop offset="0%" stop-color="rgba(255,255,255,.72)"/>' +
      '<stop offset="46%" stop-color="rgba(255,255,255,.10)"/>' +
      '<stop offset="100%" stop-color="rgba(255,255,255,0)"/></radialGradient>');
    parts.push('<radialGradient id="neb1" cx="50%" cy="50%" r="50%">' +
      '<stop offset="0%" stop-color="hsl(' + hue2 + ',90%,62%)" stop-opacity=".34"/>' +
      '<stop offset="100%" stop-color="hsl(' + hue2 + ',90%,40%)" stop-opacity="0"/></radialGradient>');
    parts.push('<radialGradient id="neb2" cx="50%" cy="50%" r="50%">' +
      '<stop offset="0%" stop-color="hsl(' + hue3 + ',95%,60%)" stop-opacity=".28"/>' +
      '<stop offset="100%" stop-color="hsl(' + hue3 + ',95%,40%)" stop-opacity="0"/></radialGradient>');
    parts.push('<radialGradient id="vignette" cx="50%" cy="48%" r="72%">' +
      '<stop offset="62%" stop-color="#000" stop-opacity="0"/>' +
      '<stop offset="100%" stop-color="#000" stop-opacity=".62"/></radialGradient>');
    parts.push('<filter id="blur24" x="-40%" y="-40%" width="180%" height="180%">' +
      '<feGaussianBlur stdDeviation="22"/></filter>');
    parts.push('<filter id="blur8" x="-40%" y="-40%" width="180%" height="180%">' +
      '<feGaussianBlur stdDeviation="7"/></filter>');
    parts.push('</defs>');

    parts.push('<rect width="320" height="320" fill="url(#bg)"/>');
    parts.push('<ellipse cx="' + fixed(52 + rand() * 90) + '" cy="' + fixed(60 + rand() * 70) +
      '" rx="' + fixed(90 + rand() * 60) + '" ry="' + fixed(60 + rand() * 50) +
      '" fill="url(#neb1)" filter="url(#blur24)"/>');
    parts.push('<ellipse cx="' + fixed(180 + rand() * 90) + '" cy="' + fixed(200 + rand() * 70) +
      '" rx="' + fixed(80 + rand() * 60) + '" ry="' + fixed(55 + rand() * 45) +
      '" fill="url(#neb2)" filter="url(#blur24)"/>');

    // Deterministic star field; a handful of four-point sparkles.
    var starCount = 42;
    for (var i = 0; i < starCount; i++) {
      var sx = fixed(rand() * 320);
      var sy = fixed(rand() * 320);
      var sr = fixed(0.35 + rand() * 1.15);
      var so = fixed(0.22 + rand() * 0.62);
      parts.push('<circle cx="' + sx + '" cy="' + sy + '" r="' + sr +
        '" fill="#fff" opacity="' + so + '"/>');
    }
    for (var s = 0; s < 5; s++) {
      var x = fixed(24 + rand() * 272);
      var y = fixed(24 + rand() * 272);
      var len = fixed(2.6 + rand() * 2.8);
      parts.push('<path d="M' + x + ' ' + (y - len) + 'L' + x + ' ' + (y + len) +
        'M' + (x - len) + ' ' + y + 'L' + (x + len) + ' ' + y +
        '" stroke="#fff" stroke-width=".8" opacity=".55"/>');
    }

    parts.push('<ellipse cx="160" cy="164" rx="142" ry="58" fill="none" stroke="hsl(' +
      hue2 + ',90%,70%)" stroke-opacity=".20" stroke-width=".8" transform="rotate(' +
      fixed(tilt / 3) + ' 160 164)"/>');
    parts.push('<ellipse cx="160" cy="164" rx="124" ry="44" fill="none" stroke="#fff" stroke-opacity=".10" ' +
      'stroke-width=".7" stroke-dasharray="3 5" transform="rotate(' + fixed(tilt / 2) + ' 160 164)"/>');

    parts.push('<g transform="rotate(' + fixed(tilt) + ' ' + fixed(cx) + ' ' + fixed(cy) + ')">');
    parts.push('<ellipse cx="' + fixed(cx) + '" cy="' + fixed(cy) + '" rx="' + fixed(radius * 1.75) +
      '" ry="' + fixed(radius * 0.44) + '" fill="none" stroke="hsl(' + hue2 + ',92%,78%)" ' +
      'stroke-opacity=".55" stroke-width="3.2"/>');
    parts.push('<ellipse cx="' + fixed(cx) + '" cy="' + fixed(cy) + '" rx="' + fixed(radius * 1.95) +
      '" ry="' + fixed(radius * 0.52) + '" fill="none" stroke="hsl(' + hue3 + ',88%,70%)" ' +
      'stroke-opacity=".18" stroke-width="1"/>');
    parts.push('</g>');
    parts.push('<circle cx="' + fixed(cx) + '" cy="' + fixed(cy) + '" r="' + fixed(radius) +
      '" fill="url(#planet)"/>');
    parts.push('<circle cx="' + fixed(cx) + '" cy="' + fixed(cy) + '" r="' + fixed(radius) +
      '" fill="url(#shine)"/>');
    parts.push('<circle cx="' + fixed(cx + radius * 0.34) + '" cy="' + fixed(cy - radius * 0.26) +
      '" r="' + fixed(radius * 0.9) + '" fill="#03020a" opacity=".48" filter="url(#blur8)"/>');
    parts.push('<circle cx="' + fixed(cx) + '" cy="' + fixed(cy) + '" r="' + fixed(radius) +
      '" fill="none" stroke="rgba(255,255,255,.20)" stroke-width=".8"/>');

    var cometX = fixed(40 + rand() * 120);
    var cometY = fixed(34 + rand() * 70);
    parts.push('<path d="M' + cometX + ' ' + cometY + 'L' + fixed(cometX - 34) + ' ' +
      fixed(cometY + 22) + '" stroke="rgba(255,255,255,.55)" stroke-width="1.2" ' +
      'stroke-linecap="round"/>');
    parts.push('<circle cx="' + cometX + '" cy="' + cometY + '" r="1.6" fill="#fff"/>');
    parts.push('<rect width="320" height="320" fill="url(#vignette)"/>');
    parts.push('</svg>');

    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(parts.join(''));
  }

  function sniffMime(bytes, fallback) {
    if (!bytes || bytes.length < 4) return fallback || 'image/jpeg';
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) return 'image/jpeg';
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png';
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return 'image/webp';
    if (bytes[0] === 0x42 && bytes[1] === 0x4D) return 'image/bmp';
    return fallback || 'image/jpeg';
  }

  function u32be(bytes, pos) {
    return ((bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]) >>> 0;
  }

  function syncsafe(bytes, pos) {
    return ((bytes[pos] & 0x7F) << 21) | ((bytes[pos + 1] & 0x7F) << 14) |
      ((bytes[pos + 2] & 0x7F) << 7) | (bytes[pos + 3] & 0x7F);
  }

  function unsync(bytes) {
    var out = new Uint8Array(bytes.length);
    var n = 0;
    for (var i = 0; i < bytes.length; i++) {
      out[n++] = bytes[i];
      if (bytes[i] === 0xFF && bytes[i + 1] === 0x00) i++;
    }
    return out.subarray(0, n);
  }

  function findTerminator(bytes, start, wide) {
    if (wide) {
      for (var i = start; i + 1 < bytes.length; i += 2) {
        if (bytes[i] === 0 && bytes[i + 1] === 0) return { index: i, length: 2 };
      }
      return { index: bytes.length, length: 0 };
    }
    for (var j = start; j < bytes.length; j++) {
      if (bytes[j] === 0) return { index: j, length: 1 };
    }
    return { index: bytes.length, length: 0 };
  }

  function ascii(bytes, start, count) {
    var text = '';
    for (var i = 0; i < count && start + i < bytes.length; i++) {
      text += String.fromCharCode(bytes[start + i]);
    }
    return text;
  }

  /* ID3v2.2/2.3/2.4 APIC/PIC extraction. Returns raw picture bytes only. */
  function parseId3(bytes) {
    if (!bytes || bytes.length < 10) return null;
    if (ascii(bytes, 0, 3) !== 'ID3') return null;
    var version = bytes[3];
    if (version < 2 || version > 4) return null;
    var flags = bytes[5];
    var tagSize = syncsafe(bytes, 6);
    if (tagSize < 10 || tagSize > bytes.length) tagSize = bytes.length - 10;
    var body = bytes.subarray(10, 10 + tagSize);
    if (flags & 0x80) body = unsync(body);

    var pos = 0;
    if (version >= 3 && (flags & 0x40) && body.length >= 4) {
      pos = version === 4 ? syncsafe(body, 0) : u32be(body, 0) + 4;
    }

    var idLength = version === 2 ? 3 : 4;
    var headerLength = version === 2 ? 6 : 10;
    for (var guard = 0; guard < 512 && pos + headerLength <= body.length; guard++) {
      if (body[pos] === 0) break;
      var id = ascii(body, pos, idLength);
      var size = version === 2
        ? ((body[pos + 3] << 16) | (body[pos + 4] << 8) | body[pos + 5])
        : (version === 4 ? syncsafe(body, pos + 4) : u32be(body, pos + 4));
      var start = pos + headerLength;
      if (size <= 0 || start + size > body.length) break;

      var frameFlags = version === 2 ? 0 : ((body[pos + 8] << 8) | body[pos + 9]);
      // Skip frames whose body layout we do not decode: grouping identity,
      // compression, encryption, and v2.4 unsync/data-length prefixes all
      // shift or transform the picture bytes. The cosmic cover is the fallback.
      if (frameFlags & (version === 3 ? 0x00E0 : 0x004F)) { pos = start + size; continue; }

      if (id === 'APIC' || id === 'PIC') {
        var frame = body.subarray(start, start + size);
        var encoding = frame[0];
        var wide = encoding === 1 || encoding === 2;
        var cursor = 1;
        if (version === 2) {
          cursor += 3; // "JPG"/"PNG"
        } else {
          var mimeEnd = frame.indexOf(0, 1);
          if (mimeEnd < 0) { pos = start + size; continue; }
          cursor = mimeEnd + 1;
        }
        cursor += 1; // picture type
        var term = findTerminator(frame, cursor, wide);
        var dataStart = term.index + term.length;
        if (dataStart < frame.length - 64) {
          var data = frame.subarray(dataStart);
          return { mime: sniffMime(data), bytes: data };
        }
      }
      pos = start + size;
    }
    return null;
  }

  function resolveUrl(value, base) {
    /* Empty input must stay empty: new URL('', base) resolves to the page itself,
       which would masquerade as a real artwork URL. */
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      var url = new URL(value.trim(), base || (global.location && global.location.href) || undefined);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
      return url.href;
    } catch (e) {
      return null;
    }
  }

  async function readAtMost(url, maxBytes) {
    if (typeof global.fetch !== 'function') return null;
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = 0;
    if (controller) {
      timer = setTimeout(function () { try { controller.abort(); } catch (e) {} }, ART_TIMEOUT_MS);
    }
    try {
      var response = await global.fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-' + (maxBytes - 1) },
        mode: 'cors',
        credentials: 'omit',
        signal: controller ? controller.signal : undefined
      });
      if (!response || !response.ok) return null;
      if (!response.body || typeof response.body.getReader !== 'function') {
        var whole = new Uint8Array(await response.arrayBuffer());
        return whole.subarray(0, maxBytes);
      }
      var reader = response.body.getReader();
      var chunks = [];
      var total = 0;
      while (total < maxBytes) {
        var step = await reader.read();
        if (step.done) break;
        var chunk = step.value;
        if (!chunk || !chunk.length) continue;
        var room = maxBytes - total;
        var slice = chunk.length > room ? chunk.subarray(0, room) : chunk;
        chunks.push(slice);
        total += slice.length;
        if (slice.length < chunk.length) break;
      }
      try { await reader.cancel(); } catch (e) {}
      var out = new Uint8Array(total);
      var offset = 0;
      for (var i = 0; i < chunks.length; i++) {
        out.set(chunks[i], offset);
        offset += chunks[i].length;
      }
      return out;
    } catch (e) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async function extractId3(audioUrl) {
    var url = resolveUrl(audioUrl);
    if (!url) return null;
    if (id3Cache.has(url)) return id3Cache.get(url);
    var job = (async function () {
      var bytes = await readAtMost(url, MAX_ART_BYTES);
      var art = parseId3(bytes);
      if (!art || !global.URL || typeof global.URL.createObjectURL !== 'function') return null;
      var blob = new Blob([art.bytes], { type: art.mime });
      return { url: global.URL.createObjectURL(blob), mime: art.mime, source: 'id3' };
    })().catch(function () {
      id3Cache.delete(url);
      return null;
    });
    id3Cache.set(url, job);
    return job;
  }

  function customArtworkUrl(value) {
    return resolveUrl(value);
  }

  /* Never rejects: every failure ends on the cosmic cover. */
  async function resolveRemote(options) {
    var opts = options || {};
    var title = opts.title || '';
    var custom = customArtworkUrl(opts.artworkUrl);
    if (custom) return { url: custom, source: 'custom' };
    if (opts.audioUrl) {
      try {
        var embedded = await extractId3(opts.audioUrl);
        if (embedded && embedded.url) return embedded;
      } catch (e) {}
    }
    return { url: cosmic(title, opts.audioUrl || opts.artworkUrl || ''), source: 'cosmic' };
  }

  function clearCache() {
    id3Cache.forEach(function (job) {
      job.then(function (art) {
        if (art && art.url && art.source === 'id3') {
          try { URL.revokeObjectURL(art.url); } catch (e) {}
        }
      }, function () {});
    });
    id3Cache.clear();
  }

  global.VoidArtwork = {
    cosmic: cosmic,
    hash: hash,
    parseId3: parseId3,
    sniffMime: sniffMime,
    extractId3: extractId3,
    resolveRemote: resolveRemote,
    customArtworkUrl: customArtworkUrl,
    clearCache: clearCache
  };
})(typeof window !== 'undefined' ? window : globalThis);
