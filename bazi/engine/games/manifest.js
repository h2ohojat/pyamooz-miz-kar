'use strict';
// Shape/bounds mirror GameManifest.php. The real host validator is still the acceptance reference.
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const TOKEN = /^[a-zA-Z0-9_-]{1,40}$/;
const safe = (id) => TOKEN.test(id) && !['__proto__', 'constructor', 'prototype'].includes(id);
const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const text = (s, max) => typeof s === 'string' && s.trim().length > 0 && [...s].length <= max;
function validateManifest(m) {
  const errors = [], check = (valid, field) => { if (!valid) errors.push(field); };
  check(m && typeof m === 'object' && !Array.isArray(m), 'manifest');
  if (errors.length) throw Error('شناسنامه باید یک شیء باشد.');
  check(m.schemaVersion === 1 && m.kind === 'game', 'schemaVersion/kind');
  check(ID.test(m.id) && text(m.id, 64), 'id');
  check(text(m.title, 160), 'title');
  check(integer(m.version, 1, 2147483647), 'version');
  check(m.bridge?.ns === 'pyamooz-game' && m.bridge.v === 1 && Object.keys(m.bridge).every((k) => ['ns', 'v'].includes(k)), 'bridge');
  check(integer(m.stateSchemaVersion, 1, 65535), 'stateSchemaVersion');
  check(['levels', 'puzzle', 'endless'].includes(m.mode), 'mode');
  if (m.ruleset !== undefined) check(text(m.ruleset, 64) && /^[a-zA-Z0-9._-]+$/.test(m.ruleset), 'ruleset');
  check(Array.isArray(m.capabilities) && m.capabilities.length === 4 && new Set(m.capabilities).size === 4 && m.capabilities.every((c) => ['state', 'resume', 'result', 'pause'].includes(c)), 'capabilities');
  check(Array.isArray(m.metrics) && m.metrics.length >= 1 && m.metrics.length <= 16, 'metrics');
  const unique = (items, name) => check(new Set(items.map((s) => s && s.id)).size === items.length, name + '.id');
  const keys = (object, permitted, field) => check(object && typeof object === 'object' && !Array.isArray(object) && Object.keys(object).every((k) => permitted.includes(k)), field);
  if (Array.isArray(m.metrics)) {
    unique(m.metrics, 'metrics');
    m.metrics.forEach((s, i) => {
      const at = 'metrics.' + i;
      keys(s, ['id', 'label', 'type', 'min', 'max', 'best', 'unit', 'recordOn'], at);
      if (!s || typeof s !== 'object' || Array.isArray(s)) return;
      check(safe(s.id) && text(s.label, 80), at + '.id/label');
      check(['integer', 'number'].includes(s.type) && ['min', 'max', 'none'].includes(s.best), at + '.type/best');
      check(typeof s.min === 'number' && Number.isFinite(s.min) && s.min >= 0 && s.min <= 1e12, at + '.min');
      if (s.max !== undefined) check(typeof s.max === 'number' && Number.isFinite(s.max) && s.max >= s.min && s.max <= 1e12, at + '.max');
      if (s.unit !== undefined) check(text(s.unit, 24), at + '.unit');
      if (s.recordOn !== undefined) check(Array.isArray(s.recordOn) && s.recordOn.length >= 1 && s.recordOn.length <= 3 && s.recordOn.every((v) => ['won', 'lost', 'completed'].includes(v)), at + '.recordOn');
    });
  }
  check(m.mode !== 'levels' || Array.isArray(m.levels), 'levels');
  if (m.levels !== undefined) {
    check(Array.isArray(m.levels) && m.levels.length <= 500, 'levels');
    if (Array.isArray(m.levels)) { unique(m.levels, 'levels'); m.levels.forEach((s) => { keys(s, ['id', 'title'], 'levels'); if (!s || typeof s !== 'object' || Array.isArray(s)) return; check(TOKEN.test(s.id) && text(s.title, 160), 'levels.id/title'); }); }
  }
  if (m.settings !== undefined) {
    check(Array.isArray(m.settings) && m.settings.length <= 8, 'settings');
    if (Array.isArray(m.settings)) {
      unique(m.settings, 'settings');
      m.settings.forEach((s) => {
        keys(s, ['id', 'label', 'options', 'default'], 'settings');
        if (!s || typeof s !== 'object' || Array.isArray(s)) return;
        check(safe(s.id) && text(s.label, 80), 'settings.id/label');
        check(Array.isArray(s.options) && s.options.length >= 1 && s.options.length <= 20 && s.options.every((v) => text(v, 40)) && s.options.includes(s.default), 'settings.options/default');
      });
    }
  }
  check(Buffer.byteLength(JSON.stringify(m)) <= 32768, 'manifest.size');
  if (errors.length) throw Error('فیلدهای شناسنامهٔ بازی نیاز به اصلاح دارند: ' + errors.join('، '));
  return m;
}
module.exports = {validateManifest};
