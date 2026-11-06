import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { ESTADOS_CIVIS, rotuloEstadoCivilCompleto, uniaoEstavelPendente } from '../../utils/constants';
import CampoUniaoEstavel from './CampoUniaoEstavel';
import VidaMaconica from '../vida-maconica/VidaMaconica';
import GestaoSituacoes from './GestaoSituacoes';
import InstrucoesTrabalhos from './InstrucoesTrabalhos';
import QuadrosComendas from './QuadrosComendas';

export default function PerfilIrmao({ irmaoId, onVoltar, showSuccess, showError, permissoes, userEmail, userData }) {
  const boxCard = { background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "1.25rem" };
  const boxTitle = { fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.85rem" };
  const [irmao, setIrmao] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [abaSelecionada, setAbaSelecionada] = useState('pessoal');
  const [irmaoForm, setIrmaoForm] = useState({});
  const [familiares, setFamiliares] = useState({
    conjuge: null,
    pais: { pai: null, mae: null },
    filhos: []
  });
  const [historicoCargos, setHistoricoCargos] = useState([]);
  const [filhoEditandoIndex, setFilhoEditandoIndex] = useState(null);
  const [filhoForm, setFilhoForm] = useState({
    nome: '',
    data_nascimento: '',
    sexo: '',
    tipo_vinculo: '',
    vivo: true,
    data_obito: ''
  });

  useEffect(() => {
    if (irmaoId) {
      carregarIrmao();
      carregarFamiliares();
      carregarHistoricoCargos();
    }
  }, [irmaoId]);


  const carregarIrmao = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('irmaos')
      .select('*')
      .eq('id', irmaoId)
      .single();

    if (data) {
      setIrmao(data);
      setIrmaoForm(data);
    }
    setLoading(false);
  };

  const carregarFamiliares = async () => {
    // Carregar cônjuge
    const { data: conjugeData } = await supabase
      .from('esposas')
      .select('*')
      .eq('irmao_id', irmaoId)
      .single();

    // Carregar pais
    const { data: paisData } = await supabase
      .from('pais')
      .select('*')
      .eq('irmao_id', irmaoId);

    const pai = paisData?.find(p => p.tipo === 'pai');
    const mae = paisData?.find(p => p.tipo === 'mae');

    // Carregar filhos
    const { data: filhosData } = await supabase
      .from('filhos')
      .select('*')
      .eq('irmao_id', irmaoId)
      .order('data_nascimento', { ascending: true });

    setFamiliares({
      conjuge: conjugeData || null,
      pais: { pai: pai || null, mae: mae || null },
      filhos: filhosData || []
    });
  };

  const carregarHistoricoCargos = async () => {
    try {
      console.log('🔍 Carregando cargos para irmão ID:', irmaoId);
      const { data: cargosData, error } = await supabase
        .from('historico_cargos')
        .select('*')
        .eq('irmao_id', irmaoId)
        .order('ano', { ascending: false });

      console.log('📊 Cargos retornados:', cargosData);
      console.log('❌ Erro (se houver):', error);

      setHistoricoCargos(cargosData || []);
    } catch (error) {
      console.log('ℹ️ Erro ao carregar cargos:', error.message);
      setHistoricoCargos([]);
    }
  };

  const handleSalvarEdicao = async () => {
    if (!irmaoForm.estado_civil) {
      showError('❌ Informe o estado civil (campo obrigatório).');
      return;
    }
    if (uniaoEstavelPendente(irmaoForm.estado_civil, irmaoForm.uniao_estavel)) {
      showError('❌ Informe se o irmão mantém ou não união estável (campo obrigatório).');
      return;
    }
    try {
      // Salvar dados básicos do irmão (casado: união estável não se aplica)
      const { error: erroIrmao } = await supabase
        .from('irmaos')
        .update({ ...irmaoForm, uniao_estavel: irmaoForm.estado_civil === 'casado' ? null : irmaoForm.uniao_estavel })
        .eq('id', irmaoId);

      if (erroIrmao) throw erroIrmao;

      // Salvar cônjuge
      if (familiares.conjuge?.nome) {
        const { data: conjExiste } = await supabase.from('esposas').select('id').eq('irmao_id', irmaoId).maybeSingle();
        if (conjExiste) {
          await supabase.from('esposas').update({
            nome: familiares.conjuge.nome,
            data_nascimento: familiares.conjuge.data_nascimento,
            data_casamento: familiares.conjuge.data_casamento,
            profissao: familiares.conjuge.profissao,
            email: familiares.conjuge.email || null
          }).eq('irmao_id', irmaoId);
        } else {
          await supabase.from('esposas').insert({
            irmao_id: irmaoId, nome: familiares.conjuge.nome,
            data_nascimento: familiares.conjuge.data_nascimento,
            data_casamento: familiares.conjuge.data_casamento,
            profissao: familiares.conjuge.profissao,
            email: familiares.conjuge.email || null
          });
        }
      }

      // Salvar pais (um registro por pai/mãe)
      if (familiares.pais.pai?.nome) {
        const { data: paiExiste } = await supabase.from('pais').select('id').eq('irmao_id', irmaoId).eq('tipo', 'pai').maybeSingle();
        if (paiExiste) {
          await supabase.from('pais').update({
            nome: familiares.pais.pai.nome,
            data_nascimento: familiares.pais.pai.data_nascimento,
            falecido: familiares.pais.pai.falecido || false,
            data_obito: familiares.pais.pai.data_obito || null
          }).eq('id', paiExiste.id);
        } else {
          await supabase.from('pais').insert({
            irmao_id: irmaoId, tipo: 'pai',
            nome: familiares.pais.pai.nome,
            data_nascimento: familiares.pais.pai.data_nascimento,
            falecido: familiares.pais.pai.falecido || false,
            data_obito: familiares.pais.pai.data_obito || null
          });
        }
      }
      
      if (familiares.pais.mae?.nome) {
        const { data: maeExiste } = await supabase.from('pais').select('id').eq('irmao_id', irmaoId).eq('tipo', 'mae').maybeSingle();
        if (maeExiste) {
          await supabase.from('pais').update({
            nome: familiares.pais.mae.nome,
            data_nascimento: familiares.pais.mae.data_nascimento,
            falecido: familiares.pais.mae.falecido || false,
            data_obito: familiares.pais.mae.data_obito || null
          }).eq('id', maeExiste.id);
        } else {
          await supabase.from('pais').insert({
            irmao_id: irmaoId, tipo: 'mae',
            nome: familiares.pais.mae.nome,
            data_nascimento: familiares.pais.mae.data_nascimento,
            falecido: familiares.pais.mae.falecido || false,
            data_obito: familiares.pais.mae.data_obito || null
          });
        }
      }

      // Salvar cargos
      await supabase.from('historico_cargos').delete().eq('irmao_id', irmaoId);
      if (historicoCargos.length > 0) {
        await supabase.from('historico_cargos').insert(
          historicoCargos.map(c => ({ irmao_id: irmaoId, ano: c.ano, cargo: c.cargo }))
        );
      }

      // Salvar filhos - deletar todos e inserir novos
      const { error: deleteError } = await supabase.from('filhos').delete().eq('irmao_id', irmaoId);
      if (deleteError) console.error('Erro ao deletar filhos:', deleteError);
      
      if (familiares.filhos.length > 0) {
        const { error: insertError } = await supabase.from('filhos').insert(
          familiares.filhos.map(f => ({
            irmao_id: irmaoId,
            nome: f.nome,
            data_nascimento: f.data_nascimento || null,
            sexo: f.sexo || 'M',
            tipo_vinculo: f.tipo_vinculo || 'filho',
            vivo: f.vivo !== false,
            data_obito: f.data_obito || null
          }))
        );
        if (insertError) throw insertError;
      }

      showSuccess('✅ Perfil atualizado!');
      setModoEdicao(false);
      carregarIrmao();
      carregarFamiliares();
      carregarHistoricoCargos();
    } catch (error) {
      console.error('Erro:', error);
      showError('❌ Erro: ' + error.message);
    }
  };

  const handleSalvar = async () => {
    // Usar mesma função do botão de cima
    await handleSalvarEdicao();
  };

  const calcularIdade = (dataNascimento) => {
    if (!dataNascimento) return '';
    const hoje = new Date();
    const nascimento = new Date(dataNascimento + 'T00:00:00');
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const mes = hoje.getMonth() - nascimento.getMonth();
    if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
      idade--;
    }
    return `${idade} anos`;
  };

  const calcularTempoMaconaria = (dataIniciacao) => {
    if (!dataIniciacao) return '';
    const inicio = new Date(dataIniciacao + 'T00:00:00');
    const hoje = new Date();
    let anos = hoje.getFullYear() - inicio.getFullYear();
    let meses = hoje.getMonth() - inicio.getMonth();
    if (meses < 0) { anos--; meses = 12 + meses; }
    return `${anos} ano(s) e ${meses} mês(es)`;
  };

  const handleUploadFoto = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      showError('❌ Apenas imagens são permitidas');
      return;
    }

    // Validar tamanho (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showError('❌ Imagem muito grande. Máximo 5MB');
      return;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${irmaoId}_${Date.now()}.${fileExt}`;
      const filePath = `fotos_irmaos/${fileName}`;

      // Upload para Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('loja-acacia')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('loja-acacia')
        .getPublicUrl(filePath);

      // Atualizar no banco
      const { error: updateError } = await supabase
        .from('irmaos')
        .update({ foto_url: publicUrl })
        .eq('id', irmaoId);

      if (updateError) throw updateError;

      showSuccess('✅ Foto atualizada com sucesso!');
      carregarIrmao();
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      showError('❌ Erro ao fazer upload: ' + error.message);
    }
  };

  const handleUploadPDF = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tipo
    if (file.type !== 'application/pdf') {
      showError('❌ Apenas arquivos PDF são permitidos');
      return;
    }

    // Validar tamanho (máx 10MB)
    if (file.size > 10 * 1024 * 1024) {
      showError('❌ Arquivo muito grande. Máximo 10MB');
      return;
    }

    try {
      const fileName = `${irmaoId}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `documentos_irmaos/${fileName}`;

      // Upload para Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('loja-acacia')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('loja-acacia')
        .getPublicUrl(filePath);

      // Salvar na tabela documentos_irmaos
      const { error: insertError } = await supabase
        .from('documentos_irmaos')
        .insert({
          irmao_id: irmaoId,
          nome_arquivo: file.name,
          url_arquivo: publicUrl,
          tipo: 'pdf'
        });

      if (insertError) throw insertError;

      showSuccess('✅ Documento enviado com sucesso!');
      carregarDocumentos();
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      showError('❌ Erro ao fazer upload: ' + error.message);
    }
  };

  const [documentos, setDocumentos] = useState([]);

  const carregarDocumentos = async () => {
    const { data } = await supabase
      .from('documentos_irmaos')
      .select('*')
      .eq('irmao_id', irmaoId)
      .order('created_at', { ascending: false });
    
    setDocumentos(data || []);
  };

  const handleExcluirDocumento = async (docId, urlArquivo) => {
    if (!confirm('Deseja realmente excluir este documento?')) return;

    try {
      // Extrair caminho do arquivo da URL
      const filePath = urlArquivo.split('/').slice(-2).join('/');
      
      // Excluir do storage
      await supabase.storage
        .from('loja-acacia')
        .remove([filePath]);

      // Excluir do banco
      const { error } = await supabase
        .from('documentos_irmaos')
        .delete()
        .eq('id', docId);

      if (error) throw error;

      showSuccess('✅ Documento excluído com sucesso!');
      carregarDocumentos();
    } catch (error) {
      showError('❌ Erro ao excluir documento: ' + error.message);
    }
  };

  useEffect(() => {
    if (irmaoId && abaSelecionada === 'documentos') {
      carregarDocumentos();
    }
  }, [irmaoId, abaSelecionada]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl">Carregando perfil...</div>
      </div>
    );
  }

  if (!irmao) {
    return (
      <div className="text-center py-12">
        <p>Irmão não encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" style={{background:"var(--color-bg)",minHeight:"100vh",padding:"0.5rem",overflowX:"hidden"}}>
      {/* Header com foto e nome */}
      <div style={{background:"var(--color-surface)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",overflow:"hidden"}}>
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex gap-6 items-start">
              <div className="flex flex-col items-center gap-2">
                {irmao.foto_url ? (
                  <img
                    src={irmao.foto_url}
                    alt={irmao.nome}
                    className="w-24 h-24 rounded-full border-4 object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full border-4 flex items-center justify-center">
                    <span style={{fontSize:"2.5rem"}}>👤</span>
                  </div>
                )}
                
                {/* Botão upload foto */}
                {(permissoes?.pode_editar_irmaos || userEmail === irmao.email) && (
                  <label style={{cursor:"pointer",color:"var(--color-text-muted)",padding:"0.15rem 0.75rem",borderRadius:"var(--radius-md)",fontSize:"0.75rem",fontWeight:"600",border:"1px solid var(--color-border)",background:"var(--color-surface-2)"}}>
                    📷 Alterar Foto
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadFoto}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              
              <div>
                <h1 className="text-3xl font-bold mb-2">{irmao.nome}</h1>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">CIM:</span>
                    <span>{irmao.cim || 'Não informado'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Grau:</span>
                    <span>
                      {irmao.data_exaltacao ? (irmao.mestre_instalado ? 'Mestre Instalado' : 'Mestre') : irmao.data_elevacao ? 'Companheiro' : 'Aprendiz'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Status:</span>
                    <span style={{padding:'0.15rem 0.5rem',borderRadius:'999px',fontSize:'0.72rem',fontWeight:'700',color:'#fff',background:irmao.status==='ativo'?'#10b981':'var(--color-surface-3)'}}>
                      {irmao.status?.toUpperCase() || 'ATIVO'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {/* Botão Editar - apenas se for o próprio irmão */}
              {userEmail === irmao.email && !modoEdicao && (
                <button
                  onClick={() => setModoEdicao(true)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  ✏️ Editar Meu Perfil
                </button>
              )}
              
              {/* Botões de salvar/cancelar quando em edição */}
              {modoEdicao && (
                <>
                  <button
                    onClick={handleSalvarEdicao}
                    style={{padding:"0.5rem 1rem",background:"#10b981",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"700"}}
                  >
                    ✓ Salvar
                  </button>
                  <button
                    onClick={() => {
                      setModoEdicao(false);
                      carregarIrmao(); // Recarrega dados originais
                    }}
                    style={{padding:"0.5rem 1rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"600"}}
                  >
                    ✕ Cancelar
                  </button>
                </>
              )}
              
              <button
                onClick={onVoltar}
                style={{padding:"0.5rem 1rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"600"}}
              >
                ← Voltar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Abas */}
      <div className="rounded-lg shadow" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div className="flex border-b overflow-x-auto">
          <button
            onClick={() => setAbaSelecionada('pessoal')}
            style={{padding:'0.75rem 1.5rem',fontWeight:'600',cursor:'pointer',border:'none',background:'transparent',whiteSpace:'nowrap',borderBottom:abaSelecionada==='pessoal'?'3px solid var(--color-accent)':'3px solid transparent',color:abaSelecionada==='pessoal'?'var(--color-accent)':'var(--color-text-muted)'}}
          >
            📋 Dados Pessoais
          </button>
          <button
            onClick={() => setAbaSelecionada('maconico')}
            style={{padding:'0.75rem 1.5rem',fontWeight:'600',cursor:'pointer',border:'none',background:'transparent',whiteSpace:'nowrap',borderBottom:abaSelecionada==='maconico'?'3px solid var(--color-accent)':'3px solid transparent',color:abaSelecionada==='maconico'?'var(--color-accent)':'var(--color-text-muted)'}}
          >
            🔨 Dados Maçônicos
          </button>
          <button
            onClick={() => setAbaSelecionada('familiar')}
            style={{padding:'0.75rem 1.5rem',fontWeight:'600',cursor:'pointer',border:'none',background:'transparent',whiteSpace:'nowrap',borderBottom:abaSelecionada==='familiar'?'3px solid var(--color-accent)':'3px solid transparent',color:abaSelecionada==='familiar'?'var(--color-accent)':'var(--color-text-muted)'}}
          >
            👨‍👩‍👧 Dados Familiares
          </button>
          <button
            onClick={() => setAbaSelecionada('vida-maconica')}
            style={{padding:'0.75rem 1.5rem',fontWeight:'600',cursor:'pointer',border:'none',background:'transparent',whiteSpace:'nowrap',borderBottom:abaSelecionada==='vida-maconica'?'3px solid var(--color-accent)':'3px solid transparent',color:abaSelecionada==='vida-maconica'?'var(--color-accent)':'var(--color-text-muted)'}}
          >
            🔺 Vida Maçônica
          </button>
          <button
            onClick={() => setAbaSelecionada('situacoes')}
            style={{padding:'0.75rem 1.5rem',fontWeight:'600',cursor:'pointer',border:'none',background:'transparent',whiteSpace:'nowrap',borderBottom:abaSelecionada==='situacoes'?'3px solid var(--color-accent)':'3px solid transparent',color:abaSelecionada==='situacoes'?'var(--color-accent)':'var(--color-text-muted)'}}
          >
            📋 Situações
          </button>
          <button
            onClick={() => setAbaSelecionada('documentos')}
            style={{padding:'0.75rem 1.5rem',fontWeight:'600',cursor:'pointer',border:'none',background:'transparent',whiteSpace:'nowrap',borderBottom:abaSelecionada==='documentos'?'3px solid var(--color-accent)':'3px solid transparent',color:abaSelecionada==='documentos'?'var(--color-accent)':'var(--color-text-muted)'}}
          >
            📄 Documentos
          </button>
        </div>

        {/* Conteúdo das Abas */}
        <div className="p-6">
          {/* ABA: Dados Pessoais */}
          {abaSelecionada === 'pessoal' && (
            <div className="space-y-6">
              {/* Quadro: Identificação */}
              <div style={boxCard}>
                <h4 style={boxTitle}>🪪 Identificação</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Nome Completo */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Nome Completo</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.nome || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, nome: e.target.value })}
                      className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    />
                  ) : (
                    <p className="font-medium">{irmao.nome}</p>
                  )}
                </div>

                {/* CPF */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>CPF</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.cpf || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, cpf: e.target.value })}
                      className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    />
                  ) : (
                    <p>{irmao.cpf || 'Não informado'}</p>
                  )}
                </div>

                {/* RG */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>RG</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.rg || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, rg: e.target.value })}
                      className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    />
                  ) : (
                    <p>{irmao.rg || 'Não informado'}</p>
                  )}
                </div>

                {/* Data de Nascimento */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Data de Nascimento</label>
                  {modoEdicao ? (
                    <input
                      type="date"
                      value={irmaoForm.data_nascimento || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, data_nascimento: e.target.value })}
                      className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    />
                  ) : (
                    <div>
                      <p>
                        {irmao.data_nascimento ? irmao.data_nascimento.split('-').reverse().join('/') : 'Não informado'}
                      </p>
                      {irmao.data_nascimento && (
                        <p className="text-xs">{calcularIdade(irmao.data_nascimento)}</p>
                      )}
                    </div>
                  )}
                </div>
                </div>
              </div>

              {/* Quadro: Contato */}
              <div style={boxCard}>
                <h4 style={boxTitle}>📞 Contato</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Email</label>
                  {modoEdicao ? (
                    <input
                      type="email"
                      value={irmaoForm.email || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, email: e.target.value })}
                      className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    />
                  ) : (
                    <p>{irmao.email || 'Não informado'}</p>
                  )}
                </div>

                {/* Telefone */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Telefone</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.telefone || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, telefone: e.target.value })}
                      className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    />
                  ) : (
                    <p>{irmao.telefone || 'Não informado'}</p>
                  )}
                </div>
                </div>
              </div>

              {/* Quadro: Profissional / Formação */}
              <div style={boxCard}>
                <h4 style={boxTitle}>🎓 Profissional / Formação</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Profissão */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Profissão</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.profissao || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, profissao: e.target.value })}
                      className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    />
                  ) : (
                    <p>{irmao.profissao || 'Não informado'}</p>
                  )}
                </div>

                {/* Estado Civil */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Estado Civil</label>
                  {modoEdicao ? (
                    <select
                      value={irmaoForm.estado_civil || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, estado_civil: e.target.value })}
                      className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    >
                      <option value="">Selecione... *</option>
                      {ESTADOS_CIVIS.map(ec => <option key={ec.value} value={ec.value}>{ec.label}</option>)}
                    </select>
                  ) : (
                    <p>{rotuloEstadoCivilCompleto(irmao.estado_civil, irmao.uniao_estavel) || 'Não informado'}</p>
                  )}
                  {modoEdicao && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>União Estável *</label>
                      <CampoUniaoEstavel
                        estadoCivil={irmaoForm.estado_civil}
                        valor={irmaoForm.uniao_estavel}
                        onChange={(v) => setIrmaoForm({ ...irmaoForm, uniao_estavel: v })}
                        className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                      />
                    </div>
                  )}
                </div>

                {/* Naturalidade */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Naturalidade</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.naturalidade || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, naturalidade: e.target.value })}
                      placeholder="Ex: Cuiabá/MT"
                      className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    />
                  ) : (
                    <p>{irmao.naturalidade || 'Não informado'}</p>
                  )}
                </div>

                {/* Formação */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Formação Acadêmica</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.formacao || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, formacao: e.target.value })}
                      placeholder="Ex: Bacharel em Direito..."
                      className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    />
                  ) : (
                    <p>{irmao.formacao || 'Não informado'}</p>
                  )}
                </div>

                {/* Escolaridade */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Escolaridade</label>
                  {modoEdicao ? (
                    <select
                      value={irmaoForm.escolaridade || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, escolaridade: e.target.value })}
                      className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    >
                      <option value="fundamental_incompleto">Fundamental Incompleto</option>
                      <option value="fundamental_completo">Fundamental Completo</option>
                      <option value="medio_incompleto">Médio Incompleto</option>
                      <option value="medio_completo">Médio Completo</option>
                      <option value="superior_incompleto">Superior Incompleto</option>
                      <option value="superior_completo">Superior Completo</option>
                      <option value="pos_graduacao">Pós-Graduação</option>
                      <option value="mestrado">Mestrado</option>
                      <option value="doutorado">Doutorado</option>
                    </select>
                  ) : (
                    <p>{irmao.escolaridade?.replace(/_/g, ' ') || 'Não informado'}</p>
                  )}
                </div>
                </div>
              </div>

              {/* Quadro: Endereço */}
              <div style={boxCard}>
                <h4 style={boxTitle}>📍 Endereço</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>CEP</label>
                      {modoEdicao ? (
                        <input
                          type="text"
                          value={irmaoForm.cep || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, cep: e.target.value })}
                          className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                        />
                      ) : (
                        <p>{irmao.cep || 'Não informado'}</p>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Logradouro</label>
                      {modoEdicao ? (
                        <input
                          type="text"
                          value={irmaoForm.endereco || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, endereco: e.target.value })}
                          className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                        />
                      ) : (
                        <p>{irmao.endereco || 'Não informado'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Número</label>
                      {modoEdicao ? (
                        <input
                          type="text"
                          value={irmaoForm.numero || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, numero: e.target.value })}
                          className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                        />
                      ) : (
                        <p>{irmao.numero || 'S/N'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Complemento</label>
                      {modoEdicao ? (
                        <input
                          type="text"
                          value={irmaoForm.complemento || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, complemento: e.target.value })}
                          className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                        />
                      ) : (
                        <p>{irmao.complemento || '-'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Bairro</label>
                      {modoEdicao ? (
                        <input
                          type="text"
                          value={irmaoForm.bairro || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, bairro: e.target.value })}
                          className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                        />
                      ) : (
                        <p>{irmao.bairro || 'Não informado'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Cidade</label>
                      {modoEdicao ? (
                        <input
                          type="text"
                          value={irmaoForm.cidade || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, cidade: e.target.value })}
                          className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                        />
                      ) : (
                        <p>{irmao.cidade || 'Não informado'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Estado</label>
                      {modoEdicao ? (
                        <input
                          type="text"
                          value={irmaoForm.estado || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, estado: e.target.value })}
                          maxLength={2}
                          className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                        />
                      ) : (
                        <p>{irmao.estado || 'Não informado'}</p>
                      )}
                    </div>
                  </div>
              </div>
            </div>
          )}

          {/* ABA: Dados Maçônicos */}
          {abaSelecionada === 'maconico' && (
            <div className="space-y-6">
              {/* Quadro: CIM e Situação */}
              <div style={boxCard}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>CIM</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.cim || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, cim: e.target.value })}
                      className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    />
                  ) : (
                    <p className="font-medium text-lg">{irmao.cim || 'Não informado'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Situação</label>
                  {modoEdicao ? (
                    <select
                      value={irmaoForm.situacao || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, situacao: e.target.value })}
                      className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    >
                      <option value="regular">Regular</option>
                      <option value="irregular">Irregular</option>
                      <option value="licenciado">Licenciado</option>
                      <option value="suspenso">Suspenso</option>
                      <option value="desligado">Quite Placet</option>
                      <option value="excluido">Excluído</option>
                      <option value="falecido">Falecido</option>
                      <option value="ex_oficio">Ex-Ofício</option>
                    </select>
                  ) : (
                    <p className="capitalize text-lg">{irmao.situacao || 'Regular'}</p>
                  )}
                </div>
                </div>
              </div>

              {/* CAMPOS DE DATAS CONDICIONAIS - Aparecem conforme a situação */}
              <div className="border-l-4 p-4 rounded-lg" style={{background:"rgba(245,158,11,0.08)",borderLeftColor:"#f59e0b",border:"1px solid rgba(245,158,11,0.2)"}}>
                <h4 className="text-sm font-semibold text-yellow-800 mb-3 flex items-center gap-2" style={{color:"var(--color-text)"}}>
                  <span>📅</span> Datas Específicas da Situação
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* CAMPOS DESATIVADOS - Agora usam histórico de situações
                  
                  {/* Data de Licença */}
                  {/* {(modoEdicao ? irmaoForm.situacao === 'licenciado' : irmao.situacao === 'licenciado') && (
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                        Data de Início da Licença
                        {modoEdicao && (
                          <span className="block text-xs font-normal mt-0.5">
                            A partir desta data, será considerado licenciado
                          </span>
                        )}
                      </label>
                      {modoEdicao ? (
                        <input
                          type="date"
                          value={irmaoForm.data_licenca || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, data_licenca: e.target.value })}
                          className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                        />
                      ) : (
                        <p>
                          {irmao.data_licenca ? irmao.data_licenca.split('-').reverse().join('/') : 'Não informado'}
                        </p>
                      )}
                    </div>
                  )} */}

                  {/* Data de Desligamento - para Desligado e Ex-Ofício */}
                  {/* {(modoEdicao 
                    ? (irmaoForm.situacao === 'desligado' || irmaoForm.situacao === 'ex_oficio')
                    : (irmao.situacao === 'desligado' || irmao.situacao === 'ex_oficio')
                  ) && (
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                        Data do Desligamento
                        {modoEdicao && (
                          <span className="block text-xs font-normal mt-0.5">
                            {(modoEdicao ? irmaoForm.situacao : irmao.situacao) === 'ex_oficio' 
                              ? 'Data do desligamento forçado (Ex-Ofício)'
                              : 'A partir desta data, será considerado desligado'}
                          </span>
                        )}
                      </label>
                      {modoEdicao ? (
                        <input
                          type="date"
                          value={irmaoForm.data_desligamento || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, data_desligamento: e.target.value })}
                          className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                        />
                      ) : (
                        <p>
                          {irmao.data_desligamento ? irmao.data_desligamento.split('-').reverse().join('/') : 'Não informado'}
                        </p>
                      )}
                    </div>
                  )} */}

                  {/* Data de Falecimento */}
                  {(modoEdicao ? irmaoForm.situacao === 'falecido' : irmao.situacao === 'falecido') && (
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                        Data do Falecimento
                        {modoEdicao && (
                          <span className="block text-xs font-normal mt-0.5">
                            Após esta data, não aparecerá nas listas de presença
                          </span>
                        )}
                      </label>
                      {modoEdicao ? (
                        <input
                          type="date"
                          value={irmaoForm.data_falecimento || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, data_falecimento: e.target.value })}
                          className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                        />
                      ) : (
                        <p>
                          {irmao.data_falecimento ? irmao.data_falecimento.split('-').reverse().join('/') : 'Não informado'}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {modoEdicao && !['falecido'].includes(irmaoForm.situacao) && (
                  <p className="text-sm italic mt-2">
                    ℹ️ Para registrar licenças e desligamentos, use a aba "Situações"
                  </p>
                )}
                
                {/* Informação sobre prerrogativa por idade */}
                {(modoEdicao ? irmaoForm.data_nascimento : irmao.data_nascimento) && (() => {
                  const calcularIdade = (dataNasc) => {
                    if (!dataNasc) return 0;
                    const hoje = new Date();
                    const nascimento = new Date(dataNasc);
                    let idade = hoje.getFullYear() - nascimento.getFullYear();
                    const m = hoje.getMonth() - nascimento.getMonth();
                    if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
                      idade--;
                    }
                    return idade;
                  };
                  
                  const idade = calcularIdade(modoEdicao ? irmaoForm.data_nascimento : irmao.data_nascimento);
                  if (idade >= 70) {
                    return (
                      <div className="mt-3 p-3 rounded" style={{background:"var(--color-accent-bg)",border:"1px solid var(--color-border)"}}>
                        <p style={{fontSize:"0.875rem",color:"var(--color-text)"}}>
                          💡 <strong>Com Prerrogativa por Idade</strong> - Este irmão tem {idade} anos.
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* LINHA 2: DATAS ESPECÍFICAS DA SITUAÇÃO - Já está no lugar correto */}

              {/* LINHA 3: DATA DE INGRESSO NA LOJA */}
              <div className="border-l-4 p-4 rounded-lg" style={{background:"var(--color-accent-bg)",borderLeftColor:"var(--color-accent)"}}>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                    ➡️ Data de Ingresso na Loja
                    <span className="block text-xs font-normal">Quando veio transferido de outra loja</span>
                  </label>
                  {modoEdicao ? (
                    <>
                      <input
                        type="date"
                        value={irmaoForm.data_ingresso_loja || ''}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, data_ingresso_loja: e.target.value })}
                        className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                      />
                      <p className="text-xs mt-1">
                        ℹ️ Deixe vazio se foi iniciado nesta loja. Para transferências de saída, use a aba "Situações"
                      </p>
                    </>
                  ) : (
                    <p>
                      {irmao.data_ingresso_loja ? irmao.data_ingresso_loja.split('-').reverse().join('/') : 'Iniciado nesta loja'}
                    </p>
                  )}
                </div>
              </div>

              {/* Quadro: Datas Maçônicas */}
              <div style={boxCard}>
                <h4 style={boxTitle}>🕐 Datas Maçônicas</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>🔨 Data de Iniciação</label>
                  {modoEdicao ? (
                    <input
                      type="date"
                      value={irmaoForm.data_iniciacao || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, data_iniciacao: e.target.value })}
                      className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    />
                  ) : (
                    <div>
                      <p>
                        {irmao.data_iniciacao ? irmao.data_iniciacao.split('-').reverse().join('/') : 'Não informado'}
                      </p>
                      {irmao.data_iniciacao && (
                        <p className="text-xs">{calcularTempoMaconaria(irmao.data_iniciacao)}</p>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>📐 Data de Elevação</label>
                  {modoEdicao ? (
                    <input
                      type="date"
                      value={irmaoForm.data_elevacao || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, data_elevacao: e.target.value })}
                      className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    />
                  ) : (
                    <p>
                      {irmao.data_elevacao ? irmao.data_elevacao.split('-').reverse().join('/') : 'Não informado'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>🏛️ Data de Exaltação</label>
                  {modoEdicao ? (
                    <input
                      type="date"
                      value={irmaoForm.data_exaltacao || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, data_exaltacao: e.target.value })}
                      className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    />
                  ) : (
                    <p>
                      {irmao.data_exaltacao ? irmao.data_exaltacao.split('-').reverse().join('/') : 'Não informado'}
                    </p>
                  )}
                </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{marginTop:"1rem"}}>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>⭐ Mestre Instalado?</label>
                  {modoEdicao ? (
                    <div className="flex gap-4">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="mestre_instalado"
                          checked={irmaoForm.mestre_instalado === true}
                          onChange={() => setIrmaoForm({ ...irmaoForm, mestre_instalado: true })}
                          style={{width:"1rem",height:"1rem",accentColor:"var(--color-accent)"}}
                        />
                        <span className="ml-2 text-sm">Sim</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="mestre_instalado"
                          checked={irmaoForm.mestre_instalado === false}
                          onChange={() => setIrmaoForm({ ...irmaoForm, mestre_instalado: false, data_instalacao: '' })}
                          style={{width:"1rem",height:"1rem",accentColor:"var(--color-accent)"}}
                        />
                        <span className="ml-2 text-sm">Não</span>
                      </label>
                    </div>
                  ) : (
                    <p>{irmao.mestre_instalado ? 'Sim' : 'Não'}</p>
                  )}
                </div>

                {(modoEdicao ? irmaoForm.mestre_instalado : irmao.mestre_instalado) && (
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>📅 Data de Instalação</label>
                    {modoEdicao ? (
                      <input
                        type="date"
                        value={irmaoForm.data_instalacao || ''}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, data_instalacao: e.target.value })}
                        className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                      />
                    ) : (
                      <p>
                        {irmao.data_instalacao ? irmao.data_instalacao.split('-').reverse().join('/') : 'Não informado'}
                      </p>
                    )}
                  </div>
                )}
                </div>
              </div>

              {/* Quadro: Loja de Origem */}
              <div style={boxCard}>
                <h4 style={boxTitle}>🏛️ Loja de Origem</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Loja de Origem</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.loja_origem || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, loja_origem: e.target.value })}
                      className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    />
                  ) : (
                    <p>{irmao.loja_origem || 'Não informado'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Oriente</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.oriente || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, oriente: e.target.value })}
                      className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    />
                  ) : (
                    <p>{irmao.oriente || 'Não informado'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Potência</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.grande_oriente || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, grande_oriente: e.target.value })}
                      className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    />
                  ) : (
                    <p>{irmao.grande_oriente || 'Não informado'}</p>
                  )}
                </div>
                </div>
              </div>

              {/* Quadro: Observações */}
              <div style={boxCard}>
                <h4 style={boxTitle}>📝 Observações</h4>
                {modoEdicao ? (
                  <textarea
                    value={irmaoForm.observacoes || ''}
                    onChange={(e) => setIrmaoForm({ ...irmaoForm, observacoes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                  />
                ) : (
                  <p>{irmao.observacoes || 'Nenhuma observação'}</p>
                )}
              </div>

              {/* HISTÓRICO DE CARGOS */}
              <div className="border-t pt-6">
                <div className="p-3 rounded-lg mb-4" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                  <h4 className="text-md font-semibold flex items-center gap-2" style={{color:"var(--color-text)"}}>
                    <span>🏛️</span>
                    <span>Histórico de Cargos na Loja</span>
                  </h4>
                </div>

                {/* Formulário para adicionar cargo - apenas em modo edição */}
                {modoEdicao && (
                  <div className="p-4 rounded-lg mb-4" style={{background:"var(--color-accent-bg)",border:"1px solid var(--color-border)"}}>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-3">
                        <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Ano</label>
                        <input
                          type="number"
                          id="cargo-ano"
                          min="1900"
                          max="2100"
                          className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                          placeholder="Ex: 2024"
                        />
                      </div>
                      <div className="md:col-span-7">
                        <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                          Cargo(s) <span className="text-xs">(separe por vírgula se houver mais de um)</span>
                        </label>
                        <input
                          type="text"
                          id="cargo-nome"
                          className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                          placeholder="Ex: Tesoureiro, Bibliotecário"
                        />
                      </div>
                      <div className="md:col-span-2 flex items-end">
                        <button
                          type="button"
                          onClick={() => {
                            const ano = document.getElementById('cargo-ano').value;
                            const cargo = document.getElementById('cargo-nome').value;
                            if (!ano || !cargo) {
                              alert('Preencha ano e cargo!');
                              return;
                            }
                            setHistoricoCargos([...historicoCargos, { ano, cargo }]);
                            document.getElementById('cargo-ano').value = new Date().getFullYear();
                            document.getElementById('cargo-nome').value = '';
                          }}
                          className="w-full px-3 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                        >
                          ➕ Adicionar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {historicoCargos.length > 0 ? (() => {
                  const total = historicoCargos.length;
                  const meio = Math.ceil(total / 2);
                  const colunas = [
                    { lista: historicoCargos.slice(0, meio), offset: 0 },
                    { lista: historicoCargos.slice(meio), offset: meio },
                  ];
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {colunas.map((coluna, colIdx) => (
                        coluna.lista.length > 0 && (
                          <div key={colIdx} className="border rounded-lg overflow-hidden" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                            <table className="min-w-full divide-y">
                              <thead style={{background:"var(--color-surface-2)"}}>
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Ano</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Cargo(s)</th>
                                  {modoEdicao && (
                                    <th className="px-4 py-3 text-center text-xs font-medium uppercase w-32" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Ações</th>
                                  )}
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {coluna.lista.map((cargo, i) => {
                                  const index = coluna.offset + i;
                                  return (
                                    <tr key={index} className="hover:">
                                      <td className="px-4 py-3 whitespace-nowrap text-sm font-bold" style={{color:"var(--color-text)"}}>
                                        {cargo.ano}
                                      </td>
                                      <td className="px-4 py-3 text-sm font-bold" style={{color:"var(--color-text)"}}>
                                        {cargo.cargo.split(',').map((c, ci) => (
                                          <div key={ci} className="flex items-start gap-1">
                                            <span style={{color:"var(--color-accent)"}}>{ci + 1}.</span>
                                            <span>{c.trim()}</span>
                                          </div>
                                        ))}
                                      </td>
                                      {modoEdicao && (
                                        <td className="px-4 py-3 text-center whitespace-nowrap" style={{color:"var(--color-text)"}}>
                                          <div className="flex gap-2 justify-center">
                                            <button
                                              onClick={() => {
                                                const novoAno = prompt('Digite o novo ano:', cargo.ano);
                                                const novoCargo = prompt('Digite o(s) novo(s) cargo(s) (separe por vírgula):', cargo.cargo);
                                                if (novoAno && novoCargo) {
                                                  const novosHistorico = [...historicoCargos];
                                                  novosHistorico[index] = { ano: novoAno, cargo: novoCargo };
                                                  setHistoricoCargos(novosHistorico);
                                                }
                                              }}
                                              style={{padding:"0.2rem 0.5rem",background:"var(--color-accent)",color:"#fff",border:"none",borderRadius:"var(--radius-md)",fontSize:"0.75rem",cursor:"pointer"}}
                                              title="Editar"
                                            >
                                              ✏️
                                            </button>
                                            <button
                                              onClick={() => {
                                                if (window.confirm('Deseja excluir este registro?')) {
                                                  setHistoricoCargos(historicoCargos.filter((_, i2) => i2 !== index));
                                                }
                                              }}
                                              style={{padding:"0.15rem 0.5rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"var(--radius-sm)",fontSize:"0.72rem",cursor:"pointer"}}
                                              title="Excluir"
                                            >
                                              🗑️
                                            </button>
                                          </div>
                                        </td>
                                      )}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )
                      ))}
                    </div>
                  );
                })() : (
                  <div className="text-center py-8 rounded-lg">
                    <p className="text-sm">
                      Nenhum cargo registrado no histórico.
                    </p>
                  </div>
                )}
              </div>

              {/* Instruções Recebidas e Trabalhos Apresentados */}
              <div className="p-6 rounded-lg shadow" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <InstrucoesTrabalhos
                  irmao={irmao}
                  showSuccess={showSuccess}
                  showError={showError}
                />
              </div>

              {/* Comendas — Grande Loja e Loja */}
              <QuadrosComendas irmaoId={irmaoId} />
            </div>
          )}

          {/* ABA: Dados Familiares */}
          {abaSelecionada === 'familiar' && (
            <div className="space-y-6">
              {/* Cônjuge */}
              <div className="p-6 rounded-lg border-2 border-pink-200" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <h4 className="text-lg font-bold text-pink-900 mb-4 flex items-center gap-2" style={{color:"var(--color-text)"}}>
                  💑 Cônjuge
                </h4>
                {modoEdicao ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Nome</label>
                      <input
                        type="text"
                        value={familiares.conjuge?.nome || ''}
                        onChange={(e) => setFamiliares({
                          ...familiares,
                          conjuge: { ...familiares.conjuge, nome: e.target.value }
                        })}
                        className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Data Nascimento</label>
                      <input
                        type="date"
                        value={familiares.conjuge?.data_nascimento || ''}
                        onChange={(e) => setFamiliares({
                          ...familiares,
                          conjuge: { ...familiares.conjuge, data_nascimento: e.target.value }
                        })}
                        className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Data Casamento</label>
                      <input
                        type="date"
                        value={familiares.conjuge?.data_casamento || ''}
                        onChange={(e) => setFamiliares({
                          ...familiares,
                          conjuge: { ...familiares.conjuge, data_casamento: e.target.value }
                        })}
                        className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Profissão</label>
                      <input
                        type="text"
                        value={familiares.conjuge?.profissao || ''}
                        onChange={(e) => setFamiliares({
                          ...familiares,
                          conjuge: { ...familiares.conjuge, profissao: e.target.value }
                        })}
                        className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>E-mail</label>
                      <input
                        type="email"
                        placeholder="email@exemplo.com"
                        value={familiares.conjuge?.email || ''}
                        onChange={(e) => setFamiliares({
                          ...familiares,
                          conjuge: { ...familiares.conjuge, email: e.target.value }
                        })}
                        className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                      />
                    </div>
                  </div>
                ) : (
                  familiares.conjuge && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-semibold">Nome:</span>
                        <span className="ml-2">{familiares.conjuge.nome}</span>
                      </div>
                      {familiares.conjuge.data_nascimento && (
                        <div>
                          <span className="font-semibold">Data de Nascimento:</span>
                          <span className="ml-2">
                            {familiares.conjuge.data_nascimento.split('-').reverse().join('/')}
                          </span>
                        </div>
                      )}
                      {familiares.conjuge.data_casamento && (
                        <div>
                          <span className="font-semibold">💑 Data de Casamento:</span>
                          <span className="ml-2">
                            {familiares.conjuge.data_casamento.split('-').reverse().join('/')}
                          </span>
                        </div>
                      )}
                      {familiares.conjuge.profissao && (
                        <div>
                          <span className="font-semibold">Profissão:</span>
                          <span className="ml-2">{familiares.conjuge.profissao}</span>
                        </div>
                      )}
                      {familiares.conjuge.email && (
                        <div>
                          <span className="font-semibold">E-mail:</span>
                          <span className="ml-2">{familiares.conjuge.email}</span>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>

              {/* Pais */}
              <div className="p-6 rounded-lg" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <h4 className="text-lg font-bold text-blue-900 mb-4" style={{color:"var(--color-text)"}}>👨‍👩‍👦 Pais</h4>
                {modoEdicao ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h5 className="font-semibold border-b pb-1">Pai</h5>
                      <input
                        type="text"
                        placeholder="Nome do Pai"
                        value={familiares.pais.pai?.nome || ''}
                        onChange={(e) => setFamiliares({
                          ...familiares,
                          pais: { ...familiares.pais, pai: { ...familiares.pais.pai, nome: e.target.value }}
                        })}
                        className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                      />
                      <input
                        type="date"
                        placeholder="Data Nascimento"
                        value={familiares.pais.pai?.data_nascimento || ''}
                        onChange={(e) => setFamiliares({
                          ...familiares,
                          pais: { ...familiares.pais, pai: { ...familiares.pais.pai, data_nascimento: e.target.value }}
                        })}
                        className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                      />
                      
                      {/* Checkbox Vivo */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!familiares.pais.pai?.falecido}
                          onChange={(e) => setFamiliares({
                            ...familiares,
                            pais: { 
                              ...familiares.pais, 
                              pai: { 
                                ...familiares.pais.pai, 
                                falecido: !e.target.checked,
                                data_obito: e.target.checked ? null : familiares.pais.pai?.data_obito
                              }
                            }
                          })}
                          style={{width:"1rem",height:"1rem",accentColor:"var(--color-accent)"}}
                        />
                        <span className="text-sm font-medium">Vivo</span>
                      </label>
                      
                      {/* Data Óbito - aparece se falecido */}
                      {familiares.pais.pai?.falecido && (
                        <div>
                          <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Data de Óbito</label>
                          <input
                            type="date"
                            value={familiares.pais.pai?.data_obito || ''}
                            onChange={(e) => setFamiliares({
                              ...familiares,
                              pais: { ...familiares.pais, pai: { ...familiares.pais.pai, data_obito: e.target.value }}
                            })}
                            className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                          />
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <h5 className="font-semibold border-b pb-1">Mãe</h5>
                      <input
                        type="text"
                        placeholder="Nome da Mãe"
                        value={familiares.pais.mae?.nome || ''}
                        onChange={(e) => setFamiliares({
                          ...familiares,
                          pais: { ...familiares.pais, mae: { ...familiares.pais.mae, nome: e.target.value }}
                        })}
                        className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                      />
                      <input
                        type="date"
                        placeholder="Data Nascimento"
                        value={familiares.pais.mae?.data_nascimento || ''}
                        onChange={(e) => setFamiliares({
                          ...familiares,
                          pais: { ...familiares.pais, mae: { ...familiares.pais.mae, data_nascimento: e.target.value }}
                        })}
                        className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                      />
                      
                      {/* Checkbox Viva */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!familiares.pais.mae?.falecido}
                          onChange={(e) => setFamiliares({
                            ...familiares,
                            pais: { 
                              ...familiares.pais, 
                              mae: { 
                                ...familiares.pais.mae, 
                                falecido: !e.target.checked,
                                data_obito: e.target.checked ? null : familiares.pais.mae?.data_obito
                              }
                            }
                          })}
                          style={{width:"1rem",height:"1rem",accentColor:"var(--color-accent)"}}
                        />
                        <span className="text-sm font-medium">Viva</span>
                      </label>
                      
                      {/* Data Óbito - aparece se falecida */}
                      {familiares.pais.mae?.falecido && (
                        <div>
                          <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Data de Óbito</label>
                          <input
                            type="date"
                            value={familiares.pais.mae?.data_obito || ''}
                            onChange={(e) => setFamiliares({
                              ...familiares,
                              pais: { ...familiares.pais, mae: { ...familiares.pais.mae, data_obito: e.target.value }}
                            })}
                            className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  (familiares.pais.pai || familiares.pais.mae) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Visualização Pai */}
                      <div className="space-y-2">
                        <h5 className="font-semibold border-b pb-1">Pai</h5>
                        {familiares.pais.pai ? (
                          <>
                            <div className="text-sm">
                              <span className="font-medium">Nome:</span>
                              <span className="ml-2">{familiares.pais.pai.nome}</span>
                            </div>
                            {familiares.pais.pai.data_nascimento && (
                              <div className="text-sm">
                                <span className="font-medium">Nascimento:</span>
                                <span className="ml-2">
                                  {familiares.pais.pai.data_nascimento.split('-').reverse().join('/')}
                                </span>
                              </div>
                            )}
                            <div className="text-sm">
                              <span className="font-medium">Status:</span>
                              <span style={{marginLeft:'0.5rem',color:!familiares.pais.pai.falecido?'#10b981':'var(--color-text-muted)'}}>
                                {!familiares.pais.pai.falecido ? '✓ Vivo' : '✝ Falecido'}
                              </span>
                            </div>
                            {familiares.pais.pai.falecido && familiares.pais.pai.data_obito && (
                              <div className="text-sm">
                                <span className="font-medium">Data de Óbito:</span>
                                <span className="ml-2">
                                  {familiares.pais.pai.data_obito.split('-').reverse().join('/')}
                                </span>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-sm">Não informado</p>
                        )}
                      </div>
                      {/* Visualização Mãe */}
                      <div className="space-y-2">
                        <h5 className="font-semibold border-b pb-1">Mãe</h5>
                        {familiares.pais.mae ? (
                          <>
                            <div className="text-sm">
                              <span className="font-medium">Nome:</span>
                              <span className="ml-2">{familiares.pais.mae.nome}</span>
                            </div>
                            {familiares.pais.mae.data_nascimento && (
                              <div className="text-sm">
                                <span className="font-medium">Nascimento:</span>
                                <span className="ml-2">
                                  {familiares.pais.mae.data_nascimento.split('-').reverse().join('/')}
                                </span>
                              </div>
                            )}
                            <div className="text-sm">
                              <span className="font-medium">Status:</span>
                              <span style={{marginLeft:'0.5rem',color:!familiares.pais.mae.falecido?'#10b981':'var(--color-text-muted)'}}>
                                {!familiares.pais.mae.falecido ? '✓ Viva' : '✝ Falecida'}
                              </span>
                            </div>
                            {familiares.pais.mae.falecido && familiares.pais.mae.data_obito && (
                              <div className="text-sm">
                                <span className="font-medium">Data de Óbito:</span>
                                <span className="ml-2">
                                  {familiares.pais.mae.data_obito.split('-').reverse().join('/')}
                                </span>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-sm">Não informado</p>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* Filhos */}
              {(familiares.filhos.length > 0 || modoEdicao) && (
                <div className="p-6 rounded-lg border-2 border-green-200" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                  <h4 className="text-lg font-bold text-green-900 mb-4" style={{color:"var(--color-text)"}}>👶 Filhos ({familiares.filhos.length})</h4>
                  
                  {modoEdicao && (
                    <div style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",padding:"1rem",display:"flex",flexDirection:"column",gap:"0.75rem",marginBottom:"1rem"}}>
                      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:"0.75rem"}}>
                        <div>
                          <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Nome *</label>
                          <input 
                            type="text" 
                            value={filhoForm.nome}
                            onChange={(e) => setFilhoForm({...filhoForm, nome: e.target.value})}
                            placeholder="Nome do filho" 
                            style={{width:"100%",padding:"0.55rem 0.75rem",borderRadius:"var(--radius-md)",background:"var(--color-surface)",color:"var(--color-text)",border:"1px solid var(--color-border)",fontSize:"0.875rem",outline:"none",boxSizing:"border-box"}}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Data Nascimento</label>
                          <input 
                            type="date" 
                            value={filhoForm.data_nascimento}
                            onChange={(e) => setFilhoForm({...filhoForm, data_nascimento: e.target.value})}
                            style={{width:"100%",padding:"0.55rem 0.75rem",borderRadius:"var(--radius-md)",background:"var(--color-surface)",color:"var(--color-text)",border:"1px solid var(--color-border)",fontSize:"0.875rem",outline:"none",boxSizing:"border-box"}}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Sexo</label>
                          <select 
                            value={filhoForm.sexo}
                            onChange={(e) => setFilhoForm({...filhoForm, sexo: e.target.value})}
                            style={{width:"100%",padding:"0.55rem 0.75rem",borderRadius:"var(--radius-md)",background:"var(--color-surface)",color:"var(--color-text)",border:"1px solid var(--color-border)",fontSize:"0.875rem",outline:"none"}}
                          >
                            <option value="M">Masculino</option>
                            <option value="F">Feminino</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Tipo de Vínculo</label>
                          <select 
                            value={filhoForm.tipo_vinculo}
                            onChange={(e) => setFilhoForm({...filhoForm, tipo_vinculo: e.target.value})}
                            style={{width:"100%",padding:"0.55rem 0.75rem",borderRadius:"var(--radius-md)",background:"var(--color-surface)",color:"var(--color-text)",border:"1px solid var(--color-border)",fontSize:"0.875rem",outline:"none"}}
                          >
                            <option value="filho">Filho</option>
                            <option value="filha">Filha</option>
                            <option value="enteado">Enteado</option>
                            <option value="enteada">Enteada</option>
                            <option value="neto">Neto</option>
                            <option value="neta">Neta</option>
                            <option value="bisneto">Bisneto</option>
                            <option value="bisneta">Bisneta</option>
                          </select>
                        </div>
                      </div>

                      <div style={{display:"flex",alignItems:"center",gap:"1rem"}}>
                        <label style={{display:"flex",alignItems:"center",gap:"0.5rem",cursor:"pointer",fontSize:"0.875rem",color:"var(--color-text)",fontWeight:600}}>
                          <input
                            type="checkbox"
                            checked={filhoForm.vivo}
                            onChange={(e) => setFilhoForm({ ...filhoForm, vivo: e.target.checked, data_obito: e.target.checked ? '' : filhoForm.data_obito })}
                            style={{width:"1rem",height:"1rem",accentColor:"var(--color-accent)"}}
                          />
                          Vivo
                        </label>
                        {!filhoForm.vivo && (
                          <div style={{flex:1,maxWidth:"200px"}}>
                            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Data de Óbito</label>
                            <input
                              type="date"
                              value={filhoForm.data_obito}
                              onChange={(e) => setFilhoForm({ ...filhoForm, data_obito: e.target.value })}
                              style={{width:"100%",padding:"0.55rem 0.75rem",borderRadius:"var(--radius-md)",background:"var(--color-surface)",color:"var(--color-text)",border:"1px solid var(--color-border)",fontSize:"0.875rem",outline:"none",boxSizing:"border-box"}}
                            />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (!filhoForm.nome) { alert('Digite o nome!'); return; }
                            
                            const filhoData = {
                              nome: filhoForm.nome,
                              data_nascimento: filhoForm.data_nascimento || null,
                              sexo: filhoForm.sexo || 'M',
                              tipo_vinculo: filhoForm.tipo_vinculo || 'filho',
                              vivo: filhoForm.vivo !== undefined ? filhoForm.vivo : true,
                              data_obito: filhoForm.data_obito || null
                            };
                            
                            if (filhoEditandoIndex !== null) {
                              const novosFilhos = [...familiares.filhos];
                              novosFilhos[filhoEditandoIndex] = filhoData;
                              setFamiliares({ ...familiares, filhos: novosFilhos });
                              setFilhoEditandoIndex(null);
                            } else {
                              setFamiliares({
                                ...familiares,
                                filhos: [...familiares.filhos, filhoData]
                              });
                            }
                            setFilhoForm({ nome: '', data_nascimento: '', sexo: '', tipo_vinculo: '', vivo: true, data_obito: '' });
                          }}
                          style={{padding:"0.5rem 1rem",background:"#10b981",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"600"}}
                        >
                          {filhoEditandoIndex !== null ? '💾 Salvar' : '➕ Adicionar'}
                        </button>
                        {filhoEditandoIndex !== null && (
                          <button
                            type="button"
                            onClick={() => {
                              setFilhoEditandoIndex(null);
                              setFilhoForm({ nome: '', data_nascimento: '', sexo: '', tipo_vinculo: '', vivo: true, data_obito: '' });
                            }}
                            style={{padding:"0.45rem 0.75rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",cursor:"pointer"}}
                          >
                            ✕ Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {familiares.filhos.map((filho, index) => {
                      const sexo = filho.sexo || (filho.tipo === 'Filho' ? 'M' : 'F');
                      return (
                        <div key={index} className="rounded-lg p-4 border border-green-200" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <span className="text-3xl">
                                {sexo === 'M' ? '👦' : '👧'}
                                {!filho.vivo && <span className="ml-1" title="Falecido">🕊️</span>}
                              </span>
                              <div>
                                <h5 className="font-semibold">{filho.nome}</h5>
                                <p className="text-xs">
                                  {sexo === 'M' ? 'Masculino' : 'Feminino'}
                                  {filho.tipo_vinculo && (
                                    <span className="ml-1 capitalize">({filho.tipo_vinculo})</span>
                                  )}
                                </p>
                              </div>
                            </div>
                            {modoEdicao && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setFilhoForm({
                                      ...filho,
                                      vivo: filho.vivo !== undefined ? filho.vivo : true,
                                      data_obito: filho.data_obito || ''
                                    });
                                    setFilhoEditandoIndex(index);
                                  }}
                                  style={{padding:"0.25rem 0.55rem",background:"var(--color-accent-bg)",color:"var(--color-accent)",border:"1px solid var(--color-accent)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => {
                                    const novosFilhos = familiares.filhos.filter((_, i) => i !== index);
                                    setFamiliares({ ...familiares, filhos: novosFilhos });
                                    if (filhoEditandoIndex === index) setFilhoEditandoIndex(null);
                                  }}
                                  style={{padding:"0.25rem 0.55rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}
                                >
                                  🗑️
                                </button>
                              </div>
                            )}
                          </div>
                          {filho.data_nascimento && (
                            <div className="text-sm">
                              <span className="font-medium">Nascimento:</span>
                              <span className="ml-2">{filho.data_nascimento.split('-').reverse().join('/')}</span>
                              <span className="ml-2">({calcularIdade(filho.data_nascimento)})</span>
                            </div>
                          )}
                          <div className="text-sm">
                            <span className="font-medium">Status:</span>
                            <span style={{marginLeft:'0.5rem',color:filho.vivo?'#10b981':'var(--color-text-muted)'}}>
                              {filho.vivo ? '✓ Vivo(a)' : '✝ Falecido(a)'}
                            </span>
                          </div>
                          {!filho.vivo && filho.data_obito && (
                            <div className="text-sm">
                              <span className="font-medium">Data de Óbito:</span>
                              <span className="ml-2">{filho.data_obito.split('-').reverse().join('/')}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Mensagem se não tiver familiares */}
              {!familiares.conjuge && !familiares.pais.pai && !familiares.pais.mae && familiares.filhos.length === 0 && (
                <div className="text-center py-12 rounded-lg border-2 border-dashed" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                  <div className="text-6xl mb-4">👨‍👩‍👧‍👦</div>
                  <p className="text-lg font-medium">Nenhum familiar cadastrado</p>
                </div>
              )}
            </div>
          )}

          {/* ABA: Vida Maçônica */}
          {abaSelecionada === 'vida-maconica' && (
            <VidaMaconica
              irmaoId={irmaoId}
              showSuccess={showSuccess}
              showError={showError}
            />
          )}

          {/* ABA: Situações (Licenças, Desligamentos, etc) */}
          {abaSelecionada === 'situacoes' && (
            <GestaoSituacoes irmaId={irmaoId} />
          )}

          {/* ABA: Documentos */}
          {abaSelecionada === 'documentos' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>📄 Documentos</h2>
                
                {(permissoes?.pode_editar_irmaos || userEmail === irmao.email) && (
                  <label className="cursor-pointer bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium" style={{color:"var(--color-text-muted)"}}>
                    📤 Enviar PDF
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handleUploadPDF}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {documentos.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-lg">Nenhum documento cadastrado</p>
                  <p className="text-sm mt-2">Use o botão acima para enviar arquivos PDF</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {documentos.map(doc => (
                    <div key={doc.id} className="border rounded-lg p-4 flex items-center justify-between hover: transition-shadow" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">📄</span>
                        <div>
                          <p className="font-medium">{doc.nome_arquivo}</p>
                          <p className="text-sm">
                            Enviado em {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={doc.url_arquivo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors text-sm"
                        >
                          👁️ Ver
                        </a>
                        {(permissoes?.pode_editar_irmaos || userEmail === irmao.email) && (
                          <button
                            onClick={() => handleExcluirDocumento(doc.id, doc.url_arquivo)}
                            style={{padding:"0.4rem 0.75rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"var(--radius-md)",cursor:"pointer",fontSize:"0.82rem",fontWeight:"600"}}
                          >
                            🗑️ Excluir
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Botões de Ação */}
      {abaSelecionada !== 'vida-maconica' && (
        <div className="flex gap-4 justify-end p-4 rounded-lg shadow" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
          {modoEdicao ? (
            <>
              <button
                onClick={() => {
                  setModoEdicao(false);
                  setIrmaoForm(irmao);
                }}
                style={{padding:"0.5rem 1rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"600"}}
              >
                ❌ Cancelar
              </button>
              <button
                onClick={handleSalvar}
                style={{padding:"0.5rem 1.5rem",background:"#10b981",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"700"}}
              >
                💾 Salvar Alterações
              </button>
            </>
          ) : (
            <>
              {/* Só pode editar se: é o próprio perfil OU tem permissão */}
              {(irmao?.email === userEmail || permissoes?.canEditMembers || permissoes?.canEdit) && (
                <button
                  onClick={() => setModoEdicao(true)}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  ✏️ Editar
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
