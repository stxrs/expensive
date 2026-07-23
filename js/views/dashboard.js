import { getState } from "../store.js";
import {
  formatMoney, formatPercent, formatDateShort, getPeriodForDate, previousPeriod, isDateInRange,
  calcTotals, calcSavingsRate, percentChange, categoryTotals, averageDailySpend, todayStr, escapeHtml,
} from "../utils.js";
import { openTransactionModal } from "./transactions.js";

let charts = {}; // keep references so we can destroy before re-creating (no memory leaks)

function destroyCharts() { Object.values(charts).forEach((c) => c?.destroy()); charts = {}; }

function chartColors(theme) {
  const styles = getComputedStyle(document.documentElement);
  return {
    grid: styles.getPropertyValue("--line").trim(),
    text: styles.getPropertyValue("--ink-soft").trim(),
    teal: styles.getPropertyValue("--teal").trim(),
    coral: styles.getPropertyValue("--coral").trim(),
    amber: styles.getPropertyValue("--amber").trim(),
  };
}

const CAT_PALETTE = ["#0F6B5C", "#C7401E", "#9A6B00", "#5B6EE1", "#3FA7A0", "#B23A6B", "#6D8C1F", "#8C5E2A", "#535D61", "#2E8B8B", "#A85D3D", "#4C6E5D"];
const chartsReady = () => typeof Chart !== "undefined";

export function renderDashboard(container) {
  const { transactions, settings } = getState();
  const period = getPeriodForDate(todayStr(), settings.monthStartDay);
  const prevPeriod = previousPeriod(period, settings.monthStartDay);

  const current = transactions.filter((t) => isDateInRange(t.date, period.start, period.end));
  const previous = transactions.filter((t) => isDateInRange(t.date, prevPeriod.start, prevPeriod.end));

  const { income, expense, balance } = calcTotals(current);
  const prevTotals = calcTotals(previous);
  const savings = income - expense;
  const savingsRate = calcSavingsRate(income, savings);
  const catTotals = categoryTotals(current, "expense");
  const topCategory = catTotals[0];
  const avgDaily = averageDailySpend(current, period);

  const expenseChange = percentChange(expense, prevTotals.expense);
  const incomeChange = percentChange(income, prevTotals.income);

  container.innerHTML = `
    <div class="section-title">
      <h2>Dashboard</h2>
      <span class="muted small">${formatDateShort(period.start)} – ${formatDateShort(period.end)}</span>
    </div>

    <div class="grid grid-4">
      ${statCard("Income", formatMoney(income, settings.currency), incomeChange, "up-good")}
      ${statCard("Expenses", formatMoney(expense, settings.currency), expenseChange, "up-bad")}
      ${statCard("Balance", formatMoney(balance, settings.currency), null, null)}
      ${statCard("Savings rate", formatPercent(savingsRate), null, null, savings < 0 ? "amount-expense" : "amount-income")}
    </div>

    <div class="grid grid-3" style="margin-top:16px;">
      <div class="card">
        <div class="stat-label">Transactions this period</div>
        <div class="stat-value">${current.length}</div>
      </div>
      <div class="card">
        <div class="stat-label">Largest category</div>
        <div class="stat-value" style="font-size:17px;">${topCategory ? escapeHtml(topCategory.category) : "—"}</div>
        <div class="muted small">${topCategory ? formatMoney(topCategory.total, settings.currency) : "No spending yet"}</div>
      </div>
      <div class="card">
        <div class="stat-label">Average daily spend</div>
        <div class="stat-value">${formatMoney(avgDaily, settings.currency)}</div>
      </div>
    </div>

    <div class="grid grid-2" style="margin-top:16px;">
      <div class="card">
        <div class="section-title mt-0"><h2 style="font-size:15px;">Spending by category</h2></div>
        <div class="chart-wrap" id="cat-chart-wrap">
          ${catTotals.length && chartsReady() ? '<canvas id="cat-chart"></canvas>' : emptyChartState(catTotals.length ? "Charts couldn't load (offline or CDN blocked)." : "No expenses yet this period.")}
        </div>
        ${catTotals.length ? `<div class="legend-list">${catTotals.slice(0, 6).map((c, i) => `
          <div class="legend-item"><span class="legend-dot" style="background:${CAT_PALETTE[i % CAT_PALETTE.length]}"></span>
          ${escapeHtml(c.category)} <span class="num">${formatMoney(c.total, settings.currency)}</span></div>`).join("")}</div>` : ""}
      </div>
      <div class="card">
        <div class="section-title mt-0"><h2 style="font-size:15px;">Income vs expenses</h2></div>
        <div class="chart-wrap" style="height:220px;">
          ${(income || expense) && chartsReady() ? '<canvas id="ie-chart"></canvas>' : emptyChartState((income || expense) ? "Charts couldn't load (offline or CDN blocked)." : "Add a transaction to see this chart.")}
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:16px;">
      <div class="section-title mt-0"><h2 style="font-size:15px;">Last 30 days trend</h2></div>
      <div class="chart-wrap">
        ${transactions.length && chartsReady() ? '<canvas id="trend-chart"></canvas>' : emptyChartState(transactions.length ? "Charts couldn't load (offline or CDN blocked)." : "No transactions yet.")}
      </div>
    </div>

    <div class="section-title"><h2>Recent transactions</h2><a href="#/transactions">View all →</a></div>
    <div class="card ledger" id="recent-ledger">
      ${recentTransactionsHtml(transactions, settings)}
    </div>
  `;

  destroyCharts();
  const colors = chartColors();

  if (catTotals.length && chartsReady()) {
    const ctx = container.querySelector("#cat-chart");
    charts.cat = new Chart(ctx, {
      type: "doughnut",
      data: { labels: catTotals.map((c) => c.category), datasets: [{ data: catTotals.map((c) => c.total), backgroundColor: CAT_PALETTE, borderWidth: 0 }] },
      options: {
        maintainAspectRatio: false, cutout: "68%",
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => {
          const total = catTotals.reduce((s, c) => s + c.total, 0);
          const pct = ((ctx.raw / total) * 100).toFixed(1);
          return `${ctx.label}: ${formatMoney(ctx.raw, settings.currency)} (${pct}%)`;
        } } } },
      },
    });
  }

  if ((income || expense) && chartsReady()) {
    const ctx = container.querySelector("#ie-chart");
    charts.ie = new Chart(ctx, {
      type: "bar",
      data: { labels: ["This period"], datasets: [
        { label: "Income", data: [income / 100], backgroundColor: colors.teal, borderRadius: 6 },
        { label: "Expenses", data: [expense / 100], backgroundColor: colors.coral, borderRadius: 6 },
      ] },
      options: { maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: { grid: { color: colors.grid }, ticks: { color: colors.text } } },
        plugins: { legend: { labels: { color: colors.text } } } },
    });
  }

  if (transactions.length && chartsReady()) {
    const days = [...Array(30)].map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (29 - i));
      return d.toISOString().slice(0, 10);
    });
    const byDay = days.map((day) => transactions.filter((t) => t.date === day && t.type === "expense").reduce((s, t) => s + t.amount, 0) / 100);
    const ctx = container.querySelector("#trend-chart");
    charts.trend = new Chart(ctx, {
      type: "line",
      data: { labels: days.map((d) => d.slice(5)), datasets: [{ label: "Daily spend", data: byDay, borderColor: colors.coral, backgroundColor: colors.coral + "22", fill: true, tension: 0.35, pointRadius: 0 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false }, ticks: { color: colors.text, maxTicksLimit: 8 } }, y: { grid: { color: colors.grid }, ticks: { color: colors.text } } } },
    });
  }

  container.querySelector("#recent-ledger")?.querySelectorAll("[data-add]").forEach((btn) =>
    btn.addEventListener("click", () => openTransactionModal(null, { onSaved: () => renderDashboard(container) })));
}

