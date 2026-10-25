/**
 * Signed session cookie: `<userId>.<expiresAtSeconds>.<signature>`.
 *
 * The signature is an HMAC-SHA256 over `<userId>.<expiresAtSeconds>` using
 * SESSION_SECRET. Uses Web Crypto only, so the same code runs in the Node
 * runtime (API routes) and the Edge runtime (middleware).
 */

export const SESSION_COOKIE = "calibrate_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

const DEV_SECRET = "calibrate-dev-only-secret-change-me-0123456789";
const encoder = new TextEncoder();

export function getSessionSecret(
  env: Record<string, string | undefined> = process.env,
): string {
  const secret = env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET must be set to a random string of at least 32 characters in production.",
    );
  }
  return DEV_SECRET;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null;
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  try {
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

/** Create a signed cookie value for a user. User ids must not contain ".". */
export async function signSession(
  userId: string,
  secret: string,
  nowMs: number = Date.now(),
  ttlSeconds: number = SESSION_TTL_SECONDS,
): Promise<string> {
  if (!userId || userId.includes(".")) throw new Error("Invalid user id for session.");
  const expires = Math.floor(nowMs / 1000) + ttlSeconds;
  const payload = `${userId}.${expires}`;
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret, "sign"), encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(sig))}`;
}

/** Returns the user id for a valid, unexpired cookie value; otherwise null. */
export async function verifySession(
  token: string | undefined | null,
  secret: string,
  nowMs: number = Date.now(),
): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresText, sigText] = parts;
  if (!userId || !/^\d+$/.test(expiresText)) return null;
  if (Number(expiresText) <= Math.floor(nowMs / 1000)) return null;
  const sig = fromBase64Url(sigText);
  if (!sig) return null;
  // subtle.verify compares in constant time.
  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret, "verify"),
    sig,
    encoder.encode(`${userId}.${expiresText}`),
  );
  return valid ? userId : null;
}

export function sessionCookieOptions(env: Record<string, string | undefined> = process.env) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
