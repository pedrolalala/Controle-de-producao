import { supabase } from '@/lib/supabase/client'

// SPEC-156 Módulo 1 — Controle de Produção. Réplica digital da planilha
// "CONTROLE DE PRODUÇÃO (1).xlsx" (3 abas: LINEAS E STECCAS / PEÇAS AVULSAS
// / CORTES (GAP - SLOT - VISTA)), com gestão de status em tempo real e
// handoff com dupla assinatura (quem entrega / quem recebe).
//
// producao_pedidos/producao_pedido_handoffs ainda não estão no types.ts
// gerado (tabelas novas) — segue o mesmo padrão já usado em
// notas-fiscais-compra.ts/devolucoes.ts: `(supabase as any)` nas chamadas
// que tocam essas tabelas.
//
// Sem vínculo com orcamentos/projeto_itens/estoque_itens (decisão
// explícita do Vinícius, reunião 16/09/2026) — cliente_nome e
// arquiteto_nome são texto livre.

export type TipoPecaProducao = 'lineas_steccas' | 'peca_avulsa' | 'corte'
export type PrioridadeProducao = 'normal' | 'alta' | 'urgente'

// Sugestões de status — texto livre no banco (sem CHECK), semeado a partir
// do dado real observado na planilha (PRONTO/CANCELADO/EXCLUÍDO/ENTRADA
// PARCIAL) + os status "vivos" descritos pelo Vinícius na reunião.
export const STATUS_SUGESTOES = [
  'em_andamento',
  'aguardando_pintura',
  'com_terceiro',
  'pronto',
  'entrada_parcial',
  'cancelado',
  'excluido',
] as const

export const STATUS_LABEL: Record<string, string> = {
  em_andamento: 'Em andamento',
  aguardando_pintura: 'Aguardando pintura',
  com_terceiro: 'Com terceiro',
  pronto: 'Pronto',
  entrada_parcial: 'Entrada parcial',
  cancelado: 'Cancelado',
  excluido: 'Excluído',
}

export const TIPO_PECA_LABEL: Record<TipoPecaProducao, string> = {
  lineas_steccas: 'Lineas e Steccas',
  peca_avulsa: 'Peças Avulsas',
  corte: 'Cortes (GAP - Slot - Vista)',
}

export const PRIORIDADE_LABEL: Record<PrioridadeProducao, string> = {
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
}

export interface Empresa {
  id: string
  nome: string
}

export async function getEmpresas(): Promise<Empresa[]> {
  const { data, error } = await (supabase as any).from('empresas').select('id, nome').order('nome')
  if (error) throw error
  return (data ?? []) as Empresa[]
}

export interface UsuarioSimples {
  id: string
  nome: string
}

// Usada nos campos de handoff/responsável — dropdown "melhor esforço" (nem
// todo funcionário citado na reunião tem login confirmado em usuarios,
// pendência aberta na SPEC-156). O nome digitado sempre é aceito mesmo sem
// bater com um usuário da lista (entregue_por_nome/recebido_por_nome são
// texto livre no banco).
export async function getUsuariosAtivos(): Promise<UsuarioSimples[]> {
  const { data, error } = await (supabase as any)
    .from('usuarios')
    .select('id, nome')
    .eq('ativo', true)
    .order('nome')
  if (error) throw error
  return (data ?? []) as UsuarioSimples[]
}

export interface ProducaoPedidoRow {
  id: string
  tipo_peca: TipoPecaProducao
  numero_pedido: string | null
  data_pedido: string
  empresa_id: string
  empresa_nome: string | null
  sistema_origem: string | null
  arquiteto_nome: string | null
  cliente_nome: string | null
  data_prazo: string | null
  prioridade: PrioridadeProducao
  status: string
  data_ficou_pronto: string | null
  observacao: string | null
  pdf_pedido_url: string | null
  pdf_desenho_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ListarProducaoPedidosFiltro {
  tipo_peca?: TipoPecaProducao
  status?: string
  empresa_id?: string
  prioridade?: PrioridadeProducao
  search?: string
}

export async function listarProducaoPedidos(
  filtro: ListarProducaoPedidosFiltro = {},
): Promise<ProducaoPedidoRow[]> {
  let query = (supabase as any)
    .from('producao_pedidos')
    .select('*, empresas(nome)')
    .order('data_pedido', { ascending: false })
    .limit(500)

  if (filtro.tipo_peca) query = query.eq('tipo_peca', filtro.tipo_peca)
  if (filtro.status) query = query.eq('status', filtro.status)
  if (filtro.empresa_id) query = query.eq('empresa_id', filtro.empresa_id)
  if (filtro.prioridade) query = query.eq('prioridade', filtro.prioridade)
  if (filtro.search && filtro.search.trim()) {
    const termo = filtro.search.trim()
    query = query.or(
      `numero_pedido.ilike.%${termo}%,cliente_nome.ilike.%${termo}%,arquiteto_nome.ilike.%${termo}%,observacao.ilike.%${termo}%`,
    )
  }

  const { data, error } = await query
  if (error) throw error

  return ((data ?? []) as any[]).map((d) => ({
    id: d.id,
    tipo_peca: d.tipo_peca,
    numero_pedido: d.numero_pedido,
    data_pedido: d.data_pedido,
    empresa_id: d.empresa_id,
    empresa_nome: d.empresas?.nome ?? null,
    sistema_origem: d.sistema_origem,
    arquiteto_nome: d.arquiteto_nome,
    cliente_nome: d.cliente_nome,
    data_prazo: d.data_prazo,
    prioridade: d.prioridade,
    status: d.status,
    data_ficou_pronto: d.data_ficou_pronto,
    observacao: d.observacao,
    pdf_pedido_url: d.pdf_pedido_url,
    pdf_desenho_url: d.pdf_desenho_url,
    created_by: d.created_by,
    created_at: d.created_at,
    updated_at: d.updated_at,
  }))
}

export interface CriarProducaoPedidoInput {
  tipo_peca: TipoPecaProducao
  numero_pedido?: string | null
  data_pedido: string
  empresa_id: string
  sistema_origem?: string | null
  arquiteto_nome?: string | null
  cliente_nome?: string | null
  data_prazo?: string | null
  prioridade: PrioridadeProducao
  observacao?: string | null
  pdf_pedido?: File | null
  pdf_desenho?: File | null
}

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
}

