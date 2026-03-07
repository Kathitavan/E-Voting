import "../styles/mode.css";

export default function ModeSelectionPage({ setStep }) {

  return (

    <div className="mode-container">

      <h1 className="mode-title">
        Select Voting Method
      </h1>

      <p className="mode-subtitle">
        Choose the method you would like to use for casting your vote.
      </p>

      <div className="mode-options">

        <div
          className="mode-card"
          onClick={() => setStep("voting")}
        >
          <div className="mode-icon">🗳</div>

          <h2>Normal Voting</h2>

          <p>
            Standard touchscreen voting interface.
          </p>
        </div>

        <div
          className="mode-card accessible"
          onClick={() => setStep("accessible")}
        >
          <div className="mode-icon">♿</div>

          <h2>Accessible Voting</h2>

          <p>
            Use head movement for hands-free voting.
          </p>
        </div>

      </div>

    </div>

  );
}