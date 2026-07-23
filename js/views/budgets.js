import { getState } from "../store.js";
import { dataService } from "../services/index.js";
import { reloadBudgets } from "../dataLayer.js";
import {
  openModal, confirmDialog, toast, escapeHtml, toMinorUnits, fromMinorUnits, formatMoney, formatPercent,
  getPeriodForDate, todayStr, daysRemainingInPeriod, sumByType, budgetStatus, budgetPercent, predictPeriodEndSpend, isDateInRange,
} from "../utils.js";

export function renderBudgets(container) {
  const { budgets, categories, transactions, settings } = getState();
  const period = getPeriodForDate(todayStr(), settings.monthStartDay);
  const currentTx = transactions.filter((t) => isDateInRange(t.date, period.start, period.end) && t.type === "expense");
  const daysLeft = daysRemainingInPeriod(period);

  const overall = budgets.find((b) => !b.category);
  const categoryBudgets = budgets.filter((b) => b.category);
  const totalSpent = sumByType(currentTx, "expense");

  container.innerHTML = `
    <div class="section-title"><h2>Budgets</h2>
      <button class="btn btn-primary" id="add-budget-btn">+ Add budget</button>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div class="section-title mt-0"><h2 style="font-size:15px;">Overall monthly budget</h2>
        ${overall ? `<button class="btn btn-ghost btn-sm" id="edit-overall">Edit</button>` : ""}
      </div>
      ${overall ? overallBudgetHtml(overall, totalSpent, period, daysLeft, settings) : `
        <div class="empty-state"><h3>No overall budget set</h3><p>Set a total monthly spending limit to track your safe-to-spend amount.</p>
        <button class="btn btn-primary" id="set-overall-btn" style="margin-top:10px;">Set overall budget</button></div>`}
    </div>

    <div class="section-title"><h2>Category budgets</h2></div>
    <div class="grid grid-3" id="cat-budgets">
      ${categoryBudgets.length ? categoryBudgets.map((b) => categoryBudgetCard(b, currentTx, categories, settings)).join("") : `
        <div class="card empty-state" style="grid-column:1/-1;"><h3>No category budgets yet</h3><p>Break your budget down by category — like Food or Transport — for tighter control.</p></div>`}
    </div>
  `;

  const openOverall = () => openBudgetModal(overall, { category: null });
  container.querySelector("#set-overall-btn")?.addEventListener("click", openOverall);
  container.querySelector("#edit-overall")?.addEventListener("click", openOverall);
  container.querySelector("#add-budget-btn").addEventListener("click", () => openBudgetPicker());

  container.querySelectorAll("[data-edit-budget]").forEach((btn) => btn.addEventListener("click", () => {
    const b = budgets.find((x) => x.id === btn.dataset.editBudget);
    openBudgetModal(b, { category: b.category });
  }));
  container.querySelectorAll("[data-delete-budget]").forEach((btn) => btn.addEventListener("click", async () => {
    const ok = await confirmDialog({ title: "Delete budget?", message: "This removes the budget limit. Past spending history is unaffected." });
    if (!ok) return;
    await dataService.deleteBudget(getState().user.id, btn.dataset.deleteBudget);
    await reloadBudgets();
    renderBudgets(container);
  }));
}

function overallBudgetHtml(budget, spent, period, daysLeft, settings) {
  const pct = budgetPercent(spent, budget.limit);
  const status = budgetStatus(spent, budget.limit);
  const remaining = budget.limit - spent;
  const safeToSpend = daysLeft > 0 ? Math.max(Math.floor(remaining / daysLeft), 0) : 0;
  return `
    <div class="budget-head"><span>${formatMoney(spent, settings.currency)} of ${formatMoney(budget.limit, settings.currency)}</span>
      <span class="status-badge status-${status}">${status === "safe" ? "On track" : status === "warn" ? "Approaching limit" : "Over budget"}</span></div>
    <div class="bar-track"><div class="bar-fill ${status !== "safe" ? status : ""}" style="width:${Math.min(pct, 100)}%"></div></div>
    <div class="budget-sub">
      <span>${remaining >= 0 ? `${formatMoney(remaining, settings.currency)} remaining` : `${formatMoney(-remaining, settings.currency)} over`}</span>
      <span>${daysLeft} day${daysLeft === 1 ? "" : "s"} left · ${formatMoney(safeToSpend, settings.currency)}/day safe to spend</span>
    </div>`;
}

