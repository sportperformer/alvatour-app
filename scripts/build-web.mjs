// Buduje katalog www/ (pliki pakowane do APK) z katalogu src/.
// Wersję aplikacji bierze z package.json albo ze zmiennej ALVATOUR_VERSION_NAME (ustawianej w GitHub Actions).
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
// src/data/ i src/native/ to moduły ES: trafiają do www/ jako data.js (window.AlvaData) i native.js (window.AlvaNative)
const modules = ['data', 'native'];
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

for (const f of ['index.html', 'data.js', 'native.js', 'countries.json', 'meta.json', 'fonts/fonts.css']) {
  if (!existsSync(join(out, f))) throw new Error('Brak pliku w www: ' + f);
}
console.log(`www/ gotowe (wersja ${version})`);
