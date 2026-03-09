import Webcam from "react-webcam";
import axios from "axios";
import { useRef, useEffect, useState } from "react";
import "../styles/face.css";
import SystemLoader from "../components/SystemLoader";

const API = "http://127.0.0.1:5000";

export default function FacePage({ user, setStep }) {

  const webcamRef = useRef(null);

  const [status, setStatus] = useState("Initializing Camera...");
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  // show loader for a short time while camera initializes
  useEffect(() => {

    const timer = setTimeout(() => {
      setLoading(false);
      setStatus("Scanning Face...");
    }, 1500);

    return () => clearTimeout(timer);

  }, []);

  useEffect(() => {

    if (loading) return;

    const interval = setInterval(async () => {

      const imageSrc = webcamRef.current?.getScreenshot();
      if (!imageSrc) return;

      try {

        const res = await axios.post(`${API}/verify-face`, {
          qr_string: user.qr_string,
          image: imageSrc
        });

        if (res.data.status === "verified") {

          setStatus("Face Verified Successfully");
          setVerified(true);

          clearInterval(interval);

          setTimeout(() => {
            setStep("mode");
          }, 1500);

        }

      } catch (err) {
        console.log("Face Error:", err.response?.data);
      }

    }, 2000);

    return () => clearInterval(interval);

  }, [loading, user, setStep]);


  // loader screen
  if (loading) {
    return <SystemLoader message="Initializing biometric scanner..." />;
  }


  return (

    <div className="face-container">

      <h1 className="face-title">
        Biometric Face Authentication
      </h1>

      <div className="camera-box">

        <Webcam
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          width={500}
          audio={false}
          className="webcam"
        />

        <div className="scan-frame"></div>

        {!verified && (
          <div className="scan-line"></div>
        )}

      </div>

      <div className="status-box">

        <p className={`status-text ${verified ? "success" : "scanning"}`}>
          {status}
        </p>

        {!verified && (
          <p className="face-instruction">
            Please keep your face inside the frame
          </p>
        )}

      </div>

    </div>

  );
}