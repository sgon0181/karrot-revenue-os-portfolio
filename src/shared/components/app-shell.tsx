import Link from "next/link";
import { Building2, LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { ResearchProgressReconciler } from "@/features/intelligence/components/research-progress-reconciler";
import { GlobalTools } from "@/shared/components/global-tools";
import { KarrotMark } from "@/shared/components/karrot-mark";
import { SidebarNav } from "@/shared/components/sidebar-nav";

export function AppShell({
  children,
  userEmail,
  userRole,
  researchActive,
}: {
  children: React.ReactNode;
  userEmail: string;
  userRole: string;
  researchActive: boolean;
}) {
  const userInitial = userEmail.slice(0, 1).toUpperCase();
  const roleLabel = userRole === "viewer" ? "View-only" : userRole === "editor" ? "Editor" : userRole === "owner" ? "Owner" : userRole;

  return (
    <div className="min-h-screen bg-[#f2f5f3] pb-[calc(70px+env(safe-area-inset-bottom))] md:pb-0">
      <ResearchProgressReconciler active={researchActive} />
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[88px] flex-col overflow-hidden bg-[#0f3f2f] text-white md:flex" aria-label="Application navigation">
        <Link href="/dashboard" aria-label="Karrot Revenue OS home" className="brand-home-link brand-home-link--rail m-1 grid h-[78px] place-items-center rounded-[6px] border-b border-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8059] focus-visible:ring-inset">
          <KarrotMark className="h-9 w-8" />
        </Link>
        <div className="min-h-0 flex-1 overflow-y-auto py-3">
          <SidebarNav variant="rail" />
        </div>
        <div className="border-t border-white/10 p-2">
          <form action={logout}>
            <button type="submit" className="group flex min-h-[60px] w-full flex-col items-center justify-center gap-1 rounded-[6px] text-xs font-medium text-[#b7d2c6] transition hover:bg-white/8 hover:text-white" title={`Sign out ${userEmail}`}>
              <LogOut className="size-[18px]" />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 md:pl-[88px]">
        <header className="sticky top-0 z-40 flex h-[64px] items-center gap-3 border-b border-[#dce6e1] bg-white px-3 sm:px-5 lg:px-6">
          <Link href="/dashboard" aria-label="Karrot Revenue OS home" className="brand-home-link brand-home-link--mobile mr-1 flex items-center gap-2 rounded-[6px] md:hidden">
            <KarrotMark className="h-8 w-7" />
            <span className="font-bold tracking-[0.18em] text-[#134b35]">KARROT</span>
          </Link>

          <div className="hidden min-w-[205px] items-center gap-3 md:flex">
            <span className="grid size-9 place-items-center rounded-[6px] bg-[#fff0ea] text-[#e96843]"><Building2 className="size-[18px]" /></span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#1b2f27]">Karrot Revenue OS</p>
              <p className="text-xs text-[#64726c]">Commercial workspace</p>
            </div>
          </div>

          <span className="hidden h-7 w-px bg-[#e3ebe7] md:block" />
          <GlobalTools />

          <span className="hidden h-7 w-px bg-[#e3ebe7] lg:block" />
          <span className="hidden rounded-[5px] bg-[#eef7f2] px-2 py-1 text-xs font-semibold text-[#2f654d] md:inline lg:hidden">{roleLabel} access</span>
          <div className="hidden min-w-0 items-center gap-2 lg:flex" title={userEmail}>
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#134b35] text-xs font-bold text-white">{userInitial}</span>
            <div className="min-w-0 max-w-[150px]">
              <p className="truncate text-xs font-semibold text-[#2c4037]">{roleLabel} access</p>
              <p className="truncate text-xs text-[#64726c]">{userEmail}</p>
            </div>
          </div>
          <span className="hidden rounded-[5px] bg-[#eef7f2] px-2 py-1 text-[11px] font-semibold text-[#2f654d] min-[360px]:inline md:hidden">{roleLabel}</span>
          <form action={logout} className="md:hidden">
            <button type="submit" className="icon-button" aria-label={`Sign out ${userEmail}`} title="Sign out"><LogOut className="size-[18px]" /></button>
          </form>
        </header>

        <SidebarNav variant="mobile" />

        <main id="main-content" tabIndex={-1} className="min-w-0 px-4 pb-8 pt-5 focus:outline-none sm:px-6 lg:px-7 lg:pb-10 lg:pt-6 xl:px-8">
          <div className="mx-auto max-w-[1560px]">{children}</div>
        </main>
      </div>

    </div>
  );
}
