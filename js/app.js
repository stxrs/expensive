import { dataService } from "./services/index.js";
import { getState, setState, subscribe } from "./store.js";
import { loadAllUserData } from "./dataLayer.js";
import { applyTheme, toast } from "./utils.js";
import { renderAuth } from "./views/auth.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderTransactionsView, openTransactionModal } from "./views/transactions.js";
import { renderBudgets } from "./views/budgets.js";
import { renderCategories } from "./views/categories.js";
import { renderAnalytics } from "./views/analytics.js";
import { renderSettings } from "./views/settings.js";

const authRoot = document.getElementById("auth-root");
const shell = document.getElementById("shell");
const main = document.getElementById("main");
const nav = document.getElementById("nav");
const bottomNav = document.getElementById("bottom-nav");

const ROUTES = {
  dashboard: renderDashboard,
  transactions: renderTransactionsView,
  budgets: renderBudgets,
  categories: renderCategories,
  analytics: renderAnalytics,
  settings: renderSettings,
};

function currentRouteName() {
  const hash = location.hash.replace("#/", "");
  return ROUTES[hash] ? hash : "dashboard";
}

function renderRoute() {
  const routeName = currentRouteName();
  setState({ route: routeName });
  [...nav.querySelectorAll("a"), ...bottomNav.querySelectorAll("a")].forEach((a) => a.classList.toggle("active", a.dataset.route === routeName));
  main.classList.remove("fade-in");
  void main.offsetWidth; // restart animation
  main.classList.add("fade-in");
  ROUTES[routeName](main);
}

window.addEventListener("hashchange", () => { if (getState().user) renderRoute(); });

function showApp() {
  authRoot.hidden = true;
  shell.hidden = false;
  if (!location.hash) location.hash = "#/dashboard";
  renderRoute();
}

function showAuth() {
  shell.hidden = true;
  authRoot.hidden = false;
  renderAuth(authRoot, { onAuthed: onAuthed });
}

async function onAuthed(user) {
  setState({ user });
  try {
    await loadAllUserData();
    applyTheme(getState().settings?.theme || "system");
    showApp();
  } catch (err) {
    toast(err.message, "error");
  }
}

document.getElementById("global-add-btn").addEventListener("click", () => openTransactionModal(null, { onSaved: renderRoute }));
document.getElementById("bottom-add-btn").addEventListener("click", () => openTransactionModal(null, { onSaved: renderRoute }));
document.getElementById("logout-btn").addEventListener("click", async () => {
  await dataService.logout();
  setState({ user: null, transactions: [], categories: [], budgets: [], paymentMethods: [], recurring: [], settings: null });
  location.hash = "";
  showAuth();
  toast("Logged out.", "default");
});

dataService.onAuthChange?.((user) => {
  if (!user && getState().user) { setState({ user: null }); showAuth(); }
});

(async function init() {
  try {
    const user = await dataService.init();
    if (user) { await onAuthed(user); }
    else { showAuth(); }
  } catch (err) {
    console.error(err);
    showAuth();
  }
})();
