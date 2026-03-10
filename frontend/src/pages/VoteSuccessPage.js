import { useEffect, useState } from "react";
import "../styles/success.css";

const COUNTDOWN_SEC = 6;

export default function VoteSuccessPage({ setStep }) {
  const [count,    setCount]    = useState(COUNTDOWN_SEC);
  const [ripple,   setRipple]   = useState(false);

  /* countdown + auto-redirect */
  useEffect(() => {
    setRipple(true);
    const tick = setInterval(() => {
      setCount(c => {
        if (c <= 1) { clearInterval(tick); return 0; }
        return c - 1;
      });
    }, 1000);
    const redirect = setTimeout(() => setStep("qr"), COUNTDOWN_SEC * 1000);
    return () => { clearInterval(tick); clearTimeout(redirect); };
  }, [setStep]);

  const dashOffset = 2 * Math.PI * 40 * (1 - count / COUNTDOWN_SEC); // SVG ring

  return (
    <div className="vs-root">

      {/* Tricolor stripe */}
      <div className="vs-stripe">
        <div className="vs-s"/><div className="vs-w"/><div className="vs-g"/>
      </div>

      {/* Confetti particles */}
      <div className="vs-confetti" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className={`vs-particle vs-particle--${i % 3 === 0 ? "s" : i % 3 === 1 ? "g" : "b"}`}
            style={{
              left:             `${(i * 4.1 + 2) % 100}%`,
              animationDelay:   `${(i * 0.18) % 2.4}s`,
              animationDuration:`${1.8 + (i % 5) * 0.3}s`,
            }}
          />
        ))}
      </div>

      {/* Glow rings */}
      <div className={`vs-glow-ring${ripple ? " vs-glow-ring--active" : ""}`} />
      <div className={`vs-glow-ring vs-glow-ring--2${ripple ? " vs-glow-ring--active" : ""}`} />

      {/* Main card */}
      <div className="vs-card">

        {/* Check icon */}
        <div className="vs-check-wrap">
          <svg className="vs-check-svg" viewBox="0 0 100 100">
            <circle className="vs-check-ring" cx="50" cy="50" r="44" />
            <circle className="vs-check-fill" cx="50" cy="50" r="44" />
          </svg>
          <div className="vs-check-icon">✓</div>
        </div>

        {/* Text */}
        <div className="vs-text-block">
          <h1 className="vs-title">Vote Recorded!</h1>
          <p className="vs-body">
            Your vote has been securely encrypted and counted.
            Thank you for participating in India's democracy.
          </p>
        </div>

        {/* Tricolor divider */}
        <div className="vs-divider">
          <div className="vs-div-s"/><div className="vs-div-w"/><div className="vs-div-g"/>
        </div>

        {/* Stats row */}
        <div className="vs-stats">
          <div className="vs-stat">
            <span className="vs-stat-icon">🔒</span>
            <span className="vs-stat-label">Encrypted</span>
          </div>
          <div className="vs-stat-sep"/>
          <div className="vs-stat">
            <span className="vs-stat-icon">✅</span>
            <span className="vs-stat-label">Counted</span>
          </div>
          <div className="vs-stat-sep"/>
          <div className="vs-stat">
            <span className="vs-stat-icon">🇮🇳</span>
            <span className="vs-stat-label">Official</span>
          </div>
        </div>

        {/* Countdown ring */}
        <div className="vs-countdown">
          <div className="vs-cd-wrap">
            <svg width="96" height="96" viewBox="0 0 96 96">
              <circle className="vs-cd-track"  cx="48" cy="48" r="40" />
              <circle
                className="vs-cd-fill"
                cx="48" cy="48" r="40"
                style={{
                  strokeDasharray:  2 * Math.PI * 40,
                  strokeDashoffset: dashOffset,
                  transform: "rotate(-90deg)",
                  transformOrigin: "center",
                }}
              />
            </svg>
            <div className="vs-cd-inner">
              <span className="vs-cd-num">{count}</span>
              <span className="vs-cd-sec">sec</span>
            </div>
          </div>
          <p className="vs-cd-label">Returning to home screen…</p>
        </div>

        {/* Manual return */}
        <button className="vs-btn" onClick={() => setStep("qr")}>
          Return to Home Now →
        </button>

      </div>

      {/* Emblem */}
      <div className="vs-emblem">🇮🇳</div>

      {/* Bottom stripe */}
      <div className="vs-stripe vs-stripe--btm">
        <div className="vs-s"/><div className="vs-w"/><div className="vs-g"/>
      </div>

    </div>
  );
}