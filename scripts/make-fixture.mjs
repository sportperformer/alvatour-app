// Tworzy fixture tests/fixtures/apk-<wersja>-export.json: eksport przykładowych danych w formacie bieżącej wersji.
// Przy każdym wydaniu: node scripts/make-fixture.mjs (test pilnuje, że fixture dla wersji z package.json istnieje).
// Fixtures nigdy nie zawierają prawdziwych danych (repozytorium jest publiczne).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { buildBackup, serializeBackup } from '../src/data/format.js';
import { SCHEMA_VERSION } from '../src/data/schema.js';
import { sampleState } from '../tests/helpers/env.js';

const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version;
const out = new URL(`../tests/fixtures/apk-${version}-export.json`, import.meta.url);
if (existsSync(out)) { console.log('Fixture już istnieje (nie nadpisuję):', out.pathname); process.exit(0); }
const b = await buildBackup(sampleState(), { schemaVersion: SCHEMA_VERSION, appVersion: version, reason: 'manual', now: new Date('2026-10-06T12:00:00Z') });
writeFileSync(out, serializeBackup(b) + '\n');
console.log('Zapisano', out.pathname);
