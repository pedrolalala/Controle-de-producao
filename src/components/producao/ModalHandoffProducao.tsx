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
import { Loader2, ClipboardCheck } from 'lucide-react'
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
// entregue_por_usuario_id/recebido_por_usuario_id são "melhor esforço":
// se o nome digitado bater exatamente com um usuário ativo, o id é
// resolvido junto; senão fica nulo e só o nome (texto livre) é gravado —
// nem todo funcionário citado na reunião (Cláudio/João/Manoel/Antônio/
// Leandro/Alexandre/Matheus) tem login confirmado (pendência da SPEC-156).

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  pedido: ProducaoPedidoRow | null
  onSuccess: () => void
}

export function ModalHandoffProducao({ open, onOpenChange, pedido, onSuccess }: Props) {
  const { toast } = useToast()
  const [usuarios, setUsuarios] = useState<UsuarioSimples[]>([])
  const [entreguePorNome, setEntreguePorNome] = useState('')
  const [recebidoPorNome, setRecebidoPorNome] = useState('')
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!open) return
    getUsuariosAtivos()
      .then(setUsuarios)
      .catch(() => {
        // silencioso — segue funcionando com texto livre sem sugestões
      })
  }, [open])

  useEffect(() => {
    if (!open) return
    setEntreguePorNome('')
    setRecebidoPorNome('')
    setObservacao('')
  }, [open, pedido?.id])

  if (!pedido) return null

  function resolverUsuarioId(nome: string): string | null {
    const match = usuarios.find((u) => u.nome.trim().toLowerCase() === nome.trim().toLowerCase())
    return match?.id ?? null
  }

  const podeSalvar = !!entreguePorNome.trim() && !!recebidoPorNome.trim()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!podeSalvar || !pedido) return
    setSalvando(true)
    try {
      await registrarHandoff({
        producao_pedido_id: pedido.id,
        entregue_por_usuario_id: resolverUsuarioId(entreguePorNome),
        entregue_por_nome: entreguePorNome,
        recebido_por_usuario_id: resolverUsuarioId(recebidoPorNome),
        recebido_por_nome: recebidoPorNome,
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
            <Input
              list="usuarios-producao"
              required
              value={entreguePorNome}
              onChange={(e) => setEntreguePorNome(e.target.value)}
              placeholder="Nome de quem está entregando..."
            />
          </div>

          <div className="space-y-2">
            <Label>Recebido por *</Label>
            <Input
              list="usuarios-producao"
              required
              value={recebidoPorNome}
              onChange={(e) => setRecebidoPorNome(e.target.value)}
              placeholder="Nome de quem está recebendo..."
            />
          </div>

          <datalist id="usuarios-producao">
            {usuarios.map((u) => (
              <option key={u.id} value={u.nome} />
            ))}
          </datalist>

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
