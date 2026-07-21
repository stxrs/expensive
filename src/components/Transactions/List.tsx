import React, { useEffect, useState } from 'react';
import pb, { getUserId } from '../../api/pocketbase';
import TransactionForm from './Form';
import EditModal from './EditModal';
import { formatCurrency, formatDate } from '../../utils/format';

type Transaction = {
  id: string;
  userId: string;
  amount: number;
  type: string; // expense|income
  category: string;
  description?: string;
  date: string;
  paymentMethod?: string;
  notes?: string;
  tags?: string[];
  receipt?: string;
  created: string;
  updated: string;
};

export default function TransactionList() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const load = async () => {
    setLoading(true);
    const records = await pb.collection('transactions').getFullList({
      filter: `userId="${getUserId()}"`,
      sort: '-date',
    });
    setTransactions(records as unknown as Transaction[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const unsub = pb.collection('transactions').subscribe('*', load);
    return () => unsub();
  }, []);

  const remove = async (id: string) => {
    if (!confirm('Delete this transaction?')) return;
    await pb.collection('transactions').delete(id);
    load();
  };

  return (
    <section>
      <h2>Transactions</h2>
      <TransactionForm onSaved={load} />
      {loading ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr><th>Date</th><th>Type</th><th>Category</th><th>Amount</th><th>Notes</th><th></th></tr>
          </thead>
          <tbody>
            {transactions.map(t => (
              <tr key={t.id}>
                <td>{formatDate(t.date)}</td>
                <td>{t.type}</td>
                <td>{t.category}</td>
                <td>{formatCurrency(t.amount)}</td>
                <td>{t.notes?.slice(0,30) ?? ''}</td>
                <td>
                  <button onClick={() => setEditing(t)}>Edit</button>{' '}
                  <button onClick={() => remove(t.id)}>Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && <EditModal transaction={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </section>
  );
}
