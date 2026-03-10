import { useEffect, useState } from "react"
import axios from "axios"
import "../styles/adminDashboard.css"
import SystemLoader from "../components/SystemLoader"
import { Pie, Bar } from "react-chartjs-2"
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
} from "chart.js"

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const API = "http://127.0.0.1:5000"

const PARTY_COLORS = [
  "#FF9933", "#138808", "#000080", "#f87171",
  "#a78bfa", "#34d399", "#fbbf24", "#60a5fa", "#f472b6", "#2dd4bf"
]

export default function AdminDashboard() {
  const [results,    setResults]    = useState({})
  const [gender,     setGender]     = useState({})
  const [stats,      setStats]      = useState({})
  const [lastUpdate, setLastUpdate] = useState("")
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(false)
  const [pulse,      setPulse]      = useState(false)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 3000)
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/admin/results`)
      setResults(res.data?.votes        || {})
      setGender (res.data?.gender_stats || {})
      setStats  (res.data?.system       || {})
      setLastUpdate(new Date().toLocaleTimeString())
      setLoading(false)
      setPulse(true)
      setTimeout(() => setPulse(false), 600)
    } catch (err) {
      console.log("Dashboard Error", err)
      setError(true)
    }
  }

  const totalVotes  = Object.values(results).reduce((a, b) => a + b, 0)
  const registered  = stats?.registered || 0
  const voted       = stats?.voted      || 0
  const remaining   = registered - voted
  const turnout     = registered ? ((voted / registered) * 100).toFixed(1) : 0
  const leader      = Object.keys(results).length > 0
    ? Object.entries(results).sort((a, b) => b[1] - a[1])[0]
    : null
  const sortedResults = Object.entries(results).sort((a, b) => b[1] - a[1])

  const pieData = {
    labels: Object.keys(results),
    datasets: [{
      data: Object.values(results),
      backgroundColor: PARTY_COLORS,
      borderColor: "rgba(255,255,255,0.06)",
      borderWidth: 2,
    }]
  }

  const barData = {
    labels: ["Male", "Female"],
    datasets: [{
      label: "Votes",
      data: [gender?.male || 0, gender?.female || 0],
      backgroundColor: ["rgba(0,0,128,0.7)", "rgba(255,153,51,0.7)"],
      borderColor:     ["#000080",           "#FF9933"],
      borderWidth: 2,
      borderRadius: 8,
    }]
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { labels: { color: "rgba(255,255,255,0.7)", font: { family: "DM Sans" } } },
      tooltip: {
        backgroundColor: "#0d1117",
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        titleColor: "#fff",
        bodyColor: "rgba(255,255,255,0.7)",
      }
    },
    scales: {
      x: { ticks: { color: "rgba(255,255,255,0.5)" }, grid: { color: "rgba(255,255,255,0.04)" } },
      y: { ticks: { color: "rgba(255,255,255,0.5)" }, grid: { color: "rgba(255,255,255,0.04)" } },
    }
  }

  if (loading) return <SystemLoader message="Loading election analytics..." />

  if (error) return (
    <div className="ad-error">
      <div className="ad-error-icon">⚠</div>
      <h2>Backend Unreachable</h2>
      <p>Could not connect to the election server.</p>
      <button onClick={fetchData}>Retry</button>
    </div>
  )

  return (
    <div className="ad-root">

      {/* ── Tricolor top stripe ── */}
      <div className="ad-stripe">
        <div className="ad-stripe-saffron" />
        <div className="ad-stripe-white"   />
        <div className="ad-stripe-green"   />
      </div>

      {/* ── Header ── */}
      <header className="ad-header">
        <div className="ad-header-left">
          <div className="ad-emblem">🇮🇳</div>
          <div>
            <h1 className="ad-title">Election Command Centre</h1>
            <p className="ad-subtitle">Real-time vote monitoring system</p>
          </div>
        </div>
        <div className="ad-header-right">
          <div className={`ad-live-badge${pulse ? " ad-live-badge--pulse" : ""}`}>
            <span className="ad-live-dot" />
            LIVE
          </div>
          <div className="ad-update-time">
            Last sync <strong>{lastUpdate}</strong>
          </div>
        </div>
      </header>

      {/* ── KPI cards ── */}
      <section className="ad-kpi-grid">

        <div className="ad-kpi-card ad-kpi-card--saffron">
          <div className="ad-kpi-icon">🗳</div>
          <div className="ad-kpi-body">
            <span className="ad-kpi-label">Total Votes Cast</span>
            <span className="ad-kpi-value">{totalVotes.toLocaleString()}</span>
          </div>
        </div>

        <div className="ad-kpi-card ad-kpi-card--blue">
          <div className="ad-kpi-icon">📋</div>
          <div className="ad-kpi-body">
            <span className="ad-kpi-label">Registered Voters</span>
            <span className="ad-kpi-value">{registered.toLocaleString()}</span>
          </div>
        </div>

        <div className="ad-kpi-card ad-kpi-card--green">
          <div className="ad-kpi-icon">✅</div>
          <div className="ad-kpi-body">
            <span className="ad-kpi-label">Voted</span>
            <span className="ad-kpi-value">{voted.toLocaleString()}</span>
          </div>
        </div>

        <div className="ad-kpi-card ad-kpi-card--muted">
          <div className="ad-kpi-icon">⏳</div>
          <div className="ad-kpi-body">
            <span className="ad-kpi-label">Yet to Vote</span>
            <span className="ad-kpi-value">{remaining.toLocaleString()}</span>
          </div>
        </div>

      </section>

      {/* ── Turnout + Leader ── */}
      <section className="ad-highlight-row">

        {/* Turnout */}
        <div className="ad-turnout-card">
          <div className="ad-turnout-top">
            <span className="ad-section-label">Voter Turnout</span>
            <span className="ad-turnout-pct">{turnout}%</span>
          </div>
          <div className="ad-turnout-track">
            <div className="ad-turnout-saffron" style={{ width: `${Math.min(turnout, 100)}%` }} />
          </div>
          <div className="ad-turnout-meta">
            <span>{voted} voted</span>
            <span>{remaining} remaining</span>
          </div>
        </div>

        {/* Leader */}
        {leader ? (
          <div className="ad-leader-card">
            <span className="ad-section-label">Currently Leading</span>
            <div className="ad-leader-body">
              <span className="ad-leader-trophy">🏆</span>
              <div>
                <div className="ad-leader-name">{leader[0]}</div>
                <div className="ad-leader-votes">{leader[1].toLocaleString()} votes</div>
              </div>
            </div>
            <div className="ad-leader-share">
              {totalVotes ? ((leader[1] / totalVotes) * 100).toFixed(1) : 0}% vote share
            </div>
          </div>
        ) : (
          <div className="ad-leader-card ad-leader-card--empty">
            <span className="ad-section-label">Currently Leading</span>
            <p>No votes recorded yet</p>
          </div>
        )}

      </section>

      {/* ── Party Results ── */}
      <section className="ad-section">
        <h2 className="ad-section-title">
          <span className="ad-section-accent" />
          Party-wise Results
        </h2>

        <div className="ad-results-table">
          <div className="ad-results-head">
            <span>Rank</span>
            <span>Party</span>
            <span>Votes</span>
            <span>Share</span>
            <span className="ad-col-bar">Distribution</span>
          </div>

          {sortedResults.length === 0 && (
            <div className="ad-results-empty">No votes recorded yet</div>
          )}

          {sortedResults.map(([party, votes], i) => {
            const share = totalVotes ? ((votes / totalVotes) * 100).toFixed(1) : 0
            const color = PARTY_COLORS[i % PARTY_COLORS.length]
            return (
              <div className="ad-result-row" key={party}>
                <span className={`ad-rank${i === 0 ? " ad-rank--1" : i === 1 ? " ad-rank--2" : i === 2 ? " ad-rank--3" : ""}`}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </span>
                <span className="ad-party-name">{party}</span>
                <span className="ad-vote-num">{votes.toLocaleString()}</span>
                <span className="ad-share-num">{share}%</span>
                <div className="ad-bar-col">
                  <div className="ad-bar-track">
                    <div
                      className="ad-bar-fill"
                      style={{ width: `${share}%`, background: color }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Gender + Charts ── */}
      <section className="ad-bottom-grid">

        {/* Gender */}
        <div className="ad-gender-card">
          <h2 className="ad-section-title">
            <span className="ad-section-accent" />
            Gender Breakdown
          </h2>
          <div className="ad-gender-row">
            <div className="ad-gender-box ad-gender-box--male">
              <div className="ad-gender-icon">♂</div>
              <div className="ad-gender-count">{(gender?.male || 0).toLocaleString()}</div>
              <div className="ad-gender-label">Male Voters</div>
              <div className="ad-gender-share">
                {totalVotes ? (((gender?.male || 0) / totalVotes) * 100).toFixed(1) : 0}%
              </div>
            </div>
            <div className="ad-gender-box ad-gender-box--female">
              <div className="ad-gender-icon">♀</div>
              <div className="ad-gender-count">{(gender?.female || 0).toLocaleString()}</div>
              <div className="ad-gender-label">Female Voters</div>
              <div className="ad-gender-share">
                {totalVotes ? (((gender?.female || 0) / totalVotes) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>
        </div>

        {/* Pie chart */}
        <div className="ad-chart-card">
          <h2 className="ad-section-title">
            <span className="ad-section-accent" />
            Vote Distribution
          </h2>
          <div className="ad-chart-wrap">
            {totalVotes > 0
              ? <Pie data={pieData} options={{ ...chartOptions, scales: undefined }} />
              : <div className="ad-chart-empty">No vote data yet</div>
            }
          </div>
        </div>

        {/* Bar chart */}
        <div className="ad-chart-card">
          <h2 className="ad-section-title">
            <span className="ad-section-accent" />
            Gender Analysis
          </h2>
          <div className="ad-chart-wrap">
            <Bar data={barData} options={chartOptions} />
          </div>
        </div>

      </section>

      {/* ── Footer ── */}
      <footer className="ad-footer">
        <div className="ad-stripe ad-stripe--footer">
          <div className="ad-stripe-saffron" />
          <div className="ad-stripe-white"   />
          <div className="ad-stripe-green"   />
        </div>
        <p>Secure Electronic Voting System · Data refreshes every 3 seconds</p>
      </footer>

    </div>
  )
}