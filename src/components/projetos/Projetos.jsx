import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { gerarRelatorioProjetosPDF } from '../../utils/gerarRelatorioProjetosPDF';
import { gerarRelatorioProjetoDetalhadoPDF } from '../../utils/gerarRelatorioProjetoDetalhadoPDF';

// Mesmas imagens decorativas já usadas no "Visualizar" do Cronograma —
// reaproveita o mesmo bucket, sem subir nada novo.
const IMG_SOL = supabase.storage.from('cronograma').getPublicUrl('sol.png').data.publicUrl;
const IMG_LUA = supabase.storage.from('cronograma').getPublicUrl('lua.png').data.publicUrl;
const IMG_COLUNA_B = supabase.storage.from('cronograma').getPublicUrl('coluna-b.png').data.publicUrl;
const IMG_COLUNA_J = supabase.storage.from('cronograma').getPublicUrl('coluna-j.png').data.publicUrl;

// Exercício (ano) de um projeto/campanha = ano da data de início.
const anoDoProjeto = (p) => (p?.data_inicio ? String(p.data_inicio).substring(0, 4) : 'Sem data');

export default function Projetos({ showSuccess, showError, permissoes }) {
  const [projetos, setProjetos] = useState([]);
  const [modalVisualizacao, setModalVisualizacao] = useState(false);
  const [projetoVisualizar, setProjetoVisualizar] = useState(null);
  const [modalRelatorio, setModalRelatorio] = useState(false);
  const [anoRelatorio, setAnoRelatorio] = useState('todos');
  const [dadosLoja, setDadosLoja] = useState({ logo_url: '', nome_loja: 'A∴R∴L∴S∴ Acácia de Paranatinga nº 30' });
  const [todosOsCustos, setTodosOsCustos] = useState([]);
  const [todasAsReceitas, setTodasAsReceitas] = useState([]);
  const [custosDoModal, setCustosDoModal] = useState([]);
  const [arquivosDoModal, setArquivosDoModal] = useState([]);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [receitasDoModal, setReceitasDoModal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [projetoEditando, setProjetoEditando] = useState(null);
  const [projetoSelecionado, setProjetoSelecionado] = useState(null);
  const [mostrarFinanceiro, setMostrarFinanceiro] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('receitas');
  // Visualização Agrupada (padrão) x Detalhada. Agrupada é só leitura —
  // edição fica bloqueada nela de propósito, porque uma linha agrupada
  // pode somar vários registros reais, e editar ali corrompe o registro
  // errado (já aconteceu). Pra editar, precisa desmarcar e ver Detalhado.
  const [verAgrupado, setVerAgrupado] = useState(true);
  const [custoForm, setCustoForm] = useState({});
  const [receitaForm, setReceitaForm] = useState({});
  const [receitaEditando, setReceitaEditando] = useState(null);
  const [custoEditando, setCustoEditando] = useState(null);
  const [mostrarFormReceita, setMostrarFormReceita] = useState(false);
  const [mostrarFormCusto, setMostrarFormCusto] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [projetoForm, setProjetoForm] = useState({
    nome: '',
    descricao: '',
    tipo: 'social',
    prazo: 'curto',
    data_inicio: '',
    data_prevista_termino: '',
    data_finalizacao: '',
    responsavel: '',
    observacoes: '',
    valor_previsto: 0,
    fonte_recursos: '',
    status: 'em_andamento'
  });

  const tiposProjeto = [
    { value: 'campanha', label: '🎗️ Campanha', style: {background:'rgba(245,158,11,0.15)',color:'#f59e0b',border:'2px solid rgba(245,158,11,0.5)'} },
    { value: 'social', label: '🤝 Social', style: {background:'rgba(59,130,246,0.15)',color:'#3b82f6',border:'1px solid rgba(59,130,246,0.3)'} },
    { value: 'administrativo', label: '📋 Administrativo', style: {background:'rgba(139,92,246,0.15)',color:'#8b5cf6',border:'1px solid rgba(139,92,246,0.3)'} },
    { value: 'beneficente', label: '❤️ Beneficente', style: {background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)'} },
    { value: 'patrimonial', label: '🏛️ Patrimonial', style: {background:'rgba(16,185,129,0.15)',color:'#10b981',border:'1px solid rgba(16,185,129,0.3)'} },
    { value: 'outro', label: '📌 Outro', cor: ' ' }
  ];

  const prazosProjeto = [
    { value: 'curto', label: '⚡ Curto Prazo (até 6 meses)' },
    { value: 'medio', label: '📅 Médio Prazo (6-12 meses)' },
    { value: 'longo', label: '🎯 Longo Prazo (+ de 1 ano)' }
  ];

  const categoriasCusto = [
    'Material', 'Serviço', 'Equipamento', 'Transporte',
    'Alimentação', 'Divulgação', 'Outro'
  ];

  const formasPagamento = [
    'Dinheiro', 'PIX', 'Transferência', 'Cartão', 'Cheque', 'Boleto'
  ];

  const origensReceita = [
    'Caixa da Loja', 'Doação', 'Evento', 'Rifa', 'Bazar',
    'Contribuição Especial', 'Patrocínio', 'Outro'
  ];

  useEffect(() => {
    carregarProjetos();
    carregarDadosLoja();
  }, []);

  const carregarDadosLoja = async () => {
    try {
      const { data } = await supabase.from('dados_loja').select('*').single();
      if (data) setDadosLoja({ logo_url: data.logo_url || '', nome_loja: data.nome_loja || 'A∴R∴L∴S∴ Acácia de Paranatinga nº 30', endereco: data.endereco || '' });
    } catch (e) { /* mantém o padrão se não achar configuração */ }
  };

  // Resumo em PDF pra enviar aos irmãos — filtrado por exercício (ou todos).
  const gerarRelatorio = () => {
    if (!permissoes?.canEdit) return; // relatório só para quem edita projetos
    try {
      const lista = projetos
        .filter(p => anoRelatorio === 'todos' || anoDoProjeto(p) === anoRelatorio)
        .map(p => {
          const totalCustos = calcularTotalCustos(p);
          const totalReceitas = calcularTotalReceitas(p);
          const meta = parseFloat(p.valor_previsto) || 0;
          const ehCampanha = p.tipo === 'campanha';
          return {
            nome: p.nome, descricao: p.descricao, tipo: p.tipo,
            tipoLabel: tiposProjeto.find(t => t.value === p.tipo)?.label || p.tipo,
            status: p.status, statusLabel: statusLabels[p.status]?.label || p.status,
            ano: anoDoProjeto(p),
            data_inicio: p.data_inicio, data_prevista_termino: p.data_prevista_termino, responsavel: p.responsavel,
            valorPrevisto: meta, totalReceitas, totalCustos,
            saldo: calcularSaldo(p, totalCustos, totalReceitas),
            pct: ehCampanha ? (meta > 0 ? (totalReceitas / meta) * 100 : 0) : calcularPercentual(p, totalCustos),
          };
        });
      gerarRelatorioProjetosPDF(lista, dadosLoja, anoRelatorio);
      setModalRelatorio(false);
    } catch (e) {
      showError?.('Erro ao gerar relatório: ' + e.message);
    }
  };

  const abrirModalRelatorio = () => {
    if (!permissoes?.canEdit) return; // relatório só para quem edita projetos
    const anosReais = [...new Set(projetos.map(anoDoProjeto).filter(a => a !== 'Sem data'))].sort((a, b) => b.localeCompare(a));
    setAnoRelatorio(anosReais[0] || 'todos');
    setModalRelatorio(true);
  };

  // Relatório detalhado de UM projeto/campanha (movimentação financeira) — para apresentar aos irmãos.
  const gerarRelatorioDetalhado = (projeto) => {
    if (!permissoes?.canEdit) return; // relatório só para quem edita projetos
    try {
      gerarRelatorioProjetoDetalhadoPDF({
        projeto,
        tipoLabel: tiposProjeto.find(t => t.value === projeto.tipo)?.label || projeto.tipo,
        statusLabel: statusLabels[projeto.status]?.label || projeto.status,
        receitas: todasAsReceitas.filter(r => r.projeto_id === projeto.id),
        custos: todosOsCustos.filter(c => c.projeto_id === projeto.id),
        dadosLoja,
      });
    } catch (e) {
      showError?.('Erro ao gerar relatório: ' + e.message);
    }
  };

  const carregarProjetos = async () => {
    setLoading(true);

    const { data: projetosData, error: projetosError } = await supabase
      .from('projetos')
      .select('*')
      .order('data_inicio', { ascending: false });

    if (projetosError) {
      showError('Erro ao carregar projetos');
      setLoading(false);
      return;
    }

    const { data: custosData } = await supabase.from('custos_projeto').select('*');
    const { data: receitasData } = await supabase.from('receitas_projeto').select('*');

    setProjetos(projetosData || []);
    setTodosOsCustos(custosData || []);
    setTodasAsReceitas(receitasData || []);
    setLoading(false);
  };

  const carregarCustos = async (projetoId) => {
    const { data, error } = await supabase
      .from('custos_projeto')
      .select('*')
      .eq('projeto_id', projetoId)
      .order('data_custo', { ascending: false });
    if (!error) setCustosDoModal(data || []);
  };

  const carregarReceitas = async (projetoId) => {
    const { data, error } = await supabase
      .from('receitas_projeto')
      .select('*')
      .eq('projeto_id', projetoId)
      .order('data_receita', { ascending: false });
    if (!error) setReceitasDoModal(data || []);
  };

  const carregarArquivos = async (projetoId) => {
    const { data, error } = await supabase
      .from('projeto_arquivos')
      .select('*')
      .eq('projeto_id', projetoId)
      .order('created_at', { ascending: false });
    if (!error) setArquivosDoModal(data || []);
  };

  // Extensão -> ícone, só pra dar uma pista visual do tipo antes de abrir
  const iconeArquivo = (nomeOuMime) => {
    const s = (nomeOuMime || '').toLowerCase();
    if (s.includes('pdf')) return '📕';
    if (s.includes('image') || /\.(png|jpe?g|gif|webp|svg)$/.test(s)) return '🖼️';
    if (s.includes('text') || /\.(txt|csv)$/.test(s)) return '📄';
    if (/\.(docx?|odt)$/.test(s)) return '📝';
    if (/\.(xlsx?|ods)$/.test(s)) return '📊';
    if (/\.(zip|rar|7z)$/.test(s)) return '🗜️';
    return '📎';
  };

  const formatarTamanho = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Um input multi-arquivo dispara isto; sobe cada arquivo em sequência
  // (upload paralelo dá mais chance de erro de rede em conexão de lodge/interior).
  const handleUploadArquivos = async (event) => {
    const arquivos = Array.from(event.target.files || []);
    if (arquivos.length === 0 || !projetoSelecionado) return;
    setEnviandoArquivo(true);
    try {
      for (const file of arquivos) {
        const path = `${projetoSelecionado.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error: uploadError } = await supabase.storage.from('projeto-arquivos').upload(path, file);
        if (uploadError) throw uploadError;
        const url = supabase.storage.from('projeto-arquivos').getPublicUrl(path).data.publicUrl;
        const { error: dbError } = await supabase.from('projeto_arquivos').insert({
          projeto_id: projetoSelecionado.id,
          nome_arquivo: file.name,
          tipo_mime: file.type || null,
          path, url,
          tamanho_bytes: file.size,
        });
        if (dbError) throw dbError;
      }
      showSuccess(arquivos.length > 1 ? `✅ ${arquivos.length} arquivos enviados!` : '✅ Arquivo enviado!');
      carregarArquivos(projetoSelecionado.id);
    } catch (e) {
      showError('Erro ao enviar arquivo: ' + e.message);
    } finally {
      setEnviandoArquivo(false);
      event.target.value = '';
    }
  };

  const excluirArquivoProjeto = async (arquivo) => {
    if (!window.confirm(`Excluir "${arquivo.nome_arquivo}"?`)) return;
    try {
      await supabase.storage.from('projeto-arquivos').remove([arquivo.path]);
      const { error } = await supabase.from('projeto_arquivos').delete().eq('id', arquivo.id);
      if (error) throw error;
      showSuccess('✅ Arquivo excluído!');
      carregarArquivos(projetoSelecionado.id);
    } catch (e) {
      showError('Erro ao excluir arquivo: ' + e.message);
    }
  };

  const abrirFinanceiro = (projeto, aba = 'receitas') => {
    setProjetoSelecionado(projeto);
    setAbaAtiva(aba);
    carregarReceitas(projeto.id);
    carregarCustos(projeto.id);
    carregarArquivos(projeto.id);
    setMostrarFinanceiro(true);
  };

  const fecharFinanceiro = () => {
    setMostrarFinanceiro(false);
    setProjetoSelecionado(null);
    setReceitasDoModal([]);
    setCustosDoModal([]);
    setArquivosDoModal([]);
    setReceitaForm({});
    setCustoForm({});
    setMostrarFormReceita(false);
    setMostrarFormCusto(false);
  };

  const salvarProjeto = async (e) => {
    e.preventDefault();
    const dadosParaSalvar = {
      ...projetoForm,
      valor_previsto: parseFloat(projetoForm.valor_previsto) || 0,
      data_prevista_termino: projetoForm.data_prevista_termino || null,
      data_finalizacao: projetoForm.data_finalizacao || null
    };

    if (projetoEditando) {
      const { error } = await supabase.from('projetos').update(dadosParaSalvar).eq('id', projetoEditando.id);
      if (error) { showError('Erro ao atualizar projeto: ' + error.message); }
      else { showSuccess('Projeto atualizado com sucesso!'); limparFormulario(); carregarProjetos(); }
    } else {
      const { error } = await supabase.from('projetos').insert([dadosParaSalvar]);
      if (error) { showError('Erro ao criar projeto: ' + error.message); }
      else { showSuccess('Projeto cadastrado com sucesso!'); limparFormulario(); carregarProjetos(); }
    }
  };

  const limparFormulario = () => {
    setProjetoForm({
      nome: '', descricao: '', tipo: 'social', prazo: 'curto',
      data_inicio: '', data_prevista_termino: '', data_finalizacao: '',
      responsavel: '', observacoes: '', valor_previsto: 0,
      fonte_recursos: '', status: 'em_andamento'
    });
    setProjetoEditando(null);
    setMostrarFormulario(false);
  };

  const editarProjeto = (projeto) => {
    setProjetoForm(projeto);
    setProjetoEditando(projeto);
    setMostrarFormulario(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
  };

  const excluirProjeto = async (id) => {
    if (!confirm('Deseja excluir este projeto? Todos os custos associados também serão excluídos.')) return;
    const { error } = await supabase.from('projetos').delete().eq('id', id);
    if (error) { showError('Erro ao excluir projeto'); }
    else { showSuccess('Projeto excluído com sucesso!'); carregarProjetos(); }
  };

  const adicionarCusto = async (e) => {
    e.preventDefault();
    // Monta o payload só com colunas reais da tabela — nunca espalha o
    // formulário inteiro (mantém como camada extra de segurança, mesmo
    // com o agrupamento por data já removido da tela).
    const dadosCusto = {
      projeto_id: projetoSelecionado.id,
      data_custo: custoForm.data_custo,
      descricao: custoForm.descricao,
      valor: parseFloat(custoForm.valor) || 0,
      categoria: custoForm.categoria,
      forma_pagamento: custoForm.forma_pagamento,
      responsavel: custoForm.responsavel || null,
      observacao: custoForm.observacao || null,
    };

    if (custoEditando) {
      const { error } = await supabase.from('custos_projeto').update(dadosCusto).eq('id', custoEditando.id);
      if (error) { showError('Erro ao salvar custo: ' + error.message); return; }
      showSuccess('Custo atualizado com sucesso!');
    } else {
      const { error } = await supabase.from('custos_projeto').insert([dadosCusto]);
      if (error) { showError('Erro ao adicionar custo: ' + error.message); return; }
      showSuccess('Custo adicionado com sucesso!');
    }
    setCustoForm({});
    setCustoEditando(null);
    setMostrarFormCusto(false);
    await carregarCustos(projetoSelecionado.id);
    await carregarProjetos();
    setRefreshKey(prev => prev + 1);
  };

  const editarCusto = (custo) => {
    setCustoForm(custo);
    setCustoEditando(custo);
    setMostrarFormCusto(true);
  };

  const excluirCusto = async (id) => {
    if (!confirm('Deseja excluir este custo?')) return;
    const { error } = await supabase.from('custos_projeto').delete().eq('id', id);
    if (error) { showError('Erro ao excluir custo'); }
    else {
      showSuccess('Custo excluído com sucesso!');
      await carregarCustos(projetoSelecionado.id);
      await carregarProjetos();
      setRefreshKey(prev => prev + 1);
    }
  };

  const adicionarReceita = async (e) => {
    e.preventDefault();
    // Mesma correção — payload só com colunas reais de receitas_projeto,
    // nunca espalhando o formulário inteiro (mantém como camada extra de
    // segurança, mesmo com o agrupamento por data já removido da tela).
    const dadosReceita = {
      projeto_id: projetoSelecionado.id,
      data_receita: receitaForm.data_receita,
      descricao: receitaForm.descricao,
      valor: parseFloat(receitaForm.valor) || 0,
      origem: receitaForm.origem,
      forma_pagamento: receitaForm.forma_pagamento,
      responsavel: receitaForm.responsavel || null,
      observacao: receitaForm.observacao || null,
    };

    if (receitaEditando) {
      // Correção manual de uma linha já existente — inclusive as que vieram
      // do Finanças Loja (o vínculo automático só acontece na criação; uma
      // vez criada, só é alterada aqui manualmente, de propósito).
      const { error } = await supabase.from('receitas_projeto').update(dadosReceita).eq('id', receitaEditando.id);
      if (error) { showError('Erro ao salvar receita: ' + error.message); return; }
      showSuccess('Receita atualizada com sucesso!');
    } else {
      const { error } = await supabase.from('receitas_projeto').insert([dadosReceita]);
      if (error) { showError('Erro ao adicionar receita: ' + error.message); return; }
      showSuccess('Receita adicionada com sucesso!');
    }
    setReceitaForm({});
    setReceitaEditando(null);
    setMostrarFormReceita(false);
    await carregarReceitas(projetoSelecionado.id);
    await carregarProjetos();
    setRefreshKey(prev => prev + 1);
  };

  const editarReceita = (receita) => {
    setReceitaForm(receita);
    setReceitaEditando(receita);
    setMostrarFormReceita(true);
  };

  const excluirReceita = async (id) => {
    if (!confirm('Deseja excluir esta receita?')) return;
    const { error } = await supabase.from('receitas_projeto').delete().eq('id', id);
    if (error) { showError('Erro ao excluir receita'); }
    else {
      showSuccess('Receita excluída com sucesso!');
      await carregarReceitas(projetoSelecionado.id);
      await carregarProjetos();
      setRefreshKey(prev => prev + 1);
    }
  };

  const calcularTotalCustos = (projeto) => {
    return todosOsCustos.filter(c => c.projeto_id === projeto.id)
      .reduce((total, c) => total + (parseFloat(c.valor) || 0), 0);
  };

  const calcularTotalReceitas = (projeto) => {
    return todasAsReceitas.filter(r => r.projeto_id === projeto.id)
      .reduce((total, r) => total + (parseFloat(r.valor) || 0), 0);
  };

  const calcularSaldo = (projeto, totalCustos, totalReceitas) => totalReceitas - totalCustos;

  const calcularPercentual = (projeto, totalCustos) => {
    const valorPrevisto = parseFloat(projeto.valor_previsto) || 0;
    if (valorPrevisto === 0) return 0;
    return (totalCustos / valorPrevisto) * 100;
  };

  const statusLabels = {
    em_andamento: { label: '🔄 Em Andamento', style: {background:'rgba(59,130,246,0.15)',color:'#3b82f6',border:'1px solid rgba(59,130,246,0.3)'} },
    concluido:    { label: '✅ Concluído',    style: {background:'rgba(16,185,129,0.15)',color:'#10b981',border:'1px solid rgba(16,185,129,0.3)'} },
    suspenso:     { label: '⏸️ Suspenso',    style: {background:'rgba(245,158,11,0.15)',color:'#f59e0b',border:'1px solid rgba(245,158,11,0.3)'} },
    cancelado:    { label: '❌ Cancelado',   style: {background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)'} }
  };

  if (loading) {
    return <div style={{textAlign:"center",padding:"3rem",color:"var(--color-text-muted)"}}>⏳ Carregando projetos...</div>;
  }

  // Lista de receitas/custos pra exibição — alterna conforme "verAgrupado":
  // Detalhado: cada linha é um registro real e único do banco (o id bate
  // certinho, então dá pra editar com segurança).
  // Agrupado: soma por data (Finanças Loja) ou por data+descrição (manual),
  // só pra visão geral — NUNCA editável (não corresponde a um único id real).
  const listaReceitasOrdenada = [...receitasDoModal].sort((a, b) => (b.data_receita || '').localeCompare(a.data_receita || ''));
  const listaCustosOrdenada = [...custosDoModal].sort((a, b) => (b.data_custo || '').localeCompare(a.data_custo || ''));

  const agrupar = (lista, campoData, campoOrigemOuCategoria) => Object.values(
    lista.reduce((acc, r) => {
      const isFL = r[campoOrigemOuCategoria] === 'Finanças Loja';
      const key = isFL ? (r[campoData] || '') + '|FL' : (r[campoData] || '') + '|' + (r.descricao || '');
      if (!acc[key]) acc[key] = { ...r, valor: 0, qtd: 0 };
      acc[key].valor += parseFloat(r.valor || 0);
      acc[key].qtd++;
      return acc;
    }, {})
  ).sort((a, b) => (b[campoData] || '').localeCompare(a[campoData] || ''));

  const receitasAgrupadas = verAgrupado ? agrupar(listaReceitasOrdenada, 'data_receita', 'origem') : listaReceitasOrdenada;
  const custosAgrupados = verAgrupado ? agrupar(listaCustosOrdenada, 'data_custo', 'categoria') : listaCustosOrdenada;

  const totalReceitasModal = receitasDoModal.reduce((s, r) => s + parseFloat(r.valor || 0), 0);
  const totalCustosModal = custosDoModal.reduce((s, c) => s + parseFloat(c.valor || 0), 0);
  const saldoModal = totalReceitasModal - totalCustosModal;

  return (
    <div className="max-w-7xl mx-auto -mx-3" style={{background:"var(--color-bg)",minHeight:"100vh",padding:"0.5rem",overflowX:"hidden"}}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6 px-3">
        <div>
          <h2 className="text-3xl font-bold" style={{color:"var(--color-text)"}}>🎯 Projetos/Campanhas da Loja</h2>
          <p className="mt-1" style={{color:"var(--color-text-muted)"}}>Gerencie os projetos, campanhas e seus custos</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {permissoes?.canEdit && (
            <button
              onClick={abrirModalRelatorio}
              style={{padding:"0.6rem 1.25rem",background:"#1e3a5f",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"700"}}
            >
              📄 Relatório
            </button>
          )}
          {permissoes?.canEdit && (
            <button
              onClick={() => setMostrarFormulario(!mostrarFormulario)}
              style={{padding:"0.6rem 1.5rem",background:"var(--color-accent)",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"700"}}
            >
              {mostrarFormulario ? '❌ Cancelar' : '➕ Novo Projeto/Campanha'}
            </button>
          )}
        </div>
      </div>

      {/* Formulário */}
      {mostrarFormulario && (
        <form onSubmit={salvarProjeto} className="rounded-xl p-6 mb-6 border-2 border-indigo-200 mx-3" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
          <h3 className="text-xl font-bold mb-4" style={{color:"var(--color-text)"}}>
            {projetoEditando ? '✏️ Editando Projeto/Campanha' : '➕ Novo Projeto/Campanha'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Nome do Projeto *</label>
              <input type="text" required value={projetoForm.nome} onChange={(e) => setProjetoForm({ ...projetoForm, nome: e.target.value })}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                placeholder="Ex: Campanha de Doação de Alimentos" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Descrição</label>
              <textarea value={projetoForm.descricao} onChange={(e) => setProjetoForm({ ...projetoForm, descricao: e.target.value })}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                rows="3" placeholder="Descreva o objetivo e escopo do projeto..." />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Tipo *</label>
              <select required value={projetoForm.tipo} onChange={(e) => setProjetoForm({ ...projetoForm, tipo: e.target.value })}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}>
                {tiposProjeto.map(tipo => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Prazo *</label>
              <select required value={projetoForm.prazo} onChange={(e) => setProjetoForm({ ...projetoForm, prazo: e.target.value })}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}>
                {prazosProjeto.map(prazo => <option key={prazo.value} value={prazo.value}>{prazo.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Data Início *</label>
              <input type="date" required value={projetoForm.data_inicio} onChange={(e) => setProjetoForm({ ...projetoForm, data_inicio: e.target.value })}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}} />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Data Prevista Término</label>
              <input type="date" value={projetoForm.data_prevista_termino} onChange={(e) => setProjetoForm({ ...projetoForm, data_prevista_termino: e.target.value })}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}} />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Data Finalização</label>
              <input type="date" value={projetoForm.data_finalizacao} onChange={(e) => setProjetoForm({ ...projetoForm, data_finalizacao: e.target.value })}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}} />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Status *</label>
              <select required value={projetoForm.status} onChange={(e) => setProjetoForm({ ...projetoForm, status: e.target.value })}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}>
                <option value="em_andamento">🔄 Em Andamento</option>
                <option value="concluido">✅ Concluído</option>
                <option value="suspenso">⏸️ Suspenso</option>
                <option value="cancelado">❌ Cancelado</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Responsável</label>
              <input type="text" value={projetoForm.responsavel} onChange={(e) => setProjetoForm({ ...projetoForm, responsavel: e.target.value })}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                placeholder="Nome do irmão responsável pelo projeto" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Valor Previsto (R$)</label>
              <input type="number" step="0.01" min="0" value={projetoForm.valor_previsto} onChange={(e) => setProjetoForm({ ...projetoForm, valor_previsto: e.target.value })}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                placeholder="0.00" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Fonte de Recursos</label>
              <input type="text" value={projetoForm.fonte_recursos} onChange={(e) => setProjetoForm({ ...projetoForm, fonte_recursos: e.target.value })}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                placeholder="Ex: Caixa da Loja, Doações, Eventos" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Observações</label>
              <textarea value={projetoForm.observacoes} onChange={(e) => setProjetoForm({ ...projetoForm, observacoes: e.target.value })}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}
                rows="2" placeholder="Informações adicionais relevantes..." />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button type="submit" style={{flex:1,padding:"0.6rem 1.5rem",background:"#10b981",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"700"}}>
              💾 {projetoEditando ? 'Atualizar Projeto' : 'Cadastrar Projeto'}
            </button>
            <button type="button" onClick={limparFormulario} className="px-6 py-3 rounded-lg transition font-bold" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}>
              ❌ Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista de Projetos */}
      <div key={refreshKey} className="px-3">
        {projetos.length === 0 ? (
          <div className="col-span-2 text-center py-12 rounded-lg" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <p className="text-lg">📋 Nenhum projeto cadastrado</p>
            {permissoes?.canEdit && (
              <button onClick={() => setMostrarFormulario(true)}
                style={{marginTop:"1rem",padding:"0.5rem 1.5rem",background:"var(--color-accent)",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer"}}>
                ➕ Cadastrar Primeiro Projeto
              </button>
            )}
          </div>
        ) : (
          (() => {
            const porAno = {};
            projetos.forEach(p => {
              const ano = anoDoProjeto(p);
              if (!porAno[ano]) porAno[ano] = [];
              porAno[ano].push(p);
            });
            const anos = Object.keys(porAno).sort((a, b) => {
              if (a === 'Sem data') return 1;
              if (b === 'Sem data') return -1;
              return b.localeCompare(a);
            });

            return anos.map((ano) => {
              const doAno = porAno[ano];
              const qtdCampanhas = doAno.filter(p => p.tipo === 'campanha').length;
              const qtdProjetos = doAno.length - qtdCampanhas;
              return (
              <div key={ano} className="mb-8">
                {/* Faixa do exercício */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'0.5rem',padding:'0.65rem 1.1rem',marginBottom:'1rem',borderRadius:'var(--radius-lg)',background:'linear-gradient(90deg, var(--color-accent) 0%, #4338ca 100%)',color:'#fff',boxShadow:'0 2px 8px rgba(0,0,0,0.2)'}}>
                  <span style={{fontSize:'1.3rem',fontWeight:'800',letterSpacing:'0.04em'}}>
                    📅 {ano === 'Sem data' ? 'Sem data de início' : `Exercício ${ano}`}
                  </span>
                  <span style={{fontSize:'0.8rem',fontWeight:'600',opacity:0.9}}>
                    {qtdProjetos} projeto(s) · {qtdCampanhas} campanha(s)
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {doAno.map((projeto) => {
            const tipoInfo = tiposProjeto.find(t => t.value === projeto.tipo);
            const statusInfo = statusLabels[projeto.status];
            const totalCustos = calcularTotalCustos(projeto);
            const totalReceitas = calcularTotalReceitas(projeto);
            const saldo = calcularSaldo(projeto, totalCustos, totalReceitas);
            const percentual = calcularPercentual(projeto, totalCustos);

            return (
              <div key={projeto.id} className="rounded-xl p-6 hover:shadow-xl transition" style={
                projeto.tipo === 'campanha'
                  ? {background:"var(--color-surface)",border:"2px solid #f59e0b",boxShadow:"0 0 0 1px rgba(245,158,11,0.15)"}
                  : {background:"var(--color-surface)",border:"1px solid var(--color-border)"}
              }>
                {/* Header do Card */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2" style={{color:"var(--color-text)"}}>{projeto.nome}</h3>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <span style={{...tipoInfo?.style||{background:'var(--color-surface-2)',color:'var(--color-text-muted)',border:'1px solid var(--color-border)'},padding:'0.2rem 0.65rem',borderRadius:'999px',fontSize:'0.7rem',fontWeight:'700'}}>
                        {tipoInfo?.label || projeto.tipo}
                      </span>
                      <span style={{...statusInfo?.style||{background:'var(--color-surface-2)',color:'var(--color-text-muted)',border:'1px solid var(--color-border)'},padding:'0.2rem 0.65rem',borderRadius:'999px',fontSize:'0.7rem',fontWeight:'700'}}>
                        {statusInfo?.label || projeto.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setProjetoVisualizar(projeto); setModalVisualizacao(true); }}
                      title="Visualizar (pra mandar no grupo)"
                      style={{padding:"0.25rem 0.55rem",background:"rgba(201,168,76,0.15)",color:"#c9a84c",border:"1px solid rgba(201,168,76,0.4)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}>
                      👁️
                    </button>
                    {permissoes?.canEdit && (
                      <>
                        <button onClick={() => gerarRelatorioDetalhado(projeto)}
                          title="Relatório em PDF — movimentação detalhada"
                          style={{padding:"0.25rem 0.55rem",background:"rgba(16,185,129,0.15)",color:"#10b981",border:"1px solid rgba(16,185,129,0.4)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}>
                          📄
                        </button>
                        <button onClick={() => editarProjeto(projeto)}
                          style={{padding:"0.25rem 0.55rem",background:"var(--color-accent-bg)",color:"var(--color-accent)",border:"1px solid var(--color-accent)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}>
                          ✏️
                        </button>
                        <button onClick={() => excluirProjeto(projeto.id)}
                          style={{padding:"0.25rem 0.55rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}>
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Descrição */}
                {projeto.descricao && (
                  <p style={{fontSize:"0.85rem",color:"var(--color-text-muted)",marginBottom:"1rem"}}>{projeto.descricao}</p>
                )}

                {/* Informações do Projeto */}
                <div className="space-y-2 mb-4 text-sm">
                  <div className="flex justify-between">
                    <span>📅 Início:</span>
                    <span className="font-semibold">{new Date(projeto.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                  </div>
                  {projeto.data_prevista_termino && (
                    <div className="flex justify-between">
                      <span>🎯 Prev. Término:</span>
                      <span className="font-semibold">{new Date(projeto.data_prevista_termino + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}
                  {projeto.data_finalizacao && (
                    <div className="flex justify-between">
                      <span>✅ Finalizado:</span>
                      <span className="font-semibold">{new Date(projeto.data_finalizacao + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}
                  {projeto.responsavel && (
                    <div className="flex justify-between">
                      <span>👤 Responsável:</span>
                      <span className="font-semibold">{projeto.responsavel}</span>
                    </div>
                  )}
                </div>

                {/* Financeiro */}
                <div className="rounded-lg p-4 space-y-3" style={{background:"var(--color-surface)",border: projeto.tipo === 'campanha' ? "1px solid rgba(245,158,11,0.4)" : "1px solid var(--color-border)"}}>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">{projeto.tipo === 'campanha' ? '🎯 Meta de Arrecadação:' : '💰 Valor Previsto:'}</span>
                    <span style={{fontSize:"1.1rem",fontWeight:"800",color: projeto.tipo === 'campanha' ? '#f59e0b' : '#3b82f6'}}>
                      R$ {parseFloat(projeto.valor_previsto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">{projeto.tipo === 'campanha' ? '💵 Arrecadado:' : '💵 Receitas:'}</span>
                    <span style={{fontSize:"1.1rem",fontWeight:"800",color:"#10b981"}}>
                      R$ {totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {projeto.tipo !== 'campanha' && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">💸 Custos:</span>
                        <span style={{fontSize:"1.1rem",fontWeight:"800",color:"#ef4444"}}>
                          R$ {totalCustos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2" style={{borderTop:"1px solid var(--color-border)",background:"var(--color-surface-2)",padding:"0.5rem 0.75rem",borderRadius:"var(--radius-md)"}}>
                        <span className="font-bold">💳 Saldo:</span>
                        <span style={{fontSize:"1.25rem",fontWeight:"800",color:saldo>=0?"#10b981":"#ef4444"}}>
                          R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </>
                  )}

                  {/* Barra de Progresso — campanha mede arrecadado vs. meta; projeto mede custo vs. previsto */}
                  {(() => {
                    const pct = projeto.tipo === 'campanha'
                      ? (parseFloat(projeto.valor_previsto) > 0 ? (totalReceitas / parseFloat(projeto.valor_previsto)) * 100 : 0)
                      : percentual;
                    return (
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>{projeto.tipo === 'campanha' ? 'Progresso da Meta' : 'Execução do Orçamento'}</span>
                          <span className="font-bold">{pct.toFixed(1)}%</span>
                        </div>
                        <div className="w-full rounded-full h-3 overflow-hidden" style={{background:"var(--color-surface-3)"}}>
                          <div
                            className="h-3 rounded-full transition-all"
                            style={{width:`${Math.min(100, pct)}%`, background: projeto.tipo === 'campanha' ? (pct >= 100 ? '#10b981' : '#f59e0b') : (pct > 100 ? '#ef4444' : pct > 75 ? '#f59e0b' : 'var(--color-accent)')}}
                          />
                        </div>
                        {projeto.tipo === 'campanha' ? (
                          pct >= 100 && <p style={{fontSize:"0.72rem",color:"#10b981",marginTop:"0.25rem"}}>🎉 Meta atingida!</p>
                        ) : (
                          pct > 100 && <p style={{fontSize:"0.72rem",color:"#ef4444",marginTop:"0.25rem"}}>⚠️ Custos ultrapassaram o valor previsto!</p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Botão único de acesso financeiro */}
                  <button
                    onClick={() => abrirFinanceiro(projeto, 'receitas')}
                    style={{width:"100%",padding:"0.5rem 1rem",background:"var(--color-accent)",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"700",fontSize:"0.9rem"}}
                  >
                    📊 Ver Financeiro do Projeto
                  </button>
                </div>
              </div>
            );
          })}
                </div>
              </div>
              );
            });
          })()
        )}
      </div>

      {/* Modal Financeiro Unificado */}
      {mostrarFinanceiro && projetoSelecionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>

            {/* Header do Modal */}
            <div style={{background:"var(--color-accent)",padding:"1.25rem 1.5rem",position:"sticky",top:0,zIndex:10,borderRadius:"0.75rem 0.75rem 0 0"}}>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold text-white">📊 Financeiro do Projeto</h3>
                  <p className="text-sm mt-1" style={{color:"rgba(255,255,255,0.85)"}}>{projetoSelecionado.nome}</p>
                </div>
                <div className="flex items-center gap-3">
                  {permissoes?.canEdit && (
                    <button onClick={() => gerarRelatorioDetalhado(projetoSelecionado)}
                      title="Relatório em PDF — movimentação detalhada"
                      style={{padding:"0.4rem 0.9rem",background:"rgba(255,255,255,0.18)",color:"#fff",border:"1px solid rgba(255,255,255,0.55)",borderRadius:"var(--radius-md)",fontSize:"0.85rem",fontWeight:700,cursor:"pointer"}}>
                      📄 Relatório PDF
                    </button>
                  )}
                  <button onClick={fecharFinanceiro} className="text-white hover:opacity-80 text-4xl leading-none">×</button>
                </div>
              </div>

              {/* Abas */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setAbaAtiva('receitas')}
                  style={{
                    padding:"0.4rem 1.2rem",
                    borderRadius:"var(--radius-lg)",
                    border:"none",
                    cursor:"pointer",
                    fontWeight:"700",
                    fontSize:"0.88rem",
                    background: abaAtiva === 'receitas' ? '#fff' : 'rgba(255,255,255,0.2)',
                    color: abaAtiva === 'receitas' ? 'var(--color-accent)' : '#fff',
                    transition:"all 0.15s"
                  }}
                >
                  💵 Receitas
                  <span style={{marginLeft:"0.4rem",fontSize:"0.75rem",opacity:0.85}}>
                    R$ {totalReceitasModal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </button>
                {projetoSelecionado?.tipo !== 'campanha' && (
                  <button
                    onClick={() => setAbaAtiva('custos')}
                    style={{
                      padding:"0.4rem 1.2rem",
                      borderRadius:"var(--radius-lg)",
                      border:"none",
                      cursor:"pointer",
                      fontWeight:"700",
                      fontSize:"0.88rem",
                      background: abaAtiva === 'custos' ? '#fff' : 'rgba(255,255,255,0.2)',
                      color: abaAtiva === 'custos' ? '#ef4444' : '#fff',
                      transition:"all 0.15s"
                    }}
                  >
                    💸 Custos
                    <span style={{marginLeft:"0.4rem",fontSize:"0.75rem",opacity:0.85}}>
                      R$ {totalCustosModal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </button>
                )}
                <button
                  onClick={() => setAbaAtiva('arquivos')}
                  style={{
                    padding:"0.4rem 1.2rem",
                    borderRadius:"var(--radius-lg)",
                    border:"none",
                    cursor:"pointer",
                    fontWeight:"700",
                    fontSize:"0.88rem",
                    background: abaAtiva === 'arquivos' ? '#fff' : 'rgba(255,255,255,0.2)',
                    color: abaAtiva === 'arquivos' ? 'var(--color-accent)' : '#fff',
                    transition:"all 0.15s"
                  }}
                >
                  📎 Arquivos
                  <span style={{marginLeft:"0.4rem",fontSize:"0.75rem",opacity:0.85}}>
                    {arquivosDoModal.length}
                  </span>
                </button>
              </div>
            </div>

            {/* Rodapé fixo de saldo */}
            <div style={{padding:"0.75rem 1.5rem",background:"var(--color-surface-2)",borderBottom:"1px solid var(--color-border)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"0.5rem"}}>
              <span style={{fontSize:"0.85rem",color:"var(--color-text-muted)"}}>
                Receitas: <strong style={{color:"#10b981"}}>R$ {totalReceitasModal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                &nbsp;·&nbsp;
                Custos: <strong style={{color:"#ef4444"}}>R$ {totalCustosModal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
              </span>
              <span style={{fontWeight:"800",fontSize:"1rem",color:saldoModal>=0?"#10b981":"#ef4444"}}>
                💳 Saldo: R$ {saldoModal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-6">

              {/* Alterna Agrupado (padrão, só leitura) x Detalhado (editável) */}
              <div style={{display:'flex',alignItems:'center',gap:'0.6rem',marginBottom:'1rem',padding:'0.6rem 0.8rem',borderRadius:'var(--radius-md)',background:'var(--color-surface-2)',border:'1px solid var(--color-border)'}}>
                <div style={{display:'flex',borderRadius:'var(--radius-md)',overflow:'hidden',border:'1px solid var(--color-border)'}}>
                  <button
                    onClick={() => setVerAgrupado(true)}
                    style={{padding:'0.35rem 0.9rem',fontSize:'0.78rem',fontWeight:700,border:'none',cursor:'pointer',
                      background: verAgrupado ? 'var(--color-accent)' : 'var(--color-surface)',
                      color: verAgrupado ? '#fff' : 'var(--color-text-muted)'}}>
                    🗂️ Agrupado
                  </button>
                  <button
                    onClick={() => setVerAgrupado(false)}
                    style={{padding:'0.35rem 0.9rem',fontSize:'0.78rem',fontWeight:700,border:'none',cursor:'pointer',
                      background: !verAgrupado ? 'var(--color-accent)' : 'var(--color-surface)',
                      color: !verAgrupado ? '#fff' : 'var(--color-text-muted)'}}>
                    📋 Detalhado
                  </button>
                </div>
                <span style={{fontSize:'0.75rem',color:'var(--color-text-muted)'}}>
                  {verAgrupado
                    ? 'Somando por data — só visualização. Pra editar ou excluir um registro, mude pra Detalhado.'
                    : 'Cada linha é um registro individual — edição e exclusão liberadas.'}
                </span>
              </div>

              {/* ABA RECEITAS */}
              {abaAtiva === 'receitas' && (
                <>
                  {permissoes?.canEdit && projetoSelecionado.status === 'em_andamento' && (
                    <div className="mb-4 flex justify-end">
                      <button
                        onClick={() => { setReceitaForm({}); setMostrarFormReceita(true); }}
                        style={{padding:"0.45rem 1.2rem",background:"#10b981",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"700",fontSize:"0.88rem"}}
                      >
                        ➕ Nova Receita
                      </button>
                    </div>
                  )}

                  {receitasAgrupadas.length === 0 ? (
                    <div className="text-center py-8"><p>📋 Nenhuma receita registrada para este projeto</p></div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table style={{width:'100%', tableLayout:'fixed', borderCollapse:'collapse'}}>
                        <thead style={{background:"var(--color-surface-2)"}}>
                          <tr style={{border:"1px solid var(--color-border)",color:"var(--color-text)"}}>
                            <th style={{width:'10%',padding:'0.5rem 0.6rem',textAlign:'left',fontSize:'0.72rem',fontWeight:700}}>Data</th>
                            <th style={{width:'27%',padding:'0.5rem 0.6rem',textAlign:'left',fontSize:'0.72rem',fontWeight:700}}>Descrição</th>
                            <th style={{width:'9%',padding:'0.5rem 0.6rem',textAlign:'left',fontSize:'0.72rem',fontWeight:700}}>Origem</th>
                            <th style={{width:'8%',padding:'0.5rem 0.6rem',textAlign:'right',fontSize:'0.72rem',fontWeight:700}}>Valor</th>
                            <th style={{width:'9%',padding:'0.5rem 0.6rem',textAlign:'left',fontSize:'0.72rem',fontWeight:700}}>Pagamento</th>
                            <th style={{width:'28%',padding:'0.5rem 0.6rem',textAlign:'left',fontSize:'0.72rem',fontWeight:700}}>Responsável</th>
                            {permissoes?.canEdit && !verAgrupado && <th style={{width:'9%',padding:'0.5rem 0.6rem',textAlign:'center',fontSize:'0.72rem',fontWeight:700}}>Ações</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {receitasAgrupadas.map((receita) => (
                            <tr key={receita.id} style={{borderBottom:"1px solid var(--color-surface-2)"}}>
                              <td style={{padding:'0.45rem 0.6rem',fontSize:'0.76rem',color:"var(--color-text)",whiteSpace:'nowrap'}}>
                                {new Date(receita.data_receita + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </td>
                              <td style={{padding:'0.45rem 0.6rem',fontSize:'0.76rem',color:"var(--color-text)",overflowWrap:'break-word'}}>
                                {receita.descricao}
                                {verAgrupado && receita.qtd > 1 && (
                                  <span style={{marginLeft:'0.4rem',fontSize:'0.65rem',fontWeight:700,color:'var(--color-accent)',whiteSpace:'nowrap'}}>({receita.qtd}x)</span>
                                )}
                              </td>
                              <td style={{padding:'0.45rem 0.6rem',fontSize:'0.76rem'}}>
                                {receita.origem === 'Finanças Loja' ? (
                                  <span style={{display:'inline-block',whiteSpace:'nowrap',padding:"0.15rem 0.4rem",borderRadius:"var(--radius-sm)",fontSize:"0.65rem",background:"rgba(59,130,246,0.15)",color:"#3b82f6",border:"1px solid rgba(59,130,246,0.3)"}}>🏦 Fin. Loja</span>
                                ) : (
                                  <span style={{display:'inline-block',whiteSpace:'nowrap',padding:"0.15rem 0.4rem",borderRadius:"var(--radius-sm)",fontSize:"0.65rem",background:"rgba(16,185,129,0.15)",color:"#10b981",border:"1px solid rgba(16,185,129,0.3)"}}>{receita.origem}</span>
                                )}
                              </td>
                              <td style={{padding:'0.45rem 0.6rem',fontSize:'0.76rem',textAlign:'right',fontWeight:700,color:"#10b981",whiteSpace:'nowrap'}}>
                                R$ {parseFloat(receita.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{padding:'0.45rem 0.6rem',fontSize:'0.76rem',color:"var(--color-text)",overflowWrap:'break-word'}}>{receita.forma_pagamento}</td>
                              <td style={{padding:'0.45rem 0.6rem',fontSize:'0.76rem',color:"var(--color-text)",overflowWrap:'break-word'}}>
                                {verAgrupado && receita.qtd > 1 ? <span style={{fontStyle:'italic',color:'var(--color-text-muted)'}}>Vários irmãos</span> : receita.responsavel}
                              </td>
                              {permissoes?.canEdit && !verAgrupado && (
                                <td style={{padding:'0.45rem 0.6rem',textAlign:'center'}}>
                                  <div style={{display:'flex',gap:'0.3rem',justifyContent:'center',alignItems:'center'}}>
                                    <button onClick={() => editarReceita(receita)} title="Corrigir manualmente"
                                      style={{padding:"0.15rem 0.4rem",borderRadius:"var(--radius-sm)",fontSize:"0.68rem",background:"rgba(99,102,241,0.15)",color:"#6366f1",border:"1px solid rgba(99,102,241,0.3)",cursor:"pointer"}}>
                                      ✏️
                                    </button>
                                    <button onClick={() => excluirReceita(receita.id)}
                                      style={{padding:"0.15rem 0.4rem",borderRadius:"var(--radius-sm)",fontSize:"0.68rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",cursor:"pointer"}}>
                                      🗑️
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{borderTop:"2px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}>
                            <td colSpan="3" style={{padding:'0.6rem',textAlign:'right',fontWeight:700,fontSize:'0.8rem',whiteSpace:'nowrap'}}>TOTAL:</td>
                            <td style={{padding:"0.6rem",textAlign:"right",fontWeight:"800",color:"#10b981",fontSize:'0.85rem',whiteSpace:'nowrap'}}>
                              R$ {totalReceitasModal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td colSpan={(permissoes?.canEdit && !verAgrupado) ? 3 : 2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* ABA CUSTOS */}
              {abaAtiva === 'custos' && (
                <>
                  {permissoes?.canEdit && projetoSelecionado.status === 'em_andamento' && (
                    <div className="mb-4 flex justify-end">
                      <button
                        onClick={() => { setCustoForm({}); setMostrarFormCusto(true); }}
                        style={{padding:"0.45rem 1.2rem",background:"var(--color-accent)",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"700",fontSize:"0.88rem"}}
                      >
                        ➕ Novo Custo
                      </button>
                    </div>
                  )}

                  {custosAgrupados.length === 0 ? (
                    <div className="text-center py-8"><p>📋 Nenhum custo registrado para este projeto</p></div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table style={{width:'100%', tableLayout:'fixed', borderCollapse:'collapse'}}>
                        <thead style={{background:"var(--color-surface-2)"}}>
                          <tr style={{border:"1px solid var(--color-border)",color:"var(--color-text)"}}>
                            <th style={{width:'10%',padding:'0.5rem 0.6rem',textAlign:'left',fontSize:'0.72rem',fontWeight:700}}>Data</th>
                            <th style={{width:'27%',padding:'0.5rem 0.6rem',textAlign:'left',fontSize:'0.72rem',fontWeight:700}}>Descrição</th>
                            <th style={{width:'9%',padding:'0.5rem 0.6rem',textAlign:'left',fontSize:'0.72rem',fontWeight:700}}>Categoria</th>
                            <th style={{width:'8%',padding:'0.5rem 0.6rem',textAlign:'right',fontSize:'0.72rem',fontWeight:700}}>Valor</th>
                            <th style={{width:'9%',padding:'0.5rem 0.6rem',textAlign:'left',fontSize:'0.72rem',fontWeight:700}}>Pagamento</th>
                            <th style={{width:'28%',padding:'0.5rem 0.6rem',textAlign:'left',fontSize:'0.72rem',fontWeight:700}}>Responsável</th>
                            {permissoes?.canEdit && !verAgrupado && <th style={{width:'9%',padding:'0.5rem 0.6rem',textAlign:'center',fontSize:'0.72rem',fontWeight:700}}>Ações</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {custosAgrupados.map((custo) => (
                            <tr key={custo.id} style={{borderBottom:"1px solid var(--color-surface-2)"}}>
                              <td style={{padding:'0.45rem 0.6rem',fontSize:'0.76rem',color:"var(--color-text)",whiteSpace:'nowrap'}}>
                                {new Date((custo.data_custo || '') + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </td>
                              <td style={{padding:'0.45rem 0.6rem',fontSize:'0.76rem',color:"var(--color-text)",overflowWrap:'break-word'}}>
                                {custo.descricao}
                                {verAgrupado && custo.qtd > 1 && (
                                  <span style={{marginLeft:'0.4rem',fontSize:'0.65rem',fontWeight:700,color:'var(--color-accent)',whiteSpace:'nowrap'}}>({custo.qtd}x)</span>
                                )}
                              </td>
                              <td style={{padding:'0.45rem 0.6rem',fontSize:'0.76rem'}}>
                                {custo.categoria === 'Finanças Loja' ? (
                                  <span style={{display:'inline-block',whiteSpace:'nowrap',padding:"0.15rem 0.4rem",borderRadius:"var(--radius-sm)",fontSize:"0.65rem",background:"rgba(59,130,246,0.15)",color:"#3b82f6",border:"1px solid rgba(59,130,246,0.3)"}}>🏦 Fin. Loja</span>
                                ) : (
                                  <span style={{display:'inline-block',whiteSpace:'nowrap',padding:"0.15rem 0.4rem",borderRadius:"var(--radius-sm)",fontSize:"0.65rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)"}}>{custo.categoria}</span>
                                )}
                              </td>
                              <td style={{padding:'0.45rem 0.6rem',fontSize:'0.76rem',textAlign:'right',fontWeight:700,color:"#ef4444",whiteSpace:'nowrap'}}>
                                R$ {parseFloat(custo.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{padding:'0.45rem 0.6rem',fontSize:'0.76rem',color:"var(--color-text)",overflowWrap:'break-word'}}>{custo.forma_pagamento}</td>
                              <td style={{padding:'0.45rem 0.6rem',fontSize:'0.76rem',color:"var(--color-text)",overflowWrap:'break-word'}}>
                                {verAgrupado && custo.qtd > 1 ? <span style={{fontStyle:'italic',color:'var(--color-text-muted)'}}>Vários</span> : custo.responsavel}
                              </td>
                              {permissoes?.canEdit && !verAgrupado && (
                                <td style={{padding:'0.45rem 0.6rem',textAlign:'center'}}>
                                  <div style={{display:'flex',gap:'0.3rem',justifyContent:'center',alignItems:'center'}}>
                                    <button onClick={() => editarCusto(custo)} title="Corrigir manualmente"
                                      style={{padding:"0.15rem 0.4rem",borderRadius:"var(--radius-sm)",fontSize:"0.68rem",background:"rgba(99,102,241,0.15)",color:"#6366f1",border:"1px solid rgba(99,102,241,0.3)",cursor:"pointer"}}>
                                      ✏️
                                    </button>
                                    <button onClick={() => excluirCusto(custo.id)}
                                      style={{padding:"0.15rem 0.4rem",borderRadius:"var(--radius-sm)",fontSize:"0.68rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",cursor:"pointer"}}>
                                      🗑️
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{borderTop:"2px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}>
                            <td colSpan="3" style={{padding:'0.6rem',textAlign:'right',fontWeight:700,fontSize:'0.8rem',whiteSpace:'nowrap'}}>TOTAL:</td>
                            <td style={{padding:"0.6rem",textAlign:"right",fontWeight:"800",color:"#ef4444",fontSize:'0.85rem',whiteSpace:'nowrap'}}>
                              R$ {totalCustosModal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td colSpan={(permissoes?.canEdit && !verAgrupado) ? 3 : 2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* ABA ARQUIVOS */}
              {abaAtiva === 'arquivos' && (
                <div>
                  {permissoes?.canEdit && (
                    <div className="mb-4 flex justify-end">
                      <label style={{
                        padding:"0.45rem 1.2rem",background:"var(--color-accent)",color:"#fff",
                        border:"none",borderRadius:"var(--radius-lg)",cursor: enviandoArquivo ? "wait" : "pointer",
                        fontWeight:"700",fontSize:"0.88rem",opacity: enviandoArquivo ? 0.7 : 1, display:"inline-block"
                      }}>
                        {enviandoArquivo ? '⏳ Enviando...' : '📎 Enviar Arquivo(s)'}
                        <input type="file" multiple onChange={handleUploadArquivos} disabled={enviandoArquivo} className="hidden" />
                      </label>
                    </div>
                  )}

                  {arquivosDoModal.length === 0 ? (
                    <p className="text-center py-10" style={{color:"var(--color-text-muted)"}}>Nenhum arquivo anexado a este projeto ainda.</p>
                  ) : (
                    <div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}>
                      {arquivosDoModal.map(arq => (
                        <div key={arq.id} style={{
                          display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.65rem 0.9rem",
                          borderRadius:"var(--radius-md)",background:"var(--color-surface-2)",border:"1px solid var(--color-border)"
                        }}>
                          <span style={{fontSize:"1.4rem",flexShrink:0}}>{iconeArquivo(arq.tipo_mime || arq.nome_arquivo)}</span>
                          <a href={arq.url} target="_blank" rel="noopener noreferrer" title="Visualizar"
                            style={{flex:1,minWidth:0,color:"var(--color-text)",textDecoration:"none",fontWeight:600,fontSize:"0.88rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                            {arq.nome_arquivo}
                          </a>
                          <span style={{fontSize:"0.72rem",color:"var(--color-text-muted)",flexShrink:0,whiteSpace:"nowrap"}}>
                            {formatarTamanho(arq.tamanho_bytes)}
                          </span>
                          <a href={`${arq.url}?download=${encodeURIComponent(arq.nome_arquivo)}`} title="Baixar"
                            style={{padding:"0.3rem 0.6rem",borderRadius:"var(--radius-sm)",fontSize:"0.78rem",background:"rgba(99,102,241,0.15)",color:"#6366f1",border:"1px solid rgba(99,102,241,0.3)",textDecoration:"none",flexShrink:0}}>
                            ⬇️
                          </a>
                          {permissoes?.canEdit && (
                            <button onClick={() => excluirArquivoProjeto(arq)} title="Excluir"
                              style={{padding:"0.3rem 0.6rem",borderRadius:"var(--radius-sm)",fontSize:"0.78rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",cursor:"pointer",flexShrink:0}}>
                              🗑️
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova/Editar Receita */}
      {mostrarFormReceita && projetoSelecionado && (() => {
        const ehFinancasLoja = receitaEditando?.origem === 'Finanças Loja';
        const campoTravado = { border:"1px solid var(--color-border)", background:"var(--color-surface-3)", color:"var(--color-text-muted)", cursor:'not-allowed' };
        return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[60]">
          <div className="rounded-xl shadow-2xl w-full max-w-lg" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <div style={{background:"#10b981",padding:"1rem 1.5rem",borderRadius:"0.75rem 0.75rem 0 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <h3 className="text-lg font-bold text-white">{receitaEditando ? '✏️ Editar Receita' : '💵 Nova Receita'}</h3>
                <p style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.85)",marginTop:"0.15rem"}}>{projetoSelecionado.nome}</p>
              </div>
              <button onClick={() => { setMostrarFormReceita(false); setReceitaForm({}); setReceitaEditando(null); }} className="text-white hover:opacity-80 text-3xl leading-none">×</button>
            </div>
            <form onSubmit={adicionarReceita} className="p-5 space-y-3">
              {ehFinancasLoja && (
                <div style={{padding:'0.6rem 0.8rem',borderRadius:'var(--radius-md)',background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.3)',fontSize:'0.78rem',color:'var(--color-text)'}}>
                  🏦 Este registro veio do Finanças Loja. Valor, Origem, Forma de Pagamento e Observação ficam travados aqui — só Data, Descrição e Responsável podem ser corrigidos.
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Data *</label>
                  <input type="date" required value={receitaForm.data_receita || ''} onChange={(e) => setReceitaForm({ ...receitaForm, data_receita: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Valor (R$) *</label>
                  <input type="number" step="0.01" required disabled={ehFinancasLoja} placeholder="0,00" value={receitaForm.valor || ''} onChange={(e) => setReceitaForm({ ...receitaForm, valor: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg" style={ehFinancasLoja ? campoTravado : {border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Descrição *</label>
                <input type="text" required placeholder="Ex: Arrecadação do evento" value={receitaForm.descricao || ''} onChange={(e) => setReceitaForm({ ...receitaForm, descricao: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Origem *</label>
                  {ehFinancasLoja ? (
                    <input type="text" disabled value="Finanças Loja" className="w-full px-3 py-2 rounded-lg" style={campoTravado} />
                  ) : (
                    <select required value={receitaForm.origem || ''} onChange={(e) => setReceitaForm({ ...receitaForm, origem: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}>
                      <option value="">Selecione...</option>
                      {origensReceita.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Forma Pagamento *</label>
                  <select required disabled={ehFinancasLoja} value={receitaForm.forma_pagamento || ''} onChange={(e) => setReceitaForm({ ...receitaForm, forma_pagamento: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg" style={ehFinancasLoja ? campoTravado : {border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}>
                    <option value="">Selecione...</option>
                    {formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Responsável</label>
                <input type="text" placeholder="Nome do responsável" value={receitaForm.responsavel || ''} onChange={(e) => setReceitaForm({ ...receitaForm, responsavel: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Observação</label>
                <input type="text" disabled={ehFinancasLoja} placeholder="Observação opcional" value={receitaForm.observacao || ''} onChange={(e) => setReceitaForm({ ...receitaForm, observacao: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg" style={ehFinancasLoja ? campoTravado : {border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" style={{flex:1,padding:"0.6rem",background:"#10b981",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"700"}}>
                  💾 Salvar Receita
                </button>
                <button type="button" onClick={() => { setMostrarFormReceita(false); setReceitaForm({}); setReceitaEditando(null); }}
                  style={{padding:"0.6rem 1.2rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"600"}}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
        );
      })()}

      {/* Modal Novo/Editar Custo */}
      {mostrarFormCusto && projetoSelecionado && (() => {
        const ehFinancasLoja = custoEditando?.categoria === 'Finanças Loja';
        const campoTravado = { border:"1px solid var(--color-border)", background:"var(--color-surface-3)", color:"var(--color-text-muted)", cursor:'not-allowed' };
        return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[60]">
          <div className="rounded-xl shadow-2xl w-full max-w-lg" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <div style={{background:"var(--color-accent)",padding:"1rem 1.5rem",borderRadius:"0.75rem 0.75rem 0 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <h3 className="text-lg font-bold text-white">{custoEditando ? '✏️ Editar Custo' : '💸 Novo Custo'}</h3>
                <p style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.85)",marginTop:"0.15rem"}}>{projetoSelecionado.nome}</p>
              </div>
              <button onClick={() => { setMostrarFormCusto(false); setCustoForm({}); setCustoEditando(null); }} className="text-white hover:opacity-80 text-3xl leading-none">×</button>
            </div>
            <form onSubmit={adicionarCusto} className="p-5 space-y-3">
              {ehFinancasLoja && (
                <div style={{padding:'0.6rem 0.8rem',borderRadius:'var(--radius-md)',background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.3)',fontSize:'0.78rem',color:'var(--color-text)'}}>
                  🏦 Este registro veio do Finanças Loja. Valor, Categoria, Forma de Pagamento e Observação ficam travados aqui — só Data, Descrição e Responsável podem ser corrigidos.
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Data *</label>
                  <input type="date" required value={custoForm.data_custo || ''} onChange={(e) => setCustoForm({ ...custoForm, data_custo: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Valor (R$) *</label>
                  <input type="number" step="0.01" required disabled={ehFinancasLoja} placeholder="0,00" value={custoForm.valor || ''} onChange={(e) => setCustoForm({ ...custoForm, valor: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg" style={ehFinancasLoja ? campoTravado : {border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Descrição *</label>
                <input type="text" required placeholder="Ex: Compra de materiais" value={custoForm.descricao || ''} onChange={(e) => setCustoForm({ ...custoForm, descricao: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Categoria *</label>
                  {ehFinancasLoja ? (
                    <input type="text" disabled value="Finanças Loja" className="w-full px-3 py-2 rounded-lg" style={campoTravado} />
                  ) : (
                    <select required value={custoForm.categoria || ''} onChange={(e) => setCustoForm({ ...custoForm, categoria: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}>
                      <option value="">Selecione...</option>
                      {categoriasCusto.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Forma Pagamento *</label>
                  <select required disabled={ehFinancasLoja} value={custoForm.forma_pagamento || ''} onChange={(e) => setCustoForm({ ...custoForm, forma_pagamento: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg" style={ehFinancasLoja ? campoTravado : {border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}}>
                    <option value="">Selecione...</option>
                    {formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Responsável</label>
                <input type="text" placeholder="Nome do responsável" value={custoForm.responsavel || ''} onChange={(e) => setCustoForm({ ...custoForm, responsavel: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg" style={{border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{color:"var(--color-text-muted)"}}>Observação</label>
                <input type="text" disabled={ehFinancasLoja} placeholder="Observação opcional" value={custoForm.observacao || ''} onChange={(e) => setCustoForm({ ...custoForm, observacao: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg" style={ehFinancasLoja ? campoTravado : {border:"1px solid var(--color-border)",background:"var(--color-surface-2)",color:"var(--color-text)"}} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" style={{flex:1,padding:"0.6rem",background:"var(--color-accent)",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"700"}}>
                  💾 Salvar Custo
                </button>
                <button type="button" onClick={() => { setMostrarFormCusto(false); setCustoForm({}); setCustoEditando(null); }}
                  style={{padding:"0.6rem 1.2rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"600"}}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
        );
      })()}

      {/* Relatório PDF — escolher o exercício */}
      {modalRelatorio && (() => {
        const anosReais = [...new Set(projetos.map(anoDoProjeto))].sort((a, b) => {
          if (a === 'Sem data') return 1;
          if (b === 'Sem data') return -1;
          return b.localeCompare(a);
        });
        const qtd = projetos.filter(p => anoRelatorio === 'todos' || anoDoProjeto(p) === anoRelatorio).length;
        return (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{background:'rgba(0,0,0,0.6)'}} onClick={() => setModalRelatorio(false)}>
            <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-xl)',padding:'1.5rem',maxWidth:'400px',width:'100%'}} onClick={(e) => e.stopPropagation()}>
              <h3 style={{fontSize:'1.05rem',fontWeight:'700',color:'var(--color-text)',margin:'0 0 0.25rem'}}>📄 Relatório de Projetos e Campanhas</h3>
              <p style={{fontSize:'0.8rem',color:'var(--color-text-muted)',margin:'0 0 1rem'}}>Resumo em PDF, pronto pra enviar aos irmãos.</p>

              <label style={{display:'block',fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',marginBottom:'0.3rem'}}>Exercício</label>
              <select value={anoRelatorio} onChange={(e) => setAnoRelatorio(e.target.value)}
                style={{width:'100%',padding:'0.55rem 0.75rem',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',fontSize:'0.9rem',marginBottom:'0.5rem'}}>
                <option value="todos">Todos os exercícios</option>
                {anosReais.map(a => <option key={a} value={a}>{a === 'Sem data' ? 'Sem data de início' : `Exercício ${a}`}</option>)}
              </select>
              <p style={{fontSize:'0.75rem',color:'var(--color-text-muted)',margin:'0 0 1.25rem'}}>{qtd} projeto(s)/campanha(s) neste filtro</p>

              <div style={{display:'flex',gap:'0.5rem'}}>
                <button onClick={() => setModalRelatorio(false)}
                  style={{flex:1,padding:'0.6rem',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',fontWeight:'600',cursor:'pointer'}}>
                  Cancelar
                </button>
                <button onClick={gerarRelatorio}
                  style={{flex:2,padding:'0.6rem',background:'#1e3a5f',color:'#fff',border:'none',borderRadius:'var(--radius-lg)',fontWeight:'700',cursor:'pointer'}}>
                  📄 Gerar PDF
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Visualizar — quadro decorado pra tirar print e mandar no grupo,
          mesmo padrão visual do "Visualizar" do Cronograma. */}
      {modalVisualizacao && projetoVisualizar && (() => {
        const tipoInfo = tiposProjeto.find(t => t.value === projetoVisualizar.tipo);
        const ehCampanha = projetoVisualizar.tipo === 'campanha';
        const totalReceitasV = calcularTotalReceitas(projetoVisualizar);
        const totalCustosV = calcularTotalCustos(projetoVisualizar);
        const saldoV = calcularSaldo(projetoVisualizar, totalCustosV, totalReceitasV);
        const metaV = parseFloat(projetoVisualizar.valor_previsto) || 0;
        const pctV = ehCampanha
          ? (metaV > 0 ? Math.min(100, (totalReceitasV / metaV) * 100) : 0)
          : calcularPercentual(projetoVisualizar, totalCustosV);

        return (
          <div
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{background:'rgba(0,0,0,0.55)'}}
            onClick={() => setModalVisualizacao(false)}
          >
            <div
              className="relative"
              style={{background:'#e5e7eb',borderRadius:'0.75rem',padding:'2cm',boxShadow:'0 10px 40px rgba(0,0,0,0.35)',maxHeight:'92vh',overflowY:'auto'}}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setModalVisualizacao(false)}
                style={{position:'absolute',top:'0.6cm',right:'0.6cm',zIndex:10,background:'#1a2138',border:'2px solid #c9a84c',color:'#c9a84c',borderRadius:'50%',width:'2.25rem',height:'2.25rem',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:'1.1rem',fontWeight:'700',boxShadow:'0 2px 8px rgba(0,0,0,0.25)'}}
              >
                ×
              </button>

              <div
                id="quadro-projeto"
                className="rounded-xl relative overflow-hidden"
                style={{
                  width:'32rem',
                  maxWidth:'80vw',
                  background:'linear-gradient(180deg, #0f1729 0%, #1a2138 100%)',
                  border:'3px solid #c9a84c',
                  boxShadow:'0 0 0 1px rgba(201,168,76,0.3), var(--shadow-xl)'
                }}
              >
                {/* Sol e Lua no topo */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'1rem 1rem 0'}}>
                  <img src={IMG_SOL} alt="" style={{width:'4.5rem',height:'4.5rem',objectFit:'contain',opacity:0.9}} />
                  <img src={IMG_LUA} alt="" style={{width:'4rem',height:'4rem',objectFit:'contain',opacity:0.9}} />
                </div>

                {/* Corpo com colunas nas laterais */}
                <div style={{display:'grid',gridTemplateColumns:'72px 1fr 72px',gap:'0.5rem',padding:'0 0.25rem 1rem',alignItems:'stretch'}}>
                  <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
                    <img src={IMG_COLUNA_B} alt="" style={{width:'100%',objectFit:'contain',opacity:0.85}} />
                  </div>

                  {/* Pergaminho central */}
                  <div style={{background:'#f5f0e1',borderRadius:'0.5rem',border:'2px solid #c9a84c',padding:'1.25rem 1rem',boxShadow:'0 4px 12px rgba(0,0,0,0.35)'}}>
                    {/* Selo do tipo */}
                    <div style={{textAlign:'center',marginBottom:'0.5rem'}}>
                      <span style={{...tipoInfo?.style||{background:'#eee',color:'#555',border:'1px solid #ccc'},padding:'0.2rem 0.75rem',borderRadius:'999px',fontSize:'0.72rem',fontWeight:'800'}}>
                        {tipoInfo?.label || projetoVisualizar.tipo}
                      </span>
                    </div>

                    <div style={{width:'60%',height:'2px',background:'linear-gradient(90deg,transparent,#c9a84c,transparent)',margin:'0 auto 0.75rem'}}></div>

                    {/* Nome */}
                    <div style={{textAlign:'center',marginBottom:'0.85rem'}}>
                      <p style={{fontSize:'1.3rem',fontWeight:'800',color:'#1e3a8a',fontFamily:'Georgia, serif',margin:0,lineHeight:'1.3'}}>
                        {projetoVisualizar.nome}
                      </p>
                    </div>

                    {/* Descrição */}
                    {projetoVisualizar.descricao && (
                      <p style={{fontSize:'0.85rem',color:'#333',textAlign:'center',margin:'0 0 0.85rem',lineHeight:'1.5'}}>
                        {projetoVisualizar.descricao}
                      </p>
                    )}

                    {/* Meta/Arrecadado (campanha) ou Valor Previsto/Receitas/Custos/Saldo (projeto) */}
                    <div style={{background:'rgba(201,168,76,0.12)',border:'1px solid rgba(201,168,76,0.4)',borderRadius:'0.5rem',padding:'0.75rem',marginBottom:'0.75rem'}}>
                      {ehCampanha ? (
                        <>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.85rem',marginBottom:'0.3rem'}}>
                            <span style={{fontWeight:'700',color:'#1a1a1a'}}>🎯 Meta:</span>
                            <span style={{fontWeight:'800',color:'#b8860b'}}>R$ {metaV.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.85rem',marginBottom:'0.5rem'}}>
                            <span style={{fontWeight:'700',color:'#1a1a1a'}}>💵 Arrecadado:</span>
                            <span style={{fontWeight:'800',color:'#166534'}}>R$ {totalReceitasV.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                          </div>
                          <div className="w-full rounded-full h-3 overflow-hidden" style={{background:'#ddd'}}>
                            <div className="h-3 rounded-full" style={{width:`${pctV}%`,background: pctV >= 100 ? '#16a34a' : '#f59e0b'}} />
                          </div>
                          <p style={{textAlign:'center',fontSize:'0.78rem',fontWeight:'700',color:'#555',margin:'0.3rem 0 0'}}>
                            {pctV.toFixed(1)}% da meta {pctV >= 100 ? '— 🎉 Meta atingida!' : ''}
                          </p>
                        </>
                      ) : (
                        <>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.82rem',marginBottom:'0.25rem'}}>
                            <span style={{fontWeight:'700',color:'#1a1a1a'}}>💰 Previsto:</span>
                            <span style={{fontWeight:'800',color:'#1e3a8a'}}>R$ {metaV.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.82rem',marginBottom:'0.25rem'}}>
                            <span style={{fontWeight:'700',color:'#1a1a1a'}}>💵 Receitas:</span>
                            <span style={{fontWeight:'800',color:'#166534'}}>R$ {totalReceitasV.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.82rem',marginBottom:'0.25rem'}}>
                            <span style={{fontWeight:'700',color:'#1a1a1a'}}>💸 Custos:</span>
                            <span style={{fontWeight:'800',color:'#b91c1c'}}>R$ {totalCustosV.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.85rem',paddingTop:'0.3rem',borderTop:'1px solid rgba(201,168,76,0.4)'}}>
                            <span style={{fontWeight:'800',color:'#1a1a1a'}}>💳 Saldo:</span>
                            <span style={{fontWeight:'800',color: saldoV >= 0 ? '#166534' : '#b91c1c'}}>R$ {saldoV.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Datas / responsável */}
                    <div style={{fontSize:'0.78rem',color:'#333',textAlign:'center'}}>
                      {projetoVisualizar.data_inicio && (
                        <p style={{margin:'0.1rem 0'}}>📅 Início: {new Date(projetoVisualizar.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                      )}
                      {projetoVisualizar.data_prevista_termino && (
                        <p style={{margin:'0.1rem 0'}}>🏁 Previsão: {new Date(projetoVisualizar.data_prevista_termino + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                      )}
                      {projetoVisualizar.responsavel && (
                        <p style={{margin:'0.1rem 0'}}>👤 {projetoVisualizar.responsavel}</p>
                      )}
                    </div>

                    {/* Logo da Loja */}
                    {dadosLoja.logo_url && (
                      <div style={{textAlign:'center',marginTop:'1rem'}}>
                        <img src={dadosLoja.logo_url} alt={dadosLoja.nome_loja} style={{width:'3.5rem',height:'3.5rem',objectFit:'contain',margin:'0 auto'}} />
                        <p style={{fontSize:'0.6rem',color:'#666',marginTop:'0.25rem'}}>{dadosLoja.nome_loja}</p>
                      </div>
                    )}
                  </div>

                  <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
                    <img src={IMG_COLUNA_J} alt="" style={{width:'100%',objectFit:'contain',opacity:0.85}} />
                  </div>
                </div>

                {/* Status */}
                <div style={{padding:'0 1rem 1rem',textAlign:'center'}}>
                  <span
                    className="inline-block px-3 py-1 rounded-full text-xs font-medium"
                    style={statusLabels[projetoVisualizar.status]?.style || {}}
                  >
                    {statusLabels[projetoVisualizar.status]?.label || projetoVisualizar.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
