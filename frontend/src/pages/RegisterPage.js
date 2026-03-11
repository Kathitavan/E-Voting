import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import { Html5Qrcode } from "html5-qrcode";
import axios from "axios";
import "../styles/register.css";

const API = "https://e-voting-backend-zmxj.onrender.com";

// ── FIX: 120s timeout — InsightFace on cold Render free server takes 60-120s.
//    The old 30s timeout was the root cause of "never completes" — Axios was
//    throwing a timeout error which showed the toast briefly then dismissed,
//    making it look like still loading while actually it had silently failed.
const API_TIMEOUT = 120000;

export default function RegisterPage() {

  const webcamRef = useRef(null);

  const [step,         setStep]        = useState(1);
  const [name,         setName]        = useState("");
  const [gender,       setGender]      = useState("");
  const [age,          setAge]         = useState("");
  const [qrData,       setQrData]      = useState("");
  const [camReady,     setCamReady]    = useState(false);
  const [submitting,   setSubmitting]  = useState(false);
  const [toast,        setToast]       = useState(null);
  const [captured,     setCaptured]    = useState(false);
  const [capturedImg,  setCapturedImg] = useState(null);

  // ── FIX: track elapsed time so user sees progress, not a frozen button
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── FIX: wake up Render server when RegisterPage mounts (same as QrPage)
  useEffect(() => {
    axios.get(`${API}/health`, { timeout: API_TIMEOUT }).catch(() => {});
  }, []);

  /* QR SCANNER */
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

  /* CAPTURE PHOTO */
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

  /* RESET */
  const resetRegistration = () => {
    setStep(1);
    setName(""); setGender(""); setAge(""); setQrData("");
    setCaptured(false); setCapturedImg(null);
    clearInterval(timerRef.current);
    setElapsed(0);
    showToast("Registration reset", "info");
  };

  /* VALIDATION */
  const detailsValid = name.trim() && gender && age && Number(age) >= 18;

  // ── FIX: label for submitting button shows elapsed time so user knows it's working
  const submittingLabel = () => {
    if (elapsed < 10)  return "Registering…";
    if (elapsed < 30)  return `Processing biometrics… (${elapsed}s)`;
    if (elapsed < 60)  return `Running AI verification… (${elapsed}s)`;
    if (elapsed < 90)  return `Almost done… (${elapsed}s)`;
    return `Finalising… (${elapsed}s)`;
  };

  /* REGISTER */
  const register = async () => {
    const image = capturedImg || webcamRef.current?.getScreenshot();
    if (!image)        { showToast("Capture photo first",         "error"); return; }
    if (!detailsValid) { showToast("Fill all details correctly",  "error"); return; }

    setSubmitting(true);
    setElapsed(0);

    // ── FIX: start elapsed-time counter so UI updates every second
    timerRef.current = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);

    try {
      const res = await axios.post(
        `${API}/register`,
        { name, gender, age, image, qr_data: qrData },
        { timeout: API_TIMEOUT }   // ── FIX: was 30000, now 120000
      );

      const status = res.data.status;

      if (status === "registered") {
        showToast("✅ Voter registered successfully!", "success");
        setTimeout(() => resetRegistration(), 2000);

      } else if (status === "already_registered") {
        showToast("This QR is already registered", "error");

      } else if (status === "liveness_failed") {
        showToast(res.data.message || "Liveness check failed — retake photo", "error");

      } else if (status === "no_face_detected") {
        showToast("Face not detected — retake photo in better lighting", "error");

      } else {
        showToast(`Registration failed: ${status}`, "error");
      }

    } catch (err) {
      console.error("[RegisterPage] register error:", err.message);

      // ── FIX: specific messages per error type instead of generic "Server error"
      if (err.code === "ECONNABORTED") {
        showToast(
          "⏳ Server is taking too long (cold start). Please wait 30s and try again.",
          "error"
        );
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

  // Clean up timer on unmount
  useEffect(() => () => clearInterval(timerRef.current), []);

  return (
    <div className="rg-root">

      {toast && (
        <div className={`rg-toast rg-toast--${toast.type}`}>
          {toast.msg}
        </div>
      )}

      <div className="rg-wrap">

        <div className="rg-header">
          <h1>Voter Registration Terminal</h1>
          <button className="rg-refresh-btn" onClick={resetRegistration}>
            🔄 Reset
          </button>
        </div>

        {/* STEP 1 — QR */}
        {step === 1 && (
          <div className="rg-card">
            <h2>Step 1 — Scan QR Code</h2>
            <div id="rg-qr-reader" />
          </div>
        )}

        {/* STEP 2 — DETAILS */}
        {step === 2 && (
          <div className="rg-card">
            <h2>Step 2 — Voter Details</h2>

            <input
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              type="number"
              placeholder="Age (18+)"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />

            <div className="rg-gender-row">
              <button
                className={`rg-gender-btn${gender === "Male"   ? " rg-gender-btn--active" : ""}`}
                onClick={() => setGender("Male")}
              >Male</button>
              <button
                className={`rg-gender-btn${gender === "Female" ? " rg-gender-btn--active" : ""}`}
                onClick={() => setGender("Female")}
              >Female</button>
              <button
                className={`rg-gender-btn${gender === "Other"  ? " rg-gender-btn--active" : ""}`}
                onClick={() => setGender("Other")}
              >Other</button>
            </div>

            {/* ── FIX: show what QR was scanned so admin can confirm it's correct */}
            <p className="rg-qr-preview">
              📷 QR: <code>{qrData.length > 40 ? qrData.slice(0, 40) + "…" : qrData}</code>
            </p>

            <button
              className="rg-btn rg-btn--primary"
              disabled={!detailsValid}
              onClick={() => setStep(3)}
            >
              Next →
            </button>
          </div>
        )}

        {/* STEP 3 — FACE */}
        {step === 3 && (
          <div className="rg-card">
            <h2>Step 3 — Capture Face</h2>

            {captured ? (
              <img src={capturedImg} alt="Captured face" className="rg-preview-img" />
            ) : (
              <Webcam
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                mirrored
                audio={false}
                onUserMedia={() => setCamReady(true)}
                className="rg-webcam"
              />
            )}

            <div className="rg-btn-row">
              {!captured ? (
                <button
                  className="rg-btn rg-btn--secondary"
                  onClick={capturePhoto}
                  disabled={!camReady}
                >
                  📸 Capture
                </button>
              ) : (
                <button className="rg-btn rg-btn--ghost" onClick={retakePhoto}>
                  🔄 Retake
                </button>
              )}

              <button
                className="rg-btn rg-btn--primary"
                onClick={register}
                disabled={!captured || submitting}
              >
                {submitting ? submittingLabel() : "✅ Register Voter"}
              </button>
            </div>

            {/* ── FIX: progress bar shown during submission so user knows it's working */}
            {submitting && (
              <div className="rg-progress-wrap">
                <div className="rg-progress-bar" />
                <p className="rg-progress-note">
                  AI biometric verification running on server — this can take up to 2 minutes on first run.
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}