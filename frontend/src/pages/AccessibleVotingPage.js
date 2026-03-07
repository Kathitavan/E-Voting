import React, { useRef, useEffect, useState } from "react";
import * as faceapi from "face-api.js";
import axios from "axios";
import "../styles/accessibleVoting.css";

const API = "http://127.0.0.1:5000";

export default function AccessibleVotingPage({ user }) {

  const videoRef = useRef(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const baselineRef = useRef(null);
  const cooldownRef = useRef(false);

  const candidates = [
    "DMK","ADMK","NTK","TVK","BJP",
    "Congress","PMK","AMMK","MNM","DMDK"
  ];

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
    await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
    startVideo();
  };

  const startVideo = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoRef.current.srcObject = stream;

    videoRef.current.onloadedmetadata = () => {
      trackHead();
    };
  };

  const triggerCooldown = () => {
    cooldownRef.current = true;
    setTimeout(() => (cooldownRef.current = false), 700);
  };

  const trackHead = async () => {

    const detection = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks();

    if (detection) {

      const nose = detection.landmarks.getNose()[3];
      const currentY = nose.y;

      if (baselineRef.current === null) {
        baselineRef.current = currentY;
      } else {

        const diff = currentY - baselineRef.current;

        if (!cooldownRef.current) {

          if (diff > 10) {
            setSelectedIndex(prev =>
              Math.min(prev + 1, candidates.length - 1)
            );
            triggerCooldown();
          }

          if (diff < -10) {
            setSelectedIndex(prev =>
              Math.max(prev - 1, 0)
            );
            triggerCooldown();
          }

        }

      }

    }

    requestAnimationFrame(trackHead);
  };

  const confirmVote = async () => {

    const res = await axios.post(`${API}/vote`, {
      qr_string: user.qr_string,
      candidate: candidates[selectedIndex]
    });

    if (res.data.status === "vote_success") {
      alert("Vote Successfully Cast");
    } else {
      alert("Vote Failed");
    }

  };

  return (

    <div className="accessible-container">

      <h1 className="accessible-title">
        Accessible Head Movement Voting
      </h1>

      <div className="accessible-main">

        <div className="camera-section">

          <video
            ref={videoRef}
            autoPlay
            muted
            className="camera-video"
          />

          <p className="camera-instruction">
            Move head ↑ ↓ to select candidate
          </p>

        </div>

        <div className="candidate-section">

          {candidates.map((c, index) => (

            <div
              key={index}
              className={
                index === selectedIndex
                  ? "candidate-card active"
                  : "candidate-card"
              }
            >
              {c}
            </div>

          ))}

        </div>

      </div>

      <button
        className="vote-button"
        onClick={confirmVote}
      >
        Confirm Vote
      </button>

    </div>

  );
}