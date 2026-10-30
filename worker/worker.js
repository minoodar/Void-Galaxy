// Void Galaxy Music — visitor counter Worker (Cloudflare Workers + D1).
// Privacy: only SHA-256(ip + SALT) is stored. Raw IPs never leave memory.
// Secrets: SALT and ADMIN_TOKEN (wrangler secret put). See README.md.

const PROD_ORIGIN = 'https://minoodar.github.io';
const HIT_LIMIT = 60;
const HIT_WINDOW_MS = 3600000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors = corsFor(origin, env);
    const deny = origin && !cors.allowed;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: cors.allowed ? 204 : 403, headers: cors.headers });
    }
    try {
      if (deny) return json({ error: 'forbidden' }, 403, cors.headers);
      if (url.pathname === '/hit' && request.method === 'POST') return await hit(request, env, cors);
      if (url.pathname === '/stats' && request.method === 'GET') return await stats(env, cors);
      if (url.pathname === '/admin' && request.method === 'GET') return await admin(request, env);
      return json({ error: 'not_found' }, 404, cors.headers);
    } catch (e) {
      return json({ error: 'unavailable' }, 503, cors.headers);
    }
  }
};

function corsFor(origin, env) {
  const allowed = origin === PROD_ORIGIN ||
    (env.ALLOW_LOCAL === '1' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  const headers = { Vary: 'Origin' };
  if (allowed) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return { allowed, headers };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers)
  });
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const view = new Uint8Array(digest);
  let out = '';
  for (let i = 0; i < view.length; i++) out += view[i].toString(16).padStart(2, '0');
  return out;
}

async function hit(request, env, cors) {
  const ua = request.headers.get('User-Agent') || '';
  const headers = Object.assign({ 'Cache-Control': 'no-store' }, cors.headers);
  if (!ua || /bot|crawler|spider|headless/i.test(ua)) {
    return new Response(null, { status: 204, headers });
  }
  if (!env.SALT || !env.DB) return json({ error: 'unavailable' }, 503, headers);

  const ip = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
  const input = ip + env.SALT;
  const ipHash = await sha256(input);
  const now = Date.now();
  const hour = Math.floor(now / HIT_WINDOW_MS);
  const day = new Date(now).toISOString().slice(0, 10);

  let body = {};
  try { body = await request.json(); } catch (e) {}
  const returning = !!(body && body.returning);

  const limited = await env.DB
    .prepare('SELECT count FROM rate WHERE ip_hash = ? AND hour = ?')
    .bind(ipHash, hour)
    .first();
  if (limited && limited.count >= HIT_LIMIT) {
    return json({ error: 'rate_limited' }, 429, headers);
  }

  const existing = await env.DB
    .prepare('SELECT 1 FROM visitors WHERE ip_hash = ?')
    .bind(ipHash)
    .first();

  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO visitors (ip_hash, hits, sessions, first_seen, last_seen) VALUES (?, 1, 1, ?, ?) ' +
      'ON CONFLICT(ip_hash) DO UPDATE SET hits = hits + 1, sessions = sessions + 1, last_seen = excluded.last_seen'
    ).bind(ipHash, now, now),
    env.DB.prepare(
      'INSERT INTO daily (day, unique_new, sessions) VALUES (?, ?, 1) ' +
      'ON CONFLICT(day) DO UPDATE SET unique_new = unique_new + excluded.unique_new, sessions = sessions + 1'
    ).bind(day, existing ? 0 : 1),
    env.DB.prepare(
      'INSERT INTO rate (ip_hash, hour, count) VALUES (?, ?, 1) ' +
      'ON CONFLICT(ip_hash, hour) DO UPDATE SET count = count + 1'
    ).bind(ipHash, hour),
    env.DB.prepare('DELETE FROM rate WHERE hour < ?').bind(hour - 2)
  ]);

  return json({ ok: true, returning }, 200, headers);
}

async function stats(env, cors) {
  if (!env.DB) return json({ error: 'unavailable' }, 503, cors.headers);
  const rows = await env.DB.batch([
    env.DB.prepare('SELECT COUNT(*) AS u, COALESCE(SUM(sessions), 0) AS s FROM visitors'),
    env.DB.prepare('SELECT COUNT(*) AS r FROM visitors WHERE sessions > 1')
  ]);
  const first = (rows[0] && rows[0].results && rows[0].results[0]) || {};
  const second = (rows[1] && rows[1].results && rows[1].results[0]) || {};
  const unique = Number(first.u) || 0;
  const sessions = Number(first.s) || 0;
  const returning = Number(second.r) || 0;
  return json({
    unique_visitors: unique,
    total_sessions: sessions,
    returning_ratio: unique ? returning / unique : 0
  }, 200, Object.assign({ 'Cache-Control': 'public, max-age=60' }, cors.headers));
}

async function admin(request, env) {
  const headers = { 'Cache-Control': 'no-store' };
  const auth = request.headers.get('Authorization') || '';
  if (!env.ADMIN_TOKEN || !safeEqual(auth, 'Bearer ' + env.ADMIN_TOKEN)) {
    return json({ error: 'unauthorized' }, 401, headers);
  }
  if (!env.DB) return json({ error: 'unavailable' }, 503, headers);
  const rows = await env.DB.batch([
    env.DB.prepare(
      'SELECT substr(ip_hash, 1, 12) AS ip_hash, hits, sessions, first_seen, last_seen ' +
      'FROM visitors ORDER BY hits DESC LIMIT 200'
    ),
    env.DB.prepare('SELECT day, unique_new, sessions FROM daily ORDER BY day DESC LIMIT 30')
  ]);
  return json({
    visitors: (rows[0] && rows[0].results) || [],
    daily: (rows[1] && rows[1].results) || []
  }, 200, headers);
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
