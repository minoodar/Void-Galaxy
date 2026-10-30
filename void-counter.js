(function () {
  'use strict';

  // Set this to your deployed Worker URL (see README.md); until then the widget stays hidden.
  const API = 'https://void-galaxy-api.minoodar.workers.dev';

  var CK = 'vgm-stats', NK = 'vgm-counted', VK = 'vgm-visitor';
  var root, btn, panel, cl, nU, nR, nS;
  var data, open, pending, timer, nf, rm;

  function st(k, v, l) {
    try {
      var s = l ? localStorage : sessionStorage;
      if (v == null) return s.getItem(k);
      s.setItem(k, v);
    } catch (e) {}
    return null;
  }
  function fmt(v) {
    return (nf || (nf = new Intl.NumberFormat())).format(v);
  }
  function good(d) {
    if (!d) return null;
    var u = +d.unique_visitors, t = +d.total_sessions, r = +d.returning_ratio;
    return u >= 0 && t >= 0 && r >= 0
      ? { u: u, t: t, r: Math.round(Math.min(1, r) * 100) } : null;
  }
  function api(path, body) {
    var c = new AbortController();
    setTimeout(c.abort.bind(c), 4000);
    var o = { method: body ? 'POST' : 'GET', body: body, keepalive: true, signal: c.signal };
    if (body) o.headers = { 'Content-Type': 'application/json' };
    return fetch(API + path, o).then(function (res) {
      if (!res.ok) throw 0;
      return res.json();
    });
  }

  function start() {
    try {
      rm = matchMedia('(prefers-reduced-motion:reduce)').matches;
      build();
      addEventListener('voidmusic:mode', sync);
      document.onvisibilitychange = function () {
        cl.toggle('is-paused', document.hidden);
      };
      sync();
      if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl || st(NK) === '1') {
        var b, s;
        try { b = JSON.parse(st(CK)); } catch (e) {}
        if (b && Date.now() - b.at < 300000 && (s = good(b.d))) return render(s);
        api('/stats').then(ok, noop);
      } else {
        // The numbers must not depend on the write: a blocked or failed /hit
        // (ad-blocker, offline, filtered) still falls through to GET /stats.
        api('/hit', JSON.stringify({ returning: !!st(VK, null, 1) })).then(function () {
          st(NK, '1');
          st(VK, '1', 1);
          return api('/stats');
        }, function () {
          return api('/stats');
        }).then(ok, noop);
      }
    } catch (e) {}
  }
  function noop() {}
  function ok(d) {
    var s = good(d);
    if (s) {
      st(CK, JSON.stringify({ at: Date.now(), d: d }));
      try { render(s); } catch (e) {}
    }
  }

  function build() {
    root = document.createElement('div');
    root.id = 'void-counter';
    root.hidden = true;
    root.innerHTML = '<button class=vc-b aria-expanded=false aria-label="Visitor statistics"><span class=vc-d></span></button><div class=vc-p aria-live=polite aria-hidden=true title="Anonymous, hashed counts. No personal data stored."><span class=vc-l><b></b> listeners</span> <span class=vc-s><span></span>% returned · <span></span> sessions</span></div>';
    document.body.appendChild(root);
    cl = root.classList;
    btn = root.firstChild;
    panel = root.lastChild;
    nU = panel.children[0].firstChild;
    nR = panel.children[1].children[0];
    nS = panel.children[1].children[1];

    // The player sweeps stray body overlays in music mode; keep this widget exempt.
    new MutationObserver(function () {
      if (!root.hasAttribute('data-vm-swept')) return;
      root.removeAttribute('data-vm-swept');
      root.style.display = '';
    }).observe(root, { attributes: true });

    btn.onclick = function () { open ? closeP() : openP(); };
    root.onpointerenter = function (e) {
      if (e.pointerType === 'touch') return;
      openP();
      later(0);
    };
    root.onpointerleave = function (e) {
      if (e.pointerType !== 'touch') later(1200);
    };
    btn.onfocus = function () {
      if (btn.matches(':focus-visible')) openP();
    };
    document.addEventListener('pointerdown', function (e) {
      if (open && !root.contains(e.target)) closeP();
    });
    addEventListener('keydown', function (e) {
      if (!open || e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      closeP();
    }, true);
  }

  function later(ms) {
    clearTimeout(timer);
    timer = ms && setTimeout(closeP, ms);
  }
  function openP() {
    if (!data || root.hidden) return;
    open = 1;
    cl.add('is-open');
    btn.ariaExpanded = 'true';
    panel.ariaHidden = 'false';
    pending && countUp(pending = 0);
    later(3000);
  }
  function closeP() {
    later(0);
    if (!open) return;
    open = 0;
    cl.remove('is-open');
    btn.ariaExpanded = 'false';
    panel.ariaHidden = 'true';
  }

  function paint(u, t, r) {
    nU.textContent = fmt(u);
    nR.textContent = r;
    nS.textContent = fmt(t);
  }
  function countUp() {
    if (rm) { paint(data.u, data.t, data.r); return; }
    var t0 = 0;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / 560), e = 1 - Math.pow(1 - p, 3);
      paint((data.u * e) | 0, (data.t * e) | 0, data.r);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function render(s) {
    data = s;
    pending = !rm;
    paint(rm ? s.u : 0, rm ? s.t : 0, s.r);
    publish();
    sync();
  }
  // The site shows one stats surface; void-letters.js renders it and listens here.
  function publish() {
    if (!data) return;
    var payload = { u: data.u, t: data.t, r: data.r };
    window.VoidCounterStats = payload;
    try {
      dispatchEvent(new CustomEvent('voidcounter:stats', { detail: payload }));
    } catch (e) {}
  }
  function sync() {
    if (document.getElementById('void-galaxy-stats')) {
      closeP();
      root.hidden = 1;
      cl.remove('is-on');
      return;
    }
    if (data && document.body.classList.contains('void-music-on')) {
      if (root.hidden) {
        root.hidden = 0;
        cl.remove('is-on');
        requestAnimationFrame(function () { cl.add('is-on'); });
      }
      return;
    }
    closeP();
    root.hidden = 1;
    cl.remove('is-on');
  }

  addEventListener('load', function () { requestAnimationFrame(start); });
  // The unified stats pill asks for a re-sync once it exists; until then this
  // widget may have been shown for music mode at boot.
  window.VoidCounterSync = sync;
})();