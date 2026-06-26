"""
Upload de vidéo — génère une URL présignée S3 et déclenche le pipeline IA
"""
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import boto3
from botocore.exceptions import ClientError

from database import get_db
from models import Match, MatchStatus
from routers.auth import get_current_user, User

router = APIRouter()

S3_BUCKET = os.getenv("AWS_S3_BUCKET", "xvpro-videos")
AWS_REGION = os.getenv("AWS_REGION", "eu-west-3")

s3_client = boto3.client(
    "s3",
    region_name=AWS_REGION,
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
)


class PresignedUrlRequest(BaseModel):
    filename: str          # "match_rcp_aurillac.mp4"
    content_type: str      # "video/mp4"
    file_size_mb: float
    team_home: str
    team_away: str
    competition: str
    match_date: str        # "2026-06-14"


class PresignedUrlResponse(BaseModel):
    upload_url: str        # URL présignée S3 pour PUT direct depuis le browser
    match_id: str          # ID du match créé en DB
    s3_key: str


@router.post("/presigned-url", response_model=PresignedUrlResponse)
async def get_presigned_url(
    data: PresignedUrlRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Génère une URL présignée S3 pour upload direct depuis le navigateur.
    Crée le match en DB en statut PENDING.

    Workflow:
      1. Frontend appelle cet endpoint → reçoit upload_url + match_id
      2. Frontend upload la vidéo directement sur S3 via PUT
      3. Frontend appelle /upload/confirm/{match_id} une fois l'upload terminé
      4. Le backend démarre la tâche Celery de traitement
    """
    # Valide taille (max 20 Go)
    if data.file_size_mb > 20_000:
        raise HTTPException(400, "Fichier trop lourd (max 20 Go)")

    # Valide format
    allowed = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska"]
    if data.content_type not in allowed:
        raise HTTPException(400, f"Format non supporté. Acceptés: mp4, mov, avi, mkv")

    # Génère la clé S3
    s3_key = f"videos/{current_user.id}/{uuid.uuid4()}/{data.filename}"

    # Crée l'URL présignée S3 (expire après 1h)
    try:
        upload_url = s3_client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": S3_BUCKET,
                "Key": s3_key,
                "ContentType": data.content_type,
            },
            ExpiresIn=3600,
        )
    except ClientError as e:
        raise HTTPException(500, f"Erreur S3: {str(e)}")

    # Crée le match en DB
    match = Match(
        team_away_name=data.team_away,
        competition=data.competition,
        video_s3_key=s3_key,
        video_size_mb=data.file_size_mb,
        status=MatchStatus.PENDING,
    )
    db.add(match)
    await db.flush()

    return PresignedUrlResponse(
        upload_url=upload_url,
        match_id=str(match.id),
        s3_key=s3_key,
    )


@router.post("/confirm/{match_id}")
async def confirm_upload(
    match_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Appelé par le frontend après upload S3 réussi.
    Déclenche la tâche Celery de traitement IA.
    """
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(404, "Match introuvable")

    # Lance le pipeline IA en asynchrone
    from tasks.video_pipeline import process_match_video
    task = process_match_video.delay(match_id)

    # Sauvegarde l'ID de tâche Celery
    match.status = MatchStatus.PROCESSING
    match.celery_task_id = task.id

    return {"status": "processing", "task_id": task.id, "match_id": match_id}


@router.get("/status/{match_id}")
async def upload_status(
    match_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retourne le statut de traitement d'un match (pour polling ou WebSocket)"""
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(404, "Match introuvable")

    return {
        "match_id": match_id,
        "status": match.status,
        "progress_pct": match.progress_pct,
        "error": match.error_message,
    }
