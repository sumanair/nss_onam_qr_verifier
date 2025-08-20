export function b64UrlToB64(s: string) { return (s || "").replace(/-/g, "+").replace(/_/g, "/"); }
export function b64UrlDecode(s: string) { try { return atob(b64UrlToB64(s)); } catch { return null; } }
export function hexToUtf8(hex: string) {
  try {
    const clean = (hex || "").replace(/[^0-9a-fA-F]/g, "");
    if (!clean || clean.length % 2) return "";
    const bytes = new Uint8Array(clean.match(/.{1,2}/g)!.map((h) => parseInt(h, 16)));
    return new TextDecoder().decode(bytes);
  } catch { return ""; }
}
export function tryRawJson(s?: string) {
  if (!s) return null;
  const t = s.trim();
  if (t.startsWith("{") && t.endsWith("}")) { try { return JSON.parse(t); } catch {} }
  return null;
}
export function tryUrl(s?: string) {
  if (!s || !/^https?:\/\//i.test(s)) return null;
  try {
    const u = new URL(s);
    for (const k of ["data", "payload", "qr", "p"]) {
      const v = u.searchParams.get(k);
      if (!v) continue;
      const cands: string[] = [];
      const b = b64UrlDecode(v); if (b) cands.push(b);
      const h = hexToUtf8(v);   if (h) cands.push(h);
      try { cands.push(decodeURIComponent(v)); } catch {}
      for (const c of cands) { try { return JSON.parse(c); } catch {} }
    }
    const last = u.pathname.split("/").filter(Boolean).pop();
    if (last) {
      const b = b64UrlDecode(last) || last;
      try { return JSON.parse(b); } catch {}
    }
  } catch {}
  return null;
}
export function tryBase64(s?: string) { if (!s) return null; const b = b64UrlDecode(s.trim()); if (!b) return null; try { return JSON.parse(b); } catch { return null; } }
export function tryHex(s?: string)    { if (!s) return null; const h = hexToUtf8(s.trim()); if (!h) return null; try { return JSON.parse(h); } catch { return null; } }
export function decodeToJson(text?: string) { return tryRawJson(text) ?? tryUrl(text) ?? tryBase64(text) ?? tryHex(text) ?? null; }
