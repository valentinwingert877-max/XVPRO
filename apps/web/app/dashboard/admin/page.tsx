'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const NAV = [
  { href: '/dashboard',        label: 'Tableau de bord' },
  { href: '/dashboard/upload', label: 'Analyser un match' },
  { href: '/dashboard/admin',  label: 'Admin' },
]

const PLAN_STYLE: Record<string, string> = {
  free:       'bg-white/8 text-white/40 border-white/12',
  pro:        'bg-amber-500/15 text-amber-400 border-amber-500/25',
  enterprise: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
}

const STATUS_STYLE: Record<string, string> = {
  pending:    'bg-white/8 text-white/40 border-white/12',
  processing: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  done:       'bg-green-500/15 text-green-400 border-green-500/25',
  error:      'bg-red-500/15 text-red-400 border-red-500/25',
}

export default function AdminPage() {
  const [user, setUser]       = useState<any>(null)
  const [tab, setTab]         = useState<'overview' | 'users' | 'matches'>('overview')
  const [users, setUsers]     = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [stats, setStats]     = useState({ totalUsers: 0, totalMatches: 0, doneMatches: 0, totalActions: 0 })
  const [loading, setLoading] = useState(true)
  const [actionMsg, setActionMsg] = useState('')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.replace('/login'); return }

      // Check admin role
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      if (profile?.role !== 'admin') { window.location.replace('/dashboard'); return }
      setUser(session.user)

      await fetchAll()
      setLoading(false)
    }
    load()
  }, [])

  async function fetchAll() {
    const [{ data: allUsers }, { data: allMatches }, { data: allActions }] = await Promise.all([
      supabase.rpc('admin_get_all_profiles'),
      supabase.rpc('admin_get_all_matches'),
      supabase.rpc('admin_count_actions'),
    ])
    const u = allUsers ?? []
    const m = allMatches ?? []
    setUsers(u)
    setMatches(m)
    setStats({
      totalUsers:    u.length,
      totalMatches:  m.length,
      doneMatches:   m.filter((x: any) => x.status === 'done').length,
      totalActions:  allActions ?? 0,
    })
  }

  async function togglePlan(userId: string, currentPlan: string) {
    const next = currentPlan === 'pro' ? 'free' : 'pro'
    await supabase.rpc('admin_set_user_plan', { target_user_id: userId, new_plan: next })
    setActionMsg(`Plan mis a jour : ${next}`)
    setTimeout(() => setActionMsg(''), 3000)
    await fetchAll()
  }

  async function toggleBlock(userId: string, isBlocked: boolean) {
    await supabase.rpc('admin_set_user_blocked', { target_user_id: userId, blocked: !isBlocked })
    setActionMsg(isBlocked ? 'Compte reactivite' : 'Compte bloque')
    setTimeout(() => setActionMsg(''), 3000)
    await fetchAll()
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.replace('/login')
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#07090f]">
      <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="flex min-h-screen bg-[#07090f]">

      {/* Sidebar */}
      <aside className="sidebar-dark w-[240px] flex flex-col fixed top-0 left-0 h-full z-50">
        <div className="px-6 py-5 border-b border-white/5">
          <span className="text-xl font-extrabold text-white">XV<span className="text-amber-400">PRO</span></span>
          <span className="ml-2 text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full">ADMIN</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(n => {
            const isActive = typeof window !== 'undefined' && window.location.pathname === n.href
            return (
              <a key={n.href} href={n.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive ? 'bg-white/8 text-white border border-white/10' : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}>
                {n.label}
              </a>
            )
          })}
        </nav>
        <div className="px-3 py-4 border-t border-white/5">
          <button onClick={handleSignOut}
            className="w-full text-left px-3 py-2 text-xs text-white/30 hover:text-red-400 hover:bg-red-500/8 rounded-lg transition-all">
            Deconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-[240px] min-h-screen">
        {/* Topbar */}
        <div className="sticky top-0 z-40 nav-blur px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-white text-sm">Panneau Admin</h1>
            <span className="text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">Acces restreint</span>
          </div>
          {actionMsg && (
            <span className="text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-lg animate-fade-up">
              {actionMsg}
            </span>
          )}
        </div>

        <div className="p-8 space-y-6">

          {/* KPI */}
          <div className="grid grid-cols-4 gap-4 animate-fade-up">
            {[
              { label: 'Utilisateurs',      value: stats.totalUsers,   color: 'text-white',       icon: '👥' },
              { label: 'Matchs total',       value: stats.totalMatches, color: 'text-amber-400',   icon: '🏉' },
              { label: 'Analyses terminees', value: stats.doneMatches,  color: 'text-green-400',   icon: '✓' },
              { label: 'Actions IA total',   value: stats.totalActions.toLocaleString('fr-FR'), color: 'text-blue-400', icon: '⚡' },
            ].map((s, i) => (
              <div key={i} className="glass border border-white/7 rounded-2xl p-5">
                <div className="flex items-start justify-between mb-4">
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{s.label}</p>
                  <span className="text-base opacity-50">{s.icon}</span>
                </div>
                <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-white/4 border border-white/8 rounded-2xl p-1 w-fit animate-fade-up">
            {(['overview', 'users', 'matches'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  tab === t ? 'bg-white/10 text-white border border-white/12' : 'text-white/30 hover:text-white/60'
                }`}>
                {t === 'overview' ? 'Vue globale' : t === 'users' ? `Utilisateurs (${stats.totalUsers})` : `Matchs (${stats.totalMatches})`}
              </button>
            ))}
          </div>

          {/* Tab: Overview */}
          {tab === 'overview' && (
            <div className="grid grid-cols-2 gap-4 animate-fade-up">
              {/* Plan distribution */}
              <div className="glass border border-white/7 rounded-2xl p-6">
                <h3 className="font-bold text-white mb-4">Repartition des plans</h3>
                {(['free', 'pro', 'enterprise'] as const).map(plan => {
                  const count = users.filter(u => (u.plan ?? 'free') === plan).length
                  const pct = stats.totalUsers ? Math.round(count / stats.totalUsers * 100) : 0
                  return (
                    <div key={plan} className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${PLAN_STYLE[plan]}`}>{plan.toUpperCase()}</span>
                        <span className="text-xs text-white/40">{count} users ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400/50 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Match status distribution */}
              <div className="glass border border-white/7 rounded-2xl p-6">
                <h3 className="font-bold text-white mb-4">Statuts des matchs</h3>
                {(['done', 'processing', 'pending', 'error'] as const).map(status => {
                  const labels: Record<string, string> = { done: 'Termines', processing: 'En cours', pending: 'En attente', error: 'Erreurs' }
                  const count = matches.filter(m => m.status === status).length
                  const pct = stats.totalMatches ? Math.round(count / stats.totalMatches * 100) : 0
                  return (
                    <div key={status} className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[status]}`}>{labels[status]}</span>
                        <span className="text-xs text-white/40">{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-green-400/50 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tab: Users */}
          {tab === 'users' && (
            <div className="glass border border-white/7 rounded-2xl overflow-hidden animate-fade-up">
              <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <h2 className="font-bold text-white text-sm">Tous les utilisateurs</h2>
                <span className="text-xs text-white/25">{stats.totalUsers} comptes</span>
              </div>
              <div className="divide-y divide-white/3">
                {users.map((u: any) => (
                  <div key={u.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xs font-bold text-black flex-shrink-0">
                      {(u.full_name ?? u.email ?? 'U')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm">{u.full_name || '—'}</p>
                      <p className="text-xs text-white/30 truncate">{u.email} {u.club_name ? `· ${u.club_name}` : ''}</p>
                    </div>
                    <span className="text-xs text-white/25">{u.match_count ?? 0} matchs</span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${PLAN_STYLE[u.plan ?? 'free']}`}>
                      {(u.plan ?? 'free').toUpperCase()}
                    </span>
                    {u.is_blocked && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">BLOQUE</span>
                    )}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => togglePlan(u.id, u.plan ?? 'free')}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-amber-400 hover:border-amber-500/30 transition-all">
                        {(u.plan ?? 'free') === 'pro' ? 'Passer Free' : 'Passer Pro'}
                      </button>
                      <button onClick={() => toggleBlock(u.id, u.is_blocked)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                          u.is_blocked
                            ? 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20'
                            : 'bg-white/5 border-white/10 text-white/50 hover:text-red-400 hover:border-red-500/30'
                        }`}>
                        {u.is_blocked ? 'Reactiver' : 'Bloquer'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab: Matches */}
          {tab === 'matches' && (
            <div className="glass border border-white/7 rounded-2xl overflow-hidden animate-fade-up">
              <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <h2 className="font-bold text-white text-sm">Tous les matchs</h2>
                <span className="text-xs text-white/25">{stats.totalMatches} matchs</span>
              </div>
              <div className="divide-y divide-white/3">
                {matches.map((m: any) => (
                  <div key={m.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm">
                        {m.team_home} <span className="text-white/30">vs</span> {m.team_away}
                        {m.score_home != null && (
                          <span className="ml-2 text-xs text-amber-400">({m.score_home}–{m.score_away})</span>
                        )}
                      </p>
                      <p className="text-xs text-white/25 mt-0.5">
                        {m.user_email || m.user_id?.slice(0, 8)}
                        {m.competition ? ` · ${m.competition}` : ''}
                        {m.match_date ? ` · ${new Date(m.match_date).toLocaleDateString('fr-FR')}` : ''}
                      </p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border flex-shrink-0 ${STATUS_STYLE[m.status] ?? STATUS_STYLE.pending}`}>
                      {m.status}
                    </span>
                    {m.status === 'done' && (
                      <Link href={`/dashboard/match/${m.id}`}
                        className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex-shrink-0">
                        Voir →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
