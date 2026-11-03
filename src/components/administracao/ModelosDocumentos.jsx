import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { CABECALHO_PADRAO } from '../../utils/cabecalhoLoja';

// ── Modelos padrão — usados para popular o banco na primeira abertura ──────
const MODELOS_PADRAO = [
  {
    modulo: 'balaustres',
    mostrar_logo: true,
    tipo: 'lista_presenca_glemt',
    grau: 'Mestre',
    nome: 'Lista de Presença Eleição GLEMT',
    titulo_doc: "LISTA DE PRESENÇA — SESSÃO ELEITORAL\nEleição de Grão-Mestre e Grão-Mestre Adjunto da GLEMT — Período {periodo_glemt}",
    corpo: 'Sessão de {data_sessao}',
    corpo_aclamacao: '', corpo_disputa: '', rodape: '',
    assinatura_1_cargo: 'Venerável Mestre', assinatura_2_cargo: '', assinatura_3_cargo: '',
    alinhamento_titulo: 'center', alinhamento_corpo: 'center', alinhamento_assinatura: 'center',
  },
  {
    modulo: 'balaustres',
    mostrar_logo: true,
    tipo: 'edital_eleicao_glemt',
    grau: 'Mestre',
    nome: 'Edital Eleição GLEMT',
    titulo_doc: "EDITAL DE CONVOCAÇÃO Nº {numero_edital}\nELEIÇÃO DA GRANDE LOJA MAÇÔNICA DO ESTADO DE MATO GROSSO – PERÍODO {periodo_glemt_barra}",
    corpo: "O Venerável Mestre da Augusta e Respeitável Loja Simbólica {nome_loja}, no uso de suas atribuições e em cumprimento ao que determinam a Constituição, o Regulamento Geral da Ordem e o Código Eleitoral Maçônico da GLEMT, *CONVOCA* os Irmãos *Mestres Maçons* do quadro desta Oficina, regulares e quites com suas obrigações, para a Sessão Ordinária de Eleição do Sereníssimo Grão-Mestre e do Eminente Grão-Mestre Adjunto da Grande Loja Maçônica do Estado de Mato Grosso – GLEMT, para o período maçônico de {periodo_glemt}, a realizar-se no dia {data_sessao}, às {hora_abertura} horas, no Templo da Loja, situado na {endereco_loja}, cidade de {cidade}/{estado}.\n\nConcorrem ao pleito as seguintes chapas:\n{chapas_edital}\n\nPara conhecimento de todos, expede-se o presente Edital.",
    corpo_aclamacao: '', corpo_disputa: '', rodape: '',
    assinatura_1_cargo: 'Venerável Mestre', assinatura_2_cargo: '', assinatura_3_cargo: '',
    alinhamento_titulo: 'center', alinhamento_corpo: 'justify', alinhamento_assinatura: 'center',
  },
  {
    modulo: 'balaustres',
    mostrar_logo: false,
    tipo: 'ata_eleicao_glemt',
    subtitulo: 'Balaústre nº {numero_balaustre}/{ano_balaustre}',
    grau: 'Mestre',
    nome: 'Ata Eleição GLEMT',
    titulo_doc: "ATA DA ASSEMBLEIA GERAL ORDINÁRIA PARA ELEIÇÃO DA GRANDE LOJA DO ESTADO DE MATO GROSSO PARA O PERÍODO {periodo_glemt_barra}",
    corpo: "Aos {data_sessao} da era vulgar, às {hora_abertura} horas, reuniram-se nesta A∴R∴L∴S∴ Acácia de Paranatinga nº 30, na sua sede localizada na {endereco_loja}, cidade de {cidade}/{estado}, em Sessão Ordinária para Eleição da Administração da Grande Loja do Estado de Mato Grosso – GLEMT, para os cargos do Sereníssimo Grão-Mestre, Eminente Grão-Mestre Adjunto, atendendo à convocação feita pelo Respeitabilíssimo Mestre (Presidente) e Membros da Diretoria, para cumprimento do que determinam a Constituição, Regulamento Geral da Ordem e Código Eleitoral Maçônico da GLEMT.\n\nPreenchidos os lugares em Loja, os trabalhos foram abertos em Grau de Mestre Maçom com um simples golpe de malhete pelo Respeitabilíssimo Mestre da Oficina, dispensando-se a Leitura da Ata dos últimos trabalhos e dos Expedientes, passando diretamente à deliberação da Ordem do Dia.\n*ORDEM DO DIA:* Consta da Ordem do Dia eleição do Sereníssimo Grão-Mestre e Eminente Grão-Mestre Adjunto da GLEMT, de acordo com o Edital de Convocação, para o período maçônico de {periodo_glemt}. De acordo com o Regulamento Geral da Ordem, os Veneráveis Irmãos Orador e Secretário foram convidados para formarem a Mesa Eleitoral, consequentemente, foram nomeados os Veneráveis Irmãos {escrutinador1_nome} e {escrutinador2_nome}, para ocuparem respectivamente, os lugares dos Veneráveis Irmãos Orador e Secretário de Ofício e serem os Escrutinadores. Por ordem do Respeitabilíssimo Mestre, houve a COMPOSIÇÃO DA MESA ELEITORAL E ESCRUTINADORES, formados pelo Respeitab∴ Mestre, Ir∴ {vm_nome}; Ven∴ Orador, Ir∴ {orador_nome}; Ven∴ Secretário, Ir∴ {secretario_nome}; Ven∴ Escrutinador, Ir∴ {escrutinador1_nome}; Ven∴ Escrutinador, Ir∴ {escrutinador2_nome}.\nA Mesa Eleitoral composta, o Respeitabilíssimo Mestre ordenou ao Ir∴ Secretário Substituto, que procedesse a leitura das Chapas apresentadas, a fim que todos os Veneráveis Irmãos presentes tomassem conhecimento dos nomes dos candidatos e seus respectivos cargos; e, assim o fez, sendo apresentada {chapas_apresentadas}\nEm seguida, por ordem do Respeitabilíssimo Mestre, o Venerável Chanceler, Ir∴ {chanceler_nome}, anunciou os Veneráveis Irmãos aptos a votar e ser votados. Em seguida, o Ir∴ Tesoureiro da Loja, anunciou os Ir∴ aptos a votar e ser votados, conforme o Regulamento Geral da Ordem e o Código Eleitoral Maçônico.\nEstando os Obreiros aptos a votar e serem votados, o Venerável Mestre de Cerimônias, procedeu a distribuição das Cédulas a todos os Obreiros Eleitores presentes à Sessão e por ordem do Respeitabilíssimo Mestre houve a suspensão dos trabalhos temporariamente para que os IIr∴ exercessem o direito de voto. Finalizado o processo de votação, o Respeitabilíssimo Mestre reencetou os trabalhos. Neste momento, o Ir∴ Secretário realizou a chamada dos Obreiros Eleitores em ordem, a fim de assinarem a Folha de Votação e depositarem o seu voto na urna.\nPor ordem do Respeitabilíssimo Mestre, o Venerável Mestre de Cerimônias em posse da urna contendo as Cédulas Eleitorais entregou no Trono, e com a ajuda dos Veneráveis Irmãos Orador e Secretário Substitutos, houve a conferência da quantidade de Cédulas com o número de votantes presentes, bem como, a fazer a apuração, com o seguinte resultado: {resultado_apuracao} Votos em branco: {votos_brancos}; votos nulos: {votos_nulos}; total de votantes: {total_votantes}. Com a finalização do processo de votação e apuração, o Respeitabilíssimo Mestre solicitou aos Veneráveis Irmãos Orador e Secretário de Ofício que retornem a seus postos e reassumam suas respectivas Joias e que os Veneráveis Irmãos Escrutinadores retornem, cada qual, a seu lugar, já em seguida, colocou a Palavra nas Colunas e no Oriente, a fim que os Veneráveis Irmãos se manifestassem exclusivamente sobre o Ato Eleitoral.\n*TRONCO DE SOLIDARIEDADE:* O Tronco de Solidariedade após fazer seu giro, sem formalidades conforme Regulamento Geral e do Código Eleitoral Maçônico, recolheu ______ kg de moedas cunhadas.\nEsta Ata é o que foi deliberado em Assembleia da Loja, em {data_sessao}, e é de responsabilidade dos dirigentes e de todos os participantes. Nada mais foi tratado. Eu, {secretario_nome} (Secretário), lavrei a presente Ata que vai assinada pelo Venerável Mestre, Orador e Secretário. Os trabalhos foram encerrados com um simples golpe de malhete.",
    corpo_aclamacao: '', corpo_disputa: '', rodape: '',
    assinatura_1_cargo: 'Venerável Mestre', assinatura_2_cargo: 'Orador', assinatura_3_cargo: 'Secretário',
    alinhamento_titulo: 'center', alinhamento_corpo: 'justify', alinhamento_assinatura: 'center',
  },
  {
    modulo: 'balaustres',
    mostrar_logo: false,
    tipo: 'ata_sessao_aprendiz',
    subtitulo: 'Balaústre nº {numero_balaustre}/{ano_balaustre}',
    grau: 'Aprendiz',
    nome: 'Ata Aprendiz',
    titulo_doc: "ATA DE REUNIÃO\nSessão de {grau_extenso}",
    corpo: "Aos {data_sessao_extenso} da E∴ V∴, no Templo Maçônico, sito à {endereco_loja}, no Oriente de {cidade}-{estado}, reuniram-se no grau de {grau_reuniao} os obreiros do quadro da Augusta e Respeitável Loja Simbólica {nome_loja}, em nome e sob os auspícios da Sereníssima Grande Loja Maçônica do Estado de Mato Grosso – GLEMT. Os trabalhos foram abertos ritualisticamente às {hora_abertura} horas. A Loja estava assim constituída: V∴ M∴ {vm_nome}, 1º Vig∴ {primeiro_vigilante_nome}, 2º Vig∴ {segundo_vigilante_nome}, Orad∴ {orador_nome}, Secr∴ {secretario_nome}. O V∴ M∴ iniciou os trabalhos determinando que o Ir∴ Secr∴ procedesse à leitura do Balaústre da sessão anterior.\n*EXPEDIENTE:* \n*BOLSA DE PROPOSTA E INFORMAÇÕES:* \n*ORDEM DO DIA:* {ordem_dia}\n*TRONCO DE SOLIDARIEDADE:* Em seu giro recolheu a importância de R$ ______, moedas cunhadas e gravadas, a serem creditadas à Hospitalaria e debitadas à Tesouraria.\n*PALAVRA A BEM DA ORDEM E DO QUADRO EM PARTICULAR:* \n*ENCERRAMENTO:* O V∴ M∴ encerrou a presente sessão ritualisticamente às {hora_encerramento} horas, tendo eu, {secretario_nome}, que a tudo assisti, elaborei e redigi o presente Balaústre, tomando o cuidado de fazê-lo em local ermo e longe das vistas profanas, o qual lido e, se aprovado, será assinado por quem de direito.",
    corpo_aclamacao: '', corpo_disputa: '', rodape: '',
    assinatura_1_cargo: 'Venerável Mestre', assinatura_2_cargo: 'Orador', assinatura_3_cargo: 'Secretário',
    alinhamento_titulo: 'center', alinhamento_corpo: 'justify', alinhamento_assinatura: 'center',
  },
  {
    modulo: 'balaustres',
    mostrar_logo: false,
    tipo: 'ata_sessao_companheiro',
    subtitulo: 'Balaústre nº {numero_balaustre}/{ano_balaustre}',
    grau: 'Companheiro',
    nome: 'Ata Companheiro',
    titulo_doc: "ATA DE REUNIÃO\nSessão de {grau_extenso}",
    corpo: "Aos {data_sessao_extenso} da E∴ V∴, no Templo Maçônico, sito à {endereco_loja}, no Oriente de {cidade}-{estado}, reuniram-se no grau de {grau_reuniao} os obreiros do quadro da Augusta e Respeitável Loja Simbólica {nome_loja}, em nome e sob os auspícios da Sereníssima Grande Loja Maçônica do Estado de Mato Grosso – GLEMT. Os trabalhos foram abertos ritualisticamente às {hora_abertura} horas. A Loja estava assim constituída: V∴ M∴ {vm_nome}, 1º Vig∴ {primeiro_vigilante_nome}, 2º Vig∴ {segundo_vigilante_nome}, Orad∴ {orador_nome}, Secr∴ {secretario_nome}. O V∴ M∴ iniciou os trabalhos determinando que o Ir∴ Secr∴ procedesse à leitura do Balaústre da sessão anterior.\n*EXPEDIENTE:* \n*BOLSA DE PROPOSTA E INFORMAÇÕES:* \n*ORDEM DO DIA:* {ordem_dia}\n*TRONCO DE SOLIDARIEDADE:* Em seu giro recolheu a importância de R$ ______, moedas cunhadas e gravadas, a serem creditadas à Hospitalaria e debitadas à Tesouraria.\n*PALAVRA A BEM DA ORDEM E DO QUADRO EM PARTICULAR:* \n*ENCERRAMENTO:* O V∴ M∴ encerrou a presente sessão ritualisticamente às {hora_encerramento} horas, tendo eu, {secretario_nome}, que a tudo assisti, elaborei e redigi o presente Balaústre, tomando o cuidado de fazê-lo em local ermo e longe das vistas profanas, o qual lido e, se aprovado, será assinado por quem de direito.",
    corpo_aclamacao: '', corpo_disputa: '', rodape: '',
    assinatura_1_cargo: 'Venerável Mestre', assinatura_2_cargo: 'Orador', assinatura_3_cargo: 'Secretário',
    alinhamento_titulo: 'center', alinhamento_corpo: 'justify', alinhamento_assinatura: 'center',
  },
  {
    modulo: 'balaustres',
    mostrar_logo: false,
    tipo: 'ata_sessao_mestre',
    subtitulo: 'Balaústre nº {numero_balaustre}/{ano_balaustre}',
    grau: 'Mestre',
    nome: 'Ata Mestre',
    titulo_doc: "ATA DE REUNIÃO\nSessão de {grau_extenso}",
    corpo: "Aos {data_sessao_extenso} da E∴ V∴, no Templo Maçônico, sito à {endereco_loja}, no Oriente de {cidade}-{estado}, reuniram-se no grau de {grau_reuniao} os obreiros do quadro da Augusta e Respeitável Loja Simbólica {nome_loja}, em nome e sob os auspícios da Sereníssima Grande Loja Maçônica do Estado de Mato Grosso – GLEMT. Os trabalhos foram abertos ritualisticamente às {hora_abertura} horas. A Loja estava assim constituída: V∴ M∴ {vm_nome}, 1º Vig∴ {primeiro_vigilante_nome}, 2º Vig∴ {segundo_vigilante_nome}, Orad∴ {orador_nome}, Secr∴ {secretario_nome}. O V∴ M∴ iniciou os trabalhos determinando que o Ir∴ Secr∴ procedesse à leitura do Balaústre da sessão anterior.\n*EXPEDIENTE:* \n*BOLSA DE PROPOSTA E INFORMAÇÕES:* \n*ORDEM DO DIA:* {ordem_dia}\n*TRONCO DE SOLIDARIEDADE:* Em seu giro recolheu a importância de R$ ______, moedas cunhadas e gravadas, a serem creditadas à Hospitalaria e debitadas à Tesouraria.\n*PALAVRA A BEM DA ORDEM E DO QUADRO EM PARTICULAR:* \n*ENCERRAMENTO:* O V∴ M∴ encerrou a presente sessão ritualisticamente às {hora_encerramento} horas, tendo eu, {secretario_nome}, que a tudo assisti, elaborei e redigi o presente Balaústre, tomando o cuidado de fazê-lo em local ermo e longe das vistas profanas, o qual lido e, se aprovado, será assinado por quem de direito.",
    corpo_aclamacao: '', corpo_disputa: '', rodape: '',
    assinatura_1_cargo: 'Venerável Mestre', assinatura_2_cargo: 'Orador', assinatura_3_cargo: 'Secretário',
    alinhamento_titulo: 'center', alinhamento_corpo: 'justify', alinhamento_assinatura: 'center',
  },
  {
    modulo: 'eleicao_posse',
    tipo: 'apresentacao_chapa',
    nome: 'Apresentação da Chapa',
    titulo_doc: 'APRESENTAÇÃO DE CHAPA – {nome_chapa_maiusculo}',
    corpo: "À A∴R∴L∴S∴ {nome_loja} Oriente de {cidade}-{estado}.\n{cidade}-{estado}, aos {data_emissao_extenso} da Era Vulgar.\nMeus queridos Irmãos,\n\nEm atenção ao Edital de Convocação para as eleições da administração desta Respeitável Loja, venho, com espírito de fraternidade e responsabilidade, apresentar a *Chapa regularmente formada*, para concorrer aos cargos da gestão do próximo ano:\n\nA composição da Chapa é a seguinte:",
    corpo_aclamacao: '', corpo_disputa: '',
    rodape: "Apresento esta Chapa com o firme propósito de dar continuidade aos trabalhos da Oficina, fortalecer a união entre os Irmãos e zelar pelos princípios que norteiam nossa Sublime Instituição.\nColoco-me, juntamente com os demais Irmãos que compõem esta Chapa, à disposição desta Respeitável Loja, para ouvir, dialogar e trabalhar com dedicação pelo engrandecimento de nossa Oficina.\n\nT∴F∴A∴",
    assinatura_1_cargo: 'Candidato à Venerável Mestre', assinatura_2_cargo: '', assinatura_3_cargo: '',
    alinhamento_titulo: 'center', alinhamento_corpo: 'justify', alinhamento_assinatura: 'left',
  },
  {
    modulo: 'eleicao_posse',
    tipo: 'edital_eleicao',
    nome: 'Edital de Convocação para Eleição',
    titulo_doc: 'Edital de Convocação para Eleição nº {numero_edital}',
    corpo: 'Na qualidade de Venerável Mestre, Sr. {vm_nome}, os Mestres Maçons ativos e regulares do Quadro desta Augusta e Respeitável Loja Simbólica {nome_loja}, que estejam aptos ao exercício do voto nos termos da Constituição e do Regulamento Geral, estão CONVOCADOS, por este Edital, para a Sessão Ordinária de Eleição do Corpo Administrativo da Augusta e Respeitável Loja Simbólica {nome_loja} – Gestão {gestao}, a realizar-se no dia {data_eleicao}, às {hora_eleicao} horas nas dependências do Templo situado a {endereco_loja}, conforme estabelece o Artigo 187 do Regulamento Geral.',
    corpo_aclamacao: '', corpo_disputa: '', rodape: '',
    assinatura_1_cargo: 'Venerável Mestre', assinatura_2_cargo: '', assinatura_3_cargo: '',
    alinhamento_titulo: 'center', alinhamento_corpo: 'justify', alinhamento_assinatura: 'center',
  },
  {
    modulo: 'eleicao_posse',
    tipo: 'edital_posse',
    nome: 'Edital de Convocação para Posse',
    titulo_doc: 'Edital de Convocação para Posse nº {numero_edital}',
    corpo: 'Na qualidade de Venerável Mestre, Sr. {vm_nome}, os Mestres Maçons ativos e regulares do Quadro desta Augusta e Respeitável Loja Simbólica {nome_loja}, que estejam aptos ao exercício do voto nos termos da Constituição e do Regulamento Geral, estão CONVOCADOS, por este Edital, para a Sessão Ordinária de Posse do Corpo Administrativo da Augusta e Respeitável Loja Simbólica {nome_loja} – Gestão {gestao}, a realizar-se no dia {data_posse}, às {hora_posse} horas nas dependências do Templo situado a {endereco_loja}, conforme estabelece o Artigo 187 do Regulamento Geral.',
    corpo_aclamacao: '', corpo_disputa: '', rodape: '',
    assinatura_1_cargo: 'Venerável Mestre', assinatura_2_cargo: '', assinatura_3_cargo: '',
    alinhamento_titulo: 'center', alinhamento_corpo: 'justify', alinhamento_assinatura: 'center',
  },
  {
    modulo: 'eleicao_posse',
    tipo: 'ata_eleicao_loja',
    subtitulo: 'Balaústre nº {numero_balaustre}/{ano_balaustre}',
    nome: 'Ata de Eleição (Loja)',
    titulo_doc: 'ATA DA SESSÃO ORDINÁRIA DE ELEIÇÃO DA DIRETORIA DA AUGUSTA E RESPEITÁVEL LOJA SIMBÓLICA {nome_loja}, PARA O PERÍODO {gestao}',
    corpo: "Aos {data_eleicao} da era vulgar, às {hora_eleicao} horas, reuniram-se em Sessão Ordinária, para eleição dos cargos de Venerável Mestre (Presidente) e Membros da Diretoria, em cumprimento ao disposto no artigo 187 do Regulamento Geral da Ordem e em conformidade com os artigos 37 e 46 do Código Eleitoral Maçônico e artigo 3º, e artigos 29, 30, 31, 32, 33 e 34 do Estatuto da Augusta e Respeitável Loja Simbólica Acácia de Paranatinga nº {num_loja}, na sua sede, localizada na {endereco_loja}, cidade de {cidade}/{estado}. Preenchidos os lugares em Loja, os trabalhos foram abertos em Grau de Mestre Maçom com um simples golpe de malhete, dispensando-se a Leitura da Ata e Expedientes.\n*ORDEM DO DIA:* Eleição do Venerável Mestre (Presidente) e dos Membros da Diretoria para a gestão de {ano_exercicio}, conforme o Edital de Convocação. Os trabalhos foram presididos pelo Venerável Mestre (Presidente) {vm_nome}, 1º Vigilante (1º Vice-Presidente) {primeiro_vigilante_nome}, 2º Vigilante (2º Vice-Presidente) {segundo_vigilante_nome}, e pelos membros {orador_nome} e {secretario_nome}, Orador e Secretário, respectivamente. {trecho_votacao} Em seguida o Venerável Mestre (Presidente) anunciou a aprovação da chapa para a gestão de {ano_exercicio}, com início em {data_inicio_gestao} até {data_fim_gestao}, que ficou composta dos seguintes cargos e seus membros e comissões:",
    corpo_aclamacao: "Por se tratar de chapa única, *{nome_chapa}*, não houve composição de mesa eleitoral. Estavam presentes à sessão {num_votantes} membros votantes, do total de {total_mestres} irmãos Mestres, atendendo ao quórum mínimo de 1/3 ({quorum_minimo} membros) exigido pelo estatuto para aprovação, declarados pelo Chanceler e Tesoureiro como aptos ao exercício do voto. Então, por ordem do Venerável Mestre (Presidente), foi votado por aclamação, sendo aprovada a chapa única por todos os membros presentes, sem nenhuma objeção ou abstenção.",
    corpo_disputa: "Havendo mais de uma chapa inscrita, foi constituída a mesa eleitoral para o escrutínio secreto, composta pelo Orador e pelo Secretário, e designados dois escrutinadores dentre os eleitores presentes. Estavam presentes à sessão {num_votantes} membros votantes, do total de {total_mestres} irmãos Mestres, atendendo ao quórum mínimo de 1/3 ({quorum_minimo} membros) exigido pelo estatuto, declarados pelo Chanceler e Tesoureiro como aptos ao exercício do voto. Distribuídas as cédulas rubricadas pela mesa e realizada a votação, a urna foi aberta e o número de cédulas conferido com o de votantes. Apurados os votos, obteve-se o seguinte resultado: Chapa [nome]: [nº] votos; Chapa [nome]: [nº] votos; votos em branco: [nº]; votos nulos: [nº]. Não havendo impugnação, o Venerável Mestre (Presidente) proclamou eleita a *{nome_chapa}*.",
    rodape: "*TRONCO DE SOLIDARIEDADE:* O Tronco de Solidariedade, após fazer seu giro, recolheu a importância de R$ ______, moedas cunhadas e gravadas, a serem creditadas à Hospitalaria e debitadas à Tesouraria.\n*PALAVRA A BEM DA ORDEM E DO QUADRO EM PARTICULAR:* Franqueada a palavra nas Colunas e no Oriente, não houve quem dela quisesse fazer uso.\n*ENCERRAMENTO:* Nada mais havendo a tratar, o Venerável Mestre (Presidente) encerrou os trabalhos com um simples golpe de malhete, às {hora_encerramento} horas. Esta Ata é o que foi deliberado em Assembleia da Loja, em {data_eleicao}, e é de responsabilidade dos dirigentes e de todos os participantes. Eu, {secretario_nome}, Secretário, lavrei a presente Ata, que vai assinada pelo Venerável Mestre (Presidente), Orador e Secretário.",
    assinatura_1_cargo: 'Venerável Mestre', assinatura_2_cargo: 'Orador', assinatura_3_cargo: 'Secretário',
    alinhamento_titulo: 'center', alinhamento_corpo: 'justify', alinhamento_assinatura: 'center',
  },
  {
    modulo: 'eleicao_posse',
    tipo: 'ata_eleicao_cartorio',
    subtitulo: 'Balaústre nº {numero_balaustre}/{ano_balaustre}',
    nome: 'Ata de Eleição (Cartório)',
    titulo_doc: 'ATA DA ASSEMBLEIA GERAL ORDINÁRIA DE ELEIÇÃO DA AUGUSTA E RESPEITÁVEL LOJA SIMBÓLICA {nome_loja}, PARA O PERÍODO {gestao}',
    corpo: "Aos {data_eleicao} da era vulgar, às {hora_eleicao} horas, reuniram-se em Sessão Ordinária, para eleição dos cargos de Venerável Mestre (Presidente) e Membros da Diretoria, em cumprimento ao disposto no artigo 187 do Regulamento Geral da Ordem e em conformidade com os artigos 37 e 46 do Código Eleitoral Maçônico e artigo 3º, e artigos 29, 30, 31, 32, 33 e 34 do Estatuto da Augusta e Respeitável Loja Simbólica Acácia de Paranatinga nº {num_loja}, na sua sede, localizada na {endereco_loja}, cidade de {cidade}/{estado}. Preenchidos os lugares em Loja, os trabalhos foram abertos em Grau de Mestre Maçom com um simples golpe de malhete, dispensando-se a Leitura da Ata e Expedientes.\n*ORDEM DO DIA:* Eleição do Venerável Mestre (Presidente) e dos Membros da Diretoria para a gestão de {ano_exercicio}, conforme o Edital de Convocação. Os trabalhos foram presididos pelo Venerável Mestre (Presidente) {vm_nome}, 1º Vigilante (1º Vice-Presidente) {primeiro_vigilante_nome}, 2º Vigilante (2º Vice-Presidente) {segundo_vigilante_nome}, e pelos membros {orador_nome} e {secretario_nome}, Orador e Secretário, respectivamente. {trecho_votacao} Em seguida o Venerável Mestre (Presidente) anunciou a aprovação da chapa para a gestão de {ano_exercicio}, com início em {data_inicio_gestao} até {data_fim_gestao}, que ficou composta dos seguintes cargos e seus membros e comissões:",
    corpo_aclamacao: "Por se tratar de chapa única, *{nome_chapa}*, não houve composição de mesa eleitoral. Estavam presentes à sessão {num_votantes} membros votantes, do total de {total_mestres} irmãos Mestres, atendendo ao quórum mínimo de 1/3 ({quorum_minimo} membros) exigido pelo estatuto para aprovação, declarados pelo Chanceler e Tesoureiro como aptos ao exercício do voto. Então, por ordem do Venerável Mestre (Presidente), foi votado por aclamação, sendo aprovada a chapa única por todos os membros presentes, sem nenhuma objeção ou abstenção.",
    corpo_disputa: "Havendo mais de uma chapa inscrita, foi constituída a mesa eleitoral para o escrutínio secreto, composta pelo Orador e pelo Secretário, e designados dois escrutinadores dentre os eleitores presentes. Estavam presentes à sessão {num_votantes} membros votantes, do total de {total_mestres} irmãos Mestres, atendendo ao quórum mínimo de 1/3 ({quorum_minimo} membros) exigido pelo estatuto, declarados pelo Chanceler e Tesoureiro como aptos ao exercício do voto. Distribuídas as cédulas rubricadas pela mesa e realizada a votação, a urna foi aberta e o número de cédulas conferido com o de votantes. Apurados os votos, obteve-se o seguinte resultado: Chapa [nome]: [nº] votos; Chapa [nome]: [nº] votos; votos em branco: [nº]; votos nulos: [nº]. Não havendo impugnação, o Venerável Mestre (Presidente) proclamou eleita a *{nome_chapa}*.",
    rodape: "*TRONCO DE SOLIDARIEDADE:* O Tronco de Solidariedade, após fazer seu giro, recolheu a importância de R$ ______, moedas cunhadas e gravadas, a serem creditadas à Hospitalaria e debitadas à Tesouraria.\n*PALAVRA A BEM DA ORDEM E DO QUADRO EM PARTICULAR:* Franqueada a palavra nas Colunas e no Oriente, não houve quem dela quisesse fazer uso.\n*ENCERRAMENTO:* Nada mais havendo a tratar, o Venerável Mestre (Presidente) encerrou os trabalhos com um simples golpe de malhete, às {hora_encerramento} horas. Esta Ata é o que foi deliberado em Assembleia da Loja, em {data_eleicao}, e é de responsabilidade dos dirigentes e de todos os participantes. Eu, {secretario_nome}, Secretário, lavrei a presente Ata, que vai assinada pelo Venerável Mestre (Presidente), Orador e Secretário.",
    assinatura_1_cargo: 'Venerável Mestre', assinatura_2_cargo: 'Orador', assinatura_3_cargo: 'Secretário',
    alinhamento_titulo: 'center', alinhamento_corpo: 'justify', alinhamento_assinatura: 'center',
  },
  {
    modulo: 'eleicao_posse',
    tipo: 'ata_posse',
    subtitulo: 'Balaústre nº {numero_balaustre}/{ano_balaustre}',
    nome: 'Ata de Posse',
    titulo_doc: 'ATA DA SESSÃO ORDINÁRIA DE POSSE DA DIRETORIA DA AUGUSTA E RESPEITÁVEL LOJA SIMBÓLICA {nome_loja}, PARA O PERÍODO {gestao}',
    corpo: 'Aos {data_posse}, às {hora_posse}, na Augusta e Respeitável Loja Simbólica {nome_loja}, sob a presidência do Venerável Mestre (Presidente) {vm_instalador_nome}, 1º Vigilante (1º Vice-Presidente) {primeiro_vigilante_instalador_nome}, 2º Vigilante (2º Vice-Presidente) {segundo_vigilante_instalador_nome}. O assunto foi a posse em seus respectivos cargos dos membros, eleitos para o cargo de Venerável Mestre, membros da Diretoria e Comissões da Augusta e Respeitável Loja Simbólica {nome_loja}, com início em {data_inicio_gestao} até {data_fim_gestao}, para a gestão de {ano_exercicio}. Foram empossados os Irmãos:',
    corpo_aclamacao: '', corpo_disputa: '',
    rodape: 'Nada mais havendo a constar, eu, {secretario_eleito_nome}, lavrei a presente ata que após lida e aprovada será assinada pelo Venerável Mestre (Presidente), 1º Vigilante (1º Vice-Presidente), 2º Vigilante (2º Vice-Presidente), Secretário, Tesoureiro, Orador e Chanceler.',
    assinatura_1_cargo: 'Venerável Mestre Instalador', assinatura_2_cargo: 'Venerável Mestre Empossado', assinatura_3_cargo: 'Secretário',
    alinhamento_titulo: 'center', alinhamento_corpo: 'justify', alinhamento_assinatura: 'center',
  },
  {
    modulo: 'eleicao_posse',
    tipo: 'requerimento_eleicao',
    nome: 'Requerimento — Eleição',
    titulo_doc: '',
    corpo: '*AUGUSTA E RESPEITÁVEL LOJA SIMBÓLICA {nome_loja}*, pessoa jurídica de direito privado, inscrita no CNPJ/MF {cnpj}, com sede localizada na {endereco_loja}, cidade de {cidade}/{estado}, representada pelo seu presidente, Sr. *{presidente_requerimento}*, {presidente_requerimento_qualificacao}. Vem com o devido respeito à presença de Vossa Senhoria, REQUERER, que digne em proceder com a averbação da ATA DA ASSEMBLEIA GERAL ORDINÁRIA DE ELEIÇÃO DA AUGUSTA E RESPEITÁVEL LOJA SIMBÓLICA {nome_loja}, PARA O PERÍODO {ano_exercicio} em Pessoas Jurídicas dessa Serventia, junto ao registro sob nº {numero_registro_cartorio}, com base no que expressa o teor do disposto nos Art. 114 a 121 da Lei 6.015/73 que rege os Registros Públicos.',
    corpo_aclamacao: '', corpo_disputa: '', rodape: '',
    assinatura_1_cargo: 'Presidente', assinatura_2_cargo: '', assinatura_3_cargo: '',
    alinhamento_titulo: 'left', alinhamento_corpo: 'justify', alinhamento_assinatura: 'center',
  },
  {
    modulo: 'eleicao_posse',
    tipo: 'requerimento_posse',
    nome: 'Requerimento — Posse',
    titulo_doc: '',
    corpo: '*AUGUSTA E RESPEITÁVEL LOJA SIMBÓLICA {nome_loja}*, pessoa jurídica de direito privado, inscrita no CNPJ/MF {cnpj}, com sede localizada na {endereco_loja}, cidade de {cidade}/{estado}, representada pelo seu presidente, Sr. *{presidente_requerimento}*, {presidente_requerimento_qualificacao}. Vem com o devido respeito à presença de Vossa Senhoria, REQUERER, que digne em proceder com a averbação da ATA DA ASSEMBLEIA GERAL ORDINÁRIA DE POSSE DA DIRETORIA DA AUGUSTA E RESPEITÁVEL LOJA SIMBÓLICA {nome_loja} PARA O PERÍODO {ano_exercicio} em Pessoas Jurídicas dessa Serventia, junto ao registro sob nº {numero_registro_cartorio}, com base no que expressa o teor do disposto nos Art. 114 a 121 da Lei 6.015/73 que rege os Registros Públicos.',
    corpo_aclamacao: '', corpo_disputa: '', rodape: '',
    assinatura_1_cargo: 'Presidente', assinatura_2_cargo: '', assinatura_3_cargo: '',
    alinhamento_titulo: 'left', alinhamento_corpo: 'justify', alinhamento_assinatura: 'center',
  },
  {
    modulo: 'eleicao_posse',
    tipo: 'lista_presenca_eleicao',
    nome: 'Lista de Presença — Eleição',
    titulo_doc: 'Lista de Presença — Sessão de Eleição',
    corpo: 'Gestão: {gestao}     Data: {data_eleicao}',
    corpo_aclamacao: '', corpo_disputa: '', rodape: '',
    assinatura_1_cargo: '', assinatura_2_cargo: '', assinatura_3_cargo: '',
    alinhamento_titulo: 'center', alinhamento_corpo: 'center', alinhamento_assinatura: 'center',
  },
  {
    modulo: 'eleicao_posse',
    tipo: 'lista_presenca_posse',
    nome: 'Lista de Presença — Posse',
    titulo_doc: 'Lista de Presença — Sessão de Posse',
    corpo: 'Gestão: {gestao}     Data: {data_posse}',
    corpo_aclamacao: '', corpo_disputa: '', rodape: '',
    assinatura_1_cargo: '', assinatura_2_cargo: '', assinatura_3_cargo: '',
    alinhamento_titulo: 'center', alinhamento_corpo: 'center', alinhamento_assinatura: 'center',
  },
];
// Ata de Posse (Cartório): mesmo texto da Ata de Posse; a diferença é a lista dos empossados
// (qualificação completa, só V.M., Vigilantes, Orador, Secretário, Tesoureiro e Chanceler)
MODELOS_PADRAO.push({ ...MODELOS_PADRAO.find(m => m.tipo === 'ata_posse'), tipo: 'ata_posse_cartorio', nome: 'Ata de Posse (Cartório)' });

