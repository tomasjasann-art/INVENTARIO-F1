# Kardex F1 Logística

Aplicación de inventario, stock, movimientos, solicitudes, conciliación y auditoría para F1 Services. Esta versión está preparada para desplegarse como una aplicación **Next.js nativa en Vercel**.

## Servicios de producción

- Vercel: aplicación y API.
- Supabase PostgreSQL: datos e historial persistente.
- Supabase Storage: fotos privadas de GR y tickets de envío.
- Clerk: inicio de sesión e invitaciones por correo corporativo.
- GitHub: código fuente y despliegue automático desde `main`.

## Variables de entorno

Copia `.env.example` a `.env.local` para desarrollo. En Vercel configura:

```text
DATABASE_URL
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
F1_ADMIN_EMAILS
```

`F1_ADMIN_EMAILS` acepta uno o varios correos separados por comas. Esas cuentas ingresan inicialmente como Administrador y luego pueden invitar usuarios `@f1.services` desde **Configuración → Usuarios y permisos**. La clave `SUPABASE_SERVICE_ROLE_KEY` es exclusivamente de servidor y nunca debe exponerse al navegador ni subirse al repositorio.

La aplicación acepta `DATABASE_URL` o `POSTGRES_URL` para PostgreSQL y `NEXT_PUBLIC_SUPABASE_URL` o `SUPABASE_URL` para Storage, por lo que funciona tanto con variables manuales como con la integración de Supabase en Vercel.

## Preparar producción en Vercel

1. Conecta este repositorio al proyecto Vercel y usa `main` como rama de producción.
2. Configura `DATABASE_URL` con el Shared Pooler PostgreSQL del proyecto Supabase.
3. Configura la URL y la clave de servicio de Supabase para guardar las evidencias fotográficas.
4. Configura Clerk y agrega las dos variables de Clerk.
5. Agrega `F1_ADMIN_EMAILS` con la cuenta inicial del administrador.
6. Vuelve a desplegar el proyecto. El build detecta `DATABASE_URL` y aplica automáticamente las migraciones pendientes antes de compilar.

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

Las migraciones PostgreSQL están en `drizzle-pg/`. Para conservar los datos existentes se debe ejecutar una migración controlada antes de cambiar `DATABASE_URL`; la URL pública de Supabase por sí sola no permite copiar la base.

## Despliegue automático

Cada actualización de `main` inicia un nuevo despliegue en Vercel mediante la integración GitHub del proyecto. No se deben cargar secretos al repositorio; todos se administran desde Vercel.
