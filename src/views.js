/* AlvaTour: nawigacja, lista, paszport, statystyki i odznaki, ustawienia, wyszukiwarka, powitanie. */
'use strict';

let activeView = 'globe';
const VIEWS = ['list', 'passport', 'stats', 'fun', 'menu'];

function showView(v) {
  if (globeMode !== 'normal' && v !== 'globe') endGame();
  activeView = v;
  for (const k of VIEWS) $('view-' + k).hidden = k !== v;
  document.querySelectorAll('#dock [data-view]').forEach((b) => {
    if (b.dataset.view === v || (v === 'menu' && false)) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  if (v !== 'globe') { closeSheet(); hideTooltip(); }
  if (v === 'list') renderList();
  if (v === 'passport') renderPassport();
  if (v === 'stats') renderStats();
  if (v === 'fun') renderFun();
  if (v === 'menu') openMenu();
  if (v === 'globe') requestRender();
}
$('dock').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) showView(b.dataset.view); });
document.querySelectorAll('[data-close-view]').forEach((b) => b.addEventListener('click', () => showView('globe')));
$('btnMenu').addEventListener('click', () => showView(activeView === 'menu' ? 'globe' : 'menu'));
$('brandBtn').addEventListener('click', () => showView('stats'));

function setSegment(container, attr, value) {
  container.querySelectorAll(`[data-${attr}]`).forEach((b) => b.setAttribute('aria-checked', String(b.dataset[attr] === value)));
}

/* ================= Nagłówek ================= */
function counts() {
  let states = 0, other = 0;
  for (const id of visitedIds()) { if (SOVEREIGN.has(id)) states++; else other++; }
  return { states, other };
}
function updateStats() {
  const { states, other } = counts();
  const r = rankFor(states);
  let txt = `${r.cur.name} · ${states}/${SOVEREIGN_TOTAL}`;
  if (other) txt += ` +${other}`;
  $('stats').textContent = txt;
}
function updateCountdown() {
  const el = $('countdown');
  let best = null;
  for (const id of wishIds()) {
    const d = daysUntil(entry(id).plannedDate);
    if (d != null && d >= 0 && (!best || d < best.d)) best = { id, d };
  }
  if (!best) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `${svgIcon('plane', 16)}<span><b>${esc(countryName(best.id))}</b> ${best.d === 0 ? 'dziś!' : best.d === 1 ? 'jutro!' : `za ${best.d} dni`}</span>`;
  el.onclick = () => { showView('globe'); openCountry(best.id, { fly: true }); };
}

