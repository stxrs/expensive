import React, { useState } from 'react';
import pb, { getUserId } from '../../api/pocketbase';
import { formatDate } from '../../utils/format';

type Props = { onSaved: () => void };

export default function TransactionForm({ onSaved }: Props) {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(formatDate(new Date()));
  const [notes, setNotes] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data: any = {
        userId: getUserId(),
        amount: parseFloat(amount),
        type,
        category,
        date,
        notes,
      };
      if (receipt) {
        const fd = new FormData();
        fd.append('file', receipt);
        const file = await pb.collection('transactions').upload(fd);
        data.receipt = file.id;
      }
      await pb.collection('transactions').create(data);
      // clear fields
      setAmount(''); setCategory(''); setNotes(''); setReceipt(null);
      onSaved();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
    >
      <select value={type} onChange={e => setType(e.target.value as any)} required>
        <option value="expense">Expense</option>
        <option value="income">Income</option>
      </select>
      <input type="text" placeholder="Category" value={category} onChange={e => setCategory(e.target.value)} required />
      <input type="number" placeholder="Amount" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
      <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
      <input type="file" accept="image/*" onChange={e => setReceipt(e.target.files?.[0] ?? null)} />
      <input type="text" placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
      <button type="submit" disabled={loading}>Add</button>
    </form>
  );
}
