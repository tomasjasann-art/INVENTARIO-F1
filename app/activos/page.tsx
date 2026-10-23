import { redirect } from "next/navigation";
import { getAuthenticatedUser, getKardexAccess, signInPath } from "../auth";
import AssetsApp from "./AssetsApp";
export const dynamic="force-dynamic";
export default async function AssetsPage(){const u=await getAuthenticatedUser();if(!u)redirect(signInPath("/activos"));const a=await getKardexAccess(u.email,u.userId,u.authProvider);if(!a?.active || (u.authProvider==="supabase" && a.mustChangePassword))redirect("/");if(a.role==="TECNICO")redirect("/activos/tecnicos");return <AssetsApp/>;}
