import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../../db";
import { fleetAssignments } from "../../../../db/schema";
import { fleetAccess, fleetFailure, FleetError, FLEET_BUCKET, FLEET_PREFIX, sameOrigin } from "../../../../lib/fleet-server";
import { createSupabaseAdminClient } from "../../../../lib/supabase-auth";
import { isAdministrative } from "../../../../lib/fleet";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await fleetAccess();
    const body = z.object({ purpose: z.enum(["INICIO", "FINAL", "document", "expense", "invoice", "payment"]), assignmentId: z.number().int().positive().optional(), contentType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]), size: z.number().positive().max(8_000_000) }).parse(await request.json());
    let folder = `fleet/${user.id}/${body.purpose}/`;
    if (body.purpose === "INICIO" || body.purpose === "FINAL") {
      const [a] = await getDb().select().from(fleetAssignments).where(and(eq(fleetAssignments.id, body.assignmentId || 0), ...(user.manager ? [] : [eq(fleetAssignments.driverId, user.id)]))).limit(1);
      if (!a || !["CONDUCTOR", "LOGISTICA", "ADMINISTRADOR"].includes(user.role)) throw new FleetError("Asignación no disponible.", 403);
      if (isAdministrative(a)) throw new FleetError("El registro administrativo no requiere fotografías.");
      if (a.planStatus !== "CONFIRMADA" || a.endedAt || (body.purpose === "INICIO" && a.startedAt) || (body.purpose === "FINAL" && !a.startedAt)) throw new FleetError("La jornada no admite este registro.");
      if (body.contentType === "application/pdf") throw new FleetError("Para el control diario debes adjuntar fotografías.");
      folder = `fleet/${user.id}/assignment-${a.id}/${body.purpose}/`;
    } else if (!user.manager) throw new FleetError("Solo Logística puede adjuntar documentos y gastos.", 403);
    const client = createSupabaseAdminClient();
    const { data: bucket, error: bucketError } = await client.storage.getBucket(FLEET_BUCKET);
    if (!bucket) throw new FleetError("El almacenamiento de evidencias no está disponible.", 503);
    if (bucketError || bucket.public) throw new FleetError("Las evidencias requieren almacenamiento privado.", 503);
    const extension = body.contentType === "application/pdf" ? "pdf" : body.contentType === "image/png" ? "png" : body.contentType === "image/webp" ? "webp" : "jpg";
    const path = `${folder}${crypto.randomUUID()}.${extension}`;
    const { data, error } = await client.storage.from(FLEET_BUCKET).createSignedUploadUrl(path, { upsert: false });
    if (error || !data) throw new FleetError("No se pudo preparar la carga del archivo.", 503);
    return Response.json({ signedUrl: data.signedUrl, path: `${FLEET_PREFIX}${path}` });
  } catch (e) { if (e instanceof z.ZodError) return Response.json({ error: "El archivo debe ser una imagen o PDF de hasta 8 MB." }, { status: 400 }); return fleetFailure(e); }
}
