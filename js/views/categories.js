import { getState } from "../store.js";
import { dataService } from "../services/index.js";
import { reloadCategories, reloadTransactions } from "../dataLayer.js";
import { openModal, confirmDialog, toast, escapeHtml, uid } from "../utils.js";

const ICONS = ["🍔", "🛒", "🚗", "🏠", "💡", "🛍️", "🎬", "🩺", "🎓", "🔁", "📈", "🗂️", "💰", "🎁", "✈️", "🐾"];
const COLORS = ["#0F6B5C", "#C7401E", "#9A6B00", "#5B6EE1", "#3FA7A0", "#B23A6B", "#6D8C1F", "#8C5E2A", "#535D61"];

export function renderCategories(container) {
  const { categories } = getState();
  const expense = categories.filter((c) => c.type === "expense");
  const income = categories.filter((c) => c.type === "income");

  container.innerHTML = `
    <div class="section-title"><h2>Categories</h2><button class="btn btn-primary" id="add-cat-btn">+ New category</button></div>
    <div class="section-title"><h2 style="font-size:15px;">Expense</h2></div>
    <div class="grid grid-3" id="expense-cats">${expense.map(catCard).join("") || emptyHtml()}</div>
    <div class="section-title"><h2 style="font-size:15px;">Income</h2></div>
    <div class="grid grid-3" id="income-cats">${income.map(catCard).join("") || emptyHtml()}</div>
  `;

  container.querySelector("#add-cat-btn").addEventListener("click", () => openCategoryModal(null, container));
  container.querySelectorAll("[data-edit-cat]").forEach((btn) => btn.addEventListener("click", () => {
    const cat = categories.find((c) => c.id === btn.dataset.editCat);
    openCategoryModal(cat, container);
  }));
  container.querySelectorAll("[data-archive-cat]").forEach((btn) => btn.addEventListener("click", async () => {
    const cat = categories.find((c) => c.id === btn.dataset.archiveCat);
    await dataService.updateCategory(getState().user.id, cat.id, { archived: !cat.archived });
    await reloadCategories();
    toast(cat.archived ? "Category restored." : "Category archived.", "success");
    renderCategories(container);
  }));
  container.querySelectorAll("[data-delete-cat]").forEach((btn) => btn.addEventListener("click", () => deleteCategoryFlow(btn.dataset.deleteCat, container)));
}

function catCard(c) {
  return `<div class="card" style="${c.archived ? "opacity:.55;" : ""}">
    <div style="display:flex;align-items:center;gap:10px;">
      <div class="ledger-icon" style="background:${c.color}22;color:${c.color};font-size:18px;">${c.icon}</div>
      <div><strong>${escapeHtml(c.name)}</strong>${c.archived ? '<div class="small muted">Archived</div>' : ""}</div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;">
      <button class="btn btn-ghost btn-sm" data-edit-cat="${c.id}">Edit</button>
      <button class="btn btn-ghost btn-sm" data-archive-cat="${c.id}">${c.archived ? "Restore" : "Archive"}</button>
      <button class="btn btn-ghost btn-sm" data-delete-cat="${c.id}">Delete</button>
    </div>
  </div>`;
}
function emptyHtml() { return `<div class="card empty-state" style="grid-column:1/-1;"><p class="small">No categories here yet.</p></div>`; }

