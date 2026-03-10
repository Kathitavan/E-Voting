// AccessibleVotingPage.jsx
// Gesture-only voting for accessible voters.
// Uses backend /gesture endpoint (MediaPipe) — no face-api.js.
//
// PHASE 1 — SELECTING
//   Tilt head UP   → move highlight up
//   Tilt head DOWN → move highlight down
//   Hold BLINK 1s  → enter PHASE 2
//
// PHASE 2 — CONFIRMING (full-screen popup)
//   Tilt UP   (hold 400ms) → cast vote
//   Tilt DOWN (hold 400ms) → cancel back to PHASE 1
//   Auto-cancel after 8s
//
// PHASE 3 — CASTING (locked, API fires)

import axios from "axios";
import { useState, useRef, useEffect, useCallback } from "react";
import SystemLoader from "../components/SystemLoader";
import "../styles/accessibleVoting.css";

const API             = "http://127.0.0.1:5000";
const POLL_MS         = 80;      // ~12.5 fps
const BLINK_HOLD_MS   = 1000;    // 1s hold blink → trigger confirm
const NAV_COOLDOWN_MS = 700;     // ms between nav steps
const TILT_HOLD_MS    = 400;     // ms to hold tilt before action fires
const CONFIRM_SEC     = 8;       // auto-cancel countdown

const candidates = [
  { name: "Dravida Munnetra Kazhagam",                tamil: "திராவிட முன்னேற்ற கழகம்",        short: "DMK",  logo: "/party-logos/dmk.png"      },
  { name: "All India Anna Dravida Munnetra Kazhagam", tamil: "அண்ணா திராவிட முன்னேற்ற கழகம்",  short: "ADMK", logo: "/party-logos/admk.png"     },
  { name: "Naam Tamilar Katchi",                      tamil: "நாம் தமிழர் கட்சி",              short: "NTK",  logo: "/party-logos/ntk.png"      },
  { name: "Tamilaga Vettri Kazhagam",                 tamil: "தமிழக வெற்றி கழகம்",             short: "TVK",  logo: "/party-logos/tvk.png"      },
  { name: "Bharatiya Janata Party",                   tamil: "பாரதிய ஜனதா கட்சி",              short: "BJP",  logo: "/party-logos/bjp.png"      },
  { name: "Indian National Congress",                 tamil: "இந்திய தேசிய காங்கிரஸ்",         short: "INC",  logo: "/party-logos/congress.png" },
  { name: "Pattali Makkal Katchi",                    tamil: "பாட்டாளி மக்கள் கட்சி",          short: "PMK",  logo: "/party-logos/pmk.png"      },
  { name: "Amma Makkal Munnetra Kazhagam",            tamil: "அம்மா மக்கள் முன்னேற்ற கழகம்",   short: "AMMK", logo: "/party-logos/ammk.png"     },
  { name: "Makkal Needhi Maiam",                      tamil: "மக்கள் நீதி மையம்",              short: "MNM",  logo: "/party-logos/mnm.png"      },
  { name: "Desiya Murpokku Dravida Kazhagam",         tamil: "தேசிய முற்போக்கு திராவிட கழகம்", short: "DMDK", logo: "/party-logos/dmdk.png"     },
];

const STATUS_META = {
  idle:       { label: "Starting camera…", color: "#475569", icon: "⏳" },
  detecting:  { label: "Face detected",    color: "#00c98d", icon: "✅" },
  navigating: { label: "Navigating…",      color: "#fbbf24", icon: "🔄" },
  blink:      { label: "Hold blink…",      color: "#38bdf8", icon: "👁" },
  no_face:    { label: "No face found",    color: "#f87171", icon: "⚠️" },
};

const CIRC_SMALL = 2 * Math.PI * 20;   // blink ring  r=20, svg 56×56
const CIRC_CD    = 2 * Math.PI * 34;   // countdown   r=34, svg 88×88

