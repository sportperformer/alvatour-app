/* AlvaTour: miejsca (restauracje, kawiarnie, zabytki...) z Google Maps, wyszukiwarki i rekomendacji AI. */
'use strict';

const CATS = [
  { id: 'food', name: 'Restauracja', color: '#c8323c', icon: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-2 1-3 4-3 7h3v11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' },
  { id: 'cafe', name: 'Kawiarnia', color: '#8a5a2b', icon: '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10h2a2.5 2.5 0 0 1 0 5h-2M8 3v3M12 3v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' },
  { id: 'bar', name: 'Bar', color: '#7a3fb0', icon: '<path d="M5 4h14l-7 8zM12 12v8M8 20h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' },
  { id: 'hotel', name: 'Nocleg', color: '#2b59c3', icon: '<path d="M3 18V7M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7" cy="11" r="1.8" fill="currentColor"/>' },
  { id: 'sight', name: 'Zabytek', color: '#d9731a', icon: '<path d="M3 21h18M5 21V10M9 21V10M15 21V10M19 21V10M3 10l9-6 9 6z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>' },
  { id: 'museum', name: 'Muzeum', color: '#b8336a', icon: '<rect x="4" y="5" width="16" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 15l5-5 4 4 2-2 5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' },
  { id: 'view', name: 'Widok', color: '#0f8b8d', icon: '<path d="M2 19l6-9 4 5 3-4 7 8z" fill="currentColor"/><circle cx="17" cy="6" r="2" fill="currentColor"/>' },
  { id: 'nature', name: 'Natura', color: '#2e8b57', icon: '<path d="M12 21v-6M12 3l6 9h-3l4 5H5l4-5H6z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>' },
  { id: 'beach', name: 'Plaża', color: '#d99a1e', icon: '<path d="M4 20c3-1.5 5-1.5 8 0s5 1.5 8 0M13 17L8 6M3.5 9.5C6 4 13 3 16.5 7z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>' },
  { id: 'shop', name: 'Zakupy', color: '#5b7a1e', icon: '<path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' },
  { id: 'other', name: 'Inne', color: '#5d6b77', icon: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2.4" fill="currentColor"/>' },
];
const CAT = Object.fromEntries(CATS.map((c) => [c.id, c]));
const catOf = (id) => CAT[id] || CAT.other;
const catIcon = (id, size = 18) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${catOf(id).icon}</svg>`;
// parsery (Google Maps, AI, kategorie) są w src/native/parsers.js (testowane)
const { guessCat, parseShared, looksLikeAI, parseAI } = AlvaParsers;
function catFromOsm(cls, type) {
  const t = `${cls}:${type}`;
  if (/restaurant|fast_food|food_court/.test(t)) return 'food';
  if (/cafe|bakery|ice_cream|confectionery/.test(t)) return 'cafe';
  if (/bar|pub|biergarten|nightclub|wine/.test(t)) return 'bar';
  if (/hotel|hostel|guest_house|motel|apartment|chalet/.test(t)) return 'hotel';
  if (/museum|gallery|arts_centre/.test(t)) return 'museum';
  if (/viewpoint/.test(t)) return 'view';
  if (/beach/.test(t)) return 'beach';
  if (/^natural|park|garden|nature_reserve|peak|forest/.test(t)) return 'nature';
  if (/^shop|marketplace|mall/.test(t)) return 'shop';
  if (/^historic|attraction|monument|castle|church|cathedral|place_of_worship|memorial/.test(t)) return 'sight';
  return null;
}

const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const placeById = (id) => state.places.find((p) => p.id === id);
const placesIn = (cc) => state.places.filter((p) => p.cc === cc);
function placeYear(p) { return p.date ? Number(p.date.slice(0, 4)) : null; }

/* ================= Geokodowanie (OpenStreetMap) ================= */
// Nominatim/Photon przez AlvaNative: nagłówek User-Agent, limit 1 zapytanie na sekundę, pamięć wyników
const fetchJSON = (url) => AlvaNative.geoJSON(url);
function ccFromPoint(lng, lat) {
  const p = [lng, lat];
  const cand = features.filter((f) => inBounds(f, lng, lat) && d3.geoContains(f, p)).sort((a, b) => a.area - b.area);
  return cand.length ? cand[0].id : '';
}
function normNominatim(r) {
  const a = r.address || {};
  const lat = Number(r.lat), lng = Number(r.lon);
  let cc = (a.country_code || '').toUpperCase();
  if (!byId.has(cc)) cc = ccFromPoint(lng, lat);
  return {
    name: r.name || (r.display_name || '').split(',')[0], addr: r.display_name || '', lat, lng, cc,
    city: a.city || a.town || a.village || a.municipality || a.suburb || a.county || a.state || '',
    cat: catFromOsm(r.category || r.class || '', r.type || ''),
  };
}
function normPhoton(f) {
  const p = f.properties || {}, [lng, lat] = f.geometry.coordinates;
  let cc = (p.countrycode || '').toUpperCase();
  if (!byId.has(cc)) cc = ccFromPoint(lng, lat);
  return {
    name: p.name || p.street || '', addr: [p.name, [p.street, p.housenumber].filter(Boolean).join(' '), p.city, p.country].filter(Boolean).join(', '),
    lat, lng, cc, city: p.city || p.town || p.village || p.county || p.state || '', cat: catFromOsm(p.osm_key || '', p.osm_value || ''),
  };
}
async function geoSearch(q) {
  if (!q || !q.trim()) return [];
  let nomOk = false;
  try {
    const r = await fetchJSON(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&accept-language=pl&q=${encodeURIComponent(q)}`);
    nomOk = true;
    if (Array.isArray(r) && r.length) return r.map(normNominatim).filter((x) => x.cc);
  } catch (e) { /* spróbuj Photon */ }
  try {
    const r2 = await fetchJSON(`https://photon.komoot.io/api/?limit=6&q=${encodeURIComponent(q)}`);
    return (r2.features || []).map(normPhoton).filter((x) => x.cc);
  } catch (e) {
    if (nomOk) return [];
    throw e;
  }
}
async function geoReverse(lat, lng) {
  try {
    const r = await fetchJSON(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=pl&lat=${lat}&lon=${lng}`);
    if (r && r.lat) return normNominatim(r);
  } catch (e) { /* */ }
  return { name: '', addr: '', lat, lng, cc: ccFromPoint(lng, lat), city: '', cat: null };
}

/* ================= Zapis miejsca ================= */
function savePlace(p, opts = {}) {
  const isNew = !placeById(p.id);
  if (isNew) state.places.push(p);
  const cc = p.cc;
  if (cc && byId.has(cc)) {
    const c = entry(cc);
    if (p.status === 'visited' && !isVisited(cc)) {
      const y = placeYear(p);
      state.countries[cc] = { visited: true, wish: false, firstYear: validYear(y) ? y : null, visits: [], notes: (c && c.notes) || '', rating: 0, plannedDate: (c && c.plannedDate) || '', addedAt: new Date().toISOString() };
      if (!opts.silent) setTimeout(() => stampPop(cc), 350);
    } else if (p.status === 'planned' && !c) {
      state.countries[cc] = { visited: false, wish: true, firstYear: null, visits: [], notes: '', rating: 0, plannedDate: '', addedAt: new Date().toISOString() };
    }
  }
  saveNow(); afterDataChange();
  return isNew;
}

/* ================= Pinezki na globie ================= */
let placeHover = null;
let selectedPlace = null;
function drawPlaces(center, R) {
  if (globeMode === 'quiz' || timeYear != null || !state.places.length) return;
  const r = zoomK < 2 ? 3.4 : zoomK < 6 ? 4.6 : 6.2;
  const labels = zoomK >= 7;
  ctx.font = `600 12px ${getComputedStyle(document.body).fontFamily}`;
  const boxes = [];
  for (const p of state.places) {
    p._s = null;
    if (d3.geoDistance([p.lng, p.lat], center) > Math.PI / 2 - 0.01) continue;
    const s = projection([p.lng, p.lat]);
    p._s = s;
    const color = catOf(p.cat).color;
    const hl = p.id === placeHover || p.id === selectedPlace;
    const rr = hl ? r + 2 : r;
    ctx.beginPath(); ctx.arc(s[0], s[1], rr + 1.6, 0, Math.PI * 2); ctx.fillStyle = C.panel; ctx.fill();
    ctx.beginPath(); ctx.arc(s[0], s[1], rr, 0, Math.PI * 2);
    if (p.status === 'visited') { ctx.fillStyle = color; ctx.fill(); }
    else { ctx.fillStyle = C.panel; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.stroke(); }
    if (p.id === selectedPlace) { ctx.beginPath(); ctx.arc(s[0], s[1], rr + 4, 0, Math.PI * 2); ctx.strokeStyle = C.fg; ctx.lineWidth = 1.6; ctx.stroke(); }
    if (labels || hl) {
      const tw = ctx.measureText(p.name).width, bx = [s[0] + rr + 4, s[1] - 8, tw + 4, 16];
      if (!hl && boxes.some((b) => bx[0] < b[0] + b[2] && bx[0] + bx[2] > b[0] && bx[1] < b[1] + b[3] && bx[1] + bx[3] > b[1])) continue;
      boxes.push(bx);
      ctx.lineWidth = 3; ctx.strokeStyle = C.panel; ctx.strokeText(p.name, s[0] + rr + 5, s[1] + 4);
      ctx.fillStyle = C.fg; ctx.fillText(p.name, s[0] + rr + 5, s[1] + 4);
    }
  }
}
function hitPlace(x, y) {
  let best = null, bd = 12;
  for (const p of state.places) { if (!p._s) continue; const d = Math.hypot(p._s[0] - x, p._s[1] - y); if (d < bd) { bd = d; best = p; } }
  return best;
}
function flyToPlace(p) {
  const k = Math.max(zoomK, 22);
  const Rk = baseScale * k;
  let dx = 0, dy = 0;
  if (W < 720) dy = H * 0.22; else dx = Math.min(210, W * 0.16);
  const lat = clamp(p.lat - (dy / Rk) * 57.3, -89, 89);
  const lng = p.lng + (dx / Rk) * 57.3 / Math.max(0.2, Math.cos(p.lat * Math.PI / 180));
  return flyTo([-lng, -lat], k, 1100);
}

/* ================= Karta miejsca w panelu ================= */
function gmapsLink(p) { return p.url && /^https?:/.test(p.url) ? p.url : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name + (p.city ? ', ' + p.city : ''))}&query_place_id=`; }
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return isNaN(dt) ? d : dt.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}
function catChips(sel, name = 'cat') {
  return `<div class="cat-chips" data-chips="${name}">${CATS.map((c) => `<button type="button" class="cat-chip ${c.id === sel ? 'on' : ''}" data-cat="${c.id}" style="--c:${c.color}">${catIcon(c.id, 16)}<span>${c.name}</span></button>`).join('')}</div>`;
}
function openPlace(pid, opts = {}) {
  const p = placeById(pid);
  if (!p) return;
  selectedPlace = pid; selectedId = p.cc || null;
  $('sheetTitle').textContent = p.name;
  $('sheetFlag').outerHTML = `<span id="sheetFlag" class="flag place-badge" style="--c:${catOf(p.cat).color}">${catIcon(p.cat, 26)}</span>`;
  renderPlaceSheet();
  sheet.hidden = false; sheetBody.scrollTop = 0;
  hideHint();
  if (opts.fly) flyToPlace(p);
  requestRender();
}
function renderPlaceSheet() {
  const p = placeById(selectedPlace);
  if (!p) return;
  const where = [p.city, p.cc ? countryName(p.cc) : ''].filter(Boolean).join(', ');
  $('sheetSub').textContent = [catOf(p.cat).name, where].filter(Boolean).join(' · ');
  sheet.style.setProperty('--stamp', catOf(p.cat).color);
  sheetBody.innerHTML = `
    <div class="seg seg-wide" id="plStatus" role="radiogroup" aria-label="Status miejsca">
      <button type="button" data-st="visited" role="radio" aria-checked="${p.status === 'visited'}">${svgIcon('stamp', 16)} Byłem tu</button>
      <button type="button" data-st="planned" role="radio" aria-checked="${p.status === 'planned'}">${svgIcon('plane', 16)} Chcę odwiedzić</button>
    </div>
    <div class="two-col">
      <div class="field"><label for="plDate">${p.status === 'visited' ? 'Kiedy' : 'Planowany termin'}</label><input id="plDate" type="date" value="${esc(p.date)}"></div>
      <div class="field" ${p.status === 'visited' ? '' : 'hidden'}><span class="field-label">Ocena</span>
        <div class="hearts" id="plHearts">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-r="${n}" aria-label="${n} na 5" class="${p.rating >= n ? 'on' : ''}">${ICON_HEART}</button>`).join('')}</div></div>
    </div>
    <div class="field"><span class="field-label">Kategoria</span>${catChips(p.cat, 'plcat')}</div>
    <div class="field"><label for="plNote">Notatka</label><textarea id="plNote" rows="3" placeholder="Co zamówić, z kim byłeś, na co uważać">${esc(p.note)}</textarea></div>
    ${p.addr ? `<p class="muted small">${esc(p.addr)}${p.approx ? ' (lokalizacja przybliżona)' : ''}</p>` : (p.approx ? '<p class="muted small">Lokalizacja przybliżona do kraju.</p>' : '')}
    <div class="btn-row">
      <a class="btn" href="${esc(gmapsLink(p))}" target="_blank" rel="noopener">Otwórz w Google Maps</a>
      ${p.cc ? `<button type="button" class="btn btn-soft" id="plCountry">${esc(countryName(p.cc))}</button>` : ''}
    </div>
    <button type="button" class="link danger-link" id="plDelete">Usuń miejsce</button>
    <div class="confirm" id="plDelConfirm" hidden><p>Usunąć „${esc(p.name)}”?</p><div class="btn-row"><button type="button" class="btn btn-danger" id="plDelYes">Tak, usuń</button><button type="button" class="btn btn-soft" id="plDelNo">Anuluj</button></div></div>`;
  $('plStatus').addEventListener('click', (e) => {
    const b = e.target.closest('[data-st]'); if (!b || b.dataset.st === p.status) return;
    p.status = b.dataset.st;
    savePlace(p); sfx.pop(); renderPlaceSheet();
  });
  $('plDate').addEventListener('change', (e) => { p.date = e.target.value; savePlace(p); });
  $('plHearts').addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    const r = Number(b.dataset.r); p.rating = p.rating === r ? 0 : r;
    $('plHearts').querySelectorAll('[data-r]').forEach((x) => x.classList.toggle('on', p.rating >= Number(x.dataset.r)));
    sfx.pop(); saveNow(); afterDataChange(false);
  });
  sheetBody.querySelector('[data-chips="plcat"]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    p.cat = b.dataset.cat; saveNow(); afterDataChange(); openPlace(p.id);
  });
  $('plNote').addEventListener('input', (e) => { p.note = e.target.value; saveSoon(); });
  if ($('plCountry')) $('plCountry').addEventListener('click', () => { selectedPlace = null; openCountry(p.cc, { fly: true }); });
  $('plDelete').addEventListener('click', () => { $('plDelConfirm').hidden = false; });
  $('plDelNo').addEventListener('click', () => { $('plDelConfirm').hidden = true; });
  $('plDelYes').addEventListener('click', () => {
    state.places = state.places.filter((x) => x.id !== p.id);
    saveNow(); afterDataChange(); closeSheet(); toast(`Usunięto: ${esc(p.name)}`);
  });
}

/* ---------- sekcja w karcie kraju ---------- */
function placesSectionHTML(cc) {
  const list = placesIn(cc);
  const add = `<button type="button" class="add-btn" id="addPlaceHere">${ICON_PLUS} Dodaj miejsce</button>`;
  if (!list.length) return `<section class="places-sec"><div class="sec-head"><span class="field-label">Moje miejsca</span></div><p class="muted small">Restauracje, kawiarnie, widoki. Dodaj z Google Maps albo wyszukaj po nazwie.</p>${add}</section>`;
  const byCity = new Map();
  for (const p of list) { const k = p.city || 'Bez miasta'; if (!byCity.has(k)) byCity.set(k, []); byCity.get(k).push(p); }
  const cities = [...byCity.keys()].sort((a, b) => byCity.get(b).length - byCity.get(a).length || collator.compare(a, b));
  return `<section class="places-sec"><div class="sec-head"><span class="field-label">Moje miejsca · ${list.length}</span></div>
    ${cities.map((c) => `<div class="city-group"><b>${esc(c)}</b>${byCity.get(c).map(placeRowHTML).join('')}</div>`).join('')}${add}</section>`;
}
function placeRowHTML(p) {
  const meta = [p.status === 'planned' ? 'do odwiedzenia' : (placeYear(p) || ''), p.rating ? '♥ ' + p.rating : ''].filter(Boolean).join(' · ');
  return `<button type="button" class="place-row ${p.status}" data-place="${esc(p.id)}" style="--c:${catOf(p.cat).color}"><span class="pr-ico">${catIcon(p.cat, 16)}</span><span class="pr-name">${esc(p.name)}</span><span class="pr-meta">${esc(meta)}</span></button>`;
}
function bindPlaceRows(root) {
  root.querySelectorAll('[data-place]').forEach((b) => b.addEventListener('click', () => openPlace(b.dataset.place, { fly: true })));
  const add = root.querySelector('#addPlaceHere');
  if (add) add.addEventListener('click', () => openPlaceAdd({ cc: selectedId }));
}

/* ================= Dodawanie miejsca ================= */
let addCtx = null;
function openPlaceAdd(pre = {}) {
  addCtx = { pre, candidates: [], chosen: null, parsed: null };
  const seed = pre.shared || '';
  openModal(`
    <div class="pl-add">
      <div class="share-head"><h2>Nowe miejsce</h2><button type="button" class="btn-ghost icon-only" data-x aria-label="Zamknij"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>
      <div class="field">
        <label for="plQ">Wklej z Google Maps albo wpisz nazwę</label>
        <textarea id="plQ" rows="3" placeholder="np. Majestic Café Porto, albo tekst skopiowany z Google Maps">${esc(seed)}</textarea>
        <p class="muted small">W Google Maps na telefonie: <b>Udostępnij</b> → <b>AlvaTour</b>. Albo Udostępnij → Kopiuj i wklej tutaj.</p>
      </div>
      <div class="btn-row"><button type="button" class="btn" id="plFind">Szukaj</button><button type="button" class="btn btn-soft" id="plAI">Wklej plan od AI</button></div>
      <div id="plMsg" class="pl-msg" role="status"></div>
      <ul class="pl-cands" id="plCands"></ul>
      <div id="plForm" hidden></div>
    </div>`, (card) => {
    card.querySelector('[data-x]').addEventListener('click', closeModal);
    card.querySelector('#plFind').addEventListener('click', runPlaceSearch);
    card.querySelector('#plAI').addEventListener('click', () => openAIImport(card.querySelector('#plQ').value));
    card.querySelector('#plQ').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runPlaceSearch(); } });
    if (seed) runPlaceSearch(); else card.querySelector('#plQ').focus();
  });
}
async function runPlaceSearch() {
  const q = $('plQ').value.trim();
  const msg = $('plMsg'), list = $('plCands');
  if (!q) { msg.textContent = 'Wpisz nazwę miejsca albo wklej tekst z Google Maps.'; return; }
  if (looksLikeAI(q)) { openAIImport(q); return; }
  const parsed = parseShared(q);
  addCtx.parsed = parsed;
  list.innerHTML = ''; $('plForm').hidden = true;
  msg.innerHTML = '<span class="spinner sm"></span> Szukam…';
  const alive = () => $('plMsg') === msg; // okno mogło zostać zamknięte w trakcie szukania
  if (parsed.lat == null && AlvaParsers.isShortMapsLink(parsed.url)) {
    // krótki link z Google Maps (maps.app.goo.gl): rozwiń go, w pełnym adresie są współrzędne
    const full = await AlvaNative.expandMapsLink(parsed.url);
    const c = full && AlvaParsers.coordsFromUrl(full);
    if (c) { parsed.lat = c.lat; parsed.lng = c.lng; if (!parsed.name) parsed.name = parseShared(full).name; }
  }
  let cands = [];
  try {
    if (parsed.lat != null) {
      const rev = await geoReverse(parsed.lat, parsed.lng);
      cands = [{ ...rev, name: parsed.name || rev.name, lat: parsed.lat, lng: parsed.lng, exact: true }];
    } else {
      const tries = [[parsed.name, parsed.addr].filter(Boolean).join(', '), parsed.addr, parsed.name].filter((x, i, a) => x && a.indexOf(x) === i);
      if (!tries.length && parsed.url) { msg.innerHTML = 'Sam link z Google Maps nie zawiera nazwy miejsca. Użyj <b>Udostępnij</b> zamiast „Kopiuj link” albo dopisz nazwę lokalu.'; return; }
      for (const t of tries) { cands = await geoSearch(t); if (cands.length) break; }
      if (parsed.name) cands = cands.map((c) => ({ ...c, name: c.name && normalizeText(parsed.name).includes(normalizeText(c.name)) ? parsed.name : (c.name || parsed.name) }));
    }
  } catch (e) {
    if (!alive()) return;
    msg.innerHTML = 'Nie mogę połączyć się z wyszukiwarką adresów. Sprawdź internet albo zapisz miejsce z przybliżoną lokalizacją.';
    showManualForm(parsed);
    return;
  }
  if (!alive()) return;
  if (!cands.length) { msg.textContent = 'Nic nie znalazłem. Spróbuj dopisać miasto albo zapisz z przybliżoną lokalizacją.'; showManualForm(parsed); return; }
  addCtx.candidates = cands;
  msg.textContent = cands.length > 1 ? 'Wybierz właściwe miejsce:' : 'Znalazłem:';
  list.innerHTML = cands.map((c, i) => `<li><button type="button" class="pl-cand" data-i="${i}">${flagHTML(c.cc, 'sflag')}<span><b>${esc(c.name || parsed.name)}</b><small>${esc(c.addr || [c.city, countryName(c.cc)].filter(Boolean).join(', '))}</small></span></button></li>`).join('');
  list.querySelectorAll('.pl-cand').forEach((b) => b.addEventListener('click', () => chooseCandidate(Number(b.dataset.i))));
  if (cands.length === 1 || cands[0].exact) chooseCandidate(0);
}
function chooseCandidate(i) {
  const c = addCtx.candidates[i];
  $('plCands').querySelectorAll('.pl-cand').forEach((b) => b.classList.toggle('on', Number(b.dataset.i) === i));
  const parsed = addCtx.parsed || {};
  showPlaceForm({
    name: c.name || parsed.name || '', addr: c.addr || parsed.addr || '', city: c.city || '', cc: c.cc, lat: c.lat, lng: c.lng,
    cat: c.cat || guessCat((parsed.name || '') + ' ' + (c.name || '')), url: parsed.url || '', approx: false,
  });
}
function showManualForm(parsed) {
  const cc = addCtx.pre.cc || '';
  showPlaceForm({ name: parsed.name || '', addr: parsed.addr || '', city: '', cc, lat: null, lng: null, cat: guessCat(parsed.name), url: parsed.url || '', approx: true });
}
function showPlaceForm(d) {
  const f = $('plForm');
  const today = new Date().toISOString().slice(0, 10);
  f.hidden = false;
  f.innerHTML = `
    <div class="field"><label for="plName">Nazwa</label><input id="plName" type="text" value="${esc(d.name)}"></div>
    ${d.approx ? `<div class="field"><label for="plCC">Kraj (lokalizacja przybliżona)</label><select id="plCC"></select><input id="plCity" type="text" placeholder="Miasto (opcjonalnie)" value="${esc(d.city)}"></div>` : ''}
    <div class="field"><span class="field-label">Kategoria</span>${catChips(d.cat, 'newcat')}</div>
    <div class="seg seg-wide" id="plNewSt" role="radiogroup"><button type="button" data-st="visited" role="radio" aria-checked="true">${svgIcon('stamp', 16)} Byłem tu</button><button type="button" data-st="planned" role="radio" aria-checked="false">${svgIcon('plane', 16)} Chcę odwiedzić</button></div>
    <div class="two-col"><div class="field"><label for="plNewDate">Kiedy</label><input id="plNewDate" type="date" value="${today}"></div>
      <div class="field"><span class="field-label">Ocena</span><div class="hearts" id="plNewHearts">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-r="${n}" aria-label="${n} na 5">${ICON_HEART}</button>`).join('')}</div></div></div>
    <div class="field"><label for="plNewNote">Notatka</label><textarea id="plNewNote" rows="2" placeholder="Co zamówić, z kim, wrażenia"></textarea></div>
    <button type="button" class="btn btn-big" id="plSave">Zapisz miejsce</button>`;
  if (d.approx) { fillHomeSelect($('plCC'), d.cc); $('plCC').options[0].textContent = '(wybierz kraj)'; }
  let cat = d.cat || 'other', st = 'visited', rating = 0;
  f.querySelector('[data-chips="newcat"]').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (!b) return; cat = b.dataset.cat; f.querySelectorAll('[data-chips="newcat"] .cat-chip').forEach((x) => x.classList.toggle('on', x === b)); });
  $('plNewSt').addEventListener('click', (e) => {
    const b = e.target.closest('[data-st]'); if (!b) return; st = b.dataset.st;
    $('plNewSt').querySelectorAll('[data-st]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    $('plNewHearts').closest('.field').hidden = st !== 'visited';
    $('plNewDate').value = st === 'visited' ? today : '';
    f.querySelector('label[for="plNewDate"]').textContent = st === 'visited' ? 'Kiedy' : 'Planowany termin (opcjonalnie)';
  });
  $('plNewHearts').addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (!b) return; const r = Number(b.dataset.r); rating = rating === r ? 0 : r; $('plNewHearts').querySelectorAll('[data-r]').forEach((x) => x.classList.toggle('on', rating >= Number(x.dataset.r))); });
  $('plSave').addEventListener('click', () => {
    const name = $('plName').value.trim();
    if (!name) { $('plName').focus(); return; }
    let { lat, lng, cc, city } = d;
    if (d.approx) {
      cc = $('plCC').value; city = $('plCity').value.trim();
      if (!cc) { $('plCC').focus(); toast('Wybierz kraj.'); return; }
      const fc = byId.get(cc).focus;
      const jitter = () => (Math.random() - 0.5) * 0.6;
      lat = fc[1] + jitter(); lng = fc[0] + jitter();
    }
    const p = { id: uid(), name, addr: d.addr, city, cc, lat, lng, approx: !!d.approx, cat, status: st, date: $('plNewDate').value, rating: st === 'visited' ? rating : 0, note: $('plNewNote').value.trim(), url: d.url, src: d.url ? 'gmaps' : 'search', addedAt: new Date().toISOString() };
    savePlace(p);
    closeModal(); sfx.stamp(); buzz(25);
    toast(`${catIcon(p.cat, 18)} Zapisano: <b>${esc(p.name)}</b>`);
    showView('globe');
    openPlace(p.id, { fly: true });
  });
  f.scrollIntoView({ block: 'nearest' });
}

