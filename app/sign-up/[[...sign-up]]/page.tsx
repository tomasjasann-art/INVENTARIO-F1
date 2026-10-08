import { SignUp } from "@clerk/nextjs";
import { DeploymentSetupScreen } from "../../LoginScreen";
import { isClerkConfigured, missingDeploymentConfig } from "../../deployment-config";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  if (!isClerkConfigured()) {
    return <DeploymentSetupScreen missing={missingDeploymentConfig()} />;
  }

  return <main className="clerk-auth-page"><SignUp routing="path" path="/sign-up" fallbackRedirectUrl="/" /></main>;
}
