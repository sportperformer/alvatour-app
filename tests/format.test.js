import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { buildBackup, serializeBackup, parseBackup, FORMAT_VERSION } from '../src/data/format.js';
import { normalizeState } from '../src/data/model.js';
import { sampleState } from './helpers/env.js';

const fixture = (n) => readFileSync(new URL('./fixtures/' + n, import.meta.url), 'utf8');
const expected = JSON.parse(fixture('expected.json'));

describe('eksport i odczyt kopii', () => {
  it('eksport -> odczyt daje identyczne dane', async () => {
    const b = await buildBackup(sampleState(), { schemaVersion: 1, appVersion: '1.0.0', reason: 'manual', now: new Date('2026-10-06T12:00:00Z') });
    expect(b).toMatchObject({ app: 'alvatour', format_version: FORMAT_VERSION, schema_version: 1, app_version: '1.0.0', exported_at: '2026-10-06T12:00:00.000Z' });
    expect(b.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
    const p = await parseBackup(serializeBackup(b));
    expect(p.ok).toBe(true);
    expect(p.state).toEqual(normalizeState(sampleState()));
    expect(p.info.counts).toEqual(b.counts);
    expect(p.info.kind).toBe('alvatour');
  });
  it('wykrywa zmienioną treść (suma kontrolna)', async () => {
    const b = await buildBackup(sampleState(), { schemaVersion: 1, appVersion: '1.0.0' });
    b.data.countries.PL.notes = 'zmienione';
    const p = await parseBackup(JSON.stringify(b));
    expect(p.ok).toBe(false);
    expect(p.error).toMatch(/uszkodzony/);
  });
  it('wykrywa niezgodne liczności', async () => {
    const b = await buildBackup(sampleState(), { schemaVersion: 1, appVersion: '1.0.0' });
    delete b.checksum;
    b.counts.countries = 99;
    const p = await parseBackup(JSON.stringify(b));
    expect(p.ok).toBe(false);
    expect(p.error).toMatch(/niekompletna/);
  });
  it('odrzuca kopię z nowszego formatu', async () => {
    const p = await parseBackup(JSON.stringify({ app: 'alvatour', format_version: FORMAT_VERSION + 1, data: { countries: {} } }));
    expect(p.ok).toBe(false);
    expect(p.error).toMatch(/nowszej wersji/);
  });
  it('odrzuca śmieci', async () => {
    for (const t of ['', 'nie json', '[]', '{"a":1}', '{"app":"inna","format_version":1,"data":{"countries":{}}}']) {
      expect((await parseBackup(t)).ok, t).toBe(false);
    }
  });
  it('przyjmuje plik z BOM na początku', async () => {
    expect((await parseBackup('﻿' + fixture('web-alvatour-v1-export.json'))).ok).toBe(true);
  });
});

describe('fixtures: każda wersja musi wczytać kopie ze wszystkich wcześniejszych', () => {
  const files = readdirSync(new URL('./fixtures/', import.meta.url)).filter((f) => f.endsWith('.json') && f !== 'expected.json');
  it('każdy fixture ma oczekiwane liczności', () => {
    for (const f of files) expect(expected[f], `brak wpisu w expected.json dla ${f}`).toBeTruthy();
  });
  for (const f of files) {
    it(`wczytuje ${f} z zachowaniem liczności`, async () => {
      const p = await parseBackup(fixture(f));
      expect(p.ok, p.error).toBe(true);
      expect(p.info.counts).toEqual(expected[f]);
    });
  }
  it('istnieje fixture dla bieżącej wersji (node scripts/make-fixture.mjs)', () => {
    const v = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
    expect(files).toContain(`apk-${v}-export.json`);
  });
});
