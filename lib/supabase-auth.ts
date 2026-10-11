import { createClient, type Session, type User } from "@supabase/supabase-js";

export const F1_ACCESS_COOKIE = "f1-logistica-access";
export const F1_REFRESH_COOKIE = "f1-logistica-refresh";
export const F1_REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL
    || process.env.SUPABASE_URL
    || "";
}

function supabasePublicKey() {
  return process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || "";
}

function supabaseSecretKey() {
  return process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || "";
}

function clientOptions() {
  return {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  } as const;
}

export function createSupabaseAuthClient() {
  const url = supabaseUrl();
  const key = supabasePublicKey();
  if (!url || !key) throw new Error("Supabase Auth no está configurado.");
  return createClient(url, key, clientOptions());
}

export function createSupabaseAdminClient() {
  const url = supabaseUrl();
  const key = supabaseSecretKey();
  if (!url || !key) throw new Error("La clave privada de Supabase Auth no está configurada.");
  return createClient(url, key, clientOptions());
}

export function normalizeUsername(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ".");
}

export function validUsername(value: string) {
  return /^[a-z0-9][a-z0-9._-]{2,38}[a-z0-9]$/.test(value);
}

export function internalAuthEmail(username: string) {
  const domain = (process.env.F1_AUTH_DOMAIN || "acceso.f1.services")
    .trim()
    .toLowerCase()
    .replace(/^@/, "");
  return `${normalizeUsername(username)}@${domain}`;
}

export function authCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function sessionCookieValues(session: Session) {
  return {
    access: {
      name: F1_ACCESS_COOKIE,
      value: session.access_token,
      options: authCookieOptions(Math.max(60, session.expires_in ?? 3600)),
    },
    refresh: {
      name: F1_REFRESH_COOKIE,
      value: session.refresh_token,
      options: authCookieOptions(F1_REFRESH_MAX_AGE),
    },
  };
}

export async function userFromAccessToken(accessToken: string): Promise<User | null> {
  if (!accessToken) return null;
  const client = createSupabaseAuthClient();
  const { data, error } = await client.auth.getUser(accessToken);
  return error ? null : data.user;
}

export function authErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/invalid login credentials/i.test(message)) return "Usuario o contraseña incorrectos.";
  if (/email not confirmed/i.test(message)) return "La cuenta todavía no está habilitada.";
  if (/user.*banned/i.test(message)) return "La cuenta está bloqueada. Comunícate con un administrador.";
  return message || "No se pudo completar la autenticación.";
}
