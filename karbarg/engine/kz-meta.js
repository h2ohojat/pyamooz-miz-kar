/* ============================================================
   شناسنامهٔ ایستای درس (kz-meta) — موتور ۱٫۲
   build این را صدا می‌زند تا <script type="application/json" id="kz-meta"> را بدون اجرای
   JavaScript در مرورگر بسازد؛ میزبان (پای‌آموز) آن را پیش از اجرای درس می‌خواند.
   قواعد gated/scored/tags/stage باید با catalog() در engine.js یکی بمانند؛
   _src/kz-meta.test.js این دو را روی خروجی واقعی مقایسه می‌کند.
   ============================================================ */
'use strict';
const vm = require('vm');

const GATED = { mcq: 1, input: 1, sort: 1, order: 1, poll: 1, steps: 1, custom: 1 };
const SCORED = { mcq: 1, input: 1, sort: 1, order: 1, custom: 1 };
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', zwnj: '‌', zwj: '‍', rlm: '‏', lrm: '‎', times: '×', divide: '÷', minus: '−' };
/* متن ساده؛ هر برچسب HTML یک فاصله می‌شود، همان قالبی که درس‌های ۱٫۲ منتشرشده در پای‌آموز دارند
   (تغییر آن، q همهٔ اسلایدهای دارای برچسب را در مقایسهٔ نسخه‌های میزبان «تغییرکرده» نشان می‌دهد) */
function plain(html) {
  return String(html == null ? '' : html)
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1));
      return ENTITIES[e.toLowerCase()] != null ? ENTITIES[e.toLowerCase()] : m;
    })
    .replace(/\s+/g, ' ').trim();
}
function tagsOf(t) { return t ? (Array.isArray(t) ? t : [t]) : []; }
function itemTags(s) {
  const t = [];
  (s.options || []).forEach((o) => tagsOf(o.tag).forEach((x) => t.push(x)));
  (s.items || []).forEach((o) => { if (o && typeof o === 'object') tagsOf(o.tag).forEach((x) => t.push(x)); });
  (s.wrong || []).forEach((o) => tagsOf(o.tag).forEach((x) => t.push(x)));
  return t.filter((x, k) => t.indexOf(x) === k);
}

/* محیط ساختگی برای اجرای فایل‌های محتوا: هر دسترسی ناشناخته به DOM بی‌اثر است */
function stub() {
  const fn = function () { return p; };
  const p = new Proxy(fn, {
    get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : p),
    apply: () => p, construct: () => p, set: () => true,
  });
  return p;
}
function loadLesson(scripts) {
  const ctx = { console: { log() {}, warn() {}, error() {}, info() {} }, document: stub(), navigator: stub(), location: stub(),
    localStorage: stub(), sessionStorage: stub(), matchMedia: stub(), setTimeout() {}, clearTimeout() {}, requestAnimationFrame() {},
    addEventListener() {}, removeEventListener() {}, getComputedStyle: stub(), CustomEvent: stub(), HTMLElement: function () {} };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const code of scripts) vm.runInContext(code, ctx, { timeout: 5000 });
  return ctx.LESSON || null;
}

/** شناسنامه را از شیء LESSON می‌سازد؛ هویت و ساختار نامعتبر، ساخت را متوقف می‌کند. */
function metaFor(L, engine) {
  if (!L || !Array.isArray(L.slides) || !ID_RE.test(String(L.id || ''))) throw Error('LESSON.id must be a short English id; LESSON.slides is required');
  if (L.version !== undefined && (!Number.isInteger(L.version) || L.version < 1 || L.version > 2147483647)) throw Error('version must be a positive JSON integer');
  if (L.contentMode !== undefined && !['syllabus', 'textbook-licensed'].includes(L.contentMode)) throw Error('contentMode must be syllabus or textbook-licensed');
  if (L.contentMode === 'textbook-licensed' && (typeof L.licenseNumber !== 'string' || !L.licenseNumber.trim())) throw Error('textbook-licensed needs licenseNumber');
  if (L.layout !== undefined && !['slides', 'worksheet'].includes(L.layout)) throw Error('layout must be slides or worksheet');
  const academic = L.profile === 'academic';
  const STG = L.stages || [];
  let last = STG[0] && STG[0].id;
  const items = L.slides.map((s, i) => {
    if (!s || !['content', 'steps', 'mcq', 'input', 'sort', 'order', 'poll', 'custom', 'end'].includes(s.type)) throw Error('slide ' + i + ': unknown type');
    const stage = s.stage || last; last = stage;
    if (s.id !== undefined && (typeof s.id !== 'string' || !ID_RE.test(s.id) || /^s[0-9]+$/.test(s.id))) throw Error('slide ' + i + ': id must be a short English id, not a positional id');
    if (GATED[s.type] && !s.id) throw Error('slide ' + i + ' (' + s.type + '): an interactive slide needs a stable id');
    const gated = !!GATED[s.type] && s.gate !== false;
    return { id: s.id || ('s' + i), idx: i, type: s.type, stage: stage == null ? null : stage, gated,
      scored: !academic && !!SCORED[s.type] && s.stars !== false && s.gate !== false,
      q: plain(s.q || s.title || '').slice(0, 160), tags: itemTags(s) };
  });
  const seen = Object.create(null);
  items.forEach((it) => { if (seen[it.id]) throw new Error('kz-meta: duplicate id / duplicate slide id "' + it.id + '" in ' + L.id); seen[it.id] = 1; });
  const maxStars = academic ? 0 : L.slides.reduce((t, s) => t + (SCORED[s.type] && s.stars !== false && s.gate !== false ? 3 : 0), 0);
  const mode = L.contentMode === 'textbook-licensed' ? 'textbook-licensed' : 'syllabus';
  const tags = L.tags || {};
  return {
    kz: 1, engine, id: L.id, version: Number.isInteger(L.version) && L.version > 0 ? L.version : 1,
    title: plain(L.title), subtitle: plain(L.subtitle), grade: plain(L.grade), subject: plain(L.subject), duration: plain(L.duration),
    durationMinutes: Number.isFinite(L.durationMinutes) ? L.durationMinutes : null,
    contentMode: mode, licenseNumber: mode === 'textbook-licensed' && L.licenseNumber ? String(L.licenseNumber) : null,
    objectives: (L.objectives || []).map(plain), concepts: (L.concepts || []).map(plain), prerequisites: (L.prerequisites || []).map(plain),
    stages: STG.map((s) => ({ id: s.id, title: plain(s.title) })), maxStars,
    misconceptions: Object.keys(tags).map((k) => ({ tag: k, title: plain(tags[k] && tags[k].t), review: plain(tags[k] && tags[k].review) })),
    items,
  };
}

/** بلوک HTML آماده؛ «<» فرار داده می‌شود تا متن درس نتواند تگ script را ببندد. */
function block(meta) {
  return '<script type="application/json" id="kz-meta">' + JSON.stringify(meta).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029') + '</script>';
}

module.exports = { metaFor, loadLesson, block, plain, ID_RE };
