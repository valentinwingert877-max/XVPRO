'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const ACTION_COLORS: Record<string, string> = {
  essai:          'bg-green-500/15 text-green-400 border-green-500/25',
  transformation: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  penalite:       'bg-amber-500/15 text-amber-400 border-amber-500/25',
  drop:           'bg-orange-500/15 text-orange-400 border-orange-500/25',
  melee:          'bg-blue-500/15 text-blue-400 border-blue-500/25',
  touche:         'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
  plaquage:       'bg-white/8 text-white/60 border-white/12',
  ruck:           'bg-purple-500/15 text-purple-400 border-purple-500/25',
  passe:          'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
  course:         'bg-teal-500/15 text-teal-400 border-teal-500/25',
  carton_jaune:   'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  carton_rouge:   'bg-red-500/15 text-red-400 border-red-500/25',
  mi_temps:       'bg-white/5 text-white/30 border-white/8',
  coup_sifflet:   'bg-white/5 text-white/30 border-white/8',
}

const ACTION_ICONS: Record<string, string> = {
  essai: '🟢', transformation: '✅', penalite: '🎯', drop: '🥊',
  melee: '🔵', touche: '🏳️', plaquage: '💥', ruck: '🔄',
  passe: '🤾', course: '🏃', carton_jaune: '🟨', carton_rouge: '🟥',
  mi_temps: '🔔', coup_sifflet: '🏁',
}

const ACTION_LABELS: Record<string, string> = {
  essai: 'Essai', transformation: 'Transfo', penalite: 'Pénalité',
  drop: 'Drop', melee: 'Mêlée', touche: 'Touche', plaquage: 'Plaquage',
  ruck: 'Ruck', passe: 'Passe', course: 'Course',
  carton_jaune: 'Carton Jaune', carton_rouge: 'Carton Rouge',
  mi_temps: 'Mi-temps', coup_sifflet: 'Fin du match',
}

const DEAD_BALL_ACTIONS = new Set(['melee', 'touche', 'mi_temps', 'coup_sifflet', 'penalite', 'carton_jaune', 'carton_rouge'])

const SUCCESS_CRITERIA: Record<string, { success: string; failure: string }> = {
  plaquage:  { success: 'Plaquage réussi',    failure: 'Plaquage raté' },
  ruck:      { success: 'Ruck gagné',          failure: 'Ruck perdu' },
  touche:    { success: 'Touche gagnée',       failure: 'Touche perdue' },
  melee:     { success: 'Mêlée dominée',       failure: 'Mêlée perdue' },
  passe:     { success: 'Passe réussie',       failure: 'Passe interceptée' },
  essai:     { success: 'Essai marqué',        failure: 'Essai refusé' },
  penalite:  { success: 'Pénalité passée',     failure: 'Pénalité ratée' },
}

const DEFAULT_QUALIFICATION: Record<string, 'positif' | 'neutre' | 'negatif'> = {
  essai: 'positif', transformation: 'positif', penalite: 'neutre',
  drop: 'positif', melee: 'neutre', touche: 'neutre', plaquage: 'neutre',
  ruck: 'neutre', passe: 'neutre', course: 'positif',
  carton_jaune: 'negatif', carton_rouge: 'negatif',
  mi_temps: 'neutre', coup_sifflet: 'neutre',
}

const QUALIFICATION_CONFIG = {
  positif: { label: '▲ Positif',  bg: 'bg-green-500/10',  text: 'text-green-400',  border: 'border-green-500/20', dot: 'bg-green-400', left: 'border-l-green-400' },
  neutre:  { label: '— Neutre',   bg: 'bg-white/5',       text: 'text-white/40',   border: 'border-white/10',     dot: 'bg-white/30',  left: 'border-l-white/10' },
  negatif: { label: '▼ Négatif',  bg: 'bg-red-500/10',    text: 'text-red-400',    border: 'border-red-500/20',   dot: 'bg-red-400',   left: 'border-l-red-400'  },
}

function getQualification(action: any): 'positif' | 'neutre' | 'negatif' {
  if (action.qualification) return action.qualification
  if (action.success === true)  return 'positif'
  if (action.success === false) return 'negatif'
  const conf = action.confidence ?? 0.5
  const def = DEFAULT_QUALIFICATION[action.action_type] ?? 'neutre'
  if (def === 'neutre') {
    if (conf >= 0.75) return 'positif'
    if (conf < 0.55)  return 'negatif'
    return 'neutre'
  }
  return def
}

const FILTERS = [
  { key: 'all',          label: 'Toutes' },
  { key: 'essai',        label: '🟢 Essais' },
  { key: 'penalite',     label: '🎯 Pénalités' },
  { key: 'melee',        label: '🔵 Mêlées' },
  { key: 'plaquage',     label: '💥 Plaquages' },
  { key: 'ruck',         label: '🔄 Rucks' },
  { key: 'carton_jaune', label: '🟨 Cartons' },
]

const QUAL_FILTERS = [
  { key: 'all',      label: 'Toutes' },
  { key: 'positif',  label: '▲ Positives' },
  { key: 'neutre',   label: '— Neutres' },
  { key: 'negatif',  label: '▼ Négatives' },
]

function StatBar({ label, valHome, valAway, total }: { label: string; valHome: number; valAway: number; total?: number }) {
  const t = total ?? ((valHome + valAway) || 1)
  const pctHome = Math.round((valHome / t) * 100)
  const pctAway = Math.round((valAway / t) * 100)
  return (
    <div className="mb-4">
      <div className="flex justify-between text-xs font-bold text-white/70 mb-1.5">
        <span>{valHome}</span>
        <span className="text-white/30 font-medium">{label}</span>
        <span>{valAway}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden flex bg-white/5">
        <div className="h-full bg-blue-500 rounded-l-full transition-all" style={{ width: `${pctHome}%` }} />
        <div className="h-full bg-amber-400 rounded-r-full transition-all" style={{ width: `${pctAway}%` }} />
      </div>
    </div>
  )
}

