// Leitura (Word, PDF, texto) e exportação (Word, PDF) do projeto (F19/F20).
// Tudo roda no navegador: o arquivo nunca sai do aparelho. Bibliotecas carregadas sob demanda.
import { LACUNA } from '../motor/modelos-texto.js';
import { chaveDoTitulo } from '../motor/leitor-projeto.js';

const MAX_BYTES = 15 * 1024 * 1024;

/** Lê um arquivo do usuário e devolve blocos [{ texto, titulo?, nivel? }]. */
export async function lerArquivoProjeto(arquivo) {
  if (arquivo.size > MAX_BYTES) throw new Error('Arquivo maior que 15 MB. Salve uma versão sem imagens e tente de novo.');
  const nome = arquivo.name.toLowerCase();
  const dados = await arquivo.arrayBuffer();
  if (nome.endsWith('.docx')) return lerDocx(dados);
  if (nome.endsWith('.pdf')) return lerPdf(dados);
  if (nome.endsWith('.txt') || nome.endsWith('.md')) return new TextDecoder().decode(dados).split(/\r?\n/).map((l) => ({ texto: l.replace(/^#+\s*/, ''), titulo: /^#+\s/.test(l) || undefined }));
  if (nome.endsWith('.doc')) throw new Error('Formato .doc antigo: no Word, use "Salvar como" → Documento do Word (.docx) e envie de novo.');
  throw new Error('Envie um arquivo Word (.docx), PDF ou texto (.txt).');
}

async function lerDocx(dados) {
  const mammoth = (await import('mammoth/mammoth.browser.js')).default;
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: dados }, { convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: '' })) });
  // DOMParser só lê a estrutura; nada desse HTML é inserido na página.
  const dom = new DOMParser().parseFromString(html, 'text/html');
  const blocos = [];
  for (const no of dom.body.children) {
    const tag = no.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) blocos.push({ texto: no.textContent, titulo: true, nivel: Number(tag[1]) > 1 ? 2 : 1 });
    else if (tag === 'p') {
      const texto = no.textContent;
      const negrito = no.children.length > 0 && [...no.childNodes].every((c) => (c.nodeType === 3 && !c.textContent.trim()) || ['STRONG', 'B'].includes(c.nodeName));
      blocos.push({ texto, titulo: negrito && texto.trim().length <= 90 && !/[.;]$/.test(texto.trim()) ? true : undefined });
    } else if (tag === 'ul' || tag === 'ol') for (const li of no.querySelectorAll('li')) blocos.push({ texto: li.textContent });
    else if (tag === 'table') for (const tr of no.querySelectorAll('tr')) blocos.push({ texto: [...tr.children].map((c) => c.textContent.trim()).join(' | ') });
    else blocos.push({ texto: no.textContent });
  }
  return blocos;
}

async function lerPdf(dados) {
  const pdfjs = await import('pdfjs-dist');
  const { default: urlWorker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = urlWorker;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(dados), isEvalSupported: false }).promise;
  const blocos = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const pagina = await pdf.getPage(n);
    const { items } = await pagina.getTextContent();
    // Agrupa os pedaços de texto em linhas pela altura (y).
    const linhas = [];
    for (const it of items) {
      if (!it.str?.trim() && !it.hasEOL) continue;
      const y = Math.round(it.transform[5]);
      let l = linhas.find((x) => Math.abs(x.y - y) <= 2);
      if (!l) { l = { y, partes: [], altura: Math.abs(it.transform[3]) || 10, negrito: true }; linhas.push(l); }
      l.partes.push({ x: it.transform[4], s: it.str });
      if (!/bold|black|heavy|semibold/i.test(it.fontName || '') && it.str.trim()) l.negrito = false;
    }
    linhas.sort((a, b) => b.y - a.y);
    let paragrafo = '', ultimaY = null, altura = 12;
    const fechar = () => { if (paragrafo.trim()) blocos.push({ texto: paragrafo.trim() }); paragrafo = ''; };
    for (const l of linhas) {
      const texto = l.partes.sort((a, b) => a.x - b.x).map((p) => p.s).join('').replace(/\s+/g, ' ').trim();
      if (!texto || /^\d{1,3}$/.test(texto)) continue; // número de página
      altura = l.altura || altura;
      const salto = ultimaY !== null && ultimaY - l.y > altura * 1.8;
      ultimaY = l.y;
      const pareceTitulo = texto.length <= 90 && !/[.;,]$/.test(texto) && (l.negrito || texto === texto.toUpperCase() || Boolean(chaveDoTitulo(texto)));
      if (pareceTitulo) { fechar(); blocos.push({ texto, titulo: l.negrito || chaveDoTitulo(texto) ? true : undefined }); continue; }
      if (salto) fechar();
      paragrafo = paragrafo.endsWith('-') ? paragrafo.slice(0, -1) + texto : `${paragrafo} ${texto}`;
      if (/[.:;]$/.test(texto) && texto.length < 60) fechar();
    }
    fechar();
  }
  if (!blocos.some((b) => b.texto.length > 40)) throw new Error('Não encontrei texto neste PDF. Ele parece ser uma imagem escaneada: envie o arquivo Word ou um PDF gerado pelo editor de texto.');
  return blocos;
}

