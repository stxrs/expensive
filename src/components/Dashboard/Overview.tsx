import React, { useEffect, useState } from 'react';
import pb, { getUserId } from '../../api/pocketbase';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { formatCurrency } from '../../utils/format';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type Transaction = {
  amount: number;
  type: string;
  category: string;
  date: string;
};

export default function Overview() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const recs = await pb.collection('transactions').getFullList({
      filter: `userId="${getUserId()}"`,
      sort: '-date',
    });
    setTransactions(recs as unknown as Transaction[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTx = transactions.filter(t => new Date(t.date) >= monthStart);
  const expenses = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const balance = income - expenses;

  const expenseByCat = monthTx.filter(t => t.type === 'expense')
    .reduce((obj, t) => {
      obj[t.category] = (obj[t.category] || 0) + t.amount;
      return obj;
    }, {} as Record<string, number>);

  const pieData = {
    labels: Object.keys(expenseByCat),
    datasets: [{
      data: Object.values(expenseByCat),
      backgroundColor: Object.keys(expenseByCat).map(() => `hsl(${Math.random()*360},70%,70%)`),
    }],
  };

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return d.toLocaleString('default', { month: 'short', year: 'numeric' });
  }).reverse();

  const spendPerMonth = months.map(m => {
    const [monthStr, yearStr] = m.split(' ');
    const monthIdx = new Date(`${monthStr} 1, ${yearStr}`).getMonth();
    const year = parseInt(yearStr);
    const start = new Date(year, monthIdx, 1);
    const end = new Date(year, monthIdx + 1, 1);
    const sum = transactions.filter(t => {
      const dt = new Date(t.date);
      return dt >= start && dt < end && t.type === 'expense';
    }).reduce((s, t) => s + t.amount, 0);
    return sum;
  });

  const barData = {
    labels: months,
    datasets: [{ label: 'Expenses', data: spendPerMonth, backgroundColor: '#ff6b6b' }],
  };

  return (
    <section>
      <h2>Dashboard</h2>
      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}
            <div>
              <h3>Balance (this month)</h3>
              <p>{formatCurrency(balance)}</p>
            </div>
            <div>
              <h3>Total Income</h3>
              <p>{formatCurrency(income)}</p>
            </div>
            <div>
              <h3>Total Expenses</h3>
              <p>{formatCurrency(expenses)}</p>
            </div>
          </div>

          <h3>Expense by Category</h3>
          <div style={{ maxWidth: '500px' }}>
            <Doughnut data={pieData} />
          </div>

          <h3>Monthly Spending Trend (last 6 months)</h3>
          <div style={{ maxWidth: '600px' }}>
            <Bar data={barData} />
          </div>
        </>
      )}
    </section>
  );
}
