import { useState, useEffect, useCallback, useRef } from "react";
import "../styles/blockchainExplorer.css";
// ↑ Place blockchainExplorer.css in the same folder as this file
//   OR adjust the import path to match your project structure,
//   e.g. "../styles/blockchainExplorer.css"

import { API } from "../config/api"

// ── Helpers ──────────────────────────────────────────────────────────

function fmtTime(ts) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch { return ts ?? "—"; }
}

function shortHash(h = "") {
  if (h.length < 20) return h;
  return h.slice(0, 10) + "…" + h.slice(-10);
}

// ── Single Block Card ────────────────────────────────────────────────

function BlockCard({ block, isOpen, onToggle }) {
  const isGenesis = block.index === 0;
  const candidate = isGenesis ? "Genesis Block" : (block.data?.candidate ?? "—");

  const idxClass  = isGenesis ? "g" : "v";
  const nodeClass = isGenesis ? "genesis" : "";

  return (
    <div className="bc-block-wrap">

      {/* Spine node */}
      <div className="bc-node">
        <div className={`bc-nd ${nodeClass}`} />
      </div>

      {/* Card */}
      <div className={`bc-block${isGenesis ? " genesis" : ""}`}>

        {/* ── Header (clickable) ── */}
        <div
          className={`bc-bhead${isOpen ? " is-open" : ""}`}
          onClick={onToggle}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === "Enter" && onToggle()}
          aria-expanded={isOpen}
        >
          <div className={`bc-idx ${idxClass}`}>#{block.index}</div>

          <div className="bc-bmeta">
            <div className="bc-btitle">{candidate}</div>
            <div className="bc-btime">{fmtTime(block.timestamp)}</div>
          </div>

          <div className="bc-hash-chip">{shortHash(block.hash)}</div>

          <span className={`bc-badge ${isGenesis ? "genesis" : "vote"}`}>
            {isGenesis ? "⬡ genesis" : "⬡ sealed"}
          </span>

          <svg
            className={`bc-chevron${isOpen ? " open" : ""}`}
            width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {/* ── Expanded body ── */}
        {isOpen && (
          <div className="bc-bbody">

            <div className="bc-frow">
              <div className="bc-field">
                <span className="bc-flbl">Block Index</span>
                <span className="bc-fval">{block.index}</span>
              </div>
              <div className="bc-field">
                <span className="bc-flbl">Timestamp (UTC)</span>
                <span className="bc-fval">{block.timestamp}</span>
              </div>
            </div>

            {isGenesis ? (
              <div className="bc-field">
                <span className="bc-flbl">Data</span>
                <span className="bc-fval blue">GENESIS — chain origin block. No vote data.</span>
              </div>
            ) : (
              <div className="bc-frow">
                <div className="bc-field">
                  <span className="bc-flbl">Candidate Voted</span>
                  <span className="bc-fval green">{block.data?.candidate}</span>
                </div>
                <div className="bc-field">
                  <span className="bc-flbl">Voter ID (SHA-256, truncated)</span>
                  <span className="bc-fval dim">
                    {block.data?.voter
                      ? block.data.voter.slice(0, 24) + "…"
                      : "—"}
                  </span>
                </div>
              </div>
            )}

            <div className="bc-link-arrow">hash chain linkage</div>

            <div className="bc-field">
              <span className="bc-flbl">Current Block Hash (SHA-256)</span>
              <span className="bc-fval gold">{block.hash}</span>
            </div>

            <div className="bc-field">
              <span className="bc-flbl">Previous Block Hash</span>
              <span className="bc-fval blue">{block.previous_hash}</span>
            </div>

          </div>
        )}
      </div>
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
  const [validity,   setValidity]   = useState(null);
  const [verifying,  setVerifying]  = useState(false);
  const [reversed,   setReversed]   = useState(false);
  const intervalRef                 = useRef(null);

  // ── Fetch ───────────────────────────────────────────────────────
  const fetchChain = useCallback(async () => {
    setError(null);
    try {
      const res  = await fetch(`${API}/blockchain`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setChain(json.chain || []);
    } catch (e) {
      setError("Cannot reach backend: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChain();
    intervalRef.current = setInterval(fetchChain, 10000);
    return () => clearInterval(intervalRef.current);
  }, [fetchChain]);

  // ── Verify ──────────────────────────────────────────────────────
  const verifyChain = async () => {
    setVerifying(true);
    try {
      const res  = await fetch(`${API}/blockchain/verify`);
      const json = await res.json();
      setValidity({ valid: json.valid, message: json.message });
    } catch {
      setValidity({ valid: false, message: "Verification request failed — backend unreachable." });
    } finally {
      setVerifying(false);
    }
  };

  // ── Toggle block ────────────────────────────────────────────────
  const toggleBlock = idx =>
    setOpenBlocks(prev => {
      const n = new Set(prev);
      n.has(idx) ? n.delete(idx) : n.add(idx);
      return n;
    });

  // ── Filter ──────────────────────────────────────────────────────
  const filtered = chain.filter(b => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      b.hash?.toLowerCase().includes(q)            ||
      b.previous_hash?.toLowerCase().includes(q)   ||
      b.data?.candidate?.toLowerCase().includes(q) ||
      b.data?.voter?.toLowerCase().includes(q)     ||
      String(b.index).includes(q)
    );
  });

  const displayed   = reversed ? [...filtered].reverse() : filtered;
  const voteCount   = chain.filter(b => b.index > 0).length;
  const latestBlock = chain.length > 0 ? chain[chain.length - 1] : null;

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="bc-root">
      <div className="bc-ambient" />

      {/* Top bar */}
      <div className="bc-topbar">
        <div className="bc-topbar-left">
          {onBack && (
            <button className="bc-back-btn" onClick={onBack}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Dashboard
            </button>
          )}
          <div className="bc-brand">
            <div className="bc-brand-icon">⛓</div>
            <div>
              <div className="bc-brand-name">Blockchain Explorer</div>
              <div className="bc-brand-sub">Vote Ledger</div>
            </div>
          </div>
        </div>
        <div className="bc-live-pill">
          <span className="bc-live-dot"/>
          LIVE · 10s refresh
        </div>
      </div>

      <div className="bc-content">

        {/* Hero */}
        <div className="bc-hero">
          <div className="bc-hero-eye">Private · SHA-256 · Immutable</div>
          <h1 className="bc-hero-title">Vote <span>Ledger</span></h1>
          <p className="bc-hero-desc">
            Every cast vote is permanently sealed as a cryptographic block.
            Tampering any block breaks every subsequent hash — making fraud mathematically detectable.
          </p>
        </div>

        {/* Stats */}
        {!loading && !error && (
          <div className="bc-stats-grid">
            <div className="bc-stat">
              <div className="bc-stat-icon">⛓</div>
              <div className="bc-stat-num">{chain.length}</div>
              <div className="bc-stat-lbl">Total Blocks</div>
            </div>
            <div className="bc-stat">
              <div className="bc-stat-icon">🗳</div>
              <div className="bc-stat-num g">{voteCount}</div>
              <div className="bc-stat-lbl">Votes Sealed</div>
            </div>
            <div className="bc-stat">
              <div className="bc-stat-icon">🔐</div>
              <div className={`bc-stat-num ${
                validity === null ? "" : validity.valid ? "g" : "r"
              }`}>
                {validity === null ? "—" : validity.valid ? "✓ Valid" : "✗ Tampered"}
              </div>
              <div className="bc-stat-lbl">Chain Integrity</div>
            </div>
            <div className="bc-stat">
              <div className="bc-stat-icon">📦</div>
              <div className="bc-stat-num b">
                #{latestBlock ? latestBlock.index : "—"}
              </div>
              <div className="bc-stat-lbl">Latest Block</div>
            </div>
          </div>
        )}

        {/* Verify banner */}
        {validity && (
          <div className={`bc-verify-banner ${validity.valid ? "valid" : "invalid"}`}>
            <span>{validity.valid ? "✅" : "🚨"}</span>
            {validity.message}
          </div>
        )}

        {/* Toolbar */}
        <div className="bc-toolbar">
          <div className="bc-search-wrap">
            <svg className="bc-search-ico" width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="bc-search"
              placeholder="Search block #, candidate, hash, voter ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <button className="bc-btn bc-btn-gold" onClick={fetchChain} disabled={loading}>
            {loading
              ? <span className="bc-spin"/>
              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5">
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
            }
            Refresh
          </button>

          <button className="bc-btn bc-btn-blue" onClick={verifyChain} disabled={verifying}>
            {verifying ? <span className="bc-spin w"/> : "🔐"}
            Verify Integrity
          </button>

          <button className="bc-btn bc-btn-ghost" onClick={() => setReversed(v => !v)}>
            {reversed ? "↑ Oldest first" : "↓ Latest first"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bc-err"><span>⚠</span> {error}</div>
        )}

        {/* Loading */}
        {loading && (
          <div className="bc-loading">
            <div className="bc-spin lg"/>
            <div style={{ marginTop: "1rem" }}>Loading blockchain…</div>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && displayed.length === 0 && (
          <div className="bc-empty">
            <div className="bc-empty-icon">{search ? "🔍" : "⛓"}</div>
            <div className="bc-empty-text">
              {search
                ? `No blocks match "${search}"`
                : "No blocks yet. Cast a vote to create the first block."}
            </div>
          </div>
        )}

        {/* Chain */}
        {!loading && !error && displayed.length > 0 && (
          <div className="bc-chain-wrap">
            <div className="bc-spine"/>
            <div className="bc-chain">
              {displayed.map(block => (
                <BlockCard
                  key={block.index}
                  block={block}
                  isOpen={openBlocks.has(block.index)}
                  onToggle={() => toggleBlock(block.index)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        {!loading && !error && (
          <div className="bc-footer">
            <div>SECURE E-VOTING SYSTEM · PRIVATE BLOCKCHAIN LEDGER</div>
            <div>SHA-256 · block_hash = f(index + timestamp + data + previous_hash)</div>
            <div style={{ marginTop: ".5rem", opacity: .45 }}>
              {chain.length} block{chain.length !== 1 ? "s" : ""} · {voteCount} vote{voteCount !== 1 ? "s" : ""} sealed
            </div>
          </div>
        )}

      </div>
    </div>
  );
}