// ---------- Exportação ----------
/** documento de saída: { titulo, meta, modelo, preambulo: [p], secoes: [{ titulo, nivel, paragrafos: [{ texto, marca }] }] } */
const ehTabela = (t) => t.split(' | ').length >= 3;

function agruparTabelas(paragrafos) {
  const saida = [];
  for (const p of paragrafos) {
    if (ehTabela(p.texto)) {
      const ult = saida.at(-1);
      if (ult?.tabela) ult.linhas.push(p); else saida.push({ tabela: true, linhas: [p] });
    } else saida.push(p);
  }
  return saida;
}

export async function exportarDocx(doc, { marcar = true } = {}) {
  const D = await import('docx');
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType } = D;
  const cm = (x) => Math.round(x * 567);
  const abnt = doc.modelo === 'abnt';
  const runs = (texto, marca, extra = {}) => {
    const destaque = marcar && marca ? 'yellow' : undefined;
    return String(texto).split(/(\[[^\]]{2,200}\])/).filter(Boolean).map((pedaco) => new TextRun({
      text: pedaco, font: 'Times New Roman', size: 24, highlight: (marcar && /^\[.*\]$/.test(pedaco)) ? 'cyan' : destaque, ...extra,
    }));
  };
  const filhos = [];
  const m = doc.meta || {};
  if (abnt && (m.instituicao || m.autor)) {
    const centro = (t, extra = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: t, font: 'Times New Roman', size: 24, bold: true, ...extra })] });
    if (m.instituicao) filhos.push(centro(m.instituicao.toUpperCase()));
    if (m.programa) filhos.push(centro(m.programa.toUpperCase(), { bold: false }));
    filhos.push(new Paragraph({ spacing: { before: cm(4) }, children: [] }));
    if (m.autor) filhos.push(centro(m.autor.toUpperCase(), { bold: false }));
    filhos.push(new Paragraph({ spacing: { before: cm(3) }, children: [] }));
    filhos.push(centro((doc.titulo || m.titulo || 'Projeto de pesquisa').toUpperCase(), { size: 28 }));
    if (m.orientador) filhos.push(centro(`Orientador(a): ${m.orientador}`, { bold: false }));
    filhos.push(new Paragraph({ spacing: { before: cm(5) }, children: [] }));
    filhos.push(centro([m.cidade, m.ano].filter(Boolean).join('\n') || ' ', { bold: false }));
    filhos.push(new Paragraph({ pageBreakBefore: true, children: [] }));
  } else {
    filhos.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 }, children: [new TextRun({ text: (doc.titulo || m.titulo || 'Projeto de pesquisa').toUpperCase(), font: 'Times New Roman', size: 28, bold: true })] }));
    const autoria = [m.autor, m.orientador && `Orientador(a): ${m.orientador}`, m.instituicao].filter(Boolean).join(' · ');
    if (autoria) filhos.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 }, children: [new TextRun({ text: autoria, font: 'Times New Roman', size: 22 })] }));
  }
  for (const p of doc.preambulo || []) filhos.push(new Paragraph({ alignment: AlignmentType.CENTER, children: runs(p.texto, p.marca) }));
  const ehRef = (s) => /refer[eê]ncias|bibliografia/i.test(s.titulo);
  for (const s of doc.secoes) {
    filhos.push(new Paragraph({ heading: s.nivel > 1 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_1, spacing: { before: 360, after: 180 },
      children: [new TextRun({ text: s.nivel > 1 ? s.titulo : s.titulo.toUpperCase(), font: 'Times New Roman', size: 24, bold: true, color: '000000', highlight: marcar && s.nova ? 'yellow' : undefined })] }));
    for (const item of agruparTabelas(s.paragrafos)) {
      if (item.tabela) {
        const ncol = Math.max(...item.linhas.map((l) => l.texto.split(' | ').length));
        filhos.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: item.linhas.map((l, i) => new TableRow({ children: Array.from({ length: ncol }, (_, k) => new TableCell({ children: [new Paragraph({ children: runs(l.texto.split(' | ')[k] ?? '', l.marca, { size: 20, bold: i === 0 }) })] })) })) }));
        filhos.push(new Paragraph({ children: [] }));
      } else filhos.push(new Paragraph({ alignment: ehRef(s) ? AlignmentType.LEFT : AlignmentType.JUSTIFIED, spacing: { line: ehRef(s) ? 240 : 360, after: ehRef(s) ? 240 : 120 }, indent: ehRef(s) ? undefined : { firstLine: cm(1.25) }, children: runs(item.texto, item.marca) }));
    }
  }
  const documento = new Document({
    creator: 'Pharma_estat', title: doc.titulo || 'Projeto de pesquisa',
    styles: { default: { document: { run: { font: 'Times New Roman', size: 24 } } } },
    sections: [{ properties: { page: { margin: { top: cm(3), left: cm(3), bottom: cm(2), right: cm(2) } } }, children: filhos }],
  });
  return Packer.toBlob(documento);
}

