import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';

// ── Helpers de data (sempre pela data LOCAL, nunca toISOString/UTC) ───────────
const pad = (n) => String(n).padStart(2, '0');
const hojeLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const diasEntre = (a, b) => {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
};
const fmtData = (d) => (d ? d.split('-').reverse().join('/') : '—');
const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

const TIPOS = {
  licenca: 'Licença',
  desligado: 'Quite Placet',
  ex_oficio: 'Ex-Ofício',
  suspenso: 'Suspenso',
  irregular: 'Irregular',
};

const DIAS_AVISO = 10; // mesma janela do e-mail automático

// Grupos de classificação
const GRUPOS = {
  vencida:   { label: 'Vencidas',            sub: 'aguardando encerramento', cor: '#ef4444', ordem: 0 },
  vencendo:  { label: `Vencem em ${DIAS_AVISO} dias`,  sub: 'ou menos',      cor: '#f59e0b', ordem: 1 },
  vigente:   { label: 'Vigentes',            sub: 'com prazo > 10 dias',     cor: '#10b981', ordem: 2 },
  futura:    { label: 'Agendadas',           sub: 'ainda não iniciaram',     cor: '#3b82f6', ordem: 3 },
  sem_prazo: { label: 'Em vigor',            sub: 'sem data final',          cor: '#64748b', ordem: 4 },
  encerrada: { label: 'Encerradas',          sub: '',                        cor: '#94a3b8', ordem: 5 },
  cancelada: { label: 'Canceladas',          sub: '',                        cor: '#94a3b8', ordem: 6 },
};
// Abas: com data final (controle de vencimento) x prazo indefinido (Quite Placet, Irregular...)
const ABAS = {
  prazo:      { label: 'Com data final',   grupos: ['vencida', 'vencendo', 'vigente', 'futura'] },
  indefinido: { label: 'Prazo indefinido', grupos: ['sem_prazo', 'futura'] },
};

const classificar = (sit, hoje) => {
  if (sit.status === 'cancelada') return { grupo: 'cancelada', dias: null };
  if (sit.status === 'vencida') return { grupo: 'encerrada', dias: null };
  if (sit.data_inicio > hoje) return { grupo: 'futura', dias: diasEntre(hoje, sit.data_inicio) };
  if (!sit.data_fim) return { grupo: 'sem_prazo', dias: null };
  const dias = diasEntre(hoje, sit.data_fim);
  if (dias < 0) return { grupo: 'vencida', dias };
  if (dias <= DIAS_AVISO) return { grupo: 'vencendo', dias };
  return { grupo: 'vigente', dias };
};

const textoPrazo = (grupo, dias) => {
  if (grupo === 'vencida') return `venceu há ${plural(-dias, 'dia', 'dias')}`;
  if (grupo === 'vencendo') return dias === 0 ? 'vence hoje' : dias === 1 ? 'vence amanhã' : `vence em ${dias} dias`;
  if (grupo === 'vigente') return `faltam ${dias} dias`;
  if (grupo === 'futura') return `inicia em ${plural(dias, 'dia', 'dias')}`;
  if (grupo === 'sem_prazo') return 'sem data final';
  return '';
};

const corDoPrazo = (grupo, dias) => {
  if (grupo === 'vencendo') return dias <= 3 ? '#ef4444' : '#f59e0b';
  return GRUPOS[grupo]?.cor || 'var(--color-text-muted)';
};

// Paginação em blocos de 1000 (limite de linhas do Supabase)
const paginar = async (montar) => {
  let todos = [];
  let de = 0;
  while (true) {
    const { data, error } = await montar().range(de, de + 999);
    if (error) throw error;
    todos = todos.concat(data || []);
    if (!data || data.length < 1000) break;
    de += 1000;
  }
  return todos;
};

