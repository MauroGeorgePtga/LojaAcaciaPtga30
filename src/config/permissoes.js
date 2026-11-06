// ════════════════════════════════════════════════════════════════════════
// PERMISSÕES POR MÓDULO — catálogo único do sistema
//
// usuarios.permissoes (jsonb) = { modulo: 'ver' | 'editar' }   (ausente = nenhum)
//
// • Admin e Venerável: tudo liberado.
// • Tesoureiro / Tesoureiro Adjunto: financeiro 'editar' automático.
// • Módulo com base 'ver': todo mundo vê; só quem tem 'editar' manipula.
// • Se o usuário ainda não tem o jsonb, as permissões são derivadas das
//   colunas antigas pode_* (assim nada quebra durante a migração).
// ════════════════════════════════════════════════════════════════════════

export const NIVEIS = ['nenhum', 'ver', 'editar'];
const ORDEM_NIVEL = { nenhum: 0, ver: 1, editar: 2 };

// niveis = opções exibidas na tela de Usuários; base = mínimo que todos têm
export const MODULOS = [
  { id: 'cadastro_irmaos',     label: 'Cadastro de Irmãos',        icone: '👥', grupo: 'Irmãos',        niveis: ['nenhum', 'ver', 'editar'], base: 'nenhum', ajuda: 'Ver = Quadro de irmãos · Editar = cadastrar/editar irmãos' },
  { id: 'comendas',            label: 'Comendas',                  icone: '🎖️', grupo: 'Irmãos',        niveis: ['ver', 'editar'],           base: 'ver' },
  { id: 'corpo_admin',         label: 'Administração / Eleição',   icone: '📋', grupo: 'Irmãos',        niveis: ['ver', 'editar'],           base: 'ver' },
  { id: 'balaustres',          label: 'Balaustres',                icone: '📜', grupo: 'Expedientes',   niveis: ['ver', 'editar'],           base: 'ver' },
  { id: 'pranchas',            label: 'Pranchas',                  icone: '📄', grupo: 'Expedientes',   niveis: ['ver', 'editar'],           base: 'ver' },
  { id: 'financeiro',          label: 'Controle Financeiro',       icone: '💰', grupo: 'Financeiro',    niveis: ['nenhum', 'ver', 'editar'], base: 'nenhum', ajuda: 'Inclui edição do Ágape & Festas' },
  { id: 'comodatos',           label: 'Comodatos',                 icone: '♿', grupo: 'Filantropia',   niveis: ['ver', 'editar'],           base: 'ver' },
  { id: 'caridade',            label: 'Caridade',                  icone: '❤️', grupo: 'Filantropia',   niveis: ['ver', 'editar'],           base: 'ver' },
  { id: 'eventos_filantropia', label: 'Eventos (Filantropia)',     icone: '🎉', grupo: 'Filantropia',   niveis: ['ver', 'editar'],           base: 'ver' },
  { id: 'projetos',            label: 'Projeto/Campanha',          icone: '📊', grupo: 'Geral',         niveis: ['ver', 'editar'],           base: 'ver' },
  { id: 'comissoes',           label: 'Comissões',                 icone: '🤝', grupo: 'Geral',         niveis: ['ver', 'editar'],           base: 'ver' },
  { id: 'biblioteca',          label: 'Biblioteca (e Online)',     icone: '📚', grupo: 'Geral',         niveis: ['ver', 'editar'],           base: 'ver' },
  { id: 'cronograma',          label: 'Cronograma',                icone: '📅', grupo: 'Geral',         niveis: ['ver', 'editar'],           base: 'ver' },
  { id: 'email',               label: 'Central E-Mail',            icone: '📧', grupo: 'Geral',         niveis: ['ver', 'editar'],           base: 'ver', ajuda: 'Editar = enviar e-mails' },
  { id: 'presenca',            label: 'Presença Irmãos',           icone: '✅', grupo: 'Presença',      niveis: ['nenhum', 'editar'],        base: 'nenhum', ajuda: 'Sessões e registro de presença' },
  { id: 'usuarios',            label: 'Gestão do Sistema',         icone: '🔐', grupo: 'Sistema',       niveis: ['nenhum', 'editar'],        base: 'nenhum', ajuda: 'Usuários, logs, graus e acesso das cunhadas' },
  { id: 'modelos',             label: 'Modelos de Documentos',     icone: '📝', grupo: 'Sistema',       niveis: ['nenhum', 'editar'],        base: 'nenhum', ajuda: 'Editar textos de editais, atas, requerimentos…' },
  { id: 'arco_real',           label: 'Arco Real',                 icone: '🔺', grupo: 'Sistema',       niveis: ['nenhum', 'ver'],           base: 'nenhum' },
];

