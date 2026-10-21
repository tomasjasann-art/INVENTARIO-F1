# Control de vehículos · Logística F1

Administración y Logística abren el desplegable **Control de vehículos** dentro del Kardex y eligen **Datos del vehículo → Agregar vehículo** para comenzar. Las secciones se muestran en el mismo Kardex. La ruta directa `/vehiculos` conserva el portal independiente, incluido el acceso de conductores. Producción se publica mediante la integración existente GitHub main → Vercel. Los datos residen en Supabase PostgreSQL y las evidencias en el bucket privado existente `kardex-evidencias`.

## Operación inicial

1. En Configuración del Kardex, crear los usuarios con rol **Conductor** y contraseña temporal. El conductor cambia su contraseña al primer ingreso y accede exclusivamente a vehículos.
2. Registrar los vehículos, separando **uso** (Administración / Operaciones), **tenencia** (Propio / Alquilado) y disponibilidad.
3. Preparar las asignaciones por placa y fecha con conductor, coordinador, CECO, site, zona final y horario previsto. Una asignación diaria por placa admite un retorno en otra fecha.
4. Desde el celular, el conductor registra Inicio y Final con kilometraje y siete fotos en cada evento. La séptima corresponde al control físico de recepción y entrega. El sistema conserva la fecha/hora del servidor y el usuario que registró cada evento. Una jornada abierta bloquea otro Inicio para la placa y conductor.
5. Registrar documentos y sus renovaciones, gastos, facturas, pagos y ralentí GPS. Cada pago exige sustento y no puede exceder el saldo. Los pagos no suman otra vez al costo operativo.

## Controles y reportes

- Estados: Programada, Por confirmar, Sin Inicio, En jornada, Cierre pendiente, Finalizada, No salió y Cancelada. “No salió” y cancelación exigen un motivo. La ausencia de registro no prueba que el vehículo no circuló.
- Documentos: SOAT, revisión técnica y seguro. Historial de renovaciones y alertas a 30 días. No registrar un documento como vigente sin comprobar su contenido.
- Rendimiento: km/gal **abastecido estimado** por periodo. Litros se convierten a galones estadounidenses. GNV se registra en m³ y no se mezcla con el indicador de líquidos. Cambios de tanque afectan la estimación. La meta se configura por vehículo.
- Atribución: los costos por conductor, coordinador y CECO usan únicamente los gastos vinculados a una jornada. Los gastos sin jornada siguen incluidos en el total por vehículo y pueden vincularse posteriormente. El combustible abastecido no demuestra consumo individual exacto.
- Ralentí: entrada manual por placa/fecha en horas:minutos; máximo diario 24:00. El acumulado puede superar 24 h.
- Mantenimiento: registro del servicio, kilometraje, costo y próximo kilometraje. Alertas cuando se alcanza el siguiente mantenimiento.
- Excel: exportación de jornadas, gastos, ralentí y resumen por vehículo. Impresión de consolidado desde el navegador.

## Cargas masivas y puntos de abastecimiento

Hay una plantilla base para combustible y peajes, con hasta 500 filas por lote, vista previa validada por servidor y detección de duplicados por placa, fecha, tipo, proveedor y referencia. El guardado es atómico: un conflicto no deja un lote parcialmente registrado. Los formatos específicos del proveedor quedan pendientes de recibir.

El directorio de abastecimiento permite búsqueda por estación/dirección/distrito/ciudad/departamento y combustible, y cercanía opcional con permiso de ubicación. Las distancias mostradas son en línea recta. El mapa y la navegación solo usan coordenadas verificadas. El PDF de puntos del convenio está pendiente de recibir; no se han incorporado ubicaciones ficticias ni disponibilidad de combustible en tiempo real.

## Protección y validación

La API aplica permisos de servidor, propiedad de asignaciones y cambio obligatorio de contraseña. Conductor no tiene acceso al inventario, costos, facturas ni administración. Las tablas nuevas tienen RLS y no conceden acceso directo a anon/authenticated; el servidor valida las sesiones existentes y usa su conexión privada. Las fotos se suben directamente a almacenamiento privado con URL temporal, sin enviar claves privadas al celular; la API verifica las siete cargas antes de confirmar el evento.

La migración `0013_control_vehiculos` es aditiva. El build existente aplica las migraciones pendientes mediante Drizzle antes de construir Next.js. No requiere nuevas variables de entorno.

Comprobaciones: `node --test tests/fleet.test.mjs`, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`.

## Carga y recuperación

El lector de flota consulta los catálogos en secuencia para no lanzar una ráfaga superior al pool de conexiones de la función. El API devuelve un error JSON a los 20 segundos si la lectura no responde. El navegador cancela la petición a los 25 segundos y muestra **Reintentar**, conservando el menú del Kardex. Una respuesta inválida no se interpreta como una flota vacía. Al cambiar de módulo se cancela la petición pendiente.

Validación de regresión: `node --test tests/fleet.test.mjs tests/fleet-loading.test.mjs`. Los dobles de identidad y base de datos de estas pruebas son locales; no demuestran una sesión autenticada de producción.
