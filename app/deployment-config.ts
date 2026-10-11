export function missingDeploymentConfig(): string[] {
  const required = ["F1_ADMIN_EMAILS"] as const;
  const missing: string[] = required.filter((name) => !process.env[name]?.trim());
  if (!(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL)?.trim()) {
    missing.unshift("DATABASE_URL / POSTGRES_URL");
  }
  if (!(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)?.trim()) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL");
  }
  if (!(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim()) {
    missing.push("SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY");
  }
  if (!(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim()) {
    missing.push("SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY");
  }
  return missing;
}

export function isClerkConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()
      && process.env.CLERK_SECRET_KEY?.trim(),
  );
}
