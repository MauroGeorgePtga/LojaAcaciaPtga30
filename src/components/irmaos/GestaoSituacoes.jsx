import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function GestaoSituacoes({ irmaId }) {
  const [situacoes, setSituacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });

  // Form state
  const [form, setForm] = useState({
    tipo_situacao: 'licenca',
    data_inicio: '',
    data_fim: '',
    motivo: '',
    destino_transferencia: '',
    documento: '',
    observacoes: ''
  });

  useEffect(() => {
    if (irmaId) {
      carregar();
    }
  }, [irmaId]);

  const carregar = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('historico_situacoes')
        .select('*')
        .eq('membro_id', irmaId)
        .order('data_inicio', { ascending: false });

      if (error) throw error;

      // Situação com data de fim já passada e ainda "ativa" → encerra automaticamente
      const hojeStr = new Date().toISOString().split('T')[0];
      const vencidas = (data || []).filter(x => x.status === 'ativa' && x.data_fim && x.data_fim < hojeStr);
      if (vencidas.length) {
        await supabase.from('historico_situacoes').update({ status: 'vencida' }).in('id', vencidas.map(x => x.id));
        vencidas.forEach(x => { x.status = 'vencida'; });
        await atualizarSituacaoCadastro(data);
      }
      setSituacoes(data || []);
    } catch (error) {
      console.error('Erro ao carregar situações:', error);
      setMensagem({ tipo: 'erro', texto: 'Erro ao carregar situações' });
    } finally {
      setLoading(false);
    }
  };

  const abrirModal = (situacao = null) => {
    if (situacao) {
      setEditando(situacao.id);
      setForm({
        tipo_situacao: situacao.tipo_situacao,
        data_inicio: situacao.data_inicio,
        data_fim: situacao.data_fim || '',
        motivo: situacao.motivo || '',
        destino_transferencia: situacao.destino_transferencia || '',
        documento: situacao.documento || '',
        observacoes: situacao.observacoes || ''
      });
    } else {
      setEditando(null);
      setForm({
        tipo_situacao: 'licenca',
        data_inicio: '',
        data_fim: '',
        motivo: '',
        destino_transferencia: '',
        documento: '',
        observacoes: ''
      });
    }
    setMostrarModal(true);
  };

  const fecharModal = () => {
    setMostrarModal(false);
    setEditando(null);
    setForm({
      tipo_situacao: 'licenca',
      data_inicio: '',
      data_fim: '',
      motivo: '',
      destino_transferencia: '',
      documento: '',
      observacoes: ''
    });
  };

  const salvar = async () => {
    try {
      if (!form.data_inicio) {
        setMensagem({ tipo: 'erro', texto: 'Data de início é obrigatória' });
        return;
      }

      const dados = {
        membro_id: irmaId,
        tipo_situacao: form.tipo_situacao,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim || null,
        motivo: form.motivo,
        destino_transferencia: form.tipo_situacao === 'desligado' ? form.destino_transferencia : null,
        documento: form.documento,
        observacoes: form.observacoes,
        status: 'ativa'
      };

      let error;
      if (editando) {
        ({ error } = await supabase
          .from('historico_situacoes')
          .update(dados)
          .eq('id', editando));
      } else {
        ({ error } = await supabase
          .from('historico_situacoes')
          .insert([dados]));
      }

      if (error) throw error;

      setMensagem({ 
        tipo: 'sucesso', 
        texto: editando ? 'Situação atualizada com sucesso!' : 'Situação criada com sucesso!' 
      });
      
      fecharModal();
      carregar();
      
      setTimeout(() => setMensagem({ tipo: '', texto: '' }), 3000);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      setMensagem({ tipo: 'erro', texto: 'Erro ao salvar situação' });
    }
  };

  // Sem licença em vigor → cadastro do irmão volta a "Regular" (só se estava como licenciado)
  const atualizarSituacaoCadastro = async (lista) => {
    const hojeStr = new Date().toISOString().split('T')[0];
    const emVigor = (lista || []).some(x => x.status === 'ativa' && String(x.tipo_situacao || '').toLowerCase().includes('licen')
      && x.data_inicio <= hojeStr && (!x.data_fim || x.data_fim >= hojeStr));
    if (emVigor) return;
    const { data: ir } = await supabase.from('irmaos').select('situacao').eq('id', irmaId).maybeSingle();
    if (ir && String(ir.situacao || '').toLowerCase().includes('licen')) {
      await supabase.from('irmaos').update({ situacao: 'Regular' }).eq('id', irmaId);
    }
  };

  // Encerrar: termina a situação (no fim previsto ou antecipadamente) — o irmão volta a ficar regular
  const encerrar = async (situacao) => {
    const hoje = new Date().toISOString().split('T')[0];
    const antecipado = situacao.data_fim && situacao.data_fim > hoje;
    if (!window.confirm(antecipado
      ? `Encerrar esta situação ANTECIPADAMENTE hoje (${hoje.split('-').reverse().join('/')})?\nO fim previsto era ${situacao.data_fim.split('-').reverse().join('/')}.`
      : 'Deseja encerrar esta situação hoje?')) return;

    try {
      const { error } = await supabase
        .from('historico_situacoes')
        .update({ 
          data_fim: hoje,
          status: 'vencida',
          observacoes: antecipado ? `${situacao.observacoes ? situacao.observacoes + ' · ' : ''}Encerrada antecipadamente em ${hoje.split('-').reverse().join('/')} (fim previsto ${situacao.data_fim.split('-').reverse().join('/')})` : situacao.observacoes
        })
        .eq('id', situacao.id);

      if (error) throw error;
      await atualizarSituacaoCadastro(situacoes.map(x => (x.id === situacao.id ? { ...x, data_fim: hoje, status: 'vencida' } : x)));

      setMensagem({ tipo: 'sucesso', texto: 'Situação encerrada! O irmão volta a ficar regular.' });
      carregar();
      setTimeout(() => setMensagem({ tipo: '', texto: '' }), 3000);
    } catch (error) {
      console.error('Erro ao encerrar:', error);
      setMensagem({ tipo: 'erro', texto: 'Erro ao encerrar situação' });
    }
  };

  // Reativar uma situação cancelada por engano: volta como encerrada (fim já passou) ou em vigor
  const reativar = async (situacao) => {
    const hoje = new Date().toISOString().split('T')[0];
    const novoStatus = situacao.data_fim && situacao.data_fim < hoje ? 'vencida' : 'ativa';
    if (!window.confirm(`Reativar esta situação?\nEla volta como ${novoStatus === 'vencida' ? 'ENCERRADA (o período continua registrado)' : 'ATIVA'}.`)) return;
    try {
      const { error } = await supabase.from('historico_situacoes').update({ status: novoStatus }).eq('id', situacao.id);
      if (error) throw error;
      if (novoStatus === 'vencida') await atualizarSituacaoCadastro(situacoes.map(x => (x.id === situacao.id ? { ...x, status: novoStatus } : x)));
      setMensagem({ tipo: 'sucesso', texto: 'Situação reativada!' });
      carregar();
      setTimeout(() => setMensagem({ tipo: '', texto: '' }), 3000);
    } catch (error) {
      console.error('Erro ao reativar:', error);
      setMensagem({ tipo: 'erro', texto: 'Erro ao reativar situação' });
    }
  };

  const cancelar = async (situacaoId) => {
    if (!window.confirm('Deseja cancelar esta situação?')) return;

    try {
      const { error } = await supabase
        .from('historico_situacoes')
        .update({ status: 'cancelada' })
        .eq('id', situacaoId);

      if (error) throw error;
      await atualizarSituacaoCadastro(situacoes.map(x => (x.id === situacaoId ? { ...x, status: 'cancelada' } : x)));

      setMensagem({ tipo: 'sucesso', texto: 'Situação cancelada!' });
      carregar();
      setTimeout(() => setMensagem({ tipo: '', texto: '' }), 3000);
    } catch (error) {
      console.error('Erro ao cancelar:', error);
      setMensagem({ tipo: 'erro', texto: 'Erro ao cancelar situação' });
    }
  };

  const formatarData = (data) => {
    if (!data) return '-';
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  const getTipoLabel = (tipo) => {
    const labels = {
      'licenca': 'Licença',
      'desligado': 'Quite Placet',
      'ex_oficio': 'Ex-Ofício',
      'suspenso': 'Suspenso',
      'irregular': 'Irregular'
    };
    return labels[tipo] || tipo;
  };

  const getStatusIcon = (situacao) => {
    const hoje = new Date();
    const inicio = new Date(situacao.data_inicio + 'T00:00:00');
    const fim = situacao.data_fim ? new Date(situacao.data_fim + 'T00:00:00') : null;

    if (situacao.status === 'cancelada') return '🚫';
    if (situacao.status === 'vencida') return '⚪';
    if (hoje < inicio) return '🔵'; // Futura
    if (!fim || hoje <= fim) return '🟢'; // Ativa
    return '⚪'; // Vencida
  };

  const getStatusTexto = (situacao) => {
    const hoje = new Date();
    const inicio = new Date(situacao.data_inicio + 'T00:00:00');
    const fim = situacao.data_fim ? new Date(situacao.data_fim + 'T00:00:00') : null;

    if (situacao.status === 'cancelada') return 'CANCELADA';
    if (situacao.status === 'vencida') return 'ENCERRADA';
    if (hoje < inicio) return 'AGENDADA';
    if (!fim || hoje <= fim) return 'ATIVA';
    return 'ENCERRADA';
  };

  if (loading) {
    return <div className="p-4 text-center">Carregando situações...</div>;
  }

  return (
    <div className="rounded-lg p-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
      <div className="flex justify-between items-center mb-4">
        <h3 style={{fontSize:"1.1rem",fontWeight:"700",color:"#fff",margin:0}}>Histórico de Situações</h3>
        <button
          type="button"
          onClick={() => abrirModal()}
          className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-600 transition-colors"
        >
          + Nova Situação
        </button>
      </div>

      {/* Mensagem */}
      {mensagem.texto && (
        <div style={{marginBottom:"1rem",padding:"0.75rem",borderRadius:"var(--radius-md)",background:mensagem.tipo==='sucesso'?'rgba(16,185,129,0.15)':'rgba(239,68,68,0.15)',color:mensagem.tipo==='sucesso'?'#10b981':'#ef4444',border:`1px solid ${mensagem.tipo==='sucesso'?'rgba(16,185,129,0.3)':'rgba(239,68,68,0.3)'}`}}>
          {mensagem.texto}
        </div>
      )}

      {/* Lista de Situações */}
      {situacoes.length === 0 ? (
        <p style={{textAlign:"center",padding:"2rem",color:"var(--color-text-muted)"}}>Nenhuma situação registrada</p>
      ) : (
        <div className="space-y-3">
          {situacoes.map(sit => (
            <div 
              key={sit.id} 
              style={{
                borderRadius:'var(--radius-lg)',
                padding:'1rem',
                border:'1px solid var(--color-border)',
                borderLeft: getStatusTexto(sit)==='ATIVA' ? '4px solid #10b981' :
                            getStatusTexto(sit)==='AGENDADA' ? '4px solid var(--color-accent)' :
                            '4px solid var(--color-border)',
                background: sit.status==='cancelada' ? 'var(--color-surface-2)' : 'var(--color-surface)',
                opacity: sit.status==='cancelada' ? 0.6 : 1,
              }}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{getStatusIcon(sit)}</span>
                    <span style={{
                      fontSize:'0.7rem',fontWeight:'700',padding:'0.15rem 0.5rem',borderRadius:'999px',
                      background:getStatusTexto(sit)==='ATIVA'?'rgba(16,185,129,0.15)':getStatusTexto(sit)==='AGENDADA'?'rgba(59,130,246,0.15)':'var(--color-surface-2)',
                      color:getStatusTexto(sit)==='ATIVA'?'#10b981':getStatusTexto(sit)==='AGENDADA'?'#3b82f6':'var(--color-text-muted)',
                      border:`1px solid ${getStatusTexto(sit)==='ATIVA'?'rgba(16,185,129,0.3)':getStatusTexto(sit)==='AGENDADA'?'rgba(59,130,246,0.3)':'var(--color-border)'}`,
                    }}>
                      {getStatusTexto(sit)}
                    </span>
                    <span style={{fontWeight:"700",fontSize:"1rem",color:"var(--color-text)"}}>{getTipoLabel(sit.tipo_situacao)}</span>
                  </div>
                  
                  <div style={{fontSize:"0.82rem",color:"var(--color-text)",lineHeight:"1.6"}}>
                    <div>
                      <strong>Período:</strong> {formatarData(sit.data_inicio)} 
                      {sit.data_fim ? ` → ${formatarData(sit.data_fim)}` : ' → Indefinido'}
                    </div>
                    {sit.motivo && (
                      <div><strong>Motivo:</strong> {sit.motivo}</div>
                    )}
                    {sit.destino_transferencia && (
                      <div><strong>Destino:</strong> {sit.destino_transferencia}</div>
                    )}
                    {sit.documento && (
                      <div><strong>Documento:</strong> {sit.documento}</div>
                    )}
                    {sit.observacoes && (
                      <div><strong>Obs:</strong> {sit.observacoes}</div>
                    )}
                  </div>
                </div>

                {/* Ações — situação cancelada pode ser editada ou reativada (cancelamento feito por engano) */}
                {sit.status === 'cancelada' && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => reativar(sit)}
                      title="Desfazer o cancelamento"
                      style={{padding:"0.25rem 0.65rem",fontSize:"0.8rem",background:"rgba(16,185,129,0.15)",color:"#10b981",border:"1px solid rgba(16,185,129,0.3)",borderRadius:"var(--radius-md)",cursor:"pointer",fontWeight:"600"}}>
                      ↺ Reativar
                    </button>
                    <button type="button" onClick={() => abrirModal(sit)}
                      style={{padding:"0.25rem 0.65rem",fontSize:"0.8rem",background:"var(--color-accent-bg)",color:"var(--color-accent)",border:"1px solid var(--color-accent)",borderRadius:"var(--radius-md)",cursor:"pointer",fontWeight:"600"}}>
                      Editar
                    </button>
                  </div>
                )}
                {sit.status !== 'cancelada' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => abrirModal(sit)}
                      style={{padding:"0.25rem 0.65rem",fontSize:"0.8rem",background:"var(--color-accent-bg)",color:"var(--color-accent)",border:"1px solid var(--color-accent)",borderRadius:"var(--radius-md)",cursor:"pointer",fontWeight:"600"}}
                    >
                      Editar
                    </button>
                    {sit.status === 'ativa' && getStatusTexto(sit) === 'ATIVA' && (
                      <button
                        type="button"
                        title={sit.data_fim ? 'Encerrar antes do fim previsto' : 'Encerrar hoje'}
                        onClick={() => encerrar(sit)}
                        style={{padding:"0.25rem 0.65rem",fontSize:"0.8rem",background:"rgba(245,158,11,0.15)",color:"#f59e0b",border:"1px solid rgba(245,158,11,0.3)",borderRadius:"var(--radius-md)",cursor:"pointer",fontWeight:"600"}}
                      >
                        {sit.data_fim ? 'Encerrar antecipado' : 'Encerrar'}
                      </button>
                    )}
                    {sit.status === 'ativa' && (
                      <button
                        type="button"
                        title="Cancelar = lançada por engano: a situação é desconsiderada como se não tivesse existido"
                        onClick={() => cancelar(sit.id)}
                        style={{padding:"0.25rem 0.65rem",fontSize:"0.8rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"var(--radius-md)",cursor:"pointer",fontWeight:"600"}}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <div style={{background:"var(--color-accent)",padding:"1rem 1.5rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <h3 style={{fontSize:"1.1rem",fontWeight:"700",color:"#fff",margin:0}}>
                {editando ? 'Editar Situação' : 'Nova Situação'}
              </h3>
              <button onClick={fecharModal} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",borderRadius:"50%",width:"2rem",height:"2rem",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Tipo de Situação *
                </label>
                <select
                  value={form.tipo_situacao}
                  onChange={(e) => setForm({ ...form, tipo_situacao: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                >
                  <option value="licenca">Licença</option>
                  <option value="desligado">Quite Placet (Transferência)</option>
                  <option value="ex_oficio">Ex-Ofício</option>
                  <option value="suspenso">Suspenso</option>
                  <option value="irregular">Irregular</option>
                </select>
              </div>

              {/* Datas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                    Data de Início *
                  </label>
                  <input
                    type="date"
                    value={form.data_inicio}
                    onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                    Data de Fim
                    <span className="text-xs ml-2">(vazio = indefinido)</span>
                  </label>
                  <input
                    type="date"
                    value={form.data_fim}
                    onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                  />
                </div>
              </div>

              {/* Motivo */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Motivo
                </label>
                <textarea
                  value={form.motivo}
                  onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded focus:outline-none" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                  placeholder="Ex: Problemas de saúde, viagem, questões pessoais..."
                />
              </div>

              {/* Destino (apenas para desligados) */}
              {form.tipo_situacao === 'desligado' && (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                    Destino da Transferência
                  </label>
                  <input
                    type="text"
                    value={form.destino_transferencia}
                    onChange={(e) => setForm({ ...form, destino_transferencia: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    placeholder="Ex: ARLS Estrela do Sul nº 45"
                  />
                </div>
              )}

              {/* Documento */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Documento de Referência
                </label>
                <input
                  type="text"
                  value={form.documento}
                  onChange={(e) => setForm({ ...form, documento: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                  placeholder="Ex: Ata nº 123/2025, Ofício 45/2025"
                />
              </div>

              {/* Observações */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Observações
                </label>
                <textarea
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded focus:outline-none" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                />
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={salvar}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-600 transition-colors"
                >
                  {editando ? 'Atualizar' : 'Salvar'}
                </button>
                <button
                  type="button"
                  onClick={fecharModal}
                  style={{padding:"0.5rem 1rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"600"}}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
