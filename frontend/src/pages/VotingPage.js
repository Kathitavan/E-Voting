import axios from "axios";
import { useState } from "react";
import "../styles/voting.css";
import SystemLoader from "../components/SystemLoader";

const API = "http://127.0.0.1:5000";

export default function VotingPage({ user, setStep }) {

  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  const candidates = [

    {
      name: "Dravida Munnetra Kazhagam",
      tamil: "திராவிட முன்னேற்ற கழகம்",
      short: "DMK",
      logo: "/party-logos/dmk.png"
    },

    {
      name: "All India Anna Dravida Munnetra Kazhagam",
      tamil: "அண்ணா திராவிட முன்னேற்ற கழகம்",
      short: "ADMK",
      logo: "/party-logos/admk.png"
    },

    {
      name: "Naam Tamilar Katchi",
      tamil: "நாம் தமிழர் கட்சி",
      short: "NTK",
      logo: "/party-logos/ntk.png"
    },

    {
      name: "Tamilaga Vettri Kazhagam",
      tamil: "தமிழக வெற்றி கழகம்",
      short: "TVK",
      logo: "/party-logos/tvk.png"
    },

    {
      name: "Bharatiya Janata Party",
      tamil: "பாரதிய ஜனதா கட்சி",
      short: "BJP",
      logo: "/party-logos/bjp.png"
    },

    {
      name: "Indian National Congress",
      tamil: "இந்திய தேசிய காங்கிரஸ்",
      short: "INC",
      logo: "/party-logos/congress.png"
    },

    {
      name: "Pattali Makkal Katchi",
      tamil: "பாட்டாளி மக்கள் கட்சி",
      short: "PMK",
      logo: "/party-logos/pmk.png"
    },

    {
      name: "Amma Makkal Munnetra Kazhagam",
      tamil: "அம்மா மக்கள் முன்னேற்ற கழகம்",
      short: "AMMK",
      logo: "/party-logos/ammk.png"
    },

    {
      name: "Makkal Needhi Maiam",
      tamil: "மக்கள் நீதி மையம்",
      short: "MNM",
      logo: "/party-logos/mnm.png"
    },

    {
      name: "Desiya Murpokku Dravida Kazhagam",
      tamil: "தேசிய முற்போக்கு திராவிட கழகம்",
      short: "DMDK",
      logo: "/party-logos/dmdk.png"
    }

  ];


  const confirmVote = async () => {

    if (!selected) {
      alert("Please select a party");
      return;
    }

    const confirm = window.confirm(
      `Confirm your vote for ${selected.name}?`
    );

    if (!confirm) return;

    try {

      setLoading(true);

      const res = await axios.post(`${API}/vote`, {

        qr_string: user.qr_string,
        candidate: selected.short

      });

      if (res.data.status === "vote_success") {

        setStep("success");

      }

      else if (res.data.status === "already_voted") {

        alert("You have already voted");
        setStep("qr");

      }

      else {

        alert("Vote Failed");

      }

      setLoading(false);

    } catch {

      alert("Backend Error");
      setLoading(false);

    }

  };


  /* LOADER SCREEN */

  if (loading) {
    return <SystemLoader message="Recording vote securely..." />;
  }


  return (

    <div className="voting-container">

      <h1 className="voting-title">
        Electronic Voting Machine
      </h1>

      <p className="voting-subtitle">
        Select your preferred party
      </p>

      <div className="candidate-list">

        {candidates.map((c, index) => (

          <div
            key={index}
            className={`candidate-row ${selected?.short === c.short ? "selected" : ""}`}
            onClick={() => setSelected(c)}
          >

            <img
              src={c.logo}
              alt={c.short}
              className="party-logo"
            />

            <div className="party-info">

              <h3>{c.short}</h3>

              <p>{c.name}</p>

              <span className="tamil-name">
                {c.tamil}
              </span>

            </div>

            {selected?.short === c.short && (
              <div className="vote-indicator">
                ✓
              </div>
            )}

          </div>

        ))}

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