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
  const canReview=access.id===3;
  if (!logistics && !canReview && access.role !== "COORDINADOR") redirect("/");
  let coordinator=access.displayName || user.displayName;
  if("coordinatorId" in access && access.coordinatorId){
    const rows=await getDb().execute(sql`SELECT name FROM coordinators WHERE id=${access.coordinatorId} AND active=true LIMIT 1`);
    if(rows[0])coordinator=String(rows[0].name);
  }
  return { user, logistics, canReview, coordinator };
}

const fields = ["ID", "CECO", "Año", "Cliente", "Proyecto", "Tipo de comprobante", "RUC", "Contratista", "Contacto", "Cantidad", "Tipo de orden", "Comentarios"];
const input = z.object({
  id: z.string().uuid(),
  collector: z.string().trim().min(1).max(160),
  site: z.string().trim().min(1).max(240),
  description: z.string().trim().min(1).max(1000),
  cost: z.coerce.number().positive().max(999999999999),
  lpu: z.coerce.number().nonnegative().max(999999999999),
  reference: z.string().trim().max(150).default(""),
});

async function submit(form: FormData) {
  "use server";
  const {user, coordinator: ownCoordinator, logistics} = await getAccess();
  const selectedCoordinator=String(form.get("coordinator")??"").trim();
  let coordinator=ownCoordinator;
  if(selectedCoordinator){
    const found=await getDb().execute(sql`SELECT name FROM coordinators WHERE active=true AND organization=\'F1\' AND name=${selectedCoordinator} LIMIT 1`);
    if(!found.length)return "Selecciona un coordinador F1 de la lista.";
    coordinator=String(found[0].name);
  }
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
    const requests=await getDb().execute(sql`SELECT details FROM f1_os_requests WHERE id=${id.data} LIMIT 1`);
    if(!requests.length)return "Solicitud no encontrada.";
    const info=requests[0].details as Record<string,unknown>;
    if(info["Tipo de orden"]!=="Orden de Compra" && info.Status!=="Aprobada" && info.Status!=="OS emitida")return "La OS requiere la aprobación de José antes de registrar su emisión.";
    const number=String(form.get("number")??"").trim();
    const link=String(form.get("link")??"").trim();
    if(!number) return "Ingresa el número de orden.";
    if(link && !/^https?:\/\//i.test(link)) return "El enlace debe comenzar con https:// o http://.";
    patch={"OS Contrata":number,"Link de OS":link,Status:"OS emitida","Solicitud":String(form.get("solicitud")??"").trim().slice(0,500)};
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
    const event=JSON.stringify({fecha:new Date().toISOString(),usuario:user.email,accion:"Gasto agregado",solicitud:String(form.get("solicitud")??"").trim().slice(0,500),descripcion:description,monto:cost,id:z.string().uuid().parse(form.get("expenseId"))});
    await getDb().execute(sql`UPDATE public.f1_os_requests SET details=jsonb_set(details,'{Gastos}', COALESCE(details->'Gastos','[]'::jsonb) || ${event}::jsonb) || jsonb_build_object('Revisión versión',COALESCE((details->>'Revisión versión')::int,0)+1) || CASE WHEN details->>'Status'='Aprobada' THEN '{"Status":"Sustentada","Último mensaje":"Se agregó un gasto después de la aprobación. Requiere nueva revisión.","Mensaje para":"José Ortiz","Aprobado por":"","Fecha de aprobación":""}'::jsonb ELSE '{}'::jsonb END WHERE id=${id.data} AND NOT COALESCE(details->'Gastos','[]'::jsonb) @> ${JSON.stringify([{id:String(form.get("expenseId"))}])}::jsonb`);
    revalidatePath("/analisis-os");
    return null;
  } else return "Operación inválida.";
  const event={fecha:new Date().toISOString(),usuario:user.email,accion:action};
  await getDb().execute(sql`UPDATE public.f1_os_requests SET details=(details || ${JSON.stringify(patch)}::jsonb) || jsonb_build_object('Eventos',COALESCE(details->'Eventos','[]'::jsonb) || ${JSON.stringify(event)}::jsonb) WHERE id=${id.data}`);
  revalidatePath("/analisis-os");
  return null;
}


