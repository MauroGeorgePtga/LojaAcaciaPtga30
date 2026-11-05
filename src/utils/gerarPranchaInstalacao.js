import {
  Document, Packer, Paragraph, TextRun, AlignmentType, Footer, PageNumber,
} from 'docx';
import jsPDF from 'jspdf';
import { supabase } from '../supabaseClient';
import { cabecalhoLojaDocx } from './cabecalhoLoja';
import { LOGO_LOJA_B64 } from './logoLoja';

// ════════════════════════════════════════════════════════════════════════
// PRANCHA — Requerimento de Instalação à GLEMT
// Puxa tudo da eleição escolhida: edital, balaústre, datas e o Venerável
// eleito. Assina o Venerável SAINTE (quem conduziu a eleição).
// ════════════════════════════════════════════════════════════════════════

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const dataBR = (d) => (d ? String(d).substring(0, 10).split('-').reverse().join('/') : '');
const dataExtenso = (d) => {
  const s = String(d || '').substring(0, 10);
  if (!s) return '';
  const [a, m, di] = s.split('-').map(Number);
  return `${String(di).padStart(2, '0')} de ${MESES[m - 1]} de ${a}`;
};
const hora = (h) => String(h || '').substring(0, 5);

export const CORPO_PADRAO_INSTALACAO =
  'O Venerável Mestre da Augusta e Respeitável Loja Simbólica {nome_loja}, no uso de suas atribuições, '
  + 'vem, respeitosamente, à presença de Vossa Sereníssima, requerer a designação de Comissão Instaladora '
  + 'para a instalação e posse do Venerável Mestre eleito para a gestão {gestao}.\n'
  + 'Os trabalhos eleitorais realizaram-se em Sessão Ordinária de Eleição no dia {data_eleicao}, '
  + 'convocada pelo Edital nº {numero_edital}, de {data_edital}, e registrada no Balaústre nº {numero_balaustre}, '
  + 'tendo sido eleito Venerável Mestre o Ir∴ *{vm_eleito}*.\n'
  + 'A sessão de posse está prevista para o dia {data_posse}, às {hora_posse} horas, no Templo desta Oficina.\n'
  + '{comissao_instaladora}\n'
  + 'Na certeza do atendimento, renovamos os protestos de elevada estima e fraterno apreço.';

