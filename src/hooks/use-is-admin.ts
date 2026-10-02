import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

// SPEC-174 N10: critério de admin reaproveitado do restante do ecossistema
// (usuarios.role === 'admin' — mesma leitura usada em
// cadastro-lucenera-b86fe/src/lib/usuario-role-cache.ts e em
// Dashboard.tsx do Hub). Sem regra hardcoded de e-mail. Controla só a
// exibição da aba "Log" no frontend — a RLS das tabelas *_log é a
// proteção real (ver migration 20261001_174b_log_producao_garantia).
export function useIsAdmin(): { isAdmin: boolean; loading: boolean } {
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setIsAdmin(false)
      setLoading(false)
      return
    }
    let mounted = true
    setLoading(true)
    supabase
      .from('usuarios')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return
        setIsAdmin((data as any)?.role === 'admin')
        setLoading(false)
      })
      .catch(() => {
        if (!mounted) return
        setIsAdmin(false)
        setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [user])

  return { isAdmin, loading }
}
