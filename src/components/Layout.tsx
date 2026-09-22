import { Outlet } from 'react-router-dom'

/**
 * Global Layout component.
 * Provides a plain, full-viewport shell (100vw × 100vh) without header, navigation,
 * sidebar, footer, or scrollbars.
 * Background has a solid warm off-white base (#FAFAF9) with a barely perceptible
 * soft white radial glow at the center.
 */
export default function Layout() {
  return (
    <main
      className="relative w-screen h-screen overflow-hidden select-none"
      style={{
        backgroundColor: '#FAFAF9',
        backgroundImage: 'radial-gradient(circle at center, #FFFFFF 0%, #FAFAF9 70%)',
      }}
    >
      <Outlet />
    </main>
  )
}
