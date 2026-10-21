import { getAuthenticatedUser, getKardexAccess } from "../app/auth";
import { createSupabaseAdminClient } from "./supabase-auth";
import { canManageFleet, PHOTO_SLOTS, type FleetPhoto } from "./fleet";

export const FLEET_BUCKET = "kardex-evidencias";
export const FLEET_PREFIX = `supabase://${FLEET_BUCKET}/`;
export class FleetError extends Error { constructor(message: string, public status = 400) { super(message); } }
export async function fleetAccess() {
  const user = await getAuthenticatedUser();
  if (!user) throw new FleetError("Inicia sesión para acceder al módulo.", 401);
  const access = await getKardexAccess(user.email, user.userId, user.authProvider);
  if (!access?.active || !["ADMINISTRADOR", "LOGISTICA", "SOLO_LECTURA", "CONDUCTOR"].includes(access.role)) throw new FleetError("Tu perfil no tiene acceso al control de vehículos.", 403);
  if (user.authProvider === "supabase" && access.mustChangePassword) throw new FleetError("Primero debes cambiar tu contraseña temporal.", 403);
  return { id: access.id, displayName: access.displayName || user.displayName, role: access.role, username: access.username, actor: `${access.id}:${access.displayName || user.displayName}`, manager: canManageFleet(access.role) };
}
export function fleetFailure(error: unknown) {
  if (error instanceof FleetError) return Response.json({ error: error.message }, { status: error.status });
  const e = error as { code?: string; cause?: { code?: string } };
  const code = e.code || e.cause?.code;
  if (code === "23505") return Response.json({ error: "Este registro ya existe. Revisa la placa, fecha, documento o referencia para evitar duplicados." }, { status: 409 });
  console.error("fleet:", error instanceof Error ? error.message : "Error de datos");
  return Response.json({ error: "No se pudo completar la operación. Actualiza los datos e intenta nuevamente." }, { status: 500 });
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new FleetError("Origen no permitido.", 403);
}
export async function verifyAttachment(value: string, prefix: string, required = false) {
  if (!value && !required) return "";
  if (!value.startsWith(`${FLEET_PREFIX}${prefix}`) || value.includes("..")) throw new FleetError("Adjunta un archivo válido desde este formulario.");
  const path = value.slice(FLEET_PREFIX.length), index = path.lastIndexOf("/");
  const { data, error } = await createSupabaseAdminClient().storage.from(FLEET_BUCKET).list(path.slice(0, index), { search: path.slice(index + 1), limit: 5 });
  if (error || !data?.some(f => f.name === path.slice(index + 1) && f.id)) throw new FleetError("El archivo aún no terminó de subirse. Vuelve a cargarlo.");
  return value;
}
export async function verifyPhotos(input: unknown, prefix: string): Promise<FleetPhoto[]> {
  if (!Array.isArray(input) || input.length !== PHOTO_SLOTS.length) throw new FleetError("Debes adjuntar las siete fotografías requeridas.");
  const photos = input as FleetPhoto[];
  if (new Set(photos.map(p => p.path)).size !== 7 || new Set(photos.map(p => p.slot)).size !== 7) throw new FleetError("Cada fotografía debe ocupar una posición diferente.");
  return Promise.all(PHOTO_SLOTS.map(async slot => {
    const p = photos.find(photo => photo.slot === slot);
    if (!p || typeof p.path !== "string" || !/\.(jpg|jpeg|png|webp)$/i.test(p.path)) throw new FleetError(`Falta la fotografía: ${slot}.`);
    return { slot, path: await verifyAttachment(p.path, prefix, true) };
  }));
}
