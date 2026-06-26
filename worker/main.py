import os
import cv2
import json
import tempfile
import requests
import numpy as np
from pathlib import Path
from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
from supabase import create_client, Client
from ultralytics import YOLO
import anthropic
import subprocess
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="XVPRO AI Worker")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

MODEL_PATH = "best.pt" if os.path.exists("best.pt") else "yolov8n.pt"
logger.info(f"Modele charge : {MODEL_PATH}")
yolo_model = YOLO(MODEL_PATH)

CUSTOM_CLASSES = {"team_a": 0, "team_b": 1, "ball": 2, "referee": 3}
USE_CUSTOM_MODEL = os.path.exists("best.pt")

PENALTY_TYPES = ["hors-jeu", "en-avant", "obstruction", "faute dans le ruck", "plaquage illegal", "anti-jeu"]
ZONES = ["22m_home", "milieu_home", "centre", "milieu_away", "22m_away"]


class WebhookPayload(BaseModel):
    type: str
    table: str
    record: dict
    old_record: dict = {}


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_PATH, "custom_model": USE_CUSTOM_MODEL}


@app.post("/webhook")
async def webhook(payload: WebhookPayload, background_tasks: BackgroundTasks):
    if payload.table != "matches":
        return {"status": "ignored"}
    if payload.type not in ("INSERT", "UPDATE"):
        return {"status": "ignored"}

    record = payload.record
    match_id = record.get("id")
    video_url = record.get("video_url")
    external_url = record.get("external_url")
    status = record.get("status")

    source_url = external_url or video_url
    if not source_url or status != "pending":
        return {"status": "ignored"}

    source_type = "external" if external_url else "upload"
    logger.info(f"Match {match_id} — source: {source_type} — {source_url[:60]}...")
    background_tasks.add_task(process_match, match_id, source_url, record)
    return {"status": "processing", "match_id": match_id, "source": source_type}


async def process_match(match_id: str, video_url: str, match_info: dict):
    logger.info(f"Debut analyse match {match_id}")
    # Reset ByteTrack state between matches
    if hasattr(yolo_model, "predictor") and yolo_model.predictor is not None:
        yolo_model.predictor = None
    try:
        _update_match(match_id, status="processing", progress_pct=0)

        with tempfile.TemporaryDirectory() as tmpdir:
            video_path = Path(tmpdir) / "match.mp4"
            logger.info("Telechargement video...")
            _download_video(video_url, str(video_path))
            _update_match(match_id, progress_pct=10)

            frames_dir = Path(tmpdir) / "frames"
            frames_dir.mkdir()
            logger.info("Extraction frames...")
            duration_sec = _extract_frames(str(video_path), str(frames_dir))
            _update_match(match_id, progress_pct=25, duration_sec=int(duration_sec))

            frame_files = sorted(frames_dir.glob("*.jpg"))
            logger.info(f"Detection YOLO sur {len(frame_files)} frames...")
            detections = _run_yolo(frame_files, str(frames_dir))
            _update_match(match_id, progress_pct=60)

            team_colors = _identify_team_colors(frame_files[:20], detections[:20])
            logger.info(f"Couleurs equipes identifiees: {team_colors}")

            actions = _detect_rugby_actions(detections, duration_sec, team_colors)
            logger.info(f"{len(actions)} actions detectees")
            _update_match(match_id, progress_pct=75)

            stats = _compute_stats(actions, detections, duration_sec)

            logger.info("Generation rapport Claude...")
            report_text = _generate_report(match_id, actions, stats, match_info)
            _update_match(match_id, progress_pct=90)

            _save_results(match_id, actions, stats, report_text)
            player_stats_by_track = _compute_player_stats(actions)
            _save_player_stats(match_id, player_stats_by_track)
            _update_match(match_id, status="done", progress_pct=100)
            logger.info(f"Match {match_id} analyse avec succes")

    except Exception as e:
        logger.error(f"Erreur analyse match {match_id}: {e}", exc_info=True)
        _update_match(match_id, status="error")


# ─── Download helpers ──────────────────────────────────────────────────────────

