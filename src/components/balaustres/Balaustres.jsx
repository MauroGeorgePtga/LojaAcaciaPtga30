import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { formatarData } from '../../utils/formatters';
import { gerarAtaSessao, listarModelosAta, gerarListaPresencaEleicaoGLEMT, gerarEditalEleicaoGLEMT } from '../../utils/gerarAtaSessao';
import { supabase as supabaseEleicao } from '../../supabaseClient';
import EleicaoGLEMTModal from './EleicaoGLEMTModal';
import { gerarAptosVotarPDF } from '../../utils/gerarAptosVotarPDF';
import { LOGO_LOJA_B64 } from '../../utils/logoLoja';

const Balaustres = ({ 
  balaustres, 
  tiposSessao, 
  session,
  onUpdate, 
  showSuccess, 
  showError,
  permissoes,
  userData,
  grauUsuario,
  podeEditarModelos = false,
  onAbrirModelos,
  onAbrirEleicaoPosse
}) => {
  const [modalGLEMT, setModalGLEMT] = useState(null); // balaustre da eleição GLEMT aberto no modal
  // ── Ata da sessão (Word) ──
  const [gerandoAta, setGerandoAta] = useState(null);
  const [avisoSemBalaustre, setAvisoSemBalaustre] = useState(false);
  const hojeISO = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const COR_GRAU = { aprendiz: '#3b82f6', companheiro: '#10b981', mestre: '#8b5cf6' };
  const corDoGrau = (g) => COR_GRAU[(g || '').trim().toLowerCase()] || 'var(--color-accent)';

  // ── Eleição da GLEMT (a cada 3 anos) ──
  const [mestresRegulares, setMestresRegulares] = useState([]);
  const [irmaosAptidao, setIrmaosAptidao] = useState([]);
  // Aptidão para votar na eleição GLEMT (mesma regra da eleição da Loja)
  const [aptGLEMT, setAptGLEMT] = useState({ carregando: false, linhas: [], periodo: '', chave: '' });
  useEffect(() => {
    (async () => {
      const { data } = await supabaseEleicao.from('irmaos').select('id, nome, cim, situacao, data_exaltacao, data_falecimento, data_nascimento, data_desligamento');
      setIrmaosAptidao(data || []);
      setMestresRegulares((data || [])
        .filter(i => String(i.situacao || 'regular').toLowerCase() === 'regular' && i.data_exaltacao && !i.data_falecimento)
        .sort((a, b) => a.nome.localeCompare(b.nome)));
    })();
  }, []);
  const ELEICAO_VAZIA = () => {
    const ano = new Date().getFullYear() + 1;
    return { ativo: true, ano_inicio: ano, ano_fim: ano + 3,
      chapas: [{ nome: '', gm: '', gm_adjunto: '', votos: '' }, { nome: '', gm: '', gm_adjunto: '', votos: '' }],
      brancos: '', nulos: '', votantes: '', escrutinador1_id: '', escrutinador2_id: '', presentes: [] };
  };
  const [gerandoLista, setGerandoLista] = useState(null);

  // ── Pendente (eleição GLEMT agendada, sem número) ──
  const ehPendente = (b) => !!(b?.eleicao_glemt?.ativo && b.eleicao_glemt.status === 'pendente');
  const menos15 = (iso) => { if (!iso) return ''; const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() - 15); return d.toISOString().substring(0, 10); };
  const agendarEleicaoGLEMT = () => {
    limparFormulario();
    setGrauSelecionado('Mestre');
    setBalaustreForm(f => ({ ...f, grau_sessao: 'Mestre', numero_balaustre: '',
      eleicao_glemt: { ...ELEICAO_VAZIA(), status: 'pendente', data_edital: '' } }));
    setModalAberto(true);
  };
  const [gerandoEdital, setGerandoEdital] = useState(null);
  const gerarEdital = async (balaustre) => {
    setGerandoEdital(balaustre.id);
    try {
      const r = await gerarEditalEleicaoGLEMT({ balaustre });
      if (r?.faltando?.length) showError(`Edital gerado, mas falta no Corpo Administrativo: ${r.faltando.join(', ')}.`);
      else showSuccess('📢 Edital gerado!');
    } catch (e) { showError('Erro ao gerar o edital: ' + e.message); }
    finally { setGerandoEdital(null); }
  };
  const marcarRealizada = async (balaustre) => {
    const ano = parseInt(String(balaustre.data_sessao || '').substring(0, 4)) || new Date().getFullYear();
    if (!window.confirm(`Marcar a eleição GLEMT de ${formatarData(balaustre.data_sessao)} como REALIZADA?\nO balaustre receberá o próximo número de Mestre de ${ano}.`)) return;
    try {
      const { data: ult } = await supabase.from('balaustres').select('numero_balaustre')
        .eq('grau_sessao', balaustre.grau_sessao || 'Mestre').eq('ano_balaustre', ano)
        .not('numero_balaustre', 'is', null).order('numero_balaustre', { ascending: false }).limit(1);
      const numero = (ult && ult[0] ? parseInt(ult[0].numero_balaustre) || 0 : 0) + 1;
      const { data, error } = await supabase.from('balaustres')
        .update({ numero_balaustre: numero, ano_balaustre: ano, eleicao_glemt: { ...balaustre.eleicao_glemt, status: 'realizada' } })
        .eq('id', balaustre.id).select();
      if (error) throw error;
      if (!data?.length) throw new Error('o banco não permitiu a alteração (sem permissão).');
      showSuccess(`✅ Sessão realizada — Balaustre nº ${numero}/${ano}.`);
      setModalGLEMT(null);
      onUpdate();
    } catch (e) { showError('Erro: ' + e.message); }
  };

  // Volta a eleição GLEMT para PENDENTE e devolve o número do balaustre
  const voltarPendente = async (balaustre) => {
    const num = balaustre.numero_balaustre;
    const ano = balaustre.ano_balaustre;
    const grau = balaustre.grau_sessao || 'Mestre';
    if (!window.confirm(`Voltar a eleição GLEMT de ${formatarData(balaustre.data_sessao)} para PENDENTE?\nO balaustre nº ${num}/${ano} perderá a numeração e o próximo de ${grau} voltará a ser o nº ${num}.`)) return;
    try {
      // só devolve a numeração se este for o último do grau/ano, para não abrir vão na sequência
      const { data: ult } = await supabase.from('balaustres').select('id, numero_balaustre')
        .eq('grau_sessao', grau).eq('ano_balaustre', ano)
        .not('numero_balaustre', 'is', null).order('numero_balaustre', { ascending: false }).limit(1);
      if (ult && ult[0] && String(ult[0].id) !== String(balaustre.id)) {
        showError(`Este não é o último balaustre de ${grau} de ${ano} (o último é o nº ${ult[0].numero_balaustre}). Acerte os posteriores primeiro.`);
        return;
      }
      const { data, error } = await supabase.from('balaustres')
        .update({ numero_balaustre: null, eleicao_glemt: { ...balaustre.eleicao_glemt, status: 'pendente' } })
        .eq('id', balaustre.id).select();
      if (error) throw error;
      if (!data?.length) throw new Error('o banco não permitiu a alteração (sem permissão).');
      showSuccess(`Eleição GLEMT voltou para pendente — o nº ${num}/${ano} foi liberado.`);
      setModalGLEMT(null);
      onUpdate();
    } catch (e) { showError('Erro: ' + e.message); }
  };

  // ── Eleições da Loja (para vincular sessões de Eleição/Posse) ──
  const [eleicoesLoja, setEleicoesLoja] = useState([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabaseEleicao.from('eleicoes').select('id, gestao, data_eleicao, data_posse').order('data_eleicao', { ascending: false });
      setEleicoesLoja(data || []);
    })();
  }, []);
  const gestaoDe = (id) => eleicoesLoja.find(e => String(e.id) === String(id))?.gestao || '';
  const gerarListaPresenca = async (balaustre) => {
    setGerandoLista(balaustre.id);
    try { await gerarListaPresencaEleicaoGLEMT({ balaustre }); showSuccess('📋 Lista de presença gerada!'); }
    catch (e) { showError('Erro ao gerar a lista: ' + e.message); }
    finally { setGerandoLista(null); }
  };

  // Escolha do modelo quando o grau tem mais de um (ex.: Ata Mestre / Ata Exaltação Mestre)
  const [escolhaModelo, setEscolhaModelo] = useState(null); // { balaustre, modelos }

  const gerarAta = async (balaustre) => {
    if (ehPendente(balaustre)) {
      showError('Sessão pendente: marque como realizada (✅) para numerar o balaustre e gerar a ata.');
      return;
    }
    try {
      const modelos = await listarModelosAta(balaustre.grau_sessao, { eleicao: !!balaustre.eleicao_glemt?.ativo });
      if (modelos.length > 1) { setEscolhaModelo({ balaustre, modelos }); return; }
      await gerarAtaComModelo(balaustre, modelos[0]?.id || null);
    } catch (e) {
      showError('Erro ao carregar os modelos de ata: ' + e.message);
    }
  };

  const gerarAtaComModelo = async (balaustre, modeloId) => {
    setEscolhaModelo(null);
    setGerandoAta(balaustre.id);
    try {
      const r = await gerarAtaSessao({ balaustre, modeloId });
      if (r?.faltando?.length) showError(`Ata gerada, mas falta no Corpo Administrativo de ${balaustre.ano_balaustre}: ${r.faltando.join(', ')}.`);
      else showSuccess('📄 Ata gerada!');
    } catch (e) {
      showError('Erro ao gerar a ata: ' + e.message);
    } finally {
      setGerandoAta(null);
    }
  };

  // "Ata de hoje": gera se houver balaustre com a data de hoje; senão avisa para cadastrar
  const gerarAtaDeHoje = () => {
    const doDia = balaustres.filter(b => b.data_sessao === hojeISO && !b.sessao_especial);
    const alvo = doDia.find(b => (b.grau_sessao || '').toLowerCase() === grauSelecionado.toLowerCase()) || doDia[0];
    if (alvo) gerarAta(alvo); else setAvisoSemBalaustre(true);
  };

  
  // Estados do formulário
  const [balaustreForm, setBalaustreForm] = useState({
    grau_sessao: 'Aprendiz',
    numero_balaustre: '',
    ano_balaustre: new Date().getFullYear(),
    data_sessao: '',
    dia_semana: '',
    tipo_sessao_id: '',
    ordem_dia: '',
    observacoes: '',
    hora_abertura: '20:00',
    hora_encerramento: '22:00',
    eleicao_glemt: null,
    sessao_especial: '',
    eleicao_id: ''
  });

  // Estados de controle
  const [modoEdicao, setModoEdicao] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [balaustreEditando, setBalaustreEditando] = useState(null);
  const [loading, setLoading] = useState(false);
  const [grauSelecionado, setGrauSelecionado] = useState('Aprendiz');

  // Eleição GLEMT: atalhos do formulário (depois do estado balaustreForm)

  const el = balaustreForm.eleicao_glemt;
  const setEl = (campos) => setBalaustreForm(f => ({ ...f, eleicao_glemt: { ...(f.eleicao_glemt || ELEICAO_VAZIA()), ...campos } }));
  const setChapa = (idx, campos) => setEl({ chapas: (el?.chapas || []).map((c, i) => (i === idx ? { ...c, ...campos } : c)) });
  // Aptidão com os ajustes manuais gravados no próprio balaustre (eleicao_glemt.aptidao_ajustes)
  const linhasApt = aptGLEMT.linhas.map(l => {
    const aj = (el?.aptidao_ajustes || {})[String(l.irmao.id)];
    return { ...l, ajuste: aj, apto: aj ? aj.status === 'apto' : l.aptoAuto };
  });
  const aptPorIrmao = Object.fromEntries(linhasApt.map(l => [String(l.irmao.id), l]));
  const ajustarAptGLEMT = (l) => {
    const atuais = { ...(el?.aptidao_ajustes || {}) };
    if (l.ajuste) delete atuais[String(l.irmao.id)];
    else {
      const just = window.prompt(`Tornar ${l.nomeCurto} APTO a votar.\nInforme a justificativa:`);
      if (!just || !just.trim()) return;
      atuais[String(l.irmao.id)] = { status: 'apto', justificativa: just.trim(), em: new Date().toISOString() };
    }
    setEl({ aptidao_ajustes: atuais });
  };
  // tipo: 'aptos' | 'inaptos'
  const pdfAptosGLEMT = (tipo = 'aptos') => {
    const aptos = linhasApt.filter(l => (tipo === 'inaptos' ? !l.apto : l.apto));
    if (!aptos.length) { showError(tipo === 'inaptos' ? 'Nenhum irmão inapto para listar.' : 'Nenhum irmão apto para listar.'); return; }
    const ref = balaustreForm.data_sessao;
    const ano = String(ref || '').substring(0, 4);
    const periodoTxt = el?.ano_inicio && el?.ano_fim ? `${el.ano_inicio}/${el.ano_fim}` : '';
    gerarAptosVotarPDF({
      linhas: aptos, eleicao: {}, dadosLoja: aptGLEMT.dadosLoja || {}, logoB64: LOGO_LOJA_B64, periodo: aptGLEMT.periodo,
      assinantes: aptGLEMT.assinantes || {},
      subtitulo: `Eleição da Grande Loja Maçônica do Estado de Mato Grosso – GLEMT${periodoTxt ? ` — Período ${periodoTxt}` : ''}${ref ? ` — sessão de ${ref.split('-').reverse().join('/')}` : ''}`,
      nomeArquivo: `${tipo === 'inaptos' ? 'Inaptos' : 'Aptos'}_a_Votar_GLEMT_${periodoTxt.replace('/', '-') || ano}.pdf`,
      tipo,
    });
  };
  const [anoSelecionado, setAnoSelecionado] = useState(null); // null = todos os anos
  const [balaustreVisualizando, setBalaustreVisualizando] = useState(null);
  const [modalVisualizar, setModalVisualizar] = useState(false);

  // Função para obter dia da semana
  const obterDiaSemana = (data) => {
    if (!data) return '';
    const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const date = new Date(data + 'T00:00:00');
    return dias[date.getDay()];
  };

  // Carregar próximo número de balaustre (por ano e grau)
  const carregarProximoNumero = async (grau, ano) => {
    try {
      const { data, error } = await supabase
        .from('balaustres')
        .select('numero_balaustre, ano_balaustre')
        .eq('grau_sessao', grau)
        .eq('ano_balaustre', ano)
        // Pendentes (sem número) ficam de fora — no Postgres o NULL viria primeiro na ordem decrescente
        .not('numero_balaustre', 'is', null)
        .order('numero_balaustre', { ascending: false })
        .limit(1);

      if (error) throw error;

      const proximoNumero = data && data.length > 0 ? (parseInt(data[0].numero_balaustre) || 0) + 1 : 1;
      setBalaustreForm(prev => ({ ...prev, numero_balaustre: proximoNumero }));
    } catch (error) {
      console.error('Erro ao carregar próximo número:', error);
    }
  };

  // Atualizar dia da semana quando data mudar
  useEffect(() => {
    if (balaustreForm.data_sessao) {
      const diaSemana = obterDiaSemana(balaustreForm.data_sessao);
      setBalaustreForm(prev => ({ ...prev, dia_semana: diaSemana }));
    }
  }, [balaustreForm.data_sessao]);

  // Carregar próximo número quando grau ou ano mudar
  useEffect(() => {
    if (!modoEdicao) {
      carregarProximoNumero(balaustreForm.grau_sessao, balaustreForm.ano_balaustre);
    }
  }, [balaustreForm.grau_sessao, balaustreForm.ano_balaustre, modoEdicao]);

  // Carregar próximo número ao montar componente
  useEffect(() => {
    if (!modoEdicao) {
      carregarProximoNumero(grauSelecionado, new Date().getFullYear());
    }
  }, [grauSelecionado, modoEdicao]);

  // Limpar formulário
  const limparFormulario = () => {
    const anoAtual = new Date().getFullYear();
    setBalaustreForm({
      grau_sessao: grauSelecionado,
      numero_balaustre: '',
      ano_balaustre: anoAtual,
      data_sessao: '',
      dia_semana: '',
      tipo_sessao_id: '',
      ordem_dia: '',
      observacoes: '',
      hora_abertura: '20:00',
      hora_encerramento: '22:00',
      eleicao_glemt: null,
      sessao_especial: '',
      eleicao_id: ''
    });
    setModoEdicao(false);
    setBalaustreEditando(null);
    setModalAberto(false);
    carregarProximoNumero(grauSelecionado, anoAtual);
  };

  // Cadastrar balaustre
  // Campos vazios → null; pendente da eleição GLEMT fica sem número
  const payloadBalaustre = () => ({
    ...balaustreForm,
    numero_balaustre: ehPendente(balaustreForm) ? null : (balaustreForm.numero_balaustre || null),
    sessao_especial: balaustreForm.sessao_especial || null,
    eleicao_id: balaustreForm.sessao_especial ? (balaustreForm.eleicao_id || null) : null,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (balaustreForm.sessao_especial && !balaustreForm.eleicao_id) { showError('Escolha a eleição da Loja vinculada a esta sessão.'); return; }
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('balaustres')
        .insert([{
          ...payloadBalaustre(),
          created_by: session.user.id
        }])
        .select()
        .single();

      if (error) throw error;

      showSuccess('Balaustre cadastrado com sucesso!');
      limparFormulario();
      onUpdate();
      limparFormulario();

    } catch (error) {
      showError('Erro ao salvar balaustre: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Atualizar balaustre
  const handleAtualizar = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: alterados, error } = await supabase
        .from('balaustres')
        .update(payloadBalaustre())
        .eq('id', balaustreEditando.id)
        .select();

      if (error) throw error;
      if (!alterados || alterados.length === 0) throw new Error('O banco não permitiu a alteração (sem permissão). Nada foi salvo.');

      showSuccess('Balaustre atualizado com sucesso!');
      limparFormulario();
      onUpdate();
      limparFormulario();

    } catch (error) {
      showError('Erro ao atualizar balaustre: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Editar balaustre
  const handleEditar = (balaustre) => {
    setModoEdicao(true);
    setModalAberto(true);
    setBalaustreEditando(balaustre);
    setBalaustreForm({
      grau_sessao: balaustre.grau_sessao,
      numero_balaustre: balaustre.numero_balaustre,
      ano_balaustre: balaustre.ano_balaustre || new Date().getFullYear(),
      data_sessao: balaustre.data_sessao,
      dia_semana: balaustre.dia_semana,
      tipo_sessao_id: balaustre.tipo_sessao_id,
      ordem_dia: balaustre.ordem_dia || '',
      observacoes: balaustre.observacoes || '',
      hora_abertura: (balaustre.hora_abertura || '20:00').substring(0, 5),
      hora_encerramento: (balaustre.hora_encerramento || '22:00').substring(0, 5),
      eleicao_glemt: balaustre.eleicao_glemt || null,
      sessao_especial: balaustre.sessao_especial || '',
      eleicao_id: balaustre.eleicao_id || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Visualizar balaustre completo
  const handleVisualizar = (balaustre) => {
    setBalaustreVisualizando(balaustre);
    setModalVisualizar(true);
  };

  // Excluir balaustre
  const handleExcluir = async (id) => {
    if (typeof window !== 'undefined' && !window.confirm('Tem certeza que deseja excluir este balaustre?')) return;

    setLoading(true);
    try {
      const { data: excluidos, error } = await supabase
        .from('balaustres')
        .delete()
        .eq('id', id)
        .select();

      if (error) throw error;
      if (!excluidos || excluidos.length === 0) throw new Error('O banco não permitiu a alteração (sem permissão). Nada foi salvo.');

      showSuccess('Balaustre excluído com sucesso!');
      onUpdate();

    } catch (error) {
      showError('Erro ao excluir balaustre: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Obter nome do tipo de sessão
  const obterNomeTipoSessao = (tipoId) => {
    const tipo = tiposSessao.find(t => t.id === tipoId);
    return tipo ? tipo.nome : 'N/A';
  };

  // Anos disponíveis para o grau selecionado
  const anosDisponiveis = [...new Set(
    balaustres
      .filter(b => (b.grau_sessao || '').trim().toLowerCase() === (grauSelecionado || '').trim().toLowerCase())
      .map(b => {
        if (b.ano_balaustre) return parseInt(b.ano_balaustre);
        if (b.data_sessao) return new Date(b.data_sessao + 'T00:00:00').getFullYear();
        return new Date().getFullYear();
      })
  )].sort((a, b) => b - a);

  // Filtrar balaustres por grau (ULTRA ROBUSTO)
  const balaustresFiltrados = balaustres.filter(b => {
    const grauBanco = (b.grau_sessao || '').trim().toLowerCase();
    const grauBusca = (grauSelecionado || '').trim().toLowerCase();
    const match = grauBanco === grauBusca;
    
    return match;
  });

  // CONTROLE DE ACESSO POR GRAU
  // Aprendiz: só vê Aprendiz
  // Companheiro: vê Companheiro e Aprendiz
  // Mestre: vê tudo
  const balaustresFiltradosPorAcesso = balaustresFiltrados.filter(b => {
    if (!grauUsuario) return true; // Se não tiver grau definido, mostra tudo (admin)
    
    const grauBalaustre = (b.grau_sessao || '').trim().toLowerCase();
    const grauUser = grauUsuario.toLowerCase();
    
    // Mestre e Mestre Instalado veem tudo
    if (grauUser === 'mestre' || grauUser === 'mestre instalado') return true;
    
    if (grauUser === 'companheiro') {
      return grauBalaustre === 'companheiro' || grauBalaustre === 'aprendiz';
    }
    
    if (grauUser === 'aprendiz') {
      return grauBalaustre === 'aprendiz';
    }
    
    return false;
  });

  return (
    <div style={{ padding: '2rem', background: 'var(--color-bg)', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* MODAL CADASTRO/EDIÇÃO */}
      {modalAberto && permissoes?.pode_editar_balaustres && (
        <div onClick={limparFormulario} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',zIndex:50,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'1.5rem 1rem',overflowY:'auto'}}>
          <div onClick={e => e.stopPropagation()} style={{background:'var(--color-surface)',borderRadius:'var(--radius-xl)',border:'1px solid var(--color-border)',width:'100%',maxWidth:'680px',boxShadow:'0 20px 60px rgba(0,0,0,0.4)',overflow:'hidden',marginBottom:'1.5rem'}}>

            {/* Header */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'1.1rem 1.4rem',borderBottom:'1px solid var(--color-border)',background:'var(--color-surface-2)'}}>
              <div style={{display:'flex',alignItems:'center',gap:'0.6rem'}}>
                <span style={{fontSize:'1.2rem'}}>📜</span>
                <div>
                  <h3 style={{margin:0,fontSize:'1rem',fontWeight:'800',color:'var(--color-text)'}}>
                    {modoEdicao ? 'Editar Balaustre' : 'Novo Balaustre'}
                  </h3>
                  <p style={{margin:0,fontSize:'0.72rem',color:'var(--color-text-muted)'}}>
                    {modoEdicao ? 'Atualize os dados do balaustre' : 'Preencha os dados para cadastrar'}
                  </p>
                </div>
              </div>
              <button onClick={limparFormulario} style={{background:'transparent',border:'none',color:'var(--color-text-muted)',fontSize:'1.3rem',cursor:'pointer',padding:'0.2rem 0.5rem',borderRadius:'var(--radius-md)',lineHeight:1}}>✕</button>
            </div>

            {/* Corpo */}
            <form onSubmit={modoEdicao ? handleAtualizar : handleSubmit} style={{padding:'1.4rem',display:'flex',flexDirection:'column',gap:'1rem'}}>

              {/* Linha 1: Grau, Número, Ano, Data */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 80px 100px 1fr',gap:'0.75rem'}}>
                <div>
                  <label style={{fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.35rem'}}>Grau da Sessão *</label>
                  <select value={balaustreForm.grau_sessao}
                    onChange={e => { setBalaustreForm({...balaustreForm, grau_sessao: e.target.value}); setGrauSelecionado(e.target.value); }}
                    style={{width:'100%',padding:'0.6rem 0.75rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',fontSize:'0.875rem',outline:'none'}} required>
                    <option value="Aprendiz">Aprendiz</option>
                    <option value="Companheiro">Companheiro</option>
                    <option value="Mestre">Mestre</option>
                  </select>
                </div>
                <div>
                  <label style={{fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.35rem'}}>Nº *</label>
                  <input type="number" value={ehPendente(balaustreForm) ? '' : balaustreForm.numero_balaustre} min="1" placeholder={ehPendente(balaustreForm) ? 'Pendente' : 'Nº'}
                    disabled={ehPendente(balaustreForm)} required={!ehPendente(balaustreForm)}
                    onChange={e => setBalaustreForm({...balaustreForm, numero_balaustre: parseInt(e.target.value)||''})}
                    style={{width:'100%',padding:'0.6rem 0.75rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',fontSize:'0.875rem',outline:'none',boxSizing:'border-box'}} />
                </div>
                <div>
                  <label style={{fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.35rem'}}>Ano *</label>
                  <input type="number" value={balaustreForm.ano_balaustre} min="2020" max="2099"
                    onChange={e => setBalaustreForm({...balaustreForm, ano_balaustre: parseInt(e.target.value)||new Date().getFullYear()})}
                    style={{width:'100%',padding:'0.6rem 0.75rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',fontSize:'0.875rem',outline:'none',boxSizing:'border-box'}} required />
                </div>
                <div>
                  <label style={{fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.35rem'}}>Data da Sessão *</label>
                  <input type="date" value={balaustreForm.data_sessao}
                    onChange={e => setBalaustreForm({...balaustreForm, data_sessao: e.target.value})}
                    style={{width:'100%',padding:'0.6rem 0.75rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',fontSize:'0.875rem',outline:'none',boxSizing:'border-box'}} required />
                </div>
              </div>

              {/* Linha 2: Dia Semana (readonly) + Tipo Sessão */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
                <div>
                  <label style={{fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.35rem'}}>Dia da Semana</label>
                  <input type="text" value={balaustreForm.dia_semana} readOnly
                    style={{width:'100%',padding:'0.6rem 0.75rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',color:'var(--color-text-muted)',border:'1px solid var(--color-border)',fontSize:'0.875rem',outline:'none',cursor:'not-allowed',boxSizing:'border-box'}} />
                </div>
                <div>
                  <label style={{fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.35rem'}}>Tipo de Sessão *</label>
                  <select value={balaustreForm.tipo_sessao_id}
                    onChange={e => setBalaustreForm({...balaustreForm, tipo_sessao_id: e.target.value})}
                    style={{width:'100%',padding:'0.6rem 0.75rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',fontSize:'0.875rem',outline:'none'}} required>
                    <option value="">Selecione...</option>
                    {tiposSessao.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>)}
                  </select>
                </div>
              </div>

              {/* SESSÃO ESPECIAL: Eleição / Posse da Loja (exigida para gerar as atas em Eleição e Posse) */}
              {!balaustreForm.eleicao_glemt?.ativo && (
                <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:'0.6rem',border:'1px solid rgba(201,168,76,0.45)',borderRadius:'var(--radius-lg)',padding:'0.75rem',background:'rgba(201,168,76,0.06)'}}>
                  <div><label style={{fontSize:'0.68rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',display:'block',marginBottom:'0.25rem'}}>Sessão especial</label>
                    <select value={balaustreForm.sessao_especial || ''} style={{width:'100%',padding:'0.55rem 0.7rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',fontSize:'0.85rem',outline:'none',boxSizing:'border-box'}}
                      onChange={e => {
                        const v = e.target.value;
                        const grau = v === 'eleicao_loja' ? 'Mestre' : v === 'posse_loja' ? 'Aprendiz' : balaustreForm.grau_sessao;
                        setBalaustreForm(f => ({ ...f, sessao_especial: v, grau_sessao: grau, eleicao_id: v ? f.eleicao_id : '' }));
                        if (v) setGrauSelecionado(grau);
                      }}>
                      <option value="">Nenhuma (sessão normal)</option>
                      <option value="eleicao_loja">🏛️ Eleição da Loja (grau Mestre)</option>
                      <option value="posse_loja">🎖️ Posse da Loja (grau Aprendiz)</option>
                    </select></div>
                  {balaustreForm.sessao_especial && (
                    <div><label style={{fontSize:'0.68rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',display:'block',marginBottom:'0.25rem'}}>Eleição vinculada *</label>
                      <select value={balaustreForm.eleicao_id || ''} style={{width:'100%',padding:'0.55rem 0.7rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',fontSize:'0.85rem',outline:'none',boxSizing:'border-box'}} onChange={e => setBalaustreForm(f => ({ ...f, eleicao_id: e.target.value }))}>
                        <option value="">Selecione...</option>
                        {eleicoesLoja.map(el2 => <option key={el2.id} value={el2.id}>Gestão {el2.gestao}</option>)}
                      </select></div>
                  )}
                </div>
              )}

              {/* ELEIÇÃO DA GLEMT (somente sessões de Mestre) */}
              {(balaustreForm.grau_sessao || '').trim().toLowerCase() === 'mestre' && !balaustreForm.sessao_especial && (
                <div style={{border:'1px solid rgba(139,92,246,0.45)',borderRadius:'var(--radius-lg)',padding:'0.85rem',background:'rgba(139,92,246,0.06)'}}>
                  <label style={{display:'flex',alignItems:'center',gap:'0.5rem',fontWeight:700,fontSize:'0.88rem',color:'var(--color-text)',cursor:'pointer'}}>
                    <input type="checkbox" checked={!!el?.ativo}
                      onChange={e => setBalaustreForm(f => ({ ...f, eleicao_glemt: e.target.checked ? (f.eleicao_glemt ? { ...f.eleicao_glemt, ativo: true } : ELEICAO_VAZIA()) : null }))} />
                    🗳️ Sessão de Eleição da GLEMT (Grão-Mestre e Adjunto)
                  </label>
                  {el?.ativo && (
                    <p style={{margin:'0.6rem 0 0',fontSize:'0.8rem',color:'var(--color-text-muted)'}}>
                      {el.status === 'pendente' ? '⏳ Sessão agendada (pendente, sem número). ' : ''}
                      Depois de salvar, use o botão <strong style={{color:'#8b5cf6'}}>🗳️ Eleição GLEMT</strong> na linha do balaustre para configurar
                      período, edital, chapas, escrutinadores, aptos e presença, apuração e documentos.
                    </p>
                  )}
                </div>
              )}

              {/* Horários (usados na ata) */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
                {[['hora_abertura','Abertura dos Trabalhos'],['hora_encerramento','Encerramento']].map(([k,l]) => (
                  <div key={k}>
                    <label style={{fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.35rem'}}>{l}</label>
                    <input type="time" value={balaustreForm[k] || ''} onChange={e => setBalaustreForm({...balaustreForm, [k]: e.target.value})}
                      style={{width:'100%',padding:'0.6rem 0.75rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',fontSize:'0.875rem',outline:'none',boxSizing:'border-box'}} />
                  </div>
                ))}
              </div>

              {/* Ordem do Dia e Observações */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
                <div>
                  <label style={{fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.35rem'}}>Ordem do Dia</label>
                  <textarea value={balaustreForm.ordem_dia} rows={4} placeholder="Descreva a ordem do dia..."
                    onChange={e => setBalaustreForm({...balaustreForm, ordem_dia: e.target.value})}
                    style={{width:'100%',padding:'0.6rem 0.75rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',fontSize:'0.875rem',outline:'none',resize:'vertical',boxSizing:'border-box'}} />
                </div>
                <div>
                  <label style={{fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.35rem'}}>Observações</label>
                  <textarea value={balaustreForm.observacoes} rows={4} placeholder="Observações adicionais..."
                    onChange={e => setBalaustreForm({...balaustreForm, observacoes: e.target.value})}
                    style={{width:'100%',padding:'0.6rem 0.75rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',fontSize:'0.875rem',outline:'none',resize:'vertical',boxSizing:'border-box'}} />
                </div>
              </div>

              {/* Preview do número */}
              <p style={{fontSize:'0.75rem',color:'var(--color-text-muted)',margin:0}}>
                📜 Balaustre: <strong>{balaustreForm.numero_balaustre || '?'}/{balaustreForm.ano_balaustre}</strong> — {balaustreForm.grau_sessao}
              </p>

              {/* Botões */}
              <div style={{display:'flex',gap:'0.65rem',paddingTop:'0.25rem'}}>
                <button type="button" onClick={limparFormulario}
                  style={{flex:1,height:'40px',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',fontWeight:'700',fontSize:'0.85rem',cursor:'pointer'}}>
                  Cancelar
                </button>
                <button type="submit" disabled={loading}
                  style={{flex:2,height:'40px',background:loading ? 'var(--color-surface-3)' : 'var(--color-accent)',color:'#fff',border:'none',borderRadius:'var(--radius-lg)',fontWeight:'700',fontSize:'0.85rem',cursor:loading ? 'not-allowed' : 'pointer'}}>
                  {loading ? 'Salvando...' : modoEdicao ? '✏️ Atualizar Balaustre' : '✅ Cadastrar Balaustre'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BARRA DE AÇÕES */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'0.75rem',flexWrap:'wrap',marginBottom:'1rem'}}>
        <h2 style={{margin:0,fontSize:'1.25rem',fontWeight:800,color:'var(--color-text)'}}>📜 Balaustres</h2>
        <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
          <button onClick={gerarAtaDeHoje} disabled={!!gerandoAta}
            style={{height:'38px',padding:'0 1rem',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',fontWeight:'700',fontSize:'0.82rem',cursor:'pointer'}}>
            📄 Ata de hoje
          </button>
          {podeEditarModelos && onAbrirModelos && (
            <button onClick={onAbrirModelos}
              style={{height:'38px',padding:'0 1rem',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',fontWeight:'700',fontSize:'0.82rem',cursor:'pointer'}}>
              📝 Modelos de Ata
            </button>
          )}
          {permissoes?.pode_editar_balaustres && (
            <button onClick={agendarEleicaoGLEMT}
              style={{height:'38px',padding:'0 1rem',background:'rgba(139,92,246,0.15)',color:'#8b5cf6',border:'1px solid rgba(139,92,246,0.5)',borderRadius:'var(--radius-lg)',fontWeight:'700',fontSize:'0.82rem',cursor:'pointer'}}>
              🗳️ Agendar Eleição GLEMT
            </button>
          )}
          {permissoes?.pode_editar_balaustres && (
            <button onClick={() => { limparFormulario(); setModalAberto(true); }}
              style={{height:'38px',padding:'0 1rem',background:'var(--color-accent)',color:'#fff',border:'none',borderRadius:'var(--radius-lg)',fontWeight:'700',fontSize:'0.82rem',cursor:'pointer'}}>
              ➕ Novo Balaustre
            </button>
          )}
        </div>
      </div>

      {/* RESUMO DO GRAU SELECIONADO */}
      {(() => {
        const anoAtual = new Date().getFullYear();
        const doGrau = balaustresFiltradosPorAcesso.filter(b => !ehPendente(b));
        const doAno = doGrau.filter(b => parseInt(b.ano_balaustre || String(b.data_sessao || '').substring(0, 4)) === anoAtual);
        const ultimo = [...doGrau].sort((x, y) => String(y.data_sessao || '').localeCompare(String(x.data_sessao || '')))[0];
        const proximo = doAno.length ? Math.max(...doAno.map(b => parseInt(b.numero_balaustre) || 0)) + 1 : 1;
        const cor = corDoGrau(grauSelecionado);
        const card = (titulo, valor, sub) => (
          <div style={{flex:'1 1 180px',background:'var(--color-surface)',border:'1px solid var(--color-border)',borderTop:`3px solid ${cor}`,borderRadius:'var(--radius-lg)',padding:'0.75rem 1rem'}}>
            <div style={{fontSize:'0.68rem',fontWeight:800,textTransform:'uppercase',color:'var(--color-text-muted)'}}>{titulo}</div>
            <div style={{fontSize:'1.35rem',fontWeight:800,color:cor,lineHeight:1.3}}>{valor}</div>
            {sub && <div style={{fontSize:'0.75rem',color:'var(--color-text-muted)'}}>{sub}</div>}
          </div>
        );
        return (
          <div style={{display:'flex',gap:'0.75rem',flexWrap:'wrap',marginBottom:'1rem'}}>
            {card(`${grauSelecionado} em ${anoAtual}`, doAno.length, 'balaustre(s) no ano')}
            {card('Último balaustre', ultimo ? `${ultimo.numero_balaustre}/${ultimo.ano_balaustre || ''}` : '—', ultimo ? formatarData(ultimo.data_sessao) : 'nenhum cadastrado')}
            {card('Próximo número', `${proximo}/${anoAtual}`, grauSelecionado)}
          </div>
        );
      })()}

      <div className="card" style={{ padding: "1rem", marginBottom: "1.5rem" }}>
        <div className="flex gap-2">
          <button
            onClick={() => { setGrauSelecionado('Aprendiz'); setAnoSelecionado(null); }}
            style={{
              padding: '0.5rem 1rem',
              background: grauSelecionado === 'Aprendiz' ? 'var(--color-accent)' : 'var(--color-surface-2)',
              color: grauSelecionado === 'Aprendiz' ? 'white' : 'var(--color-text)',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (grauSelecionado !== 'Aprendiz') e.target.style.background = 'var(--color-surface-3)';
            }}
            onMouseLeave={(e) => {
              if (grauSelecionado !== 'Aprendiz') e.target.style.background = 'var(--color-surface-2)';
            }}
          >
            Aprendiz ({balaustres.filter(b => {
              const grau = (b.grau_sessao || '').trim().toLowerCase();
              return grau === 'aprendiz';
            }).length})
          </button>
          <button
            onClick={() => { setGrauSelecionado('Companheiro'); setAnoSelecionado(null); }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              grauSelecionado === 'Companheiro'
                ? 'bg-green-600 text-white'
                : '  '
            }`}
          >
            Companheiro ({balaustres.filter(b => {
              const grau = (b.grau_sessao || '').trim().toLowerCase();
              return grau === 'companheiro';
            }).length})
          </button>
          <button
            onClick={() => { setGrauSelecionado('Mestre'); setAnoSelecionado(null); }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              grauSelecionado === 'Mestre'
                ? 'bg-purple-600 text-white'
                : '  '
            }`}
          >
            Mestre ({balaustres.filter(b => {
              const grau = (b.grau_sessao || '').trim().toLowerCase();
              return grau === 'mestre';
            }).length})
          </button>
        </div>

        {/* Seletor de ano */}
        {anosDisponiveis.length >= 1 && (
          <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginTop:'0.75rem'}}>
            <span style={{fontSize:'0.75rem',fontWeight:'600',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.04em',flexShrink:0}}>Ano:</span>
            <select
              value={anoSelecionado ?? ''}
              onChange={e => setAnoSelecionado(e.target.value ? parseInt(e.target.value) : null)}
              style={{padding:'0.3rem 0.75rem',borderRadius:'var(--radius-lg)',border:'1px solid var(--color-border)',background:'var(--color-surface-2)',color:'var(--color-text)',fontSize:'0.85rem',cursor:'pointer',outline:'none'}}
            >
              <option value=''>Todos</option>
              {anosDisponiveis.map(ano => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* LISTAGEM */}
      {/* Verificar se usuário tem permissão para ver esta aba */}
      {(() => {
        const grauUser = grauUsuario?.toLowerCase() || '';
        const grauAba = grauSelecionado.toLowerCase();
        
        // Aprendiz tentando ver Companheiro
        if (grauUser === 'aprendiz' && grauAba === 'companheiro') {
          return (
            <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
              <div className="text-6xl mb-4">🔒</div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text)', marginBottom: '0.5rem' }}>Acesso Restrito</h3>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Balaustres de <strong>Companheiro</strong> são restritos.</p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Você precisa ser <strong>Companheiro</strong> ou superior para acessar.</p>
            </div>
          );
        }
        
        // Aprendiz tentando ver Mestre
        if (grauUser === 'aprendiz' && grauAba === 'mestre') {
          return (
            <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
              <div className="text-6xl mb-4">🔒</div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text)', marginBottom: '0.5rem' }}>Acesso Restrito</h3>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Balaustres de <strong>Mestre</strong> são restritos.</p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Você precisa ser <strong>Mestre ou Mestre Instalado</strong> para acessar.</p>
            </div>
          );
        }
        
        // Companheiro tentando ver Mestre
        if (grauUser === 'companheiro' && grauAba === 'mestre') {
          return (
            <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
              <div className="text-6xl mb-4">🔒</div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text)', marginBottom: '0.5rem' }}>Acesso Restrito</h3>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Balaustres de <strong>Mestre</strong> são restritos.</p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Você precisa ser <strong>Mestre ou Mestre Instalado</strong> para acessar.</p>
            </div>
          );
        }
        
        // Se passou nas verificações, mostrar a listagem normal
        return (
          <div style={{background:"var(--color-surface)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-xl)",overflow:"hidden",width:"100%",boxSizing:"border-box"}}>
                <div style={{padding:"0.75rem",width:"100%",boxSizing:"border-box",overflow:"hidden"}}>
                  {(() => {
                    const getAnoBal = b => b.ano_balaustre ? parseInt(b.ano_balaustre) : (b.data_sessao ? new Date(b.data_sessao+'T00:00:00').getFullYear() : new Date().getFullYear());
                    const lista = balaustresFiltradosPorAcesso
                      .filter(b => anoSelecionado ? getAnoBal(b) === anoSelecionado : true)
                      .sort((a, b) => {
                        const anoA = getAnoBal(a), anoB = getAnoBal(b);
                        if (anoB !== anoA) return anoB - anoA;
                        return b.numero_balaustre - a.numero_balaustre;
                      });
                    const renderLinha = (balaustre, idx) => (
                        <div key={balaustre.id}
                          className="rounded-lg border-l-4 flex items-center gap-3 px-3 py-3 transition-opacity hover:opacity-90"
                          style={{
                            borderLeftColor: corDoGrau(balaustre.grau_sessao),
                            background: ehPendente(balaustre) ? 'rgba(245,158,11,0.10)' : (idx%2===0 ? 'var(--color-surface)' : 'var(--color-surface-2)'),
                            outline: ehPendente(balaustre) ? '1px dashed rgba(245,158,11,0.7)' : 'none',
                            width: '100%',
                            boxSizing: 'border-box',
                            overflow: 'hidden',
                            minWidth: 0
                          }}
                        >
                          {/* Número/Ano */}
                          <div style={{flexShrink:0,width:'150px'}}>
                            <p className="font-bold text-sm" style={{color: ehPendente(balaustre) ? '#d97706' : corDoGrau(balaustre.grau_sessao)}}>{ehPendente(balaustre) ? '⏳ Pend.' : `${balaustre.numero_balaustre}/${balaustre.ano_balaustre || new Date().getFullYear()}`}</p>
                            {balaustre.eleicao_glemt?.ativo && (
                              <span style={{display:'inline-block',marginTop:'0.2rem',fontSize:'0.62rem',fontWeight:800,padding:'0.1rem 0.45rem',borderRadius:'999px',background:'rgba(139,92,246,0.15)',color:'#8b5cf6',border:'1px solid rgba(139,92,246,0.4)',whiteSpace:'nowrap'}}>
                                🗳️ GLEMT {balaustre.eleicao_glemt.ano_inicio}–{balaustre.eleicao_glemt.ano_fim}
                              </span>
                            )}
                            {balaustre.sessao_especial === 'eleicao_loja' && (
                              <span style={{display:'inline-block',marginTop:'0.2rem',fontSize:'0.62rem',fontWeight:800,padding:'0.1rem 0.45rem',borderRadius:'999px',background:'rgba(201,168,76,0.15)',color:'#c9a84c',border:'1px solid rgba(201,168,76,0.45)',whiteSpace:'nowrap'}}>
                                🏛️ Eleição {gestaoDe(balaustre.eleicao_id)}
                              </span>
                            )}
                            {balaustre.sessao_especial === 'posse_loja' && (
                              <span style={{display:'inline-block',marginTop:'0.2rem',fontSize:'0.62rem',fontWeight:800,padding:'0.1rem 0.45rem',borderRadius:'999px',background:'rgba(201,168,76,0.15)',color:'#c9a84c',border:'1px solid rgba(201,168,76,0.45)',whiteSpace:'nowrap'}}>
                                🎖️ Posse {gestaoDe(balaustre.eleicao_id)}
                              </span>
                            )}
                            <p className="text-xs" style={{color:'var(--color-text-muted)'}}>{balaustre.dia_semana}</p>
                          </div>
                          {/* Data */}
                          <div style={{flexShrink:0,width:'100px'}}>
                            <p className="text-xs" style={{color:'var(--color-text-muted)',whiteSpace:'nowrap',margin:0}}>📅 {formatarData(balaustre.data_sessao)}</p>
                          </div>
                          {/* Tipo */}
                          <div style={{flexShrink:0,width:'110px',overflow:'hidden'}}>
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800" style={{display:"inline-block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"100%"}}>
                              {obterNomeTipoSessao(balaustre.tipo_sessao_id)}
                            </span>
                          </div>
                          {/* Ordem do dia */}
                          <div style={{flex:1,minWidth:0,width:0,overflow:'hidden'}}>
                            <p style={{color:'var(--color-text-muted)',fontSize:'0.85rem',margin:0,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',lineHeight:1.35}}>
                              {balaustre.ordem_dia || '—'}
                            </p>
                          </div>
                          {/* Ações */}
                          <div className="flex gap-1.5" style={{flexShrink:0}}>
                            {balaustre.eleicao_glemt?.ativo ? (
                              // Eleição GLEMT: tudo no modal (configuração, aptos e presença, apuração, documentos)
                              <button onClick={() => setModalGLEMT(balaustre)}
                                style={{padding:'0.25rem 0.7rem',background:'rgba(139,92,246,0.15)',color:'#8b5cf6',border:'1px solid rgba(139,92,246,0.5)',borderRadius:'var(--radius-md)',fontSize:'0.8rem',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}
                                title="Abrir a Eleição GLEMT">🗳️ Eleição GLEMT</button>
                            ) : balaustre.sessao_especial ? (
                              // Eleição/Posse da Loja: a ata é gerada na tela Eleição e Posse
                              <button onClick={() => onAbrirEleicaoPosse && onAbrirEleicaoPosse()}
                                style={{padding:'0.25rem 0.55rem',background:'rgba(201,168,76,0.15)',color:'#c9a84c',border:'1px solid rgba(201,168,76,0.4)',borderRadius:'var(--radius-md)',fontSize:'0.8rem',cursor:'pointer'}}
                                title="A ata desta sessão é gerada em Eleição e Posse — abrir">⚖️</button>
                            ) : (
                              <button onClick={() => gerarAta(balaustre)} disabled={gerandoAta === balaustre.id}
                                style={{padding:'0.25rem 0.55rem',background:'rgba(201,168,76,0.15)',color:'#c9a84c',border:'1px solid rgba(201,168,76,0.4)',borderRadius:'var(--radius-md)',fontSize:'0.8rem',cursor:'pointer'}}
                                title="Gerar ata (Word)">{gerandoAta === balaustre.id ? '⏳' : '📄'}</button>
                            )}
                            <button onClick={() => handleVisualizar(balaustre)}
                              style={{padding:'0.25rem 0.55rem',background:'rgba(16,185,129,0.15)',color:'#10b981',border:'1px solid rgba(16,185,129,0.3)',borderRadius:'var(--radius-md)',fontSize:'0.82rem',cursor:'pointer'}}
                              title="Visualizar">👁️</button>
                            {permissoes?.pode_editar_balaustres && (<>
                              <button onClick={() => handleEditar(balaustre)}
                                style={{padding:'0.25rem 0.55rem',background:'var(--color-accent-bg)',color:'var(--color-accent)',border:'1px solid var(--color-accent)',borderRadius:'var(--radius-md)',fontSize:'0.82rem',cursor:'pointer'}}>✏️</button>
                              <button onClick={() => handleExcluir(balaustre.id)}
                                style={{padding:'0.25rem 0.55rem',background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'var(--radius-md)',fontSize:'0.82rem',cursor:'pointer'}}>🗑️</button>
                            </>)}
                          </div>
                        </div>
);
                    // Pendentes (eleição GLEMT agendada) no topo, fora dos grupos por ano
                    const pendentes = lista.filter(ehPendente);
                    const listaNormal = lista.filter(b => !ehPendente(b));
                    const blocoPendentes = pendentes.length > 0 && (
                      <div key="pendentes" style={{marginBottom:'0.5rem'}}>
                        <div style={{display:'flex',alignItems:'center',gap:'0.75rem',margin:'0.25rem 0 0.5rem',padding:'0.4rem 0.75rem',borderRadius:'var(--radius-lg)',background:'rgba(245,158,11,0.12)',borderLeft:'3px solid #f59e0b'}}>
                          <span style={{fontWeight:'700',fontSize:'0.9rem',color:'#d97706'}}>⏳ Sessões pendentes</span>
                          <span style={{fontSize:'0.75rem',color:'var(--color-text-muted)'}}>{pendentes.length} agendada(s) — sem número até serem realizadas</span>
                        </div>
                        {pendentes.map((b, i) => renderLinha(b, i))}
                      </div>
                    );
                    if (lista.length === 0) return (
                      <div className="text-center py-8" style={{color:'var(--color-text-faint)'}}>
                        Nenhum balaustre cadastrado
                      </div>
                    );
                    // Agrupar por ano
                    const grupos = listaNormal.reduce((acc, b) => {
                      const ano = getAnoBal(b);
                      if (!acc[ano]) acc[ano] = [];
                      acc[ano].push(b);
                      return acc;
                    }, {});
                    const anosGrupo = Object.keys(grupos).map(Number).sort((a,b) => b-a);
                    return [blocoPendentes, ...anosGrupo.map(ano => (
                      <div key={ano} style={{overflow:'hidden',maxWidth:'100%'}}>
                        {/* Cabeçalho do ano */}
                        <div style={{display:'flex',alignItems:'center',gap:'0.75rem',margin:'0.75rem 0 0.5rem',padding:'0.4rem 0.75rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',borderLeft:'3px solid var(--color-accent)'}}>
                          <span style={{fontWeight:'700',fontSize:'0.9rem',color:'var(--color-accent)'}}>📅 {ano}</span>
                          <span style={{fontSize:'0.75rem',color:'var(--color-text-muted)'}}>{grupos[ano].length} balaustre(s)</span>
                        </div>
                        {grupos[ano].map((balaustre, idx) => renderLinha(balaustre, idx))}
                      </div>
                    ))];
                  })()}
                </div>
          </div>
        );
      })()}

      {/* ELEIÇÃO GLEMT — modal com as 4 abas */}
      {modalGLEMT && (
        <EleicaoGLEMTModal
          balaustre={modalGLEMT}
          podeEditar={!!permissoes?.pode_editar_balaustres}
          onClose={() => setModalGLEMT(null)}
          onSaved={onUpdate}
          onMarcarRealizada={marcarRealizada}
          onVoltarPendente={voltarPendente}
          userData={userData}
          showSuccess={showSuccess}
          showError={showError}
        />
      )}

      {/* ESCOLHA DO MODELO DE ATA */}
      {escolhaModelo && (
        <div onClick={() => setEscolhaModelo(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:60,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
          <div onClick={e => e.stopPropagation()} style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-xl)',padding:'1.5rem',maxWidth:'420px',width:'100%'}}>
            <h3 style={{margin:'0 0 0.3rem',fontSize:'1rem',fontWeight:800,color:'var(--color-text)'}}>📄 Qual modelo de ata?</h3>
            <p style={{margin:'0 0 1rem',fontSize:'0.82rem',color:'var(--color-text-muted)'}}>
              Balaustre {escolhaModelo.balaustre.numero_balaustre}/{escolhaModelo.balaustre.ano_balaustre} — {escolhaModelo.balaustre.grau_sessao}
            </p>
            <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
              {escolhaModelo.modelos.map(m => (
                <button key={m.id} onClick={() => gerarAtaComModelo(escolhaModelo.balaustre, m.id)}
                  style={{padding:'0.65rem 0.9rem',textAlign:'left',background:'var(--color-surface-2)',color:'var(--color-text)',border:`1px solid ${corDoGrau(escolhaModelo.balaustre.grau_sessao)}`,borderRadius:'var(--radius-lg)',fontWeight:700,fontSize:'0.88rem',cursor:'pointer'}}>
                  📄 {m.nome}
                </button>
              ))}
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',marginTop:'1rem'}}>
              <button onClick={() => setEscolhaModelo(null)}
                style={{padding:'0.5rem 1rem',background:'transparent',color:'var(--color-text-muted)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',fontWeight:600,cursor:'pointer'}}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* AVISO: sem balaustre para hoje */}
      {avisoSemBalaustre && (
        <div onClick={() => setAvisoSemBalaustre(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:60,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
          <div onClick={e => e.stopPropagation()} style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-xl)',padding:'1.5rem',maxWidth:'440px',width:'100%'}}>
            <h3 style={{margin:'0 0 0.5rem',fontSize:'1rem',fontWeight:800,color:'var(--color-text)'}}>⚠️ Sem balaustre para hoje</h3>
            <p style={{margin:'0 0 1.25rem',fontSize:'0.88rem',color:'var(--color-text-muted)'}}>
              Não há balaustre cadastrado para hoje ({hojeISO.split('-').reverse().join('/')}). Cadastre o balaustre antes de gerar a ata.
            </p>
            <div style={{display:'flex',gap:'0.5rem',justifyContent:'flex-end'}}>
              <button onClick={() => setAvisoSemBalaustre(false)}
                style={{padding:'0.55rem 1.1rem',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',fontWeight:600,cursor:'pointer'}}>Fechar</button>
              {permissoes?.pode_editar_balaustres && (
                <button onClick={() => {
                  setAvisoSemBalaustre(false);
                  limparFormulario();
                  setBalaustreForm(f => ({ ...f, grau_sessao: grauSelecionado, data_sessao: hojeISO }));
                  setModalAberto(true);
                }} style={{padding:'0.55rem 1.1rem',background:'var(--color-accent)',color:'#fff',border:'none',borderRadius:'var(--radius-lg)',fontWeight:700,cursor:'pointer'}}>➕ Cadastrar agora</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE VISUALIZAÇÃO */}
      {modalVisualizar && balaustreVisualizando && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <div className="bg-blue-900 text-white p-6 rounded-t-xl">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>
                  📋 Balaustre Nº {balaustreVisualizando.numero_balaustre} - {balaustreVisualizando.grau_sessao}
                </h3>
                <button
                  onClick={() => setModalVisualizar(false)}
                  className="text-white hover:text-gray-200 text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Informações da Sessão */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="p-4 rounded-lg" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                  <label className="block text-sm font-semibold mb-2" style={{color:"var(--color-text-muted)"}}>Grau da Sessão</label>
                  <p className="text-lg font-medium">{balaustreVisualizando.grau_sessao}</p>
                </div>

                <div className="p-4 rounded-lg" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                  <label className="block text-sm font-semibold mb-2" style={{color:"var(--color-text-muted)"}}>Número do Balaustre</label>
                  <p className="text-lg font-medium">{balaustreVisualizando.numero_balaustre}</p>
                </div>

                <div className="p-4 rounded-lg" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                  <label className="block text-sm font-semibold mb-2" style={{color:"var(--color-text-muted)"}}>Data da Sessão</label>
                  <p className="text-lg font-medium">{formatarData(balaustreVisualizando.data_sessao)}</p>
                </div>

                <div className="p-4 rounded-lg" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                  <label className="block text-sm font-semibold mb-2" style={{color:"var(--color-text-muted)"}}>Dia da Semana</label>
                  <p className="text-lg font-medium">{balaustreVisualizando.dia_semana}</p>
                </div>

                <div className="p-4 rounded-lg md:col-span-2" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                  <label className="block text-sm font-semibold mb-2" style={{color:"var(--color-text-muted)"}}>Tipo de Sessão</label>
                  <p className="text-lg font-medium">{obterNomeTipoSessao(balaustreVisualizando.tipo_sessao_id)}</p>
                </div>
              </div>

              {/* Ordem do Dia */}
              <div className="mb-6">
                <div className="bg-blue-50 p-4 rounded-lg" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                  <label className="block text-sm font-semibold text-blue-900 mb-3" style={{color:"var(--color-text-muted)"}}>📝 Ordem do Dia</label>
                  <div className="whitespace-pre-wrap" style={{color:"var(--color-text)"}}>
                    {balaustreVisualizando.ordem_dia || <span className="italic">Não informada</span>}
                  </div>
                </div>
              </div>

              {/* Observações */}
              {balaustreVisualizando.observacoes && (
                <div className="mb-6">
                  <div className="bg-yellow-50 p-4 rounded-lg" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                    <label className="block text-sm font-semibold text-yellow-900 mb-3" style={{color:"var(--color-text-muted)"}}>💡 Observações</label>
                    <div className="whitespace-pre-wrap" style={{color:"var(--color-text)"}}>
                      {balaustreVisualizando.observacoes}
                    </div>
                  </div>
                </div>
              )}

              {/* Botão Fechar */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button onClick={() => gerarAta(balaustreVisualizando)}
                  style={{padding:'0.5rem 1.25rem',background:'#c9a84c',color:'#1a1a1a',border:'none',borderRadius:'var(--radius-lg)',fontWeight:700,cursor:'pointer'}}>
                  📄 Gerar Ata
                </button>
                <button
                  onClick={() => setModalVisualizar(false)}
                  className="px-6 py-2 bg-gray-500 text-white rounded-lg transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Balaustres;
