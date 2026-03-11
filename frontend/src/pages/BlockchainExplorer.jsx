import { useState, useEffect, useCallback } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

// ── Palette (matches existing app.css institutional dark theme) ──────
const css = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Sora:wght@400;600;700&display=swap');

.bc-root {
  min-height: 100vh;
  background: #020817;
  color: #e2e8f0;
  font-family: 'Sora', sans-serif;
  padding: 2rem 1.5rem 4rem;
}

/* ── Header ── */
.bc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 2.5rem;
}
.bc-title {
  font-size: 1.6rem;
  font-weight: 700;
  color: #c9a84c;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.bc-title svg { flex-shrink: 0; }
.bc-subtitle {
  font-size: 0.8rem;
  color: #64748b;
  margin-top: 0.2rem;
  font-family: 'IBM Plex Mono', monospace;
}

/* ── Stats bar ── */
.bc-stats {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 2rem;
}
.bc-stat {
  background: #0a1628;
  border: 1px solid #1e3a5f;
  border-radius: 10px;
  padding: 0.75rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 120px;
}
.bc-stat-label {
  font-size: 0.7rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-family: 'IBM Plex Mono', monospace;
}
.bc-stat-value {
  font-size: 1.4rem;
  font-weight: 700;
  color: #c9a84c;
  font-family: 'IBM Plex Mono', monospace;
}
.bc-stat-value.valid   { color: #22c55e; }
.bc-stat-value.invalid { color: #ef4444; }

/* ── Controls ── */
.bc-controls {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 2rem;
  align-items: center;
}
.bc-btn {
  font-family: 'Sora', sans-serif;
  font-size: 0.82rem;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  padding: 0.55rem 1.2rem;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.bc-btn:hover  { opacity: 0.88; transform: translateY(-1px); }
.bc-btn:active { transform: translateY(0); }
.bc-btn-primary   { background: #c9a84c; color: #020817; }
.bc-btn-secondary { background: #0a1628; color: #94a3b8; border: 1px solid #1e3a5f; }
.bc-btn-verify    { background: #4f6bed; color: #fff; }
.bc-btn-danger    { background: #1e1212; color: #f87171; border: 1px solid #3d1515; }

.bc-search {
  flex: 1;
  min-width: 200px;
  background: #0a1628;
  border: 1px solid #1e3a5f;
  border-radius: 8px;
  padding: 0.5rem 1rem;
  color: #e2e8f0;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.78rem;
  outline: none;
}
.bc-search::placeholder { color: #334155; }
.bc-search:focus { border-color: #c9a84c; }

/* ── Chain visual ── */
.bc-chain {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.bc-connector {
  width: 2px;
  height: 20px;
  background: linear-gradient(to bottom, #1e3a5f, #c9a84c44);
  margin-left: 28px;
}

/* ── Block card ── */
.bc-block {
  background: #0a1628;
  border: 1px solid #1e3a5f;
  border-radius: 12px;
  overflow: hidden;
  transition: border-color 0.2s;
  animation: bc-slide-in 0.3s ease both;
}
.bc-block:hover { border-color: #c9a84c55; }
.bc-block.genesis { border-color: #4f6bed55; }
.bc-block.tampered { border-color: #ef444455 !important; background: #1a0808; }

@keyframes bc-slide-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.bc-block-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1.2rem;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s;
}
.bc-block-header.open { border-color: #1e3a5f; }

.bc-block-num {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'IBM Plex Mono', monospace;
  font-weight: 600;
  font-size: 0.8rem;
  flex-shrink: 0;
}
.bc-block-num.genesis-num { background: #4f6bed22; color: #4f6bed; border: 1px solid #4f6bed44; }
.bc-block-num.vote-num    { background: #c9a84c22; color: #c9a84c; border: 1px solid #c9a84c44; }

.bc-block-summary {
  flex: 1;
  min-width: 0;
}
.bc-block-candidate {
  font-weight: 600;
  font-size: 0.9rem;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bc-block-ts {
  font-size: 0.7rem;
  color: #475569;
  font-family: 'IBM Plex Mono', monospace;
  margin-top: 0.15rem;
}
.bc-block-hash-preview {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.7rem;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}
.bc-chevron {
  color: #475569;
  transition: transform 0.2s;
  flex-shrink: 0;
}
.bc-chevron.open { transform: rotate(180deg); }

/* ── Block detail ── */
.bc-block-detail {
  padding: 1rem 1.2rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.bc-field { display: flex; flex-direction: column; gap: 0.25rem; }
.bc-field-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #475569;
  font-family: 'IBM Plex Mono', monospace;
}
.bc-field-value {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.75rem;
  color: #94a3b8;
  background: #020817;
  border: 1px solid #1e2d40;
  border-radius: 6px;
  padding: 0.4rem 0.75rem;
  word-break: break-all;
  cursor: text;
}
.bc-field-value.hash-current  { color: #c9a84c; border-color: #c9a84c22; }
.bc-field-value.hash-prev     { color: #4f6bed; border-color: #4f6bed22; }
.bc-field-value.voter-id      { color: #64748b; }
.bc-field-value.candidate-val { color: #22c55e; font-weight: 600; }
.bc-field-value.genesis-val   { color: #4f6bed; }

.bc-row { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.bc-row .bc-field { flex: 1; min-width: 160px; }

/* ── Status badge ── */
.bc-badge {
  font-size: 0.68rem;
  font-weight: 600;
  border-radius: 99px;
  padding: 0.2rem 0.7rem;
  font-family: 'IBM Plex Mono', monospace;
}
.bc-badge-genesis  { background: #4f6bed22; color: #4f6bed; border: 1px solid #4f6bed44; }
.bc-badge-vote     { background: #22c55e22; color: #22c55e; border: 1px solid #22c55e44; }
.bc-badge-tampered { background: #ef444422; color: #ef4444; border: 1px solid #ef444444; }

/* ── Empty / loading / error states ── */
.bc-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #334155;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.85rem;
}
.bc-state svg { margin-bottom: 1rem; opacity: 0.3; }

/* ── Verify banner ── */
.bc-verify-banner {
  border-radius: 10px;
  padding: 0.75rem 1.25rem;
  font-size: 0.82rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  font-family: 'IBM Plex Mono', monospace;
}
.bc-verify-banner.valid   { background: #052016; border: 1px solid #166534; color: #4ade80; }
.bc-verify-banner.invalid { background: #1a0808; border: 1px solid #991b1b; color: #f87171; }

/* ── Spinner ── */
.bc-spin {
  display: inline-block;
  width: 16px; height: 16px;
  border: 2px solid #c9a84c44;
  border-top-color: #c9a84c;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Back button ── */
.bc-back {
  background: none;
  border: none;
  color: #64748b;
  font-family: 'Sora', sans-serif;
  font-size: 0.82rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0;
  margin-bottom: 1.5rem;
  transition: color 0.15s;
}
.bc-back:hover { color: #c9a84c; }
`;

// ── Helpers ──────────────────────────────────────────────────────────

function fmt(ts) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return ts;
  }
}

function shortHash(h = "") {
  return h.slice(0, 8) + "…" + h.slice(-8);
}

// ── Single Block Card ────────────────────────────────────────────────

function BlockCard({ block, index, isOpen, onToggle, isGenesis, isTampered }) {
  const candidate = isGenesis
    ? "Genesis Block"
    : block.data?.candidate ?? "—";

  return (
    <div className={`bc-block${isGenesis ? " genesis" : ""}${isTampered ? " tampered" : ""}`}>
      <div
        className={`bc-block-header${isOpen ? " open" : ""}`}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === "Enter" && onToggle()}
      >
        <div className={`bc-block-num ${isGenesis ? "genesis-num" : "vote-num"}`}>
          #{block.index}
        </div>

        <div className="bc-block-summary">
          <div className="bc-block-candidate">{candidate}</div>
          <div className="bc-block-ts">{fmt(block.timestamp)}</div>
        </div>

        <div className="bc-block-hash-preview">{shortHash(block.hash)}</div>

        {isTampered && (
          <span className="bc-badge bc-badge-tampered">⚠ tampered</span>
        )}
        {isGenesis && !isTampered && (
          <span className="bc-badge bc-badge-genesis">genesis</span>
        )}
        {!isGenesis && !isTampered && (
          <span className="bc-badge bc-badge-vote">sealed</span>
        )}

        <svg
          className={`bc-chevron${isOpen ? " open" : ""}`}
          width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {isOpen && (
        <div className="bc-block-detail">
          <div className="bc-row">
            <div className="bc-field">
              <span className="bc-field-label">Block Index</span>
              <span className="bc-field-value">{block.index}</span>
            </div>
            <div className="bc-field">
              <span className="bc-field-label">Timestamp (UTC)</span>
              <span className="bc-field-value">{block.timestamp}</span>
            </div>
          </div>

          {!isGenesis && (
            <div className="bc-row">
              <div className="bc-field">
                <span className="bc-field-label">Candidate</span>
                <span className="bc-field-value candidate-val">{block.data?.candidate}</span>
              </div>
              <div className="bc-field">
                <span className="bc-field-label">Voter ID (SHA-256)</span>
                <span className="bc-field-value voter-id">
                  {block.data?.voter
                    ? block.data.voter.slice(0, 20) + "…"
                    : "—"}
                </span>
              </div>
            </div>
          )}

          {isGenesis && (
            <div className="bc-field">
              <span className="bc-field-label">Data</span>
              <span className="bc-field-value genesis-val">GENESIS — chain origin</span>
            </div>
          )}

          <div className="bc-field">
            <span className="bc-field-label">Current Hash (SHA-256)</span>
            <span className="bc-field-value hash-current">{block.hash}</span>
          </div>

          <div className="bc-field">
            <span className="bc-field-label">Previous Hash</span>
            <span className="bc-field-value hash-prev">{block.previous_hash}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export default function BlockchainExplorer({ onBack }) {
  const [chain,      setChain]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [openBlocks, setOpenBlocks] = useState(new Set([0]));
  const [search,     setSearch]     = useState("");
  const [validity,   setValidity]   = useState(null);   // {valid, message}
  const [verifying,  setVerifying]  = useState(false);
  const [showLatest, setShowLatest] = useState(false);

  // Fetch chain
  const fetchChain = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${API}/blockchain`);
      const json = await res.json();
      setChain(json.chain || []);
    } catch (e) {
      setError("Could not reach the backend. Is the server running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchChain(); }, [fetchChain]);

  // Verify integrity
  const verify = async () => {
    setVerifying(true);
    try {
      const res  = await fetch(`${API}/blockchain/verify`);
      const json = await res.json();
      setValidity({ valid: json.valid, message: json.message });
    } catch {
      setValidity({ valid: false, message: "Verification request failed." });
    } finally {
      setVerifying(false);
    }
  };

  const toggleBlock = (idx) =>
    setOpenBlocks(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });

  // Filter
  const filtered = chain.filter(b => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.hash?.toLowerCase().includes(q) ||
      b.previous_hash?.toLowerCase().includes(q) ||
      b.data?.candidate?.toLowerCase().includes(q) ||
      b.data?.voter?.toLowerCase().includes(q) ||
      String(b.index).includes(q)
    );
  });

  const displayed = showLatest ? [...filtered].reverse() : filtered;
  const voteBlocks = chain.filter(b => b.index > 0);

  return (
    <>
      <style>{css}</style>
      <div className="bc-root">

        {/* Back button */}
        {onBack && (
          <button className="bc-back" onClick={onBack}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Dashboard
          </button>
        )}

        {/* Header */}
        <div className="bc-header">
          <div>
            <div className="bc-title">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="#c9a84c" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2"/>
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                <line x1="12" y1="12" x2="12" y2="16"/>
                <line x1="10" y1="14" x2="14" y2="14"/>
              </svg>
              Blockchain Explorer
            </div>
            <div className="bc-subtitle">
              Private Vote Ledger — SHA-256 Immutable Chain
            </div>
          </div>
        </div>

        {/* Stats */}
        {!loading && !error && (
          <div className="bc-stats">
            <div className="bc-stat">
              <span className="bc-stat-label">Total Blocks</span>
              <span className="bc-stat-value">{chain.length}</span>
            </div>
            <div className="bc-stat">
              <span className="bc-stat-label">Votes Sealed</span>
              <span className="bc-stat-value">{voteBlocks.length}</span>
            </div>
            <div className="bc-stat">
              <span className="bc-stat-label">Chain Status</span>
              <span className={`bc-stat-value ${
                validity === null ? "" : validity.valid ? "valid" : "invalid"
              }`}>
                {validity === null ? "—" : validity.valid ? "✓ Valid" : "✗ Tampered"}
              </span>
            </div>
            <div className="bc-stat">
              <span className="bc-stat-label">Latest Block</span>
              <span className="bc-stat-value">
                #{chain.length > 0 ? chain[chain.length - 1].index : "—"}
              </span>
            </div>
          </div>
        )}

        {/* Verify banner */}
        {validity && (
          <div className={`bc-verify-banner ${validity.valid ? "valid" : "invalid"}`}>
            {validity.valid ? "✓" : "✗"} {validity.message}
          </div>
        )}

        {/* Controls */}
        <div className="bc-controls">
          <input
            className="bc-search"
            placeholder="Search by hash, candidate, voter ID, block #…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="bc-btn bc-btn-primary" onClick={fetchChain} disabled={loading}>
            {loading ? <span className="bc-spin"/> : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            )}
            Refresh
          </button>
          <button className="bc-btn bc-btn-verify" onClick={verify} disabled={verifying}>
            {verifying ? <span className="bc-spin" style={{borderTopColor:"#fff"}}/> : "🔐"}
            Verify Chain
          </button>
          <button
            className="bc-btn bc-btn-secondary"
            onClick={() => setShowLatest(v => !v)}
          >
            {showLatest ? "↑ Oldest first" : "↓ Latest first"}
          </button>
        </div>

        {/* States */}
        {loading && (
          <div className="bc-state">
            <div className="bc-spin" style={{margin:"0 auto 1rem",width:32,height:32,borderWidth:3}}/>
            Loading blockchain…
          </div>
        )}

        {error && (
          <div className="bc-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
              stroke="#ef4444" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div style={{color:"#ef4444"}}>{error}</div>
          </div>
        )}

        {!loading && !error && displayed.length === 0 && (
          <div className="bc-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            {search ? "No blocks match your search." : "No blocks in chain yet."}
          </div>
        )}

        {/* Chain */}
        {!loading && !error && displayed.length > 0 && (
          <div className="bc-chain">
            {displayed.map((block, i) => (
              <div key={block.index}>
                <BlockCard
                  block={block}
                  index={i}
                  isOpen={openBlocks.has(block.index)}
                  onToggle={() => toggleBlock(block.index)}
                  isGenesis={block.index === 0}
                  isTampered={false}
                />
                {i < displayed.length - 1 && <div className="bc-connector" />}
              </div>
            ))}
          </div>
        )}

      </div>
    </>
  );
}