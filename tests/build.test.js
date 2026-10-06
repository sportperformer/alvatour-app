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