// Monta as variáveis a partir da eleição escolhida
export const dadosDaEleicao = async (eleicaoId) => {
  const [{ data: el }, { data: loja }] = await Promise.all([
    supabase.from('eleicoes').select('*').eq('id', eleicaoId).maybeSingle(),
    supabase.from('dados_loja').select('*').limit(1),
  ]);
  if (!el) throw new Error('eleição não encontrada.');
  const dadosLoja = (loja && loja[0]) || {};

  // Venerável eleito e Venerável sainte (quem assina)
  const { data: chapa } = await supabase.from('eleicao_chapas')
    .select('cargo, irmao_id, eleita').eq('eleicao_id', eleicaoId).eq('eleita', true);
  const vmEleitoId = (chapa || []).find(c => /vener/i.test(c.cargo))?.irmao_id;
  const ids = [vmEleitoId, el.vm_sainte_id,
    el.vm_instalador_id, el.primeiro_vigilante_instalador_id, el.segundo_vigilante_instalador_id].filter(Boolean);
  const { data: irmaos } = ids.length
    ? await supabase.from('irmaos').select('id, nome, cim').in('id', ids) : { data: [] };
  const nomeDe = (id) => (irmaos || []).find(i => String(i.id) === String(id))?.nome || '';

  // Venerável da gestão ATUAL (assina a prancha quando a eleição não tem VM sainte)
  let vmAtualNome = '';
  try {
    const { data: corpo } = await supabase.from('corpo_administrativo')
      .select('cargo, irmao_id, ano_exercicio').order('ano_exercicio', { ascending: false });
    const vmAtual = (corpo || []).find(c => /vener/i.test(c.cargo || ''));
    if (vmAtual) {
      const { data: ir } = await supabase.from('irmaos').select('nome').eq('id', vmAtual.irmao_id).maybeSingle();
      vmAtualNome = ir?.nome || '';
    }
  } catch (e) { vmAtualNome = ''; }

  // Edital de convocação da eleição
  let edital = null;
  if (el.edital_eleicao_id) {
    const { data: ed } = await supabase.from('editais').select('*').eq('id', el.edital_eleicao_id).maybeSingle();
    edital = ed || null;
  }
  // Balaústre da sessão de eleição
  const { data: bal } = await supabase.from('balaustres')
    .select('numero_balaustre, ano_balaustre, data_sessao, sessao_especial')
    .eq('sessao_especial', 'eleicao_loja').order('data_sessao', { ascending: false }).limit(1);
  const balaustre = (bal && bal[0]) || null;

  return {
    nome_loja: `ACÁCIA DE PARANATINGA Nº ${dadosLoja.numero_loja || '30'}`,
    nome_loja_normal: `Acácia de Paranatinga nº ${dadosLoja.numero_loja || '30'}`,
    gestao: el.gestao || '',
    data_eleicao: dataBR(el.data_eleicao),
    data_eleicao_extenso: dataExtenso(el.data_eleicao),
    hora_eleicao: hora(el.hora_eleicao),
    data_posse: dataBR(el.data_posse),
    data_posse_extenso: dataExtenso(el.data_posse),
    hora_posse: hora(el.hora_posse),
    numero_edital: edital ? `${String(edital.numero).padStart(2, '0')}/${edital.ano}` : '[nº]',
    data_edital: dataBR(edital?.data_edital || el.data_edital_eleicao),
    numero_balaustre: balaustre ? `${balaustre.numero_balaustre}/${balaustre.ano_balaustre}` : '[nº]',
    // Nome do eleito com o CIM: "Fulano de Tal - CIM nº 1234"
    vm_eleito: (() => {
      const ir = (irmaos || []).find(i => String(i.id) === String(vmEleitoId));
      if (!ir) return '[Venerável eleito]';
      return ir.cim ? `${ir.nome} - CIM nº ${ir.cim}` : ir.nome;
    })(),
    vm_eleito_nome: nomeDe(vmEleitoId) || '[Venerável eleito]',
    vm_eleito_cim: ((irmaos || []).find(i => String(i.id) === String(vmEleitoId)) || {}).cim || '',
    vm_sainte: nomeDe(el.vm_sainte_id) || vmAtualNome || '[Venerável Mestre]',
    // Comissão Instaladora (quadro "Instaladores — Ata de Posse")
    vm_instalador: nomeDe(el.vm_instalador_id) || '',
    primeiro_vigilante_instalador: nomeDe(el.primeiro_vigilante_instalador_id) || '',
    segundo_vigilante_instalador: nomeDe(el.segundo_vigilante_instalador_id) || '',
    // Dados da GLEMT (cadastrados em Dados da Loja)
    grao_mestre: dadosLoja.glemt_grao_mestre || '[Grão-Mestre]',
    grao_mestre_adjunto: dadosLoja.glemt_grao_mestre_adjunto || '',
    glemt_gestao: dadosLoja.glemt_gestao || '',
    // Bloco da Comissão Instaladora (sai vazio quando ninguém foi definido)
    comissao_instaladora: (() => {
      const itens = [
        ['Venerável Mestre Instalador', nomeDe(el.vm_instalador_id)],
        ['1º Vigilante Instalador', nomeDe(el.primeiro_vigilante_instalador_id)],
        ['2º Vigilante Instalador', nomeDe(el.segundo_vigilante_instalador_id)],
      ].filter(([, n]) => n);
      if (!itens.length) return '';
      return ['*Comissão Instaladora:*', ...itens.map(([c, n]) => `${c}: ${n}`), ''].join('\n');
    })(),
    cidade: dadosLoja.cidade || 'Paranatinga',
    estado: dadosLoja.estado || 'MT',
    dadosLoja,
  };
};

const interp = (texto, V) =>
  Object.entries(V).reduce((t, [k, v]) => t.replaceAll(`{${k}}`, v ?? ''), String(texto || ''));

