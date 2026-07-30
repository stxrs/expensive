import { getState } from "../store.js";
import { dataService } from "../services/index.js";
import { reloadTransactions, reloadBudgets } from "../dataLayer.js";
import {
  openModal, confirmDialog, toast, escapeHtml, uid, debounce,
  toMinorUnits, fromMinorUnits, formatMoney, formatDate, formatDateShort, todayStr, nowTimeStr, normalizeTag,
} from "../utils.js";

/* ============================= ADD/EDIT MODAL ============================= */
export function openTransactionModal(existing = null, opts = {}) {
  const { categories, paymentMethods, settings, user } = getState();
  let type = existing?.type || opts.type || "expense";
  let tags = existing?.tags ? [...existing.tags] : [];
  // receiptFile: undefined = leave unchanged, a File = new upload, "" = explicit removal.
  let receiptFile;
  let receiptPreviewUrl = existing?.receiptUrl || null;

  const catOptions = () => categories.filter((c) => c.type === type && !c.archived)
    .map((c) => `<option value="${escapeHtml(c.name)}" ${existing?.category === c.name ? "selected" : ""}>${c.icon} ${escapeHtml(c.name)}</option>`).join("");

  const { modal, close } = openModal({
    title: existing ? "Edit transaction" : "Add transaction",
    bodyHtml: `
      <div class="chip-toggle" id="type-toggle" style="margin-bottom:16px;">
        <button type="button" class="chip ${type === "expense" ? "active" : ""}" data-type="expense">Expense</button>
        <button type="button" class="chip ${type === "income" ? "active" : ""}" data-type="income">Income</button>
      </div>
      <form id="tx-form" novalidate>
        <div class="field">
          <label for="tx-amount">Amount</label>
          <input id="tx-amount" type="number" inputmode="decimal" step="0.01" min="0.01" autofocus
                 value="${existing ? fromMinorUnits(existing.amount, settings.currency) : ""}" placeholder="0.00" required>
          <div class="field-error" id="err-amount"></div>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="tx-category">Category</label>
            <select id="tx-category" required>${catOptions()}</select>
          </div>
          <div class="field">
            <label for="tx-method">Payment method</label>
            <select id="tx-method">${paymentMethods.map((m) => `<option value="${escapeHtml(m.name)}" ${existing?.paymentMethod === m.name ? "selected" : ""}>${escapeHtml(m.name)}</option>`).join("")}</select>
          </div>
        </div>
        <div class="field">
          <label for="tx-desc">Description</label>
          <input id="tx-desc" type="text" maxlength="120" value="${escapeHtml(existing?.description || "")}" placeholder="e.g. Groceries at market" required>
          <div class="field-error" id="err-desc"></div>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="tx-date">Date</label>
            <input id="tx-date" type="date" value="${existing?.date || todayStr()}" max="${todayStr()}" required>
          </div>
          <div class="field">
            <label for="tx-time">Time</label>
            <input id="tx-time" type="time" value="${existing?.time || nowTimeStr()}" required>
          </div>
        </div>
        <div class="field">
          <label for="tx-tags">Tags <span class="muted">(comma separated)</span></label>
          <input id="tx-tags" type="text" value="${tags.join(", ")}" placeholder="work, reimbursable">
        </div>
        <div class="field">
          <label for="tx-notes">Notes</label>
          <textarea id="tx-notes" maxlength="500" placeholder="Optional">${escapeHtml(existing?.notes || "")}</textarea>
        </div>
        <div class="field">
          <label for="tx-receipt">Receipt / invoice image</label>
          <input id="tx-receipt" type="file" accept="image/*">
          <img id="receipt-preview" class="receipt-preview ${receiptPreviewUrl ? "" : "hidden"}" src="${receiptPreviewUrl || ""}">
          <button type="button" class="btn btn-sm btn-ghost ${receiptPreviewUrl ? "" : "hidden"}" id="remove-receipt" style="margin-top:6px;">Remove image</button>
        </div>
      </form>
    `,
    footHtml: `<button class="btn btn-ghost" id="tx-cancel">Cancel</button>
               <button class="btn btn-primary" id="tx-save">${existing ? "Save changes" : "Add transaction"}</button>`,
    onMount: (m, close) => {
      m.querySelectorAll("#type-toggle .chip").forEach((btn) => btn.addEventListener("click", () => {
        type = btn.dataset.type;
        m.querySelectorAll("#type-toggle .chip").forEach((b) => b.classList.toggle("active", b.dataset.type === type));
        m.querySelector("#tx-category").innerHTML = catOptions();
      }));

      m.querySelector("#tx-receipt").addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) { toast("Please choose an image file.", "error"); e.target.value = ""; return; }
        if (file.size > 4 * 1024 * 1024) { toast("Image must be under 4MB.", "error"); e.target.value = ""; return; }
        receiptFile = file;
        const img = m.querySelector("#receipt-preview");
        img.src = URL.createObjectURL(file);
        img.classList.remove("hidden");
        m.querySelector("#remove-receipt").classList.remove("hidden");
      });
      m.querySelector("#remove-receipt").addEventListener("click", () => {
        // "" tells the backend to clear a previously-uploaded file; undefined (the
        // initial state) would mean "leave whatever's there alone", which is wrong here.
        receiptFile = "";
        m.querySelector("#tx-receipt").value = "";
        m.querySelector("#receipt-preview").classList.add("hidden");
        m.querySelector("#remove-receipt").classList.add("hidden");
      });

      m.querySelector("#tx-cancel").addEventListener("click", close);
      m.querySelector("#tx-save").addEventListener("click", async () => {
        const amountEl = m.querySelector("#tx-amount");
        const descEl = m.querySelector("#tx-desc");
        let valid = true;
        m.querySelector("#err-amount").textContent = "";
        m.querySelector("#err-desc").textContent = "";
        const amountMinor = toMinorUnits(amountEl.value, settings.currency);
        if (!amountEl.value || amountMinor <= 0) { m.querySelector("#err-amount").textContent = "Enter an amount greater than zero."; valid = false; }
        if (!descEl.value.trim()) { m.querySelector("#err-desc").textContent = "Description is required."; valid = false; }
        if (!valid) return;

        const tagList = [...new Set(m.querySelector("#tx-tags").value.split(",").map((t) => t.trim()).filter(Boolean).map(normalizeTag))];

        const payload = {
          type, amount: amountMinor,
          category: m.querySelector("#tx-category").value,
          description: descEl.value.trim(),
          date: m.querySelector("#tx-date").value,
          time: m.querySelector("#tx-time").value,
          paymentMethod: m.querySelector("#tx-method").value,
          notes: m.querySelector("#tx-notes").value.trim(),
          tags: tagList,
          // Only include receiptFile at all if it actually changed — omitting the
          // key (rather than sending undefined/null) is what tells services/pocketbase.js
          // to leave the existing uploaded file untouched.
          ...(receiptFile !== undefined ? { receiptFile } : {}),
        };

        const saveBtn = m.querySelector("#tx-save");
        saveBtn.disabled = true; saveBtn.textContent = "Saving…";
        try {
          if (existing) await dataService.updateTransaction(user.id, existing.id, payload);
          else await dataService.createTransaction(user.id, payload);
          await Promise.all([reloadTransactions(), reloadBudgets()]);
          toast(existing ? "Transaction updated." : "Transaction added.", "success");
          close();
          opts.onSaved?.();
        } catch (err) {
          toast(err.message, "error");
          saveBtn.disabled = false; saveBtn.textContent = existing ? "Save changes" : "Add transaction";
        }
      });
    },
  });
}

