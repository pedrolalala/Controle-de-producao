// SPEC-329 (solicitação 6df28efe, Debora/Sr. Claudio): abrir o pedido e todos os desenhos num ÚNICO PDF.
// `juntarEmUmPdf` não depende do navegador (testável em Node); `abrirPedidoEDesenhos` faz o download, a junção
// e a abertura da aba.
import type { PDFDocument as TPDFDocument } from 'pdf-lib'

export interface ParteArquivo {
  nome: string
  bytes: Uint8Array
}

export interface FalhaArquivo {
  nome: string
  motivo: string
}

export interface ResultadoJuncao {
  bytes: Uint8Array
  paginas: number
  incluidos: string[]
  falhas: FalhaArquivo[]
}

type Tipo = 'pdf' | 'png' | 'jpg' | 'outro'

/** Reconhece pelo conteúdo (a extensão do arquivo enviado nem sempre é confiável). */
export function tipoDoArquivo(b: Uint8Array): Tipo {
  if (b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf'
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png'
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  return 'outro'
}

const A4 = { w: 595.28, h: 841.89 }
const MARGEM = 28

async function adicionarImagem(pdf: TPDFDocument, bytes: Uint8Array, tipo: 'png' | 'jpg') {
  const img = tipo === 'png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)
  // desenho mais largo que alto sai em página paisagem
  const paisagem = img.width > img.height * 1.1
  const pw = paisagem ? A4.h : A4.w
  const ph = paisagem ? A4.w : A4.h
  const escala = Math.min((pw - 2 * MARGEM) / img.width, (ph - 2 * MARGEM) / img.height)
  const w = img.width * escala
  const h = img.height * escala
  const page = pdf.addPage([pw, ph])
  page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
}

/**
 * Junta, na ordem recebida, PDFs (página a página) e imagens (uma página cada) num só PDF.
 * `converterImagem` (só no navegador) transforma WebP/outros em PNG; sem ele, o arquivo é pulado.
 * Arquivo que falhar não derruba os outros: vai em `falhas`.
 */
export async function juntarEmUmPdf(
  partes: ParteArquivo[],
  converterImagem?: (bytes: Uint8Array) => Promise<Uint8Array>,
): Promise<ResultadoJuncao> {
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const incluidos: string[] = []
  const falhas: FalhaArquivo[] = []

  for (const parte of partes) {
    try {
      let tipo = tipoDoArquivo(parte.bytes)
      let bytes = parte.bytes
      if (tipo === 'outro' && converterImagem) {
        bytes = await converterImagem(parte.bytes)
        tipo = tipoDoArquivo(bytes)
      }
      if (tipo === 'pdf') {
        let paginas: Awaited<ReturnType<TPDFDocument['copyPages']>>
        try {
          const origem = await PDFDocument.load(bytes, { ignoreEncryption: true })
          paginas = await pdf.copyPages(origem, origem.getPageIndices())
        } catch {
          throw new Error('PDF danificado ou protegido contra leitura')
        }
        if (paginas.length === 0) throw new Error('PDF sem páginas')
        paginas.forEach((p) => pdf.addPage(p))
      } else if (tipo === 'png' || tipo === 'jpg') {
        try {
          await adicionarImagem(pdf, bytes, tipo)
        } catch {
          throw new Error('imagem danificada')
        }
      } else {
        throw new Error('formato não suportado (não é PDF, PNG nem JPG)')
      }
      incluidos.push(parte.nome)
    } catch (e: any) {
      falhas.push({ nome: parte.nome, motivo: e?.message || 'erro ao ler o arquivo' })
    }
  }

  const bytes = await pdf.save()
  return { bytes, paginas: pdf.getPageCount(), incluidos, falhas }
}

// ---------------------------------------------------------------------------------------------
// Navegador
// ---------------------------------------------------------------------------------------------

async function baixarBytes(url: string): Promise<Uint8Array> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return new Uint8Array(await r.arrayBuffer())
}

/** WebP/outras imagens do navegador -> PNG, via canvas. */
async function converterImagemParaPng(bytes: Uint8Array): Promise<Uint8Array> {
  const bmp = await createImageBitmap(new Blob([bytes as BlobPart]))
  const canvas = document.createElement('canvas')
  canvas.width = bmp.width
  canvas.height = bmp.height
  canvas.getContext('2d')!.drawImage(bmp, 0, 0)
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'))
  if (!blob) throw new Error('não foi possível converter a imagem')
  return new Uint8Array(await blob.arrayBuffer())
}

export interface ArquivoDoPedido {
  nome: string
  url: string
}

/** Lista na ordem: pedido, desenho antigo, anexos (do mais antigo para o mais novo). */
export function arquivosDoPedido(
  pedido: { pdf_pedido_url: string | null; pdf_desenho_url: string | null },
  anexos: { url: string; nome_arquivo: string | null; criado_em: string }[],
): ArquivoDoPedido[] {
  const lista: ArquivoDoPedido[] = []
  if (pedido.pdf_pedido_url) lista.push({ nome: 'Pedido', url: pedido.pdf_pedido_url })
  if (pedido.pdf_desenho_url) lista.push({ nome: 'Desenho (antigo)', url: pedido.pdf_desenho_url })
  ;[...anexos]
    .sort((a, b) => a.criado_em.localeCompare(b.criado_em))
    .forEach((a, i) => lista.push({ nome: a.nome_arquivo || `Anexo ${i + 1}`, url: a.url }))
  return lista
}

/**
 * Abre o PDF único. A aba é aberta ANTES do download (o clique ainda vale) para o navegador não bloquear;
 * se mesmo assim não abrir, baixa o arquivo. Retorna o que não entrou, para o aviso.
 */
export async function abrirPedidoEDesenhos(
  arquivos: ArquivoDoPedido[],
  nomeArquivo: string,
): Promise<{ paginas: number; falhas: FalhaArquivo[] }> {
  const janela = window.open('', '_blank')
  if (janela) {
    janela.document.write(
      '<title>Gerando PDF...</title><body style="font-family:sans-serif;padding:24px">Juntando o pedido e os desenhos...</body>',
    )
  }
  try {
    const baixados: ParteArquivo[] = []
    const falhasDownload: FalhaArquivo[] = []
    for (const a of arquivos) {
      try {
        baixados.push({ nome: a.nome, bytes: await baixarBytes(a.url) })
      } catch (e: any) {
        falhasDownload.push({ nome: a.nome, motivo: `não foi possível baixar (${e?.message || 'erro'})` })
      }
    }
    const r = await juntarEmUmPdf(baixados, converterImagemParaPng)
    if (r.paginas === 0) throw new Error('nenhum arquivo pôde ser incluído')
    const url = URL.createObjectURL(new Blob([r.bytes as BlobPart], { type: 'application/pdf' }))
    if (janela) {
      janela.location.href = url
    } else {
      const a = document.createElement('a')
      a.href = url
      a.download = nomeArquivo
      a.click()
    }
    setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000)
    return { paginas: r.paginas, falhas: [...falhasDownload, ...r.falhas] }
  } catch (e) {
    janela?.close()
    throw e
  }
}
