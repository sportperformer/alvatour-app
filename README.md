# AlvaTour

Osobista mapa podróży jako aplikacja Android (APK, Capacitor). Obracany glob z konturami krajów, stemple w paszporcie, lista marzeń, miejsca z Google Maps, plan od AI, rangi, odznaki i gry.

Dane zapisują się tylko na telefonie, w prywatnej pamięci aplikacji. Nic nie jest publikowane w sieci (GitHub Pages jest wyłączone i ma takie zostać).

## Dwie wersje aplikacji

| | AlvaTour | AlvaTour DEV |
|---|---|---|
| Identyfikator | `pl.sportperformer.alvatour` (nigdy się nie zmienia) | `pl.sportperformer.alvatour.dev` |
| Do czego | codzienne używanie, prawdziwe dane | testowanie nowych funkcji |
| Dane | własne | osobne, niezależne od wersji produkcyjnej |
| Ikona | globus | globus z pomarańczowym paskiem DEV |

## Wydania

Workflow `.github/workflows/android.yml`:

- **pull request:** testy i kontrolny build,
- **push do `main`:** testy, podpisane APK, **wersja testowa** w GitHub Releases (`v1.0.0-test.<nr>`),
- **ręcznie, z zaznaczonym „produkcja”:** wersja produkcyjna (`v1.0.0`). Najpierw trzeba podnieść wersję w `package.json` i dopisać sekcję w `CHANGELOG.md`.

Jeśli testy nie przejdą, nie ma buildu ani wydania. Każdy build sprawdza, czy APK jest podpisany zawsze tym samym kluczem (odcisk w `android/signing-cert-sha256.txt`).

Sekrety repozytorium (Settings → Secrets and variables → Actions):

- `ALVATOUR_KEYSTORE_BASE64`: klucz podpisu zakodowany base64,
- `ALVATOUR_KEYSTORE_PASSWORD`: hasło klucza.

Klucz podpisu **nigdy** nie trafia do repozytorium i **nigdy** nie generujemy nowego dla wersji produkcyjnej.

## Praca lokalna

```
npm ci
npm test            # testy
npm run serve       # podgląd w przeglądarce: http://127.0.0.1:5173
npm run sync        # www/ + synchronizacja z projektem Android
python3 scripts/make-icons.py   # ikony prod i DEV z assets/
```

## Struktura

```
src/                       pliki aplikacji (trafiają do www/ i do APK)
  index.html, app.css      widok i wygląd (jasny i ciemny motyw)
  core.js                  stan, zapis, dźwięki, rangi, odznaki
  globe.js                 glob (canvas, d3-geo)
  panel.js                 karta kraju, stemple
  views.js                 lista, paszport, statystyki, ustawienia
  fun.js                   ruletka, quiz, wehikuł czasu, karta podróżnika
  places.js                miejsca, Google Maps, plan od AI
  main.js                  start aplikacji
  countries.json, meta.json  granice i dane krajów
  vendor/                  d3, topojson-client
  fonts/                   czcionki (lokalnie, bez Google Fonts)
android/                   projekt Android (Capacitor)
assets/                    ikony źródłowe
scripts/                   build www/, ikony, opis wydań
tests/                     testy (Vitest)
CHANGELOG.md               historia zmian po polsku
```

## Źródła danych

- Granice: Natural Earth przez pakiet `world-atlas` (domena publiczna)
- Dane o krajach: pakiet `world-countries` (ODbL)
- Czcionki: Fontsource (licencje w `src/fonts/LICENSE.txt`)
- Wyszukiwarka adresów: OpenStreetMap Nominatim i Photon (limit 1 zapytanie na sekundę)
