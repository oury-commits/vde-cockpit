// Verrouille le CONTRAT de l'événement RDV (lib/calendar/event.ts) : titre
// « Client — Type · Borne », lieu = adresse, description = dossier + tél + lien
// « Y aller », attendee = technicien, fuseau par entité. Réplique la fonction
// pure en JS (le .mjs n'importe pas le TS) — à garder aligné avec event.ts.

const TYPE_LABEL = { pose: "Pose", visite_technique: "Visite technique", sav: "SAV" };
const TZ = { FR: "Europe/Paris", MA: "Africa/Casablanca" };

function mapsLink(adresse) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adresse)}`;
}

function buildRdvEvent(input) {
  const borne = input.borne ? ` · ${input.borne}` : "";
  const summary = `${input.clientNom} — ${TYPE_LABEL[input.type]}${borne}`;
  const maps = mapsLink(input.adresse);
  const description = [
    `Dossier : ${input.dossier}`,
    `Client : ${input.clientNom}`,
    `Tél. : ${input.telephone}`,
    `Technicien : ${input.technicienNom}`,
    "",
    `Y aller : ${maps}`,
    "",
    "Créé automatiquement par VDE Cockpit — piloté depuis le CRM.",
  ].join("\n");
  const tz = TZ[input.entite];
  return {
    summary,
    location: input.adresse,
    description,
    start: { dateTime: input.debut, timeZone: tz },
    end: { dateTime: input.fin, timeZone: tz },
    attendees: input.technicienEmail
      ? [{ email: input.technicienEmail, displayName: input.technicienNom }]
      : undefined,
    extendedProperties: { private: { vdeLeadId: input.dossier, vdeSource: "cockpit" } },
  };
}

let pass = 0, fail = 0;
const ok = (n, v) => { console.log(`  ${v ? "OK  " : "FAIL"} ${n}`); v ? pass++ : fail++; };

const base = {
  entite: "FR",
  type: "pose",
  clientNom: "Dupont Martin",
  borne: "7,4 kW",
  adresse: "12 rue des Lilas, 69003 Lyon",
  dossier: "FB-042",
  telephone: "06 12 34 56 78",
  debut: "2026-07-24T07:00:00.000Z",
  fin: "2026-07-24T09:00:00.000Z",
  technicienNom: "Julien",
  technicienEmail: "julien@visiondigitalenergies.fr",
};

const e = buildRdvEvent(base);
ok("titre = client + type + borne", e.summary === "Dupont Martin — Pose · 7,4 kW");
ok("lieu = adresse complète", e.location === "12 rue des Lilas, 69003 Lyon");
ok("description porte le n° de dossier", e.description.includes("FB-042"));
ok("description porte le tél. client", e.description.includes("06 12 34 56 78"));
ok("description porte le technicien", e.description.includes("Julien"));
ok("description porte le lien « Y aller » Maps",
  e.description.includes("Y aller :") && e.description.includes("google.com/maps/dir/"));
ok("l'adresse est URL-encodée dans le lien Maps",
  e.description.includes(encodeURIComponent("12 rue des Lilas, 69003 Lyon")));
ok("technicien invité (attendee = son email)",
  Array.isArray(e.attendees) && e.attendees[0].email === "julien@visiondigitalenergies.fr");
ok("origine CRM marquée (extendedProperties.vdeLeadId)",
  e.extendedProperties?.private?.vdeLeadId === "FB-042");
ok("fuseau FR = Europe/Paris", e.start.timeZone === "Europe/Paris" && e.end.timeZone === "Europe/Paris");

// Entité MA → fuseau Casablanca.
const ma = buildRdvEvent({ ...base, entite: "MA" });
ok("fuseau MA = Africa/Casablanca", ma.start.timeZone === "Africa/Casablanca");

// Sans borne → pas de séparateur « · » dans le titre.
const sansBorne = buildRdvEvent({ ...base, borne: null });
ok("sans borne → titre sans « · »", sansBorne.summary === "Dupont Martin — Pose");

// Visite technique → libellé correct.
const visite = buildRdvEvent({ ...base, type: "visite_technique", borne: null });
ok("type visite_technique → « Visite technique »", visite.summary.includes("Visite technique"));

console.log(`\nRÉSULTAT : ${pass} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
