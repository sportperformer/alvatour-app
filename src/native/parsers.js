// Parsery tekstu: udostępnianie z Google Maps i odpowiedzi AI. Czyste funkcje (testowane w tests/parsers.test.js).

export const CAT_WORDS = [
  ['food', /restaura|bistro|jedzen|kuchni|tapas|pizz|sushi|tawern|knajp|food|eat|grill|ramen|steak|seafood/i],
  ['cafe', /kaw|cafe|café|coffee|cukierni|piekarn|bakery|lody|gelat|dessert|deser/i],
  ['bar', /bar|pub|piw|wine|win[oa]|cocktail|drink|rooftop/i],
  ['hotel', /hotel|nocleg|hostel|apartament|pensjonat|b&b|resort|stay/i],
  ['museum', /muze|museum|galeri|gallery|wystaw/i],
  ['view', /widok|punkt widokowy|viewpoint|miradouro|panoram|taras/i],
  ['beach', /plaż|beach|praia|playa|zatok/i],
  ['nature', /park|natur|las|góry|szlak|ogród|garden|jezior|wodospad|hike|trail|mountain/i],
  ['shop', /sklep|zakup|market|targ|bazar|shop|mall/i],
  ['sight', /zabyt|katedr|kości|zamek|pałac|most|plac|wieża|klasztor|ruin|castle|church|cathedral|palace|tower|bridge|square|monument|historic/i],
];
export function guessCat(text) { for (const [id, re] of CAT_WORDS) if (re.test(text || '')) return id; return 'other'; }

const GMAPS_RE = /google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google/;
/** Krótki link Google Maps (bez współrzędnych), który można rozwinąć. */
export const isShortMapsLink = (u) => /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//.test(u || '');

/** Współrzędne z linku Google Maps (!3d!4d, @lat,lng albo ?q=lat,lng). */
export function coordsFromUrl(u) {
  const m = String(u || '').match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) || String(u || '').match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    || String(u || '').match(/[?&](?:q|query|ll|destination)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/i);
  if (!m) return null;
  const lat = Number(m[1]), lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

