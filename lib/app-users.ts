export type ManagedUserRole = "ADMINISTRADOR" | "LOGISTICA" | "COORDINADOR" | "SOLO_LECTURA" | "CONDUCTOR" | "TECNICO";
export type ManagedUser = { id: number; email: string; username: string; authUserId: string; displayName: string; role: ManagedUserRole; coordinatorId: number | null; active: boolean; invitationStatus: string };
export const USER_ROLES: Record<ManagedUserRole, string> = { ADMINISTRADOR: "Administrador", LOGISTICA: "Logística", COORDINADOR: "Coordinador", SOLO_LECTURA: "Solo lectura", CONDUCTOR: "Conductor · Vehículos", TECNICO: "Técnico · Activos F1" };

// Login timestamps and password changes do not overwrite editable account details.
export function userAccessVersion(user: ManagedUser) {
  return JSON.stringify([user.id, user.email, user.username, user.authUserId, user.displayName, user.role, user.coordinatorId, user.active, user.invitationStatus]);
}
