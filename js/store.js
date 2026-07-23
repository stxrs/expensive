// ===================================================================
// STORE — minimal pub/sub state container. Keeps the UI in sync after
// every mutation without manual page reloads.
// ===================================================================
const state = {
  user: null,
  transactions: [],
  categories: [],
  budgets: [],
  paymentMethods: [],
  recurring: [],
  settings: null,
  route: "dashboard",
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
