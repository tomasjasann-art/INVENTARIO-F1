import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { appUsers } from "../../../../db/schema";
import {
  authErrorMessage,
  createSupabaseAuthClient,
  F1_ACCESS_COOKIE,
  F1_REFRESH_COOKIE,
  sessionCookieValues,
} from "../../../../lib/supabase-auth";

export const dynamic = "force-dynamic";

function cookieValue(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  const encoded = header.split(";").map((part) => part.trim().split("=")).find(([key]) => key === name)?.slice(1).join("=");
  return encoded ? decodeURIComponent(encoded) : "";
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { password?: string; confirmation?: string };
    const password = String(payload.password ?? "");
    const confirmation = String(payload.confirmation ?? "");
    if (password.length < 10) return NextResponse.json({ error: "La nueva contraseña debe tener al menos 10 caracteres." }, { status: 400 });
    if (password !== confirmation) return NextResponse.json({ error: "Las contraseñas no coinciden." }, { status: 400 });

    const accessToken = cookieValue(request, F1_ACCESS_COOKIE);
    const refreshToken = cookieValue(request, F1_REFRESH_COOKIE);
    if (!accessToken || !refreshToken) return NextResponse.json({ error: "La sesión venció. Vuelve a ingresar." }, { status: 401 });

    const supabase = createSupabaseAuthClient();
    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionError || !sessionData.session || !sessionData.user) {
      return NextResponse.json({ error: "La sesión venció. Vuelve a ingresar." }, { status: 401 });
    }

    const { data, error } = await supabase.auth.updateUser({ password });
    if (error || !data.user) return NextResponse.json({ error: authErrorMessage(error) }, { status: 400 });

    const db = getDb();
    await db.update(appUsers).set({
      mustChangePassword: false,
      passwordUpdatedAt: new Date().toISOString(),
      updatedAt: sql`CURRENT_TIMESTAMP`,
    }).where(eq(appUsers.authUserId, data.user.id));

    const response = NextResponse.json({ ok: true });
    const cookies = sessionCookieValues(sessionData.session);
    response.cookies.set(cookies.access.name, cookies.access.value, cookies.access.options);
    response.cookies.set(cookies.refresh.name, cookies.refresh.value, cookies.refresh.options);
    return response;
  } catch (error) {
    return NextResponse.json({ error: authErrorMessage(error) }, { status: 500 });
  }
}
