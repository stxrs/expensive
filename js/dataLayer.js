import { dataService } from "./services/index.js";
import { getState, setState } from "./store.js";
import { addDays, todayStr } from "./utils.js";

export async function loadAllUserData() {
  const userId = getState().user.id;
  const [transactions, categories, budgets, paymentMethods, recurring, settings] = await Promise.all([
    dataService.getTransactions(userId),
    dataService.getCategories(userId),
    dataService.getBudgets(userId),
    dataService.getPaymentMethods(userId),
    dataService.getRecurring(userId),
    dataService.getSettings(userId),
  ]);
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
