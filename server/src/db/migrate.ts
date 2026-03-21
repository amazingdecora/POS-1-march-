import { readFileSync } from 'fs';
import { join } from 'path';
import bcrypt from 'bcryptjs';
import { pool } from '../lib/pool';

function runSqlFile (relativePath: string): Promise<unknown> {
  const full = join(__dirname, '..', '..', 'sql', relativePath);
  const sql = readFileSync(full, 'utf8');
  return pool.query(sql);
}

export async function runMigrations (): Promise<void> {
  await runSqlFile('001_init.sql');
  await runSqlFile('002_seed.sql');

  const password = process.env.ADMIN_DEFAULT_PASSWORD ?? 'admin123';
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO admins (username, password_hash) VALUES ($1, $2)
     ON CONFLICT (username) DO NOTHING`,
    ['admin', hash]
  );
  console.log('Database migrations and seed completed.');
}
