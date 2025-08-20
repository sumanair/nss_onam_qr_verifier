export function prettyLabel(k: string) {
  const map: Record<string, string> = {
    transaction_id: "Transaction ID",
    payment_date: "Payment Date",
    paid_for: "Paid For",
    early_bird_applied: "Early Bird Applied",
    membership_paid: "Membership Paid",
  };
  return map[k.toLowerCase()] || k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
export function valueOut(v: unknown) {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number")
    return v.toLocaleString(undefined, { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    const d = new Date(v); if (!isNaN(d.getTime())) return d.toLocaleString();
  }
  return String(v ?? "");
}
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
