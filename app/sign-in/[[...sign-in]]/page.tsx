import { redirect } from "next/navigation";
import LoginScreen, { DeploymentSetupScreen } from "../../LoginScreen";
import { isClerkConfigured, missingDeploymentConfig } from "../../deployment-config";
import { safeReturnPath } from "../../../lib/return-path";

export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const returnTo = safeReturnPath(params.redirect_url);
  const missing = missingDeploymentConfig();
  if (missing.length) return <DeploymentSetupScreen missing={missing} />;
  if (params.legacy === "1" && isClerkConfigured()) {
    redirect(`/sign-in/legacy?redirect_url=${encodeURIComponent(returnTo)}`);
  }
  return <LoginScreen legacyAccessAvailable={isClerkConfigured()} returnTo={returnTo} driverPortal={returnTo === "/conductores" || returnTo === "/vehiculos"} />;
}