const MOD = Object.fromEntries(MODULOS.map(m => [m.id, m]));

export const normCargo = (c) => String(c || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/_/g, ' ').trim();

export const ehAdminTotal = (u) => {
  if (!u) return false;
  const c = normCargo(u.cargo);
  return u.nivel_acesso === 'admin' || c === 'veneravel' || c === 'veneravel mestre' || c === 'administrador';
};
export const ehTesoureiro = (u) => normCargo(u?.cargo).includes('tesoureiro');

// Converte as colunas antigas pode_* no mapa de módulos (mesma regra da migração SQL)
export const derivarDoLegado = (u = {}) => {
  const ed = (flag) => (flag ? 'editar' : 'ver');
  const c = normCargo(u.cargo);
  const m = {
    cadastro_irmaos: u.pode_editar_cadastros ? 'editar' : (u.nivel_acesso === 'cargo' ? 'ver' : 'nenhum'),
    comendas: ['veneravel', 'veneravel mestre', 'orador', 'secretario', 'administrador'].includes(c) ? 'editar' : 'ver',
    corpo_admin: ed(u.pode_editar_corpo_admin),
    balaustres: ed(u.pode_editar_balaustres),
    pranchas: ed(u.pode_editar_pranchas),
    financeiro: u.pode_editar_financeiro ? 'editar' : (u.pode_visualizar_financeiro ? 'ver' : 'nenhum'),
    comodatos: ed(u.pode_editar_comodatos),
    caridade: ed(u.pode_editar_caridade),
    eventos_filantropia: ed(u.pode_gerenciar_usuarios),
    projetos: ed(u.pode_editar_cadastros),
    comissoes: ed(u.pode_editar_comissoes),
    biblioteca: ed(u.pode_editar_biblioteca),
    cronograma: ed(u.pode_editar_cadastros),
    email: ed(u.pode_editar_financeiro || u.pode_gerenciar_usuarios),
    presenca: u.pode_editar_presenca ? 'editar' : 'nenhum',
    usuarios: u.pode_gerenciar_usuarios ? 'editar' : 'nenhum',
    arco_real: u.pode_visualizar_arco_real ? 'ver' : 'nenhum',
    modelos: c === 'secretario' ? 'editar' : 'nenhum', // padrão: Secretário (Admin/VM já têm tudo)
  };
  return limparMapa(m);
};

// Remove 'nenhum' e níveis inválidos para o módulo
export const limparMapa = (mapa = {}) => {
  const out = {};
  Object.entries(mapa || {}).forEach(([id, nivel]) => {
    if (MOD[id] && MOD[id].niveis.includes(nivel) && nivel !== 'nenhum') out[id] = nivel;
  });
  return out;
};

// Mapa final do usuário logado, já com as regras fixas
export const permissoesEfetivas = (u) => {
  if (!u) return {};
  if (ehAdminTotal(u)) return Object.fromEntries(MODULOS.map(m => [m.id, m.niveis[m.niveis.length - 1]]));
  const base = u.permissoes && typeof u.permissoes === 'object' ? limparMapa(u.permissoes) : derivarDoLegado(u);
  const mapa = { ...base };
  MODULOS.forEach(m => {
    if (ORDEM_NIVEL[m.base] > ORDEM_NIVEL[mapa[m.id] || 'nenhum']) mapa[m.id] = m.base;
  });
  if (ehTesoureiro(u)) mapa.financeiro = 'editar';
  return mapa;
};

