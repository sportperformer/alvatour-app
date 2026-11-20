/* AlvaTour: Plany zwiedzania. Import z Google Moje Mapy, mapa Google z pinami, lista z checkboxami.
   Dane: state.plans = [{ id, name, mid, createdAt, items: [{ id, name, addr, cat, desc, color, layer,
   lat, lng, geo: 'wait' | 'ok' | 'miss', done: 'RRRR-MM-DD' | '', placeId }] }] (zapis jak reszta stanu, w kopiach i eksporcie). */
'use strict';

let planOpenId = null;
let planOnlyTodo = false;
let planMap = null;          // { map, markers: Map(itemId -> marker), info }
let planGeocoding = null;    // id planu, dla którego trwa szukanie lokalizacji
let myPos = null;            // { lat, lng, acc } ostatnia pozycja telefonu (tylko w pamięci, nigdzie nie zapisywana)
let myWatch = null;          // id navigator.geolocation.watchPosition
let myFollow = false;        // po kliknięciu "Moja pozycja": wyśrodkuj mapę przy pierwszym odczycie

const plans = () => (Array.isArray(state.plans) ? state.plans : (state.plans = []));
const planById = (id) => plans().find((p) => p.id === id);
const planDone = (p) => p.items.filter((i) => i.done).length;
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const navUrl = (it) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([it.name, it.addr].filter(Boolean).join(', '))}&travelmode=walking`;

function renderPlans() {
  const body = $('plansBody');
  if (planOpenId && planById(planOpenId)) { renderPlan(planById(planOpenId)); return; }
  planOpenId = null; destroyPlanMap();
  $('plansTitle').textContent = 'Plany zwiedzania';
  $('planBack').hidden = true;
  $('planAdd').hidden = false;
  const list = plans();
  body.innerHTML = list.length ? `<ul class="plan-cards">${list.map((p) => {
    const n = p.items.length, d = planDone(p);
    return `<li><button type="button" class="plan-card" data-plan="${esc(p.id)}">
      <b>${esc(p.name)}</b>
      <span class="muted small">${d} / ${n} odwiedzone</span>
      <span class="plan-bar"><i style="width:${n ? Math.round((d / n) * 100) : 0}%"></i></span>
    </button></li>`;
  }).join('')}</ul>` : `<div class="plan-empty">${svgIcon('compass', 40)}<b>Nie masz jeszcze planów</b>
    <span>Masz mapę miejsc w Google Moje Mapy? Kliknij „Dodaj plan”, wklej link do mapy, a AlvaTour pokaże Twoje piny i pozwoli je odhaczać.</span></div>`;
  body.querySelectorAll('[data-plan]').forEach((b) => b.addEventListener('click', () => { planOpenId = b.dataset.plan; renderPlans(); }));
}

function renderPlan(p) {
  const body = $('plansBody');
  $('plansTitle').textContent = p.name;
  $('planBack').hidden = false;
  $('planAdd').hidden = true;
  body.innerHTML = `
    <div class="plan-top">
      <div class="plan-progress" id="planProgress"></div>
      <label class="switch"><input type="checkbox" id="planTodo" ${planOnlyTodo ? 'checked' : ''}><span>Tylko nieodwiedzone</span></label>
    </div>
    <p class="plan-note" id="planGeoMsg" hidden></p>
    <div class="plan-map" id="planMap"><p class="muted small">Ładuję mapę…</p></div>
    <div id="planList"></div>
    <button type="button" class="link danger-link" id="planDelete">Usuń plan</button>
    <div class="confirm" id="planDelConfirm" hidden><p>Usunąć plan „${esc(p.name)}”? Miejsca, które już odhaczyłeś, zostaną w Twoich miejscach.</p>
      <div class="btn-row"><button type="button" class="btn btn-danger" id="planDelYes">Tak, usuń plan</button><button type="button" class="btn btn-soft" id="planDelNo">Anuluj</button></div></div>`;
  $('planTodo').addEventListener('change', (e) => { planOnlyTodo = e.target.checked; renderPlanList(p); });
  $('planDelete').addEventListener('click', () => { $('planDelConfirm').hidden = false; });
  $('planDelNo').addEventListener('click', () => { $('planDelConfirm').hidden = true; });
  $('planDelYes').addEventListener('click', () => {
    state.plans = plans().filter((x) => x.id !== p.id);
    saveNow(); planOpenId = null; renderPlans(); toast(`Usunięto plan: ${esc(p.name)}`);
  });
  renderPlanList(p);
  drawPlanMap(p);
  if (p.items.some((i) => i.geo === 'wait') && planGeocoding !== p.id) geocodePlan(p);
}

/** Lista, postęp i komunikat o szukaniu lokalizacji (bez przeładowania mapy). */
function renderPlanList(p) {
  const n = p.items.length, d = planDone(p);
  $('planProgress').innerHTML = `<b>${d} / ${n}</b> odwiedzone<span class="plan-bar"><i style="width:${n ? Math.round((d / n) * 100) : 0}%"></i></span>`;
  const waiting = p.items.filter((i) => i.geo === 'wait').length;
  const msg = $('planGeoMsg');
  msg.hidden = !waiting;
  if (waiting) msg.textContent = planGeocoding === p.id ? `Szukam lokalizacji miejsc na mapie: zostało ${waiting}…` : `Brakuje lokalizacji dla ${waiting} ${plural(waiting, ['miejsca', 'miejsc', 'miejsc'])}. Otwórz plan ponownie z internetem.`;
  const groups = new Map();
  for (const it of p.items) { const k = it.cat || 'Inne'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); }
  const shown = (it) => !planOnlyTodo || !it.done;
  const box = $('planList');
  box.innerHTML = [...groups].map(([cat, items]) => {
    const vis = items.filter(shown);
    if (!vis.length && planOnlyTodo) return '';
    return `<section class="plan-group">
      <h3><span class="plan-dot" style="--c:${esc(items[0].color)}"></span>${esc(cat)} <span class="muted small">${items.filter((i) => i.done).length} / ${items.length}</span></h3>
      <ul class="plan-items">${vis.map((it) => `
        <li class="plan-item ${it.done ? 'done' : ''}" data-item="${esc(it.id)}" style="--c:${esc(it.color)}">
          <label class="plan-check"><input type="checkbox" ${it.done ? 'checked' : ''} aria-label="Byłem: ${esc(it.name)}"><span></span></label>
          <button type="button" class="plan-name" data-focus="${esc(it.id)}"><b>${esc(it.name)}<span class="plan-dist" data-dist="${esc(it.id)}"></span></b>
            ${it.desc ? `<span class="plan-desc">${esc(it.desc)}</span>` : ''}
            <span class="muted small">${esc(it.addr)}${it.geo === 'miss' ? ' · nie znalazłem na mapie' : ''}${it.done ? ` · byłem ${esc(D.formatPartial(it.done))}` : ''}</span></button>
          <a class="btn btn-soft plan-nav" href="${esc(navUrl(it))}" target="_blank" rel="noopener">Prowadź</a>
        </li>`).join('')}</ul>
    </section>`;
  }).join('') || '<p class="muted">Wszystko odwiedzone. Brawo!</p>';
  box.querySelectorAll('.plan-item input[type="checkbox"]').forEach((cb) => cb.addEventListener('change', () => togglePlanItem(p, cb.closest('[data-item]').dataset.item, cb.checked)));
  box.querySelectorAll('[data-focus]').forEach((b) => b.addEventListener('click', () => focusPlanItem(p, b.dataset.focus)));
  updatePlanDistances(p);
}

/** Pin na mapie po odhaczeniu: półprzezroczysty z ptaszkiem. */
function updatePlanMarker(it) {
  const m = planMap && planMap.markers.get(it.id);
  if (!m) return;
  if ('content' in m && m.content) m.content = markerContent(it);
  else if (m.setOpacity) m.setOpacity(it.done ? 0.4 : 1);
}

/** Odhaczenie: miejsce trafia też do "Moich miejsc" (a kraj dostaje stempel jak przy każdym odwiedzonym miejscu). */
function togglePlanItem(p, itemId, on) {
  const it = p.items.find((x) => x.id === itemId);
  if (!it) return;
  if (on) {
    it.done = todayISO();
    if (it.lat != null && !it.placeId) {
      const cc = ccFromPoint(it.lng, it.lat);
      const place = { id: uid(), name: it.name, addr: it.addr, city: '', cc, lat: it.lat, lng: it.lng, approx: false, cat: guessCat(`${it.cat} ${it.name}`), status: 'visited', date: it.done, rating: 0, note: it.desc || '', url: navUrl(it), src: 'plan', addedAt: new Date().toISOString() };
      savePlace(place, { silent: true });
      it.placeId = place.id;
    }
    sfx.pop(); buzz(15);
  } else {
    it.done = '';
    if (it.placeId) { state.places = state.places.filter((x) => x.id !== it.placeId); it.placeId = ''; }
  }
  saveNow(); afterDataChange(false);
  renderPlanList(p);
  updatePlanMarker(it);
  if (on && p.items.every((x) => x.done)) { sfx.fanfare(); confetti(null, null, 120); toast(`<b>Cały plan „${esc(p.name)}” zaliczony!</b>`, { kind: 'gold', ttl: 4000 }); }
}

/* ---------- Mapa Google ---------- */
function destroyPlanMap() { planMap = null; stopMyLocation(); }
function markerContent(it) {
  const el = document.createElement('div');
  el.className = 'gpin' + (it.done ? ' done' : '');
  el.style.setProperty('--c', it.color);
  el.innerHTML = it.done ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l4 4 10-10" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '';
  return el;
}
async function drawPlanMap(p) {
  const box = $('planMap');
  if (!AlvaMaps.hasKey()) { box.innerHTML = '<p class="muted small">Mapa Google pojawi się w wersji z kluczem mapy. Lista poniżej działa normalnie.</p>'; return; }
  let gm;
  try { gm = await AlvaMaps.load(); } catch (e) { if ($('planMap') === box) box.innerHTML = `<p class="muted small">${esc(e.message || e)} Lista poniżej działa normalnie.</p>`; return; }
  if ($('planMap') !== box) return; // widok zmienił się w trakcie ładowania
  const pts = p.items.filter((i) => i.lat != null);
  box.innerHTML = '';
  const map = new gm.Map(box, {
    center: pts.length ? { lat: pts[0].lat, lng: pts[0].lng } : { lat: 56.95, lng: 24.11 }, zoom: 13,
    mapId: 'DEMO_MAP_ID', gestureHandling: 'greedy', clickableIcons: false, streetViewControl: false, mapTypeControl: false, fullscreenControl: false,
  });
  const info = new gm.InfoWindow();
  const markers = new Map();
  const bounds = new gm.LatLngBounds();
  for (const it of pts) {
    const pos = { lat: it.lat, lng: it.lng };
    bounds.extend(pos);
    let m;
    if (gm.marker && gm.marker.AdvancedMarkerElement) {
      m = new gm.marker.AdvancedMarkerElement({ map, position: pos, content: markerContent(it), title: it.name });
      m.addListener('click', () => openPlanInfo(p, it, m));
    } else {
      m = new gm.Marker({ map, position: pos, title: it.name, opacity: it.done ? 0.4 : 1, icon: { path: gm.SymbolPath.CIRCLE, scale: 9, fillColor: it.color, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 } });
      m.addListener('click', () => openPlanInfo(p, it, m));
    }
    markers.set(it.id, m);
  }
  if (pts.length > 1) map.fitBounds(bounds, 40);
  planMap = { map, markers, info, gm, me: null, meCircle: null };
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'gme-btn'; btn.id = 'planMe'; btn.title = 'Moja pozycja'; btn.setAttribute('aria-label', 'Pokaż moją pozycję');
  btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  btn.addEventListener('click', () => { myFollow = true; if (myPos) showMyPos(true); startMyLocation(); });
  map.controls[gm.ControlPosition.RIGHT_BOTTOM].push(btn);
  if (myWatch != null && myPos) showMyPos(false);
}

/* ---------- Moja pozycja (GPS telefonu, tylko gdy plan jest otwarty; nic nie jest zapisywane) ---------- */
function startMyLocation() {
  if (!navigator.geolocation) { toast('Ten telefon nie udostępnia lokalizacji.'); return; }
  if (myWatch != null) return;
  const btn = $('planMe'); if (btn) btn.classList.add('busy');
  let gotFix = false;
  myWatch = navigator.geolocation.watchPosition((pos) => {
    if (activeView !== 'plans' || !planOpenId) { stopMyLocation(); return; }
    gotFix = true;
    myPos = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy || 0 };
    const b = $('planMe'); if (b) { b.classList.remove('busy'); b.classList.add('on'); }
    showMyPos(myFollow); myFollow = false;
    const cur = planById(planOpenId); if (cur) updatePlanDistances(cur);
  }, (err) => {
    const code = err && err.code;
    // chwilowa utrata sygnału (np. wąska uliczka): zostaje ostatnia pozycja, śledzenie trwa dalej
    if (gotFix && code !== 1) return;
    stopMyLocation();
    const b = $('planMe'); if (b) b.classList.remove('busy', 'on');
    if (code === 1) toast('Brak zgody na lokalizację. Włącz ją: Ustawienia telefonu → Aplikacje → AlvaTour → Uprawnienia → Lokalizacja → Zezwalaj tylko podczas używania aplikacji.');
    else toast('Nie mogę ustalić pozycji. Włącz Lokalizację w telefonie (przesuń palcem z góry ekranu → Lokalizacja) i kliknij jeszcze raz.');
  }, { enableHighAccuracy: true, maximumAge: 10000 });
}
function stopMyLocation() {
  if (myWatch != null && navigator.geolocation) navigator.geolocation.clearWatch(myWatch);
  myWatch = null;
}
function showMyPos(center) {
  if (!planMap || !myPos) return;
  const { gm, map } = planMap;
  const pos = { lat: myPos.lat, lng: myPos.lng };
  if (!planMap.me) {
    if (gm.marker && gm.marker.AdvancedMarkerElement) {
      const el = document.createElement('div'); el.className = 'gme';
      planMap.me = new gm.marker.AdvancedMarkerElement({ map, position: pos, content: el, title: 'Tu jesteś', zIndex: 999 });
    } else {
      planMap.me = new gm.Marker({ map, position: pos, title: 'Tu jesteś', zIndex: 999, icon: { path: gm.SymbolPath.CIRCLE, scale: 8, fillColor: '#1a73e8', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 } });
    }
    planMap.meCircle = new gm.Circle({ map, center: pos, radius: myPos.acc, clickable: false, strokeColor: '#1a73e8', strokeOpacity: 0.3, strokeWeight: 1, fillColor: '#1a73e8', fillOpacity: 0.12 });
  } else {
    if (planMap.me.setPosition) planMap.me.setPosition(pos); else planMap.me.position = pos;
    planMap.meCircle.setCenter(pos); planMap.meCircle.setRadius(myPos.acc);
  }
  if (center) { map.panTo(pos); if (map.getZoom() < 15) map.setZoom(16); }
}
/** Odległość w linii prostej (metry). */
function distM(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const fmtDist = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',')} km`);
function updatePlanDistances(p) {
  document.querySelectorAll('#planList [data-dist]').forEach((el) => {
    const it = p.items.find((i) => i.id === el.dataset.dist);
    el.textContent = myPos && it && it.lat != null && !it.done ? fmtDist(distM(myPos, it)) : '';
  });
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { stopMyLocation(); const b = $('planMe'); if (b) b.classList.remove('busy', 'on'); } });
function openPlanInfo(p, it, marker) {
  if (!planMap) return;
  planMap.info.setContent(`<div class="ginfo"><b>${esc(it.name)}</b><br><span>${esc(it.cat)}</span><br><a href="${esc(navUrl(it))}" target="_blank" rel="noopener">Prowadź</a></div>`);
  planMap.info.open({ map: planMap.map, anchor: marker });
  const row = document.querySelector(`.plan-item[data-item="${CSS.escape(it.id)}"]`);
  if (row) { row.classList.add('hl'); setTimeout(() => row.classList.remove('hl'), 1600); }
}
function focusPlanItem(p, itemId) {
  const it = p.items.find((x) => x.id === itemId);
  if (!it || it.lat == null || !planMap) return;
  planMap.map.panTo({ lat: it.lat, lng: it.lng });
  planMap.map.setZoom(16);
  openPlanInfo(p, it, planMap.markers.get(it.id));
  $('planMap').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ---------- Szukanie lokalizacji po adresie (OpenStreetMap, 1 zapytanie/s) ---------- */
async function geocodeOne(it, city) {
  const tries = [it.addr, [it.name, city].filter(Boolean).join(', '), it.addr && it.addr.replace(/,?\s*LV-\d{4}/, '')].filter((x, i, a) => x && a.indexOf(x) === i);
  for (const q of tries) {
    const r = await AlvaNative.geoJSON(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=pl&q=${encodeURIComponent(q)}`);
    if (Array.isArray(r) && r[0]) return { lat: Number(r[0].lat), lng: Number(r[0].lon) };
  }
  return null;
}
async function geocodePlan(p) {
  if (planGeocoding) return;
  planGeocoding = p.id;
  const city = p.name;
  if (activeView === 'plans' && planOpenId === p.id && $('planList')) renderPlanList(p);
  try {
    for (const it of p.items) {
      if (it.geo !== 'wait') continue;
      let hit = null;
      try { hit = await geocodeOne(it, city); } catch (e) { toast('Brak połączenia z wyszukiwarką adresów. Spróbuję ponownie przy następnym otwarciu planu.'); break; }
      if (hit) { it.lat = hit.lat; it.lng = hit.lng; it.geo = 'ok'; } else it.geo = 'miss';
      saveSoon();
      if (activeView === 'plans' && planOpenId === p.id && $('planList')) renderPlanList(p);
    }
  } finally {
    planGeocoding = null;
    saveNow();
    if (activeView === 'plans' && planOpenId === p.id && $('planList')) { renderPlanList(p); drawPlanMap(p); }
  }
}

/* ---------- Dodawanie planu ---------- */
function openPlanImport() {
  openModal(`<div class="dlg">
    <div class="share-head"><h2>Nowy plan zwiedzania</h2><button type="button" class="btn-ghost icon-only" data-x aria-label="Zamknij"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>
    <p>Wklej link do swojej mapy z <b>Google Moje Mapy</b>. Mapa musi być udostępniona: <b>Udostępnij</b> → „Każdy, kto ma link, może wyświetlać”.</p>
    <div class="field"><label for="planLink">Link do mapy</label><input id="planLink" type="url" inputmode="url" placeholder="https://www.google.com/maps/d/…mid=…"></div>
    <p class="field-error" id="planErr" hidden></p>
    <div class="btn-row"><button type="button" class="btn" data-ok>Importuj</button><button type="button" class="btn btn-soft" data-cancel>Anuluj</button></div>
  </div>`, (card) => {
    card.querySelector('[data-x]').addEventListener('click', closeModal);
    card.querySelector('[data-cancel]').addEventListener('click', closeModal);
    const ok = card.querySelector('[data-ok]'), err = card.querySelector('#planErr');
    ok.addEventListener('click', async () => {
      err.hidden = true; ok.disabled = true; ok.textContent = 'Pobieram mapę…';
      try {
        const m = await AlvaMaps.importMyMaps(card.querySelector('#planLink').value.trim());
        const existing = plans().find((x) => x.mid && x.mid === m.mid);
        const plan = { id: 'pl' + Date.now().toString(36), name: m.name, mid: m.mid, createdAt: new Date().toISOString(), items: [] };
        m.items.forEach((it, i) => {
          const prev = existing && existing.items.find((x) => x.name === it.name);
          plan.items.push({ id: plan.id + '-' + i, ...it, geo: it.lat != null ? 'ok' : (prev && prev.lat != null ? 'ok' : 'wait'),
            lat: it.lat ?? (prev ? prev.lat : null), lng: it.lng ?? (prev ? prev.lng : null), done: prev ? prev.done : '', placeId: prev ? prev.placeId : '' });
        });
        if (existing) state.plans = plans().filter((x) => x.id !== existing.id); // ponowny import: odhaczenia zostają
        plans().push(plan);
        saveNow(); closeModal();
        toast(`<b>Plan „${esc(plan.name)}”</b>: ${plan.items.length} ${plural(plan.items.length, ['miejsce', 'miejsca', 'miejsc'])}`);
        planOpenId = plan.id; showView('plans');
      } catch (e) {
        err.textContent = (e && e.message) || String(e); err.hidden = false;
        ok.disabled = false; ok.textContent = 'Importuj';
      }
    });
  });
  setTimeout(() => { const i = $('planLink'); if (i) i.focus(); }, 50);
}

$('planAdd').addEventListener('click', openPlanImport);
$('planBack').addEventListener('click', () => { planOpenId = null; renderPlans(); });
