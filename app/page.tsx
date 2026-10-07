import KardexApp from "./KardexApp";
import LoginScreen, { AccessDeniedScreen } from "./LoginScreen";
import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
  getChatGPTUser,
  isAuthorizedKardexUser,
} from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();

  if (!user) {
    return <LoginScreen signInPath={chatGPTSignInPath("/")} />;
  }

  if (!(await isAuthorizedKardexUser(user.email))) {
    return <AccessDeniedScreen email={user.email} signOutPath={chatGPTSignOutPath("/")} />;
  }

  return (
    <KardexApp
      user={{ displayName: user.displayName, email: user.email }}
      signOutPath={chatGPTSignOutPath("/")}
    />
  );
}