// Agrupamento das variáveis por assunto (pelo próprio nome), para o painel não ficar embolado
const GRUPOS_VARIAVEIS = [
  { titulo: '🏛️ Loja', testa: (v) => /nome_loja|num_loja|endereco_loja|data_fundacao|cidade|estado|cnpj|numero_registro_cartorio|total_mestres|quorum/.test(v) },
  { titulo: '👤 Cargos e Irmãos', testa: (v) => /vm_|orador|secretario|chanceler|vigilante|instalador|escrutinador|presidente|candidato/.test(v) },
  { titulo: '📅 Datas e horários', testa: (v) => /data_|hora_|ano_exercicio|ano_balaustre|gestao|periodo_glemt/.test(v) },
  { titulo: '📕 Balaústre e sessão', testa: (v) => /balaustre|sessao|grau_reuniao|ordem_dia|num_votantes/.test(v) },
  { titulo: '📢 Edital', testa: (v) => /edital/.test(v) },
  { titulo: '🗳️ Chapas e apuração', testa: (v) => /chapa|apuracao|proclamacao|votos_|total_votantes|resultado|trecho_votacao/.test(v) },
  { titulo: '🧳 Voto em trânsito', testa: (v) => /transito|urnas/.test(v) },
  { titulo: '📄 Outras', testa: () => true },
];

