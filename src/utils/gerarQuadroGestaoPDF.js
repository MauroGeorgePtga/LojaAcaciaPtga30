import jsPDF from 'jspdf';
import 'jspdf-autotable';

// ════════════════════════════════════════════════════════════════════════
// Quadro da Gestão — PDF para envio aos irmãos
// Cabeçalho com logo e dados da Loja, nome da chapa, cargos em dois blocos
// (Luzes e Dignidades / Oficiais) e assinatura do Venerável da chapa.
// ════════════════════════════════════════════════════════════════════════

const AZUL = [30, 58, 138];
const DOURADO = [201, 168, 76];
const CINZA = [100, 116, 139];
const TEXTO = [30, 41, 59];

const LUZES = ['Veneravel Mestre', 'Primeiro Vigilante', 'Segundo Vigilante', 'Orador', 'Secretario', 'Tesoureiro', 'Chanceler'];

// Nome de exibição dos cargos (a lista interna é sem acento)
const NOME_CARGO = {
  'Veneravel Mestre': 'Venerável Mestre',
  'Primeiro Vigilante': '1º Vigilante',
  'Segundo Vigilante': '2º Vigilante',
  'Secretario': 'Secretário',
  'Mestre de Cerimonia': 'Mestre de Cerimônias',
  'Mestre de Cerimonia Adjunto': 'Mestre de Cerimônias Adjunto',
  'Bibliotecario': 'Bibliotecário',
};
const nomeCargo = (c) => NOME_CARGO[c] || c;

const fmtData = (d) => (d ? String(d).substring(0, 10).split('-').reverse().join('/') : '');

// Escreve "AUG∴ E RESP∴ LOJA SIMB∴ NOME" centralizado, desenhando o ∴ com três pontos
// (as fontes padrão do PDF não têm esse símbolo)
const linhaLoja = (doc, nomeLoja, y, W) => {
  const partes = ['AUG', '∴', ' E RESP', '∴', ' LOJA SIMB', '∴', ` ${nomeLoja}`];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const larguraTri = 1.9;
  const total = partes.reduce((t, p) => t + (p === '∴' ? larguraTri : doc.getTextWidth(p)), 0);
  let x = (W - total) / 2;
  doc.setTextColor(...AZUL);
  doc.setFillColor(...AZUL);
  partes.forEach(p => {
    if (p === '∴') {
      const r = 0.32;
      doc.circle(x + larguraTri / 2, y - 2.6, r, 'F');
      doc.circle(x + 0.45, y - 0.55, r, 'F');
      doc.circle(x + larguraTri - 0.45, y - 0.55, r, 'F');
      x += larguraTri;
    } else {
      doc.text(p, x, y);
      x += doc.getTextWidth(p);
    }
  });
};