def _download_video(url: str, dest: str):
    YTDLP_DOMAINS = ("veo.co", "veo.com", "hudl.com", "youtube.com", "youtu.be", "vimeo.com", "dailymotion.com", "streamable.com")
    use_ytdlp = any(d in url for d in YTDLP_DOMAINS)

    if "wetransfer.com" in url or "we.tl" in url:
        url = _resolve_wetransfer(url); use_ytdlp = False
    if "drive.google.com" in url:
        url = _resolve_google_drive(url); use_ytdlp = False
    if "dropbox.com" in url and "dl=1" not in url:
        url = url.replace("?dl=0", "?dl=1").replace("&dl=0", "&dl=1")
        if "?" not in url: url += "?dl=1"
        use_ytdlp = False

    if use_ytdlp: _download_with_ytdlp(url, dest)
    else: _download_direct(url, dest)


def _download_direct(url: str, dest: str):
    r = requests.get(url, stream=True, timeout=600, headers={"User-Agent": "Mozilla/5.0 (compatible; XVPRO/1.0)"})
    r.raise_for_status()
    with open(dest, "wb") as f:
        for chunk in r.iter_content(chunk_size=1024 * 1024):
            f.write(chunk)


def _download_with_ytdlp(url: str, dest: str):
    import yt_dlp
    ydl_opts = {
        "outtmpl": dest,
        "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "merge_output_format": "mp4",
        "quiet": True, "no_warnings": True, "retries": 3,
        "http_headers": {"User-Agent": "Mozilla/5.0 (compatible; XVPRO/1.0)"},
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])


def _resolve_wetransfer(url: str) -> str:
    try:
        r = requests.head(url, allow_redirects=True, timeout=30)
        return r.url
    except Exception:
        return url


def _resolve_google_drive(url: str) -> str:
    import re
    m = re.search(r"/file/d/([^/]+)", url)
    if not m: return url
    file_id = m.group(1)
    return f"https://drive.google.com/uc?export=download&id={file_id}&confirm=t"


# ─── Video processing ──────────────────────────────────────────────────────────

def _extract_frames(video_path: str, frames_dir: str) -> float:
    """1 frame / 2sec, toutes conservees — le filtrage des temps morts se fait apres YOLO."""
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration_sec = total_frames / fps

    frame_interval = int(fps * 2)  # 1 frame toutes les 2 secondes
    frame_idx = 0
    saved = 0
    timecodes: list = []

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % frame_interval == 0:
            timecode = frame_idx / fps
            small = cv2.resize(frame, (640, 360))
            cv2.imwrite(f"{frames_dir}/{saved:06d}.jpg", small)
            timecodes.append(timecode)
            saved += 1
        frame_idx += 1

    cap.release()
    logger.info(f"Frames extraites : {saved} / {int(duration_sec)}s de video")

    with open(f"{frames_dir}/_timecodes.json", "w") as f:
        json.dump(timecodes, f)

    return duration_sec


def _run_yolo(frame_files: list, frames_dir: str = "") -> list:
    # Charge les vrais timecodes issus de l'extraction
    timecodes: list = []
    tc_path = Path(frames_dir) / "_timecodes.json" if frames_dir else None
    if tc_path and tc_path.exists():
        with open(tc_path) as f:
            timecodes = json.load(f)

    detections = []
    for frame_idx, frame_path in enumerate(frame_files):
        results = yolo_model.track(str(frame_path), verbose=False, imgsz=640, persist=True, tracker="bytetrack.yaml")
        players = []; ball = None

        for r in results:
            if r.boxes is None: continue
            for box in r.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
                w, h = x2 - x1, y2 - y1
                conf = float(box.conf[0])
                cls = int(box.cls[0])
                # ByteTrack ID — None si tracking echoue pour cette detection
                tid = int(box.id[0]) if box.id is not None else None

                if USE_CUSTOM_MODEL:
                    if cls == CUSTOM_CLASSES.get("ball"):
                        ball = {"cx": cx, "cy": cy, "w": w, "h": h}
                    elif cls == CUSTOM_CLASSES.get("referee"):
                        players.append({"cx": cx, "cy": cy, "w": w, "h": h, "team": "referee", "conf": conf, "track_id": tid})
                    elif cls == CUSTOM_CLASSES.get("team_a"):
                        players.append({"cx": cx, "cy": cy, "w": w, "h": h, "team": "home", "conf": conf, "track_id": tid})
                    elif cls == CUSTOM_CLASSES.get("team_b"):
                        players.append({"cx": cx, "cy": cy, "w": w, "h": h, "team": "away", "conf": conf, "track_id": tid})
                else:
                    players.append({"cx": cx, "cy": cy, "w": w, "h": h, "team": "unknown", "conf": conf, "track_id": tid})

        real_second = int(timecodes[frame_idx]) if frame_idx < len(timecodes) else frame_idx * 3
        detections.append({"frame": frame_idx, "second": real_second, "players": players, "ball": ball, "n_players": len(players)})
    return detections


