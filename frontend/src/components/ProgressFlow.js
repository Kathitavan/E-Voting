import "../styles/progress.css";

const STEPS = [
  { key: "qr",       label: "QR Scan",    icon: "📱" },
  { key: "details",  label: "Details",    icon: "🪪" },
  { key: "face",     label: "Face Auth",  icon: "👁️" },
  { key: "mode",     label: "Mode",       icon: "🗂️" },
  { key: "voting",   label: "Vote",       icon: "🗳️" },
];

export default function ProgressFlow({ step }) {
  const currentIndex = STEPS.findIndex(s => s.key === step);

  return (
    <div className="pf-root">
      <div className="pf-track">

        {STEPS.map((s, i) => {
          const isDone   = i < currentIndex;
          const isActive = i === currentIndex;
          const state    = isDone ? "done" : isActive ? "active" : "idle";

          return (
            <div key={s.key} className="pf-item">

              {/* Step node */}
              <div className={`pf-node pf-node--${state}`}>
                <div className={`pf-node-ring pf-node-ring--${state}`} />
                <div className="pf-node-inner">
                  {isDone
                    ? <span className="pf-check">✓</span>
                    : <span className="pf-icon">{s.icon}</span>
                  }
                </div>
                {isActive && <div className="pf-pulse" />}
              </div>

              {/* Label */}
              <span className={`pf-label pf-label--${state}`}>
                {s.label}
              </span>

              {/* Connector line (not after last) */}
              {i < STEPS.length - 1 && (
                <div className={`pf-line pf-line--${isDone ? "done" : "idle"}`}>
                  {isDone && <div className="pf-line-fill" />}
                </div>
              )}

            </div>
          );
        })}

      </div>
    </div>
  );
}