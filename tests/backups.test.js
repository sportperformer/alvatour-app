import { describe, it, expect } from 'vitest';
import { planRotation, parseBackupName, backupName, createBackups } from '../src/data/backups.js';
import { memoryFs, DAY, HOUR } from './helpers/env.js';

const at = (iso) => new Date(iso);
const autoName = (d) => backupName('auto', d);

describe('nazwy kopii', () => {
  it('format nazw', () => {
    const d = new Date(2026, 9, 6, 14, 3, 9);
    expect(backupName('auto', d)).toBe('alvatour-auto-2026-10-06-140309.json');
    expect(backupName('migration', d, { from: 1, to: 2 })).toBe('pre-migration-v1-to-v2-2026-10-06-140309.json');
    expect(backupName('manual', d)).toBe('alvatour-kopia-2026-10-06.json');
    expect(parseBackupName('przed-importem-2026-10-06-140309.json')).toMatchObject({ kind: 'import', date: d });
    expect(parseBackupName('moje-zdjecie.json').kind).toBe(null);
  });
});

describe('rotacja', () => {
  const now = new Date(2026, 9, 30, 12, 0, 0);
  it('auto: 14 ostatnich dni (najnowsza z dnia) + wszystko z ostatnich 24 h', () => {
    const names = [];
    for (let d = 0; d < 30; d++) for (const h of [9, 11]) names.push(autoName(new Date(now - d * DAY - (12 - h) * HOUR)));
    const del = new Set(planRotation(names, now));
    const kept = names.filter((n) => !del.has(n));
    // z ostatnich 24 h: dziś 9:00 i 11:00; potem 14 dni po jednej (najnowszej)
    expect(kept).toHaveLength(2 + 14);
    expect(kept).toContain(autoName(new Date(now - 3 * HOUR)));
  });
  it('nigdy nie usuwa eksportów ręcznych ani obcych plików', () => {
    const names = ['alvatour-kopia-2020-01-01.json', 'notatki.json', 'alvatour-auto-zle.json'];
    expect(planRotation(names, now)).toEqual([]);
  });
  it('kopie przed migracją/importem: 90 dni, ale zawsze 3 najnowsze', () => {
    const old = (days) => backupName('migration', new Date(now - days * DAY), { from: 1, to: 2 });
    const names = [old(200), old(150), old(120), old(100), old(10)];
    expect(planRotation(names, now).sort()).toEqual([old(200), old(150)].sort());
  });
  it('pamięć wewnętrzna: 5 najnowszych automatycznych', () => {
    const names = Array.from({ length: 8 }, (_, i) => autoName(new Date(now - i * HOUR)));
    expect(planRotation(names, now, { location: 'internal' })).toEqual(names.slice(5));
  });
});

describe('zapis w dwóch miejscach', () => {
  it('zapisuje do public i internal; awaria jednego nie blokuje', async () => {
    const fs = memoryFs();
    const b = createBackups({ fs });
    fs.broken.add('public');
    const r = await b.write('alvatour-auto-2026-10-06-120000.json', '{}');
    expect(r.where).toEqual(['internal']);
    fs.broken.add('internal');
    await expect(b.write('x.json', '{}')).rejects.toThrow(/Nie udało się zapisać kopii/);
  });
  it('lista łączy oba miejsca, najnowsze pierwsze', async () => {
    const fs = memoryFs();
    const b = createBackups({ fs });
    await fs.write('public', 'alvatour-auto-2026-10-01-120000.json', '{}');
    await fs.write('internal', 'alvatour-auto-2026-10-05-120000.json', '{}');
    await fs.write('public', 'alvatour-auto-2026-10-05-120000.json', '{}');
    const list = await b.list();
    expect(list.map((x) => x.name)).toEqual(['alvatour-auto-2026-10-05-120000.json', 'alvatour-auto-2026-10-01-120000.json']);
    expect(list[0].where).toEqual(['public', 'internal']);
  });
});
