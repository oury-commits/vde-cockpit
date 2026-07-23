import type {
  CatalogueArticle,
  CategorieArticle,
  DomaineArticle,
  Unite,
} from "@/lib/catalogue/types";

// Seed initial du catalogue — reconstitué depuis catalogue-vde.md (entité FR, €).
// Coûts de revient HT. Les prix marqués (?) → a_confirmer: true (à valider par
// Oury dans l'onglet Catalogue).
// TODO: brancher données réelles — valider/corriger les prix « à confirmer ».

interface Opts {
  a_confirmer?: boolean;
  inclus?: boolean;
  /**
   * Coût MA surchargé (DH). Par défaut le MA dérive de `cout_ht × taux` ; on
   * l'épingle quand on veut caler un coût FR SANS bouger le prix marocain.
   */
  cout_ma?: number | null;
  /** Domaine métier (défaut IRVE). Le solaire est seedé en fin de liste. */
  domaine?: DomaineArticle;
  /** Puissance unitaire watt-crête (panneaux uniquement). */
  puissance_wc?: number | null;
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
    domaine: o.domaine ?? "irve",
    unite,
    cout_ht,
    cout_ma: o.cout_ma ?? null, // MA dérivé du taux, sauf surcharge explicite
    url_produit: null, // TODO: brancher données réelles — fiches produit du site VDE
    afficher_qr: false,
    puissance_wc: o.puissance_wc ?? null,
    entite: "FR",
    actif: true,
    a_confirmer: o.a_confirmer ?? false,
    inclus_defaut: o.inclus ?? false,
    note: null,
    created_at: ts,
    updated_at: ts,
  });

  // Raccourci solaire : domaine 'solaire' + « à confirmer » par défaut (prix
  // indicatifs, Oury cale au catalogue). `puissance_wc` porté par les panneaux.
  const sol = (
    designation: string,
    categorie: CategorieArticle,
    unite: Unite,
    cout_ht: number,
    o: Opts = {},
  ): CatalogueArticle =>
    art(designation, categorie, unite, cout_ht, {
      domaine: "solaire",
      a_confirmer: true,
      ...o,
    });

  return [
    // ── Bornes (sûr) ──
    // Borne standard IRVE résidentiel FR (mono 7,4 kW). Coût calé pour que le
    // pack standard (borne + pose 5 m câble inclus + disjoncteur + Consuel)
    // totalise 1 100 € HT de coût → ~1 692 € HT / ~1 785 € TTC à 35 % de marge.
    // Le prix reste DÉRIVÉ du coût (jamais 1 790 € en dur). `cout_ma` épinglé à
    // 6469 DH pour ne pas bouger le prix marocain (sinon dérivé de 420 × taux).
    art("V2C Trydan 7,4 kW", "borne", "u", 420, { cout_ma: 6469 }),
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
    art("Disjoncteur + bloc différentiel monophasé 40 A IRVE", "consommable", "u", 150, { a_confirmer: true, inclus: true }),
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

    // ════════════════════════════════════════════════════════════════════════
    //  SOLAIRE — photovoltaïque résidentiel (entité FR). Prix indicatifs marché
    //  2026, TOUS marqués « à confirmer » : Oury cale au catalogue. Marché 2026 :
    //  aucune aide (prime supprimée), rachat surplus ≈ 0 → l'offre = AUTOCONSO,
    //  d'où EMS + batterie centraux. Marge 45 % appliquée au devis (cout / 0,55).
    //  TODO: brancher données réelles — valider prix + fiches produit fournisseur.
    // ════════════════════════════════════════════════════════════════════════

    // ── Panneaux (puissance_wc → somme kWc du devis, garde-fou TVA 5,5 %) ──
    sol("Panneau Jinko Tiger Neo 630W bifacial", "panneau", "u", 81.54, { puissance_wc: 630 }),
    sol("Panneau standard 500W", "panneau", "u", 60, { puissance_wc: 500 }),

    // ── Onduleurs ──
    sol("Onduleur Huawei SUN2000-3KTL (3 kW mono)", "onduleur", "u", 550),
    sol("Onduleur Huawei SUN2000-5KTL (5 kW mono)", "onduleur", "u", 720),
    sol("Onduleur Huawei SUN2000-6KTL (6 kW mono)", "onduleur", "u", 820),
    sol("Onduleur Huawei SUN2000-8KTL (8 kW mono)", "onduleur", "u", 950),
    sol("Micro-onduleur Enphase IQ8P (par panneau)", "onduleur", "u", 100),

    // ── Gestionnaire d'énergie (EMS) — OBLIGATOIRE pour la TVA 5,5 % ──
    sol("Gestionnaire d'énergie / EMS (Huawei Smart Dongle + Power Sensor)", "ems", "u", 180),

    // ── Batterie (option clé : le surplus ne rapporte plus rien) ──
    sol("Batterie de stockage Huawei LUNA 5 kWh", "batterie", "u", 2200),

    // ── Structure & protection ──
    sol("Système de fixation (rail + crochets) — par panneau", "structure_pv", "u", 30),
    sol("Coffret de protection AC/DC (parafoudre, sectionneur DC)", "protection_pv", "forfait", 280),
    sol("Câblage solaire + connecteurs MC4", "protection_pv", "forfait", 150),

    // ── Pose (par kWc) — domaine solaire, distincte des poses IRVE ──
    sol("Pose & mise en service — par kWc", "pose", "u", 450),

    // ── Études ──
    sol("Étude technique & simulation de production (PVGIS)", "etude", "forfait", 150),
    sol("Étude de structure / note de calcul toiture", "etude", "forfait", 250),

    // ── Démarches (Consuel, convention autoconso Enedis, DP mairie) ──
    sol("Démarches administratives (DP mairie, Enedis, Consuel, convention)", "administratif", "forfait", 350),

    // ── Maintenance (option — revenu récurrent, pas d'abonnement construit) ──
    sol("Contrat de maintenance annuel — par an", "maintenance", "forfait", 90),
  ];
}