export const pode = (mapa, modulo, nivel = 'ver') => ORDEM_NIVEL[mapa?.[modulo] || 'nenhum'] >= ORDEM_NIVEL[nivel];

// Objeto no formato antigo (permissoes.canEdit, pode_editar_*, ...) — os
// componentes continuam lendo as mesmas chaves, sem alteração.
export const montarPermissoesLegado = (mapa, u) => {
  const ed = (id) => pode(mapa, id, 'editar');
  const admin = ehAdminTotal(u);
  return {
    canEdit: ed('cadastro_irmaos'),
    canEditMembers: ed('cadastro_irmaos'),
    canDelete: admin || (u?.nivel_acesso === 'cargo' && ed('cadastro_irmaos')),
    canManageUsers: ed('usuarios'),
    canViewFinancial: pode(mapa, 'financeiro', 'ver'),
    canEditFinancial: ed('financeiro'),
    canViewArcoReal: pode(mapa, 'arco_real', 'ver'),
    pode_editar_irmaos: ed('cadastro_irmaos'),
    pode_editar_biblioteca: ed('biblioteca'),
    pode_editar_comodatos: ed('comodatos'),
    pode_editar_caridade: ed('caridade'),
    pode_editar_balaustres: ed('balaustres'),
    pode_editar_pranchas: ed('pranchas'),
    pode_editar_comissoes: ed('comissoes'),
    pode_editar_corpo_admin: ed('corpo_admin'),
    pode_editar_presenca: ed('presenca'),
    pode_editar_projetos: ed('projetos'),
    pode_gerenciar_usuarios: ed('usuarios'),
  };
};

// Mapa de módulos → colunas antigas pode_* (gravadas junto para as policies do banco)
export const colunasLegadoDoMapa = (mapa = {}) => {
  const ed = (id) => mapa[id] === 'editar';
  return {
    pode_editar_cadastros: ed('cadastro_irmaos'),
    pode_visualizar_financeiro: mapa.financeiro === 'ver' || mapa.financeiro === 'editar',
    pode_editar_financeiro: ed('financeiro'),
    pode_visualizar_arco_real: mapa.arco_real === 'ver',
    pode_gerenciar_usuarios: ed('usuarios'),
    pode_editar_biblioteca: ed('biblioteca'),
    pode_editar_comodatos: ed('comodatos'),
    pode_editar_caridade: ed('caridade'),
    pode_editar_balaustres: ed('balaustres'),
    pode_editar_pranchas: ed('pranchas'),
    pode_editar_comissoes: ed('comissoes'),
    pode_editar_corpo_admin: ed('corpo_admin'),
    pode_editar_presenca: ed('presenca'),
  };
};

// Página → [módulo, nível mínimo]. Página fora da lista = livre (dashboard, meu cadastro, etc.)
export const PAGINAS = {
  'cadastro': ['cadastro_irmaos', 'editar'],
  'quadro': ['cadastro_irmaos', 'ver'],
  'licencas-situacoes': ['cadastro_irmaos', 'ver'],
  'gerenciar-graus': ['usuarios', 'editar'],
  'financas-loja': ['financeiro', 'ver'],
  'lancamentos-lote': ['financeiro', 'ver'],
  'creditos-debitos': ['financeiro', 'ver'],
  'categorias-financeiras': ['financeiro', 'ver'],
  'relatorio-financeiro': ['financeiro', 'ver'],
  'dashboard-presenca': ['presenca', 'editar'],
  'cadastro-sessao': ['presenca', 'editar'],
  'lista-sessoes': ['presenca', 'editar'],
  'registro-presenca': ['presenca', 'editar'],
  'visualizar-presenca': ['presenca', 'editar'],
  'gestao-sistema-usuarios': ['usuarios', 'editar'],
  'gestao-sistema-logs': ['usuarios', 'editar'],
  'acesso-cunhadas': ['usuarios', 'editar'],
  'usuarios': ['usuarios', 'editar'],
  'modelos-documentos': ['modelos', 'editar'],
};

export const podeAbrirPagina = (mapa, pagina) => {
  const regra = PAGINAS[pagina];
  return !regra || pode(mapa, regra[0], regra[1]);
};