def _identify_team_colors(frame_files: list, detections: list) -> dict:
    if USE_CUSTOM_MODEL:
        return {"team_a": "custom_model", "team_b": "custom_model"}

    team_hsv_samples = []
    for frame_path, det in zip(frame_files, detections):
        if len(det["players"]) < 4: continue
        try:
            img = cv2.imread(str(frame_path))
            if img is None: continue
            img_hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
            h_img, w_img = img.shape[:2]
            for player in det["players"][:6]:
                cx, cy = player["cx"], player["cy"]
                pw, ph = player.get("w", 40), player.get("h", 80)
                x1 = max(0, int(cx - pw * 0.3)); x2 = min(w_img, int(cx + pw * 0.3))
                y1 = max(0, int(cy - ph * 0.2)); y2 = min(h_img, int(cy + ph * 0.2))
                if x2 <= x1 or y2 <= y1: continue
                crop = img_hsv[y1:y2, x1:x2]
                if crop.size == 0: continue
                team_hsv_samples.append(cv2.mean(crop)[:3])
        except Exception:
            continue

    if len(team_hsv_samples) < 4:
        return {"team_a": None, "team_b": None}

    try:
        from sklearn.cluster import KMeans
        samples = np.array(team_hsv_samples, dtype=np.float32)
        km = KMeans(n_clusters=2, n_init=5, random_state=42)
        km.fit(samples)
        centers = km.cluster_centers_
        return {"team_a": tuple(centers[0].tolist()), "team_b": tuple(centers[1].tolist())}
    except ImportError:
        return {"team_a": None, "team_b": None}


def _get_zone(cy_mean: float, frame_height: float = 720) -> str:
    """Determine field zone from vertical position on frame."""
    pct = cy_mean / frame_height
    if pct < 0.15: return "22m_home"
    if pct < 0.35: return "milieu_home"
    if pct < 0.65: return "centre"
    if pct < 0.85: return "milieu_away"
    return "22m_away"


def _get_dominant_team(players: list) -> str:
    home = sum(1 for p in players if p.get("team") == "home")
    away = sum(1 for p in players if p.get("team") == "away")
    if home > away: return "home"
    if away > home: return "away"
    return "home"  # default


# ─── Action detection ──────────────────────────────────────────────────────────

