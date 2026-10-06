/* AlvaTour: start aplikacji. */
'use strict';

const DATA_URL = 'countries.json';
const META_URL = 'meta.json';

// filtr "tuszu" dla stempli
document.body.insertAdjacentHTML('beforeend', `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <filter id="inkRough" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2 0 0 0 1.85" result="m"/>
    <feComposite in="SourceGraphic" in2="m" operator="in" result="s"/>
    <feDisplacementMap in="s" in2="n" scale="2" xChannelSelector="R" yChannelSelector="G"/>
  </filter></defs></svg>`);

const ALIASES = {
  US: 'usa stany ameryka', GB: 'uk anglia szkocja walia brytania', AE: 'uae emiraty dubaj', NL: 'niderlandy', ZA: 'rpa afryka poludniowa',
  CZ: 'czechy republika czeska', KR: 'korea poludniowa', KP: 'korea polnocna', CD: 'kongo dr', DO: 'dominikana', VA: 'watykan stolica apostolska',
  MM: 'birma', SZ: 'suazi', CI: 'wybrzeze kosci sloniowej', TL: 'timor', BA: 'bosnia', MK: 'macedonia', RU: 'rosja', TR: 'turcja',
};
function largestPolygon(f) {
  const g = f.geometry;
  if (g.type !== 'MultiPolygon') return f;
  let best = null, bestA = -1;
  for (const coords of g.coordinates) {
    const p = { type: 'Feature', geometry: { type: 'Polygon', coordinates: coords } };
    const a = d3.geoArea(p);
    if (a < 2 * Math.PI && a > bestA) { bestA = a; best = p; }
  }
  return best || f;
}

function prepare(topo) {
  const geoms = topo.objects.countries.geometries;
  features = topojson.feature(topo, topo.objects.countries).features;
  const nb = topojson.neighbors(geoms);
  const order = features.map((f, i) => i).sort((a, b) => String(features[a].id).localeCompare(String(features[b].id)));
  const ink = new Array(features.length).fill(-1);
  for (const i of order) {
    const used = new Set(nb[i].map((j) => ink[j]));
    const start = hashStr(features[i].id) % INKS;
    let k = start;
    for (let t = 0; t < INKS; t++) { k = (start + t) % INKS; if (!used.has(k)) break; }
    ink[i] = k;
  }
  features.forEach((f, i) => { f.ink = ink[i]; });
  if (!features.some((f) => f.id === 'TV')) {
    features.push({ type: 'Feature', id: 'TV', ink: 5, properties: { n: 'Tuvalu', en: 'Tuvalu', a: 'TV' }, geometry: d3.geoCircle().center([179.2, -8.52]).radius(0.12)() });
  }
  for (const f of features) {
    f.area = d3.geoArea(f);
    if (f.area > 2 * Math.PI) {
      f.geometry.coordinates = f.geometry.type === 'Polygon' ? f.geometry.coordinates.map((r) => r.reverse()) : f.geometry.coordinates.map((p) => p.map((r) => r.reverse()));
      f.area = d3.geoArea(f);
    }
    f.bounds = d3.geoBounds(f);
    f.centroid = d3.geoCentroid(f);
    const main = largestPolygon(f);
    f.focus = d3.geoCentroid(main);
    const mb = d3.geoBounds(main);
    const dLon = ((mb[1][0] - mb[0][0]) + 360) % 360 || 0.1;
    const dLat = mb[1][1] - mb[0][1];
    f.extent = Math.max(Math.max(dLon * Math.cos(f.focus[1] * Math.PI / 180), dLat) * Math.PI / 180, 0.004);
    f.radius = Math.sqrt(f.area / Math.PI);
    f.norm = normalizeText(f.properties.n); f.normEn = normalizeText(f.properties.en || '');
    f.alias = normalizeText(ALIASES[f.id] || '');
    byId.set(f.id, f);
  }
  tiny = features.filter((f) => (SOVEREIGN.has(f.id) || f.id === 'XK') && f.radius < 0.012);
}

/* ---------- Motyw ---------- */
readColors();
const mqDark = window.matchMedia('(prefers-color-scheme: dark)');
const onTheme = () => { readColors(); patternCache.clear(); render(); };
if (mqDark.addEventListener) mqDark.addEventListener('change', onTheme);
new MutationObserver(onTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

async function start() {
  resize();
  window.addEventListener('resize', resize);
  d3.select(canvas).call(zoomer).on('dblclick.zoom', null);
  $('btnLines').setAttribute('aria-pressed', String(state.settings.lines));
  try {
    const [topo, m] = await Promise.all([
      fetch(DATA_URL).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch(META_URL).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    ]);
    META = m;
    prepare(topo);
  } catch (e) {
    $('loading').textContent = 'Nie udało się wczytać mapy. Sprawdź połączenie i odśwież stronę.';
    return;
  }
  $('loading').hidden = true;
  checkProgress(true);
  updateStats(); updateCountdown();
  const home = homeId();
  if (home) { const f = byId.get(home); rotation = [-f.focus[0], -clamp(f.focus[1] - 10, -60, 60), 0]; }
  render();
  if (handleIncomingShare()) return;
  if (!state.settings.onboarded) showOnboarding();
  else if (!state.settings.hintSeen && !visitedIds().length) $('hint').hidden = false;
}
start();

// Aplikacja działa jako APK (Capacitor): bez service workera i bez manifestu PWA.
// Pliki są w paczce aplikacji, dane w jej prywatnej pamięci.
