// Porównywanie wersji (semver z wersjami testowymi: 1.0.0-test.12 < 1.0.0 < 1.0.1).
export function parseVersion(v) {
  const m = String(v || '').replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
  if (!m) return null;
  return { nums: [+m[1], +m[2], +m[3]], pre: m[4] ? m[4].split('.') : [] };
}
export function compareVersions(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) if (x.nums[i] !== y.nums[i]) return x.nums[i] < y.nums[i] ? -1 : 1;
  if (!x.pre.length || !y.pre.length) return x.pre.length === y.pre.length ? 0 : x.pre.length ? -1 : 1;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    const pn = /^\d+$/.test(p), qn = /^\d+$/.test(q);
    if (pn && qn && +p !== +q) return +p < +q ? -1 : 1;
    if (pn !== qn) return pn ? -1 : 1;
    if (!pn && p !== q) return p < q ? -1 : 1;
  }
  return 0;
}

/**
 * Wybiera aktualizację z listy wydań GitHub. Wersja produkcyjna patrzy tylko na pełne wydania,
 * DEV także na testowe. Zwraca { version, url, page, notes } albo null.
 */
export function pickUpdate(releases, { current, dev }) {
  const list = (releases || []).filter((r) => !r.draft && (dev || !r.prerelease));
  let best = null;
  for (const r of list) {
    const v = String(r.tag_name || '').replace(/^v/, '');
    if (!parseVersion(v) || compareVersions(v, current) <= 0) continue;
    if (best && compareVersions(v, best.version) <= 0) continue;
    const want = dev ? /^AlvaTour-DEV-.*\.apk$/ : /^AlvaTour-(?!DEV-).*\.apk$/;
    const asset = (r.assets || []).find((a) => want.test(a.name));
    if (!asset) continue;
    best = { version: v, url: asset.browser_download_url, page: r.html_url, notes: r.body || '', prerelease: !!r.prerelease };
  }
  return best;
}
