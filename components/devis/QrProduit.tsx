"use client";

import { useEffect, useState } from "react";
import { QR_LABEL, qrDataUrl } from "@/lib/devis/qr";

/**
 * QR de la fiche produit, affiché à côté de la ligne borne du devis.
 * Un seul QR par produit — pas de mur de QR.
 */
export function QrProduit({ url, size = 64 }: { url: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    qrDataUrl(url, size * 3)
      .then((d) => alive && setSrc(d))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [url, size]);

  if (!src) return null;
  return (
    <div className="mt-1.5 flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={QR_LABEL}
        width={size}
        height={size}
        className="shrink-0 rounded border border-line"
      />
      <span className="text-[11px] leading-tight text-muted">{QR_LABEL}</span>
    </div>
  );
}
