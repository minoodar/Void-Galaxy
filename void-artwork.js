/* Deterministic Void cosmic artwork generator. */
(function (global) {
  'use strict';
  if (global.VoidArtwork) return;

  var SVG_NS = 'http://www.w3.org/2000/svg';

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

  global.VoidArtwork = { cosmic: cosmic };
})(window);
