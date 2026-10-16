const F = FractionBridge;
const manifest = JSON.parse(document.querySelector('#pyamooz-game-meta').textContent);
const $ = id => document.getElementById(id);
const fa = n => Number(n).toLocaleString('fa-IR');
const canvas = $('scene'), ctx = canvas.getContext('2d'), overlay = $('overlay');
const THEMES = {
  meadow: {sky: ['#6fc3ee', '#dff4f6'], deep: ['#2f5a3a', '#1c3424'], water: ['#62c0ec', '#1f6fa8'], sun: '#fff6c2', clouds: 1},
  forest: {sky: ['#8fd0c0', '#f0f6dc'], deep: ['#274a33', '#15281c'], water: ['#4fb0ae', '#1b5a6a'], sun: '#fff3c4', clouds: 1},
  canyon: {sky: ['#ffbe7d', '#fff1d8'], deep: ['#7a4126', '#4a2416'], water: ['#56c1c9', '#1d6d84'], sun: '#fff4c4', clouds: .6},
  cave: {sky: ['#141d2c', '#2c3c56'], deep: ['#1a2333', '#0c1220'], water: ['#3f8ce0', '#122b5a'], clouds: 0},
  castle: {sky: ['#6d5fb2', '#f7b9a0'], deep: ['#3a2f5c', '#211a38'], water: ['#5b7fd8', '#24306e'], sun: '#fff0d6', moon: true, clouds: .5}
};
let state = null, bridge = null, paused = true, initialized = false, blocked = false, modal = null, returnFocus = null;
let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, sound = false, audio = null, storageMessage = '', recoveryNotice = '';
let lastTime = null, saveTimer = 0, clock = 0, lastPaint = 0, cam = 0, camLevel = -1, trayKey = '', hudKey = '', toastTimer = null;
let compact = false, rotated = false, orientationOwned = false, orientationAttempted = false;
const keys = new Set(), pad = {fwd: false, back: false, jump: false};
let jumpQueued = false;
const view = {w: 960, h: 540, scale: 1, dpr: 1, k: 1, offY: 0, cssW: 960, cssH: 540};
const fx = {bumps: {}, pops: [], parts: [], texts: [], squash: [], shake: 0, lock: null, reject: null, fade: 0};
const art = {}, cache = new Map();
let groundCache = null;

// ---------- Art: SVG sprites are rasterised once per device scale ----------
async function loadArt() {
  const list = [...$('art').content.querySelectorAll('svg[data-sprite]')];
  await Promise.all(list.map(el => new Promise(done => {
    const image = new Image(), name = el.dataset.sprite;
    art[name] = {img: image, w: +el.getAttribute('width'), h: +el.getAttribute('height'), ok: false};
    image.onload = () => { art[name].ok = true; done(); }; image.onerror = () => done();
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(el.outerHTML);
  })));
  try { await document.fonts.load('800 20px Vazirmatn'); } catch { /* The system font is an acceptable fallback. */ }
}
function sprite(name, w, h) {
  const a = art[name]; if (!a?.ok) return null;
  const k = Math.min(name.startsWith('far') || name.startsWith('near') ? 2.5 : 4, Math.round(view.k * 4) / 4 || 1), key = name + '@' + k + '@' + w + 'x' + h;
  let c = cache.get(key);
  if (!c) {
    c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w * k)); c.height = Math.max(1, Math.ceil(h * k));
    try { c.getContext('2d').drawImage(a.img, 0, 0, c.width, c.height); } catch { /* A failed raster leaves the sprite blank. */ }
    cache.set(key, c);
  }
  return c;
}
function draw(name, x, y, w = art[name]?.w, h = art[name]?.h, flip = false, alpha = 1) {
  const c = sprite(name, w, h); if (!c) return;
  ctx.save(); ctx.globalAlpha *= alpha;
  if (flip) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(c, 0, 0, w, h); } else ctx.drawImage(c, x, y, w, h);
  ctx.restore();
}
function rr(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
const font = (size, weight = 800) => `${weight} ${size}px Vazirmatn, Tahoma, sans-serif`;
function fracParts(v, label) { return label ? (label[1] === 1 ? {whole: label[0], n: 0, d: 1} : {whole: 0, n: label[0], d: label[1]}) : F.parts(v); }
// Stacked fraction; in a right-to-left reading the whole part sits on the right.
function drawFrac(v, x, y, size, color, label = null) {
  const f = fracParts(v, label), small = size * .72;
  ctx.save(); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = font(small); const fw = f.n ? Math.max(ctx.measureText(F.faDigits(f.n)).width, ctx.measureText(F.faDigits(f.d)).width) + 5 : 0;
  ctx.font = font(size); const tw = f.whole ? ctx.measureText(F.faDigits(f.whole)).width : 0, ww = f.whole ? tw + (f.n ? size * .3 : 0) : 0;
  let cursor = x + (fw + ww) / 2;
  if (f.whole) { ctx.fillText(F.faDigits(f.whole), cursor - tw / 2, y + size * .06); cursor -= ww; }
  if (f.n) {
    const cx = cursor - fw / 2; ctx.font = font(small);
    ctx.fillText(F.faDigits(f.n), cx, y - small * .56); ctx.fillText(F.faDigits(f.d), cx, y + small * .66);
    ctx.lineWidth = Math.max(1.4, size * .09); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx - fw / 2 + 1, y + 1); ctx.lineTo(cx + fw / 2 - 1, y + 1); ctx.stroke();
  }
  ctx.restore();
}
function fracHtml(v, label = null) {
  const f = fracParts(v, label);
  return `<span class="frac">${f.whole ? `<span>${F.faDigits(f.whole)}</span>` : ''}${f.n ? `<span class="fr"><i>${F.faDigits(f.n)}</i><i>${F.faDigits(f.d)}</i></span>` : ''}</span>`;
}

