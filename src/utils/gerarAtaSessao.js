import {
  Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType, Footer, PageNumber, TabStopType,
} from 'docx';
import { supabase } from '../supabaseClient';
import { LOGO_LOJA_B64 } from './logoLoja';
import { cabecalhoLojaDocx } from './cabecalhoLoja';
import { calcularAptidaoVoto } from './calcularAptidaoVoto';
import { formatarNumeroEdital } from './editais';

// ════════════════════════════════════════════════════════════════════════
// Ata (Balaústre) das sessões normais — Aprendiz, Companheiro e Mestre
// Texto vem de Modelos de Documentos (tipo ata_sessao_<grau>), com fallback.
// Assinam: Venerável Mestre, Orador e Secretário do Corpo Administrativo
// do ano da sessão.
// ════════════════════════════════════════════════════════════════════════

export const TIPO_ATA_ELEICAO_GLEMT = 'ata_eleicao_glemt';

export const TIPO_MODELO_ATA = {
  Aprendiz: 'ata_sessao_aprendiz',
  Companheiro: 'ata_sessao_companheiro',
  Mestre: 'ata_sessao_mestre',
};

const GRAU_EXTENSO = {
  Aprendiz: 'Aprendiz Maçom (Grau 1)',
  Companheiro: 'Companheiro Maçom (Grau 2)',
  Mestre: 'Mestre Maçom (Grau 3)',
};
const GRAU_REUNIAO = { Aprendiz: 'Aprendiz Maçom', Companheiro: 'Companheiro Maçom', Mestre: 'Mestre Maçom' };

export const CORPO_ATA_PADRAO = [
  'Aos {data_sessao_extenso} da E∴ V∴, no Templo Maçônico, sito à {endereco_loja}, no Oriente de {cidade}-{estado}, reuniram-se no grau de {grau_reuniao} os obreiros do quadro da Augusta e Respeitável Loja Simbólica {nome_loja}, em nome e sob os auspícios da Sereníssima Grande Loja Maçônica do Estado de Mato Grosso – GLEMT. Os trabalhos foram abertos ritualisticamente às {hora_abertura} horas. A Loja estava assim constituída: V∴ M∴ {vm_nome}, 1º Vig∴ {primeiro_vigilante_nome}, 2º Vig∴ {segundo_vigilante_nome}, Orad∴ {orador_nome}, Secr∴ {secretario_nome}. O V∴ M∴ iniciou os trabalhos determinando que o Ir∴ Secr∴ procedesse à leitura do Balaústre da sessão anterior.',
  '*EXPEDIENTE:* ',
  '*BOLSA DE PROPOSTA E INFORMAÇÕES:* ',
  '*ORDEM DO DIA:* {ordem_dia}',
  '*TRONCO DE SOLIDARIEDADE:* Em seu giro recolheu a importância de R$ ______, moedas cunhadas e gravadas, a serem creditadas à Hospitalaria e debitadas à Tesouraria.',
  '*PALAVRA A BEM DA ORDEM E DO QUADRO EM PARTICULAR:* ',
  '*ENCERRAMENTO:* O V∴ M∴ encerrou a presente sessão ritualisticamente às {hora_encerramento} horas, tendo eu, {secretario_nome}, que a tudo assisti, elaborei e redigi o presente Balaústre, tomando o cuidado de fazê-lo em local ermo e longe das vistas profanas, o qual lido e, se aprovado, será assinado por quem de direito.',
].join('\n');
export const TITULO_ATA_PADRAO = 'ATA DE REUNIÃO';
// Subtítulo padrão (abaixo do título, antes do texto): número do balaustre
export const SUBTITULO_ATA_PADRAO = 'Balaústre nº {numero_balaustre}/{ano_balaustre}';

// Edital de convocação — eleição da GLEMT (dirigido aos Mestres)
export const TIPO_EDITAL_GLEMT = 'edital_eleicao_glemt';
export const TITULO_EDITAL_GLEMT_PADRAO = 'EDITAL DE CONVOCAÇÃO Nº {numero_edital}\nELEIÇÃO DA GRANDE LOJA MAÇÔNICA DO ESTADO DE MATO GROSSO – PERÍODO {periodo_glemt_barra}';
export const CORPO_EDITAL_GLEMT_PADRAO = [
  'O Venerável Mestre da Augusta e Respeitável Loja Simbólica {nome_loja}, no uso de suas atribuições e em cumprimento ao que determinam a Constituição, o Regulamento Geral da Ordem e o Código Eleitoral Maçônico da GLEMT, *CONVOCA* os Irmãos *Mestres Maçons* do quadro desta Oficina, regulares e quites com suas obrigações, para a Sessão Ordinária de Eleição do Sereníssimo Grão-Mestre e do Eminente Grão-Mestre Adjunto da Grande Loja Maçônica do Estado de Mato Grosso – GLEMT, para o período maçônico de {periodo_glemt}, a realizar-se no dia {data_sessao}, às {hora_abertura} horas, no Templo da Loja, situado na {endereco_loja}, cidade de {cidade}/{estado}.',
  '',
  'Concorrem ao pleito as seguintes chapas:',
  '{chapas_edital}',
  '',
  'Para conhecimento de todos, expede-se o presente Edital.',
].join('\n');

// Ata da Sessão Eleitoral — eleição de Grão-Mestre e Adjunto da GLEMT
export const TITULO_ELEICAO_GLEMT_PADRAO = "ATA DA ASSEMBLEIA GERAL ORDINÁRIA PARA ELEIÇÃO DA GRANDE LOJA DO ESTADO DE MATO GROSSO PARA O PERÍODO {periodo_glemt_barra}";
export const CORPO_ELEICAO_GLEMT_PADRAO = "Aos {data_sessao} da era vulgar, às {hora_abertura} horas, reuniram-se nesta A∴R∴L∴S∴ Acácia de Paranatinga nº 30, na sua sede localizada na {endereco_loja}, cidade de {cidade}/{estado}, em Sessão Ordinária para Eleição da Administração da Grande Loja do Estado de Mato Grosso – GLEMT, para os cargos do Sereníssimo Grão-Mestre, Eminente Grão-Mestre Adjunto, atendendo à convocação feita pelo Respeitabilíssimo Mestre (Presidente) e Membros da Diretoria, para cumprimento do que determinam a Constituição, Regulamento Geral da Ordem e Código Eleitoral Maçônico da GLEMT.\n\nPreenchidos os lugares em Loja, os trabalhos foram abertos em Grau de Mestre Maçom com um simples golpe de malhete pelo Respeitabilíssimo Mestre da Oficina, dispensando-se a Leitura da Ata dos últimos trabalhos e dos Expedientes, passando diretamente à deliberação da Ordem do Dia.\n*ORDEM DO DIA:* Consta da Ordem do Dia eleição do Sereníssimo Grão-Mestre e Eminente Grão-Mestre Adjunto da GLEMT, de acordo com o Edital de Convocação, para o período maçônico de {periodo_glemt}. De acordo com o Regulamento Geral da Ordem, os Veneráveis Irmãos Orador e Secretário foram convidados para formarem a Mesa Eleitoral, consequentemente, foram nomeados os Veneráveis Irmãos {escrutinador1_nome} e {escrutinador2_nome}, para ocuparem respectivamente, os lugares dos Veneráveis Irmãos Orador e Secretário de Ofício e serem os Escrutinadores. Por ordem do Respeitabilíssimo Mestre, houve a COMPOSIÇÃO DA MESA ELEITORAL E ESCRUTINADORES, formados pelo Respeitab∴ Mestre, Ir∴ {vm_nome}; Ven∴ Orador, Ir∴ {orador_nome}; Ven∴ Secretário, Ir∴ {secretario_nome}; Ven∴ Escrutinador, Ir∴ {escrutinador1_nome}; Ven∴ Escrutinador, Ir∴ {escrutinador2_nome}.\nA Mesa Eleitoral composta, o Respeitabilíssimo Mestre ordenou ao Ir∴ Secretário Substituto, que procedesse a leitura das Chapas apresentadas, a fim que todos os Veneráveis Irmãos presentes tomassem conhecimento dos nomes dos candidatos e seus respectivos cargos; e, assim o fez, sendo apresentada {chapas_apresentadas}\nEm seguida, por ordem do Respeitabilíssimo Mestre, o Venerável Chanceler, Ir∴ {chanceler_nome}, anunciou os Veneráveis Irmãos aptos a votar e ser votados. Em seguida, o Ir∴ Tesoureiro da Loja, anunciou os Ir∴ aptos a votar e ser votados, conforme o Regulamento Geral da Ordem e o Código Eleitoral Maçônico.\nEstando os Obreiros aptos a votar e serem votados, o Venerável Mestre de Cerimônias, procedeu a distribuição das Cédulas a todos os Obreiros Eleitores presentes à Sessão e por ordem do Respeitabilíssimo Mestre houve a suspensão dos trabalhos temporariamente para que os IIr∴ exercessem o direito de voto. Finalizado o processo de votação, o Respeitabilíssimo Mestre reencetou os trabalhos. Neste momento, o Ir∴ Secretário realizou a chamada dos Obreiros Eleitores em ordem, a fim de assinarem a Folha de Votação e depositarem o seu voto na urna.\nPor ordem do Respeitabilíssimo Mestre, o Venerável Mestre de Cerimônias em posse da urna contendo as Cédulas Eleitorais entregou no Trono, e com a ajuda dos Veneráveis Irmãos Orador e Secretário Substitutos, houve a conferência da quantidade de Cédulas com o número de votantes presentes, bem como, a fazer a apuração, com o seguinte resultado: {resultado_apuracao} Votos em branco: {votos_brancos}; votos nulos: {votos_nulos}; total de votantes: {total_votantes}. Com a finalização do processo de votação e apuração, o Respeitabilíssimo Mestre solicitou aos Veneráveis Irmãos Orador e Secretário de Ofício que retornem a seus postos e reassumam suas respectivas Joias e que os Veneráveis Irmãos Escrutinadores retornem, cada qual, a seu lugar, já em seguida, colocou a Palavra nas Colunas e no Oriente, a fim que os Veneráveis Irmãos se manifestassem exclusivamente sobre o Ato Eleitoral.\n*TRONCO DE SOLIDARIEDADE:* O Tronco de Solidariedade após fazer seu giro, sem formalidades conforme Regulamento Geral e do Código Eleitoral Maçônico, recolheu ______ kg de moedas cunhadas.\nEsta Ata é o que foi deliberado em Assembleia da Loja, em {data_sessao}, e é de responsabilidade dos dirigentes e de todos os participantes. Nada mais foi tratado. Eu, {secretario_nome} (Secretário), lavrei a presente Ata que vai assinada pelo Venerável Mestre, Orador e Secretário. Os trabalhos foram encerrados com um simples golpe de malhete.";

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze',
  'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove', 'vinte'];
