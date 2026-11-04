/**
 * MÓDULO ELEIÇÃO & POSSE
 * ARLS Acácia de Paranatinga nº 30
 * 
 * Fluxo: Configurar → Sessão Eleição → Sessão Posse → Documentos
 * Gera: Editais, Atas (Loja e Cartório), Listas de Presença, Requerimentos
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import {
  Document, Packer, PageBreak, Paragraph, TextRun, ImageRun,
  AlignmentType, UnderlineType, BorderStyle, WidthType,
  Table, TableRow, TableCell, ShadingType, VerticalAlign, Tab, TabStopType, Footer, PageNumber,
} from 'docx';
import { CARGOS_ADMINISTRATIVOS } from '../../utils/constants';
import { gerarQuadroGestaoPDF } from '../../utils/gerarQuadroGestaoPDF';
import { cabecalhoLojaDocx, linhasCabecalho } from '../../utils/cabecalhoLoja';
import { gerarAptosVotarPDF } from '../../utils/gerarAptosVotarPDF';
import { calcularAptidaoVoto } from '../../utils/calcularAptidaoVoto';
import { emitirEdital } from '../../utils/editais';
import { gerarEditalAptosPDF } from '../../utils/gerarEditalAptosPDF';
import VincularEdital from '../editais/VincularEdital';

// ─── Utilitários ────────────────────────────────────────────────────────────

// ── Edital: ano e número (sequência por ano, compartilhada entre eleição e posse) ──
// Ano padrão = ano da eleição (edital de eleição) ou da posse (edital de posse); editável.
const anoPadraoEdital = (eleicao, posse) => {
  const d = posse ? (eleicao?.data_posse || eleicao?.data_edital_posse) : (eleicao?.data_eleicao || eleicao?.data_edital_eleicao);
  return parseInt(String(d || '').substring(0, 4)) || new Date().getFullYear();
};
const anoDoEdital = (eleicao, posse) => Number(posse ? eleicao?.edital_posse_ano : eleicao?.edital_eleicao_ano) || anoPadraoEdital(eleicao, posse);
const formatarNumeroEdital = (n, ano) => (n ? `${String(n).padStart(2, '0')}/${ano}` : '');

// Rótulo acentuado dos cargos (o valor gravado no banco continua sem acento)
const ROTULO_CARGO = {
  'Veneravel Mestre': 'Venerável Mestre',
  'Secretario': 'Secretário',
  'Mestre de Cerimonia': 'Mestre de Cerimônia',
  'Mestre de Cerimonia Adjunto': 'Mestre de Cerimônia Adjunto',
  '1 Experto': '1º Experto',
  '2 Experto': '2º Experto',
  '1 Diácono': '1º Diácono',
  '2 Diácono': '2º Diácono',
  'Bibliotecario': 'Bibliotecário',
};
const rotuloCargo = (c) => ROTULO_CARGO[c] || String(c || '')
  .replace(/^1 /, '1º ').replace(/^2 /, '2º ');

// Número por extenso (até 999), para as variáveis de quantidade
const UNID_EXT = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze',
  'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove', 'vinte'];
const DEZ_EXT = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENT_EXT = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
const numeroPorExtenso = (valor) => {
  const n = Math.trunc(Number(valor) || 0);
  if (n <= 0) return 'zero';
  if (n <= 20) return UNID_EXT[n];
  if (n < 100) { const d = Math.floor(n / 10), u = n % 10; return u ? `${DEZ_EXT[d]} e ${UNID_EXT[u]}` : DEZ_EXT[d]; }
  if (n === 100) return 'cem';
  if (n < 1000) { const c = Math.floor(n / 100), r = n % 100; return r ? `${CENT_EXT[c]} e ${numeroPorExtenso(r)}` : CENT_EXT[c]; }
  return String(n);
};

const formatarData = (d) => {
  if (!d) return '';
  const [ano, mes, dia] = d.split('-');
  return `${dia}/${mes}/${ano}`;
};

const formatarDataExtenso = (d) => {
  if (!d) return '';
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const [ano, mes, dia] = d.split('-');
  return `${parseInt(dia)} de ${meses[parseInt(mes)-1]} de ${ano}`;
};

const ORDEM_CARGOS = CARGOS_ADMINISTRATIVOS;
// Atas do Cartório (eleição e posse): só estes cargos entram, com qualificação completa
const CARGOS_ATA_CARTORIO = [
  'Veneravel Mestre', 'Venerável Mestre',
  'Primeiro Vigilante', '1º Vigilante',
  'Segundo Vigilante', '2º Vigilante',
  'Orador',
  'Secretario', 'Secretário',
  'Tesoureiro',
  'Chanceler',
];

// ─── Geração de DOCX ────────────────────────────────────────────────────────


// ─── Geração de documentos Word (.docx) ────────────────────
// Logo da loja embutido em base64 (extraído do documento modelo)

const LOGO_LOJA_B64 = "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";

const b64ToBuffer = (b64) => {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
};

const DOC_CFG = {
  W: 11906, H: 16838,
  mLeft: 1701, mRight: 863, mTop: 720, mBottom: 720,
};

// ── Interpolação de variáveis nos modelos ─────────────────────
const interpolarModelo = (texto, vars) => {
  if (!texto) return '';
  return Object.entries(vars).reduce((t, [k, v]) => t.replaceAll(`{${k}}`, v || ''), texto);
};

// ── Buscar modelos do banco (cache em memória por sessão) ──────
let _modelosCache = null;
const buscarModelos = async () => {
  if (_modelosCache) return _modelosCache;
  const { data } = await supabase.from('modelos_documentos').select('*');
  _modelosCache = {};
  (data || []).forEach(m => { _modelosCache[m.tipo] = m; });
  return _modelosCache;
};

// ── Requerimentos: quem assina ─────────────────────────────────
// Configuração por requerimento (eleicao/posse): data de emissão (vazia = hoje)
// e assinante: 'auto' | 'sainte' | 'eleito' | 'outro' (+ irmão escolhido).
// Automático: emitido antes do Início da Gestão → VM Sainte; senão → VM Eleito.
const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const resolverAssinanteRequerimento = (qual, eleicao, chapas, irmaos) => {
  const dataEmissao = eleicao?.[`req_${qual}_data`] || hojeISO();
  const modo = eleicao?.[`req_${qual}_assinante`] || 'auto';
  const vmEleitoChapa = (chapas || []).filter(c => c.eleita).find(c => c.cargo === 'Veneravel Mestre' || c.cargo === 'Venerável Mestre');
  const idSainte = eleicao?.vm_convocante_id || null;
  const idEleito = vmEleitoChapa?.irmao_id || null;
  let origem = modo;
  let id = null;
  if (modo === 'sainte') id = idSainte;
  else if (modo === 'eleito') id = idEleito;
  else if (modo === 'outro') id = eleicao?.[`req_${qual}_assinante_id`] || null;
  else {
    const corte = eleicao?.data_inicio_gestao || eleicao?.data_posse || null;
    origem = corte && dataEmissao < corte ? 'sainte' : 'eleito';
    id = origem === 'sainte' ? idSainte : idEleito;
  }
  const irmao = (irmaos || []).find(i => i.id === id) || null;
  return { dataEmissao, modo, origem, irmao };
};

// Nome curto: dois primeiros nomes; se o 2º for preposição, inclui o seguinte ("José da Silva")
const PREPOSICOES = ['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'du', 'del'];
const nomeCurto = (nome) => {
  const p = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (p.length <= 2) return p.join(' ');
  if (PREPOSICOES.includes(p[1].toLowerCase())) return p.slice(0, 3).join(' ');
  return p.slice(0, 2).join(' ');
};

// ── Situação do irmão NA DATA do ato (usa o histórico de situações) ──
// Retorna 'regular' | 'licenciado' | 'irregular' | 'desligado' | 'falecido' | <situação atual>
// Assim, uma licença/desligamento posterior não altera eleição já realizada.
const situacaoNaData = (i, dataISO, historico) => {
  const atual = String(i?.situacao || 'regular').toLowerCase();
  if (!dataISO) return atual;
  const d = String(dataISO).substring(0, 10);
  if (i.data_falecimento && i.data_falecimento <= d) return 'falecido';
  const hist = (historico || []).filter(h => h.membro_id === i.id && h.status !== 'cancelada');
  // Situação sem data de fim: vale até hoje se o cadastro já voltou a "regular"
  // (licença resolvida sem lançar a data de fim no histórico); senão, continua em aberto.
  const hojeSit = new Date().toISOString().substring(0, 10);
  const fimEfetivo = (h) => h.data_fim || (atual === 'regular' ? hojeSit : null);
  const cobre = hist.find(h => h.data_inicio && h.data_inicio <= d && (!fimEfetivo(h) || (h.data_fim ? h.data_fim >= d : d < fimEfetivo(h))));
  if (cobre) {
    const t = String(cobre.tipo_situacao || '').toLowerCase();
    if (t.includes('licen')) return 'licenciado';
    if (t.includes('deslig') || t.includes('exclu') || t.includes('quite') || t.includes('placet')) return 'desligado';
    if (t.includes('falec')) return 'falecido';
    return 'irregular';
  }
  if (atual === 'regular') return 'regular';
  // Licença já encerrada antes da data (cadastro ainda marcado como licenciado) → regular
  if (atual.includes('licen')) {
    const lics = hist.filter(h => String(h.tipo_situacao || '').toLowerCase().includes('licen'));
    if (lics.length && lics.every(h => h.data_fim && h.data_fim < d)) return 'regular';
  }
  // Situação atual não-regular que começou DEPOIS da data → era regular na data
  if (hist.some(h => h.data_inicio && h.data_inicio > d)) return 'regular';
  if (i.data_desligamento && i.data_desligamento > d) return 'regular';
  return atual;
};

// ── Quórum da eleição: 1/3 do total de irmãos Mestres ─────────
// Mestres = exaltados até a data da eleição, situação Regular ou Licenciado
// (irregulares não contam), sem falecidos/desligados até a data.
// eleicao.total_mestres_quorum (Configuração) substitui o cálculo, se preenchido.
const calcularQuorum = (irmaos, eleicao, presencas, historico = []) => {
  const dAto = eleicao?.data_eleicao ? new Date(eleicao.data_eleicao + 'T00:00:00') : new Date();
  const antesDoAto = (d) => d && new Date(d + 'T00:00:00') <= dAto;
  const totalCalculado = (irmaos || []).filter(i => {
    // situação NA DATA da eleição (licenciados contam, por enquanto)
    const sit = situacaoNaData(i, eleicao?.data_eleicao, historico);
    if (!['regular', 'licenciado'].includes(sit)) return false;
    if (!antesDoAto(i.data_exaltacao)) return false;
    if (antesDoAto(i.data_falecimento) || antesDoAto(i.data_desligamento)) return false;
    return true;
  }).length;
  const totalMestres = Number(eleicao?.total_mestres_quorum) > 0 ? Number(eleicao.total_mestres_quorum) : totalCalculado;
  const quorumMinimo = Math.ceil(totalMestres / 3);
  const presentes = Number(eleicao?.num_votantes_eleicao) || (presencas || []).filter(p => p.sessao === 'eleicao').length;
  return { totalCalculado, totalMestres, quorumMinimo, presentes, atingido: presentes >= quorumMinimo };
};

const gerarDocx = async (tipo, eleicaoRecebida, chapas, presencas, dadosLoja, irmaos, historico = [], balaustresEl = [], modeloEscolhido = null, comLista = false, dataEmissao = null) => {
  // Garantia: se o número/data do edital não vieram prontos, busca pelo vínculo em Editais
  let eleicao = eleicaoRecebida;
  // Mestres aptos a votar: o cálculo automático com os ajustes manuais da eleição
  // (quem estava inapto e foi marcado como apto entra na conta)
  let aptosDaEleicao = 0;
  try {
    const refApt = String(eleicaoRecebida?.data_eleicao || new Date().toISOString()).substring(0, 10);
    const iniApt = (() => { const d = new Date(`${refApt}T00:00:00`); d.setFullYear(d.getFullYear() - 1); return d.toISOString().substring(0, 10); })();
    const linhasApt = await calcularAptidaoVoto({
      ref: refApt, ini: iniApt, irmaos: irmaos || [],
      ajustes: eleicaoRecebida?.aptidao_ajustes || {},   // inapto → apto entra na conta
    });
    aptosDaEleicao = (linhasApt || []).filter(l => l.apto).length;
  } catch (e) {
    aptosDaEleicao = 0;
  }

  const TIPOS_COM_EDITAL = ['edital_eleicao', 'edital_posse', 'ata_eleicao_loja', 'ata_eleicao_cartorio', 'ata_posse', 'ata_posse_cartorio'];
  if (TIPOS_COM_EDITAL.includes(tipo)) {
    const posse = tipo === 'edital_posse' || tipo === 'ata_posse' || tipo === 'ata_posse_cartorio';
    const num = posse ? eleicao?.edital_posse_numero : eleicao?.edital_eleicao_numero;
    const idEd = posse ? eleicao?.edital_posse_id : eleicao?.edital_eleicao_id;
    if (!num && idEd) {
      const { data: ed } = await supabase.from('editais').select('*').eq('id', idEd).maybeSingle();
      if (ed) {
        eleicao = { ...eleicao,
          [posse ? 'edital_posse_numero' : 'edital_eleicao_numero']: ed.numero,
          [posse ? 'edital_posse_ano' : 'edital_eleicao_ano']: ed.ano,
          [posse ? 'data_edital_posse' : 'data_edital_eleicao']:
            (posse ? eleicao?.data_edital_posse : eleicao?.data_edital_eleicao) || ed.data_edital,
        };
      }
    }
  }

  const modelos      = await buscarModelos();
  // Ata de Posse (Cartório) sem modelo próprio ainda: usa o texto do modelo de Ata de Posse
  const modelo       = modeloEscolhido || modelos[tipo] || (tipo === 'ata_posse_cartorio' ? modelos['ata_posse'] : null) || {};
  // Formatação do modelo (Modelos de Documentos): fonte, entrelinha e margens — vazio = padrão
  const FONTE = Number(modelo.fonte_tamanho) > 0 ? Math.round(Number(modelo.fonte_tamanho) * 2) : 24;   // meio-pontos
  const LINHA = Number(modelo.espacamento_linhas) > 0 ? Math.round(Number(modelo.espacamento_linhas) * 240) : 276;
  const cmTw = (v, pad) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? pad : Math.round(Number(v) * 567));
  const MARG = {
    top: cmTw(modelo.margem_sup, DOC_CFG.mTop), bottom: cmTw(modelo.margem_inf, DOC_CFG.mBottom),
    left: cmTw(modelo.margem_esq, DOC_CFG.mLeft), right: cmTw(modelo.margem_dir, DOC_CFG.mRight),
  };

  const chapaEleita = chapas.filter(c => c.eleita);
  // ── Gestão SAINTE — assina Editais e Atas de Eleição ────────
  const vmConvocante     = irmaos.find(i => i.id === eleicao.vm_convocante_id);
  const oradorSainte     = irmaos.find(i => i.id === eleicao.orador_sainte_id);
  const secretarioSainte = irmaos.find(i => i.id === eleicao.secretario_sainte_id);

  // Substitutos para ata de eleição (quando orador/secretário sainte concorrem)
  const primeiroVigilanteSainte = irmaos.find(i => i.id === eleicao.primeiro_vigilante_sainte_id) || null;
  const segundoVigilanteSainte  = irmaos.find(i => i.id === eleicao.segundo_vigilante_sainte_id)  || null;
  const oradorAta        = irmaos.find(i => i.id === eleicao.orador_substituto_ata_id) || oradorSainte;
  const secretarioAta    = irmaos.find(i => i.id === eleicao.secretario_substituto_ata_id) || secretarioSainte;

  // ── Instaladores — assinam a Ata de Posse ────────────────────
  const vmInstalador               = irmaos.find(i => i.id === eleicao.vm_instalador_id)                    || vmConvocante;
  const primeiroVigilanteInstalador = irmaos.find(i => i.id === eleicao.primeiro_vigilante_instalador_id) || null;
  const segundoVigilanteInstalador  = irmaos.find(i => i.id === eleicao.segundo_vigilante_instalador_id)  || null;
  const oradorInstalador            = irmaos.find(i => i.id === eleicao.orador_instalador_id)             || oradorSainte;
  const secretarioInstalador        = irmaos.find(i => i.id === eleicao.secretario_instalador_id)         || secretarioSainte;

  // ── Gestão ELEITA — vem da chapa; assina Requerimentos ───────
  const vmEleito             = chapaEleita.find(c => c.cargo === 'Veneravel Mestre' || c.cargo === 'Venerável Mestre');
  const vmEleitoNome         = vmEleito ? (irmaos.find(i => i.id === vmEleito.irmao_id)?.nome || '[VM Eleito]') : '[VM Eleito]';
  const oradorEleito         = chapaEleita.find(c => c.cargo === 'Orador');
  const oradorEleitoNome     = oradorEleito ? (irmaos.find(i => i.id === oradorEleito.irmao_id)?.nome || '[Orador]') : '[Orador]';
  const secretarioEleito     = chapaEleita.find(c => c.cargo === 'Secretario' || c.cargo === 'Secretário');
  const secretarioEleitoNome = secretarioEleito ? (irmaos.find(i => i.id === secretarioEleito.irmao_id)?.nome || '[Secretário]') : '[Secretário]';

  const presidente = irmaos.find(i => i.id === eleicao.presidente_eleito_id)
                     || irmaos.find(i => i.id === vmEleito?.irmao_id);
  const gestao       = eleicao.gestao || '';
  const nomeLoja     = `ACÁCIA DE PARANATINGA Nº ${dadosLoja.numero_loja || '30'}`;
  const enderecoLoja = dadosLoja.endereco || 'Avenida Brasil, nº 2.300, bairro Jardim Panorama';
  const cidadeUF     = `${dadosLoja.cidade || 'Paranatinga'}/${dadosLoja.estado || 'MT'}`;
  const presEleicao  = presencas.filter(p => p.sessao === 'eleicao');
  const presPosse    = presencas.filter(p => p.sessao === 'posse');

  const dadoIrmao = (irmaoId) => {
    const i = irmaos.find(x => x.id === irmaoId);
    if (!i) return '[Irmão não encontrado]';

    // Nome do pai e da mãe vêm da relação pais[] com campo tipo='pai'/'mae'
    const paisArr  = i.pais || [];
    const nomePai  = paisArr.find(p => p.tipo === 'pai')?.nome || null;
    const nomeMae  = paisArr.find(p => p.tipo === 'mae')?.nome || null;
    const filiacao = (nomePai && nomeMae)
      ? `filho de ${nomePai} e ${nomeMae}`
      : nomePai ? `filho de ${nomePai}`
      : nomeMae ? `filho de ${nomeMae}`
      : null;

    // Endereço completo: rua, nº, complemento, bairro, cidade/UF, CEP
    const logradouro = [
      i.endereco,
      i.numero ? `nº ${i.numero}` : null,
      i.complemento || null,
      i.bairro ? `bairro ${i.bairro}` : null,
    ].filter(Boolean).join(', ');
    const cidadeEnd = [i.cidade, i.estado].filter(Boolean).join('/');
    const endParts = [logradouro, cidadeEnd, i.cep ? `CEP ${i.cep}` : null].filter(Boolean);
    const endereco = endParts.length > 0 ? `residente e domiciliado na ${endParts.join(', ')}` : null;

    // Estado civil por extenso (valor gravado é código: 'uniao_estavel', 'viuvo'...)
    // + união estável (obrigatório, exceto casado): "solteiro, convivente em união estável"
    //   ou "solteiro, não convivente em união estável"
    const ESTADO_CIVIL_TEXTO = { solteiro: 'solteiro', casado: 'casado', divorciado: 'divorciado', viuvo: 'viúvo' };
    const ecBase = i.estado_civil ? (ESTADO_CIVIL_TEXTO[i.estado_civil] || i.estado_civil) : null;
    const ueTexto = i.estado_civil === 'casado' ? null
      : i.uniao_estavel === true ? 'convivente em união estável'
      : i.uniao_estavel === false ? 'não convivente em união estável'
      : '[união estável não informada]';
    // Sem estado civil: marca no documento para ser corrigido antes de levar ao cartório
    const estadoCivil = [ecBase || '[estado civil não informado]', ueTexto].filter(Boolean).join(', ');

    return [
      i.nome,
      i.nacionalidade || 'brasileiro',
      estadoCivil,
      i.profissao     || null,
      i.naturalidade  ? `natural de ${i.naturalidade}` : null,  // naturalidade = cidade de nascimento (não a de residência)
      i.data_nascimento ? `nascido em ${formatarData(i.data_nascimento)}` : null,
      filiacao,
      i.rg  ? `portador da Cédula de Identidade RG sob nº ${i.rg}` : null,
      i.cpf ? `CPF/MF nº ${i.cpf}` : null,
      endereco,
    ].filter(Boolean).join(', ');
  };

  // Atas da Loja (eleição e posse): só CIM e nome (a qualificação completa fica na ata do Cartório)
  const dadoIrmaoLoja = (irmaoId) => {
    const i = irmaos.find(x => x.id === irmaoId);
    if (!i) return '[Irmão não encontrado]';
    return `${i.nome}, CIM nº ${i.cim || '[CIM não informado]'}`;
  };

  // Qualificação para requerimentos (sem naturalidade/filiação), no formato do cartório:
  // "brasileiro, casado, contador, portador do RG nº X e inscrito no CPF/MF sob nº Y,
  //  residente e domiciliado na Rua..., nº ..., Centro, Paranatinga – MT"
  const qualificacaoRequerimento = (i) => {
    if (!i) return '[qualificação do presidente]';
    const ESTADO_CIVIL_TEXTO = { solteiro: 'solteiro', casado: 'casado', divorciado: 'divorciado', viuvo: 'viúvo' };
    const ecBase = i.estado_civil ? (ESTADO_CIVIL_TEXTO[i.estado_civil] || i.estado_civil) : '[estado civil não informado]';
    const ue = i.estado_civil === 'casado' ? null
      : i.uniao_estavel === true ? 'convivente em união estável'
      : i.uniao_estavel === false ? 'não convivente em união estável'
      : '[união estável não informada]';
    const docs = [
      i.rg ? `portador do RG nº ${i.rg}` : null,
      i.cpf ? `inscrito no CPF/MF sob nº ${i.cpf}` : null,
    ].filter(Boolean).join(' e ');
    const end = [
      i.endereco,
      i.numero ? `nº ${i.numero}` : null,
      i.complemento || null,
      i.bairro || null,
      [i.cidade, i.estado].filter(Boolean).join(' – ') || null,
    ].filter(Boolean).join(', ');
    return [
      i.nacionalidade || 'brasileiro',
      ecBase, ue,
      i.profissao || null,
      docs || null,
      end ? `residente e domiciliado na ${end}` : null,
    ].filter(Boolean).join(', ');
  };

  // ── Mapa de variáveis para interpolação ─────────────────────
  const orador_el  = chapaEleita.find(c => c.cargo === 'Orador');
  const oradorNome = orador_el ? (irmaos.find(i => i.id === orador_el.irmao_id)?.nome || '') : '';
  const presEleicaoLen = presencas.filter(p => p.sessao === 'eleicao').length;
  const presePosseLen  = presencas.filter(p => p.sessao === 'posse').length;

  const VARS = {
    vm_nome:                  vmConvocante?.nome || '[VM Sainte]',
    gestao,
    // Período da gestão (aba Configuração)
    data_inicio_gestao:       eleicao.data_inicio_gestao ? formatarData(eleicao.data_inicio_gestao) : '[início da gestão]',
    data_fim_gestao:          eleicao.data_fim_gestao ? formatarData(eleicao.data_fim_gestao) : '[fim da gestão]',
    ano_exercicio:            eleicao.ano_exercicio || gestao,
    nome_chapa:               eleicao.nome_chapa || '[nome da chapa]',
    // Edital: número sequencial contínuo (eleição e posse compartilham a mesma sequência)
    numero_edital:            (() => { const posse = ['edital_posse', 'ata_posse', 'ata_posse_cartorio'].includes(tipo); const n = posse ? eleicao.edital_posse_numero : eleicao.edital_eleicao_numero; return n ? formatarNumeroEdital(n, anoDoEdital(eleicao, posse)) : '[nº]'; })(),
    ano_edital:               String(anoDoEdital(eleicao, ['edital_posse', 'ata_posse', 'ata_posse_cartorio'].includes(tipo))),
    // Data do edital correspondente ao documento (edital ou ata)
    data_edital:              formatarDataExtenso(['edital_posse', 'ata_posse', 'ata_posse_cartorio'].includes(tipo) ? eleicao.data_edital_posse : eleicao.data_edital_eleicao),
    data_edital_curta:        formatarData(['edital_posse', 'ata_posse', 'ata_posse_cartorio'].includes(tipo) ? eleicao.data_edital_posse : eleicao.data_edital_eleicao),
    // Balaustre da sessão (Eleição da Loja → atas de eleição; Posse da Loja → ata de posse)
    ...(() => {
      const esp = (tipo === 'ata_posse' || tipo === 'ata_posse_cartorio') ? 'posse_loja' : 'eleicao_loja';
      const b = (balaustresEl || []).find(x => x.sessao_especial === esp);
      return {
        numero_balaustre: b?.numero_balaustre ? String(b.numero_balaustre) : '[nº]',
        ano_balaustre:    b ? String(b.ano_balaustre || String(b.data_sessao || '').substring(0, 4)) : '[ano]',
        data_sessao:      b?.data_sessao ? String(b.data_sessao).split('-').reverse().join('/') : '[data]',
        hora_encerramento: b?.hora_encerramento ? String(b.hora_encerramento).substring(0, 5) : '22:00',
      };
    })(),
    data_atual:               (() => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; })(),
    nome_loja:                nomeLoja,
    nome_loja_normal:         `Acácia de Paranatinga nº ${dadosLoja.numero_loja || '30'}`,  // sem caixa alta
    num_loja:                 dadosLoja.numero_loja || '30',
    data_eleicao:             formatarData(eleicao.data_eleicao),
    hora_eleicao:             eleicao.hora_eleicao?.substring(0,5) || '20:00',
    data_edital_eleicao:      formatarDataExtenso(eleicao.data_edital_eleicao),
    data_posse:               formatarData(eleicao.data_posse),
    hora_posse:               eleicao.hora_posse?.substring(0,5) || '20:00',
    data_edital_posse:        formatarDataExtenso(eleicao.data_edital_posse),
    cidade:                   dadosLoja.cidade || 'Paranatinga',
    estado:                   dadosLoja.estado || 'MT',
    endereco_loja:            dadosLoja.endereco || '',
    data_fundacao:            dadosLoja.data_fundacao ? formatarData(dadosLoja.data_fundacao) : '20/12/1997',
    // Instaladores
    vm_instalador_nome:                 vmInstalador?.nome || '[VM Instalador]',
    // Gestão Sainte (atas de eleição): 1º e 2º Vigilantes
    primeiro_vigilante_nome:  primeiroVigilanteSainte?.nome || '[1º Vigilante]',
    segundo_vigilante_nome:   segundoVigilanteSainte?.nome  || '[2º Vigilante]',
    primeiro_vigilante_instalador_nome: primeiroVigilanteInstalador?.nome || '[1º Vigilante]',
    segundo_vigilante_instalador_nome:  segundoVigilanteInstalador?.nome  || '[2º Vigilante]',
    // Sainte (edital eleição, atas de eleição)
    orador_nome:              oradorSainte?.nome || oradorNome || '[Orador Sainte]',
    secretario_nome:          secretarioSainte?.nome || '[Secretário Sainte]',
    secretario_dados:         secretarioSainte ? dadoIrmao(eleicao.secretario_sainte_id) : '[Secretário]',
    // Eleito (edital posse, ata posse, requerimentos)
    vm_eleito_nome:           vmEleitoNome,
    // Candidato a Venerável Mestre — antes só existia no documento de apresentação da chapa
    vm_candidato_nome:        vmEleitoNome,
    orador_eleito_nome:       oradorEleitoNome,
    secretario_eleito_nome:   secretarioEleitoNome,
    secretario_eleito_dados:  secretarioEleito ? dadoIrmao(secretarioEleito.irmao_id) : '[Secretário Eleito]',
    num_votantes:             String(eleicao.num_votantes_eleicao || presEleicaoLen),
    total_mestres:            String(calcularQuorum(irmaos, eleicao, presencas, historico).totalMestres),
    // Mestres aptos a votar, já com os ajustes manuais (inapto → apto) desta eleição
    total_mestres_aptos:      String(aptosDaEleicao),
    total_mestres_aptos_extenso: numeroPorExtenso(aptosDaEleicao),
    quorum_minimo:            String(calcularQuorum(irmaos, eleicao, presencas, historico).quorumMinimo),
    trecho_votacao:           '', // preenchido logo abaixo, já com as variáveis
    cnpj:                     dadosLoja.cnpj || '[CNPJ]',
    numero_registro_cartorio: dadosLoja.numero_registro_cartorio || '04, do Livro A-01',
  };

  // Trecho da votação (aclamação/disputa) também tem variáveis, ex.: {num_votantes}
  VARS.trecho_votacao = interpolarModelo(
    eleicao.tipo_votacao === 'aclamacao' ? (modelo.corpo_aclamacao || '') : (modelo.corpo_disputa || ''),
    VARS
  );

  // Função para interpolar e gerar parágrafo do modelo
  // Trechos entre *asteriscos* saem em negrito (sem os asteriscos)
  const runsComNegrito = (texto, base = {}) =>
    String(texto || '').split(/(\*[^*]+\*)/g).filter(t => t !== '').map(t =>
      t.length > 2 && t.startsWith('*') && t.endsWith('*') ? ar(t.slice(1, -1), { ...base, bold: true }) : ar(t, base));
  // Cada linha do modelo = um parágrafo; linha vazia = espaço (as listas são achatadas ao montar o documento)
  const prModelo = (texto, opts = {}) => {
    const linhas = interpolarModelo(texto, VARS).split('\n');
    if (linhas.length === 1) return pr(runsComNegrito(linhas[0]), opts);
    return linhas.map(l => l.trim() === ''
      ? pr([ar('')], { before: 0, after: 0 })
      : pr(runsComNegrito(l), opts));
  };

  // ─── Helpers ──────────────────────────────────────────────
  const ar = (txt, opts = {}) => new TextRun({
    text: String(txt ?? ''),
    font: 'Times New Roman',
    size: FONTE, // Times New Roman; tamanho do modelo (padrão 12)
    bold: opts.bold || false,
    italics: opts.italic || false,
  });

  const pr = (runs, opts = {}) => new Paragraph({
    alignment: opts.align ?? AlignmentType.JUSTIFIED,
    spacing: { before: opts.before ?? 80, after: opts.after ?? 80, line: opts.line ?? LINHA },
    indent: opts.firstLine ? { firstLine: 709 } : undefined,
    children: Array.isArray(runs) ? runs : [runs],
  });

  const prC = (runs, opts = {}) => pr(runs, { ...opts, align: AlignmentType.CENTER });
  // Linha em branco entre blocos (mesmo espaço dos modelos em Word)
  const vazio = (opts = {}) => pr([ar('')], { before: 0, after: 0, ...opts });
  const prL = (runs, opts = {}) => pr(runs, { ...opts, align: AlignmentType.LEFT });

  const alignFromStr = (s) => s === 'center' ? AlignmentType.CENTER : s === 'left' ? AlignmentType.LEFT : AlignmentType.JUSTIFIED;

  // Título: cada linha do campo = uma linha do título
  const tituloModelo = (texto, afterUltima = 240) => {
    if (!texto) return [];
    const linhas = interpolarModelo(texto, VARS).replace(/\*/g, '').split('\n').filter(l => l.trim() !== '');
    return linhas.map((l, i) => pr([ar(l, { bold: true })], { align: alignFromStr(modelo.alinhamento_titulo || 'center'), before: 0, after: i === linhas.length - 1 ? afterUltima : 0 }));
  };
  // Subtítulo (atas): logo abaixo do título, antes do texto — padrão: número do balaustre
  const subtituloModelo = () => {
    const sub = modelo.subtitulo ?? 'Balaústre nº {numero_balaustre}/{ano_balaustre}';
    const linhas = interpolarModelo(sub, VARS).replace(/\*/g, '').split('\n').filter(l => l.trim() !== '');
    return linhas.map((l, i) => prC([ar(l)], { before: 0, after: i === linhas.length - 1 ? 240 : 0 }));
  };

  const rodapeModelo = (opts = {}) => {
    if (!modelo.rodape) return [];
    return [prModelo(modelo.rodape, { before: 160, after: 0, ...opts })];
  };

  const assModelo = (nome, cargo) => cargo ? assinatura(nome, cargo) : [];

  // Assinaturas: nome e cargo com espaçamento simples (1,0) e 0 antes/depois
  const LINHA_ASS = '_____________________________________';
  const assinatura = (nome, cargo) => [
    prC([ar(LINHA_ASS)], { before: 500, after: 0, line: 240 }),
    prC([ar(nome, { bold: true })], { before: 0, after: 0, line: 240 }),
    prC([ar(cargo)], { before: 0, after: 0, line: 240 }),
  ];

  // Duas assinaturas lado a lado por tabulação centralizada (4 cm e 12,5 cm)
  const TABS_ASS = [
    { type: TabStopType.CENTER, position: 2268 },  // 4 cm
    { type: TabStopType.CENTER, position: 7087 },  // 12,5 cm
  ];
  const runTab = (txt, bold = false) => new TextRun({ children: [new Tab(), String(txt ?? '')], font: 'Times New Roman', size: 24, bold });
  const linhaTab = (a, b, bold = false, before = 0) => new Paragraph({
    tabStops: TABS_ASS,
    spacing: { before, after: 0, line: 240 },
    children: [runTab(a, bold), runTab(b, bold)],
  });
  const assinaturaDupla = (nome1, cargo1, nome2, cargo2) => [
    linhaTab(LINHA_ASS, LINHA_ASS, false, 500),
    linhaTab(nome1, nome2, true),
    linhaTab(cargo1, cargo2),
  ];

  // ─── Cabeçalho ────────────────────────────────────────────
  // Logo da Loja centralizado, em linha (não flutuante), acima do cabeçalho
  const logoImg = (after = 160) => new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after },
    children: [
      new ImageRun({
        type: 'jpg',
        data: b64ToBuffer(LOGO_LOJA_B64),
        transformation: { width: Math.round((Number(modelo.logo_tamanho) > 0 ? Number(modelo.logo_tamanho) : 3.5) * 37.8), height: Math.round((Number(modelo.logo_tamanho) > 0 ? Number(modelo.logo_tamanho) : 3.5) * 37.8) }, // padrão 3,5 cm
      }),
    ],
  });

  const cabecalho = () => {
    // Texto personalizado no modelo (Layout → Cabeçalho): 1ª linha em destaque, demais menores
    const custom = modelo.cabecalho_texto && modelo.cabecalho_texto.trim() ? linhasCabecalho(modelo.cabecalho_texto, dadosLoja) : null;
    if (custom) {
      return [
        logoImg(),
        ...custom.map((t, i) => prC([ar(t, { bold: true, size: i === 0 ? 26 : 22 })], { before: 0, after: i === custom.length - 1 ? 280 : 40, line: 276 })),
      ];
    }
    return [
      logoImg(),
      prC([
        ar('AUG', { bold: true, size: 26 }),
        ar('∴', { size: 26 }),
        ar(' E RESP', { bold: true, size: 26 }),
        ar('∴', { size: 26 }),
        ar(' LOJA SIMB', { bold: true, size: 26 }),
        ar('∴', { size: 26 }),
        ar(` ${nomeLoja}`, { bold: true, size: 26 }),
      ], { before: 0, after: 40, line: 276 }),
      prC([ar(`Fundado em ${dadosLoja.data_fundacao ? formatarData(dadosLoja.data_fundacao) : '20/12/1997'}`, { bold: true, size: 22 })], { before: 0, after: 40 }),
      prC([ar('SOB OS AUSPÍCIOS DA SERENÍSSIMA GRANDE LOJA MAÇÔNICA DO ESTADO DE MATO GROSSO', { bold: true, size: 22 })], { before: 0, after: 280 }),
    ];
  };

  // Cabeçalho das atas: logo à esquerda + texto da Loja (ou só o texto, se o logo estiver desmarcado no modelo)
  const cabecalhoAta = () => cabecalhoLojaDocx({
    dadosLoja, comLogo: modelo.mostrar_logo !== false,
    larguraUtil: DOC_CFG.W - MARG.left - MARG.right,
    texto: modelo.cabecalho_texto, logoCm: modelo.logo_tamanho,
  });

  // ─── Lista eleitos ─────────────────────────────────────────
  // simples = true → só CIM e nome (Loja); false → qualificação completa (Cartório)
  // soCartorio = true → apenas os cargos exigidos pelo Cartório
  const listaEleitos = (simples = false, soCartorio = false) => chapaEleita
    .filter(c => !soCartorio || CARGOS_ATA_CARTORIO.includes(c.cargo))
    .sort((a, b) => ORDEM_CARGOS.indexOf(a.cargo) - ORDEM_CARGOS.indexOf(b.cargo))
    .map(c => pr([
      ar(`${rotuloCargo(c.cargo)}: `, { bold: true }),
      ar((simples ? dadoIrmaoLoja(c.irmao_id) : dadoIrmao(c.irmao_id)) + ';'),
    ], { before: 80, after: 80 }));

  const pageCfg = {
    size:   { width: DOC_CFG.W, height: DOC_CFG.H },
    margin: { top: MARG.top, right: MARG.right, bottom: MARG.bottom, left: MARG.left },
  };

  let children = [];

  // ══════════════════════════════════════════════════════════
  // Texto puro do edital (usado pelo PDF que junta edital + relação de aptos)
  if (tipo === 'edital_eleicao' && comLista === 'texto') {
    return {
      titulo: interpolarModelo(modelo.titulo_doc || 'Edital de Convocação para Eleição', VARS).replace(/\*/g, '').split('\n').filter(l => l.trim() !== ''),
      subtitulo: interpolarModelo(modelo.subtitulo || '', VARS).replace(/\*/g, '').split('\n').filter(l => l.trim() !== ''),
      paragrafos: [
        ...interpolarModelo(modelo.corpo || '', VARS).split('\n'),
      ],
      assinaturas: [{ nome: vmConvocante?.nome || '[VM Sainte]', cargo: modelo.assinatura_1_cargo || 'Venerável Mestre' }],
      dadosLoja, numeroEdital: `${eleicao.edital_eleicao_numero || ''}/${eleicao.edital_eleicao_ano || ''}`,
      dataEdital: eleicao.data_edital_eleicao || '',
    };
  }

  if (tipo === 'edital_eleicao') {
    children = [
      ...cabecalho(),
      ...tituloModelo(modelo.titulo_doc || 'Edital de Convocação para Eleição'),
      vazio({ after: 240 }),
      prModelo(modelo.corpo, { firstLine: true, before: 0, after: 200, align: alignFromStr(modelo.alinhamento_corpo) }),
      vazio({ after: 200 }),
      prC([ar(`${VARS.cidade} – ${VARS.estado}, ${VARS.data_edital_eleicao}.`)], { before: 200, after: 0 }),
      vazio({ before: 200 }),
      // Gestão SAINTE assina o edital de eleição
      ...assModelo(vmConvocante?.nome || '[VM Sainte]', modelo.assinatura_1_cargo || 'Venerável Mestre'),
    ];
  }

  // ══════════════════════════════════════════════════════════
  else if (tipo === 'edital_posse') {
    children = [
      ...cabecalho(),
      ...tituloModelo(modelo.titulo_doc || 'Edital de Convocação para Posse'),
      vazio({ after: 240 }),
      prModelo(modelo.corpo, { firstLine: true, before: 0, after: 200, align: alignFromStr(modelo.alinhamento_corpo) }),
      vazio({ after: 200 }),
      prC([ar(`${VARS.cidade} – ${VARS.estado}, ${VARS.data_edital_posse}.`)], { before: 200, after: 0 }),
      vazio({ before: 200 }),
      // Gestão SAINTE ainda assina o edital de posse (ainda está no cargo)
      ...assModelo(vmConvocante?.nome || '[VM Sainte]', modelo.assinatura_1_cargo || 'Venerável Mestre'),
    ];
  }

  // ══════════════════════════════════════════════════════════
  else if (tipo === 'ata_eleicao_loja') {
    children = [
      ...cabecalhoAta(),
      ...tituloModelo(modelo.titulo_doc, (modelo.subtitulo ?? 'x') ? 60 : 240),
      ...subtituloModelo(),
      prModelo(modelo.corpo, { before: 0, after: 80, align: alignFromStr(modelo.alinhamento_corpo) }),
      ...listaEleitos(true), // Loja: só CIM e nome
      ...rodapeModelo(),
      // VM Sainte + Orador/Secretário sainte (ou substituto se concorrendo)
      ...assModelo(vmConvocante?.nome || '[VM Sainte]',       modelo.assinatura_1_cargo || 'Venerável Mestre'),
      ...assModelo(oradorAta?.nome || '[Orador]',             modelo.assinatura_2_cargo || 'Orador'),
      ...assModelo(secretarioAta?.nome || '[Secretário]',     modelo.assinatura_3_cargo || 'Secretário'),
    ];
  }

    // ══════════════════════════════════════════════════════════
  else if (tipo === 'ata_eleicao_cartorio') {
    children = [
      ...cabecalhoAta(),
      ...tituloModelo(modelo.titulo_doc, (modelo.subtitulo ?? 'x') ? 60 : 240),
      ...subtituloModelo(),
      prModelo(modelo.corpo, { before: 0, after: 80, align: alignFromStr(modelo.alinhamento_corpo) }),
      ...listaEleitos(false, true), // Cartório: qualificação completa, só dos 7 cargos
      ...rodapeModelo(),
      // VM Sainte + Orador/Secretário sainte (ou substituto se concorrendo)
      ...assModelo(vmConvocante?.nome || '[VM Sainte]',       modelo.assinatura_1_cargo || 'Venerável Mestre'),
      ...assModelo(oradorAta?.nome || '[Orador]',             modelo.assinatura_2_cargo || 'Orador'),
      ...assModelo(secretarioAta?.nome || '[Secretário]',     modelo.assinatura_3_cargo || 'Secretário'),
    ];
  }

    // ══════════════════════════════════════════════════════════
  else if (tipo === 'ata_posse' || tipo === 'ata_posse_cartorio') {
    const posseCartorio = tipo === 'ata_posse_cartorio'; // Cartório: qualificação completa, só dos 7 cargos
    // ── Cargos que assinam: eleitos até Chanceler ─────────────
    const CARGOS_ASSINAM_POSSE = [
      'Veneravel Mestre', 'Venerável Mestre',
      'Primeiro Vigilante', '1º Vigilante',
      'Segundo Vigilante', '2º Vigilante',
      'Orador',
      'Secretario', 'Secretário',
      'Tesoureiro',
      'Chanceler',
    ];

    const NOME_CARGO_ASS = { 'Veneravel Mestre': 'Venerável Mestre', 'Primeiro Vigilante': '1º Vigilante', 'Segundo Vigilante': '2º Vigilante', 'Secretario': 'Secretário' };
    const assinaturasEleitos = chapaEleita
      .filter(ch => CARGOS_ASSINAM_POSSE.includes(ch.cargo))
      .sort((a, b) => ORDEM_CARGOS.indexOf(a.cargo) - ORDEM_CARGOS.indexOf(b.cargo))
      .flatMap(ch => {
        const irmao = irmaos.find(i => i.id === ch.irmao_id);
        return irmao ? assinatura(`Ir∴ ${irmao.nome.toUpperCase()}`, NOME_CARGO_ASS[ch.cargo] || rotuloCargo(ch.cargo)) : [];
      });

    // Comissão instaladora (aba Configuração): VM Instalador em cima, Vigilantes lado a lado
    const nomeAss = (i, fallback) => i?.nome ? `Ir∴ ${i.nome.toUpperCase()}` : fallback;
    const assinaturasInstaladores = [
      ...assinatura(nomeAss(vmInstalador, '[VM Instalador]'), 'Venerável Mestre Instalador'),
      ...assinaturaDupla(
        nomeAss(primeiroVigilanteInstalador, '[1º Vigilante Instalador]'), '1º Vigilante Instalador',
        nomeAss(segundoVigilanteInstalador, '[2º Vigilante Instalador]'), '2º Vigilante Instalador',
      ),
    ];

    // Marcador do modelo (aba Layout): mostrar os instaladores (VM e Vigilantes) na ata. Padrão: desmarcado.
    const mostrarInstaladores = modelo.mostrar_instaladores === true;
    // Desmarcado: tira do corpo o trecho "sob a presidência do ... {segundo_vigilante_instalador_nome}"
    const semInstaladores = (t) => String(t || '')
      .replace(/,?\s*sob a presid[êe]ncia[^.]*?\{segundo_vigilante_instalador_nome\}/i, '')
      .replace(/\{(vm|primeiro_vigilante|segundo_vigilante)_instalador_nome\}/g, '');

    children = [
      ...cabecalhoAta(),
      // Título via modelo (editável no banco)
      ...tituloModelo(modelo.titulo_doc, (modelo.subtitulo ?? 'x') ? 60 : 240),
      ...subtituloModelo(),

      // Corpo via modelo com todas as variáveis interpoladas (instaladores só se o modelo marcar).
      // Se o modelo salvo no banco ainda tiver o texto antigo ("gestão {gestao}"),
      // troca pelo período da gestão.
      prModelo(
        (() => {
          const corpoPosse = String(modelo.corpo || '').includes('{data_inicio_gestao}')
            ? modelo.corpo
            : String(modelo.corpo || '').replace(/,\s*gest[ãa]o\s*(de\s*)?\{gestao\}\s*\.?/i,
                ', com início em {data_inicio_gestao} até {data_fim_gestao}, para a gestão de {ano_exercicio}.');
          return mostrarInstaladores ? corpoPosse : semInstaladores(corpoPosse);
        })(),
        { before: 0, after: 80, align: alignFromStr(modelo.alinhamento_corpo) } // sem recuo: parágrafos na margem
      ),

      // "Foram empossados os Irmãos:" — texto fixo introdutório
      pr([ar('Foram empossados os Irmãos:')], { before: 80, after: 80 }),

      // Lista dos eleitos: Loja = só CIM e nome; Cartório = qualificação completa dos 7 cargos
      ...chapaEleita
        .filter(ch => !posseCartorio || CARGOS_ATA_CARTORIO.includes(ch.cargo))
        .sort((a, b) => ORDEM_CARGOS.indexOf(a.cargo) - ORDEM_CARGOS.indexOf(b.cargo))
        .map(ch => {
          const irmao = irmaos.find(i => i.id === ch.irmao_id);
          return pr([
            ar(`${rotuloCargo(ch.cargo)}: `, { bold: true }),
            ar(irmao ? (posseCartorio ? dadoIrmao(ch.irmao_id) : dadoIrmaoLoja(ch.irmao_id)) : '[Irmão não encontrado]'),
          ], { before: 60, after: 60 });
        }),

      // Rodapé via modelo (editável no banco), sem recuo
      ...rodapeModelo({ firstLine: false }),

      // Assinaturas: comissão instaladora (só se o modelo marcar) e, abaixo, os eleitos empossados até Chanceler
      ...(mostrarInstaladores ? assinaturasInstaladores : []),
      ...assinaturasEleitos,
    ];
  }

    // ══════════════════════════════════════════════════════════
  // Conteúdo da lista de presença (usada solta e anexada ao edital/ata, a partir da 2ª página)
  const blocoLista = (tipoLista, usarTituloDoModelo = true) => {
    const sessaoNome = tipoLista === 'lista_presenca_eleicao' ? 'Eleição' : 'Posse';
    const dataDoc    = tipoLista === 'lista_presenca_eleicao' ? eleicao.data_eleicao : eleicao.data_posse;
    const lista      = tipoLista === 'lista_presenca_eleicao' ? presEleicao : presPosse;
    const thinBorder = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
    const borders    = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
    const pad        = { top: 80, bottom: 80, left: 120, right: 120 };
    const CW         = [500, 4800, 1600, 2442];
    return [
      ...cabecalho(),
      prC([ar(interpolarModelo((usarTituloDoModelo && modelo.titulo_doc) || `Lista de Presença — Sessão de ${sessaoNome}`, VARS), { bold: true })], { before: 0, after: 80 }),
      prC([ar(`Gestão: ${gestao}     Data: ${formatarData(dataDoc)}`)], { before: 0, after: 160 }),
      new Table({
        width: { size: DOC_CFG.W - MARG.left - MARG.right, type: WidthType.DXA },
        columnWidths: CW,
        rows: [
          new TableRow({ tableHeader: true, children: [
            new TableCell({ borders, width: { size: CW[0], type: WidthType.DXA }, margins: pad, shading: { fill: 'D9D9D9', type: ShadingType.CLEAR }, children: [pr([ar('Nº', { bold: true })], { align: AlignmentType.CENTER })] }),
            new TableCell({ borders, width: { size: CW[1], type: WidthType.DXA }, margins: pad, shading: { fill: 'D9D9D9', type: ShadingType.CLEAR }, children: [pr([ar('Nome', { bold: true })])] }),
            new TableCell({ borders, width: { size: CW[2], type: WidthType.DXA }, margins: pad, shading: { fill: 'D9D9D9', type: ShadingType.CLEAR }, children: [pr([ar('CIM', { bold: true })])] }),
            new TableCell({ borders, width: { size: CW[3], type: WidthType.DXA }, margins: pad, shading: { fill: 'D9D9D9', type: ShadingType.CLEAR }, children: [pr([ar('Assinatura', { bold: true })])] }),
          ]}),
          ...[...lista, ...Array(5).fill(null)].map((p, idx) => {
            const i = p ? irmaos.find(x => x.id === p.irmao_id) : null;
            return new TableRow({ children: [
              new TableCell({ borders, width: { size: CW[0], type: WidthType.DXA }, margins: pad, children: [pr([ar(p ? String(idx+1) : '')], { align: AlignmentType.CENTER })] }),
              new TableCell({ borders, width: { size: CW[1], type: WidthType.DXA }, margins: pad, children: [pr([ar(i?.nome || '')])] }),
              new TableCell({ borders, width: { size: CW[2], type: WidthType.DXA }, margins: pad, children: [pr([ar(i?.cim || '')])] }),
              new TableCell({ borders, width: { size: CW[3], type: WidthType.DXA }, margins: pad, children: [pr([ar('')])] }),
            ]});
          }),
        ],
      }),
      prL([ar(`Total de presentes: ${lista.length}`)], { before: 120, after: 0 }),
      // Assinatura do Venerável Mestre (eleição: VM em exercício; posse: VM Instalador) — cargo editável no modelo
      ...assModelo(
        (tipoLista === 'lista_presenca_posse' ? vmInstalador : vmConvocante)?.nome ? `Ir∴ ${(tipoLista === 'lista_presenca_posse' ? vmInstalador : vmConvocante).nome.toUpperCase()}` : '[Venerável Mestre]',
        (usarTituloDoModelo && modelo.assinatura_1_cargo) || (tipoLista === 'lista_presenca_posse' ? 'Venerável Mestre Instalador' : 'Venerável Mestre')
      ),
    ];
  };

  if (tipo === 'lista_presenca_eleicao' || tipo === 'lista_presenca_posse') {
    children = blocoLista(tipo);
  }

  // ══════════════════════════════════════════════════════════
  else if (tipo === 'apresentacao_chapa') {
    // Apresentação da Chapa à Loja (modelo da Loja: logo à esquerda, GLEMT/Loja à direita)
    const MESES_CAP = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const extensoCap = (d) => {
      if (!d) return '[data]';
      const [a, m, di] = String(d).substring(0, 10).split('-');
      return `${di} de ${MESES_CAP[parseInt(m) - 1]} de ${a}`;
    };
    const NOME_CARGO = { 'Veneravel Mestre': 'Venerável Mestre', 'Primeiro Vigilante': '1º Vigilante', 'Segundo Vigilante': '2º Vigilante',
      'Secretario': 'Secretário', 'Mestre de Cerimonia': 'Mestre de Cerimônias', 'Mestre de Cerimonia Adjunto': 'Mestre de Cerimônias Adjunto', 'Bibliotecario': 'Bibliotecário' };
    // Chapa apresentada (antes da eleição): todos os cargos preenchidos, na ordem oficial
    const membros = (chapas || []).filter(c => c.irmao_id)
      .sort((a, b) => ORDEM_CARGOS.indexOf(a.cargo) - ORDEM_CARGOS.indexOf(b.cargo));
    const nomeDe = (id) => irmaos.find(x => x.id === id)?.nome || '';
    const vmCand = membros.find(c => c.cargo === 'Veneravel Mestre' || c.cargo === 'Venerável Mestre');

    // Textos padrão, caso o modelo ainda não exista no banco
    const CORPO_PADRAO = "À A∴R∴L∴S∴ {nome_loja} Oriente de {cidade}-{estado}.\n{cidade}-{estado}, aos {data_emissao_extenso} da Era Vulgar.\nMeus queridos Irmãos,\n\nEm atenção ao Edital de Convocação para as eleições da administração desta Respeitável Loja, venho, com espírito de fraternidade e responsabilidade, apresentar a *Chapa regularmente formada*, para concorrer aos cargos da gestão do próximo ano:\n\nA composição da Chapa é a seguinte:";
    const RODAPE_PADRAO = "Apresento esta Chapa com o firme propósito de dar continuidade aos trabalhos da Oficina, fortalecer a união entre os Irmãos e zelar pelos princípios que norteiam nossa Sublime Instituição.\nColoco-me, juntamente com os demais Irmãos que compõem esta Chapa, à disposição desta Respeitável Loja, para ouvir, dialogar e trabalhar com dedicação pelo engrandecimento de nossa Oficina.\n\nT∴F∴A∴";
    modelo.corpo = modelo.corpo || CORPO_PADRAO;
    modelo.rodape = modelo.rodape || RODAPE_PADRAO;
    VARS.nome_chapa = eleicao.nome_chapa || '[nome da chapa]';
    VARS.nome_chapa_maiusculo = String(eleicao.nome_chapa || '[NOME DA CHAPA]').toUpperCase();
    VARS.data_edital_eleicao_extenso = extensoCap(eleicao.data_edital_eleicao);
    VARS.data_emissao_extenso = extensoCap(dataEmissao || hojeISO());
    VARS.vm_candidato_nome = vmCand ? nomeDe(vmCand.irmao_id) : '[Candidato a Venerável Mestre]';

    // Texto do modelo: cada linha = um parágrafo; linha vazia = espaço
    const paragrafos = (texto) => interpolarModelo(texto || '', VARS).split('\n').map(l =>
      l.trim() === '' ? pr([ar('')], { before: 0, after: 0 }) : pr(runsComNegrito(l), { before: 0, after: 160, align: alignFromStr(modelo.alinhamento_corpo || 'justify') }));

    const semBorda = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const sb = { top: semBorda, bottom: semBorda, left: semBorda, right: semBorda };
    const W = DOC_CFG.W - MARG.left - MARG.right;
    const tri = (t, size = 32) => new TextRun({ text: t, font: 'Times New Roman', size });
    const linhasApres = modelo.cabecalho_texto && modelo.cabecalho_texto.trim()
      ? linhasCabecalho(modelo.cabecalho_texto, dadosLoja)
      : ['Grande Loja do Estado de Mato Grosso – GLEMT', `A∴R∴L∴S∴ Acácia de Paranatinga nº ${dadosLoja.numero_loja || '30'}`];
    const pxLogoApres = Math.round((Number(modelo.logo_tamanho) > 0 ? Number(modelo.logo_tamanho) : 3.5) * 37.8);
    const colLogoApres = pxLogoApres * 15 + 340;
    const cabecalhoApresentacao = new Table({
      width: { size: W, type: WidthType.DXA }, columnWidths: [colLogoApres, W - colLogoApres],
      rows: [new TableRow({ children: [
        new TableCell({ borders: sb, width: { size: colLogoApres, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children: [
          new Paragraph({ alignment: AlignmentType.LEFT, children: [new ImageRun({ type: 'jpg', data: b64ToBuffer(LOGO_LOJA_B64), transformation: { width: pxLogoApres, height: pxLogoApres } })] }),
        ]}),
        new TableCell({ borders: sb, width: { size: W - colLogoApres, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
          children: linhasApres.map((t, i) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: i === linhasApres.length - 1 ? 0 : 40 }, children: [tri(t)] })) }),
      ]})],
    });

    const thin = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
    const bd = { top: thin, bottom: thin, left: thin, right: thin };
    const padT = { top: 30, bottom: 30, left: 100, right: 100 };
    const CWc = [Math.round(W * 0.38), W - Math.round(W * 0.38)];
    const celula = (txt, w, bold = false) => new TableCell({ borders: bd, width: { size: w, type: WidthType.DXA }, margins: padT,
      children: [pr([ar(txt, { bold })], { before: 0, after: 0, align: AlignmentType.LEFT, line: 240 })] });
    const tabelaChapa = new Table({
      width: { size: W, type: WidthType.DXA }, columnWidths: CWc,
      rows: [
        new TableRow({ tableHeader: true, children: [celula('Cargo', CWc[0]), celula('Irmãos', CWc[1])] }),
        ...membros.map(c => new TableRow({ children: [
          celula(NOME_CARGO[c.cargo] || rotuloCargo(c.cargo), CWc[0], true),
          celula(`Ir∴ ${nomeDe(c.irmao_id)}`, CWc[1]),
        ]})),
      ],
    });

    children = [
      cabecalhoApresentacao,
      vazio({ after: 200 }),
      prC([ar(interpolarModelo(modelo.titulo_doc || 'APRESENTAÇÃO DE CHAPA – {nome_chapa_maiusculo}', VARS).replace(/\*/g, ''), { bold: true })], { before: 0, after: 360 }),
      ...paragrafos(modelo.corpo),
      vazio({ after: 120 }),
      tabelaChapa,
      ...paragrafos(modelo.rodape),
      vazio({ after: 200 }),
      prC([ar(`${VARS.cidade} – ${VARS.estado}, ${VARS.data_emissao_extenso}.`)], { before: 0, after: 300 }),
      pr([ar(VARS.vm_candidato_nome, { bold: true })], { before: 0, after: 20, align: AlignmentType.LEFT }),
      pr([ar(modelo.assinatura_1_cargo || 'Candidato à Venerável Mestre')], { before: 0, after: 0, align: AlignmentType.LEFT }),
    ];
  }

  // ══════════════════════════════════════════════════════════
  else if (tipo === 'requerimento_eleicao' || tipo === 'requerimento_posse') {
    // Assina o VM da gestão vigente na data de emissão (ou o escolhido na Configuração)
    const qual = tipo === 'requerimento_eleicao' ? 'eleicao' : 'posse';
    const ass = resolverAssinanteRequerimento(qual, eleicao, chapas, irmaos);
    const nomePres = ass.irmao?.nome ? ass.irmao.nome.toUpperCase() : '[PRESIDENTE]';
    VARS.presidente_requerimento = nomePres;
    VARS.presidente_requerimento_qualificacao = qualificacaoRequerimento(ass.irmao);
    children = [
      logoImg(240),
      prC([ar(String(dadosLoja.nome_cartorio || 'ILMª. SRª. TABELIÃ DO CARTÓRIO DE NOTAS, PROTESTO DE TÍTULOS, REGISTRO CIVIL DAS PESSOAS NATURAIS E JURÍDICAS DE PARANATINGA - MT – 2º SERVIÇO NOTARIAL E REGISTRAL').replace(/\*/g, ''), { bold: true })], { before: 0, after: 400 }),
      vazio({ after: 200 }),
      vazio({ after: 200 }),
      prModelo(modelo.corpo, { firstLine: true, before: 0, after: 200, align: alignFromStr(modelo.alinhamento_corpo) }),
      vazio({ after: 200 }),
      vazio({ after: 200 }),
      // Rodapé do modelo (se preenchido), antes da data
      ...rodapeModelo({ firstLine: true, before: 0, after: 200 }),
      prC([ar(`${VARS.cidade}, ${formatarDataExtenso(ass.dataEmissao)}.`)], { before: 200, after: 0 }),
      vazio({ before: 200 }),
      ...assModelo(ass.irmao?.nome || '[Presidente]', modelo.assinatura_1_cargo || 'Presidente'),
    ];
  }

    // ─── Montar documento ─────────────────────────────────────
  // Relação de Aptos a Votar a partir da página seguinte (comLista = linhas já prontas)
  if (Array.isArray(comLista) && comLista.length) {
    const bd = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
    const bordas = { top: bd, bottom: bd, left: bd, right: bd };
    const padA = { top: 60, bottom: 60, left: 100, right: 100 };
    const Wt = DOC_CFG.W - MARG.left - MARG.right;
    const CWA = [600, Math.round(Wt * 0.46), 1500, Wt - 600 - Math.round(Wt * 0.46) - 1500];
    const celA = (txt, w, { bold = false, align = AlignmentType.LEFT, head = false } = {}) => new TableCell({
      borders: bordas, width: { size: w, type: WidthType.DXA }, margins: padA,
      ...(head ? { shading: { fill: 'D9D9D9', type: ShadingType.CLEAR } } : {}),
      children: [pr([ar(txt, { bold })], { align, before: 0, after: 0 })],
    });
    children = [
      ...children,
      new Paragraph({ children: [new PageBreak()] }),
      prC([ar('RELAÇÃO DE IRMÃOS APTOS A VOTAR', { bold: true })], { before: 0, after: 160 }),
      new Table({
        width: { size: Wt, type: WidthType.DXA }, columnWidths: CWA,
        rows: [
          new TableRow({ tableHeader: true, children: [
            celA('Nº', CWA[0], { bold: true, align: AlignmentType.CENTER, head: true }),
            celA('Irmão', CWA[1], { bold: true, head: true }),
            celA('CIM', CWA[2], { bold: true, align: AlignmentType.CENTER, head: true }),
            celA('Assinatura', CWA[3], { bold: true, align: AlignmentType.CENTER, head: true }),
          ] }),
          ...comLista.map((a, i) => new TableRow({ children: [
            celA(String(i + 1), CWA[0], { align: AlignmentType.CENTER }),
            celA(a.nome || '', CWA[1]),
            celA(a.cim || '', CWA[2], { align: AlignmentType.CENTER }),
            celA('', CWA[3]),
          ] })),
        ],
      }),
      prL([ar(`Total de Irmãos aptos a votar: ${comLista.length}`)], { before: 120, after: 0 }),
    ];
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Times New Roman', size: 24 } } } },
    // Rodapé: numeração "1 de 3" à direita
    sections: [{ properties: { page: pageCfg }, footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
      new TextRun({ children: [PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], font: 'Times New Roman', size: 20 }),
    ] })] }) }, children: children.flat(3) }],
  });

  return Packer.toBlob(doc);
};