function categoryBudgetCard(budget, currentTx, categories, settings) {
  const cat = categories.find((c) => c.name === budget.category);
  const spent = currentTx.filter((t) => t.category === budget.category).reduce((s, t) => s + t.amount, 0);
  const pct = budgetPercent(spent, budget.limit);
  const status = budgetStatus(spent, budget.limit);
  return `<div class="card">
    <div class="budget-row" style="margin-bottom:0;">
      <div class="budget-head"><span>${cat?.icon || "◇"} ${escapeHtml(budget.category)}</span>
        <span class="status-badge status-${status}">${status === "safe" ? "Safe" : status === "warn" ? "Near limit" : "Over"}</span></div>
      <div class="bar-track"><div class="bar-fill ${status !== "safe" ? status : ""}" style="width:${Math.min(pct, 100)}%"></div></div>
      <div class="budget-sub">
        <span>${formatMoney(spent, settings.currency)} / ${formatMoney(budget.limit, settings.currency)}</span>
        <span>${formatPercent(pct)}</span>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;">
      <button class="btn btn-ghost btn-sm" data-edit-budget="${budget.id}">Edit</button>
      <button class="btn btn-ghost btn-sm" data-delete-budget="${budget.id}">Delete</button>
    </div>
  </div>`;
}

function openBudgetPicker() {
  const { categories, budgets } = getState();
  const used = new Set(budgets.filter((b) => b.category).map((b) => b.category));
  const available = categories.filter((c) => c.type === "expense" && !c.archived && !used.has(c.name));
  if (!available.length) { toast("Every expense category already has a budget.", "default"); return; }
  const { modal, close } = openModal({
    title: "Choose a category",
    bodyHtml: `<div class="chip-toggle">${available.map((c) => `<button type="button" class="chip" data-cat="${escapeHtml(c.name)}">${c.icon} ${escapeHtml(c.name)}</button>`).join("")}</div>`,
    onMount: (m, close) => m.querySelectorAll("[data-cat]").forEach((btn) => btn.addEventListener("click", () => { close(); openBudgetModal(null, { category: btn.dataset.cat }); })),
  });
}

function openBudgetModal(existing, { category }) {
  const { settings, user } = getState();
  const { modal, close } = openModal({
    title: category ? `Budget: ${category}` : "Overall monthly budget",
    bodyHtml: `
      <form id="budget-form">
        <div class="field">
          <label for="b-limit">Monthly limit</label>
          <input id="b-limit" type="number" min="1" step="0.01" value="${existing ? fromMinorUnits(existing.limit, settings.currency) : ""}" autofocus required>
          <div class="field-error" id="b-err"></div>
        </div>
      </form>`,
    footHtml: `<button class="btn btn-ghost" id="b-cancel">Cancel</button><button class="btn btn-primary" id="b-save">Save budget</button>`,
    onMount: (m, close) => {
      m.querySelector("#b-cancel").addEventListener("click", close);
      m.querySelector("#b-save").addEventListener("click", async () => {
        const val = m.querySelector("#b-limit").value;
        const limit = toMinorUnits(val, settings.currency);
        if (!val || limit <= 0) { m.querySelector("#b-err").textContent = "Enter a limit greater than zero."; return; }
        const btn = m.querySelector("#b-save"); btn.disabled = true; btn.textContent = "Saving…";
        try {
          await dataService.upsertBudget(user.id, { id: existing?.id, category: category || null, limit, period: "monthly" });
          await reloadBudgets();
          toast("Budget saved.", "success");
          close();
          renderBudgets(document.getElementById("main"));
        } catch (err) { toast(err.message, "error"); btn.disabled = false; btn.textContent = "Save budget"; }
      });
    },
  });
}