const VARIAVEIS_DISPONIVEIS = [
  { var: '{vm_nome}',                  desc: 'Nome do VM convocante' },
  { var: '{gestao}',                   desc: 'Gestão (ex: 2026/2027)' },
  { var: '{data_inicio_gestao}',       desc: 'Início da gestão (dd/mm/aaaa)' },
  { var: '{data_fim_gestao}',          desc: 'Fim da gestão (dd/mm/aaaa)' },
  { var: '{ano_exercicio}',            desc: 'Ano de exercício (ex: 2026/2027)' },
  { var: '{nome_loja}',                desc: 'Nome completo da loja' },
  { var: '{nome_loja_normal}',        desc: 'Nome da Loja sem caixa alta (ex.: Acácia de Paranatinga nº 30)' },
  { var: '{num_loja}',                 desc: 'Número da loja' },
  { var: '{data_eleicao}',             desc: 'Data da eleição (dd/mm/aaaa)' },
  { var: '{hora_eleicao}',             desc: 'Hora da eleição' },
  { var: '{data_edital_eleicao}',      desc: 'Data do edital de eleição por extenso' },
  { var: '{data_posse}',               desc: 'Data da posse (dd/mm/aaaa)' },
  { var: '{hora_posse}',               desc: 'Hora da posse' },
  { var: '{data_edital_posse}',        desc: 'Data do edital de posse por extenso' },
  { var: '{cidade}',                   desc: 'Cidade da loja' },
  { var: '{estado}',                   desc: 'Estado (UF)' },
  { var: '{endereco_loja}',            desc: 'Endereço da loja' },
  { var: '{data_fundacao}',            desc: 'Data de fundação' },
  { var: '{orador_nome}',              desc: 'Nome do Orador eleito' },
  { var: '{secretario_nome}',          desc: 'Nome do Secretário Sainte' },
  { var: '{secretario_eleito_nome}',   desc: 'Nome do Secretário Eleito (empossado)' },
  { var: '{vm_eleito_nome}',                        desc: 'Nome do VM Eleito' },
  { var: '{vm_instalador_nome}',                     desc: 'Nome do VM Instalador (conduz a posse)' },
  { var: '{primeiro_vigilante_instalador_nome}',     desc: '1º Vigilante Instalador' },
  { var: '{segundo_vigilante_instalador_nome}',      desc: '2º Vigilante Instalador' },
  { var: '{orador_eleito_nome}',        desc: 'Nome do Orador Eleito' },
  { var: '{secretario_dados}',         desc: 'Qualificação completa do Secretário' },
  { var: '{num_votantes}',             desc: 'Número de votantes presentes' },
  { var: '{data_atual}',               desc: 'Data de hoje (ex: 09/10/2026)' },
  { var: '{numero_edital}',            desc: 'Editais (Loja e GLEMT): nº/ano do edital (ex.: 01/2026) — vem da tela Editais; reinicia a cada ano, mesma sequência para todos os tipos' },
  { var: '{ano_edital}',               desc: 'Editais da Loja: ano do edital (padrão: ano da eleição/posse)' },
  { var: '{numero_balaustre}',         desc: 'Atas de sessão: número do balaustre' },
  { var: '{balaustre_anterior}',       desc: 'Atas de sessão: balaustre anterior do mesmo grau (ex: 11/2026)' },
  { var: '{periodo_glemt}',            desc: 'Eleição GLEMT: período (ex: 2027 a 2030)' },
  { var: '{periodo_glemt_barra}',      desc: 'Eleição GLEMT: período (ex: 2027/2030)' },
  { var: '{data_sessao}',              desc: 'Data da sessão do balaustre (dd/mm/aaaa)' },
  { var: '{hora_encerramento}',        desc: 'Hora de encerramento (do balaustre da sessão; padrão 22:00)' },
  { var: '{data_edital}',              desc: 'Data do edital — por extenso nos documentos da Loja; dd/mm/aaaa nos da GLEMT' },
  { var: '{data_edital_curta}',        desc: 'Eleição/Posse da Loja: data do edital em dd/mm/aaaa' },
  { var: '{data_edital_extenso}',      desc: 'Edital GLEMT: data do edital por extenso' },
  { var: '{chapas_edital}',            desc: 'Edital GLEMT: uma linha por chapa com Grão-Mestre e Adjunto' },
  { var: '{chapas_apresentadas}',      desc: 'Eleição GLEMT: "a Chapa X, para a qual o Ir∴ ... é candidato..."' },
  { var: '{chanceler_nome}',           desc: 'Atas de sessão: Chanceler (Corpo Adm. do ano)' },
  { var: '{apuracao_urnas}',           desc: 'Eleição GLEMT: apuração separada — nossa Loja e cada loja em trânsito, com os votos de cada chapa' },
  { var: '{lojas_transito_nomes}',     desc: 'Eleição GLEMT: Lojas que votam em trânsito, com o oriente, separadas por vírgula e "e"' },
  { var: '{lojas_transito_lista}',     desc: 'Eleição GLEMT: só os nomes das Lojas em trânsito' },
  { var: '{lojas_urnas_nomes}',        desc: 'Eleição GLEMT: nossa Loja e as de trânsito (para citar as urnas separadas)' },
  { var: '{qtd_urnas}',                desc: 'Eleição GLEMT: quantidade de urnas (nossa Loja + lojas em trânsito)' },
  { var: '{votantes_loja}',            desc: 'Eleição GLEMT: eleitores que votaram na urna da nossa Loja (+ _extenso)' },
  { var: '{votantes_transito_total}',  desc: 'Eleição GLEMT: total de eleitores em trânsito (+ _extenso)' },
  { var: '{trecho_urnas_transito}',    desc: 'Eleição GLEMT: parágrafo pronto repetido para CADA Loja em trânsito (abertura da urna e nº de votantes)' },
  { var: '{votantes_transito_por_loja}', desc: 'Eleição GLEMT: uma linha por Loja em trânsito, com a quantidade de votantes' },
  { var: '{votantes_transito1}',       desc: 'Eleição GLEMT: eleitores da 1ª Loja em trânsito (2, 3… conforme a ordem; + _extenso)' },
  { var: '{total_votantes_geral}',     desc: 'Eleição GLEMT: total geral de votantes (+ _extenso)' },
  { var: '{apuracao_por_loja}',        desc: 'Eleição GLEMT: apuração POR LOJA no formato da ata (chapas, candidatos, votos e o resumo de brancos/nulos)' },
  { var: '{proclamacao_por_loja}',     desc: 'Eleição GLEMT: mesma apresentação por Loja, SEM o resumo — para proclamar o resultado' },
  { var: '{proclamacao_chapas}',       desc: 'Eleição GLEMT: só as chapas com os votos do consolidado (sem título, resumo ou vencedora)' },
  { var: '{proclamacao_geral}',        desc: 'Eleição GLEMT: resultado GERAL somando todas as urnas — chapas, votos válidos, brancos/nulos e a vencedora' },
  { var: '{apuracao_chapas}',          desc: 'Eleição GLEMT: bloco da apuração — uma entrada por chapa cadastrada, com os votos (use em parágrafo próprio)' },
  { var: '{chapas_lista}',             desc: 'Eleição GLEMT: todas as chapas — nome em negrito e uma linha por cargo (use em parágrafo próprio)' },
  { var: '{chapas_lista_corrida}',     desc: 'Eleição GLEMT: todas as chapas em uma linha só (formato corrido)' },
  { var: '{chapas_apresentadas_corrida}', desc: 'Eleição GLEMT: chapas apresentadas em texto corrido (formato antigo)' },
  { var: '{resultado_apuracao}',       desc: 'Eleição GLEMT: votos de cada chapa' },
  { var: '{chapa1_nome}',              desc: 'Eleição GLEMT: nome da Chapa 1 (chapa2_..., chapa3_...)' },
  { var: '{chapa1_gm}',                desc: 'Eleição GLEMT: Grão-Mestre da Chapa 1' },
  { var: '{chapa1_gm_adjunto}',        desc: 'Eleição GLEMT: Grão-Mestre Adjunto da Chapa 1' },
  { var: '{votos_chapa1}',             desc: 'Eleição GLEMT: votos da Chapa 1' },
  { var: '{votos_brancos}',            desc: 'Eleição GLEMT: votos em branco' },
  { var: '{votos_nulos}',              desc: 'Eleição GLEMT: votos nulos' },
  { var: '{total_votantes}',           desc: 'Eleição GLEMT: total de votantes' },
  { var: '{chapa_vencedora}',          desc: 'Eleição GLEMT: chapa mais votada' },
  { var: '{escrutinador1_nome}',       desc: 'Eleição GLEMT: Escrutinador 1' },
  { var: '{escrutinador2_nome}',       desc: 'Eleição GLEMT: Escrutinador 2' },
  { var: '{data_balaustre_anterior}',  desc: 'Atas de sessão: data do balaustre anterior (ex: 30/09/2026)' },
  { var: '{ano_balaustre}',            desc: 'Atas de sessão: ano do balaustre' },
  { var: '{data_sessao_extenso}',      desc: 'Atas de sessão: "sete dias do mês de outubro de 2.026"' },
  { var: '{grau_reuniao}',             desc: 'Atas de sessão: Aprendiz Maçom / Companheiro Maçom / Mestre Maçom' },
  { var: '{hora_abertura}',            desc: 'Atas de sessão: abertura (padrão 20:00)' },
  { var: '{hora_encerramento}',        desc: 'Atas de sessão: encerramento (padrão 22:00)' },
  { var: '{ordem_dia}',                desc: 'Atas de sessão: ordem do dia do balaustre' },
  { var: '{vm_nome}',                  desc: 'Atas de sessão: Venerável Mestre (Corpo Adm. do ano)' },
  { var: '{primeiro_vigilante_nome}',  desc: '1º Vigilante (Eleição da Loja: Gestão Sainte · Atas de sessão: Corpo Adm. do ano)' },
  { var: '{segundo_vigilante_nome}',   desc: '2º Vigilante (Eleição da Loja: Gestão Sainte · Atas de sessão: Corpo Adm. do ano)' },
  { var: '{orador_nome}',              desc: 'Atas de sessão: Orador (Corpo Adm. do ano)' },
  { var: '{nome_chapa_maiusculo}',     desc: 'Nome da chapa em maiúsculas' },
  { var: '{data_edital_eleicao_extenso}', desc: 'Data do edital de eleição (ex: 13 de Outubro de 2025)' },
  { var: '{data_emissao_extenso}',     desc: 'Data de hoje (emissão do documento)' },
  { var: '{vm_candidato_nome}',        desc: 'Candidato a Venerável Mestre da chapa' },
  { var: '{presidente_requerimento}',  desc: 'Requerimentos: nome do presidente que assina (maiúsculas)' },
  { var: '{presidente_requerimento_qualificacao}', desc: 'Requerimentos: qualificação do presidente (estado civil, RG, CPF, endereço)' },
  { var: '{total_mestres}',            desc: 'Total de irmãos Mestres (base do quórum)' },
  { var: '{total_mestres_aptos}',      desc: 'Mestres aptos a votar, já com os ajustes manuais de aptidão (+ _extenso)' },
  { var: '{quorum_minimo}',            desc: 'Quórum mínimo: 1/3 dos Mestres' },
  { var: '{trecho_votacao}',           desc: 'Trecho automático (aclamação ou disputa)' },
  { var: '{cnpj}',                     desc: 'CNPJ da loja' },
  { var: '{numero_registro_cartorio}', desc: 'Número do registro no cartório' },
];

