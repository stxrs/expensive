import { getState, setState } from "../store.js";
import { dataService, isDemoMode } from "../services/index.js";
import { reloadPaymentMethods, reloadRecurring } from "../dataLayer.js";
import { openModal, confirmDialog, toast, escapeHtml, uid, CURRENCIES, toMinorUnits, fromMinorUnits, todayStr, applyTheme } from "../utils.js";

export function renderSettings(container) {
  const { settings, paymentMethods, recurring, categories, user, transactions } = getState();

  container.innerHTML = `
    <div class="section-title"><h2>Settings</h2></div>

    <div class="card" style="margin-bottom:16px;">
      <h3 style="font-size:15px;margin-bottom:14px;">Preferences</h3>
      <div class="field-row">
        <div class="field">
          <label for="s-currency">Currency</label>
          <select id="s-currency">${Object.keys(CURRENCIES).map((c) => `<option value="${c}" ${settings.currency === c ? "selected" : ""}>${c} (${CURRENCIES[c].symbol})</option>`).join("")}</select>
        </div>
        <div class="field">
          <label for="s-month-start">Budget month starts on</label>
          <select id="s-month-start">${[1, 5, 10, 15, 20, 25, 28].map((d) => `<option value="${d}" ${settings.monthStartDay === d ? "selected" : ""}>Day ${d}</option>`).join("")}</select>
        </div>
      </div>
      <div class="field">
        <label>Appearance</label>
        <div class="chip-toggle" id="theme-toggle">
          ${["light", "dark", "system"].map((t) => `<button type="button" class="chip ${settings.theme === t ? "active" : ""}" data-theme="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}
        </div>
      </div>
      <div class="field" style="display:flex;align-items:center;gap:8px;">
        <input type="checkbox" id="s-notify" style="width:auto;" ${settings.notifyBudgetWarnings ? "checked" : ""}>
        <label for="s-notify" style="margin:0;">Show in-app budget warnings when approaching or over limit</label>
      </div>
      <div class="muted small">Push notifications for recurring reminders require a backend scheduler and are not enabled here — see README.</div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <h3 style="font-size:15px;margin-bottom:10px;">Export your data</h3>
      <p class="muted small">Download everything, or just what's currently in your ledger.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;">
        <button class="btn" id="export-csv">Export CSV</button>
        <button class="btn" id="export-json">Export JSON</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div class="section-title mt-0"><h3 style="font-size:15px;">Payment methods</h3><button class="btn btn-ghost btn-sm" id="add-method">+ Add</button></div>
      <div class="chip-toggle">${paymentMethods.map((m) => `<span class="chip">${escapeHtml(m.name)}</span>`).join("")}</div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div class="section-title mt-0"><h3 style="font-size:15px;">Recurring transactions</h3><button class="btn btn-ghost btn-sm" id="add-recurring">+ Add</button></div>
      <div class="ledger">${recurring.length ? recurring.map(recurringRow).join("") : `<div class="empty-state"><p class="small">No recurring transactions set up. Great for rent, salary, or subscriptions.</p></div>`}</div>
    </div>

    <div class="card">
      <h3 style="font-size:15px;margin-bottom:6px;">Account</h3>
      <p class="muted small">Signed in as ${escapeHtml(user.email)} ${isDemoMode ? "(demo mode)" : ""}</p>
    </div>
  `;

  container.querySelector("#s-currency").addEventListener("change", (e) => saveSettings({ currency: e.target.value }, container));
  container.querySelector("#s-month-start").addEventListener("change", (e) => saveSettings({ monthStartDay: Number(e.target.value) }, container));
  container.querySelector("#s-notify").addEventListener("change", (e) => saveSettings({ notifyBudgetWarnings: e.target.checked }, container));
  container.querySelectorAll("#theme-toggle .chip").forEach((btn) => btn.addEventListener("click", () => saveSettings({ theme: btn.dataset.theme }, container)));

  container.querySelector("#export-csv").addEventListener("click", () => exportCSV(transactions, settings));
  container.querySelector("#export-json").addEventListener("click", () => exportJSON());

  container.querySelector("#add-method").addEventListener("click", () => addPaymentMethodFlow(container));
  container.querySelector("#add-recurring").addEventListener("click", () => openRecurringModal(null, container));
  container.querySelectorAll("[data-edit-rec]").forEach((btn) => btn.addEventListener("click", () => {
    const rec = recurring.find((r) => r.id === btn.dataset.editRec);
    openRecurringModal(rec, container);
  }));
  container.querySelectorAll("[data-pause-rec]").forEach((btn) => btn.addEventListener("click", async () => {
    const rec = recurring.find((r) => r.id === btn.dataset.pauseRec);
    await dataService.upsertRecurring(user.id, { id: rec.id, paused: !rec.paused });
    await reloadRecurring();
    toast(rec.paused ? "Recurring transaction resumed." : "Recurring transaction paused.", "success");
    renderSettings(container);
  }));
  container.querySelectorAll("[data-delete-rec]").forEach((btn) => btn.addEventListener("click", async () => {
    const ok = await confirmDialog({ title: "Delete recurring transaction?", message: "Future occurrences will no longer be created. Past transactions are kept." });
    if (!ok) return;
    await dataService.deleteRecurring(user.id, btn.dataset.deleteRec);
    await reloadRecurring();
    renderSettings(container);
  }));
}

async function saveSettings(patch, container) {
  try {
    await dataService.updateSettings(getState().user.id, patch);
    setState({ settings: { ...getState().settings, ...patch } });
    if (patch.theme) applyTheme(patch.theme);
    toast("Settings saved.", "success");
    renderSettings(container);
  } catch (err) { toast(err.message, "error"); }
}

function recurringRow(r) {
  return `<div class="ledger-row" style="cursor:default;">
    <div class="ledger-icon" style="background:var(--teal-soft);color:var(--teal);">${r.frequency[0].toUpperCase()}</div>
    <div class="ledger-main"><div class="ledger-desc">${escapeHtml(r.description)} ${r.paused ? '<span class="tag">Paused</span>' : ""}</div>
      <div class="ledger-meta">${r.frequency} · ${escapeHtml(r.category)} · from ${r.startDate}</div></div>
    <div style="display:flex;gap:6px;">
      <button class="btn btn-ghost btn-sm" data-pause-rec="${r.id}">${r.paused ? "Resume" : "Pause"}</button>
      <button class="btn btn-ghost btn-sm" data-edit-rec="${r.id}">Edit</button>
      <button class="btn btn-ghost btn-sm" data-delete-rec="${r.id}">Delete</button>
    </div>
    <div></div>
  </div>`;
}

function openRecurringModal(existing, container) {
  const { categories, paymentMethods, settings, user } = getState();
  let type = existing?.type || "expense";
  const catOptions = () => categories.filter((c) => c.type === type && !c.archived).map((c) => `<option value="${escapeHtml(c.name)}" ${existing?.category === c.name ? "selected" : ""}>${c.icon} ${escapeHtml(c.name)}</option>`).join("");

  openModal({
    title: existing ? "Edit recurring transaction" : "New recurring transaction",
    bodyHtml: `
      <form id="rec-form">
        <div class="chip-toggle" id="rec-type-toggle" style="margin-bottom:14px;">
          <button type="button" class="chip ${type === "expense" ? "active" : ""}" data-type="expense">Expense</button>
          <button type="button" class="chip ${type === "income" ? "active" : ""}" data-type="income">Income</button>
        </div>
        <div class="field"><label for="rec-desc">Description</label><input id="rec-desc" value="${escapeHtml(existing?.description || "")}" required></div>
        <div class="field-row">
          <div class="field"><label for="rec-amount">Amount</label><input id="rec-amount" type="number" min="0.01" step="0.01" value="${existing ? fromMinorUnits(existing.amount, settings.currency) : ""}" required></div>
          <div class="field"><label for="rec-category">Category</label><select id="rec-category">${catOptions()}</select></div>
        </div>
        <div class="field-row">
          <div class="field"><label for="rec-freq">Frequency</label>
            <select id="rec-freq">${["daily", "weekly", "monthly", "yearly"].map((f) => `<option value="${f}" ${existing?.frequency === f ? "selected" : ""}>${f[0].toUpperCase() + f.slice(1)}</option>`).join("")}</select></div>
          <div class="field"><label for="rec-method">Payment method</label><select id="rec-method">${paymentMethods.map((m) => `<option value="${escapeHtml(m.name)}" ${existing?.paymentMethod === m.name ? "selected" : ""}>${escapeHtml(m.name)}</option>`).join("")}</select></div>
        </div>
        <div class="field-row">
          <div class="field"><label for="rec-start">Start date</label><input id="rec-start" type="date" value="${existing?.startDate || todayStr()}" required></div>
          <div class="field"><label for="rec-end">End date <span class="muted">(optional)</span></label><input id="rec-end" type="date" value="${existing?.endDate || ""}"></div>
        </div>
      </form>`,
    footHtml: `<button class="btn btn-ghost" id="rec-cancel">Cancel</button><button class="btn btn-primary" id="rec-save">${existing ? "Save changes" : "Create"}</button>`,
    onMount: (m, close) => {
      m.querySelectorAll("#rec-type-toggle .chip").forEach((btn) => btn.addEventListener("click", () => {
        type = btn.dataset.type;
        m.querySelectorAll("#rec-type-toggle .chip").forEach((b) => b.classList.toggle("active", b.dataset.type === type));
        m.querySelector("#rec-category").innerHTML = catOptions();
      }));
      m.querySelector("#rec-cancel").addEventListener("click", close);
      m.querySelector("#rec-save").addEventListener("click", async () => {
        const amount = toMinorUnits(m.querySelector("#rec-amount").value, settings.currency);
        const description = m.querySelector("#rec-desc").value.trim();
        if (!description || amount <= 0) { toast("Fill in a description and a valid amount.", "error"); return; }
        const payload = {
          id: existing?.id, type, amount, description,
          category: m.querySelector("#rec-category").value,
          frequency: m.querySelector("#rec-freq").value,
          paymentMethod: m.querySelector("#rec-method").value,
          startDate: m.querySelector("#rec-start").value,
          endDate: m.querySelector("#rec-end").value || null,
          lastRun: existing?.lastRun || null,
        };
        await dataService.upsertRecurring(user.id, payload);
        await reloadRecurring();
        toast(existing ? "Recurring transaction updated." : "Recurring transaction created.", "success");
        close();
        renderSettings(container);
      });
    },
  });
}

function addPaymentMethodFlow(container) {
  openModal({
    title: "Add payment method",
    bodyHtml: `<div class="field"><label for="pm-name">Name</label><input id="pm-name" placeholder="e.g. Business card" autofocus></div>`,
    footHtml: `<button class="btn btn-ghost" id="pm-cancel">Cancel</button><button class="btn btn-primary" id="pm-save">Add</button>`,
    onMount: (m, close) => {
      m.querySelector("#pm-cancel").addEventListener("click", close);
      m.querySelector("#pm-save").addEventListener("click", async () => {
        const name = m.querySelector("#pm-name").value.trim();
        if (!name) return;
        await dataService.createPaymentMethod(getState().user.id, name);
        await reloadPaymentMethods();
        close();
        renderSettings(container);
      });
    },
  });
}

/* ---------------- export ---------------- */
function csvEscape(val) {
  const s = String(val ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function exportCSV(transactions, settings) {
  const headers = ["date", "time", "type", "category", "description", "amount", "currency", "paymentMethod", "tags", "notes"];
  const rows = transactions.map((t) => [t.date, t.time, t.type, t.category, t.description, fromMinorUnits(t.amount, settings.currency), settings.currency, t.paymentMethod, (t.tags || []).join("|"), t.notes || ""]);
  const csv = [headers.join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\r\n");
  downloadFile(`expensive-export-${todayStr()}.csv`, csv, "text/csv;charset=utf-8;");
  toast("CSV export ready.", "success");
}
function exportJSON() {
  const { transactions, categories, budgets, paymentMethods, recurring, settings } = getState();
  const payload = { exportedAt: new Date().toISOString(), transactions, categories, budgets, paymentMethods, recurring, settings };
  downloadFile(`expensive-export-${todayStr()}.json`, JSON.stringify(payload, null, 2), "application/json");
  toast("JSON export ready.", "success");
}
