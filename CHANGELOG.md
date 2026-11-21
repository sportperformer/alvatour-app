# Historia zmian AlvaTour

Każda wersja ma tu sekcję `## <wersja>`. Jej treść trafia do opisu wydania w GitHub Releases.

## 1.2.3

- **Dodawanie miejsc do planu**: na końcu listy przycisk „Dodaj miejsce do planu”. Wpisz nazwę lub adres (albo wklej tekst udostępniony z Google Maps) i kliknij „Szukaj”, albo użyj „Tu, gdzie jestem”, gdy stoisz przy miejscu. Wybierasz kategorię z planu lub tworzysz nową i możesz dopisać opis. Nowe miejsce od razu pojawia się na liście i na mapie
- **Usuwanie miejsca z planu**: po rozwinięciu miejsca przycisk „Usuń z planu”, z potwierdzeniem. Tuż przed usunięciem powstaje kopia zapasowa, a przez kilka sekund można kliknąć „Cofnij”. Odwiedzone miejsce zostaje w Twoich miejscach
- Ponowny import tej samej mapy z Google Moje Mapy zachowuje miejsca dodane ręcznie i nie przywraca usuniętych
- Przed usunięciem całego planu też powstaje kopia zapasowa

## 1.2.2

- **Poprawka: pełny opis miejsca w planie.** Kliknięcie nazwy miejsca na liście rozwija szczegóły: cały opis, kategorię oraz przyciski „Pokaż na mapie” i „Google Maps”. Ponowne kliknięcie zwija. Strzałka przy nazwie pokazuje, że można rozwinąć

## 1.2.1

- **Moja pozycja na mapie planu**: przycisk z celownikiem w prawym dolnym rogu mapy pokazuje, gdzie jesteś (niebieska kropka), i śledzi Cię, dopóki plan jest otwarty
- Przy każdym nieodwiedzonym miejscu na liście **odległość od Ciebie** (np. 350 m, 1,2 km), aktualizowana na bieżąco
- Za pierwszym razem Android zapyta o zgodę na lokalizację (wybierz „Podczas używania aplikacji”). Pozycja nie jest nigdzie zapisywana ani wysyłana, a śledzenie wyłącza się po wyjściu z planu lub z aplikacji
- **Gdy lokalizacja w telefonie jest wyłączona**, AlvaTour sam pokazuje okno Androida „Włączyć lokalizację?”: wystarczy kliknąć OK
- **Trasa piesza w AlvaTour, bez przechodzenia do Google Maps**: przycisk „Trasa” przy miejscu (i w dymku na mapie) rysuje na mapie trasę od Ciebie do tego miejsca, z czasem dojścia, odległością i wskazówkami krok po kroku po polsku
- **Trasa po nieodwiedzonych**: jedna trasa przez wszystkie jeszcze nieodwiedzone miejsca, zawsze do najbliższego następnego; piny dostają numery kolejności. Gdy jesteś daleko (np. jeszcze w Polsce), trasa startuje z pierwszego miejsca planu (np. noclegu), żeby można ją było obejrzeć przed wyjazdem
- „Przelicz od miejsca, gdzie jestem” odświeża trasę w trakcie zwiedzania; „Google Maps” otwiera tę samą trasę w Google Maps, gdyby była potrzebna nawigacja głosowa. Trasy liczy OpenStreetMap (bez dodatkowych ustawień i kosztów)

## 1.2.0

- **Nowa zakładka „Plany”: plany zwiedzania z Google Moje Mapy.** Wklejasz link do swojej mapy, a AlvaTour pobiera wszystkie piny z kategoriami, kolorami i opisami, sama ustala ich położenie po adresie i pokazuje je na **mapie Google**
- Przy każdym miejscu **checkbox**: odhaczone miejsce blednie na liście i na mapie, a licznik pokazuje postęp (np. 7 / 31). Filtr „Tylko nieodwiedzone”
- Przycisk **Prowadź** otwiera nawigację pieszą w Google Maps
- Odhaczone miejsca trafiają też do Twoich miejsc i statystyk (kraj dostaje stempel). Plany są w bazie, w kopiach zapasowych i w eksporcie
- Ponowny import tej samej mapy zachowuje odhaczenia

## 1.1.1

- **Planowana podróż** (lista marzeń): zamiast kalendarza wybór dzień / miesiąc / rok; wystarczy sam rok albo miesiąc. Odliczanie dopasowane: „Za 24 dni”, „Za 6 miesięcy”, „W tym roku!”, a na górze np. „w kwietniu 2027”
- **Odliczanie na górze ekranu można wyłączyć**: w Ustawieniach (Mapa) albo przełącznikiem w karcie kraju z listy marzeń

