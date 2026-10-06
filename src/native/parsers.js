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
