import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "../db";
import { appUsers } from "../db/schema";
import { F1_ACCESS_COOKIE, userFromAccessToken } from "../lib/supabase-auth";
import { safeReturnPath } from "../lib/return-path";
import { isClerkConfigured } from "./deployment-config";

export type AuthenticatedUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
  authProvider: "supabase" | "clerk";
};

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(F1_ACCESS_COOKIE)?.value ?? "";
  if (accessToken) {
    const supabaseUser = await userFromAccessToken(accessToken);
    const email = supabaseUser?.email?.trim().toLowerCase();
    if (supabaseUser && email) {
      const displayName = typeof supabaseUser.user_metadata?.display_name === "string"
        ? supabaseUser.user_metadata.display_name.trim()
        : "";
      return {
        userId: supabaseUser.id,
        displayName: displayName || email.split("@")[0],
        email,
        fullName: displayName || null,
        authProvider: "supabase",
      };
    }
  }

  if (!isClerkConfigured()) return null;
  const user = await currentUser();
  if (!user) return null;

  const primaryEmail = user.emailAddresses.find(
    (item) => item.id === user.primaryEmailAddressId,
  )?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
  if (!primaryEmail) return null;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;
  return {
    userId: user.id,
    displayName: fullName ?? primaryEmail,
    email: primaryEmail.toLowerCase(),
    fullName,
    authProvider: "clerk",
  };
}

export function isKardexAdminEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const adminEmails = (process.env.F1_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(normalized);
}

export async function isAuthorizedKardexUser(email: string): Promise<boolean> {
  return Boolean((await getKardexAccess(email))?.active);
}

export async function getKardexAccess(
  email: string,
  authUserId = "",
  authProvider: AuthenticatedUser["authProvider"] = "clerk",
) {
  const normalized = email.trim().toLowerCase();
  if (authProvider === "clerk" && isKardexAdminEmail(normalized)) {
    return {
      id: 0,
      email: normalized,
      username: "",
      authUserId: "",
      displayName: "Administrador",
      role: "ADMINISTRADOR" as const,
      active: true,
      mustChangePassword: false,
      passwordUpdatedAt: "",
      lastLoginAt: "",
      invitationStatus: "LEGACY",
      invitedAt: "",
      createdAt: "",
      updatedAt: "",
    };
  }

  const db = getDb();
  const [record] = await db
    .select()
    .from(appUsers)
    .where(authProvider === "supabase" && authUserId
      ? eq(appUsers.authUserId, authUserId)
      : eq(appUsers.email, normalized))
    .limit(1);

  return record ?? null;
}

export function signInPath(returnTo = "/"): string {
  const safeReturnTo = safeReturnPath(returnTo);
  return `/sign-in?redirect_url=${encodeURIComponent(safeReturnTo)}`;
}

export function signOutPath(): string {
  return "/sign-out";
}
