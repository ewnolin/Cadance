import argon2 from 'argon2';

// argon2id ONLY (per project policy). These cost parameters are sane defaults
// for a self-hosted server; raise memoryCost if the host has RAM to spare.
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 1,
};

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  hash: string,
  password: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    // Malformed hash, etc. — treat as a failed verification rather than a 500.
    return false;
  }
}

// A fixed dummy hash verified when no user is found, so login timing does not
// reveal whether an email is registered (mitigates user enumeration).
let dummyHash: string | null = null;
export async function getDummyHash(): Promise<string> {
  if (!dummyHash) {
    dummyHash = await hashPassword('cadance-timing-equalizer-not-a-real-password');
  }
  return dummyHash;
}
