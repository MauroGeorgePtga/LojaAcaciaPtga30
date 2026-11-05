import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import SeletorTema from '../configuracoes/SeletorTema';

export default function DadosLoja({ showSuccess, showError }) {
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [simboloPreview, setSimboloPreview] = useState(null);
  
  const [dadosLoja, setDadosLoja] = useState({
    nome_loja: '',
    numero_loja: '',
    endereco: '',
    cidade: '',
    estado: '',
    cep: '',
    telefone: '',
    email: '',
    data_fundacao: '',
    potencia: '',
    grande_loja: '',
    oriente: '',
    vale: '',
    logo_url: '',
    simbolo_masonico_url: '',
    // Novos campos
    cnpj: '',
    nome_cartorio: 'ILMª. SRª. TABELIÃ DO CARTÓRIO DE NOTAS, PROTESTO DE TÍTULOS, REGISTRO CIVIL DAS PESSOAS NATURAIS E JURÍDICAS DE PARANATINGA - MT – 2º SERVIÇO NOTORIAL E REGISTRAL',
    numero_registro_cartorio: '04, do Livro A-01',
    // Dados da GLEMT (mudam a cada gestão)
    glemt_gestao: '', glemt_grao_mestre: '', glemt_grao_mestre_adjunto: '',
    glemt_grande_orador: '', glemt_grande_secretario: '', glemt_grande_tesoureiro: '',
    glemt_endereco: '', glemt_email: '', glemt_site: '',
  });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const { data, error } = await supabase
        .from('dados_loja')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setDadosLoja(prev => ({ ...prev, ...data }));
        if (data.logo_url) setLogoPreview(data.logo_url);
        if (data.simbolo_masonico_url) setSimboloPreview(data.simbolo_masonico_url);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setDadosLoja(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showError('Selecione uma imagem válida'); return; }
    if (file.size > 2 * 1024 * 1024) { showError('A imagem deve ter no máximo 2MB'); return; }
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result);
      setDadosLoja(prev => ({ ...prev, logo_url: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSimboloUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showError('Selecione uma imagem válida'); return; }
    if (file.size > 2 * 1024 * 1024) { showError('A imagem deve ter no máximo 2MB'); return; }
    const reader = new FileReader();
    reader.onloadend = () => {
      setSimboloPreview(reader.result);
      setDadosLoja(prev => ({ ...prev, simbolo_masonico_url: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const salvar = async () => {
    try {
      const { data: existing } = await supabase.from('dados_loja').select('id').single();
      let error;
      if (existing) {
        ({ error } = await supabase.from('dados_loja').update(dadosLoja).eq('id', existing.id));
      } else {
        ({ error } = await supabase.from('dados_loja').insert([dadosLoja]));
      }
      if (error) throw error;
      showSuccess('Dados da loja salvos com sucesso!');
      setEditando(false);
      carregarDados();
    } catch (error) {
      showError('Erro ao salvar: ' + error.message);
    }
  };

  const btnPrimario = {
    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.75rem 1.5rem', fontSize: '0.875rem', fontWeight: '600',
    color: 'white', background: 'var(--color-accent)', border: 'none',
    borderRadius: 'var(--radius-lg)', cursor: 'pointer', transition: 'all 0.2s ease',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  };
  const btnSecundario = {
    ...btnPrimario,
    color: 'var(--color-text)', background: 'var(--color-surface-2)',
    border: '2px solid var(--color-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  };
  const btnSucesso = {
    ...btnPrimario,
    background: 'var(--color-success)', boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
  };

  const secaoTitulo = (emoji, titulo) => (
    <div style={{
      gridColumn: '1 / -1',
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      paddingBottom: '0.5rem',
      borderBottom: '2px solid var(--color-accent)',
      marginTop: '0.5rem',
    }}>
      <span>{emoji}</span>
      <span style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {titulo}
      </span>
    </div>
  );

  if (loading) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--color-text)' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p style={{ marginTop: '1rem', color: 'var(--color-text-muted)' }}>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-8 py-6 min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <p style={{ color: 'var(--color-text-muted)' }}>Dados e configurações da Loja</p>
        {!editando ? (
          <button style={btnPrimario} onClick={() => setEditando(true)}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 6px 20px rgba(0,0,0,0.25)'; }}
            onMouseLeave={e => { e.target.style.transform = ''; e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; }}
          >✏️ Editar</button>
        ) : (
          <div className="flex gap-2">
            <button style={btnSecundario} onClick={() => { setEditando(false); carregarDados(); }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--color-surface-2)'}
            >Cancelar</button>
            <button style={btnSucesso} onClick={salvar}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(16,185,129,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 12px rgba(16,185,129,0.3)'; }}
            >💾 Salvar</button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {secaoTitulo('🖼️', 'Identidade Visual')}

          {/* Logo */}
          <div>
            <label className="form-label">Logo da Loja</label>
            <div className="flex items-center gap-4">
              {logoPreview && (
                <div className="w-32 h-32 border-2 rounded-lg overflow-hidden flex items-center justify-center"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
                  <img src={logoPreview} alt="Logo" className="max-w-full max-h-full object-contain" />
                </div>
              )}
              {editando && (
                <div>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="file-input" />
                  <p className="form-hint">PNG, JPG (máx. 2MB)</p>
                </div>
              )}
            </div>
          </div>

          {/* Símbolo */}
          <div>
            <label className="form-label">⚜️ Símbolo Maçônico</label>
            <div className="flex items-center gap-4">
              {simboloPreview && (
                <div className="w-32 h-32 border-2 rounded-lg overflow-hidden flex items-center justify-center"
                  style={{ borderColor: 'var(--color-accent)', backgroundColor: 'var(--color-accent-bg)' }}>
                  <img src={simboloPreview} alt="Símbolo" className="max-w-full max-h-full object-contain" />
                </div>
              )}
              {editando && (
                <div>
                  <input type="file" accept="image/*" onChange={handleSimboloUpload} className="file-input" />
                  <p className="form-hint">PNG com fundo transparente (máx. 2MB)</p>
                </div>
              )}
            </div>
          </div>

          <div /> {/* espaço */}

          {secaoTitulo('🏛️', 'Identificação da Loja')}

          <div>
            <label className="form-label">Nome da Loja *</label>
            <input type="text" name="nome_loja" value={dadosLoja.nome_loja} onChange={handleChange}
              disabled={!editando} className="form-input" placeholder="Ex: Acácia de Paranatinga" />
          </div>

          <div>
            <label className="form-label">Número *</label>
            <input type="text" name="numero_loja" value={dadosLoja.numero_loja} onChange={handleChange}
              disabled={!editando} className="form-input" placeholder="Ex: 30" />
          </div>

          <div>
            <label className="form-label">CNPJ</label>
            <input type="text" name="cnpj" value={dadosLoja.cnpj} onChange={handleChange}
              disabled={!editando} className="form-input" placeholder="00.000.000/0000-00" />
          </div>

          <div>
            <label className="form-label">Data de Fundação</label>
            <input type="date" name="data_fundacao" value={dadosLoja.data_fundacao} onChange={handleChange}
              disabled={!editando} className="form-input" />
          </div>

          <div>
            <label className="form-label">Potência Maçônica</label>
            <input type="text" name="potencia" value={dadosLoja.potencia} onChange={handleChange}
              disabled={!editando} className="form-input" placeholder="Ex: Grande Oriente do Brasil" />
          </div>

          <div>
            <label className="form-label">Grande Loja</label>
            <input type="text" name="grande_loja" value={dadosLoja.grande_loja} onChange={handleChange}
              disabled={!editando} className="form-input" placeholder="Ex: GLEMT" />
          </div>

          <div>
            <label className="form-label">Oriente</label>
            <input type="text" name="oriente" value={dadosLoja.oriente} onChange={handleChange}
              disabled={!editando} className="form-input" placeholder="Ex: Paranatinga" />
          </div>

          <div>
            <label className="form-label">Vale</label>
            <input type="text" name="vale" value={dadosLoja.vale} onChange={handleChange}
              disabled={!editando} className="form-input" placeholder="Ex: Cuiabá" />
          </div>

          {secaoTitulo('📍', 'Endereço e Contato')}

          <div className="md:col-span-2">
            <label className="form-label">Endereço</label>
            <input type="text" name="endereco" value={dadosLoja.endereco} onChange={handleChange}
              disabled={!editando} className="form-input" placeholder="Avenida, Rua, número, bairro" />
          </div>

          <div>
            <label className="form-label">Cidade</label>
            <input type="text" name="cidade" value={dadosLoja.cidade} onChange={handleChange}
              disabled={!editando} className="form-input" placeholder="Ex: Paranatinga" />
          </div>

          <div>
            <label className="form-label">Estado</label>
            <input type="text" name="estado" value={dadosLoja.estado} onChange={handleChange}
              disabled={!editando} className="form-input" placeholder="MT" maxLength={2} />
          </div>

          <div>
            <label className="form-label">CEP</label>
            <input type="text" name="cep" value={dadosLoja.cep} onChange={handleChange}
              disabled={!editando} className="form-input" placeholder="00000-000" />
          </div>

          <div>
            <label className="form-label">Telefone</label>
            <input type="text" name="telefone" value={dadosLoja.telefone} onChange={handleChange}
              disabled={!editando} className="form-input" placeholder="(00) 00000-0000" />
          </div>

          <div>
            <label className="form-label">E-mail</label>
            <input type="email" name="email" value={dadosLoja.email} onChange={handleChange}
              disabled={!editando} className="form-input" placeholder="contato@loja.com.br" />
          </div>

          {secaoTitulo('🏢', 'Dados para Cartório (Registro de PJ)')}

          <div className="md:col-span-3">
            <label className="form-label">Nome / Destinatário do Cartório</label>
            <input type="text" name="nome_cartorio" value={dadosLoja.nome_cartorio} onChange={handleChange}
              disabled={!editando} className="form-input"
              placeholder="ILMª. SRª. TABELIÃ DO CARTÓRIO..." />
            <p className="form-hint">Usado no cabeçalho dos requerimentos</p>
          </div>

          <div className="md:col-span-2">
            <label className="form-label">Número do Registro no Cartório</label>
            <input type="text" name="numero_registro_cartorio" value={dadosLoja.numero_registro_cartorio}
              onChange={handleChange} disabled={!editando} className="form-input"
              placeholder="Ex: 04, do Livro A-01" />
            <p className="form-hint">Aparece nos requerimentos de averbação da ata de eleição</p>
          </div>

        </div>
      </div>

      {/* DADOS DA GLEMT */}
      <div className="card mt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {secaoTitulo('🏛️', 'Grande Loja Maçônica do Estado de Mato Grosso — GLEMT')}

          <div>
            <label className="form-label">Gestão</label>
            <input type="text" name="glemt_gestao" value={dadosLoja.glemt_gestao || ''} onChange={handleChange}
              disabled={!editando} className="form-input" placeholder="Ex: 2027/2030" />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Sereníssimo Grão-Mestre</label>
            <input type="text" name="glemt_grao_mestre" value={dadosLoja.glemt_grao_mestre || ''} onChange={handleChange}
              disabled={!editando} className="form-input" placeholder="Nome completo" />
          </div>

          <div className="md:col-span-3">
            <label className="form-label">Grão-Mestre Adjunto</label>
            <input type="text" name="glemt_grao_mestre_adjunto" value={dadosLoja.glemt_grao_mestre_adjunto || ''} onChange={handleChange}
              disabled={!editando} className="form-input" placeholder="Nome completo" />
          </div>

          <div>
            <label className="form-label">Grande Orador</label>
            <input type="text" name="glemt_grande_orador" value={dadosLoja.glemt_grande_orador || ''} onChange={handleChange}
              disabled={!editando} className="form-input" />
          </div>
          <div>
            <label className="form-label">Grande Secretário</label>
            <input type="text" name="glemt_grande_secretario" value={dadosLoja.glemt_grande_secretario || ''} onChange={handleChange}
              disabled={!editando} className="form-input" />
          </div>
          <div>
            <label className="form-label">Grande Tesoureiro</label>
            <input type="text" name="glemt_grande_tesoureiro" value={dadosLoja.glemt_grande_tesoureiro || ''} onChange={handleChange}
              disabled={!editando} className="form-input" />
          </div>

          <div className="md:col-span-3">
            <label className="form-label">Endereço</label>
            <input type="text" name="glemt_endereco" value={dadosLoja.glemt_endereco || ''} onChange={handleChange}
              disabled={!editando} className="form-input" placeholder="Rua, nº, bairro, cidade-UF" />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">E-mail</label>
            <input type="email" name="glemt_email" value={dadosLoja.glemt_email || ''} onChange={handleChange}
              disabled={!editando} className="form-input" />
          </div>
          <div>
            <label className="form-label">Site</label>
            <input type="text" name="glemt_site" value={dadosLoja.glemt_site || ''} onChange={handleChange}
              disabled={!editando} className="form-input" placeholder="www.glemt.org.br" />
          </div>
        </div>
      </div>

      {/* SELETOR DE TEMA */}
      <div className="mt-8">
        <SeletorTema />
      </div>
    </div>
  );
}
