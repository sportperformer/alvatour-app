// Środowisko testowe: prawdziwy SQLite (node:sqlite) i pliki w pamięci.
import { DatabaseSync } from 'node:sqlite';

export function nodeDb(path = ':memory:') {
  const d = new DatabaseSync(path);
  const plain = (r) => (r ? { ...r } : r);
  const db = {
    raw: d,
    failOn: null, // wyrażenie regularne: zapytanie, które ma się "wysypać" (symulacja awarii)
    async exec(sql) { if (db.failOn && db.failOn.test(sql)) throw new Error('awaria testowa'); d.exec(sql); },
    async run(sql, params = []) { if (db.failOn && db.failOn.test(sql)) throw new Error('awaria testowa'); d.prepare(sql).run(...params); },
    async all(sql, params = []) { return d.prepare(sql).all(...params).map(plain); },
    async begin() { d.exec('BEGIN'); },
    async commit() { d.exec('COMMIT'); },
    async rollback() { d.exec('ROLLBACK'); },
  };
  return db;
}

export function memoryFs() {
  const files = { public: new Map(), internal: new Map() };
  const fs = {
    files,
    broken: new Set(), // miejsca, do których zapis się nie udaje
    async write(loc, name, text) { if (fs.broken.has(loc)) throw new Error('brak dostępu'); files[loc].set(name, text); },
    async read(loc, name) { if (!files[loc].has(name)) throw new Error('brak pliku'); return files[loc].get(name); },
    async list(loc) { return [...files[loc].keys()].map((name) => ({ name })); },
    async remove(loc, name) { files[loc].delete(name); },
  };
  return fs;
}

export function clock(start = '2026-10-06T10:00:00Z') {
  let t = new Date(start).getTime();
  const now = () => new Date(t);
  now.advance = (ms) => { t += ms; };
  return now;
}

export function memoryStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _map: m };
}

export const HOUR = 3600 * 1000;
export const DAY = 24 * HOUR;

/** Przykładowy stan z różnymi rodzajami danych (bez prawdziwych danych użytkownika). */
export function sampleState() {
  return {
    version: 2,
    countries: {
      PL: { visited: true, wish: false, firstYear: 1990, visits: [], notes: 'Dom', rating: 5, plannedDate: '', addedAt: '2026-01-01T00:00:00.000Z' },
      PT: { visited: true, wish: false, firstYear: 2019, visits: [{ year: 2022, note: 'Porto, wino' }, { year: null, note: '' }], notes: '', rating: 4, plannedDate: '', addedAt: '2026-01-02T00:00:00.000Z' },
      JP: { visited: false, wish: true, firstYear: null, visits: [], notes: 'Sakura', rating: 0, plannedDate: '2027-04-01', addedAt: '2026-01-03T00:00:00.000Z' },
    },
    settings: { colors: 'single', sort: 'desc', listTab: 'places', hintSeen: true, onboarded: true, name: 'Test', home: 'PL', lines: true, spin: false, sound: true, placeSt: 'all', placeCat: 'food' },
    badges: { first: '2026-01-01T00:00:00.000Z', v4: '2026-02-01T00:00:00.000Z' },
    games: { quizBest: 7, quizPlayed: 3, timelapse: 1, roulette: 0, aiImports: 2 },
    places: [
      { id: 'p1', name: 'Café Majestic', addr: 'Rua Santa Catarina 112, Porto', city: 'Porto', cc: 'PT', lat: 41.14706, lng: -8.60654, approx: false, cat: 'cafe', status: 'visited', date: '2022-05-03', rating: 5, note: 'Najlepsze ciastko', url: 'https://maps.app.goo.gl/abc', src: 'gmaps', addedAt: '2026-01-05T00:00:00.000Z' },
      { id: 'p2', name: 'Fushimi Inari', addr: 'Kioto', city: 'Kioto', cc: 'JP', lat: 34.9671, lng: 135.7727, approx: true, cat: 'sight', status: 'planned', date: '', rating: 0, note: '', url: '', src: 'ai', addedAt: '2026-01-06T00:00:00.000Z' },
    ],
    updatedAt: '2026-03-01T12:00:00.000Z',
  };
}