// ── WORD ────────────────────────────────────────────────────────────────
export const gerarPranchaInstalacaoDocx = async ({ prancha, V, corpo, titulo }) => {
  const F = { font: 'Times New Roman', size: 24 };
  const ar = (t, o = {}) => new TextRun({ text: String(t ?? ''), ...F, bold: !!o.bold });
  const par = (runs, o = {}) => new Paragraph({
    children: runs, alignment: o.align || AlignmentType.JUSTIFIED,
    spacing: { before: o.before ?? 0, after: o.after ?? 200, line: 276 },
    indent: o.firstLine ? { firstLine: 709 } : undefined,
  });

  const linhas = interp(corpo || CORPO_PADRAO_INSTALACAO, V).split('\n').filter(l => l.trim() !== '');
  // *texto* vira negrito
  const runs = (linha) => String(linha).split(/(\*[^*]+\*)/).filter(Boolean)
    .map(t => (t.startsWith('*') && t.endsWith('*') ? ar(t.slice(1, -1), { bold: true }) : ar(t)));

  const doc = new Document({
    styles: { default: { document: { run: F } } },
    sections: [{
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
        new TextRun({ children: [PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], font: 'Times New Roman', size: 20 }),
      ] })] }) },
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
      children: [
        ...cabecalhoLojaDocx({ ...V.dadosLoja, logoB64: LOGO_LOJA_B64 }),
        par([ar(`Prancha nº ${prancha.numero_prancha || ''}`, { bold: true })], { align: AlignmentType.LEFT, before: 240, after: 240 }),
        par([ar(interp(titulo || 'REQUERIMENTO DE COMISSÃO INSTALADORA', V), { bold: true })], { align: AlignmentType.CENTER, after: 120 }),
        par([ar(`Ao Sereníssimo Grão-Mestre, Ir∴ ${V.grao_mestre}`, { bold: true })], { align: AlignmentType.JUSTIFIED, after: 0 }),
        par([ar('Grande Loja Maçônica do Estado de Mato Grosso – GLEMT', { bold: true })], { align: AlignmentType.JUSTIFIED, after: 360 }),
        ...linhas.map(l => par(runs(l), { firstLine: !/^\*?Comissão Instaladora/.test(l.trim()) && !/Instalador:/.test(l) })),
        par([ar(`${V.cidade} – ${V.estado}, ${dataExtenso(prancha.data_prancha)}.`)], { align: AlignmentType.CENTER, before: 480, after: 600 }),
        par([ar('________________________________________')], { align: AlignmentType.CENTER, after: 0 }),
        par([ar(`Ir∴ ${String(V.vm_sainte).toUpperCase()}`, { bold: true })], { align: AlignmentType.CENTER, after: 0 }),
        par([ar('Venerável Mestre')], { align: AlignmentType.CENTER, after: 0 }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Prancha_${String(prancha.numero_prancha || '').replace('/', '-')}_Instalacao_GLEMT.docx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

// ── PDF ─────────────────────────────────────────────────────────────────
export const gerarPranchaInstalacaoPDF = ({ prancha, V, corpo, titulo }) => {
  const AZUL = [30, 58, 138]; const DOURADO = [201, 168, 76]; const TEXTO = [30, 41, 59];
  const pdfTexto = (t) => String(t ?? '').replace(/∴/g, '.·.');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 18;
  let y = 12;

  try { doc.addImage(`data:image/jpeg;base64,${LOGO_LOJA_B64}`, 'JPEG', M, y, 30, 30); } catch (e) { /* sem logo */ }
  const xt = M + 34 + (W - M - (M + 34)) / 2;
  doc.setFont('times', 'bold'); doc.setFontSize(12); doc.setTextColor(...AZUL);
  doc.text(`A.·.R.·.L.·.S.·. ACÁCIA DE PARANATINGA Nº ${V.dadosLoja?.numero_loja || '30'}`, xt, y + 8, { align: 'center' });
  doc.setFont('times', 'normal'); doc.setFontSize(10); doc.setTextColor(...TEXTO);
  doc.text(`Fundada em ${dataBR(V.dadosLoja?.data_fundacao) || '20/12/1997'}`, xt, y + 14, { align: 'center' });
  doc.text('Jurisdicionada à', xt, y + 19, { align: 'center' });
  doc.text('Grande Loja Maçônica do Estado de Mato Grosso', xt, y + 24, { align: 'center' });
  y += 36;
  doc.setDrawColor(...DOURADO); doc.setLineWidth(0.6); doc.line(M, y, W - M, y);
  y += 8;

  doc.setFont('times', 'bold'); doc.setFontSize(11); doc.setTextColor(...TEXTO);
  doc.text(`Prancha nº ${prancha.numero_prancha || ''}`, M, y);
  y += 10;
  doc.setFontSize(13); doc.setTextColor(...AZUL);
  doc.text(pdfTexto(interp(titulo || 'REQUERIMENTO DE COMISSÃO INSTALADORA', V)), W / 2, y, { align: 'center' });
  y += 13;   // respiro entre o título e o destinatário
  doc.setFontSize(11); doc.setTextColor(...TEXTO);
  doc.setFont('times', 'bold');
  doc.text(pdfTexto(`Ao Sereníssimo Grão-Mestre, Ir.·. ${V.grao_mestre}`), M, y); y += 6;
  doc.text('Grande Loja Maçônica do Estado de Mato Grosso – GLEMT', M, y); y += 6;
  doc.setFont('times', 'normal');
  y += 6;

  doc.setFont('times', 'normal'); doc.setFontSize(11.5);
  // Parágrafo com *negrito* no meio: quebra em linhas e desenha trecho a trecho.
  // Sem negrito, usa a justificação do próprio jsPDF (mais fiel ao Word).
  const escreverParagrafo = (texto, { negritoTudo = false, justificar = true } = {}) => {
    const larg = W - 2 * M;
    const temNegrito = /\*[^*]+\*/.test(texto);
    const limpo = pdfTexto(String(texto).replace(/\*/g, ''));

    if (!temNegrito) {
      doc.setFont('times', negritoTudo ? 'bold' : 'normal');
      const ls = doc.splitTextToSize(limpo, larg);
      ls.forEach((linha, i) => {
        if (y > H - 60) { doc.addPage(); y = 20; }
        const ultima = i === ls.length - 1;
        doc.text(linha, M, y, justificar && !ultima ? { maxWidth: larg, align: 'justify' } : undefined);
        y += 5.6;
      });
      doc.setFont('times', 'normal');
      return;
    }

    // Marca onde começa e termina o negrito e quebra o texto normalmente
    const partes = String(texto).split(/(\*[^*]+\*)/).filter(Boolean);
    const negritoDe = [];   // posição inicial e final de cada trecho em negrito
    let pos = 0;
    partes.forEach((t) => {
      // mede sobre o texto JÁ convertido (pdfTexto troca ∴ por .·., mudando o tamanho)
      const txt = pdfTexto(t.startsWith('*') && t.endsWith('*') ? t.slice(1, -1) : t);
      if (t.startsWith('*')) negritoDe.push([pos, pos + txt.length]);
      pos += txt.length;
    });
    const emNegrito = (i) => negritoDe.some(([a, b]) => i >= a && i < b);

    doc.setFont('times', 'normal');
    const ls = doc.splitTextToSize(limpo, larg);
    let lido = 0;
    ls.forEach((linha) => {
      // posiciona o índice no início desta linha dentro do texto completo
      while (lido < limpo.length && limpo[lido] !== linha[0] && /\s/.test(limpo[lido])) lido += 1;
      if (y > H - 60) { doc.addPage(); y = 20; }
      // desenha caractere a caractere agrupando por estilo
      let x = M, bufer = '', bold = emNegrito(lido);
      for (let k = 0; k < linha.length; k++) {
        const b = emNegrito(lido + k);
        if (b !== bold) {
          doc.setFont('times', bold ? 'bold' : 'normal');
          doc.text(bufer, x, y); x += doc.getTextWidth(bufer);
          bufer = ''; bold = b;
        }
        bufer += linha[k];
      }
      doc.setFont('times', bold ? 'bold' : 'normal');
      doc.text(bufer, x, y);
      lido += linha.length;
      y += 5.6;
    });
    doc.setFont('times', 'normal');
  };

  interp(corpo || CORPO_PADRAO_INSTALACAO, V).split('\n').filter(l => l.trim() !== '').forEach((p) => {
    const soNegrito = /^\*[^*]+\*$/.test(p.trim());
    const ehItemComissao = /Instalador:/.test(p);
    escreverParagrafo(p, { negritoTudo: soNegrito, justificar: !soNegrito && !ehItemComissao });
    y += ehItemComissao ? (/2º Vigilante/.test(p) ? 6 : 1) : 3.4;
  });

  if (y > H - 50) { doc.addPage(); y = 24; }
  y += 12;
  doc.text(pdfTexto(`${V.cidade} – ${V.estado}, ${dataExtenso(prancha.data_prancha)}.`), W / 2, y, { align: 'center' });
  y += 20;
  doc.setDrawColor(...TEXTO); doc.setLineWidth(0.3);
  doc.line(W / 2 - 45, y, W / 2 + 45, y);
  doc.setFont('times', 'bold'); doc.setFontSize(10.5);
  doc.text(pdfTexto(`Ir∴ ${String(V.vm_sainte).toUpperCase()}`), W / 2, y + 5, { align: 'center' });
  doc.setFont('times', 'normal');
  doc.text('Venerável Mestre', W / 2, y + 10, { align: 'center' });

  doc.save(`Prancha_${String(prancha.numero_prancha || '').replace('/', '-')}_Instalacao_GLEMT.pdf`);
};
