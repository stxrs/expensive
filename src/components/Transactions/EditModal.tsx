import React, { useState } from 'react';
import pb from '../../api/pocketbase';
import { formatDate } from '../../utils/format';

type Transaction = {
  id: string;
  amount: number;
  type: string;
  category: string;
  date: string;
  notes?: string;
  receipt?: string;
};

type Props = {
  transaction: Transaction;
  onClose: () => void;
  onSaved: () => void;
};

export default function EditModal({ transaction, onClose, onSaved }: Props) {
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [category, setCategory] = useState(transaction.category);
  const [date, setDate] = useState(formatDate(transaction.date));
  const [notes, setNotes] = useState(transaction.notes ?? '');
  const [loading, setLoading] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await pb.collection('transactions').update(transaction.id, {
        amount: parseFloat(amount),
        category,
        date,
        notes,
      });
      onSaved();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-bg" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ background: '#fff', padding: '1rem', borderRadius: '5px' }}>
        <h3>Edit Transaction</h3>
        <form onSubmit={save}>
          <input type="number" placeholder="Amount" step="0.01" value={amount} onChange={e =>setAmount(e.target.value)} required />
          <input type="text" placeholder="Category" value={category} onChange={e =>setCategory(e.target.value)} required />
          <input type="date" value={date} onChange={e =>setDate(e.target.value)} required />
          <input type="text" placeholder="Notes" value={notes} onChange={e =>setNotes(e.target.value)} />
          <button type="submit" disabled={loading}>Save</button>{' '}
          <button type="button" onClick={onClose}>Cancel</button>
        </form>
      </div>
    </div>
  );
}