/** Tekst udostępniony z Google Maps -> { name, addr, url, lat, lng } */
export function parseShared(raw) {
  const text = String(raw || '').trim();
  const out = { name: '', addr: '', url: '', lat: null, lng: null };
  if (!text) return out;
  const urls = text.match(/https?:\/\/[^\s<>"]+/g) || [];
  const gurl = urls.find((u) => GMAPS_RE.test(u)) || urls[0] || '';
  out.url = gurl;
  if (gurl) {
    const c = coordsFromUrl(gurl);
    if (c) { out.lat = c.lat; out.lng = c.lng; }
    const pm = gurl.match(/\/place\/([^/@?]+)/);
    if (pm) { try { out.name = decodeURIComponent(pm[1].replace(/\+/g, ' ')); } catch (e) { out.name = pm[1].replace(/\+/g, ' '); } }
    const qm = !out.name && gurl.match(/[?&](?:q|query)=([^&]+)/);
    if (qm && !/^-?\d/.test(qm[1])) { try { out.name = decodeURIComponent(qm[1].replace(/\+/g, ' ')); } catch (e) { /* */ } }
  }
  const lines = text.replace(/https?:\/\/[^\s<>"]+/g, '\n').split(/\n+/).map((l) => l.trim()).filter((l) => l && !/^(google maps|mapy google)$/i.test(l));
  if (lines.length) {
    const nameFromText = !out.name;
    if (nameFromText) out.name = lines[0].replace(/\s*[·|]\s*$/, '');
    out.addr = lines.slice(nameFromText || out.name === lines[0] ? 1 : 0).join(', ');
  }
  return out;
}

/** Czy tekst wygląda na odpowiedź AI z listą miejsc (a nie na udostępnienie z Google Maps). */
export function looksLikeAI(t) { return /"places"\s*:|"alvatour"|ALVATOUR/i.test(t || '') || (/\[\s*\{[\s\S]*"name"/.test(t || '')); }

/** Odpowiedź AI -> [{ name, city, country, cat, note }] (JSON w bloku kodu, bez bloku, albo linie "Nazwa | Miasto | Kategoria | Opis"). */
export function parseAI(text) {
  const t = String(text || '');
  const tryParse = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };
  let data = null;
  const blocks = [...t.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1]);
  for (const b of blocks.reverse()) { data = tryParse(b.trim()); if (data) break; }
  if (!data) { const i = t.search(/\{\s*"alvatour"/); if (i >= 0) data = tryParse(t.slice(i, t.lastIndexOf('}') + 1)); }
  if (!data) { const i = t.indexOf('['), j = t.lastIndexOf(']'); if (i >= 0 && j > i) data = tryParse(t.slice(i, j + 1)); }
  let arr = Array.isArray(data) ? data : data && Array.isArray(data.places) ? data.places : null;
  if (!arr) { // awaryjnie: linie "Nazwa | Miasto | Kategoria | Opis"
    arr = t.split('\n').filter((l) => l.split('|').length >= 2).map((l) => { const [name, city, category, note] = l.split('|').map((x) => x.replace(/^[\s\-*\d.]+/, '').trim()); return { name, city, category, note }; });
  }
  return arr.filter((x) => x && x.name).map((x) => ({
    name: String(x.name).trim(), city: String(x.city || '').trim(), country: String(x.country || '').trim(),
    cat: guessCat(String(x.category || '') + ' ' + x.name), note: String(x.note || x.description || '').trim(),
  }));
}

/* ================= Plany zwiedzania: Google Moje Mapy (KML) ================= */

/** Identyfikator mapy z linku Moich Map (…/maps/d/…?mid=XXXX…). */
export function myMapsId(url) {
  const m = String(url || '').match(/[?&]mid=([A-Za-z0-9_-]{10,})/);
  return m ? m[1] : null;
}
export const myMapsKmlUrl = (mid) => `https://www.google.com/maps/d/kml?mid=${encodeURIComponent(mid)}&forcekml=1`;

const XML_ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function xmlText(s) {
  let t = String(s || '').trim();
  const cdata = t.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata) t = cdata[1];
  return t.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : XML_ENT[e.toLowerCase()]));
}
const tag = (xml, name) => { const m = String(xml).match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`)); return m ? xmlText(m[1]) : ''; };
const stripHtml = (s) => String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();

/** Kolor KML (aabbggrr) albo z identyfikatora stylu Moich Map (icon-1603-E65100-…) -> "#rrggbb". */
export function kmlColor(styleId, kmlHex) {
  const m = String(styleId || '').match(/-([0-9A-Fa-f]{6})(?:-|$)/);
  if (m) return '#' + m[1].toLowerCase();
  const h = String(kmlHex || '').trim();
  if (/^[0-9a-f]{8}$/i.test(h)) return '#' + h.slice(6, 8) + h.slice(4, 6) + h.slice(2, 4);
  return '#c8323c';
}

/**
 * KML z Moich Map -> { name, items: [{ name, addr, cat, desc, color, layer, lat, lng }] }.
 * Współrzędnych może nie być (mapa zrobiona z pliku CSV z adresami): wtedy lat/lng = null.
 */
export function parseKml(xml) {
  const text = String(xml || '');
  if (!/<kml[\s>]/.test(text)) throw new Error('To nie jest plik mapy (KML).');
  const styles = {};
  for (const m of text.matchAll(/<Style\s+id="([^"]+)">([\s\S]*?)<\/Style>/g)) styles[m[1]] = tag(m[2], 'color');
  const pairs = {};
  for (const m of text.matchAll(/<StyleMap\s+id="([^"]+)">([\s\S]*?)<\/StyleMap>/g)) {
    const normal = m[2].match(/<key>normal<\/key>\s*<styleUrl>#?([^<]+)<\/styleUrl>/);
    if (normal) pairs[m[1]] = normal[1];
  }
  const doc = text.match(/<Document>([\s\S]*)<\/Document>/);
  const docName = doc ? tag(doc[1].replace(/<Folder>[\s\S]*$/, ''), 'name') : '';
  const items = [];
  const folders = [...text.matchAll(/<Folder>([\s\S]*?)<\/Folder>/g)];
  const blocks = folders.length ? folders.map((f) => ({ layer: tag(f[1].replace(/<Placemark>[\s\S]*$/, ''), 'name'), xml: f[1] })) : [{ layer: '', xml: text }];
  for (const { layer, xml: fx } of blocks) {
    for (const p of fx.matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/g)) {
      const px = p[1];
      const data = {};
      for (const d of px.matchAll(/<Data\s+name="([^"]+)">\s*<value>([\s\S]*?)<\/value>\s*<\/Data>/g)) data[xmlText(d[1]).toLowerCase()] = xmlText(d[2]);
      const coords = tag(px, 'coordinates').split(/\s+/)[0];
      const [lng, lat] = coords ? coords.split(',').map(Number) : [NaN, NaN];
      const sid = tag(px, 'styleUrl').replace(/^#/, '');
      const styleId = pairs[sid] || sid;
      const desc = data.opis || data.description || data.opisy || stripHtml(tag(px, 'description')).replace(/^(Adres|Kategoria|Opis):.*$/gim, '').trim();
      items.push({
        name: tag(px, 'name') || data.nazwa || data.name || 'Miejsce',
        addr: data.adres || data.address || '',
        cat: data.kategoria || data.category || layer || '',
        desc: desc || '',
        color: kmlColor(styleId, styles[styleId]),
        layer,
        lat: Number.isFinite(lat) && Math.abs(lat) <= 90 ? lat : null,
        lng: Number.isFinite(lng) && Math.abs(lng) <= 180 ? lng : null,
      });
    }
  }
  return { name: docName || 'Plan', items };
}
