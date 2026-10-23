import LoginScreen, {AccessDeniedScreen,DeploymentSetupScreen} from "../../LoginScreen";
import PasswordChangeScreen from "../../PasswordChangeScreen";
import { getAuthenticatedUser, getKardexAccess, signOutPath } from "../../auth";
import {isClerkConfigured,missingDeploymentConfig} from "../../deployment-config";
import AssetsApp from "../AssetsApp";
export const dynamic="force-dynamic";
export const metadata={title:"Activos F1 · Técnicos",manifest:"/activos/tecnicos/manifest.webmanifest",appleWebApp:{capable:true,title:"Activos F1",statusBarStyle:"default"}};
export default async function TechnicianPage(){
 const missing=missingDeploymentConfig();if(missing.length)return <DeploymentSetupScreen missing={missing}/>;
 const u=await getAuthenticatedUser();if(!u)return <LoginScreen legacyAccessAvailable={isClerkConfigured()} returnTo="/activos/tecnicos" assetsPortal/>;
 const a=await getKardexAccess(u.email,u.userId,u.authProvider);if(!a?.active)return <AccessDeniedScreen email={u.email} signOutPath={signOutPath()}/>;
 if(u.authProvider==="supabase"&&a.mustChangePassword)return <PasswordChangeScreen displayName={a.displayName||u.displayName} returnTo="/activos/tecnicos"/>;
 return <AssetsApp mobilePortal/>;
}