// Número por extenso até 999 (antes parava em 20 e saía "23 (23)")
const DEZENAS_EXT = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS_EXT = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
const numeroExtenso = (valor) => {
  const n = Math.trunc(Number(valor) || 0);
  if (n < 0) return String(n);
  if (n === 0) return 'zero';
  if (n <= 20) return UNIDADES[n] || String(n);
  if (n < 100) {
    const d = Math.floor(n / 10), u = n % 10;
    return u ? `${DEZENAS_EXT[d]} e ${UNIDADES[u]}` : DEZENAS_EXT[d];
  }
  if (n === 100) return 'cem';
  if (n < 1000) {
    const c = Math.floor(n / 100), resto = n % 100;
    return resto ? `${CENTENAS_EXT[c]} e ${numeroExtenso(resto)}` : CENTENAS_EXT[c];
  }
  return String(n);
};
const diaExtenso = (n) => {
  if (n <= 20) return n === 1 ? 'primeiro' : UNIDADES[n];
  if (n < 30) return `vinte e ${UNIDADES[n - 20]}`;
  if (n === 30) return 'trinta';
  return 'trinta e um';
};
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// "Aos sete dias do mês de outubro de 2.026" → aqui sem o "Aos" (fica no modelo)
const dataSessaoExtenso = (iso) => {
  if (!iso) return '[data da sessão]';
  const [a, m, d] = String(iso).substring(0, 10).split('-').map(Number);
  const dia = diaExtenso(d);
  const ano = String(a).replace(/^(\d)(\d{3})$/, '$1.$2');
  return `${dia} ${d === 1 ? 'dia' : 'dias'} do mês de ${MESES[m - 1]} de ${ano}`;
};
const hora = (h, padrao) => (h ? String(h).substring(0, 5) : padrao);

