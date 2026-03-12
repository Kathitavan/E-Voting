import { useEffect, useState } from "react";
import "../styles/success.css";

const COUNTDOWN_SEC = 8;

export default function VoteSuccessPage({ setStep, user }) {
  const [count,  setCount]  = useState(COUNTDOWN_SEC);
  const [ripple, setRipple] = useState(false);

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

  const dashOffset = 2 * Math.PI * 40 * (1 - count / COUNTDOWN_SEC);

  // Pull blockchain info from user object (set by VotingPage after /vote response)
  const blockIndex = user?.block_index ?? null;
  const blockHash  = user?.block_hash  ?? null;
  const timestamp  = user?.timestamp   ?? null;

  const shortHash = blockHash
    ? `${blockHash.slice(0, 10)}…${blockHash.slice(-8)}`
    : null;

  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <div className="vs-root">

      {/* Tricolor stripe */}
      <div className="vs-stripe">
        <div className="vs-s"/><div className="vs-w"/><div className="vs-g"/>
      </div>

      {/* Confetti */}
      <div className="vs-confetti" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i}
            className={`vs-particle vs-particle--${i % 3 === 0 ? "s" : i % 3 === 1 ? "g" : "b"}`}
            style={{
              left:              `${(i * 4.1 + 2) % 100}%`,
              animationDelay:    `${(i * 0.18) % 2.4}s`,
              animationDuration: `${1.8 + (i % 5) * 0.3}s`,
            }}
          />
        ))}
      </div>

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

        <div className="vs-text-block">
          <h1 className="vs-title">Vote Recorded!</h1>
          <p className="vs-body">
            Your vote has been securely encrypted and sealed on the blockchain.
            Thank you for participating in India's democracy.
          </p>
        </div>

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
            <span className="vs-stat-icon">⛓</span>
            <span className="vs-stat-label">Blockchain</span>
          </div>
          <div className="vs-stat-sep"/>
          <div className="vs-stat">
            <span className="vs-stat-icon">🇮🇳</span>
            <span className="vs-stat-label">Official</span>
          </div>
        </div>

        {/* ── Blockchain receipt ── */}
        {blockHash && (
          <div className="vs-receipt">
            <div className="vs-receipt__title">
              <span className="vs-receipt__chain-icon">⛓</span>
              Blockchain Receipt
            </div>
            <div className="vs-receipt__rows">
              {blockIndex !== null && (
                <div className="vs-receipt__row">
                  <span className="vs-receipt__key">Block</span>
                  <span className="vs-receipt__val vs-receipt__val--gold">#{blockIndex}</span>
                </div>
              )}
              <div className="vs-receipt__row">
                <span className="vs-receipt__key">Hash</span>
                <span className="vs-receipt__val vs-receipt__val--mono">{shortHash}</span>
              </div>
              {formattedTime && (
                <div className="vs-receipt__row">
                  <span className="vs-receipt__key">Sealed at</span>
                  <span className="vs-receipt__val">{formattedTime}</span>
                </div>
              )}
            </div>
            <div className="vs-receipt__note">
              🔍 Verify your vote in the Blockchain Explorer
            </div>
          </div>
        )}

        {/* Countdown ring */}
        <div className="vs-countdown">
          <div className="vs-cd-wrap">
            <svg width="96" height="96" viewBox="0 0 96 96">
              <circle className="vs-cd-track" cx="48" cy="48" r="40" />
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

        <button className="vs-btn" onClick={() => setStep("qr")}>
          Return to Home Now →
        </button>

      </div>

      <div className="vs-emblem">🇮🇳</div>

      <div className="vs-stripe vs-stripe--btm">
        <div className="vs-s"/><div className="vs-w"/><div className="vs-g"/>
      </div>

    </div>
  );
}