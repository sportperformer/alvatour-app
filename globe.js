/* AlvaTour: glob (rysowanie na canvas, obracanie, przybliżanie, przeloty, tryby specjalne). */
'use strict';

const stage = $('stage');
const canvas = $('globe');
const ctx = canvas.getContext('2d');
const projection = d3.geoOrthographic().clipAngle(90).precision(0.4);
const geoPath = d3.geoPath(projection, ctx);
const SPHERE = { type: 'Sphere' };
const GRATICULE = d3.geoGraticule10();

let tiny = [];
let W = 0, H = 0, DPR = 1, baseScale = 1;
let rotation = [-17, -42, 0];
let zoomK = 1;
let hoverId = null, selectedId = null;
let globeMode = 'normal';   // normal | quiz | time | roulette
let focusId = null;         // podświetlenie w quizie i ruletce
let focusColor = null;
let timeYear = null;        // wehikuł czasu: pokazuj tylko kraje do tego roku
let lastInteract = Date.now();

function resize() {
  W = stage.clientWidth; H = stage.clientHeight;
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  baseScale = Math.min(W, H) / 2 * 0.9;
  projection.translate([W / 2, H / 2]);
  render();
}

let rafPending = false;
function requestRender() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => { rafPending = false; render(); });
}

const patternCache = new Map();
function hatch(color) {
  const key = color + C.land;
  if (patternCache.has(key)) return patternCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 8;
  const x = c.getContext('2d');
  x.fillStyle = C.land; x.fillRect(0, 0, 8, 8);
  x.strokeStyle = color; x.lineWidth = 2.2; x.globalAlpha = 0.75;
  x.beginPath(); x.moveTo(-2, 10); x.lineTo(10, -2); x.moveTo(-2, 2); x.lineTo(2, -2); x.moveTo(6, 10); x.lineTo(10, 6); x.stroke();
  const p = ctx.createPattern(c, 'repeat');
  patternCache.set(key, p);
  return p;
}

function shownVisited(id) {
  if (!isVisited(id)) return false;
  if (timeYear == null) return true;
  const y = entry(id).firstYear;
  return y != null && y <= timeYear;
}
function shownWish(id) { return timeYear == null && globeMode !== 'quiz' && isWish(id); }

