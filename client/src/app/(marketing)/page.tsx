import Link from 'next/link'

// The public landing page is statically rendered for SEO; its content arrives with Phase 7
export default function MarketingPage() {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: 24
      }}
    >
      <h1>Bot RTS</h1>
      <p>Program your bots. Conquer the map.</p>
      <Link href="/game">Play</Link>
    </main>
  )
}
