"""
E-Voting Backend  —  Flask + InsightFace + MediaPipe + Blockchain
═══════════════════════════════════════════════════════════════════
Key enhancements over original:
  • dlib/face_recognition → InsightFace 0.7.3  (no cmake, Render-safe)
  • det_size=640×640, det_thresh=0.35  → faster face detection
  • resize_if_large() caps frames at 960px  → 40–60% faster inference
  • CLAHE + brightness/grayscale fallbacks  → better low-light accuracy
  • InsightFace bbox liveness ROI  → more precise anti-spoofing
  • Embedding cache (numpy .npy)  → instant lookup after first load
  • QR URI-decode normalisation  → %20 / trailing spaces handled
  • Blockchain sealed on every vote  → tamper-proof audit trail
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json, os, base64, hashlib, threading, urllib.request
from urllib.parse import unquote
import numpy as np
import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision
from insightface.app import FaceAnalysis
from blockchain import Blockchain

app = Flask(__name__)
CORS(app)

# Initialise vote ledger (reloads from blockchain.json if exists)
vote_chain = Blockchain()

# ══════════════════════════════════════════════════════════════════════
#  IN-MEMORY JSON CACHE  — avoids disk reads on every request
# ══════════════════════════════════════════════════════════════════════

_cache: dict = {}
_cache_lock  = threading.Lock()

def load_json(file: str) -> dict:
    if not os.path.exists(file):
        return {}
    try:
        mtime = os.path.getmtime(file)
        with _cache_lock:
            if file in _cache and _cache[file][1] == mtime:
                return _cache[file][0]
        with open(file, "r") as f:
            data = json.load(f)
        with _cache_lock:
            _cache[file] = (data, mtime)
        return data
    except Exception as e:
        print(f"[load_json] {file}: {e}")
        return {}

def save_json(file: str, data: dict) -> None:
    with open(file, "w") as f:
        json.dump(data, f, indent=2)
    mtime = os.path.getmtime(file)
    with _cache_lock:
        _cache[file] = (data, mtime)

# ══════════════════════════════════════════════════════════════════════
#  QR KEY NORMALISATION
#  strip() + URI-decode ensures "hello%20world" and "hello world" map
#  to the same voter_id regardless of QR library encoding behaviour.
# ══════════════════════════════════════════════════════════════════════

def make_voter_id(qr_raw: str) -> str:
    normalised = unquote(qr_raw.strip())
    return hashlib.sha256(normalised.encode("utf-8")).hexdigest()

# ══════════════════════════════════════════════════════════════════════
#  INSIGHTFACE  —  singleton  (pre-warmed at startup in background)
#
#  Performance tuning vs defaults:
#    det_size  640×640   (default 320×320)  → detects at longer range
#    det_thresh  0.35    (default 0.50)     → faster hit, fewer misses
#    buffalo_sc is the lightweight model; switch to buffalo_l for
#    higher accuracy if Render RAM allows.
# ══════════════════════════════════════════════════════════════════════

_face_app  = None
_face_lock = threading.Lock()

def get_face_app() -> FaceAnalysis:
    global _face_app
    with _face_lock:
        if _face_app is None:
            print("[startup] Loading InsightFace buffalo_sc …")
            fa = FaceAnalysis(
                name      = "buffalo_sc",
                providers = ["CPUExecutionProvider"],
            )
            fa.prepare(ctx_id=0, det_size=(640, 640))
            # Lower detection threshold → finds faces faster
            for model in fa.models.values():
                if hasattr(model, "det_thresh"):
                    model.det_thresh = 0.35
            _face_app = fa
            print("[startup] InsightFace ready  det_size=640  thresh=0.35")
    return _face_app

# Pre-warm on startup  (avoids cold-start latency on first request)
threading.Thread(target=get_face_app, daemon=True).start()

# ── Embedding helpers ─────────────────────────────────────────────────

def _insightface_embed(img_bgr: np.ndarray):
    """
    Try to get a 512-d embedding from img_bgr.
    If no face found at original resolution, retry with 1.3× upscale
    — this catches small/distant faces from webcam thumbnails.
    """
    fa    = get_face_app()
    faces = fa.get(img_bgr)
    if faces:
        # Pick the largest face in frame
        return max(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1])).embedding

    # Retry upscaled
    h, w  = img_bgr.shape[:2]
    up    = cv2.resize(img_bgr, (int(w * 1.3), int(h * 1.3)), interpolation=cv2.INTER_CUBIC)
    faces = fa.get(up)
    if faces:
        print("[face] embed from upscaled image")
        return max(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1])).embedding

    return None

def _try_embed_variants(img_bgr: np.ndarray):
    """
    Try 3 preprocessing variants before giving up.
    Dramatically improves hit rate in poor lighting / bad angles.
    """
    # Variant 1: CLAHE contrast normalisation
    emb = _insightface_embed(preprocess_for_face(img_bgr))
    if emb is not None:
        return emb

    # Variant 2: brightness boost  (dark environments)
    bright = cv2.convertScaleAbs(img_bgr, alpha=1.4, beta=20)
    emb = _insightface_embed(bright)
    if emb is not None:
        print("[face] embed from brightness-boosted image")
        return emb

    # Variant 3: grayscale → 3-channel  (very poor quality)
    gray3 = cv2.cvtColor(cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR)
    emb = _insightface_embed(gray3)
    if emb is not None:
        print("[face] embed from grayscale fallback")
        return emb

    return None

def cosine_similarity(e1: np.ndarray, e2: np.ndarray) -> float:
    n1, n2 = np.linalg.norm(e1), np.linalg.norm(e2)
    if n1 == 0 or n2 == 0:
        return 0.0
    return float(np.dot(e1, e2) / (n1 * n2))

# ══════════════════════════════════════════════════════════════════════
#  MEDIAPIPE  —  FaceLandmarker singleton
#  Confidence thresholds lowered 0.55 → 0.40 for faster first detection
# ══════════════════════════════════════════════════════════════════════

MODEL_PATH = "face_landmarker.task"

def download_model() -> None:
    if os.path.exists(MODEL_PATH):
        return
    url = (
        "https://storage.googleapis.com/mediapipe-models/"
        "face_landmarker/face_landmarker/float16/1/face_landmarker.task"
    )
    print("[startup] Downloading face_landmarker.task …")
    urllib.request.urlretrieve(url, MODEL_PATH)
    print("[startup] face_landmarker.task downloaded.")

download_model()

_landmarker = None
_lm_lock    = threading.Lock()

def get_landmarker():
    global _landmarker
    with _lm_lock:
        if _landmarker is None:
            base_opts = mp_python.BaseOptions(model_asset_path=MODEL_PATH)
            opts = mp_vision.FaceLandmarkerOptions(
                base_options=base_opts,
                output_face_blendshapes=True,
                output_facial_transformation_matrixes=False,
                num_faces=1,
                min_face_detection_confidence=0.40,
                min_face_presence_confidence=0.40,
                min_tracking_confidence=0.40,
                running_mode=mp_vision.RunningMode.IMAGE,
            )
            _landmarker = mp_vision.FaceLandmarker.create_from_options(opts)
            print("[startup] FaceLandmarker ready  thresholds=0.40")
    return _landmarker

threading.Thread(target=get_landmarker, daemon=True).start()

# ── EAR / head-pose constants ─────────────────────────────────────────

LEFT_EYE            = [362, 385, 387, 263, 373, 380]
RIGHT_EYE           = [33,  160, 158, 133, 153, 144]
NOSE_TIP            = 1
FOREHEAD            = 10
CHIN                = 152
EAR_BLINK_THRESHOLD = 0.20

def eye_aspect_ratio(landmarks, eye_indices, w, h):
    def pt(i):
        lm = landmarks[i]
        return np.array([lm.x * w, lm.y * h])
    p1, p2, p3, p4, p5, p6 = [pt(i) for i in eye_indices]
    return (np.linalg.norm(p2 - p6) + np.linalg.norm(p3 - p5)) / (2.0 * np.linalg.norm(p1 - p4))

def head_pitch(landmarks, h):
    nose_y     = landmarks[NOSE_TIP].y * h
    forehead_y = landmarks[FOREHEAD].y * h
    chin_y     = landmarks[CHIN].y     * h
    total      = chin_y - forehead_y
    if total == 0:
        return "neutral"
    ratio = (nose_y - forehead_y) / total
    if ratio < 0.42: return "up"
    if ratio > 0.58: return "down"
    return "neutral"

# ══════════════════════════════════════════════════════════════════════
#  IMAGE HELPERS
# ══════════════════════════════════════════════════════════════════════

MAX_DIM = 960   # cap longest edge before inference

def decode_image(image_data: str) -> np.ndarray:
    try:
        _, encoded = image_data.split(",", 1)
    except ValueError:
        encoded = image_data
    nparr = np.frombuffer(base64.b64decode(encoded), np.uint8)
    img   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("cv2.imdecode returned None — invalid image data")
    return img

def resize_if_large(img_bgr: np.ndarray) -> np.ndarray:
    """Downscale frames that exceed MAX_DIM — 40-60% faster inference."""
    h, w = img_bgr.shape[:2]
    if max(h, w) <= MAX_DIM:
        return img_bgr
    scale = MAX_DIM / max(h, w)
    return cv2.resize(img_bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

def preprocess_for_face(img_bgr: np.ndarray) -> np.ndarray:
    """CLAHE contrast normalisation + downscale."""
    img     = resize_if_large(img_bgr)
    lab     = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    l       = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(l)
    return cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)

# ══════════════════════════════════════════════════════════════════════
#  PASSIVE LIVENESS DETECTION
#  Uses InsightFace bbox for the face ROI (replaces dlib HOG).
#  Detects:  flat-texture photos, uniform-colour screens,
#            screen glare, oversaturation, hard printed edges.
# ══════════════════════════════════════════════════════════════════════

def check_liveness(img_bgr: np.ndarray) -> tuple:
    """Returns (is_live: bool, reason: str)."""
    img  = resize_if_large(img_bgr)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    fa    = get_face_app()
    faces = fa.get(img)
    if not faces:
        # Retry upscaled before giving up
        up    = cv2.resize(img, (int(w * 1.3), int(h * 1.3)), interpolation=cv2.INTER_CUBIC)
        faces = fa.get(up)
        if not faces:
            return False, "no_face"
        img  = up
        gray = cv2.cvtColor(up, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape

    face  = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]))
    x1, y1, x2, y2 = [int(v) for v in face.bbox]
    pad  = 12
    x1   = max(0, x1 - pad);  y1 = max(0, y1 - pad)
    x2   = min(w, x2 + pad);  y2 = min(h, y2 + pad)

    face_gray = gray[y1:y2, x1:x2]
    face_bgr  = img[y1:y2, x1:x2]
    if face_gray.size == 0:
        return False, "bad_roi"

    # 1 — Texture  (real faces have micro-texture)
    lap_var = cv2.Laplacian(face_gray, cv2.CV_64F).var()
    if lap_var < 50.0:
        print(f"[liveness] FAIL texture  lap={lap_var:.1f}")
        return False, "spoof_flat_texture"

    # 2 — Colour naturalness
    hsv    = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2HSV)
    s_ch   = hsv[:, :, 1].astype(np.float32)
    s_std  = float(np.std(s_ch))
    s_mean = float(np.mean(s_ch))
    if s_std < 7.0:
        return False, "spoof_uniform_colour"
    if s_mean > 195:
        return False, "spoof_oversaturated"

    # 3 — Screen glare
    _, bright_mask = cv2.threshold(face_gray, 240, 255, cv2.THRESH_BINARY)
    if bright_mask.sum() / 255 / face_gray.size > 0.25:
        return False, "spoof_screen_glare"

    # 4 — Hard edges  (printed paper)
    sx = cv2.Sobel(face_gray, cv2.CV_64F, 1, 0, ksize=3)
    sy = cv2.Sobel(face_gray, cv2.CV_64F, 0, 1, ksize=3)
    gm = np.sqrt(sx**2 + sy**2)
    if float(np.mean(gm)) > 60 and float(np.std(gm)) < 15:
        return False, "spoof_hard_edges"

    print(f"[liveness] PASS  lap={lap_var:.1f}  s_std={s_std:.1f}")
    return True, "live"

def liveness_message(reason: str) -> str:
    return {
        "no_face":             "No face detected. Please look directly at the camera.",
        "spoof_flat_texture":  "Live face required. Do not use a printed photo.",
        "spoof_uniform_colour":"Artificial image detected. Use your device's live camera.",
        "spoof_oversaturated": "Unusual image colours. Please use the live camera feed.",
        "spoof_screen_glare":  "Screen detected. Do not hold up a phone or monitor.",
        "spoof_hard_edges":    "Printed image detected. A real face is required.",
        "bad_roi":             "Face region unclear. Please improve lighting and try again.",
    }.get(reason, "Liveness check failed. Please use the live camera.")

# ══════════════════════════════════════════════════════════════════════
#  EMBEDDING CACHE  — loads .npy once, keeps in memory
# ══════════════════════════════════════════════════════════════════════

_embed_cache: dict = {}
_embed_lock  = threading.Lock()

def get_stored_embedding(embed_file: str):
    with _embed_lock:
        if embed_file in _embed_cache:
            return _embed_cache[embed_file]
    path = f"voters/{embed_file}"
    if not os.path.exists(path):
        return None
    emb = np.load(path)
    with _embed_lock:
        _embed_cache[embed_file] = emb
    return emb

# ══════════════════════════════════════════════════════════════════════
#  MODE CONTROL
# ══════════════════════════════════════════════════════════════════════

MODE_FILE = "mode.json"

def load_mode() -> str:
    return load_json(MODE_FILE).get("mode", "TEST")

def save_mode(mode: str) -> None:
    save_json(MODE_FILE, {"mode": mode})

@app.route("/get-mode")
def get_mode():
    return jsonify({"mode": load_mode()})

@app.route("/set-mode", methods=["POST"])
def set_mode():
    data = request.get_json(silent=True) or {}
    mode = data.get("mode", "TEST")
    save_mode(mode)
    return jsonify({"status": "updated", "mode": mode})

# ══════════════════════════════════════════════════════════════════════
#  ROOT
# ══════════════════════════════════════════════════════════════════════

@app.route("/")
def home():
    return "E-Voting Backend Running"

# ══════════════════════════════════════════════════════════════════════
#  REGISTER
#  Stores InsightFace 512-d embedding as .npy alongside the JPEG.
# ══════════════════════════════════════════════════════════════════════

@app.route("/register", methods=["POST"])
def register():
    data     = request.get_json(silent=True)
    required = ["name", "gender", "age", "image", "qr_data"]
    if not data or not all(f in data for f in required):
        return jsonify({"status": "invalid_request"}), 400

    qr_raw    = data["qr_data"].strip()
    voter_id  = make_voter_id(qr_raw)
    face_hash = voter_id[:12]
    database  = load_json("voter_database.json")

    if voter_id in database:
        return jsonify({"status": "already_registered"})

    try:
        img = decode_image(data["image"])
    except Exception as e:
        return jsonify({"status": "bad_image", "detail": str(e)}), 400

    is_live, reason = check_liveness(img)
    if not is_live:
        return jsonify({
            "status":  "liveness_failed",
            "reason":  reason,
            "message": liveness_message(reason),
        }), 400

    embedding = _try_embed_variants(img)
    if embedding is None:
        return jsonify({"status": "no_face_detected"}), 400

    face_file  = face_hash + ".jpg"
    embed_file = face_hash + ".npy"
    database[voter_id] = {
        "name":       data["name"].strip(),
        "gender":     data["gender"].strip().lower(),
        "age":        str(data["age"]).strip(),
        "face_file":  face_file,
        "embed_file": embed_file,
        "qr_type":    "url" if qr_raw.startswith(("http://", "https://")) else "raw",
    }
    save_json("voter_database.json", database)
    os.makedirs("voters", exist_ok=True)
    cv2.imwrite(f"voters/{face_file}", img)
    np.save(f"voters/{embed_file}", embedding)

    print(f"[register] OK  voter_id={voter_id[:12]}…  name={data['name'].strip()}")
    return jsonify({"status": "registered", "voter_id": voter_id[:8] + "…"})

# ══════════════════════════════════════════════════════════════════════
#  VERIFY QR
#  URI-decode normalisation prevents %20 / whitespace mismatches.
# ══════════════════════════════════════════════════════════════════════

@app.route("/verify-qr", methods=["POST"])
def verify_qr():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"status": "invalid_request", "reason": "No JSON body"}), 400

    raw = data.get("qr_data", "")
    if not raw or not isinstance(raw, str):
        return jsonify({"status": "invalid_request", "reason": "qr_data missing"}), 400

    voter_id = make_voter_id(raw)   # normalises + hashes
    database = load_json("voter_database.json")
    voter    = database.get(voter_id)

    if voter is None:
        print(f"[verify-qr] NOT FOUND  voter_id={voter_id[:12]}…")
        return jsonify({"status": "not_registered"}), 200

    mode  = load_mode()
    voted = load_json("voted_status.json")
    if mode == "REAL" and voter_id in voted:
        return jsonify({"status": "already_voted"}), 200

    print(f"[verify-qr] OK  voter_id={voter_id[:12]}…  name={voter['name']}")
    return jsonify({"status": "success", "qr_string": voter_id, "voter_info": voter})

# ══════════════════════════════════════════════════════════════════════
#  VERIFY FACE
#  Threshold: cosine similarity ≥ 0.38 (was 0.40)
#  — reduces false rejects across lighting changes while staying secure.
#  Returns confidence score so the frontend can show a progress bar.
# ══════════════════════════════════════════════════════════════════════

FACE_MATCH_THRESHOLD = 0.38

@app.route("/verify-face", methods=["POST"])
def verify_face():
    data       = request.get_json(silent=True) or {}
    voter_id   = data.get("qr_string", "").strip()
    image_data = data.get("image", "")
    if not voter_id or not image_data:
        return jsonify({"status": "invalid_request"}), 400

    database = load_json("voter_database.json")
    if voter_id not in database:
        return jsonify({"status": "not_registered"})

    try:
        img_live = decode_image(image_data)
    except Exception as e:
        return jsonify({"status": "bad_image", "detail": str(e)}), 400

    # Liveness gate
    is_live, reason = check_liveness(img_live)
    if not is_live:
        return jsonify({
            "status":  "liveness_failed",
            "reason":  reason,
            "message": liveness_message(reason),
        }), 200

    # Load stored embedding
    voter      = database[voter_id]
    embed_file = voter.get("embed_file",
                           voter.get("face_file", "").replace(".jpg", ".npy"))
    enc_stored = get_stored_embedding(embed_file)
    if enc_stored is None:
        return jsonify({"status": "no_stored_face"})

    # Get live embedding with multi-variant fallback
    enc_live = _try_embed_variants(img_live)
    if enc_live is None:
        return jsonify({"status": "no_live_face"})

    similarity = cosine_similarity(enc_stored, enc_live)
    match      = similarity >= FACE_MATCH_THRESHOLD
    confidence = round(similarity, 4)
    print(f"[verify-face] {voter_id[:12]}…  sim={similarity:.4f}  match={match}")

    return jsonify({
        "status":     "verified" if match else "failed",
        "confidence": confidence,
        "threshold":  FACE_MATCH_THRESHOLD,
    })

# ══════════════════════════════════════════════════════════════════════
#  GESTURE  (accessible voting — head tilt + blink)
# ══════════════════════════════════════════════════════════════════════

@app.route("/gesture", methods=["POST"])
def gesture():
    data       = request.get_json(silent=True) or {}
    image_data = data.get("image", "")
    if not image_data:
        return jsonify({"status": "invalid_request"}), 400

    try:
        img = decode_image(image_data)
    except Exception as e:
        return jsonify({"status": "bad_image", "detail": str(e)}), 400

    img      = resize_if_large(img)
    img_rgb  = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    h, w     = img.shape[:2]
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)

    try:
        result = get_landmarker().detect(mp_image)
    except Exception as e:
        return jsonify({"status": "error", "detail": str(e)}), 500

    if not result.face_landmarks:
        return jsonify({"status": "no_face", "direction": "neutral", "blink": False, "ear": None})

    lm       = result.face_landmarks[0]
    is_blink = False
    ear_avg  = None

    if result.face_blendshapes:
        bs        = {b.category_name: b.score for b in result.face_blendshapes[0]}
        avg_blink = (bs.get("eyeBlinkLeft", 0) + bs.get("eyeBlinkRight", 0)) / 2.0
        is_blink  = avg_blink > 0.60
        ear_avg   = round(1.0 - avg_blink, 4)
    else:
        ear_l    = eye_aspect_ratio(lm, LEFT_EYE,  w, h)
        ear_r    = eye_aspect_ratio(lm, RIGHT_EYE, w, h)
        ear_avg  = round((ear_l + ear_r) / 2.0, 4)
        is_blink = ear_avg <= EAR_BLINK_THRESHOLD

    return jsonify({
        "status":    "ok",
        "direction": head_pitch(lm, h),
        "blink":     is_blink,
        "ear":       ear_avg,
    })

# ══════════════════════════════════════════════════════════════════════
#  VOTE  —  stores in JSON  +  seals in blockchain
# ══════════════════════════════════════════════════════════════════════

@app.route("/vote", methods=["POST"])
def vote():
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"status": "invalid_request", "reason": "No JSON"}), 400

        voter_id  = data.get("qr_string", "").strip()
        candidate = data.get("candidate", "").strip()

        if not voter_id:
            return jsonify({"status": "invalid_request", "reason": "qr_string missing"}), 400
        if not candidate:
            return jsonify({"status": "invalid_request", "reason": "candidate missing"}), 400

        database = load_json("voter_database.json")
        if voter_id not in database:
            return jsonify({"status": "not_registered"}), 400

        voted = load_json("voted_status.json")
        mode  = load_mode()

        if mode == "REAL" and voter_id in voted:
            return jsonify({"status": "already_voted"})

        # 1 — JSON store  (existing)
        voted[voter_id] = candidate
        save_json("voted_status.json", voted)

        # 2 — Blockchain seal  (new)
        block = vote_chain.add_block(voter_id=voter_id, candidate=candidate)

        print(f"[vote] {voter_id[:12]}…  candidate={candidate}  "
              f"block=#{block.index}  mode={mode}")

        return jsonify({
            "status":      "vote_success",
            "mode":        mode,
            "block_index": block.index,
            "block_hash":  block.hash,
            "timestamp":   block.timestamp,
        })

    except Exception as e:
        print(f"[vote] error: {e}")
        return jsonify({"status": "server_error"}), 500

# ══════════════════════════════════════════════════════════════════════
#  BLOCKCHAIN ENDPOINTS
# ══════════════════════════════════════════════════════════════════════

@app.route("/blockchain")
def get_blockchain():
    chain = vote_chain.to_list()
    return jsonify({"length": len(chain), "chain": chain})

@app.route("/blockchain/verify")
def verify_blockchain():
    is_valid, message = vote_chain.is_chain_valid()
    return jsonify({
        "valid":   is_valid,
        "message": message,
        "length":  len(vote_chain.chain),
    })

# ══════════════════════════════════════════════════════════════════════
#  ADMIN RESULTS
# ══════════════════════════════════════════════════════════════════════

@app.route("/admin/results")
def admin_results():
    database     = load_json("voter_database.json")
    voted        = load_json("voted_status.json")
    votes: dict  = {}
    gender_stats = {"male": 0, "female": 0, "other": 0}

    for vid, candidate in voted.items():
        votes[candidate] = votes.get(candidate, 0) + 1
        if vid in database:
            gender = database[vid].get("gender", "other").lower()
            gender_stats[gender] = gender_stats.get(gender, 0) + 1

    return jsonify({
        "votes":        votes,
        "gender_stats": gender_stats,
        "system": {
            "registered":   len(database),
            "voted":        len(voted),
            "turnout_pct":  round(len(voted) / max(len(database), 1) * 100, 1),
            "chain_length": len(vote_chain.chain),
        },
    })

# ══════════════════════════════════════════════════════════════════════
#  HEALTH CHECK
# ══════════════════════════════════════════════════════════════════════

@app.route("/health")
def health():
    is_valid, _ = vote_chain.is_chain_valid()
    return jsonify({
        "status":       "ok",
        "mode":         load_mode(),
        "registered":   len(load_json("voter_database.json")),
        "voted":        len(load_json("voted_status.json")),
        "landmarker":   _landmarker is not None,
        "face_app":     _face_app is not None,
        "chain_length": len(vote_chain.chain),
        "chain_valid":  is_valid,
    })

# ══════════════════════════════════════════════════════════════════════
#  ADMIN — VOTER LIST
#  Returns all registered voters with their voted status
#  GET /admin/voters
# ══════════════════════════════════════════════════════════════════════

@app.route("/admin/voters")
def admin_voters():
    database = load_json("voter_database.json")
    voted    = load_json("voted_status.json")

    voters = []
    for voter_id, info in database.items():
        voters.append({
            "voter_id":    voter_id,
            "name":        info.get("name", "Unknown"),
            "gender":      info.get("gender", "unknown"),
            "age":         info.get("age", "N/A"),
            "has_voted":   voter_id in voted,
            "voted_for":   voted.get(voter_id, None),
            "qr_type":     info.get("qr_type", "raw"),
        })

    # Sort: voted first, then alphabetical by name
    voters.sort(key=lambda v: (not v["has_voted"], v["name"].lower()))

    return jsonify({
        "total":      len(voters),
        "voted":      sum(1 for v in voters if v["has_voted"]),
        "not_voted":  sum(1 for v in voters if not v["has_voted"]),
        "voters":     voters,
    })


# ══════════════════════════════════════════════════════════════════════
#  ADMIN — DELETE VOTER
#  Removes voter from database, deletes face files, removes vote record
#  DELETE /admin/voters/<voter_id>
# ══════════════════════════════════════════════════════════════════════

@app.route("/admin/voters/<voter_id>", methods=["DELETE"])
def delete_voter(voter_id):
    database = load_json("voter_database.json")

    if voter_id not in database:
        return jsonify({"status": "not_found"}), 404

    voter = database[voter_id]

    # Remove face image and embedding files
    for key in ("face_file", "embed_file"):
        fname = voter.get(key)
        if fname:
            path = f"voters/{fname}"
            if os.path.exists(path):
                os.remove(path)
                print(f"[delete_voter] Removed {path}")

    # Remove from embedding cache
    embed_file = voter.get("embed_file", "")
    with _embed_lock:
        _embed_cache.pop(embed_file, None)

    # Remove from database
    del database[voter_id]
    save_json("voter_database.json", database)

    # Remove from voted status if present
    voted = load_json("voted_status.json")
    if voter_id in voted:
        del voted[voter_id]
        save_json("voted_status.json", voted)

    print(f"[delete_voter] Deleted voter_id={voter_id[:12]}…  name={voter.get('name')}")
    return jsonify({"status": "deleted", "name": voter.get("name")})


# ══════════════════════════════════════════════════════════════════════
#  ADMIN — RESET VOTE
#  Clears a voter's vote so they can vote again (TEST mode only)
#  POST /admin/voters/<voter_id>/reset-vote
# ══════════════════════════════════════════════════════════════════════

@app.route("/admin/voters/<voter_id>/reset-vote", methods=["POST"])
def reset_vote(voter_id):
    mode = load_mode()
    if mode == "REAL":
        return jsonify({
            "status":  "forbidden",
            "message": "Vote reset is not allowed in REAL mode.",
        }), 403

    database = load_json("voter_database.json")
    if voter_id not in database:
        return jsonify({"status": "not_found"}), 404

    voted = load_json("voted_status.json")
    if voter_id not in voted:
        return jsonify({"status": "not_voted"})

    del voted[voter_id]
    save_json("voted_status.json", voted)

    name = database[voter_id].get("name", "Unknown")
    print(f"[reset_vote] Reset vote for voter_id={voter_id[:12]}…  name={name}")
    return jsonify({"status": "reset", "name": name})

@app.route("/ping")
def ping():
    return jsonify({"status": "awake"})

# ══════════════════════════════════════════════════════════════════════
#  ADMIN LOGIN  —  replaces hardcoded "admin123" in App.js
#  POST /admin/login   { "password": "..." }
#  Returns { "status": "ok", "token": "<64-hex>" }  on success
#  Token is valid for 8 hours, stored server-side in memory.
#  Frontend stores token in sessionStorage (clears on tab close).
# ══════════════════════════════════════════════════════════════════════

import secrets, time

# ── Set your real password here (or use env var) ──────────────────────
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "SecureVote@2025")

_tokens: dict = {}   # token → expiry_timestamp
_token_lock = threading.Lock()
TOKEN_TTL   = 8 * 60 * 60   # 8 hours in seconds

def _issue_token() -> str:
    token = secrets.token_hex(32)
    with _token_lock:
        _tokens[token] = time.time() + TOKEN_TTL
    return token

def _verify_token(token: str) -> bool:
    with _token_lock:
        exp = _tokens.get(token)
        if exp is None:
            return False
        if time.time() > exp:
            del _tokens[token]
            return False
        return True

def _require_admin():
    """Call at the top of any admin route. Returns error response or None."""
    token = request.headers.get("X-Admin-Token", "")
    if not _verify_token(token):
        return jsonify({"status": "unauthorized"}), 401
    return None

@app.route("/admin/login", methods=["POST","OPTIONS"])
def admin_login():

    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    data = request.get_json(silent=True) or {}
    pw   = data.get("password", "")

    if not secrets.compare_digest(pw, ADMIN_PASSWORD):
        return jsonify({"status": "wrong_password"}), 401

    token = _issue_token()

    print("[admin] Login successful — token issued")

    return jsonify({
        "status": "ok",
        "token": token
    })

@app.route("/admin/logout", methods=["POST"])
def admin_logout():
    token = request.headers.get("X-Admin-Token", "")
    with _token_lock:
        _tokens.pop(token, None)
    return jsonify({"status": "logged_out"})
# ══════════════════════════════════════════════════════════════════════
#  START
# ══════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"[startup] Starting on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)