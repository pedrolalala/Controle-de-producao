import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Search,
  X,
  RefreshCw,
  Factory,
  Plus,
  ChevronDown,
  ChevronRight,
  FileText,
  Ruler,
  ClipboardCheck,
  ExternalLink,
  MessageSquare,
  AlertTriangle,
  Pencil,
  Paperclip,
  AlertOctagon,
  ScrollText,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { useIsAdmin } from '@/hooks/use-is-admin'
import { ModalNovoPedidoProducao } from '@/components/producao/ModalNovoPedidoProducao'
import { ModalAtualizarStatusProducao } from '@/components/producao/ModalAtualizarStatusProducao'
import { ModalHandoffProducao } from '@/components/producao/ModalHandoffProducao'
import { ModalOcorrenciaProducao } from '@/components/producao/ModalOcorrenciaProducao'
import { PedidoDetalhesExpandido } from '@/components/producao/PedidoDetalhesExpandido'
import { LogPanelProducao } from '@/components/producao/LogPanelProducao'
import {
  listarProducaoPedidos,
  getEmpresas,
  normalizarStatus,
  TIPO_PECA_LABEL,
  PRIORIDADE_LABEL,
  STATUS_LABEL,
  type ProducaoPedidoRow,
  type TipoPecaProducao,
  type PrioridadeProducao,
  type Empresa,
} from '@/services/producao'

// SPEC-156 — Controle de Produção. As 3 abas da planilha real (LINEAS E
// STECCAS / PEÇAS AVULSAS / CORTES) viram um filtro de tipo_peca, não 3
// telas separadas.

const TIPOS: Array<{ value: TipoPecaProducao | 'todos'; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'lineas_steccas', label: TIPO_PECA_LABEL.lineas_steccas },
  { value: 'peca_avulsa', label: TIPO_PECA_LABEL.peca_avulsa },
  { value: 'corte', label: TIPO_PECA_LABEL.corte },
]

const PRIORIDADE_BADGE: Record<PrioridadeProducao, string> = {
  normal: 'bg-slate-100 border-slate-200 text-slate-700',
  urgente: 'bg-red-50 border-red-200 text-red-700',
}

// SPEC-161 Prioridade 6: "Aguardando Material" é a situação mais crítica
// do fluxo ("é a situação mais crítica") — aparece sempre primeiro na
// listagem, independente do filtro/ordenação atual (data_pedido desc).
function ordenarComAguardandoMaterialPrimeiro(pedidos: ProducaoPedidoRow[]): ProducaoPedidoRow[] {
  return [...pedidos].sort((a, b) => {
    const pa = normalizarStatus(a.status) === 'aguardando_material' ? 0 : 1
    const pb = normalizarStatus(b.status) === 'aguardando_material' ? 0 : 1
    return pa - pb
  })
}

function statusBadgeClass(status: string): string {
  const s = status.trim().toLowerCase()
  if (s === 'pronto') return 'bg-emerald-50 border-emerald-200 text-emerald-700'
  if (s === 'cancelado' || s === 'excluido' || s === 'excluído')
    return 'bg-red-50 border-red-200 text-red-700'
  if (s === 'entrada_parcial' || s === 'entrada parcial')
    return 'bg-amber-50 border-amber-200 text-amber-700'
  return 'bg-blue-50 border-blue-200 text-blue-700'
}

