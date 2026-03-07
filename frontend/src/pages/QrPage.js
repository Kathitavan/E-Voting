import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useState } from "react";
import axios from "axios";
import "../styles/qr.css";

const API = "http://127.0.0.1:5000";

export default function QrPage({ setStep, setUser }) {

  const [status, setStatus] = useState("Waiting for QR Scan...");
  const [statusType, setStatusType] = useState("waiting");

  useEffect(() => {

    const qr = new Html5Qrcode("reader");

    qr.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },

      async (decodedText) => {

        setStatus("QR Code Detected");
        setStatusType("scanning");

        await qr.stop();

        try {

          const res = await axios.post(
            `${API}/verify-qr`,
            { qr_data: decodedText }
          );

          if (res.data.status === "success") {

            setStatus("Voter Verified");
            setStatusType("success");

            setUser(res.data);

            setTimeout(() => {
              setStep("details");
            }, 1200);

          } else {

            setStatus("Voter Not Registered");
            setStatusType("error");

          }

        } catch {

          setStatus("Backend Connection Error");
          setStatusType("error");

        }

      }
    );

  }, [setStep, setUser]);

  return (

    <div className="qr-container">

      <h1 className="qr-title">
        QR Identity Verification
      </h1>

      <p className="qr-subtitle">
        Please place the voter QR code inside the scanning frame
      </p>

      <div className="qr-camera-box">

        <div id="reader"></div>

        <div className="qr-frame"></div>
        <div className="qr-scan-line"></div>

      </div>

      <div className="qr-status-box">

        <p className={`qr-status ${statusType}`}>
          {status}
        </p>

      </div>

    </div>

  );
}