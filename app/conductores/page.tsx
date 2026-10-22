import { redirect } from "next/navigation";
import LoginScreen, { AccessDeniedScreen, DeploymentSetupScreen } from "../LoginScreen";
import PasswordChangeScreen from "../PasswordChangeScreen";
import { getAuthenticatedUser, getKardexAccess, signOutPath } from "../auth";
import { isClerkConfigured, missingDeploymentConfig } from "../deployment-config";
import FleetApp from "../vehiculos/FleetApp";
import DriverInstallHelp from "./DriverInstallHelp";

export const dynamic = "force-dynamic";

export default async function DriversPage() {
  const missing = missingDeploymentConfig();
  if (missing.length) return <DeploymentSetupScreen missing={missing} />;
  const user = await getAuthenticatedUser();
  if (!user) return <LoginScreen legacyAccessAvailable={isClerkConfigured()} returnTo="/conductores" driverPortal />;
  const access = await getKardexAccess(user.email, user.userId, user.authProvider);
  if (!access?.active) return <AccessDeniedScreen email={user.email} signOutPath={signOutPath()} />;
  if (user.authProvider === "supabase" && access.mustChangePassword) return <PasswordChangeScreen displayName={access.displayName || user.displayName} />;
  if (!["CONDUCTOR", "ADMINISTRADOR", "LOGISTICA"].includes(access.role)) redirect("/");
  return <div className="driver-portal"><div className="driver-portal-install"><DriverInstallHelp /></div><FleetApp driverPortal /></div>;
}
