const PASSWORD_HASH_PREFIX = 'pbkdf2-sha256';
const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derivePasswordHash(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    key,
    HASH_BYTES * 8
  );
  return new Uint8Array(bits);
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derivePasswordHash(password, salt, PBKDF2_ITERATIONS);
  return [
    PASSWORD_HASH_PREFIX,
    String(PBKDF2_ITERATIONS),
    bytesToBase64(salt),
    bytesToBase64(hash),
  ].join('$');
}

export async function verifyStoredPassword(
  password: string,
  storedValue: string
): Promise<{ valid: boolean; needsUpgrade: boolean }> {
  if (!storedValue.startsWith(`${PASSWORD_HASH_PREFIX}$`)) {
    const valid = constantTimeEqual(
      new TextEncoder().encode(password),
      new TextEncoder().encode(storedValue)
    );
    return { valid, needsUpgrade: valid };
  }

  try {
    const [prefix, iterationsText, saltText, expectedHashText] =
      storedValue.split('$');
    const iterations = Number(iterationsText);
    if (
      prefix !== PASSWORD_HASH_PREFIX ||
      !Number.isSafeInteger(iterations) ||
      iterations < 1
    ) {
      return { valid: false, needsUpgrade: false };
    }

    const actualHash = await derivePasswordHash(
      password,
      base64ToBytes(saltText),
      iterations
    );
    const valid = constantTimeEqual(
      actualHash,
      base64ToBytes(expectedHashText)
    );
    return {
      valid,
      needsUpgrade: valid && iterations < PBKDF2_ITERATIONS,
    };
  } catch {
    return { valid: false, needsUpgrade: false };
  }
}