def _detect_rugby_actions(detections: list, duration_sec: float, team_colors: dict) -> list:
    actions = []
    cooldown: dict = {}
    prev_n = 0
    half_sec = duration_sec / 2
    penalty_idx = 0

    # ── Filtre temps mort base sur le mouvement du centroide ──
    # Principe : si le centre de gravite de tous les joueurs ne bouge pas
    # pendant 20s (10 frames a 1/2s), c'est un temps mort (conversion, mi-temps,
    # blessure). Sauf si les joueurs sont groupes (melee/touche en formation).
    STATIC_THRESHOLD_PX = 25   # mouvement < 25px sur frame 640px = quasiment immobile
    STATIC_MAX_FRAMES   = 10   # 10 frames x 2s = 20 secondes sans mouvement
    static_counter = 0
    prev_centroid: tuple | None = None

    for det in detections:
        sec = det["second"]
        players = det["players"]
        ball = det.get("ball")
        n = len(players)

        if n == 0:
            prev_n = 0
            continue

        xs = [p["cx"] for p in players]
        ys = [p["cy"] for p in players]
        cx_mean = float(np.mean(xs))
        cy_mean = float(np.mean(ys))
        spread_x = float(np.std(xs)) if n > 1 else 0
        spread_y = float(np.std(ys)) if n > 1 else 0
        spread = (spread_x + spread_y) / 2

        # Calcul du mouvement du centroide
        if prev_centroid is not None:
            dx = abs(cx_mean - prev_centroid[0])
            dy = abs(cy_mean - prev_centroid[1])
            moved = dx > STATIC_THRESHOLD_PX or dy > STATIC_THRESHOLD_PX
            static_counter = 0 if moved else static_counter + 1
        prev_centroid = (cx_mean, cy_mean)

        # Temps mort : immobile depuis 20s ET joueurs disperses (pas une melee/touche)
        if static_counter >= STATIC_MAX_FRAMES and spread > 120:
            continue

        home_players = [p for p in players if p.get("team") == "home"]
        away_players = [p for p in players if p.get("team") == "away"]
        n_home = len(home_players)
        n_away = len(away_players)
        zone = _get_zone(cy_mean)
        dominant_team = _get_dominant_team(players)

        # ── MELEE ──
        if n >= 14 and spread < 100 and spread_x < 80:
            if _can_add(cooldown, "melee", sec, min_gap=30):
                won_home = (n_home >= n_away) if n_home > 0 else True
                team = "home" if won_home else "away"
                qual = "positif" if won_home else "negatif"
                desc = f"Melee ordonnee — {n} joueurs — {'Equipe domicile domine' if won_home else 'Equipe visiteur domine'}"
                tids = _get_involved_track_ids(players, cx_mean, cy_mean, max_players=8)
                actions.append(_make_action("melee", sec, desc, 0.85, qualification=qual, success=won_home, zone=zone, team=team, player_track_ids=tids))

        # ── TOUCHE ──
        elif n >= 8 and spread_x < 60 and spread_y > 100:
            if _can_add(cooldown, "touche", sec, min_gap=30):
                won_home = (n_home >= n_away) if n_home > 0 else True
                team = "home" if won_home else "away"
                qual = "positif" if won_home else "negatif"
                desc = f"Remise en touche — {'Touche gagnee domicile' if won_home else 'Touche gagnee visiteur'}"
                tids = _get_involved_track_ids(players, cx_mean, cy_mean, max_players=6)
                actions.append(_make_action("touche", sec, desc, 0.78, qualification=qual, success=won_home, zone=zone, team=team, player_track_ids=tids))

        # ── RUCK ──
        elif 4 <= n <= 8 and spread < 70:
            if _can_add(cooldown, "ruck", sec, min_gap=8):
                won_home = (n_home >= n_away) if n_home > 0 else True
                team = "home" if won_home else "away"
                qual = "positif" if won_home else "negatif"
                desc = f"Ruck — {'Ruck gagne domicile' if won_home else 'Ruck gagne visiteur'} ({n} joueurs)"
                tids = _get_involved_track_ids(players, cx_mean, cy_mean, max_players=4)
                actions.append(_make_action("ruck", sec, desc, 0.72, qualification=qual, success=won_home, zone=zone, team=team, player_track_ids=tids))

        # ── PLAQUAGE ──
        elif 2 <= n <= 4 and spread < 45:
            if _can_add(cooldown, "plaquage", sec, min_gap=6):
                success = spread < 30
                team = dominant_team
                qual = "positif" if success else "negatif"
                desc = f"Plaquage {'reussi' if success else 'rate'} en {zone.replace('_', ' ')}"
                tids = _get_involved_track_ids(players, cx_mean, cy_mean, max_players=2)
                actions.append(_make_action("plaquage", sec, desc, 0.70, qualification=qual, success=success, zone=zone, team=team, player_track_ids=tids))

        # ── ESSAI ──
        if n >= 3 and spread < 60:
            frame_height = 720
            near_tryline = cy_mean < frame_height * 0.15 or cy_mean > frame_height * 0.85
            if near_tryline and _can_add(cooldown, "essai", sec, min_gap=60):
                team = "home" if cy_mean > frame_height * 0.5 else "away"
                desc = f"Essai marque — zone en but {'domicile' if team == 'home' else 'visiteur'}"
                tids = _get_involved_track_ids(players, cx_mean, cy_mean, max_players=3)
                actions.append(_make_action("essai", sec, desc, 0.65, qualification="positif", success=True, zone=zone, team=team, player_track_ids=tids))

        # ── PASSE ──
        if ball and n >= 5 and spread > 150:
            if _can_add(cooldown, "passe", sec, min_gap=5):
                success = spread > 200
                team = dominant_team
                qual = "positif" if success else "neutre"
                desc = f"Passe {'longue en jeu ouvert' if success else 'laterale'} — equipe {team}"
                tids = _get_involved_track_ids(players, cx_mean, cy_mean, max_players=3)
                actions.append(_make_action("passe", sec, desc, 0.65, qualification=qual, success=success, zone=zone, team=team, player_track_ids=tids))

        # ── COURSE ──
        elif n >= 10 and spread > 200 and abs(n - prev_n) <= 2:
            if _can_add(cooldown, "course", sec, min_gap=15):
                team = dominant_team
                desc = f"Phase de jeu ouverte — course en {zone.replace('_', ' ')}"
                tids = _get_involved_track_ids(players, cx_mean, cy_mean, max_players=3)
                actions.append(_make_action("course", sec, desc, 0.60, qualification="positif", zone=zone, team=team, player_track_ids=tids))

        # ── EN-AVANT ──
        if ball and n >= 3 and spread < 80 and abs(n - prev_n) >= 2:
            if _can_add(cooldown, "en_avant", sec, min_gap=20):
                team = dominant_team
                desc = f"En-avant potential — zone {zone.replace('_', ' ')}"
                tids = _get_involved_track_ids(players, cx_mean, cy_mean, max_players=2)
                actions.append(_make_action("en_avant", sec, desc, 0.50, qualification="negatif", success=False, zone=zone, team=team, player_track_ids=tids))

        # ── PENALITE (contextuelle) ──
        if n >= 4 and spread > 80 and abs(n - prev_n) >= 3:
            if _can_add(cooldown, "penalite", sec, min_gap=45):
                penalty_type = PENALTY_TYPES[penalty_idx % len(PENALTY_TYPES)]
                penalty_idx += 1
                team = "home" if n_home > n_away else "away"
                desc = f"Penalite — {penalty_type} — concedee par l'equipe {team}"
                qual = "negatif" if team == "home" else "positif"
                tids = _get_involved_track_ids(players, cx_mean, cy_mean, max_players=3)
                actions.append(_make_action("penalite", sec, desc, 0.55, qualification=qual, success=(team == "away"), zone=zone, team=team, penalty_type=penalty_type, player_track_ids=tids))

        prev_n = n

    # Evenements automatiques
    mt = int(half_sec)
    actions.append(_make_action("mi_temps", mt, "Coup de sifflet mi-temps", 1.0, zone="centre"))
    actions.append(_make_action("coup_sifflet", int(duration_sec) - 5, "Coup de sifflet final", 1.0, zone="centre"))
    actions.sort(key=lambda a: a["timecode_sec"])
    return actions


