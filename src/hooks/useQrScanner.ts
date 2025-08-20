import { useCallback, useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import type { ScanResultLike } from "../types";

export function useQrScanner(onDecode: (raw: string) => void) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const lastResultRef = useRef<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [flashSupported, setFlashSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const start = useCallback(async () => {
    let deviceId: string | undefined;
    try {
      const cams = await QrScanner.listCameras(true);
      const byLabel = cams.find((c) => /back|rear|environment/i.test(c.label || ""));
      deviceId = (byLabel || cams.at(-1) || { id: undefined }).id;
    } catch { deviceId = undefined; }

    if (!videoRef.current) return;

    const handler = (res: ScanResultLike) => {
      const raw = typeof res === "string" ? res : res?.data || "";
      if (!raw || raw === lastResultRef.current) return; // dedupe
      lastResultRef.current = raw;
      onDecode(raw);
    };

    const scanner = new QrScanner(videoRef.current, handler, {
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
      try { setFlashSupported(!!(await scanner.hasFlash())); } catch { setFlashSupported(false); }
    } catch {
      setIsScanning(false);
    }
  }, [onDecode]);

  const stop = useCallback(async () => {
    const s = scannerRef.current; if (!s) return;
    try { if (flashSupported && torchOn) { try { await s.turnFlashOff(); } catch {} } await s.stop(); }
    finally { s.destroy(); scannerRef.current = null; setIsScanning(false); setTorchOn(false); setFlashSupported(false); }
  }, [flashSupported, torchOn]);

  const toggleFlash = useCallback(async () => {
    const s = scannerRef.current; if (!s || !flashSupported) return;
    try { if (torchOn) { await s.turnFlashOff(); setTorchOn(false); } else { await s.turnFlashOn(); setTorchOn(true); } } catch {}
  }, [flashSupported, torchOn]);

  useEffect(() => () => { stop(); }, [stop]);

  return { videoRef, isScanning, flashSupported, torchOn, start, stop, toggleFlash } as const;
}
