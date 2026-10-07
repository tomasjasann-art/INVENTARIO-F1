import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { appUsers } from "../db/schema";

export type AuthenticatedUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
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
  const normalized = email.trim().toLowerCase();
  if (isKardexAdminEmail(normalized)) return true;

  const db = getDb();
  const [record] = await db
    .select({ active: appUsers.active })
    .from(appUsers)
    .where(eq(appUsers.email, normalized))
    .limit(1);

  return record?.active === true;
}

export function signInPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `/sign-in?redirect_url=${encodeURIComponent(safeReturnTo)}`;
}

export function signOutPath(): string {
  return "/sign-out";
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  try {
    const url = new URL(value, "https://app.local");
    if (url.origin !== "https://app.local") return "/";
    if (url.pathname.startsWith("/sign-in") || url.pathname.startsWith("/sign-out")) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
