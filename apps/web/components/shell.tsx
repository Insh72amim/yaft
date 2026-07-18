'use client';
import { BadgeIndianRupee, BriefcaseBusiness, Landmark, LayoutDashboard, LogOut, Menu, ShieldCheck, Upload, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';

const links = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/import', label: 'Import records', icon: Upload },
  { href: '/salary', label: 'Salary statements', icon: BadgeIndianRupee },
  { href: '/dashboard/investments', label: 'Investments', icon: BriefcaseBusiness },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const router = useRouter(); const [open, setOpen] = useState(false);
  const logout = async () => { await api('/auth/logout', { method: 'POST' }); router.replace('/login'); };
  return <div className="app-shell">
    <button className="mobile-menu" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button>
    {open && <button className="backdrop" onClick={() => setOpen(false)} aria-label="Close menu" />}
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand" title="Yet Another Financial Tool"><span className="brand-mark"><Landmark size={21}/></span><span>YAFT</span></div>
      <button className="close-menu" onClick={() => setOpen(false)}><X /></button>
      <nav>{links.map(({ href, label, icon: Icon }) => <Link key={href} className={path === href || (href === '/dashboard' && path.startsWith('/accounts/')) ? 'active' : ''} href={href} onClick={() => setOpen(false)}><Icon size={18}/>{label}</Link>)}</nav>
      <div className="side-spacer" />
      <div className="privacy-note"><ShieldCheck size={18}/><div><strong>Private by design</strong><span>Your data stays on your server.</span></div></div>
      <button className="logout" onClick={logout}><LogOut size={17}/>Sign out</button>
    </aside>
    <main className="main">{children}</main>
  </div>;
}
