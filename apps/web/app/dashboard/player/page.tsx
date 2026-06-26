'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Tab = 'stats' | 'mymatches' | 'club'

function StatCard({ label, value, color = 'text-white' }: { label: string; value: number; color?: string }) {
  return (
    <div className="glass border border-white/7 rounded-2xl p-4 text-center">
      <p className={`text-3xl font-black ${color}`}>{value}</p>
      <p className="text-xs text-white/30 mt-1">{label}</p>
    </div>
  )
}

export default function PlayerDashboard() {
  const supabase = createClient()
  const router   = useRouter()
  const [user, setUser]               = useState<any>(null)
  const [profiles, setProfiles]       = useState<any[]>([])
  const [myMatches, setMyMatches]     = useState<any[]>([])
  const [clubMatches, setClubMatches] = useState<any[]>([])
  const [tab, setTab]                 = useState<Tab>('stats')
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.push('/login'); return }
      setUser(u)

      // Profils deja tagges + stats
      const { data: pp } = await supabase
        .from('player_profiles')
        .select('*, player_stats(*), matches(id, title, team_home, team_away, match_date, competition, status)')
        .eq('user_id', u.id)
        .order('created_at', { ascending: false })
      setProfiles(pp ?? [])

      // Ses propres matchs uploades
      const { data: own } = await supabase
        .from('matches')
        .select('id, title, status, created_at, team_home, team_away')
        .eq('user_id', u.id)
        .order('created_at', { ascending: false })
      setMyMatches(own ?? [])

      // Matchs du club pour se taguer
      const { data: membership } = await supabase
        .from('club_members').select('club_id').eq('user_id', u.id).single()

      if (membership?.club_id) {
        const { data: coaches } = await supabase
          .from('club_members').select('user_id')
          .eq('club_id', membership.club_id).in('role', ['coach', 'owner'])
        if (coaches && coaches.length > 0) {
          const coachIds = coaches.map((c: any) => c.user_id)
          const taggedIds = (pp ?? []).map((p: any) => p.match_id)
          const ownIds    = (own ?? []).map((m: any) => m.id)
          const excludeIds = [...new Set([...taggedIds, ...ownIds])]
          const exclude = excludeIds.length > 0 ? `(${excludeIds.join(',')})` : '(00000000-0000-0000-0000-000000000000)'
          const { data: cm } = await supabase
            .from('matches').select('id, title, team_home, team_away, match_date, status')
            .in('user_id', coachIds).eq('status', 'done')
            .not('id', 'in', exclude).order('created_at', { ascending: false }).limit(20)
          setClubMatches(cm ?? [])
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#07090f]">
      <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </>
  )

  const allStats = profiles.flatMap((p: any) => p.player_stats ?? [])
  const totals = allStats.reduce((acc: any, s: any) => ({
    total_actions:   (acc.total_actions   ?? 0) + (s.total_actions   ?? 0),
    tackles:         (acc.tackles         ?? 0) + (s.tackles         ?? 0),
    rucks:           (acc.rucks           ?? 0) + (s.rucks           ?? 0),
    carries:         (acc.carries         ?? 0) + (s.carries         ?? 0),
    lineouts:        (acc.lineouts        ?? 0) + (s.lineouts        ?? 0),
    scrums:          (acc.scrums          ?? 0) + (s.scrums          ?? 0),
    penalties:       (acc.penalties       ?? 0) + (s.penalties       ?? 0),
    try_involvement: (acc.try_involvement ?? 0) + (s.try_involvement ?? 0),
  }), {})

  const playerName = profiles[0]?.name ?? user?.user_metadata?.full_name ?? 'Joueur'

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'stats',     label: 'Mes stats' },
    { key: 'mymatches', label: 'Mes matchs', count: myMatches.length },
    { key: 'club',      label: 'Club',        count: clubMatches.length },
  ]

  return (
    <>



      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-400/15 border border-amber-400/25 flex items-center justify-center text-xl font-black text-amber-400">
              {playerName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-black">{playerName}</h1>
              <p className="text-xs text-white/30">{profiles.length} match{profiles.length !== 1 ? 's' : ''} identifies &bull; {myMatches.length} uploades</p>
            </div>
          </div>
          <Link href="/pricing" className="text-xs text-white/30 hover:text-white/60 border border-white/10 px-3 py-1.5 rounded-lg transition-all">
            Voir les offres
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 mb-8 w-fit">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${tab === t.key ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}>
              {t.label}
              {t.count !== undefined && t.count > 0 && <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full">{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Stats */}
        {tab === 'stats' && (
          <div>
            {profiles.length === 0 ? (
              <div className="glass border border-white/10 rounded-2xl p-12 text-center">
                <p className="font-semibold text-white/50 mb-2">Pas encore de stats</p>
                <p className="text-sm text-white/30 mb-6">Upload un match ou retrouve-toi dans un match de ton club.</p>
                <div className="flex gap-3 justify-center">
                  <Link href="/dashboard/upload" className="px-5 py-2.5 bg-amber-400 text-gray-900 font-bold rounded-xl text-sm hover:bg-amber-300 transition-all">
                    Analyser un match
                  </Link>
                  <button onClick={() => setTab('club')} className="px-5 py-2.5 bg-white/10 text-white font-bold rounded-xl text-sm hover:bg-white/15 transition-all">
                    Matchs du club
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <StatCard label="Actions" value={totals.total_actions ?? 0} />
                  <StatCard label="Plaquages" value={totals.tackles ?? 0} color="text-blue-400" />
                  <StatCard label="Rucks" value={totals.rucks ?? 0} color="text-purple-400" />
                  <StatCard label="Essais" value={totals.try_involvement ?? 0} color="text-green-400" />
                </div>
                <div className="grid grid-cols-4 gap-3 mb-8">
                  <StatCard label="Ballons" value={totals.carries ?? 0} color="text-teal-400" />
                  <StatCard label="Touches" value={totals.lineouts ?? 0} color="text-indigo-400" />
                  <StatCard label="Melees" value={totals.scrums ?? 0} color="text-blue-300" />
                  <StatCard label="Penalites" value={totals.penalties ?? 0} color="text-red-400" />
                </div>
                <p className="text-xs font-bold text-white/25 uppercase tracking-widest mb-4">Par match</p>
                <div className="space-y-3">
                  {profiles.map((p: any, i: number) => {
                    const m  = p.matches
                    const ps = p.player_stats?.[0] ?? {}
                    return (
                      <Link key={i} href={`/dashboard/match/${p.match_id}`}
                        className="glass border border-white/7 hover:border-white/20 rounded-xl p-4 flex items-center justify-between transition-all group">
                        <div>
                          <p className="font-semibold text-sm">{m?.title ?? 'Match'}</p>
                          <p className="text-xs text-white/30">{m?.match_date ? new Date(m.match_date).toLocaleDateString('fr-FR') : ''}</p>
                        </div>
                        <div className="flex gap-4 text-xs text-white/40">
                          {ps.tackles > 0 && <span>{ps.tackles} plaq.</span>}
                          {ps.rucks > 0 && <span>{ps.rucks} rucks</span>}
                          {ps.try_involvement > 0 && <span className="text-green-400">{ps.try_involvement} essais</span>}
                          <span className="text-white/20 group-hover:text-white/50">&rarr;</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Mes matchs uploades */}
        {tab === 'mymatches' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-white/25 uppercase tracking-widest">Matchs uploades</p>
              <Link href="/dashboard/upload" className="px-4 py-2 bg-amber-400 text-gray-900 text-xs font-black rounded-xl hover:bg-amber-300 transition-all">
                + Nouveau match
              </Link>
            </div>
            {myMatches.length === 0 ? (
              <div className="glass border border-white/10 rounded-2xl p-12 text-center">
                <p className="font-semibold text-white/50 mb-2">Aucun match uploade</p>
                <p className="text-sm text-white/30 mb-6">Uploade ta propre video de match pour l&apos;analyser avec l&apos;IA.</p>
                <Link href="/dashboard/upload" className="px-5 py-2.5 bg-amber-400 text-gray-900 font-bold rounded-xl text-sm hover:bg-amber-300 transition-all">
                  Analyser mon premier match
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {myMatches.map((m: any) => (
                  <Link key={m.id} href={`/dashboard/match/${m.id}`}
                    className="glass border border-white/7 hover:border-white/20 rounded-xl px-5 py-4 flex items-center justify-between transition-all group">
                    <div>
                      <p className="font-semibold text-sm">{m.title ?? `${m.team_home ?? '?'} vs ${m.team_away ?? '?'}`}</p>
                      <p className="text-xs text-white/30">{new Date(m.created_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${m.status === 'done' ? 'bg-green-500/15 text-green-400' : m.status === 'processing' ? 'bg-amber-500/15 text-amber-400' : 'bg-white/10 text-white/40'}`}>
                        {m.status === 'done' ? 'Analyse' : m.status === 'processing' ? 'En cours' : m.status}
                      </span>
                      <span className="text-white/20 group-hover:text-white/50">&rarr;</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Matchs du club pour se taguer */}
        {tab === 'club' && (
          <div>
            <p className="text-xs font-bold text-white/25 uppercase tracking-widest mb-1">Matchs de ton club</p>
            <p className="text-xs text-white/20 mb-4">{'Retrouve-toi dans un match et clique "C\'est moi" pour lier tes stats.'}</p>
            {clubMatches.length === 0 ? (
              <div className="glass border border-white/10 rounded-2xl p-12 text-center">
                <p className="font-semibold text-white/50 mb-2">Aucun match de club disponible</p>
                <p className="text-sm text-white/30">Rejoins ton club avec son code lors de l&apos;inscription.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {clubMatches.map((m: any) => (
                  <Link key={m.id} href={`/dashboard/match/${m.id}`}
                    className="glass border border-amber-400/15 hover:border-amber-400/30 rounded-xl p-4 flex items-center justify-between transition-all group">
                    <div>
                      <p className="font-semibold text-sm">{m.title ?? `${m.team_home ?? '?'} vs ${m.team_away ?? '?'}`}</p>
                      <p className="text-xs text-white/30">{m.match_date ? new Date(m.match_date).toLocaleDateString('fr-FR') : ''}</p>
                    </div>
                    <span className="text-xs text-amber-400 font-bold group-hover:text-amber-300 transition-colors">Me taguer &rarr;</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
