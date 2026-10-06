// Repozytorium danych: JEDYNE miejsce, które czyta i zapisuje bazę SQLite.
//
// db (adapter) musi mieć: exec(sql), run(sql, params), all(sql, params) -> wiersze, begin(), commit(), rollback().
// Każdy zapis odbywa się w transakcji: albo zapisze się wszystko, albo nic.

import { META_SQL, MIGRATIONS } from './schema.js';
import { emptyState, normalizeState, countsOf, sameCounts } from './model.js';

const TABLES = {
  // stamp: tabela ma kolumnę updated_at (od schematu 2), uzupełnianą przy każdym zapisie wiersza
  countries: { key: ['id'], stamp: true, cols: ['id', 'visited', 'wish', 'first_year', 'notes', 'rating', 'planned_date', 'added_at', 'extra'] },
  visits: { key: ['country_id', 'pos'], cols: ['country_id', 'pos', 'year', 'note', 'extra'] },
  places: { key: ['id'], stamp: true, cols: ['id', 'pos', 'name', 'addr', 'city', 'cc', 'lat', 'lng', 'approx', 'cat', 'status', 'date', 'rating', 'note', 'url', 'src', 'added_at', 'extra'] },
  badges: { key: ['id'], cols: ['id', 'value'] },
  kv: { key: ['section', 'key'], cols: ['section', 'key', 'value'] },
};
const TABLE_ORDER = ['countries', 'visits', 'places', 'badges', 'kv'];

const COUNTRY_KNOWN = new Set(['visited', 'wish', 'firstYear', 'visits', 'notes', 'rating', 'plannedDate', 'addedAt']);
const VISIT_KNOWN = new Set(['year', 'note']);
const PLACE_KNOWN = new Set(['id', 'name', 'addr', 'city', 'cc', 'lat', 'lng', 'approx', 'cat', 'status', 'date', 'rating', 'note', 'url', 'src', 'addedAt']);
const ROOT_SECTIONS = new Set(['countries', 'settings', 'badges', 'games', 'places']);

export class MigrationError extends Error {
  constructor(message, details = {}) { super(message); this.name = 'MigrationError'; Object.assign(this, details); }
}

function extraOf(obj, known) {
  const rest = {};
  let any = false;
  for (const [k, v] of Object.entries(obj || {})) if (!known.has(k) && v !== undefined && !k.startsWith('_')) { rest[k] = v; any = true; }
  return any ? JSON.stringify(rest) : null;
}
function parseExtra(s) {
  if (!s) return {};
  try { const o = JSON.parse(s); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; }
}
function parseJSON(s, fallback) {
  if (s === null || s === undefined) return fallback;
  try { return JSON.parse(s); } catch (e) { return fallback; }
}

/** Stan aplikacji -> wiersze tabel (Map klucz -> tablica wartości kolumn). */
export function stateToRows(state) {
  const rows = Object.fromEntries(TABLE_ORDER.map((t) => [t, new Map()]));
  const key = (t, vals) => TABLES[t].key.map((k) => vals[TABLES[t].cols.indexOf(k)]).join('\u0001');
  const put = (t, vals) => rows[t].set(key(t, vals), vals);
  for (const [id, c] of Object.entries(state.countries || {})) {
    put('countries', [id, c.visited ? 1 : 0, c.wish ? 1 : 0, c.firstYear ?? null, c.notes || '', Number(c.rating) || 0, c.plannedDate || '', c.addedAt || null, extraOf(c, COUNTRY_KNOWN)]);
    (c.visits || []).forEach((v, pos) => put('visits', [id, pos, v.year ?? null, v.note || '', extraOf(v, VISIT_KNOWN)]));
  }
  (state.places || []).forEach((p, pos) => put('places', [p.id, pos, p.name, p.addr || '', p.city || '', p.cc || '', Number(p.lat), Number(p.lng), p.approx ? 1 : 0, p.cat || 'other', p.status || 'visited', p.date || '', Number(p.rating) || 0, p.note || '', p.url || '', p.src || '', p.addedAt || null, extraOf(p, PLACE_KNOWN)]));
  for (const [id, v] of Object.entries(state.badges || {})) put('badges', [id, JSON.stringify(v)]);
  for (const sec of ['settings', 'games']) for (const [k, v] of Object.entries(state[sec] || {})) if (v !== undefined) put('kv', [sec, k, JSON.stringify(v)]);
  for (const [k, v] of Object.entries(state)) if (!ROOT_SECTIONS.has(k) && v !== undefined) put('kv', ['root', k, JSON.stringify(v)]);
  return rows;
}

