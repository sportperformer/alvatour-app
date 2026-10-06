// Format pliku kopii / eksportu AlvaTour i jego odczyt (z walidacją).
//
// {
//   "app": "alvatour", "format_version": 1, "schema_version": 1,
//   "exported_at": "...", "app_version": "1.0.0", "reason": "manual",
//   "counts": { countries, wishes, visits, places, notes, badges },
//   "checksum": "sha256:<hex z canonicalJSON(data)>",
//   "data": { ...stan aplikacji... }
// }
//
// Odczyt przyjmuje też: eksport z wersji webowej ({ app: 'alvatour', exportedAt, countries, ... })
// oraz surowy stan z pamięci przeglądarki (alvatour-v1, bylem-tu-v1).

import { normalizeState, countsOf, sameCounts, canonicalJSON, sha256, COUNT_KEYS } from './model.js';

export const FORMAT_VERSION = 1;

export async function buildBackup(state, { schemaVersion, appVersion, reason = 'manual', now = new Date() }) {
  const data = normalizeState(state);
  return {
    app: 'alvatour',
    format_version: FORMAT_VERSION,
    schema_version: schemaVersion,
    exported_at: now.toISOString(),
    app_version: appVersion,
    reason,
    counts: countsOf(data),
    checksum: 'sha256:' + await sha256(canonicalJSON(data)),
    data,
  };
}

export const serializeBackup = (b) => JSON.stringify(b, null, 1);

const fail = (error) => ({ ok: false, error });

/**
 * Czyta tekst kopii. Zwraca { ok: true, state, info } albo { ok: false, error } (komunikat po polsku).
 * info: { kind: 'alvatour'|'web'|'raw', exportedAt, appVersion, schemaVersion, reason, counts }
 */
export async function parseBackup(text) {
  let obj;
  try { obj = JSON.parse(String(text || '').replace(/^﻿/, '')); } catch (e) { return fail('To nie jest plik z kopią AlvaTour (niepoprawny JSON).'); }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return fail('To nie jest plik z kopią AlvaTour.');

  if (obj.format_version !== undefined) {
    if (obj.app !== 'alvatour') return fail('To nie jest plik z kopią AlvaTour.');
    if (!Number.isInteger(obj.format_version) || obj.format_version < 1) return fail('Nieznany format kopii.');
    if (obj.format_version > FORMAT_VERSION) return fail('Ta kopia pochodzi z nowszej wersji AlvaTour. Zaktualizuj aplikację i spróbuj ponownie.');
    if (!obj.data || typeof obj.data !== 'object' || typeof obj.data.countries !== 'object') return fail('W pliku brakuje danych.');
    if (typeof obj.checksum === 'string' && obj.checksum.startsWith('sha256:')) {
      const sum = await sha256(canonicalJSON(obj.data));
      if ('sha256:' + sum !== obj.checksum) return fail('Plik kopii jest uszkodzony (suma kontrolna się nie zgadza). Nic nie zostało zmienione.');
    }
    const state = normalizeState(obj.data);
    const counts = countsOf(state);
    if (obj.counts && COUNT_KEYS.some((k) => k in obj.counts) && !sameCounts(counts, { ...counts, ...obj.counts })) {
      return fail('Kopia jest niekompletna (liczby krajów lub miejsc się nie zgadzają). Nic nie zostało zmienione.');
    }
    return { ok: true, state, info: { kind: 'alvatour', exportedAt: obj.exported_at || null, appVersion: obj.app_version || null, schemaVersion: obj.schema_version ?? null, reason: obj.reason || null, counts } };
  }

  if (obj.countries && typeof obj.countries === 'object' && !Array.isArray(obj.countries)) {
    const state = normalizeState(obj);
    const kind = obj.app === 'alvatour' ? 'web' : 'raw';
    return { ok: true, state, info: { kind, exportedAt: obj.exportedAt || obj.updatedAt || null, appVersion: null, schemaVersion: null, reason: null, counts: countsOf(state) } };
  }
  return fail('W pliku brakuje listy krajów. Czy to na pewno kopia z AlvaTour?');
}
