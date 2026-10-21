import { redirect } from "next/navigation";
import KardexApp from "./KardexApp";
import LoginScreen, { AccessDeniedScreen, DeploymentSetupScreen } from "./LoginScreen";
import PasswordChangeScreen from "./PasswordChangeScreen";
import {
  getKardexAccess,
  getAuthenticatedUser,
  signInPath,
  signOutPath,
} from "./auth";
import { isClerkConfigured, missingDeploymentConfig } from "./deployment-config";

export const dynamic = "force-dynamic";

export default async function Home() {
  const missingConfig = missingDeploymentConfig();
  if (missingConfig.length) {
    return <DeploymentSetupScreen missing={missingConfig} />;
  }

  const user = await getAuthenticatedUser();

  if (!user) {
    return <LoginScreen signInPath={signInPath("/")} legacyAccessAvailable={isClerkConfigured()} />;
  }

  const access = await getKardexAccess(user.email, user.userId, user.authProvider);
  if (!access?.active) {
    return <AccessDeniedScreen email={user.email} signOutPath={signOutPath()} />;
  }

  if (user.authProvider === "supabase" && access.mustChangePassword) {
    return <PasswordChangeScreen displayName={access.displayName || user.displayName} />;
  }

  if (access.role === "CONDUCTOR") redirect("/vehiculos");

  return (
    <KardexApp
      user={{ displayName: user.displayName, email: user.email }}
      signOutPath={signOutPath()}
    />
  );
}
