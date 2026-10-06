/* AlvaTour: wspólne stałe, stan, narzędzia, dźwięki, efekty, rangi i odznaki.
   Pliki js/* to zwykłe skrypty dzielące wspólny zakres globalny (ładowane po kolei). */
'use strict';

const APP_VERSION = '0.0.0-src'; // podmieniane przy buildzie (scripts/build-web.mjs)
const THIS_YEAR = new Date().getFullYear();
const MIN_YEAR = 1900;
const INKS = 8;
const EARTH_R = 6371;

// 193 państwa ONZ + Watykan i Palestyna
const SOVEREIGN = new Set(('AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG MK NO OM PK PW PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VE VN YE ZM ZW VA PS').split(' '));
const PARTIAL = new Set(['XK', 'TW', 'EH', 'XN', 'XS']);
const SOVEREIGN_TOTAL = SOVEREIGN.size;

const CONTINENTS = {
  EU: 'Europa', AS: 'Azja', AF: 'Afryka', NA: 'Ameryka Północna', SA: 'Ameryka Południowa', OC: 'Oceania', AN: 'Antarktyda',
};
const CONT_SHORT = { EU: 'Europa', AS: 'Azja', AF: 'Afryka', NA: 'Am. Płn.', SA: 'Am. Płd.', OC: 'Oceania', AN: 'Antarktyda' };
const CONT_ORDER = ['EU', 'AS', 'AF', 'NA', 'SA', 'OC', 'AN'];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const collator = new Intl.Collator('pl');
const fmtInt = new Intl.NumberFormat('pl-PL');
const fmt1 = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 });
const normalizeText = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function plural(n, forms) { // ['kraj','kraje','krajów']
  if (n === 1) return forms[0];
  const d = n % 10, h = n % 100;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return forms[1];
  return forms[2];
}
const P_COUNTRY = ['kraj', 'kraje', 'krajów'];
const P_TERR = ['terytorium', 'terytoria', 'terytoriów'];
function countries(n) { return `${fmtInt.format(n)} ${plural(n, P_COUNTRY)}`; }

function validYear(y) {
  if (y === null || y === undefined || y === '') return false;
  const n = Number(y);
  return Number.isInteger(n) && n >= MIN_YEAR && n <= THIS_YEAR;
}
function hashStr(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/* ================= Stan ================= */
// Dane trzyma warstwa danych (data.js -> window.AlvaData): SQLite w telefonie, kopie, migracje.
// Tu jest tylko stan w pamięci; zapis zawsze przez AlvaData.persist (jedyna droga do bazy).
const emptyState = () => AlvaData.emptyState();
const normalizeState = (s) => AlvaData.normalizeState(s);
let state = emptyState(); // podmieniany w main.js po wczytaniu danych z bazy (AlvaData.init)
let dataReady = false;
let saveTimer = null;
function saveNow() {
  clearTimeout(saveTimer);
  if (!dataReady) return false; // przed wczytaniem bazy nic nie zapisujemy (nie nadpiszemy danych pustym stanem)
  state.updatedAt = new Date().toISOString();
  AlvaData.persist(state);
  return true;
}
function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 300); }
window.addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
AlvaData.beforePause(saveNow);
let lastSaveErrorToast = 0;
AlvaData.onError((e) => {
  console.error('AlvaTour: błąd zapisu danych', e);
  if (Date.now() - lastSaveErrorToast > 15000 && typeof toast === 'function') {
    lastSaveErrorToast = Date.now();
    toast('<span><b>Nie udało się zapisać zmian.</b><br>Spróbuję ponownie przy kolejnej zmianie. Nic nie zostało usunięte.</span>', { kind: 'warn', ttl: 5000 });
  }
});

const entry = (id) => state.countries[id];
const isVisited = (id) => !!(state.countries[id] && state.countries[id].visited);
const isWish = (id) => !!(state.countries[id] && state.countries[id].wish);
function visitedIds() { return Object.keys(state.countries).filter(isVisited); }
function wishIds() { return Object.keys(state.countries).filter(isWish); }

