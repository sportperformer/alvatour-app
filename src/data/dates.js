// Daty o różnej dokładności: "2024" (sam rok), "2024-04" (miesiąc), "2024-04-15" (dzień).
// Gdy nie pamiętasz miesiąca albo dnia, zapisujesz tylko to, co wiesz.

export const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const RE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** "2024-04-15" -> { y: 2024, m: 4, d: 15 }; "2024" -> { y: 2024, m: null, d: null }; błędna -> null. */
export function parsePartial(s) {
  const r = RE.exec(String(s ?? '').trim());
  if (!r) return null;
  const y = +r[1], m = r[2] ? +r[2] : null, d = r[3] ? +r[3] : null;
  if (m !== null && (m < 1 || m > 12)) return null;
  if (d !== null && (d < 1 || d > daysInMonth(y, m))) return null;
  return { y, m, d };
}

/** Poprawna data w zakresie lat (domyślnie 1900 - bieżący rok). */
export function isValidPartial(s, { min = 1900, max = new Date().getFullYear() } = {}) {
  const p = parsePartial(s);
  return !!p && p.y >= min && p.y <= max;
}

/** Z pól formularza: rok wymagany, miesiąc opcjonalny, dzień tylko razem z miesiącem. */
export function partialFromParts(y, m, d) {
  const yy = Number(y), mm = Number(m) || null;
  if (!Number.isInteger(yy) || yy < 1000 || yy > 9999) return '';
  let out = String(yy);
  if (mm && mm >= 1 && mm <= 12) {
    out += '-' + String(mm).padStart(2, '0');
    const dd = Number(d) || null;
    if (dd && dd >= 1 && dd <= daysInMonth(yy, mm)) out += '-' + String(dd).padStart(2, '0');
  }
  return out;
}

export const yearOf = (s) => { const p = parsePartial(s); return p ? p.y : null; };

/** "15 kwietnia 2024", "kwiecień 2024", "2024" */
export function formatPartial(s) {
  const p = parsePartial(s);
  if (!p) return '';
  if (p.d) return `${p.d} ${MONTHS_GEN[p.m - 1]} ${p.y}`;
  if (p.m) return `${MONTHS[p.m - 1]} ${p.y}`;
  return String(p.y);
}

/**
 * Klucz do sortowania od najdawniejszej: w obrębie roku najpierw daty z miesiącem/dniem
 * (miesiąc bez dnia = początek miesiąca), na końcu wpisy z samym rokiem.
 */
export function partialSortKey(s) {
  const p = parsePartial(s);
  if (!p) return '9999-99-99';
  const y = String(p.y);
  if (!p.m) return `${y}-13-00`;
  return `${y}-${String(p.m).padStart(2, '0')}-${String(p.d || 0).padStart(2, '0')}`;
}
