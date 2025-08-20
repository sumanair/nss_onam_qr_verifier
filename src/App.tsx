import { useEffect, useMemo, useRef, useState } from "react";
import Brand from "./components/Brand";
import LoginForm from "./components/LoginForm";
import SettingsPanel from "./components/SettingsPanel";
import Frame from "./components/Frame";
import Controls from "./components/Controls";
import NumberStepper from "./components/NumberStepper";
import TicketCard from "./components/TicketCard";

import { useQrScanner } from "./hooks/useQrScanner";
import { useLocalStorage } from "./hooks/useLocalStorage";

import { AUTH_STORAGE_KEY, API_KEY_ENV, ENDPOINTS, REQUIRE_KEY } from "./constants";
import { decodeToJson } from "./utils/decoders";
import { findTxnAny } from "./utils/findTxn";
import type { Payload, Summary, CheckinResp } from "./types";
import SummaryCard from "./components/SummaryCard";

import "./styles/theme.css";
import "./styles/login.css";

export default function App() {
  // -------- auth gate --------
  const [authed, setAuthed] = useState(
    typeof window !== "undefined" && localStorage.getItem(AUTH_STORAGE_KEY) === "1"
  );

  // -------- scanner --------
  const [status, setStatus] = useState("Ready. Tap Start and point a code inside the frame.");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [txn, setTxn] = useState("");
  const [continuous, setContinuous] = useState(false);
  const capturedOnceRef = useRef(false);

  const { videoRef, isScanning, flashSupported, torchOn, start, stop, toggleFlash } =
    useQrScanner((raw: string) => {
      // Ignore extra scans in one‑shot mode once we've captured
      if (capturedOnceRef.current && !continuous) return;

      const obj = decodeToJson(raw);
      if (!obj) {
        // Keep scanning on bad/partial reads
        setStatus("Scanned text is not JSON. Still listening…");
        return;
      }

      const main = (obj as any).data ?? obj;
      setPayload(main);

      const t = findTxnAny(main);
      setTxn(t);

      setStatus(t ? "✅ Ticket Information." : "✅ Ticket Information (no transaction id)");

      capturedOnceRef.current = true;

      // One‑shot by default: stop AFTER a successful decode (allow UI to paint first)
      if (!continuous) {
        setTimeout(() => {
          try { stop(); } catch {}
        }, 150);
      }
    });

  // -------- persisted settings --------
  const [verifierId, setVerifierId] = useLocalStorage("nssnt_verifier_id", "");
  const [apiKey, setApiKey] = useLocalStorage("nssnt_api_key", API_KEY_ENV);
  const [note, setNote] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  // -------- camera permission banner --------
  const [camPerm, setCamPerm] = useState<"granted" | "prompt" | "denied" | "unknown">("unknown");
  useEffect(() => {
    (async () => {
      try {
        const perm: any = (navigator as any).permissions
          ? await (navigator.permissions as any).query({ name: "camera" as any })
          : null;
        if (perm) {
          setCamPerm(perm.state as any);
          perm.onchange = () => setCamPerm(perm.state as any);
        } else setCamPerm("unknown");
      } catch {
        setCamPerm("unknown");
      }
    })();
  }, []);
  async function requestCameraPermission() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      s.getTracks().forEach((t) => t.stop());
      setCamPerm("granted");
    } catch {
      setCamPerm("denied");
    }
  }

  // -------- summary --------
  const [summary, setSummary] = useState<Summary | null>(null);
  const [sumLoading, setSumLoading] = useState(false);
  const [sumErr, setSumErr] = useState("");
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!txn) { setSummary(null); setSumErr(""); return; }
      setSumLoading(true); setSumErr("");
      try {
        const r = await fetch(ENDPOINTS.summary(txn), {
          credentials: "include",
          headers: apiKey ? { "X-API-Key": apiKey } : undefined,
        });
        if (!alive) return;
        if (!r.ok) {
          let detail = `Lookup failed (${r.status})`;
          try {
            const d = await r.json();
            if ((d as any)?.detail) detail = (d as any).detail;
          } catch {}
          setSumErr(detail);
          setSummary(null);
          if (r.status === 401) setStatus("⛔ Unauthorized. Enter API key in Settings.");
        } else {
          const data = await r.json();
          setSummary(data as Summary);
        }
      } catch (e: any) {
        if (alive) { setSumErr(e?.message || "Network error"); setSummary(null); }
      } finally {
        if (alive) setSumLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [txn, apiKey]);

  // -------- actions --------
  const purchased = summary?.number_of_attendees ?? 0;
  const checkedIn = summary?.number_checked_in ?? 0;
  const remaining = useMemo(
    () => summary?.remaining ?? Math.max(0, purchased - checkedIn),
    [summary, purchased, checkedIn]
  );

  const [admitCount, setAdmitCount] = useState(1);
  const [undoCount, setUndoCount] = useState(1);
  useEffect(() => {
    setAdmitCount((c) => Math.max(1, Math.min(c, Math.max(1, remaining))));
  }, [remaining]);
  useEffect(() => {
    setUndoCount((c) => Math.max(1, Math.min(c, Math.max(1, checkedIn))));
  }, [checkedIn]);

  const [actionBusy, setActionBusy] = useState(false);
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
        body: JSON.stringify({
          transaction_id: txn,
          delta,
          verifier_id: verifierId || undefined,
          notes: note || undefined,
        }),
      });
      const data: Partial<CheckinResp> & { detail?: string } = await r.json().catch(() => ({} as any));
      if (!r.ok) {
        alert(data?.detail || data?.message || `Update failed (${r.status})`);
      } else if (summary) {
        const checked = data.checked_in ?? summary.number_checked_in;
        const rem = data.remaining ?? Math.max(0, summary.number_of_attendees - checked);
        setSummary({
          ...summary,
          number_checked_in: checked,
          remaining: rem,
          all_attendees_checked_in: rem === 0 && summary.number_of_attendees > 0,
        });
        alert(data?.message || "Updated");
        setAdmitCount(1); setUndoCount(1); setNote("");
      }
    } catch (e: any) {
      alert(e?.message || "Network error");
    } finally {
      setActionBusy(false);
    }
  }

  const startDisabled = !verifierId.trim() || (REQUIRE_KEY && !apiKey.trim());
  function clearAll() {
    setPayload(null); setTxn(""); setSummary(null); setStatus("Cleared.");
    capturedOnceRef.current = false;
  }
  function logout() {
    try { stop(); } catch {}
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthed(false);
    clearAll();
    setAdmitCount(1); setUndoCount(1); setNote("");
    capturedOnceRef.current = false;
  }

  if (!authed) {
    return (
      <div className="wrap">
        <Brand center />
        <LoginForm onAuthed={() => setAuthed(true)} />
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="brand-row">
        <Brand />
        <button
          className="btn btn-outline-gold gear"
          onClick={() => setShowSettings((v) => !v)}
          aria-expanded={showSettings}
        >
          ⚙️ Settings
        </button>
      </div>

      {showSettings && (
        <SettingsPanel
          verifierId={verifierId}
          setVerifierId={setVerifierId}
          apiKey={apiKey}
          setApiKey={setApiKey}
          note={note}
          setNote={setNote}
          onLogout={logout}
        />
      )}

      <Frame videoRef={videoRef} active={isScanning} />

      {camPerm !== "granted" && (
        <div className="perm">
          Camera access required.{" "}
          <button className="btn btn-outline-gold" onClick={requestCameraPermission}>
            Grant camera access
          </button>
        </div>
      )}

      <Controls
        onStart={() => {
          setStatus("Point the QR inside the frame…");
          setPayload(null); setTxn(""); setSummary(null); setNote("");
          capturedOnceRef.current = false; // reset for fresh capture
          start();
        }}
        onStop={stop}
        onClear={clearAll}
        canStart={!startDisabled}
        canStop={!!isScanning}
      />

      <div className="status">
        {status}
        {startDisabled && (
          <span className="warn">
            {" "}
            — {!verifierId.trim() ? "enter Verifier ID" : REQUIRE_KEY ? "enter API key" : ""}
          </span>
        )}
      </div>

      {txn && (
        <div style={{ marginTop: 8 }}>
          <div className="grid gap">{/* reserved for extra summary UI blocks */}</div>
        </div>
      )}

      {txn && (
        <div style={{ marginTop: 0 }}>
          <div className="grid">
            <div className="col">
              <SummaryCard txn={txn} summary={summary} loading={sumLoading} error={sumErr} />
            </div>
          </div>
        </div>
      )}

      {payload && <TicketCard payload={payload} />}

      {summary && !sumLoading && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="row" style={{ marginBottom: 8, gap: 12 }}>
            <label className="toggle">
              <input
                type="checkbox"
                checked={continuous}
                onChange={(e) => setContinuous(e.target.checked)}
              />
              Continuous
            </label>
            <button
              className="btn btn-outline-gold"
              onClick={toggleFlash}
              disabled={!isScanning || !flashSupported}
            >
              💡 Flash {torchOn ? "On" : "Off"}
            </button>
          </div>
        </div>
      )}

      {summary && !sumLoading && (
        <div className="card" style={{ marginTop: 12 }}>
          <div
            className="actions actions-bottom"
            style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}
          >
            <NumberStepper
              value={admitCount}
              setValue={setAdmitCount}
              min={1}
              max={Math.max(1, remaining)}
              label="Admit now"
            />
            <button
              className="btn btn-maroon"
              onClick={() => applyDelta(admitCount)}
              disabled={actionBusy || remaining <= 0}
            >
              ✅ Admit
            </button>
            <button
              className="btn btn-maroon"
              onClick={() => applyDelta(remaining)}
              disabled={actionBusy || remaining <= 0}
            >
              ➡️ Admit All ({remaining})
            </button>
          </div>
        </div>
      )}

      {summary && !sumLoading && (
        <div className="card" style={{ marginTop: 12 }}>
          <div
            className="actions actions-bottom"
            style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}
          >
            <NumberStepper
              value={undoCount}
              setValue={setUndoCount}
              min={1}
              max={Math.max(1, checkedIn)}
              label="Undo"
            />
            <button
              className="btn btn-orange"
              onClick={() => {
                const plural = undoCount > 1 ? "s" : "";
                if (window.confirm(`Are you sure you want to undo ${undoCount} check-in${plural}?`)) {
                  applyDelta(-undoCount);
                }
              }}
              disabled={actionBusy || checkedIn <= 0}
            >
              ↩️ Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
