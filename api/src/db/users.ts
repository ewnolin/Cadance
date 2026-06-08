import { db } from './index';

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

/** Public-safe shape — never leaks password_hash. */
export interface PublicUser {
  id: number;
  email: string;
  created_at: string;
  updated_at: string;
}

export function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

export function getUserByEmail(email: string): UserRow | undefined {
  return db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(email) as UserRow | undefined;
}

export function getUserById(id: number): UserRow | undefined {
  return db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(id) as UserRow | undefined;
}

/** Inserts a user. Throws on UNIQUE(email) violation. */
export function createUser(email: string, passwordHash: string): number {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      'INSERT INTO users (email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)'
    )
    .run(email, passwordHash, now, now);
  return Number(info.lastInsertRowid);
}

export function updatePassword(id: number, passwordHash: string): void {
  db.prepare(
    'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?'
  ).run(passwordHash, new Date().toISOString(), id);
}

export function updateEmail(id: number, email: string): void {
  db.prepare('UPDATE users SET email = ?, updated_at = ? WHERE id = ?').run(
    email,
    new Date().toISOString(),
    id
  );
}

/** Hard-deletes the user. Related rows cascade once their FKs exist. */
export function deleteUser(id: number): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}
