// Opis wydania po polsku: sekcja z CHANGELOG.md dla danej wersji + instrukcja instalacji.
// Użycie: node scripts/release-notes.mjs <wersja> <prerelease:true|false>
import { readFileSync } from 'node:fs';

const [version = '', prerelease = 'true'] = process.argv.slice(2);
const base = version.split('-')[0];
const log = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const sections = log.split(/^## /m).slice(1);
const section = sections.find((s) => s.split('\n')[0].trim().startsWith(base));
const changes = section ? section.split('\n').slice(1).join('\n').trim() : '- (brak opisu zmian)';

const out = [];
if (prerelease === 'true') {
  out.push('> **Wersja testowa.** Instaluj tylko plik **AlvaTour-DEV**. Wersja produkcyjna pojawi się po Twoim sprawdzeniu.', '');
}
out.push(`## Zmiany w ${base}`, '', changes, '');
out.push('## Pliki', '');
out.push(`- \`AlvaTour-${version}.apk\`: AlvaTour (Twoje prawdziwe dane)`);
out.push(`- \`AlvaTour-DEV-${version}.apk\`: AlvaTour DEV (wersja testowa, osobne dane)`);
out.push('', 'Instalacja na telefonie: kliknij plik, potem **Otwórz** i **Zainstaluj** (lub **Aktualizuj**). Dane zostają.');
process.stdout.write(out.join('\n') + '\n');
