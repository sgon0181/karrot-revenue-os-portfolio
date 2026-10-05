import { AppShell } from "@/shared/components/app-shell";
import { getAuthenticatedPrincipal } from "@/infrastructure/supabase/auth";
import { createClient } from "@/infrastructure/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const [principal, supabase] = await Promise.all([
    getAuthenticatedPrincipal(),
    createClient(),
  ]);
  const { count, error } = await supabase
    .from("account_research_jobs")
    .select("id", { count: "exact", head: true })
    .eq("created_by", principal.id)
    .eq("status", "running")
    .neq("model", "operator-curated");
  return (
    <AppShell
      userEmail={principal.email}
      userRole={principal.role}
      researchActive={!error && (count ?? 0) > 0}
    >
      {children}
    </AppShell>
  );
}
