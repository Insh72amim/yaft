import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';

interface UseTransactionMutationsOptions {
  onMutated: () => void;
  setData?: any; // To allow optimistic updates if passed
}

export function useTransactionMutations({ onMutated, setData }: UseTransactionMutationsOptions) {
  const [editingTxCatId, setEditingTxCatId] = useState<string | null>(null);
  const [updatingCatId, setUpdatingCatId] = useState<string | null>(null);
  
  const [editingTxDescId, setEditingTxDescId] = useState<string | null>(null);
  const [editMerchantDraft, setEditMerchantDraft] = useState<string>('');
  const [savingTxDescId, setSavingTxDescId] = useState<string | null>(null);

  const [batchUpdating, setBatchUpdating] = useState(false);
  const [batchCatPickerOpen, setBatchCatPickerOpen] = useState(false);
  
  const [error, setError] = useState<string>('');

  const updateCategory = async (txId: string, accountId: string, categoryId: string) => {
    setUpdatingCatId(txId);
    try {
      const res = await api<any>(`/accounts/${accountId}/transactions/${txId}`, {
        method: 'PATCH',
        body: JSON.stringify({ categoryId: categoryId || null }),
      });
      if (setData) {
        setData((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            transactions: prev.transactions.map((tx: any) =>
              tx.id === txId
                ? {
                    ...tx,
                    categoryId: res.categoryId,
                    category: res.category,
                    categoryColor: res.categoryColor,
                  }
                : tx
            ),
          };
        });
      }
      onMutated();
    } catch (err) {
      setError(errorMessage(err, 'Could not update transaction category.'));
    } finally {
      setUpdatingCatId(null);
    }
  };

  const updateMerchant = async (txId: string, accountId: string, merchant: string) => {
    if (!merchant.trim()) return;
    
    if (setData) {
      setData((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          transactions: prev.transactions.map((tx: any) =>
            tx.id === txId ? { ...tx, description: merchant } : tx
          ),
        };
      });
    }

    setSavingTxDescId(txId);
    try {
      await api(`/transactions/${accountId}/${txId}`, {
        method: 'PATCH',
        body: JSON.stringify({ merchant }),
      });
      onMutated();
    } catch (err) {
      setError(errorMessage(err, 'Failed to update merchant name.'));
      onMutated(); // Revert by refetching
    } finally {
      setSavingTxDescId(null);
    }
  };

  const deleteTransaction = async (txId: string, accountId: string) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await api(`/accounts/${accountId}/transactions/${txId}`, { method: 'DELETE' });
      onMutated();
    } catch (reason) {
      alert(errorMessage(reason, 'Could not delete this transaction.'));
    }
  };

  const bulkUpdateCategory = async (txIds: string[], targetCatId: string) => {
    if (txIds.length === 0) return;
    setBatchUpdating(true);
    try {
      await api('/categories/batch-update', {
        method: 'POST',
        body: JSON.stringify({
          transactionIds: txIds,
          categoryId: targetCatId || null,
        }),
      }).catch(() =>
        api('/category-rules/batch-update', {
          method: 'POST',
          body: JSON.stringify({
            transactionIds: txIds,
            categoryId: targetCatId || null,
          }),
        })
      );
      onMutated();
    } catch (reason) {
      setError(errorMessage(reason, 'Could not bulk update categories.'));
    } finally {
      setBatchUpdating(false);
    }
  };

  return {
    editingTxCatId, setEditingTxCatId,
    updatingCatId,
    editingTxDescId, setEditingTxDescId,
    editMerchantDraft, setEditMerchantDraft,
    savingTxDescId,
    batchUpdating,
    batchCatPickerOpen, setBatchCatPickerOpen,
    error, setError,
    updateCategory,
    updateMerchant,
    deleteTransaction,
    bulkUpdateCategory
  };
}
