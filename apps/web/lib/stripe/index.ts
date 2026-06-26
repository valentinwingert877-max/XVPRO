import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-06-24.dahlia' as any,
})

export const PLANS = {
  player: {
    name: 'Joueur',
    priceId: process.env.STRIPE_PRICE_PLAYER!,
    price: 9,
  },
  coach: {
    name: 'Coach',
    priceId: process.env.STRIPE_PRICE_COACH!,
    price: 29,
  },
  club: {
    name: 'Club',
    priceId: process.env.STRIPE_PRICE_CLUB!,
    price: 59,
  },
} as const

export type PlanKey = keyof typeof PLANS
