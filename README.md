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

## Dane i kopie zapasowe

- Baza SQLite w prywatnej pamięci aplikacji. Jedyny moduł, który ją czyta i zapisuje: `src/data/` (repozytorium danych). Kod interfejsu korzysta tylko z `window.AlvaData`.
- Każdy zapis w transakcji. Zapisywane są tylko zmiany. Przed usunięciem 3+ krajów lub miejsc naraz: automatyczna kopia.
- Migracje (`src/data/schema.js`) tylko dodają. Przed migracją: kopia `pre-migration-v<N>-to-v<N+1>-<data>.json`, po migracji: kontrola liczności, przy błędzie wycofanie i tryb bezpieczny.
- Kopie: `Documents/AlvaTour/kopie` (wariant DEV: `Documents/AlvaTour-DEV/kopie`) oraz pamięć aplikacji (objęta kopią Google). Rotacja: 14 dni kopii dziennych, kopie przedmigracyjne/przed importem 90 dni. Eksporty ręczne nie są nigdy usuwane.
- Format pliku kopii: `app`, `format_version`, `schema_version`, `exported_at`, `app_version`, `counts`, `checksum`, `data`. Import przyjmuje też eksport z wersji webowej i surowy stan z przeglądarki.
- Fixtures: `tests/fixtures/` (tylko sztuczne dane, repozytorium jest publiczne). Przy każdym wydaniu: `node scripts/make-fixture.mjs` i wpis w `expected.json`.

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
