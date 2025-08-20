export function findTxnAny(obj: unknown): string {
  const norm = (s: string) => s.toLowerCase().replace(/\s|_/g, "");
  const KEYS = new Set(["transactionid", "transaction_id", "txn", "txid"]);
  const stack: unknown[] = [obj];
  while (stack.length) {
    const cur = stack.pop();
    if (cur && typeof cur === "object") {
      if (Array.isArray(cur)) stack.push(...cur);
      else {
        for (const [k, v] of Object.entries(cur as Record<string, unknown>)) {
          if (KEYS.has(norm(k)) && v) return String(v);
        }
        stack.push(...Object.values(cur as Record<string, unknown>));
      }
    }
  }
  return "";
}