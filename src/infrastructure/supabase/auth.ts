import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/infrastructure/supabase/server";

export const getAuthenticatedPrincipal = cache(async () => {
  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (claimsError || !claims?.sub) redirect("/login");

  const userId = String(claims.sub);
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);

  return {
    id: userId,
    email: typeof claims.email === "string" ? claims.email : "Signed-in user",
    role: profile?.role ?? "viewer",
  };
});
