import type { Profile } from "@/lib/roles/types";

// Équipe de construction. Oury et Shaima sont les deux comptes réels du
// cockpit ; les autres sont des comptes de DÉMONSTRATION (`demo: true`),
// affichés comme tels dans l'écran Équipe pour qu'aucun ne soit pris pour un
// salarié. Ils existent pour prouver le cloisonnement à l'écran (deux
// techniciens, deux pays) — un cloisonnement qu'on ne peut pas démontrer avec
// un seul utilisateur.
// TODO: brancher données réelles — à l'activation de l'auth, les profils
// viendront de `auth.users` et ces comptes de démo seront supprimés.

function profil(p: Partial<Profile> & Pick<Profile, "id" | "nom" | "email">): Profile {
  return {
    role: null,
    entite: null,
    actif: true,
    overrides: {},
    demo: true,
    modifie_par: null,
    modifie_le: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...p,
  };
}

export function buildProfilesSeed(): Profile[] {
  return [
    profil({
      id: "u-oury",
      nom: "Oury",
      email: "oury@visiondigitalenergies.fr",
      role: "admin",
      entite: "ALL",
      demo: false,
    }),
    profil({
      id: "u-shaima",
      nom: "Shaima",
      email: "shaima@visiondigitalenergies.fr",
      role: "assistante",
      entite: "FR",
      demo: false,
    }),
    profil({
      id: "u-demo-ca-fr",
      nom: "Nadia (démo)",
      email: "demo.ca.fr@example.test",
      role: "charge_affaires",
      entite: "FR",
    }),
    profil({
      id: "u-demo-ca-ma",
      nom: "Youssef (démo)",
      email: "demo.ca.ma@example.test",
      role: "charge_affaires",
      entite: "MA",
    }),
    profil({
      id: "u-demo-ct-fr",
      nom: "Marc (démo)",
      email: "demo.ct.fr@example.test",
      role: "conducteur_travaux",
      entite: "FR",
    }),
    profil({
      id: "u-demo-tech-fr",
      nom: "Julien (démo)",
      email: "demo.tech.fr@example.test",
      role: "technicien",
      entite: "FR",
    }),
    profil({
      id: "u-demo-tech-fr-2",
      nom: "Damien (démo)",
      email: "demo.tech2.fr@example.test",
      role: "technicien",
      entite: "FR",
    }),
    profil({
      id: "u-demo-tech-ma",
      nom: "Karim (démo)",
      email: "demo.tech.ma@example.test",
      role: "technicien",
      entite: "MA",
    }),
  ];
}
