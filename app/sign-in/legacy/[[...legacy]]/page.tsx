import { SignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { isClerkConfigured } from "../../../deployment-config";
import { safeReturnPath } from "../../../../lib/return-path";

export const dynamic = "force-dynamic";

export default async function LegacySignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const returnTo = safeReturnPath(params.redirect_url);
  if (!isClerkConfigured()) redirect(`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`);
  return <main className="clerk-auth-page"><SignIn routing="path" path="/sign-in/legacy" fallbackRedirectUrl={returnTo} /></main>;
}
