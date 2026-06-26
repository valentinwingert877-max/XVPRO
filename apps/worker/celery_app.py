"""Configuration Celery"""
import os
from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "xvpro_worker",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["tasks.video_pipeline"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    task_time_limit=8 * 3600,      # 8h max par tâche (matchs longs)
    task_soft_time_limit=7 * 3600,
    worker_prefetch_multiplier=1,  # 1 tâche à la fois par worker (vidéos lourdes)
    task_acks_late=True,           # ACK après succès (évite perte si crash)
)
