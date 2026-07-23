// Charge une image (URL publique du logo) en dataURL, pour l'embarquer dans un
// PDF jsPDF. Best-effort : renvoie null en cas d'échec (réseau, CORS, mode
// démo) → le générateur retombe sur l'en-tête texte, jamais de plantage.

export async function chargerImageDataUrl(
  url: string | null | undefined,
): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(typeof r.result === "string" ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
