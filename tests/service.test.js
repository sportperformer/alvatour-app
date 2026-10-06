import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createDataService } from '../src/data/service.js';
import { MIGRATIONS } from '../src/data/schema.js';
import { normalizeState, countsOf } from '../src/data/model.js';
import { parseBackup } from '../src/data/format.js';
import { nodeDb, memoryFs, clock, memoryStorage, sampleState, DAY, HOUR } from './helpers/env.js';

const fixture = (n) => readFileSync(new URL('./fixtures/' + n, import.meta.url), 'utf8');

function setup(over = {}) {
  const env = { db: nodeDb(), fs: memoryFs(), now: clock(), appVersion: '1.0.0', ...over };
  env.svc = createDataService(env);
  env.restart = (more = {}) => { env.svc = createDataService({ ...env, ...more }); return env.svc; };
  return env;
}
const names = (fs, loc = 'public') => [...fs.files[loc].keys()];

describe('start aplikacji', () => {
  it('pierwsze uruchomienie: pusta baza, bez kopii, bez komunikatów', async () => {
    const env = setup();
    const r = await env.svc.init();
    expect(r.readOnly).toBe(null);
    expect(r.notices).toEqual([]);
    expect(countsOf(r.state).countries).toBe(0);
    expect(names(env.fs)).toEqual([]);
  });

  it('dane przetrwają restart', async () => {
    const env = setup();
    await env.svc.init();
    await env.svc.persist(sampleState());
    const r = await env.restart().init();
    expect(r.state).toEqual(normalizeState(sampleState()));
  });

  it('kopia przy starcie, gdy ostatnia ma ponad 24 h', async () => {
    const env = setup();
    await env.svc.init();
    await env.svc.persist(sampleState());
    await env.restart().init();
    expect(names(env.fs).filter((n) => n.startsWith('alvatour-auto-'))).toHaveLength(1);
    env.now.advance(5 * HOUR);
    await env.restart().init();
    expect(names(env.fs).filter((n) => n.startsWith('alvatour-auto-'))).toHaveLength(1);
    env.now.advance(DAY);
    await env.restart().init();
    expect(names(env.fs).filter((n) => n.startsWith('alvatour-auto-'))).toHaveLength(2);
    expect(names(env.fs, 'internal').filter((n) => n.startsWith('alvatour-auto-'))).toHaveLength(2);
    const p = await parseBackup(env.fs.files.public.get(names(env.fs)[0]));
    expect(p.ok).toBe(true);
    expect(p.state).toEqual(normalizeState(sampleState()));
  });

  it('kopia przy wyjściu z aplikacji: po zmianach, najwyżej raz na godzinę', async () => {
    const env = setup();
    await env.svc.init();
    await env.svc.persist(sampleState());
    await env.svc.onPause();
    expect(names(env.fs)).toHaveLength(1);
    const s = sampleState(); s.countries.PL.notes = 'x';
    await env.svc.persist(s);
    env.now.advance(30 * 60 * 1000);
    await env.svc.onPause();
    expect(names(env.fs)).toHaveLength(1);
    env.now.advance(31 * 60 * 1000);
    await env.svc.onPause();
    expect(names(env.fs)).toHaveLength(2);
    env.now.advance(2 * HOUR);
    await env.svc.onPause(); // bez zmian: bez kopii
    expect(names(env.fs)).toHaveLength(2);
  });

  it('aktualizacja schematu N -> N+1: kopia przed migracją i te same dane', async () => {
    const env = setup();
    await env.svc.init();
    await env.svc.persist(sampleState());
    const V2 = [...MIGRATIONS, { version: MIGRATIONS.length + 1, name: 'test', statements: ["ALTER TABLE countries ADD COLUMN color TEXT NOT NULL DEFAULT ''"] }];
    const r = await env.restart({ migrations: V2, appVersion: '1.0.1' }).init();
    expect(r.readOnly).toBe(null);
    expect(r.notices.find((n) => n.type === 'migrated')).toMatchObject({ from: 1, to: 2 });
    const pre = names(env.fs).find((n) => n.startsWith('pre-migration-v1-to-v2-'));
    expect(pre).toBeTruthy();
    const p = await parseBackup(env.fs.files.public.get(pre));
    expect(p.state).toEqual(normalizeState(sampleState()));
    expect(r.state).toEqual(normalizeState(sampleState()));
  });

  it('nieudana migracja: tryb tylko do odczytu, dane nietknięte, zapis zablokowany', async () => {
    const env = setup();
    await env.svc.init();
    await env.svc.persist(sampleState());
    const bad = [...MIGRATIONS, { version: MIGRATIONS.length + 1, name: 'zła', statements: ['ZEPSUTE SQL'] }];
    const svc = env.restart({ migrations: bad });
    const r = await svc.init();
    expect(r.readOnly).toBe('migration');
    expect(r.notices[0]).toMatchObject({ type: 'read-only', reason: 'migration' });
    expect(r.notices[0].backup).toMatch(/^pre-migration-v1-to-v2-/);
    expect(r.state).toEqual(normalizeState(sampleState()));
    expect(await svc.persist({ countries: {} })).toBe(false);
    expect((await env.restart().init()).state).toEqual(normalizeState(sampleState()));
  });

  it('dane z wersji testowej 1.0 (localStorage) przenoszą się raz i nie są kasowane', async () => {
    const storage = memoryStorage({ 'alvatour-v1': JSON.stringify(sampleState()) });
    const env = setup({ legacyStorage: storage });
    const r = await env.svc.init();
    expect(r.notices.find((n) => n.type === 'legacy-imported')).toBeTruthy();
    expect(r.state).toEqual(normalizeState(sampleState()));
    expect(names(env.fs).some((n) => n.startsWith('z-pamieci-webview-'))).toBe(true);
    expect(storage.getItem('alvatour-v1')).toBeTruthy();
    // po świadomym wyczyszczeniu nie wraca
    await env.svc.beforeWipe();
    await env.svc.persist({ countries: {}, places: [] });
    const r2 = await env.restart().init();
    expect(countsOf(r2.state).countries).toBe(0);
  });

  it('pusta baza, a jest kopia z danymi: pyta o przywrócenie', async () => {
    const env = setup();
    await env.svc.init();
    await env.svc.persist(sampleState());
    await env.svc.backupNow();
    // np. dane aplikacji wyczyszczone w ustawieniach Androida, kopie zostały
    const env2 = setup({ fs: env.fs, now: env.now });
    const r = await env2.svc.init();
    const offer = r.notices.find((n) => n.type === 'offer-restore');
    expect(offer).toBeTruthy();
    expect(offer.text).toBe('2 kraje, 1 marzenie, 2 miejsca, 4 notatki');
    await env2.svc.declineRestore();
    expect((await env2.restart().init()).notices.find((n) => n.type === 'offer-restore')).toBeUndefined();
  });

  it('nie da się otworzyć bazy: błąd, a nie pusta aplikacja', async () => {
    const env = setup();
    env.db.exec = async () => { throw new Error('baza niedostępna'); };
    await expect(env.svc.init()).rejects.toThrow('baza niedostępna');
  });
});

