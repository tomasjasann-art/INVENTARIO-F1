import { spawnSync } from "node:child_process";

const executable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(args) {
  const result = spawnSync(executable, args, { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.env.DATABASE_URL?.trim()) {
  console.log("DATABASE_URL detectada: aplicando migraciones PostgreSQL pendientes…");
  run(["db:migrate"]);
} else {
  console.log("DATABASE_URL no configurada: se omite la migración y se genera la pantalla de configuración.");
}

run(["exec", "next", "build"]);
