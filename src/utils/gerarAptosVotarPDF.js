import jsPDF from 'jspdf';
import 'jspdf-autotable';

// ════════════════════════════════════════════════════════════════════════
// Relação de Irmãos Aptos a Votar — eleição da Loja
// Só os aptos; assinam Venerável Mestre, Chanceler e Tesoureiro.
// ════════════════════════════════════════════════════════════════════════

const AZUL = [30, 58, 138];
const DOURADO = [201, 168, 76];
const CINZA = [100, 116, 139];
const TEXTO = [30, 41, 59];

// tipo: 'aptos' | 'inaptos' | 'ambos' (aptos e inaptos no mesmo PDF, em quadros separados)
// Coluna Tesouraria: "Regular" (até 2 meses em aberto) ou "Pendência" (3+)
// glemt: { periodo: '2027/2030', dataSessao: 'AAAA-MM-DD' } → cabeçalho de destaque da Eleição da Grande Loja
export const gerarAptosVotarPDF = ({ linhas, linhasInaptos = [], eleicao, dadosLoja = {}, logoB64, periodo, assinantes = {}, subtitulo = null, nomeArquivo = null, tipo = 'aptos', glemt = null , docExistente = null}) => {
  const inaptos = tipo === 'inaptos';
  const ambos = tipo === 'ambos';
  const doc = docExistente || new jsPDF({ unit: 'mm', format: 'a4' });
  if (docExistente) doc.addPage(); // a relação começa em página nova (ex.: após o edital)
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 18;
  const fmt = (d) => (d ? String(d).substring(0, 10).split('-').reverse().join('/') : '');

  // Cabeçalho: logo à esquerda, dados da Loja à direita
  let y = 12;
  if (logoB64) {
    try { doc.addImage(`data:image/jpeg;base64,${logoB64}`, 'JPEG', M, y, 30, 30); } catch (e) { /* sem logo */ }
  }
  const xt = M + 34 + (W - M - (M + 34)) / 2;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...AZUL);
  doc.text(`A.R.L.S. ACÁCIA DE PARANATINGA Nº ${dadosLoja.numero_loja || '30'}`, xt, y + 8, { align: 'center' });
  doc.setFontSize(10); doc.setTextColor(...TEXTO);
  doc.text(`Fundada em ${dadosLoja.data_fundacao ? fmt(dadosLoja.data_fundacao) : '20/12/1997'}`, xt, y + 14, { align: 'center' });
  doc.text('Jurisdicionada à', xt, y + 19, { align: 'center' });
  doc.text('Grande Loja Maçônica do Estado de Mato Grosso', xt, y + 24, { align: 'center' });
  y += 36;
  doc.setDrawColor(...DOURADO); doc.setLineWidth(0.6); doc.line(M, y, W - M, y);

  const tituloRelacao = ambos ? 'RELAÇÃO DE IRMÃOS APTOS E INAPTOS A VOTAR' : inaptos ? 'RELAÇÃO DE IRMÃOS INAPTOS A VOTAR' : 'RELAÇÃO DE IRMÃOS APTOS A VOTAR';

  if (glemt) {
    // ── Eleição da Grande Loja: destaque + critérios (à esquerda) + título da relação ──
    y += 6;
    const alturaBox = 17;
    doc.setFillColor(250, 246, 234); doc.setDrawColor(...DOURADO); doc.setLineWidth(0.5);
    doc.roundedRect(M, y, W - 2 * M, alturaBox, 2.5, 2.5, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(...AZUL);
    doc.text('ELEIÇÃO DA GRANDE LOJA MAÇÔNICA DO ESTADO DE MATO GROSSO – GLEMT', W / 2, y + 7, { align: 'center', maxWidth: W - 2 * M - 6 });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...TEXTO);
    doc.text(`Período ${glemt.periodo || ''}${glemt.dataSessao ? ` — sessão de ${fmt(glemt.dataSessao)}` : ''}`, W / 2, y + 13, { align: 'center' });
    y += alturaBox + 6;

    // Critérios (margem esquerda)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...TEXTO);
    doc.text('Critérios:', M, y);
    y += 4.5;
    const crit = [
      ['Tesouraria: ', 'a) Pecúlio e Mensalidade em dias; b) Com 1 Pecúlio ou até 2 Mensalidades em aberto;'],
      ['Assiduidade: ', 'a) Frequência superior a 50% nas sessões; b) Dispensados por prerrogativa de idade.'],
    ];
    crit.forEach(([rot, txt]) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      doc.text(rot, M, y);
      const wRot = doc.getTextWidth(rot);
      doc.setFont('helvetica', 'normal');
      const ls = doc.splitTextToSize(txt, W - 2 * M - wRot);
      ls.forEach((ln, k) => doc.text(ln, M + wRot, y + k * 4));
      y += ls.length * 4 + 0.8;
    });

    y += 5;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...AZUL);
    doc.text(tituloRelacao, W / 2, y, { align: 'center' });
    y += 6;
  } else {
    // ── Eleição da Loja (como antes) ──
    y += 9;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...AZUL);
    doc.text(tituloRelacao, W / 2, y, { align: 'center' });
    y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...CINZA);
    doc.text(subtitulo || `Eleição da Gestão ${eleicao?.ano_exercicio || eleicao?.gestao || ''}${eleicao?.data_eleicao ? ` — sessão de ${fmt(eleicao.data_eleicao)}` : ''}`, W / 2, y, { align: 'center' });
    y += 5;
    doc.text('Critérios: estar regular com a Tesouraria e ter pelo menos 50% de presença desde a última eleição.', W / 2, y, { align: 'center' });
    y += 6;
  }

  // Desenha a tabela de uma lista (com total abaixo); comLic = mostra "(Lic)" no nome
  const tabela = (lista, comLic, rotuloTotal) => {
    doc.autoTable({
      startY: y,
      margin: { left: M, right: M, bottom: 16 },
      head: [['Nº', 'Irmão', 'CIM', 'Tesouraria', 'Presença']],
      // Nome completo; prerrogativa por idade identificada com a estrela (desenhada em amarelo)
      body: lista.map((l, i) => [
        String(i + 1),
        `${l.nome || l.nomeCurto}${comLic && l.licenca ? ' (Lic)' : ''}`,
        l.cim || '',
        // Tesouraria pela regra própria: até 2 meses em aberto = "Regular"; 3 ou mais = "Pendência"
        l.finOk === false ? 'Pendência' : 'Regular',
        l.isento70 ? 'Dispensada' : `${l.pct}% (${l.presentes}/${l.total})`,
      ]),
      didDrawCell: (d) => {
        if (d.section === 'body' && d.column.index === 1 && lista[d.row.index]?.isento70) {
          const tw = doc.getTextWidth(String(d.cell.raw || ''));
          const cx = d.cell.x + d.cell.padding('left') + tw + 3, cy = d.cell.y + d.cell.height / 2;
          const pts = [];
          for (let k = 0; k < 10; k++) { const r = k % 2 ? 0.9 : 2.1, an = -Math.PI / 2 + k * Math.PI / 5; pts.push([cx + r * Math.cos(an), cy + r * Math.sin(an)]); }
          doc.setFillColor(250, 204, 21);
          doc.lines(pts.slice(1).map((p2, k) => [p2[0] - pts[k][0], p2[1] - pts[k][1]]), pts[0][0], pts[0][1], [1, 1], 'F', true);
        }
      },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: { top: 1.3, bottom: 1.3, left: 2, right: 2 }, textColor: TEXTO, lineColor: [226, 232, 240], lineWidth: 0.2 },
      headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 2: { cellWidth: 22, halign: 'center' }, 3: { cellWidth: 36 }, 4: { cellWidth: 30, halign: 'center' } },
    });
    y = doc.lastAutoTable.finalY + 6;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...TEXTO);
    doc.text(`${rotuloTotal}: ${lista.length}`, M, y);
  };
  const secao = (titulo, cor) => {
    if (y > H - 40) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...cor);
    doc.text(titulo, M, y);
    y += 3;
  };

  if (ambos) {
    secao(`IRMÃOS APTOS (${linhas.length})`, [16, 120, 80]);
    tabela(linhas, false, 'Total de irmãos aptos');
    y += 10;
    secao(`IRMÃOS INAPTOS (${linhasInaptos.length})`, [185, 28, 28]);
    tabela(linhasInaptos, true, 'Total de irmãos inaptos');
  } else {
    tabela(linhas, inaptos, `Total de irmãos ${inaptos ? 'inaptos' : 'aptos'}`);
  }

  // Assinaturas: VM, Chanceler e Tesoureiro (lado a lado)
  // Assinaturas logo abaixo da tabela (página nova só se não couber)
  y += 24;
  if (y > H - 30) { doc.addPage(); y = 40; }
  const col = (W - 2 * M) / 3;
  [[assinantes.vm, 'Venerável Mestre'], [assinantes.chanceler, 'Chanceler'], [assinantes.tesoureiro, 'Tesoureiro']].forEach(([nome, cargo], i) => {
    const cx = M + col * i + col / 2;
    doc.setDrawColor(...TEXTO); doc.setLineWidth(0.3);
    doc.line(cx - col / 2 + 4, y, cx + col / 2 - 4, y);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...TEXTO);
    const linhasNome = doc.splitTextToSize(nome || `[${cargo}]`, col - 6);
    linhasNome.forEach((ln, k) => doc.text(ln, cx, y + 4.5 + k * 3.8, { align: 'center' }));
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...CINZA);
    doc.text(cargo, cx, y + 4.5 + linhasNome.length * 3.8 + 0.8, { align: 'center' });
  });

  // Rodapé
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...CINZA);
    // (a data de emissão foi retirada do rodapé a pedido)
    doc.text(`${p} de ${total}`, W - M, H - 9, { align: 'right' });
  }
  // Baixa o arquivo direto (o clique gera o PDF na hora, sem esperar o banco)
  const nomeFinal = nomeArquivo || `${ambos ? 'Aptos_e_Inaptos' : inaptos ? 'Inaptos' : 'Aptos'}_a_Votar_${String(eleicao?.ano_exercicio || eleicao?.gestao || '').replace('/', '-')}.pdf`;
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nomeFinal; a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
};