export async function deleteTransactionFlow(tx) {
  const ok = await confirmDialog({ title: "Delete transaction?", message: `This will permanently remove "${tx.description}". This can't be undone.` });
  if (!ok) return;
  try {
    await dataService.deleteTransaction(getState().user.id, tx.id);
    await Promise.all([reloadTransactions(), reloadBudgets()]);
    toast("Transaction deleted.", "success");
  } catch (err) { toast(err.message, "error"); }
}

export async function duplicateTransactionFlow(tx) {
  try {
    const { id, createdAt, updatedAt, receiptFile, receiptUrl, ...rest } = tx;
    await dataService.createTransaction(getState().user.id, { ...rest, date: todayStr(), time: nowTimeStr() });
    await Promise.all([reloadTransactions(), reloadBudgets()]);
    toast("Transaction duplicated.", "success");
  } catch (err) { toast(err.message, "error"); }
}

/* ============================= HISTORY VIEW ============================= */
const PAGE_SIZE = 25;
let filters = { search: "", type: "all", category: "all", method: "all", tag: "all", minAmount: "", maxAmount: "", from: "", to: "", sort: "date_desc" };
let visibleCount = PAGE_SIZE;

export function renderTransactionsView(container) {
  const { transactions, categories, paymentMethods, settings } = getState();

  const allTags = [...new Set(transactions.flatMap((t) => t.tags || []))].sort();

  container.innerHTML = `
    <div class="section-title"><h2>Transactions</h2>
      <button class="btn btn-primary" id="tx-add-btn">+ Add transaction</button>
    </div>
    <div class="card">
      <div class="toolbar">
        <input type="search" class="grow" id="tx-search" placeholder="Search description, notes, tags…" value="${escapeHtml(filters.search)}">
        <select id="f-type"><option value="all">All types</option><option value="expense">Expenses</option><option value="income">Income</option></select>
        <select id="f-category"><option value="all">All categories</option>${categories.map((c) => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join("")}</select>
        <select id="f-method"><option value="all">All methods</option>${paymentMethods.map((m) => `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`).join("")}</select>
        <select id="f-tag"><option value="all">All tags</option>${allTags.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("")}</select>
      </div>
      <div class="toolbar">
        <input type="number" placeholder="Min amount" id="f-min" style="max-width:130px;">
        <input type="number" placeholder="Max amount" id="f-max" style="max-width:130px;">
        <input type="date" id="f-from" style="max-width:160px;"><span class="muted small">to</span>
        <input type="date" id="f-to" style="max-width:160px;">
        <select id="f-sort" style="max-width:170px;">
          <option value="date_desc">Newest first</option>
          <option value="date_asc">Oldest first</option>
          <option value="amount_desc">Highest amount</option>
          <option value="amount_asc">Lowest amount</option>
        </select>
        <button class="btn btn-ghost btn-sm" id="clear-filters">Clear filters</button>
        <span class="filter-count" id="result-count"></span>
      </div>
      <div class="ledger" id="ledger-list"></div>
      <div style="text-align:center;margin-top:14px;">
        <button class="btn btn-ghost" id="load-more" hidden>Load more</button>
      </div>
    </div>
  `;

  // restore filter UI state
  container.querySelector("#f-type").value = filters.type;
  container.querySelector("#f-category").value = filters.category;
  container.querySelector("#f-method").value = filters.method;
  container.querySelector("#f-tag").value = filters.tag;
  container.querySelector("#f-min").value = filters.minAmount;
  container.querySelector("#f-max").value = filters.maxAmount;
  container.querySelector("#f-from").value = filters.from;
  container.querySelector("#f-to").value = filters.to;
  container.querySelector("#f-sort").value = filters.sort;

  container.querySelector("#tx-add-btn").addEventListener("click", () => openTransactionModal(null, { onSaved: () => renderTransactionsView(container) }));

  const rerenderList = () => renderList(container);
  container.querySelector("#tx-search").addEventListener("input", debounce((e) => { filters.search = e.target.value; visibleCount = PAGE_SIZE; rerenderList(); }, 250));
  ["type", "category", "method", "tag", "sort"].forEach((key) => {
    container.querySelector(`#f-${key}`).addEventListener("change", (e) => { filters[key] = e.target.value; visibleCount = PAGE_SIZE; rerenderList(); });
  });
  ["min:minAmount", "max:maxAmount", "from:from", "to:to"].forEach((pair) => {
    const [id, key] = pair.split(":");
    container.querySelector(`#f-${id}`).addEventListener("change", (e) => { filters[key] = e.target.value; visibleCount = PAGE_SIZE; rerenderList(); });
  });
  container.querySelector("#clear-filters").addEventListener("click", () => {
    filters = { search: "", type: "all", category: "all", method: "all", tag: "all", minAmount: "", maxAmount: "", from: "", to: "", sort: "date_desc" };
    visibleCount = PAGE_SIZE;
    renderTransactionsView(container);
  });
  container.querySelector("#load-more").addEventListener("click", () => { visibleCount += PAGE_SIZE; rerenderList(); });

  renderList(container);
}

