import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'XVPRO - Analyse IA Rugby'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'flex-start', justifyContent: 'center',
        background: 'linear-gradient(135deg, #07090f 0%, #0d1018 100%)',
        padding: '80px',
        position: 'relative',
      }}>
        {/* Gold top bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: '#D4A843' }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
          <span style={{ fontSize: 80, fontWeight: 900, color: 'white', letterSpacing: -2, lineHeight: 1 }}>
            XV
          </span>
          <span style={{ fontSize: 80, fontWeight: 900, color: '#D4A843', letterSpacing: -2, lineHeight: 1 }}>
            PRO
          </span>
        </div>

        {/* Title */}
        <div style={{ fontSize: 48, fontWeight: 700, color: 'white', marginBottom: 16, lineHeight: 1.2 }}>
          Analyse IA de matchs de rugby
        </div>

        {/* Subtitle */}
        <div style={{ fontSize: 28, color: 'rgba(255,255,255,0.45)', marginBottom: 48 }}>
          Detecte toutes les actions. Genere le rapport tactique. En 30 minutes.
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{
            padding: '12px 24px', borderRadius: 32,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.5)', fontSize: 18, fontWeight: 700,
          }}>
            YOLO + Claude AI
          </div>
          <div style={{
            padding: '12px 24px', borderRadius: 32,
            background: 'rgba(212,168,67,0.1)',
            border: '1px solid rgba(212,168,67,0.3)',
            color: '#D4A843', fontSize: 18, fontWeight: 700,
          }}>
            Analyse en 30 minutes
          </div>
          <div style={{
            padding: '12px 24px', borderRadius: 32,
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.3)',
            color: '#60a5fa', fontSize: 18, fontWeight: 700,
          }}>
            100% automatique
          </div>
        </div>

        {/* URL */}
        <div style={{
          position: 'absolute', bottom: 40, right: 80,
          color: 'rgba(255,255,255,0.2)', fontSize: 20, letterSpacing: 2,
        }}>
          xvpro.vercel.app
        </div>
      </div>
    ),
    { ...size }
  )
}
