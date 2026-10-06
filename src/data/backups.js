// Kopie zapasowe: nazwy plików, zapis w dwóch miejscach, lista i rotacja.
//
// Miejsca (fs.write/read/list/remove przyjmują 'public' albo 'internal'):
// - public:   Documents/AlvaTour/kopie (DEV: Documents/AlvaTour-DEV/kopie). Przetrwa odinstalowanie,
//             widać w "Moje pliki". Po ponownej instalacji aplikacja nie widzi starych plików sama
//             (ograniczenie Androida), ale można je wskazać przy imporcie.
// - internal: prywatny katalog aplikacji. Trafia do kopii Google (Auto Backup) razem z bazą.
//
// Rotacja usuwa TYLKO pliki automatyczne o znanych nazwach. Eksporty ręczne i obce pliki zostają zawsze.

export const KINDS = {
  auto: { prefix: 'alvatour-auto-', label: 'automatyczna' },
  migration: { prefix: 'pre-migration-', label: 'przed aktualizacją danych' },
  import: { prefix: 'przed-importem-', label: 'przed wczytaniem kopii' },
  delete: { prefix: 'przed-usunieciem-', label: 'przed usunięciem danych' },
  legacy: { prefix: 'z-pamieci-webview-', label: 'przeniesiona z wersji 1.0 testowej' },
  manual: { prefix: 'alvatour-kopia-', label: 'eksport ręczny' },
};

const pad = (n) => String(n).padStart(2, '0');
export function stamp(d, withTime = true) {
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return withTime ? `${day}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}` : day;
}

/** Nazwa pliku kopii, np. pre-migration-v1-to-v2-2026-10-06-143210.json */
export function backupName(kind, d, { from, to } = {}) {
  if (kind === 'migration') return `pre-migration-v${from}-to-v${to}-${stamp(d)}.json`;
  if (kind === 'manual') return `alvatour-kopia-${stamp(d, false)}.json`;
  return `${KINDS[kind].prefix}${stamp(d)}.json`;
}

/** Rozpoznaje rodzaj i datę z nazwy pliku. Obce nazwy: kind = null. */
export function parseBackupName(name) {
  const kind = Object.keys(KINDS).find((k) => name.startsWith(KINDS[k].prefix) && name.endsWith('.json')) || null;
  const m = name.match(/(\d{4})-(\d{2})-(\d{2})(?:-(\d{2})(\d{2})(\d{2})?)?(?:-\d+)?\.json$/);
  const date = m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) : null;
  return { name, kind, date };
}

const DAY = 24 * 3600 * 1000;

/**
 * Które pliki usunąć przy rotacji.
 * - auto (public): zostają wszystkie z ostatnich 24 h + najnowsza z każdego z 14 ostatnich dni z kopiami,
 * - auto (internal): 5 najnowszych,
 * - migration / import / delete / legacy: zostają z ostatnich 90 dni, zawsze co najmniej 3 najnowsze danego rodzaju,
 * - manual i obce pliki: nigdy nie są usuwane.
 */
export function planRotation(names, now, { location = 'public', days = 14, keepDays = 90, keepMin = 3, internalAuto = 5 } = {}) {
  const items = names.map(parseBackupName).filter((x) => x.kind && x.date && x.kind !== 'manual');
  const remove = [];
  const byKind = {};
  for (const it of items) (byKind[it.kind] ||= []).push(it);
  for (const list of Object.values(byKind)) list.sort((a, b) => b.date - a.date || (b.name < a.name ? -1 : 1));

  const auto = byKind.auto || [];
  if (location === 'internal') {
    remove.push(...auto.slice(internalAuto));
  } else {
    const keptDays = new Set();
    for (const it of auto) { // od najnowszej
      if (now - it.date < DAY) continue;
      const day = stamp(it.date, false);
      if (!keptDays.has(day) && keptDays.size < days) keptDays.add(day);
      else remove.push(it);
    }
  }
  for (const kind of ['migration', 'import', 'delete', 'legacy']) {
    (byKind[kind] || []).forEach((it, i) => { if (i >= keepMin && now - it.date > keepDays * DAY) remove.push(it); });
  }
  return [...new Set(remove.map((x) => x.name))];
}

export function createBackups({ fs, now = () => new Date() }) {
  return {
    /** Zapisuje kopię w obu miejscach. Sukces, jeśli zapisała się choć w jednym; zwraca gdzie. */
    async write(name, text) {
      const where = [];
      const errors = [];
      for (const loc of ['public', 'internal']) {
        try { await fs.write(loc, name, text); where.push(loc); } catch (e) { errors.push(`${loc}: ${e && e.message || e}`); }
      }
      if (!where.length) throw new Error('Nie udało się zapisać kopii: ' + errors.join('; '));
      return { name, where, errors };
    },
    async list() {
      const all = new Map();
      for (const loc of ['public', 'internal']) {
        let files = [];
        try { files = await fs.list(loc); } catch (e) { files = []; }
        for (const f of files) {
          const name = typeof f === 'string' ? f : f.name;
          if (!name.endsWith('.json')) continue;
          const it = all.get(name) || { ...parseBackupName(name), where: [] };
          it.where.push(loc);
          all.set(name, it);
        }
      }
      return [...all.values()].sort((a, b) => (b.date || 0) - (a.date || 0) || (b.name < a.name ? -1 : 1));
    },
    async read(name) {
      let lastErr;
      for (const loc of ['internal', 'public']) {
        try { return await fs.read(loc, name); } catch (e) { lastErr = e; }
      }
      throw lastErr || new Error('Brak pliku ' + name);
    },
    async rotate() {
      const removed = [];
      for (const loc of ['public', 'internal']) {
        let names = [];
        try { names = (await fs.list(loc)).map((f) => (typeof f === 'string' ? f : f.name)); } catch (e) { continue; }
        for (const name of planRotation(names, now(), { location: loc })) {
          try { await fs.remove(loc, name); removed.push(`${loc}/${name}`); } catch (e) { /* plik z poprzedniej instalacji: nie nasz, zostaje */ }
        }
      }
      return removed;
    },
  };
}
