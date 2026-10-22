import { Smartphone } from "lucide-react";

export default function DriverInstallHelp() {
  return <details className="driver-install-help">
    <summary><Smartphone size={18} />Añadir la app a mi celular</summary>
    <div>
      <p><strong>Android · Chrome:</strong> abre el menú ⋮ y elige “Instalar aplicación” o “Añadir a pantalla de inicio”.</p>
      <p><strong>iPhone · Safari:</strong> pulsa Compartir y elige “Añadir a pantalla de inicio”.</p>
      <p>Abre el icono <strong>F1 Conductores</strong> para registrar tus jornadas. Necesitas conexión para guardar registros y fotografías.</p>
    </div>
  </details>;
}
