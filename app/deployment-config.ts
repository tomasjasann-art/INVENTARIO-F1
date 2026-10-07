export function missingDeploymentConfig(): string[] {
  const required = [
    "DATABASE_URL",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "F1_ADMIN_EMAILS",
  ] as const;

  return required.filter((name) => !process.env[name]?.trim());
}

export function isClerkConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()
      && process.env.CLERK_SECRET_KEY?.trim(),
  );
}
