'use client'
export const dynamic = 'force-dynamic'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

function SuccessContent() {
  const router = useRouter()
  const [plan, setPlan] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      for (let i = 0; i < 5; i++) {
        const { data } = await supabase
          .from('subscriptions')
          .select('plan, status')
          .single()
        if (data?.status === 'active') {
          setPlan(data.plan)
          setLoading(false)
          return
        }
        await new Promise(r => setTimeout(r, 1000))
      }
      setLoading(false)
    }
    check()
  }, [])

  const dashboardUrl = plan === 'player' ? '/dashboard/player'
                     : plan === 'club'   ? '/dashboard/club'
                     : '/dashboard'

  return (
    <div className="min-h-screen bg-[#07090f] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-amber-400 animate-spin" />
            <p className="text-white/40">Activation en cours...</p>
          </div>
        ) : (
          <div className="animate-fade-up">
            <div className="text-6xl mb-6">{"\uD83C\uDF89"}</div>
            <h1 className="text-3xl font-black text-white mb-2">
              Bienvenue sur XVPRO !
            </h1>
            <p className="text-white/40 mb-8">
              {plan ? `Votre abonnement ${plan.charAt(0).toUpperCase() + plan.slice(1)} est actif.` : "Votre abonnement est actif."}
            </p>
            <Link href={dashboardUrl}
              className="inline-block px-8 py-4 bg-amber-400 text-gray-900 font-black rounded-xl text-lg hover:bg-amber-300 transition-all">
              {"Accéder à mon dashboard →"}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#07090f] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-amber-400 animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
