import { redirect } from "next/navigation";
import { getAuthenticatedUser, getKardexAccess } from "../auth";
import Analysis from "./Analysis";

export const dynamic = "force-dynamic";

export default async function AnalysisPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/");
  const access = await getKardexAccess(user.email, user.userId, user.authProvider);
  if (!access?.active || access.mustChangePassword || access.role !== "ADMIN") redirect("/");
  return <Analysis />;
}
