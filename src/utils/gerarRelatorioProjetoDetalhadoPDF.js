import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// A Helvetica padrão do jsPDF não tem "∴" nem emojis — saem corrompidos.
const limpar = (str) => (str || '')
  .replace(/∴/g, '.')
  .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
  .replace(/[\u2600-\u27BF]/gu, '')
  .replace(/[\uFE00-\uFE0F]/gu, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

const fmtR = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtD = (d) => (d ? new Date(String(d).substring(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR') : '');

const NAVY  = [30, 58, 95];
const AZUL  = [59, 130, 246];
const AMBAR = [217, 119, 6];
const VERDE = [22, 163, 74];
const VERM  = [220, 38, 38];
const CINZA = [100, 116, 139];

const corStatus = (status) => {
  if (status === 'concluido') return VERDE;
  if (status === 'cancelado') return VERM;
  if (status === 'suspenso') return AMBAR;
  if (status === 'em_andamento') return AZUL;
  return CINZA;
};

/**
 * Relatório detalhado de um Projeto/Campanha — para apresentar aos irmãos.
 * Estrutura: cabeçalho da Loja → dados do projeto → movimentação detalhada → totais.
 *
 * @param {Object} p
 * @param {Object} p.projeto     registro de projetos
 * @param {string} p.tipoLabel   rótulo do tipo (ex.: "Campanha")
 * @param {string} p.statusLabel rótulo da situação (ex.: "Em Andamento")
 * @param {Array}  p.receitas    receitas_projeto do projeto
 * @param {Array}  p.custos      custos_projeto do projeto
 * @param {Object} p.dadosLoja   dados_loja (nome_loja, endereco, logo_url)
 */
export const gerarRelatorioProjetoDetalhadoPDF = ({ projeto, tipoLabel, statusLabel, receitas = [], custos = [], dadosLoja = {} }) => {
  const ehCampanha = projeto.tipo === 'campanha';
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 15, LARG = W - M * 2;
  const LIMITE_Y = 272;
  let y = 10;

  const txt = (t, x, yy, opts = {}) => doc.text(String(t), x, yy, opts);
  const novaPaginaSe = (altura) => { if (y + altura > LIMITE_Y) { doc.addPage(); y = 15; } };

  const totalReceitas = receitas.reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
  const totalCustos = custos.reduce((s, c) => s + (parseFloat(c.valor) || 0), 0);
  const saldo = totalReceitas - totalCustos;
  const valorPrevisto = parseFloat(projeto.valor_previsto) || 0;
  const corTipo = ehCampanha ? AMBAR : AZUL;

  // ── Cabeçalho padrão da Loja ────────────────────────────────────────────
  const nomeLoja = limpar(dadosLoja?.nome_loja || dadosLoja?.nome) || 'ARLS Acácia de Paranatinga nº 30';
  if (dadosLoja?.logo_url) {
    try { doc.addImage(dadosLoja.logo_url, 'PNG', (W - 20) / 2, y, 20, 20); y += 24; }
    catch (e) { y += 2; }
  }
  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(30);
  txt(nomeLoja, W / 2, y, { align: 'center' }); y += 6;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80);
  txt(limpar(dadosLoja?.endereco) || 'Avenida Brasil, 2.300, Centro — Paranatinga/MT', W / 2, y, { align: 'center' }); y += 5;
  doc.setDrawColor(80); doc.setLineWidth(0.5); doc.line(M, y, W - M, y);
  doc.setLineWidth(0.2); doc.line(M, y + 1, W - M, y + 1);
  y += 7;

  // ── Título ──────────────────────────────────────────────────────────────
  doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(20);
  txt(ehCampanha ? 'RELATÓRIO DE CAMPANHA' : 'RELATÓRIO DE PROJETO', W / 2, y, { align: 'center' }); y += 5;
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(110);
  txt(`Movimentação financeira detalhada  •  Emitido em ${new Date().toLocaleDateString('pt-BR')}`, W / 2, y, { align: 'center' }); y += 7;
  doc.setTextColor(0);

  // ── Dados do projeto / campanha ─────────────────────────────────────────
  const PAD = 5;
  const largInterna = LARG - PAD * 2 - 2;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  const linhasNome = doc.splitTextToSize(limpar(projeto.nome) || 'Sem nome', largInterna);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  const linhasDesc = projeto.descricao ? doc.splitTextToSize(limpar(projeto.descricao), largInterna) : [];
  const linhasObs = projeto.observacoes ? doc.splitTextToSize(limpar(projeto.observacoes), largInterna) : [];

  const campos = [
    ['Início', fmtD(projeto.data_inicio)],
    ['Previsão de término', fmtD(projeto.data_prevista_termino)],
    ['Finalização', fmtD(projeto.data_finalizacao)],
    ['Responsável', limpar(projeto.responsavel)],
    [ehCampanha ? 'Meta de arrecadação' : 'Valor previsto', valorPrevisto > 0 ? fmtR(valorPrevisto) : 'Não definida'],
  ].filter(([, v]) => v);
  const linhasCampos = Math.ceil(campos.length / 2);

  const alturaBox = (PAD + 4) + linhasNome.length * 6 - 2 + 8.5
    + (linhasDesc.length ? 1 + linhasDesc.length * 4.3 : 0)
    + 2.5 + linhasCampos * 9
    + (linhasObs.length ? 5.5 + linhasObs.length * 4.2 : 0)
    + 3;
  novaPaginaSe(alturaBox + 4);

  doc.setFillColor(248, 250, 252); doc.roundedRect(M, y, LARG, alturaBox, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3); doc.roundedRect(M, y, LARG, alturaBox, 2, 2, 'S');
  doc.setFillColor(...corTipo); doc.rect(M, y + 1.5, 1.4, alturaBox - 3, 'F');

  let yb = y + PAD + 4;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...NAVY);
  linhasNome.forEach((l) => { txt(l, M + PAD + 2, yb); yb += 6; });
  yb -= 2;

  // Selos: tipo e situação
  const selo = (rotulo, cor, x) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    const w = doc.getTextWidth(rotulo) + 6;
    doc.setFillColor(255, 255, 255); doc.setDrawColor(...cor); doc.setLineWidth(0.4);
    doc.roundedRect(x, yb, w, 5.2, 2.6, 2.6, 'FD');
    doc.setTextColor(...cor); txt(rotulo, x + w / 2, yb + 3.6, { align: 'center' });
    return x + w + 3;
  };
  let xs = M + PAD + 2;
  xs = selo(limpar(tipoLabel) || (ehCampanha ? 'Campanha' : 'Projeto'), corTipo, xs);
  selo(limpar(statusLabel) || '', corStatus(projeto.status), xs);
  yb += 8.5;

  if (linhasDesc.length) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(70);
    yb += 1;
    linhasDesc.forEach((l) => { txt(l, M + PAD + 2, yb); yb += 4.3; });
  }

  // Grade de campos (2 colunas)
  yb += 2.5;
  const colW = (LARG - PAD * 2 - 2) / 2;
  campos.forEach(([rotulo, valor], i) => {
    const cx = M + PAD + 2 + (i % 2) * colW;
    const cy = yb + Math.floor(i / 2) * 9;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...CINZA);
    txt(rotulo.toUpperCase(), cx, cy);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(30);
    txt(valor, cx, cy + 3.6);
  });
  yb += linhasCampos * 9;

  if (linhasObs.length) {
    yb += 1.5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...CINZA);
    txt('OBSERVAÇÕES', M + PAD + 2, yb);
    doc.setFontSize(8.5); doc.setTextColor(70);
    yb += 4;
    linhasObs.forEach((l) => { txt(l, M + PAD + 2, yb); yb += 4.2; });
  }
  y += alturaBox + 6;
  doc.setTextColor(0);

  // ── Movimentação detalhada ──────────────────────────────────────────────
  const movimentos = [
    ...receitas.map((r) => ({ tipo: 'R', data: r.data_receita, desc: r.descricao, obs: r.observacao, cat: r.origem, forma: r.forma_pagamento, resp: r.responsavel, valor: parseFloat(r.valor) || 0 })),
    ...custos.map((c) => ({ tipo: 'C', data: c.data_custo, desc: c.descricao, obs: c.observacao, cat: c.categoria, forma: c.forma_pagamento, resp: c.responsavel, valor: parseFloat(c.valor) || 0 })),
  ].sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')) || (a.tipo === b.tipo ? 0 : a.tipo === 'R' ? -1 : 1));

  novaPaginaSe(30);
  doc.setFillColor(...NAVY); doc.rect(M, y, LARG, 7.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255);
  txt('MOVIMENTAÇÃO FINANCEIRA', M + 4, y + 5.2);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  txt(`${movimentos.length} lançamento${movimentos.length === 1 ? '' : 's'}`, W - M - 4, y + 5.2, { align: 'right' });
  doc.setTextColor(0);
  y += 9;

  if (movimentos.length === 0) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...CINZA);
    txt('Nenhuma movimentação financeira registrada até o momento.', W / 2, y + 8, { align: 'center' });
    doc.setTextColor(0);
    y += 18;
  } else {
    const temEntrada = receitas.length > 0;
    const temSaida = custos.length > 0;
    const nValores = (temEntrada ? 1 : 0) + (temSaida ? 1 : 0);
    const wValor = nValores === 2 ? 22 : 26;
    const wData = 18, wCat = 27, wForma = 20, wResp = 25;
    const wDesc = LARG - (wData + wCat + wForma + wResp + wValor * nValores);

    const cabecalho = ['Data', 'Descrição', 'Origem / Categoria', 'Pagamento', 'Responsável',
      ...(temEntrada ? ['Entrada'] : []), ...(temSaida ? ['Saída'] : [])];
    const corpo = movimentos.map((m) => [
      fmtD(m.data),
      limpar(m.desc) + (m.obs ? `\n${limpar(m.obs)}` : ''),
      limpar(m.cat),
      limpar(m.forma),
      limpar(m.resp),
      ...(temEntrada ? [m.tipo === 'R' ? fmtR(m.valor) : ''] : []),
      ...(temSaida ? [m.tipo === 'C' ? fmtR(m.valor) : ''] : []),
    ]);
    const rodape = [[
      { content: 'TOTAIS', colSpan: 5, styles: { halign: 'right' } },
      ...(temEntrada ? [fmtR(totalReceitas)] : []),
      ...(temSaida ? [fmtR(totalCustos)] : []),
    ]];
    const idxEntrada = temEntrada ? 5 : -1;
    const idxSaida = temSaida ? (temEntrada ? 6 : 5) : -1;
    const estilosColunas = {
      0: { cellWidth: wData }, 1: { cellWidth: wDesc }, 2: { cellWidth: wCat }, 3: { cellWidth: wForma }, 4: { cellWidth: wResp },
    };
    if (idxEntrada >= 0) estilosColunas[idxEntrada] = { cellWidth: wValor, halign: 'right' };
    if (idxSaida >= 0) estilosColunas[idxSaida] = { cellWidth: wValor, halign: 'right' };

    autoTable(doc, {
      startY: y,
      head: [cabecalho],
      body: corpo,
      foot: rodape,
      showFoot: 'lastPage',
      theme: 'grid',
      rowPageBreak: 'avoid',
      margin: { left: M, right: M, bottom: 18 },
      styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.8, lineColor: [226, 232, 240], lineWidth: 0.2, textColor: [40, 40, 40], valign: 'middle', overflow: 'linebreak' },
      headStyles: { fillColor: [241, 245, 249], textColor: NAVY, fontStyle: 'bold', fontSize: 7.5, halign: 'left' },
      footStyles: { fillColor: [232, 240, 254], textColor: NAVY, fontStyle: 'bold', fontSize: 8.5 },
      alternateRowStyles: { fillColor: [250, 251, 253] },
      columnStyles: estilosColunas,
      didParseCell: (d) => {
        const col = d.column.index;
        if (d.section === 'head' && (col === idxEntrada || col === idxSaida)) d.cell.styles.halign = 'right';
        if (d.section === 'body' && col === idxEntrada && d.cell.raw) { d.cell.styles.textColor = VERDE; d.cell.styles.fontStyle = 'bold'; }
        if (d.section === 'body' && col === idxSaida && d.cell.raw) { d.cell.styles.textColor = VERM; d.cell.styles.fontStyle = 'bold'; }
        if (d.section === 'foot' && col === idxEntrada) d.cell.styles.textColor = VERDE;
        if (d.section === 'foot' && col === idxSaida) d.cell.styles.textColor = VERM;
      },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ── Resumo / soma final ─────────────────────────────────────────────────
  const mostrarCustos = totalCustos > 0 || !ehCampanha;
  const metaDefinida = valorPrevisto > 0;
  const pct = ehCampanha
    ? (metaDefinida ? (totalReceitas / valorPrevisto) * 100 : 0)
    : (metaDefinida ? (totalCustos / valorPrevisto) * 100 : 0);
  const mostrarProgresso = metaDefinida;
  const temAviso = (ehCampanha && pct >= 100) || (!ehCampanha && pct > 100);
  const alturaCorpo = 7 + (mostrarCustos ? 15 : 0) + 11
    + (mostrarProgresso ? 11 + (temAviso ? 4.5 : 0) : (ehCampanha ? 6 : 0)) + 3;
  novaPaginaSe(7.5 + alturaCorpo + 2);

  doc.setFillColor(...NAVY); doc.rect(M, y, LARG, 7.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255);
  txt('RESUMO FINANCEIRO', M + 4, y + 5.2);
  doc.setTextColor(0);
  y += 7.5;

  doc.setFillColor(248, 250, 252); doc.rect(M, y, LARG, alturaCorpo, 'F');
  doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3); doc.rect(M, y, LARG, alturaCorpo, 'S');
  let yr = y + 7;

  const linhaResumo = (rotulo, valor, cor) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(50);
    txt(rotulo, M + 6, yr);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...cor);
    txt(valor, W - M - 6, yr, { align: 'right' });
    yr += 7.5;
  };
  if (mostrarCustos) {
    linhaResumo(ehCampanha ? 'Total arrecadado' : 'Total de receitas', fmtR(totalReceitas), VERDE);
    linhaResumo(ehCampanha ? 'Total de despesas da campanha' : 'Total de custos', fmtR(totalCustos), VERM);
  }

  // Faixa do saldo (a soma final)
  const corSaldo = saldo >= 0 ? VERDE : VERM;
  doc.setFillColor(...corSaldo); doc.roundedRect(M + 4, yr - 4.5, LARG - 8, 9.5, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(255);
  txt(mostrarCustos ? 'SALDO (receitas - custos)' : 'TOTAL ARRECADADO', M + 8, yr + 1.6);
  doc.setFontSize(13);
  txt(fmtR(mostrarCustos ? saldo : totalReceitas), W - M - 8, yr + 1.8, { align: 'right' });
  yr += 11;

  // Progresso da meta / orçamento
  if (mostrarProgresso) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(60);
    txt(`${ehCampanha ? 'Progresso da meta' : 'Execução do orçamento'}  (${ehCampanha ? 'meta' : 'previsto'}: ${fmtR(valorPrevisto)})`, M + 6, yr + 1);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    const corPct = ehCampanha ? (pct >= 100 ? VERDE : AMBAR) : (pct > 100 ? VERM : pct > 75 ? AMBAR : AZUL);
    doc.setTextColor(...corPct);
    txt(`${pct.toFixed(1)}%`, W - M - 6, yr + 1, { align: 'right' });
    doc.setFillColor(226, 232, 240); doc.roundedRect(M + 6, yr + 3.5, LARG - 12, 3.2, 1.6, 1.6, 'F');
    doc.setFillColor(...corPct); doc.roundedRect(M + 6, yr + 3.5, Math.max(2, (LARG - 12) * Math.min(1, pct / 100)), 3.2, 1.6, 1.6, 'F');
    yr += 11;
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8);
    if (ehCampanha && pct >= 100) { doc.setTextColor(...VERDE); txt('Meta atingida!', M + 6, yr - 1); }
    else if (!ehCampanha && pct > 100) { doc.setTextColor(...VERM); txt('Atenção: os custos ultrapassaram o valor previsto.', M + 6, yr - 1); }
  } else if (ehCampanha) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(...CINZA);
    txt('Meta de arrecadação não definida para esta campanha.', M + 6, yr + 1);
  }
  y += alturaCorpo;
  doc.setTextColor(0);

  // ── Rodapé em todas as páginas ──────────────────────────────────────────
  const totalPg = doc.getNumberOfPages();
  for (let pg = 1; pg <= totalPg; pg++) {
    doc.setPage(pg);
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(150);
    txt('SysMaçom-MG - Desenvolvedor: Mauro George', M, 287);
    txt(`Página ${pg} de ${totalPg}`, W / 2, 287, { align: 'center' });
    txt(`Emitido em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, W - M, 287, { align: 'right' });
  }

  const nomeArquivo = limpar(projeto.nome).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'projeto';
  doc.save(`Relatorio_${ehCampanha ? 'Campanha' : 'Projeto'}_${nomeArquivo}.pdf`);
};