describe('import i eksport', () => {
  it('eksport zawiera wszystko i oznacza datę eksportu', async () => {
    const env = setup();
    await env.svc.init();
    await env.svc.persist(sampleState());
    const e = await env.svc.exportAll();
    expect(e.name).toBe('alvatour-kopia-2026-10-06.json');
    expect(e.counts).toEqual(countsOf(normalizeState(sampleState())));
    expect((await parseBackup(e.text)).state).toEqual(normalizeState(sampleState()));
    await env.svc.markExported();
    expect((await env.svc.status()).lastExportAt).toBeTruthy();
  });

  it('import pliku z wersji webowej: podgląd, kopia przed, wczytanie, cofnięcie', async () => {
    const env = setup();
    await env.svc.init();
    await env.svc.persist(sampleState());
    const prev = await env.svc.previewImport(fixture('web-alvatour-v1-export.json'));
    expect(prev.ok).toBe(true);
    expect(prev.text).toBe('3 kraje, 1 marzenie, 2 miejsca, 3 notatki');
    expect(prev.info.exportedAt).toBe('2026-09-30T18:22:05.114Z');

    const s = await env.svc.applyImport(prev);
    expect(Object.keys(s.countries).sort()).toEqual(['HR', 'IS', 'PL', 'VA']);
    const safety = names(env.fs).find((n) => n.startsWith('przed-importem-'));
    expect(safety).toBeTruthy();
    expect((await env.svc.status()).lastImport).toBe(safety);

    const undone = await env.svc.undoImport();
    expect(undone).toEqual(normalizeState(sampleState()));
    expect((await env.restart().init()).state).toEqual(normalizeState(sampleState()));
  });

  it('błędny plik nie zmienia niczego', async () => {
    const env = setup();
    await env.svc.init();
    await env.svc.persist(sampleState());
    const prev = await env.svc.previewImport('{"zly":1}');
    expect(prev.ok).toBe(false);
    await expect(env.svc.applyImport(prev)).rejects.toThrow();
    expect((await env.restart().init()).state).toEqual(normalizeState(sampleState()));
  });

  it('usunięcie wielu krajów naraz robi kopię tuż przed', async () => {
    const env = setup();
    await env.svc.init();
    await env.svc.persist(sampleState());
    const s = sampleState();
    s.countries = {};
    await env.svc.persist(s);
    const del = names(env.fs).find((n) => n.startsWith('przed-usunieciem-'));
    expect(del).toBeTruthy();
    expect(countsOf((await parseBackup(env.fs.files.public.get(del))).state).countries).toBe(2);
  });

  it('przypomnienie o kopii poza telefonem po 7 dniach od ostatniego eksportu', async () => {
    const env = setup();
    await env.svc.init();
    await env.svc.persist(sampleState());
    env.now.advance(8 * DAY);
    let r = await env.restart().init();
    expect(r.notices.find((n) => n.type === 'export-reminder')).toBeTruthy();
    await env.svc.reminderShown();
    r = await env.restart().init();
    expect(r.notices.find((n) => n.type === 'export-reminder')).toBeUndefined();
    await env.svc.markExported();
    env.now.advance(8 * DAY);
    r = await env.restart().init();
    expect(r.notices.find((n) => n.type === 'export-reminder')).toBeUndefined(); // bez zmian od eksportu
  });
});
