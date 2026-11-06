/**
 * COMPONENTE DASHBOARD
 * Sistema A∴R∴L∴S∴ Acácia de Paranatinga nº 30
 */

import React, { useMemo, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ParticipacaoComissoes from './ParticipacaoComissoes';

export const Dashboard = ({ irmaos, balaustres, cronograma = [] }) => {
  const [historicoSituacoes, setHistoricoSituacoes] = useState([]);
  const [irmaos100, setIrmaos100] = useState([]);
  const [totalVisitantes, setTotalVisitantes] = useState(0);
  const [modalSituacao, setModalSituacao] = useState({ aberto: false, titulo: '', irmaos: [] });
  const [historicoCargos, setHistoricoCargos] = useState([]);
  const [filtroComCargo, setFiltroComCargo] = useState(false);
  const [direcaoLoja, setDirecaoLoja] = useState({ veneravel: null, vig1: null, vig2: null, ano: null });
  
  // Estados para visitas
  const [visitasIrmaos, setVisitasIrmaos] = useState([]);
  const [totalVisitasIrmaos, setTotalVisitasIrmaos] = useState(0);
  const [modalVisitasIrmaos, setModalVisitasIrmaos] = useState(false);
  const [modalVisitantesRecebidos, setModalVisitantesRecebidos] = useState(false);
  const [visitantesRecebidos, setVisitantesRecebidos] = useState([]);
  const [visitasAutoridade, setVisitasAutoridade] = useState([]);
  const [totalVisitasAutoridade, setTotalVisitasAutoridade] = useState(0);
  const [modalVisitasAutoridade, setModalVisitasAutoridade] = useState(false);

  // Função para formatar nome (2 primeiros nomes + último se tiver "de/da")
  const formatarNome = (nomeCompleto) => {
    if (!nomeCompleto) return '';
    const partes = nomeCompleto.trim().split(' ');
    if (partes.length <= 2) return nomeCompleto;
    
    const primeiros = partes.slice(0, 2).join(' ');
    const temPreposicao = partes.some(p => ['de', 'da', 'do', 'das', 'dos'].includes(p.toLowerCase()));
    
    if (temPreposicao && partes.length > 2) {
      return `${primeiros} ${partes[partes.length - 1]}`;
    }
    return primeiros;
  };

  // Função para nome curto (para cards de visitas)
  const formatarNomeCurto = (nomeCompleto) => {
    if (!nomeCompleto) return '';
    const partes = nomeCompleto.trim().split(' ');
    if (partes.length <= 2) return nomeCompleto;
    
    const conectores = ['de', 'da', 'do', 'dos', 'das'];
    const temConector = partes.some(p => conectores.includes(p.toLowerCase()));
    
    if (temConector) {
      return `${partes[0]} ${partes[partes.length - 1]}`;
    }
    return `${partes[0]} ${partes[1]}`;
  };

  // Ranking dos 5 irmãos que mais visitaram outras lojas no ano — usado
  // no quadro de destaque no topo do modal "Visitas a Outras Lojas".
  const topVisitantesIrmaos = useMemo(() => {
    const contagem = {};
    visitasIrmaos.forEach(v => {
      const chave = v.irmao_id || v.irmaos?.nome || 'desconhecido';
      if (!contagem[chave]) contagem[chave] = { nome: v.irmaos?.nome || 'Irmão', qtd: 0 };
      contagem[chave].qtd += 1;
    });
    return Object.values(contagem).sort((a, b) => b.qtd - a.qtd).slice(0, 5);
  }, [visitasIrmaos]);

  // Função para obter cargo atual do irmão (do ano atual)
  const obterCargoAtual = (irmaoId) => {
    const anoAtual = new Date().getFullYear();
    const cargo = historicoCargos.find(c => c.irmao_id === irmaoId && c.ano === anoAtual);
    return cargo?.cargo || null;
  };

  useEffect(() => {
    const carregar = async () => {
      const { data } = await supabase
        .from('historico_situacoes')
        .select('*')
        .eq('status', 'ativa');
      setHistoricoSituacoes(data || []);
      
      // Carregar histórico de cargos
      const { data: cargosData } = await supabase
        .from('historico_cargos')
        .select('*');
      setHistoricoCargos(cargosData || []);
      
      // Carregar visitantes do ano
      const { count } = await supabase
        .from('visitantes_sessao')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${new Date().getFullYear()}-01-01`);
      setTotalVisitantes(count || 0);

      // Carregar visitas dos irmãos a outras lojas (ano atual)
      const { data: visitas, count: countVisitas } = await supabase
        .from('visitas_outras_lojas')
        .select(`
          *,
          irmaos(nome),
          potencias_masonicas(sigla, nome_completo)
        `, { count: 'exact' })
        .gte('data_visita', `${new Date().getFullYear()}-01-01`)
        .order('data_visita', { ascending: false });
      setVisitasIrmaos(visitas || []);
      setTotalVisitasIrmaos(countVisitas || 0);

      // Carregar visitantes recebidos detalhados
      const { data: visitantesData } = await supabase
        .from('visitantes_sessao')
        .select(`
          *,
          sessoes_presenca(data_sessao)
        `)
        .gte('created_at', `${new Date().getFullYear()}-01-01`)
        .order('created_at', { ascending: false });
      setVisitantesRecebidos(visitantesData || []);

      // Carregar visitas de autoridades da Potência (genérico, não só GLEMT por enquanto)
      const { data: autoridadesData, count: countAutoridades } = await supabase
        .from('visitantes_sessao')
        .select(`
          *,
          sessoes_presenca(data_sessao, graus_sessao:grau_sessao_id(nome))
        `, { count: 'exact' })
        .eq('eh_autoridade', true)
        .gte('created_at', `${new Date().getFullYear()}-01-01`)
        .order('created_at', { ascending: false });
      setVisitasAutoridade(autoridadesData || []);
      setTotalVisitasAutoridade(countAutoridades || 0);

      // Carregar a Direção atual da Loja (Venerável, 1º e 2º Vigilante) pra
      // destacar no topo do Dashboard. Usa o mesmo cadastro de Corpo
      // Administrativo — se o ano atual ainda não tiver Venerável Mestre
      // registrado (início de gestão, cadastro atrasado), cai automaticamente
      // pro ano mais recente que já tiver.
      const { data: corpoData } = await supabase
        .from('corpo_administrativo')
        .select('cargo, ano_exercicio, irmao_id');

      if (corpoData && corpoData.length > 0) {
        const normCargo = (c) => (c || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const ehVeneravel = (c) => normCargo(c).includes('veneravel');
        const ehVig1 = (c) => { const n = normCargo(c); return (n.includes('1') && n.includes('vigilante')) || (n.includes('primeiro') && n.includes('vigilante')); };
        const ehVig2 = (c) => { const n = normCargo(c); return (n.includes('2') && n.includes('vigilante')) || (n.includes('segundo') && n.includes('vigilante')); };

        // Ano mais recente que já tem Venerável Mestre cadastrado (âncora)
        const anosComVeneravel = [...new Set(
          corpoData.filter(c => ehVeneravel(c.cargo)).map(c => parseInt(c.ano_exercicio))
        )].sort((a, b) => b - a);

        const anoGestao = anosComVeneravel[0];
        if (anoGestao) {
          const entriesDoAno = corpoData.filter(c => parseInt(c.ano_exercicio) === anoGestao);
          const veneravelEntry = entriesDoAno.find(c => ehVeneravel(c.cargo));
          const vig1Entry = entriesDoAno.find(c => ehVig1(c.cargo));
          const vig2Entry = entriesDoAno.find(c => ehVig2(c.cargo));

          // Busca os dados do irmão direto do banco (nome, foto, CIM) — não
          // depende do prop `irmaos` já estar carregado neste momento.
          const idsNecessarios = [veneravelEntry?.irmao_id, vig1Entry?.irmao_id, vig2Entry?.irmao_id].filter(Boolean);
          let irmaosDirecao = [];
          if (idsNecessarios.length > 0) {
            const { data: irmaosDirecaoData } = await supabase
              .from('irmaos')
              .select('id, nome, foto_url, cim')
              .in('id', idsNecessarios);
            irmaosDirecao = irmaosDirecaoData || [];
          }
          const buscarIrmao = (entry) => entry ? (irmaosDirecao.find(i => i.id === entry.irmao_id) || null) : null;

          setDirecaoLoja({
            veneravel: buscarIrmao(veneravelEntry),
            vig1: buscarIrmao(vig1Entry),
            vig2: buscarIrmao(vig2Entry),
            ano: anoGestao,
          });
        }
      }
    };
    carregar();
  }, []);

  useEffect(() => {
    const carregarPresenca100 = async () => {
      try {
        const anoAtual = new Date().getFullYear();
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0); // Zerar horas para comparação apenas de data
        const inicioAno = `${anoAtual}-01-01`;
        const dataHoje = hoje.toISOString().split('T')[0]; // Formato YYYY-MM-DD

        // 1. Buscar todas as sessões do ano ATÉ HOJE
        const { data: sessoesAno } = await supabase
          .from('sessoes_presenca')
          .select('id, data_sessao, grau_sessao_id')
          .gte('data_sessao', inicioAno)
          .lte('data_sessao', dataHoje);

        const sessaoIds = sessoesAno?.map(s => s.id) || [];
        if (sessaoIds.length === 0) {
          setIrmaos100([]);
          return;
        }

        // 2. Buscar histórico de situações
        const { data: historicoSituacoes } = await supabase
          .from('historico_situacoes')
          .select('*')
          .eq('status', 'ativa');

        // 3. Buscar irmãos com grau
        const { data: todosIrmaos } = await supabase
          .from('irmaos')
          .select('id, nome, data_iniciacao, data_elevacao, data_exaltacao, data_ingresso_loja')
          .eq('status', 'ativo');

        // 4. Buscar registros com paginação
        let registros = [];
        let inicio = 0;
        const tamanhoPagina = 1000;
        let continuar = true;

        while (continuar) {
          const { data: lote } = await supabase
            .from('registros_presenca')
            .select('membro_id, presente, sessao_id')
            .in('sessao_id', sessaoIds)
            .range(inicio, inicio + tamanhoPagina - 1);

          if (lote && lote.length > 0) {
            registros = [...registros, ...lote];
            inicio += tamanhoPagina;
            
            if (lote.length < tamanhoPagina) {
              continuar = false;
            }
          } else {
            continuar = false;
          }
        }

        // Mapear sessões por ID
        const sessoesMap = {};
        sessoesAno?.forEach(s => {
          sessoesMap[s.id] = s;
        });

        // Processar cada irmão
        const com100 = [];
        
        todosIrmaos?.forEach(irmao => {
          // Calcular grau do irmão
          let grauIrmao = 0;
          if (irmao.data_exaltacao) grauIrmao = 3;
          else if (irmao.data_elevacao) grauIrmao = 2;
          else if (irmao.data_iniciacao) grauIrmao = 1;

          if (grauIrmao === 0) return;

          let totalRegistros = 0;
          let presentes = 0;

          // Prioridade: data_ingresso_loja > data_iniciacao
          const dataIngresso = irmao.data_ingresso_loja ? new Date(irmao.data_ingresso_loja) : null;
          const dataIniciacao = irmao.data_iniciacao ? new Date(irmao.data_iniciacao) : null;
          const dataInicio = dataIngresso || dataIniciacao;

          registros.forEach(reg => {
            if (reg.membro_id === irmao.id) {
              const sessao = sessoesMap[reg.sessao_id];
              if (!sessao) return;

              const dataSessao = new Date(sessao.data_sessao);
              let grauSessao = sessao.grau_sessao_id || 1;
              
              // Sessão Administrativa (grau 4) deve ser tratada como Aprendiz (grau 1)
              if (grauSessao === 4) grauSessao = 1;

              // Ignorar se sessão é ANTES do ingresso na loja
              if (dataInicio && dataSessao < dataInicio) return;

              // Ignorar se sessão é de grau SUPERIOR ao do irmão
              if (grauSessao > grauIrmao) return;

              // Verificar se tem situação ativa na data da sessão
              const situacaoNaData = historicoSituacoes?.find(sit => 
                sit.membro_id === irmao.id &&
                dataSessao >= new Date(sit.data_inicio + 'T00:00:00') &&
                (sit.data_fim === null || dataSessao <= new Date(sit.data_fim + 'T00:00:00'))
              );
              
              // Se tem situação ativa, ignora
              if (situacaoNaData) return;

              // Registro válido
              totalRegistros++;
              
              if (reg.presente) {
                presentes++;
              }
            }
          });

          // 100% = presentes em TODAS as sessões que tem registro
          if (totalRegistros > 0 && presentes === totalRegistros) {
            com100.push({
              id: irmao.id,
              nome: irmao.nome,
              total: totalRegistros
            });
          }
        });

        // Ordenar: 1º por total de sessões (maior -> menor), 2º alfabético
        com100.sort((a, b) => {
          if (b.total !== a.total) {
            return b.total - a.total; // Maior número primeiro
          }
          return a.nome.localeCompare(b.nome); // Alfabético
        });

        setIrmaos100(com100);
      } catch (error) {
        console.error('Erro ao carregar presença 100%:', error);
      }
    };

    carregarPresenca100();
  }, []);

  // Função para determinar o grau do irmão
  const obterGrau = (irmao) => {
    if (irmao.data_exaltacao) {
      return irmao.mestre_instalado ? 'Mestre Instalado' : 'Mestre';
    }
    if (irmao.data_elevacao) return 'Companheiro';
    if (irmao.data_iniciacao) return 'Aprendiz';
    return 'Não Iniciado';
  };

  // Contagens por situação
  const hoje = new Date();
  
  const irmaosLicenciados = irmaos.filter(i => {
    return historicoSituacoes.some(sit => 
      sit.membro_id === i.id &&
      sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'licenca' &&
      (sit.data_fim === null || new Date(sit.data_fim) >= hoje)
    );
  });

  const irmaosRegulares = irmaos.filter(i => i.situacao?.toLowerCase() === 'regular');
  const irmaosIrregulares = irmaos.filter(i => i.situacao?.toLowerCase() === 'irregular');
  const irmaosSuspensos = irmaos.filter(i => i.situacao?.toLowerCase() === 'suspenso');
  const irmaosDesligados = irmaos.filter(i => i.situacao?.toLowerCase() === 'desligado');
  const irmaosExcluidos = irmaos.filter(i => i.situacao?.toLowerCase() === 'excluído');
  const irmaosFalecidos = irmaos.filter(i => i.situacao?.toLowerCase() === 'falecido');
  const irmaosExOficio = irmaos.filter(i => i.situacao?.toLowerCase() === 'ex-ofício');
  const totalIrmaos = irmaos.length;

  // Pré-calcular balaustres do ano (evita .filter() repetido no JSX)
  const anoAtualDash = new Date().getFullYear();
  const balaustresAno        = balaustres.filter(b => b.data_sessao && new Date(b.data_sessao + 'T00:00:00').getFullYear() === anoAtualDash);
  const balaustresAprendiz   = balaustresAno.filter(b => b.grau_sessao === 'Aprendiz').length;
  const balaustresCompanheiro= balaustresAno.filter(b => b.grau_sessao === 'Companheiro').length;
  const balaustResMestre     = balaustresAno.filter(b => b.grau_sessao === 'Mestre').length;
  const totalBalaustres      = balaustresAno.length;

  // Irmãos ativos (Regulares + Licenciados)
  const irmaosAtivos = [...irmaosRegulares, ...irmaosLicenciados];

  // Contagem por grau (regulares + licenciados)
  const irmaosAprendiz = irmaosAtivos.filter(i => obterGrau(i) === 'Aprendiz').length;
  const irmaosCompanheiro = irmaosAtivos.filter(i => obterGrau(i) === 'Companheiro').length;
  const irmaosMestre = irmaosAtivos.filter(i => obterGrau(i) === 'Mestre').length;
  const irmaosMestreInstalado = irmaosAtivos.filter(i => obterGrau(i) === 'Mestre Instalado').length;
  const totalMestres = irmaosMestre + irmaosMestreInstalado;

  // ========================================
  // ANIVERSARIANTES - INCLUINDO FAMILIARES
  // ========================================
  const aniversariantes = useMemo(() => {
    const hoje = new Date();
    const diaHoje = hoje.getDate();
    const mesHoje = hoje.getMonth() + 1;

    const aniversariantesHoje = [];
    const proximos7Dias = [];

    const verificarAniversario = (pessoa, tipo, irmaoNome = null) => {
      if (!pessoa.data_nascimento) return;

      const dataNasc = new Date(pessoa.data_nascimento + 'T00:00:00');
      const diaNasc = dataNasc.getDate();
      const mesNasc = dataNasc.getMonth() + 1;

      // Aniversariante de hoje
      if (diaNasc === diaHoje && mesNasc === mesHoje) {
        const idade = hoje.getFullYear() - dataNasc.getFullYear();
        aniversariantesHoje.push({
          nome: pessoa.nome,
          tipo: tipo,
          irmaoNome: irmaoNome,
          idade,
          dataNasc: dataNasc,
          id: `${tipo}-${pessoa.id || Math.random()}`
        });
      }

      // Próximos 7 dias
      const dataAnivEstano = new Date(hoje.getFullYear(), mesNasc - 1, diaNasc);
      
      // Se o aniversário já passou este ano, considera o próximo ano
      if (dataAnivEstano < hoje) {
        dataAnivEstano.setFullYear(hoje.getFullYear() + 1);
      }

      const diffDias = Math.ceil((dataAnivEstano - hoje) / (1000 * 60 * 60 * 24));

      if (diffDias > 0 && diffDias <= 7) {
        const idade = dataAnivEstano.getFullYear() - dataNasc.getFullYear();
        proximos7Dias.push({
          nome: pessoa.nome,
          tipo: tipo,
          irmaoNome: irmaoNome,
          idade,
          diasRestantes: diffDias,
          dataAniversario: dataAnivEstano,
          dataNasc: dataNasc,
          id: `${tipo}-${pessoa.id || Math.random()}`
        });
      }
    };

    // DEBUG
    console.log('🎂 Verificando aniversariantes...');
    console.log('Total irmãos:', irmaos.length);

    // Apenas irmãos ativos (regular ou licenciado) para aniversários de familiares
    const SITUACOES_ATIVAS = ['regular', 'licenciado'];
    const irmaosParaAniversario = irmaos.filter(i =>
      SITUACOES_ATIVAS.includes((i.situacao || '').toLowerCase())
    );

    // Irmãos (apenas VIVOS e ativos)
    irmaosParaAniversario.forEach(irmao => {
      // Não mostrar irmãos falecidos
      if (irmao.falecido === true || irmao.data_falecimento) return;
      
      verificarAniversario(irmao, 'Irmão');

      // Esposa
      if (irmao.esposas && Array.isArray(irmao.esposas)) {
        console.log(`👰 ${irmao.nome} tem ${irmao.esposas.length} esposa(s)`);
        irmao.esposas.forEach(esposa => {
          verificarAniversario(esposa, 'Esposa', irmao.nome);
        });
      }

      // Pais (apenas VIVOS)
      if (irmao.pais && Array.isArray(irmao.pais)) {
        console.log(`👪 ${irmao.nome} tem ${irmao.pais.length} pai/mãe`);
        irmao.pais.forEach(pai => {
          // Não mostrar pais falecidos
          if (pai.falecido === true || pai.data_obito) return;
          
          const tipoPai = pai.tipo === 'pai' ? 'Pai' : 'Mãe';
          verificarAniversario(pai, tipoPai, irmao.nome);
        });
      }

      // Filhos (apenas VIVOS)
      if (irmao.filhos && Array.isArray(irmao.filhos)) {
        console.log(`👶 ${irmao.nome} tem ${irmao.filhos.length} filho(s)`);
        irmao.filhos.forEach(filho => {
          // Não mostrar filhos falecidos (campo 'vivo' ou 'data_obito')
          if (filho.vivo === false || filho.falecido === true || filho.data_obito) return;
          
          verificarAniversario(filho, 'Filho(a)', irmao.nome);
        });
      }
    });

    // ===== CONSOLIDAR DUPLICATAS =====
    const consolidarDuplicatas = (lista) => {
      const map = new Map();
      
      lista.forEach(pessoa => {
        // Normalizar nome
        const nomeNormalizado = pessoa.nome
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, ' ');
        
        const timestamp = pessoa.dataNasc.getTime();
        const chave = `${nomeNormalizado}-${timestamp}`;
        
        if (map.has(chave)) {
          // Duplicata encontrada - adicionar vínculo
          const pessoaExistente = map.get(chave);
          
          if (!pessoaExistente.vinculos) {
            pessoaExistente.vinculos = [{
              tipo: pessoaExistente.tipo,
              irmao: pessoaExistente.irmaoNome
            }];
          }
          
          pessoaExistente.vinculos.push({
            tipo: pessoa.tipo,
            irmao: pessoa.irmaoNome
          });
          
          // Atualizar tipo
          const tipos = pessoaExistente.vinculos.map(v => v.tipo);
          pessoaExistente.tipo = tipos.join(' / ');
          
        } else {
          map.set(chave, pessoa);
        }
      });
      
      return Array.from(map.values());
    };
    
    const aniversariantesHojeConsolidados = consolidarDuplicatas(aniversariantesHoje);
    const proximos7DiasConsolidados = consolidarDuplicatas(proximos7Dias);

    // Ordenar próximos 7 dias por data
    proximos7DiasConsolidados.sort((a, b) => a.diasRestantes - b.diasRestantes);

    console.log('📅 Aniversariantes hoje:', aniversariantesHojeConsolidados.length);
    console.log('📅 Próximos 7 dias:', proximos7DiasConsolidados.length);

    return { 
      aniversariantesHoje: aniversariantesHojeConsolidados, 
      proximos7Dias: proximos7DiasConsolidados 
    };
  }, [irmaos]);

  return (
    <div style={{padding:'1.5rem 2rem',minHeight:'100vh',background:'var(--color-bg)',overflowX:'hidden'}}>

      {/* Direção da Loja — Venerável Mestre, 1º e 2º Vigilante em destaque */}
      {(direcaoLoja.veneravel || direcaoLoja.vig1 || direcaoLoja.vig2) && (
        <div style={{position:'relative', border:'2px solid #f59e0b', borderRadius:'var(--radius-xl)', padding:'1.75rem 1.25rem 1.25rem', marginBottom:'1.5rem'}}>
          <span style={{position:'absolute', top:'-0.7rem', left:'50%', transform:'translateX(-50%)', background:'var(--color-bg)', padding:'0.1rem 1rem', fontSize:'0.78rem', fontWeight:'700', letterSpacing:'0.05em', color:'var(--color-text-muted)', whiteSpace:'nowrap'}}>
            Exercício - {direcaoLoja.ano}
          </span>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1rem', alignItems:'stretch'}}>
            {[
              { cargo: 'Venerável Mestre', irmao: direcaoLoja.veneravel, gradiente: 'linear-gradient(135deg, #c9a84c 0%, #a3792f 100%)' },
              { cargo: '1º Vigilante',     irmao: direcaoLoja.vig1,      gradiente: 'linear-gradient(135deg, var(--color-accent) 0%, #4338ca 100%)' },
              { cargo: '2º Vigilante',     irmao: direcaoLoja.vig2,      gradiente: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)' },
            ].map(d => (
              <div key={d.cargo} style={{background: d.gradiente, borderRadius:'var(--radius-xl)', padding:'0.13rem 1.25rem', color:'#fff', display:'flex', alignItems:'center', gap:'0.9rem'}}>
                {d.irmao?.foto_url ? (
                  <img src={d.irmao.foto_url} alt={d.irmao.nome} style={{width:'130px', height:'130px', borderRadius:'50%', objectFit:'cover', border:'2px solid rgba(255,255,255,0.6)', flexShrink:0}} />
                ) : (
                  <div style={{width:'130px', height:'130px', borderRadius:'50%', background:'rgba(255,255,255,0.18)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2.2rem', flexShrink:0}}>
                    {d.irmao ? '👤' : '❔'}
                  </div>
                )}
                <div style={{minWidth:0}}>
                  <p style={{fontSize:'0.62rem', fontWeight:'700', letterSpacing:'0.08em', textTransform:'uppercase', color:'rgba(255,255,255,0.75)', margin:'0 0 0.3rem'}}>{d.cargo}</p>
                  <p style={{fontSize:'1.05rem', fontWeight:'800', margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                    {d.irmao ? formatarNome(d.irmao.nome) : 'Vago'}
                  </p>
                  {d.irmao?.cim && (
                    <p style={{fontSize:'0.7rem', opacity:0.8, margin:'0.1rem 0 0'}}>CIM {d.irmao.cim}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cards de Graus */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1rem', marginBottom:'1.5rem', alignItems:'stretch'}}>

        {/* CARD 1 — Quadro de Irmãos */}
        <div style={{background:'linear-gradient(135deg, var(--color-accent) 0%, #4338ca 100%)', borderRadius:'var(--radius-xl)', padding:'1.25rem', color:'#fff', display:'flex', flexDirection:'column', gap:'1rem'}}>
          <div>
            <p style={{fontSize:'0.62rem', fontWeight:'700', letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.7)', margin:'0 0 0.25rem'}}>Quadro de Irmãos</p>
            <div style={{display:'flex', alignItems:'baseline', gap:'0.5rem'}}>
              <span style={{fontSize:'3rem', fontWeight:'900', lineHeight:1}}>{irmaosAtivos.length}</span>
              <span style={{fontSize:'0.82rem', opacity:0.8}}>ativos</span>
            </div>
          </div>
          <div style={{borderTop:'1px solid rgba(255,255,255,0.2)', paddingTop:'0.75rem', display:'flex', flexDirection:'column', gap:'0.35rem'}}>
            {[
              {emoji:'✅', label:'Regulares',   val: irmaosRegulares.length,   pct: irmaosAtivos.length},
              {emoji:'🎫', label:'Licenciados', val: irmaosLicenciados.length, pct: irmaosAtivos.length},
            ].map(r => (
              <div key={r.label} style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
                <span style={{fontSize:'0.78rem', minWidth:'80px', opacity:0.9}}>{r.emoji} {r.label}</span>
                <div style={{flex:1, height:'5px', borderRadius:'3px', background:'rgba(255,255,255,0.2)'}}>
                  <div style={{width: r.pct > 0 ? `${(r.val/r.pct*100).toFixed(0)}%` : '0%', height:'5px', borderRadius:'3px', background:'rgba(255,255,255,0.85)'}} />
                </div>
                <span style={{fontSize:'0.82rem', fontWeight:'700', minWidth:'20px', textAlign:'right'}}>{r.val}</span>
              </div>
            ))}
          </div>
          <div style={{borderTop:'1px solid rgba(255,255,255,0.2)', paddingTop:'0.75rem'}}>
            <p style={{fontSize:'0.62rem', fontWeight:'700', letterSpacing:'0.08em', textTransform:'uppercase', color:'rgba(255,255,255,0.6)', marginBottom:'0.5rem'}}>Por Grau</p>
            <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.5rem', textAlign:'center'}}>
              {[
                {emoji:'⬜', label:'Aprendiz',    val: irmaosAprendiz},
                {emoji:'🔷', label:'Companheiro', val: irmaosCompanheiro},
                {emoji:'🔺', label:'Mestre',      val: totalMestres},
              ].map(g => (
                <div key={g.label} style={{background:'rgba(255,255,255,0.12)', borderRadius:'var(--radius-md)', padding:'0.4rem 0.25rem'}}>
                  <p style={{fontSize:'1.2rem', fontWeight:'800', margin:'0 0 0.1rem'}}>{g.val}</p>
                  <p style={{fontSize:'0.62rem', opacity:0.8, margin:0}}>{g.emoji} {g.label}</p>
                </div>
              ))}
            </div>
            <p style={{fontSize:'0.7rem', opacity:0.65, marginTop:'0.4rem', textAlign:'center'}}>
              {irmaosMestre} Mestres · {irmaosMestreInstalado} Mestres Instalados
            </p>
          </div>
        </div>

        {/* CARD 2 — Distribuição Total */}
        <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', padding:'1.25rem', display:'flex', flexDirection:'column', gap:'1rem'}}>
          <div>
            <p style={{fontSize:'0.62rem', fontWeight:'700', letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--color-text-muted)', margin:'0 0 0.25rem'}}>Total no Quadro</p>
            <div style={{display:'flex', alignItems:'baseline', gap:'0.5rem'}}>
              <span style={{fontSize:'3rem', fontWeight:'900', lineHeight:1, color:'var(--color-text)'}}>{totalIrmaos}</span>
              <span style={{fontSize:'0.82rem', color:'var(--color-text-muted)'}}>irmãos</span>
            </div>
          </div>
          <div style={{flex:1, display:'flex', flexDirection:'column', gap:'0.3rem'}}>
            {[
              {label:'Regulares',   val: irmaosRegulares.length,   cor:'#10b981'},
              {label:'Licenciados', val: irmaosLicenciados.length, cor:'#6366f1'},
              {label:'Irregulares', val: irmaosIrregulares.length, cor:'#f59e0b'},
              {label:'Suspensos',   val: irmaosSuspensos.length,   cor:'#ef4444'},
              {label:'Quite Placet',  val: irmaosDesligados.length,  cor:'#94a3b8'},
              {label:'Excluídos',   val: irmaosExcluidos.length,   cor:'#94a3b8'},
              {label:'Falecidos',   val: irmaosFalecidos.length,   cor:'#64748b'},
              {label:'Ex-Ofício',   val: irmaosExOficio.length,    cor:'#94a3b8'},
            ].filter(s => s.val > 0).map(s => (
              <div key={s.label} style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
                <span style={{fontSize:'0.75rem', color:'var(--color-text-muted)', minWidth:'82px'}}>{s.label}</span>
                <div style={{flex:1, height:'6px', borderRadius:'3px', background:'var(--color-surface-2)'}}>
                  <div style={{width: totalIrmaos > 0 ? `${(s.val/totalIrmaos*100).toFixed(0)}%` : '0%', height:'6px', borderRadius:'3px', background: s.cor}} />
                </div>
                <span style={{fontSize:'0.8rem', fontWeight:'700', color: s.cor, minWidth:'24px', textAlign:'right'}}>{s.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CARD 3 — Balaustres */}
        <div style={{background:'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', borderRadius:'var(--radius-xl)', padding:'1.25rem', color:'#fff', display:'flex', flexDirection:'column', gap:'1rem', position:'relative'}}>
          <div style={{position:'absolute', top:'1rem', right:'1rem', background:'rgba(255,255,255,0.15)', padding:'0.15rem 0.65rem', borderRadius:'999px', fontSize:'0.75rem', fontWeight:'700'}}>
            {anoAtualDash}
          </div>
          <div>
            <p style={{fontSize:'0.62rem', fontWeight:'700', letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.7)', margin:'0 0 0.25rem'}}>Balaustres</p>
            <div style={{display:'flex', alignItems:'baseline', gap:'0.5rem'}}>
              <span style={{fontSize:'3rem', fontWeight:'900', lineHeight:1}}>{totalBalaustres}</span>
              <span style={{fontSize:'0.82rem', opacity:0.8}}>sessões</span>
            </div>
          </div>
          <div style={{borderTop:'1px solid rgba(255,255,255,0.2)', paddingTop:'0.75rem', display:'flex', flexDirection:'column', gap:'0.4rem'}}>
            {[
              {emoji:'⬜', label:'Aprendiz',    val: balaustresAprendiz},
              {emoji:'🔷', label:'Companheiro', val: balaustresCompanheiro},
              {emoji:'🔺', label:'Mestre',      val: balaustResMestre},
            ].map(g => (
              <div key={g.label} style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
                <span style={{fontSize:'0.78rem', opacity:0.85, minWidth:'110px'}}>{g.emoji} Grau {g.label === 'Aprendiz' ? '1' : g.label === 'Companheiro' ? '2' : '3'} ({g.label})</span>
                <div style={{flex:1, height:'5px', borderRadius:'3px', background:'rgba(255,255,255,0.2)'}}>
                  <div style={{width: totalBalaustres > 0 ? `${(g.val/totalBalaustres*100).toFixed(0)}%` : '0%', height:'5px', borderRadius:'3px', background:'rgba(255,255,255,0.85)'}} />
                </div>
                <span style={{fontSize:'0.82rem', fontWeight:'700', minWidth:'20px', textAlign:'right'}}>{g.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cards de Situações */}
      <div className="rounded-xl p-6 mb-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <h3 className="text-xl font-bold mb-4" style={{color:"var(--color-text)"}}>📋 Situação dos Irmãos</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div 
            style={{border:"1px solid var(--color-border)",borderLeft:"4px solid var(--color-border)",borderRadius:"var(--radius-lg)",padding:"1rem",cursor:"pointer"}}
            onDoubleClick={() => setModalSituacao({ aberto: true, titulo: '✅ Irmãos Regulares', irmaos: irmaosRegulares })}
            title="Clique duplo para ver detalhes"
          >
            <div style={{fontSize:"0.78rem",fontWeight:"700",color:"#10b981",marginBottom:"0.4rem"}}>✅ Regulares</div>
            <div style={{fontSize:"1.75rem",fontWeight:"800",color:"var(--color-text)"}}>{irmaosRegulares.length}</div>
          </div>
          <div 
            style={{border:"1px solid rgba(59,130,246,0.3)",borderLeft:"4px solid #3b82f6",borderRadius:"var(--radius-lg)",padding:"1rem",cursor:"pointer",background:"rgba(59,130,246,0.1)"}}
            onDoubleClick={() => setModalSituacao({ aberto: true, titulo: '🎫 Irmãos Licenciados', irmaos: irmaosLicenciados })}
            title="Clique duplo para ver detalhes"
          >
            <div style={{fontSize:"0.78rem",fontWeight:"700",color:"#3b82f6",marginBottom:"0.4rem"}}>🎫 Licenciados</div>
            <div className="text-3xl font-bold">{irmaosLicenciados.length}</div>
          </div>
          <div 
            style={{border:"1px solid var(--color-border)",borderLeft:"4px solid var(--color-border)",borderRadius:"var(--radius-lg)",padding:"1rem",cursor:"pointer"}}
            onDoubleClick={() => setModalSituacao({ aberto: true, titulo: '⚠️ Irmãos Irregulares', irmaos: irmaosIrregulares })}
            title="Clique duplo para ver detalhes"
          >
            <div style={{fontSize:"0.78rem",fontWeight:"700",color:"#f59e0b",marginBottom:"0.4rem"}}>⚠️ Irregulares</div>
            <div style={{fontSize:"1.75rem",fontWeight:"800",color:"var(--color-text)"}}>{irmaosIrregulares.length}</div>
          </div>
          <div 
            style={{border:"1px solid var(--color-border)",borderLeft:"4px solid var(--color-border)",borderRadius:"var(--radius-lg)",padding:"1rem",cursor:"pointer"}}
            onDoubleClick={() => setModalSituacao({ aberto: true, titulo: '🚫 Irmãos Suspensos', irmaos: irmaosSuspensos })}
            title="Clique duplo para ver detalhes"
          >
            <div style={{fontSize:"0.78rem",fontWeight:"700",color:"#ef4444",marginBottom:"0.4rem"}}>🚫 Suspensos</div>
            <div style={{fontSize:"1.75rem",fontWeight:"800",color:"var(--color-text)"}}>{irmaosSuspensos.length}</div>
          </div>
          <div 
            style={{border:"1px solid var(--color-border)",borderLeft:"4px solid var(--color-border)",borderRadius:"var(--radius-lg)",padding:"1rem",cursor:"pointer"}}
            onDoubleClick={() => setModalSituacao({ aberto: true, titulo: '↩️ Irmãos em Quite Placet', irmaos: irmaosDesligados })}
            title="Clique duplo para ver detalhes"
          >
            <div style={{fontSize:"0.78rem",fontWeight:"700",color:"#64748b",marginBottom:"0.4rem"}}>↩️ Quite Placet</div>
            <div style={{fontSize:"1.75rem",fontWeight:"800",color:"var(--color-text)"}}>{irmaosDesligados.length}</div>
          </div>
          <div 
            style={{border:"1px solid var(--color-border)",borderLeft:"4px solid var(--color-border)",borderRadius:"var(--radius-lg)",padding:"1rem",cursor:"pointer"}}
            onDoubleClick={() => setModalSituacao({ aberto: true, titulo: '❌ Irmãos Excluídos', irmaos: irmaosExcluidos })}
            title="Clique duplo para ver detalhes"
          >
            <div style={{fontSize:"0.78rem",fontWeight:"700",color:"#dc2626",marginBottom:"0.4rem"}}>❌ Excluídos</div>
            <div style={{fontSize:"1.75rem",fontWeight:"800",color:"var(--color-text)"}}>{irmaosExcluidos.length}</div>
          </div>
          <div 
            style={{border:"1px solid var(--color-border)",borderLeft:"4px solid var(--color-border)",borderRadius:"var(--radius-lg)",padding:"1rem",cursor:"pointer"}}
            onDoubleClick={() => setModalSituacao({ aberto: true, titulo: '🕊️ Irmãos Falecidos', irmaos: irmaosFalecidos })}
            title="Clique duplo para ver detalhes"
          >
            <div style={{fontSize:"0.78rem",fontWeight:"700",color:"#6366f1",marginBottom:"0.4rem"}}>🕊️ Falecidos</div>
            <div style={{fontSize:"1.75rem",fontWeight:"800",color:"var(--color-text)"}}>{irmaosFalecidos.length}</div>
          </div>
          <div 
            style={{border:"1px solid rgba(99,102,241,0.3)",borderLeft:"4px solid #6366f1",borderRadius:"var(--radius-lg)",padding:"1rem",cursor:"pointer",background:"rgba(99,102,241,0.1)"}}
            onDoubleClick={() => setModalSituacao({ aberto: true, titulo: '👔 Irmãos Ex-Ofício', irmaos: irmaosExOficio })}
            title="Clique duplo para ver detalhes"
          >
            <div style={{fontSize:"0.78rem",fontWeight:"700",color:"#8b5cf6",marginBottom:"0.4rem"}}>👔 Ex-Ofício</div>
            <div style={{fontSize:"1.75rem",fontWeight:"800",color:"var(--color-text)"}}>{irmaosExOficio.length}</div>
          </div>
        </div>
      </div>

      {/* PRESENÇA 100% - 3 COLUNAS */}
      {irmaos100.length > 0 && (
        <div className="rounded-xl p-6 mb-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2" style={{color:"var(--color-text)"}}>
              <span className="text-2xl">🏆</span>
              Presença 100% no Ano ({irmaos100.length} {irmaos100.length === 1 ? 'Irmão' : 'Irmãos'})
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Dividir irmãos em 3 colunas */}
            {[0, 1, 2].map(coluna => {
              const porColuna = Math.ceil(irmaos100.length / 3);
              const inicio = coluna * porColuna;
              const fim = inicio + porColuna;
              const irmaosColuna = irmaos100.slice(inicio, fim);
              
              return (
                <div key={coluna} className="space-y-2">
                  {irmaosColuna.map(irmao => (
                    <div 
                      key={irmao.id}
                      style={{background:"var(--color-surface)",border:"1px solid rgba(16,185,129,0.3)",borderLeft:"3px solid #10b981",borderRadius:"var(--radius-md)",padding:"0.75rem"}}>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">✅</span>
                        <div className="flex-1">
                          <div style={{fontWeight:"600",fontSize:"0.82rem",color:"var(--color-text)"}}>{irmao.nome}</div>
                          <div style={{fontSize:"0.7rem",color:"var(--color-text-muted)"}}>{irmao.total} sessões</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CARDS DE VISITAS - GRID COM 3 COLUNAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Card 0: Visitas de Autoridades da Potência */}
        {totalVisitasAutoridade > 0 && (
          <div
            onDoubleClick={() => setModalVisitasAutoridade(true)}
            style={{background:'#c9a84c',borderRadius:'var(--radius-xl)',padding:'1.5rem',color:'#fff',cursor:'pointer',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}
            title="Clique 2x para ver detalhes"
          >
            {/* Coluna 1: título + quantidade */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🏛️</span>
                <h3 style={{fontSize:'0.95rem',fontWeight:'700',color:'#fff',whiteSpace:'nowrap'}}>Visitas de Autoridades</h3>
              </div>
              <p style={{fontSize:'3rem',fontWeight:'800',marginBottom:'0.25rem'}}>{totalVisitasAutoridade}</p>
              <p style={{fontSize:'0.82rem',opacity:0.85}}>Registradas em {new Date().getFullYear()}</p>
            </div>
            {/* Coluna 2: lista sessão + data */}
            <div style={{borderLeft:'1px solid rgba(255,255,255,0.3)',paddingLeft:'1rem',display:'flex',flexDirection:'column',justifyContent:'center',gap:'0.35rem',maxHeight:'110px',overflowY:'auto'}}>
              {visitasAutoridade.slice(0, 6).map(v => {
                const nomeSessao = v.sessoes_presenca?.graus_sessao?.nome || 'Sessão';
                const abreviado = nomeSessao.replace(/^Sessão de\s+/i, 'S. ');
                return (
                  <div key={v.id} style={{fontSize:'0.78rem',color:'rgba(255,255,255,0.95)',lineHeight:'1.3',whiteSpace:'nowrap'}}>
                    {abreviado}
                    {' - '}
                    {v.sessoes_presenca?.data_sessao
                      ? new Date(v.sessoes_presenca.data_sessao + 'T00:00:00').toLocaleDateString('pt-BR')
                      : '—'}
                  </div>
                );
              })}
              {visitasAutoridade.length > 6 && (
                <div style={{fontSize:'0.72rem',opacity:0.8}}>+{visitasAutoridade.length - 6} outra(s)</div>
              )}
            </div>
          </div>
        )}

        {/* Card 1: Visitas dos Irmãos a Outras Lojas */}
        {totalVisitasIrmaos > 0 && (
          <div
            onDoubleClick={() => setModalVisitasIrmaos(true)}
            style={{background:"var(--color-accent)",borderRadius:"var(--radius-xl)",padding:"1.5rem",color:"#fff",cursor:"pointer"}}
            title="Clique 2x para ver detalhes"
          >
            <h3 style={{fontSize:"1rem",fontWeight:"700",color:"#fff",marginBottom:"0.75rem"}}>📍 Visitas a Outras Lojas</h3>
            <div style={{display:'grid', gridTemplateColumns: topVisitantesIrmaos.length > 0 ? '1fr 1fr' : '1fr', gap:'1rem'}}>
              <div>
                <p style={{fontSize:"3rem",fontWeight:"800",marginBottom:"0.25rem",lineHeight:1}}>{totalVisitasIrmaos}</p>
                <p style={{fontSize:"0.82rem",opacity:0.85}}>Realizadas em {new Date().getFullYear()}</p>
              </div>
              {topVisitantesIrmaos.length > 0 && (
                <div style={{borderLeft:'1px solid rgba(255,255,255,0.3)',paddingLeft:'1rem'}}>
                  <p style={{fontSize:'0.72rem',fontWeight:'700',opacity:0.85,marginBottom:'0.4rem',textTransform:'uppercase',letterSpacing:'0.03em'}}>🏆 Top 5</p>
                  {topVisitantesIrmaos.map((v, i) => (
                    <div key={i} style={{display:'flex',justifyContent:'space-between',gap:'0.5rem',fontSize:'0.76rem',padding:'0.15rem 0',lineHeight:1.3}}>
                      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{i+1}º {formatarNomeCurto(v.nome)}</span>
                      <span style={{fontWeight:'800',whiteSpace:'nowrap'}}>{v.qtd}x</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Card 2: Visitantes Recebidos */}
        {totalVisitantes > 0 && (
          <div
            onDoubleClick={() => setModalVisitantesRecebidos(true)}
            style={{background:"#10b981",borderRadius:"var(--radius-xl)",padding:"1.5rem",color:"#fff",cursor:"pointer"}}
            title="Clique 2x para ver detalhes"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 style={{fontSize:"1rem",fontWeight:"700",color:"#fff"}}>👥 Visitantes Recebidos</h3>
              <span className="text-4xl">🏛️</span>
            </div>
            <p style={{fontSize:"3rem",fontWeight:"800",marginBottom:"0.25rem"}}>{totalVisitantes}</p>
            <p style={{fontSize:"0.82rem",opacity:0.85}}>Registrados em {new Date().getFullYear()}</p>
          </div>
        )}
      </div>

      {/* Card de Visitantes ANTIGO - REMOVER */}
      {false && totalVisitantes > 0 && (
        <div className="mb-6">
          <div className="text-white p-6 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <h3 style={{fontSize:"1rem",fontWeight:"700",color:"#fff"}}>👥 Visitantes Recebidos</h3>
              <span className="text-4xl">🏛️</span>
            </div>
            <p style={{fontSize:"3rem",fontWeight:"800",marginBottom:"0.25rem"}}>{totalVisitantes}</p>
            <p style={{fontSize:"0.82rem",opacity:0.85}}>Registrados em {new Date().getFullYear()}</p>
          </div>
        </div>
      )}

      {/* ANIVERSARIANTES - LAYOUT COMPACTO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* ANIVERSARIANTES DO DIA - COR MAIS CLARA */}
        <div style={{background:"var(--color-surface)",border:"1px solid var(--color-border)",borderLeft:"4px solid #f43f5e",borderRadius:"var(--radius-xl)",padding:"1.5rem"}}>
          <div className="flex items-center justify-between mb-4">
            <h3 style={{fontSize:"1.1rem",fontWeight:"700",color:"var(--color-text)"}}>🎂 Aniversariantes do Dia</h3>
            <div className="text-4xl">🎉</div>
          </div>
          
          {aniversariantes.aniversariantesHoje.length > 0 ? (
            <div className="space-y-2">
              {aniversariantes.aniversariantesHoje.map(pessoa => (
                <div 
                  key={pessoa.id}
                  style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",padding:"0.75rem"}}>
                  <div style={{fontWeight:"700",color:"var(--color-text)"}}>{pessoa.nome}</div>
                  <div style={{fontSize:"0.8rem",color:"var(--color-text-muted)"}}>
                    {pessoa.vinculos && pessoa.vinculos.length > 1 ? (
                      // Múltiplos vínculos
                      <div className="space-y-1">
                        {pessoa.vinculos.map((vinculo, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span>
                              {vinculo.tipo === 'Irmão' ? '👤' : 
                               vinculo.tipo === 'Esposa' ? '💑' :
                               vinculo.tipo === 'Pai' ? '👨' :
                               vinculo.tipo === 'Mãe' ? '👩' : '👶'} {vinculo.tipo} do Irmão {vinculo.irmao}
                            </span>
                          </div>
                        ))}
                        <div className="mt-1">
                          <span>🎂 {pessoa.idade} anos hoje</span>
                        </div>
                      </div>
                    ) : (
                      // Vínculo único
                      <div className="flex items-center gap-3 flex-wrap">
                        <span>
                          {pessoa.tipo === 'Irmão' ? '👤' : 
                           pessoa.tipo === 'Esposa' ? '💑' :
                           pessoa.tipo === 'Pai' ? '👨' :
                           pessoa.tipo === 'Mãe' ? '👩' : '👶'} {pessoa.tipo}
                          {pessoa.irmaoNome && ` de ${pessoa.irmaoNome}`}
                        </span>
                        <span>•</span>
                        <span>🎂 {pessoa.idade} anos hoje</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{textAlign:"center",padding:"1.5rem",borderRadius:"var(--radius-md)",background:"var(--color-surface-2)"}}>
              <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>📅</div>
              <p style={{fontSize:"0.82rem",color:"var(--color-text-muted)"}}>Nenhum aniversariante hoje</p>
            </div>
          )}
        </div>

        {/* PRÓXIMOS 7 DIAS - LAYOUT COMPACTO */}
        <div style={{background:"var(--color-surface)",border:"1px solid var(--color-border)",borderLeft:"4px solid #06b6d4",borderRadius:"var(--radius-xl)",padding:"1.5rem"}}>
          <div className="flex items-center justify-between mb-4">
            <h3 style={{fontSize:"1.1rem",fontWeight:"700",color:"var(--color-text)"}}>📅 Próximos 7 Dias</h3>
            <div className="text-4xl">🎁</div>
          </div>
          
          {aniversariantes.proximos7Dias.length > 0 ? (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {aniversariantes.proximos7Dias.map(pessoa => (
                <div 
                  key={pessoa.id}
                  style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",padding:"0.75rem"}}>
                  <div className="flex items-center justify-between mb-1">
                    <div style={{fontWeight:"700",color:"var(--color-text)",flex:1}}>{pessoa.nome}</div>
                    <div style={{background:"var(--color-accent-bg)",color:"var(--color-accent)",borderRadius:"999px",padding:"0.1rem 0.5rem",fontSize:"0.7rem",fontWeight:"700",marginLeft:"0.5rem",whiteSpace:"nowrap"}}>
                      {pessoa.diasRestantes} {pessoa.diasRestantes === 1 ? 'dia' : 'dias'}
                    </div>
                  </div>
                  <div style={{fontSize:"0.8rem",color:"var(--color-text-muted)"}}>
                    {pessoa.vinculos && pessoa.vinculos.length > 1 ? (
                      // Múltiplos vínculos
                      <div className="space-y-1">
                        {pessoa.vinculos.map((vinculo, idx) => (
                          <div key={idx}>
                            <span>
                              {vinculo.tipo === 'Irmão' ? '👤' : 
                               vinculo.tipo === 'Esposa' ? '💑' :
                               vinculo.tipo === 'Pai' ? '👨' :
                               vinculo.tipo === 'Mãe' ? '👩' : '👶'} {vinculo.tipo} do Irmão {vinculo.irmao}
                            </span>
                          </div>
                        ))}
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          <span>🎂 {pessoa.idade} anos</span>
                          <span>•</span>
                          <span>📆 {pessoa.dataAniversario.toLocaleDateString('pt-BR', { 
                            day: '2-digit', 
                            month: 'long' 
                          })}</span>
                        </div>
                      </div>
                    ) : (
                      // Vínculo único
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>
                          {pessoa.tipo === 'Irmão' ? '👤' : 
                           pessoa.tipo === 'Esposa' ? '💑' :
                           pessoa.tipo === 'Pai' ? '👨' :
                           pessoa.tipo === 'Mãe' ? '👩' : '👶'} {pessoa.tipo}
                          {pessoa.irmaoNome && ` de ${pessoa.irmaoNome}`}
                        </span>
                        <span>•</span>
                        <span>🎂 {pessoa.idade} anos</span>
                        <span>•</span>
                        <span>📆 {pessoa.dataAniversario.toLocaleDateString('pt-BR', { 
                          day: '2-digit', 
                          month: 'long' 
                        })}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{textAlign:"center",padding:"1.5rem",borderRadius:"var(--radius-md)",background:"var(--color-surface-2)"}}>
              <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>📅</div>
              <p style={{fontSize:"0.82rem",color:"var(--color-text-muted)"}}>Nenhum aniversário nos próximos 7 dias</p>
            </div>
          )}
        </div>

        {/* EVENTOS COMEMORATIVOS */}
        <div style={{background:"var(--color-surface)",border:"1px solid var(--color-border)",borderLeft:"4px solid #f59e0b",borderRadius:"var(--radius-xl)",padding:"1.5rem"}}>
          <div className="flex items-center justify-between mb-4">
            <h3 style={{fontSize:"1.1rem",fontWeight:"700",color:"var(--color-text)"}}>📅 Datas Comemorativas</h3>
            <div className="text-4xl">🎊</div>
          </div>
          
          {(() => {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0); // Zera as horas para comparação correta
            
            console.log('📅 Dashboard - Eventos recebidos:', cronograma);
            console.log('📅 Data de hoje:', hoje);
            
            const eventosProximos = cronograma
              .filter(evento => {
                if (!evento.mes || !evento.dia) return false;
                
                // Criar data do evento no ano atual
                const anoAtual = hoje.getFullYear();
                const dataEvento = new Date(anoAtual, evento.mes - 1, evento.dia);
                dataEvento.setHours(0, 0, 0, 0);
                
                // Se já passou este ano, considerar próximo ano
                if (dataEvento < hoje) {
                  dataEvento.setFullYear(anoAtual + 1);
                }
                
                const diffDias = Math.ceil((dataEvento - hoje) / (1000 * 60 * 60 * 24));
                console.log(`Evento: ${evento.nome} - ${evento.dia}/${evento.mes} - Diff: ${diffDias} dias`);
                return diffDias >= 0 && diffDias <= 30;
              })
              .sort((a, b) => {
                const anoAtual = hoje.getFullYear();
                const dataA = new Date(anoAtual, a.mes - 1, a.dia);
                const dataB = new Date(anoAtual, b.mes - 1, b.dia);
                if (dataA < hoje) dataA.setFullYear(anoAtual + 1);
                if (dataB < hoje) dataB.setFullYear(anoAtual + 1);
                return dataA - dataB;
              })
              .slice(0, 5);

            console.log('📅 Eventos filtrados:', eventosProximos);

            return eventosProximos.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {eventosProximos.map((evento, idx) => {
                  const anoAtual = hoje.getFullYear();
                  const dataEvento = new Date(anoAtual, evento.mes - 1, evento.dia);
                  if (dataEvento < hoje) dataEvento.setFullYear(anoAtual + 1);
                  
                  const diffDias = Math.ceil((dataEvento - hoje) / (1000 * 60 * 60 * 24));
                  const ehHoje = diffDias === 0;

                  return (
                    <div 
                      key={idx}
                      style={{background:ehHoje?'rgba(245,158,11,0.15)':'var(--color-surface-2)',border:ehHoje?'1px solid rgba(245,158,11,0.4)':'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'0.75rem'}}
                    >
                      <div className="flex items-start gap-2">
                        <div className="text-2xl">{evento.tipo === 'Maçônico' ? '🔷' : '🎊'}</div>
                        <div className="flex-1">
                          <div style={{fontWeight:"700",color:"var(--color-text)"}}>{evento.nome}</div>
                          <div style={{fontSize:"0.78rem",color:"var(--color-text-muted)",display:"flex",alignItems:"center",gap:"0.4rem",flexWrap:"wrap",marginTop:"0.25rem"}}>
                            <span>{evento.tipo}</span>
                            <span>•</span>
                            <span>📆 {dataEvento.toLocaleDateString('pt-BR', { 
                              day: '2-digit', 
                              month: 'long' 
                            })}</span>
                            {ehHoje && (
                              <>
                                <span>•</span>
                                <span style={{background:"rgba(245,158,11,0.2)",color:"#f59e0b",padding:"0.1rem 0.5rem",borderRadius:"999px",fontSize:"0.7rem",fontWeight:"700"}}>
                                  HOJE
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{textAlign:"center",padding:"1.5rem",borderRadius:"var(--radius-md)",background:"var(--color-surface-2)"}}>
                <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>📅</div>
                <p style={{fontSize:"0.82rem",color:"var(--color-text-muted)"}}>Nenhum evento nos próximos 30 dias</p>
              </div>
            );
          })()}
        </div>
      </div>

      {/* PARTICIPAÇÃO EM COMISSÕES */}
      <ParticipacaoComissoes />

      <div className="rounded-xl p-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <h3 className="text-xl font-bold mb-4" style={{color:"var(--color-text)"}}>Bem-vindo ao Sistema</h3>
        <p style={{color:"var(--color-text-muted)"}}>
          Utilize o menu de navegação para acessar as diferentes funcionalidades do sistema.
        </p>
      </div>

      {/* Modal de Situação dos Irmãos */}
      {modalSituacao.aberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            {/* Header */}
            <div style={{background:"var(--color-accent)",padding:"1rem 1.5rem"}}>
              <div className="flex justify-between items-center">
                <h3 style={{fontSize:"1.1rem",fontWeight:"700",color:"#fff",margin:0}}>{modalSituacao.titulo}</h3>
                <button
                  onClick={() => {
                    setModalSituacao({ aberto: false, titulo: '', irmaos: [] });
                    setFiltroComCargo(false);
                  }}
                  style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",borderRadius:"50%",width:"2rem",height:"2rem",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"1.1rem",fontWeight:"700"}}
                >
                  ×
                </button>
              </div>
              <p style={{fontSize:"0.82rem",color:"rgba(255,255,255,0.85)",marginTop:"0.25rem"}}>
                Total: {modalSituacao.irmaos.filter(i => !filtroComCargo || obterCargoAtual(i.id)).length} {modalSituacao.irmaos.filter(i => !filtroComCargo || obterCargoAtual(i.id)).length === 1 ? 'irmão' : 'irmãos'}
              </p>
              
              {/* Filtro apenas para Regulares */}
              {modalSituacao.titulo.includes('Regulares') && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setFiltroComCargo(false)}
                    style={{padding:'0.2rem 0.65rem',borderRadius:'var(--radius-md)',fontSize:'0.72rem',fontWeight:'700',cursor:'pointer',border:'none',background:!filtroComCargo?'rgba(255,255,255,0.3)':'rgba(255,255,255,0.1)',color:'#fff'}}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setFiltroComCargo(true)}
                    style={{padding:'0.2rem 0.65rem',borderRadius:'var(--radius-md)',fontSize:'0.72rem',fontWeight:'700',cursor:'pointer',border:'none',background:filtroComCargo?'rgba(255,255,255,0.3)':'rgba(255,255,255,0.1)',color:'#fff'}}
                  >
                    Apenas com Cargo
                  </button>
                </div>
              )}
            </div>

            {/* Corpo */}
            <div className="p-6 overflow-y-auto flex-1">
              {(() => {
                const irmaosFiltrados = modalSituacao.irmaos.filter(i => 
                  !filtroComCargo || obterCargoAtual(i.id)
                );
                
                return irmaosFiltrados.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {irmaosFiltrados.map((irmao) => (
                    <div key={irmao.id} className="border-2 rounded-lg p-4 hover: transition" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                      <div className="flex items-start gap-3">
                        {irmao.foto_url ? (
                          <img src={irmao.foto_url} alt={irmao.nome} className="w-16 h-16 rounded-full object-cover border-2" />
                        ) : (
                          <div style={{width:"4rem",height:"4rem",borderRadius:"50%",background:"var(--color-accent)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:"700",fontSize:"1.25rem"}}>
                            {irmao.nome?.charAt(0)}
                          </div>
                        )}
                        
                        <div className="flex-1">
                          <h4 className="font-bold flex items-center gap-2" style={{color:"var(--color-text)"}}>
                            {modalSituacao.titulo.includes('Falecidos') && <span className="text-lg">🕊️</span>}
                            {formatarNome(irmao.nome)}
                          </h4>
                          
                          <div className="flex flex-wrap gap-2 mt-2">
                            {/* Badge de Grau */}
                            <span style={{fontSize:'0.7rem',padding:'0.15rem 0.5rem',borderRadius:'var(--radius-sm)',fontWeight:'700',
                              background:obterGrau(irmao)==='Mestre Instalado'?'rgba(245,158,11,0.15)':obterGrau(irmao)==='Mestre'?'rgba(139,92,246,0.15)':obterGrau(irmao)==='Companheiro'?'rgba(16,185,129,0.15)':'rgba(59,130,246,0.15)',
                              color:obterGrau(irmao)==='Mestre Instalado'?'#f59e0b':obterGrau(irmao)==='Mestre'?'#8b5cf6':obterGrau(irmao)==='Companheiro'?'#10b981':'#3b82f6'}}>
                              {obterGrau(irmao)}
                            </span>

                            {/* Badge de Cargo (do histórico do ano atual) */}
                            {obterCargoAtual(irmao.id) && (
                              <div className="flex flex-col gap-1">
                                {obterCargoAtual(irmao.id).split(',').map((cargo, i) => (
                                  <span key={i} style={{fontSize:"0.7rem",padding:"0.15rem 0.5rem",borderRadius:"var(--radius-sm)",fontWeight:"700",background:"rgba(245,158,11,0.15)",color:"#f59e0b",border:"1px solid rgba(245,158,11,0.3)"}}>
                                    {cargo.trim()}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* CIM */}
                          {irmao.cim && (
                            <p style={{fontSize:"0.72rem",color:"var(--color-text-muted)",marginTop:"0.5rem"}}>CIM: {irmao.cim}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-4xl mb-3">📭</p>
                  <p>{filtroComCargo ? 'Nenhum irmão com cargo nesta categoria' : 'Nenhum irmão nesta categoria'}</p>
                </div>
              );
              })()}
            </div>

            {/* Footer */}
            <div style={{borderTop:"1px solid var(--color-border)",padding:"1rem 1.5rem"}}>
              <button
                onClick={() => {
                  setModalSituacao({ aberto: false, titulo: '', irmaos: [] });
                  setFiltroComCargo(false);
                }}
                style={{width:"100%",padding:"0.75rem 1.5rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"700"}}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Visitas dos Irmãos a Outras Lojas */}
      {modalVisitasIrmaos && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            {/* Header */}
            <div style={{background:"var(--color-accent)",padding:"1.25rem 1.5rem"}}>
              <h3 style={{fontSize:"1.25rem",fontWeight:"700",color:"#fff",margin:0}}>📍 Visitas dos Irmãos a Outras Lojas - {new Date().getFullYear()}</h3>
              <p style={{fontSize:"0.82rem",color:"rgba(255,255,255,0.85)",marginTop:"0.25rem"}}>Total: {totalVisitasIrmaos} visita(s)</p>
            </div>

            {/* Conteúdo */}
            <div className="p-6">

              {/* 🏆 Top 5 irmãos que mais visitaram outras lojas */}
              {topVisitantesIrmaos.length > 0 && (
                <div style={{marginBottom:'1.5rem', border:'1px solid var(--color-border)', borderRadius:'var(--radius-lg)', overflow:'hidden'}}>
                  <div style={{background:'var(--color-surface-2)', padding:'0.6rem 1rem', borderBottom:'1px solid var(--color-border)'}}>
                    <span style={{fontSize:'0.85rem', fontWeight:'700', color:'var(--color-text)'}}>🏆 Top 5 — Quem Mais Visitou</span>
                  </div>
                  <div>
                    {topVisitantesIrmaos.map((v, i) => (
                      <div key={i} style={{
                        display:'grid', gridTemplateColumns:'2rem 1fr auto', alignItems:'center', gap:'0.75rem',
                        padding:'0.5rem 1rem',
                        borderBottom: i < topVisitantesIrmaos.length - 1 ? '1px solid var(--color-border)' : 'none',
                        background: i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)',
                      }}>
                        <span style={{fontSize:'0.9rem', fontWeight:'800', color:'var(--color-text-muted)'}}>{i + 1}º</span>
                        <span style={{fontSize:'0.85rem', fontWeight:'600', color:'var(--color-text)'}}>{formatarNomeCurto(v.nome)}</span>
                        <span style={{fontSize:'0.85rem', fontWeight:'800', color:'var(--color-accent)', whiteSpace:'nowrap'}}>{v.qtd} visita{v.qtd !== 1 ? 's' : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                {visitasIrmaos.map(visita => (
                  <div key={visita.id} className="border rounded-lg p-3 hover: transition-shadow" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                    {/* Linha 1: Data e Nome */}
                    <div className="mb-1">
                      <div style={{fontSize:"0.82rem",color:"var(--color-text)"}}>
                        <span>{new Date(visita.data_visita + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                        <span> - </span>
                        <span className="font-semibold">{formatarNomeCurto(visita.irmaos?.nome)}</span>
                      </div>
                    </div>
                    
                    {/* Linha 2: Loja - Potência - Oriente */}
                    <div style={{fontSize:"0.72rem",color:"var(--color-text-muted)"}}>
                      {visita.nome_loja} - {visita.potencias_masonicas?.sigla || 'N/A'} - {visita.oriente}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{borderTop:"1px solid var(--color-border)",padding:"1rem 1.5rem"}}>
              <button
                onClick={() => setModalVisitasIrmaos(false)}
                style={{width:"100%",padding:"0.75rem 1.5rem",background:"var(--color-accent)",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"700"}}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Visitas de Autoridades da Potência */}
      {modalVisitasAutoridade && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            {/* Header */}
            <div style={{background:"#c9a84c",padding:"1.25rem 1.5rem"}}>
              <h3 style={{fontSize:"1.25rem",fontWeight:"700",color:"#fff",margin:0}}>🎖️ Visitas de Autoridades - {new Date().getFullYear()}</h3>
              <p style={{fontSize:"0.82rem",color:"rgba(255,255,255,0.85)",marginTop:"0.25rem"}}>Total: {totalVisitasAutoridade} visita(s)</p>
            </div>

            {/* Conteúdo */}
            <div className="p-6">
              <div className="grid grid-cols-2 gap-3">
                {visitasAutoridade.map(v => (
                  <div key={v.id} className="rounded-lg p-3" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)",borderLeft:"3px solid #c9a84c"}}>
                    <div style={{fontSize:"0.82rem",color:"var(--color-text)"}}>
                      <span>
                        {v.sessoes_presenca?.data_sessao
                          ? new Date(v.sessoes_presenca.data_sessao + 'T00:00:00').toLocaleDateString('pt-BR')
                          : new Date(v.created_at).toLocaleDateString('pt-BR')}
                      </span>
                      <span> — </span>
                      <span className="font-semibold">{v.sessoes_presenca?.graus_sessao?.nome || 'Sessão'}</span>
                    </div>
                    <div style={{fontSize:"0.85rem",fontWeight:"700",color:"var(--color-text)",marginTop:"0.25rem"}}>
                      {v.nome_visitante}
                    </div>
                    {v.cargo_autoridade && (
                      <div style={{fontSize:"0.75rem",color:"#c9a84c",fontWeight:"600"}}>{v.cargo_autoridade}</div>
                    )}
                    <div style={{fontSize:"0.72rem",color:"var(--color-text-muted)",marginTop:"0.15rem"}}>
                      {v.nome_loja || 'Loja não informada'} - {v.cidade || 'Cidade não informada'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{borderTop:"1px solid var(--color-border)",padding:"1rem 1.5rem"}}>
              <button
                onClick={() => setModalVisitasAutoridade(false)}
                style={{width:"100%",padding:"0.75rem 1.5rem",background:"#c9a84c",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"700"}}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Visitantes Recebidos */}
      {modalVisitantesRecebidos && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            {/* Header */}
            <div style={{background:"#10b981",padding:"1.25rem 1.5rem"}}>
              <h3 style={{fontSize:"1.25rem",fontWeight:"700",color:"#fff",margin:0}}>👥 Visitantes Recebidos - {new Date().getFullYear()}</h3>
              <p style={{fontSize:"0.82rem",color:"rgba(255,255,255,0.85)",marginTop:"0.25rem"}}>Total: {totalVisitantes} visitante(s)</p>
            </div>

            {/* Conteúdo */}
            <div className="p-6">
              <div className="grid grid-cols-3 gap-3">
                {visitantesRecebidos.map(visitante => (
                  <div key={visitante.id} className="border border-indigo-200 rounded-lg p-3 hover: transition-shadow" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                    {/* Linha 1: Data e Nome */}
                    <div className="mb-1">
                      <div style={{fontSize:"0.82rem",color:"var(--color-text)"}}>
                        <span>
                          {visitante.sessoes_presenca?.data_sessao 
                            ? new Date(visitante.sessoes_presenca.data_sessao + 'T00:00:00').toLocaleDateString('pt-BR')
                            : visitante.data_visita
                            ? new Date(visitante.data_visita + 'T00:00:00').toLocaleDateString('pt-BR')
                            : new Date(visitante.created_at).toLocaleDateString('pt-BR')}
                        </span>
                        <span> - </span>
                        <span className="font-semibold">
                          {visitante.nome || visitante.nome_visitante || 'N/A'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Linha 2: Loja - Oriente */}
                    <div style={{fontSize:"0.72rem",color:"var(--color-text-muted)"}}>
                      {visitante.nome_loja || visitante.loja_origem || visitante.loja || visitante.loja_visitante || 'Loja não informada'} - {visitante.oriente || visitante.cidade || visitante.oriente_visitante || 'Oriente não informado'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{borderTop:"1px solid var(--color-border)",padding:"1rem 1.5rem"}}>
              <button
                onClick={() => setModalVisitantesRecebidos(false)}
                style={{width:"100%",padding:"0.75rem 1.5rem",background:"#10b981",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"700"}}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
