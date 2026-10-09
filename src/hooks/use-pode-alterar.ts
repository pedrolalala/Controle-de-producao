import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { producaoPodeAlterar } from '@/services/producao'

// SPEC-191 A5: "quem pode alterar, eu, Débora, Mateus, Vitória e João" — os
// demais só visualizam. Lista em producao_editores (banco).
export function usePodeAlterar(): { podeAlterar: boolean; loading: boolean } {
  const { user } = useAuth()
  const [podeAlterar, setPodeAlterar] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setPodeAlterar(false)
      setLoading(false)
      return
    }
    let mounted = true
    setLoading(true)
    producaoPodeAlterar().then((v) => {
      if (!mounted) return
      setPodeAlterar(v)
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [user])

  return { podeAlterar, loading }
}
