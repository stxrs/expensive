/*===================================================================
  Expensive – vanilla JS expense tracker
  ---------------------------------------------------
  This file implements a tiny client‑side router, a PocketBase API
  wrapper, and all UI rendering for the required features.
  All HTML is generated dynamically; the static index.html only
  provides containers.
===================================================================*/

// ---------- Configuration ----------
// Change this if you host PocketBase elsewhere (ngrok, VPS, etc.)
const PB_URL = 'http://127.0.0.1:8090'; // <-- edit as needed

// ---------- Helpers ----------
const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('theme', theme);
}
function toggleTheme() {
  const newTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
}

function setAuth(token, userId) {
  localStorage.setItem('pb_token', token);
  localStorage.setItem('pb_user', userId);
}
function clearAuth() {
  localStorage.removeItem('pb_token');
  localStorage.removeItem('pb_user');
}
function getToken() { return localStorage.getItem('pb_token'); }
function getUserId() { return localStorage.getItem('pb_user'); }

function api(path, options = {}) {
  const headers = options.headers || {};
  if (getToken()) {
    headers['Authorization'] = getToken();
  }
  return fetch(`${PB_URL}${path}`, { ...options, headers })
    .then(res => {
      if (!res.ok) return res.json().then(err => Promise.reject(err));
      return res.json();
    });
}

// ---------- Auth UI ----------
function renderLogin() {
  $('#app').innerHTML = `
    <section id="login-view">
      <h2>Login</h2>
      <form id="login-form">
        <input type="email" id="login-email" placeholder="Email" required />
        <input type="password" id="login-pass" placeholder="Password" required />
        <button type="submit">Login</button>
      </form>
      <p>No account? <a href="#register">Register</a> • <a href="#reset">Forgot password?</a></p>
      <p id="login-error" class="error"></p>
    </section>`;
  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#login-email').value.trim();
    const password = $('#login-pass').value;
    try {
      const data = await api('/api/collections/users/auth-with-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      setAuth(data.token, data.record.id);
      navigate('#dashboard');
    } catch (err) {
      $('#login-error').textContent = err.message || 'Login failed';
    }
  });
}

function renderRegister() {
  $('#app').innerHTML = `
    <section id="register-view">
      <h2>Register</h2>
      <form id="register-form">
        <input type="email" id="reg-email" placeholder="Email" required />
        <input type="password" id="reg-pass" placeholder="Password" required />
        <input type="password" id="reg-pass2" placeholder="Confirm password" required />
        <button type="submit">Register</button>
      </form>
      <p>Already have an account? <a href="#login">Login</a></p>
      <p id="reg-error" class="error"></p>
    </section>`;
  $('#register-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#reg-email').value.trim();
    const pass = $('#reg-pass').value;
    const pass2 = $('#reg-pass2').value;
    if (pass !== pass2) return $('#reg-error').textContent = 'Passwords do not match';
    try {
      const data = await api('/api/collections/users/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass, passwordConfirm: pass2 })
      });
      // Auto‑login
      const auth = await api('/api/collections/users/auth-with-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });
      setAuth(auth.token, auth.record.id);
      navigate('#dashboard');
    } catch (err) {
      $('#reg-error').textContent = err.message || 'Registration failed';
    }
  });
}

function renderReset() {
  $('#app').innerHTML = `
    <section id="reset-view">
      <h2>Reset Password</h2>
      <form id="reset-form">
        <input type="email" id="reset-email" placeholder="Your e‑mail" required />
        <button type="submit">Send reset link</button>
      </form>
      <p><a href="#login">Back to login</a></p>
      <p id="reset-msg" class="msg"></p>
    </section>`;
  $('#reset-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#reset-email').value.trim();
    try {
      await api('/api/collections/users/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      $('#reset-msg').textContent = 'Password reset e‑mail sent. Check your inbox.';
    } catch (err) {
      $('#reset-msg').textContent = err.message || 'Error';
    }
  });
}

