/* AlvaTour: zabawa. Ruletka podróży, quiz, wehikuł czasu, karta podróżnika. */
'use strict';

const funCard = $('funCard');
let gameToken = 0;
const inFrame = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();

function renderFun() {
  const yearsCount = new Set(visitedIds().map((id) => entry(id).firstYear).filter((y) => y != null)).size;
  const contChips = (name) => `<div class="chips" data-chips="${name}">
      <button type="button" class="chip-btn on" data-v="">Cały świat</button>
      ${['EU', 'AS', 'AF', 'NA', 'SA', 'OC'].map((c) => `<button type="button" class="chip-btn" data-v="${c}">${CONTINENTS[c]}</button>`).join('')}
    </div>`;
  $('funBody').innerHTML = `
    <div class="fun-wrap">
      <header class="fun-head"><h2 id="funTitle">Zabawa</h2><p class="muted">Gry i niespodzianki na podstawie Twojej mapy.</p></header>
      <div class="games">
        <article class="game game-roulette">
          <div class="game-art">${svgIcon('dice', 40)}</div>
          <h3>Ruletka podróży</h3>
          <p>Nie wiesz, dokąd dalej? Zakręć globem. Wylosuję kraj, w którym jeszcze nie byłeś.</p>
          ${contChips('roulette')}
          <button type="button" class="btn btn-big" id="goRoulette">Zakręć globem</button>
        </article>
        <article class="game game-quiz">
          <div class="game-art">${svgIcon('brain', 40)}</div>
          <h3>Gdzie to jest?</h3>
          <p>Na globie zaświeci kraj. Zgadnij który. 10 pytań, jak najwięcej punktów.</p>
          <div class="chips" data-chips="quiz">
            <button type="button" class="chip-btn on" data-v="world">Cały świat</button>
            <button type="button" class="chip-btn" data-v="EU">Europa</button>
            <button type="button" class="chip-btn" data-v="AS">Azja</button>
            <button type="button" class="chip-btn" data-v="AF">Afryka</button>
            <button type="button" class="chip-btn" data-v="AM">Ameryki</button>
            <button type="button" class="chip-btn" data-v="mine">Moje kraje</button>
          </div>
          <p class="game-meta">Najlepszy wynik: <b>${state.games.quizBest}/10</b> · zagrano ${state.games.quizPlayed} ${plural(state.games.quizPlayed, ['raz', 'razy', 'razy'])}</p>
          <button type="button" class="btn btn-big" id="goQuiz">Graj</button>
        </article>
        <article class="game game-time">
          <div class="game-art">${svgIcon('clock', 40)}</div>
          <h3>Wehikuł czasu</h3>
          <p>Zobacz, jak rok po roku zapełniała się Twoja mapa. Glob sam poleci do kolejnych krajów.</p>
          <p class="game-meta">${yearsCount ? `${yearsCount} ${plural(yearsCount, ['rok', 'lata', 'lat'])} z podróżami` : 'Wpisz lata pierwszych wizyt, żeby uruchomić wehikuł.'}</p>
          <button type="button" class="btn btn-big" id="goTime" ${yearsCount ? '' : 'disabled'}>Odtwórz moje podróże</button>
        </article>
        <article class="game game-ai">
          <div class="game-art">${svgIcon('brain', 40)}</div>
          <h3>Plan podróży z AI</h3>
          <p>Zapytaj Claude albo Gemini, co zobaczyć, a polecone miejsca trafią na Twój glob jako „do odwiedzenia”.</p>
          <button type="button" class="btn btn-big" id="goAI">Zaplanuj z AI</button>
        </article>
        <article class="game game-card">
          <div class="game-art">${svgIcon('star', 40)}</div>
          <h3>Karta podróżnika</h3>
          <p>Obrazek z Twoim globem, rangą i flagami. Gotowy, żeby wysłać znajomym albo wrzucić na Instagram.</p>
          <button type="button" class="btn btn-big" id="goCard">Stwórz kartę</button>
        </article>
      </div>
    </div>`;
  $('funBody').querySelectorAll('[data-chips]').forEach((g) => g.addEventListener('click', (e) => {
    const b = e.target.closest('.chip-btn'); if (!b) return;
    g.querySelectorAll('.chip-btn').forEach((x) => x.classList.toggle('on', x === b));
  }));
  const chip = (name) => ($('funBody').querySelector(`[data-chips="${name}"] .chip-btn.on`) || {}).dataset?.v || '';
  $('goRoulette').addEventListener('click', () => startRoulette(chip('roulette')));
  $('goQuiz').addEventListener('click', () => startQuiz(chip('quiz') || 'world'));
  $('goTime').addEventListener('click', startTimelapse);
  $('goCard').addEventListener('click', makeShareCard);
  $('goAI').addEventListener('click', () => openAIImport());
}

