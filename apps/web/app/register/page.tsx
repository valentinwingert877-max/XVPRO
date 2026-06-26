'use client'
export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Role = 'player' | 'coach' | 'club'

const ROLES = [
  { key: 'player' as Role, icon: '🏉', label: 'Joueur',    sub: 'Mes stats perso' },
  { key: 'coach'  as Role, icon: '📋', label: 'Coach',     sub: 'Analyse équipe' },
  { key: 'club'   as Role, icon: '🏛️', label: 'Club',      sub: 'Vue globale club' },
]

export default function RegisterPage() {
  const supabase = createClient()
  const router   = useRouter()
  const [role, setRole]         = useState<Role>('coach')
  const [fullName, setFullName] = useState('')
  const [clubName, setClubName] = useState('')
  const [clubCode, setClubCode] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')

    // 1. Inscription Supabase Auth
    const { data, error: authErr } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, club_name: clubName, role } },
    })
    if (authErr || !data.user) {
      setError(authErr?.message ?? 'Erreur inscription')
      setLoading(false); return
    }
    const userId = data.user.id

    // 2. Si club owner : creer le club et generer le code
    if (role === 'club') {
      const { data: clubData, error: clubErr } = await supabase
        .from('clubs')
        .insert({ name: clubName || fullName, owner_id: userId, code: '' })
        .select('id')
        .single()

      if (!clubErr && clubData) {
        // Generer le code via la fonction SQL
        const { data: codeData } = await supabase
          .rpc('generate_club_code', { club_name: clubName || fullName })
        const code = codeData ?? ('CLUB' + Math.random().toString(36).slice(2,6).toUpperCase())
        await supabase.from('clubs').update({ code }).eq('id', clubData.id)
        // Ajouter le president comme membre owner
        await supabase.from('club_members').insert({
          club_id: clubData.id, user_id: userId, role: 'owner'
        })
      }
      router.replace('/dashboard/club')
      return
    }

    // 3. Si coach/player avec code club : rejoindre le club
    if (clubCode.trim()) {
      const { data: club } = await supabase
        .from('clubs')
        .select('id')
        .eq('code', clubCode.trim().toUpperCase())
        .single()
      if (club) {
        await supabase.from('club_members').insert({
          club_id: club.id, user_id: userId, role
        })
      } else {
        setError('Code club invalide')
        setLoading(false); return
      }
    }

    router.replace(role === 'player' ? '/dashboard/player' : '/dashboard')
  }

  const needsClubCode = role === 'coach' || role === 'player'
  const isClubOwner   = role === 'club'

  return (
    <div className="min-h-screen bg-[#07090f] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-blue-600/8 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] rounded-full bg-indigo-500/5 blur-[80px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <Link href="/" className="flex justify-center mb-8">
          <span className="text-2xl font-extrabold text-white">XV<span className="text-amber-400">PRO</span></span>
        </Link>

        <div className="glass border border-white/10 rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-white mb-1">Créer un compte</h1>
          <p className="text-sm text-white/40 mb-6">1 match offert &mdash; sans carte bancaire</p>

          {/* Choix du role */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {ROLES.map(r => (
              <button key={r.key} type="button" onClick={() => setRole(r.key)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                  role === r.key
                    ? 'border-amber-400/50 bg-amber-400/8 text-white'
                    : 'border-white/10 bg-white/3 text-white/40 hover:text-white/70 hover:border-white/20'
                }`}>
                <span className="text-xl">{r.icon}</span>
                <span className="text-xs font-bold">{r.label}</span>
                <span className="text-[10px] opacity-60 text-center leading-tight">{r.sub}</span>
              </button>
            ))}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wide mb-1.5">Nom complet *</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Jean Dupont" required
                  className="input-dark w-full rounded-xl px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wide mb-1.5">
                  {isClubOwner ? 'Nom du club *' : 'Club'}
                </label>
                <input type="text" value={clubName} onChange={e => setClubName(e.target.value)}
                  placeholder="RC Paris" required={isClubOwner}
                  className="input-dark w-full rounded-xl px-3 py-2.5 text-sm" />
              </div>
            </div>

            {needsClubCode && (
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wide mb-1.5">
                  Code club <span className="text-white/20 font-normal normal-case">(optionnel)</span>
                </label>
                <input type="text" value={clubCode} onChange={e => setClubCode(e.target.value)}
                  placeholder="RCPA3F2K" maxLength={8}
                  className="input-dark w-full rounded-xl px-3 py-2.5 text-sm tracking-widest uppercase" />
                <p className="text-[10px] text-white/20 mt-1">Fourni par ton club pour rejoindre l&apos;organisation</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wide mb-1.5">Email *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="vous@monclub.fr" required
                className="input-dark w-full rounded-xl px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wide mb-1.5">Mot de passe *</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="8 caractères minimum" required minLength={8}
                className="input-dark w-full rounded-xl px-3 py-2.5 text-sm" />
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-amber-400 text-gray-900 font-black rounded-xl text-sm hover:bg-amber-300 transition-all disabled:opacity-50 mt-1">
              {loading ? 'Création...' : `Créer mon compte ${role === 'club' ? 'Club' : role === 'player' ? 'Joueur' : 'Coach'} →`}
            </button>
          </form>

          <p className="text-center text-sm text-white/30 mt-4">
            Déjà un compte ?{' '}
            <Link href="/login" className="text-blue-400 font-semibold hover:text-blue-300 transition-colors">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
