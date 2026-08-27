'use client';

import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Sparkles,
  Download,
  Pin,
  PinOff,
} from 'lucide-react';
import { money } from '@/lib/api';

export type SupergroupData = {
  id: string;
  name: string;
  kind: string;
  color: string;
  amount: number;
  categories: Array<{ name: string; color: string; amount: number; percentage?: number }>;
};

export type AccountFlow = {
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    institution: string | null;
    externalInbound: number;
    internalInbound: number;
    externalOutbound: number;
    cleanOutbound?: number;
    expenses?: number;
    other?: number;
    creditCardPayments?: number;
    investments?: number;
    internalOutbound: number;
    totalInbound: number;
    totalOutbound: number;
    supergroups?: SupergroupData[];
    cleanCategories?: Array<{ name: string; color: string; amount: number; percentage: number }>;
    allCategories?: Array<{ name: string; color: string; amount: number; percentage: number }>;
    categories?: Array<{ name: string; color: string; amount: number; percentage: number }>;
    topRecipients?: Array<{ name: string; amount: number; count: number; isInternal?: boolean }>;
    topExternalRecipients?: Array<{ name: string; amount: number; count: number; isInternal?: boolean }>;
    otherExternalOutbound?: { amount: number; count: number };
    topInternalRecipients?: Array<{ name: string; amount: number; count: number; isInternal?: boolean }>;
    otherInternalOutbound?: { amount: number; count: number };
  }>;
  internalTransfers: Array<{
    fromAccountId: string;
    fromAccountName: string;
    toAccountId: string;
    toAccountName: string;
    toAccountType?: string;
    amount: number;
  }>;
  overall: {
    totalExternalInbound: number;
    totalInternalInbound?: number;
    totalExternalOutbound: number;
    totalCreditCardPayments?: number;
    totalUpiLiteTransfers?: number;
    totalInterBankTransfers?: number;
    totalInvestments?: number;
    totalCleanOutbound?: number;
    totalInternalTransfers: number;
    totalAllOutbound?: number;
    supergroups?: SupergroupData[];
    categoryFlow?: {
      outboundCategories: Array<{ name: string; color: string; amount: number }>;
      creditCardCategories: Array<{ name: string; color: string; amount: number }>;
      investmentCategories: Array<{ name: string; color: string; amount: number }>;
      overallCategories: Array<{ name: string; color: string; amount: number }>;
    };
  };
};

type HoverTarget =
  | { kind: 'inbound' }
  | { kind: 'bank'; id: string }
  | { kind: 'category'; id: string }
  | { kind: 'ribbon'; bankId: string; catId: string }
  | null;

