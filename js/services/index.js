import { CONFIG } from "../config.js";
import { localService } from "./local.js";
import { pocketbaseService } from "./pocketbase.js";

export const dataService = CONFIG.MODE === "pocketbase" ? pocketbaseService : localService;
export const isDemoMode = dataService.mode === "demo";
