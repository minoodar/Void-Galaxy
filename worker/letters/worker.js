// Void Galaxy Music — "Message to God" letters service.
// Deployed as the standalone Worker `void-galaxy-letters`.
//
// Privacy: a raw IP is used only in memory to derive
//   HMAC-SHA-256(LETTER_SALT, "letters:v1|" + ip)
// and is never stored or logged. The domain prefix and a secret separate from
// the visitor counter's SALT keep the two hash spaces independent.
//
// Additive by design: the counter tables (visitors, daily, rate) are untouched.

const PROD_ORIGIN = 'https://minoodar.github.io';
// Phase A design assumption, not a proven production ceiling.
const GLOBAL_HOURLY_LIMIT = 500;
const DAILY_SENDER_LIMIT = 2;
const DAY_SEC = 86400;
// Idempotency is kept for the longest possible letter lifetime (90d).
const SUBMISSION_RETENTION_SEC = 7776000;
const MAX_BODY_BYTES = 4096;
const MAX_TRACK_BODY_BYTES = 8192;
const DEFAULT_PAGE = 20;
const MAX_PAGE = 50;
const MAX_ADMIN_PAGE = 500;
const MAX_TRACKS = 200;
const PRUNE_PER_RUN = 25;
const DEV_SALT = 'DEV_FALLBACK_SALT_DO_NOT_USE_IN_PROD';
const RESET_CONFIRMATION = 'RESET GALAXY';
const TRACK_ID_REGEX = /^[a-z0-9][a-z0-9-]{0,63}$/;
const LETTER_SORTS = Object.freeze({
  seq: 'seq',
  created: 'created_at',
  expires: 'expires_at',
  id: 'id'
});

const TTL_MAP = Object.freeze({
  '24h': 86400,
  '7d': 604800,
  '30d': 2592000,
  '90d': 7776000
});

// Reject non-printable controls and bidi embedding/override markers.
const CONTROL_OR_BIDI_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/;
// ZWNJ/ZWJ are legitimate Persian and emoji orthography, so the stored body
// keeps them. Only non-orthographic zero-width characters are removed from
// storage; a derived copy with every zero-width character removed is used for
// link detection so they cannot split a URL. Unpaired surrogates are rejected.
const STORAGE_ZERO_WIDTH_REGEX = /[\u200B\u2060\uFEFF]/g;
const DETECTION_ZERO_WIDTH_REGEX = /[\u200B-\u200D\u2060\uFEFF]/g;
const LONE_SURROGATE_REGEX = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const LINK_DETECTOR_REGEX = /(?:https?:\/\/|ftp:\/\/|\/\/|www\.)[^\s/$.?#].[^\s]*|[a-z0-9-]+\.(?:com|org|net|edu|gov|io|co|me|info|biz|dev|app|ai|xyz)\b|\b\d{1,3}(?:\.\d{1,3}){3}\b/i;
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Public letter ids are 32 lowercase hex characters (see randomId()).
const LETTER_ID_REGEX = /^[0-9a-f]{32}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors = corsFor(origin, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: cors.allowed ? 204 : 403, headers: cors.headers });
    }

    try {
      if (origin && !cors.allowed) return json({ ok: false, error: 'forbidden' }, 403, cors.headers);
      if (url.pathname === '/letters/count' && request.method === 'GET') {
        return await countLetters(env, cors);
      }
      if (url.pathname.startsWith('/letters/') && request.method === 'GET') {
        return await getLetterById(url.pathname.slice('/letters/'.length), env, cors);
      }
      if (url.pathname === '/letters' && request.method === 'GET') {
        return await listLetters(url, env, cors);
      }
      if (url.pathname === '/letters' && request.method === 'POST') {
        return await createLetter(request, env, cors);
      }
      if (url.pathname === '/tracks' && request.method === 'GET') {
        return await listTracks(env, cors, false);
      }

      // One guard for every management route: no handler below can forget auth.
      if (url.pathname.startsWith('/admin/')) {
        const headers = adminHeaders(cors);
        const auth = await adminAuthorized(request, env);
        if (!auth.ok) {
          return json({ ok: false, error: auth.status === 503 ? 'unavailable' : 'forbidden' }, auth.status, headers);
        }
        if (url.pathname === '/admin/session' && request.method === 'GET') {
          return json({ ok: true, service: 'void-galaxy-letters' }, 200, headers);
        }
        if (url.pathname === '/admin/letters' && request.method === 'GET') {
          return await adminListLetters(url, env, cors);
        }
        if (url.pathname === '/admin/letters/clear' && request.method === 'POST') {
          return await adminClearLetters(request, env, cors);
        }
        if (url.pathname.startsWith('/admin/letters/') && request.method === 'DELETE') {
          return await adminDeleteLetter(url.pathname.slice('/admin/letters/'.length), env, cors);
        }
        if (url.pathname === '/admin/tracks' && request.method === 'GET') {
          return await listTracks(env, cors, true);
        }
        if (url.pathname === '/admin/tracks' && request.method === 'POST') {
          return await createTrack(request, env, cors);
        }
        if (url.pathname === '/admin/tracks/reorder' && request.method === 'POST') {
          return await reorderTracks(request, env, cors);
        }
        if (url.pathname.startsWith('/admin/tracks/') && (request.method === 'PUT' || request.method === 'DELETE')) {
          return await mutateTrack(url.pathname.slice('/admin/tracks/'.length), request, env, cors);
        }
        return json({ ok: false, error: 'not_found' }, 404, headers);
      }
      return json({ ok: false, error: 'not_found' }, 404, cors.headers);
    } catch (e) {
      return json({ ok: false, error: 'unavailable' }, 503, cors.headers);
    }
  }
};