/* ================= Rekomendacje od AI ================= */
function aiPrompt(dest, likes) {
  return `Jadę: ${dest || '[miasto lub kraj, liczba dni]'}.${likes ? ` Interesuje mnie: ${likes}.` : ''}
Poleć mi najlepsze miejsca do odwiedzenia: jedzenie, kawiarnie, zabytki, widoki i lokalne perełki. Podawaj tylko prawdziwe miejsca, które da się znaleźć w Google Maps.

Na samym końcu odpowiedzi dodaj blok kodu JSON dokładnie w tym formacie (bez komentarzy, polskie nazwy kategorii):
\`\`\`json
{"alvatour": 1, "places": [
  {"name": "Dokładna nazwa miejsca", "city": "Miasto", "country": "Kraj po polsku", "category": "restauracja | kawiarnia | bar | nocleg | zabytek | muzeum | widok | natura | plaża | zakupy | inne", "note": "Dlaczego warto, jedno zdanie"}
]}
\`\`\``;
}
function ccFromName(name) {
  const n = normalizeText(name);
  if (!n) return '';
  const f = features.find((f) => f.norm === n || f.normEn === n || (f.alias && f.alias.split(' ').includes(n)));
  return f ? f.id : '';
}

function openAIImport(seed = '') {
  const pre = looksLikeAI(seed) ? seed : '';
  openModal(`
    <div class="pl-add ai-import">
      <div class="share-head"><h2>Plan od AI</h2><button type="button" class="btn-ghost icon-only" data-x aria-label="Zamknij"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>
      <ol class="ai-steps">
        <li><p><b>Zapytaj AI.</b> Wpisz cel, a ja przygotuję prompt dla Claude, Gemini albo ChatGPT.</p>
          <div class="two-in"><input id="aiDest" type="text" placeholder="Dokąd? np. Porto, 3 dni"><input id="aiLikes" type="text" placeholder="Co lubisz? np. kawa, widoki"></div>
          <div class="btn-row"><button type="button" class="btn" id="aiShare">Wyślij do aplikacji AI</button><button type="button" class="btn btn-soft" id="aiCopy">Kopiuj prompt</button></div>
          <p class="muted small" id="aiCopyMsg"></p>
        </li>
        <li><p><b>Przenieś odpowiedź.</b> W aplikacji AI: <b>Udostępnij</b> → <b>AlvaTour</b>, albo skopiuj całą odpowiedź i wklej tutaj.</p>
          <textarea id="aiText" rows="4" placeholder="Wklej odpowiedź AI (z blokiem JSON na końcu)">${esc(pre)}</textarea>
          <button type="button" class="btn btn-soft" id="aiParse">Wczytaj miejsca</button>
        </li>
      </ol>
      <div id="aiMsg" class="pl-msg" role="status"></div>
      <ul class="ai-list" id="aiList"></ul>
      <button type="button" class="btn btn-big" id="aiSave" hidden>Dodaj zaznaczone</button>
    </div>`, (card) => {
    card.querySelector('[data-x]').addEventListener('click', closeModal);
    const prompt = () => aiPrompt(card.querySelector('#aiDest').value.trim(), card.querySelector('#aiLikes').value.trim());
    card.querySelector('#aiCopy').addEventListener('click', () => {
      const t = prompt();
      const ok = () => { card.querySelector('#aiCopyMsg').textContent = 'Skopiowano. Wklej w Claude albo Gemini.'; };
      AlvaNative.copy(t).then(ok, () => { $('aiText').value = t; $('aiText').select(); card.querySelector('#aiCopyMsg').textContent = 'Zaznaczyłem prompt w polu poniżej, skopiuj go ręcznie.'; });
    });
    card.querySelector('#aiShare').addEventListener('click', async () => {
      const t = prompt();
      try { await AlvaNative.shareText(t, 'Plan podróży'); } catch (e) { card.querySelector('#aiCopy').click(); }
    });
    card.querySelector('#aiParse').addEventListener('click', () => runAIParse(card));
    if (pre) runAIParse(card);
  });
}
async function runAIParse(card) {
  const items = parseAI($('aiText').value);
  const msg = $('aiMsg'), list = $('aiList'), saveBtn = $('aiSave');
  if (!items.length) { msg.textContent = 'Nie znalazłem listy miejsc. Upewnij się, że odpowiedź AI zawiera blok JSON z promptu.'; list.innerHTML = ''; saveBtn.hidden = true; return; }
  const token = Symbol('ai');
  runAIParse.token = token;
  items.forEach((it) => { it.cc = ccFromName(it.country); it.state = 'wait'; it.on = true; });
  const row = (it, i) => `<li class="ai-item ${it.state}" data-i="${i}">
      <label><input type="checkbox" ${it.on ? 'checked' : ''}><span class="pr-ico" style="--c:${catOf(it.cat).color}">${catIcon(it.cat, 16)}</span>
      <span class="ai-txt"><b>${esc(it.name)}</b><small>${esc([it.city, it.cc ? countryName(it.cc) : it.country].filter(Boolean).join(', '))}${it.note ? ' · ' + esc(it.note) : ''}</small></span>
      <span class="ai-st">${it.state === 'ok' ? 'znalezione' : it.state === 'approx' ? 'przybliżone' : it.state === 'miss' ? 'nie znaleziono' : '<span class="spinner sm"></span>'}</span></label></li>`;
  const draw = () => {
    list.innerHTML = items.map(row).join('');
    list.querySelectorAll('.ai-item input').forEach((cb) => cb.addEventListener('change', () => { items[Number(cb.closest('.ai-item').dataset.i)].on = cb.checked; updBtn(); }));
  };
  const updBtn = () => { const n = items.filter((x) => x.on && x.state !== 'miss' && x.state !== 'wait').length; saveBtn.hidden = false; saveBtn.disabled = !n; saveBtn.textContent = n ? `Dodaj zaznaczone (${n}) jako „do odwiedzenia”` : 'Czekam na lokalizacje…'; };
  msg.textContent = `Znalazłem ${items.length} ${plural(items.length, ['miejsce', 'miejsca', 'miejsc'])}. Szukam ich na mapie…`;
  draw(); updBtn();
  let offline = false;
  for (let i = 0; i < items.length; i++) {
    if (runAIParse.token !== token || $('modal').hidden) return;
    const it = items[i];
    if (!offline) {
      try {
        const res = await geoSearch([it.name, it.city, it.country].filter(Boolean).join(', '));
        const hit = res.find((r) => !it.cc || r.cc === it.cc) || res[0];
        if (hit) { Object.assign(it, { lat: hit.lat, lng: hit.lng, cc: hit.cc, city: it.city || hit.city, addr: hit.addr, state: 'ok' }); if (!it.cat || it.cat === 'other') it.cat = hit.cat || it.cat; }
      } catch (e) { offline = true; }
    }
    if (it.state !== 'ok') {
      if (it.cc && byId.has(it.cc)) { const fc = byId.get(it.cc).focus; Object.assign(it, { lat: fc[1] + (Math.random() - 0.5) * 0.6, lng: fc[0] + (Math.random() - 0.5) * 0.6, state: 'approx' }); }
      else it.state = 'miss';
    }
    draw(); updBtn();
  }
  msg.textContent = offline ? 'Wyszukiwarka adresów jest niedostępna (brak internetu?). Miejsca dostaną przybliżoną lokalizację w kraju.' : 'Gotowe. Odznacz to, czego nie chcesz.';
  saveBtn.onclick = () => {
    const chosen = items.filter((x) => x.on && (x.state === 'ok' || x.state === 'approx'));
    for (const it of chosen) {
      savePlace({ id: uid(), name: it.name, addr: it.addr || '', city: it.city, cc: it.cc, lat: it.lat, lng: it.lng, approx: it.state === 'approx', cat: it.cat, status: 'planned', date: '', rating: 0, note: it.note, url: '', src: 'ai', addedAt: new Date().toISOString() }, { silent: true });
    }
    state.games.aiImports = (state.games.aiImports || 0) + 1; saveNow();
    closeModal(); sfx.fanfare(); confetti(null, null, 80);
    toast(`${svgIcon('plane', 18)} Dodano ${chosen.length} ${plural(chosen.length, ['miejsce', 'miejsca', 'miejsc'])} do planu`);
    checkProgress(false);
    if (chosen.length) {
      showView('globe');
      const c = d3.geoCentroid({ type: 'MultiPoint', coordinates: chosen.map((x) => [x.lng, x.lat]) });
      const spread = d3.max(chosen, (x) => d3.geoDistance([x.lng, x.lat], c)) || 0.01;
      flyTo([-c[0], -c[1]], clamp(0.5 / Math.max(spread, 0.004), 1.5, 40), 1300);
    }
  };
}

