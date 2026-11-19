import { sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { getAuthenticatedUser, getKardexAccess } from "../../auth";

export async function GET(request: Request) {
  const user=await getAuthenticatedUser();
  if(!user) return new Response("Acceso requerido",{status:401});
  const access=await getKardexAccess(user.email,user.userId,user.authProvider);
  if(!access?.active || access.mustChangePassword) return new Response("Acceso denegado",{status:403});
  const id=new URL(request.url).searchParams.get("id")??"";
  if(!/^[0-9a-f-]{36}$/i.test(id)) return new Response("ID inválido",{status:400});
  const logistics=access.role==="ADMINISTRADOR" || access.role==="LOGISTICA";
  const purchase=new URL(request.url).searchParams.get("tipo")==="oc";
  if(purchase && !logistics)return new Response("Acceso denegado",{status:403});
  const rows=purchase ? await getDb().execute<{pdf:string}>(sql`SELECT details->>'PDF' AS pdf FROM f1_os_purchase_expenses WHERE id=${id}`) : await getDb().execute<{pdf:string}>(sql`SELECT details->>'PDF' AS pdf FROM f1_os_requests WHERE id=${id} ${logistics?sql``:sql`AND owner_email=${user.email}`}`);
  if(!rows[0]?.pdf) return new Response("PDF no encontrado",{status:404});
  return new Response(Buffer.from(rows[0].pdf,"base64"),{headers:{"Content-Type":"application/pdf","Content-Disposition":"inline; filename=orden.pdf","Cache-Control":"private, no-store"}});
}
