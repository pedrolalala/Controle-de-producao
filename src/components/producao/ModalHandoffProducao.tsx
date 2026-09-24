import { useEffect, useMemo, useState } from 'react'
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
import { Loader2, ClipboardCheck, AlertTriangle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  getUsuariosAtivos,
  registrarHandoff,
  type ProducaoPedidoRow,
  type UsuarioSimples,
} from '@/services/producao'

// SPEC-156 Módulo 1 — handoff com dupla assinatura (quem entrega / quem
// recebe), regra central que resolve a "bucha" de responsabilidade descrita
// pelo Vinícius. Os dois lados são OBRIGATÓRIOS JUNTOS — nunca salva com só
// um preenchido.
//
// SPEC-161 Prioridade 5 (reunião 22/09/2026) — decisão do usuário: "não
// importa por que vou criar o login de cada um quando for usar!" — os dois
// campos passam a ser FK real pra `usuarios` (sem fallback de texto livre),
// cada um restrito à lista fixa de pessoas definida na reunião:
// "Entregue por" = Manuel, João, Cláudio (produção); "Recebido por" =
// Mateus, Vitória, Alexandre, Leandro, Antônio, Vinícius.
//
// ATENÇÃO: confirmado no banco real (22/09/2026) que só "Vinícius" tem
// login em `usuarios` hoje — as outras 8 pessoas ainda não. Os selects
// abaixo só mostram quem já tem login; se a lista aparecer vazia/incompleta
// é porque o Hub ainda não criou o login dessa pessoa (decisão explícita do
// usuário foi criar os logins antes de usar o handoff — não reintroduzir
// texto livre aqui).

const ENTREGA_NOMES = ['Manuel', 'João', 'Cláudio']
const RECEBIMENTO_NOMES = ['Mateus', 'Vitória', 'Alexandre', 'Leandro', 'Antônio', 'Vinícius']

function normalizarNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

function filtrarPorNomes(usuarios: UsuarioSimples[], nomes: string[]): UsuarioSimples[] {
  const alvo = nomes.map(normalizarNome)
  return usuarios.filter((u) => alvo.includes(normalizarNome(u.nome)))
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  pedido: ProducaoPedidoRow | null
  onSuccess: () => void
}

export function ModalHandoffProducao({ open, onOpenChange, pedido, onSuccess }: Props) {
  const { toast } = useToast()
  const [usuarios, setUsuarios] = useState<UsuarioSimples[]>([])
  const [entreguePorId, setEntreguePorId] = useState('')
  const [recebidoPorId, setRecebidoPorId] = useState('')
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!open) return
    getUsuariosAtivos()
      .then(setUsuarios)
      .catch(() => {
        // silencioso — selects ficam vazios, usuário percebe ao tentar salvar
      })
  }, [open])

  useEffect(() => {
    if (!open) return
    setEntreguePorId('')
    setRecebidoPorId('')
    setObservacao('')
  }, [open, pedido?.id])

  const usuariosEntrega = useMemo(() => filtrarPorNomes(usuarios, ENTREGA_NOMES), [usuarios])
  const usuariosRecebimento = useMemo(
    () => filtrarPorNomes(usuarios, RECEBIMENTO_NOMES),
    [usuarios],
  )

  if (!pedido) return null

  const podeSalvar = !!entreguePorId && !!recebidoPorId

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!podeSalvar || !pedido) return
    const entregador = usuariosEntrega.find((u) => u.id === entreguePorId)
    const recebedor = usuariosRecebimento.find((u) => u.id === recebidoPorId)
    if (!entregador || !recebedor) return
    setSalvando(true)
    try {
      await registrarHandoff({
        producao_pedido_id: pedido.id,
        entregue_por_usuario_id: entregador.id,
        entregue_por_nome: entregador.nome,
        recebido_por_usuario_id: recebedor.id,
        recebido_por_nome: recebedor.nome,
        observacao: observacao || null,
      })
      toast({ title: 'Handoff registrado' })
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar handoff',
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
            <ClipboardCheck className="w-4 h-4 text-primary" />
            Registrar handoff (entrega/recebimento)
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <p className="text-xs text-slate-500">
            {pedido.numero_pedido ? `Pedido ${pedido.numero_pedido}` : 'Pedido sem número (Corte)'}
            {pedido.cliente_nome ? ` · ${pedido.cliente_nome}` : ''}
          </p>

          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            Os dois campos abaixo são obrigatórios juntos — não é possível registrar um handoff com
            apenas um lado preenchido.
          </p>

          <div className="space-y-2">
            <Label>Entregue por *</Label>
            <Select value={entreguePorId} onValueChange={setEntreguePorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {usuariosEntrega.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {usuariosEntrega.length === 0 && (
              <p className="text-[11px] text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                Nenhum login de {ENTREGA_NOMES.join(', ')} encontrado em Usuários ainda.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Recebido por *</Label>
            <Select value={recebidoPorId} onValueChange={setRecebidoPorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {usuariosRecebimento.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {usuariosRecebimento.length === 0 && (
              <p className="text-[11px] text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                Nenhum login de {RECEBIMENTO_NOMES.join(', ')} encontrado em Usuários ainda.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Observação</Label>
            <Textarea
              rows={2}
              className="resize-none"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
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