function applyFilters(transactions) {
  const { settings } = getState();
  let list = transactions;
  if (filters.type !== "all") list = list.filter((t) => t.type === filters.type);
  if (filters.category !== "all") list = list.filter((t) => t.category === filters.category);
  if (filters.method !== "all") list = list.filter((t) => t.paymentMethod === filters.method);
  if (filters.tag !== "all") list = list.filter((t) => (t.tags || []).includes(filters.tag));
  if (filters.from) list = list.filter((t) => t.date >= filters.from);
  if (filters.to) list = list.filter((t) => t.date <= filters.to);
  if (filters.minAmount) list = list.filter((t) => t.amount >= toMinorUnits(filters.minAmount, settings.currency));
  if (filters.maxAmount) list = list.filter((t) => t.amount <= toMinorUnits(filters.maxAmount, settings.currency));
  if (filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    list = list.filter((t) => [t.description, t.notes, t.category, ...(t.tags || [])].join(" ").toLowerCase().includes(q));
  }
  const sorters = {
    date_desc: (a, b) => (b.date + b.time).localeCompare(a.date + a.time),
    date_asc: (a, b) => (a.date + a.time).localeCompare(b.date + b.time),
    amount_desc: (a, b) => b.amount - a.amount,
    amount_asc: (a, b) => a.amount - b.amount,
  };
  return list.slice().sort(sorters[filters.sort]);
}

