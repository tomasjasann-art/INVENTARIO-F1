export function missingDeploymentConfig(): string[] {
  const required = [
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "F1_ADMIN_EMAILS",
  ] as const;
  const missing: string[] = required.filter((name) => !process.env[name]?.trim());
  if (!(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL)?.trim()) {
    missing.unshift("DATABASE_URL / POSTGRES_URL");
  }
  return missing;
}

export function isClerkConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()
      && process.env.CLERK_SECRET_KEY?.trim(),
  );
}