/* ================= Lista ================= */
const listView = $('view-list');
function renderList() {
  const tab = state.settings.listTab;
  setSegment($('listTabs'), 'tab', tab);
  $('sortSeg').hidden = tab !== 'visited';
  $('placesTools').hidden = tab !== 'places';
  setSegment($('sortSeg'), 'sort', state.settings.sort);
  const ol = $('timeline');
  const byName = (a, b) => collator.compare(countryName(a), countryName(b));
  if (tab === 'places') { renderPlacesList(ol); return; }

  if (tab === 'wish') {
    const ids = wishIds().filter((id) => byId.has(id));
    ids.sort((a, b) => {
      const da = entry(a).plannedDate, db = entry(b).plannedDate;
      if (da && db) return da.localeCompare(db); if (da) return -1; if (db) return 1; return byName(a, b);
    });
    $('listSummary').textContent = ids.length ? `${countries(ids.length)} do odwiedzenia` : '';
    if (!ids.length) {
      ol.innerHTML = `<li class="empty">${svgIcon('plane', 40)}<b>Lista marzeń jest pusta</b><span>Otwórz dowolny kraj i kliknij „Chcę tu pojechać”, albo wylosuj cel w zakładce Zabawa.</span></li>`;
      return;
    }
    ol.innerHTML = ids.map((id) => {
      const c = entry(id), d = daysUntil(c.plannedDate);
      const when = c.plannedDate ? new Date(c.plannedDate + 'T00:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
      return `<li><button type="button" class="entry wish-entry" data-id="${esc(id)}" style="--stamp:${inkOfId(id)}">
        <span class="bar"></span>${flagHTML(id, 'eflag')}
        <span class="ename">${esc(countryName(id))}<span class="emeta">${esc(c.notes.trim().split('\n')[0] || (meta(id).c ? CONTINENTS[meta(id).c] : ''))}</span></span>
        <span class="eyears">${when ? `<span class="chip chip-strong">${esc(when)}</span><span class="chip">${esc(countdownText(d))}</span>` : ''}</span>
      </button></li>`;
    }).join('');
    return;
  }

  const ids = visitedIds().filter((id) => byId.has(id));
  const sort = state.settings.sort;
  if (sort === 'az') ids.sort(byName);
  else if (sort === 'fav') ids.sort((a, b) => entry(b).rating - entry(a).rating || byName(a, b));
  else ids.sort((a, b) => {
    const ya = entry(a).firstYear, yb = entry(b).firstYear;
    if (ya == null && yb == null) return byName(a, b);
    if (ya == null) return 1; if (yb == null) return -1;
    return (sort === 'asc' ? ya - yb : yb - ya) || byName(a, b);
  });
  const years = ids.map((id) => entry(id).firstYear).filter((y) => y != null);
  const { states, other } = counts();
  let summary = countries(states);
  if (other) summary += ` + ${other} ${plural(other, P_TERR)}`;
  if (years.length) summary += ` · ${Math.min(...years)}-${Math.max(...years)}`;
  $('listSummary').textContent = ids.length ? summary : '';
  if (!ids.length) {
    ol.innerHTML = `<li class="empty">${svgIcon('stamp', 40)}<b>Jeszcze nic tu nie ma</b><span>Kliknij kraj na globie i wbij stempel „Byłem tu”. Odwiedzone kraje ułożą się tutaj według roku pierwszej wizyty.</span></li>`;
    return;
  }
  let html = '', lastGroup;
  const groupKey = (id) => sort === 'fav' ? entry(id).rating : (entry(id).firstYear ?? 'none');
  for (const id of ids) {
    const c = entry(id);
    if (sort !== 'az') {
      const g = groupKey(id);
      if (g !== lastGroup) {
        const n = ids.filter((x) => groupKey(x) === g).length;
        const label = sort === 'fav' ? (g ? `<span class="hearts-label">${'♥'.repeat(g)}<i>${'♥'.repeat(5 - g)}</i></span>` : 'Bez oceny') : (g === 'none' ? 'Bez roku' : g);
        html += `<li class="year-head"><b>${label}</b><span>${countries(n)}</span></li>`;
        lastGroup = g;
      }
    }
    const others = c.visits.map((v) => v.year).filter((y) => y != null).sort((a, b) => a - b);
    const meta1 = c.notes.trim() ? c.notes.trim().split('\n')[0] : (c.visits.find((v) => v.note.trim()) || {}).note || (sort === 'az' || sort === 'fav' ? (c.firstYear ? `Pierwszy raz w ${c.firstYear}` : 'Bez roku') : '');
    const chips = (sort === 'az' || sort === 'fav') && c.firstYear ? [c.firstYear, ...others] : others;
    html += `<li><button type="button" class="entry" data-id="${esc(id)}" style="--stamp:${inkOfId(id)}">
      <span class="bar"></span>${flagHTML(id, 'eflag')}
      <span class="ename">${esc(countryName(id))}${id === homeId() ? ' <span class="home-tag">dom</span>' : ''}${meta1 ? `<span class="emeta">${esc(meta1)}</span>` : ''}</span>
      <span class="eyears">${c.rating && sort !== 'fav' ? `<span class="chip chip-heart">♥ ${c.rating}</span>` : ''}${chips.map((y) => `<span class="chip">${y}</span>`).join('')}</span>
    </button></li>`;
  }
  ol.innerHTML = html;
}
function renderPlacesList(ol) {
  const st = state.settings.placeSt || 'all', cat = state.settings.placeCat || '';
  setSegment($('plStSeg'), 'pst', st);
  const usedCats = CATS.filter((c) => state.places.some((p) => p.cat === c.id));
  $('plCatFilter').innerHTML = usedCats.length > 1 ? `<button type="button" class="chip-btn ${cat ? '' : 'on'}" data-pc="">Wszystkie kategorie</button>` + usedCats.map((c) => `<button type="button" class="chip-btn ${cat === c.id ? 'on' : ''}" data-pc="${c.id}">${c.name}</button>`).join('') : '';
  const list = state.places.filter((p) => (st === 'all' || p.status === st) && (!cat || p.cat === cat));
  const v = state.places.filter((p) => p.status === 'visited').length;
  $('listSummary').textContent = state.places.length ? `${state.places.length} ${plural(state.places.length, ['miejsce', 'miejsca', 'miejsc'])} · ${v} odwiedzonych · ${state.places.length - v} w planach` : '';
  if (!list.length) {
    ol.innerHTML = `<li class="empty">${catIcon('other', 40)}<b>${state.places.length ? 'Brak miejsc dla tego filtra' : 'Nie masz jeszcze miejsc'}</b><span>W Google Maps kliknij „Udostępnij” i wybierz AlvaTour, wyszukaj lokal przyciskiem „Dodaj miejsce” albo wczytaj plan od AI.</span></li>`;
    return;
  }
  const byCountry = new Map();
  for (const p of list) { const k = p.cc || '??'; if (!byCountry.has(k)) byCountry.set(k, []); byCountry.get(k).push(p); }
  const keys = [...byCountry.keys()].sort((a, b) => byCountry.get(b).length - byCountry.get(a).length || collator.compare(countryName(a), countryName(b)));
  ol.innerHTML = keys.map((k) => {
    const ps = byCountry.get(k).sort((a, b) => collator.compare(a.city, b.city) || collator.compare(a.name, b.name));
    return `<li class="year-head"><b class="cty">${flagSupport ? flagEmoji(k) + ' ' : ''}${esc(countryName(k))}</b><span>${ps.length} ${plural(ps.length, ['miejsce', 'miejsca', 'miejsc'])}</span></li>` +
      ps.map((p) => `<li><button type="button" class="entry place-entry ${p.status}" data-pid="${esc(p.id)}" style="--stamp:${catOf(p.cat).color}">
        <span class="bar"></span><span class="pr-ico big" style="--c:${catOf(p.cat).color}">${catIcon(p.cat, 20)}</span>
        <span class="ename">${esc(p.name)}<span class="emeta">${esc([p.city, catOf(p.cat).name, p.note].filter(Boolean).join(' · '))}</span></span>
        <span class="eyears">${p.status === 'planned' ? '<span class="chip chip-strong">w planach</span>' : (placeYear(p) ? `<span class="chip">${placeYear(p)}</span>` : '')}${p.rating ? `<span class="chip chip-heart">♥ ${p.rating}</span>` : ''}</span>
      </button></li>`).join('');
  }).join('');
}
$('plStSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-pst]'); if (!b) return; state.settings.placeSt = b.dataset.pst; saveNow(); renderList(); });
$('plCatFilter').addEventListener('click', (e) => { const b = e.target.closest('[data-pc]'); if (!b) return; state.settings.placeCat = b.dataset.pc; saveNow(); renderList(); });
$('listAddPlace').addEventListener('click', () => openPlaceAdd());
$('listAI').addEventListener('click', () => openAIImport());
$('timeline').addEventListener('click', (e) => {
  const pb = e.target.closest('.place-entry');
  if (pb) { showView('globe'); openPlace(pb.dataset.pid, { fly: true }); return; }
  const b = e.target.closest('.entry'); if (!b) return;
  showView('globe'); openCountry(b.dataset.id, { fly: true });
});
$('sortSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-sort]'); if (!b) return; state.settings.sort = b.dataset.sort; saveNow(); renderList(); });
$('listTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; state.settings.listTab = b.dataset.tab; saveNow(); renderList(); });

/* ================= Paszport ================= */
function renderPassport() {
  const ids = visitedIds().filter((id) => byId.has(id));
  ids.sort((a, b) => {
    const ya = entry(a).firstYear ?? 9999, yb = entry(b).firstYear ?? 9999;
    return ya - yb || collator.compare(countryName(a), countryName(b));
  });
  const n = stateCount();
  const r = rankFor(n);
  const home = homeId();
  const name = state.settings.name.trim() || 'Podróżnik';
  const issued = state.badges.first ? new Date(state.badges.first).toLocaleDateString('pl-PL') : new Date().toLocaleDateString('pl-PL');
  const mrz = (`P<${home ? (home + (home.length < 3 ? '<' : '')) : 'XXX'}${normalizeText(name).toUpperCase().replace(/[^A-Z]/g, '<')}<<ALVATOUR`).padEnd(44, '<').slice(0, 44);
  const mrz2 = (`${String(ids.length).padStart(3, '0')}STAMPS<<${String(Object.keys(state.badges).length).padStart(2, '0')}BADGES<<${r.cur.name.toUpperCase().replace(/[^A-Z]/g, '')}`).padEnd(44, '<').slice(0, 44);

  let pages = '';
  if (!ids.length) {
    pages = `<div class="pp-page pp-empty"><p>Tu pojawią się Twoje stemple.</p><p class="muted">Kliknij kraj na globie i wybierz „Byłem tu”.</p></div>`;
  } else {
    const groups = new Map();
    for (const id of ids) { const y = entry(id).firstYear ?? 'Bez roku'; if (!groups.has(y)) groups.set(y, []); groups.get(y).push(id); }
    let pageNo = 1;
    for (const [y, list] of groups) {
      pages += `<div class="pp-page"><div class="pp-page-head"><span>${esc(y)}</span><span>str. ${pageNo++}</span></div><div class="pp-stamps">${list.map((id) =>
        `<button type="button" class="pp-stamp" data-id="${esc(id)}" style="--rot:${stampRotation(id)}deg" aria-label="${esc(countryName(id))}">${stampSVG(id)}</button>`).join('')}</div></div>`;
    }
  }
  $('passport').innerHTML = `
    <div class="pp-wrap">
      <div class="pp-cover">
        <div class="pp-cover-top"><span>PASZPORT PODRÓŻNIKA</span><span>TRAVEL PASSPORT</span></div>
        <div class="pp-id">
          <div class="pp-photo">${svgIcon('globe', 54)}</div>
          <dl>
            <div><dt>Imię / Name</dt><dd>${esc(name)}</dd></div>
            <div><dt>Kraj domowy / Home</dt><dd>${home ? `${flagSupport ? flagEmoji(home) + ' ' : ''}${esc(countryName(home))}` : 'nie ustawiono'}</dd></div>
            <div><dt>Ranga / Rank</dt><dd>${esc(r.cur.name)}</dd></div>
            <div><dt>Stemple / Stamps</dt><dd>${ids.length}</dd></div>
            <div><dt>Wydano / Issued</dt><dd>${esc(issued)}</dd></div>
          </dl>
        </div>
        <div class="pp-mrz" aria-hidden="true"><span>${esc(mrz)}</span><span>${esc(mrz2)}</span></div>
      </div>
      ${pages}
    </div>`;
  $('passport').querySelectorAll('.pp-stamp').forEach((b) => b.addEventListener('click', () => { showView('globe'); openCountry(b.dataset.id, { fly: true }); }));
}

/* ================= Statystyki i odznaki ================= */
function renderStats() {
  const x = progressCtx();
  const n = x.sov.length;
  const r = rankFor(n);
  const totalArea = Object.values(META).reduce((s, m) => s + (m.ar || 0), 0);
  const visArea = x.v.reduce((s, id) => s + (meta(id).ar || 0), 0);
  const areaPct = totalArea ? (visArea / totalArea) * 100 : 0;
  const contVisited = CONT_ORDER.filter((c) => x.byCont[c]).length;
  const visitsTotal = x.v.reduce((s, id) => s + 1 + entry(id).visits.length, 0);
  let farId = null, farKm = 0;
  if (x.home) for (const id of x.v) { const d = distanceKm(x.home, id); if (d > farKm) { farKm = d; farId = id; } }
  let bestYear = null;
  for (const [y, c] of Object.entries(x.perYear)) if (!bestYear || c > bestYear[1]) bestYear = [y, c];
  const fav = x.v.filter((id) => entry(id).rating === 5);

  // kontynenty
  const contTotals = {};
  for (const id of SOVEREIGN) { const c = meta(id).c; if (c) contTotals[c] = (contTotals[c] || 0) + 1; }
  const contSov = {};
  for (const id of x.sov) { const c = meta(id).c; if (c) contSov[c] = (contSov[c] || 0) + 1; }

  const tiles = [
    ['Krajów', `${n}<small>/${SOVEREIGN_TOTAL}</small>`, `${Math.round((n / SOVEREIGN_TOTAL) * 100)}% państw świata`],
    ['Powierzchnia', `${fmt1.format(areaPct)}<small>%</small>`, `${fmtInt.format(Math.round(visArea / 1000) * 1000)} km² lądów`],
    ['Kontynenty', `${contVisited}<small>/7</small>`, contVisited ? CONT_ORDER.filter((c) => x.byCont[c]).map((c) => CONT_SHORT[c]).join(', ') : 'jeszcze żadnego'],
    ['Miejsca', `${state.places.filter((p) => p.status === 'visited').length}`, `odwiedzonych · ${state.places.filter((p) => p.status === 'planned').length} w planach · ${visitsTotal} wizyt w krajach`],
    ['Najdalej od domu', farId ? `${fmtInt.format(Math.round(farKm / 100) * 100)}<small> km</small>` : '-', farId ? esc(countryName(farId)) : (x.home ? 'brak danych' : 'ustaw kraj domowy')],
    ['Rekordowy rok', bestYear ? `${bestYear[0]}` : '-', bestYear ? `${countries(bestYear[1])} po raz pierwszy` : 'wpisz lata wizyt'],
    ['Lista marzeń', `${x.wish.length}`, x.wish.length ? 'krajów czeka na Ciebie' : 'dodaj pierwszy cel'],
    ['Ulubione', `${fav.length}`, fav.length ? fav.slice(0, 3).map(countryName).join(', ') : 'daj komuś 5 serc'],
  ];

  const unlocked = BADGES.filter((b) => state.badges[b.id]).length;

  $('statsBody').innerHTML = `
    <div class="stats-wrap">
      <section class="rank-card">
        <div class="rank-medal">${svgIcon(r.idx >= 8 ? 'crown' : r.idx >= 4 ? 'compass' : 'stamp', 34)}<span>${r.idx + 1}</span></div>
        <div class="rank-text">
          <span class="eyebrow">Twoja ranga</span>
          <h2 id="statsTitle">${esc(r.cur.name)}</h2>
          <p>${esc(r.cur.line)}</p>
          <div class="rank-bar"><span style="width:${Math.round(r.pct * 100)}%"></span></div>
          <p class="rank-next">${r.next ? `Jeszcze ${countries(r.toNext)} do rangi <b>${esc(r.next.name)}</b>` : 'Najwyższa ranga. Mapa należy do Ciebie.'}</p>
        </div>
      </section>

      <section class="tiles">${tiles.map(([k, v, s]) => `<div class="tile"><span class="tile-k">${k}</span><span class="tile-v">${v}</span><span class="tile-s">${s}</span></div>`).join('')}</section>

      <section class="card">
        <h3>Kontynenty</h3>
        <div class="conts">${CONT_ORDER.filter((c) => c !== 'AN').map((c) => {
          const v = contSov[c] || 0, t = contTotals[c] || 1;
          return `<div class="cont"><span class="cont-name">${CONTINENTS[c]}</span><span class="cont-bar"><span style="width:${Math.max(v ? 3 : 0, (v / t) * 100)}%"></span></span><span class="cont-num">${v}/${t}</span></div>`;
        }).join('')}
        <div class="cont"><span class="cont-name">Antarktyda</span><span class="cont-bar"><span style="width:${x.vs.has('AQ') ? 100 : 0}%"></span></span><span class="cont-num">${x.vs.has('AQ') ? 'tak' : 'nie'}</span></div>
        </div>
      </section>

      <section class="card">
        <h3>Nowe kraje w kolejnych latach</h3>
        ${yearChart(x)}
      </section>

      <section class="card">
        <div class="card-head"><h3>Odznaki</h3><span class="muted">${unlocked}/${BADGES.length} zdobytych</span></div>
        <div class="badges">${BADGES.map((b) => {
          const [cur, need] = b.t(x);
          const got = !!state.badges[b.id];
          const pct = Math.min(1, cur / need);
          return `<div class="badge ${got ? 'got' : ''}" style="--p:${pct}" title="${esc(b.desc)}">
            <span class="badge-medal">${svgIcon(b.icon, 26)}</span>
            <b>${esc(b.name)}</b>
            <span class="badge-desc">${esc(b.desc)}</span>
            <span class="badge-prog">${got ? 'Zdobyta' : `${fmtInt.format(cur)}/${fmtInt.format(need)}${b.unit ? ' ' + b.unit : ''}`}</span>
          </div>`;
        }).join('')}</div>
      </section>
    </div>`;
  bindChart();
}

function yearChart(x) {
  const ys = Object.keys(x.perYear).map(Number);
  if (!ys.length) return '<p class="muted">Wpisz rok pierwszej wizyty w odwiedzonych krajach, a tu pojawi się wykres Twoich podróży.</p>';
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const years = []; for (let y = y0; y <= y1; y++) years.push(y);
  const max = Math.max(...Object.values(x.perYear));
  const Wc = 640, Hc = 180, padL = 28, padB = 24, padT = 12;
  const bw = (Wc - padL) / years.length;
  const bar = Math.max(2, Math.min(28, bw - 2));
  const sy = (v) => Hc - padB - (v / max) * (Hc - padB - padT);
  const ticks = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, Math.round(max / 2), max];
  const labelEvery = Math.ceil(years.length / 10);
  let svg = `<svg class="chart" viewBox="0 0 ${Wc} ${Hc}" role="img" aria-label="Liczba nowych krajów w kolejnych latach">`;
  for (const t of ticks) svg += `<line x1="${padL}" x2="${Wc}" y1="${sy(t)}" y2="${sy(t)}" class="grid"/><text x="${padL - 6}" y="${sy(t) + 4}" class="axis" text-anchor="end">${t}</text>`;
  years.forEach((y, i) => {
    const v = x.perYear[y] || 0;
    const cx = padL + i * bw + bw / 2;
    if (v) {
      const top = sy(v), h = Hc - padB - top;
      const rr = Math.min(4, bar / 2, h);
      svg += `<path class="bar" d="M${cx - bar / 2},${Hc - padB} V${top + rr} Q${cx - bar / 2},${top} ${cx - bar / 2 + rr},${top} H${cx + bar / 2 - rr} Q${cx + bar / 2},${top} ${cx + bar / 2},${top + rr} V${Hc - padB} Z"/>`;
    }
    svg += `<rect class="hit" x="${padL + i * bw}" y="${padT}" width="${bw}" height="${Hc - padT - padB}" data-y="${y}" data-v="${v}"/>`;
    if (i % labelEvery === 0 || i === years.length - 1) svg += `<text x="${cx}" y="${Hc - 6}" class="axis" text-anchor="middle">${String(y)}</text>`;
  });
  svg += `<line x1="${padL}" x2="${Wc}" y1="${Hc - padB}" y2="${Hc - padB}" class="baseline"/></svg>`;
  return `<div class="chart-wrap">${svg}<div class="chart-tip" id="chartTip" hidden></div></div>`;
}
function bindChart() {
  const wrap = document.querySelector('#statsBody .chart-wrap'); if (!wrap) return;
  const tip = $('chartTip');
  wrap.querySelectorAll('.hit').forEach((h) => {
    const show = () => {
      const y = Number(h.dataset.y);
      const names = visitedIds().filter((id) => entry(id).firstYear === y).map(countryName);
      tip.innerHTML = `<b>${y}</b> · ${countries(Number(h.dataset.v))}${names.length ? `<br><span>${esc(names.slice(0, 6).join(', '))}${names.length > 6 ? '…' : ''}</span>` : ''}`;
      const r = h.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
      tip.style.left = clamp(r.left - wr.left + r.width / 2, 60, wr.width - 60) + 'px';
      tip.hidden = false;
      wrap.querySelectorAll('.hit').forEach((o) => o.classList.toggle('on', o === h));
    };
    h.addEventListener('pointerenter', show);
    h.addEventListener('click', show);
  });
  wrap.addEventListener('pointerleave', () => { tip.hidden = true; wrap.querySelectorAll('.hit.on').forEach((o) => o.classList.remove('on')); });
}

