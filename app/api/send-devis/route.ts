import { NextResponse } from "next/server";

// Envoi d'un document (devis / facture) au client via Resend.
// La clé RESEND_API_KEY est lue UNIQUEMENT ici (route serveur) : elle n'est
// jamais exposée au navigateur ni committée. Sans clé, la route répond 503 avec
// `configured: false` et l'UI bascule sur le fallback mailto:.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Indique à l'UI si l'envoi automatique est disponible. */
export async function GET() {
  return NextResponse.json({ configured: Boolean(process.env.RESEND_API_KEY) });
}

export async function POST(request: Request) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        error: "Envoi automatique indisponible (RESEND_API_KEY absente).",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corps invalide." }, { status: 400 });
  }

  const { to, sujet, texte, from } = (body ?? {}) as Record<string, unknown>;
  if (
    typeof to !== "string" ||
    typeof sujet !== "string" ||
    typeof texte !== "string" ||
    typeof from !== "string" ||
    !EMAIL_RE.test(to)
  ) {
    return NextResponse.json(
      { ok: false, error: "Destinataire ou contenu manquant/invalide." },
      { status: 400 },
    );
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject: sujet, text: texte }),
  });

  if (!res.ok) {
    // On ne renvoie jamais la clé ni les en-têtes — seulement le motif côté Resend.
    const detail = await res.text().catch(() => "");
    return NextResponse.json(
      { ok: false, error: `Envoi refusé (${res.status}).`, detail: detail.slice(0, 300) },
      { status: 502 },
    );
  }

  const data = (await res.json().catch(() => ({}))) as { id?: string };
  return NextResponse.json({ ok: true, id: data.id ?? null });
}
