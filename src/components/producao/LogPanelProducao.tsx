import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, ScrollText, RefreshCw, Search } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { listarLogProducao, type LogProducaoEntry } from '@/services/producao'

// SPEC-174 N10 — aba "Log", visível só para administrador: histórico de
// quem fez o quê (criação, edição de campos, mudança de status,
// ocorrências criadas/resolvidas, handoffs), mais recente primeiro, com
// busca simples. Fonte dos dados: ver listarLogProducao() em
// services/producao.ts (junta producao_pedidos_log — trilha nova, migration
// 20261001_174b_log_producao_garantia — com producao_pedido_ocorrencias e
// producao_pedido_handoffs, que já existiam).

function fmtDataHora(v: string): string {
  const d = new Date(v)
  if (isNaN(d.getTime())) return '—'
  // Entradas vindas de colunas `date` puras (ex.: ocorrência resolvida)
  // não têm hora real — v.length === 10 identifica esse caso ("YYYY-MM-DD").
  if (v.length === 10) return d.toLocaleDateString('pt-BR')
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

export function LogPanelProducao() {
  const { toast } = useToast()
  const [entradas, setEntradas] = useState<LogProducaoEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  async function carregar() {
    setLoading(true)
    try {
      setEntradas(await listarLogProducao())
    } catch {
      toast({
        title: 'Erro',
        description: 'Falha ao carregar o log (confira se o seu usuário é administrador).',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return entradas
    return entradas.filter((e) =>
      [e.usuario_nome, e.acao, e.pedido_numero, e.pedido_cliente, e.detalhe]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(termo)),
    )
  }, [busca, entradas])

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col min-h-0">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border-b border-slate-100 shrink-0">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por usuário, ação, pedido ou cliente..."
            className="pl-9 bg-slate-50 border-slate-200 h-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={carregar} className="shadow-sm h-9 shrink-0" disabled={loading}>
          <RefreshCw className={loading ? 'w-4 h-4 mr-2 animate-spin' : 'w-4 h-4 mr-2'} />
          Atualizar
        </Button>
      </div>

      <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100 shrink-0">
        {loading ? 'Carregando...' : `${filtradas.length} evento(s)`}
      </div>

      <div className="overflow-auto flex-1">
        <Table className="min-w-[900px] w-full">
          <TableHeader className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
            <TableRow className="h-11">
              <TableHead className="w-[140px]">Data/Hora</TableHead>
              <TableHead className="w-[160px]">Usuário</TableHead>
              <TableHead className="w-[160px]">Ação</TableHead>
              <TableHead className="w-[140px]">Pedido</TableHead>
              <TableHead>Detalhe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                    <span className="text-xs text-slate-500">Carregando...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filtradas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-40 text-center">
                  <div className="flex flex-col items-center text-slate-400">
                    <ScrollText className="w-10 h-10 mb-3 text-slate-300" />
                    <p className="text-slate-600 font-medium">Nenhum evento encontrado</p>
                    <p className="text-sm mt-1">
                      {busca ? 'Tente ajustar a busca.' : 'O log fica vazio até a primeira ação.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtradas.map((e) => (
                <TableRow key={e.id} className="h-12 border-b border-slate-50">
                  <TableCell className="text-sm text-slate-600">{fmtDataHora(e.data_hora)}</TableCell>
                  <TableCell className="text-sm text-slate-700">{e.usuario_nome ?? '—'}</TableCell>
                  <TableCell className="text-sm text-slate-900 font-medium">{e.acao}</TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {e.pedido_numero ?? '—'}
                    {e.pedido_cliente ? ` · ${e.pedido_cliente}` : ''}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">{e.detalhe ?? '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
