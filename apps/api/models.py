"""
XVPRO — Modèles SQLAlchemy
Schéma complet de la base de données
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean,
    DateTime, ForeignKey, Enum, Text, JSON
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from database import Base


def new_uuid():
    return str(uuid.uuid4())


# ─── ENUMS ───────────────────────────────────────────────────

class MatchStatus(str, enum.Enum):
    PENDING    = "pending"      # en attente de traitement
    PROCESSING = "processing"   # pipeline IA en cours
    DONE       = "done"         # analyse terminée
    ERROR      = "error"        # échec traitement

class ActionType(str, enum.Enum):
    ESSAI          = "essai"
    TRANSFORMATION = "transformation"
    PENALITE       = "penalite"
    DROP           = "drop"
    MELEE          = "melee"
    TOUCHE         = "touche"
    PLAQUAGE       = "plaquage"
    GRATTAGE       = "grattage"
    COUP_DE_PIED   = "coup_de_pied"
    CARTON_JAUNE   = "carton_jaune"
    CARTON_ROUGE   = "carton_rouge"
    MI_TEMPS       = "mi_temps"
    COUP_SIFFLET   = "coup_sifflet"
    AUTRE          = "autre"

class SubscriptionPlan(str, enum.Enum):
    FREE    = "free"
    STARTER = "starter"
    CLUB    = "club"
    PRO     = "pro"


# ─── MODELS ──────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id            = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    email         = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name     = Column(String(255))
    plan          = Column(Enum(SubscriptionPlan), default=SubscriptionPlan.FREE)
    stripe_customer_id = Column(String(255), unique=True)
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime, default=datetime.utcnow)

    organizations = relationship("OrganizationMember", back_populates="user")


class Organization(Base):
    __tablename__ = "organizations"

    id         = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    name       = Column(String(255), nullable=False)
    plan       = Column(Enum(SubscriptionPlan), default=SubscriptionPlan.FREE)
    created_at = Column(DateTime, default=datetime.utcnow)

    members = relationship("OrganizationMember", back_populates="organization")
    teams   = relationship("Team", back_populates="organization")


class OrganizationMember(Base):
    __tablename__ = "organization_members"

    id              = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    user_id         = Column(UUID(as_uuid=False), ForeignKey("users.id"))
    organization_id = Column(UUID(as_uuid=False), ForeignKey("organizations.id"))
    role            = Column(String(50), default="member")  # owner, admin, member

    user         = relationship("User", back_populates="organizations")
    organization = relationship("Organization", back_populates="members")


class Team(Base):
    __tablename__ = "teams"

    id              = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    organization_id = Column(UUID(as_uuid=False), ForeignKey("organizations.id"))
    name            = Column(String(255), nullable=False)
    category        = Column(String(100))   # Fédérale 1, Pro D2, etc.
    season          = Column(String(20))    # "2025-2026"
    created_at      = Column(DateTime, default=datetime.utcnow)

    organization = relationship("Organization", back_populates="teams")
    players      = relationship("Player", back_populates="team")
    home_matches = relationship("Match", foreign_keys="Match.team_home_id", back_populates="team_home")
    away_matches = relationship("Match", foreign_keys="Match.team_away_id", back_populates="team_away")


class Player(Base):
    __tablename__ = "players"

    id         = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    team_id    = Column(UUID(as_uuid=False), ForeignKey("teams.id"))
    first_name = Column(String(100))
    last_name  = Column(String(100))
    number     = Column(Integer)     # numéro de maillot
    position   = Column(String(50))  # pilier, talonneur, etc.
    created_at = Column(DateTime, default=datetime.utcnow)

    team = relationship("Team", back_populates="players")


class Match(Base):
    __tablename__ = "matches"

    id             = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    team_home_id   = Column(UUID(as_uuid=False), ForeignKey("teams.id"))
    team_away_id   = Column(UUID(as_uuid=False), ForeignKey("teams.id"), nullable=True)
    team_away_name = Column(String(255))   # si l'équipe adverse n'est pas dans le système
    competition    = Column(String(255))
    match_date     = Column(DateTime)
    score_home     = Column(Integer)
    score_away     = Column(Integer)
    duration_sec   = Column(Integer)       # durée réelle du match en secondes

    # Vidéo
    video_s3_key   = Column(String(512))   # clé S3 de la vidéo brute
    video_url      = Column(String(512))   # URL signée CDN
    video_size_mb  = Column(Float)

    # Statut pipeline IA
    status         = Column(Enum(MatchStatus), default=MatchStatus.PENDING)
    celery_task_id = Column(String(255))   # ID tâche Celery
    progress_pct   = Column(Integer, default=0)
    error_message  = Column(Text)

    created_at     = Column(DateTime, default=datetime.utcnow)
    analyzed_at    = Column(DateTime)

    team_home = relationship("Team", foreign_keys=[team_home_id], back_populates="home_matches")
    team_away = relationship("Team", foreign_keys=[team_away_id], back_populates="away_matches")
    actions   = relationship("MatchAction", back_populates="match", cascade="all, delete-orphan")
    stats     = relationship("MatchStats", back_populates="match", uselist=False)
    report    = relationship("Report", back_populates="match", uselist=False)


class MatchAction(Base):
    """Une action détectée par l'IA dans un match"""
    __tablename__ = "match_actions"

    id          = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    match_id    = Column(UUID(as_uuid=False), ForeignKey("matches.id"))
    action_type = Column(Enum(ActionType), nullable=False)
    timecode_sec = Column(Float, nullable=False)   # secondes depuis le début
    timecode_str = Column(String(20))              # "00:08:14" formaté
    player_id   = Column(UUID(as_uuid=False), ForeignKey("players.id"), nullable=True)
    description = Column(Text)
    confidence  = Column(Float)                    # 0.0 → 1.0
    pos_x       = Column(Float)                    # position terrain X (0-100)
    pos_y       = Column(Float)                    # position terrain Y (0-100)
    clip_s3_key = Column(String(512))              # clip vidéo extrait

    match  = relationship("Match", back_populates="actions")
    player = relationship("Player")


