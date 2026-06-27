'use client'
export const dynamic = 'force-dynamic'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type InputMode = 'file' | 'url'

const URL_PLATFORMS = [
  { name: 'VEO',         icon: '🎥', hint: 'veo.co/matches/...',                        color: 'text-blue-400'   },
  { name: 'HUDL',        icon: '📹', hint: 'hudl.com/video/...',                         color: 'text-orange-400' },
  { name: 'WeTransfer',  icon: '📦', hint: 'we.tl/... ou wetransfer.com/downloads/...',  color: 'text-teal-400'   },
  { name: 'Dropbox',     icon: '📂', hint: 'dropbox.com/s/...',                          color: 'text-blue-300'   },
  { name: 'Google Drive',icon: '☁️', hint: 'drive.google.com/file/d/...',                color: 'text-green-400'  },
  { name: 'Lien direct', icon: '🔗', hint: 'URL directe vers un .mp4 / .mov',            color: 'text-white/40'   },
]

function detectPlatform(url: string) {
  if (url.includes('veo.co') || url.includes('veo.com'))       return URL_PLATFORMS[0]
  if (url.includes('hudl.com'))                                 return URL_PLATFORMS[1]
  if (url.includes('wetransfer.com') || url.includes('we.tl')) return URL_PLATFORMS[2]
  if (url.includes('dropbox.com'))                              return URL_PLATFORMS[3]
  if (url.includes('drive.google.com'))                         return URL_PLATFORMS[4]
  if (url.match(/\.(mp4|mov|avi|mkv|webm)(\?|$)/i))          return URL_PLATFORMS[5]
  return null
}

