    import { useEffect, useState, useRef } from "react";
import axios from "axios";
import "../styles/voterList.css";

const API = "https://e-voting-backend-zmxj.onrender.com";

export default function VoterListPage() {
  const [voters,    setVoters]    = useState([]);
  const [stats,     setStats]     = useState({ total: 0, voted: 0, not_voted: 0 });
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [filter,    setFilter]    = useState("all");   // all | voted | not_voted
  const [toast,     setToast]     = useState(null);
  const [confirm,   setConfirm]   = useState(null);    // { type, voter } or null
  const [mode,      setMode]      = useState("TEST");
  const intervalRef = useRef(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchVoters = async () => {
    try {
      const [votersRes, modeRes] = await Promise.all([
        axios.get(`${API}/admin/voters`),
        axios.get(`${API}/get-mode`),
      ]);
      setVoters(votersRes.data.voters || []);
      setStats({
        total:     votersRes.data.total     || 0,
        voted:     votersRes.data.voted     || 0,
        not_voted: votersRes.data.not_voted || 0,
      });
      setMode(modeRes.data.mode || "TEST");
      setLoading(false);
    } catch {
      showToast("Failed to load voter list", "error");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVoters();
    // Auto-refresh every 5s
    intervalRef.current = setInterval(fetchVoters, 5000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // ── DELETE voter ──────────────────────────────────────────────────
  const confirmDelete = (voter) => setConfirm({ type: "delete", voter });

  const doDelete = async () => {
    const voter = confirm.voter;
    setConfirm(null);
    try {
      await axios.delete(`${API}/admin/voters/${voter.voter_id}`);
      showToast(`✅ ${voter.name} removed from system`, "success");
      fetchVoters();
    } catch (err) {
      const msg = err.response?.data?.message || "Delete failed";
      showToast(msg, "error");
    }
  };

  // ── RESET vote ────────────────────────────────────────────────────
  const confirmReset = (voter) => {
    if (mode === "REAL") {
      showToast("Vote reset is disabled in REAL mode", "error");
      return;
    }
    setConfirm({ type: "reset", voter });
  };

  const doReset = async () => {
    const voter = confirm.voter;
    setConfirm(null);
    try {
      const res = await axios.post(`${API}/admin/voters/${voter.voter_id}/reset-vote`);
      if (res.data.status === "reset") {
        showToast(`🔄 ${voter.name}'s vote has been reset`, "success");
      } else if (res.data.status === "not_voted") {
        showToast(`${voter.name} hasn't voted yet`, "info");
      } else if (res.data.status === "forbidden") {
        showToast("Not allowed in REAL mode", "error");
      }
      fetchVoters();
    } catch {
      showToast("Reset failed", "error");
    }
  };

  // ── FILTER + SEARCH ───────────────────────────────────────────────
  const visible = voters.filter(v => {
    const matchSearch = v.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all"       ? true :
      filter === "voted"     ? v.has_voted :
      filter === "not_voted" ? !v.has_voted : true;
    return matchSearch && matchFilter;
  });

  const turnoutPct = stats.total
    ? ((stats.voted / stats.total) * 100).toFixed(1)
    : 0;

  if (loading) return (
    <div className="vl-loading">
      <div className="vl-spinner" />
      <span>Loading voter list…</span>
    </div>
  );

  return (
    <div className="vl-root">

      {/* Toast */}
      {toast && (
        <div className={`vl-toast vl-toast--${toast.type}`}>{toast.msg}</div>
      )}

      {/* Confirm dialog */}
      {confirm && (
        <div className="vl-overlay">
          <div className="vl-dialog">
            <div className="vl-dialog-icon">
              {confirm.type === "delete" ? "🗑️" : "🔄"}
            </div>
            <h2 className="vl-dialog-title">
              {confirm.type === "delete" ? "Delete Voter?" : "Reset Vote?"}
            </h2>
            <p className="vl-dialog-body">
              {confirm.type === "delete"
                ? <>Remove <strong>{confirm.voter.name}</strong> from the system?
                    This deletes their registration, face data, and vote record permanently.</>
                : <>Reset <strong>{confirm.voter.name}</strong>'s vote?
                    They will be able to vote again. (TEST mode only)</>
              }
            </p>
            <div className="vl-dialog-btns">
              <button className="vl-btn-cancel" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                className={confirm.type === "delete" ? "vl-btn-danger" : "vl-btn-warn"}
                onClick={confirm.type === "delete" ? doDelete : doReset}
              >
                {confirm.type === "delete" ? "Yes, Delete" : "Yes, Reset Vote"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="vl-header">
        <div>
          <h1 className="vl-title">👥 Voter Management</h1>
          <p className="vl-subtitle">View, search and manage all registered voters</p>
        </div>
        <button className="vl-refresh-btn" onClick={fetchVoters}>↺ Refresh</button>
      </div>

      {/* Stats row */}
      <div className="vl-stats">
        <div className="vl-stat vl-stat--blue">
          <span className="vl-stat-icon">📋</span>
          <div>
            <div className="vl-stat-num">{stats.total}</div>
            <div className="vl-stat-label">Registered</div>
          </div>
        </div>
        <div className="vl-stat vl-stat--green">
          <span className="vl-stat-icon">✅</span>
          <div>
            <div className="vl-stat-num">{stats.voted}</div>
            <div className="vl-stat-label">Voted</div>
          </div>
        </div>
        <div className="vl-stat vl-stat--amber">
          <span className="vl-stat-icon">⏳</span>
          <div>
            <div className="vl-stat-num">{stats.not_voted}</div>
            <div className="vl-stat-label">Pending</div>
          </div>
        </div>
        <div className="vl-stat vl-stat--purple">
          <span className="vl-stat-icon">📊</span>
          <div>
            <div className="vl-stat-num">{turnoutPct}%</div>
            <div className="vl-stat-label">Turnout</div>
          </div>
        </div>
      </div>

      {/* Turnout bar */}
      <div className="vl-turnout">
        <div className="vl-turnout-track">
          <div className="vl-turnout-fill" style={{ width: `${turnoutPct}%` }} />
        </div>
        <span className="vl-turnout-label">{turnoutPct}% voter turnout</span>
      </div>

      {/* Mode badge */}
      <div className={`vl-mode-badge${mode === "REAL" ? " vl-mode-badge--real" : " vl-mode-badge--test"}`}>
        <span className="vl-mode-dot" />
        {mode} MODE
        {mode === "REAL" && <span className="vl-mode-warn"> — Vote reset disabled</span>}
      </div>

      {/* Search + filter */}
      <div className="vl-controls">
        <input
          className="vl-search"
          placeholder="🔍 Search by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="vl-filters">
          {["all", "voted", "not_voted"].map(f => (
            <button
              key={f}
              className={`vl-filter-btn${filter === f ? " vl-filter-btn--active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? `All (${stats.total})` :
               f === "voted" ? `Voted (${stats.voted})` :
               `Pending (${stats.not_voted})`}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="vl-table-wrap">
        <div className="vl-table-head">
          <span>Voter</span>
          <span>Details</span>
          <span>Status</span>
          <span>Voted For</span>
          <span>Actions</span>
        </div>

        {visible.length === 0 && (
          <div className="vl-empty">
            {search ? `No voters matching "${search}"` : "No voters found"}
          </div>
        )}

        {visible.map(voter => (
          <div key={voter.voter_id} className={`vl-row${voter.has_voted ? " vl-row--voted" : ""}`}>

            {/* Avatar + name */}
            <div className="vl-voter-col">
              <div className={`vl-avatar${voter.has_voted ? " vl-avatar--voted" : ""}`}>
                {voter.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="vl-voter-name">{voter.name}</div>
                <div className="vl-voter-id">
                  {voter.voter_id.slice(0, 8)}…
                </div>
              </div>
            </div>

            {/* Age + gender */}
            <div className="vl-detail-col">
              <span className="vl-detail-chip">{voter.gender}</span>
              <span className="vl-detail-chip">{voter.age} yrs</span>
            </div>

            {/* Voted status */}
            <div className="vl-status-col">
              <span className={`vl-status-badge${voter.has_voted ? " vl-status-badge--voted" : " vl-status-badge--pending"}`}>
                {voter.has_voted ? "✅ Voted" : "⏳ Pending"}
              </span>
            </div>

            {/* Voted for */}
            <div className="vl-party-col">
              {voter.voted_for
                ? <span className="vl-party-chip">{voter.voted_for}</span>
                : <span className="vl-party-none">—</span>
              }
            </div>

            {/* Actions */}
            <div className="vl-actions-col">
              {voter.has_voted && mode === "TEST" && (
                <button
                  className="vl-btn-reset"
                  onClick={() => confirmReset(voter)}
                  title="Reset vote (TEST mode only)"
                >🔄 Reset</button>
              )}
              <button
                className="vl-btn-delete"
                onClick={() => confirmDelete(voter)}
                title="Delete voter"
              >🗑️ Delete</button>
            </div>

          </div>
        ))}
      </div>

      <p className="vl-footer-note">
        Auto-refreshes every 5 seconds · {visible.length} of {stats.total} voters shown
      </p>

    </div>
  );
}