import type {
  CatalogueArticle,
  CategorieArticle,
  Unite,
} from "@/lib/catalogue/types";

// Seed initial du catalogue — reconstitué depuis catalogue-vde.md (entité FR, €).
// Coûts de revient HT. Les prix marqués (?) → a_confirmer: true (à valider par
// Oury dans l'onglet Catalogue).
// TODO: brancher données réelles — valider/corriger les prix « à confirmer ».

interface Opts {
  a_confirmer?: boolean;
  inclus?: boolean;
}

export function buildCatalogueSeed(now: Date): CatalogueArticle[] {
  const ts = now.toISOString();
  let n = 0;
  const art = (
    designation: string,
    categorie: CategorieArticle,
    unite: Unite,
    cout_ht: number,
    o: Opts = {},
  ): CatalogueArticle => ({
    id: `CAT-${String(++n).padStart(3, "0")}`,
    designation,
    categorie,
    unite,
    cout_ht,
    cout_ma: null, // prix MA dérivé du taux tant qu'il n'est pas surchargé
    url_produit: null, // TODO: brancher données réelles — fiches produit du site VDE
    afficher_qr: false,
    entite: "FR",
    actif: true,
    a_confirmer: o.a_confirmer ?? false,
    inclus_defaut: o.inclus ?? false,
    note: null,
    created_at: ts,
    updated_at: ts,
  });

  return [
    // ── Bornes (sûr) ──
    art("V2C Trydan 7 kW", "borne", "u", 599),
    art("V2C Trydan triphasé 11-22 kW", "borne", "u", 650),
    art("Ohme ePod S 7 kW (lot ×15)", "borne", "u", 500),
    art("Ohme ePod S 7 kW (×1)", "borne", "u", 430),
    art("Smappee EV Wall 7,4 kW", "borne", "u", 1100),
    art("Witty One IP55 7 kW + Hager", "borne", "u", 700),
    art("OHME ePod S 22 kW 4G", "borne", "u", 555),

    // ── Main d'œuvre — pose (forfait, mono / tri par distance) ──
    art("Pose P1 · 0-5 m · Monophasé", "pose", "forfait", 350),
    art("Pose P1 · 0-5 m · Triphasé", "pose", "forfait", 450),
    art("Pose P2 · 5-10 m · Monophasé", "pose", "forfait", 450),
    art("Pose P2 · 5-10 m · Triphasé", "pose", "forfait", 550),
    art("Pose P3 · 10-15 m · Monophasé", "pose", "forfait", 550),
    art("Pose P3 · 10-15 m · Triphasé", "pose", "forfait", 650),
    art("Pose P4 · 15-20 m · Monophasé", "pose", "forfait", 650),
    art("Pose P4 · 15-20 m · Triphasé", "pose", "forfait", 750),
    art("Pose P5 · 20-25 m · Monophasé", "pose", "forfait", 750),
    art("Pose P5 · 20-25 m · Triphasé", "pose", "forfait", 850),
    art("Pose P6 · 25-30 m · Monophasé", "pose", "forfait", 850),
    art("Pose P6 · 25-30 m · Triphasé", "pose", "forfait", 950),
    art("Pose P7 · > 30 m · Monophasé", "pose", "forfait", 950),
    art("Pose P7 · > 30 m · Triphasé", "pose", "forfait", 950, { a_confirmer: true }),
    art("Schéma électrique", "option", "forfait", 100, { a_confirmer: true }),

    // ── Tableau électrique (à confirmer) ──
    art("Mise en conformité tableau — N1", "tableau", "forfait", 220, { a_confirmer: true }),
    art("Mise en conformité tableau — N2", "tableau", "forfait", 340, { a_confirmer: true }),
    art("Mise en conformité tableau — N3", "tableau", "forfait", 540, { a_confirmer: true }),
    art("Fourniture + pose tableau — N1", "tableau", "forfait", 340, { a_confirmer: true }),
    art("Fourniture + pose tableau — N2", "tableau", "forfait", 740, { a_confirmer: true }),
    art("Fourniture + pose tableau — N3", "tableau", "forfait", 1550, { a_confirmer: true }),

    // ── Mise à la terre < 100 Ω (à confirmer) ──
    art("Mise à la terre — sans tranchée", "terre", "forfait", 195, { a_confirmer: true }),
    art("Mise à la terre — avec tranchée / raccordement", "terre", "forfait", 545, { a_confirmer: true }),

    // ── Options & Consuel ──
    art("Attestation Consuel IRVE", "option", "forfait", 165),

    // ── Consommables & suppléments (à confirmer) ──
    art("Visserie & fixations", "consommable", "u", 15, { a_confirmer: true, inclus: true }),
    art("Disjoncteur + bloc différentiel monophasé 40 A IRVE", "consommable", "u", 149.99, { a_confirmer: true, inclus: true }),
    art("Disjoncteur + bloc différentiel 40 3P+N IRVE (tri)", "consommable", "u", 309.99, { a_confirmer: true, inclus: true }),
    art("Traversée de mur", "consommable", "u", 55, { a_confirmer: true }),
    art("Protection IP66 extérieur", "consommable", "u", 80, { a_confirmer: true }),
    art("Socle béton borne sur pied", "consommable", "u", 180, { a_confirmer: true }),
    art("Passage enterré (fourreau)", "consommable", "u", 35, { a_confirmer: true }),
    art("Câble 5G10 10 mm² (fourniture + pose)", "consommable", "m", 11, { a_confirmer: true }),
    art("Pied de borne V2C Trydan", "consommable", "u", 199, { a_confirmer: true }),
    art("Gaine souple ICTA 32 mm", "consommable", "m", 9, { a_confirmer: true }),
    art("Câble 5G10 R02V 10 mm²", "consommable", "m", 10, { a_confirmer: true }),
    art("Goulotte blanche 40×40 mm", "consommable", "m", 18, { a_confirmer: true }),
    art("Tube IRL 32 mm", "consommable", "m", 10, { a_confirmer: true }),
    art("Câble 3G10 R02V 10 mm²", "consommable", "m", 9, { a_confirmer: true }),
    art("Tore/pince ampèremétrique panneaux PV", "consommable", "u", 25, { a_confirmer: true }),
    art("Câble mono 3G10 — supplément au-delà forfait", "consommable", "m", 9, { a_confirmer: true }),

    // ── Frais de déplacement (à confirmer) ──
    art("Déplacement 30-60 km", "deplacement", "forfait", 60, { a_confirmer: true }),
    art("Déplacement 60-100 km", "deplacement", "forfait", 120, { a_confirmer: true }),
  ];
}
