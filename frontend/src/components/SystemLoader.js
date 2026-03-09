import "../styles/loader.css"

export default function SystemLoader({ message }) {
  return (
    <div className="loader-container">

      <div className="scanner">

        <div className="scanner-circle"></div>

        <div className="scanner-line"></div>

      </div>

      <h2 className="loader-title">
        Secure Voting System
      </h2>

      <p className="loader-message">
        {message || "Initializing secure terminal..."}
      </p>

    </div>
  )
}