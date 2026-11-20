// Mapa Google i import z Google Moje Mapy dla "Planów zwiedzania" (bundlowane do www/maps.js jako window.AlvaMaps).

import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import { myMapsId, myMapsKmlUrl, parseKml } from '../native/parsers.js';
import { routeUrl, parseRoute, tourOrder, distM, googleDirUrl, MAX_STOPS } from './route.js';

const isNative = Capacitor.isNativePlatform();
const LocationSettings = registerPlugin('LocationSettings');
// Klucz Google Maps (JavaScript API) wstawiany przy buildzie z GitHub Secrets (ALVATOUR_MAPS_KEY); nie ma go w repozytorium.
// Zabezpieczenie po stronie Google: tylko witryna https://localhost/* (czyli ta aplikacja) i tylko interfejsy map.
const MAPS_KEY = '__ALVATOUR_MAPS_KEY__';
let mapsPromise = null;

async function fetchText(url) {
  if (isNative) {
    const r = await CapacitorHttp.request({ url, method: 'GET', headers: { Accept: '*/*' }, connectTimeout: 15000, readTimeout: 20000, responseType: 'text' });
    if (r.status < 200 || r.status >= 300) throw new Error('Serwer odpowiedział kodem ' + r.status);
    return typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error('Serwer odpowiedział kodem ' + r.status);
  return r.text();
}

async function fetchJSON(url) {
  if (isNative) {
    const r = await CapacitorHttp.request({ url, method: 'GET', headers: { Accept: 'application/json', 'User-Agent': 'AlvaTour/1.2 (Android; prywatna aplikacja podróżnicza)' }, connectTimeout: 15000, readTimeout: 20000, responseType: 'json' });
    const data = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
    if ((r.status < 200 || r.status >= 300) && !(data && data.code)) throw new Error('Serwer odpowiedział kodem ' + r.status);
    return data;
  }
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  const data = await r.json().catch(() => null);
  if (!r.ok && !(data && data.code)) throw new Error('Serwer odpowiedział kodem ' + r.status);
  return data;
}

const AlvaMaps = {
  /** Trasa piesza: points [{lat,lng}...] (start, przystanki, cel), stopNames: nazwy celów kolejnych odcinków. */
  async walkRoute(points, stopNames = []) {
    let json;
    try { json = await fetchJSON(routeUrl(points)); } catch (e) { throw new Error('Nie udało się pobrać trasy. Sprawdź internet. (' + ((e && e.message) || e) + ')'); }
    return parseRoute(json, stopNames);
  },
  tourOrder, distM, googleDirUrl, MAX_STOPS,

  /** Lokalizacja w telefonie: gdy wyłączona, systemowe okno "Włączyć lokalizację?". { enabled, how }. */
  async ensureLocation() {
    if (!isNative) return { enabled: true, how: 'web' };
    try { return await LocationSettings.ensureEnabled(); } catch (e) { return { enabled: true, how: 'unknown' }; }
  },

  hasKey: () => !!MAPS_KEY && !MAPS_KEY.startsWith('__'),
  myMapsId,

  /** Link do Moich Map -> { name, items }. Błędy po polsku. */
  async importMyMaps(link) {
    const mid = myMapsId(link);
    if (!mid) throw new Error('To nie wygląda na link do mapy z Google Moje Mapy (brak „mid=” w adresie).');
    let text;
    try { text = await fetchText(myMapsKmlUrl(mid)); } catch (e) { throw new Error('Nie udało się pobrać mapy. Sprawdź internet. (' + ((e && e.message) || e) + ')'); }
    if (!/<kml[\s>]/.test(text)) throw new Error('Google nie oddał mapy. W Moich Mapach: Udostępnij → „Każdy, kto ma link, może wyświetlać”, potem spróbuj ponownie.');
    const map = parseKml(text);
    if (!map.items.length) throw new Error('Na tej mapie nie ma żadnych pinów.');
    return { ...map, mid };
  },

  /** Ładuje Google Maps JavaScript API (raz). Zwraca google.maps albo rzuca błąd z opisem po polsku. */
  load() {
    if (!AlvaMaps.hasKey()) return Promise.reject(new Error('Ta wersja aplikacji nie ma klucza mapy Google.'));
    if (window.google && window.google.maps && window.google.maps.Map) return Promise.resolve(window.google.maps);
    if (mapsPromise) return mapsPromise;
    mapsPromise = new Promise((resolve, reject) => {
      const fail = (msg) => { clearTimeout(t); mapsPromise = null; reject(new Error(msg)); };
      const t = setTimeout(() => fail('Mapa Google nie odpowiada. Sprawdź internet.'), 20000);
      window.__alvaMapsReady = () => { clearTimeout(t); resolve(window.google.maps); };
      window.gm_authFailure = () => {
        fail('Google odrzucił klucz mapy (ograniczenia klucza albo płatności w Google Cloud).');
        if (AlvaMaps.onAuthFailure) AlvaMaps.onAuthFailure();
      };
      const sc = document.createElement('script');
      sc.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_KEY)}&v=weekly&libraries=marker&language=pl&loading=async&callback=__alvaMapsReady`;
      sc.async = true;
      sc.onerror = () => { sc.remove(); fail('Nie udało się załadować mapy Google. Sprawdź internet.'); };
      document.head.appendChild(sc);
    });
    return mapsPromise;
  },
  onAuthFailure: null,
};

window.AlvaMaps = AlvaMaps;
