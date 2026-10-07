# Kardex F1 Logística

Sistema web de inventario y trazabilidad para F1 Services.

## Módulos

- Maestro de SKU
- Ingresos y salidas unitarias
- Carga masiva desde Excel
- Stock y trazabilidad por SKU, serie/lote, GR, pedido, site y coordinador
- Solicitudes de equipos y seguimiento logístico
- Conciliación de instalaciones
- Auditoría Entel y Oracle
- Usuarios, roles y permisos

## Producción

- Sitio: https://kardex-f1-logistica.tomasjasann.chatgpt.site
- Plataforma: ChatGPT Sites / Cloudflare Workers
- Base de datos: Cloudflare D1
- Proyecto Sites: `appgprj_6ac47e9c69f48191a0451d999faf40c8`

## Desarrollo

Requisitos:

- Node.js 22 o superior
- pnpm 11.25.0

```bash
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

## Datos y seguridad

Este repositorio contiene código, esquema y migraciones. No contiene la base de datos de producción, exportaciones de inventario, archivos Excel, contraseñas ni tokens.

Las variables sensibles, como `F1_ADMIN_EMAILS`, se configuran únicamente en el entorno de producción.

## Sincronización

GitHub es la copia externa y fuente de referencia del código. Todo cambio funcional debe:

1. Actualizar la rama `main` de este repositorio.
2. Pasar las validaciones automáticas.
3. Publicar el mismo estado de código en ChatGPT Sites.

Consulta `AGENTS.md` para las reglas de mantenimiento.
