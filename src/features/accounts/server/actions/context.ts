import { getAuthenticatedPrincipal } from "@/infrastructure/supabase/auth";
import { createClient } from "@/infrastructure/supabase/server";

export type AccountActionClient = Awaited<ReturnType<typeof createClient>>;

export async function accountActionContext() {
  const [supabase, principal] = await Promise.all([
    createClient(),
    getAuthenticatedPrincipal(),
  ]);
  return { supabase, user: principal };
}