// ---------- Layout ----------
function layout() {
  const vw = Math.round(window.visualViewport?.width || innerWidth), vh = Math.round(window.visualViewport?.height || innerHeight);
  const coarse = matchMedia('(pointer:coarse)').matches;
  // Only touch screens turn sideways; a narrow desktop window keeps its normal orientation.
  const touchy = coarse || document.body.classList.contains('touched');
  compact = vw <= 760 || (coarse && Math.min(vw, vh) <= 650); rotated = compact && touchy && vh > vw;
  document.body.classList.toggle('rotated', rotated); document.body.classList.toggle('touch', coarse || document.body.classList.contains('touched'));
  const gw = rotated ? vh : vw, gh = rotated ? vw : vh;
  $('shell').style.setProperty('--game-width', gw + 'px'); $('shell').style.setProperty('--game-height', gh + 'px');
  // A strip under the play area is reserved for the plank tray, so bridges and rulers stay visible above it.
  const reserve = gh < 430 ? 78 : 112, dpr = Math.min(3, window.devicePixelRatio || 1), scale = Math.min((gh - reserve) / 540, gw / 640);
  const before = view.k;
  Object.assign(view, {cssW: gw, cssH: gh, dpr, scale, k: scale * dpr, w: gw / scale, h: gh / scale, offY: (gh - reserve) / scale - 540});
  view.bottom = view.h - view.offY;
  canvas.width = Math.round(gw * dpr); canvas.height = Math.round(gh * dpr);
  if (Math.abs(before - view.k) > .01) cache.clear();
  groundCache = null;
  paint(true);
}
async function enterLandscape() {
  orientationAttempted = true;
  try {
    // The root goes fullscreen: a fullscreen element loses its transform, which would undo the rotated phone layout.
    if (!document.fullscreenElement && document.fullscreenEnabled && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    if (!bridge?.embedded && document.fullscreenElement && typeof screen.orientation?.lock === 'function') { await screen.orientation.lock('landscape'); orientationOwned = true; }
  } catch { /* Fullscreen and orientation are optional browser permissions; the rotated layout still works. */ }
  layout();
}

// ---------- Sound (optional, created only after a user action) ----------
function play(kind) {
  if (!sound || !audio) return;
  const presets = {
    jump: [[330, 660, .12, 'square', .025]], coin: [[988, 988, .07, 'square', .02], [1319, 1319, .16, 'square', .02, .07]],
    block: [[180, 120, .1, 'triangle', .06]], place: [[150, 110, .09, 'triangle', .07], [260, 200, .07, 'triangle', .04, .05]],
    lock: [[523, 523, .1, 'triangle', .05], [659, 659, .1, 'triangle', .05, .09], [784, 784, .1, 'triangle', .05, .18], [1047, 1047, .3, 'triangle', .05, .27]],
    error: [[200, 140, .22, 'sawtooth', .03]], stomp: [[520, 180, .14, 'square', .03]], hurt: [[300, 160, .25, 'sawtooth', .03]],
    fall: [[700, 120, .5, 'triangle', .05]], split: [[900, 700, .05, 'sawtooth', .015], [900, 700, .05, 'sawtooth', .015, .07], [880, 660, .06, 'sawtooth', .015, .14]],
    flag: [[523, 523, .12, 'square', .025], [659, 659, .12, 'square', .025, .12], [784, 784, .12, 'square', .025, .24], [1047, 1047, .45, 'square', .025, .36]]
  }[kind];
  try {
    const now = audio.currentTime;
    for (const [from, to, dur, type, vol, delay = 0] of presets || []) {
      const o = audio.createOscillator(), g = audio.createGain(), t = now + delay;
      o.type = type; o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + dur + .02);
    }
  } catch { /* Sound never blocks the game. */ }
}
function updateSound() { $('sound').setAttribute('aria-pressed', String(sound)); $('sound').setAttribute('aria-label', sound ? 'خاموش کردن صدا' : 'روشن کردن صدا'); }

// ---------- Feedback ----------
function toast(html, tone = '') {
  const el = $('toast'); el.innerHTML = html; el.className = 'toast show ' + tone;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.className = 'toast ' + tone; }, tone === 'good' ? 3200 : 2600);
}
function floatText(text, p, y, color) { fx.texts.push({text, p, y, color, life: 0, max: 1.1}); }
function burst(p, y, colors, n, speed = 160, size = 4) {
  if (reduced) n = Math.min(n, 4);
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = speed * (.4 + Math.random() * .8); fx.parts.push({p, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: 0, max: .5 + Math.random() * .5, color: colors[i % colors.length], size: size * (.6 + Math.random() * .8)}); }
}
function requestSave() { saveTimer = Math.max(saveTimer, 850); }
function handle(events) {
  const pl = state.player;
  for (const e of events) {
    if (e.type === 'jump') { play('jump'); if (!reduced) burst(pl.p, pl.y, ['#ffffffaa'], 4, 60, 3); }
    if (e.type === 'land' && !reduced) burst(pl.p, pl.y, ['#ffffff99', '#e8d5b0aa'], 5, 70, 3);
    if (e.type === 'bump') fx.shake = Math.max(fx.shake, reduced ? 0 : 2);
    if (e.type === 'block') {
      const b = F.worlds[state.level].blocks.find(x => x.id === e.id);
      fx.bumps[e.id] = 0; play('block'); requestSave();
      if (e.give === 'coin') { play('coin'); floatText('+' + fa(F.SCORE.coin), (b.x0 + b.x1) / 2, b.y0 - 20, '#b87010'); fx.pops.push({kind: 'coin', p: (b.x0 + b.x1) / 2, y: b.y0, life: 0}); }
      else { fx.pops.push({kind: 'plank', v: e.give, p: (b.x0 + b.x1) / 2, y: b.y0, life: 0}); toast('تختهٔ ' + fracHtml(e.give) + ' به کیف اضافه شد.'); }
    }
    if (e.type === 'crate') { play('place'); requestSave(); toast('یک تختهٔ ' + fracHtml(e.give) + ' در جعبه بود!'); burst(pl.p, F.GROUND - 20, ['#d9a061', '#f2c27f'], 10, 140); }
    if (e.type === 'coin') { play('coin'); const c = F.worlds[state.level].coins.find(x => x.id === e.id); burst(c.p, c.y, ['#ffd45a', '#fff3b0'], 8, 120, 3); floatText('+' + fa(F.SCORE.coin), c.p, c.y - 14, '#b87010'); }
    if (e.type === 'stomp') { play('stomp'); const sn = state.snails[e.id]; fx.squash.push({p: sn.p, life: 0, flip: sn.dir < 0}); floatText('+' + fa(F.SCORE.stomp), sn.p, F.GROUND - 60, '#1f7a59'); burst(sn.p, F.GROUND - 20, ['#f29a3e', '#b9d86a'], 10); requestSave(); }
    if (e.type === 'hurt') { play('hurt'); fx.shake = reduced ? 0 : 8; floatText('−' + fa(F.SCORE.hurt), pl.p, pl.y - 70, '#c0392b'); toast('آخ! از کنار به حلزون نخور؛ از بالا رویش بپر.', 'bad'); }
    if (e.type === 'fall') { play('fall'); fx.fade = 1; camLevel = -1; floatText('−' + fa(F.SCORE.fall), pl.p, pl.y - 70, '#c0392b'); toast('پل نیمه‌کاره نگهت نمی‌دارد؛ اول آن را <b>دقیقاً</b> کامل کن.', 'bad'); requestSave(); }
    if (e.type === 'flag') { play('flag'); burst(F.worlds[state.level].flag, F.GROUND - 160, ['#ffd45a', '#3fb586', '#f08a3c', '#ffffff'], 40, 260, 5); levelCleared(); }
  }
}

// ---------- Player actions ----------
function usePlank(v) {
  if (!canAct()) return;
  const z = F.zone(state);
  if (!z) { toast(state.inventory.length ? 'کنار <b>پایهٔ پل</b> بایست تا تخته بچینی، یا کنار <b>میز برش</b> تا آن را نصف کنی.' : 'زیر بلوک‌های <b>؟</b> بپر تا تخته پیدا کنی.'); return; }
  if (z.kind === 'split') {
    const r = F.split(state, v);
    if (r.ok) { play('split'); toast('برش خورد: ' + fracHtml(v) + ' = ' + fracHtml(F.SPLIT[v]) + ' + ' + fracHtml(F.SPLIT[v]), 'good'); burst(state.player.p, F.GROUND - 50, ['#f2c27f', '#fff1c2'], 14, 150, 3); requestSave(); }
    else toast(r.message, 'bad');
    renderTray(true); return;
  }
  const g = z.gap, r = F.place(state, v);
  if (r.ok && r.locked) {
    play('lock'); fx.lock = {gap: g.id, t: 0}; requestSave();
    const parts = state.bridges[g.id].map(x => fracHtml(x)).join(' + ');
    toast(`<b>${parts} = ${fracHtml(g.value, g.label)}</b> ✓ پل دقیق ایستاد!` + (r.clean ? ' <small>(+۵۰ بی‌خطا)</small>' : ''), 'good');
    floatText('+' + fa(F.SCORE.bridge + (r.clean ? F.SCORE.clean : 0)), (g.p0 + g.p1) / 2, F.GROUND - 70, '#1f7a59');
    burst((g.p0 + g.p1) / 2, F.GROUND, ['#ffd45a', '#3fb586', '#ffffff', '#f08a3c'], 34, 260, 5);
  } else if (r.ok) {
    play('place'); requestSave(); burst(g.p0 + F.sum(state.bridges[g.id]) * F.PX, F.GROUND + 10, ['#d9a061', '#f2c27f'], 8, 110, 3);
    toast(g.remain ? 'خوب نشست! هنوز ' + fracHtml(r.left) + ' از دره مانده است.' : 'تخته نشست؛ پل هنوز کامل نیست. با چشم بسنج چقدر مانده.');
  } else if (r.code === 'long') {
    play('error'); fx.reject = {gap: g.id, v, t: 0}; fx.shake = reduced ? 0 : 5; requestSave();
    floatText('−' + fa(F.SCORE.error), g.p0 + 40, F.GROUND - 40, '#c0392b');
    toast('تختهٔ ' + fracHtml(v) + ' بلندتر از جای خالی است' + (g.remain ? '؛ فقط ' + fracHtml(r.left) + ' جا مانده.' : '. تختهٔ کوتاه‌تری امتحان کن.'), 'bad');
  } else toast(r.message, 'bad');
  renderTray(true);
}
function takeBack() {
  if (!canAct()) return;
  if (F.takeBack(state)) { play('place'); toast('آخرین تخته به کیف برگشت.'); requestSave(); renderTray(true); }
  else toast(F.zone(state)?.kind === 'build' ? 'هنوز تخته‌ای روی این پل نگذاشته‌ای.' : 'برای پس‌گرفتن، کنار پایهٔ پل بایست.');
}
const canAct = () => state && initialized && !paused && !blocked && !modal && state.phase === 'play';

