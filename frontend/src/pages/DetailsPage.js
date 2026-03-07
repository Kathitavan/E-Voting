import "../styles/details.css";

export default function DetailsPage({ user, setStep }) {

  if (!user) {
    return (
      <div className="details-container">
        <h2>No Voter Data Found</h2>
      </div>
    );
  }

  return (

    <div className="details-container">

      <h1 className="details-title">
        Voter Identity Verification
      </h1>

      <div className="details-card">

        <h2 className="card-title">
          Voter Information
        </h2>

        <div className="info-row">
          <span>QR ID</span>
          <strong>{user.qr_string}</strong>
        </div>

        <div className="info-row">
          <span>Name</span>
          <strong>{user.voter_info.name}</strong>
        </div>

        <div className="info-row">
          <span>Gender</span>
          <strong>{user.voter_info.gender}</strong>
        </div>

        <div className="info-row">
          <span>Age</span>
          <strong>{user.voter_info.age}</strong>
        </div>

        <p className="details-note">
          Please verify your details before biometric authentication.
        </p>

      </div>

      <div className="details-buttons">

        <button
          className="proceed-btn"
          onClick={() => setStep("face")}
        >
          Proceed to Face Authentication
        </button>

        <button
          className="cancel-btn"
          onClick={() => setStep("qr")}
        >
          Cancel
        </button>

      </div>

    </div>

  );
}