/* ================= Ustawienia ================= */
const menuMsg = (t) => { $('menuMsg').textContent = t; };
function fillHomeSelect(sel, value) {
  const opts = features.filter((f) => SOVEREIGN.has(f.id) || PARTIAL.has(f.id)).map((f) => f.id).sort((a, b) => collator.compare(countryName(a), countryName(b)));
  sel.innerHTML = '<option value="">(brak)</option>' + opts.map((id) => `<option value="${id}" ${id === value ? 'selected' : ''}>${esc(countryName(id))}</option>`).join('');
}
function openMenu() {
  $('setName').value = state.settings.name;
  fillHomeSelect($('setHome'), state.settings.home);
  setSegment($('view-menu'), 'colors', state.settings.colors);
  $('setLines').checked = state.settings.lines;
  $('setSpin').checked = state.settings.spin;
  $('setSound').checked = state.settings.sound;
  menuMsg(''); $('wipeConfirm').hidden = true; $('pasteBox').hidden = true;
  renderBackupStatus();
}
$('setName').addEventListener('input', (e) => { state.settings.name = e.target.value; saveSoon(); });
$('setHome').addEventListener('change', (e) => { state.settings.home = e.target.value; saveNow(); afterDataChange(); });
$('setLines').addEventListener('change', (e) => { state.settings.lines = e.target.checked; $('btnLines').setAttribute('aria-pressed', String(e.target.checked)); saveNow(); requestRender(); });
$('setSpin').addEventListener('change', (e) => { state.settings.spin = e.target.checked; saveNow(); });
$('setSound').addEventListener('change', (e) => { state.settings.sound = e.target.checked; saveNow(); if (e.target.checked) sfx.pop(); });
$('view-menu').querySelector('[data-colors]').parentElement.addEventListener('click', (e) => {
  const b = e.target.closest('[data-colors]'); if (!b) return;
  state.settings.colors = b.dataset.colors; saveNow();
  setSegment($('view-menu'), 'colors', state.settings.colors);
  requestRender();
});