// ---------- HUD and tray ----------
function groups() { const map = new Map(); for (const v of state.inventory) map.set(v, (map.get(v) || 0) + 1); return [...map.entries()].sort((a, b) => b[0] - a[0]); }
function renderTray(force = false) {
  if (!state) return;
  const z = F.zone(state), g = z?.kind === 'build' ? z.gap : null;
  const key = [z?.kind, g?.id, state.inventory.join(','), g ? (state.bridges[g.id] || []).join(',') : '', paused].join('|');
  if (!force && key === trayKey) return; trayKey = key;
  const mode = $('mode'), tray = $('tray');
  mode.className = 'mode' + (z ? ' ' + z.kind : '');
  if (g) {
    const left = g.value - F.sum(state.bridges[g.id] || []);
    mode.innerHTML = 'پایهٔ پل ' + fracHtml(g.value, g.label) + (g.remain && left < g.value ? ' · مانده ' + fracHtml(left) : '') + ' · تخته‌ای را انتخاب کن';
  } else if (z?.kind === 'split') mode.textContent = 'میز برش: روی تخته بزن تا به دو نیمهٔ مساوی تقسیم شود';
  else mode.textContent = state.locked.length === F.worlds[state.level].gaps.length ? 'همهٔ پل‌ها آماده‌اند؛ به پرچم برس!' : state.inventory.length ? 'تخته‌ها را تا پایهٔ پل بعدی ببر' : 'زیر بلوک‌های ؟ بپر تا تخته پیدا کنی';
  tray.classList.toggle('armed', !!z); tray.classList.toggle('split-mode', z?.kind === 'split');
  const list = groups();
  const cards = list.map(([v, n], i) => `<button class="plank-card" data-v="${v}" aria-label="تختهٔ ${F.text(v)}، ${fa(n)} عدد${z?.kind === 'split' ? '؛ برش' : z ? '؛ گذاشتن روی پل' : ''} (کلید ${fa(i + 1)})"><span class="bar" style="width:${Math.max(6, v / F.UNIT * 120)}px"></span>${fracHtml(v)}${n > 1 ? `<span class="count">×${fa(n)}</span>` : ''}</button>`).join('');
  const back = g && state.bridges[g.id]?.length ? `<button class="take-back" id="take-back" aria-label="پس‌گرفتن آخرین تخته"><svg class="i" aria-hidden="true"><use href="#i-back"/></svg><span>پس بگیر</span></button>` : '';
  tray.innerHTML = (cards || '<span class="tray-empty">کیف خالی است</span>') + back;
  tray.querySelectorAll('.plank-card').forEach(b => b.disabled = !initialized || blocked);
}
function renderHud() {
  if (!state) return;
  const w = F.worlds[state.level], score = state.score + (state.phase === 'play' ? state.levelScore : 0);
  const key = [state.level, score, state.coins, state.locked.length].join('|');
  if (key === hudKey) return; hudKey = key;
  $('level-step').textContent = 'پای‌آموز · مرحلهٔ ' + fa(state.level + 1) + ' از ' + fa(F.levels.length);
  $('level-title').textContent = F.levels[state.level].title;
  $('score').textContent = fa(score); $('coins').textContent = fa(state.coins);
  $('bridges').textContent = fa(state.locked.length) + '/' + fa(w.gaps.length);
}

