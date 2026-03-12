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
import VoterListPage from "./pages/VoterListPage";
import ProgressFlow from "./components/ProgressFlow";
import ErrorPage, { Error404, ErrorOffline } from "./pages/Errorpage";
import IntroScreen from "./components/IntroScreen";

import "./styles/app.css";
import { API } from "./config/api";

const PROGRESS_STEPS  = ["qr", "details", "face", "mode", "voting", "accessible"];
const ALL_VALID_STEPS = [...PROGRESS_STEPS, "success", "dashboard", "admin-mode", "register", "voters"];

function App() {

  /* INTRO SCREEN STATE */
  const [showIntro,setShowIntro] = useState(true)

  const [step,       setStep]      = useState("qr");
  const [user,       setUser]      = useState(null);
  const [adminAuth,  setAdminAuth] = useState(false);
  const [offline,    setOffline]   = useState(!navigator.onLine);
  const [error,      setError]     = useState(null);
  const [navIn,      setNavIn]     = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setNavIn(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline  = () => { setOffline(false); setError(null); };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online",  goOnline);

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online",  goOnline);
    };
  }, []);

  useEffect(() => {
    const handleKey = (e) => {

      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a") {

        const pw = prompt("Enter Admin Password");

        if (pw === "admin123") {

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

  /* KEEP BACKEND ALIVE */
  useEffect(() => {

    const ping = () =>
      fetch(`${API}/health`).catch(() => {});

    ping();

    const interval = setInterval(ping, 4 * 60 * 1000);

    return () => clearInterval(interval);

  }, []);

  const logoutAdmin  = () => { setAdminAuth(false); setStep("qr"); setError(null); };
  const triggerError = (code) => setError({ code });
  const clearError   = ()     => setError(null);

  /* INTRO SCREEN */
  if(showIntro){
    return <IntroScreen setShowIntro={setShowIntro}/>
  }

  if (offline) return <ErrorOffline onRetry={() => window.location.reload()} />;

  if (error) return (
    <ErrorPage
      code={error.code}
      onRetry={() => { clearError(); window.location.reload(); }}
      onHome={() => { clearError(); setStep("qr"); }}
    />
  );

  return (

    <div className="app-root">

      <div className="bg-grid" aria-hidden="true" />
      <div className="bg-glow bg-glow-1" aria-hidden="true" />
      <div className="bg-glow bg-glow-2" aria-hidden="true" />

      <header className={`navbar${navIn ? " navbar--in" : ""}`}>

        <div className="navbar__brand">

          <div className="navbar__emblem">

            <img
              src={`${process.env.PUBLIC_URL}/online-voting.png`}
              alt="Logo"
              className="navbar__logo-img"
              onError={(e) => {
                e.target.replaceWith(
                  Object.assign(document.createElement("span"), {
                    textContent: "🗳️",
                    className: "navbar__logo-fallback"
                  })
                );
              }}
            />

            <div className="navbar__emblem-ring" />

          </div>

          <div className="navbar__name-block">

            <span className="navbar__name">Secure E-Voting</span>

            <span className="navbar__subname">
              National Election Commission
            </span>

          </div>

        </div>

        <div className="navbar__status">

          <span className={`status-pill${adminAuth ? " status-pill--admin" : ""}`}>

            <span className="status-pill__dot" />

            {adminAuth ? "Admin Session" : "Voter Session"}

          </span>

        </div>

        <nav className="navbar__actions">

          {!adminAuth && (
            <button className="nbtn nbtn--primary" onClick={() => setStep("qr")}>
              <IconBallot />
              Start Voting
            </button>
          )}

          {adminAuth && (
            <>
              <button className="nbtn nbtn--ghost" onClick={() => setStep("dashboard")}>Dashboard</button>

              <button className="nbtn nbtn--ghost" onClick={() => setStep("voters")}>👥 Voter List</button>

              <button className="nbtn nbtn--ghost" onClick={() => setStep("admin-mode")}>Election Control</button>

              <button className="nbtn nbtn--ghost" onClick={() => setStep("register")}>Register Voter</button>

              <button className="nbtn nbtn--danger" onClick={logoutAdmin}>
                <IconLogout />
                Logout
              </button>
            </>
          )}

        </nav>

      </header>

      <div className="sec-bar">

        <span><IconShield /> 256-bit TLS Encrypted</span>

        <span className="sec-bar__dot" />

        <span><IconClock /> Session: 30 min</span>

        <span className="sec-bar__dot" />

        <span><IconLock /> Biometric + QR Authentication</span>

        <span className="sec-bar__dot" />

        <span><IconCheck /> Tamper-Proof Audit Trail</span>

      </div>

      {!adminAuth && PROGRESS_STEPS.includes(step) && (
        <ProgressFlow step={step} />
      )}

      <main className="page-content">

        {!adminAuth && step === "qr"        && <QrPage setStep={setStep} setUser={setUser} onError={triggerError} />}

        {!adminAuth && step === "details"   && <DetailsPage user={user} setStep={setStep} onError={triggerError} />}

        {!adminAuth && step === "face"      && <FacePage user={user} setStep={setStep} onError={triggerError} />}

        {!adminAuth && step === "mode"      && <ModeSelectionPage setStep={setStep} onError={triggerError} />}

        {!adminAuth && step === "voting"    && <VotingPage user={user} setStep={setStep} onError={triggerError} />}

        {!adminAuth && step === "accessible"&& <AccessibleVotingPage user={user} setStep={setStep} onError={triggerError} />}

        {!adminAuth && step === "success"   && <VoteSuccessPage setStep={setStep} />}

        {adminAuth && step === "dashboard"  && <AdminDashboard onError={triggerError} />}

        {adminAuth && step === "admin-mode" && <AdminMode onError={triggerError} />}

        {adminAuth && step === "register"   && <RegisterPage onError={triggerError} />}

        {adminAuth && step === "voters"     && <VoterListPage onError={triggerError} />}

        {!ALL_VALID_STEPS.includes(step) && <Error404 onHome={() => setStep("qr")} />}

      </main>

      <footer className="app-footer">

        <span>© {new Date().getFullYear()} National Election Commission</span>

        <span className="app-footer__sep" />

        <span>All votes are encrypted and anonymised</span>

        <span className="app-footer__sep" />

        <span>v2.0.0 · Secure Build</span>

      </footer>

    </div>

  );

}

const IconBallot  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>;

const IconLogout  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;

const IconShield  = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;

const IconClock   = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;

const IconLock    = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>;

const IconCheck   = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;

export default App;