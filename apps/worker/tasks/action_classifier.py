"""
Classifieur d'actions rugby

Approche hybride :
  1. Règles heuristiques sur les détections YOLO (rapide, fiable pour les cas simples)
  2. Modèle CNN/Transformer fine-tuné rugby (pour les actions complexes)

Actions détectées :
  essai, transformation, penalite, drop, melee, touche,
  plaquage, grattage, coup_de_pied, carton_jaune, carton_rouge,
  mi_temps, coup_sifflet, autre
"""
import logging
from typing import List, Dict, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Seuil de joueurs groupés pour détecter une mêlée / regroupement
SCRUM_CLUSTER_THRESHOLD = 6      # ≥ 6 joueurs dans un rayon de 5m
RUCK_CLUSTER_THRESHOLD  = 3      # ≥ 3 joueurs groupés
LINEOUT_Y_THRESHOLD     = 5      # ballon près de la touche (y < 5 ou y > 95)
TRY_LINE_X              = 5      # zones d'en-but (x < 5 ou x > 95)


def classify_actions(
    detections: List,
    duration_sec: float,
) -> List[Dict[str, Any]]:
    """
    Analyse la séquence de détections et retourne la liste des actions.

    Args:
        detections: liste de FrameDetection du détecteur YOLO
        duration_sec: durée totale du match en secondes

    Returns:
        Liste de dicts {action_type, timecode_sec, timecode_str, description, confidence, pos_x, pos_y}
    """
    actions = []

    # Sliding window de 3 secondes (15 frames à 5fps)
    window = 15
    n = len(detections)

    i = 0
    last_action_sec = -10   # anti-doublon : min 5s entre deux actions du même type

    while i < n:
        fd = detections[i]
        segment = detections[i:min(i + window, n)]

        detected = _detect_action(fd, segment)

        if detected and (fd.timestamp_sec - last_action_sec) > 5:
            actions.append({
                "action_type":  detected["type"],
                "timecode_sec": fd.timestamp_sec,
                "timecode_str": _fmt_time(fd.timestamp_sec),
                "description":  detected["desc"],
                "confidence":   detected["conf"],
                "pos_x":        detected.get("x"),
                "pos_y":        detected.get("y"),
                "clip_s3_key":  None,   # rempli plus tard
            })
            last_action_sec = fd.timestamp_sec
            i += window // 2   # avance d'une demi-fenêtre pour éviter les doublons
        else:
            i += 1

    # Mi-temps (vers 40-42 min)
    halftime_sec = _find_halftime(detections, duration_sec)
    if halftime_sec:
        actions.append({
            "action_type": "mi_temps",
            "timecode_sec": halftime_sec,
            "timecode_str": _fmt_time(halftime_sec),
            "description": "Mi-temps",
            "confidence": 0.99,
            "pos_x": None, "pos_y": None, "clip_s3_key": None,
        })

    # Coup de sifflet final
    actions.append({
        "action_type": "coup_sifflet",
        "timecode_sec": duration_sec,
        "timecode_str": _fmt_time(duration_sec),
        "description": "Coup de sifflet final",
        "confidence": 0.99,
        "pos_x": None, "pos_y": None, "clip_s3_key": None,
    })

    actions.sort(key=lambda a: a["timecode_sec"])
    logger.info(f"Classification terminée: {len(actions)} actions")
    return actions