export function MultiBankSankey({
  accountFlow,
  income,
  expenses,
  savings,
}: {
  accountFlow: AccountFlow;
  income: number;
  expenses: number;
  savings: number;
}) {
  const { accounts, overall } = accountFlow;

  // ── Layout Constants ──────────────────────────────────────────────────────
  const SVG_W = 1260;
  const PAD_TOP = 75;
  const PAD_BOTTOM = 50;
  const NODE_W = 16;
  const NODE_GAP = 28;
  const MIN_BANK_H = 48;
  const LEFT_X = 140;
  const MID_X = 500;
  const CAT_X = 940;

  // ── Bank Colors ───────────────────────────────────────────────────────────
  const getBankColor = useCallback((index: number, name: string): string => {
    const lc = name.toLowerCase();
    if (lc.includes('hdfc')) return '#3b82f6';
    if (lc.includes('sbi')) return '#06b6d4';
    if (lc.includes('axis')) return '#ec4899';
    if (lc.includes('pnb')) return '#f59e0b';
    if (lc.includes('icici')) return '#8b5cf6';
    const p = ['#3b82f6', '#06b6d4', '#ec4899', '#f59e0b', '#8b5cf6', '#10b981', '#6366f1'];
    return p[index % p.length];
  }, []);

  // 1. Calculate per-bank category contributions (Direct & Clean)
  const bankData = useMemo(() => {
    return accounts.map((a, idx) => {
      const cleanCats = (a.categories || a.cleanCategories || []).filter(
        (c) =>
          !/^\s*(?:cc transfer|upi lite|internal transfer|transfer|self transfer|credit card payment|credit card|card payment|wallet top-up|wallet transfer)\s*$/i.test(
            c.name,
          ) && c.amount > 0,
      );

      const outTotal = cleanCats.reduce((s, c) => s + c.amount, 0);
      const inTotal = a.externalInbound > 0 ? a.externalInbound : a.totalInbound;

      return {
        ...a,
        cleanCats,
        color: getBankColor(idx, a.name),
        inTotal,
        outTotal,
        maxVolume: Math.max(inTotal, outTotal, 1),
      };
    });
  }, [accounts, getBankColor]);

  // 2. Consolidated Unified Final Expense Categories across all banks
  type BankContribution = {
    bankId: string;
    bankName: string;
    bankColor: string;
    amount: number;
  };

  type ConsolidatedCategory = {
    id: string;
    name: string;
    color: string;
    totalAmount: number;
    sources: BankContribution[];
    height: number;
    x: number;
    y: number;
  };

  const consolidatedCategories = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        color: string;
        totalAmount: number;
        sources: BankContribution[];
      }
    >();

    for (const b of bankData) {
      for (const c of b.cleanCats) {
        if (c.amount <= 0) continue;
        const normalizedName = c.name.trim();
        const key = normalizedName.toLowerCase();
        const existing = map.get(key);
        if (existing) {
          existing.totalAmount += c.amount;
          existing.sources.push({
            bankId: b.id,
            bankName: b.name,
            bankColor: b.color,
            amount: c.amount,
          });
          if (c.color && (!existing.color || existing.color === '#94a3b8')) {
            existing.color = c.color;
          }
        } else {
          map.set(key, {
            id: key.replace(/[^a-z0-9]/g, '-'),
            name: normalizedName,
            color: c.color || '#3b82f6',
            totalAmount: c.amount,
            sources: [
              {
                bankId: b.id,
                bankName: b.name,
                bankColor: b.color,
                amount: c.amount,
              },
            ],
          });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [bankData]);

  // 3. System volume totals & scaling
  const totalInboundVolume = bankData.reduce((s, b) => s + b.inTotal, 0);
  const totalOutboundVolume = bankData.reduce((s, b) => s + b.outTotal, 0);
  const maxSystemVolume = Math.max(totalInboundVolume, totalOutboundVolume, 1);

  const minHeightNeeded = Math.max(
    bankData.length * MIN_BANK_H + (bankData.length - 1) * NODE_GAP,
    consolidatedCategories.length * 28 + (consolidatedCategories.length - 1) * 10,
    420,
  );
  const usableH = Math.max(460, minHeightNeeded);

  const scale = (usableH * 0.72) / maxSystemVolume;
  const flowH = useCallback((amt: number) => (amt > 0 ? Math.max(3, Math.round(amt * scale)) : 0), [scale]);

  // 4. Position Stage 1: Inbound Node
  const inSlicesData = bankData.filter((b) => b.inTotal > 0).map((b) => flowH(b.inTotal));
  const inboundH = Math.max(40, inSlicesData.reduce((s, h) => s + h, 0));
  const inStartY = PAD_TOP + (usableH - inboundH) / 2;

  // 5. Position Stage 2: Bank Nodes
  const bankNodesWithY = useMemo(() => {
    let bankCurY = PAD_TOP;
    return bankData.map((b) => {
      const sumInH = flowH(b.inTotal);
      const sumOutH = flowH(b.outTotal);
      const nodeHeight = Math.max(MIN_BANK_H, sumInH, sumOutH);
      const node = {
        ...b,
        sumInH,
        sumOutH,
        height: nodeHeight,
        x: MID_X,
        y: bankCurY,
      };
      bankCurY += nodeHeight + NODE_GAP;
      return node;
    });
  }, [bankData, flowH]);

  // 6. Position Stage 3: Consolidated Categories
  const categoryNodesWithY: ConsolidatedCategory[] = useMemo(() => {
    const catGap = 10;
    let catCurY = PAD_TOP;

    return consolidatedCategories.map((c) => {
      const incomingFlowH = c.sources.reduce((sum, s) => sum + flowH(s.amount), 0);
      const sliceH = Math.max(20, incomingFlowH > 0 ? incomingFlowH : flowH(c.totalAmount));
      const node: ConsolidatedCategory = {
        ...c,
        height: sliceH,
        x: CAT_X,
        y: catCurY,
      };
      catCurY += sliceH + catGap;
      return node;
    });
  }, [consolidatedCategories, flowH]);

  const maxColumnBottom = Math.max(
    ...bankNodesWithY.map((b) => b.y + b.height),
    ...categoryNodesWithY.map((c) => c.y + c.height),
    usableH + PAD_TOP,
  );

  const finalSvgH = Math.max(maxColumnBottom + PAD_BOTTOM, 540);
  const totalOutboundSum = totalOutboundVolume || 1;

  // ── Pan & Zoom State (ViewBox Matrix) ────────────────────────────────────
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: SVG_W, h: finalSvgH });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ clientX: 0, clientY: 0, startX: 0, startY: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAnimations, setShowAnimations] = useState(true);

  // Sync initial viewBox when finalSvgH changes
  useEffect(() => {
    setViewBox((prev) => {
      if (prev.x === 0 && prev.y === 0 && prev.w === SVG_W) {
        return { x: 0, y: 0, w: SVG_W, h: finalSvgH };
      }
      return prev;
    });
  }, [finalSvgH]);

  // ── Highlighting & Pinning State ──────────────────────────────────────────
  const [hoverTarget, setHoverTarget] = useState<HoverTarget>(null);
  const [pinnedTarget, setPinnedTarget] = useState<HoverTarget>(null);
  const [hoveredFlow, setHoveredFlow] = useState<{ title: string; amount: string; color: string; subtitle?: string } | null>(null);

  const activeHighlight = hoverTarget || pinnedTarget;

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Ribbon Path Helper
  const ribbon = (x1: number, yT1: number, yB1: number, x2: number, yT2: number, yB2: number) => {
    const cp = (x2 - x1) * 0.44;
    return `M ${x1} ${yT1} C ${x1 + cp} ${yT1},${x2 - cp} ${yT2},${x2} ${yT2} L ${x2} ${yB2} C ${x2 - cp} ${yB2},${x1 + cp} ${yB1},${x1} ${yB1} Z`;
  };

  // Build Stage 1 -> Stage 2 Ribbons (Inbound -> Banks)
  const inSlices = useMemo(() => {
    let currInSrcY = inStartY;
    const bankInboundOffset = new Map<string, number>();
    bankNodesWithY.forEach((b) => bankInboundOffset.set(b.id, 0));

    type InSlice = { bank: (typeof bankNodesWithY)[0]; srcT: number; srcB: number; dstT: number; dstB: number };
    const slices: InSlice[] = [];

    for (const bank of bankNodesWithY) {
      if (bank.inTotal <= 0) continue;
      const srcH = flowH(bank.inTotal);
      const dstH = srcH;
      const dstOff = bankInboundOffset.get(bank.id)!;

      slices.push({
        bank,
        srcT: currInSrcY,
        srcB: currInSrcY + srcH,
        dstT: bank.y + dstOff,
        dstB: bank.y + dstOff + dstH,
      });

      currInSrcY += srcH;
      bankInboundOffset.set(bank.id, dstOff + dstH);
    }
    return slices;
  }, [bankNodesWithY, flowH, inStartY]);

  // Build Stage 2 -> Stage 3 Direct Ribbons (Banks -> Final Categories)
  const bankToCatRibbons = useMemo(() => {
    type BankCatRibbon = {
      bank: (typeof bankNodesWithY)[0];
      cat: ConsolidatedCategory;
      amount: number;
      srcT: number;
      srcB: number;
      dstT: number;
      dstB: number;
    };
    const ribbons: BankCatRibbon[] = [];

    const bankOutOffset = new Map<string, number>();
    bankNodesWithY.forEach((b) => bankOutOffset.set(b.id, 0));

    const catInOffset = new Map<string, number>();
    categoryNodesWithY.forEach((cat) => catInOffset.set(cat.id, 0));

    for (const bank of bankNodesWithY) {
      for (const cat of categoryNodesWithY) {
        const sourceContrib = cat.sources.find((s) => s.bankId === bank.id);
        if (!sourceContrib || sourceContrib.amount <= 0) continue;

        const sliceH = flowH(sourceContrib.amount);
        const bOff = bankOutOffset.get(bank.id)!;
        const catOff = catInOffset.get(cat.id)!;

        ribbons.push({
          bank,
          cat,
          amount: sourceContrib.amount,
          srcT: bank.y + bOff,
          srcB: bank.y + bOff + sliceH,
          dstT: cat.y + catOff,
          dstB: cat.y + catOff + sliceH,
        });

        bankOutOffset.set(bank.id, bOff + sliceH);
        catInOffset.set(cat.id, catOff + sliceH);
      }
    }
    return ribbons;
  }, [bankNodesWithY, categoryNodesWithY, flowH]);

  // Highlighting Helpers
  const isBankActive = useCallback(
    (bankId: string) => {
      if (!activeHighlight) return true;
      if (activeHighlight.kind === 'inbound') return true;
      if (activeHighlight.kind === 'bank' && activeHighlight.id === bankId) return true;
      if (activeHighlight.kind === 'ribbon' && activeHighlight.bankId === bankId) return true;
      if (activeHighlight.kind === 'category') {
        const cat = categoryNodesWithY.find((c) => c.id === activeHighlight.id);
        return cat?.sources.some((s) => s.bankId === bankId) ?? false;
      }
      return false;
    },
    [activeHighlight, categoryNodesWithY],
  );

  const isCategoryActive = useCallback(
    (catId: string) => {
      if (!activeHighlight) return true;
      if (activeHighlight.kind === 'inbound') return true;
      if (activeHighlight.kind === 'category' && activeHighlight.id === catId) return true;
      if (activeHighlight.kind === 'ribbon' && activeHighlight.catId === catId) return true;
      if (activeHighlight.kind === 'bank') {
        const cat = categoryNodesWithY.find((c) => c.id === catId);
        return cat?.sources.some((s) => s.bankId === activeHighlight.id) ?? false;
      }
      return false;
    },
    [activeHighlight, categoryNodesWithY],
  );

  const isBankToCatRibbonActive = useCallback(
    (bankId: string, catId: string) => {
      if (!activeHighlight) return true;
      if (activeHighlight.kind === 'inbound') return true;
      if (activeHighlight.kind === 'bank') return activeHighlight.id === bankId;
      if (activeHighlight.kind === 'category') return activeHighlight.id === catId;
      if (activeHighlight.kind === 'ribbon') return activeHighlight.bankId === bankId && activeHighlight.catId === catId;
      return false;
    },
    [activeHighlight],
  );

  // ── Drag & Pan Handlers ──────────────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({
      clientX: e.clientX,
      clientY: e.clientY,
      startX: viewBox.x,
      startY: viewBox.y,
    });
    if (containerRef.current) {
      containerRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = viewBox.w / rect.width;
    const scaleY = viewBox.h / rect.height;

    const dx = e.clientX - dragStart.clientX;
    const dy = e.clientY - dragStart.clientY;

    setViewBox((prev) => ({
      ...prev,
      x: dragStart.startX - dx * scaleX,
      y: dragStart.startY - dy * scaleY,
    }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    if (containerRef.current && containerRef.current.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
  };

  // ── Zoom Handler (Mouse Wheel anchored at cursor) ─────────────────────────
  const zoomAtPoint = useCallback(
    (factor: number, clientX?: number, clientY?: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const normX = clientX !== undefined ? Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) : 0.5;
      const normY = clientY !== undefined ? Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)) : 0.5;

      setViewBox((prev) => {
        const cursorSvgX = prev.x + normX * prev.w;
        const cursorSvgY = prev.y + normY * prev.h;

        const minW = SVG_W / 3.2;
        const maxW = SVG_W * 2.2;
        const newW = Math.max(minW, Math.min(maxW, prev.w / factor));
        const newH = newW * (finalSvgH / SVG_W);

        const newX = cursorSvgX - normX * newW;
        const newY = cursorSvgY - normY * newH;

        return { x: newX, y: newY, w: newW, h: newH };
      });
    },
    [finalSvgH],
  );

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || isFullscreen) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.12 : 0.88;
        zoomAtPoint(factor, e.clientX, e.clientY);
      }
    },
    [zoomAtPoint, isFullscreen],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Zoom Button Controls
  const handleZoomIn = () => zoomAtPoint(1.2);
  const handleZoomOut = () => zoomAtPoint(0.8);

  const handleResetView = () => {
    setViewBox({ x: 0, y: 0, w: SVG_W, h: finalSvgH });
    setPinnedTarget(null);
    setHoverTarget(null);
    setHoveredFlow(null);
  };

  // Fullscreen Keyboard Listener (Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Export SVG as file
  const handleExportSvg = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = `direct-cash-flow-${new Date().toISOString().slice(0, 10)}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(svgUrl);
  };

  // Pin Toggle Helper
  const togglePin = (target: HoverTarget) => {
    if (pinnedTarget && target && pinnedTarget.kind === target.kind && (pinnedTarget as any).id === (target as any).id) {
      setPinnedTarget(null);
    } else {
      setPinnedTarget(target);
    }
  };

  return (
    <div
      style={{
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : undefined,
        left: isFullscreen ? 0 : undefined,
        right: isFullscreen ? 0 : undefined,
        bottom: isFullscreen ? 0 : undefined,
        width: isFullscreen ? '100vw' : '100%',
        height: isFullscreen ? '100vh' : 'auto',
        zIndex: isFullscreen ? 99999 : 1,
        background: isFullscreen ? 'var(--background)' : 'transparent',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: isFullscreen ? 0 : '14px',
        overflow: 'hidden',
      }}
    >
      {/* ── Top Header Toolbar when in Fullscreen ──────────────────────── */}
      {isFullscreen && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 24px',
            borderBottom: '1px solid var(--line)',
            background: 'var(--card)',
            zIndex: 20,
          }}
        >
          <div>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--muted)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
              Direct Multi-Bank Cash Flow Sankey
            </span>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
              External Inbound → Funding Banks → Final Expense Categories
            </div>
          </div>
          <button
            onClick={() => setIsFullscreen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              background: 'var(--background-alt)',
              border: '1px solid var(--line)',
              borderRadius: '8px',
              color: 'var(--ink)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Minimize2 size={15} />
            Exit Fullscreen
          </button>
        </div>
      )}

      {/* ── Main Interactive Canvas Area ──────────────────────────────── */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleResetView}
        style={{
          width: '100%',
          height: isFullscreen ? 'calc(100vh - 65px)' : 'auto',
          position: 'relative',
          overflow: 'hidden',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          touchAction: 'none',
          background: 'var(--background-alt)',
          borderRadius: isFullscreen ? '0' : '10px',
          border: isFullscreen ? 'none' : '1px solid var(--line)',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        {/* ── Floating Info / Hover / Pin Banner ───────────────────────── */}
        {hoveredFlow ? (
          <div
            style={{
              position: 'absolute',
              top: 14,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--card)',
              border: `1.5px solid ${hoveredFlow.color}`,
              borderRadius: 12,
              padding: '8px 20px',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--ink)',
              boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 30,
              display: 'flex',
              gap: 12,
              alignItems: 'center',
            }}
          >
            {pinnedTarget && <Pin size={14} color={hoveredFlow.color} />}
            <span>{hoveredFlow.title}</span>
            <span style={{ color: hoveredFlow.color, fontSize: '14px', fontWeight: 800 }}>{hoveredFlow.amount}</span>
            {hoveredFlow.subtitle && <span style={{ color: 'var(--muted)', fontSize: '11px', fontWeight: 500 }}>({hoveredFlow.subtitle})</span>}
          </div>
        ) : pinnedTarget ? (
          <div
            style={{
              position: 'absolute',
              top: 14,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: 12,
              padding: '6px 16px',
              fontSize: 12,
              color: 'var(--muted)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              zIndex: 30,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              cursor: 'pointer',
            }}
            onClick={() => setPinnedTarget(null)}
          >
            <PinOff size={13} />
            <span>Path is pinned. Click here or canvas to unpin.</span>
          </div>
        ) : null}

        {/* ── Subtle Floating Side Controls ────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: '3px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
            backdropFilter: 'blur(8px)',
            opacity: 0.75,
            transition: 'opacity 0.2s ease, box-shadow 0.2s ease',
            zIndex: 40,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.boxShadow = '0 4px 18px rgba(0,0,0,0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.75';
            e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.06)';
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Zoom In */}
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In (Ctrl + Scroll)"
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-alt)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <ZoomIn size={13} />
          </button>

          {/* Zoom Out */}
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out (Ctrl + Scroll)"
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-alt)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <ZoomOut size={13} />
          </button>

          {/* Reset View */}
          <button
            type="button"
            onClick={handleResetView}
            title="Reset Pan & Zoom"
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: viewBox.w !== SVG_W || viewBox.h !== finalSvgH || viewBox.x !== 0 || viewBox.y !== 0 ? 'var(--accent)' : 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-alt)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <RotateCcw size={13} />
          </button>

          <div style={{ width: 14, height: 1, background: 'var(--line)', margin: '2px 0' }} />

          {/* Live Flow Currents Toggle */}
          <button
            type="button"
            onClick={() => setShowAnimations(!showAnimations)}
            title={showAnimations ? 'Disable Animated Stream Particles' : 'Enable Animated Stream Particles'}
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              border: 'none',
              background: showAnimations ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              color: showAnimations ? 'var(--accent)' : 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { if (!showAnimations) e.currentTarget.style.background = 'var(--background-alt)'; }}
            onMouseLeave={(e) => { if (!showAnimations) e.currentTarget.style.background = 'transparent'; }}
          >
            <Sparkles size={13} />
          </button>

          {/* Export SVG */}
          <button
            type="button"
            onClick={handleExportSvg}
            title="Download Diagram as SVG"
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-alt)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Download size={13} />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen View'}
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              border: 'none',
              background: isFullscreen ? 'var(--accent)' : 'transparent',
              color: isFullscreen ? '#fff' : 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => { if (!isFullscreen) e.currentTarget.style.background = 'var(--background-alt)'; }}
            onMouseLeave={(e) => { if (!isFullscreen) e.currentTarget.style.background = 'transparent'; }}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>

        {/* ── The Dynamic ViewBox SVG Canvas ────────────────────────────── */}
        <svg
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          style={{
            width: '100%',
            height: 'auto',
            maxHeight: isFullscreen ? 'calc(100vh - 65px)' : '680px',
            display: 'block',
            overflow: 'hidden',
          }}
        >
          <defs>
            {/* Animated Current Keyframes */}
            <style>{`
              @keyframes flowCurrentPulse {
                0% { stroke-dashoffset: 60; }
                100% { stroke-dashoffset: 0; }
              }
              .flowing-stream {
                stroke-dasharray: 6, 12;
                animation: flowCurrentPulse 1.8s linear infinite;
              }
            `}</style>

            {/* Bank Inbound Gradients */}
            {bankNodesWithY.map((b) => (
              <linearGradient key={`gi-${b.id}`} id={`gi-${b.id}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor={b.color} />
              </linearGradient>
            ))}

            {/* Bank to Final Category Gradients */}
            {bankNodesWithY.flatMap((b) =>
              categoryNodesWithY.map((c) => (
                <linearGradient key={`g-bc-${b.id}-${c.id}`} id={`g-bc-${b.id}-${c.id}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={b.color} />
                  <stop offset="100%" stopColor={c.color} />
                </linearGradient>
              )),
            )}
          </defs>

          {/* ── Stage Column Headers ─────────────────────────────────── */}
          <g className="stage-headers" opacity="0.9">
            {/* Stage 1 Header */}
            <g transform={`translate(${LEFT_X - 12}, 26)`}>
              <text x="0" y="0" fill="var(--muted)" fontSize="9.5" fontWeight="800" letterSpacing="0.8px" textAnchor="end">
                1. INFLOW
              </text>
              <text x="0" y="14" fill="#059669" fontSize="11" fontWeight="700" textAnchor="end">
                External Income
              </text>
            </g>

            {/* Stage 2 Header */}
            <g transform={`translate(${MID_X - 12}, 26)`}>
              <text x="0" y="0" fill="var(--muted)" fontSize="9.5" fontWeight="800" letterSpacing="0.8px" textAnchor="end">
                2. FUNDING ACCOUNTS
              </text>
              <text x="0" y="14" fill="var(--ink)" fontSize="11" fontWeight="700" textAnchor="end">
                Banks
              </text>
            </g>

            {/* Stage 3 Header */}
            <g transform={`translate(${CAT_X}, 26)`}>
              <text x="0" y="0" fill="var(--muted)" fontSize="9.5" fontWeight="800" letterSpacing="0.8px">
                3. FINAL EXPENSES
              </text>
              <text x="0" y="14" fill="var(--ink)" fontSize="11" fontWeight="700">
                Consolidated Categories
              </text>
            </g>
          </g>

          {/* ── Stage 1 -> Stage 2: Inbound Ribbons ─────────────────── */}
          {inSlices.map(({ bank, srcT, srcB, dstT, dstB }) => {
            const act = isBankActive(bank.id);
            const pathD = ribbon(LEFT_X + NODE_W, srcT, srcB, MID_X, dstT, dstB);
            const midRibbonPath = `M ${LEFT_X + NODE_W} ${(srcT + srcB) / 2} C ${LEFT_X + NODE_W + 120} ${(srcT + srcB) / 2}, ${MID_X - 120} ${(dstT + dstB) / 2}, ${MID_X} ${(dstT + dstB) / 2}`;

            return (
              <g key={`in-group-${bank.id}`}>
                <path
                  d={pathD}
                  fill={`url(#gi-${bank.id})`}
                  opacity={act ? 0.38 : 0.05}
                  style={{ transition: 'opacity 0.25s ease' }}
                />
                {act && showAnimations && (
                  <path
                    d={midRibbonPath}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={Math.min(3, Math.max(1, (srcB - srcT) / 4))}
                    className="flowing-stream"
                    opacity={0.7}
                    pointerEvents="none"
                  />
                )}
              </g>
            );
          })}

          {/* ── Stage 2 -> Stage 3: Direct Bank to Category Ribbons ──── */}
          {bankToCatRibbons.map(({ bank, cat, amount, srcT, srcB, dstT, dstB }) => {
            const act = isBankToCatRibbonActive(bank.id, cat.id);
            const pathD = ribbon(MID_X + NODE_W, srcT, srcB, CAT_X, dstT, dstB);
            const midRibbonPath = `M ${MID_X + NODE_W} ${(srcT + srcB) / 2} C ${MID_X + NODE_W + 140} ${(srcT + srcB) / 2}, ${CAT_X - 140} ${(dstT + dstB) / 2}, ${CAT_X} ${(dstT + dstB) / 2}`;

            return (
              <g
                key={`ribbon-bc-${bank.id}-${cat.id}`}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => {
                  setHoverTarget({ kind: 'ribbon', bankId: bank.id, catId: cat.id });
                  setHoveredFlow({
                    title: `${bank.name} → ${cat.name}`,
                    amount: money(amount),
                    color: bank.color,
                    subtitle: `${Math.round((amount / totalOutboundSum) * 100)}% of total spend`,
                  });
                }}
                onMouseLeave={() => {
                  setHoverTarget(null);
                  setHoveredFlow(null);
                }}
                onClick={() => togglePin({ kind: 'ribbon', bankId: bank.id, catId: cat.id } as any)}
              >
                <path
                  d={pathD}
                  fill={`url(#g-bc-${bank.id}-${cat.id})`}
                  opacity={act ? 0.38 : 0.04}
                  style={{ transition: 'opacity 0.25s ease' }}
                />
                {act && showAnimations && (
                  <path
                    d={midRibbonPath}
                    fill="none"
                    stroke={bank.color}
                    strokeWidth={Math.min(3, Math.max(1, (srcB - srcT) / 4))}
                    className="flowing-stream"
                    opacity={0.7}
                    pointerEvents="none"
                  />
                )}
              </g>
            );
          })}

          {/* ── Stage 1: Inbound Bar & Label ─────────────────────────── */}
          <g
            transform={`translate(${LEFT_X}, ${inStartY})`}
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => {
              setHoverTarget({ kind: 'inbound' });
              setHoveredFlow({
                title: 'External Inbound',
                amount: `+${money(totalInboundVolume)}`,
                color: '#10b981',
                subtitle: 'Total incoming earnings deposited to accounts',
              });
            }}
            onMouseLeave={() => {
              setHoverTarget(null);
              setHoveredFlow(null);
            }}
            onClick={() => togglePin({ kind: 'inbound' })}
          >
            <rect
              x={0}
              y={0}
              width={NODE_W}
              height={inboundH}
              rx={4}
              fill="#10b981"
              opacity={!activeHighlight || activeHighlight.kind === 'inbound' ? 1 : 0.4}
              filter={activeHighlight?.kind === 'inbound' ? 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.6))' : undefined}
            />
            {/* Label to the Left */}
            <text x={-14} y={inboundH / 2 - 6} fill="var(--ink)" fontSize="13" fontWeight="800" textAnchor="end">
              External Inbound
            </text>
            <text x={-14} y={inboundH / 2 + 10} fill="#059669" fontSize="12" fontWeight="700" textAnchor="end">
              +{money(totalInboundVolume)}
            </text>
          </g>

          {/* ── Stage 2: Bank Nodes & Labels ─────────────────────────── */}
          {bankNodesWithY.map((b) => {
            const act = isBankActive(b.id);
            const isHovered = activeHighlight?.kind === 'bank' && activeHighlight.id === b.id;

            return (
              <g
                key={`bank-node-${b.id}`}
                transform={`translate(${b.x}, ${b.y})`}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => {
                  setHoverTarget({ kind: 'bank', id: b.id });
                  setHoveredFlow({
                    title: b.name,
                    amount: `${money(b.outTotal)} spent`,
                    color: b.color,
                    subtitle: `Total Outbound funded: ${money(b.outTotal)}`,
                  });
                }}
                onMouseLeave={() => {
                  setHoverTarget(null);
                  setHoveredFlow(null);
                }}
                onClick={() => togglePin({ kind: 'bank', id: b.id })}
              >
                <rect
                  x={0}
                  y={0}
                  width={NODE_W}
                  height={b.height}
                  rx={4}
                  fill={b.color}
                  opacity={act ? 1 : 0.25}
                  filter={isHovered ? `drop-shadow(0 0 10px ${b.color})` : undefined}
                  style={{ transition: 'all 0.2s ease' }}
                />

                {/* Bank Name and Details to the Left */}
                <text x={-12} y={b.height / 2 - 8} fill="var(--ink)" fontSize="12.5" fontWeight="700" textAnchor="end">
                  {b.name}
                </text>
                <text x={-12} y={b.height / 2 + 8} fill="var(--muted)" fontSize="10.5" fontWeight="600" textAnchor="end">
                  <tspan fill="#10b981">+{money(b.inTotal, true)}</tspan> / <tspan fill="#ef4444">-{money(b.outTotal, true)}</tspan>
                </text>
              </g>
            );
          })}

          {/* ── Stage 3: Consolidated Category Nodes & Labels ────────── */}
          {categoryNodesWithY.map((c) => {
            const act = isCategoryActive(c.id);
            const isHovered = activeHighlight?.kind === 'category' && activeHighlight.id === c.id;
            const pct = Math.round((c.totalAmount / totalOutboundSum) * 100);

            return (
              <g
                key={`cat-node-${c.id}`}
                transform={`translate(${c.x}, ${c.y})`}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => {
                  setHoverTarget({ kind: 'category', id: c.id });
                  const sourcesText = c.sources.map((s) => `${s.bankName}: ${money(s.amount)}`).join(', ');
                  setHoveredFlow({
                    title: c.name,
                    amount: money(c.totalAmount),
                    color: c.color,
                    subtitle: `${pct}% of spend • Funded by ${sourcesText}`,
                  });
                }}
                onMouseLeave={() => {
                  setHoverTarget(null);
                  setHoveredFlow(null);
                }}
                onClick={() => togglePin({ kind: 'category', id: c.id })}
              >
                <rect
                  x={0}
                  y={0}
                  width={NODE_W}
                  height={c.height}
                  rx={4}
                  fill={c.color}
                  opacity={act ? 1 : 0.25}
                  filter={isHovered ? `drop-shadow(0 0 8px ${c.color})` : undefined}
                  style={{ transition: 'all 0.2s ease' }}
                />

                {/* Category Dot, Name & Value to the Right */}
                <circle cx={NODE_W + 12} cy={c.height / 2} r={3.5} fill={c.color} />
                <text x={NODE_W + 20} y={c.height / 2 - 2} fill="var(--ink)" fontSize="12" fontWeight="700">
                  {c.name}
                </text>
                <text x={NODE_W + 20} y={c.height / 2 + 10} fill="var(--muted)" fontSize="10.5" fontWeight="600">
                  {money(c.totalAmount)} <tspan fill="var(--muted)" opacity="0.8">({pct}%)</tspan>
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
