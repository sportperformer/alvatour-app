// Adapter bazy dla wtyczki @capacitor-community/sqlite (wywołania natywne, bez warstwy web).
export function createNativeDb(S, database = 'alvatour') {
  return {
    async open() {
      try {
        await S.createConnection({ database, version: 1, encrypted: false, mode: 'no-encryption', readonly: false });
      } catch (e) {
        // po przeładowaniu widoku połączenie natywne może już istnieć
        if (!/already exists/i.test(String((e && e.message) || e))) throw e;
      }
      await S.open({ database, readonly: false });
    },
    exec: (sql) => S.execute({ database, statements: sql, transaction: false, readonly: false, isSQL92: true }),
    run: (sql, values = []) => S.run({ database, statement: sql, values, transaction: false, readonly: false, returnMode: 'no', isSQL92: true }),
    all: async (sql, values = []) => (await S.query({ database, statement: sql, values, readonly: false, isSQL92: true })).values || [],
    begin: () => S.beginTransaction({ database }),
    commit: () => S.commitTransaction({ database }),
    rollback: () => S.rollbackTransaction({ database }),
  };
}
