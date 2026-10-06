import { describe, it, expect } from 'vitest';
import { createGeoHttp } from '../src/native/net.js';
import { compareVersions, pickUpdate } from '../src/native/version.js';

describe('wyszukiwarka adresów: limit i pamięć', () => {
  function fake() {
    let t = 0;
    const calls = [];
    const now = () => t;
    const sleep = async (ms) => { t += ms; };
    const request = async (url, headers) => { calls.push({ url, headers, at: t }); return { status: 200, data: JSON.stringify([{ url }]) }; };
    return { calls, now, sleep, request };
  }
  it('najwyżej 1 zapytanie na sekundę, nagłówek User-Agent AlvaTour', async () => {
    const f = fake();
    const http = createGeoHttp({ ...f, userAgent: 'AlvaTour/1.0.0 (kontakt: kamilmits@gmail.com)' });
    await Promise.all(['a', 'b', 'c'].map((q) => http.getJSON('https://nominatim.openstreetmap.org/search?q=' + q)));
    expect(f.calls).toHaveLength(3);
    expect(f.calls[1].at - f.calls[0].at).toBeGreaterThanOrEqual(1100);
    expect(f.calls[2].at - f.calls[1].at).toBeGreaterThanOrEqual(1100);
    expect(f.calls[0].headers['User-Agent']).toBe('AlvaTour/1.0.0 (kontakt: kamilmits@gmail.com)');
  });
  it('ten sam adres drugi raz: z pamięci, bez zapytania', async () => {
    const f = fake();
    const http = createGeoHttp({ ...f, userAgent: 'x' });
    const a = await http.getJSON('u1');
    const b = await http.getJSON('u1');
    expect(b).toEqual(a);
    expect(f.calls).toHaveLength(1);
  });
  it('błąd serwera nie trafia do pamięci', async () => {
    let n = 0;
    const http = createGeoHttp({ request: async () => (++n === 1 ? { status: 503, data: '' } : { status: 200, data: '[]' }), userAgent: 'x', sleep: async () => {} });
    await expect(http.getJSON('u')).rejects.toThrow('HTTP 503');
    await expect(http.getJSON('u')).resolves.toEqual([]);
  });
});

describe('wersje i aktualizacje', () => {
  it('porównuje wersje testowe i produkcyjne', () => {
    expect(compareVersions('1.0.0-test.9', '1.0.0-test.12')).toBe(-1);
    expect(compareVersions('1.0.0-test.12', '1.0.0')).toBe(-1);
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
    expect(compareVersions('v1.2.0', '1.2.0')).toBe(0);
  });
  const rel = (tag, pre, names) => ({ tag_name: tag, prerelease: pre, draft: false, html_url: 'https://github.com/x/' + tag, body: '- zmiana', assets: names.map((n) => ({ name: n, browser_download_url: 'https://dl/' + n, size: 12750000, digest: 'sha256:' + 'ab'.repeat(32) })) });
  const releases = [
    rel('v1.1.0-test.20', true, ['AlvaTour-1.1.0-test.20.apk', 'AlvaTour-DEV-1.1.0-test.20.apk']),
    rel('v1.0.1', false, ['AlvaTour-1.0.1.apk', 'AlvaTour-DEV-1.0.1.apk']),
    rel('v1.0.0', false, ['AlvaTour-1.0.0.apk', 'AlvaTour-DEV-1.0.0.apk']),
  ];
  it('wersja produkcyjna widzi tylko pełne wydania i bierze swój plik', () => {
    expect(pickUpdate(releases, { current: '1.0.0', dev: false })).toMatchObject({ version: '1.0.1', url: 'https://dl/AlvaTour-1.0.1.apk', size: 12750000, sha256: 'ab'.repeat(32) });
    expect(pickUpdate(releases, { current: '1.0.1', dev: false })).toBe(null);
  });
  it('DEV widzi też wersje testowe i bierze plik DEV', () => {
    expect(pickUpdate(releases, { current: '1.0.1', dev: true })).toMatchObject({ version: '1.1.0-test.20', url: 'https://dl/AlvaTour-DEV-1.1.0-test.20.apk', prerelease: true });
  });
});