function isLocalEnv(env) {
  return env.ENVIRONMENT === 'local-dev' || env.ALLOW_LOCAL === '1';
}

function corsFor(origin, env) {
  const local = isLocalEnv(env) && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const allowed = origin === PROD_ORIGIN || local;
  const headers = { Vary: 'Origin' };
  if (allowed) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return { allowed, headers };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign({
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff'
    }, headers)
  });
}

function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

async function hashIp(ip, salt) {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(salt),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(`letters:v1|${ip}`));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function getSenderHash(request, secretSalt) {
  const ip = request.headers.get('cf-connecting-ip') ||
             request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             '127.0.0.1';
  return await hashIp(ip, secretSalt || DEV_SALT);
}

export function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'Invalid JSON body' };
  }

  const { text, expiry, request_id, lang } = payload;

  if (typeof request_id !== 'string' || !UUID_V4_REGEX.test(request_id)) {
    return { ok: false, error: 'Valid UUIDv4 request_id is required' };
  }

  if (typeof expiry !== 'string' || !Object.prototype.hasOwnProperty.call(TTL_MAP, expiry)) {
    return { ok: false, error: 'Invalid expiry duration. Must be 24h, 7d, 30d, or 90d' };
  }

  if (typeof text !== 'string') {
    return { ok: false, error: 'Field "text" must be a string' };
  }

  if (LONE_SURROGATE_REGEX.test(text)) {
    return { ok: false, error: 'Text contains invalid Unicode' };
  }

  if (CONTROL_OR_BIDI_REGEX.test(text)) {
    return { ok: false, error: 'Control characters and bidi overrides are prohibited' };
  }

  // NFC for storage; ZWNJ/ZWJ stay in the body for Persian and emoji.
  const normalized = text.normalize('NFC').replace(STORAGE_ZERO_WIDTH_REGEX, '').trim();
  const storedCount = Array.from(normalized).length;
  // Derived copy for the visible-length floor and link checks: every zero-width
  // character is removed here, so ZWNJ/ZWJ cannot split a URL.
  const detectionText = normalized.replace(DETECTION_ZERO_WIDTH_REGEX, '');
  const visibleCount = Array.from(detectionText).length;

  if (visibleCount < 3) {
    return { ok: false, error: 'Message is too short (min 3 codepoints)' };
  }
  if (storedCount > 500) {
    return { ok: false, error: 'Message exceeds maximum limit of 500 codepoints' };
  }

  // NFKC catches full-width/compatibility obfuscation before link detection.
  const linkProbe = detectionText.normalize('NFKC');
  if (LINK_DETECTOR_REGEX.test(linkProbe)) {
    return { ok: false, error: 'Hyperlinks, domains, and protocol references are prohibited' };
  }

  let validLang = null;
  if (typeof lang === 'string') {
    const cleanLang = lang.trim().toLowerCase();
    if (/^[a-z]{2,3}(-[a-z0-9]{2,4})?$/.test(cleanLang)) validLang = cleanLang;
  }

  return {
    ok: true,
    data: {
      text: normalized,
      ttl: TTL_MAP[expiry],
      requestId: request_id.toLowerCase(),
      lang: validLang
    }
  };
}

async function readJsonBody(request, maxBytes) {
  const max = maxBytes || MAX_BODY_BYTES;
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > max) {
    return { ok: false, status: 413, error: 'payload_too_large' };
  }
  let raw;
  try {
    raw = await request.text();
  } catch (e) {
    return { ok: false, status: 400, error: 'invalid_json' };
  }
  if (raw.length > max) {
    return { ok: false, status: 413, error: 'payload_too_large' };
  }
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (e) {
    return { ok: false, status: 400, error: 'invalid_json' };
  }
}

function resolveSalt(env) {
  if (env.LETTER_SALT) return env.LETTER_SALT;
  if (isLocalEnv(env)) return DEV_SALT;
  return null;
}

async function findSubmission(env, senderHash, requestId) {
  return await env.DB
    .prepare('SELECT letter_id, created_at FROM letter_submissions WHERE sender_hash = ? AND request_id = ?')
    .bind(senderHash, requestId)
    .first();
}

async function recentSubmissionStats(env, senderHash, now) {
  return await env.DB
    .prepare('SELECT COUNT(*) AS count, MIN(created_at) AS oldest FROM letter_submissions ' +
      'WHERE sender_hash = ? AND created_at > ?')
    .bind(senderHash, now - DAY_SEC)
    .first();
}

function dailyRetryAfter(stats, now) {
  const oldest = Number(stats && stats.oldest) || now;
  return Math.max(1, oldest + DAY_SEC - now);
}

