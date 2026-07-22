// Valide le schéma de chiffrement des jetons (lib/calendar/crypto.ts) :
// AES-256-GCM, format base64(iv[12] | tag[16] | ciphertext). Round-trip,
// détection d'altération (auth tag), rejet d'une mauvaise clé.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY = randomBytes(32);
const enc = (pt, key = KEY) => {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(pt, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
};
const dec = (payload, key = KEY) => {
  const b = Buffer.from(payload, "base64");
  const d = createDecipheriv("aes-256-gcm", key, b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
};

let pass = 0, fail = 0;
const ok = (n, v) => { console.log(`  ${v ? "OK  " : "FAIL"} ${n}`); v ? pass++ : fail++; };

const secret = "ya29.a0AfakeRefreshToken-très-long-secret-42";
const payload = enc(secret);
ok("round-trip : dechiffre = original", dec(payload) === secret);
ok("le chiffré n'est PAS le clair (rien en clair)", !payload.includes(secret) && !Buffer.from(payload, "base64").toString("latin1").includes(secret));

// Altération d'un octet du ciphertext → l'auth tag GCM doit rejeter.
{
  const b = Buffer.from(payload, "base64");
  b[b.length - 1] ^= 0x01;
  let rejete = false;
  try { dec(b.toString("base64")); } catch { rejete = true; }
  ok("altération détectée (auth tag GCM)", rejete);
}

// Mauvaise clé → rejet.
{
  let rejete = false;
  try { dec(payload, randomBytes(32)); } catch { rejete = true; }
  ok("mauvaise clé → rejet", rejete);
}

console.log(`\nRÉSULTAT : ${pass} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
