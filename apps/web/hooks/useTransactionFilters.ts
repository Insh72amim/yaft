import { useState, useMemo, useCallback } from 'react';

export function useTransactionFilters() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<"ALL" | "EXPENSE" | "INCOME">('ALL');
  const [categoryId, setCategoryId] = useState('all');
  const [accountId, setAccountId] = useState('all');
  const [tagId, setTagId] = useState('all');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const hasActiveFilters = Boolean(
    search ||
    typeFilter !== 'ALL' ||
    categoryId !== 'all' ||
    accountId !== 'all' ||
    tagId !== 'all' ||
    minAmount ||
    maxAmount ||
    startDate ||
    endDate
  );

  const clearFilters = useCallback(() => {
    setSearch('');
    setTypeFilter('ALL');
    setCategoryId('all');
    setAccountId('all');
    setTagId('all');
    setMinAmount('');
    setMaxAmount('');
    setStartDate('');
    setEndDate('');
  }, []);

  const filterTransactions = useCallback((transactions: any[]) => {
    return transactions.filter((tx: any) => {
      if (search && !(tx.description?.toLowerCase().includes(search.toLowerCase()) || tx.merchant?.toLowerCase().includes(search.toLowerCase()))) return false;
      if (categoryId !== 'all' && tx.categoryId !== categoryId) return false;
      if (accountId !== 'all' && tx.accountId !== accountId) return false;
      if (typeFilter === 'EXPENSE' && tx.amount >= 0) return false;
      if (typeFilter === 'INCOME' && tx.amount <= 0) return false;
      if (minAmount && Math.abs(tx.amount) < Number(minAmount) * 100) return false;
      if (maxAmount && Math.abs(tx.amount) > Number(maxAmount) * 100) return false;
      if (startDate && new Date(tx.transactionDate) < new Date(startDate)) return false;
      if (endDate && new Date(tx.transactionDate) > new Date(endDate)) return false;
      if (tagId !== 'all' && (!tx.tags || !tx.tags.some((t: any) => t.id === tagId))) return false;
      return true;
    });
  }, [search, typeFilter, categoryId, accountId, tagId, minAmount, maxAmount, startDate, endDate]);

  return {
    search, setSearch,
    typeFilter, setTypeFilter,
    categoryId, setCategoryId,
    accountId, setAccountId,
    tagId, setTagId,
    minAmount, setMinAmount,
    maxAmount, setMaxAmount,
    startDate, setStartDate,
    endDate, setEndDate,
    hasActiveFilters,
    clearFilters,
    filterTransactions
  };
}
