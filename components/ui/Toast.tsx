"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { uid } from "@/lib/uid";
import { cn } from "@/lib/cn";

export type ToastTone = "info" | "success" | "alert";

interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ToastValue {
  /** Affiche un toast (bas de l'écran, auto-fermé). */
  notify: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

const TONE: Record<ToastTone, string> = {
  info: "border-line bg-surface text-ink",
  success: "border-success/30 bg-success/10 text-success",
  alert: "border-alert/30 bg-alert/10 text-alert",
};

function ToastIcon({ tone }: { tone: ToastTone }) {
  const cls = "mt-0.5 size-4 shrink-0";
  if (tone === "alert") return <CircleAlert className={cls} strokeWidth={2} />;
  if (tone === "success") return <CircleCheck className={cls} strokeWidth={2} />;
  return <Info className={cls} strokeWidth={2} />;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const notify = useCallback<ToastValue["notify"]>((message, tone = "info") => {
    const id = uid();
    setToasts((t) => [...t, { id, message, tone }]);
    // Les alertes restent plus longtemps (12 s) que les infos (6 s).
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "alert" ? 12000 : 6000);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full max-w-md items-start gap-2 rounded-lg border px-3.5 py-2.5 text-[13px] shadow-lg",
              TONE[t.tone],
            )}
          >
            <ToastIcon tone={t.tone} />
            <span className="min-w-0 flex-1">{t.message}</span>
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => remove(t.id)}
              className="shrink-0 opacity-70 transition-opacity hover:opacity-100"
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Hors provider (SSR / route sans layout app) : no-op silencieux plutôt qu'un crash.
const NOOP: ToastValue = { notify: () => {} };

export function useToast(): ToastValue {
  return useContext(ToastContext) ?? NOOP;
}
