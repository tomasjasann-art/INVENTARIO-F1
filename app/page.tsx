import { redirect } from "next/navigation";
import ModuleHome from "./ModuleHome";
import KardexApp from "./KardexApp";
import LoginScreen, { AccessDeniedScreen, DeploymentSetupScreen } from "./LoginScreen";
import PasswordChangeScreen from "./PasswordChangeScreen";
import {
  getKardexAccess,
  getAuthenticatedUser,
  signOutPath,
} from "./auth";
import { isClerkConfigured, missingDeploymentConfig } from "./deployment-config";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const missingConfig = missingDeploymentConfig();
  if (missingConfig.length) {
    return <DeploymentSetupScreen missing={missingConfig} />;
  }

  const user = await getAuthenticatedUser();

  if (!user) {
    return <LoginScreen legacyAccessAvailable={isClerkConfigured()} />;
  }

  const access = await getKardexAccess(user.email, user.userId, user.authProvider);
  if (!access?.active) {
    return <AccessDeniedScreen email={user.email} signOutPath={signOutPath()} />;
  }

  if (user.authProvider === "supabase" && access.mustChangePassword) {
    return <PasswordChangeScreen displayName={access.displayName || user.displayName} />;
  }

  if (access.role === "TECNICO") redirect("/activos/tecnicos");

  if (access.role === "CONDUCTOR") redirect("/conductores");

  const params = await searchParams;

  const module=typeof params.modulo==="string"?params.modulo:"";
  const adminSetup=access.role==="ADMINISTRADOR" && (params.administrar==="tecnicos" || params.administrar==="conductores");
  if(module==="configuracion" && access.role!=="ADMINISTRADOR")redirect("/");
  if (!["equipos","vehiculos","activos","documentos","configuracion"].includes(module) && !adminSetup) {
    return <ModuleHome name={access.displayName || user.displayName} role={access.role} signOut={signOutPath()} />;
  }

  return (
    <KardexApp
      initialModule={module}
      user={{ displayName: user.displayName, email: user.email }}
      technicianSetup={params.administrar === "tecnicos" && access.role === "ADMINISTRADOR"}
      driverSetup={params.administrar === "conductores" && access.role === "ADMINISTRADOR"}
      signOutPath={signOutPath()}
    />
  );
}
