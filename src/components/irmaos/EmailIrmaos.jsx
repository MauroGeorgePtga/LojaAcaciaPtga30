import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

// ── Helpers ───────────────────────────────────────────────────────────────────
const TIPOS = [
  { id: 'resumo_individual',   label: 'Resumo Individual',   emoji: '📋', desc: 'Financeiro, presença, comissões e eventos de cada irmão' },
  { id: 'aniversariantes',     label: 'Aniversariantes',     emoji: '🎂', desc: 'Lista semanal enviada ao Venerável e Chanceler' },
  { id: 'lembrete_financeiro', label: 'Lembrete Financeiro', emoji: '⚠️', desc: 'Apenas irmãos com saldo devedor' },
  { id: 'cronograma_mes',      label: 'Cronograma do Mês',   emoji: '📅', desc: 'Eventos do mês selecionado enviados aos irmãos' },
  { id: 'vencimento_licencas', label: 'Vencimento de Licenças', emoji: '🗓️', desc: 'Situações com data final a vencer: Venerável, Secretário, Orador e Admin' },
  { id: 'boletim_mensal',      label: 'Boletim Mensal',      emoji: '📊', desc: 'Indicadores gerais da Loja: quadro, presença, financeiro e próximos eventos' },
];

const FREQ = [
  { id: 'semanal',   label: 'Semanal' },
  { id: 'quinzenal', label: 'Quinzenal' },
  { id: 'mensal',    label: 'Mensal' },
];

const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const OPCOES_CONTEUDO = [
  { id: 'financeiro',  label: '💰 Financeiro' },
  { id: 'presenca',    label: '📊 Presença' },
  { id: 'comissoes',   label: '👥 Comissões' },
  { id: 'eventos',     label: '🎉 Eventos do mês' },
  { id: 'cronograma',  label: '📅 Cronograma do mês' },
];

const MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const GRAU_LABEL = { 1: 'Aprendiz', 2: 'Companheiro', 3: 'Mestre', 4: 'Evento Loja' };
const TIPO_LABEL = { sessao: 'Sessão', trabalho_irmao: 'Trabalho', instrucao: 'Instrução',
  sessao_magna: 'Sessão Magna', sessao_posse: 'Sessão de Posse', sessao_instalacao: 'Instalação',
  evento_externo: 'Evento Externo', outro: 'Outro' };
