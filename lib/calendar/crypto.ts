import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Chiffrement des jetons OAuth — SERVEUR UNIQUEMENT (node:crypto).
// AES-256-GCM. La clé vient de CALENDAR_TOKEN_KEY (env serveur, jamais
// NEXT_PUBLIC, jamais committée) : 32 octets, en hex (64 car.) ou base64.
// Format stocké : base64( iv[12] | tag[16] | ciphertext ). Rien en clair en base.

function key(): Buffer {
  const raw = process.env.CALENDAR_TOKEN_KEY;
  if (!raw) throw new Error("CALENDAR_TOKEN_KEY absente (chiffrement des jetons impossible).");
  const buf =
    /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("CALENDAR_TOKEN_KEY invalide : 32 octets attendus (hex 64 car. ou base64).");
  }
  return buf;
}

/** true si la clé de chiffrement est configurée (sans la lire/loguer). */
export function chiffrementPret(): boolean {
  const raw = process.env.CALENDAR_TOKEN_KEY;
  if (!raw) return false;
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
