# Reglas de mantenimiento

## Fuente y publicación

- La rama `main` de `tomasjasann-art/INVENTARIO-F1` es la copia externa y fuente de referencia del código.
- El sitio de producción es el proyecto Sites `appgprj_6ac47e9c69f48191a0451d999faf40c8`.
- Cada cambio funcional debe quedar en GitHub y publicarse en Sites dentro de la misma tarea.
- No publicar una versión en Sites sin actualizar también GitHub.
- No sobrescribir cambios remotos: comprobar primero el SHA actual de `main` y actualizar con control de concurrencia.

## Seguridad

- Nunca incluir archivos `.env`, tokens, claves, contraseñas, respaldos de D1, Excel de inventario ni datos reales de usuarios.
- Mantener las licencias y atribuciones de componentes de terceros.
- La base de datos de producción permanece en D1; GitHub contiene únicamente código, esquema y migraciones.

## Validación

Antes de publicar o sincronizar:

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```
