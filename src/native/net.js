// Zapytania do wyszukiwarek adresów (Nominatim, Photon): nagłówek User-Agent, limit 1 zapytanie na sekundę, pamięć wyników.
// request(url, headers) -> Promise<{ status, data, url }> jest wstrzykiwany (na telefonie CapacitorHttp).

export function createGeoHttp({ request, userAgent, now = () => Date.now(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)), minGapMs = 1100, cacheSize = 300, cacheTtlMs = 24 * 3600 * 1000 }) {
  const cache = new Map();
  let chain = Promise.resolve();
  let last = -Infinity;

  async function throttled(fn) {
    const run = chain.then(async () => {
      const wait = last + minGapMs - now();
      if (wait > 0) await sleep(wait);
      try { return await fn(); } finally { last = now(); }
    });
    chain = run.catch(() => {});
    return run;
  }

  return {
    /** GET JSON. Ten sam adres w ciągu doby: wynik z pamięci, bez zapytania do serwera. */
    async getJSON(url) {
      const hit = cache.get(url);
      if (hit && now() - hit.at < cacheTtlMs) return hit.data;
      const res = await throttled(() => request(url, { 'User-Agent': userAgent, Accept: 'application/json', 'Accept-Language': 'pl' }));
      if (!res || res.status < 200 || res.status >= 300) throw new Error('HTTP ' + (res && res.status));
      const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      cache.set(url, { at: now(), data });
      if (cache.size > cacheSize) cache.delete(cache.keys().next().value);
      return data;
    },
  };
}
