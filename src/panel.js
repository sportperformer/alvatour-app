/* AlvaTour: panel kraju, stemple, ściąga z ciekawostkami. */
'use strict';

const sheet = $('sheet');
const sheetBody = $('sheetBody');

const GREET = {
  pl: 'Cześć', en: 'Hello', de: 'Hallo', fr: 'Bonjour', es: 'Hola', it: 'Ciao', pt: 'Olá', nl: 'Hallo', sv: 'Hej', no: 'Hei', nb: 'Hei', da: 'Hej',
  fi: 'Hei', is: 'Halló', et: 'Tere', lv: 'Sveiki', lt: 'Labas', cs: 'Ahoj', sk: 'Ahoj', hu: 'Szia', ro: 'Salut', bg: 'Здравей', sr: 'Здраво',
  hr: 'Bok', sl: 'Živjo', bs: 'Zdravo', mk: 'Здраво', sq: 'Përshëndetje', el: 'Γειά σου', tr: 'Merhaba', ru: 'Привет', uk: 'Привіт',
  be: 'Прывітанне', ka: 'გამარჯობა', hy: 'Բարեւ', az: 'Salam', kk: 'Сәлем', ar: 'مرحبا', he: 'שלום', fa: 'سلام', hi: 'नमस्ते', ur: 'سلام',
  bn: 'নমস্কার', zh: '你好', ja: 'こんにちは', ko: '안녕하세요', th: 'สวัสดี', vi: 'Xin chào', id: 'Halo', ms: 'Helo', tl: 'Kumusta', fil: 'Kumusta',
  sw: 'Jambo', am: 'ሰላም', mt: 'Bongu', ga: 'Dia duit', cy: 'Helo', lb: 'Moien', ne: 'नमस्ते', si: 'ආයුබෝවන්', ta: 'வணக்கம்', mn: 'Сайн байна уу',
  km: 'សួស្តី', lo: 'ສະບາຍດີ', my: 'မင်္ဂလာပါ', uz: 'Salom', tg: 'Салом', ky: 'Салам', tk: 'Salam', ps: 'سلام', so: 'Salaan', zu: 'Sawubona',
  af: 'Hallo', xh: 'Molo', mg: 'Manao ahoana', ht: 'Bonjou', qu: 'Napaykullayki', gn: "Mba'éichapa", sm: 'Talofa', to: 'Mālō e lelei',
  fj: 'Bula', mi: 'Kia ora', dv: 'Assalaam alaikum', dz: 'Kuzu zangpo', rw: 'Muraho', ca: 'Hola', eu: 'Kaixo', gl: 'Ola', rm: 'Allegra',
  ha: 'Sannu', yo: 'Báwo', ig: 'Ndewo', ti: 'ሰላም', ny: 'Moni', sn: 'Mhoro', st: 'Lumela', tn: 'Dumela', ln: 'Mbote', wo: 'Salaam aleekum',
};
const langNames = (() => { try { return new Intl.DisplayNames(['pl'], { type: 'language' }); } catch (e) { return null; } })();
const curNames = (() => { try { return new Intl.DisplayNames(['pl'], { type: 'currency' }); } catch (e) { return null; } })();
const langName = (c) => { try { const n = langNames && langNames.of(c); return n && n !== c ? n : null; } catch (e) { return null; } };
const curName = (c) => { try { return (curNames && curNames.of(c)) || c; } catch (e) { return c; } };