## 1.1.0

- **Daty z dniem i miesiącem (opcjonalnie)**: w kraju (pierwszy raz i kolejne wizyty) oraz w miejscach możesz wybrać pełną datę (np. 15.04.2024), sam miesiąc i rok albo tylko rok, gdy nie pamiętasz dokładnie
- **Paszport i lista „Odwiedzone”**: kraje z tego samego roku ułożone od najdawniej odwiedzonego (dokładna data przed samym rokiem); na liście widać dokładną datę
- Poprawka: konfetti nie zostaje już „zamrożone” na ekranie (np. po wyjściu z aplikacji i powrocie)

## 1.0.1

- Aktualizacja formatu danych (schemat 2): data ostatniej zmiany każdego kraju i miejsca. Przygotowanie pod przyszłe funkcje (np. „ostatnio edytowane”). Twoje dotychczasowe dane zostają bez zmian, a przed aktualizacją powstaje kopia `pre-migration-v1-to-v2-….json`
- Automatyczny test aktualizacji na emulatorze: poprzednia wersja z danymi → nowa wersja → te same dane
- **Aktualizacja w aplikacji bez przeglądarki**: „Sprawdź aktualizację” → „Pobierz i zainstaluj” pobiera plik wewnątrz AlvaTour (z paskiem postępu), sprawdza go (kompletność, suma kontrolna, ta sama aplikacja, Twój klucz podpisu) i otwiera okno „Aktualizuj”. Omija błąd Chrome, w którym pobieranie APK z GitHuba zawiesza się na 100%
- Poprawka: tymczasowa pozycja pinezki na ekranie nie jest już zapisywana w bazie i kopiach (mniej zbędnych zapisów przy obracaniu globu)

## 1.0.0

- AlvaTour jako aplikacja Android (APK), bez instalacji przez Chrome
- Dwie wersje obok siebie: **AlvaTour** i **AlvaTour DEV** (testowa, osobne dane, ikona z paskiem DEV)
- Czcionki i biblioteki wbudowane w aplikację: działa w pełni offline (poza wyszukiwarką adresów)
- Usunięty service worker (to on kasował pamięć innych aplikacji z tej samej domeny)
- Dane w bazie SQLite wewnątrz aplikacji, zapis od razu po każdej zmianie (każdy zapis w całości albo wcale)
- Kopie automatyczne w folderze **Documents/AlvaTour/kopie**: przy starcie (raz na dobę), przy wyjściu z aplikacji po zmianach (raz na godzinę), przed aktualizacją danych, przed wczytaniem kopii i przed usunięciem danych
- **Eksportuj wszystkie dane**: plik `alvatour-kopia-RRRR-MM-DD.json` i od razu okno „Udostępnij” (np. Dysk Google)
- **Wczytaj kopię z pliku**: podgląd zawartości przed wczytaniem, kopia obecnych danych przed zamianą, przycisk **Cofnij ostatnie wczytanie**
- **Kopie w telefonie**: lista kopii z możliwością przywrócenia
- Przypomnienie o kopii poza telefonem, jeśli od ostatniego eksportu minęło ponad 7 dni
- Gdy aplikacja jest pusta, a w telefonie jest kopia, AlvaTour zapyta, czy ją przywrócić
- Kopia Google (Auto Backup) obejmuje bazę danych
- Tryb bezpieczny: jeśli aktualizacja formatu danych by się nie udała, dane zostają nietknięte, a aplikacja nie zapisuje zmian
- **Udostępnij → AlvaTour** z Google Maps, Claude, Gemini i ChatGPT, także gdy AlvaTour była zamknięta
- Krótkie linki z Google Maps (maps.app.goo.gl) są rozwijane do dokładnych współrzędnych
- Prompt dla AI i karta podróżnika przez systemowe „Udostępnij”, kopiowanie przez schowek telefonu, wibracje przez silniczek telefonu
- Wyszukiwarka adresów: nagłówek AlvaTour, najwyżej 1 zapytanie na sekundę, zapamiętywanie wyników
- **Sprawdź aktualizację** w ustawieniach (GitHub Releases); wersja DEV widzi też wersje testowe
- Poprawki: nazwa miejsca z Google Maps nie powtarza się w adresie; zamknięcie okna w trakcie szukania nie powoduje błędu
