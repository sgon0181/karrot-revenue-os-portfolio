"use server";

import { createClient } from "@/infrastructure/supabase/server";

export async function recordProviderWorkspaceView(providerId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_provider_workspace_view", {
    p_provider_id: providerId,
  });
  if (error) throw new Error(error.message);
}