function beginGame(mode) {
  showView('globe');
  closeSheet();
  globeMode = mode;
  document.body.classList.add('in-game');
  return ++gameToken;
}
function endGame() {
  gameToken++;
  stopFlight();
  globeMode = 'normal';
  timeYear = null;
  setFocus(null);
  funCard.hidden = true; funCard.innerHTML = '';
  $('timeBanner').hidden = true;
  document.body.classList.remove('in-game');
  requestRender();
}
function setFunCard(html) { funCard.innerHTML = html; funCard.hidden = false; }
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const closeBtn = '<button type="button" class="btn-ghost icon-only fun-x" data-act="close" aria-label="Zakończ"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>';
funCard.addEventListener('click', (e) => { if (e.target.closest('[data-act="close"]')) endGame(); });

/* ================= Ruletka ================= */
async function startRoulette(cont) {
  const home = homeId();
  const pool = features.filter((f) => SOVEREIGN.has(f.id) && !isVisited(f.id) && f.id !== home && (!cont || meta(f.id).c === cont));
  if (!pool.length) { toast(cont ? `Byłeś już wszędzie na kontynencie ${esc(CONTINENTS[cont])}. Szacunek!` : 'Byłeś już wszędzie. Czas na Antarktydę?'); return; }
  const token = beginGame('roulette');
  const t = pick(pool);
  setFunCard(`${closeBtn}<div class="fun-spin"><span class="spinner"></span><b>Kręcę globem…</b></div>`);
  const kz = Math.min(8, countryZoom(t, 0.35)), liftLat = (Math.min(110, H * 0.18) / (baseScale * kz)) * 57.3;
  await flyTo([-t.focus[0], -clamp(t.focus[1] - liftLat, -89, 89)], kz, 3800, { spins: 2, ease: d3.easeCubicOut, ticks: true });
  if (token !== gameToken) return;
  setFocus(t.id, C.gold);
  sfx.fanfare(); buzz([30, 50, 30]); confetti(null, null, 120);
  const m = meta(t.id);
  const km = home ? distanceKm(home, t.id) : null;
  setFunCard(`${closeBtn}
    <span class="eyebrow">Twój kolejny cel</span>
    <div class="fun-result">${flagHTML(t.id, 'flag')}<div><h3>${esc(t.properties.n)}</h3>
      <p class="muted">${[m.c && CONTINENTS[m.c], m.cap && 'stolica ' + m.cap, km && fmtInt.format(Math.round(km / 10) * 10) + ' km od domu'].filter(Boolean).map(esc).join(' · ')}</p></div></div>
    <div class="btn-row">
      <button type="button" class="btn" data-act="wish">${isWish(t.id) ? 'Już jest na liście marzeń' : 'Dodaj do marzeń'}</button>
      <button type="button" class="btn btn-soft" data-act="again">Losuj ponownie</button>
      <button type="button" class="btn btn-soft" data-act="open">Zobacz kraj</button>
    </div>`);
  funCard.querySelector('[data-act="wish"]').addEventListener('click', (e) => {
    if (!isWish(t.id)) {
      state.countries[t.id] = { visited: false, wish: true, firstYear: null, visits: [], notes: '', rating: 0, plannedDate: '', addedAt: new Date().toISOString() };
      state.games.roulette++; saveNow(); afterDataChange();
      sfx.pop(); toast(`${svgIcon('plane', 18)} Dodano do marzeń: <b>${esc(t.properties.n)}</b>`);
    }
    e.target.textContent = 'Na liście marzeń'; e.target.disabled = true;
  });
  funCard.querySelector('[data-act="again"]').addEventListener('click', () => { setFocus(null); startRoulette(cont); });
  funCard.querySelector('[data-act="open"]').addEventListener('click', () => { endGame(); openCountry(t.id); });
}

