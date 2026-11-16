/**
 * Tiny signed session token: `<expiresAtMs>.<hmac>`. Web Crypto only, so it runs
 * in Workers and Node alike.
 */

const encoder = new TextEncoder();

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signSession(secret: string, expiresAt: number): Promise<string> {
  const payload = `admin:${expiresAt}`;
  return `${expiresAt}.${await hmac(secret, payload)}`;
}

export async function verifySession(secret: string, token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const [expires, sig] = token.split(".");
  const expiresAt = Number(expires);
  if (!sig || !Number.isFinite(expiresAt) || expiresAt <= now) return false;
  return safeEqual(sig, await hmac(secret, `admin:${expiresAt}`));
}

/** Compare a submitted passcode without leaking timing (compares HMACs of both). */
export async function passcodeMatches(secret: string, submitted: string, expected: string): Promise<boolean> {
  if (!expected) return false;
  return safeEqual(await hmac(secret, submitted), await hmac(secret, expected));
}
