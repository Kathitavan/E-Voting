from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
import base64
import numpy as np
import cv2
import face_recognition
import hashlib

# ── MediaPipe 0.10+ new Tasks API (no mp.solutions) ───────────────
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

app = Flask(__name__)
CORS(app)

# ==========================
# FACE LANDMARKER SETUP
# MediaPipe 0.10+ uses FaceLandmarker instead of FaceMesh
# Download model once and cache it locally as face_landmarker.task
# ==========================

MODEL_PATH = "face_landmarker.task"

def download_model():
    """Download the face landmarker model if not present."""
    if os.path.exists(MODEL_PATH):
        return
    import urllib.request
    url = (
        "https://storage.googleapis.com/mediapipe-models/"
        "face_landmarker/face_landmarker/float16/1/face_landmarker.task"
    )
    print("[startup] Downloading face_landmarker.task …")
    urllib.request.urlretrieve(url, MODEL_PATH)
    print("[startup] Download complete.")

download_model()

def make_landmarker():
    """Create a FaceLandmarker instance (IMAGE mode = stateless, per-frame)."""
    base_opts = mp_python.BaseOptions(model_asset_path=MODEL_PATH)
    opts = mp_vision.FaceLandmarkerOptions(
        base_options=base_opts,
        output_face_blendshapes=True,          # gives us blink scores directly
        output_facial_transformation_matrixes=False,
        num_faces=1,
        min_face_detection_confidence=0.55,
        min_face_presence_confidence=0.55,
        min_tracking_confidence=0.55,
        running_mode=mp_vision.RunningMode.IMAGE,
    )
    return mp_vision.FaceLandmarker.create_from_options(opts)

# ==========================
# EAR FALLBACK  (landmark-based, used if blendshapes unavailable)
# ==========================

LEFT_EYE  = [362, 385, 387, 263, 373, 380]
RIGHT_EYE = [33,  160, 158, 133, 153, 144]
NOSE_TIP  = 1
FOREHEAD  = 10
CHIN      = 152

EAR_BLINK_THRESHOLD = 0.20

def eye_aspect_ratio(landmarks, eye_indices, w, h):
    def pt(i):
        lm = landmarks[i]
        return np.array([lm.x * w, lm.y * h])
    p1,p2,p3,p4,p5,p6 = [pt(i) for i in eye_indices]
    return (np.linalg.norm(p2-p6) + np.linalg.norm(p3-p5)) / (2.0 * np.linalg.norm(p1-p4))

def head_pitch(landmarks, h):
    nose_y     = landmarks[NOSE_TIP].y * h
    forehead_y = landmarks[FOREHEAD].y * h
    chin_y     = landmarks[CHIN].y     * h
    total = chin_y - forehead_y
    if total == 0:
        return "neutral"
    ratio = (nose_y - forehead_y) / total
    if ratio < 0.42:
        return "up"
    if ratio > 0.58:
        return "down"
    return "neutral"

# ==========================
# HELPERS
# ==========================

def load_json(file):
    if not os.path.exists(file):
        return {}
    try:
        with open(file, "r") as f:
            return json.load(f)
    except:
        return {}

def save_json(file, data):
    with open(file, "w") as f:
        json.dump(data, f, indent=4)

