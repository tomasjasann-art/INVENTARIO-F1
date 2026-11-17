import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "../../db";
import { getAuthenticatedUser, getKardexAccess } from "../auth";
import Analysis from "./Analysis";

export const dynamic = "force-dynamic";

async function getAccess() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/");
  const access = await getKardexAccess(user.email, user.userId, user.authProvider);
  if (!access?.active || access.mustChangePassword) redirect("/");
  const logistics = access.role === "ADMINISTRADOR" || access.role === "LOGISTICA";
  if (!logistics && access.role !== "COORDINADOR") redirect("/");
  return { user, logistics, coordinator: access.displayName || user.displayName };
}

const fields = ["ID", "CECO", "Año", "Cliente", "Proyecto", "Tipo de comprobante", "RUC", "Contratista", "Contacto", "Cantidad", "Tipo de orden", "Comentarios"];
const input = z.object({
  id: z.string().uuid(),
  collector: z.string().trim().min(1).max(160),
  site: z.string().trim().min(1).max(240),
  description: z.string().trim().min(1).max(1000),
  cost: z.coerce.number().positive().max(999999999999),
  lpu: z.coerce.number().nonnegative().max(999999999999),
  reference: z.string().trim().max(150),
});

async function submit(form: FormData) {
  "use server";
  const {user, coordinator} = await getAccess();
  const result = input.safeParse(Object.fromEntries(form));
  if (!result.success) return "Revisa colector, site, servicio y montos.";
  const {id, collector, site, description, cost, lpu, reference} = result.data;
  const details = Object.fromEntries(fields.map(field => [field, String(form.get(field) ?? "").trim().slice(0, 500)]));
  try {
    await getDb().execute(sql`INSERT INTO public.f1_os_requests
      (id,owner_email,coordinator,collector,site,description,cost,lpu,reference,details)
      VALUES (${id},${user.email},${coordinator},${collector.toUpperCase()},${site},${description},${cost},${lpu},${reference},${JSON.stringify(details)}::jsonb)
      ON CONFLICT (id) DO NOTHING`);
  } catch {
    return "La solicitud no se pudo guardar. Intenta nuevamente.";
  }
  revalidatePath("/analisis-os");
  return null;
}

export default async function AnalysisPage() {
  const {user, logistics} = await getAccess();
  const rows = await getDb().execute<{
    key: string; collector: string; coordinator: string; site: string; description: string;
    cost: number; lpu: number; reference: string; details: Record<string,string>;
  }>(sql`SELECT id::text AS key, collector, coordinator, site, description, cost::float8 AS cost,
       lpu::float8 AS lpu, reference, details FROM public.f1_os_requests
       ${logistics ? sql`` : sql`WHERE owner_email = ${user.email}`} ORDER BY created_at DESC`);
  return <Analysis saved={Array.from(rows)} logistics={logistics} fields={fields} submit={submit} />;
}
