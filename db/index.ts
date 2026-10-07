import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let database: ReturnType<typeof createDatabase> | undefined;

function createDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL no está configurada. Conecta una base Neon al proyecto de Vercel.",
    );
  }

  return drizzle(neon(databaseUrl), { schema });
}

export function getDb() {
  database ??= createDatabase();
  return database;
}
