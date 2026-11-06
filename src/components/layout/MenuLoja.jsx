import { useState } from 'react';
import { pode, ehAdminTotal, ehTesoureiro } from '../../config/permissoes';

// ════════════════════════════════════════════════════════════════════════
// Menu do portal dos irmãos — gerado pelas permissões por módulo.
// Item sem permissão não aparece; submenu sem nenhum item visível some.
// ════════════════════════════════════════════════════════════════════════

const CLS_ATIVO = 'bg-primary-700 border-l-4 border-white';
const CLS_HOVER = 'hover:bg-primary-800';

export default function MenuLoja({
  userData, mapa, currentPage, setCurrentPage, menuAberto,
  irmaoLogadoId, onAbrirMeuPerfilCompleto,
}) {
  const [aberto, setAberto] = useState({});
  const toggle = (k) => setAberto(a => ({ ...a, [k]: !a[k] }));

  const ehIrmao = userData?.nivel_acesso === 'irmao';
  const ver = (m) => pode(mapa, m, 'ver');
  const editar = (m) => pode(mapa, m, 'editar');
  const podeAuditoria = ehAdminTotal(userData) || ehTesoureiro(userData); // Admin, Venerável e Tesoureiro

  // ── Definição do menu (ordem de exibição) ──
  const MENU = [
    { tipo: 'item', pagina: 'dashboard', icone: '📊', label: 'Dashboard', mostrar: true },

    // Área pessoal (acesso simples)
    { tipo: 'item', pagina: 'meu-cadastro', icone: '👤', label: 'Meu Cadastro', mostrar: ehIrmao },
    { tipo: 'acao', icone: '📋', label: 'Meu Perfil Completo', mostrar: ehIrmao && !!irmaoLogadoId, onClick: onAbrirMeuPerfilCompleto },
    { tipo: 'item', pagina: 'minhas-financas', icone: '💰', label: 'Minhas Finanças', mostrar: ehIrmao },
    { tipo: 'item', pagina: 'minhas-presencas', icone: '📊', label: 'Minhas Presenças', mostrar: ehIrmao },

    { tipo: 'grupo', chave: 'irmaos', icone: '👥', label: 'Controle de Irmãos', itens: [
      { pagina: 'cadastro', icone: '➕', label: 'Cadastrar', mostrar: editar('cadastro_irmaos') },
      { pagina: 'visualizar', icone: '👁️', label: 'Visualizar', mostrar: true },
      { pagina: 'quadro', icone: '📋', label: 'Quadro', mostrar: ver('cadastro_irmaos') },
      { pagina: 'licencas-situacoes', icone: '🗓️', label: 'Licenças e Situações', mostrar: ver('cadastro_irmaos') },
      { pagina: 'comendas', icone: '🎖️', label: 'Comendas', mostrar: ver('comendas') },
      { pagina: 'altos-graus', icone: '🔺', label: 'Altos Graus', mostrar: true },
      { pagina: 'gerenciar-graus', icone: '⚙️', label: 'Gerenciar Graus', mostrar: editar('usuarios') },
    ]},

    { tipo: 'grupo', chave: 'expedientes', icone: '📑', label: 'Expedientes', itens: [
      { pagina: 'balaustres', icone: '📜', label: 'Balaustres', mostrar: ver('balaustres') },
      { pagina: 'pranchas', icone: '📄', label: 'Pranchas', mostrar: ver('pranchas') },
      { pagina: 'editais', icone: '📢', label: 'Editais', mostrar: ver('balaustres') },
    ]},

    { tipo: 'grupo', chave: 'financeiro', icone: '💰', label: 'Controle Financeiro', itens: [
      { pagina: 'financas-loja', icone: '🏦', label: 'Finanças - Loja', mostrar: ver('financeiro') },
      { pagina: 'lancamentos-lote', icone: '📦', label: 'Lançamentos em Lote', mostrar: ver('financeiro') },
      { pagina: 'creditos-debitos', icone: '💵', label: 'Créditos/Débitos', mostrar: ver('financeiro') },
      { pagina: 'categorias-financeiras', icone: '🏷️', label: 'Categorias', mostrar: ver('financeiro') },
      { pagina: 'eventos-comemorativos', icone: '🍽️', label: 'Ágape & Festas', mostrar: ver('financeiro') },
      { pagina: 'relatorio-financeiro', icone: '📊', label: 'Conferir Finanças', mostrar: ver('financeiro') },
      { pagina: 'obrigacoes', icone: '🧾', label: 'Obrigações', mostrar: ver('financeiro') },
      { pagina: 'auditoria-financeira', icone: '🔍', label: 'Auditoria Financeira', mostrar: podeAuditoria },
    ]},
    // Sem acesso ao financeiro: Ágape continua visível (somente consulta)
    { tipo: 'item', pagina: 'eventos-comemorativos', icone: '🍽️', label: 'Ágape & Festas', mostrar: !ver('financeiro') },

    { tipo: 'grupo', chave: 'filantropia', icone: '🤝', label: 'Filantropia', itens: [
      { pagina: 'comodatos', icone: '♿', label: 'Comodatos', mostrar: ver('comodatos') },
      { pagina: 'caridade', icone: '❤️', label: 'Caridade', mostrar: ver('caridade') },
      { pagina: 'eventos', icone: '🎉', label: 'Eventos', mostrar: ver('eventos_filantropia') },
    ]},

    { tipo: 'item', pagina: 'projetos', icone: '📊', label: 'Projeto/Campanha', mostrar: ver('projetos') },
    { tipo: 'item', pagina: 'comissoes', icone: '📋', label: 'Comissões', mostrar: ver('comissoes') },
    { tipo: 'item', pagina: 'biblioteca', icone: '📚', label: 'Biblioteca', mostrar: ver('biblioteca') },
    { tipo: 'item', pagina: 'biblioteca-online', icone: '📖', label: 'Biblioteca Online', mostrar: ver('biblioteca') },
    { tipo: 'item', pagina: 'cronograma', icone: '📅', label: 'Cronograma', mostrar: ver('cronograma') },
    { tipo: 'item', pagina: 'email-irmaos', icone: '📧', label: 'Central E-Mail', mostrar: ver('email') },
    { tipo: 'item', pagina: 'estatisticas', icone: '📊', label: 'Estatísticas', mostrar: true },
    { tipo: 'item', pagina: 'lojas-visitantes', icone: '🏛️', label: 'Lojas Maçônicas', mostrar: true },
    { tipo: 'item', pagina: 'visao-geral', icone: '🗓️', label: 'Visão Geral', mostrar: true },
    { tipo: 'item', pagina: 'aniversariantes', icone: '🎉', label: 'Festividades', mostrar: true },

    { tipo: 'grupo', chave: 'presenca', icone: '✅', label: 'Presença Irmãos', itens: [
      { pagina: 'dashboard-presenca', icone: '📊', label: 'Dashboard', mostrar: editar('presenca') },
      { pagina: 'cadastro-sessao', icone: '📋', label: 'Cadastrar Sessão', mostrar: editar('presenca') },
      { pagina: 'lista-sessoes', icone: '📑', label: 'Sessões Realizadas', mostrar: editar('presenca') },
    ]},

    { tipo: 'item', pagina: 'corpo-admin', icone: '👔', label: 'Administração', mostrar: ver('corpo_admin') },
    { tipo: 'item', pagina: 'eleicao-posse', icone: '🗳️', label: 'Eleição e Posse', mostrar: ver('corpo_admin') },
    { tipo: 'item', pagina: 'sindicancia', icone: '🔍', label: 'Sindicância', mostrar: true },

    { tipo: 'grupo', chave: 'sistema', icone: '⚙️', label: 'Gestão do Sistema', itens: [
      { pagina: 'gestao-sistema-usuarios', icone: '👤', label: 'Gerenciar Usuários', mostrar: editar('usuarios') },
      { pagina: 'gestao-sistema-logs', icone: '🔐', label: 'Controle de Acesso', mostrar: editar('usuarios') },
      { pagina: 'dados-loja', icone: '🏛️', label: 'Dados da Loja', mostrar: ehAdminTotal(userData) },
      { pagina: 'acesso-cunhadas', icone: '💜', label: 'Acesso das Cunhadas', mostrar: editar('usuarios') },
      { pagina: 'modelos-documentos', icone: '📝', label: 'Modelos de Documentos', mostrar: editar('modelos') },
    ]},

    { tipo: 'item', pagina: 'sobre', icone: 'ℹ️', label: 'Sobre', mostrar: true },
  ];

  const Item = ({ pagina, icone, label, onClick }) => (
    <button
      onClick={onClick || (() => setCurrentPage(pagina))}
      className={`w-full px-4 py-2 flex items-center gap-2 transition text-sm ${pagina && currentPage === pagina ? CLS_ATIVO : CLS_HOVER}`}
      title={label}
    >
      <span className="text-base">{icone}</span>
      {menuAberto && <span className="font-semibold">{label}</span>}
    </button>
  );

  return (
    <>
      {MENU.map((m, idx) => {
        if (m.tipo === 'item') return m.mostrar ? <Item key={idx} {...m} /> : null;
        if (m.tipo === 'acao') return m.mostrar ? <Item key={idx} {...m} /> : null;

        // grupo
        const itens = m.itens.filter(i => i.mostrar);
        if (itens.length === 0) return null;
        const estaAberto = !!aberto[m.chave];
        return (
          <div key={m.chave} className="border-t border-primary-700 mt-2 pt-2">
            <button
              onClick={() => toggle(m.chave)}
              className="w-full px-4 py-2 flex items-center justify-between hover:bg-primary-800 transition text-sm"
              title={m.label}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{m.icone}</span>
                {menuAberto && <span className="font-semibold">{m.label}</span>}
              </div>
              {menuAberto && (
                <svg className={`w-4 h-4 transition-transform ${estaAberto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
            {estaAberto && menuAberto && (
              <div className="bg-primary-900 bg-opacity-50">
                {itens.map(i => (
                  <button
                    key={i.pagina}
                    onClick={() => setCurrentPage(i.pagina)}
                    className={`w-full px-8 py-2 flex items-center gap-2 transition text-xs ${currentPage === i.pagina ? CLS_ATIVO : CLS_HOVER}`}
                  >
                    <span>{i.icone}</span>
                    <span>{i.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
