import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { BottomNav } from "@/components/layout/BottomNav";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { DevOpenBanner } from "@/components/auth/DevOpenBanner";
import { EntityProvider } from "@/lib/entite/EntityProvider";
import { SettingsProvider } from "@/lib/settings/store";
import { ProfilesProvider } from "@/lib/roles/ProfilesProvider";
import { IdentityProvider } from "@/lib/roles/IdentityProvider";
import { EntrepriseProvider } from "@/lib/entreprise/EntrepriseProvider";
import { ModelesProvider } from "@/lib/emails/ModelesProvider";
import { DevIdentityBar } from "@/components/roles/DevIdentityBar";
import { RouteGuard } from "@/components/roles/RouteGuard";
import { ToastProvider } from "@/components/ui/Toast";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <RequireAuth>
      {/* ToastProvider englobe tout : les providers de données y remontent
          leurs erreurs de persistance (jamais avalées). */}
      <ToastProvider>
      {/* ProfilesProvider englobe IdentityProvider : l'identité DÉCOULE du
          profil, donc un droit modifié dans /equipe s'applique aussitôt.
          IdentityProvider englobe EntityProvider : l'entité active dépend du
          profil (un mono-entité est épinglé sur la sienne). */}
      <ProfilesProvider>
        <IdentityProvider>
          <SettingsProvider>
            <EntrepriseProvider>
              <ModelesProvider>
              <EntityProvider>
                <div className="flex min-h-screen">
                  <Sidebar />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <DevOpenBanner />
                    <DevIdentityBar />
                    <Topbar />
                    <main className="flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10 md:pt-8">
                      <RouteGuard>{children}</RouteGuard>
                    </main>
                  </div>
                  <BottomNav />
                </div>
              </EntityProvider>
              </ModelesProvider>
            </EntrepriseProvider>
          </SettingsProvider>
        </IdentityProvider>
      </ProfilesProvider>
      </ToastProvider>
    </RequireAuth>
  );
}
