// ===================================================================
// UTILS — money, dates, calculations, DOM helpers.
// Centralized on purpose: nothing else in the app should re-implement
// these, per the "no duplicated calculation logic" requirement.
// ===================================================================

/* ---------------- IDs & misc ---------------- */
export const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function escapeHtml(str = "") {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------------- MONEY ----------------
   All amounts are stored as INTEGER MINOR UNITS (e.g. paise/cents) to
   avoid floating point drift. UI only ever formats minor units; math
   is always done on integers. */
export const CURRENCIES = {
  INR: { symbol: "₹", locale: "en-IN", digits: 2 },
  USD: { symbol: "$", locale: "en-US", digits: 2 },
  EUR: { symbol: "€", locale: "de-DE", digits: 2 },
  GBP: { symbol: "£", locale: "en-GB", digits: 2 },
  JPY: { symbol: "¥", locale: "ja-JP", digits: 0 },
};

export function toMinorUnits(amountStr, currency = "INR") {
  const digits = CURRENCIES[currency]?.digits ?? 2;
  const n = Number(String(amountStr).replace(/,/g, ""));
  if (!isFinite(n)) return 0;
  return Math.round(n * 10 ** digits);
}

export function fromMinorUnits(minor, currency = "INR") {
  const digits = CURRENCIES[currency]?.digits ?? 2;
  return minor / 10 ** digits;
}

export function formatMoney(minor, currency = "INR", opts = {}) {
  const meta = CURRENCIES[currency] || CURRENCIES.INR;
  const value = fromMinorUnits(minor, currency);
  try {
    return new Intl.NumberFormat(meta.locale, {
      style: "currency", currency, maximumFractionDigits: meta.digits, minimumFractionDigits: meta.digits,
      signDisplay: opts.signDisplay || "auto",
    }).format(value);
  } catch {
    return `${meta.symbol}${value.toFixed(meta.digits)}`;
  }
}

export function formatPercent(n, digits = 0) {
  if (!isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

/* ---------------- DATES ----------------
   All dates are handled as local calendar dates (YYYY-MM-DD strings)
   to avoid UTC-shift bugs. Never round-trip through `new Date(str)`
   for display; only for arithmetic, and always via local constructors. */
export function todayStr() {
  return dateToStr(new Date());
}
export function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
export function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function strToDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function formatDate(s, opts = {}) {
  if (!s) return "";
  return strToDate(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", ...opts });
}
export function formatDateShort(s) {
  if (!s) return "";
  return strToDate(s).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
export function daysInMonth(year, monthIdx0) {
  return new Date(year, monthIdx0 + 1, 0).getDate();
}
export function addDays(s, n) {
  const d = strToDate(s);
  d.setDate(d.getDate() + n);
  return dateToStr(d);
}

/** Centralized budgeting-period utility respecting a custom month-start day. */
export function getPeriodForDate(dateStr, startDay = 1) {
  const d = strToDate(dateStr);
  const y = d.getFullYear(), m = d.getMonth();
  const clampedStart = Math.min(startDay, daysInMonth(y, m));
  let periodStartY = y, periodStartM = m;
  if (d.getDate() < clampedStart) {
    periodStartM -= 1;
    if (periodStartM < 0) { periodStartM = 11; periodStartY -= 1; }
  }
  const startClamped = Math.min(startDay, daysInMonth(periodStartY, periodStartM));
  const start = new Date(periodStartY, periodStartM, startClamped);
  let endY = periodStartY, endM = periodStartM + 1;
  if (endM > 11) { endM = 0; endY += 1; }
  const endClamped = Math.min(startDay, daysInMonth(endY, endM));
  const end = new Date(endY, endM, endClamped);
  end.setDate(end.getDate() - 1); // inclusive end date
  return { start: dateToStr(start), end: dateToStr(end) };
}

export function previousPeriod({ start }, startDay = 1) {
  const s = strToDate(start);
  s.setDate(s.getDate() - 1); // one day before this period's start = last day of previous period
  return getPeriodForDate(dateToStr(s), startDay);
}

export function isDateInRange(dateStr, start, end) {
  return dateStr >= start && dateStr <= end;
}

export function totalDaysInPeriod(period) {
  return Math.round((strToDate(period.end) - strToDate(period.start)) / 86400000) + 1;
}
export function daysElapsedInPeriod(period, asOf = todayStr()) {
  if (asOf < period.start) return 0;
  const clampedAsOf = asOf > period.end ? period.end : asOf;
  return Math.round((strToDate(clampedAsOf) - strToDate(period.start)) / 86400000) + 1;
}
export function daysRemainingInPeriod(period, asOf = todayStr()) {
  return Math.max(totalDaysInPeriod(period) - daysElapsedInPeriod(period, asOf), 0);
}

/* ---------------- CALCULATIONS ---------------- */
export function sumByType(transactions, type) {
  return transactions.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
}

export function calcTotals(transactions) {
  const income = sumByType(transactions, "income");
  const expense = sumByType(transactions, "expense");
  return { income, expense, balance: income - expense };
}

export function calcSavingsRate(income, savings) {
  if (income === 0) return savings === 0 ? 0 : (savings > 0 ? 100 : -100);
  return (savings / income) * 100;
}

/** % change handling zero-previous-value gracefully (no Infinity/NaN). */
export function percentChange(current, previous) {
  if (previous === 0) return current === 0 ? { value: 0, undefined: false } : { value: null, undefined: true };
  return { value: ((current - previous) / previous) * 100, undefined: false };
}

export function categoryTotals(transactions, type = "expense") {
  const map = new Map();
  transactions.filter((t) => t.type === type).forEach((t) => {
    map.set(t.category, (map.get(t.category) || 0) + t.amount);
  });
  return [...map.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
}

export function averageDailySpend(transactions, period) {
  const totalExpense = sumByType(transactions, "expense");
  const elapsed = Math.max(daysElapsedInPeriod(period), 1);
  return Math.round(totalExpense / elapsed);
}

/** Simple, clearly-labeled linear projection of month-end spending. */
export function predictPeriodEndSpend(transactions, period) {
  const spent = sumByType(transactions, "expense");
  const elapsed = Math.max(daysElapsedInPeriod(period), 1);
  const total = totalDaysInPeriod(period);
  const dailyRate = spent / elapsed;
  return Math.round(dailyRate * total);
}

export function budgetStatus(spent, limit) {
  if (limit <= 0) return "safe";
  const pct = (spent / limit) * 100;
  if (pct >= 100) return "over";
  if (pct >= 80) return "warn";
  return "safe";
}
export function budgetPercent(spent, limit) {
  if (limit <= 0) return 0;
  return Math.min((spent / limit) * 100, 999);
}

/* ---------------- normalize helper for tags/search ---------------- */
export function normalizeTag(tag) {
  return tag.trim().toLowerCase().replace(/\s+/g, " ");
}

/* ---------------- DOM: toasts ---------------- */
export function toast(message, type = "default", ms = 3200) {
  const layer = document.getElementById("toast-layer");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  layer.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 200);
  }, ms);
}

/* ---------------- DOM: modal ---------------- */
let lastFocused = null;
export function openModal({ title, bodyHtml, footHtml = "", onMount, onClose, wide = false }) {
  const layer = document.getElementById("modal-layer");
  layer.style.pointerEvents = "auto";
  lastFocused = document.activeElement;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  const modal = document.createElement("div");
  modal.className = "modal";
  if (wide) modal.style.maxWidth = "640px";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.innerHTML = `
    <div class="modal-head"><h3>${escapeHtml(title)}</h3><button class="modal-close" aria-label="Close">✕</button></div>
    <div class="modal-body">${bodyHtml}</div>
    ${footHtml ? `<div class="modal-foot">${footHtml}</div>` : ""}
  `;
  layer.append(backdrop, modal);
  requestAnimationFrame(() => { backdrop.classList.add("open"); modal.classList.add("open"); });

  function close() {
    backdrop.classList.remove("open");
    modal.classList.remove("open");
    setTimeout(() => {
      backdrop.remove(); modal.remove();
      layer.style.pointerEvents = "none";
      if (lastFocused) lastFocused.focus();
      onClose?.();
    }, 190);
  }
  modal.querySelector(".modal-close").addEventListener("click", close);
  backdrop.addEventListener("click", close);
  function escHandler(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", escHandler); } }
  document.addEventListener("keydown", escHandler);

  onMount?.(modal, close);
  const firstInput = modal.querySelector("input, select, textarea, button");
  firstInput?.focus();
  return { modal, close };
}

export function confirmDialog({ title, message, confirmLabel = "Delete", danger = true }) {
  return new Promise((resolve) => {
    openModal({
      title,
      bodyHtml: `<p class="muted">${escapeHtml(message)}</p>`,
      footHtml: `<button class="btn btn-ghost" id="cd-cancel">Cancel</button>
                 <button class="btn ${danger ? "btn-danger" : "btn-primary"}" id="cd-ok">${escapeHtml(confirmLabel)}</button>`,
      onMount: (modal, close) => {
        modal.querySelector("#cd-cancel").addEventListener("click", () => { close(); resolve(false); });
        modal.querySelector("#cd-ok").addEventListener("click", () => { close(); resolve(true); });
      },
    });
  });
}

/* ---------------- THEME ---------------- */
let systemThemeListener = null;
export function applyTheme(theme) {
  const root = document.documentElement;
  if (systemThemeListener) { window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", systemThemeListener); systemThemeListener = null; }
  if (theme === "system") {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    root.setAttribute("data-theme", mq.matches ? "dark" : "light");
    systemThemeListener = (e) => root.setAttribute("data-theme", e.matches ? "dark" : "light");
    mq.addEventListener("change", systemThemeListener);
  } else {
    root.setAttribute("data-theme", theme);
  }
}

/* simple element creation helper */
export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