/* ================= Odznaki za miejsca ================= */
BADGES.push(
  { id: 'pl10', icon: 'stamp', name: 'Kolekcjoner miejsc', desc: '10 odwiedzonych miejsc.', t: () => [state.places.filter((p) => p.status === 'visited').length, 10] },
  { id: 'food10', icon: 'heart', name: 'Smakosz', desc: '10 odwiedzonych restauracji.', t: () => [state.places.filter((p) => p.status === 'visited' && p.cat === 'food').length, 10] },
  { id: 'cafe5', icon: 'sun', name: 'Kawowy obieżyświat', desc: 'Kawiarnie w 5 krajach.', t: () => [new Set(state.places.filter((p) => p.status === 'visited' && p.cat === 'cafe').map((p) => p.cc)).size, 5] },
  { id: 'aiplan', icon: 'brain', name: 'Planista z AI', desc: 'Zaimportuj plan od AI.', t: () => [Math.min(1, state.games.aiImports || 0), 1] },
);

/* ================= Udostępnianie do aplikacji (Android) ================= */
// Google Maps / Claude / Gemini: Udostępnij -> AlvaTour. Tekst przychodzi z natywnej wtyczki (AlvaNative.listenForShares).
function handleSharedText(text) {
  if (!dataReady) { toast('Aplikacja jest w trybie bezpiecznym, więc nie mogę teraz dodać miejsca.'); return; }
  if (!state.settings.onboarded) { state.settings.onboarded = true; saveNow(); }
  showView('globe');
  if (looksLikeAI(text)) openAIImport(text); else openPlaceAdd({ shared: text });
}
$('btnAddPlace').addEventListener('click', () => openPlaceAdd());