// ---------- Navigation ----------
function navigate(hash) {
  location.hash = hash;
}
function router() {
  const route = location.hash.replace('#', '') || 'login';
  const nav = $('#nav');
  const logoutBtn = $('#logoutBtn');
  const isAuth = !!getToken();
  // toggle UI based on auth status
  if (isAuth) {
    $('#nav').classList.remove('hidden');
    $('#logoutBtn').classList.remove('hidden');
    $('#theme-toggle').classList.remove('hidden');
  } else {
    $('#nav').classList.add('hidden');
    $('#logoutBtn').classList.add('hidden');
    $('#theme-toggle').classList.remove('hidden');
  }

  // mark active link
  $$('.nav-link').forEach(l => l.classList.toggle('active', l.getAttribute('href') === `#${route}`));

  switch (route) {
    case 'login': renderLogin(); break;
    case 'register': renderRegister(); break;
    case 'reset': renderReset(); break;
    case 'dashboard': isAuth ? renderDashboard() : navigate('login'); break;
    case 'transactions': isAuth ? renderTransactions() : navigate('login'); break;
    case 'categories': isAuth ? renderCategories() : navigate('login'); break;
    case 'budgets': isAuth ? renderBudgets() : navigate('login'); break;
    case 'settings': isAuth ? renderSettings() : navigate('login'); break;
    default: renderDashboard();
  }
}
window.addEventListener('hashchange', router);
window.addEventListener('load', () => {
  // apply stored theme
  const saved = localStorage.getItem('theme') || 'light';
  setTheme(saved);
  $('#theme-toggle').addEventListener('click', toggleTheme);
  $('#logoutBtn').addEventListener('click', () => { clearAuth(); navigate('login'); });
  router();
});

// ---------- UI Components ----------
function formatCurrency(num) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(num);
}
function formatDate(dateStr) {
  return new Date(dateStr).toISOString().substring(0, 10);
}

// ----- Dashboard -----
async function renderDashboard() {
  $('#app').innerHTML = `
    <section id="dashboard-view">
      <h2>Dashboard</h2>
      <div id="summary" class="cards"></div>
      <canvas id="categoryChart" width="400" height="200"></canvas>
      <canvas id="trendChart" width="600" height="300"></canvas>
    </section>`;
  try {
    const records = await api(`/api/collections/transactions/records?filter=userId='${getUserId()}'&sort=-date`);
    const tx = records.items || [];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthTx = tx.filter(t => new Date(t.date) >= monthStart);
    const expenses = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const balance = income - expenses;
    // summary cards
    $('#summary').innerHTML = `
      <div class="card"><h3>Balance</h3><p>${formatCurrency(balance)}</p></div>
      <div class="card"><h3>Income (this month)</h3><p>${formatCurrency(income)}</p></div>
      <div class="card"><h3>Expenses (this month)</h3><p>${formatCurrency(expenses)}</p></div>
    `;
    // ----- Category pie chart -----
    const expenseByCat = {};
    monthTx.filter(t => t.type === 'expense').forEach(t => {
      expenseByCat[t.category] = (expenseByCat[t.category] || 0) + Number(t.amount);
    });
    const pieCtx = document.getElementById('categoryChart').getContext('2d');
    new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(expenseByCat),
        datasets: [{ data: Object.values(expenseByCat), backgroundColor: Object.keys(expenseByCat).map(() => `hsl(${Math.random()*360},70%,70%)`) }]
      }
    });
    // ----- Trend bar chart (last 6 months) -----
    const months = [];
    const amounts = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('default', { month: 'short', year: 'numeric' });
      months.push(label);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const sum = tx.filter(t => {
        const dt = new Date(t.date);
        return dt >= start && dt < end && t.type === 'expense';
      }).reduce((s, t) => s + Number(t.amount), 0);
      amounts.push(sum);
    }
    const barCtx = document.getElementById('trendChart').getContext('2d');
    new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [{ label: 'Expenses', data: amounts, backgroundColor: '#ff6b6b' }]
      }
    });
  } catch (err) {
    $('#app').innerHTML = `<p class="error">Failed to load dashboard: ${err.message}</p>`;
  }
}

