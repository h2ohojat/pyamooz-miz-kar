export const GAME_NS = 'pyamooz-game';
export const GAME_MAX_BYTES = 262144;
export const gameId = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(value);
export const gameObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
export const gameInteger = (value, min = 0, max = 2147483647) => Number.isInteger(value) && value >= min && value <= max;

export function gameCopy(value) {
    const visit = (item, depth = 0) => {
        if (depth > 24) throw new Error('INVALID_MESSAGE');
        if (item === null || typeof item === 'string' || typeof item === 'boolean') return;
        if (typeof item === 'number' && Number.isFinite(item)) return;
        if (Array.isArray(item) || gameObject(item)) {
            for (const [key, child] of Object.entries(item)) {
                if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('INVALID_MESSAGE');
                visit(child, depth + 1);
            }
            return;
        }
        throw new Error('INVALID_MESSAGE');
    };
    visit(value);
    const json = JSON.stringify(value);
    if (new TextEncoder().encode(json).length > GAME_MAX_BYTES) throw new Error('STATE_TOO_LARGE');
    return JSON.parse(json);
}

export function gameMetrics(metrics, manifest) {
    if (!gameObject(metrics) || Object.keys(metrics).length !== manifest.metrics.length) return false;
    return manifest.metrics.every((m) => {
        const n = metrics[m.id];
        return typeof n === 'number' && Number.isFinite(n) && (m.type !== 'integer' || Number.isInteger(n)) && n >= m.min && n <= (m.max ?? 1e12);
    });
}

export function gamePacket(value, manifest) {
    try {
        const p = gameCopy(value);
        if (!gameObject(p) || p.ns !== GAME_NS || p.v !== 1 || !gameId(p.session) || !gameId(p.runId)
            || !['state', 'result'].includes(p.kind) || !gameInteger(p.seq, 1) || !gameInteger(p.baseRevision, 0, 2147483646)
            || p.stateSchemaVersion !== manifest.stateSchemaVersion || !gameObject(p.state)) return null;
        if (p.kind === 'result' && (!gameId(p.resultId) || !['won', 'lost', 'completed', 'abandoned'].includes(p.outcome)
            || !gameInteger(p.elapsedMs, 0, 4294967295) || !gameMetrics(p.metrics, manifest))) return null;
        return p;
    } catch { return null; }
}

export function gameReceipt(ack, packet) {
    return ack?.ns === GAME_NS && ack.v === 1 && ack.kind === 'ack' && ack.session === packet.session && ack.runId === packet.runId
        && ack.for === packet.kind && ack.seq === packet.seq && ack.stateRevision === packet.baseRevision + 1
        && ['server', 'local'].includes(ack.stored) && (packet.kind !== 'result' || ack.resultId === packet.resultId);
}

export function gameToken() {
    return globalThis.crypto.randomUUID();
}
