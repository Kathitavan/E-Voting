import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import { Html5Qrcode } from "html5-qrcode";
import axios from "axios";
import "../styles/register.css";

const API = "http://127.0.0.1:5000";

export default function RegisterPage() {

  const webcamRef = useRef(null);

  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");

  const [qrData, setQrData] = useState("");
  const [qrScanned, setQrScanned] = useState(false);

  const [status, setStatus] = useState("Waiting for QR Scan...");

  useEffect(() => {

    if (!qrScanned) {

      const qr = new Html5Qrcode("qr-reader");

      qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },

        async (decodedText) => {

          await qr.stop();

          setQrData(decodedText);
          setQrScanned(true);
          setStatus("QR Code Verified");

        }

      ).catch(err => console.log(err));
    }

  }, [qrScanned]);

  const register = async () => {

    const image = webcamRef.current?.getScreenshot();

    if (!image) {
      alert("Please capture image");
      return;
    }

    try {

      const res = await axios.post(`${API}/register`, {

        name,
        gender,
        age,
        image,
        qr_data: qrData

      });

      if (res.data.status === "registered") {

        setStatus("Voter Registered Successfully");
        alert("Registered Successfully");

      }

      else if (res.data.status === "already_registered") {

        alert("QR Already Registered");

      }

      else {

        alert("Registration Failed");

      }

    } catch {

      alert("Backend Error");

    }

  };

  return (

    <div className="register-container">

      <h1 className="register-title">
        Voter Registration Terminal
      </h1>

      <div className="register-steps">

        <span className={!qrScanned ? "active-step" : "done-step"}>1 QR</span>
        <span className={qrScanned ? "active-step" : ""}>2 Details</span>
        <span>3 Face</span>

      </div>

      {!qrScanned && (

        <div className="register-card">

          <h2>Scan Voter QR</h2>

          <div className="qr-scanner">

            <div id="qr-reader"></div>
            <div className="scanner-frame"></div>
            <div className="scan-line"></div>

          </div>

          <p className="status-text">{status}</p>

        </div>

      )}

      {qrScanned && (

        <div className="register-card">

          <h2>Enter Voter Details</h2>

          <input
            className="register-input"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            className="register-input"
            placeholder="Gender"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
          />

          <input
            className="register-input"
            type="number"
            placeholder="Age"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />

          <h3 className="capture-title">
            Face Capture
          </h3>

          <Webcam
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            audio={false}
            className="register-webcam"
          />

          <button
            className="register-button"
            onClick={register}
          >
            Register Voter
          </button>

        </div>

      )}

    </div>

  );

}