'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/dashboard',         label: 'Tableau de bord', icon: '📊' },
  { href: '/dashboard/upload',  label: 'Analyser un match', icon: '🎬' },
  { href: '/dashboard/player',  label: 'Mon profil',       icon: '🏉' },
]

const NAV_CLUB = [
  { href: '/dashboard/club',    label: 'Mon club',         icon: '🏛️' },
]

export default function Sidebar({ user, profile }: { user: any; profile: any }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const initials = (profile?.full_name || user?.email || 'U')
    .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

  const role = user?.user_metadata?.role
  const allNav = role === 'club' || role === 'admin' ? [...NAV, ...NAV_CLUB] : NAV

  return (
    <aside className="fixed left-0 top-0 h-full w-[260px] bg-[#0d1117] border-r border-white/5 flex flex-col z-50">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/5">
        <div className="text-xl font-extrabold text-white">
          XV<span className="text-amber-400">PRO</span>
        </div>
        <div className="text-[9px] font-bold text-white/25 tracking-widest mt-0.5 uppercase">Analyse IA Rugby</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {allNav.map(item => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${active
                  ? 'bg-white/8 text-white border border-white/10'
                  : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-white/5">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xs font-bold text-black flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white/80 truncate">
              {profile?.full_name ?? user?.email}
            </p>
            <p className="text-[10px] text-white/30 capitalize">{profile?.plan || 'Gratuit'}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full text-left px-3 py-2 text-xs text-white/30 hover:text-red-400 hover:bg-red-500/8 rounded-lg transition-all"
        >
          Déconnexion
        </button>
      </div>
    </aside>
  )
}
