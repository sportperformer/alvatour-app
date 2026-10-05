# AlvaTour

Osobista mapa podróży w formie aplikacji webowej (PWA). Obracany glob z konturami krajów, stemple w paszporcie, lista marzeń, miejsca z Google Maps, plan od AI, rangi, odznaki i gry.

Działa w przeglądarce i po instalacji na telefonie (także offline). Dane zapisują się tylko na urządzeniu, bez serwera. Kopię zapasową robisz w Ustawieniach (plik JSON).

## Funkcje

- Glob 3D: obracanie, przybliżanie, wyszukiwarka krajów, linie podróży z domu
- Kraje: „Byłem tu” (stempel), rok pierwszej wizyty, kolejne wizyty, ocena, notatki, „Chcę tu pojechać” z odliczaniem do wyjazdu
- Miejsca: restauracje, kawiarnie, zabytki, widoki itd. jako pinezki na globie
  - Android: w Google Maps **Udostępnij → AlvaTour** (po zainstalowaniu aplikacji)
  - albo wklejenie tekstu lub linku z Google Maps, albo wyszukanie po nazwie (OpenStreetMap)
- Plan od AI: gotowy prompt dla Claude, Gemini lub ChatGPT, a odpowiedź (Udostępnij → AlvaTour albo wklejenie) zamienia się w listę miejsc „do odwiedzenia”
- Paszport ze stemplami, statystyki, 10 rang, ponad 35 odznak
- Zabawa: ruletka podróży, quiz „Gdzie to jest?”, wehikuł czasu, karta podróżnika (obrazek do udostępnienia)

## Publikacja na GitHub Pages

1. Utwórz repozytorium (np. `alvatour`) i wrzuć do niego całą zawartość tego folderu (plik `index.html` w głównym katalogu).
2. W repozytorium: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, gałąź `main`, folder `/ (root)`, **Save**.
3. Po 1-2 minutach aplikacja będzie pod adresem `https://<konto>.github.io/alvatour/`.

## Instalacja na telefonie (Android)

1. Otwórz adres w Chrome.
2. Menu (⋮) → **Zainstaluj aplikację** (albo „Dodaj do ekranu głównego”).
3. Od teraz AlvaTour jest na liście „Udostępnij” w Google Maps oraz w aplikacjach Claude i Gemini.

## Aktualizacje

Po każdej zmianie plików podbij wersję w `sw.js` (stała `CACHE`), żeby telefon pobrał nową wersję. Aplikacja zaktualizuje się przy kolejnym uruchomieniu.

## Struktura

Wszystkie pliki leżą w jednym folderze (łatwe wrzucanie przez stronę GitHuba):

```
index.html                 widok aplikacji
app.css                    wygląd (jasny i ciemny motyw)
core.js                    stan, zapis, dźwięki, rangi, odznaki
globe.js                   glob (canvas, d3-geo)
panel.js                   karta kraju, stemple
views.js                   lista, paszport, statystyki, ustawienia, wyszukiwarka
fun.js                     ruletka, quiz, wehikuł czasu, karta podróżnika
places.js                  miejsca, Google Maps, plan od AI
main.js                    start aplikacji
countries.json             granice krajów (Natural Earth 1:50m, polskie nazwy)
meta.json                  stolice, waluty, języki, sąsiedzi
d3.min.js, topojson-client.min.js   biblioteki
sw.js                      praca offline
manifest.webmanifest       instalacja i udostępnianie do aplikacji
icon-*.png                 ikony
```

## Źródła danych

- Granice: Natural Earth przez pakiet `world-atlas` (domena publiczna)
- Dane o krajach: pakiet `world-countries` (ODbL)
- Wyszukiwarka adresów: OpenStreetMap Nominatim i Photon (limit 1 zapytanie na sekundę)
