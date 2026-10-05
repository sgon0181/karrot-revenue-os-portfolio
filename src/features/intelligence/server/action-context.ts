import { getAuthenticatedPrincipal } from "@/infrastructure/supabase/auth";
import { createClient } from "@/infrastructure/supabase/server";

export async function intelligenceActionContext() {
  const [supabase, principal] = await Promise.all([
    createClient(),
    getAuthenticatedPrincipal(),
  ]);
  return { supabase, user: principal };
}