/* ---------- Kopie zapasowe, eksport, import ---------- */
const fmtWhen = (iso) => {
  if (!iso) return 'jeszcze nie było';
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const fmtDay = (d) => (d ? `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}` : '');
async function renderBackupStatus() {
  $('backupFolder').textContent = AlvaData.folderLabel;
  try {
    const st = await AlvaData.status();
    $('backupStatus').innerHTML = `<dt>Ostatnia kopia w telefonie</dt><dd>${esc(fmtWhen(st.lastBackupAt))}</dd>
      <dt>Ostatni eksport (poza telefon)</dt><dd>${esc(fmtWhen(st.lastExportAt))}</dd>`;
    $('btnUndoImport').hidden = !st.lastImport;
  } catch (e) { $('backupStatus').innerHTML = ''; }
}
async function exportAll(fromMenu = true) {
  const msg = fromMenu ? menuMsg : (t) => toast(esc(t));
  msg('Przygotowuję kopię…');
  try {
    const r = await AlvaData.exportAndShare();
    msg(r.shared ? `Gotowe: ${r.name}.${r.saved ? ` Kopia jest też w ${AlvaData.folderLabel}.` : ''}` : `Anulowano udostępnianie.${r.saved ? ` Plik ${r.saved} zapisałem w ${AlvaData.folderLabel}.` : ''}`);
  } catch (e) { console.error(e); msg('Nie udało się wyeksportować danych. Spróbuj „Kopiuj do schowka”.'); }
  if (fromMenu) renderBackupStatus();
}
$('btnExport').addEventListener('click', () => exportAll(true));
$('btnCopy').addEventListener('click', async () => {
  const { text: txt } = await AlvaData.exportAll();
  const fallback = () => { $('pasteBox').hidden = false; $('pasteArea').value = txt; $('pasteArea').select(); menuMsg('Zaznaczyłem dane w polu poniżej, skopiuj je ręcznie.'); };
  AlvaNative.copy(txt).then(() => menuMsg('Skopiowano dane do schowka.'), fallback);
});

/** Po wczytaniu nowych danych: odśwież cały widok. */
function applyLoadedState(next) {
  state = next;
  state.settings.onboarded = true;
  saveNow(); checkProgress(true); afterDataChange();
  if (selectedId) renderSheet();
}

/** Podgląd kopii i potwierdzenie przed wczytaniem. */
async function confirmImport(text, { source = 'plik', after } = {}) {
  const prev = await AlvaData.previewImport(text);
  if (!prev.ok) { openModal(`<div class="dlg"><h2>Nie mogę wczytać kopii</h2><p>${esc(prev.error)}</p><div class="btn-row"><button type="button" class="btn" data-x>OK</button></div></div>`, (card) => card.querySelector('[data-x]').addEventListener('click', () => { closeModal(); if (!state.settings.onboarded) showOnboarding(); })); return false; }
  const when = prev.info.exportedAt ? fmtWhen(prev.info.exportedAt) : 'nieznana data';
  const kindLabel = prev.info.kind === 'web' ? 'eksport z wersji webowej' : prev.info.kind === 'raw' ? 'dane z przeglądarki' : 'kopia AlvaTour';
  return new Promise((resolve) => {
    openModal(`<div class="dlg">
      <h2>Wczytać tę kopię?</h2>
      <p class="dlg-big">${esc(prev.text)}</p>
      <p class="muted">${esc(kindLabel)} z ${esc(when)}${prev.info.appVersion ? `, wersja ${esc(prev.info.appVersion)}` : ''} (${esc(source)}).</p>
      <p>Obecne dane zostaną zastąpione. Najpierw zrobię ich kopię, a wczytanie będzie można cofnąć.</p>
      <div class="btn-row"><button type="button" class="btn" data-ok>Wczytaj</button><button type="button" class="btn btn-soft" data-x>Anuluj</button></div>
    </div>`, (card) => {
      card.querySelector('[data-x]').addEventListener('click', () => { closeModal(); if (!state.settings.onboarded) showOnboarding(); resolve(false); });
      card.querySelector('[data-ok]').addEventListener('click', async (e) => {
        e.target.disabled = true; e.target.textContent = 'Wczytuję…';
        try {
          applyLoadedState(await AlvaData.applyImport(prev));
          closeModal();
          toast(`<span><b>Wczytano kopię.</b><br>${esc(prev.text)}</span>`, { ttl: 4000 });
          if (after) after();
          resolve(true);
        } catch (err) {
          console.error(err);
          card.querySelector('.dlg').insertAdjacentHTML('beforeend', `<p class="field-error">Nie udało się wczytać: ${esc(err.message || err)}. Twoje dane są nietknięte.</p>`);
          e.target.disabled = false; e.target.textContent = 'Wczytaj';
          resolve(false);
        }
      });
    });
  });
}
$('importFile').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = () => confirmImport(String(r.result), { source: file.name, after: () => { if (activeView === 'menu') { openMenu(); menuMsg('Kopia wczytana.'); } } });
  r.readAsText(file);
  e.target.value = '';
});
$('btnPasteToggle').addEventListener('click', () => { $('pasteBox').hidden = !$('pasteBox').hidden; $('pasteArea').value = ''; });
$('btnPasteImport').addEventListener('click', () => confirmImport($('pasteArea').value, { source: 'wklejone dane' }));
$('btnUndoImport').addEventListener('click', () => {
  openModal(`<div class="dlg"><h2>Cofnąć ostatnie wczytanie?</h2><p>Przywrócę dane sprzed ostatniego wczytania kopii. Obecne dane najpierw zapiszę w kopii.</p>
    <div class="btn-row"><button type="button" class="btn" data-ok>Cofnij</button><button type="button" class="btn btn-soft" data-x>Anuluj</button></div></div>`, (card) => {
    card.querySelector('[data-x]').addEventListener('click', closeModal);
    card.querySelector('[data-ok]').addEventListener('click', async () => {
      try { applyLoadedState(await AlvaData.undoImport()); closeModal(); openMenu(); menuMsg('Przywrócono dane sprzed wczytania.'); } catch (e) { closeModal(); menuMsg('Nie udało się cofnąć: ' + (e.message || e)); }
    });
  });
});

