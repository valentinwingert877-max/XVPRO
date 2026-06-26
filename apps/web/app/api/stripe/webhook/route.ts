import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')!
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error('Webhook signature error:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = await createClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId  = session.metadata?.user_id
      const plan    = session.metadata?.plan
      if (!userId || !plan) break

      const subId = session.subscription as string
      const stripeSub = await stripe.subscriptions.retrieve(subId) as any

      await supabase.from('subscriptions').upsert({
        user_id:             userId,
        stripe_customer_id:  session.customer as string,
        stripe_sub_id:       subId,
        plan,
        status:              'active',
        current_period_end:  stripeSub.current_period_end
          ? new Date(stripeSub.current_period_end * 1000).toISOString()
          : null,
        updated_at:          new Date().toISOString(),
      }, { onConflict: 'user_id' })

      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: { role: plan }
      })
      break
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub    = event.data.object as Stripe.Subscription
      const subAny = sub as any
      const userId = sub.metadata?.user_id
      if (!userId) break

      const status = event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status

      await supabase.from('subscriptions').upsert({
        user_id:            userId,
        stripe_sub_id:      sub.id,
        status,
        current_period_end: subAny.current_period_end
          ? new Date(subAny.current_period_end * 1000).toISOString()
          : null,
        updated_at:         new Date().toISOString(),
      }, { onConflict: 'user_id' })
      break
    }
  }

  return NextResponse.json({ received: true })
}
