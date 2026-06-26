'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'

const FEATURES = [
  { icon: '🎯', title: 'Détection automatique', desc: "L'IA identifie essais, plaquages, mêlées, touches, pénalités et cartons à chaque seconde du match." },
  { icon: '⏱️', title: 'Timecodes précis',      desc: "Chaque action horodatée à la seconde. Retrouvez n'importe quel moment clé instantanément." },
  { icon: '🤖', title: 'Rapport Claude IA',     desc: "Rapport narratif complet généré par IA : points forts, faiblesses, recommandations tactiques." },
  { icon: '📊', title: 'Stats avancées',         desc: "Possession, territoire, taux de plaquage, qualification positive/négative de chaque action." },
  { icon: '✅', title: 'Bilan succès/échecs',    desc: "Chaque ruck, mêlée, touche qualifié : gagné ou perdu. Identifiez vos points faibles en un coup d'œil." },
  { icon: '⚡', title: 'Analyse en 30 min',      desc: "Un match complet de 80 minutes analysé en moins de 30 minutes. Disponible dès la fin du match." },
]

const STEPS = [
  { n: '01', title: 'Uploadez votre vidéo',  desc: "MP4, MOV, AVI jusqu'à 20 Go. L'upload prend moins d'une minute.",       icon: '🎬' },
  { n: '02', title: "L'IA analyse tout",     desc: "YOLOv8 détecte joueurs et ballon. Claude génère le rapport tactique.",    icon: '🧠' },
  { n: '03', title: 'Accédez au rapport',    desc: "Timeline interactive, stats, bilan succès/échecs et rapport IA complet.", icon: '📋' },
]

