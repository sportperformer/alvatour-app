import { describe, it, expect } from 'vitest';
import { myMapsId, myMapsKmlUrl, parseKml, kmlColor } from '../src/native/parsers.js';

// Sztuczna mapa w formacie eksportu Moich Map (bez prawdziwych danych użytkownika).
const KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Wilno &amp; okolice</name>
    <description/>
    <Style id="icon-1534-FFD600-labelson"><IconStyle><color>ff00d6ff</color><scale>1</scale></IconStyle></Style>
    <Style id="icon-1598-9C27B0-labelson"><IconStyle><color>ffb0279c</color></IconStyle></Style>
    <StyleMap id="icon-1598-9C27B0"><Pair><key>normal</key><styleUrl>#icon-1598-9C27B0-labelson</styleUrl></Pair></StyleMap>
    <Folder>
      <name>Wilno</name>
      <Placemark>
        <name>Kawiarnia Pod Kogutem</name>
        <address>Kawiarnia Pod Kogutem Pilies g. 1, Vilnius</address>
        <description><![CDATA[Adres: Pilies g. 1, Vilnius<br>Kategoria: Kawiarnie<br>Opis: Najlepsze cepeliny &amp; kawa.]]></description>
        <styleUrl>#icon-1534-FFD600-labelson</styleUrl>
        <ExtendedData>
          <Data name="Adres"><value>Pilies g. 1, Vilnius</value></Data>
          <Data name="Kategoria"><value>Kawiarnie</value></Data>
          <Data name="Opis"><value>Najlepsze cepeliny &amp; kawa.</value></Data>
        </ExtendedData>
      </Placemark>
      <Placemark>
        <name>Ostra Brama</name>
        <styleUrl>#icon-1598-9C27B0</styleUrl>
        <Point><coordinates>25.2894,54.6744,0</coordinates></Point>
      </Placemark>
    </Folder>
  </Document>
</kml>`;

describe('Plany zwiedzania: import z Google Moje Mapy', () => {
  it('identyfikator mapy z linku', () => {
    expect(myMapsId('https://www.google.com/maps/d/u/0/edit?mid=1AbC-dEf_GhIjKlMnOp&usp=sharing')).toBe('1AbC-dEf_GhIjKlMnOp');
    expect(myMapsId('https://www.google.com/maps/d/viewer?mid=1AbC-dEf_GhIjKlMnOp')).toBe('1AbC-dEf_GhIjKlMnOp');
    expect(myMapsId('https://maps.app.goo.gl/xyz')).toBe(null);
    expect(myMapsKmlUrl('1AbC')).toBe('https://www.google.com/maps/d/kml?mid=1AbC&forcekml=1');
  });
  it('kolory pinów z Moich Map', () => {
    expect(kmlColor('icon-1603-E65100-labelson')).toBe('#e65100');
    expect(kmlColor('custom', 'ff0051e6')).toBe('#e65100');
  });
  it('miejsca, kategorie, opisy, kolory, warstwy; brak współrzędnych = null', () => {
    const p = parseKml(KML);
    expect(p.name).toBe('Wilno & okolice');
    expect(p.items).toEqual([
      { name: 'Kawiarnia Pod Kogutem', addr: 'Pilies g. 1, Vilnius', cat: 'Kawiarnie', desc: 'Najlepsze cepeliny & kawa.', color: '#ffd600', layer: 'Wilno', lat: null, lng: null },
      { name: 'Ostra Brama', addr: '', cat: 'Wilno', desc: '', color: '#9c27b0', layer: 'Wilno', lat: 54.6744, lng: 25.2894 },
    ]);
  });
  it('odrzuca coś, co nie jest mapą', () => {
    expect(() => parseKml('<html>Zaloguj się</html>')).toThrow(/KML/);
  });
});
