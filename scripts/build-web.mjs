// Buduje katalog www/ (pliki pakowane do APK) z katalogu src/.
// Wersję aplikacji bierze z package.json albo ze zmiennej ALVATOUR_VERSION_NAME (ustawianej w GitHub Actions).
// Klucz mapy Google bierze ze zmiennej ALVATOUR_MAPS_KEY (GitHub Secrets); bez niego plany pokazują tylko listę.
import { cpSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, sep } from 'node:path';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const out = join(root, 'www');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = process.env.ALVATOUR_VERSION_NAME || pkg.version;

rmSync(out, { recursive: true, force: true });
// src/data/, src/native/ i src/maps/ to moduły ES: trafiają do www/ jako data.js (window.AlvaData),
// native.js (window.AlvaNative) i maps.js (window.AlvaMaps)
const modules = ['data', 'native', 'maps'];
cpSync(src, out, { recursive: true, filter: (p) => !modules.some((m) => p === join(src, m) || p.startsWith(join(src, m) + sep)) });
for (const m of modules) {
  await build({
    entryPoints: [join(src, m, 'main.js')],
    bundle: true,
    format: 'iife',
    target: ['chrome100'],
    outfile: join(out, m + '.js'),
    legalComments: 'none',
    logLevel: 'warning',
  });
}

const corePath = join(out, 'core.js');
const core = readFileSync(corePath, 'utf8');
const re = /const APP_VERSION = '[^']*';/;
if (!re.test(core)) throw new Error('Nie znaleziono APP_VERSION w core.js');
writeFileSync(corePath, core.replace(re, `const APP_VERSION = '${version}';`));

const mapsKey = (process.env.ALVATOUR_MAPS_KEY || '').trim();
if (mapsKey) {
  if (!/^[A-Za-z0-9_-]{20,60}$/.test(mapsKey)) throw new Error('ALVATOUR_MAPS_KEY ma nieprawidłowy format');
  const mapsPath = join(out, 'maps.js');
  const js = readFileSync(mapsPath, 'utf8');
  if (!js.includes('__ALVATOUR_MAPS_KEY__')) throw new Error('Brak miejsca na klucz mapy w maps.js');
  writeFileSync(mapsPath, js.replace('__ALVATOUR_MAPS_KEY__', mapsKey));
}

for (const f of ['index.html', 'data.js', 'native.js', 'maps.js', 'countries.json', 'meta.json', 'fonts/fonts.css']) {
  if (!existsSync(join(out, f))) throw new Error('Brak pliku w www: ' + f);
}
console.log(`www/ gotowe (wersja ${version}${mapsKey ? ', z kluczem mapy Google' : ', bez klucza mapy Google'})`);
