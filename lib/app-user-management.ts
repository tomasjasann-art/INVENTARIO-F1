import { and, eq, sql } from "drizzle-orm";
import type { getDb } from "../db";
import { appUsers, coordinators } from "../db/schema";
import { isKardexAdminEmail } from "../app/auth";
import { USER_ROLES, userAccessVersion, type ManagedUserRole } from "./app-users";
import { createSupabaseAdminClient, internalAuthEmail, normalizeUsername, validUsername } from "./supabase-auth";

type Actor = { email: string; userId: string; authProvider: "supabase" | "clerk" };
export type UserChange = { action?: "appUser" | "appUserDelete"; userId?: number; username?: string; displayName?: string; role?: ManagedUserRole; coordinatorId?: number | null; active?: boolean; _version?: string; confirmed?: boolean };
class UserChangeError extends Error { constructor(message: string, public status = 400) { super(message); } }

export async function changeAppUser(db: ReturnType<typeof getDb>, actor: Actor, payload: UserChange) {
  let rollbackAuth: (() => Promise<unknown>) | undefined;
  try {
    const id = Number(payload.userId);
    if (!Number.isSafeInteger(id) || id <= 0) throw new UserChangeError("Usuario inválido.");
    const legacyAdmin = actor.authProvider === "clerk" && isKardexAdminEmail(actor.email);
    return await db.transaction(async tx => {
      // Serialize access changes so two administrators cannot remove the last admin concurrently.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('logistica_f1_user_management'))`);
      const users = await tx.select().from(appUsers).orderBy(appUsers.id).for("update");
      const actingUser = users.find(u => actor.authProvider === "supabase" ? u.authUserId === actor.userId : u.email.toLowerCase() === actor.email.toLowerCase());
      if (!legacyAdmin && (!actingUser?.active || actingUser.role !== "ADMINISTRADOR" || actingUser.mustChangePassword)) throw new UserChangeError("Solo un Administrador activo puede administrar usuarios.", 403);
      const target = users.find(u => u.id === id);
      if (!target || target.invitationStatus === "ELIMINADO") throw new UserChangeError("El usuario ya no está disponible. Actualiza la lista.", 404);
      if (!payload._version || payload._version !== userAccessVersion(target)) throw new UserChangeError("La cuenta cambió desde que la abriste. Actualiza la lista y vuelve a intentarlo.", 409);
      const self = target.id === actingUser?.id || (actor.authProvider === "clerk" && target.email.toLowerCase() === actor.email.toLowerCase());
      const deleting = payload.action === "appUserDelete";
      if (deleting && payload.confirmed !== true) throw new UserChangeError("Confirma la eliminación de este usuario.");
      if (self && (deleting || payload.active === false || payload.role !== "ADMINISTRADOR")) throw new UserChangeError("No puedes eliminar, desactivar ni quitar el rol de administrador a tu propia cuenta.");
      const role = payload.role;
      if (!deleting && (!role || !Object.hasOwn(USER_ROLES, role))) throw new UserChangeError("Selecciona un rol válido.");
      const active = deleting ? false : payload.active !== false;
      if (target.role === "ADMINISTRADOR" && target.active && (deleting || !active || role !== "ADMINISTRADOR") && !users.some(u => u.id !== target.id && u.role === "ADMINISTRADOR" && u.active && u.invitationStatus !== "ELIMINADO")) throw new UserChangeError("Debe quedar al menos un administrador activo.");
      if (!target.authUserId && isKardexAdminEmail(target.email) && (deleting || !active || role !== "ADMINISTRADOR")) throw new UserChangeError("El acceso del administrador principal se gestiona en la configuración del sistema.");
      const admin = target.authUserId ? createSupabaseAdminClient() : null;
      if (deleting) {
        // Keep the same profile ID and name for fleet and asset history, remove its login access.
        await tx.update(appUsers).set({ active: false, invitationStatus: "ELIMINADO", updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(appUsers.id, id));
        if (admin) {
          const { error } = await admin.auth.admin.deleteUser(target.authUserId);
          // A retry may find Auth already removed after a database connection failure.
          if (error && error.status !== 404 && error.code !== "user_not_found") throw new UserChangeError("No se pudo eliminar el acceso. La cuenta se conserva; vuelve a intentarlo o desactívala temporalmente.");
        }
        return Response.json({ ok: true, accountStatus: "ELIMINADO" });
      }
      const displayName = String(payload.displayName ?? "").trim();
      if (!displayName || displayName.length > 120) throw new UserChangeError("Ingresa un nombre de hasta 120 caracteres.");
      const username = target.authUserId ? normalizeUsername(payload.username) : target.username;
      if (target.authUserId && !validUsername(username)) throw new UserChangeError("El usuario debe tener entre 4 y 40 caracteres: letras, números, punto, guion o guion bajo.");
      if (username && users.some(u => u.id !== id && u.username === username)) throw new UserChangeError("Ese nombre de usuario ya está registrado.", 409);
      const email = username !== target.username ? internalAuthEmail(username) : target.email;
      if (users.some(u => u.id !== id && u.email.toLowerCase() === email.toLowerCase())) throw new UserChangeError("Ese nombre de usuario ya está registrado.", 409);
      const coordinatorId = Number(payload.coordinatorId) || null;
      if (coordinatorId && (!Number.isSafeInteger(coordinatorId) || coordinatorId < 0)) throw new UserChangeError("Coordinador inválido.");
      const [coordinator] = coordinatorId ? await tx.select().from(coordinators).where(and(eq(coordinators.id, coordinatorId), eq(coordinators.organization, "F1"), eq(coordinators.active, true))).limit(1) : [];
      if ((role === "COORDINADOR" || coordinatorId) && !coordinator) throw new UserChangeError("Selecciona un Coordinador F1 activo.");
      const [saved] = await tx.update(appUsers).set({ username, email, displayName, role: role!, coordinatorId, active, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(appUsers.id, id)).returning();
      if (admin) {
        const metadata = { application: "LOGISTICA_F1", username, role, active, coordinator_id: coordinatorId };
        const { error } = await admin.auth.admin.updateUserById(target.authUserId, { ...(email !== target.email ? { email, email_confirm: true } : {}), app_metadata: metadata, user_metadata: { display_name: displayName } });
        if (error) throw new UserChangeError("No se pudo actualizar el acceso. No se guardaron los cambios; vuelve a intentarlo.");
        rollbackAuth = () => admin.auth.admin.updateUserById(target.authUserId, { ...(email !== target.email ? { email: target.email, email_confirm: true } : {}), app_metadata: { application: "LOGISTICA_F1", username: target.username, role: target.role, active: target.active, coordinator_id: target.coordinatorId }, user_metadata: { display_name: target.displayName } });
      }
      return Response.json({ ok: true, user: saved, accountStatus: active ? "ACTIVA" : "INACTIVA" });
    });
  } catch (error) {
    if (rollbackAuth) await rollbackAuth().catch(() => undefined);
    if (error instanceof UserChangeError) return Response.json({ error: error.message }, { status: error.status });
    const code = (error as { code?: string; cause?: { code?: string } }).code || (error as { cause?: { code?: string } }).cause?.code;
    return Response.json({ error: code === "23505" ? "Ese nombre de usuario ya está registrado." : "No se pudo guardar la cuenta. Actualiza la lista y vuelve a intentarlo." }, { status: code === "23505" ? 409 : 500 });
  }
}