/* ================= Quiz ================= */
let quiz = null;
function quizPool(mode) {
  const sov = features.filter((f) => SOVEREIGN.has(f.id));
  if (mode === 'mine') { const mine = sov.filter((f) => isVisited(f.id)); return mine.length >= 4 ? mine : null; }
  if (mode === 'AM') return sov.filter((f) => ['NA', 'SA'].includes(meta(f.id).c));
  if (mode && mode !== 'world') return sov.filter((f) => meta(f.id).c === mode);
  return sov;
}
function startQuiz(mode) {
  const pool = quizPool(mode);
  if (!pool) { toast('Do trybu „Moje kraje” potrzebujesz co najmniej 4 odwiedzonych krajów.'); return; }
  const token = beginGame('quiz');
  quiz = { token, mode, pool, order: shuffle(pool.slice()).slice(0, 10), round: 0, score: 0, streak: 0 };
  quizRound();
}
async function quizRound() {
  const q = quiz;
  if (!q || q.token !== gameToken) return;
  if (q.round >= q.order.length) return quizEnd();
  const t = q.order[q.round];
  const same = q.pool.filter((f) => f.id !== t.id && meta(f.id).c === meta(t.id).c);
  const rest = features.filter((f) => SOVEREIGN.has(f.id) && f.id !== t.id);
  const opts = shuffle(same.slice()).slice(0, 3);
  while (opts.length < 3) { const r = pick(rest); if (!opts.includes(r)) opts.push(r); }
  const answers = shuffle([t, ...opts]);
  setFocus(t.id, C.inks[5]);
  setFunCard(`${closeBtn}
    <div class="quiz-top"><span class="eyebrow">Pytanie ${q.round + 1}/${q.order.length}</span><span class="quiz-score">${q.score} pkt${q.streak >= 2 ? ` · seria ${q.streak}` : ''}</span></div>
    <div class="quiz-bar"><span style="width:${(q.round / q.order.length) * 100}%"></span></div>
    <h3>Jaki kraj świeci na globie?</h3>
    <div class="quiz-opts">${answers.map((f) => `<button type="button" class="quiz-opt" data-id="${f.id}">${esc(f.properties.n)}</button>`).join('')}</div>`);
  flyToCountry(t, { fill: 0.22, maxK: 6, duration: 1100, liftPx: Math.min(130, H * 0.2) });
  funCard.querySelectorAll('.quiz-opt').forEach((b) => b.addEventListener('click', () => {
    if (funCard.querySelector('.quiz-opt[disabled]')) return;
    const ok = b.dataset.id === t.id;
    funCard.querySelectorAll('.quiz-opt').forEach((x) => { x.disabled = true; if (x.dataset.id === t.id) x.classList.add('right'); });
    if (ok) { q.score++; q.streak++; sfx.good(); buzz(15); setFocus(t.id, C.inks[2]); if (q.streak >= 3) confetti(null, null, 40, 0.7); }
    else { q.streak = 0; b.classList.add('wrong'); sfx.bad(); buzz([40, 40, 40]); setFocus(t.id, C.inks[0]); }
    q.round++;
    setTimeout(quizRound, ok ? 1000 : 1700);
  }));
}
function quizEnd() {
  const q = quiz;
  const best = q.score > state.games.quizBest;
  state.games.quizBest = Math.max(state.games.quizBest, q.score);
  state.games.quizPlayed++;
  saveNow(); checkProgress(false);
  setFocus(null);
  const lines = ['Mapa czeka na odkrycie!', 'Rozgrzewka zaliczona.', 'Nieźle, rośnie geograf.', 'Świetnie! Atlas masz w małym palcu.', 'Perfekcja. Chodząca encyklopedia!'];
  const line = lines[q.score === 10 ? 4 : q.score >= 8 ? 3 : q.score >= 5 ? 2 : q.score >= 2 ? 1 : 0];
  if (q.score >= 8) { sfx.fanfare(); confetti(null, null, 160, 1.2); }
  setFunCard(`${closeBtn}
    <span class="eyebrow">Koniec quizu</span>
    <div class="quiz-final"><b>${q.score}<small>/10</small></b><p>${esc(line)}${best ? '<br><span class="new-best">Nowy rekord!</span>' : ''}</p></div>
    <div class="btn-row"><button type="button" class="btn" data-act="again">Jeszcze raz</button><button type="button" class="btn btn-soft" data-act="close">Zakończ</button></div>`);
  funCard.querySelector('[data-act="again"]').addEventListener('click', () => startQuiz(q.mode));
}

