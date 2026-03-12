import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import { Html5Qrcode } from "html5-qrcode";
import axios from "axios";
import "../styles/register.css";

const API         = "https://e-voting-backend-zmxj.onrender.com";
const API_TIMEOUT = 150000; // 2.5 minutes

export default function RegisterPage() {

  const webcamRef = useRef(null);
  const qrRunning = useRef(false);
  const timerRef  = useRef(null);

  // ── SERVER WAKE-UP STATE
  const [serverReady, setServerReady] = useState(false);
  const [waking,      setWaking]      = useState(true);
  const [wakeMsg,     setWakeMsg]     = useState("Connecting to server…");
  const [wakeFailed,  setWakeFailed]  = useState(false);
  const [wakeElapsed, setWakeElapsed] = useState(0);

  // ── REGISTRATION STATE
  const [step,        setStep]        = useState(1);
  const [name,        setName]        = useState("");
  const [gender,      setGender]      = useState("");
  const [age,         setAge]         = useState("");
  const [qrData,      setQrData]      = useState("");
  const [camReady,    setCamReady]    = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [elapsed,     setElapsed]     = useState(0);
  const [captured,    setCaptured]    = useState(false);
  const [capturedImg, setCapturedImg] = useState(null);
  const [successData, setSuccessData] = useState(null);

  // Permanent error — does NOT auto-dismiss, user must read it
  const [errorMsg,  setErrorMsg]  = useState(null);
  // Temporary toast — auto-dismisses for minor info
  const [toast,     setToast]     = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };
  const showError  = (msg) => setErrorMsg(msg);
  const clearError = ()    => setErrorMsg(null);

  // ── WAKE-UP GATE ─────────────────────────────────────────────────
  // Block entire page until server confirms it's alive.
  // Retries every 8 seconds, up to 8 attempts (~64s).
  useEffect(() => {
    let attempts    = 0;
    let elapsed     = 0;
    const tickTimer = setInterval(() => setWakeElapsed(e => e + 1), 1000);

    const tryWake = async () => {
      attempts++;
      setWakeMsg(
        attempts === 1
          ? "Connecting to server…"
          : `Server is waking up… (${elapsed}s elapsed, attempt ${attempts}/8)`
      );
      try {
        await axios.get(`${API}/health`, { timeout: 25000 });
        clearInterval(tickTimer);
        setServerReady(true);
        setWaking(false);
      } catch {
        elapsed += 8;
        if (attempts < 8) {
          setTimeout(tryWake, 8000);
        } else {
          clearInterval(tickTimer);
          setWakeFailed(true);
          setWaking(false);
        }
      }
    };

    tryWake();
    return () => clearInterval(tickTimer);
  }, []);

  // ── QR SCANNER ───────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 1 || !serverReady) return;
    const qr = new Html5Qrcode("rg-qr-reader");
    qr.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      async (decoded) => {
        qrRunning.current = false;
        try { await qr.stop(); } catch (_) {}
        setQrData(decoded);
        showToast("QR scanned successfully ✅", "success");
        setStep(2);
      }
    )
    .then(() => { qrRunning.current = true; })
    .catch(() => showError("Camera permission denied. Please allow camera access and refresh the page."));

    return () => {
      if (qrRunning.current) {
        qrRunning.current = false;
        qr.stop().catch(() => {});
      }
    };
  }, [step, serverReady]);

  const capturePhoto = () => {
    const img = webcamRef.current?.getScreenshot();
    if (!img) { showError("Camera not ready yet. Wait a moment and try again."); return; }
    setCapturedImg(img);
    setCaptured(true);
    showToast("Photo captured ✅", "success");
  };

  const retakePhoto = () => {
    setCaptured(false);
    setCapturedImg(null);
    clearError();
  };

  const resetRegistration = () => {
    setStep(1);
    setName(""); setGender(""); setAge(""); setQrData("");
    setCaptured(false); setCapturedImg(null);
    clearInterval(timerRef.current);
    setElapsed(0); setSuccessData(null);
    clearError();
  };

  const detailsValid = name.trim() && gender && age && Number(age) >= 18;

  const submittingLabel = () => {
    if (elapsed < 10) return "Uploading photo…";
    if (elapsed < 30) return `Face detection running… (${elapsed}s)`;
    if (elapsed < 60) return `Liveness check… (${elapsed}s)`;
    if (elapsed < 90) return `Generating biometric ID… (${elapsed}s)`;
    if (elapsed < 130) return `Almost done… (${elapsed}s)`;
    return `Finalising… (${elapsed}s)`;
  };

  // ── REGISTER ─────────────────────────────────────────────────────
  const register = async () => {
    clearError();
    if (!capturedImg)  { showError("Please capture your photo first."); return; }
    if (!detailsValid) { showError("Please fill all details. Age must be 18 or older."); return; }

    setSubmitting(true);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);

    try {
      const res = await axios.post(
        `${API}/register`,
        { name, gender, age, image: capturedImg, qr_data: qrData },
        { timeout: API_TIMEOUT }
      );

      const s = res.data?.status;

      if (s === "registered") {
        setSuccessData({ name: name.trim(), voterId: res.data.voter_id || "OK", gender, age });

      } else if (s === "already_registered") {
        showError("⚠️ This QR code is already registered.\n\nEach QR code can only be used once. Use a different QR code to register a new voter.");

      } else if (s === "liveness_failed") {
        showError(
          `❌ Liveness check failed.\n\n${res.data.message || "Use live camera, not a photo of a photo."}\n\n` +
          `Tips:\n• Look directly at camera\n• Good lighting (face clearly lit)\n• Don't use a photo of someone else\n\nClick Retake Photo and try again.`
        );

      } else if (s === "no_face_detected") {
        showError(
          "❌ No face detected in photo.\n\n" +
          "Tips:\n• Face must be clearly visible and centred\n• Improve lighting — face should be well-lit\n• Move closer to the camera\n• Don't wear a mask or cover your face\n\nClick Retake Photo and try again."
        );

      } else {
        showError(`Registration failed (status: "${s}").\n\nPlease try again or contact support.`);
      }

    } catch (err) {
      console.error("[register] error:", err);

      if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
        showError(
          "⏳ Server timed out (2.5 min).\n\n" +
          "The Render server went to sleep during the request.\n\n" +
          "👉 Click 'Register Voter' again — it will work faster now that the server is partially awake.\n\n" +
          "You do NOT need to retake your photo or re-scan the QR."
        );
      } else if (!navigator.onLine) {
        showError("📵 No internet connection. Check your network and try again.");
      } else if (err.response?.status === 500) {
        showError("❌ Server error (500). Check Render logs.\n\nUsually means InsightFace crashed — redeploy the backend.");
      } else {
        showError(
          `❌ Error: ${err.message}\n\n` +
          "Please try clicking Register again. If it keeps failing, check the Render dashboard."
        );
      }
    } finally {
      clearInterval(timerRef.current);
      setSubmitting(false);
      setElapsed(0);
    }
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  const stepState = (n) =>
    step > n ? "rg-step--done" : step === n ? "rg-step--active" : "";

  // ── WAKE-UP SCREEN ───────────────────────────────────────────────
  if (waking) return (
    <div className="rg-root">
      <div className="rg-wake-screen">
        <div className="rg-wake-spinner"/>
        <div className="rg-wake-title">🗳️ Voter Registration</div>
        <div className="rg-wake-msg">{wakeMsg}</div>
        <div className="rg-wake-bar"><div className="rg-wake-bar-fill"/></div>
        <div className="rg-wake-sub">
          Render free tier sleeps when idle — first load takes ~30 seconds.<br/>
          Please wait, do not refresh.
        </div>
        <div className="rg-wake-timer">{wakeElapsed}s</div>
      </div>
    </div>
  );

  if (wakeFailed) return (
    <div className="rg-root">
      <div className="rg-wake-screen">
        <div className="rg-wake-title">⚠️ Server Not Responding</div>
        <div className="rg-wake-msg" style={{ color: "#f87171" }}>
          Could not reach the backend after 64 seconds.
        </div>
        <div className="rg-wake-sub">
          1. Check your Render dashboard — is the service running?<br/>
          2. Check for deploy errors in Render logs.<br/>
          3. Then refresh this page.
        </div>
        <button className="rg-btn-next" style={{ marginTop: 24 }}
          onClick={() => window.location.reload()}>
          🔄 Retry Connection
        </button>
      </div>
    </div>
  );

  // ── MAIN UI ──────────────────────────────────────────────────────
  return (
    <div className="rg-root">

      <div className="rg-stripe"><div className="rg-s"/><div className="rg-w"/><div className="rg-g"/></div>
      <div className="rg-stripe rg-stripe--btm"><div className="rg-s"/><div className="rg-w"/><div className="rg-g"/></div>
      <div className="rg-glow rg-glow--s"/>
      <div className="rg-glow rg-glow--g"/>

      {/* Temporary toast */}
      {toast && <div className={`rg-toast rg-toast--${toast.type}`}>{toast.msg}</div>}

      {/* PERMANENT ERROR BOX — stays until dismissed */}
      {errorMsg && (
        <div className="rg-error-box">
          <div className="rg-error-box-content">
            {errorMsg.split("\n").map((line, i) => (
              <p key={i} style={{ margin: "3px 0", fontSize: line.startsWith("•") ? "12px" : "14px" }}>
                {line}
              </p>
            ))}
          </div>
          <button className="rg-error-box-close" onClick={clearError}>✕ Dismiss</button>
        </div>
      )}

      {/* SUCCESS POPUP */}
      {successData && (
        <div className="rg-success-overlay">
          <div className="rg-success-dialog">
            <div className="rg-success-icon">
              <svg viewBox="0 0 80 80" className="rg-success-svg">
                <circle className="rg-success-ring" cx="40" cy="40" r="36"/>
                <polyline className="rg-success-check" points="24,40 35,52 56,28"/>
              </svg>
            </div>
            <h2 className="rg-success-title">Voter Registered! 🎉</h2>
            <p className="rg-success-sub">Registration completed successfully</p>
            <div className="rg-success-card">
              <div className="rg-success-avatar">{successData.name.charAt(0).toUpperCase()}</div>
              <div className="rg-success-info">
                <div className="rg-success-name">{successData.name}</div>
                <div className="rg-success-meta">{successData.gender} · {successData.age} years</div>
                <div className="rg-success-id">ID: {successData.voterId}</div>
              </div>
            </div>
            <div className="rg-success-badges">
              <span className="rg-success-badge rg-success-badge--green">✅ Face Enrolled</span>
              <span className="rg-success-badge rg-success-badge--blue">🔗 QR Linked</span>
              <span className="rg-success-badge rg-success-badge--purple">🔒 Encrypted</span>
            </div>
            <button className="rg-success-btn" onClick={resetRegistration}>
              Register Another Voter →
            </button>
          </div>
        </div>
      )}

      <div className="rg-wrap">

        <div className="rg-header">
          <div className="rg-header-icon">🗳️</div>
          <div>
            <div className="rg-title">Voter Registration Terminal</div>
            <div className="rg-subtitle">Secure biometric enrollment · <span style={{color:"#22c55e"}}>Server online ✅</span></div>
          </div>
          <button className="rg-btn-back" style={{ marginLeft: "auto" }} onClick={resetRegistration}>
            🔄 Reset
          </button>
        </div>

        <div className="rg-steps">
          <div className={`rg-step ${stepState(1)}`}>
            <div className="rg-step-dot">{step > 1 ? "✓" : "1"}</div>
            <span className="rg-step-label">Scan QR</span>
          </div>
          <div className={`rg-step-line ${step > 1 ? "rg-step-line--done" : ""}`}/>
          <div className={`rg-step ${stepState(2)}`}>
            <div className="rg-step-dot">{step > 2 ? "✓" : "2"}</div>
            <span className="rg-step-label">Details</span>
          </div>
          <div className={`rg-step-line ${step > 2 ? "rg-step-line--done" : ""}`}/>
          <div className={`rg-step ${stepState(3)}`}>
            <div className="rg-step-dot">3</div>
            <span className="rg-step-label">Face</span>
          </div>
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div className="rg-card">
            <div className="rg-card-head">
              <div className="rg-card-icon">📱</div>
              <div>
                <div className="rg-card-title">Scan Voter QR Code</div>
                <div className="rg-card-sub">Hold the QR steady inside the frame</div>
              </div>
            </div>
            <div className="rg-scanner-wrap">
              <div className="rg-corner rg-corner--tl"/>
              <div className="rg-corner rg-corner--tr"/>
              <div className="rg-corner rg-corner--bl"/>
              <div className="rg-corner rg-corner--br"/>
              <div id="rg-qr-reader" className="rg-qr-reader"/>
              <div className="rg-scan-line"/>
              <div className="rg-live-badge"><span className="rg-live-dot"/>SCANNING</div>
            </div>
            <div className="rg-status-row">
              <div className="rg-status-dot rg-status-dot--amber"/>
              <span className="rg-status-label">Waiting for QR code…</span>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="rg-card">
            <div className="rg-card-head">
              <div className="rg-card-icon">🪪</div>
              <div>
                <div className="rg-card-title">Voter Details</div>
                <div className="rg-card-sub">Enter the voter's information below</div>
              </div>
            </div>
            <div className="rg-qr-confirmed">
              <span>✅</span>
              <span className="rg-qr-id">{qrData.length > 40 ? qrData.slice(0,40)+"…" : qrData}</span>
              <span className="rg-qr-tag">QR OK</span>
            </div>
            <div className="rg-field-group">
              <div className="rg-field">
                <label className="rg-label">Full Name</label>
                <input className="rg-input" placeholder="Enter full name"
                  value={name} onChange={e => setName(e.target.value)}/>
              </div>
              <div className="rg-field">
                <label className="rg-label">Age</label>
                <input className="rg-input" type="number" placeholder="Must be 18 or older"
                  value={age} onChange={e => setAge(e.target.value)}/>
                {age && Number(age) < 18 && <span className="rg-field-err">Voter must be 18 or older</span>}
              </div>
              <div className="rg-field">
                <label className="rg-label">Gender</label>
                <div className="rg-gender-row">
                  {["Male","Female","Other"].map(g => (
                    <button key={g}
                      className={`rg-gender-btn${gender===g?" rg-gender-btn--sel":""}`}
                      onClick={() => setGender(g)}>{g}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="rg-actions-row">
              <button className="rg-btn-back" onClick={() => setStep(1)}>← Back</button>
              <button className="rg-btn-next" disabled={!detailsValid} onClick={() => setStep(3)}>Next →</button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="rg-card">
            <div className="rg-card-head">
              <div className="rg-card-icon">📸</div>
              <div>
                <div className="rg-card-title">Capture Face</div>
                <div className="rg-card-sub">Look directly at camera in good lighting</div>
              </div>
            </div>
            <div className="rg-summary">
              <span className="rg-summary-item">👤 {name}</span>
              <span className="rg-summary-sep">·</span>
              <span className="rg-summary-item">{gender}</span>
              <span className="rg-summary-sep">·</span>
              <span className="rg-summary-item">{age} yrs</span>
            </div>
            <div className="rg-cam-wrap">
              <div className="rg-corner rg-corner--tl rg-corner--green"/>
              <div className="rg-corner rg-corner--tr rg-corner--green"/>
              <div className="rg-corner rg-corner--bl rg-corner--green"/>
              <div className="rg-corner rg-corner--br rg-corner--green"/>
              {captured ? (
                <>
                  <img src={capturedImg} alt="Captured" className="rg-captured-img"/>
                  <div className="rg-captured-badge">✅ Photo captured</div>
                </>
              ) : (
                <>
                  <Webcam ref={webcamRef} screenshotFormat="image/jpeg" mirrored audio={false}
                    onUserMedia={() => setCamReady(true)} className="rg-webcam"/>
                  {!camReady && <div className="rg-cam-loading"><div className="rg-cam-spinner"/><span>Starting camera…</span></div>}
                </>
              )}
            </div>
            {!captured
              ? <button className="rg-btn-capture" onClick={capturePhoto} disabled={!camReady}>📸 Capture Photo</button>
              : <button className="rg-btn-retake" onClick={retakePhoto}>🔄 Retake Photo</button>
            }
            <div className="rg-actions-row">
              <button className="rg-btn-back" onClick={() => setStep(2)}>← Back</button>
              <button
                className={`rg-btn-register${submitting?" rg-btn-register--loading":""}`}
                onClick={register}
                disabled={!captured || submitting}
              >
                {submitting
                  ? <><div className="rg-spinner"/>{submittingLabel()}</>
                  : "✅ Register Voter"
                }
              </button>
            </div>
            {submitting && (
              <div className="rg-status-row">
                <div className="rg-status-dot rg-status-dot--amber"/>
                <span className="rg-status-label">
                  ⏳ AI running ({elapsed}s) — takes 30–120s. Do NOT close or refresh.
                </span>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}