import React, { useState, useRef, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import { Html5Qrcode } from "html5-qrcode";
import axios from "axios";
import "../styles/register.css";
import { API } from "../config/api";

const API_TIMEOUT = 150000;

export default function RegisterPage() {

  const webcamRef = useRef(null);
  const qrRef     = useRef(null);   // Html5Qrcode instance
  const isStopped = useRef(true);   // true = scanner is NOT running
  const timerRef  = useRef(null);

  const [waking,      setWaking]      = useState(true);
  const [wakeMsg,     setWakeMsg]     = useState("Connecting to server…");
  const [wakeFailed,  setWakeFailed]  = useState(false);
  const [wakeElapsed, setWakeElapsed] = useState(0);
  const [serverReady, setServerReady] = useState(false);

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
  const [errorMsg,    setErrorMsg]    = useState(null);
  const [toast,       setToast]       = useState(null);

  const showToast  = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };
  const showError  = (msg) => setErrorMsg(msg);
  const clearError = ()    => setErrorMsg(null);

  // WAKE-UP GATE
  useEffect(() => {
    let attempts = 0;
    const tickTimer = setInterval(() => setWakeElapsed(e => e + 1), 1000);
    const tryWake = async () => {
      attempts++;
      setWakeMsg(attempts === 1 ? "Connecting to server…" : `Waking server… attempt ${attempts}/8`);
      try {
        await axios.get(`${API}/health`, { timeout: 25000 });
        clearInterval(tickTimer);
        setServerReady(true);
        setWaking(false);
      } catch {
        if (attempts < 8) setTimeout(tryWake, 8000);
        else { clearInterval(tickTimer); setWakeFailed(true); setWaking(false); }
      }
    };
    tryWake();
    return () => clearInterval(tickTimer);
  }, []);

  // Safe stop helper - prevents double-stop crash
  const safeStop = useCallback(async () => {
    if (qrRef.current && !isStopped.current) {
      isStopped.current = true;
      try { await qrRef.current.stop(); } catch (_) {}
    }
  }, []);

  // QR SCANNER - THE FIX: await safeStop() BEFORE setStep(2)
  // This ensures scanner is fully stopped before React re-renders and cleanup fires
  useEffect(() => {
    if (!serverReady || step !== 1) return;
    if (!isStopped.current) return; // already running, don't double-start

    const qr = new Html5Qrcode("rg-qr-reader");
    qrRef.current = qr;

    qr.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      async (decoded) => {
        await safeStop();        // stop FIRST
        setQrData(decoded);      // then update state
        showToast("QR scanned ✅", "success");
        setStep(2);              // navigate last
      }
    )
    .then(() => { isStopped.current = false; })
    .catch(() => showError("Camera permission denied. Allow camera access and refresh."));

    return () => { safeStop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverReady, step]);

  const capturePhoto = () => {
    const img = webcamRef.current?.getScreenshot();
    if (!img) { showError("Camera not ready — wait a moment."); return; }
    setCapturedImg(img); setCaptured(true);
    showToast("Photo captured ✅", "success");
  };

  const retakePhoto = () => { setCaptured(false); setCapturedImg(null); clearError(); };

  const resetRegistration = () => {
    setStep(1); setName(""); setGender(""); setAge(""); setQrData("");
    setCaptured(false); setCapturedImg(null);
    clearInterval(timerRef.current);
    setElapsed(0); setSuccessData(null); clearError(); setCamReady(false);
  };

  const detailsValid = name.trim() && gender && age && Number(age) >= 18;

  const submittingLabel = () => {
    if (elapsed < 10)  return "Uploading photo…";
    if (elapsed < 30)  return `Face detection… (${elapsed}s)`;
    if (elapsed < 60)  return `Liveness check… (${elapsed}s)`;
    if (elapsed < 90)  return `Generating ID… (${elapsed}s)`;
    if (elapsed < 130) return `Almost done… (${elapsed}s)`;
    return `Finalising… (${elapsed}s)`;
  };

  const register = async () => {
    clearError();
    if (!capturedImg)  { showError("Please capture your photo first."); return; }
    if (!detailsValid) { showError("Fill all details. Age must be 18+."); return; }

    setSubmitting(true); setElapsed(0);
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
        showError("⚠️ This QR is already registered. Use a different QR code.");
      } else if (s === "liveness_failed") {
        showError(`❌ Liveness failed.\n\n${res.data.message || ""}\n\nTips:\n• Look directly at camera\n• Good lighting\n• Must be live face\n\nRetake and try again.`);
      } else if (s === "no_face_detected") {
        showError("❌ No face detected.\n\nTips:\n• Centre your face\n• Better lighting\n• Move closer\n\nRetake and try again.");
      } else {
        showError(`Registration failed: "${s}". Try again.`);
      }
    } catch (err) {
      if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
        showError("⏳ Timed out.\n\n👉 Click 'Register Voter' again — server is now warmed up.\n\nDo NOT retake photo or re-scan QR.");
      } else if (!navigator.onLine) {
        showError("📵 No internet. Check your connection.");
      } else if (err.response?.status === 500) {
        showError("❌ Server error (500). Check Render logs.");
      } else {
        showError(`❌ ${err.message}\n\nTry clicking Register again.`);
      }
    } finally {
      clearInterval(timerRef.current);
      setSubmitting(false); setElapsed(0);
    }
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  const stepState = (n) => step > n ? "rg-step--done" : step === n ? "rg-step--active" : "";

  if (waking) return (
    <div className="rg-root">
      <div className="rg-wake-screen">
        <div className="rg-wake-spinner"/>
        <div className="rg-wake-title">🗳️ Voter Registration</div>
        <div className="rg-wake-msg">{wakeMsg}</div>
        <div className="rg-wake-bar"><div className="rg-wake-bar-fill"/></div>
        <div className="rg-wake-sub">Render free tier sleeps when idle — please wait ~30s.</div>
        <div className="rg-wake-timer">{wakeElapsed}s</div>
      </div>
    </div>
  );

  if (wakeFailed) return (
    <div className="rg-root">
      <div className="rg-wake-screen">
        <div className="rg-wake-title">⚠️ Server Not Responding</div>
        <div className="rg-wake-msg" style={{color:"#f87171"}}>Could not reach backend after 64 seconds.</div>
        <div className="rg-wake-sub">Check Render dashboard → is the service running? Then refresh.</div>
        <button className="rg-btn-next" style={{marginTop:24}} onClick={() => window.location.reload()}>🔄 Retry</button>
      </div>
    </div>
  );

  return (
    <div className="rg-root">
      <div className="rg-stripe"><div className="rg-s"/><div className="rg-w"/><div className="rg-g"/></div>
      <div className="rg-stripe rg-stripe--btm"><div className="rg-s"/><div className="rg-w"/><div className="rg-g"/></div>
      <div className="rg-glow rg-glow--s"/>
      <div className="rg-glow rg-glow--g"/>

      {toast && <div className={`rg-toast rg-toast--${toast.type}`}>{toast.msg}</div>}

      {errorMsg && (
        <div className="rg-error-box">
          <div className="rg-error-box-content">
            {errorMsg.split("\n").map((line, i) => (
              <p key={i} style={{margin:"3px 0", fontSize: line.startsWith("•") ? "12px" : "14px"}}>{line}</p>
            ))}
          </div>
          <button className="rg-error-box-close" onClick={clearError}>✕ Dismiss</button>
        </div>
      )}

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
              <div>
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
            <button className="rg-success-btn" onClick={resetRegistration}>Register Another Voter →</button>
          </div>
        </div>
      )}

      <div className="rg-wrap">
        <div className="rg-header">
          <div className="rg-header-icon">🗳️</div>
          <div>
            <div className="rg-title">Voter Registration Terminal</div>
            <div className="rg-subtitle">Biometric enrollment · <span style={{color:"#22c55e"}}>Server online ✅</span></div>
          </div>
          <button className="rg-btn-back" style={{marginLeft:"auto"}} onClick={resetRegistration}>🔄 Reset</button>
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

        {step === 2 && (
          <div className="rg-card">
            <div className="rg-card-head">
              <div className="rg-card-icon">🪪</div>
              <div>
                <div className="rg-card-title">Voter Details</div>
                <div className="rg-card-sub">Enter voter information</div>
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
                <input className="rg-input" placeholder="Enter full name" value={name} onChange={e => setName(e.target.value)}/>
              </div>
              <div className="rg-field">
                <label className="rg-label">Age</label>
                <input className="rg-input" type="number" placeholder="Must be 18 or older" value={age} onChange={e => setAge(e.target.value)}/>
                {age && Number(age) < 18 && <span className="rg-field-err">Must be 18 or older</span>}
              </div>
              <div className="rg-field">
                <label className="rg-label">Gender</label>
                <div className="rg-gender-row">
                  {["Male","Female","Other"].map(g => (
                    <button key={g} className={`rg-gender-btn${gender===g?" rg-gender-btn--sel":""}`} onClick={() => setGender(g)}>{g}</button>
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
                onClick={register} disabled={!captured || submitting}
              >
                {submitting ? <><div className="rg-spinner"/>{submittingLabel()}</> : "✅ Register Voter"}
              </button>
            </div>
            {submitting && (
              <div className="rg-status-row">
                <div className="rg-status-dot rg-status-dot--amber"/>
                <span className="rg-status-label">⏳ AI running ({elapsed}s) — takes 30–120s. Do NOT close.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}