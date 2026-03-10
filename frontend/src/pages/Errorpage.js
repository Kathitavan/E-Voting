import { useEffect, useState } from "react";
import "../styles/Error.css";

/* ── Error catalogue ── */
const ERRORS = {
  404: {
    code: "404",
    title: "Page Not Found",
    desc: "The page you're looking for doesn't exist or has been moved",
    icon: "🔍",
    accent: "saffron",
    tips: ["Check the URL for typos", "Go back to the home page", "Contact your administrator"],
  },
  403: {
    code: "403",
    title: "Access Forbidden",
    desc: "You don't have permission to access this resource",
    icon: "🚫",
    accent: "red",
    tips: ["Ensure you are logged in", "You may need admin clearance", "Contact election authority"],
  },
  401: {
    code: "401",
    title: "Unauthorized",
    desc: "Authentication is required to access this page",
    icon: "🔐",
    accent: "ashoka",
    tips: ["Please log in and try again", "Your session may have expired", "Re-scan your voter QR code"],
  },
  500: {
    code: "500",
    title: "Internal Server Error",
    desc: "The server encountered an unexpected condition",
    icon: "⚙️",
    accent: "red",
    tips: ["This is a server-side issue", "Try again in a few moments", "Contact technical support"],
  },
  502: {
    code: "502",
    title: "Bad Gateway",
    desc: "The server received an invalid response from backend",
    icon: "🌐",
    accent: "red",
    tips: ["The backend may be restarting", "Try refreshing in 30 seconds", "Check if Flask server is running"],
  },
  503: {
    code: "503",
    title: "Service Unavailable",
    desc: "The server is temporarily unable to handle your request",
    icon: "🛠️",
    accent: "saffron",
    tips: ["System may be under maintenance", "Try again shortly", "Check system status with admin"],
  },
  504: {
    code: "504",
    title: "Gateway Timeout",
    desc: "The server did not receive a timely response from backend",
    icon: "⏱️",
    accent: "saffron",
    tips: ["Backend took too long to respond", "Check your network connection", "Restart the Flask server"],
  },
  offline: {
    code: "---",
    title: "No Connection",
    desc: "You appear to be offline. Please check your internet connection",
    icon: "📡",
    accent: "ashoka",
    tips: ["Check Wi-Fi or LAN connection", "Ensure backend server is reachable", "Try reloading the page"],
  },
};

const ACCENT_VARS = {
  saffron: { color: "#FF9933", dim: "rgba(255,153,51,0.1)", glow: "rgba(255,153,51,0.3)" },
  red: { color: "#ef4444", dim: "rgba(239,68,68,0.1)", glow: "rgba(239,68,68,0.25)" },
  ashoka: { color: "#4169E1", dim: "rgba(65,105,225,0.12)", glow: "rgba(65,105,225,0.25)" },
};

export default function ErrorPage({ code = 404, onRetry, onHome }) {
  const [dots, setDots] = useState(".");

  const err = ERRORS[code] || ERRORS[404];
  const accent = ACCENT_VARS[err.accent];

  /* Animated ellipsis */
  useEffect(() => {
    const t = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 600);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="ep-root"
      style={{
        "--accent": accent.color,
        "--accent-dim": accent.dim,
        "--accent-glow": accent.glow,
      }}
    >
      <div className="ep-stripe">
        <div className="ep-s" />
        <div className="ep-w" />
        <div className="ep-g" />
      </div>

      <div className="ep-glow" />
      <div className="ep-grid" aria-hidden="true" />

      <div className="ep-wrap">
        <div className="ep-code-wrap">
          <div className="ep-code-bg">{err.code}</div>
          <div className="ep-code-fg">{err.code}</div>
        </div>

        <div className="ep-icon">{err.icon}</div>

        <div className="ep-text">
          <h1 className="ep-title">{err.title}</h1>
          {/* FIXED LINE */}
          <p className="ep-desc">
            {err.desc}
            {dots}
          </p>
        </div>

        <div className="ep-divider">
          <div className="ep-div-s" />
          <div className="ep-div-w" />
          <div className="ep-div-g" />
        </div>

        <div className="ep-tips">
          {err.tips.map((tip, i) => (
            <div key={i} className="ep-tip" style={{ animationDelay: `${i * 0.1}s` }}>
              <span className="ep-tip-num">{String(i + 1).padStart(2, "0")}</span>
              <span>{tip}</span>
            </div>
          ))}
        </div>

        <div className="ep-actions">
          {onRetry && (
            <button className="ep-btn ep-btn--accent" onClick={onRetry}>
              ↺ Try Again
            </button>
          )}

          <button
            className={`ep-btn${onRetry ? " ep-btn--outline" : " ep-btn--accent"}`}
            onClick={onHome || (() => (window.location.href = "/"))}
          >
            ← Return to Home
          </button>
        </div>

        <div className="ep-badge">
          <span className="ep-badge-dot" />
          HTTP {err.code} · Secure Voting System
        </div>
      </div>

      <div className="ep-stripe ep-stripe--btm">
        <div className="ep-s" />
        <div className="ep-w" />
        <div className="ep-g" />
      </div>
    </div>
  );
}

/* Named exports */
export const Error404 = (props) => <ErrorPage code={404} {...props} />;
export const Error403 = (props) => <ErrorPage code={403} {...props} />;
export const Error401 = (props) => <ErrorPage code={401} {...props} />;
export const Error500 = (props) => <ErrorPage code={500} {...props} />;
export const Error502 = (props) => <ErrorPage code={502} {...props} />;
export const Error503 = (props) => <ErrorPage code={503} {...props} />;
export const Error504 = (props) => <ErrorPage code={504} {...props} />;
export const ErrorOffline = (props) => <ErrorPage code="offline" {...props} />;