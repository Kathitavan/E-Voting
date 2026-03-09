import { useState, useEffect } from "react";

import QrPage from "./pages/QrPage";
import DetailsPage from "./pages/DetailsPage";
import FacePage from "./pages/FacePage";
import VotingPage from "./pages/VotingPage";
import RegisterPage from "./pages/RegisterPage";
import AccessibleVotingPage from "./pages/AccessibleVotingPage";
import ModeSelectionPage from "./pages/ModeSelectionPage";
import VoteSuccessPage from "./pages/VoteSuccessPage";

import AdminDashboard from "./pages/AdminDashboard";
import AdminMode from "./pages/AdminMode";

import ProgressFlow from "./components/ProgressFlow";

import "./styles/app.css";

function App() {

  const [step, setStep] = useState("qr");
  const [user, setUser] = useState(null);
  const [adminAuth, setAdminAuth] = useState(false);

  // SECRET ADMIN ACCESS (CTRL + SHIFT + A)
  useEffect(() => {

    const handleKey = (e) => {

      if (e.ctrlKey && e.shiftKey && e.key === "A") {

        const password = prompt("Enter Admin Password");

        if (password === "admin123") {

          setAdminAuth(true);
          setStep("dashboard");

        } else {

          alert("Unauthorized Access");

        }

      }

    };

    window.addEventListener("keydown", handleKey);

    return () => window.removeEventListener("keydown", handleKey);

  }, []);

  const logoutAdmin = () => {

    setAdminAuth(false);
    setStep("qr");

  };

  return (

    <div className="app-container">

      {/* NAVBAR */}

      <div className="navbar">

        <h2 className="logo">
          Secure E-Voting
        </h2>

        <div className="nav-buttons">

          {!adminAuth && (
            <button onClick={() => setStep("qr")}>
              Start Voting
            </button>
          )}

          {adminAuth && (
            <>
              <button onClick={() => setStep("dashboard")}>
                Dashboard
              </button>

              <button onClick={() => setStep("admin-mode")}>
                Election Control
              </button>

              <button onClick={() => setStep("register")}>
                Register Voter
              </button>

              <button onClick={logoutAdmin}>
                Logout
              </button>
            </>
          )}

        </div>

      </div>


      {/* PROGRESS FLOW (only voter side) */}

      {!adminAuth &&
        ["qr","details","face","mode","voting","accessible"].includes(step) && (
          <ProgressFlow step={step} />
      )}


      {/* PAGE CONTENT */}

      <div className="page-content">

        {/* VOTER FLOW */}

        {!adminAuth && step === "qr" &&
          <QrPage setStep={setStep} setUser={setUser} />
        }

        {!adminAuth && step === "details" &&
          <DetailsPage user={user} setStep={setStep} />
        }

        {!adminAuth && step === "face" &&
          <FacePage user={user} setStep={setStep} />
        }

        {!adminAuth && step === "mode" &&
          <ModeSelectionPage setStep={setStep} />
        }

        {!adminAuth && step === "voting" &&
          <VotingPage user={user} setStep={setStep} />
        }

        {!adminAuth && step === "accessible" &&
          <AccessibleVotingPage user={user} setStep={setStep} />
        }

        {!adminAuth && step === "success" &&
          <VoteSuccessPage setStep={setStep} />
        }


        {/* ADMIN FLOW */}

        {adminAuth && step === "dashboard" &&
          <AdminDashboard />
        }

        {adminAuth && step === "admin-mode" &&
          <AdminMode />
        }

        {adminAuth && step === "register" &&
          <RegisterPage />
        }

      </div>

    </div>

  );

}

export default App;