import { and, eq, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../db";
import { appUsers } from "../../../db/schema";
import { assets, assetAssignments as assignments, assetEvents as events, assetTransfers as transfers, assetServices as services, assetIncidents as incidents, assetFiles as files } from "../../../db/assets-schema";
import { ASSET_BUCKET, assetAccess, assetFailure, AssetError, assetOrigin } from "../../../lib/assets-server";
import { createSupabaseAdminClient } from "../../../lib/supabase-auth";
import { assetToday, positiveQuantity, returnBalance } from "../../../lib/assets";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const id = z.number().int().positive(), text = z.string().trim().max(2000).default("");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v, "Fecha inválida");
const optionalDay = z.union([z.literal(""), day]).default("");
const amount = z.number().finite().min(0).max(20000000).transform(v => Math.round(v * 100));
const condition = z.enum(["Nuevo", "Bueno", "Regular", "Dañado", "Perdido"]);
const fileIds = z.array(id).max(12).default([]);
const master = z.object({ code: z.string().trim().min(1).max(100).transform(v=>v.toUpperCase()), item: text, type: z.enum(["Equipo", "Herramienta", "Otro"]), category: z.string().trim().min(1).max(100), description: z.string().trim().min(1).max(500), serial: z.string().trim().max(150).default("").transform(v=>v.toUpperCase()), brand: text, model: text, serialized: z.boolean(), total: z.number().int().min(1).max(100000), condition, location: text, purchaseDate: optionalDay, cost: amount, currency: z.enum(["PEN", "USD"]), supplier: text, requiresCalibration: z.boolean(), calibrationDue: optionalDay, maintenanceDue: optionalDay, notes: text, photoId: id.nullable().default(null), active: z.boolean().default(true) });
const assignmentMeta = z.object({ dni: z.string().regex(/^\d{8}$|^$/).default(""), area: text, city: text, costCenter: text, client: text, project: text, expectedReturn: optionalDay, accessories: text, notes: text });
export async function GET(request: Request) {
  try {
    const user = await assetAccess(), db = getDb(), url = new URL(request.url);
    if (url.searchParams.has("file")) {
      const fileId = Number(url.searchParams.get("file"));
      const [file] = await db.select().from(files).where(and(eq(files.id, fileId), eq(files.linked, true))).limit(1);
      if (!file) throw new AssetError("Archivo no encontrado.", 404);
      const { data, error } = await createSupabaseAdminClient().storage.from(ASSET_BUCKET).createSignedUrl(file.path, 300, { download: url.searchParams.has("download") ? file.name : false });
      if (error || !data) throw new AssetError("No se pudo abrir el archivo.", 503);
      return Response.redirect(data.signedUrl, 302);
    }
    const result = await db.transaction(async tx => {
      const [a,b,c,d,e,f,p,g] = await Promise.all([
        tx.select().from(assets).orderBy(desc(assets.id)), tx.select().from(assignments).orderBy(desc(assignments.id)), tx.select().from(events).orderBy(desc(events.id)), tx.select().from(transfers).orderBy(desc(transfers.id)), tx.select().from(services).orderBy(desc(services.id)), tx.select().from(incidents).orderBy(desc(incidents.id)), tx.select({id:appUsers.id, displayName:appUsers.displayName, username:appUsers.username, role:appUsers.role, active:appUsers.active}).from(appUsers), tx.select({id:files.id,name:files.name,mime:files.mime}).from(files).where(eq(files.linked,true))
      ]);
      return { assets:a, assignments:b, events:c, transfers:d, services:e, incidents:f, people:p, files:g };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
    return Response.json({ user, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch(e) { return assetFailure(e); }
}
export async function POST(request: Request) {
  try {
    assetOrigin(request); const user = await assetAccess(), body = await request.json(), action = z.string().parse(body.action), db=getDb();
    const selfActions = ["transfer", "acceptTransfer", "rejectTransfer", "incident"];
    if (!user.manager && !selfActions.includes(action)) throw new AssetError("Solo Logística puede realizar esta operación.",403);
    if (!user.manager && ["SOLO_LECTURA"].includes(user.role)) throw new AssetError("Tu perfil es de consulta.",403);
    await db.transaction(async tx => {
      // One module lock provides a consistent lock order across stock, returns, transfers and services.
      await tx.execute(sql`select pg_advisory_xact_lock(7620, 1)`);
      const now = new Date().toISOString();
      async function getAsset(assetId: number) { const [a]=await tx.select().from(assets).where(eq(assets.id,assetId)).for("update").limit(1); if(!a) throw new AssetError("Activo no encontrado.",404); return a; }
      async function getAssignment(assignmentId: number) { const [a]=await tx.select().from(assignments).where(eq(assignments.id,assignmentId)).for("update").limit(1); if(!a || a.cancelled) throw new AssetError("Asignación no disponible.",404); return a; }
      async function person(userId:number) { const [p]=await tx.select().from(appUsers).where(and(eq(appUsers.id,userId),eq(appUsers.active,true))).limit(1); if(!p) throw new AssetError("Selecciona un trabajador con cuenta activa."); return p; }
      async function log(assetId:number, kind:string, data:Record<string,unknown>, assignmentId:number|null=null, attached:number[]=[]) { await tx.insert(events).values({assetId,kind,data,assignmentId,actor:user.actor,at:now,files:attached}); }
      async function attach(ids:number[], assetId:number) {
        for(const fileId of ids) {
          const [f]=await tx.select().from(files).where(and(eq(files.id,fileId),eq(files.userId,user.id),eq(files.linked,false))).limit(1);
          if(!f || (f.assetId && f.assetId!==assetId)) throw new AssetError("El archivo no pertenece a esta operación.");
          const slash=f.path.lastIndexOf("/"); const {data,error}=await createSupabaseAdminClient().storage.from(ASSET_BUCKET).list(f.path.slice(0,slash),{search:f.path.slice(slash+1),limit:5});
          const object=data?.find(o=>o.name===f.path.slice(slash+1));
          if(error || !object?.id || Number(object.metadata?.size)!==f.size || Number(object.metadata?.size)>30000000 || object.metadata?.mimetype!==f.mime) throw new AssetError("La carga del archivo no es válida o no ha terminado.");
          await tx.update(files).set({linked:true,assetId}).where(eq(files.id,fileId));
        }
      }
      async function pending(assignmentId:number) { const rows=await tx.select().from(transfers).where(and(eq(transfers.assignmentId,assignmentId),eq(transfers.status,"Pendiente"))); if(rows.length) throw new AssetError("Resuelve primero el traspaso pendiente.",409); }
      async function clearForUse(a:typeof assets.$inferSelect) {
        if(!a.active || ["Dañado","Perdido"].includes(a.condition)) throw new AssetError("El activo está inactivo o no está operativo.");
        if(a.requiresCalibration && (!a.calibrationDue || a.calibrationDue<assetToday())) throw new AssetError("El activo requiere calibración vigente antes de asignarse.");
        if(a.serialized) {const open=await tx.select().from(incidents).where(and(eq(incidents.assetId,a.id),eq(incidents.status,"Abierta")));if(open.length) throw new AssetError("Resuelve la incidencia del equipo antes de asignarlo o traspasarlo.");}
      }
      const updateStock = async (a:typeof assets.$inferSelect, available:number, quarantined=a.quarantined) => { if(available<0||quarantined<0||available+quarantined>a.total) throw new AssetError("Saldo de existencias inválido.",409); await tx.update(assets).set({available,quarantined,version:a.version+1}).where(eq(assets.id,a.id)); };
      if(action==="asset") {
        const {cost:costCents,...v}=master.parse(body); const assetId=body.id?id.parse(body.id):null;
        if(v.serialized && (v.total!==1 || !v.serial)) throw new AssetError("Cada equipo serializado requiere una serie y cantidad 1.");
        if(v.purchaseDate>assetToday()) throw new AssetError("La fecha de compra no puede ser futura.");
        if(v.serialized && !v.requiresCalibration && v.calibrationDue) throw new AssetError("Marca que requiere calibración para registrar su vigencia.");
        if(v.requiresCalibration && !v.serialized) throw new AssetError("Registra individualmente los equipos que requieren calibración.");
        if(assetId) {
          const old=await getAsset(assetId); if(old.version!==body.version) throw new AssetError("El activo cambió. Actualiza antes de editar.",409);
          const moved=await tx.select({id:events.id}).from(events).where(eq(events.assetId,assetId)).limit(2);
          if(moved.length>1 && (old.total!==v.total || old.serialized!==v.serialized || old.serial!==v.serial)) throw new AssetError("El activo tiene movimientos; conserva su serie, control y cantidad total.");
          const serviceHistory=await tx.select({id:services.id}).from(services).where(eq(services.assetId,assetId)).limit(1);
          if(serviceHistory.length && (old.calibrationDue!==v.calibrationDue || old.maintenanceDue!==v.maintenanceDue)) throw new AssetError("Actualiza las fechas mediante el registro del servicio y su documentación.");
          if(v.condition!==old.condition && old.available!==old.total) throw new AssetError("Registra la condición mediante devolución, incidencia o mantenimiento.");
          if(v.photoId!==old.photoId && v.photoId) { const [photo]=await tx.select().from(files).where(eq(files.id,v.photoId)).limit(1); if(!photo?.mime.startsWith("image/")) throw new AssetError("La ficha requiere una fotografía."); await attach([v.photoId],assetId); }
          const quarantine=["Dañado","Perdido"].includes(v.condition)?v.total:0;
          const stockChanged=v.total!==old.total||v.condition!==old.condition;
          await tx.update(assets).set({...v,costCents,available:stockChanged?v.total-quarantine:old.available,quarantined:stockChanged?quarantine:old.quarantined,version:old.version+1}).where(eq(assets.id,assetId));
          await log(assetId,"Edición de activo",{before:old,after:{...v,costCents}});
        } else {
          const quarantine=["Dañado","Perdido"].includes(v.condition)?v.total:0;
          const [a]=await tx.insert(assets).values({...v,costCents,available:v.total-quarantine,quarantined:quarantine,photoId:null}).returning();
          if(v.photoId) { const [photo]=await tx.select().from(files).where(eq(files.id,v.photoId)).limit(1); if(!photo?.mime.startsWith("image/")) throw new AssetError("La ficha requiere una fotografía."); await attach([v.photoId],a.id); await tx.update(assets).set({photoId:v.photoId}).where(eq(assets.id,a.id)); }
          await log(a.id,"Registro de activo",{...v,costCents});
        }
      } else if(action==="assign") {
        const v=z.object({assetId:id,userId:id,quantity:id,assignedAt:day,condition,draft:z.boolean().default(false),files:fileIds}).parse(body), meta=assignmentMeta.parse(body), a=await getAsset(v.assetId);
        await person(v.userId); if(!v.draft) { await clearForUse(a); positiveQuantity(v.quantity,a.available); } else positiveQuantity(v.quantity,a.total);
        if(v.assignedAt>assetToday() || (meta.expectedReturn && meta.expectedReturn<v.assignedAt)) throw new AssetError("Revisa las fechas de asignación y devolución prevista.");
        if(["Dañado","Perdido"].includes(v.condition)) throw new AssetError("No se puede entregar un equipo dañado o perdido.");
        await attach(v.files,a.id);
        const [{code}]=await tx.execute<{code:string}>(sql`select 'AF1-' || lpad(nextval('f1_asset_assignment_code_seq')::text, 7, '0') as code`);
        const [saved]=await tx.insert(assignments).values({...v,...meta,code,assignedBy:user.actor}).returning();
        if(!v.draft) await updateStock(a,a.available-v.quantity); await log(a.id,"Asignación",{...v,...meta,code},saved.id,v.files);
      } else if(action==="publishAssignment") {
        const a=await getAssignment(id.parse(body.id)); if(!a.draft || a.version!==body.version) throw new AssetError("El borrador cambió. Actualiza.",409); const item=await getAsset(a.assetId); await person(a.userId); await clearForUse(item); positiveQuantity(a.quantity,item.available); await updateStock(item,item.available-a.quantity); await tx.update(assignments).set({draft:false,version:a.version+1}).where(eq(assignments.id,a.id)); await log(item.id,"Borrador confirmado",{quantity:a.quantity,userId:a.userId},a.id);
      } else if(action==="editAssignment") {
        const a=await getAssignment(id.parse(body.id)); if(a.version!==body.version) throw new AssetError("La asignación cambió. Actualiza.",409);
        const v=assignmentMeta.parse(body); if(v.expectedReturn && v.expectedReturn<a.assignedAt) throw new AssetError("La devolución prevista debe ser posterior a la entrega.");
        await tx.update(assignments).set({...v,version:a.version+1}).where(eq(assignments.id,a.id)); await log(a.assetId,"Edición de asignación",{before:a,after:v},a.id);
      } else if(action==="return" || action==="cancelAssignment") {
        const a=await getAssignment(id.parse(body.id)), asset=await getAsset(a.assetId); await pending(a.id);
        if(a.version!==body.version) throw new AssetError("La asignación cambió. Actualiza.",409);
        const isCancel=action==="cancelAssignment", quantity=isCancel?a.quantity:id.parse(body.quantity), reason=z.string().trim().min(1).max(2000).parse(body.notes), c=isCancel?a.condition:condition.parse(body.condition), date=isCancel?assetToday():day.parse(body.date), attached=fileIds.parse(body.files);
        if(a.draft && !isCancel) throw new AssetError("Confirma primero la asignación en borrador.");
        if(isCancel && a.returned) throw new AssetError("Una asignación con devoluciones no se puede anular.");
        if(date<a.assignedAt || date>assetToday()) throw new AssetError("Revisa la fecha real de devolución.");
        const returned=returnBalance(a,quantity); await attach(attached,asset.id);
        const blocked=["Dañado","Perdido"].includes(c);
        const open=await tx.select().from(incidents).where(and(eq(incidents.assignmentId,a.id),eq(incidents.status,"Abierta")));
        if(isCancel && open.length) throw new AssetError("Resuelve la incidencia antes de anular la asignación.");
        if(!isCancel && open.length && !blocked) throw new AssetError("Con incidencia abierta, recibe en cuarentena o resuelve primero la incidencia.");
        await tx.update(assignments).set({returned:isCancel?0:returned,returnedAt:!isCancel&&returned===a.quantity?date:"",cancelled:isCancel,version:a.version+1}).where(eq(assignments.id,a.id));
        if(!a.draft) await updateStock(asset,asset.available+(blocked?0:quantity),asset.quarantined+(blocked?quantity:0));
        if(asset.serialized && !isCancel) await tx.update(assets).set({condition:c}).where(eq(assets.id,asset.id));
        await log(asset.id,isCancel?"Anulación":"Devolución",{quantity,condition:c,date,notes:reason,receivedBy:user.actor},a.id,attached);
      } else if(action==="transfer") {
        const a=await getAssignment(id.parse(body.id)); if(a.draft) throw new AssetError("Confirma primero la asignación."); if(!user.manager && a.userId!==user.id) throw new AssetError("Solo puedes traspasar tus propios equipos.",403);
        const toUserId=id.parse(body.toUserId), quantity=id.parse(body.quantity); await person(toUserId); await pending(a.id); positiveQuantity(quantity,a.quantity-a.returned); if(toUserId===a.userId) throw new AssetError("Selecciona otro receptor.");
        await clearForUse(await getAsset(a.assetId));
        const [t]=await tx.insert(transfers).values({assignmentId:a.id,toUserId,quantity,notes:text.parse(body.notes),createdBy:user.actor,createdAt:now}).returning();
        await log(a.assetId,"Traspaso solicitado",{transferId:t.id,toUserId,quantity},a.id);
      } else if(action==="acceptTransfer" || action==="rejectTransfer") {
        const [t]=await tx.select().from(transfers).where(eq(transfers.id,id.parse(body.id))).for("update").limit(1);
        if(!t || t.status!=="Pendiente") throw new AssetError("El traspaso ya fue atendido.",409);
        const a=await getAssignment(t.assignmentId);
        if(action==="acceptTransfer" && t.toUserId!==user.id) throw new AssetError("La recepción debe confirmarla el técnico destinatario.",403);
        if(action==="rejectTransfer" && !user.manager && ![a.userId,t.toUserId].includes(user.id)) throw new AssetError("No puedes resolver este traspaso.",403);
        if(action==="acceptTransfer") {
          await person(t.toUserId); await clearForUse(await getAsset(a.assetId)); const returned=returnBalance(a,t.quantity);
          const [{code}]=await tx.execute<{code:string}>(sql`select 'AF1-' || lpad(nextval('f1_asset_assignment_code_seq')::text, 7, '0') as code`);
          const [received]=await tx.insert(assignments).values({assetId:a.assetId,userId:t.toUserId,quantity:t.quantity,code,assignedAt:assetToday(),assignedBy:user.actor,condition:a.condition,area:a.area,city:a.city,costCenter:a.costCenter,client:a.client,project:a.project,expectedReturn:a.expectedReturn,notes:t.notes,accessories:a.accessories}).returning();
          await tx.update(assignments).set({returned,returnedAt:returned===a.quantity?assetToday():"",version:a.version+1}).where(eq(assignments.id,a.id));
          await log(a.assetId,"Traspaso aceptado",{transferId:t.id,fromUserId:a.userId,toUserId:t.toUserId,quantity:t.quantity,newAssignmentId:received.id},a.id);
        }
        await tx.update(transfers).set({status:action==="acceptTransfer"?"Aceptado":"Rechazado",resolvedAt:now}).where(eq(transfers.id,t.id));
        if(action==="rejectTransfer") await log(a.assetId,"Traspaso rechazado",{transferId:t.id},a.id);
      } else if(action==="incident") {
        const a=await getAssignment(id.parse(body.id)); if(a.draft || a.quantity===a.returned || (!user.manager && a.userId!==user.id)) throw new AssetError("La incidencia debe corresponder a un equipo a tu cargo.",403);
        const description=z.string().trim().min(5).max(2000).parse(body.description), attached=fileIds.parse(body.files); await attach(attached,a.assetId);
        const [i]=await tx.insert(incidents).values({assetId:a.assetId,assignmentId:a.id,userId:user.id,description,files:attached,createdAt:now}).returning();
        await log(a.assetId,"Incidencia reportada",{incidentId:i.id,description},a.id,attached);
      } else if(action==="resolveIncident") {
        const [i]=await tx.select().from(incidents).where(eq(incidents.id,id.parse(body.id))).limit(1); if(!i || i.status!=="Abierta") throw new AssetError("Incidencia no disponible.",409);
        const resolution=z.string().trim().min(5).max(2000).parse(body.resolution); await tx.update(incidents).set({status:"Cerrada",resolution}).where(eq(incidents.id,i.id)); await log(i.assetId,"Incidencia cerrada",{incidentId:i.id,resolution},i.assignmentId);
      } else if(action==="service") {
        const v=z.object({assetId:id,kind:z.enum(["Calibración","Mantenimiento preventivo","Mantenimiento correctivo"]),quantity:id,date:day,provider:z.string().trim().min(1).max(200),notes:text}).parse(body), a=await getAsset(v.assetId);
        if(v.date>assetToday()) throw new AssetError("La fecha de inicio no puede ser futura.");
        const source=z.enum(["Disponible","Cuarentena"]).parse(body.source); if(source==="Disponible") { positiveQuantity(v.quantity,a.available); await updateStock(a,a.available-v.quantity,a.quarantined+v.quantity); }
        else { const active=await tx.select().from(services).where(and(eq(services.assetId,a.id),eq(services.status,"En proceso"))); positiveQuantity(v.quantity,a.quarantined-active.reduce((s,v)=>s+v.quantity,0)); }
        const [s]=await tx.insert(services).values({...v,status:"En proceso",createdBy:user.actor}).returning(); await log(a.id,"Servicio iniciado",{serviceId:s.id,...v,source});
      } else if(action==="finishService") {
        const [s]=await tx.select().from(services).where(eq(services.id,id.parse(body.id))).for("update").limit(1); if(!s || s.status!=="En proceso") throw new AssetError("Servicio no disponible.",409);
        const a=await getAsset(s.assetId), v=z.object({date:day,nextDue:optionalDay,certificate:text,cost:amount,notes:text,files:fileIds,approved:z.boolean()}).parse(body);
        if(v.date<s.date || v.date>assetToday() || (v.nextDue && v.nextDue<=v.date)) throw new AssetError("Revisa las fechas del servicio y del próximo vencimiento.");
        if(s.kind==="Calibración" && v.approved && (!v.nextDue || !v.certificate || !v.files.length)) throw new AssetError("Para aprobar la calibración adjunta el certificado, su número y la próxima fecha.");
        await attach(v.files,a.id);
        if(v.approved) {
          const open=await tx.select().from(incidents).where(and(eq(incidents.assetId,a.id),eq(incidents.status,"Abierta"))); if(a.serialized && open.length) throw new AssetError("Cierra la incidencia antes de liberar el equipo.");
          await updateStock(a,a.available+s.quantity,a.quarantined-s.quantity);
          await tx.update(assets).set({...(a.serialized?{condition:"Bueno"}:{}),...(s.kind==="Calibración"?{calibrationDue:v.nextDue}: {maintenanceDue:v.nextDue})}).where(eq(assets.id,a.id));
        }
        await tx.update(services).set({status:v.approved?"Completado":"No aprobado",nextDue:v.nextDue,certificate:v.certificate,costCents:v.cost,notes:v.notes,files:v.files}).where(eq(services.id,s.id)); await log(a.id,"Servicio finalizado",{serviceId:s.id,...v},null,v.files);
      } else throw new AssetError("Operación no reconocida.");
    });
    return Response.json({ok:true});
  } catch(e) { if(e instanceof z.ZodError) return Response.json({error:e.issues.map(i=>`${i.path.join(".")}: ${i.message}`).slice(0,4).join(" · ")},{status:400}); if(e instanceof Error && e.message.startsWith("La cantidad")) return Response.json({error:e.message},{status:400}); return assetFailure(e); }
}