function SuccessBar({ label, icon, success, total }: { label: string; icon: string; success: number; total: number }) {
  const pct = total > 0 ? Math.round((success / total) * 100) : 0
  const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-400' : 'bg-red-500'
  const textColor = pct >= 80 ? 'text-green-400' : pct >= 60 ? 'text-amber-400' : 'text-red-400'
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      <span className="text-lg w-6 text-center flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="font-semibold text-white/70">{label}</span>
          <span className={`font-bold ${textColor}`}>{success}/{total} ({pct}%)</span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className={`text-xs font-black px-2 py-1 rounded-lg flex-shrink-0 ${
        pct >= 80 ? 'bg-green-500/10 text-green-400' :
        pct >= 60 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
      }`}>
        {pct >= 80 ? '✅' : pct >= 60 ? '⚠️' : '❌'}
      </span>
    </div>
  )
}

function EffectiveTimeCard({ actions, duration }: { actions: any[]; duration: number }) {
  const DEAD_BALL_DURATIONS: Record<string, number> = {
    melee: 45, touche: 30, penalite: 40, mi_temps: 900,
    carton_jaune: 120, carton_rouge: 60, coup_sifflet: 0,
  }

  let deadBallSec = 0
  for (const a of actions) {
    if (DEAD_BALL_ACTIONS.has(a.action_type)) {
      deadBallSec += DEAD_BALL_DURATIONS[a.action_type] ?? 20
    }
  }
  deadBallSec = Math.min(deadBallSec, duration * 0.6)

  const effectiveSec = Math.max(0, duration - deadBallSec)
  const effectivePct = Math.round((effectiveSec / duration) * 100)
  const fmtMin = (s: number) => `${Math.floor(s / 60)}'${String(Math.floor(s % 60)).padStart(2, '0')}`

  const SLOT = 600
  const slots = Math.ceil(duration / SLOT)
  const intensity = Array.from({ length: slots }, (_, i) => {
    const start = i * SLOT
    const end = start + SLOT
    return actions.filter(a =>
      a.timecode_sec >= start && a.timecode_sec < end && !DEAD_BALL_ACTIONS.has(a.action_type)
    ).length
  })
  const maxIntensity = Math.max(...intensity, 1)

  return (
    <div className="glass border border-white/7 rounded-2xl p-5">
      <h3 className="text-sm font-bold text-white mb-4">⏱️ Temps de jeu effectif</h3>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="text-center p-3 bg-blue-500/8 border border-blue-500/15 rounded-xl">
          <p className="text-2xl font-black text-blue-400">{fmtMin(effectiveSec)}</p>
          <p className="text-xs text-white/30 mt-0.5">Jeu effectif</p>
        </div>
        <div className="text-center p-3 bg-white/4 border border-white/8 rounded-xl">
          <p className="text-2xl font-black text-white/40">{fmtMin(deadBallSec)}</p>
          <p className="text-xs text-white/30 mt-0.5">Temps mort</p>
        </div>
        <div className={`text-center p-3 rounded-xl border ${
          effectivePct >= 40 ? 'bg-green-500/8 border-green-500/15' :
          effectivePct >= 30 ? 'bg-amber-500/8 border-amber-500/15' : 'bg-red-500/8 border-red-500/15'
        }`}>
          <p className={`text-2xl font-black ${
            effectivePct >= 40 ? 'text-green-400' : effectivePct >= 30 ? 'text-amber-400' : 'text-red-400'
          }`}>{effectivePct}%</p>
          <p className="text-xs text-white/30 mt-0.5">Ratio jeu</p>
        </div>
      </div>

      <div className="h-2 bg-white/5 rounded-full overflow-hidden flex mb-2">
        <div className="h-full bg-blue-500 rounded-l-full" style={{ width: `${effectivePct}%` }} />
        <div className="h-full bg-white/8 rounded-r-full" style={{ width: `${100 - effectivePct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-white/25 mb-5">
        <span>🟦 Jeu effectif</span>
        <span>⬜ Temps mort</span>
      </div>

      <p className="text-xs font-bold text-white/25 uppercase tracking-wide mb-3">Intensité par tranche (actions/10min)</p>
      <div className="flex items-end gap-1 h-16">
        {intensity.map((val, i) => {
          const pct = (val / maxIntensity) * 100
          const isHalfTime = i === Math.floor(slots / 2)
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full flex items-end justify-center" style={{ height: 48 }}>
                <div
                  className={`w-full rounded-t transition-all ${
                    isHalfTime ? 'bg-white/10' :
                    pct >= 70 ? 'bg-blue-500' : pct >= 40 ? 'bg-blue-500/50' : 'bg-blue-500/20'
                  }`}
                  style={{ height: `${Math.max(8, pct)}%` }}
                />
              </div>
              <span className="text-[9px] text-white/20">{i * 10}'</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SuccessFailureCard({ actions, match }: { actions: any[]; match: any }) {
  const actionsWithCriteria = Object.keys(SUCCESS_CRITERIA)
  const data = actionsWithCriteria.map(type => {
    const typeActions = actions.filter(a => a.action_type === type)
    if (typeActions.length === 0) return null
    const successes = typeActions.filter(a =>
      a.success === true || (a.success === undefined && (a.confidence ?? 0) >= 0.7)
    ).length
    return {
      type, label: ACTION_LABELS[type] ?? type,
      icon: ACTION_ICONS[type] ?? '⚡',
      success: successes, total: typeActions.length,
    }
  }).filter(Boolean) as { type: string; label: string; icon: string; success: number; total: number }[]

  if (data.length === 0) return (
    <div className="glass border border-white/7 rounded-2xl p-12 text-center">
      <p className="text-4xl mb-3">📊</p>
      <p className="text-sm text-white/30">Pas encore de données de succès/échec</p>
    </div>
  )

  const wins    = data.filter(d => d.total > 0 && (d.success / d.total) >= 0.75)
  const neutral = data.filter(d => d.total > 0 && (d.success / d.total) >= 0.5 && (d.success / d.total) < 0.75)
  const fails   = data.filter(d => d.total > 0 && (d.success / d.total) < 0.5)

  return (
    <div className="space-y-4">
      {wins.length > 0 && (
        <div className="glass border border-green-500/15 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-green-500/8 border-b border-green-500/10">
            <span className="text-green-400 font-bold text-sm">✅ Points forts</span>
            <span className="text-xs text-green-400/50">({wins.length} secteur{wins.length > 1 ? 's' : ''})</span>
          </div>
          <div className="px-4 py-2">
            {wins.map(d => <SuccessBar key={d.type} label={d.label} icon={d.icon} success={d.success} total={d.total} />)}
          </div>
        </div>
      )}
      {neutral.length > 0 && (
        <div className="glass border border-amber-500/15 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-amber-500/8 border-b border-amber-500/10">
            <span className="text-amber-400 font-bold text-sm">⚠️ À améliorer</span>
            <span className="text-xs text-amber-400/50">({neutral.length} secteur{neutral.length > 1 ? 's' : ''})</span>
          </div>
          <div className="px-4 py-2">
            {neutral.map(d => <SuccessBar key={d.type} label={d.label} icon={d.icon} success={d.success} total={d.total} />)}
          </div>
        </div>
      )}
      {fails.length > 0 && (
        <div className="glass border border-red-500/15 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-red-500/8 border-b border-red-500/10">
            <span className="text-red-400 font-bold text-sm">❌ Points faibles</span>
            <span className="text-xs text-red-400/50">({fails.length} secteur{fails.length > 1 ? 's' : ''})</span>
          </div>
          <div className="px-4 py-2">
            {fails.map(d => <SuccessBar key={d.type} label={d.label} icon={d.icon} success={d.success} total={d.total} />)}
          </div>
        </div>
      )}
      <div className="glass border border-white/7 rounded-2xl p-4">
        <p className="text-xs font-bold text-white/25 uppercase tracking-wide mb-3">Synthèse globale</p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-green-500/8 border border-green-500/15 rounded-xl p-3">
            <p className="text-xl font-black text-green-400">{wins.length}</p>
            <p className="text-xs text-white/30">Points forts</p>
          </div>
          <div className="bg-amber-500/8 border border-amber-500/15 rounded-xl p-3">
            <p className="text-xl font-black text-amber-400">{neutral.length}</p>
            <p className="text-xs text-white/30">À travailler</p>
          </div>
          <div className="bg-red-500/8 border border-red-500/15 rounded-xl p-3">
            <p className="text-xl font-black text-red-400">{fails.length}</p>
            <p className="text-xs text-white/30">Points faibles</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MatchPage() {
  const { id } = useParams() as { id: string }
  const supabase = createClient()
  const router = useRouter()

  const [match, setMatch]       = useState<any>(null)
  const [actions, setActions]   = useState<any[]>([])
  const [stats, setStats]       = useState<any>(null)
  const [report, setReport]     = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [qualFilter, setQualFilter] = useState('all')
  const [activeTab, setActiveTab] = useState<'timeline' | 'temps' | 'bilan' | 'stats' | 'rapport' | 'joueurs'>('timeline')
  const [userRole, setUserRole]             = useState<string>('coach')
  const [myTrackId, setMyTrackId]           = useState<number | null>(null)
  const [taggingSelf, setTaggingSelf]       = useState(false)
  const [playerStats, setPlayerStats]       = useState<any[]>([])
  const [playerProfiles, setPlayerProfiles] = useState<Record<number, any>>({})
  const [editingProfiles, setEditingProfiles] = useState<Record<number, { name: string; jersey: string; position: string }>>({})
  const [savingProfiles, setSavingProfiles] = useState(false)
  const [seekTime, setSeekTime]   = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [ytSrc, setYtSrc]         = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const role = user.user_metadata?.role ?? 'coach'
      setUserRole(role)

      const [{ data: m }, { data: a }, { data: st }, { data: r }] = await Promise.all([
        supabase.from('matches').select('*').eq('id', id).single(),
        supabase.from('match_actions').select('*').eq('match_id', id).order('timecode_sec'),
        supabase.from('match_stats').select('*').eq('match_id', id).single(),
        supabase.from('reports').select('*').eq('match_id', id).single(),
      ])
      const { data: ps } = await supabase.from('player_stats').select('*').eq('match_id', id).order('total_actions', { ascending: false })
      const { data: pp } = await supabase.from('player_profiles').select('*').eq('match_id', id)
      setPlayerStats(ps ?? [])
      // Si joueur, verifie s'il est deja tague dans ce match
      if ((user.user_metadata?.role ?? 'coach') === 'player') {
        const { data: myProfile } = await supabase
          .from('player_profiles')
          .select('track_id')
          .eq('match_id', id)
          .eq('user_id', user.id)
          .single()
        if (myProfile) setMyTrackId(myProfile.track_id)
      }
      const profileMap: Record<number, any> = {}
      for (const p of (pp ?? [])) profileMap[p.track_id] = p
      setPlayerProfiles(profileMap)
      const editMap: Record<number, { name: string; jersey: string; position: string }> = {}
      for (const p of (ps ?? [])) {
        editMap[p.track_id] = {
          name: profileMap[p.track_id]?.name ?? '',
          jersey: profileMap[p.track_id]?.jersey_number?.toString() ?? '',
          position: profileMap[p.track_id]?.position ?? '',
        }
      }
      setEditingProfiles(editMap)
      setMatch(m); setActions(a ?? []); setStats(st); setReport(r)
      setLoading(false)
    }
    load()

    const interval = setInterval(async () => {
      const { data: m } = await supabase.from('matches').select('status').eq('id', id).single()
      if (m?.status === 'done') { clearInterval(interval); load() }
    }, 5000)
    return () => clearInterval(interval)
  }, [id])

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}'${String(sec).padStart(2, '0')}`
  }

  const videoSrc = match.external_url || match.video_url || ''
  const isYouTube = videoSrc && (videoSrc.includes('youtube.com') || videoSrc.includes('youtu.be'))
  const isVimeo   = videoSrc && videoSrc.includes('vimeo.com')
  const isDirect  = videoSrc && !isYouTube && !isVimeo

  function getYouTubeId(url: string) {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
    return m?.[1] ?? ''
  }
  function getVimeoId(url: string) {
    const m = url.match(/vimeo\.com\/(\d+)/)
    return m?.[1] ?? ''
  }

  function seekTo(seconds: number) {
    if (isDirect && videoRef.current) {
      videoRef.current.currentTime = seconds
      videoRef.current.play()
      videoRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else if (isYouTube) {
      const vid = getYouTubeId(videoSrc)
      setYtSrc(`https://www.youtube.com/embed/${vid}?start=${Math.floor(seconds)}&autoplay=1`)
      document.getElementById('xvpro-player')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else if (isVimeo) {
      const vid = getVimeoId(videoSrc)
      setYtSrc(`https://player.vimeo.com/video/${vid}#t=${Math.floor(seconds)}s`)
      document.getElementById('xvpro-player')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  async function tagAsSelf(trackId: number) {
    setTaggingSelf(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('player_profiles').upsert({
      match_id: id,
      track_id: trackId,
      name: user.user_metadata?.full_name ?? 'Moi',
      user_id: user.id,
    }, { onConflict: 'match_id,track_id' })
    setMyTrackId(trackId)
    setTaggingSelf(false)
  }

  async function savePlayerProfiles() {
    setSavingProfiles(true)
    const rows = Object.entries(editingProfiles)
      .map(([tid, v]) => ({
        match_id: id,
        track_id: parseInt(tid),
        name: v.name || null,
        jersey_number: v.jersey ? parseInt(v.jersey) : null,
        position: v.position || null,
      }))
      .filter(r => r.name)
    for (const row of rows) {
      await supabase.from('player_profiles').upsert(row, { onConflict: 'match_id,track_id' })
    }
    setSavingProfiles(false)
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#07090f]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-white/30">Chargement...</p>
      </div>
    </div>
  )

  if (!match) return (
    <div className="flex min-h-screen items-center justify-center bg-[#07090f]">
      <p className="text-red-400">Match introuvable.</p>
    </div>
  )

  const duration = match.duration_sec ?? 4800
  const filtered = actions
    .filter(a => filter === 'all' || a.action_type === filter)
    .filter(a => qualFilter === 'all' || getQualification(a) === qualFilter)
  const actionCounts = actions.reduce((acc: any, a: any) => {
    acc[a.action_type] = (acc[a.action_type] ?? 0) + 1; return acc
  }, {})
  const isProcessing = match.status === 'processing' || match.status === 'pending'
  const essaisHome = actions.filter(a => a.action_type === 'essai' && a.team === 'home').length
  const essaisAway = actions.filter(a => a.action_type === 'essai' && a.team === 'away').length

  return (
    <>
        {/* Topbar */}
        <div className="sticky top-0 z-40 nav-blur px-8 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="text-white/30 hover:text-white text-sm transition-colors">← Retour</Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-white text-sm truncate">
              {match.team_home} <span className="text-white/30">vs</span> {match.team_away}
              {match.score_home != null && (
                <span className="ml-3 text-blue-400">{match.score_home} – {match.score_away}</span>
              )}
            </h1>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
            match.status === 'done'  ? 'badge-done' :
            match.status === 'error' ? 'badge-error' : 'badge-processing'
          }`}>
            {match.status === 'done' ? '✓ Analysé' : match.status === 'error' ? '✕ Erreur' : '⚡ En cours...'}
          </span>
          {match.status === 'done' && (
            <button
              onClick={() => window.open(`/dashboard/match/${id}/print`, '_blank')}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white/50 hover:text-white border border-white/10 hover:border-white/25 rounded-lg transition-all flex-shrink-0">
              ↓ Exporter PDF
            </button>
          )}
        </div>

        <div className="p-8 max-w-5xl">

          {/* Processing banner */}
          {isProcessing && (
            <div className="flex items-center gap-3 bg-amber-500/8 border border-amber-500/15 rounded-2xl p-4 mb-6 animate-fade-up">
              <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-400">Analyse IA en cours</p>
                <p className="text-xs text-amber-400/60">La page se met à jour automatiquement.</p>
              </div>
            </div>
          )}

          {/* Score cards */}
          <div className="grid grid-cols-3 gap-4 mb-6 animate-fade-up">
            <div className="glass border border-white/7 rounded-2xl p-5 text-center">
              <p className="text-xs text-white/30 font-semibold uppercase tracking-wide mb-1">{match.team_home}</p>
              <p className="text-5xl font-black text-blue-400">{match.score_home ?? '—'}</p>
              <p className="text-xs text-white/25 mt-1">{essaisHome} essai{essaisHome !== 1 ? 's' : ''}</p>
            </div>
            <div className="glass border border-white/7 rounded-2xl p-5 text-center">
              <p className="text-xs text-white/30 font-semibold uppercase tracking-wide mb-1">ACTIONS</p>
              <p className="text-5xl font-black text-white">{actions.length}</p>
              <p className="text-xs text-white/25 mt-1">détectées</p>
            </div>
            <div className="glass border border-white/7 rounded-2xl p-5 text-center">
              <p className="text-xs text-white/30 font-semibold uppercase tracking-wide mb-1">{match.team_away}</p>
              <p className="text-5xl font-black text-amber-400">{match.score_away ?? '—'}</p>
              <p className="text-xs text-white/25 mt-1">{essaisAway} essai{essaisAway !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Timeline visuelle */}
          {actions.length > 0 && (
            <div className="glass border border-white/7 rounded-2xl p-5 mb-6 animate-fade-up">
              <p className="text-xs font-bold text-white/25 uppercase tracking-wide mb-4">Timeline du match</p>
              <div className="relative h-8">
                <div className="absolute inset-y-3 left-0 right-0 bg-white/5 rounded-full" />
                {actions.map((a: any, i: number) => (
                  <div key={i}
                    onClick={() => seekTo(a.timecode_sec)}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-sm cursor-pointer hover:scale-125 transition-transform z-10"
                    style={{ left: `${Math.min(98, Math.max(2, (a.timecode_sec / duration) * 100))}%` }}
                    title={`${ACTION_ICONS[a.action_type] ?? '⚡'} ${ACTION_LABELS[a.action_type] ?? a.action_type} — ${fmt(a.timecode_sec)}`}>
                    {ACTION_ICONS[a.action_type] ?? '⚡'}
                  </div>
                ))}
                <div className="absolute -bottom-4 left-0 text-xs text-white/20">0'</div>
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/20">40'</div>
                <div className="absolute -bottom-4 right-0 text-xs text-white/20">80'</div>
              </div>
              <div className="mt-6" />
            </div>
          )}

          {/* Video Player */}
          {videoSrc && (
            <div id="xvpro-player" className="glass border border-white/7 rounded-2xl overflow-hidden mb-6 animate-fade-up">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5">
                <span className="text-sm">🎬</span>
                <p className="text-xs font-bold text-white/40 uppercase tracking-wide">Lecteur video</p>
                <span className="text-xs text-white/20 ml-auto">Cliquez sur une action pour sauter au bon moment</span>
              </div>
              <div className="relative bg-black" style={{aspectRatio: '16/9'}}>
                {isDirect && (
                  <video ref={videoRef} src={videoSrc} controls
                    className="w-full h-full object-contain"
                    controlsList="nodownload" />
                )}
                {(isYouTube || isVimeo) && (
                  <iframe ref={iframeRef}
                    src={ytSrc || (isYouTube
                      ? `https://www.youtube.com/embed/${getYouTubeId(videoSrc)}?enablejsapi=1`
                      : `https://player.vimeo.com/video/${getVimeoId(videoSrc)}`)}
                    className="w-full h-full" frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen />
                )}
              </div>
            </div>
          )}

          {/* Onglets */}
          <div className="flex gap-1 bg-white/4 border border-white/8 rounded-2xl p-1 mb-6 overflow-x-auto">
            {([
              ['timeline', '📋 Actions'],
              ['temps',    '⏱️ Temps'],
              ['bilan',    '✅ Bilan'],
              ['stats',    '📊 Stats'],
              ['rapport',  '🤖 IA'],
              ['joueurs',  '👤 Joueurs'],
            ] as const).map(([k, l]) => (
              <button key={k} onClick={() => setActiveTab(k)}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap px-2
                  ${activeTab === k
                    ? 'bg-white/10 text-white border border-white/12'
                    : 'text-white/30 hover:text-white/60'}`}>
                {l}
              </button>
            ))}
          </div>

          {/* Onglet Timeline */}
          {activeTab === 'timeline' && (
            <div className="glass border border-white/7 rounded-2xl overflow-hidden animate-fade-up">
              {/* Filtres par type */}
              <div className="px-4 pt-3 pb-2 border-b border-white/5 flex gap-2 flex-wrap">
                {FILTERS.map(f => (
                  <button key={f.key} onClick={() => setFilter(f.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border
                      ${filter === f.key
                        ? 'bg-blue-500/15 text-blue-400 border-blue-500/25'
                        : 'border-white/8 text-white/30 hover:text-white/60 hover:border-white/15'}`}>
                    {f.label}{f.key !== 'all' && actionCounts[f.key] ? ` (${actionCounts[f.key]})` : ''}
                  </button>
                ))}
              </div>
              {/* Filtres par qualification */}
              <div className="px-4 py-2 border-b border-white/5 flex gap-2 flex-wrap items-center">
                <span className="text-xs text-white/25 font-semibold mr-1">Qualification :</span>
                {QUAL_FILTERS.map(f => {
                  const cfg = f.key !== 'all' ? QUALIFICATION_CONFIG[f.key as keyof typeof QUALIFICATION_CONFIG] : null
                  return (
                    <button key={f.key} onClick={() => setQualFilter(f.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border
                        ${qualFilter === f.key
                          ? cfg ? `${cfg.bg} ${cfg.text} ${cfg.border}` : 'bg-white/10 text-white border-white/15'
                          : 'border-white/8 text-white/30 hover:text-white/60 hover:border-white/15'
                        }`}>
                      {f.label}
                    </button>
                  )
                })}
                {qualFilter !== 'all' && (
                  <span className="text-xs text-white/25 ml-1">{filtered.length} action{filtered.length !== 1 ? 's' : ''}</span>
                )}
              </div>

              <div className="divide-y divide-white/4">
                {filtered.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-4xl mb-3">🏉</p>
                    <p className="text-sm font-medium text-white/30">
                      {actions.length === 0
                        ? (isProcessing ? 'Analyse en cours...' : 'Aucune action détectée')
                        : 'Aucune action dans cette catégorie'}
                    </p>
                  </div>
                ) : filtered.map((a: any) => {
                  const qual = getQualification(a)
                  const qualCfg = QUALIFICATION_CONFIG[qual]
                  return (
                    <div key={a.id} className={`flex items-start gap-3 px-4 py-3 hover:bg-white/3 transition-colors border-l-2 ${qualCfg.left}`}>
                      <button onClick={() => seekTo(a.timecode_sec)}
                        className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/15 px-2 py-1.5 rounded-lg min-w-[46px] text-center flex-shrink-0 hover:bg-blue-500/20 hover:scale-105 transition-all"
                        title="Voir dans le lecteur video">
                        ▶ {fmt(a.timecode_sec)}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${ACTION_COLORS[a.action_type] ?? 'bg-white/8 text-white/50 border-white/10'}`}>
                            {ACTION_ICONS[a.action_type] ?? '⚡'} {ACTION_LABELS[a.action_type] ?? a.action_type}
                          </span>
                          {a.team && a.team !== 'unknown' && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              a.team === 'home' || a.team === 'a'
                                ? 'text-blue-400 bg-blue-500/10'
                                : 'text-amber-400 bg-amber-500/10'
                            }`}>
                              {a.team === 'home' || a.team === 'a' ? match.team_home : match.team_away}
                            </span>
                          )}
                        </div>
                        {a.description && <p className="text-xs text-white/30 leading-relaxed mt-0.5">{a.description}</p>}
                      </div>
                      <div className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-bold ${qualCfg.bg} ${qualCfg.text} ${qualCfg.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${qualCfg.dot}`} />
                        {qualCfg.label}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Onglet Temps de jeu */}
          {activeTab === 'temps' && (
            <div className="animate-fade-up">
              <EffectiveTimeCard actions={actions} duration={duration} />
            </div>
          )}

          {/* Onglet Bilan */}
          {activeTab === 'bilan' && (
            <div className="animate-fade-up">
              <SuccessFailureCard actions={actions} match={match} />
            </div>
          )}

          {/* Onglet Stats */}
          {activeTab === 'stats' && (
            <div className="space-y-4 animate-fade-up">
              {stats ? (
                <>
                  {/* Légende */}
                  <div className="flex gap-6 justify-center py-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-sm font-bold text-white/70">{match.team_home}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-400" />
                      <span className="text-sm font-bold text-white/70">{match.team_away}</span>
                    </div>
                  </div>

                  {/* Possession & Territoire */}
                  <div className="glass border border-white/7 rounded-2xl p-5">
                    <h3 className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4">Possession & Territoire</h3>
                    <StatBar label="Possession %" valHome={stats.possession_home ?? 50} valAway={stats.possession_away ?? 50} total={100} />
                    <StatBar label="Territoire %" valHome={stats.territory_home ?? 50} valAway={stats.territory_away ?? 50} total={100} />
                    <StatBar label="Metres gagnes" valHome={stats.meters_gained_home ?? 0} valAway={stats.meters_gained_away ?? 0} />
                    <StatBar label="Passes" valHome={stats.passes_home ?? 0} valAway={stats.passes_away ?? 0} />
                    <StatBar label="Ballons portes" valHome={stats.carries_home ?? 0} valAway={stats.carries_away ?? 0} />
                  </div>

                  {/* Phases de jeu */}
                  <div className="glass border border-white/7 rounded-2xl p-5">
                    <h3 className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4">Phases de jeu</h3>
                    <div className="mb-3 pb-3 border-b border-white/5">
                      <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2">Plaquages</p>
                      <StatBar label="Total" valHome={stats.tackles_home ?? 0} valAway={stats.tackles_away ?? 0} />
                      <StatBar label="Reussis" valHome={stats.tackles_success_home ?? 0} valAway={stats.tackles_success_away ?? 0} />
                      <StatBar label="Rates" valHome={stats.tackles_missed_home ?? 0} valAway={stats.tackles_missed_away ?? 0} />
                    </div>
                    <div className="mb-3 pb-3 border-b border-white/5">
                      <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2">Rucks</p>
                      <StatBar label="Gagnes" valHome={stats.rucks_won_home ?? 0} valAway={stats.rucks_won_away ?? 0} />
                      <StatBar label="Perdus" valHome={stats.rucks_lost_home ?? 0} valAway={stats.rucks_lost_away ?? 0} />
                    </div>
                    <div className="mb-3 pb-3 border-b border-white/5">
                      <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2">Touches</p>
                      <StatBar label="Gagnees" valHome={stats.lineouts_won_home ?? 0} valAway={stats.lineouts_won_away ?? 0} />
                      <StatBar label="Perdues" valHome={stats.lineouts_lost_home ?? 0} valAway={stats.lineouts_lost_away ?? 0} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2">Melees</p>
                      <StatBar label="Gagnees" valHome={stats.scrums_won_home ?? 0} valAway={stats.scrums_won_away ?? 0} />
                      <StatBar label="Perdues" valHome={stats.scrums_lost_home ?? 0} valAway={stats.scrums_lost_away ?? 0} />
                    </div>
                  </div>

                  {/* Discipline */}
                  <div className="glass border border-white/7 rounded-2xl p-5">
                    <StatBar label="Penalites concedees" valHome={stats.penalties_home ?? 0} valAway={stats.penalties_away ?? 0} />
                    <StatBar label="En-avants" valHome={stats.knock_ons_home ?? 0} valAway={stats.knock_ons_away ?? 0} />
                    <StatBar label="Cartons jaunes" valHome={stats.yellow_cards_home ?? 0} valAway={stats.yellow_cards_away ?? 0} />
                    <StatBar label="Cartons rouges" valHome={stats.red_cards_home ?? 0} valAway={stats.red_cards_away ?? 0} />
                    {stats.penalties_breakdown && Object.keys(stats.penalties_breakdown).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-white/5">
                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-3">Types de penalites</p>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(stats.penalties_breakdown).map(([type, count]: any) => (
                            <div key={type} className="flex items-center justify-between px-3 py-2 bg-red-500/5 border border-red-500/10 rounded-xl">
                              <span className="text-xs text-white/40 capitalize">{type}</span>
                              <span className="text-xs font-bold text-red-400">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Scoring */}
                  <div className="glass border border-white/7 rounded-2xl p-5">
                    <h3 className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4">Marque</h3>
                    <StatBar label="Essais" valHome={stats.tries_home ?? 0} valAway={stats.tries_away ?? 0} />
                    <StatBar label="Transformations" valHome={stats.conversions_home ?? 0} valAway={stats.conversions_away ?? 0} />
                  </div>

                  {/* Par mi-temps */}
                  {(stats.stats_first_half || stats.stats_second_half) && (
                    <div className="glass border border-white/7 rounded-2xl p-5">
                      <h3 className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4">Par mi-temps</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: '1ere mi-temps', data: stats.stats_first_half },
                          { label: '2eme mi-temps', data: stats.stats_second_half },
                        ].map(({ label, data }) => data && (
                          <div key={label} className="bg-white/3 border border-white/6 rounded-xl p-4">
                            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">{label}</p>
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs">
                                <span className="text-white/40">Actions</span>
                                <span className="font-bold text-white">{data.total_actions}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-white/40">Positives</span>
                                <span className="font-bold text-green-400">{data.positives}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-white/40">Negatives</span>
                                <span className="font-bold text-red-400">{data.negatives}</span>
                              </div>
                              <div className="flex justify-between text-xs border-t border-white/5 pt-2 mt-2">
                                <span className="text-white/40">Taux reussite</span>
                                <span className={data.success_rate >= 60 ? 'font-bold text-green-400' : data.success_rate >= 45 ? 'font-bold text-amber-400' : 'font-bold text-red-400'}>
                                  {data.success_rate}%
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="glass border border-white/7 rounded-2xl p-12 text-center">
                  <p className="text-4xl mb-3">📊</p>
                  <p className="text-sm text-white/30">{isProcessing ? 'Stats en cours...' : 'Aucune statistique disponible'}</p>
                </div>
              )}
            </div>
          )}

          {/* Onglet Rapport IA */}
          {activeTab === 'rapport' && (
            <div className="glass border border-white/7 rounded-2xl overflow-hidden animate-fade-up">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                <h2 className="font-bold text-white">Rapport IA</h2>
                <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full">Genere par Claude</span>
              </div>
              {report?.content ? (
                <div className="p-5 text-sm text-white/60 leading-relaxed whitespace-pre-wrap">{report.content}</div>
              ) : (
                <div className="p-16 text-center">
                  <p className="text-4xl mb-3">🤖</p>
                  <p className="font-semibold text-white/40 mb-1">
                    {isProcessing ? 'Rapport en cours de generation...' : 'Rapport non disponible'}
                  </p>
                  <p className="text-xs text-white/20">
                    {isProcessing ? "Disponible a la fin de l'analyse" : 'Aucun rapport genere pour ce match'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Onglet Joueurs */}
          {activeTab === 'joueurs' && (
            <div className="space-y-4 animate-fade-up">

              {/* ── VUE JOUEUR : C'est moi ── */}
              {userRole === 'player' && (
                <>
                  {myTrackId !== null ? (
                    <div className="glass border border-green-500/20 bg-green-500/5 rounded-2xl p-6 text-center">
                      <p className="text-3xl mb-2">✅</p>
                      <p className="font-bold text-green-400 mb-1">Tu es le Joueur #{myTrackId}</p>
                      <p className="text-xs text-white/30 mb-4">Tes stats sont disponibles sur ton dashboard</p>
                      <a href="/dashboard/player"
                        className="inline-flex items-center gap-2 px-5 py-2 bg-amber-400 text-gray-900 text-xs font-black rounded-xl hover:bg-amber-300 transition-all">
                        Voir mes stats →
                      </a>
                    </div>
                  ) : (
                    <>
                      <div className="text-center mb-4">
                        <h2 className="font-bold text-white mb-1">Qui es-tu dans ce match ?</h2>
                        <p className="text-xs text-white/30">Clique sur &ldquo;C&apos;est moi&rdquo; pour lier ce match a ton profil</p>
                      </div>
                      {playerStats.length === 0 ? (
                        <div className="glass border border-white/7 rounded-2xl p-12 text-center">
                          <p className="text-4xl mb-3">👤</p>
                          <p className="text-sm text-white/30">{match.status !== 'done' ? 'Analyse en cours...' : 'Aucun joueur tracke'}</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3">
                          {playerStats.map((ps: any) => (
                            <div key={ps.track_id} className="glass border border-white/7 rounded-2xl p-4 flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-white/30 flex-shrink-0">
                                {ps.track_id}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white/70 mb-1">Joueur #{ps.track_id}</p>
                                <div className="flex gap-2 flex-wrap">
                                  {ps.tackles > 0 && <span className="text-xs text-white/40">💥 {ps.tackles}</span>}
                                  {ps.rucks > 0    && <span className="text-xs text-white/40">🔄 {ps.rucks}</span>}
                                  {ps.carries > 0  && <span className="text-xs text-white/40">🏃 {ps.carries}</span>}
                                  {ps.try_involvement > 0 && <span className="text-xs text-green-400">🟢 {ps.try_involvement}</span>}
                                </div>
                              </div>
                              <button
                                onClick={() => tagAsSelf(ps.track_id)}
                                disabled={taggingSelf}
                                className="flex-shrink-0 px-4 py-2 bg-amber-400 text-gray-900 text-xs font-black rounded-xl hover:bg-amber-300 transition-all disabled:opacity-50">
                                {taggingSelf ? '...' : "C'est moi"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* ── VUE COACH : mapping complet ── */}
              {userRole !== 'player' && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h2 className="font-bold text-white text-sm">Joueurs detectes</h2>
                      <p className="text-xs text-white/30 mt-0.5">Assignez un nom a chaque joueur tracke par l&apos;IA</p>
                    </div>
                    {playerStats.length > 0 && (
                      <button onClick={savePlayerProfiles} disabled={savingProfiles}
                        className="px-4 py-2 bg-amber-400 text-gray-900 text-xs font-black rounded-xl hover:bg-amber-300 transition-all disabled:opacity-50">
                        {savingProfiles ? '...' : '✓ Sauvegarder'}
                      </button>
                    )}
                  </div>
                  {playerStats.length === 0 ? (
                    <div className="glass border border-white/7 rounded-2xl p-12 text-center">
                      <p className="text-4xl mb-3">👤</p>
                      <p className="text-sm text-white/30">
                        {match.status !== 'done' ? 'Analyse en cours...' : "Aucun joueur tracke"}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {playerStats.map((ps: any) => {
                        const edit = editingProfiles[ps.track_id] ?? { name: '', jersey: '', position: '' }
                        const hasName = !!edit.name
                        return (
                          <div key={ps.track_id}
                            className={`glass border rounded-2xl p-5 transition-all ${hasName ? 'border-amber-400/20 bg-amber-400/3' : 'border-white/7'}`}>
                            <div className="flex items-start gap-4">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black flex-shrink-0 ${
                                hasName ? 'bg-amber-400/15 text-amber-400 border border-amber-400/25' : 'bg-white/5 text-white/30 border border-white/10'
                              }`}>
                                {hasName ? edit.name.charAt(0).toUpperCase() : ps.track_id}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-xs font-bold text-white/30 uppercase tracking-widest">Joueur #{ps.track_id}</span>
                                  <span className="text-xs text-white/20">·</span>
                                  <span className="text-xs text-white/30">{ps.total_actions} actions</span>
                                  {hasName && <span className="ml-auto text-xs font-bold text-amber-400">✓ Identifie</span>}
                                </div>
                                <div className="flex gap-3 mb-3 flex-wrap">
                                  {ps.tackles > 0 && <span className="text-xs px-2 py-0.5 bg-white/5 border border-white/8 rounded-full text-white/50">💥 {ps.tackles}</span>}
                                  {ps.rucks > 0    && <span className="text-xs px-2 py-0.5 bg-white/5 border border-white/8 rounded-full text-white/50">🔄 {ps.rucks}</span>}
                                  {ps.carries > 0  && <span className="text-xs px-2 py-0.5 bg-white/5 border border-white/8 rounded-full text-white/50">🏃 {ps.carries}</span>}
                                  {ps.try_involvement > 0 && <span className="text-xs px-2 py-0.5 bg-green-500/10 border border-green-500/15 rounded-full text-green-400">🟢 {ps.try_involvement}</span>}
                                  {ps.penalties > 0 && <span className="text-xs px-2 py-0.5 bg-red-500/10 border border-red-500/15 rounded-full text-red-400">⚠️ {ps.penalties}</span>}
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <input type="text" placeholder="Nom complet" value={edit.name}
                                    onChange={e => setEditingProfiles(prev => ({ ...prev, [ps.track_id]: { ...edit, name: e.target.value } }))}
                                    className="col-span-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-amber-400/40 transition-colors" />
                                  <input type="number" placeholder="N° maillot" value={edit.jersey}
                                    onChange={e => setEditingProfiles(prev => ({ ...prev, [ps.track_id]: { ...edit, jersey: e.target.value } }))}
                                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-amber-400/40 transition-colors" />
                                  <select value={edit.position}
                                    onChange={e => setEditingProfiles(prev => ({ ...prev, [ps.track_id]: { ...edit, position: e.target.value } }))}
                                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/60 focus:outline-none focus:border-amber-400/40 transition-colors">
                                    <option value="">Poste...</option>
                                    <option value="pilier">Pilier</option>
                                    <option value="talonneur">Talonneur</option>
                                    <option value="troisieme_ligne">3e ligne</option>
                                    <option value="deuxieme_ligne">2e ligne</option>
                                    <option value="demi_melee">Demi de melee</option>
                                    <option value="demi_ouverture">Demi ouverture</option>
                                    <option value="centre">Centre</option>
                                    <option value="ailier">Ailier</option>
                                    <option value="arriere">Arriere</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

        </div>
    </>
  )
}
