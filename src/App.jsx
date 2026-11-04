import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { useTema } from './hooks/useTema';
import { useCarregarTema } from './hooks/useCarregarTema';

// ========================================
// IMPORTAR COMPONENTES REFATORADOS
// ========================================
import { Dashboard } from './components/Dashboard';
import { CorpoAdmin } from './components/administracao/CorpoAdmin';
import Usuarios from './components/administracao/Usuarios';
import GestaoSistema from './components/administracao/GestaoSistema';
import EleicaoPosse from './components/administracao/EleicaoPosse';
import DadosLoja from './components/sistema/DadosLoja';
import ControleAcesso from './components/administracao/ControleAcesso';
import CadastrarIrmao from './components/irmaos/CadastrarIrmao';
import VisualizarIrmaos from './components/irmaos/VisualizarIrmaos';
import QuadroIrmaos from './components/irmaos/QuadroIrmaos';
import Comendas from './components/irmaos/Comendas';
import PerfilIrmao from './components/irmaos/PerfilIrmao';
import PerfilCompletoIrmao from './components/irmaos/PerfilCompletoIrmao';
import EmailIrmaos from './components/irmaos/EmailIrmaos';
import RelatorioFinanceiro from './components/financeiro/RelatorioFinanceiro';
import Balaustres from './components/balaustres/Balaustres';
import Pranchas from './components/pranchas/Pranchas';
import Editais from './components/editais/Editais';
import AuditoriaFinanceira from './components/financeiro/AuditoriaFinanceira';
import Obrigacoes from './components/financeiro/Obrigacoes';
import VisaoGeral from './components/sistema/VisaoGeral';
import LojasVisitantes from './components/irmaos/LojasVisitantes';
import Comissoes from './components/comissoes/Comissoes';
import Projetos from './components/projetos/Projetos';
import Biblioteca from './components/biblioteca/Biblioteca';
import BibliotecaOnline from './components/biblioteca/BibliotecaOnline';
import Cronograma from './components/cronograma/Cronograma';
import FinancasLoja from './components/financeiro/FinancasLoja';
import LancamentosLote from './components/financeiro/LancamentosLote';
import CategoriasFinanceiras from './components/financeiro/CategoriasFinanceiras';
import EventosComemorativos from './components/financeiro/EventosComemorativos';
import VisualizarAltosGraus from './components/vida-maconica/VisualizarAltosGraus';
import GerenciarGraus from './components/vida-maconica/GerenciarGraus';
import Estatisticas from './components/sistema/Estatisticas';
import PrimeiroAcesso from './components/PrimeiroAcesso';
import MeuCadastroWrapper from './components/MeuCadastroWrapper';
import MinhasFinancas from './components/MinhasFinancas';
import ArcoRealApp from './components/arcoreal/ArcoRealApp';
import EscolhaArea from './components/arcoreal/EscolhaArea';
import Caridade from './components/caridade/Caridade';
import Eventos from './components/filantropia/Eventos';
import Sobre from './components/Sobre';
import Aniversariantes from './components/aniversariantes/Aniversariantes';
import Sindicancia from './components/sindicancia/Sindicancia';
import Comodatos from './components/comodatos/Comodatos';
import CreditosDebitos from './components/creditos-debitos/CreditosDebitos';
import CadastroSessao from './components/CadastroSessao';
import RegistroPresenca from './components/RegistroPresenca';
import ListaSessoes from './components/ListaSessoes';
import DashboardPresenca from './components/DashboardPresenca';
import MinhaPresenca from './components/MinhaPresenca';
import ModalVisualizarPresenca from './components/ModalVisualizarPresenca';
import Login from './components/Login';
import DashboardCunhadas from './components/cunhadas/DashboardCunhadas';
import CadastroCunhadas from './components/cunhadas/CadastroCunhadas';
import FinanceiroCunhadas from './components/cunhadas/FinanceiroCunhadas';
import AcessoCunhadas from './components/cunhadas/AcessoCunhadas';
import MenuLoja from './components/layout/MenuLoja';
import ModelosDocumentos from './components/administracao/ModelosDocumentos';
import { rotuloEstadoCivilCompleto } from './utils/constants';
import { permissoesEfetivas, montarPermissoesLegado, podeAbrirPagina, pode } from './config/permissoes';

// ========================================
// CONFIGURAÇÃO SUPABASE
// ========================================
// Supabase já importado de './supabaseClient'

const LOGO_URL = 'https://ypnvzjctyfdrkkrhskzs.supabase.co/storage/v1/object/public/LogoAcacia/LogoAcaciaPtga30.png';
const NOME_LOJA = 'A∴R∴L∴S∴ Acácia de Paranatinga nº 30';

// Função para tratar datas vazias
const tratarData = (data) => {
  if (!data || data === '' || data === 'undefined' || data === 'null') {
    return null;
  }
  return data;
};

// ========================================
// FUNÇÕES AUXILIARES
// ========================================
const calcularTempoMaconaria = (dataIniciacao) => {
  if (!dataIniciacao) return '';
  const inicio = new Date(dataIniciacao + 'T00:00:00');
  const hoje = new Date();
  let anos = hoje.getFullYear() - inicio.getFullYear();
  let meses = hoje.getMonth() - inicio.getMonth();
  if (meses < 0) { anos--; meses = 12 + meses; }
  return `${anos} ano(s) e ${meses} mês(es)`;
};

const calcularIdade = (dataNascimento) => {
  if (!dataNascimento) return '';
  const nascimento = new Date(dataNascimento + 'T00:00:00');
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return `${idade} anos`;
};

const formatarData = (data) => {
  if (!data) return '-';
  const date = new Date(data + 'T00:00:00');
  return date.toLocaleDateString('pt-BR');
};

