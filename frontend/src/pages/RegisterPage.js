import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import { Html5Qrcode } from "html5-qrcode";
import axios from "axios";
import "../styles/register.css";

const API = "https://e-voting-backend-zmxj.onrender.com";

export default function RegisterPage() {
  const webcamRef = useRef(null);

  const [step,       setStep]       = useState(1); // 1=QR, 2=Details, 3=Face
  const [name,       setName]       = useState("");
  const [gender,     setGender]     = useState("");
  const [age,        setAge]        = useState("");
  const [qrData,     setQrData]     = useState("");
  const [camReady,   setCamReady]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast,      setToast]      = useState(null);
  const [captured,   setCaptured]   = useState(false);
  const [capturedImg,setCapturedImg]= useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  /* ── QR scanner ── */
  useEffect(() => {
    if (step !== 1) return;

    const qr = new Html5Qrcode("rg-qr-reader");
    qr.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      async (decoded) => {
        await qr.stop();
        setQrData(decoded);
        showToast("QR scanned — fill in voter details", "info");
        setStep(2);
      }
    ).catch(() => showToast("Camera access denied", "error"));

    return () => { qr.isScanning && qr.stop().catch(() => {}); };
  }, [step]);

  /* ── Capture face ── */
  const capturePhoto = () => {
    const img = webcamRef.current?.getScreenshot();
    if (!img) { showToast("Camera not ready", "error"); return; }
    setCapturedImg(img);
    setCaptured(true);
    showToast("Photo captured successfully", "success");
  };

  const retakePhoto = () => {
    setCaptured(false);
    setCapturedImg(null);
  };

  /* ── Validation ── */
  const detailsValid = name.trim() && gender && age && Number(age) >= 18;

  /* ── Register submit ── */
  const register = async () => {
    const image = capturedImg || webcamRef.current?.getScreenshot();
    if (!image) { showToast("Please capture your photo first", "error"); return; }
    if (!detailsValid) { showToast("Please complete all fields correctly", "error"); return; }

    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/register`, {
        name, gender, age, image, qr_data: qrData,
      });

      if (res.data.status === "registered") {
        showToast("Voter registered successfully!", "success");
        setTimeout(() => {
          setStep(1); setName(""); setGender(""); setAge("");
          setQrData(""); setCaptured(false); setCapturedImg(null);
        }, 2000);
      } else if (res.data.status === "already_registered") {
        showToast("This QR is already registered", "error");
      } else {
        showToast("Registration failed — try again", "error");
      }
    } catch {
      showToast("Backend connection error", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rg-root">

      {/* Tricolor stripe */}
      <div className="rg-stripe">
        <div className="rg-s"/><div className="rg-w"/><div className="rg-g"/>
      </div>

      {/* Glows */}
      <div className="rg-glow rg-glow--s"/>
      <div className="rg-glow rg-glow--g"/>

      {/* Toast */}
      {toast && (
        <div className={`rg-toast rg-toast--${toast.type}`}>
          <span>{toast.type === "success" ? "✓" : toast.type === "info" ? "ℹ" : "✕"}</span>
          {toast.msg}
        </div>
      )}

      <div className="rg-wrap">

        {/* ── Page header ── */}
        <div className="rg-header">
          <div className="rg-header-icon">📋</div>
          <div>
            <h1 className="rg-title">Voter Registration Terminal</h1>
            <p className="rg-subtitle">Official voter enrollment system</p>
          </div>
        </div>

        {/* ── Step indicator ── */}
        <div className="rg-steps">
          {[
            { n: 1, label: "Scan QR",   icon: "📱" },
            { n: 2, label: "Details",   icon: "📝" },
            { n: 3, label: "Face Capture", icon: "📷" },
          ].map(({ n, label, icon }, i, arr) => (
            <React.Fragment key={n}>
              <div className={`rg-step${step === n ? " rg-step--active" : step > n ? " rg-step--done" : ""}`}>
                <div className="rg-step-dot">
                  {step > n ? "✓" : icon}
                </div>
                <span className="rg-step-label">{label}</span>
              </div>
              {i < arr.length - 1 && (
                <div className={`rg-step-line${step > n ? " rg-step-line--done" : ""}`}/>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ══════════════════════════════════
            STEP 1 — QR SCAN
        ══════════════════════════════════ */}
        {step === 1 && (
          <div className="rg-card" key="step1">
            <div className="rg-card-head">
              <span className="rg-card-icon">📱</span>
              <div>
                <h2 className="rg-card-title">Scan Voter QR Code</h2>
                <p className="rg-card-sub">Position the QR card inside the frame</p>
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
                <span className="rg-live-dot"/>&nbsp;SCANNING
              </div>
            </div>

            <div className="rg-status-row">
              <div className="rg-status-dot rg-status-dot--amber"/>
              <span className="rg-status-label">Waiting for QR code…</span>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════
            STEP 2 — DETAILS
        ══════════════════════════════════ */}
        {step === 2 && (
          <div className="rg-card" key="step2">
            <div className="rg-card-head">
              <span className="rg-card-icon">📝</span>
              <div>
                <h2 className="rg-card-title">Voter Information</h2>
                <p className="rg-card-sub">All fields are required</p>
              </div>
            </div>

            {/* QR confirmed */}
            <div className="rg-qr-confirmed">
              <span>✓</span>
              <span className="rg-qr-id">{qrData.slice(0, 28)}{qrData.length > 28 ? "…" : ""}</span>
              <span className="rg-qr-tag">QR Verified</span>
            </div>

            <div className="rg-field-group">

              <div className="rg-field">
                <label className="rg-label">Full Name</label>
                <input
                  className="rg-input"
                  placeholder="e.g. Ramesh Kumar"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div className="rg-field">
                <label className="rg-label">Gender</label>
                <div className="rg-gender-row">
                  {["Male", "Female", "Other"].map(g => (
                    <button
                      key={g}
                      className={`rg-gender-btn${gender === g ? " rg-gender-btn--sel" : ""}`}
                      onClick={() => setGender(g)}
                      type="button"
                    >
                      {g === "Male" ? "♂" : g === "Female" ? "♀" : "⚬"} {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rg-field">
                <label className="rg-label">Age</label>
                <input
                  className="rg-input"
                  type="number"
                  placeholder="Must be 18 or above"
                  value={age}
                  min="18" max="120"
                  onChange={e => setAge(e.target.value)}
                />
                {age && Number(age) < 18 && (
                  <span className="rg-field-err">Voter must be at least 18 years old</span>
                )}
              </div>

            </div>

            <div className="rg-actions-row">
              <button className="rg-btn-back" onClick={() => setStep(1)}>← Back</button>
              <button
                className="rg-btn-next"
                onClick={() => setStep(3)}
                disabled={!detailsValid}
              >
                Next: Face Capture →
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════
            STEP 3 — FACE CAPTURE
        ══════════════════════════════════ */}
        {step === 3 && (
          <div className="rg-card" key="step3">
            <div className="rg-card-head">
              <span className="rg-card-icon">📷</span>
              <div>
                <h2 className="rg-card-title">Biometric Face Capture</h2>
                <p className="rg-card-sub">Look directly at the camera</p>
              </div>
            </div>

            {/* Summary pill */}
            <div className="rg-summary">
              <span className="rg-summary-item">{name}</span>
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
                <img src={capturedImg} alt="Captured" className="rg-captured-img"/>
              ) : (
                <Webcam
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  audio={false}
                  mirrored={true}
                  className="rg-webcam"
                  onUserMedia={() => setCamReady(true)}
                />
              )}

              {captured && (
                <div className="rg-captured-badge">
                  <span>✓</span> Photo Captured
                </div>
              )}

              {!camReady && !captured && (
                <div className="rg-cam-loading">
                  <div className="rg-cam-spinner"/>
                  <span>Starting camera…</span>
                </div>
              )}
            </div>

            {/* Capture / retake */}
            {!captured ? (
              <button
                className="rg-btn-capture"
                onClick={capturePhoto}
                disabled={!camReady}
              >
                📸 Capture Photo
              </button>
            ) : (
              <button className="rg-btn-retake" onClick={retakePhoto}>
                ↺ Retake Photo
              </button>
            )}

            <div className="rg-actions-row">
              <button className="rg-btn-back" onClick={() => setStep(2)}>← Back</button>
              <button
                className={`rg-btn-register${submitting ? " rg-btn-register--loading" : ""}`}
                onClick={register}
                disabled={!captured || submitting}
              >
                {submitting
                  ? <><span className="rg-spinner"/>Registering…</>
                  : "✓ Register Voter"}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Bottom stripe */}
      <div className="rg-stripe rg-stripe--btm">
        <div className="rg-s"/><div className="rg-w"/><div className="rg-g"/>
      </div>

    </div>
  );
}