// ---------- Rendering ----------
function buildGround() {
  const w = F.worlds[state.level], theme = F.levels[state.level].theme, k = Math.min(4, view.k);
  const tile = (g, name, x, y) => { const a = art[name]; if (a?.ok) g.drawImage(a.img, x, y, 48.6, 48.6); };
  const make = (wid, hei, paintFn) => { const c = document.createElement('canvas'); c.width = Math.ceil(wid * k); c.height = Math.ceil(hei * k); const g = c.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); paintFn(g); return c; };
  const out = [];
  for (const seg of w.ground) {
    const x = w.width - seg.x1, wid = seg.x1 - seg.x0, hei = Math.ceil(view.bottom - F.GROUND + 4);
    out.push({x, y: F.GROUND, w: wid, h: hei, c: make(wid, hei, g => {
      for (let i = 0; i * 48 < wid; i++) { tile(g, 'tile-top-' + theme, i * 48, 0); for (let j = 1; j * 48 < hei; j++) tile(g, 'tile-fill-' + theme, i * 48, j * 48); }
      // Cliff faces darken toward each chasm.
      for (const [from, dir] of [[0, 1], [wid, -1]]) { const gr = g.createLinearGradient(from, 0, from + dir * 14, 0); gr.addColorStop(0, '#0007'); gr.addColorStop(1, '#0000'); g.fillStyle = gr; g.fillRect(dir > 0 ? 0 : wid - 14, 10, 14, hei); }
      const depth = g.createLinearGradient(0, 30, 0, hei); depth.addColorStop(0, '#0000'); depth.addColorStop(1, '#0006'); g.fillStyle = depth; g.fillRect(0, 30, wid, hei);
      g.fillStyle = '#ffffff40'; g.fillRect(0, 0, wid, 2);
    })});
  }
  for (const st of w.steps) {
    const x = w.width - st.x1, wid = st.x1 - st.x0, hei = st.y1 - st.y0;
    out.push({x, y: st.y0, w: wid, h: hei, c: make(wid, hei, g => {
      for (let i = 0; i * 48 < wid; i++) for (let j = 0; j * 48 < hei; j++) tile(g, (j ? 'tile-fill-' : 'tile-top-') + theme, i * 48, j * 48);
      g.strokeStyle = '#0005'; g.lineWidth = 2; g.strokeRect(1, 1, wid - 2, hei);
    })});
  }
  groundCache = {level: state.level, k: view.k, bottom: view.bottom, list: out};
}
function plank(x, y, w, h, v, {alpha = 1, tone = 'wood', label = true} = {}) {
  const tones = {wood: ['#f6cc8c', '#c98c4c', '#6b3f1f'], gold: ['#fff0a8', '#e8b13a', '#7a4a10'], red: ['#ffb3a8', '#e0584a', '#7a1f16']}[tone];
  ctx.save(); ctx.globalAlpha *= alpha;
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, tones[0]); g.addColorStop(1, tones[1]);
  rr(x + .5, y, w - 1, h, 4); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = tones[2]; ctx.stroke();
  ctx.globalAlpha *= .35; ctx.strokeStyle = tones[2]; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + 5, y + h * .3); ctx.lineTo(x + w - 7, y + h * .3); ctx.moveTo(x + 9, y + h * .72); ctx.lineTo(x + w - 4, y + h * .72); ctx.stroke();
  ctx.globalAlpha /= .35;
  if (w > 18) { ctx.fillStyle = tones[2]; for (const nx of [x + 5, x + w - 5]) { ctx.beginPath(); ctx.arc(nx, y + h / 2, 1.6, 0, 7); ctx.fill(); } }
  if (label && w >= 26) { ctx.fillStyle = '#fff8e8cc'; rr(x + w / 2 - 12, y + 1, 24, h - 2, 4); ctx.fill(); drawFrac(v, x + w / 2, y + h / 2, 13, '#3a2a22'); }
  ctx.restore();
}
function sky(theme) {
  const t = THEMES[theme], g = ctx.createLinearGradient(0, -view.offY, 0, 540);
  g.addColorStop(0, t.sky[0]); g.addColorStop(1, t.sky[1]); ctx.fillStyle = g; ctx.fillRect(0, -view.offY, view.w, view.h);
  if (t.sun) { const sx = view.w * .78, sy = 90 - view.offY * .3, rg = ctx.createRadialGradient(sx, sy, 10, sx, sy, 110); rg.addColorStop(0, t.sun); rg.addColorStop(.35, t.sun + 'aa'); rg.addColorStop(1, t.sun + '00'); ctx.fillStyle = rg; ctx.fillRect(sx - 110, sy - 110, 220, 220); ctx.fillStyle = t.sun; ctx.beginPath(); ctx.arc(sx, sy, 34, 0, 7); ctx.fill(); if (t.moon) { ctx.fillStyle = t.sky[0]; ctx.globalAlpha = .55; ctx.beginPath(); ctx.arc(sx + 14, sy - 8, 28, 0, 7); ctx.fill(); ctx.globalAlpha = 1; } }
  if (t.clouds) for (let i = 0; i < 7; i++) {
    const span = view.w + 360, x = ((i * 337 + 80 - cam * .06 + (reduced ? 0 : clock * (6 + i))) % span + span) % span - 180, y = 40 + (i * 53) % 130 - view.offY * .4;
    draw('cloud', x, y, 180 * (.7 + (i % 3) * .2), 72 * (.7 + (i % 3) * .2), false, t.clouds * .92);
  }
  for (const [layer, f, y, h] of [['far', .15, 70, 360], ['near', .38, 195, 260]]) {
    const off = ((cam * f) % 960 + 960) % 960;
    for (let x = -off; x < view.w; x += 960) draw(layer + '-' + theme, Math.floor(x), y, 961, h);
  }
}
function render() {
  if (!state) return;
  const level = F.levels[state.level], w = F.worlds[state.level], theme = level.theme, W = w.width, pl = state.player;
  const playerX = W - pl.p;
  let target = playerX - view.w * .6; target = W <= view.w ? (W - view.w) / 2 : Math.max(0, Math.min(W - view.w, target));
  if (camLevel !== state.level) { cam = target; camLevel = state.level; } else cam += (target - cam) * Math.min(1, (reduced ? 1 : .12));
  if (!groundCache || groundCache.level !== state.level || groundCache.k !== view.k || groundCache.bottom !== view.bottom) buildGround();
  const k = view.k, shake = fx.shake > .2 ? (Math.random() - .5) * fx.shake : 0;
  ctx.setTransform(k, 0, 0, k, 0, view.offY * k); ctx.imageSmoothingQuality = 'high';
  sky(theme);
  ctx.save(); ctx.translate(-Math.round((cam + shake) * k) / k, 0);
  const left = cam - 120, right = cam + view.w + 120, vis = (a, b) => b > left && a < right, sx = p => W - p;
  // Chasms: deep shadow and water below every gap.
  const T = THEMES[theme];
  for (const g of w.gaps) {
    const x0 = sx(g.p1), x1 = sx(g.p0); if (!vis(x0, x1)) continue;
    const d = ctx.createLinearGradient(0, F.GROUND, 0, 540); d.addColorStop(0, T.deep[0]); d.addColorStop(1, T.deep[1]); ctx.fillStyle = d; ctx.fillRect(x0 - 2, F.GROUND, x1 - x0 + 4, view.bottom - F.GROUND);
    const wt = 486, wg = ctx.createLinearGradient(0, wt, 0, view.bottom); wg.addColorStop(0, T.water[0]); wg.addColorStop(1, T.water[1]); ctx.fillStyle = wg;
    ctx.beginPath(); ctx.moveTo(x0, view.bottom + 5);
    for (let x = x0; x <= x1 + 8; x += 8) ctx.lineTo(Math.min(x, x1), wt + Math.sin(x * .05 + (reduced ? 0 : clock * 2.4)) * 3);
    ctx.lineTo(x1, view.bottom + 5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffffff88'; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = x0 + 10; x < x1 - 10; x += 34) { const y = wt + 14 + Math.sin(x + clock * 1.5) * 2; ctx.moveTo(x, y); ctx.lineTo(x + 14, y); } ctx.stroke();
    if (g.ruler) {
      // Hanging measuring tape: each mark is 1/ruler of a whole plank.
      const step = F.UNIT * F.PX / g.ruler, ty = F.GROUND + 34;
      ctx.fillStyle = '#ffe17a'; rr(x0, ty, x1 - x0, 14, 3); ctx.fill(); ctx.strokeStyle = '#7a4a10'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = '#3a2a22'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 1; i * step <= g.p1 - g.p0 + .5; i++) { const x = x1 - i * step; ctx.moveTo(x, ty); ctx.lineTo(x, ty + 14); }
      ctx.stroke();
      for (let i = 1; i * step <= g.p1 - g.p0 + .5; i++) { const lx = x1 - i * step; ctx.fillStyle = '#16314acc'; rr(lx - 13, ty + 17, 26, 32, 7); ctx.fill(); drawFrac(F.UNIT / g.ruler * i, lx, ty + 33, 14, '#fff8e8', [i, g.ruler]); }
    }
  }
  for (const s of groundCache.list) if (vis(s.x, s.x + s.w)) ctx.drawImage(s.c, s.x, s.y, s.w, s.h);
  // Bridges: placed planks hang translucent until the exact total locks them.
  for (const g of w.gaps) {
    const x1 = sx(g.p0); if (!vis(sx(g.p1), x1 + 80)) continue;
    const placed = state.bridges[g.id] || [], locked = state.locked.includes(g.id), total = F.sum(placed);
    const post = {x: x1 + 4, y: F.GROUND - 112};
    draw('post', post.x, post.y, 64, 120);
    drawFrac(g.value, post.x + 32, post.y + 26, 24, '#3a2a22', g.label);
    if (locked) { ctx.fillStyle = '#1f7a59'; ctx.beginPath(); ctx.arc(post.x + 56, post.y + 6, 11, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(post.x + 51, post.y + 6); ctx.lineTo(post.x + 55, post.y + 10); ctx.lineTo(post.x + 61, post.y + 2); ctx.stroke(); }
    let cursor = x1;
    const lockGlow = fx.lock?.gap === g.id ? Math.max(0, 1 - fx.lock.t / 1.4) : 0;
    placed.forEach(v => {
      const len = v * F.PX, x = cursor - len, y = locked ? F.GROUND : F.GROUND + 8 + Math.sin(clock * 3 + cursor) * (reduced ? 0 : 1.5);
      if (!locked) { ctx.strokeStyle = '#6b3f1f99'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(post.x + 30, post.y + 74); ctx.lineTo(x + len / 2, y); ctx.stroke(); }
      plank(x, y, len, 24, v, {alpha: locked ? 1 : .72, tone: lockGlow > .3 ? 'gold' : 'wood'});
      cursor -= len;
    });
    if (lockGlow) { ctx.save(); ctx.globalAlpha = lockGlow * .55; ctx.fillStyle = '#fff3a0'; rr(sx(g.p1) - 4, F.GROUND - 8, g.p1 - g.p0 + 8, 40, 8); ctx.fill(); ctx.restore(); }
    if (!locked) {
      const left2 = g.value - total, x = cursor - left2 * F.PX;
      ctx.save(); ctx.setLineDash([7, 6]); ctx.strokeStyle = '#ffffffcc'; ctx.lineWidth = 2; rr(x + 1, F.GROUND + 8, left2 * F.PX - 2, 24, 4); ctx.stroke(); ctx.restore();
      if (left2 * F.PX >= 40) { if (g.remain && total) drawFrac(left2, x + left2 * F.PX / 2, F.GROUND + 20, 14, '#ffffff'); else if (!g.remain) { ctx.fillStyle = '#ffffffcc'; ctx.font = font(16); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('؟', x + left2 * F.PX / 2, F.GROUND + 21); } }
      if (fx.reject?.gap === g.id) {
        // The rejected plank visibly overruns the far edge, then springs back.
        const t = fx.reject.t, len = fx.reject.v * F.PX, slide = t < .35 ? t / .35 : Math.max(0, 1 - (t - .35) / .35);
        plank(cursor - len * slide, F.GROUND + 4, len, 24, fx.reject.v, {alpha: 1 - Math.max(0, t - .5), tone: 'red'});
      }
      const z = F.zone(state);
      if (z?.gap?.id === g.id) { const bob = reduced ? 0 : Math.sin(clock * 5) * 4; ctx.fillStyle = '#ffd45a'; ctx.strokeStyle = '#7a4a10'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(post.x + 32, post.y - 6 + bob); ctx.lineTo(post.x + 22, post.y - 20 + bob); ctx.lineTo(post.x + 42, post.y - 20 + bob); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    }
  }
  for (const t of w.splitters) {
    const x = sx(t.p) - 48; if (!vis(x, x + 96)) continue;
    draw('splitter', x, F.GROUND - 82, 96, 84);
    const near = F.zone(state)?.kind === 'split';
    ctx.fillStyle = near ? '#f08a3c' : '#fffaf0e6'; rr(x + 14, F.GROUND - 116, 68, 24, 12); ctx.fill(); ctx.strokeStyle = '#7a4a10'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = near ? '#fff' : '#3a2a22'; ctx.font = font(12); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('میز برش', x + 48, F.GROUND - 103);
  }
  for (const b of w.blocks) {
    const x = sx(b.x1); if (!vis(x, x + 48)) continue;
    const t = fx.bumps[b.id], bump = t !== undefined && t < .2 ? -Math.sin(t / .2 * Math.PI) * 10 : 0;
    draw(state.used.includes(b.id) ? 'block-used' : 'block-q', x, b.y0 + bump, 48, 48);
  }
  for (const c of w.coins) {
    if (state.taken.includes(c.id)) continue; const x = sx(c.p); if (!vis(x - 16, x + 16)) continue;
    const spin = reduced ? 1 : Math.max(.15, Math.abs(Math.cos(clock * 3 + c.p * .01)));
    draw('coin', x - 13 * spin, c.y - 13 + (reduced ? 0 : Math.sin(clock * 2 + c.p) * 2), 26 * spin, 26);
  }
  for (const kr of w.crates) { if (state.taken.includes(kr.id)) continue; const x = sx(kr.p) - 22; if (vis(x, x + 44)) draw('crate', x, F.GROUND - 44, 44, 44); }
  draw(Math.floor(clock * 2.5) % 2 && !reduced ? 'flag-2' : 'flag-1', sx(w.flag) - 36, F.GROUND - 240, 72, 244);
  for (const d of w.snails) {
    const sn = state.snails[d.id]; if (sn.dead) continue; const x = sx(sn.p);
    if (vis(x - 32, x + 32)) draw(Math.floor(clock * 3 + d.a) % 2 && !reduced ? 'snail-2' : 'snail-1', x - 32, F.GROUND - 47, 64, 48, sn.dir < 0);
  }
  for (const s of fx.squash) { const x = sx(s.p); ctx.save(); ctx.globalAlpha = Math.max(0, 1 - s.life / .7); draw('snail-1', x - 34, F.GROUND - 18, 68, 18, s.flip); ctx.restore(); }
  // Hero
  const moving = Math.abs(pl.vx) > 25, frame = pl.hurt > 600 ? 'hero-hurt' : !pl.ground ? 'hero-jump' : moving ? (Math.floor(clock * 10) % 2 ? 'hero-run1' : 'hero-run2') : (clock % 3.2 < .14 ? 'hero-blink' : 'hero-idle');
  const flick = pl.hurt > 0 && Math.floor(pl.hurt / 90) % 2 && !reduced ? .45 : 1;
  ctx.save(); ctx.globalAlpha = .22; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(playerX, F.GROUND + 1, pl.ground ? 15 : 10, 3.5, 0, 0, 7); if (pl.y <= F.GROUND + 2) ctx.fill(); ctx.restore();
  draw(frame, playerX - 32, pl.y - 79, 64, 80, pl.face < 0, flick);
  for (const p of fx.pops) {
    const t = p.life, y = p.y - 30 - t * 70, x = sx(p.p);
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - .6) / .4);
    if (p.kind === 'coin') draw('coin', x - 13, y, 26, 26); else { const len = p.v * F.PX * .5; plank(x - len / 2, y, len, 22, p.v, {label: false}); drawFrac(p.v, x, y - 20, 17, '#7a4a10'); }
    ctx.restore();
  }
  for (const p of fx.parts) { ctx.globalAlpha = Math.max(0, 1 - p.life / p.max); ctx.fillStyle = p.color; ctx.fillRect(sx(p.p) - p.size / 2, p.y - p.size / 2, p.size, p.size); }
  ctx.globalAlpha = 1;
  for (const t of fx.texts) { ctx.globalAlpha = Math.max(0, 1 - t.life / t.max); ctx.font = font(20, 900); ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.strokeText(t.text, sx(t.p), t.y - t.life * 40); ctx.fillStyle = t.color; ctx.fillText(t.text, sx(t.p), t.y - t.life * 40); }
  ctx.globalAlpha = 1; ctx.restore();
  if (fx.fade > 0) { ctx.fillStyle = `rgba(255,255,255,${fx.fade * .7})`; ctx.fillRect(0, -view.offY, view.w, view.h); }
  if (theme === 'cave') { const pg = ctx.createRadialGradient(playerX - cam, pl.y - 40, 80, playerX - cam, pl.y - 40, view.w * .7); pg.addColorStop(0, '#0000'); pg.addColorStop(1, '#0a1020aa'); ctx.fillStyle = pg; ctx.fillRect(0, -view.offY, view.w, view.h); }
}
function updateFx(dt) {
  const s = dt / 1000; clock += s;
  for (const id in fx.bumps) { fx.bumps[id] += s; if (fx.bumps[id] > .3) delete fx.bumps[id]; }
  for (const list of [fx.pops, fx.squash, fx.texts]) for (let i = list.length - 1; i >= 0; i--) { list[i].life += s; if (list[i].life > (list[i].max || .9)) list.splice(i, 1); }
  for (let i = fx.parts.length - 1; i >= 0; i--) { const p = fx.parts[i]; p.life += s; p.vy += 500 * s; p.p -= p.vx * s; p.y += p.vy * s; if (p.life > p.max) fx.parts.splice(i, 1); }
  fx.shake *= Math.pow(.02, s); fx.fade = Math.max(0, fx.fade - s * 2.2);
  if (fx.lock) { fx.lock.t += s; if (fx.lock.t > 1.6) fx.lock = null; }
  if (fx.reject) { fx.reject.t += s; if (fx.reject.t > 1) fx.reject = null; }
}
function paint(force = false) {
  const now = performance.now();
  if (!force && (paused || modal) && now - lastPaint < 200) return;
  lastPaint = now; render(); renderHud(); renderTray();
}

