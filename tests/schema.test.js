import { describe, it, expect } from 'vitest';
import { MIGRATIONS, SCHEMA_VERSION } from '../src/data/schema.js';

describe('zasady migracji', () => {
  it('numeracja od 1, kolejno, bez dziur', () => {
    MIGRATIONS.forEach((m, i) => expect(m.version).toBe(i + 1));
    expect(SCHEMA_VERSION).toBe(MIGRATIONS.length);
  });
  it('migracje tylko dodają: bez DROP, DELETE, UPDATE, RENAME, REPLACE', () => {
    for (const m of MIGRATIONS) {
      expect(m.name, `migracja ${m.version} bez nazwy`).toBeTruthy();
      for (const sql of m.statements) {
        expect(sql, `migracja ${m.version}`).not.toMatch(/\b(DROP|DELETE|UPDATE|RENAME|REPLACE|TRUNCATE)\b/i);
        expect(sql, `migracja ${m.version}`).toMatch(/^\s*(CREATE (TABLE|INDEX|UNIQUE INDEX) IF NOT EXISTS|ALTER TABLE \w+ ADD COLUMN)\b/i);
      }
    }
  });
  it('wydane migracje się nie zmieniają (dopisuj nowe, nie edytuj starych)', async () => {
    const { createHash } = await import('node:crypto');
    const RELEASED = {
      1: 'f647c49760718b0b436569a2497cc23324e597a979f84f118e6bc96bda702130',
    };
    for (const [v, hash] of Object.entries(RELEASED)) {
      const m = MIGRATIONS.find((x) => x.version === Number(v));
      expect(createHash('sha256').update(JSON.stringify(m.statements)).digest('hex'), `migracja ${v}`).toBe(hash);
    }
  });
});