/** Lista kopii w telefonie z możliwością przywrócenia. */
async function openBackupsList() {
  const list = (await AlvaData.listBackups()).filter((b) => b.kind);
  const rows = list.map((b, i) => `<li><button type="button" class="backup-row" data-i="${i}">
      <span><b>${esc(fmtWhen(b.date && b.date.toISOString()))}</b><br><span class="muted small">${esc(AlvaData.KINDS[b.kind].label)}</span></span>
      <span class="backup-go">Podgląd</span></button></li>`).join('');
  openModal(`<div class="dlg">
    <div class="share-head"><h2>Kopie w telefonie</h2><button type="button" class="btn-ghost icon-only" data-x aria-label="Zamknij"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>
    <p class="muted small">Folder: ${esc(AlvaData.folderLabel)}. Kopie sprzed ponownej instalacji aplikacji wczytasz przez „Wczytaj kopię z pliku”.</p>
    ${list.length ? `<ul class="backup-list">${rows}</ul>` : '<p>Nie ma jeszcze żadnej kopii. Pierwsza powstanie automatycznie, gdy oznaczysz kraj.</p>'}
  </div>`, (card) => {
    card.querySelector('[data-x]').addEventListener('click', closeModal);
    card.querySelectorAll('[data-i]').forEach((btn) => btn.addEventListener('click', async () => {
      const b = list[Number(btn.dataset.i)];
      let text;
      try { text = await AlvaData.readBackupText(b.name); } catch (e) { toast('Nie udało się odczytać kopii.'); return; }
      closeModal();
      confirmImport(text, { source: b.name, after: () => { if (activeView === 'menu') openMenu(); } });
    }));
  });
}
$('btnBackups').addEventListener('click', () => openBackupsList().catch((e) => menuMsg('Nie udało się odczytać listy kopii: ' + (e.message || e))));