async function adminAuthorized(request, env) {
  const secret = env && env.ADMIN_SECRET;
  if (typeof secret !== 'string' || secret.length < 16) return { ok: false, status: 503 };
  const header = request.headers.get('Authorization') || '';
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  if (!match) return { ok: false, status: 401 };
  const encoder = new TextEncoder();
  const [given, expected] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(match[1])),
    crypto.subtle.digest('SHA-256', encoder.encode(secret))
  ]);
  const a = new Uint8Array(given);
  const b = new Uint8Array(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0 ? { ok: true } : { ok: false, status: 403 };
}

function adminHeaders(cors) {
  return Object.assign({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, cors.headers);
}

async function findActiveLetterById(env, id, now) {
  return await env.DB
    .prepare('SELECT id, created_at, expires_at FROM letters WHERE id = ? AND expires_at > ?')
    .bind(id, now)
    .first();
}

function recoveredResponse(letter, headers) {
  return json({
    ok: true,
    id: letter.id,
    created_at: Number(letter.created_at),
    expires_at: Number(letter.expires_at),
    recovered: true
  }, 200, headers);
}

async function createLetter(request, env, cors) {
  const headers = Object.assign({ 'Cache-Control': 'no-store' }, cors.headers);
  if (!env || !env.DB) return json({ ok: false, error: 'unavailable' }, 503, headers);

  const salt = resolveSalt(env);
  if (!salt) return json({ ok: false, error: 'unavailable' }, 503, headers);

  const body = await readJsonBody(request);
  if (!body.ok) return json({ ok: false, error: body.error }, body.status, headers);

  const validated = validatePayload(body.value);
  if (!validated.ok) return json({ ok: false, error: validated.error }, 400, headers);

  const { text, ttl, requestId, lang } = validated.data;
  const senderHash = await getSenderHash(request, salt);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + ttl;
  const hour = Math.floor(now / 3600);

  // Idempotent retry: the same sender + request_id always maps to one letter.
  const existing = await findSubmission(env, senderHash, requestId);
  if (existing) {
    const letter = await findActiveLetterById(env, existing.letter_id, now);
    if (letter) return recoveredResponse(letter, headers);
    return json({ ok: false, error: 'expired' }, 410, headers);
  }

  // Sliding 24h per-sender ceiling (2 letters).
  const recent = await recentSubmissionStats(env, senderHash, now);
  if (Number(recent && recent.count) >= DAILY_SENDER_LIMIT) {
    return json({
      ok: false,
      error: 'rate_limited',
      retry_after: dailyRetryAfter(recent, now)
    }, 429, headers);
  }

  // Cheap global pre-check; the guarded increment below is the hard ceiling.
  const globalRow = await env.DB
    .prepare('SELECT count FROM letter_limits WHERE scope = ? AND bucket = ?')
    .bind('global', hour)
    .first();
  if (Number(globalRow && globalRow.count) >= GLOBAL_HOURLY_LIMIT) {
    return json({
      ok: false,
      error: 'rate_limited',
      retry_after: 3600 - (now % 3600)
    }, 429, headers);
  }

  const id = randomId();

  // The count is repeated inside the INSERT so two concurrent requests cannot
  // both slip past the 2-per-24h ceiling; the batch is transactional.
  const claimStmt = env.DB.prepare(
    'INSERT INTO letter_submissions (request_id, sender_hash, letter_id, created_at) ' +
    'SELECT ?, ?, ?, ? ' +
    'WHERE (SELECT COUNT(*) FROM letter_submissions WHERE sender_hash = ? AND created_at > ?) < ? ' +
    'ON CONFLICT(request_id) DO NOTHING'
  ).bind(requestId, senderHash, id, now, senderHash, now - DAY_SEC, DAILY_SENDER_LIMIT);

  const insertStmt = env.DB.prepare(
    'INSERT INTO letters (id, body, lang, created_at, expires_at) ' +
    'SELECT ?, ?, ?, ?, ? ' +
    'WHERE EXISTS (SELECT 1 FROM letter_submissions WHERE sender_hash = ? AND request_id = ? AND letter_id = ?) ' +
    'ON CONFLICT(id) DO NOTHING'
  ).bind(id, text, lang, now, expiresAt, senderHash, requestId, id);

  const bumpGlobal = env.DB.prepare(
    'INSERT INTO letter_limits (scope, bucket, count) VALUES (?, ?, 1) ' +
    'ON CONFLICT(scope, bucket) DO UPDATE SET count = count + 1 WHERE count < ?'
  ).bind('global', hour, GLOBAL_HOURLY_LIMIT);

  const pruneLetters = env.DB.prepare(
    'DELETE FROM letters WHERE seq IN ' +
    '(SELECT seq FROM letters WHERE expires_at < ? ORDER BY expires_at LIMIT ?)'
  ).bind(now, PRUNE_PER_RUN);

  const pruneBuckets = env.DB.prepare('DELETE FROM letter_limits WHERE bucket < ?').bind(hour - 2);

  const pruneSubmissions = env.DB.prepare(
    'DELETE FROM letter_submissions WHERE request_id IN ' +
    '(SELECT request_id FROM letter_submissions WHERE created_at < ? LIMIT ?)'
  ).bind(now - SUBMISSION_RETENTION_SEC, PRUNE_PER_RUN);

  // D1 batch is documented as transactional; the guarded statements use
  // meta.changes so both ceilings still hold if two requests race.
  const results = await env.DB.batch([
    claimStmt, insertStmt, bumpGlobal, pruneLetters, pruneBuckets, pruneSubmissions
  ]);

  const claimChanges = changesOf(results[0]);
  const letterChanges = changesOf(results[1]);
  const globalChanges = changesOf(results[2]);

  if (claimChanges === 0) {
    // Either the same request_id raced ahead of us or the daily ceiling filled.
    const current = await findSubmission(env, senderHash, requestId);
    if (current) {
      const letter = await findActiveLetterById(env, current.letter_id, now);
      if (letter) return recoveredResponse(letter, headers);
      return json({ ok: false, error: 'expired' }, 410, headers);
    }
    const stats = await recentSubmissionStats(env, senderHash, now);
    return json({
      ok: false,
      error: 'rate_limited',
      retry_after: dailyRetryAfter(stats, now)
    }, 429, headers);
  }

  if (letterChanges === 0) {
    return json({ ok: false, error: 'unavailable' }, 503, headers);
  }

  if (globalChanges === 0) {
    // The global ceiling refused this request after the claim was written:
    // remove exactly this submission and letter so no over-limit content survives.
    await env.DB.batch([
      env.DB.prepare(
        'DELETE FROM letters WHERE id = ? AND EXISTS ' +
        '(SELECT 1 FROM letter_submissions WHERE sender_hash = ? AND request_id = ? AND letter_id = ?)'
      ).bind(id, senderHash, requestId, id),
      env.DB.prepare('DELETE FROM letter_submissions WHERE sender_hash = ? AND request_id = ?')
        .bind(senderHash, requestId)
    ]);
    return json({
      ok: false,
      error: 'rate_limited',
      retry_after: 3600 - (now % 3600)
    }, 429, headers);
  }

  return json({
    ok: true,
    id,
    created_at: now,
    expires_at: expiresAt
  }, 201, headers);
}

function changesOf(result) {
  const meta = result && result.meta;
  const changes = meta && meta.changes;
  return changes == null ? 0 : Number(changes);
}

function parseLimit(raw) {
  if (raw === null || raw === '') return DEFAULT_PAGE;
  if (!/^\d+$/.test(raw)) return null;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(n, MAX_PAGE);
}

function parseCursor(raw) {
  if (raw === null || raw === '') return null;
  if (!/^\d+$/.test(raw)) return undefined;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

async function listLetters(url, env, cors) {
  const headers = Object.assign({ 'Cache-Control': 'no-store' }, cors.headers);
  if (!env || !env.DB) return json({ ok: false, error: 'unavailable' }, 503, headers);

  const limit = parseLimit(url.searchParams.get('limit'));
  const before = parseCursor(url.searchParams.get('before'));
  if (limit === null || before === undefined) {
    return json({ ok: false, error: 'invalid_query' }, 400, headers);
  }

  const now = Math.floor(Date.now() / 1000);
  const result = before === null
    ? await env.DB.prepare(
        'SELECT seq, id, body, lang, created_at, expires_at FROM letters ' +
        'WHERE expires_at > ? ORDER BY seq DESC LIMIT ?'
      ).bind(now, limit).all()
    : await env.DB.prepare(
        'SELECT seq, id, body, lang, created_at, expires_at FROM letters ' +
        'WHERE expires_at > ? AND seq < ? ORDER BY seq DESC LIMIT ?'
      ).bind(now, before, limit).all();

  const letters = (result && result.results) || [];
  const nextBefore = letters.length === limit ? Number(letters[letters.length - 1].seq) : null;

  // Strictly read-only: expired rows are filtered above. Pruning happens only
  // in POST /letters.
  return json({ letters, next_before: nextBefore }, 200, headers);
}

// Public single-letter route behind share links (?letter=<id>). Read-only like
// the feed: expired and unknown ids are the same 404, and the id must match our
// 32-hex format so arbitrary strings never reach the database.
async function getLetterById(rawId, env, cors) {
  const headers = Object.assign({ 'Cache-Control': 'public, max-age=30' }, cors.headers);
  if (!env || !env.DB) return json({ ok: false, error: 'unavailable' }, 503, headers);
  if (!LETTER_ID_REGEX.test(rawId)) return json({ ok: false, error: 'not_found' }, 404, headers);

  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB
    .prepare('SELECT id, body AS text, lang, created_at, expires_at FROM letters WHERE id = ? AND expires_at > ?')
    .bind(rawId, now)
    .first();
  if (!row) return json({ ok: false, error: 'not_found' }, 404, headers);
  return json({
    id: row.id,
    text: row.text,
    created_at: Number(row.created_at),
    expires_at: Number(row.expires_at),
    lang: row.lang || null
  }, 200, headers);
}

async function countLetters(env, cors) {
  if (!env || !env.DB) return json({ ok: false, error: 'unavailable' }, 503, cors.headers);
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB
    .prepare('SELECT COUNT(*) AS active FROM letters WHERE expires_at > ?')
    .bind(now)
    .first();
  return json(
    { active: Number(row && row.active) || 0 },
    200,
    Object.assign({ 'Cache-Control': 'public, max-age=60' }, cors.headers)
  );
}

function adminQueryError(headers) {
  return json({ ok: false, error: 'invalid_query' }, 400, headers);
}

// Admin listing keeps the original `before` seq cursor (used by the existing
// contract) and adds page-based mode whenever a sort column is requested.
// Filters and totals are identical in both modes; nothing is ever pruned here.
async function adminListLetters(url, env, cors) {
  const headers = adminHeaders(cors);
  if (!env || !env.DB) return json({ ok: false, error: 'unavailable' }, 503, headers);

  const rawLimit = url.searchParams.get('limit');
  let limit = DEFAULT_PAGE;
  if (rawLimit !== null && rawLimit !== '') {
    if (!/^\d+$/.test(rawLimit)) return adminQueryError(headers);
    const n = parseInt(rawLimit, 10);
    if (!Number.isFinite(n) || n < 1) return adminQueryError(headers);
    limit = Math.min(n, MAX_ADMIN_PAGE);
  }

  const rawPage = url.searchParams.get('page');
  let page = 0;
  if (rawPage !== null && rawPage !== '') {
    if (!/^\d+$/.test(rawPage)) return adminQueryError(headers);
    page = parseInt(rawPage, 10);
    if (!Number.isFinite(page) || page > 100000) return adminQueryError(headers);
  }

  const before = parseCursor(url.searchParams.get('before'));
  if (before === undefined) return adminQueryError(headers);

  const rawSort = url.searchParams.get('sort');
  const sortColumn = rawSort ? LETTER_SORTS[rawSort] : null;
  if (rawSort && !sortColumn) return adminQueryError(headers);
  const rawOrder = url.searchParams.get('order');
  if (rawOrder && rawOrder !== 'asc' && rawOrder !== 'desc') return adminQueryError(headers);
  const order = rawOrder === 'asc' ? 'ASC' : 'DESC';

  const q = (url.searchParams.get('q') || '').trim();
  if (q.length > 120 || CONTROL_OR_BIDI_REGEX.test(q)) return adminQueryError(headers);

  const lang = (url.searchParams.get('lang') || '').trim().toLowerCase();
  if (lang && !/^[a-z]{2,3}(-[a-z0-9]{2,4})?$/.test(lang)) return adminQueryError(headers);

  const status = url.searchParams.get('status');
  if (status && status !== 'all' && status !== 'active' && status !== 'expired') {
    return adminQueryError(headers);
  }

  const now = Math.floor(Date.now() / 1000);
  const where = [];
  const args = [];
  if (q) {
    if (LETTER_ID_REGEX.test(q)) {
      where.push('id = ?');
      args.push(q);
    } else {
      where.push("body LIKE ? ESCAPE '\\'");
      args.push('%' + q.replace(/[\\%_]/g, '\\$&') + '%');
    }
  }
  if (lang) { where.push('lang = ?'); args.push(lang); }
  if (status === 'active') { where.push('expires_at > ?'); args.push(now); }
  else if (status === 'expired') { where.push('expires_at <= ?'); args.push(now); }
  const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';

  const totalRow = await env.DB.prepare('SELECT COUNT(*) AS total FROM letters' + whereSql)
    .bind(...args).first();
  const total = Number(totalRow && totalRow.total) || 0;

  const columns = 'SELECT seq, id, body, lang, created_at, expires_at FROM letters';
  let rows = [];
  let offset = 0;
  let nextBefore = null;

  if (sortColumn) {
    const maxPage = total > 0 ? Math.floor((total - 1) / limit) : 0;
    page = Math.min(page, maxPage);
    offset = page * limit;
    const result = await env.DB.prepare(
      columns + whereSql + ' ORDER BY ' + sortColumn + ' ' + order + ', seq ' + order + ' LIMIT ? OFFSET ?'
    ).bind(...args, limit, offset).all();
    rows = (result && result.results) || [];
  } else if (before === null) {
    const result = await env.DB.prepare(columns + whereSql + ' ORDER BY seq DESC LIMIT ?')
      .bind(...args, limit).all();
    rows = (result && result.results) || [];
  } else {
    const seqWhere = where.length ? whereSql + ' AND seq < ?' : ' WHERE seq < ?';
    const result = await env.DB.prepare(columns + seqWhere + ' ORDER BY seq DESC LIMIT ?')
      .bind(...args, before, limit).all();
    rows = (result && result.results) || [];
  }

  if (!sortColumn && rows.length === limit) nextBefore = Number(rows[rows.length - 1].seq);

  const letters = rows.map(row => Object.assign({}, row, {
    status: Number(row.expires_at) > now ? 'active' : 'expired'
  }));

  return json({
    ok: true,
    letters,
    next_before: nextBefore,
    total,
    page: sortColumn ? page : null,
    limit,
    has_more: sortColumn ? offset + letters.length < total : nextBefore !== null
  }, 200, headers);
}

async function adminDeleteLetter(rawId, env, cors) {
  const headers = adminHeaders(cors);
  if (!env || !env.DB) return json({ ok: false, error: 'unavailable' }, 503, headers);
  if (!LETTER_ID_REGEX.test(rawId)) return json({ ok: false, error: 'not_found' }, 404, headers);

  const results = await env.DB.batch([
    env.DB.prepare('DELETE FROM letters WHERE id = ?').bind(rawId),
    env.DB.prepare('DELETE FROM letter_submissions WHERE letter_id = ?').bind(rawId),
    env.DB.prepare('DELETE FROM letter_senders WHERE letter_id = ?').bind(rawId)
  ]);

  return json({
    ok: true,
    id: rawId,
    deleted: changesOf(results[0]),
    submissions_cleared: changesOf(results[1]),
    legacy_claims_cleared: changesOf(results[2])
  }, 200, headers);
}

async function adminClearLetters(request, env, cors) {
  const headers = adminHeaders(cors);
  if (!env || !env.DB) return json({ ok: false, error: 'unavailable' }, 503, headers);

  const salt = resolveSalt(env);
  if (!salt) return json({ ok: false, error: 'unavailable' }, 503, headers);

  const body = await readJsonBody(request);
  if (!body.ok) return json({ ok: false, error: body.error }, body.status, headers);
  const payload = body.value;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return json({ ok: false, error: 'invalid_body' }, 400, headers);
  }

  // Nuclear reset: every letter-side row goes. Global hourly buckets stay, so
  // clearing the galaxy does not also remove the service-wide abuse ceiling.
  if (payload.all === true) {
    if (payload.confirm !== RESET_CONFIRMATION) {
      return json({ ok: false, error: 'confirmation_required' }, 400, headers);
    }
    const results = await env.DB.batch([
      env.DB.prepare('DELETE FROM letters'),
      env.DB.prepare('DELETE FROM letter_submissions'),
      env.DB.prepare('DELETE FROM letter_senders'),
      env.DB.prepare("DELETE FROM letter_limits WHERE scope <> 'global'")
    ]);
    return json({
      ok: true,
      mode: 'all',
      letters_deleted: changesOf(results[0]),
      submissions_cleared: changesOf(results[1]),
      legacy_claims_cleared: changesOf(results[2]),
      sender_limits_cleared: changesOf(results[3])
    }, 200, headers);
  }

  const ip = typeof payload.ip === 'string' ? payload.ip.trim() : '';
  if (!/^[0-9A-Fa-f:.]{2,64}$/.test(ip)) {
    return json({ ok: false, error: 'invalid_ip' }, 400, headers);
  }

  const includeLetters = payload.letters === true;
  const senderHash = await hashIp(ip, salt);
  const statements = [];

  if (includeLetters) {
    statements.push(env.DB.prepare(
      'DELETE FROM letters WHERE id IN (SELECT letter_id FROM letter_submissions WHERE sender_hash = ?)'
    ).bind(senderHash));
    statements.push(env.DB.prepare(
      'DELETE FROM letters WHERE id IN (SELECT letter_id FROM letter_senders WHERE sender_hash = ?)'
    ).bind(senderHash));
  }
  statements.push(env.DB.prepare('DELETE FROM letter_submissions WHERE sender_hash = ?').bind(senderHash));
  statements.push(env.DB.prepare('DELETE FROM letter_senders WHERE sender_hash = ?').bind(senderHash));
  statements.push(env.DB.prepare('DELETE FROM letter_limits WHERE scope = ?').bind('sender:' + senderHash));

  const results = await env.DB.batch(statements);
  const offset = includeLetters ? 2 : 0;
  const lettersDeleted = includeLetters
    ? changesOf(results[0]) + changesOf(results[1])
    : 0;

  return json({
    ok: true,
    letters_included: includeLetters,
    letters_deleted: lettersDeleted,
    submissions_cleared: changesOf(results[offset]),
    legacy_claims_cleared: changesOf(results[offset + 1]),
    limits_cleared: changesOf(results[offset + 2])
  }, 200, headers);
}

/* ------------------------------------------------------------------ */
/* Playlist tracks                                                      */
/* ------------------------------------------------------------------ */

function isMissingTracksTable(error) {
  return /no such table:\s*tracks\b/i.test(String((error && error.message) || error || ''));
}

function parseTrackTags(raw) {
  try {
    const value = JSON.parse(raw || '[]');
    return Array.isArray(value) ? value.filter(tag => typeof tag === 'string') : [];
  } catch (e) {
    return [];
  }
}

function trackFromRow(row, includeMeta) {
  const track = {
    id: row.id,
    title: row.title,
    artist: row.artist || '',
    audio_url: row.audio_url,
    artwork_url: row.artwork_url || null,
    duration: row.duration === null || row.duration === undefined ? null : Number(row.duration),
    tags: parseTrackTags(row.tags),
    position: Number(row.position)
  };
  if (includeMeta) {
    track.created_at = Number(row.created_at);
    track.updated_at = Number(row.updated_at);
  }
  return track;
}

function trackRows(result) {
  return ((result && result.results) || []).map(row => trackFromRow(row, true));
}

async function listTracks(env, cors, admin) {
  const headers = admin
    ? adminHeaders(cors)
    : Object.assign({ 'Cache-Control': 'public, max-age=60' }, cors.headers);
  if (!env || !env.DB) return json({ ok: false, error: 'unavailable' }, 503, headers);

  try {
    const result = await env.DB.prepare(
      'SELECT id, title, artist, audio_url, artwork_url, duration, tags, position, created_at, updated_at ' +
      'FROM tracks ORDER BY position ASC, id ASC'
    ).all();
    const tracks = trackRows(result).map(track => admin ? track : {
      id: track.id,
      title: track.title,
      artist: track.artist,
      audio_url: track.audio_url,
      artwork_url: track.artwork_url,
      duration: track.duration,
      tags: track.tags,
      position: track.position
    });
    return json({ ok: true, tracks }, 200, headers);
  } catch (e) {
    if (isMissingTracksTable(e)) {
      return json({ ok: false, error: 'tracks_unavailable' }, 503, headers);
    }
    throw e;
  }
}

function validText(value, field, max) {
  if (typeof value !== 'string') return { ok: false, error: field + '_invalid' };
  const clean = value.normalize('NFC').trim();
  if (!clean) return { ok: false, error: field + '_required' };
  if (clean.length > max) return { ok: false, error: field + '_too_long' };
  if (CONTROL_OR_BIDI_REGEX.test(clean)) return { ok: false, error: field + '_invalid' };
  return { ok: true, value: clean };
}

function optionalText(value, field, max) {
  if (value === undefined || value === null || value === '') return { ok: true, value: '' };
  if (typeof value !== 'string') return { ok: false, error: field + '_invalid' };
  const clean = value.normalize('NFC').trim();
  if (!clean) return { ok: true, value: '' };
  if (clean.length > max) return { ok: false, error: field + '_too_long' };
  if (CONTROL_OR_BIDI_REGEX.test(clean)) return { ok: false, error: field + '_invalid' };
  return { ok: true, value: clean };
}

// Absolute http(s) URLs or same-origin relative paths. The Worker never calls
// these URLs; the browser does, so schemes that execute code are refused.
function validMediaUrl(value, field, required) {
  if (value === undefined || value === null || value === '') {
    return required ? { ok: false, error: field + '_required' } : { ok: true, value: null };
  }
  if (typeof value !== 'string') return { ok: false, error: field + '_invalid' };
  const clean = value.trim();
  if (!clean || clean.length > 2048) return { ok: false, error: field + '_invalid' };
  if (/[\u0000-\u001F\u007F]/.test(clean)) return { ok: false, error: field + '_invalid' };

  if (/^[a-z][a-z0-9+.-]*:/i.test(clean)) {
    let parsed;
    try { parsed = new URL(clean); } catch (e) { return { ok: false, error: field + '_invalid' }; }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { ok: false, error: field + '_invalid' };
    }
    if (parsed.username || parsed.password) return { ok: false, error: field + '_invalid' };
    return { ok: true, value: clean };
  }
  if (clean.startsWith('//')) return { ok: false, error: field + '_invalid' };
  if (!/^[A-Za-z0-9._~!$&'()*+,;=:@%\/?#-]+$/.test(clean)) {
    return { ok: false, error: field + '_invalid' };
  }
  return { ok: true, value: clean };
}

function validDuration(value) {
  if (value === undefined || value === null || value === '') return { ok: true, value: null };
  let total = null;
  if (typeof value === 'number') {
    total = value;
  } else if (typeof value === 'string') {
    const raw = value.trim();
    if (/^\d+$/.test(raw)) total = Number(raw);
    else {
      const parts = /^(\d{1,3}):([0-5]\d)$/.exec(raw);
      if (!parts) return { ok: false, error: 'duration_invalid' };
      total = Number(parts[1]) * 60 + Number(parts[2]);
    }
  }
  if (!Number.isInteger(total) || total < 0 || total > 359999) {
    return { ok: false, error: 'duration_invalid' };
  }
  return { ok: true, value: total };
}

function validTags(value) {
  if (value === undefined || value === null || value === '') return { ok: true, value: [] };
  let list;
  if (Array.isArray(value)) list = value;
  else if (typeof value === 'string') list = value.split(',');
  else return { ok: false, error: 'tags_invalid' };

  const tags = [];
  for (const item of list) {
    if (typeof item !== 'string') return { ok: false, error: 'tags_invalid' };
    const tag = item.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
    if (!tag) continue;
    if (tag.length > 24 || CONTROL_OR_BIDI_REGEX.test(tag)) {
      return { ok: false, error: 'tags_invalid' };
    }
    if (tags.indexOf(tag) < 0) tags.push(tag);
    if (tags.length > 12) return { ok: false, error: 'tags_invalid' };
  }
  return { ok: true, value: tags };
}

function buildTrackPayload(raw, existing) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'invalid_body' };
  }
  const base = existing ? trackFromRow(existing, false) : {};
  const pick = key => Object.prototype.hasOwnProperty.call(raw, key) ? raw[key] : base[key];

  const title = validText(pick('title'), 'title', 160);
  if (!title.ok) return title;
  const artist = optionalText(pick('artist'), 'artist', 160);
  if (!artist.ok) return artist;
  const audio = validMediaUrl(pick('audio_url'), 'audio_url', true);
  if (!audio.ok) return audio;
  const artwork = validMediaUrl(pick('artwork_url'), 'artwork_url', false);
  if (!artwork.ok) return artwork;
  const duration = validDuration(pick('duration'));
  if (!duration.ok) return duration;
  const tags = validTags(pick('tags'));
  if (!tags.ok) return tags;

  return {
    ok: true,
    data: {
      title: title.value,
      artist: artist.value,
      audio_url: audio.value,
      artwork_url: artwork.value,
      duration: duration.value,
      tags: tags.value
    }
  };
}

