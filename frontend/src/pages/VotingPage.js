import axios from "axios";
import { useState } from "react";
import "../styles/voting.css";
import SystemLoader from "../components/SystemLoader";

const API = "http://127.0.0.1:5000";

const candidates = [
  { name: "Dravida Munnetra Kazhagam",                tamil: "திராவிட முன்னேற்ற கழகம்",        short: "DMK",  logo: "/party-logos/dmk.png"      },
  { name: "All India Anna Dravida Munnetra Kazhagam", tamil: "அண்ணா திராவிட முன்னேற்ற கழகம்",  short: "ADMK", logo: "/party-logos/admk.png"     },
  { name: "Naam Tamilar Katchi",                      tamil: "நாம் தமிழர் கட்சி",              short: "NTK",  logo: "/party-logos/ntk.png"      },
  { name: "Tamilaga Vettri Kazhagam",                 tamil: "தமிழக வெற்றி கழகம்",             short: "TVK",  logo: "/party-logos/tvk.png"      },
  { name: "Bharatiya Janata Party",                   tamil: "பாரதிய ஜனதா கட்சி",              short: "BJP",  logo: "/party-logos/bjp.png"      },
  { name: "Indian National Congress",                 tamil: "இந்திய தேசிய காங்கிரஸ்",         short: "INC",  logo: "/party-logos/congress.png" },
  { name: "Pattali Makkal Katchi",                    tamil: "பாட்டாளி மக்கள் கட்சி",          short: "PMK",  logo: "/party-logos/pmk.png"      },
  { name: "Amma Makkal Munnetra Kazhagam",            tamil: "அம்மா மக்கள் முன்னேற்ற கழகம்",   short: "AMMK", logo: "/party-logos/ammk.png"     },
  { name: "Makkal Needhi Maiam",                      tamil: "மக்கள் நீதி மையம்",              short: "MNM",  logo: "/party-logos/mnm.png"      },
  { name: "Desiya Murpokku Dravida Kazhagam",         tamil: "தேசிய முற்போக்கு திராவிட கழகம்", short: "DMDK", logo: "/party-logos/dmdk.png"     },
];