const NORM = (c) => String(c || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const b64ToBuffer = (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

// Margens do modelo (cm → twips); vazio = padrão 5 / 2,8 / 3,5 / 2 cm
const margensDoModelo = (m = {}) => {
  const cm = (v, pad) => Math.round((v === null || v === undefined || v === '' || isNaN(Number(v)) ? pad : Number(v)) * 567);
  return { top: cm(m.margem_sup, 5), bottom: cm(m.margem_inf, 2.8), left: cm(m.margem_esq, 3.5), right: cm(m.margem_dir, 2) };
};

// Modelos de ata disponíveis para o grau (base + extras criados em Modelos de Documentos)
export const listarModelosAta = async (grau, { eleicao = false } = {}) => {
  const { data } = await supabase.from('modelos_documentos').select('id, tipo, nome, grau, tipo_base').eq('modulo', 'balaustres');
  const g = String(grau || '').toLowerCase();
  // Cópias de um modelo guardam o original em tipo_base (ou tipo = "base__timestamp")
  const tipoReal = (m) => m.tipo_base || String(m.tipo || '').split('__')[0];
  return (data || [])
    .filter(m => String(m.grau || tipoReal(m).replace('ata_sessao_', '')).toLowerCase() === g)
    // Sessão de eleição da GLEMT usa só os modelos de eleição (inclusive as cópias)
    .filter(m => (eleicao ? tipoReal(m) === TIPO_ATA_ELEICAO_GLEMT : tipoReal(m) !== TIPO_ATA_ELEICAO_GLEMT))
    .filter(m => tipoReal(m) !== 'edital_eleicao_glemt' && tipoReal(m) !== 'lista_presenca_glemt') // edital e lista não são atas
    .sort((a, b) => (tipoReal(a) === `ata_sessao_${g}` ? -1 : tipoReal(b) === `ata_sessao_${g}` ? 1 : a.nome.localeCompare(b.nome)));
};

export const gerarAtaSessao = async ({ balaustre, modeloId = null, documento = 'ata', comLista = false, aptos = null, retornarTexto = false }) => {
  const ehEdital = documento === 'edital';
  // Edital: exige o número emitido (tela Editais) — fonte única da numeração
  let editalReg = null;
  {
    const idEdital = balaustre.eleicao_glemt && balaustre.eleicao_glemt.edital_id;
    if (ehEdital && !idEdital) throw new Error('emita o edital (número) na aba Configuração antes de gerar o documento.');
    if (idEdital) {
      const { data: ed } = await supabase.from('editais').select('*').eq('id', idEdital).maybeSingle();
      if (ehEdital && !ed) throw new Error('o edital vinculado não foi encontrado em Editais. Emita um novo na aba Configuração.');
      editalReg = ed || null; // na ata o número é só informativo: sem edital, a variável fica vazia
    }
    // Sem o vínculo no balaustre (ex.: emitido antes do vínculo ser gravado), procura pela origem
    if (!editalReg && balaustre.id) {
      const { data: porOrigem } = await supabase.from('editais').select('*')
        .eq('origem_id', String(balaustre.id)).eq('tipo', 'eleicao_glemt')
        .order('ano', { ascending: false }).order('numero', { ascending: false }).limit(1);
      editalReg = (porOrigem && porOrigem[0]) || null;
    }
  }
  // Dados da Loja e nomes dos irmãos (busca própria: o componente não precisa passar nada)
  const [{ data: lojaData }, { data: irmaosData }] = await Promise.all([
    supabase.from('dados_loja').select('*').limit(1),
    supabase.from('irmaos').select('id, nome, cim, data_exaltacao, situacao, data_falecimento'),
  ]);
  const dadosLoja = (lojaData && lojaData[0]) || {};
  const irmaos = irmaosData || [];
  const grau = balaustre.grau_sessao || 'Aprendiz';
  const anoSessao = parseInt(balaustre.ano_balaustre || String(balaustre.data_sessao || '').substring(0, 4)) || new Date().getFullYear();

  // Modelo
  const ehEleicao = !!(balaustre.eleicao_glemt && balaustre.eleicao_glemt.ativo);
  const { data: mod } = modeloId
    ? await supabase.from('modelos_documentos').select('*').eq('id', modeloId).maybeSingle()
    : await supabase.from('modelos_documentos').select('*')
      .eq('tipo', ehEdital ? TIPO_EDITAL_GLEMT : ehEleicao ? TIPO_ATA_ELEICAO_GLEMT : TIPO_MODELO_ATA[grau]).maybeSingle();
  const modelo = mod || (ehEdital ? { titulo_doc: TITULO_EDITAL_GLEMT_PADRAO, corpo: CORPO_EDITAL_GLEMT_PADRAO, mostrar_logo: true }
    : ehEleicao ? { titulo_doc: TITULO_ELEICAO_GLEMT_PADRAO, corpo: CORPO_ELEICAO_GLEMT_PADRAO } : {});

  // Balaustre anterior do mesmo grau (sessão imediatamente antes desta)
  const { data: anteriores } = await supabase.from('balaustres')
    .select('numero_balaustre, ano_balaustre, data_sessao')
    .eq('grau_sessao', grau)
    .lt('data_sessao', balaustre.data_sessao || '9999-12-31')
    .order('data_sessao', { ascending: false })
    .limit(1);
  const anterior = (anteriores || [])[0] || null;
  const fmt = (iso) => (iso ? String(iso).substring(0, 10).split('-').reverse().join('/') : '');
  const hoje = new Date();
  const dataAtual = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;

  // Corpo Administrativo do ano da sessão
  // (ano_exercicio pode ser "2026" ou "2026/2027")
  const { data: corpoTodos } = await supabase.from('corpo_administrativo').select('cargo, ano_exercicio, irmao_id');
  const corpo = (corpoTodos || []).filter(c => String(c.ano_exercicio || '').split(/[^0-9]+/).includes(String(anoSessao)));
  const nomeCargo = (...alvos) => {
    const reg = (corpo || []).find(c => alvos.includes(NORM(c.cargo)));
    const ir = reg ? irmaos.find(i => i.id === reg.irmao_id) : null;
    return ir?.nome || null;
  };
  const vm = nomeCargo('veneravel mestre', 'veneravel');
  const v1 = nomeCargo('primeiro vigilante', '1º vigilante', '1o vigilante');
  const v2 = nomeCargo('segundo vigilante', '2º vigilante', '2o vigilante');
  const orador = nomeCargo('orador');
  const secretario = nomeCargo('secretario');
  const chanceler = nomeCargo('chanceler');

  const VARS = {
    numero_balaustre: String(balaustre.numero_balaustre ?? ''),
    data_atual: dataAtual,
    balaustre_anterior: anterior ? `${anterior.numero_balaustre}/${anterior.ano_balaustre || String(anterior.data_sessao || '').substring(0, 4)}` : '[sem balaustre anterior]',
    data_balaustre_anterior: anterior ? fmt(anterior.data_sessao) : '[sem data]',
    ano_balaustre: String(anoSessao),
    data_sessao: balaustre.data_sessao ? balaustre.data_sessao.split('-').reverse().join('/') : '',
    data_sessao_extenso: dataSessaoExtenso(balaustre.data_sessao),
    dia_semana: balaustre.dia_semana || '',
    grau: grau,
    grau_extenso: GRAU_EXTENSO[grau] || grau,
    grau_reuniao: GRAU_REUNIAO[grau] || grau,
    hora_abertura: hora(balaustre.hora_abertura, '20:00'),
    hora_encerramento: hora(balaustre.hora_encerramento, '22:00'),
    ordem_dia: balaustre.ordem_dia || '',
    observacoes: balaustre.observacoes || '',
    nome_loja: `ACÁCIA DE PARANATINGA Nº ${dadosLoja.numero_loja || '30'}`,
    // Mesma Loja sem caixa alta: "Acácia de Paranatinga nº 30"
    nome_loja_normal: `Acácia de Paranatinga nº ${dadosLoja.numero_loja || '30'}`,
    endereco_loja: dadosLoja.endereco || '[endereço da Loja]',
    cidade: dadosLoja.cidade || 'Paranatinga',
    estado: dadosLoja.estado || 'MT',
    vm_nome: vm || '[Venerável Mestre]',
    primeiro_vigilante_nome: v1 || '[1º Vigilante]',
    segundo_vigilante_nome: v2 || '[2º Vigilante]',
    orador_nome: orador || '[Orador]',
    secretario_nome: secretario || '[Secretário]',
    chanceler_nome: chanceler || '[Chanceler]',
  };
  // ── Eleição da GLEMT (balaustre.eleicao_glemt) ──
  const el = balaustre.eleicao_glemt && balaustre.eleicao_glemt.ativo ? balaustre.eleicao_glemt : null;
  if (el) {
    const nomeIr = (id) => irmaos.find(i => String(i.id) === String(id))?.nome || '';
    const chapas = (el.chapas || []).filter(c => c && (c.nome || c.gm));
    const num = (v) => (v === '' || v === null || v === undefined ? 0 : Number(v) || 0);
    const vencedora = [...chapas].map((c, i) => ({ ...c, i })).sort((a, b) => num(b.votos) - num(a.votos))[0];
    const empate = chapas.filter(c => num(c.votos) === num(vencedora?.votos)).length > 1;
    Object.assign(VARS, {
      periodo_glemt: el.ano_inicio && el.ano_fim ? `${el.ano_inicio} a ${el.ano_fim}` : '[período]',
      periodo_glemt_barra: el.ano_inicio && el.ano_fim ? `${el.ano_inicio}/${el.ano_fim}` : '[período]',
      // Uma chapa por bloco (linhas coladas, marcadas com §) e uma linha em branco entre as chapas
      chapas_edital: chapas.length
        ? chapas.map((c, i) => [
            `§*Chapa ${i + 1} – ${c.nome || '[nome]'}*`,
            `§Grão-Mestre: Ir∴ ${c.gm || '[nome]'};`,
            `§Grão-Mestre Adjunto: Ir∴ ${c.gm_adjunto || '[nome]'}.`,
          ].join('\n')).join('\n\n')
        : '[chapas]',
      data_edital: (() => {
        let d = el.data_edital;
        if (!d && balaustre.data_sessao) { const x = new Date(balaustre.data_sessao + 'T00:00:00'); x.setDate(x.getDate() - 15); d = x.toISOString().substring(0, 10); }
        return d ? d.split('-').reverse().join('/') : '[data do edital]';
      })(),
      data_edital_extenso: (() => {
        let d = el.data_edital;
        if (!d && balaustre.data_sessao) { const x = new Date(balaustre.data_sessao + 'T00:00:00'); x.setDate(x.getDate() - 15); d = x.toISOString().substring(0, 10); }
        if (!d) return '[data do edital]';
        const [a, m, di] = d.split('-').map(Number);
        return `${String(di).padStart(2, '0')} de ${MESES[m - 1]} de ${a}`;
      })(),
      // Nome da chapa em negrito e uma linha por cargo (§ = linhas coladas, sem espaço entre elas)
      chapas_apresentadas: !chapas.length ? '[chapas].' : chapas.map((c, i, arr) => [
        `§*Chapa ${String(i + 1).padStart(2, '0')}: ${c.nome || '[nome]'}*`,
        `§Grão Mestre - Ir∴ ${c.gm || '[nome]'} - Grão-Mestre;`,
        `§Grão Mestre Adjunto - Ir∴ ${c.gm_adjunto || '[nome]'} - Grão-Mestre Adjunto${i === arr.length - 1 ? '.' : ';'}`,
        ...(i === arr.length - 1 ? [] : ['']),
      ].join('\n')).join('\n'),
      // Formato corrido antigo, caso algum modelo ainda precise
      chapas_apresentadas_corrida: chapas.length
        ? chapas.map(c => `a Chapa ${c.nome || '[nome]'}, para a qual o Ir∴ ${c.gm || '[nome]'} é candidato para o cargo de Grão-Mestre e o Ir∴ ${c.gm_adjunto || '[nome]'}, para o cargo de Grão-Mestre Adjunto`).join('; e, ') + '.'
        : '[chapas].',
      escrutinador1_nome: nomeIr(el.escrutinador1_id) || '[Escrutinador 1]',
      escrutinador2_nome: nomeIr(el.escrutinador2_id) || '[Escrutinador 2]',
      // Nome da chapa em negrito, e abaixo uma linha por cargo (§ = linhas coladas, sem espaço entre elas)
      chapas_lista: chapas.map((c, i, arr) => [
        `§*Chapa ${String(i + 1).padStart(2, '0')}: ${c.nome || '[nome]'}*`,
        `§Grão Mestre - Ir∴ ${c.gm || '[nome]'} - Grão-Mestre;`,
        `§Grão Mestre Adjunto - Ir∴ ${c.gm_adjunto || '[nome]'} - Grão-Mestre Adjunto${i === arr.length - 1 ? '.' : ';'}`,
        ...(i === arr.length - 1 ? [] : ['']),
      ].join('\n')).join('\n'),
      // Mesma lista em uma linha só, para quem preferir o formato corrido
      chapas_lista_corrida: chapas.map((c, i) => `Chapa ${i + 1} – ${c.nome || '[nome]'}: Grão-Mestre Ir∴ ${c.gm || '[nome]'} e Grão-Mestre Adjunto Ir∴ ${c.gm_adjunto || '[nome]'}`).join('; ') + '.',
      resultado_apuracao: chapas.map((c, i) => `Chapa ${i + 1} – ${c.nome || '[nome]'}: ${num(c.votos)} voto(s)`).join('; ') + '.',
      votos_brancos: String(num(el.brancos)),
      votos_nulos: String(num(el.nulos)),
      total_votantes: String((chapas.reduce((t, c) => t + num(c.votos), 0) + num(el.brancos) + num(el.nulos)) || (el.presentes || []).length),
      chapa_vencedora: !vencedora ? '[chapa]' : empate ? 'votação empatada entre as chapas' : `Chapa ${vencedora.i + 1} – ${vencedora.nome}`,
    });
    // Mestres aptos a votar, já com os ajustes manuais (inapto → apto) desta eleição
    let totalMestresAptos = 0;
    try {
      const { data: irmaosApt } = await supabase.from('irmaos').select('*');
      const linhasApt = await calcularAptidaoVoto({
        ref: String(balaustre.data_sessao).substring(0, 10),
        ini: await (async () => {
          const ref0 = String(balaustre.data_sessao).substring(0, 10);
          const { data: ant } = await supabase.from('balaustres')
            .select('data_sessao').not('eleicao_glemt', 'is', null)
            .lt('data_sessao', ref0).order('data_sessao', { ascending: false }).limit(1);
          if (ant && ant[0]) return String(ant[0].data_sessao).substring(0, 10);
          const d = new Date(`${ref0}T00:00:00`); d.setFullYear(d.getFullYear() - 1);
          return d.toISOString().substring(0, 10);
        })(),
        irmaos: irmaosApt || [],
        ajustes: el.aptidao_ajustes || {},
      });
      totalMestresAptos = (linhasApt || []).filter(l => l.apto).length;
    } catch (e) { totalMestresAptos = (el.presentes || []).length; }
    VARS.total_mestres_aptos = String(totalMestresAptos);
    VARS.total_mestres_aptos_extenso = numeroExtenso(totalMestresAptos);

    // Voto em trânsito: Irmãos de outras Lojas (contados à parte dos votantes da Loja)
    const transito = el.voto_transito ? (el.votantes_transito || []).filter(v => v && (v.nome || '').trim()) : [];
    Object.assign(VARS, {
      qtd_votantes_transito: String(transito.length),
      qtd_votantes_transito_extenso: numeroExtenso(transito.length),
      palavra_irmao_transito: transito.length === 1 ? 'Irmão' : 'Irmãos',
      plural_transito: transito.length === 1 ? '' : 's',
      // Agrupado por Oficina: cabeçalho da loja e, abaixo, um Irmão por linha
      votantes_transito: !transito.length ? '' : transito
        .reduce((acc, v) => {
          const chave = `${(v.oriente || '').trim()}||${(v.loja || '').trim()}`;
          let g = acc.find(x => x.chave === chave);
          if (!g) { g = { chave, oriente: (v.oriente || '').trim(), loja: (v.loja || '').trim(), irmaos: [] }; acc.push(g); }
          g.irmaos.push(v);
          return acc;
        }, [])
        .map((g, gi, todas) => [
          `§Oficina: ${g.loja || '[oficina]'}${g.oriente ? `, Oriente de ${g.oriente}` : ''}:`,
          ...g.irmaos.map((v, i) => `§${i + 1}. Ir∴ ${v.nome}${v.cim ? `, CIM nº ${v.cim}` : ''}${gi === todas.length - 1 && i === g.irmaos.length - 1 ? '.' : ';'}`),
          ...(gi === todas.length - 1 ? [] : ['']),
        ].join('\n')).join('\n'),
      total_votantes_loja: String((el.presentes || []).length || (chapas.reduce((t, c) => t + num(c.votos), 0) + num(el.brancos) + num(el.nulos))),
    });

    // ── Apuração separada por urna (Loja + cada loja em trânsito) ──────────
    const lojasTr = transito.reduce((acc, v) => {
      const chave = `${(v.oriente || '').trim()}||${(v.loja || '').trim()}`;
      let g = acc.find(x => x.chave === chave);
      if (!g) { g = { chave, oriente: (v.oriente || '').trim(), loja: (v.loja || '').trim(), qtd: 0 }; acc.push(g); }
      g.qtd += 1;
      return acc;
    }, []);
    const separada = !!el.apuracao_separada && lojasTr.length > 0;
    const urnaDe = (chave) => (el.urnas_transito || {})[chave] || {};
    const descreveUrna = (nome, votos, brancos, nulos, votantes, ultima = true) => [
      `§${nome}:`,
      ...chapas.map((c, i) => `§Chapa ${i + 1} – ${c.nome || '[nome]'}: ${votos[i]} voto(s);`),
      `§votos em branco: ${brancos}; votos nulos: ${nulos}; total de votantes: ${votantes}.`,
      ...(ultima ? [] : ['']),
    ].join('\n');

    // Bloco da ata por urna: Loja em negrito, cada chapa com os candidatos e os votos.
    // comResumo = true acrescenta a linha de brancos/nulos/total (apuração);
    // false deixa só as chapas (proclamação do resultado).
    const blocoUrna = (nomeLoja, votos, brancos, nulos, votantes, comResumo, ultima = true) => [
      `§*${nomeLoja}:*`,
      '',
      ...chapas.flatMap((c, i) => [
        `§*CHAPA ${String(i + 1).padStart(2, '0')} - ${(c.nome || '[nome]').toUpperCase()}*`,
        '§Para Grão-Mestre e Grão-Mestre-Adjunto, respectivamente:',
        `§${(c.gm || '[nome]').toUpperCase()} - GRÃO MESTRE e ${(c.gm_adjunto || '[nome]').toUpperCase()} - GRÃO MESTRE ADJUNTO com ${votos[i]} (${numeroExtenso(votos[i])}) votos válidos.`,
        '',
      ]),
      ...(comResumo ? [
        `§Constatou-se, ainda, a existência de ${brancos} (${numeroExtenso(brancos)}) votos brancos e ${nulos} (${numeroExtenso(nulos)}) votos nulos, totalizando ${votantes} (${numeroExtenso(votantes)}) votos, entre válidos, brancos e nulos.`,
        '',
      ] : []),
      ...(ultima ? [] : ['']),
    ].join('\n');
    const totalChapaG = (i) => num(chapas[i]?.votos) + (separada ? lojasTr.reduce((t, g) => t + num(urnaDe(g.chave)[`chapa${i + 1}`]), 0) : 0);
    const brancosG = num(el.brancos) + (separada ? lojasTr.reduce((t, g) => t + num(urnaDe(g.chave).brancos), 0) : 0);
    const nulosG = num(el.nulos) + (separada ? lojasTr.reduce((t, g) => t + num(urnaDe(g.chave).nulos), 0) : 0);
    // Total de votantes da Loja = soma dos votos desta urna (campo automático na tela)
    // Votantes da Loja = Irmãos marcados como presentes na aba Aptos e Presença.
    // (antes vinha da soma dos votos, que inclui os de trânsito quando a urna é única)
    const votantesLoja = (el.presentes || []).length
      || (chapas.reduce((t, c) => t + num(c.votos), 0) + num(el.brancos) + num(el.nulos));
    const votantesG = votantesLoja + (separada ? lojasTr.reduce((t, g) => t + (num(urnaDe(g.chave).votantes) || g.qtd), 0) : 0);
    const nomeNossaLoja = `A∴R∴L∴S∴ Acácia de Paranatinga nº ${dadosLoja.numero_loja || '30'}`;

    Object.assign(VARS, {
      apuracao_loja: descreveUrna(nomeNossaLoja, chapas.map(c => num(c.votos)), num(el.brancos), num(el.nulos), votantesLoja, !separada),
      apuracao_transito_todas: separada
        ? lojasTr.map((g, k) => {
            const u = urnaDe(g.chave);
            return descreveUrna(`${g.loja || '[oficina]'}${g.oriente ? `, Oriente de ${g.oriente}` : ''}`, chapas.map((c, i) => num(u[`chapa${i + 1}`])), num(u.brancos), num(u.nulos), (chapas.reduce((t, c, i) => t + num(u[`chapa${i + 1}`]), 0) + num(u.brancos) + num(u.nulos)) || g.qtd, k === lojasTr.length - 1);
          }).join('\n')
        : '',
      apuracao_total: descreveUrna('Resultado geral', chapas.map((c, i) => totalChapaG(i)), brancosG, nulosG, votantesG),
      // Todas as urnas numa variável só (nossa Loja primeiro, depois as de trânsito)
      apuracao_urnas: separada
        ? [descreveUrna(nomeNossaLoja, chapas.map(c => num(c.votos)), num(el.brancos), num(el.nulos), votantesLoja, false),
           ...lojasTr.map((g, k) => {
             const u = urnaDe(g.chave);
             return descreveUrna(`${g.loja || '[oficina]'}${g.oriente ? `, Oriente de ${g.oriente}` : ''}`, chapas.map((c, i) => num(u[`chapa${i + 1}`])), num(u.brancos), num(u.nulos), (chapas.reduce((t, c, i) => t + num(u[`chapa${i + 1}`]), 0) + num(u.brancos) + num(u.nulos)) || g.qtd, k === lojasTr.length - 1);
           })].join('\n')
        : '',
      // Apuração por Loja no formato da ata (com o resumo de brancos/nulos)
      apuracao_por_loja: separada
        ? [blocoUrna(nomeNossaLoja, chapas.map(c => num(c.votos)), num(el.brancos), num(el.nulos), votantesLoja, true, false),
           ...lojasTr.map((g, k) => {
             const u = urnaDe(g.chave);
             const tot = (chapas.reduce((t, c, i) => t + num(u[`chapa${i + 1}`]), 0) + num(u.brancos) + num(u.nulos)) || g.qtd;
             return blocoUrna(`${g.loja || '[oficina]'}${g.oriente ? ` – Oriente de ${g.oriente}` : ''}`,
               chapas.map((c, i) => num(u[`chapa${i + 1}`])), num(u.brancos), num(u.nulos), tot, true, k === lojasTr.length - 1);
           })].join('\n')
        : blocoUrna(nomeNossaLoja, chapas.map(c => num(c.votos)), num(el.brancos), num(el.nulos), votantesLoja, true),
      // Mesma apresentação, SEM o resumo — para proclamar o resultado
      proclamacao_por_loja: separada
        ? [blocoUrna(nomeNossaLoja, chapas.map(c => num(c.votos)), 0, 0, 0, false, false),
           ...lojasTr.map((g, k) => {
             const u = urnaDe(g.chave);
             return blocoUrna(`${g.loja || '[oficina]'}${g.oriente ? ` – Oriente de ${g.oriente}` : ''}`,
               chapas.map((c, i) => num(u[`chapa${i + 1}`])), 0, 0, 0, false, k === lojasTr.length - 1);
           })].join('\n')
        : blocoUrna(nomeNossaLoja, chapas.map(c => num(c.votos)), 0, 0, 0, false),
      // Lojas em trânsito, para citar no corpo do texto
      lojas_transito_nomes: lojasTr.length
        ? lojasTr.map(g => `${g.loja || '[oficina]'}${g.oriente ? ` – Oriente de ${g.oriente}` : ''}`)
            .reduce((txt, n, i, arr) => txt + n + (i === arr.length - 2 ? ' e ' : i < arr.length - 1 ? ', ' : ''), '')
        : '',
      // Só os nomes das Oficinas, sem o oriente
      lojas_transito_lista: lojasTr.map(g => g.loja || '[oficina]')
        .reduce((txt, n, i, arr) => txt + n + (i === arr.length - 2 ? ' e ' : i < arr.length - 1 ? ', ' : ''), ''),
      // Nossa Loja + as de trânsito ("A∴R∴L∴S∴ Acácia de Paranatinga nº 30 e A∴R∴L∴S∴ Acácia do Rio Manso nº 102")
      lojas_urnas_nomes: [nomeNossaLoja, ...lojasTr.map(g => g.loja || '[oficina]')]
        .reduce((txt, n, i, arr) => txt + n + (i === arr.length - 2 ? ' e ' : i < arr.length - 1 ? ', ' : ''), ''),
      qtd_urnas: String(1 + lojasTr.length),
      // Eleitores que votaram em cada urna
      votantes_loja: String(votantesLoja),
      votantes_loja_extenso: numeroExtenso(votantesLoja),
      votantes_transito_total: String(lojasTr.reduce((t, g) => t + ((chapas.reduce((x, c, i) => x + num(urnaDe(g.chave)[`chapa${i + 1}`]), 0) + num(urnaDe(g.chave).brancos) + num(urnaDe(g.chave).nulos)) || g.qtd), 0)),
      votantes_transito_total_extenso: numeroExtenso(lojasTr.reduce((t, g) => t + ((chapas.reduce((x, c, i) => x + num(urnaDe(g.chave)[`chapa${i + 1}`]), 0) + num(urnaDe(g.chave).brancos) + num(urnaDe(g.chave).nulos)) || g.qtd), 0)),
      // Trecho pronto, repetido para CADA Loja em trânsito (quantas forem)
      trecho_urnas_transito: !lojasTr.length ? '' : lojasTr.map((g) => {
        const u = urnaDe(g.chave);
        const v = (chapas.reduce((t, c, i) => t + num(u[`chapa${i + 1}`]), 0) + num(u.brancos) + num(u.nulos)) || g.qtd;
        return `O mesmo procedimento foi adotado em relação aos votantes da ${g.loja || '[oficina]'}, tendo o Venerável Irmão Secretário informado que haviam exercido o direito de voto ${v} (${numeroExtenso(v)}) ${v === 1 ? 'Venerável Irmão' : 'Veneráveis Irmãos'} daquela Oficina. Após a abertura da respectiva urna, constatou-se igualmente a existência de cédulas eleitorais em número correspondente ao de votantes.`;
      }).join(' '),
      // Lista curta: uma Loja por linha, com a quantidade de votantes
      votantes_transito_por_loja: !lojasTr.length ? '' : lojasTr.map((g, k) => {
        const u = urnaDe(g.chave);
        const v = (chapas.reduce((t, c, i) => t + num(u[`chapa${i + 1}`]), 0) + num(u.brancos) + num(u.nulos)) || g.qtd;
        return `§${g.loja || '[oficina]'}: ${v} (${numeroExtenso(v)}) votante(s)${k === lojasTr.length - 1 ? '.' : ';'}`;
      }).join('\n'),
      total_votantes_geral: String(votantesG),
      total_votantes_geral_extenso: numeroExtenso(votantesG),
      qtd_lojas_transito: String(lojasTr.length),
    });
    lojasTr.forEach((g, k) => {
      const u = urnaDe(g.chave);
      VARS[`apuracao_transito${k + 1}`] = descreveUrna(`${g.loja || '[oficina]'}${g.oriente ? `, Oriente de ${g.oriente}` : ''}`, chapas.map((c, i) => num(u[`chapa${i + 1}`])), num(u.brancos), num(u.nulos), (chapas.reduce((t, c, i) => t + num(u[`chapa${i + 1}`]), 0) + num(u.brancos) + num(u.nulos)) || g.qtd);
      VARS[`loja_transito${k + 1}`] = g.loja || '';
      VARS[`oriente_transito${k + 1}`] = g.oriente || '';
      const votantesU = (chapas.reduce((t, c, i) => t + num(u[`chapa${i + 1}`]), 0) + num(u.brancos) + num(u.nulos)) || g.qtd;
      VARS[`votantes_transito${k + 1}`] = String(votantesU);
      VARS[`votantes_transito${k + 1}_extenso`] = numeroExtenso(votantesU);
    });
    // Com urnas separadas, o resultado e a chapa vencedora passam a ser os do consolidado
    if (separada) {
      const vencG = chapas.map((c, i) => ({ ...c, i, v: totalChapaG(i) })).sort((a, b) => b.v - a.v)[0];
      const empateG = chapas.filter((c, i) => totalChapaG(i) === (vencG ? vencG.v : 0)).length > 1;
      Object.assign(VARS, {
        resultado_apuracao: chapas.map((c, i) => `Chapa ${i + 1} – ${c.nome || '[nome]'}: ${totalChapaG(i)} voto(s)`).join('; ') + '.',
        votos_brancos: String(brancosG),
        votos_nulos: String(nulosG),
        total_votantes: String(votantesG),
        chapa_vencedora: !vencG ? '[chapa]' : empateG ? 'votação empatada entre as chapas' : `Chapa ${vencG.i + 1} – ${vencG.nome}`,
      });
      chapas.forEach((c, i) => { VARS[`votos_chapa${i + 1}`] = String(totalChapaG(i)); });
    }
    // Bloco de apuração: uma entrada por chapa cadastrada (serve para a apuração e para a proclamação).
    // Com apuração separada por loja, os votos já são os do consolidado.
    // Só as chapas com os votos do consolidado — sem título, resumo ou vencedora
    VARS.proclamacao_chapas = !chapas.length ? '[chapas].' : chapas.map((c, i, arr) => {
      const v = Number(VARS[`votos_chapa${i + 1}`] ?? num(c.votos)) || 0;
      return [
        `§*CHAPA ${String(i + 1).padStart(2, '0')} - ${(c.nome || '[nome]').toUpperCase()}*`,
        '§Para Grão-Mestre e Grão-Mestre-Adjunto, respectivamente:',
        `§${(c.gm || '[nome]').toUpperCase()} - GRÃO MESTRE e ${(c.gm_adjunto || '[nome]').toUpperCase()} - GRÃO MESTRE ADJUNTO com ${v} (${numeroExtenso(v)}) votos válidos.`,
        ...(i === arr.length - 1 ? [] : ['']),
      ].join('\n');
    }).join('\n');

    // Proclamação GERAL: soma de todas as urnas (Loja + trânsito), no formato da ata
    VARS.proclamacao_geral = !chapas.length ? '[chapas].' : [
      '§*RESULTADO GERAL DA ELEIÇÃO*',
      '',
      ...chapas.flatMap((c, i) => {
        const v = Number(VARS[`votos_chapa${i + 1}`] ?? num(c.votos)) || 0;
        return [
          `§*CHAPA ${String(i + 1).padStart(2, '0')} - ${(c.nome || '[nome]').toUpperCase()}*`,
          '§Para Grão-Mestre e Grão-Mestre-Adjunto, respectivamente:',
          `§${(c.gm || '[nome]').toUpperCase()} - GRÃO MESTRE e ${(c.gm_adjunto || '[nome]').toUpperCase()} - GRÃO MESTRE ADJUNTO com ${v} (${numeroExtenso(v)}) votos válidos.`,
          '',
        ];
      }),
      `§Constatou-se, ainda, a existência de ${VARS.votos_brancos} (${numeroExtenso(VARS.votos_brancos)}) votos brancos e ${VARS.votos_nulos} (${numeroExtenso(VARS.votos_nulos)}) votos nulos, totalizando ${VARS.total_votantes} (${numeroExtenso(VARS.total_votantes)}) votos, entre válidos, brancos e nulos.`,
      '',
      `§Proclamada vencedora a ${VARS.chapa_vencedora}.`,
    ].join('\n');

    VARS.apuracao_chapas = !chapas.length ? '[chapas].' : chapas.map((c, i, arr) => [
      `§*CHAPA ${String(i + 1).padStart(2, '0')} - ${(c.nome || '[nome]').toUpperCase()}*`,
      '§Para Grão-Mestre e Grão-Mestre-Adjunto, respectivamente:',
      `§${(c.gm || '[nome]').toUpperCase()} - GRÃO MESTRE e ${(c.gm_adjunto || '[nome]').toUpperCase()} - GRÃO MESTRE ADJUNTO com ${VARS[`votos_chapa${i + 1}`] ?? num(c.votos)} votos válidos.`,
      ...(i === arr.length - 1 ? [] : ['']),
    ].join('\n')).join('\n');
    chapas.forEach((c, i) => {
      VARS[`chapa${i + 1}_nome`] = c.nome || '';
      VARS[`chapa${i + 1}_gm`] = c.gm || '';
      VARS[`chapa${i + 1}_gm_adjunto`] = c.gm_adjunto || '';
      VARS[`votos_chapa${i + 1}`] = String(num(c.votos));
    });
  }
  // Número e data do edital vêm do registro em Editais
  if (editalReg) {
    VARS.numero_edital = formatarNumeroEdital(editalReg.numero, editalReg.ano);
    VARS.ano_edital = String(editalReg.ano);
    if (editalReg.data_edital) {
      const [a, m, di] = String(editalReg.data_edital).substring(0, 10).split('-').map(Number);
      VARS.data_edital = `${String(di).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`;
      VARS.data_edital_extenso = `${String(di).padStart(2, '0')} de ${MESES[m - 1]} de ${a}`;
    }
  }
  const interp = (t) => Object.entries(VARS).reduce((x, [k, v]) => x.replaceAll(`{${k}}`, v ?? ''), String(t || ''));

  // ── Helpers de formatação (Times New Roman 12, como os demais documentos) ──
  // Formatação do modelo: fonte e entrelinha (vazio = 12 pt e 1,15)
  const FONTE = Number(modelo.fonte_tamanho) > 0 ? Math.round(Number(modelo.fonte_tamanho) * 2) : 24;
  const ENTRELINHA = Number(modelo.espacamento_linhas) > 0 ? Math.round(Number(modelo.espacamento_linhas) * 240) : 276;
  const ar = (txt, o = {}) => new TextRun({ text: String(txt ?? ''), font: 'Times New Roman', size: FONTE, bold: !!o.bold });
  const runs = (t) => String(t).split(/(\*[^*]+\*)/g).filter(Boolean)
    .map(p => (p.length > 2 && p.startsWith('*') && p.endsWith('*') ? ar(p.slice(1, -1), { bold: true }) : ar(p)));
  const par = (children, o = {}) => new Paragraph({
    alignment: o.align ?? AlignmentType.JUSTIFIED,
    spacing: { before: o.before ?? 0, after: o.after ?? 120, line: o.line ?? ENTRELINHA },
    children,
  });
  const LINHA = '_____________________________________';
  const linhaSimples = (t, bold = false, before = 0) => par([ar(t, { bold })], { align: AlignmentType.CENTER, before, after: 0, line: 240 });

  // Trecho da votação (eleição GLEMT): chapa única → "aclamação"; 2+ chapas → "disputa".
  // Vai no lugar de {trecho_votacao} no corpo; se o corpo não tiver a variável, entra logo após o corpo.
  // Rodapé (Tronco, Palavra, Encerramento…) entra depois, antes das assinaturas.
  if (ehEleicao) {
    const qtdChapas = ((balaustre.eleicao_glemt && balaustre.eleicao_glemt.chapas) || []).filter(c => c && (c.nome || c.gm)).length;
    VARS.trecho_votacao = interp(qtdChapas <= 1 ? (modelo.corpo_aclamacao || '') : (modelo.corpo_disputa || ''));
  } else {
    VARS.trecho_votacao = '';
  }
  // Alinhamentos do modelo (título / corpo)
  const ALINHA = (v, pad) => (v === 'left' ? AlignmentType.LEFT : v === 'center' ? AlignmentType.CENTER : v === 'right' ? AlignmentType.RIGHT : v === 'justify' ? AlignmentType.JUSTIFIED : pad);
  const corpoBase = modelo.corpo || (ehEleicao ? CORPO_ELEICAO_GLEMT_PADRAO : CORPO_ATA_PADRAO);
  const corpoComTrecho = corpoBase.includes('{trecho_votacao}') || !VARS.trecho_votacao
    ? corpoBase
    : `${corpoBase}\n${VARS.trecho_votacao}`;
  // Parágrafo do voto em trânsito (editável no modelo): só entra se houver votantes cadastrados.
  // Vai no lugar de {trecho_voto_transito}; sem a variável no corpo, entra logo após ele.
  const trechoTransito = (ehEleicao && Number(VARS.qtd_votantes_transito) > 0 && modelo.corpo_voto_transito)
    ? interp(modelo.corpo_voto_transito) : '';
  VARS.trecho_voto_transito = trechoTransito;
  const corpoComTransito = corpoComTrecho.includes('{trecho_voto_transito}') || !trechoTransito
    ? corpoComTrecho
    : `${corpoComTrecho}\n${trechoTransito}`;
  const corpoTexto = [interp(corpoComTransito), (!ehEdital && modelo.rodape) ? interp(modelo.rodape) : '']
    .filter(t => String(t).trim() !== '').join('\n');
  const paragrafos = corpoTexto.split('\n').map(l => (l.trim() === ''
    ? par([ar('')], { after: 0 })
    : l.startsWith('§')
      // linhas de um mesmo bloco (ex.: chapa do edital): sem espaço entre elas
      ? par(runs(l.slice(1)), { align: AlignmentType.LEFT, after: 0 })
      : par(runs(l), { align: ALINHA(modelo.alinhamento_corpo, AlignmentType.JUSTIFIED) })));

  // Conteúdo em texto puro (usado pelo PDF que junta edital + relação de aptos)
  if (retornarTexto) {
    const tituloBaseT = modelo.titulo_doc || (ehEdital ? TITULO_EDITAL_GLEMT_PADRAO : ehEleicao ? TITULO_ELEICAO_GLEMT_PADRAO : TITULO_ATA_PADRAO);
    const tituloFinalT = (ehEdital && !tituloBaseT.includes('{numero_edital}'))
      ? tituloBaseT.replace(/^[^\n]*/, (l) => `${l.trimEnd()} Nº {numero_edital}`) : tituloBaseT;
    return {
      titulo: interp(tituloFinalT).replace(/\*/g, '').split('\n').filter(l => l.trim() !== ''),
      subtitulo: interp(modelo.subtitulo || '').replace(/\*/g, '').split('\n').filter(l => l.trim() !== ''),
      // cada parágrafo já interpolado; § marca linha colada à anterior
      paragrafos: corpoTexto.split('\n'),
      assinaturas: (ehEdital
        ? [[VARS.vm_nome, modelo.assinatura_1_cargo || 'Venerável Mestre']]
        : [[VARS.vm_nome, modelo.assinatura_1_cargo || 'Venerável Mestre'], [VARS.orador_nome, modelo.assinatura_2_cargo || 'Orador'], [VARS.secretario_nome, modelo.assinatura_3_cargo || 'Secretário']]
      ).map(([nome, cargo]) => ({ nome, cargo })),
      dadosLoja, numeroEdital: VARS.numero_edital || '', periodo: VARS.periodo_glemt_barra || '',
      dataEdital: (editalReg && editalReg.data_edital) || balaustre.eleicao_glemt?.data_edital || '',
      mostrarLogo: !!modelo.mostrar_logo, cabecalhoTexto: modelo.cabecalho_texto,
    };
  }

  // Assinaturas dos Escrutinadores (lado a lado), inseridas após a do Venerável Mestre
  const escrutinadoresAssinatura = [
    ...((ehEleicao && !ehEdital && (balaustre.eleicao_glemt?.escrutinadores_assinam ?? true)
         && (balaustre.eleicao_glemt?.escrutinador1_id || balaustre.eleicao_glemt?.escrutinador2_id))
      ? (() => {
          // Dois Escrutinadores na MESMA linha, em tabulações centralizadas (igual ao modelo em Word)
          const nomes = [VARS.escrutinador1_nome, VARS.escrutinador2_nome].filter(n => n && !String(n).startsWith('['));
          if (!nomes.length) return [];
          // Tabulações centralizadas a 4 cm e 12 cm da margem (1 cm ≈ 567 twips)
          const TABS = [
            { type: TabStopType.CENTER, position: 2268 },
            { type: TabStopType.CENTER, position: 6804 },
          ].slice(0, Math.max(nomes.length, 1));
          const linhaTab = (textos, bold = false, before = 0) => new Paragraph({
            tabStops: TABS, spacing: { before, after: 0, line: 240 },
            children: textos.flatMap(t => [new TextRun({ text: '\t' }), new TextRun({ text: t, bold })]),
          });
          return [
            linhaTab(nomes.map(() => '________________________________'), false, 600),
            linhaTab(nomes.map(n => `Ir∴ ${String(n).toUpperCase()}`), true),
            linhaTab(nomes.map((n, i) => `Escrutinador ${i + 1}`)),
          ];
        })()
      : [])
  ];

  const children = [
    // Cabeçalho: ata de eleição GLEMT usa o cabeçalho da Loja (logo à esquerda ou só texto);
    // atas de sessão simples mantêm o logo opcional centralizado
    ...((ehEleicao || ehEdital)
      ? cabecalhoLojaDocx({ dadosLoja, comLogo: !!modelo.mostrar_logo, larguraUtil: 11906 - margensDoModelo(modelo).left - margensDoModelo(modelo).right, after: 240, texto: modelo.cabecalho_texto, logoCm: modelo.logo_tamanho })
      : (modelo.mostrar_logo ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 },
        children: [new ImageRun({ type: 'jpg', data: b64ToBuffer(LOGO_LOJA_B64), transformation: { width: Math.round((Number(modelo.logo_tamanho) > 0 ? Number(modelo.logo_tamanho) : 3.5) * 37.8), height: Math.round((Number(modelo.logo_tamanho) > 0 ? Number(modelo.logo_tamanho) : 3.5) * 37.8) } })] })] : [])),
    // Título: cada linha do modelo = uma linha (título de 1 linha ganha "Sessão de <grau>")
    ...(() => {
      const tituloBase = modelo.titulo_doc || (ehEdital ? TITULO_EDITAL_GLEMT_PADRAO : ehEleicao ? TITULO_ELEICAO_GLEMT_PADRAO : TITULO_ATA_PADRAO);
      // Modelo salvo sem {numero_edital}: o número entra no fim da 1ª linha do título
      const tituloFinal = (ehEdital && !tituloBase.includes('{numero_edital}')) ? tituloBase.replace(/^[^\n]*/, (l) => `${l.trimEnd()} Nº {numero_edital}`) : tituloBase;
      const linhasTit = interp(tituloFinal).replace(/\*/g, '').split('\n').filter(l => l.trim() !== '');
      if (linhasTit.length === 1 && !ehEleicao && !ehEdital) linhasTit.push(`Sessão de ${VARS.grau_extenso}`);
      // Subtítulo (ex.: "Balaústre nº 12/2026") logo abaixo do título, antes do texto — não se aplica ao edital
      const sub = ehEdital ? '' : (modelo.subtitulo ?? SUBTITULO_ATA_PADRAO);
      const linhasSub = interp(sub).replace(/\*/g, '').split('\n').filter(l => l.trim() !== '');
      const todas = [...linhasTit.map(l => ({ l, bold: true })), ...linhasSub.map(l => ({ l, bold: false }))];
      return todas.map((x, i) => par([ar(x.l, { bold: x.bold })], { align: ALINHA(modelo.alinhamento_titulo, AlignmentType.CENTER), after: i === todas.length - 1 ? 280 : 0 }));
    })(),
    ...paragrafos,
    // Edital: cidade e data do edital
    ...(ehEdital ? [par([ar(`${VARS.cidade} – ${VARS.estado}, ${
      VARS.data_edital_extenso
      || (() => {   // sem registro em Editais, usa a data da aba Configuração
        const d = String(balaustre.eleicao_glemt?.data_edital || '').substring(0, 10);
        if (!d) return '';
        const [a, m, di] = d.split('-').map(Number);
        return `${String(di).padStart(2, '0')} de ${MESES[m - 1]} de ${a}`;
      })()
    }.`)], { align: AlignmentType.CENTER, before: 360, after: 0 })] : []),
    // Assinaturas (centralizadas): ata = VM, Orador e Secretário; edital = só o VM
    // Escrutinadores assinam a ata da eleição quando o marcador estiver ligado (padrão: ligado)
    // Cargos das assinaturas vêm do modelo (aba Assinaturas); vazio = padrão
    ...(ehEdital
      ? [[VARS.vm_nome, modelo.assinatura_1_cargo || 'Venerável Mestre']]
      : [[VARS.vm_nome, modelo.assinatura_1_cargo || 'Venerável Mestre'], [VARS.orador_nome, modelo.assinatura_2_cargo || 'Orador'], [VARS.secretario_nome, modelo.assinatura_3_cargo || 'Secretário']]
    ).flatMap(([n, c], i) => [
      linhaSimples(LINHA, false, i === 0 ? 700 : 600),
      linhaSimples(`Ir∴ ${String(n).toUpperCase()}`, true),
      linhaSimples(c),
      // Escrutinadores logo abaixo do Venerável Mestre (primeira assinatura)
      ...(i === 0 ? escrutinadoresAssinatura : []),
    ]),
  ];

  // Relação de Aptos a Votar a partir da página seguinte
  let filhos = children;
  if (comLista && Array.isArray(aptos)) {
    const { PageBreak, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType } = await import('docx');
    const W = 11906 - (margensDoModelo(modelo).left || 1134) - (margensDoModelo(modelo).right || 1134);
    const CW = [600, Math.round(W * 0.42), 1100, Math.round(W * 0.2)];
    CW.push(W - CW[0] - CW[1] - CW[2] - CW[3] > 0 ? W - CW[0] - CW[1] - CW[2] : 2000);
    const b = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
    const bordas = { top: b, bottom: b, left: b, right: b };
    const pad = { top: 60, bottom: 60, left: 100, right: 100 };
    const celA = (txt, w, { bold = false, align = AlignmentType.LEFT, head = false } = {}) => new TableCell({
      borders: bordas, width: { size: w, type: WidthType.DXA }, margins: pad,
      ...(head ? { shading: { fill: 'D9D9D9', type: ShadingType.CLEAR } } : {}),
      children: [par([ar(txt, { bold })], { align, after: 0 })],
    });
    const colunas = [CW[0], CW[1], CW[2], CW[3]];
    filhos = [
      ...children,
      new Paragraph({ children: [new PageBreak()] }),
      par([ar('RELAÇÃO DE IRMÃOS APTOS A VOTAR', { bold: true })], { align: AlignmentType.CENTER, after: 160 }),
      new Table({
        width: { size: W, type: WidthType.DXA }, columnWidths: colunas,
        rows: [
          new TableRow({ tableHeader: true, children: [
            celA('Nº', colunas[0], { bold: true, align: AlignmentType.CENTER, head: true }),
            celA('Irmão', colunas[1], { bold: true, head: true }),
            celA('CIM', colunas[2], { bold: true, align: AlignmentType.CENTER, head: true }),
            celA('Assinatura', colunas[3], { bold: true, align: AlignmentType.CENTER, head: true }),
          ] }),
          ...aptos.map((a, i) => new TableRow({ children: [
            celA(String(i + 1), colunas[0], { align: AlignmentType.CENTER }),
            celA(a.nome || '', colunas[1]),
            celA(a.cim || '', colunas[2], { align: AlignmentType.CENTER }),
            celA('', colunas[3]),
          ] })),
        ],
      }),
      par([ar(`Total de Irmãos aptos a votar: ${aptos.length}`)], { align: AlignmentType.LEFT, before: 120, after: 0 }),
    ];
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Times New Roman', size: 24 } } } },
    sections: [{
      // Rodapé: numeração "1 de 3" à direita
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
      new TextRun({ children: [PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], font: 'Times New Roman', size: 20 }),
    ] })] }) },
      properties: { page: { size: { width: 11906, height: 16838 }, margin: margensDoModelo(modelo) } },
      children: filhos,
    }],
  });
  const blob = await Packer.toBlob(doc);
  const sufixo = comLista ? '_com_Aptos' : '';
  const nome = ehEdital
    ? `Edital_${String(VARS.numero_edital || '').replace('/', '-')}_Eleicao_GLEMT_${String(VARS.periodo_glemt_barra || '').replace('/', '-')}${sufixo}.docx`
    : `Ata_${grau}_${VARS.numero_balaustre}-${VARS.ano_balaustre}${sufixo}.docx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return { faltando: (ehEdital ? [!vm && 'Venerável Mestre'] : [!vm && 'Venerável Mestre', !orador && 'Orador', !secretario && 'Secretário']).filter(Boolean) };
};

// Edital de convocação da eleição GLEMT (assinado só pelo VM)
export const gerarEditalEleicaoGLEMT = async ({ balaustre, comLista = false, aptos = null }) => gerarAtaSessao({ balaustre, documento: 'edital', comLista, aptos });

// ════════════════════════════════════════════════════════════════════════
// Lista de presença — Sessão Eleitoral da GLEMT (Mestres regulares na data)
// ════════════════════════════════════════════════════════════════════════
// Modelo próprio da lista de presença (Modelos de Documentos → Balaustres)
export const TIPO_LISTA_GLEMT = 'lista_presenca_glemt';
export const TITULO_LISTA_GLEMT_PADRAO = 'LISTA DE PRESENÇA — SESSÃO ELEITORAL\nEleição de Grão-Mestre e Grão-Mestre Adjunto da GLEMT — Período {periodo_glemt}';
export const CORPO_LISTA_GLEMT_PADRAO = 'Sessão de {data_sessao}';

// Monta o conteúdo da lista (usado solto e anexado ao edital/ata)
const conteudoListaPresencaGLEMT = async ({ balaustre }) => {
  const { Table, TableRow, TableCell, WidthType, BorderStyle } = await import('docx');
  const [{ data: lojaData }, { data: irmaosData }, { data: modEl }] = await Promise.all([
    supabase.from('dados_loja').select('*').limit(1),
    supabase.from('irmaos').select('id, nome, cim, data_exaltacao, situacao, data_falecimento'),
    supabase.from('modelos_documentos').select('*').eq('tipo', TIPO_ATA_ELEICAO_GLEMT).maybeSingle(),
  ]);
  const { data: modLista } = await supabase.from('modelos_documentos').select('*').eq('tipo', TIPO_LISTA_GLEMT).maybeSingle();
  // Venerável Mestre do ano da sessão (Corpo Administrativo) para a assinatura da lista
  const anoSes = parseInt(String(balaustre.data_sessao || '').substring(0, 4)) || new Date().getFullYear();
  const { data: corpoTodos } = await supabase.from('corpo_administrativo').select('cargo, ano_exercicio, irmao_id');
  const regVm = (corpoTodos || []).find(c => String(c.ano_exercicio || '').split(/[^0-9]+/).includes(String(anoSes))
    && ['veneravel mestre', 'veneravel'].includes(NORM(c.cargo)));
  const nomeVm = regVm ? (irmaosData || []).find(i => i.id === regVm.irmao_id)?.nome : null;
  const dadosLoja = (lojaData && lojaData[0]) || {};
  const modeloEl = modEl || {};
  // Usa o modelo da lista; sem ele, as opções antigas da ata de eleição (logo da lista e margens)
  const modeloLista = modLista || { titulo_doc: TITULO_LISTA_GLEMT_PADRAO, corpo: CORPO_LISTA_GLEMT_PADRAO,
    mostrar_logo: !!modeloEl.mostrar_logo_lista,
    margem_sup: modeloEl.margem_sup, margem_inf: modeloEl.margem_inf, margem_esq: modeloEl.margem_esq, margem_dir: modeloEl.margem_dir };
  const margens = margensDoModelo(modeloLista);
  const FONTE_TABELA = Number(modeloLista.fonte_tamanho) > 0 ? Math.round(Number(modeloLista.fonte_tamanho) * 2) : 22; // padrão 11
  const d = String(balaustre.data_sessao || '').substring(0, 10);
  const el = balaustre.eleicao_glemt || {};
  // Presença marcada no balaustre → só os presentes; sem marcação → todos os Mestres aptos
  const presentes = (el.presentes || []).map(String);
  const mestres = (irmaosData || [])
    .filter(i => !presentes.length || presentes.includes(String(i.id)))
    .filter(i => presentes.length || String(i.situacao || 'regular').toLowerCase() === 'regular')
    .filter(i => i.data_exaltacao && (!d || i.data_exaltacao <= d))
    .filter(i => !i.data_falecimento || (d && i.data_falecimento > d))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  const periodo = el.ano_inicio && el.ano_fim ? `${el.ano_inicio} a ${el.ano_fim}` : '';

  const ar = (t, o = {}) => new TextRun({ text: String(t ?? ''), font: 'Times New Roman', size: o.size || 24, bold: !!o.bold });
  const par = (children, o = {}) => new Paragraph({ alignment: o.align ?? AlignmentType.CENTER, spacing: { before: o.before ?? 0, after: o.after ?? 0, line: 240 }, children });
  const fino = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
  const bd = { top: fino, bottom: fino, left: fino, right: fino };
  const W = 11906 - margens.left - margens.right;
  // Nº e CIM estreitos, nome menor (fonte 11) e mais espaço para a assinatura
  const CW = [500, 3500, 950, W - 4950];
  // Votantes em trânsito (Irmãos de outras Lojas): tabela própria, no fim da lista
  const transitoLista = el.voto_transito ? (el.votantes_transito || []).filter(v => v && (v.nome || '').trim()) : [];
  const CW_T = [500, 3500, 950, W - 4950];
  // Uma tabela por Oriente/Oficina, na ordem em que foram cadastrados
  const gruposTransito = transitoLista.reduce((acc, v) => {
    const chave = `${(v.oriente || '').trim()}||${(v.loja || '').trim()}`;
    let g = acc.find(x => x.chave === chave);
    if (!g) { g = { chave, oriente: (v.oriente || '').trim(), loja: (v.loja || '').trim(), irmaos: [] }; acc.push(g); }
    g.irmaos.push(v);
    return acc;
  }, []);
  const cel = (t, w, o = {}) => new TableCell({ borders: bd, width: { size: w, type: WidthType.DXA }, margins: { top: 150, bottom: 150, left: 80, right: 80 }, // espaço para assinar
    children: [par([ar(t, { ...o, size: FONTE_TABELA })], { align: o.align ?? AlignmentType.LEFT })] }); // tabela: fonte do modelo (padrão 11)

  const tabela = new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: CW,
    rows: [
      new TableRow({ tableHeader: true, children: [cel('Nº', CW[0], { bold: true, align: AlignmentType.CENTER }), cel('Irmão', CW[1], { bold: true }), cel('CIM', CW[2], { bold: true, align: AlignmentType.CENTER }), cel('Assinatura', CW[3], { bold: true, align: AlignmentType.CENTER })] }),
      ...mestres.map((m, i) => new TableRow({ children: [
        cel(String(i + 1), CW[0], { align: AlignmentType.CENTER }), cel(m.nome, CW[1]), cel(m.cim || '', CW[2], { align: AlignmentType.CENTER }), cel('', CW[3]),
      ] })),
    ],
  });

  const dataFmt = d ? d.split('-').reverse().join('/') : '';
  const filhosLista = [
        // Cabeçalho da Loja (logo à esquerda, ou só texto se desmarcado)
        ...cabecalhoLojaDocx({ dadosLoja, comLogo: !!modeloLista.mostrar_logo, larguraUtil: W, after: 240, texto: modeloLista.cabecalho_texto, logoCm: modeloLista.logo_tamanho }),
        // Título (negrito) e texto abaixo, ambos do modelo — cada linha vira uma linha
        ...(() => {
          const vars = { periodo_glemt: periodo || '[período]', periodo_glemt_barra: el.ano_inicio && el.ano_fim ? `${el.ano_inicio}/${el.ano_fim}` : '[período]',
            data_sessao: dataFmt || '[data]', nome_loja: `ACÁCIA DE PARANATINGA Nº ${dadosLoja.numero_loja || '30'}`, total_presentes: String(mestres.length) };
          const it = (t) => Object.entries(vars).reduce((x, [k, v]) => x.replaceAll(`{${k}}`, v), String(t || ''));
          const tit = it(modeloLista.titulo_doc ?? TITULO_LISTA_GLEMT_PADRAO).replace(/\*/g, '').split('\n').filter(l => l.trim());
          const txt = it(modeloLista.corpo ?? CORPO_LISTA_GLEMT_PADRAO).replace(/\*/g, '').split('\n').filter(l => l.trim());
          const todas = [...tit.map(l => ({ l, b: true })), ...txt.map(l => ({ l, b: false }))];
          return todas.map((x, i) => par([ar(x.l, { bold: x.b })], { after: i === todas.length - 1 ? 240 : 0 }));
        })(),
        tabela,
        par([ar(presentes.length ? `Total de Mestres presentes: ${mestres.length}` : `Total de Mestres aptos: ${mestres.length}`)], { align: AlignmentType.LEFT, after: 0 }),
        // Votantes em trânsito: título, e uma tabela por Oriente/Oficina (só se houver algum cadastrado)
        ...(transitoLista.length ? [
          par([ar('VOTANTES EM TRÂNSITO', { bold: true })], { align: AlignmentType.CENTER, before: 500, after: 160 }),
          ...gruposTransito.flatMap(g => [
            par([ar('Oriente: ', { bold: true }), ar(g.oriente || '[oriente]', { bold: true })], { align: AlignmentType.LEFT, after: 0 }),
            par([ar('Oficina: ', { bold: true }), ar(g.loja || '[oficina]', { bold: true })], { align: AlignmentType.LEFT, after: 120 }),
            new Table({
              width: { size: W, type: WidthType.DXA }, columnWidths: CW_T,
              rows: [
                new TableRow({ tableHeader: true, children: [
                  cel('Nº', CW_T[0], { bold: true, align: AlignmentType.CENTER }), cel('Irmão', CW_T[1], { bold: true }),
                  cel('CIM', CW_T[2], { bold: true, align: AlignmentType.CENTER }), cel('Assinatura', CW_T[3], { bold: true, align: AlignmentType.CENTER }),
                ] }),
                ...g.irmaos.map((v, i) => new TableRow({ children: [
                  cel(String(i + 1), CW_T[0], { align: AlignmentType.CENTER }), cel(v.nome || '', CW_T[1]),
                  cel(v.cim || '', CW_T[2], { align: AlignmentType.CENTER }), cel('', CW_T[3]),
                ] })),
              ],
            }),
            par([ar('')], { after: 160 }),
          ]),
          par([ar(`Total de votantes em trânsito: ${transitoLista.length}`)], { align: AlignmentType.LEFT, after: 0 }),
        ] : []),
        // Assinatura do Venerável Mestre (cargo editável no modelo, aba Assinaturas)
        par([ar('_____________________________________')], { before: 700, after: 0 }),
        par([ar(nomeVm ? `Ir∴ ${nomeVm.toUpperCase()}` : '[VENERÁVEL MESTRE]', { bold: true })]),
        par([ar(modeloLista.assinatura_1_cargo || 'Venerável Mestre')]),
  ];
  return { children: filhosLista, margens, dataFmt };
};

export const gerarListaPresencaEleicaoGLEMT = async ({ balaustre }) => {
  const { children: filhosLista, margens, dataFmt } = await conteudoListaPresencaGLEMT({ balaustre });
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Times New Roman', size: 24 } } } },
    sections: [{
      // Rodapé: numeração "1 de 3" à direita
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
        new TextRun({ children: [PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], font: 'Times New Roman', size: 20 }),
      ] })] }) },
      properties: { page: { size: { width: 11906, height: 16838 }, margin: margens } },
      children: filhosLista,
    }],
  });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `Lista_Presenca_Eleicao_GLEMT_${dataFmt.replace(/\//g, '-')}.docx`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