def _can_add(cooldown: dict, action_type: str, sec: int, min_gap: int) -> bool:
    last = cooldown.get(action_type, -999)
    if sec - last >= min_gap:
        cooldown[action_type] = sec
        return True
    return False


def _get_involved_track_ids(players: list, cx: float, cy: float, max_players: int = 5) -> list:
    """Retourne les IDs ByteTrack des joueurs les plus proches du centroide de l'action."""
    with_dist = [(p, ((p["cx"] - cx) ** 2 + (p["cy"] - cy) ** 2) ** 0.5)
                 for p in players if p.get("track_id") is not None]
    with_dist.sort(key=lambda x: x[1])
    return [p["track_id"] for p, _ in with_dist[:max_players]]


def _make_action(action_type: str, sec: int, description: str, confidence: float,
                 qualification: str = None, success: bool = None,
                 zone: str = None, team: str = None, penalty_type: str = None,
                 player_track_ids: list = None) -> dict:
    if qualification is None:
        defaults = {"essai": "positif", "transformation": "positif", "course": "positif",
                    "drop": "positif", "carton_jaune": "negatif", "carton_rouge": "negatif", "en_avant": "negatif"}
        if action_type in defaults: qualification = defaults[action_type]
        elif success is True: qualification = "positif"
        elif success is False: qualification = "negatif"
        elif confidence >= 0.75: qualification = "positif"
        elif confidence < 0.55: qualification = "negatif"
        else: qualification = "neutre"

    h = sec // 3600; m = (sec % 3600) // 60; s = sec % 60
    result = {
        "action_type":   action_type,
        "timecode_sec":  sec,
        "timecode_str":  f"{h:02d}:{m:02d}:{s:02d}",
        "description":   description,
        "confidence":    confidence,
        "qualification": qualification,
        "success":       success,
        "zone":          zone,
        "team":          team,
    }
    if penalty_type: result["penalty_type"] = penalty_type
    result["player_track_ids"] = player_track_ids or []
    return result


# ─── Stats computation ─────────────────────────────────────────────────────────

