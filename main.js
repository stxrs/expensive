// main.js – generic logic for the Vault expense‑tracker UI
// -----------------------------------------------------------
// Expected DOM elements (must exist in the HTML):
//   - #openTransactionModal (button that opens the dialog)
//   - #closeTransactionModal (button that closes the dialog)
//   - #transactionModal (the <dialog> element)
//   - #transactionForm (the <form> inside the dialog)
//   - #transactionList (the <ul> where recent transactions are rendered)
//   - #spendingChart (the <canvas> for Chart.js)

// -----------------------------------------------------------

// 1️⃣ Modal open / close handling
const openBtn   = document.getElementById('openTransactionModal');
const closeBtn  = document.getElementById('closeTransactionModal');
const modal     = document.getElementById('transactionModal');

if (openBtn && closeBtn && modal) {
  openBtn.addEventListener('click', () => modal.showModal());
  closeBtn.addEventListener('click', () => modal.close());

  // Close when clicking outside the dialog (nice UX)
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.close();
  });
}

// 2️⃣ Local‑storage helpers
const STORAGE_KEY = 'vaultTransactions';

function loadTransactions() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveTransactions(txs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(txs));
}

// 3️⃣ Rendering a single transaction <li>
function createListItem(tx) {
  const li = document.createElement('li');
  li.className = 'transaction-item';

  const iconMap = {
    groceries:   'ph-shopping-cart',
    rent:        'ph-home',
    education:   'ph-books',
    subscriptions: 'ph-credit-card',
    default:     'ph-receipt'
  };
  const icon = iconMap[tx.category] || iconMap.default;
  const amountSign = tx.type === 'income' ? '+' : '-';
  const amountClass = tx.type === 'income' ? 'positive' : 'negative';
  const amountText = `${amountSign}$${Number(tx.amount).toFixed(2)}`;

  li.innerHTML = `
    <div class="tx-icon ${tx.category}"><i class="ph ${icon}"></i></div>
    <div class="tx-details">
      <span class="tx-title">${tx.title || 'Untitled'}</span>
      <span class="tx-category">${capitalize(tx.category)}${tx.tags ? ' • <span class="tag">' + tx.tags + '</span>' : ''}</span>
    </div>
    <div class="tx-amount ${amountClass}">${amountText}</div>
  `;
  return li;
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// 4️⃣ Render all stored transactions into the list (newest on top)
function renderAllTransactions() {
  const list = document.getElementById('transactionList');
  if (!list) return;
  list.innerHTML = '';
  const txs = loadTransactions().slice().reverse();
  txs.forEach(tx => list.appendChild(createListItem(tx)));
}

// 5️⃣ Form submission – create a transaction object, persist, re‑render, update chart
const form = document.getElementById('transactionForm');
if (form) {
  form.addEventListener('submit', e => {
    e.preventDefault();

    const tx = {
      id: Date.now(),
      type: document.querySelector('input[name="txType"]:checked').value,
      amount: parseFloat(document.getElementById('txAmount').value),
      category: document.getElementById('txCategory').value,
      date: document.getElementById('txDate').value,
      title: document.getElementById('txDescription').value.trim(),
      tags: document.getElementById('txTags').value.trim()
    };

    // Basic validation
    if (isNaN(tx.amount) || tx.amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const all = loadTransactions();
    all.push(tx);
    saveTransactions(all);

    // Update UI instantly
    const list = document.getElementById('transactionList');
    if (list) list.prepend(createListItem(tx));
    updateChart();

    form.reset();
    modal.close();
  });
}

// 6️⃣ Chart.js – show monthly expense totals (expenses only)
let spendingChart = null;
function aggregateByMonth(txs) {
  const map = {};
  txs.forEach(t => {
    if (t.type !== 'expense') return;
    const month = t.date.slice(0,7); // YYYY‑MM
    const amt = Number(t.amount);
    map[month] = (map[month] || 0) + amt;
  });
  return map;
}

function updateChart() {
  const ctx = document.getElementById('spendingChart')?.getContext('2d');
  if (!ctx) return;

  const agg = aggregateByMonth(loadTransactions());
  const labels = Object.keys(agg).sort();
  const data = labels.map(m => agg[m]);

  const chartData = {
    labels,
    datasets: [{
      label: 'Monthly Expenses (₹)',
      data,
      borderColor: '#d4a373',
      backgroundColor: 'rgba(212,163,115,0.2)',
      fill: true,
      tension: 0.3
    }]
  };

  if (spendingChart) {
    spendingChart.data = chartData;
    spendingChart.update();
  } else {
    spendingChart = new Chart(ctx, {
      type: 'line',
      data: chartData,
      options: {
        responsive: true,
        plugins: { legend: { position: 'top' } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }
}

// 7️⃣ Initial load – render list and chart
document.addEventListener('DOMContentLoaded', () => {
  renderAllTransactions();
  updateChart();
});
