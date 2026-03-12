import { useEffect, useState } from "react";
import axios from "axios";
import "../styles/adminMode.css";

import { API } from "../config/api"

export default function AdminMode() {
  const [mode,    setMode]    = useState("TEST");
  const [loading, setLoading] = useState(false);
  const [toast,   setToast]   = useState(null);  // { msg, type }
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    axios.get(`${API}/get-mode`)
      .then(res => setMode(res.data.mode))
      .catch(() => showToast("Could not fetch current mode", "error"));
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const handleToggle = () => {
    if (mode === "TEST") {
      setConfirm(true); // show custom confirm dialog before switching to REAL
    } else {
      doSwitch("TEST");
    }
  };

  const doSwitch = async (newMode) => {
    setConfirm(false);
    setLoading(true);
    try {
      const res = await axios.post(`${API}/set-mode`, { mode: newMode });
      setMode(res.data.mode);
      showToast(
        newMode === "REAL"
          ? "Switched to REAL mode — duplicate votes are now blocked."
          : "Switched to TEST mode — unlimited voting enabled.",
        newMode === "REAL" ? "warn" : "success"
      );
    } catch {
      showToast("Failed to update mode. Check backend.", "error");
    } finally {
      setLoading(false);
    }
  };

  const isReal = mode === "REAL";

  return (
    <div className="am-root">

      {/* Tricolor stripe */}
      <div className="am-stripe">
        <div className="am-stripe-s" />
        <div className="am-stripe-w" />
        <div className="am-stripe-g" />
      </div>

      {/* Ambient glows */}
      <div className="am-glow am-glow--saffron" />
      <div className="am-glow am-glow--green"   />

      {/* ── CONFIRM DIALOG ── */}
      {confirm && (
        <div className="am-overlay">
          <div className="am-dialog">
            <div className="am-dialog-icon">⚠️</div>
            <h2 className="am-dialog-title">Switch to REAL Mode?</h2>
            <p className="am-dialog-body">
              This will activate <strong>official voting</strong>. Double voting
              will be permanently blocked for all registered voters.
              This action affects live election data.
            </p>
            <div className="am-dialog-btns">
              <button className="am-btn-cancel" onClick={() => setConfirm(false)}>
                Cancel
              </button>
              <button className="am-btn-danger" onClick={() => doSwitch("REAL")}>
                Yes, Activate REAL Mode
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div className={`am-toast am-toast--${toast.type}`}>
          <span className="am-toast-icon">
            {toast.type === "success" ? "✓" : toast.type === "warn" ? "⚠" : "✕"}
          </span>
          {toast.msg}
        </div>
      )}

      {/* ── MAIN CARD ── */}
      <main className="am-main">

        {/* Header */}
        <div className="am-header">
          <span className="am-emblem">🇮🇳</span>
          <div>
            <h1 className="am-title">Election Control Panel</h1>
            <p className="am-subtitle">Voting mode management · Admin only</p>
          </div>
        </div>

        {/* Mode badge */}
        <div className={`am-mode-display${isReal ? " am-mode-display--real" : " am-mode-display--test"}`}>
          <div className="am-mode-dot" />
          <span className="am-mode-label">{mode} MODE</span>
          <span className="am-mode-tag">{isReal ? "LIVE" : "TESTING"}</span>
        </div>

        {/* Info row */}
        <div className="am-info-grid">
          <div className={`am-info-card${isReal ? " am-info-card--real" : " am-info-card--test"}`}>
            <span className="am-info-icon">{isReal ? "🔒" : "🧪"}</span>
            <div>
              <div className="am-info-title">
                {isReal ? "Official Voting Active" : "Test Mode Active"}
              </div>
              <div className="am-info-desc">
                {isReal
                  ? "Duplicate votes are blocked. All ballots are official and final."
                  : "Unlimited voting allowed. Results are for testing only."}
              </div>
            </div>
          </div>
        </div>

        {/* Rules */}
        <div className="am-rules">
          <div className={`am-rule${!isReal ? " am-rule--active" : ""}`}>
            <span className="am-rule-dot am-rule-dot--amber" />
            <span><strong>TEST</strong> — Unlimited votes, no restrictions, safe for demos</span>
          </div>
          <div className="am-rule-divider" />
          <div className={`am-rule${isReal ? " am-rule--active" : ""}`}>
            <span className="am-rule-dot am-rule-dot--red" />
            <span><strong>REAL</strong> — Each voter can vote only once, official results</span>
          </div>
        </div>

        {/* Toggle button */}
        <button
          className={`am-toggle-btn${isReal ? " am-toggle-btn--to-test" : " am-toggle-btn--to-real"}`}
          onClick={handleToggle}
          disabled={loading}
        >
          {loading ? (
            <span className="am-spinner" />
          ) : (
            <>
              <span className="am-btn-arrow">{isReal ? "↩" : "→"}</span>
              {isReal ? "Switch to TEST Mode" : "Activate REAL Voting Mode"}
            </>
          )}
        </button>

        {isReal && (
          <p className="am-warning-note">
            ⚠ System is live. Any votes cast are official and irreversible.
          </p>
        )}

      </main>

      {/* Bottom stripe */}
      <div className="am-stripe am-stripe--bottom">
        <div className="am-stripe-s" />
        <div className="am-stripe-w" />
        <div className="am-stripe-g" />
      </div>

    </div>
  );
}