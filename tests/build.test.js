// Testy-strażnicy: pilnują zasad, których złamanie mogłoby kosztować dane albo działanie offline.
import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

describe('identyfikator aplikacji (nigdy się nie zmienia)', () => {
  it('capacitor.config.json: appId produkcyjny i brak ładowania z internetu', () => {
    const cfg = JSON.parse(read('capacitor.config.json'));
    expect(cfg.appId).toBe('pl.sportperformer.alvatour');
    expect(cfg.webDir).toBe('www');
    expect(cfg.server?.url).toBeUndefined();
  });
  it('android/app/build.gradle: applicationId prod i sufiks .dev', () => {
    const g = read('android/app/build.gradle');
    expect(g).toMatch(/applicationId "pl\.sportperformer\.alvatour"/);
    expect(g).toMatch(/dev \{[^}]*applicationIdSuffix '\.dev'/);
    expect(g).not.toMatch(/prod \{[^}]*applicationIdSuffix/);
  });
  it('wariant DEV ma własną nazwę', () => {
    expect(read('android/app/src/dev/res/values/strings.xml')).toContain('AlvaTour DEV');
  });
});

describe('www/ (pliki w APK)', () => {
  beforeAll(() => {
    execFileSync('node', ['scripts/build-web.mjs'], { cwd: root, env: { ...process.env, ALVATOUR_VERSION_NAME: '9.8.7' } });
  });
  it('wstawia wersję aplikacji', () => {
    expect(read('www/core.js')).toContain("const APP_VERSION = '9.8.7';");
  });
  it('wszystkie skrypty i style z index.html istnieją', () => {
    const html = read('www/index.html');
    const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(5);
    for (const r of refs) expect(existsSync(join(root, 'www', r)), r).toBe(true);
  });
  it('czcionki są lokalne, bez CDN', () => {
    const css = read('www/fonts/fonts.css');
    for (const m of css.matchAll(/url\(([^)]+)\)/g)) expect(existsSync(join(root, 'www/fonts', m[1])), m[1]).toBe(true);
    for (const fam of ['Bricolage Grotesque', 'Instrument Sans', 'Special Elite']) expect(css).toContain(`'${fam}'`);
  });
  it('żadnych zasobów z zewnętrznych serwerów (CDN, Google Fonts)', () => {
    const files = ['index.html', 'app.css', ...readdirSync(join(root, 'www')).filter((f) => f.endsWith('.js'))];
    for (const f of files) {
      const t = read('www/' + f);
      expect(t, f).not.toMatch(/fonts\.googleapis|fonts\.gstatic|cdn\.|unpkg|jsdelivr/);
      expect(t, f).not.toMatch(/<script[^>]+src="https?:/);
    }
  });
  it('bez service workera, manifestu PWA i bez kasowania cache', () => {
    const all = readdirSync(join(root, 'www')).filter((f) => /\.(js|html)$/.test(f)).map((f) => read('www/' + f)).join('\n');
    expect(all).not.toMatch(/serviceWorker\.register/);
    expect(all).not.toMatch(/caches\.delete/);
    expect(all).not.toMatch(/rel="manifest"/);
    expect(existsSync(join(root, 'www/sw.js'))).toBe(false);
  });
});

describe('klucz podpisu', () => {
  it('odcisk certyfikatu jest zapisany (build sprawdza, że APK podpisano zawsze tym samym kluczem)', () => {
    expect(read('android/signing-cert-sha256.txt').trim()).toMatch(/^[0-9a-f]{64}$/);
  });
  it('w repozytorium nie ma żadnego pliku klucza', () => {
    const out = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
    expect(out).not.toMatch(/\.(jks|keystore|p12|pfx)$/m);
  });
});

describe('dane: zasady nienaruszalne', () => {
  it('kod interfejsu nie zapisuje danych sam (tylko przez AlvaData)', () => {
    for (const f of ['core.js', 'globe.js', 'panel.js', 'views.js', 'fun.js', 'places.js', 'main.js']) {
      const t = read('src/' + f);
      expect(t, f).not.toMatch(/localStorage|indexedDB|CapacitorSQLite/);
    }
  });
  it('kod nie czyści cudzych danych ani pamięci podręcznej', () => {
    const all = ['core.js', 'globe.js', 'panel.js', 'views.js', 'fun.js', 'places.js', 'main.js'].map((f) => read('src/' + f)).join('\n')
      + readdirSync(join(root, 'src/data')).map((f) => read('src/data/' + f)).join('\n');
    expect(all).not.toMatch(/caches\.delete|localStorage\.clear|removeItem\(|indexedDB\.deleteDatabase|deleteDatabase\(/);
  });
  it('www zawiera warstwę danych i funkcje telefonu, ładowane przed kodem aplikacji', () => {
    const html = read('www/index.html');
    for (const f of ['native.js', 'data.js']) {
      expect(existsSync(join(root, 'www', f)), f).toBe(true);
      expect(html.indexOf(f), f).toBeLessThan(html.indexOf('core.js'));
    }
  });
  it('kopia Google (Auto Backup) jest włączona i obejmuje bazę', () => {
    const m = read('android/app/src/main/AndroidManifest.xml');
    expect(m).toMatch(/android:allowBackup="true"/);
    expect(m).toMatch(/android:dataExtractionRules="@xml\/data_extraction_rules"/);
    expect(m).toMatch(/android:fullBackupContent="@xml\/backup_rules"/);
    const rules = read('android/app/src/main/res/xml/data_extraction_rules.xml');
    expect(rules.match(/domain="database"/g)).toHaveLength(2);
    expect(read('android/app/src/main/res/xml/backup_rules.xml')).toMatch(/domain="database"/);
  });
});

describe('Android: udostępnianie do aplikacji i API telefonu', () => {
  it('AlvaTour jest na liście "Udostępnij" dla tekstu (Google Maps, Claude, Gemini)', () => {
    const m = read('android/app/src/main/AndroidManifest.xml');
    expect(m).toMatch(/<action android:name="android.intent.action.SEND" \/>[\s\S]*?<data android:mimeType="text\/plain" \/>/);
    expect(m).toMatch(/android:launchMode="singleTask"/);
    expect(read('android/app/src/main/java/pl/sportperformer/alvatour/MainActivity.java')).toMatch(/registerPlugin\(ShareTargetPlugin\.class\)/);
  });
  it('kod aplikacji nie używa API przeglądarki, które w WebView nie działają', () => {
    for (const f of ['core.js', 'globe.js', 'panel.js', 'views.js', 'fun.js', 'places.js', 'main.js']) {
      const t = read('src/' + f);
      expect(t, f).not.toMatch(/navigator\.(share|canShare|clipboard|vibrate)|\.download = |fetch\((?!DATA_URL|META_URL)/); // lokalne pliki z paczki APK są OK
    }
  });
});

describe('debugowanie WebView', () => {
  it('włączone tylko w wariancie DEV (testy na emulatorze), nigdy w produkcji', () => {
    const m = read('android/app/src/main/java/pl/sportperformer/alvatour/MainActivity.java');
    expect(m).toMatch(/if \("dev"\.equals\(BuildConfig\.FLAVOR\)\) \{\s*WebView\.setWebContentsDebuggingEnabled\(true\);/);
    expect(m.match(/setWebContentsDebuggingEnabled/g)).toHaveLength(1);
    expect(JSON.parse(read('capacitor.config.json')).android.webContentsDebuggingEnabled).toBeUndefined();
  });
});
