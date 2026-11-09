import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { ehAjusteInternoTronco } from '../financeiro/utils/ajusteTronco';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList
} from 'recharts';

const AZUL    = '#1e3a5f';
const DOURADO = '#c9a84c';
const VERDE   = '#10b981';
const LARANJA = '#f59e0b';
const ROXO    = '#8b5cf6';
const VERMELHO= '#ef4444';
const CORES   = [AZUL, DOURADO, VERDE, LARANJA, ROXO, VERMELHO, '#06b6d4', '#84cc16'];

const fmtR = (v) => 'R$ ' + Number(v||0).toLocaleString('pt-BR', {minimumFractionDigits:2,maximumFractionDigits:2});
const fmtP = (v) => Number(v||0).toFixed(1) + '%';
const MESES_ABR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const anoAtual = new Date().getFullYear();
const MESES_NOME = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_SEM = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const GRAU_SESSAO = {1:'Aprendiz', 2:'Companheiro', 3:'Mestre', 4:'Administrativa'};
// Classificação da sessão (mesmas cores do cadastro de sessões)
const COR_CLASSIFICACAO = {
  'Econômica':      ['rgba(16,185,129,0.12)', '#10b981', 'rgba(16,185,129,0.3)'],
  'Especial':       ['rgba(139,92,246,0.12)', '#8b5cf6', 'rgba(139,92,246,0.3)'],
  'Magna':          ['rgba(245,158,11,0.12)', '#f59e0b', 'rgba(245,158,11,0.3)'],
  'Extraordinária': ['rgba(239,68,68,0.12)',  '#ef4444', 'rgba(239,68,68,0.3)'],
};

// ── Card de indicador ────────────────────────────────────────────────────────
const Card = ({label, valor, sub, cor='var(--color-accent)', icon, compacto=false}) => (
  <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderTop:`3px solid ${cor}`,borderRadius:'var(--radius-lg)',padding:'1rem'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
      <div style={{minWidth:0}}>
        <p style={{fontSize:'0.68rem',fontWeight:700,color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.04em',margin:'0 0 0.3rem'}}>{label}</p>
        <p style={{fontSize: compacto ? 'clamp(1rem, 2.1vw, 1.3rem)' : '1.5rem', fontWeight:800,color:cor,margin:0,lineHeight:1.15,wordBreak:'break-word'}}>{valor}</p>
        {sub && <p style={{fontSize:'0.72rem',color:'var(--color-text-muted)',margin:'0.3rem 0 0'}}>{sub}</p>}
      </div>
      {icon && <span style={{fontSize:'1.6rem',opacity:0.7,flexShrink:0}}>{icon}</span>}
    </div>
  </div>
);

// ── Painel com título ────────────────────────────────────────────────────────
const Painel = ({titulo, children}) => (
  <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-xl)',overflow:'hidden',marginBottom:'1.25rem'}}>
    <div style={{padding:'0.75rem 1.25rem',background:'var(--color-surface-2)',borderBottom:'1px solid var(--color-border)',display:'flex',alignItems:'center',gap:'0.5rem'}}>
      <h3 style={{margin:0,fontWeight:700,fontSize:'0.95rem',color:'var(--color-accent)'}}>{titulo}</h3>
    </div>
    <div style={{padding:'1.25rem'}}>{children}</div>
  </div>
);

const GraficoVazio = () => (
  <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'200px',color:'var(--color-text-muted)',fontSize:'0.82rem'}}>
    Sem dados suficientes para exibir
  </div>
);

// Rótulo customizado do PieChart — precisa retornar um <text> válido (um <tspan>
// solto, sem <text> pai, não renderiza nada no SVG) e a cor precisa ser clara
// para ficar legível sobre o tema escuro.
const renderPieLabel = ({ cx, cy, midAngle, outerRadius, name, value }) => {
  const RADIAN = Math.PI / 180;
  const raio = outerRadius + 18;
  const x = cx + raio * Math.cos(-midAngle * RADIAN);
  const y = cy + raio * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" style={{ fill: 'var(--color-text)', fontSize: 12, fontWeight: 600 }}>
      {`${name}: ${value}`}
    </text>
  );
};

