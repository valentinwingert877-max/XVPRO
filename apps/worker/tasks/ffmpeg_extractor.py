"""Extraction de frames et clips vidéo via FFmpeg"""
import subprocess
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def extract_frames(video_path: str, output_dir: str, fps: int = 5) -> tuple[int, float]:
    """
    Extrait les frames d'une vidéo à `fps` images/seconde.

    Returns:
        (frame_count, duration_sec)
    """
    output_pattern = str(Path(output_dir) / "frame_%04d.jpg")

    cmd = [
        "ffmpeg", "-i", video_path,
        "-vf", f"fps={fps},scale=1280:720",   # resize pour accélérer YOLO
        "-q:v", "3",                           # qualité JPEG (1=max, 31=min)
        output_pattern,
        "-y", "-loglevel", "error"
    ]

    logger.info(f"FFmpeg extraction: {fps}fps → {output_dir}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg extraction failed: {result.stderr}")

    frames = list(Path(output_dir).glob("*.jpg"))
    duration_sec = len(frames) / fps

    logger.info(f"Extraction: {len(frames)} frames, ~{duration_sec/60:.1f} min")
    return len(frames), duration_sec


def extract_clip(video_path: str, output_path: str, start_sec: float, duration: float = 18):
    """
    Extrait un clip MP4 à partir d'un timecode.

    Args:
        start_sec: début du clip en secondes
        duration:  durée du clip en secondes
    """
    cmd = [
        "ffmpeg",
        "-ss", str(start_sec),           # seek avant l'input (rapide)
        "-i", video_path,
        "-t", str(duration),
        "-c:v", "libx264",               # re-encode pour compatibilité
        "-crf", "23",
        "-preset", "fast",
        "-c:a", "aac",
        output_path,
        "-y", "-loglevel", "error"
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg clip failed: {result.stderr}")


def get_video_duration(video_path: str) -> float:
    """Retourne la durée d'une vidéo en secondes via ffprobe"""
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        video_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr}")
    return float(result.stdout.strip())
