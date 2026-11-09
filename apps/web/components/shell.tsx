"use client";
import {
  ArrowLeft,
  BadgeIndianRupee,
  BriefcaseBusiness,
  Dices,
  Landmark,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Receipt,
  ShieldCheck,
  Sparkles,
  Target,
  Tag,
  TrendingUp,
  Upload,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  api,
  disableDemoMode,
  getDemoState,
  isDemoMode,
  resetAndRandomizeDemoData,
} from "@/lib/api";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/accounts", label: "Accounts", icon: BriefcaseBusiness },
  { href: "/budgets", label: "Budgets", icon: Target },
  { href: "/salary", label: "Salary", icon: BadgeIndianRupee },
  { href: "/import", label: "Import", icon: Upload },
];

const bottomLinks: { href: string; label: string; icon: any }[] = [];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [demoActive, setDemoActive] = useState(false);
  const [personaName, setPersonaName] = useState("");
  const [randomizing, setRandomizing] = useState(false);

  useEffect(() => {
    const active = isDemoMode();
    setDemoActive(active);
    if (active) {
      setPersonaName(getDemoState().user.name);
    }
  }, [path]);

  const handleRandomize = () => {
    setRandomizing(true);
    resetAndRandomizeDemoData();
    window.location.reload();
  };

  const logout = async () => {
    if (demoActive) {
      if (process.env.NEXT_PUBLIC_DEMO_MODE === "true" || window.location.pathname.startsWith("/demo")) {
        window.location.href = "/";
        return;
      }
      disableDemoMode();
      router.replace("/login");
      return;
    }
    await api("/auth/logout", { method: "POST" });
    router.replace("/login");
  };
  return (
    <div className="app-shell">
      <button
        className="mobile-menu"
        onClick={() => setOpen(true)}
        aria-label="Open menu">
        <Menu />
      </button>
      {open && (
        <button
          className="backdrop"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        />
      )}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand" title="Yet Another Financial Tool">
          <span className="brand-mark">
            <Landmark size={21} />
          </span>
          <span>YAFT</span>
          {demoActive && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: "10px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                padding: "3px 7px",
                borderRadius: "999px",
                background: "rgba(22, 163, 74, 0.14)",
                color: "var(--green)",
                border: "1px solid rgba(22, 163, 74, 0.3)",
              }}>
              Sandbox
            </span>
          )}
        </div>
        <button className="close-menu" onClick={() => setOpen(false)}>
          <X />
        </button>
        <nav>
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              className={
                path === href ||
                (href === "/accounts" && path.startsWith("/accounts"))
                  ? "active"
                  : ""
              }
              href={href}
              onClick={() => setOpen(false)}>
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="side-spacer" />
        <nav className="nav-bottom">
          {bottomLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              className={
                path.startsWith(href) ? "active vault-nav" : "vault-nav"
              }
              href={href}
              onClick={() => setOpen(false)}>
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        {demoActive && (
          <button
            type="button"
            onClick={handleRandomize}
            disabled={randomizing}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              width: "100%",
              padding: "10px 12px",
              marginBottom: "10px",
              borderRadius: "11px",
              border: "1px solid rgba(22, 163, 74, 0.35)",
              background: "rgba(22, 163, 74, 0.1)",
              color: "var(--green)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
            title="Generate a fresh random set of accounts, holdings, payslips & transactions in localStorage">
            <Dices size={16} />
            <span>{randomizing ? "Randomizing…" : "Randomize Demo Data"}</span>
          </button>
        )}
        <div className="privacy-note">
          <ShieldCheck size={18} />
          <div>
            <strong>{demoActive ? "Browser localStorage" : "Private by design"}</strong>
          </div>
        </div>
        <ThemeToggle />
        <Link
          className={path === "/me" ? "active" : ""}
          href="/me"
          onClick={() => setOpen(false)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "11px 13px",
            borderRadius: "11px",
            color: path === "/me" ? "var(--green)" : "#68756e",
            background: path === "/me" ? "var(--theme-soft-end)" : "transparent",
            fontSize: "14px",
            fontWeight: 500,
            marginTop: "12px",
            marginBottom: "4px",
          }}>
          <User size={18} />
          <span>Me</span>
        </Link>
        <button className="logout" onClick={logout}>
          {demoActive ? <ArrowLeft size={17} /> : <LogOut size={17} />}
          {demoActive ? "Exit Sandbox" : "Sign out"}
        </button>
      </aside>
      <main className="main">
        {demoActive && (
          <div
            role="region"
            aria-label="Guest Sandbox Controls"
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              padding: "10px 16px",
              marginBottom: "18px",
              borderRadius: "12px",
              background: "linear-gradient(90deg, rgba(22, 163, 74, 0.12), rgba(14, 165, 233, 0.08))",
              border: "1px solid rgba(22, 163, 74, 0.28)",
              fontSize: "13px",
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "3px 9px",
                  borderRadius: "999px",
                  background: "var(--green)",
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}>
                <Sparkles size={12} /> Interactive Guest Sandbox
              </span>
              <span style={{ color: "var(--ink)", fontWeight: 500 }}>
                Playing as <strong>{personaName || "Guest User"}</strong> &mdash; create, edit, categorize, or import anything. All edits stay in your browser&apos;s <code>localStorage</code>.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                className="secondary compact"
                onClick={handleRandomize}
                disabled={randomizing}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  padding: "6px 12px",
                }}>
                <Dices size={14} />
                {randomizing ? "Generating…" : "Randomize Data"}
              </button>
              <button
                type="button"
                className="ghost compact"
                onClick={logout}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "12px",
                  padding: "6px 10px",
                }}>
                <ArrowLeft size={14} />
                Exit Demo
              </button>
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
