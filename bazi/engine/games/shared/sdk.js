import { GAME_NS, gameCopy, gameObject, gameInteger, gameId, gameMetrics, gameReceipt, gameToken } from './protocol.js';

/** One in-flight receipt; checkpoints keep newer moves recoverable while its acknowledgement is delayed. */
export function createGameBridge({manifest, restore, snapshot, pause = () => {}, preferences = () => {}, status = () => {},
    win = globalThis.window, clock = globalThis, token = gameToken}) {
    const session = token();
    let context = null;
    let pending = null;
    let latest = null;
    let terminal = null;
    let seq = 0;
    let revision = 0;
    let finished = false;
    let stopped = false;
    let timer = null;
    let origin = '*';
    const embedded = win.parent !== win;
    const post = (data) => win.parent.postMessage({ns: GAME_NS, v: 1, session, ...data}, origin);
    const hello = () => post({kind: 'hello', game: {id: manifest.id, version: manifest.version}, capabilities: manifest.capabilities});
    const schedule = () => {
        clock.clearTimeout(timer);
        if (!stopped && embedded) timer = clock.setTimeout(() => { if (!context) hello(); else if (pending) post(pending); schedule(); }, 2500);
    };
    const checkpoint = () => {
        if (embedded && context && latest) post({kind: 'checkpoint', runId: context.runId, afterSeq: seq, baseRevision: revision,
            stateSchemaVersion: manifest.stateSchemaVersion, state: latest, terminal});
    };
    const pump = () => {
        if (!context || pending || !latest || stopped || finished) return;
        const packet = {kind: terminal ? 'result' : 'state', runId: context.runId, seq: ++seq, baseRevision: revision,
            stateSchemaVersion: manifest.stateSchemaVersion, state: latest, ...(terminal || {})};
        latest = null;
        pending = gameCopy({ns: GAME_NS, v: 1, session, ...packet});
        if (embedded) post(pending);
        else {
            // Standalone never claims account persistence.
            try { win.localStorage.setItem('pyamooz:standalone:' + manifest.id, JSON.stringify({version: manifest.version, state: packet.state, terminal})); status('local'); }
            catch { status('STORAGE_UNAVAILABLE'); }
            revision++;
            finished = !!terminal;
            pending = null;
        }
    };
    const capture = () => {
        if (!context || finished || stopped) return false;
        try {
            const next = gameCopy(snapshot());
            if (!gameObject(next)) throw new Error('INVALID_MESSAGE');
            latest = next;
            checkpoint();
            pump();
            return true;
        } catch (error) { status(error.message); return false; }
    };
    const receive = (event) => {
        if (!embedded || event.source !== win.parent || (origin !== '*' && event.origin !== origin)) return;
        const p = event.data;
        if (!gameObject(p) || p.ns !== GAME_NS || p.v !== 1 || p.session !== session) return;
        if (p.kind === 'init') {
            if (context || !gameId(p.runId) || p.stateSchemaVersion !== manifest.stateSchemaVersion || !gameInteger(p.stateRevision)
                || !['account', 'guest', 'none'].includes(p.persist) || (p.state !== null && !gameObject(p.state))) return;
            try {
                context = gameCopy(p);
                revision = p.stateRevision;
                origin = event.origin;
                preferences(p.preferences || {});
                restore(p.state, p.settings || {});
                pause(true);
                if (p.terminal) terminal = gameCopy(p.terminal);
                finished = p.status === 'final';
                if (!finished) capture();
                status(finished ? 'finished' : 'ready');
            } catch { stopped = true; status('INVALID_MESSAGE'); }
            return;
        }
        if (!context || p.runId !== context.runId) return;
        if (p.kind === 'ack' && pending && gameReceipt(p, pending)) {
            const wasFinal = pending.kind === 'result';
            revision = p.stateRevision;
            pending = null;
            status(context.persist === 'none' ? 'preview' : p.stored);
            if (wasFinal) { finished = true; pause(true); status('finished'); }
            else pump();
        } else if (p.kind === 'command') {
            if (p.command === 'snapshot') capture();
            if (p.command === 'pause') { pause(true); capture(); }
            if (p.command === 'resume' && !stopped && !finished) pause(false);
            if (p.command === 'preferences') preferences(p.preferences || {});
        } else if (p.kind === 'error') {
            status(typeof p.code === 'string' ? p.code : 'INVALID_MESSAGE');
            if (['STATE_CONFLICT', 'RUN_FINISHED', 'ACCESS_REVOKED', 'INVALID_MESSAGE'].includes(p.code)) {
                stopped = true; pause(true); clock.clearTimeout(timer);
            }
        }
    };
    win.addEventListener('message', receive);
    if (embedded) { hello(); schedule(); }
    else {
        let saved = null;
        try { const value = JSON.parse(win.localStorage.getItem('pyamooz:standalone:' + manifest.id)); if (value?.version === manifest.version) saved = value; } catch { /* Storage is optional. */ }
        context = {runId: token(), persist: 'none'};
        restore(saved?.state || null, Object.fromEntries((manifest.settings || []).map((s) => [s.id, s.default])));
        finished = !!saved?.terminal;
        pause(true);
        status('ready');
    }
    return {
        save: capture,
        finish(outcome, metrics, elapsedMs) {
            if (!context || finished || stopped || terminal) return false;
            if (!['won', 'lost', 'completed', 'abandoned'].includes(outcome) || !gameMetrics(metrics, manifest) || !gameInteger(elapsedMs, 0, 4294967295)) return false;
            terminal = {resultId: token(), outcome, metrics: gameCopy(metrics), elapsedMs};
            pause(true);
            return capture();
        },
        resume() { if (!stopped && !finished) pause(false); },
        stop() { pause(true); capture(); },
        get embedded() { return embedded; },
        destroy() { stopped = true; clock.clearTimeout(timer); win.removeEventListener('message', receive); },
    };
}