$('btnWipe').addEventListener('click', () => { $('wipeConfirm').hidden = false; });
$('btnWipeNo').addEventListener('click', () => { $('wipeConfirm').hidden = true; });
$('btnWipeYes').addEventListener('click', async () => {
  try { await AlvaData.beforeWipe(); } catch (e) { menuMsg('Nie udało się zrobić kopii, więc niczego nie usunąłem.'); return; }
  state.countries = {}; state.badges = {}; saveNow(); lastRankIdx = 0; afterDataChange();
  $('wipeConfirm').hidden = true; menuMsg('Usunięto oznaczenia i odznaki. Kopia sprzed usunięcia jest w „Kopie w telefonie”.');
  renderBackupStatus();
});

/** Komunikaty z warstwy danych przy starcie. Zwraca true, jeśli pokazała okno (wtedy bez powitania). */
function handleDataNotices(notices) {
  let modal = false;
  for (const n of notices || []) {
    if (n.type === 'read-only') {
      const why = n.reason === 'newer'
        ? 'Dane pochodzą z nowszej wersji AlvaTour niż ta zainstalowana.'
        : `Aktualizacja formatu danych (v${n.from} → v${n.to}) nie powiodła się i została wycofana.${n.backup ? ` Kopia sprzed aktualizacji: ${n.backup}.` : ''}`;
      openModal(`<div class="dlg"><h2>Tryb bezpieczny</h2><p>${esc(why)}</p>
        <p><b>Twoje dane są nietknięte.</b> Możesz je przeglądać, ale zmiany nie będą zapisywane, dopóki tego nie naprawimy.</p>
        <p class="muted small">Nie odinstalowuj aplikacji i nie czyść jej danych. Zrób zrzut ekranu tego komunikatu i wyślij go do dewelopera.</p>
        <div class="btn-row"><button type="button" class="btn" data-x>Rozumiem</button></div></div>`, (card) => card.querySelector('[data-x]').addEventListener('click', closeModal));
      state.settings.onboarded = true;
      return true;
    }
    if (n.type === 'offer-restore') {
      modal = true;
      openModal(`<div class="dlg"><h2>Znalazłem Twoją kopię</h2>
        <p>Aplikacja nie ma żadnych danych, a w telefonie jest kopia z ${esc(fmtWhen(n.info.exportedAt))}:</p>
        <p class="dlg-big">${esc(n.text)}</p>
        <div class="btn-row"><button type="button" class="btn" data-ok>Przywróć tę kopię</button><button type="button" class="btn btn-soft" data-no>Zacznij od zera</button></div></div>`, (card) => {
        card.querySelector('[data-ok]').addEventListener('click', async () => {
          const r = await AlvaData.readBackup(n.name);
          if (r.ok) { applyLoadedState(await AlvaData.applyImport(r)); closeModal(); toast(`<span><b>Przywrócono dane.</b><br>${esc(r.text)}</span>`, { ttl: 4000 }); }
          else { closeModal(); toast(esc(r.error)); showOnboarding(); }
        });
        card.querySelector('[data-no]').addEventListener('click', () => { AlvaData.declineRestore(); closeModal(); if (!state.settings.onboarded) showOnboarding(); });
      });
    }
    if (n.type === 'legacy-imported') toast(`<span><b>Przeniosłem Twoje dane do nowego magazynu.</b><br>${esc(n.text)}</span>`, { ttl: 5000 });
    if (n.type === 'migrated') console.info(`AlvaTour: dane zaktualizowane v${n.from} -> v${n.to}, kopia ${n.backup}`);
    if (n.type === 'export-reminder' && !modal) {
      AlvaData.reminderShown();
      setTimeout(() => {
        toast(`<span><b>Czas na kopię poza telefonem</b><br>${n.lastExport ? 'Ostatni eksport: ' + esc(fmtWhen(n.lastExport)) : 'Nie było jeszcze eksportu'}. <button type="button" class="link" data-export-now>Eksportuj teraz</button></span>`, { ttl: 9000 });
      }, 1500);
    }
  }
  return modal;
}
document.addEventListener('click', (e) => { if (e.target.closest('[data-export-now]')) exportAll(false); });

