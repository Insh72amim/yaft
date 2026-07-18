'use client';
import { useEffect, useState } from 'react';
import { api, money } from '../../../lib/api';

type Holding = {
  id: string;
  asset: string;
  symbol: string;
  quantity: string;
  averagePrice: number;
  currentValue: number | null;
  asOfDate: string;
};

type PortfolioAccount = {
  accountId: string;
  name: string;
  holdings: Holding[];
};

export default function InvestmentsPage() {
  const [portfolio, setPortfolio] = useState<PortfolioAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<PortfolioAccount[]>('/investments/portfolio')
      .then(setPortfolio)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading portfolio...</div>;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Investments & Holdings</h1>
      
      {portfolio.length === 0 ? (
        <p>No investment accounts found.</p>
      ) : (
        portfolio.map(account => (
          <div key={account.accountId} className="mb-8 border rounded-lg p-6 shadow-sm">
            <h2 className="text-2xl font-semibold mb-4">{account.name}</h2>
            {account.holdings.length === 0 ? (
              <p className="text-gray-500">No holdings in this account.</p>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b">
                    <th className="py-2">Asset</th>
                    <th className="py-2">Symbol</th>
                    <th className="py-2 text-right">Quantity</th>
                    <th className="py-2 text-right">Avg Price</th>
                    <th className="py-2 text-right">Current Value</th>
                  </tr>
                </thead>
                <tbody>
                  {account.holdings.map(h => (
                    <tr key={h.id} className="border-b last:border-0">
                      <td className="py-3 font-medium">{h.asset}</td>
                      <td className="py-3 text-gray-500">{h.symbol}</td>
                      <td className="py-3 text-right">{h.quantity}</td>
                      <td className="py-3 text-right">{money(h.averagePrice)}</td>
                      <td className="py-3 text-right">{h.currentValue ? money(h.currentValue) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))
      )}
    </div>
  );
}