export async function uploadArquivoProducao(
  file: File,
  producaoPedidoId: string,
  tipo: 'pedido' | 'desenho',
): Promise<string> {
  const filePath = `${producaoPedidoId}/${tipo}-${Date.now()}-${sanitizeFileName(file.name)}`

  const { error } = await supabase.storage
    .from('producao_pedidos')
    .upload(filePath, file, { contentType: file.type || 'application/pdf', upsert: false })
  if (error) throw error

  const { data } = supabase.storage.from('producao_pedidos').getPublicUrl(filePath)
  return data.publicUrl
}

export async function criarProducaoPedido(input: CriarProducaoPedidoInput): Promise<string> {
  const { data: userData } = await supabase.auth.getUser()

  const { data: inserted, error } = await (supabase as any)
    .from('producao_pedidos')
    .insert({
      tipo_peca: input.tipo_peca,
      numero_pedido: input.numero_pedido?.trim() || null,
      data_pedido: input.data_pedido,
      empresa_id: input.empresa_id,
      sistema_origem: input.tipo_peca === 'lineas_steccas' ? input.sistema_origem || null : null,
      arquiteto_nome: input.arquiteto_nome?.trim() || null,
      cliente_nome: input.cliente_nome?.trim() || null,
      data_prazo: input.data_prazo || null,
      prioridade: input.prioridade,
      observacao: input.observacao?.trim() || null,
      created_by: userData?.user?.id ?? null,
    })
    .select('id')
    .single()
  if (error) throw error

  const producaoPedidoId = inserted.id as string

  // Upload dos PDFs depois do insert, porque o path usa o id do pedido
  // (mesmo padrão de notas-fiscais-compra.ts).
  const updates: Record<string, string> = {}
  if (input.pdf_pedido) {
    updates.pdf_pedido_url = await uploadArquivoProducao(
      input.pdf_pedido,
      producaoPedidoId,
      'pedido',
    )
  }
  if (input.pdf_desenho) {
    updates.pdf_desenho_url = await uploadArquivoProducao(
      input.pdf_desenho,
      producaoPedidoId,
      'desenho',
    )
  }
  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await (supabase as any)
      .from('producao_pedidos')
      .update(updates)
      .eq('id', producaoPedidoId)
    if (updateError) throw updateError
  }

  return producaoPedidoId
}

export async function atualizarStatusProducaoPedido(id: string, status: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('producao_pedidos')
    .update({ status: status.trim() })
    .eq('id', id)
  if (error) throw error
}

export async function marcarProducaoPedidoPronto(
  id: string,
  dataFicouPronto: string,
): Promise<void> {
  const { error } = await (supabase as any)
    .from('producao_pedidos')
    .update({ status: 'pronto', data_ficou_pronto: dataFicouPronto })
    .eq('id', id)
  if (error) throw error
}

export interface ProducaoPedidoHandoffRow {
  id: string
  producao_pedido_id: string
  entregue_por_usuario_id: string | null
  entregue_por_nome: string
  recebido_por_usuario_id: string | null
  recebido_por_nome: string
  data_hora: string
  observacao: string | null
}

export async function listarHandoffs(
  producaoPedidoId: string,
): Promise<ProducaoPedidoHandoffRow[]> {
  const { data, error } = await (supabase as any)
    .from('producao_pedido_handoffs')
    .select('*')
    .eq('producao_pedido_id', producaoPedidoId)
    .order('data_hora', { ascending: false })
  if (error) throw error
  return (data ?? []) as ProducaoPedidoHandoffRow[]
}

export interface RegistrarHandoffInput {
  producao_pedido_id: string
  entregue_por_usuario_id?: string | null
  entregue_por_nome: string
  recebido_por_usuario_id?: string | null
  recebido_por_nome: string
  observacao?: string | null
}

// Regra central da SPEC-156 (resolve a "bucha" de responsabilidade): um
// handoff só é salvo com "entregue por" E "recebido por" preenchidos, nunca
// só um lado. Validação repetida aqui (defesa em profundidade) além da UI,
// já que entregue_por_nome/recebido_por_nome são NOT NULL no banco mas isso
// sozinho não impede string vazia.
export async function registrarHandoff(input: RegistrarHandoffInput): Promise<void> {
  const entreguePorNome = input.entregue_por_nome.trim()
  const recebidoPorNome = input.recebido_por_nome.trim()
  if (!entreguePorNome || !recebidoPorNome) {
    throw new Error('Handoff exige "entregue por" e "recebido por" preenchidos juntos.')
  }

  const { error } = await (supabase as any).from('producao_pedido_handoffs').insert({
    producao_pedido_id: input.producao_pedido_id,
    entregue_por_usuario_id: input.entregue_por_usuario_id || null,
    entregue_por_nome: entreguePorNome,
    recebido_por_usuario_id: input.recebido_por_usuario_id || null,
    recebido_por_nome: recebidoPorNome,
    observacao: input.observacao?.trim() || null,
  })
  if (error) throw error
}
