export async function sha256Hex(s: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(s);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}