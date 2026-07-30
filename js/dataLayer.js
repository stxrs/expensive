import { dataService } from "./services/index.js";
import { getState, setState } from "./store.js";
import { addDays, todayStr } from "./utils.js";
import { CONFIG } from "./config.js";

const DEFAULT_EXPENSE_CATEGORIES = [
  ["Food", "🍔", "#93032E"], ["Groceries", "🛒", "#96721D"], ["Transport", "🚗", "#1F6B4B"],
  ["Rent", "🏠", "#6B4A7A"], ["Utilities", "💡", "#3A5A78"], ["Shopping", "🛍️", "#B3123F"],
  ["Entertainment", "🎬", "#7A5C1A"], ["Health", "🩺", "#2E7D5B"], ["Education", "🎓", "#8C5A6B"],
  ["Subscriptions", "🔁", "#54677D"], ["Investments", "📈", "#A6683D"], ["Miscellaneous", "🗂️", "#4C6E5D"],
];
const DEFAULT_INCOME_CATEGORIES = [
  ["Salary", "💰"], ["Freelance", "💼"], ["Refunds", "↩️"], ["Investments", "📈"], ["Gifts", "🎁"], ["Other", "✨"],
];
const DEFAULT_PAYMENT_METHODS = ["Cash", "Debit card", "Credit card", "UPI", "Bank transfer", "Wallet", "Other"];

/** A brand-new PocketBase account has no categories, no payment methods, and
 *  no settings row — nothing seeds those server-side. Without this, the "Add
 *  transaction" modal would show empty dropdowns and the app would crash the
 *  moment it reads `settings.currency` off a null settings object. This runs
 *  on every login/init and only acts when something is actually missing, so
 *  it's safe to call repeatedly and heals the account if a row ever vanishes. */
async function ensureStarterData(userId, { categories, paymentMethods, settings }) {
  const tasks = [];
  if (!categories.length) {
    DEFAULT_EXPENSE_CATEGORIES.forEach(([name, icon, color]) => tasks.push(dataService.createCategory(userId, { name, type: "expense", icon, color, archived: false })));
    DEFAULT_INCOME_CATEGORIES.forEach(([name, icon]) => tasks.push(dataService.createCategory(userId, { name, type: "income", icon, color: "#1F6B4B", archived: false })));
  }
  if (!paymentMethods.length) {
    DEFAULT_PAYMENT_METHODS.forEach((name) => tasks.push(dataService.createPaymentMethod(userId, name)));
  }
  if (tasks.length) await Promise.all(tasks);

  if (!settings) {
    settings = await dataService.updateSettings(userId, {
      currency: CONFIG.DEFAULT_CURRENCY, theme: "system",
      monthStartDay: CONFIG.DEFAULT_MONTH_START_DAY, notifyBudgetWarnings: true,
    });
  }
  return { needsReload: tasks.length > 0, settings };
}

export async function loadAllUserData() {
  const userId = getState().user.id;
  let [transactions, categories, budgets, paymentMethods, recurring, settings] = await Promise.all([
    dataService.getTransactions(userId),
    dataService.getCategories(userId),
    dataService.getBudgets(userId),
    dataService.getPaymentMethods(userId),
    dataService.getRecurring(userId),
    dataService.getSettings(userId),
  ]);

  const seedResult = await ensureStarterData(userId, { categories, paymentMethods, settings });
  settings = seedResult.settings;
  if (seedResult.needsReload) {
    [categories, paymentMethods] = await Promise.all([dataService.getCategories(userId), dataService.getPaymentMethods(userId)]);
  }

  setState({ transactions, categories, budgets, paymentMethods, recurring, settings });
  await processDueRecurring();
}

/** Materializes any recurring transactions that have come due since they
 *  were last processed. Tracks lastRun per rule so refreshing the app
 *  or reloading data never creates duplicates. */
export async function processDueRecurring() {
  const { user, recurring } = getState();
  if (!recurring?.length) return;
  const today = todayStr();
  let createdAny = false;

  for (const rule of recurring) {
    if (rule.paused) continue;
    if (rule.endDate && rule.endDate < today) continue;
    let cursor = rule.lastRun ? nextOccurrence(rule.lastRun, rule.frequency) : rule.startDate;
    let guard = 0;
    while (cursor <= today && (!rule.endDate || cursor <= rule.endDate) && guard < 366) {
      await dataService.createTransaction(user.id, {
        type: rule.type, amount: rule.amount, category: rule.category, description: rule.description,
        date: cursor, time: "09:00", paymentMethod: rule.paymentMethod, notes: `Recurring: ${rule.description}`,
        tags: rule.tags || [],
      });
      createdAny = true;
      rule.lastRun = cursor;
      cursor = nextOccurrence(cursor, rule.frequency);
      guard++;
    }
    await dataService.upsertRecurring(user.id, { id: rule.id, lastRun: rule.lastRun });
  }

  if (createdAny) {
    const [transactions, budgets] = await Promise.all([
      dataService.getTransactions(user.id),
      dataService.getBudgets(user.id),
    ]);
    setState({ transactions, budgets, recurring });
  }
}

function nextOccurrence(dateStr, frequency) {
  if (frequency === "daily") return addDays(dateStr, 1);
  if (frequency === "weekly") return addDays(dateStr, 7);
  if (frequency === "yearly") return addDays(dateStr, 365);
  return addDays(dateStr, 30); // monthly approximation kept simple & documented
}

export async function reloadTransactions() {
  const userId = getState().user.id;
  const transactions = await dataService.getTransactions(userId);
  setState({ transactions });
}
export async function reloadCategories() {
  const userId = getState().user.id;
  const categories = await dataService.getCategories(userId);
  setState({ categories });
}
export async function reloadBudgets() {
  const userId = getState().user.id;
  const budgets = await dataService.getBudgets(userId);
  setState({ budgets });
}
export async function reloadRecurring() {
  const userId = getState().user.id;
  const recurring = await dataService.getRecurring(userId);
  setState({ recurring });
}
export async function reloadPaymentMethods() {
  const userId = getState().user.id;
  const paymentMethods = await dataService.getPaymentMethods(userId);
  setState({ paymentMethods });
}
