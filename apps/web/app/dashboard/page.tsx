'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const STATUS_STYLE: Record<string, string> = {
  pending:    'badge-pending',
  processing: 'badge-processing',
  done:       'badge-done',
  error:      'badge-error',
}
const STATUS_LABEL: Record<string, string> = {
  pending:    'En attente',
  processing: 'Analyse en cours',
  done:       'Analyse terminee',
  error:      'Erreur',
}
const STATUS_ICON: Record<string, string> = {
  pending:    '⏳',
  processing: '⚡',
  done:       '✓',
  error:      '✕',
}

export default function DashboardPage() {
  const [user, setUser]         = useState<any>(null)
  const [profile, setProfile]   = useState<any>(null)
  const [matches, setMatches]   = useState<any[]>([])
  const [actionCounts, setActionCounts] = useState<Record<string, number>>({})
  const [globalStats, setGlobalStats]   = useState({ totalActions: 0, avgSuccess: 0 })
  const [loading, setLoading]   = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.replace('/login'); return }
      setUser(session.user)

      const [{ data: prof }, { data: matchList }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', session.user.id).single(),
        supabase.from('matches').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(50),
      ])
      setProfile(prof)
      const mList = matchList ?? []
      setMatches(mList)

      // Pull action counts + stats for done matches
      const doneIds = mList.filter((m: any) => m.status === 'done').map((m: any) => m.id)
      if (doneIds.length > 0) {
        const [{ data: actions }, { data: stats }] = await Promise.all([
          supabase.from('match_actions').select('match_id').in('match_id', doneIds),
          supabase.from('match_stats').select('match_id, success_rate').in('match_id', doneIds),
        ])
        // Count actions per match
        const counts: Record<string, number> = {}
        ;(actions ?? []).forEach((a: any) => {
          counts[a.match_id] = (counts[a.match_id] ?? 0) + 1
        })
        setActionCounts(counts)
        // Global stats
        const totalActions = (actions ?? []).length
        const successRates = (stats ?? []).map((s: any) => s.success_rate).filter(Boolean)
        const avgSuccess = successRates.length
          ? Math.round(successRates.reduce((a: number, b: number) => a + b, 0) / successRates.length)
          : 0
        setGlobalStats({ totalActions, avgSuccess })
      }

      setLoading(false)
    }
    load()
  }, [])


  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#07090f]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-white/30">Chargement...</p>
      </div>
    </div>
  )

  const done       = matches.filter(m => m.status === 'done').length
  const processing = matches.filter(m => m.status === 'processing').length
  const pending    = matches.filter(m => m.status === 'pending').length
  const lastDone   = matches.find(m => m.status === 'done')

  return (
    <>
        {/* Topbar */}
        <div className="sticky top-0 z-40 nav-blur px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-white text-sm">Tableau de bord</h1>
            {processing > 0 && (
              <span className="badge-processing text-xs font-semibold px-2.5 py-1 rounded-full animate-pulse">
                ⚡ {processing} analyse{processing > 1 ? 's' : ''} en cours
              </span>
            )}
          </div>
          <Link href="/dashboard/upload"
            className="flex items-center gap-2 px-4 py-2 bg-amber-400 text-black text-xs font-bold rounded-lg hover:bg-amber-300 transition-all">
            + Analyser un match
          </Link>
        </div>

        <div className="p-8 space-y-6">

          {/* Hero greeting */}
          <div className="animate-fade-up">
            <h2 className="text-2xl font-extrabold text-white mb-0.5">
              Bonjour{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''} 👋
            </h2>
            <p className="text-white/35 text-sm">
              {done === 0
                ? 'Uploadez votre premier match pour commencer l\'analyse IA.'
                : `${done} match${done > 1 ? 's' : ''} analyse${done > 1 ? 's' : ''} · ${globalStats.totalActions} actions detectees au total`}
            </p>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4 animate-fade-up">
            {[
              {
                label: 'Matchs analyses',
                value: done,
                sub: `sur ${matches.length} total`,
                color: 'text-white',
                icon: '🏉',
                accent: 'border-white/7',
              },
              {
                label: 'Actions detectees',
                value: globalStats.totalActions > 0 ? globalStats.totalActions.toLocaleString('fr-FR') : '—',
                sub: 'par l\'IA sur l\'ensemble',
                color: 'text-amber-400',
                icon: '🎯',
                accent: 'border-amber-500/15',
              },
              {
                label: 'Taux de reussite moy.',
                value: globalStats.avgSuccess > 0 ? `${globalStats.avgSuccess}%` : '—',
                sub: 'actions positives',
                color: 'text-green-400',
                icon: '📈',
                accent: 'border-green-500/15',
              },
              {
                label: 'En cours d\'analyse',
                value: processing + pending,
                sub: processing > 0 ? 'pipeline IA actif' : 'en attente',
                color: processing > 0 ? 'text-blue-400' : 'text-white/40',
                icon: '⚡',
                accent: processing > 0 ? 'border-blue-500/15' : 'border-white/7',
              },
            ].map((s, i) => (
              <div key={i} className={`glass border ${s.accent} rounded-2xl p-5 card-hover`}>
                <div className="flex items-start justify-between mb-4">
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{s.label}</p>
                  <span className="text-base opacity-60">{s.icon}</span>
                </div>
                <p className={`text-3xl font-black ${s.color} mb-1`}>{s.value}</p>
                <p className="text-xs text-white/25">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Last completed match shortcut */}
          {lastDone && (
            <Link href={`/dashboard/match/${lastDone.id}`}
              className="flex items-center gap-4 p-5 glass border border-amber-500/15 rounded-2xl hover:border-amber-500/30 transition-all group animate-fade-up">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-lg">
                ⚡
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-amber-400/70 uppercase tracking-widest mb-0.5">Derniere analyse</p>
                <p className="font-bold text-white text-sm">{lastDone.team_home} vs {lastDone.team_away}</p>
                <p className="text-xs text-white/30">{lastDone.competition || 'Match'} · {actionCounts[lastDone.id] ?? '—'} actions</p>
              </div>
              <span className="text-amber-400/40 group-hover:text-amber-400 text-lg transition-colors">→</span>
            </Link>
          )}

          {/* Processing matches */}
          {(processing + pending) > 0 && (
            <div className="glass border border-blue-500/15 rounded-2xl overflow-hidden animate-fade-up">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <h2 className="font-bold text-white text-sm">En cours d'analyse</h2>
                <span className="text-xs text-white/25">{processing + pending} match{(processing + pending) > 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-white/3">
                {matches.filter(m => m.status === 'processing' || m.status === 'pending').map(m => (
                  <div key={m.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="flex-1">
                      <p className="font-semibold text-white text-sm">{m.team_home} <span className="text-white/30">vs</span> {m.team_away}</p>
                      <p className="text-xs text-white/25 mt-0.5">{m.competition || 'Match'}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLE[m.status]}`}>
                      {STATUS_ICON[m.status]} {STATUS_LABEL[m.status]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All matches */}
          <div className="glass border border-white/7 rounded-2xl overflow-hidden animate-fade-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="font-bold text-white text-sm">Historique des matchs</h2>
              <span className="text-xs text-white/25">{matches.length} match{matches.length !== 1 ? 's' : ''}</span>
            </div>

            {matches.length === 0 ? (
              <div className="py-20 text-center">
                <div className="text-5xl mb-5">🏉</div>
                <p className="font-bold text-white mb-2">Aucun match analyse</p>
                <p className="text-sm text-white/30 mb-8">Uploadez votre premier match pour commencer</p>
                <Link href="/dashboard/upload"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-400 text-black text-sm font-bold rounded-xl hover:bg-amber-300 transition-all">
                  + Analyser un match
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-white/3">
                {matches.map(m => {
                  const actCount = actionCounts[m.id]
                  const isDone = m.status === 'done'
                  return (
                    <div key={m.id} className={`flex items-center gap-4 px-6 py-4 transition-colors ${isDone ? 'hover:bg-white/2 cursor-pointer' : ''}`}
                      onClick={() => isDone && (window.location.href = `/dashboard/match/${m.id}`)}>
                      {/* Match info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-semibold text-white text-sm">
                            {m.team_home} <span className="text-white/30 font-normal">vs</span> {m.team_away}
                          </p>
                          {m.score_home != null && (
                            <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                              {m.score_home} – {m.score_away}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/25">
                          {m.competition || 'Match'}
                          {m.match_date ? ` · ${new Date(m.match_date).toLocaleDateString('fr-FR')}` : ''}
                          {actCount ? ` · ${actCount} actions` : ''}
                        </p>
                      </div>

                      {/* Status badge */}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${STATUS_STYLE[m.status] ?? STATUS_STYLE.pending}`}>
                        {STATUS_ICON[m.status]} {STATUS_LABEL[m.status] ?? 'En attente'}
                      </span>

                      {/* CTA */}
                      {isDone ? (
                        <Link href={`/dashboard/match/${m.id}`}
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-amber-400 font-semibold hover:text-amber-300 transition-colors flex-shrink-0 ml-2">
                          Voir →
                        </Link>
                      ) : (
                        <span className="w-12 flex-shrink-0" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Upload CTA */}
          <Link href="/dashboard/upload"
            className="flex items-center gap-4 p-6 glass border border-dashed border-white/10 rounded-2xl hover:border-amber-500/30 hover:bg-amber-500/3 transition-all group animate-fade-up">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-2xl group-hover:border-amber-500/30 transition-all">
              🎬
            </div>
            <div>
              <p className="font-bold text-white group-hover:text-amber-300 transition-colors">Analyser un nouveau match</p>
              <p className="text-sm text-white/30">Fichier video ou lien VEO · HUDL · WeTransfer · Google Drive</p>
            </div>
            <span className="ml-auto text-white/20 group-hover:text-amber-400 text-xl transition-colors">→</span>
          </Link>

        </div>
    </>
  )
}