const STATS = [
  { num: '15+',    label: "Types d'actions" },
  { num: '< 30m',  label: 'Analyse complète' },
  { num: '98%',    label: 'Précision IA' },
]

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false)
  const [activeFeature, setActiveFeature] = useState(0)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setActiveFeature(f => (f + 1) % FEATURES.length), 3000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="min-h-screen bg-[#07090f] text-white overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 h-16 transition-all duration-300 ${scrolled ? 'nav-blur' : ''}`}>
        <div className="text-xl font-extrabold tracking-tight">
          XV<span className="text-amber-400">PRO</span>
          <span className="ml-2 text-[9px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full tracking-widest">IA</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/pricing" className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors">
            Tarifs
          </Link>
          <Link href="/login" className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors">
            Connexion
          </Link>
          <Link href="/register" className="px-4 py-2 bg-white text-gray-900 text-sm font-bold rounded-lg hover:bg-gray-100 transition-all hover:shadow-lg hover:shadow-white/10">
            Essai gratuit
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-16 overflow-hidden bg-hero-gradient">
        {/* Orbes de fond */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-blue-600/8 blur-[120px] pointer-events-none animate-glow-pulse" />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] rounded-full bg-indigo-600/6 blur-[80px] pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-amber-500/5 blur-[80px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto">
          {/* Badge */}
          <div className="animate-fade-up inline-flex items-center gap-2 glass border border-white/10 text-xs font-semibold px-4 py-2 rounded-full mb-8 text-white/70">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Analyse IA de matchs de rugby · Powered by YOLOv8 + Claude
          </div>

          {/* Headline */}
          <h1 className="animate-fade-up delay-100 text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight mb-6">
            <span className="gradient-text">Transformez vos matchs</span>
            <br />
            <span className="gradient-text-blue">en insights tactiques</span>
          </h1>

          <p className="animate-fade-up delay-200 text-lg text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
            Déposez votre vidéo. L'IA analyse chaque action, génère des timecodes précis,
            qualifie chaque ruck et plaquage, et produit un rapport tactique complet — en moins de 30 minutes.
          </p>

          {/* CTAs */}
          <div className="animate-fade-up delay-300 flex items-center justify-center gap-3 flex-wrap mb-16">
            <Link href="/register"
              className="relative px-8 py-4 bg-white text-gray-900 font-extrabold rounded-xl text-base transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-white/20 overflow-hidden group">
              <span className="relative z-10">Commencer gratuitement →</span>
              <div className="absolute inset-0 btn-shimmer opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
            <Link href="/login"
              className="px-8 py-4 glass border border-white/10 font-bold rounded-xl text-base hover:border-white/25 hover:bg-white/6 transition-all">
              Se connecter
            </Link>
          </div>

          {/* Stats */}
          <div className="animate-fade-up delay-400 flex items-center justify-center gap-12 flex-wrap">
            {STATS.map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl font-black gradient-text-amber">{s.num}</p>
                <p className="text-xs text-white/40 mt-1 uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Mock dashboard flottant */}
        <div className="animate-fade-up delay-500 animate-float relative z-10 mt-20 w-full max-w-3xl mx-auto">
          <div className="glass border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/5">
              <div className="w-3 h-3 rounded-full bg-red-400/60" />
              <div className="w-3 h-3 rounded-full bg-amber-400/60" />
              <div className="w-3 h-3 rounded-full bg-green-400/60" />
              <div className="ml-4 flex-1 h-5 bg-white/5 rounded-md" />
            </div>
            <div className="p-6 grid grid-cols-3 gap-4">
              {[
                { label: 'Matchs analysés', val: '12', color: 'text-white' },
                { label: 'Actions détectées', val: '847', color: 'text-blue-400' },
                { label: 'Taux de réussite', val: '73%', color: 'text-green-400' },
              ].map((c, i) => (
                <div key={i} className="bg-white/3 border border-white/5 rounded-xl p-4">
                  <p className="text-xs text-white/30 mb-1">{c.label}</p>
                  <p className={`text-2xl font-black ${c.color}`}>{c.val}</p>
                </div>
              ))}
              <div className="col-span-3 bg-white/3 border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs font-semibold text-white/50">Timeline match · RC Paris vs Biarritz</p>
                  <span className="ml-auto text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">✓ Analysé</span>
                </div>
                <div className="relative h-4 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full w-2/3 bg-gradient-to-r from-blue-600 to-blue-400 rounded-full" />
                  {['12%', '28%', '45%', '61%', '79%'].map((p, i) => (
                    <div key={i} className="absolute top-0 bottom-0 w-0.5 bg-amber-400/60" style={{ left: p }} />
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  {['💥 Plaquage', '🔄 Ruck', '🟢 Essai', '🔵 Mêlée'].map(a => (
                    <span key={a} className="text-xs glass border border-white/8 px-2 py-1 rounded-lg text-white/50">{a}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Reflet */}
          <div className="h-16 bg-gradient-to-b from-blue-500/5 to-transparent mt-2 rounded-b-2xl blur-sm" />
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-32 px-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-32 bg-gradient-to-b from-transparent to-white/10" />
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4">Fonctionnalités</p>
            <h2 className="text-4xl sm:text-5xl font-extrabold gradient-text tracking-tight">
              Tout ce dont votre staff a besoin
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <div key={i}
                onMouseEnter={() => setActiveFeature(i)}
                className={`glass border rounded-2xl p-6 cursor-default card-hover transition-all duration-300 ${
                  activeFeature === i ? 'border-blue-500/30 bg-blue-500/5' : 'border-white/7'
                }`}>
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comment ça marche ── */}
      <section className="py-32 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/10 to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-4">Comment ça marche</p>
            <h2 className="text-4xl sm:text-5xl font-extrabold gradient-text tracking-tight">Simple comme 1, 2, 3</h2>
          </div>
          <div className="relative">
            {/* Ligne verticale */}
            <div className="absolute left-[39px] top-0 bottom-0 w-px bg-gradient-to-b from-blue-500/30 via-blue-500/10 to-transparent hidden sm:block" />
            <div className="space-y-12">
              {STEPS.map((s, i) => (
                <div key={i} className="flex gap-8 items-start group">
                  <div className="flex-shrink-0 w-20 h-20 glass border border-white/10 rounded-2xl flex items-center justify-center text-3xl group-hover:border-blue-500/40 transition-all">
                    {s.icon}
                  </div>
                  <div className="pt-3">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-black text-blue-400/60 tracking-widest">{s.n}</span>
                      <h3 className="text-xl font-bold text-white">{s.title}</h3>
                    </div>
                    <p className="text-white/45 leading-relaxed max-w-md">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="py-32 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="relative glass border border-white/10 rounded-3xl p-12 text-center overflow-hidden">
            {/* Glow de fond */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/8 via-transparent to-amber-500/5 pointer-events-none" />
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <div className="text-5xl mb-6">🏉</div>
              <h2 className="text-3xl sm:text-4xl font-extrabold gradient-text mb-4">
                Prêt à analyser votre prochain match ?
              </h2>
              <p className="text-white/40 mb-8 text-lg">14 jours gratuits · Sans carte bancaire · Annulation à tout moment</p>
              <Link href="/register"
                className="inline-flex items-center gap-2 px-10 py-4 bg-amber-400 text-gray-900 font-extrabold rounded-xl text-base hover:bg-amber-300 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-amber-400/25">
                Commencer gratuitement →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-8 px-6 text-center">
        <div className="text-xl font-extrabold mb-2">
          XV<span className="text-amber-400">PRO</span>
        </div>
        <div className="flex justify-center gap-6 text-sm text-white/30 mb-3">
          <Link href="/pricing" className="hover:text-white transition-colors">Tarifs</Link>
          <Link href="/login" className="hover:text-white transition-colors">Connexion</Link>
          <Link href="/register" className="hover:text-white transition-colors">Inscription</Link>
        </div>
        <p className="text-xs text-white/15">&copy; {new Date().getFullYear()} XVPRO. Tous droits reserves.</p>
      </footer>
    </div>
  )
}