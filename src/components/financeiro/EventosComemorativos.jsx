/**
 * EVENTOS COMEMORATIVOS
 * A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 *
 * Controle financeiro de eventos (Dia das Mães, Dia dos Pais, etc.)
 * com rateio entre participantes.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { calcularRateio, custeioAtivo, descricaoComCusteio, cotasConvidados, semCobranca, resumirEvento } from './utils/rateioCusteio';

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
const fmtR = (v) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtD = (d) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

const hojeISO = () => new Date().toISOString().split('T')[0];

// ─────────────────────────────────────────────
//  Estilos base
// ─────────────────────────────────────────────
const inp = {
  width: '100%', padding: '0.55rem 0.85rem', fontSize: '0.875rem',
  background: 'var(--color-bg)', border: '1px solid var(--color-border-light)',
  borderRadius: 'var(--radius-md)', color: 'var(--color-text)', outline: 'none',
  boxSizing: 'border-box',
};
const lbl = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600,
  color: 'var(--color-text-muted)', marginBottom: '0.3rem',
  textTransform: 'uppercase', letterSpacing: '0.04em',
};
const card = {
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)', padding: '1.1rem',
};
const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  zIndex: 1000, padding: '1rem', overflowY: 'auto',
};
const modalBox = (w = '540px') => ({
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: w, marginTop: '0.5rem',
});
const mHead = {
  background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)',
  padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between',
  alignItems: 'center', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
};
const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
  padding: '0.55rem 1.1rem', borderRadius: 'var(--radius-md)',
  background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.35)',
  color: '#c9a84c', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
};
const btnDanger = {
  padding: '0.3rem 0.55rem', borderRadius: 'var(--radius-sm)',
  background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
  color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
};
const btnEdit = {
  padding: '0.3rem 0.55rem', borderRadius: 'var(--radius-sm)',
  background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
  color: 'var(--color-accent)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
};

// ─────────────────────────────────────────────
//  Modal Novo/Editar Evento
// ─────────────────────────────────────────────
const EVENTO_VAZIO = {
  nome: '', ano: new Date().getFullYear(), data_evento: '',
  descricao: '', idade_gratuita: 5, idade_meia: 11, valor_ajustado: '', contribuicao_loja: '', custeio_percentual_irmao: '',
};

// Grade de quadros de dados: 4→4, 5→5, 6→3x3, 7→5+2, 8→4x4 (recolhe conforme a largura disponível)
const colunasGrade = (n) => ({ 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 3, 7: 5, 8: 4, 9: 3, 10: 5 }[n] || 4);
const CSS_GRADE = `
  .agp-gw{container-type:inline-size}
  .agp-grade{--cols:var(--n,3);display:flex;flex-wrap:wrap;justify-content:center;gap:.6rem}
  .agp-grade>*{flex:0 0 calc((100% - (var(--cols) - 1) * .6rem) / var(--cols));min-width:0;box-sizing:border-box}
  @container (max-width:680px){.agp-grade{--cols:3}}
  @container (max-width:440px){.agp-grade{--cols:2}}
`;
const GradeIndicadores = ({ n, style, children }) => (
  <div className="agp-gw" style={style}>
    <div className="agp-grade" style={{ '--n': colunasGrade(n) }}>{children}</div>
  </div>
);

const ModalEvento = ({ aberto, onFechar, onSalvar, eventoEdit }) => {
  const [form, setForm] = useState(EVENTO_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (aberto) {
      setForm(eventoEdit ? {
        nome: eventoEdit.nome,
        ano: eventoEdit.ano,
        data_evento: eventoEdit.data_evento || '',
        descricao: eventoEdit.descricao || '',
        idade_gratuita: eventoEdit.idade_gratuita ?? 5,
        idade_meia: eventoEdit.idade_meia ?? 11,
        valor_ajustado: eventoEdit.valor_ajustado || '',
        contribuicao_loja: eventoEdit.contribuicao_loja || '',
        custeio_percentual_irmao: eventoEdit.custeio_percentual_irmao || '',
      } : EVENTO_VAZIO);
      setErro('');
    }
  }, [aberto, eventoEdit]);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSalvar = async () => {
    if (!form.nome.trim()) { setErro('Informe o nome do evento.'); return; }
    if (!form.ano) { setErro('Informe o ano.'); return; }
    const cp = (form.custeio_percentual_irmao === '' || form.custeio_percentual_irmao == null) ? null : parseFloat(form.custeio_percentual_irmao);
    if (cp !== null && (isNaN(cp) || cp <= 0 || cp >= 100)) { setErro('O % do custeio deve ficar entre 0,01 e 99,99 (ou em branco para ratear normalmente).'); return; }
    setSalvando(true); setErro('');
    try { await onSalvar(form); }
    catch (e) { setErro(e.message); }
    finally { setSalvando(false); }
  };

  if (!aberto) return null;
  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={modalBox('560px')}>
        <div style={mHead}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
            {eventoEdit ? '✏️ Editar Evento' : '🎉 Novo Evento Comemorativo'}
          </h3>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.4rem', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '0.75rem' }}>
            <div>
              <label style={lbl}>Nome do Evento *</label>
              <input style={inp} value={form.nome} onChange={e => f('nome', e.target.value)} placeholder="Ex: Sessão Dia das Mães" autoFocus />
            </div>
            <div>
              <label style={lbl}>Ano *</label>
              <input style={inp} type="number" min="2000" max="2100" value={form.ano} onChange={e => f('ano', parseInt(e.target.value))} />
            </div>
          </div>

          <div>
            <label style={lbl}>Data do Evento</label>
            <input style={{ ...inp, colorScheme: 'dark' }} type="date" value={form.data_evento} onChange={e => f('data_evento', e.target.value)} />
          </div>

          <div>
            <label style={lbl}>Descrição</label>
            <textarea style={{ ...inp, resize: 'vertical' }} rows={2} value={form.descricao} onChange={e => f('descricao', e.target.value)} placeholder="Observações sobre o evento..." />
          </div>

          {/* Faixas etárias */}
          <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.85rem' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.65rem' }}>
              🎂 Faixas Etárias para Rateio
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={lbl}>Gratuidade — até idade</label>
                <input style={inp} type="number" min="0" max="17" value={form.idade_gratuita} onChange={e => f('idade_gratuita', parseInt(e.target.value))} />
                <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>Crianças até esta idade = 0 cotas</p>
              </div>
              <div>
                <label style={lbl}>Meia-cota — até idade</label>
                <input style={inp} type="number" min="0" max="17" value={form.idade_meia} onChange={e => f('idade_meia', parseInt(e.target.value))} />
                <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>Crianças até esta idade = 0,5 cotas</p>
              </div>
            </div>
          </div>

          {/* Contribuição da Loja */}
          <div>
            <label style={lbl}>Contribuição da Loja (R$)</label>
            <input style={inp} type="number" step="0.01" min="0" value={form.contribuicao_loja} onChange={e => f('contribuicao_loja', e.target.value)} placeholder="Ex: 500.00 — será abatido das despesas antes do rateio" />
            <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>Valor que a loja paga — reduz a base do rateio entre os irmãos</p>
          </div>

          {/* Valor ajustado */}
          <div>
            <label style={lbl}>Valor por Cota Ajustado (R$)</label>
            <input style={inp} type="number" step="0.01" min="0" value={form.valor_ajustado} onChange={e => f('valor_ajustado', e.target.value)} placeholder="Calculado automaticamente — ajuste aqui se necessário" />
            <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>Deixe em branco para usar o valor calculado pelas despesas</p>
          </div>

          {/* Custeio */}
          <div>
            <label style={lbl}>Custeio — % que cada irmão paga da própria família</label>
            <input style={inp} type="number" step="0.01" min="0" max="99.99" value={form.custeio_percentual_irmao} onChange={e => f('custeio_percentual_irmao', e.target.value)} placeholder="Ex.: 50 — em branco = sem custeio" />
            <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>O restante é pago pelos custeadores (marcados nos participantes), divididos igualmente. Visitantes seguem como hoje (Loja).</p>
          </div>

          {erro && <div style={{ padding: '0.6rem 0.85rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: '#ef4444' }}>{erro}</div>}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
            <button onClick={onFechar} style={{ padding: '0.6rem 1.1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={handleSalvar} disabled={salvando} style={{ ...btnPrimary, opacity: salvando ? 0.7 : 1 }}>
              {salvando ? 'Salvando...' : eventoEdit ? '💾 Salvar' : '🎉 Criar Evento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
//  Modal Participante
// ─────────────────────────────────────────────
const PART_VAZIO = {
  tipo: 'irmao', // 'irmao' | 'externo'
  irmao_id: '',
  nome_externo: '',
  adultos_convidados: 0,
  criancas_meia: 0,
  criancas_gratuitas: 0,
  custeador: false,
  percentual_proprio: '',
  isento: false,
  isento_loja: false,
  conv_adultos: 0,
  conv_meia: 0,
  conv_gratuitas: 0,
};

// Estilo dos campos do modal (foco, setas do select, números sem spinner)
const CSS_CAMPOS = `
  .agp-field:focus{border-color:var(--color-accent) !important;box-shadow:0 0 0 3px var(--color-accent-bg);outline:none}
  .agp-field::placeholder{color:var(--color-text-muted);opacity:.8}
  .agp-num::-webkit-outer-spin-button,.agp-num::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
  .agp-num{-moz-appearance:textfield}
  .agp-select{appearance:none;-webkit-appearance:none;padding-right:2.2rem !important;background-repeat:no-repeat;background-position:right .8rem center;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")}
`;

// Contador de pessoas com − / +
const Contador = ({ label, legenda, valor, onChange, max = 99 }) => {
  const v = parseInt(valor) || 0;
  const passo = {
    width: '2.5rem', flexShrink: 0, border: '1px solid var(--color-border-light)', background: 'var(--color-surface-2)',
    color: 'var(--color-text)', fontSize: '1.15rem', fontWeight: 700, cursor: 'pointer', lineHeight: 1,
  };
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.35rem', overflowWrap: 'anywhere' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <button type="button" aria-label={`Diminuir: ${label}`} onClick={() => onChange(Math.max(0, v - 1))}
          style={{ ...passo, borderRadius: 'var(--radius-md) 0 0 var(--radius-md)' }}>−</button>
        <input className="agp-field agp-num" type="number" min="0" max={max} value={v} aria-label={label}
          onChange={e => onChange(Math.min(max, Math.max(0, parseInt(e.target.value) || 0)))}
          style={{ ...inp, minWidth: 0, borderRadius: 0, textAlign: 'center', fontWeight: 700, padding: '0.55rem 0.25rem' }} />
        <button type="button" aria-label={`Aumentar: ${label}`} onClick={() => onChange(Math.min(max, v + 1))}
          style={{ ...passo, borderRadius: '0 var(--radius-md) var(--radius-md) 0' }}>+</button>
      </div>
      {legenda && <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.3rem' }}>{legenda}</div>}
    </div>
  );
};

const SecaoModal = ({ titulo, subtitulo, cor = '#c9a84c', children }) => (
  <section style={{ border: '1px solid var(--color-border-light)', borderLeft: `3px solid ${cor}`, borderRadius: 'var(--radius-md)', padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
    <div>
      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)' }}>{titulo}</div>
      {subtitulo && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.15rem', lineHeight: 1.45 }}>{subtitulo}</div>}
    </div>
    {children}
  </section>
);

const opcaoCaixa = (ativo) => ({
  display: 'flex', alignItems: 'flex-start', gap: '0.65rem', padding: '0.7rem 0.8rem', borderRadius: 'var(--radius-md)',
  border: `1px solid ${ativo ? 'var(--color-accent)' : 'var(--color-border-light)'}`,
  background: ativo ? 'var(--color-accent-bg)' : 'var(--color-bg)',
  cursor: 'pointer', fontSize: '0.83rem', color: 'var(--color-text)', lineHeight: 1.45,
});

const ModalParticipante = ({ aberto, onFechar, onSalvar, partEdit, irmaos, evento, valorCota = 0 }) => {
  const [form, setForm] = useState(PART_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (aberto) {
      setForm(partEdit ? {
        tipo: partEdit.irmao_id ? 'irmao' : 'externo',
        irmao_id: partEdit.irmao_id || '',
        nome_externo: partEdit.nome_externo || '',
        adultos_convidados: partEdit.adultos_convidados || 0,
        criancas_meia: partEdit.criancas_meia || 0,
        criancas_gratuitas: partEdit.criancas_gratuitas || 0,
        custeador: !!partEdit.custeador,
        percentual_proprio: partEdit.percentual_proprio || '',
        isento: !!partEdit.isento,
        isento_loja: !!partEdit.isento_loja,
        conv_adultos: partEdit.conv_adultos || 0,
        conv_meia: partEdit.conv_meia || 0,
        conv_gratuitas: partEdit.conv_gratuitas || 0,
      } : PART_VAZIO);
      setErro('');
    }
  }, [aberto, partEdit]);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const ehIrmao = form.tipo === 'irmao';

  // Cotas em tempo real: grupo/família + convidados do irmão
  const cotasFamilia = 1 + (parseInt(form.adultos_convidados) || 0) + ((parseInt(form.criancas_meia) || 0) * 0.5);
  const cotasConv = ehIrmao ? cotasConvidados(form) : 0;
  const cotaCalc = cotasFamilia + cotasConv;

  // Simulação da divisão para este participante
  const custeioOn = custeioAtivo(evento) && ehIrmao;
  const simulacao = (ehIrmao && valorCota > 0)
    ? calcularRateio(
        [
          { id: 'sim', irmao_id: 1, cotas: cotaCalc, conv_adultos: form.conv_adultos, conv_meia: form.conv_meia, custeador: form.custeador, percentual_proprio: form.percentual_proprio, isento: form.isento, isento_loja: form.isento_loja },
          ...((form.custeador || !custeioOn) ? [] : [{ id: 'dummy', irmao_id: 2, cotas: 0, custeador: true }]),
        ],
        valorCota, evento
      ).porParticipante.sim
    : null;

  const handleSalvar = async () => {
    if (ehIrmao && !form.irmao_id) { setErro('Selecione um irmão.'); return; }
    if (form.tipo === 'externo' && !form.nome_externo.trim()) { setErro('Informe o nome do convidado externo.'); return; }
    if (form.percentual_proprio !== '' && (isNaN(parseFloat(form.percentual_proprio)) || parseFloat(form.percentual_proprio) < 0 || parseFloat(form.percentual_proprio) > 100)) { setErro('O % a pagar deve ficar entre 0 e 100.'); return; }
    setSalvando(true); setErro('');
    try { await onSalvar({ ...form, cotas: cotaCalc }); }
    catch (e) { setErro(e.message); }
    finally { setSalvando(false); }
  };

  if (!aberto) return null;

  const idadeGrat = evento?.idade_gratuita ?? 5;
  const idadeMeia = evento?.idade_meia ?? 11;
  const rotAdultos = 'Adultos';
  const rotMeia = `Crianças ${idadeGrat + 1}–${idadeMeia} anos`;
  const rotGrat = `Crianças até ${idadeGrat} anos`;
  const irmaosDisponiveis = irmaos.filter(i =>
    ['regular', 'licenciado'].includes(String(i.situacao || 'regular').toLowerCase()) || String(i.id) === String(form.irmao_id));

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onFechar()}>
      <style>{CSS_CAMPOS}</style>
      <div style={{ ...modalBox('640px'), display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 2rem)' }}>
        <div style={mHead}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
            {partEdit ? '✏️ Editar Participante' : '👤 Adicionar Participante'}
          </h3>
          <button onClick={onFechar} aria-label="Fechar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.4rem', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', flex: 1, minHeight: 0 }}>

          {/* Tipo */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[['irmao', '👤 Irmão da Loja'], ['externo', '🌍 Convidado Externo']].map(([v, l]) => (
              <button key={v} type="button" onClick={() => f('tipo', v)} style={{
                flex: 1, padding: '0.65rem 0.5rem', borderRadius: 'var(--radius-md)',
                border: `1px solid ${form.tipo === v ? 'rgba(201,168,76,0.6)' : 'var(--color-border-light)'}`,
                background: form.tipo === v ? 'rgba(201,168,76,0.14)' : 'var(--color-bg)',
                color: form.tipo === v ? '#c9a84c' : 'var(--color-text-muted)',
                fontWeight: form.tipo === v ? 700 : 500, cursor: 'pointer', fontSize: '0.85rem',
              }}>{l}</button>
            ))}
          </div>

          {/* Participante */}
          <SecaoModal titulo={ehIrmao ? 'Irmão' : 'Convidado externo'} cor="#6366f1">
            {ehIrmao ? (
              <div>
                <label style={lbl}>Irmão *</label>
                <select className="agp-field agp-select" style={{ ...inp, height: '2.6rem' }} value={form.irmao_id} onChange={e => f('irmao_id', e.target.value)}>
                  <option value="">Selecione...</option>
                  {irmaosDisponiveis.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label style={lbl}>Nome do convidado externo *</label>
                <input className="agp-field" style={{ ...inp, height: '2.6rem' }} value={form.nome_externo} onChange={e => f('nome_externo', e.target.value)} placeholder="Nome completo (e Loja de origem, se visitante)" />
              </div>
            )}
          </SecaoModal>

          {/* Família / grupo */}
          <SecaoModal
            titulo={ehIrmao ? '👨‍👩‍👧 Família do irmão' : '👥 Composição do grupo'}
            subtitulo={ehIrmao
              ? `O irmão já conta como 1 adulto.${custeioOn ? ' A família segue as regras do custeio (% do irmão).' : ''}`
              : 'O convidado já conta como 1 adulto.'}
            cor="#10b981">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.85rem' }}>
              <Contador label={rotAdultos} legenda="cota cheia cada" valor={form.adultos_convidados} onChange={v => f('adultos_convidados', v)} />
              <Contador label={rotMeia} legenda="meia cota cada" valor={form.criancas_meia} onChange={v => f('criancas_meia', v)} />
              <Contador label={rotGrat} legenda="gratuito" valor={form.criancas_gratuitas} onChange={v => f('criancas_gratuitas', v)} />
            </div>
          </SecaoModal>

          {/* Convidados do irmão (fora da família) */}
          {ehIrmao && (
            <SecaoModal
              titulo="🎟️ Convidados do irmão (fora da família)"
              subtitulo="Pagos 100% pelo irmão que convidou. Não entram em desconto, isenção ou custeio, e custeadores e Loja não pagam por eles."
              cor="#f59e0b">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.85rem' }}>
                <Contador label={rotAdultos} legenda="cota cheia cada" valor={form.conv_adultos} onChange={v => f('conv_adultos', v)} />
                <Contador label={rotMeia} legenda="meia cota cada" valor={form.conv_meia} onChange={v => f('conv_meia', v)} />
                <Contador label={rotGrat} legenda="só contagem" valor={form.conv_gratuitas} onChange={v => f('conv_gratuitas', v)} />
              </div>
            </SecaoModal>
          )}

          {/* Custeio */}
          {custeioOn && (
            <SecaoModal
              titulo="🤝 Custeio da família"
              subtitulo={`O irmão paga ${evento.custeio_percentual_irmao}% da família por padrão.`}
              cor="#8b5cf6">
              <label style={opcaoCaixa(!!form.custeador)}>
                <input type="checkbox" checked={!!form.custeador} onChange={e => f('custeador', e.target.checked)} style={{ marginTop: '0.2rem', accentColor: 'var(--color-accent)' }} />
                <span><strong>Custeador</strong><br /><span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>Paga 100% da família e dos convidados e divide, com os demais custeadores, o custeio das famílias dos irmãos.</span></span>
              </label>

              {!form.custeador && (
                <>
                  <div>
                    <label style={lbl}>% a pagar da família (opcional)</label>
                    <div style={{ position: 'relative' }}>
                      <input className="agp-field agp-num" type="number" step="0.01" min="0" max="100" disabled={!!form.isento}
                        style={{ ...inp, height: '2.6rem', paddingRight: '2.2rem', opacity: form.isento ? 0.5 : 1 }}
                        value={form.percentual_proprio} onChange={e => f('percentual_proprio', e.target.value)}
                        placeholder={`${evento.custeio_percentual_irmao} (padrão)`} />
                      <span style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontWeight: 600 }}>%</span>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '0.3rem 0 0', lineHeight: 1.4 }}>
                      Vazio ou 0 usa o padrão do evento. Acima de 0, prevalece; os custeadores mantêm a fatia do evento e a diferença fica com a Loja.
                    </p>
                  </div>

                  <label style={opcaoCaixa(!!form.isento)}>
                    <input type="checkbox" checked={!!form.isento} onChange={e => f('isento', e.target.checked)} style={{ marginTop: '0.2rem', accentColor: 'var(--color-accent)' }} />
                    <span><strong>Isento</strong><br /><span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>A família não paga. Os convidados do irmão continuam sendo pagos por ele.</span></span>
                  </label>

                  {form.isento && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '0.5rem' }}>
                      <label style={opcaoCaixa(!form.isento_loja)}>
                        <input type="radio" name="tipo_isencao" checked={!form.isento_loja} onChange={() => f('isento_loja', false)} style={{ marginTop: '0.2rem', accentColor: 'var(--color-accent)' }} />
                        <span><strong>Custeadores + Loja</strong><br /><span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>Os custeadores pagam a fatia do evento e a Loja paga o restante.</span></span>
                      </label>
                      <label style={opcaoCaixa(!!form.isento_loja)}>
                        <input type="radio" name="tipo_isencao" checked={!!form.isento_loja} onChange={() => f('isento_loja', true)} style={{ marginTop: '0.2rem', accentColor: 'var(--color-accent)' }} />
                        <span><strong>Somente a Loja</strong><br /><span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>A Loja paga 100% da família; os custeadores não participam.</span></span>
                      </label>
                    </div>
                  )}
                </>
              )}
            </SecaoModal>
          )}

          {/* Resumo */}
          <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', padding: '0.9rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total de cotas</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#c9a84c', lineHeight: 1.1 }}>{cotaCalc.toFixed(1)}</div>
              </div>
              {ehIrmao && cotasConv > 0 && (
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', textAlign: 'right' }}>
                  família {cotasFamilia.toFixed(1)} + convidados {cotasConv.toFixed(1)}
                </div>
              )}
            </div>
            {simulacao ? (
              <div style={{ marginTop: '0.7rem', paddingTop: '0.7rem', borderTop: '1px solid var(--color-border)', fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.75 }}>
                <div>Família: <strong style={{ color: 'var(--color-text)' }}>{fmtR(simulacao.custoFamilia)}</strong>
                  {simulacao.custoConvidados > 0 && <> · Convidados (100%): <strong style={{ color: 'var(--color-text)' }}>{fmtR(simulacao.custoConvidados)}</strong></>}</div>
                {custeioOn && !form.custeador && (
                  <div>Família: irmão <strong style={{ color: '#10b981' }}>{fmtR(simulacao.pagaFamilia)}</strong> · custeadores <strong style={{ color: '#8b5cf6' }}>{fmtR(simulacao.parteCusteio)}</strong> · Loja <strong style={{ color: '#6366f1' }}>{fmtR(simulacao.parteLoja)}</strong></div>
                )}
                <div style={{ fontSize: '0.9rem', color: 'var(--color-text)' }}>
                  {form.custeador
                    ? <>Paga a própria família e convidados: <strong style={{ color: '#10b981' }}>{fmtR(simulacao.custo)}</strong> + a sua parte do custeio das famílias (calculada no rateio)</>
                    : <>Total a pagar pelo irmão: <strong style={{ color: '#10b981' }}>{fmtR(simulacao.total)}</strong></>}
                </div>
              </div>
            ) : (!ehIrmao && valorCota > 0) ? (
              <div style={{ marginTop: '0.7rem', paddingTop: '0.7rem', borderTop: '1px solid var(--color-border)', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                Valor do grupo (a cargo da Loja): <strong style={{ color: 'var(--color-text)' }}>{fmtR(cotaCalc * valorCota)}</strong>
              </div>
            ) : null}
          </div>

          {erro && <div style={{ padding: '0.6rem 0.85rem', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 'var(--radius-md)', color: '#ef4444', fontSize: '0.85rem' }}>{erro}</div>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', padding: '0.9rem 1.25rem', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', borderRadius: '0 0 var(--radius-xl) var(--radius-xl)' }}>
          <button type="button" onClick={onFechar} style={{ padding: '0.55rem 1.1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)', background: 'transparent', color: 'var(--color-text-muted)', fontSize: '0.875rem', cursor: 'pointer' }}>Cancelar</button>
          <button type="button" onClick={handleSalvar} disabled={salvando} style={{ ...btnPrimary, opacity: salvando ? 0.6 : 1 }}>
            {salvando ? 'Salvando...' : partEdit ? '💾 Salvar' : '👤 Adicionar'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
//  Tabela de Participantes separada por grupo
// ─────────────────────────────────────────────
// Dois primeiros nomes; se o 2º for preposição, usa o primeiro + o último nome
// (ex.: "Jose Elias da Costa" → "Jose Elias"; "Francisco de Assis Bisco" → "Francisco Bisco")
const PREPOSICOES_NOME = ['de', 'da', 'do', 'das', 'dos', 'e'];
const nomeCurto = (nome) => {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 2) return partes.join(' ');
  if (PREPOSICOES_NOME.includes(partes[1].toLowerCase())) return `${partes[0]} ${partes[partes.length - 1]}`;
  return `${partes[0]} ${partes[1]}`;
};

const TabelaParticipantes = ({ participantes, valorCota, encerrado, setPartEdit, setModalPart, setConfirmExcluirPart, totalCotas, btnEdit, btnDanger, podeEditar = false, rateio = null }) => {
  const comCusteio = !!rateio?.ativo;
  const nColsIrm = comCusteio ? 11 : 9;
  const nColsExt = 7;
  const itemDe = (p) => rateio?.porParticipante?.[p.id];
  const aPagar = (p) => (itemDe(p) ? itemDe(p).total : parseFloat(p.cotas) * valorCota);
  const nomeParticipante = (p) => (p.irmao_id ? (p.irmaos?.nome || '') : (p.nome_externo || ''));
  const porNome = (a, b) => nomeParticipante(a).localeCompare(nomeParticipante(b), 'pt-BR', { sensitivity: 'base' });

  const ehCusteador = (p) => comCusteio && !!p.custeador;
  const irmaos_part   = participantes.filter(p => p.irmao_id).sort((a, b) => (Number(ehCusteador(b)) - Number(ehCusteador(a))) || porNome(a, b));
  const externos_part = participantes.filter(p => !p.irmao_id).sort(porNome);

  const thS = (center) => ({
    padding: '0.5rem 0.65rem',
    textAlign: center ? 'center' : 'left',
    fontSize: '0.7rem', fontWeight: 700,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase', whiteSpace: 'nowrap',
  });

  const Cabecalho = ({ externo = false }) => externo ? (
    <thead>
      <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
        <th style={{ ...thS(false), width: '42%' }}>Participante</th>
        <th style={thS(true)}>Adultos<br/>(ele+acomp.)</th>
        <th style={thS(true)}>C.Meia</th>
        <th style={thS(true)}>C.Grat.</th>
        <th style={thS(true)}>Cotas</th>
        <th style={thS(true)}>Valor total</th>
        <th style={thS(true)}></th>
      </tr>
    </thead>
  ) : (
    <thead>
      <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
        <th style={thS(false)}>Participante</th>
        <th style={thS(true)}></th>
        <th style={thS(true)}>Adultos<br/>(ele+acomp.)</th>
        <th style={thS(true)}>C.Meia</th>
        <th style={thS(true)}>C.Grat.</th>
        <th style={thS(true)}>Cotas</th>
        {comCusteio && <th style={thS(true)}>Custo</th>}
        {comCusteio && <th style={thS(true)}>% Próprio</th>}
        <th style={thS(true)}>Subtotal</th>
        <th style={thS(true)}>Valor a Pagar</th>
        <th style={thS(true)}></th>
      </tr>
    </thead>
  );

  const Linha = ({ p, i }) => {
    if (!p.irmao_id) {
      const c0 = { padding: '0.55rem 0.65rem', textAlign: 'center', color: 'var(--color-text-muted)' };
      return (
        <tr style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.06)' }}>
          <td style={{ padding: '0.55rem 0.65rem', fontWeight: 600, color: 'var(--color-text)' }}>{p.nome_externo || '?'}</td>
          <td style={c0}>1+{p.adultos_convidados}</td>
          <td style={c0}>{p.criancas_meia}</td>
          <td style={c0}>{p.criancas_gratuitas}</td>
          <td style={{ ...c0, fontWeight: 700, color: '#3b82f6' }}>{parseFloat(p.cotas || 0).toFixed(1)}</td>
          <td style={{ ...c0, fontWeight: 700, color: '#10b981' }}>{valorCota > 0 ? fmtR(aPagar(p)) : '—'}</td>
          {!encerrado ? (
            <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>
              <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                {podeEditar && <button onClick={() => { setPartEdit(p); setModalPart(true); }} style={btnEdit}>✏️</button>}
                {podeEditar && <button onClick={() => setConfirmExcluirPart(p)} style={btnDanger}>🗑️</button>}
              </div>
            </td>
          ) : <td />}
        </tr>
      );
    }
    const it = itemDe(p);
    const conv = p.irmao_id ? {
      adultos: parseInt(p.conv_adultos) || 0,
      meia: parseInt(p.conv_meia) || 0,
      grat: parseInt(p.conv_gratuitas) || 0,
    } : { adultos: 0, meia: 0, grat: 0 };
    const temConv = (conv.adultos + conv.meia + conv.grat) > 0;
    const cotasConv = p.irmao_id ? cotasConvidados(p) : 0;
    const cotasFam = parseFloat(p.cotas || 0) - cotasConv;
    const custoFam = it ? it.custoFamilia : cotasFam * valorCota;
    const valorFam = it ? (it.custeador ? it.custoFamilia : it.pagaFamilia) : cotasFam * valorCota;
    const bg = i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.06)';
    const cel = { padding: '0.55rem 0.65rem', textAlign: 'center', color: 'var(--color-text-muted)' };
    const celConv = { padding: '0.4rem 0.65rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem' };
    const ehCust = !!(comCusteio && p.irmao_id && it?.custeador);   // custeador: ganha a linha do custeio das famílias
    const span = 1 + (temConv ? 1 : 0) + (ehCust ? 1 : 0);
    const nomeCompleto = p.irmao_id ? (p.irmaos?.nome || '?') : (p.nome_externo || '?');

    return (
      <>
        <tr style={{ borderBottom: span > 1 ? 'none' : '1px solid var(--color-border)', background: bg }}>
          <td rowSpan={span} style={{ padding: '0.55rem 0.65rem', fontWeight: 600, color: 'var(--color-text)', verticalAlign: 'middle' }}>
            <span title={nomeCompleto}>{p.irmao_id ? nomeCurto(nomeCompleto) : nomeCompleto}</span>
            {comCusteio && p.irmao_id && p.custeador && (
              <div style={{ marginTop: '0.2rem' }}>
                <span title={`Própria ${fmtR(it?.custo)} + custeio famílias ${fmtR(it?.recebeCusteio)}`}
                  style={{ display: 'inline-block', fontSize: '0.68rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: '999px', background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.35)' }}>
                  Custeador + {fmtR(it?.recebeCusteio)}
                </span>
              </div>
            )}
          </td>
          <td style={{ ...cel, fontSize: '0.78rem', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>{p.irmao_id ? 'Família' : 'Externo'}</td>
          <td style={cel}>1+{p.adultos_convidados}</td>
          <td style={cel}>{p.criancas_meia}</td>
          <td style={cel}>{p.criancas_gratuitas}</td>
          <td style={{ ...cel, fontWeight: 700, color: '#3b82f6' }}>{cotasFam.toFixed(1)}</td>
          {comCusteio && <td style={cel}>{valorCota > 0 ? fmtR(custoFam) : '—'}</td>}
          {comCusteio && (
            <td style={{ ...cel, fontSize: '0.78rem' }}>
              {!p.irmao_id ? '—' : it?.custeador ? '100%' : it?.isento ? <span style={{ color: '#f59e0b', fontWeight: 700 }}>{it.isentoLoja ? 'Isento (Loja)' : 'Isento'}</span> : it?.personalizado ? <span style={{ color: '#f59e0b', fontWeight: 700 }}>{it.pctProprio}%</span> : `${it?.pctProprio ?? 100}%`}
            </td>
          )}
          <td style={{ ...cel, fontWeight: 600, color: 'var(--color-text)' }}>{valorCota > 0 ? fmtR(valorFam) : '—'}</td>
          <td rowSpan={span} style={{ ...cel, fontWeight: 700, color: '#10b981', verticalAlign: 'middle' }}>
            {valorCota > 0 ? fmtR(aPagar(p)) : '—'}
          </td>
          {!encerrado ? (
            <td rowSpan={span} style={{ padding: '0.55rem 0.5rem', textAlign: 'right', verticalAlign: 'middle' }}>
              <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                {podeEditar && <button onClick={() => { setPartEdit(p); setModalPart(true); }} style={btnEdit}>✏️</button>}
                {podeEditar && <button onClick={() => setConfirmExcluirPart(p)} style={btnDanger}>🗑️</button>}
              </div>
            </td>
          ) : <td rowSpan={span} />}
        </tr>

        {temConv && (
          <tr style={{ borderBottom: ehCust ? 'none' : '1px solid var(--color-border)', background: 'rgba(245,158,11,0.06)' }}>
            <td style={{ ...celConv, textAlign: 'left', fontWeight: 600, color: '#f59e0b', whiteSpace: 'nowrap' }}>Convidados</td>
            <td style={celConv}>{conv.adultos}</td>
            <td style={celConv}>{conv.meia}</td>
            <td style={celConv}>{conv.grat}</td>
            <td style={{ ...celConv, fontWeight: 700, color: '#3b82f6' }}>{cotasConv.toFixed(1)}</td>
            {comCusteio && <td style={celConv}>{valorCota > 0 ? fmtR(it?.custoConvidados || 0) : '—'}</td>}
            {comCusteio && <td style={celConv}>100%</td>}
            <td style={{ ...celConv, fontWeight: 600, color: 'var(--color-text)' }}>{valorCota > 0 ? fmtR(it?.custoConvidados || 0) : '—'}</td>
          </tr>
        )}

        {ehCust && (
          <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'rgba(139,92,246,0.07)' }}>
            <td title="Parte do custeio das famílias dos irmãos, dividida igualmente entre os custeadores"
              style={{ ...celConv, textAlign: 'left', fontWeight: 600, color: '#8b5cf6', whiteSpace: 'nowrap' }}>Custeio</td>
            <td style={celConv}>—</td>
            <td style={celConv}>—</td>
            <td style={celConv}>—</td>
            <td style={celConv}>—</td>
            <td style={celConv}>{valorCota > 0 ? fmtR(it.recebeCusteio) : '—'}</td>
            <td style={celConv} title="Dividido igualmente entre os custeadores">÷ {rateio?.numCusteadores || 1}</td>
            <td style={{ ...celConv, fontWeight: 600, color: 'var(--color-text)' }}>{valorCota > 0 ? fmtR(it.recebeCusteio) : '—'}</td>
          </tr>
        )}
      </>
    );
  };

  const SubtotalRow = ({ lista, cor, label, externo = false }) => {
    const cotas = lista.reduce((s, p) => s + parseFloat(p.cotas), 0);
    const valor = lista.reduce((s, p) => s + aPagar(p), 0);
    const custoLista = lista.reduce((s, p) => s + parseFloat(p.cotas) * valorCota, 0);
    if (externo) {
      return (
        <tr style={{ background: 'var(--color-surface-2)', borderTop: '1px solid var(--color-border)' }}>
          <td style={{ padding: '0.45rem 0.65rem', fontWeight: 700, color: cor, fontSize: '0.78rem' }}>Subtotal {label}</td>
          <td colSpan={3} />
          <td style={{ padding: '0.45rem 0.65rem', textAlign: 'center', fontWeight: 700, color: '#3b82f6', fontSize: '0.85rem' }}>{cotas.toFixed(1)}</td>
          <td style={{ padding: '0.45rem 0.65rem', textAlign: 'center', fontWeight: 700, color: '#10b981', fontSize: '0.85rem' }}>{valorCota > 0 ? fmtR(valor) : '—'}</td>
          <td />
        </tr>
      );
    }
    return (
      <tr style={{ background: 'var(--color-surface-2)', borderTop: '1px solid var(--color-border)' }}>
        <td style={{ padding: '0.45rem 0.65rem', fontWeight: 700, color: cor, fontSize: '0.78rem' }}>Subtotal {label}</td>
        <td colSpan={4} />
        <td style={{ padding: '0.45rem 0.65rem', textAlign: 'center', fontWeight: 700, color: '#3b82f6', fontSize: '0.85rem' }}>{cotas.toFixed(1)}</td>
        {comCusteio && <td style={{ padding: '0.45rem 0.65rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{valorCota > 0 ? fmtR(custoLista) : '—'}</td>}
        {comCusteio && <td />}
        <td style={{ padding: '0.45rem 0.65rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{valorCota > 0 ? fmtR(valor) : '—'}</td>
        <td style={{ padding: '0.45rem 0.65rem', textAlign: 'center', fontWeight: 700, color: '#10b981', fontSize: '0.85rem' }}>{valorCota > 0 ? fmtR(valor) : '—'}</td>
        <td />
      </tr>
    );
  };

  const totalValor = participantes.reduce((acc, q) => acc + aPagar(q), 0);
  const totalCusto = participantes.reduce((acc, q) => acc + parseFloat(q.cotas) * valorCota, 0);
  const tituloGrupo = (cor, bg, texto, cols, borda) => (
    <thead>
      <tr style={{ background: bg, borderTop: borda ? '2px solid var(--color-border)' : 'none' }}>
        <th colSpan={cols} style={{ padding: '0.45rem 0.65rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: cor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{texto}</th>
      </tr>
    </thead>
  );

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>

      {/* Grupo Irmãos */}
      {irmaos_part.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            {tituloGrupo('#c9a84c', 'rgba(201,168,76,0.12)', `👤 Irmãos da Loja (${irmaos_part.length})`, nColsIrm, false)}
            <Cabecalho />
            <tbody>
              {irmaos_part.map((p, i) => <Linha key={p.id} p={p} i={i} />)}
              {externos_part.length > 0 && <SubtotalRow lista={irmaos_part} cor='#c9a84c' label='Irmãos' />}
            </tbody>
          </table>
        </div>
      )}

      {/* Grupo Externos (tabela própria: só nome, adultos, crianças, cotas e valor total) */}
      {externos_part.length > 0 && (
        <div style={{ overflowX: 'auto', borderTop: irmaos_part.length > 0 ? '2px solid var(--color-border)' : 'none' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            {tituloGrupo('#6366f1', 'rgba(99,102,241,0.12)', `🌍 Convidados Externos (${externos_part.length})`, nColsExt, false)}
            <Cabecalho externo />
            <tbody>
              {externos_part.map((p, i) => <Linha key={p.id} p={p} i={i} />)}
              {irmaos_part.length > 0 && <SubtotalRow lista={externos_part} cor='#6366f1' label='Externos' externo />}
            </tbody>
          </table>
        </div>
      )}

      {/* Total geral */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem 1.5rem', padding: '0.65rem 0.85rem', background: 'var(--color-surface-2)', borderTop: '2px solid var(--color-border)' }}>
        <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>TOTAL GERAL</span>
        <span style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'baseline', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Cotas <strong style={{ color: '#3b82f6', fontSize: '0.95rem' }}>{totalCotas.toFixed(1)}</strong></span>
          {comCusteio && <span style={{ color: 'var(--color-text-muted)' }}>Custo <strong style={{ color: 'var(--color-text)' }}>{valorCota > 0 ? fmtR(totalCusto) : '—'}</strong></span>}
          <span style={{ color: 'var(--color-text-muted)' }}>Valor a pagar <strong style={{ color: '#10b981', fontSize: '0.95rem' }}>{valorCota > 0 ? fmtR(totalValor) : '—'}</strong></span>
        </span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
//  Detalhe do Evento
// ─────────────────────────────────────────────
const DetalheEvento = ({ evento: eventoInit, onVoltar, irmaos, showSuccess, showError, podeEditar = false, categorias = [], onEventoAtualizado }) => {
  const [evento, setEvento] = useState(eventoInit);
  const [despesas, setDespesas] = useState([]);
  const [participantes, setParticipantes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalPart, setModalPart] = useState(false);
  const [partEdit, setPartEdit] = useState(null);
  const [modalEvento, setModalEvento] = useState(false);
  const [confirmExcluirPart, setConfirmExcluirPart] = useState(null);
  const [confirmEncerrar, setConfirmEncerrar] = useState(false);
  const [editandoValor, setEditandoValor] = useState(false);
  const [novoValor, setNovoValor] = useState('');
  const [modalCotas, setModalCotas] = useState(false);
  const [categoriasCotas, setCategoriasCotas] = useState([]);
  const [cotasForm, setCotasForm] = useState({
    categoria_id: '',
    descricao: '',
    data_lancamento: new Date().toISOString().split('T')[0],
    data_vencimento: new Date().toISOString().split('T')[0],
  });
  const [cotasSelecionadas, setCotasSelecionadas] = useState({});
  const [cotasJaLancadas, setCotasJaLancadas] = useState({});
  const [lancandoCotas, setLancandoCotas] = useState(false);
  const [statusCotas, setStatusCotas] = useState({ total: 0, lancados: 0 });
  const [lancCotas, setLancCotas] = useState([]);      // lançamentos de cotas já criados para o evento
  const [modalRecalc, setModalRecalc] = useState(false);
  const [recalcSel, setRecalcSel] = useState({});
  const [recalculando, setRecalculando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [{ data: desp }, { data: parts }, { data: ev }] = await Promise.all([
      supabase.from('lancamentos_loja').select('id,descricao,valor,data_pagamento,data_vencimento,status,tipo_pagamento,tipo').eq('evento_comemorativo_id', evento.id).eq('origem_tipo', 'Loja').order('data_vencimento'),
      supabase.from('evento_rateio_participantes').select('*, irmaos(nome)').eq('evento_id', evento.id).order('criado_em'),
      supabase.from('eventos_comemorativos_fin').select('*').eq('id', evento.id).single(),
    ]);
    const despArr = desp || [];
    const partsArr = parts || [];
    setDespesas(despArr);
    setParticipantes(partsArr);
    if (ev) setEvento(ev);

    // Calcular status das cotas — quantos participantes irmãos já têm lançamento
    const { data: cotasExist } = await supabase
      .from('lancamentos_loja')
      .select('id,origem_irmao_id,valor,status,descricao,tipo')
      .eq('evento_comemorativo_id', evento.id)
      .eq('origem_tipo', 'Irmao');
    setLancCotas(cotasExist || []);
    const idsComLanc = new Set((cotasExist || []).map(l => l.origem_irmao_id).filter(Boolean));
    const totalParticIrmaos = partsArr.filter(p => p.irmao_id && !semCobranca(p)).length;
    const lancados = partsArr.filter(p => p.irmao_id && !semCobranca(p) && idsComLanc.has(p.irmao_id)).length;
    setStatusCotas({ total: totalParticIrmaos, lancados });

    setCarregando(false);
  }, [evento.id]);

  useEffect(() => { carregar(); }, [carregar]);

  // ── Cálculos ──
  // Todas as despesas vinculadas ao evento entram no total, independente do status
  const totalDespesas    = despesas.filter(d => d.tipo === 'despesa').reduce((s, d) => s + parseFloat(d.valor), 0);
  const contribuicaoLoja = evento.contribuicao_loja ? parseFloat(evento.contribuicao_loja) : 0;
  const baseRateio       = Math.max(0, totalDespesas - contribuicaoLoja);
  const totalCotas       = participantes.reduce((s, p) => s + parseFloat(p.cotas || 0), 0);
  const valorCalc        = totalCotas > 0 ? baseRateio / totalCotas : 0;
  const valorCota        = evento.valor_ajustado ? parseFloat(evento.valor_ajustado) : valorCalc;

  // Rateio com custeio (custeadores, % próprio, isentos, parte da Loja)
  const rateio = useMemo(() => calcularRateio(participantes, valorCota, evento), [participantes, valorCota, evento]);

  // Custo da Loja por irmão beneficiado (desconto, % próprio ou isenção)
  const custoLoja = useMemo(() => {
    const nomeDe = (q) => q.irmaos?.nome || '';
    const linhas = participantes
      .filter(q => q.irmao_id && !q.custeador && (rateio.porParticipante[q.id]?.parteLoja || 0) > 0)
      .map(q => ({ p: q, it: rateio.porParticipante[q.id] }))
      .sort((a, b) => nomeDe(a.p).localeCompare(nomeDe(b.p), 'pt-BR', { sensitivity: 'base' }));
    const total = linhas.reduce((acc, l) => acc + l.it.parteLoja, 0);
    return { linhas, total: Math.round(total * 100) / 100 };
  }, [participantes, rateio]);

  // Lançamentos já criados que diferem do cálculo atual
  const divergencias = useMemo(() => {
    if (valorCota <= 0) return [];
    const porIrmao = {};
    lancCotas.forEach(l => { (porIrmao[l.origem_irmao_id] = porIrmao[l.origem_irmao_id] || []).push(l); });
    const lista = [];
    participantes.filter(p => p.irmao_id && porIrmao[p.irmao_id]).forEach(p => {
      const esperado = rateio.porParticipante[p.id]?.total ?? 0;
      const lancs = porIrmao[p.irmao_id];
      const atual = lancs.reduce((s, l) => s + parseFloat(l.valor || 0), 0);
      if (Math.abs(atual - esperado) >= 0.01) {
        lista.push({ p, lancs, atual, esperado, editavel: lancs.length === 1 && lancs[0].status === 'pendente' && esperado > 0 });
      }
    });
    return lista;
  }, [lancCotas, participantes, rateio, valorCota]);

  // ── Abrir modal de cotas ──
  const abrirModalCotas = async () => {
    // Categorias já carregadas via prop
    setCategoriasCotas(categorias);

    // Buscar lançamentos já existentes para este evento por irmão
    const { data: lancExist } = await supabase
      .from('lancamentos_loja')
      .select('origem_irmao_id')
      .eq('evento_comemorativo_id', evento.id)
      .eq('origem_tipo', 'Irmao')
      .eq('status', 'pendente');

    const jaLancados = {};
    (lancExist || []).forEach(l => {
      if (l.origem_irmao_id) jaLancados[l.origem_irmao_id] = true;
    });
    setCotasJaLancadas(jaLancados);

    // Pré-selecionar irmãos que ainda não têm lançamento
    const preSelected = {};
    participantes
      .filter(p => p.irmao_id && !semCobranca(p) && !jaLancados[p.irmao_id])
      .forEach(p => { preSelected[p.irmao_id] = true; });
    setCotasSelecionadas(preSelected);

    // Pré-preencher descrição
    setCotasForm(prev => ({
      ...prev,
      descricao: `Cota — ${evento.nome}`,
    }));

    setModalCotas(true);
  };

  // ── Lançar cotas ──
  const handleLancarCotas = async () => {
    if (!cotasForm.categoria_id) {
      showError('Selecione uma categoria para o lançamento.');
      return;
    }
    const selecionados = participantes.filter(p =>
      p.irmao_id && !semCobranca(p) && cotasSelecionadas[p.irmao_id]
    );
    if (selecionados.length === 0) {
      showError('Selecione pelo menos um irmão.');
      return;
    }
    setLancandoCotas(true);
    try {
      const inserts = selecionados.map(p => {
        const item = rateio.porParticipante[p.id];
        const valor = (item ? item.total : valorCota * parseFloat(p.cotas || 1)).toFixed(2);
        return {
          tipo: 'receita',
          categoria_id: cotasForm.categoria_id,
          descricao: descricaoComCusteio(cotasForm.descricao, item),
          valor: parseFloat(valor),
          data_lancamento: cotasForm.data_lancamento,
          data_vencimento: cotasForm.data_vencimento,
          status: 'pendente',
          tipo_pagamento: 'pix',
          origem_tipo: 'Irmao',
          origem_irmao_id: p.irmao_id,
          evento_comemorativo_id: evento.id,
        };
      });
      const { error } = await supabase.from('lancamentos_loja').insert(inserts);
      if (error) throw error;
      showSuccess(`✅ ${inserts.length} lançamento(s) criado(s) com sucesso!`);
      setModalCotas(false);
      await carregar();
    } catch (e) {
      showError('Erro ao lançar cotas: ' + e.message);
    } finally {
      setLancandoCotas(false);
    }
  };

  // ── Recalcular lançamentos já criados ──
  const abrirModalRecalc = async () => {
    const { data } = await supabase
      .from('lancamentos_loja')
      .select('id,origem_irmao_id,valor,status,descricao,tipo')
      .eq('evento_comemorativo_id', evento.id)
      .eq('origem_tipo', 'Irmao');
    setLancCotas(data || []);
    setRecalcSel({});
    setModalRecalc(true);
  };

  const aplicarRecalculo = async () => {
    const alvos = divergencias.filter(d => d.editavel && recalcSel[d.p.id] !== false);
    if (alvos.length === 0) { showError('Nenhum lançamento selecionado para atualizar.'); return; }
    setRecalculando(true);
    try {
      let atualizados = 0;
      for (const d of alvos) {
        const item = rateio.porParticipante[d.p.id];
        const l = d.lancs[0];
        const { data, error } = await supabase
          .from('lancamentos_loja')
          .update({ valor: parseFloat(item.total.toFixed(2)), descricao: descricaoComCusteio(l.descricao, item) })
          .eq('id', l.id)
          .select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('Sem permissão para atualizar o lançamento.');
        atualizados++;
      }
      showSuccess(`✅ ${atualizados} lançamento(s) atualizado(s)!`);
      setModalRecalc(false);
      await carregar();
    } catch (e) {
      showError('Erro ao recalcular: ' + e.message);
    } finally {
      setRecalculando(false);
    }
  };

  // ── Salvar participante ──
  const handleSalvarPart = async (form) => {
    const cotas = parseFloat(form.cotas);
    const payload = {
      evento_id: evento.id,
      irmao_id: form.tipo === 'irmao' ? parseInt(form.irmao_id) : null,
      nome_externo: form.tipo === 'externo' ? form.nome_externo.trim() : null,
      adultos_convidados: parseInt(form.adultos_convidados) || 0,
      criancas_meia: parseInt(form.criancas_meia) || 0,
      criancas_gratuitas: parseInt(form.criancas_gratuitas) || 0,
      cotas,
      valor_final: evento.valor_ajustado ? cotas * parseFloat(evento.valor_ajustado) : null,
      custeador: form.tipo === 'irmao' ? !!form.custeador : false,
      percentual_proprio: (form.tipo === 'irmao' && !form.custeador && !form.isento && parseFloat(form.percentual_proprio) > 0) ? parseFloat(form.percentual_proprio) : null,
      isento: (form.tipo === 'irmao' && !form.custeador) ? !!form.isento : false,
      isento_loja: (form.tipo === 'irmao' && !form.custeador && form.isento) ? !!form.isento_loja : false,
      conv_adultos: form.tipo === 'irmao' ? (parseInt(form.conv_adultos) || 0) : 0,
      conv_meia: form.tipo === 'irmao' ? (parseInt(form.conv_meia) || 0) : 0,
      conv_gratuitas: form.tipo === 'irmao' ? (parseInt(form.conv_gratuitas) || 0) : 0,
    };
    if (partEdit) {
      const { error } = await supabase.from('evento_rateio_participantes').update(payload).eq('id', partEdit.id);
      if (error) throw error;
      showSuccess('✅ Participante atualizado!');
    } else {
      const { error } = await supabase.from('evento_rateio_participantes').insert(payload);
      if (error) throw error;
      showSuccess('✅ Participante adicionado!');
    }
    setModalPart(false); setPartEdit(null);
    carregar();
  };

  // ── Excluir participante ──
  const handleExcluirPart = async () => {
    const { error } = await supabase.from('evento_rateio_participantes').delete().eq('id', confirmExcluirPart.id);
    if (!error) { setConfirmExcluirPart(null); showSuccess('🗑️ Removido.'); carregar(); }
    else showError('Erro ao remover.');
  };

  // ── Encerrar evento ──
  const handleEncerrar = async () => {
    const { error } = await supabase.from('eventos_comemorativos_fin').update({ status: 'encerrado', data_encerramento: hojeISO() }).eq('id', evento.id);
    if (!error) { setConfirmEncerrar(false); showSuccess('✅ Evento encerrado.'); carregar(); onEventoAtualizado(); }
    else showError('Erro ao encerrar.');
  };

  // ── Salvar valor ajustado ──
  const handleSalvarValor = async () => {
    const val = parseFloat(novoValor) || null;
    const { error } = await supabase.from('eventos_comemorativos_fin').update({ valor_ajustado: val }).eq('id', evento.id);
    if (!error) { setEditandoValor(false); showSuccess('✅ Valor atualizado!'); carregar(); onEventoAtualizado(); }
    else showError('Erro ao salvar valor.');
  };

  // ── Recalcular valores dos participantes ──
  const recalcularParticipantes = async () => {
    if (valorCota <= 0) { showError('Defina o valor ajustado por cota antes de salvar.'); return; }
    for (const p of participantes) {
      await supabase.from('evento_rateio_participantes').update({ valor_final: rateio.porParticipante[p.id]?.total ?? parseFloat(p.cotas) * valorCota }).eq('id', p.id);
    }
    showSuccess('✅ Valores persistidos no banco!');
    carregar();
  };

  // ── Gerar PDF ──
  const gerarPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const s = (str) => { if (!str) return ''; let r = ''; for (const c of str.normalize('NFD')) { if (c.charCodeAt(0) < 128) r += c; } return r; };
    const fmtM = (v) => `R$ ${(parseFloat(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
    const pW = doc.internal.pageSize.getWidth();

    // Agrupamento de participantes (usado no Resumo e no Rateio)
    const nomeParticipante = (p) => (p.irmao_id ? (p.irmaos?.nome || '') : (p.nome_externo || ''));
    const porNome = (a, b) => nomeParticipante(a).localeCompare(nomeParticipante(b), 'pt-BR', { sensitivity: 'base' });
    const abrev = (nome) => s(nome || '').split(' ').slice(0, 2).join(' ');
    const irmaos_part   = participantes.filter(p => p.irmao_id).sort(porNome);
    const externos_part = participantes.filter(p => !p.irmao_id).sort(porNome);
    const cotasIrmaos    = irmaos_part.reduce((s2, p) => s2 + parseFloat(p.cotas), 0);
    const cotasExternos  = externos_part.reduce((s2, p) => s2 + parseFloat(p.cotas), 0);

    // Cabeçalho
    doc.setFillColor(26, 26, 26);
    doc.rect(0, 0, pW, 42, 'F');
    doc.setTextColor(201, 168, 76);
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text('A.R.L.S. Acacia de Paranatinga no 30', pW / 2, 14, { align: 'center' });
    doc.setTextColor(220, 220, 220);
    doc.setFontSize(11);
    doc.text(`Evento Comemorativo - ${s(evento.nome)} ${evento.ano}`, pW / 2, 23, { align: 'center' });
    doc.setFontSize(8); doc.setTextColor(160, 160, 160);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, pW / 2, 32, { align: 'center' });
    if (evento.data_evento) doc.text(`Data do Evento: ${fmtD(evento.data_evento)}`, pW / 2, 38, { align: 'center' });

    let y = 52;

    // Resumo financeiro
    const diferencaLoja = valorCota > 0 ? Math.max(0, totalDespesas - (cotasIrmaos + cotasExternos) * valorCota) : 0;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
    doc.text('Resumo Financeiro', 14, y); y += 5;
    autoTable(doc, {
      startY: y,
      body: [
        ['Total de Despesas', fmtM(totalDespesas)],
        ...(contribuicaoLoja > 0 ? [['Contribuicao da Loja', `- ${fmtM(contribuicaoLoja)}`], ['Base do Rateio', fmtM(baseRateio)]] : []),
        ['Total de Cotas', totalCotas.toFixed(1)],
        ['Valor Calculado por Cota', fmtM(valorCalc)],
        ['Valor Ajustado por Cota', evento.valor_ajustado ? fmtM(evento.valor_ajustado) : 'Nao definido'],
        ['Irmaos Participantes', `${irmaos_part.length}  (${cotasIrmaos.toFixed(1)} cotas${valorCota > 0 ? ` - ${fmtM(cotasIrmaos * valorCota)}` : ''})`],
        ...(externos_part.length > 0 ? [['Convidados Externos', `${externos_part.length}  (${cotasExternos.toFixed(1)} cotas${valorCota > 0 ? ` - ${fmtM(cotasExternos * valorCota)}` : ''})`]] : []),
        ['Total Geral de Cotas', `${(cotasIrmaos + cotasExternos).toFixed(1)}${valorCota > 0 ? `  (${fmtM((cotasIrmaos + cotasExternos) * valorCota)})` : ''}`],
        ...(diferencaLoja > 0 ? [['Diferenca Coberta pela Loja', fmtM(diferencaLoja)]] : []),
      ],
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [40, 40, 40] },
      columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        const rotulo = data.row.raw?.[0];
        if (data.column.index === 1 && rotulo === 'Valor Calculado por Cota') {
          data.cell.styles.textColor = [0, 0, 0];       // preto — valor calculado por cota
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.column.index === 1 && rotulo === 'Valor Ajustado por Cota' && evento.valor_ajustado) {
          data.cell.styles.textColor = [22, 163, 74];    // verde — valor ajustado por cota
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.column.index === 1 && rotulo === 'Irmaos Participantes') {
          data.cell.styles.textColor = [37, 99, 235];   // azul — valor lançado aos irmãos
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.column.index === 1 && (rotulo === 'Convidados Externos' || rotulo === 'Diferenca Coberta pela Loja')) {
          data.cell.styles.textColor = [220, 38, 38];   // vermelho — coberto pela loja
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = doc.lastAutoTable.finalY + 10;

    // Despesas
    if (despesas.length > 0) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
      doc.text(`Despesas Vinculadas (${despesas.length})`, 14, y); y += 5;
      autoTable(doc, {
        startY: y,
        head: [['Data', 'Descricao', 'Status', 'Valor']],
        body: despesas.map(d => [
          fmtD(d.data_vencimento),
          s(d.descricao || ''),
          d.status === 'pago' ? 'Pago' : 'Pendente',
          fmtM(d.valor),
        ]),
        foot: [['', '', 'Total', fmtM(despesas.reduce((s2, d) => s2 + parseFloat(d.valor || 0), 0))]],
        showFoot: 'lastPage',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [55, 55, 55], textColor: 255 },
        footStyles: { fillColor: [235, 225, 200], textColor: [26, 26, 26], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 10;
    }

    // Rateio — separado em Irmãos e Convidados Externos (mesma lógica de agrupamento da tela)
    if (participantes.length > 0) {
      // Quadro de Irmãos
      if (irmaos_part.length > 0) {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
        doc.text(`Irmaos (${irmaos_part.length})`, 14, y); y += 5;
        autoTable(doc, {
          startY: y,
          head: [rateio.ativo ? ['Irmao', 'Cotas', 'Valor a Pagar', 'Obs.'] : ['Irmao', 'Cotas', 'Valor a Pagar']],
          body: irmaos_part.map(p => {
            const it = rateio.porParticipante[p.id];
            const linha = [
              abrev(p.irmaos?.nome),
              parseFloat(p.cotas).toFixed(1),
              valorCota > 0 ? fmtM(it ? it.total : parseFloat(p.cotas) * valorCota) : '-',
            ];
            if (rateio.ativo) linha.push([it?.custeador ? `Custeador (inclui custeio ${fmtM(it.recebeCusteio)})` : it?.isento ? (it.isentoLoja ? 'Isento (so Loja)' : 'Isento') : it?.personalizado ? `${it.pctProprio}% proprio` : '', it?.custoConvidados > 0 ? `Convidados ${fmtM(it.custoConvidados)}` : ''].filter(Boolean).join(' | '));
            return linha;
          }),
          foot: [[
            'Subtotal Irmaos',
            irmaos_part.reduce((s2, p) => s2 + parseFloat(p.cotas), 0).toFixed(1),
            valorCota > 0 ? fmtM(irmaos_part.reduce((s2, p) => s2 + (rateio.porParticipante[p.id]?.total ?? parseFloat(p.cotas) * valorCota), 0)) : '-',
            ...(rateio.ativo ? [''] : []),
          ]],
          showFoot: 'lastPage',
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [201, 168, 76], textColor: [26, 26, 26] },
          footStyles: { fillColor: [235, 225, 200], textColor: [26, 26, 26], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 248, 248] },
          columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right', fontStyle: 'bold' } },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 8;
      }

      // Quadro de Convidados Externos (só aparece se houver)
      if (externos_part.length > 0) {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
        doc.text(`Convidados Externos (${externos_part.length})`, 14, y); y += 5;
        autoTable(doc, {
          startY: y,
          head: [['Convidado', 'Cotas', 'Valor a Pagar']],
          body: externos_part.map(p => [
            abrev(p.nome_externo),
            parseFloat(p.cotas).toFixed(1),
            valorCota > 0 ? fmtM(parseFloat(p.cotas) * valorCota) : '-',
          ]),
          foot: [[
            'Subtotal Externos',
            externos_part.reduce((s2, p) => s2 + parseFloat(p.cotas), 0).toFixed(1),
            valorCota > 0 ? fmtM(externos_part.reduce((s2, p) => s2 + parseFloat(p.cotas) * valorCota, 0)) : '-',
          ]],
          showFoot: 'lastPage',
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [99, 102, 241], textColor: 255 },
          footStyles: { fillColor: [224, 224, 250], textColor: [26, 26, 26], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 248, 248] },
          columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right', fontStyle: 'bold' } },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 6;
      }

      // Custo da Loja Acacia (irmaos beneficiados por desconto/isencao)
      if (rateio.ativo && valorCota > 0 && custoLoja.linhas.length > 0) {
        if (y > 230) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
        doc.text('Custo da Loja Acacia - irmaos beneficiados', 14, y); y += 5;
        autoTable(doc, {
          startY: y,
          head: [['Custo referente a', 'Custo familia', 'Condicao', 'Irmao paga', 'Custeadores', 'Loja paga']],
          body: custoLoja.linhas.map(({ p: q, it }) => [
            `Loja Acacia - ${abrev(q.irmaos?.nome)}`,
            fmtM(it.custoFamilia),
            it.isento ? (it.isentoLoja ? 'Isento - so a Loja' : 'Isento') : `Paga ${it.pctProprio}% (padrao ${rateio.pEvento}%)`,
            fmtM(it.pagaProprio),
            fmtM(it.parteCusteio),
            fmtM(it.parteLoja),
          ]),
          foot: [['Subtotal irmaos beneficiados', '', '', '', '', fmtM(custoLoja.total)]],
          showFoot: 'lastPage',
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [99, 102, 241], textColor: 255 },
          footStyles: { fillColor: [224, 224, 250], textColor: [26, 26, 26], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 248, 248] },
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 6;
      }

      // Total geral do rateio
      const totalRateio = valorCota > 0 ? participantes.reduce((s2, p) => s2 + parseFloat(p.cotas) * valorCota, 0) : 0;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(40, 40, 40);
      doc.text(`Total do Rateio: ${fmtM(totalRateio)}`, pW - 14, y, { align: 'right' });
      if (rateio.ativo && valorCota > 0) {
        if (y > 255) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
        const linhas = [
          `Custeio: irmaos pagam ${rateio.pEvento}% (padrao); custeadores ${rateio.fatiaCusteio}%, divididos igualmente`,
          `Cobrado dos irmaos: ${fmtM(rateio.resumo.cobradoIrmaos)}  |  Custeio das familias (custeadores): ${fmtM(rateio.resumo.custeioPool)}`,
          `Parte da Loja: ${fmtM(rateio.resumo.lojaTotal)} (diferenca nas familias ${fmtM(rateio.resumo.lojaIrmaos)} + visitantes/externos ${fmtM(rateio.resumo.externos)})`,
        ];
        linhas.forEach((t) => { y += 5; doc.text(t, pW - 14, y, { align: 'right' }); });
      }
    }

    // Rodapé em todas as páginas
    const total = doc.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(7); doc.setTextColor(180, 180, 180);
      doc.text(`Pagina ${i} de ${total}`, pW - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
    }

    doc.save(`Evento_${s(evento.nome)}_${evento.ano}.pdf`);
    showSuccess('📄 PDF gerado!');
  };

  const encerrado = evento.status === 'encerrado';

  return (
    <>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={onVoltar} style={{ ...btnEdit, padding: '0.4rem 0.8rem' }}>← Voltar</button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>{evento.nome} — {evento.ano}</span>
              <span style={{ padding: '0.15rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, background: encerrado ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: encerrado ? '#10b981' : '#f59e0b', border: encerrado ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(245,158,11,0.4)' }}>
                {encerrado ? '✅ Encerrado' : '⚙️ Em Aberto'}
              </span>
            </div>
            {evento.data_evento && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>📅 {fmtD(evento.data_evento)}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {podeEditar && <button onClick={() => setModalEvento(true)} style={{ ...btnEdit, padding: '0.45rem 0.85rem' }}>✏️ Editar</button>}
          {podeEditar && valorCota > 0 && (() => {
            const todosLancados = statusCotas.total > 0 && statusCotas.lancados >= statusCotas.total;
            const parcialLancado = statusCotas.lancados > 0 && !todosLancados;
            return (
              <div style={{display:'flex',gap:'0.4rem',alignItems:'center',flexWrap:'wrap'}}>
                {/* Indicador de status */}
                {statusCotas.lancados > 0 && (
                  <span style={{fontSize:'0.72rem',fontWeight:700,padding:'0.2rem 0.6rem',borderRadius:'999px',
                    background: todosLancados ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                    color: todosLancados ? '#10b981' : '#f59e0b',
                    border: `1px solid ${todosLancados ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.4)'}`,
                  }}>
                    {todosLancados ? `✅ Cotas lançadas (${statusCotas.lancados}/${statusCotas.total})` : `⚠️ Parcial (${statusCotas.lancados}/${statusCotas.total})`}
                  </span>
                )}
                {/* Botão principal */}
                <button onClick={abrirModalCotas}
                  disabled={todosLancados}
                  style={{...btnPrimary,
                    background: todosLancados ? 'rgba(100,100,100,0.1)' : parcialLancado ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
                    border: `1px solid ${todosLancados ? 'rgba(100,100,100,0.3)' : parcialLancado ? 'rgba(245,158,11,0.35)' : 'rgba(16,185,129,0.35)'}`,
                    color: todosLancados ? 'var(--color-text-muted)' : parcialLancado ? '#f59e0b' : '#10b981',
                    cursor: todosLancados ? 'not-allowed' : 'pointer',
                    opacity: todosLancados ? 0.6 : 1,
                  }}>
                  {todosLancados ? '🔒 Cotas Enviadas' : parcialLancado ? '💰 Lançar Restantes' : '💰 Lançar Cotas'}
                </button>
                {/* Recalcular lançamentos já criados */}
                {statusCotas.lancados > 0 && (
                  <button onClick={abrirModalRecalc}
                    style={{...btnPrimary,
                      background: divergencias.length > 0 ? 'rgba(245,158,11,0.15)' : 'rgba(139,92,246,0.12)',
                      border: `1px solid ${divergencias.length > 0 ? 'rgba(245,158,11,0.4)' : 'rgba(139,92,246,0.35)'}`,
                      color: divergencias.length > 0 ? '#f59e0b' : '#8b5cf6',
                      fontSize: '0.72rem', padding: '0.35rem 0.65rem'}}
                    title="Conferir e atualizar os lançamentos pelo cálculo atual">
                    🔄 Recalcular lançamentos{divergencias.length > 0 ? ` (${divergencias.length})` : ''}
                  </button>
                )}
                {/* Botão liberar — só aparece quando já lançado */}
                {statusCotas.lancados > 0 && (
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Isso vai liberar o lançamento de cotas novamente para os ${statusCotas.lancados} irmão(s) que já possuem lançamento.\n\nUse esta opção apenas se os lançamentos anteriores foram excluídos manualmente no Finanças Loja.\n\nConfirma a liberação?`)) return;
                      setStatusCotas({ total: statusCotas.total, lancados: 0 });
                    }}
                    style={{...btnPrimary,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',color:'#ef4444',fontSize:'0.72rem',padding:'0.35rem 0.65rem'}}
                    title="Liberar para relançar cotas (use apenas se os lançamentos foram excluídos)"
                  >
                    🔓 Liberar
                  </button>
                )}
              </div>
            );
          })()}
          {podeEditar && <button onClick={gerarPDF} style={{ ...btnPrimary, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.35)', color: '#3b82f6' }}>📄 PDF</button>}
          {podeEditar && !encerrado && <button onClick={() => setConfirmEncerrar(true)} style={{ ...btnPrimary, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444' }}>🔒 Encerrar</button>}
        </div>
      </div>

      {carregando ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>Carregando...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Cards de resumo */}
          {(() => { const cardsResumo = [
              { label: 'Total Despesas', val: fmtR(totalDespesas), cor: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
              ...(contribuicaoLoja > 0 ? [
                { label: 'Contribuição Loja', val: fmtR(contribuicaoLoja), cor: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
                { label: 'Base do Rateio', val: fmtR(baseRateio), cor: '#f97316', bg: 'rgba(249,115,22,0.1)' },
              ] : []),
              { label: 'Total Cotas', val: totalCotas.toFixed(1), cor: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
              { label: 'Valor/Cota Calculado', val: fmtR(valorCalc), cor: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
              { label: 'Valor/Cota Ajustado', val: evento.valor_ajustado ? fmtR(parseFloat(evento.valor_ajustado)) : '—', cor: '#10b981', bg: 'rgba(16,185,129,0.1)' },
              ...(rateio.ativo ? [
                { label: 'Custeadores (famílias)', val: fmtR(rateio.resumo.custeioPool), cor: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
                { label: 'Parte da Loja', val: fmtR(rateio.resumo.lojaTotal), cor: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
              ] : []),
          ];
          return (
            <GradeIndicadores n={cardsResumo.length}>
              {cardsResumo.map(({ label, val, cor }) => (
                <div key={label} style={{ background: 'var(--color-surface)', border: `1px solid ${cor}33`, borderRadius: 'var(--radius-md)', padding: '0.75rem', minWidth: 0 }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>{label}</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: cor, overflowWrap: 'anywhere' }}>{val}</div>
                </div>
              ))}
            </GradeIndicadores>
          ); })()}

          {rateio.ativo && valorCota > 0 && (
            <div style={{ ...card, borderLeft: '4px solid #8b5cf6', fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
              <p style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.9rem', margin: '0 0 0.25rem' }}>🤝 Conferência do custeio ({rateio.pEvento}% irmão · {rateio.fatiaCusteio}% custeadores)</p>
              Cobrado dos irmãos <strong style={{ color: '#10b981' }}>{fmtR(rateio.resumo.cobradoIrmaos)}</strong>
              {' + '}Loja (diferença nas famílias) <strong style={{ color: '#6366f1' }}>{fmtR(rateio.resumo.lojaIrmaos)}</strong>
              {' + '}Visitantes/externos (Loja) <strong style={{ color: '#6366f1' }}>{fmtR(rateio.resumo.externos)}</strong>
              {' = '}<strong style={{ color: 'var(--color-text)' }}>{fmtR(rateio.resumo.totalRateio)}</strong>
              {rateio.numCusteadores === 0 && <div style={{ color: '#f59e0b' }}>⚠️ Nenhum custeador marcado: a fatia dos custeadores está ficando com a Loja.</div>}
            </div>
          )}

          {/* Ajuste de valor */}
          <div style={{ ...card, borderLeft: '4px solid #c9a84c' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <p style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.9rem', marginBottom: '0.15rem' }}>🎯 Ajuste do Valor por Cota</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  {contribuicaoLoja > 0 && <>Base do rateio: <strong style={{ color: '#f97316' }}>{fmtR(baseRateio)}</strong> (Loja contribui {fmtR(contribuicaoLoja)}) · </>}
                  Calculado: <strong>{fmtR(valorCalc)}</strong>
                  {evento.valor_ajustado && <> → Ajustado: <strong style={{ color: '#10b981' }}>{fmtR(parseFloat(evento.valor_ajustado))}</strong></>}
                </p>
              </div>
              {editandoValor ? (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input style={{ ...inp, width: '140px' }} type="number" step="0.01" min="0" value={novoValor} onChange={e => setNovoValor(e.target.value)} placeholder="Ex: 145.00" autoFocus />
                  <button onClick={handleSalvarValor} style={btnPrimary}>💾</button>
                  <button onClick={() => setEditandoValor(false)} style={{ ...btnEdit }}>✕</button>
                </div>
              ) : podeEditar ? (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => { setNovoValor(evento.valor_ajustado || valorCalc.toFixed(2)); setEditandoValor(true); }}
                    style={{ ...btnPrimary }}>✏️ Ajustar Valor</button>
                  {participantes.length > 0 && valorCota > 0 && (
                    <button onClick={recalcularParticipantes} style={{ ...btnPrimary, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.35)', color: '#8b5cf6' }}>
                      🔄 Recalcular
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* Despesas vinculadas */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                💸 Despesas Vinculadas ({despesas.length})
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Vincule despesas via FinançasLoja → campo "Evento Comemorativo"
              </span>
            </div>
            {despesas.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '1.5rem', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                Nenhuma despesa vinculada. Registre despesas na FinançasLoja e selecione este evento.
              </p>
            ) : (
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                      {['Data','Descrição','Status','Tipo Pag.','Valor'].map(h => (
                        <th key={h} style={{ padding: '0.55rem 0.75rem', textAlign: h === 'Valor' ? 'right' : 'left', fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {despesas.map((d, i) => (
                      <tr key={d.id} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'transparent' : 'var(--color-surface-2)' }}>
                        <td style={{ padding: '0.55rem 0.75rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{fmtD(d.data_vencimento)}</td>
                        <td style={{ padding: '0.55rem 0.75rem', fontWeight: 600, color: 'var(--color-text)' }}>{d.descricao}</td>
                        <td style={{ padding: '0.55rem 0.75rem' }}>
                          <span style={{ padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600, background: d.status === 'pago' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: d.status === 'pago' ? '#10b981' : '#f59e0b' }}>
                            {d.status === 'pago' ? '✅ Pago' : '⏳ Pendente'}
                          </span>
                        </td>
                        <td style={{ padding: '0.55rem 0.75rem', color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>{d.tipo_pagamento}</td>
                        <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{fmtR(d.valor)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: 'var(--color-surface-2)', borderTop: '2px solid var(--color-border)' }}>
                      <td colSpan={4} style={{ padding: '0.55rem 0.75rem', fontWeight: 700, color: 'var(--color-text)' }}>TOTAL</td>
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#ef4444', fontSize: '0.95rem' }}>{fmtR(totalDespesas)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Participantes / Rateio */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                👥 Participantes e Rateio ({participantes.length})
              </h3>
              {!encerrado && podeEditar && (
                <button onClick={() => { setPartEdit(null); setModalPart(true); }} style={btnPrimary}>➕ Adicionar Participante</button>
              )}
            </div>

            {participantes.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '1.5rem', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                Nenhum participante cadastrado ainda.
              </p>
            ) : (
              <TabelaParticipantes
                participantes={participantes}
                valorCota={valorCota}
                encerrado={encerrado}
                setPartEdit={setPartEdit}
                setModalPart={setModalPart}
                setConfirmExcluirPart={setConfirmExcluirPart}
                totalCotas={totalCotas}
                btnEdit={btnEdit}
                btnDanger={btnDanger}
                podeEditar={podeEditar}
                rateio={rateio}
              />
            )}
          </div>

          {/* Custo da Loja Acácia — irmãos beneficiados e visitantes */}
          {rateio.ativo && valorCota > 0 && (custoLoja.linhas.length > 0 || rateio.resumo.externos > 0) && (() => {
            const th = (c) => ({ padding: '0.5rem 0.65rem', textAlign: c ? 'center' : 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' });
            const td = (c, extra = {}) => ({ padding: '0.55rem 0.65rem', textAlign: c ? 'center' : 'left', ...extra });
            const caixa = { border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', overflowX: 'auto' };
            const condicao = (it) => it.isento ? (it.isentoLoja ? 'Isento — só a Loja' : 'Isento')
              : `Paga ${it.pctProprio}% (padrão ${rateio.pEvento}%)`;

            // Visitantes/externos: cada cadastro = 1 visitante + seus acompanhantes
            const nomeExt = (q) => q.nome_externo || '';
            const externosLista = participantes.filter(q => !q.irmao_id)
              .sort((a, b2) => nomeExt(a).localeCompare(nomeExt(b2), 'pt-BR', { sensitivity: 'base' }));
            const acompanhantes = (q) => (parseInt(q.adultos_convidados) || 0) + (parseInt(q.criancas_meia) || 0) + (parseInt(q.criancas_gratuitas) || 0);
            const totVisitantes = externosLista.length;
            const totAcomp = externosLista.reduce((acc, q) => acc + acompanhantes(q), 0);
            const totCotasExt = externosLista.reduce((acc, q) => acc + parseFloat(q.cotas || 0), 0);

            return (
              <div style={{ ...card, borderLeft: '4px solid #6366f1' }}>
                <p style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.95rem', margin: '0 0 0.15rem' }}>
                  🏛️ Custo da Loja Acácia
                </p>

                {custoLoja.linhas.length > 0 && (
                  <>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0 0 0.75rem' }}>
                      Irmãos beneficiados: valor que a Loja paga referente a cada irmão com desconto ou isenção (diferença entre o custo da família, o que o irmão paga e a fatia dos custeadores).
                    </p>
                    <div style={caixa}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                            <th style={th(false)}>Custo referente a</th>
                            <th style={th(true)}>Custo da família</th>
                            <th style={th(true)}>Condição</th>
                            <th style={th(true)}>Irmão paga</th>
                            <th style={th(true)}>Custeadores</th>
                            <th style={th(true)}>Loja paga</th>
                          </tr>
                        </thead>
                        <tbody>
                          {custoLoja.linhas.map(({ p: q, it }, i) => (
                            <tr key={q.id} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.06)' }}>
                              <td style={td(false, { fontWeight: 600, color: 'var(--color-text)' })}>
                                <span style={{ color: '#6366f1' }}>Loja Acácia</span>
                                <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}> — </span>
                                <span title={q.irmaos?.nome || ''}>{nomeCurto(q.irmaos?.nome || '?')}</span>
                              </td>
                              <td style={td(true, { color: 'var(--color-text-muted)' })}>{fmtR(it.custoFamilia)}</td>
                              <td style={td(true, { color: it.isento ? '#f59e0b' : 'var(--color-text-muted)', fontWeight: it.isento ? 700 : 500, fontSize: '0.8rem' })}>{condicao(it)}</td>
                              <td style={td(true, { color: 'var(--color-text-muted)' })}>{fmtR(it.pagaFamilia)}</td>
                              <td style={td(true, { color: 'var(--color-text-muted)' })}>{fmtR(it.parteCusteio)}</td>
                              <td style={td(true, { fontWeight: 800, color: '#6366f1' })}>
                                {fmtR(it.parteLoja)}
                                <span style={{ fontWeight: 500, fontSize: '0.7rem', color: 'var(--color-text-muted)', marginLeft: '0.3rem' }}>({Math.round(it.parteLoja / it.custoFamilia * 1000) / 10}%)</span>
                              </td>
                            </tr>
                          ))}
                          <tr style={{ background: 'var(--color-surface-2)', borderTop: '1px solid var(--color-border)' }}>
                            <td colSpan={5} style={td(false, { fontWeight: 700, color: 'var(--color-text)', fontSize: '0.8rem' })}>Subtotal — irmãos beneficiados ({custoLoja.linhas.length})</td>
                            <td style={td(true, { fontWeight: 800, color: '#6366f1' })}>{fmtR(custoLoja.total)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {externosLista.length > 0 && (
                  <div style={{ marginTop: custoLoja.linhas.length > 0 ? '1.1rem' : '0.5rem' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0 0 0.75rem' }}>
                      Visitantes e convidados externos: cada cadastro conta como 1 visitante, mais os acompanhantes dele. Tudo custeado pela Loja.
                    </p>
                    <div style={caixa}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                            <th style={th(false)}>Custo referente a</th>
                            <th style={th(true)}>Visitante</th>
                            <th style={th(true)}>Acompanhantes</th>
                            <th style={th(true)}>Total de pessoas</th>
                            <th style={th(true)}>Cotas</th>
                            <th style={th(true)}>Loja paga</th>
                          </tr>
                        </thead>
                        <tbody>
                          {externosLista.map((q, i) => {
                            const ac = acompanhantes(q);
                            return (
                              <tr key={q.id} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.06)' }}>
                                <td style={td(false, { fontWeight: 600, color: 'var(--color-text)' })}>
                                  <span style={{ color: '#6366f1' }}>Loja Acácia</span>
                                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}> — </span>
                                  {q.nome_externo || '?'}
                                </td>
                                <td style={td(true, { color: 'var(--color-text-muted)' })}>1</td>
                                <td style={td(true, { color: 'var(--color-text-muted)' })}>{ac}</td>
                                <td style={td(true, { fontWeight: 600, color: 'var(--color-text)' })}>{1 + ac}</td>
                                <td style={td(true, { color: '#3b82f6', fontWeight: 600 })}>{parseFloat(q.cotas || 0).toFixed(1)}</td>
                                <td style={td(true, { fontWeight: 800, color: '#6366f1' })}>{fmtR(rateio.porParticipante[q.id]?.custo || 0)}</td>
                              </tr>
                            );
                          })}
                          <tr style={{ background: 'var(--color-surface-2)', borderTop: '1px solid var(--color-border)' }}>
                            <td style={td(false, { fontWeight: 700, color: 'var(--color-text)', fontSize: '0.8rem' })}>Subtotal — visitantes e externos</td>
                            <td style={td(true, { fontWeight: 800, color: 'var(--color-text)' })}>{totVisitantes}</td>
                            <td style={td(true, { fontWeight: 800, color: 'var(--color-text)' })}>{totAcomp}</td>
                            <td style={td(true, { fontWeight: 800, color: 'var(--color-text)' })}>{totVisitantes + totAcomp}</td>
                            <td style={td(true, { fontWeight: 800, color: '#3b82f6' })}>{totCotasExt.toFixed(1)}</td>
                            <td style={td(true, { fontWeight: 800, color: '#6366f1' })}>{fmtR(rateio.resumo.externos)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.7rem 0.85rem', borderRadius: 'var(--radius-md)', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)' }}>
                  <span style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '0.85rem' }}>TOTAL A CARGO DA LOJA</span>
                  <span style={{ fontWeight: 800, color: '#6366f1', fontSize: '1rem' }}>{fmtR(rateio.resumo.lojaTotal)}</span>
                </div>

                {rateio.numCusteadores === 0 && (
                  <p style={{ fontSize: '0.72rem', color: '#f59e0b', margin: '0.5rem 0 0' }}>
                    ⚠️ Nenhum custeador marcado: a fatia dos custeadores também está a cargo da Loja.
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Modais */}
      <ModalParticipante aberto={modalPart} onFechar={() => { setModalPart(false); setPartEdit(null); }}
        onSalvar={handleSalvarPart} partEdit={partEdit} irmaos={irmaos} evento={evento} valorCota={valorCota} />

      <ModalEvento aberto={modalEvento} onFechar={() => setModalEvento(false)}
        onSalvar={async (form) => {
          const { error } = await supabase.from('eventos_comemorativos_fin').update({
            nome: form.nome, ano: form.ano, data_evento: form.data_evento || null,
            descricao: form.descricao || null, idade_gratuita: form.idade_gratuita,
            idade_meia: form.idade_meia, valor_ajustado: form.valor_ajustado ? parseFloat(form.valor_ajustado) : null,
            contribuicao_loja: form.contribuicao_loja ? parseFloat(form.contribuicao_loja) : null,
            custeio_percentual_irmao: form.custeio_percentual_irmao ? parseFloat(form.custeio_percentual_irmao) : null,
          }).eq('id', evento.id);
          if (error) throw error;
          showSuccess('✅ Evento atualizado!');
          setModalEvento(false);
          carregar(); onEventoAtualizado();
        }}
        eventoEdit={evento} />

      {/* Confirm excluir participante */}
      {confirmExcluirPart && (
        <div style={overlay}>
          <div style={modalBox('400px')}>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Remover participante?</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
                <strong style={{ color: 'var(--color-text)' }}>
                  {confirmExcluirPart.irmao_id ? confirmExcluirPart.irmaos?.nome : confirmExcluirPart.nome_externo}
                </strong> será removido do rateio.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setConfirmExcluirPart(null)} style={{ padding: '0.55rem 1.1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleExcluirPart} style={{ ...btnDanger, padding: '0.55rem 1.25rem', fontWeight: 600 }}>Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm encerrar */}

      {/* ── Modal Lançar Cotas ──────────────────────────────── */}
      {modalCotas && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1100, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
          <div style={{ background:'var(--color-surface)', borderRadius:'var(--radius-xl)', width:'100%', maxWidth:'920px', maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,0.4)', overflow:'hidden' }}>

            {/* Header */}
            <div style={{ padding:'1.1rem 1.4rem', borderBottom:'1px solid var(--color-border)', background:'var(--color-surface-2)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <h3 style={{ fontWeight:700, fontSize:'1rem', color:'var(--color-text)', margin:0 }}>💰 Lançar Cotas — {evento.nome}</h3>
                <p style={{ fontSize:'0.75rem', color:'var(--color-text-muted)', margin:'0.2rem 0 0' }}>
                  Valor/cota: <strong style={{ color:'var(--color-accent)' }}>{fmtR(valorCota)}</strong>
                  {evento.valor_ajustado ? ' (ajustado)' : ' (calculado)'}
                </p>
              </div>
              <button onClick={() => setModalCotas(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--color-text-muted)', fontSize:'1.5rem', lineHeight:1 }}>×</button>
            </div>

            {/* Configurações */}
            <div style={{ padding:'1rem 1.4rem', borderBottom:'1px solid var(--color-border)', display:'flex', flexDirection:'column', gap:'0.75rem' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
                <div>
                  <label style={{ display:'block', fontSize:'0.72rem', fontWeight:600, color:'var(--color-text-muted)', textTransform:'uppercase', marginBottom:'0.25rem' }}>
                    Categoria *
                  </label>
                  <select
                    value={cotasForm.categoria_id}
                    onChange={e => setCotasForm(p => ({ ...p, categoria_id: e.target.value }))}
                    style={{ width:'100%', padding:'0.45rem 0.7rem', background:'var(--color-bg)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-md)', color:'var(--color-text)', fontSize:'0.82rem' }}
                  >
                    <option value="">Selecione...</option>
                    {(() => {
                      const principais = categoriasCotas.filter(c => c.nivel === 1);
                      const opcoes = [];
                      principais.forEach(pai => {
                        opcoes.push(<option key={pai.id} value={pai.id}>{pai.nome}</option>);
                        categoriasCotas
                          .filter(s => s.nivel === 2 && s.categoria_pai_id === pai.id)
                          .forEach(sub => {
                            opcoes.push(<option key={sub.id} value={sub.id}>&nbsp;&nbsp;↳ {sub.nome}</option>);
                          });
                      });
                      return opcoes;
                    })()}
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'0.72rem', fontWeight:600, color:'var(--color-text-muted)', textTransform:'uppercase', marginBottom:'0.25rem' }}>
                    Descrição
                  </label>
                  <input
                    value={cotasForm.descricao}
                    onChange={e => setCotasForm(p => ({ ...p, descricao: e.target.value }))}
                    style={{ width:'100%', padding:'0.45rem 0.7rem', background:'var(--color-bg)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-md)', color:'var(--color-text)', fontSize:'0.82rem', boxSizing:'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'0.72rem', fontWeight:600, color:'var(--color-text-muted)', textTransform:'uppercase', marginBottom:'0.25rem' }}>
                    Data Lançamento
                  </label>
                  <input type="date"
                    value={cotasForm.data_lancamento}
                    onChange={e => setCotasForm(p => ({ ...p, data_lancamento: e.target.value }))}
                    style={{ width:'100%', padding:'0.45rem 0.7rem', background:'var(--color-bg)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-md)', color:'var(--color-text)', fontSize:'0.82rem', boxSizing:'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'0.72rem', fontWeight:600, color:'var(--color-text-muted)', textTransform:'uppercase', marginBottom:'0.25rem' }}>
                    Data Vencimento
                  </label>
                  <input type="date"
                    value={cotasForm.data_vencimento}
                    onChange={e => setCotasForm(p => ({ ...p, data_vencimento: e.target.value }))}
                    style={{ width:'100%', padding:'0.45rem 0.7rem', background:'var(--color-bg)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-md)', color:'var(--color-text)', fontSize:'0.82rem', boxSizing:'border-box' }}
                  />
                </div>
              </div>
            </div>

            {/* Lista de irmãos */}
            <div style={{ flex:1, overflowY:'auto', padding:'0.75rem 1.4rem' }}>
              {/* Barra selecionar todos */}
              <div style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'0.5rem 0', marginBottom:'0.5rem', borderBottom:'1px solid var(--color-border)' }}>
                <label style={{ display:'flex', alignItems:'center', gap:'0.4rem', cursor:'pointer', fontSize:'0.82rem', fontWeight:600, color:'var(--color-text)' }}>
                  <input type="checkbox"
                    checked={participantes.filter(p => p.irmao_id && !cotasJaLancadas[p.irmao_id]).every(p => cotasSelecionadas[p.irmao_id])}
                    onChange={e => {
                      const novo = {};
                      if (e.target.checked) {
                        participantes.filter(p => p.irmao_id && !cotasJaLancadas[p.irmao_id]).forEach(p => { novo[p.irmao_id] = true; });
                      }
                      setCotasSelecionadas(novo);
                    }}
                  />
                  Selecionar todos os pendentes
                </label>
                <span style={{ marginLeft:'auto', fontSize:'0.75rem', color:'var(--color-text-muted)' }}>
                  {Object.values(cotasSelecionadas).filter(Boolean).length} selecionados
                </span>
              </div>

              {participantes.filter(p => p.irmao_id).map(p => {
                const cotas = parseFloat(p.cotas || 1);
                const item = rateio.porParticipante[p.id];
                const valor = item ? item.total : valorCota * cotas;
                const jaLancado = cotasJaLancadas[p.irmao_id];
                const selecionado = !!cotasSelecionadas[p.irmao_id];
                const nomeIrmao = p.irmaos?.nome || irmaos.find(i => i.id === p.irmao_id)?.nome || 'Irmão';
                return (
                  <div key={p.id} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.5rem 0', borderBottom:'1px solid var(--color-surface-2)', opacity: jaLancado ? 0.5 : 1 }}>
                    <input type="checkbox"
                      checked={selecionado}
                      disabled={jaLancado || semCobranca(p)}
                      onChange={e => setCotasSelecionadas(prev => ({ ...prev, [p.irmao_id]: e.target.checked }))}
                      style={{ cursor: jaLancado ? 'not-allowed' : 'pointer' }}
                    />
                    <div style={{ flex:1 }}>
                      <span style={{ fontSize:'0.85rem', fontWeight:600, color:'var(--color-text)' }}>{nomeIrmao}</span>
                      {cotas !== 1 && <span style={{ fontSize:'0.72rem', color:'var(--color-text-muted)', marginLeft:'0.4rem' }}>({cotas} cotas)</span>}
                      {item?.custeador && <span style={{ fontSize:'0.68rem', color:'#8b5cf6', fontWeight:700, marginLeft:'0.4rem' }}>custeador (+{fmtR(item.recebeCusteio)})</span>}
                      {item && !item.custeador && rateio.ativo && p.irmao_id && <span style={{ fontSize:'0.68rem', color: (item.isento || item.personalizado) ? '#f59e0b' : 'var(--color-text-muted)', marginLeft:'0.4rem' }}>{item.isento ? (item.isentoLoja ? 'isento (só Loja)' : 'isento') : `${item.pctProprio}%`}</span>}
                    </div>
                    {jaLancado ? (
                      <span style={{ fontSize:'0.72rem', color:'#10b981', fontWeight:600 }}>✅ Já lançado</span>
                    ) : semCobranca(p) ? (
                      <span style={{ fontSize:'0.72rem', color:'#f59e0b', fontWeight:600 }}>Isento — sem cobrança</span>
                    ) : (
                      <span style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--color-accent)' }}>{fmtR(valor)}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ padding:'1rem 1.4rem', borderTop:'1px solid var(--color-border)', background:'var(--color-surface-2)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:'0.82rem', color:'var(--color-text-muted)' }}>
                Total: <strong style={{ color:'var(--color-accent)', fontSize:'0.95rem' }}>
                  {fmtR(participantes.filter(p => p.irmao_id && !semCobranca(p) && cotasSelecionadas[p.irmao_id]).reduce((s, p) => s + (rateio.porParticipante[p.id]?.total ?? valorCota * parseFloat(p.cotas || 1)), 0))}
                </strong>
                {' · '}
                {Object.values(cotasSelecionadas).filter(Boolean).length} irmão(s)
              </div>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button onClick={() => setModalCotas(false)} style={{ padding:'0.5rem 1rem', borderRadius:'var(--radius-md)', border:'1px solid var(--color-border)', background:'transparent', color:'var(--color-text-muted)', fontSize:'0.875rem', cursor:'pointer' }}>
                  Cancelar
                </button>
                <button onClick={handleLancarCotas} disabled={lancandoCotas || Object.values(cotasSelecionadas).filter(Boolean).length === 0}
                  style={{ padding:'0.5rem 1.25rem', borderRadius:'var(--radius-md)', border:'none', background:'var(--color-success)', color:'white', fontWeight:600, fontSize:'0.875rem', cursor: lancandoCotas ? 'wait' : 'pointer', opacity: Object.values(cotasSelecionadas).filter(Boolean).length === 0 ? 0.5 : 1 }}>
                  {lancandoCotas ? '⏳ Lançando...' : '💰 Lançar para Selecionados'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── Modal Recalcular lançamentos ────────────────────── */}
      {modalRecalc && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1100, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
          <div style={{ background:'var(--color-surface)', borderRadius:'var(--radius-xl)', width:'100%', maxWidth:'900px', maxHeight:'90vh', display:'flex', flexDirection:'column', border:'1px solid var(--color-border)' }}>
            <div style={{ padding:'1.1rem 1.4rem', borderBottom:'1px solid var(--color-border)', background:'var(--color-surface-2)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <h3 style={{ fontWeight:700, fontSize:'1rem', color:'var(--color-text)', margin:0 }}>🔄 Recalcular lançamentos — {evento.nome}</h3>
                <p style={{ fontSize:'0.75rem', color:'var(--color-text-muted)', margin:'0.2rem 0 0' }}>
                  Compara os lançamentos já criados com o cálculo atual (cotas, valor/cota, custeio e % de cada irmão).
                </p>
              </div>
              <button onClick={() => setModalRecalc(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--color-text-muted)', fontSize:'1.5rem', lineHeight:1 }}>×</button>
            </div>
            <div style={{ padding:'1rem 1.4rem', overflowY:'auto', flex:1 }}>
              {divergencias.length === 0 ? (
                <p style={{ textAlign:'center', color:'#10b981', fontWeight:600, padding:'1.5rem 0', margin:0 }}>✅ Todos os lançamentos estão de acordo com o cálculo atual.</p>
              ) : divergencias.map(d => {
                const nome = d.p.irmaos?.nome || irmaos.find(i => i.id === d.p.irmao_id)?.nome || 'Irmão';
                const diff = d.esperado - d.atual;
                const motivo = d.lancs.length > 1 ? 'Há mais de um lançamento para este irmão — ajuste manualmente.'
                  : d.lancs[0].status !== 'pendente' ? `Lançamento já ${d.lancs[0].status} — diferença de ${fmtR(Math.abs(diff))} a ajustar manualmente.`
                  : d.esperado <= 0 ? 'Irmão isento — exclua ou ajuste o lançamento manualmente.' : '';
                return (
                  <div key={d.p.id} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.6rem 0', borderBottom:'1px solid var(--color-surface-2)' }}>
                    <input type="checkbox" disabled={!d.editavel} checked={d.editavel && recalcSel[d.p.id] !== false}
                      onChange={e => setRecalcSel(prev => ({ ...prev, [d.p.id]: e.target.checked }))} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'0.85rem', fontWeight:600, color:'var(--color-text)' }}>{nome}</div>
                      {motivo && <div style={{ fontSize:'0.7rem', color:'#f59e0b' }}>{motivo}</div>}
                    </div>
                    <div style={{ textAlign:'right', fontSize:'0.78rem', lineHeight:1.5 }}>
                      <div style={{ color:'var(--color-text-muted)' }}>lançado {fmtR(d.atual)}</div>
                      <div style={{ color:'var(--color-accent)', fontWeight:700 }}>correto {fmtR(d.esperado)}</div>
                      <div style={{ color: diff > 0 ? '#ef4444' : '#3b82f6', fontWeight:700 }}>{diff > 0 ? '+' : '−'}{fmtR(Math.abs(diff))}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ padding:'1rem 1.4rem', borderTop:'1px solid var(--color-border)', background:'var(--color-surface-2)', display:'flex', justifyContent:'flex-end', gap:'0.5rem' }}>
              <button onClick={() => setModalRecalc(false)} style={{ padding:'0.5rem 1rem', borderRadius:'var(--radius-md)', border:'1px solid var(--color-border)', background:'transparent', color:'var(--color-text-muted)', fontSize:'0.875rem', cursor:'pointer' }}>Fechar</button>
              <button onClick={aplicarRecalculo} disabled={recalculando || divergencias.filter(d => d.editavel && recalcSel[d.p.id] !== false).length === 0}
                style={{ padding:'0.5rem 1.25rem', borderRadius:'var(--radius-md)', border:'none', background:'var(--color-success)', color:'white', fontWeight:600, fontSize:'0.875rem', cursor: recalculando ? 'wait' : 'pointer', opacity: divergencias.filter(d => d.editavel && recalcSel[d.p.id] !== false).length === 0 ? 0.5 : 1 }}>
                {recalculando ? '⏳ Atualizando...' : '🔄 Atualizar lançamentos pendentes'}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmEncerrar && (
        <div style={overlay}>
          <div style={modalBox('420px')}>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>🔒 Encerrar Evento?</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
                Após encerrado, novos participantes e despesas não poderão ser adicionados. O rateio ficará registrado permanentemente.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setConfirmEncerrar(false)} style={{ padding: '0.55rem 1.1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleEncerrar} style={{ ...btnPrimary, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444' }}>🔒 Confirmar Encerramento</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ─────────────────────────────────────────────
//  Componente Principal
// ─────────────────────────────────────────────
// Busca todas as linhas, em blocos de 1000 (limite do Supabase)
const paginarTodos = async (montar) => {
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

const Indicador = ({ rotulo, valor, sub, cor = 'var(--color-text)' }) => (
  <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.55rem 0.7rem', minWidth: 0 }}>
    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{rotulo}</div>
    <div style={{ fontSize: '1rem', fontWeight: 800, color: cor, marginTop: '0.1rem', overflowWrap: 'anywhere' }}>{valor}</div>
    {sub && <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: '0.1rem', lineHeight: 1.3 }}>{sub}</div>}
  </div>
);

const ChipPessoas = ({ children }) => (
  <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 600, background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border-light)' }}>
    {children}
  </span>
);

export default function EventosComemorativos({ showSuccess, showError, podeEditar = false }) {
  const [eventos, setEventos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [eventoAtivo, setEventoAtivo] = useState(null);
  const [modalNovo, setModalNovo] = useState(false);
  const [irmaos, setIrmaos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [filtroAno, setFiltroAno] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [confirmExcluir, setConfirmExcluir] = useState(null);
  const [resumos, setResumos] = useState({});            // indicadores por evento (cartões da lista)
  const [carregandoResumos, setCarregandoResumos] = useState(false);

  // Participantes, despesas e cotas lançadas de todos os eventos, em lote
  const carregarResumos = async (lista) => {
    if (!lista || lista.length === 0) { setResumos({}); return; }
    setCarregandoResumos(true);
    try {
      const ids = lista.map(e => e.id);
      const [parts, lancs] = await Promise.all([
        paginarTodos(() => supabase.from('evento_rateio_participantes').select('*').in('evento_id', ids).order('id')),
        paginarTodos(() => supabase.from('lancamentos_loja')
          .select('id,evento_comemorativo_id,origem_tipo,origem_irmao_id,tipo,valor,status')
          .in('evento_comemorativo_id', ids).in('origem_tipo', ['Loja', 'Irmao']).order('id')),
      ]);
      const porPart = {}; const porLanc = {};
      parts.forEach(x => { (porPart[x.evento_id] = porPart[x.evento_id] || []).push(x); });
      lancs.forEach(x => { (porLanc[x.evento_comemorativo_id] = porLanc[x.evento_comemorativo_id] || []).push(x); });
      const mapa = {};
      lista.forEach(ev => { mapa[ev.id] = resumirEvento(ev, porPart[ev.id], porLanc[ev.id]); });
      setResumos(mapa);
    } catch (e) {
      console.error('Erro ao calcular os indicadores dos eventos:', e);
      setResumos({});
    } finally {
      setCarregandoResumos(false);
    }
  };

  const carregarEventos = async () => {
    setCarregando(true);
    const { data } = await supabase.from('eventos_comemorativos_fin').select('*').order('ano', { ascending: false }).order('data_evento', { ascending: false });
    setEventos(data || []);
    setCarregando(false);
    carregarResumos(data || []);
  };

  const carregarIrmaos = async () => {
    const { data } = await supabase.from('irmaos').select('id, nome, situacao').order('nome');
    setIrmaos(data || []);
  };

  const carregarCategorias = async () => {
    const { data } = await supabase
      .from('categorias_financeiras')
      .select('*')
      .eq('ativo', true)
      .order('tipo')
      .order('nivel')
      .order('ordem')
      .order('nome');
    // Filtrar apenas receitas
    setCategorias((data || []).filter(c => c.tipo === 'receita'));
  };

  useEffect(() => { carregarEventos(); carregarIrmaos(); carregarCategorias(); }, []);

  const anos = [...new Set(eventos.map(e => e.ano))].sort((a, b) => b - a);

  const eventosFiltrados = eventos
    .filter(e => filtroAno === 'todos' || e.ano === parseInt(filtroAno))
    .filter(e => filtroStatus === 'todos' || e.status === filtroStatus);

  const handleCriarEvento = async (form) => {
    const { data, error } = await supabase.from('eventos_comemorativos_fin').insert({
      nome: form.nome.trim(), ano: form.ano,
      data_evento: form.data_evento || null,
      descricao: form.descricao || null,
      idade_gratuita: form.idade_gratuita,
      idade_meia: form.idade_meia,
      valor_ajustado: form.valor_ajustado ? parseFloat(form.valor_ajustado) : null,
      contribuicao_loja: form.contribuicao_loja ? parseFloat(form.contribuicao_loja) : null,
      custeio_percentual_irmao: form.custeio_percentual_irmao ? parseFloat(form.custeio_percentual_irmao) : null,
    }).select().single();
    if (error) throw error;
    showSuccess('🎉 Evento criado!');
    setModalNovo(false);
    await carregarEventos();
    setEventoAtivo(data);
  };

  const handleExcluir = async () => {
    const { error } = await supabase.from('eventos_comemorativos_fin').delete().eq('id', confirmExcluir.id);
    if (!error) { setConfirmExcluir(null); showSuccess('🗑️ Evento excluído.'); carregarEventos(); }
    else showError('Erro ao excluir.');
  };

  if (eventoAtivo) {
    return (
      <div style={{ padding: '1.5rem clamp(0.75rem, 5vw, 2cm)', maxWidth: 'none', margin: 0 }}>
        <style>{CSS_GRADE}</style>
        <DetalheEvento
          evento={eventoAtivo}
          onVoltar={() => { setEventoAtivo(null); carregarEventos(); }}
          irmaos={irmaos}
          showSuccess={showSuccess}
          showError={showError}
          podeEditar={podeEditar}
          categorias={categorias}
          onEventoAtualizado={carregarEventos}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem clamp(0.75rem, 5vw, 2cm)', maxWidth: 'none', margin: 0 }}>
      <style>{CSS_GRADE}</style>

      {/* Cabeçalho */}
      <div style={{ ...card, marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-lg)', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
              🎉
            </div>
            <div>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.15rem' }}>Eventos Comemorativos</h1>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Controle financeiro e rateio de eventos da loja</p>
            </div>
          </div>
          {podeEditar && <button onClick={() => setModalNovo(true)} style={btnPrimary}>🎉 Novo Evento</button>}
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select style={{ ...inp, width: 'auto', minWidth: '130px' }} value={filtroAno} onChange={e => setFiltroAno(e.target.value)}>
            <option value="todos">Todos os Anos</option>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select style={{ ...inp, width: 'auto', minWidth: '160px' }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="todos">Todos os Status</option>
            <option value="aberto">⚙️ Em Aberto</option>
            <option value="encerrado">✅ Encerrado</option>
          </select>
          <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.82rem', color: 'var(--color-text-muted)', paddingLeft: '0.25rem' }}>
            {eventosFiltrados.length} evento{eventosFiltrados.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Totais dos eventos filtrados */}
      {!carregando && eventosFiltrados.length > 0 && (() => {
        const rs = eventosFiltrados.map(e => resumos[e.id]).filter(Boolean);
        if (rs.length === 0) return null;
        const soma = (k) => rs.reduce((acc, r) => acc + (r[k] || 0), 0);
        return (
          <GradeIndicadores n={5} style={{ marginBottom: '0.9rem' }}>
            <Indicador rotulo="Eventos" valor={eventosFiltrados.length} sub={filtroAno === 'todos' ? 'todos os anos' : `ano ${filtroAno}`} />
            <Indicador rotulo="Total gasto" valor={fmtR(soma('totalDespesas'))} sub="despesas dos eventos" cor="#ef4444" />
            <Indicador rotulo="Custeado pelos irmãos" valor={fmtR(soma('cobradoIrmaos'))} sub="família + convidados deles" cor="#10b981" />
            <Indicador rotulo="A cargo da Loja" valor={fmtR(soma('lojaTotal'))} sub="visitantes, descontos e contribuição" cor="#6366f1" />
            <Indicador rotulo="Recebido dos irmãos" valor={fmtR(soma('recebido'))} sub={`pendente ${fmtR(soma('pendente'))}`} cor="#3b82f6" />
          </GradeIndicadores>
        );
      })()}

      {/* Loading */}
      {carregando && <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>Carregando eventos...</div>}

      {/* Vazio */}
      {!carregando && eventosFiltrados.length === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: '3rem', border: '1px dashed var(--color-border)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎉</div>
          <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.25rem' }}>Nenhum evento encontrado</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Clique em "🎉 Novo Evento" para começar.</p>
        </div>
      )}

      {/* Lista */}
      {!carregando && eventosFiltrados.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {eventosFiltrados.map(ev => {
            const encerrado = ev.status === 'encerrado';
            return (
              <div key={ev.id} style={{ ...card, borderLeft: `4px solid ${encerrado ? '#10b981' : '#f59e0b'}`, cursor: 'pointer', transition: 'border-color 0.15s' }}
                onClick={() => setEventoAtivo(ev)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>{ev.nome}</span>
                      <span style={{ padding: '0.12rem 0.55rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, background: 'rgba(201,168,76,0.12)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.3)' }}>{ev.ano}</span>
                      <span style={{ padding: '0.12rem 0.55rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, background: encerrado ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', color: encerrado ? '#10b981' : '#f59e0b', border: encerrado ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(245,158,11,0.3)' }}>
                        {encerrado ? '✅ Encerrado' : '⚙️ Em Aberto'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                      {ev.data_evento && <span>📅 {fmtD(ev.data_evento)}</span>}
                      {ev.descricao && <span>📝 {ev.descricao}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => setEventoAtivo(ev)} style={{ ...btnEdit, padding: '0.4rem 0.75rem' }}>👁️ Abrir</button>
                    {podeEditar && <button onClick={() => setConfirmExcluir(ev)} style={{ ...btnDanger, padding: '0.4rem 0.6rem' }}>🗑️</button>}
                  </div>
                </div>

                {(() => {
                  const r = resumos[ev.id];
                  if (!r) {
                    return carregandoResumos
                      ? <p style={{ margin: '0.75rem 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Calculando indicadores...</p>
                      : null;
                  }
                  const totalPessoas = r.pessoasFamilia + r.pessoasConvIrmaos + r.pessoasExternos;
                  const pctRec = r.cobradoIrmaos > 0 ? Math.min(100, (r.recebido / r.cobradoIrmaos) * 100) : 0;
                  const pctPend = r.cobradoIrmaos > 0 ? Math.min(100 - pctRec, (r.pendente / r.cobradoIrmaos) * 100) : 0;
                  return (
                    <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                      {/* Pessoas */}
                      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <ChipPessoas>👤 Total: <strong>{totalPessoas}</strong> pessoas</ChipPessoas>
                        <ChipPessoas>👥 Família maçônica: <strong>{r.qtdIrmaos}</strong> irmãos · <strong>{r.pessoasFamilia}</strong> pessoas</ChipPessoas>
                        <ChipPessoas>🎟️ Convidados dos irmãos: <strong>{r.pessoasConvIrmaos}</strong></ChipPessoas>
                        <ChipPessoas>🌍 Visitantes/externos: <strong>{r.pessoasExternos}</strong></ChipPessoas>
                      </div>

                      {/* Valores */}
                      <GradeIndicadores n={r.custeioAtivo ? 7 : 6}>
                        <Indicador rotulo="Valor total do evento"
                          valor={r.totalDespesas > 0 ? fmtR(r.totalDespesas) : '—'}
                          sub={r.totalDespesas > 0 ? `${r.totalCotas.toFixed(1)} cotas` : 'sem despesas lançadas'} />
                        <Indicador rotulo="Valor da cota"
                          valor={r.valorCota > 0 ? fmtR(r.valorCota) : '—'}
                          sub={r.valorCota > 0 ? (r.valorAjustado ? 'ajustado' : 'calculado pelas despesas') : '—'} />
                        <Indicador rotulo="Custeado pelos irmãos" valor={fmtR(r.irmaosFamiliaValor)} sub="família dos irmãos" cor="#10b981" />
                        <Indicador rotulo="Convidados dos irmãos" valor={fmtR(r.convIrmaosValor)} sub="pago pelo próprio irmão" cor="#f59e0b" />
                        <Indicador rotulo="Visitantes/externos" valor={fmtR(r.externosValor)} sub="custeado pela Loja" cor="#6366f1" />
                        {r.custeioAtivo && <Indicador rotulo="Custeadores" valor={fmtR(r.custeioPool)} sub="famílias dos irmãos" cor="#8b5cf6" />}
                        <Indicador rotulo="A cargo da Loja" valor={fmtR(r.lojaTotal)}
                          sub={`visitantes${r.custeioAtivo ? ' + descontos' : ''}${r.contribuicaoLoja > 0 ? ' + contribuição' : ''}`} cor="#6366f1" />
                      </GradeIndicadores>

                      {/* Recebimento */}
                      {r.cobradoIrmaos > 0 && (
                        <div>
                          <div style={{ display: 'flex', height: '8px', borderRadius: '999px', overflow: 'hidden', background: 'var(--color-border)' }}>
                            <div style={{ width: `${pctRec}%`, background: '#10b981' }} />
                            <div style={{ width: `${pctPend}%`, background: '#f59e0b' }} />
                          </div>
                          <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', marginTop: '0.4rem', fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                            <span>✅ Recebido <strong style={{ color: '#10b981' }}>{fmtR(r.recebido)}</strong> de {fmtR(r.cobradoIrmaos)} ({Math.round(pctRec)}%)</span>
                            <span>⏳ Pendente <strong style={{ color: '#f59e0b' }}>{fmtR(r.pendente)}</strong></span>
                            <span>📝 Falta lançar <strong style={{ color: 'var(--color-text)' }}>{fmtR(r.faltaLancar)}</strong></span>
                            <span>{r.irmaosLancados}/{r.irmaosCobraveis} irmãos com cota lançada</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* Modais */}
      <ModalEvento aberto={modalNovo} onFechar={() => setModalNovo(false)} onSalvar={handleCriarEvento} eventoEdit={null} />

      {confirmExcluir && (
        <div style={overlay}>
          <div style={modalBox('420px')}>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Excluir evento?</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--color-text)' }}>{confirmExcluir.nome} {confirmExcluir.ano}</strong> e todos os participantes do rateio serão excluídos permanentemente.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setConfirmExcluir(null)} style={{ padding: '0.55rem 1.1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleExcluir} style={{ ...btnDanger, padding: '0.55rem 1.25rem', fontWeight: 600 }}>Confirmar Exclusão</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
