/** Active-time scheduler for adapted games. SDK retries keep using the wall clock. */
export function createLegacyClock() {
    let elapsed = 0, paused = true, serial = 0;
    const jobs = new Map();
    const schedule = (fn, delay, repeat = 0) => {
        const id = ++serial;
        jobs.set(id, {fn, at: elapsed + Math.max(1, delay || 0), repeat});
        return id;
    };
    return {
        now: () => elapsed,
        get paused() { return paused; },
        pause(value) { paused = !!value; },
        restore(value) { elapsed = Number.isFinite(value) ? Math.max(0, value) : 0; jobs.clear(); },
        timeout: (fn, ms) => schedule(fn, ms),
        interval: (fn, ms) => schedule(fn, ms, Math.max(1, ms)),
        frame: (fn) => schedule(fn, 16),
        clear: (id) => jobs.delete(id),
        advance(ms) {
            if (paused) return;
            elapsed += Math.max(0, Math.min(100, ms));
            for (const [id, job] of [...jobs]) {
                if (job.at > elapsed || !jobs.has(id)) continue;
                if (job.repeat) job.at = elapsed + job.repeat; else jobs.delete(id);
                job.fn(elapsed);
            }
        },
    };
}

export function legacyPlain(value) {
    return JSON.parse(JSON.stringify(value, (key, item) => {
        if (['el', 'L', 'timer', 'run', 'hintFn', 'benchRestore'].includes(key)) return undefined;
        if (typeof item === 'function') return undefined;
        if (item instanceof Set) return [...item];
        return item;
    }));
}

/** Binds an existing game without replacing browser timers used by the bridge. */
export function connectLegacyGame({clock, restore, snapshot, audio, preferences, finished}) {
    const manifest = JSON.parse(document.querySelector('#pyamooz-game-meta').textContent);
    const statusEl = document.querySelector('#legacy-status');
    let animations = [], last = performance.now(), savedAt = 0;
    const bridge = createGameBridge({manifest,
        restore(value) { clock.restore(value?.elapsed || 0); restore(value); },
        snapshot() { return {...snapshot(), elapsed: Math.min(4294967295, Math.floor(clock.now()))}; },
        pause(value) {
            clock.pause(value); document.documentElement.dataset.paused = String(value);
            const ac = audio(); if (ac && value) ac.suspend().catch(() => {});
            if (value) { animations = document.getAnimations().filter(a => a.playState === 'running'); animations.forEach(a => a.pause()); }
            else { animations.forEach(a => a.play()); animations = []; }
        },
        preferences(value) {
            document.documentElement.dataset.theme = value.theme || 'dark';
            document.documentElement.dataset.reducedMotion = String(!!value.reducedMotion);
            if (value.reducedMotion) document.getAnimations().forEach(a => { try { a.finish(); } catch { a.cancel(); } });
            preferences(value);
        },
        status(code) {
            statusEl.textContent = ({ready:'بازی آماده است',server:'در حساب ذخیره شد',local:'در این مرورگر ذخیره شد',preview:'پیش‌نمایش؛ بدون ثبت حساب',finished:'نتیجه ثبت شد',OFFLINE:'ارتباط قطع است؛ صفحه را نبند',STATE_CONFLICT:'ذخیرهٔ دیگری وجود دارد؛ از نوار سایت بازیابی کن',STORAGE_UNAVAILABLE:'ذخیره در دسترس نیست؛ صفحه را نبند',INVALID_MESSAGE:'ذخیره قابل بازیابی نیست؛ از نوار سایت دور تازه بساز'})[code] || code;
        },
    });
    const resume = document.querySelector('#legacy-resume');
    resume.hidden = bridge.embedded; resume.onclick = () => bridge.resume();
    for (const name of ['click','pointerdown','pointerup','keydown','input']) {
        window.addEventListener(name, e => {
            if ((clock.paused || finished()) && e.target !== resume) { e.preventDefault(); e.stopImmediatePropagation(); }
            else queueMicrotask(() => bridge.save());
        }, true);
    }
    setInterval(() => {
        const now = performance.now(); clock.advance(now-last); last=now;
        if (!clock.paused && clock.now()-savedAt >= 2000) { savedAt=clock.now(); bridge.save(); }
    }, 16);
    document.addEventListener('visibilitychange', () => { if (document.hidden) bridge.stop(); });
    return bridge;
}
