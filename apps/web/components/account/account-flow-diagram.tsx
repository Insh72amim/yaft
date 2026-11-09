'use client';

import { useState } from 'react';
import { CalendarDays, Workflow } from 'lucide-react';
import { money } from '@/lib/api';

export interface AccountFlowDiagramAccount {
  id: string;
  name: string;
  institution: string | null;
  balance: number;
}

export interface AccountFlowDiagramTransaction {
  id: string;
  transactionDate: string;
  description: string;
  amount: number;
  category: string;
}

export function AccountFlowDiagram({
  account,
  transactions,
}: {
  account: AccountFlowDiagramAccount;
  transactions: AccountFlowDiagramTransaction[];
}) {
  const availableMonths = Array.from(
    new Set(
      transactions
        .map((t) => (t.transactionDate ? t.transactionDate.slice(0, 7) : ''))
        .filter((m) => Boolean(m) && /^\d{4}-\d{2}$/.test(m))
    )
  ).sort().reverse();

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const initialMonth = availableMonths.includes(currentMonthKey)
    ? currentMonthKey
    : (availableMonths[0] || currentMonthKey);

  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth);
  const [flowMode, setFlowMode] = useState<'TRANSACTIONS' | 'CATEGORIES'>('TRANSACTIONS');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const formatMonthLabel = (monthKey: string) => {
    if (!monthKey) return '';
    const [year, month] = monthKey.split('-');
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const filteredTxns = transactions.filter((t) => t.transactionDate && t.transactionDate.startsWith(selectedMonth));

  const inboundTxns = filteredTxns.filter((t) => t.amount > 0);
  const outboundTxns = filteredTxns.filter((t) => t.amount < 0);

  const totalInboundMinor = inboundTxns.reduce((sum, t) => sum + t.amount, 0);
  const totalOutboundMinor = outboundTxns.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  let inboundNodes: { id: string; label: string; category: string; amountMinor: number; count: number; pct: number }[] = [];
  if (flowMode === 'TRANSACTIONS') {
    const sortedInbound = [...inboundTxns].sort((a, b) => b.amount - a.amount);
    const top7Inbound = sortedInbound.slice(0, 7);
    const restInbound = sortedInbound.slice(7);
    const restInboundSum = restInbound.reduce((sum, t) => sum + t.amount, 0);

    inboundNodes = top7Inbound.map((t, idx) => ({
      id: `in-${t.id || idx}`,
      label: t.description,
      category: t.category,
      amountMinor: t.amount,
      count: 1,
      pct: totalInboundMinor > 0 ? Math.round((t.amount / totalInboundMinor) * 100) : 0,
    }));

    if (restInbound.length > 0) {
      inboundNodes.push({
        id: 'in-other',
        label: `Other Inbound (${restInbound.length} txns)`,
        category: 'Multiple',
        amountMinor: restInboundSum,
        count: restInbound.length,
        pct: totalInboundMinor > 0 ? Math.round((restInboundSum / totalInboundMinor) * 100) : 0,
      });
    }
  } else {
    const catMap: Record<string, { label: string; amountMinor: number; count: number }> = {};
    inboundTxns.forEach((t) => {
      const cat = t.category || 'Uncategorized';
      if (!catMap[cat]) catMap[cat] = { label: cat, amountMinor: 0, count: 0 };
      catMap[cat].amountMinor += t.amount;
      catMap[cat].count += 1;
    });

    const sortedCats = Object.values(catMap).sort((a, b) => b.amountMinor - a.amountMinor);
    const top7Cats = sortedCats.slice(0, 7);
    const restCats = sortedCats.slice(7);
    const restCatsSum = restCats.reduce((sum, c) => sum + c.amountMinor, 0);
    const restCatsCount = restCats.reduce((sum, c) => sum + c.count, 0);

    inboundNodes = top7Cats.map((c, idx) => ({
      id: `incat-${idx}`,
      label: c.label,
      category: c.label,
      amountMinor: c.amountMinor,
      count: c.count,
      pct: totalInboundMinor > 0 ? Math.round((c.amountMinor / totalInboundMinor) * 100) : 0,
    }));

    if (restCats.length > 0) {
      inboundNodes.push({
        id: 'incat-other',
        label: `Other Categories (${restCats.length} categories)`,
        category: 'Multiple',
        amountMinor: restCatsSum,
        count: restCatsCount,
        pct: totalInboundMinor > 0 ? Math.round((restCatsSum / totalInboundMinor) * 100) : 0,
      });
    }
  }

  let outboundNodes: { id: string; label: string; category: string; amountMinor: number; count: number; pct: number }[] = [];
  if (flowMode === 'TRANSACTIONS') {
    const sortedOutbound = [...outboundTxns].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    const top7Outbound = sortedOutbound.slice(0, 7);
    const restOutbound = sortedOutbound.slice(7);
    const restOutboundSum = restOutbound.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    outboundNodes = top7Outbound.map((t, idx) => ({
      id: `out-${t.id || idx}`,
      label: t.description,
      category: t.category,
      amountMinor: Math.abs(t.amount),
      count: 1,
      pct: totalOutboundMinor > 0 ? Math.round((Math.abs(t.amount) / totalOutboundMinor) * 100) : 0,
    }));

    if (restOutbound.length > 0) {
      outboundNodes.push({
        id: 'out-other',
        label: `Other Outbound (${restOutbound.length} txns)`,
        category: 'Multiple',
        amountMinor: restOutboundSum,
        count: restOutbound.length,
        pct: totalOutboundMinor > 0 ? Math.round((restOutboundSum / totalOutboundMinor) * 100) : 0,
      });
    }
  } else {
    const catMap: Record<string, { label: string; amountMinor: number; count: number }> = {};
    outboundTxns.forEach((t) => {
      const cat = t.category || 'Uncategorized';
      if (!catMap[cat]) catMap[cat] = { label: cat, amountMinor: 0, count: 0 };
      catMap[cat].amountMinor += Math.abs(t.amount);
      catMap[cat].count += 1;
    });

    const sortedCats = Object.values(catMap).sort((a, b) => b.amountMinor - a.amountMinor);
    const top7Cats = sortedCats.slice(0, 7);
    const restCats = sortedCats.slice(7);
    const restCatsSum = restCats.reduce((sum, c) => sum + c.amountMinor, 0);
    const restCatsCount = restCats.reduce((sum, c) => sum + c.count, 0);

    outboundNodes = top7Cats.map((c, idx) => ({
      id: `outcat-${idx}`,
      label: c.label,
      category: c.label,
      amountMinor: c.amountMinor,
      count: c.count,
      pct: totalOutboundMinor > 0 ? Math.round((c.amountMinor / totalOutboundMinor) * 100) : 0,
    }));

    if (restCats.length > 0) {
      outboundNodes.push({
        id: 'outcat-other',
        label: `Other Categories (${restCats.length} categories)`,
        category: 'Multiple',
        amountMinor: restCatsSum,
        count: restCatsCount,
        pct: totalOutboundMinor > 0 ? Math.round((restCatsSum / totalOutboundMinor) * 100) : 0,
      });
    }
  }

  const maxRows = Math.max(inboundNodes.length, outboundNodes.length, 1);
  const nodeHeight = 52;
  const gap = 14;
  const svgHeight = Math.max(460, maxRows * (nodeHeight + gap) + 80);
  const centerY = svgHeight / 2;

  const inboundTotalHeight = inboundNodes.length * nodeHeight + (inboundNodes.length - 1) * gap;
  const inboundStartY = (svgHeight - inboundTotalHeight) / 2;

  const outboundTotalHeight = outboundNodes.length * nodeHeight + (outboundNodes.length - 1) * gap;
  const outboundStartY = (svgHeight - outboundTotalHeight) / 2;

  return (
    <section className="panel" style={{ padding: '24px', overflow: 'hidden' }}>
      <div className="panel-title" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
        <div>
          <span className="eyebrow" style={{ color: 'var(--green)' }}>Visual Ledger Diagram</span>
          <h2>Account Transaction Flow</h2>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <CalendarDays size={15} color="var(--muted)" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                background: 'var(--card)',
                color: 'var(--ink)',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {(availableMonths.length > 0 ? availableMonths : [currentMonthKey]).map((mKey) => (
                <option key={mKey} value={mKey}>
                  {formatMonthLabel(mKey)}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '4px', background: 'var(--paper)', padding: '3px', borderRadius: '10px', border: '1px solid var(--line)' }}>
            <button
              type="button"
              className={`secondary compact ${flowMode === 'TRANSACTIONS' ? 'active' : ''}`}
              onClick={() => setFlowMode('TRANSACTIONS')}
              style={{ height: '28px', fontSize: '11px', padding: '0 10px' }}
            >
              Top Transactions
            </button>
            <button
              type="button"
              className={`secondary compact ${flowMode === 'CATEGORIES' ? 'active' : ''}`}
              onClick={() => setFlowMode('CATEGORIES')}
              style={{ height: '28px', fontSize: '11px', padding: '0 10px' }}
            >
              By Categories
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', fontSize: '12px', marginBottom: '16px', background: 'var(--paper)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--line)', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--green)', fontWeight: 700 }}>
          Inbound Total: +{money(totalInboundMinor)} ({inboundTxns.length} entries)
        </span>
        <span style={{ color: 'var(--orange)', fontWeight: 700 }}>
          Outbound Total: -{money(totalOutboundMinor)} ({outboundTxns.length} entries)
        </span>
        <span style={{ color: 'var(--muted)', marginLeft: 'auto' }}>
          Mode: <strong>{flowMode === 'TRANSACTIONS' ? 'Individual Transactions' : 'Category Groups'}</strong> • Period: <strong>{formatMonthLabel(selectedMonth)}</strong>
        </span>
      </div>

      {filteredTxns.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
          <Workflow size={36} style={{ margin: '0 auto 12px auto', display: 'block', color: 'var(--green)' }} />
          <h3>No Flow Data For Selected Filter</h3>
          <p style={{ fontSize: '12px', marginTop: '4px' }}>
            No transaction records found for {formatMonthLabel(selectedMonth)}. Try selecting a different month or &apos;All Time&apos;.
          </p>
        </div>
      ) : (
        <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
          <svg viewBox={`0 0 1000 ${svgHeight}`} style={{ width: '100%', minWidth: '850px', height: 'auto', display: 'block' }}>
            <defs>
              <linearGradient id="inflowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--green)" stopOpacity="0.85" />
                <stop offset="100%" stopColor="var(--green)" stopOpacity="0.25" />
              </linearGradient>
              <linearGradient id="outflowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--orange)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--orange)" stopOpacity="0.85" />
              </linearGradient>
            </defs>

            {inboundNodes.map((node, idx) => {
              const nodeCenterY = inboundStartY + idx * (nodeHeight + gap) + nodeHeight / 2;
              const strokeWidth = Math.max(2, Math.min(16, (node.amountMinor / (totalInboundMinor || 1)) * 24));
              const isHovered = hoveredNodeId === node.id;
              return (
                <path
                  key={`path-${node.id}`}
                  d={`M 230 ${nodeCenterY} C 320 ${nodeCenterY}, 320 ${centerY}, 410 ${centerY}`}
                  fill="none"
                  stroke="url(#inflowGrad)"
                  strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
                  opacity={hoveredNodeId ? (isHovered ? 1 : 0.2) : 0.75}
                  style={{ transition: 'all 0.25s ease' }}
                />
              );
            })}

            {outboundNodes.map((node, idx) => {
              const nodeCenterY = outboundStartY + idx * (nodeHeight + gap) + nodeHeight / 2;
              const strokeWidth = Math.max(2, Math.min(16, (node.amountMinor / (totalOutboundMinor || 1)) * 24));
              const isHovered = hoveredNodeId === node.id;
              return (
                <path
                  key={`path-${node.id}`}
                  d={`M 590 ${centerY} C 680 ${centerY}, 680 ${nodeCenterY}, 770 ${nodeCenterY}`}
                  fill="none"
                  stroke="url(#outflowGrad)"
                  strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
                  opacity={hoveredNodeId ? (isHovered ? 1 : 0.2) : 0.75}
                  style={{ transition: 'all 0.25s ease' }}
                />
              );
            })}

            {inboundNodes.map((node, idx) => {
              const y = inboundStartY + idx * (nodeHeight + gap);
              const isHovered = hoveredNodeId === node.id;
              return (
                <g
                  key={node.id}
                  transform={`translate(10, ${y})`}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    width="220"
                    height={nodeHeight}
                    rx="10"
                    fill="var(--card)"
                    stroke={isHovered ? 'var(--green)' : 'var(--line)'}
                    strokeWidth={isHovered ? '2' : '1'}
                    filter={isHovered ? 'drop-shadow(0 6px 16px rgba(16,185,129,0.15))' : undefined}
                  />
                  <text x="14" y="21" fill="var(--ink)" fontSize="11" fontWeight="700">
                    {node.label.length > 24 ? `${node.label.slice(0, 24)}...` : node.label}
                  </text>
                  <text x="14" y="38" fill="var(--green)" fontSize="12" fontWeight="700">
                    +{money(node.amountMinor)}
                  </text>
                  <text x="206" y="38" textAnchor="end" fill="var(--muted)" fontSize="10">
                    {node.pct}%
                  </text>
                </g>
              );
            })}

            <g transform={`translate(410, ${centerY - 55})`}>
              <rect
                width="180"
                height="110"
                rx="16"
                fill="var(--card)"
                stroke="var(--green)"
                strokeWidth="2"
                filter="drop-shadow(0 10px 30px var(--theme-shadow-color))"
              />
              <text x="90" y="26" textAnchor="middle" fill="var(--muted)" fontSize="9" fontWeight="700" letterSpacing="0.8">
                {(account.institution || 'BANK ACCOUNT').toUpperCase()}
              </text>
              <text x="90" y="46" textAnchor="middle" fill="var(--ink)" fontSize="14" fontWeight="800">
                {account.name.length > 18 ? `${account.name.slice(0, 18)}...` : account.name}
              </text>
              <text x="90" y="72" textAnchor="middle" fill="var(--ink)" fontSize="15" fontWeight="800">
                {money(account.balance)}
              </text>
              <text x="90" y="92" textAnchor="middle" fill="var(--muted)" fontSize="10">
                Current Balance
              </text>
            </g>

            {outboundNodes.map((node, idx) => {
              const y = outboundStartY + idx * (nodeHeight + gap);
              const isHovered = hoveredNodeId === node.id;
              return (
                <g
                  key={node.id}
                  transform={`translate(770, ${y})`}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    width="220"
                    height={nodeHeight}
                    rx="10"
                    fill="var(--card)"
                    stroke={isHovered ? 'var(--orange)' : 'var(--line)'}
                    strokeWidth={isHovered ? '2' : '1'}
                    filter={isHovered ? 'drop-shadow(0 6px 16px rgba(239,68,68,0.15))' : undefined}
                  />
                  <text x="14" y="21" fill="var(--ink)" fontSize="11" fontWeight="700">
                    {node.label.length > 24 ? `${node.label.slice(0, 24)}...` : node.label}
                  </text>
                  <text x="14" y="38" fill="var(--orange)" fontSize="12" fontWeight="700">
                    -{money(node.amountMinor)}
                  </text>
                  <text x="206" y="38" textAnchor="end" fill="var(--muted)" fontSize="10">
                    {node.pct}%
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </section>
  );
}