// ---------- Dialogs ----------
const btn = (action, text, cls = '') => `<button data-action="${action}" class="${cls}">${text}</button>`;
function demo(list, total, label) { return `<div class="demo">${list.map(v => `<span class="p" style="width:${v / F.UNIT * 160}px"></span>`).join('')}<span>${list.map(v => fracHtml(v)).join(' + ')} = ${fracHtml(total, label)}</span></div>`; }
function openModal(kind) { returnFocus = document.activeElement; modal = kind; bridge?.stop(); showModal(); }
function closeModal() { if (blocked) return; modal = null; bridge?.resume(); showModal(); if (returnFocus?.isConnected) returnFocus.focus(); }
function showModal() {
  if (state?.outcome && !['about', 'restart', 'summary'].includes(modal)) modal = 'summary';
  if (!modal) { overlay.hidden = true; $('dialog').dataset.kind = ''; paint(true); return; }
  if ($('dialog').dataset.kind === modal) return;
  $('dialog').dataset.kind = modal; overlay.hidden = false;
  let title = '', badge = '؟', body = '';
  const L = F.levels[state.level];
  if (modal === 'welcome' || modal === 'help') {
    title = modal === 'welcome' ? 'پویا و دره‌های کسری' : 'راهنمای سفر';
    body = `<p>پویا باید به قلعهٔ کسرها برسد، اما سر راهش دره‌هایی هست که با پرش رد نمی‌شود. پهنای هر دره روی تابلوی کنارش نوشته شده است.</p>
    <ol class="steps"><li><b>۱</b><span>از زیر به بلوک‌های <b>؟</b> بپر تا تخته‌های کسری بگیری.</span></li><li><b>۲</b><span>کنار <b>پایهٔ پل</b> بایست و تخته‌ها را از کیف پایین صفحه روی دره بچین.</span></li><li><b>۳</b><span>پل فقط وقتی می‌ایستد که جمع تخته‌ها <b>دقیقاً</b> برابر پهنای دره باشد.</span></li><li><b>۴</b><span>روی <b>میز برش</b> هر تخته به دو نیمهٔ مساوی تقسیم می‌شود.</span></li></ol>
    <div class="tipbox">یک تختهٔ کامل = ${fracHtml(48)} واحد. مثلاً برای درهٔ ${fracHtml(36)}:${demo([24, 12], 36)}</div>
    <p class="foot">${document.body.classList.contains('touch') ? 'دکمه‌های پایین‌چپ: حرکت · دکمهٔ نارنجی: پرش · کارت‌های تخته: چیدن یا برش' : 'کلیدها: ← جلو، → عقب، Space پرش، ۱ تا ۶ تخته، Z پس‌گرفتن، Esc توقف'}</p>`
      + (recoveryNotice ? `<p class="foot">${recoveryNotice}</p>` : '') + btn('resume', modal === 'welcome' ? 'شروع سفر' : 'برگشت به بازی', 'primary');
  } else if (modal === 'level') {
    title = L.title; badge = fa(state.level + 1);
    body = `<p>منطقهٔ ${fa(state.level + 1)} از ${fa(F.levels.length)}. تخته‌های این منطقه:</p><div class="tipbox"><div class="demo">${L.planks.map(v => `<span class="p" style="width:${v / F.UNIT * 160}px"></span>${fracHtml(v)}`).join('&nbsp;&nbsp;')}</div><p style="margin:8px 0 0">${L.tip}</p></div>` + btn('resume', 'برو به ' + L.title, 'primary');
  } else if (modal === 'pause') {
    title = 'سفر متوقف شد'; badge = 'Ⅱ';
    body = '<p>زمان و حرکت متوقف‌اند. تخته‌ها و پل‌ها برای ادامه نگه داشته می‌شوند.</p>' + btn('resume', 'ادامهٔ سفر', 'primary') + `<div class="row">${btn('help', 'راهنما')}${btn('theme', document.documentElement.dataset.theme === 'dark' ? 'ظاهر روشن' : 'ظاهر تیره')}</div><div class="row">${btn('about', 'دربارهٔ پای‌آموز')}</div>`;
  } else if (modal === 'cleared') {
    const r = state.completed[state.completed.length - 1]; badge = '★';
    title = 'به پرچم رسیدی!';
    body = `<div class="stars" aria-label="${fa(r.stars)} ستاره">${[1, 2, 3].map(i => `<span class="${i <= r.stars ? '' : 'off'}">★</span>`).join('')}</div><p style="text-align:center">${L.title} با ${fa(F.worlds[state.level].gaps.length)} پل دقیق پشت سر گذاشته شد.</p>
    <div class="grid"><div><strong>${fa(r.score)}</strong><small>امتیاز</small></div><div><strong>${fa(r.errors)}</strong><small>تختهٔ ناجور</small></div><div><strong>${fa(r.coins)}</strong><small>سکه</small></div><div><strong>${fa(r.seconds)}</strong><small>ثانیه</small></div></div>`
      + (r.errors ? '<p class="foot">پیش از گذاشتن تخته، طول آن را با جای خالی مقایسه کن؛ هر تختهٔ ناجور یک ستاره کم می‌کند.</p>' : '<p class="foot">همهٔ پل‌ها بدون حتی یک تختهٔ ناجور! این یعنی کسرها را خوب می‌سنجی.</p>')
      + btn('next', state.level === F.levels.length - 1 ? 'دیدن کارنامهٔ سفر' : 'منطقهٔ بعدی ←', 'primary');
  } else if (modal === 'summary') {
    const m = F.metrics(state); title = 'پویا به قلعهٔ کسرها رسید!'; badge = '♛';
    body = `<p>با ${fa(m.bridges)} پل دقیق، از نیمه‌ها تا دوازدهم‌ها را پشت سر گذاشتی.</p><div class="big">${fa(m.score)}</div><p style="text-align:center;margin-top:0">امتیاز سفر</p>`
      + state.completed.map(r => `<div class="record"><span>${F.levels.find(l => l.id === r.id).title} · ${fa(r.score)}</span><span>${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}</span></div>`).join('')
      + `<div class="grid"><div><strong>${fa(m.bridges)}</strong><small>پل دقیق</small></div><div><strong>${fa(m.errors)}</strong><small>تختهٔ ناجور</small></div><div><strong>${fa(m.coins)}</strong><small>سکه</small></div><div><strong>${fa(m.seconds)}</strong><small>ثانیه</small></div></div>`
      + (bridge?.embedded ? '<p class="foot">برای سفر تازه، از دکمهٔ شروع دوبارهٔ سایت استفاده کن.</p>' : btn('restart', 'سفر تازه', 'primary')) + `<div class="row">${btn('about', 'کارهای بیشتر از پای‌آموز')}</div>`;
  } else if (modal === 'about') {
    title = 'یادگیری با بازی'; badge = '✦';
    body = '<p>ساخته‌شده با موتور یکپارچهٔ کلاس زنده و SDK بازی پای‌آموز · حجت بابایی</p><p class="foot">آموزش ساخت بازی‌ها و فعالیت‌های تعاملی در سایت و کانال پای‌آموز.</p><input id="brand-url" aria-label="نشانی کانال پای‌آموز" value="https://eitaa.com/pyamooz" readonly><p class="foot">سایت: pyamooz.com · تماس: ۰۹۱۵۴۸۶۵۶۶۳</p>' + `<div class="row">${btn('copy', 'کپی نشانی')}${btn('cancel', 'برگشت')}</div><p id="copy-status" class="foot" role="status"></p>`;
  } else if (modal === 'restart') {
    title = 'یک سفر تازه؟'; badge = '↻';
    body = '<p>کارنامهٔ فعلی در همین مرورگر بایگانی می‌شود و سفر از دشت نیمه‌ها دوباره آغاز می‌شود.</p>' + `<div class="row">${btn('cancel', 'برگشت به کارنامه')}${btn('restart-yes', 'بله، سفر تازه', 'primary')}</div>`;
  } else if (modal === 'blocked') {
    title = 'ادامهٔ این دور متوقف شد'; badge = '!';
    body = `<p>${storageMessage}</p><p class="foot">پیشرفت این صفحه پاک نشده است. برای ادامه، وضعیت تازه را از سایت دریافت کن.</p>`;
  }
  $('dialog').innerHTML = `<div class="badge">${badge}</div><h2 id="dialog-title">${title}</h2>${body}`;
  requestAnimationFrame(() => $('dialog').querySelector('button')?.focus());
}
function levelCleared() {
  renderHud(); modal = 'cleared'; showModal(); bridge.stop();
}
function nextLevel() {
  if (!F.next(state)) return;
  fx.parts.length = fx.texts.length = fx.pops.length = fx.squash.length = 0; groundCache = null; camLevel = -1; hudKey = '';
  if (state.outcome) { modal = 'summary'; $('dialog').dataset.kind = ''; showModal(); bridge.finish('won', F.metrics(state), Math.round(state.elapsedMs)); }
  else { modal = 'level'; $('dialog').dataset.kind = ''; showModal(); bridge.save(); }
  paint(true);
}
$('dialog').addEventListener('click', async event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action || blocked) return;
  if (action === 'resume') {
    if (state.intro) state.intro = false;
    if (compact && !orientationAttempted) void enterLandscape();
    closeModal(); bridge.save();
  }
  if (action === 'help') { modal = 'help'; showModal(); }
  if (action === 'theme') { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; $('dialog').dataset.kind = ''; showModal(); }
  if (action === 'next') nextLevel();
  if (action === 'about') { modal = 'about'; showModal(); }
  if (action === 'restart') { modal = 'restart'; showModal(); }
  if (action === 'cancel') { modal = state.outcome ? 'summary' : state.phase === 'cleared' ? 'cleared' : 'pause'; showModal(); }
  if (action === 'restart-yes' && !bridge.embedded) {
    try {
      const key = 'pyamooz:standalone:' + manifest.id, original = localStorage.getItem(key);
      if (original) { localStorage.setItem(key + ':archive:' + Date.now(), original); localStorage.removeItem(key); }
    } catch { toast('بایگانی کارنامه ممکن نشد؛ سفر تازه آغاز نشد تا کارنامه حفظ شود.', 'bad'); modal = 'summary'; showModal(); return; }
    bridge.destroy(); state = null; paused = true; modal = null; camLevel = -1; groundCache = null; hudKey = trayKey = ''; $('dialog').dataset.kind = ''; makeBridge();
  }
  if (action === 'copy') {
    const input = $('brand-url'); input.focus(); input.select();
    try { if (!navigator.clipboard) throw Error('unavailable'); await navigator.clipboard.writeText(input.value); $('copy-status').textContent = 'نشانی کپی شد.'; }
    catch { $('copy-status').textContent = 'نشانی انتخاب شد؛ با گزینهٔ کپی دستگاه آن را بردار.'; }
  }
});

