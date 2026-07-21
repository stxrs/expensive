import React, { useEffect, useState } from 'react';
import pb from '../../api/pocketbase';
import { getUserId } from '../../api/pocketbase';

type Settings = {
  id: string;
  userId: string;
  currency: string;
  theme: 'light' | 'dark';
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [currency, setCurrency] = useState('INR');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const load = async () => {
    const list = await pb.collection('settings').getFullList({ filter: `userId="${getUserId()}"` });
    if (list.length) {
      const s = list[0] as unknown as Settings;
      setSettings(s);
      setCurrency(s.currency);
      setTheme(s.theme);
    } else {
      const s = await pb.collection('settings').create({
        userId: getUserId(),
        currency: 'INR',
        theme: 'light',
      });
      setSettings(s as unknown as Settings);
    }
  };
  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    await pb.collection('settings').update(settings.id, { currency, theme });
    document.documentElement.dataset.theme = theme;
    alert('Saved');
  };

  const downloadBackup = async () => {
    const tx = await pb.collection('transactions').export({ filter: `userId="${getUserId()}"` });
    const cat = await pb.collection('categories').export({ filter: `userId="${getUserId()}"` });
    const bud = await pb.collection('budgets').export({ filter: `userId="${getUserId()}"` });
    const json = JSON.stringify({ transactions: JSON.parse(tx), categories: JSON.parse(cat), budgets: JSON.parse(bud) }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expensive-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const restoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const data = JSON.parse(text);
    for (const rec of data.transactions) await pb.collection('transactions').create({ ...rec, userId: getUserId() });
    for (const rec of data.categories) await pb.collection('categories').create({ ...rec, userId: getUserId() });
    for (const rec of data.budgets) await pb.collection('budgets').create({ ...rec, userId: getUserId() });
    alert('Restore completed – reload page to see changes');
  };

  return (
    <section>
      <h2>Settings</h2>
      <form onSubmit={save}>
        <label>Currency:
          <input value={currency} onChange={e =>setCurrency(e.target.value)} placeholder="e.g. INR" />
        </label>
        <br />
        <label>Theme:
          <select value={theme} onChange={e =>setTheme(e.target.value as any)}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <br />
        <button type="submit">Save</button>
      </form>

      <hr />
      <h3>Backup / Restore</h3>
      <button onClick={downloadBackup}>Download my data (JSON)</button>
      <br /><br />
      <input type="file" accept=".json" onChange={restoreBackup} />
    </section>
  );
}
