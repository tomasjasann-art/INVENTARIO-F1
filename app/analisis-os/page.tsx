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
  if (!["Factura","Recibo RXH"].includes(details["Tipo de comprobante"]) || !["Orden de Servicio","Orden de Compra"].includes(details["Tipo de orden"])) return "Selecciona comprobante y tipo de orden.";
  const supplier = await getDb().execute(sql`SELECT business_name FROM suppliers WHERE active=true AND document_number=${details.RUC} LIMIT 1`);
  if (!supplier.length) return "Selecciona un RUC del catálogo de proveedores.";
  details.Contratista = String(supplier[0].business_name);
  details.Historial = JSON.stringify([{fecha:new Date().toISOString(),usuario:user.email,accion:"Solicitud registrada"}]);
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


async function saveTracking(form: FormData) {
  "use server";
  const {user, logistics} = await getAccess();
  if (!logistics) return "Solo Logística puede registrar gastos y órdenes emitidas.";
  const id=z.string().uuid().safeParse(form.get("request"));
  if(!id.success) return "Selecciona una solicitud.";
  const kind=String(form.get("kind"));
  let patch:Record<string,string>={};
  let action="";
  if(kind==="order"){
    const number=String(form.get("number")??"").trim();
    const link=String(form.get("link")??"").trim();
    if(!number) return "Ingresa el número de orden.";
    if(link && !/^https?:\/\//i.test(link)) return "El enlace debe comenzar con https:// o http://.";
    patch={"OS Contrata":number,"Link de OS":link,Status:"OS emitida"};
    const pdf=form.get("pdf");
    if(pdf instanceof File && pdf.size){
      if(pdf.size>2*1024*1024) return "El PDF debe pesar como máximo 2 MB. Para archivos mayores registra el enlace.";
      const bytes=Buffer.from(await pdf.arrayBuffer());
      if(bytes.subarray(0,5).toString()!=="%PDF-") return "Selecciona un PDF válido.";
      patch["PDF"]=bytes.toString("base64");
      patch["PDF nombre"]=pdf.name.slice(0,200);
    }
    action="Orden emitida registrada: "+number;
  } else if(kind==="expense"){
    const description=String(form.get("description")??"").trim();
    const cost=Number(form.get("cost"));
    if(!description || !Number.isFinite(cost) || cost<=0 || cost>999999999) return "Revisa la descripción y el importe.";
    patch={};
    const event=JSON.stringify({fecha:new Date().toISOString(),usuario:user.email,accion:"Gasto agregado",descripcion:description,monto:cost,id:z.string().uuid().parse(form.get("expenseId"))});
    await getDb().execute(sql`UPDATE public.f1_os_requests SET details=jsonb_set(details,'{Gastos}', COALESCE(details->'Gastos','[]'::jsonb) || ${event}::jsonb) WHERE id=${id.data} AND NOT COALESCE(details->'Gastos','[]'::jsonb) @> ${JSON.stringify([{id:String(form.get("expenseId"))}])}::jsonb`);
    revalidatePath("/analisis-os");
    return null;
  } else return "Operación inválida.";
  const event={fecha:new Date().toISOString(),usuario:user.email,accion:action};
  await getDb().execute(sql`UPDATE public.f1_os_requests SET details=(details || ${JSON.stringify(patch)}::jsonb) || jsonb_build_object('Eventos',COALESCE(details->'Eventos','[]'::jsonb) || ${JSON.stringify(event)}::jsonb) WHERE id=${id.data}`);
  revalidatePath("/analisis-os");
  return null;
}

export default async function AnalysisPage() {
  const {user, logistics} = await getAccess();
  const rows = await getDb().execute<{
    key: string; collector: string; coordinator: string; site: string; description: string;
    cost: number; lpu: number; reference: string; details: Record<string,string>;
  }>(sql`SELECT id::text AS key, collector, coordinator, site, description, cost::float8 AS cost,
       lpu::float8 AS lpu, reference, (details - 'PDF') || jsonb_build_object('Fecha de solicitud',created_at::text) AS details FROM public.f1_os_requests
       ${logistics ? sql`` : sql`WHERE owner_email = ${user.email}`} ORDER BY created_at DESC`);
  const suppliers=await getDb().execute<{ruc:string;name:string}>(sql`SELECT document_number AS ruc,business_name AS name FROM suppliers WHERE active=true ORDER BY business_name`);
  return <Analysis suppliers={Array.from(suppliers)} saveTracking={saveTracking} saved={Array.from(rows)} logistics={logistics} fields={fields} submit={submit} />;
}
