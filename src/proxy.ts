import type { NextRequest } from "next/server";
import { updateSession } from "@/infrastructure/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|landing/particle-targets\\.v1\\.bin$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
