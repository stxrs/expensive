// ===================================================================
// POCKETBASE SERVICE
// Same method surface as services/local.js. Requires the PocketBase
// JS SDK (loaded via CDN in index.html as the global `PocketBase`).
//
// Expected collections — see README.md "PocketBase schema" section
// for full field lists and access-rule recommendations. Every
// collection below must have list/view/create/update/delete rules
// scoped to `@request.auth.id = userId`; never rely on the frontend
// alone to enforce ownership.
// ===================================================================
import { CONFIG } from "../config.js";

let _pb = null;
function getPB() {
  if (_pb) return _pb;
  if (typeof PocketBase === "undefined") {
    throw new Error("PocketBase SDK failed to load. Check your internet connection or CDN access, then reload.");
  }
  _pb = new PocketBase(CONFIG.POCKETBASE_URL);
  return _pb;
}

function friendlyError(err) {
  if (!navigator.onLine) return new Error("You're offline. Check your connection and try again.");
  if (err?.status === 0) return new Error("Can't reach the server. It may be down or unreachable.");
  if (err?.status === 401 || err?.status === 403) return new Error("Your session has expired. Please log in again.");
  if (err?.status === 404) return new Error("That record no longer exists.");
  if (err?.data && typeof err.data === "object") {
    const firstField = Object.keys(err.data)[0];
    const msg = err.data[firstField]?.message;
    if (msg) return new Error(msg);
  }
  return new Error(err?.message || "Something went wrong. Please try again.");
}

async function withErrors(promise) {
  try { return await promise; } catch (err) { throw friendlyError(err); }
}

function recordUrl(collection, record, field) {
  return record?.[field] ? getPB().files.getUrl(record, record[field]) : null;
}

export const pocketbaseService = {
  mode: "pocketbase",

  async init() {
    getPB().authStore.loadFromCookie(document.cookie || "");
    if (!getPB().authStore.isValid) return null;
    try {
      await withErrors(getPB().collection("users").authRefresh());
      return { id: getPB().authStore.model.id, email: getPB().authStore.model.email };
    } catch { getPB().authStore.clear(); return null; }
  },

  onAuthChange(cb) {
    getPB().authStore.onChange(() => {
      cb(getPB().authStore.isValid ? { id: getPB().authStore.model.id, email: getPB().authStore.model.email } : null);
    });
  },

  async register(email, password) {
    await withErrors(getPB().collection("users").create({ email, password, passwordConfirm: password }));
    return this.login(email, password);
  },

  async login(email, password) {
    const res = await withErrors(getPB().collection("users").authWithPassword(email, password));
    return { id: res.record.id, email: res.record.email };
  },

  async requestPasswordReset(email) {
    await withErrors(getPB().collection("users").requestPasswordReset(email));
    return { sent: true, demo: false };
  },

  async logout() { getPB().authStore.clear(); },

  /* ---------------- transactions ---------------- */
  async getTransactions(userId) {
    const res = await withErrors(getPB().collection("transactions").getFullList({ filter: `userId = "${userId}"`, sort: "-date,-time" }));
    return res.map((r) => ({ ...r, receiptUrl: recordUrl("transactions", r, "receiptFile") }));
  },
  async createTransaction(userId, tx) {
    const fd = toFormData({ ...tx, userId });
    return withErrors(getPB().collection("transactions").create(fd));
  },
  async updateTransaction(userId, id, patch) {
    const fd = toFormData(patch);
    return withErrors(getPB().collection("transactions").update(id, fd));
  },
  async deleteTransaction(userId, id) { return withErrors(getPB().collection("transactions").delete(id)); },

  /* ---------------- categories ---------------- */
  async getCategories(userId) { return withErrors(getPB().collection("categories").getFullList({ filter: `userId = "${userId}"`, sort: "name" })); },
  async createCategory(userId, cat) { return withErrors(getPB().collection("categories").create({ ...cat, userId })); },
  async updateCategory(userId, id, patch) { return withErrors(getPB().collection("categories").update(id, patch)); },
  async deleteCategory(userId, id, reassignToName = "Miscellaneous") {
    const cat = await withErrors(getPB().collection("categories").getOne(id));
    const txs = await withErrors(getPB().collection("transactions").getFullList({ filter: `userId = "${userId}" && category = "${cat.name}"` }));
    await Promise.all(txs.map((t) => getPB().collection("transactions").update(t.id, { category: reassignToName })));
    return withErrors(getPB().collection("categories").delete(id));
  },

  /* ---------------- budgets ---------------- */
  async getBudgets(userId) { return withErrors(getPB().collection("budgets").getFullList({ filter: `userId = "${userId}"` })); },
  async upsertBudget(userId, budget) {
    if (budget.id) return withErrors(getPB().collection("budgets").update(budget.id, budget));
    return withErrors(getPB().collection("budgets").create({ ...budget, userId }));
  },
  async deleteBudget(userId, id) { return withErrors(getPB().collection("budgets").delete(id)); },

  /* ---------------- payment methods ---------------- */
  async getPaymentMethods(userId) { return withErrors(getPB().collection("payment_methods").getFullList({ filter: `userId = "${userId}"` })); },
  async createPaymentMethod(userId, name) { return withErrors(getPB().collection("payment_methods").create({ userId, name })); },

  /* ---------------- recurring ---------------- */
  async getRecurring(userId) { return withErrors(getPB().collection("recurring").getFullList({ filter: `userId = "${userId}"` })); },
  async upsertRecurring(userId, rec) {
    if (rec.id) return withErrors(getPB().collection("recurring").update(rec.id, rec));
    return withErrors(getPB().collection("recurring").create({ ...rec, userId }));
  },
  async deleteRecurring(userId, id) { return withErrors(getPB().collection("recurring").delete(id)); },

  /* ---------------- settings ---------------- */
  async getSettings(userId) {
    const list = await withErrors(getPB().collection("settings").getFullList({ filter: `userId = "${userId}"` }));
    return list[0] || null;
  },
  async updateSettings(userId, patch) {
    const list = await withErrors(getPB().collection("settings").getFullList({ filter: `userId = "${userId}"` }));
    if (list[0]) return withErrors(getPB().collection("settings").update(list[0].id, patch));
    return withErrors(getPB().collection("settings").create({ ...patch, userId }));
  },
};

function toFormData(obj) {
  const fd = new FormData();
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (v instanceof File) fd.append(k, v);
    else if (Array.isArray(v)) fd.append(k, JSON.stringify(v));
    else fd.append(k, v);
  });
  return fd;
}
