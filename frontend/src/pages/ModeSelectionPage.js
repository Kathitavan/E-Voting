import "../styles/mode.css";

export default function ModeSelectionPage({ setStep }) {
  return (
    <div className="ms-root">

      {/* Tricolor stripe */}
      <div className="ms-stripe">
        <div className="ms-stripe-s" />
        <div className="ms-stripe-w" />
        <div className="ms-stripe-g" />
      </div>

      {/* Glows */}
      <div className="ms-glow ms-glow--s" />
      <div className="ms-glow ms-glow--b" />
      <div className="ms-glow ms-glow--g" />

      <div className="ms-wrap">

        {/* Header */}
        <div className="ms-header">
          <div className="ms-emblem">🇮🇳</div>
          <h1 className="ms-title">Select Voting Method</h1>
          <p className="ms-subtitle">
            Choose how you would like to cast your vote today.
          </p>
        </div>

        {/* Cards */}
        <div className="ms-cards">

          {/* Normal voting */}
          <button className="ms-card ms-card--normal" onClick={() => setStep("voting")}>
            <div className="ms-card-glow" />
            <div className="ms-card-icon">🗳️</div>
            <div className="ms-card-body">
              <h2 className="ms-card-title">Normal Voting</h2>
              <p className="ms-card-desc">
                Standard touchscreen interface. Tap to select your party and confirm your vote.
              </p>
            </div>
            <div className="ms-card-footer">
              <span className="ms-card-tag ms-card-tag--green">
                <span className="ms-tag-dot" /> Touchscreen
              </span>
              <span className="ms-card-arrow">→</span>
            </div>
          </button>

          {/* Accessible voting */}
          <button className="ms-card ms-card--accessible" onClick={() => setStep("accessible")}>
            <div className="ms-card-glow ms-card-glow--blue" />
            <div className="ms-card-icon">♿</div>
            <div className="ms-card-body">
              <h2 className="ms-card-title">Accessible Voting</h2>
              <p className="ms-card-desc">
                Hands-free voting using head tilt gestures and eye blink detection via webcam.
              </p>
            </div>
            <div className="ms-card-footer">
              <span className="ms-card-tag ms-card-tag--blue">
                <span className="ms-tag-dot" /> Gesture Control
              </span>
              <span className="ms-card-arrow">→</span>
            </div>
          </button>

        </div>

        {/* Footer note */}
        <p className="ms-note">
          🔒 Your vote is encrypted and anonymous. Both methods are equally secure.
        </p>

      </div>

      {/* Bottom stripe */}
      <div className="ms-stripe ms-stripe--bottom">
        <div className="ms-stripe-s" />
        <div className="ms-stripe-w" />
        <div className="ms-stripe-g" />
      </div>

    </div>
  );
}