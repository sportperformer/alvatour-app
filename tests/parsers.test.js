import { describe, it, expect } from 'vitest';
import { parseShared, parseAI, looksLikeAI, guessCat, coordsFromUrl, isShortMapsLink } from '../src/native/parsers.js';

describe('Google Maps: udostępniony tekst i linki', () => {
  it('nazwa + adres + krótki link (typowe "Udostępnij" na Androidzie)', () => {
    const p = parseShared('Majestic Café\nR. de Santa Catarina 112, 4000-442 Porto, Portugalia\nhttps://maps.app.goo.gl/AbCdEf123');
    expect(p).toEqual({ name: 'Majestic Café', addr: 'R. de Santa Catarina 112, 4000-442 Porto, Portugalia', url: 'https://maps.app.goo.gl/AbCdEf123', lat: null, lng: null });
    expect(isShortMapsLink(p.url)).toBe(true);
  });
  it('długi link /place/ ze współrzędnymi !3d!4d (dokładne miejsce, nie środek mapy)', () => {
    const p = parseShared('https://www.google.com/maps/place/Torre+de+Bel%C3%A9m/@38.6916,-9.2160,17z/data=!3m1!4b1!4m6!3m5!1s0xd1ecb!8m2!3d38.6915837!4d-9.2159767!16zL20vMDE4ZHgz');
    expect(p.name).toBe('Torre de Belém');
    expect(p.lat).toBe(38.6915837);
    expect(p.lng).toBe(-9.2159767);
  });
  it('link @lat,lng bez nazwy w ścieżce', () => {
    const p = parseShared('Zobacz: https://www.google.pl/maps/@50.0614,19.9366,15z');
    expect([p.lat, p.lng]).toEqual([50.0614, 19.9366]);
  });
  it('link ?q=lat,lng i ?q=nazwa', () => {
    expect(coordsFromUrl('https://maps.google.com/?q=52.2297,21.0122')).toEqual({ lat: 52.2297, lng: 21.0122 });
    expect(coordsFromUrl('https://maps.google.com/?q=52.2297%2C21.0122')).toEqual({ lat: 52.2297, lng: 21.0122 });
    expect(parseShared('https://www.google.com/maps/search/?api=1&query=Pastéis+de+Belém').name).toBe('Pastéis de Belém');
  });
  it('pomija nagłówek "Google Maps" i znak · na końcu nazwy', () => {
    const p = parseShared('Google Maps\nBar Celona ·\nul. Długa 5, Gdańsk');
    expect(p.name).toBe('Bar Celona');
    expect(p.addr).toBe('ul. Długa 5, Gdańsk');
  });
  it('sam tekst bez linku', () => {
    expect(parseShared('Fushimi Inari, Kioto')).toMatchObject({ name: 'Fushimi Inari, Kioto', url: '', lat: null });
  });
  it('odrzuca współrzędne spoza zakresu i pusty tekst', () => {
    expect(coordsFromUrl('https://www.google.com/maps/@123.5,19.9,15z')).toBe(null);
    expect(parseShared('')).toEqual({ name: '', addr: '', url: '', lat: null, lng: null });
  });
});

describe('odpowiedź AI', () => {
  const block = '```json\n{"alvatour": 1, "places": [\n {"name": "Majestic Café", "city": "Porto", "country": "Portugalia", "category": "kawiarnia", "note": "Secesja i ciastka"},\n {"name": "Livraria Lello", "city": "Porto", "country": "Portugalia", "category": "zabytek", "note": ""}\n]}\n```';
  it('blok JSON na końcu odpowiedzi', () => {
    const r = parseAI('Oto mój plan na 3 dni w Porto...\n\n' + block);
    expect(r).toEqual([
      { name: 'Majestic Café', city: 'Porto', country: 'Portugalia', cat: 'cafe', note: 'Secesja i ciastka' },
      { name: 'Livraria Lello', city: 'Porto', country: 'Portugalia', cat: 'sight', note: '' },
    ]);
    expect(looksLikeAI(block)).toBe(true);
  });
  it('JSON bez bloku kodu (np. po udostępnieniu z aplikacji Gemini)', () => {
    const r = parseAI('Proponuję: { "alvatour": 1, "places": [{"name": "Ramen Ichiran", "city": "Tokio", "country": "Japonia", "category": "restauracja"}] }');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ name: 'Ramen Ichiran', cat: 'food' });
  });
  it('sama tablica i pole description', () => {
    const r = parseAI('[{"name":"Plaża Navagio","city":"Zakynthos","description":"Wrak statku"}]');
    expect(r[0]).toMatchObject({ name: 'Plaża Navagio', cat: 'beach', note: 'Wrak statku' });
  });
  it('kilka bloków kodu: bierze ostatni poprawny', () => {
    const r = parseAI('```\nkod\n```\n' + block);
    expect(r).toHaveLength(2);
  });
  it('awaryjnie linie "Nazwa | Miasto | Kategoria | Opis"', () => {
    const r = parseAI('1. Muzeum Narodowe | Kraków | muzeum | Sukiennice\n- Wawel | Kraków | zabytek | Zamek\nzwykły tekst');
    expect(r).toEqual([
      { name: 'Muzeum Narodowe', city: 'Kraków', country: '', cat: 'museum', note: 'Sukiennice' },
      { name: 'Wawel', city: 'Kraków', country: '', cat: 'sight', note: 'Zamek' },
    ]);
  });
  it('tekst z Google Maps nie wygląda jak odpowiedź AI', () => {
    expect(looksLikeAI('Majestic Café\nPorto\nhttps://maps.app.goo.gl/x')).toBe(false);
    expect(parseAI('nic tu nie ma')).toEqual([]);
  });
  it('kategorie po polsku i angielsku', () => {
    expect(guessCat('punkt widokowy')).toBe('view');
    expect(guessCat('Coffee shop')).toBe('cafe');
    expect(guessCat('coś')).toBe('other');
  });
});
