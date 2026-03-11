import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import { Html5Qrcode } from "html5-qrcode";
import axios from "axios";
import "../styles/register.css";

const API = "https://e-voting-backend-zmxj.onrender.com";
const API_TIMEOUT = 120000;

export default function RegisterPage() {

  const webcamRef = useRef(null);

  const [step,        setStep]        = useState(1);
  const [name,        setName]        = useState("");
  const [gender,      setGender]      = useState("");
  const [age,         setAge]         = useState("");
  const [qrData,      setQrData]      = useState("");
  const [camReady,    setCamReady]    = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [toast,       setToast]       = useState(null);
  const [captured,    setCaptured]    = useState(false);
  const [capturedImg, setCapturedImg] = useState(null);
  const [elapsed,     setElapsed]     = useState(0);
  const timerRef = useRef(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Wake up Render on mount
  useEffect(() => {
    axios.get(`${API}/health`, { timeout: API_TIMEOUT }).catch(() => {});
  }, []);

  // ── QR SCANNER ──────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 1) return;
    const qr = new Html5Qrcode("rg-qr-reader");
    qr.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      async (decoded) => {
        try { await qr.stop(); } catch (_) {}
        setQrData(decoded);
        showToast("QR scanned successfully", "success");
        setStep(2);
      }
    ).catch(() => showToast("Camera permission denied", "error"));
    return () => { qr.stop().catch(() => {}); };
  }, [step]);

  // ── CAPTURE ──────────────────────────────────────────────────────
  const capturePhoto = () => {
    const img = webcamRef.current?.getScreenshot();
    if (!img) { showToast("Camera not ready", "error"); return; }
    setCapturedImg(img);
    setCaptured(true);
    showToast("Photo captured", "success");
  };

  const retakePhoto = () => {
    setCaptured(false);
    setCapturedImg(null);
  };

  // ── RESET ────────────────────────────────────────────────────────
  const resetRegistration = () => {
    setStep(1);
    setName(""); setGender(""); setAge(""); setQrData("");
    setCaptured(false); setCapturedImg(null);
    clearInterval(timerRef.current);
    setElapsed(0);
    showToast("Registration reset", "info");
  };

  // ── VALIDATION ───────────────────────────────────────────────────
  const detailsValid = name.trim() && gender && age && Number(age) >= 18;

  const submittingLabel = () => {
    if (elapsed < 10) return "Registering…";
    if (elapsed < 30) return `Processing biometrics… (${elapsed}s)`;
    if (elapsed < 60) return `Running AI verification… (${elapsed}s)`;
    if (elapsed < 90) return `Almost done… (${elapsed}s)`;
    return `Finalising… (${elapsed}s)`;
  };

  // ── REGISTER ─────────────────────────────────────────────────────
  const register = async () => {
    const image = capturedImg || webcamRef.current?.getScreenshot();
    if (!image)        { showToast("Capture photo first", "error"); return; }
    if (!detailsValid) { showToast("Fill all details correctly", "error"); return; }

    setSubmitting(true);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);

    try {
      const res = await axios.post(
        `${API}/register`,
        { name, gender, age, image, qr_data: qrData },
        { timeout: API_TIMEOUT }
      );

      const s = res.data.status;
      if (s === "registered") {
        showToast("✅ Voter registered successfully!", "success");
        setTimeout(() => resetRegistration(), 2000);
      } else if (s === "already_registered") {
        showToast("This QR is already registered", "error");
      } else if (s === "liveness_failed") {
        showToast(res.data.message || "Liveness check failed — retake photo", "error");
      } else if (s === "no_face_detected") {
        showToast("Face not detected — retake photo in better lighting", "error");
      } else {
        showToast(`Registration failed: ${s}`, "error");
      }
    } catch (err) {
      if (err.code === "ECONNABORTED") {
        showToast("⏳ Server timeout — wait 30s and try again", "error");
      } else if (!navigator.onLine) {
        showToast("No internet connection", "error");
      } else {
        showToast("Server error — check backend logs", "error");
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

  return (
    <div className="rg-root">

      {/* Tricolor stripes */}
      <div className="rg-stripe"><div className="rg-s"/><div className="rg-w"/><div className="rg-g"/></div>
      <div className="rg-stripe rg-stripe--btm"><div className="rg-s"/><div className="rg-w"/><div className="rg-g"/></div>

      {/* Glows */}
      <div className="rg-glow rg-glow--s"/>
      <div className="rg-glow rg-glow--g"/>

      {/* Toast */}
      {toast && (
        <div className={`rg-toast rg-toast--${toast.type}`}>{toast.msg}</div>
      )}

      <div className="rg-wrap">

        {/* Header */}
        <div className="rg-header">
          <div className="rg-header-icon">🗳️</div>
          <div>
            <div className="rg-title">Voter Registration Terminal</div>
            <div className="rg-subtitle">Secure biometric enrollment system</div>
          </div>
          <button
            className="rg-btn-back"
            style={{ marginLeft: "auto" }}
            onClick={resetRegistration}
          >🔄 Reset</button>
        </div>

        {/* Step indicator */}
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

        {/* ── STEP 1 — QR ── */}
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
              <div className="rg-qr-target"/>
              <div className="rg-scan-line"/>
              <div className="rg-live-badge">
                <span className="rg-live-dot"/>SCANNING
              </div>
            </div>

            <div className="rg-status-row">
              <div className="rg-status-dot rg-status-dot--amber"/>
              <span className="rg-status-label">Waiting for QR code…</span>
            </div>
          </div>
        )}

        {/* ── STEP 2 — DETAILS ── */}
        {step === 2 && (
          <div className="rg-card">
            <div className="rg-card-head">
              <div className="rg-card-icon">🪪</div>
              <div>
                <div className="rg-card-title">Voter Details</div>
                <div className="rg-card-sub">Enter the voter's information below</div>
              </div>
            </div>

            {/* QR confirmed banner */}
            <div className="rg-qr-confirmed">
              <span>✅</span>
              <span className="rg-qr-id">
                {qrData.length > 40 ? qrData.slice(0, 40) + "…" : qrData}
              </span>
              <span className="rg-qr-tag">QR OK</span>
            </div>

            <div className="rg-field-group">

              <div className="rg-field">
                <label className="rg-label">Full Name</label>
                <input
                  className="rg-input"
                  placeholder="Enter full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="rg-field">
                <label className="rg-label">Age</label>
                <input
                  className="rg-input"
                  type="number"
                  placeholder="Must be 18 or older"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
                {age && Number(age) < 18 && (
                  <span className="rg-field-err">Voter must be 18 or older</span>
                )}
              </div>

              <div className="rg-field">
                <label className="rg-label">Gender</label>
                <div className="rg-gender-row">
                  {["Male", "Female", "Other"].map(g => (
                    <button
                      key={g}
                      className={`rg-gender-btn${gender === g ? " rg-gender-btn--sel" : ""}`}
                      onClick={() => setGender(g)}
                    >{g}</button>
                  ))}
                </div>
              </div>

            </div>

            <div className="rg-actions-row">
              <button className="rg-btn-back" onClick={() => setStep(1)}>← Back</button>
              <button
                className="rg-btn-next"
                disabled={!detailsValid}
                onClick={() => setStep(3)}
              >Next →</button>
            </div>
          </div>
        )}

        {/* ── STEP 3 — FACE ── */}
        {step === 3 && (
          <div className="rg-card">
            <div className="rg-card-head">
              <div className="rg-card-icon">📸</div>
              <div>
                <div className="rg-card-title">Capture Face</div>
                <div className="rg-card-sub">Look directly at the camera in good lighting</div>
              </div>
            </div>

            {/* Summary */}
            <div className="rg-summary">
              <span className="rg-summary-item">👤 {name}</span>
              <span className="rg-summary-sep">·</span>
              <span className="rg-summary-item">{gender}</span>
              <span className="rg-summary-sep">·</span>
              <span className="rg-summary-item">{age} yrs</span>
            </div>

            {/* Camera / preview */}
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
                  <Webcam
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    mirrored
                    audio={false}
                    onUserMedia={() => setCamReady(true)}
                    className="rg-webcam"
                  />
                  {!camReady && (
                    <div className="rg-cam-loading">
                      <div className="rg-cam-spinner"/>
                      <span>Starting camera…</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Capture / retake */}
            {!captured ? (
              <button
                className="rg-btn-capture"
                onClick={capturePhoto}
                disabled={!camReady}
              >📸 Capture Photo</button>
            ) : (
              <button className="rg-btn-retake" onClick={retakePhoto}>
                🔄 Retake Photo
              </button>
            )}

            {/* Register button + progress */}
            <div className="rg-actions-row">
              <button className="rg-btn-back" onClick={() => setStep(2)}>← Back</button>
              <button
                className={`rg-btn-register${submitting ? " rg-btn-register--loading" : ""}`}
                onClick={register}
                disabled={!captured || submitting}
              >
                {submitting
                  ? <><div className="rg-spinner"/>{submittingLabel()}</>
                  : "✅ Register Voter"
                }
              </button>
            </div>

            {/* Status while submitting */}
            {submitting && (
              <div className="rg-status-row">
                <div className="rg-status-dot rg-status-dot--amber"/>
                <span className="rg-status-label">
                  AI biometric verification running — may take up to 2 minutes on first run
                </span>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}