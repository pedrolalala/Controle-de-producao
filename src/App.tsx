import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/hooks/use-auth'
import { AppHeader } from './components/AppHeader'
import { ProtectedRoute } from './components/ProtectedRoute'
import Login from './pages/Login'
import Producao from './pages/Producao'

// ONLY IMPORT AND RENDER WORKING PAGES, NEVER ADD PLACEHOLDER COMPONENTS OR PAGES IN THIS FILE
// AVOID REMOVING ANY CONTEXT PROVIDERS FROM THIS FILE (e.g. TooltipProvider, Toaster, Sonner)

const AppShell = () => {
  const location = useLocation()
  const isLoginRoute = location.pathname === '/login'

  if (isLoginRoute) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
      </Routes>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50">
      <AppHeader />
      <main className="w-full flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-4 md:py-6">
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Producao />} />
          </Route>
        </Routes>
      </main>
    </div>
  )
}

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppShell />
      </TooltipProvider>
    </BrowserRouter>
  </AuthProvider>
)

export default App
