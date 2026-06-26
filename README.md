# XVPRO — SaaS IA d'analyse de matchs de rugby

## Structure du projet

```
XVPRO/
├── index.html              ← Prototype complet (landing + dashboard MVP)
├── docker-compose.yml      ← Tous les services en un seul fichier
├── .env.example            ← Variables d'environnement à copier en .env
│
├── apps/
│   ├── api/                ← Backend FastAPI (Python)
│   │   ├── main.py         ← Point d'entrée + middleware CORS
│   │   ├── database.py     ← Connexion PostgreSQL async
│   │   ├── models.py       ← Modèles SQLAlchemy (User, Match, Action, Stats, Report)
│   │   ├── routers/
│   │   │   ├── auth.py     ← Inscription / connexion / JWT
│   │   │   ├── upload.py   ← Upload S3 présigné + déclenchement pipeline
│   │   │   └── matches.py  ← CRUD matchs + récupération analyses
│   │   └── requirements.txt
│   │
│   ├── worker/             ← Pipeline IA (Celery + Python)
│   │   ├── celery_app.py   ← Configuration Celery/Redis
│   │   └── tasks/
│   │       ├── video_pipeline.py    ← Orchestration des 7 étapes
│   │       ├── ffmpeg_extractor.py  ← Extraction frames + clips
│   │       ├── yolo_detector.py     ← Détection joueurs/ballon (YOLOv8)
│   │       ├── action_classifier.py ← Classification des 15 actions rugby
│   │       └── claude_reporter.py   ← Rapport narratif via Claude API
│   │
│   └── web/                ← Frontend Next.js 14 (TypeScript)
│       ├── lib/api.ts       ← Client API (axios + intercepteurs JWT)
│       ├── hooks/useUpload.ts ← Hook upload avec progression temps réel
│       └── app/
│           └── dashboard/
│               ├── page.tsx           ← Tableau de bord
│               ├── upload/page.tsx    ← Page upload vidéo
│               └── match/[id]/page.tsx ← Vue analyse complète
```

## Démarrage rapide

```bash
# 1. Copier les variables d'env
cp .env.example .env
# → Remplir ANTHROPIC_API_KEY, AWS_*, JWT_SECRET

# 2. Démarrer tous les services
docker compose up

# 3. Accéder à l'app
# Frontend :  http://localhost:3000
# API :       http://localhost:8000/docs
```

## Pipeline IA — Étapes

| Étape | Outil | Description |
|-------|-------|-------------|
| 1. Download | boto3/S3 | Récupère la vidéo depuis S3 |
| 2. Frames | FFmpeg | Extrait 5 frames/seconde @ 1280×720 |
| 3. Détection | YOLOv8 | Détecte joueurs, ballon, arbitre + tracking |
| 4. Classification | PyTorch | Identifie 15 types d'actions rugby |
| 5. Clips | FFmpeg | Extrait des clips de 18s autour de chaque action clé |
| 6. Stats | Python | Calcule possession, plaquages, territoire, heatmaps |
| 7. Rapport | Claude API | Génère le rapport narratif tactique |

## Prochaines étapes

- [ ] Entraîner le modèle YOLOv8 sur des vidéos de rugby annotées
- [ ] Ajouter OCR pour détecter les numéros de maillot
- [ ] Implémenter les WebSockets pour la progression temps réel
- [ ] Ajouter les paiements Stripe
- [ ] Déployer sur Vercel (web) + Railway (api) + Modal.com (worker GPU)
