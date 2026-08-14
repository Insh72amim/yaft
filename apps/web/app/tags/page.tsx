"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TagsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/budgets?tab=tags");
  }, [router]);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
      <p style={{ color: "var(--muted)", fontSize: "14px" }}>Redirecting to Budgets & Tags workspace…</p>
    </div>
  );
}
