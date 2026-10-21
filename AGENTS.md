# Reglas de mantenimiento

## Fuente y publicación

- La rama `main` de `tomasjasann-art/INVENTARIO-F1` es la copia externa y fuente de referencia del código.
- El sitio de producción vigente es `https://logisticaf1.vercel.app`, proyecto Vercel `logistica_f1`.
- Cada cambio funcional debe quedar en GitHub y desplegarse en Vercel dentro de la misma tarea.
- No publicar una versión sin actualizar también GitHub.
- No sobrescribir cambios remotos: comprobar primero el SHA actual de `main` y actualizar con control de concurrencia.

## Seguridad

- Nunca incluir archivos `.env`, tokens, claves, contraseñas, respaldos de D1, Excel de inventario ni datos reales de usuarios.
- Mantener las licencias y atribuciones de componentes de terceros.
- La base de datos de producción es Supabase PostgreSQL; GitHub contiene únicamente código, esquema y migraciones.

## Validación

Antes de publicar o sincronizar:

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```
