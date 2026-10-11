import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { appUsers } from "../../../../db/schema";
import {
  authErrorMessage,
  createSupabaseAuthClient,
  normalizeUsername,
  sessionCookieValues,
  validUsername,
} from "../../../../lib/supabase-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { username?: string; password?: string };
    const username = normalizeUsername(payload.username);
    const password = String(payload.password ?? "");
    if (!validUsername(username) || !password) {
      return NextResponse.json({ error: "Ingresa un usuario y una contraseña válidos." }, { status: 400 });
    }

    const db = getDb();
    const [account] = await db.select().from(appUsers).where(eq(appUsers.username, username)).limit(1);
    if (!account || !account.active || !account.authUserId) {
      return NextResponse.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });
    }

    const supabase = createSupabaseAuthClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: account.email,
      password,
    });
    if (error || !data.session || !data.user || data.user.id !== account.authUserId) {
      return NextResponse.json({ error: authErrorMessage(error) }, { status: 401 });
    }

    await db.update(appUsers)
      .set({ lastLoginAt: new Date().toISOString(), updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(appUsers.id, account.id));

    const response = NextResponse.json({
      ok: true,
      mustChangePassword: account.mustChangePassword,
    });
    const cookies = sessionCookieValues(data.session);
    response.cookies.set(cookies.access.name, cookies.access.value, cookies.access.options);
    response.cookies.set(cookies.refresh.name, cookies.refresh.value, cookies.refresh.options);
    return response;
  } catch (error) {
    return NextResponse.json({ error: authErrorMessage(error) }, { status: 500 });
  }
}