/* ---------- Generator stempla (SVG) ---------- */
let stampSeq = 0;
function stampSVG(id, opts = {}) {
  const f = byId.get(id);
  const name = (f ? f.properties.n : id).toUpperCase();
  const e = entry(id) || {};
  const year = opts.year !== undefined ? opts.year : e.firstYear;
  const ink = opts.color || inkOfId(id);
  const h = hashStr(id);
  const shape = h % 4;
  const uid = 'st' + (++stampSeq);
  const fs = name.length > 18 ? 9 : name.length > 12 ? 11 : name.length > 8 ? 13 : 15;
  const sub = year ? String(year) : 'WJAZD';
  const code = esc(id);
  let body = '';
  if (shape === 0) {
    body = `<circle cx="80" cy="80" r="70" fill="none" stroke="${ink}" stroke-width="4"/>
      <circle cx="80" cy="80" r="62" fill="none" stroke="${ink}" stroke-width="1.5"/>
      <circle cx="80" cy="80" r="40" fill="none" stroke="${ink}" stroke-width="1.5"/>
      <path id="${uid}" d="M 28 80 A 52 52 0 0 1 132 80" fill="none"/>
      <text font-size="${Math.min(fs, 13)}" font-weight="700" letter-spacing="1.5" fill="${ink}" text-anchor="middle"><textPath href="#${uid}" startOffset="50%">${esc(name)}</textPath></text>
      <text x="80" y="88" font-size="22" font-weight="800" fill="${ink}" text-anchor="middle">${esc(sub)}</text>
      <text x="80" y="128" font-size="10" font-weight="700" letter-spacing="3" fill="${ink}" text-anchor="middle">★ ${code} ★</text>`;
  } else if (shape === 1) {
    body = `<rect x="10" y="30" width="140" height="100" rx="8" fill="none" stroke="${ink}" stroke-width="4"/>
      <rect x="17" y="37" width="126" height="86" rx="4" fill="none" stroke="${ink}" stroke-width="1.5"/>
      <text x="80" y="56" font-size="9" font-weight="700" letter-spacing="3" fill="${ink}" text-anchor="middle">WJAZD · ARRIVAL</text>
      <text x="80" y="82" font-size="${fs}" font-weight="800" fill="${ink}" text-anchor="middle">${esc(name)}</text>
      <line x1="30" y1="92" x2="130" y2="92" stroke="${ink}" stroke-width="1.2"/>
      <text x="80" y="112" font-size="16" font-weight="700" fill="${ink}" text-anchor="middle">${esc(sub)} · ${code}</text>`;
  } else if (shape === 2) {
    body = `<ellipse cx="80" cy="80" rx="74" ry="52" fill="none" stroke="${ink}" stroke-width="4"/>
      <ellipse cx="80" cy="80" rx="66" ry="45" fill="none" stroke="${ink}" stroke-width="1.5" stroke-dasharray="3 3"/>
      <text x="80" y="64" font-size="10" font-weight="700" letter-spacing="3" fill="${ink}" text-anchor="middle">${code} · IMMIGRATION</text>
      <text x="80" y="86" font-size="${fs}" font-weight="800" fill="${ink}" text-anchor="middle">${esc(name)}</text>
      <text x="80" y="108" font-size="15" font-weight="700" fill="${ink}" text-anchor="middle">${esc(sub)}</text>`;
  } else {
    body = `<polygon points="50,12 110,12 148,50 148,110 110,148 50,148 12,110 12,50" fill="none" stroke="${ink}" stroke-width="4"/>
      <polygon points="54,21 106,21 139,54 139,106 106,139 54,139 21,106 21,54" fill="none" stroke="${ink}" stroke-width="1.5"/>
      <text x="80" y="58" font-size="10" font-weight="700" letter-spacing="3" fill="${ink}" text-anchor="middle">✈ ${code} ✈</text>
      <text x="80" y="86" font-size="${fs}" font-weight="800" fill="${ink}" text-anchor="middle">${esc(name)}</text>
      <text x="80" y="112" font-size="20" font-weight="800" fill="${ink}" text-anchor="middle">${esc(sub)}</text>`;
  }
  return `<svg class="stamp-svg" viewBox="0 0 160 160" role="img" aria-label="Stempel ${esc(name)}"><g filter="url(#inkRough)" font-family="'Special Elite','Courier New',monospace">${body}</g></svg>`;
}
function stampRotation(id) { return ((hashStr(id + 'r') % 17) - 8); }

function stampPop(id) {
  const el = $('stampPop');
  el.innerHTML = stampSVG(id);
  el.style.setProperty('--rot', stampRotation(id) + 'deg');
  el.hidden = false;
  el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  setTimeout(() => {
    sfx.stamp(); buzz(35);
    const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect();
    confetti(r.left - s.left + r.width / 2, r.top - s.top + r.height / 2, 70);
  }, 260);
  clearTimeout(stampPop.t);
  stampPop.t = setTimeout(() => { el.hidden = true; }, 1500);
}

/* ---------- Otwieranie / zamykanie ---------- */
function openCountry(id, opts = {}) {
  const f = byId.get(id);
  if (!f) return;
  selectedId = id; selectedPlace = null;
  $('sheetTitle').textContent = f.properties.n;
  $('sheetFlag').outerHTML = flagHTML(id, 'flag').replace('<span ', '<span id="sheetFlag" ');
  renderSheet();
  sheet.hidden = false;
  sheetBody.scrollTop = 0;
  hideHint();
  if (opts.fly) flyToCountry(f, { lift: true });
  requestRender();
}
function closeSheet() {
  if (sheet.hidden && !selectedId) return;
  saveNow();
  sheet.hidden = true; selectedId = null; selectedPlace = null; requestRender();
}