/** Wiersze -> stan aplikacji. Odporne na brakujące kolumny (stare bazy) i nadmiarowe (nowe). */
export function rowsToState(t) {
  const s = emptyState();
  const visitsBy = new Map();
  for (const r of [...t.visits].sort((a, b) => a.pos - b.pos)) {
    if (!visitsBy.has(r.country_id)) visitsBy.set(r.country_id, []);
    visitsBy.get(r.country_id).push({ ...parseExtra(r.extra), year: r.year ?? null, note: r.note ?? '' });
  }
  for (const r of t.countries) {
    s.countries[r.id] = {
      ...parseExtra(r.extra),
      visited: !!r.visited, wish: !!r.wish, firstYear: r.first_year ?? null, visits: visitsBy.get(r.id) || [],
      notes: r.notes ?? '', rating: r.rating ?? 0, plannedDate: r.planned_date ?? '', addedAt: r.added_at ?? null,
    };
  }
  s.places = [...t.places].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0)).map((r) => ({
    ...parseExtra(r.extra),
    id: r.id, name: r.name, addr: r.addr ?? '', city: r.city ?? '', cc: r.cc ?? '', lat: Number(r.lat), lng: Number(r.lng),
    approx: !!r.approx, cat: r.cat ?? 'other', status: r.status ?? 'visited', date: r.date ?? '', rating: r.rating ?? 0,
    note: r.note ?? '', url: r.url ?? '', src: r.src ?? '', addedAt: r.added_at ?? null,
  }));
  for (const r of t.badges) s.badges[r.id] = parseJSON(r.value, true);
  for (const r of t.kv) {
    const v = parseJSON(r.value, undefined);
    if (v === undefined) continue;
    if (r.section === 'settings' || r.section === 'games') s[r.section][r.key] = v;
    else if (r.section === 'root' && !ROOT_SECTIONS.has(r.key)) s[r.key] = v;
  }
  return normalizeState(s);
}

