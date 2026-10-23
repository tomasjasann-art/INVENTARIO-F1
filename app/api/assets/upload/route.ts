import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../../db";
import { assetAssignments, assetFiles } from "../../../../db/assets-schema";
import { ASSET_BUCKET, assetAccess, assetFailure, AssetError, assetOrigin } from "../../../../lib/assets-server";
import { createSupabaseAdminClient } from "../../../../lib/supabase-auth";
export const runtime = "nodejs";
const mimeTypes=["image/jpeg","image/png","image/webp","application/pdf","video/mp4","video/webm","video/quicktime"] as const;
export async function POST(request:Request) {
  try {
    assetOrigin(request); const user=await assetAccess();
    const v=z.object({name:z.string().trim().min(1).max(180),contentType:z.enum(mimeTypes),size:z.number().int().positive().max(30000000),assignmentId:z.number().int().positive().optional()}).parse(await request.json());
    if(user.role==="SOLO_LECTURA") throw new AssetError("Tu perfil es de consulta.",403);
    let assetId:number|null=null;
    if(v.assignmentId) { const [a]=await getDb().select().from(assetAssignments).where(and(eq(assetAssignments.id,v.assignmentId),eq(assetAssignments.cancelled,false))).limit(1); if(!a || a.draft || a.returned===a.quantity || (!user.manager && a.userId!==user.id)) throw new AssetError("No puedes adjuntar archivos a esta asignación.",403); assetId=a.assetId; }
    else if(!user.manager) throw new AssetError("Selecciona uno de tus equipos asignados.",403);
    const client=createSupabaseAdminClient(), {data:bucket,error:bucketError}=await client.storage.getBucket(ASSET_BUCKET);
    if(bucketError || !bucket || bucket.public) throw new AssetError("El almacenamiento privado de activos no está disponible.",503);
    const extensions:Record<string,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","application/pdf":"pdf","video/mp4":"mp4","video/webm":"webm","video/quicktime":"mov"};
    const path=`${user.id}/${crypto.randomUUID()}.${extensions[v.contentType]}`;
    const {data,error}=await client.storage.from(ASSET_BUCKET).createSignedUploadUrl(path,{upsert:false});
    if(error||!data) throw new AssetError("No se pudo preparar el archivo.",503);
    const [file]=await getDb().insert(assetFiles).values({userId:user.id,assetId,path,name:v.name.replace(/[\r\n\\/]/g,"_"),mime:v.contentType,size:v.size}).returning({id:assetFiles.id,name:assetFiles.name,mime:assetFiles.mime});
    return Response.json({signedUrl:data.signedUrl,file});
  }catch(e){if(e instanceof z.ZodError)return Response.json({error:"Adjunta una imagen, PDF o video de hasta 30 MB."},{status:400});return assetFailure(e);}
}
