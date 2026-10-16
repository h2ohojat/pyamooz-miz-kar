// Fraction Bridge rules and physics. Lengths are integers of 1/48 of a whole; one whole is 10 ground tiles (480 px).
// World coordinate p grows toward the goal; the renderer mirrors it so the hero runs right-to-left.
export const FractionBridge = (() => {
  const TILE = 48, PX = 10, UNIT = 48, GROUND = 432, VIEW_H = 540;
  const PHYS = {gravity: 2400, jump: 820, cut: .45, speed: 180, accelGround: 1600, accelAir: 1000, maxFall: 900, coyote: 60, buffer: 110, half: 15, height: 56};
  const PLANKS = [24, 16, 12, 8, 6, 4, 3];
  const SPLIT = {24: 12, 16: 8, 12: 6, 8: 4, 6: 3};
  const SCORE = {coin: 10, stomp: 20, bridge: 100, clean: 50, error: 5, fall: 10, hurt: 10};
  const q = (x, give) => ({t: 'q', x, give}), coin = (x, h) => ({t: 'coin', x, h}), crate = (x, give) => ({t: 'crate', x, give});
  const snail = (a, b) => ({t: 'snail', a, b}), ledge = (x, w, h) => ({t: 'step', x, w, h}), splitter = x => ({t: 'splitter', x});
  const coins = (x, n, h) => Array.from({length: n}, (_, i) => coin(x + i, h));
  const levels = [
    {id: 'meadow', title: 'دشت نیمه‌ها', theme: 'meadow', planks: [24, 12], tip: 'هر تختهٔ ۱/۲ نصف یک واحد است؛ دو نیمه یک واحد کامل می‌شوند.', sections: [
      {len: 16, items: [q(5, 24), ...coins(8, 3, 2), q(12, 'coin')]},
      {gap: 24, ruler: 2, remain: true},
      {len: 14, items: [q(4, 24), q(6, 24), ...coins(3, 2, 1), snail(8, 11)]},
      {gap: 48, ruler: 2, remain: true},
      {len: 14, items: [q(4, 24), crate(7, 12), q(10, 12), ...coins(5, 3, 3)]},
      {gap: 36, ruler: 4, remain: true},
      {len: 14, items: [...coins(4, 4, 1), ledge(6, 2, 1), coin(6, 2), coin(7, 2)]}]},
    {id: 'forest', title: 'جنگل چهارم‌ها', theme: 'forest', planks: [12, 24], tip: 'روی میز برش، یک تخته به دو تکهٔ مساوی تبدیل می‌شود: ۱/۲ = ۲/۴.', sections: [
      {len: 15, items: [q(4, 12), q(6, 12), q(8, 12), ...coins(5, 3, 1), snail(9, 12)]},
      {gap: 36, ruler: 4, remain: true},
      {len: 16, items: [splitter(5), q(9, 24), q(11, 24), q(13, 24), ...coins(9, 3, 2)]},
      {gap: 60, ruler: 4, remain: true},
      {len: 14, items: [crate(4, 12), ledge(7, 2, 1), coin(7, 2), coin(8, 2), snail(3, 6)]},
      {gap: 24, label: [2, 4], ruler: 4, remain: true},
      {len: 14, items: [...coins(3, 3, 2), q(7, 'coin')]}]},
    {id: 'canyon', title: 'درهٔ سوم‌ها', theme: 'canyon', planks: [16, 8], tip: 'سه تختهٔ ۱/۳ یک واحد می‌سازند؛ هر ۱/۳ با دو تختهٔ ۱/۶ برابر است.', sections: [
      {len: 15, items: [q(4, 16), q(7, 16), ...coins(4, 4, 1), snail(9, 12)]},
      {gap: 32, ruler: 3, remain: true},
      {len: 16, items: [splitter(4), q(8, 16), q(10, 16), crate(12, 8), ...coins(8, 3, 2)]},
      {gap: 40, ruler: 0, remain: false},
      {len: 15, items: [q(5, 24), q(8, 16), crate(10, 8), snail(6, 11), ...coins(4, 2, 3)]},
      {gap: 24, label: [3, 6], ruler: 0, remain: false},
      {len: 14, items: [ledge(4, 1, 1), ledge(5, 1, 2), coin(5, 3), ...coins(8, 3, 1)]}]},
    {id: 'cave', title: 'غار هشتم‌ها', theme: 'cave', planks: [6, 12, 24], tip: 'در غار خط‌کشی نیست؛ با چشم و حساب، طول دره را بسنج.', sections: [
      {len: 15, items: [q(4, 12), q(6, 6), ...coins(8, 3, 1), snail(8, 12)]},
      {gap: 18, ruler: 0, remain: false},
      {len: 16, items: [splitter(4), q(8, 24), q(10, 12), crate(12, 6), snail(9, 13), ...coins(8, 3, 2)]},
      {gap: 42, ruler: 0, remain: false},
      {len: 16, items: [q(4, 24), q(6, 24), q(8, 12), snail(9, 13), ...coins(10, 3, 1)]},
      {gap: 54, ruler: 0, remain: false},
      {len: 14, items: [...coins(3, 5, 2), q(9, 'coin')]}]},
    {id: 'castle', title: 'قلعهٔ کسرها', theme: 'castle', planks: [24, 16, 8, 12], tip: 'آخرین سفر: کسرهای مختلف را با هم جمع کن تا دقیقاً به اندازهٔ دره برسی.', sections: [
      {len: 15, items: [q(4, 24), q(6, 16), q(8, 8), snail(9, 12), ...coins(9, 3, 1)]},
      {gap: 48, ruler: 0, remain: false},
      {len: 15, items: [splitter(4), q(8, 24), q(10, 12), snail(8, 12), ...coins(8, 3, 2)]},
      {gap: 36, ruler: 0, remain: false},
      {len: 15, items: [q(4, 24), q(7, 16), q(9, 16), snail(9, 12), ...coins(4, 3, 1)]},
      {gap: 56, ruler: 0, remain: false},
      {len: 15, items: [q(5, 12), q(8, 8), snail(9, 12), ...coins(4, 3, 2)]},
      {gap: 20, ruler: 0, remain: false},
      {len: 14, items: [...coins(3, 4, 1), ledge(8, 2, 1)]}]}
  ];
  const worlds = levels.map(compile);
  // Positions are derived once from the authored sections; ids are stable for this ruleset.
  function compile(level) {
    const w = {ground: [], gaps: [], blocks: [], steps: [], coins: [], crates: [], snails: [], splitters: [], width: 0};
    let p = 0, gaps = 0;
    for (const sec of level.sections) {
      if (sec.gap) {
        const n = ++gaps;
        w.gaps.push({id: 'g' + n, p0: p, p1: p + sec.gap * PX, value: sec.gap, label: sec.label || null, ruler: sec.ruler, remain: sec.remain});
        p += sec.gap * PX; continue;
      }
      const base = p;
      w.ground.push({x0: base, x1: base + sec.len * TILE, y0: GROUND, y1: VIEW_H + 400, kind: 'ground'});
      for (const it of sec.items) {
        const at = base + it.x * TILE;
        if (it.t === 'q') w.blocks.push({id: 'b' + (w.blocks.length + 1), x0: at, x1: at + TILE, y0: GROUND - 4 * TILE, y1: GROUND - 3 * TILE, give: it.give, kind: 'q'});
        if (it.t === 'step') w.steps.push({x0: at, x1: at + it.w * TILE, y0: GROUND - it.h * TILE, y1: GROUND, kind: 'step', h: it.h});
        if (it.t === 'coin') w.coins.push({id: 'c' + (w.coins.length + 1), p: at + TILE / 2, y: GROUND - it.h * TILE + TILE / 2 - 18});
        if (it.t === 'crate') w.crates.push({id: 'k' + (w.crates.length + 1), p: at + TILE / 2, give: it.give});
        if (it.t === 'snail') w.snails.push({id: 's' + (w.snails.length + 1), a: base + it.a * TILE, b: base + it.b * TILE});
        if (it.t === 'splitter') w.splitters.push({p: at + TILE / 2});
      }
      p += sec.len * TILE;
    }
    w.width = p; w.start = 2 * TILE; w.flag = p - 3 * TILE;
    return w;
  }
  const clone = v => JSON.parse(JSON.stringify(v));
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  function parts(v) { const whole = Math.floor(v / UNIT), rest = v % UNIT, g = gcd(rest, UNIT) || 1; return {whole, n: rest / g, d: UNIT / g}; }
  const faDigits = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  function text(v) { const f = parts(v); if (!f.n) return faDigits(f.whole); return (f.whole ? faDigits(f.whole) + ' و ' : '') + faDigits(f.n) + '/' + faDigits(f.d); }
  function gapText(g) { return g.label ? (g.label[1] === 1 ? faDigits(g.label[0]) : faDigits(g.label[0]) + '/' + faDigits(g.label[1])) : text(g.value); }
  function freshSnails(index) { return Object.fromEntries(worlds[index].snails.map(s => [s.id, {p: (s.a + s.b) / 2, dir: -1, dead: false}])); }
  function levelState(s, index) {
    const w = worlds[index];
    Object.assign(s, {level: index, phase: 'play', checkpoint: w.start, inventory: [], bridges: {}, locked: [], used: [], taken: [],
      snails: freshSnails(index), gapErrors: {}, levelScore: 0, levelErrors: 0, levelCoins: 0, levelMs: 0, intro: true,
      player: {p: w.start, y: GROUND, vx: 0, vy: 0, ground: true, face: 1, coyote: 0, buffer: 0, hurt: 0, auto: null}});
    return s;
  }
  function initial() {
    return levelState({schema: 1, score: 0, errors: 0, coins: 0, bridgesBuilt: 0, falls: 0, elapsedMs: 0, completed: [], outcome: null}, 0);
  }
  // Static solids are fixed per level; locked bridges become solid only when their total is exact.
  function solids(s) {
    const w = worlds[s.level], list = w.ground.concat(w.steps, w.blocks);
    for (const g of w.gaps) if (s.locked.includes(g.id)) list.push({x0: g.p0, x1: g.p1, y0: GROUND, y1: GROUND + 22, kind: 'bridge'});
    return list;
  }
  const overlap = (a, b) => a.x0 < b.x1 - .01 && a.x1 > b.x0 + .01 && a.y0 < b.y1 - .01 && a.y1 > b.y0 + .01;
  const box = pl => ({x0: pl.p - PHYS.half, x1: pl.p + PHYS.half, y0: pl.y - PHYS.height, y1: pl.y});
  function addScore(s, delta) { s.levelScore = Math.max(0, s.levelScore + delta); }
  function addPlank(s, v) { if (s.inventory.length < 30) { s.inventory.push(v); s.inventory.sort((a, b) => b - a); } }
  function zone(s) {
    if (s.phase !== 'play' || !s.player.ground || s.player.auto !== null) return null;
    const w = worlds[s.level], p = s.player.p;
    const gap = w.gaps.find(g => !s.locked.includes(g.id) && p >= g.p0 - 96 && p <= g.p0 + PHYS.half);
    if (gap) return {kind: 'build', gap};
    if (w.splitters.some(t => Math.abs(t.p - p) <= 44)) return {kind: 'split'};
    return null;
  }
  const sum = list => list.reduce((a, b) => a + b, 0);
  function place(s, v) {
    const z = zone(s);
    if (!z || z.kind !== 'build') return {ok: false, code: 'zone', message: 'برای چیدن تخته، کنار پایهٔ پل بایست.'};
    const at = s.inventory.indexOf(v);
    if (at < 0) return {ok: false, code: 'missing', message: 'این تخته را هنوز نداری.'};
    const g = z.gap, placed = s.bridges[g.id] || [], left = g.value - sum(placed);
    if (v > left) {
      s.levelErrors++; s.errors++; s.gapErrors[g.id] = (s.gapErrors[g.id] || 0) + 1; addScore(s, -SCORE.error);
      return {ok: false, code: 'long', gap: g.id, value: v, left, message: 'تختهٔ ' + text(v) + ' جا نمی‌شود؛ فقط ' + text(left) + ' جا مانده است.'};
    }
    s.inventory.splice(at, 1); s.bridges[g.id] = placed.concat(v);
    if (v < left) return {ok: true, locked: false, gap: g.id, left: left - v, message: g.remain ? 'هنوز ' + text(left - v) + ' مانده است.' : 'تخته سر جایش نشست؛ پل هنوز کامل نیست.'};
    s.locked.push(g.id); s.bridgesBuilt++;
    const clean = !s.gapErrors[g.id];
    addScore(s, SCORE.bridge + (clean ? SCORE.clean : 0));
    s.checkpoint = g.p1 + 60; s.player.auto = g.p1 + 60; s.player.vx = 0;
    return {ok: true, locked: true, clean, gap: g.id, message: s.bridges[g.id].map(text).join(' + ') + ' = ' + gapText(g)};
  }
  function takeBack(s) {
    const z = zone(s);
    if (!z || z.kind !== 'build') return false;
    const placed = s.bridges[z.gap.id];
    if (!placed?.length) return false;
    addPlank(s, placed.pop());
    if (!placed.length) delete s.bridges[z.gap.id];
    return true;
  }
  function split(s, v) {
    const z = zone(s);
    if (!z || z.kind !== 'split') return {ok: false, message: 'برای برش، کنار میز برش بایست.'};
    const at = s.inventory.indexOf(v);
    if (at < 0) return {ok: false, message: 'این تخته را هنوز نداری.'};
    if (!SPLIT[v] || s.inventory.length >= 30) return {ok: false, message: 'تختهٔ ' + text(v) + ' از این کوچک‌تر نمی‌شود.'};
    s.inventory.splice(at, 1); addPlank(s, SPLIT[v]); addPlank(s, SPLIT[v]);
    return {ok: true, message: text(v) + ' = ' + text(SPLIT[v]) + ' + ' + text(SPLIT[v])};
  }
  function respawn(s) {
    const pl = s.player;
    Object.assign(pl, {p: s.checkpoint, y: GROUND, vx: 0, vy: 0, ground: true, coyote: 0, buffer: 0, hurt: 900, auto: null});
  }
  // One fixed substep. input.dir: 1 forward (toward goal), -1 back. jump: held, jumpPressed: new press.
  function substep(s, input, dt, events) {
    const w = worlds[s.level], pl = s.player, sec = dt / 1000;
    let dir = input.dir || 0;
    if (pl.auto !== null) { dir = 1; if (pl.p >= pl.auto) { pl.auto = null; dir = 0; } }
    if (input.jumpPressed && pl.auto === null) pl.buffer = PHYS.buffer;
    const target = dir * PHYS.speed, accel = pl.ground ? PHYS.accelGround : PHYS.accelAir;
    if (pl.hurt <= 600 || pl.ground) pl.vx += Math.max(-accel * sec, Math.min(accel * sec, target - pl.vx));
    if (dir) pl.face = dir;
    if (pl.buffer > 0 && (pl.ground || pl.coyote > 0)) {
      pl.vy = -PHYS.jump; pl.ground = false; pl.coyote = 0; pl.buffer = 0; events.push({type: 'jump'});
    }
    if (!input.jump && pl.vy < -PHYS.jump * PHYS.cut && pl.auto === null) pl.vy = -PHYS.jump * PHYS.cut;
    pl.vy = Math.min(PHYS.maxFall, pl.vy + PHYS.gravity * sec);
    pl.buffer = Math.max(0, pl.buffer - dt); pl.coyote = Math.max(0, pl.coyote - dt); pl.hurt = Math.max(0, pl.hurt - dt);
    const list = solids(s), wasGround = pl.ground;
    pl.p += pl.vx * sec;
    for (const r of list) if (overlap(box(pl), r)) {
      pl.p = pl.vx > 0 ? r.x0 - PHYS.half - .001 : r.x1 + PHYS.half + .001; pl.vx = 0;
    }
    pl.p = Math.max(PHYS.half, Math.min(w.width - PHYS.half, pl.p));
    const prevY = pl.y;
    pl.y += pl.vy * sec; pl.ground = false;
    for (const r of list) if (overlap(box(pl), r)) {
      if (pl.vy >= 0) { pl.y = r.y0; pl.vy = 0; pl.ground = true; }
      else {
        pl.y = r.y1 + PHYS.height; pl.vy = 0;
        if (r.kind === 'q' && !s.used.includes(r.id)) {
          s.used.push(r.id);
          if (r.give === 'coin') { s.levelCoins++; s.coins++; addScore(s, SCORE.coin); }
          else addPlank(s, r.give);
          events.push({type: 'block', id: r.id, give: r.give});
        } else events.push({type: 'bump'});
      }
    }
    // Resting contact: a sub-pixel fall does not overlap, but the feet are still on that surface.
    if (!pl.ground && pl.vy >= 0) for (const r of list) if (Math.abs(r.y0 - pl.y) < .5 && pl.p + PHYS.half > r.x0 + .01 && pl.p - PHYS.half < r.x1 - .01) { pl.y = r.y0; pl.vy = 0; pl.ground = true; }
    if (wasGround && !pl.ground && pl.vy >= 0) pl.coyote = PHYS.coyote;
    if (!wasGround && pl.ground) events.push({type: 'land'});
    const me = box(pl);
    for (const c of w.coins) if (!s.taken.includes(c.id) && Math.abs(c.p - pl.p) < PHYS.half + 13 && c.y + 13 > me.y0 && c.y - 13 < me.y1) {
      s.taken.push(c.id); s.levelCoins++; s.coins++; addScore(s, SCORE.coin); events.push({type: 'coin', id: c.id});
    }
    for (const k of w.crates) if (!s.taken.includes(k.id) && Math.abs(k.p - pl.p) < PHYS.half + 20 && me.y1 > GROUND - 40) {
      s.taken.push(k.id); addPlank(s, k.give); events.push({type: 'crate', id: k.id, give: k.give});
    }
    for (const d of w.snails) {
      const sn = s.snails[d.id];
      if (sn.dead) continue;
      sn.p += sn.dir * 36 * sec;
      if (sn.p <= d.a) { sn.p = d.a; sn.dir = 1; } else if (sn.p >= d.b) { sn.p = d.b; sn.dir = -1; }
      const body = {x0: sn.p - 20, x1: sn.p + 20, y0: GROUND - 30, y1: GROUND};
      if (!overlap(box(pl), body)) continue;
      if (pl.vy > 0 && prevY <= body.y0 + 12) {
        sn.dead = true; pl.vy = -520; pl.ground = false; addScore(s, SCORE.stomp); events.push({type: 'stomp', id: d.id});
      } else if (pl.hurt <= 0) {
        pl.hurt = 1200; pl.vy = -380; pl.ground = false; pl.vx = (pl.p < sn.p ? -1 : 1) * 220; addScore(s, -SCORE.hurt); events.push({type: 'hurt'});
      }
    }
    if (pl.y > VIEW_H + 120) { s.falls++; addScore(s, -SCORE.fall); respawn(s); events.push({type: 'fall'}); }
    if (pl.ground && pl.p >= w.flag && pl.auto === null) clear(s, events);
  }
  function stars(errors) { return errors === 0 ? 3 : errors <= 2 ? 2 : 1; }
  function clear(s, events) {
    s.phase = 'cleared'; s.player.vx = 0;
    s.completed.push({id: levels[s.level].id, score: s.levelScore, errors: s.levelErrors, coins: s.levelCoins, stars: stars(s.levelErrors), seconds: Math.floor(s.levelMs / 1000)});
    s.score += s.levelScore;
    events.push({type: 'flag'});
  }
  function step(s, input, ms) {
    const events = [];
    if (s.phase !== 'play') return events;
    let left = Math.max(0, Math.min(100, ms)), first = true;
    s.elapsedMs = Math.min(4294967295, s.elapsedMs + left); s.levelMs = Math.min(4294967295, s.levelMs + left);
    while (left > 0 && s.phase === 'play') {
      const dt = Math.min(1000 / 120, left); left -= dt;
      substep(s, {...input, jumpPressed: first && input.jumpPressed}, dt, events); first = false;
    }
    return events;
  }
  function next(s) {
    if (s.phase !== 'cleared') return false;
    if (s.level === levels.length - 1) { s.phase = 'finished'; s.outcome = 'won'; return true; }
    levelState(s, s.level + 1);
    return true;
  }
  function metrics(s) {
    return {score: Math.min(100000, s.score), bridges: s.bridgesBuilt, errors: s.errors, coins: s.coins, seconds: Math.floor(s.elapsedMs / 1000)};
  }
  const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  const num = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  const ids = (list, valid) => Array.isArray(list) && list.length <= 200 && new Set(list).size === list.length && list.every(id => valid.includes(id));
  // A restored snapshot must describe a reachable state of this ruleset; anything else is rejected, never repaired silently.
  function validate(saved) {
    const s = clone(saved), bad = field => { throw Error('INVALID_STATE:' + field); };
    if (!s || s.schema !== 1) bad('schema');
    if (!int(s.level, 0, levels.length - 1)) bad('level');
    if (!['play', 'cleared', 'finished'].includes(s.phase)) bad('phase');
    const w = worlds[s.level], pl = s.player;
    for (const k of ['score', 'errors', 'coins', 'bridgesBuilt', 'falls', 'levelScore', 'levelErrors', 'levelCoins']) if (!int(s[k], 0, 1e7)) bad(k);
    if (!num(s.elapsedMs, 0, 4294967295) || !num(s.levelMs, 0, s.elapsedMs + 1)) bad('time');
    if (!pl || !num(pl.p, 0, w.width) || !num(pl.y, -2000, VIEW_H + 400) || !num(pl.vx, -400, 400) || !num(pl.vy, -1000, 1000)) bad('player');
    if (typeof pl.ground !== 'boolean' || ![1, -1].includes(pl.face) || !num(pl.coyote, 0, 1000) || !num(pl.buffer, 0, 1000) || !num(pl.hurt, 0, 2000)) bad('player');
    if (pl.auto !== null && !num(pl.auto, 0, w.width)) bad('auto');
    if (!num(s.checkpoint, 0, w.width) || typeof s.intro !== 'boolean') bad('checkpoint');
    if (!Array.isArray(s.inventory) || s.inventory.length > 30 || !s.inventory.every(v => PLANKS.includes(v))) bad('inventory');
    const gapIds = w.gaps.map(g => g.id);
    if (!ids(s.locked, gapIds) || !ids(s.used, w.blocks.map(b => b.id)) || !ids(s.taken, w.coins.concat(w.crates).map(c => c.id))) bad('ids');
    if (!s.bridges || typeof s.bridges !== 'object' || Array.isArray(s.bridges)) bad('bridges');
    for (const [id, list] of Object.entries(s.bridges)) {
      const g = w.gaps.find(x => x.id === id);
      if (!g || !Array.isArray(list) || !list.length || !list.every(v => PLANKS.includes(v)) || sum(list) > g.value) bad('bridge');
      if ((sum(list) === g.value) !== s.locked.includes(id)) bad('lock');
    }
    if (s.locked.some(id => !s.bridges[id])) bad('lock');
    if (!s.gapErrors || typeof s.gapErrors !== 'object' || Array.isArray(s.gapErrors) || Object.entries(s.gapErrors).some(([id, n]) => !gapIds.includes(id) || !int(n, 1, 1e6))) bad('gapErrors');
    if (!s.snails || typeof s.snails !== 'object' || Object.keys(s.snails).length !== w.snails.length) bad('snails');
    for (const d of w.snails) { const sn = s.snails[d.id]; if (!sn || !num(sn.p, d.a, d.b) || ![1, -1].includes(sn.dir) || typeof sn.dead !== 'boolean') bad('snail'); }
    const doneCount = s.phase === 'play' ? s.level : s.level + 1;
    if (!Array.isArray(s.completed) || s.completed.length !== doneCount) bad('completed');
    s.completed.forEach((r, i) => { if (!r || r.id !== levels[i].id || !int(r.score, 0, 1e7) || !int(r.errors, 0, 1e7) || !int(r.coins, 0, 1e4) || !int(r.stars, 1, 3) || !int(r.seconds, 0, 4294967)) bad('record'); });
    if (s.score !== s.completed.reduce((a, r) => a + r.score, 0)) bad('score');
    if ((s.phase === 'finished') !== (s.outcome === 'won') || (s.outcome !== null && s.outcome !== 'won')) bad('outcome');
    if (s.phase === 'finished' && s.level !== levels.length - 1) bad('finished');
    return s;
  }
  return {TILE, PX, UNIT, GROUND, VIEW_H, PHYS, PLANKS, SPLIT, SCORE, levels, worlds, parts, text, gapText, faDigits, initial, zone, place, takeBack, split, step, next, metrics, validate, solids, sum, stars};
})();