/* ================= Dane geograficzne (wypełniane w main.js) ================= */
let features = [];
const byId = new Map();
let META = {};
const meta = (id) => META[id] || {};
function kindOf(id) { return SOVEREIGN.has(id) ? 'state' : PARTIAL.has(id) ? 'partial' : 'territory'; }
const KIND_LABEL = { state: 'Państwo', partial: 'Ograniczone uznanie lub terytorium sporne', territory: 'Terytorium zależne' };
const countryName = (id) => (byId.get(id) ? byId.get(id).properties.n : id);
function homeId() { return byId.has(state.settings.home) ? state.settings.home : null; }
function distanceKm(a, b) {
  const fa = byId.get(a), fb = byId.get(b);
  if (!fa || !fb) return null;
  return d3.geoDistance(fa.focus, fb.focus) * EARTH_R;
}

/* ---------- Flagi ---------- */
const flagSupport = (() => {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const x = c.getContext('2d'); x.textBaseline = 'top'; x.font = '14px sans-serif';
    x.fillText('\u{1F1F5}\u{1F1F1}', 0, 0);
    const d = x.getImageData(0, 0, 16, 16).data;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 150 && d[i + 1] < 90 && d[i + 2] < 90) return true;
  } catch (e) { /* ignore */ }
  return false;
})();
function flagEmoji(id) {
  if (!id || id.length !== 2 || ['XN', 'XS'].includes(id)) return '';
  return String.fromCodePoint(...[...id].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}
function flagHTML(id, cls = 'flag') {
  const e = flagEmoji(id);
  if (flagSupport && e) return `<span class="${cls}" aria-hidden="true">${e}</span>`;
  return `<span class="${cls} code" aria-hidden="true">${esc(id || '?')}</span>`;
}

/* ================= Kolory z CSS ================= */
let C = {};
function readColors() {
  const cs = getComputedStyle(document.documentElement);
  const g = (n) => cs.getPropertyValue(n).trim();
  C = {
    ocean: g('--ocean'), rim: g('--ocean-rim'), land: g('--land'), border: g('--border'), grat: g('--grat'),
    fg: g('--fg'), bg: g('--bg'), muted: g('--muted'), accent: g('--accent'), panel: g('--panel'), gold: g('--gold'),
    inks: Array.from({ length: INKS }, (_, i) => g(`--ink-${i + 1}`)), single: g('--ink-single'),
  };
}
function inkOfId(id) {
  const f = byId.get(id);
  if (state.settings.colors === 'single') return C.single;
  return C.inks[(f ? f.ink : hashStr(id)) % INKS];
}

/* ================= Dźwięki i wibracje ================= */
let audioCtx = null;
function ac() {
  if (!state.settings.sound) return null;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  } catch (e) { return null; }
}
function tone(freq, start, dur, type = 'sine', vol = 0.18) {
  const a = ac(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, a.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, a.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + start); o.stop(a.currentTime + start + dur + 0.05);
}
const sfx = {
  stamp() {
    const a = ac(); if (!a) return;
    const len = 0.12, buf = a.createBuffer(1, a.sampleRate * len, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const n = a.createBufferSource(); n.buffer = buf;
    const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = a.createGain(); g.gain.value = 0.5;
    n.connect(f).connect(g).connect(a.destination); n.start();
    const o = a.createOscillator(), og = a.createGain();
    o.frequency.setValueAtTime(140, a.currentTime); o.frequency.exponentialRampToValueAtTime(50, a.currentTime + 0.18);
    og.gain.setValueAtTime(0.5, a.currentTime); og.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.2);
    o.connect(og).connect(a.destination); o.start(); o.stop(a.currentTime + 0.22);
  },
  tick() { tone(1500, 0, 0.03, 'square', 0.04); },
  good() { tone(660, 0, 0.12); tone(880, 0.09, 0.18); },
  bad() { tone(220, 0, 0.15, 'sawtooth', 0.08); tone(180, 0.12, 0.2, 'sawtooth', 0.08); },
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.25, 'triangle', 0.16)); },
  pop() { tone(900, 0, 0.06, 'sine', 0.12); },
};
function buzz(pattern = 20) { if (state.settings.sound) AlvaNative.vibrate(pattern); }

