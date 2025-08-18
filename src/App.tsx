import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";

const logoUrl = `${import.meta.env.BASE_URL}nssnt-logo.png`;

type Payload = Record<string, unknown>;
type ScanResultLike = string | { data?: string };

type Summary = {
  username: string;
  email: string;
  number_of_attendees: number;
  number_checked_in: number;
};

const HIDE_KEYS = new Set(["transaction_id", "transactionid", "txn", "txid"]);
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const API_KEY_ENV = import.meta.env.VITE_VERIFIER_API_KEY || "";         // optional default
const REQUIRE_KEY = String(import.meta.env.VITE_REQUIRE_API_KEY || "false").toLowerCase() === "true";

/** Backend endpoints */
const ENDPOINTS = {
  summary: (txn: string) =>
    `${API_BASE}/api/attendance/summary?transaction_id=${encodeURIComponent(txn)}`,
  update: `${API_BASE}/api/checkin`, // POST { transaction_id, delta, verifier_id? }
};

/* ---------- Decoders ---------- */
function b64UrlToB64(s: string){ return (s || "").replace(/-/g, "+").replace(/_/g, "/"); }
function b64UrlDecode(s: string){ try{ return atob(b64UrlToB64(s)); }catch{ return null; } }
function hexToUtf8(hex: string){
  try{
    const clean = (hex || "").replace(/[^0-9a-fA-F]/g, "");
    if (!clean || clean.length % 2) return "";
    const bytes = new Uint8Array(clean.match(/.{1,2}/g)!.map(h => parseInt(h, 16)));
    return new TextDecoder().decode(bytes);
  }catch{ return ""; }
}
function tryRawJson(s?: string){ if(!s) return null; const t=s.trim(); if(t.startsWith("{")&&t.endsWith("}")){ try{ return JSON.parse(t);}catch{} } return null; }
function tryUrl(s?: string){
  if(!s || !/^https?:\/\//i.test(s)) return null;
  try{
    const u = new URL(s);
    for (const k of ["data","payload","qr","p"]) {
      const v = u.searchParams.get(k);
      if (!v) continue;
      const cands: string[] = [];
      const b = b64UrlDecode(v); if (b) cands.push(b);
      const h = hexToUtf8(v);    if (h) cands.push(h);
      cands.push(decodeURIComponent(v));
      for (const c of cands) { try { return JSON.parse(c); } catch {} }
    }
    const last = u.pathname.split("/").filter(Boolean).pop();
    if (last) {
      const b = b64UrlDecode(last) || last;
      try { return JSON.parse(b); } catch {}
    }
  }catch{}
  return null;
}
function tryBase64(s?: string){ if(!s) return null; const b=b64UrlDecode(s.trim()); if(!b) return null; try{ return JSON.parse(b);}catch{return null} }
function tryHex(s?: string){ if(!s) return null; const h=hexToUtf8(s.trim()); if(!h) return null; try{ return JSON.parse(h);}catch{return null} }
function decodeToJson(text?: string){ return tryRawJson(text) ?? tryUrl(text) ?? tryBase64(text) ?? tryHex(text) ?? null; }

function findTxnAny(obj: unknown): string {
  const norm = (s: string) => s.toLowerCase().replace(/\s|_/g,"");
  const KEYS = new Set(["transactionid","transaction_id","txn","txid"]);
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

function prettyLabel(k: string){
  const map: Record<string,string> = {
    transaction_id: "Transaction ID",
    payment_date: "Payment Date",
    paid_for: "Paid For",
    early_bird_applied: "Early Bird Applied",
    membership_paid: "Membership Paid",
  };
  return map[k.toLowerCase()] || k.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
}

function valueOut(v: unknown){
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return v.toLocaleString(undefined, { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    const d = new Date(v); if (!isNaN(d.getTime())) return d.toLocaleString();
  }
  return String(v ?? "");
}

/* ---------- App ---------- */
export default function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const lastResultRef = useRef<string>("");
  const [status, setStatus] = useState("Ready. Tap Start and point a code inside the frame.");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [txn, setTxn] = useState("");
  const [flashSupported, setFlashSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [continuous, setContinuous] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Verifier ID (persisted)
  const [verifierId, setVerifierId] = useState<string>("");
  // API key (persisted)
  const [apiKey, setApiKey] = useState<string>("");

  // Settings UI
  const [showSettings, setShowSettings] = useState(false);

  // Bootstrap from localStorage / env / URL (?vid= & ?k=)
  useEffect(() => {
    const savedVid = localStorage.getItem("nssnt_verifier_id") || "";
    const savedKey = localStorage.getItem("nssnt_api_key") || API_KEY_ENV || "";

    let vid = savedVid;
    let key = savedKey;

    try {
      const u = new URL(window.location.href);
      const qVid = u.searchParams.get("vid");
      const qKey = u.searchParams.get("k");
      if (qVid) vid = qVid;
      if (qKey) key = qKey;
      if (qVid || qKey) {
        if (qVid) u.searchParams.delete("vid");
        if (qKey) u.searchParams.delete("k");
        history.replaceState(null, "", u.toString());
      }
    } catch {}

    setVerifierId(vid);
    setApiKey(key);
    if (vid) localStorage.setItem("nssnt_verifier_id", vid);
    if (key) localStorage.setItem("nssnt_api_key", key);
  }, []);

  function updateVerifierId(v: string) {
    setVerifierId(v);
    localStorage.setItem("nssnt_verifier_id", v || "");
  }
  function updateApiKey(v: string) {
    setApiKey(v);
    localStorage.setItem("nssnt_api_key", v || "");
  }

  // Camera permission helper
  const [camPerm, setCamPerm] = useState<"granted" | "prompt" | "denied" | "unknown">("unknown");
  async function requestCameraPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(t => t.stop());
      setCamPerm("granted");
    } catch {
      setCamPerm("denied");
    }
  }
  useEffect(() => {
    (async () => {
      try {
        const perm: any = (navigator as any).permissions
          ? await (navigator.permissions as any).query({ name: "camera" as any })
          : null;
        if (perm) {
          setCamPerm(perm.state as any);
          perm.onchange = () => setCamPerm(perm.state as any);
        } else {
          setCamPerm("unknown");
        }
      } catch {
        setCamPerm("unknown");
      }
    })();
  }, []);

  // DB summary UI state
  const [summary, setSummary] = useState<Summary | null>(null);
  const [sumLoading, setSumLoading] = useState(false);
  const [sumErr, setSumErr] = useState<string>("");

  // Action controls
  const [admitCount, setAdmitCount] = useState(1);
  const [undoCount, setUndoCount] = useState(1);
  const [actionBusy, setActionBusy] = useState(false);

  // Start camera
  async function start() {
    setStatus("Initializing camera…");
    setPayload(null); setTxn(""); lastResultRef.current = "";
    setTorchOn(false); setFlashSupported(false);
    setSummary(null); setSumErr(""); setAdmitCount(1); setUndoCount(1);

    // prefer rear camera
    let deviceId: string | undefined;
    try {
      const cams = await QrScanner.listCameras(true);
      const byLabel = cams.find(c => /back|rear|environment/i.test(c.label || ""));
      deviceId = (byLabel || cams.at(-1) || { id: undefined }).id;
    } catch {
      deviceId = undefined;
    }

    const onDecode = (res: ScanResultLike) => {
      const raw = typeof res === "string" ? res : (res?.data || "");
      if (!raw || raw === lastResultRef.current) return; // dedupe
      lastResultRef.current = raw;

      const obj = decodeToJson(raw);
      if (!obj) { setStatus("Scanned text is not JSON."); if (!continuous) stop(); return; }

      const main = (obj as any).data ?? obj;
      setPayload(main);
      const t = findTxnAny(main);
      setTxn(t);
      setStatus(t ? "✅ Decoded." : "✅ Decoded (no transaction id)");
      if (!continuous) stop();
    };

    if (!videoRef.current) return;
    const scanner = new QrScanner(videoRef.current, onDecode, {
      preferredCamera: deviceId,
      returnDetailedScanResult: true,
      highlightScanRegion: true,
      highlightCodeOutline: true,
      maxScansPerSecond: 18,
    });
    scannerRef.current = scanner;

    try {
      videoRef.current.setAttribute("playsinline", "");
      videoRef.current.muted = true;
      await scanner.start();
      setIsScanning(true);
      setStatus("Point the QR inside the frame…");

      try {
        const supported = await scanner.hasFlash();
        setFlashSupported(!!supported);
        if (!supported) setTorchOn(false);
      } catch {
        setFlashSupported(false);
      }
    } catch (err) {
      console.error(err);
      setStatus("❌ Camera access denied or not available.");
    }
  }

  async function stop() {
    const s = scannerRef.current;
    if (!s) return;
    try {
      if (flashSupported && torchOn) { try { await s.turnFlashOff(); } catch {} }
      await s.stop();
    } finally {
      s.destroy(); scannerRef.current = null; setStatus("");
      setTorchOn(false);
      setIsScanning(false);
    }
  }

  async function toggleFlash() {
    const s = scannerRef.current;
    if (!s || !flashSupported) return;
    try {
      if (torchOn) { await s.turnFlashOff(); setTorchOn(false); }
      else { await s.turnFlashOn(); setTorchOn(true); }
    } catch {}
  }

  // Load DB summary when we have a txn
  useEffect(() => {
    let alive = true;
    async function run() {
      if (!txn) { setSummary(null); setSumErr(""); return; }
      setSumLoading(true); setSumErr("");
      try {
        const r = await fetch(ENDPOINTS.summary(txn), {
          credentials: "include",
          headers: apiKey ? { "X-API-Key": apiKey } : undefined,
        });
        if (!alive) return;
        if (!r.ok) {
          const data = await r.json().catch(()=>null);
          const detail = data?.detail || `Lookup failed (${r.status})`;
          setSumErr(detail);
          setSummary(null);
          // Helpful hint if unauthorized
          if (r.status === 401) setStatus("⛔ Unauthorized. Enter API key in Settings.");
        } else {
          const data = await r.json();
          setSummary(data as Summary);
          setAdmitCount(1);
          setUndoCount(1);
        }
      } catch (e: any) {
        if (alive) { setSumErr(e?.message || "Network error"); setSummary(null); }
      } finally {
        if (alive) setSumLoading(false);
      }
    }
    run();
    return () => { alive = false; };
  }, [txn, apiKey]);

  // Perform a check-in delta and refresh summary
  async function applyDelta(delta: number) {
    if (!txn || delta === 0) return;
    setActionBusy(true);
    try {
      const r = await fetch(ENDPOINTS.update, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "X-API-Key": apiKey } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ transaction_id: txn, delta, verifier_id: verifierId || undefined }),
      });
      const data = await r.json().catch(()=> ({}));
      if (!r.ok) {
        alert(data?.detail || data?.message || `Update failed (${r.status})`);
      } else {
        // re-fetch summary to reflect latest counts
        const ref = await fetch(ENDPOINTS.summary(txn), {
          credentials: "include",
          headers: apiKey ? { "X-API-Key": apiKey } : undefined,
        });
        if (ref.ok) setSummary(await ref.json());
        alert(data?.message || "Updated");
      }
    } catch (e: any) {
      alert(e?.message || "Network error");
    } finally {
      setActionBusy(false);
    }
  }

  useEffect(() => () => { stop(); }, []);

  const fields = payload ? Object.entries(payload)
    .filter(([k]) => !HIDE_KEYS.has(k.toLowerCase()))
    : [];

  const purchased = summary?.number_of_attendees ?? 0;
  const checkedIn = summary?.number_checked_in ?? 0;
  const remaining = Math.max(0, purchased - checkedIn);

  const startDisabled = !verifierId.trim() || (REQUIRE_KEY && !apiKey.trim());

  return (
    <div className="wrap">
      {/* Brand */}
      <header className="brand">
        <img className="logo" src={logoUrl} alt="NSSNT logo" />
        <div className="brand-meta">
          <h1 className="brand-title">NSSNT Verifier</h1>
          <div className="brand-sub">Attendance Check-In</div>
        </div>

        <button className="gear" onClick={() => setShowSettings(v => !v)} aria-expanded={showSettings}>
          ⚙️ Settings
        </button>
      </header>

      {/* Settings panel */}
      {showSettings && (
        <div className="settings">
          <div className="row">
            <label className="lbl">Verifier ID</label>
            <input
              className="inp"
              type="text"
              placeholder="e.g., frontdesk-1"
              value={verifierId}
              onChange={e => updateVerifierId(e.target.value)}
            />
          </div>
          <div className="row">
            <label className="lbl">API Key {REQUIRE_KEY ? "(required)" : "(optional)"}</label>
            <input
              className="inp"
              type="password"
              placeholder="paste key"
              value={apiKey}
              onChange={e => updateApiKey(e.target.value)}
            />
          </div>
          <div className="row small">
            Tip: You can auto-provision with URL params like <code>?vid=frontdesk-1&amp;k=KEY</code>.
          </div>
        </div>
      )}

      {/* Scanner frame */}
      <div className={`frame ${isScanning ? "active" : ""}`}>
        <video ref={videoRef} muted playsInline />
        {/* decorative corners (grey) */}
        <div className="corner tl" /><div className="corner tr" />
        <div className="corner bl" /><div className="corner br" />
        {/* fancy overlay while scanning */}
        {isScanning && <div className="scanline" aria-hidden="true" />}
        {isScanning && <div className="glow" aria-hidden="true" />}
      </div>

      {/* Permission banner (shows until granted) */}
      {camPerm !== "granted" && (
        <div className="perm">
          Camera access required.{" "}
          <button onClick={requestCameraPermission}>Grant camera access</button>
        </div>
      )}

      {/* Controls */}
      <div className="controls">
        <button onClick={start} disabled={startDisabled}>🎥 Start</button>
        <button onClick={stop} disabled={!scannerRef.current}>⏹️ Stop</button>
        <button onClick={() => { setPayload(null); setTxn(""); setSummary(null); setStatus("Cleared."); }}>🧹 Clear</button>
        <label className="toggle">
          <input type="checkbox" checked={continuous} onChange={e=>setContinuous(e.target.checked)} />
          Continuous
        </label>
        <button onClick={toggleFlash} disabled={!scannerRef.current || !flashSupported}>
          💡 Flash {torchOn ? "On" : "Off"}
        </button>
      </div>

      <div className="status">
        {status}
        {startDisabled && (
          <span className="warn">
            {" "}— { !verifierId.trim() ? "enter Verifier ID" : REQUIRE_KEY ? "enter API key" : "" }
          </span>
        )}
      </div>

      {/* DB Summary */}
      {txn && (
        <div className="card">
          <div className="card-head">
            <strong>Transaction:</strong> <code>{txn}</code>
          </div>

          {sumLoading && <div className="muted">Looking up purchase…</div>}
          {sumErr && <div className="error">⛔ {sumErr}</div>}

          {summary && !sumLoading && (
            <>
              <div className="metrics">
                <div className="metric">
                  <div className="m-title">Purchased</div>
                  <div className="m-value">{purchased}</div>
                </div>
                <div className="metric">
                  <div className="m-title">Checked-in</div>
                  <div className="m-value">{checkedIn}</div>
                </div>
                <div className="metric">
                  <div className="m-title">Remaining</div>
                  <div className="m-value">{remaining}</div>
                </div>
              </div>

              <div className="actions">
                <label className="nbox">
                  Admit now
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, remaining)}
                    value={admitCount}
                    onChange={e => setAdmitCount(Math.max(1, Math.min(remaining || 1, Number(e.target.value) || 1)))}
                  />
                </label>
                <button
                  onClick={() => applyDelta(admitCount)}
                  disabled={actionBusy || remaining <= 0}
                >
                  ✅ Admit
                </button>

                <label className="nbox">
                  Undo
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, checkedIn)}
                    value={undoCount}
                    onChange={e => setUndoCount(Math.max(1, Math.min(checkedIn || 1, Number(e.target.value) || 1)))}
                  />
                </label>
                <button
                  onClick={() => applyDelta(-undoCount)}
                  disabled={actionBusy || checkedIn <= 0}
                >
                  ↩️ Undo
                </button>

                <button
                  onClick={() => applyDelta(remaining)}
                  disabled={actionBusy || remaining <= 0}
                >
                  ➡️ Admit All ({remaining})
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Decoded JSON table */}
      {payload && (
        <>
          <h2>✅ Decoded</h2>
          <table className="result">
            <tbody>
            {fields.map(([k, v]) => (
              <tr key={k}>
                <th>{prettyLabel(k)}</th>
                <td>{valueOut(v)}</td>
              </tr>
            ))}
            </tbody>
          </table>
        </>
      )}

      <style>{`
        :root{
          --accent: #f4b000;      /* NSSNT yellow */
          --accent-2: #ff9d00;    /* warm orange accent */
          --corner: #b9b9b9;      /* grey corners */
          --bg-soft: #fffdf5;
          --bg-metric: #fafafa;
          --danger: #a40000;
        }

        .wrap { font-family: system-ui, Segoe UI, Roboto, Helvetica, Arial; padding: max(16px, env(safe-area-inset-top)) 16px 24px; max-width: 980px; margin: 0 auto; }

        .brand { display:flex; align-items:center; gap:12px; margin-bottom: 12px; }
        .logo { height: 40px; width:auto; object-fit: contain; }
        .brand-title { margin:0; font-size: 1.15rem; line-height: 1.2; }
        .brand-sub { color:#666; font-size:.92rem; }
        .gear { margin-left:auto; padding:8px 10px; border:1px solid #ddd; border-radius:10px; background:#fff; cursor:pointer; }

        .settings { border:1px solid #eee; border-radius:12px; padding:12px; margin:10px 0 6px; background:#fff; }
        .settings .row { display:flex; gap:10px; align-items:center; margin:6px 0; flex-wrap:wrap; }
        .settings .row.small { color:#666; font-size:.9rem; }
        .lbl { width:110px; color:#444; }
        .inp { flex:1 1 260px; min-width:220px; padding:8px 10px; border:1px solid #ddd; border-radius:8px; }

        .frame { position: relative; width: 100%; aspect-ratio: 3/4; background:#000; border-radius: 14px; box-shadow: 0 4px 14px rgba(0,0,0,.15); overflow:hidden; }
        .frame.active { box-shadow: 0 0 0 2px var(--accent), 0 8px 18px rgba(0,0,0,.18); }
        video { width:100%; height:100%; object-fit: cover; }

        /* Decorative corners (grey) */
        .corner { position:absolute; width:18%; height:18%; border:3px solid var(--corner); border-radius:14px; pointer-events:none; }
        .tl{top:4%;left:4%;border-right:none;border-bottom:none;}
        .tr{top:4%;right:4%;border-left:none;border-bottom:none;}
        .bl{bottom:4%;left:4%;border-right:none;border-top:none;}
        .br{bottom:4%;right:4%;border-left:none;border-top:none;}

        /* Fancy scanning overlay (yellow while active) */
        .scanline {
          position:absolute; left:6%; right:6%;
          height: 3px; top: 10%;
          background: linear-gradient(90deg, transparent, var(--accent-2), var(--accent), var(--accent-2), transparent);
          filter: drop-shadow(0 0 4px rgba(244,176,0,.75));
          animation: sweep 2.4s linear infinite;
          border-radius: 2px;
          opacity: .95;
        }
        @keyframes sweep {
          0% { top: 10%; }
          100% { top: 86%; }
        }
        .glow {
          position:absolute; inset:0;
          background: radial-gradient(120% 30% at 50% 10%, rgba(244,176,0,.20), transparent),
                      radial-gradient(120% 30% at 50% 90%, rgba(244,176,0,.16), transparent);
          pointer-events:none;
        }

        .perm { margin: 10px 0; color:#444; background:#fff8e1; border:1px solid #ffe3a3; padding:8px 10px; border-radius:10px; display:flex; gap:10px; align-items:center; }
        .perm button { padding:6px 10px; border-radius:8px; border:1px solid #ddd; background:#fff; cursor:pointer; }

        .controls { display:flex; gap:10px; margin:12px 0; align-items:center; flex-wrap:wrap; }
        .controls button { padding:10px 14px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer; }
        .controls button:disabled { opacity:.6; cursor:not-allowed; }
        .toggle { display:flex; gap:6px; align-items:center; font-size: 14px; color:#444; }

        .status { color:#444; margin-bottom:6px; min-height:1.25rem; }
        .status .warn { color:#a46000; }

        .card { border:1px solid #eee; border-radius:12px; padding:12px; margin:10px 0 16px; background:#fff; }
        .card-head { font-size:.95rem; margin-bottom:8px; color:#333; }
        .muted { color:#666; }
        .error { color:#a40000; }

        .metrics { display:flex; gap:10px; flex-wrap:wrap; margin: 6px 0 4px; }
        .metric { flex:1 1 140px; border:1px solid #eee; border-radius:12px; padding:12px; background: var(--bg-metric); }
        .m-title { color:#666; font-size:.85rem; }
        .m-value { font-size:1.25rem; font-weight:700; }

        .actions { display:flex; gap:8px; align-items:flex-end; flex-wrap:wrap; margin-top:8px; }
        .nbox { display:flex; flex-direction:column; gap:4px; font-size:.9rem; color:#444; }
        .nbox input { width:90px; padding:8px 10px; border:1px solid #ddd; border-radius:8px; }

        table.result { width:100%; border-collapse: collapse; }
        table.result th, table.result td { border:1px solid #eee; padding:10px 12px; }
        table.result th { background:#fffbe6; text-align:left; white-space:nowrap; width:18%; }
        table.result td { background:var(--bg-soft); overflow-wrap:anywhere; }
      `}</style>
    </div>
  );
}
