"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/infrastructure/supabase/server";
import {
  loginPath,
  RETURN_TO_PARAM,
  safeSingleInternalPath,
} from "@/shared/lib/internal-navigation";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const returnTo = safeSingleInternalPath(formData.getAll(RETURN_TO_PARAM));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(loginPath(returnTo, error.message));
  redirect(returnTo);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
