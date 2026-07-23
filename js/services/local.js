// ===================================================================
// LOCAL / DEMO SERVICE
// Implements the exact same method surface as services/pocketbase.js
// so the rest of the app never needs to know which one is active.
// Persists to localStorage. Clearly NOT secure, NOT multi-device —
// it exists so the frontend is fully testable before PocketBase exists.
// ===================================================================
import { CONFIG } from "../config.js";
import { uid, todayStr } from "../utils.js";

const KEY = (k) => `${CONFIG.LOCAL_STORAGE_PREFIX}${k}`;

function readJSON(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function writeJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
const wait = (ms = 260) => new Promise((r) => setTimeout(r, ms));

function defaultCategories() {
  const expense = ["Food", "Groceries", "Transport", "Rent", "Utilities", "Shopping", "Entertainment", "Health", "Education", "Subscriptions", "Investments", "Miscellaneous"];
  const income = ["Salary", "Freelance", "Refunds", "Investments", "Gifts", "Other"];
  const icons = ["🍔", "🛒", "🚗", "🏠", "💡", "🛍️", "🎬", "🩺", "🎓", "🔁", "📈", "🗂️"];
  const colors = ["#C7401E", "#0F6B5C", "#9A6B00", "#5B6EE1", "#C7401E", "#0F6B5C", "#9A6B00", "#5B6EE1", "#0F6B5C", "#9A6B00", "#5B6EE1", "#535D61"];
  const cats = [];
  expense.forEach((name, i) => cats.push({ id: uid(), name, type: "expense", icon: icons[i % icons.length], color: colors[i % colors.length], archived: false }));
  income.forEach((name, i) => cats.push({ id: uid(), name, type: "income", icon: "💰", color: "#0F6B5C", archived: false }));
  return cats;
}

function seedUserData() {
  return {
    transactions: [],
    categories: defaultCategories(),
    budgets: [],
    paymentMethods: [
      { id: uid(), name: "Cash" }, { id: uid(), name: "Debit card" }, { id: uid(), name: "Credit card" },
      { id: uid(), name: "UPI" }, { id: uid(), name: "Bank transfer" }, { id: uid(), name: "Wallet" }, { id: uid(), name: "Other" },
    ],
    recurring: [],
    settings: { currency: CONFIG.DEFAULT_CURRENCY, theme: "system", monthStartDay: CONFIG.DEFAULT_MONTH_START_DAY, notifyBudgetWarnings: true },
  };
}

function loadUsers() { return readJSON(KEY("users"), []); }
function saveUsers(u) { writeJSON(KEY("users"), u); }
function dataKey(userId) { return KEY(`data_${userId}`); }
function loadData(userId) { return readJSON(dataKey(userId), seedUserData()); }
function saveData(userId, data) { writeJSON(dataKey(userId), data); }

// naive obfuscation only — this is a client-only demo, never treat as real auth
function hash(pw) { return btoa(unescape(encodeURIComponent(pw))).split("").reverse().join(""); }

let authListeners = [];

export const localService = {
  mode: "demo",

  async init() {
    await wait(120);
    const session = readJSON(KEY("session"), null);
    if (!session) return null;
    const user = loadUsers().find((u) => u.id === session.userId);
    return user ? { id: user.id, email: user.email } : null;
  },

  onAuthChange(cb) { authListeners.push(cb); },
  _emitAuth(user) { authListeners.forEach((cb) => cb(user)); },

  async register(email, password) {
    await wait();
    email = email.trim().toLowerCase();
    const users = loadUsers();
    if (users.some((u) => u.email === email)) throw new Error("An account with this email already exists.");
    const user = { id: uid(), email, pw: hash(password), createdAt: todayStr() };
    users.push(user);
    saveUsers(users);
    saveData(user.id, seedUserData());
    writeJSON(KEY("session"), { userId: user.id });
    const publicUser = { id: user.id, email: user.email };
    this._emitAuth(publicUser);
    return publicUser;
  },

  async login(email, password) {
    await wait();
    email = email.trim().toLowerCase();
    const user = loadUsers().find((u) => u.email === email);
    if (!user || user.pw !== hash(password)) throw new Error("Invalid email or password.");
    writeJSON(KEY("session"), { userId: user.id });
    const publicUser = { id: user.id, email: user.email };
    this._emitAuth(publicUser);
    return publicUser;
  },

  async requestPasswordReset(email) {
    await wait();
    // In demo mode there is no mail server; PocketBase mode sends a real reset email.
    return { sent: true, demo: true };
  },

  async logout() {
    await wait(80);
    localStorage.removeItem(KEY("session"));
    this._emitAuth(null);
  },

  /* ---------------- transactions ---------------- */
  async getTransactions(userId) { await wait(); return loadData(userId).transactions.slice().sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)); },
  async createTransaction(userId, tx) {
    await wait();
    const data = loadData(userId);
    const record = { id: uid(), userId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...tx };
    data.transactions.push(record);
    saveData(userId, data);
    return record;
  },
  async updateTransaction(userId, id, patch) {
    await wait();
    const data = loadData(userId);
    const idx = data.transactions.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error("Transaction not found.");
    data.transactions[idx] = { ...data.transactions[idx], ...patch, updatedAt: new Date().toISOString() };
    saveData(userId, data);
    return data.transactions[idx];
  },
  async deleteTransaction(userId, id) {
    await wait();
    const data = loadData(userId);
    data.transactions = data.transactions.filter((t) => t.id !== id);
    saveData(userId, data);
    return true;
  },

  /* ---------------- categories ---------------- */
  async getCategories(userId) { await wait(120); return loadData(userId).categories; },
  async createCategory(userId, cat) {
    await wait();
    const data = loadData(userId);
    const record = { id: uid(), archived: false, ...cat };
    data.categories.push(record);
    saveData(userId, data);
    return record;
  },
  async updateCategory(userId, id, patch) {
    await wait();
    const data = loadData(userId);
    const idx = data.categories.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error("Category not found.");
    data.categories[idx] = { ...data.categories[idx], ...patch };
    saveData(userId, data);
    return data.categories[idx];
  },
  /** Deleting a category reassigns existing transactions instead of corrupting them. */
  async deleteCategory(userId, id, reassignToName = "Miscellaneous") {
    await wait();
    const data = loadData(userId);
    const cat = data.categories.find((c) => c.id === id);
    if (!cat) return true;
    data.transactions.forEach((t) => { if (t.category === cat.name) t.category = reassignToName; });
    data.categories = data.categories.filter((c) => c.id !== id);
    saveData(userId, data);
    return true;
  },

  /* ---------------- budgets ---------------- */
  async getBudgets(userId) { await wait(120); return loadData(userId).budgets; },
  async upsertBudget(userId, budget) {
    await wait();
    const data = loadData(userId);
    if (budget.id) {
      const idx = data.budgets.findIndex((b) => b.id === budget.id);
      data.budgets[idx] = { ...data.budgets[idx], ...budget };
    } else {
      data.budgets.push({ id: uid(), ...budget });
    }
    saveData(userId, data);
    return data.budgets;
  },
  async deleteBudget(userId, id) {
    await wait();
    const data = loadData(userId);
    data.budgets = data.budgets.filter((b) => b.id !== id);
    saveData(userId, data);
    return true;
  },

  /* ---------------- payment methods ---------------- */
  async getPaymentMethods(userId) { await wait(100); return loadData(userId).paymentMethods; },
  async createPaymentMethod(userId, name) {
    await wait();
    const data = loadData(userId);
    const record = { id: uid(), name };
    data.paymentMethods.push(record);
    saveData(userId, data);
    return record;
  },

  /* ---------------- recurring ---------------- */
  async getRecurring(userId) { await wait(100); return loadData(userId).recurring; },
  async upsertRecurring(userId, rec) {
    await wait();
    const data = loadData(userId);
    if (rec.id) {
      const idx = data.recurring.findIndex((r) => r.id === rec.id);
      data.recurring[idx] = { ...data.recurring[idx], ...rec };
    } else {
      data.recurring.push({ id: uid(), paused: false, ...rec });
    }
    saveData(userId, data);
    return data.recurring;
  },
  async deleteRecurring(userId, id) {
    await wait();
    const data = loadData(userId);
    data.recurring = data.recurring.filter((r) => r.id !== id);
    saveData(userId, data);
    return true;
  },

  /* ---------------- settings ---------------- */
  async getSettings(userId) { await wait(80); return loadData(userId).settings; },
  async updateSettings(userId, patch) {
    await wait();
    const data = loadData(userId);
    data.settings = { ...data.settings, ...patch };
    saveData(userId, data);
    return data.settings;
  },
};