function render() {
  if (!W) return;
  projection.scale(baseScale * zoomK).rotate(rotation);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.lineJoin = 'round';

  // poświata pod globem
  const R = baseScale * zoomK;
  if (zoomK < 2.5) {
    const g = ctx.createRadialGradient(W / 2, H / 2, R * 0.9, W / 2, H / 2, R * 1.12);
    g.addColorStop(0, C.rim); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.55; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W / 2, H / 2, R * 1.12, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }

  ctx.beginPath(); geoPath(SPHERE); ctx.fillStyle = C.ocean; ctx.fill();
  ctx.beginPath(); geoPath(GRATICULE); ctx.strokeStyle = C.grat; ctx.lineWidth = 1; ctx.stroke();
  if (!features.length) return;

  const bw = Math.min(1.1, 0.5 + zoomK * 0.04);
  const special = (id) => id === hoverId || id === focusId;

  ctx.beginPath();
  for (const f of features) if (!shownVisited(f.id) && !shownWish(f.id) && !special(f.id)) geoPath(f);
  ctx.fillStyle = C.land; ctx.fill();
  ctx.strokeStyle = C.border; ctx.lineWidth = bw; ctx.stroke();

  for (const f of features) {
    if (special(f.id)) continue;
    const v = shownVisited(f.id), w = !v && shownWish(f.id);
    if (!v && !w) continue;
    ctx.beginPath(); geoPath(f);
    ctx.fillStyle = v ? inkOfId(f.id) : hatch(inkOfId(f.id)); ctx.fill();
    ctx.strokeStyle = C.border; ctx.lineWidth = bw; ctx.stroke();
  }

  if (hoverId && byId.has(hoverId) && hoverId !== focusId) {
    const f = byId.get(hoverId);
    ctx.beginPath(); geoPath(f);
    if (shownVisited(f.id)) { ctx.fillStyle = inkOfId(f.id); ctx.fill(); ctx.globalAlpha = 0.22; ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.globalAlpha = 1; }
    else { ctx.fillStyle = shownWish(f.id) ? hatch(inkOfId(f.id)) : C.land; ctx.fill(); ctx.globalAlpha = 0.3; ctx.fillStyle = inkOfId(f.id); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.strokeStyle = C.border; ctx.lineWidth = bw; ctx.stroke();
  }

  if (focusId && byId.has(focusId)) {
    const f = byId.get(focusId);
    const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 180);
    ctx.beginPath(); geoPath(f);
    ctx.fillStyle = C.land; ctx.fill();
    ctx.globalAlpha = 0.45 + 0.5 * pulse; ctx.fillStyle = focusColor || C.accent; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = C.fg; ctx.lineWidth = 2; ctx.stroke();
  }

  if (selectedId && byId.has(selectedId)) {
    ctx.beginPath(); geoPath(byId.get(selectedId));
    ctx.strokeStyle = C.fg; ctx.lineWidth = 2.2; ctx.stroke();
  }

  // linie podróży z domu
  const home = homeId();
  if (state.settings.lines && home && globeMode !== 'quiz') {
    const h = byId.get(home).focus;
    ctx.setLineDash([4, 4]); ctx.lineWidth = 1.4; ctx.globalAlpha = 0.85;
    for (const f of features) {
      if (f.id === home || !shownVisited(f.id)) continue;
      ctx.beginPath(); geoPath({ type: 'LineString', coordinates: [h, f.focus] });
      ctx.strokeStyle = C.fg; ctx.stroke();
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }

  // kropki małych państw
  const center = [-rotation[0], -rotation[1]];
  for (const f of tiny) {
    const rPx = f.radius * R;
    if (rPx > 5 || d3.geoDistance(f.centroid, center) > Math.PI / 2 - 0.02) { f.dot = null; continue; }
    const p = projection(f.centroid);
    f.dot = p;
    const v = shownVisited(f.id), w = !v && shownWish(f.id);
    const hl = f.id === hoverId || f.id === selectedId || f.id === focusId;
    const r = hl ? 5.5 : (v || w) ? 4 : (zoomK < 2.5 ? 2.6 : 3.6);
    ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
    ctx.fillStyle = f.id === focusId ? (focusColor || C.accent) : v ? inkOfId(f.id) : w ? hatch(inkOfId(f.id)) : C.land; ctx.fill();
    ctx.strokeStyle = f.id === selectedId ? C.fg : C.border; ctx.lineWidth = f.id === selectedId ? 2 : 1; ctx.stroke();
  }

  drawPlaces(center, R);

  // dom
  if (home && globeMode !== 'quiz') {
    const hf = byId.get(home);
    if (d3.geoDistance(hf.focus, center) < Math.PI / 2 - 0.05) {
      const [x, y] = projection(hf.focus);
      ctx.save(); ctx.translate(x, y - 12);
      ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(-7, 2); ctx.arc(0, -1, 7.5, Math.PI * 0.82, Math.PI * 0.18); ctx.closePath();
      ctx.fillStyle = C.fg; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-3.6, 0.5); ctx.lineTo(0, -3); ctx.lineTo(3.6, 0.5); ctx.lineTo(3.6, 3.5); ctx.lineTo(-3.6, 3.5); ctx.closePath();
      ctx.fillStyle = C.panel; ctx.fill(); ctx.restore();
    }
  }

  ctx.beginPath(); geoPath(SPHERE); ctx.strokeStyle = C.rim; ctx.lineWidth = 1.5; ctx.stroke();
}

/* ---------- Trafienie w kraj ---------- */
function inBounds(f, lon, lat) {
  const [[x0, y0], [x1, y1]] = f.bounds;
  if (lat < y0 - 0.01 || lat > y1 + 0.01) return false;
  if (x0 <= x1) return lon >= x0 - 0.01 && lon <= x1 + 0.01;
  return lon >= x0 - 0.01 || lon <= x1 + 0.01;
}
function hitTest(x, y) {
  let best = null, bestD = 11;
  for (const f of tiny) {
    if (!f.dot) continue;
    const d = Math.hypot(f.dot[0] - x, f.dot[1] - y);
    if (d < bestD) { bestD = d; best = f; }
  }
  if (best) return best;
  const p = projection.invert([x, y]);
  if (!p || isNaN(p[0])) return null;
  if (d3.geoDistance(p, [-rotation[0], -rotation[1]]) > Math.PI / 2) return null;
  const cand = [];
  for (const f of features) if (inBounds(f, p[0], p[1]) && d3.geoContains(f, p)) cand.push(f);
  if (!cand.length) return null;
  cand.sort((a, b) => a.area - b.area);
  return cand[0];
}

