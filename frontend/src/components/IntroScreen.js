import { useEffect, useRef, useState, useCallback } from "react";
import "../styles/intro.css";

const TEAM = [
  { name: "Kathiravan", role: "Lead Developer",     img: "/team/member1.jpg" },
  { name: "Member 2",  role: "Frontend Engineer",   img: "/team/member2.jpg" },
  { name: "Member 3",  role: "Backend Engineer",    img: "/team/member3.jpg" },
  { name: "Member 4",  role: "Security Specialist", img: "/team/member4.jpg" },
];
const GUIDE = { name: "Guide Name", role: "Project Guide & Mentor", img: "/team/guide.jpg" };

const OVERVIEW = [
  { n:"01", icon:"🧬", title:"Biometric Auth",    body:"InsightFace 512-d embeddings with passive liveness detection. Defeats printed photos, screens, and every known spoofing vector in real time." },
  { n:"02", icon:"⛓️", title:"Blockchain Ledger", body:"Every ballot cryptographically sealed into an immutable chain. Each block hashes the previous — making retroactive tampering mathematically impossible." },
  { n:"03", icon:"📱", title:"QR + Face Auth",    body:"Dual-factor authentication pairs a unique QR identity with live facial recognition. Only the registered voter, physically present, can cast a ballot." },
  { n:"04", icon:"♿", title:"Accessible Mode",   body:"Head-tilt gestures and blink detection via MediaPipe FaceLandmarker enable hands-free voting for every citizen, regardless of physical ability." },
];

const FLOW = [
  { icon:"📱", step:"01", label:"QR Scan",    body:"Voter scans their unique encrypted QR code to begin authentication." },
  { icon:"🪪", step:"02", label:"ID Verify",  body:"Identity confirmed against the secure registered voter database." },
  { icon:"👁️", step:"03", label:"Face Auth",  body:"Real-time liveness check and biometric face match performed." },
  { icon:"🗳️", step:"04", label:"Cast Vote",  body:"Encrypted ballot cast — anonymous, tamper-proof, irreversible." },
  { icon:"🔗", step:"05", label:"Blockchain", body:"Vote permanently sealed into the distributed audit blockchain." },
];

// Scene sequence:
// 0 = title
// 1..4 = team members (one by one fullscreen)
// 5 = guide
// 6 = overview (cycles internally)
// 7 = workflow
const SCENES = ["title", "member0","member1","member2","member3","guide","overview","flow"];
const DURATIONS = [3400, 1800,1800,1800,1800, 2200, 3800, 5000];

