# XVPRO — Plan Produit Complet
> SaaS IA d'analyse de matchs de rugby

---

## Vision

XVPRO permet à n'importe quel club, entraîneur ou analyste rugby de déposer la vidéo d'un match et d'obtenir en retour une analyse complète et automatisée : actions détectées, timecodes, statistiques, rapports tactiques — le tout généré par IA, sans travail manuel.

**Cible :** clubs amateurs, semi-pros, pro, fédérations, analystes vidéo.

---

## 1. Fonctionnalités Clés

### Upload & Traitement vidéo
- Upload vidéo MP4, MOV, AVI, MKV (jusqu'à 2h de match)
- Traitement asynchrone en arrière-plan (barre de progression temps réel)
- Support multi-caméras (angle principal + caméra de côté)
- Compression automatique avant analyse

### Analyse IA du match
- **Détection d'actions automatique** : essai, transformation, pénalité, drop, mêlée, touche, plaquage, grattage, coup de pied en jeu, sortie en touche, faute, carton
- **Timecodes précis** pour chaque action détectée
- **Tracking des joueurs** : identification par numéro de maillot (vision IA)
- **Zones de jeu** : heatmaps et zones d'occupation du terrain
- **Statistiques équipe & joueur** : plaquages, courses avec ballon, passes, distance parcourue
- **Analyse tactique** : temps de possession, territoire, rythme de jeu, tendances
- **Résumé narratif** : rapport en langage naturel généré par LLM (Claude)

### Lecteur vidéo interactif
- Timeline annotée avec toutes les actions détectées
- Clips automatiques par action (clic → saut au bon timecode)
- Marquage / annotation manuelle en complément de l'IA
- Export des clips en MP4 (pour partage ou analyse)

### Dashboard & Rapports
- Vue match (score, actions, stats globales)
- Vue joueur (statistiques individuelles par match et sur la saison)
- Comparaison match vs match
- Export PDF des rapports
- Partage de rapports via lien (accès invité)

### Multi-équipes & Saisons
- Gestion de plusieurs équipes dans un même compte (fédérations)
- Historique de tous les matchs par saison
- Suivi de progression dans le temps

---

## 2. Architecture Technique

```
┌──────────────────────────────────────────────────────────┐
│                      FRONTEND                            │
│          Next.js 14 (App Router) + TypeScript            │
│          TailwindCSS + shadcn/ui                         │
│          Video.js (lecteur vidéo annoté)                 │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTPS / WebSocket
┌────────────────────────▼─────────────────────────────────┐
│                      BACKEND API                         │
│          FastAPI (Python) — REST + WebSocket             │
│          Auth : Supabase Auth (JWT)                      │
│          Rate limiting, upload validation                │
└──────┬────────────────────────────────┬──────────────────┘
       │                                │
┌──────▼──────────┐           ┌─────────▼────────────────┐
│   PostgreSQL    │           │     Redis (Queue)         │
│   (Supabase)   │           │  Celery Workers            │
│   Users, Teams  │           │  File de traitement vidéo │
│   Matches, Stats│           └─────────┬────────────────┘
└─────────────────┘                     │
                              ┌─────────▼────────────────┐
                              │    PIPELINE IA VIDÉO     │
                              │                          │
                              │  1. FFmpeg               │
                              │     → extraction frames  │
                              │     → découpe segments   │
                              │                          │
                              │  2. YOLOv8 (Computer CV) │
                              │     → détection joueurs  │
                              │     → détection ballon   │
                              │     → tracking positions │
                              │                          │
                              │  3. Classifieur actions  │
                              │     → CNN fine-tuné rugby│
                              │     → 15+ classes action │
                              │     → timecodes précis   │
                              │                          │
                              │  4. Claude API           │
                              │     → synthèse narrative │
                              │     → rapport tactique   │
                              │     → recommandations    │
                              └─────────┬────────────────┘
                                        │
                              ┌─────────▼────────────────┐
                              │   STOCKAGE VIDÉO         │
                              │   AWS S3 / Cloudflare R2 │
                              │   CDN pour lecture vidéo │
                              └──────────────────────────┘
```

---

## 3. Stack Technique Détaillé

| Composant | Technologie | Justification |
|-----------|-------------|---------------|
| Frontend | Next.js 14 + TypeScript | SSR, performance, DX |
| UI | TailwindCSS + shadcn/ui | Rapide, accessible |
| Lecteur vidéo | Video.js + plugin annotations | Timecodes interactifs |
| Backend API | FastAPI (Python) | Async natif, idéal ML |
| Auth | Supabase Auth | JWT, OAuth, rapide à setup |
| Base de données | PostgreSQL (Supabase) | Relationnel, fiable |
| Cache / Queue | Redis + Celery | File de traitement vidéo |
| Stockage vidéo | AWS S3 ou Cloudflare R2 | Coût, CDN intégré |
| Computer Vision | YOLOv8 (Ultralytics) | SOTA détection temps réel |
| Modèle actions | PyTorch (fine-tuning) | Classification rugby custom |
| Traitement vidéo | FFmpeg | Standard industrie |
| LLM / rapports | Claude API (Anthropic) | Analyse narrative rugbystique |
| Infra ML | Modal.com ou AWS Lambda GPU | Scaling auto des workers |
| Monitoring | Sentry + Posthog | Erreurs + analytics produit |
| Paiements | Stripe | SaaS billing standard |

---

## 4. Pipeline IA — Détail

### Étape 1 — Ingestion vidéo
```
Upload MP4 → S3
→ Validation format/durée
→ Création job en queue Redis
→ Notification WebSocket au frontend (statut : "en attente")
```

### Étape 2 — Pré-traitement (FFmpeg)
```
Extraction frames @ 25fps
Réduction résolution → 1280×720 si nécessaire
Découpe en segments de 30s pour traitement parallèle
```

### Étape 3 — Détection (YOLOv8)
```
Détection des joueurs (bounding boxes + tracking ID)
Détection du ballon
Détection des lignes de terrain (calibration)
Position GPS estimée sur terrain (homographie)
```

### Étape 4 — Classification des actions
```
Modèle CNN/Transformer entraîné sur actions rugby :
- Essai
- Transformation
- Pénalité (coup de pied)
- Drop
- Mêlée (engagement)
- Touche (lancer)
- Plaquage (identifié par configuration joueurs)
- Grattage / contestation
- Coup de pied en jeu
- Sortie en touche
- Faute sifflée
- Carton jaune / rouge

Output → liste d'actions avec timecodes (hh:mm:ss) + score de confiance
```

### Étape 5 — Analyse & Rapport (Claude API)
```
Prompt Claude avec :
- Liste des actions + timecodes
- Statistiques calculées
- Contexte du match (équipes, score)

Output :
- Rapport narratif en français
- Points forts / points faibles identifiés
- Recommandations tactiques
- Résumé exécutif (1 page)
```

### Étape 6 — Stockage & Livraison
```
Sauvegarde résultats en DB
Génération clips vidéo pour chaque action (FFmpeg)
Notification utilisateur (email + in-app)
Rapport disponible dans le dashboard
```

---

## 5. Schéma de Base de Données

```sql
users          → id, email, role, subscription_plan
organizations  → id, name, sport, country
teams          → id, org_id, name, category
players        → id, team_id, name, number, position
matches        → id, team_home, team_away, date, video_url, status
match_actions  → id, match_id, action_type, timecode, player_id, x, y, confidence
match_stats    → id, match_id, team_id, possession, territory, tackles, ...
player_stats   → id, match_id, player_id, tackles, carries, passes, ...
reports        → id, match_id, content_json, pdf_url, created_at
```

---

## 6. Modèle Économique

| Plan | Prix | Inclus |
|------|------|--------|
| **Starter** | 29€/mois | 4 matchs/mois, 1 équipe, rapports PDF |
| **Club** | 79€/mois | 15 matchs/mois, 3 équipes, export clips, partage |
| **Pro** | 199€/mois | Matchs illimités, multi-équipes, API accès, white-label |
| **Fédération** | Sur devis | Multi-clubs, reporting centralisé, intégration custom |

Coûts IA estimés par match (90 min) : ~0.80€ (GPU + Claude API)

---

## 7. Roadmap

### Phase 1 — MVP (Mois 1-3)
- [ ] Auth + gestion équipes
- [ ] Upload vidéo → S3
- [ ] Pipeline FFmpeg + YOLOv8 (détection joueurs/ballon)
- [ ] Lecteur vidéo avec timecodes manuels (fallback)
- [ ] Dashboard basique (stats match)
- [ ] Rapport texte généré par Claude

### Phase 2 — IA Core (Mois 4-6)
- [ ] Classifieur d'actions rugby (entraînement modèle)
- [ ] Timecodes automatiques par action
- [ ] Heatmaps joueurs
- [ ] Export PDF rapports
- [ ] Notifications email

### Phase 3 — Produit Complet (Mois 7-9)
- [ ] Tracking individuel par numéro de maillot
- [ ] Statistiques joueur détaillées
- [ ] Clips auto par action
- [ ] Comparaison inter-matchs
- [ ] Partage de rapports (lien public)
- [ ] Paiements Stripe + plans

### Phase 4 — Scale (Mois 10-12)
- [ ] Mode fédération (multi-clubs)
- [ ] API publique
- [ ] Analyse live (caméra stream)
- [ ] App mobile (consultation)
- [ ] White-label

---

## 8. Points Critiques & Risques

**Qualité vidéo** — La performance de l'IA dépend fortement de la qualité de la prise de vue (angle, stabilité, résolution). Prévoir des guidelines pour les clubs.

**Dataset d'entraînement** — Le classifieur d'actions rugby nécessite des données annotées (vidéos de matchs labelisées). Piste : partenariat fédérations, open datasets sportifs, annotation manuelle initiale (~500 matchs).

**Coûts GPU** — Le traitement d'un match de 90 min sur GPU peut prendre 15-30 min. Optimiser via traitement parallèle et file de priorité selon le plan.

**Confidentialité** — Les clubs ne veulent pas que leurs stratégies soient exposées. Isolement strict des données par organisation, chiffrement au repos.

**Réglementation** — Droit à l'image des joueurs. Prévoir CGU claires et anonymisation optionnelle.

---

## 9. Stack Dev & Déploiement

```
Repo       : Monorepo (Turborepo)
             /apps/web      → Next.js frontend
             /apps/api      → FastAPI backend
             /apps/worker   → Celery ML workers
             /packages/ui   → composants partagés

CI/CD      : GitHub Actions → tests → déploiement

Infra      : 
  Frontend  → Vercel
  API       → Railway ou Render
  Workers   → Modal.com (GPU serverless)
  DB/Auth   → Supabase
  Stockage  → Cloudflare R2
  
Envs       : dev → staging → prod
```

---

*Document généré le 23 juin 2026 — XVPRO*