// ---------- SDK bridge ----------
function restoreState(saved) {
  if (!saved) return F.initial();
  try { return F.validate(saved); }
  catch (error) {
    if (window.parent !== window) throw error;
    // Standalone: keep the unreadable save untouched under an archive key, then start fresh.
    try { const key = 'pyamooz:standalone:' + manifest.id, raw = localStorage.getItem(key); if (raw) localStorage.setItem(key + ':invalid:' + Date.now(), raw); localStorage.removeItem(key); } catch { /* Storage is optional. */ }
    recoveryNotice = 'ذخیرهٔ قبلی قابل ادامه نبود؛ نسخهٔ اصلی آن در همین مرورگر بایگانی شد.';
    return F.initial();
  }
}
// Versions 2 and 3 changed only touch controls and the hero's colours; the state format is identical, so older standalone saves carry over.
// The original bytes stay under a backup key, and an unreadable save is left for restoreState to archive.
function migrateStandalone() {
  if (window.parent !== window) return;
  try {
    const key = 'pyamooz:standalone:' + manifest.id, raw = localStorage.getItem(key);
    if (!raw || raw.length > 262144) return;
    const old = JSON.parse(raw);
    if (![1, 2].includes(old?.version)) return;
    const backup = key + ':v' + old.version + '-backup';
    if (!localStorage.getItem(backup)) localStorage.setItem(backup, raw);
    localStorage.setItem(key, JSON.stringify({...old, version: manifest.version}));
  } catch { /* Storage is optional; the original save is never removed here. */ }
}
function makeBridge() {
  bridge = createGameBridge({manifest,
    restore(saved) {
      state = restoreState(saved); initialized = true; blocked = false; camLevel = -1; groundCache = null; hudKey = trayKey = '';
      modal = state.outcome ? 'summary' : state.phase === 'cleared' ? 'cleared' : !saved || recoveryNotice ? 'welcome' : state.intro ? (state.level ? 'level' : 'welcome') : 'pause';
      $('dialog').dataset.kind = ''; showModal(); enableControls();
    },
    snapshot: () => state,
    pause(value) {
      paused = value; lastTime = null; keys.clear(); releaseFingers();
      if (value && state && !modal && !state.outcome) { modal = 'pause'; $('dialog').dataset.kind = ''; }
      if (!value && !blocked) modal = null;
      showModal(); renderTray(true);
    },
    preferences(value) {
      if (['light', 'dark'].includes(value.theme)) document.documentElement.dataset.theme = value.theme;
      if (typeof value.reducedMotion === 'boolean') reduced = value.reducedMotion;
      if (value.sound === false) { sound = false; updateSound(); }
    },
    status(value) {
      const labels = {local: 'پیشرفت در همین مرورگر ذخیره شد.', server: 'پیشرفت در حساب ذخیره شد.', preview: 'پیش‌نمایش؛ ذخیرهٔ حساب انجام نمی‌شود.', ready: 'آمادهٔ سفر.', finished: 'سفر به پایان رسید؛ کارنامه آماده است.', STORAGE_UNAVAILABLE: 'ذخیره در دسترس نیست؛ برای حفظ پیشرفت، صفحه را نبند.'};
      if (labels[value]) $('save-status').textContent = labels[value];
      else if (['STATE_CONFLICT', 'RUN_FINISHED', 'ACCESS_REVOKED', 'INVALID_MESSAGE'].includes(value)) {
        storageMessage = {STATE_CONFLICT: 'وضعیت تازه‌تری در سایت ثبت شده است.', RUN_FINISHED: 'این دور در سایت پایان یافته است.', ACCESS_REVOKED: 'دسترسی این دور در سایت تغییر کرده است.', INVALID_MESSAGE: 'دادهٔ بازی یا پیام سایت معتبر نیست.'}[value];
        blocked = true; modal = 'blocked'; $('dialog').dataset.kind = ''; $('save-status').textContent = storageMessage; if (state) showModal(); else { overlay.hidden = false; $('dialog').innerHTML = `<div class="badge">!</div><h2 id="dialog-title">ادامهٔ این دور متوقف شد</h2><p>${storageMessage}</p>`; }
      } else if (value && value !== 'ready') $('save-status').textContent = 'ثبت پیشرفت هنوز تأیید نشده؛ صفحه را نبند.';
    }
  });
}
function enableControls() { document.querySelectorAll('button').forEach(el => { el.disabled = !initialized && el.id !== 'sound'; }); renderTray(true); }

