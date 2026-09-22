import { useEffect } from 'react'

/**
 * Blank Page (Página em branco)
 *
 * Minimalist, intentional empty sheet of paper:
 * - Centered resting-cursor line (#D6D3D1): 64px wide (48px on mobile <= 640px), 1px high.
 * - Subtle watermark text 12px below the line: "PÁGINA EM BRANCO" in Inter weight 300,
 *   0.875rem, letter-spacing 0.08em, color #A8A29E, opacity 0.7.
 * - Single entrance animation: line fades in 800ms ease-out on load, text fades in 200ms later.
 * - Perfectly static afterwards: no hover, click, scroll or loop effects.
 */
const Index = () => {
  useEffect(() => {
    document.title = 'Página em branco'
  }, [])

  return (
    <div
      className="w-full h-full grid place-items-center cursor-default pointer-events-none select-none"
      aria-label="Página em branco"
    >
      <div className="flex flex-col items-center">
        {/* Linha horizontal fina de repouso (64px desktop / 48px mobile, 1px altura) */}
        <div
          role="presentation"
          className="w-12 sm:w-16 h-px animate-line-fade-in"
          style={{ backgroundColor: '#D6D3D1' }}
        />

        {/* Micro-texto de marca d'água 12px abaixo da linha */}
        <span
          className="mt-3 text-sm uppercase tracking-[0.08em] font-light animate-text-fade-in"
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontWeight: 300,
            fontSize: '0.875rem',
            color: '#A8A29E',
          }}
        >
          Página em branco
        </span>
      </div>
    </div>
  )
}

export default Index
