"use client";
import { useId, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { USER_ROLES, userAccessVersion, type ManagedUser, type ManagedUserRole } from "../lib/app-users";

export default function UserAccessModal({ user, mode, self, coordinators, saving, saveError, onClose, onSave }: { user: ManagedUser; mode: "edit" | "delete"; self: boolean; coordinators: { id: number; name: string }[]; saving: boolean; saveError: string; onClose: () => void; onSave: (payload: Record<string, unknown>, success: string) => Promise<boolean> }) {
  const titleId = useId();
  const [role, setRole] = useState<ManagedUserRole>(user.role), [active, setActive] = useState(user.active), [confirmed, setConfirmed] = useState(false), [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const ok = await onSave({ ...values, action: mode === "delete" ? "appUserDelete" : "appUser", userId: user.id, _version: userAccessVersion(user), role, active, confirmed }, mode === "delete" ? "Acceso eliminado. El historial de la persona se conserva." : "Datos del usuario actualizados.");
    if (ok) onClose(); else setError("No se guardaron los cambios. Revisa el mensaje de la página; si la cuenta cambió, cierra este formulario y actualiza la lista.");
  }
  return <div className="modal-layer"><div className="modal-card modal-small" role="dialog" aria-modal="true" aria-labelledby={titleId}>
    <div className="modal-head"><div><span className="modal-kicker">USUARIOS Y PERMISOS</span><h2 id={titleId}>{mode === "delete" ? "Eliminar usuario" : "Editar usuario"}</h2><p>{user.displayName} · {user.username || user.email}</p></div><button className="icon-button" disabled={saving} onClick={onClose} aria-label="Cerrar formulario de usuario"><X size={19} /></button></div>
    <form onSubmit={event => void submit(event)}>
      {mode === "delete" ? <div className="user-delete-confirm"><p>Se eliminará el acceso de <strong>{user.displayName}</strong>. Ya no podrá ingresar a Logística F1. Sus jornadas, asignaciones y registros históricos conservarán su nombre.</p><p>La cuenta no se podrá recuperar desde esta pantalla. Para suspenderla temporalmente, edita su estado a Inactivo.</p><label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} required />Confirmo que deseo eliminar el acceso de esta persona.</label></div> : <div className="form-grid">
        <label className="field field-wide"><span>Nombre del colaborador *</span><input name="displayName" defaultValue={user.displayName} required maxLength={120} autoFocus /></label>
        <label className="field field-wide"><span>Usuario de ingreso *</span><input name="username" defaultValue={user.username} readOnly={!user.authUserId} required={Boolean(user.authUserId)} minLength={4} maxLength={40} pattern="[a-zA-Z0-9._-]+" autoComplete="off" /><small>{user.authUserId ? "Si lo cambias, la persona ingresará con el nuevo usuario y conservará su contraseña." : "El acceso anterior conserva su correo de ingreso."}</small></label>
        <label className="field"><span>Rol del usuario *</span><select value={role} disabled={self} onChange={e => setRole(e.target.value as ManagedUserRole)}>{Object.entries(USER_ROLES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="field"><span>Estado del usuario *</span><select value={active ? "ACTIVO" : "INACTIVO"} disabled={self} onChange={e => setActive(e.target.value === "ACTIVO")}><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></select></label>
        <label className="field field-wide"><span>Coordinador F1 {role === "COORDINADOR" ? "*" : ""}</span><select name="coordinatorId" defaultValue={user.coordinatorId ?? ""} required={role === "COORDINADOR"}><option value="">Sin vincular</option>{user.coordinatorId && !coordinators.some(c => c.id === user.coordinatorId) && <option value={user.coordinatorId} disabled>Coordinador inactivo · selecciona otro</option>}{coordinators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        {self && <p className="user-access-hint field-wide">Tu propia cuenta conserva el rol de administrador y el estado activo.</p>}
      </div>}
      {error && <p className="inline-error" role="alert">{saveError || error}</p>}
      <div className="modal-actions"><button type="button" className="secondary-button" disabled={saving} onClick={onClose}>Cancelar</button><button type="submit" className={mode === "delete" ? "danger-button" : "primary-button"} disabled={saving || (mode === "delete" && !confirmed)}>{saving ? "Guardando..." : mode === "delete" ? "Eliminar usuario" : "Guardar cambios"}</button></div>
    </form>
  </div></div>;
}
