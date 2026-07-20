import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { BottomNav } from "@/components/layout/BottomNav";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { DevOpenBanner } from "@/components/auth/DevOpenBanner";
import { EntityProvider } from "@/lib/entite/EntityProvider";
import { SettingsProvider } from "@/lib/settings/store";
import { IdentityProvider } from "@/lib/roles/IdentityProvider";
import { DevIdentityBar } from "@/components/roles/DevIdentityBar";
import { RouteGuard } from "@/components/roles/RouteGuard";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <RequireAuth>
      {/* IdentityProvider englobe EntityProvider : l'entité active dépend du
          profil (un mono-entité est épinglé sur la sienne). */}
      <IdentityProvider>
        <SettingsProvider>
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
        </SettingsProvider>
      </IdentityProvider>
    </RequireAuth>
  );
}