export const gerarQuadroGestaoPDF = ({ eleicao, chapaEleita, irmaos, dadosLoja, logoB64, ordemCargos, nomeLoja: nomeLojaParam , dataEmissao = null }) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 18;

  const nomeLoja = (nomeLojaParam || `ACÁCIA DE PARANATINGA Nº ${dadosLoja?.numero_loja || '30'}`).toUpperCase();
  const gestao = eleicao?.ano_exercicio || eleicao?.gestao || '';
  const nomeIrmao = (id) => (irmaos || []).find(i => i.id === id)?.nome || '—';

  // ── Cabeçalho ──
  let y = 10;
  if (logoB64) {
    try { doc.addImage(`data:image/jpeg;base64,${logoB64}`, 'JPEG', (W - 35) / 2, y, 35, 35); } catch (e) { /* sem logo (3,5 cm) */ }
  }
  y += 41;
  linhaLoja(doc, nomeLoja, y, W);
  y += 5.5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...TEXTO);
  doc.text(`Fundada em ${dadosLoja?.data_fundacao ? fmtData(dadosLoja.data_fundacao) : '20/12/1997'}`, W / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(9); doc.setTextColor(...CINZA);
  doc.text('Sob os auspícios da Sereníssima Grande Loja Maçônica do Estado de Mato Grosso', W / 2, y, { align: 'center' });
  y += 5;
  doc.setDrawColor(...DOURADO); doc.setLineWidth(0.8);
  doc.line(M, y, W - M, y);
  doc.setLineWidth(0.2);
  doc.line(M, y + 1.2, W - M, y + 1.2);

  // ── Título e período ──
  y += 9.5;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(...AZUL);
  doc.text(`QUADRO DA GESTÃO ${gestao}`.trim(), W / 2, y, { align: 'center' });
  if (eleicao?.data_inicio_gestao || eleicao?.data_fim_gestao) {
    y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...CINZA);
    doc.text(`Período: ${fmtData(eleicao.data_inicio_gestao)} a ${fmtData(eleicao.data_fim_gestao)}`, W / 2, y, { align: 'center' });
  }

  // ── Chapa ──
  y += 5;
  const boxW = 120, boxH = 16;
  doc.setFillColor(250, 246, 234);
  doc.setDrawColor(...DOURADO); doc.setLineWidth(0.4);
  doc.roundedRect((W - boxW) / 2, y, boxW, boxH, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...CINZA);
  doc.text('C H A P A', W / 2, y + 5.5, { align: 'center' });
  doc.setFontSize(14); doc.setTextColor(...AZUL);
  doc.text(eleicao?.nome_chapa || '—', W / 2, y + 12, { align: 'center', maxWidth: boxW - 8 });
  y += boxH + 7;

  // ── Cargos em blocos ──
  const ordenar = (lista) => lista.sort((a, b) => ordemCargos.indexOf(a.cargo) - ordemCargos.indexOf(b.cargo));
  const membros = ordenar([...(chapaEleita || [])].filter(c => c.irmao_id));
  const blocos = [
    ['LUZES E DIGNIDADES', membros.filter(c => LUZES.includes(c.cargo))],
    ['OFICIAIS', membros.filter(c => !LUZES.includes(c.cargo))],
  ].filter(([, l]) => l.length > 0);

  blocos.forEach(([titulo, lista]) => {
    if (y > H - 50) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...DOURADO);
    doc.text(titulo, M, y);
    doc.setDrawColor(...DOURADO); doc.setLineWidth(0.3);
    doc.line(M + doc.getTextWidth(titulo) + 3, y - 1.2, W - M, y - 1.2);
    // Luzes: uma coluna. Oficiais: duas colunas lado a lado (cabe tudo em uma página)
    const duasColunas = titulo === 'OFICIAIS' && lista.length > 4;
    let head, body, columnStyles;
    if (duasColunas) {
      const meio = Math.ceil(lista.length / 2);
      const esq = lista.slice(0, meio), dir = lista.slice(meio);
      head = [['Cargo', 'Irmão', 'Cargo', 'Irmão']];
      body = esq.map((c, i) => [
        nomeCargo(c.cargo), nomeIrmao(c.irmao_id),
        dir[i] ? nomeCargo(dir[i].cargo) : '', dir[i] ? nomeIrmao(dir[i].irmao_id) : '',
      ]);
      const wCargo = 38, wNome = (W - 2 * M) / 2 - wCargo;
      columnStyles = {
        0: { cellWidth: wCargo, fontStyle: 'bold', textColor: AZUL },
        1: { cellWidth: wNome },
        2: { cellWidth: wCargo, fontStyle: 'bold', textColor: AZUL },
        3: { cellWidth: wNome },
      };
    } else {
      head = [['Cargo', 'Irmão']];
      body = lista.map(c => [nomeCargo(c.cargo), nomeIrmao(c.irmao_id)]);
      columnStyles = { 0: { cellWidth: 68, fontStyle: 'bold', textColor: AZUL }, 1: { cellWidth: 'auto' } };
    }
    doc.autoTable({
      startY: y + 2.5,
      margin: { left: M, right: M, bottom: 48 },   // reserva espaço para a data e a assinatura
      head, body,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: duasColunas ? 8.4 : 9.4, cellPadding: { top: 1.2, bottom: 1.2, left: 2.4, right: 2.4 }, textColor: TEXTO, lineColor: [226, 232, 240], lineWidth: 0.2, valign: 'middle' },
      headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold', fontSize: 9 },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      columnStyles,
      didParseCell: (d) => { if (duasColunas && d.column.index === 2) d.cell.styles.lineWidth = { left: 0.6, top: 0.2, bottom: 0.2, right: 0.2 }; },
    });
    y = doc.lastAutoTable.finalY + 8;
  });

  // ── Assinatura do Venerável da chapa ──
  const vm = membros.find(c => c.cargo === 'Veneravel Mestre');
  // Cidade e data de emissão, logo acima da assinatura
  const MESES_Q = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const dEmissao = String(dataEmissao || new Date().toISOString().substring(0, 10)).substring(0, 10);
  const [aE, mE, diE] = dEmissao.split('-').map(Number);
  const emissaoExtenso = `${dadosLoja.cidade || 'Paranatinga'} – ${dadosLoja.estado || 'MT'}, ${String(diE).padStart(2, '0')} de ${MESES_Q[mE - 1]} de ${aE}.`;
  if (y > H - 42) { doc.addPage(); y = 24; }   // bloco inteiro ~30 mm
  y += 8;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...TEXTO);
  doc.text(emissaoExtenso, W / 2, y, { align: 'center' });
  y += 10;
  doc.setDrawColor(...TEXTO); doc.setLineWidth(0.3);
  doc.line(W / 2 - 38, y, W / 2 + 38, y);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...TEXTO);
  doc.text(vm ? nomeIrmao(vm.irmao_id) : '[Venerável Mestre]', W / 2, y + 5.5, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...CINZA);
  doc.text(`Venerável Mestre${gestao ? ` — Gestão ${gestao}` : ''}`, W / 2, y + 10.5, { align: 'center' });

  // ── Rodapé em todas as páginas ──
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...DOURADO); doc.setLineWidth(0.3);
    doc.line(M, H - 14, W - M, H - 14);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...CINZA);
    doc.text(`Loja ${nomeLoja}`, W / 2, H - 9, { align: 'center' });
    doc.text(`${p} de ${total}`, W - M, H - 9, { align: 'right' });
  }

  doc.save(`Quadro_Gestao_${String(gestao).replace('/', '-') || 'chapa'}.pdf`);
};
