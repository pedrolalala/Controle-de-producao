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
// SPEC-161 Prioridade 2 (reunião 22/09/2026): removida a opção "Alta" —
// "acho que a prioridade alta, acho que eu deixaria só normal e urgente,
// senão vai fazer confusão lá com os meninos". Confirmado no banco real
// (22/09/2026) que nenhum pedido existente usa 'alta' (só 'normal' e
// 'urgente'), então não há de-para necessário. O CHECK do banco continua
// aceitando 'alta' por segurança (dado histórico futuro improvável, mas
// não há motivo pra travar o banco por causa disso), só a UI não oferece
// mais essa opção.
export type PrioridadeProducao = 'normal' | 'urgente'

// SPEC-161 Prioridade 6 (reunião 22/09/2026): lista final de status
// discutida ao vivo com o Vinícius — "Pedido de Produção" é o status
// inicial (grava a data do pedido), "Pronto" é o final, e no meio existem
// ramos alternativos (nem todo pedido passa por todos). Continua texto
// livre no banco (sem CHECK) — a lista abaixo é só sugestão via <datalist>,
// mesmo padrão desde a SPEC-156 (dado sujo real na planilha original).
export const STATUS_SUGESTOES = [
  'pedido_de_producao',
  'aguardando_material',
  'com_terceiro',
  'pintura',
  'em_montagem',
  'embalagem',
  'pronto',
] as const

// Status legados (valores reais já usados antes da Prioridade 6 da
// SPEC-161) continuam válidos e com label pra exibição, só não entram mais
// em STATUS_SUGESTOES.
export const STATUS_LABEL: Record<string, string> = {
  pedido_de_producao: 'Pedido de Produção',
  aguardando_material: 'Aguardando Material',
  com_terceiro: 'Produção com Terceiro',
  pintura: 'Pintura',
  em_montagem: 'Em Montagem',
  embalagem: 'Embalagem',
  pronto: 'Pronto',
  // legados
  em_andamento: 'Em andamento',
  aguardando_pintura: 'Aguardando pintura',
  entrada_parcial: 'Entrada parcial',
  cancelado: 'Cancelado',
  excluido: 'Excluído',
}

// Status inicial de um pedido novo (SPEC-161 Prioridade 6).
export const STATUS_INICIAL = 'pedido_de_producao'

// Normaliza um status digitado livremente pra comparação (mesmo critério
// já usado em ModalAtualizarStatusProducao antes da SPEC-161).
export function normalizarStatus(status: string): string {
  return status.trim().toLowerCase().replace(/\s+/g, '_')
}

export const TIPO_PECA_LABEL: Record<TipoPecaProducao, string> = {
  lineas_steccas: 'Lineas e Steccas',
  peca_avulsa: 'Peças Avulsas',
  corte: 'Cortes (GAP - Slot - Vista)',
}

