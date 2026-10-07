# Kardex F1 Logística

Aplicación de inventario, stock, movimientos, solicitudes, conciliación y auditoría para F1 Services. Esta versión está preparada para desplegarse como una aplicación **Next.js nativa en Vercel**.

## Servicios de producción

- Vercel: aplicación y API.
- Neon PostgreSQL: datos e historial persistente.
- Clerk: inicio de sesión con Google/Gmail.
- GitHub: código fuente y despliegue automático desde `main`.

## Variables de entorno

Copia `.env.example` a `.env.local` para desarrollo. En Vercel configura:

```text
DATABASE_URL
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
F1_ADMIN_EMAILS
```

`F1_ADMIN_EMAILS` acepta uno o varios correos separados por comas. Esos correos ingresan inicialmente como Administrador y luego pueden registrar al resto del equipo en **Configuración → Usuarios y permisos**.

## Preparar producción en Vercel

1. Conecta este repositorio al proyecto Vercel y usa `main` como rama de producción.
2. Instala Neon desde Vercel Marketplace para que se cree `DATABASE_URL`.
3. Instala/configura Clerk, activa el acceso con Google y agrega las dos variables de Clerk.
4. Agrega `F1_ADMIN_EMAILS` con el Gmail del administrador.
5. Vuelve a desplegar el proyecto. El build detecta `DATABASE_URL` y aplica automáticamente las migraciones pendientes antes de compilar.

Mientras falte alguna variable, la web mostrará una pantalla de configuración pendiente en lugar de fallar.

## Desarrollo y verificación

```bash
pnpm install
pnpm dev
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

El comando `pnpm build` genera el directorio `.next` esperado por Vercel, incluido `.next/routes-manifest.json`.

## Base de datos

```bash
pnpm db:generate  # genera una migración después de modificar db/schema.ts
pnpm db:migrate   # aplica migraciones pendientes manualmente cuando sea necesario
pnpm db:push      # sincronización directa, solo para desarrollo controlado
```

Las migraciones PostgreSQL están en `drizzle-pg/`. Los datos de prueba del antiguo entorno D1 no se copian automáticamente a Neon.

## Despliegue automático

Cada actualización de `main` inicia un nuevo despliegue en Vercel mediante la integración GitHub del proyecto. No se deben cargar secretos al repositorio; todos se administran desde Vercel.
