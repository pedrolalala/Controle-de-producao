import { useState } from 'react'
import { Loader2, AlertOctagon, CheckCircle2, Camera } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  marcarOcorrenciaResolvida,
  OCORRENCIA_CATEGORIA_LABEL,
  type ProducaoPedidoOcorrenciaRow,
} from '@/services/producao'

// SPEC-162 — seção "Ocorrências" do painel expansível do pedido. Revisão
// 25/09/2026: mostra as fotos e permite marcar como resolvida informando a
// data em que isso aconteceu ("marcar a data de quando isso aconteceu").

interface Props {
  ocorrencias: ProducaoPedidoOcorrenciaRow[]
  loading: boolean
  onChange: () => void
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
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

export function OcorrenciasPanel({ ocorrencias, loading, onChange }: Props) {
  const { toast } = useToast()
  const [resolvendoId, setResolvendoId] = useState<string | null>(null)
  const [dataResolucao, setDataResolucao] = useState(today())
  const [salvando, setSalvando] = useState(false)

  const abertas = ocorrencias.filter((o) => !o.resolvida_em).length

  async function handleResolver(id: string) {
    setSalvando(true)
    try {
      await marcarOcorrenciaResolvida(id, dataResolucao)
      toast({ title: 'Ocorrência marcada como resolvida' })
      setResolvendoId(null)
      onChange()
    } catch (err: any) {
      toast({
        title: 'Erro ao marcar como resolvida',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="px-6 py-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
        <AlertOctagon className="w-3.5 h-3.5" /> Ocorrências
        {ocorrencias.length > 0 && (
          <span className="normal-case font-normal text-slate-400">
            ({abertas} em aberto de {ocorrencias.length})
          </span>
        )}
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...
        </div>
      ) : ocorrencias.length === 0 ? (
        <p className="text-xs text-slate-400 py-1">Nenhuma ocorrência registrada.</p>
      ) : (
        <ul className="space-y-2">
          {ocorrencias.map((o) => (
            <li key={o.id} className="text-xs text-slate-600 rounded-md border border-slate-200 bg-white p-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1 min-w-[200px]">
                  <span className="font-medium text-red-700">
                    {OCORRENCIA_CATEGORIA_LABEL[o.categoria] ?? o.categoria}
                  </span>
                  {' — '}
                  <span className="whitespace-pre-wrap">{o.descricao}</span>
                  <span className="text-slate-400">
                    {' '}
                    ({o.registrado_por_nome ?? 'usuário'} em {fmtDataHora(o.registrado_em)})
                  </span>
                </div>
                {o.resolvida_em ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Resolvida em {fmtDate(o.resolvida_em)}
                    {o.resolvido_por_nome ? ` por ${o.resolvido_por_nome}` : ''}
                  </span>
                ) : resolvendoId === o.id ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Input
                      type="date"
                      className="h-7 w-[140px] text-xs"
                      value={dataResolucao}
                      onChange={(e) => setDataResolucao(e.target.value)}
                    />
                    <Button
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={!dataResolucao || salvando}
                      onClick={() => handleResolver(o.id)}
                    >
                      {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirmar'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      disabled={salvando}
                      onClick={() => setResolvendoId(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 shrink-0"
                    onClick={() => {
                      setDataResolucao(today())
                      setResolvendoId(o.id)
                    }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Marcar como resolvida
                  </Button>
                )}
              </div>
              {o.fotos_urls.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <Camera className="w-3.5 h-3.5 text-slate-400" />
                  {o.fotos_urls.map((url, i) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer" title={`Foto ${i + 1}`}>
                      <img
                        src={url}
                        alt={`Foto ${i + 1} da ocorrência`}
                        className="h-12 w-12 rounded object-cover border border-slate-200 hover:opacity-80"
                      />
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
