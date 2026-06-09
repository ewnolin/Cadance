import { db } from './index';

export interface Profile {
  user_id: number;
  display_name: string;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

/** Public attribution shape — what's safe to show next to shared content. */
export interface PublicProfile {
  user_id: number;
  display_name: string;
}

export interface ProfileInput {
  display_name: string;
  bio: string | null;
}

export function getProfile(userId: number): Profile | undefined {
  return db
    .prepare('SELECT * FROM profiles WHERE user_id = ?')
    .get(userId) as Profile | undefined;
}

/** Insert a default profile for a new user (neutral, non-identifying handle). */
export function createDefaultProfile(userId: number): Profile {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO profiles (user_id, display_name, bio, created_at, updated_at)
     VALUES (?, ?, NULL, ?, ?)`
  ).run(userId, `Lifter ${userId}`, now, now);
  return getProfile(userId)!;
}

/**
 * The user's profile, creating a default if somehow absent (e.g. a user that
 * predates auto-creation). Keeps attribution and the /profile route resilient.
 */
export function getOrCreateProfile(userId: number): Profile {
  return getProfile(userId) ?? createDefaultProfile(userId);
}

export function updateProfile(userId: number, input: ProfileInput): Profile {
  // Ensure a row exists, then update it.
  getOrCreateProfile(userId);
  db.prepare(
    'UPDATE profiles SET display_name = ?, bio = ?, updated_at = ? WHERE user_id = ?'
  ).run(input.display_name, input.bio, new Date().toISOString(), userId);
  return getProfile(userId)!;
}

/** Attribution for one author; falls back to a generated handle if missing. */
export function getPublicProfile(userId: number): PublicProfile {
  const p = getProfile(userId);
  return {
    user_id: userId,
    display_name: p?.display_name ?? `Lifter ${userId}`,
  };
}
