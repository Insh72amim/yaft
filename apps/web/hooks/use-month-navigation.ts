'use client';

import { useState, useCallback, useMemo } from 'react';
import { formatMonthYear } from '@yaft/shared';

export interface UseMonthNavigationOptions {
  initialMonth?: number;
  initialYear?: number;
  onChange?: (month: number, year: number) => void;
}

export function useMonthNavigation(options: UseMonthNavigationOptions = {}) {
  const now = useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = useState<number>(
    options.initialMonth ?? now.getMonth() + 1,
  );
  const [selectedYear, setSelectedYear] = useState<number>(
    options.initialYear ?? now.getFullYear(),
  );

  const isCurrentMonth = useMemo(
    () => selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear(),
    [selectedMonth, selectedYear, now],
  );

  const monthLabel = useMemo(
    () => formatMonthYear(selectedMonth, selectedYear),
    [selectedMonth, selectedYear],
  );

  const setMonthYear = useCallback(
    (month: number, year: number) => {
      setSelectedMonth(month);
      setSelectedYear(year);
      options.onChange?.(month, year);
    },
    [options],
  );

  const prevMonth = useCallback(() => {
    if (selectedMonth === 1) {
      setMonthYear(12, selectedYear - 1);
    } else {
      setMonthYear(selectedMonth - 1, selectedYear);
    }
  }, [selectedMonth, selectedYear, setMonthYear]);

  const nextMonth = useCallback(() => {
    if (selectedMonth === 12) {
      setMonthYear(1, selectedYear + 1);
    } else {
      setMonthYear(selectedMonth + 1, selectedYear);
    }
  }, [selectedMonth, selectedYear, setMonthYear]);

  const resetToCurrent = useCallback(() => {
    setMonthYear(now.getMonth() + 1, now.getFullYear());
  }, [now, setMonthYear]);

  return {
    selectedMonth,
    selectedYear,
    monthLabel,
    isCurrentMonth,
    setMonthYear,
    prevMonth,
    nextMonth,
    resetToCurrent,
  };
}
