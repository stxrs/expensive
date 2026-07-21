import React, { useEffect, useState } from 'react';
import pb, { getUserId } from '../../api/pocketbase';
import { FaPalette, FaEdit, FaTrash } from 'react-icons/fa';

type Category = {
  id: string;
  userId: string;
  name: string;
  color: string;
  icon: string;
  type: 'expense' | 'income';
};

export default function ManageCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#007bff');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [editing, setEditing] = useState<Category | null>(null);

  const load = async () => {
    const recs = await pb.collection('categories').getFullList({
      filter: `userId="${getUserId()}"`,
      sort: 'type,-created',
    });
    setCategories(recs as unknown as Category[]);
  };
  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      await pb.collection('categories').update(editing.id, { name, color, type });
    } else {
      await pb.collection('categories').create({
        userId: getUserId(),
        name,
        color,
        type,
        icon: ''
      });
    }
    setName(''); setColor('#007bff'); setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    await pb.collection('categories').delete(id);
    load();
  };

  return (
    <section>
      <h2>Categories</h2>
      <form onSubmit={save} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input placeholder="Name" value={name} onChange={e =>setName(e.target.value)} required />
        <input type="color" value={color} onChange={e =>setColor(e.target.value)} />
        <select value={type} onChange={e =>setType(e.target.value as any)}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <button type="submit">{editing ? 'Update' : 'Add'}</button>
        {editing && <button type="button" onClick={() => {setEditing(null); setName('');}}>Cancel</button>}
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr><th>Name</th><th>Type</th><th>Color</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {categories.map(c => (
            <tr key={c.id}>
              <td><FaPalette style={{ color: c.color, marginRight: '0.4rem' }} />{c.name}</td>
              <td>{c.type}</td>
              <td>{c.color}</td>
              <td>
                <button onClick={() => {setEditing(c); setName(c.name); setColor(c.color); setType(c.type);}}><FaEdit /></button>{' '}
                <button onClick={() => remove(c.id)}><FaTrash /></button>
              </td>
            <tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