// jsPDF usa fontes-padrão (WinAnsi): troca símbolos que elas não têm.
const TROCAS_PDF = { 'α': 'alfa', 'β': 'beta', 'χ': 'qui', 'Δ': 'delta', 'σ': 'DP', '≥': '>=', '≤': '<=', '≈': '~', '√': 'raiz de ', '→': '->', '₁': '1', '₂': '2', '−': '-', ' ': ' ', ' ': ' ' };
const limparPdf = (s) => String(s).replace(/[αβχΔσ≥≤≈√→₁₂−  ]/g, (c) => TROCAS_PDF[c]).replace(/[^\x20-\x7E -ÿ–—‘’“”•…]/g, '?');

export async function exportarPdf(doc, { marcar = true } = {}) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = { e: 30, d: 20, t: 30, b: 20 };
  const largura = 210 - M.e - M.d;
  let y = M.t;
  const linha = 6.2;
  const novaPagina = () => { pdf.addPage(); y = M.t; };
  const escrever = (texto, { negrito = false, tamanho = 12, centro = false, recuo = 0, marca = null } = {}) => {
    pdf.setFont('times', negrito ? 'bold' : 'normal'); pdf.setFontSize(tamanho);
    const linhas = pdf.splitTextToSize(limparPdf(texto), largura - recuo);
    for (const [i, l] of linhas.entries()) {
      if (y > 297 - M.b) novaPagina();
      if (marcar && marca) { pdf.setFillColor(255, 241, 168); pdf.rect(M.e - 1, y - 4.4, largura + 2, linha, 'F'); }
      if (marcar && /\[/.test(l)) { pdf.setFillColor(204, 236, 255); pdf.rect(M.e + (i === 0 ? recuo : 0) - 0.5, y - 4.4, Math.min(largura, pdf.getTextWidth(l) + 1), linha, 'F'); }
      pdf.text(l, centro ? 105 : M.e + (i === 0 ? recuo : 0), y, { align: centro ? 'center' : 'left' });
      y += linha;
    }
  };
  const m = doc.meta || {};
  escrever((doc.titulo || m.titulo || 'Projeto de pesquisa').toUpperCase(), { negrito: true, tamanho: 14, centro: true });
  const autoria = [m.autor, m.orientador && `Orientador(a): ${m.orientador}`, m.instituicao].filter(Boolean).join(' · ');
  if (autoria) escrever(autoria, { tamanho: 11, centro: true });
  y += 4;
  for (const s of doc.secoes) {
    y += 3; if (y > 297 - M.b - 15) novaPagina();
    escrever(s.nivel > 1 ? s.titulo : s.titulo.toUpperCase(), { negrito: true, marca: s.nova ? 'novo' : null });
    y += 1;
    for (const item of agruparTabelas(s.paragrafos)) {
      if (item.tabela) {
        const ncol = Math.max(...item.linhas.map((l) => l.texto.split(' | ').length));
        const larg = largura / ncol;
        for (const [i, l] of item.linhas.entries()) {
          if (y > 297 - M.b) novaPagina();
          pdf.setFont('times', i === 0 ? 'bold' : 'normal'); pdf.setFontSize(10);
          if (marcar && l.marca) { pdf.setFillColor(255, 241, 168); pdf.rect(M.e, y - 4, largura, 5.6, 'F'); }
          l.texto.split(' | ').forEach((c, k) => pdf.text(pdf.splitTextToSize(limparPdf(c), larg - 2)[0] || '', M.e + k * larg + 1, y));
          pdf.setDrawColor(200); pdf.line(M.e, y + 1.6, M.e + largura, y + 1.6);
          y += 5.6;
        }
        y += 2;
      } else { escrever(item.texto, { recuo: /refer/i.test(s.titulo) ? 0 : 12.5, marca: item.marca }); y += 1.5; }
    }
  }
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) { pdf.setPage(i); pdf.setFont('times', 'normal'); pdf.setFontSize(9); pdf.setTextColor(120); pdf.text(`${i}`, 210 - M.d, 15, { align: 'right' }); pdf.setTextColor(0); }
  return pdf.output('blob');
}

export function baixarBlob(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome; a.rel = 'noopener';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
export const nomeArquivo = (titulo, ext, sufixo = '') => `${String(titulo || 'projeto').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 45).replace(/^_|_$/g, '') || 'projeto'}${sufixo}.${ext}`;
export const contarLacunas = (doc) => [...(doc.preambulo || []), ...doc.secoes.flatMap((s) => s.paragrafos)].reduce((n, p) => n + (p.texto.match(LACUNA) || []).length, 0);
