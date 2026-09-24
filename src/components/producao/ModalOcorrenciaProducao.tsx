import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, AlertOctagon } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  registrarOcorrencia,
  OCORRENCIA_CATEGORIAS,
  OCORRENCIA_CATEGORIA_LABEL,
  STATUS_LABEL,
  type ProducaoPedidoRow,
} from '@/services/producao'

// SPEC-162 — registro de ocorrência pela produção (desenho errado, desenho
// incompleto, retrabalho de peça pronta...). Disponível em qualquer status
// do pedido, inclusive "Pronto" — não há bloqueio por status. Quem
// registrou + quando são gravados automaticamente (login).

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  pedido: ProducaoPedidoRow | null
  onSuccess: () => void
}

export function ModalOcorrenciaProducao({ open, onOpenChange, pedido, onSuccess }: Props) {
  const { toast } = useToast()
  const [categoria, setCategoria] = useState('')
  const [descricao, setDescricao] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!open) return
    setCategoria('')
    setDescricao('')
  }, [open, pedido?.id])

  if (!pedido) return null

  const podeSalvar = !!categoria && !!descricao.trim()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!podeSalvar || !pedido) return
    setSalvando(true)
    try {
      await registrarOcorrencia(pedido.id, categoria, descricao)
      toast({ title: 'Ocorrência registrada' })
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar ocorrência',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !salvando && onOpenChange(v)}>
      <DialogContent className="sm:max-w-[480px] p-8">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertOctagon className="w-4 h-4 text-red-600" />
            Registrar ocorrência
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <p className="text-xs text-slate-500">
            {pedido.numero_pedido ? `Pedido ${pedido.numero_pedido}` : 'Pedido sem número (Corte)'}
            {pedido.cliente_nome ? ` · ${pedido.cliente_nome}` : ''}
            {` · ${STATUS_LABEL[pedido.status] ?? pedido.status}`}
          </p>

          <div className="space-y-2">
            <Label>Tipo de ocorrência *</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {OCORRENCIA_CATEGORIAS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {OCORRENCIA_CATEGORIA_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Textarea
              rows={4}
              className="resize-none"
              placeholder="Descreva o que aconteceu..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

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
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
