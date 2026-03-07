import axios from "axios";
import { useState } from "react";
import "../styles/voting.css";

const API = "http://127.0.0.1:5000";

export default function VotingPage({ user }) {

  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  const candidates = [

    { name: "Dravida Munnetra Kazhagam", short: "DMK", logo: "/party-logos/dmk.png" },
    { name: "All India Anna Dravida Munnetra Kazhagam", short: "ADMK", logo: "/party-logos/admk.png" },
    { name: "Naam Tamilar Katchi", short: "NTK", logo: "/party-logos/ntk.png" },
    { name: "Tamilaga Vettri Kazhagam", short: "TVK", logo: "/party-logos/tvk.png" },
    { name: "Bharatiya Janata Party", short: "BJP", logo: "/party-logos/bjp.png" },
    { name: "Indian National Congress", short: "Congress", logo: "/party-logos/congress.png" },
    { name: "Pattali Makkal Katchi", short: "PMK", logo: "/party-logos/pmk.png" },
    { name: "Amma Makkal Munnetra Kazhagam", short: "AMMK", logo: "/party-logos/ammk.png" },
    { name: "Makkal Needhi Maiam", short: "MNM", logo: "/party-logos/mnm.png" },
    { name: "Desiya Murpokku Dravida Kazhagam", short: "DMDK", logo: "/party-logos/dmdk.png" }

  ];

  const confirmVote = async () => {

    if (!selected) {
      alert("Please select a party");
      return;
    }

    const confirm = window.confirm(
      `Confirm your vote for ${selected.short}?`
    );

    if (!confirm) return;

    try {

      setLoading(true);

      const res = await axios.post(`${API}/vote`, {

        qr_string: user.qr_string,
        candidate: selected.short

      });

      if (res.data.status === "vote_success") {

        alert("🗳 Vote Cast Successfully");

      }

      else if (res.data.status === "already_voted") {

        alert("You already voted");

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

            </div>

          </div>

        ))}

      </div>

      <button
        className="vote-button"
        onClick={confirmVote}
        disabled={loading}
      >

        {loading ? "Processing Vote..." : "Confirm Vote"}

      </button>

    </div>

  );
}