function renderList(container) {
  const { transactions, categories, settings } = getState();
  const filtered = applyFilters(transactions);
  const listEl = container.querySelector("#ledger-list");
  container.querySelector("#result-count").textContent = `${filtered.length} result${filtered.length === 1 ? "" : "s"}`;

  if (!filtered.length) {
    listEl.innerHTML = `<div class="empty-state">
      <h3>No matching transactions</h3>
      <p>${transactions.length ? "Try adjusting or clearing your filters." : "No transactions yet. Add your first expense or income to get started."}</p>
    </div>`;
    container.querySelector("#load-more").hidden = true;
    return;
  }

  const page = filtered.slice(0, visibleCount);
  const catMap = new Map(categories.map((c) => [c.name, c]));

  listEl.innerHTML = page.map((t) => {
    const cat = catMap.get(t.category);
    return `
    <div class="ledger-row" data-id="${t.id}" tabindex="0" role="button" aria-label="Edit ${escapeHtml(t.description)}">
      <div class="ledger-icon" style="background:${cat?.color ? cat.color + "22" : "var(--bg-sunken)"};color:${cat?.color || "var(--ink-soft)"};">${cat?.icon || "•"}</div>
      <div class="ledger-main">
        <div class="ledger-desc">${escapeHtml(t.description)}</div>
        <div class="ledger-meta">${formatDateShort(t.date)} · ${escapeHtml(t.category)} · ${escapeHtml(t.paymentMethod || "")}</div>
      </div>
      <div class="ledger-tags">${(t.tags || []).slice(0, 2).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
      <div class="ledger-amount ${t.type === "expense" ? "amount-expense" : "amount-income"}">
        ${t.type === "expense" ? "−" : "+"}${formatMoney(t.amount, settings.currency)}
      </div>
    </div>`;
  }).join("");

  container.querySelector("#load-more").hidden = filtered.length <= visibleCount;

  listEl.querySelectorAll(".ledger-row").forEach((row) => {
    const openEdit = () => {
      const tx = transactions.find((t) => t.id === row.dataset.id);
      openTransactionRowActions(tx, container);
    };
    row.addEventListener("click", openEdit);
    row.addEventListener("keydown", (e) => { if (e.key === "Enter") openEdit(); });
  });
}

function openTransactionRowActions(tx, container) {
  const { settings } = getState();
  openModal({
    title: tx.type === "expense" ? "Expense" : "Income",
    bodyHtml: `
      <p style="font-size:22px;font-family:var(--font-mono);font-weight:600;" class="${tx.type === "expense" ? "amount-expense" : "amount-income"}">
        ${tx.type === "expense" ? "−" : "+"}${formatMoney(tx.amount, settings.currency)}
      </p>
      <p class="muted small mt-0">${formatDate(tx.date)} at ${tx.time} · ${escapeHtml(tx.category)} · ${escapeHtml(tx.paymentMethod || "")}</p>
      <p>${escapeHtml(tx.description)}</p>
      ${tx.notes ? `<p class="muted small">${escapeHtml(tx.notes)}</p>` : ""}
      ${(tx.tags || []).length ? `<div class="ledger-tags" style="margin:8px 0;">${tx.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
      ${tx.receiptUrl ? `<img class="receipt-preview" src="${tx.receiptUrl}">` : ""}
    `,
    footHtml: `<button class="btn btn-ghost" id="act-dup">Duplicate</button>
               <button class="btn btn-danger" id="act-del">Delete</button>
               <button class="btn btn-primary" id="act-edit">Edit</button>`,
    onMount: (m, close) => {
      m.querySelector("#act-edit").addEventListener("click", () => { close(); openTransactionModal(tx, { onSaved: () => renderTransactionsView(container) }); });
      m.querySelector("#act-del").addEventListener("click", async () => { close(); await deleteTransactionFlow(tx); renderTransactionsView(container); });
      m.querySelector("#act-dup").addEventListener("click", async () => { close(); await duplicateTransactionFlow(tx); renderTransactionsView(container); });
    },
  });
}