$('appVersion').textContent = APP_VERSION;

/* ---------- Sprawdzanie aktualizacji (GitHub Releases) ---------- */
$('btnUpdate').addEventListener('click', async () => {
  const btn = $('btnUpdate');
  btn.disabled = true; btn.textContent = 'Sprawdzam…';
  try {
    const { update, current } = await AlvaNative.checkUpdate();
    if (!update) { menuMsg(`Masz najnowszą wersję (${current}).`); return; }
    const notes = update.notes.split('\n').filter((l) => /^\s*[-*] /.test(l)).slice(0, 8).map((l) => `<li>${esc(l.replace(/^\s*[-*] /, '').replace(/\*\*/g, ''))}</li>`).join('');
    openModal(`<div class="dlg"><h2>Jest nowa wersja ${esc(update.version)}</h2>
      <p class="muted">Masz ${esc(current)}${update.prerelease ? '. To wersja testowa.' : '.'}</p>
      ${notes ? `<ul class="upd-notes">${notes}</ul>` : ''}
      <p>Kliknij „Pobierz”, a po pobraniu otwórz plik i wybierz <b>Aktualizuj</b>. Twoje dane zostaną (i tak zrobię kopię przed aktualizacją danych).</p>
      <div class="btn-row"><button type="button" class="btn" data-ok>Pobierz</button><button type="button" class="btn btn-soft" data-x>Później</button></div></div>`, (card) => {
      card.querySelector('[data-x]').addEventListener('click', closeModal);
      card.querySelector('[data-ok]').addEventListener('click', async () => { await AlvaData.backupNow().catch(() => {}); AlvaNative.openUrl(update.url); closeModal(); });
    });
  } catch (e) {
    console.error(e); menuMsg('Nie udało się sprawdzić aktualizacji. Sprawdź internet.');
  } finally { btn.disabled = false; btn.textContent = 'Sprawdź aktualizację'; }
});

