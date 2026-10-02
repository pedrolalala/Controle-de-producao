import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, RefreshCcw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  atualizarStatusProducaoPedido,
  marcarProducaoPedidoPronto,
  normalizarStatus,
  STATUS_SUGESTOES,
  STATUS_LABEL,
  STATUS_OUTRO,
  type ProducaoPedidoRow,
} from '@/services/producao'

// SPEC-156 Módulo 1 — status é texto livre no banco (sem CHECK, a planilha
// real tem dado sujo: PRONTO/Pronto/PRONTA + CANCELADO/EXCLUÍDO/ENTRADA
// PARCIAL).
//
// SPEC-174 N11: antes, este modal era um <Input list="..."> com
// <datalist> — o usuário relatou "os status não estão aparecendo para
// selecionar, apenas na descrição de quais status tem" (o rodapé "Sugestões:
// ..." é só texto; o <datalist> nativo não abre de forma confiável dentro
// do Dialog do Radix, que tem overlay/focus-trap próprios — diferente dos
// outros 3 campos do sistema (Tipo de peça, Empresa, Prioridade em
// ModalNovoPedidoProducao.tsx), que já usam o <Select> do Radix e funcionam
// normalmente dentro do mesmo Dialog). Troca para <Select> real (igual ao
// resto do sistema), com a opção "Outro" revelando um campo de texto livre
// — mesmo padrão de OCORRENCIA_OUTRO em ModalOcorrenciaProducao.tsx — para
// não perder a capacidade de digitar um status fora da lista (dado sujo
// real da planilha, sem CHECK no banco).

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  pedido: ProducaoPedidoRow | null
  onSuccess: () => void
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function ModalAtualizarStatusProducao({ open, onOpenChange, pedido, onSuccess }: Props) {
  const { toast } = useToast()
  // SPEC-174 N11: statusSelecionado guarda o valor do <Select> (uma das
  // STATUS_SUGESTOES ou o sentinela STATUS_OUTRO); statusLivre só é usado
  // quando "Outro" está selecionado.
  const [statusSelecionado, setStatusSelecionado] = useState('')
  const [statusLivre, setStatusLivre] = useState('')
  const [dataFicouPronto, setDataFicouPronto] = useState(today())
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!open || !pedido) return
    const atual = normalizarStatus(pedido.status)
    if ((STATUS_SUGESTOES as readonly string[]).includes(atual)) {
      setStatusSelecionado(atual)
      setStatusLivre('')
    } else {
      // Status legado (ex.: "em_andamento") ou qualquer outro valor digitado
      // antes — não está nas sugestões, mas não pode desaparecer: cai em
      // "Outro" já preenchido com o valor exato que o pedido tem hoje.
      setStatusSelecionado(STATUS_OUTRO)
      setStatusLivre(pedido.status)
    }
    setDataFicouPronto(pedido.data_ficou_pronto || today())
  }, [open, pedido])

  if (!pedido) return null

  const ehOutro = statusSelecionado === STATUS_OUTRO
  const status = ehOutro ? statusLivre.trim() : statusSelecionado
  const statusNormalizado = normalizarStatus(status)
  const ehPronto = statusNormalizado === 'pronto'
  const podeSalvar =
    !!statusSelecionado && (!ehOutro || !!statusLivre.trim()) && (!ehPronto || !!dataFicouPronto)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!podeSalvar || !pedido) return
    setSalvando(true)
    try {
      if (ehPronto) {
        await marcarProducaoPedidoPronto(pedido.id, dataFicouPronto)
      } else {
        await atualizarStatusProducaoPedido(pedido.id, status)
      }
      toast({ title: 'Status atualizado' })
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar status',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !salvando && onOpenChange(v)}>
      <DialogContent className="sm:max-w-[440px] p-8">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <RefreshCcw className="w-4 h-4 text-primary" />
            Atualizar status
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <p className="text-xs text-slate-500">
            {pedido.numero_pedido ? `Pedido ${pedido.numero_pedido}` : 'Pedido sem número (Corte)'}
            {pedido.cliente_nome ? ` · ${pedido.cliente_nome}` : ''}
          </p>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={statusSelecionado} onValueChange={setStatusSelecionado}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {STATUS_SUGESTOES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
                <SelectItem value={STATUS_OUTRO}>Outro (escrever)</SelectItem>
              </SelectContent>
            </Select>
            {ehOutro && (
              <Input
                autoFocus
                value={statusLivre}
                onChange={(e) => setStatusLivre(e.target.value)}
                placeholder="Digite o status..."
              />
            )}
            <p className="text-[11px] text-slate-400">
              Sugestões: {STATUS_SUGESTOES.map((s) => STATUS_LABEL[s]).join(', ')}. Escolha "Outro"
              para digitar um valor fora da lista.
            </p>
          </div>

          {ehPronto && (
            <div className="space-y-2">
              <Label>Data em que ficou pronto *</Label>
              <Input
                type="date"
                required
                value={dataFicouPronto}
                onChange={(e) => setDataFicouPronto(e.target.value)}
              />
            </div>
          )}

          <DialogFooter className="pt-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!podeSalvar || salvando} className="min-w-[140px]">
              {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
