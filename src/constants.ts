export const logoUrl = `${import.meta.env.BASE_URL}nssnt-logo.png`;

export const LOGIN_USER  = (import.meta.env.VITE_LOGIN_USER  || "verifier").trim();
export const LOGIN_PASS  = (import.meta.env.VITE_LOGIN_PASS  || "").trim();
export const LOGIN_SHA256 = (import.meta.env.VITE_LOGIN_SHA256 || "").toLowerCase().trim();
export const AUTH_STORAGE_KEY = "nssnt_auth"; // "1" => signed in

export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
export const API_KEY_ENV = import.meta.env.VITE_VERIFIER_API_KEY || "";
export const REQUIRE_KEY = String(import.meta.env.VITE_REQUIRE_API_KEY || "false").toLowerCase() === "true";

export const ENDPOINTS = {
  summary: (txn: string) => `${API_BASE}/api/attendance/summary?transaction_id=${encodeURIComponent(txn)}`,
  update: `${API_BASE}/api/checkin`,
};

export const HIDE_KEYS = new Set(["transaction_id", "transactionid", "txn", "txid"]);
