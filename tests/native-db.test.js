// Atrapa wtyczki CapacitorSQLite (te same nazwy metod i parametrów co na Androidzie) na prawdziwym SQLite.
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { createNativeDb } from '../src/data/native-db.js';
import { createDataService } from '../src/data/service.js';
import { normalizeState } from '../src/data/model.js';
import { memoryFs, clock, sampleState } from './helpers/env.js';

function fakePlugin() {
  const dbs = new Map();
  const conns = new Set();
  const need = (o, ...keys) => { for (const k of keys) if (!(k in o)) throw new Error(`brak parametru ${k}`); };
  const get = (o) => { need(o, 'database'); const d = dbs.get(o.database); if (!d) throw new Error('baza nieotwarta'); return d; };
  return {
    calls: [],
    async createConnection(o) { need(o, 'database', 'version', 'encrypted', 'mode', 'readonly'); if (conns.has(o.database)) throw new Error(`Connection ${o.database} already exists`); conns.add(o.database); },
    async open(o) { need(o, 'database'); if (!conns.has(o.database)) throw new Error('brak połączenia'); if (!dbs.has(o.database)) dbs.set(o.database, new DatabaseSync(':memory:')); },
    async execute(o) { need(o, 'statements', 'transaction'); expect(o.transaction).toBe(false); get(o).exec(o.statements); return { changes: { changes: 0 } }; },
    async run(o) { need(o, 'statement', 'values', 'transaction'); expect(Array.isArray(o.values)).toBe(true); get(o).prepare(o.statement).run(...o.values); return { changes: { changes: 1 } }; },
    async query(o) { need(o, 'statement', 'values'); return { values: get(o).prepare(o.statement).all(...o.values).map((r) => ({ ...r })) }; },
    async beginTransaction(o) { get(o).exec('BEGIN'); return { changes: { changes: 0 } }; },
    async commitTransaction(o) { get(o).exec('COMMIT'); return { changes: { changes: 0 } }; },
    async rollbackTransaction(o) { get(o).exec('ROLLBACK'); return { changes: { changes: 0 } }; },
  };
}

describe('adapter natywnej wtyczki SQLite', () => {
  it('pełny cykl serwisu przez wywołania wtyczki', async () => {
    const plugin = fakePlugin();
    const db = createNativeDb(plugin);
    await db.open();
    await db.open(); // drugie otwarcie (przeładowanie widoku) nie może się wysypać
    const env = { db, fs: memoryFs(), now: clock(), appVersion: '1.0.0' };
    const svc = createDataService(env);
    await svc.init();
    await svc.persist(sampleState());
    const r = await createDataService(env).init();
    expect(r.state).toEqual(normalizeState(sampleState()));
  });
});
