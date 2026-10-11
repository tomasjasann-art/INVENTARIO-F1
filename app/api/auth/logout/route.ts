import { NextResponse } from "next/server";
import {
  authCookieOptions,
  createSupabaseAdminClient,
  F1_ACCESS_COOKIE,
  F1_REFRESH_COOKIE,
} from "../../../../lib/supabase-auth";

export const dynamic = "force-dynamic";

function clearSession(response: NextResponse) {
  response.cookies.set(F1_ACCESS_COOKIE, "", authCookieOptions(0));
  response.cookies.set(F1_REFRESH_COOKIE, "", authCookieOptions(0));
  return response;
}

export async function POST(request: Request) {
  try {
    const accessToken = request.headers.get("cookie")
      ?.split(";")
      .map((part) => part.trim().split("="))
      .find(([name]) => name === F1_ACCESS_COOKIE)?.[1];
    if (accessToken) {
      const supabase = createSupabaseAdminClient();
      await supabase.auth.admin.signOut(decodeURIComponent(accessToken), "local");
    }
  } catch {
    // Las cookies se eliminan incluso si Supabase ya cerró o venció la sesión.
  }
  return clearSession(NextResponse.json({ ok: true }));
}

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url));
  return clearSession(response);
}