// ----- Transactions -----
async function renderTransactions() {
  $('#app').innerHTML = `
    <section id="tx-view">
      <h2>Transactions</h2>
      <form id="tx-form">
        <select id="tx-type" required>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <input type="date" id="tx-date" required />
        <input type="text" id="tx-category" placeholder="Category" required />
        <input type="number" id="tx-amount" placeholder="Amount" step="0.01" required />
        <input type="text" id="tx-notes" placeholder="Notes (optional)" />
        <button type="submit">Add</button>
      </form>
      <div class="table-wrapper"><table id="tx-table"><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Amount</th><th>Notes</th><th>Actions</th></tr></thead><tbody></tbody></table></div>
    </section>`;
  const loadTx = async () => {
    const resp = await api(`/api/collections/transactions/records?filter=userId='${getUserId()}'&sort=-date`);
    const rows = resp.items || [];
    const tbody = $('#tx-table tbody');
    tbody.innerHTML = '';
    rows.forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatDate(t.date)}</td>
        <td>${t.type}</td>
        <td>${t.category}</td>
        <td>${formatCurrency(t.amount)}</td>
        <td>${t.notes ?? ''}</td>
        <td>
          <button class="edit-btn" data-id="${t.id}">Edit</button>
          <button class="del-btn" data-id="${t.id}">Del</button>
        </td>`;
      tbody.appendChild(tr);
    });
    // attach edit/delete handlers
    $$('.edit-btn').forEach(btn => btn.addEventListener('click', () => editTransaction(btn.dataset.id)));
    $$('.del-btn').forEach(btn => btn.addEventListener('click', () => deleteTransaction(btn.dataset.id)));
  };
  // ---- create ----
  $('#tx-form').addEventListener('submit', async e => {
    e.preventDefault();
    const data = {
      userId: getUserId(),
      type: $('#tx-type').value,
      date: $('#tx-date').value,
      category: $('#tx-category').value.trim(),
      amount: Number($('#tx-amount').value),
      notes: $('#tx-notes').value.trim()
    };
    try {
      await api('/api/collections/transactions/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      $('#tx-form').reset();
      loadTx();
    } catch (err) {
      alert('Add failed: ' + (err.message || err));
    }
  });
  // ---- edit ----
  async function editTransaction(id) {
    const rec = await api(`/api/collections/transactions/records/${id}`);
    const newAmount = prompt('New amount', rec.amount);
    if (newAmount === null) return;
    const updated = { amount: Number(newAmount) };
    try {
      await api(`/api/collections/transactions/records/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      loadTx();
    } catch (err) { alert('Update failed'); }
  }
  // ---- delete ----
  async function deleteTransaction(id) {
    if (!confirm('Delete this transaction?')) return;
    try {
      await api(`/api/collections/transactions/records/${id}`, { method: 'DELETE' });
      loadTx();
    } catch (err) { alert('Delete failed'); }
  }
  // initial load
  loadTx();
}

// ----- Categories -----
async function renderCategories() {
  $('#app').innerHTML = `
    <section id="cat-view">
      <h2>Categories</h2>
      <form id="cat-form">
        <input type="text" id="cat-name" placeholder="Name" required />
        <input type="color" id="cat-color" value="#007bff" />
        <select id="cat-type" required>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <button type="submit">Add</button>
      </form>
      <div class="table-wrapper"><table id="cat-table"><thead><tr><th>Name</th><th>Type</th><th>Color</th><th>Actions</th></tr></thead><tbody></tbody></table></div>
    </section>`;
  const loadCats = async () => {
    const resp = await api(`/api/collections/categories/records?filter=userId='${getUserId()}'&sort=type,-created`);
    const tbody = $('#cat-table tbody');
    tbody.innerHTML = '';
    (resp.items || []).forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span style="color:${c.color};">&#9632;</span> ${c.name}</td>
        <td>${c.type}</td>
        <td>${c.color}</td>
        <td><button class="del-cat" data-id="${c.id}">Del</button></td>`;
      tbody.appendChild(tr);
    });
    $$('.del-cat').forEach(btn => btn.addEventListener('click', () => deleteCategory(btn.dataset.id)));
  };
  // create
  $('#cat-form').addEventListener('submit', async e => {
    e.preventDefault();
    const data = {
      userId: getUserId(),
      name: $('#cat-name').value.trim(),
      color: $('#cat-color').value,
      type: $('#cat-type').value
    };
    try {
      await api('/api/collections/categories/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      $('#cat-form').reset();
      loadCats();
    } catch (err) { alert('Add category failed'); }
  });
  async function deleteCategory(id) {
    if (!confirm('Delete this category?')) return;
    try {
      await api(`/api/collections/categories/records/${id}`, { method: 'DELETE' });
      loadCats();
    } catch (err) { alert('Delete failed'); }
  }
  loadCats();
}

// ----- Budgets -----
async function renderBudgets() {
  $('#app').innerHTML = `
    <section id="budget-view">
      <h2>Budgets</h2>
      <form id="budget-form">
        <input type="text" id="budget-cat" placeholder="Category" required />
        <input type="number" id="budget-limit" placeholder="Limit (₹)" step="0.01" required />
        <button type="submit">Add</button>
      </form>
      <div class="table-wrapper"><table id="budget-table"><thead><tr><th>Category</th><th>Limit</th><th>Remaining</th><th>Actions</th></tr></thead><tbody></tbody></table></div>
    </section>`;
  const loadBudgets = async () => {
    const resp = await api(`/api/collections/budgets/records?filter=userId='${getUserId()}'`);
    const tbody = $('#budget-table tbody');
    tbody.innerHTML = '';
    (resp.items || []).forEach(b => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${b.category}</td>
        <td>${formatCurrency(b.limit)}</td>
        <td class="remaining">${formatCurrency(b.limit)}</td>
        <td><button class="del-budget" data-id="${b.id}">Del</button></td>`;
      tbody.appendChild(tr);
    });
    $$('.del-budget').forEach(btn => btn.addEventListener('click', () => deleteBudget(btn.dataset.id)));
    // TODO: calculate actual spent per budget (demo shows full limit)
  };
  $('#budget-form').addEventListener('submit', async e => {
    e.preventDefault();
    const data = {
      userId: getUserId(),
      category: $('#budget-cat').value.trim(),
      limit: Number($('#budget-limit').value),
      period: 'monthly'
    };
    try {
      await api('/api/collections/budgets/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      $('#budget-form').reset();
      loadBudgets();
    } catch (err) { alert('Add budget failed'); }
  });
  async function deleteBudget(id) {
    if (!confirm('Delete this budget?')) return;
    try { await api(`/api/collections/budgets/records/${id}`, { method: 'DELETE' }); loadBudgets(); }
    catch (err) { alert('Delete failed'); }
  }
  loadBudgets();
}

