import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { gerarAtaSessao } from './gerarAtaSessao';
import { gerarAptosVotarPDF } from './gerarAptosVotarPDF';

// ════════════════════════════════════════════════════════════════════════
// PDF único: Edital de Convocação (Eleição da GLEMT) + Relação de Aptos a Votar
// O edital segue o texto do modelo (o mesmo do Word) e a relação mantém o
// padrão do PDF de Aptos, que é desenhado nas páginas seguintes.
// ════════════════════════════════════════════════════════════════════════

const AZUL = [30, 58, 138];
const DOURADO = [201, 168, 76];
const TEXTO = [30, 41, 59];

const fmt = (d) => (d ? String(d).substring(0, 10).split('-').reverse().join('/') : '');

// As fontes padrão do jsPDF não têm ∴ (nem ∴ de Ir∴): troca pelos três pontos em caracteres suportados
const pdfTexto = (t) => String(t ?? '').replace(/∴/g, '.·.').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');

export const gerarEditalAptosPDF = async ({ balaustre = null, conteudo = null, aptos = [], dadosLojaPDF = {}, logoB64, periodo, assinantes = {}, glemt = null, eleicao = {}, subtituloAptos = null, nomeArquivo = null }) => {
  // Texto do edital já interpolado: vem pronto (Loja) ou do modelo do balaustre (GLEMT)
  const ed = conteudo || await gerarAtaSessao({ balaustre, documento: 'edital', retornarTexto: true });

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 18;
  const dadosLoja = ed.dadosLoja || dadosLojaPDF || {};

  // ── Cabeçalho da Loja (mesmo do PDF de Aptos) ──────────────────────────
  let y = 12;
  if (logoB64) {
    try { doc.addImage(`data:image/jpeg;base64,${logoB64}`, 'JPEG', M, y, 30, 30); } catch (e) { /* sem logo */ }
  }
  const xt = M + 34 + (W - M - (M + 34)) / 2;
  doc.setFont('times', 'bold'); doc.setFontSize(12); doc.setTextColor(...AZUL);
  doc.text(`A.·.R.·.L.·.S.·. ACÁCIA DE PARANATINGA Nº ${dadosLoja.numero_loja || '30'}`, xt, y + 8, { align: 'center' });
  doc.setFont('times', 'normal'); doc.setFontSize(10); doc.setTextColor(...TEXTO);
  doc.text(`Fundada em ${dadosLoja.data_fundacao ? fmt(dadosLoja.data_fundacao) : '20/12/1997'}`, xt, y + 14, { align: 'center' });
  doc.text('Jurisdicionada à', xt, y + 19, { align: 'center' });
  doc.text('Grande Loja Maçônica do Estado de Mato Grosso', xt, y + 24, { align: 'center' });
  y += 36;
  doc.setDrawColor(...DOURADO); doc.setLineWidth(0.6); doc.line(M, y, W - M, y);
  y += 10;

  // ── Título do edital (cada linha do modelo vira uma linha) ─────────────
  doc.setFont('times', 'bold'); doc.setFontSize(13); doc.setTextColor(...AZUL);
  (ed.titulo || []).forEach((linha) => {
    const ls = doc.splitTextToSize(pdfTexto(linha), W - 2 * M);
    ls.forEach((l) => { doc.text(l, W / 2, y, { align: 'center' }); y += 6; });
  });
  if ((ed.subtitulo || []).length) {
    doc.setFont('times', 'normal'); doc.setFontSize(11); doc.setTextColor(...TEXTO);
    ed.subtitulo.forEach((linha) => {
      doc.splitTextToSize(pdfTexto(linha), W - 2 * M).forEach((l) => { doc.text(l, W / 2, y, { align: 'center' }); y += 5.5; });
    });
  }
  y += 4;

  // ── Corpo: parágrafos justificados; § = linha colada à anterior; *negrito* ──
  doc.setTextColor(...TEXTO); doc.setFontSize(11.5);
  const novaPagina = () => { doc.addPage(); y = 20; };
  (ed.paragrafos || []).forEach((bruto) => {
    const colado = bruto.startsWith('§');
    const linha = (colado ? bruto.slice(1) : bruto).trim();
    if (!linha) { y += 4; return; }
    const negrito = /^\*.*\*$/.test(linha);
    const texto = pdfTexto(negrito ? linha.replace(/^\*|\*$/g, '') : linha.replace(/\*/g, ''));
    doc.setFont('times', negrito ? 'bold' : 'normal');
    const largura = W - 2 * M;
    const ls = doc.splitTextToSize(texto, largura);
    // O jsPDF só justifica quando recebe o parágrafo inteiro (array de linhas);
    // linha a linha ele espaça as letras. Blocos § e parágrafos de uma linha ficam à esquerda.
    const justificar = !colado && ls.length > 1;
    let i = 0;
    while (i < ls.length) {
      if (y > H - 30) novaPagina();
      const cabem = Math.max(1, Math.floor((H - 30 - y) / 5.6));
      const parte = ls.slice(i, i + cabem);
      // a última linha do parágrafo nunca é esticada
      const ultima = i + parte.length >= ls.length ? parte.pop() : null;
      if (parte.length) {
        doc.text(parte, M, y, justificar ? { maxWidth: largura, align: 'justify', lineHeightFactor: 1.35 } : { lineHeightFactor: 1.35 });
        y += parte.length * 5.6;
      }
      if (ultima !== null) { doc.text(ultima, M, y); y += 5.6; }
      i += parte.length + (ultima !== null ? 1 : 0);
    }
    y += colado ? 0 : 3.4;
  });

  // ── Cidade e data do edital (antes da assinatura) ──────────────────────
  const MESES_PDF = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const dataEditalExtenso = (() => {
    const d = String(ed.dataEdital || ed.data_edital || '').substring(0, 10);
    if (!d) return '';
    const [a, m, di] = d.split('-').map(Number);
    return `${String(di).padStart(2, '0')} de ${MESES_PDF[m - 1]} de ${a}`;
  })();
  if (dataEditalExtenso || dadosLoja.cidade) {
    y += 10;
    if (y > H - 40) novaPagina();
    doc.setFont('times', 'normal'); doc.setFontSize(11.5); doc.setTextColor(...TEXTO);
    doc.text(pdfTexto(`${dadosLoja.cidade || 'Paranatinga'} – ${dadosLoja.estado || 'MT'}${dataEditalExtenso ? `, ${dataEditalExtenso}` : ''}.`), W / 2, y, { align: 'center' });
  }

  // ── Assinaturas do edital ──────────────────────────────────────────────
  y += 14;
  if (y > H - 40) novaPagina();
  (ed.assinaturas || []).forEach(({ nome, cargo }) => {
    doc.setDrawColor(...TEXTO); doc.setLineWidth(0.3);
    doc.line(W / 2 - 45, y, W / 2 + 45, y);
    doc.setFont('times', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...TEXTO);
    doc.text(pdfTexto(`Ir∴ ${String(nome || '').toUpperCase()}`), W / 2, y + 5, { align: 'center' });
    doc.setFont('times', 'normal');
    doc.text(pdfTexto(cargo || ''), W / 2, y + 10, { align: 'center' });
    y += 22;
  });

  // ── Relação de Aptos a Votar nas páginas seguintes (padrão do PDF atual) ──
  gerarAptosVotarPDF({
    tipo: 'aptos', linhas: aptos, eleicao, dadosLoja, logoB64, periodo, assinantes, glemt, subtitulo: subtituloAptos,
    docExistente: doc,
    nomeArquivo: nomeArquivo || `Edital_${String(ed.numeroEdital || '').replace('/', '-')}_e_Aptos_GLEMT_${String(ed.periodo || '').replace('/', '-')}.pdf`,
  });
};