async function readTrackBody(request) {
  const body = await readJsonBody(request, MAX_TRACK_BODY_BYTES);
  if (!body.ok) return body;
  if (!body.value || typeof body.value !== 'object' || Array.isArray(body.value)) {
    return { ok: false, status: 400, error: 'invalid_body' };
  }
  return body;
}

async function createTrack(request, env, cors) {
  const headers = adminHeaders(cors);
  if (!env || !env.DB) return json({ ok: false, error: 'unavailable' }, 503, headers);

  const body = await readTrackBody(request);
  if (!body.ok) return json({ ok: false, error: body.error }, body.status, headers);

  const validated = buildTrackPayload(body.value, null);
  if (!validated.ok) return json({ ok: false, error: validated.error }, 400, headers);

  try {
    const countRow = await env.DB.prepare('SELECT COUNT(*) AS total FROM tracks').first();
    if (Number(countRow && countRow.total) >= MAX_TRACKS) {
      return json({ ok: false, error: 'track_limit' }, 409, headers);
    }
    const maxRow = await env.DB.prepare('SELECT COALESCE(MAX(position), -1) AS max FROM tracks').first();
    const position = Number(maxRow && maxRow.max) + 1;
    const now = Math.floor(Date.now() / 1000);
    const id = randomId();
    const data = validated.data;

    await env.DB.prepare(
      'INSERT INTO tracks (id, title, artist, audio_url, artwork_url, duration, tags, position, created_at, updated_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      id, data.title, data.artist, data.audio_url, data.artwork_url,
      data.duration, JSON.stringify(data.tags), position, now, now
    ).run();

    const row = await env.DB.prepare('SELECT * FROM tracks WHERE id = ?').bind(id).first();
    return json({ ok: true, track: trackFromRow(row, true) }, 201, headers);
  } catch (e) {
    if (isMissingTracksTable(e)) {
      return json({ ok: false, error: 'tracks_unavailable' }, 503, headers);
    }
    throw e;
  }
}

