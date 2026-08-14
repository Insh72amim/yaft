"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BudgetsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/tags?tab=category_budgets");
  }, [router]);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
      <p style={{ color: "var(--muted)", fontSize: "14px" }}>Redirecting to Tags & Budgets workspace…</p>
    </div>
  );
}