export default function AccessibleVotingPage({ user, setStep }) {
  const [loading,          setLoading]          = useState(false);
  const [phase,            setPhase]            = useState("selecting");
  const [selectedIndex,    setSelectedIndex]    = useState(0);
  const [blinkProgress,    setBlinkProgress]    = useState(0);
  const [gestureStatus,    setGestureStatus]    = useState("idle");
  const [confirmCountdown, setConfirmCountdown] = useState(CONFIRM_SEC);
  const [pendingCandidate, setPendingCandidate] = useState(null);
  const [camReady,         setCamReady]         = useState(false);

  const webcamRef         = useRef(null);
  const phaseRef          = useRef("selecting");
  const selectedRef       = useRef(0);
  const blinkStartRef     = useRef(null);
  const navCoolRef        = useRef(0);
  const tiltRef           = useRef({ dir: null, ts: 0 });
  const confirmTimerRef   = useRef(null);
  const countdownRef      = useRef(null);
  const intervalRef       = useRef(null);
  const pendingRef        = useRef(null);

  useEffect(() => { phaseRef.current    = phase;         }, [phase]);
  useEffect(() => { selectedRef.current = selectedIndex; }, [selectedIndex]);

  // ── Webcam ──────────────────────────────────────────────────
  useEffect(() => {
    let stream;
    navigator.mediaDevices
      .getUserMedia({ video: { width: 320, height: 240, facingMode: "user" } })
      .then(s => {
        stream = s;
        if (webcamRef.current) {
          webcamRef.current.srcObject = s;
          webcamRef.current.onloadedmetadata = () => {
            webcamRef.current.play();
            setCamReady(true);
          };
        }
      })
      .catch(() => setGestureStatus("idle"));
    return () => stream?.getTracks().forEach(t => t.stop());
  }, []);

  // ── Auto-scroll selected card ────────────────────────────────
  useEffect(() => {
    document
      .querySelector(`[data-idx="${selectedIndex}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedIndex]);

  // ── Capture frame ────────────────────────────────────────────
  const captureFrame = useCallback(() => {
    const v = webcamRef.current;
    if (!v || v.readyState < 2) return null;
    const c = document.createElement("canvas");
    c.width = 320; c.height = 240;
    c.getContext("2d").drawImage(v, 0, 0, 320, 240);
    return c.toDataURL("image/jpeg", 0.65);
  }, []);

  // ── Cancel confirm ───────────────────────────────────────────
  const cancelConfirm = useCallback(() => {
    clearTimeout(confirmTimerRef.current);
    clearInterval(countdownRef.current);
    pendingRef.current = null;
    setPendingCandidate(null);
    tiltRef.current = { dir: null, ts: 0 };
    blinkStartRef.current = null;
    setBlinkProgress(0);
    setConfirmCountdown(CONFIRM_SEC);
    setPhase("selecting");
  }, []);

  // ── Enter confirm ────────────────────────────────────────────
  const enterConfirm = useCallback(() => {
    const c = candidates[selectedRef.current];
    pendingRef.current = c;
    setPendingCandidate(c);
    tiltRef.current = { dir: null, ts: 0 };
    setConfirmCountdown(CONFIRM_SEC);
    setPhase("confirming");

    confirmTimerRef.current = setTimeout(() => {
      if (phaseRef.current === "confirming") cancelConfirm();
    }, CONFIRM_SEC * 1000);

    let t = CONFIRM_SEC;
    countdownRef.current = setInterval(() => {
      t -= 1;
      setConfirmCountdown(t);
      if (t <= 0) clearInterval(countdownRef.current);
    }, 1000);
  }, [cancelConfirm]);

  // ── Cast vote ────────────────────────────────────────────────
  const castVote = useCallback(async (candidate) => {
    clearTimeout(confirmTimerRef.current);
    clearInterval(countdownRef.current);
    clearInterval(intervalRef.current);
    setPhase("casting");
    setLoading(true);
    try {
      const res = await axios.post(`${API}/vote`, {
        qr_string: user.qr_string,
        candidate: candidate.short,
      });
      if      (res.data.status === "vote_success")  setStep("success");
      else if (res.data.status === "already_voted") { alert("Already voted."); setStep("qr"); }
      else    { alert("Vote failed. Try again."); setLoading(false); }
    } catch {
      alert("Backend error. Try again.");
      setLoading(false);
    }
  }, [user, setStep]);

  // ── Poll gesture ─────────────────────────────────────────────
  const poll = useCallback(async () => {
    const p = phaseRef.current;
    if (p === "casting") return;

    const frame = captureFrame();
    if (!frame) { setGestureStatus("idle"); return; }

    let res;
    try {
      const r = await fetch(`${API}/gesture`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ image: frame }),
        signal:  AbortSignal.timeout(500),
      });
      res = await r.json();
    } catch {
      return;
    }

    if (res.status === "no_face") {
      setGestureStatus("no_face");
      blinkStartRef.current = null;
      setBlinkProgress(0);
      tiltRef.current = { dir: null, ts: 0 };
      return;
    }

    const now = Date.now();

    // ════ PHASE 1: SELECTING ════════════════════════════════════
    if (p === "selecting") {
      if (res.blink) {
        setGestureStatus("blink");
        if (!blinkStartRef.current) blinkStartRef.current = now;
        const held = now - blinkStartRef.current;
        const pct  = Math.min((held / BLINK_HOLD_MS) * 100, 100);
        setBlinkProgress(pct);
        if (held >= BLINK_HOLD_MS) {
          blinkStartRef.current = null;
          setBlinkProgress(0);
          enterConfirm();
        }
        return;
      }

      // Eyes open → reset blink
      blinkStartRef.current = null;
      setBlinkProgress(0);

      if (res.direction !== "neutral") {
        const t = tiltRef.current;
        if (t.dir !== res.direction) {
          tiltRef.current = { dir: res.direction, ts: now };
        } else if (now - t.ts >= TILT_HOLD_MS && now - navCoolRef.current > NAV_COOLDOWN_MS) {
          navCoolRef.current = now;
          tiltRef.current = { dir: null, ts: 0 };
          setGestureStatus("navigating");
          if (res.direction === "up") {
            setSelectedIndex(i => Math.max(0, i - 1));
          } else {
            setSelectedIndex(i => Math.min(candidates.length - 1, i + 1));
          }
        }
      } else {
        tiltRef.current = { dir: null, ts: 0 };
        setGestureStatus("detecting");
      }
    }

    // ════ PHASE 2: CONFIRMING ═══════════════════════════════════
    else if (p === "confirming") {
      if (res.direction !== "neutral") {
        const t = tiltRef.current;
        if (t.dir !== res.direction) {
          tiltRef.current = { dir: res.direction, ts: now };
        } else if (now - t.ts >= TILT_HOLD_MS) {
          tiltRef.current = { dir: null, ts: 0 };
          if (res.direction === "up") {
            castVote(pendingRef.current);
          } else if (res.direction === "down") {
            cancelConfirm();
          }
        }
      } else {
        tiltRef.current = { dir: null, ts: 0 };
      }
    }
  }, [captureFrame, enterConfirm, castVote, cancelConfirm]);

  // ── Start polling when camera ready ─────────────────────────
  useEffect(() => {
    if (!camReady) return;
    intervalRef.current = setInterval(poll, POLL_MS);
    return () => clearInterval(intervalRef.current);
  }, [camReady, poll]);

  if (loading) return <SystemLoader message="Recording your vote securely…" />;

  const meta        = STATUS_META[gestureStatus] || STATUS_META.idle;
  const dashBlink   = CIRC_SMALL * (1 - blinkProgress / 100);
  const dashCD      = CIRC_CD    * (1 - confirmCountdown / CONFIRM_SEC);
  const selCandidate = candidates[selectedIndex];

  return (
    <>
      {/* ══ CONFIRM FULLSCREEN POPUP ═══════════════════════════════ */}
      {phase === "confirming" && pendingCandidate && (
        <div className="av-overlay" role="dialog" aria-modal="true">
          <div className="av-dialog">

            {/* Countdown ring */}
            <div className="av-cd-wrap">
              <svg width="88" height="88" viewBox="0 0 88 88">
                <circle className="av-cd-track" cx="44" cy="44" r="34" />
                <circle
                  className="av-cd-fill"
                  cx="44" cy="44" r="34"
                  style={{
                    strokeDasharray:  CIRC_CD,
                    strokeDashoffset: dashCD,
                  }}
                />
              </svg>
              <div className="av-cd-inner">
                <span className="av-cd-num">{confirmCountdown}</span>
                <span className="av-cd-sec">sec</span>
              </div>
            </div>

            <h2 className="av-dlg-title">Confirm your vote?</h2>

            {/* Party */}
            <div className="av-dlg-party">
              <div className="av-dlg-logo">
                <img src={pendingCandidate.logo} alt={pendingCandidate.short} />
              </div>
              <div className="av-dlg-pinfo">
                <span className="av-dlg-short">{pendingCandidate.short}</span>
                <span className="av-dlg-fullname">{pendingCandidate.name}</span>
                <span className="av-dlg-tamil">{pendingCandidate.tamil}</span>
              </div>
            </div>

            {/* Gesture actions — big, clear */}
            <div className="av-dlg-actions">
              <div className="av-action av-action--yes">
                <div className="av-action-arrow">↑</div>
                <div className="av-action-text">
                  <strong>Tilt UP</strong>
                  <span>to Confirm Vote</span>
                </div>
              </div>
              <div className="av-action-sep" />
              <div className="av-action av-action--no">
                <div className="av-action-arrow">↓</div>
                <div className="av-action-text">
                  <strong>Tilt DOWN</strong>
                  <span>to Cancel</span>
                </div>
              </div>
            </div>

            <p className="av-dlg-note">
              ⚠️ Hold tilt for 0.4s to activate · Auto-cancels in {confirmCountdown}s
            </p>
          </div>
        </div>
      )}

      {/* ══ MAIN LAYOUT ════════════════════════════════════════════ */}
      <div className="av-root">

        {/* ── Top bar ── */}
        <div className="av-topbar">
          <span className="av-tag">♿ ACCESSIBLE MODE</span>
          <h1 className="av-title">Head Gesture Voting</h1>
          <p className="av-subtitle">No touch required — use head movement and blink</p>
        </div>

        <div className="av-body">

          {/* ── Left: Camera + Status ── */}
          <div className="av-cam-col">

            {/* Camera feed */}
            <div className="av-cam-wrap">
              <video ref={webcamRef} autoPlay muted playsInline className="av-cam" />
              <div className="av-cam-badge" style={{ "--c": meta.color }}>
                <span className="av-dot" />
                <span>{meta.icon} {meta.label}</span>
              </div>
            </div>

            {/* Blink progress */}
            <div className="av-blink-section">
              <div className="av-blink-ring">
                <svg width="56" height="56" viewBox="0 0 56 56">
                  <circle className="av-ring-bg"  cx="28" cy="28" r="20" />
                  <circle
                    className="av-ring-fill"
                    cx="28" cy="28" r="20"
                    style={{
                      strokeDasharray:  CIRC_SMALL,
                      strokeDashoffset: dashBlink,
                      stroke: blinkProgress > 0 ? "#38bdf8" : "transparent",
                    }}
                  />
                </svg>
                <span className="av-ring-lbl">
                  {blinkProgress > 0 ? `${Math.round(blinkProgress)}%` : "👁"}
                </span>
              </div>
              <div className="av-blink-info">
                <span className="av-blink-title">
                  {blinkProgress > 0 ? "Keep eyes closed!" : "Hold both eyes closed 1s"}
                </span>
                <span className="av-blink-sub">to select highlighted party</span>
              </div>
            </div>

            {/* Currently highlighted */}
            <div className="av-current">
              <span className="av-current-label">Currently highlighted</span>
              <div className="av-current-card">
                <img src={selCandidate.logo} alt={selCandidate.short} className="av-current-logo" />
                <div>
                  <div className="av-current-short">{selCandidate.short}</div>
                  <div className="av-current-name">{selCandidate.name}</div>
                </div>
              </div>
            </div>

            {/* Instruction legend */}
            <div className="av-legend">
              <div className="av-legend-row">
                <span className="av-legend-arrow av-legend-arrow--up">↑</span>
                <span>Tilt head <strong>UP</strong> — previous party</span>
              </div>
              <div className="av-legend-row">
                <span className="av-legend-arrow av-legend-arrow--down">↓</span>
                <span>Tilt head <strong>DOWN</strong> — next party</span>
              </div>
              <div className="av-legend-row">
                <span className="av-legend-arrow av-legend-arrow--blink">👁</span>
                <span><strong>Hold blink 1s</strong> — open confirm</span>
              </div>
              <div className="av-legend-row">
                <span className="av-legend-arrow av-legend-arrow--up">↑</span>
                <span>In popup: tilt <strong>UP</strong> to confirm</span>
              </div>
              <div className="av-legend-row">
                <span className="av-legend-arrow av-legend-arrow--down">↓</span>
                <span>In popup: tilt <strong>DOWN</strong> to cancel</span>
              </div>
            </div>
          </div>

          {/* ── Right: Candidate list ── */}
          <div className="av-list-col">
            <div className="av-list-head">
              <span>{candidates.length} Parties</span>
              <span>{selectedIndex + 1} / {candidates.length}</span>
            </div>

            <div className="av-list">
              {candidates.map((c, i) => (
                <div
                  key={c.short}
                  data-idx={i}
                  className={`av-card${selectedIndex === i ? " av-card--sel" : ""}`}
                >
                  {/* Position indicator */}
                  <span className="av-card-num">{String(i + 1).padStart(2, "0")}</span>

                  {/* Logo */}
                  <div className="av-card-logo">
                    <img src={c.logo} alt={c.short} />
                  </div>

                  {/* Info */}
                  <div className="av-card-info">
                    <span className="av-card-short">{c.short}</span>
                    <span className="av-card-name">{c.name}</span>
                    <span className="av-card-tamil">{c.tamil}</span>
                  </div>

                  {/* Selected tick */}
                  <div className="av-card-tick">✓</div>

                  {/* Active glow bar */}
                  {selectedIndex === i && <div className="av-card-glow" />}
                </div>
              ))}
            </div>

            {/* Progress dots */}
            <div className="av-dots">
              {candidates.map((_, i) => (
                <div key={i} className={`av-dot-item${selectedIndex === i ? " av-dot-item--on" : ""}`} />
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}