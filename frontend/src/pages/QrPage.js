import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useState } from "react";
import axios from "axios";
import "../styles/qr.css";

const API = "http://127.0.0.1:5000";

const STATUS_MAP = {
  waiting:  { label: "Waiting for QR code…",       color: "waiting"  },
  detected: { label: "QR Code Detected",             color: "detected" },
  success:  { label: "Voter Verified — Redirecting", color: "success"  },
  unreg:    { label: "Voter Not Registered",          color: "error"    },
  error:    { label: "Backend Connection Error",      color: "error"    },
};

export default function QrPage({ setStep, setUser }) {
  const [phase,   setPhase]   = useState("waiting");
  const [scannerReady, setScannerReady] = useState(false);

  useEffect(() => {
    const qr = new Html5Qrcode("qr-reader");

    qr.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 240, height: 240 } },

      async (decodedText) => {
        setPhase("detected");
        await qr.stop();

        try {
          const res = await axios.post(`${API}/verify-qr`, { qr_data: decodedText });

          if (res.data.status === "success") {
            setPhase("success");
            setUser(res.data);
            setTimeout(() => setStep("details"), 1400);
          } else {
            setPhase("unreg");
          }
        } catch {
          setPhase("error");
        }
      }
    ).then(() => setScannerReady(true))
     .catch(() => setPhase("error"));

    return () => {
      qr.isScanning && qr.stop().catch(() => {});
    };
  }, [setStep, setUser]);

  const st      = STATUS_MAP[phase] || STATUS_MAP.waiting;
  const isWait  = phase === "waiting";
  const isOk    = phase === "success";
  const isErr   = phase === "error" || phase === "unreg";

  return (
    <div className="qp-root">

      {/* Tricolor stripe */}
      <div className="qp-stripe">
        <div className="qp-s" /><div className="qp-w" /><div className="qp-g" />
      </div>

      {/* Ambient glows */}
      <div className={`qp-glow qp-glow--top${isOk ? " qp-glow--success" : isErr ? " qp-glow--err" : ""}`} />
      <div className="qp-glow qp-glow--btm" />

      <div className="qp-wrap">

        {/* ── Header ── */}
        <div className="qp-header">
          <div className="qp-header-icon">📱</div>
          <div>
            <h1 className="qp-title">QR Identity Verification</h1>
            <p className="qp-subtitle">Hold your voter QR code steady inside the frame</p>
          </div>
        </div>

        {/* ── Scanner box ── */}
        <div className={`qp-scanner-wrap${isOk ? " qp-scanner-wrap--ok" : isErr ? " qp-scanner-wrap--err" : ""}`}>

          {/* Corner brackets */}
          <div className="qp-corner qp-corner--tl" />
          <div className="qp-corner qp-corner--tr" />
          <div className="qp-corner qp-corner--bl" />
          <div className="qp-corner qp-corner--br" />

          {/* html5-qrcode mounts here */}
          <div id="qr-reader" className="qp-reader" />

          {/* Dashed target square */}
          <div className={`qp-target${isOk ? " qp-target--ok" : isErr ? " qp-target--err" : ""}`} />

          {/* Scan line — only while waiting */}
          {isWait && <div className="qp-scan-line" />}

          {/* Success overlay */}
          {isOk && (
            <div className="qp-ok-overlay">
              <div className="qp-ok-check">✓</div>
            </div>
          )}

          {/* Error overlay */}
          {isErr && <div className="qp-err-flash" />}

          {/* Loading overlay while camera spins up */}
          {!scannerReady && phase === "waiting" && (
            <div className="qp-init-overlay">
              <div className="qp-init-spinner" />
              <span>Starting camera…</span>
            </div>
          )}

          {/* LIVE badge */}
          <div className={`qp-live${isOk ? " qp-live--ok" : isErr ? " qp-live--err" : ""}`}>
            <span className="qp-live-dot" />
            {isOk ? "VERIFIED" : isErr ? "ERROR" : "SCANNING"}
          </div>

        </div>

        {/* ── Status strip ── */}
        <div className={`qp-status qp-status--${st.color}`}>
          <div className="qp-status-dot" />
          <span className="qp-status-text">{st.label}</span>
        </div>

        {/* ── Tips ── */}
        {!isOk && !isErr && (
          <div className="qp-tips">
            <div className="qp-tip"><span>💡</span> Ensure good lighting on the QR code</div>
            <div className="qp-tip"><span>📐</span> Keep the code flat and fully inside the frame</div>
            <div className="qp-tip"><span>📏</span> Hold 15–25 cm away from the camera</div>
          </div>
        )}

        {/* Re-scan on error */}
        {isErr && (
          <button className="qp-retry-btn" onClick={() => window.location.reload()}>
            ↺ Try Again
          </button>
        )}

      </div>

      {/* Bottom stripe */}
      <div className="qp-stripe qp-stripe--btm">
        <div className="qp-s" /><div className="qp-w" /><div className="qp-g" />
      </div>

    </div>
  );
}