export const PRIORIDADE_LABEL: Record<PrioridadeProducao, string> = {
  normal: 'Normal',
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

// Usada nos campos de handoff (SPEC-161 Prioridade 5: agora restritos a
// listas fixas de pessoas via FK usuarios, ver ModalHandoffProducao.tsx) e
// na trilha de auditoria (empresa/edição).
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
  // SPEC-161: contagens usadas pra indicadores na listagem (P3/P8), sem
  // precisar de uma query extra por linha.
  anexos_count: number
  prazo_alteracoes_count: number
  // SPEC-162: indicador de ocorrências na listagem.
  ocorrencias_count: number
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
    .select(
      '*, empresas(nome), producao_pedido_anexos(count), producao_pedido_prazo_alteracoes(count), producao_pedido_ocorrencias(count)',
    )
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
    anexos_count: d.producao_pedido_anexos?.[0]?.count ?? 0,
    prazo_alteracoes_count: d.producao_pedido_prazo_alteracoes?.[0]?.count ?? 0,
    ocorrencias_count: d.producao_pedido_ocorrencias?.[0]?.count ?? 0,
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
  tipo: 'pedido' | 'desenho' | 'anexo',
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
      // SPEC-161 Prioridade 6: todo pedido novo nasce como "Pedido de
      // Produção" (status inicial do fluxo), em vez do antigo default
      // 'em_andamento' da coluna.
      status: STATUS_INICIAL,
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

// ---------------------------------------------------------------------
// SPEC-161 Prioridade 3 — anexos múltiplos (desenhos), separados,
// editáveis a qualquer momento (não só na criação).
// ---------------------------------------------------------------------

export interface ProducaoPedidoAnexoRow {
  id: string
  producao_pedido_id: string
  url: string
  nome_arquivo: string | null
  criado_em: string
  criado_por: string | null
}

export async function listarAnexos(producaoPedidoId: string): Promise<ProducaoPedidoAnexoRow[]> {
  const { data, error } = await (supabase as any)
    .from('producao_pedido_anexos')
    .select('*')
    .eq('producao_pedido_id', producaoPedidoId)
    .order('criado_em', { ascending: false })
  if (error) throw error
  return (data ?? []) as ProducaoPedidoAnexoRow[]
}

export async function adicionarAnexo(
  producaoPedidoId: string,
  file: File,
): Promise<ProducaoPedidoAnexoRow> {
  const url = await uploadArquivoProducao(file, producaoPedidoId, 'anexo')
  const { data: userData } = await supabase.auth.getUser()

  const { data: inserted, error } = await (supabase as any)
    .from('producao_pedido_anexos')
    .insert({
      producao_pedido_id: producaoPedidoId,
      url,
      nome_arquivo: file.name,
      criado_por: userData?.user?.id ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return inserted as ProducaoPedidoAnexoRow
}

export async function removerAnexo(anexoId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('producao_pedido_anexos')
    .delete()
    .eq('id', anexoId)
  if (error) throw error
}

// ---------------------------------------------------------------------
// SPEC-161 Prioridade 8 — histórico de alteração de prazo, com
// justificativa obrigatória.
// ---------------------------------------------------------------------

export interface ProducaoPedidoPrazoAlteracaoRow {
  id: string
  producao_pedido_id: string
  prazo_anterior: string | null
  prazo_novo: string | null
  motivo: string
  alterado_por: string | null
  alterado_por_nome: string | null
  alterado_em: string
}

export async function listarPrazoAlteracoes(
  producaoPedidoId: string,
): Promise<ProducaoPedidoPrazoAlteracaoRow[]> {
  const { data, error } = await (supabase as any)
    .from('producao_pedido_prazo_alteracoes')
    .select('*, usuarios:alterado_por(nome)')
    .eq('producao_pedido_id', producaoPedidoId)
    .order('alterado_em', { ascending: false })
  if (error) throw error
  return ((data ?? []) as any[]).map((d) => ({
    id: d.id,
    producao_pedido_id: d.producao_pedido_id,
    prazo_anterior: d.prazo_anterior,
    prazo_novo: d.prazo_novo,
    motivo: d.motivo,
    alterado_por: d.alterado_por,
    alterado_por_nome: d.usuarios?.nome ?? null,
    alterado_em: d.alterado_em,
  }))
}

// ---------------------------------------------------------------------
// SPEC-161 Prioridade 4 — editar pedido depois de criado, com trilha de
// auditoria (quem + quando).
// ---------------------------------------------------------------------

export interface ProducaoPedidoEdicaoRow {
  id: string
  producao_pedido_id: string
  editado_por: string | null
  editado_por_nome: string | null
  editado_em: string
}

export async function listarEdicoes(
  producaoPedidoId: string,
): Promise<ProducaoPedidoEdicaoRow[]> {
  const { data, error } = await (supabase as any)
    .from('producao_pedido_edicoes')
    .select('*, usuarios:editado_por(nome)')
    .eq('producao_pedido_id', producaoPedidoId)
    .order('editado_em', { ascending: false })
  if (error) throw error
  return ((data ?? []) as any[]).map((d) => ({
    id: d.id,
    producao_pedido_id: d.producao_pedido_id,
    editado_por: d.editado_por,
    editado_por_nome: d.usuarios?.nome ?? null,
    editado_em: d.editado_em,
  }))
}

export interface AtualizarProducaoPedidoInput {
  id: string
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
  // Obrigatório apenas quando data_prazo muda em relação ao valor
  // carregado (validado tanto aqui quanto na UI — defesa em profundidade).
  motivo_alteracao_prazo?: string | null
}

// SPEC-161 Prioridade 4 (editar pedido) + Prioridade 8 (justificativa
// obrigatória ao mudar prazo). Sem restrição de quem pode editar (decisão
// do usuário) — toda edição grava um registro em producao_pedido_edicoes
// (quem + quando); toda mudança de data_prazo (comparada ao valor anterior
// já salvo, `prazoAnterior`) grava um registro em
// producao_pedido_prazo_alteracoes com motivo obrigatório.
export async function atualizarProducaoPedido(
  input: AtualizarProducaoPedidoInput,
  prazoAnterior: string | null,
): Promise<void> {
  const prazoNovo = input.data_prazo || null
  const prazoMudou = prazoNovo !== (prazoAnterior || null)
  if (prazoMudou && !input.motivo_alteracao_prazo?.trim()) {
    throw new Error('Informe o motivo da alteração de prazo.')
  }

  const { data: userData } = await supabase.auth.getUser()
  const usuarioId = userData?.user?.id ?? null

  const updates: Record<string, unknown> = {
    tipo_peca: input.tipo_peca,
    numero_pedido: input.numero_pedido?.trim() || null,
    data_pedido: input.data_pedido,
    empresa_id: input.empresa_id,
    sistema_origem: input.tipo_peca === 'lineas_steccas' ? input.sistema_origem || null : null,
    arquiteto_nome: input.arquiteto_nome?.trim() || null,
    cliente_nome: input.cliente_nome?.trim() || null,
    data_prazo: prazoNovo,
    prioridade: input.prioridade,
    observacao: input.observacao?.trim() || null,
  }

  if (input.pdf_pedido) {
    updates.pdf_pedido_url = await uploadArquivoProducao(input.pdf_pedido, input.id, 'pedido')
  }

  const { error } = await (supabase as any)
    .from('producao_pedidos')
    .update(updates)
    .eq('id', input.id)
  if (error) throw error

  if (prazoMudou) {
    const { error: prazoError } = await (supabase as any)
      .from('producao_pedido_prazo_alteracoes')
      .insert({
        producao_pedido_id: input.id,
        prazo_anterior: prazoAnterior || null,
        prazo_novo: prazoNovo,
        motivo: input.motivo_alteracao_prazo!.trim(),
        alterado_por: usuarioId,
      })
    if (prazoError) throw prazoError
  }

  const { error: edicaoError } = await (supabase as any).from('producao_pedido_edicoes').insert({
    producao_pedido_id: input.id,
    editado_por: usuarioId,
  })
  if (edicaoError) throw edicaoError
}

// ---------------------------------------------------------------------
// SPEC-162 — ocorrências registradas pela produção (desenho errado,
// desenho incompleto, retrabalho de peça pronta...). Permitido em qualquer
// status do pedido, inclusive "Pronto" — não há checagem de status aqui.
// Append-only: sem editar/excluir pela aplicação.
// ---------------------------------------------------------------------

export const OCORRENCIA_CATEGORIAS = [
  'desenho_errado',
  'desenho_incompleto',
  'retrabalho_peca_pronta',
  'outro',
] as const

export const OCORRENCIA_CATEGORIA_LABEL: Record<string, string> = {
  desenho_errado: 'Desenho errado',
  desenho_incompleto: 'Desenho incompleto',
  retrabalho_peca_pronta: 'Retrabalho de peça pronta',
  outro: 'Outro',
}

export interface ProducaoPedidoOcorrenciaRow {
  id: string
  producao_pedido_id: string
  categoria: string
  descricao: string
  registrado_por: string | null
  registrado_por_nome: string | null
  registrado_em: string
}

export async function listarOcorrencias(
  producaoPedidoId: string,
): Promise<ProducaoPedidoOcorrenciaRow[]> {
  const { data, error } = await (supabase as any)
    .from('producao_pedido_ocorrencias')
    .select('*, usuarios:registrado_por(nome)')
    .eq('producao_pedido_id', producaoPedidoId)
    .order('registrado_em', { ascending: false })
  if (error) throw error
  return ((data ?? []) as any[]).map((d) => ({
    id: d.id,
    producao_pedido_id: d.producao_pedido_id,
    categoria: d.categoria,
    descricao: d.descricao,
    registrado_por: d.registrado_por,
    registrado_por_nome: d.usuarios?.nome ?? null,
    registrado_em: d.registrado_em,
  }))
}

export async function registrarOcorrencia(
  producaoPedidoId: string,
  categoria: string,
  descricao: string,
): Promise<void> {
  if (!categoria.trim() || !descricao.trim()) {
    throw new Error('Informe a categoria e a descrição da ocorrência.')
  }
  const { data: userData } = await supabase.auth.getUser()

  const { error } = await (supabase as any).from('producao_pedido_ocorrencias').insert({
    producao_pedido_id: producaoPedidoId,
    categoria: categoria.trim(),
    descricao: descricao.trim(),
    registrado_por: userData?.user?.id ?? null,
  })
  if (error) throw error
}
