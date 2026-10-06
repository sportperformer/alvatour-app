// Opis wydania po polsku: zmiany z CHANGELOG.md od ostatniej wersji produkcyjnej + instrukcja instalacji.
// Użycie: node scripts/release-notes.mjs <wersja> <prerelease:true|false> [ostatnia-wersja-produkcyjna]
import { readFileSync } from 'node:fs';

const [version = '', prerelease = 'true', lastProd = ''] = process.argv.slice(2);
const base = version.split('-')[0];
const num = (v) => String(v).replace(/^v/, '').split('-')[0].split('.').map(Number);
const cmp = (a, b) => { const x = num(a), y = num(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };
const log = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const sections = log.split(/^## /m).slice(1).map((s) => ({ v: s.split('\n')[0].trim(), body: s.split('\n').slice(1).join('\n').trim() }));
// wszystkie wersje nowsze niż ostatnia produkcyjna (a nie nowsze niż ta), od najnowszej
const picked = sections.filter((s) => cmp(s.v, base) <= 0 && (!lastProd || cmp(s.v, lastProd) > 0));
if (!picked.length) { const own = sections.find((s) => s.v.startsWith(base)); if (own) picked.push(own); }
const changes = picked.length
  ? picked.map((s, i) => (picked.length > 1 ? `### ${s.v}\n\n${s.body}` : s.body)).join('\n\n')
  : '- (brak opisu zmian)';

const out = [];
if (prerelease === 'true') {
  out.push('> **Wersja testowa.** Instaluj tylko plik **AlvaTour-DEV**. Wersja produkcyjna pojawi się po Twoim sprawdzeniu.', '');
}
out.push(lastProd ? `## Zmiany od wersji ${String(lastProd).replace(/^v/, '')}` : `## Zmiany w ${base}`, '', changes, '');
out.push('## Pliki', '');
out.push(`- \`AlvaTour-${version}.apk\`: AlvaTour (Twoje prawdziwe dane)`);
out.push(`- \`AlvaTour-DEV-${version}.apk\`: AlvaTour DEV (wersja testowa, osobne dane)`);
out.push('', '**Masz już AlvaTour (od 1.1.0)?** W aplikacji: **Ustawienia** → **Sprawdź aktualizację** → **Pobierz i zainstaluj**. Dane zostają.');
out.push('', '**Pierwsza instalacja:** pobierz plik i wybierz **Zainstaluj**. Jeśli Chrome zatrzyma pobieranie na 100%, pobierz plik na komputerze i otwórz go na telefonie z Dysku Google.');
process.stdout.write(out.join('\n') + '\n');