export default function LicencasSituacoes({ podeEditar = false, showSuccess, showError }) {
  const [situacoes, setSituacoes] = useState([]);
  const [irmaos, setIrmaos] = useState({}); // { id → irmão }
  const [loading, setLoading] = useState(true);
  const [erroCarga, setErroCarga] = useState('');

  const [aba, setAba] = useState('prazo'); // 'prazo' | 'indefinido'
  const [grupoSel, setGrupoSel] = useState('andamento'); // 'andamento' | grupo
  const [tipoSel, setTipoSel] = useState('todos');
  const [busca, setBusca] = useState('');

  const [modalPrazo, setModalPrazo] = useState(null); // { sit, novaData }
  const [salvando, setSalvando] = useState(false);

  const hoje = hojeLocal();

  const avisoOk = (m) => (showSuccess ? showSuccess(m) : window.alert(m));
  const avisoErro = (m) => (showError ? showError(m) : window.alert(m));

  const carregar = async () => {
    try {
      setLoading(true);
      setErroCarga('');
      const [sits, irms] = await Promise.all([
        paginar(() => supabase.from('historico_situacoes').select('*').order('id', { ascending: true })),
        paginar(() => supabase.from('irmaos').select('id, nome, situacao, data_falecimento').order('id', { ascending: true })),
      ]);
      const mapa = {};
      irms.forEach((i) => { mapa[i.id] = i; });
      setIrmaos(mapa);
      setSituacoes(sits);
    } catch (e) {
      console.error('Erro ao carregar licenças/situações:', e);
      setErroCarga('Não foi possível carregar os dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  // Registros enriquecidos (sem falecidos)
  const registros = useMemo(() => {
    return situacoes
      .map((s) => {
        const irmao = irmaos[s.membro_id];
        return { ...s, irmao, ...classificar(s, hoje) };
      })
      .filter((r) => {
        if (!r.irmao) return false;
        const sit = String(r.irmao.situacao || '').toLowerCase();
        return !(sit.includes('falec') || r.irmao.data_falecimento);
      });
  }, [situacoes, irmaos, hoje]);

  // Aba: com data final x prazo indefinido (sem data final)
  const registrosAba = useMemo(
    () => registros.filter((r) => (aba === 'prazo' ? !!r.data_fim : !r.data_fim)),
    [registros, aba]
  );

  // Quantidade em andamento de cada aba (selo nas abas)
  const qtdAbas = useMemo(() => {
    const q = { prazo: 0, indefinido: 0 };
    registros.forEach((r) => {
      const k = r.data_fim ? 'prazo' : 'indefinido';
      if (ABAS[k].grupos.includes(r.grupo)) q[k] += 1;
    });
    return q;
  }, [registros]);

  const trocarAba = (k) => { setAba(k); setGrupoSel('andamento'); };

  // Filtros de tipo e busca (valem para os cartões e para a lista)
  const baseFiltrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return registrosAba.filter((r) => {
      if (tipoSel !== 'todos' && r.tipo_situacao !== tipoSel) return false;
      if (q && !String(r.irmao.nome || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [registrosAba, tipoSel, busca]);

  const contagem = useMemo(() => {
    const c = {};
    Object.keys(GRUPOS).forEach((g) => { c[g] = 0; });
    baseFiltrada.forEach((r) => { c[r.grupo] += 1; });
    return c;
  }, [baseFiltrada]);

  const lista = useMemo(() => {
    const visiveis = baseFiltrada.filter((r) =>
      grupoSel === 'andamento' ? ABAS[aba].grupos.includes(r.grupo) : r.grupo === grupoSel
    );
    return visiveis.sort((a, b) => {
      if (grupoSel === 'encerrada' || grupoSel === 'cancelada') {
        return String(b.data_fim || b.data_inicio).localeCompare(String(a.data_fim || a.data_inicio));
      }
      const oa = GRUPOS[a.grupo].ordem;
      const ob = GRUPOS[b.grupo].ordem;
      if (oa !== ob) return oa - ob;
      const fa = a.data_fim || a.data_inicio || '';
      const fb = b.data_fim || b.data_inicio || '';
      if (fa !== fb) return fa.localeCompare(fb);
      return String(a.irmao.nome).localeCompare(String(b.irmao.nome));
    });
  }, [baseFiltrada, grupoSel, aba]);

  // ── Ações ───────────────────────────────────────────────────────────────────
  // Sem licença em vigor → cadastro do irmão volta a "Regular" (só se estava como licenciado)
  const atualizarSituacaoCadastro = async (membroId, listaDoIrmao) => {
    const emVigor = listaDoIrmao.some((x) =>
      x.status === 'ativa'
      && String(x.tipo_situacao || '').toLowerCase().includes('licen')
      && x.data_inicio <= hoje && (!x.data_fim || x.data_fim >= hoje));
    if (emVigor) return;
    const { data: ir } = await supabase.from('irmaos').select('situacao').eq('id', membroId).maybeSingle();
    if (ir && String(ir.situacao || '').toLowerCase().includes('licen')) {
      await supabase.from('irmaos').update({ situacao: 'Regular' }).eq('id', membroId).select();
    }
  };

  const encerrar = async (r) => {
    const antecipado = r.data_fim && r.data_fim > hoje;
    const msg = r.grupo === 'vencida'
      ? `Encerrar a situação de ${r.irmao.nome}?\nO período (até ${fmtData(r.data_fim)}) continua registrado.`
      : antecipado
        ? `Encerrar a situação de ${r.irmao.nome} ANTECIPADAMENTE hoje (${fmtData(hoje)})?\nO fim previsto era ${fmtData(r.data_fim)}.`
        : `Encerrar a situação de ${r.irmao.nome} hoje (${fmtData(hoje)})?`;
    if (!window.confirm(msg)) return;

    try {
      const dados = r.grupo === 'vencida'
        ? { status: 'vencida' }
        : {
            status: 'vencida',
            data_fim: hoje,
            observacoes: antecipado
              ? `${r.observacoes ? r.observacoes + ' · ' : ''}Encerrada antecipadamente em ${fmtData(hoje)} (fim previsto ${fmtData(r.data_fim)})`
              : r.observacoes,
          };
      const { data, error } = await supabase.from('historico_situacoes').update(dados).eq('id', r.id).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Sem permissão para atualizar (RLS).');

      const doIrmao = situacoes
        .filter((x) => x.membro_id === r.membro_id)
        .map((x) => (x.id === r.id ? { ...x, ...dados } : x));
      await atualizarSituacaoCadastro(r.membro_id, doIrmao);

      avisoOk('Situação encerrada!');
      carregar();
    } catch (e) {
      console.error('Erro ao encerrar:', e);
      avisoErro('Erro ao encerrar situação: ' + (e.message || e));
    }
  };

  const salvarPrazo = async () => {
    if (!modalPrazo) return;
    const { sit, novaData } = modalPrazo;
    if (!novaData) { avisoErro('Informe a nova data final.'); return; }
    if (novaData < sit.data_inicio) { avisoErro('A data final não pode ser anterior ao início.'); return; }
    try {
      setSalvando(true);
      const { data, error } = await supabase
        .from('historico_situacoes')
        .update({ data_fim: novaData, status: 'ativa' })
        .eq('id', sit.id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Sem permissão para atualizar (RLS).');
      avisoOk('Prazo atualizado!');
      setModalPrazo(null);
      carregar();
    } catch (e) {
      console.error('Erro ao alterar prazo:', e);
      avisoErro('Erro ao alterar prazo: ' + (e.message || e));
    } finally {
      setSalvando(false);
    }
  };

  // ── Estilos ─────────────────────────────────────────────────────────────────
  const sCard = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1rem' };
  const sInput = { padding: '0.5rem 0.75rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' };
  const sBtn = (cor, bg, borda) => ({ padding: '0.25rem 0.65rem', fontSize: '0.8rem', background: bg, color: cor, border: `1px solid ${borda}`, borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: '600' });

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text)', margin: 0 }}>🗓️ Licenças e Situações</h2>
        <p style={{ color: 'var(--color-text-muted)', marginTop: '0.25rem', fontSize: '0.875rem' }}>
          Licenças e situações com data final, e situações de prazo indefinido (Quite Placet, Irregular)
        </p>
      </div>

      {erroCarga && (
        <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
          {erroCarga} <button type="button" onClick={carregar} style={{ marginLeft: '0.5rem', textDecoration: 'underline', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>Tentar novamente</button>
        </div>
      )}

      {/* Abas */}
      <div role="tablist" style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
        {Object.entries(ABAS).map(([k, a]) => (
          <button
            key={k} type="button" role="tab" aria-selected={aba === k}
            onClick={() => trocarAba(k)}
            style={{
              padding: '0.6rem 1.25rem', fontWeight: '600', fontSize: '0.875rem', border: 'none', cursor: 'pointer',
              background: 'transparent', borderRadius: 0, marginBottom: '-1px',
              borderBottom: aba === k ? '3px solid var(--color-accent)' : '3px solid transparent',
              color: aba === k ? 'var(--color-accent)' : 'var(--color-text-muted)',
            }}
          >
            {a.label}
            <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', fontWeight: '700', padding: '0.1rem 0.5rem', borderRadius: '999px', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>
              {qtdAbas[k]}
            </span>
          </button>
        ))}
      </div>

      {/* Cartões-resumo (clicáveis = filtro) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
        {ABAS[aba].grupos.map((g) => {
          const info = GRUPOS[g];
          const ativo = grupoSel === g;
          return (
            <button
              key={g}
              type="button"
              aria-pressed={ativo}
              onClick={() => setGrupoSel(ativo ? 'andamento' : g)}
              style={{
                textAlign: 'left', cursor: 'pointer', padding: '0.85rem 1rem',
                background: ativo ? 'var(--color-accent-bg)' : 'var(--color-surface)',
                border: `1px solid ${ativo ? 'var(--color-accent)' : 'var(--color-border)'}`,
                borderLeft: `4px solid ${info.cor}`,
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: contagem[g] > 0 && (g === 'vencida' || g === 'vencendo') ? info.cor : 'var(--color-text)', lineHeight: 1.1 }}>{contagem[g]}</div>
              <div style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--color-text)', marginTop: '0.25rem' }}>{info.label}</div>
              {info.sub && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{info.sub}</div>}
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <input
          type="text" placeholder="🔍 Buscar irmão..." value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ ...sInput, flex: '1 1 200px', minWidth: 0 }}
        />
        <select value={tipoSel} onChange={(e) => setTipoSel(e.target.value)} style={sInput} aria-label="Tipo de situação">
          <option value="todos">Todos os tipos</option>
          {Object.entries(TIPOS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {[
            { id: 'andamento', label: 'Em andamento' },
            { id: 'encerrada', label: `Encerradas (${contagem.encerrada})` },
            { id: 'cancelada', label: `Canceladas (${contagem.cancelada})` },
          ].filter((b) => !(aba === 'indefinido' && b.id === 'encerrada')).map((b) => (
            <button
              key={b.id} type="button" aria-pressed={grupoSel === b.id}
              onClick={() => setGrupoSel(b.id)}
              style={{
                padding: '0.4rem 0.75rem', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer',
                borderRadius: 'var(--radius-md)',
                background: grupoSel === b.id ? 'var(--color-accent)' : 'var(--color-surface-2)',
                color: grupoSel === b.id ? '#fff' : 'var(--color-text)',
                border: `1px solid ${grupoSel === b.id ? 'var(--color-accent)' : 'var(--color-border)'}`,
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ ...sCard, background: 'var(--color-accent-bg)', borderColor: 'var(--color-accent)', padding: '0.65rem 1rem' }}>
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text)' }}>
          {aba === 'prazo' ? (
            <>✉️ Situações com data final geram aviso automático por e-mail a <strong>10 dias</strong>, <strong>3 dias</strong> e <strong>no dia</strong> do vencimento, para Venerável, Secretário, Orador e Administrador. Vencida e não encerrada gera lembrete semanal.</>
          ) : (
            <>ℹ️ Situações sem data final (Quite Placet, Irregular...) ficam apenas para consulta e não geram aviso por e-mail.</>
          )}
        </p>
      </div>

      {/* Lista */}
      {lista.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Nenhum registro para os filtros selecionados.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {lista.map((r) => {
            const info = GRUPOS[r.grupo];
            const corPrazo = corDoPrazo(r.grupo, r.dias);
            const cadastroLicenciado = String(r.irmao.situacao || '').toLowerCase().includes('licen');
            const podeAgir = podeEditar && ['vencida', 'vencendo', 'vigente'].includes(r.grupo);
            return (
              <div
                key={r.id}
                style={{
                  ...sCard,
                  borderLeft: `4px solid ${info.cor}`,
                  opacity: r.grupo === 'cancelada' ? 0.65 : 1,
                  display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'flex-start',
                }}
              >
                <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--color-text)' }}>{r.irmao.nome}</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: '700', padding: '0.15rem 0.55rem', borderRadius: '999px', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>
                      {TIPOS[r.tipo_situacao] || r.tipo_situacao}
                    </span>
                    {textoPrazo(r.grupo, r.dias) && (
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: corPrazo }}>● {textoPrazo(r.grupo, r.dias)}</span>
                    )}
                    {r.grupo === 'encerrada' && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>encerrada</span>}
                    {r.grupo === 'cancelada' && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>cancelada</span>}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--color-text)', lineHeight: 1.6 }}>
                    <div><strong>Período:</strong> {fmtData(r.data_inicio)}{r.data_fim ? ` → ${fmtData(r.data_fim)}` : ' → sem data final'}</div>
                    {r.motivo && <div><strong>Motivo:</strong> {r.motivo}</div>}
                    {r.destino_transferencia && <div><strong>Destino:</strong> {r.destino_transferencia}</div>}
                    {r.documento && <div><strong>Documento:</strong> {r.documento}</div>}
                    {r.grupo === 'vencida' && cadastroLicenciado && (
                      <div style={{ color: '#ef4444', fontWeight: '600' }}>⚠️ O cadastro do irmão ainda consta como Licenciado — encerre para regularizar.</div>
                    )}
                  </div>
                </div>

                {podeAgir && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => setModalPrazo({ sit: r, novaData: r.data_fim || '' })}
                      style={sBtn('var(--color-accent)', 'var(--color-accent-bg)', 'var(--color-accent)')}>
                      Alterar prazo
                    </button>
                    <button type="button" onClick={() => encerrar(r)}
                      style={sBtn('#f59e0b', 'rgba(245,158,11,0.15)', 'rgba(245,158,11,0.3)')}>
                      Encerrar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: alterar prazo */}
      {modalPrazo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
          <div className="rounded-lg w-full max-w-md" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div style={{ background: 'var(--color-accent)', padding: '1rem 1.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#fff', margin: 0 }}>Alterar prazo</h3>
            </div>
            <div className="p-6" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                <strong>{modalPrazo.sit.irmao.nome}</strong> — {TIPOS[modalPrazo.sit.tipo_situacao] || modalPrazo.sit.tipo_situacao}<br />
                <span style={{ color: 'var(--color-text-muted)' }}>Início {fmtData(modalPrazo.sit.data_inicio)} · fim atual {fmtData(modalPrazo.sit.data_fim)}</span>
              </p>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>
                Nova data final
                <input
                  type="date" min={modalPrazo.sit.data_inicio} value={modalPrazo.novaData}
                  onChange={(e) => setModalPrazo({ ...modalPrazo, novaData: e.target.value })}
                  style={{ ...sInput, display: 'block', width: '100%', marginTop: '0.25rem' }}
                />
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setModalPrazo(null)} disabled={salvando}
                  style={{ ...sBtn('var(--color-text)', 'var(--color-surface-2)', 'var(--color-border)'), padding: '0.5rem 1rem' }}>
                  Cancelar
                </button>
                <button type="button" onClick={salvarPrazo} disabled={salvando}
                  style={{ ...sBtn('#fff', 'var(--color-accent)', 'var(--color-accent)'), padding: '0.5rem 1rem' }}>
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
