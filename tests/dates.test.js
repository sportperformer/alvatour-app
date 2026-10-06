import { describe, it, expect } from 'vitest';
import { parsePartial, isValidPartial, partialFromParts, formatPartial, partialSortKey, yearOf } from '../src/data/dates.js';
import { normalizeState } from '../src/data/model.js';
import { createRepository } from '../src/data/repo.js';
import { nodeDb, sampleState } from './helpers/env.js';

describe('daty o różnej dokładności', () => {
  it('rozpoznaje rok, miesiąc i dzień', () => {
    expect(parsePartial('2024')).toEqual({ y: 2024, m: null, d: null });
    expect(parsePartial('2024-04')).toEqual({ y: 2024, m: 4, d: null });
    expect(parsePartial('2024-04-15')).toEqual({ y: 2024, m: 4, d: 15 });
    for (const bad of ['', '24', '2024-13', '2024-02-30', '2023-02-29', '2024-4-15', 'kwiecień', null]) expect(parsePartial(bad), String(bad)).toBe(null);
    expect(parsePartial('2024-02-29')).toEqual({ y: 2024, m: 2, d: 29 });
  });
  it('z pól formularza: dzień tylko z miesiącem, rok wymagany', () => {
    expect(partialFromParts('2024', '4', '15')).toBe('2024-04-15');
    expect(partialFromParts('2024', '4', '')).toBe('2024-04');
    expect(partialFromParts('2024', '', '15')).toBe('2024');
    expect(partialFromParts('', '4', '15')).toBe('');
    expect(partialFromParts('2023', '2', '29')).toBe('2023-02');
  });
  it('po polsku', () => {
    expect(formatPartial('2024-04-15')).toBe('15 kwietnia 2024');
    expect(formatPartial('2024-04')).toBe('kwiecień 2024');
    expect(formatPartial('2024')).toBe('2024');
    expect(formatPartial('zle')).toBe('');
  });
  it('kolejność w roku: od najdawniejszej, sam rok na końcu', () => {
    const list = ['2024', '2024-04-15', '2023-12-31', '2024-04', '2024-01-02', '2025'];
    expect(list.sort((a, b) => (partialSortKey(a) < partialSortKey(b) ? -1 : 1))).toEqual(['2023-12-31', '2024-01-02', '2024-04', '2024-04-15', '2024', '2025']);
  });
  it('zakres lat', () => {
    expect(isValidPartial('1899')).toBe(false);
    expect(isValidPartial(String(new Date().getFullYear() + 1))).toBe(false);
    expect(isValidPartial('2030-01', { max: 2036 })).toBe(true);
    expect(yearOf('2024-04-15')).toBe(2024);
  });
});

describe('daty w danych krajów i wizyt', () => {
  it('zachowuje datę, uzupełnia brakujący rok, pomija błędny tekst (rok zostaje)', () => {
    const n = normalizeState({ countries: {
      JP: { visited: true, firstDate: '2024-04-15', visits: [{ date: '2025-03', note: 'sakura' }] },
      KR: { visited: true, firstYear: 2019, firstDate: 'nie pamiętam', visits: [{ year: 2020, date: '2020-13' }] },
    } });
    expect(n.countries.JP).toMatchObject({ firstYear: 2024, firstDate: '2024-04-15' });
    expect(n.countries.JP.visits[0]).toMatchObject({ year: 2025, date: '2025-03', note: 'sakura' });
    expect(n.countries.KR.firstYear).toBe(2019);
    expect(n.countries.KR.firstDate).toBeUndefined();
    expect(n.countries.KR.visits[0]).toEqual({ year: 2020, note: '' });
  });
  it('daty przechodzą przez bazę bez zmian (bez migracji, w kolumnie extra)', async () => {
    const db = nodeDb();
    const repo = createRepository(db);
    await repo.migrate();
    await repo.load();
    const s = sampleState();
    s.countries.PT.firstDate = '2019-08-03';
    s.countries.PT.visits[0].date = '2022-05';
    await repo.persist(s);
    const back = await repo.load();
    expect(back.countries.PT.firstDate).toBe('2019-08-03');
    expect(back.countries.PT.visits[0]).toMatchObject({ year: 2022, date: '2022-05', note: 'Porto, wino' });
    expect(back).toEqual(normalizeState(s));
  });
});
