import React, { useEffect, useState } from 'react';
import '../styles/intro.css';

const TEAM = [
  { name: "Kathiravan", role: "Lead Architect", img: "/team/member1.jpg" },
  { name: "Member 2", role: "DevOps Engineer", img: "/team/member2.jpg" },
  { name: "Member 3", role: "AI Security", img: "/team/member3.jpg" },
  { name: "Member 4", role: "UI Strategist", img: "/team/member4.jpg" },
];

const FLOW = [
  { t: "BIOMETRIC AUTH", d: "Neural face-match ensures one-person-one-vote." },
  { t: "ASYMMETRIC HASHING", d: "Votes are encrypted before leaving the client node." },
  { t: "BLOCKCHAIN SETTLEMENT", d: "Immutable entry into the decentralized ledger." }
];

const IntroScreen = ({ setShowIntro }) => {
  const [active, setActive] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setActive(false);
      setTimeout(() => setShowIntro(false), 1200); // Wait for exit animation
    }, 8000); // 8 Seconds duration
    return () => clearTimeout(timer);
  }, [setShowIntro]);

  return (
    <div className={`intro-screen ${!active ? 'fade-out' : ''}`}>
      <div className="bg-flare" />

      {/* 1. Header Section */}
      <header className="brand-block">
        <h1 className="title-main">VOTECHAIN.sys</h1>
        <div style={{ textAlign: 'right', fontSize: '1.2vh', opacity: 0.6 }}>
          STATUS: SYSTEM READY <br />
          VERSION: 2.0.26
        </div>
      </header>

      <div className="main-layout">
        
        {/* 2. Team Panel */}
        <div className="panel">
          <span className="panel-label">DEVELOPMENT UNIT</span>
          <div className="team-list">
            {TEAM.map((m, i) => (
              <div className="member-box" key={i}>
                <img src={m.img} alt={m.name} className="member-img" 
                     onError={(e) => e.target.src="https://ui-avatars.com/api/?background=222&color=fff&name="+m.name}/>
                <div>
                  <div style={{fontSize: '1.6vh', fontWeight: 600}}>{m.name}</div>
                  <div style={{fontSize: '1.2vh', color: 'var(--gold)'}}>{m.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Workflow Panel */}
        <div className="panel" style={{ gridRow: 'span 2' }}>
          <span className="panel-label">EXECUTION PROTOCOL</span>
          <div className="flow-container">
            {FLOW.map((f, i) => (
              <div className="flow-step" key={i}>
                <span className="step-num">0{i+1}</span>
                <div className="step-content">
                  <b>{f.t}</b>
                  <p>{f.d}</p>
                </div>
              </div>
            ))}
            <div style={{ marginTop: '2vh', borderTop: '1px solid var(--border)', paddingTop: '2vh' }}>
              <span style={{ fontSize: '1.2vh', color: 'var(--gold)', letterSpacing: '1px' }}>PROJECT OVERVIEW</span>
              <p style={{ fontSize: '1.4vh', lineHeight: '1.5', color: '#aaa', marginTop: '1vh' }}>
                VoteChain is an end-to-end verifiable voting protocol. It combines AI-driven 
                liveness detection with blockchain immutability to provide a 100% 
                tamper-proof democratic environment.
              </p>
            </div>
          </div>
        </div>

        {/* 4. Guide Panel */}
        <div className="panel">
          <span className="panel-label">FACULTY OVERSIGHT</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3vh' }}>
            <img src="/team/guide.jpg" alt="Guide" className="member-img" 
                 style={{ width: '10vh', height: '10vh' }}
                 onError={(e) => e.target.src="https://ui-avatars.com/api/?background=ffcc00&color=000&name=Guide"}/>
            <div>
              <div style={{ fontSize: '2.2vh', fontWeight: 700 }}>Dr. Project Guide</div>
              <div style={{ fontSize: '1.4vh', color: '#777' }}>Department of Computer Science</div>
            </div>
          </div>
        </div>

      </div>

      {/* Progress tracking line */}
      <div className="loader-track">
        <div className="loader-bar" />
      </div>
    </div>
  );
};

export default IntroScreen;