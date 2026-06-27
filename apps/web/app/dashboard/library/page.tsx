'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Filter = 'all' | 'pending' | 'processing' | 'done'

const STATUS_LABEL: Record<string, string> = {
  pending:    'En attente',
  processing: 'Analyse en cours',
  done:       'Terminé',
  error:      'Erreur',
}

const STATUS_COLOR: Record<string, string> = {
  pending:    'bg-white/8 text-white/50',
  processing: 'bg-blue-500/15 text-blue-400',
  done:       'bg-green-500/15 text-green-400',
  error:      'bg-red-500/15 text-red-400',
}

const STATUS_DOT: Record<string, string> = {
  pending:    'bg-white/30',
  processing: 'bg-blue-400 animate-pulse',
  done:       'bg-green-400',
  error:      'bg-red-400',
}

export default function LibraryPage() {
  const supabase = createClient()
  const router   = useRouter()

  const [matches, setMatches]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<Filter>('all')
  const [launching, setLaunching] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }

    const { data } = await supabase
      .from('matches')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setMatches(data ?? [])
    setLoading(false)
  }

  async function launchAI(matchId: string) {
    setLaunching(matchId)
    try {
      // Met à jour le statut en "processing"
      await supabase.from('matches').update({ status: 'processing' }).eq('id', matchId)

      // Récupère les données du match pour le webhook
      const { data: match } = await supabase.from('matches').select('*').eq('id', matchId).single()

      // Appel du worker
      await fetch('https://xvpro-worker-production.up.railway.app/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'INSERT', table: 'matches',
          record: match,
          old_record: {},
        }),
      })

      // Refresh la liste
      await load()
      router.push(`/dashboard/match/${matchId}`)
    } catch (err) {
      console.error('Worker error:', err)
      setLaunching(null)
    }
  }

  const filtered = matches.filter(m => {
    if (filter === 'all') return true
    if (filter === 'pending') return m.status === 'pending'
    if (filter === 'processing') return m.status === 'processing'
    if (filter === 'done') return m.status === 'done'
    return true
  })

  const counts = {
    all:        matches.length,
    pending:    matches.filter(m => m.status === 'pending').length,
    processing: matches.filter(m => m.status === 'processing').length,
    done:       matches.filter(m => m.status === 'done').length,
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#07090f]">
      <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <>
      {/* Topbar */}
      <div className="sticky top-0 z-40 nav-blur px-8 h-14 flex items-center justify-between">
        <h1 className="font-bold text-white text-sm">Bibliothèque</h1>
        <Link
          href="/dashboard/upload"
          className="flex items-center gap-2 px-4 py-2 bg-amber-400 text-black text-xs font-bold rounded-lg hover:bg-amber-300 transition-all"
        >
          + Ajouter une vidéo
        </Link>
      </div>

      <div className="p-8 space-y-6">

        {/* Filtres */}
        <div className="flex gap-1 bg-white/4 border border-white/8 rounded-xl p-1 w-fit">
          {([
            { key: 'all',        label: 'Toutes' },
            { key: 'pending',    label: 'En attente' },
            { key: 'processing', label: 'En cours' },
            { key: 'done',       label: 'Terminées' },
          ] as { key: Filter; label: string }[]).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                filter === f.key
                  ? 'bg-white/10 text-white border border-white/12'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {f.label}
              {counts[f.key] > 0 && (
                <span className="bg-white/10 px-1.5 py-0.5 rounded-full text-[10px]">
                  {counts[f.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Grille de vidéos */}
        {filtered.length === 0 ? (
          <div className="glass border border-white/8 rounded-2xl py-24 text-center">
            <div className="text-5xl mb-4">🎬</div>
            <p className="font-bold text-white mb-2">Aucune vidéo</p>
            <p className="text-sm text-white/30 mb-8">
              {filter === 'all'
                ? 'Uploadez votre première vidéo pour commencer.'
                : 'Aucune vidéo dans cette catégorie.'}
            </p>
            {filter === 'all' && (
              <Link
                href="/dashboard/upload"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-400 text-black text-sm font-bold rounded-xl hover:bg-amber-300 transition-all"
              >
                + Ajouter une vidéo
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {filtered.map(m => (
              <VideoCard
                key={m.id}
                match={m}
                launching={launching === m.id}
                onLaunchAI={() => launchAI(m.id)}
              />
            ))}
          </div>
        )}

        {/* Upload CTA si vide */}
        {filtered.length > 0 && (
          <Link
            href="/dashboard/upload"
            className="flex items-center gap-4 p-5 glass border border-dashed border-white/10 rounded-2xl hover:border-amber-500/30 hover:bg-amber-500/3 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-xl group-hover:border-amber-500/30 transition-all">
              🎬
            </div>
            <div>
              <p className="font-semibold text-white/70 group-hover:text-white transition-colors text-sm">
                Ajouter une nouvelle vidéo
              </p>
              <p className="text-xs text-white/25">MP4, MOV · VEO, HUDL, WeTransfer...</p>
            </div>
            <span className="ml-auto text-white/20 group-hover:text-amber-400 text-lg transition-colors">→</span>
          </Link>
        )}
      </div>
    </>
  )
}

function VideoCard({
  match,
  launching,
  onLaunchAI,
}: {
  match: any
  launching: boolean
  onLaunchAI: () => void
}) {
  const status = match.status ?? 'pending'
  const date = match.match_date
    ? new Date(match.match_date).toLocaleDateString('fr-FR')
    : new Date(match.created_at).toLocaleDateString('fr-FR')

  return (
    <div className="glass border border-white/8 rounded-2xl overflow-hidden flex flex-col hover:border-white/15 transition-all">

      {/* Thumbnail placeholder */}
      <div className="h-40 bg-gradient-to-br from-white/3 to-white/[0.01] border-b border-white/5 flex items-center justify-center relative">
        <div className="text-5xl opacity-20">🏉</div>
        {/* Status badge */}
        <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLOR[status]}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
          {STATUS_LABEL[status] ?? 'En attente'}
        </div>
      </div>

      {/* Infos */}
      <div className="p-4 flex-1 flex flex-col">
        <p className="font-bold text-white text-sm mb-0.5">
          {match.team_home} <span className="text-white/30 font-normal">vs</span> {match.team_away}
        </p>
        <p className="text-xs text-white/30 mb-4">
          {match.competition ? `${match.competition} · ` : ''}{date}
        </p>

        {/* Actions selon le statut */}
        <div className="mt-auto space-y-2">

          {/* En attente → choix IA ou Manuel */}
          {status === 'pending' && (
            <>
              <button
                onClick={onLaunchAI}
                disabled={launching}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-400 text-black text-xs font-bold rounded-xl hover:bg-amber-300 transition-all disabled:opacity-50"
              >
                {launching ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Lancement...
                  </>
                ) : (
                  <>🤖 Analyser avec l'IA</>
                )}
              </button>
              <Link
                href={`/dashboard/match/${match.id}/manual`}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/6 border border-white/10 text-white/70 text-xs font-semibold rounded-xl hover:bg-white/10 hover:text-white transition-all"
              >
                ✏️ Analyser manuellement
              </Link>
            </>
          )}

          {/* En cours → progress */}
          {status === 'processing' && (
            <div className="flex items-center gap-3 py-2.5 px-3 bg-blue-500/8 border border-blue-500/15 rounded-xl">
              <div className="w-3.5 h-3.5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin flex-shrink-0" />
              <p className="text-xs text-blue-400 font-semibold">Analyse IA en cours...</p>
            </div>
          )}

          {/* Terminé → voir + annoter */}
          {status === 'done' && (
            <div className="flex gap-2">
              <Link
                href={`/dashboard/match/${match.id}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-amber-400 text-black text-xs font-bold rounded-xl hover:bg-amber-300 transition-all"
              >
                ⚡ Voir l'analyse
              </Link>
              <Link
                href={`/dashboard/match/${match.id}/manual`}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white/6 border border-white/10 text-white/60 text-xs font-semibold rounded-xl hover:bg-white/10 hover:text-white transition-all"
                title="Mode manuel"
              >
                ✏️
              </Link>
            </div>
          )}

          {/* Erreur → réessayer */}
          {status === 'error' && (
            <button
              onClick={onLaunchAI}
              disabled={launching}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/15 border border-red-500/20 text-red-400 text-xs font-semibold rounded-xl hover:bg-red-500/25 transition-all"
            >
              🔄 Réessayer l'analyse
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
