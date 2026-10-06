import { describe, it, expect } from 'vitest';
import { normalizeState, countsOf, canonicalJSON, describeCounts, isEmptyData } from '../src/data/model.js';
import { sampleState } from './helpers/env.js';

describe('normalizeState', () => {
  it('jest idempotentna', () => {
    const a = normalizeState(sampleState());
    expect(normalizeState(a)).toEqual(a);
  });
  it('zachowuje pola, których nie zna (z nowszych wersji)', () => {
    const s = sampleState();
    s.countries.PL.mood = 'radość';
    s.countries.PT.visits[0].photos = 3;
    s.places[0].tags = ['kawa'];
    s.settings.futureSetting = 42;
    s.journal = [{ t: 'nowa sekcja' }];
    const n = normalizeState(s);
    expect(n.countries.PL.mood).toBe('radość');
    expect(n.countries.PT.visits[0].photos).toBe(3);
    expect(n.places[0].tags).toEqual(['kawa']);
    expect(n.settings.futureSetting).toBe(42);
    expect(n.journal).toEqual([{ t: 'nowa sekcja' }]);
  });
  it('pomija kopertę eksportu webowego', () => {
    const n = normalizeState({ app: 'alvatour', exportedAt: 'x', ...sampleState() });
    expect(n.app).toBeUndefined();
    expect(n.exportedAt).toBeUndefined();
  });
  it('dane z Byłem Tu (wersja 1) pomijają powitanie', () => {
    expect(normalizeState({ version: 1, countries: { DE: { visited: true } } }).settings.onboarded).toBe(true);
  });
});

describe('liczności', () => {
  it('liczy kraje, marzenia, wizyty, miejsca, notatki, odznaki', () => {
    expect(countsOf(normalizeState(sampleState()))).toEqual({ countries: 2, wishes: 1, visits: 2, places: 2, notes: 4, badges: 2 });
  });
  it('opis po polsku', () => {
    expect(describeCounts({ countries: 42, wishes: 1, places: 18, notes: 7 })).toBe('42 kraje, 1 marzenie, 18 miejsc, 7 notatek');
    expect(describeCounts({ countries: 1, wishes: 5, places: 2, notes: 22 })).toBe('1 kraj, 5 marzeń, 2 miejsca, 22 notatki');
  });
  it('pusty stan', () => {
    expect(isEmptyData(normalizeState({}))).toBe(true);
    expect(isEmptyData(normalizeState(sampleState()))).toBe(false);
  });
});

describe('canonicalJSON', () => {
  it('nie zależy od kolejności kluczy', () => {
    expect(canonicalJSON({ b: 1, a: { d: 2, c: [3, { f: 1, e: 2 }] } })).toBe(canonicalJSON({ a: { c: [3, { e: 2, f: 1 }], d: 2 }, b: 1 }));
  });
});