export default function VotingPage({ user, setStep }) {
  const [selected, setSelected] = useState(null);
  const [confirm,  setConfirm]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [toast,    setToast]    = useState(null);

  const showToast = (msg, type = "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSelect = (c) => { setSelected(c); setConfirm(false); };

  const openConfirm = () => {
    if (!selected) { showToast("Please select a party first"); return; }
    setConfirm(true);
  };

  const castVote = async () => {
    setConfirm(false);
    setLoading(true);
    try {
      const res = await axios.post(`${API}/vote`, {
        qr_string: user.qr_string,
        candidate: selected.short,
      });
      if (res.data.status === "vote_success") {
        setStep("success");
      } else if (res.data.status === "already_voted") {
        showToast("You have already voted in this election", "warn");
        setTimeout(() => setStep("qr"), 2500);
      } else {
        showToast("Vote could not be recorded — please try again");
      }
    } catch {
      showToast("Backend connection error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <SystemLoader message="Recording your vote securely…" />;

  return (
    <div className="vp-root">

      {/* Tricolor stripe */}
      <div className="vp-stripe"><div className="vp-s"/><div className="vp-w"/><div className="vp-g"/></div>

      {/* Ambient glows */}
      <div className="vp-glow vp-glow--s"/>
      <div className="vp-glow vp-glow--g"/>

      {/* ══ CONFIRM DIALOG ══ */}
      {confirm && selected && (
        <div className="vp-overlay">
          <div className="vp-dialog">
            <div className="vp-dlg-icon">🗳️</div>
            <h2 className="vp-dlg-title">Confirm Your Vote</h2>
            <p className="vp-dlg-note">
              This action is <strong>permanent</strong> and cannot be undone.
            </p>
            <div className="vp-dlg-party">
              <div className="vp-dlg-logo-wrap">
                <img src={selected.logo} alt={selected.short} className="vp-dlg-logo"/>
              </div>
              <div className="vp-dlg-pinfo">
                <span className="vp-dlg-short">{selected.short}</span>
                <span className="vp-dlg-name">{selected.name}</span>
                <span className="vp-dlg-tamil">{selected.tamil}</span>
              </div>
            </div>
            <div className="vp-dlg-btns">
              <button className="vp-dlg-cancel" onClick={() => setConfirm(false)}>← Change</button>
              <button className="vp-dlg-cast"   onClick={castVote}>✓ Cast Vote</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ TOAST ══ */}
      {toast && (
        <div className={`vp-toast vp-toast--${toast.type}`}>
          <span>{toast.type === "error" ? "✕" : "⚠"}</span> {toast.msg}
        </div>
      )}

      <div className="vp-wrap">

        {/* Header */}
        <div className="vp-header">
          <div>
            <div className="vp-tag"><span className="vp-tag-dot"/>ELECTRONIC VOTING MACHINE</div>
            <h1 className="vp-title">Cast Your Vote</h1>
            <p className="vp-subtitle">
              {user?.voter_info?.name
                ? `Welcome, ${user.voter_info.name} — select one party below`
                : "Select your preferred party and confirm"}
            </p>
          </div>
          <div className="vp-emblem">🇮🇳</div>
        </div>

        {/* Body: list + sidebar */}
        <div className="vp-body">

          {/* ── Candidate list ── */}
          <div className="vp-list">
            {candidates.map((c, i) => {
              const isSel = selected?.short === c.short;
              return (
                <div
                  key={c.short}
                  className={`vp-row${isSel ? " vp-row--sel" : ""}`}
                  onClick={() => handleSelect(c)}
                  role="button" tabIndex={0}
                  onKeyDown={e => e.key === "Enter" && handleSelect(c)}
                >
                  <div className="vp-serial">{String(i + 1).padStart(2, "0")}</div>

                  <div className="vp-logo-wrap">
                    <img src={c.logo} alt={c.short} className="vp-logo"/>
                  </div>

                  <div className="vp-info">
                    <span className="vp-short">{c.short}</span>
                    <span className="vp-name">{c.name}</span>
                    <span className="vp-tamil">{c.tamil}</span>
                  </div>

                  <div className={`vp-radio${isSel ? " vp-radio--sel" : ""}`}>
                    {isSel && <div className="vp-radio-dot"/>}
                  </div>

                  {isSel && <div className="vp-row-glow"/>}
                </div>
              );
            })}
          </div>

          {/* ── Sticky sidebar ── */}
          <aside className="vp-sidebar">

            <div className="vp-voter-card">
              <div className="vp-voter-avatar">
                {user?.voter_info?.name?.charAt(0).toUpperCase() || "V"}
              </div>
              <div>
                <div className="vp-voter-name">{user?.voter_info?.name || "Voter"}</div>
                <div className="vp-voter-meta">
                  {user?.voter_info?.gender} · {user?.voter_info?.age} yrs
                </div>
              </div>
            </div>

            <div className="vp-sidebar-div"/>

            <div className="vp-preview">
              <span className="vp-preview-lbl">YOUR SELECTION</span>
              {selected ? (
                <div className="vp-preview-card">
                  <img src={selected.logo} alt={selected.short} className="vp-preview-logo"/>
                  <div>
                    <div className="vp-preview-short">{selected.short}</div>
                    <div className="vp-preview-name">{selected.name}</div>
                  </div>
                </div>
              ) : (
                <div className="vp-preview-empty">
                  <span>👆</span><span>No party selected yet</span>
                </div>
              )}
            </div>

            <button
              className={`vp-cast-btn${!selected ? " vp-cast-btn--off" : ""}`}
              onClick={openConfirm}
              disabled={!selected}
            >
              🗳️ &nbsp;Confirm &amp; Cast Vote
            </button>

            <div className="vp-sec-note">🔒 Your vote is encrypted and anonymous</div>

          </aside>
        </div>

        {/* Mobile bottom bar */}
        <div className="vp-mobile-bar">
          {selected && (
            <div className="vp-mobile-sel">
              <img src={selected.logo} alt={selected.short} className="vp-mobile-logo"/>
              <span>{selected.short}</span>
            </div>
          )}
          <button
            className={`vp-mobile-cast${!selected ? " vp-cast-btn--off" : ""}`}
            onClick={openConfirm}
            disabled={!selected}
          >
            {selected ? "Confirm & Cast Vote →" : "Select a party first"}
          </button>
        </div>

      </div>

      <div className="vp-stripe vp-stripe--btm"><div className="vp-s"/><div className="vp-w"/><div className="vp-g"/></div>
    </div>
  );
}