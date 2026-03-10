import Webcam from "react-webcam";
import axios from "axios";
import { useRef, useEffect, useState } from "react";
import "../styles/face.css";
import SystemLoader from "../components/SystemLoader";

const API = "https://e-voting-backend-zmxj.onrender.com";

const STATES = {
  init:     { label: "Initializing scanner…",       color: "init" },
  scanning: { label: "Scanning — hold still",       color: "scan" },
  matched:  { label: "Face matched — Welcome!",     color: "success" },
  nomatch:  { label: "No match found — try again",  color: "fail" },
  error:    { label: "Scanner error — retrying…",   color: "fail" },
};

export default function FacePage({ user, setStep }) {
  const webcamRef = useRef(null);

  const [phase,    setPhase]    = useState("init");
  const [loading,  setLoading]  = useState(true);
  const [attempts, setAttempts] = useState(0);
  const [camReady, setCamReady] = useState(false);

  const voter = user?.voter_info || user || {};

  /* Camera init delay */
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(false);
      setPhase("scanning");
    }, 1500);

    return () => clearTimeout(t);
  }, []);

  /* Face polling */
  useEffect(() => {
    if (loading || phase === "matched" || !user) return;

    const interval = setInterval(async () => {
      const img = webcamRef.current?.getScreenshot();
      if (!img) return;

      try {
        const res = await axios.post(
          `${API}/verify-face`,
          {
            qr_string: user.qr_string,
            image: img,
          },
          { timeout: 10000 }
        );

        if (res.data.status === "verified") {
          setPhase("matched");
          clearInterval(interval);

          setTimeout(() => {
            setStep("mode");
          }, 1800);
        } else {
          setPhase("nomatch");
          setAttempts((a) => a + 1);

          setTimeout(() => {
            setPhase("scanning");
          }, 1200);
        }
      } catch (err) {
        console.log("Face verification error:", err);
        setPhase("error");

        setTimeout(() => {
          setPhase("scanning");
        }, 1500);
      }
    }, 2200);

    return () => clearInterval(interval);
  }, [loading, user, setStep]);

  if (loading)
    return <SystemLoader message="Initializing biometric scanner…" />;

  const st = STATES[phase] || STATES.scanning;
  const isSuccess = phase === "matched";
  const isFail = phase === "nomatch" || phase === "error";

  return (
    <div className="fp-root">

      <div className="fp-stripe">
        <div className="fp-stripe-s" />
        <div className="fp-stripe-w" />
        <div className="fp-stripe-g" />
      </div>

      <div className={`fp-glow fp-glow--main${isSuccess ? " fp-glow--success" : isFail ? " fp-glow--fail" : ""}`} />
      <div className="fp-glow fp-glow--secondary" />

      <div className="fp-wrap">

        {/* Header */}
        <div className="fp-header">
          <div className="fp-header-icon">👁️</div>
          <div>
            <h1 className="fp-title">Biometric Face Authentication</h1>
            <p className="fp-subtitle">
              {voter.name
                ? `Verifying identity for ${voter.name}`
                : "Identity verification in progress"}
            </p>
          </div>
        </div>

        {/* Camera */}
        <div className={`fp-cam-wrap${isSuccess ? " fp-cam-wrap--success" : isFail ? " fp-cam-wrap--fail" : ""}`}>

          <div className="fp-corner fp-corner--tl" />
          <div className="fp-corner fp-corner--tr" />
          <div className="fp-corner fp-corner--bl" />
          <div className="fp-corner fp-corner--br" />

          <Webcam
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            width={480}
            audio={false}
            className="fp-webcam"
            onUserMedia={() => setCamReady(true)}
            mirrored={true}
          />

          <div className={`fp-oval${isSuccess ? " fp-oval--success" : isFail ? " fp-oval--fail" : ""}`}>
            <svg viewBox="0 0 200 240" className="fp-oval-svg">
              <ellipse
                cx="100"
                cy="120"
                rx="78"
                ry="100"
                fill="none"
                strokeWidth="2.5"
                strokeDasharray="8 5"
                className="fp-oval-dash"
              />
            </svg>
          </div>

          {phase === "scanning" && <div className="fp-scan-line" />}

          {isSuccess && (
            <div className="fp-success-overlay">
              <div className="fp-success-check">✓</div>
            </div>
          )}

          {isFail && <div className="fp-fail-flash" />}

          {!camReady && (
            <div className="fp-cam-loading">
              <div className="fp-cam-spinner" />
              <span>Starting camera…</span>
            </div>
          )}

          <div className={`fp-live-badge${isSuccess ? " fp-live-badge--ok" : ""}`}>
            <span className="fp-live-dot" />
            {isSuccess ? "VERIFIED" : "LIVE"}
          </div>

        </div>

        {/* Status */}
        <div className={`fp-status fp-status--${st.color}`}>
          <div className="fp-status-dot" />
          <span className="fp-status-text">{st.label}</span>
          {attempts > 0 && !isSuccess && (
            <span className="fp-attempts">
              {attempts} attempt{attempts > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {!isSuccess && (
          <div className="fp-tips">
            <div className="fp-tip">💡 Ensure your face is well-lit</div>
            <div className="fp-tip">🎯 Align face within the oval guide</div>
            <div className="fp-tip">📷 Hold still for accurate detection</div>
          </div>
        )}

        <button className="fp-back-btn" onClick={() => setStep("details")}>
          ← Back to Details
        </button>

      </div>

      <div className="fp-stripe fp-stripe--bottom">
        <div className="fp-stripe-s" />
        <div className="fp-stripe-w" />
        <div className="fp-stripe-g" />
      </div>

    </div>
  );
}