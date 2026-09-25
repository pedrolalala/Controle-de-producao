import { useCallback, useEffect, useState } from 'react'
import { Loader2, MessageSquare, AlertTriangle, History } from 'lucide-react'
import {
  listarPrazoAlteracoes,
  listarEdicoes,
  listarOcorrencias,
  type ProducaoPedidoRow,
  type ProducaoPedidoOcorrenciaRow,
  type ProducaoPedidoPrazoAlteracaoRow,
  type ProducaoPedidoEdicaoRow,
} from '@/services/producao'
import { HistoricoHandoffsPanel } from './HistoricoHandoffsPanel'
import { OcorrenciasPanel } from './OcorrenciasPanel'

// SPEC-161 — painel expansível da linha de um pedido (mesma seta já usada
// desde a SPEC-156 pra abrir o histórico de handoffs). Reúne:
// - Ocorrências registradas pela produção (SPEC-162)
// - Observação completa (Prioridade 7)
// - Histórico de alteração de prazo, com motivo (Prioridade 8)
// - Histórico de edições, quem + quando (Prioridade 4)
// - Histórico de handoffs (já existia, SPEC-156)

interface Props {
  pedido: ProducaoPedidoRow
  // Recarrega a listagem (contador de ocorrências em aberto na linha).
  onChange?: () => void
}

function fmtDate(v: string | null): string {
  if (!v) return '—'
  const d = new Date(`${v}T00:00:00`)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

function fmtDataHora(v: string): string {
  const d = new Date(v)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR')
}

export function PedidoDetalhesExpandido({ pedido, onChange }: Props) {
  const [prazoAlteracoes, setPrazoAlteracoes] = useState<ProducaoPedidoPrazoAlteracaoRow[]>([])
  const [edicoes, setEdicoes] = useState<ProducaoPedidoEdicaoRow[]>([])
  const [ocorrencias, setOcorrencias] = useState<ProducaoPedidoOcorrenciaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [ocorrenciasRefresh, setOcorrenciasRefresh] = useState(0)
  const recarregarOcorrencias = useCallback(() => {
    setOcorrenciasRefresh((n) => n + 1)
    onChange?.()
  }, [onChange])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([
      listarPrazoAlteracoes(pedido.id),
      listarEdicoes(pedido.id),
      listarOcorrencias(pedido.id),
    ])
      .then(([prazos, eds, ocs]) => {
        if (!mounted) return
        setPrazoAlteracoes(prazos)
        setEdicoes(eds)
        setOcorrencias(ocs)
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
  }, [pedido.id, pedido.ocorrencias_count, ocorrenciasRefresh])

  return (
    <div className="bg-slate-50 border-t border-slate-100 divide-y divide-slate-100">
      <OcorrenciasPanel
        ocorrencias={ocorrencias}
        loading={loading}
        onChange={recarregarOcorrencias}
      />

      {pedido.observacao && (
        <div className="px-6 py-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-1">
            <MessageSquare className="w-3.5 h-3.5" /> Observação
          </p>
          <p className="text-xs text-slate-700 whitespace-pre-wrap">{pedido.observacao}</p>
        </div>
      )}

      <div className="px-6 py-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
          <AlertTriangle className="w-3.5 h-3.5" /> Histórico de alteração de prazo
        </p>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...
          </div>
        ) : prazoAlteracoes.length === 0 ? (
          <p className="text-xs text-slate-400 py-1">Prazo nunca foi alterado.</p>
        ) : (
          <ul className="space-y-1.5">
            {prazoAlteracoes.map((p) => (
              <li key={p.id} className="text-xs text-slate-600">
                <span className="font-medium text-slate-800">{fmtDate(p.prazo_anterior)}</span>
                {' → '}
                <span className="font-medium text-slate-800">{fmtDate(p.prazo_novo)}</span>
                {' — '}
                {p.motivo}
                <span className="text-slate-400">
                  {' '}
                  ({p.alterado_por_nome ?? 'usuário'} em {fmtDataHora(p.alterado_em)})
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="px-6 py-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
          <History className="w-3.5 h-3.5" /> Histórico de edições
        </p>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...
          </div>
        ) : edicoes.length === 0 ? (
          <p className="text-xs text-slate-400 py-1">Pedido nunca foi editado.</p>
        ) : (
          <ul className="space-y-1.5">
            {edicoes.map((e) => (
              <li key={e.id} className="text-xs text-slate-600">
                Editado por{' '}
                <span className="font-medium text-slate-800">{e.editado_por_nome ?? 'usuário'}</span>{' '}
                em {fmtDataHora(e.editado_em)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <HistoricoHandoffsPanel producaoPedidoId={pedido.id} />
    </div>
  )
}
