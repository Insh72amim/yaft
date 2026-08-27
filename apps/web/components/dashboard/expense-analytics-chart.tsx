'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CalendarDays,
  TrendingUp,
  BarChart3,
  Layers,
  Sparkles,
  ChevronRight,
  Info,
  Calendar,
  Clock,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { api, money } from '@/lib/api';
import type {
  ExpenseAnalyticsResponse,
  ExpenseGranularity,
  ExpenseAnalyticsBucket,
  ExpenseCategoryContribution,
} from '@yaft/shared';

interface ExpenseAnalyticsChartProps {
  startDate?: string;
  endDate?: string;
  onRefreshNeeded?: () => void;
}

export function ExpenseAnalyticsChart({
  startDate,
  endDate,
}: ExpenseAnalyticsChartProps) {
  const [granularity, setGranularity] = useState<ExpenseGranularity>('month');
  const [data, setData] = useState<ExpenseAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeBucket, setActiveBucket] = useState<ExpenseAnalyticsBucket | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('granularity', granularity);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await api<ExpenseAnalyticsResponse>(`/dashboard/expense-analytics?${params.toString()}`);
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load expense analytics');
    } finally {
      setLoading(false);
    }
  }, [granularity, startDate, endDate]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Determine max bucket amount for proportional scaling
  const maxBucketAmount = useMemo(() => {
    if (!data || !data.buckets.length) return 1;
    const max = Math.max(...data.buckets.map((b) => b.totalAmount), 0);
    return max > 0 ? max : 1;
  }, [data]);

  // Nice rounded top ceiling for Y axis
  const yAxisCeiling = useMemo(() => {
    if (maxBucketAmount <= 1000) return 1000;
    const magnitude = Math.pow(10, Math.floor(Math.log10(maxBucketAmount)));
    return Math.ceil(maxBucketAmount / magnitude) * magnitude;
  }, [maxBucketAmount]);

  const yTicks = useMemo(() => {
    return [
      yAxisCeiling,
      Math.round((yAxisCeiling * 3) / 4),
      Math.round((yAxisCeiling * 2) / 4),
      Math.round(yAxisCeiling / 4),
      0,
    ];
  }, [yAxisCeiling]);

  const granularityLabel = useMemo(() => {
    switch (granularity) {
      case 'month':
        return 'Month-to-Month';
      case 'week':
        return 'Week-by-Week';
      case 'day':
        return 'Day-by-Day';
    }
  }, [granularity]);

  const intervalAverageUnit = useMemo(() => {
    switch (granularity) {
      case 'month':
        return 'month';
      case 'week':
        return 'week';
      case 'day':
        return 'day';
    }
  }, [granularity]);

  return (
    <section className="panel" style={{ marginBottom: '24px', overflow: 'hidden' }}>
      {/* Header with Title & Granularity Switcher */}
      <div
        className="panel-title"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          borderBottom: '1px solid var(--line)',
          paddingBottom: '16px',
          marginBottom: '18px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="eyebrow">Expenditure Analysis</span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--green)',
                background: 'var(--mint)',
                padding: '2px 8px',
                borderRadius: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Layers size={12} />
              Stacked Subcategories
            </span>
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '2px 0 0' }}>
            Expenses by Category & Trend
          </h2>
        </div>

        {/* Granularity Pill Switcher */}
        <div
          style={{
            display: 'inline-flex',
            background: 'var(--background-alt)',
            padding: '3px',
            borderRadius: '10px',
            border: '1px solid var(--line)',
          }}
        >
          {(['month', 'week', 'day'] as const).map((g) => {
            const active = granularity === g;
            const label = g === 'month' ? 'Month-to-Month' : g === 'week' ? 'Week-by-Week' : 'Day-by-Day';
            return (
              <button
                key={g}
                type="button"
                onClick={() => {
                  setGranularity(g);
                  setActiveBucket(null);
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: active ? 700 : 500,
                  background: active ? 'var(--card)' : 'transparent',
                  color: active ? 'var(--ink)' : 'var(--muted)',
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {g === 'month' ? <CalendarDays size={13} /> : g === 'week' ? <Calendar size={13} /> : <Clock size={13} />}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--muted)' }}>
          <div className="loading" style={{ margin: '0 auto 12px' }}>
            <span />
          </div>
          <p style={{ fontSize: '13px' }}>Analyzing {granularityLabel.toLowerCase()} expenses…</p>
        </div>
      ) : error ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--red)', fontSize: '13px' }}>
          {error}
        </div>
      ) : !data || data.buckets.length === 0 || data.summary.totalExpense === 0 ? (
        <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--muted)' }}>
          <BarChart3 size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <h4 style={{ margin: '0 0 6px', color: 'var(--ink)', fontSize: '14px' }}>No Expense Data in this Period</h4>
          <p style={{ margin: 0, fontSize: '12px' }}>
            Import statements or select a date range with recorded debit transactions.
          </p>
        </div>
      ) : (
        <>
          {/* KPI Summary Strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              marginBottom: '22px',
            }}
          >
            <div
              style={{
                background: 'var(--background-alt)',
                borderRadius: '12px',
                padding: '14px 16px',
                border: '1px solid var(--line)',
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total {granularityLabel} Spend
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--ink)', marginTop: '4px' }}>
                {money(data.summary.totalExpense)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                Across {data.summary.totalTransactionsCount} transactions
              </div>
            </div>

            <div
              style={{
                background: 'var(--background-alt)',
                borderRadius: '12px',
                padding: '14px 16px',
                border: '1px solid var(--line)',
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Average / {intervalAverageUnit}
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--green)', marginTop: '4px' }}>
                {money(data.summary.averagePerInterval)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                Over {data.summary.intervalCount} {intervalAverageUnit}s
              </div>
            </div>

            <div
              style={{
                background: 'var(--background-alt)',
                borderRadius: '12px',
                padding: '14px 16px',
                border: '1px solid var(--line)',
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Peak Spending {intervalAverageUnit}
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444', marginTop: '4px' }}>
                {data.summary.peakInterval ? money(data.summary.peakInterval.amount) : '₹0'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {data.summary.peakInterval ? data.summary.peakInterval.label : 'None'}
              </div>
            </div>

            <div
              style={{
                background: 'var(--background-alt)',
                borderRadius: '12px',
                padding: '14px 16px',
                border: '1px solid var(--line)',
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Top Subcategory
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                {data.summary.topCategory && (
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: data.summary.topCategory.color,
                      flexShrink: 0,
                    }}
                  />
                )}
                <div
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    color: 'var(--ink)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {data.summary.topCategory ? data.summary.topCategory.name : 'N/A'}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                {data.summary.topCategory
                  ? `${money(data.summary.topCategory.amount)} (${data.summary.topCategory.percentage}% of total)`
                  : 'No expenses'}
              </div>
            </div>
          </div>

          {/* Interactive Stacked Bar Chart */}
          <div
            style={{
              position: 'relative',
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: '14px',
              padding: '24px 20px 16px',
              marginBottom: '20px',
            }}
          >
            {/* Chart Grid & Bars Container */}
            <div style={{ display: 'flex', height: '280px', gap: '16px' }}>
              {/* Y-Axis Ticks */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  width: '60px',
                  paddingBottom: '26px',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'var(--muted)',
                  userSelect: 'none',
                  flexShrink: 0,
                }}
              >
                {yTicks.map((val, idx) => (
                  <span key={idx}>{val === 0 ? '₹0' : money(val, true)}</span>
                ))}
              </div>

              {/* Chart Plot Area with Grid Lines */}
              <div
                style={{
                  flex: 1,
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Horizontal Grid lines */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: '26px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    pointerEvents: 'none',
                  }}
                >
                  {yTicks.map((_, idx) => (
                    <div
                      key={idx}
                      style={{
                        width: '100%',
                        borderBottom: '1px dashed var(--line)',
                        opacity: 0.7,
                      }}
                    />
                  ))}
                </div>

                {/* Bars Area */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: data.buckets.length > 20 ? '4px' : data.buckets.length > 10 ? '8px' : '16px',
                    paddingBottom: '26px',
                    position: 'relative',
                    zIndex: 1,
                    overflowX: 'auto',
                    scrollbarWidth: 'thin',
                  }}
                >
                  {data.buckets.map((bucket) => {
                    const isSelected = activeBucket?.intervalKey === bucket.intervalKey;
                    const heightPercent = yAxisCeiling > 0 ? Math.min(100, Math.max(0, (bucket.totalAmount / yAxisCeiling) * 100)) : 0;

                    return (
                      <div
                        key={bucket.intervalKey}
                        onClick={() => setActiveBucket((prev) => (prev?.intervalKey === bucket.intervalKey ? null : bucket))}
                        onMouseEnter={() => setActiveBucket(bucket)}
                        style={{
                          flex: 1,
                          minWidth: data.buckets.length > 20 ? '18px' : '32px',
                          maxWidth: data.buckets.length > 20 ? '36px' : '64px',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                      >
                        {/* The Stacked Bar Pillar */}
                        <div
                          style={{
                            width: '100%',
                            height: `${heightPercent}%`,
                            minHeight: bucket.totalAmount > 0 ? '4px' : '0px',
                            borderRadius: '5px 5px 0 0',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column-reverse', // bottom up stacking
                            background: bucket.totalAmount > 0 ? 'transparent' : 'var(--background-alt)',
                            border: isSelected ? '2px solid var(--ink)' : '1px solid rgba(0,0,0,0.05)',
                            transform: isSelected ? 'scaleY(1.02)' : 'none',
                            transition: 'all 0.15s ease',
                            boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                          }}
                        >
                          {bucket.categories.map((cat, segIdx) => {
                            const segHeight = bucket.totalAmount > 0 ? (cat.amount / bucket.totalAmount) * 100 : 0;
                            const isCategoryDimmed = hoveredCategory && hoveredCategory !== cat.id;

                            return (
                              <div
                                key={cat.id}
                                title={`${cat.name}: ${money(cat.amount)} (${cat.percentage}%)`}
                                style={{
                                  width: '100%',
                                  height: `${segHeight}%`,
                                  background: cat.color,
                                  opacity: isCategoryDimmed ? 0.25 : isSelected ? 1.0 : 0.88,
                                  transition: 'opacity 0.2s ease',
                                  borderBottom: segIdx > 0 ? '1px solid rgba(255,255,255,0.15)' : 'none',
                                }}
                              />
                            );
                          })}
                        </div>

                        {/* X-Axis Label */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            fontSize: data.buckets.length > 20 ? '9px' : '11px',
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? 'var(--ink)' : 'var(--muted)',
                            whiteSpace: 'nowrap',
                            textAlign: 'center',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '100%',
                            lineHeight: 1.2,
                          }}
                        >
                          {granularity === 'day'
                            ? bucket.label.split(' ')[0]
                            : granularity === 'week'
                            ? bucket.label.split(' ')[0]
                            : bucket.label.split(' ')[0]}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Selected / Hovered Interval Breakdown Card */}
            {activeBucket && activeBucket.totalAmount > 0 && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '14px 16px',
                  background: 'var(--background-alt)',
                  borderRadius: '12px',
                  border: '1px solid var(--line)',
                  animation: 'fadeIn 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--ink)',
                      }}
                    >
                      {activeBucket.label}
                    </span>
                    {activeBucket.subLabel && activeBucket.subLabel !== activeBucket.label && (
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        ({activeBucket.subLabel})
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink)' }}>
                    Total: {money(activeBucket.totalAmount)}
                  </div>
                </div>

                {/* Subcategories Grid in this bucket */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: '8px',
                  }}
                >
                  {activeBucket.categories.map((cat) => (
                    <div
                      key={cat.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: 'var(--card)',
                        borderRadius: '8px',
                        border: '1px solid var(--line)',
                        fontSize: '11px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: cat.color,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cat.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <strong style={{ color: 'var(--ink)' }}>{money(cat.amount)}</strong>
                        <span style={{ color: 'var(--muted)', fontSize: '10px' }}>({cat.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Global Subcategories Legend with Hover Isolation */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>
                Subcategories in this Period ({data.categoryLegend.length})
              </span>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                Hover a category to highlight across bars
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              {data.categoryLegend.map((cat) => {
                const isHovered = hoveredCategory === cat.id;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onMouseEnter={() => setHoveredCategory(cat.id)}
                    onMouseLeave={() => setHoveredCategory(null)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      border: isHovered ? `1.5px solid ${cat.color}` : '1px solid var(--line)',
                      background: isHovered ? 'var(--card-hover)' : 'var(--card)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isHovered ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                    }}
                  >
                    <span
                      style={{
                        width: '9px',
                        height: '9px',
                        borderRadius: '50%',
                        background: cat.color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>
                      {cat.name}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ink)' }}>
                      {money(cat.totalAmount)}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
                      ({cat.percentage}%)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
