"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AssetsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/accounts?tab=assets");
  }, [router]);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
      <p style={{ color: "var(--muted)", fontSize: "14px" }}>Redirecting to Accounts & Assets workspace…</p>
    </div>
  );
}