// ---------- Input ----------
const FWD = ['ArrowLeft', 'KeyA'], BACK = ['ArrowRight', 'KeyD'], JUMP = ['Space', 'ArrowUp', 'KeyW'];
document.addEventListener('keydown', event => {
  if (!overlay.hidden) {
    if (event.key === 'Tab') { const items = [...$('dialog').querySelectorAll('button,input')].filter(el => !el.disabled), first = items[0], last = items.at(-1); if (items.length && event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (items.length && !event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
    if (event.key === 'Escape' && ['pause', 'help', 'about'].includes(modal)) { event.preventDefault(); if (modal === 'about' && state.outcome) { modal = 'summary'; showModal(); } else closeModal(); }
    return;
  }
  if (event.target.closest?.('input')) return;
  const code = event.code;
  if ([...FWD, ...BACK, ...JUMP].includes(code)) { event.preventDefault(); if (JUMP.includes(code) && !event.repeat) jumpQueued = true; keys.add(code); }
  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  if (digit) { event.preventDefault(); const g = groups()[Number(digit[1]) - 1]; if (g) usePlank(g[0]); }
  if (code === 'KeyZ' || code === 'Backspace') { event.preventDefault(); takeBack(); }
  if ((code === 'Escape' || code === 'KeyP') && initialized && !blocked && !state?.outcome) { event.preventDefault(); openModal('pause'); }
});
document.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => { keys.clear(); releaseFingers(); });
// Touch zones: each finger is tracked on its own, so moving and jumping never block each other,
// and a thumb can slide between ← and → without lifting. Direction follows the nearest arrow on screen,
// which also holds when the whole game is rotated for a portrait phone.
const fingers = new Map();
const middle = el => { const b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; };
function moveRole(x, y) { const [fx, fy] = middle($('pad-fwd')), [bx, by] = middle($('pad-back')); return Math.hypot(x - fx, y - fy) <= Math.hypot(x - bx, y - by) ? 'fwd' : 'back'; }
function syncPad() {
  pad.fwd = pad.back = pad.jump = false;
  for (const role of fingers.values()) pad[role] = true;
  for (const [id, role] of [['pad-fwd', 'fwd'], ['pad-back', 'back'], ['pad-jump', 'jump']]) $(id).classList.toggle('on', pad[role]);
}
function releaseFingers() { fingers.clear(); syncPad(); }
for (const [id, zone] of [['zone-move', 'move'], ['zone-jump', 'jump']]) {
  const el = $(id);
  el.addEventListener('pointerdown', event => {
    event.preventDefault(); document.body.classList.add('touched', 'touch');
    try { el.setPointerCapture(event.pointerId); } catch { /* Capture is optional. */ }
    const role = zone === 'jump' ? 'jump' : moveRole(event.clientX, event.clientY);
    fingers.set(event.pointerId, role);
    if (role === 'jump') { jumpQueued = true; try { navigator.vibrate?.(8); } catch { /* Haptics are optional. */ } }
    syncPad();
  });
  el.addEventListener('pointermove', event => {
    const role = fingers.get(event.pointerId); if (!role || role === 'jump') return;
    const next = moveRole(event.clientX, event.clientY); if (next !== role) { fingers.set(event.pointerId, next); syncPad(); }
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(type, event => { if (fingers.delete(event.pointerId)) syncPad(); });
  el.addEventListener('contextmenu', event => event.preventDefault());
  // Blocks the long-press magnifier and double-tap zoom on iOS; pointer events still arrive.
  el.addEventListener('touchstart', event => event.preventDefault(), {passive: false});
}
window.addEventListener('touchstart', () => { if (!document.body.classList.contains('touched')) { document.body.classList.add('touched', 'touch'); } }, {passive: true});
$('tray').addEventListener('click', event => { const card = event.target.closest('.plank-card'); if (card) usePlank(Number(card.dataset.v)); else if (event.target.closest('#take-back')) takeBack(); });
$('pause').addEventListener('click', () => { if (initialized && !blocked && !state.outcome) paused ? closeModal() : openModal('pause'); });
$('help').addEventListener('click', () => { if (initialized && !blocked) openModal('help'); });
$('fullscreen').addEventListener('click', async () => {
  if (document.fullscreenElement) { try { if (orientationOwned) { screen.orientation.unlock(); orientationOwned = false; } await document.exitFullscreen(); } catch { /* Optional. */ } layout(); }
  else await enterLandscape();
});
$('sound').addEventListener('click', async () => {
  try { const A = window.AudioContext || window.webkitAudioContext; if (!A) throw Error('unavailable'); if (!audio) audio = new A(); await audio.resume(); sound = !sound; updateSound(); if (sound) play('coin'); }
  catch { sound = false; updateSound(); toast('صدا در این مرورگر در دسترس نیست؛ بازی بی‌صدا ادامه دارد.'); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && initialized && state && !state.outcome && !blocked) { if (!modal) openModal('pause'); else bridge.stop(); } });
window.addEventListener('pagehide', () => bridge?.stop());
window.addEventListener('resize', layout); window.visualViewport?.addEventListener('resize', layout);
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && orientationOwned) { try { screen.orientation.unlock(); } catch { /* Optional. */ } orientationOwned = false; } layout(); });

// ---------- Main loop ----------
function tick(now) {
  const dt = lastTime === null ? 0 : Math.max(0, Math.min(100, now - lastTime)); lastTime = now;
  if (state && initialized && !paused && !blocked && !modal && state.phase === 'play') {
    const dir = (FWD.some(c => keys.has(c)) || pad.fwd ? 1 : 0) - (BACK.some(c => keys.has(c)) || pad.back ? 1 : 0);
    const events = F.step(state, {dir, jump: JUMP.some(c => keys.has(c)) || pad.jump, jumpPressed: jumpQueued}, dt);
    jumpQueued = false;
    if (events.length) handle(events);
    if (state.phase === 'play') { saveTimer += dt; if (saveTimer >= 1000) { saveTimer = 0; bridge.save(); } }
    updateFx(dt); paint(true);
  } else { jumpQueued = false; updateFx(0); paint(); }
  requestAnimationFrame(tick);
}
(async () => {
  layout();
  document.querySelectorAll('button').forEach(el => { if (el.id !== 'sound') el.disabled = true; });
  $('save-status').textContent = 'منتظر آماده‌شدن…';
  await loadArt();
  migrateStandalone();
  makeBridge();
  if (!initialized) { document.querySelectorAll('button').forEach(el => { if (el.id !== 'sound') el.disabled = true; }); $('save-status').textContent = 'منتظر آماده‌شدن سایت…'; }
  layout();
  requestAnimationFrame(tick);
})();