async function importPurchasePdf(form:FormData){
 "use server";
 const {user,logistics}=await getAccess();
 if(!logistics)return "Solo Logística puede registrar gastos de OC.";
 const header=z.object({order:z.string().trim().regex(/^[A-Za-z0-9_-]{2,50}$/),provider:z.string().trim().min(1).max(500),ruc:z.string().regex(/^\d{11}$/),date:z.string().trim().min(1).max(30)}).safeParse(Object.fromEntries(form));
 if(!header.success)return "Revisa el número de OC, proveedor, RUC y fecha.";
 let parsed:unknown;
 try{parsed=JSON.parse(String(form.get("items")));}catch{return "Las líneas no son válidas.";}
 const result=z.array(z.object({collector:z.string().trim().min(1).max(160),ceco:z.string().trim().max(30),description:z.string().trim().min(1).max(4000),cost:z.coerce.number().positive().max(999999999),tax:z.coerce.number().nonnegative().max(999999999)})).min(1).max(200).safeParse(parsed);
 if(!result.success)return "Revisa el colector, descripción, subtotal e IGV de cada línea.";
 const pdf=form.get("pdf");
 if(!(pdf instanceof File)||pdf.size===0||pdf.size>2*1024*1024)return "Selecciona un PDF de hasta 2 MB.";
 const bytes=Buffer.from(await pdf.arrayBuffer());
 if(bytes.subarray(0,5).toString()!=="%PDF-")return "El archivo no es un PDF válido.";
 const order=header.data.order.toUpperCase();
 try{
  const response=await getDb().transaction(async tx=>{
   await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"f1-oc:"+order}))`);
   const existing=await tx.execute(sql`SELECT id FROM f1_os_purchase_expenses WHERE order_number=${order} LIMIT 1`);
   if(existing.length)return "La OC "+order+" ya está registrada. No se duplicaron sus gastos.";
   for(const [index,line] of result.data.entries()){
    const subtotal=Math.round(line.cost*100)/100,tax=Math.round(line.tax*100)/100,total=Math.round((subtotal+tax)*100)/100;
    const details={"CECO":line.ceco,"Contratista":header.data.provider,"RUC":header.data.ruc,"Fecha":header.data.date,"Moneda":"PEN","Origen":"PDF OC","PDF":bytes.toString("base64"),"PDF nombre":pdf.name.slice(0,200),"Registrado por":user.email,"Solicitado":String(form.get("coordinator")??"").trim().slice(0,200),"Tipo de orden":"Orden de Compra"};
    await tx.execute(sql`INSERT INTO f1_os_purchase_expenses (order_number,collector,line_number,description,subtotal,tax,total,details) VALUES (${order},${line.collector.toUpperCase()},${index+1},${line.description},${subtotal},${tax},${total},${JSON.stringify(details)}::jsonb)`);
   }
   return null;
  });
  revalidatePath("/analisis-os");return response;
 }catch{return "No se pudo registrar la OC. Sus líneas se guardan juntas. Puedes reintentar.";}
}


async function reviewService(form:FormData){
 "use server";
 const {user,canReview,coordinator}=await getAccess();
 const parsed=z.object({id:z.string().uuid(),action:z.enum(["observe","reply","approve"]),version:z.coerce.number().int().nonnegative(),message:z.string().trim().max(4000).default("")}).safeParse(Object.fromEntries(form));
 if(!parsed.success)return "Revisa la solicitud y el mensaje.";
 const {id,action,version,message}=parsed.data;
 if((action==="observe"||action==="approve")&&!canReview)return "La revisión corresponde a José Ortiz.";
 if(action!=="approve"&&!message)return "Escribe el comentario o sustento.";
 try{
  const error=await getDb().transaction(async tx=>{
   const records=await tx.execute<{owner_email:string;coordinator:string;details:Record<string,unknown>}>(sql`SELECT owner_email,coordinator,details FROM f1_os_requests WHERE id=${id} FOR UPDATE`);
   const record=records[0];if(!record)return "Solicitud no encontrada.";
   if(record.details["Tipo de orden"]==="Orden de Compra")return "Las OC se registran sin aprobación.";
   const current=Number(record.details["Revisión versión"]??0);
   if(current!==version)return "La solicitud cambió. Actualiza la página antes de continuar.";
   const state=String(record.details.Status??"Pendiente");
   if(state==="OS emitida")return "Esta solicitud ya tiene una OS emitida.";
   if(action==="reply" && record.owner_email!==user.email && record.coordinator!==coordinator)return "Solo el coordinador responsable puede enviar el sustento.";
   if(action==="reply"&&state!=="Observada")return "La solicitud no tiene una observación pendiente.";
   if(action==="approve"&&state==="Observada")return "Falta el sustento del coordinador para aprobar.";
   if(action==="approve"&&state==="Aprobada")return "La solicitud ya está aprobada.";
   const newState=action==="observe"?"Observada":action==="reply"?"Sustentada":"Aprobada";
   const now=new Date().toISOString();
   const correctedAmount=String(form.get("correctedCost")??"").trim();
   const correctedDescription=String(form.get("correctedDescription")??"").trim();
   if(action==="reply" && correctedAmount && (!Number.isFinite(Number(correctedAmount)) || Number(correctedAmount)<=0 || Number(correctedAmount)>999999999))return "El monto corregido debe ser mayor a cero.";
   if(correctedDescription.length>1000)return "La descripción corregida admite hasta 1000 caracteres.";
   if(action==="reply" && correctedAmount)await tx.execute(sql`UPDATE f1_os_requests SET cost=${Number(correctedAmount)} WHERE id=${id}`);
   if(action==="reply" && correctedDescription)await tx.execute(sql`UPDATE f1_os_requests SET description=${correctedDescription} WHERE id=${id}`);
   const event={fecha:now,usuario:user.email,accion:newState,mensaje:message,montoCorregido:action==="reply"?correctedAmount:"",descripcionCorregida:action==="reply"?correctedDescription:""};
   const patch={"Status":newState,"Revisión versión":current+1,"Último mensaje":message,"Mensaje para":action==="observe"?"Coordinador":"José Ortiz","Aprobado por":action==="approve"?user.email:"","Fecha de aprobación":action==="approve"?now:""};
   await tx.execute(sql`UPDATE f1_os_requests SET details=(details || ${JSON.stringify(patch)}::jsonb) || jsonb_build_object('Conversación',COALESCE(details->'Conversación','[]'::jsonb) || ${JSON.stringify(event)}::jsonb) WHERE id=${id}`);
   return null;
  });
  revalidatePath("/analisis-os");return error;
 }catch{return "No se pudo guardar la revisión. Intenta nuevamente.";}
}

export default async function AnalysisPage() {
  const {user, logistics, canReview, coordinator} = await getAccess();
  const rows = await getDb().execute<{
    key: string; collector: string; coordinator: string; site: string; description: string;
    cost: number; lpu: number; reference: string; details: Record<string,string>;
  }>(sql`SELECT id::text AS key, collector, coordinator, site, description, cost::float8 AS cost,
       lpu::float8 AS lpu, reference, (details - 'PDF') || jsonb_build_object('Fecha de solicitud',created_at::text) AS details FROM public.f1_os_requests
       ${logistics || canReview ? sql`` : sql`WHERE owner_email = ${user.email} OR coordinator = ${coordinator}`} ORDER BY created_at DESC`);
  const suppliers=await getDb().execute<{ruc:string;name:string}>(sql`SELECT document_number AS ruc,business_name AS name FROM suppliers WHERE active=true ORDER BY business_name`);
  const purchaseExpenses=(logistics || canReview) ? await getDb().execute<{
    key:string;collector:string;coordinator:string;site:string;description:string;cost:number;lpu:number;reference:string;details:Record<string,string>;
  }>(sql`SELECT id::text AS key,collector,COALESCE(details->>'Solicitado',details->>'Solicitante','') AS coordinator,'' AS site,description,subtotal::float8 AS cost,0::float8 AS lpu,'' AS reference,
    (details - 'PDF') || jsonb_build_object('Número OC',order_number,'IGV',tax::text,'Total con IGV',total::text,'Origen','OC registrada') AS details
    FROM public.f1_os_purchase_expenses ORDER BY created_at DESC`) : [];
  const coordinatorOptions=await getDb().execute<{name:string}>(sql`SELECT name FROM coordinators WHERE active=true AND organization='F1' ORDER BY name`);
  return <Analysis canReview={canReview} canOperate={logistics} reviewService={reviewService} coordinatorOptions={Array.from(coordinatorOptions).map(item=>item.name)} importPurchasePdf={importPurchasePdf} purchaseExpenses={Array.from(purchaseExpenses)} suppliers={Array.from(suppliers)} saveTracking={saveTracking} saved={Array.from(rows)} logistics={logistics || canReview} fields={fields} submit={submit} />;
}