async function mutateTrack(rawId, request, env, cors) {
  const headers = adminHeaders(cors);
  if (!env || !env.DB) return json({ ok: false, error: 'unavailable' }, 503, headers);
  if (!TRACK_ID_REGEX.test(rawId)) return json({ ok: false, error: 'not_found' }, 404, headers);

  try {
    const existing = await env.DB.prepare('SELECT * FROM tracks WHERE id = ?').bind(rawId).first();

    if (request.method === 'DELETE') {
      const result = await env.DB.prepare('DELETE FROM tracks WHERE id = ?').bind(rawId).run();
      return json({ ok: true, id: rawId, deleted: changesOf(result) }, 200, headers);
    }

    if (!existing) return json({ ok: false, error: 'not_found' }, 404, headers);
    const body = await readTrackBody(request);
    if (!body.ok) return json({ ok: false, error: body.error }, body.status, headers);

    const validated = buildTrackPayload(body.value, existing);
    if (!validated.ok) return json({ ok: false, error: validated.error }, 400, headers);

    const data = validated.data;
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      'UPDATE tracks SET title = ?, artist = ?, audio_url = ?, artwork_url = ?, duration = ?, tags = ?, updated_at = ? ' +
      'WHERE id = ?'
    ).bind(
      data.title, data.artist, data.audio_url, data.artwork_url,
      data.duration, JSON.stringify(data.tags), now, rawId
    ).run();

    const row = await env.DB.prepare('SELECT * FROM tracks WHERE id = ?').bind(rawId).first();
    return json({ ok: true, track: trackFromRow(row, true) }, 200, headers);
  } catch (e) {
    if (isMissingTracksTable(e)) {
      return json({ ok: false, error: 'tracks_unavailable' }, 503, headers);
    }
    throw e;
  }
}