function statCard(label, value, change, direction, valueClass = "") {
  let trendHtml = "";
  if (change) {
    if (change.undefined) trendHtml = `<span class="stat-trend trend-flat">new</span>`;
    else {
      const isGood = direction === "up-good" ? change.value >= 0 : change.value <= 0;
      const cls = change.value === 0 ? "trend-flat" : (isGood ? "trend-up" : "trend-down");
      trendHtml = `<span class="stat-trend ${cls}">${change.value >= 0 ? "▲" : "▼"} ${Math.abs(change.value).toFixed(0)}% vs last period</span>`;
    }
  }
  return `<div class="card">
    <div class="stat-label">${label}</div>
    <div class="stat-value ${valueClass}">${value}</div>
    ${trendHtml}
  </div>`;
}

function emptyChartState(msg) {
  return `<div class="empty-state" style="padding:24px;"><p class="small">${escapeHtml(msg)}</p></div>`;
}

function recentTransactionsHtml(transactions, settings) {
  const recent = transactions.slice(0, 6);
  if (!recent.length) {
    return `<div class="empty-state"><h3>No transactions yet</h3><p>Add your first expense or income to get started.</p>
      <button class="btn btn-primary" data-add style="margin-top:10px;">+ Add transaction</button></div>`;
  }
  return recent.map((t) => `
    <div class="ledger-row">
      <div class="ledger-icon" style="background:var(--teal-soft);color:var(--teal);">${t.type === "expense" ? "−" : "+"}</div>
      <div class="ledger-main">
        <div class="ledger-desc">${escapeHtml(t.description)}</div>
        <div class="ledger-meta">${formatDateShort(t.date)} · ${escapeHtml(t.category)}</div>
      </div>
      <div></div>
      <div class="ledger-amount ${t.type === "expense" ? "amount-expense" : "amount-income"}">${t.type === "expense" ? "−" : "+"}${formatMoney(t.amount, settings.currency)}</div>
    </div>`).join("");
}
