import { describe, it, expect } from 'vitest';
import { createRepository, MigrationError } from '../src/data/repo.js';
import { MIGRATIONS } from '../src/data/schema.js';
import { normalizeState, countsOf } from '../src/data/model.js';
import { nodeDb, sampleState } from './helpers/env.js';

async function fresh(db = nodeDb(), opts = {}) {
  const repo = createRepository(db, opts);
  await repo.migrate();
  await repo.load();
  return { db, repo };
}

describe('zapis i odczyt z SQLite', () => {
  it('nowa baza: schemat i meta', async () => {
    const { repo } = await fresh();
    expect(await repo.schemaVersion()).toBe(MIGRATIONS.at(-1).version);
    expect(await repo.getMeta('created_at')).toBeTruthy();
  });
  it('stan -> baza -> stan: identyczna treść', async () => {
    const { repo } = await fresh();
    await repo.persist(sampleState());
    expect(await repo.load()).toEqual(normalizeState(sampleState()));
  });
  it('zachowuje nieznane pola i współrzędne co do bitu', async () => {
    const { repo } = await fresh();
    const s = sampleState();
    s.countries.PL.mood = { a: [1, 2] };
    s.places[0].tags = ['x'];
    s.places[0].lat = 0.1 + 0.2;
    s.journal = 'nowa sekcja';
    await repo.persist(s);
    const back = await repo.load();
    expect(back.countries.PL.mood).toEqual({ a: [1, 2] });
    expect(back.places[0].tags).toEqual(['x']);
    expect(back.places[0].lat).toBe(0.1 + 0.2);
    expect(back.journal).toBe('nowa sekcja');
  });
  it('tymczasowa pozycja pinezki (_s) nie powoduje zapisów ani nie trafia do bazy', async () => {
    const { db, repo } = await fresh();
    const s = sampleState();
    await repo.persist(s);
    s.places[0]._s = [1, 2];
    expect((await repo.persist(s)).changed).toBe(0);
    s.places[0]._s = [3, 4]; // obrót globu
    expect((await repo.persist(s)).changed).toBe(0);
    expect((await db.all("SELECT extra FROM places WHERE id = 'p1'"))[0].extra).toBe(null);
  });
  it('zapisuje tylko zmiany', async () => {
    const { repo } = await fresh();
    const s = sampleState();
    await repo.persist(s);
    expect((await repo.persist(s)).changed).toBe(0);
    s.countries.PT.notes = 'nowa notatka';
    expect((await repo.persist(s)).changed).toBe(1);
  });
  it('usuwanie kraju usuwa też jego wizyty, a kolejność miejsc zostaje', async () => {
    const { repo } = await fresh();
    const s = sampleState();
    await repo.persist(s);
    delete s.countries.PT;
    s.places.reverse();
    await repo.persist(s);
    const back = await repo.load();
    expect(back.countries.PT).toBeUndefined();
    expect(back.places.map((p) => p.id)).toEqual(['p2', 'p1']);
    expect(countsOf(back).visits).toBe(0);
  });
  it('awaria w trakcie zapisu: nic się nie zmienia (transakcja)', async () => {
    const { db, repo } = await fresh();
    await repo.persist(sampleState());
    const s = sampleState();
    s.countries.PL.notes = 'A';
    s.places[1].note = 'B';
    db.failOn = /INSERT OR REPLACE INTO places/;
    await expect(repo.persist(s)).rejects.toThrow();
    db.failOn = null;
    expect((await repo.load()).countries.PL.notes).toBe('Dom');
  });
  it('kopia przed masowym usuwaniem (3+ krajów lub miejsc)', async () => {
    const { repo } = await fresh();
    const s = sampleState();
    await repo.persist(s);
    let called = 0;
    s.countries = {}; // 3 kraje
    await repo.persist(s, { beforeMassDelete: async () => { called++; } });
    expect(called).toBe(1);
  });
  it('replaceAll zastępuje wszystko i sprawdza liczności', async () => {
    const { repo } = await fresh();
    await repo.persist(sampleState());
    const other = { countries: { FR: { visited: true } }, places: [] };
    const back = await repo.replaceAll(other);
    expect(Object.keys(back.countries)).toEqual(['FR']);
    expect(back.places).toEqual([]);
  });
});

