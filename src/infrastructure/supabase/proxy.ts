import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/infrastructure/supabase/database.types";
import {
  loginPath,
  RETURN_TO_PARAM,
  safeSingleInternalPath,
} from "@/shared/lib/internal-navigation";

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isLogin = path === "/login";
  const isLanding = path === "/";
  const isPublicPath = isLogin || isLanding;
  const requestedPath = `${path}${request.nextUrl.search}`;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    if (isPublicPath) return NextResponse.next({ request });
    const url = new URL(
      loginPath(
        requestedPath,
        "Workspace authentication is not configured in this environment.",
      ),
      request.url,
    );
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(
    supabaseUrl,
    publishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);
  if (!isAuthenticated && !isPublicPath) {
    // Build a fresh login URL so the original query cannot be mistaken for a
    // login parameter. It remains encoded inside the validated return target.
    const url = new URL(loginPath(requestedPath), request.url);
    return NextResponse.redirect(url);
  }
  if (isAuthenticated && isLogin) {
    const returnTo = safeSingleInternalPath(
      request.nextUrl.searchParams.getAll(RETURN_TO_PARAM),
    );
    const url = new URL(returnTo, request.url);
    return NextResponse.redirect(url);
  }
  if (isAuthenticated && isLanding) {
    const url = new URL("/dashboard", request.url);
    return NextResponse.redirect(url);
  }
  return response;
}
