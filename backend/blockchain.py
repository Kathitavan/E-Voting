"""
blockchain.py  —  Private Vote Ledger
Each vote is sealed as an immutable SHA-256 block.
Pure Python stdlib — no extra dependencies.
"""

import hashlib
import json
import os
import threading
from datetime import datetime, timezone

CHAIN_FILE  = "blockchain.json"
_chain_lock = threading.Lock()


# ══════════════════════════════════════════════════════════════════════
#  BLOCK
# ══════════════════════════════════════════════════════════════════════

class Block:
    def __init__(
        self,
        index: int,
        timestamp: str,
        data: dict,
        previous_hash: str,
    ):
        self.index         = index
        self.timestamp     = timestamp
        self.data          = data          # {"voter": voter_id, "candidate": name}
        self.previous_hash = previous_hash
        self.hash          = self._compute_hash()

    def _compute_hash(self) -> str:
        payload = json.dumps(
            {
                "index":         self.index,
                "timestamp":     self.timestamp,
                "data":          self.data,
                "previous_hash": self.previous_hash,
            },
            sort_keys=True,
        )
        return hashlib.sha256(payload.encode()).hexdigest()

    def to_dict(self) -> dict:
        return {
            "index":         self.index,
            "timestamp":     self.timestamp,
            "data":          self.data,
            "previous_hash": self.previous_hash,
            "hash":          self.hash,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "Block":
        block               = cls.__new__(cls)
        block.index         = d["index"]
        block.timestamp     = d["timestamp"]
        block.data          = d["data"]
        block.previous_hash = d["previous_hash"]
        block.hash          = d["hash"]          # restored as-is; verified separately
        return block


# ══════════════════════════════════════════════════════════════════════
#  BLOCKCHAIN
# ══════════════════════════════════════════════════════════════════════

class Blockchain:
    def __init__(self):
        self.chain: list[Block] = []
        self._load_or_create()

    # ── Genesis ───────────────────────────────────────────────────────

    def _create_genesis_block(self) -> Block:
        return Block(
            index         = 0,
            timestamp     = datetime.now(timezone.utc).isoformat(),
            data          = {"voter": "GENESIS", "candidate": "GENESIS"},
            previous_hash = "0" * 64,
        )

    # ── Persistence ───────────────────────────────────────────────────

    def _load_or_create(self) -> None:
        if os.path.exists(CHAIN_FILE):
            try:
                with open(CHAIN_FILE, "r") as f:
                    raw = json.load(f)
                self.chain = [Block.from_dict(b) for b in raw]
                print(f"[blockchain] Loaded {len(self.chain)} blocks from disk.")
                return
            except Exception as e:
                print(f"[blockchain] Load error: {e} — starting fresh.")
        self.chain = [self._create_genesis_block()]
        self._persist()
        print("[blockchain] Genesis block created.")

    def _persist(self) -> None:
        with open(CHAIN_FILE, "w") as f:
            json.dump([b.to_dict() for b in self.chain], f, indent=2)

    # ── Public API ────────────────────────────────────────────────────

    @property
    def last_block(self) -> Block:
        return self.chain[-1]

    def add_block(self, voter_id: str, candidate: str) -> Block:
        """
        Seal a vote as a new block and append to the chain.
        Returns the new Block.
        """
        with _chain_lock:
            new_block = Block(
                index         = len(self.chain),
                timestamp     = datetime.now(timezone.utc).isoformat(),
                data          = {"voter": voter_id, "candidate": candidate},
                previous_hash = self.last_block.hash,
            )
            self.chain.append(new_block)
            self._persist()
            print(
                f"[blockchain] Block #{new_block.index} added  "
                f"candidate={candidate}  hash={new_block.hash[:12]}…"
            )
        return new_block

    def is_chain_valid(self) -> tuple[bool, str]:
        """
        Verify every block's hash and linkage.
        Returns (is_valid: bool, message: str).
        """
        for i in range(1, len(self.chain)):
            current  = self.chain[i]
            previous = self.chain[i - 1]

            # Recompute and compare
            recomputed = current._compute_hash()
            if current.hash != recomputed:
                msg = f"Block #{i} hash mismatch — data may have been tampered."
                print(f"[blockchain] INVALID: {msg}")
                return False, msg

            # Check linkage
            if current.previous_hash != previous.hash:
                msg = f"Block #{i} previous_hash does not match Block #{i-1} hash."
                print(f"[blockchain] INVALID: {msg}")
                return False, msg

        return True, "Chain is valid."

    def to_list(self) -> list[dict]:
        return [b.to_dict() for b in self.chain]