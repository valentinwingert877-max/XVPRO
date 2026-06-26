"""Routes CRUD des matchs + résultats d'analyse"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from database import get_db
from models import Match, MatchAction, MatchStats, Report, MatchStatus
from routers.auth import get_current_user, User

router = APIRouter()


# ─── Schemas ───────────────────────────────────────────────

class ActionOut(BaseModel):
    id: str
    action_type: str
    timecode_sec: float
    timecode_str: str
    description: Optional[str]
    confidence: Optional[float]
    pos_x: Optional[float]
    pos_y: Optional[float]
    clip_s3_key: Optional[str]

    class Config:
        from_attributes = True


class StatsOut(BaseModel):
    possession_home: Optional[float]
    territory_home: Optional[float]
    tries_home: Optional[int]
    tries_away: Optional[int]
    tackles_home: Optional[int]
    tackles_success_home: Optional[int]
    penalties_home: Optional[int]
    penalties_away: Optional[int]
    scrums_won_home: Optional[int]
    lineouts_won_home: Optional[int]
    heatmap_home: Optional[list]
    heatmap_away: Optional[list]

    class Config:
        from_attributes = True


class ReportOut(BaseModel):
    content: Optional[str]
    summary: Optional[str]
    strengths: Optional[list]
    weaknesses: Optional[list]
    tactics: Optional[list]
    pdf_s3_key: Optional[str]

    class Config:
        from_attributes = True


class MatchOut(BaseModel):
    id: str
    team_away_name: Optional[str]
    competition: Optional[str]
    match_date: Optional[datetime]
    score_home: Optional[int]
    score_away: Optional[int]
    status: str
    progress_pct: Optional[int]
    video_url: Optional[str]
    created_at: datetime
    analyzed_at: Optional[datetime]

    class Config:
        from_attributes = True


class MatchDetailOut(MatchOut):
    actions: List[ActionOut] = []
    stats: Optional[StatsOut] = None
    report: Optional[ReportOut] = None


# ─── Routes ────────────────────────────────────────────────

@router.get("/", response_model=List[MatchOut])
async def list_matches(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    """Liste tous les matchs de l'utilisateur"""
    query = select(Match).order_by(Match.created_at.desc()).limit(limit).offset(offset)
    if status:
        query = query.where(Match.status == status)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{match_id}", response_model=MatchDetailOut)
async def get_match(
    match_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retourne un match avec toutes ses données d'analyse"""
    result = await db.execute(
        select(Match)
        .options(
            selectinload(Match.actions),
            selectinload(Match.stats),
            selectinload(Match.report),
        )
        .where(Match.id == match_id)
    )
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(404, "Match introuvable")
    return match


@router.get("/{match_id}/actions", response_model=List[ActionOut])
async def get_match_actions(
    match_id: str,
    action_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retourne les actions d'un match, filtrables par type"""
    query = (
        select(MatchAction)
        .where(MatchAction.match_id == match_id)
        .order_by(MatchAction.timecode_sec)
    )
    if action_type:
        query = query.where(MatchAction.action_type == action_type)
    result = await db.execute(query)
    return result.scalars().all()


@router.delete("/{match_id}", status_code=204)
async def delete_match(
    match_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(404, "Match introuvable")
    await db.delete(match)
