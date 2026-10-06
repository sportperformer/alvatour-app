# Historia zmian AlvaTour

Każda wersja ma tu sekcję `## <wersja>`. Jej treść trafia do opisu wydania w GitHub Releases.

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
