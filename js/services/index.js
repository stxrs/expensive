import { pocketbaseService } from "./pocketbase.js";
import { localService } from "./local.js";
import { CONFIG } from "../config.js";

// Export whichever backing service is configured. Default to local demo
// mode to make development and testing frictionless.
export const dataService = CONFIG.USE_LOCAL ? localService : pocketbaseService;
