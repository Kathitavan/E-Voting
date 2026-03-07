import { useEffect, useState } from "react";
import axios from "axios";
import "../styles/adminMode.css";

const API = "http://127.0.0.1:5000";

export default function AdminMode() {

  const [mode, setMode] = useState("TEST");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get(`${API}/get-mode`)
      .then(res => setMode(res.data.mode));
  }, []);

  const toggleMode = async () => {

    const newMode = mode === "TEST" ? "REAL" : "TEST";

    if (newMode === "REAL") {
      const confirm = window.confirm(
        "⚠ You are switching to REAL voting mode.\nDouble voting will be blocked.\nContinue?"
      );
      if (!confirm) return;
    }

    setLoading(true);

    const res = await axios.post(`${API}/set-mode`, {
      mode: newMode
    });

    setMode(res.data.mode);
    setLoading(false);
  };

  return (

    <div className="admin-container">

      <h1 className="admin-title">
        Election Control Panel
      </h1>

      <div className="admin-panel">

        <h2>Voting Mode</h2>

        <div className={`admin-status ${mode === "TEST" ? "test-mode" : "real-mode"}`}>
          {mode} MODE
        </div>

        <p className="admin-description">
          {mode === "TEST"
            ? "Test mode allows unlimited voting for system testing."
            : "Real mode prevents duplicate votes and records official ballots."
          }
        </p>

        <button
          onClick={toggleMode}
          className="admin-button"
          disabled={loading}
        >
          {loading ? "Updating..." : "Switch Mode"}
        </button>

      </div>

    </div>

  );
}