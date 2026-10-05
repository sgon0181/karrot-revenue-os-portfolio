import type { createClient } from "@/infrastructure/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type CommercialRecordMode = "real" | "sandbox";

export function recordModeForProvider(isSample: boolean): CommercialRecordMode {
  return isSample ? "sandbox" : "real";
}

export function recordBelongsToVisibleAccount(
  recordMode: string | null,
  providerId: string | null,
  sampleProviderIds: ReadonlySet<string>,
) {
  if (recordMode === null) return true;
  if (!providerId) return false;
  return recordMode === recordModeForProvider(sampleProviderIds.has(providerId));
}

export async function loadSampleProviderIds(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("providers")
    .select("id")
    .eq("is_sample", true)
    .is("archived_at", null);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((provider) => provider.id));
}

export async function providerRecordMode(
  supabase: SupabaseClient,
  providerId: string,
): Promise<CommercialRecordMode> {
  const { data: provider, error } = await supabase
    .from("providers")
    .select("is_sample")
    .eq("id", providerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!provider) throw new Error("Provider not found.");
  return recordModeForProvider(provider.is_sample);
}
