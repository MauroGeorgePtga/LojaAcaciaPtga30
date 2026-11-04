import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { calcularAptidaoVoto } from '../../utils/calcularAptidaoVoto';
import { gerarAptosVotarPDF } from '../../utils/gerarAptosVotarPDF';
import { gerarEditalAptosPDF } from '../../utils/gerarEditalAptosPDF';
import { gerarAtaSessao, gerarEditalEleicaoGLEMT, gerarListaPresencaEleicaoGLEMT, listarModelosAta } from '../../utils/gerarAtaSessao';
import { LOGO_LOJA_B64 } from '../../utils/logoLoja';
import { emitirEdital, buscarEdital, formatarNumeroEdital } from '../../utils/editais';
import VincularEdital from '../editais/VincularEdital';

// ════════════════════════════════════════════════════════════════════════
// Eleição da GLEMT — modal do balaustre
// Abas: Configuração · Aptos e Presença · Apuração · Documentos
// Os dados ficam em balaustres.eleicao_glemt (jsonb).
// ════════════════════════════════════════════════════════════════════════

const ROXO = '#8b5cf6';
const fmt = (d) => (d ? String(d).substring(0, 10).split('-').reverse().join('/') : '');
const menos15 = (iso) => { if (!iso) return ''; const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() - 15); return d.toISOString().substring(0, 10); };
const VAZIA = () => {
  const ano = new Date().getFullYear() + 1;
  return { ativo: true, status: 'realizada', ano_inicio: ano, ano_fim: ano + 3, data_edital: '',
    chapas: [{ nome: '', gm: '', gm_adjunto: '', votos: '' }, { nome: '', gm: '', gm_adjunto: '', votos: '' }],
    brancos: '', nulos: '', votantes: '', escrutinador1_id: '', escrutinador2_id: '', escrutinadores_assinam: true, presentes: [], aptidao_ajustes: {}, bloquear_inaptos: false };
};

