// ===================================================================
// CONFIG — the only file you need to touch to point this app at your
// self-hosted PocketBase server.
// ===================================================================
export const CONFIG = {
  // Example: "https://expensive.mydomain.com"  (must be HTTPS in production)
  POCKETBASE_URL: "http://127.0.0.1:8090",

  // When developing locally without a PocketBase server, set this to true
  // to use the built-in `localService` (persists to localStorage).
  USE_LOCAL: true,

  APP_NAME: "Expensive",

  DEFAULT_CURRENCY: "INR",
  DEFAULT_MONTH_START_DAY: 1, // 1-28, or "salary" handled as a plain day-of-month too
};
