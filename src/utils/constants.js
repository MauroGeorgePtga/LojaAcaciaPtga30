// Estados Civis
export const ESTADOS_CIVIS = [
  { value: 'solteiro', label: 'Solteiro' },
  { value: 'casado', label: 'Casado' },
  { value: 'divorciado', label: 'Divorciado' },
  { value: 'viuvo', label: 'Viúvo' }
];

// Rótulo para exibição (ex.: 'viuvo' → 'Viúvo')
export const rotuloEstadoCivil = (valor) =>
  ESTADOS_CIVIS.find(ec => ec.value === valor)?.label || valor || '';

// União estável (complemento obrigatório do estado civil; não se aplica a casado)
export const uniaoEstavelPendente = (estadoCivil, uniao) =>
  estadoCivil !== 'casado' && uniao !== true && uniao !== false;

export const rotuloUniaoEstavel = (estadoCivil, uniao) =>
  estadoCivil === 'casado' ? '' : uniao === true ? 'Mantém união estável' : uniao === false ? 'Não mantém união estável' : 'União estável não informada';

// Ex.: "Solteiro · Mantém união estável"
export const rotuloEstadoCivilCompleto = (estadoCivil, uniao) =>
  [rotuloEstadoCivil(estadoCivil), estadoCivil ? rotuloUniaoEstavel(estadoCivil, uniao) : ''].filter(Boolean).join(' · ');

// Níveis de Escolaridade
export const NIVEIS_ESCOLARIDADE = [
  { value: 'fundamental_incompleto', label: 'Fundamental Incompleto' },
  { value: 'fundamental_completo', label: 'Fundamental Completo' },
  { value: 'medio_incompleto', label: 'Medio Incompleto' },
  { value: 'medio_completo', label: 'Medio Completo' },
  { value: 'superior_incompleto', label: 'Superior Incompleto' },
  { value: 'superior_completo', label: 'Superior Completo' },
  { value: 'pos_graduacao', label: 'Pos-Graduacao' },
  { value: 'mestrado', label: 'Mestrado' },
  { value: 'doutorado', label: 'Doutorado' }
];

// Status dos Irmãos
export const STATUS_IRMAOS = [
  { value: 'regular', label: 'Regular' },
  { value: 'irregular', label: 'Irregular' },
  { value: 'licenciado', label: 'Licenciado' },
  { value: 'suspenso', label: 'Suspenso' },
  { value: 'desligado', label: 'Quite Placet' },
  { value: 'excluido', label: 'Excluido' },
  { value: 'falecido', label: 'Falecido' },
  { value: 'ex_oficio', label: 'Ex-Oficio' }
];

// Estados do Brasil
export const ESTADOS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

// Graus Maçônicos
export const GRAUS_MACONICOS = [
  { value: 'aprendiz', label: 'Aprendiz' },
  { value: 'companheiro', label: 'Companheiro' },
  { value: 'mestre', label: 'Mestre' }
];

// Cargos Administrativos
export const CARGOS_ADMINISTRATIVOS = [
  'Veneravel Mestre',
  'Primeiro Vigilante',
  'Segundo Vigilante',
  'Orador',
  'Secretario',
  'Tesoureiro',
  'Chanceler',
  'Hospitaleiro',
  'Mestre de Cerimonia',
  'Mestre de Cerimonia Adjunto',
  '1º Experto',
  '2º Experto',
  'Mestre de Harmonia',
  'Mestre de Banquetes',
  'Porta Bandeira',
  'Porta Espada',
  'Porta Estandarte',
  '1º Diácono',
  '2º Diácono',
  'Cobridor Externo',
  'Guarda do Templo',
  'Arquiteto Decorador',
  'Bibliotecario'
];

// Tipos de Balaustre
export const TIPOS_BALAUSTRE = [
  { value: 'ordinaria', label: 'Sessao Ordinaria' },
  { value: 'extraordinaria', label: 'Sessao Extraordinaria' },
  { value: 'iniciacao', label: 'Iniciacao' },
  { value: 'elevacao', label: 'Elevacao' },
  { value: 'exaltacao', label: 'Exaltacao' },
  { value: 'magna', label: 'Sessao Magna' },
  { value: 'branca', label: 'Sessao Branca' },
  { value: 'fúnebre', label: 'Sessao Funebre' }
];

// Tipos de Prancha
export const TIPOS_PRANCHA = [
  { value: 'recebida', label: 'Recebida' },
  { value: 'expedida', label: 'Expedida' }
];

// Status de Prancha
export const STATUS_PRANCHA = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'respondida', label: 'Respondida' },
  { value: 'arquivada', label: 'Arquivada' }
];
