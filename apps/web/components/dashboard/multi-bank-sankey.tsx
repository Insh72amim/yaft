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
  Move,
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
  | { kind: 'supergroup'; id: string }
  | { kind: 'category'; id: string }
  | { kind: 'interbank'; fromId: string; toId: string }
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
  const { accounts, internalTransfers, overall } = accountFlow;

  // ── Layout Constants ──────────────────────────────────────────────────────
  const SVG_W = 1420;
  const PAD_TOP = 80;
  const PAD_BOTTOM = 50;
  const NODE_W = 16;
  const NODE_GAP = 28;
  const MIN_BANK_H = 48;
  const LEFT_X = 140;
  const MID_X = 440;
  const HUB_X = 770;
  const CAT_X = 1110;
  const ARC_X = MID_X + NODE_W + 36;

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

  // ── Bank Transfers Aggregation ────────────────────────────────────────────
  const aggregatedBankTransfers = useMemo(() => {
    const map = new Map<
      string,
      { fromAccountId: string; toAccountId: string; fromAccountName: string; toAccountName: string; totalAmount: number; count: number }
    >();
    for (const it of internalTransfers) {
      if (it.toAccountType === 'CREDIT_CARD' || it.toAccountType === 'UPI_LITE') continue;
      const key = `${it.fromAccountId}_${it.toAccountId}`;
      const ex = map.get(key);
      if (ex) {
        ex.totalAmount += it.amount;
        ex.count += 1;
      } else {
        map.set(key, {
          fromAccountId: it.fromAccountId,
          toAccountId: it.toAccountId,
          fromAccountName: it.fromAccountName,
          toAccountName: it.toAccountName,
          totalAmount: it.amount,
          count: 1,
        });
      }
    }
    return [...map.values()];
  }, [internalTransfers]);

  // 1. Determine active supergroups
  const activeSupergroups: SupergroupData[] = useMemo(() => {
    if (overall.supergroups && overall.supergroups.length > 0) {
      return overall.supergroups.filter((sg) => sg.id !== 'INTERNAL_TRANSFERS' && sg.amount > 0);
    }
    return [
      {
        id: 'EXPENSES',
        name: 'Living Expenses',
        kind: 'EXPENSE',
        color: '#ef4444',
        amount: overall.totalExternalOutbound,
        categories: overall.categoryFlow?.outboundCategories || [],
      },
      {
        id: 'INVESTMENTS',
        name: 'Investments',
        kind: 'INVESTMENT',
        color: '#8b5cf6',
        amount: overall.totalInvestments || 0,
        categories: overall.categoryFlow?.investmentCategories || [],
      },
      {
        id: 'CC_PAYMENTS',
        name: 'Credit Card Payments',
        kind: 'TRANSFER',
        color: '#10b981',
        amount: overall.totalCreditCardPayments || 0,
        categories: overall.categoryFlow?.creditCardCategories || [],
      },
    ].filter((sg) => sg.amount > 0);
  }, [overall]);

  // 2. Calculate per-bank volume totals
  const bankVolumes = useMemo(() => {
    return accounts.map((a, idx) => {
      const tIn = aggregatedBankTransfers.filter((t) => t.toAccountId === a.id).reduce((s, t) => s + t.totalAmount, 0);
      const tOut = aggregatedBankTransfers.filter((t) => t.fromAccountId === a.id).reduce((s, t) => s + t.totalAmount, 0);

      const inTotal = a.externalInbound + (a.internalInbound || tIn);

      const sgContributions: Record<string, number> = {};
      if (a.supergroups) {
        a.supergroups.forEach((sg) => {
          if (activeSupergroups.some((asg) => asg.id === sg.id)) {
            sgContributions[sg.id] = sg.amount;
          }
        });
      } else {
        sgContributions['EXPENSES'] = a.expenses ?? a.externalOutbound;
        if ((a.investments ?? 0) > 0) sgContributions['INVESTMENTS'] = a.investments ?? 0;
        if ((a.other ?? 0) > 0) sgContributions['OTHER'] = a.other ?? 0;
        if ((a.creditCardPayments ?? 0) > 0) sgContributions['CC_PAYMENTS'] = a.creditCardPayments ?? 0;
      }

      const outTotal = Object.values(sgContributions).reduce((s, v) => s + v, 0) + tOut;

      return {
        ...a,
        color: getBankColor(idx, a.name),
        tIn,
        tOut,
        inTotal,
        outTotal,
        sgContributions,
        maxVolume: Math.max(inTotal, outTotal, 1),
      };
    });
  }, [accounts, aggregatedBankTransfers, activeSupergroups, getBankColor]);

  // 3. System volume totals & scaling
  const totalInboundVolume = bankVolumes.reduce((s, b) => s + b.inTotal, 0);
  const totalOutboundVolume = bankVolumes.reduce((s, b) => s + b.outTotal, 0);
  const maxSystemVolume = Math.max(totalInboundVolume, totalOutboundVolume, 1);

  const minHeightNeeded = Math.max(
    accounts.length * MIN_BANK_H + (accounts.length - 1) * NODE_GAP,
    activeSupergroups.length * 56 + (activeSupergroups.length - 1) * NODE_GAP,
    440,
  );
  const usableH = Math.max(480, minHeightNeeded);

  const scale = (usableH * 0.72) / maxSystemVolume;
  const flowH = useCallback((amt: number) => (amt > 0 ? Math.max(3, Math.round(amt * scale)) : 0), [scale]);

  // 4. Position Stage 1: Inbound Node
  const inSlicesData = bankVolumes.filter((b) => b.inTotal > 0).map((b) => flowH(b.inTotal));
  const inboundH = Math.max(40, inSlicesData.reduce((s, h) => s + h, 0));
  const inStartY = PAD_TOP + (usableH - inboundH) / 2;

  // 5. Position Stage 2: Bank Nodes
  const bankNodesWithY = useMemo(() => {
    let bankCurY = PAD_TOP;
    return bankVolumes.map((b) => {
      const sumInH = flowH(b.inTotal);
      const sumOutH = Object.values(b.sgContributions).reduce((s, v) => s + flowH(v), 0) + flowH(b.tOut);
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
  }, [bankVolumes, flowH]);

  // 6. Position Stage 3: Supergroup Hub Nodes
  const supergroupNodesWithY = useMemo(() => {
    const supergroupNodesData = activeSupergroups.map((sg) => {
      const bankIncomingH = bankNodesWithY.reduce((sum, b) => {
        const amt = b.sgContributions[sg.id] || 0;
        return sum + flowH(amt);
      }, 0);

      const baseH = Math.max(36, bankIncomingH > 0 ? bankIncomingH : flowH(sg.amount));
      return {
        ...sg,
        height: baseH,
      };
    });

    const sgGap = 28;
    const totalSgBlockH = supergroupNodesData.reduce((s, sg) => s + sg.height, 0) + (supergroupNodesData.length - 1) * sgGap;
    const sgStartY = PAD_TOP + Math.max(0, (usableH - totalSgBlockH) / 2);

    let sgCurY = Math.max(PAD_TOP, sgStartY);
    return supergroupNodesData.map((node) => {
      const n = { ...node, x: HUB_X, y: sgCurY };
      sgCurY += node.height + sgGap;
      return n;
    });
  }, [activeSupergroups, bankNodesWithY, flowH, usableH]);

  // 7. Position Stage 4: Consolidated Unified Expense Categories
  type ConsolidatedCategory = {
    id: string;
    name: string;
    color: string;
    totalAmount: number;
    sources: Array<{
      superGroupId: string;
      superGroupName: string;
      superGroupColor: string;
      amount: number;
    }>;
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
        sources: Array<{
          superGroupId: string;
          superGroupName: string;
          superGroupColor: string;
          amount: number;
        }>;
      }
    >();

    for (const sg of supergroupNodesWithY) {
      const cats = sg.categories || [];
      for (const c of cats) {
        if (c.amount <= 0) continue;
        const normalizedName = c.name.trim();
        const key = normalizedName.toLowerCase();
        const existing = map.get(key);
        if (existing) {
          existing.totalAmount += c.amount;
          existing.sources.push({
            superGroupId: sg.id,
            superGroupName: sg.name,
            superGroupColor: sg.color,
            amount: c.amount,
          });
          if (c.color && (!existing.color || existing.color === '#94a3b8')) {
            existing.color = c.color;
          }
        } else {
          map.set(key, {
            id: key.replace(/[^a-z0-9]/g, '-'),
            name: normalizedName,
            color: c.color || sg.color,
            totalAmount: c.amount,
            sources: [
              {
                superGroupId: sg.id,
                superGroupName: sg.name,
                superGroupColor: sg.color,
                amount: c.amount,
              },
            ],
          });
        }
      }
    }

    const list = Array.from(map.values());

    // Barycentric sort to minimize crossings
    return list.sort((a, b) => {
      const weightA =
        a.sources.reduce((sum, s) => {
          const sg = supergroupNodesWithY.find((n) => n.id === s.superGroupId);
          const sgCenterY = sg ? sg.y + sg.height / 2 : 0;
          return sum + sgCenterY * s.amount;
        }, 0) / a.totalAmount;

      const weightB =
        b.sources.reduce((sum, s) => {
          const sg = supergroupNodesWithY.find((n) => n.id === s.superGroupId);
          const sgCenterY = sg ? sg.y + sg.height / 2 : 0;
          return sum + sgCenterY * s.amount;
        }, 0) / b.totalAmount;

      if (Math.abs(weightA - weightB) > 2) {
        return weightA - weightB;
      }
      return b.totalAmount - a.totalAmount;
    });
  }, [supergroupNodesWithY]);

  const categoryNodesWithY: ConsolidatedCategory[] = useMemo(() => {
    const catGap = 10;
    let catCurY = PAD_TOP;

    return consolidatedCategories.map((c) => {
      const incomingFlowH = c.sources.reduce((sum, s) => sum + flowH(s.amount), 0);
      const sliceH = Math.max(18, incomingFlowH > 0 ? incomingFlowH : flowH(c.totalAmount));
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
    ...supergroupNodesWithY.map((s) => s.y + s.height),
    ...categoryNodesWithY.map((c) => c.y + c.height),
    usableH + PAD_TOP,
  );

  const finalSvgH = Math.max(maxColumnBottom + PAD_BOTTOM, 620);
  const totalOutboundSum = activeSupergroups.reduce((s, sg) => s + sg.amount, 0) || 1;

  // ── Pan & Zoom State (ViewBox Matrix) ────────────────────────────────────
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: SVG_W, h: finalSvgH });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ clientX: 0, clientY: 0, startX: 0, startY: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAnimations, setShowAnimations] = useState(true);

  // Sync initial viewBox when finalSvgH changes
  useEffect(() => {
    setViewBox((prev) => {
      // Only reset if at default zoom
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

  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointerDownRef = useRef(false);

  // Ribbon Path Helper
  const ribbon = (x1: number, yT1: number, yB1: number, x2: number, yT2: number, yB2: number) => {
    const cp = (x2 - x1) * 0.42;
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

  // Build Stage 2 -> Stage 3 Ribbons (Banks -> Supergroups)
  const bankToSgRibbons = useMemo(() => {
    type SgRibbon = {
      bank: (typeof bankNodesWithY)[0];
      sg: (typeof supergroupNodesWithY)[0];
      amount: number;
      srcT: number;
      srcB: number;
      dstT: number;
      dstB: number;
    };
    const ribbons: SgRibbon[] = [];

    const bankOutOffset = new Map<string, number>();
    bankNodesWithY.forEach((b) => bankOutOffset.set(b.id, 0));

    const sgInOffset = new Map<string, number>();
    supergroupNodesWithY.forEach((sg) => sgInOffset.set(sg.id, 0));

    for (const bank of bankNodesWithY) {
      for (const sg of supergroupNodesWithY) {
        const amt = bank.sgContributions[sg.id] || 0;
        if (amt <= 0) continue;

        const sliceH = flowH(amt);
        const bOff = bankOutOffset.get(bank.id)!;
        const sgOff = sgInOffset.get(sg.id)!;

        ribbons.push({
          bank,
          sg,
          amount: amt,
          srcT: bank.y + bOff,
          srcB: bank.y + bOff + sliceH,
          dstT: sg.y + sgOff,
          dstB: sg.y + sgOff + sliceH,
        });

        bankOutOffset.set(bank.id, bOff + sliceH);
        sgInOffset.set(sg.id, sgOff + sliceH);
      }
    }
    return ribbons;
  }, [bankNodesWithY, supergroupNodesWithY, flowH]);

  // Build Stage 3 -> Stage 4 Ribbons (Supergroups -> Consolidated Categories)
  const sgToCatRibbons = useMemo(() => {
    type CatRibbon = {
      sg: (typeof supergroupNodesWithY)[0];
      cat: ConsolidatedCategory;
      amount: number;
      srcT: number;
      srcB: number;
      dstT: number;
      dstB: number;
    };
    const ribbons: CatRibbon[] = [];

    const sgOutOffset = new Map<string, number>();
    supergroupNodesWithY.forEach((sg) => sgOutOffset.set(sg.id, 0));

    const catInOffset = new Map<string, number>();
    categoryNodesWithY.forEach((cat) => catInOffset.set(cat.id, 0));

    for (const sg of supergroupNodesWithY) {
      for (const cat of categoryNodesWithY) {
        const sourceContrib = cat.sources.find((s) => s.superGroupId === sg.id);
        if (!sourceContrib || sourceContrib.amount <= 0) continue;

        const sliceH = flowH(sourceContrib.amount);
        const sgOff = sgOutOffset.get(sg.id)!;
        const catOff = catInOffset.get(cat.id)!;

        ribbons.push({
          sg,
          cat,
          amount: sourceContrib.amount,
          srcT: sg.y + sgOff,
          srcB: sg.y + sgOff + sliceH,
          dstT: cat.y + catOff,
          dstB: cat.y + catOff + sliceH,
        });

        sgOutOffset.set(sg.id, sgOff + sliceH);
        catInOffset.set(cat.id, catOff + sliceH);
      }
    }
    return ribbons;
  }, [supergroupNodesWithY, categoryNodesWithY, flowH]);

  // Highlighting Helpers
  const isBankActive = useCallback((bankId: string) => {
    if (!activeHighlight) return true;
    if (activeHighlight.kind === 'inbound') return true;
    if (activeHighlight.kind === 'bank' && activeHighlight.id === bankId) return true;
    if (activeHighlight.kind === 'interbank' && (activeHighlight.fromId === bankId || activeHighlight.toId === bankId)) return true;
    if (activeHighlight.kind === 'supergroup') {
      const b = bankNodesWithY.find((n) => n.id === bankId);
      return (b?.sgContributions[activeHighlight.id] || 0) > 0;
    }
    if (activeHighlight.kind === 'category') {
      const cat = categoryNodesWithY.find((c) => c.id === activeHighlight.id);
      const b = bankNodesWithY.find((n) => n.id === bankId);
      return cat?.sources.some((s) => (b?.sgContributions[s.superGroupId] || 0) > 0) ?? false;
    }
    return false;
  }, [activeHighlight, bankNodesWithY, categoryNodesWithY]);

  const isSupergroupActive = useCallback((sgId: string) => {
    if (!activeHighlight) return true;
    if (activeHighlight.kind === 'inbound') return true;
    if (activeHighlight.kind === 'supergroup' && activeHighlight.id === sgId) return true;
    if (activeHighlight.kind === 'bank') {
      const b = bankNodesWithY.find((n) => n.id === activeHighlight.id);
      return (b?.sgContributions[sgId] || 0) > 0;
    }
    if (activeHighlight.kind === 'category') {
      const cat = categoryNodesWithY.find((c) => c.id === activeHighlight.id);
      return cat?.sources.some((s) => s.superGroupId === sgId) ?? false;
    }
    return false;
  }, [activeHighlight, bankNodesWithY, categoryNodesWithY]);

  const isCategoryActive = useCallback((catId: string) => {
    if (!activeHighlight) return true;
    if (activeHighlight.kind === 'inbound') return true;
    if (activeHighlight.kind === 'category' && activeHighlight.id === catId) return true;
    if (activeHighlight.kind === 'supergroup') {
      const cat = categoryNodesWithY.find((c) => c.id === catId);
      return cat?.sources.some((s) => s.superGroupId === activeHighlight.id) ?? false;
    }
    if (activeHighlight.kind === 'bank') {
      const b = bankNodesWithY.find((n) => n.id === activeHighlight.id);
      const cat = categoryNodesWithY.find((c) => c.id === catId);
      return cat?.sources.some((s) => (b?.sgContributions[s.superGroupId] || 0) > 0) ?? false;
    }
    return false;
  }, [activeHighlight, bankNodesWithY, categoryNodesWithY]);

  const isBankToSgRibbonActive = useCallback((bankId: string, sgId: string) => {
    if (!activeHighlight) return true;
    if (activeHighlight.kind === 'inbound') return true;
    if (activeHighlight.kind === 'bank') return activeHighlight.id === bankId;
    if (activeHighlight.kind === 'supergroup') return activeHighlight.id === sgId;
    if (activeHighlight.kind === 'category') {
      const cat = categoryNodesWithY.find((c) => c.id === activeHighlight.id);
      const b = bankNodesWithY.find((n) => n.id === bankId);
      return cat?.sources.some((s) => s.superGroupId === sgId && (b?.sgContributions[sgId] || 0) > 0) ?? false;
    }
    return false;
  }, [activeHighlight, categoryNodesWithY, bankNodesWithY]);

  const isSgToCatRibbonActive = useCallback((sgId: string, catId: string) => {
    if (!activeHighlight) return true;
    if (activeHighlight.kind === 'inbound') return true;
    if (activeHighlight.kind === 'category') return activeHighlight.id === catId;
    if (activeHighlight.kind === 'supergroup') return activeHighlight.id === sgId;
    if (activeHighlight.kind === 'bank') {
      const b = bankNodesWithY.find((n) => n.id === activeHighlight.id);
      const cat = categoryNodesWithY.find((c) => c.id === catId);
      return (b?.sgContributions[sgId] || 0) > 0 && (cat?.sources.some((s) => s.superGroupId === sgId) ?? false);
    }
    return false;
  }, [activeHighlight, bankNodesWithY, categoryNodesWithY]);

  // ── Drag & Pan Handlers ──────────────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const targetEl = e.target as Element | null;
    if (targetEl?.closest?.('button, [data-no-pan="true"]')) return;
    pointerDownRef.current = true;
    setDragStart({
      clientX: e.clientX,
      clientY: e.clientY,
      startX: viewBox.x,
      startY: viewBox.y,
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointerDownRef.current || !containerRef.current) return;
    const dx = e.clientX - dragStart.clientX;
    const dy = e.clientY - dragStart.clientY;

    if (!isDragging) {
      if (Math.hypot(dx, dy) < 4) return;
      setIsDragging(true);
      try {
        containerRef.current.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture is unavailable
      }
    }

    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = viewBox.w / (rect.width || 1);
    const scaleY = viewBox.h / (rect.height || 1);

    setViewBox((prev) => ({
      ...prev,
      x: dragStart.startX - dx * scaleX,
      y: dragStart.startY - dy * scaleY,
    }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    pointerDownRef.current = false;
    if (!isDragging) return;
    setIsDragging(false);
    try {
      if (containerRef.current && containerRef.current.hasPointerCapture(e.pointerId)) {
        containerRef.current.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore release errors
    }
  };

  // ── Zoom Handler (Mouse Wheel anchored at cursor) ─────────────────────────
  const zoomAtPoint = useCallback((factor: number, clientX?: number, clientY?: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const normX =
      rect && clientX !== undefined && rect.width > 0
        ? Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
        : 0.5;
    const normY =
      rect && clientY !== undefined && rect.height > 0
        ? Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
        : 0.5;

    setViewBox((prev) => {
      const cursorSvgX = prev.x + normX * prev.w;
      const cursorSvgY = prev.y + normY * prev.h;

      const minW = SVG_W / 3.2; // 320% max zoom in
      const maxW = SVG_W * 2.2; // 45% max zoom out
      const newW = Math.max(minW, Math.min(maxW, prev.w / factor));
      const newH = newW * (finalSvgH / SVG_W);

      const newX = cursorSvgX - normX * newW;
      const newY = cursorSvgY - normY * newH;

      return { x: newX, y: newY, w: newW, h: newH };
    });
  }, [finalSvgH]);

  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey || isFullscreen) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 0.88;
      zoomAtPoint(factor, e.clientX, e.clientY);
    }
  }, [zoomAtPoint, isFullscreen]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Zoom Button Controls
  const handleZoomIn = () => zoomAtPoint(1.25);
  const handleZoomOut = () => zoomAtPoint(0.8);

  const handleResetView = () => {
    setViewBox({ x: 0, y: 0, w: SVG_W, h: finalSvgH });
    setPinnedTarget(null);
    setHoverTarget(null);
    setHoveredFlow(null);
  };

  const handleToggleFullscreen = useCallback(async () => {
    const nextState = !isFullscreen;
    setIsFullscreen(nextState);
    try {
      if (nextState && wrapperRef.current?.requestFullscreen && !document.fullscreenElement) {
        await wrapperRef.current.requestFullscreen();
      } else if (!nextState && document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // Fallback to CSS fixed fullscreen mode when browser Fullscreen API is unavailable
    }
  }, [isFullscreen]);

  // Sync with browser Fullscreen API & Escape key
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  // Export SVG as standalone file with resolved CSS theme variables
  const handleExportSvg = () => {
    if (!svgRef.current) return;
    const clonedSvg = svgRef.current.cloneNode(true) as SVGSVGElement;
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clonedSvg.setAttribute('width', String(SVG_W));
    clonedSvg.setAttribute('height', String(finalSvgH));
    clonedSvg.setAttribute('viewBox', `0 0 ${SVG_W} ${finalSvgH}`);

    const computed = window.getComputedStyle(document.documentElement);
    const ink = computed.getPropertyValue('--ink').trim() || '#e2e8f0';
    const muted = computed.getPropertyValue('--muted').trim() || '#94a3b8';
    const card = computed.getPropertyValue('--card').trim() || '#0f172a';
    const bgAlt = computed.getPropertyValue('--background-alt').trim() || '#0b1310';
    const line = computed.getPropertyValue('--line').trim() || '#1e293b';
    const accent = computed.getPropertyValue('--accent').trim() || '#10b981';

    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = `
      svg {
        --ink: ${ink};
        --muted: ${muted};
        --card: ${card};
        --background-alt: ${bgAlt};
        --line: ${line};
        --accent: ${accent};
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
    `;
    clonedSvg.insertBefore(styleEl, clonedSvg.firstChild);

    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('x', '0');
    bgRect.setAttribute('y', '0');
    bgRect.setAttribute('width', String(SVG_W));
    bgRect.setAttribute('height', String(finalSvgH));
    bgRect.setAttribute('fill', bgAlt);
    clonedSvg.insertBefore(bgRect, styleEl.nextSibling);

    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = `cash-flow-sankey-${new Date().toISOString().slice(0, 10)}.svg`;
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

  const currentZoomPercent = Math.round((SVG_W / viewBox.w) * 100);

  return (
    <div
      ref={wrapperRef}
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
              Multi-Bank Cash Flow &amp; Hierarchical Settlement Flow
            </span>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
              Interactive Fullscreen Viewport — Drag to Pan, Scroll to Zoom
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleToggleFullscreen()}
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
            data-no-pan="true"
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
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setPinnedTarget(null)}
          >
            <PinOff size={13} />
            <span>Path is pinned. Click here or canvas to unpin.</span>
          </div>
        ) : null}

        {/* ── Subtle Floating Side Controls ────────────────────────────── */}
        <div
          data-no-pan="true"
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
            padding: '4px 3px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
            backdropFilter: 'blur(8px)',
            opacity: 0.9,
            transition: 'opacity 0.2s ease, box-shadow 0.2s ease',
            zIndex: 40,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.boxShadow = '0 4px 18px rgba(0,0,0,0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.9';
            e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.06)';
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Zoom In */}
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In (Ctrl + Scroll)"
            style={{
              width: 28,
              height: 28,
              padding: 0,
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: 'var(--ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-alt)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <ZoomIn size={14} />
          </button>

          {/* Zoom Level Indicator */}
          <span
            style={{
              fontSize: '9px',
              fontWeight: 700,
              color: currentZoomPercent !== 100 ? 'var(--accent)' : 'var(--muted)',
              lineHeight: 1,
              padding: '2px 0',
              userSelect: 'none',
            }}
          >
            {currentZoomPercent}%
          </span>

          {/* Zoom Out */}
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out (Ctrl + Scroll)"
            style={{
              width: 28,
              height: 28,
              padding: 0,
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: 'var(--ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-alt)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <ZoomOut size={14} />
          </button>

          {/* Reset / 100% Fit */}
          <button
            type="button"
            onClick={handleResetView}
            title={`Reset 100% View (${currentZoomPercent}%)`}
            style={{
              width: 28,
              height: 28,
              padding: 0,
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
            onClick={() => setShowAnimations((prev) => !prev)}
            title={showAnimations ? 'Disable Animated Stream Particles' : 'Enable Animated Stream Particles'}
            style={{
              width: 28,
              height: 28,
              padding: 0,
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
              width: 28,
              height: 28,
              padding: 0,
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: 'var(--ink)',
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
            onClick={() => void handleToggleFullscreen()}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen View'}
            style={{
              width: 28,
              height: 28,
              padding: 0,
              borderRadius: 6,
              border: 'none',
              background: isFullscreen ? 'var(--accent)' : 'transparent',
              color: isFullscreen ? '#fff' : 'var(--ink)',
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
            maxHeight: isFullscreen ? 'calc(100vh - 65px)' : '720px',
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

            {/* Bank to Supergroup Gradients */}
            {bankNodesWithY.flatMap((b) =>
              supergroupNodesWithY.map((sg) => (
                <linearGradient key={`g-bs-${b.id}-${sg.id}`} id={`g-bs-${b.id}-${sg.id}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={b.color} />
                  <stop offset="100%" stopColor={sg.color} />
                </linearGradient>
              )),
            )}

            {/* Supergroup to Consolidated Category Gradients */}
            {supergroupNodesWithY.flatMap((sg) =>
              categoryNodesWithY.map((c) => (
                <linearGradient
                  key={`g-sc-${sg.id}-${c.id}`}
                  id={`g-sc-${sg.id}-${c.id}`}
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="0"
                >
                  <stop offset="0%" stopColor={sg.color} />
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
                Banks &amp; Transfers
              </text>
            </g>

            {/* Stage 3 Header */}
            <g transform={`translate(${HUB_X}, 26)`}>
              <text x="0" y="0" fill="var(--muted)" fontSize="9.5" fontWeight="800" letterSpacing="0.8px">
                3. PAYMENT CHANNELS
              </text>
              <text x="0" y="14" fill="var(--ink)" fontSize="11" fontWeight="700">
                Direct, Cards &amp; Micro
              </text>
            </g>

            {/* Stage 4 Header */}
            <g transform={`translate(${CAT_X}, 26)`}>
              <text x="0" y="0" fill="var(--muted)" fontSize="9.5" fontWeight="800" letterSpacing="0.8px">
                4. FINAL EXPENSES
              </text>
              <text x="0" y="14" fill="var(--ink)" fontSize="11" fontWeight="700">
                Consolidated Destinations
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
                  opacity={act ? 0.55 : 0.05}
                  style={{ transition: 'opacity .18s', cursor: 'pointer' }}
                  onClick={() => togglePin({ kind: 'bank', id: bank.id })}
                  onMouseEnter={() => {
                    setHoverTarget({ kind: 'bank', id: bank.id });
                    setHoveredFlow({
                      title: `Inbound → ${bank.name}`,
                      amount: `+${money(bank.inTotal)}`,
                      color: '#10b981',
                    });
                  }}
                  onMouseLeave={() => {
                    setHoverTarget(null);
                    setHoveredFlow(null);
                  }}
                />
                {showAnimations && act && (
                  <path
                    d={midRibbonPath}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    strokeOpacity="0.85"
                    className="flowing-stream"
                    style={{ pointerEvents: 'none' }}
                  />
                )}
              </g>
            );
          })}

          {/* ── Stage 2 -> Stage 3: Bank to Supergroup Ribbons ─────── */}
          {bankToSgRibbons.map((r, idx) => {
            const act = isBankToSgRibbonActive(r.bank.id, r.sg.id);
            const pathD = ribbon(MID_X + NODE_W, r.srcT, r.srcB, HUB_X, r.dstT, r.dstB);
            const midRibbonPath = `M ${MID_X + NODE_W} ${(r.srcT + r.srcB) / 2} C ${MID_X + NODE_W + 130} ${(r.srcT + r.srcB) / 2}, ${HUB_X - 130} ${(r.dstT + r.dstB) / 2}, ${HUB_X} ${(r.dstT + r.dstB) / 2}`;

            return (
              <g key={`bs-ribbon-group-${idx}`}>
                <path
                  d={pathD}
                  fill={`url(#g-bs-${r.bank.id}-${r.sg.id})`}
                  opacity={act ? 0.55 : 0.05}
                  style={{ transition: 'opacity .18s', cursor: 'pointer' }}
                  onClick={() => togglePin({ kind: 'bank', id: r.bank.id })}
                  onMouseEnter={() => {
                    setHoverTarget({ kind: 'bank', id: r.bank.id });
                    setHoveredFlow({
                      title: `${r.bank.name} → ${r.sg.name}`,
                      amount: `-${money(r.amount)}`,
                      color: r.sg.color,
                    });
                  }}
                  onMouseLeave={() => {
                    setHoverTarget(null);
                    setHoveredFlow(null);
                  }}
                />
                {showAnimations && act && (
                  <path
                    d={midRibbonPath}
                    fill="none"
                    stroke={r.sg.color}
                    strokeWidth="2"
                    strokeOpacity="0.75"
                    className="flowing-stream"
                    style={{ pointerEvents: 'none' }}
                  />
                )}
              </g>
            );
          })}

          {/* ── Stage 3 -> Stage 4: Supergroup to Category Ribbons ──── */}
          {sgToCatRibbons.map((r, idx) => {
            const act = isSgToCatRibbonActive(r.sg.id, r.cat.id);
            const pathD = ribbon(HUB_X + NODE_W, r.srcT, r.srcB, CAT_X, r.dstT, r.dstB);
            const midRibbonPath = `M ${HUB_X + NODE_W} ${(r.srcT + r.srcB) / 2} C ${HUB_X + NODE_W + 130} ${(r.srcT + r.srcB) / 2}, ${CAT_X - 130} ${(r.dstT + r.dstB) / 2}, ${CAT_X} ${(r.dstT + r.dstB) / 2}`;

            return (
              <g key={`sc-ribbon-group-${idx}`}>
                <path
                  d={pathD}
                  fill={`url(#g-sc-${r.sg.id}-${r.cat.id})`}
                  opacity={act ? 0.55 : 0.05}
                  style={{ transition: 'opacity .18s', cursor: 'pointer' }}
                  onClick={() => togglePin({ kind: 'category', id: r.cat.id })}
                  onMouseEnter={() => {
                    setHoverTarget({ kind: 'category', id: r.cat.id });
                    setHoveredFlow({
                      title: `${r.sg.name} → ${r.cat.name}`,
                      amount: money(r.amount),
                      color: r.cat.color,
                    });
                  }}
                  onMouseLeave={() => {
                    setHoverTarget(null);
                    setHoveredFlow(null);
                  }}
                />
                {showAnimations && act && (
                  <path
                    d={midRibbonPath}
                    fill="none"
                    stroke={r.cat.color}
                    strokeWidth="2"
                    strokeOpacity="0.85"
                    className="flowing-stream"
                    style={{ pointerEvents: 'none' }}
                  />
                )}
              </g>
            );
          })}

          {/* ── Stage 2 Internal Bank-to-Bank Arcs ─────────────────── */}
          {aggregatedBankTransfers.map((it, idx) => {
            const fromNode = bankNodesWithY.find((b) => b.id === it.fromAccountId);
            const toNode = bankNodesWithY.find((b) => b.id === it.toAccountId);
            if (!fromNode || !toNode) return null;

            const fromY = fromNode.y + fromNode.height * 0.72;
            const toY = toNode.y + toNode.height * 0.28;
            const peakX = ARC_X + idx * 16;
            const midY = (fromY + toY) / 2;
            const sw = Math.max(2, Math.min(6, Math.round(flowH(it.totalAmount))));
            const act =
              !activeHighlight ||
              (activeHighlight.kind === 'bank' && (activeHighlight.id === fromNode.id || activeHighlight.id === toNode.id)) ||
              (activeHighlight.kind === 'interbank' && activeHighlight.fromId === fromNode.id && activeHighlight.toId === toNode.id);
            const arcPath = `M ${MID_X + NODE_W} ${fromY} C ${peakX} ${fromY},${peakX} ${toY},${MID_X + NODE_W} ${toY}`;
            const fromShort = fromNode.name.split(/[\s–-]/)[0];
            const toShort = toNode.name.split(/[\s–-]/)[0];
            const label = `${fromShort} → ${toShort}  ${money(it.totalAmount)}`;

            return (
              <g
                key={`arc-${idx}`}
                style={{ opacity: act ? 1 : 0.08, transition: 'opacity .18s', cursor: 'pointer' }}
                onClick={() => togglePin({ kind: 'interbank', fromId: fromNode.id, toId: toNode.id })}
                onMouseEnter={() => {
                  setHoverTarget({ kind: 'interbank', fromId: fromNode.id, toId: toNode.id });
                  setHoveredFlow({
                    title: `Inter-Bank Transfer: ${it.fromAccountName} → ${it.toAccountName}`,
                    amount: money(it.totalAmount),
                    color: fromNode.color,
                  });
                }}
                onMouseLeave={() => {
                  setHoverTarget(null);
                  setHoveredFlow(null);
                }}
              >
                <path d={arcPath} fill="none" stroke={fromNode.color} strokeWidth={sw} strokeOpacity={0.8} />
                <polygon
                  points={`${MID_X + NODE_W},${toY} ${MID_X + NODE_W - 6},${toY - 4} ${MID_X + NODE_W - 6},${toY + 4}`}
                  fill={fromNode.color}
                  opacity={0.9}
                />
                <g transform={`translate(${peakX + 4}, ${midY - 9})`}>
                  <rect
                    x="0"
                    y="0"
                    width={label.length * 6.2 + 10}
                    height="18"
                    rx="4"
                    fill="var(--card)"
                    stroke={fromNode.color}
                    strokeWidth="1"
                    style={{ filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.12))' }}
                  />
                  <rect
                    x="0"
                    y="0"
                    width={label.length * 6.2 + 10}
                    height="18"
                    rx="4"
                    fill={fromNode.color}
                    fillOpacity={0.08}
                  />
                  <text x="5" y="12.5" fill={fromNode.color} fontSize="9.5" fontWeight="700">
                    {label}
                  </text>
                </g>
              </g>
            );
          })}

          {/* ── Stage 1 Node: External Inbound ────────────────────── */}
          <g
            style={{ cursor: 'pointer' }}
            onClick={() => togglePin({ kind: 'inbound' })}
            onMouseEnter={() => {
              setHoverTarget({ kind: 'inbound' });
              setHoveredFlow({
                title: 'External Inbound (Total Income)',
                amount: `+${money(overall.totalExternalInbound)}`,
                color: '#10b981',
              });
            }}
            onMouseLeave={() => {
              setHoverTarget(null);
              setHoveredFlow(null);
            }}
          >
            <rect x={LEFT_X} y={inStartY} width={NODE_W} height={inboundH} fill="#10b981" rx="4" />
            <text x={LEFT_X - 12} y={inStartY + inboundH / 2 - 8} fill="var(--ink)" fontSize="13" fontWeight="700" textAnchor="end">
              External Inbound
            </text>
            <text x={LEFT_X - 12} y={inStartY + inboundH / 2 + 10} fill="#059669" fontSize="12" fontWeight="700" textAnchor="end">
              +{money(overall.totalExternalInbound)}
            </text>
          </g>

          {/* ── Stage 2 Nodes: Bank Funding Accounts ───────────────── */}
          {bankNodesWithY.map((bank) => {
            const act = isBankActive(bank.id);
            const midY = bank.y + bank.height / 2;
            const isPinned = pinnedTarget?.kind === 'bank' && pinnedTarget.id === bank.id;

            return (
              <g
                key={`node-${bank.id}`}
                style={{ opacity: act ? 1 : 0.22, transition: 'opacity .18s', cursor: 'pointer' }}
                onClick={() => togglePin({ kind: 'bank', id: bank.id })}
                onMouseEnter={() => {
                  setHoverTarget({ kind: 'bank', id: bank.id });
                  setHoveredFlow({
                    title: `${bank.name} (Flow Balance)`,
                    amount: `+${money(bank.inTotal)} in / -${money(bank.outTotal)} out`,
                    color: bank.color,
                  });
                }}
                onMouseLeave={() => {
                  setHoverTarget(null);
                  setHoveredFlow(null);
                }}
              >
                <rect
                  x={bank.x}
                  y={bank.y}
                  width={NODE_W}
                  height={bank.height}
                  fill={bank.color}
                  rx="4"
                  style={{
                    filter: (activeHighlight?.kind === 'bank' && activeHighlight.id === bank.id) || isPinned
                      ? `drop-shadow(0 0 10px ${bank.color})`
                      : 'none',
                  }}
                />
                <rect x={MID_X - 6} y={midY - 3} width={4} height={4} rx="2" fill={bank.color} />
                <text x={MID_X - 12} y={midY - 2} fill="var(--ink)" fontSize="12.5" fontWeight="700" textAnchor="end">
                  {bank.name} {isPinned ? '📌' : ''}
                </text>
                <text x={MID_X - 12} y={midY + 13} fontSize="10.5" textAnchor="end">
                  <tspan fill="#059669" fontWeight="700">+{money(bank.inTotal)}</tspan>
                  <tspan fill="var(--muted)"> / </tspan>
                  <tspan fill="#dc2626" fontWeight="700">-{money(bank.outTotal)}</tspan>
                </text>
              </g>
            );
          })}

          {/* ── Stage 3 Nodes: Supergroup Hubs ───────────────────── */}
          {supergroupNodesWithY.map((sgNode) => {
            const act = isSupergroupActive(sgNode.id);
            const midY = sgNode.y + sgNode.height / 2;
            const isPinned = pinnedTarget?.kind === 'supergroup' && pinnedTarget.id === sgNode.id;

            return (
              <g
                key={`sg-node-${sgNode.id}`}
                style={{ opacity: act ? 1 : 0.22, transition: 'opacity .18s', cursor: 'pointer' }}
                onClick={() => togglePin({ kind: 'supergroup', id: sgNode.id })}
                onMouseEnter={() => {
                  setHoverTarget({ kind: 'supergroup', id: sgNode.id });
                  setHoveredFlow({
                    title: `${sgNode.name} (Channel Total)`,
                    amount: money(sgNode.amount),
                    color: sgNode.color,
                  });
                }}
                onMouseLeave={() => {
                  setHoverTarget(null);
                  setHoveredFlow(null);
                }}
              >
                <rect x={sgNode.x} y={sgNode.y} width={NODE_W} height={sgNode.height} fill={sgNode.color} rx="4" />
                <g transform={`translate(${HUB_X + NODE_W + 10}, ${midY - 17})`}>
                  <rect
                    x="0"
                    y="0"
                    width={156}
                    height={34}
                    rx={6}
                    fill="var(--card)"
                    stroke={sgNode.color}
                    strokeWidth={isPinned ? '2' : '1.2'}
                    style={{
                      filter: (activeHighlight?.kind === 'supergroup' && activeHighlight.id === sgNode.id) || isPinned
                        ? `drop-shadow(0 0 10px ${sgNode.color})`
                        : 'drop-shadow(0 2px 8px rgba(0,0,0,0.07))',
                    }}
                  />
                  <rect x="0" y="0" width={156} height={34} rx={6} fill={sgNode.color} fillOpacity={0.09} />
                  <text x="10" y="14" fill="var(--ink)" fontSize="11.5" fontWeight="700">
                    {sgNode.name} {isPinned ? '📌' : ''}
                  </text>
                  <text x="10" y="27" fill={sgNode.color} fontSize="11" fontWeight="800">
                    {money(sgNode.amount)}
                  </text>
                </g>
              </g>
            );
          })}

          {/* ── Stage 4 Nodes: Consolidated Unified Categories ──── */}
          {categoryNodesWithY.map((catNode, idx) => {
            const act = isCategoryActive(catNode.id);
            const midY = catNode.y + catNode.height / 2;
            const pct = ((catNode.totalAmount / totalOutboundSum) * 100).toFixed(1);
            const isPinned = pinnedTarget?.kind === 'category' && pinnedTarget.id === catNode.id;

            return (
              <g
                key={`cat-node-${idx}-${catNode.name}`}
                style={{ opacity: act ? 1 : 0.22, transition: 'opacity .18s', cursor: 'pointer' }}
                onClick={() => togglePin({ kind: 'category', id: catNode.id })}
                onMouseEnter={() => {
                  const breakdown = catNode.sources.map((s) => `${s.superGroupName}: ${money(s.amount)}`).join(' • ');
                  setHoverTarget({ kind: 'category', id: catNode.id });
                  setHoveredFlow({
                    title: `${catNode.name}`,
                    amount: `${money(catNode.totalAmount)} (${pct}%)`,
                    color: catNode.color,
                    subtitle: breakdown,
                  });
                }}
                onMouseLeave={() => {
                  setHoverTarget(null);
                  setHoveredFlow(null);
                }}
              >
                <rect
                  x={catNode.x}
                  y={catNode.y}
                  width={NODE_W}
                  height={catNode.height}
                  fill={catNode.color}
                  rx="4"
                  style={{
                    filter: (activeHighlight?.kind === 'category' && activeHighlight.id === catNode.id) || isPinned
                      ? `drop-shadow(0 0 10px ${catNode.color})`
                      : 'none',
                  }}
                />
                <rect x={CAT_X + NODE_W + 8} y={midY - 5} width={6} height={6} rx="3" fill={catNode.color} />
                <text x={CAT_X + NODE_W + 18} y={midY - 1} fill="var(--ink)" fontSize="12" fontWeight="700">
                  {catNode.name} {isPinned ? '📌' : ''}
                </text>
                <text x={CAT_X + NODE_W + 18} y={midY + 13} fontSize="10.5" fontWeight="600">
                  <tspan fill="var(--ink)" fontWeight="600">{money(catNode.totalAmount)}</tspan>
                  <tspan fill="var(--muted)"> · {pct}%</tspan>
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