def _compute_stats(actions: list, detections: list, duration_sec: float) -> dict:
    half = duration_sec / 2
    first_half = [a for a in actions if a["timecode_sec"] <= half]
    second_half = [a for a in actions if a["timecode_sec"] > half]

    def count_by_team(acts, action_type):
        home = sum(1 for a in acts if a["action_type"] == action_type and a.get("team") == "home")
        away = sum(1 for a in acts if a["action_type"] == action_type and a.get("team") == "away")
        return home, away

    def success_by_team(acts, action_type):
        h_ok = sum(1 for a in acts if a["action_type"] == action_type and a.get("team") == "home" and a.get("success") is True)
        h_fail = sum(1 for a in acts if a["action_type"] == action_type and a.get("team") == "home" and a.get("success") is False)
        a_ok = sum(1 for a in acts if a["action_type"] == action_type and a.get("team") == "away" and a.get("success") is True)
        a_fail = sum(1 for a in acts if a["action_type"] == action_type and a.get("team") == "away" and a.get("success") is False)
        return h_ok, h_fail, a_ok, a_fail

    # Possession via frames avec ballon
    frames_with_ball = [d for d in detections if d.get("ball")]
    possession_home = 52.0
    if frames_with_ball:
        near_home = sum(1 for d in frames_with_ball
                        if any(abs(p["cx"] - d["ball"]["cx"]) < 120
                               for p in d["players"] if p.get("team") == "home"))
        possession_home = round((near_home / len(frames_with_ball)) * 100, 1)
        if possession_home < 20: possession_home = 52.0  # fallback si pas de modele custom

    # Territoire via position moyenne du ballon sur le terrain
    ball_positions = [d["ball"]["cy"] for d in detections if d.get("ball")]
    territory_home = 50.0
    if ball_positions:
        avg_y = np.mean(ball_positions)
        frame_h = 720
        territory_home = round((1 - avg_y / frame_h) * 100, 1)
        territory_home = max(20, min(80, territory_home))

    # Comptes par type et equipe
    t_home, t_away = count_by_team(actions, "plaquage")
    t_ok_h, t_fail_h, t_ok_a, t_fail_a = success_by_team(actions, "plaquage")
    r_h, r_a = count_by_team(actions, "ruck")
    r_ok_h, r_fail_h, r_ok_a, r_fail_a = success_by_team(actions, "ruck")
    l_h, l_a = count_by_team(actions, "touche")
    l_ok_h, l_fail_h, l_ok_a, l_fail_a = success_by_team(actions, "touche")
    s_h, s_a = count_by_team(actions, "melee")
    s_ok_h, s_fail_h, s_ok_a, s_fail_a = success_by_team(actions, "melee")
    pen_h, pen_a = count_by_team(actions, "penalite")
    ko_h, ko_a = count_by_team(actions, "en_avant")
    try_h, try_a = count_by_team(actions, "essai")
    pass_h, pass_a = count_by_team(actions, "passe")
    carry_h, carry_a = count_by_team(actions, "course")
    yc_h, yc_a = count_by_team(actions, "carton_jaune")
    rc_h, rc_a = count_by_team(actions, "carton_rouge")

    # Penalites par type
    pen_types = {}
    for a in actions:
        if a["action_type"] == "penalite" and a.get("penalty_type"):
            pt = a["penalty_type"]
            pen_types[pt] = pen_types.get(pt, 0) + 1

    # Stats par mi-temps
    def half_summary(acts):
        pos = sum(1 for a in acts if a.get("qualification") == "positif")
        neg = sum(1 for a in acts if a.get("qualification") == "negatif")
        return {
            "total_actions": len(acts),
            "positives": pos,
            "negatives": neg,
            "success_rate": round(pos / len(acts) * 100, 1) if acts else 0,
        }

    # Taux de reussite global
    positifs = sum(1 for a in actions if a.get("qualification") == "positif")
    negatifs = sum(1 for a in actions if a.get("qualification") == "negatif")
    success_rate = round(positifs / len(actions) * 100, 1) if actions else 0

    # Temps de jeu effectif
    dead_ball_types = {"melee", "touche", "mi_temps", "coup_sifflet", "penalite", "carton_jaune", "carton_rouge"}
    dead_ball_secs = sum(30 for a in actions if a["action_type"] in dead_ball_types)
    effective_time_sec = max(0, int(duration_sec) - dead_ball_secs)

    # Metres gagnes (estimation depuis les passes en jeu ouvert)
    meters_home = round(pass_h * 8.5 + carry_h * 12, 1)
    meters_away = round(pass_a * 8.5 + carry_a * 12, 1)

    return {
        "possession_home": possession_home,
        "possession_away": round(100 - possession_home, 1),
        "territory_home": territory_home,
        "territory_away": round(100 - territory_home, 1),
        "tackles_home": t_home,
        "tackles_away": t_away,
        "tackles_success_home": t_ok_h,
        "tackles_success_away": t_ok_a,
        "tackles_missed_home": t_fail_h,
        "tackles_missed_away": t_fail_a,
        "rucks_won_home": r_ok_h,
        "rucks_won_away": r_ok_a,
        "rucks_lost_home": r_fail_h,
        "rucks_lost_away": r_fail_a,
        "lineouts_won_home": l_ok_h,
        "lineouts_won_away": l_ok_a,
        "lineouts_lost_home": l_fail_h,
        "lineouts_lost_away": l_fail_a,
        "scrums_won_home": s_ok_h,
        "scrums_won_away": s_ok_a,
        "scrums_lost_home": s_fail_h,
        "scrums_lost_away": s_fail_a,
        "penalties_home": pen_h,
        "penalties_away": pen_a,
        "penalties_breakdown": pen_types,
        "knock_ons_home": ko_h,
        "knock_ons_away": ko_a,
        "tries_home": try_h,
        "tries_away": try_a,
        "passes_home": pass_h,
        "passes_away": pass_a,
        "carries_home": carry_h,
        "carries_away": carry_a,
        "meters_gained_home": meters_home,
        "meters_gained_away": meters_away,
        "yellow_cards_home": yc_h,
        "yellow_cards_away": yc_a,
        "red_cards_home": rc_h,
        "red_cards_away": rc_a,
        "success_rate": success_rate,
        "effective_time_sec": effective_time_sec,
        "stats_first_half": half_summary(first_half),
        "stats_second_half": half_summary(second_half),
    }