/* ---------- Obracanie i przybliżanie ---------- */
const MIN_K = 0.8, MAX_K = 120;
let lastT = d3.zoomIdentity;
let programmatic = false;
const zoomer = d3.zoom()
  .scaleExtent([MIN_K, MAX_K])
  .filter((ev) => (!ev.ctrlKey || ev.type === 'wheel') && !ev.button && ev.type !== 'dblclick')
  .on('start', () => { if (!programmatic) { stopFlight(); lastInteract = Date.now(); canvas.classList.add('dragging'); } })
  .on('zoom', (ev) => {
    const t = ev.transform;
    if (programmatic) { lastT = t; return; }
    if (Math.abs(t.k - lastT.k) > 1e-9) zoomK = t.k;
    else {
      const degPerPx = 57.2958 / (baseScale * zoomK);
      rotation = [rotation[0] + (t.x - lastT.x) * degPerPx, clamp(rotation[1] - (t.y - lastT.y) * degPerPx, -89, 89), 0];
    }
    lastT = t; lastInteract = Date.now();
    hideTooltip(); requestRender();
  })
  .on('end', () => canvas.classList.remove('dragging'));
function syncZoom() {
  programmatic = true;
  d3.select(canvas).call(zoomer.transform, d3.zoomIdentity.scale(zoomK));
  programmatic = false;
}

/* ---------- Animowany przelot ---------- */
let flight = null;
function stopFlight() { if (flight) { flight.stop(); flight = null; syncZoom(); } }
function flyTo(targetRot, targetK, duration = 950, opts = {}) {
  return new Promise((resolve) => {
    stopFlight();
    const r0 = rotation.slice(), k0 = zoomK;
    let lam1 = targetRot[0];
    const spins = opts.spins || 0;
    while (lam1 - r0[0] > 180) lam1 -= 360;
    while (lam1 - r0[0] < -180) lam1 += 360;
    lam1 -= spins * 360;
    const r1 = [lam1, targetRot[1]];
    const k1 = clamp(targetK, MIN_K, MAX_K);
    const dist = d3.geoDistance([-r0[0], -r0[1]], [-r1[0], -r1[1]]) * 57.3;
    const kMid = (dist > 35 || spins) ? Math.min(k0, k1, Math.max(0.95, 3 - dist / 40)) : null;
    const dur = reducedMotion() ? 0 : duration;
    const ease = opts.ease || d3.easeCubicInOut;
    const lerp = (a, b, t) => a + (b - a) * t;
    let lastTick = -1;
    const step = (t) => {
      const e = ease(t);
      rotation = [lerp(r0[0], r1[0], e), lerp(r0[1], r1[1], e), 0];
      if (kMid) zoomK = e < 0.5 ? Math.exp(lerp(Math.log(k0), Math.log(kMid), e * 2)) : Math.exp(lerp(Math.log(kMid), Math.log(k1), (e - 0.5) * 2));
      else zoomK = Math.exp(lerp(Math.log(k0), Math.log(k1), e));
      if (opts.ticks) { const tk = Math.floor(rotation[0] / 12); if (tk !== lastTick) { lastTick = tk; sfx.tick(); } }
      render();
    };
    if (!dur) { step(1); syncZoom(); resolve(); return; }
    flight = d3.timer((elapsed) => {
      const t = Math.min(1, elapsed / dur);
      step(t);
      if (t >= 1) { flight.stop(); flight = null; syncZoom(); resolve(); }
    });
  });
}
function countryZoom(f, fill = 0.55) { return clamp(fill * Math.min(W, H) / (f.extent * baseScale), 1, 40); }
function flyToCountry(f, opts = {}) {
  // przesuń kraj tak, żeby nie chował się pod panelem albo kartą gry
  const k = Math.min(opts.maxK || 40, countryZoom(f, opts.fill || 0.5));
  const R = baseScale * k;
  let dx = 0, dy = opts.liftPx || 0;
  if (opts.lift) { if (W < 720) dy = H * 0.22; else dx = Math.min(210, W * 0.16); }
  let lat = f.focus[1] - (dy / R) * 57.3;
  lat = clamp(lat, -89, 89);
  const lon = f.focus[0] + (dx / R) * 57.3 / Math.max(0.2, Math.cos(f.focus[1] * Math.PI / 180));
  return flyTo([-lon, -lat], k, opts.duration || 950, opts);
}
function zoomBy(factor) { flyTo(rotation, zoomK * factor, 350); }

/* ---------- Podświetlenie pulsujące ---------- */
let pulseTimer = null;
function setFocus(id, color) {
  focusId = id; focusColor = color || null;
  if (pulseTimer) { pulseTimer.stop(); pulseTimer = null; }
  if (id) pulseTimer = d3.timer(() => { if (!flight) render(); });
  requestRender();
}

