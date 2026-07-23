// Test d'égalité du « reste à payer » : les DEUX sources doivent concorder.
//  - Source A (jauge / relance) : TTC − Σ reglements   → resteAPayer.
//  - Source B (facture de solde) : TTC − Σ factures_acompte.ttc.
// Invariant garanti par le store : chaque acompte VDE encaissé émet une facture
// d'acompte du MÊME montant. Ce test rejoue la construction et vérifie que les
// deux calculs tombent sur le même centime — sinon le bouton solde annoncerait
// un reste différent de la facture imprimée.

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
let pass = 0, fail = 0;
const eq = (n, a, b) => {
  const ok = Math.abs(a - b) < 0.005;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${n} : A=${a} · B=${b}`);
  ok ? pass++ : fail++;
};

// Reproduction fidèle de enregistrerReglement + resteAPayer.
function dossier(ttc) {
  return { ttc, reglements: [], factures_acompte: [] };
}
function encaisser(d, montant, mode = "virement") {
  const m = r2(montant);
  d.reglements.push({ montant: m, mode });
  if (mode !== "alma") d.factures_acompte.push({ montant_ttc: m }); // facture d'acompte
}
const totalRegle = (d) => r2(d.reglements.reduce((s, r) => s + r.montant, 0));
const estAlma = (d) => d.reglements.some((r) => r.mode === "alma");
const resteA = (d) => (estAlma(d) ? 0 : r2(Math.max(0, d.ttc - totalRegle(d)))); // Source A
const resteB = (d) =>
  estAlma(d) ? 0 : r2(d.ttc - d.factures_acompte.reduce((s, f) => s + f.montant_ttc, 0)); // Source B

const TTC = 1350.4;

console.log("=== 1 acompte partiel (500) ===");
{ const d = dossier(TTC); encaisser(d, 500); eq("reste (A) = reste (B)", resteA(d), resteB(d)); }

console.log("=== 2 acomptes (500 + 300) ===");
{ const d = dossier(TTC); encaisser(d, 500); encaisser(d, 300); eq("reste (A) = reste (B)", resteA(d), resteB(d)); }

console.log("=== acompte = échéance exacte (675,20) ===");
{ const d = dossier(TTC); encaisser(d, 675.2); eq("reste (A) = reste (B)", resteA(d), resteB(d)); }

console.log("=== soldé (acompte + solde = total) ===");
{ const d = dossier(TTC); encaisser(d, 675.2); encaisser(d, r2(TTC - 675.2));
  eq("reste (A) = reste (B)", resteA(d), resteB(d));
  eq("dossier soldé → reste 0", resteA(d), 0); }

console.log("=== Alma : soldé d'office, pas de facture d'acompte ===");
{ const d = dossier(TTC); encaisser(d, 1290, "alma");
  eq("reste (A) = reste (B) = 0", resteA(d), resteB(d));
  eq("Alma → reste 0 quel que soit le montant", resteA(d), 0); }

console.log(`\nRÉSULTAT : ${pass} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
