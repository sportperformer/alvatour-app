import { describe, it, expect } from 'vitest';
import { routeUrl, parseRoute, stepText, tourOrder, googleDirUrl } from '../src/maps/route.js';

// odpowiedź w formacie OSRM v5 (jak routing.openstreetmap.de/routed-foot)
const osrm = {
  code: 'Ok',
  routes: [{
    distance: 812.4, duration: 584.9,
    geometry: { type: 'LineString', coordinates: [[24.106, 56.9465], [24.105, 56.948], [24.1043, 56.949], [24.1149, 56.9437]] },
    legs: [
      { distance: 320, duration: 230, steps: [
        { distance: 120, name: 'Kaļķu iela', maneuver: { type: 'depart', modifier: 'left' } },
        { distance: 150, name: 'Doma laukums', maneuver: { type: 'turn', modifier: 'right' } },
        { distance: 50, name: 'Doma laukums', maneuver: { type: 'continue', modifier: 'straight' } },
        { distance: 0, name: '', maneuver: { type: 'new name' } },
        { distance: 0, name: 'Doma laukums', maneuver: { type: 'arrive' } },
      ] },
      { distance: 492.4, duration: 354.9, steps: [
        { distance: 200, name: '', maneuver: { type: 'depart' } },
        { distance: 292.4, name: 'Nēģu iela', maneuver: { type: 'roundabout', exit: 2 } },
        { distance: 0, name: '', maneuver: { type: 'arrive' } },
      ] },
    ],
  }],
};

describe('trasy piesze (OpenStreetMap)', () => {
  it('adres zapytania: lng,lat; profil pieszy; pełna geometria i kroki', () => {
    const u = routeUrl([{ lat: 56.9465, lng: 24.106 }, { lat: 56.949, lng: 24.1043 }]);
    expect(u).toBe('https://routing.openstreetmap.de/routed-foot/route/v1/foot/24.106000,56.946500;24.104300,56.949000?overview=full&geometries=geojson&steps=true');
    expect(() => routeUrl([{ lat: 1, lng: 1 }])).toThrow(/dwóch/);
  });

  it('odczyt odpowiedzi: dystans, czas, ścieżka lat/lng, odcinki z polskimi krokami', () => {
    const r = parseRoute(osrm, ['Katedra', 'Hala']);
    expect(r.distance).toBeCloseTo(812.4);
    expect(r.path[0]).toEqual({ lat: 56.9465, lng: 24.106 });
    expect(r.legs).toHaveLength(2);
    expect(r.legs[0].steps.map((s) => s.text)).toEqual(['Ruszaj ulicą Kaļķu iela', 'Skręć w prawo w Doma laukums', 'Idź prosto: Doma laukums', 'Jesteś na miejscu: Katedra']);
    expect(r.legs[1].steps.map((s) => s.text)).toEqual(['Ruszaj', 'Na rondzie zjedź 2. zjazdem w Nēģu iela', 'Jesteś na miejscu: Hala']);
  });

  it('błędy po polsku', () => {
    expect(() => parseRoute({ code: 'NoRoute', routes: [] })).toThrow(/Nie znalazłem trasy pieszej/);
    expect(() => parseRoute(null)).toThrow(/Serwer tras/);
  });

  it('wskazówki: skręty, zawracanie, rozwidlenie', () => {
    expect(stepText({ name: 'Smilšu iela', maneuver: { type: 'turn', modifier: 'slight left' } })).toBe('Skręć lekko w lewo w Smilšu iela');
    expect(stepText({ name: '', maneuver: { type: 'end of road', modifier: 'uturn' } })).toBe('Zawróć');
    expect(stepText({ name: 'X', maneuver: { type: 'fork', modifier: 'sharp right' } })).toBe('Skręć ostro w prawo w X');
  });

  it('kolejność zwiedzania: zawsze najbliższe następne, pomija miejsca bez położenia, limit', () => {
    const start = { lat: 0, lng: 0 };
    const items = [{ id: 'c', lat: 0, lng: 0.03 }, { id: 'a', lat: 0, lng: 0.01 }, { id: 'x', lat: null, lng: null }, { id: 'b', lat: 0, lng: 0.02 }];
    expect(tourOrder(start, items).map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(tourOrder(start, items, 2).map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('link do Google Maps z tą samą trasą (cel + przystanki)', () => {
    const u = googleDirUrl({ lat: 1, lng: 2 }, [{ lat: 3, lng: 4 }, { lat: 5, lng: 6 }]);
    expect(u).toBe('https://www.google.com/maps/dir/?api=1&origin=1,2&destination=5,6&waypoints=3%2C4&travelmode=walking');
  });
});
