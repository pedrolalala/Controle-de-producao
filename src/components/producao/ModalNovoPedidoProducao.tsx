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
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Paperclip, PackagePlus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  criarProducaoPedido,
  getEmpresas,
  TIPO_PECA_LABEL,
  PRIORIDADE_LABEL,
  type Empresa,
  type TipoPecaProducao,
  type PrioridadeProducao,
} from '@/services/producao'

// SPEC-156 Módulo 1 — formulário de novo pedido de produção. Réplica dos
// campos reais da planilha "CONTROLE DE PRODUÇÃO (1).xlsx" (3 abas viram um
// só seletor de tipo_peca, não 3 telas separadas).

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const TIPOS: TipoPecaProducao[] = ['lineas_steccas', 'peca_avulsa', 'corte']
const PRIORIDADES: PrioridadeProducao[] = ['normal', 'alta', 'urgente']

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function ModalNovoPedidoProducao({ open, onOpenChange, onSuccess }: Props) {
  const { toast } = useToast()

  const [empresas, setEmpresas] = useState<Empresa[]>([])

  const [tipoPeca, setTipoPeca] = useState<TipoPecaProducao>('peca_avulsa')
  const [numeroPedido, setNumeroPedido] = useState('')
  const [dataPedido, setDataPedido] = useState(today())
  const [empresaId, setEmpresaId] = useState('')
  const [sistemaOrigem, setSistemaOrigem] = useState('')
  const [arquitetoNome, setArquitetoNome] = useState('')
  const [clienteNome, setClienteNome] = useState('')
  const [dataPrazo, setDataPrazo] = useState('')
  const [prioridade, setPrioridade] = useState<PrioridadeProducao>('normal')
  const [observacao, setObservacao] = useState('')
  const [pdfPedido, setPdfPedido] = useState<File | null>(null)
  const [pdfDesenho, setPdfDesenho] = useState<File | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!open) return
    getEmpresas()
      .then(setEmpresas)
      .catch(() => {
        // silencioso — select fica vazio, usuário percebe ao tentar salvar
      })
  }, [open])

  useEffect(() => {
    if (!open) return
    setTipoPeca('peca_avulsa')
    setNumeroPedido('')
    setDataPedido(today())
    setEmpresaId('')
    setSistemaOrigem('')
    setArquitetoNome('')
    setClienteNome('')
    setDataPrazo('')
    setPrioridade('normal')
    setObservacao('')
    setPdfPedido(null)
    setPdfDesenho(null)
  }, [open])

  // Aba CORTES nunca teve coluna PEDIDO na planilha real.
  const numeroPedidoObrigatorio = tipoPeca !== 'corte'
  const podeSalvar =
    !!dataPedido && !!empresaId && (!numeroPedidoObrigatorio || !!numeroPedido.trim())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!podeSalvar) return
    setSalvando(true)
    try {
      await criarProducaoPedido({
        tipo_peca: tipoPeca,
        numero_pedido: numeroPedido || null,
        data_pedido: dataPedido,
        empresa_id: empresaId,
        sistema_origem: sistemaOrigem || null,
        arquiteto_nome: arquitetoNome || null,
        cliente_nome: clienteNome || null,
        data_prazo: dataPrazo || null,
        prioridade,
        observacao: observacao || null,
        pdf_pedido: pdfPedido,
        pdf_desenho: pdfDesenho,
      })
      toast({ title: 'Pedido de produção criado' })
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao criar pedido',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !salvando && onOpenChange(v)}>
      <DialogContent className="sm:max-w-[720px] max-h-[92vh] overflow-y-auto p-8">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <PackagePlus className="w-4 h-4 text-primary" />
            Novo pedido de produção
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="space-y-2">
            <Label>Tipo de peça *</Label>
            <Select value={tipoPeca} onValueChange={(v) => setTipoPeca(v as TipoPecaProducao)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_PECA_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>
              Nº do pedido {numeroPedidoObrigatorio ? '*' : '(a aba Cortes não tem número)'}
            </Label>
            <Input
              value={numeroPedido}
              onChange={(e) => setNumeroPedido(e.target.value)}
              disabled={tipoPeca === 'corte'}
              placeholder={tipoPeca === 'corte' ? 'Sem número de pedido' : 'Ex.: 1868'}
            />
          </div>

          <div className="space-y-2">
            <Label>Data do pedido *</Label>
            <Input
              type="date"
              required
              value={dataPedido}
              onChange={(e) => setDataPedido(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Empresa *</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tipoPeca === 'lineas_steccas' && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Sistema de origem (opcional)</Label>
              <Input
                value={sistemaOrigem}
                onChange={(e) => setSistemaOrigem(e.target.value)}
                placeholder="Ex.: CONNECT, LUCENERA..."
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Arquiteto(a)</Label>
            <Input value={arquitetoNome} onChange={(e) => setArquitetoNome(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Cliente</Label>
            <Input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Prazo de entrega</Label>
            <Input type="date" value={dataPrazo} onChange={(e) => setDataPrazo(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Prioridade *</Label>
            <Select
              value={prioridade}
              onValueChange={(v) => setPrioridade(v as PrioridadeProducao)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORIDADES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORIDADE_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Paperclip className="w-3.5 h-3.5" /> PDF do pedido
            </Label>
            <Input
              type="file"
              accept=".pdf,image/*"
              className="cursor-pointer"
              onChange={(e) => setPdfPedido(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Paperclip className="w-3.5 h-3.5" /> PDF do desenho
            </Label>
            <Input
              type="file"
              accept=".pdf,image/*"
              className="cursor-pointer"
              onChange={(e) => setPdfDesenho(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Observação</Label>
            <Textarea
              rows={2}
              className="resize-none"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder='Ex.: "GAP - L05, L07, L14" ou "precisa que o Felipe faça o cone antes"'
            />
          </div>

          <DialogFooter className="sm:col-span-2 pt-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!podeSalvar || salvando} className="min-w-[160px]">
              {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Criar pedido
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