const S = {
  card:  { background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: '1.25rem' },
  label: { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' },
  input: { width: '100%', padding: '0.5rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text)', fontSize: '0.875rem', boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '0.6rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text)', fontSize: '0.875rem', boxSizing: 'border-box', lineHeight: '1.6', resize: 'vertical', fontFamily: 'inherit' },
  btn: (cor = 'accent') => ({
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 600,
    color: cor === 'surface' ? 'var(--color-text)' : 'white',
    background: cor === 'accent' ? 'var(--color-accent)' : cor === 'success' ? 'var(--color-success)' : cor === 'danger' ? '#ef4444' : 'var(--color-surface-2)',
    border: cor === 'surface' ? '1px solid var(--color-border)' : 'none',
    borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.15s',
  }),
  select: { padding: '0.45rem 0.7rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text)', fontSize: '0.82rem' },
};

// Módulos (grupos) da lista de modelos — novos módulos entram aqui
const MODULOS_MODELOS = {
  eleicao_posse: '🗳️ Eleição e Posse',
  balaustres: '📜 Balaustres (Atas de Sessão)',
  financeiro: '💰 Financeiro',
  filantropia: '🤝 Filantropia',
  geral: '📄 Geral',
};

export default function ModelosDocumentos({ permissoes, showSuccess, showError, onVoltar, rotuloVoltar = 'Eleição e Posse', modulo = null }) {
  // Aberto pela Eleição e Posse ou pelo Balaustre: só os modelos daquele módulo.
  // Aberto pelo menu: abas para escolher o módulo.
  const [moduloAba, setModuloAba] = useState(modulo || 'eleicao_posse');
  const moduloAtivo = modulo || moduloAba;
  const [modelos, setModelos]           = useState([]);
  const [modeloAtivo, setModeloAtivo]   = useState(null);
  const [form, setForm]                 = useState({});
  const [loading, setLoading]           = useState(true);
  const [salvando, setSalvando]         = useState(false);
  const [abaSelecionada, setAba]        = useState('corpo');
  const [mostrarVars, setMostrarVars]   = useState(false);

  const podeEditar = permissoes?.pode_editar_corpo_admin || false;

  // ── Carregar modelos do banco ──────────────────────────────
  const carregar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('modelos_documentos')
      .select('*')
      .order('created_at');

    if (!data || data.length === 0) {
      // Primeira vez: popular com os padrões
      await popularPadroes();
    } else {
      // Verificar se faltam tipos e adicionar
      const tiposExistentes = data.map(m => m.tipo);
      const faltando = MODELOS_PADRAO.filter(m => !tiposExistentes.includes(m.tipo));
      if (faltando.length > 0) {
        await supabase.from('modelos_documentos').insert(faltando);
        const { data: atualizado } = await supabase.from('modelos_documentos').select('*').order('created_at');
        setModelos(atualizado || []);
      } else {
        setModelos(data);
      }
    }
    setLoading(false);
  }, []);

  const popularPadroes = async () => {
    const { data, error } = await supabase
      .from('modelos_documentos')
      .insert(MODELOS_PADRAO)
      .select();
    if (!error) setModelos(data || []);
  };

  useEffect(() => { carregar(); }, [carregar]);

  // ── Selecionar modelo para editar ─────────────────────────
  const selecionarModelo = (modelo) => {
    setModeloAtivo(modelo);
    setForm({ ...modelo });
    setAba('corpo');
  };

  const handleChange = (campo, valor) => {
    setForm(prev => ({ ...prev, [campo]: valor }));
  };

  // ── Salvar ────────────────────────────────────────────────
  const salvar = async () => {
    setSalvando(true);
    try {
      const { error } = await supabase
        .from('modelos_documentos')
        .update({
          nome:                  form.nome,
          titulo_doc:            form.titulo_doc,
          corpo:                 form.corpo,
          corpo_aclamacao:       form.corpo_aclamacao,
          corpo_disputa:         form.corpo_disputa,
          ...(( form.tipo_base || form.tipo) === 'ata_eleicao_glemt' ? { corpo_voto_transito: form.corpo_voto_transito || '' } : {}),
          rodape:                form.rodape,
          assinatura_1_cargo:    form.assinatura_1_cargo,
          assinatura_2_cargo:    form.assinatura_2_cargo,
          assinatura_3_cargo:    form.assinatura_3_cargo,
          alinhamento_titulo:    form.alinhamento_titulo,
          alinhamento_corpo:     form.alinhamento_corpo,
          alinhamento_assinatura:form.alinhamento_assinatura,
          ...(['ata_eleicao_loja', 'ata_eleicao_cartorio', 'ata_posse', 'ata_posse_cartorio'].includes(form.tipo_base || form.tipo) ? { mostrar_logo: form.mostrar_logo !== false } : {}),
          ...(String(form.tipo || '').startsWith('ata_') ? { subtitulo: form.subtitulo ?? '' } : {}),
          ...(['ata_posse', 'ata_posse_cartorio'].includes(form.tipo_base || form.tipo) ? { mostrar_instaladores: form.mostrar_instaladores === true } : {}),
          ...(form.modulo === 'balaustres' ? {
            mostrar_logo: !!form.mostrar_logo, grau: form.grau || null,
            mostrar_logo_lista: !!form.mostrar_logo_lista,
          } : {}),
          // Formatação (todos os modelos)
          ...Object.fromEntries(['margem_sup', 'margem_inf', 'margem_esq', 'margem_dir', 'espacamento_linhas', 'fonte_tamanho', 'logo_tamanho']
            .map(k => [k, form[k] === '' || form[k] == null ? null : Number(form[k])])),
          // Cabeçalho: vazio = texto padrão do sistema
          cabecalho_texto: form.cabecalho_texto && String(form.cabecalho_texto).trim() ? form.cabecalho_texto : null,
        })
        .eq('id', form.id);

      if (error) throw error;
      showSuccess('Modelo salvo com sucesso!');
      setModelos(prev => prev.map(m => m.id === form.id ? { ...m, ...form } : m));
      setModeloAtivo({ ...form });
    } catch (e) {
      showError('Erro ao salvar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  // ── Atas de sessão: criar / excluir modelos extras ─────────
  const TIPOS_BASE_ATA = ['ata_sessao_aprendiz', 'ata_sessao_companheiro', 'ata_sessao_mestre', 'ata_eleicao_glemt', 'edital_eleicao_glemt', 'lista_presenca_glemt'];
  const novoModeloAta = async () => {
    const nome = window.prompt('Nome do novo modelo de ata (ex.: Ata Iniciação Aprendiz):');
    if (!nome || !nome.trim()) return;
    const grauIn = window.prompt('Grau da sessão (Aprendiz, Companheiro ou Mestre):', 'Aprendiz');
    const grau = ['Aprendiz', 'Companheiro', 'Mestre'].find(g => g.toLowerCase() === String(grauIn || '').trim().toLowerCase());
    if (!grau) { showError('Grau inválido. Use Aprendiz, Companheiro ou Mestre.'); return; }
    // Qual documento servirá de base (como na Eleição/Posse): ata do grau, ata da eleição GLEMT…
    const bases = modelos.filter(m => m.modulo === 'balaustres')
      .filter(m => {
        const t = m.tipo_base || String(m.tipo || '').split('__')[0];
        return t !== 'edital_eleicao_glemt' && t !== 'lista_presenca_glemt';
      });
    const listaBases = bases.map((m, i) => `${i + 1} - ${m.nome}`).join('\n');
    const escolhido = bases.length
      ? window.prompt(`Novo modelo baseado em qual documento?\n\n${listaBases}\n\nDigite o número (ou deixe vazio para a ata de ${grau}):`)
      : '';
    const idx = parseInt(escolhido) - 1;
    const base = (bases[idx])
      || modelos.find(m => m.tipo === `ata_sessao_${grau.toLowerCase()}`)
      || MODELOS_PADRAO.find(m => m.tipo === `ata_sessao_${grau.toLowerCase()}`) || {};
    // O tipo de origem define a estrutura (ex.: cópia da ata da eleição GLEMT mantém as regras dela)
    const tipoOrigem = base.tipo_base || String(base.tipo || '').split('__')[0] || `ata_sessao_${grau.toLowerCase()}`;
    const novo = {
      modulo: 'balaustres', grau, tipo: `${tipoOrigem}__${Date.now()}`, tipo_base: tipoOrigem, nome: nome.trim(),
      titulo_doc: base.titulo_doc || '', corpo: base.corpo || '',
      corpo_aclamacao: base.corpo_aclamacao || '', corpo_disputa: base.corpo_disputa || '',
      corpo_voto_transito: base.corpo_voto_transito || null,
      subtitulo: base.subtitulo || '', rodape: base.rodape || '',
      assinatura_1_cargo: 'Venerável Mestre', assinatura_2_cargo: 'Orador', assinatura_3_cargo: 'Secretário',
      alinhamento_titulo: 'center', alinhamento_corpo: base.alinhamento_corpo || 'justify', alinhamento_assinatura: 'center',
      mostrar_logo: !!base.mostrar_logo,
    };
    const { data, error } = await supabase.from('modelos_documentos').insert(novo).select().single();
    if (error) { showError('Erro ao criar modelo: ' + error.message); return; }
    setModelos(prev => [...prev, data]);
    selecionarModelo(data);
    showSuccess(`Modelo criado a partir de "${base.nome || `ata de ${grau}`}". Edite o texto e salve.`);
  };
  // Eleição e Posse: novo modelo a partir de um existente (ex.: outra versão da Ata para Eleição)
  const BASES_EP = [
    ['edital_eleicao', 'Edital de Convocação para Eleição'], ['ata_eleicao_loja', 'Ata para Eleição'],
    ['ata_eleicao_cartorio', 'Ata para Eleição Cartório'], ['lista_presenca_eleicao', 'Lista de Presença para a Eleição'],
    ['edital_posse', 'Edital de Convocação para Posse'], ['ata_posse', 'Ata para Posse'], ['ata_posse_cartorio', 'Ata para Posse Cartório'],
    ['lista_presenca_posse', 'Lista de Presença para a Posse'], ['requerimento_eleicao', 'Requerimento Ata Eleição'],
    ['requerimento_posse', 'Requerimento Ata Posse'], ['apresentacao_chapa', 'Apresentação da Chapa'],
  ];
  const novoModeloEleicao = async () => {
    const lista = BASES_EP.map(([, n], i) => `${i + 1} - ${n}`).join('\n');
    const esc = window.prompt(`Novo modelo baseado em qual documento?\n\n${lista}\n\nDigite o número:`);
    const idx = parseInt(esc) - 1;
    if (!(idx >= 0 && idx < BASES_EP.length)) return;
    const [baseTipo, baseNome] = BASES_EP[idx];
    const nome = window.prompt('Nome do novo modelo:', `${baseNome} (2)`);
    if (!nome || !nome.trim()) return;
    const base = modelos.find(m => m.tipo === baseTipo) || MODELOS_PADRAO.find(m => m.tipo === baseTipo) || {};
    const { id, created_at, updated_at, ...copia } = base; // eslint-disable-line no-unused-vars
    const novo = { ...copia, modulo: 'eleicao_posse', tipo: `${baseTipo}__${Date.now()}`, tipo_base: baseTipo, nome: nome.trim() };
    const { data, error } = await supabase.from('modelos_documentos').insert(novo).select().single();
    if (error) { showError('Erro ao criar modelo: ' + error.message); return; }
    setModelos(prev => [...prev, data]);
    selecionarModelo(data);
    showSuccess(`Modelo criado a partir de "${baseNome}". Edite e salve — ao gerar o documento, o sistema pergunta qual modelo usar.`);
  };
  const excluirModeloEleicao = async () => {
    if (!modeloAtivo || !modeloAtivo.tipo_base) return;
    if (!window.confirm(`Excluir o modelo "${modeloAtivo.nome}"?`)) return;
    const { data, error } = await supabase.from('modelos_documentos').delete().eq('id', modeloAtivo.id).select();
    if (error || !data?.length) { showError('Não foi possível excluir o modelo.'); return; }
    setModelos(prev => prev.filter(m => m.id !== modeloAtivo.id));
    setModeloAtivo(null); setForm({});
    showSuccess('Modelo excluído.');
  };

  const excluirModeloAta = async () => {
    if (!modeloAtivo || TIPOS_BASE_ATA.includes(modeloAtivo.tipo)) return;
    if (!window.confirm(`Excluir o modelo "${modeloAtivo.nome}"?`)) return;
    const { data, error } = await supabase.from('modelos_documentos').delete().eq('id', modeloAtivo.id).select();
    if (error || !data?.length) { showError('Não foi possível excluir o modelo.'); return; }
    setModelos(prev => prev.filter(m => m.id !== modeloAtivo.id));
    setModeloAtivo(null); setForm({});
    showSuccess('Modelo excluído.');
  };

  // ── Restaurar padrão ──────────────────────────────────────
  const restaurarPadrao = async () => {
    if (!window.confirm('Restaurar este modelo para o texto padrão? Suas edições serão perdidas.')) return;
    const padrao = MODELOS_PADRAO.find(m => m.tipo === modeloAtivo.tipo);
    if (!padrao) return;
    setForm(prev => ({ ...prev, ...padrao }));
    showSuccess('Padrão carregado — clique em Salvar para confirmar.');
  };

  // ── Inserir variável no campo ativo ───────────────────────
  const inserirVariavel = (varName) => {
    // Insere no campo que estava em foco (fallback: corpo)
    const campo = document.activeElement?.name || 'corpo';
    const el = document.querySelector(`textarea[name="${campo}"], input[name="${campo}"]`);
    if (el) {
      const start = el.selectionStart;
      const end   = el.selectionEnd;
      const novoValor = el.value.substring(0, start) + varName + el.value.substring(end);
      handleChange(campo, novoValor);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + varName.length, start + varName.length);
      }, 10);
    } else {
      handleChange('corpo', (form.corpo || '') + varName);
    }
  };

  if (loading) return (
    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
      Carregando modelos...
    </div>
  );

  const ABAS = [
    { id: 'corpo',       label: '📝 Texto Principal' },
    { id: 'aclamacao',   label: '🗳️ Aclamação/Disputa' },
    { id: 'rodape',      label: '📄 Rodapé' },
    { id: 'assinaturas', label: '✍️ Assinaturas' },
    { id: 'layout',      label: '🎨 Layout' },
  ];

  // Não mostrar abas que não se aplicam ao tipo
  const temAclamacao = modeloAtivo && (modeloAtivo.tipo.startsWith('ata_eleicao'));
  const temRodape    = modeloAtivo && (modeloAtivo.tipo.startsWith('ata_') || modeloAtivo.tipo.startsWith('requerimento_') || modeloAtivo.tipo === 'apresentacao_chapa');
  const temAss       = !!modeloAtivo; // inclusive listas de presença (assinatura do Venerável Mestre)

  return (
    <div style={{ display: 'flex', gap: '1rem', padding: '1.5rem', background: 'var(--color-bg)', minHeight: '100vh' }}>

      {/* ── Coluna esquerda: lista de modelos ── */}
      <div style={{ width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {!modulo && (
          <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
            {[['eleicao_posse', '🗳️ Eleição e Posse'], ['balaustres', '📜 Balaustres']].map(([k, l]) => (
              <button key={k} onClick={() => { setModuloAba(k); setModeloAtivo(null); setForm({}); }}
                style={{ flex: 1, padding: '0.45rem 0.6rem', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer',
                  border: `1px solid ${moduloAtivo === k ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  background: moduloAtivo === k ? 'var(--color-accent-bg)' : 'transparent', color: moduloAtivo === k ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                {l}
              </button>
            ))}
          </div>
        )}
        {onVoltar && (
          <button onClick={onVoltar}
            style={{ padding: '0.55rem 0.85rem', marginBottom: '0.6rem', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', textAlign: 'left' }}>
            ← Voltar para {rotuloVoltar}
          </button>
        )}
        <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 0.25rem', marginBottom: '0.5rem' }}>
          📄 Modelos ({modelos.length})
        </div>
        {Object.entries(
          modelos.filter(m => (m.modulo || 'eleicao_posse') === moduloAtivo)
            .sort((a, b) => {
              // Ordem do processo de Eleição e Posse (demais modelos depois, por nome)
              const ORDEM = ['edital_eleicao', 'ata_eleicao_loja', 'ata_eleicao_cartorio', 'lista_presenca_eleicao',
                'edital_posse', 'ata_posse', 'ata_posse_cartorio', 'lista_presenca_posse', 'requerimento_eleicao', 'requerimento_posse', 'apresentacao_chapa'];
              const ia = ORDEM.indexOf(a.tipo_base || a.tipo), ib = ORDEM.indexOf(b.tipo_base || b.tipo);
              return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || String(a.nome || '').localeCompare(String(b.nome || ''));
            })
            .reduce((g, m) => { const k = m.modulo || 'eleicao_posse'; (g[k] = g[k] || []).push(m); return g; }, {})
        ).map(([mod, lista]) => (
          <div key={mod} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.6rem' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-accent)', textTransform: 'uppercase', padding: '0 0.25rem' }}>
              {MODULOS_MODELOS[mod] || mod}
            </div>
            {mod === 'eleicao_posse' && podeEditar && (
              <button onClick={novoModeloEleicao}
                style={{ padding: '0.45rem 0.7rem', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', border: '1px dashed var(--color-accent)', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', textAlign: 'left' }}>
                ➕ Novo modelo
              </button>
            )}
            {mod === 'balaustres' && podeEditar && (
              <button onClick={novoModeloAta}
                style={{ padding: '0.45rem 0.7rem', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', border: '1px dashed var(--color-accent)', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', textAlign: 'left' }}>
                ➕ Novo modelo de ata
              </button>
            )}
        {lista.map(m => (
          <button key={m.id}
            onClick={() => selecionarModelo(m)}
            style={{
              textAlign: 'left', padding: '0.6rem 0.85rem',
              background: modeloAtivo?.id === m.id ? 'var(--color-accent-bg)' : 'var(--color-surface)',
              border: `1px solid ${modeloAtivo?.id === m.id ? 'var(--color-accent)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-md)', cursor: 'pointer',
              color: modeloAtivo?.id === m.id ? 'var(--color-accent)' : 'var(--color-text)',
              fontSize: '0.82rem', fontWeight: modeloAtivo?.id === m.id ? 700 : 400,
              transition: 'all 0.15s',
            }}>
            {m.nome}
          </button>
        ))}
          </div>
        ))}
      </div>

      {/* ── Coluna direita: editor ── */}
      {!modeloAtivo ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ fontSize: '3rem' }}>📝</div>
          <p>Selecione um modelo à esquerda para editar</p>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>

          {/* Header do editor */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', margin: 0 }}>{modeloAtivo.nome}</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0.2rem 0 0' }}>
                Tipo: <code style={{ background: 'var(--color-surface-2)', padding: '0 0.3rem', borderRadius: '4px' }}>{modeloAtivo.tipo}</code>
              </p>
            </div>
            {podeEditar && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button style={S.btn('surface')} onClick={() => setMostrarVars(!mostrarVars)}>
                  {'{}'} Variáveis
                </button>
                <button style={S.btn('surface')} onClick={restaurarPadrao}>
                  🔄 Restaurar padrão
                </button>
                <button style={S.btn('success')} onClick={salvar} disabled={salvando}>
                  {salvando ? 'Salvando...' : '💾 Salvar'}
                </button>
              </div>
            )}
          </div>

          {/* Painel de variáveis */}
          {mostrarVars && (
            <div style={{ ...S.card, background: 'var(--color-surface-2)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.6rem', textTransform: 'uppercase' }}>
                Clique em uma variável para inserir no campo em foco:
              </div>
              {(() => {
                const usadas = new Set();
                return GRUPOS_VARIAVEIS.map(g => {
                  const doGrupo = VARIAVEIS_DISPONIVEIS.filter(v => !usadas.has(v.var) && g.testa(v.var));
                  doGrupo.forEach(v => usadas.add(v.var));
                  if (!doGrupo.length) return null;
                  return (
                    <div key={g.titulo} style={{ marginBottom: '0.7rem' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '0.3rem' }}>{g.titulo}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {doGrupo.map(v => (
                          <button key={v.var}
                            title={v.desc}
                            onClick={() => inserirVariavel(v.var)}
                            style={{
                              padding: '0.2rem 0.55rem', fontSize: '0.75rem', fontWeight: 600,
                              background: 'var(--color-accent-bg)', color: 'var(--color-accent)',
                              border: '1px solid rgba(201,168,76,0.3)', borderRadius: '999px', cursor: 'pointer',
                            }}>
                            {v.var}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {/* Abas */}
          <div style={{ display: 'flex', borderBottom: '2px solid var(--color-border)', gap: 0 }}>
            {ABAS
              .filter(a =>
                a.id === 'corpo'       ? true :
                a.id === 'aclamacao'  ? temAclamacao :
                a.id === 'rodape'     ? temRodape :
                a.id === 'assinaturas'? temAss :
                true
              )
              .map(a => (
                <button key={a.id}
                  onClick={() => setAba(a.id)}
                  style={{
                    padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: 'transparent',
                    color: abaSelecionada === a.id ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    borderBottom: abaSelecionada === a.id ? '2px solid var(--color-accent)' : '2px solid transparent',
                    marginBottom: '-2px', transition: 'all 0.15s',
                  }}>
                  {a.label}
                </button>
              ))}
          </div>

          {/* Conteúdo das abas */}
          <div style={{ flex: 1 }}>

            {/* ABA: Texto Principal — apenas o texto do modelo (título, cabeçalho e formatação ficam em Layout) */}
            {abaSelecionada === 'corpo' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={S.label}>Nome do modelo</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input name="nome" style={{ ...S.input, flex: 1 }} value={form.nome || ''} disabled={!podeEditar}
                      onChange={e => handleChange('nome', e.target.value)} />
                    {podeEditar && form.modulo !== 'balaustres' && form.tipo_base && (
                      <button onClick={excluirModeloEleicao} style={{ padding: '0.45rem 0.8rem', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        🗑️ Excluir modelo
                      </button>
                    )}
                    {podeEditar && form.modulo === 'balaustres' && !TIPOS_BASE_ATA.includes(form.tipo) && (
                      <button onClick={excluirModeloAta} style={{ padding: '0.45rem 0.8rem', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        🗑️ Excluir modelo
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label style={S.label}>Texto do corpo</label>
                  <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '0 0 0.35rem' }}>
                    ↵ Enter = novo parágrafo · linha vazia = espaço entre parágrafos · <strong>*texto*</strong> = negrito
                  </p>
                  <textarea name="corpo" style={{ ...S.textarea, minHeight: '320px' }}
                    value={form.corpo || ''} disabled={!podeEditar}
                    onChange={e => handleChange('corpo', e.target.value)} />
                  <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                    Use variáveis entre chaves: {'{vm_nome}'}, {'{data_eleicao}'}, etc. Clique em "{'{}'}  Variáveis" para ver todas.
                    Título, subtítulo, cabeçalho, logo, margens e letra ficam na aba <strong>🎨 Layout</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* ABA: Aclamação/Disputa */}
            {abaSelecionada === 'aclamacao' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ padding: '0.75rem', background: 'var(--color-accent-bg)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--color-accent)', border: '1px solid rgba(201,168,76,0.3)' }}>
                  ℹ️ Este trecho é inserido automaticamente no lugar de <strong>{'{trecho_votacao}'}</strong> no texto principal, dependendo do tipo de votação escolhido na eleição.
                </div>
                <div>
                  <label style={S.label}>Trecho — Aclamação (chapa única)</label>
                  <textarea name="corpo_aclamacao" style={{ ...S.textarea, minHeight: '120px' }}
                    value={form.corpo_aclamacao || ''} disabled={!podeEditar}
                    onChange={e => handleChange('corpo_aclamacao', e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>Trecho — Disputa entre chapas</label>
                  <textarea name="corpo_disputa" style={{ ...S.textarea, minHeight: '120px' }}
                    value={form.corpo_disputa || ''} disabled={!podeEditar}
                    onChange={e => handleChange('corpo_disputa', e.target.value)} />
                </div>
                {(form.tipo_base || form.tipo) === 'ata_eleicao_glemt' && (
                  <div>
                    <label style={S.label}>Trecho — Voto em trânsito (Irmãos de outras Lojas)</label>
                    <textarea name="corpo_voto_transito" style={{ ...S.textarea, minHeight: '120px' }}
                      value={form.corpo_voto_transito || ''} disabled={!podeEditar}
                      onChange={e => handleChange('corpo_voto_transito', e.target.value)} />
                    <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                      Só entra na ata quando houver votantes em trânsito cadastrados na eleição. Vai no lugar de {'{trecho_voto_transito}'}; sem a variável, entra após o corpo.
                      Variáveis: {'{votantes_transito}'}, {'{qtd_votantes_transito}'}, {'{qtd_votantes_transito_extenso}'}, {'{palavra_irmao_transito}'}, {'{plural_transito}'}.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ABA: Rodapé */}
            {abaSelecionada === 'rodape' && (
              <div>
                <label style={S.label}>Texto do rodapé / encerramento</label>
                <textarea name="rodape" style={{ ...S.textarea, minHeight: '160px' }}
                  value={form.rodape || ''} disabled={!podeEditar}
                  onChange={e => handleChange('rodape', e.target.value)}
                  placeholder="Texto exibido após a lista de eleitos ou o corpo principal" />
                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                  Suporta as mesmas variáveis do corpo principal.
                </p>
              </div>
            )}

            {/* ABA: Assinaturas */}
            {abaSelecionada === 'assinaturas' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ padding: '0.75rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  ℹ️ O nome de quem assina é preenchido automaticamente pelo sistema. Aqui você define apenas o <strong>cargo</strong> que aparece abaixo do nome. Deixe vazio para omitir a assinatura.
                </div>
                {[
                  { campo: 'assinatura_1_cargo', label: '1ª Assinatura — Cargo' },
                  { campo: 'assinatura_2_cargo', label: '2ª Assinatura — Cargo' },
                  { campo: 'assinatura_3_cargo', label: '3ª Assinatura — Cargo' },
                ].map(a => (
                  <div key={a.campo}>
                    <label style={S.label}>{a.label}</label>
                    <input name={a.campo} style={S.input} value={form[a.campo] || ''} disabled={!podeEditar}
                      onChange={e => handleChange(a.campo, e.target.value)}
                      placeholder="Ex: Venerável Mestre" />
                  </div>
                ))}
              </div>
            )}

            {/* ABA: Layout — título, cabeçalho, logo, margens, letra e alinhamentos */}
            {abaSelecionada === 'layout' && (() => {
              const baseTipo = form.tipo_base || form.tipo;
              const ehBal = form.modulo === 'balaustres';
              const TIPOS_CABECALHO = ['ata_eleicao_loja', 'ata_eleicao_cartorio', 'ata_posse', 'ata_posse_cartorio', 'edital_eleicao', 'edital_posse', 'apresentacao_chapa', 'ata_eleicao_glemt', 'edital_eleicao_glemt', 'lista_presenca_glemt'];
              const temCabTexto = TIPOS_CABECALHO.includes(baseTipo);
              const temLogo = temCabTexto || String(form.tipo || '').startsWith('ata_sessao');
              const temToggleLogo = ehBal || ['ata_eleicao_loja', 'ata_eleicao_cartorio', 'ata_posse', 'ata_posse_cartorio'].includes(baseTipo);
              const logoLigado = ehBal ? !!form.mostrar_logo : form.mostrar_logo !== false;
              const cabPadrao = ['edital_eleicao', 'edital_posse'].includes(baseTipo)
                ? 'AUG∴ E RESP∴ LOJA SIMB∴ {nome_loja}\nFundado em {data_fundacao}\nSOB OS AUSPÍCIOS DA SERENÍSSIMA GRANDE LOJA MAÇÔNICA DO ESTADO DE MATO GROSSO'
                : baseTipo === 'apresentacao_chapa'
                  ? 'Grande Loja do Estado de Mato Grosso – GLEMT\nA∴R∴L∴S∴ Acácia de Paranatinga nº {numero_loja}'
                  : CABECALHO_PADRAO;
              const pad = ehBal ? { margem_sup: 5, margem_inf: 2.8, margem_esq: 3.5, margem_dir: 2 } : { margem_sup: 1.27, margem_inf: 1.27, margem_esq: 3, margem_dir: 1.52 };
              const secao = { ...S.card, display: 'flex', flexDirection: 'column', gap: '0.6rem' };
              const tit = { fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.04em' };
              const dica = { fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: 0 };
              const cabPrev = String(form.cabecalho_texto || '').trim() ? form.cabecalho_texto : cabPadrao;
              const prevVars = { numero_loja: '30', data_fundacao: '20/12/1997', nome_loja: 'ACÁCIA DE PARANATINGA Nº 30', cidade: 'Paranatinga', estado: 'MT' };
              return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* 1. Título e subtítulo */}
                <div style={secao}>
                  <div style={tit}>📝 Título do documento</div>
                  <div>
                    <label style={S.label}>Título (nome do documento)</label>
                    <textarea name="titulo_doc" rows={2} style={{ ...S.textarea, minHeight: 'auto' }} value={form.titulo_doc || ''} disabled={!podeEditar}
                      onChange={e => handleChange('titulo_doc', e.target.value)} placeholder="Cada linha = uma linha do título (vazio = sem título)" />
                  </div>
                  {String(form.tipo || '').startsWith('ata_') && (
                    <div>
                      <label style={S.label}>Subtítulo (abaixo do título, antes do texto)</label>
                      <textarea rows={2} style={{ ...S.textarea, minHeight: 'auto' }} value={form.subtitulo ?? ''} disabled={!podeEditar}
                        onChange={e => handleChange('subtitulo', e.target.value)} placeholder="Ex.: Balaústre nº {numero_balaustre}/{ano_balaustre}" />
                    </div>
                  )}
                  <p style={dica}>
                    Aceita variáveis como {'{nome_loja}'}, {'{gestao}'}, {'{numero_balaustre}'}{['edital_eleicao', 'edital_posse'].includes(baseTipo) ? ', {numero_edital}' : ''}. Cada linha vira uma linha do documento.
                  </p>
                </div>

                {/* Instaladores (só nas atas de posse) */}
                {['ata_posse', 'ata_posse_cartorio'].includes(baseTipo) && (
                  <div style={secao}>
                    <div style={tit}>🎖️ Instaladores da posse</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text)', cursor: podeEditar ? 'pointer' : 'default' }}>
                      <input type="checkbox" checked={form.mostrar_instaladores === true} disabled={!podeEditar} onChange={e => handleChange('mostrar_instaladores', e.target.checked)} />
                      Mostrar os instaladores (Venerável Mestre e Vigilantes) na ata
                    </label>
                    <p style={dica}>
                      Desmarcado (padrão): a ata não cita a presidência da sessão nem traz as assinaturas dos instaladores — saem só os nomes de quem está sendo empossado.
                    </p>
                  </div>
                )}

                {/* 2. Cabeçalho */}
                {temLogo && (
                  <div style={secao}>
                    <div style={tit}>🏛️ Cabeçalho (logo e dados da Loja)</div>
                    {temToggleLogo && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text)', cursor: podeEditar ? 'pointer' : 'default' }}>
                        <input type="checkbox" checked={logoLigado} disabled={!podeEditar} onChange={e => handleChange('mostrar_logo', e.target.checked)} />
                        Exibir o logo da Loja {temCabTexto ? '(desmarcado: só o texto, centralizado)' : 'no topo do documento'}
                      </label>
                    )}
                    <div style={{ maxWidth: '220px' }}>
                      <label style={S.label}>Tamanho do logo (cm)</label>
                      <input type="number" step="0.1" min="1" max="8" style={S.input} disabled={!podeEditar}
                        value={form.logo_tamanho ?? ''} placeholder="3,5" onChange={e => handleChange('logo_tamanho', e.target.value)} />
                    </div>
                    {temCabTexto && (
                      <div>
                        <label style={S.label}>Texto do cabeçalho</label>
                        <textarea rows={4} style={{ ...S.textarea, minHeight: '96px' }} disabled={!podeEditar}
                          value={form.cabecalho_texto || ''} placeholder={cabPadrao}
                          onChange={e => handleChange('cabecalho_texto', e.target.value)} />
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.35rem' }}>
                          {podeEditar && (
                            <>
                              <button type="button" onClick={() => handleChange('cabecalho_texto', cabPadrao)}
                                style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)' }}>
                                ✏️ Carregar o texto padrão para editar
                              </button>
                              <button type="button" onClick={() => handleChange('cabecalho_texto', '')}
                                style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)' }}>
                                ↺ Voltar ao padrão do sistema
                              </button>
                            </>
                          )}
                        </div>
                        <p style={{ ...dica, marginTop: '0.35rem' }}>
                          Cada linha vira uma linha do cabeçalho. Vazio = texto padrão (em cinza acima). Variáveis: {'{numero_loja}'}, {'{data_fundacao}'}, {'{nome_loja}'}, {'{cidade}'}, {'{estado}'}.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Balaustre: grau da sessão */}
                {ehBal && (
                  <div style={secao}>
                    <div style={tit}>📜 Balaustre</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Grau da sessão:</label>
                      <select style={{ ...S.input, width: 'auto' }} value={form.grau || ''} disabled={!podeEditar || TIPOS_BASE_ATA.includes(form.tipo)}
                        onChange={e => handleChange('grau', e.target.value)}>
                        <option value="">—</option>
                        {['Aprendiz', 'Companheiro', 'Mestre'].map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                      {TIPOS_BASE_ATA.includes(form.tipo) && <span style={dica}>(fixo nos modelos originais)</span>}
                    </div>
                  </div>
                )}

                {/* 4. Página e texto */}
                <div style={secao}>
                  <div style={tit}>📐 Página e texto{form.tipo === 'lista_presenca_glemt' ? ' (letra = tabela da lista)' : ''}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.5rem' }}>
                    {[['margem_sup', 'Margem superior'], ['margem_inf', 'Margem inferior'], ['margem_esq', 'Margem esquerda'], ['margem_dir', 'Margem direita']].map(([k, l]) => (
                      <div key={k}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{l} (cm)</span>
                        <input type="number" step="0.1" min="0" style={S.input} disabled={!podeEditar}
                          value={form[k] ?? ''} placeholder={String(pad[k]).replace('.', ',')}
                          onChange={e => handleChange(k, e.target.value)} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.5rem' }}>
                    <div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Espaçamento entre linhas</span>
                      <select style={S.input} disabled={!podeEditar} value={form.espacamento_linhas ?? ''} onChange={e => handleChange('espacamento_linhas', e.target.value)}>
                        <option value="">Padrão (1,15)</option>
                        <option value="1">1,0 (simples)</option>
                        <option value="1.15">1,15</option>
                        <option value="1.5">1,5</option>
                        <option value="2">2,0 (duplo)</option>
                      </select>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Tamanho da letra do texto</span>
                      <select style={S.input} disabled={!podeEditar} value={form.fonte_tamanho ?? ''} onChange={e => handleChange('fonte_tamanho', e.target.value)}>
                        <option value="">Padrão (12)</option>
                        {[10, 11, 12, 13, 14].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  </div>
                  <p style={dica}>Vazio = padrão ({ehBal ? '5 / 2,8 / 3,5 / 2 cm' : '1,27 / 1,27 / 3 / 1,52 cm'}; entrelinha 1,15; letra 12). O cabeçalho da Loja mantém o próprio tamanho.</p>
                </div>

                {/* 5. Alinhamentos */}
                <div style={secao}>
                  <div style={tit}>↔️ Alinhamento</div>
                  {[
                    { campo: 'alinhamento_titulo',    label: 'Título' },
                    { campo: 'alinhamento_corpo',     label: 'Corpo' },
                    { campo: 'alinhamento_assinatura',label: 'Assinaturas' },
                  ].map(a => (
                    <div key={a.campo} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{ width: '90px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{a.label}</span>
                      {['left', 'center', 'justify'].map(op => (
                        <button key={op} disabled={!podeEditar} onClick={() => handleChange(a.campo, op)}
                          style={{
                            padding: '0.35rem 0.9rem', fontSize: '0.78rem', fontWeight: 600, cursor: podeEditar ? 'pointer' : 'default',
                            borderRadius: 'var(--radius-md)', border: `1px solid ${form[a.campo] === op ? 'var(--color-accent)' : 'var(--color-border)'}`,
                            background: form[a.campo] === op ? 'var(--color-accent-bg)' : 'var(--color-surface-2)',
                            color: form[a.campo] === op ? 'var(--color-accent)' : 'var(--color-text-muted)',
                          }}>
                          {op === 'left' ? '⬅ Esquerda' : op === 'center' ? '⬛ Centro' : '☰ Justificado'}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>

                {/* 6. Preview */}
                <div style={S.card}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Preview do layout</div>
                  <div style={{ background: 'white', padding: '1.5rem', borderRadius: 'var(--radius-md)', color: '#000', fontFamily: '"Times New Roman", Times, serif', fontSize: '0.8rem', lineHeight: '1.6' }}>
                    {temCabTexto && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        {logoLigado && <div style={{ width: `${Math.max(1, Number(form.logo_tamanho) || 3.5) * 14}px`, height: `${Math.max(1, Number(form.logo_tamanho) || 3.5) * 14}px`, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />}
                        <div style={{ flex: 1, textAlign: 'center', fontWeight: 'bold', fontSize: '0.72rem' }}>
                          {Object.entries(prevVars).reduce((t, [k, v]) => t.replaceAll(`{${k}}`, v), cabPrev).split('\n').filter(l => l.trim()).map((l, i) => <div key={i}>{l}</div>)}
                        </div>
                      </div>
                    )}
                    {form.titulo_doc && (
                      <div style={{ textAlign: form.alinhamento_titulo, fontWeight: 'bold', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                        {form.titulo_doc.replace(/\{[^}]+\}/g, m => `[${m.slice(1, -1)}]`)}
                      </div>
                    )}
                    <div style={{ textAlign: form.alinhamento_corpo, marginBottom: '0.75rem', textIndent: form.alinhamento_corpo === 'justify' ? '1.25cm' : 0 }}>
                      {(form.corpo || '').substring(0, 200).replace(/\{[^}]+\}/g, m => `[${m.slice(1, -1)}]`)}
                      {(form.corpo || '').length > 200 ? '...' : ''}
                    </div>
                    {form.assinatura_1_cargo && (
                      <div style={{ textAlign: form.alinhamento_assinatura, marginTop: '1.5rem' }}>
                        <div>___________________________________</div>
                        <div style={{ fontWeight: 'bold' }}>[Nome do Assinante]</div>
                        <div>{form.assinatura_1_cargo}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              );
            })()}

          </div>
        </div>
      )}
    </div>
  );
}
