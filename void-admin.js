/* Void Galaxy — unified admin dashboard.
   Hidden route: ?admin=true (or ?admin=1). The secret is verified against the
   letters worker's ADMIN_SECRET and kept in sessionStorage only. Every request
   carries `Authorization: Bearer <secret>`; nothing here runs for visitors. */
(function (global) {
  'use strict';

  var ADMIN_ROUTE = /[?&]admin=(?:1|true)(?:&|#|$)/.test(global.location.search);
  if (!ADMIN_ROUTE || global.__voidAdminBooted) return;
  global.__voidAdminBooted = true;

  var TOKEN_KEY = 'voidAdmin.token.v1';
  var DEFAULT_BASE = 'https://void-galaxy-letters.minoodar.workers.dev';
  var RESET_WORD = 'RESET GALAXY';
  var REQUEST_TIMEOUT_MS = 20000;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    edit: '<path d="M4 20h4l10-10-4-4L4 16v4Z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
    reset: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="4"/>',
    music: '<path d="M9 18V5l10-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'
  };

  var TRACK_MESSAGES = {
    title_required: 'A title is required.',
    title_too_long: 'The title is too long (160 characters max).',
    title_invalid: 'The title contains characters the worker refuses.',
    artist_too_long: 'The artist name is too long (160 characters max).',
    artist_invalid: 'The artist name contains characters the worker refuses.',
    audio_url_required: 'An audio URL is required.',
    audio_url_invalid: 'The audio URL must be an http(s) URL or a relative path.',
    artwork_url_invalid: 'The artwork URL must be an http(s) URL or a relative path.',
    duration_invalid: 'Duration must be seconds or m:ss (for example 3:45).',
    tags_invalid: 'Tags must be comma-separated, 24 characters each, 12 max.',
    track_limit: 'The playlist is full (200 tracks).',
    incomplete_order: 'The playlist changed elsewhere. Reloading…',
    tracks_unavailable: 'The tracks table is missing. Run the 2026-10-30-admin-tracks.sql migration.',
    invalid_body: 'The worker rejected the request body.'
  };

  var state = {
    token: '',
    view: 'music',
    tracks: [],
    letters: {
      q: '',
      lang: '',
      status: 'all',
      sort: 'created',
      order: 'desc',
      page: 0,
      limit: 25,
      total: 0,
      rows: [],
      hasMore: false
    },
    originTitle: document.title
  };

  var dom = {};
  var root = null;
  var letterSeq = 0;
  var trackSeq = 0;
  var previewSeq = 0;
  var searchTimer = 0;
  var reorderTimer = 0;
  var previewTimer = 0;
  var editingId = null;
  var confirmResolve = null;
  var sortButtons = [];

  /* ---------------------------------------------------------------- */
  /* tiny helpers                                                      */
  /* ---------------------------------------------------------------- */

  function byId(name) { return document.getElementById(name); }

  function icon(name) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'va-ico');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = ICONS[name] || '';
    return svg;
  }

  function hydrateIcons(scope) {
    var slots = scope.querySelectorAll('[data-icon]');
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var svg = icon(slot.getAttribute('data-icon'));
      slot.parentNode.replaceChild(svg, slot);
    }
  }

  function readToken() {
    try { return global.sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function writeToken(value) {
    try { global.sessionStorage.setItem(TOKEN_KEY, value); } catch (e) {}
  }
  function clearToken() {
    try { global.sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }

  function baseUrl() {
    var api = global.VoidLettersApi;
    var base = api && typeof api.base === 'string' ? api.base : DEFAULT_BASE;
    return String(base).replace(/\/+$/, '');
  }

  function mediaUrl(value) {
    if (typeof value !== 'string' || !value) return null;
    try {
      var url = new URL(value, global.location.href);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch (e) { return null; }
  }

  function cosmicUrl(title, key) {
    var art = global.VoidArtwork;
    try {
      return art && typeof art.cosmic === 'function' ? art.cosmic(title || '', key || '') : null;
    } catch (e) { return null; }
  }

  function pad2(value) { return value < 10 ? '0' + value : String(value); }

  function fmtTime(seconds) {
    var n = Number(seconds);
    if (!isFinite(n) || n <= 0) return '—';
    var d = new Date(n * 1000);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function formatDuration(seconds) {
    var total = Number(seconds);
    if (seconds === null || seconds === undefined || seconds === '' || !isFinite(total) || total < 0) return '';
    var m = Math.floor(total / 60);
    var s = Math.floor(total % 60);
    return m + ':' + pad2(s);
  }

  function displayUrl(value) {
    var text = String(value || '');
    return text.length <= 72 ? text : text.slice(0, 38) + '…' + text.slice(-30);
  }

  function shortId(id) {
    var text = String(id || '');
    return text.length > 16 ? text.slice(0, 8) + '…' + text.slice(-4) : text;
  }

  function splitTags(raw) {
    var out = [];
    var seen = {};
    var parts = String(raw || '').split(',');
    for (var i = 0; i < parts.length && out.length < 12; i++) {
      var tag = parts[i].normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
      if (!tag || tag.length > 24 || seen[tag]) continue;
      seen[tag] = true;
      out.push(tag);
    }
    return out;
  }

  function toast(message, kind) {
    var node = document.createElement('div');
    node.className = 'va-toast' + (kind === 'error' ? ' va-toast--error' : '');
    node.textContent = message;
    dom.toasts.appendChild(node);
    setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, kind === 'error' ? 5200 : 3200);
  }

  function trackMessage(code, status) {
    return TRACK_MESSAGES[code] || ('Could not save the track (' + (code || status) + ').');
  }

  /* ---------------------------------------------------------------- */
  /* transport                                                         */
  /* ---------------------------------------------------------------- */

  function api(path, options) {
    options = options || {};
    var headers = { Accept: 'application/json' };
    var token = options.token !== undefined ? options.token : state.token;
    if (token) headers.Authorization = 'Bearer ' + token;
    var init = {
      method: options.method || 'GET',
      headers: headers,
      mode: 'cors',
      credentials: 'omit'
    };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }
    var controller = typeof global.AbortController === 'function' ? new global.AbortController() : null;
    var timer = 0;
    if (controller) {
      init.signal = controller.signal;
      timer = setTimeout(function () { try { controller.abort(); } catch (e) {} }, REQUEST_TIMEOUT_MS);
    }
    return global.fetch(baseUrl() + path, init).then(function (response) {
      return response.text().then(function (raw) {
        clearTimeout(timer);
        var data = null;
        try { data = raw ? JSON.parse(raw) : null; } catch (e) { data = null; }
        return { status: response.status, data: data, network: false };
      }, function () {
        clearTimeout(timer);
        return { status: 0, data: null, network: true };
      });
    }, function () {
      clearTimeout(timer);
      return { status: 0, data: null, network: true };
    });
  }

  function authFailure(response) {
    if (response.status !== 401 && response.status !== 403) return false;
    lock('The admin session ended. Enter the secret again.');
    return true;
  }

  function setConn(connected) {
    dom.conn.className = 'va-conn ' + (connected ? 'is-on' : 'is-off');
    var label = dom.conn.querySelector('span');
    if (label) label.textContent = connected ? 'Connected' : 'Offline';
  }

  /* ---------------------------------------------------------------- */
  /* login / lock                                                      */
  /* ---------------------------------------------------------------- */

  function loginError(message) {
    if (!message) {
      dom.loginError.hidden = true;
      dom.loginError.textContent = '';
      return;
    }
    dom.loginError.hidden = false;
    dom.loginError.textContent = message;
  }

  function setLoginBusy(busy, label) {
    dom.loginSubmit.disabled = !!busy;
    dom.loginSubmit.textContent = busy ? (label || 'Unlocking…') : 'Unlock';
  }

  function showLogin(message) {
    dom.app.hidden = true;
    dom.login.hidden = false;
    setLoginBusy(false);
    loginError(message || '');
    setTimeout(function () {
      try { dom.secret.focus({ preventScroll: true }); } catch (e) {}
    }, 40);
  }

  function showApp() {
    loginError('');
    dom.login.hidden = true;
    dom.app.hidden = false;
    setView(state.view);
    document.title = 'Control Room · Void Galaxy';
    setTimeout(function () {
      try { dom.tabMusic.focus({ preventScroll: true }); } catch (e) {}
    }, 30);
  }

  function lock(message) {
    clearToken();
    state.token = '';
    state.tracks = [];
    state.letters.rows = [];
    state.letters.total = 0;
    if (dom.trackList) dom.trackList.textContent = '';
    setConn(false);
    showLogin(message || 'Locked. Enter the secret to continue.');
  }

  function onLogin(event) {
    event.preventDefault();
    var secret = dom.secret.value.trim();
    if (!secret) {
      loginError('Enter the admin secret.');
      dom.secret.focus();
      return;
    }
    if (/\s/.test(secret)) {
      loginError('The secret cannot contain spaces.');
      dom.secret.focus();
      return;
    }
    setLoginBusy(true, 'Unlocking…');
    loginError('');
    api('/admin/session', { token: secret }).then(function (response) {
      if (response.status === 200 && response.data && response.data.ok) {
        state.token = secret;
        writeToken(secret);
        dom.secret.value = '';
        setLoginBusy(false);
        showApp();
        loadAll();
        toast('Connected to the letters worker.');
        return;
      }
      setLoginBusy(false);
      if (response.status === 401 || response.status === 403) loginError('That secret was not accepted.');
      else if (response.status === 503) loginError('The worker has no admin secret configured (it must be at least 16 characters).');
      else if (response.network) loginError('Could not reach the letters worker. Check the connection and try again.');
      else loginError('Unexpected response from the worker (' + response.status + ').');
      dom.secret.focus();
    });
  }

  function verifyStoredToken() {
    state.token = readToken();
    if (!state.token) {
      showLogin('');
      return;
    }
    dom.login.hidden = false;
    dom.app.hidden = true;
    setLoginBusy(true, 'Verifying session…');
    api('/admin/session', { token: state.token }).then(function (response) {
      if (response.status === 200 && response.data && response.data.ok) {
        showApp();
        loadAll();
        return;
      }
      if (response.status === 401 || response.status === 403) {
        clearToken();
        state.token = '';
        showLogin('The saved session is no longer valid. Enter the secret again.');
      } else if (response.status === 503) {
        showLogin('The worker has no admin secret configured (it must be at least 16 characters).');
      } else if (response.network) {
        showLogin('Could not reach the letters worker. Check the connection, then unlock again.');
      } else {
        showLogin('Unexpected response from the worker (' + response.status + ').');
      }
    });
  }

  function closeAdmin() {
    clearToken();
    state.token = '';
    root.hidden = true;
    document.body.classList.remove('void-admin-on');
    document.title = state.originTitle || document.title;
    try {
      var url = new URL(global.location.href);
      url.searchParams.delete('admin');
      global.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (e) {}
  }

  /* ---------------------------------------------------------------- */
  /* tabs                                                              */
  /* ---------------------------------------------------------------- */

  function setView(view) {
    state.view = view === 'letters' ? 'letters' : 'music';
    var music = state.view === 'music';
    dom.tabMusic.setAttribute('aria-selected', music ? 'true' : 'false');
    dom.tabLetters.setAttribute('aria-selected', music ? 'false' : 'true');
    dom.tabMusic.tabIndex = music ? 0 : -1;
    dom.tabLetters.tabIndex = music ? -1 : 0;
    dom.panelMusic.hidden = !music;
    dom.panelLetters.hidden = music;
  }

  function onTabKey(event) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    var next = state.view === 'music' ? 'letters' : 'music';
    setView(next);
    (next === 'music' ? dom.tabMusic : dom.tabLetters).focus();
  }

  function loadAll() {
    loadTracks();
    loadLetters();
  }

  /* ---------------------------------------------------------------- */
  /* tracks                                                            */
  /* ---------------------------------------------------------------- */

  function findTrack(id) {
    for (var i = 0; i < state.tracks.length; i++) if (state.tracks[i].id === id) return state.tracks[i];
    return null;
  }

  function loadTracks() {
    var seq = ++trackSeq;
    dom.tracksList.classList.add('is-busy');
    api('/admin/tracks').then(function (response) {
      if (seq !== trackSeq) return;
      dom.tracksList.classList.remove('is-busy');
      if (response.network) {
        setConn(false);
        toast('Could not reach the worker.', 'error');
        return;
      }
      if (authFailure(response)) return;
      if (response.status === 200 && response.data && response.data.ok && Array.isArray(response.data.tracks)) {
        state.tracks = response.data.tracks;
        dom.tracksNote.hidden = true;
        renderTracks();
        setConn(true);
        return;
      }
      if (response.status === 503 && response.data && response.data.error === 'tracks_unavailable') {
        state.tracks = [];
        dom.tracksNote.hidden = false;
        dom.tracksNote.textContent = 'The tracks table is missing. Run migration 2026-10-30-admin-tracks.sql on the letters database, then press Refresh.';
        renderTracks();
        setConn(true);
        return;
      }
      toast('Could not load the playlist (' + response.status + ').', 'error');
    });
  }

  function renderTracks() {
    dom.trackList.textContent = '';
    dom.countTracks.textContent = String(state.tracks.length);
    dom.tracksEmpty.hidden = state.tracks.length > 0 || !dom.tracksNote.hidden;
    for (var i = 0; i < state.tracks.length; i++) {
      dom.trackList.appendChild(trackRow(state.tracks[i], i, state.tracks.length));
    }
  }

  function trackRow(track, index, total) {
    var li = document.createElement('li');
    li.className = 'va-track';
    li.setAttribute('data-id', track.id);

    var art = document.createElement('img');
    art.className = 'va-track__art';
    art.alt = '';
    art.loading = 'lazy';
    var fallback = cosmicUrl(track.title, track.id);
    art.src = mediaUrl(track.artwork_url) || fallback || '';
    art.addEventListener('error', function () {
      if (!fallback || art.src === fallback) return;
      art.src = fallback;
    });

    var main = document.createElement('div');
    main.className = 'va-track__main';

    var headline = document.createElement('div');
    headline.className = 'va-track__headline';
    var title = document.createElement('span');
    title.className = 'va-track__title';
    title.textContent = track.title || 'Untitled';
    var duration = document.createElement('span');
    duration.className = 'va-track__dur';
    duration.textContent = formatDuration(track.duration) || '—';
    headline.appendChild(title);
    headline.appendChild(duration);
    main.appendChild(headline);

    if (track.artist) {
      var artist = document.createElement('div');
      artist.className = 'va-track__artist';
      artist.textContent = track.artist;
      main.appendChild(artist);
    }

    var url = document.createElement('div');
    url.className = 'va-track__url';
    url.textContent = displayUrl(track.audio_url);
    url.title = track.audio_url || '';
    main.appendChild(url);

    if (track.tags && track.tags.length) {
      var tags = document.createElement('ul');
      tags.className = 'va-tags';
      for (var t = 0; t < track.tags.length; t++) {
        var tag = document.createElement('li');
        tag.className = 'va-tag';
        tag.textContent = track.tags[t];
        tags.appendChild(tag);
      }
      main.appendChild(tags);
    }

    var actions = document.createElement('div');
    actions.className = 'va-track__actions';
    actions.appendChild(actionButton('up', 'Move up', index === 0));
    actions.appendChild(actionButton('down', 'Move down', index === total - 1));
    actions.appendChild(actionButton('edit', 'Edit track', false));
    actions.appendChild(actionButton('delete', 'Delete track', false, 'is-danger'));

    li.appendChild(art);
    li.appendChild(main);
    li.appendChild(actions);
    return li;
  }

  function actionButton(action, label, disabled, extra) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'va-iconbtn' + (extra ? ' ' + extra : '');
    button.setAttribute('data-act', action);
    button.title = label;
    button.setAttribute('aria-label', label);
    button.disabled = !!disabled;
    button.appendChild(icon(action === 'delete' ? 'trash' : action));
    return button;
  }

  function onTrackListClick(event) {
    var target = event.target;
    var button = target && target.closest ? target.closest('button[data-act]') : null;
    if (!button || !dom.trackList.contains(button)) return;
    var row = button.closest('.va-track');
    if (!row) return;
    var id = row.getAttribute('data-id');
    var action = button.getAttribute('data-act');
    var track = findTrack(id);
    if (!track) return;
    if (action === 'edit') openTrackDialog(track);
    else if (action === 'delete') deleteTrack(track);
    else if (action === 'up' || action === 'down') moveTrack(id, action === 'up' ? -1 : 1);
  }

  function moveTrack(id, delta) {
    var index = -1;
    for (var i = 0; i < state.tracks.length; i++) {
      if (state.tracks[i].id === id) { index = i; break; }
    }
    var target = index + delta;
    if (index < 0 || target < 0 || target >= state.tracks.length) return;
    var moved = state.tracks.splice(index, 1)[0];
    state.tracks.splice(target, 0, moved);
    renderTracks();
    scheduleReorder();
    var next = null;
    for (var c = 0; c < dom.trackList.children.length; c++) {
      if (dom.trackList.children[c].getAttribute('data-id') === id) { next = dom.trackList.children[c]; break; }
    }
    if (next) {
      var buttons = next.querySelectorAll('button[data-act]');
      for (var b = 0; b < buttons.length; b++) {
        if (buttons[b].getAttribute('data-act') === (delta < 0 ? 'up' : 'down')) {
          try { buttons[b].focus({ preventScroll: true }); } catch (e) {}
          break;
        }
      }
    }
  }

  function scheduleReorder() {
    clearTimeout(reorderTimer);
    reorderTimer = setTimeout(saveOrder, 450);
  }

  function saveOrder() {
    var ids = [];
    for (var i = 0; i < state.tracks.length; i++) ids.push(state.tracks[i].id);
    api('/admin/tracks/reorder', { method: 'POST', body: { ids: ids } }).then(function (response) {
      if (response.network) {
        setConn(false);
        toast('Could not save the order. Check the connection.', 'error');
        return;
      }
      if (authFailure(response)) return;
      if (response.status === 200 && response.data && response.data.ok) {
        setConn(true);
        toast('Playlist order saved.');
        return;
      }
      if (response.status === 409 && response.data && response.data.error === 'incomplete_order') {
        toast('The playlist changed elsewhere. Reloading…', 'error');
        loadTracks();
        return;
      }
      toast('Could not save the order (' + response.status + ').', 'error');
      loadTracks();
    });
  }

  function deleteTrack(track) {
    askConfirm(
      'Delete track?',
      '“' + track.title + '” will leave the Golden Folder for every visitor. The audio file itself is untouched.',
      'Delete track',
      true
    ).then(function (confirmed) {
      if (!confirmed) return;
      api('/admin/tracks/' + encodeURIComponent(track.id), { method: 'DELETE' }).then(function (response) {
        if (response.network) {
          toast('Could not reach the worker.', 'error');
          return;
        }
        if (authFailure(response)) return;
        if (response.status === 200 && response.data && response.data.ok) {
          toast('Track removed.');
          loadTracks();
          return;
        }
        toast('Could not delete the track (' + response.status + ').', 'error');
      });
    });
  }

  /* ---- track editor ---- */

  function trackError(message) {
    if (!message) {
      dom.trackError.hidden = true;
      dom.trackError.textContent = '';
      return;
    }
    dom.trackError.hidden = false;
    dom.trackError.textContent = message;
  }

  function setTrackBusy(busy) {
    dom.trackSave.disabled = !!busy;
    dom.trackSave.textContent = busy ? 'Saving…' : 'Save track';
    dom.trackCancel.disabled = !!busy;
  }

  function openTrackDialog(track) {
    editingId = track ? track.id : null;
    dom.trackHeading.textContent = track ? 'Edit track' : 'Add track';
    dom.trTitle.value = track ? track.title || '' : '';
    dom.trArtist.value = track ? track.artist || '' : '';
    dom.trAudio.value = track ? track.audio_url || '' : '';
    dom.trArtwork.value = track ? track.artwork_url || '' : '';
    dom.trDuration.value = track && track.duration !== null && track.duration !== undefined
      ? formatDuration(track.duration)
      : '';
    dom.trTags.value = track && track.tags ? track.tags.join(', ') : '';
    trackError('');
    setTrackBusy(false);
    dom.artImg.hidden = true;
    dom.artOrb.hidden = false;
    dom.artCaption.textContent = 'Cosmic cover';
    if (!dom.trackDialog.open) dom.trackDialog.showModal();
    updatePreview();
    try {
      dom.trTitle.focus({ preventScroll: true });
      dom.trTitle.select();
    } catch (e) {}
  }

  function queuePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(updatePreview, 320);
  }

  function updatePreview() {
    clearTimeout(previewTimer);
    var seq = ++previewSeq;
    var title = dom.trTitle.value.trim();
    var audio = mediaUrl(dom.trAudio.value.trim());
    var custom = mediaUrl(dom.trArtwork.value.trim());
    var fallback = cosmicUrl(title || 'Void Galaxy', dom.trAudio.value.trim()) ||
      cosmicUrl(title || 'Void Galaxy', 'preview');

    function show(url, caption) {
      if (seq !== previewSeq) return;
      if (url) {
        dom.artImg.src = url;
        dom.artImg.hidden = false;
        dom.artOrb.hidden = true;
      } else {
        dom.artImg.hidden = true;
        dom.artOrb.hidden = false;
      }
      dom.artCaption.textContent = caption;
    }

    if (custom) { show(custom, 'Custom artwork'); return; }
    if (!audio) { show(fallback, 'Cosmic cover'); return; }
    show(fallback, 'Reading embedded cover…');
    var art = global.VoidArtwork;
    if (!art || typeof art.extractId3 !== 'function') { show(fallback, 'Cosmic cover'); return; }
    art.extractId3(audio).then(function (found) {
      if (seq !== previewSeq) return;
      if (found && found.url) show(found.url, 'Embedded cover');
      else show(fallback, 'Cosmic cover · no embedded artwork');
    }, function () {
      if (seq !== previewSeq) return;
      show(fallback, 'Cosmic cover · artwork not readable');
    });
  }

  function onTrackSubmit(event) {
    event.preventDefault();
    var payload = {
      title: dom.trTitle.value.trim(),
      artist: dom.trArtist.value.trim(),
      audio_url: dom.trAudio.value.trim(),
      artwork_url: dom.trArtwork.value.trim(),
      duration: dom.trDuration.value.trim(),
      tags: splitTags(dom.trTags.value)
    };
    if (!payload.title) {
      trackError('Add a title.');
      dom.trTitle.focus();
      return;
    }
    if (!payload.audio_url) {
      trackError('Add the audio URL.');
      dom.trAudio.focus();
      return;
    }
    var path = editingId ? '/admin/tracks/' + encodeURIComponent(editingId) : '/admin/tracks';
    var method = editingId ? 'PUT' : 'POST';
    trackError('');
    setTrackBusy(true);
    api(path, { method: method, body: payload }).then(function (response) {
      setTrackBusy(false);
      if (response.network) {
        trackError('Could not reach the worker. Check the connection.');
        return;
      }
      if (response.status === 401 || response.status === 403) {
        dom.trackDialog.close();
        lock('The admin session ended. Enter the secret again.');
        return;
      }
      if ((response.status === 200 || response.status === 201) && response.data && response.data.ok) {
        dom.trackDialog.close();
        toast(editingId ? 'Track updated.' : 'Track added.');
        loadTracks();
        return;
      }
      var code = response.data && response.data.error;
      if (response.status === 503 && code === 'tracks_unavailable') {
        trackError(TRACK_MESSAGES.tracks_unavailable);
        return;
      }
      trackError(trackMessage(code, response.status));
    });
  }

  /* ---------------------------------------------------------------- */
  /* letters                                                           */
  /* ---------------------------------------------------------------- */

  function lettersPath() {
    var l = state.letters;
    var parts = ['limit=' + l.limit, 'page=' + l.page, 'sort=' + l.sort, 'order=' + l.order];
    if (l.q) parts.push('q=' + encodeURIComponent(l.q));
    if (l.lang) parts.push('lang=' + encodeURIComponent(l.lang));
    if (l.status && l.status !== 'all') parts.push('status=' + encodeURIComponent(l.status));
    return '/admin/letters?' + parts.join('&');
  }

  function setLettersBusy(busy) {
    dom.panelLetters.setAttribute('aria-busy', busy ? 'true' : 'false');
    dom.tableWrap.classList.toggle('is-busy', !!busy);
  }

  function loadLetters() {
    var seq = ++letterSeq;
    setLettersBusy(true);
    api(lettersPath()).then(function (response) {
      if (seq !== letterSeq) return;
      setLettersBusy(false);
      if (response.network) {
        setConn(false);
        toast('Could not reach the worker.', 'error');
        return;
      }
      if (authFailure(response)) return;
      if (response.status === 200 && response.data && response.data.ok && Array.isArray(response.data.letters)) {
        state.letters.rows = response.data.letters;
        state.letters.total = Number(response.data.total) || 0;
        state.letters.page = Number(response.data.page) || 0;
        state.letters.hasMore = !!response.data.has_more;
        renderLetters();
        setConn(true);
        return;
      }
      toast('Could not load letters (' + response.status + ').', 'error');
    });
  }

  function cell(text) {
    var td = document.createElement('td');
    if (text !== undefined) td.textContent = text;
    return td;
  }

  function renderLetters() {
    dom.letterRows.textContent = '';
    dom.countLetters.textContent = String(state.letters.total);
    dom.lettersTotal.textContent = state.letters.total
      ? state.letters.total + (state.letters.total === 1 ? ' letter' : ' letters')
      : '';
    dom.lettersEmpty.hidden = state.letters.rows.length > 0;
    for (var i = 0; i < state.letters.rows.length; i++) {
      dom.letterRows.appendChild(letterRow(state.letters.rows[i]));
    }
    var pages = Math.max(1, Math.ceil(state.letters.total / state.letters.limit));
    dom.pageInfo.textContent = 'Page ' + (state.letters.page + 1) + ' of ' + pages;
    dom.prev.disabled = state.letters.page <= 0;
    dom.next.disabled = !state.letters.hasMore;
    updateSortIndicators();
  }

  function letterRow(letter) {
    var tr = document.createElement('tr');
    tr.setAttribute('data-id', letter.id);

    var statusCell = cell();
    var pill = document.createElement('span');
    var expired = letter.status === 'expired';
    pill.className = 'va-pill ' + (expired ? 'va-pill--expired' : 'va-pill--active');
    pill.textContent = expired ? 'Expired' : 'Active';
    statusCell.appendChild(pill);

    var idCell = cell();
    var idWrap = document.createElement('div');
    idWrap.className = 'va-idcell';
    var idText = document.createElement('code');
    idText.className = 'va-id';
    idText.textContent = shortId(letter.id);
    idText.title = letter.id;
    var copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'va-iconbtn va-copy';
    copy.setAttribute('data-copy', letter.id);
    copy.title = 'Copy letter ID';
    copy.setAttribute('aria-label', 'Copy letter ID');
    copy.appendChild(icon('copy'));
    idWrap.appendChild(idText);
    idWrap.appendChild(copy);
    idCell.appendChild(idWrap);

    var langCell = cell();
    if (letter.lang) {
      var lang = document.createElement('span');
      lang.className = 'va-lang';
      lang.textContent = String(letter.lang).toUpperCase();
      langCell.appendChild(lang);
    } else {
      langCell.textContent = '—';
    }

    var msgCell = cell();
    var body = typeof letter.body === 'string' ? letter.body : '';
    var msg = document.createElement('div');
    msg.className = 'va-msg' + (body.length > 140 ? ' is-clamped' : '');
    msg.setAttribute('dir', 'auto');
    msg.textContent = body;
    msgCell.appendChild(msg);
    if (body.length > 140) {
      var more = document.createElement('button');
      more.type = 'button';
      more.className = 'va-msg__more';
      more.textContent = 'Show full message';
      more.addEventListener('click', function () {
        var expanded = !msg.classList.toggle('is-clamped');
        more.textContent = expanded ? 'Show less' : 'Show full message';
      });
      msgCell.appendChild(more);
    }

    var actionCell = cell();
    var del = document.createElement('button');
    del.type = 'button';
    del.className = 'va-iconbtn is-danger';
    del.setAttribute('data-del', letter.id);
    del.title = 'Delete letter';
    del.setAttribute('aria-label', 'Delete letter');
    del.appendChild(icon('trash'));
    actionCell.appendChild(del);

    tr.appendChild(statusCell);
    tr.appendChild(idCell);
    tr.appendChild(cell(fmtTime(letter.created_at)));
    tr.appendChild(cell(fmtTime(letter.expires_at)));
    tr.appendChild(langCell);
    tr.appendChild(msgCell);
    tr.appendChild(actionCell);
    return tr;
  }

  function updateSortIndicators() {
    for (var i = 0; i < sortButtons.length; i++) {
      var button = sortButtons[i];
      var active = button.getAttribute('data-sort') === state.letters.sort;
      button.classList.toggle('is-active', active);
      var mark = button.querySelector('span');
      if (mark) mark.textContent = active ? (state.letters.order === 'asc' ? '↑' : '↓') : '';
    }
  }

  function onSortClick(event) {
    var button = event.currentTarget;
    var sort = button.getAttribute('data-sort');
    var letters = state.letters;
    if (letters.sort === sort) {
      letters.order = letters.order === 'asc' ? 'desc' : 'asc';
    } else {
      letters.sort = sort;
      letters.order = sort === 'id' ? 'asc' : 'desc';
    }
    letters.page = 0;
    loadLetters();
  }

  function applySearch() {
    clearTimeout(searchTimer);
    var next = dom.q.value.trim();
    if (next === state.letters.q) return;
    state.letters.q = next;
    state.letters.page = 0;
    loadLetters();
  }

  function copyText(text) {
    if (global.navigator.clipboard && typeof global.navigator.clipboard.writeText === 'function') {
      global.navigator.clipboard.writeText(text).then(function () {
        toast('Letter ID copied.');
      }, function () {
        toast('Could not copy the ID.', 'error');
      });
      return;
    }
    try {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(area);
      toast(ok ? 'Letter ID copied.' : 'Could not copy the ID.', ok ? undefined : 'error');
    } catch (e) {
      toast('Could not copy the ID.', 'error');
    }
  }

  function onLetterRowsClick(event) {
    var target = event.target;
    var copy = target && target.closest ? target.closest('button[data-copy]') : null;
    if (copy) {
      copyText(copy.getAttribute('data-copy'));
      return;
    }
    var del = target && target.closest ? target.closest('button[data-del]') : null;
    if (del) {
      var row = del.closest('tr');
      if (row) deleteLetter(row.getAttribute('data-id'));
    }
  }

  function deleteLetter(id) {
    askConfirm(
      'Delete letter?',
      'This removes the letter permanently; its share link stops working immediately.',
      'Delete letter',
      true
    ).then(function (confirmed) {
      if (!confirmed) return;
      api('/admin/letters/' + encodeURIComponent(id), { method: 'DELETE' }).then(function (response) {
        if (response.network) {
          toast('Could not reach the worker.', 'error');
          return;
        }
        if (authFailure(response)) return;
        if (response.status === 200 && response.data && response.data.ok) {
          toast(response.data.deleted ? 'Letter deleted.' : 'That letter was already gone.');
          loadLetters();
          return;
        }
        toast('Could not delete the letter (' + response.status + ').', 'error');
      });
    });
  }

  /* ---- nuclear reset ---- */

  function openReset() {
    dom.resetInput.value = '';
    dom.resetOk.disabled = true;
    dom.resetOk.textContent = 'Reset galaxy';
    dom.resetError.hidden = true;
    if (!dom.resetDialog.open) dom.resetDialog.showModal();
    setTimeout(function () {
      try { dom.resetInput.focus({ preventScroll: true }); } catch (e) {}
    }, 30);
  }

  function onResetSubmit() {
    if (dom.resetInput.value !== RESET_WORD) return;
    dom.resetOk.disabled = true;
    dom.resetOk.textContent = 'Resetting…';
    dom.resetError.hidden = true;
    api('/admin/letters/clear', { method: 'POST', body: { all: true, confirm: RESET_WORD } }).then(function (response) {
      dom.resetOk.textContent = 'Reset galaxy';
      if (response.network) {
        dom.resetError.hidden = false;
        dom.resetError.textContent = 'Could not reach the worker. Check the connection.';
        dom.resetOk.disabled = false;
        return;
      }
      if (response.status === 401 || response.status === 403) {
        dom.resetDialog.close();
        lock('The admin session ended. Enter the secret again.');
        return;
      }
      if (response.status === 200 && response.data && response.data.ok) {
        dom.resetDialog.close();
        var removed = Number(response.data.letters_deleted) || 0;
        toast('Galaxy reset. ' + removed + (removed === 1 ? ' letter' : ' letters') + ' removed.');
        state.letters.page = 0;
        loadLetters();
        return;
      }
      dom.resetError.hidden = false;
      dom.resetError.textContent = 'Reset failed (' + response.status + ').';
      dom.resetOk.disabled = false;
    });
  }

  /* ---- reusable confirmation ---- */

  function askConfirm(title, text, label, danger) {
    dom.confirmHeading.textContent = title;
    dom.confirmText.textContent = text;
    dom.confirmOk.textContent = label;
    dom.confirmOk.className = 'va-btn ' + (danger ? 'va-btn--danger' : 'va-btn--primary');
    if (dom.confirmDialog.open) dom.confirmDialog.close();
    dom.confirmDialog.showModal();
    return new Promise(function (resolve) { confirmResolve = resolve; });
  }

  function settleConfirm(value) {
    var resolve = confirmResolve;
    confirmResolve = null;
    if (dom.confirmDialog.open) dom.confirmDialog.close();
    if (resolve) resolve(value);
  }

  /* ---------------------------------------------------------------- */
  /* shell                                                             */
  /* ---------------------------------------------------------------- */

  var TEMPLATE = [
    '<div class="va-stars" aria-hidden="true"></div>',
    '<div class="va-shell">',
    '  <header class="va-top">',
    '    <div class="va-brand">',
    '      <span class="va-brand__orb" aria-hidden="true"></span>',
    '      <span class="va-brand__text"><strong>Void Galaxy</strong><span>Control Room</span></span>',
    '    </div>',
    '    <div class="va-top__right">',
    '      <span class="va-conn" id="va-conn" title="Worker connection"><i></i><span>Not connected</span></span>',
    '      <button class="va-iconbtn" id="va-refresh" type="button" title="Refresh" aria-label="Refresh"><span data-icon="refresh"></span></button>',
    '      <button class="va-iconbtn" id="va-lock" type="button" title="Lock session" aria-label="Lock session"><span data-icon="lock"></span></button>',
    '      <button class="va-iconbtn" id="va-close" type="button" title="Close admin" aria-label="Close admin"><span data-icon="close"></span></button>',
    '    </div>',
    '  </header>',
    '  <section class="va-login" id="va-login" hidden>',
    '    <form class="va-login__card" id="va-login-form" novalidate>',
    '      <span class="va-login__orb" aria-hidden="true"></span>',
    '      <h1>Enter the control room</h1>',
    '      <p>This dashboard manages the Golden Folder playlist and the galaxy\u2019s letters. The secret is verified by the letters worker and kept in this tab\u2019s session memory only.</p>',
    '      <label class="va-field" for="va-secret"><span>Admin secret</span>',
    '        <span class="va-field__wrap">',
    '          <input id="va-secret" type="password" name="secret" autocomplete="current-password" spellcheck="false" minlength="16" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022">',
    '          <button class="va-reveal" id="va-reveal" type="button" aria-label="Show secret" aria-pressed="false">Show</button>',
    '        </span>',
    '      </label>',
    '      <p class="va-login__error" id="va-login-error" role="alert" hidden></p>',
    '      <button class="va-btn va-btn--primary va-login__submit" id="va-login-submit" type="submit">Unlock</button>',
    '    </form>',
    '  </section>',
    '  <section class="va-app" id="va-app" hidden aria-label="Admin dashboard">',
    '    <div class="va-tabs" role="tablist" aria-label="Admin sections">',
    '      <button class="va-tab" id="va-tab-music" type="button" role="tab" aria-selected="true" aria-controls="va-panel-music"><span data-icon="music"></span>Music<span class="va-tab__count" id="va-count-tracks">0</span></button>',
    '      <button class="va-tab" id="va-tab-letters" type="button" role="tab" aria-selected="false" aria-controls="va-panel-letters"><span data-icon="mail"></span>Letters<span class="va-tab__count" id="va-count-letters">0</span></button>',
    '    </div>',
    '    <section class="va-panel" id="va-panel-music" role="tabpanel" aria-labelledby="va-tab-music">',
    '      <div class="va-panelhead">',
    '        <div>',
    '          <h2>Golden Folder playlist</h2>',
    '          <p>Every visitor sees this list. Use an absolute <code>https://</code> stream or a path relative to the site; the order here is the order visitors see.</p>',
    '        </div>',
    '        <button class="va-btn va-btn--primary" id="va-add-track" type="button"><span data-icon="plus"></span>Add track</button>',
    '      </div>',
    '      <div class="va-note" id="va-tracks-note" hidden></div>',
    '      <ul class="va-tracks" id="va-track-list" aria-label="Playlist tracks"></ul>',
    '      <p class="va-empty" id="va-tracks-empty" hidden>No tracks in the playlist. Add the first one.</p>',
    '    </section>',
    '    <section class="va-panel" id="va-panel-letters" role="tabpanel" aria-labelledby="va-tab-letters" hidden>',
    '      <div class="va-panelhead">',
    '        <div>',
    '          <h2>Letters to the galaxy</h2>',
    '          <p>Active and expired messages. Search, sort, read in full, delete one, or clear the whole galaxy.</p>',
    '        </div>',
    '        <button class="va-btn va-btn--danger-ghost" id="va-reset" type="button"><span data-icon="reset"></span>Reset galaxy\u2026</button>',
    '      </div>',
    '      <div class="va-toolbar">',
    '        <label class="va-search" for="va-q"><span class="va-sr">Search letters</span><span data-icon="search"></span><input id="va-q" type="search" maxlength="120" autocomplete="off" placeholder="Search text or paste a 32-character ID"></label>',
    '        <label class="va-select"><span>Language</span><select id="va-lang"><option value="">All</option><option value="fa">Persian</option><option value="en">English</option></select></label>',
    '        <label class="va-select"><span>Status</span><select id="va-status"><option value="all">All</option><option value="active">Active</option><option value="expired">Expired</option></select></label>',
    '        <span class="va-toolbar__count" id="va-letters-total"></span>',
    '      </div>',
    '      <div class="va-table-wrap" id="va-table-wrap">',
    '        <table class="va-table">',
    '          <thead><tr>',
    '            <th scope="col">Status</th>',
    '            <th scope="col"><button class="va-sort" type="button" data-sort="id">ID<span></span></button></th>',
    '            <th scope="col"><button class="va-sort" type="button" data-sort="created">Created<span></span></button></th>',
    '            <th scope="col"><button class="va-sort" type="button" data-sort="expires">Expires<span></span></button></th>',
    '            <th scope="col">Lang</th>',
    '            <th scope="col">Message</th>',
    '            <th scope="col"><span class="va-sr">Actions</span></th>',
    '          </tr></thead>',
    '          <tbody id="va-letter-rows"></tbody>',
    '        </table>',
    '        <p class="va-empty" id="va-letters-empty" hidden>No letters match this filter.</p>',
    '      </div>',
    '      <div class="va-pager">',
    '        <button class="va-btn" id="va-prev" type="button" disabled>\u2190 Previous</button>',
    '        <span id="va-page-info">Page 1 of 1</span>',
    '        <button class="va-btn" id="va-next" type="button" disabled>Next \u2192</button>',
    '      </div>',
    '    </section>',
    '  </section>',
    '  <footer class="va-foot">Session-only access \u00b7 the secret never enters the URL or local storage</footer>',
    '</div>',
    '<dialog class="va-dialog" id="va-track-dialog" aria-labelledby="va-track-heading">',
    '  <form class="va-form" id="va-track-form" novalidate>',
    '    <div class="va-dialog__head">',
    '      <h2 id="va-track-heading">Add track</h2>',
    '      <button class="va-iconbtn" id="va-track-x" type="button" aria-label="Close"><span data-icon="close"></span></button>',
    '    </div>',
    '    <div class="va-form__grid">',
    '      <div class="va-artpreview">',
    '        <div class="va-artpreview__frame"><img id="va-art-img" alt="" hidden><span class="va-artpreview__orb" id="va-art-orb" aria-hidden="true"></span></div>',
    '        <small id="va-art-caption">Cosmic cover</small>',
    '      </div>',
    '      <div class="va-form__fields">',
    '        <label class="va-field va-field--wide" for="va-tr-title"><span>Title</span><input id="va-tr-title" type="text" maxlength="160" required autocomplete="off"></label>',
    '        <label class="va-field va-field--wide" for="va-tr-artist"><span>Artist</span><input id="va-tr-artist" type="text" maxlength="160" autocomplete="off"></label>',
    '        <label class="va-field va-field--wide" for="va-tr-audio"><span>Audio URL</span><input id="va-tr-audio" type="text" maxlength="2048" required autocomplete="off" spellcheck="false" placeholder="https://\u2026 or ./audio/track.mp3"></label>',
    '        <label class="va-field va-field--wide" for="va-tr-artwork"><span>Artwork URL <em>optional</em></span><input id="va-tr-artwork" type="text" maxlength="2048" autocomplete="off" spellcheck="false" placeholder="Empty = embedded cover, then cosmic cover"></label>',
    '        <label class="va-field" for="va-tr-duration"><span>Duration</span><input id="va-tr-duration" type="text" maxlength="8" autocomplete="off" placeholder="3:45"></label>',
    '        <label class="va-field" for="va-tr-tags"><span>Tags</span><input id="va-tr-tags" type="text" maxlength="300" autocomplete="off" placeholder="calm, piano"></label>',
    '        <p class="va-form__error" id="va-track-error" role="alert" hidden></p>',
    '      </div>',
    '    </div>',
    '    <div class="va-dialog__foot">',
    '      <button class="va-btn" id="va-track-cancel" type="button">Cancel</button>',
    '      <button class="va-btn va-btn--primary" id="va-track-save" type="submit">Save track</button>',
    '    </div>',
    '  </form>',
    '</dialog>',
    '<dialog class="va-dialog va-dialog--sm" id="va-confirm-dialog" aria-labelledby="va-confirm-heading">',
    '  <div class="va-dialog__head"><h2 id="va-confirm-heading">Delete?</h2></div>',
    '  <div class="va-dialog__body"><p id="va-confirm-text"></p></div>',
    '  <div class="va-dialog__foot">',
    '    <button class="va-btn" id="va-confirm-cancel" type="button">Cancel</button>',
    '    <button class="va-btn va-btn--danger" id="va-confirm-ok" type="button">Delete</button>',
    '  </div>',
    '</dialog>',
    '<dialog class="va-dialog va-dialog--sm va-dialog--danger" id="va-reset-dialog" aria-labelledby="va-reset-heading">',
    '  <div class="va-dialog__head"><h2 id="va-reset-heading">Nuclear Galaxy Reset</h2><button class="va-iconbtn" id="va-reset-x" type="button" aria-label="Close"><span data-icon="close"></span></button></div>',
    '  <div class="va-dialog__body">',
    '    <div class="va-warning"><span data-icon="reset"></span><span>This permanently deletes <strong>every letter</strong>, every submission record and the legacy sender ledger. The global hourly abuse counter stays intact. There is no undo.</span></div>',
    '    <label class="va-field" for="va-reset-input"><span>Type <code>RESET GALAXY</code> to confirm</span><input id="va-reset-input" type="text" autocomplete="off" spellcheck="false" placeholder="RESET GALAXY"></label>',
    '    <p class="va-form__error" id="va-reset-error" role="alert" hidden></p>',
    '  </div>',
    '  <div class="va-dialog__foot">',
    '    <button class="va-btn" id="va-reset-cancel" type="button">Cancel</button>',
    '    <button class="va-btn va-btn--danger" id="va-reset-ok" type="button" disabled>Reset galaxy</button>',
    '  </div>',
    '</dialog>',
    '<div class="va-toasts" id="va-toasts" aria-live="polite" aria-atomic="false"></div>'
  ].join('\n');

  function cacheDom() {
    dom.conn = byId('va-conn');
    dom.refresh = byId('va-refresh');
    dom.lock = byId('va-lock');
    dom.close = byId('va-close');
    dom.login = byId('va-login');
    dom.loginForm = byId('va-login-form');
    dom.secret = byId('va-secret');
    dom.reveal = byId('va-reveal');
    dom.loginError = byId('va-login-error');
    dom.loginSubmit = byId('va-login-submit');
    dom.app = byId('va-app');
    dom.tabMusic = byId('va-tab-music');
    dom.tabLetters = byId('va-tab-letters');
    dom.countTracks = byId('va-count-tracks');
    dom.countLetters = byId('va-count-letters');
    dom.panelMusic = byId('va-panel-music');
    dom.panelLetters = byId('va-panel-letters');
    dom.tracksNote = byId('va-tracks-note');
    dom.trackList = byId('va-track-list');
    dom.tracksList = dom.trackList;
    dom.tracksEmpty = byId('va-tracks-empty');
    dom.addTrack = byId('va-add-track');
    dom.q = byId('va-q');
    dom.lang = byId('va-lang');
    dom.status = byId('va-status');
    dom.lettersTotal = byId('va-letters-total');
    dom.tableWrap = byId('va-table-wrap');
    dom.letterRows = byId('va-letter-rows');
    dom.lettersEmpty = byId('va-letters-empty');
    dom.pageInfo = byId('va-page-info');
    dom.prev = byId('va-prev');
    dom.next = byId('va-next');
    dom.reset = byId('va-reset');
    dom.trackDialog = byId('va-track-dialog');
    dom.trackForm = byId('va-track-form');
    dom.trackHeading = byId('va-track-heading');
    dom.trackX = byId('va-track-x');
    dom.trackCancel = byId('va-track-cancel');
    dom.trackSave = byId('va-track-save');
    dom.trackError = byId('va-track-error');
    dom.trTitle = byId('va-tr-title');
    dom.trArtist = byId('va-tr-artist');
    dom.trAudio = byId('va-tr-audio');
    dom.trArtwork = byId('va-tr-artwork');
    dom.trDuration = byId('va-tr-duration');
    dom.trTags = byId('va-tr-tags');
    dom.artImg = byId('va-art-img');
    dom.artOrb = byId('va-art-orb');
    dom.artCaption = byId('va-art-caption');
    dom.confirmDialog = byId('va-confirm-dialog');
    dom.confirmHeading = byId('va-confirm-heading');
    dom.confirmText = byId('va-confirm-text');
    dom.confirmOk = byId('va-confirm-ok');
    dom.confirmCancel = byId('va-confirm-cancel');
    dom.resetDialog = byId('va-reset-dialog');
    dom.resetInput = byId('va-reset-input');
    dom.resetOk = byId('va-reset-ok');
    dom.resetCancel = byId('va-reset-cancel');
    dom.resetX = byId('va-reset-x');
    dom.resetError = byId('va-reset-error');
    dom.toasts = byId('va-toasts');
    sortButtons = dom.panelLetters.querySelectorAll('.va-sort');
  }

  function bind() {
    dom.loginForm.addEventListener('submit', onLogin);
    dom.reveal.addEventListener('click', function () {
      var showing = dom.secret.type === 'text';
      dom.secret.type = showing ? 'password' : 'text';
      dom.reveal.textContent = showing ? 'Show' : 'Hide';
      dom.reveal.setAttribute('aria-pressed', showing ? 'false' : 'true');
      dom.reveal.setAttribute('aria-label', showing ? 'Show secret' : 'Hide secret');
    });

    dom.tabMusic.addEventListener('click', function () { setView('music'); });
    dom.tabLetters.addEventListener('click', function () { setView('letters'); });
    dom.tabMusic.addEventListener('keydown', onTabKey);
    dom.tabLetters.addEventListener('keydown', onTabKey);

    dom.refresh.addEventListener('click', function () {
      if (!state.token) return;
      loadAll();
    });
    dom.lock.addEventListener('click', function () {
      lock('Session locked. Enter the secret to continue.');
    });
    dom.close.addEventListener('click', closeAdmin);

    dom.trackList.addEventListener('click', onTrackListClick);
    dom.addTrack.addEventListener('click', function () { openTrackDialog(null); });

    dom.trackX.addEventListener('click', function () { dom.trackDialog.close(); });
    dom.trackCancel.addEventListener('click', function () { dom.trackDialog.close(); });
    dom.trackForm.addEventListener('submit', onTrackSubmit);
    dom.trTitle.addEventListener('input', queuePreview);
    dom.trAudio.addEventListener('input', queuePreview);
    dom.trArtwork.addEventListener('input', queuePreview);
    dom.artImg.addEventListener('error', function () {
      var fallback = cosmicUrl(dom.trTitle.value.trim() || 'Void Galaxy', dom.trAudio.value.trim());
      if (!fallback || dom.artImg.src === fallback) return;
      dom.artImg.src = fallback;
      dom.artCaption.textContent = 'Cosmic cover · artwork could not load';
    });

    dom.q.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(applySearch, 300);
    });
    dom.q.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      applySearch();
    });
    dom.lang.addEventListener('change', function () {
      state.letters.lang = dom.lang.value;
      state.letters.page = 0;
      loadLetters();
    });
    dom.status.addEventListener('change', function () {
      state.letters.status = dom.status.value;
      state.letters.page = 0;
      loadLetters();
    });
    dom.prev.addEventListener('click', function () {
      if (state.letters.page <= 0) return;
      state.letters.page -= 1;
      loadLetters();
    });
    dom.next.addEventListener('click', function () {
      if (!state.letters.hasMore) return;
      state.letters.page += 1;
      loadLetters();
    });
    for (var i = 0; i < sortButtons.length; i++) {
      sortButtons[i].addEventListener('click', onSortClick);
    }
    dom.letterRows.addEventListener('click', onLetterRowsClick);

    dom.reset.addEventListener('click', openReset);
    dom.resetInput.addEventListener('input', function () {
      dom.resetOk.disabled = dom.resetInput.value !== RESET_WORD;
    });
    dom.resetOk.addEventListener('click', onResetSubmit);
    dom.resetCancel.addEventListener('click', function () { dom.resetDialog.close(); });
    dom.resetX.addEventListener('click', function () { dom.resetDialog.close(); });

    dom.confirmOk.addEventListener('click', function () { settleConfirm(true); });
    dom.confirmCancel.addEventListener('click', function () { settleConfirm(false); });
    dom.confirmDialog.addEventListener('cancel', function (event) {
      event.preventDefault();
      settleConfirm(false);
    });
    dom.confirmDialog.addEventListener('close', function () {
      if (!confirmResolve) return;
      var resolve = confirmResolve;
      confirmResolve = null;
      resolve(false);
    });
  }

  function boot() {
    root = document.createElement('div');
    root.id = 'void-admin-root';
    root.innerHTML = TEMPLATE;
    document.body.appendChild(root);
    document.body.classList.add('void-admin-on');
    hydrateIcons(root);
    cacheDom();
    bind();
    updateSortIndicators();
    verifyStoredToken();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
