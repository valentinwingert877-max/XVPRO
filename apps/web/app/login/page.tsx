'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError('Email ou mot de passe incorrect')
      setLoading(false)
      return
    }
    const role = data.user?.user_metadata?.role
    const dest = role === 'player' ? '/dashboard/player'
               : role === 'club'   ? '/dashboard/club'
               : role === 'admin'  ? '/dashboard/admin'
               : '/dashboard'
    window.location.replace(dest)
  }

  return (
    <div className="min-h-screen bg-[#07090f] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-blue-600/8 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-amber-500/5 blur-[80px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <Link href="/" className="flex justify-center mb-8">
          <span className="text-2xl font-extrabold">XV<span className="text-amber-400">PRO</span></span>
        </Link>

        <div className="glass border border-white/10 rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-white mb-1">Connexion</h1>
          <p className="text-sm text-white/40 mb-8">{"Accédez à votre espace d'analyse"}</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
              <span>{"\u26a0\ufe0f"}</span> {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wide mb-2">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="vous@monclub.fr" required
                className="input-dark w-full rounded-xl px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wide mb-2">Mot de passe</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" required
                className="input-dark w-full rounded-xl px-4 py-3 text-sm" />
            </div>
            <button type="submit" disabled={loading}
              className="relative w-full py-3.5 bg-white text-gray-900 font-bold rounded-xl text-sm hover:bg-gray-100 transition-all disabled:opacity-50 mt-2">
              {loading ? "Connexion..." : "Se connecter →"}
            </button>
          </form>

          <p className="text-center text-sm text-white/30 mt-6">
            {"Pas encore de compte ?"}{' '}
            <Link href="/register" className="text-blue-400 font-semibold hover:text-blue-300 transition-colors">
              Essai gratuit
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
