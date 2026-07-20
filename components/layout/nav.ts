import {
  LayoutDashboard,
  UserPlus,
  Building2,
  Users,
  FileText,
  Package,
  Sparkles,
  Inbox,
  CalendarDays,
  Route,
  Wrench,
  UsersRound,
  ChartColumn,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Libellé court pour la barre mobile (sinon : premier mot du label). */
  shortLabel?: string;
  /** Compteur optionnel (ex. file de validation IA). */
  badge?: number;
}

export interface NavSection {
  title: string | null;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: null,
    items: [
      { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Commercial",
    items: [
      { label: "Leads", href: "/leads", icon: UserPlus },
      { label: "Prospects B2B", href: "/prospects", icon: Building2 },
      { label: "Clients", href: "/clients", icon: Users },
      { label: "Devis & Factures", href: "/devis", icon: FileText },
      { label: "Catalogue", href: "/catalogue", icon: Package },
    ],
  },
  {
    title: "Opérations",
    items: [
      {
        label: "File de validation IA",
        href: "/validation",
        icon: Sparkles,
        // TODO: brancher données réelles — compteur statique de démo
        badge: 3,
      },
      { label: "Boîte de réception", href: "/inbox", icon: Inbox },
      { label: "Planning & tournées", href: "/planning", icon: CalendarDays },
      { label: "Ma tournée", href: "/mobile", icon: Route, shortLabel: "Tournée" },
      { label: "SAV", href: "/sav", icon: Wrench },
    ],
  },
  {
    title: "Admin",
    items: [
      { label: "Équipe", href: "/equipe", icon: UsersRound },
      { label: "Rapports", href: "/rapports", icon: ChartColumn },
      { label: "Paramètres", href: "/parametres", icon: Settings },
    ],
  },
];

/**
 * Recherche par route, et pas par index : insérer une entrée dans une section
 * décalait silencieusement la barre mobile vers le mauvais écran.
 */
function parRoute(href: string): NavItem {
  const item = NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.href === href);
  if (!item) throw new Error(`nav : aucune entrée pour ${href}`);
  return item;
}

/** Éléments mis en avant dans la barre de navigation mobile. */
export const MOBILE_NAV: NavItem[] = [
  parRoute("/dashboard"),
  parRoute("/leads"),
  parRoute("/validation"),
  parRoute("/mobile"), // nav principale du technicien
  parRoute("/clients"),
  parRoute("/parametres"),
];
