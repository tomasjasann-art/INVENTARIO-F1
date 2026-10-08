import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let database: ReturnType<typeof createDatabase> | undefined;

function createDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL no está configurada. Conecta la base PostgreSQL de Supabase al proyecto de Vercel.",
    );
  }

  const client = postgres(databaseUrl, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
  });

  return drizzle(client, { schema });
}

export function getDb() {
  database ??= createDatabase();
  return database;
}
