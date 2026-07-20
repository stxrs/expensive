class VaultApp {
    constructor() {
        this.transactions = [];
        this.currentUser = null;
        this.chartInstance = null;

        // Elements
        this.authView = document.getElementById('auth-view');
        this.appView = document.getElementById('app-view');
        this.modal = document.getElementById('transactionModal');
        this.form = document.getElementById('transactionForm');
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuth();
    }

    bindEvents() {
        // Auth
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());

        // Navigation
        document.querySelectorAll('.nav-item').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = e.currentTarget.getAttribute('data-target');
                this.switchView(target, e.currentTarget);
            });
        });
        
        document.getElementById('viewAllLink').addEventListener('click', (e) => {
            e.preventDefault();
            const navLink = document.querySelector('[data-target="view-transactions"]');
            this.switchView('view-transactions', navLink);
        });

        // Modal
        document.getElementById('openTransactionModal').addEventListener('click', () => {
            document.getElementById('txDate').valueAsDate = new Date();
            this.modal.showModal();
        });
        
        document.getElementById('closeTransactionModal').addEventListener('click', () => this.modal.close());
        
        this.modal.addEventListener('click', (e) => {
            const dims = this.modal.getBoundingClientRect();
            if (e.clientX < dims.left || e.clientX > dims.right || e.clientY < dims.top || e.clientY > dims.bottom) {
                this.modal.close();
            }
        });

        // Form Submit
        this.form.addEventListener('submit', (e) => this.addTransaction(e));

        // Export
        document.getElementById('exportBtn').addEventListener('click', () => this.exportCSV());
    }

    checkAuth() {
        const savedUser = localStorage.getItem('vault_user');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.authView.classList.add('hidden');
            this.appView.classList.remove('hidden');
            
            document.getElementById('userName').textContent = this.currentUser.email.split('@')[0];
            document.getElementById('userAvatar').textContent = this.currentUser.email.charAt(0).toUpperCase();
            
            this.loadData();
        } else {
            this.authView.classList.remove('hidden');
            this.appView.classList.add('hidden');
        }
    }

    handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const user = { email: email, token: 'local-auth-token-' + Date.now() };
        localStorage.setItem('vault_user', JSON.stringify(user));
        this.checkAuth();
    }

    handleLogout() {
        localStorage.removeItem('vault_user');
        window.location.reload();
    }

    switchView(viewId, activeLink) {
        // Update Links
        document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
        if(activeLink) activeLink.classList.add('active');

        // Update Views
        document.querySelectorAll('.page-view').forEach(v => v.classList.add('hidden'));
        document.getElementById(viewId).classList.remove('hidden');

        // Update Header
        const titleMap = {
            'view-dashboard': { title: 'Dashboard', sub: 'Your financial overview.' },
            'view-transactions': { title: 'Transactions', sub: 'A complete history of your records.' }
        };
        document.getElementById('pageTitle').textContent = titleMap[viewId].title;
        document.getElementById('pageSubtitle').textContent = titleMap[viewId].sub;
    }

    loadData() {
        const data = localStorage.getItem('vault_transactions_' + this.currentUser.email);
        this.transactions = data ? JSON.parse(data) : [];
        this.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        this.updateUI();
    }

    saveData() {
        localStorage.setItem('vault_transactions_' + this.currentUser.email, JSON.stringify(this.transactions));
        this.updateUI();
    }

    addTransaction(e) {
        e.preventDefault();
        const newTx = {
            id: Date.now().toString(),
            type: document.querySelector('input[name="txType"]:checked').value,
            amount: parseFloat(document.getElementById('txAmount').value),
            category: document.getElementById('txCategory').value,
            date: document.getElementById('txDate').value,
            description: document.getElementById('txDescription').value
        };

        this.transactions.unshift(newTx); // Add to beginning
        this.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        this.saveData();
        
        this.form.reset();
        this.modal.close();
    }

    deleteTransaction(id) {
        this.transactions = this.transactions.filter(tx => tx.id !== id);
        this.saveData();
    }

    updateUI() {
        this.renderLists();
        this.renderStats();
        this.renderChart();
    }

    getIconForCategory(category) {
        const icons = {
            'Groceries': 'ph-shopping-cart',
            'Rent': 'ph-house',
            'Education': 'ph-book-open',
            'Entertainment': 'ph-music-notes',
            'Salary': 'ph-money',
            'Other': 'ph-dots-three'
        };
        return icons[category] || 'ph-receipt';
    }

    createTransactionHTML(tx) {
        const isExpense = tx.type === 'expense';
        const amountClass = isExpense ? 'expense' : 'income';
        const amountPrefix = isExpense ? '-' : '+';
        const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(tx.amount);
        const icon = this.getIconForCategory(tx.category);

        return `
            <li class="transaction-item">
                <div class="tx-icon"><i class="ph ${icon}"></i></div>
                <div class="tx-details">
                    <span class="tx-title">${tx.description}</span>
                    <span class="tx-category">${tx.category} • ${tx.date}</span>
                </div>
                <div class="tx-amount ${amountClass}">${amountPrefix}${formattedAmount}</div>
                <button class="btn-delete" onclick="app.deleteTransaction('${tx.id}')"><i class="ph ph-trash"></i></button>
            </li>
        `;
    }

    renderLists() {
        const recentList = document.getElementById('recentList');
        const fullList = document.getElementById('fullTransactionList');
        
        if (this.transactions.length === 0) {
            const emptyHTML = '<li class="empty-state">No records found. Click "New Record" to start.</li>';
            recentList.innerHTML = emptyHTML;
            fullList.innerHTML = emptyHTML;
            return;
        }

        recentList.innerHTML = this.transactions.slice(0, 5).map(tx => this.createTransactionHTML(tx)).join('');
        fullList.innerHTML = this.transactions.map(tx => this.createTransactionHTML(tx)).join('');
    }

    renderStats() {
        let income = 0;
        let expense = 0;

        this.transactions.forEach(tx => {
            if (tx.type === 'income') income += tx.amount;
            if (tx.type === 'expense') expense += tx.amount;
        });

        const balance = income - expense;
        
        const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
        
        document.getElementById('statIncome').textContent = formatter.format(income);
        document.getElementById('statExpense').textContent = formatter.format(expense);
        document.getElementById('statBalance').textContent = formatter.format(balance);
        
        const statusEl = document.getElementById('balanceStatus');
        if (balance > 0) {
            statusEl.textContent = 'Positive Balance';
            statusEl.style.color = 'var(--success)';
        } else if (balance < 0) {
            statusEl.textContent = 'Negative Balance';
            statusEl.style.color = 'var(--danger)';
        } else {
            statusEl.textContent = 'Neutral Balance';
            statusEl.style.color = 'var(--text-muted)';
        }
    }

    renderChart() {
        const ctx = document.getElementById('spendingChart').getContext('2d');
        
        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        // Group expenses by date (Last 7 days logic simplified for functionality)
        // For accurate tracking, we'll plot chronological expenses
        const expenses = this.transactions.filter(t => t.type === 'expense').reverse();
        const labels = expenses.map(t => t.date.slice(5)); // Show MM-DD
        const dataPoints = expenses.map(t => t.amount);

        if(dataPoints.length === 0) {
             labels.push('No Data');
             dataPoints.push(0);
        }

        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(212, 163, 115, 0.3)');
        gradient.addColorStop(1, 'rgba(212, 163, 115, 0.0)');

        this.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Expense Amount',
                    data: dataPoints,
                    borderColor: '#d4a373',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    pointBackgroundColor: '#09090b',
                    pointBorderColor: '#d4a373',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false } },
                    x: { grid: { display: false, drawBorder: false } }
                }
            }
        });
    }

    exportCSV() {
        if (this.transactions.length === 0) {
            alert("No data to export.");
            return;
        }

        const headers = ['Date', 'Type', 'Category', 'Description', 'Amount'];
        const rows = this.transactions.map(tx => 
            [tx.date, tx.type, tx.category, `"${tx.description}"`, tx.amount].join(',')
        );
        
        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('action');
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('href', url);
        a.setAttribute('download', `vault_export_${Date.now()}.csv`);
        a.style.visibility = 'hidden';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

// Initialize App globally so inline onclick events can access it
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new VaultApp();
});