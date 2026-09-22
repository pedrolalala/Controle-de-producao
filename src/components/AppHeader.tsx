import { useNavigate } from 'react-router-dom'
import { Factory, LogOut, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'

export function AppHeader() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-white px-4 md:px-8 shadow-sm">
      <div className="flex items-center gap-2">
        <Factory className="w-5 h-5 text-primary" />
        <span className="font-semibold text-base sm:text-lg text-slate-800">
          Controle de Produção
        </span>
        <span className="hidden sm:inline text-sm text-slate-400 ml-2">Lucenera</span>
      </div>

      <nav className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        >
          <a
            href="https://central-lucenera-dashboard-1c9ba.goskip.app/dashboard"
            title="Voltar para a Central Lucenera"
          >
            <Building2 className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Central</span>
          </a>
        </Button>

        {user && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-slate-600 hover:text-red-600 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        )}
      </nav>
    </header>
  )
}
