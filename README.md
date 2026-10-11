# Logística F1 · Control de Equipos Entel

Aplicación de inventario, stock, movimientos, solicitudes, conciliación y auditoría para F1 Services. Esta versión está preparada para desplegarse como una aplicación **Next.js nativa en Vercel**.

## Servicios de producción

- Vercel: aplicación y API.
- Supabase PostgreSQL: datos, permisos e historial persistente.
- Supabase Auth: cuentas internas con usuario y contraseña.
- Supabase Storage: fotos privadas de GR y tickets de envío.
- Clerk: acceso anterior opcional durante la transición.
- GitHub: código fuente y despliegue automático desde `main`.

## Variables de entorno

Copia `.env.example` a `.env.local` para desarrollo. En Vercel configura:

```text
DATABASE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
F1_AUTH_DOMAIN
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
F1_ADMIN_EMAILS
```

`F1_ADMIN_EMAILS` acepta uno o varios correos separados por comas. Esas cuentas conservan el acceso administrativo anterior y permiten crear las primeras cuentas internas desde **Configuración → Usuarios y permisos**. Cada cuenta recibe un usuario, una contraseña temporal y un rol; en el primer ingreso el colaborador debe definir una contraseña nueva. `F1_AUTH_DOMAIN` es un dominio técnico interno y no requiere buzones reales.

La clave `SUPABASE_SERVICE_ROLE_KEY` es exclusivamente de servidor y nunca debe exponerse al navegador ni subirse al repositorio. Las contraseñas no se guardan en las tablas de la aplicación: Supabase Auth almacena únicamente sus verificadores seguros.

La aplicación acepta `DATABASE_URL` o `POSTGRES_URL` para PostgreSQL y `NEXT_PUBLIC_SUPABASE_URL` o `SUPABASE_URL` para Storage, por lo que funciona tanto con variables manuales como con la integración de Supabase en Vercel.

## Preparar producción en Vercel

1. Conecta este repositorio al proyecto Vercel y usa `main` como rama de producción.
2. Configura `DATABASE_URL` con el Shared Pooler PostgreSQL del proyecto Supabase.
3. Configura la URL, la clave pública y la clave privada de Supabase para Auth y evidencias fotográficas.
4. Agrega `F1_ADMIN_EMAILS` con la cuenta administrativa anterior usada para crear el primer usuario interno.
5. Si deseas mantener el acceso anterior durante las pruebas, conserva las dos variables de Clerk.
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
