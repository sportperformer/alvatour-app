// Model danych AlvaTour: pusty stan, normalizacja, liczności, suma kontrolna.
// Zasada: normalizacja NIGDY nie gubi pól, których nie zna (np. dodanych w nowszej wersji).

export const MIN_YEAR = 1900;
const thisYear = () => new Date().getFullYear();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

// Klucze "koperty" eksportu z wersji webowej (nie są częścią danych).
const ENVELOPE_KEYS = new Set(['app', 'exportedAt']);

export function emptyState() {
  return {
    version: 2,
    countries: {},
    settings: { colors: 'multi', sort: 'asc', listTab: 'visited', hintSeen: false, onboarded: false, name: '', home: 'PL', lines: false, spin: true, sound: true },
    badges: {},
    games: { quizBest: 0, quizPlayed: 0, timelapse: 0, roulette: 0, aiImports: 0 },
    places: [],
  };
}

export function validYear(y) {
  if (y === null || y === undefined || y === '') return false;
  const n = Number(y);
  return Number.isInteger(n) && n >= MIN_YEAR && n <= thisYear();
}

// Pola zaczynające się od "_" są tymczasowe (np. _s: pozycja pinezki na ekranie, liczona przy rysowaniu globu).
// Nigdy nie trafiają do bazy, kopii ani eksportu.
export const isTransientKey = (k) => typeof k === 'string' && k.startsWith('_');
const persistent = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !isTransientKey(k)));

let uidCounter = 0;
const newPlaceId = () => 'p' + Date.now().toString(36) + (uidCounter++).toString(36) + Math.random().toString(36).slice(2, 6);

export function normalizeCountry(c, now) {
  return {
    ...persistent(c),
    visited: !!c.visited,
    wish: !c.visited && !!c.wish,
    firstYear: validYear(c.firstYear) ? Number(c.firstYear) : null,
    visits: Array.isArray(c.visits) ? c.visits.map((v) => ({ ...(isObj(v) ? persistent(v) : {}), year: validYear(v && v.year) ? Number(v.year) : null, note: String((v && v.note) || '') })) : [],
    notes: String(c.notes || ''),
    rating: clamp(Number(c.rating) || 0, 0, 5),
    plannedDate: typeof c.plannedDate === 'string' ? c.plannedDate : '',
    addedAt: c.addedAt || now,
  };
}

export function normalizePlace(p, now) {
  return {
    ...persistent(p),
    id: String(p.id || newPlaceId()),
    name: String(p.name), addr: String(p.addr || ''), city: String(p.city || ''), cc: String(p.cc || ''),
    lat: Number(p.lat), lng: Number(p.lng), approx: !!p.approx, cat: String(p.cat || 'other'),
    status: p.status === 'planned' ? 'planned' : 'visited', date: typeof p.date === 'string' ? p.date : '',
    rating: clamp(Number(p.rating) || 0, 0, 5), note: String(p.note || ''), url: String(p.url || ''), src: String(p.src || ''),
    addedAt: p.addedAt || now,
  };
}

export function normalizeState(s) {
  const out = emptyState();
  if (!isObj(s)) return out;
  const now = new Date().toISOString();
  for (const [k, v] of Object.entries(s)) {
    if (!(k in out) && !ENVELOPE_KEYS.has(k) && !isTransientKey(k)) out[k] = v;
  }
  if (isObj(s.settings)) Object.assign(out.settings, s.settings);
  if (isObj(s.badges)) Object.assign(out.badges, s.badges);
  if (isObj(s.games)) Object.assign(out.games, s.games);
  if (Array.isArray(s.places)) {
    out.places = s.places.filter((p) => p && p.name && isFinite(p.lat) && isFinite(p.lng)).map((p) => normalizePlace(p, now));
  }
  const src = isObj(s.countries) ? s.countries : {};
  for (const [id, c] of Object.entries(src)) {
    if (!isObj(c) || (!c.visited && !c.wish)) continue;
    out.countries[id] = normalizeCountry(c, now);
  }
  // wersja 1 (Byłem Tu) nie miała powitania: jeśli są dane, pomiń powitanie
  if (!s.version || s.version < 2) { if (Object.keys(out.countries).length) out.settings.onboarded = true; }
  return out;
}

/** Liczności do kontroli spójności (przed/po migracji, eksport, import). */
export function countsOf(state) {
  const cs = Object.values(state.countries || {});
  const places = state.places || [];
  const visits = cs.reduce((n, c) => n + (c.visits ? c.visits.length : 0), 0);
  const notes = cs.filter((c) => String(c.notes || '').trim()).length
    + cs.reduce((n, c) => n + (c.visits || []).filter((v) => String(v.note || '').trim()).length, 0)
    + places.filter((p) => String(p.note || '').trim()).length;
  return {
    countries: cs.filter((c) => c.visited).length,
    wishes: cs.filter((c) => c.wish).length,
    visits,
    places: places.length,
    notes,
    badges: Object.keys(state.badges || {}).length,
  };
}
export const COUNT_KEYS = ['countries', 'wishes', 'visits', 'places', 'notes', 'badges'];
export function sameCounts(a, b) { return COUNT_KEYS.every((k) => (a && a[k]) === (b && b[k])); }
export function isEmptyData(state) { return !Object.keys(state.countries || {}).length && !(state.places || []).length; }

/** JSON z posortowanymi kluczami: ta sama treść daje zawsze ten sam tekst. */
export function canonicalJSON(v) {
  if (Array.isArray(v)) return '[' + v.map(canonicalJSON).join(',') + ']';
  if (isObj(v)) return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + canonicalJSON(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}

export async function sha256(text) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const P = (n, f) => {
  if (n === 1) return f[0];
  const d = n % 10, h = n % 100;
  return d >= 2 && d <= 4 && (h < 12 || h > 14) ? f[1] : f[2];
};
/** "42 kraje, 3 marzenia, 18 miejsc, 7 notatek" */
export function describeCounts(c) {
  const parts = [
    `${c.countries} ${P(c.countries, ['kraj', 'kraje', 'krajów'])}`,
    `${c.wishes} ${P(c.wishes, ['marzenie', 'marzenia', 'marzeń'])}`,
    `${c.places} ${P(c.places, ['miejsce', 'miejsca', 'miejsc'])}`,
    `${c.notes} ${P(c.notes, ['notatka', 'notatki', 'notatek'])}`,
  ];
  return parts.join(', ');
}