/* ================= Wyszukiwarka ================= */
const searchInput = $('search'), results = $('searchResults');
let resultIds = [], activeIdx = -1;
function renderResults() {
  const q = normalizeText(searchInput.value.trim());
  if (!q) { results.hidden = true; resultIds = []; return; }
  const scored = [];
  for (const f of features) {
    if (f.properties.x) continue;
    const nn = f.norm, en = f.normEn, cap = normalizeText(meta(f.id).cap);
    let s = -1;
    if (nn.startsWith(q) || f.alias.split(' ').some((w) => w && w.startsWith(q))) s = 0; else if (nn.split(/[\s-]/).some((w) => w.startsWith(q))) s = 1;
    else if (nn.includes(q)) s = 2; else if (en.includes(q)) s = 3; else if (cap && cap.startsWith(q)) s = 4;
    if (s >= 0) scored.push([s, f]);
  }
  scored.sort((a, b) => a[0] - b[0] || collator.compare(a[1].properties.n, b[1].properties.n));
  const best = scored.slice(0, 8).map((x) => x[1]);
  resultIds = best.map((f) => f.id); activeIdx = best.length ? 0 : -1;
  results.innerHTML = best.length ? best.map((f, i) => {
    const c = entry(f.id);
    const tag = c && c.visited ? (c.firstYear ? 'byłem ' + c.firstYear : 'byłem') : c && c.wish ? 'marzenie' : (normalizeText(meta(f.id).cap).startsWith(q) && !f.norm.includes(q) ? 'stolica: ' + esc(meta(f.id).cap) : '');
    return `<li><button type="button" data-id="${esc(f.id)}" class="${i === 0 ? 'active' : ''}">
      ${flagHTML(f.id, 'sflag')}<span>${esc(f.properties.n)}</span>
      ${tag ? `<span class="tag">${tag}</span>` : ''}${c ? `<span class="dot ${c.wish ? 'dot-wish' : ''}" style="--stamp:${inkOfId(f.id)}"></span>` : ''}
    </button></li>`;
  }).join('') : '<li class="muted" style="padding:8px 10px">Brak wyników</li>';
  results.hidden = false;
}
function pickResult(id) {
  searchInput.value = ''; results.hidden = true; searchInput.blur();
  showView('globe'); openCountry(id, { fly: true });
}
searchInput.addEventListener('input', renderResults);
searchInput.addEventListener('focus', renderResults);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!resultIds.length) return;
    e.preventDefault();
    activeIdx = (activeIdx + (e.key === 'ArrowDown' ? 1 : -1) + resultIds.length) % resultIds.length;
    results.querySelectorAll('button').forEach((b, i) => b.classList.toggle('active', i === activeIdx));
  } else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); pickResult(resultIds[activeIdx]); }
  else if (e.key === 'Escape') { searchInput.value = ''; results.hidden = true; searchInput.blur(); }
});
results.addEventListener('pointerdown', (e) => e.preventDefault());
results.addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) pickResult(b.dataset.id); });
searchInput.addEventListener('blur', () => setTimeout(() => { results.hidden = true; }, 120));

/* ================= Modal ================= */
function openModal(html, onBind) {
  $('modalCard').innerHTML = html;
  $('modal').hidden = false;
  if (onBind) onBind($('modalCard'));
}
function closeModal() { $('modal').hidden = true; $('modalCard').innerHTML = ''; }
$('modal').addEventListener('click', (e) => { if (e.target === $('modal') && state.settings.onboarded) closeModal(); });

/* ================= Powitanie ================= */
function showOnboarding() {
  openModal(`
    <div class="onb">
      <div class="onb-art">${stampSVG(state.settings.home || 'PL', { year: THIS_YEAR, color: C.inks[0] })}</div>
      <h2>Witaj w Alva<b>Tour</b></h2>
      <p>Twoja mapa świata do zapełniania stemplami. Oznaczaj kraje, zbieraj odznaki, awansuj od Domatora do Ambasadora świata.</p>
      <div class="field"><label for="onbName">Jak masz na imię?</label><input id="onbName" type="text" maxlength="40" placeholder="Imię do paszportu"></div>
      <div class="field"><label for="onbHome">Skąd startujesz?</label><select id="onbHome"></select></div>
      <label class="switch"><input type="checkbox" id="onbMark" checked><span>Wbij od razu stempel mojego kraju</span></label>
      <button type="button" class="btn btn-big" id="onbGo">Ruszamy w drogę</button>
      <button type="button" class="link onb-restore" id="onbRestore">Mam kopię zapasową, wczytaj ją</button>
    </div>`, (card) => {
    card.querySelector('#onbRestore').addEventListener('click', () => $('importFile').click());
    fillHomeSelect(card.querySelector('#onbHome'), state.settings.home || 'PL');
    card.querySelector('#onbGo').addEventListener('click', () => {
      state.settings.name = card.querySelector('#onbName').value.trim();
      state.settings.home = card.querySelector('#onbHome').value;
      state.settings.onboarded = true;
      const mark = card.querySelector('#onbMark').checked && state.settings.home;
      saveNow(); closeModal();
      const home = homeId();
      if (home) flyToCountry(byId.get(home), { fill: 0.35, duration: 1400 }).then(() => {
        if (mark && !isVisited(home)) {
          state.countries[home] = { visited: true, wish: false, firstYear: null, visits: [], notes: '', rating: 0, plannedDate: '', addedAt: new Date().toISOString() };
          saveNow(); stampPop(home); afterDataChange();
        }
      });
      if (!state.settings.hintSeen) $('hint').hidden = false;
    });
  });
}

/* ================= Podpowiedź ================= */
function hideHint() {
  if ($('hint').hidden) return;
  $('hint').hidden = true;
  state.settings.hintSeen = true; saveNow();
}
$('hintClose').addEventListener('click', hideHint);
$('sheetClose').addEventListener('click', closeSheet);
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('modal').hidden && state.settings.onboarded) closeModal();
  else if (globeMode !== 'normal') endGame();
  else if (activeView !== 'globe') showView('globe');
  else closeSheet();
});
(() => {
  let y0 = null;
  [$('sheetGrip'), sheet.querySelector('.sheet-head')].forEach((el) => {
    el.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchend', (e) => { if (y0 != null && e.changedTouches[0].clientY - y0 > 60) closeSheet(); y0 = null; });
  });
})();