// ----- Settings (theme, currency, backup/restore) -----
async function renderSettings() {
  $('#app').innerHTML = `
    <section id="settings-view">
      <h2>Settings</h2>
      <form id="settings-form">
        <label>Currency: <input type="text" id="currency" value="INR" /></label><br />
        <label>Theme: <select id="theme-select"><option value="light">Light</option><option value="dark">Dark</option></select></label><br />
        <button type="submit">Save</button>
      </form>
      <hr />
      <h3>Backup / Restore</h3>
      <button id="backupBtn">Download my data (JSON)</button><br/><br/>
      <input type="file" id="restoreInput" accept=".json" />
    </section>`;
  // load existing settings if any
  try {
    const list = await api(`/api/collections/settings/records?filter=userId='${getUserId()}'`);
    const s = list.items[0];
    if (s) {
      $('#currency').value = s.currency;
      $('#theme-select').value = s.theme;
    }
  } catch (e) { /* ignore */ }
  // save
  $('#settings-form').addEventListener('submit', async e => {
    e.preventDefault();
    const payload = { currency: $('#currency').value.trim(), theme: $('#theme-select').value };
    // upsert – try update first
    try {
      const existing = await api(`/api/collections/settings/records?filter=userId='${getUserId()}'`);
      if (existing.items.length) {
        await api(`/api/collections/settings/records/${existing.items[0].id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        await api('/api/collections/settings/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, userId: getUserId() })
        });
      }
      setTheme(payload.theme);
      alert('Settings saved');
    } catch (err) { alert('Save failed'); }
  });
  // backup
  $('#backupBtn').addEventListener('click', async () => {
    try {
      const tx = await api(`/api/collections/transactions/records?filter=userId='${getUserId()}'`);
      const cat = await api(`/api/collections/categories/records?filter=userId='${getUserId()}'`);
      const bud = await api(`/api/collections/budgets/records?filter=userId='${getUserId()}'`);
      const data = { transactions: tx.items, categories: cat.items, budgets: bud.items };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'expensive-backup.json'; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { alert('Backup failed'); }
  });
  // restore
  $('#restoreInput').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const data = JSON.parse(text);
    try {
      for (const rec of data.transactions) await api('/api/collections/transactions/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...rec, userId: getUserId() }) });
      for (const rec of data.categories) await api('/api/collections/categories/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...rec, userId: getUserId() }) });
      for (const rec of data.budgets) await api('/api/collections/budgets/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...rec, userId: getUserId() }) });
      alert('Restore complete – reload to see changes');
    } catch (err) { alert('Restore failed'); }
  });
}