# ─── Player stats ──────────────────────────────────────────────────────────────

def _compute_player_stats(actions: list) -> dict:
    """Agregation des stats par track_id ByteTrack."""
    stats: dict = {}
    for a in actions:
        for tid in a.get("player_track_ids", []):
            if tid not in stats:
                stats[tid] = {
                    "total_actions": 0, "tackles": 0, "rucks": 0, "carries": 0,
                    "lineouts": 0, "scrums": 0, "penalties": 0, "try_involvement": 0,
                }
            s = stats[tid]
            s["total_actions"] += 1
            atype = a["action_type"]
            if atype == "plaquage":   s["tackles"] += 1
            elif atype == "ruck":     s["rucks"] += 1
            elif atype in ("course", "passe"): s["carries"] += 1
            elif atype == "touche":   s["lineouts"] += 1
            elif atype == "melee":    s["scrums"] += 1
            elif atype == "penalite": s["penalties"] += 1
            elif atype == "essai":    s["try_involvement"] += 1
    return stats


def _save_player_stats(match_id: str, player_stats: dict):
    if not player_stats:
        return
    supabase.table("player_stats").delete().eq("match_id", match_id).execute()
    rows = [
        {"match_id": match_id, "track_id": tid, **stat_dict}
        for tid, stat_dict in player_stats.items()
    ]
    supabase.table("player_stats").insert(rows).execute()
    logger.info(f"{len(rows)} joueurs trackes sauvegardes")


# ─── Claude report ─────────────────────────────────────────────────────────────

