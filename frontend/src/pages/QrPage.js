import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import "../styles/qr.css";
import { API } from "../config/api";


// ── FIX: increased timeout to 90s to handle Render cold-start (was missing entirely)
const API_TIMEOUT = 90000;

const STATUS_MAP = {
  waiting:   { label: "Waiting for QR code…",          color: "waiting"  },
  warming:   { label: "Waking up server, please wait…", color: "waiting"  },
  detected:  { label: "QR Code Detected",               color: "detected" },
  verifying: { label: "Verifying with server…",         color: "detected" },
  success:   { label: "Voter Verified — Redirecting",   color: "success"  },
  unreg:     { label: "Voter Not Registered",            color: "error"    },
  voted:     { label: "Already Voted",                   color: "error"    },
  error:     { label: "Backend Connection Error",        color: "error"    },
};

export default function QrPage({ setStep, setUser }) {
  const [phase,        setPhase]        = useState("waiting");
  const [scannerReady, setScannerReady] = useState(false);

  // ── FIX: ref to prevent duplicate scans firing multiple API calls
  const processingRef = useRef(false);

  // ── FIX: ping backend on mount to wake Render free server BEFORE user scans
  //    This gives the server ~20-30s head start so it's ready when QR is scanned.
  useEffect(() => {
    setPhase("warming");
    axios.get(`${API}/health`, { timeout: API_TIMEOUT })
      .then(() => {
        console.log("[QrPage] Backend is awake");
        setPhase("waiting");
      })
      .catch(() => {
        // Server still sleeping — not a hard error, scanning still works
        // Just let the user scan and the verify-qr call will wait longer
        console.warn("[QrPage] Health ping failed — server may still be cold");
        setPhase("waiting");
      });
  }, []);

  useEffect(() => {
    const qr = new Html5Qrcode("qr-reader");

    qr.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 240, height: 240 } },

      async (decodedText) => {
        // ── FIX: guard against duplicate scan callbacks firing twice
        if (processingRef.current) return;
        processingRef.current = true;

        setPhase("detected");

        try {
          await qr.stop();
        } catch (_) {}

        setPhase("verifying");

        try {
          // ── FIX: 90s timeout instead of no timeout — handles cold Render server
          const res = await axios.post(
            `${API}/verify-qr`,
            { qr_data: decodedText },
            { timeout: API_TIMEOUT }
          );

          const status = res.data.status;

          if (status === "success") {
            setPhase("success");
            setUser(res.data);           // res.data has { status, qr_string, voter_info }
            setTimeout(() => setStep("details"), 1400);

          } else if (status === "already_voted") {
            setPhase("voted");
            processingRef.current = false;

          } else {
            // "not_registered" or anything else
            setPhase("unreg");
            processingRef.current = false;
          }

        } catch (err) {
          console.error("[QrPage] verify-qr error:", err.message);
          // ── FIX: distinguish timeout from other errors for clearer UX
          if (err.code === "ECONNABORTED") {
            setPhase("error");  // timeout — server took too long
          } else {
            setPhase("error");
          }
          processingRef.current = false;
        }
      }
    )
      .then(() => setScannerReady(true))
      .catch(() => setPhase("error"));

    return () => {
      try { qr.isScanning && qr.stop(); } catch (_) {}
    };
  }, [setStep, setUser]);

  const st     = STATUS_MAP[phase] || STATUS_MAP.waiting;
  const isWait = phase === "waiting" || phase === "warming";
  const isOk   = phase === "success";
  const isErr  = phase === "error" || phase === "unreg" || phase === "voted";

  return (
    <div className="qp-root">

      {/* Tricolor stripe */}
      <div className="qp-stripe">
        <div className="qp-s" /><div className="qp-w" /><div className="qp-g" />
      </div>

      <div className="qp-glow qp-glow--top" />
      <div className="qp-glow qp-glow--btm" />

      <div className="qp-wrap">

        <div className="qp-header">
          <div className="qp-header-icon">📱</div>
          <div>
            <h1 className="qp-title">QR Identity Verification</h1>
            <p className="qp-subtitle">Hold your voter QR code steady inside the frame</p>
          </div>
        </div>

        <div className={`qp-scanner-wrap${isOk ? " qp-scanner-wrap--ok" : isErr ? " qp-scanner-wrap--err" : ""}`}>
          <div className="qp-corner qp-corner--tl" />
          <div className="qp-corner qp-corner--tr" />
          <div className="qp-corner qp-corner--bl" />
          <div className="qp-corner qp-corner--br" />

          <div id="qr-reader" className="qp-reader" />

          <div className={`qp-target${isOk ? " qp-target--ok" : isErr ? " qp-target--err" : ""}`} />

          {isWait && <div className="qp-scan-line" />}

          {isOk && (
            <div className="qp-ok-overlay">
              <div className="qp-ok-check">✓</div>
            </div>
          )}

          {isErr && <div className="qp-err-flash" />}

          {/* ── FIX: show spinner while verifying with server (was missing) */}
          {phase === "verifying" && (
            <div className="qp-init-overlay">
              <div className="qp-init-spinner" />
              <span>Verifying with server…</span>
            </div>
          )}

          {!scannerReady && phase === "waiting" && (
            <div className="qp-init-overlay">
              <div className="qp-init-spinner" />
              <span>Starting camera…</span>
            </div>
          )}

          {/* ── FIX: show wake-up overlay so user knows server is starting */}
          {phase === "warming" && (
            <div className="qp-init-overlay">
              <div className="qp-init-spinner" />
              <span>Waking up server…</span>
            </div>
          )}

          <div className={`qp-live${isOk ? " qp-live--ok" : isErr ? " qp-live--err" : ""}`}>
            <span className="qp-live-dot" />
            {isOk ? "VERIFIED" : isErr ? "ERROR" : phase === "verifying" ? "VERIFYING" : "SCANNING"}
          </div>
        </div>

        <div className={`qp-status qp-status--${st.color}`}>
          <div className="qp-status-dot" />
          <span className="qp-status-text">{st.label}</span>
        </div>

        {!isOk && !isErr && phase !== "verifying" && (
          <div className="qp-tips">
            <div className="qp-tip"><span>💡</span> Ensure good lighting on the QR code</div>
            <div className="qp-tip"><span>📐</span> Keep the code flat and fully inside the frame</div>
            <div className="qp-tip"><span>📏</span> Hold 15–25 cm away from the camera</div>
          </div>
        )}

        {isErr && (
          <button className="qp-retry-btn" onClick={() => window.location.reload()}>
            ↺ Try Again
          </button>
        )}

      </div>

      <div className="qp-stripe qp-stripe--btm">
        <div className="qp-s" /><div className="qp-w" /><div className="qp-g" />
      </div>

    </div>
  );
}