/* ================= Powiadomienia ================= */
function toast(html, opts = {}) {
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = 'toast' + (opts.kind ? ' toast-' + opts.kind : '');
  el.innerHTML = html;
  box.appendChild(el);
  const ttl = opts.ttl || 2400;
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, ttl);
}

/* ================= Konfetti (płótno efektów) ================= */
const fxCanvas = $('fx');
const fx = fxCanvas.getContext('2d');
let particles = [], fxRunning = false;
function confetti(x, y, n = 90, spread = 1) {
  if (reducedMotion()) return;
  const r = fxCanvas.getBoundingClientRect();
  if (x == null) { x = r.width / 2; y = r.height / 2; }
  const colors = C.inks.concat([C.gold]);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = (3 + Math.random() * 7) * spread;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 4, g: 0.22, life: 70 + Math.random() * 40, w: 5 + Math.random() * 5, h: 3 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[i % colors.length] });
  }
  if (!fxRunning) { fxRunning = true; requestAnimationFrame(fxLoop); }
}
function fxLoop() {
  const r = fxCanvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (fxCanvas.width !== Math.round(r.width * dpr)) { fxCanvas.width = Math.round(r.width * dpr); fxCanvas.height = Math.round(r.height * dpr); }
  fx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fx.clearRect(0, 0, r.width, r.height);
  particles = particles.filter((p) => p.life > 0);
  for (const p of particles) {
    p.vy += p.g; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life--;
    fx.save(); fx.translate(p.x, p.y); fx.rotate(p.rot); fx.globalAlpha = Math.min(1, p.life / 25);
    fx.fillStyle = p.c; fx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); fx.restore();
  }
  if (particles.length) requestAnimationFrame(fxLoop); else { fxRunning = false; fx.clearRect(0, 0, r.width, r.height); }
}

/* ================= Rangi ================= */
const RANKS = [
  { at: 0, name: 'Domator', line: 'Każda wielka podróż zaczyna się od pierwszego stempla.' },
  { at: 1, name: 'Turysta', line: 'Pierwszy stempel w paszporcie. Apetyt rośnie.' },
  { at: 5, name: 'Wędrowiec', line: 'Plecak już nie wraca do szafy.' },
  { at: 10, name: 'Obieżyświat', line: 'Lotniska znasz lepiej niż własną kuchnię.' },
  { at: 20, name: 'Podróżnik', line: 'Masz ulubione miejsce przy oknie.' },
  { at: 35, name: 'Globtroter', line: 'Strefy czasowe przestały robić na Tobie wrażenie.' },
  { at: 50, name: 'Odkrywca', line: 'Ćwierć świata za Tobą.' },
  { at: 75, name: 'Kartograf', line: 'Mógłbyś rysować mapy z pamięci.' },
  { at: 100, name: 'Legenda szlaku', line: 'Klub 100 krajów. Szacunek.' },
  { at: 150, name: 'Ambasador świata', line: 'Paszport potrzebuje dodatkowych stron.' },
];
function stateCount() { return visitedIds().filter((id) => SOVEREIGN.has(id)).length; }
function rankFor(n) {
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (n >= RANKS[k].at) i = k;
  const cur = RANKS[i], next = RANKS[i + 1] || null;
  const pct = next ? (n - cur.at) / (next.at - cur.at) : 1;
  return { idx: i, cur, next, pct, toNext: next ? next.at - n : 0 };
}