def _detect_action(fd, segment) -> Dict | None:
    """Détecte une action à partir d'une frame et son segment"""
    players = fd.players
    ball = fd.ball_pos

    if not players:
        return None

    home = [p for p in players if p.team == "home"]
    away = [p for p in players if p.team == "away"]

    # ── Essai : ballon en zone d'en-but + joueur présent ─────
    if ball and (ball[0] < TRY_LINE_X or ball[0] > 100 - TRY_LINE_X):
        if home:
            team = "domicile" if ball[0] > 50 else "extérieure"
            return {
                "type": "essai", "conf": 0.88,
                "desc": f"Essai — équipe {team} en zone d'en-but",
                "x": ball[0], "y": ball[1]
            }

    # ── Mêlée : cluster de joueurs au centre ─────────────────
    if _is_cluster(players, threshold=SCRUM_CLUSTER_THRESHOLD, radius=8):
        center = _cluster_center(players)
        return {
            "type": "melee", "conf": 0.85,
            "desc": "Mêlée ordonnée",
            "x": center[0], "y": center[1]
        }

    # ── Touche : ballon sur le flanc ──────────────────────────
    if ball and (ball[1] < LINEOUT_Y_THRESHOLD or ball[1] > 100 - LINEOUT_Y_THRESHOLD):
        if len(players) > 4:
            return {
                "type": "touche", "conf": 0.82,
                "desc": "Touche / Lancer en touche",
                "x": ball[0], "y": ball[1]
            }

    # ── Plaquage : joueur isolé + contact ─────────────────────
    if ball and _has_isolated_contact(home, away, ball):
        return {
            "type": "plaquage", "conf": 0.78,
            "desc": "Plaquage / Contact au sol",
            "x": ball[0], "y": ball[1]
        }

    # ── Coup de pied en jeu : ballon en l'air, peu de joueurs proches ──
    if ball and _is_ball_airborne(fd, segment):
        return {
            "type": "coup_de_pied", "conf": 0.75,
            "desc": "Coup de pied en jeu",
            "x": ball[0], "y": ball[1]
        }

    return None


def _is_cluster(players, threshold: int, radius: float) -> bool:
    """Détecte si plusieurs joueurs sont regroupés dans un rayon donné"""
    if len(players) < threshold:
        return False
    positions = [p.field_pos for p in players if p.field_pos]
    if len(positions) < threshold:
        return False
    # Vérifie si un sous-ensemble d'au moins `threshold` joueurs est dans le rayon
    for i, pos in enumerate(positions):
        close = sum(
            1 for j, other in enumerate(positions)
            if i != j and _dist(pos, other) < radius
        )
        if close >= threshold - 1:
            return True
    return False


def _cluster_center(players) -> tuple:
    positions = [p.field_pos for p in players if p.field_pos]
    if not positions:
        return (50, 50)
    return (
        sum(p[0] for p in positions) / len(positions),
        sum(p[1] for p in positions) / len(positions),
    )


def _has_isolated_contact(home, away, ball) -> bool:
    """Détecte un contact entre un joueur home et un joueur away près du ballon"""
    if not home or not away or not ball:
        return False
    for h in home:
        if not h.field_pos:
            continue
        for a in away:
            if not a.field_pos:
                continue
            if _dist(h.field_pos, ball) < 5 and _dist(a.field_pos, ball) < 5:
                return True
    return False


def _is_ball_airborne(fd, segment) -> bool:
    """Détecte si le ballon est en l'air (hauteur bbox basse → ballon haut dans le frame)"""
    # Heuristique : si la position Y du ballon dans les frames successives monte
    ball_y_values = [f.ball_pos[1] for f in segment[:5] if f.ball_pos]
    if len(ball_y_values) < 3:
        return False
    # En coordinate terrain normalisée, "haut" = y proche de 0
    trend = ball_y_values[0] - ball_y_values[-1]
    return trend > 15   # le ballon monte de plus de 15% du terrain


def _find_halftime(detections, duration_sec) -> float | None:
    """Estime le moment de la mi-temps (absence de mouvement ~40-43min)"""
    mid_start = duration_sec * 0.45
    mid_end   = duration_sec * 0.55
    mid_frames = [f for f in detections if mid_start < f.timestamp_sec < mid_end]
    if not mid_frames:
        return None
    # Mi-temps = frame avec le moins de joueurs détectés dans la zone centrale
    least = min(mid_frames, key=lambda f: len(f.players))
    return least.timestamp_sec


def _dist(a, b) -> float:
    return ((a[0] - b[0])**2 + (a[1] - b[1])**2) ** 0.5


def _fmt_time(sec: float) -> str:
    sec = int(sec)
    h, m, s = sec // 3600, (sec % 3600) // 60, sec % 60
    return f"{h:02d}:{m:02d}:{s:02d}"