export function createRepository(db, { now = () => new Date(), migrations = MIGRATIONS } = {}) {
  const target = migrations[migrations.length - 1].version;
  let snapshot = null; // ostatnio zapisane wiersze (do zapisu tylko zmian)
  let stamped = null; // tabele, które mają już kolumnę updated_at (stara baza przed migracją jej nie ma)

  async function stampedTables() {
    if (stamped) return stamped;
    stamped = new Set();
    for (const t of TABLE_ORDER) {
      if (!TABLES[t].stamp) continue;
      const cols = await db.all(`PRAGMA table_info(${t})`, []);
      if (cols.some((c) => c.name === 'updated_at')) stamped.add(t);
    }
    return stamped;
  }
  /** INSERT dla wiersza; w tabelach z updated_at dopisuje datę zapisu. */
  function insertOp(verb, t, vals, st, at) {
    const cols = st.has(t) ? [...TABLES[t].cols, 'updated_at'] : TABLES[t].cols;
    return [`${verb} INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, st.has(t) ? [...vals, at] : vals];
  }

  async function tx(fn) {
    await db.begin();
    try {
      const r = await fn();
      await db.commit();
      return r;
    } catch (e) {
      try { await db.rollback(); } catch (e2) { /* transakcja mogła już zostać wycofana */ }
      throw e;
    }
  }
  const getMeta = async (k) => { const r = await db.all('SELECT value FROM meta WHERE key = ?', [k]); return r.length ? r[0].value : null; };
  const setMetaRaw = (k, v) => db.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [k, v == null ? null : String(v)]);
  async function schemaVersion() { return Number(await getMeta('schema_version')) || 0; }

  async function readTables() {
    // tabela, której jeszcze nie ma (stara baza przed migracją), czyta się jako pusta
    const existing = new Set((await db.all("SELECT name FROM sqlite_master WHERE type = 'table'", [])).map((r) => r.name));
    const t = {};
    for (const name of TABLE_ORDER) t[name] = existing.has(name) ? await db.all(`SELECT * FROM ${name}`, []) : [];
    return t;
  }
  async function load() {
    const state = rowsToState(await readTables());
    snapshot = stateToRows(state);
    return state;
  }

  function diff(next, st, at) {
    const ops = [];
    let deletedItems = 0;
    for (const t of TABLE_ORDER) {
      const before = snapshot[t], after = next[t];
      const { cols, key } = TABLES[t];
      for (const [k, vals] of before) {
        if (!after.has(k)) {
          ops.push([`DELETE FROM ${t} WHERE ${key.map((c) => c + ' = ?').join(' AND ')}`, key.map((c) => vals[cols.indexOf(c)])]);
          if (t === 'countries' || t === 'places') deletedItems++;
        }
      }
      for (const [k, vals] of after) {
        const old = before.get(k);
        if (!old || JSON.stringify(old) !== JSON.stringify(vals)) {
          ops.push(insertOp('INSERT OR REPLACE', t, vals, st, at));
        }
      }
    }
    return { ops, deletedItems };
  }

  return {
    target,
    getMeta,
    async setMeta(k, v) { await setMetaRaw(k, v); },
    schemaVersion,
    load,

    /**
     * Uruchamia brakujące migracje. beforeMigrate(from, to) musi zrobić kopię; jeśli rzuci błąd, migracja się nie zaczyna.
     * Cała migracja jest jedną transakcją: przy błędzie lub niezgodnych licznościach baza wraca do stanu sprzed migracji.
     */
    async migrate({ beforeMigrate = async () => {} } = {}) {
      await db.exec(META_SQL);
      const from = await schemaVersion();
      if (from > target) return { status: 'newer', from, to: target };
      if (from === target) return { status: 'current', from, to: target };
      const fresh = from === 0;
      let before = null;
      let backup = null;
      if (!fresh) {
        before = countsOf(rowsToState(await readTables()));
        try {
          backup = await beforeMigrate(from, target);
        } catch (e) {
          throw new MigrationError('Nie udało się zrobić kopii przed aktualizacją danych, więc aktualizacja się nie zaczęła: ' + (e && e.message || e), { from, to: target, backup: null, cause: e });
        }
      }
      try {
        await tx(async () => {
          for (const m of migrations.filter((x) => x.version > from)) {
            for (const sql of m.statements) await db.exec(sql);
            await setMetaRaw('schema_version', m.version);
          }
          if (fresh) await setMetaRaw('created_at', now().toISOString());
          await setMetaRaw('migrated_at', now().toISOString());
          if (!fresh) {
            const after = countsOf(rowsToState(await readTables()));
            if (!sameCounts(before, after)) throw new MigrationError('Liczności danych po migracji się nie zgadzają.', { before, after });
          }
        });
      } catch (e) {
        throw e instanceof MigrationError ? Object.assign(e, { from, to: target, backup }) : new MigrationError(String(e && e.message || e), { from, to: target, backup, cause: e });
      }
      stamped = null;
      return { status: fresh ? 'created' : 'migrated', from, to: target, backup };
    },

    /** Zapisuje tylko to, co się zmieniło od ostatniego zapisu. Zwraca { changed, deletedItems }. */
    async persist(state, { beforeMassDelete } = {}) {
      if (!snapshot) await load();
      const next = stateToRows(normalizeState(state));
      const { ops, deletedItems } = diff(next, await stampedTables(), now().toISOString());
      if (!ops.length) return { changed: 0, deletedItems: 0 };
      if (deletedItems >= 3 && beforeMassDelete) await beforeMassDelete(deletedItems);
      await tx(async () => {
        for (const [sql, params] of ops) await db.run(sql, params);
        await setMetaRaw('last_change_at', now().toISOString());
      });
      snapshot = next;
      return { changed: ops.length, deletedItems };
    },

    /** Zastępuje wszystkie dane (import / przywrócenie kopii). Wywołujący MUSI wcześniej zrobić kopię. */
    async replaceAll(state) {
      const data = normalizeState(state);
      const expected = countsOf(data);
      const rows = stateToRows(data);
      const st = await stampedTables();
      const at = now().toISOString();
      await tx(async () => {
        for (const t of TABLE_ORDER) await db.run(`DELETE FROM ${t}`, []);
        for (const t of TABLE_ORDER) {
          const { cols } = TABLES[t];
          for (const vals of rows[t].values()) await db.run(...insertOp('INSERT', t, vals, st, at));
        }
        const after = countsOf(rowsToState(await readTables()));
        if (!sameCounts(expected, after)) throw new Error('Kontrola po wczytaniu nie przeszła: liczności się nie zgadzają.');
        await setMetaRaw('last_change_at', now().toISOString());
      });
      snapshot = rows;
      return rowsToState(await readTables());
    },
  };
}
