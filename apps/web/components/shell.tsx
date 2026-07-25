"use client";
import {
  BadgeIndianRupee,
  BriefcaseBusiness,
  Landmark,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  ShieldCheck,
  Target,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemeColorSelector } from "@/components/theme-color-selector";

const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/assets", label: "Assets", icon: TrendingUp },
  { href: "/budgets", label: "Budgets", icon: Target },
  { href: "/accounts", label: "Accounts", icon: BriefcaseBusiness },
  { href: "/salary", label: "Salary", icon: BadgeIndianRupee },
  { href: "/import", label: "Import", icon: Upload },
];

const bottomLinks: { href: string; label: string; icon: any }[] = [];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const logout = async () => {
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
        <ThemeColorSelector />
        <ThemeToggle />
        <div className="privacy-note">
          <ShieldCheck size={18} />
          <div>
            <strong>Private by design</strong>
            <span>Your data stays on your server.</span>
          </div>
        </div>
        <button className="logout" onClick={logout}>
          <LogOut size={17} />
          Sign out
        </button>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