// ─── Download helper ──────────────────────────────────────────
const downloadDocx = (blob, nomeArquivo) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
};

const S = {
  btn: (cor = 'accent') => ({
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: '600',
    color: cor === 'danger' ? 'white' : cor === 'surface' ? 'var(--color-text)' : 'white',
    background: cor === 'accent' ? 'var(--color-accent)' : cor === 'danger' ? 'var(--color-danger)' : cor === 'success' ? 'var(--color-success)' : 'var(--color-surface-2)',
    border: cor === 'surface' ? '1px solid var(--color-border)' : 'none',
    borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.2s',
  }),
  card: { background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', border: '1px solid var(--color-border)' },
  label: { display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em' },
  input: { width: '100%', padding: '0.5rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text)', fontSize: '0.875rem', boxSizing: 'border-box' },
  select: { width: '100%', padding: '0.5rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text)', fontSize: '0.875rem' },
  badge: (cor) => ({
    display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '999px',
    fontSize: '0.75rem', fontWeight: '700',
    background: cor === 'gold' ? 'var(--color-accent-bg)' : cor === 'green' ? 'rgba(16,185,129,0.15)' : cor === 'blue' ? 'rgba(59,130,246,0.15)' : 'var(--color-surface-2)',
    color: cor === 'gold' ? 'var(--color-accent)' : cor === 'green' ? 'var(--color-success)' : cor === 'blue' ? '#3b82f6' : 'var(--color-text-muted)',
  }),
};

const STATUS_INFO = {
  rascunho:           { label: 'Rascunho',             cor: 'muted', emoji: '📝' },
  eleicao_realizada:  { label: 'Eleição Realizada',    cor: 'blue',  emoji: '✅' },
  posse_realizada:    { label: 'Posse Realizada',       cor: 'green', emoji: '🎖️' },
  registrado_cartorio:{ label: 'Registrado em Cartório',cor: 'gold',  emoji: '🏛️' },
};

// ════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════

export default function EleicaoPosse({ permissoes, irmaos, userData, showSuccess, showError, podeEditarModelos = false, onAbrirModelos, onAbrirBalaustres }) {
  const CHAVE_RETORNO = 'eleicao_posse_retorno';
  const temAcesso = permissoes?.canManageUsers || permissoes?.canEditFinancial || permissoes?.canEdit || false;

  const [eleicoes, setEleicoes] = useState([]);
  const [eleicaoSelecionada, setEleicaoSelecionada] = useState(null);
  const [chapas, setChapas] = useState([]);
  const [presencas, setPresencas] = useState([]);
  const [historicoSituacoes, setHistoricoSituacoes] = useState([]);
  // ── Aptos a votar: tesouraria (até 3 meses em aberto) + presença (mín. 50%) ──
  const [aptidao, setAptidao] = useState({ carregando: false, linhas: [], periodo: '', assinantes: {} });
  const [filtroAptidao, setFiltroAptidao] = useState('todos');
  const LIMITE_MESES_PENDENTES = 3;
  const PRESENCA_MINIMA = 50;

  // Balaustres vinculados à eleição (Eleição da Loja / Posse da Loja) — exigidos para gerar as atas
  const [balaustresEleicao, setBalaustresEleicao] = useState([]);
  const [dadosLoja, setDadosLoja] = useState({});
  // Editais vinculados à eleição selecionada (id → registro da tabela editais)
  const [editaisLoja, setEditaisLoja] = useState({});
  const [emitindoEdital, setEmitindoEdital] = useState('');
  const [vinculandoEdital, setVinculandoEdital] = useState(''); // '' | 'eleicao' | 'posse'
  // Data de emissão do Quadro da Gestão / Apresentação da Chapa (sai acima da assinatura)
  const [dataEmissaoQuadro, setDataEmissaoQuadro] = useState(() => new Date().toISOString().substring(0, 10));
  const recarregarEditaisLoja = useCallback(async (el) => {
    const ids = [el?.edital_eleicao_id, el?.edital_posse_id].filter(Boolean);
    if (!ids.length) { setEditaisLoja({}); return; }
    const { data } = await supabase.from('editais').select('*').in('id', ids);
    setEditaisLoja(Object.fromEntries((data || []).map(e => [e.id, e])));
  }, []);
  useEffect(() => {
    recarregarEditaisLoja(eleicaoSelecionada);
  }, [eleicaoSelecionada?.id, eleicaoSelecionada?.edital_eleicao_id, eleicaoSelecionada?.edital_posse_id, recarregarEditaisLoja]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState('');
  const [etapa, setEtapa] = useState(1); // 1=config 2=eleição 3=posse 4=docs
  // A função de cálculo é definida mais abaixo; o efeito chama pela referência (hooks ficam no topo)
  const carregarAptidaoRef = useRef(null);
  useEffect(() => {
    if (eleicaoSelecionada && (etapa === 5 || etapa === 2) && carregarAptidaoRef.current) carregarAptidaoRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, eleicaoSelecionada?.id, presencas.length, historicoSituacoes.length]);
  const [modalAberto, setModalAberto] = useState(false); // nova eleição
  const [loadingAcao, setLoadingAcao] = useState(false);

  // Form nova eleição
  const [form, setForm] = useState({
    gestao: '',
    tipo_votacao: 'aclamacao',
    data_eleicao: '',
    hora_eleicao: '20:00',
    data_edital_eleicao: '',
    data_posse: '',
    hora_posse: '20:00',
    data_edital_posse: '',
    vm_convocante_id: '',
    orador_sainte_id: '',
    secretario_sainte_id: '',
    primeiro_vigilante_sainte_id: '',
    segundo_vigilante_sainte_id: '',
    orador_substituto_ata_id: '',
    secretario_substituto_ata_id: '',
    vm_instalador_id: '',
    primeiro_vigilante_instalador_id: '',
    segundo_vigilante_instalador_id: '',
    orador_instalador_id: '',
    secretario_instalador_id: '',
    presidente_eleito_id: '',
    observacoes: '',
  });

  // Chapas em edição
  const [editandoChapas, setEditandoChapas] = useState(false);
  const [chapaForm, setChapaForm] = useState({}); // { cargo: irmao_id }
  const [nomesChapas, setNomesChapas] = useState({ A: 'Chapa A', B: 'Chapa B' });
  const [chapaVencedora, setChapaVencedora] = useState('A');

  const podeEditar = permissoes?.pode_editar_corpo_admin || false;

  // ── Travas do processo eleitoral ───────────────────────────────────────
  // Encerrada a eleição, nada do pleito muda; encerrada a posse, o resto também não.
  // Só Admin e Venerável encerram ou liberam.
  const ehAdmin = String(userData?.nivel_acesso || '').toLowerCase() === 'admin';
  const semAcento = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cargoUsuario = semAcento(userData?.cargo);
  const podeLiberar = ehAdmin || cargoUsuario.includes('veneravel') || cargoUsuario.includes('secretario');
  const eleicaoTravada = !!eleicaoSelecionada?.eleicao_encerrada;
  const posseTravada = !!eleicaoSelecionada?.posse_encerrada;
  const [avisoTrava, setAvisoTrava] = useState(null);   // 'eleicao' | 'posse'
  const [editandoRegistro, setEditandoRegistro] = useState(false);
  const [formRegistro, setFormRegistro] = useState({ registro_numero: '', registro_averbacao: '', registro_data: '' });
  // Retorna true quando a ação está liberada; senão mostra o aviso
  // Campos da POSSE continuam livres quando só a eleição foi encerrada
  const CAMPOS_POSSE = ['data_edital_posse', 'data_posse', 'hora_posse'];
  const campoTravado = (key) => (CAMPOS_POSSE.includes(key) ? posseTravada : eleicaoTravada);

  const liberado = (etapa = 'eleicao') => {
    const travada = etapa === 'posse' ? posseTravada : eleicaoTravada;
    if (travada) { setAvisoTrava(etapa); return false; }
    return true;
  };
  // Listas de escolha: somente irmãos REGULARES na data da eleição (fora falecidos,
  // desligados, irregulares e licenciados). Quem já foi escolhido nesta eleição
  // continua na lista, com aviso se hoje não estiver regular.
  const porNome = (a, b) => (a.nome || '').localeCompare(b.nome || '');
  const ROTULO_SIT = { licenciado: 'Licenciado', irregular: 'Irregular', desligado: 'Desligado', falecido: 'Falecido' };
  const dataRefEleicao = eleicaoSelecionada?.data_eleicao || null;
  const idsJaEscolhidos = new Set([
    ...chapas.map(c => c.irmao_id),
    ...Object.entries(eleicaoSelecionada || {}).filter(([k, v]) => k.endsWith('_id') && v && k !== 'id').map(([, v]) => v),
  ].filter(Boolean).map(String));
  const irmaosAtivos = (irmaos || [])
    .filter(i => situacaoNaData(i, dataRefEleicao, historicoSituacoes) === 'regular' || idsJaEscolhidos.has(String(i.id)))
    .map(i => {
      const hoje = String(i.situacao || 'regular').toLowerCase();
      return hoje === 'regular' && !i.data_falecimento ? i : { ...i, nome: `${i.nome} (hoje: ${ROTULO_SIT[hoje] || i.situacao || 'Falecido'})` };
    })
    .sort(porNome);
  // Escolhas para atos de HOJE (ex.: quem assina o requerimento): regulares hoje
  const irmaosRegularesHoje = (irmaos || [])
    .filter(i => String(i.situacao || 'regular').toLowerCase() === 'regular' && !i.data_falecimento)
    .sort(porNome);

  // Filtra irmãos aptos para um determinado ato (eleição ou posse)
  // Regra: somente situação regular na data do ato
  // Exclui: falecido/desligado/excluido/ex_oficio/suspenso
  // E se tiver data_falecimento ou data_desligamento anterior à data do ato, também exclui
  const irmaosAptosParaAto = (dataAto, sessao, situacoesAceitas = ['regular']) => {
    // Situação NA DATA do ato; quem já tem presença gravada na sessão sempre aparece
    // Eleição: só regulares. Posse: regulares e licenciados.
    const comPresenca = new Set(presencas.filter(p => p.sessao === sessao).map(p => String(p.irmao_id)));
    return (irmaos || []).filter(i => {
      if (sessao && comPresenca.has(String(i.id))) return true;
      if (!situacoesAceitas.includes(situacaoNaData(i, dataAto, historicoSituacoes))) return false;
      // Se há data do ato, verifica datas de saída
      if (dataAto) {
        const dAto = new Date(dataAto + 'T00:00:00');
        if (i.data_falecimento) {
          const dFal = new Date(i.data_falecimento + 'T00:00:00');
          if (dFal <= dAto) return false;
        }
        if (i.data_desligamento) {
          const dDes = new Date(i.data_desligamento + 'T00:00:00');
          if (dDes <= dAto) return false;
        }
      }
      return true;
    });
  };

  // ── Carregamento ─────────────────────────────────────────

  const [vmPorEleicao, setVmPorEleicao] = useState({});
  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data: loja } = await supabase.from('dados_loja').select('*').single();
      if (loja) setDadosLoja(loja);

      const { data: el } = await supabase
        .from('eleicoes')
        .select('*')
        .order('created_at', { ascending: false });
      setEleicoes(el || []);
      // Venerável eleito de cada gestão, para mostrar na lista
      const { data: eleitos } = await supabase.from('eleicao_chapas').select('eleicao_id, cargo, irmao_id, eleita').eq('eleita', true);
      const porEleicao = {};
      (eleitos || []).forEach(c => {
        if (c.cargo === 'Veneravel Mestre' || c.cargo === 'Venerável Mestre') porEleicao[String(c.eleicao_id)] = c.irmao_id;
      });
      setVmPorEleicao(porEleicao);
      // Voltando de "Modelos de Documentos": reabre a mesma eleição na aba Documentos
      try {
        const ret = JSON.parse(sessionStorage.getItem(CHAVE_RETORNO) || 'null');
        if (ret?.id) {
          sessionStorage.removeItem(CHAVE_RETORNO);
          const alvo = (el || []).find(x => String(x.id) === String(ret.id));
          if (alvo) { setEleicaoSelecionada(alvo); setEtapa(ret.etapa || 4); }
        }
      } catch { /* sem retorno */ }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const carregarDetalhe = useCallback(async (id) => {
    const { data: ch } = await supabase
      .from('eleicao_chapas')
      .select('*')
      .eq('eleicao_id', id)
      .order('ordem');
    setChapas(ch || []);

    const { data: pr } = await supabase
      .from('eleicao_presencas')
      .select('*')
      .eq('eleicao_id', id);
    setPresencas(pr || []);

    // Histórico de situações (licenças, desligamentos...) para avaliar a situação na data do ato
    const { data: hs } = await supabase
      .from('historico_situacoes')
      .select('membro_id, tipo_situacao, data_inicio, data_fim, status');
    setHistoricoSituacoes(hs || []);

    const { data: bl } = await supabase
      .from('balaustres')
      .select('id, numero_balaustre, ano_balaustre, data_sessao, grau_sessao, sessao_especial, hora_encerramento')
      .eq('eleicao_id', id);
    setBalaustresEleicao(bl || []);
  }, []);

  useEffect(() => { if (temAcesso) carregar(); }, [carregar, temAcesso]);

  useEffect(() => {
    if (eleicaoSelecionada) carregarDetalhe(eleicaoSelecionada.id);
  }, [eleicaoSelecionada, carregarDetalhe]);

  // ── Nova Eleição ─────────────────────────────────────────

  const salvarEleicao = async () => {
    if (!form.gestao || !form.data_eleicao) {
      showError('Preencha ao menos a Gestão e Data da Eleição.');
      return;
    }
    setLoadingAcao(true);
    try {
      const payload = {
        ...form,
        status: 'rascunho',
        vm_convocante_id:             form.vm_convocante_id             || null,
        orador_sainte_id:            form.orador_sainte_id            || null,
        secretario_sainte_id:        form.secretario_sainte_id        || null,
        primeiro_vigilante_sainte_id: form.primeiro_vigilante_sainte_id || null,
        segundo_vigilante_sainte_id:  form.segundo_vigilante_sainte_id  || null,
        orador_substituto_ata_id:    form.orador_substituto_ata_id    || null,
        secretario_substituto_ata_id:form.secretario_substituto_ata_id|| null,
        vm_instalador_id:                     form.vm_instalador_id                     || null,
        primeiro_vigilante_instalador_id:    form.primeiro_vigilante_instalador_id    || null,
        segundo_vigilante_instalador_id:     form.segundo_vigilante_instalador_id     || null,
        orador_instalador_id:                form.orador_instalador_id                || null,
        secretario_instalador_id:            form.secretario_instalador_id            || null,
        presidente_eleito_id:        form.presidente_eleito_id        || null,
        data_eleicao:        form.data_eleicao        || null,
        data_edital_eleicao: form.data_edital_eleicao || null,
        data_posse:          form.data_posse          || null,
        data_edital_posse:   form.data_edital_posse   || null,
        hora_eleicao:        form.hora_eleicao        || null,
        hora_posse:          form.hora_posse          || null,
      };
      const { data, error } = await supabase
        .from('eleicoes')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      showSuccess('Eleição criada com sucesso!');
      setModalAberto(false);
      setForm({ gestao: '', tipo_votacao: 'aclamacao', data_eleicao: '', hora_eleicao: '20:00', data_edital_eleicao: '', data_posse: '', hora_posse: '20:00', data_edital_posse: '', vm_convocante_id: '', orador_sainte_id: '', secretario_sainte_id: '', primeiro_vigilante_sainte_id: '', segundo_vigilante_sainte_id: '', orador_substituto_ata_id: '', secretario_substituto_ata_id: '', vm_instalador_id: '', primeiro_vigilante_instalador_id: '', segundo_vigilante_instalador_id: '', orador_instalador_id: '', secretario_instalador_id: '', presidente_eleito_id: '', observacoes: '' });
      await carregar();
      setEleicaoSelecionada(data);
      setEtapa(1);
    } catch (e) {
      showError('Erro: ' + e.message);
    } finally {
      setLoadingAcao(false);
    }
  };

  const atualizarEleicao = async (campos) => {
    if (!eleicaoSelecionada) return;
    // Campos de controle continuam editáveis (travar/liberar, status, registro em cartório)
    const LIVRES = ['eleicao_encerrada', 'eleicao_encerrada_em',
      'posse_encerrada', 'posse_encerrada_em',
      'registro_numero', 'registro_averbacao', 'registro_data', 'status'];
    const mexeNoPosse = Object.keys(campos).some(k => /posse/.test(k) && !LIVRES.includes(k));
    const soLivres = Object.keys(campos).every(k => LIVRES.includes(k));
    if (!soLivres && !liberado(mexeNoPosse ? 'posse' : 'eleicao')) return;
    setLoadingAcao(true);
    // Sanitiza strings vazias em campos BIGINT e DATE
    const camposSanitizados = Object.fromEntries(
      Object.entries(campos).map(([k, v]) => [k, v === '' ? null : v])
    );
    try {
      const { data, error } = await supabase
        .from('eleicoes')
        .update(camposSanitizados)
        .eq('id', eleicaoSelecionada.id)
        .select()
        .single();
      if (error) throw error;
      setEleicaoSelecionada(data);
      setEleicoes(prev => prev.map(e => e.id === data.id ? data : e));
    } catch (e) {
      showError('Erro: ' + e.message);
    } finally {
      setLoadingAcao(false);
    }
  };

  // ── Chapas ──────────────────────────────────────────────

  const iniciarEdicaoChapas = () => {
    const mapa = {};
    chapas.forEach(c => { mapa[c.cargo] = c.irmao_id; });
    setChapaForm(mapa);
    setEditandoChapas(true);
  };

  const salvarChapas = async () => {
    if (!liberado('eleicao')) return;     // chapa faz parte do pleito
    setLoadingAcao(true);
    try {
      // Remove chapas antigas — e confere: se o banco não apagar, não insere de novo (evita cargos duplicados)
      const { error: errDel } = await supabase.from('eleicao_chapas').delete().eq('eleicao_id', eleicaoSelecionada.id);
      if (errDel) throw errDel;
      const { count: restantes } = await supabase.from('eleicao_chapas')
        .select('id', { count: 'exact', head: true }).eq('eleicao_id', eleicaoSelecionada.id);
      if (restantes > 0) throw new Error('o banco não permitiu substituir a chapa (sem permissão para excluir). Nada foi alterado.');

      const novas = ORDEM_CARGOS
        .filter(cargo => chapaForm[cargo])
        .map((cargo, idx) => ({
          eleicao_id: eleicaoSelecionada.id,
          cargo,
          irmao_id: chapaForm[cargo],
          nome_chapa: eleicaoSelecionada.tipo_votacao === 'disputa' ? nomesChapas.A : 'Chapa Única',
          eleita: true,
          ordem: idx,
        }));

      if (novas.length) {
        const { error } = await supabase.from('eleicao_chapas').insert(novas);
        if (error) throw error;
      }

      // Atualiza presidente_eleito_id com o VM eleito
      const vmEleito = novas.find(c => c.cargo === 'Veneravel Mestre' || c.cargo === 'Venerável Mestre');
      if (vmEleito) {
        await atualizarEleicao({ presidente_eleito_id: vmEleito.irmao_id });
      }

      showSuccess('Chapa salva!');
      setEditandoChapas(false);
      await carregarDetalhe(eleicaoSelecionada.id);
    } catch (e) {
      showError('Erro: ' + e.message);
    } finally {
      setLoadingAcao(false);
    }
  };

  // ── Presença ─────────────────────────────────────────────

  const togglePresenca = async (irmaoId, sessao) => {
    if (!liberado(sessao === 'posse' ? 'posse' : 'eleicao')) return;
    const existe = presencas.find(p => p.irmao_id === irmaoId && p.sessao === sessao);
    try {
      if (existe) {
        await supabase.from('eleicao_presencas').delete().eq('id', existe.id);
        setPresencas(prev => prev.filter(p => p.id !== existe.id));
      } else {
        const { data, error } = await supabase.from('eleicao_presencas')
          .insert([{ eleicao_id: eleicaoSelecionada.id, irmao_id: irmaoId, sessao }])
          .select().single();
        if (error) throw error;
        setPresencas(prev => [...prev, data]);
      }
    } catch (e) {
      showError('Erro: ' + e.message);
    }
  };

  const confirmarEleicao = async () => {
    const qtd = presencas.filter(p => p.sessao === 'eleicao').length;
    await atualizarEleicao({ status: 'eleicao_realizada', num_votantes_eleicao: qtd });
    showSuccess('Sessão de eleição confirmada!');
    setEtapa(3);
  };

  const confirmarPosse = async () => {
    const qtd = presencas.filter(p => p.sessao === 'posse').length;
    await atualizarEleicao({ status: 'posse_realizada', num_votantes_posse: qtd });

    // Atualizar corpo_administrativo com a nova gestão
    try {
      const ano = eleicaoSelecionada.gestao?.split('/')[0] || new Date().getFullYear();
      const chapaEl = chapas.filter(c => c.eleita);
      const inserir = chapaEl.map(c => ({
        irmao_id: c.irmao_id,
        cargo: c.cargo,
        ano_exercicio: String(ano),
      }));
      // Só insere o que ainda não existe (confirmar a posse mais de uma vez não duplica)
      const { data: existentes } = await supabase.from('corpo_administrativo')
        .select('irmao_id, cargo, ano_exercicio').eq('ano_exercicio', String(ano));
      const chave = (r) => `${r.irmao_id}|${r.cargo}|${r.ano_exercicio}`;
      const jaTem = new Set((existentes || []).map(chave));
      const novos = inserir.filter(r => !jaTem.has(chave(r)));
      if (novos.length) {
        await supabase.from('corpo_administrativo').insert(novos);
      }
      showSuccess('Posse confirmada e corpo administrativo atualizado!');
    } catch (e) {
      showSuccess('Posse confirmada!');
    }
    setEtapa(4);
  };

  const marcarRegistrado = async () => {
    await atualizarEleicao({ status: 'registrado_cartorio' });
    showSuccess('Marcado como registrado em cartório!');
  };

  // ── Geração de documento ─────────────────────────────────

  // Vários modelos para o mesmo documento (ex.: duas versões da Ata para Eleição) → escolher qual usar
  const [escolhaModeloEP, setEscolhaModeloEP] = useState(null); // { tipo, nomeArq, opcoes }
  // Editais: fonte única = tabela editais (Expedientes → Editais; numeração por ano).
  // Aqui só se emite (próximo nº automático, com descrição) e se consulta o número.
  const edDe = (posse) => editaisLoja[posse ? eleicaoSelecionada?.edital_posse_id : eleicaoSelecionada?.edital_eleicao_id] || null;
  const emitirEditalLoja = async (posse, dataEdital) => {
    if (!eleicaoSelecionada) return;
    if (!liberado(posse ? 'posse' : 'eleicao')) return;
    if (!dataEdital) { showError('Preencha a Data do edital na Configuração antes de emitir.'); return; }
    const chave = posse ? 'posse' : 'eleicao';
    setEmitindoEdital(chave);
    let reg = null;
    try {
      const dataSessao = posse ? eleicaoSelecionada.data_posse : eleicaoSelecionada.data_eleicao;
      reg = await emitirEdital({
        tipo: posse ? 'posse_loja' : 'eleicao_loja', dataEdital, origemId: eleicaoSelecionada.id,
        descricao: `Edital de Convocação para ${posse ? 'Posse' : 'Eleição'} da Loja – Gestão ${eleicaoSelecionada.gestao || ''}${dataSessao ? ` – sessão de ${formatarData(dataSessao)}` : ''}`,
      });
      const { data, error } = await supabase.from('eleicoes')
        .update({ [posse ? 'edital_posse_id' : 'edital_eleicao_id']: reg.id })
        .eq('id', eleicaoSelecionada.id).select().single();
      if (error) throw error;
      setEleicaoSelecionada(data);
      setEleicoes(prev => prev.map(e => e.id === data.id ? data : e));
      showSuccess(`📢 Edital nº ${formatarNumeroEdital(reg.numero, reg.ano)} emitido.`);
    } catch (e) {
      if (reg) await supabase.from('editais').delete().eq('id', reg.id); // não deixa número órfão
      showError('Erro ao emitir o edital: ' + e.message);
    } finally {
      setEmitindoEdital('');
    }
  };
  // Vincula um edital já cadastrado (em vez de emitir outro)
  const vincularEditalLoja = async (posse, ed) => {
    if (!eleicaoSelecionada || emitindoEdital) return;
    if (!liberado(posse ? 'posse' : 'eleicao')) return;
    setEmitindoEdital(posse ? 'posse' : 'eleicao');
    try {
      const { data: e1, error: er1 } = await supabase.from('editais')
        .update({ origem_id: String(eleicaoSelecionada.id), tipo: posse ? 'posse_loja' : 'eleicao_loja' }).eq('id', ed.id).is('origem_id', null).select();
      if (er1) throw er1;
      if (!e1?.length) throw new Error('este edital já foi vinculado a outra situação (ou sem permissão).');
      const campos = { [posse ? 'edital_posse_id' : 'edital_eleicao_id']: ed.id };
      if (ed.data_edital) campos[posse ? 'data_edital_posse' : 'data_edital_eleicao'] = ed.data_edital;
      const { data, error } = await supabase.from('eleicoes').update(campos).eq('id', eleicaoSelecionada.id).select().single();
      if (error) { await supabase.from('editais').update({ origem_id: null }).eq('id', ed.id); throw error; }
      setEleicaoSelecionada(data);
      setEleicoes(prev => prev.map(e => e.id === data.id ? data : e));
      setVinculandoEdital('');
      showSuccess(`🔗 Edital nº ${formatarNumeroEdital(ed.numero, ed.ano)} vinculado.`);
    } catch (e) {
      showError('Erro ao vincular o edital: ' + e.message);
    } finally {
      setEmitindoEdital('');
    }
  };
  // Desfaz o vínculo (o edital continua cadastrado e fica livre para outro uso)
  const desvincularEditalLoja = async (posse) => {
    if (!liberado(posse ? 'posse' : 'eleicao')) return;
    const ed = edDe(posse);
    if (!ed || emitindoEdital) return;
    if (!window.confirm(`Desvincular o edital nº ${formatarNumeroEdital(ed.numero, ed.ano)}?\nEle continua em Editais e o documento fica bloqueado até vincular/emitir outro.`)) return;
    setEmitindoEdital(posse ? 'posse' : 'eleicao');
    try {
      const { data, error } = await supabase.from('eleicoes')
        .update({ [posse ? 'edital_posse_id' : 'edital_eleicao_id']: null }).eq('id', eleicaoSelecionada.id).select().single();
      if (error) throw error;
      await supabase.from('editais').update({ origem_id: null }).eq('id', ed.id);
      setEleicaoSelecionada(data);
      setEleicoes(prev => prev.map(e => e.id === data.id ? data : e));
    } catch (e) {
      showError('Erro ao desvincular: ' + e.message);
    } finally {
      setEmitindoEdital('');
    }
  };
  const controleEdital = (campo, dataEdital) => {
    const posse = campo === 'edital_posse_numero';
    const ed = edDe(posse);
    const temId = !!(posse ? eleicaoSelecionada?.edital_posse_id : eleicaoSelecionada?.edital_eleicao_id);
    return (
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.85rem', padding: '0.5rem 0.8rem', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)' }}>
        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)' }}>📌 Edital nº</label>
        {ed ? (<>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#10b981' }}>{formatarNumeroEdital(ed.numero, ed.ano)}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{ed.descricao} (consulte/edite em Expedientes → Editais)</span>
          {podeEditar && <button disabled={!!emitindoEdital} onClick={() => desvincularEditalLoja(posse)} style={{ ...S.btn('surface'), padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}>↩️ Desvincular</button>}
        </>) : temId ? (
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Carregando edital…</span>
        ) : (<>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f59e0b' }}>⛔ Edital não emitido — o documento fica bloqueado</span>
          {podeEditar && (
            <button disabled={!!emitindoEdital || !dataEdital} onClick={() => emitirEditalLoja(posse, dataEdital)} style={{ ...S.btn('surface'), padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}>
              {emitindoEdital ? '⏳ Emitindo…' : '📢 Emitir edital (próximo nº automático)'}
            </button>
          )}
          {podeEditar && (
            <button disabled={!!emitindoEdital} onClick={() => setVinculandoEdital(v => (v === (posse ? 'posse' : 'eleicao') ? '' : (posse ? 'posse' : 'eleicao')))} style={{ ...S.btn('surface'), padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}>
              🔗 Vincular edital existente
            </button>
          )}
          {podeEditar && vinculandoEdital === (posse ? 'posse' : 'eleicao') && (
            <VincularEdital tipo={posse ? 'posse_loja' : 'eleicao_loja'} ocupado={!!emitindoEdital} onEscolher={(e) => vincularEditalLoja(posse, e)} onFechar={() => setVinculandoEdital('')} />
          )}
        </>)}
        <span style={{ fontSize: '0.75rem', color: dataEdital ? 'var(--color-text-muted)' : '#f59e0b', fontWeight: dataEdital ? 400 : 700 }}>
          {dataEdital ? `Data do edital: ${formatarData(dataEdital)}` : '⚠️ Sem data do edital — preencha na Configuração'}
        </span>
      </div>
    );
  };

  // PDF único: edital de eleição + relação de aptos (mesmo padrão dos dois documentos)
  const gerarEditalAptosPdfLoja = async () => {
    if (!eleicaoSelecionada?.edital_eleicao_id) { showError('Emita o edital (número) antes de gerar o documento.'); return; }
    setGerando('edital_eleicao_pdf');
    try {
      // A aba Documentos não calcula a aptidão: calcula agora se ainda não houver linhas
      let linhasApt = aptidao.linhas || [];
      let periodoApt = aptidao.periodo;
      let assinantesApt = aptidao.assinantes;
      if (!linhasApt.length) {
        const r = await carregarAptidao();
        if (r?.linhas) { linhasApt = r.linhas; periodoApt = r.periodo; assinantesApt = r.assinantes || assinantesApt; }
      }
      const aptos = linhasApt.filter(l => l.apto);
      if (!aptos.length) throw new Error('nenhum Irmão apto a votar (confira a aba Aptos a Votar).');
      _modelosCache = null;
      // número do edital a partir do vínculo
      let ed = edDe(false);
      if (!ed) {
        const { data: reg } = await supabase.from('editais').select('*').eq('id', eleicaoSelecionada.edital_eleicao_id).maybeSingle();
        ed = reg || null;
        if (ed) setEditaisLoja(prev => ({ ...prev, [ed.id]: ed }));
      }
      if (!ed) throw new Error('o edital vinculado não foi encontrado em Editais.');
      const eleicaoDoc = { ...eleicaoSelecionada, edital_eleicao_numero: ed.numero, edital_eleicao_ano: ed.ano };
      const conteudo = await gerarDocx('edital_eleicao', eleicaoDoc, chapas, presencas, dadosLoja, irmaos || [], historicoSituacoes, balaustresEleicao, null, 'texto');
      await gerarEditalAptosPDF({
        conteudo, aptos, dadosLojaPDF: dadosLoja, logoB64: LOGO_LOJA_B64,
        periodo: periodoApt, assinantes: assinantesApt, eleicao: eleicaoSelecionada,
        nomeArquivo: `Edital_${String(`${ed.numero}/${ed.ano}`).replace('/', '-')}_e_Aptos_Eleicao_${String(eleicaoSelecionada.gestao || '').replace('/', '-')}.pdf`,
      });
    } catch (e) {
      showError('Erro ao gerar o PDF: ' + e.message);
    } finally {
      setGerando('');
    }
  };

  const gerarDoc = async (tipo, nomeArq, modeloId = null, comLista = false, dataEmissao = null) => {
    // Edital só é gerado com número emitido (tela Editais)
    const temEditalVinculado = (tipo === 'edital_posse')
      ? !!eleicaoSelecionada?.edital_posse_id
      : !!eleicaoSelecionada?.edital_eleicao_id;
    if ((tipo === 'edital_eleicao' || tipo === 'edital_posse') && !temEditalVinculado) {
      showError('Emita o edital (número) antes de gerar o documento.');
      return;
    }
    if (!modeloId) {
      // Modelos alternativos: o próprio tipo, os derivados (tipo_base) e as cópias antigas (tipo = base__timestamp)
      // Só os modelos deste módulo e deste documento. O "_" é curinga no LIKE do banco,
      // então "edital_eleicao__*" trazia junto o "edital_eleicao_glemt" — filtra no cliente.
      const { data: todosModelos } = await supabase.from('modelos_documentos')
        .select('id, tipo, nome, tipo_base').eq('modulo', 'eleicao_posse');
      const opcoes = (todosModelos || []).filter(m =>
        m.tipo === tipo || m.tipo_base === tipo || String(m.tipo || '').startsWith(`${tipo}__`));
      if (opcoes.length > 1) {
        setEscolhaModeloEP({ tipo, nomeArq, comLista, opcoes: [...opcoes].sort((a, b) => (a.tipo === tipo ? -1 : b.tipo === tipo ? 1 : a.nome.localeCompare(b.nome))) });
        return;
      }
    }
    setEscolhaModeloEP(null);
    setGerando(Array.isArray(comLista) ? `${tipo}_aptos` : tipo); // distingue o botão combinado do simples
    try {
      _modelosCache = null; // sempre com o texto mais recente dos modelos
      let modeloEscolhido = null;
      if (modeloId) {
        const { data: m } = await supabase.from('modelos_documentos').select('*').eq('id', modeloId).maybeSingle();
        modeloEscolhido = m || null;
      }
      // Atas exigem o balaustre da sessão registrado em Balaustres
      const esp = (tipo === 'ata_posse' || tipo === 'ata_posse_cartorio') ? 'posse_loja' : (tipo === 'ata_eleicao_loja' || tipo === 'ata_eleicao_cartorio') ? 'eleicao_loja' : null;
      if (esp && !balaustresEleicao.some(b => b.sessao_especial === esp && b.numero_balaustre)) {
        showError(`Registre o balaustre da sessão de ${esp === 'posse_loja' ? 'Posse' : 'Eleição'} em Balaustres (Sessão especial) para gerar esta ata.`);
        return;
      }
      // Edital: número e ano vêm do registro em Editais (fonte única)
      let eleicaoDoc = eleicaoSelecionada;
      if (tipo === 'edital_eleicao' || tipo === 'edital_posse') {
        const posse = tipo === 'edital_posse';
        // Busca o edital pelo vínculo (não depende do que já está carregado na tela)
        let ed = edDe(posse);
        if (!ed) {
          const idEd = posse ? eleicaoSelecionada.edital_posse_id : eleicaoSelecionada.edital_eleicao_id;
          const { data: reg } = await supabase.from('editais').select('*').eq('id', idEd).maybeSingle();
          ed = reg || null;
          if (ed) setEditaisLoja(prev => ({ ...prev, [ed.id]: ed }));
        }
        if (!ed) throw new Error('o edital vinculado não foi encontrado em Editais. Vincule ou emita outro na Configuração.');
        // Mantém a data do edital em Editais igual à da Configuração
        const dCfg = posse ? eleicaoSelecionada.data_edital_posse : eleicaoSelecionada.data_edital_eleicao;
        if (dCfg && ed.data_edital !== dCfg) {
          await supabase.from('editais').update({ data_edital: dCfg }).eq('id', ed.id);
          recarregarEditaisLoja(eleicaoSelecionada);
        }
        eleicaoDoc = { ...eleicaoSelecionada,
          [posse ? 'edital_posse_numero' : 'edital_eleicao_numero']: ed.numero,
          [posse ? 'edital_posse_ano' : 'edital_eleicao_ano']: ed.ano,
          // cidade e data saem do edital quando a Configuração não tem data
          [posse ? 'data_edital_posse' : 'data_edital_eleicao']: dCfg || ed.data_edital };
      }
      const buf = await gerarDocx(tipo, eleicaoDoc, chapas, presencas, dadosLoja, irmaos || [], historicoSituacoes, balaustresEleicao, modeloEscolhido, comLista, dataEmissao);
      downloadDocx(buf, nomeArq);
    } catch (e) {
      showError('Erro ao gerar documento: ' + e.message);
      console.error(e);
    } finally {
      setGerando('');
    }
  };

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════

  if (!temAcesso) {
    return (
      <div style={{ padding: '1.5rem', background: 'var(--color-bg)', minHeight: '100vh' }}>
        <div style={{
          maxWidth: '520px', margin: '4rem auto', textAlign: 'center',
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)', padding: '2.5rem 2rem',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔒</div>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>
            Acesso Restrito
          </h2>
          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            Esta área é destinada apenas a usuários com cargo administrativo na Loja.
            Caso acredite que deveria ter acesso, fale com a Diretoria.
          </p>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
      Carregando...
    </div>
  );

  // ── Lista de eleições (sem seleção) ──────────────────────
  if (!eleicaoSelecionada) {
    return (
      <div style={{ padding: '1.5rem', background: 'var(--color-bg)', minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-text)', margin: 0 }}>⚖️ Eleição & Posse</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>Gestão de eleições, posses e documentos oficiais</p>
          </div>
          {podeEditar && (
            <button style={S.btn('accent')} onClick={() => setModalAberto(true)}>
              ➕ Nova Eleição
            </button>
          )}
        </div>

        {eleicoes.length === 0 ? (
          <div style={{ ...S.card, textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚖️</div>
            <p>Nenhuma eleição registrada ainda.</p>
            {podeEditar && <button style={{ ...S.btn('accent'), marginTop: '1rem' }} onClick={() => setModalAberto(true)}>Registrar primeira eleição</button>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {eleicoes.map(el => {
              const st = STATUS_INFO[el.status] || STATUS_INFO.rascunho;
              return (
                <div key={el.id} style={{ ...S.card, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onClick={() => { setEleicaoSelecionada(el); setEtapa(el.status === 'rascunho' ? 1 : el.status === 'eleicao_realizada' ? 3 : 4); }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--color-text)' }}>Gestão {el.gestao}</span>
                      <span style={S.badge(st.cor)}>{st.emoji} {st.label}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {el.data_eleicao && `Eleição: ${formatarData(el.data_eleicao)}`}
                      {el.data_posse && ` · Posse: ${formatarData(el.data_posse)}`}
                      {` · ${el.tipo_votacao === 'aclamacao' ? 'Aclamação' : 'Disputa'}`}
                    </div>
                    {/* Venerável da gestão */}
                    {vmPorEleicao[String(el.id)] && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text)', marginTop: '0.15rem' }}>
                        👤 Venerável: <strong>{irmaos.find(i => String(i.id) === String(vmPorEleicao[String(el.id)]))?.nome || '—'}</strong>
                      </div>
                    )}
                    {/* Travas e registro em cartório */}
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                      {el.eleicao_encerrada && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: '999px', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.5)' }}>
                          🔒 Eleição encerrada{el.eleicao_encerrada_em ? ` em ${formatarData(el.eleicao_encerrada_em)}` : ''}
                        </span>
                      )}
                      {el.posse_encerrada && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: '999px', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.5)' }}>
                          🔒 Posse encerrada{el.posse_encerrada_em ? ` em ${formatarData(el.posse_encerrada_em)}` : ''}
                        </span>
                      )}
                      {(el.registro_numero || el.registro_averbacao || el.registro_data) && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: '999px', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.5)' }}>
                          🏛️ {el.registro_numero ? `Registro ${el.registro_numero}` : 'Registrado'}
                          {el.registro_averbacao ? ` · Averbação ${el.registro_averbacao}` : ''}
                          {el.registro_data ? ` · ${formatarData(el.registro_data)}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ color: 'var(--color-accent)', fontSize: '1.25rem' }}>›</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal nova eleição */}
        {modalAberto && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '2rem', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
              <h3 style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--color-text)', marginBottom: '1.5rem' }}>➕ Nova Eleição</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={S.label}>Gestão *</label>
                  <input style={S.input} placeholder="Ex: 2026/2027" value={form.gestao} onChange={e => setForm(p => ({ ...p, gestao: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={S.label}>Tipo de Votação *</label>
                  <select style={S.select} value={form.tipo_votacao} onChange={e => setForm(p => ({ ...p, tipo_votacao: e.target.value }))}>
                    <option value="aclamacao">Chapa Única (Aclamação)</option>
                    <option value="disputa">Disputa entre Chapas</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>Data da Eleição *</label>
                  <input type="date" style={S.input} value={form.data_eleicao} onChange={e => setForm(p => ({ ...p, data_eleicao: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Hora da Eleição</label>
                  <input type="time" style={S.input} value={form.hora_eleicao} onChange={e => setForm(p => ({ ...p, hora_eleicao: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Data do Edital de Eleição</label>
                  <input type="date" style={S.input} value={form.data_edital_eleicao} onChange={e => setForm(p => ({ ...p, data_edital_eleicao: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Data da Posse</label>
                  <input type="date" style={S.input} value={form.data_posse} onChange={e => setForm(p => ({ ...p, data_posse: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Hora da Posse</label>
                  <input type="time" style={S.input} value={form.hora_posse} onChange={e => setForm(p => ({ ...p, hora_posse: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Data do Edital de Posse</label>
                  <input type="date" style={S.input} value={form.data_edital_posse} onChange={e => setForm(p => ({ ...p, data_edital_posse: e.target.value }))} />
                </div>
                {/* Gestão Sainte */}
                <div style={{ gridColumn: '1/-1', padding: '0.75rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-accent)' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                    Gestão Sainte — Editais de Eleição e Atas de Eleição
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div>
                      <label style={S.label}>VM Sainte</label>
                      <select style={S.select} value={form.vm_convocante_id} onChange={e => setForm(p => ({ ...p, vm_convocante_id: e.target.value }))}>
                        <option value="">Selecione...</option>
                        {irmaosAtivos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={S.label}>Orador Sainte</label>
                      <select style={S.select} value={form.orador_sainte_id} onChange={e => setForm(p => ({ ...p, orador_sainte_id: e.target.value }))}>
                        <option value="">Selecione...</option>
                        {irmaosAtivos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={S.label}>Secretário Sainte</label>
                      <select style={S.select} value={form.secretario_sainte_id} onChange={e => setForm(p => ({ ...p, secretario_sainte_id: e.target.value }))}>
                        <option value="">Selecione...</option>
                        {irmaosAtivos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div>
                      <label style={S.label}>1º Vigilante Sainte</label>
                      <select style={S.select} value={form.primeiro_vigilante_sainte_id} onChange={e => setForm(p => ({ ...p, primeiro_vigilante_sainte_id: e.target.value }))}>
                        <option value="">Selecione...</option>
                        {irmaosAtivos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={S.label}>2º Vigilante Sainte</label>
                      <select style={S.select} value={form.segundo_vigilante_sainte_id} onChange={e => setForm(p => ({ ...p, segundo_vigilante_sainte_id: e.target.value }))}>
                        <option value="">Selecione...</option>
                        {irmaosAtivos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                    Se o Orador ou Secretário estiverem concorrendo, indique o substituto para assinar a ata:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={S.label}>Substituto do Orador na Ata <span style={{ fontWeight: 400, textTransform: 'none' }}>(se concorrendo)</span></label>
                      <select style={S.select} value={form.orador_substituto_ata_id} onChange={e => setForm(p => ({ ...p, orador_substituto_ata_id: e.target.value }))}>
                        <option value="">Mesmo orador sainte</option>
                        {irmaosAtivos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={S.label}>Substituto do Secretário na Ata <span style={{ fontWeight: 400, textTransform: 'none' }}>(se concorrendo)</span></label>
                      <select style={S.select} value={form.secretario_substituto_ata_id} onChange={e => setForm(p => ({ ...p, secretario_substituto_ata_id: e.target.value }))}>
                        <option value="">Mesmo secretário sainte</option>
                        {irmaosAtivos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Instaladores — Ata de Posse */}
                <div style={{ gridColumn: '1/-1', padding: '0.75rem', background: 'rgba(99,102,241,0.07)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid #6366f1' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                    Instaladores — Ata de Posse
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginBottom: '0.6rem' }}>
                    Se não selecionados, usa automaticamente VM, Orador e Secretário saintes.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={S.label}>VM Instalador</label>
                      <select style={S.select} value={form.vm_instalador_id} onChange={e => setForm(p => ({ ...p, vm_instalador_id: e.target.value }))}>
                        <option value="">Mesmo VM Sainte</option>
                        {irmaosAtivos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={S.label}>1º Vigilante Instalador</label>
                      <select style={S.select} value={form.primeiro_vigilante_instalador_id} onChange={e => setForm(p => ({ ...p, primeiro_vigilante_instalador_id: e.target.value }))}>
                        <option value="">Selecione...</option>
                        {irmaosAtivos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={S.label}>2º Vigilante Instalador</label>
                      <select style={S.select} value={form.segundo_vigilante_instalador_id} onChange={e => setForm(p => ({ ...p, segundo_vigilante_instalador_id: e.target.value }))}>
                        <option value="">Selecione...</option>
                        {irmaosAtivos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={S.label}>Orador Instalador</label>
                      <select style={S.select} value={form.orador_instalador_id} onChange={e => setForm(p => ({ ...p, orador_instalador_id: e.target.value }))}>
                        <option value="">Mesmo Orador Sainte</option>
                        {irmaosAtivos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={S.label}>Secretário Instalador</label>
                      <select style={S.select} value={form.secretario_instalador_id} onChange={e => setForm(p => ({ ...p, secretario_instalador_id: e.target.value }))}>
                        <option value="">Mesmo Secretário Sainte</option>
                        {irmaosAtivos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Gestão Eleita — info */}
                <div style={{ gridColumn: '1/-1', padding: '0.6rem 0.75rem', background: 'rgba(16,185,129,0.08)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-success)', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>Gestão Eleita</span> — VM, Orador e Secretário eleitos são buscados automaticamente da chapa (Etapa 1). Assinam os Requerimentos.
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button style={S.btn('surface')} onClick={() => setModalAberto(false)}>Cancelar</button>
                <button style={S.btn('accent')} onClick={salvarEleicao} disabled={loadingAcao}>
                  {loadingAcao ? 'Salvando...' : '💾 Criar Eleição'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // DETALHE DA ELEIÇÃO
  // ─────────────────────────────────────────────────────────
  const st = STATUS_INFO[eleicaoSelecionada.status] || STATUS_INFO.rascunho;
  const presEleicao = presencas.filter(p => p.sessao === 'eleicao');
  const presPosse = presencas.filter(p => p.sessao === 'posse');
  const chapaEleita = chapas.filter(c => c.eleita);

  // ── Cálculo da aptidão (executado ao abrir as etapas "Aptos a Votar" e "Sessão Eleição") ──
  const carregarAptidao = async () => {
    if (!eleicaoSelecionada) return;
    setAptidao(a => ({ ...a, carregando: true }));
    try {
      const ref = eleicaoSelecionada.data_eleicao || new Date().toISOString().substring(0, 10);
      // Período da presença: desde a última eleição; sem eleição anterior, 12 meses
      const anterior = eleicoes.filter(e => e.id !== eleicaoSelecionada.id && e.data_eleicao && e.data_eleicao < ref)
        .sort((a, b) => b.data_eleicao.localeCompare(a.data_eleicao))[0];
      const ini = anterior ? anterior.data_eleicao : (() => { const d = new Date(ref + 'T00:00:00'); d.setFullYear(d.getFullYear() - 1); return d.toISOString().substring(0, 10); })();
      const fmtD = (d) => d.split('-').reverse().join('/');
      const _hj = new Date().toISOString().substring(0, 10);
      const periodo = `${anterior ? 'desde a última eleição' : 'últimos 12 meses'}: ${fmtD(ini)} a ${fmtD(ref < _hj ? ref : _hj)}`;

      // Universo: Mestres regulares OU licenciados na data da eleição
      // (irregulares, desligados e falecidos ficam fora da lista)
      const universo = (irmaos || []).filter(i => i.data_exaltacao && i.data_exaltacao <= ref
        && ['regular', 'licenciado'].includes(situacaoNaData(i, ref, historicoSituacoes)));

      // Tesouraria: lançamentos do irmão em aberto vencidos até a data da eleição
      let lanc = [], pg = 0;
      for (;;) {
        const { data, error } = await supabase.from('lancamentos_loja')
          .select('origem_irmao_id, data_vencimento, valor, status, descricao')
          .eq('origem_tipo', 'Irmao').in('status', ['pendente', 'parcial']).lte('data_vencimento', ref)
          .range(pg * 1000, pg * 1000 + 999);
        if (error) throw error;
        lanc = lanc.concat(data || []);
        if (!data || data.length < 1000 || pg >= 50) break;
        pg++;
      }

      // Presença: sessões no período e registros (em lotes)
      // Presença até a última sessão realizada (nunca além de hoje), mesmo com eleição futura
      const hojeIso = new Date().toISOString().substring(0, 10);
      const fimPres = ref < hojeIso ? ref : hojeIso;
      const { data: sessoes } = await supabase.from('sessoes_presenca').select('id, data_sessao').gte('data_sessao', ini).lte('data_sessao', fimPres);
      const dataSessao = Object.fromEntries((sessoes || []).map(x => [x.id, x.data_sessao]));
      let regs = [];
      const ids = (sessoes || []).map(x => x.id);
      for (let i = 0; i < ids.length; i += 100) {
        let pgr = 0;
        for (;;) {
          const { data } = await supabase.from('registros_presenca').select('membro_id, presente, sessao_id')
            .in('sessao_id', ids.slice(i, i + 100)).range(pgr * 1000, pgr * 1000 + 999);
          regs = regs.concat(data || []);
          if (!data || data.length < 1000 || pgr >= 50) break;
          pgr++;
        }
      }

      const ajustes = eleicaoSelecionada.aptidao_ajustes || {};
      const linhas = universo.map(i => {
        const pend = lanc.filter(l => String(l.origem_irmao_id) === String(i.id));
        const meses = [...new Set(pend.map(l => String(l.data_vencimento || '').substring(0, 7)).filter(Boolean))].sort();
        // 3 meses em aberto (consecutivos ou não) já torna o irmão inapto; até 2 meses ainda é apto
        const finOk = meses.length < LIMITE_MESES_PENDENTES;

        // Prerrogativa por idade: 70 anos completos há pelo menos 6 meses na data da eleição → isento de presença.
        // Até completar 70 a presença é obrigatória; sessões depois do 70º aniversário não contam.
        let data70 = null, isento70 = false;
        if (i.data_nascimento) {
          const n = new Date(String(i.data_nascimento).substring(0, 10) + 'T00:00:00');
          const d70 = new Date(n); d70.setFullYear(n.getFullYear() + 70);
          data70 = d70.toISOString().substring(0, 10);
          const lim = new Date(d70); lim.setMonth(lim.getMonth() + 6);
          isento70 = lim.toISOString().substring(0, 10) <= ref;
        }

        // Licença em qualquer parte do período analisado → "Lic" (inapto, por enquanto)
        // Licença: só deixa inapto se ainda estiver licenciado na data da eleição (licença encerrada = regular)
        const licenca = situacaoNaData(i, ref, historicoSituacoes) === 'licenciado';

        // Presença: sessões em que estava regular, antes de completar 70 anos
        const meus = regs.filter(r => String(r.membro_id) === String(i.id))
          .filter(r => situacaoNaData(i, dataSessao[r.sessao_id], historicoSituacoes) === 'regular')
          .filter(r => !data70 || String(dataSessao[r.sessao_id]) < data70);
        const presentes = meus.filter(r => r.presente).length;
        const total = meus.length;
        const pct = total ? Math.round((presentes / total) * 100) : 0;
        const presOk = isento70 || pct >= PRESENCA_MINIMA;
        const aptoAuto = finOk && presOk && !licenca;
        const ajuste = ajustes[String(i.id)];
        const motivos = [licenca && 'licenciado', !finOk && `tesouraria: ${meses.length} meses em aberto`, !presOk && `presença ${pct}%`].filter(Boolean).join(' · ');
        return {
          irmao: i, nome: i.nome, nomeCurto: nomeCurto(i.nome), cim: i.cim, meses, qtdPend: pend.length, finOk,
          textoTesouraria: meses.length === 0 ? 'Em dia' : `${meses.length} mês(es) em aberto`,
          presentes, total, pct, presOk, isento70, licenca, aptoAuto, motivos, ajuste,
          textoPresenca: isento70 ? `Dispensada (${pct}%)` : `${pct}% (${presentes}/${total})`,
          apto: ajuste ? ajuste.status === 'apto' : aptoAuto,
        };
      }).sort((a, b) => a.nomeCurto.localeCompare(b.nomeCurto));

      // Assinantes do PDF: VM, Chanceler e Tesoureiro do Corpo Administrativo do ano da eleição
      const ano = String(ref).substring(0, 4);
      const { data: corpo } = await supabase.from('corpo_administrativo').select('cargo, ano_exercicio, irmao_id');
      const norm = (c) => String(c || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      const nomeCargo = (...alvos) => {
        const r = (corpo || []).find(c => String(c.ano_exercicio || '').split(/[^0-9]+/).includes(ano) && alvos.includes(norm(c.cargo)));
        return r ? (irmaos || []).find(x => x.id === r.irmao_id)?.nome : null;
      };
      const assinantes = {
        vm: nomeCargo('veneravel mestre', 'veneravel'), chanceler: nomeCargo('chanceler'), tesoureiro: nomeCargo('tesoureiro'),
      };
      setAptidao({ carregando: false, linhas, periodo, assinantes });
      return { linhas, periodo, assinantes }; // quem chamou pode usar na hora (ex.: PDF do edital)
    } catch (e) {
      setAptidao(a => ({ ...a, carregando: false }));
      showError('Erro ao analisar a aptidão: ' + e.message);
    }
  };
  carregarAptidaoRef.current = carregarAptidao;
  const aptidaoPorIrmao = Object.fromEntries(aptidao.linhas.map(l => [String(l.irmao.id), l]));

  const ajustarAptidao = async (linha) => {
    if (!liberado('eleicao')) return;     // aptidão é do pleito
    const atuais = { ...(eleicaoSelecionada.aptidao_ajustes || {}) };
    if (linha.ajuste) {
      delete atuais[String(linha.irmao.id)];
    } else {
      const just = window.prompt(`Tornar ${linha.nomeCurto} APTO a votar.\nInforme a justificativa:`);
      if (!just || !just.trim()) return;
      atuais[String(linha.irmao.id)] = { status: 'apto', justificativa: just.trim(), em: new Date().toISOString() };
    }
    await atualizarEleicao({ aptidao_ajustes: atuais });
    setEleicaoSelecionada(e => ({ ...e, aptidao_ajustes: atuais }));
    setAptidao(a => ({ ...a, linhas: a.linhas.map(l => (l.irmao.id === linha.irmao.id
      ? { ...l, ajuste: atuais[String(l.irmao.id)], apto: atuais[String(l.irmao.id)] ? true : l.aptoAuto } : l)) }));
  };

  // Encerrar / liberar o processo (Admin e Venerável)
  const encerrarEtapa = async (etapa) => {
    if (!podeLiberar) { setAvisoTrava(etapa); return; }
    const nome = etapa === 'posse' ? 'a POSSE' : 'a ELEIÇÃO';
    if (!window.confirm(`Encerrar ${nome}?\nOs dados ficam bloqueados e só o Venerável ou o Admin podem liberar.`)) return;
    await atualizarEleicao(etapa === 'posse'
      ? { posse_encerrada: true, posse_encerrada_em: new Date().toISOString() }
      : { eleicao_encerrada: true, eleicao_encerrada_em: new Date().toISOString() });
    showSuccess(`🔒 ${etapa === 'posse' ? 'Posse' : 'Eleição'} encerrada.`);
  };
  const liberarEtapa = async (etapa) => {
    if (!podeLiberar) { setAvisoTrava(etapa); return; }
    const nome = etapa === 'posse' ? 'a POSSE' : 'a ELEIÇÃO';
    if (!window.confirm(`Liberar ${nome} para edição?`)) return;
    await atualizarEleicao(etapa === 'posse' ? { posse_encerrada: false } : { eleicao_encerrada: false });
    setAvisoTrava(null);
    showSuccess('🔓 Liberado para edição.');
  };

  const ETAPAS = [
    { n: 1, label: 'Configuração' },
    { n: 5, label: 'Aptos a Votar' },
    { n: 2, label: 'Sessão Eleição' },
    { n: 3, label: 'Sessão Posse' },
    { n: 4, label: 'Documentos' },
  ];

  return (
    <div style={{ padding: '1.5rem', background: 'var(--color-bg)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button style={S.btn('surface')} onClick={() => setEleicaoSelecionada(null)}>← Voltar</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--color-text)', margin: 0 }}>
              ⚖️ Gestão {eleicaoSelecionada.gestao}
            </h2>
            <span style={S.badge(st.cor)}>{st.emoji} {st.label}</span>

            {/* Dados do registro em Cartório, logo após o status */}
            {eleicaoSelecionada.status === 'registrado_cartorio' && (
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                {eleicaoSelecionada.registro_numero ? `Registro ${eleicaoSelecionada.registro_numero}` : 'sem nº de registro'}
                {eleicaoSelecionada.registro_averbacao ? ` · Averbação ${eleicaoSelecionada.registro_averbacao}` : ''}
                {eleicaoSelecionada.registro_data ? ` · ${formatarData(eleicaoSelecionada.registro_data)}` : ''}
                {podeEditar && (
                  <button onClick={() => { setFormRegistro({
                      registro_numero: eleicaoSelecionada.registro_numero || '',
                      registro_averbacao: eleicaoSelecionada.registro_averbacao || '',
                      registro_data: eleicaoSelecionada.registro_data || '',
                    }); setEditandoRegistro(true); }}
                    style={{ marginLeft: '0.4rem', background: 'transparent', border: 'none', color: 'var(--color-accent)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
                    editar
                  </button>
                )}
              </span>
            )}

            {/* Travas do processo */}
            {eleicaoTravada && (
              <span style={{ ...S.badge('gold'), display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                🔒 Eleição encerrada{eleicaoSelecionada.eleicao_encerrada_em ? ` em ${formatarData(eleicaoSelecionada.eleicao_encerrada_em)}` : ''}
                {podeLiberar && <button onClick={() => liberarEtapa('eleicao')} style={{ background: 'transparent', border: 'none', color: 'inherit', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}>liberar</button>}
              </span>
            )}
            {posseTravada && (
              <span style={{ ...S.badge('gold'), display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                🔒 Posse encerrada{eleicaoSelecionada.posse_encerrada_em ? ` em ${formatarData(eleicaoSelecionada.posse_encerrada_em)}` : ''}
                {podeLiberar && <button onClick={() => liberarEtapa('posse')} style={{ background: 'transparent', border: 'none', color: 'inherit', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}>liberar</button>}
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            {eleicaoSelecionada.tipo_votacao === 'aclamacao' ? 'Chapa Única — Aclamação' : 'Disputa entre Chapas'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {podeLiberar && !eleicaoTravada && (
            <button style={S.btn('surface')} onClick={() => encerrarEtapa('eleicao')}>🔒 Encerrar eleição</button>
          )}
          {podeLiberar && !posseTravada && eleicaoTravada && (
            <button style={S.btn('surface')} onClick={() => encerrarEtapa('posse')}>🔒 Encerrar posse</button>
          )}
          {eleicaoSelecionada.status === 'posse_realizada' && podeEditar && (
            <button style={S.btn('success')} onClick={marcarRegistrado}>🏛️ Marcar Registrado em Cartório</button>
          )}
        </div>
      </div>

      {/* Stepper */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '1.5rem', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
        {ETAPAS.map((ep, idx) => (
          <button key={ep.n}
            style={{
              flex: 1, padding: '0.75rem 0.5rem', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600',
              background: etapa === ep.n ? 'var(--color-accent)' : 'transparent',
              color: etapa === ep.n ? 'white' : 'var(--color-text-muted)',
              borderRight: idx < ETAPAS.length - 1 ? '1px solid var(--color-border)' : 'none',
              transition: 'all 0.2s',
            }}
            onClick={() => setEtapa(ep.n)}
          >
            {idx + 1}. {ep.label}
          </button>
        ))}
      </div>

      {/* ── Etapa 1: Configuração e Chapa ── */}
      {etapa === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Datas */}
          <div style={S.card}>
            <h3 style={{ fontWeight: '700', marginBottom: '1rem', color: 'var(--color-text)', fontSize: '0.95rem' }}>📅 Datas e Responsáveis</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {[
                { titulo: '🗳️ Eleição', cor: '#60a5fa', campos: [
                  { key: 'data_edital_eleicao', label: 'Data Edital Eleição', type: 'date' },
                  { key: 'data_eleicao', label: 'Data da Eleição', type: 'date' },
                  { key: 'hora_eleicao', label: 'Hora da Eleição', type: 'time' },
                ]},
                { titulo: '🎖️ Posse', cor: '#c9a84c', campos: [
                  { key: 'data_edital_posse', label: 'Data Edital Posse', type: 'date' },
                  { key: 'data_posse', label: 'Data da Posse', type: 'date' },
                  { key: 'hora_posse', label: 'Hora da Posse', type: 'time' },
                ]},
                { titulo: '📆 Gestão, Chapa e Quórum', cor: '#10b981', campos: [
                  { key: 'nome_chapa', label: 'Nome da Chapa', type: 'text', placeholder: 'Ex: Chapa Acácia Unida' },
                  { key: 'data_inicio_gestao', label: 'Início da Gestão', type: 'date' },
                  { key: 'data_fim_gestao', label: 'Fim da Gestão', type: 'date' },
                  { key: 'ano_exercicio', label: 'Ano de Exercício', type: 'text', placeholder: 'Ex: 2026/2027' },
                  { key: 'total_mestres_quorum', label: 'Total de Mestres (quórum)', type: 'number', placeholder: `Automático: ${calcularQuorum(irmaos, eleicaoSelecionada, presencas, historicoSituacoes).totalCalculado}` },
                ]},
              ].map(g => (
                <div key={g.titulo} style={{ gridColumn: '1/-1', padding: '0.75rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', borderLeft: `3px solid ${g.cor}` }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: g.cor, textTransform: 'uppercase', marginBottom: '0.6rem' }}>{g.titulo}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '0.75rem' }}>
                    {g.campos.map(f => (
                      <div key={f.key}>
                        <label style={S.label}>{f.label}</label>
                        <input type={f.type} style={S.input} disabled={!podeEditar || campoTravado(f.key)} placeholder={f.placeholder}
                          value={eleicaoSelecionada[f.key] || ''}
                          onChange={e => setEleicaoSelecionada(p => ({ ...p, [f.key]: e.target.value }))}
                          onBlur={e => podeEditar && atualizarEleicao({ [f.key]: e.target.value || null })}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {/* Grupo: Requerimentos ao cartório */}
              <div style={{ gridColumn: '1/-1', padding: '0.75rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid #a78bfa' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                  📩 Requerimentos ao Cartório — data de emissão e quem assina
                </div>
                {[['eleicao', 'Requerimento — Eleição'], ['posse', 'Requerimento — Posse']].map(([qual, titulo]) => {
                  const ass = resolverAssinanteRequerimento(qual, eleicaoSelecionada, chapas, irmaos);
                  const modo = eleicaoSelecionada[`req_${qual}_assinante`] || 'auto';
                  const salvar = (campos) => { setEleicaoSelecionada(p => ({ ...p, ...campos })); podeEditar && atualizarEleicao(campos); };
                  return (
                    <div key={qual} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '0.75rem', alignItems: 'end', marginBottom: '0.6rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--color-text)', alignSelf: 'center' }}>{titulo}</div>
                      <div>
                        <label style={S.label}>Data de Emissão</label>
                        <input type="date" style={S.input} disabled={!podeEditar}
                          value={eleicaoSelecionada[`req_${qual}_data`] || ''}
                          onChange={e => setEleicaoSelecionada(p => ({ ...p, [`req_${qual}_data`]: e.target.value }))}
                          onBlur={e => podeEditar && atualizarEleicao({ [`req_${qual}_data`]: e.target.value || null })} />
                      </div>
                      <div>
                        <label style={S.label}>Quem Assina</label>
                        <select style={S.input} disabled={!podeEditar} value={modo}
                          onChange={e => salvar({ [`req_${qual}_assinante`]: e.target.value, ...(e.target.value !== 'outro' ? { [`req_${qual}_assinante_id`]: null } : {}) })}>
                          <option value="auto">Automático (pela data)</option>
                          <option value="sainte">VM Sainte</option>
                          <option value="eleito">VM Eleito</option>
                          <option value="outro">Outro irmão</option>
                        </select>
                      </div>
                      {modo === 'outro' && (
                        <div>
                          <label style={S.label}>Irmão</label>
                          <select style={S.input} disabled={!podeEditar} value={eleicaoSelecionada[`req_${qual}_assinante_id`] || ''}
                            onChange={e => salvar({ [`req_${qual}_assinante_id`]: e.target.value || null })}>
                            <option value="">Selecione...</option>
                            {irmaosRegularesHoje.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                          </select>
                        </div>
                      )}
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', alignSelf: 'center' }}>
                        ✍️ Assinará: <strong style={{ color: ass.irmao ? 'var(--color-text)' : '#ef4444' }}>{ass.irmao?.nome || 'não definido'}</strong>
                        {modo === 'auto' && <> ({ass.origem === 'sainte' ? 'VM Sainte' : 'VM Eleito'})</>}
                        {!eleicaoSelecionada[`req_${qual}_data`] && <> · data: hoje</>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Grupo: Gestão Sainte */}
              <div style={{ gridColumn: '1/-1', padding: '0.75rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-accent)' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                  Gestão Sainte — Editais de Eleição e Atas de Eleição
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  {[
                    { key: 'vm_convocante_id',    label: 'VM Sainte' },
                    { key: 'orador_sainte_id',    label: 'Orador Sainte' },
                    { key: 'secretario_sainte_id',label: 'Secretário Sainte' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={S.label}>{f.label}</label>
                      <select style={S.select} disabled={!podeEditar || eleicaoTravada}
                        value={eleicaoSelecionada[f.key] || ''}
                        onChange={e => { setEleicaoSelecionada(p => ({ ...p, [f.key]: e.target.value })); podeEditar && atualizarEleicao({ [f.key]: e.target.value || null }); }}
                      >
                        <option value="">Selecione...</option>
                        {irmaosAtivos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  {[
                    { key: 'primeiro_vigilante_sainte_id', label: '1º Vigilante Sainte' },
                    { key: 'segundo_vigilante_sainte_id',  label: '2º Vigilante Sainte' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={S.label}>{f.label}</label>
                      <select style={S.select} disabled={!podeEditar || eleicaoTravada}
                        value={eleicaoSelecionada[f.key] || ''}
                        onChange={e => { setEleicaoSelecionada(p => ({ ...p, [f.key]: e.target.value })); podeEditar && atualizarEleicao({ [f.key]: e.target.value || null }); }}
                      >
                        <option value="">Selecione...</option>
                        {irmaosAtivos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                  Se o Orador ou Secretário estiverem concorrendo, indique o substituto para assinar a ata:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {[
                    { key: 'orador_substituto_ata_id',    label: 'Substituto do Orador na Ata', placeholder: 'Mesmo orador sainte' },
                    { key: 'secretario_substituto_ata_id',label: 'Substituto do Secretário na Ata', placeholder: 'Mesmo secretário sainte' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={S.label}>{f.label}</label>
                      <select style={S.select} disabled={!podeEditar || eleicaoTravada}
                        value={eleicaoSelecionada[f.key] || ''}
                        onChange={e => { setEleicaoSelecionada(p => ({ ...p, [f.key]: e.target.value })); podeEditar && atualizarEleicao({ [f.key]: e.target.value || null }); }}
                      >
                        <option value="">{f.placeholder}</option>
                        {irmaosAtivos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grupo: Instaladores — Ata de Posse */}
              <div style={{ gridColumn: '1/-1', padding: '0.75rem', background: 'rgba(99,102,241,0.07)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid #6366f1' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  Instaladores — Ata de Posse
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginBottom: '0.6rem' }}>
                  Se não selecionados, usa VM, Orador e Secretário saintes.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  {[
                    { key: 'vm_instalador_id',                    label: 'VM Instalador',                    placeholder: 'Mesmo VM Sainte' },
                    { key: 'primeiro_vigilante_instalador_id',    label: '1º Vigilante Instalador',          placeholder: 'Selecione...' },
                    { key: 'segundo_vigilante_instalador_id',     label: '2º Vigilante Instalador',          placeholder: 'Selecione...' },
                    { key: 'orador_instalador_id',                label: 'Orador Instalador',                placeholder: 'Mesmo Orador Sainte' },
                    { key: 'secretario_instalador_id',            label: 'Secretário Instalador',            placeholder: 'Mesmo Secretário Sainte' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={S.label}>{f.label}</label>
                      <select style={S.select} disabled={!podeEditar || posseTravada}
                        value={eleicaoSelecionada[f.key] || ''}
                        onChange={e => { setEleicaoSelecionada(p => ({ ...p, [f.key]: e.target.value })); podeEditar && atualizarEleicao({ [f.key]: e.target.value || null }); }}
                      >
                        <option value="">{f.placeholder}</option>
                        {irmaosAtivos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grupo: Gestão Eleita — automático da chapa */}
              <div style={{ gridColumn: '1/-1', padding: '0.6rem 0.75rem', background: 'rgba(16,185,129,0.08)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-success)' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-success)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  Gestão Eleita — assina Requerimentos (automático da chapa)
                </div>
                {(() => {
                  const chapas_el = chapas.filter(c => c.eleita);
                  const vmEl  = chapas_el.find(c => c.cargo === 'Veneravel Mestre' || c.cargo === 'Venerável Mestre');
                  const orEl  = chapas_el.find(c => c.cargo === 'Orador');
                  const secEl = chapas_el.find(c => c.cargo === 'Secretario' || c.cargo === 'Secretário');
                  const nm = (ch) => ch ? (irmaosAtivos.find(i => i.id === ch.irmao_id)?.nome || '—') : '—';
                  return (
                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.82rem', flexWrap: 'wrap' }}>
                      <span><strong>VM (Presidente):</strong> {nm(vmEl)}</span>
                      <span><strong>Orador:</strong> {nm(orEl)}</span>
                      <span><strong>Secretário:</strong> {nm(secEl)}</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Chapa */}
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: '700', color: 'var(--color-text)', fontSize: '0.95rem', margin: 0 }}>
                👥 {eleicaoSelecionada.tipo_votacao === 'disputa' ? 'Chapas' : 'Chapa'}
              </h3>
              {podeEditar && (
                editandoChapas
                  ? <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button style={S.btn('surface')} onClick={() => setEditandoChapas(false)}>Cancelar</button>
                      <button style={S.btn('accent')} onClick={salvarChapas} disabled={loadingAcao}>💾 Salvar</button>
                    </div>
                  : <button style={S.btn('accent')} onClick={iniciarEdicaoChapas}>✏️ Editar Chapa</button>
              )}
            </div>

            {editandoChapas ? (() => {
              // Irmão em mais de um cargo → destaca em vermelho
              const cargosPorIrmao = {};
              ORDEM_CARGOS.forEach(cg => { const id = chapaForm[cg]; if (id) (cargosPorIrmao[id] = cargosPorIrmao[id] || []).push(cg); });
              const totalDup = Object.values(cargosPorIrmao).filter(l => l.length > 1).length;
              return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {totalDup > 0 && (
                  <div style={{ padding: '0.6rem 0.9rem', borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.5)', color: '#ef4444', fontSize: '0.8rem', fontWeight: 700 }}>
                    ⚠️ {totalDup} irmão(s) em mais de um cargo — confira os campos em vermelho.
                  </div>
                )}
                {ORDEM_CARGOS.map(cargo => {
                  const id = chapaForm[cargo];
                  const outros = id ? (cargosPorIrmao[id] || []).filter(cg => cg !== cargo) : [];
                  const dup = outros.length > 0;
                  return (
                  <div key={cargo} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '0.5rem', alignItems: 'center' }}>
                    <label style={{ ...S.label, margin: 0, color: dup ? '#ef4444' : S.label.color }}>{rotuloCargo(cargo)}</label>
                    <div>
                      <select disabled={eleicaoTravada} style={{ ...S.select, ...(dup ? { border: '2px solid #ef4444', background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontWeight: 700 } : {}) }}
                        value={id || ''}
                        onChange={e => setChapaForm(p => ({ ...p, [cargo]: e.target.value || undefined }))}>
                        <option value="">— sem designação —</option>
                        {irmaosAtivos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                      </select>
                      {dup && <div style={{ fontSize: '0.7rem', color: '#ef4444', marginTop: '0.2rem' }}>Também em: {outros.map(rotuloCargo).join(', ')}</div>}
                    </div>
                  </div>
                  );
                })}
              </div>
              );
            })() : chapaEleita.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Nenhum membro designado ainda.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {chapaEleita
                  .sort((a, b) => ORDEM_CARGOS.indexOf(a.cargo) - ORDEM_CARGOS.indexOf(b.cargo))
                  .map(c => {
                    const i = irmaosAtivos.find(x => x.id === c.irmao_id) || irmaos?.find(x => x.id === c.irmao_id);
                    return (
                      <div key={c.id} style={{ display: 'flex', gap: '1rem', padding: '0.4rem 0.75rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ fontWeight: '600', color: 'var(--color-accent)', minWidth: '180px', fontSize: '0.8rem' }}>{rotuloCargo(c.cargo)}</span>
                        <span style={{ color: 'var(--color-text)', fontSize: '0.875rem' }}>{i?.nome || '[Não encontrado]'}</span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {podeEditar && chapaEleita.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button style={S.btn('accent')} onClick={() => setEtapa(5)}>Avançar para Aptos a Votar →</button>
            </div>
          )}
        </div>
      )}

      {/* ── Etapa 2: Lista de presença — Eleição ── */}
      {/* ── Etapa: Aptos a Votar (antes da Sessão de Eleição) ── */}
      {etapa === 5 && (() => {
        const L = aptidao.linhas;
        const aptos = L.filter(l => l.apto);
        const vis = L.filter(l => filtroAptidao === 'todos' ? true : filtroAptidao === 'aptos' ? l.apto : !l.apto);
        const th = { textAlign: 'left', padding: '0.5rem 0.6rem', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' };
        const td = { padding: '0.5rem 0.6rem', fontSize: '0.85rem', color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)' };
        const selo = (ok, txt) => (
          <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '999px', whiteSpace: 'nowrap',
            background: ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: ok ? '#10b981' : '#ef4444' }}>{txt}</span>
        );
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={S.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                <h3 style={{ fontWeight: '700', color: 'var(--color-text)', fontSize: '0.95rem', margin: 0, flex: 1 }}>
                  🗳️ Aptos a Votar <span style={{ ...S.badge('blue'), marginLeft: '0.5rem' }}>{aptos.length} de {L.length} Mestres</span>
                </h3>
                <button style={S.btn('surface')} onClick={() => carregarAptidao()} disabled={aptidao.carregando}>↻ Recalcular</button>
                <button style={S.btn('accent')} disabled={!aptos.length}
                  onClick={() => gerarAptosVotarPDF({ linhas: aptos, eleicao: eleicaoSelecionada, dadosLoja, logoB64: LOGO_LOJA_B64, periodo: aptidao.periodo, assinantes: aptidao.assinantes })}>
                  📄 PDF dos aptos
                </button>
                <button style={S.btn('surface')} disabled={!L.some(l => !l.apto)}
                  onClick={() => gerarAptosVotarPDF({ tipo: 'inaptos', linhas: L.filter(l => !l.apto), eleicao: eleicaoSelecionada, dadosLoja, logoB64: LOGO_LOJA_B64, periodo: aptidao.periodo, assinantes: aptidao.assinantes })}>
                  📄 PDF dos inaptos
                </button>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '0 0 0.75rem' }}>
                Regras: tesouraria com no máximo {LIMITE_MESES_PENDENTES - 1} meses em aberto ({LIMITE_MESES_PENDENTES} ou mais, consecutivos ou não, = inapto) e presença mínima de {PRESENCA_MINIMA}% — período {aptidao.periodo || '…'}.
                Sessões em licença não contam. <span style={{ color: '#facc15' }}>★</span> = prerrogativa por idade (70 anos há 6 meses ou mais: presença dispensada). Lic = licenciado na data da eleição (licença já encerrada não conta).
              </p>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {[['todos', 'Todos'], ['aptos', 'Aptos'], ['inaptos', 'Inaptos']].map(([k, l]) => (
                    <button key={k} onClick={() => setFiltroAptidao(k)}
                      style={{ padding: '0.3rem 0.8rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                        border: `1px solid ${filtroAptidao === k ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        background: filtroAptidao === k ? 'var(--color-accent-bg)' : 'transparent', color: filtroAptidao === k ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>{l}</button>
                  ))}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--color-text)', cursor: podeEditar ? 'pointer' : 'default' }}>
                  <input type="checkbox" checked={!!eleicaoSelecionada.bloquear_inaptos} disabled={!podeEditar || eleicaoTravada}
                    onChange={e => { setEleicaoSelecionada(x => ({ ...x, bloquear_inaptos: e.target.checked })); atualizarEleicao({ bloquear_inaptos: e.target.checked }); }} />
                  Bloquear a presença dos inaptos na Sessão de Eleição (desmarcado: só mostra o selo)
                </label>
              </div>
              {aptidao.carregando ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Analisando tesouraria e presença…</p>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--color-surface-3)' }}>
                      <tr><th style={th}>Irmão</th><th style={th}>CIM</th><th style={th}>Tesouraria</th><th style={th}>Presença</th><th style={th}>Situação</th>{podeEditar && <th style={th}></th>}</tr>
                    </thead>
                    <tbody>
                      {vis.map((l, i) => (
                        <tr key={l.irmao.id} style={{ background: i % 2 ? 'var(--color-surface-2)' : 'var(--color-surface)' }}>
                          <td style={{ ...td, fontWeight: 600 }} title={l.irmao.nome}>
                            {l.nomeCurto}
                            {l.isento70 && <span title="Prerrogativa por idade (70 anos há 6 meses ou mais): presença dispensada" style={{ marginLeft: '0.35rem', color: '#facc15' }}>★</span>}
                            {l.licenca && <span title="Licença no período analisado" style={{ marginLeft: '0.35rem', fontSize: '0.65rem', fontWeight: 800, padding: '0.05rem 0.35rem', borderRadius: '4px', background: 'rgba(245,158,11,0.15)', color: '#d97706', border: '1px solid rgba(245,158,11,0.4)' }}>Lic</span>}
                          </td>
                          <td style={td}>{l.cim || '—'}</td>
                          <td style={td} title={l.meses.length ? `Meses em aberto: ${l.meses.map(m => m.split('-').reverse().join('/')).join(', ')}` : ''}>
                            {selo(l.finOk, l.textoTesouraria)}
                          </td>
                          <td style={td}>{selo(l.presOk, l.textoPresenca)}</td>
                          <td style={td} title={l.ajuste ? `Justificativa: ${l.ajuste.justificativa}` : l.motivos}>
                            {selo(l.apto, l.apto ? '✅ Apto' : '⛔ Inapto')}
                            {!l.apto && l.motivos && <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>{l.motivos}</div>}
                          </td>
                          {podeEditar && (
                            <td style={{ ...td, textAlign: 'right' }}>
                              {(l.ajuste || !l.aptoAuto) && (
                                <button disabled={eleicaoTravada} onClick={() => ajustarAptidao(l)} title={eleicaoTravada ? 'Eleição encerrada' : (l.ajuste ? 'Voltar à situação calculada' : 'Tornar apto (com justificativa)')}
                                  style={{ padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                                    border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)' }}>
                                  {l.ajuste ? '↺' : '✏️ Tornar apto'}
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button style={S.btn('surface')} onClick={() => setEtapa(1)}>← Voltar</button>
              <button style={S.btn('accent')} onClick={() => setEtapa(2)}>Avançar para Sessão de Eleição →</button>
            </div>
          </div>
        );
      })()}

      {etapa === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: '700', color: 'var(--color-text)', fontSize: '0.95rem', margin: 0 }}>
                ✅ Presença — Sessão de Eleição
                <span style={{ ...S.badge('blue'), marginLeft: '0.75rem' }}>{presEleicao.length} presentes</span>
              </h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.4rem' }}>
              {irmaosAptosParaAto(eleicaoSelecionada.data_eleicao, 'eleicao')
                .filter(i => {
                  // Apenas Mestres: deve ter data_exaltacao anterior ou igual à data do ato
                  if (!i.data_exaltacao) return false;
                  if (eleicaoSelecionada.data_eleicao) {
                    return new Date(i.data_exaltacao + 'T00:00:00') <= new Date(eleicaoSelecionada.data_eleicao + 'T00:00:00');
                  }
                  return true;
                })
                .map(i => {
                  const marcado = presEleicao.some(p => p.irmao_id === i.id);
                  const apt = aptidaoPorIrmao[String(i.id)];
                  const bloqueado = !!eleicaoSelecionada.bloquear_inaptos && apt && !apt.apto && !marcado;
                  return (
                    <div key={i.id}
                      onClick={() => { if (eleicaoTravada) { setAvisoTrava('eleicao'); return; } if (podeEditar && !bloqueado) togglePresenca(i.id, 'eleicao'); }}
                      title={bloqueado ? 'Inapto a votar (bloqueado em "Aptos a Votar")' : undefined}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', cursor: podeEditar ? 'pointer' : 'default',
                        background: marcado ? 'var(--color-accent-bg)' : 'var(--color-surface-2)',
                        border: `1px solid ${marcado ? 'var(--color-accent)' : 'transparent'}`,
                        transition: 'all 0.15s',
                      }}>
                      <div style={{
                        width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                        background: marcado ? 'var(--color-accent)' : 'var(--color-bg)',
                        border: `2px solid ${marcado ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {marcado && <span style={{ color: 'white', fontSize: '0.7rem', fontWeight: '700' }}>✓</span>}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: marcado ? '600' : '400', color: 'var(--color-text)', opacity: bloqueado ? 0.5 : 1 }}>{i.nome}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                          CIM {i.cim}
                          {apt && (
                            <span style={{ marginLeft: '0.4rem', fontWeight: 700, color: apt.apto ? '#10b981' : '#ef4444' }}>
                              {apt.apto ? '· ✅ Apto' : '· ⛔ Inapto'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {podeEditar && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button style={S.btn('surface')} onClick={() => setEtapa(5)}>← Voltar</button>
              <button style={S.btn('success')} onClick={confirmarEleicao} disabled={presEleicao.length === 0}>
                ✅ Confirmar Eleição ({presEleicao.length} presentes)
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Etapa 3: Lista de presença — Posse ── */}
      {etapa === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: '700', color: 'var(--color-text)', fontSize: '0.95rem', margin: 0 }}>
                🎖️ Presença — Sessão de Posse
                <span style={{ ...S.badge('green'), marginLeft: '0.75rem' }}>{presPosse.length} presentes</span>
              </h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.4rem' }}>
              {irmaosAptosParaAto(eleicaoSelecionada.data_posse, 'posse', ['regular', 'licenciado'])
                .filter(i => {
                  // Posse: todos os irmãos (Aprendizes, Companheiros e Mestres) iniciados até a data da posse
                  if (presPosse.some(p => String(p.irmao_id) === String(i.id))) return true;
                  if (!i.data_iniciacao) return false;
                  if (eleicaoSelecionada.data_posse) {
                    return new Date(i.data_iniciacao + 'T00:00:00') <= new Date(eleicaoSelecionada.data_posse + 'T00:00:00');
                  }
                  return true;
                })
                .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
                .map(i => {
                const marcado = presPosse.some(p => p.irmao_id === i.id);
                return (
                  <div key={i.id}
                    onClick={() => { if (posseTravada) { setAvisoTrava('posse'); return; } if (podeEditar) togglePresenca(i.id, 'posse'); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', cursor: podeEditar ? 'pointer' : 'default',
                      background: marcado ? 'rgba(16,185,129,0.1)' : 'var(--color-surface-2)',
                      border: `1px solid ${marcado ? 'var(--color-success)' : 'transparent'}`,
                      transition: 'all 0.15s',
                    }}>
                    <div style={{
                      width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                      background: marcado ? 'var(--color-success)' : 'var(--color-bg)',
                      border: `2px solid ${marcado ? 'var(--color-success)' : 'var(--color-border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {marcado && <span style={{ color: 'white', fontSize: '0.7rem', fontWeight: '700' }}>✓</span>}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: marcado ? '600' : '400', color: 'var(--color-text)' }}>{i.nome}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>CIM {i.cim}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {podeEditar && eleicaoSelecionada.status !== 'posse_realizada' && eleicaoSelecionada.status !== 'registrado_cartorio' && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button style={S.btn('surface')} onClick={() => setEtapa(2)}>← Voltar</button>
              <button style={S.btn('success')} onClick={confirmarPosse} disabled={presPosse.length === 0}>
                🎖️ Confirmar Posse ({presPosse.length} presentes)
              </button>
            </div>
          )}
          {(eleicaoSelecionada.status === 'posse_realizada' || eleicaoSelecionada.status === 'registrado_cartorio') && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button style={S.btn('surface')} onClick={() => setEtapa(2)}>← Voltar</button>
              <button style={S.btn('accent')} onClick={() => setEtapa(4)}>Ver Documentos →</button>
            </div>
          )}
        </div>
      )}

      {/* ── Etapa 4: Documentos ── */}
      {etapa === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Quórum da eleição */}
          {(() => {
            const q = calcularQuorum(irmaos, eleicaoSelecionada, presencas, historicoSituacoes);
            return (
              <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--color-text)',
                background: q.atingido ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.12)', border: `1px solid ${q.atingido ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.5)'}` }}>
                {q.atingido ? '✅' : '⛔'} <strong>Quórum da eleição:</strong> {q.presentes} presente(s) de {q.totalMestres} irmãos Mestres — mínimo 1/3 = {q.quorumMinimo}.
                {!q.atingido && <> <strong>Quórum NÃO atingido</strong> — confira antes de gerar a ata.</>}
              </div>
            );
          })()}

          {/* Alerta campos incompletos */}
          {!dadosLoja.cnpj && (
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--color-text)' }}>
              ⚠️ CNPJ da loja não cadastrado. Preencha em <strong>Sistema → Dados da Loja</strong> para que os requerimentos fiquem completos.
            </div>
          )}

          {/* Escolha do modelo (quando há mais de um para o mesmo documento) */}
          {escolhaModeloEP && (
            <div onClick={() => setEscolhaModeloEP(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', maxWidth: '420px', width: '100%' }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>📄 Qual modelo usar?</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {escolhaModeloEP.opcoes.map(m => (
                    <button key={m.id} onClick={() => gerarDoc(escolhaModeloEP.tipo, escolhaModeloEP.nomeArq, m.id, escolhaModeloEP.comLista)}
                      style={{ padding: '0.65rem 0.9rem', textAlign: 'left', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}>
                      📄 {m.nome}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button onClick={() => setEscolhaModeloEP(null)} style={S.btn('surface')}>Cancelar</button>
                </div>
              </div>
            </div>
          )}

          {/* Atalho: editar os textos dos documentos */}
          {podeEditarModelos && onAbrirModelos && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => {
                try { sessionStorage.setItem(CHAVE_RETORNO, JSON.stringify({ id: eleicaoSelecionada.id, etapa: 4 })); } catch { /* ignore */ }
                onAbrirModelos();
              }} style={S.btn('surface')}>📝 Editar modelos dos documentos</button>
            </div>
          )}

          {/* Quadro da Gestão (PDF para os irmãos) */}
          <div style={S.card}>
            <h3 style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--color-text)', marginBottom: '0.5rem' }}>📊 Quadro da Gestão</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '0 0 0.85rem' }}>
              Apresentação da Chapa à Loja (Word) e PDF com o quadro de cargos da gestão para enviar aos irmãos.
              {!eleicaoSelecionada.nome_chapa && <span style={{ color: '#f59e0b' }}> Preencha o Nome da Chapa na Configuração.</span>}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Data de emissão</label>
              <input type="date" value={dataEmissaoQuadro} onChange={e => setDataEmissaoQuadro(e.target.value)}
                style={{ ...S.input, width: 'auto', padding: '0.35rem 0.6rem', fontSize: '0.82rem' }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>sai acima da assinatura no Word e no PDF</span>
            </div>
            <BotaoDoc emoji="📄" label="Apresentação da Chapa (Word)" disabled={chapas.filter(c => c.irmao_id).length === 0} gerando={gerando === 'apresentacao_chapa'}
              onClick={() => gerarDoc('apresentacao_chapa', `Apresentacao_Chapa_${(eleicaoSelecionada.nome_chapa || 'Chapa').replace(/\s+/g, '_')}.docx`, null, false, dataEmissaoQuadro)} />
            <BotaoDoc emoji="📊" label="Quadro da Gestão (PDF)" disabled={chapaEleita.length === 0} gerando={gerando === 'quadro_gestao'}
              onClick={() => {
                setGerando('quadro_gestao');
                try {
                  gerarQuadroGestaoPDF({
                    eleicao: eleicaoSelecionada, chapaEleita, irmaos: irmaos || [], dadosLoja,
                    logoB64: LOGO_LOJA_B64, ordemCargos: ORDEM_CARGOS, dataEmissao: dataEmissaoQuadro,
                    nomeLoja: `ACÁCIA DE PARANATINGA Nº ${dadosLoja.numero_loja || '30'}`,
                  });
                } catch (e) {
                  showError('Erro ao gerar o Quadro da Gestão: ' + e.message);
                } finally {
                  setGerando('');
                }
              }} />
          </div>

          {/* Documentos na ordem do processo: Eleição → Posse → Requerimentos */}
          <div style={S.card}>
            <h3 style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--color-text)', marginBottom: '1rem' }}>🗳️ Eleição</h3>
            {(() => {
              const b = balaustresEleicao.find(x => x.sessao_especial === 'eleicao_loja' && x.numero_balaustre);
              return (
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.85rem', padding: '0.5rem 0.8rem', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: b ? '#10b981' : '#ef4444' }}>
                    {b ? `✅ Sessão de Eleição: Balaústre nº ${b.numero_balaustre}/${b.ano_balaustre}` : '⛔ Sessão de Eleição: sem balaustre registrado — a ata fica bloqueada'}
                  </span>
                  {!b && onAbrirBalaustres && (
                    <button onClick={onAbrirBalaustres} style={{ ...S.btn('surface'), padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}>📜 Ir para Balaustres</button>
                  )}
                </div>
              );
            })()}
            {controleEdital('edital_eleicao_numero', eleicaoSelecionada.data_edital_eleicao)}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <BotaoDoc emoji="📄" label="Edital de Convocação para Eleição" disabled={!eleicaoSelecionada.data_eleicao} gerando={gerando === 'edital_eleicao'}
                onClick={() => gerarDoc('edital_eleicao', `Edital_Eleicao_${eleicaoSelecionada.gestao?.replace('/', '_')}.docx`)} />
              <BotaoDoc emoji="📜" label="Ata para Eleição" disabled={chapaEleita.length === 0 || !balaustresEleicao.some(b => b.sessao_especial === 'eleicao_loja' && b.numero_balaustre)} gerando={gerando === 'ata_eleicao_loja'}
                onClick={() => gerarDoc('ata_eleicao_loja', `Ata_Eleicao_Loja_${eleicaoSelecionada.gestao?.replace('/', '_')}.docx`)} />
              <BotaoDoc emoji="📜" label="Ata para Eleição Cartório" disabled={chapaEleita.length === 0 || !balaustresEleicao.some(b => b.sessao_especial === 'eleicao_loja' && b.numero_balaustre)} gerando={gerando === 'ata_eleicao_cartorio'}
                onClick={() => gerarDoc('ata_eleicao_cartorio', `Ata_Eleicao_Cartorio_${eleicaoSelecionada.gestao?.replace('/', '_')}.docx`)} />
              <BotaoDoc emoji="📎" label="Edital + Aptos a Votar (PDF)" disabled={!eleicaoSelecionada.data_eleicao || aptidao.carregando} gerando={gerando === 'edital_eleicao_pdf'}
                onClick={() => gerarEditalAptosPdfLoja()} />
              <BotaoDoc emoji="📋" label={`Lista de Presença para a Eleição (${presEleicao.length})`} disabled={presEleicao.length === 0} gerando={gerando === 'lista_presenca_eleicao'}
                onClick={() => gerarDoc('lista_presenca_eleicao', `Lista_Presenca_Eleicao_${eleicaoSelecionada.gestao?.replace('/', '_')}.docx`)} />
            </div>
          </div>

          <div style={S.card}>
            <h3 style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--color-text)', marginBottom: '1rem' }}>🎖️ Posse</h3>
            {(() => {
              const b = balaustresEleicao.find(x => x.sessao_especial === 'posse_loja' && x.numero_balaustre);
              return (
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.85rem', padding: '0.5rem 0.8rem', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: b ? '#10b981' : '#ef4444' }}>
                    {b ? `✅ Sessão de Posse: Balaústre nº ${b.numero_balaustre}/${b.ano_balaustre}` : '⛔ Sessão de Posse: sem balaustre registrado — a ata fica bloqueada'}
                  </span>
                  {!b && onAbrirBalaustres && (
                    <button onClick={onAbrirBalaustres} style={{ ...S.btn('surface'), padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}>📜 Ir para Balaustres</button>
                  )}
                </div>
              );
            })()}
            {controleEdital('edital_posse_numero', eleicaoSelecionada.data_edital_posse)}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <BotaoDoc emoji="📄" label="Edital de Convocação para Posse" disabled={!eleicaoSelecionada.data_posse} gerando={gerando === 'edital_posse'}
                onClick={() => gerarDoc('edital_posse', `Edital_Posse_${eleicaoSelecionada.gestao?.replace('/', '_')}.docx`)} />
              <BotaoDoc emoji="📜" label="Ata para Posse" disabled={chapaEleita.length === 0 || !eleicaoSelecionada.data_posse || !balaustresEleicao.some(b => b.sessao_especial === 'posse_loja' && b.numero_balaustre)} gerando={gerando === 'ata_posse'}
                onClick={() => gerarDoc('ata_posse', `Ata_Posse_${eleicaoSelecionada.gestao?.replace('/', '_')}.docx`)} />
              <BotaoDoc emoji="📜" label="Ata para Posse Cartório" disabled={chapaEleita.length === 0 || !eleicaoSelecionada.data_posse || !balaustresEleicao.some(b => b.sessao_especial === 'posse_loja' && b.numero_balaustre)} gerando={gerando === 'ata_posse_cartorio'}
                onClick={() => gerarDoc('ata_posse_cartorio', `Ata_Posse_Cartorio_${eleicaoSelecionada.gestao?.replace('/', '_')}.docx`)} />
              <BotaoDoc emoji="📋" label={`Lista de Presença para a Posse (${presPosse.length})`} disabled={presPosse.length === 0} gerando={gerando === 'lista_presenca_posse'}
                onClick={() => gerarDoc('lista_presenca_posse', `Lista_Presenca_Posse_${eleicaoSelecionada.gestao?.replace('/', '_')}.docx`)} />
            </div>
          </div>

          <div style={S.card}>
            <h3 style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--color-text)', marginBottom: '1rem' }}>📩 Requerimentos ao Cartório</h3>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <BotaoDoc emoji="📩" label="Requerimento Ata Eleição" disabled={chapaEleita.length === 0} gerando={gerando === 'requerimento_eleicao'}
                onClick={() => gerarDoc('requerimento_eleicao', `Requerimento_Eleicao_${eleicaoSelecionada.gestao?.replace('/', '_')}.docx`)} />
              <BotaoDoc emoji="📩" label="Requerimento Ata Posse" disabled={chapaEleita.length === 0} gerando={gerando === 'requerimento_posse'}
                onClick={() => gerarDoc('requerimento_posse', `Requerimento_Posse_${eleicaoSelecionada.gestao?.replace('/', '_')}.docx`)} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <button style={S.btn('surface')} onClick={() => setEtapa(3)}>← Voltar</button>
          </div>
        </div>
      )}

      {/* Aviso: processo encerrado */}
      {avisoTrava && (
        <div onClick={() => setAvisoTrava(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '460px', padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 0.6rem', fontSize: '1rem', fontWeight: 800, color: '#f59e0b' }}>🔒 Processo encerrado</h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: 'var(--color-text)' }}>
              {avisoTrava === 'posse' ? 'A posse já foi encerrada.' : 'O processo eleitoral já foi encerrado.'}
              {' '}Alterações dependem de autorização do Venerável Mestre.
            </p>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button onClick={() => setAvisoTrava(null)} style={{ flex: 1, ...S.btn('surface') }}>Entendi</button>
              {podeLiberar && (
                <button onClick={() => liberarEtapa(avisoTrava)} style={{ flex: 1, ...S.btn('success') }}>🔓 Liberar para edição</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dados do registro em Cartório */}
      {editandoRegistro && (
        <div onClick={() => setEditandoRegistro(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '480px', padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 0.9rem', fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>🏛️ Registro em Cartório</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem', marginBottom: '0.7rem' }}>
              <div>
                <label style={S.label}>Registro nº</label>
                <input style={S.input} value={formRegistro.registro_numero}
                  onChange={e => setFormRegistro(p => ({ ...p, registro_numero: e.target.value }))} placeholder="Ex.: 1.234 do Livro A-02" />
              </div>
              <div>
                <label style={S.label}>Averbação nº</label>
                <input style={S.input} value={formRegistro.registro_averbacao}
                  onChange={e => setFormRegistro(p => ({ ...p, registro_averbacao: e.target.value }))} placeholder="Ex.: 02" />
              </div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={S.label}>Data do registro</label>
              <input type="date" style={S.input} value={formRegistro.registro_data || ''}
                onChange={e => setFormRegistro(p => ({ ...p, registro_data: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button onClick={() => setEditandoRegistro(false)} style={{ flex: 1, ...S.btn('surface') }}>Cancelar</button>
              <button style={{ flex: 2, ...S.btn('success') }}
                onClick={async () => {
                  await atualizarEleicao({
                    registro_numero: formRegistro.registro_numero.trim() || null,
                    registro_averbacao: formRegistro.registro_averbacao.trim() || null,
                    registro_data: formRegistro.registro_data || null,
                  });
                  setEditandoRegistro(false);
                  showSuccess('Dados do registro salvos!');
                }}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-componente: Botão de documento ─────────────────
function BotaoDoc({ emoji, label, onClick, disabled, gerando }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || gerando}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.6rem 1.1rem', fontSize: '0.85rem', fontWeight: '600',
        color: disabled ? 'var(--color-text-muted)' : 'var(--color-text)',
        background: disabled ? 'var(--color-surface-2)' : 'var(--color-surface-3)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!disabled && !gerando) e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.color = 'var(--color-accent)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = disabled ? 'var(--color-text-muted)' : 'var(--color-text)'; }}
    >
      {gerando ? '⏳' : emoji} {gerando ? 'Gerando...' : label}
    </button>
  );
}
