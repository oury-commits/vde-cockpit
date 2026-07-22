import { createHmac, timingSafeEqual } from "node:crypto";

// `state` OAuth signé — SERVEUR UNIQUEMENT. Porte l'identité de l'utilisateur
// à travers la redirection Google (le callback n'a pas de session) et sert
// d'anti-CSRF. Signé HMAC-SHA256 avec CALENDAR_TOKEN_KEY, expire vite.

const TTL_MS = 10 * 60 * 1000; // 10 min

function secret(): Buffer {
  const raw = process.env.CALENDAR_TOKEN_KEY ?? "";
  return /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function signState(userId: string, nowMs: number): string {
  const payload = b64url(Buffer.from(JSON.stringify({ u: userId, e: nowMs + TTL_MS })));
  const sig = b64url(createHmac("sha256", secret()).update(payload).digest());
  return `${payload}.${sig}`;
}

/** Renvoie l'userId si le state est valide et non expiré, sinon null. */
export function verifyState(state: string, nowMs: number): string | null {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = b64url(createHmac("sha256", secret()).update(payload).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { u, e } = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
    if (typeof e !== "number" || e < nowMs) return null;
    return typeof u === "string" ? u : null;
  } catch {
    return null;
  }
}
