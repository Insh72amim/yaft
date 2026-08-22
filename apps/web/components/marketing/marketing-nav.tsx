'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Landmark, Shield, Menu, X, ArrowRight, Sparkles, Terminal, LogIn, UserPlus, LayoutDashboard } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`mkt-header ${scrolled ? 'mkt-header-scrolled' : ''}`}>
      <div className="mkt-container mkt-header-inner">
        {/* Brand */}
        <Link href="/" className="mkt-brand" title="Yet Another Financial Tracker">
          <span className="brand-mark mkt-brand-mark">
            <Landmark size={20} />
          </span>
          <div className="mkt-brand-text">
            <strong>YAFT</strong>
            <span className="mkt-brand-badge">Self-Hosted</span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="mkt-nav-links">
          <a href="#features">Features</a>
          <a href="#ecosystem">Indian Ecosystem</a>
          <a href="#security">Privacy & Security</a>
          <a href="#comparison">Why YAFT?</a>
          <a href="#deploy">Quickstart</a>
          <a href="#faq">FAQ</a>
        </nav>

        {/* Desktop Actions */}
        <div className="mkt-header-actions">
          <ThemeToggle className="mkt-theme-toggle" />
          <Link href="/login" className="mkt-btn-ghost">
            <LogIn size={15} />
            <span>Sign In</span>
          </Link>
          <Link href="/dashboard" className="mkt-btn-primary">
            <span>Open Workspace</span>
            <ArrowRight size={15} />
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="mkt-mobile-btn"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="mkt-mobile-drawer">
          <nav className="mkt-mobile-nav">
            <a href="#features" onClick={() => setMobileOpen(false)}>Features</a>
            <a href="#ecosystem" onClick={() => setMobileOpen(false)}>Indian Ecosystem</a>
            <a href="#security" onClick={() => setMobileOpen(false)}>Privacy & Security</a>
            <a href="#comparison" onClick={() => setMobileOpen(false)}>Why YAFT?</a>
            <a href="#deploy" onClick={() => setMobileOpen(false)}>Quickstart</a>
            <a href="#faq" onClick={() => setMobileOpen(false)}>FAQ</a>
            <div className="mkt-mobile-actions">
              <Link href="/login" className="mkt-btn-secondary" onClick={() => setMobileOpen(false)}>
                <LogIn size={16} />
                Sign In
              </Link>
              <Link href="/register" className="mkt-btn-secondary" onClick={() => setMobileOpen(false)}>
                <UserPlus size={16} />
                Claim Instance
              </Link>
              <Link href="/dashboard" className="mkt-btn-primary" onClick={() => setMobileOpen(false)}>
                <LayoutDashboard size={16} />
                Open Workspace
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
