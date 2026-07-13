import {
  LayoutDashboard,
  UserPlus,
  Building2,
  Users,
  FileText,
  Sparkles,
  Inbox,
  CalendarDays,
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

/** Éléments mis en avant dans la barre de navigation mobile. */
export const MOBILE_NAV: NavItem[] = [
  NAV_SECTIONS[0].items[0], // Tableau de bord
  NAV_SECTIONS[1].items[0], // Leads
  NAV_SECTIONS[2].items[0], // File de validation IA
  NAV_SECTIONS[1].items[2], // Clients
  NAV_SECTIONS[3].items[2], // Paramètres
];