export default function Estatisticas({ grauUsuario, permissoes }) {
  const [anoSel, setAnoSel]   = useState(anoAtual);
  const [anosDisp, setAnosDisp] = useState([anoAtual]);
  const [loading, setLoading] = useState(true);

  // ── Estados de dados ─────────────────────────────────────────────────────
  const [irmaos,      setIrmaos]      = useState([]);
  const [sessoes,     setSessoes]     = useState([]);
  const [presencas,   setPresencas]   = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [categorias,  setCategorias]  = useState([]);
  const [comissoes,   setComissoes]   = useState([]);
  const [caridade,    setCaridade]    = useState([]);
  const [candidatos,  setCandidatos]  = useState([]);
  const [familias,    setFamilias]    = useState([]);
  const [comodatosAtivos, setComodatosAtivos] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [historicoSituacoes, setHistoricoSituacoes] = useState([]);
  const [sessoesMes, setSessoesMes] = useState([]);     // sessões do MÊS ATUAL (sempre, qualquer que seja o ano selecionado)
  const [presencasMes, setPresencasMes] = useState([]);
  const [saldoBancarioAtual, setSaldoBancarioAtual] = useState(null);

  const isMestre = !grauUsuario || ['mestre','mestre instalado','admin'].includes((grauUsuario||'').toLowerCase());

  // Buscar anos disponíveis nos dados (só uma vez)
  useEffect(() => {
    const buscarAnos = async () => {
      const [{ data: lanc }, { data: sess }] = await Promise.all([
        supabase.from('lancamentos_loja').select('data_pagamento').not('data_pagamento','is',null).limit(1000),
        supabase.from('sessoes_presenca').select('data_sessao').not('data_sessao','is',null).limit(1000),
      ]);
      const anos = new Set();
      (lanc||[]).forEach(l => { if(l.data_pagamento) anos.add(parseInt(l.data_pagamento.substring(0,4))); });
      (sess||[]).forEach(s => { if(s.data_sessao) anos.add(parseInt(s.data_sessao.substring(0,4))); });
      const lista = [...anos].filter(a=>a>=2020).sort((a,b)=>b-a);
      if (lista.length > 0) { setAnosDisp(lista); setAnoSel(lista[0]); }
    };
    buscarAnos();
  }, []);

  // Presença por sessão do mês atual — sempre o mês corrente, independente do ano selecionado
  useEffect(() => {
    const carregarMesAtual = async () => {
      try {
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mes = hoje.getMonth();
        const pad = (n) => String(n).padStart(2, '0');
        const ini = `${ano}-${pad(mes + 1)}-01`;
        const fim = `${ano}-${pad(mes + 1)}-${pad(new Date(ano, mes + 1, 0).getDate())}`;
        const { data: sess } = await supabase
          .from('sessoes_presenca').select('id,data_sessao,grau_sessao_id,classificacao_id,classificacoes_sessao:classificacao_id(nome)')
          .gte('data_sessao', ini).lte('data_sessao', fim).order('data_sessao');
        setSessoesMes(sess || []);

        const ids = (sess || []).map(x => x.id);
        let registros = [];
        if (ids.length > 0) {
          let de = 0;
          while (true) {
            const { data: lote } = await supabase
              .from('registros_presenca').select('sessao_id,membro_id,presente,justificativa')
              .in('sessao_id', ids).range(de, de + 999);
            registros = registros.concat(lote || []);
            if (!lote || lote.length < 1000) break;
            de += 1000;
          }
        }
        setPresencasMes(registros);
      } catch (e) { console.error('Erro ao carregar presença do mês atual:', e); }
    };
    carregarMesAtual();
  }, []);

  // Saldo Bancário atual — SEMPRE histórico completo (não filtra por ano
  // selecionado, é o saldo de hoje), mesma lógica do card "Saldo Bancário"
  // do Finanças da Loja: tudo que não é dinheiro físico nem tronco em
  // espécie, entra/sai do banco.
  useEffect(() => {
    const buscarSaldoBancario = async () => {
      let todos = [];
      let inicio = 0;
      const tamanhoPagina = 1000;
      let continuar = true;
      while (continuar) {
        const { data: lote } = await supabase
          .from('lancamentos_loja')
          .select('valor, tipo_pagamento, eh_transferencia_interna, categorias_financeiras(tipo, nome)')
          .eq('status', 'pago')
          .range(inicio, inicio + tamanhoPagina - 1);
        if (lote && lote.length > 0) {
          todos = [...todos, ...lote];
          inicio += tamanhoPagina;
          if (lote.length < tamanhoPagina) continuar = false;
        } else {
          continuar = false;
        }
      }

      const receitasBancarias = todos
        .filter(l =>
          l.categorias_financeiras?.tipo === 'receita' &&
          l.tipo_pagamento !== 'compensacao' &&
          l.tipo_pagamento !== 'dinheiro' &&
          !l.eh_transferencia_interna
        )
        .reduce((s, l) => s + parseFloat(l.valor), 0);

      const depositos = todos
        .filter(l =>
          l.categorias_financeiras?.tipo === 'receita' &&
          l.eh_transferencia_interna === true &&
          !l.categorias_financeiras?.nome?.toLowerCase().includes('tronco')
        )
        .reduce((s, l) => s + parseFloat(l.valor), 0);

      const despesasBancarias = todos
        .filter(l => {
          const isTroncoDinheiro = l.categorias_financeiras?.nome?.toLowerCase().includes('tronco') && l.tipo_pagamento === 'dinheiro';
          if (isTroncoDinheiro || ehAjusteInternoTronco(l)) return false; // Ajuste Interno Tronco não abate o banco da Loja
          return l.categorias_financeiras?.tipo === 'despesa' &&
            l.tipo_pagamento !== 'compensacao' &&
            l.tipo_pagamento !== 'dinheiro' &&
            !l.eh_transferencia_interna;
        })
        .reduce((s, l) => s + parseFloat(l.valor), 0);

      setSaldoBancarioAtual(receitasBancarias + depositos - despesasBancarias);
    };
    buscarSaldoBancario();
  }, []);

  useEffect(() => { carregarDados(); }, [anoSel]);

  const carregarDados = async () => {
    setLoading(true);
    // Limpar estados antes de buscar novo ano
    setSessoes([]);
    setPresencas([]);
    setLancamentos([]);
    setCaridade([]);
    try {
      const [
        {data: irmaosD},
        {data: sessoesD},
        {data: catD},
        {data: comissoesD},
        {data: caridadeD},
        {data: candidatosD},
        {data: familiasD},
        {data: comodatosD},
        {data: equipamentosD},
      ] = await Promise.all([
        supabase.from('irmaos').select('id,nome,situacao,data_iniciacao,data_elevacao,data_exaltacao,data_falecimento,mestre_instalado,data_nascimento,data_ingresso_loja').order('nome'),
        supabase.from('sessoes_presenca').select('id,data_sessao,grau_sessao_id').gte('data_sessao',`${anoSel}-01-01`).lte('data_sessao',`${anoSel}-12-31`).order('data_sessao'),
        supabase.from('categorias_financeiras').select('id,nome,tipo'),
        supabase.from('comissoes_integrantes').select('irmao_id,comissoes(status)'),
        supabase.from('ajudas_caridade').select('id,data_ajuda').gte('data_ajuda',`${anoSel}-01-01`).lte('data_ajuda',`${anoSel}-12-31`),
        supabase.from('sindicancia_candidatos').select('id,situacao,criado_em'),
        supabase.from('familias_carentes').select('id,ativa'),
        supabase.from('comodatos').select('id,beneficiario_id').eq('status','ativo'),
        supabase.from('equipamentos').select('id,status'),
      ]);

      // Lançamentos financeiros do ano — paginado (blocos de 1000), já que
      // uma loja com bom volume de lançamentos passa facilmente do limite
      // padrão do Supabase, causando receita/despesa mensal incompletas e
      // divergentes do Finanças da Loja (que já é paginado corretamente).
      let lancD = [];
      {
        let inicioLanc = 0;
        const tamanhoPaginaLanc = 1000;
        let continuarLanc = true;
        while (continuarLanc) {
          const { data: loteLanc } = await supabase
            .from('lancamentos_loja')
            .select('valor,tipo,status,data_pagamento,data_vencimento,categoria_id,tipo_pagamento,eh_transferencia_interna')
            .eq('status', 'pago')
            .gte('data_pagamento', `${anoSel}-01-01`)
            .lte('data_pagamento', `${anoSel}-12-31`)
            .range(inicioLanc, inicioLanc + tamanhoPaginaLanc - 1);
          if (loteLanc && loteLanc.length > 0) {
            lancD = [...lancD, ...loteLanc];
            inicioLanc += tamanhoPaginaLanc;
            if (loteLanc.length < tamanhoPaginaLanc) continuarLanc = false;
          } else {
            continuarLanc = false;
          }
        }
      }

      // Histórico de situações (licença, desligado, irregular, suspenso,
      // excluído, ex-ofício) — paginado, pois a tabela acumula anos de
      // histórico de todos os irmãos e pode passar do limite de 1000 linhas.
      let todoHistorico = [];
      {
        let inicioHist = 0;
        const tamanhoPaginaHist = 1000;
        let continuarHist = true;
        while (continuarHist) {
          const { data: loteHist } = await supabase
            .from('historico_situacoes')
            .select('membro_id,tipo_situacao,data_inicio,data_fim,status')
            .eq('status', 'ativa')
            .range(inicioHist, inicioHist + tamanhoPaginaHist - 1);
          if (loteHist && loteHist.length > 0) {
            todoHistorico = [...todoHistorico, ...loteHist];
            inicioHist += tamanhoPaginaHist;
            if (loteHist.length < tamanhoPaginaHist) continuarHist = false;
          } else {
            continuarHist = false;
          }
        }
      }
      setHistoricoSituacoes(todoHistorico);

      setIrmaos(irmaosD||[]);
      setCategorias(catD||[]);
      setComissoes(comissoesD||[]);
      setCandidatos(candidatosD||[]);
      setLancamentos(lancD||[]);
      setCaridade(caridadeD||[]);
      setFamilias(familiasD||[]);
      setComodatosAtivos(comodatosD||[]);
      setEquipamentos(equipamentosD||[]);

      const sessoesAno = sessoesD||[];
      setSessoes(sessoesAno);

      // Buscar presenças das sessões do ano ANTES de liberar o loading
      const ids = sessoesAno.map(s=>s.id);
      if (ids.length > 0) {
        // Paginar presencas para não perder dados em anos com muitas sessões
        let todasPresencas = [];
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const {data: presD} = await supabase
            .from('registros_presenca')
            .select('sessao_id,membro_id,presente,justificativa')
            .in('sessao_id', ids)
            .range(from, from + pageSize - 1);
          todasPresencas = todasPresencas.concat(presD||[]);
          if (!presD || presD.length < pageSize) break;
          from += pageSize;
        }
        setPresencas(todasPresencas);
      } else {
        setPresencas([]);
      }
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  // ── Cálculos derivados ────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const ativos = irmaos.filter(i => ['regular','licenciado'].includes((i.situacao||'').toLowerCase()));
    const regulares   = irmaos.filter(i=>(i.situacao||'').toLowerCase()==='regular').length;
    const licenciados = irmaos.filter(i=>(i.situacao||'').toLowerCase()==='licenciado').length;
    const irregulares = irmaos.filter(i=>(i.situacao||'').toLowerCase()==='irregular').length;
    const suspensos   = irmaos.filter(i=>(i.situacao||'').toLowerCase()==='suspenso').length;
    const desligados  = irmaos.filter(i=>(i.situacao||'').toLowerCase()==='desligado').length;
    const falecidos   = irmaos.filter(i=>(i.situacao||'').toLowerCase()==='falecido').length;

    const obterGrau = (i) => {
      if (!i.data_iniciacao) return 'Não Iniciado';
      if (i.mestre_instalado || i.data_exaltacao) return 'Mestre';
      if (i.data_elevacao) return 'Companheiro';
      return 'Aprendiz';
    };
    const porGrau = {Aprendiz:0,Companheiro:0,Mestre:0};
    ativos.forEach(i => { const g=obterGrau(i); if(porGrau[g]!==undefined) porGrau[g]++; });

    // Iniciações no ano
    const iniciadosAno = irmaos.filter(i=>i.data_iniciacao?.startsWith(String(anoSel))).length;
    const exaltadosAno = irmaos.filter(i=>i.data_exaltacao?.startsWith(String(anoSel))).length;
    const elevadosAno  = irmaos.filter(i=>i.data_elevacao?.startsWith(String(anoSel))).length;

    const totalAtivos = ativos.length;

    // ── Elegibilidade sessão-a-sessão — mesma lógica do relatório em PDF,
    // da Matrix de Presença, do Dashboard e do boletim por e-mail: grau na
    // data, data de entrada, falecimento e situação bloqueadora por data real
    // (sem nada fixo). REVERTIDO a pedido: licença e prerrogativa de idade
    // não excluem mais ninguém da conta — voltam a contar como elegível normal.
    const unaccentLower = (s) => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const elegivelNaData = (irmao, dataSessao, grauSessaoId) => {
      const grauMin = grauSessaoId === 4 ? 1 : grauSessaoId; // Administrativa tratada como Aprendiz
      let grauNaData = 1;
      if (irmao.data_exaltacao && dataSessao >= new Date(irmao.data_exaltacao)) grauNaData = 3;
      else if (irmao.data_elevacao && dataSessao >= new Date(irmao.data_elevacao)) grauNaData = 2;
      if (grauMin > grauNaData) return false;

      const dataEntrada = irmao.data_ingresso_loja ? new Date(irmao.data_ingresso_loja) :
                           (irmao.data_iniciacao ? new Date(irmao.data_iniciacao) : null);
      if (!dataEntrada || dataSessao < dataEntrada) return false;

      if (irmao.data_falecimento && dataSessao >= new Date(irmao.data_falecimento)) return false;

      const bloqueado = historicoSituacoes.some(sit => {
        if (sit.membro_id !== irmao.id) return false;
        const tipo = unaccentLower(sit.tipo_situacao);
        const tipos = ['desligado','desligamento','irregular','suspenso','excluido','ex-oficio']; // "licenca" removida a pedido
        const ehBloq = tipos.includes(tipo) || tipos.some(t=>tipo.includes(t));
        if (!ehBloq) return false;
        const di = new Date(sit.data_inicio + 'T00:00:00');
        if (dataSessao < di) return false;
        if (sit.data_fim) { const df = new Date(sit.data_fim + 'T00:00:00'); return dataSessao <= df; }
        return true;
      });
      if (bloqueado) return false;

      return true;
    };

    // Lookup rápido de presença por sessão+irmão
    const presMap = {};
    const justMap = {};
    presencas.forEach(p => {
      presMap[`${p.sessao_id}_${p.membro_id}`] = p.presente;
      justMap[`${p.sessao_id}_${p.membro_id}`] = p.justificativa;
    });

    // Presença por sessão — cada mês soma presenças/elegíveis considerando
    // SÓ quem estava realmente elegível naquela sessão específica (exclui
    // prerrogativa/licença/desligado/irregular/etc. por data real).
    const presencaMensal = Array.from({length:12},(_,m)=>({mes:MESES_ABR[m],sessoes:0,presentes:0,eleg:0,taxa:0}));
    const totaisIndividuaisAno = {};
    irmaos.forEach(i => { totaisIndividuaisAno[i.id] = { eleg: 0, pres: 0, faltas: 0, justificadas: 0 }; });

    sessoes.forEach(s=>{
      const mes = parseInt(s.data_sessao.substring(5, 7)) - 1; // 0=Jan, 11=Dez
      const dataSessao = new Date(s.data_sessao + 'T00:00:00');
      presencaMensal[mes].sessoes++;
      irmaos.forEach(i => {
        if (!elegivelNaData(i, dataSessao, s.grau_sessao_id)) return;
        presencaMensal[mes].eleg++;
        totaisIndividuaisAno[i.id].eleg++;
        const presente = !!presMap[`${s.id}_${i.id}`];
        if (presente) {
          presencaMensal[mes].presentes++;
          totaisIndividuaisAno[i.id].pres++;
        } else if (!justMap[`${s.id}_${i.id}`]) {
          // Falta só conta se NÃO tiver justificativa
          totaisIndividuaisAno[i.id].faltas++;
        } else {
          totaisIndividuaisAno[i.id].justificadas++;
        }
      });
    });
    presencaMensal.forEach(m => { m.taxa = m.eleg > 0 ? Math.round(m.presentes / m.eleg * 100) : 0; });

    // ── Presença por SESSÃO do mês atual (só sessões até hoje; mesma elegibilidade do gráfico mensal) ──
    const agora = new Date();
    const hojeStr = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}-${String(agora.getDate()).padStart(2,'0')}`;
    const presMapMes = {}; const justMapMes = {}; const sessoesComRegistro = new Set();
    presencasMes.forEach(p => {
      presMapMes[`${p.sessao_id}_${p.membro_id}`] = p.presente;
      justMapMes[`${p.sessao_id}_${p.membro_id}`] = p.justificativa;
      sessoesComRegistro.add(p.sessao_id);
    });
    const presencaSessoesMes = sessoesMes.filter(sm => sm.data_sessao <= hojeStr).map(sm => {
      const dataSessao = new Date(sm.data_sessao + 'T00:00:00');
      let eleg = 0, presentes = 0, justificados = 0;
      irmaos.forEach(i => {
        if (!elegivelNaData(i, dataSessao, sm.grau_sessao_id)) return;
        eleg++;
        if (presMapMes[`${sm.id}_${i.id}`]) presentes++;
        else if (justMapMes[`${sm.id}_${i.id}`]) justificados++;
      });
      return {
        id: sm.id, data: sm.data_sessao, grau: sm.grau_sessao_id,
        classificacao: (Array.isArray(sm.classificacoes_sessao) ? sm.classificacoes_sessao[0]?.nome : sm.classificacoes_sessao?.nome) || null,
        eleg, presentes, justificados, ausentes: eleg - presentes - justificados,
        taxa: eleg > 0 ? Math.round(presentes / eleg * 100) : 0,
        semRegistro: !sessoesComRegistro.has(sm.id),
      };
    });
    const comReg = presencaSessoesMes.filter(x => !x.semRegistro);
    const somaEleg = comReg.reduce((a, x) => a + x.eleg, 0);
    const taxaMesAtual = somaEleg > 0 ? Math.round(comReg.reduce((a, x) => a + x.presentes, 0) / somaEleg * 100) : 0;

    // Taxa geral do ano — MÉDIA DAS TAXAS INDIVIDUAIS de cada irmão (mesmo
    // método do relatório em PDF, do Dashboard "Média Presença" e do
    // boletim por e-mail), não soma ponderada por sessão.
    const taxasIndividuaisAno = Object.values(totaisIndividuaisAno)
      .filter(t => t.eleg > 0)
      .map(t => Math.round((t.pres / t.eleg) * 100));
    const taxaGeralAno = taxasIndividuaisAno.length > 0
      ? Math.round(taxasIndividuaisAno.reduce((s,t)=>s+t,0) / taxasIndividuaisAno.length)
      : 0;

    // Presença por grau — MÉDIA DAS TAXAS INDIVIDUAIS de cada irmão, agrupada
    // pelo grau ATUAL dele (sem sobreposição — cada pessoa conta uma única
    // vez, no seu próprio grau), igual ao Quadro 1 do relatório em PDF e ao
    // boletim por e-mail. Antes, esse gráfico calculava por SESSÃO (vaga),
    // o que fazia Mestres/M.I. (elegíveis pra quase todas as sessões)
    // inflarem a % de Aprendiz e Companheiro também, deixando as 3 barras
    // parecidas e sem diferenciação real.
    const gruposPorGrauIrmao = { Aprendiz: [], Companheiro: [], Mestre: [] };
    irmaos.forEach(i => {
      const t = totaisIndividuaisAno[i.id];
      if (!t || t.eleg === 0) return;
      const g = obterGrau(i);
      if (!gruposPorGrauIrmao[g]) return; // ignora "Não Iniciado"
      gruposPorGrauIrmao[g].push(Math.round((t.pres / t.eleg) * 100));
    });
    const graficoGrau = Object.entries(gruposPorGrauIrmao).map(([g, taxas]) => ({
      grau: g,
      taxa: taxas.length > 0 ? Math.round(taxas.reduce((s,t)=>s+t,0) / taxas.length) : 0
    }));

    // Presença por irmão (top/bottom)
    const calcIdade = (dataNasc) => {
      if (!dataNasc) return null;
      const nasc = new Date(dataNasc);
      const hoje = new Date();
      let idade = hoje.getFullYear() - nasc.getFullYear();
      if (hoje.getMonth() < nasc.getMonth() || (hoje.getMonth()===nasc.getMonth() && hoje.getDate()<nasc.getDate())) idade--;
      return idade;
    };

    // Presença por irmão (top/bottom) — reaproveita totaisIndividuaisAno
    // (já filtrado por elegibilidade real: grau na data, entrada,
    // falecimento, situação bloqueadora), em vez de contar toda sessão que
    // tenha registro, mesmo as que o grau do irmão nem participava.
    const presencaIrmao = {};
    ativos.forEach(i=>{
      const t = totaisIndividuaisAno[i.id] || { eleg: 0, pres: 0, faltas: 0, justificadas: 0 };
      presencaIrmao[i.id]={
        nome:i.nome, pres:t.pres, faltas:t.faltas, justificadas:t.justificadas, total:t.eleg,
        temPrerrogativa:(calcIdade(i.data_nascimento)||0) >= 70,
        licenciado:(i.situacao||'').toLowerCase()==='licenciado'
      };
    });
    const rankingPresenca = Object.values(presencaIrmao)
      .filter(i=>i.total>0)
      .map(i=>({...i,taxa:Math.round(i.pres/i.total*100), taxaFalta:Math.round(i.faltas/i.total*100), taxaJustificada:Math.round(i.justificadas/i.total*100)}))
      .sort((a,b)=> b.taxa-a.taxa || a.nome.localeCompare(b.nome));

    // Financeiro por mês
    const catMap = {};
    categorias.forEach(c=>{ catMap[c.id]=c; });
    const finMensal = Array.from({length:12},(_,m)=>({mes:MESES_ABR[m],receita:0,despesa:0,saldo:0}));
    let saldoAcum = 0;
    const saldoMensal = Array.from({length:12},(_,m)=>({mes:MESES_ABR[m],saldo:0}));

    lancamentos.forEach(l=>{
      if (!l.data_pagamento) return;
      const mes = parseInt(l.data_pagamento.substring(5, 7)) - 1; // 0=Jan, 11=Dez
      const cat = catMap[l.categoria_id];
      const valor = parseFloat(l.valor||0);
      if (cat?.tipo==='receita' && l.tipo_pagamento!=='compensacao' && !l.eh_transferencia_interna) {
        finMensal[mes].receita += valor;
      } else if (cat?.tipo==='despesa' && l.tipo_pagamento!=='compensacao' && !l.eh_transferencia_interna) {
        finMensal[mes].despesa += valor;
      }
    });
    finMensal.forEach((m,i)=>{ m.saldo=m.receita-m.despesa; });

    // Saldo acumulado
    finMensal.forEach((m,i)=>{ saldoAcum+=m.saldo; saldoMensal[i].saldo=Math.round(saldoAcum*100)/100; });
    const totalReceita = finMensal.reduce((s,m)=>s+m.receita,0);
    const totalDespesa = finMensal.reduce((s,m)=>s+m.despesa,0);

    // Receita por categoria
    const recCat = {};
    lancamentos.forEach(l=>{
      const cat = catMap[l.categoria_id];
      if (cat?.tipo==='receita' && l.tipo_pagamento!=='compensacao' && !l.eh_transferencia_interna) {
        const nome = cat.nome||'Outro';
        recCat[nome] = (recCat[nome]||0) + parseFloat(l.valor||0);
      }
    });
    const graficoRecCat = Object.entries(recCat).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([n,v])=>({nome:n.length>22?n.substring(0,20)+'…':n,valor:Math.round(v*100)/100}));

    // Inadimplência
    const inadimpMes = presencaMensal.map((m,i)=>({mes:m.mes,taxa:0}));
    // aproximação simples — usa lançamentos pendentes no mês de vencimento
    // (dado real de inadimplência precisaria de query separada)

    // Engajamento
    const irmaosEmComissao = new Set((comissoes||[]).filter(c=>c.comissoes?.status!=='encerrada').map(c=>c.irmao_id)).size;
    const percComissao = totalAtivos>0?Math.round(irmaosEmComissao/totalAtivos*100):0;

    // Sindicância
    const candAtivos   = (candidatos||[]).length;
    const candAprovados= (candidatos||[]).filter(c=>c.situacao==='aprovado').length;

    // Caridade — famílias
    const familiasTotal  = (familias||[]).length;
    const familiasAtivas = (familias||[]).filter(f=>f.ativa).length;

    // Comodatos — pessoas atendidas e equipamentos
    const pessoasComodato = new Set((comodatosAtivos||[]).map(c=>c.beneficiario_id)).size;
    const equipamentosTotal       = (equipamentos||[]).length;
    const equipamentosEmprestados = (equipamentos||[]).filter(e=>e.status==='emprestado').length;

    return {
      ativos:totalAtivos,regulares,licenciados,irregulares,suspensos,desligados,falecidos,
      porGrau,iniciadosAno,exaltadosAno,elevadosAno,
      presencaMensal,presencaSessoesMes,taxaMesAtual,taxaGeralAno,graficoGrau,rankingPresenca,
      finMensal,saldoMensal,totalReceita,totalDespesa,graficoRecCat,
      irmaosEmComissao,percComissao,caridade:(caridade||[]).length,
      candAtivos,candAprovados,
      familiasTotal,familiasAtivas,pessoasComodato,equipamentosTotal,equipamentosEmprestados,
    };
  }, [irmaos,sessoes,presencas,lancamentos,categorias,comissoes,caridade,candidatos,familias,comodatosAtivos,equipamentos,historicoSituacoes,sessoesMes,presencasMes,anoSel,loading]);

  const sBtn = (ativo) => ({
    padding:'0.35rem 0.9rem',borderRadius:'var(--radius-md)',border:'1px solid var(--color-border)',
    fontWeight:600,fontSize:'0.8rem',cursor:'pointer',
    background:ativo?AZUL:'var(--color-surface-2)',
    color:ativo?'#fff':'var(--color-text)',
  });

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'4rem',color:'var(--color-text-muted)'}}>
      ⏳ Carregando estatísticas...
    </div>
  );

  return (
    <div style={{padding:'1.5rem',background:'var(--color-bg)',minHeight:'100vh'}}>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem',flexWrap:'wrap',gap:'0.75rem'}}>
        <div>
          <h2 style={{margin:0,fontWeight:800,fontSize:'1.3rem',color:'var(--color-accent)'}}>📊 Estatísticas e Indicadores</h2>
          <p style={{margin:'0.2rem 0 0',fontSize:'0.8rem',color:'var(--color-text-muted)'}}>Visão consolidada da Loja — dados em tempo real</p>
        </div>
        <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
          <span style={{fontSize:'0.75rem',color:'var(--color-text-muted)',fontWeight:600}}>Ano:</span>
          <select value={anoSel} onChange={e=>setAnoSel(Number(e.target.value))}
            style={{padding:'0.35rem 0.75rem',borderRadius:'var(--radius-md)',border:'1px solid var(--color-border)',
              background:'var(--color-surface-2)',color:'var(--color-text)',fontSize:'0.85rem',fontWeight:600,cursor:'pointer'}}>
            {anosDisp.map(a=><option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          PAINEL 1 — QUADRO DE IRMÃOS
      ══════════════════════════════════════════════════════════════════════ */}
      <Painel titulo="👥 Quadro de Irmãos">
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'0.75rem',marginBottom:'1.25rem'}}>
          <Card label="Irmãos Ativos"   valor={stats.ativos}      sub={`${stats.regulares} reg. · ${stats.licenciados} lic.`} cor="var(--color-accent)"     icon="👥"/>
          <Card label={`Iniciados ${anoSel}`}  valor={stats.iniciadosAno}  sub="Novos Aprendizes"    cor={VERDE}    icon="⬆️"/>
          <Card label={`Elevados ${anoSel}`}   valor={stats.elevadosAno}   sub="Novos Companheiros"  cor={ROXO}     icon="📈"/>
          <Card label={`Exaltados ${anoSel}`}  valor={stats.exaltadosAno}  sub="Elevados a Mestre"   cor={DOURADO}  icon="⭐"/>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.25rem'}}>
          {/* Distribuição por situação */}
          <div>
            <p style={{fontWeight:700,fontSize:'0.82rem',color:'var(--color-accent)',marginBottom:'0.75rem'}}>Distribuição por Situação</p>
            {[
              {l:'Regular',v:stats.regulares,c:VERDE},
              {l:'Licenciado',v:stats.licenciados,c:'#3b82f6'},
              {l:'Irregular',v:stats.irregulares,c:LARANJA},
              {l:'Suspenso',v:stats.suspensos,c:VERMELHO},
              {l:'Quite Placet',v:stats.desligados,c:'#94a3b8'},
              {l:'Falecido',v:stats.falecidos,c:'#475569'},
            ].filter(i=>i.v>0).map(item=>(
              <div key={item.l} style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.4rem'}}>
                <div style={{width:'10px',height:'10px',borderRadius:'50%',background:item.c,flexShrink:0}}/>
                <span style={{fontSize:'0.8rem',flex:1,color:'var(--color-text)'}}>{item.l}</span>
                <span style={{fontWeight:700,fontSize:'0.85rem',color:item.c}}>{item.v}</span>
                <span style={{fontSize:'0.72rem',color:'var(--color-text-muted)',minWidth:'35px',textAlign:'right'}}>
                  {stats.ativos>0?Math.round(item.v/irmaos.length*100):0}%
                </span>
              </div>
            ))}
          </div>

          {/* Pizza por grau */}
          <div>
            <p style={{fontWeight:700,fontSize:'0.82rem',color:'var(--color-accent)',marginBottom:'0.75rem'}}>Distribuição por Grau (Ativos)</p>
            {stats.ativos > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={[
                    {name:'Aprendiz',value:stats.porGrau.Aprendiz},
                    {name:'Companheiro',value:stats.porGrau.Companheiro},
                    {name:'Mestre',value:stats.porGrau.Mestre},
                  ].filter(d=>d.value>0)} cx="45%" cy="50%" outerRadius={65} dataKey="value" label={renderPieLabel} labelLine={{ stroke: 'var(--color-text-muted)' }}>
                    {[DOURADO,AZUL,VERDE].map((c,i)=><Cell key={i} fill={c}/>)}
                  </Pie>
                  <Tooltip contentStyle={{background:'var(--color-surface-2)',border:'1px solid var(--color-border)',borderRadius:'8px',color:'var(--color-text)'}} itemStyle={{color:'var(--color-text)'}} labelStyle={{color:'var(--color-text)'}}/>
                </PieChart>
              </ResponsiveContainer>
            ) : <GraficoVazio/>}
          </div>
        </div>
      </Painel>

      {/* ══════════════════════════════════════════════════════════════════════
          PAINEL 2 — PRESENÇA
      ══════════════════════════════════════════════════════════════════════ */}
      <Painel titulo="📅 Presença nas Sessões">
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'0.75rem',marginBottom:'1.25rem'}}>
          <Card label="Taxa de Presença"    valor={fmtP(stats.taxaGeralAno)} sub={`Média do ano ${anoSel}`}              cor={stats.taxaGeralAno>=70?VERDE:stats.taxaGeralAno>=50?LARANJA:VERMELHO} icon="✅"/>
          <Card label="Sessões Realizadas"  valor={sessoes.length}            sub={`em ${anoSel}`}                        cor="var(--color-accent)"    icon="🏛️"/>
          <Card label="Irmãos Ativos"       valor={stats.ativos}              sub="Base de cálculo"                      cor="var(--color-accent)"    icon="👥"/>
          <Card label="Melhor Mês"          valor={stats.presencaMensal.filter(m=>m.sessoes>0).sort((a,b)=>b.taxa-a.taxa)[0]?.mes||'—'}
                sub={fmtP(Math.max(...stats.presencaMensal.map(m=>m.taxa)))} cor={VERDE} icon="🏆"/>
        </div>

        {/* Linha de presença mensal */}
        <div style={{marginBottom:'1.25rem'}}>
          <p style={{fontWeight:700,fontSize:'0.82rem',color:'var(--color-accent)',marginBottom:'0.75rem'}}>Taxa de Presença por Mês (%)</p>
          {(() => {
            // No ano vigente, exibe só até o mês atual — meses futuros ainda não
            // aconteceram e não devem aparecer na linha do gráfico.
            const presencaExibir = Number(anoSel) === anoAtual
              ? stats.presencaMensal.slice(0, new Date().getMonth() + 1)
              : stats.presencaMensal;
            return presencaExibir.some(m=>m.sessoes>0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={presencaExibir}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)"/>
                <XAxis dataKey="mes" tick={{fontSize:11,fill:'var(--color-text)'}}/>
                <YAxis domain={[0,100]} tick={{fontSize:11,fill:'var(--color-text)'}} unit="%"/>
                <Tooltip
                    contentStyle={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'8px'}}
                    labelStyle={{color:'var(--color-text)',fontWeight:700,fontSize:'0.8rem'}}
                    itemStyle={{color:'var(--color-text)',fontSize:'0.8rem'}}
                    formatter={(v)=>[fmtP(v),'Presença']}/>
                <Line type="monotone" dataKey="taxa" stroke={AZUL} strokeWidth={2} dot={{r:4,fill:AZUL}} activeDot={{r:6}}>
                  <LabelList dataKey="taxa" position="top" offset={10}
                    formatter={(v)=>`${v}%`}
                    style={{fontSize:11,fontWeight:700,fill:'var(--color-text)'}}/>
                </Line>
              </LineChart>
            </ResponsiveContainer>
            ) : <GraficoVazio/>;
          })()}
        </div>

        {/* Presença por sessão — mês atual (sempre o mês corrente) */}
        <div style={{marginBottom:'1.25rem',background:'var(--color-surface-2)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',padding:'1rem'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',flexWrap:'wrap',gap:'0.5rem',marginBottom:'0.75rem'}}>
            <p style={{fontWeight:700,fontSize:'0.82rem',color:'var(--color-accent)',margin:0}}>
              📆 Presença por Sessão — {MESES_NOME[new Date().getMonth()]} de {new Date().getFullYear()} (mês atual)
            </p>
            {stats.presencaSessoesMes.some(x => !x.semRegistro) && (
              <span style={{fontSize:'0.75rem',color:'var(--color-text-muted)'}}>
                Média do mês: <strong style={{color:'var(--color-text)'}}>{stats.taxaMesAtual}%</strong> · {stats.presencaSessoesMes.length} sessão(ões)
              </span>
            )}
          </div>
          {stats.presencaSessoesMes.length === 0 ? (
            <p style={{textAlign:'center',color:'var(--color-text-muted)',fontSize:'0.85rem',padding:'1rem 0',margin:0}}>
              Nenhuma sessão realizada em {MESES_NOME[new Date().getMonth()].toLowerCase()} até agora.
            </p>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(230px, 1fr))',gap:'0.75rem'}}>
              {stats.presencaSessoesMes.map(x => {
                const cor = x.taxa >= 70 ? VERDE : x.taxa >= 50 ? LARANJA : VERMELHO;
                const [, mm, dd] = x.data.split('-');
                const dia = DIAS_SEM[new Date(x.data + 'T00:00:00').getDay()];
                return (
                  <div key={x.id} style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderTop:`3px solid ${x.semRegistro ? 'var(--color-border)' : cor}`,borderRadius:'var(--radius-lg)',padding:'0.85rem'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'0.5rem'}}>
                      <span style={{fontWeight:700,fontSize:'0.85rem',color:'var(--color-text)'}}>{dd}/{mm} <span style={{fontWeight:500,color:'var(--color-text-muted)'}}>({dia})</span></span>
                      <div style={{display:'flex',gap:'0.3rem',flexWrap:'wrap',justifyContent:'flex-end'}}>
                        {x.classificacao && (() => {
                          const [bg, cor2, borda] = COR_CLASSIFICACAO[x.classificacao] || ['var(--color-surface-2)', 'var(--color-text-muted)', 'var(--color-border)'];
                          return (
                            <span style={{fontSize:'0.68rem',fontWeight:700,padding:'0.1rem 0.5rem',borderRadius:'999px',background:bg,color:cor2,border:`1px solid ${borda}`}}>
                              {x.classificacao}
                            </span>
                          );
                        })()}
                        <span style={{fontSize:'0.68rem',fontWeight:700,padding:'0.1rem 0.5rem',borderRadius:'999px',background:'var(--color-surface-2)',color:'var(--color-text-muted)',border:'1px solid var(--color-border)'}}>
                          {GRAU_SESSAO[x.grau] || 'Sessão'}
                        </span>
                      </div>
                    </div>
                    {x.semRegistro ? (
                      <p style={{margin:'0.6rem 0 0',fontSize:'0.8rem',color:'var(--color-text-muted)'}}>Sem registro de presença</p>
                    ) : (
                      <>
                        <p style={{margin:'0.5rem 0 0.35rem',fontSize:'1.6rem',fontWeight:800,color:cor,lineHeight:1.1}}>{x.taxa}%</p>
                        <div style={{height:'6px',borderRadius:'999px',background:'var(--color-border)',overflow:'hidden'}}>
                          <div style={{width:`${Math.min(100, x.taxa)}%`,height:'100%',background:cor}}/>
                        </div>
                        <p style={{margin:'0.5rem 0 0',fontSize:'0.72rem',color:'var(--color-text-muted)'}}>
                          ✅ {x.presentes} presentes · 📝 {x.justificados} justif. · ❌ {x.ausentes} ausentes
                        </p>
                        <p style={{margin:'0.1rem 0 0',fontSize:'0.68rem',color:'var(--color-text-muted)'}}>{x.eleg} irmãos aptos na sessão</p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Barras por grau + ranking */}
        <div style={{display:'grid',gridTemplateColumns: isMestre ? 'repeat(3,1fr)' : '1fr',gap:'1.25rem'}}>
          <div style={{background:'var(--color-surface-2)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',padding:'1rem'}}>
            <p style={{fontWeight:700,fontSize:'0.82rem',color:'var(--color-accent)',marginBottom:'0.75rem'}}>Taxa por Grau de Sessão</p>
            {stats.graficoGrau.length>0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={stats.graficoGrau} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)"/>
                  <XAxis type="number" domain={[0,100]} unit="%" tick={{fontSize:10}}/>
                  <YAxis type="category" dataKey="grau" tick={{fontSize:11,fill:'var(--color-text)'}} width={90}/>
                  <Tooltip
                    contentStyle={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'8px'}}
                    labelStyle={{color:'var(--color-text)',fontWeight:700,fontSize:'0.8rem'}}
                    itemStyle={{color:'var(--color-text)',fontSize:'0.8rem'}}
                    formatter={(v)=>[fmtP(v),'Presença']}/>
                  <Bar dataKey="taxa" fill={AZUL} radius={[0,4,4,0]}/>
                </BarChart>
              </ResponsiveContainer>
            ) : <GraficoVazio/>}
          </div>

          {isMestre && (
            <div style={{background:'var(--color-surface-2)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',padding:'1rem'}}>
              <p style={{fontWeight:700,fontSize:'0.82rem',color:'var(--color-accent)',marginBottom:'0.75rem'}}>🏆 Top 5 Mais Assíduos</p>
              {stats.rankingPresenca.slice(0,5).map((i,idx)=>(
                <div key={i.nome} style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.35rem'}}>
                  <span style={{fontWeight:700,fontSize:'0.75rem',color:DOURADO,minWidth:'18px'}}>{idx+1}º</span>
                  <span style={{flex:1,fontSize:'0.78rem',color:'var(--color-text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{i.nome}</span>
                  <span style={{fontWeight:700,fontSize:'0.8rem',color:VERDE}}>{fmtP(i.taxa)}</span>
                </div>
              ))}
            </div>
          )}

          {isMestre && (
            <div style={{background:'var(--color-surface-2)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',padding:'1rem'}}>
              <p style={{fontWeight:700,fontSize:'0.82rem',color:VERMELHO,marginBottom:'0.75rem'}}>⚠️ Top 5 Mais Faltosos</p>
              <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.4rem',paddingBottom:'0.3rem',borderBottom:'1px solid var(--color-border)'}}>
                <span style={{flex:1}}></span>
                <span style={{width:'52px',textAlign:'right',fontSize:'0.65rem',fontWeight:700,color:'var(--color-text-muted)',textTransform:'uppercase'}}>Justif.</span>
                <span style={{width:'52px',textAlign:'right',fontSize:'0.65rem',fontWeight:700,color:'var(--color-text-muted)',textTransform:'uppercase'}}>Ausência</span>
              </div>
              {stats.rankingPresenca
                .filter(i=>!i.temPrerrogativa && !i.licenciado)
                .slice(-5).reverse().map((i,idx)=>(
                <div key={i.nome} style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.35rem'}}>
                  <span style={{flex:1,fontSize:'0.78rem',color:'var(--color-text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{i.nome}</span>
                  <span style={{width:'52px',textAlign:'right',fontWeight:700,fontSize:'0.8rem',color:'#f59e0b'}}>{fmtP(i.taxaJustificada)}</span>
                  <span style={{width:'52px',textAlign:'right',fontWeight:700,fontSize:'0.8rem',color:VERMELHO}}>{fmtP(i.taxaFalta)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Painel>

      {/* ══════════════════════════════════════════════════════════════════════
          PAINEL 3 — FINANCEIRO
      ══════════════════════════════════════════════════════════════════════ */}
      <Painel titulo="💰 Financeiro">
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))',gap:'0.75rem',marginBottom:'1.25rem'}}>
          <Card compacto label={`Receitas ${anoSel}`}  valor={fmtR(stats.totalReceita)} sub="Entradas pagas"           cor={VERDE}    icon="📈"/>
          <Card compacto label={`Despesas ${anoSel}`}  valor={fmtR(stats.totalDespesa)} sub="Saídas pagas"             cor={VERMELHO} icon="📉"/>
          <Card compacto label="Resultado"         valor={fmtR(stats.totalReceita-stats.totalDespesa)} sub={stats.totalReceita>=stats.totalDespesa?'Superávit':'Déficit'} cor={stats.totalReceita>=stats.totalDespesa?VERDE:VERMELHO} icon="⚖️"/>
          <Card compacto label="Melhor Mês (Rec.)" valor={[...stats.finMensal].sort((a,b)=>b.receita-a.receita)[0]?.mes||'—'} sub={fmtR(Math.max(...stats.finMensal.map(m=>m.receita)))} cor="var(--color-accent)" icon="🏆"/>
          <Card compacto label="Saldo Bancário" valor={saldoBancarioAtual===null ? '...' : fmtR(saldoBancarioAtual)} sub="PIX, Transf., Cartão" cor="#0ea5e9" icon="🏦"/>
        </div>

        {/* Receita vs Despesa mensal */}
        <div style={{marginBottom:'1.25rem'}}>
          <p style={{fontWeight:700,fontSize:'0.82rem',color:'var(--color-accent)',marginBottom:'0.75rem'}}>Receita vs Despesa por Mês (R$)</p>
          {(() => {
            const finExibir = Number(anoSel) === anoAtual
              ? stats.finMensal.slice(0, new Date().getMonth() + 1)
              : stats.finMensal;
            return finExibir.some(m=>m.receita>0||m.despesa>0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={finExibir}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)"/>
                <XAxis dataKey="mes" tick={{fontSize:11,fill:'var(--color-text)'}}/>
                <YAxis tick={{fontSize:10,fill:'var(--color-text)'}} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`}/>
                <Tooltip
                    content={({active, payload, label}) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const receita = payload.find(p=>p.dataKey==='receita')?.value || 0;
                      const despesa = payload.find(p=>p.dataKey==='despesa')?.value || 0;
                      const saldo = receita - despesa;
                      return (
                        <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'8px',padding:'0.6rem 0.8rem'}}>
                          <p style={{color:'var(--color-text)',fontWeight:700,fontSize:'0.8rem',margin:'0 0 0.3rem'}}>{label}</p>
                          <p style={{color:VERDE,fontSize:'0.8rem',margin:'0.1rem 0'}}>Receita: {fmtR(receita)}</p>
                          <p style={{color:VERMELHO,fontSize:'0.8rem',margin:'0.1rem 0'}}>Despesa: {fmtR(despesa)}</p>
                          <p style={{color: saldo>=0?VERDE:VERMELHO,fontWeight:700,fontSize:'0.8rem',margin:'0.3rem 0 0',borderTop:'1px solid var(--color-border)',paddingTop:'0.3rem'}}>Saldo: {fmtR(saldo)}</p>
                        </div>
                      );
                    }}/>
                <Legend/>
                <Bar dataKey="receita" fill={VERDE}    name="Receita"  radius={[4,4,0,0]}/>
                <Bar dataKey="despesa" fill={VERMELHO} name="Despesa"  radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
            ) : <GraficoVazio/>;
          })()}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.25rem'}}>
          {/* Saldo acumulado */}
          <div>
            <p style={{fontWeight:700,fontSize:'0.82rem',color:'var(--color-accent)',marginBottom:'0.75rem'}}>Evolução do Saldo Acumulado</p>
            {(() => {
              const saldoExibir = Number(anoSel) === anoAtual
                ? stats.saldoMensal.slice(0, new Date().getMonth() + 1)
                : stats.saldoMensal;
              return saldoExibir.some(m=>m.saldo!==0) ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={saldoExibir}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)"/>
                  <XAxis dataKey="mes" tick={{fontSize:10}}/>
                  <YAxis tick={{fontSize:10}} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`}/>
                  <Tooltip
                    contentStyle={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'8px'}}
                    labelStyle={{color:'var(--color-text)',fontWeight:700,fontSize:'0.8rem'}}
                    itemStyle={{color:'var(--color-text)',fontSize:'0.8rem'}}
                    formatter={(v)=>[fmtR(v),'Saldo']}/>
                  <Line type="monotone" dataKey="saldo" stroke={DOURADO} strokeWidth={2} dot={false}/>
                </LineChart>
              </ResponsiveContainer>
              ) : <GraficoVazio/>;
            })()}
          </div>

          {/* Receita por categoria */}
          <div>
            <p style={{fontWeight:700,fontSize:'0.82rem',color:'var(--color-accent)',marginBottom:'0.75rem'}}>Receita por Categoria</p>
            {stats.graficoRecCat.length>0 ? (
              <ResponsiveContainer width="100%" height={Math.max(200, stats.graficoRecCat.length * 36)}>
                <BarChart data={stats.graficoRecCat} layout="vertical" margin={{left:0,right:16,top:4,bottom:4}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)"/>
                  <XAxis type="number" tick={{fontSize:9,fill:'var(--color-text)'}} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`}/>
                  <YAxis type="category" dataKey="nome" tick={{fontSize:9,fill:'var(--color-text)'}} width={140} tickLine={false}/>
                  <Tooltip
                    contentStyle={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'8px'}}
                    labelStyle={{color:'var(--color-text)',fontWeight:700,fontSize:'0.8rem'}}
                    itemStyle={{color:'var(--color-text)',fontSize:'0.8rem'}}
                    formatter={(v)=>[fmtR(v),'Valor']}
                  />
                  <Bar dataKey="valor" radius={[0,4,4,0]}>
                    {stats.graficoRecCat.map((_,i)=><Cell key={i} fill={CORES[i%CORES.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <GraficoVazio/>}
          </div>
        </div>
      </Painel>

      {/* ══════════════════════════════════════════════════════════════════════
          PAINEL 4 — ENGAJAMENTO
      ══════════════════════════════════════════════════════════════════════ */}
      <Painel titulo="🤝 Engajamento e Atividades">
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.75rem'}}>
          <Card label="Em Comissões"   valor={stats.irmaosEmComissao} sub={`${stats.percComissao}% dos ativos`}         cor={ROXO}   icon="👥"/>
          <Card label="Ações Caridade" valor={stats.caridade}          sub={`registradas em ${anoSel}`}                  cor={VERDE}  icon="❤️"/>
          <Card label="Candidatos"     valor={stats.candAtivos}         sub="total cadastrado na sindicância"             cor="var(--color-accent)"   icon="🔍"/>
        </div>
      </Painel>

      {/* ══════════════════════════════════════════════════════════════════════
          PAINEL 5 — CARIDADE E COMODATOS
      ══════════════════════════════════════════════════════════════════════ */}
      <Painel titulo="❤️ Caridade e Comodatos">
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'0.75rem'}}>
          <Card label="Famílias Atendidas"    valor={stats.familiasTotal}          sub={`${stats.familiasAtivas} ativa(s)`}                cor={VERDE}  icon="👨‍👩‍👧‍👦"/>
          <Card label="Famílias Ativas"       valor={stats.familiasAtivas}         sub="recebendo apoio atualmente"                        cor={VERMELHO} icon="❤️"/>
          <Card label="Pessoas em Comodato"   valor={stats.pessoasComodato}        sub="beneficiários com empréstimo ativo"                cor="var(--color-accent)"   icon="🧑‍🤝‍🧑"/>
          <Card label="Equipamentos Emprestados" valor={stats.equipamentosEmprestados} sub={`de ${stats.equipamentosTotal} cadastrado(s)`} cor={DOURADO} icon="🦽"/>
        </div>
      </Painel>

      {/* Rodapé */}
      <div style={{textAlign:'center',padding:'1rem',color:'var(--color-text-muted)',fontSize:'0.72rem'}}>
        Dados calculados em tempo real do banco de dados · Ano selecionado: {anoSel}
      </div>
    </div>
  );
}