function subLine(id) {
  const parts = [];
  if (id === homeId()) parts.push('Twój dom');
  const c = meta(id).c;
  if (c) parts.push(CONTINENTS[c]);
  parts.push(KIND_LABEL[kindOf(id)]);
  const e = entry(id);
  if (e && e.visited) { const n = 1 + e.visits.length; parts.push(`${n} ${plural(n, ['wizyta', 'wizyty', 'wizyt'])}`); }
  return parts.join(' · ');
}

const ICON_TRASH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_PLUS = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICON_HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((d - t) / 86400000);
}
function countdownText(days) {
  if (days == null) return '';
  if (days < 0) return 'Termin minął. Byłeś? Wbij stempel!';
  if (days === 0) return 'Wylot dziś!';
  if (days === 1) return 'Wylot jutro!';
  return `Za ${days} dni`;
}

function renderSheet() {
  const id = selectedId;
  const f = byId.get(id);
  if (!f) return;
  $('sheetSub').textContent = subLine(id);
  const c = entry(id);
  sheet.style.setProperty('--stamp', inkOfId(id));
  let html = '';

  if (!c || !c.visited) {
    const wish = c && c.wish;
    html += `<div class="status-row">
      <button type="button" class="status-btn" id="markVisited">${svgIcon('stamp', 22)}<span>Byłem tu</span></button>
      <button type="button" class="status-btn wish ${wish ? 'on' : ''}" id="markWish" aria-pressed="${!!wish}">${svgIcon('plane', 22)}<span>${wish ? 'Na liście marzeń' : 'Chcę tu pojechać'}</span></button>
    </div>`;
    if (wish) {
      const dd = daysUntil(c.plannedDate);
      html += `<div class="field">
          <label for="plannedDate">Planowana podróż</label>
          <div class="date-row"><input id="plannedDate" type="date" value="${esc(c.plannedDate)}"><span class="countdown-inline" id="cdInline">${esc(countdownText(dd))}</span></div>
        </div>
        <div class="field"><label for="notes">Co chcę tam zobaczyć</label>
          <textarea id="notes" rows="3" placeholder="Miejsca, jedzenie, ludzie, pomysły">${esc(c.notes)}</textarea></div>`;
    }
  } else {
    html += `<div class="stamp-row">
        <div class="stamp-mini" style="--rot:${stampRotation(id)}deg">${stampSVG(id)}</div>
        <div class="stamp-info"><b id="stampText"></b><button type="button" class="link" id="unmark">Cofnij oznaczenie</button></div>
      </div>
      <div class="confirm" id="unmarkConfirm" hidden>
        <p>Usunąć oznaczenie i wszystkie notatki dla tego kraju?</p>
        <div class="btn-row"><button type="button" class="btn btn-danger" id="unmarkYes">Tak, usuń</button><button type="button" class="btn btn-soft" id="unmarkNo">Anuluj</button></div>
      </div>
      <div class="field">
        <span class="field-label">Pierwszy raz <span class="muted small">(dzień i miesiąc, jeśli pamiętasz)</span></span>
        <div id="firstDate">${datePickerHTML(c.firstDate && D.yearOf(c.firstDate) === c.firstYear ? c.firstDate : (c.firstYear ? String(c.firstYear) : ''), { label: 'Pierwszy raz' })}</div>
      </div>
      <p class="field-error" id="firstYearErr" hidden>Wpisz rok od ${MIN_YEAR} do ${THIS_YEAR}.</p>
      <div class="field">
        <span class="field-label">Ocena</span>
        <div class="hearts" id="hearts" role="radiogroup" aria-label="Ocena kraju">
          ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-r="${n}" role="radio" aria-checked="${c.rating === n}" aria-label="${n} na 5" class="${c.rating >= n ? 'on' : ''}">${ICON_HEART}</button>`).join('')}
        </div>
      </div>
      <div class="field">
        <span class="field-label">Kolejne wizyty</span>
        <ul class="visits" id="visits"></ul>
        <button type="button" class="add-btn" id="addVisit">${ICON_PLUS} Dodaj wizytę</button>
      </div>
      <div class="field"><label for="notes">Notatki</label>
        <textarea id="notes" rows="4" placeholder="Miasta, wspomnienia, z kim, co warto zapamiętać">${esc(c.notes)}</textarea></div>`;
  }

  html += placesSectionHTML(id) + factsHTML(id);
  sheetBody.innerHTML = html;
  bindSheet(id, f, c);
}

function factsHTML(id) {
  const m = meta(id);
  const rows = [];
  if (m.cap) rows.push(['Stolica', esc(m.cap)]);
  if (m.ar) {
    let cmp = '';
    const home = homeId();
    if (home && home !== id && meta(home).ar) {
      const ratio = m.ar / meta(home).ar;
      const hn = esc(countryName(home));
      if (ratio >= 1.15) cmp = `${fmt1.format(ratio)}× większy niż ${hn}`;
      else if (ratio <= 0.87) cmp = `${fmt1.format(1 / ratio)}× mniejszy niż ${hn}`;
      else cmp = `prawie jak ${hn}`;
    }
    rows.push(['Powierzchnia', `${fmtInt.format(m.ar)} km²${cmp ? `<small>${cmp}</small>` : ''}`]);
  }
  if (m.cur && m.cur.length) rows.push(['Waluta', esc(m.cur.slice(0, 2).map(curName).join(', '))]);
  const langs = (m.lg || []).map(langName).filter(Boolean);
  if (langs.length) rows.push(['Języki', esc(langs.slice(0, 3).join(', '))]);
  const gl = (m.lg || []).find((l) => GREET[l]);
  if (gl) rows.push(['Powiedz cześć', `<span class="greet">${esc(GREET[gl])}</span><small>${esc(langName(gl) || '')}</small>`]);
  const home = homeId();
  if (home && home !== id) {
    const km = distanceKm(home, id);
    if (km != null) {
      const hrs = km / 820;
      const fl = hrs < 1 ? 'mniej niż godzina lotu' : `ok. ${fmt1.format(Math.round(hrs * 2) / 2)} h lotu`;
      rows.push(['Od domu', `${fmtInt.format(Math.round(km / 10) * 10)} km<small>${fl}</small>`]);
    }
  }
  if (m.ld) rows.push(['Ciekawostka', 'Kraj bez dostępu do morza']);
  const nb = (m.b || []).filter((b) => byId.has(b));
  let nbHTML = '';
  if (nb.length) {
    const seen = nb.filter(isVisited).length;
    nbHTML = `<div class="nbrs"><span class="field-label">Sąsiedzi · odwiedzone ${seen}/${nb.length}</span><div class="chips">${nb
      .sort((a, b) => collator.compare(countryName(a), countryName(b)))
      .map((b) => `<button type="button" class="nb-chip ${isVisited(b) ? 'on' : isWish(b) ? 'wish' : ''}" data-go="${esc(b)}" style="--stamp:${inkOfId(b)}">${flagSupport ? flagEmoji(b) + ' ' : ''}${esc(countryName(b))}</button>`).join('')}</div></div>`;
  } else if (m.c && m.c !== 'AN' && SOVEREIGN.has(id)) {
    nbHTML = '<p class="muted small">Brak granic lądowych. Tu dociera się samolotem albo statkiem.</p>';
  }
  if (!rows.length && !nbHTML) return '';
  return `<section class="facts"><h3>Ściąga podróżnika</h3><dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>${nbHTML}</section>`;
}

function bindSheet(id, f, c) {
  bindPlaceRows(sheetBody);
  sheetBody.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => openCountry(b.dataset.go, { fly: true })));

  if (!c || !c.visited) {
    $('markVisited').addEventListener('click', () => {
      const prev = entry(id) || {};
      state.countries[id] = { visited: true, wish: false, firstYear: null, visits: [], notes: prev.notes || '', rating: 0, plannedDate: '', addedAt: new Date().toISOString() };
      saveNow(); stampPop(id); afterDataChange();
      renderSheet();
      const y = sheetBody.querySelector('#firstDate .dp-y'); if (y && window.matchMedia('(pointer: fine)').matches) y.focus();
    });
    $('markWish').addEventListener('click', () => {
      if (c && c.wish) {
        delete state.countries[id];
        toast(`Usunięto z marzeń: ${esc(f.properties.n)}`);
      } else {
        state.countries[id] = { visited: false, wish: true, firstYear: null, visits: [], notes: '', rating: 0, plannedDate: '', addedAt: new Date().toISOString() };
        sfx.pop(); buzz(15);
        toast(`${svgIcon('plane', 18)} Dodano do marzeń: <b>${esc(f.properties.n)}</b>`);
      }
      saveNow(); afterDataChange(); renderSheet();
    });
    if (c && c.wish) {
      $('plannedDate').addEventListener('change', (e) => {
        c.plannedDate = e.target.value; saveNow(); updateCountdown();
        $('cdInline').textContent = countdownText(daysUntil(c.plannedDate));
      });
      $('notes').addEventListener('input', (e) => { c.notes = e.target.value; saveSoon(); });
    }
    return;
  }

  const updateStamp = () => {
    const when = visitDateText(c.firstYear, c.firstDate);
    $('stampText').textContent = when ? `Pierwszy raz: ${when}` : 'Uzupełnij datę pierwszej wizyty';
    $('sheetSub').textContent = subLine(id);
    const mini = sheetBody.querySelector('.stamp-mini');
    if (mini) mini.innerHTML = stampSVG(id);
  };
  updateStamp();

  bindDatePicker($('firstDate').querySelector('.dpick'), (v) => {
    c.firstYear = v ? D.yearOf(v) : null;
    if (v) c.firstDate = v; else delete c.firstDate;
    updateStamp(); saveSoon(); afterDataChange(false);
  }, (bad) => { $('firstYearErr').hidden = !bad; });
  $('hearts').addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    const r = Number(b.dataset.r);
    c.rating = c.rating === r ? 0 : r;
    $('hearts').querySelectorAll('[data-r]').forEach((x) => { const n = Number(x.dataset.r); x.classList.toggle('on', c.rating >= n); x.setAttribute('aria-checked', String(c.rating === n)); });
    if (c.rating === 5) { sfx.good(); const br = b.getBoundingClientRect(), s = stage.getBoundingClientRect(); confetti(br.left - s.left, br.top - s.top, 30, 0.6); } else sfx.pop();
    saveNow(); afterDataChange(false);
  });
  $('notes').addEventListener('input', (e) => { c.notes = e.target.value; saveSoon(); afterDataChange(false, true); });
  $('addVisit').addEventListener('click', () => {
    c.visits.push({ year: null, note: '' });
    saveSoon(); renderVisits(c, updateStamp); updateStamp();
    const rows = $('visits').querySelectorAll('.dp-y');
    if (rows.length) rows[rows.length - 1].focus();
  });
  $('unmark').addEventListener('click', () => {
    const hasData = c.firstYear || c.visits.length || c.notes.trim() || c.rating;
    if (!hasData) return unmark(id);
    $('unmarkConfirm').hidden = false;
  });
  $('unmarkYes').addEventListener('click', () => unmark(id));
  $('unmarkNo').addEventListener('click', () => { $('unmarkConfirm').hidden = true; });
  renderVisits(c, updateStamp);
}

function renderVisits(c, updateStamp) {
  const ul = $('visits');
  ul.innerHTML = c.visits.map((v, i) => `
    <li class="visit-row" data-i="${i}">
      ${datePickerHTML(v.date && D.yearOf(v.date) === v.year ? v.date : (v.year ? String(v.year) : ''), { label: `Wizyta ${i + 2}` })}
      <input class="note" type="text" placeholder="Krótki opis (opcjonalnie)" value="${esc(v.note)}" aria-label="Opis wizyty ${i + 2}">
      <button type="button" class="icon-btn" aria-label="Usuń wizytę">${ICON_TRASH}</button>
    </li>`).join('');
  ul.querySelectorAll('.visit-row').forEach((row) => {
    const i = Number(row.dataset.i);
    bindDatePicker(row.querySelector('.dpick'), (val) => {
      c.visits[i].year = val ? D.yearOf(val) : null;
      if (val) c.visits[i].date = val; else delete c.visits[i].date;
      saveSoon(); afterDataChange(false);
    });
    row.querySelector('.note').addEventListener('input', (e) => { c.visits[i].note = e.target.value; saveSoon(); });
    row.querySelector('.icon-btn').addEventListener('click', () => {
      c.visits.splice(i, 1); saveSoon(); renderVisits(c, updateStamp); updateStamp(); afterDataChange(false);
    });
  });
}

function unmark(id) {
  delete state.countries[id];
  saveNow(); afterDataChange(); renderSheet();
  toast(`Usunięto oznaczenie: ${esc(countryName(id))}`);
}

let progressTimer = null;
function afterDataChange(redraw = true, quiet = false) {
  updateStats();
  updateCountdown();
  if (activeView === 'list') renderList();
  if (redraw) requestRender();
  clearTimeout(progressTimer);
  progressTimer = setTimeout(() => checkProgress(false), quiet ? 1500 : 200);
}
