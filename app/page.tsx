import KardexApp from "./KardexApp";
import LoginScreen, { AccessDeniedScreen, DeploymentSetupScreen } from "./LoginScreen";
import {
  getAuthenticatedUser,
  isAuthorizedKardexUser,
  signInPath,
  signOutPath,
} from "./auth";
import { missingDeploymentConfig } from "./deployment-config";

export const dynamic = "force-dynamic";

export default async function Home() {
  const missingConfig = missingDeploymentConfig();
  if (missingConfig.length) {
    return <DeploymentSetupScreen missing={missingConfig} />;
  }

  const user = await getAuthenticatedUser();

  if (!user) {
    return <LoginScreen signInPath={signInPath("/")} />;
  }

  if (!(await isAuthorizedKardexUser(user.email))) {
    return <AccessDeniedScreen email={user.email} signOutPath={signOutPath()} />;
  }

  return (
    <KardexApp
      user={{ displayName: user.displayName, email: user.email }}
      signOutPath={signOutPath()}
    />
  );
}
