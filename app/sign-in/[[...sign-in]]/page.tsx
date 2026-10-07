import { SignIn } from "@clerk/nextjs";
import { DeploymentSetupScreen } from "../../LoginScreen";
import { isClerkConfigured, missingDeploymentConfig } from "../../deployment-config";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  if (!isClerkConfigured()) {
    return <DeploymentSetupScreen missing={missingDeploymentConfig()} />;
  }

  return <main className="clerk-auth-page"><SignIn routing="path" path="/sign-in" fallbackRedirectUrl="/" /></main>;
}
