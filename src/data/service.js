// Serwis danych: start (migracje, kopie, przeniesienie starych danych), zapis, import/eksport.
// Niezależny od platformy: baza (db), pliki (fs) i pamięć przeglądarki (legacyStorage) są wstrzykiwane.

import { createRepository, MigrationError } from './repo.js';
import { createBackups, backupName, KINDS } from './backups.js';
import { buildBackup, serializeBackup, parseBackup } from './format.js';
import { emptyState, normalizeState, countsOf, isEmptyData, describeCounts } from './model.js';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const LEGACY_KEYS = ['alvatour-v1', 'bylem-tu-v1'];

export function createDataService({ db, fs, appVersion = '0.0.0', now = () => new Date(), legacyStorage = null, onError = () => {}, migrations }) {
  const repo = createRepository(db, migrations ? { now, migrations } : { now });
  const SCHEMA_VERSION = repo.target;
  const backups = createBackups({ fs, now });
  let readOnly = null; // powód, jeśli zapis jest zablokowany (np. nieudana migracja)
  let pending = null; // najnowszy stan czekający na zapis
  let worker = null;
  let dirtySinceBackup = false;
  let lastDeleteBackup = 0;

  const iso = () => now().toISOString();
  const age = (isoStr) => (isoStr ? now() - new Date(isoStr) : Infinity);

  /** Kopia z AKTUALNEJ zawartości bazy (nie z pamięci), zapis w obu miejscach. */
  async function backupFromDb(kind, extra = {}) {
    const state = await repo.load();
    const b = await buildBackup(state, { schemaVersion: (await repo.schemaVersion()) || SCHEMA_VERSION, appVersion, reason: kind, now: now() });
    const res = await backups.write(backupName(kind, now(), extra), serializeBackup(b));
    await repo.setMeta('last_backup_at', iso());
    dirtySinceBackup = false;
    return res;
  }

  async function writeStateBackup(kind, state) {
    const b = await buildBackup(state, { schemaVersion: SCHEMA_VERSION, appVersion, reason: kind, now: now() });
    return backups.write(backupName(kind, now()), serializeBackup(b));
  }

  async function newestBackupWithData() {
    const list = await backups.list();
    for (const it of list.filter((x) => x.kind).slice(0, 8)) {
      try {
        const p = await parseBackup(await backups.read(it.name));
        if (p.ok && !isEmptyData(p.state)) return { name: it.name, info: p.info, text: describeCounts(p.info.counts) };
      } catch (e) { /* uszkodzony plik pomijamy */ }
    }
    return null;
  }

  async function runPersist() {
    while (pending) {
      const state = pending;
      pending = null;
      try {
        const r = await repo.persist(state, {
          // kopia przed usunięciem 3+ krajów/miejsc naraz (chyba że zrobiliśmy ją przed chwilą, np. przy "Usuń wszystko")
          beforeMassDelete: async () => { if (now() - lastDeleteBackup > 60000) { await backupFromDb('delete'); lastDeleteBackup = +now(); } },
        });
        if (r.changed) dirtySinceBackup = true;
      } catch (e) {
        onError(e);
        // spróbuj ponownie przy następnym zapisie (nowszy stan ma pierwszeństwo)
        if (!pending) pending = state;
        worker = null;
        return;
      }
    }
    worker = null;
  }

  const api = {
    emptyState,
    normalizeState,
    countsOf,
    describeCounts,
    KINDS,

    /**
     * Start: otwarcie bazy, migracje, przeniesienie danych z wersji testowej 1.0 (localStorage), kopia dzienna.
     * Zwraca { state, notices: [...], readOnly }. Rzuca błąd tylko, gdy nie da się otworzyć bazy:
     * wtedy aplikacja NIE startuje z pustymi danymi.
     */
    async init() {
      const notices = [];
      let mig;
      try {
        mig = await repo.migrate({
          beforeMigrate: async (from, to) => (await backupFromDb('migration', { from, to })).name,
        });
      } catch (e) {
        if (!(e instanceof MigrationError)) throw e;
        readOnly = 'migration';
        notices.push({ type: 'read-only', reason: 'migration', from: e.from, to: e.to, backup: e.backup || null, message: e.message });
        mig = { status: 'failed' };
      }
      if (mig.status === 'newer') {
        readOnly = 'newer';
        notices.push({ type: 'read-only', reason: 'newer', from: mig.from, to: mig.to });
      }
      if (mig.status === 'migrated') notices.push({ type: 'migrated', from: mig.from, to: mig.to, backup: mig.backup });

      let state = await repo.load();

      // Dane z pierwszej wersji testowej APK (zapis w localStorage WebView). Nigdy ich nie kasujemy.
      if (!readOnly && legacyStorage && !(await repo.getMeta('legacy_checked'))) {
        if (isEmptyData(state)) {
          for (const k of LEGACY_KEYS) {
            let raw = null;
            try { raw = legacyStorage.getItem(k); } catch (e) { raw = null; }
            if (!raw) continue;
            const p = await parseBackup(raw);
            if (!p.ok) continue;
            await writeStateBackup('legacy', p.state);
            state = await repo.replaceAll(p.state);
            notices.push({ type: 'legacy-imported', text: describeCounts(countsOf(state)) });
            break;
          }
        }
        await repo.setMeta('legacy_checked', iso());
      }

      // Pusta baza, a istnieje kopia z danymi: zapytaj, zamiast zaczynać od zera.
      if (isEmptyData(state) && !(await repo.getMeta('wiped_at'))) {
        const offer = await newestBackupWithData();
        if (offer) notices.push({ type: 'offer-restore', ...offer });
      }

      if (!readOnly) {
        if (!isEmptyData(state) && age(await repo.getMeta('last_backup_at')) > DAY) {
          try { await backupFromDb('auto'); } catch (e) { onError(e); }
        }
        try { await backups.rotate(); } catch (e) { onError(e); }
        await repo.setMeta('app_version', appVersion);
        // przypomnienie o kopii poza telefonem
        const lastExport = await repo.getMeta('last_export_at');
        const ref = lastExport || (await repo.getMeta('created_at'));
        const changedSince = !lastExport || (await repo.getMeta('last_change_at') || '') > lastExport;
        if (!isEmptyData(state) && changedSince && age(ref) > 7 * DAY && age(await repo.getMeta('export_reminded_at')) > DAY) {
          notices.push({ type: 'export-reminder', lastExport });
        }
      }
      return { state, notices, readOnly };
    },

    /** Zapis stanu (kolejka; kolejne wywołania łączą się w jeden zapis). */
    persist(state) {
      if (readOnly) return Promise.resolve(false);
      pending = JSON.parse(JSON.stringify(state));
      if (!worker) worker = runPersist();
      return worker;
    },
    async flush() {
      if (pending && !worker && !readOnly) worker = runPersist(); // ponowna próba po wcześniejszym błędzie
      while (worker) await worker;
    },

    /** Aplikacja schodzi w tło: dopisz zmiany i (co najwyżej raz na godzinę) zrób kopię, jeśli coś się zmieniło. */
    async onPause() {
      await api.flush();
      if (readOnly || !dirtySinceBackup) return;
      if (age(await repo.getMeta('last_backup_at')) < HOUR) return;
      try { await backupFromDb('auto'); await backups.rotate(); } catch (e) { onError(e); }
    },

    async status() {
      return {
        lastBackupAt: await repo.getMeta('last_backup_at'),
        lastExportAt: await repo.getMeta('last_export_at'),
        lastImport: await repo.getMeta('last_import_backup'),
        schemaVersion: await repo.schemaVersion(),
        readOnly,
      };
    },

    async backupNow() { await api.flush(); return backupFromDb('auto'); },

    /** Eksport ręczny: { name, text }. Wywołujący zapisuje/udostępnia plik i potem woła markExported(). */
    async exportAll() {
      await api.flush();
      const state = await repo.load();
      const b = await buildBackup(state, { schemaVersion: SCHEMA_VERSION, appVersion, reason: 'manual', now: now() });
      return { name: backupName('manual', now()), text: serializeBackup(b), counts: b.counts };
    },
    async markExported() { await repo.setMeta('last_export_at', iso()); },
    async reminderShown() { await repo.setMeta('export_reminded_at', iso()); },

    /** Podgląd pliku przed importem: { ok, state, info, text } albo { ok: false, error }. */
    async previewImport(text) {
      const p = await parseBackup(text);
      if (!p.ok) return p;
      return { ...p, text: describeCounts(p.info.counts) };
    },

    /** Wczytuje kopię: najpierw kopia obecnych danych, potem zamiana w jednej transakcji i kontrola liczności. */
    async applyImport(preview) {
      if (readOnly) throw new Error('Zapis jest zablokowany (tryb awaryjny).');
      if (!preview || !preview.ok) throw new Error('Brak poprawnej kopii do wczytania.');
      await api.flush();
      const safety = await backupFromDb('import');
      const state = await repo.replaceAll(preview.state);
      await repo.setMeta('last_import_backup', safety.name);
      await repo.setMeta('last_import_at', iso());
      await repo.setMeta('wiped_at', null);
      dirtySinceBackup = true;
      return state;
    },

    /** Cofa ostatni import: wczytuje kopię zrobioną tuż przed nim. */
    async undoImport() {
      const name = await repo.getMeta('last_import_backup');
      if (!name) throw new Error('Nie ma importu do cofnięcia.');
      const p = await parseBackup(await backups.read(name));
      if (!p.ok) throw new Error(p.error);
      const state = await api.applyImport(p);
      await repo.setMeta('last_import_backup', null);
      return state;
    },

    async listBackups() { return backups.list(); },
    async readBackup(name) { return api.previewImport(await backups.read(name)); },
    async readBackupText(name) { return backups.read(name); },

    /** Świadome usunięcie danych przez użytkownika (po potwierdzeniu). Kopię robi zapis (zabezpieczenie przed masowym usuwaniem) albo ta funkcja. */
    async beforeWipe() {
      await api.flush();
      await backupFromDb('delete');
      lastDeleteBackup = +now();
      await repo.setMeta('wiped_at', iso());
    },

    /** Użytkownik nie chce przywracać kopii przy pustej bazie: nie pytaj ponownie. */
    async declineRestore() { await repo.setMeta('wiped_at', iso()); },
  };
  return api;
}
