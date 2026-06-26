"""
Détection des joueurs et du ballon avec YOLOv8
+ Tracking des joueurs entre les frames
+ Calcul position sur le terrain (homographie)
"""
import os
import logging
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Optional
import numpy as np

logger = logging.getLogger(__name__)

# Classes détectées par le modèle YOLOv8 fine-tuné rugby
YOLO_CLASSES = {
    0: "player_home",    # joueur équipe domicile
    1: "player_away",    # joueur équipe extérieure
    2: "ball",           # ballon
    3: "referee",        # arbitre
}


@dataclass
class BoundingBox:
    x1: float; y1: float; x2: float; y2: float
    confidence: float
    class_id: int
    class_name: str

    @property
    def center(self):
        return ((self.x1 + self.x2) / 2, (self.y1 + self.y2) / 2)

    @property
    def area(self):
        return (self.x2 - self.x1) * (self.y2 - self.y1)


@dataclass
class TrackedPlayer:
    track_id: int
    team: str              # "home" ou "away"
    jersey_number: Optional[int]
    bbox: BoundingBox
    field_pos: Optional[tuple]   # position (x%, y%) sur le terrain


@dataclass
class FrameDetection:
    frame_idx: int
    timestamp_sec: float
    players: List[TrackedPlayer] = field(default_factory=list)
    ball_pos: Optional[tuple] = None   # (x%, y%) sur le terrain
    raw_boxes: List[BoundingBox] = field(default_factory=list)


def detect_players_and_ball(frames_dir: str, model_path: str) -> List[FrameDetection]:
    """
    Lance YOLOv8 sur toutes les frames et retourne les détections.

    Args:
        frames_dir: dossier contenant les frames extraites (frame_0000.jpg, ...)
        model_path: chemin vers le modèle .pt fine-tuné rugby

    Returns:
        Liste de FrameDetection triée par timestamp
    """
    from ultralytics import YOLO

    # Charge le modèle (utilise le modèle base si le custom n'existe pas)
    if os.path.exists(model_path):
        model = YOLO(model_path)
        logger.info(f"Modèle custom rugby chargé: {model_path}")
    else:
        # Fallback sur YOLOv8n pour le dev (sans fine-tuning rugby)
        model = YOLO("yolov8n.pt")
        logger.warning("⚠️  Modèle rugby non trouvé, utilisation de yolov8n (dev only)")

    frames = sorted(Path(frames_dir).glob("*.jpg"))
    logger.info(f"Traitement de {len(frames)} frames")

    detections = []
    homography = _compute_field_homography()   # matrice de projection terrain

    # Traitement par batch pour la performance
    batch_size = 32
    for i in range(0, len(frames), batch_size):
        batch = frames[i:i + batch_size]
        results = model.track(
            source=[str(f) for f in batch],
            persist=True,         # tracking inter-frames
            conf=0.35,            # seuil de confiance
            iou=0.45,
            verbose=False,
        )

        for j, result in enumerate(results):
            frame_path = batch[j]
            frame_idx = int(frame_path.stem.split("_")[1])
            # fps déduit du nom de fichier (frame_0000_5fps → timestamp = frame_idx / 5)
            timestamp_sec = frame_idx / 5.0

            fd = FrameDetection(frame_idx=frame_idx, timestamp_sec=timestamp_sec)

            if result.boxes is not None:
                for box in result.boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    track_id = int(box.id[0]) if box.id is not None else -1

                    bbox = BoundingBox(x1, y1, x2, y2, conf, cls_id, YOLO_CLASSES.get(cls_id, "unknown"))
                    fd.raw_boxes.append(bbox)

                    if cls_id == 2:   # ballon
                        fd.ball_pos = _to_field_coords(bbox.center, homography)
                    elif cls_id in (0, 1):   # joueur
                        field_pos = _to_field_coords(bbox.center, homography)
                        player = TrackedPlayer(
                            track_id=track_id,
                            team="home" if cls_id == 0 else "away",
                            jersey_number=None,   # TODO: OCR sur le dos
                            bbox=bbox,
                            field_pos=field_pos,
                        )
                        fd.players.append(player)

            detections.append(fd)
            logger.debug(f"Frame {frame_idx}: {len(fd.players)} joueurs, ballon={fd.ball_pos is not None}")

    logger.info(f"Détection terminée: {len(detections)} frames traitées")
    return sorted(detections, key=lambda d: d.timestamp_sec)


def _compute_field_homography():
    """
    Calcule la matrice d'homographie pour projeter les coordonnées
    caméra → coordonnées terrain normalisées (0-100, 0-100).

    En production: calculé dynamiquement par détection des lignes du terrain.
    Ici: matrice fixe pour un angle de caméra standard.
    """
    # Points source (pixels dans une image 1280x720 typique)
    src = np.array([
        [50, 680], [1230, 680],    # ligne de fond basse
        [150, 200], [1130, 200],   # ligne de fond haute
    ], dtype=np.float32)

    # Points destination (terrain 100x70m normalisé en 0-100)
    dst = np.array([
        [0, 100], [100, 100],
        [0, 0],   [100, 0],
    ], dtype=np.float32)

    import cv2
    H, _ = cv2.findHomography(src, dst)
    return H


def _to_field_coords(pixel_center: tuple, H) -> tuple:
    """Convertit coordonnées pixel → position terrain (x%, y%)"""
    try:
        import cv2
        pt = np.array([[pixel_center]], dtype=np.float32)
        transformed = cv2.perspectiveTransform(pt, H)
        x = float(np.clip(transformed[0][0][0], 0, 100))
        y = float(np.clip(transformed[0][0][1], 0, 100))
        return (x, y)
    except Exception:
        return None
