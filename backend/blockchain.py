"""
blockchain.py  —  Private Vote Ledger  (Fixed)

Fixes applied:
  BUG 8 — voter_id anonymization: store hash-of-voter_id, not raw voter_id
           Anyone reading blockchain.json could previously map voter→candidate.
           Now blockchain stores sha256(voter_id) so votes are unlinkable.

  BUG 9 — atomic writes: use temp file + os.replace() so a crash mid-write
           never corrupts blockchain.json. Old code wrote directly to the file.
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
        self.data          = data
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
        block.hash          = d["hash"]
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
        """
        ── FIX BUG 9: atomic write using a temp file + os.replace().
        If the process crashes during write, the original blockchain.json
        is untouched. os.replace() is atomic on POSIX (Linux/Render).
        """
        tmp = CHAIN_FILE + ".tmp"
        try:
            with open(tmp, "w") as f:
                json.dump([b.to_dict() for b in self.chain], f, indent=2)
            os.replace(tmp, CHAIN_FILE)   # atomic swap
        except Exception as e:
            print(f"[blockchain] Persist error: {e}")
            if os.path.exists(tmp):
                os.remove(tmp)
            raise

    # ── Voter anonymization helper ────────────────────────────────────

    @staticmethod
    def _anonymize(voter_id: str) -> str:
        """
        ── FIX BUG 8: never store raw voter_id in the blockchain.
        Store sha256(voter_id) instead — this prevents anyone reading
        blockchain.json from linking a vote back to a real voter.
        The anonymized token is still unique per voter (collision-free).
        """
        return "anon:" + hashlib.sha256(voter_id.encode()).hexdigest()[:20]

    # ── Public API ────────────────────────────────────────────────────

    @property
    def last_block(self) -> Block:
        return self.chain[-1]

    def add_block(self, voter_id: str, candidate: str) -> Block:
        """
        Seal a vote as a new block.
        voter_id is anonymized before being stored.
        Returns the new Block.
        """
        with _chain_lock:
            anon_id = self._anonymize(voter_id)   # ── FIX BUG 8
            new_block = Block(
                index         = len(self.chain),
                timestamp     = datetime.now(timezone.utc).isoformat(),
                data          = {"voter": anon_id, "candidate": candidate},
                previous_hash = self.last_block.hash,
            )
            self.chain.append(new_block)
            self._persist()                        # ── FIX BUG 9: now atomic
            print(
                f"[blockchain] Block #{new_block.index} added  "
                f"candidate={candidate}  anon={anon_id[:16]}…  "
                f"hash={new_block.hash[:12]}…"
            )
        return new_block

    def is_chain_valid(self) -> tuple[bool, str]:
        for i in range(1, len(self.chain)):
            current  = self.chain[i]
            previous = self.chain[i - 1]

            recomputed = current._compute_hash()
            if current.hash != recomputed:
                msg = f"Block #{i} hash mismatch — data may have been tampered."
                print(f"[blockchain] INVALID: {msg}")
                return False, msg

            if current.previous_hash != previous.hash:
                msg = f"Block #{i} previous_hash does not match Block #{i-1} hash."
                print(f"[blockchain] INVALID: {msg}")
                return False, msg

        return True, "Chain is valid."

    def to_list(self) -> list[dict]:
        return [b.to_dict() for b in self.chain]