import { useEffect, useState } from 'react'
import { Loader2, ClipboardList } from 'lucide-react'
import { listarHandoffs, type ProducaoPedidoHandoffRow } from '@/services/producao'

// SPEC-156 Módulo 1 — histórico de handoffs (quem entregou/recebeu) de um
// pedido, expandido inline na linha da tabela (mesmo padrão de
// FornecedoresDaMarcaPanel.tsx em Marcas.tsx).

interface Props {
  producaoPedidoId: string
}

function fmtDataHora(v: string): string {
  const d = new Date(v)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR')
}

export function HistoricoHandoffsPanel({ producaoPedidoId }: Props) {
  const [handoffs, setHandoffs] = useState<ProducaoPedidoHandoffRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    listarHandoffs(producaoPedidoId)
      .then((data) => {
        if (mounted) setHandoffs(data)
      })
      .catch(() => {
        // silencioso — painel secundário
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [producaoPedidoId])

  return (
    <div className="bg-slate-50 border-t border-slate-100 px-6 py-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
        <ClipboardList className="w-3.5 h-3.5" /> Histórico de handoffs
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...
        </div>
      ) : handoffs.length === 0 ? (
        <p className="text-xs text-slate-400 py-1">Nenhum handoff registrado ainda.</p>
      ) : (
        <ul className="space-y-1.5">
          {handoffs.map((h) => (
            <li key={h.id} className="text-xs text-slate-600">
              <span className="font-medium text-slate-800">{h.entregue_por_nome}</span> entregou
              para <span className="font-medium text-slate-800">{h.recebido_por_nome}</span> em{' '}
              {fmtDataHora(h.data_hora)}
              {h.observacao && <span className="text-slate-400"> — {h.observacao}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
