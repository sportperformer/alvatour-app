// Punkt wejścia warstwy danych w aplikacji (bundlowany do www/data.js jako window.AlvaData).
// Na telefonie: SQLite (@capacitor-community/sqlite) + pliki (@capacitor/filesystem) + udostępnianie (@capacitor/share).
// W przeglądarce na komputerze (tylko podgląd do testów): dane w pamięci przeglądarki, bez SQLite.

import { registerPlugin, Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { App } from '@capacitor/app';
import { createDataService } from './service.js';
import { createNativeDb } from './native-db.js';
import { emptyState, normalizeState, describeCounts, countsOf } from './model.js';
import { buildBackup, serializeBackup, parseBackup } from './format.js';
import { backupName, stamp, KINDS } from './backups.js';

const isNative = Capacitor.isNativePlatform();

function nativeFs(folder) {
  const LOC = {
    public: { directory: Directory.Documents, base: `${folder}/kopie` },
    internal: { directory: Directory.Data, base: 'kopie' },
  };
  const at = (loc, name) => ({ directory: LOC[loc].directory, path: `${LOC[loc].base}/${name}` });
  return {
    folderLabel: `Documents/${folder}/kopie`,
    async write(loc, name, text) { await Filesystem.writeFile({ ...at(loc, name), data: text, encoding: Encoding.UTF8, recursive: true }); },
    async read(loc, name) { return (await Filesystem.readFile({ ...at(loc, name), encoding: Encoding.UTF8 })).data; },
    async list(loc) {
      try {
        const r = await Filesystem.readdir({ directory: LOC[loc].directory, path: LOC[loc].base });
        return r.files.filter((f) => f.type !== 'directory').map((f) => ({ name: f.name, size: f.size, mtime: f.mtime }));
      } catch (e) { return []; }
    },
    async remove(loc, name) { await Filesystem.deleteFile(at(loc, name)); },
  };
}

/** Podgląd w przeglądarce komputera (npm run serve). Nie jest używany w APK. */
function previewService(appVersion) {
  const KEY = 'alvatour-preview';
  const load = () => { try { return normalizeState(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return emptyState(); } };
  let lastImport = null;
  const svc = {
    async init() { return { state: load(), notices: [], readOnly: null }; },
    async persist(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* */ } return true; },
    async flush() {}, async onPause() {},
    async status() { return { lastBackupAt: null, lastExportAt: null, lastImport, schemaVersion: 0, readOnly: null }; },
    async backupNow() { return { name: 'podglad.json', where: [] }; },
    async exportAll() { const b = await buildBackup(load(), { schemaVersion: 0, appVersion }); return { name: backupName('manual', new Date()), text: serializeBackup(b), counts: b.counts }; },
    async markExported() {}, async reminderShown() {}, async declineRestore() {}, async beforeWipe() {},
    async previewImport(text) { const p = await parseBackup(text); return p.ok ? { ...p, text: describeCounts(p.info.counts) } : p; },
    async applyImport(p) { lastImport = JSON.stringify(load()); await svc.persist(p.state); return load(); },
    async undoImport() { await svc.persist(JSON.parse(lastImport)); lastImport = null; return load(); },
    async listBackups() { return []; },
    async readBackup() { return { ok: false, error: 'Podgląd w przeglądarce nie ma kopii.' }; },
    async readBackupText() { throw new Error('Podgląd w przeglądarce nie ma kopii.'); },
  };
  return svc;
}

let svc = null;
let fsx = null;
let errorHandler = (e) => console.error(e);
const pauseHooks = [];

const AlvaData = {
  isNative,
  emptyState,
  normalizeState,
  describeCounts,
  countsOf,
  KINDS,
  folderLabel: 'Documents/AlvaTour/kopie',
  isDev: false,

  onError(fn) { errorHandler = fn; },
  /** Funkcje wywoływane tuż przed zejściem aplikacji w tło (np. zapis odłożonych zmian). */
  beforePause(fn) { pauseHooks.push(fn); },

  async init({ appVersion }) {
    if (!isNative) {
      svc = previewService(appVersion);
    } else {
      const info = await App.getInfo().catch(() => ({ id: '' }));
      AlvaData.isDev = /\.dev$/.test(info.id || '');
      const folder = AlvaData.isDev ? 'AlvaTour-DEV' : 'AlvaTour';
      const db = createNativeDb(registerPlugin('CapacitorSQLite'));
      await db.open();
      fsx = nativeFs(folder);
      AlvaData.folderLabel = fsx.folderLabel;
      svc = createDataService({
        db, fs: fsx, appVersion,
        legacyStorage: window.localStorage,
        onError: (e) => errorHandler(e),
      });
      App.addListener('pause', () => {
        for (const fn of pauseHooks) { try { fn(); } catch (e) { /* */ } }
        svc.onPause().catch((e) => errorHandler(e));
      });
    }
    for (const m of ['persist', 'flush', 'status', 'backupNow', 'exportAll', 'markExported', 'reminderShown', 'previewImport',
      'applyImport', 'undoImport', 'listBackups', 'readBackup', 'readBackupText', 'beforeWipe', 'declineRestore']) {
      AlvaData[m] = (...a) => svc[m](...a);
    }
    return svc.init();
  },

  /**
   * Eksport ręczny: zapis w Documents/AlvaTour/kopie + systemowe "Udostępnij" (Dysk Google, mail...).
   * Zwraca { name, saved, shared }.
   */
  async exportAndShare() {
    const { name, text } = await svc.exportAll();
    if (!isNative) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      a.download = name; document.body.appendChild(a); a.click(); a.remove();
      return { name, saved: name, shared: true };
    }
    let saved = null;
    for (const n of [name, name.replace(/\.json$/, '') + '-' + stamp(new Date()).slice(11) + '.json']) {
      try { await fsx.write('public', n, text); saved = n; break; } catch (e) { /* plik z poprzedniej instalacji: spróbuj innej nazwy */ }
    }
    const { uri } = await Filesystem.writeFile({ path: `eksport/${name}`, data: text, directory: Directory.Cache, encoding: Encoding.UTF8, recursive: true });
    try {
      await Share.share({ title: 'Kopia AlvaTour', text: `Kopia danych AlvaTour (${name})`, files: [uri], dialogTitle: 'Zapisz kopię AlvaTour (np. na Dysku Google)' });
    } catch (e) {
      if (/cancel/i.test(String((e && e.message) || e))) return { name, saved, shared: false };
      throw e;
    }
    await svc.markExported();
    return { name, saved, shared: true };
  },
};

window.AlvaData = AlvaData;
