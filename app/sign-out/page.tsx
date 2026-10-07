"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect } from "react";

export default function SignOutPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <main className="clerk-auth-page"><p>Configura Clerk para cerrar sesión.</p></main>;
  }

  return <ConfiguredSignOut />;
}

function ConfiguredSignOut() {
  const { signOut } = useClerk();

  useEffect(() => {
    void signOut({ redirectUrl: "/" });
  }, [signOut]);

  return <main className="clerk-auth-page"><p>Cerrando sesión…</p></main>;
}