export default function IntroScreen({ setShowIntro }) {
  const canvasRef = useRef(null);
  const [scene,   setScene]   = useState(0);
  const [leaving, setLeaving] = useState(false); // scene exit anim
  const [exiting, setExiting] = useState(false); // whole screen exit
  const [ovIdx,   setOvIdx]   = useState(0);
  const [ovIn,    setOvIn]    = useState(true);
  const [flowStep,setFlowStep]= useState(-1);
  const [beamPct, setBeamPct] = useState(0);

  // ── Particle aurora canvas ──────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = () => window.innerWidth;
    const H = () => window.innerHeight;
    const resize = () => { canvas.width = W(); canvas.height = H(); };
    resize();
    window.addEventListener("resize", resize);
    const ctx = canvas.getContext("2d");

    const orbs = Array.from({length: 5}, () => ({
      x: Math.random() * W(),
      y: Math.random() * H(),
      r: 180 + Math.random() * 220,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      hue: 270 + Math.random() * 50,
      opacity: 0.04 + Math.random() * 0.05,
    }));
    const stars = Array.from({length: 140}, () => ({
      x: Math.random() * W(),
      y: Math.random() * H(),
      r: Math.random() * 0.9 + 0.2,
      o: Math.random() * 0.4 + 0.05,
      twinkle: Math.random() * Math.PI * 2,
    }));

    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Orbs
      orbs.forEach(o => {
        o.x += o.vx; o.y += o.vy;
        if (o.x < -o.r) o.x = canvas.width + o.r;
        if (o.x > canvas.width + o.r) o.x = -o.r;
        if (o.y < -o.r) o.y = canvas.height + o.r;
        if (o.y > canvas.height + o.r) o.y = -o.r;
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        g.addColorStop(0, `hsla(${o.hue},80%,60%,${o.opacity})`);
        g.addColorStop(1, `hsla(${o.hue},80%,60%,0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill();
      });
      // Stars
      stars.forEach(s => {
        s.twinkle += 0.02;
        const ao = s.o * (0.5 + 0.5 * Math.sin(s.twinkle));
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220,200,255,${ao})`; ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  // ── Scene advance ───────────────────────────────────────────────
  const goExit = useCallback(() => {
    setExiting(true);
    setTimeout(() => setShowIntro(false), 1200);
  }, [setShowIntro]);

  const nextScene = useCallback((idx) => {
    setLeaving(true);
    setTimeout(() => {
      setLeaving(false);
      setScene(idx);
    }, 420);
  }, []);

  useEffect(() => {
    if (exiting) return;
    const cur = SCENES[scene];

    if (cur === "overview") {
      let i = 0;
      setOvIdx(0); setOvIn(true);
      const cycle = setInterval(() => {
        setOvIn(false);
        setTimeout(() => { i++; if (i < OVERVIEW.length){ setOvIdx(i); setOvIn(true); } }, 380);
      }, 870);
      const adv = setTimeout(() => {
        clearInterval(cycle);
        nextScene(scene + 1);
      }, DURATIONS[scene]);
      return () => { clearInterval(cycle); clearTimeout(adv); };
    }

    if (cur === "flow") {
      setFlowStep(-1); setBeamPct(0);
      let s = 0;
      const run = () => {
        setFlowStep(s);
        setBeamPct(Math.round((s / (FLOW.length - 1)) * 100));
        s++;
        if (s < FLOW.length) setTimeout(run, 700);
        else setTimeout(goExit, 1600);
      };
      const t = setTimeout(run, 500);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => nextScene(scene + 1 < SCENES.length ? scene + 1 : scene), DURATIONS[scene]);
    return () => clearTimeout(t);
  }, [scene, exiting, goExit, nextScene]); // eslint-disable-line react-hooks/exhaustive-deps

  const skip = () => goExit();
  const cur  = SCENES[scene];

  const memberIdx = cur.startsWith("member") ? parseInt(cur.replace("member","")) : -1;
  const member    = memberIdx >= 0 ? TEAM[memberIdx] : null;

  return (
    <div className={`is-root${exiting ? " is-exiting" : ""}`}>
      <canvas ref={canvasRef} className="is-canvas"/>

      {/* Noise grain overlay */}
      <div className="is-grain"/>

      {/* Vignette */}
      <div className="is-vignette"/>

      {/* Decorative diagonal lines */}
      <div className="is-deco-lines">
        <span/><span/><span/>
      </div>

      <button className="is-skip" onClick={skip}>skip</button>

      {/* Progress dots */}
      <div className="is-progress-bar">
        <div className="is-pb-fill" style={{width:`${(scene/( SCENES.length-1))*100}%`}}/>
      </div>

      {/* ══ TITLE SCENE ══ */}
      {cur === "title" && (
        <div className={`is-scene${leaving?" is-scene--out":""}`}>
          <div className="is-title-scene">
            <div className="is-eyebrow">NATIONAL ELECTION COMMISSION</div>
            <h1 className="is-main-title">
              <span className="is-mt-line" style={{animationDelay:".05s"}}>SECURE</span>
              <span className="is-mt-line is-mt-violet" style={{animationDelay:".18s"}}>BIOMETRIC</span>
              <span className="is-mt-line" style={{animationDelay:".31s"}}>E-VOTING</span>
            </h1>
            <div className="is-title-rule"/>
            <p className="is-title-sub">
              AI-powered identity verification · Immutable blockchain audit trail
            </p>
            <div className="is-title-tags">
              <span>InsightFace AI</span><span>256-bit TLS</span>
              <span>Blockchain</span><span>Liveness Detection</span>
            </div>
          </div>
        </div>
      )}

      {/* ══ MEMBER SCENE — fullscreen ══ */}
      {member && (
        <div className={`is-scene is-scene--member${leaving?" is-scene--out":""}`} key={cur}>
          <div className="is-member-bg">
            <img src={member.img} alt={member.name}
              onError={e => {e.target.style.display="none"; e.target.nextSibling.style.display="flex";}}
            />
            <div className="is-member-fb">{member.name[0]}</div>
            <div className="is-member-shade"/>
          </div>
          <div className="is-member-info">
            <div className="is-member-num">0{memberIdx + 1} / 04</div>
            <div className="is-member-name">{member.name}</div>
            <div className="is-member-role">{member.role}</div>
            <div className="is-member-rule"/>
            <div className="is-member-team">DEVELOPMENT TEAM</div>
          </div>
        </div>
      )}

      {/* ══ GUIDE SCENE ══ */}
      {cur === "guide" && (
        <div className={`is-scene is-scene--guide${leaving?" is-scene--out":""}`}>
          <div className="is-member-bg">
            <img src={GUIDE.img} alt={GUIDE.name}
              onError={e => {e.target.style.display="none"; e.target.nextSibling.style.display="flex";}}
            />
            <div className="is-member-fb">{GUIDE.name[0]}</div>
            <div className="is-member-shade"/>
          </div>
          <div className="is-member-info">
            <div className="is-member-num">GUIDE</div>
            <div className="is-member-name">{GUIDE.name}</div>
            <div className="is-member-role">{GUIDE.role}</div>
            <div className="is-member-rule"/>
            <div className="is-member-team">PROJECT MENTOR</div>
          </div>
        </div>
      )}

      {/* ══ OVERVIEW SCENE ══ */}
      {cur === "overview" && (
        <div className={`is-scene${leaving?" is-scene--out":""}`}>
          <div className="is-ov-scene">
            <div className="is-ov-label">PROJECT OVERVIEW</div>
            <div className={`is-ov-body${ovIn?" is-ov-body--in":""}`}>
              <div className="is-ov-ghost">{OVERVIEW[ovIdx].n}</div>
              <div className="is-ov-icon">{OVERVIEW[ovIdx].icon}</div>
              <div className="is-ov-title">{OVERVIEW[ovIdx].title}</div>
              <div className="is-ov-text">{OVERVIEW[ovIdx].body}</div>
              <div className="is-ov-pips">
                {OVERVIEW.map((_,i) => <span key={i} className={`is-ov-pip${i===ovIdx?" on":""}`}/>)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ FLOW SCENE ══ */}
      {cur === "flow" && (
        <div className={`is-scene${leaving?" is-scene--out":""}`}>
          <div className="is-flow-scene">
            <div className="is-flow-label">VOTING WORKFLOW</div>

            {/* Active step detail */}
            <div className="is-flow-detail">
              {flowStep >= 0 && (
                <div className="is-fd-inner" key={flowStep}>
                  <div className="is-fd-step">{FLOW[flowStep].step}</div>
                  <div className="is-fd-icon">{FLOW[flowStep].icon}</div>
                  <div className="is-fd-title">{FLOW[flowStep].label}</div>
                  <div className="is-fd-body">{FLOW[flowStep].body}</div>
                </div>
              )}
              {flowStep < 0 && <div className="is-fd-idle">Initialising workflow…</div>}
            </div>

            {/* Beam + nodes */}
            <div className="is-flow-track-wrap">
              <div className="is-flow-beam-bg"/>
              <div className="is-flow-beam" style={{width:`${beamPct}%`}}>
                <div className="is-beam-orb"/>
              </div>
              <div className="is-flow-nodes">
                {FLOW.map((f, i) => (
                  <div key={i} className="is-fn-wrap">
                    <div className={`is-fn${flowStep>=i?" is-fn--lit":""}${flowStep===i?" is-fn--now":""}`}>
                      <div className="is-fn-ring"/>
                      <span className="is-fn-ico">{f.icon}</span>
                      {flowStep > i && <div className="is-fn-done">✓</div>}
                    </div>
                    <div className={`is-fn-label${flowStep>=i?" on":""}`}>{f.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {flowStep >= FLOW.length - 1 && (
              <div className="is-flow-ready">System Ready · Launching</div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}