export default function UploadPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode]           = useState<InputMode>('file')
  const [file, setFile]           = useState<File | null>(null)
  const [videoUrl, setVideoUrl]   = useState('')
  const [dragging, setDragging]   = useState(false)
  const [form, setForm]           = useState({ teamHome: '', teamAway: '', competition: '', matchDate: '' })
  const [stage, setStage]         = useState<'form' | 'uploading' | 'done' | 'error'>('form')
  const [progress, setProgress]   = useState(0)
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError]         = useState('')

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith('video/')) setFile(f)
  }, [])

  const canSubmit =
    form.teamHome && form.teamAway &&
    (mode === 'file' ? !!file : videoUrl.trim().length > 10)

  const detected = mode === 'url' && videoUrl ? detectPlatform(videoUrl) : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setStage('uploading')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    setProgress(5); setStatusMsg('Creation du match...')
    const { data: match, error: matchErr } = await supabase
      .from('matches').insert({
        user_id: user.id,
        team_home: form.teamHome,
        team_away: form.teamAway,
        competition: form.competition,
        match_date: form.matchDate || null,
        status: 'pending',
        external_url: mode === 'url' ? videoUrl.trim() : null,
      }).select().single()

    if (matchErr || !match) { setError(matchErr?.message ?? 'Erreur creation match'); setStage('error'); return }

    if (mode === 'file' && file) {
      setProgress(15); setStatusMsg('Upload de la video...')
      const path = `${user.id}/${match.id}/${file.name}`
      const { error: uploadErr } = await supabase.storage
        .from('match-videos').upload(path, file, { cacheControl: '3600', upsert: false })
      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from('match-videos').getPublicUrl(path)
        await supabase.from('matches').update({ video_url: publicUrl }).eq('id', match.id)
      }
    }

    setProgress(30); setStatusMsg('Vidéo ajoutée à la bibliothèque !')
    setStage('done')
    setTimeout(() => router.push('/dashboard/library'), 1500)
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  if (stage === 'done') return (
    <div className="flex min-h-screen items-center justify-center bg-[#07090f]">
      <div className="text-center animate-fade-up">
        <div className="w-20 h-20 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center text-4xl mx-auto mb-5">✅</div>
        <p className="text-xl font-bold text-white mb-2">Vidéo ajoutée !</p>
        <p className="text-white/40">Redirection vers la bibliothèque...</p>
      </div>
    </div>
  )

  return (
    <>
        <div className="sticky top-0 z-40 nav-blur px-8 h-14 flex items-center">
          <h1 className="font-bold text-white text-sm">Analyser un match</h1>
        </div>

        <div className="p-8 max-w-2xl">
          <div className="mb-8 animate-fade-up">
            <h2 className="text-2xl font-extrabold text-white mb-1">Nouvelle analyse</h2>
            <p className="text-white/40">Uploadez votre video ou collez un lien — l'IA s'occupe du reste.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 animate-fade-up">

            {/* Toggle Fichier / Lien */}
            <div className="flex gap-1 bg-white/4 border border-white/8 rounded-2xl p-1">
              <button type="button" onClick={() => setMode('file')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  mode === 'file'
                    ? 'bg-white/10 text-white border border-white/12'
                    : 'text-white/30 hover:text-white/60'
                }`}>
                Fichier video
              </button>
              <button type="button" onClick={() => setMode('url')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  mode === 'url'
                    ? 'bg-white/10 text-white border border-white/12'
                    : 'text-white/30 hover:text-white/60'
                }`}>
                Lien video
              </button>
            </div>

            {/* Mode Fichier */}
            {mode === 'file' && (
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => document.getElementById('file-input')?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300
                  ${dragging   ? 'border-blue-500/60 bg-blue-500/8' : 'border-white/10 hover:border-white/20 hover:bg-white/3'}
                  ${file       ? 'border-green-500/40 bg-green-500/5' : ''}
                  ${stage === 'uploading' ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input id="file-input" type="file" accept="video/*" className="hidden"
                  onChange={e => e.target.files?.[0] && setFile(e.target.files[0])} />
                {file ? (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-green-500/15 border border-green-500/20 flex items-center justify-center text-3xl mx-auto mb-4">✅</div>
                    <p className="font-bold text-green-400 mb-1">{file.name}</p>
                    <p className="text-sm text-white/30">{(file.size / 1e6).toFixed(1)} Mo</p>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl mx-auto mb-4">🎬</div>
                    <p className="font-semibold text-white mb-1">Glissez votre video ici ou cliquez</p>
                    <p className="text-sm text-white/30">MP4, MOV, AVI, MKV</p>
                  </>
                )}
              </div>
            )}

            {/* Mode URL */}
            {mode === 'url' && (
              <div className="space-y-3">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25 text-sm pointer-events-none">🔗</span>
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={e => setVideoUrl(e.target.value)}
                    placeholder="https://veo.co/matches/... ou we.tl/... ou drive.google.com/..."
                    disabled={stage === 'uploading'}
                    className="input-dark w-full rounded-2xl pl-10 pr-4 py-4 text-sm"
                  />
                </div>

                {videoUrl && (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-white/4 border border-white/8 rounded-xl">
                    <span className="text-lg">{detected ? detected.icon : '🔗'}</span>
                    <span className={`text-sm font-semibold ${detected ? detected.color : 'text-white/50'}`}>
                      {detected ? `${detected.name} detecte` : 'Lien personnalise'}
                    </span>
                    <span className="text-xs text-white/25 ml-auto">Telechargement automatique</span>
                  </div>
                )}

                <div className="glass border border-white/5 rounded-2xl p-4">
                  <p className="text-xs font-bold text-white/25 uppercase tracking-wide mb-3">Plateformes supportees</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {URL_PLATFORMS.map(p => (
                      <div key={p.name} className="flex items-center gap-2.5">
                        <span className="text-base leading-none">{p.icon}</span>
                        <div className="min-w-0">
                          <p className={`text-xs font-semibold ${p.color}`}>{p.name}</p>
                          <p className="text-[10px] text-white/20 truncate">{p.hint}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Infos match */}
            <div className="glass border border-white/8 rounded-2xl p-5 space-y-4">
              <h3 className="font-bold text-white text-sm">Infos du match</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-white/40 uppercase tracking-wide mb-2">Equipe domicile *</label>
                  <input value={form.teamHome} onChange={set('teamHome')} placeholder="RC Paris"
                    required disabled={stage === 'uploading'}
                    className="input-dark w-full rounded-xl px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/40 uppercase tracking-wide mb-2">Equipe exterieure *</label>
                  <input value={form.teamAway} onChange={set('teamAway')} placeholder="Biarritz"
                    required disabled={stage === 'uploading'}
                    className="input-dark w-full rounded-xl px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/40 uppercase tracking-wide mb-2">Competition</label>
                  <input value={form.competition} onChange={set('competition')} placeholder="Federale 1"
                    disabled={stage === 'uploading'}
                    className="input-dark w-full rounded-xl px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/40 uppercase tracking-wide mb-2">Date</label>
                  <input type="date" value={form.matchDate} onChange={set('matchDate')}
                    disabled={stage === 'uploading'}
                    className="input-dark w-full rounded-xl px-3 py-2.5 text-sm" />
                </div>
              </div>
            </div>

            {stage === 'uploading' && (
              <div className="glass border border-white/8 rounded-2xl p-5">
                <div className="flex justify-between text-sm font-semibold text-white mb-3">
                  <span className="text-white/60">{statusMsg}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-white/25 mt-3">
                  {mode === 'url'
                    ? 'Le worker telecharge et analyse la video en arriere-plan.'
                    : "Vous pouvez fermer cette page, l'analyse continue en arriere-plan."}
                </p>
              </div>
            )}

            {stage === 'error' && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-2xl p-4">Erreur : {error}</div>
            )}

            {stage === 'form' && (
              <button type="submit" disabled={!canSubmit}
                className="w-full py-4 bg-amber-400 text-black font-extrabold rounded-2xl text-sm hover:bg-amber-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-400/10">
                Ajouter à la bibliothèque →
              </button>
            )}
          </form>

          <div className="mt-6 glass border border-white/5 rounded-2xl p-5 animate-fade-up">
            <p className="text-xs font-bold text-white/25 uppercase tracking-wide mb-4">Pipeline d'analyse</p>
            <div className="space-y-3">
              {(mode === 'file' ? [
                { icon: '🎬', label: 'Upload securise',       sub: 'Supabase Storage' },
              ] : [
                { icon: '🔗', label: 'Telechargement auto',   sub: 'VEO, HUDL, WeTransfer, Drive...' },
              ]).concat([
                { icon: '🧠', label: 'Detection YOLOv8',      sub: 'Joueurs + ballon frame par frame' },
                { icon: '⚡', label: 'Classification IA',      sub: 'Plaquage, ruck, melee, essai...' },
                { icon: '🤖', label: 'Rapport Claude',         sub: 'Analyse tactique complete' },
              ]).map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/4 border border-white/6 flex items-center justify-center text-base flex-shrink-0">{s.icon}</div>
                  <div>
                    <p className="text-xs font-semibold text-white/60">{s.label}</p>
                    <p className="text-xs text-white/25">{s.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
    </>
  )
}