const MESES_ABR_FE = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export default function EmailIrmaos({ showSuccess, showError, permissoes }) {
  const podeEnviarEmail = permissoes?.canEditFinancial || permissoes?.canManageUsers || false;
  const [aba, setAba] = useState('manual');
  const [irmaos, setIrmaos] = useState([]);
  const [irmaosSelec, setIrmaosSelec] = useState([]);
  const [tipoSelec, setTipoSelec] = useState('resumo_individual');
  const [opcoesConteudo, setOpcoesConteudo] = useState({ financeiro: true, presenca: true, comissoes: true, eventos: true, cronograma: false });
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [salvandoConfig, setSalvandoConfig] = useState(null);
  const [modalConfig, setModalConfig] = useState(null);
  const [formConfig, setFormConfig] = useState({ ativo: false, frequencia: 'mensal', dia_semana: 1, dia_mes: 1, hora: 8 });
  const [irmaosConfigSelec, setIrmaosConfigSelec] = useState([]);
  const [opcoesConfig, setOpcoesConfig] = useState({ financeiro: true, presenca: true, comissoes: true, eventos: true, cronograma: false });
  const [filtroBuscaConfig, setFiltroBuscaConfig] = useState('');
  const [filtroBusca, setFiltroBusca] = useState('');
  const [periodoDados, setPeriodoDados] = useState('geral');
  const [periodoDadosConfig, setPeriodoDadosConfig] = useState('geral');

  // ── Cronograma ──────────────────────────────────────────────────────────────
  const [mesesComRegistros, setMesesComRegistros] = useState([]); // [{ valor: '2026-04', label: 'Abril 2026' }]
  const [mesCronograma, setMesCronograma] = useState('');         // '2026-04'
  const [loadingMeses, setLoadingMeses] = useState(false);
  const [eventosCronograma, setEventosCronograma] = useState([]);
  const [eventosDestaque, setEventosDestaque] = useState([]);

  // ── Carregar dados ──────────────────────────────────────────────────────────
  useEffect(() => {
    carregarIrmaos();
    carregarConfigs();
    carregarLogs();
  }, []);

  useEffect(() => {
    if (tipoSelec === 'cronograma_mes') {
      carregarMesesCronograma();
      // Se já tinha mês selecionado, recarrega eventos imediatamente
      if (mesCronograma) carregarEventosCronograma(mesCronograma);
    } else if (tipoSelec === 'boletim_mensal') {
      // Boletim Mensal é retrospectivo (presença, financeiro etc. já
      // consolidados) — o mês atual ainda não terminou, então o padrão
      // deve ser sempre o mês ANTERIOR, nunca o próximo.
      const hoje = new Date();
      const mesAnt = hoje.getMonth() === 0 ? 12 : hoje.getMonth();
      const anoAnt = hoje.getMonth() === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear();
      setMesCronograma(`${anoAnt}-${String(mesAnt).padStart(2, '0')}`);
      setEventosCronograma([]);
      setEventosDestaque([]);
    } else {
      setEventosCronograma([]);
      setEventosDestaque([]);
    }
  }, [tipoSelec]);

  useEffect(() => {
    if (mesCronograma && tipoSelec === 'cronograma_mes') carregarEventosCronograma(mesCronograma);
  }, [mesCronograma]);

  const carregarIrmaos = async () => {
    const { data } = await supabase
      .from('irmaos')
      .select('id, nome, email, situacao, cim')
      .not('email', 'is', null)
      .neq('email', '')
      .in('situacao', ['regular', 'licenciado'])
      .order('nome');
    setIrmaos(data || []);
  };

  const carregarMesesCronograma = async () => {
    setLoadingMeses(true);
    const anoAtual = new Date().getFullYear();
    const { data } = await supabase
      .from('cronograma')
      .select('data_evento')
      .gte('data_evento', `${anoAtual}-01-01`)
      .lte('data_evento', `${anoAtual}-12-31`)
      .order('data_evento', { ascending: true });

    // Extrair meses únicos
    const mesesUnicos = [...new Set((data || []).map(e => e.data_evento.substring(0, 7)))];
    const lista = mesesUnicos.map(m => {
      const [ano, mes] = m.split('-');
      return { valor: m, label: `${MESES_NOMES[parseInt(mes) - 1]} ${ano}` };
    });
    setMesesComRegistros(lista);

    // Pré-selecionar o próximo mês se existir, senão o primeiro disponível
    if (lista.length > 0 && !mesCronograma) {
      const proximoMes = String(new Date().getMonth() + 2).padStart(2, '0');
      const proximoAno = new Date().getFullYear();
      const chaveProximo = `${proximoAno}-${proximoMes}`;
      const encontrado = lista.find(l => l.valor === chaveProximo);
      setMesCronograma(encontrado ? chaveProximo : lista[0].valor);
    } else if (lista.length > 0 && mesCronograma) {
      // Mês já selecionado, só recarrega eventos
      carregarEventosCronograma(mesCronograma);
    }
    setLoadingMeses(false);
  };

  const carregarEventosCronograma = async (mes) => {
    if (!mes) return;
    const [ano, m] = mes.split('-');
    const ultimoDia = new Date(parseInt(ano), parseInt(m), 0).getDate();
    const { data } = await supabase
      .from('cronograma')
      .select('id, titulo, tipo, data_evento, hora_inicio, grau_sessao_id')
      .gte('data_evento', `${mes}-01`)
      .lte('data_evento', `${mes}-${String(ultimoDia).padStart(2,'0')}`)
      .order('data_evento', { ascending: true });
    setEventosCronograma(data || []);
    setEventosDestaque([]); // limpar destaques ao trocar mês
  };

  const carregarConfigs = async () => {
    setLoadingConfigs(true);
    const { data } = await supabase.from('config_email_automatico').select('*').order('tipo');
    setConfigs(data || []);
    setLoadingConfigs(false);
  };

  const carregarLogs = async () => {
    const { data } = await supabase
      .from('log_email_irmao')
      .select('*')
      .order('enviado_em', { ascending: false })
      .limit(50);
    setLogs(data || []);
  };

  // ── Selecionar irmãos ───────────────────────────────────────────────────────
  const toggleIrmao = (id) => {
    setIrmaosSelec(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selecionarTodos = () => {
    const filtrados = irmaos.filter(i => i.nome.toLowerCase().includes(filtroBusca.toLowerCase()));
    if (irmaosSelec.length === filtrados.length) setIrmaosSelec([]);
    else setIrmaosSelec(filtrados.map(i => i.id));
  };

  // ── Envio manual ────────────────────────────────────────────────────────────
  const enviarManual = async () => {
    if (!podeEnviarEmail) { showError('Você não tem permissão para enviar e-mails.'); return; }
    if (tipoSelec === 'resumo_individual' && irmaosSelec.length === 0) {
      showError('Selecione ao menos um irmão.'); return;
    }
    if (tipoSelec === 'lembrete_financeiro' && irmaosSelec.length === 0) {
      showError('Selecione ao menos um irmão.'); return;
    }
    if (tipoSelec === 'cronograma_mes' && !mesCronograma) {
      showError('Selecione um mês do cronograma.'); return;
    }
    if (tipoSelec === 'cronograma_mes' && irmaosSelec.length === 0) {
      showError('Selecione ao menos um irmão.'); return;
    }

    setEnviando(true);
    setResultados([]);
    try {
      if (tipoSelec === 'vencimento_licencas') {
        const { data: jsonV, error: fnErrorV } = await supabase.functions.invoke('avisar-vencimento-licencas', {
          body: { modo: 'manual' },
        });
        if (fnErrorV) throw fnErrorV;
        if (!jsonV?.ok) throw new Error(jsonV?.erro || 'Erro desconhecido');
        setResultados(jsonV.resultados || []);
        const enviadosV = (jsonV.resultados || []).filter(r => r.status === 'enviado').length;
        if (!jsonV.total_situacoes) showSuccess('Nenhuma situação vencendo no momento. Nenhum e-mail enviado.');
        else showSuccess('Aviso enviado para ' + enviadosV + ' destinatario(s)!');
        carregarLogs();
        return;
      }
      if (tipoSelec === 'boletim_mensal') {
        const { data: jsonB, error: fnErrorB } = await supabase.functions.invoke('enviar-boletim-mensal', {
          body: { acao: 'boletim_mensal', mes_ref: mesCronograma || '', irmaos_ids: irmaosSelec.length > 0 ? irmaosSelec : undefined },
        });
        if (fnErrorB) throw fnErrorB;
        if (!jsonB?.ok) throw new Error(jsonB?.erro || 'Erro desconhecido');
        setResultados(jsonB.resultados || []);
        const enviadosB = (jsonB.resultados || []).filter(r => r.status === 'enviado').length;
        showSuccess('Boletim enviado para ' + enviadosB + ' irmao(s)!');
        carregarLogs();
        return;
      }
      const { data: json, error: fnError } = await supabase.functions.invoke('enviar-email-irmao', {
        body: {
          acao: tipoSelec,
          irmaos_ids: irmaosSelec,
          opcoes: { ...opcoesConteudo, periodo_dados: periodoDados },
          mes_cronograma: mesCronograma,
          destaques_ids: eventosDestaque,
        },
      });
      if (fnError) throw fnError;
      if (!json?.ok) throw new Error(json?.erro || 'Erro desconhecido');
      setResultados(json.resultados || []);
      const enviados = (json.resultados || []).filter(r => r.status === 'enviado').length;
      showSuccess(`✅ ${enviados} e-mail(s) enviado(s) com sucesso!`);
      carregarLogs();
    } catch (e) {
      showError('Erro ao enviar: ' + e.message);
    } finally {
      setEnviando(false);
    }
  };

  // ── Salvar configuração automática ─────────────────────────────────────────
  const salvarConfig = async () => {
    if (!modalConfig) return;
    setSalvandoConfig(modalConfig);
    try {
      const existente = configs.find(c => c.tipo === modalConfig);
      if (existente) {
        await supabase.from('config_email_automatico').update({ ...formConfig, tipo: modalConfig, irmaos_ids: irmaosConfigSelec, opcoes_conteudo: opcoesConfig }).eq('id', existente.id);
      } else {
        await supabase.from('config_email_automatico').insert([{ ...formConfig, tipo: modalConfig, irmaos_ids: irmaosConfigSelec, opcoes_conteudo: opcoesConfig }]);
      }
      showSuccess('✅ Configuração salva!');
      carregarConfigs();
      setModalConfig(null);
    } catch (e) {
      showError('Erro: ' + e.message);
    } finally {
      setSalvandoConfig(null);
    }
  };

  const abrirModalConfig = (tipo) => {
    const existente = configs.find(c => c.tipo === tipo);
    if (existente) {
      setFormConfig({ ativo: existente.ativo, frequencia: existente.frequencia || 'mensal', dia_semana: existente.dia_semana || 1, dia_mes: existente.dia_mes || 1, hora: existente.hora ?? 8 });
      setIrmaosConfigSelec(existente.irmaos_ids || []);
      setOpcoesConfig(existente.opcoes_conteudo || { financeiro: true, presenca: true, comissoes: true, eventos: true, cronograma: false });
    } else {
      setFormConfig({ ativo: false, frequencia: 'mensal', dia_semana: 1, dia_mes: 1, hora: 8 });
      setIrmaosConfigSelec([]);
      setOpcoesConfig({ financeiro: true, presenca: true, comissoes: true, eventos: true, cronograma: false });
    }
    setFiltroBuscaConfig('');
    setModalConfig(tipo);
  };

  const toggleAtivacao = async (tipo) => {
    const existente = configs.find(c => c.tipo === tipo);
    if (!existente) { abrirModalConfig(tipo); return; }
    await supabase.from('config_email_automatico').update({ ativo: !existente.ativo }).eq('id', existente.id);
    carregarConfigs();
    showSuccess(existente.ativo ? '⏸ Agendamento pausado.' : '▶ Agendamento ativado.');
  };

  // ── Estilos ─────────────────────────────────────────────────────────────────
  const sInput = { background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '100%' };
  const sCard = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.25rem' };
  const sCardSel = (sel) => ({ ...sCard, borderColor: sel ? 'var(--color-accent)' : 'var(--color-border)', background: sel ? 'var(--color-accent-bg)' : 'var(--color-surface)', cursor: 'pointer' });

  const irmaosVisiveis = irmaos.filter(i => i.nome.toLowerCase().includes(filtroBusca.toLowerCase()));
  const semSelecao = tipoSelec === 'aniversariantes' || tipoSelec === 'vencimento_licencas';

  // Rótulo do mês selecionado
  const labelMesSel = mesesComRegistros.find(m => m.valor === mesCronograma)?.label || '';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '1.5rem', background: 'var(--color-bg)', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* Cabeçalho */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text)', margin: 0 }}>📧 E-mails para Irmãos</h2>
        <p style={{ color: 'var(--color-text-muted)', marginTop: '0.25rem', fontSize: '0.875rem' }}>Envio manual e agendado de informações personalizadas</p>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0' }}>
        {[{ id: 'manual', label: '📤 Envio Manual' }, { id: 'automatico', label: '⏰ Automático' }, { id: 'historico', label: '📋 Histórico' }]
          .filter(a => a.id !== 'automatico' || podeEnviarEmail)
          .map(a => (
          <button key={a.id} onClick={() => setAba(a.id)}
            style={{ padding: '0.6rem 1.25rem', fontWeight: '600', fontSize: '0.875rem', border: 'none', cursor: 'pointer', borderBottom: aba === a.id ? '3px solid var(--color-accent)' : '3px solid transparent', background: 'transparent', color: aba === a.id ? 'var(--color-accent)' : 'var(--color-text-muted)', borderRadius: '0', marginBottom: '-1px' }}>
            {a.label}
          </button>
        ))}
      </div>

      {/* ── ABA: MANUAL ──────────────────────────────────────────────────────── */}
      {aba === 'manual' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

          {/* Coluna esquerda: Tipo + Opções */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Tipo de envio */}
            <div style={sCard}>
              <p style={{ fontWeight: '700', color: 'var(--color-text)', marginBottom: '0.75rem', fontSize: '0.95rem' }}>1. Tipo de envio</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {TIPOS.map(t => (
                  <div key={t.id} onClick={() => setTipoSelec(t.id)} style={sCardSel(tipoSelec === t.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>{t.emoji}</span>
                      <div>
                        <p style={{ fontWeight: '600', color: tipoSelec === t.id ? 'var(--color-accent)' : 'var(--color-text)', margin: 0, fontSize: '0.875rem' }}>{t.label}</p>
                        <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '0.75rem' }}>{t.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Opções de conteúdo (só para resumo individual) */}
            {tipoSelec === 'resumo_individual' && (
              <div style={sCard}>
                <p style={{ fontWeight: '700', color: 'var(--color-text)', marginBottom: '0.75rem', fontSize: '0.95rem' }}>2. Conteúdo do e-mail</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {OPCOES_CONTEUDO.map(o => (
                    <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem', borderRadius: 'var(--radius-md)', background: opcoesConteudo[o.id] ? 'var(--color-accent-bg)' : 'var(--color-surface-2)', border: '1px solid ' + (opcoesConteudo[o.id] ? 'var(--color-accent)' : 'var(--color-border)') }}>
                      <input type="checkbox" checked={opcoesConteudo[o.id]} onChange={() => setOpcoesConteudo(p => ({ ...p, [o.id]: !p[o.id] }))} style={{ accentColor: 'var(--color-accent)' }} />
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text)', fontWeight: '600' }}>{o.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Seletor de mês — cronograma */}
            {tipoSelec === 'cronograma_mes' && (
              <>
                <div style={sCard}>
                  <p style={{ fontWeight: '700', color: 'var(--color-text)', marginBottom: '0.75rem', fontSize: '0.95rem' }}>2. Mês do cronograma</p>
                  {loadingMeses ? (
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Carregando meses...</p>
                  ) : mesesComRegistros.length === 0 ? (
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      ⚠️ Nenhum evento cadastrado no cronograma para o ano atual.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {mesesComRegistros.map(m => (
                        <div key={m.valor} onClick={() => setMesCronograma(m.valor)}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.9rem', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                            background: mesCronograma === m.valor ? 'var(--color-accent-bg)' : 'var(--color-surface-2)',
                            border: '1px solid ' + (mesCronograma === m.valor ? 'var(--color-accent)' : 'var(--color-border)') }}>
                          <span style={{ fontSize: '1.1rem' }}>📅</span>
                          <span style={{ fontWeight: '600', fontSize: '0.875rem', color: mesCronograma === m.valor ? 'var(--color-accent)' : 'var(--color-text)' }}>
                            {m.label}
                          </span>
                          {mesCronograma === m.valor && (
                            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-accent)' }}>✓ Selecionado</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Seletor de destaques */}
                {eventosCronograma.length > 0 && (
                  <div style={sCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <p style={{ fontWeight: '700', color: 'var(--color-text)', margin: 0, fontSize: '0.95rem' }}>
                        3. Eventos em destaque
                        {eventosDestaque.length > 0 && (
                          <span style={{ marginLeft: '0.5rem', background: '#f59e0b', color: '#fff', borderRadius: '999px', padding: '1px 8px', fontSize: '0.7rem', fontWeight: '700' }}>
                            {eventosDestaque.length} ⭐
                          </span>
                        )}
                      </p>
                      {eventosDestaque.length > 0 && (
                        <button onClick={() => setEventosDestaque([])}
                          style={{ padding: '0.2rem 0.6rem', background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.72rem', cursor: 'pointer' }}>
                          Limpar
                        </button>
                      )}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0 0 0.6rem' }}>
                      Eventos marcados aparecem em destaque no topo do e-mail.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {eventosCronograma.map(ev => {
                        const sel = eventosDestaque.includes(ev.id);
                        const [,eMes,eDia] = ev.data_evento.split('-');
                        const mesAbr = MESES_ABR_FE[parseInt(eMes)-1];
                        const grauLabel = GRAU_LABEL[ev.grau_sessao_id];
                        const tipoLabel = TIPO_LABEL[ev.tipo] || ev.tipo;
                        return (
                          <div key={ev.id} onClick={() => setEventosDestaque(p => p.includes(ev.id) ? p.filter(x => x !== ev.id) : [...p, ev.id])}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.7rem', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                              background: sel ? 'rgba(245,158,11,0.12)' : 'var(--color-surface-2)',
                              border: '1px solid ' + (sel ? '#f59e0b' : 'var(--color-border)'),
                              transition: 'all 0.15s' }}>
                            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{sel ? '⭐' : '☆'}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontWeight: '600', fontSize: '0.8rem', color: sel ? '#92400e' : 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {ev.titulo}
                              </p>
                              <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                {eDia}/{mesAbr} · {tipoLabel}{grauLabel ? ` · ${grauLabel}` : ''}{ev.hora_inicio ? ` · ${ev.hora_inicio.substring(0,5)}` : ''}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Info para aniversariantes */}
            {tipoSelec === 'aniversariantes' && (
              <div style={{ ...sCard, background: 'var(--color-accent-bg)', borderColor: 'var(--color-accent)' }}>
                <p style={{ color: 'var(--color-text)', margin: 0, fontSize: '0.875rem' }}>
                  ℹ️ O e-mail de aniversariantes é enviado automaticamente para o <strong>Venerável Mestre</strong> e o <strong>Chanceler</strong> cadastrados no sistema.
                </p>
              </div>
            )}

            {/* Info para vencimento de licenças */}
            {tipoSelec === 'vencimento_licencas' && (
              <div style={{ ...sCard, background: 'var(--color-accent-bg)', borderColor: 'var(--color-accent)' }}>
                <p style={{ color: 'var(--color-text)', margin: 0, fontSize: '0.875rem' }}>
                  ℹ️ Envia a lista de licenças e situações com data final que vencem em até <strong>10 dias</strong> (ou já vencidas e ainda não encerradas) para o <strong>Venerável</strong>, <strong>Secretário</strong>, <strong>Orador</strong> e <strong>Administrador</strong>. O envio automático (10 dias, 3 dias, no dia e lembrete semanal das vencidas não encerradas) roda todo dia pelo pg_cron.
                </p>
              </div>
            )}

            {/* Botão enviar */}
            {podeEnviarEmail ? (
            <button onClick={enviarManual} disabled={enviando}
              style={{ padding: '0.75rem', background: enviando ? 'var(--color-surface-3)' : 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', fontSize: '1rem', cursor: enviando ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
              {enviando
                ? '📤 Enviando...'
                : tipoSelec === 'aniversariantes'
                  ? '📤 Enviar para Liderança'
                  : tipoSelec === 'vencimento_licencas'
                    ? '📤 Enviar aviso agora'
                  : tipoSelec === 'cronograma_mes'
                    ? `📅 Enviar cronograma de ${labelMesSel || '...'} para ${irmaosSelec.length} irmão(s)`
                    : `📤 Enviar para ${irmaosSelec.length} irmão(s)`}
            </button>
            ) : (
              <div style={{ padding: '0.75rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>
                🔒 Você não tem permissão para enviar e-mails — apenas visualização
              </div>
            )}

            {/* Resultados */}
            {resultados.length > 0 && (
              <div style={sCard}>
                <p style={{ fontWeight: '700', color: 'var(--color-text)', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Resultado do envio:</p>
                <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {resultados.map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0.5rem', borderRadius: 'var(--radius-md)', background: r.status === 'enviado' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--color-text)' }}>{r.nome}</span>
                      <span style={{ color: r.status === 'enviado' ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                        {r.status === 'enviado' ? '✓ Enviado' : r.status === 'pulado_sem_pendencia' ? '— Sem pendência' : '✗ Erro'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Coluna direita: Seleção de irmãos */}
          <div style={sCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <p style={{ fontWeight: '700', color: 'var(--color-text)', margin: 0, fontSize: '0.95rem' }}>
                {semSelecao ? 'Irmãos com e-mail' : `${irmaosSelec.length === 0 ? 'Selecionar' : `${irmaosSelec.length} selecionado(s)`}`}
              </p>
              {!semSelecao && (
                <button onClick={selecionarTodos}
                  style={{ padding: '0.25rem 0.75rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', cursor: 'pointer' }}>
                  {irmaosSelec.length === irmaosVisiveis.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
              )}
            </div>

            <input type="text" placeholder="🔍 Buscar irmão..." value={filtroBusca} onChange={e => setFiltroBusca(e.target.value)}
              style={{ ...sInput, marginBottom: '0.75rem' }} />

            <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {irmaosVisiveis.map((irmao, idx) => {
                const sel = irmaosSelec.includes(irmao.id);
                return (
                  <div key={irmao.id} onClick={() => !semSelecao && toggleIrmao(irmao.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-lg)', background: sel ? 'var(--color-accent-bg)' : idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)', border: '1px solid ' + (sel ? 'var(--color-accent)' : 'transparent'), cursor: !semSelecao ? 'pointer' : 'default', transition: 'all 0.15s' }}>
                    {!semSelecao && (
                      <input type="checkbox" checked={sel} readOnly
                        style={{ accentColor: 'var(--color-accent)', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: '600', fontSize: '0.875rem', color: sel ? 'var(--color-accent)' : 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{irmao.nome}</p>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{irmao.email}</p>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>CIM {irmao.cim}</span>
                  </div>
                );
              })}
              {irmaosVisiveis.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem', fontSize: '0.875rem' }}>Nenhum irmão encontrado</p>
              )}
            </div>
            <p style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--color-text-muted)', textAlign: 'right' }}>
              {irmaos.length} irmão(s) com e-mail cadastrado
            </p>
          </div>
        </div>
      )}

      {/* ── ABA: AUTOMÁTICO ──────────────────────────────────────────────────── */}
      {aba === 'automatico' && podeEnviarEmail && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ ...sCard, background: 'var(--color-accent-bg)', borderColor: 'var(--color-accent)' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text)' }}>
              ℹ️ Os agendamentos automáticos precisam de <strong>pg_cron</strong> ativado no Supabase. Configure o horário e ative cada tipo individualmente.
            </p>
          </div>

          {TIPOS.filter(t => t.id !== 'vencimento_licencas').map(tipo => {
            const cfg = configs.find(c => c.tipo === tipo.id);
            const ativo = cfg?.ativo || false;
            return (
              <div key={tipo.id} style={{ ...sCard, borderLeft: '4px solid ' + (ativo ? '#10b981' : 'var(--color-border)') }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                    <span style={{ fontSize: '1.5rem' }}>{tipo.emoji}</span>
                    <div>
                      <p style={{ fontWeight: '700', color: 'var(--color-text)', margin: 0 }}>{tipo.label}</p>
                      <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '0.8rem' }}>{tipo.desc}</p>
                      {cfg && (
                        <p style={{ color: ativo ? '#10b981' : 'var(--color-text-muted)', margin: '0.25rem 0 0', fontSize: '0.75rem', fontWeight: '600' }}>
                          {ativo ? '▶ Ativo' : '⏸ Pausado'} — {cfg.frequencia} {cfg.frequencia === 'semanal' ? `(${DIAS_SEMANA[cfg.dia_semana]})` : `(dia ${cfg.dia_mes})`} às {String(cfg.hora).padStart(2,'0')}h
                          {cfg.irmaos_ids?.length > 0 ? ` · ${cfg.irmaos_ids.length} irmão(s)` : ' · Todos os irmãos'}
                        </p>
                      )}
                      {!cfg && <p style={{ color: 'var(--color-text-muted)', margin: '0.25rem 0 0', fontSize: '0.75rem' }}>Não configurado</p>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <button onClick={() => abrirModalConfig(tipo.id)}
                      style={{ padding: '0.4rem 0.9rem', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', cursor: 'pointer', fontWeight: '600' }}>
                      ⚙️ Configurar
                    </button>
                    <button onClick={() => toggleAtivacao(tipo.id)}
                      style={{ padding: '0.4rem 0.9rem', background: ativo ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', color: ativo ? '#ef4444' : '#10b981', border: `1px solid ${ativo ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`, borderRadius: 'var(--radius-md)', fontSize: '0.82rem', cursor: 'pointer', fontWeight: '600' }}>
                      {ativo ? '⏸ Pausar' : '▶ Ativar'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}


        </div>
      )}

      {/* ── ABA: HISTÓRICO ───────────────────────────────────────────────────── */}
      {aba === 'historico' && (
        <div style={sCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <p style={{ fontWeight: '700', color: 'var(--color-text)', margin: 0, fontSize: '0.95rem' }}>
              📋 Histórico de Envios ({logs.length})
            </p>
            <button onClick={carregarLogs}
              style={{ padding: '0.35rem 0.75rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', cursor: 'pointer' }}>
              🔄 Atualizar
            </button>
          </div>

          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📭</div>
              <p style={{ margin: 0 }}>Nenhum envio registrado ainda</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', gap: '1rem', padding: '0.5rem 0.75rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-text-muted)' }}>
                <span style={{ flex: '0 0 140px' }}>Data/Hora</span>
                <span style={{ flex: '0 0 120px' }}>Tipo</span>
                <span style={{ flex: 1 }}>Destinatário</span>
                <span style={{ flex: '0 0 80px', textAlign: 'center' }}>Status</span>
              </div>
              {logs.map((log, idx) => (
                <div key={log.id}
                  style={{ display: 'flex', gap: '1rem', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)', fontSize: '0.8rem', alignItems: 'center' }}>
                  <span style={{ flex: '0 0 140px', color: 'var(--color-text-muted)' }}>
                    {new Date(log.enviado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ flex: '0 0 120px', color: 'var(--color-text)', fontWeight: '600', fontSize: '0.75rem' }}>
                    {TIPOS.find(t => t.id === log.tipo)?.label || log.tipo}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.destinatario_nome}</p>
                    <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.destinatario_email}</p>
                  </div>
                  <span style={{ flex: '0 0 80px', textAlign: 'center' }}>
                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '700', background: log.status === 'enviado' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: log.status === 'enviado' ? '#10b981' : '#ef4444' }}>
                      {log.status === 'enviado' ? '✓ OK' : '✗ Erro'}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modal de configuração automática ─────────────────────────────────── */}
      {modalConfig && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontWeight: '700', color: 'var(--color-text)', margin: 0, fontSize: '1.1rem' }}>
                ⚙️ Configurar — {TIPOS.find(t => t.id === modalConfig)?.label}
              </h3>
              <button onClick={() => setModalConfig(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Ativar */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: formConfig.ativo ? 'rgba(16,185,129,0.1)' : 'var(--color-surface-2)', border: '1px solid ' + (formConfig.ativo ? 'rgba(16,185,129,0.3)' : 'var(--color-border)') }}>
                <input type="checkbox" checked={formConfig.ativo} onChange={e => setFormConfig(p => ({ ...p, ativo: e.target.checked }))} style={{ accentColor: '#10b981', width: '16px', height: '16px' }} />
                <span style={{ fontWeight: '600', color: 'var(--color-text)', fontSize: '0.875rem' }}>Ativar envio automático</span>
              </label>

              {/* Frequência */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>Frequência</label>
                <select value={formConfig.frequencia} onChange={e => setFormConfig(p => ({ ...p, frequencia: e.target.value }))} style={sInput}>
                  {FREQ.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>

              {formConfig.frequencia === 'semanal' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>Dia da semana</label>
                  <select value={formConfig.dia_semana} onChange={e => setFormConfig(p => ({ ...p, dia_semana: parseInt(e.target.value) }))} style={sInput}>
                    {DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
              )}

              {(formConfig.frequencia === 'mensal' || formConfig.frequencia === 'quinzenal') && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>Dia do mês</label>
                  <select value={formConfig.dia_mes} onChange={e => setFormConfig(p => ({ ...p, dia_mes: parseInt(e.target.value) }))} style={sInput}>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>Dia {d}</option>)}
                  </select>
                </div>
              )}

              {/* Hora */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>Horário de envio</label>
                <select value={formConfig.hora} onChange={e => setFormConfig(p => ({ ...p, hora: parseInt(e.target.value) }))} style={sInput}>
                  {Array.from({ length: 24 }, (_, i) => i).map(h => <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}
                </select>
              </div>

              {/* Opções de conteúdo — só para resumo_individual */}
              {modalConfig === 'resumo_individual' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>
                    📦 Conteúdo do e-mail
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {OPCOES_CONTEUDO.map(o => (
                      <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.45rem 0.6rem', borderRadius: 'var(--radius-md)', background: opcoesConfig[o.id] ? 'var(--color-accent-bg)' : 'var(--color-surface-2)', border: '1px solid ' + (opcoesConfig[o.id] ? 'var(--color-accent)' : 'var(--color-border)') }}>
                        <input type="checkbox" checked={opcoesConfig[o.id]} onChange={e => setOpcoesConfig(p => ({ ...p, [o.id]: e.target.checked }))}
                          style={{ accentColor: 'var(--color-accent)', width: '15px', height: '15px' }} />
                        <span style={{ fontSize: '0.82rem', fontWeight: '600', color: opcoesConfig[o.id] ? 'var(--color-accent)' : 'var(--color-text)' }}>{o.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Seleção de irmãos */}
              {(modalConfig === 'resumo_individual' || modalConfig === 'lembrete_financeiro' || modalConfig === 'cronograma_mes') && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>
                    👥 Irmãos que receberão ({irmaosConfigSelec.length === 0 ? 'todos' : `${irmaosConfigSelec.length} selecionado(s)`})
                  </label>
                  <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.35rem' }}>
                    <input type="text" placeholder="🔍 Buscar..." value={filtroBuscaConfig}
                      onChange={e => setFiltroBuscaConfig(e.target.value)}
                      style={{ flex: 1, padding: '0.35rem 0.6rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem' }} />
                    <button onClick={() => setIrmaosConfigSelec(irmaosConfigSelec.length === irmaos.length ? [] : irmaos.map(i => i.id))}
                      style={{ padding: '0.35rem 0.6rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {irmaosConfigSelec.length === irmaos.length ? 'Desmarcar' : 'Todos'}
                    </button>
                  </div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '0 0 0.35rem' }}>
                    ℹ️ Deixe vazio para enviar a todos os irmãos com e-mail cadastrado
                  </p>
                  <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.25rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                    {irmaos.filter(i => i.nome.toLowerCase().includes(filtroBuscaConfig.toLowerCase())).map((irmao, idx) => {
                      const sel = irmaosConfigSelec.includes(irmao.id);
                      return (
                        <div key={irmao.id} onClick={() => setIrmaosConfigSelec(p => p.includes(irmao.id) ? p.filter(x => x !== irmao.id) : [...p, irmao.id])}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.5rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                            background: sel ? 'var(--color-accent-bg)' : idx%2===0 ? 'var(--color-surface)' : 'transparent',
                            border: sel ? '1px solid var(--color-accent)' : '1px solid transparent' }}>
                          <input type="checkbox" checked={sel} readOnly style={{ accentColor: 'var(--color-accent)', flexShrink: 0 }} />
                          <span style={{ fontSize: '0.78rem', color: sel ? 'var(--color-accent)' : 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{irmao.nome}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Botões */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button onClick={() => setModalConfig(null)}
                  style={{ flex: 1, padding: '0.6rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontWeight: '600', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={salvarConfig} disabled={!!salvandoConfig}
                  style={{ flex: 2, padding: '0.6rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: '700', cursor: 'pointer' }}>
                  {salvandoConfig ? 'Salvando...' : '💾 Salvar configuração'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