/* ================= Wehikuł czasu ================= */
async function startTimelapse() {
  const ids = visitedIds().filter((id) => entry(id).firstYear != null && byId.has(id));
  const years = [...new Set(ids.map((id) => entry(id).firstYear))].sort((a, b) => a - b);
  if (!years.length) return;
  const token = beginGame('time');
  timeYear = years[0] - 1;
  const banner = $('timeBanner');
  banner.hidden = false; $('timeYear').textContent = ''; $('timeNames').textContent = '';
  setFunCard(`${closeBtn}<div class="fun-spin"><span class="eyebrow">Wehikuł czasu</span><b id="tlInfo">Startujemy…</b></div><div class="quiz-bar"><span id="tlBar" style="width:0"></span></div>`);
  await flyTo(rotation, 1, 700);
  let total = 0;
  for (let i = 0; i < years.length; i++) {
    const y = years[i];
    if (token !== gameToken) return;
    const fresh = ids.filter((id) => entry(id).firstYear === y);
    const c = d3.geoCentroid({ type: 'MultiPoint', coordinates: fresh.map((id) => byId.get(id).focus) });
    await flyTo([-c[0], -clamp(c[1], -60, 60)], 1.15, 1100);
    if (token !== gameToken) return;
    timeYear = y; total += fresh.length;
    $('timeYear').textContent = y;
    $('timeNames').textContent = fresh.map(countryName).join(' · ');
    banner.classList.remove('pop'); void banner.offsetWidth; banner.classList.add('pop');
    $('tlInfo').textContent = `${countries(total)} na mapie`;
    $('tlBar').style.width = ((i + 1) / years.length) * 100 + '%';
    render(); sfx.stamp(); buzz(20);
    confetti(null, null, 25 + fresh.length * 10, 0.7);
    await sleep(1500);
  }
  if (token !== gameToken) return;
  timeYear = null; render();
  const span = years[years.length - 1] - years[0];
  $('timeYear').textContent = `${years[0]}-${years[years.length - 1]}`;
  $('timeNames').textContent = `${countries(total)} w ${span + 1} ${plural(span + 1, ['rok', 'lata', 'lat'])}`;
  state.games.timelapse++; saveNow(); checkProgress(false);
  sfx.fanfare(); confetti(null, null, 140, 1.2);
  setFunCard(`${closeBtn}<span class="eyebrow">Koniec podróży w czasie</span><h3>${countries(total)} od ${years[0]}</h3><div class="btn-row"><button type="button" class="btn" data-act="again">Obejrzyj jeszcze raz</button><button type="button" class="btn btn-soft" data-act="close">Zamknij</button></div>`);
  funCard.querySelector('[data-act="again"]').addEventListener('click', startTimelapse);
}

