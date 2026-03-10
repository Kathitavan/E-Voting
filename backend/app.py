from flask import Flask, request, jsonify
from flask_cors import CORS
import json, os, base64, hashlib, threading, urllib.request
import numpy as np
import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

# InsightFace (replaces dlib + face_recognition — no cmake needed)
import insightface
from insightface.app import FaceAnalysis

app = Flask(__name__)
CORS(app)

# ══════════════════════════════════════════════════════════════════════
#  IN-MEMORY JSON CACHE
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
# ══════════════════════════════════════════════════════════════════════

def make_voter_id(qr_raw: str) -> str:
    """Always returns a 64-char SHA-256 hex — canonical voter DB key."""
    return hashlib.sha256(qr_raw.strip().encode("utf-8")).hexdigest()

# ══════════════════════════════════════════════════════════════════════
#  INSIGHTFACE  —  singleton face analyser (pre-warmed at startup)
#  Handles: face detection + 512-d embedding in one call.
#  No dlib, no cmake — pure ONNX pre-built wheels.
# ══════════════════════════════════════════════════════════════════════

_face_app  = None
_face_lock = threading.Lock()

def get_face_app() -> FaceAnalysis:
    global _face_app
    with _face_lock:
        if _face_app is None:
            print("[startup] Loading InsightFace model …")
            fa = FaceAnalysis(
                name="buffalo_sc",          # small, fast, CPU-friendly model
                providers=["CPUExecutionProvider"],
            )
            fa.prepare(ctx_id=0, det_size=(320, 320))
            _face_app = fa
            print("[startup] InsightFace ready.")
    return _face_app

# Pre-warm in background
threading.Thread(target=get_face_app, daemon=True).start()

def get_face_embedding(img_bgr: np.ndarray):
    """
    Returns the 512-d face embedding (numpy array) or None if no face found.
    img_bgr: OpenCV BGR image.
    """
    fa     = get_face_app()
    faces  = fa.get(img_bgr)
    if not faces:
        return None
    # Use the largest detected face
    face = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]))
    return face.embedding  # shape (512,), float32

def embedding_similarity(e1: np.ndarray, e2: np.ndarray) -> float:
    """Cosine similarity in [0, 1]. Higher = more similar."""
    n1 = np.linalg.norm(e1)
    n2 = np.linalg.norm(e2)
    if n1 == 0 or n2 == 0:
        return 0.0
    return float(np.dot(e1, e2) / (n1 * n2))

# ══════════════════════════════════════════════════════════════════════
#  MEDIAPIPE  —  FaceLandmarker singleton (gesture / blink / head-pose)
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
    print("[startup] Download complete.")

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
                min_face_detection_confidence=0.55,
                min_face_presence_confidence=0.55,
                min_tracking_confidence=0.55,
                running_mode=mp_vision.RunningMode.IMAGE,
            )
            _landmarker = mp_vision.FaceLandmarker.create_from_options(opts)
            print("[startup] FaceLandmarker ready.")
    return _landmarker

threading.Thread(target=get_landmarker, daemon=True).start()

# ══════════════════════════════════════════════════════════════════════
#  EAR / HEAD-POSE HELPERS
# ══════════════════════════════════════════════════════════════════════

LEFT_EYE            = [362, 385, 387, 263, 373, 380]
RIGHT_EYE           = [33,  160, 158, 133, 153, 144]
NOSE_TIP            = 1
FOREHEAD            = 10
CHIN                = 152
EAR_BLINK_THRESHOLD = 0.20

def eye_aspect_ratio(landmarks, eye_indices: list, w: int, h: int) -> float:
    def pt(i):
        lm = landmarks[i]
        return np.array([lm.x * w, lm.y * h])
    p1, p2, p3, p4, p5, p6 = [pt(i) for i in eye_indices]
    return (np.linalg.norm(p2-p6) + np.linalg.norm(p3-p5)) / (2.0 * np.linalg.norm(p1-p4))

def head_pitch(landmarks, h: int) -> str:
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
#  PASSIVE LIVENESS DETECTION  (no extra model — CV-based checks)
# ══════════════════════════════════════════════════════════════════════

