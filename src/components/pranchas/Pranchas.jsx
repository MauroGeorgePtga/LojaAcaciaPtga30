import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { formatarData } from '../../utils/formatters';
import { dadosDaEleicao, gerarPranchaInstalacaoDocx, gerarPranchaInstalacaoPDF } from '../../utils/gerarPranchaInstalacao';

const Pranchas = ({ pranchas, onUpdate, showSuccess, showError, permissoes, grauUsuario }) => {
  // Estados do formulário
  const [pranchaForm, setPranchaForm] = useState({
    numero_prancha: '',
    data_prancha: '',
    assunto: '',
    destinatario: ''
  });

  // Estados de controle
  const [modoEdicao, setModoEdicao] = useState(false);
  const [pranchaEditando, setPranchaEditando] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pranchaVisualizando, setPranchaVisualizando] = useState(null);
  const [modalVisualizar, setModalVisualizar] = useState(false);
  const [anoSelecionado, setAnoSelecionado] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  // Prancha de requerimento de instalação à GLEMT
  const [eleicoes, setEleicoes] = useState([]);
  const [eleicaoPrancha, setEleicaoPrancha] = useState('');
  const [gerandoDoc, setGerandoDoc] = useState('');
  const [todasGestoes, setTodasGestoes] = useState(false);   // padrão: só a mais recente
  const [instaladores, setInstaladores] = useState([]);
  useEffect(() => {
    supabase.from('eleicoes').select('*')
      .order('data_eleicao', { ascending: false })
      .then(({ data }) => setEleicoes(data || []));
  }, []);

  // Instaladores da eleição escolhida (quadro "Instaladores — Ata de Posse")
  useEffect(() => {
    const el = eleicoes.find(x => String(x.id) === String(eleicaoPrancha));
    if (!el) { setInstaladores([]); return; }
    const mapa = [
      ['Venerável Mestre Instalador', el.vm_instalador_id || el.vm_sainte_id],
      ['1º Vigilante Instalador', el.primeiro_vigilante_instalador_id],
      ['2º Vigilante Instalador', el.segundo_vigilante_instalador_id],
    ].filter(([, id]) => id);
    if (!mapa.length) { setInstaladores([]); return; }
    supabase.from('irmaos').select('id, nome').in('id', mapa.map(([, id]) => id))
      .then(({ data }) => setInstaladores(mapa.map(([cargo, id]) => ({
        cargo, nome: (data || []).find(i => String(i.id) === String(id))?.nome || '—',
      }))));
  }, [eleicaoPrancha, eleicoes]);

  // Próximo número do ano: 034/2026
  const proximoNumero = () => {
    const ano = new Date().getFullYear();
    const doAno = (pranchas || []).filter(p => String(p.numero_prancha || '').endsWith(`/${ano}`));
    const maior = doAno.reduce((m, p) => Math.max(m, parseInt(String(p.numero_prancha).split('/')[0]) || 0), 0);
    return `${String(maior + 1).padStart(3, '0')}/${ano}`;
  };

  // Gera a prancha (Word ou PDF) com os dados da eleição escolhida
  const gerarPrancha = async (formato) => {
    if (!eleicaoPrancha) { showError('Escolha a eleição de referência.'); return; }
    if (!pranchaForm.numero_prancha || !pranchaForm.data_prancha) { showError('Preencha o número e a data da prancha.'); return; }
    setGerandoDoc(formato);
    try {
      const V = await dadosDaEleicao(eleicaoPrancha);
      const args = { prancha: pranchaForm, V, corpo: null, titulo: null };
      if (formato === 'pdf') gerarPranchaInstalacaoPDF(args);
      else await gerarPranchaInstalacaoDocx(args);
      showSuccess(`Prancha gerada em ${formato === 'pdf' ? 'PDF' : 'Word'}!`);
    } catch (e) {
      showError('Erro ao gerar a prancha: ' + e.message);
    } finally {
      setGerandoDoc('');
    }
  };

  // Função para tratar datas vazias
  const tratarData = (data) => {
    if (!data || data === '' || data === 'undefined' || data === 'null') {
      return null;
    }
    return data;
  };

  // Limpar formulário
  const limparFormulario = () => {
    setPranchaForm({
      numero_prancha: '',
      data_prancha: '',
      assunto: '',
      destinatario: ''
    });
    setModoEdicao(false);
    setPranchaEditando(null);
    setModalAberto(false);
  };

  // Cadastrar prancha
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dadosPrancha = {
        numero_prancha: pranchaForm.numero_prancha,
        data_prancha: tratarData(pranchaForm.data_prancha),
        assunto: pranchaForm.assunto,
        destinatario: pranchaForm.destinatario
      };

      const { error } = await supabase
        .from('pranchas_expedidas')
        .insert([dadosPrancha]);

      if (error) throw error;

      showSuccess('Prancha cadastrada com sucesso!');
      limparFormulario();
      limparFormulario();
      onUpdate();

    } catch (err) {
      showError('Erro ao cadastrar prancha: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Atualizar prancha
  const handleAtualizar = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dadosPrancha = {
        numero_prancha: pranchaForm.numero_prancha,
        data_prancha: tratarData(pranchaForm.data_prancha),
        assunto: pranchaForm.assunto,
        destinatario: pranchaForm.destinatario
      };

      const { error } = await supabase
        .from('pranchas_expedidas')
        .update(dadosPrancha)
        .eq('id', pranchaEditando.id);

      if (error) throw error;

      showSuccess('Prancha atualizada com sucesso!');
      limparFormulario();
      limparFormulario();
      onUpdate();

    } catch (err) {
      showError('Erro ao atualizar prancha: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Editar prancha
  const handleEditar = (prancha) => {
    setModoEdicao(true);
    setModalAberto(true);
    setPranchaEditando(prancha);
    setPranchaForm({
      numero_prancha: prancha.numero_prancha,
      data_prancha: prancha.data_prancha,
      assunto: prancha.assunto,
      destinatario: prancha.destinatario
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Visualizar prancha completa
  const handleVisualizar = (prancha) => {
    setPranchaVisualizando(prancha);
    setModalVisualizar(true);
  };

  // Excluir prancha
  const handleExcluir = async (id) => {
    if (typeof window !== 'undefined' && !window.confirm('Tem certeza que deseja excluir esta prancha?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('pranchas_expedidas')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showSuccess('Prancha excluída com sucesso!');
      onUpdate();

    } catch (err) {
      showError('Erro ao excluir prancha: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const anosDisponiveis = [...new Set(
    pranchas.map(p => p.data_prancha ? new Date(p.data_prancha + 'T00:00:00').getFullYear() : new Date().getFullYear())
  )].sort((a, b) => b - a);

  // Filtrar pranchas por ano e busca
  const pranchasFiltradas = pranchas.filter(p => {
    if (anoSelecionado) {
      const anoPrancha = p.data_prancha ? new Date(p.data_prancha + 'T00:00:00').getFullYear() : new Date().getFullYear();
      if (anoPrancha !== anoSelecionado) return false;
    }
    if (!searchTerm) return true;
    const termo = searchTerm.toLowerCase();
    return (
      p.numero_prancha?.toLowerCase().includes(termo) ||
      p.assunto?.toLowerCase().includes(termo) ||
      p.destinatario?.toLowerCase().includes(termo)
    );
  });

  // CONTROLE DE ACESSO POR GRAU
  // Aprendizes e Companheiros NÃO podem acessar Pranchas
  // Apenas Mestres podem visualizar
  if (grauUsuario && (grauUsuario.toLowerCase() === 'aprendiz' || grauUsuario.toLowerCase() === 'companheiro')) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center bg-yellow-50 border-2 border-yellow-400 rounded-lg p-8 max-w-md" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold mb-3" style={{color:"var(--color-text)"}}>Acesso Restrito</h2>
          <p className="mb-2">
            Pranchas são documentos oficiais de nível <strong>Mestre</strong>.
          </p>
          <p className="text-sm">
            Você precisa ser Mestre Maçom para acessar esta seção.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{background:"var(--color-bg)",minHeight:"100vh",padding:"0.5rem",overflowX:"hidden"}}>

      {/* MODAL CADASTRO/EDIÇÃO */}
      {modalAberto && permissoes?.pode_editar_pranchas && (
        <div onClick={limparFormulario} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',padding:'1.5rem 1rem'}}>
          <div onClick={e => e.stopPropagation()} style={{background:'var(--color-surface)',borderRadius:'var(--radius-xl)',border:'1px solid var(--color-border)',width:'100%',maxWidth:'560px',boxShadow:'0 20px 60px rgba(0,0,0,0.4)',overflow:'hidden'}}>

            {/* Header */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'1.1rem 1.4rem',borderBottom:'1px solid var(--color-border)',background:'var(--color-surface-2)'}}>
              <div style={{display:'flex',alignItems:'center',gap:'0.6rem'}}>
                <span style={{fontSize:'1.2rem'}}>📄</span>
                <div>
                  <h3 style={{margin:0,fontSize:'1rem',fontWeight:'800',color:'var(--color-text)'}}>
                    {modoEdicao ? 'Editar Prancha' : 'Nova Prancha'}
                  </h3>
                  <p style={{margin:0,fontSize:'0.72rem',color:'var(--color-text-muted)'}}>
                    {modoEdicao ? 'Atualize os dados da prancha' : 'Preencha os dados para registrar'}
                  </p>
                </div>
              </div>
              <button onClick={limparFormulario} style={{background:'transparent',border:'none',color:'var(--color-text-muted)',fontSize:'1.3rem',cursor:'pointer',padding:'0.2rem 0.5rem',borderRadius:'var(--radius-md)',lineHeight:1}}>✕</button>
            </div>

            {/* Corpo */}
            <form onSubmit={modoEdicao ? handleAtualizar : handleSubmit} style={{padding:'1.4rem',display:'flex',flexDirection:'column',gap:'1rem'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
                <div>
                  <label style={{fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.35rem'}}>Número da Prancha *</label>
                  <input type="text" value={pranchaForm.numero_prancha} placeholder="Ex: 001/2026" required
                    onChange={e => setPranchaForm({...pranchaForm, numero_prancha: e.target.value})}
                    style={{width:'100%',padding:'0.6rem 0.85rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',fontSize:'0.875rem',outline:'none',boxSizing:'border-box'}} />
                </div>
                <div>
                  <label style={{fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.35rem'}}>Data da Prancha *</label>
                  <input type="date" value={pranchaForm.data_prancha} required
                    onChange={e => setPranchaForm({...pranchaForm, data_prancha: e.target.value})}
                    style={{width:'100%',padding:'0.6rem 0.85rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',fontSize:'0.875rem',outline:'none',boxSizing:'border-box'}} />
                </div>
              </div>
              <div>
                <label style={{fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.35rem'}}>Destinatário *</label>
                <input type="text" value={pranchaForm.destinatario} placeholder="Ex: Grande Oriente de Mato Grosso" required
                  onChange={e => setPranchaForm({...pranchaForm, destinatario: e.target.value})}
                  style={{width:'100%',padding:'0.6rem 0.85rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',fontSize:'0.875rem',outline:'none',boxSizing:'border-box'}} />
              </div>
              <div>
                <label style={{fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.35rem'}}>Assunto *</label>
                <input type="text" value={pranchaForm.assunto} placeholder="Ex: Solicitação de Regularização" required
                  onChange={e => setPranchaForm({...pranchaForm, assunto: e.target.value})}
                  style={{width:'100%',padding:'0.6rem 0.85rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',fontSize:'0.875rem',outline:'none',boxSizing:'border-box'}} />
              </div>
              {/* Requerimento de instalação à GLEMT */}
              <div style={{border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',padding:'0.8rem',background:'var(--color-surface-2)'}}>
                <label style={{fontSize:'0.72rem',fontWeight:'700',color:'var(--color-accent)',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.35rem'}}>
                  📜 Requerimento de Instalação à GLEMT (opcional)
                </label>
                <p style={{margin:'0 0 0.5rem',fontSize:'0.72rem',color:'var(--color-text-muted)'}}>
                  Escolha a eleição: o texto puxa o edital, o balaústre, as datas e o Venerável eleito.
                </p>
                <select value={eleicaoPrancha} onChange={e => {
                    setEleicaoPrancha(e.target.value);
                    const el = eleicoes.find(x => String(x.id) === e.target.value);
                    if (el) setPranchaForm(p => ({
                      ...p,
                      numero_prancha: p.numero_prancha || proximoNumero(),
                      data_prancha: p.data_prancha || new Date().toISOString().substring(0, 10),
                      destinatario: p.destinatario || 'Grande Loja Maçônica do Estado de Mato Grosso – GLEMT',
                      assunto: p.assunto || `Requerimento de Comissão Instaladora — Gestão ${el.gestao || ''}`,
                    }));
                  }}
                  style={{width:'100%',padding:'0.55rem 0.8rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface)',color:'var(--color-text)',border:'1px solid var(--color-border)',fontSize:'0.88rem',outline:'none'}}>
                  <option value="">Prancha comum (sem requerimento)</option>
                  {(todasGestoes ? eleicoes : eleicoes.slice(0, 1)).map(el => (
                    <option key={el.id} value={el.id}>
                      Gestão {el.gestao} — eleição de {formatarData(el.data_eleicao)}
                    </option>
                  ))}
                </select>
                <label style={{display:'flex',alignItems:'center',gap:'0.4rem',marginTop:'0.4rem',fontSize:'0.75rem',color:'var(--color-text-muted)',cursor:'pointer'}}>
                  <input type="checkbox" checked={todasGestoes} onChange={e => setTodasGestoes(e.target.checked)} />
                  Mostrar todas as gestões
                </label>

                {/* Instaladores da gestão escolhida */}
                {eleicaoPrancha && instaladores.length > 0 && (
                  <div style={{marginTop:'0.6rem',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',overflow:'hidden'}}>
                    <div style={{padding:'0.4rem 0.7rem',background:'var(--color-surface)',fontSize:'0.72rem',fontWeight:800,color:'var(--color-accent)',textTransform:'uppercase'}}>
                      Instaladores — Ata de Posse
                    </div>
                    {instaladores.map((i, k) => (
                      <div key={i.cargo} style={{display:'flex',justifyContent:'space-between',gap:'0.6rem',padding:'0.35rem 0.7rem',fontSize:'0.8rem',borderTop: k ? '1px solid var(--color-border)' : 'none'}}>
                        <span style={{color:'var(--color-text-muted)'}}>{i.cargo}</span>
                        <strong style={{color:'var(--color-text)'}}>{i.nome}</strong>
                      </div>
                    ))}
                  </div>
                )}
                {eleicaoPrancha && (
                  <div style={{display:'flex',gap:'0.5rem',marginTop:'0.6rem'}}>
                    <button type="button" disabled={!!gerandoDoc} onClick={() => gerarPrancha('docx')}
                      style={{flex:1,height:'36px',background:'var(--color-surface)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',fontWeight:'700',fontSize:'0.8rem',cursor:'pointer'}}>
                      {gerandoDoc === 'docx' ? 'Gerando...' : '📄 Gerar Word'}
                    </button>
                    <button type="button" disabled={!!gerandoDoc} onClick={() => gerarPrancha('pdf')}
                      style={{flex:1,height:'36px',background:'var(--color-surface)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',fontWeight:'700',fontSize:'0.8rem',cursor:'pointer'}}>
                      {gerandoDoc === 'pdf' ? 'Gerando...' : '📕 Gerar PDF'}
                    </button>
                  </div>
                )}
              </div>

              <div style={{display:'flex',gap:'0.65rem',paddingTop:'0.25rem'}}>
                <button type="button" onClick={limparFormulario}
                  style={{flex:1,height:'40px',background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',fontWeight:'700',fontSize:'0.85rem',cursor:'pointer'}}>
                  Cancelar
                </button>
                <button type="submit" disabled={loading}
                  style={{flex:2,height:'40px',background:loading ? 'var(--color-surface-3)' : 'var(--color-accent)',color:'#fff',border:'none',borderRadius:'var(--radius-lg)',fontWeight:'700',fontSize:'0.85rem',cursor:loading ? 'not-allowed' : 'pointer'}}>
                  {loading ? 'Salvando...' : modoEdicao ? '✏️ Atualizar Prancha' : '✅ Registrar Prancha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BOTÃO NOVA PRANCHA */}
      {permissoes?.pode_editar_pranchas && (
        <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'0.75rem'}}>
          <button onClick={() => { limparFormulario(); setEleicaoPrancha(''); setPranchaForm(p => ({ ...p, numero_prancha: proximoNumero(), data_prancha: new Date().toISOString().substring(0, 10) })); setModalAberto(true); }}
            style={{height:'38px',padding:'0 1rem',background:'var(--color-accent)',color:'#fff',border:'none',borderRadius:'var(--radius-lg)',fontWeight:'700',fontSize:'0.82rem',cursor:'pointer',display:'flex',alignItems:'center',gap:'0.4rem'}}>
            ➕ Nova Prancha
          </button>
        </div>
      )}
      {/* BUSCA + FILTRO ANO */}
      <div className="rounded-xl p-4 mb-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            placeholder="🔍 Buscar por número, assunto ou destinatário..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-lg outline-none" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",minWidth:'200px'}}
          />
          {/* Seletor de ano */}
          {anosDisponiveis.length >= 1 && (
            <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
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
      </div>

      {/* LISTA DE PRANCHAS */}
      <div className="rounded-xl overflow-hidden" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div className="p-4 text-white" style={{background:"var(--color-accent)"}}>
          <h3 className="text-xl font-bold" style={{color:"#fff"}}>Pranchas Registradas</h3>
          <p className="text-sm" style={{color:"rgba(255,255,255,0.8)"}}>
            Total: {pranchasFiltradas.length} prancha(s)
          </p>
        </div>

        <div>
          {/* Cabeçalho fixo das colunas */}
          <div style={{display:'grid',gridTemplateColumns:'90px 90px 1fr 2fr 120px',gap:'0',background:'var(--color-surface-2)',borderBottom:'2px solid var(--color-accent)',padding:'0.5rem 1rem'}}>
            {['Número','Data','Destinatário','Assunto','Ações'].map((h,i) => (
              <div key={h} style={{fontSize:'0.72rem',fontWeight:'700',color:'var(--color-text-muted)',textTransform:'uppercase',textAlign:i===4?'center':'left'}}>{h}</div>
            ))}
          </div>
            <div className="p-3 space-y-2" style={{width:"100%",boxSizing:"border-box",overflow:"hidden"}}>
              {(() => {
                const getAnoPrancha = p => p.data_prancha ? new Date(p.data_prancha+'T00:00:00').getFullYear() : new Date().getFullYear();
                // Ordena por data (mais recente primeiro) e, dentro do mesmo
                // dia, pelo número da prancha (ordem natural: 001, 002, 010).
                // Antes só ordenava por data — quando havia mais de uma
                // prancha no mesmo dia, a ordem ficava dependendo da ordem
                // "crua" que os dados chegavam (por isso editar um registro
                // fazia ele pular pro topo: mudava a ordem de chegada, não a
                // posição real). Agora a ordem é sempre a mesma,
                // independente de qual item foi editado por último.
                const lista = [...pranchasFiltradas].sort((a, b) => {
                  const dataDiff = new Date(b.data_prancha) - new Date(a.data_prancha);
                  if (dataDiff !== 0) return dataDiff;
                  return (b.numero_prancha || '').localeCompare(a.numero_prancha || '', undefined, { numeric: true, sensitivity: 'base' });
                });
                if (lista.length === 0) return (
                  <div className="text-center py-8" style={{color:'var(--color-text-faint)'}}>
                    {searchTerm ? 'Nenhuma prancha encontrada' : 'Nenhuma prancha cadastrada'}
                  </div>
                );
                // Agrupar por ano
                const grupos = lista.reduce((acc, p) => {
                  const ano = getAnoPrancha(p);
                  if (!acc[ano]) acc[ano] = [];
                  acc[ano].push(p);
                  return acc;
                }, {});
                const anosGrupo = Object.keys(grupos).map(Number).sort((a,b) => b-a);
                return anosGrupo.map(ano => (
                  <div key={ano}>
                    {/* Cabeçalho do ano */}
                    <div style={{display:'flex',alignItems:'center',gap:'0.75rem',margin:'0.75rem 0 0.5rem',padding:'0.4rem 0.75rem',borderRadius:'var(--radius-lg)',background:'var(--color-surface-2)',borderLeft:'3px solid var(--color-accent)'}}>
                      <span style={{fontWeight:'700',fontSize:'0.9rem',color:'var(--color-accent)'}}>📅 {ano}</span>
                      <span style={{fontSize:'0.75rem',color:'var(--color-text-muted)'}}>{grupos[ano].length} prancha(s)</span>
                    </div>
                    {grupos[ano].map((prancha, idx) => (
                      <div key={prancha.id}
                        style={{
                          display:'grid',
                          gridTemplateColumns:'90px 90px 1fr 2fr 120px',
                          gap:'0',
                          alignItems:'center',
                          borderLeft:'4px solid var(--color-accent)',
                          borderRadius:'var(--radius-md)',
                          background: idx%2===0 ? 'var(--color-surface)' : 'var(--color-surface-2)',
                          marginBottom:'0.3rem',
                          padding:'0.6rem 1rem',
                          border:'1px solid var(--color-border)',
                          borderLeftColor:'var(--color-accent)',
                        }}
                      >
                        <div style={{overflow:'hidden'}}>
                          <p style={{fontWeight:'700',fontSize:'0.85rem',color:'var(--color-accent)',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{prancha.numero_prancha}</p>
                        </div>
                        <div style={{overflow:'hidden'}}>
                          <p style={{fontSize:'0.78rem',color:'var(--color-text-muted)',margin:0}}>{formatarData(prancha.data_prancha)}</p>
                        </div>
                        <div style={{overflow:'hidden',paddingRight:'0.5rem'}}>
                          <p style={{fontSize:'0.82rem',color:'var(--color-text)',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{prancha.destinatario}</p>
                        </div>
                        <div style={{overflow:'hidden',paddingRight:'0.5rem'}}>
                          <p style={{fontSize:'0.82rem',color:'var(--color-text)',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{prancha.assunto}</p>
                        </div>
                        <div style={{display:'flex',gap:'0.3rem',justifyContent:'center'}}>
                          <button onClick={() => handleVisualizar(prancha)}
                            style={{padding:'0.25rem 0.5rem',background:'rgba(16,185,129,0.15)',color:'#10b981',border:'1px solid rgba(16,185,129,0.3)',borderRadius:'var(--radius-md)',fontSize:'0.82rem',cursor:'pointer'}}
                            title="Visualizar">👁️</button>
                          {permissoes?.pode_editar_pranchas && (<>
                            <button onClick={() => handleEditar(prancha)}
                              style={{padding:'0.25rem 0.5rem',background:'var(--color-accent-bg)',color:'var(--color-accent)',border:'1px solid var(--color-accent)',borderRadius:'var(--radius-md)',fontSize:'0.82rem',cursor:'pointer'}}>✏️</button>
                            <button onClick={() => handleExcluir(prancha.id)}
                              style={{padding:'0.25rem 0.5rem',background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'var(--radius-md)',fontSize:'0.82rem',cursor:'pointer'}}>🗑️</button>
                          </>)}
                        </div>
                      </div>
                    ))}
                  </div>
                ));
              })()}
            </div>
        </div>
      </div>

      {/* MODAL DE VISUALIZAÇÃO */}
      {modalVisualizar && pranchaVisualizando && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-6 rounded-t-xl">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>
                  📄 Prancha Nº {pranchaVisualizando.numero_prancha}
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
              {/* Informações da Prancha */}
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                  <label className="block text-sm font-semibold text-blue-900 mb-2" style={{color:"var(--color-text-muted)"}}>Número da Prancha</label>
                  <p className="text-lg font-medium">{pranchaVisualizando.numero_prancha}</p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                  <label className="block text-sm font-semibold text-blue-900 mb-2" style={{color:"var(--color-text-muted)"}}>Data</label>
                  <p className="text-lg font-medium">{formatarData(pranchaVisualizando.data_prancha)}</p>
                </div>

                <div className="bg-green-50 p-4 rounded-lg" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                  <label className="block text-sm font-semibold text-green-900 mb-2" style={{color:"var(--color-text-muted)"}}>👤 Destinatário</label>
                  <p className="text-lg font-medium">{pranchaVisualizando.destinatario}</p>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                  <label className="block text-sm font-semibold text-yellow-900 mb-2" style={{color:"var(--color-text-muted)"}}>📋 Assunto</label>
                  <p className="text-lg">{pranchaVisualizando.assunto}</p>
                </div>
              </div>

              {/* Botão Fechar */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
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

export default Pranchas;
