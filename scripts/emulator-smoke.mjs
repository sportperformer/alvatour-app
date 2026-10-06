// Test na emulatorze Androida (GitHub Actions): prawdziwy, podpisany APK DEV, prawdziwe SQLite, pliki i udostępnianie.
// Użycie: node scripts/emulator-smoke.mjs <nowy-AlvaTour-DEV.apk> [poprzedni-AlvaTour-DEV.apk]
//
// Sprawdza:
//  0. aktualizację: poprzednia wersja z danymi -> nowa wersja -> te same dane (+ kopia przed migracją),
//  1. aplikacja startuje bez błędów, baza się otwiera,
//  2. zapis do SQLite + kopia w Documents/AlvaTour-DEV/kopie (widoczna dla innych aplikacji),
//  3. dane są po ponownym uruchomieniu,
//  4. Udostępnij -> AlvaTour: zimny start i otwarta aplikacja,
//  5. kopia w Documents przetrwa odinstalowanie aplikacji,
//  6. brak awarii (FATAL) w logach.
import { execFileSync } from 'node:child_process';
import { _android } from 'playwright-core';

const PKG = 'pl.sportperformer.alvatour.dev';
const ACTIVITY = `${PKG}/pl.sportperformer.alvatour.MainActivity`;
const APK = process.argv[2];
const PREV_APK = process.argv[3] || '';
if (!APK) throw new Error('Podaj ścieżkę do APK DEV');
const DOCS = '/sdcard/Documents/AlvaTour-DEV/kopie';