def check_liveness(img_bgr: np.ndarray) -> tuple:
    """Returns (is_live: bool, reason: str)."""
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    # Use insightface to locate the face ROI
    fa    = get_face_app()
    faces = fa.get(img_bgr)
    if not faces:
        return False, "no_face"

    face  = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]))
    x1, y1, x2, y2 = [int(v) for v in face.bbox]
    pad   = 10
    x1    = max(0, x1 - pad)
    y1    = max(0, y1 - pad)
    x2    = min(w, x2 + pad)
    y2    = min(h, y2 + pad)

    face_gray = gray[y1:y2, x1:x2]
    face_bgr  = img_bgr[y1:y2, x1:x2]

    if face_gray.size == 0:
        return False, "bad_roi"

    # Check 1: Texture
    lap_var = cv2.Laplacian(face_gray, cv2.CV_64F).var()
    if lap_var < 55.0:
        print(f"[liveness] FAIL texture  lap_var={lap_var:.1f}")
        return False, "spoof_flat_texture"

    # Check 2: Colour naturalness
    hsv    = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2HSV)
    s_ch   = hsv[:, :, 1].astype(np.float32)
    s_std  = float(np.std(s_ch))
    s_mean = float(np.mean(s_ch))
    if s_std < 8.0:
        print(f"[liveness] FAIL uniform colour  s_std={s_std:.2f}")
        return False, "spoof_uniform_colour"
    if s_mean > 200:
        print(f"[liveness] FAIL oversaturated  s_mean={s_mean:.1f}")
        return False, "spoof_oversaturated"

    # Check 3: Screen glare
    _, bright_mask = cv2.threshold(face_gray, 240, 255, cv2.THRESH_BINARY)
    bright_ratio   = bright_mask.sum() / 255 / face_gray.size
    if bright_ratio > 0.25:
        print(f"[liveness] FAIL screen glare  bright_ratio={bright_ratio:.3f}")
        return False, "spoof_screen_glare"

    # Check 4: Edge sharpness
    sobelx   = cv2.Sobel(face_gray, cv2.CV_64F, 1, 0, ksize=3)
    sobely   = cv2.Sobel(face_gray, cv2.CV_64F, 0, 1, ksize=3)
    grad_mag = np.sqrt(sobelx**2 + sobely**2)
    g_mean   = float(np.mean(grad_mag))
    g_std    = float(np.std(grad_mag))
    if g_mean > 60 and g_std < 15:
        print(f"[liveness] FAIL hard edges  g_mean={g_mean:.1f} g_std={g_std:.1f}")
        return False, "spoof_hard_edges"

    print(f"[liveness] PASS  lap={lap_var:.1f}  s_std={s_std:.1f}  bright={bright_ratio:.3f}  g_mean={g_mean:.1f}")
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
#  IMAGE HELPERS
# ══════════════════════════════════════════════════════════════════════

def decode_image(image_data: str) -> np.ndarray:
    try:
        _, encoded = image_data.split(",", 1)
    except ValueError:
        encoded = image_data
    img_bytes = base64.b64decode(encoded)
    nparr     = np.frombuffer(img_bytes, np.uint8)
    img       = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("cv2.imdecode returned None — invalid image data")
    return img

def preprocess_for_face(img_bgr: np.ndarray) -> np.ndarray:
    """CLAHE contrast normalisation — improves recognition in low light."""
    lab     = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe   = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l       = clahe.apply(l)
    return cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)

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

    database = load_json("voter_database.json")
    if voter_id in database:
        return jsonify({"status": "already_registered"})

    try:
        img = decode_image(data["image"])
    except Exception as e:
        return jsonify({"status": "bad_image", "detail": str(e)}), 400

    # Liveness gate
    is_live, reason = check_liveness(img)
    if not is_live:
        return jsonify({
            "status":  "liveness_failed",
            "reason":  reason,
            "message": liveness_message(reason),
        }), 400

    img_pp    = preprocess_for_face(img)
    embedding = get_face_embedding(img_pp)
    if embedding is None:
        return jsonify({"status": "no_face_detected"}), 400

    face_file   = face_hash + ".jpg"
    embed_file  = face_hash + ".npy"

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
    np.save(f"voters/{embed_file}", embedding)   # save embedding for fast lookup

    print(f"[register] OK  voter_id={voter_id[:12]}…  name={data['name'].strip()}")
    return jsonify({"status": "registered", "voter_id": voter_id[:8] + "…"})

# ══════════════════════════════════════════════════════════════════════
#  VERIFY QR
# ══════════════════════════════════════════════════════════════════════

