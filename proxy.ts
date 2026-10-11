import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import {
  F1_ACCESS_COOKIE,
  F1_REFRESH_COOKIE,
  F1_REFRESH_MAX_AGE,
} from "./lib/supabase-auth";

const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()
    && process.env.CLERK_SECRET_KEY?.trim(),
);
const clerkHandler = clerkConfigured ? clerkMiddleware() : null;

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  const response = clerkHandler
    ? await clerkHandler(request, event) as NextResponse
    : NextResponse.next();

  const accessToken = request.cookies.get(F1_ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(F1_REFRESH_COOKIE)?.value;
  if (accessToken || !refreshToken) return response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  try {
    const refreshResponse = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!refreshResponse.ok) throw new Error("No se pudo renovar la sesión.");
    const session = await refreshResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!session.access_token || !session.refresh_token) throw new Error("Supabase no devolvió una sesión válida.");
    const secure = process.env.NODE_ENV === "production";
    response.cookies.set(F1_ACCESS_COOKIE, session.access_token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: Math.max(60, session.expires_in ?? 3600) });
    response.cookies.set(F1_REFRESH_COOKIE, session.refresh_token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: F1_REFRESH_MAX_AGE });
  } catch {
    response.cookies.set(F1_ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
    response.cookies.set(F1_REFRESH_COOKIE, "", { path: "/", maxAge: 0 });
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
