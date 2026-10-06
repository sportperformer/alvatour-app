// Schemat bazy SQLite i migracje.
//
// ZASADY (pilnowane testem tests/schema.test.js):
// - każda zmiana formatu danych to NOWA migracja z kolejnym numerem; istniejących migracji nie zmieniamy,
// - migracje tylko DODAJĄ (tabele, kolumny, indeksy); nigdy nie usuwają i nie nadpisują danych użytkownika,
// - stare kolumny zostają, nawet jeśli nowa wersja ich nie używa.

export const META_SQL = 'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT)';

export const MIGRATIONS = [
  {
    version: 1,
    name: 'Początkowy schemat: kraje, wizyty, miejsca, odznaki, ustawienia',
    statements: [
      `CREATE TABLE IF NOT EXISTS countries (
        id TEXT PRIMARY KEY NOT NULL,
        visited INTEGER NOT NULL DEFAULT 0,
        wish INTEGER NOT NULL DEFAULT 0,
        first_year INTEGER,
        notes TEXT NOT NULL DEFAULT '',
        rating INTEGER NOT NULL DEFAULT 0,
        planned_date TEXT NOT NULL DEFAULT '',
        added_at TEXT,
        extra TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS visits (
        country_id TEXT NOT NULL,
        pos INTEGER NOT NULL,
        year INTEGER,
        note TEXT NOT NULL DEFAULT '',
        extra TEXT,
        PRIMARY KEY (country_id, pos)
      )`,
      `CREATE TABLE IF NOT EXISTS places (
        id TEXT PRIMARY KEY NOT NULL,
        pos INTEGER NOT NULL DEFAULT 0,
        name TEXT NOT NULL,
        addr TEXT NOT NULL DEFAULT '',
        city TEXT NOT NULL DEFAULT '',
        cc TEXT NOT NULL DEFAULT '',
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        approx INTEGER NOT NULL DEFAULT 0,
        cat TEXT NOT NULL DEFAULT 'other',
        status TEXT NOT NULL DEFAULT 'visited',
        date TEXT NOT NULL DEFAULT '',
        rating INTEGER NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT '',
        url TEXT NOT NULL DEFAULT '',
        src TEXT NOT NULL DEFAULT '',
        added_at TEXT,
        extra TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS badges (
        id TEXT PRIMARY KEY NOT NULL,
        value TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS kv (
        section TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        PRIMARY KEY (section, key)
      )`,
    ],
  },
  {
    version: 2,
    name: 'Data ostatniej zmiany kraju i miejsca (updated_at), wydane w 1.0.1',
    statements: [
      'ALTER TABLE countries ADD COLUMN updated_at TEXT',
      'ALTER TABLE places ADD COLUMN updated_at TEXT',
    ],
  },
];

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;
