import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{
        width: 32, height: 32,
        background: '#0C0D11',
        borderRadius: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: '#D4A843', borderRadius: '6px 6px 0 0' }} />
        <span style={{ fontSize: 14, fontWeight: 900, color: 'white', letterSpacing: -1 }}>
          XV<span style={{ color: '#D4A843' }}>P</span>
        </span>
      </div>
    ),
    { ...size }
  )
}