class MatchStats(Base):
    """Statistiques agrégées d'un match"""
    __tablename__ = "match_stats"

    id              = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    match_id        = Column(UUID(as_uuid=False), ForeignKey("matches.id"), unique=True)

    # Possession & territoire
    possession_home = Column(Float)   # % possession équipe domicile
    territory_home  = Column(Float)   # % territoire équipe domicile

    # Attaque
    tries_home      = Column(Integer, default=0)
    tries_away      = Column(Integer, default=0)
    carries_home    = Column(Integer, default=0)
    meters_home     = Column(Float, default=0)

    # Défense
    tackles_home    = Column(Integer, default=0)
    tackles_success_home = Column(Integer, default=0)
    tackles_away    = Column(Integer, default=0)

    # Phases statiques
    scrums_home     = Column(Integer, default=0)
    scrums_won_home = Column(Integer, default=0)
    lineouts_home   = Column(Integer, default=0)
    lineouts_won_home = Column(Integer, default=0)

    # Discipline
    penalties_home  = Column(Integer, default=0)
    penalties_away  = Column(Integer, default=0)
    yellow_cards_home = Column(Integer, default=0)
    red_cards_home  = Column(Integer, default=0)

    # Heatmap (JSON : liste de points {x, y, intensity})
    heatmap_home    = Column(JSON)
    heatmap_away    = Column(JSON)

    match = relationship("Match", back_populates="stats")


class Report(Base):
    """Rapport narratif généré par Claude"""
    __tablename__ = "reports"

    id         = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    match_id   = Column(UUID(as_uuid=False), ForeignKey("matches.id"), unique=True)
    content    = Column(Text)          # texte complet du rapport
    summary    = Column(Text)          # résumé 2-3 phrases
    strengths  = Column(JSON)          # ["point fort 1", "point fort 2"]
    weaknesses = Column(JSON)          # ["point faible 1", ...]
    tactics    = Column(JSON)          # recommandations tactiques
    pdf_s3_key = Column(String(512))   # PDF exporté
    created_at = Column(DateTime, default=datetime.utcnow)

    match = relationship("Match", back_populates="report")
