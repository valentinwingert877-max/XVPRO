'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const PLANS = [
  {
    key: 'player',
    name: 'Joueur',
    icon: '🏉',
    price: { monthly: 9, yearly: 7 },
    color: 'from-blue-500/20 to-blue-600/5',
    border: 'border-blue-500/20',
    highlight: false,
    features: [
      'Dashboard joueur personnel',
      'Statistiques individuelles par match',
      'Accès à tous vos matchs analysés',
      'Auto-identification dans les actions',
    ],
  },
  {
    key: 'coach',
    name: 'Coach',
    icon: '📋',
    price: { monthly: 29, yearly: 23 },
    color: 'from-amber-500/20 to-amber-600/5',
    border: 'border-amber-500/30',
    highlight: true,
    features: [
      'Analyse IA illimitée de matchs',
      'Détection automatique des actions',
      'Tracking joueurs par IA (ByteTrack)',
      'Export PDF rapport de match',
      'Dashboard équipe complet',
    ],
  },
  {
    key: 'club',
    name: 'Club',
    icon: '🏛️',
    price: { monthly: 59, yearly: 47 },
    color: 'from-purple-500/20 to-purple-600/5',
    border: 'border-purple-500/20',
    highlight: false,
    features: [
      'Tout ce que Coach inclut',
      'Coachs illimités dans le club',
      'Vue globale président',
      'Stats agrégées de tous les joueurs',
      'Code invitation club',
    ],
  },
]

const FAQ = [
  { q: "Comment fonctionne l'analyse IA ?", a: "Vous uploadez votre vidéo de match. Notre IA détecte automatiquement toutes les actions rugby (mêlées, touches, plaquages, rucks...) avec les timecodes et les joueurs impliqués." },
  { q: "Puis-je annuler à tout moment ?", a: "Oui, sans engagement. Vous gérez votre abonnement directement depuis votre espace client Stripe." },
  { q: "Quels formats vidéo sont acceptés ?", a: "MP4, MOV, AVI. Vous pouvez aussi importer depuis un lien VEO, HUDL ou WeTransfer." },
  { q: "Les données sont-elles sécurisées ?", a: "Oui. Vos vidéos et données sont hébergées en Europe, cryptées, et jamais partagées." },
]

export default function PricingPage() {
  const [yearly, setYearly]     = useState(false)
  const [openFaq, setOpenFaq]   = useState<number | null>(null)
  const [loading, setLoading]   = useState<string | null>(null)
  const supabase = createClient()
  const router   = useRouter()

  async function handleSubscribe(planKey: string) {
    setLoading(planKey)
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      router.push('/login')
      return
    }

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan: planKey }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(`Erreur Stripe : ${data.error ?? 'Réessayez'}`)
        setLoading(null)
      }
    } catch (err: any) {
      alert(`Erreur réseau : ${err?.message}`)
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#07090f] text-white">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#07090f]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-extrabold">XV<span className="text-amber-400">PRO</span></Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-white/50 hover:text-white transition-colors">Connexion</Link>
            <Link href="/register" className="px-4 py-2 bg-amber-400 text-gray-900 font-bold rounded-xl text-sm hover:bg-amber-300 transition-all">
              Essai gratuit
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-28 pb-20 px-4">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-400/10 border border-amber-400/20 rounded-full text-amber-400 text-xs font-semibold mb-6 tracking-widest uppercase">
              Tarifs simples
            </div>
            <h1 className="text-4xl md:text-5xl font-black mb-4">
              Choisissez votre plan
            </h1>
            <p className="text-white/40 text-lg mb-8">
              1 match offert à la création du compte — sans carte bancaire
            </p>
            {/* Toggle mensuel/annuel */}
            <div className="inline-flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-1">
              <button onClick={() => setYearly(false)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${!yearly ? 'bg-white/10 text-white' : 'text-white/40'}`}>
                Mensuel
              </button>
              <button onClick={() => setYearly(true)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${yearly ? 'bg-white/10 text-white' : 'text-white/40'}`}>
                Annuel
                <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-bold">-20%</span>
              </button>
            </div>
          </div>

          {/* Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-20">
            {PLANS.map(plan => (
              <div key={plan.key}
                className={`relative rounded-2xl border p-7 bg-gradient-to-b ${plan.color} ${plan.border} ${plan.highlight ? 'ring-1 ring-amber-400/30 scale-[1.02]' : ''} transition-all`}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-amber-400 text-gray-900 text-xs font-black rounded-full">
                    LE PLUS POPULAIRE
                  </div>
                )}
                <div className="text-3xl mb-3">{plan.icon}</div>
                <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                <div className="flex items-end gap-1 mb-6">
                  <span className="text-4xl font-black">
                    {yearly ? plan.price.yearly : plan.price.monthly}€
                  </span>
                  <span className="text-white/30 text-sm mb-1">/mois</span>
                </div>
                <ul className="space-y-2.5 mb-8">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-white/70">
                      <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSubscribe(plan.key)}
                  disabled={loading === plan.key}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-60 ${
                    plan.highlight
                      ? 'bg-amber-400 text-gray-900 hover:bg-amber-300'
                      : 'bg-white/10 text-white hover:bg-white/15 border border-white/10'
                  }`}>
                  {loading === plan.key ? 'Redirection...' : "Commencer →"}
                </button>
              </div>
            ))}
          </div>

          {/* FAQ */}
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">Questions fréquentes</h2>
            <div className="space-y-3">
              {FAQ.map((item, i) => (
                <div key={i} className="glass border border-white/10 rounded-xl overflow-hidden">
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-semibold hover:bg-white/3 transition-colors">
                    {item.q}
                    <span className={`transition-transform text-white/30 ${openFaq === i ? 'rotate-45' : ''}`}>+</span>
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-4 text-sm text-white/50 border-t border-white/5 pt-3">
                      {item.a}
                    </div>
                                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
