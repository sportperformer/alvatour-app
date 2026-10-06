// Funkcje telefonu dla kodu aplikacji (bundlowane do www/native.js jako window.AlvaNative i window.AlvaParsers).
// Na telefonie: wtyczki Capacitor. W przeglądarce komputera (podgląd): zamienniki webowe.

import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Haptics } from '@capacitor/haptics';
import { Clipboard } from '@capacitor/clipboard';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { Filesystem, Directory } from '@capacitor/filesystem';
import * as parsers from './parsers.js';
import { createGeoHttp } from './net.js';
import { pickUpdate, compareVersions } from './version.js';

const isNative = Capacitor.isNativePlatform();
const ShareTarget = registerPlugin('ShareTarget');
const AppUpdater = registerPlugin('AppUpdater');
const REPO = 'sportperformer/alvatour-app';
let appVersion = '0.0.0';
let isDev = false;

const isCancel = (e) => /cancel|abort/i.test(String((e && (e.name + ' ' + e.message)) || e));

async function httpRequest(url, headers) {
  if (isNative) {
    const r = await CapacitorHttp.request({ url, method: 'GET', headers, connectTimeout: 10000, readTimeout: 15000 });
    return { status: r.status, data: r.data, url: r.url };
  }
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 10000);
  try {
    // przeglądarka nie pozwala ustawić User-Agent: wysyłamy resztę nagłówków
    const { 'User-Agent': _ua, ...rest } = headers || {};
    const r = await fetch(url, { headers: rest, signal: ctl.signal });
    return { status: r.status, data: await r.text(), url: r.url };
  } finally { clearTimeout(t); }
}

let geo = null;
const geoHttp = () => (geo ||= createGeoHttp({ request: httpRequest, userAgent: `AlvaTour/${appVersion} (kontakt: kamilmits@gmail.com)` }));

const AlvaNative = {
  isNative,
  get isDev() { return isDev; },

  async init(version) {
    appVersion = version;
    if (isNative) {
      try { isDev = /\.dev$/.test((await App.getInfo()).id || ''); } catch (e) { /* */ }
    }
  },

  /** Zapytanie do wyszukiwarki adresów (limit 1/s, pamięć wyników, User-Agent AlvaTour). */
  geoJSON: (url) => geoHttp().getJSON(url),

  /** Rozwija krótki link Google Maps (maps.app.goo.gl) do pełnego adresu ze współrzędnymi. */
  async expandMapsLink(url) {
    if (!isNative || !parsers.isShortMapsLink(url)) return null;
    try {
      const r = await CapacitorHttp.request({ url, method: 'GET', connectTimeout: 8000, readTimeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AlvaTour' } });
      if (r.url && r.url !== url) return r.url;
      const m = typeof r.data === 'string' && r.data.match(/https:\/\/www\.google\.[a-z.]+\/maps\/[^"'\s<>]+/);
      return m ? m[0].replace(/&amp;/g, '&') : null;
    } catch (e) { return null; }
  },

  /** Systemowe "Udostępnij" dla tekstu (np. prompt do aplikacji AI). Zwraca false, gdy anulowano. */
  async shareText(text, title = 'AlvaTour') {
    try {
      if (isNative) await Share.share({ title, text, dialogTitle: 'Wyślij do aplikacji AI' });
      else if (navigator.share) await navigator.share({ text });
      else throw new Error('brak udostępniania');
      return true;
    } catch (e) { if (isCancel(e)) return false; throw e; }
  },

  /** Udostępnia obrazek PNG (data URL). */
  async shareImage(dataUrl, fileName, text) {
    try {
      if (isNative) {
        const { uri } = await Filesystem.writeFile({ path: `udostepnij/${fileName}`, data: dataUrl.split(',')[1], directory: Directory.Cache, recursive: true });
        await Share.share({ title: 'AlvaTour', text, files: [uri], dialogTitle: 'Udostępnij kartę podróżnika' });
        return true;
      }
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'AlvaTour', text }); return true; }
      const a = document.createElement('a'); a.href = dataUrl; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
      return true;
    } catch (e) { if (isCancel(e)) return false; throw e; }
  },

  async copy(text) {
    if (isNative) { await Clipboard.write({ string: text }); return; }
    await navigator.clipboard.writeText(text);
  },

  /** Wibracja: liczba = ms, tablica = [wibracja, przerwa, wibracja, ...]. */
  vibrate(pattern) {
    if (!isNative) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* */ } return; }
    const seq = Array.isArray(pattern) ? pattern : [pattern];
    let t = 0;
    seq.forEach((ms, i) => {
      if (i % 2 === 0) setTimeout(() => { Haptics.vibrate({ duration: Math.max(10, ms) }).catch(() => {}); }, t);
      t += ms;
    });
  },

  /** Otwiera adres w przeglądarce (np. pobranie APK z GitHub Releases). */
  async openUrl(url) {
    if (isNative) await Browser.open({ url });
    else window.open(url, '_blank', 'noopener');
  },

  /** Sprawdza GitHub Releases. Zwraca { update: {...} | null, current }. */
  async checkUpdate() {
    const r = await httpRequest(`https://api.github.com/repos/${REPO}/releases?per_page=30`, { Accept: 'application/vnd.github+json', 'User-Agent': `AlvaTour/${appVersion}` });
    if (r.status !== 200) throw new Error('GitHub odpowiedział kodem ' + r.status);
    const list = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
    return { current: appVersion, update: pickUpdate(list, { current: appVersion, dev: isDev }) };
  },
  compareVersions,

  /**
   * Pobiera aktualizację wewnątrz aplikacji (bez Chrome), sprawdza ją i otwiera systemowe "Aktualizuj".
   * onProgress(pobrane, razem). Zwraca { needsPermission } albo { started }.
   */
  async downloadUpdate(update, onProgress = () => {}) {
    if (!isNative) { window.open(update.url, '_blank', 'noopener'); return { started: true }; }
    const h = await AppUpdater.addListener('progress', (e) => onProgress(e.downloaded, e.total));
    try {
      return await AppUpdater.download({ url: update.url, size: update.size || -1, sha256: update.sha256 || '' });
    } finally { h.remove(); }
  },
  installUpdate: () => (isNative ? AppUpdater.install() : Promise.resolve({ started: true })),

  /**
   * Udostępnianie DO AlvaTour (Google Maps, Claude, Gemini: Udostępnij -> AlvaTour).
   * onShare(text) dostaje tekst zarówno przy zimnym starcie, jak i gdy aplikacja była otwarta.
   */
  async listenForShares(onShare) {
    if (!isNative) return;
    const deliver = (s) => {
      if (!s) return;
      const parts = [s.subject, s.title, s.text].filter(Boolean).map(String);
      const text = [...new Set(parts)].join('\n').trim();
      if (text) onShare(text);
    };
    try {
      await ShareTarget.addListener('shareReceived', deliver);
      const { share } = await ShareTarget.takePending();
      deliver(share);
    } catch (e) { console.error('AlvaTour: udostępnianie', e); }
  },
};

window.AlvaNative = AlvaNative;
window.AlvaParsers = parsers;
