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
import { Loader2, RefreshCcw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  atualizarStatusProducaoPedido,
  marcarProducaoPedidoPronto,
  STATUS_SUGESTOES,
  STATUS_LABEL,
  type ProducaoPedidoRow,
} from '@/services/producao'

// SPEC-156 Módulo 1 — status é texto livre no banco (sem CHECK, a planilha
// real tem dado sujo: PRONTO/Pronto/PRONTA + CANCELADO/EXCLUÍDO/ENTRADA
// PARCIAL). Este modal oferece sugestões via <datalist> mas aceita
// qualquer valor digitado. Quando o valor final é "pronto", exige também a
// data em que a peça ficou pronta (grava em data_ficou_pronto).

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
  const [status, setStatus] = useState('')
  const [dataFicouPronto, setDataFicouPronto] = useState(today())
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!open || !pedido) return
    setStatus(pedido.status)
    setDataFicouPronto(pedido.data_ficou_pronto || today())
  }, [open, pedido])

  if (!pedido) return null

  const statusNormalizado = status.trim().toLowerCase().replace(/\s+/g, '_')
  const ehPronto = statusNormalizado === 'pronto'
  const podeSalvar = !!status.trim() && (!ehPronto || !!dataFicouPronto)

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
            <Input
              list="status-sugestoes-producao"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="Digite ou escolha uma sugestão..."
            />
            <datalist id="status-sugestoes-producao">
              {STATUS_SUGESTOES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </datalist>
            <p className="text-[11px] text-slate-400">
              Sugestões: {STATUS_SUGESTOES.map((s) => STATUS_LABEL[s]).join(', ')}. Qualquer outro
              valor digitado também é aceito.
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
