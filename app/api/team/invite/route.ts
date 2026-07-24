import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Invitation d'un membre (auth réelle). SERVEUR uniquement :
// SUPABASE_SERVICE_ROLE_KEY (contourne la RLS) n'est lue qu'ici, jamais exposée
// au navigateur. L'ordre est imposé par la clé étrangère profiles.id →
// auth.users : on invite d'ABORD l'utilisateur Auth, puis on crée sa ligne
// profiles avec le MÊME uuid. Réservé aux administrateurs connectés.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ROLES = ["admin", "charge_affaires", "conducteur_travaux", "technicien", "assistante"];

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) {
    return NextResponse.json(
      {
        error:
          "Invitation automatique indisponible (SUPABASE_SERVICE_ROLE_KEY absente). Crée l'utilisateur dans Supabase Auth puis la ligne profiles à la main.",
      },
      { status: 501 },
    );
  }

  // 1. Vérifier que l'appelant est un ADMIN actif — AVANT de toucher la clé
  //    service. Le contrôle passe par le client RLS de l'utilisateur (son propre
  //    token) : il ne lit que sa PROPRE ligne (policy profiles_select :
  //    id = auth.uid()). La `service_role` n'est pas encore instanciée ici.
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const asUser = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: userData } = await asUser.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const { data: moi } = await asUser
    .from("profiles")
    .select("role, actif")
    .eq("id", uid)
    .maybeSingle();
  if (!moi || moi.role !== "admin" || !moi.actif) {
    return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
  }

  // 2. Valider l'entrée.
  const body = (await request.json().catch(() => ({}))) as {
    nom?: string;
    email?: string;
    role?: string | null;
    entite?: string | null;
  };
  const email = (body.email ?? "").trim().toLowerCase();
  const nom = (body.nom ?? "").trim();
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Email invalide." }, { status: 400 });
  const role = body.role && ROLES.includes(body.role) ? body.role : null;
  let entite = body.entite === "FR" || body.entite === "MA" || body.entite === "ALL" ? body.entite : null;
  if (entite === "ALL" && role !== "admin") entite = null; // ALL réservé à l'admin

  // 3. APPELANT ADMIN CONFIRMÉ : seulement maintenant on instancie la clé
  //    service (contourne la RLS) pour inviter l'utilisateur Auth puis créer sa
  //    ligne profiles avec le MÊME uuid.
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: invited, error: inviteErr } =
    await admin.auth.admin.inviteUserByEmail(email);
  if (inviteErr || !invited?.user?.id) {
    const msg = inviteErr?.message ?? "réponse vide";
    // Auto-diagnostic : « kid <nil> / ES256 / invalid JWT » = la clé service_role
    // fournie est une ANCIENNE clé legacy (eyJ…) que l'Auth ne vérifie plus depuis
    // la bascule aux clés de signature asymétriques. Il faut la clé secrète sb_secret_…
    const cleLegacy = /\bkid\b|ES256|invalid JWT|algorithm|signature/i.test(msg);
    const indice = cleLegacy
      ? " — Indice : SUPABASE_SERVICE_ROLE_KEY est probablement une ancienne clé JWT legacy (eyJ…). Depuis le passage aux clés asymétriques, renseigne la clé SECRÈTE « sb_secret_… » (Supabase → Project Settings → API)."
      : "";
    return NextResponse.json(
      { error: `Invitation Auth impossible : ${msg}${indice}` },
      { status: 502 },
    );
  }

  // 4. Créer la ligne profiles avec le MÊME uuid (deny par défaut si non assigné).
  const { data: profil, error: insErr } = await admin
    .from("profiles")
    .insert({
      id: invited.user.id,
      email,
      nom: nom || email,
      role,
      entite,
      actif: true,
      overrides: {},
      demo: false,
    })
    .select()
    .single();
  if (insErr) {
    return NextResponse.json(
      { error: `Ligne profiles impossible : ${insErr.message}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, profil });
}
