export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://app.local");
    if (url.origin !== "https://app.local") return "/";
    if (["/sign-in", "/sign-out", "/api/"].some(path => url.pathname.startsWith(path))) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return "/"; }
}
