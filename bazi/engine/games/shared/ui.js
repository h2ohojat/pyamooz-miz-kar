export function createGameUI({restore, snapshot, render, metrics, outcome}) {
    const manifest = JSON.parse(document.querySelector('#pyamooz-game-meta').textContent);
    const fa = (n) => new Intl.NumberFormat('fa').format(n);
    let bridge, paused = true, tick = performance.now(), elapsed = 0, terminal = false;
    const settle = () => { const now = performance.now(); if (!paused && !terminal) elapsed += Math.max(0, now - tick); tick = now; };
    const status = (value) => { document.querySelector('#status').textContent = ({server:'در حساب ذخیره شد.',local:'در همین مرورگر ذخیره شد.',preview:'پیش‌نمایش؛ ذخیرهٔ حساب انجام نمی‌شود.',ready:'برای شروع یا ادامه آماده است.',finished:'این دور تمام شد.',OFFLINE:'ارتباط قطع است؛ صفحه را نبند.',STORAGE_UNAVAILABLE:'حافظه در دسترس نیست؛ صفحه را نبند.',STATE_CONFLICT:'ذخیرهٔ تازه‌تری وجود دارد؛ از نوار بالای سایت بازیابی کن.'})[value] || ''; };
    const view = () => { document.documentElement.dataset.paused = String(paused); render?.({paused, elapsed: Math.floor(elapsed), fa}); };
    bridge = createGameBridge({manifest,
        restore(saved, settings) { elapsed = saved?.elapsed || 0; terminal = !!saved?.ended; restore(saved, settings); view(); },
        snapshot() { settle(); return {...snapshot(), elapsed: Math.min(4294967295,Math.floor(elapsed)), ended: terminal}; },
        pause(value) { settle(); paused = value; view(); },
        preferences(value) { document.documentElement.dataset.theme = value.theme === 'dark' ? 'dark' : 'light'; document.documentElement.dataset.reducedMotion = String(!!value.reducedMotion); }, status,
    });
    const ui = {get paused() { return paused || terminal; }, get elapsed() { settle(); return Math.floor(elapsed); }, fa,
        changed() { view(); if (outcome?.()) ui.finish(outcome()); else bridge.save(); },
        finish(result) { if (terminal) return; settle(); terminal = true; bridge.finish(result, metrics(), Math.min(4294967295,Math.floor(elapsed))); view(); },
    };
    const resume = document.querySelector('#standalone-resume');
    resume.hidden = bridge.embedded; resume.addEventListener('click', () => bridge.resume());
    setInterval(() => { if (!paused && !terminal) { settle(); view(); } }, 1000);
    setInterval(() => { if (!paused && !terminal) bridge.save(); }, 10000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) bridge.stop(); });
    return ui;
}
