"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect } from "react";

export default function SignOutPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <InternalSignOut />;
  }

  return <ConfiguredSignOut />;
}

function ConfiguredSignOut() {
  const { signOut } = useClerk();

  useEffect(() => {
    void fetch("/api/auth/logout", { method: "POST" })
      .finally(() => void signOut({ redirectUrl: "/" }));
  }, [signOut]);

  return <main className="clerk-auth-page"><p>Cerrando sesión…</p></main>;
}

function InternalSignOut() {
  useEffect(() => {
    void fetch("/api/auth/logout", { method: "POST" })
      .finally(() => window.location.replace("/"));
  }, []);

  return <main className="clerk-auth-page"><p>Cerrando sesión…</p></main>;
}
