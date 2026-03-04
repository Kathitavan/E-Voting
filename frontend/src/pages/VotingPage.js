import axios from "axios";

const API = "http://127.0.0.1:5000";

export default function VotingPage({ user }) {

  const candidates = [
    "Candidate 1",
    "Candidate 2",
    "Candidate 3",
    "Candidate 4",
    "Candidate 5",
    "Candidate 6",
    "Candidate 7",
    "Candidate 8",
    "Candidate 9",
    "Candidate 10"
  ];

  const vote = async (candidate) => {

    try {

      const res = await axios.post(`${API}/vote`, {
        qr_string: user.qr_string,
        candidate: candidate
      });

      if (res.data.status === "vote_success") {
        alert("Vote Cast Successfully ✅");
      } 
      else if (res.data.status === "already_voted") {
        alert("You already voted ❌");
      } 
      else {
        alert("Vote Failed");
      }

    } catch (err) {
      alert("Backend Error");
    }

  };

  return (
    <div style={{ textAlign: "center" }}>
      <h2>Select Candidate</h2>

      {candidates.map((c, index) => (
        <button
          key={index}
          onClick={() => vote(c)}
          style={{
            display: "block",
            margin: "10px auto",
            padding: "12px 20px",
            fontSize: "16px",
            cursor: "pointer"
          }}
        >
          {c}
        </button>
      ))}

    </div>
  );
}