const formatarDataInput = (data) => {
  if (!data) return '';
  const date = new Date(data + 'T00:00:00');
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const obterDiaSemana = (data) => {
  if (!data) return '';
  const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const date = new Date(data + 'T00:00:00');
  return dias[date.getDay()];
};

// ========================================
// COMPONENTE PRINCIPAL
function App() {
  // Área escolhida no login, pra quem acumula acesso à Loja e ao Arco Real
  // (null = ainda não escolheu; 'loja' ou 'arco_real' depois de escolher)
  const [areaEscolhida, setAreaEscolhida] = useState(null);

  // ========================================
  // CARREGAR TEMA DO SISTEMA
  // ========================================
  useTema();

  // ========================================
  // VERIFICAR ROTA DE PRIMEIRO ACESSO
  // ========================================
  if (window.location.pathname === '/primeiro-acesso') {
    return <PrimeiroAcesso />;
  }

  // ========================================
  // ESTADOS
  // ========================================
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  // Trava adicional: evita mostrar a tela da Loja "piscando" antes de saber
  // se a pessoa tem acesso ao Arco Real também. Some sozinha em até 4s,
  // mesmo se algo der errado no carregamento do perfil (trava de segurança).
  const [perfilCarregado, setPerfilCarregado] = useState(false);
  const [userData, setUserData] = useState(null);
  const [grauUsuarioLogado, setGrauUsuarioLogado] = useState(null);
  const [permissoes, setPermissoes] = useState(null);
  // Fase 2: mapa de permissões por módulo { modulo: 'ver' | 'editar' }
  const [mapaPermissoes, setMapaPermissoes] = useState({});
  // Página para onde voltar ao sair de Modelos de Documentos (ex.: Eleição e Posse)
  const [retornoModelos, setRetornoModelos] = useState(null);
  // ========================================
  // NOMES DAS TELAS + CONTROLE DE ACESSO ÚNICO POR SESSÃO
  // ========================================
  // Nome "bonito" de cada tela pro log de acesso — mesmo texto usado nos
  // títulos de cabeçalho, pra ficar consistente em todo o sistema.
  // 'dashboard' fica de fora de propósito (não é logado).
  const NOMES_TELAS = {
    'dashboard-cunhadas': '💜 Dashboard Cunhadas',
    'meu-cadastro': '👤 Meu Cadastro',
    'minhas-financas': '💰 Minhas Finanças',
    'minhas-presencas': '📊 Minhas Presenças',
    'cadastro': '➕ Cadastro de Irmãos',
    'visualizar': '👥 Visualizar Irmãos',
    'quadro': '📋 Quadro de Irmãos',
    'comendas': '🎖️ Comendas',
    'modelos-documentos': '📝 Modelos de Documentos',
    'balaustres': '📜 Balaustres',
    'pranchas': '📄 Pranchas Expedidas',
    'editais': '📢 Editais',
    'corpo-admin': '👔 Corpo Administrativo',
    'eleicao-posse': '🗳️ Eleição e Posse',
    'projetos': '📊 Projetos',
    'comissoes': '📋 Comissões',
    'biblioteca': '📚 Biblioteca',
    'biblioteca-online': '📖 Biblioteca Online',
    'cronograma': '📅 Cronograma Anual',
    'financas-loja': '🏦 Finanças da Loja',
    'creditos-debitos': '💰 Créditos e Débitos',
    'lancamentos-lote': '📦 Lançamentos em Lote',
    'categorias-financeiras': '🏷️ Categorias Financeiras',
    'eventos-comemorativos': '🍽️ Ágape & Festas',
    'email-irmaos': '📧 Central E-Mail',
    'relatorio-financeiro': '📊 Conferir Finanças',
    'auditoria-financeira': '🔍 Auditoria Financeira',
    'obrigacoes': '🧾 Obrigações',
    'caridade': '❤️ Caridade',
    'eventos': '🎉 Eventos',
    'aniversariantes': '🎉 Festividades',
    'dashboard-presenca': '📊 Dashboard de Presença',
    'cadastro-sessao': '📋 Cadastro de Sessão',
    'lista-sessoes': '📊 Sessões Realizadas',
    'registro-presenca': '✅ Registro de Presença',
    'comodatos': '♿ Controle de Comodatos',
    'altos-graus': '🔺 Altos Graus',
    'gerenciar-graus': '⚙️ Gerenciar Graus',
    'perfil-irmao': '👤 Perfil do Irmão',
    'usuarios': '👤 Gerenciar Usuários',
    'dados-loja': '🏛️ Dados da Loja',
    'sobre': 'ℹ️ Sobre o Sistema',
    'sindicancia': '🔍 Sindicância',
    'estatisticas': '📈 Estatísticas',
    'lojas-visitantes': '🏛️ Lojas Maçônicas',
    'visao-geral': '🗓️ Visão Geral',
  };

  // Guarda quais telas já foram registradas NESTA sessão (enquanto o app
  // está aberto). Zera sozinho ao recarregar a página ou logar de novo.
  const telasJaAcessadasRef = useRef(new Set());

  const [currentPage, setCurrentPage] = useState('dashboard');
  const [portalAtivo, setPortalAtivo] = useState('irmaos'); // 'irmaos' ou 'cunhadas' — definido após validação da sessão
  const [modalAcessoNegado, setModalAcessoNegado] = useState(false); // Modal de acesso negado (sobrevive ao re-render do Login)
  const [irmaoParaEditar, setIrmaoParaEditar] = useState(null);
  const [irmaoParaPerfil, setIrmaoParaPerfil] = useState(null);
  const [modalPerfilCompletoAberto, setModalPerfilCompletoAberto] = useState(false);
  const [irmaoIdPerfilCompleto, setIrmaoIdPerfilCompleto] = useState(null);
  const [irmaoLogadoId, setIrmaoLogadoId] = useState(null);
  const [sessaoIdAtual, setSessaoIdAtual] = useState(null);
  const [origemRegistroPresenca, setOrigemRegistroPresenca] = useState('cadastro-sessao');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // ========================================
  // CARREGAR TEMA DO USUÁRIO AUTOMATICAMENTE
  // ========================================
  useCarregarTema(userData);

  // Helper: Verificar se é Admin ou Venerável (acesso total)
  const isAdminOrVeneravel = (user = userData) => {
    if (!user) return false;
    return user.nivel_acesso === 'admin' || 
           user.cargo === 'veneravel' || 
           user.cargo === 'Veneravel';
  };

  // Estados do menu colapsável
  const [menuAberto, setMenuAberto] = useState(true);
  const [submenuIrmaos, setSubmenuIrmaos] = useState(false);
  const [submenuExpedientes, setSubmenuExpedientes] = useState(false);
  const [submenuFinanceiro, setSubmenuFinanceiro] = useState(false);
  const [submenuFilantropia, setSubmenuFilantropia] = useState(false);
  const [submenuGestaoSistema, setSubmenuGestaoSistema] = useState(false);
  const [submenuSindicancia, setSubmenuSindicancia] = useState(false);
  const [submenuPresenca, setSubmenuPresenca] = useState(false);

  // Estados de login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Estados de dados
  const [irmaos, setIrmaos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [balaustres, setBalaustres] = useState([]);
  const [tiposSessao, setTiposSessao] = useState([]);
  const [cargosLoja, setCargosLoja] = useState([]);
  const [cronograma, setCronograma] = useState([]);
  
  // Estados para Comissões
  const [comissoes, setComissoes] = useState([]);

  // Estados para Biblioteca
  const [livros, setLivros] = useState([]);
  const [emprestimos, setEmprestimos] = useState([]);

  // Estados para Balaustre
  const [grauSelecionado, setGrauSelecionado] = useState('Aprendiz');

  // Estados para Usuários
  const [usuarioForm, setUsuarioForm] = useState({
    nome: '',
    email: '',
    senha: '',
    cargo: 'irmao',
    ativo: true
  });
  const [modoEdicaoUsuario, setModoEdicaoUsuario] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [permissoesDisponiveis, setPermissoesDisponiveis] = useState([]);

  // Estados para Pranchas Expedidas
  const [pranchas, setPranchas] = useState([]);
  // Editais (controle único, numeração por ano)
  const [editais, setEditais] = useState([]);

  // Estados para Corpo Administrativo
  const [corpoAdmin, setCorpoAdmin] = useState([]);
  const [corpoAdminForm, setCorpoAdminForm] = useState({
    irmao_id: '',
    cargo: '',
    ano_exercicio: ''
  });
  const [anoFiltroAdmin, setAnoFiltroAdmin] = useState('');
  const [modoEdicaoCorpoAdmin, setModoEdicaoCorpoAdmin] = useState(false);
  const [corpoAdminEditando, setCorpoAdminEditando] = useState(null);

  // (lista de cargos removida daqui: o sistema usa CARGOS_ADMINISTRATIVOS de utils/constants.js)

  // ========================================
  // FUNÇÃO REGISTRAR ACESSO
  // ========================================
  const registrarAcesso = async (userId) => {
    try {
      await supabase.from('logs_acesso').insert({
        usuario_id: userId,
        acao: 'acesso_sistema',
        detalhes: 'Usuário acessou o sistema',
        created_at: new Date().toISOString()
      });
      console.log('✅ Acesso registrado');
    } catch (error) {
      console.error('❌ Erro ao registrar acesso:', error);
    }
  };

  // ── Fase 2: bloqueio de página sem permissão → volta ao Dashboard ──
  useEffect(() => {
    if (!perfilCarregado || !userData || userData.nivel_acesso === 'arco_real') return;
    if (portalAtivo !== 'irmaos') return;
    if (!podeAbrirPagina(mapaPermissoes, currentPage)) setCurrentPage('dashboard');
  }, [currentPage, mapaPermissoes, perfilCarregado, userData, portalAtivo]);

  // Registra "acessou a tela X" — só uma vez por tela, por sessão. Nunca
  // dispara pra 'dashboard' nem pra telas fora do mapa NOMES_TELAS, e não
  // registra de novo se o usuário voltar numa tela já visitada (só quando
  // é a primeira vez que ele entra ali desde que logou).
  useEffect(() => {
    if (!userData?.id) return;
    if (!NOMES_TELAS[currentPage]) return;
    if (telasJaAcessadasRef.current.has(currentPage)) return;

    telasJaAcessadasRef.current.add(currentPage);
    supabase.from('logs_acesso').insert({
      usuario_id: userData.id,
      acao: 'acessar_tela',
      detalhes: `Acessou: ${NOMES_TELAS[currentPage]}`,
      created_at: new Date().toISOString()
    }).then(({ error }) => {
      if (error) console.error('Erro ao registrar acesso à tela:', error);
    });
  }, [currentPage, userData?.id]);

  // Registra o momento em que o usuário entra no Arco Real — cobre os dois
  // caminhos possíveis: quem escolhe isso na tela "Qual área você quer
  // acessar?" (areaEscolhida) e quem só tem acesso ao Arco Real (nunca vê
  // essa tela, cai direto lá). Uma vez por sessão, igual às telas normais.
  useEffect(() => {
    if (!userData?.id) return;
    const entrouNoArcoReal = areaEscolhida === 'arco_real' || userData?.nivel_acesso === 'arco_real';
    if (!entrouNoArcoReal) return;
    if (telasJaAcessadasRef.current.has('__arco_real_entrada__')) return;

    telasJaAcessadasRef.current.add('__arco_real_entrada__');
    supabase.from('logs_acesso').insert({
      usuario_id: userData.id,
      acao: 'acessar_tela',
      detalhes: 'Acessou: 🔺 Arco Real',
      created_at: new Date().toISOString()
    }).then(({ error }) => {
      if (error) console.error('Erro ao registrar acesso ao Arco Real:', error);
    });
  }, [areaEscolhida, userData?.id, userData?.nivel_acesso]);

  // ========================================
  // EFEITOS E CARREGAMENTOS
  // ========================================
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const portalSalvo = sessionStorage.getItem('portalAtivo');
      const tipoPerfilSalvo = sessionStorage.getItem('tipoPerfil'); // 'cunhada' ou null

      // Portal cunhadas: força novo login ao reabrir o navegador
      if (session && portalSalvo === 'cunhadas' && !tipoPerfilSalvo) {
        supabase.auth.signOut();
        sessionStorage.removeItem('portalAtivo');
        setLoading(false);
        setPerfilCarregado(true);
        return;
      }

      // Cunhada com aba ainda aberta (sessionStorage intacto): restaura normalmente
      if (session && tipoPerfilSalvo === 'cunhada') {
        setSession(session);
        setPortalAtivo('cunhadas');
        setCurrentPage('dashboard-cunhadas');
        setLoading(false);
        setPerfilCarregado(true);
        return;
      }

      // Irmão — fluxo normal
      setSession(session);
      if (session) {
        loadUserData(session.user.email);
        loadIrmaos();
        loadTiposSessao();
        loadCargosLoja();
        loadBalaustres();
        loadUsuarios();
        loadPermissoes();
        loadPranchas();
        loadEditais();
        loadCorpoAdmin();
        loadComissoes();
        loadLivros();
        loadEmprestimos();
        loadCronograma();
      } else {
        // Sem sessão nenhuma: não há perfil pra esperar, libera direto
        setPerfilCarregado(true);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Trava de segurança: se por algum motivo o perfil nunca terminar de
  // carregar (erro de rede, etc.), libera a tela mesmo assim depois de 4s —
  // nunca deixa a pessoa presa numa tela preta.
  useEffect(() => {
    if (!session || perfilCarregado) return;
    const timer = setTimeout(() => setPerfilCarregado(true), 4000);
    return () => clearTimeout(timer);
  }, [session, perfilCarregado]);


  // Filtrar balaustres por grau
  useEffect(() => {
    if (currentPage === 'balaustres') {
      loadBalaustres();
    }
    if (currentPage === 'editais') {
      loadEditais(); // emissões feitas nas telas de Eleição/Posse/GLEMT aparecem aqui
    }
  }, [currentPage]);  // Removido grauSelecionado - não precisa recarregar ao mudar grau

  // ========================================
  // FUNÇÕES HELPER PARA COMPONENTES
  // ========================================
  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const showError = (message) => {
    setError(message);
    setTimeout(() => setError(''), 5000);
  };

  // ========================================
  // FUNÇÕES DE CARREGAMENTO
  // ========================================
  const loadUserData = async (userEmail) => {
   try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', userEmail)
      .single();

    if (data) {
      setUserData(data);
      
      // Registrar acesso ao sistema
      registrarAcesso(data.id);
      
      // Buscar grau do irmão logado (se for irmão)
      if (data.nivel_acesso === 'irmao') {
        const { data: irmaoData } = await supabase
          .from('irmaos')
          .select('id, data_iniciacao, data_elevacao, data_exaltacao, mestre_instalado')
          .eq('email', userEmail)
          .single();
        
        if (irmaoData) {
          setIrmaoLogadoId(irmaoData.id);
          let grau = 'Não Iniciado';
          if (irmaoData.data_exaltacao) {
            grau = irmaoData.mestre_instalado ? 'Mestre Instalado' : 'Mestre';
          }
          else if (irmaoData.data_elevacao) grau = 'Companheiro';
          else if (irmaoData.data_iniciacao) grau = 'Aprendiz';
          setGrauUsuarioLogado(grau);
        }
      } else {
        // Admin e cargos têm acesso total (Mestre)
        setGrauUsuarioLogado('Mestre');
      }
      
      // Definir permissões - VERIFICAR CARGO PRIMEIRO!
      if (data.cargo === 'veneravel' || data.cargo === 'Veneravel' || data.nivel_acesso === 'admin') {
        // Venerável OU Admin: acesso total
        setPermissoes({
          canEdit: true,
          canEditMembers: true,
          canDelete: true,
          canManageUsers: true,
          canViewFinancial: true,
          canEditFinancial: true,
          canViewArcoReal: true,
          pode_editar_biblioteca: true,
          pode_editar_comodatos: true,
          pode_editar_caridade: true,
          pode_editar_balaustres: true,
          pode_editar_pranchas: true,
          pode_editar_comissoes: true,
          pode_editar_corpo_admin: true,
          pode_editar_presenca: true,
          pode_editar_projetos: true,
          pode_gerenciar_usuarios: true
        });
      } else if (data.nivel_acesso === 'irmao') {
        // Irmão: usa permissões específicas do banco
        setPermissoes({
          canEdit: data.pode_editar_cadastros || false,
          canEditMembers: data.pode_editar_cadastros || false,
          canDelete: false,
          canManageUsers: false,
          canViewFinancial: data.pode_visualizar_financeiro || false,
          canEditFinancial: data.pode_editar_financeiro || false,
          canViewArcoReal: data.pode_visualizar_arco_real || false,
          pode_editar_biblioteca: data.pode_editar_biblioteca || false,
          pode_editar_comodatos: data.pode_editar_comodatos || false,
          pode_editar_caridade: data.pode_editar_caridade || false,
          pode_editar_balaustres: data.pode_editar_balaustres || false,
          pode_editar_pranchas: data.pode_editar_pranchas || false,
          pode_editar_comissoes: data.pode_editar_comissoes || false,
          pode_editar_corpo_admin: false,
          pode_editar_presenca: data.pode_editar_presenca || false,
          pode_editar_projetos: data.pode_editar_projetos || false,
          pode_gerenciar_usuarios: false
        });
      } else if (data.nivel_acesso === 'cargo') {
        // Cargo: baseado nas permissões específicas
        setPermissoes({
          canEdit: data.pode_editar_cadastros || false,
          canEditMembers: data.pode_editar_cadastros || false,
          canDelete: data.pode_editar_cadastros || false,
          canManageUsers: data.pode_gerenciar_usuarios || false,
          canViewFinancial: data.pode_visualizar_financeiro || false,
          canEditFinancial: data.pode_editar_financeiro || false,
          canViewArcoReal: data.pode_visualizar_arco_real || false,
          pode_editar_biblioteca: data.pode_editar_biblioteca || false,
          pode_editar_comodatos: data.pode_editar_comodatos || false,
          pode_editar_caridade: data.pode_editar_caridade || false,
          pode_editar_balaustres: data.pode_editar_balaustres || false,
          pode_editar_pranchas: data.pode_editar_pranchas || false,
          pode_editar_comissoes: data.pode_editar_comissoes || false,
          pode_editar_corpo_admin: data.pode_editar_corpo_admin || false,
          pode_editar_presenca: data.pode_editar_presenca || false,
          pode_editar_projetos: data.pode_editar_projetos || false,
          pode_gerenciar_usuarios: data.pode_gerenciar_usuarios || false
        });
      } else if (data.nivel_acesso === 'arco_real') {
        // Arco Real (externo — não é irmão da Loja): mesmas permissões
        // individuais por checkbox, mas nunca com acesso à Loja em si
        // (canViewArcoReal não faz sentido aqui — ele SEMPRE está no Arco
        // Real). "Acesso simples" = todos os checkboxes false (só vê os
        // próprios dados). "Cargo oficial" = os checkboxes que o admin
        // marcar na tela de Usuários.
        setPermissoes({
          canEdit: data.pode_editar_cadastros || false,
          canEditMembers: data.pode_editar_cadastros || false,
          canDelete: data.pode_editar_cadastros || false,
          canManageUsers: data.pode_gerenciar_usuarios || false,
          canViewFinancial: data.pode_visualizar_financeiro || false,
          canEditFinancial: data.pode_editar_financeiro || false,
          canViewArcoReal: false,
          pode_editar_presenca: data.pode_editar_presenca || false,
          pode_gerenciar_usuarios: data.pode_gerenciar_usuarios || false
        });
      } else {
        // NULL ou não reconhecido: trata como irmão com permissões do banco
        setPermissoes({
          canEdit: data.pode_editar_cadastros || false,
          canEditMembers: data.pode_editar_cadastros || false,
          canDelete: false,
          canManageUsers: data.pode_gerenciar_usuarios || false,
          canViewFinancial: data.pode_visualizar_financeiro || false,
          canEditFinancial: data.pode_editar_financeiro || false,
          canViewArcoReal: data.pode_visualizar_arco_real || false,
          pode_editar_biblioteca: data.pode_editar_biblioteca || false,
          pode_editar_comodatos: data.pode_editar_comodatos || false,
          pode_editar_caridade: data.pode_editar_caridade || false,
          pode_editar_balaustres: data.pode_editar_balaustres || false,
          pode_editar_pranchas: data.pode_editar_pranchas || false,
          pode_editar_comissoes: data.pode_editar_comissoes || false,
          pode_editar_corpo_admin: data.pode_editar_corpo_admin || false,
          pode_editar_presenca: data.pode_editar_presenca || false,
          pode_editar_projetos: data.pode_editar_projetos || false,
          pode_gerenciar_usuarios: data.pode_gerenciar_usuarios || false
        });
      }

      // ── Fase 2: permissões por módulo (catálogo em src/config/permissoes.js) ──
      // Admin/Venerável = tudo; Tesoureiro = financeiro automático; demais = jsonb
      // usuarios.permissoes (ou colunas antigas pode_*, se o jsonb ainda não existir).
      // O Arco Real externo continua com a regra própria acima.
      if (data.nivel_acesso !== 'arco_real') {
        const mapa = permissoesEfetivas(data);
        setMapaPermissoes(mapa);
        setPermissoes(montarPermissoesLegado(mapa, data));
      }
    }
   } catch (err) {
     console.error('Erro ao carregar dados do usuário:', err);
   } finally {
     // Libera a tela de carregamento independente de sucesso ou erro —
     // nunca deixa a pessoa presa numa tela preta.
     setPerfilCarregado(true);
   }
  };

  const loadIrmaos = async () => {
    const { data, error } = await supabase
      .from('irmaos')
      .select(`
        *,
        esposas (*),
        pais (*),
        filhos (*)
      `)
      .order('nome');
    
    if (data) {
      // Adicionar situacao padrão para registros que não tem
      const irmaosComSituacao = data.map(irmao => ({
        ...irmao,
        situacao: irmao.situacao || 'Regular'
      }));
      setIrmaos(irmaosComSituacao);
    }
    if (error) console.error('Erro ao carregar irmãos:', error);
  };

  const loadTiposSessao = async () => {
    try {
      console.log('🔍 Carregando tipos de sessão...');
      
      const { data, error } = await supabase
        .from('tipos_sessao')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      
      console.log('📊 Tipos de sessão:', { data, error });
      
      if (error) {
        console.error('❌ Erro ao carregar tipos de sessão:', error);
        return;
      }
      
      if (data) {
        console.log('✅ Tipos de sessão carregados:', data.length, 'tipos');
        setTiposSessao(data);
      }
    } catch (err) {
      console.error('❌ Exceção ao carregar tipos de sessão:', err);
    }
  };

  const loadCargosLoja = async () => {
    const { data, error } = await supabase
      .from('cargos_loja')
      .select('*')
      .eq('ativo', true)
      .order('ordem');
    
    if (data) setCargosLoja(data);
    if (error) console.error('Erro ao carregar cargos:', error);
  };

  const loadUsuarios = async () => {
    try {
      console.log('🔍 Carregando usuários...');
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .order('nome');
      
      if (error) {
        console.error('❌ Erro ao carregar usuários:', error);
        return;
      }
      
      if (data) {
        console.log('✅ Usuários carregados:', data.length);
        setUsuarios(data);
      }
    } catch (err) {
      console.error('❌ Exceção ao carregar usuários:', err);
    }
  };

  const loadPermissoes = async () => {
    try {
      console.log('🔍 Carregando permissões...');
      const { data, error } = await supabase
        .from('permissoes')
        .select('*')
        .order('cargo');
      
      if (error) {
        console.error('❌ Erro ao carregar permissões:', error);
        return;
      }
      
      if (data) {
        console.log('✅ Permissões carregadas:', data.length);
        setPermissoesDisponiveis(data);
      }
    } catch (err) {
      console.error('❌ Exceção ao carregar permissões:', err);
    }
  };

  const loadPranchas = async () => {
    try {
      console.log('🔍 Carregando pranchas expedidas...');
      const { data, error } = await supabase
        .from('pranchas_expedidas')
        .select('*')
        .order('data_prancha', { ascending: false });
      
      if (error) {
        console.error('❌ Erro ao carregar pranchas:', error);
        return;
      }
      
      if (data) {
        console.log('✅ Pranchas carregadas:', data.length);
        setPranchas(data);
      }
    } catch (err) {
      console.error('❌ Exceção ao carregar pranchas:', err);
    }
  };

  const loadEditais = async () => {
    try {
      const { data, error } = await supabase
        .from('editais')
        .select('*')
        .order('ano', { ascending: false })
        .order('numero', { ascending: false });
      if (error) {
        console.error('❌ Erro ao carregar editais:', error);
        return;
      }
      if (data) setEditais(data);
    } catch (err) {
      console.error('❌ Exceção ao carregar editais:', err);
    }
  };

  const loadCorpoAdmin = async () => {
    try {
      console.log('🔍 Carregando corpo administrativo...');
      const { data, error } = await supabase
        .from('corpo_administrativo')
        .select('*')
        .order('ano_exercicio', { ascending: false });
      
      if (error) {
        console.error('❌ Erro ao carregar corpo admin:', error);
        return;
      }
      
      if (data) {
        // Buscar dados dos irmãos separadamente
        const irmaoIds = [...new Set(data.map(ca => ca.irmao_id))];
        const { data: irmaosData } = await supabase
          .from('irmaos')
          .select('id, nome, cim')
          .in('id', irmaoIds);
        
        // Fazer join manual
        const corpoComIrmaos = data.map(ca => ({
          ...ca,
          irmao: irmaosData?.find(i => i.id === ca.irmao_id)
        }));
        
        console.log('✅ Corpo administrativo carregado:', corpoComIrmaos.length);
        setCorpoAdmin(corpoComIrmaos);
      }
    } catch (err) {
      console.error('❌ Exceção ao carregar corpo admin:', err);
    }
  };

  const loadBalaustres = async () => {
    try {
      console.log('🔍 Carregando TODOS os balaustres');
      
      // Buscar TODOS os balaustres (sem filtro de grau)
      const { data: balaustreData, error: balaustreError } = await supabase
        .from('balaustres')
        .select('*')
        .order('numero_balaustre', { ascending: false });
      
      if (balaustreError) {
        // Se JWT expirou, tentar renovar sessão e repetir
        if (balaustreError.message?.includes('JWT') || balaustreError.code === 'PGRST301') {
          console.warn('⚠️ JWT expirado — tentando renovar sessão...');
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (!refreshError) {
            console.log('✅ Sessão renovada — recarregando balaustres');
            return loadBalaustres(); // retry
          }
        }
        console.error('❌ Erro ao carregar balaustres:', balaustreError);
        setError('Erro ao carregar balaustres: ' + balaustreError.message);
        return;
      }
      
      console.log('📊 Balaustres encontrados:', balaustreData?.length || 0);
      
      if (!balaustreData || balaustreData.length === 0) {
        console.log('⚠️ Nenhum balaustre encontrado');
        setBalaustres([]);
        return;
      }

      // Buscar tipos de sessão separadamente
      const { data: tiposData, error: tiposError } = await supabase
        .from('tipos_sessao')
        .select('*');
      
      if (tiposError) {
        console.error('⚠️ Erro ao carregar tipos de sessão:', tiposError);
      }

      // Fazer o "join" manualmente
      const balaustreComTipos = balaustreData.map(bal => {
        const tipo = tiposData?.find(t => t.id === bal.tipo_sessao_id);
        return {
          ...bal,
          tipos_sessao: tipo ? { id: tipo.id, nome: tipo.nome } : null
        };
      });

      console.log('✅ Balaustres processados:', balaustreComTipos.length);
      setBalaustres(balaustreComTipos);
      
    } catch (err) {
      console.error('❌ Exceção ao carregar balaustres:', err);
      setError('Erro inesperado ao carregar balaustres');
      setBalaustres([]);
    }
  };

  const loadComissoes = async () => {
    try {
      console.log('🔍 Carregando comissões...');
      const { data, error } = await supabase
        .from('comissoes')
        .select('*')
        .order('data_criacao', { ascending: false });
      
      if (error) {
        console.error('❌ Erro ao carregar comissões:', error);
        return;
      }
      
      console.log('✅ Comissões carregadas:', data?.length || 0);
      setComissoes(data || []);
    } catch (err) {
      console.error('❌ Exceção ao carregar comissões:', err);
      setComissoes([]);
    }
  };

  const loadLivros = async () => {
    try {
      console.log('🔍 Carregando livros...');
      const { data, error } = await supabase
        .from('biblioteca_livros')
        .select('*')
        .order('titulo', { ascending: true });
      
      if (error) {
        console.error('❌ Erro ao carregar livros:', error);
        return;
      }
      
      console.log('✅ Livros carregados:', data?.length || 0);
      setLivros(data || []);
    } catch (err) {
      console.error('❌ Exceção ao carregar livros:', err);
      setLivros([]);
    }
  };

  const loadCronograma = async () => {
    try {
      const { data, error } = await supabase
        .from('eventos_comemorativos')
        .select('*')
        .order('mes', { ascending: true });
      
      if (error) {
        console.error('Erro ao carregar eventos:', error);
        setCronograma([]);
        return;
      }
      
      console.log('✅ Eventos comemorativos carregados:', data?.length || 0);
      setCronograma(data || []);
    } catch (err) {
      console.error('Exceção ao carregar eventos:', err);
      setCronograma([]);
    }
  };

  const loadEmprestimos = async () => {
    try {
      console.log('🔍 Carregando empréstimos...');
      const { data, error } = await supabase
        .from('biblioteca_emprestimos')
        .select('*')
        .order('data_emprestimo', { ascending: false });
      
      if (error) {
        console.error('❌ Erro ao carregar empréstimos:', error);
        return;
      }
      
      console.log('✅ Empréstimos carregados:', data?.length || 0);
      setEmprestimos(data || []);
    } catch (err) {
      console.error('❌ Exceção ao carregar empréstimos:', err);
      setEmprestimos([]);
    }
  };

  const carregarProximoNumero = async (grau) => {
    try {
      console.log('🔢 Carregando próximo número para grau:', grau);
      
      const { data, error } = await supabase
        .rpc('get_proximo_numero_balaustre', { grau });
      
      console.log('📊 Próximo número:', { data, error });
      
      if (data !== null && data !== undefined) {
        console.log('✅ Próximo número definido:', data);
        setBalaustreForm(prev => ({ ...prev, numero_balaustre: data }));
      } else {
        console.log('⚠️ Próximo número não retornado, usando 1');
        setBalaustreForm(prev => ({ ...prev, numero_balaustre: 1 }));
      }
      
      if (error) {
        console.error('❌ Erro ao carregar próximo número:', error);
      }
    } catch (err) {
      console.error('❌ Exceção ao carregar próximo número:', err);
      setBalaustreForm(prev => ({ ...prev, numero_balaustre: 1 }));
    }
  };

  // ========================================
  // ========================================
  // FUNÇÕES DE AUTENTICAÇÃO
  // ========================================
  const handleLogin = async (emailParam, passwordParam, portalEscolhido = 'irmaos') => {
    setLoading(true);
    setError('');

    try {
      console.log('🔐 Iniciando login...', { email: emailParam, portal: portalEscolhido });
      
      // PASSO 1: Autenticar
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailParam,
        password: passwordParam,
      });

      if (error) throw error;
      console.log('✅ Autenticação OK');

      // PASSO 2A: Verificar se é uma CUNHADA com login próprio
      const { data: dadosCunhada } = await supabase
        .from('cunhadas')
        .select('id, nome, ativa, cargo')
        .eq('email', emailParam)
        .maybeSingle();

      const ehCunhada = !!dadosCunhada;

      if (ehCunhada) {
        // ── Fluxo CUNHADA ──────────────────────────────────────────
        console.log('👩 Usuário identificado como cunhada, cargo:', dadosCunhada.cargo);

        if (!dadosCunhada.ativa) {
          await supabase.auth.signOut();
          throw new Error('Cadastro inativo. Entre em contato com a administração.');
        }

        // Cunhadas só acessam o portal cunhadas
        if (portalEscolhido !== 'cunhadas') {
          await supabase.auth.signOut();
          setLoading(false);
          setModalAcessoNegado(true);
          return;
        }

        // Apenas presidente e tesoureira têm acesso (por enquanto)
        const cargosPermitidosCunhadas = ['presidente', 'tesoureira'];
        if (!cargosPermitidosCunhadas.includes(dadosCunhada.cargo)) {
          await supabase.auth.signOut();
          setLoading(false);
          setModalAcessoNegado(true);
          return;
        }

        console.log('✅ Cunhada autorizada — cargo:', dadosCunhada.cargo);
        sessionStorage.setItem('portalAtivo', 'cunhadas');
        sessionStorage.setItem('tipoPerfil', 'cunhada');
        setSession(data.session);
        setPortalAtivo('cunhadas');
        setCurrentPage('dashboard-cunhadas');
        setLoading(false);
        setPerfilCarregado(true);
        return; // Cunhada não carrega dados dos irmãos
      }

      // ── Fluxo IRMÃO ────────────────────────────────────────────
      // PASSO 2B: Buscar dados do irmão (incluindo cargo)
      const { data: userData } = await supabase
        .from('usuarios')
        .select('*, cargo')
        .eq('email', emailParam)
        .single();

      console.log('👤 Irmão carregado:', { cargo: userData?.cargo, ativo: userData?.ativo });

      if (!userData?.ativo) {
        await supabase.auth.signOut();
        throw new Error('Usuário inativo. Entre em contato com o administrador.');
      }

      // PASSO 3: VALIDAR PERMISSÃO (portal cunhadas: só admin e venerável)
      if (portalEscolhido === 'cunhadas') {
        console.log('🔍 Validando permissão de irmão para portal cunhadas...');

        const cargosComAcesso = ['administrador', 'veneravel', 'Veneravel'];
        const temPermissaodireta = cargosComAcesso.includes(userData?.cargo) ||
                                   userData?.nivel_acesso === 'admin';

        if (!temPermissaodireta) {
          const { data: perms } = await supabase
            .from('permissoes')
            .select('pode_acessar_portal_cunhadas')
            .eq('cargo', userData.cargo)
            .single();

          if (!perms?.pode_acessar_portal_cunhadas) {
            await supabase.auth.signOut();
            setLoading(false);
            setModalAcessoNegado(true);
            return;
          }
        }

        console.log('✅ Irmão autorizado para portal cunhadas');
      }

      // PASSO 4: SÓ AGORA (após validação OK) - Atualizar estados
      console.log('✅ Atualizando estados...');
      sessionStorage.setItem('portalAtivo', portalEscolhido); // persiste enquanto a aba estiver aberta
      setSession(data.session);
      loadUserData(emailParam);
      setPortalAtivo(portalEscolhido);
      
      // PASSO 5: Redirecionar para página correta
      if (portalEscolhido === 'cunhadas') {
        console.log('📍 Redirecionando para dashboard-cunhadas');
        setCurrentPage('dashboard-cunhadas');
      } else {
        console.log('📍 Redirecionando para dashboard');
        setCurrentPage('dashboard');
      }
      
      // Registrar log de login
      try {
        const { data: user } = await supabase
          .from('usuarios')
          .select('id, nome')
          .eq('email', emailParam)
          .single();
        
        if (user) {
          await supabase
            .from('logs_acesso')
            .insert([{
              usuario_id: user.id,
              acao: 'login',
              detalhes: `${user.nome} fez login no sistema`,
              ip: 'Browser',
              user_agent: navigator.userAgent
            }]);
        }
      } catch (logError) {
        console.error('Erro ao registrar log:', logError);
      }
      
      loadIrmaos();
      loadTiposSessao();
      loadCargosLoja();
      loadBalaustres();
    } catch (error) {
      console.error('❌ Erro no handleLogin:', error.message);
      setError(error.message);
      setLoading(false);
      throw error; // RE-LANÇAR o erro para o Login.jsx capturar!
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem('portalAtivo');
    sessionStorage.removeItem('tipoPerfil');
    setSession(null);
    setUserData(null);
    setPermissoes(null);
    setCurrentPage('dashboard');
    setPortalAtivo('irmaos'); // Resetar para portal irmãos
    setAreaEscolhida(null); // Resetar escolha Loja/Arco Real pro próximo login
    setPerfilCarregado(false); // Reexibe a tela de carregamento no próximo login
    telasJaAcessadasRef.current.clear(); // Próximo login registra tudo de novo
  };

  // ========================================
  // FUNÇÕES PARA IRMÃOS
  // ========================================

  // ========================================
  // ========================================
  // FUNÇÕES PARA USUÁRIOS
  // ========================================
  const handleSubmitUsuario = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      console.log('💾 Criando novo usuário:', usuarioForm.email);

      // Criar usuário no Auth usando signUp
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: usuarioForm.email,
        password: usuarioForm.senha,
        options: {
          data: {
            nome: usuarioForm.nome
          }
        }
      });

      if (authError) throw authError;

      // Inserir dados complementares na tabela usuarios
      const { error: dbError } = await supabase
        .from('usuarios')
        .insert([{
          email: usuarioForm.email,
          nome: usuarioForm.nome,
          cargo: usuarioForm.cargo,
          ativo: usuarioForm.ativo
        }]);

      if (dbError) throw dbError;

      setSuccessMessage('✅ Usuário criado com sucesso! Um email de confirmação foi enviado.');
      loadUsuarios();
      limparFormularioUsuario();

      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);

    } catch (error) {
      console.error('❌ Erro ao criar usuário:', error);
      setError('Erro ao criar usuário: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAtualizarUsuario = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      console.log('💾 Atualizando usuário:', usuarioEditando.email);

      const { error } = await supabase
        .from('usuarios')
        .update({
          nome: usuarioForm.nome,
          cargo: usuarioForm.cargo,
          ativo: usuarioForm.ativo
        })
        .eq('id', usuarioEditando.id);

      if (error) throw error;

      // Se tem nova senha, atualizar no Auth
      if (usuarioForm.senha) {
        // Buscar o usuário no Auth pelo email para obter o UUID correto
        const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
        
        if (listError) throw listError;
        
        // Encontrar o usuário pelo email
        const authUser = authUsers.users.find(u => u.email === usuarioEditando.email);
        
        if (authUser) {
          // Usar o UUID correto do Auth
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            authUser.id,  // UUID do auth.users
            { password: usuarioForm.senha }
          );
          
          if (updateError) throw updateError;
        } else {
          throw new Error('Usuário não encontrado no sistema de autenticação');
        }
      }

      setSuccessMessage('Usuário atualizado com sucesso!');
      loadUsuarios();
      limparFormularioUsuario();

      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);

    } catch (error) {
      console.error('❌ Erro ao atualizar usuário:', error);
      setError('Erro ao atualizar usuário: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditarUsuario = (usuario) => {
    setModoEdicaoUsuario(true);
    setUsuarioEditando(usuario);
    setUsuarioForm({
      nome: usuario.nome,
      email: usuario.email,
      senha: '', // Não carregar senha
      cargo: usuario.cargo,
      ativo: usuario.ativo
    });
  };

  const handleExcluirUsuario = async (usuario) => {
    if (!window.confirm(`Tem certeza que deseja excluir o usuário ${usuario.nome}?`)) return;

    setLoading(true);
    try {
      console.log('🗑️ Excluindo usuário:', usuario.email);

      // Excluir do banco
      const { error: dbError } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', usuario.id);

      if (dbError) throw dbError;

      // Excluir do Auth (se necessário)
      // Note: pode requerer privilégios de admin
      
      setSuccessMessage('Usuário excluído com sucesso!');
      loadUsuarios();

      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);

    } catch (error) {
      console.error('❌ Erro ao excluir usuário:', error);
      setError('Erro ao excluir usuário: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const limparFormularioUsuario = () => {
    setUsuarioForm({
      nome: '',
      email: '',
      senha: '',
      cargo: 'irmao',
      ativo: true
    });
    setModoEdicaoUsuario(false);
    setUsuarioEditando(null);
  };

  const getPermissoesUsuario = (cargo) => {
    return permissoesDisponiveis.find(p => p.cargo === cargo);
  };

  // ========================================
  // ========================================
  // FUNÇÕES PARA CORPO ADMINISTRATIVO
  // ========================================
  const handleSubmitCorpoAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      console.log('💾 Salvando cargo administrativo...');

      const { error } = await supabase
        .from('corpo_administrativo')
        .insert([corpoAdminForm]);

      if (error) throw error;

      setSuccessMessage('✅ Cargo cadastrado com sucesso!');
      limparFormularioCorpoAdmin();
      loadCorpoAdmin();

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('❌ Erro ao cadastrar cargo:', err);
      setError('Erro ao cadastrar cargo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAtualizarCorpoAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      console.log('💾 Atualizando cargo administrativo...');

      const { error } = await supabase
        .from('corpo_administrativo')
        .update(corpoAdminForm)
        .eq('id', corpoAdminEditando.id);

      if (error) throw error;

      setSuccessMessage('✅ Cargo atualizado com sucesso!');
      limparFormularioCorpoAdmin();
      loadCorpoAdmin();

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('❌ Erro ao atualizar cargo:', err);
      setError('Erro ao atualizar cargo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditarCorpoAdmin = (item) => {
    setModoEdicaoCorpoAdmin(true);
    setCorpoAdminEditando(item);
    setCorpoAdminForm({
      irmao_id: item.irmao_id,
      cargo: item.cargo,
      ano_exercicio: item.ano_exercicio
    });
  };

  const limparFormularioCorpoAdmin = () => {
    setCorpoAdminForm({ irmao_id: '', cargo: '', ano_exercicio: '' });
    setModoEdicaoCorpoAdmin(false);
    setCorpoAdminEditando(null);
  };

  const handleExcluirCorpoAdmin = async (id) => {
    if (!window.confirm('Tem certeza que deseja remover este cargo?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('corpo_administrativo')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuccessMessage('✅ Cargo removido!');
      loadCorpoAdmin();

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Erro ao remover: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // FUNÇÃO PARA GERAR PDF
  // ========================================
  const gerarPDFIrmao = async (irmao) => {
    try {
      console.log('📄 Gerando PDF para:', irmao.nome);

      // Buscar dados familiares
      const { data: esposaData } = await supabase
        .from('esposas')
        .select('*')
        .eq('irmao_id', irmao.id)
        .single();

      const { data: paisData } = await supabase
        .from('pais')
        .select('*')
        .eq('irmao_id', irmao.id);

      const { data: filhosData } = await supabase
        .from('filhos')
        .select('*')
        .eq('irmao_id', irmao.id);

      const pai = paisData?.find(p => p.tipo === 'pai');
      const mae = paisData?.find(p => p.tipo === 'mae');

      // Criar conteúdo HTML para o PDF
      let htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Ficha - ${irmao.nome}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1e40af; padding-bottom: 20px; }
    .header h1 { color: #1e40af; margin: 0; font-size: 24px; }
    .header h2 { color: #666; margin: 5px 0 0 0; font-size: 16px; }
    .section { margin: 25px 0; page-break-inside: avoid; }
    .section-title { background: #1e40af; color: white; padding: 10px; font-size: 16px; font-weight: bold; margin-bottom: 15px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .info-item { margin-bottom: 10px; }
    .info-label { font-weight: bold; color: #1e40af; display: block; margin-bottom: 3px; }
    .info-value { color: #333; display: block; padding-left: 10px; }
    .family-member { background: #f3f4f6; padding: 15px; margin: 10px 0; border-left: 4px solid #1e40af; }
    .footer { text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid #ccc; color: #666; font-size: 12px; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${NOME_LOJA}</h1>
    <h2>Ficha Cadastral de Irmão</h2>
  </div>

  <div class="section">
    <div class="section-title">📋 DADOS PESSOAIS</div>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">Nome Completo:</span><span class="info-value">${irmao.nome || '-'}</span></div>
      <div class="info-item"><span class="info-label">CIM:</span><span class="info-value">${irmao.cim || '-'}</span></div>
      <div class="info-item"><span class="info-label">CPF:</span><span class="info-value">${irmao.cpf || '-'}</span></div>
      <div class="info-item"><span class="info-label">RG:</span><span class="info-value">${irmao.rg || '-'}</span></div>
      <div class="info-item"><span class="info-label">Data de Nascimento:</span><span class="info-value">${formatarData(irmao.data_nascimento)}</span></div>
      <div class="info-item"><span class="info-label">Naturalidade:</span><span class="info-value">${irmao.naturalidade || '-'}</span></div>
      <div class="info-item"><span class="info-label">Estado Civil:</span><span class="info-value">${rotuloEstadoCivilCompleto(irmao.estado_civil, irmao.uniao_estavel) || '-'}</span></div>
      <div class="info-item"><span class="info-label">Profissão:</span><span class="info-value">${irmao.profissao || '-'}</span></div>
      <div class="info-item"><span class="info-label">Formação:</span><span class="info-value">${irmao.formacao || '-'}</span></div>
      <div class="info-item"><span class="info-label">Situação:</span><span class="info-value">${irmao.situacao || 'Regular'}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">📍 CONTATO</div>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">Endereço:</span><span class="info-value">${irmao.endereco || '-'}</span></div>
      <div class="info-item"><span class="info-label">Cidade:</span><span class="info-value">${irmao.cidade || '-'}</span></div>
      <div class="info-item"><span class="info-label">Celular:</span><span class="info-value">${irmao.celular || '-'}</span></div>
      <div class="info-item"><span class="info-label">Email:</span><span class="info-value">${irmao.email || '-'}</span></div>
      <div class="info-item"><span class="info-label">Local de Trabalho:</span><span class="info-value">${irmao.local_trabalho || '-'}</span></div>
      <div class="info-item"><span class="info-label">Cargo:</span><span class="info-value">${irmao.cargo || '-'}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">🔺 DADOS MAÇÔNICOS</div>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">Data de Iniciação:</span><span class="info-value">${formatarData(irmao.data_iniciacao)}</span></div>
      <div class="info-item"><span class="info-label">Data de Elevação:</span><span class="info-value">${formatarData(irmao.data_elevacao)}</span></div>
      <div class="info-item"><span class="info-label">Data de Exaltação:</span><span class="info-value">${formatarData(irmao.data_exaltacao)}</span></div>
      <div class="info-item"><span class="info-label">Grau Atual:</span><span class="info-value">${obterGrau(irmao)}</span></div>
    </div>
  </div>`;

      if (esposaData) {
        htmlContent += `<div class="section"><div class="section-title">💑 ESPOSA</div><div class="family-member">
<div class="info-item"><span class="info-label">Nome:</span><span class="info-value">${esposaData.nome || '-'}</span></div>
<div class="info-item"><span class="info-label">Data de Nascimento:</span><span class="info-value">${formatarData(esposaData.data_nascimento)}</span></div>
</div></div>`;
      }

      if (pai || mae) {
        htmlContent += `<div class="section"><div class="section-title">👨‍👩‍👦 PAIS</div>`;
        if (pai) {
          htmlContent += `<div class="family-member"><div class="info-item"><span class="info-label">Pai:</span><span class="info-value">${pai.nome || '-'}</span></div>
<div class="info-item"><span class="info-label">Data de Nascimento:</span><span class="info-value">${formatarData(pai.data_nascimento)}</span></div>
${pai.falecido ? `<div class="info-item"><span class="info-label">Status:</span><span class="info-value">🕊️ Falecido em ${formatarData(pai.data_obito)}</span></div>` : ''}</div>`;
        }
        if (mae) {
          htmlContent += `<div class="family-member"><div class="info-item"><span class="info-label">Mãe:</span><span class="info-value">${mae.nome || '-'}</span></div>
<div class="info-item"><span class="info-label">Data de Nascimento:</span><span class="info-value">${formatarData(mae.data_nascimento)}</span></div>
${mae.falecido ? `<div class="info-item"><span class="info-label">Status:</span><span class="info-value">🕊️ Falecida em ${formatarData(mae.data_obito)}</span></div>` : ''}</div>`;
        }
        htmlContent += `</div>`;
      }

      if (filhosData && filhosData.length > 0) {
        htmlContent += `<div class="section"><div class="section-title">👶 FILHOS</div>`;
        filhosData.forEach((filho, index) => {
          htmlContent += `<div class="family-member"><div class="info-item"><span class="info-label">Filho(a) ${index + 1}:</span><span class="info-value">${filho.nome || '-'}</span></div>
<div class="info-item"><span class="info-label">Data de Nascimento:</span><span class="info-value">${formatarData(filho.data_nascimento)}</span></div>
${filho.falecido ? `<div class="info-item"><span class="info-label">Status:</span><span class="info-value">🕊️ Falecido(a) em ${formatarData(filho.data_obito)}</span></div>` : ''}</div>`;
        });
        htmlContent += `</div>`;
      }

      htmlContent += `<div class="footer"><p>Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p><p>${NOME_LOJA}</p></div></body></html>`;

      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Ficha_${irmao.nome.replace(/\s+/g, '_')}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setSuccessMessage('✅ Arquivo HTML gerado! Abra no navegador e use Ctrl+P para salvar em PDF.');
      setTimeout(() => setSuccessMessage(''), 5000);

    } catch (error) {
      console.error('❌ Erro ao gerar PDF:', error);
      setError('Erro ao gerar arquivo: ' + error.message);
    }
  };

  // ========================================
  // RENDERIZAÇÃO
  // ========================================
  if ((loading && !session) || (session && !perfilCarregado)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background:'#000' }}>
        <img src={LOGO_URL} alt="Acácia de Paranatinga" style={{ width:'12rem', height:'12rem', objectFit:'contain' }} />
      </div>
    );
  }

  if (!session) {
    return <Login 
      onLogin={handleLogin} 
      modalAcessoNegado={modalAcessoNegado}
      onFecharModalAcessoNegado={() => setModalAcessoNegado(false)}
    />;
  }

  // ── Roteamento Loja x Arco Real ─────────────────────────────────────────
  // Usuário SEM nenhum vínculo com a Loja (nivel_acesso dedicado) — nunca
  // vê nada do sistema da Acácia, cai direto na área do Arco Real.
  if (userData?.nivel_acesso === 'arco_real') {
    return (
      <ArcoRealApp
        userData={userData}
        permissoes={permissoes}
        meuMembroId={userData?.arco_real_membro_id || null}
        podeVoltarLoja={false}
        onSair={handleLogout}
        showSuccess={showSuccess}
        showError={showError}
        successMessage={successMessage}
        errorMessage={error}
      />
    );
  }

  // Usuário que acumula os dois acessos (é irmão da Loja E tem a permissão
  // de Arco Real marcada) — escolhe qual área usar nesta sessão.
  if (permissoes?.canViewArcoReal) {
    if (areaEscolhida === null) {
      return (
        <EscolhaArea
          nomeUsuario={userData?.nome}
          onEscolher={(area) => setAreaEscolhida(area)}
          onSair={handleLogout}
        />
      );
    }
    if (areaEscolhida === 'arco_real') {
      return (
        <ArcoRealApp
          userData={userData}
          permissoes={permissoes}
          meuMembroId={userData?.arco_real_membro_id || null}
          podeVoltarLoja={true}
          onTrocarSistema={() => setAreaEscolhida(null)}
          onSair={handleLogout}
          showSuccess={showSuccess}
          showError={showError}
          successMessage={successMessage}
          errorMessage={error}
        />
      );
    }
    // areaEscolhida === 'loja' → segue o fluxo normal abaixo
  }

  // Contagens por situação
  const irmaosRegulares = irmaos.filter(i => i.situacao === 'Regular');
  const irmaosIrregulares = irmaos.filter(i => i.situacao === 'Irregular');
  const irmaosLicenciados = irmaos.filter(i => i.situacao === 'Licenciado');
  const irmaosSuspensos = irmaos.filter(i => i.situacao === 'Suspenso');
  const irmaosDesligados = irmaos.filter(i => i.situacao === 'Desligado');
  const irmaosExcluidos = irmaos.filter(i => i.situacao === 'Excluído');
  const irmaosFalecidos = irmaos.filter(i => i.situacao === 'Falecido');
  const irmaosExOficio = irmaos.filter(i => i.situacao === 'Ex-Ofício');
  
  const totalIrmaos = irmaos.length;

  // Função para determinar o grau do irmão
  const obterGrau = (irmao) => {
    if (irmao.data_exaltacao) {
      return irmao.mestre_instalado ? 'Mestre Instalado' : 'Mestre';
    }
    if (irmao.data_elevacao) return 'Companheiro';
    if (irmao.data_iniciacao) return 'Aprendiz';
    return 'Não Iniciado';
  };

  // Contagem por grau (apenas regulares)
  const irmaosAprendiz = irmaosRegulares.filter(i => obterGrau(i) === 'Aprendiz').length;
  const irmaosCompanheiro = irmaosRegulares.filter(i => obterGrau(i) === 'Companheiro').length;
  const irmaosMestre = irmaosRegulares.filter(i => obterGrau(i) === 'Mestre').length;
  const irmaosMestreInstalado = irmaosRegulares.filter(i => obterGrau(i) === 'Mestre Instalado').length;
  const totalMestres = irmaosMestre + irmaosMestreInstalado;


  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* SIDEBAR LATERAL COLAPSÁVEL */}
      <aside className={`${menuAberto ? 'w-64' : 'w-16'} bg-gradient-to-b from-blue-900 to-indigo-900 text-white fixed h-screen shadow-2xl flex flex-col transition-all duration-300`}>
        {/* Logo e Título */}
        <div className="p-4 border-b border-primary-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            {menuAberto && (
              <div className="flex flex-col items-center flex-1">
                <img src={LOGO_URL} alt="Logo" className="w-16 h-16 rounded-full border-4 border-white mb-2" />
                <h1 className="text-sm font-bold text-center leading-tight">{NOME_LOJA}</h1>
                <p className="text-xs text-blue-200 mt-1">Gestão e Controle</p>
              </div>
            )}
            {!menuAberto && (
              <img src={LOGO_URL} alt="Logo" className="w-10 h-10 rounded-full border-2 border-white mx-auto" />
            )}
          </div>
          {/* Botão Hamburger */}
          <button
            onClick={() => setMenuAberto(!menuAberto)}
            className="absolute top-4 right-2 p-2 hover:bg-primary-800 rounded-lg transition"
            title={menuAberto ? "Fechar menu" : "Abrir menu"}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuAberto ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Menu de Navegação */}
        <nav className="py-2 flex-1 overflow-y-auto">
          {/* MOSTRAR MENU APENAS SE ESTIVER NO PORTAL DOS IRMÃOS */}
          {portalAtivo === 'irmaos' && (
            <MenuLoja
              userData={userData}
              mapa={mapaPermissoes}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              menuAberto={menuAberto}
              irmaoLogadoId={irmaoLogadoId}
              onAbrirMeuPerfilCompleto={() => {
                if (irmaoLogadoId) {
                  setIrmaoIdPerfilCompleto(irmaoLogadoId);
                  setModalPerfilCompletoAberto(true);
                }
              }}
            />
          )}

          {/* MENU PORTAL CUNHADAS */}
          {portalAtivo === 'cunhadas' && (
            <>
              <button
                onClick={() => setCurrentPage('dashboard-cunhadas')}
                className={`w-full px-4 py-2 flex items-center gap-2 transition text-sm ${
                  currentPage === 'dashboard-cunhadas'
                    ? 'bg-primary-700 border-l-4 border-white'
                    : 'hover:bg-primary-800'
                }`}
                title="Dashboard Cunhadas"
              >
                <span className="text-base">💜</span>
                {menuAberto && <span className="font-semibold">Dashboard</span>}
              </button>

              <button
                onClick={() => setCurrentPage('cadastro-cunhadas')}
                className={`w-full px-4 py-2 flex items-center gap-2 transition text-sm ${
                  currentPage === 'cadastro-cunhadas'
                    ? 'bg-primary-700 border-l-4 border-white'
                    : 'hover:bg-primary-800'
                }`}
                title="Cadastro Cunhadas"
              >
                <span className="text-base">👥</span>
                {menuAberto && <span className="font-semibold">Cadastro</span>}
              </button>

              <button
                onClick={() => setCurrentPage('financeiro-cunhadas')}
                className={`w-full px-4 py-2 flex items-center gap-2 transition text-sm ${
                  currentPage === 'financeiro-cunhadas'
                    ? 'bg-primary-700 border-l-4 border-white'
                    : 'hover:bg-primary-800'
                }`}
                title="Financeiro Cunhadas"
              >
                <span className="text-base">💰</span>
                {menuAberto && <span className="font-semibold">Financeiro</span>}
              </button>

              <button
                onClick={() => setCurrentPage('relatorios-cunhadas')}
                className={`w-full px-4 py-2 flex items-center gap-2 transition text-sm ${
                  currentPage === 'relatorios-cunhadas'
                    ? 'bg-primary-700 border-l-4 border-white'
                    : 'hover:bg-primary-800'
                }`}
                title="Relatórios Cunhadas"
              >
                <span className="text-base">📊</span>
                {menuAberto && <span className="font-semibold">Relatórios</span>}
              </button>
            </>
          )}
        </nav>

        {/* Botão Sair */}
        <div className="border-t border-primary-700 bg-primary-900 p-3 flex-shrink-0">
          <button
            onClick={handleLogout}
            className="w-full bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-semibold transition flex items-center justify-center gap-2 text-sm"
          >
            <span>🚪</span>
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main 
        className={`flex-1 ${menuAberto ? 'ml-64' : 'ml-16'} transition-all duration-300 min-h-screen`}
        style={{ background: 'var(--color-bg)' }}
      >
        {/* HEADER SUPERIOR */}
        <header 
          className="shadow-md sticky top-0 z-40"
          style={{
            background: 'linear-gradient(to right, rgb(var(--color-primary-600)), rgb(var(--color-primary-700)))',
            borderBottom: '2px solid rgb(var(--color-primary-800))'
          }}
        >
          <div className="px-8 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {currentPage === 'dashboard' && '📊 Dashboard'}
                  {currentPage === 'dashboard-cunhadas' && '💜 Dashboard Cunhadas'}
                  {currentPage === 'meu-cadastro' && '👤 Meu Cadastro'}
                  {currentPage === 'minhas-financas' && '💰 Minhas Finanças'}
                  {currentPage === 'minhas-presencas' && '📊 Minhas Presenças'}
                  {currentPage === 'cadastro' && '➕ Cadastro de Irmãos'}
                  {currentPage === 'visualizar' && '👥 Visualizar Irmãos'}
                  {currentPage === 'quadro' && '📋 Quadro de Irmãos'}
                  {currentPage === 'comendas' && '🎖️ Comendas'}
                  {currentPage === 'balaustres' && '📜 Balaustres'}
                  {currentPage === 'pranchas' && '📄 Pranchas Expedidas'}
                  {currentPage === 'editais' && '📢 Editais'}
                  {currentPage === 'corpo-admin' && '👔 Corpo Administrativo'}
                  {currentPage === 'eleicao-posse' && '🗳️ Eleição e Posse'}
                  {currentPage === 'projetos' && '📊 Projetos'}
                  {currentPage === 'comissoes' && '📋 Comissões'}
                  {currentPage === 'biblioteca' && '📚 Biblioteca'}
                  {currentPage === 'biblioteca-online' && '📖 Biblioteca Online'}
                  {currentPage === 'cronograma' && '📅 Cronograma Anual'}
                  {currentPage === 'financas-loja' && '🏦 Finanças da Loja'}
                  {currentPage === 'creditos-debitos' && '💰 Créditos e Débitos'}
                  {currentPage === 'lancamentos-lote' && '📦 Lançamentos em Lote'}
                  {currentPage === 'categorias-financeiras' && '🏷️ Categorias Financeiras'}
                  {currentPage === 'eventos-comemorativos' && '🍽️ Ágape & Festas'}
                  {currentPage === 'email-irmaos' && '📧 Central E-Mail'}
                  {currentPage === 'relatorio-financeiro' && '📊 Conferir Finanças'}
                  {currentPage === 'auditoria-financeira' && '🔍 Auditoria Financeira'}
                  {currentPage === 'obrigacoes' && '🧾 Obrigações'}
                  {currentPage === 'lojas-visitantes' && '🏛️ Lojas Maçônicas'}
                  {currentPage === 'caridade' && '❤️ Caridade'}
                  {currentPage === 'eventos' && '🎉 Eventos'}
                  {currentPage === 'aniversariantes' && '🎉 Festividades'}
                  {currentPage === 'dashboard-presenca' && '📊 Dashboard de Presença'}
                  {currentPage === 'cadastro-sessao' && '📋 Cadastro de Sessão'}
                  {currentPage === 'lista-sessoes' && '📊 Sessões Realizadas'}
                  {currentPage === 'registro-presenca' && '✅ Registro de Presença'}
                  {currentPage === 'comodatos' && '♿ Controle de Comodatos'}
                  {currentPage === 'altos-graus' && '🔺 Altos Graus'}
                  {currentPage === 'gerenciar-graus' && '⚙️ Gerenciar Graus'}
                  {currentPage === 'perfil-irmao' && '👤 Perfil do Irmão'}
                  {currentPage === 'usuarios' && '👤 Gerenciar Usuários'}
                  {currentPage === 'dados-loja' && '🏛️ Dados da Loja'}
                  {currentPage === 'sobre' && 'ℹ️ Sobre o Sistema'}
                  {currentPage === 'sindicancia' && '🔍 Sindicância'}
                </h2>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-semibold text-sm text-white">{userData?.nome}</p>
                  <p className="text-xs text-white opacity-80 capitalize">{userData?.cargo}</p>
                </div>
                <div className="text-sm text-white opacity-90">
                  {new Date().toLocaleDateString('pt-BR', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* MENSAGENS */}
        {error && (
          <div className="px-8 mt-4">
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg">
              {error}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="px-8 mt-4">
            <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded-lg">
              {successMessage}
            </div>
          </div>
        )}

        {/* CONTEÚDO DAS PÁGINAS */}
        <div>
        {/* DASHBOARD */}
        {currentPage === 'dashboard' && (
          <Dashboard 
            irmaos={irmaos}
            balaustres={balaustres}
            cronograma={cronograma}
          />
        )}

        {/* DASHBOARD CUNHADAS */}
        {currentPage === 'dashboard-cunhadas' && (
          <DashboardCunhadas 
            userData={userData}
            onNavigate={(page) => setCurrentPage(page)}
          />
        )}

        {/* CADASTRO CUNHADAS */}
        {currentPage === 'cadastro-cunhadas' && (
          <CadastroCunhadas
            userData={userData}
          />
        )}

        {/* FINANCEIRO CUNHADAS */}
        {currentPage === 'financeiro-cunhadas' && (
          <FinanceiroCunhadas
            userData={userData}
          />
        )}

        {/* ACESSO CUNHADAS */}
        {currentPage === 'acesso-cunhadas' && permissoes?.canManageUsers && (
          <AcessoCunhadas />
        )}

        {/* CADASTRO DE IRMÃOS */}
        {currentPage === 'cadastro' && (
          <CadastrarIrmao
            irmaos={irmaos}
            irmaoParaEditar={irmaoParaEditar}
            onUpdate={loadIrmaos}
            showSuccess={showSuccess}
            showError={showError}
            onCancelarEdicao={() => setIrmaoParaEditar(null)}
            userData={userData}
          />
        )}

        {/* VISUALIZAR IRMÃOS */}
        {currentPage === 'visualizar' && (
          <VisualizarIrmaos
            irmaos={irmaos}
            onEdit={(irmao) => {
              setIrmaoParaEditar(irmao);
              setCurrentPage('cadastro');
            }}
            onViewProfile={(irmaoId) => {
              setIrmaoParaPerfil(irmaoId);
              setCurrentPage('perfil-irmao');
            }}
            onViewPerfilCompleto={(irmaoId) => {
              setIrmaoIdPerfilCompleto(irmaoId);
              setModalPerfilCompletoAberto(true);
            }}
            onUpdate={loadIrmaos}
            showSuccess={showSuccess}
            showError={showError}
            permissoes={permissoes}
            userEmail={userData?.email}
            userData={userData}
          />
        )}

        {/* QUADRO DE IRMÃOS */}
        {currentPage === 'quadro' && (
          <QuadroIrmaos irmaos={irmaos} />
        )}

        {currentPage === 'modelos-documentos' && (
          <ModelosDocumentos
            onVoltar={retornoModelos ? () => { const p = retornoModelos; setRetornoModelos(null); setCurrentPage(p); } : null}
            rotuloVoltar={retornoModelos === 'balaustres' ? 'Balaustres' : 'Eleição e Posse'}
            modulo={retornoModelos === 'balaustres' ? 'balaustres' : retornoModelos === 'eleicao-posse' ? 'eleicao_posse' : null}
            permissoes={{ ...permissoes, pode_editar_corpo_admin: pode(mapaPermissoes, 'modelos', 'editar') }}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}

        {currentPage === 'comendas' && (
          <Comendas permissoes={{ ...permissoes, canEdit: pode(mapaPermissoes, 'comendas', 'editar') }} userData={userData} showSuccess={showSuccess} showError={showError} />
        )}


        {/* CONTROLE DE BALAUSTRES */}
        {currentPage === 'balaustres' && (
          <Balaustres
            balaustres={balaustres}
            tiposSessao={tiposSessao}
            session={session}
            onUpdate={() => loadBalaustres()}
            showSuccess={showSuccess}
            showError={showError}
            permissoes={permissoes}
            podeEditarModelos={pode(mapaPermissoes, 'modelos', 'editar')}
            onAbrirModelos={() => { setRetornoModelos('balaustres'); setCurrentPage('modelos-documentos'); }}
            onAbrirEleicaoPosse={() => setCurrentPage('eleicao-posse')}
            grauUsuario={grauUsuarioLogado}
          />
        )}



        {/* GERENCIAMENTO DE USUÁRIOS */}
        {/* GERENCIAR USUÁRIOS - VERSÃO ANTIGA (mantida para compatibilidade) */}
        {currentPage === 'usuarios' && permissoes?.canManageUsers && (
          <Usuarios
            usuarios={usuarios}
            userData={userData}
            onUpdate={loadUsuarios}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}

        {/* GESTÃO DO SISTEMA - NOVA VERSÃO UNIFICADA */}
        {(currentPage === 'gestao-sistema-usuarios' || currentPage === 'gestao-sistema-logs') && permissoes?.canManageUsers && (
          <GestaoSistema
            usuarios={usuarios}
            userData={userData}
            onUpdate={loadUsuarios}
            showSuccess={showSuccess}
            showError={showError}
            abaInicial={currentPage === 'gestao-sistema-logs' ? 'logs' : 'usuarios'}
          />
        )}

        {/* DADOS DA LOJA */}
        {currentPage === 'dados-loja' && isAdminOrVeneravel() && (
          <DadosLoja
            showSuccess={showSuccess}
            showError={showError}
          />
        )}

        {/* MEU CADASTRO - Irmão */}
        {currentPage === 'meu-cadastro' && (
          <MeuCadastroWrapper
            userEmail={userData?.email}
            userData={userData}
            permissoes={permissoes}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}

        {/* MINHAS FINANÇAS - Irmão */}
        {currentPage === 'minhas-financas' && (
          <MinhasFinancas
            userEmail={userData?.email}
          />
        )}

        {/* MINHAS PRESENÇAS - Irmão */}
        {currentPage === 'minhas-presencas' && (
          <MinhaPresenca
            userData={userData}
          />
        )}


        {/* PRANCHAS EXPEDIDAS */}
        {currentPage === 'pranchas' && (
          <Pranchas
            pranchas={pranchas}
            onUpdate={loadPranchas}
            showSuccess={showSuccess}
            showError={showError}
            permissoes={permissoes}
            grauUsuario={grauUsuarioLogado}
          />
        )}

        {/* EDITAIS */}
        {currentPage === 'editais' && (
          <Editais
            editais={editais}
            onUpdate={loadEditais}
            showSuccess={showSuccess}
            showError={showError}
            permissoes={permissoes}
            grauUsuario={grauUsuarioLogado}
          />
        )}

        {/* SINDICÂNCIA */}
        {currentPage === 'sindicancia' && (
          <Sindicancia
            grauUsuario={grauUsuarioLogado}
            userData={userData}
          />
        )}

        {/* CORPO ADMINISTRATIVO */}
        {currentPage === 'corpo-admin' && (
          <CorpoAdmin
            corpoAdmin={corpoAdmin}
            irmaos={irmaos}
            permissoes={permissoes}
            onUpdate={loadCorpoAdmin}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}

        {currentPage === 'eleicao-posse' && (
          <EleicaoPosse
            irmaos={irmaos}
            userData={userData}
            permissoes={permissoes}
            podeEditarModelos={pode(mapaPermissoes, 'modelos', 'editar')}
            onAbrirModelos={() => { setRetornoModelos('eleicao-posse'); setCurrentPage('modelos-documentos'); }}
            onAbrirBalaustres={() => setCurrentPage('balaustres')}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}
        
        {/* ========================================
            PÁGINA: PROJETOS E COMISSÕES
            ======================================== */}

        {/* PROJETOS */}
        {currentPage === 'projetos' && (
          <Projetos
            showSuccess={showSuccess}
            showError={showError}
            permissoes={{
              ...permissoes,
              canEdit: permissoes?.pode_editar_projetos || false
            }}
          />
        )}

        {/* COMISSÕES */}
        {currentPage === 'comissoes' && (
          <Comissoes
            comissoes={comissoes}
            irmaos={irmaos}
            onUpdate={loadComissoes}
            showSuccess={showSuccess}
            showError={showError}
            permissoes={permissoes}
            userData={userData}
          />
        )}


        {/* BIBLIOTECA */}
        {currentPage === 'biblioteca' && (
          <Biblioteca
            livros={livros}
            emprestimos={emprestimos}
            irmaos={irmaos}
            onUpdate={() => {
              loadLivros();
              loadEmprestimos();
            }}
            showSuccess={showSuccess}
            showError={showError}
            permissoes={permissoes}
          />
        )}

        {currentPage === 'biblioteca-online' && (
          <BibliotecaOnline
            permissoes={permissoes}
            grauUsuario={grauUsuarioLogado}
            irmaoLogadoId={irmaoLogadoId}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}

        {/* CRONOGRAMA */}
        {currentPage === 'cronograma' && (
          <Cronograma
            showSuccess={showSuccess}
            showError={showError}
            userEmail={userData?.email}
            permissoes={{ ...permissoes, canEdit: pode(mapaPermissoes, 'cronograma', 'editar'), canEditMembers: pode(mapaPermissoes, 'cronograma', 'editar') }}
          />
        )}

        {/* FINANÇAS - LOJA */}
        {currentPage === 'financas-loja' && (
          <FinancasLoja
            showSuccess={showSuccess}
            showError={showError}
            userEmail={userData?.email}
            userData={userData}
            permissoes={permissoes}
            irParaAuditoria={() => setCurrentPage('auditoria-financeira')}
          />
        )}

        {/* CRÉDITOS E DÉBITOS */}
        {currentPage === 'creditos-debitos' && (
          <CreditosDebitos
            permissoes={permissoes}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}

        {/* LANÇAMENTOS EM LOTE */}
        {currentPage === 'lancamentos-lote' && (
          <LancamentosLote
            showSuccess={showSuccess}
            showError={showError}
            permissoes={permissoes}
          />
        )}

        {/* CATEGORIAS FINANCEIRAS */}
        {currentPage === 'categorias-financeiras' && (
          <CategoriasFinanceiras
            showSuccess={showSuccess}
            showError={showError}
            permissoes={permissoes}
          />
        )}

        {currentPage === 'eventos-comemorativos' && (
          <EventosComemorativos
            showSuccess={showSuccess}
            showError={showError}
            podeEditar={!!permissoes?.canEditFinancial}
          />
        )}

        {currentPage === 'email-irmaos' && (
          <EmailIrmaos
            showSuccess={showSuccess}
            showError={showError}
            permissoes={{ ...permissoes, canEditFinancial: pode(mapaPermissoes, 'email', 'editar'), canManageUsers: pode(mapaPermissoes, 'email', 'editar') }}
          />
        )}

        {currentPage === 'relatorio-financeiro' && (
          <RelatorioFinanceiro
            showError={showError}
          />
        )}

        {currentPage === 'obrigacoes' && (
          <Obrigacoes userData={userData} showSuccess={showSuccess} showError={showError} />
        )}

        {currentPage === 'auditoria-financeira' && (
          <AuditoriaFinanceira
            userData={userData}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}

        {/* CARIDADE */}
        {currentPage === 'caridade' && (
          <Caridade
            permissoes={permissoes}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}

        {/* EVENTOS */}
        {currentPage === 'eventos' && (
          <Eventos 
            userPermissions={{ ...permissoes, canManageUsers: pode(mapaPermissoes, 'eventos_filantropia', 'editar'), pode_gerenciar_usuarios: pode(mapaPermissoes, 'eventos_filantropia', 'editar') }}
            userData={userData}
          />
        )}

        {/* ALTOS GRAUS */}
        {currentPage === 'altos-graus' && (
          <VisualizarAltosGraus />
        )}

        {/* GERENCIAR GRAUS */}
        {currentPage === 'gerenciar-graus' && permissoes?.canManageUsers && (
          <GerenciarGraus
            showSuccess={showSuccess}
            showError={showError}
          />
        )}

        {/* PERFIL DO IRMÃO */}
        {currentPage === 'perfil-irmao' && irmaoParaPerfil && (
          <PerfilIrmao
            irmaoId={irmaoParaPerfil}
            onVoltar={() => {
              setCurrentPage('visualizar');
              setIrmaoParaPerfil(null);
            }}
            showSuccess={showSuccess}
            showError={showError}
            permissoes={permissoes}
            userEmail={userData?.email}
            userData={userData}
          />
        )}

        {/* ANIVERSARIANTES */}
        {currentPage === 'aniversariantes' && (
          <Aniversariantes permissoes={permissoes} />
        )}

        {/* COMODATOS */}
        {currentPage === 'comodatos' && (
          <Comodatos
            permissoes={permissoes}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}

        {/* CADASTRO DE SESSÃO */}
        {currentPage === 'cadastro-sessao' && (
          <CadastroSessao 
            onSessaoCriada={(sessaoId) => {
              setSessaoIdAtual(sessaoId);
              setOrigemRegistroPresenca('cadastro-sessao');
              setCurrentPage('registro-presenca');
            }}
          />
        )}

        {/* DASHBOARD DE PRESENÇA */}
        {currentPage === 'dashboard-presenca' && (
          <DashboardPresenca 
            onEditarPresenca={(sessaoId) => {
              setSessaoIdAtual(sessaoId);
              setOrigemRegistroPresenca('dashboard-presenca');
              setCurrentPage('registro-presenca');
            }}
          />
        )}

        {/* LISTA DE SESSÕES */}
        {currentPage === 'lista-sessoes' && (
          <ListaSessoes 
            onVisualizarPresenca={(sessaoId) => {
              setSessaoIdAtual(sessaoId);
              setCurrentPage('visualizar-presenca');
            }}
            onEditarPresenca={(sessaoId) => {
              setSessaoIdAtual(sessaoId);
              setOrigemRegistroPresenca('lista-sessoes');
              setCurrentPage('registro-presenca');
            }}
            onNovaSessao={() => setCurrentPage('cadastro-sessao')}
          />
        )}

        {/* VISUALIZAR PRESENÇA */}
        {currentPage === 'visualizar-presenca' && (
          <ModalVisualizarPresenca 
            sessaoId={sessaoIdAtual}
            onFechar={() => {
              setCurrentPage('lista-sessoes');
              setSessaoIdAtual(null);
            }}
          />
        )}

        {/* REGISTRO DE PRESENÇA */}
        {currentPage === 'registro-presenca' && (
          <RegistroPresenca 
            sessaoId={sessaoIdAtual}
            onVoltar={() => {
              setCurrentPage(origemRegistroPresenca);
              setSessaoIdAtual(null);
            }}
          />
        )}

        {/* SOBRE O SISTEMA */}
        {currentPage === 'sobre' && (
          <Sobre />
        )}

        {currentPage === 'estatisticas' && (
          <Estatisticas grauUsuario={grauUsuarioLogado} permissoes={permissoes} />
        )}

        {currentPage === 'lojas-visitantes' && (
          <LojasVisitantes showSuccess={showSuccess} showError={showError} permissoes={permissoes} />
        )}

        {currentPage === 'visao-geral' && (
          <VisaoGeral showError={showError} />
        )}
        </div> {/* Fecha div do conteúdo (px-8 py-6) */}
      </main>

      {/* MODAL PERFIL COMPLETO DO IRMÃO */}
      {modalPerfilCompletoAberto && irmaoIdPerfilCompleto && (
        <PerfilCompletoIrmao
          irmaoId={irmaoIdPerfilCompleto}
          userData={userData}
          irmaoLogadoId={irmaoLogadoId}
          onClose={() => {
            setModalPerfilCompletoAberto(false);
            setIrmaoIdPerfilCompleto(null);
          }}
        />
      )}
    </div>
  );
}
export default App;