const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8' }).trim();
const sh = (cmd) => adb('shell', cmd);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
/** Różnice między dwoma obiektami: lista "ścieżka: przed -> po" (kolejność kluczy bez znaczenia). */
function diffPaths(a, b, path = '', out = []) {
  if (out.length > 20) return out;
  const isObj = (x) => x && typeof x === 'object';
  if (isObj(a) && isObj(b)) {
    // pola "_..." są tymczasowe (np. pozycja pinezki na ekranie) i nie są danymi użytkownika
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)].filter((x) => !x.startsWith('_')))) diffPaths(a[k], b[k], path ? `${path}.${k}` : k, out);
  } else if (JSON.stringify(a) !== JSON.stringify(b)) {
    out.push(`${path}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
  }
  return out;
}
function check(ok, label, extra = '') {
  console.log(`${ok ? 'OK  ' : 'BŁĄD'} ${label}${extra ? ': ' + extra : ''}`);
  if (!ok) failures++;
}

const [device] = await _android.devices();
if (!device) throw new Error('Brak emulatora');
device.setDefaultTimeout(90000);

async function pageForCurrentProcess(tries = 60) {
  for (let i = 0; i < tries; i++) {
    const pid = sh(`pidof ${PKG} || true`).split(/\s+/)[0]; // pidof kończy się błędem, gdy proces jeszcze nie działa
    if (pid) {
      try {
        const wv = await device.webView({ socketName: `webview_devtools_remote_${pid}` }, { timeout: 5000 });
        const page = await wv.page();
        await page.waitForFunction(() => typeof dataReady !== 'undefined' && dataReady === true, null, { timeout: 60000 });
        return page;
      } catch (e) { /* WebView jeszcze nie gotowy */ }
    }
    await sleep(1000);
  }
  throw new Error('Nie udało się połączyć z WebView aplikacji');
}

async function launch(shellExtra = '', tries = 60) {
  sh(`am force-stop ${PKG}`);
  sh(`am start -W -n ${ACTIVITY} ${shellExtra}`);
  return pageForCurrentProcess(tries);
}

const SEED = async () => {
  state.settings.onboarded = true;
  state.settings.name = 'Emulator';
  state.countries.PT = { visited: true, wish: false, firstYear: 2019, visits: [{ year: 2022, note: 'Porto' }], notes: 'test emulatora', rating: 5, plannedDate: '', addedAt: '2026-01-01T00:00:00.000Z' };
  state.countries.JP = { visited: false, wish: true, firstYear: null, visits: [], notes: 'marzenie', rating: 0, plannedDate: '2027-04-01', addedAt: '2026-01-02T00:00:00.000Z' };
  state.places = [{ id: 'pemu1', name: 'Café Majestic', addr: 'Porto', city: 'Porto', cc: 'PT', lat: 41.14706, lng: -8.60654, approx: false, cat: 'cafe', status: 'visited', date: '2022-05-03', rating: 5, note: 'x', url: '', src: 'test', addedAt: '2026-01-03T00:00:00.000Z' }];
  saveNow();
  await AlvaData.flush();
  return { state: JSON.parse(JSON.stringify({ countries: state.countries, places: state.places, settings: state.settings })), status: await AlvaData.status() };
};

// 0. aktualizacja z poprzedniej wersji
if (PREV_APK) {
  console.log('Test aktualizacji z', PREV_APK);
  try { adb('uninstall', PKG); } catch (e) { /* nie było zainstalowane */ }
  adb('install', PREV_APK);
  let old = null;
  try { old = await launch('', 20); } catch (e) { old = null; }
  if (!old) {
    console.log('POMINIĘTO test aktualizacji: poprzednia wersja nie pozwala sterować sobą automatycznie (wersje sprzed 1.0.1).');
  } else {
    const before = await old.evaluate(SEED);
    adb('install', '-r', APK); // aktualizacja jak na telefonie: dane zostają
    const page0 = await launch();
    const after = await page0.evaluate(async () => ({
      state: JSON.parse(JSON.stringify({ countries: state.countries, places: state.places, settings: state.settings })),
      status: await AlvaData.status(),
      backups: (await AlvaData.listBackups()).map((b) => b.name),
    }));
    const diffs = diffPaths(before.state, after.state);
    check(!diffs.length, 'aktualizacja: te same dane po instalacji nowej wersji', diffs.join(' | '));
    check(after.status.readOnly === null, 'aktualizacja: aplikacja nie jest w trybie bezpiecznym', String(after.status.readOnly));
    if (after.status.schemaVersion > before.status.schemaVersion) {
      const pre = `pre-migration-v${before.status.schemaVersion}-to-v${after.status.schemaVersion}-`;
      check(after.backups.some((n) => n.startsWith(pre)), `aktualizacja: kopia przed migracją (${pre}…)`, after.backups.join(', '));
    } else {
      console.log(`(schemat bez zmian: v${after.status.schemaVersion})`);
    }
  }
}

console.log('Instalacja', APK);
adb('install', '-r', APK);
sh('logcat -c');

// 1-2. start, zapis, kopia
let page = await launch();
const r1 = await page.evaluate(async () => {
  state.settings.onboarded = true;
  state.settings.name = 'Emulator';
  state.countries.PT = { visited: true, wish: false, firstYear: 2019, firstDate: '2019-08-03', visits: [{ year: 2022, note: 'Porto', date: '2022-05' }], notes: 'test emulatora', rating: 5, plannedDate: '', addedAt: new Date().toISOString() };
  state.places.push({ id: 'pemu1', name: 'Café Majestic', addr: 'Porto', city: 'Porto', cc: 'PT', lat: 41.14706, lng: -8.60654, approx: false, cat: 'cafe', status: 'visited', date: '2022-05-03', rating: 5, note: 'x', url: '', src: 'test', addedAt: new Date().toISOString() });
  saveNow();
  await AlvaData.flush();
  const b = await AlvaData.backupNow();
  return { isNative: AlvaData.isNative, isDev: AlvaData.isDev, folder: AlvaData.folderLabel, backup: b, status: await AlvaData.status() };
});
check(r1.isNative && r1.isDev, 'platforma natywna, wariant DEV', JSON.stringify({ isNative: r1.isNative, isDev: r1.isDev }));
check(r1.folder === 'Documents/AlvaTour-DEV/kopie', 'folder kopii', r1.folder);
check(r1.backup.where.includes('public') && r1.backup.where.includes('internal'), 'kopia zapisana w Documents i w pamięci aplikacji', JSON.stringify(r1.backup));
check(r1.status.schemaVersion >= 1, 'schemat bazy', String(r1.status.schemaVersion));
const files = sh(`ls ${DOCS} 2>/dev/null || true`);
check(files.includes(r1.backup.name), 'plik kopii widoczny w Documents (adb)', files.replace(/\n/g, ', '));

// 3. dane po ponownym uruchomieniu
page = await launch();
const r2 = await page.evaluate(() => ({ pt: state.countries.PT, places: state.places.length, name: state.settings.name }));
check(r2.pt && r2.pt.notes === 'test emulatora' && r2.pt.visits.length === 1 && r2.places === 1 && r2.name === 'Emulator', 'dane po ponownym uruchomieniu', JSON.stringify(r2));
check(r2.pt && r2.pt.firstDate === '2019-08-03' && r2.pt.visits[0].date === '2022-05', 'daty z dniem/miesiącem po ponownym uruchomieniu', JSON.stringify(r2.pt && { firstDate: r2.pt.firstDate, visits: r2.pt.visits }));

// 4. Udostępnij -> AlvaTour (zimny start)
const shareCold = "'Majestic Cafe Porto https://maps.app.goo.gl/zimnystart'";
page = await launch(`-a android.intent.action.SEND -t text/plain --es android.intent.extra.TEXT ${shareCold}`);
await page.waitForSelector('#plQ', { timeout: 30000 }).catch(() => {});
const cold = await page.evaluate(() => (document.getElementById('plQ') || {}).value || '');
check(cold.includes('zimnystart'), 'udostępnienie przy zamkniętej aplikacji otwiera "Nowe miejsce"', cold);

// 4b. Udostępnij -> AlvaTour (aplikacja otwarta)
await page.evaluate(() => closeModal());
const aiJson = '{"alvatour":1,"places":[{"name":"Livraria Lello","city":"Porto","country":"Portugalia"}]}';
sh(`am start -n ${ACTIVITY} -a android.intent.action.SEND -t text/plain --es android.intent.extra.TEXT '${aiJson}'`);
await page.waitForSelector('#aiText', { timeout: 30000 }).catch(() => {});
const warm = await page.evaluate(() => (document.getElementById('aiText') || {}).value || '');
check(warm.includes('Livraria Lello'), 'odpowiedź AI udostępniona do otwartej aplikacji otwiera "Plan od AI"', warm.slice(0, 80));
await page.evaluate(() => closeModal());

// 5b. aktualizacja w aplikacji: pobranie z GitHuba + kontrola (ta sama aplikacja, ten sam klucz)
const devUrl = process.env.PREV_DEV_URL || '';
const prodUrl = process.env.PREV_PROD_URL || '';
const tryDownload = (url) => page.evaluate(async (u) => {
  try { return await AlvaNative.downloadUpdate({ url: u, size: 0, sha256: '' }); } catch (e) { return { error: String((e && e.message) || e) }; }
}, url);
if (devUrl) {
  const r = await tryDownload(devUrl);
  check(!r.error && r.packageName === PKG, 'aktualizacja w aplikacji: pobranie APK DEV z GitHuba i kontrola podpisu', JSON.stringify(r));
} else console.log('(brak poprzedniej wersji DEV do testu pobierania)');
if (prodUrl) {
  const r = await tryDownload(prodUrl);
  check(r.error && /inna aplikacja/.test(r.error), 'aktualizacja w aplikacji: DEV odrzuca plik wersji produkcyjnej', JSON.stringify(r));
}

// 6. brak awarii
const fatal = sh('logcat -d -b crash 2>/dev/null || true') + sh(`logcat -d | grep -E "FATAL EXCEPTION|AndroidRuntime: Process: ${PKG}" || true`);
check(!/FATAL EXCEPTION/.test(fatal), 'brak awarii w logach', fatal.slice(0, 300));

// 5. kopia przetrwa odinstalowanie
sh(`am force-stop ${PKG}`);
adb('uninstall', PKG);
const after = sh(`ls ${DOCS} 2>/dev/null || true`);
check(after.includes(r1.backup.name), 'kopia w Documents po odinstalowaniu aplikacji', after.replace(/\n/g, ', '));

await device.close();
if (failures) { console.error(`\n${failures} sprawdzeń nie przeszło.`); process.exit(1); }
console.log('\nWszystkie sprawdzenia na emulatorze przeszły.');