export default function EleicaoGLEMTModal({ balaustre, podeEditar, onClose, onSaved, onMarcarRealizada, onVoltarPendente, userData, showSuccess, showError }) {
  const [aba, setAba] = useState('config');
  const [el, setElState] = useState(() => ({ ...VAZIA(), ...(balaustre.eleicao_glemt || {}) }));
  const [alterado, setAlterado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [irmaos, setIrmaos] = useState([]);
  const [apt, setApt] = useState({ carregando: true, linhas: [], periodo: '', dadosLoja: {}, assinantes: {} });
  const [filtro, setFiltro] = useState('todos');
  const [gerando, setGerando] = useState('');
  // Edital emitido (fonte única: tabela editais) — obrigatório para gerar o documento
  const [edital, setEdital] = useState(null);
  const [emitindo, setEmitindo] = useState(false);
  const [vinculando, setVinculando] = useState(false);
  const [escolhaModelo, setEscolhaModelo] = useState(null); // { modelos } quando há mais de um modelo de ata
  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!el.edital_id) { setEdital(null); return; }
      try { const e = await buscarEdital(el.edital_id); if (vivo) setEdital(e); } catch { if (vivo) setEdital(null); }
    })();
    return () => { vivo = false; };
  }, [el.edital_id]);

  // ── Trava do processo (encerrada a eleição, só os documentos continuam) ──
  const semAcento = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cargoUsuario = semAcento(userData?.cargo);
  const podeLiberar = String(userData?.nivel_acesso || '').toLowerCase() === 'admin'
    || cargoUsuario.includes('veneravel') || cargoUsuario.includes('secretario');
  const travada = !!el.encerrada;
  const [avisoTrava, setAvisoTrava] = useState(false);
  const editavel = podeEditar && !travada;

  const setEl = (campos) => {
    if (travada) { setAvisoTrava(true); return; }   // nada de alterar dados após o encerramento
    setElState(e => ({ ...e, ...campos })); setAlterado(true);
  };

  const encerrarEleicao = async () => {
    if (!podeLiberar) { setAvisoTrava(true); return; }
    if (!window.confirm('Encerrar a eleição da GLEMT?\nOs dados ficam bloqueados; os documentos continuam podendo ser gerados.')) return;
    const novo = { ...el, encerrada: true, encerrada_em: new Date().toISOString() };
    const { data, error } = await supabase.from('balaustres').update({ eleicao_glemt: novo }).eq('id', balaustre.id).select();
    if (error || !data?.length) { showError('Erro ao encerrar: ' + (error?.message || 'sem permissão')); return; }
    setElState(novo); setAlterado(false); showSuccess('🔒 Eleição da GLEMT encerrada.'); onSaved?.();
  };

  const liberarEleicao = async () => {
    if (!podeLiberar) { setAvisoTrava(true); return; }
    if (!window.confirm('Liberar a eleição da GLEMT para edição?')) return;
    const novo = { ...el, encerrada: false };
    const { data, error } = await supabase.from('balaustres').update({ eleicao_glemt: novo }).eq('id', balaustre.id).select();
    if (error || !data?.length) { showError('Erro ao liberar: ' + (error?.message || 'sem permissão')); return; }
    setElState(novo); setAvisoTrava(false); showSuccess('🔓 Liberado para edição.'); onSaved?.();
  };
  const setChapa = (i, campos) => setEl({ chapas: el.chapas.map((c, k) => (k === i ? { ...c, ...campos } : c)) });
  const pendente = el.status === 'pendente';
  const ref = balaustre.data_sessao;
  const balaustreAtual = { ...balaustre, eleicao_glemt: el };

  // ── Carrega irmãos + aptidão (período desde a última eleição GLEMT de outro mandato, ou 12 meses) ──
  useEffect(() => {
    (async () => {
      try {
        const { data: ir } = await supabase.from('irmaos').select('id, nome, cim, situacao, data_exaltacao, data_falecimento, data_nascimento, data_desligamento');
        setIrmaos(ir || []);
        const { data: ant } = await supabase.from('balaustres').select('id, data_sessao, eleicao_glemt')
          .lt('data_sessao', ref).not('eleicao_glemt', 'is', null).order('data_sessao', { ascending: false });
        const anterior = (ant || []).find(b => b.eleicao_glemt?.ativo && b.id !== balaustre.id && b.eleicao_glemt.status !== 'pendente'
          && String(b.eleicao_glemt.ano_inicio || '') !== String(el.ano_inicio || ''));
        const ini = anterior ? anterior.data_sessao : (() => { const d = new Date(ref + 'T00:00:00'); d.setFullYear(d.getFullYear() - 1); return d.toISOString().substring(0, 10); })();
        const linhas = await calcularAptidaoVoto({ ref, ini, irmaos: ir || [], ajustes: {} });
        const ano = String(ref).substring(0, 4);
        const [{ data: lojaData }, { data: corpo }] = await Promise.all([
          supabase.from('dados_loja').select('*').limit(1),
          supabase.from('corpo_administrativo').select('cargo, ano_exercicio, irmao_id'),
        ]);
        const norm = (c) => String(c || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        const nomeCargo = (...alvos) => {
          const r = (corpo || []).find(c => String(c.ano_exercicio || '').split(/[^0-9]+/).includes(ano) && alvos.includes(norm(c.cargo)));
          return r ? (ir || []).find(x => x.id === r.irmao_id)?.nome : null;
        };
        const hoje = new Date().toISOString().substring(0, 10);
        setApt({ carregando: false, linhas, dadosLoja: (lojaData && lojaData[0]) || {},
          periodo: `${anterior ? 'desde a última eleição GLEMT' : 'últimos 12 meses'}: ${fmt(ini)} a ${fmt(ref < hoje ? ref : hoje)}`,
          assinantes: { vm: nomeCargo('veneravel mestre', 'veneravel'), chanceler: nomeCargo('chanceler'), tesoureiro: nomeCargo('tesoureiro') } });
      } catch (e) {
        setApt(a => ({ ...a, carregando: false }));
        showError('Erro ao analisar a aptidão: ' + e.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aptidão com os ajustes manuais deste balaustre
  const linhas = apt.linhas.map(l => {
    const aj = (el.aptidao_ajustes || {})[String(l.irmao.id)];
    return { ...l, ajuste: aj, apto: aj ? aj.status === 'apto' : l.aptoAuto };
  });
  const aptos = linhas.filter(l => l.apto);
  const inaptos = linhas.filter(l => !l.apto);
  const pres = (el.presentes || []).map(String);

  const salvar = async (silencioso = false) => {
    setSalvando(true);
    try {
      const { data, error } = await supabase.from('balaustres').update({ eleicao_glemt: el }).eq('id', balaustre.id).select();
      if (error) throw error;
      if (!data?.length) throw new Error('o banco não permitiu a alteração (sem permissão).');
      // Mantém a data do edital em Editais igual à da Configuração
      if (el.edital_id && el.data_edital) await supabase.from('editais').update({ data_edital: el.data_edital }).eq('id', el.edital_id);
      setAlterado(false);
      if (!silencioso) showSuccess('✅ Eleição GLEMT salva.');
      onSaved?.();
    } catch (e) {
      showError('Erro ao salvar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  // Emite o edital (próximo nº do ano) já com a descrição e vincula a esta eleição
  const emitir = async () => {
    if (!editavel || emitindo) return;
    if (!ref) { showError('Sessão sem data: informe a data da sessão antes de emitir o edital.'); return; }
    setEmitindo(true);
    let reg = null;
    try {
      const dataEd = el.data_edital || menos15(ref);
      const per = el.ano_inicio && el.ano_fim ? `${el.ano_inicio}/${el.ano_fim}` : '';
      reg = await emitirEdital({
        tipo: 'eleicao_glemt', dataEdital: dataEd, origemId: balaustre.id,
        descricao: `Edital de Convocação – Eleição da GLEMT${per ? `, período ${per}` : ''} – sessão de ${fmt(ref)}`,
      });
      const novo = { ...el, edital_id: reg.id, data_edital: dataEd };
      const { data, error } = await supabase.from('balaustres').update({ eleicao_glemt: novo }).eq('id', balaustre.id).select();
      if (error) throw error;
      if (!data?.length) throw new Error('o banco não permitiu a alteração (sem permissão).');
      setElState(novo); setEdital(reg); setAlterado(false);
      showSuccess(`📢 Edital nº ${formatarNumeroEdital(reg.numero, reg.ano)} emitido.`);
      onSaved?.();
    } catch (e) {
      if (reg) await supabase.from('editais').delete().eq('id', reg.id); // não deixa número órfão
      showError('Erro ao emitir o edital: ' + e.message);
    } finally {
      setEmitindo(false);
    }
  };

  // Vincula um edital já cadastrado (em vez de emitir outro)
  const vincular = async (ed) => {
    if (!editavel || emitindo) return;
    setEmitindo(true);
    try {
      const { data: e1, error: er1 } = await supabase.from('editais')
        .update({ origem_id: String(balaustre.id), tipo: 'eleicao_glemt' }).eq('id', ed.id).is('origem_id', null).select();
      if (er1) throw er1;
      if (!e1?.length) throw new Error('este edital já foi vinculado a outra situação (ou sem permissão).');
      const novo = { ...el, edital_id: ed.id, data_edital: ed.data_edital || el.data_edital };
      const { data, error } = await supabase.from('balaustres').update({ eleicao_glemt: novo }).eq('id', balaustre.id).select();
      if (error || !data?.length) {
        await supabase.from('editais').update({ origem_id: null }).eq('id', ed.id);
        throw error || new Error('o banco não permitiu a alteração (sem permissão).');
      }
      setElState(novo); setEdital(e1[0]); setAlterado(false); setVinculando(false);
      showSuccess(`🔗 Edital nº ${formatarNumeroEdital(ed.numero, ed.ano)} vinculado.`);
      onSaved?.();
    } catch (e) {
      showError('Erro ao vincular o edital: ' + e.message);
    } finally {
      setEmitindo(false);
    }
  };
  // Desfaz o vínculo (o edital continua cadastrado e fica livre para outro uso)
  const desvincular = async () => {
    if (!editavel || !edital || emitindo) return;
    if (!window.confirm(`Desvincular o edital nº ${formatarNumeroEdital(edital.numero, edital.ano)} desta eleição?\nEle continua em Editais e o documento fica bloqueado até vincular/emitir outro.`)) return;
    setEmitindo(true);
    try {
      const novo = { ...el, edital_id: null };
      const { data, error } = await supabase.from('balaustres').update({ eleicao_glemt: novo }).eq('id', balaustre.id).select();
      if (error) throw error;
      if (!data?.length) throw new Error('o banco não permitiu a alteração (sem permissão).');
      await supabase.from('editais').update({ origem_id: null }).eq('id', edital.id);
      setElState(novo); setEdital(null); setAlterado(false);
      onSaved?.();
    } catch (e) {
      showError('Erro ao desvincular: ' + e.message);
    } finally {
      setEmitindo(false);
    }
  };

  const gerarAtaComModelo = async (modeloId) => {
    setEscolhaModelo(null);
    setGerando('ata');
    try {
      if (alterado) await salvar(true);
      const r = await gerarAtaSessao({ balaustre: balaustreAtual, modeloId });
      if (r?.faltando?.length) showError(`Ata gerada, mas falta no Corpo Administrativo: ${r.faltando.join(', ')}.`);
      else showSuccess('✅ Ata gerada!');
    } catch (e) {
      showError('Erro ao gerar a ata: ' + e.message);
    } finally {
      setGerando('');
    }
  };

  const ajustar = (l) => {
    const atuais = { ...(el.aptidao_ajustes || {}) };
    if (l.ajuste) delete atuais[String(l.irmao.id)];
    else {
      const just = window.prompt(`Tornar ${l.nomeCurto} APTO a votar.\nInforme a justificativa:`);
      if (!just || !just.trim()) return;
      atuais[String(l.irmao.id)] = { status: 'apto', justificativa: just.trim(), em: new Date().toISOString() };
    }
    setEl({ aptidao_ajustes: atuais });
  };
  const togglePresente = (l) => {
    const id = String(l.irmao.id);
    if (!pres.includes(id) && el.bloquear_inaptos && !l.apto) { showError(`${l.nomeCurto} está inapto (presença bloqueada).`); return; }
    setEl({ presentes: pres.includes(id) ? pres.filter(x => x !== id) : [...pres, id] });
  };

  // ── PDFs (gerados na hora do clique) ──
  const periodoTxt = el.ano_inicio && el.ano_fim ? `${el.ano_inicio}/${el.ano_fim}` : '';
  const pdf = (tipo) => {
    const lista = tipo === 'inaptos' ? inaptos : aptos;
    if (tipo !== 'ambos' && !lista.length) { showError(tipo === 'inaptos' ? 'Nenhum irmão inapto.' : 'Nenhum irmão apto.'); return; }
    gerarAptosVotarPDF({
      tipo, linhas: lista, linhasInaptos: inaptos, eleicao: {}, dadosLoja: apt.dadosLoja, logoB64: LOGO_LOJA_B64, periodo: apt.periodo, assinantes: apt.assinantes,
      glemt: { periodo: periodoTxt, dataSessao: ref },
      nomeArquivo: `${tipo === 'ambos' ? 'Aptos_e_Inaptos' : tipo === 'inaptos' ? 'Inaptos' : 'Aptos'}_a_Votar_GLEMT_${periodoTxt.replace('/', '-')}.pdf`,
    });
  };
  // ── Word (edital, lista, ata) — usa os dados da tela (salva em seguida, se houver alteração) ──
  const word = async (qual) => {
    setGerando(qual);
    try {
      if ((qual === 'edital' || qual === 'edital_aptos') && !edital) { showError('Emita o edital (número) na aba Configuração antes de gerar o documento.'); return; }
      if (qual === 'edital') {
        const r = await gerarEditalEleicaoGLEMT({ balaustre: balaustreAtual });
        if (r?.faltando?.length) showError(`Falta no Corpo Administrativo: ${r.faltando.join(', ')}.`);
      }
      // PDF único: edital + relação de aptos (padrão dos dois documentos)
      if (qual === 'edital_aptos') {
        if (!aptos.length) { showError('Nenhum Irmão apto a votar.'); return; }
        await gerarEditalAptosPDF({
          balaustre: balaustreAtual, aptos, dadosLojaPDF: apt.dadosLoja, logoB64: LOGO_LOJA_B64,
          periodo: apt.periodo, assinantes: apt.assinantes, glemt: { periodo: periodoTxt, dataSessao: ref },
        });
      }
      if (qual === 'lista') await gerarListaPresencaEleicaoGLEMT({ balaustre: balaustreAtual });
      if (qual === 'ata') {
        if (pendente) { showError('Sessão pendente: marque como realizada para numerar o balaustre e gerar a ata.'); return; }
        // Mais de um modelo de ata da eleição (inclusive cópias): pergunta qual usar
        const modelos = await listarModelosAta(balaustre.grau_sessao, { eleicao: true });
        if (modelos.length > 1) { setEscolhaModelo({ modelos }); setGerando(''); return; }
        const r = await gerarAtaSessao({ balaustre: balaustreAtual, modeloId: modelos[0]?.id || null });
        if (r?.faltando?.length) showError(`Falta no Corpo Administrativo: ${r.faltando.join(', ')}.`);
      }
      if (alterado && editavel) salvar(true);
    } catch (e) {
      showError('Erro ao gerar: ' + e.message);
    } finally {
      setGerando('');
    }
  };

  // ── estilos ──
  const inp = { width: '100%', padding: '0.5rem 0.65rem', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', fontSize: '0.85rem', boxSizing: 'border-box' };
  const lab = { fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' };
  const INP_T = { padding: '0.35rem 0.6rem', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', fontSize: '0.78rem', outline: 'none', minWidth: 0 };
  const card = { border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '0.85rem', background: 'var(--color-surface)' };
  const btn = (cor, fundo) => ({ padding: '0.45rem 0.9rem', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', border: `1px solid ${cor}`, background: fundo || 'transparent', color: cor });
  const g2 = { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '0.6rem' };
  const mestres = irmaos.filter(i => String(i.situacao || 'regular').toLowerCase() === 'regular' && i.data_exaltacao && !i.data_falecimento).sort((a, b) => a.nome.localeCompare(b.nome));

  const ABAS = [['config', '⚙️ Configuração'], ['aptos', '🗳️ Aptos e Presença'], ['apuracao', '📊 Apuração'], ['docs', '📄 Documentos']];
  const num = (v) => Number(v) || 0;
  const totalVotos = (el.chapas || []).reduce((t, c) => t + num(c.votos), 0) + num(el.brancos) + num(el.nulos);
  // ── Apuração separada por loja (urnas) ──────────────────────────────────
  // Lojas dos votantes em trânsito, na ordem de cadastro
  const lojasTransito = !el.voto_transito ? [] : (el.votantes_transito || [])
    .filter(v => v && (v.nome || '').trim())
    .reduce((acc, v) => {
      const chave = `${(v.oriente || '').trim()}||${(v.loja || '').trim()}`;
      let g = acc.find(x => x.chave === chave);
      if (!g) { g = { chave, oriente: (v.oriente || '').trim(), loja: (v.loja || '').trim(), qtd: 0 }; acc.push(g); }
      g.qtd += 1;
      return acc;
    }, []);
  const separada = !!el.apuracao_separada && lojasTransito.length > 0;
  const qtdTransito = lojasTransito.reduce((t, g) => t + g.qtd, 0);  // votantes em trânsito (todas as lojas)
  // Urna de cada loja em trânsito (votos por chapa, brancos, nulos e votantes)
  const urna = (chave) => (el.urnas_transito || {})[chave] || {};
  const setUrna = (chave, campos) => setEl({ urnas_transito: { ...(el.urnas_transito || {}), [chave]: { ...urna(chave), ...campos } } });
  const votosUrna = (u) => (el.chapas || []).reduce((t, c, i) => t + num(u[`chapa${i + 1}`]), 0) + num(u.brancos) + num(u.nulos);
  // Totais: a soma da nossa Loja com todas as urnas em trânsito
  const totalChapa = (i) => num((el.chapas || [])[i]?.votos) + (separada ? lojasTransito.reduce((t, g) => t + num(urna(g.chave)[`chapa${i + 1}`]), 0) : 0);
  const totalBrancos = num(el.brancos) + (separada ? lojasTransito.reduce((t, g) => t + num(urna(g.chave).brancos), 0) : 0);
  const totalNulos = num(el.nulos) + (separada ? lojasTransito.reduce((t, g) => t + num(urna(g.chave).nulos), 0) : 0);
  const totalGeral = (el.chapas || []).reduce((t, c, i) => t + totalChapa(i), 0) + totalBrancos + totalNulos;
  const vencedora = [...(el.chapas || [])].map((c, i) => ({ ...c, i, votos: totalChapa(i) })).filter(c => c.nome || c.gm).sort((a, b) => num(b.votos) - num(a.votos))[0];

  // Cartão compacto (2 linhas):
  //  1) ☐ presença · Nome (dois nomes) · ★ · Lic
  //  2) Tesouraria: OK/Pendência | Presença: %   — o selo Apto/Inapto vai na cor da borda (clique no cartão inapto/ajustado para ajustar)
  const cardIrmao = (l) => {
    const presente = pres.includes(String(l.irmao.id));
    const podeAjustar = editavel && (l.ajuste || !l.aptoAuto);
    const corBorda = presente ? 'rgba(16,185,129,0.7)' : l.apto ? 'var(--color-border)' : 'rgba(239,68,68,0.45)';
    return (
      <div key={l.irmao.id} style={{ border: `1px solid ${corBorda}`, borderRadius: 'var(--radius-md)', padding: '0.3rem 0.5rem',
        background: presente ? 'rgba(16,185,129,0.08)' : 'var(--color-surface-2)', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 0 }}>
          <input type="checkbox" checked={presente} disabled={!editavel} onChange={() => togglePresente(l)} title="Presente na sessão" style={{ flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }} title={l.nome}>{l.nomeCurto}</span>
          {l.isento70 && <span title="Prerrogativa por idade: presença dispensada" style={{ color: '#facc15', fontSize: '0.8rem', flexShrink: 0 }}>★</span>}
          {l.licenca && <span title="Licenciado na data da eleição" style={{ fontSize: '0.58rem', color: '#d97706', fontWeight: 800, flexShrink: 0 }}>Lic</span>}
          {l.ajuste && <span title={`Tornado apto: ${l.ajuste.justificativa}`} style={{ fontSize: '0.7rem', flexShrink: 0 }}>✏️</span>}
        </div>
        <div onClick={() => podeAjustar && ajustar(l)}
          title={l.ajuste ? `Ajustado: ${l.ajuste.justificativa} (clique para desfazer)` : l.apto ? `CIM ${l.cim || '—'}` : `${l.motivos} — clique para tornar apto`}
          style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: '0.1rem', paddingLeft: '1.3rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: podeAjustar ? 'pointer' : 'default' }}>
          <span style={{ color: l.finOk ? '#10b981' : '#ef4444', fontWeight: 700 }}>Tesouraria: {l.finOk ? 'OK' : 'Pendência'}</span>
          {' | '}
          <span style={{ color: l.presOk ? '#10b981' : '#ef4444', fontWeight: 700 }}>Presença: {l.isento70 ? 'Disp.' : `${l.pct}%`}</span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '1100px', maxHeight: '94vh', display: 'flex', flexDirection: 'column' }}>
        {/* Cabeçalho */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, flex: 1, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' }}>
            🗳️ Eleição GLEMT — {pendente ? '⏳ Pendente' : `Balaústre nº ${balaustre.numero_balaustre}/${balaustre.ano_balaustre}`}
            {travada && (
              <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', fontWeight: 800, color: '#c9a84c', border: '1px solid rgba(201,168,76,0.5)', borderRadius: '999px', padding: '0.1rem 0.5rem' }}>
                🔒 Encerrada{el.encerrada_em ? ` em ${String(el.encerrada_em).substring(0, 10).split('-').reverse().join('/')}` : ''}
              </span>
            )}
            {podeLiberar && (
              <button type="button" onClick={travada ? liberarEleicao : encerrarEleicao}
                style={{ marginLeft: '0.5rem', fontSize: '0.72rem', fontWeight: 700, background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '999px', padding: '0.1rem 0.6rem', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                {travada ? '🔓 Liberar' : '🔒 Encerrar eleição'}
              </button>
            )}
            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}> · sessão de {fmt(ref)}{periodoTxt ? ` · Período ${periodoTxt}` : ''}</span>
          </h3>
          {editavel && (
            <button onClick={() => salvar()} disabled={salvando || !alterado} style={{ ...btn('#fff', ROXO), opacity: alterado ? 1 : 0.5 }}>
              {salvando ? 'Salvando…' : '💾 Salvar'}
            </button>
          )}
          <button onClick={() => { if (!alterado || window.confirm('Há alterações não salvas. Fechar mesmo assim?')) onClose(); }} style={btn('var(--color-text-muted)')}>✕ Fechar</button>
        </div>
        {/* Abas */}
        <div style={{ display: 'flex', gap: '0.25rem', padding: '0.6rem 1.25rem 0', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
          {ABAS.map(([k, l]) => (
            <button key={k} onClick={() => setAba(k)}
              style={{ padding: '0.5rem 0.9rem', border: 'none', borderBottom: `3px solid ${aba === k ? ROXO : 'transparent'}`, background: 'transparent', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.85rem', color: aba === k ? ROXO : 'var(--color-text-muted)' }}>{l}</button>
          ))}
        </div>

        <div style={{ padding: '1rem 1.25rem', overflowY: 'auto', flex: 1 }}>
          {/* ── 1. Configuração ── */}
          {aba === 'config' && (
            <fieldset disabled={!editavel} style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={card}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '0.6rem', alignItems: 'end' }}>
                  <div><label style={lab}>Período — de</label>
                    <input type="number" style={inp} value={el.ano_inicio || ''} onChange={e => { const v = parseInt(e.target.value) || ''; setEl({ ano_inicio: v, ano_fim: v ? v + 3 : el.ano_fim }); }} /></div>
                  <div><label style={lab}>até</label>
                    <input type="number" style={inp} value={el.ano_fim || ''} onChange={e => setEl({ ano_fim: parseInt(e.target.value) || '' })} /></div>
                  <div><label style={lab}>Data do edital</label>
                    <input type="date" style={inp} value={el.data_edital || ''} onChange={e => setEl({ data_edital: e.target.value })} /></div>
                  <div>
                    <label style={lab}>Status</label>
                    {pendente ? (
                      <button type="button" onClick={async () => { if (alterado) await salvar(true); onMarcarRealizada?.(balaustreAtual); }}
                        style={{ ...btn('#10b981', 'rgba(16,185,129,0.12)'), width: '100%' }}>✅ Marcar como realizada</button>
                    ) : <div style={{ ...inp, color: '#10b981', fontWeight: 700 }}>✅ Realizada</div>}
                  </div>
                </div>
                {!pendente && editavel && (
                  <button type="button" onClick={async () => { if (alterado) await salvar(true); onVoltarPendente?.(balaustreAtual); }}
                    style={{ ...btn('#f59e0b', 'rgba(245,158,11,0.12)'), width: '100%', marginTop: '0.5rem' }}>
                    ↩️ Voltar para pendente (libera o nº do balaustre)
                  </button>
                )}
                {(() => {
                  const de = el.data_edital || menos15(ref);
                  if (!de || !ref) return null;
                  const dias = Math.round((new Date(ref + 'T00:00:00') - new Date(de + 'T00:00:00')) / 86400000);
                  return <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: dias < 15 ? '#ef4444' : 'var(--color-text-muted)', fontWeight: dias < 15 ? 700 : 400 }}>
                    {el.data_edital ? '' : `Sem data informada: o edital usa ${fmt(de)} (15 dias antes). `}
                    {dias < 15 ? `⚠️ O edital está a ${dias} dia(s) da sessão — o mínimo é 15.` : `Edital ${dias} dias antes da sessão.`}
                  </p>;
                })()}
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.6rem', padding: '0.5rem 0.8rem', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)' }}>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--color-text)' }}>📢 Edital nº</strong>
                  {edital ? (<>
                    <span style={{ fontWeight: 800, color: '#10b981' }}>{formatarNumeroEdital(edital.numero, edital.ano)}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{edital.descricao} (consulte/edite em Expedientes → Editais)</span>
                    {editavel && <button type="button" disabled={emitindo} onClick={desvincular} style={btn('#94a3b8')}>↩️ Desvincular</button>}
                  </>) : (<>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f59e0b' }}>⛔ Não emitido — o documento fica bloqueado</span>
                    {editavel && (
                      <button type="button" disabled={emitindo} onClick={emitir} style={btn('#10b981', 'rgba(16,185,129,0.12)')}>
                        {emitindo ? '⏳ Emitindo…' : '📢 Emitir edital (próximo nº automático)'}
                      </button>
                    )}
                    {editavel && (
                      <button type="button" disabled={emitindo} onClick={() => setVinculando(v => !v)} style={btn('#8b5cf6', 'rgba(139,92,246,0.12)')}>🔗 Vincular edital existente</button>
                    )}
                    {editavel && vinculando && <VincularEdital tipo="eleicao_glemt" ocupado={emitindo} onEscolher={vincular} onFechar={() => setVinculando(false)} />}
                  </>)}
                </div>
              </div>

              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '0.85rem', color: ROXO }}>Escrutinadores</strong>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--color-text)', cursor: editavel ? 'pointer' : 'default' }}>
                    <input type="checkbox" disabled={!editavel}
                      checked={el.escrutinadores_assinam ?? true}
                      onChange={e => setEl({ escrutinadores_assinam: e.target.checked })} />
                    Assinam a ata
                  </label>
                </div>
                <div style={{ ...g2, marginTop: '0.5rem' }}>
                  {['escrutinador1_id', 'escrutinador2_id'].map((k, i) => (
                    <div key={k}><label style={lab}>Escrutinador {i + 1}</label>
                      <select style={inp} value={el[k] || ''} onChange={e => setEl({ [k]: e.target.value })}>
                        <option value="">Selecione...</option>
                        {mestres.filter(m => String(m.id) !== String(i ? el.escrutinador1_id : el.escrutinador2_id)).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                      </select></div>
                  ))}
                </div>
              </div>

              <div style={card}>
                <strong style={{ fontSize: '0.85rem', color: ROXO }}>Chapas e candidatos</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.6rem', marginTop: '0.5rem' }}>
                  {(el.chapas || []).map((c, i) => (
                    <div key={i} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.6rem', background: 'var(--color-surface-2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <strong style={{ fontSize: '0.8rem', color: ROXO }}>Chapa {i + 1}</strong>
                        {i >= 2 && <button type="button" onClick={() => setEl({ chapas: el.chapas.filter((_, k) => k !== i) })}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>✕ Remover</button>}
                      </div>
                      <label style={lab}>Nome da chapa</label>
                      <input style={inp} value={c.nome || ''} onChange={e => setChapa(i, { nome: e.target.value })} />
                      <div style={{ marginTop: '0.4rem' }}>
                        <label style={lab}>Grão-Mestre</label>
                        <input style={inp} value={c.gm || ''} onChange={e => setChapa(i, { gm: e.target.value })} />
                      </div>
                      <div style={{ marginTop: '0.4rem' }}>
                        <label style={lab}>Grão-Mestre Adjunto</label>
                        <input style={inp} value={c.gm_adjunto || ''} onChange={e => setChapa(i, { gm_adjunto: e.target.value })} />
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setEl({ chapas: [...(el.chapas || []), { nome: '', gm: '', gm_adjunto: '', votos: '' }] })}
                  style={{ ...btn(ROXO), marginTop: '0.6rem', borderStyle: 'dashed' }}>➕ Adicionar chapa</button>
              </div>
            </div>
            </fieldset>
          )}

          {/* ── 2. Aptos e Presença ── */}
          {aba === 'aptos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '0.6rem' }}>
                {[['✅ Aptos', aptos.length, '#10b981'], ['⛔ Inaptos', inaptos.length, '#ef4444'], ['🖊️ Presentes', pres.length, ROXO]].map(([t, v, c]) => (
                  <div key={t} style={{ ...card, borderTop: `3px solid ${c}`, padding: '0.6rem 0.85rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{t}</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: c }}>{apt.carregando ? '…' : v}</div>
                  </div>
                ))}
              </div>
              <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                {[['todos', 'Todos'], ['aptos', 'Aptos'], ['inaptos', 'Inaptos'], ['presentes', 'Presentes']].map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setFiltro(k)}
                    style={{ ...btn(filtro === k ? ROXO : 'var(--color-text-muted)', filtro === k ? 'rgba(139,92,246,0.12)' : 'transparent'), padding: '0.3rem 0.75rem', borderRadius: '999px' }}>{l}</button>
                ))}
                <span style={{ flex: 1 }} />
                <button type="button" disabled={!editavel} onClick={() => setEl({ presentes: (el.bloquear_inaptos ? aptos : linhas).map(l => String(l.irmao.id)) })} style={btn('var(--color-text-muted)')}>Marcar todos</button>
                <button type="button" disabled={!editavel} onClick={() => setEl({ presentes: [] })} style={btn('var(--color-text-muted)')}>Limpar presença</button>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--color-text)' }}>
                  <input type="checkbox" disabled={!editavel} checked={!!el.bloquear_inaptos} onChange={e => setEl({ bloquear_inaptos: e.target.checked })} />
                  Bloquear presença dos inaptos
                </label>
              </div>
              <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.8rem', color: 'var(--color-text)', marginRight: '0.25rem' }}>Relatórios:</strong>
                <button type="button" disabled={apt.carregando} onClick={() => pdf('aptos')} style={btn('#10b981', 'rgba(16,185,129,0.1)')}>📄 PDF Aptos</button>
                <button type="button" disabled={apt.carregando} onClick={() => pdf('inaptos')} style={btn('#ef4444', 'rgba(239,68,68,0.1)')}>📄 PDF Inaptos</button>
                <button type="button" disabled={apt.carregando} onClick={() => pdf('ambos')} style={btn(ROXO, 'rgba(139,92,246,0.1)')}>📄 PDF Aptos e Inaptos</button>
                <button type="button" disabled={!!gerando} onClick={() => word('lista')} style={btn('var(--color-text)')}>{gerando === 'lista' ? '⏳' : '📋'} Lista de Presença (Word)</button>
              </div>
              {/* Voto em trânsito: Irmãos de outras Lojas (raro) — contados à parte dos votantes da Loja */}
              <div style={{ ...card, borderLeft: '4px solid #f59e0b' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  <input type="checkbox" disabled={!editavel} checked={!!el.voto_transito}
                    onChange={e => setEl({ voto_transito: e.target.checked })} />
                  🧳 Haverá votantes em trânsito (Irmãos de outras Lojas)
                </label>
                {el.voto_transito && (<>
                  <p style={{ margin: '0.4rem 0 0.5rem', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    Entram no parágrafo próprio da ata e numa seção ao final da lista de presença. Não somam aos votantes da Loja.
                  </p>
                  {(el.votantes_transito || []).map((v, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.8fr 1.4fr 1fr auto', gap: '0.4rem', marginBottom: '0.35rem' }}>
                      {[['nome', 'Nome do Irmão'], ['cim', 'CIM'], ['loja', 'Loja de origem (nome e nº)'], ['oriente', 'Oriente']].map(([k, ph]) => (
                        <input key={k} type="text" placeholder={ph} disabled={!editavel} value={v[k] || ''}
                          onChange={e => setEl({ votantes_transito: (el.votantes_transito || []).map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) })}
                          style={INP_T} />
                      ))}
                      <button type="button" disabled={!editavel} title="Remover"
                        onClick={() => setEl({ votantes_transito: (el.votantes_transito || []).filter((x, j) => j !== i) })}
                        style={btn('#ef4444', 'rgba(239,68,68,0.1)')}>✕</button>
                    </div>
                  ))}
                  <button type="button" disabled={!editavel}
                    onClick={() => setEl({ votantes_transito: [...(el.votantes_transito || []), { nome: '', cim: '', loja: '', oriente: '' }] })}
                    style={btn('#f59e0b', 'rgba(245,158,11,0.12)')}>➕ Adicionar Irmão em trânsito</button>
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b' }}>
                    Votantes em trânsito: {(el.votantes_transito || []).filter(v => (v.nome || '').trim()).length}
                  </p>
                </>)}
              </div>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                Regras: tesouraria com no máximo 2 meses em aberto e presença mínima de 50% — período {apt.periodo || '…'}.
                <span style={{ color: '#facc15' }}> ★</span> prerrogativa por idade · Lic = licenciado · clique no selo Inapto para tornar apto (com justificativa).
              </p>
              {apt.carregando ? <p style={{ color: 'var(--color-text-muted)' }}>Analisando tesouraria e presença…</p> : (() => {
                const vis = filtro === 'aptos' ? aptos : filtro === 'inaptos' ? inaptos : filtro === 'presentes' ? linhas.filter(l => pres.includes(String(l.irmao.id))) : null;
                const grade = (lista) => <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '0.35rem' }}>{lista.map(cardIrmao)}</div>;
                if (vis) return grade(vis);
                return (
                  <>
                    <div style={{ ...card, borderLeft: '4px solid #10b981' }}>
                      <strong style={{ fontSize: '0.85rem', color: '#10b981' }}>✅ Irmãos Aptos ({aptos.length})</strong>
                      <div style={{ marginTop: '0.5rem' }}>{grade(aptos)}</div>
                    </div>
                    <div style={{ ...card, borderLeft: '4px solid #ef4444' }}>
                      <strong style={{ fontSize: '0.85rem', color: '#ef4444' }}>⛔ Irmãos Inaptos ({inaptos.length})</strong>
                      <div style={{ marginTop: '0.5rem' }}>{grade(inaptos)}</div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* ── 3. Apuração ── */}
          {aba === 'apuracao' && (
            <fieldset disabled={!editavel} style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={card}>
                <strong style={{ fontSize: '0.85rem', color: ROXO }}>Votos por chapa</strong>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max((el.chapas || []).length, 1)}, minmax(0, 1fr))`, gap: '0.6rem', marginTop: '0.5rem' }}>
                  {(el.chapas || []).map((c, i) => (
                    <div key={i}><label style={lab}>Chapa {i + 1}{c.nome ? ` – ${c.nome}` : ''}</label>
                      <input type="number" min="0" style={inp} value={c.votos ?? ''} onChange={e => setChapa(i, { votos: e.target.value })} /></div>
                  ))}
                </div>
              </div>
              <div style={card}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '0.6rem' }}>
                  <div><label style={lab}>Votos em branco</label><input type="number" min="0" style={inp} value={el.brancos ?? ''} onChange={e => setEl({ brancos: e.target.value })} /></div>
                  <div><label style={lab}>Votos nulos</label><input type="number" min="0" style={inp} value={el.nulos ?? ''} onChange={e => setEl({ nulos: e.target.value })} /></div>
                  <div><label style={lab}>Total de votantes (automático)</label>
                    <input type="text" readOnly style={{ ...inp, opacity: 0.85, cursor: 'default' }} value={totalVotos} /></div>
                </div>
                <p style={{ margin: '0.6rem 0 0', fontSize: '0.8rem', color: 'var(--color-text)' }}>
                  Mestres: <strong>{linhas.length}</strong> · Aptos ao Voto: <strong>{aptos.length}</strong> · Presentes: <strong>{pres.length}</strong>
                </p>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--color-text)' }}>
                  Soma dos votos: <strong>{totalVotos}</strong>
                  {vencedora && num(vencedora.votos) > 0 && <> · Mais votada: <strong style={{ color: '#10b981' }}>Chapa {vencedora.i + 1} – {vencedora.nome}</strong></>}
                </p>
                {totalVotos > 0 && pres.length > 0 && totalVotos !== pres.length + (separada ? 0 : qtdTransito) && (
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700 }}>
                    ⚠️ A soma dos votos ({totalVotos}) difere dos votantes desta urna ({pres.length}{!separada && qtdTransito > 0 ? ` + ${qtdTransito} em trânsito` : ''}) — confira as cédulas.
                  </p>
                )}
              </div>

              {/* Voto em trânsito: urna junto (padrão) ou urna separada por loja */}
              {lojasTransito.length > 0 && (
                <div style={{ ...card, borderLeft: '4px solid #f59e0b' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    <input type="checkbox" checked={!!el.apuracao_separada} onChange={e => setEl({ apuracao_separada: e.target.checked })} />
                    🗳️ Apuração separada por loja ({lojasTransito.length} loja(s) em trânsito)
                  </label>
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    Desmarcado: os votantes em trânsito votam na mesma urna da Loja e entram nos campos acima.
                    Marcado: cada loja tem a sua urna, apurada à parte, e a ata traz o resultado de cada uma e o consolidado.
                  </p>
                </div>
              )}

              {separada && lojasTransito.map(g => {
                const u = urna(g.chave);
                return (
                  <div key={g.chave} style={{ ...card, borderLeft: `4px solid ${ROXO}` }}>
                    <strong style={{ fontSize: '0.85rem', color: ROXO }}>🗳️ Urna — {g.loja || '[oficina]'}</strong>
                    <p style={{ margin: '0.1rem 0 0.5rem', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                      Oriente de {g.oriente || '[oriente]'} · {g.qtd} votante(s) em trânsito
                    </p>
                    {/* Chapas na primeira linha (o nome já aparece no quadro de cima) */}
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max((el.chapas || []).length, 1)}, minmax(0, 1fr))`, gap: '0.6rem' }}>
                      {(el.chapas || []).map((c, i) => (
                        <div key={i}>
                          <label style={lab}>Chapa {i + 1}</label>
                          <input type="number" min="0" style={inp} value={u[`chapa${i + 1}`] ?? ''}
                            onChange={e => setUrna(g.chave, { [`chapa${i + 1}`]: e.target.value })} />
                        </div>
                      ))}
                    </div>
                    {/* Resultado na segunda linha */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.6rem', marginTop: '0.6rem' }}>
                      <div><label style={lab}>Votos em branco</label>
                        <input type="number" min="0" style={inp} value={u.brancos ?? ''} onChange={e => setUrna(g.chave, { brancos: e.target.value })} /></div>
                      <div><label style={lab}>Votos nulos</label>
                        <input type="number" min="0" style={inp} value={u.nulos ?? ''} onChange={e => setUrna(g.chave, { nulos: e.target.value })} /></div>
                      <div><label style={lab}>Total de votantes</label>
                        <input type="text" readOnly style={{ ...inp, opacity: 0.85, cursor: 'default' }} value={votosUrna(u)} /></div>
                    </div>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: 'var(--color-text)' }}>
                      Soma desta urna: <strong>{votosUrna(u)}</strong> · Votantes em trânsito desta loja: <strong>{g.qtd}</strong>
                    </p>
                    {votosUrna(u) > 0 && votosUrna(u) !== g.qtd && (
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700 }}>⚠️ A soma desta urna difere do total de votantes.</p>
                    )}
                  </div>
                );
              })}

              {separada && (
                <div style={{ ...card, borderLeft: '4px solid #10b981' }}>
                  <strong style={{ fontSize: '0.85rem', color: '#10b981' }}>Σ Resultado consolidado (Loja + trânsito)</strong>
                  {/* Resultado na primeira linha */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <div><div style={lab}>Votos Brancos</div><div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)' }}>{totalBrancos}</div></div>
                    <div><div style={lab}>Votos Nulos</div><div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)' }}>{totalNulos}</div></div>
                    <div><div style={lab}>Total de Votos</div><div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981' }}>{totalGeral}</div></div>
                  </div>
                  {/* Chapas na linha de baixo, dividindo todo o espaço */}
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max((el.chapas || []).length, 1)}, minmax(0, 1fr))`, gap: '0.5rem', marginTop: '0.6rem' }}>
                    {(el.chapas || []).map((c, i) => (
                      <div key={i}>
                        <div style={lab}>Chapa {i + 1}{c.nome ? ` – ${c.nome}` : ''}</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)' }}>{totalChapa(i)}</div>
                      </div>
                    ))}
                  </div>
                  {vencedora && num(vencedora.votos) > 0 && (
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--color-text)' }}>
                      Mais votada no consolidado: <strong style={{ color: '#10b981' }}>Chapa {vencedora.i + 1} – {vencedora.nome}</strong>
                    </p>
                  )}
                </div>
              )}
            </div>
            </fieldset>
          )}

          {/* ── 4. Documentos ── */}
          {aba === 'docs' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
              {[
                ['edital', '📢 Edital de Convocação', edital ? `Edital nº ${formatarNumeroEdital(edital.numero, edital.ano)} — Word, aos Mestres, com as chapas` : 'Bloqueado: emita o edital na aba Configuração', !edital],
                ['edital_aptos', '📎 Edital + Aptos a Votar (PDF)', edital ? 'PDF único: edital e, nas páginas seguintes, a relação de aptos' : 'Bloqueado: emita o edital na aba Configuração', !edital],
                ['lista', '📋 Lista de Presença', 'Word — presentes marcados (ou todos os aptos)', false],
                ['ata', '📜 Ata da Eleição', pendente ? 'Bloqueada: sessão pendente' : 'Word — modelo "Ata Eleição GLEMT"', pendente],
              ].map(([k, t, d, bloq]) => (
                <button key={k} type="button" disabled={!!gerando || bloq} onClick={() => word(k)}
                  style={{ ...card, textAlign: 'left', cursor: bloq ? 'not-allowed' : 'pointer', opacity: bloq ? 0.5 : 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-text)' }}>{gerando === k ? '⏳ Gerando…' : t}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>{d}</div>
                </button>
              ))}
              {[['aptos', '✅ PDF Aptos', 'Relação dos aptos a votar'], ['inaptos', '⛔ PDF Inaptos', 'Relação dos inaptos'], ['ambos', '🗳️ PDF Aptos e Inaptos', 'Os dois quadros no mesmo arquivo']].map(([k, t, d]) => (
                <button key={k} type="button" disabled={apt.carregando} onClick={() => pdf(k)} style={{ ...card, textAlign: 'left', cursor: 'pointer' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-text)' }}>{t}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>{d}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Qual modelo de ata usar (quando há mais de um) */}
      {escolhaModelo && (
        <div onClick={() => setEscolhaModelo(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '460px', padding: '1.1rem' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>Qual modelo de ata usar?</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {escolhaModelo.modelos.map(m => (
                <button key={m.id} type="button" onClick={() => gerarAtaComModelo(m.id)}
                  style={{ textAlign: 'left', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                  📜 {m.nome}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setEscolhaModelo(null)}
              style={{ width: '100%', marginTop: '0.8rem', height: '36px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', fontWeight: 700, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Aviso: eleição da GLEMT encerrada */}
      {avisoTrava && (
        <div onClick={() => setAvisoTrava(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '440px', padding: '1.2rem' }}>
            <h3 style={{ margin: '0 0 0.6rem', fontSize: '1rem', fontWeight: 800, color: '#f59e0b' }}>🔒 Processo encerrado</h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: 'var(--color-text)' }}>
              A eleição da GLEMT já foi encerrada. Alterações dependem de autorização do Venerável Mestre.
              Os documentos continuam podendo ser gerados.
            </p>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button type="button" onClick={() => setAvisoTrava(false)} style={{ ...btn('#94a3b8'), flex: 1 }}>Entendi</button>
              {podeLiberar && (
                <button type="button" onClick={liberarEleicao} style={{ ...btn('#10b981', 'rgba(16,185,129,0.12)'), flex: 1 }}>🔓 Liberar para edição</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
