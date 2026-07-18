import { AccountTransactions } from '@/components/account-transactions';

export default async function AccountPage({ params }: { params: Promise<{ accountId: string }> }) {
  const resolvedParams = await params;
  return <AccountTransactions accountId={resolvedParams.accountId} />;
}
