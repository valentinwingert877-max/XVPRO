import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default:  'XVPRO — Analyse IA de matchs de rugby',
    template: '%s | XVPRO',
  },
  description: "XVPRO analyse automatiquement vos matchs de rugby : detection des actions, timecodes, statistiques avancees et rapport tactique complet genere par IA. Pour coachs et analystes video.",
  keywords: ['analyse rugby', 'analyse video rugby', 'statistiques rugby', 'coaching rugby', 'IA rugby', 'rugby analytics', 'analyse match rugby', 'logiciel coaching rugby'],
  authors: [{ name: 'XVPRO' }],
  creator: 'XVPRO',
  publisher: 'XVPRO',
  metadataBase: new URL('https://xvpro.vercel.app'),
  alternates: { canonical: '/' },
  openGraph: {
    title:       'XVPRO — Analyse IA de matchs de rugby',
    description: "Uploadez votre match, l'IA detecte toutes les actions et genere un rapport tactique complet en moins de 30 minutes.",
    url:         'https://xvpro.vercel.app',
    siteName:    'XVPRO',
    type:        'website',
    locale:      'fr_FR',
    images: [{
      url:    '/og-image.png',
      width:  1200,
      height: 630,
      alt:    'XVPRO - Analyse IA Rugby',
    }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'XVPRO — Analyse IA de matchs de rugby',
    description: "L'IA analyse votre match de rugby : actions, timecodes, stats et rapport tactique.",
    images:      ['/og-image.png'],
  },
  robots: {
    index:          true,
    follow:         true,
    googleBot: {
      index:               true,
      follow:              true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet':       -1,
    },
  },
  icons: {
    icon:    '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple:   '/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
      </head>
      <body>{children}</body>
    </html>
  )
}
