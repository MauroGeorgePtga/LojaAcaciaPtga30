import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { ordenarComendas, indiceComenda } from '../../utils/ordemComendas';
import { gerarRelatorioComendasPDF } from '../../utils/gerarRelatorioComendasPDF';

// Mesma lista/normalização já usada no resto do sistema pra identificar
// licença, desligamento etc. no histórico de situações.
const normalizar = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
// Tipos do histórico de situações (GestaoSituacoes): licenca, desligado (Quit Placet),
// ex_oficio, suspenso, irregular. A comparação ignora acento, hífen e sublinhado —
// antes a lista procurava "ex-oficio" e o banco grava "ex_oficio", então Ex-Ofício
// nunca desqualificava ninguém.
const chaveInterrupcao = (tipo) => {
  const n = normalizar(tipo).replace(/[_\-\s]/g, '');
  if (n.includes('licenca')) return 'licenca';
  if (n.includes('desligad') || n.includes('quit')) return 'desligado';
  if (n.includes('exoficio')) return 'exoficio';
  if (n.includes('suspens')) return 'suspenso';
  if (n.includes('irregular')) return 'irregular';
  if (n.includes('exclu')) return 'excluido';
  return null;
};
const ROTULO_INTERRUPCAO = {
  licenca: 'Licença', desligado: 'Quite Placet', exoficio: 'Ex-Ofício',
  suspenso: 'Suspensão', irregular: 'Irregularidade', excluido: 'Exclusão',
};
const fmtD = (d) => (d ? new Date(String(d).substring(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR') : '');

// Mesmo critério de "irmão ativo" do resto do sistema (Dashboard, Resumo de Irmãos):
// situação regular ou licenciado. Falecido, desligado, irregular etc. ficam de fora —
// o campo "status" sozinho não basta, porque não muda quando o irmão falece ou é desligado.
const SITUACOES_ATIVAS = ['regular', 'licenciado'];
const ehIrmaoAtivo = (i) =>
  SITUACOES_ATIVAS.includes((i.situacao || '').toLowerCase()) && !i.data_falecimento;

const TIPOS_CRITERIO = [
  { value: 'tempo_maconaria', label: 'Tempo de Maçonaria (anos desde a iniciação)' },
  { value: 'origem_demolay_lowton', label: 'Origem DeMolay/Lowtons + tempo de Maçonaria' },
  { value: 'presenca_100_anual', label: 'Presença 100% no ano (Maçom 100% — entrega anual)' },
  { value: 'acumulo_comenda', label: 'Acúmulo de entregas de outra comenda (ex.: Roldão = 3× Maçom 100%)' },
  { value: 'manual', label: 'Manual (sem cálculo automático)' },
  { value: 'macom_100_acumulado', label: 'Acúmulo de anos 100% por presença (antigo)' },
];

const ORIGENS = [
  { value: 'grande_loja', label: 'Grande Loja' },
  { value: 'loja', label: 'Loja' },
];
const origemDe = (c) => (c?.origem || 'grande_loja');
const rotuloOrigem = (o) => (o === 'loja' ? 'Loja' : 'Grande Loja');

// solido = usado sobre o cabeçalho colorido do card (fundo branco, texto escuro)
const SeloOrigem = ({ origem, solido = false }) => (
  <span style={{
    fontSize: '0.62rem', fontWeight: 800, padding: '0.1rem 0.5rem', borderRadius: '999px', textTransform: 'uppercase', letterSpacing: '0.03em',
    background: solido ? '#ffffff' : (origem === 'loja' ? 'rgba(16,185,129,0.18)' : 'rgba(59,130,246,0.18)'),
    color: solido ? (origem === 'loja' ? '#047857' : '#1d4ed8') : (origem === 'loja' ? '#10b981' : '#60a5fa'),
    border: solido ? '1px solid #ffffff' : `1px solid ${origem === 'loja' ? 'rgba(16,185,129,0.4)' : 'rgba(59,130,246,0.4)'}`,
  }}>{rotuloOrigem(origem)}</span>
);

const FORM_COMENDA_VAZIO = {
  nome: '', descricao_criterio: '', tipo_criterio: 'tempo_maconaria', origem: 'grande_loja',
  anos_necessarios: '', requer_mestre_instalado: '', qtd_necessaria: '', comenda_base_id: '',
};
const anoAtualNum = new Date().getFullYear();

const anosDesde = (data) => {
  if (!data) return 0;
  const inicio = new Date(data + 'T00:00:00');
  const hoje = new Date();
  let anos = hoje.getFullYear() - inicio.getFullYear();
  const m = hoje.getMonth() - inicio.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < inicio.getDate())) anos--;
  return anos;
};

const SEM_PERMISSAO = 'sem permissão para alterar (bloqueado pelo banco).';

export default function Comendas({ permissoes, userData, showSuccess, showError }) { // eslint-disable-line no-unused-vars
  // Fase 2: edição definida pelo módulo 'comendas' (Admin/Venerável sempre; demais conforme Usuários)
  const podeEditar = !!permissoes?.canEdit;

  const [aba, setAba] = useState('elegiveis');
  const [loading, setLoading] = useState(true);

  const [comendas, setComendas] = useState([]);
  const [irmaos, setIrmaos] = useState([]);
  const [historicoSituacoes, setHistoricoSituacoes] = useState([]);
  const [sessoes, setSessoes] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [irmaosComendas, setIrmaosComendas] = useState([]);
  // Indicações das comendas manuais (aparecem em Elegíveis até a entrega)
  const [indicacoes, setIndicacoes] = useState([]);
  const [modalIndicacao, setModalIndicacao] = useState(null); // comenda
  const [indicacaoForm, setIndicacaoForm] = useState({ irmao_id: '', ano_referencia: '', observacoes: '' });
  const [dadosLoja, setDadosLoja] = useState(null);

  const [filtroOrigem, setFiltroOrigem] = useState('todas');
  // Filtros da aba Comendados (só opções que existem nas entregas)
  const [filtroIrmaoCom, setFiltroIrmaoCom] = useState('');
  const [filtroComendaCom, setFiltroComendaCom] = useState('');

  const [modalEntrega, setModalEntrega] = useState(null); // { irmao, comenda, ano }
  const [entregaForm, setEntregaForm] = useState({ data_entrega: new Date().toISOString().split('T')[0], observacoes: '', ano_referencia: '' });

  // Registro manual de entrega (comendas da Loja e certificados antigos de Maçom 100%)
  const [modalRegistro, setModalRegistro] = useState(false);
  const [registroForm, setRegistroForm] = useState({ irmao_id: '', comenda_id: '', data_entrega: new Date().toISOString().split('T')[0], ano_referencia: '', concedida_por: 'grande_loja', observacoes: '' });

  const [comendaForm, setComendaForm] = useState(FORM_COMENDA_VAZIO);
  const [editandoComendaId, setEditandoComendaId] = useState(null);

  useEffect(() => {
    carregarTudo();
    supabase.from('dados_loja').select('*').single().then(({ data }) => { if (data) setDadosLoja(data); });
  }, []);

  const carregarTudo = async () => {
    setLoading(true);
    try {
      const [
        { data: comendasData },
        { data: irmaosData },
        { data: historicoData },
        { data: sessoesData },
        { data: irmaosComendasData },
        { data: indicacoesData },
      ] = await Promise.all([
        supabase.from('comendas').select('*').order('nome'),
        supabase.from('irmaos').select('id, nome, cim, data_iniciacao, data_elevacao, data_exaltacao, data_ingresso_loja, mestre_instalado, oriundo_demolay_lowton, status, situacao, data_falecimento, data_licenca, data_desligamento').eq('status', 'ativo'),
        supabase.from('historico_situacoes').select('*'),
        supabase.from('sessoes_presenca').select('id, data_sessao, grau_sessao_id'),
        supabase.from('irmaos_comendas').select('*, irmaos(nome, cim), comendas(nome, origem, tipo_criterio)').order('data_entrega', { ascending: false }),
        supabase.from('comendas_indicacoes').select('*').order('created_at'),
      ]);

      setComendas([...(comendasData || [])].sort(ordenarComendas));
      setIrmaos((irmaosData || []).filter(ehIrmaoAtivo));
      setHistoricoSituacoes(historicoData || []);
      setSessoes(sessoesData || []);
      setIrmaosComendas(irmaosComendasData || []);
      setIndicacoes(indicacoesData || []);

      // Registros de presença — paginado, pode ser um histórico grande
      const sessaoIds = (sessoesData || []).map(s => s.id);
      let todos = [], inicio = 0;
      const pagina = 1000;
      while (sessaoIds.length > 0) {
        const { data: lote } = await supabase
          .from('registros_presenca')
          .select('membro_id, presente, sessao_id')
          .in('sessao_id', sessaoIds)
          .range(inicio, inicio + pagina - 1);
        if (!lote || lote.length === 0) break;
        todos = todos.concat(lote);
        if (lote.length < pagina) break;
        inicio += pagina;
      }
      setRegistros(todos);
    } catch (e) {
      showError?.('Erro ao carregar dados de comendas: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Teve licença/desligamento/etc. alguma vez? Desqualifica de vez (regra
  // confirmada: não é descontar tempo, é perder o direito por completo). ──
  // Guarda TODAS as interrupções de cada irmão (licença, desligamento/Quit Placet, ex-ofício...).
  // Quem retornou continua inelegível: o histórico encerrado ("vencida") segue gravado, e é ele
  // que conta — não a situação de hoje. Registros "cancelada" não contam (foram anulados,
  // lançados por engano). Como reforço pra dado antigo, olha também as datas do cadastro e a
  // situação atual de licenciado.
  const interrupcoesPorIrmao = useMemo(() => {
    const hojeISO = new Date().toISOString().split('T')[0];
    const mapa = {};
    irmaos.forEach(i => { mapa[i.id] = []; });

    historicoSituacoes.forEach(sit => {
      if (!mapa[sit.membro_id] || sit.status === 'cancelada') return;
      const chave = chaveInterrupcao(sit.tipo_situacao);
      if (!chave) return;
      mapa[sit.membro_id].push({
        chave, rotulo: ROTULO_INTERRUPCAO[chave],
        inicio: sit.data_inicio, fim: sit.data_fim,
        emCurso: sit.status === 'ativa' && (!sit.data_fim || sit.data_fim >= hojeISO),
        origem: 'historico',
      });
    });

    irmaos.forEach(i => {
      const lista = mapa[i.id];
      const tem = (k) => lista.some(x => x.chave === k);
      const situacao = (i.situacao || '').toLowerCase();
      if (i.data_licenca && !tem('licenca')) {
        lista.push({ chave: 'licenca', rotulo: ROTULO_INTERRUPCAO.licenca, inicio: i.data_licenca, fim: null, emCurso: situacao === 'licenciado', origem: 'cadastro' });
      }
      if (i.data_desligamento && !tem('desligado') && !tem('exoficio')) {
        const k = situacao === 'ex_oficio' ? 'exoficio' : 'desligado';
        lista.push({ chave: k, rotulo: ROTULO_INTERRUPCAO[k], inicio: i.data_desligamento, fim: null, emCurso: false, origem: 'cadastro' });
      }
      if (situacao === 'licenciado' && !tem('licenca')) {
        lista.push({ chave: 'licenca', rotulo: ROTULO_INTERRUPCAO.licenca, inicio: null, fim: null, emCurso: true, origem: 'situação atual' });
      }
    });
    return mapa;
  }, [irmaos, historicoSituacoes]);

  const temInterrupcao = (irmao) => (interrupcoesPorIrmao[irmao.id] || []).length > 0;

  // ── Quantos anos esse irmão já bateu 100% de presença — mesma lógica do
  // card "Presença 100%" do Dashboard, só que rodada ano a ano (não só o
  // ano corrente) e contando quantos anos bateram. ──────────────────────
  // Retorna a LISTA de anos 100% de cada irmão (ano em andamento incluído: se faltar,
  // o ano deixa de ser 100% e some da lista automaticamente).
  const anosCemPorIrmao = useMemo(() => {
    const porIrmao = {};
    if (sessoes.length === 0) return porIrmao;

    const anoMin = Math.min(...sessoes.map(s => new Date(s.data_sessao).getFullYear()));
    const anoAtual = new Date().getFullYear();
    const sessoesPorId = Object.fromEntries(sessoes.map(s => [s.id, s]));
    const registrosPorMembro = {};
    registros.forEach(r => { (registrosPorMembro[r.membro_id] = registrosPorMembro[r.membro_id] || []).push(r); });

    irmaos.forEach(irmao => {
      let grauIrmao = 0;
      if (irmao.data_exaltacao) grauIrmao = 3;
      else if (irmao.data_elevacao) grauIrmao = 2;
      else if (irmao.data_iniciacao) grauIrmao = 1;
      if (grauIrmao === 0) return;

      const dataInicio = irmao.data_ingresso_loja ? new Date(irmao.data_ingresso_loja) : (irmao.data_iniciacao ? new Date(irmao.data_iniciacao) : null);
      const anosCem = [];
      const regsIrmao = registrosPorMembro[irmao.id] || [];

      // Iniciado ou filiado: o ano de entrada na Loja não conta — só a partir do ano seguinte
      const anoEntrada = Math.max(
        irmao.data_iniciacao ? parseInt(String(irmao.data_iniciacao).substring(0, 4)) : 0,
        irmao.data_ingresso_loja ? parseInt(String(irmao.data_ingresso_loja).substring(0, 4)) : 0,
      );
      const primeiroAno = Math.max(anoMin, anoEntrada + 1);

      for (let ano = primeiroAno; ano <= anoAtual; ano++) {
        const fimAno = ano === anoAtual ? new Date() : new Date(ano, 11, 31);
        let totalRegistros = 0, presentes = 0;

        regsIrmao.forEach(reg => {
          const sessao = sessoesPorId[reg.sessao_id];
          if (!sessao) return;
          const dataSessao = new Date(sessao.data_sessao);
          if (dataSessao.getFullYear() !== ano || dataSessao > fimAno) return;

          let grauSessao = sessao.grau_sessao_id === 4 ? 1 : (sessao.grau_sessao_id || 1);
          if (dataInicio && dataSessao < dataInicio) return;
          if (grauSessao > grauIrmao) return;

          const situacaoNaData = historicoSituacoes.find(sit =>
            sit.membro_id === irmao.id &&
            dataSessao >= new Date(sit.data_inicio + 'T00:00:00') &&
            (sit.data_fim === null || dataSessao <= new Date(sit.data_fim + 'T00:00:00'))
          );
          if (situacaoNaData) return;

          totalRegistros++;
          if (reg.presente) presentes++;
        });

        if (totalRegistros > 0 && presentes === totalRegistros) anosCem.push(ano);
      }
      porIrmao[irmao.id] = anosCem;
    });

    return porIrmao;
  }, [irmaos, sessoes, registros, historicoSituacoes]);

  // ── Elegibilidade por comenda ────────────────────────────────────────────
  const entregasDe = (irmaoId, comendaId) => irmaosComendas.filter(ic => ic.irmao_id === irmaoId && ic.comenda_id === comendaId);
  // Para a Roldão só valem entregas concedidas pela Grande Loja
  const contaAcumulo = (e) => (e.concedida_por || 'grande_loja') === 'grande_loja';
  const entregasAcumulo = (irmaoId, baseId) => entregasDe(irmaoId, baseId).filter(contaAcumulo);
  const jaRecebeu = (irmaoId, comendaId) => irmaosComendas.some(ic => ic.irmao_id === irmaoId && ic.comenda_id === comendaId);

  // Atende o critério em si (tempo, instalado, origem), sem olhar licença/desligamento.
  const atendeCriterioBase = (irmao, comenda) => {
    switch (comenda.tipo_criterio) {
      case 'tempo_maconaria': {
        if (!irmao.data_iniciacao) return false;
        if (anosDesde(irmao.data_iniciacao) < (comenda.anos_necessarios || 0)) return false;
        if (comenda.requer_mestre_instalado !== null && comenda.requer_mestre_instalado !== undefined) {
          if (!!irmao.mestre_instalado !== comenda.requer_mestre_instalado) return false;
        }
        return true;
      }
      case 'origem_demolay_lowton': {
        if (!irmao.oriundo_demolay_lowton || !irmao.data_iniciacao) return false;
        return anosDesde(irmao.data_iniciacao) >= (comenda.anos_necessarios || 0);
      }
      default:
        return false;
    }
  };

  // Maçom 100%: anos 100% ainda não entregues (cada ano é uma entrega)
  const anosPendentes100 = (irmao, comenda) => {
    const entregues = entregasDe(irmao.id, comenda.id).map(e => e.ano_referencia);
    return (anosCemPorIrmao[irmao.id] || []).filter(ano => !entregues.includes(ano));
  };

  // Comendas de acúmulo (Roldão) que dependem de uma comenda base
  const acumulosDaBase = (baseId) => comendas.filter(c => c.ativo && c.tipo_criterio === 'acumulo_comenda' && c.comenda_base_id === baseId);

  // Lista de itens { irmao, ano?, qtd? } por comenda
  const elegiveisPorComenda = useMemo(() => {
    const mapa = {};
    comendas.filter(c => c.ativo).forEach(comenda => {
      let lista = [];
      switch (comenda.tipo_criterio) {
        case 'tempo_maconaria':
        case 'origem_demolay_lowton':
          lista = irmaos.filter(i => !jaRecebeu(i.id, comenda.id) && atendeCriterioBase(i, comenda) && !temInterrupcao(i)).map(i => ({ irmao: i }));
          break;
        case 'presenca_100_anual':
          irmaos.forEach(i => anosPendentes100(i, comenda).forEach(ano => lista.push({ irmao: i, ano })));
          lista.sort((a, b) => b.ano - a.ano || a.irmao.nome.localeCompare(b.irmao.nome));
          break;
        case 'acumulo_comenda': {
          const need = comenda.qtd_necessaria || 0;
          if (comenda.comenda_base_id && need > 0) {
            lista = irmaos
              .filter(i => !jaRecebeu(i.id, comenda.id))
              .map(i => ({ irmao: i, qtd: entregasAcumulo(i.id, comenda.comenda_base_id).length }))
              .filter(x => x.qtd >= need);
          }
          break;
        }
        case 'macom_100_acumulado':
          lista = irmaos.filter(i => !jaRecebeu(i.id, comenda.id) && (anosCemPorIrmao[i.id] || []).length >= (comenda.qtd_necessaria || 0)).map(i => ({ irmao: i }));
          break;
        case 'manual':
          // Indicados manualmente, até serem entregues
          lista = indicacoes.filter(ind => ind.comenda_id === comenda.id).map(ind => ({
            irmao: irmaos.find(i => i.id === ind.irmao_id) || { id: ind.irmao_id, nome: '(irmão inativo)', cim: '' },
            ano: ind.ano_referencia || null, indicacaoId: ind.id, obs: ind.observacoes,
          }));
          break;
        default:
          lista = [];
      }
      mapa[comenda.id] = lista;
    });
    return mapa;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comendas, irmaos, irmaosComendas, anosCemPorIrmao, historicoSituacoes, indicacoes]);

  // Em progresso para comendas de acúmulo (ex.: Roldão 1/3, 2/3)
  const progressoPorComenda = useMemo(() => {
    const mapa = {};
    comendas.filter(c => c.ativo && c.tipo_criterio === 'acumulo_comenda' && c.comenda_base_id).forEach(comenda => {
      const need = comenda.qtd_necessaria || 0;
      mapa[comenda.id] = irmaos
        .filter(i => !jaRecebeu(i.id, comenda.id))
        .map(i => {
          const ents = entregasAcumulo(i.id, comenda.comenda_base_id);
          return { irmao: i, qtd: ents.length, anos: ents.map(e => e.ano_referencia).filter(Boolean).sort((a, b) => a - b) };
        })
        .filter(x => x.qtd > 0 && x.qtd < need)
        .sort((a, b) => b.qtd - a.qtd || a.irmao.nome.localeCompare(b.irmao.nome));
    });
    return mapa;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comendas, irmaos, irmaosComendas]);

  // Selo "x/3 Roldão" exibido na comenda base (Maçom 100%)
  const selosAcumulo = (irmao, baseId) => acumulosDaBase(baseId).map(ac => {
    if (jaRecebeu(irmao.id, ac.id)) return { texto: `${ac.nome} ✓`, ok: true };
    return { texto: `${entregasAcumulo(irmao.id, baseId).length}/${ac.qtd_necessaria || 0} ${ac.nome}`, ok: false };
  });

  // Qualificados pelo critério, mas inelegíveis por licença/desligamento/etc. — só as
  // comendas calculadas por tempo/origem (Maçom 100% e manual não têm essa regra).
  const inelegiveisPorComenda = useMemo(() => {
    const mapa = {};
    comendas
      .filter(c => c.ativo && (c.tipo_criterio === 'tempo_maconaria' || c.tipo_criterio === 'origem_demolay_lowton'))
      .forEach(comenda => {
        const lista = irmaos
          .filter(i => !jaRecebeu(i.id, comenda.id) && atendeCriterioBase(i, comenda) && temInterrupcao(i))
          .sort((a, b) => a.nome.localeCompare(b.nome));
        if (lista.length > 0) mapa[comenda.id] = lista;
      });
    return mapa;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comendas, irmaos, irmaosComendas, historicoSituacoes]);

  // ── Relatório em PDF: um quadro por comenda ativa, igual à aba Elegíveis ──
  const gerarPdf = () => {
    try {
      const dados = comendasVisiveis.filter(c => c.ativo)
        .sort(ordenarComendas)
        .map(c => ({
          nome: c.nome,
          origem: rotuloOrigem(origemDe(c)),
          descricao_criterio: c.descricao_criterio,
          tipo_criterio: c.tipo_criterio,
          elegiveis: (elegiveisPorComenda[c.id] || []).map(it => {
            const det = [];
            if (it.ano) det.push(`Ano ${it.ano}${it.ano === anoAtualNum ? ' (em andamento)' : ''}`);
            if (c.tipo_criterio === 'presenca_100_anual') selosAcumulo(it.irmao, c.id).forEach(sl => det.push(sl.texto.replace(' ✓', ' (recebida)')));
            if (c.tipo_criterio === 'acumulo_comenda') det.push(`${it.qtd}/${c.qtd_necessaria}`);
            return { nome: it.irmao.nome, cim: it.irmao.cim, detalhe: det.join('  •  ') };
          }),
          progresso: (progressoPorComenda[c.id] || []).map(p => ({
            nome: p.irmao.nome, cim: p.irmao.cim,
            detalhe: `Em progresso ${p.qtd}/${c.qtd_necessaria}${p.anos.length ? ' — anos ' + p.anos.join(', ') : ''}`,
          })),
        }));
      if (dados.length === 0) { showError?.('Nenhuma comenda ativa pra gerar o relatório.'); return; }
      gerarRelatorioComendasPDF(dados, dadosLoja);
    } catch (e) {
      showError?.('Erro ao gerar PDF: ' + e.message);
    }
  };

  // ── Entregar comenda ─────────────────────────────────────────────────────
  const abrirEntrega = (irmao, comenda, ano = null, concedidaPor = null, indicacaoId = null) => {
    setModalEntrega({ irmao, comenda, ano, concedida_por: concedidaPor || origemDe(comenda), indicacaoId });
    setEntregaForm({ data_entrega: new Date().toISOString().split('T')[0], observacoes: '', ano_referencia: ano ? String(ano) : '' });
  };

  const msgErroEntrega = (e) => (e?.code === '23505'
    ? 'Esse irmão já tem essa comenda registrada' + ' (para esse ano).'
    : 'Erro ao registrar entrega: ' + e.message);

  const confirmarEntrega = async () => {
    try {
      const { error } = await supabase.from('irmaos_comendas').insert({
        irmao_id: modalEntrega.irmao.id,
        comenda_id: modalEntrega.comenda.id,
        data_entrega: entregaForm.data_entrega,
        ano_referencia: entregaForm.ano_referencia ? parseInt(entregaForm.ano_referencia) : null,
        concedida_por: modalEntrega.concedida_por || 'grande_loja',
        observacoes: entregaForm.observacoes || null,
      });
      if (error) throw error;
      // Comenda manual: a indicação sai de Elegíveis após a entrega
      if (modalEntrega.indicacaoId) {
        await supabase.from('comendas_indicacoes').delete().eq('id', modalEntrega.indicacaoId);
      }
      showSuccess?.(`✅ ${modalEntrega.comenda.nome} entregue a ${modalEntrega.irmao.nome}!`);
      setModalEntrega(null);
      carregarTudo();
    } catch (e) {
      showError?.(msgErroEntrega(e));
    }
  };

  // ── Indicação (comendas manuais) ──
  const abrirIndicacao = (comenda) => {
    setIndicacaoForm({ irmao_id: '', ano_referencia: String(new Date().getFullYear()), observacoes: '' });
    setModalIndicacao(comenda);
  };
  const confirmarIndicacao = async () => {
    if (!indicacaoForm.irmao_id) { showError?.('Selecione o irmão.'); return; }
    try {
      const { error } = await supabase.from('comendas_indicacoes').insert({
        comenda_id: modalIndicacao.id,
        irmao_id: indicacaoForm.irmao_id,
        ano_referencia: indicacaoForm.ano_referencia ? parseInt(indicacaoForm.ano_referencia) : null,
        observacoes: indicacaoForm.observacoes || null,
      });
      if (error) throw error;
      showSuccess?.('✅ Irmão indicado — aparece em Elegíveis até a entrega.');
      setModalIndicacao(null);
      carregarTudo();
    } catch (e) {
      showError?.(e?.code === '23505' ? 'Esse irmão já está indicado para essa comenda (nesse ano).' : 'Erro ao indicar: ' + e.message);
    }
  };
  const removerIndicacao = async (it, comenda) => {
    if (!window.confirm(`Remover a indicação de ${it.irmao.nome} para ${comenda.nome}?`)) return;
    try {
      const { data, error } = await supabase.from('comendas_indicacoes').delete().eq('id', it.indicacaoId).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error(SEM_PERMISSAO);
      showSuccess?.('Indicação removida.');
      carregarTudo();
    } catch (e) {
      showError?.('Erro ao remover: ' + e.message);
    }
  };

  // Ano encerrado sem entrega: sai da lista e não conta para a Roldão
  const retirarSemEntrega = async (irmao, comenda, ano) => {
    if (!window.confirm(`Retirar ${irmao.nome} da lista de ${comenda.nome} ${ano} sem entrega?\nNão contará para a Roldão. Para desfazer, exclua o registro na aba Comendados.`)) return;
    try {
      const { error } = await supabase.from('irmaos_comendas').insert({
        irmao_id: irmao.id, comenda_id: comenda.id, ano_referencia: ano,
        data_entrega: new Date().toISOString().split('T')[0],
        concedida_por: 'nao_entregue', observacoes: 'Retirado sem entrega',
      });
      if (error) throw error;
      showSuccess?.('✅ Retirado da lista.');
      carregarTudo();
    } catch (e) {
      showError?.(msgErroEntrega(e));
    }
  };

  const abrirRegistro = () => {
    setRegistroForm({ irmao_id: '', comenda_id: '', data_entrega: new Date().toISOString().split('T')[0], ano_referencia: '', concedida_por: 'grande_loja', observacoes: '' });
    setModalRegistro(true);
  };

  const comendaRegistro = comendas.find(c => String(c.id) === String(registroForm.comenda_id));

  const confirmarRegistro = async () => {
    if (!registroForm.irmao_id || !registroForm.comenda_id) { showError?.('Selecione o irmão e a comenda.'); return; }
    if (comendaRegistro?.tipo_criterio === 'presenca_100_anual' && !registroForm.ano_referencia) { showError?.('Informe o ano de referência do Maçom 100%.'); return; }
    try {
      const { error } = await supabase.from('irmaos_comendas').insert({
        irmao_id: registroForm.irmao_id,
        comenda_id: registroForm.comenda_id,
        data_entrega: registroForm.data_entrega,
        ano_referencia: registroForm.ano_referencia ? parseInt(registroForm.ano_referencia) : null,
        concedida_por: comendaRegistro?.tipo_criterio === 'presenca_100_anual' ? (registroForm.concedida_por || 'grande_loja') : origemDe(comendaRegistro),
        observacoes: registroForm.observacoes || null,
      });
      if (error) throw error;
      showSuccess?.('✅ Entrega registrada!');
      setModalRegistro(false);
      carregarTudo();
    } catch (e) {
      showError?.(msgErroEntrega(e));
    }
  };

  const excluirEntrega = async (id) => {
    if (!window.confirm('Remover este registro de entrega? O irmão volta a aparecer como elegível.')) return;
    try {
      const { data, error } = await supabase.from('irmaos_comendas').delete().eq('id', id).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error(SEM_PERMISSAO);
      showSuccess?.('✅ Registro removido.');
      carregarTudo();
    } catch (e) {
      showError?.('Erro ao remover: ' + e.message);
    }
  };

  // ── CRUD de comendas (cadastro extensível) ──────────────────────────────
  const iniciarEdicaoComenda = (c) => {
    setEditandoComendaId(c.id);
    setComendaForm({
      nome: c.nome, descricao_criterio: c.descricao_criterio || '', tipo_criterio: c.tipo_criterio, origem: origemDe(c),
      comenda_base_id: c.comenda_base_id ?? '',
      anos_necessarios: c.anos_necessarios ?? '', requer_mestre_instalado: c.requer_mestre_instalado === null || c.requer_mestre_instalado === undefined ? '' : String(c.requer_mestre_instalado),
      qtd_necessaria: c.qtd_necessaria ?? '',
    });
  };

  const cancelarEdicaoComenda = () => {
    setEditandoComendaId(null);
    setComendaForm(FORM_COMENDA_VAZIO);
  };

  const salvarComenda = async (e) => {
    e.preventDefault();
    if (!comendaForm.nome.trim()) { showError?.('Informe o nome da comenda.'); return; }
    if (comendaForm.tipo_criterio === 'acumulo_comenda' && (!comendaForm.comenda_base_id || !comendaForm.qtd_necessaria)) {
      showError?.('Informe a comenda base e a quantidade de entregas necessárias.'); return;
    }
    try {
      const payload = {
        nome: comendaForm.nome.trim(),
        descricao_criterio: comendaForm.descricao_criterio || null,
        tipo_criterio: comendaForm.tipo_criterio,
        origem: comendaForm.origem || 'grande_loja',
        comenda_base_id: comendaForm.tipo_criterio === 'acumulo_comenda' && comendaForm.comenda_base_id !== '' ? comendaForm.comenda_base_id : null,
        anos_necessarios: comendaForm.anos_necessarios !== '' ? parseInt(comendaForm.anos_necessarios) : null,
        requer_mestre_instalado: comendaForm.requer_mestre_instalado === '' ? null : comendaForm.requer_mestre_instalado === 'true',
        qtd_necessaria: comendaForm.qtd_necessaria !== '' ? parseInt(comendaForm.qtd_necessaria) : null,
      };
      if (editandoComendaId) {
        const { data, error } = await supabase.from('comendas').update(payload).eq('id', editandoComendaId).select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error(SEM_PERMISSAO);
        showSuccess?.('✅ Comenda atualizada!');
      } else {
        const { error } = await supabase.from('comendas').insert(payload);
        if (error) throw error;
        showSuccess?.('✅ Comenda cadastrada!');
      }
      cancelarEdicaoComenda();
      carregarTudo();
    } catch (e2) {
      showError?.('Erro ao salvar comenda: ' + e2.message);
    }
  };

  const alternarAtivoComenda = async (c) => {
    try {
      const { data, error } = await supabase.from('comendas').update({ ativo: !c.ativo }).eq('id', c.id).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error(SEM_PERMISSAO);
      carregarTudo();
    } catch (e) {
      showError?.('Erro ao alterar comenda: ' + e.message);
    }
  };

  const excluirComenda = async (id) => {
    if (!window.confirm('Excluir esta comenda? O histórico de quem já recebeu também será apagado.')) return;
    try {
      const { data, error } = await supabase.from('comendas').delete().eq('id', id).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error(SEM_PERMISSAO);
      showSuccess?.('✅ Comenda excluída.');
      carregarTudo();
    } catch (e) {
      showError?.('Erro ao excluir: ' + e.message);
    }
  };

  const passaFiltro = (c) => filtroOrigem === 'todas' || origemDe(c) === filtroOrigem;
  const comendasVisiveis = comendas.filter(passaFiltro);
  const totalInelegiveisVis = comendasVisiveis.reduce((t, c) => t + (inelegiveisPorComenda[c.id]?.length || 0), 0);
  // Quem efetivamente entregou: concedida_por (grande_loja/loja); senão, a origem da comenda
  const entreguePor = (ic) => (['grande_loja', 'loja'].includes(ic.concedida_por) ? ic.concedida_por : (ic.comendas?.origem || 'grande_loja'));
  const comendadosOrigem = irmaosComendas.filter(ic => filtroOrigem === 'todas' || entreguePor(ic) === filtroOrigem);
  // Opções dos filtros: apenas irmãos e comendas que têm entrega cadastrada
  const opcoesIrmaosCom = [...new Map(comendadosOrigem
    .filter(ic => !filtroComendaCom || String(ic.comenda_id) === filtroComendaCom)
    .map(ic => [String(ic.irmao_id), ic.irmaos?.nome || '—'])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const opcoesComendasCom = [...new Map(comendadosOrigem
    .filter(ic => !filtroIrmaoCom || String(ic.irmao_id) === filtroIrmaoCom)
    .map(ic => [String(ic.comenda_id), ic.comendas?.nome || '—'])).entries()]
    .sort((a, b) => indiceComenda(a[1]) - indiceComenda(b[1]) || a[1].localeCompare(b[1]));
  const comendadosVisiveis = comendadosOrigem
    .filter(ic => !filtroIrmaoCom || String(ic.irmao_id) === filtroIrmaoCom)
    .filter(ic => !filtroComendaCom || String(ic.comenda_id) === filtroComendaCom)
    .sort((a, b) => indiceComenda(a.comendas?.nome) - indiceComenda(b.comendas?.nome)
      || String(a.comendas?.nome || '').localeCompare(String(b.comendas?.nome || ''))
      || String(b.data_entrega || '').localeCompare(String(a.data_entrega || '')));

  const sInp = { width: '100%', padding: '0.5rem 0.75rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' };
  const sLabel = { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase' };

  if (loading) return <div className="p-10 text-center" style={{ color: 'var(--color-text-muted)' }}>Carregando comendas...</div>;

  return (
    <div className="p-6" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>🎖️ Comendas</h2>
        <button onClick={gerarPdf}
          style={{ padding: '0.5rem 1.2rem', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
          📄 Gerar PDF
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {[['todas', 'Todas'], ['grande_loja', '🏛️ Grande Loja'], ['loja', '🔺 Loja']].map(([v, l]) => (
          <button key={v} onClick={() => setFiltroOrigem(v)}
            style={{ padding: '0.3rem 0.85rem', borderRadius: '999px', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', border: `1px solid ${filtroOrigem === v ? 'var(--color-accent)' : 'var(--color-border)'}`, background: filtroOrigem === v ? 'var(--color-accent-bg)' : 'transparent', color: filtroOrigem === v ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {[['elegiveis', '✅ Elegíveis'], ['comendados', '📜 Comendados'], ['inelegiveis', `⛔ Inelegíveis${totalInelegiveisVis > 0 ? ` (${totalInelegiveisVis})` : ''}`], ['cadastrar', '⚙️ Cadastrar Comenda']].map(([v, l]) => (
          <button key={v} onClick={() => setAba(v)}
            style={{ padding: '0.45rem 1rem', borderRadius: 'var(--radius-lg)', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', background: aba === v ? 'var(--color-accent)' : 'var(--color-surface-2)', color: aba === v ? '#fff' : 'var(--color-text)' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── ELEGÍVEIS ──────────────────────────────────────────────────── */}
      {aba === 'elegiveis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {comendasVisiveis.filter(c => c.ativo).length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>Nenhuma comenda cadastrada ainda.</p>
          )}
          {comendasVisiveis.filter(c => c.ativo).map(comenda => {
            const lista = elegiveisPorComenda[comenda.id] || [];
            const progresso = progressoPorComenda[comenda.id] || [];
            const ehAcumulo = comenda.tipo_criterio === 'acumulo_comenda';
            const ehAnual = comenda.tipo_criterio === 'presenca_100_anual';
            return (
              <div key={comenda.id} style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                <div style={{ padding: '0.85rem 1.25rem', background: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{comenda.nome}</span>
                  <SeloOrigem origem={origemDe(comenda)} solido />
                  <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)' }}>
                    {lista.length} elegível(is){ehAcumulo && progresso.length > 0 ? ` · ${progresso.length} em progresso` : ''}
                  </span>
                </div>
                {comenda.descricao_criterio && (
                  <p style={{ margin: 0, padding: '0.6rem 1.25rem', fontSize: '0.78rem', color: 'var(--color-text-muted)', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                    {comenda.descricao_criterio}
                  </p>
                )}
                {comenda.tipo_criterio === 'manual' && podeEditar && (
                  <div style={{ padding: '0.5rem 1.25rem', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => abrirIndicacao(comenda)}
                      style={{ padding: '0.35rem 0.85rem', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                      ➕ Indicar irmão
                    </button>
                  </div>
                )}
                {comenda.tipo_criterio === 'manual' && lista.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1rem', margin: 0, background: 'var(--color-surface)' }}>
                    Nenhum irmão indicado. {podeEditar ? 'Use "➕ Indicar irmão" para registrar quem vai receber.' : ''}
                  </p>
                ) : ehAcumulo && !comenda.comenda_base_id ? (
                  <p style={{ textAlign: 'center', color: '#ef4444', padding: '1rem', margin: 0, background: 'var(--color-surface)' }}>
                    Comenda base não definida — edite esta comenda na aba "Cadastrar Comenda".
                  </p>
                ) : lista.length === 0 && progresso.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1rem', margin: 0, background: 'var(--color-surface)' }}>Nenhum irmão elegível no momento.</p>
                ) : (
                  <div style={{ background: 'var(--color-surface)' }}>
                    {lista.map((it, idx) => {
                      const irmao = it.irmao;
                      const selos = ehAnual ? selosAcumulo(irmao, comenda.id) : [];
                      return (
                        <div key={irmao.id + '-' + (it.ano || '')} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1.25rem', borderBottom: '1px solid var(--color-border)', borderLeft: '4px solid #f59e0b', background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontWeight: 800, color: '#f59e0b', fontSize: '0.95rem' }}>{irmao.nome}</p>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>CIM: {irmao.cim || '—'}</p>
                            {(it.ano || selos.length > 0 || ehAcumulo) && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.3rem' }}>
                                {it.ano && (
                                  <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.12rem 0.55rem', borderRadius: '999px', background: 'rgba(245,158,11,0.15)', color: '#d97706', border: '1px solid rgba(245,158,11,0.35)' }}>
                                    Ano {it.ano}{it.ano === anoAtualNum ? ' (em andamento)' : ''}
                                  </span>
                                )}
                                {selos.map((sl, k) => (
                                  <span key={k} style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.12rem 0.55rem', borderRadius: '999px', background: sl.ok ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)', color: sl.ok ? '#10b981' : '#60a5fa', border: `1px solid ${sl.ok ? 'rgba(16,185,129,0.35)' : 'rgba(59,130,246,0.35)'}` }}>
                                    {sl.texto}
                                  </span>
                                ))}
                                {ehAcumulo && (
                                  <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.12rem 0.55rem', borderRadius: '999px', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.35)' }}>
                                    {it.qtd}/{comenda.qtd_necessaria} — completo
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          {podeEditar && (
                            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
                              <button onClick={() => abrirEntrega(irmao, comenda, it.ano || null, null, it.indicacaoId || null)}
                                style={{ padding: '0.4rem 0.9rem', background: '#c9a84c', color: '#1a1a1a', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                                🎖️ Entregar{it.ano ? ` ${it.ano}` : ''}
                              </button>
                              {it.indicacaoId && (
                                <button onClick={() => removerIndicacao(it, comenda)} title="Remover indicação"
                                  style={{ padding: '0.4rem 0.7rem', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.74rem', cursor: 'pointer' }}>
                                  ✖
                                </button>
                              )}
                              {ehAnual && it.ano && it.ano < anoAtualNum && (
                                <>
                                  <button onClick={() => abrirEntrega(irmao, comenda, it.ano, 'loja')} title="A Grande Loja não entregou; a Loja entregou (não conta para a Roldão)"
                                    style={{ padding: '0.4rem 0.7rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.4)', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.74rem', cursor: 'pointer' }}>
                                    🔺 Pela Loja
                                  </button>
                                  <button onClick={() => retirarSemEntrega(irmao, comenda, it.ano)} title="Retirar da lista sem entrega (não conta para a Roldão)"
                                    style={{ padding: '0.4rem 0.7rem', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.74rem', cursor: 'pointer' }}>
                                    ✖ Retirar
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {ehAcumulo && progresso.length > 0 && (
                      <>
                        <p style={{ margin: 0, padding: '0.45rem 1.25rem', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)', background: 'var(--color-surface-3)', borderBottom: '1px solid var(--color-border)' }}>
                          ⏳ Em progresso
                        </p>
                        {progresso.map((p, idx) => (
                          <div key={p.irmao.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 1.25rem', borderBottom: idx < progresso.length - 1 ? '1px solid var(--color-border)' : 'none', borderLeft: '4px solid #60a5fa', background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text)', fontSize: '0.9rem' }}>{p.irmao.nome}</p>
                              <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                CIM: {p.irmao.cim || '—'}{p.anos.length > 0 ? ` · Anos: ${p.anos.join(', ')}` : ''}
                              </p>
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 800, padding: '0.2rem 0.7rem', borderRadius: '999px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.35)', flexShrink: 0 }}>
                              {p.qtd}/{comenda.qtd_necessaria}
                            </span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── INELEGÍVEIS ────────────────────────────────────────────────── */}
      {aba === 'inelegiveis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ margin: 0, padding: '0.75rem 1rem', fontSize: '0.8rem', lineHeight: 1.5, color: 'var(--color-text-muted)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
            Irmãos que já cumpriram o critério da comenda, mas perderam o direito por <strong>licença</strong>, <strong>desligamento (Quit Placet)</strong> ou outra interrupção.
            Quem <strong>retornou continua inelegível</strong>: a regra olha o histórico completo, não só a situação de hoje.
          </p>

          {totalInelegiveisVis === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem', margin: 0 }}>Nenhum irmão nessa situação.</p>
          )}

          {comendasVisiveis.filter(c => inelegiveisPorComenda[c.id]).map(comenda => {
            const lista = inelegiveisPorComenda[comenda.id];
            return (
              <div key={comenda.id} style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                <div style={{ padding: '0.85rem 1.25rem', background: '#475569' }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{comenda.nome}</span>
                  <span style={{ marginLeft: '0.75rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)' }}>{lista.length} inelegível(is)</span>
                </div>
                <div style={{ background: 'var(--color-surface)' }}>
                  {lista.map((irmao, idx) => (
                    <div key={irmao.id} style={{ padding: '0.65rem 1.25rem', borderLeft: '4px solid #ef4444', borderBottom: idx < lista.length - 1 ? '1px solid var(--color-border)' : 'none', background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)' }}>
                      <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text)', fontSize: '0.9rem' }}>{irmao.nome}</p>
                      <p style={{ margin: '0.1rem 0 0.4rem', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>CIM: {irmao.cim || '—'}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {(interrupcoesPorIrmao[irmao.id] || []).map((it, k) => (
                          <span key={k} style={{
                            fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.6rem', borderRadius: '999px',
                            background: it.emCurso ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                            color: it.emCurso ? '#ef4444' : '#d97706',
                            border: `1px solid ${it.emCurso ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.35)'}`,
                          }}>
                            {it.rotulo}
                            {it.inicio ? ` · ${fmtD(it.inicio)}` : ''}
                            {it.fim ? ` → ${fmtD(it.fim)}` : ''}
                            {' · '}{it.emCurso ? 'em curso' : (['licenca', 'desligado'].includes(it.chave) ? 'retornou' : 'encerrada')}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── COMENDADOS ─────────────────────────────────────────────────── */}
      {aba === 'comendados' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filtroIrmaoCom} onChange={e => setFiltroIrmaoCom(e.target.value)} style={{ ...sInp, width: 'auto', flex: '1 1 220px' }}>
              <option value="">👤 Todos os irmãos ({opcoesIrmaosCom.length})</option>
              {opcoesIrmaosCom.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </select>
            <select value={filtroComendaCom} onChange={e => setFiltroComendaCom(e.target.value)} style={{ ...sInp, width: 'auto', flex: '1 1 220px' }}>
              <option value="">🎖️ Todas as comendas ({opcoesComendasCom.length})</option>
              {opcoesComendasCom.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </select>
            {(filtroIrmaoCom || filtroComendaCom) && (
              <button onClick={() => { setFiltroIrmaoCom(''); setFiltroComendaCom(''); }}
                style={{ padding: '0.5rem 0.85rem', background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', cursor: 'pointer' }}>
                ✕ Limpar
              </button>
            )}
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{comendadosVisiveis.length} registro(s)</span>
          </div>
          {podeEditar && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={abrirRegistro}
                style={{ padding: '0.5rem 1.1rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                ➕ Registrar entrega
              </button>
            </div>
          )}
          <div style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
            {comendadosVisiveis.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem', margin: 0 }}>Nenhuma comenda entregue ainda.</p>
            ) : comendadosVisiveis.map((ic, idx) => (
              <div key={ic.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1.1rem', borderBottom: idx < comendadosVisiveis.length - 1 ? '1px solid var(--color-border)' : 'none', background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)', opacity: ic.concedida_por === 'nao_entregue' ? 0.6 : 1 }}>
                <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{ic.concedida_por === 'nao_entregue' ? '✖️' : '🎖️'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text)', fontSize: '0.88rem' }}>{ic.irmaos?.nome || '—'}</p>
                  <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <SeloOrigem origem={entreguePor(ic)} />
                    <span>
                      {ic.comendas?.nome || '—'}{ic.ano_referencia ? ` (${ic.ano_referencia})` : ''}
                      {ic.comendas?.tipo_criterio === 'presenca_100_anual' && ic.concedida_por === 'loja' ? ' · Entregue pela Loja' : ''}
                      {ic.concedida_por === 'nao_entregue' ? ' · Retirado sem entrega' : ` — ${new Date(ic.data_entrega + 'T00:00:00').toLocaleDateString('pt-BR')}`}
                      {ic.observacoes && ic.concedida_por !== 'nao_entregue' ? ` · ${ic.observacoes}` : ''}
                    </span>
                  </p>
                </div>
                {podeEditar && (
                  <button onClick={() => excluirEntrega(ic.id)}
                    style={{ padding: '0.25rem 0.55rem', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', cursor: 'pointer', flexShrink: 0 }}>
                    🗑️
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CADASTRAR COMENDA ──────────────────────────────────────────── */}
      {aba === 'cadastrar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {podeEditar && (
            <form onSubmit={salvarComenda} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 1rem' }}>
                {editandoComendaId ? '✏️ Editar Comenda' : '➕ Nova Comenda'}
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={sLabel}>Nome da Comenda *</label>
                  <input value={comendaForm.nome} onChange={e => setComendaForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Comenda Ir∴ Fulano de Tal" style={sInp} />
                </div>
                <div>
                  <label style={sLabel}>Descrição do Critério</label>
                  <textarea value={comendaForm.descricao_criterio} onChange={e => setComendaForm(f => ({ ...f, descricao_criterio: e.target.value }))} rows={2} placeholder="Texto explicando o critério, exibido na aba Elegíveis" style={{ ...sInp, resize: 'vertical' }} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginBottom: '0.85rem' }}>
                <div>
                  <label style={sLabel}>Concedida por *</label>
                  <select value={comendaForm.origem} onChange={e => setComendaForm(f => ({ ...f, origem: e.target.value }))} style={sInp}>
                    {ORIGENS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <div>
                  <label style={sLabel}>Tipo de Critério *</label>
                  <select value={comendaForm.tipo_criterio} onChange={e => setComendaForm(f => ({ ...f, tipo_criterio: e.target.value }))} style={sInp}>
                    {TIPOS_CRITERIO.filter(t => t.value !== 'macom_100_acumulado' || comendaForm.tipo_criterio === 'macom_100_acumulado')
                      .map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                {(comendaForm.tipo_criterio === 'tempo_maconaria' || comendaForm.tipo_criterio === 'origem_demolay_lowton') && (
                  <div>
                    <label style={sLabel}>Anos Necessários *</label>
                    <input type="number" min="1" value={comendaForm.anos_necessarios} onChange={e => setComendaForm(f => ({ ...f, anos_necessarios: e.target.value }))} style={sInp} />
                  </div>
                )}

                {comendaForm.tipo_criterio === 'tempo_maconaria' && (
                  <div>
                    <label style={sLabel}>Exige Mestre Instalado?</label>
                    <select value={comendaForm.requer_mestre_instalado} onChange={e => setComendaForm(f => ({ ...f, requer_mestre_instalado: e.target.value }))} style={sInp}>
                      <option value="">Não importa</option>
                      <option value="true">Sim, precisa ser instalado</option>
                      <option value="false">Não pode ser instalado</option>
                    </select>
                  </div>
                )}

                {comendaForm.tipo_criterio === 'acumulo_comenda' && (
                  <>
                    <div>
                      <label style={sLabel}>Comenda Base *</label>
                      <select value={comendaForm.comenda_base_id} onChange={e => setComendaForm(f => ({ ...f, comenda_base_id: e.target.value }))} style={sInp}>
                        <option value="">Selecione...</option>
                        {comendas.filter(c => c.id !== editandoComendaId && c.tipo_criterio !== 'acumulo_comenda')
                          .map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={sLabel}>Entregas Necessárias da Base *</label>
                      <input type="number" min="1" value={comendaForm.qtd_necessaria} onChange={e => setComendaForm(f => ({ ...f, qtd_necessaria: e.target.value }))} style={sInp} />
                    </div>
                  </>
                )}

                {comendaForm.tipo_criterio === 'macom_100_acumulado' && (
                  <div>
                    <label style={sLabel}>Quantidade de Anos com 100% *</label>
                    <input type="number" min="1" value={comendaForm.qtd_necessaria} onChange={e => setComendaForm(f => ({ ...f, qtd_necessaria: e.target.value }))} style={sInp} />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
                {editandoComendaId && (
                  <button type="button" onClick={cancelarEdicaoComenda}
                    style={{ padding: '0.55rem 1.1rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: 600, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                )}
                <button type="submit"
                  style={{ padding: '0.55rem 1.4rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: 'pointer' }}>
                  {editandoComendaId ? '💾 Atualizar' : '💾 Cadastrar'}
                </button>
              </div>
            </form>
          )}

          <div style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
            {comendasVisiveis.map((c, idx) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1.1rem', borderBottom: idx < comendasVisiveis.length - 1 ? '1px solid var(--color-border)' : 'none', background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)', opacity: c.ativo ? 1 : 0.55 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text)', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                    {c.nome} {!c.ativo && '(inativa)'} <SeloOrigem origem={origemDe(c)} />
                  </p>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    {TIPOS_CRITERIO.find(t => t.value === c.tipo_criterio)?.label}
                    {c.tipo_criterio === 'acumulo_comenda' && ` — ${c.qtd_necessaria || 0}× ${comendas.find(b => b.id === c.comenda_base_id)?.nome || '(base não definida)'}`}
                  </p>
                </div>
                {podeEditar && (
                  <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                    <button onClick={() => iniciarEdicaoComenda(c)} title="Editar"
                      style={{ padding: '0.25rem 0.55rem', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', cursor: 'pointer' }}>✏️</button>
                    <button onClick={() => alternarAtivoComenda(c)} title={c.ativo ? 'Desativar' : 'Ativar'}
                      style={{ padding: '0.25rem 0.55rem', background: 'rgba(148,163,184,0.15)', color: '#64748b', border: '1px solid rgba(148,163,184,0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', cursor: 'pointer' }}>{c.ativo ? '⏸️' : '▶️'}</button>
                    <button onClick={() => excluirComenda(c.id)} title="Excluir"
                      style={{ padding: '0.25rem 0.55rem', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', cursor: 'pointer' }}>🗑️</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal de entrega ───────────────────────────────────────────── */}
      {modalEntrega && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setModalEntrega(null)}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', maxWidth: '420px', width: '100%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.3rem' }}>🎖️ Entregar Comenda</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>{modalEntrega.comenda.nome} → <strong style={{ color: 'var(--color-text)' }}>{modalEntrega.irmao.nome}</strong></p>
            {modalEntrega.comenda.tipo_criterio === 'presenca_100_anual' && modalEntrega.concedida_por === 'loja' && (
              <p style={{ fontSize: '0.75rem', color: '#10b981', margin: '-0.5rem 0 1rem', fontWeight: 600 }}>🔺 Entregue pela Loja — não conta para a Roldão.</p>
            )}

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={sLabel}>Data da Entrega *</label>
              <input type="date" value={entregaForm.data_entrega} onChange={e => setEntregaForm(f => ({ ...f, data_entrega: e.target.value }))} style={sInp} />
            </div>
            {modalEntrega.comenda.tipo_criterio === 'presenca_100_anual' && (
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={sLabel}>Ano de Referência *</label>
                <input type="number" value={entregaForm.ano_referencia} onChange={e => setEntregaForm(f => ({ ...f, ano_referencia: e.target.value }))} style={sInp} />
              </div>
            )}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={sLabel}>Observações</label>
              <input value={entregaForm.observacoes} onChange={e => setEntregaForm(f => ({ ...f, observacoes: e.target.value }))} style={sInp} />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setModalEntrega(null)}
                style={{ flex: 1, padding: '0.6rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={confirmarEntrega}
                style={{ flex: 2, padding: '0.6rem', background: modalEntrega.concedida_por === 'loja' && modalEntrega.comenda.tipo_criterio === 'presenca_100_anual' ? '#10b981' : '#c9a84c', color: '#1a1a1a', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: 'pointer' }}>
                {modalEntrega.concedida_por === 'loja' && modalEntrega.comenda.tipo_criterio === 'presenca_100_anual' ? '🔺 Confirmar Entrega pela Loja' : '🎖️ Confirmar Entrega'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de indicação (comenda manual) ─────────────────────────── */}
      {modalIndicacao && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setModalIndicacao(null)}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', maxWidth: '440px', width: '100%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.3rem' }}>➕ Indicar Irmão</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>{modalIndicacao.nome} — fica em Elegíveis até a entrega.</p>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={sLabel}>Irmão *</label>
              <select value={indicacaoForm.irmao_id} onChange={e => setIndicacaoForm(f => ({ ...f, irmao_id: e.target.value }))} style={sInp}>
                <option value="">Selecione...</option>
                {[...irmaos].sort((a, b) => a.nome.localeCompare(b.nome)).map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={sLabel}>Ano de Referência</label>
              <input type="number" value={indicacaoForm.ano_referencia} onChange={e => setIndicacaoForm(f => ({ ...f, ano_referencia: e.target.value }))} style={sInp} />
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={sLabel}>Observações</label>
              <input value={indicacaoForm.observacoes} onChange={e => setIndicacaoForm(f => ({ ...f, observacoes: e.target.value }))} style={sInp} placeholder="Ex.: Melhor Trabalho do ano" />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setModalIndicacao(null)}
                style={{ flex: 1, padding: '0.6rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={confirmarIndicacao}
                style={{ flex: 2, padding: '0.6rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: 'pointer' }}>
                ➕ Indicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de registro manual ───────────────────────────────────── */}
      {modalRegistro && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setModalRegistro(false)}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', maxWidth: '460px', width: '100%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '1rem' }}>➕ Registrar Entrega</h3>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={sLabel}>Irmão *</label>
              <select value={registroForm.irmao_id} onChange={e => setRegistroForm(f => ({ ...f, irmao_id: e.target.value }))} style={sInp}>
                <option value="">Selecione...</option>
                {[...irmaos].sort((a, b) => a.nome.localeCompare(b.nome)).map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={sLabel}>Comenda *</label>
              <select value={registroForm.comenda_id} onChange={e => setRegistroForm(f => ({ ...f, comenda_id: e.target.value }))} style={sInp}>
                <option value="">Selecione...</option>
                {ORIGENS.map(o => (
                  <optgroup key={o.value} label={o.label}>
                    {comendas.filter(c => c.ativo && origemDe(c) === o.value).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '0.75rem' }}>
              <div>
                <label style={sLabel}>Data da Entrega *</label>
                <input type="date" value={registroForm.data_entrega} onChange={e => setRegistroForm(f => ({ ...f, data_entrega: e.target.value }))} style={sInp} />
              </div>
              <div>
                <label style={sLabel}>Ano Ref.{comendaRegistro?.tipo_criterio === 'presenca_100_anual' ? ' *' : ''}</label>
                <input type="number" placeholder="Ex: 2024" value={registroForm.ano_referencia} onChange={e => setRegistroForm(f => ({ ...f, ano_referencia: e.target.value }))} style={sInp} />
              </div>
            </div>
            {comendaRegistro?.tipo_criterio === 'presenca_100_anual' && (
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={sLabel}>Concedida por *</label>
                <select value={registroForm.concedida_por} onChange={e => setRegistroForm(f => ({ ...f, concedida_por: e.target.value }))} style={sInp}>
                  <option value="grande_loja">Grande Loja (conta para a Roldão)</option>
                  <option value="loja">Loja (não conta para a Roldão)</option>
                  <option value="nao_entregue">Não entregue / retirado</option>
                </select>
              </div>
            )}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={sLabel}>Observações</label>
              <input value={registroForm.observacoes} onChange={e => setRegistroForm(f => ({ ...f, observacoes: e.target.value }))} style={sInp} />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setModalRegistro(false)}
                style={{ flex: 1, padding: '0.6rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={confirmarRegistro}
                style={{ flex: 2, padding: '0.6rem', background: '#c9a84c', color: '#1a1a1a', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: 'pointer' }}>
                💾 Registrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