@app.route("/verify-qr", methods=["POST"])
def verify_qr():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"status": "invalid_request", "reason": "No JSON body"}), 400

    raw = data.get("qr_data", "")
    if not raw or not isinstance(raw, str):
        return jsonify({"status": "invalid_request", "reason": "qr_data missing or not a string"}), 400

    qr_raw   = raw.strip()
    voter_id = make_voter_id(qr_raw)

    database = load_json("voter_database.json")
    voter    = database.get(voter_id)

    if voter is None:
        print(f"[verify-qr] NOT FOUND  voter_id={voter_id[:12]}…")
        return jsonify({"status": "not_registered"}), 200

    mode  = load_mode()
    voted = load_json("voted_status.json")
    if mode == "REAL" and voter_id in voted:
        print(f"[verify-qr] ALREADY VOTED  voter_id={voter_id[:12]}…")
        return jsonify({"status": "already_voted"}), 200

    print(f"[verify-qr] OK  voter_id={voter_id[:12]}…  name={voter['name']}")
    return jsonify({
        "status":     "success",
        "qr_string":  voter_id,
        "voter_info": voter,
    })

# ══════════════════════════════════════════════════════════════════════
#  VERIFY FACE
# ══════════════════════════════════════════════════════════════════════

_embed_cache: dict = {}
_embed_lock  = threading.Lock()

def get_stored_embedding(embed_file: str):
    """Load saved .npy embedding with in-memory cache."""
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

    # Liveness gate — reject photos/screens before recognition
    is_live, reason = check_liveness(img_live)
    if not is_live:
        print(f"[verify-face] LIVENESS FAIL  voter_id={voter_id[:12]}…  reason={reason}")
        return jsonify({
            "status":  "liveness_failed",
            "reason":  reason,
            "message": liveness_message(reason),
        }), 200

    # Load stored embedding
    voter      = database[voter_id]
    embed_file = voter.get("embed_file", voter.get("face_file", "").replace(".jpg", ".npy"))
    enc_stored = get_stored_embedding(embed_file)
    if enc_stored is None:
        return jsonify({"status": "no_stored_face"})

    # Get live embedding
    img_pp   = preprocess_for_face(img_live)
    enc_live = get_face_embedding(img_pp)
    if enc_live is None:
        return jsonify({"status": "no_live_face"})

    similarity = embedding_similarity(enc_stored, enc_live)
    match      = similarity >= 0.40          # cosine threshold (0.40 = good balance)
    confidence = round(similarity, 4)
    print(f"[verify-face] voter_id={voter_id[:12]}…  similarity={similarity:.4f}  match={match}")

    return jsonify({
        "status":     "verified" if match else "failed",
        "confidence": confidence,
    })

# ══════════════════════════════════════════════════════════════════════
#  GESTURE
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

    img_rgb  = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    h, w     = img.shape[:2]
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)

    try:
        result = get_landmarker().detect(mp_image)
    except Exception as e:
        print(f"[gesture] landmarker error: {e}")
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

    direction = head_pitch(lm, h)
    print(f"[gesture] dir={direction} blink={is_blink} ear={ear_avg}")
    return jsonify({"status": "ok", "direction": direction, "blink": is_blink, "ear": ear_avg})

# ══════════════════════════════════════════════════════════════════════
#  VOTE
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

        voted[voter_id] = candidate
        save_json("voted_status.json", voted)
        print(f"[vote] voter_id={voter_id[:12]}…  candidate={candidate}  mode={mode}")
        return jsonify({"status": "vote_success", "mode": mode})

    except Exception as e:
        print(f"[vote] error: {e}")
        return jsonify({"status": "server_error"}), 500

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
            "registered":  len(database),
            "voted":       len(voted),
            "turnout_pct": round(len(voted) / max(len(database), 1) * 100, 1),
        },
    })

# ══════════════════════════════════════════════════════════════════════
#  HEALTH CHECK
# ══════════════════════════════════════════════════════════════════════

@app.route("/health")
def health():
    return jsonify({
        "status":     "ok",
        "mode":       load_mode(),
        "registered": len(load_json("voter_database.json")),
        "voted":      len(load_json("voted_status.json")),
        "landmarker": _landmarker is not None,
        "face_app":   _face_app is not None,
    })

# ══════════════════════════════════════════════════════════════════════
#  START  —  Render assigns PORT via environment variable
# ══════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"[startup] Starting server on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)