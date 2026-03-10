import "../styles/loader.css";

export default function SystemLoader({ message }) {
  return (
    <div className="sl-root">

      <div className="sl-stripe"><div className="sl-s"/><div className="sl-w"/><div className="sl-g"/></div>
      <div className="sl-glow"/>

      <div className="sl-body">

        <div className="sl-ring-wrap">
          <svg className="sl-svg" viewBox="0 0 120 120">
            <circle className="sl-ring-bg"   cx="60" cy="60" r="52"/>
            <circle className="sl-ring-spin" cx="60" cy="60" r="52"/>
          </svg>
          <div className="sl-icon">🛡️</div>
          <div className="sl-scan"/>
        </div>

        <h2 className="sl-title">Secure Voting System</h2>
        <p className="sl-message">{message || "Initializing secure terminal…"}</p>

        <div className="sl-bar-track">
          <div className="sl-bar-fill"/>
        </div>

        <div className="sl-chips">
          <div className="sl-chip sl-chip--s">🔒 Encrypted</div>
          <div className="sl-chip sl-chip--w">✓ Verified</div>
          <div className="sl-chip sl-chip--g">🗳 Ballot</div>
        </div>

      </div>

      <div className="sl-stripe sl-stripe--btm"><div className="sl-s"/><div className="sl-w"/><div className="sl-g"/></div>

    </div>
  );
}