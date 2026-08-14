"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CreditCardsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/accounts?tab=credit_cards");
  }, [router]);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
      <p style={{ color: "var(--muted)", fontSize: "14px" }}>Redirecting to Accounts & Credit Cards workspace…</p>
    </div>
  );
}