/* ================= Odznaki ================= */
const ICONS = {
  stamp: '<path d="M9 3h6v5l3 3v3H6v-3l3-3z" fill="currentColor"/><rect x="4" y="16" width="16" height="3" rx="1" fill="currentColor"/>',
  globe: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  star: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" fill="currentColor"/>',
  crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5z" fill="currentColor"/>',
  island: '<path d="M3 18c3-2 6-2 9 0s6 2 9 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 16V8M12 8c-3-3-6-2-7 0M12 8c3-3 6-2 7 0M12 8c-1-3 0-5 2-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  mountain: '<path d="M2 19l7-11 4 6 2-3 7 8z" fill="currentColor"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="currentColor"/>',
  compass: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor"/>',
  plane: '<path d="M21 15.5l-8-4.5V5.5a1.5 1.5 0 0 0-3 0V11l-8 4.5v2l8-2.5v3.5L8 20v1.5l3.5-1 3.5 1V20l-2-1.5V15l8 2.5z" fill="currentColor"/>',
  clock: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  book: '<path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M12 6v14" stroke="currentColor" stroke-width="1.6"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="9" r="1.5" fill="currentColor"/><circle cx="15" cy="15" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  brain: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a2 2 0 0 0-3-1zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" fill="currentColor"/>',
  repeat: '<path d="M5 9a7 7 0 0 1 12-3l2 2M19 15a7 7 0 0 1-12 3l-2-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 4v4h-4M5 20v-4h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  sun: '<circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
};
const svgIcon = (k, size = 24) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${ICONS[k] || ICONS.star}</svg>`;

function progressCtx() {
  const v = visitedIds();
  const vs = new Set(v);
  const sov = v.filter((id) => SOVEREIGN.has(id));
  const byCont = {};
  for (const id of v) { const c = meta(id).c; if (c) byCont[c] = (byCont[c] || 0) + 1; }
  const years = v.map((id) => entry(id).firstYear).filter((y) => y != null);
  const perYear = {};
  for (const y of years) perYear[y] = (perYear[y] || 0) + 1;
  const home = homeId();
  let far = 0;
  if (home) for (const id of v) { const d = distanceKm(home, id); if (d > far) far = d; }
  let north = false, south = false, east = false, west = false;
  for (const id of v) { const f = byId.get(id); if (!f) continue; const [lon, lat] = f.focus; if (lat > 0) north = true; else south = true; if (lon > 0) east = true; else west = true; }
  return { v, vs, sov, byCont, years, perYear, far, hemis: [north, south, east, west].filter(Boolean).length, home, wish: wishIds() };
}
const has = (ctx, list) => list.filter((id) => ctx.vs.has(id)).length;

const BADGES = [
  { id: 'first', icon: 'stamp', name: 'Pierwszy stempel', desc: 'Oznacz pierwszy kraj.', t: (x) => [x.v.length, 1] },
  { id: 'five', icon: 'star', name: 'Piątka', desc: 'Odwiedź 5 krajów.', t: (x) => [x.sov.length, 5] },
  { id: 'ten', icon: 'star', name: 'Dziesiątka', desc: 'Odwiedź 10 krajów.', t: (x) => [x.sov.length, 10] },
  { id: 'q25', icon: 'star', name: 'Ćwierć setki', desc: 'Odwiedź 25 krajów.', t: (x) => [x.sov.length, 25] },
  { id: 'h50', icon: 'crown', name: 'Pół setki', desc: 'Odwiedź 50 krajów.', t: (x) => [x.sov.length, 50] },
  { id: 'c100', icon: 'crown', name: 'Klub 100', desc: 'Odwiedź 100 krajów.', t: (x) => [x.sov.length, 100] },
  { id: 'eu10', icon: 'globe', name: 'Europejczyk', desc: '10 krajów w Europie.', t: (x) => [x.byCont.EU || 0, 10] },
  { id: 'as5', icon: 'sun', name: 'Azjatycki smok', desc: '5 krajów w Azji.', t: (x) => [x.byCont.AS || 0, 5] },
  { id: 'af3', icon: 'sun', name: 'Safari', desc: '3 kraje w Afryce.', t: (x) => [x.byCont.AF || 0, 3] },
  { id: 'am', icon: 'compass', name: 'Nowy Świat', desc: 'Obie Ameryki: Północna i Południowa.', t: (x) => [(x.byCont.NA ? 1 : 0) + (x.byCont.SA ? 1 : 0), 2] },
  { id: 'oc', icon: 'island', name: 'Do góry nogami', desc: 'Dowolny kraj w Oceanii.', t: (x) => [Math.min(1, x.byCont.OC || 0), 1] },
  { id: 'an', icon: 'snow', name: 'Pingwinie, cześć!', desc: 'Antarktyda.', t: (x) => [x.vs.has('AQ') ? 1 : 0, 1] },
  { id: 'cont5', icon: 'globe', name: 'Pięć kontynentów', desc: 'Kraje na 5 kontynentach.', t: (x) => [Object.keys(x.byCont).filter((c) => c !== 'AN').length, 5] },
  { id: 'cont6', icon: 'crown', name: 'Wszystkie zamieszkane', desc: 'Wszystkie 6 zamieszkanych kontynentów.', t: (x) => [Object.keys(x.byCont).filter((c) => c !== 'AN').length, 6] },
  { id: 'hemi', icon: 'compass', name: 'Cztery półkule', desc: 'Północ, południe, wschód i zachód.', t: (x) => [x.hemis, 4] },
  { id: 'far', icon: 'plane', name: 'Drugi koniec świata', desc: 'Kraj ponad 12 000 km od domu.', t: (x) => [Math.min(12000, Math.round(x.far)), 12000], unit: 'km' },
  { id: 'nbrs', icon: 'home', name: 'Dobry sąsiad', desc: 'Wszyscy sąsiedzi Twojego kraju domowego.', t: (x) => { const b = x.home ? (meta(x.home).b || []) : []; return [has(x, b), Math.max(1, b.length)]; } },
  { id: 'micro', icon: 'crown', name: 'Mikroświat', desc: '3 z: Watykan, Monako, San Marino, Liechtenstein, Andora, Malta, Luksemburg.', t: (x) => [has(x, ['VA', 'MC', 'SM', 'LI', 'AD', 'MT', 'LU']), 3] },
  { id: 'isl', icon: 'island', name: 'Wyspiarz', desc: '5 krajów wyspiarskich (bez granic lądowych).', t: (x) => [x.sov.filter((id) => !(meta(id).b || []).length && !meta(id).ld).length, 5] },
  { id: 'land', icon: 'mountain', name: 'Szczur lądowy', desc: '5 krajów bez dostępu do morza.', t: (x) => [x.sov.filter((id) => meta(id).ld).length, 5] },
  { id: 'scan', icon: 'snow', name: 'Wikingowie', desc: 'Norwegia, Szwecja, Dania, Finlandia i Islandia.', t: (x) => [has(x, ['NO', 'SE', 'DK', 'FI', 'IS']), 5] },
  { id: 'balk', icon: 'mountain', name: 'Bałkański ekspres', desc: '5 krajów Bałkanów.', t: (x) => [has(x, ['AL', 'BA', 'BG', 'HR', 'XK', 'ME', 'MK', 'RS', 'SI', 'GR', 'RO']), 5] },
  { id: 'v4', icon: 'star', name: 'Grupa Wyszehradzka', desc: 'Polska, Czechy, Słowacja i Węgry.', t: (x) => [has(x, ['PL', 'CZ', 'SK', 'HU']), 4] },
  { id: 'balt', icon: 'globe', name: 'Bałtycki tercet', desc: 'Litwa, Łotwa i Estonia.', t: (x) => [has(x, ['LT', 'LV', 'EE']), 3] },
  { id: 'iber', icon: 'sun', name: 'Półwysep Iberyjski', desc: 'Hiszpania, Portugalia i Andora.', t: (x) => [has(x, ['ES', 'PT', 'AD']), 3] },
  { id: 'stan', icon: 'mountain', name: 'Stan umysłu', desc: '3 kraje z końcówką "-stan".', t: (x) => [x.v.filter((id) => /stan$/.test(countryName(id))).length, 3] },
  { id: 'loyal', icon: 'repeat', name: 'Wierny fan', desc: '3 wizyty w jednym kraju.', t: (x) => [Math.max(0, ...x.v.map((id) => 1 + entry(id).visits.length)), 3] },
  { id: 'dec', icon: 'clock', name: 'Dekada w drodze', desc: '10 lat między pierwszym a ostatnim nowym krajem.', t: (x) => [x.years.length ? Math.min(10, Math.max(...x.years) - Math.min(...x.years)) : 0, 10] },
  { id: 'year5', icon: 'sun', name: 'Rekordowy rok', desc: '5 nowych krajów w jednym roku.', t: (x) => [Math.max(0, ...Object.values(x.perYear)), 5] },
  { id: 'notes', icon: 'book', name: 'Kronikarz', desc: 'Notatki w 10 krajach.', t: (x) => [x.v.filter((id) => entry(id).notes.trim()).length, 10] },
  { id: 'love', icon: 'heart', name: 'Miłość od pierwszego wejrzenia', desc: 'Daj 5 serc trzem krajom.', t: (x) => [x.v.filter((id) => entry(id).rating === 5).length, 3] },
  { id: 'dream', icon: 'plane', name: 'Marzyciel', desc: '10 krajów na liście marzeń.', t: (x) => [x.wish.length, 10] },
  { id: 'quiz', icon: 'brain', name: 'Mistrz geografii', desc: 'Co najmniej 8/10 w quizie.', t: () => [Math.min(8, state.games.quizBest), 8] },
  { id: 'roul', icon: 'dice', name: 'Hazardzista', desc: 'Dodaj wylosowany kraj do marzeń.', t: () => [Math.min(1, state.games.roulette), 1] },
  { id: 'time', icon: 'clock', name: 'Podróżnik w czasie', desc: 'Obejrzyj wehikuł czasu.', t: () => [Math.min(1, state.games.timelapse), 1] },
];

let badgeQueue = [];
let lastRankIdx = null;
function checkProgress(silent = false) {
  const ctx = progressCtx();
  const fresh = [];
  for (const b of BADGES) {
    const [cur, need] = b.t(ctx);
    if (cur >= need && !state.badges[b.id]) { state.badges[b.id] = new Date().toISOString(); fresh.push(b); }
  }
  const r = rankFor(ctx.sov.length);
  const rankUp = lastRankIdx != null && r.idx > lastRankIdx;
  lastRankIdx = r.idx;
  if (fresh.length) saveNow();
  if (silent) return;
  let delay = 900;
  if (rankUp) {
    setTimeout(() => {
      sfx.fanfare(); confetti(null, null, 160, 1.3); buzz([30, 60, 30]);
      toast(`<span class="toast-icon">${svgIcon('crown', 22)}</span><span><b>Nowa ranga: ${esc(r.cur.name)}</b><br>${esc(r.cur.line)}</span>`, { kind: 'gold', ttl: 4200 });
    }, delay);
    delay += 1200;
  }
  fresh.forEach((b, i) => setTimeout(() => {
    sfx.fanfare(); buzz([20, 40, 20]);
    toast(`<span class="toast-icon">${svgIcon(b.icon, 22)}</span><span><b>Odznaka: ${esc(b.name)}</b><br>${esc(b.desc)}</span>`, { kind: 'gold', ttl: 3600 });
  }, delay + i * 1100));
}
