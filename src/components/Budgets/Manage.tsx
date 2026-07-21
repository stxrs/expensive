import React, { useEffect, useState } from 'react';
import pb, { getUserId } from '../../api/pocketbase';
import { FaEdit, FaTrash } from 'react-icons/fa';

type Budget = {
  id: string;
  userId: string;
  category: string;
  limit: number;
  period: string;
};

export default function ManageBudgets() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [category, setCategory] = useState('');
  const [limit, setLimit] = useState('');
  const [editing, setEditing] = useState<Budget | null>(null);

  const load = async () => {
    const recs = await pb.collection('budgets').getFullList({
      filter: `userId="${getUserId()}"`,
      sort: '-created',
    });
    setBudgets(recs as unknown as Budget[]);
  };
  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      await pb.collection('budgets').update(editing.id, { category, limit: parseFloat(limit) });
    } else {
      await pb.collection('budgets').create({
        userId: getUserId(),
        category,
        limit: parseFloat(limit),
        period: 'monthly',
      });
    }
    setCategory(''); setLimit(''); setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete budget?')) return;
    await pb.collection('budgets').delete(id);
    load();
  };

  return (
    <section>
      <h2>Budgets</h2>
      <form onSubmit={save} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input placeholder="Category" value={category} onChange={e =>setCategory(e.target.value)} required />
        <input type="number" placeholder="Limit (₹)" step="0.01" value={limit} onChange={e =>setLimit(e.target.value)} required />
        <button type="submit">{editing ? 'Update' : 'Add'}</button>
        {editing && <button type="button" onClick={() => {setEditing(null); setCategory(''); setLimit('');}}>Cancel</button>}
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr><th>Category</th><th>Limit</th><th>Spent (demo)</th><th>Remaining</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {budgets.map(b => {
            const remaining = b.limit; // demo – calculate real spent later
            return (
              <tr key={b.id}>
                <td>{b.category}</td>
                <td>{b.limit}</td>
                <td>0</td>
                <td style={{color: remaining<0?'red':'green'}}>{remaining}</td>
                <td>
                  <button onClick={() => {setEditing(b); setCategory(b.category); setLimit(b.limit.toString());}}><FaEdit /></button>{' '}
                  <button onClick={() => remove(b.id)}><FaTrash /></button>
                </td>
              <tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