function fmtDate(v: string | null): string {
  if (!v) return '—'
  const d = new Date(`${v}T00:00:00`)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

export default function Producao() {
  const { toast } = useToast()
  const { isAdmin } = useIsAdmin()

  // SPEC-174 N10: aba "Log" (histórico de quem fez o quê), visível só para
  // administrador. Some da UI pra quem não é admin — defesa em profundidade
  // real está na RLS de producao_pedidos_log (só admin lê).
  const [view, setView] = useState<'pedidos' | 'log'>('pedidos')

  const [pedidos, setPedidos] = useState<ProducaoPedidoRow[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)

  const [tipoPeca, setTipoPeca] = useState<TipoPecaProducao | 'todos'>('todos')
  const [empresaId, setEmpresaId] = useState<string>('todas')
  const [prioridade, setPrioridade] = useState<PrioridadeProducao | 'todas'>('todas')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [modalNovoOpen, setModalNovoOpen] = useState(false)
  const [pedidoEditando, setPedidoEditando] = useState<ProducaoPedidoRow | null>(null)
  const [pedidoStatusSelecionado, setPedidoStatusSelecionado] = useState<ProducaoPedidoRow | null>(
    null,
  )
  const [pedidoHandoffSelecionado, setPedidoHandoffSelecionado] =
    useState<ProducaoPedidoRow | null>(null)
  const [pedidoOcorrenciaSelecionado, setPedidoOcorrenciaSelecionado] =
    useState<ProducaoPedidoRow | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const pedidosOrdenados = useMemo(() => ordenarComAguardandoMaterialPrimeiro(pedidos), [pedidos])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const loadPedidos = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listarProducaoPedidos({
        tipo_peca: tipoPeca === 'todos' ? undefined : tipoPeca,
        empresa_id: empresaId === 'todas' ? undefined : empresaId,
        prioridade: prioridade === 'todas' ? undefined : prioridade,
        search: debouncedSearch || undefined,
      })
      setPedidos(data)
    } catch {
      toast({
        title: 'Erro',
        description: 'Falha ao carregar pedidos de produção.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [tipoPeca, empresaId, prioridade, debouncedSearch, toast])

  useEffect(() => {
    loadPedidos()
  }, [loadPedidos])

  useEffect(() => {
    getEmpresas()
      .then(setEmpresas)
      .catch(() => {
        // silencioso
      })
  }, [])

  return (
    <div className="flex flex-col space-y-4 w-full pb-20 max-w-[1600px] mx-auto animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Factory className="w-6 h-6 text-primary" />
            Produção
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Réplica digital do controle de pedidos de produção (Lineas/Steccas, Peças Avulsas,
            Cortes) — status em tempo real, sem precisar ligar para ninguém.
          </p>
        </div>
        <Button onClick={() => setModalNovoOpen(true)} className="shadow-sm w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Novo pedido
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-1.5 shrink-0">
        <div className="flex flex-wrap gap-1.5">
          {TIPOS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setView('pedidos')
                setTipoPeca(t.value)
              }}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                view === 'pedidos' && tipoPeca === t.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* SPEC-174 N10: aba "Log" só aparece para administrador. */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => setView((v) => (v === 'log' ? 'pedidos' : 'log'))}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              view === 'log'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
            )}
          >
            <ScrollText className="w-3.5 h-3.5" />
            Log
          </button>
        )}
      </div>

      {view === 'log' ? (
        <LogPanelProducao />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border-b border-slate-100 shrink-0">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por pedido, cliente, arquiteto(a) ou observação..."
                className="pl-9 bg-slate-50 border-slate-200 h-9"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>

            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger className="h-9 w-full sm:w-[160px]">
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as empresas</SelectItem>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={prioridade}
              onValueChange={(v) => setPrioridade(v as PrioridadeProducao | 'todas')}
            >
              <SelectTrigger className="h-9 w-full sm:w-[140px]">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Toda prioridade</SelectItem>
                <SelectItem value="normal">{PRIORIDADE_LABEL.normal}</SelectItem>
                <SelectItem value="urgente">{PRIORIDADE_LABEL.urgente}</SelectItem>
              </SelectContent>
            </Select>

            {searchInput && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchInput('')}
                className="shrink-0 text-slate-500 hover:text-slate-700 h-9"
              >
                <X className="w-4 h-4 mr-1" />
                Limpar busca
              </Button>
            )}

            <Button
              variant="outline"
              onClick={loadPedidos}
              className="shadow-sm h-9 shrink-0"
              disabled={loading}
            >
              <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
              Atualizar
            </Button>
          </div>

          <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100 shrink-0">
            {loading ? 'Carregando...' : `${pedidos.length} pedido(s)`}
          </div>

          <div className="overflow-auto flex-1">
            <Table className="min-w-[1300px] w-full table-fixed">
              <TableHeader className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <TableRow className="h-11">
                  <TableHead className="w-[36px] pl-4 sm:pl-6" />
                  <TableHead className="w-[140px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                    Tipo
                  </TableHead>
                  <TableHead className="w-[90px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                    Pedido
                  </TableHead>
                  <TableHead className="w-[110px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                    Empresa
                  </TableHead>
                  <TableHead className="w-[160px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                    Cliente
                  </TableHead>
                  <TableHead className="w-[130px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                    Arquiteto(a)
                  </TableHead>
                  <TableHead className="w-[90px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                    Prazo
                  </TableHead>
                  <TableHead className="w-[90px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                    Prioridade
                  </TableHead>
                  <TableHead className="w-[140px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                    Status
                  </TableHead>
                  <TableHead className="w-[80px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                    PDFs
                  </TableHead>
                  <TableHead className="pr-4 sm:pr-6 w-[280px] text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                    Ação
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-slate-500">Carregando...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : pedidosOrdenados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-40 text-center">
                      <div className="flex flex-col items-center text-slate-400">
                        <Factory className="w-10 h-10 mb-3 text-slate-300" />
                        <p className="text-slate-600 font-medium">Nenhum pedido de produção</p>
                        <p className="text-sm mt-1">
                          {searchInput || tipoPeca !== 'todos'
                            ? 'Tente ajustar os filtros.'
                            : 'Crie o primeiro pedido pelo botão "Novo pedido".'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  pedidosOrdenados.map((p) => {
                    const expandido = expandedId === p.id
                    return (
                      <Fragment key={p.id}>
                        <TableRow className="h-14 border-b border-slate-50">
                          <TableCell className="pl-4 sm:pl-6 align-middle py-2">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                title="Ver detalhes (observação, histórico de prazo, edições e handoffs)"
                                className="text-slate-400 hover:text-slate-700"
                                onClick={() =>
                                  setExpandedId((prev) => (prev === p.id ? null : p.id))
                                }
                              >
                                {expandido ? (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5" />
                                )}
                              </button>
                              {p.observacao && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <MessageSquare className="w-3 h-3 text-amber-500 shrink-0" />
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-[280px]">
                                    <p className="text-xs whitespace-pre-wrap">{p.observacao}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-middle py-2">
                            <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                              {p.tipo_peca === 'corte' ? (
                                <Ruler className="w-3 h-3 text-slate-400" />
                              ) : null}
                              {TIPO_PECA_LABEL[p.tipo_peca]}
                            </span>
                          </TableCell>
                          <TableCell className="align-middle py-2">
                            <span className="text-sm font-medium text-slate-900">
                              {p.numero_pedido ?? '—'}
                            </span>
                          </TableCell>
                          <TableCell className="align-middle py-2">
                            <span className="text-sm text-slate-700 line-clamp-1">
                              {p.empresa_nome ?? '—'}
                            </span>
                          </TableCell>
                          <TableCell className="align-middle py-2">
                            <span className="text-sm text-slate-700 line-clamp-1">
                              {p.cliente_nome ?? '—'}
                            </span>
                          </TableCell>
                          <TableCell className="align-middle py-2">
                            <span className="text-sm text-slate-600 line-clamp-1">
                              {p.arquiteto_nome ?? '—'}
                            </span>
                          </TableCell>
                          <TableCell className="align-middle py-2">
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-slate-600">
                                {fmtDate(p.data_prazo)}
                              </span>
                              {p.prazo_alteracoes_count > 0 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedId((prev) => (prev === p.id ? null : p.id))
                                      }
                                    >
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">
                                      Prazo já foi alterado {p.prazo_alteracoes_count}x — clique
                                      para ver o motivo.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-middle py-2">
                            <Badge
                              className={cn('border font-medium', PRIORIDADE_BADGE[p.prioridade])}
                            >
                              {PRIORIDADE_LABEL[p.prioridade]}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-middle py-2">
                            <button
                              type="button"
                              onClick={() => setPedidoStatusSelecionado(p)}
                              title="Clique para atualizar o status"
                            >
                              <Badge
                                className={cn('border font-medium', statusBadgeClass(p.status))}
                              >
                                {STATUS_LABEL[p.status] ?? p.status}
                              </Badge>
                            </button>
                            {p.ocorrencias_count > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedId((prev) => (prev === p.id ? null : p.id))
                                }
                                title="Clique para ver as ocorrências"
                                className={cn(
                                  'flex items-center gap-1 text-[11px] mt-0.5 hover:underline',
                                  p.ocorrencias_abertas_count > 0
                                    ? 'text-red-600'
                                    : 'text-slate-400',
                                )}
                              >
                                <AlertOctagon className="w-3 h-3" />
                                {p.ocorrencias_abertas_count > 0
                                  ? `${p.ocorrencias_abertas_count} ocorrência(s) em aberto`
                                  : `${p.ocorrencias_count} ocorrência(s) resolvida(s)`}
                              </button>
                            )}
                            {p.data_ficou_pronto && (
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Pronto em {fmtDate(p.data_ficou_pronto)}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="align-middle py-2">
                            <div className="flex flex-col gap-0.5">
                              {p.pdf_pedido_url && (
                                <a
                                  href={p.pdf_pedido_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-primary hover:underline text-[11px]"
                                >
                                  <FileText className="w-3 h-3" /> Pedido
                                </a>
                              )}
                              {p.pdf_desenho_url && (
                                <a
                                  href={p.pdf_desenho_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-primary hover:underline text-[11px]"
                                >
                                  <ExternalLink className="w-3 h-3" /> Desenho (antigo)
                                </a>
                              )}
                              {p.anexos_count > 0 && (
                                <span className="inline-flex items-center gap-1 text-slate-500 text-[11px]">
                                  <Paperclip className="w-3 h-3" /> {p.anexos_count} anexo(s)
                                </span>
                              )}
                              {!p.pdf_pedido_url && !p.pdf_desenho_url && p.anexos_count === 0 && (
                                <span className="text-[11px] text-slate-400">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="pr-4 sm:pr-6 text-right align-middle py-2">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => setPedidoEditando(p)}
                              >
                                <Pencil className="w-3.5 h-3.5 mr-1" />
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => setPedidoStatusSelecionado(p)}
                              >
                                Status
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                onClick={() => setPedidoHandoffSelecionado(p)}
                              >
                                <ClipboardCheck className="w-3.5 h-3.5 mr-1" />
                                Handoff
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs text-red-700 border-red-200 hover:bg-red-50"
                                onClick={() => setPedidoOcorrenciaSelecionado(p)}
                              >
                                <AlertOctagon className="w-3.5 h-3.5 mr-1" />
                                Ocorrência
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandido && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={11} className="p-0">
                              <PedidoDetalhesExpandido pedido={p} onChange={loadPedidos} />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <ModalNovoPedidoProducao
        open={modalNovoOpen}
        onOpenChange={setModalNovoOpen}
        onSuccess={loadPedidos}
      />

      <ModalNovoPedidoProducao
        open={!!pedidoEditando}
        onOpenChange={(v) => !v && setPedidoEditando(null)}
        onSuccess={loadPedidos}
        pedido={pedidoEditando}
      />

      <ModalAtualizarStatusProducao
        open={!!pedidoStatusSelecionado}
        onOpenChange={(v) => !v && setPedidoStatusSelecionado(null)}
        pedido={pedidoStatusSelecionado}
        onSuccess={loadPedidos}
      />

      <ModalHandoffProducao
        open={!!pedidoHandoffSelecionado}
        onOpenChange={(v) => !v && setPedidoHandoffSelecionado(null)}
        pedido={pedidoHandoffSelecionado}
        onSuccess={loadPedidos}
      />

      <ModalOcorrenciaProducao
        open={!!pedidoOcorrenciaSelecionado}
        onOpenChange={(v) => !v && setPedidoOcorrenciaSelecionado(null)}
        pedido={pedidoOcorrenciaSelecionado}
        onSuccess={loadPedidos}
      />
    </div>
  )
}
