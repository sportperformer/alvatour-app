// Trasy piesze dla "Planów zwiedzania": OpenStreetMap (serwer routingu FOSSGIS, profil pieszy, bez klucza).
// Czyste funkcje (adres zapytania, odczyt odpowiedzi, polskie wskazówki, kolejność zwiedzania) testowane w tests/route.test.js.

export const ROUTE_BASE = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/';
export const MAX_STOPS = 24;

/** points: [{lat, lng}, ...] (start, przystanki..., cel) -> adres zapytania OSRM. */
export function routeUrl(points) {
  if (!Array.isArray(points) || points.length < 2) throw new Error('Trasa potrzebuje co najmniej dwóch punktów.');
  const coords = points.map((p) => `${Number(p.lng).toFixed(6)},${Number(p.lat).toFixed(6)}`).join(';');
  return `${ROUTE_BASE}${coords}?overview=full&geometries=geojson&steps=true`;
}

const MOD = {
  left: 'w lewo', right: 'w prawo', 'slight left': 'lekko w lewo', 'slight right': 'lekko w prawo',
  'sharp left': 'ostro w lewo', 'sharp right': 'ostro w prawo', straight: 'prosto', uturn: 'zawróć',
};

/** Jeden krok OSRM -> zdanie po polsku. stopName: nazwa celu odcinka (dla "arrive"). */
export function stepText(step, stopName = '') {
  const m = (step && step.maneuver) || {};
  const name = (step && step.name ? String(step.name).trim() : '');
  const on = name ? ` w ${name}` : '';
  const mod = MOD[m.modifier] || '';
  switch (m.type) {
    case 'depart': return name ? `Ruszaj ulicą ${name}` : 'Ruszaj';
    case 'arrive': return stopName ? `Jesteś na miejscu: ${stopName}` : 'Jesteś na miejscu';
    case 'roundabout': case 'rotary': case 'roundabout turn':
      return m.exit ? `Na rondzie zjedź ${m.exit}. zjazdem${on}` : `Przejdź przez rondo${on}`;
    case 'exit roundabout': case 'exit rotary': return `Zjedź z ronda${on}`;
    case 'new name': return name ? `Idź dalej: ${name}` : 'Idź dalej';
    case 'continue': case 'merge': case 'use lane': case 'notification':
      if (!mod || m.modifier === 'straight') return name ? `Idź prosto: ${name}` : 'Idź prosto';
      return `Idź ${mod}${on}`;
    default: // turn, end of road, fork, on ramp, off ramp
      if (m.modifier === 'uturn') return `Zawróć${on}`;
      if (!mod || m.modifier === 'straight') return name ? `Idź prosto: ${name}` : 'Idź prosto';
      return `Skręć ${mod}${on}`;
  }
}

/** Odpowiedź OSRM -> { distance (m), duration (s), path: [{lat,lng}], legs: [{ distance, duration, steps: [{ text, distance }] }] }. */
export function parseRoute(json, stopNames = []) {
  if (!json || json.code !== 'Ok' || !Array.isArray(json.routes) || !json.routes.length) {
    const code = json && json.code;
    if (code === 'NoRoute') throw new Error('Nie znalazłem trasy pieszej między tymi miejscami.');
    throw new Error('Serwer tras nie odpowiedział poprawnie' + (code ? ` (${code})` : '') + '.');
  }
  const r = json.routes[0];
  const coords = (r.geometry && r.geometry.coordinates) || [];
  const legs = (r.legs || []).map((leg, i) => {
    const steps = [];
    for (const s of leg.steps || []) {
      const type = s.maneuver && s.maneuver.type;
      if (type !== 'arrive' && type !== 'depart' && !(s.distance > 0)) continue;
      const text = stepText(s, stopNames[i] || '');
      // dwa takie same zdania pod rząd (np. ta sama ulica): łączymy odległości
      const prev = steps[steps.length - 1];
      if (prev && prev.text === text && type !== 'arrive') { prev.distance += s.distance || 0; continue; }
      steps.push({ text, distance: s.distance || 0 });
    }
    return { distance: leg.distance || 0, duration: leg.duration || 0, steps };
  });
  return { distance: r.distance || 0, duration: r.duration || 0, path: coords.map(([lng, lat]) => ({ lat, lng })), legs };
}

/** Odległość w linii prostej (metry). */
export function distM(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Kolejność zwiedzania: zawsze najbliższe następne miejsce (od startu), najwyżej max miejsc. */
export function tourOrder(start, items, max = MAX_STOPS) {
  const left = items.filter((i) => i && i.lat != null && i.lng != null);
  const out = [];
  let cur = start;
  while (left.length && out.length < max) {
    let bi = 0, bd = Infinity;
    left.forEach((it, i) => { const d = distM(cur, it); if (d < bd) { bd = d; bi = i; } });
    cur = left.splice(bi, 1)[0];
    out.push(cur);
  }
  return out;
}

/** Link do Google Maps z tą samą trasą (cel + do 9 przystanków po drodze). */
export function googleDirUrl(origin, stops) {
  const enc = (s) => `${s.lat},${s.lng}`;
  const dest = stops[stops.length - 1];
  const way = stops.slice(0, -1).slice(0, 9).map(enc).join('|');
  return `https://www.google.com/maps/dir/?api=1${origin ? `&origin=${enc(origin)}` : ''}&destination=${enc(dest)}${way ? `&waypoints=${encodeURIComponent(way)}` : ''}&travelmode=walking`;
}
