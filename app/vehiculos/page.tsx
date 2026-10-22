import { redirect } from "next/navigation";
import { getAuthenticatedUser, getKardexAccess, signInPath } from "../auth";
import FleetApp from "./FleetApp";

export const dynamic = "force-dynamic";
export default async function FleetPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect(signInPath("/vehiculos"));
  const access = await getKardexAccess(user.email, user.userId, user.authProvider);
  if (!access?.active || (user.authProvider === "supabase" && access.mustChangePassword)) redirect("/");
  if (!["ADMINISTRADOR", "LOGISTICA", "SOLO_LECTURA", "CONDUCTOR"].includes(access.role)) redirect("/");
  if (access.role === "CONDUCTOR") redirect("/conductores");
  return <FleetApp />;
}
