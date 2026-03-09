import { useEffect } from "react";
import "../styles/success.css";

export default function VoteSuccessPage({ setStep }) {

  useEffect(() => {

    const timer = setTimeout(() => {
      setStep("qr");
    }, 4000);

    return () => clearTimeout(timer);

  }, [setStep]);

  return (

    <div className="success-container">

      <div className="success-card">

        <div className="success-icon">
          ✔
        </div>

        <h1>Vote Recorded Successfully</h1>

        <p>
          Thank you for participating in the election.
        </p>

        <span className="return-text">
          Returning to home...
        </span>

      </div>

    </div>

  );

}