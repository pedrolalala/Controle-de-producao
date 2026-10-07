import { useEffect, useRef, useState } from 'react'
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
import { Loader2, Paperclip, PackagePlus, Pencil, X, AlertTriangle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  criarProducaoPedido,
  atualizarProducaoPedido,
  getEmpresas,
  listarAnexos,
  adicionarAnexo,
  removerAnexo,
  TIPO_PECA_LABEL,
  PRIORIDADE_LABEL,
  type Empresa,
  type TipoPecaProducao,
  type PrioridadeProducao,
  type ProducaoPedidoRow,
  type ProducaoPedidoAnexoRow,
} from '@/services/producao'

// SPEC-156 Módulo 1 — formulário de novo pedido de produção. Réplica dos
// campos reais da planilha "CONTROLE DE PRODUÇÃO (1).xlsx" (3 abas viram um
// só seletor de tipo_peca, não 3 telas separadas).
//
// SPEC-161 Prioridade 4: o mesmo formulário passou a servir também pra
// EDITAR um pedido já criado (`pedido` preenchido) — sem restrição de quem
// pode editar (decisão do usuário), mas toda edição grava uma trilha de
// auditoria (feito em atualizarProducaoPedido). Prioridade 3: anexos
// (desenhos) agora são múltiplos e editáveis a qualquer momento — em modo
// de edição, adicionar/remover anexo é imediato (não espera o "Salvar"
// geral do formulário); em modo de criação, os arquivos escolhidos são
// enviados só depois do pedido ser criado (precisa do id). Prioridade 8:
// mudar o prazo de um pedido que já tinha prazo definido exige motivo.

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  pedido?: ProducaoPedidoRow | null
}