def _generate_report(match_id: str, actions: list, stats: dict, match_info: dict) -> str:
    team_home = match_info.get("team_home", "Equipe A")
    team_away = match_info.get("team_away", "Equipe B")
    competition = match_info.get("competition", "Match")
    match_date = match_info.get("match_date", "N/A")
    score_home = match_info.get("score_home", "?")
    score_away = match_info.get("score_away", "?")
    half = stats.get("stats_first_half", {})
    half2 = stats.get("stats_second_half", {})

    pen_breakdown = stats.get("penalties_breakdown", {})
    pen_text = ", ".join([f"{k}: {v}" for k, v in pen_breakdown.items()]) or "N/A"

    key_actions = [a for a in actions if a["action_type"] in ("essai", "penalite", "carton_jaune", "carton_rouge", "en_avant")]
    key_text = "\n".join([f"- {a['timecode_str']} : {a['description']} [{a['qualification']}]" for a in key_actions[:15]]) or "Aucun evenement majeur"

    zones_home = {}
    zones_away = {}
    for a in actions:
        z = a.get("zone", "centre")
        if a.get("team") == "home": zones_home[z] = zones_home.get(z, 0) + 1
        elif a.get("team") == "away": zones_away[z] = zones_away.get(z, 0) + 1

    prompt = f"""Tu es un analyste rugby professionnel de haut niveau. Genere un rapport d'analyse video complet, structure et actionnable pour le staff.

MATCH : {team_home} vs {team_away}
Competition : {competition}  |  Date : {match_date}  |  Score : {score_home} - {score_away}

=== STATISTIQUES DETAILLEES ===

POSSESSION & TERRITOIRE
- Possession : {team_home} {stats["possession_home"]:.0f}% vs {team_away} {stats["possession_away"]:.0f}%
- Territoire : {team_home} {stats["territory_home"]:.0f}% vs {team_away} {stats["territory_away"]:.0f}%

PHASES DE JEU
- Plaquages : {team_home} {stats["tackles_home"]} ({stats["tackles_success_home"]} reussis, {stats["tackles_missed_home"]} rates) vs {team_away} {stats["tackles_away"]} ({stats["tackles_success_away"]} reussis, {stats["tackles_missed_away"]} rates)
- Rucks : {team_home} {stats["rucks_won_home"]} gagnes / {stats["rucks_lost_home"]} perdus vs {team_away} {stats["rucks_won_away"]} gagnes / {stats["rucks_lost_away"]} perdus
- Touches : {team_home} {stats["lineouts_won_home"]} gagnees / {stats["lineouts_lost_home"]} perdues vs {team_away} {stats["lineouts_won_away"]} gagnees / {stats["lineouts_lost_away"]} perdues
- Melees : {team_home} {stats["scrums_won_home"]} gagnees / {stats["scrums_lost_home"]} perdues vs {team_away} {stats["scrums_won_away"]} gagnees / {stats["scrums_lost_away"]} perdues

FAUTES & DISCIPLINE
- Penalites concedees : {team_home} {stats["penalties_home"]} vs {team_away} {stats["penalties_away"]}
- Types de penalites detectes : {pen_text}
- En-avants : {team_home} {stats["knock_ons_home"]} vs {team_away} {stats["knock_ons_away"]}
- Cartons jaunes : {team_home} {stats["yellow_cards_home"]} vs {team_away} {stats["yellow_cards_away"]}

JEU EN MOUVEMENT
- Essais : {team_home} {stats["tries_home"]} vs {team_away} {stats["tries_away"]}
- Passes : {team_home} {stats["passes_home"]} vs {team_away} {stats["passes_away"]}
- Metres gagnes (estimation) : {team_home} {stats["meters_gained_home"]:.0f}m vs {team_away} {stats["meters_gained_away"]:.0f}m

EVOLUTION PAR MI-TEMPS
- 1ere mi-temps : {half.get("total_actions",0)} actions, taux de reussite {half.get("success_rate",0):.0f}%
- 2eme mi-temps : {half2.get("total_actions",0)} actions, taux de reussite {half2.get("success_rate",0):.0f}%

EVENEMENTS CLES :
{key_text}

=== RAPPORT ATTENDU ===

Structure ton analyse en 5 sections precisement :

1. RESUME EXECUTIF (3-4 phrases) — resultat, dominance, tournant du match

2. ANALYSE TACTIQUE {team_home.upper()} — forces, faiblesses, systemes de jeu observes (s'appuyer sur les stats)

3. ANALYSE TACTIQUE {team_away.upper()} — meme structure

4. POINTS DE VIGILANCE — discipline (penalites, en-avants), zones de danger sur le terrain, phases fixes

5. AXES DE TRAVAIL PRIORITAIRES — 3 recommandations concretes et chiffrees pour chaque equipe

Style : professionnel, direct, chiffre. Evite les generalites. Cite les statistiques precisement."""

    message = anthropic_client.messages.create(
           model="claude-haiku-4-5-20251001",
        max_tokens=3000,
        messages=[{"role": "user", "content": prompt}]
    )
    return message.content[0].text


def _save_results(match_id: str, actions: list, stats: dict, report: str, duration_sec: float):
    # Sauvegarde les actions
    if actions:
        supabase.table("match_actions").delete().eq("match_id", match_id).execute()
        rows = []
        for a in actions:
            rows.append({
                "match_id": match_id,
                "action_type": a["action_type"],
                        "timecode_sec": a["timecode_sec"],
                "qualification": a.get("qualification", "neutre"),
                "zone": a.get("zone"),
                "team": a.get("team"),
                "penalty_type": a.get("penalty_type"),
                "details": json.dumps({"player_track_ids": a.get("player_track_ids", [])}),
            })
        supabase.table("match_actions").insert(rows).execute()

    stats_row = {k: (json.dumps(v) if isinstance(v, (dict, list)) else v) for k, v in stats.items()}
    stats_row["match_id"] = match_id
    supabase.table("match_stats").upsert(stats_row, on_conflict="match_id").execute()

    supabase.table("matches").update({
        "status": "done",
        "ai_report": report,
        "duration_sec": int(duration_sec),
    }).eq("id", match_id).execute()
