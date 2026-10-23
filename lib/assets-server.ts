import { getAuthenticatedUser, getKardexAccess } from "../app/auth";
export const ASSET_BUCKET = "f1-activos";
export class AssetError extends Error { constructor(message: string, public status = 400) { super(message); } }
export async function assetAccess() {
  const user = await getAuthenticatedUser();
  if (!user) throw new AssetError("Inicia sesión para acceder a Activos F1.", 401);
  const access = await getKardexAccess(user.email, user.userId, user.authProvider);
  if (!access?.active || (user.authProvider === "supabase" && access.mustChangePassword)) throw new AssetError("Tu cuenta no tiene acceso o requiere cambiar su contraseña.", 403);
  return { id: access.id, displayName: access.displayName || user.displayName, username: access.username, role: access.role, active: true, manager: ["ADMINISTRADOR", "LOGISTICA"].includes(access.role), actor: `${access.id}:${access.displayName || user.displayName}` };
}
export function assetFailure(error: unknown) {
  if (error instanceof AssetError) return Response.json({ error: error.message }, { status: error.status });
  const e = error as { code?: string; cause?: { code?: string } };
  if ((e.code || e.cause?.code) === "23505") return Response.json({ error: "El código o número de serie ya está registrado." }, { status: 409 });
  console.error("assets", error instanceof Error ? error.message : "Error de datos");
  return Response.json({ error: "No se pudo guardar la operación. Actualiza los datos y vuelve a intentarlo." }, { status: 500 });
}
export function assetOrigin(request: Request) { const origin = request.headers.get("origin"); if (origin && origin !== new URL(request.url).origin) throw new AssetError("Origen no permitido.", 403); }
