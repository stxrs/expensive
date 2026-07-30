import { getState } from "../store.js";
import {
  formatMoney, formatDateShort, isDateInRange, categoryTotals, sumByType, todayStr, addDays, escapeHtml,
} from "../utils.js";

let charts = {};
function destroyCharts() { Object.values(charts).forEach((c) => c?.destroy()); charts = {}; }
const chartsReady = () => typeof Chart !== "undefined";

const RANGES = {
  this_month: (today) => ({ start: today.slice(0, 8) + "01", end: today }),
  last_3: (today) => ({ start: addDays(today, -90), end: today }),
  last_6: (today) => ({ start: addDays(today, -180), end: today }),
  last_12: (today) => ({ start: addDays(today, -365), end: today }),
};
let currentRange = "last_3";
let customFrom = "", customTo = "";

export function renderAnalytics(container) {
  const { transactions, settings } = getState();
  const today = todayStr();
  const range = currentRange === "custom" && customFrom && customTo ? { start: customFrom, end: customTo } : RANGES[currentRange](today);
  const list = transactions.filter((t) => isDateInRange(t.date, range.start, range.end));

  const catTotals = categoryTotals(list, "expense");
  const income = sumByType(list, "income");
  const expense = sumByType(list, "expense");
  const byDay = new Map();
  list.filter((t) => t.type === "expense").forEach((t) => byDay.set(t.date, (byDay.get(t.date) || 0) + t.amount));
  const topDays = [...byDay.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const largestTx = list.slice().sort((a, b) => b.amount - a.amount).slice(0, 5);

  container.innerHTML = `
    <div class="section-title"><h2>Analytics</h2></div>
    <div class="toolbar">
      <select id="range-select">
        <option value="this_month" ${currentRange === "this_month" ? "selected" : ""}>This month</option>
        <option value="last_3" ${currentRange === "last_3" ? "selected" : ""}>Last 3 months</option>
        <option value="last_6" ${currentRange === "last_6" ? "selected" : ""}>Last 6 months</option>
        <option value="last_12" ${currentRange === "last_12" ? "selected" : ""}>Last 12 months</option>
        <option value="custom" ${currentRange === "custom" ? "selected" : ""}>Custom range</option>
      </select>
      <input type="date" id="range-from" value="${customFrom}" style="max-width:160px;" ${currentRange !== "custom" ? "disabled" : ""}>
      <span class="muted small">to</span>
      <input type="date" id="range-to" value="${customTo}" style="max-width:160px;" ${currentRange !== "custom" ? "disabled" : ""}>
      <span class="filter-count">${formatDateShort(range.start)} – ${formatDateShort(range.end)}</span>
    </div>

    <div class="grid grid-3">
      <div class="card"><div class="stat-label">Total income</div><div class="stat-value amount-income">${formatMoney(income, settings.currency)}</div></div>
      <div class="card"><div class="stat-label">Total expenses</div><div class="stat-value amount-expense">${formatMoney(expense, settings.currency)}</div></div>
      <div class="card"><div class="stat-label">Net savings</div><div class="stat-value">${formatMoney(income - expense, settings.currency)}</div></div>
    </div>

    <div class="card" style="margin-top:16px;">
      <div class="section-title mt-0"><h2 style="font-size:15px;">Spending by category</h2></div>
      <div class="chart-wrap">${catTotals.length && chartsReady() ? '<canvas id="an-cat-chart"></canvas>' : `<div class="empty-state"><p class="small">${catTotals.length ? "Charts couldn't load (offline or CDN blocked)." : "No expenses in this range."}</p></div>`}</div>
    </div>

    <div class="grid grid-2" style="margin-top:16px;">
      <div class="card">
        <div class="section-title mt-0"><h2 style="font-size:15px;">Highest spending days</h2></div>
        <div class="ledger">${topDays.length ? topDays.map(([date, amt]) => `
          <div class="ledger-row"><div class="ledger-icon" style="background:var(--brand-soft);color:var(--brand);">◆</div>
          <div class="ledger-main"><div class="ledger-desc">${formatDateShort(date)}</div></div><div></div>
          <div class="ledger-amount amount-expense">${formatMoney(amt, settings.currency)}</div></div>`).join("") : `<div class="empty-state"><p class="small">No data yet.</p></div>`}
        </div>
      </div>
      <div class="card">
        <div class="section-title mt-0"><h2 style="font-size:15px;">Largest transactions</h2></div>
        <div class="ledger">${largestTx.length ? largestTx.map((t) => `
          <div class="ledger-row"><div class="ledger-icon" style="background:${t.type === "expense" ? "var(--brand-soft)" : "var(--positive-soft)"};color:${t.type === "expense" ? "var(--brand)" : "var(--positive)"};">${t.type === "expense" ? "−" : "+"}</div>
          <div class="ledger-main"><div class="ledger-desc">${escapeHtml(t.description)}</div><div class="ledger-meta">${formatDateShort(t.date)}</div></div><div></div>
          <div class="ledger-amount ${t.type === "expense" ? "amount-expense" : "amount-income"}">${formatMoney(t.amount, settings.currency)}</div></div>`).join("") : `<div class="empty-state"><p class="small">No data yet.</p></div>`}
        </div>
      </div>
    </div>
  `;

  container.querySelector("#range-select").addEventListener("change", (e) => { currentRange = e.target.value; renderAnalytics(container); });
  container.querySelector("#range-from")?.addEventListener("change", (e) => { customFrom = e.target.value; if (customFrom && customTo) renderAnalytics(container); });
  container.querySelector("#range-to")?.addEventListener("change", (e) => { customTo = e.target.value; if (customFrom && customTo) renderAnalytics(container); });

  destroyCharts();
  if (catTotals.length && chartsReady()) {
    const ctx = container.querySelector("#an-cat-chart");
    charts.cat = new Chart(ctx, {
      type: "bar",
      data: { labels: catTotals.map((c) => c.category), datasets: [{ data: catTotals.map((c) => c.total / 100), backgroundColor: "#93032E", borderRadius: 6 }] },
      options: { indexAxis: "y", maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } } } },
    });
  }
}
