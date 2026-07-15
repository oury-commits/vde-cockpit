import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { BottomNav } from "@/components/layout/BottomNav";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { DevOpenBanner } from "@/components/auth/DevOpenBanner";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <RequireAuth>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <DevOpenBanner />
          <Topbar />
          <main className="flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10 md:pt-8">
            {children}
          </main>
        </div>
        <BottomNav />
      </div>
    </RequireAuth>
  );
}
