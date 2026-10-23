# Activos F1

Módulo integrado en Logística F1 para equipos y herramientas propios.

## Accesos
- Menú principal → Activos F1.
- Administración directa: /activos.
- Portal instalable para técnicos: /activos/tecnicos. Crear cuentas desde Configuración con rol TECNICO.
- ADMINISTRADOR y LOGISTICA administran activos, entregas, devoluciones y servicios. Los demás perfiles activos consultan; los técnicos registran traspasos y fallas de equipos a su cargo. SOLO_LECTURA no modifica registros.

## Operación
1. Registrar la ficha con foto, compra, costo y tipo de control. Cada serie identifica una unidad; las herramientas por cantidad comparten una ficha y saldo.
2. Asignar a un trabajador activo. Los borradores no consumen stock; confirmar la entrega descuenta el saldo.
3. Registrar devoluciones parciales o completas. Las devoluciones dañadas o perdidas quedan en cuarentena.
4. Solicitar un traspaso. Solo el destinatario puede confirmar su recepción; mientras está pendiente no se permite devolver ni traspasar nuevamente esa asignación.
5. Reportar fallas desde Mis equipos con fotos, videos o PDF. Logística registra la solución y puede descargar todos los adjuntos.
6. Iniciar el servicio desde disponibles o cuarentena. Al finalizar, un resultado aprobado libera el saldo; la calibración aprobada exige certificado adjunto, número y próxima fecha.

## Reglas
Las escrituras operan dentro de una transacción con bloqueo PostgreSQL compartido por el módulo. Hay correlativo por secuencia, series únicas, controles de cantidad y versión, y auditoría de cambios. No se borran movimientos. La desactivación se realiza desde la ficha. Los archivos son privados y se abren con vínculos autenticados de cinco minutos. Tamaño máximo: 30 MB por archivo. Se admiten JPG, PNG, WEBP, PDF, MP4, WEBM y MOV.

Los listados y los indicadores comparten filtros. Excel contiene todos los registros filtrados, no solo la página visible. La fecha real de devolución queda vacía hasta recibir el saldo completo; cada devolución parcial conserva su fecha y condición en el historial.

El portal móvil necesita conexión; no registra movimientos sin conexión. Los datos se actualizan al abrir, al volver a la pestaña y cada 60 segundos mientras está visible.

## Base de datos y despliegue
Las migraciones 0019–0022 crean tablas independientes f1_assets/f1_asset_*, restricciones, índices, secuencia y el bucket privado f1-activos. RLS está habilitado; no se otorga acceso directo a anon/authenticated. La aplicación accede a través de su API autenticada. La identidad de archivo usa el ID interno del usuario, admitiendo el administrador legado con ID 0; el control de propiedad se realiza en servidor.

El build de Vercel ejecuta db:migrate. No repetir las migraciones manualmente. Mantener el esquema de Activos separado de db/schema.ts y registrado en drizzle.config.ts y db/index.ts.

## Verificación
node --test tests/*.test.mjs
pnpm exec tsc --noEmit
pnpm lint
pnpm build

Las pruebas de API usan datos de QA en memoria, sin insertar datos de ejemplo en producción. Cubren saldos, devoluciones, traspasos, concurrencia, permisos, calibración, archivos y auditoría.
