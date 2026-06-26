'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ACTION_LABELS: Record<string, string> = {
  essai: 'Essai', transformation: 'Transfo', penalite: 'Penalite',
  drop: 'Drop', melee: 'Melee', touche: 'Touche', plaquage: 'Plaquage',
  ruck: 'Ruck', passe: 'Passe', course: 'Course',
  carton_jaune: 'Carton Jaune', carton_rouge: 'Carton Rouge',
  mi_temps: 'Mi-temps', coup_sifflet: 'Fin du match',
}

const QUAL_LABEL: Record<string, string> = {
  positif: 'Positif', neutre: 'Neutre', negatif: 'Negatif',
}

function getQualification(action: any): 'positif' | 'neutre' | 'negatif' {
  if (action.qualification) return action.qualification
  if (action.success === true) return 'positif'
  if (action.success === false) return 'negatif'
  return 'neutre'
}

const fmt = (s: number) => `${Math.floor(s / 60)}'${String(Math.floor(s % 60)).padStart(2, '0')}`

export default function PrintPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()
  const [match, setMatch]     = useState<any>(null)
  const [actions, setActions] = useState<any[]>([])
  const [stats, setStats]     = useState<any>(null)
  const [report, setReport]   = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: m }, { data: a }, { data: st }, { data: r }] = await Promise.all([
        supabase.from('matches').select('*').eq('id', id).single(),
        supabase.from('match_actions').select('*').eq('match_id', id).order('timecode_sec'),
        supabase.from('match_stats').select('*').eq('match_id', id).single(),
        supabase.from('reports').select('*').eq('match_id', id).single(),
      ])
      setMatch(m); setActions(a ?? []); setStats(st); setReport(r)
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    if (!loading && match) {
      setTimeout(() => window.print(), 800)
    }
  }, [loading, match])

  if (loading || !match) return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: 40, textAlign: 'center', color: '#666' }}>
      Preparation du rapport...
    </div>
  )

  const actionCounts = actions.reduce((acc: any, a: any) => {
    acc[a.action_type] = (acc[a.action_type] ?? 0) + 1; return acc
  }, {})
  const positifs = actions.filter(a => getQualification(a) === 'positif').length
  const negatifs = actions.filter(a => getQualification(a) === 'negatif').length
  const neutrals = actions.filter(a => getQualification(a) === 'neutre').length

  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const matchDate = match.match_date
    ? new Date(match.match_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  return (
    <>
      <style>{`
        @page {
          margin: 18mm 15mm;
          size: A4 portrait;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; background: white; font-size: 11px; line-height: 1.5; }
        .page-break { page-break-before: always; }
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Print button (hidden on print) */}
      <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, zIndex: 100, display: 'flex', gap: 8 }}>
        <button onClick={() => window.print()} style={{ padding: '8px 16px', background: '#1a1a1a', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
          Imprimer / Sauvegarder PDF
        </button>
        <button onClick={() => window.close()} style={{ padding: '8px 16px', background: '#f5f5f5', color: '#333', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
          Fermer
        </button>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 0 40px' }}>

        {/* ── Header ── */}
        <div style={{ borderBottom: '3px solid #1a1a1a', paddingBottom: 16, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.5, color: '#1a1a1a' }}>
                XV<span style={{ color: '#d97706' }}>PRO</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#d97706', background: '#fef3c7', padding: '2px 6px', borderRadius: 4, marginLeft: 8, verticalAlign: 'middle' }}>IA</span>
              </div>
              <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>Rapport d'analyse video</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 10, color: '#888' }}>
              <div>Genere le {today}</div>
              {match.competition && <div style={{ marginTop: 2, fontWeight: 600, color: '#555' }}>{match.competition}</div>}
            </div>
          </div>
        </div>

        {/* ── Match title ── */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#1a1a1a', letterSpacing: -1 }}>
            {match.team_home} <span style={{ color: '#ccc', fontWeight: 300 }}>vs</span> {match.team_away}
          </div>
          {matchDate && <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{matchDate}</div>}
        </div>

        {/* ── Score ── */}
        {match.score_home != null && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 0, marginBottom: 32 }}>
            <div style={{ textAlign: 'center', padding: '16px 32px', background: '#f8f8f8', borderRadius: '12px 0 0 12px', borderRight: '1px solid #e5e5e5', minWidth: 140 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{match.team_home}</div>
              <div style={{ fontSize: 40, fontWeight: 900, color: '#1a1a1a' }}>{match.score_home}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', background: '#f8f8f8', fontSize: 20, color: '#ccc', fontWeight: 300 }}>–</div>
            <div style={{ textAlign: 'center', padding: '16px 32px', background: '#f8f8f8', borderRadius: '0 12px 12px 0', borderLeft: '1px solid #e5e5e5', minWidth: 140 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{match.team_away}</div>
              <div style={{ fontSize: 40, fontWeight: 900, color: '#1a1a1a' }}>{match.score_away}</div>
            </div>
          </div>
        )}

        {/* ── Stats summary ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
          {[
            { label: 'Actions totales', value: actions.length },
            { label: 'Positives',       value: positifs, color: '#16a34a' },
            { label: 'Negatives',       value: negatifs, color: '#dc2626' },
            { label: 'Taux de reussite', value: actions.length ? `${Math.round(positifs / actions.length * 100)}%` : '—', color: '#2563eb' },
          ].map((s, i) => (
            <div key={i} style={{ border: '1px solid #e5e5e5', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color ?? '#1a1a1a' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── Actions by type ── */}
        {Object.keys(actionCounts).length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#1a1a1a', marginBottom: 12, paddingBottom: 6, borderBottom: '2px solid #f0f0f0' }}>
              Repartition des actions
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {Object.entries(actionCounts).sort(([, a], [, b]) => (b as number) - (a as number)).map(([type, count]) => (
                <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: '#fafafa', borderRadius: 7, border: '1px solid #f0f0f0' }}>
                  <span style={{ fontSize: 10, color: '#555', fontWeight: 600 }}>{ACTION_LABELS[type] ?? type}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#1a1a1a' }}>{count as number}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Match stats from DB ── */}
        {stats && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#1a1a1a', marginBottom: 12, paddingBottom: 6, borderBottom: '2px solid #f0f0f0' }}>
              Statistiques detaillees
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {[
                { label: 'Plaquages reussis',  value: stats.tackles_success != null ? `${stats.tackles_success}/${(stats.tackles_success ?? 0) + (stats.tackles_missed ?? 0)}` : null },
                { label: 'Rucks gagnes',       value: stats.rucks_won != null ? `${stats.rucks_won}/${(stats.rucks_won ?? 0) + (stats.rucks_lost ?? 0)}` : null },
                { label: 'Touches gagnees',    value: stats.lineouts_won != null ? `${stats.lineouts_won}/${(stats.lineouts_won ?? 0) + (stats.lineouts_lost ?? 0)}` : null },
                { label: 'Melee dominee',      value: stats.scrums_won != null ? `${stats.scrums_won}/${(stats.scrums_won ?? 0) + (stats.scrums_lost ?? 0)}` : null },
                { label: 'Metres gagnes',      value: stats.meters_gained != null ? `${stats.meters_gained} m` : null },
                { label: 'Temps de jeu effectif', value: stats.effective_time_sec != null ? `${Math.floor(stats.effective_time_sec / 60)} min` : null },
              ].filter(s => s.value !== null).map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                  <span style={{ fontSize: 10, color: '#666' }}>{s.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a1a' }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── AI Report ── */}
        {report?.content && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#1a1a1a', marginBottom: 12, paddingBottom: 6, borderBottom: '2px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Rapport IA</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#d97706', background: '#fef3c7', padding: '2px 7px', borderRadius: 4 }}>Claude AI</span>
            </div>
            <div style={{ fontSize: 11, color: '#333', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{report.content}</div>
          </div>
        )}

        {/* ── Timeline ── */}
        <div className="page-break" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#1a1a1a', marginBottom: 12, paddingBottom: 6, borderBottom: '2px solid #f0f0f0' }}>
            Timeline des actions ({actions.length} actions)
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                {['Temps', 'Action', 'Equipe', 'Qualification', 'Description'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontWeight: 700, color: '#555', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e5e5e5' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actions.map((a, i) => {
                const qual = getQualification(a)
                const qualColor = qual === 'positif' ? '#16a34a' : qual === 'negatif' ? '#dc2626' : '#888'
                return (
                  <tr key={a.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '6px 10px', fontWeight: 700, color: '#1a1a1a', whiteSpace: 'nowrap' }}>
                      {a.timecode_sec != null ? fmt(a.timecode_sec) : '—'}
                    </td>
                    <td style={{ padding: '6px 10px', fontWeight: 600, color: '#333' }}>
                      {ACTION_LABELS[a.action_type] ?? a.action_type}
                    </td>
                    <td style={{ padding: '6px 10px', color: '#555' }}>
                      {a.team ?? '—'}
                    </td>
                    <td style={{ padding: '6px 10px', fontWeight: 600, color: qualColor }}>
                      {QUAL_LABEL[qual]}
                    </td>
                    <td style={{ padding: '6px 10px', color: '#666', maxWidth: 200 }}>
                      {a.description ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ── Footer ── */}
        <div style={{ borderTop: '1px solid #e5e5e5', paddingTop: 12, marginTop: 24, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#bbb' }}>
          <span>XVPRO — Analyse IA Rugby</span>
          <span>{match.team_home} vs {match.team_away} · {matchDate ?? ''}</span>
        </div>

      </div>
    </>
  )
}
