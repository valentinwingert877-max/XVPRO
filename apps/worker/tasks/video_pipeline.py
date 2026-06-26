"""
XVPRO — Pipeline IA vidéo (tâche Celery principale)

Étapes :
  1. Téléchargement de la vidéo depuis S3
  2. Extraction des frames (FFmpeg)
  3. Détection joueurs + ballon (YOLOv8)
  4. Classification des actions rugby (modèle custom)
  5. Calcul des statistiques
  6. Génération du rapport narratif (Claude API)
  7. Sauvegarde en DB + notification
"""
import os
import uuid
import logging
import tempfile
from pathlib import Path
from datetime import datetime

from celery_app import celery_app
from tasks.ffmpeg_extractor import extract_frames, extract_clip
from tasks.yolo_detector import detect_players_and_ball
from tasks.action_classifier import classify_actions
from tasks.stats_calculator import calculate_stats
from tasks.claude_reporter import generate_report
from db_sync import get_sync_db, update_match_status, save_actions, save_stats, save_report

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=2, soft_time_limit=7200)
def process_match_video(self, match_id: str):
    """
    Tâche principale — traite un match de bout en bout.
    Durée estimée : 15-30 min pour 80 min de match.
    """
    tmp_dir = Path(tempfile.mkdtemp(prefix="xvpro_"))
    video_path = tmp_dir / "match.mp4"

    try:
        logger.info(f"[{match_id}] Démarrage pipeline IA")

        # ── Étape 1 : Téléchargement S3 (10%) ─────────────────
        _update_progress(match_id, 5, "Téléchargement de la vidéo...")
        _download_from_s3(match_id, video_path)
        _update_progress(match_id, 10, "Vidéo reçue")

        # ── Étape 2 : Extraction frames FFmpeg (20%) ──────────
        _update_progress(match_id, 12, "Extraction des frames vidéo...")
        frames_dir = tmp_dir / "frames"
        frames_dir.mkdir()
        frame_count, duration_sec = extract_frames(
            video_path=str(video_path),
            output_dir=str(frames_dir),
            fps=5,          # 5 frames/sec → bon compromis vitesse/précision
        )
        _update_progress(match_id, 25, f"{frame_count} frames extraites ({duration_sec//60} min)")

        # ── Étape 3 : Détection YOLOv8 (50%) ─────────────────
        _update_progress(match_id, 27, "Détection des joueurs et du ballon (IA)...")
        detections = detect_players_and_ball(
            frames_dir=str(frames_dir),
            model_path=os.getenv("YOLO_MODEL_PATH", "./models/rugby_yolov8.pt"),
        )
        # detections : list[FrameDetection] avec bounding boxes, tracks, positions terrain
        _update_progress(match_id, 55, f"{len(detections)} frames analysées")

        # ── Étape 4 : Classification des actions (70%) ────────
        _update_progress(match_id, 57, "Classification des actions rugby...")
        actions = classify_actions(
            detections=detections,
            duration_sec=duration_sec,
        )
        logger.info(f"[{match_id}] {len(actions)} actions détectées")
        _update_progress(match_id, 72, f"{len(actions)} actions détectées")

        # ── Extraction clips pour chaque action clé (78%) ─────
        _update_progress(match_id, 73, "Extraction des clips vidéo...")
        key_actions = [a for a in actions if a["action_type"] in
                       ["essai", "penalite", "carton_jaune", "carton_rouge", "transformation"]]
        for action in key_actions[:20]:   # max 20 clips
            clip_key = _extract_and_upload_clip(
                video_path=str(video_path),
                timecode_sec=action["timecode_sec"],
                match_id=match_id,
            )
            action["clip_s3_key"] = clip_key
        _update_progress(match_id, 78, "Clips extraits")

        # ── Étape 5 : Statistiques (82%) ──────────────────────
        _update_progress(match_id, 80, "Calcul des statistiques...")
        stats = calculate_stats(actions=actions, detections=detections, duration_sec=duration_sec)
        _update_progress(match_id, 82, "Stats calculées")

        # ── Étape 6 : Rapport Claude (95%) ────────────────────
        _update_progress(match_id, 83, "Génération du rapport IA (Claude)...")
        report = generate_report(
            match_id=match_id,
            actions=actions,
            stats=stats,
            duration_sec=duration_sec,
        )
        _update_progress(match_id, 95, "Rapport généré")

        # ── Étape 7 : Sauvegarde DB (100%) ────────────────────
        _update_progress(match_id, 96, "Sauvegarde des résultats...")
        with get_sync_db() as db:
            save_actions(db, match_id, actions)
            save_stats(db, match_id, stats)
            save_report(db, match_id, report)
            update_match_status(db, match_id, "done", progress=100, analyzed_at=datetime.utcnow())

        logger.info(f"[{match_id}] ✅ Pipeline terminé avec succès")
        _send_completion_notification(match_id)
        return {"status": "done", "actions": len(actions)}

    except Exception as exc:
        logger.error(f"[{match_id}] ❌ Erreur pipeline: {exc}", exc_info=True)
        with get_sync_db() as db:
            update_match_status(db, match_id, "error", error=str(exc))
        raise self.retry(exc=exc, countdown=60)

    finally:
        # Nettoyage fichiers temporaires
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ─── Helpers privés ──────────────────────────────────────────

def _update_progress(match_id: str, pct: int, message: str):
    """Met à jour le pourcentage de progression en DB"""
    with get_sync_db() as db:
        update_match_status(db, match_id, "processing", progress=pct)
    logger.info(f"[{match_id}] {pct}% — {message}")


def _download_from_s3(match_id: str, dest_path: Path):
    """Télécharge la vidéo depuis S3"""
    import boto3
    from db_sync import get_match_s3_key

    s3 = boto3.client("s3")
    bucket = os.getenv("AWS_S3_BUCKET")

    with get_sync_db() as db:
        s3_key = get_match_s3_key(db, match_id)

    s3.download_file(bucket, s3_key, str(dest_path))


def _extract_and_upload_clip(video_path: str, timecode_sec: float, match_id: str) -> str:
    """Extrait un clip de ±10 secondes autour du timecode et l'upload sur S3"""
    import boto3
    import tempfile

    start = max(0, timecode_sec - 8)
    duration = 18  # 18 secondes de clip

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        clip_path = tmp.name

    extract_clip(video_path=video_path, output_path=clip_path, start_sec=start, duration=duration)

    # Upload S3
    s3 = boto3.client("s3")
    bucket = os.getenv("AWS_S3_BUCKET")
    s3_key = f"clips/{match_id}/{uuid.uuid4()}.mp4"
    s3.upload_file(clip_path, bucket, s3_key)
    os.unlink(clip_path)

    return s3_key


def _send_completion_notification(match_id: str):
    """Envoie un email/webhook quand l'analyse est terminée"""
    # TODO: intégrer Resend ou SendGrid
    logger.info(f"[{match_id}] Notification d'analyse complète à envoyer")