def decode_image(image_data: str):
    header, encoded = image_data.split(",", 1)
    img_bytes = base64.b64decode(encoded)
    nparr = np.frombuffer(img_bytes, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

# ==========================
# MODE CONTROL
# ==========================

MODE_FILE = "mode.json"

def load_mode():
    if not os.path.exists(MODE_FILE):
        return "TEST"
    return load_json(MODE_FILE).get("mode", "TEST")

def save_mode(mode):
    save_json(MODE_FILE, {"mode": mode})

@app.route("/get-mode")
def get_mode():
    return jsonify({"mode": load_mode()})

@app.route("/set-mode", methods=["POST"])
def set_mode():
    mode = request.json.get("mode", "TEST")
    save_mode(mode)
    return jsonify({"status": "updated", "mode": mode})

# ==========================
# ROOT
# ==========================

@app.route("/")
def home():
    return "E-Voting Backend Running"

# ==========================
# REGISTER
# ==========================

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    required = ["name", "gender", "age", "image", "qr_data"]
    if not data or not all(f in data for f in required):
        return jsonify({"status": "invalid_request"}), 400

    qr_string = data["qr_data"].strip()
    database  = load_json("voter_database.json")
    if qr_string in database:
        return jsonify({"status": "already_registered"})

    img = decode_image(data["image"])
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    encodings = face_recognition.face_encodings(rgb)
    if len(encodings) == 0:
        return jsonify({"status": "no_face_detected"}), 400

    qr_hash = hashlib.sha256(qr_string.encode()).hexdigest()[:12]
    database[qr_string] = {
        "name":      data["name"],
        "gender":    data["gender"],
        "age":       data["age"],
        "face_file": qr_hash + ".jpg"
    }
    save_json("voter_database.json", database)
    os.makedirs("voters", exist_ok=True)
    cv2.imwrite(f"voters/{qr_hash}.jpg", img)
    return jsonify({"status": "registered"})

# ==========================
# VERIFY QR
# ==========================

@app.route("/verify-qr", methods=["POST"])
def verify_qr():
    data = request.get_json()
    if not data or "qr_data" not in data:
        return jsonify({"status": "invalid_request"}), 400

    qr_string = data["qr_data"].strip()
    database  = load_json("voter_database.json")
    if qr_string not in database:
        return jsonify({"status": "not_registered"})

    return jsonify({
        "status":     "success",
        "qr_string":  qr_string,
        "voter_info": database[qr_string]
    })

# ==========================
# VERIFY FACE  (improved accuracy)
# ==========================

@app.route("/verify-face", methods=["POST"])
def verify_face():
    data       = request.get_json()
    qr_string  = data.get("qr_string")
    image_data = data.get("image")

    database = load_json("voter_database.json")
    if qr_string not in database:
        return jsonify({"status": "not_registered"})

    face_file   = database[qr_string]["face_file"]
    stored_path = f"voters/{face_file}"

    img_live   = decode_image(image_data)
    img_stored = face_recognition.load_image_file(stored_path)

    enc_live   = face_recognition.face_encodings(
        cv2.cvtColor(img_live, cv2.COLOR_BGR2RGB), num_jitters=2
    )
    enc_stored = face_recognition.face_encodings(img_stored, num_jitters=2)

    if len(enc_live) == 0:
        return jsonify({"status": "no_live_face"})
    if len(enc_stored) == 0:
        return jsonify({"status": "no_stored_face"})

    distance = face_recognition.face_distance([enc_stored[0]], enc_live[0])[0]
    match    = bool(distance < 0.45)
    print(f"[verify-face] distance={distance:.4f} match={match}")

    if match:
        return jsonify({"status": "verified", "confidence": round(1 - float(distance), 4)})
    return jsonify({"status": "failed",   "confidence": round(1 - float(distance), 4)})

# ==========================
# GESTURE  (MediaPipe 0.10+ FaceLandmarker)
# Returns:
#   direction : "up" | "down" | "neutral"
#   blink     : true | false
#   ear       : float
# ==========================

@app.route("/gesture", methods=["POST"])
def gesture():
    data       = request.get_json()
    image_data = data.get("image")
    if not image_data:
        return jsonify({"status": "invalid_request"}), 400

    img     = decode_image(image_data)
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    h, w    = img.shape[:2]

    # Convert to MediaPipe Image
    mp_image = mp.Image(
        image_format=mp.ImageFormat.SRGB,
        data=img_rgb
    )

    try:
        landmarker = make_landmarker()
        result     = landmarker.detect(mp_image)
        landmarker.close()
    except Exception as e:
        print(f"[gesture] landmarker error: {e}")
        return jsonify({"status": "error", "detail": str(e)}), 500

    if not result.face_landmarks:
        return jsonify({
            "status":    "no_face",
            "direction": "neutral",
            "blink":     False,
            "ear":       None
        })

    lm = result.face_landmarks[0]   # list of NormalizedLandmark

    # ── Blink via blendshapes (most accurate) ────────────────────
    is_blink = False
    ear_avg  = None

    if result.face_blendshapes:
        blendshapes = {b.category_name: b.score for b in result.face_blendshapes[0]}
        eye_blink_left  = blendshapes.get("eyeBlinkLeft",  0)
        eye_blink_right = blendshapes.get("eyeBlinkRight", 0)
        avg_blink = (eye_blink_left + eye_blink_right) / 2.0
        is_blink  = avg_blink > 0.6     # 0–1 score; >0.6 = clearly closed
        ear_avg   = round(1.0 - avg_blink, 4)   # invert so low = closed (familiar scale)
    else:
        # Fallback: EAR from raw landmarks
        ear_left  = eye_aspect_ratio(lm, LEFT_EYE,  w, h)
        ear_right = eye_aspect_ratio(lm, RIGHT_EYE, w, h)
        ear_avg   = round((ear_left + ear_right) / 2.0, 4)
        is_blink  = ear_avg <= EAR_BLINK_THRESHOLD

    # ── Head tilt direction ──────────────────────────────────────
    direction = head_pitch(lm, h)

    print(f"[gesture] dir={direction} blink={is_blink} ear={ear_avg}")

    return jsonify({
        "status":    "ok",
        "direction": direction,
        "blink":     is_blink,
        "ear":       ear_avg
    })

# ==========================
# VOTE
# ==========================

@app.route("/vote", methods=["POST"])
def vote():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"status": "invalid_request", "reason": "No JSON"}), 400
        if "qr_string" not in data:
            return jsonify({"status": "invalid_request", "reason": "qr_string missing"}), 400
        if "candidate" not in data:
            return jsonify({"status": "invalid_request", "reason": "candidate missing"}), 400

        qr_string = data["qr_string"].strip()
        candidate = data["candidate"]
        database  = load_json("voter_database.json")
        voted     = load_json("voted_status.json")
        mode      = load_mode()

        if qr_string not in database:
            return jsonify({"status": "not_registered"}), 400

        if mode == "REAL" and qr_string in voted:
            return jsonify({"status": "already_voted"})

        voted[qr_string] = candidate
        save_json("voted_status.json", voted)
        print(f"[vote] qr={qr_string} candidate={candidate} mode={mode}")
        return jsonify({"status": "vote_success", "mode": mode})

    except Exception as e:
        print(f"[vote] error: {e}")
        return jsonify({"status": "server_error"}), 500

# ==========================
# ADMIN RESULTS
# ==========================

@app.route("/admin/results")
def admin_results():
    database = load_json("voter_database.json")
    voted    = load_json("voted_status.json")
    votes    = {}
    gender_stats = {"male": 0, "female": 0}

    for qr, candidate in voted.items():
        votes[candidate] = votes.get(candidate, 0) + 1
        if qr in database:
            gender = database[qr].get("gender", "").lower()
            if gender in gender_stats:
                gender_stats[gender] += 1

    return jsonify({
        "votes":        votes,
        "gender_stats": gender_stats,
        "system": {
            "registered": len(database),
            "voted":      len(voted)
        }
    })

# ==========================
# START
# ==========================

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)