async function reorderTracks(request, env, cors) {
  const headers = adminHeaders(cors);
  if (!env || !env.DB) return json({ ok: false, error: 'unavailable' }, 503, headers);

  const body = await readTrackBody(request);
  if (!body.ok) return json({ ok: false, error: body.error }, body.status, headers);
  const ids = body.value.ids;
  if (!Array.isArray(ids) || ids.length > MAX_TRACKS) {
    return json({ ok: false, error: 'invalid_order' }, 400, headers);
  }
  const seen = new Set();
  for (const id of ids) {
    if (typeof id !== 'string' || !TRACK_ID_REGEX.test(id) || seen.has(id)) {
      return json({ ok: false, error: 'invalid_order' }, 400, headers);
    }
    seen.add(id);
  }

  try {
    const result = await env.DB.prepare('SELECT id FROM tracks').all();
    const stored = (result && result.results) || [];
    if (stored.length !== ids.length || stored.some(row => !seen.has(row.id))) {
      // Reordering a stale list would create duplicate positions; make the
      // client reload instead of silently accepting a partial order.
      return json({ ok: false, error: 'incomplete_order' }, 409, headers);
    }

    const now = Math.floor(Date.now() / 1000);
    const statements = ids.map((id, index) => env.DB.prepare(
      'UPDATE tracks SET position = ?, updated_at = ? WHERE id = ?'
    ).bind(index, now, id));
    await env.DB.batch(statements);
    return json({ ok: true, updated: ids.length }, 200, headers);
  } catch (e) {
    if (isMissingTracksTable(e)) {
      return json({ ok: false, error: 'tracks_unavailable' }, 503, headers);
    }
    throw e;
  }
}
