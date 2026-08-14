"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/shell";

export default function TransactionsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/accounts?tab=transactions");
  }, [router]);

  return (
    <Shell>
      <div className="loading" style={{ height: "40vh" }}>
        <span />
        <p>Redirecting to Accounts &amp; Transactions workspace...</p>
      </div>
    </Shell>
  );
}