/* ================= Karta podróżnika ================= */
async function makeShareCard() {
  try { await document.fonts.ready; } catch (e) { /* */ }
  const Wc = 1080, Hc = 1350;
  const cv = document.createElement('canvas'); cv.width = Wc; cv.height = Hc;
  const g = cv.getContext('2d');
  const bg = g.createLinearGradient(0, 0, Wc, Hc); bg.addColorStop(0, '#1f3a5f'); bg.addColorStop(1, '#0c1726');
  g.fillStyle = bg; g.fillRect(0, 0, Wc, Hc);
  // delikatne kropki
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (let y = 30; y < Hc; y += 36) for (let x = 30; x < Wc; x += 36) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }

  const disp = "'Bricolage Grotesque', 'Segoe UI', sans-serif", body = "'Instrument Sans', 'Segoe UI', sans-serif";
  g.fillStyle = '#ffffff'; g.font = `800 64px ${disp}`; g.textBaseline = 'alphabetic';
  g.fillText('Alva', 72, 120); const wA = g.measureText('Alva').width;
  g.fillStyle = '#ff8a7a'; g.fillText('Tour', 72 + wA, 120);
  const name = state.settings.name.trim();
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.font = `500 32px ${body}`;
  g.fillText(name ? `Mapa podróży: ${name}` : 'Moja mapa podróży', 72, 172);

  // glob
  const home = homeId();
  const center = home ? byId.get(home).focus : [15, 40];
  const pr = d3.geoOrthographic().translate([Wc / 2, 600]).scale(360).rotate([-center[0], -clamp(center[1] - 10, -60, 60)]).clipAngle(90).precision(0.6);
  const pth = d3.geoPath(pr, g);
  const glow = g.createRadialGradient(Wc / 2, 600, 330, Wc / 2, 600, 430); glow.addColorStop(0, 'rgba(143,180,227,0.45)'); glow.addColorStop(1, 'rgba(143,180,227,0)');
  g.fillStyle = glow; g.beginPath(); g.arc(Wc / 2, 600, 430, 0, 7); g.fill();
  g.beginPath(); pth(SPHERE); g.fillStyle = '#2b4c76'; g.fill();
  g.beginPath(); pth(GRATICULE); g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1.2; g.stroke();
  g.beginPath(); for (const f of features) if (!isVisited(f.id)) pth(f); g.fillStyle = '#f4f7fa'; g.fill(); g.strokeStyle = '#8496a8'; g.lineWidth = 0.8; g.stroke();
  for (const f of features) if (isVisited(f.id)) { g.beginPath(); pth(f); g.fillStyle = inkOfId(f.id); g.fill(); g.strokeStyle = '#ffffff'; g.lineWidth = 0.8; g.stroke(); }

  // statystyki
  const x = progressCtx(), n = x.sov.length, r = rankFor(n);
  const totalArea = Object.values(META).reduce((s, m) => s + (m.ar || 0), 0);
  const areaPct = totalArea ? x.v.reduce((s, id) => s + (meta(id).ar || 0), 0) / totalArea * 100 : 0;
  const contN = CONT_ORDER.filter((c) => x.byCont[c]).length;
  const cols = [[String(n), plural(n, P_COUNTRY)], [`${Math.round((n / SOVEREIGN_TOTAL) * 100)}%`, 'państw świata'], [`${contN}/7`, 'kontynentów'], [`${fmt1.format(areaPct)}%`, 'lądów Ziemi']];
  const colW = (Wc - 144) / 4;
  cols.forEach(([v, l], i) => {
    const cx = 72 + colW * i + colW / 2;
    g.textAlign = 'center'; g.fillStyle = '#ffffff'; g.font = `800 72px ${disp}`; g.fillText(v, cx, 1065);
    g.fillStyle = 'rgba(255,255,255,0.65)'; g.font = `500 26px ${body}`; g.fillText(l, cx, 1103);
  });
  // ranga
  g.textAlign = 'center';
  const rt = `RANGA: ${r.cur.name.toUpperCase()}`;
  g.font = `700 28px ${body}`; const rw = g.measureText(rt).width + 56;
  g.fillStyle = '#e8b34a'; roundRect(g, Wc / 2 - rw / 2, 960, rw, 52, 26); g.fill();
  g.fillStyle = '#1b2a3d'; g.fillText(rt, Wc / 2, 996);
  // flagi
  const ids = x.v.slice().sort((a, b) => (entry(a).firstYear ?? 9999) - (entry(b).firstYear ?? 9999));
  const flags = ids.slice(0, 18);
  g.font = `44px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  const fw = 56, startX = Wc / 2 - (flags.length * fw) / 2 + fw / 2;
  flags.forEach((id, i) => {
    if (flagSupport && flagEmoji(id)) g.fillText(flagEmoji(id), startX + i * fw, 1192);
    else { g.font = `700 22px ${body}`; g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillText(id, startX + i * fw, 1185); g.font = `44px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; }
  });
  if (ids.length > 18) { g.font = `600 26px ${body}`; g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillText(`+${ids.length - 18} więcej`, Wc / 2, 1240); }
  g.font = `500 24px ${body}`; g.fillStyle = 'rgba(255,255,255,0.5)';
  g.fillText(`alvatour · ${new Date().toLocaleDateString('pl-PL')}`, Wc / 2, Hc - 48);
  g.textAlign = 'left';

  const url = cv.toDataURL('image/png');
  openModal(`
    <div class="share">
      <div class="share-head"><h2>Karta podróżnika</h2><button type="button" class="btn-ghost icon-only" id="shareClose" aria-label="Zamknij"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>
      <img src="${url}" alt="Karta podróżnika AlvaTour" class="share-img">
      <div class="btn-row">
        <button type="button" class="btn" id="shareGo">Udostępnij</button>
      </div>
      <p class="muted small">W oknie „Udostępnij” możesz wysłać kartę znajomym albo zapisać ją na Dysku Google.</p>
    </div>`, (card) => {
    card.querySelector('#shareClose').addEventListener('click', closeModal);
    card.querySelector('#shareGo').addEventListener('click', async () => {
      try { await AlvaNative.shareImage(url, 'alvatour-karta.png', `Byłem już w ${countries(n)}!`); } catch (e) { toast('Nie udało się udostępnić obrazka.'); }
    });
  });
  sfx.pop();
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
