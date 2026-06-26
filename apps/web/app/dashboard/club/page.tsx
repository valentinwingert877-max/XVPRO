'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface ClubData {
  id: string
  name: string
  code: string
  owner_id: string
}

interface Member {
  id: string
  user_id: string
  role: string
  joined_at: string
  full_name?: string
  email?: string
}

interface Match {
  id: string
  title: string
  status: string
  created_at: string
  user_id: string
  coach_name?: string
}

interface ClubStats {
  totalMembers: number
  totalCoaches: number
  totalPlayers: number
  totalMatches: number
}

export default function ClubDashboard() {
  const supabase = createClient()
  const router   = useRouter()

  const [club, setClub]       = useState<ClubData | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [stats, setStats]     = useState<ClubStats>({ totalMembers: 0, totalCoaches: 0, totalPlayers: 0, totalMatches: 0 })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'coaches' | 'players' | 'matches'>('overview')
  const [copied, setCopied]   = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }

    // Verifier le role
    const role = user.user_metadata?.role
    if (role !== 'club' && role !== 'admin') {
      router.replace('/dashboard'); return
    }

    // Charger le club de l'utilisateur
    const { data: clubData } = await supabase
      .from('clubs')
      .select('*')
      .eq('owner_id', user.id)
      .single()

    if (!clubData) { setLoading(false); return }
    setClub(clubData)

    // Charger les membres
    const { data: membersData } = await supabase
      .from('club_members')
      .select('*')
      .eq('club_id', clubData.id)
      .order('joined_at', { ascending: false })

    const membersList = membersData ?? []

    // Enrichir avec les donnees auth (depuis user_roles view)
    const enriched: Member[] = []
    for (const m of membersList) {
      const { data: ur } = await supabase
        .from('user_roles')
        .select('full_name, email')
        .eq('id', m.user_id)
        .single()
      enriched.push({ ...m, full_name: ur?.full_name, email: ur?.email })
    }
    setMembers(enriched)

    // Charger les matchs des coachs du club
    const coachIds = enriched.filter(m => m.role === 'coach' || m.role === 'owner').map(m => m.user_id)
    if (coachIds.length > 0) {
      const { data: matchesData } = await supabase
        .from('matches')
        .select('*')
        .in('user_id', coachIds)
        .order('created_at', { ascending: false })
        .limit(50)

      const matchesEnriched = (matchesData ?? []).map(match => {
        const coach = enriched.find(m => m.user_id === match.user_id)
        return { ...match, coach_name: coach?.full_name ?? 'Coach' }
      })
      setMatches(matchesEnriched)
      setStats({
        totalMembers: enriched.length,
        totalCoaches: enriched.filter(m => m.role === 'coach').length,
        totalPlayers: enriched.filter(m => m.role === 'player').length,
        totalMatches: matchesData?.length ?? 0,
      })
    } else {
      setStats({ totalMembers: enriched.length, totalCoaches: 0, totalPlayers: 0, totalMatches: 0 })
    }

    setLoading(false)
  }

  function copyCode() {
    if (!club) return
    navigator.clipboard.writeText(club.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) return (
    <div className="min-h-screen bg-[#07090f] flex items-center justify-center">
      <div className="flex items-center gap-3 text-white/40">
        <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-amber-400 animate-spin" />
        Chargement du club...
      </div>
    </div>
  )

  if (!club) return (
    <div className="min-h-screen bg-[#07090f] flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-4">🏛️</div>
        <h2 className="text-xl font-bold text-white mb-2">Aucun club trouvé</h2>
        <p className="text-white/40 text-sm mb-6">Votre compte n&apos;est pas encore associé à un club.</p>
        <Link href="/register" className="inline-block px-6 py-3 bg-amber-400 text-gray-900 font-bold rounded-xl text-sm hover:bg-amber-300 transition-all">
          Créer un club
        </Link>
      </div>
    </div>
  )

  const coaches = members.filter(m => m.role === 'coach')
  const players = members.filter(m => m.role === 'player')

  return (
    <>
      <div className="p-8">
        {activeTab === 'overview' && (
          <div>
            <h1 className="text-2xl font-bold mb-1">Tableau de bord</h1>
            <p className="text-white/40 text-sm mb-8">{club.name} — vue globale</p>

            {/* Stats cards */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Membres', value: stats.totalMembers, icon: '👥', color: 'text-blue-400' },
                { label: 'Coachs', value: stats.totalCoaches, icon: '📋', color: 'text-purple-400' },
                { label: 'Joueurs', value: stats.totalPlayers, icon: '🏉', color: 'text-amber-400' },
                { label: 'Matchs', value: stats.totalMatches, icon: '📹', color: 'text-green-400' },
              ].map(s => (
                <div key={s.label} className="glass border border-white/10 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{s.icon}</span>
                    <span className={`text-3xl font-black ${s.color}`}>{s.value}</span>
                  </div>
                  <div className="text-sm text-white/40">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Code d'invitation */}
            <div className="glass border border-amber-400/20 bg-amber-400/5 rounded-2xl p-6 mb-8">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-amber-400 mb-1">🔑 Code d&apos;invitation club</h3>
                  <p className="text-sm text-white/40 mb-3">Partagez ce code avec vos coachs et joueurs lors de leur inscription</p>
                  <div className="flex items-center gap-3">
                    <code className="text-3xl font-black font-mono tracking-[0.3em] text-white">{club.code}</code>
                    <button onClick={copyCode}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                        copied ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/10 hover:bg-white/15 text-white'
                      }`}>
                      {copied ? '✓ Copié !' : 'Copier'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Matchs récents */}
            <div>
              <h2 className="text-lg font-bold mb-4">Matchs récents</h2>
              {matches.length === 0 ? (
                <div className="glass border border-white/10 rounded-2xl p-8 text-center text-white/30">
                  Aucun match pour l&apos;instant
                </div>
              ) : (
                <div className="space-y-2">
                  {matches.slice(0, 5).map(m => (
                    <Link key={m.id} href={`/dashboard/match/${m.id}`}
                      className="glass border border-white/10 rounded-xl px-5 py-3.5 flex items-center justify-between hover:border-white/20 transition-all group">
                      <div>
                        <div className="font-semibold text-white group-hover:text-amber-400 transition-colors">{m.title}</div>
                        <div className="text-xs text-white/30 mt-0.5">Coach : {m.coach_name}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          m.status === 'done' ? 'bg-green-500/15 text-green-400' :
                          m.status === 'processing' ? 'bg-amber-500/15 text-amber-400' :
                          'bg-white/10 text-white/40'
                        }`}>
                          {m.status === 'done' ? 'Analysé' : m.status === 'processing' ? 'En cours' : m.status}
                        </span>
                        <span className="text-white/20 text-sm">→</span>
                      </div>
                    </Link>
                  ))}
                  {matches.length > 5 && (
                    <button onClick={() => setActiveTab('matches')} className="w-full text-center text-sm text-white/30 hover:text-white/60 py-2 transition-colors">
                      Voir tous les matchs ({matches.length}) →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'coaches' && (
          <div>
            <h1 className="text-2xl font-bold mb-1">Coachs</h1>
            <p className="text-white/40 text-sm mb-6">{coaches.length} coach{coaches.length > 1 ? 's' : ''} dans le club</p>
            {coaches.length === 0 ? (
              <div className="glass border border-white/10 rounded-2xl p-12 text-center">
                <div className="text-4xl mb-4">📋</div>
                <p className="text-white/40">Aucun coach n&apos;a encore rejoint votre club.</p>
                <p className="text-white/20 text-sm mt-2">Partagez votre code club : <strong className="text-amber-400 font-mono">{club.code}</strong></p>
              </div>
            ) : (
              <div className="space-y-3">
                {coaches.map(c => (
                  <div key={c.id} className="glass border border-white/10 rounded-xl px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-sm">
                        {(c.full_name ?? c.email ?? '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold">{c.full_name ?? 'Nom inconnu'}</div>
                        <div className="text-xs text-white/30">{c.email}</div>
                      </div>
                    </div>
                    <div className="text-xs text-white/20">Rejoint le {new Date(c.joined_at).toLocaleDateString('fr-FR')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'players' && (
          <div>
            <h1 className="text-2xl font-bold mb-1">Joueurs</h1>
            <p className="text-white/40 text-sm mb-6">{players.length} joueur{players.length > 1 ? 's' : ''} dans le club</p>
            {players.length === 0 ? (
              <div className="glass border border-white/10 rounded-2xl p-12 text-center">
                <div className="text-4xl mb-4">🏉</div>
                <p className="text-white/40">Aucun joueur n&apos;a encore rejoint votre club.</p>
                <p className="text-white/20 text-sm mt-2">Les joueurs peuvent s&apos;inscrire avec le code : <strong className="text-amber-400 font-mono">{club.code}</strong></p>
              </div>
            ) : (
              <div className="space-y-3">
                {players.map(p => (
                  <div key={p.id} className="glass border border-white/10 rounded-xl px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm">
                        {(p.full_name ?? p.email ?? '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold">{p.full_name ?? 'Nom inconnu'}</div>
                        <div className="text-xs text-white/30">{p.email}</div>
                      </div>
                    </div>
                    <div className="text-xs text-white/20">Rejoint le {new Date(p.joined_at).toLocaleDateString('fr-FR')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'matches' && (
          <div>
            <h1 className="text-2xl font-bold mb-1">Tous les matchs</h1>
            <p className="text-white/40 text-sm mb-6">{matches.length} match{matches.length > 1 ? 's' : ''} analysés dans le club</p>
            {matches.length === 0 ? (
              <div className="glass border border-white/10 rounded-2xl p-12 text-center">
                <div className="text-4xl mb-4">📹</div>
                <p className="text-white/40">Aucun match pour l&apos;instant.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {matches.map(m => (
                  <Link key={m.id} href={`/dashboard/match/${m.id}`}
                    className="glass border border-white/10 rounded-xl px-5 py-4 flex items-center justify-between hover:border-white/20 transition-all group">
                    <div>
                      <div className="font-semibold text-white group-hover:text-amber-400 transition-colors">{m.title}</div>
                      <div className="text-xs text-white/30 mt-0.5">
                        {m.coach_name} &bull; {new Date(m.created_at).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        m.status === 'done' ? 'bg-green-500/15 text-green-400' :
                        m.status === 'processing' ? 'bg-amber-500/15 text-amber-400' :
                        'bg-white/10 text-white/40'
                      }`}>
                        {m.status === 'done' ? 'Analysé' : m.status === 'processing' ? 'En cours' : m.status}
                      </span>
                      <span className="text-white/20">→</span>
                    </div>
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