/* ---------- Autoobrót ---------- */
let spinTimer = null;
function spinAllowed() {
  return state.settings.spin && globeMode === 'normal' && $('sheet').hidden && activeView === 'globe' && !flight
    && zoomK < 2 && document.visibilityState === 'visible' && Date.now() - lastInteract > 6000 && $('modal').hidden;
}
setInterval(() => {
  if (spinTimer || !features.length || !spinAllowed()) return;
  let prev = null;
  spinTimer = d3.timer((el) => {
    if (!spinAllowed()) { spinTimer.stop(); spinTimer = null; return; }
    const dt = prev == null ? 16 : el - prev; prev = el;
    rotation = [rotation[0] + dt * 0.006, rotation[1] + (-25 - rotation[1]) * 0.002, 0];
    render();
  });
}, 1000);
['pointerdown', 'wheel', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, () => { lastInteract = Date.now(); }, { passive: true }));

/* ---------- Wskaźnik: tap / najechanie ---------- */
const tooltip = $('tooltip');
let down = null, pointers = 0;
canvas.addEventListener('pointerdown', (e) => {
  pointers++;
  down = pointers === 1 ? { x: e.clientX, y: e.clientY, t: performance.now(), multi: false } : (down && Object.assign(down, { multi: true }));
});
window.addEventListener('pointerup', (e) => {
  pointers = Math.max(0, pointers - 1);
  if (!down || e.target !== canvas) { if (pointers === 0) down = null; return; }
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  const quick = performance.now() - down.t < 700;
  const wasMulti = down.multi;
  if (pointers === 0) down = null;
  if (wasMulti || moved > 6 || !quick) return;
  if (globeMode !== 'normal') return;
  const r = canvas.getBoundingClientRect();
  const pl = hitPlace(e.clientX - r.left, e.clientY - r.top);
  if (pl) { openPlace(pl.id); return; }
  const f = hitTest(e.clientX - r.left, e.clientY - r.top);
  if (f) openCountry(f.id); else closeSheet();
});
window.addEventListener('pointercancel', () => { pointers = Math.max(0, pointers - 1); if (!pointers) down = null; });

let hoverRaf = false, lastMove = null;
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || e.buttons) return;
  lastMove = e;
  if (hoverRaf) return;
  hoverRaf = true;
  requestAnimationFrame(() => {
    hoverRaf = false;
    if (globeMode === 'quiz' || globeMode === 'roulette') { hideTooltip(); return; }
    const r = canvas.getBoundingClientRect();
    const x = lastMove.clientX - r.left, y = lastMove.clientY - r.top;
    const pl = hitPlace(x, y);
    if ((pl ? pl.id : null) !== placeHover) { placeHover = pl ? pl.id : null; requestRender(); }
    if (pl) {
      if (hoverId) { hoverId = null; requestRender(); }
      canvas.classList.add('over-country');
      const yr = placeYear(pl);
      tooltip.innerHTML = `${esc(pl.name)}<small>${esc([pl.city, pl.status === 'planned' ? 'do odwiedzenia' : yr].filter(Boolean).join(' · '))}</small>`;
      tooltip.style.left = x + 'px'; tooltip.style.top = y + 'px'; tooltip.hidden = false;
      return;
    }
    const f = hitTest(x, y);
    const id = f ? f.id : null;
    if (id !== hoverId) { hoverId = id; requestRender(); }
    canvas.classList.toggle('over-country', !!f);
    if (f) {
      const c = entry(f.id);
      let extra = '';
      if (f.id === homeId()) extra = 'dom';
      else if (c && c.visited) extra = c.firstYear ? 'od ' + c.firstYear : 'byłem';
      else if (c && c.wish) extra = 'marzenie';
      tooltip.innerHTML = `${flagEmoji(f.id) && flagSupport ? flagEmoji(f.id) + ' ' : ''}${esc(f.properties.n)}${extra ? `<small>${extra}</small>` : ''}`;
      tooltip.style.left = x + 'px'; tooltip.style.top = y + 'px';
      tooltip.hidden = false;
    } else hideTooltip();
  });
});
canvas.addEventListener('pointerleave', () => { hideTooltip(); if (hoverId || placeHover) { hoverId = null; placeHover = null; requestRender(); } });
function hideTooltip() { tooltip.hidden = true; }

$('zoomIn').addEventListener('click', () => zoomBy(1.8));
$('zoomOut').addEventListener('click', () => zoomBy(1 / 1.8));
$('zoomReset').addEventListener('click', () => flyTo(rotation, 1, 600));
$('btnLines').addEventListener('click', () => {
  state.settings.lines = !state.settings.lines; saveNow();
  $('btnLines').setAttribute('aria-pressed', String(state.settings.lines));
  if (state.settings.lines && !homeId()) toast('Ustaw kraj domowy w ustawieniach, żeby zobaczyć linie.');
  requestRender();
});
