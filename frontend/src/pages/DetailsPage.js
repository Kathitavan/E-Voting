import "../styles/details.css";

export default function DetailsPage({ user, setStep }) {

  // Handle missing or empty user object safely
  if (!user || Object.keys(user).length === 0) {
    return (
      <div className="dp-root">
        <div className="dp-empty">
          <span className="dp-empty-icon">⚠️</span>
          <h2>No Voter Data Found</h2>
          <p>Please scan your QR code first.</p>
        </div>
      </div>
    );
  }

  // Support both backend formats
  const info = user.voter_info || user;

  const genderIcon =
    info.gender?.toLowerCase() === "female" ? "♀" : "♂";

  return (
    <div className="dp-root">

      {/* Tricolor stripe */}
      <div className="dp-stripe">
        <div className="dp-stripe-s" />
        <div className="dp-stripe-w" />
        <div className="dp-stripe-g" />
      </div>

      {/* Ambient glows */}
      <div className="dp-glow dp-glow--s" />
      <div className="dp-glow dp-glow--g" />

      <div className="dp-wrap">

        {/* Header */}
        <div className="dp-header">
          <div className="dp-header-icon">🪪</div>
          <div>
            <h1 className="dp-title">Voter Identity Verification</h1>
            <p className="dp-subtitle">
              Confirm your details before biometric authentication
            </p>
          </div>
        </div>

        {/* Voter card */}
        <div className="dp-card">

          <div className="dp-card-head">
            <div className="dp-avatar">
              {info.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div>
              <div className="dp-voter-name">{info.name || "Unknown"}</div>
              <div className="dp-voter-tag">Registered Voter</div>
            </div>
            <div className="dp-verified-badge">
              <span>✓</span> Verified
            </div>
          </div>

          <div className="dp-divider" />

          <div className="dp-info-grid">

            <div className="dp-info-row">
              <div className="dp-info-label">
                <span className="dp-info-icon">🪪</span>
                QR ID
              </div>
              <div className="dp-info-value dp-info-value--mono">
                {user.qr_string || info.qr_string || "N/A"}
              </div>
            </div>

            <div className="dp-info-row">
              <div className="dp-info-label">
                <span className="dp-info-icon">👤</span>
                Full Name
              </div>
              <div className="dp-info-value">
                {info.name || "Unknown"}
              </div>
            </div>

            <div className="dp-info-row">
              <div className="dp-info-label">
                <span className="dp-info-icon">{genderIcon}</span>
                Gender
              </div>
              <div className="dp-info-value">
                <span
                  className={`dp-gender-badge dp-gender-badge--${info.gender?.toLowerCase() || "unknown"}`}
                >
                  {info.gender || "Unknown"}
                </span>
              </div>
            </div>

            <div className="dp-info-row">
              <div className="dp-info-label">
                <span className="dp-info-icon">🎂</span>
                Age
              </div>
              <div className="dp-info-value">
                {info.age ? `${info.age} years` : "N/A"}
              </div>
            </div>

          </div>

          <div className="dp-divider" />

          <div className="dp-notice">
            <span className="dp-notice-icon">🔒</span>
            <p>
              Your face will be matched against your registered biometric data.
              Please ensure proper lighting before proceeding.
            </p>
          </div>

        </div>

        {/* Action buttons */}
        <div className="dp-actions">
          <button
            className="dp-btn-cancel"
            onClick={() => setStep("qr")}
          >
            ← Back
          </button>

          <button
            className="dp-btn-proceed"
            onClick={() => setStep("face")}
          >
            Proceed to Face Auth →
          </button>
        </div>

        {/* Step indicator */}
        <div className="dp-steps">
          <div className="dp-step dp-step--done">
            <div className="dp-step-dot">✓</div>
            <span>QR Scan</span>
          </div>

          <div className="dp-step-line dp-step-line--done" />

          <div className="dp-step dp-step--active">
            <div className="dp-step-dot">2</div>
            <span>Verify Details</span>
          </div>

          <div className="dp-step-line" />

          <div className="dp-step">
            <div className="dp-step-dot">3</div>
            <span>Face Auth</span>
          </div>

          <div className="dp-step-line" />

          <div className="dp-step">
            <div className="dp-step-dot">4</div>
            <span>Vote</span>
          </div>
        </div>

      </div>

      {/* Bottom stripe */}
      <div className="dp-stripe dp-stripe--bottom">
        <div className="dp-stripe-s" />
        <div className="dp-stripe-w" />
        <div className="dp-stripe-g" />
      </div>

    </div>
  );
}