function openCategoryModal(existing, container) {
  let icon = existing?.icon || ICONS[0];
  let color = existing?.color || COLORS[0];
  let type = existing?.type || "expense";

  const { modal, close } = openModal({
    title: existing ? "Edit category" : "New category",
    bodyHtml: `
      <form id="cat-form">
        <div class="field">
          <label for="cat-name">Name</label>
          <input id="cat-name" type="text" maxlength="40" value="${escapeHtml(existing?.name || "")}" required>
          <div class="field-error" id="cat-err"></div>
        </div>
        <div class="field">
          <label>Type</label>
          <div class="chip-toggle" id="cat-type-toggle">
            <button type="button" class="chip ${type === "expense" ? "active" : ""}" data-type="expense">Expense</button>
            <button type="button" class="chip ${type === "income" ? "active" : ""}" data-type="income">Income</button>
          </div>
        </div>
        <div class="field">
          <label>Icon</label>
          <div class="chip-toggle" id="icon-picker">${ICONS.map((ic) => `<button type="button" class="chip ${ic === icon ? "active" : ""}" data-icon="${ic}" style="font-size:16px;">${ic}</button>`).join("")}</div>
        </div>
        <div class="field">
          <label>Color</label>
          <div class="chip-toggle" id="color-picker">${COLORS.map((c) => `<button type="button" class="chip ${c === color ? "active" : ""}" data-color="${c}" style="background:${c};width:26px;height:26px;padding:0;border-radius:50%;${c === color ? "outline:2px solid var(--ink);" : ""}"></button>`).join("")}</div>
        </div>
      </form>`,
    footHtml: `<button class="btn btn-ghost" id="cat-cancel">Cancel</button><button class="btn btn-primary" id="cat-save">${existing ? "Save changes" : "Create category"}</button>`,
    onMount: (m, close) => {
      m.querySelectorAll("#cat-type-toggle .chip").forEach((btn) => btn.addEventListener("click", () => {
        type = btn.dataset.type;
        m.querySelectorAll("#cat-type-toggle .chip").forEach((b) => b.classList.toggle("active", b.dataset.type === type));
      }));
      m.querySelectorAll("#icon-picker .chip").forEach((btn) => btn.addEventListener("click", () => {
        icon = btn.dataset.icon;
        m.querySelectorAll("#icon-picker .chip").forEach((b) => b.classList.toggle("active", b.dataset.icon === icon));
      }));
      m.querySelectorAll("#color-picker .chip").forEach((btn) => btn.addEventListener("click", () => {
        color = btn.dataset.color;
        m.querySelectorAll("#color-picker .chip").forEach((b) => { b.classList.toggle("active", b.dataset.color === color); b.style.outline = b.dataset.color === color ? "2px solid var(--ink)" : "none"; });
      }));
      m.querySelector("#cat-cancel").addEventListener("click", close);
      m.querySelector("#cat-save").addEventListener("click", async () => {
        const name = m.querySelector("#cat-name").value.trim();
        if (!name) { m.querySelector("#cat-err").textContent = "Category name is required."; return; }
        const { categories, user } = getState();
        const dup = categories.some((c) => c.id !== existing?.id && c.type === type && c.name.toLowerCase() === name.toLowerCase());
        if (dup) { m.querySelector("#cat-err").textContent = "A category with this name already exists."; return; }
        const btn = m.querySelector("#cat-save"); btn.disabled = true; btn.textContent = "Saving…";
        try {
          if (existing) await dataService.updateCategory(user.id, existing.id, { name, type, icon, color });
          else await dataService.createCategory(user.id, { name, type, icon, color, archived: false });
          await reloadCategories();
          toast(existing ? "Category updated." : "Category created.", "success");
          close();
          renderCategories(container);
        } catch (err) { toast(err.message, "error"); btn.disabled = false; btn.textContent = existing ? "Save changes" : "Create category"; }
      });
    },
  });
}

async function deleteCategoryFlow(catId, container) {
  const { categories, transactions, user } = getState();
  const cat = categories.find((c) => c.id === catId);
  const usageCount = transactions.filter((t) => t.category === cat.name).length;
  const message = usageCount
    ? `${usageCount} transaction${usageCount === 1 ? "" : "s"} will be moved to "Miscellaneous". This can't be undone.`
    : "This category isn't used by any transactions yet.";
  const ok = await confirmDialog({ title: `Delete "${cat.name}"?`, message });
  if (!ok) return;
  await dataService.deleteCategory(user.id, catId, "Miscellaneous");
  await Promise.all([reloadCategories(), reloadTransactions()]);
  toast("Category deleted.", "success");
  renderCategories(container);
}
