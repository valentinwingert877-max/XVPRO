"""
Génération du rapport narratif via Claude API (Anthropic)

Prend en entrée :
  - La liste des actions détectées (avec timecodes)
  - Les statistiques calculées
  - Les infos du match

Retourne un rapport structuré :
  - Résumé exécutif
  - Analyse section par section
  - Points forts / points faibles
  - Recommandations tactiques
"""
import os
import logging
from typing import List, Dict, Any
import anthropic

logger = logging.getLogger(__name__)

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def generate_report(
    match_id: str,
    actions: List[Dict],
    stats: Dict,
    duration_sec: float,
    team_home: str = "Équipe Domicile",
    team_away: str = "Équipe Extérieure",
    score_home: int = 0,
    score_away: int = 0,
) -> Dict[str, Any]:
    """
    Génère un rapport d'analyse complet en utilisant Claude.

    Returns:
        Dict avec content, summary, strengths, weaknesses, tactics
    """
    logger.info(f"[{match_id}] Génération rapport Claude...")

    # Formate les actions pour le prompt
    actions_text = _format_actions(actions)
    stats_text = _format_stats(stats, team_home, team_away)
    duration_min = int(duration_sec / 60)

    prompt = f"""Tu es un analyste vidéo expert en rugby de haut niveau. Analyse ce match et produis un rapport tactique complet, précis et actionnable.

## Infos du match
- **{team_home}** {score_home} — {score_away} **{team_away}**
- Durée : {duration_min} minutes

## Actions détectées par l'IA
{actions_text}

## Statistiques calculées
{stats_text}

## Instructions
Rédige un rapport d'analyse structuré en français comprenant :

1. **RÉSUMÉ EXÉCUTIF** (3-4 phrases) : bilan global du match, facteurs clés du résultat

2. **ANALYSE PAR PHASE DE JEU**
   - Phases statiques (mêlées, touches)
   - Attaque (modes de jeu, zones, efficacité)
   - Défense (organisation, plaquages, discipline)

3. **POINTS FORTS** (3 points maximum, concrets et appuyés sur les données)

4. **POINTS À AMÉLIORER** (3 points maximum, avec les timecodes concernés)

5. **RECOMMANDATIONS TACTIQUES** (3 recommandations actionnables pour le prochain match)

Sois précis, cite les timecodes et les statistiques, évite les généralités. Ton ton doit être celui d'un analyste professionnel s'adressant à un staff technique."""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )

    full_content = response.content[0].text
    logger.info(f"[{match_id}] Rapport généré ({len(full_content)} caractères)")

    # Parse structuré
    return {
        "content":    full_content,
        "summary":    _extract_section(full_content, "RÉSUMÉ EXÉCUTIF"),
        "strengths":  _extract_list(full_content, "POINTS FORTS"),
        "weaknesses": _extract_list(full_content, "POINTS À AMÉLIORER"),
        "tactics":    _extract_list(full_content, "RECOMMANDATIONS TACTIQUES"),
    }


def _format_actions(actions: List[Dict]) -> str:
    """Formate les actions pour le prompt"""
    if not actions:
        return "Aucune action détectée."
    lines = []
    for a in actions:
        conf_pct = int(a.get("confidence", 0) * 100)
        line = f"- [{a['timecode_str']}] **{a['action_type'].upper()}** — {a.get('description', '')} (confiance: {conf_pct}%)"
        lines.append(line)
    return "\n".join(lines)


def _format_stats(stats: Dict, team_home: str, team_away: str) -> str:
    """Formate les stats pour le prompt"""
    if not stats:
        return "Statistiques non disponibles."
    return f"""
- Possession : {team_home} {stats.get('possession_home', 50):.0f}% | {team_away} {100 - stats.get('possession_home', 50):.0f}%
- Territoire : {team_home} {stats.get('territory_home', 50):.0f}% en camp adverse
- Plaquages : {stats.get('tackles_home', 0)} tentés, {stats.get('tackles_success_home', 0)} réussis ({_tackle_rate(stats)}% taux réussite)
- Essais : {stats.get('tries_home', 0)} (domicile) vs {stats.get('tries_away', 0)} (extérieur)
- Mêlées gagnées : {stats.get('scrums_won_home', 0)}/{stats.get('scrums_home', 1)}
- Touches gagnées : {stats.get('lineouts_won_home', 0)}/{stats.get('lineouts_home', 1)}
- Pénalités concédées : {stats.get('penalties_home', 0)} (domicile) vs {stats.get('penalties_away', 0)} (extérieur)
"""


def _tackle_rate(stats: Dict) -> int:
    t = stats.get("tackles_home", 0)
    s = stats.get("tackles_success_home", 0)
    return int(s / t * 100) if t > 0 else 0


def _extract_section(text: str, section: str) -> str:
    """Extrait le contenu d'une section du rapport"""
    lines = text.split("\n")
    in_section = False
    result = []
    for line in lines:
        if section in line.upper():
            in_section = True
            continue
        if in_section:
            if line.startswith("##") or line.startswith("**") and ":" in line and in_section and result:
                break
            result.append(line)
    return "\n".join(result).strip()


def _extract_list(text: str, section: str) -> List[str]:
    """Extrait une liste à puces d'une section"""
    section_text = _extract_section(text, section)
    items = []
    for line in section_text.split("\n"):
        line = line.strip()
        if line.startswith(("-", "•", "*", "1.", "2.", "3.")):
            items.append(line.lstrip("-•*123. ").strip())
    return items[:5]   # max 5 items