const TIPOS: TipoPecaProducao[] = ['lineas_steccas', 'peca_avulsa', 'corte']
const PRIORIDADES: PrioridadeProducao[] = ['normal', 'urgente']

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function ModalNovoPedidoProducao({ open, onOpenChange, onSuccess, pedido }: Props) {
  const { toast } = useToast()
  const modoEdicao = !!pedido

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
  const [anexosNovos, setAnexosNovos] = useState<File[]>([])
  const [salvando, setSalvando] = useState(false)

  // Prioridade 8 — justificativa obrigatória ao mudar o prazo.
  const [prazoOriginal, setPrazoOriginal] = useState<string | null>(null)
  const [motivoAlteracaoPrazo, setMotivoAlteracaoPrazo] = useState('')

  // Prioridade 3 — anexos já existentes (só em modo de edição).
  const [anexosExistentes, setAnexosExistentes] = useState<ProducaoPedidoAnexoRow[]>([])
  const [carregandoAnexos, setCarregandoAnexos] = useState(false)
  const [uploadandoAnexo, setUploadandoAnexo] = useState(false)
  const [removendoAnexoId, setRemovendoAnexoId] = useState<string | null>(null)
  const anexoInputRef = useRef<HTMLInputElement>(null)

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
    if (pedido) {
      setTipoPeca(pedido.tipo_peca)
      setNumeroPedido(pedido.numero_pedido ?? '')
      setDataPedido(pedido.data_pedido)
      setEmpresaId(pedido.empresa_id)
      setSistemaOrigem(pedido.sistema_origem ?? '')
      setArquitetoNome(pedido.arquiteto_nome ?? '')
      setClienteNome(pedido.cliente_nome ?? '')
      setDataPrazo(pedido.data_prazo ?? '')
      setPrioridade(pedido.prioridade)
      setObservacao(pedido.observacao ?? '')
      setPrazoOriginal(pedido.data_prazo ?? null)
      setMotivoAlteracaoPrazo('')
      setPdfPedido(null)
      setPdfDesenho(null)
      setAnexosNovos([])
      setCarregandoAnexos(true)
      listarAnexos(pedido.id)
        .then(setAnexosExistentes)
        .catch(() => {
          setAnexosExistentes([])
        })
        .finally(() => setCarregandoAnexos(false))
    } else {
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
      setAnexosNovos([])
      setPrazoOriginal(null)
      setMotivoAlteracaoPrazo('')
      setAnexosExistentes([])
    }
  }, [open, pedido])

  // Aba CORTES nunca teve coluna PEDIDO na planilha real.
  const numeroPedidoObrigatorio = tipoPeca !== 'corte'
  const prazoMudou = modoEdicao && (dataPrazo || null) !== (prazoOriginal || null)
  const podeSalvar =
    !!dataPedido &&
    !!empresaId &&
    (!numeroPedidoObrigatorio || !!numeroPedido.trim()) &&
    (!prazoMudou || !!motivoAlteracaoPrazo.trim())

  async function handleAdicionarAnexoImediato(file: File) {
    if (!pedido) return
    setUploadandoAnexo(true)
    try {
      const novo = await adicionarAnexo(pedido.id, file)
      setAnexosExistentes((prev) => [novo, ...prev])
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao anexar arquivo',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setUploadandoAnexo(false)
      if (anexoInputRef.current) anexoInputRef.current.value = ''
    }
  }

  async function handleRemoverAnexoImediato(anexoId: string) {
    setRemovendoAnexoId(anexoId)
    try {
      await removerAnexo(anexoId)
      setAnexosExistentes((prev) => prev.filter((a) => a.id !== anexoId))
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao remover anexo',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setRemovendoAnexoId(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!podeSalvar) return
    setSalvando(true)
    try {
      if (modoEdicao && pedido) {
        await atualizarProducaoPedido(
          {
            id: pedido.id,
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
            motivo_alteracao_prazo: prazoMudou ? motivoAlteracaoPrazo : null,
          },
          prazoOriginal,
        )
        toast({ title: 'Pedido atualizado' })
      } else {
        const novoId = await criarProducaoPedido({
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
        for (const arquivo of anexosNovos) {
          await adicionarAnexo(novoId, arquivo)
        }
        toast({ title: 'Pedido de produção criado' })
      }
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast({
        title: modoEdicao ? 'Erro ao atualizar pedido' : 'Erro ao criar pedido',
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
            {modoEdicao ? (
              <Pencil className="w-4 h-4 text-primary" />
            ) : (
              <PackagePlus className="w-4 h-4 text-primary" />
            )}
            {modoEdicao ? 'Editar pedido de produção' : 'Novo pedido de produção'}
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

          <div className="space-y-2 sm:col-span-2">
            <Label>Prazo de entrega</Label>
            <Input type="date" value={dataPrazo} onChange={(e) => setDataPrazo(e.target.value)} />
            {prazoMudou && (
              <div className="space-y-1.5 rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  O prazo já estava definido — informe o motivo da alteração.
                </p>
                <Textarea
                  rows={2}
                  className="resize-none bg-white"
                  value={motivoAlteracaoPrazo}
                  onChange={(e) => setMotivoAlteracaoPrazo(e.target.value)}
                  placeholder='Ex.: "faltando material"'
                  required
                />
              </div>
            )}
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
            {modoEdicao && pedido?.pdf_pedido_url && !pdfPedido && (
              <p className="text-[11px] text-slate-400">
                Já existe um arquivo — escolher outro substitui o atual.
              </p>
            )}
          </div>

          {!modoEdicao && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Paperclip className="w-3.5 h-3.5" /> Desenho(s)
              </Label>
              <Input
                type="file"
                accept=".pdf,image/*"
                multiple
                className="cursor-pointer"
                onChange={(e) => setAnexosNovos(Array.from(e.target.files ?? []))}
              />
              {anexosNovos.length > 0 && (
                <p className="text-[11px] text-slate-500">
                  {anexosNovos.length} arquivo(s) selecionado(s) — enviados ao criar o pedido.
                </p>
              )}
            </div>
          )}

          {modoEdicao && (
            <div className="space-y-2 sm:col-span-2 rounded-md border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="mb-0 flex items-center gap-1">
                  <Paperclip className="w-3.5 h-3.5" /> Desenhos anexados
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={uploadandoAnexo}
                  onClick={() => anexoInputRef.current?.click()}
                >
                  {uploadandoAnexo ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                  Adicionar desenho
                </Button>
                <input
                  ref={anexoInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleAdicionarAnexoImediato(file)
                  }}
                />
              </div>
              {carregandoAnexos ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando anexos...
                </div>
              ) : anexosExistentes.length === 0 ? (
                <p className="text-xs text-slate-400 py-1">Nenhum desenho anexado ainda.</p>
              ) : (
                <ul className="space-y-1">
                  {anexosExistentes.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 text-xs bg-slate-50 rounded px-2 py-1.5"
                    >
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline truncate flex-1"
                      >
                        {a.nome_arquivo ?? 'Anexo'}
                      </a>
                      <button
                        type="button"
                        className="text-slate-400 hover:text-red-600 shrink-0"
                        disabled={removendoAnexoId === a.id}
                        onClick={() => handleRemoverAnexoImediato(a.id)}
                        title="Remover anexo"
                      >
                        {removendoAnexoId === a.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <X className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

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
              {modoEdicao ? 'Salvar alterações' : 'Criar pedido'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
