import "../styles/progress.css";

export default function ProgressFlow({ step }) {

  const steps = [
    { key: "qr", label: "QR Scan" },
    { key: "details", label: "Details" },
    { key: "face", label: "Face" },
    { key: "mode", label: "Mode" },
    { key: "voting", label: "Vote" }
  ];

  const currentIndex = steps.findIndex(s => s.key === step);

  return (

    <div className="progress-container">

      {steps.map((s, index) => (

        <div key={s.key} className="progress-step">

          <div
            className={`progress-circle
              ${index < currentIndex ? "done" : ""}
              ${index === currentIndex ? "active" : ""}
            `}
          >
            {index + 1}
          </div>

          <p className="progress-label">{s.label}</p>

          {index !== steps.length - 1 && (
            <div
              className={`progress-line ${
                index < currentIndex ? "done-line" : ""
              }`}
            ></div>
          )}

        </div>

      ))}

    </div>

  );
}