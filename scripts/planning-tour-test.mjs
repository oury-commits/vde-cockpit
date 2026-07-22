// Verrouille la géométrie de tournée (lib/planning/tour.ts) : Haversine sur des
// distances connues, estimation route/temps, ordre plus-proche-voisin (PAS de
// TSP), format de durée. Réplique les fonctions pures en JS (le .mjs n'importe
// pas le TS) — à garder aligné avec tour.ts + config.ts.

const VITESSE_MOY_KMH = 50;
const FACTEUR_DETOUR = 1.3;
const rad = (d) => (d * Math.PI) / 180;

function haversineKm(a, b) {
  const R = 6371;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
const estimateDistanceKm = (a, b) => haversineKm(a, b) * FACTEUR_DETOUR;
const estimateMinutes = (km) => Math.round((km / VITESSE_MOY_KMH) * 60);
function formatDuree(minutes) {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  if (r === 0) return `${h} h`;
  return `${h} h ${String(r).padStart(2, "0")}`;
}
function orderByProximity(start, stops) {
  const avecPt = stops.filter((s) => s.pt);
  const sansPt = stops.filter((s) => !s.pt);
  if (!start || avecPt.length <= 1) return [...stops];
  const reste = [...avecPt];
  const ordre = [];
  let courant = start;
  while (reste.length) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < reste.length; i++) {
      const d = haversineKm(courant, reste[i].pt);
      if (d < bd) { bd = d; bi = i; }
    }
    const [n] = reste.splice(bi, 1);
    ordre.push(n);
    courant = n.pt;
  }
  return [...ordre, ...sansPt];
}

let pass = 0, fail = 0;
const ok = (n, v) => { console.log(`  ${v ? "OK  " : "FAIL"} ${n}`); v ? pass++ : fail++; };

// Paris (Notre-Dame) → Lyon (Bellecour) ≈ 392 km à vol d'oiseau (tolérance ±5 km).
const paris = { lat: 48.853, lng: 2.3499 };
const lyon = { lat: 45.7578, lng: 4.832 };
const dPL = haversineKm(paris, lyon);
ok(`Haversine Paris–Lyon ≈ 392 km (obtenu ${dPL.toFixed(0)})`, Math.abs(dPL - 392) < 5);
ok("Haversine point → lui-même = 0", haversineKm(paris, paris) === 0);
ok("distance route > vol d'oiseau (détour ×1.3)", estimateDistanceKm(paris, lyon) > dPL);
ok("estimateMinutes(50 km) = 60 min", estimateMinutes(50) === 60);

ok("formatDuree(90) = « 1 h 30 »", formatDuree(90) === "1 h 30");
ok("formatDuree(45) = « 45 min »", formatDuree(45) === "45 min");
ok("formatDuree(120) = « 2 h »", formatDuree(120) === "2 h");

// Ordre plus-proche-voisin depuis Paris : Reims (proche) avant Marseille (loin).
const reims = { lat: 49.2583, lng: 4.0317 };
const marseille = { lat: 43.2965, lng: 5.3698 };
const stops = [
  { id: "MRS", pt: marseille },
  { id: "LYO", pt: lyon },
  { id: "REI", pt: reims },
];
const ordre = orderByProximity(paris, stops).map((s) => s.id);
ok(`ordre proximité depuis Paris = REI,LYO,MRS (obtenu ${ordre.join(",")})`,
  ordre.join(",") === "REI,LYO,MRS");

// Les arrêts sans coordonnées finissent en queue, sans casser l'ordre.
const mixte = [{ id: "A", pt: marseille }, { id: "B", pt: null }, { id: "C", pt: reims }];
const ordreMixte = orderByProximity(paris, mixte).map((s) => s.id);
ok(`arrêt sans géo renvoyé en fin (obtenu ${ordreMixte.join(",")})`,
  ordreMixte[ordreMixte.length - 1] === "B" && ordreMixte.indexOf("C") < ordreMixte.indexOf("A"));

// start null → ordre d'entrée conservé (pas de plantage).
const idem = orderByProximity(null, stops).map((s) => s.id);
ok("start null → ordre inchangé", idem.join(",") === "MRS,LYO,REI");

console.log(`\nRÉSULTAT : ${pass} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