describe('migracje: wersja N -> N+1', () => {
  const V2 = [...MIGRATIONS, {
    version: MIGRATIONS.at(-1).version + 1,
    name: 'test: nowe pole i tabela',
    statements: [
      "ALTER TABLE places ADD COLUMN opening_hours TEXT NOT NULL DEFAULT ''",
      'CREATE TABLE IF NOT EXISTS trips (id TEXT PRIMARY KEY NOT NULL, name TEXT)',
    ],
  }];
  const N = MIGRATIONS.at(-1).version;

  it('identyczne liczności i treść po migracji, kopia przed migracją', async () => {
    const db = nodeDb();
    const { repo } = await fresh(db);
    await repo.persist(sampleState());
    const before = await repo.load();

    const calls = [];
    const repo2 = createRepository(db, { migrations: V2 });
    const r = await repo2.migrate({ beforeMigrate: async (from, to) => { calls.push([from, to]); return 'kopia.json'; } });
    expect(r).toMatchObject({ status: 'migrated', from: N, to: N + 1, backup: 'kopia.json' });
    expect(calls).toEqual([[N, N + 1]]);
    expect(await repo2.schemaVersion()).toBe(N + 1);
    const after = await repo2.load();
    expect(after).toEqual(before);
    // nowa kolumna jest, stare dane nietknięte
    const cols = (await db.all('PRAGMA table_info(places)')).map((c) => c.name);
    expect(cols).toContain('opening_hours');
    // i można dalej zapisywać
    after.countries.PL.notes = 'po migracji';
    await repo2.persist(after);
    expect((await repo2.load()).countries.PL.notes).toBe('po migracji');
  });

  it('brak kopii = brak migracji', async () => {
    const db = nodeDb();
    const { repo } = await fresh(db);
    await repo.persist(sampleState());
    const repo2 = createRepository(db, { migrations: V2 });
    await expect(repo2.migrate({ beforeMigrate: async () => { throw new Error('dysk pełny'); } })).rejects.toThrow(MigrationError);
    expect(await repo2.schemaVersion()).toBe(N);
  });

  it('błąd w migracji: baza wraca do stanu sprzed migracji', async () => {
    const db = nodeDb();
    const { repo } = await fresh(db);
    await repo.persist(sampleState());
    const broken = [...MIGRATIONS, { version: N + 1, name: 'zepsuta', statements: ['ALTER TABLE places ADD COLUMN x TEXT', 'TO NIE JEST SQL'] }];
    const repo2 = createRepository(db, { migrations: broken });
    await expect(repo2.migrate({ beforeMigrate: async () => 'kopia.json' })).rejects.toMatchObject({ name: 'MigrationError', backup: 'kopia.json', from: N, to: N + 1 });
    expect(await repo2.schemaVersion()).toBe(N);
    expect((await db.all('PRAGMA table_info(places)')).map((c) => c.name)).not.toContain('x');
    expect(await createRepository(db).load()).toEqual(normalizeState(sampleState()));
  });

  it('migracja gubiąca dane jest wycofywana (kontrola liczności)', async () => {
    const db = nodeDb();
    const { repo } = await fresh(db);
    await repo.persist(sampleState());
    const lossy = [...MIGRATIONS, { version: N + 1, name: 'gubi miejsca', statements: ["DELETE FROM places WHERE status = 'planned'"] }];
    const repo2 = createRepository(db, { migrations: lossy });
    await expect(repo2.migrate({ beforeMigrate: async () => 'k.json' })).rejects.toThrow(/Liczności/);
    expect((await createRepository(db).load()).places).toHaveLength(2);
    expect(await repo2.schemaVersion()).toBe(N);
  });

  it('baza z nowszej wersji aplikacji: nic nie robimy', async () => {
    const db = nodeDb();
    await fresh(db, { migrations: V2 });
    const r = await createRepository(db).migrate();
    expect(r.status).toBe('newer');
  });
});
