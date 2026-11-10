import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const BALOES_IMG = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgMTgwIiB3aWR0aD0iNjAwIiBoZWlnaHQ9IjE4MCI+CiAgPCEtLSBCYWzDo28gMSAtIGxhcmFuamEgLS0+CiAgPGVsbGlwc2UgY3g9IjgwIiBjeT0iOTAiIHJ4PSIzOCIgcnk9IjUwIiBmaWxsPSIjRkY4QzQyIi8+CiAgPHBhdGggZD0iTTgwIDE0MCBRNzUgMTU1IDgwIDE2NSIgc3Ryb2tlPSIjRkY4QzQyIiBzdHJva2Utd2lkdGg9IjEuNSIgZmlsbD0ibm9uZSIvPgogIDxlbGxpcHNlIGN4PSI4MCIgY3k9IjkwIiByeD0iMTIiIHJ5PSIxOCIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjI1KSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTgsLTE1KSIvPgogIDwhLS0gQmFsw6NvIDIgLSBhenVsIC0tPgogIDxlbGxpcHNlIGN4PSIxNzUiIGN5PSI3NSIgcng9IjQyIiByeT0iNTUiIGZpbGw9IiM0QTkwRDkiLz4KICA8cGF0aCBkPSJNMTc1IDEzMCBRMTcwIDE0OCAxNzUgMTYwIiBzdHJva2U9IiM0QTkwRDkiIHN0cm9rZS13aWR0aD0iMS41IiBmaWxsPSJub25lIi8+CiAgPGVsbGlwc2UgY3g9IjE3NSIgY3k9Ijc1IiByeD0iMTMiIHJ5PSIyMCIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjI1KSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTksLTE2KSIvPgogIDwhLS0gQmFsw6NvIDMgLSB2ZXJkZSAtLT4KICA8ZWxsaXBzZSBjeD0iMjgwIiBjeT0iNjUiIHJ4PSI0NSIgcnk9IjU4IiBmaWxsPSIjNUNCODVDIi8+CiAgPHBhdGggZD0iTTI4MCAxMjMgUTI3NSAxNDIgMjgwIDE1NSIgc3Ryb2tlPSIjNUNCODVDIiBzdHJva2Utd2lkdGg9IjEuNSIgZmlsbD0ibm9uZSIvPgogIDxlbGxpcHNlIGN4PSIyODAiIGN5PSI2NSIgcng9IjE0IiByeT0iMjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4yNSkiIHRyYW5zZm9ybT0idHJhbnNsYXRlKC0xMCwtMTcpIi8+CiAgPCEtLSBCYWzDo28gNCAtIHJvc2EgLS0+CiAgPGVsbGlwc2UgY3g9IjM5MCIgY3k9IjgwIiByeD0iNDAiIHJ5PSI1MiIgZmlsbD0iI0U5MUU4QyIvPgogIDxwYXRoIGQ9Ik0zOTAgMTMyIFEzODUgMTUwIDM5MCAxNjIiIHN0cm9rZT0iI0U5MUU4QyIgc3Ryb2tlLXdpZHRoPSIxLjUiIGZpbGw9Im5vbmUiLz4KICA8ZWxsaXBzZSBjeD0iMzkwIiBjeT0iODAiIHJ4PSIxMiIgcnk9IjE5IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMjUpIiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtOCwtMTUpIi8+CiAgPCEtLSBCYWzDo28gNSAtIGFtYXJlbG8gLS0+CiAgPGVsbGlwc2UgY3g9IjQ5MCIgY3k9IjcwIiByeD0iNDMiIHJ5PSI1NiIgZmlsbD0iI0ZGQzEwNyIvPgogIDxwYXRoIGQ9Ik00OTAgMTI2IFE0ODUgMTQ1IDQ5MCAxNTgiIHN0cm9rZT0iI0ZGQzEwNyIgc3Ryb2tlLXdpZHRoPSIxLjUiIGZpbGw9Im5vbmUiLz4KICA8ZWxsaXBzZSBjeD0iNDkwIiBjeT0iNzAiIHJ4PSIxMyIgcnk9IjIwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMjUpIiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtOSwtMTYpIi8+CiAgPCEtLSBCYWzDo28gNiAtIHJveG8gLS0+CiAgPGVsbGlwc2UgY3g9IjU3NSIgY3k9IjkwIiByeD0iMzYiIHJ5PSI0OCIgZmlsbD0iIzlDMjdCMCIvPgogIDxwYXRoIGQ9Ik01NzUgMTM4IFE1NzAgMTUzIDU3NSAxNjMiIHN0cm9rZT0iIzlDMjdCMCIgc3Ryb2tlLXdpZHRoPSIxLjUiIGZpbGw9Im5vbmUiLz4KICA8ZWxsaXBzZSBjeD0iNTc1IiBjeT0iOTAiIHJ4PSIxMSIgcnk9IjE3IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMjUpIiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtNywtMTQpIi8+CiAgPCEtLSBFc3RyZWxpbmhhcyAtLT4KICA8ZyBmaWxsPSIjRkZENzAwIiBvcGFjaXR5PSIwLjgiPgogICAgPHBvbHlnb24gcG9pbnRzPSIxMzAsNDAgMTMyLDQ2IDEzOCw0NiAxMzMsNTAgMTM1LDU2IDEzMCw1MiAxMjUsNTYgMTI3LDUwIDEyMiw0NiAxMjgsNDYiIHRyYW5zZm9ybT0ic2NhbGUoMC42KSB0cmFuc2xhdGUoMTAwLDIwKSIvPgogICAgPHBvbHlnb24gcG9pbnRzPSIxMzAsNDAgMTMyLDQ2IDEzOCw0NiAxMzMsNTAgMTM1LDU2IDEzMCw1MiAxMjUsNTYgMTI3LDUwIDEyMiw0NiAxMjgsNDYiIHRyYW5zZm9ybT0ic2NhbGUoMC41KSB0cmFuc2xhdGUoNDUwLDEwKSIvPgogICAgPHBvbHlnb24gcG9pbnRzPSIxMzAsNDAgMTMyLDQ2IDEzOCw0NiAxMzMsNTAgMTM1LDU2IDEzMCw1MiAxMjUsNTYgMTI3LDUwIDEyMiw0NiAxMjgsNDYiIHRyYW5zZm9ybT0ic2NhbGUoMC40KSB0cmFuc2xhdGUoNzAwLDYwKSIvPgogIDwvZz4KPC9zdmc+';

const gerarHtmlEmail = (nomeIrmao, idade, nomeLoja, nomeChanceler, logoUrl) => {
  const saudacao = `Irmão ${nomeIrmao.toUpperCase()},`;
  const textoIdade = idade ? `Parabéns pelos ${idade} anos bem vividos.` : 'Parabéns pelo seu aniversário!';
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="Logo" style="width:110px;height:110px;object-fit:contain;margin-bottom:16px;"/><br/>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Georgia,serif;">
  <div style="max-width:560px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
    <div style="padding:40px 48px;text-align:center;">
      ${logoHtml}
      <p style="margin:0 0 22px;font-size:20px;font-weight:700;color:#1a1a1a;line-height:1.5;">
        ${saudacao}
      </p>
      <p style="margin:0 0 16px;font-size:17px;color:#333;line-height:1.7;">
        ${textoIdade}
      </p>
      <p style="margin:0 0 16px;font-size:17px;color:#333;line-height:1.7;">
        A <strong>${nomeLoja}</strong> e todos os Irmãos desejam que você,<br/>
        curta seu aniversário com alegria e receba mais um ano de vida com gratidão.
      </p>
      <p style="margin:0 0 32px;font-size:17px;color:#333;line-height:1.7;">
        Que o <strong>Grande Arquiteto do Universo</strong> ilumine e proteja você e sua família.
      </p>
      <p style="margin:0 0 28px;font-size:17px;color:#555;font-style:italic;">
        Fraternalmente,
      </p>
      <div style="width:80px;height:2px;background:linear-gradient(90deg,transparent,#c9a84c,transparent);margin:0 auto 22px;"></div>
      <p style="margin:0;font-size:20px;font-weight:700;color:#1a1a1a;">${nomeChanceler}</p>
      <p style="margin:6px 0 0;font-size:15px;color:#666;letter-spacing:0.5px;">Chanceler</p>
      <p style="margin:6px 0 0;font-size:15px;color:#666;">${nomeLoja}</p>
    </div>
    <div style="background:#2c2c2c;padding:16px 24px;text-align:center;">
      <p style="margin:0;font-size:13px;color:#888;">
        ${nomeLoja} · Paranatinga – MT
      </p>
    </div>
  </div>
</body>
</html>`;
};

const enviarEmailAniversario = async (irmao, nomeLoja, nomeChanceler, logoUrl, modoEnvio = 'manual') => {
  if (!irmao.email) throw new Error('Irmão não possui email cadastrado.');

  // Chama a Edge Function — a chave Brevo fica segura no servidor
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ypnvzjctyfdrkkrhskzs.supabase.co';

  const res = await fetch(`${SUPABASE_URL}/functions/v1/email-aniversario`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      modo:    'manual',
      irmaoId: irmao.irmao_id,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || `Erro HTTP ${res.status}`);
  }

  const resultado = await res.json();
  if (resultado.enviados === 0) {
    const motivo = resultado.erros?.length
      ? resultado.erros[0].erro
      : resultado.msg || 'Email não enviado — verifique os logs da Edge Function no Supabase.';
    throw new Error(motivo);
  }
};

// Função para retornar emoji adequado por idade e sexo
// Classificação dos familiares (nível 2). Familiar ligado a mais de um irmão tem tipo combinado
// (ex.: "Pai / Pai", "Neto / Neto"), por isso o tipo é dividido em partes.
const partesTipo = (tipo) => String(tipo || '').split(' / ').map(t => t.trim()).filter(Boolean);
const temTipo = (a, lista) => partesTipo(a?.tipo).some(t => lista.includes(t));
// Família = qualquer familiar de nível 2 que não seja Esposa (tem lista própria) nem o próprio Irmão:
// pais, filhos, enteados, netos, bisnetos, bodas... (qualquer vínculo novo entra sozinho)
const ehFamilia = (a) => a?.nivel === 2 && a.tipo !== 'Irmão' && !temTipo(a, ['Esposa', 'Cunhada']);

const obterEmojiPessoa = (idade, sexo, tipo = null) => {
  if (idade <= 2) return '👶';
  if (idade <= 12) return sexo === 'F' ? '👧' : '👦';
  if (idade <= 17) return sexo === 'F' ? '👧' : '👦';
  if (idade <= 59) {
    if (tipo === 'esposa') return '💑';
    return sexo === 'F' ? '👩' : '👨';
  }
  return sexo === 'F' ? '👵' : '👴';
};

export default function Aniversariantes({ permissoes }) {
  const podeEnviarEmail = permissoes?.canEditFinancial || permissoes?.canManageUsers || false;
  // Relatórios em PDF: só quem tem alguma permissão de edição; acesso simples apenas visualiza
  const podeGerarRelatorio = !!(permissoes?.canEdit || permissoes?.canEditFinancial || permissoes?.canManageUsers);
  const podeGerenciarEventos = podeGerarRelatorio; // gerenciar eventos/datas especiais: só quem tem permissão de edição
  const [aniversariantes, setAniversariantes] = useState([]);
  const [filtro, setFiltro] = useState('hoje');
  const [mesFiltro, setMesFiltro] = useState(new Date().getMonth() + 1);
  const [abaAtiva, setAbaAtiva] = useState('festividades');
  const [periodoRelatorio, setPeriodoRelatorio] = useState('semanal');
  const [trimestreSel, setTrimestreSel] = useState(Math.floor(new Date().getMonth() / 3));
  const [semestreSel, setSemestreSel] = useState(new Date().getMonth() < 6 ? 0 : 1);
  const [semanaSel, setSemanaSel] = useState(null); // null = calculado automaticamente (semana atual)
  const [buscaNomeVisaoGeral, setBuscaNomeVisaoGeral] = useState('');
  const [todosAniversariantes, setTodosAniversariantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalEventos, setModalEventos] = useState(false);
  const [eventosCustomizados, setEventosCustomizados] = useState([]);
  const [novoEvento, setNovoEvento] = useState({
    nome: '',
    tipo: 'Maçônico',
    descricao: '',
    dia: '',
    mes: '',
    envio_automatico: false
  });
  const [eventoEditando, setEventoEditando] = useState(null);
  const [salvandoEvento, setSalvandoEvento] = useState(false);
  const [enviandoEmail, setEnviandoEmail]   = useState(null); // irmao_id em envio
  const [emailEnviados, setEmailEnviados]   = useState({});
  const [emailEnviadosEsposas, setEmailEnviadosEsposas] = useState({});
  const [emailEnviadosBodas, setEmailEnviadosBodas] = useState({});
  const [emailEnviadosEventos, setEmailEnviadosEventos] = useState({});
  const [enviandoEventoId, setEnviandoEventoId] = useState(null);
  const [modalEmail, setModalEmail]         = useState(null); // irmao para preview
  const [dadosLoja, setDadosLoja]           = useState({});
  const [chanceler, setChanceler]           = useState('');

  useEffect(() => {
    carregarAniversariantes();
  }, [filtro, mesFiltro]);

  useEffect(() => {
    if (abaAtiva === 'visao_geral') carregarTodos();
  }, [abaAtiva]);

  useEffect(() => {
    carregarDadosEmail();
  }, []);

  const carregarDadosEmail = async () => {
    try {
      // Dados da loja
      const { data: loja } = await supabase.from('dados_loja').select('nome_loja, logo_url, cidade, estado, numero_loja').single();
      if (loja) setDadosLoja(loja);

      // Chanceler do corpo administrativo do ano atual
      const ano = new Date().getFullYear().toString();
      const { data: ca } = await supabase
        .from('corpo_administrativo')
        .select('cargo, irmaos(nome)')
        .eq('ano_exercicio', ano)
        .ilike('cargo', '%hanceler%')
        .maybeSingle();
      if (ca?.irmaos?.nome) setChanceler(ca.irmaos.nome);

      // Emails já enviados este ano — irmãos
      const { data: enviados } = await supabase
        .from('emails_aniversario')
        .select('irmao_id')
        .eq('ano', new Date().getFullYear());
      if (enviados) {
        const mapa = {};
        enviados.forEach(e => { mapa[e.irmao_id] = true; });
        setEmailEnviados(mapa);
      }

      // Emails já enviados para esposas este ano
      const { data: enviadosEsposas } = await supabase
        .from('emails_aniversario_esposas')
        .select('esposa_id')
        .eq('ano', new Date().getFullYear());
      if (enviadosEsposas) {
        const mapaEsposas = {};
        enviadosEsposas.forEach(e => { mapaEsposas[e.esposa_id] = true; });
        setEmailEnviadosEsposas(mapaEsposas);
      }

      // Emails de bodas já enviados este ano
      const { data: enviadosBodas } = await supabase
        .from('emails_bodas')
        .select('esposa_id')
        .eq('ano', new Date().getFullYear());
      if (enviadosBodas) {
        const mapaBodas = {};
        enviadosBodas.forEach(e => { mapaBodas[e.esposa_id] = true; });
        setEmailEnviadosBodas(mapaBodas);
      }

      // Emails de eventos comemorativos já enviados este ano
      try {
        const { data: enviadosEventos } = await supabase
          .from('emails_eventos_comemorativos')
          .select('evento_id')
          .eq('ano', new Date().getFullYear());
        if (enviadosEventos) {
          const mapaEventos = {};
          enviadosEventos.forEach(e => { mapaEventos[e.evento_id] = true; });
          setEmailEnviadosEventos(mapaEventos);
        }
      } catch (e) {
        console.log('ℹ️ Tabela emails_eventos_comemorativos não existe ainda');
      }
    } catch (e) {
      console.error('Erro ao carregar dados para email:', e);
    }
  };

  useEffect(() => {
    if (modalEventos) {
      carregarEventosCustomizados();
    }
  }, [modalEventos]);

  const carregarEventosCustomizados = async () => {
    try {
      const { data, error } = await supabase
        .from('eventos_comemorativos')
        .select('*')
        .order('mes', { ascending: true })
        .order('dia', { ascending: true });
      
      if (error) throw error;
      setEventosCustomizados(data || []);
    } catch (error) {
      console.log('ℹ️ Tabela eventos_comemorativos não existe ainda');
      setEventosCustomizados([]);
    }
  };

  const salvarEvento = async () => {
    if (!novoEvento.nome || !novoEvento.dia || !novoEvento.mes) {
      alert('Preencha todos os campos obrigatórios!');
      return;
    }

    if (novoEvento.dia < 1 || novoEvento.dia > 31) {
      alert('Dia deve estar entre 1 e 31');
      return;
    }

    if (novoEvento.mes < 1 || novoEvento.mes > 12) {
      alert('Mês deve estar entre 1 e 12');
      return;
    }

    setSalvandoEvento(true);
    try {
      const { error } = await supabase
        .from('eventos_comemorativos')
        .insert([{
          nome: novoEvento.nome,
          tipo: novoEvento.tipo,
          descricao: novoEvento.descricao,
          dia: parseInt(novoEvento.dia),
          mes: parseInt(novoEvento.mes),
          envio_automatico: novoEvento.envio_automatico
        }]);

      if (error) throw error;

      alert('Evento cadastrado com sucesso!');
      setNovoEvento({ nome: '', tipo: 'Maçônico', descricao: '', dia: '', mes: '', envio_automatico: false });
      carregarEventosCustomizados();
      carregarAniversariantes(); // Recarregar para mostrar o novo evento
    } catch (error) {
      console.error('Erro ao salvar evento:', error);
      alert('Erro ao salvar evento. Verifique se a tabela eventos_comemorativos existe no Supabase.');
    } finally {
      setSalvandoEvento(false);
    }
  };

  const editarEvento = (evento) => {
    setEventoEditando({
      id: evento.id,
      nome: evento.nome,
      tipo: evento.tipo || 'Maçônico',
      descricao: evento.descricao || '',
      dia: evento.dia.toString(),
      mes: evento.mes.toString(),
      envio_automatico: evento.envio_automatico || false
    });
  };

  const cancelarEdicao = () => {
    setEventoEditando(null);
  };

  const atualizarEvento = async () => {
    if (!eventoEditando.nome || !eventoEditando.dia || !eventoEditando.mes) {
      alert('Preencha todos os campos obrigatórios!');
      return;
    }

    if (eventoEditando.dia < 1 || eventoEditando.dia > 31) {
      alert('Dia deve estar entre 1 e 31');
      return;
    }

    if (eventoEditando.mes < 1 || eventoEditando.mes > 12) {
      alert('Mês deve estar entre 1 e 12');
      return;
    }

    setSalvandoEvento(true);
    try {
      const { error } = await supabase
        .from('eventos_comemorativos')
        .update({
          nome: eventoEditando.nome,
          tipo: eventoEditando.tipo,
          descricao: eventoEditando.descricao,
          dia: parseInt(eventoEditando.dia),
          mes: parseInt(eventoEditando.mes),
          envio_automatico: eventoEditando.envio_automatico
        })
        .eq('id', eventoEditando.id);

      if (error) throw error;

      alert('Evento atualizado com sucesso!');
      setEventoEditando(null);
      carregarEventosCustomizados();
      carregarAniversariantes();
    } catch (error) {
      console.error('Erro ao atualizar evento:', error);
      alert('Erro ao atualizar evento.');
    } finally {
      setSalvandoEvento(false);
    }
  };

  const excluirEvento = async (id) => {
    if (!confirm('Deseja realmente excluir este evento?')) return;

    try {
      const { error } = await supabase
        .from('eventos_comemorativos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      alert('Evento excluído com sucesso!');
      carregarEventosCustomizados();
      carregarAniversariantes();
    } catch (error) {
      console.error('Erro ao excluir evento:', error);
      alert('Erro ao excluir evento.');
    }
  };

  const handleEnviarEmail = async (irmao) => {
    if (!podeEnviarEmail) { alert('Você não tem permissão para enviar felicitações.'); return; }
    setEnviandoEmail(irmao.irmao_id);
    try {
      await enviarEmailAniversario(irmao, dadosLoja.nome_loja || 'A∴R∴L∴S∴ Acácia de Paranatinga nº 30', chanceler || 'Chanceler', dadosLoja.logo_url || '', 'manual');
      setEmailEnviados(prev => ({ ...prev, [irmao.irmao_id]: true }));
      setModalEmail(null);
      alert(`✅ Email enviado com sucesso para ${irmao.nome}!`);
    } catch (e) {
      alert(`❌ Erro ao enviar email: ${e.message}`);
    } finally {
      setEnviandoEmail(null);
    }
  };

  const handleEnviarEmailEsposa = async (aniv) => {
    if (!podeEnviarEmail) { alert('Você não tem permissão para enviar felicitações.'); return; }
    if (!aniv.email) { alert('Esta cunhada não possui e-mail cadastrado.'); return; }
    setEnviandoEmail(`esposa_${aniv.esposa_id}`);
    try {
      const nomeLoja = dadosLoja.nome_loja || 'A∴R∴L∴S∴ Acácia de Paranatinga nº 30';
      const logoUrl  = dadosLoja.logo_url  || '';
      const { data, error } = await supabase.functions.invoke('email-aniversario', {
        body: { esposaId: aniv.esposa_id, irmaoNome: aniv.irmao_responsavel }
      });
      if (error) throw new Error(error.message);
      // Registrar envio
      await supabase.from('emails_aniversario_esposas').insert({
        esposa_id: aniv.esposa_id,
        ano: new Date().getFullYear(),
        modo: 'manual'
      });
      setEmailEnviadosEsposas(prev => ({ ...prev, [aniv.esposa_id]: true }));
      alert(`✅ Felicitações enviadas para ${aniv.nome}!`);
    } catch (e) {
      alert(`❌ Erro ao enviar: ${e.message}`);
    } finally {
      setEnviandoEmail(null);
    }
  };

  const handleEnviarBodas = async (aniv) => {
    if (!podeEnviarEmail) { alert('Você não tem permissão para enviar felicitações.'); return; }
    if (!aniv.email_irmao && !aniv.email_esposa) {
      alert('Nenhum dos dois possui e-mail cadastrado.');
      return;
    }
    setEnviandoEmail(`bodas_${aniv.esposa_id}`);
    try {
      const { data, error } = await supabase.functions.invoke('email-aniversario', {
        body: { bodasId: aniv.esposa_id }
      });
      if (error) throw new Error(error.message);
      await supabase.from('emails_bodas').insert({
        esposa_id: aniv.esposa_id,
        ano: new Date().getFullYear(),
        modo: 'manual'
      });
      setEmailEnviadosBodas(prev => ({ ...prev, [aniv.esposa_id]: true }));
      alert(`✅ Felicitações de Bodas enviadas!`);
    } catch (e) {
      alert(`❌ Erro ao enviar: ${e.message}`);
    } finally {
      setEnviandoEmail(null);
    }
  };

  const handleEnviarEmailEvento = async (aniv) => {
    if (!podeEnviarEmail) { alert('Você não tem permissão para enviar e-mails.'); return; }
    if (!aniv.id) { alert('Este evento ainda não foi salvo no cadastro de eventos.'); return; }

    setEnviandoEventoId(aniv.id);
    try {
      // Conta quantos irmãos ativos (regular + licenciado) com e-mail vão receber
      const { count } = await supabase
        .from('irmaos')
        .select('id', { count: 'exact', head: true })
        .in('situacao', ['regular', 'licenciado'])
        .not('email', 'is', null)
        .neq('email', '');

      if (!confirm(`Enviar "${aniv.nome}" para ${count || 0} irmão(s) ativo(s) com e-mail cadastrado?`)) {
        setEnviandoEventoId(null);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ypnvzjctyfdrkkrhskzs.supabase.co';

      const res = await fetch(`${SUPABASE_URL}/functions/v1/enviar-email-evento-comemorativo`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ eventoId: aniv.id, modo: 'manual' }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || `Erro HTTP ${res.status}`);
      }

      const resultado = await res.json();
      const r0 = resultado.resultados?.[0];
      if (r0?.pulado) {
        alert(`ℹ️ Nada foi enviado: ${r0.motivo || 'evento já enviado este ano'}.`);
        setEmailEnviadosEventos(prev => ({ ...prev, [aniv.id]: true }));
        return;
      }
      const enviados = r0?.total_enviados ?? resultado.total_enviados ?? 0;
      const falhas = r0?.total_falhas ?? resultado.total_falhas ?? 0;
      if (enviados === 0 && falhas > 0) {
        const detalheErro = r0?.erros?.[0]?.erro || 'verifique os Logs da Edge Function no Supabase';
        throw new Error(`Nenhum e-mail foi entregue (${falhas} falha(s)). Detalhe: ${detalheErro}`);
      }
      setEmailEnviadosEventos(prev => ({ ...prev, [aniv.id]: true }));
      alert(`✅ E-mail enviado para ${enviados} irmão(s)!${falhas ? ` (${falhas} falha(s) — confira os Logs da Edge Function para detalhes)` : ''}`);
    } catch (e) {
      alert(`❌ Erro ao enviar: ${e.message}`);
    } finally {
      setEnviandoEventoId(null);
    }
  };

  const gerarRelatorioPDF = async () => {
    if (!podeGerarRelatorio) return;
    const doc = new jsPDF();
    const hoje = new Date();
    
    // Cabeçalho
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('A∴R∴L∴S∴ Acácia de Paranatinga nº 30', 105, 15, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text('📅 Relatório de Datas Comemorativas', 105, 25, { align: 'center' });
    
    // Subtítulo baseado no filtro
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    let subtitulo = '';
    switch(filtro) {
      case 'hoje':
        subtitulo = `Aniversariantes de Hoje - ${hoje.toLocaleDateString('pt-BR')}`;
        break;
      case 'semana':
        subtitulo = 'Aniversariantes dos Próximos 7 Dias';
        break;
      case 'mes':
        subtitulo = `Aniversariantes do Mês - ${hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`;
        break;
      case 'todos':
        subtitulo = 'Todos os Aniversariantes';
        break;
    }
    doc.text(subtitulo, 105, 32, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${hoje.toLocaleDateString('pt-BR')} às ${hoje.toLocaleTimeString('pt-BR')}`, 105, 38, { align: 'center' });
    
    // Linha separadora
    doc.setDrawColor(200);
    doc.line(15, 42, 195, 42);
    
    if (aniversariantes.length === 0) {
      doc.setFontSize(12);
      doc.setTextColor(150);
      doc.text('Nenhum aniversariante encontrado neste período.', 105, 60, { align: 'center' });
    } else {
      let currentY = 48;
      
      // Separar aniversariantes por nível
      const nivel1 = aniversariantes.filter(a => a.nivel === 1);
      const nivel2 = aniversariantes.filter(a => a.nivel === 2);
      const nivel3 = aniversariantes.filter(a => a.nivel === 3);
      
      // Buscar dados adicionais para irmãos do nível 1 (pais e filhos falecidos)
      const irmaosIds = nivel1.filter(a => a.irmao_id).map(a => a.irmao_id);
      
      let paisFalecidosMap = {};
      let filhosFalecidosMap = {};
      
      if (irmaosIds.length > 0) {
        // Buscar pais falecidos
        const { data: paisFalecidos } = await supabase
          .from('pais')
          .select('irmao_id, nome')
          .in('irmao_id', irmaosIds)
          .eq('falecido', true);
        
        if (paisFalecidos) {
          paisFalecidos.forEach(pai => {
            if (!paisFalecidosMap[pai.irmao_id]) {
              paisFalecidosMap[pai.irmao_id] = [];
            }
            paisFalecidosMap[pai.irmao_id].push({
              nome: pai.nome
            });
          });
        }
        
        // Buscar filhos falecidos
        const { data: filhosFalecidos } = await supabase
          .from('filhos')
          .select('irmao_id, nome')
          .in('irmao_id', irmaosIds)
          .eq('vivo', false);
        
        if (filhosFalecidos) {
          filhosFalecidos.forEach(filho => {
            if (!filhosFalecidosMap[filho.irmao_id]) {
              filhosFalecidosMap[filho.irmao_id] = [];
            }
            filhosFalecidosMap[filho.irmao_id].push({
              nome: filho.nome
            });
          });
        }
      }
      
      // ===== NÍVEL 1: IRMÃOS =====
      if (nivel1.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 139);
        doc.text(`1. IRMÃOS (${nivel1.length})`, 15, currentY);
        currentY += 5;
        
        const tableData1 = nivel1.map(aniv => {
          const ehHoje = aniv.proximo_aniversario.toDateString() === hoje.toDateString();
          const dataNascFormatada = aniv.data_nascimento.toLocaleDateString('pt-BR');
          
          const paisFalecidos = paisFalecidosMap[aniv.irmao_id] || [];
          const filhosFalecidos = filhosFalecidosMap[aniv.irmao_id] || [];
          
          let paisTexto = '';
          if (paisFalecidos.length > 0) {
            paisTexto = paisFalecidos.map(p => p.nome).join(', ');
          }
          
          let filhosTexto = '';
          if (filhosFalecidos.length > 0) {
            filhosTexto = filhosFalecidos.map(f => f.nome).join(', ');
          }
          
          return [
            aniv.nome,
            `${aniv.idade} anos`,
            dataNascFormatada,
            paisTexto || '-',
            filhosTexto || '-',
            ehHoje ? '🎉' : ''
          ];
        });
        
        doc.autoTable({
          startY: currentY,
          head: [['Nome', 'Idade', 'Dt Nasc.', 'Pais Falecidos', 'Filhos Falecidos', '']],
          body: tableData1,
          styles: {
            fontSize: 8,
            cellPadding: 2,
          },
          headStyles: {
            fillColor: [41, 98, 185],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 8
          },
          columnStyles: {
            0: { cellWidth: 45 },
            1: { cellWidth: 18, halign: 'center' },
            2: { cellWidth: 22, halign: 'center' },
            3: { cellWidth: 45, fontSize: 7 },
            4: { cellWidth: 45, fontSize: 7 },
            5: { cellWidth: 10, halign: 'center', fontStyle: 'bold' }
          },
          alternateRowStyles: {
            fillColor: [230, 240, 255]
          },
          didParseCell: function(data) {
            if (data.row.index >= 0 && data.column.index === 5 && data.cell.raw === '🎉') {
              data.row.cells.forEach(cell => {
                cell.styles.fillColor = [255, 243, 205];
                cell.styles.fontStyle = 'bold';
              });
            }
          }
        });
        
        currentY = doc.lastAutoTable.finalY + 10;
      }
      
      // ===== NÍVEL 2: FAMILIARES =====
      if (nivel2.length > 0) {
        if (currentY > 240) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 128, 0);
        doc.text(`2. FAMILIARES (${nivel2.length})`, 15, currentY);
        currentY += 5;
        
        const tableData2 = nivel2.map(aniv => {
          const ehHoje = aniv.proximo_aniversario.toDateString() === hoje.toDateString();
          const dataNascFormatada = aniv.data_nascimento.toLocaleDateString('pt-BR');
          
          // Montar texto de vínculos
          let textoIrmao = aniv.irmao_responsavel || '-';
          if (aniv.vinculos && aniv.vinculos.length > 1) {
            textoIrmao = aniv.vinculos.map(v => `${v.tipo} do Irmão ${v.irmao}`).join('; ');
          }
          
          return [
            aniv.nome,
            aniv.tipo,
            `${aniv.idade} anos`,
            dataNascFormatada,
            textoIrmao,
            ehHoje ? '🎉' : ''
          ];
        });
        
        doc.autoTable({
          startY: currentY,
          head: [['Nome', 'Tipo', 'Idade', 'Dt Nasc.', 'Irmão', '']],
          body: tableData2,
          styles: {
            fontSize: 8,
            cellPadding: 2,
          },
          headStyles: {
            fillColor: [34, 139, 34],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 8
          },
          columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 25, halign: 'center' },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 25, halign: 'center' },
            4: { cellWidth: 50 },
            5: { cellWidth: 10, halign: 'center', fontStyle: 'bold' }
          },
          alternateRowStyles: {
            fillColor: [230, 255, 230]
          },
          didParseCell: function(data) {
            if (data.row.index >= 0 && data.column.index === 5 && data.cell.raw === '🎉') {
              data.row.cells.forEach(cell => {
                cell.styles.fillColor = [255, 243, 205];
                cell.styles.fontStyle = 'bold';
              });
            }
          }
        });
        
        currentY = doc.lastAutoTable.finalY + 10;
      }
      
      // ===== NÍVEL 4: EVENTOS MAÇÔNICOS E CÍVICOS =====
      const nivel4 = aniversariantes.filter(a => a.nivel === 4);
      
      if (nivel4.length > 0) {
        if (currentY > 240) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(128, 0, 128);
        doc.text(`4. EVENTOS MAÇÔNICOS E CÍVICOS (${nivel4.length})`, 15, currentY);
        currentY += 5;
        
        const tableData4 = nivel4.map(aniv => {
          const ehHoje = aniv.proximo_aniversario.toDateString() === hoje.toDateString();
          
          return [
            aniv.nome,
            aniv.tipo,
            aniv.descricao || '-',
            aniv.proximo_aniversario.toLocaleDateString('pt-BR'),
            ehHoje ? '🎉' : ''
          ];
        });
        
        doc.autoTable({
          startY: currentY,
          head: [['Evento', 'Tipo', 'Descrição', 'Data', '']],
          body: tableData4,
          styles: {
            fontSize: 8,
            cellPadding: 2,
          },
          headStyles: {
            fillColor: [128, 0, 128],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 8
          },
          columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 30, halign: 'center' },
            2: { cellWidth: 70, fontSize: 7 },
            3: { cellWidth: 25, halign: 'center' },
            4: { cellWidth: 10, halign: 'center', fontStyle: 'bold' }
          },
          alternateRowStyles: {
            fillColor: [245, 230, 255]
          },
          didParseCell: function(data) {
            if (data.row.index >= 0 && data.column.index === 4 && data.cell.raw === '🎉') {
              data.row.cells.forEach(cell => {
                cell.styles.fillColor = [255, 243, 205];
                cell.styles.fontStyle = 'bold';
              });
            }
          }
        });
        
        currentY = doc.lastAutoTable.finalY + 10;
      }
      
      // ===== NÍVEL 3: IN MEMORIAM =====
      if (nivel3.length > 0) {
        if (currentY > 240) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 100, 100);
        doc.text(`3. IN MEMORIAM (${nivel3.length})`, 15, currentY);
        currentY += 5;
        
        const tableData3 = nivel3.map(aniv => {
          const ehHoje = aniv.proximo_aniversario.toDateString() === hoje.toDateString();
          const dataNascFormatada = aniv.data_nascimento.toLocaleDateString('pt-BR');
          
          return [
            aniv.nome,
            aniv.tipo,
            `${aniv.idade} anos`,
            dataNascFormatada,
            aniv.irmao_responsavel || '-',
            ehHoje ? '🎉' : ''
          ];
        });
        
        doc.autoTable({
          startY: currentY,
          head: [['Nome', 'Tipo', 'Idade', 'Dt Nasc.', 'Irmão', '']],
          body: tableData3,
          styles: {
            fontSize: 8,
            cellPadding: 2,
          },
          headStyles: {
            fillColor: [128, 128, 128],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 8
          },
          columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 25, halign: 'center' },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 25, halign: 'center' },
            4: { cellWidth: 50 },
            5: { cellWidth: 10, halign: 'center', fontStyle: 'bold' }
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245]
          },
          didParseCell: function(data) {
            if (data.row.index >= 0 && data.column.index === 5 && data.cell.raw === '🎉') {
              data.row.cells.forEach(cell => {
                cell.styles.fillColor = [255, 243, 205];
                cell.styles.fontStyle = 'bold';
              });
            }
          }
        });
        
        currentY = doc.lastAutoTable.finalY + 10;
      }
      
      // Rodapé com totalizadores
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.text('Resumo:', 15, currentY);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      
      const totalIrmaos = nivel1.length;
      const totalFamiliares = nivel2.length;
      const totalEventos = nivel4.length;
      const totalInMemoriam = nivel3.length;
      const totalPais = aniversariantes.filter(a => a.nivel === 2 && temTipo(a, ['Pai', 'Mãe', 'Pai/Mãe'])).length;
      const totalEsposas = aniversariantes.filter(a => a.nivel === 2 && temTipo(a, ['Esposa'])).length;
      const totalBodas = aniversariantes.filter(a => a.tipo === 'Bodas').length;
      const totalFilhos = aniversariantes.filter(a => ehFamilia(a) && !temTipo(a, ['Pai', 'Mãe', 'Pai/Mãe', 'Bodas'])).length;
      const totalHoje = aniversariantes.filter(a => 
        a.proximo_aniversario.toDateString() === hoje.toDateString()
      ).length;
      
      doc.text(`• Total de Datas Comemorativas: ${aniversariantes.length}`, 15, currentY + 6);
      doc.text(`• Irmãos Vivos: ${totalIrmaos}`, 15, currentY + 11);
      doc.text(`• Familiares (Pais: ${totalPais}, Esposas: ${totalEsposas}, Bodas: ${totalBodas}, Filhos: ${totalFilhos})`, 15, currentY + 16);
      doc.text(`• Eventos Maçônicos e Cívicos: ${totalEventos}`, 15, currentY + 21);
      doc.text(`• In Memoriam: ${totalInMemoriam}`, 15, currentY + 26);
      if (filtro !== 'hoje') {
        doc.text(`• Datas de Hoje: ${totalHoje}`, 15, currentY + 31);
      }
    }
    
    // Rodapé da página
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('A∴R∴L∴S∴ Acácia de Paranatinga nº 30', 105, 285, { align: 'center' });
    
    // Salvar
    const nomeArquivo = `Aniversariantes_${filtro}_${hoje.toISOString().split('T')[0]}.pdf`;
    doc.save(nomeArquivo);
  };

  const carregarTodos = async () => {
    // Salva filtro atual, força 'todos', carrega, restaura
    const filtroOriginal = filtro;
    // Executa carregamento com filtro 'todos' usando uma cópia do state
    // Como filtro é closure, usamos uma flag passada por parâmetro
    await carregarAniversariantesFiltro('todos', setTodosAniversariantes);
  };

  const carregarAniversariantes = async () => {
    await carregarAniversariantesFiltro(filtro, setAniversariantes);
  };

  const carregarAniversariantesFiltro = async (filtroParam, setFn) => {
    setLoading(true);
    try {
      const hoje = new Date();
      const aniversariantesIrmaos = [];
      const aniversariantesFamiliares = [];
      const aniversariantesInMemoriam = [];

      console.log('🎂 Iniciando busca de aniversariantes...');

      // ===== NÍVEL 1: IRMÃOS VIVOS =====
      const { data: irmaos } = await supabase
        .from('irmaos')
        .select('id, cim, nome, data_nascimento, cargo, foto_url, situacao, email, data_falecimento')
        .neq('situacao', 'falecido')
        .neq('situacao', 'irregular')
        .neq('situacao', 'desligado')
        .neq('situacao', 'suspenso')
        .neq('situacao', 'excluído')
        .neq('situacao', 'ex-ofício')
        .is('data_falecimento', null);

      console.log('✅ Irmãos vivos:', irmaos?.length);
      console.log('📋 IDs dos irmãos vivos:', irmaos?.map(i => `${i.nome} (${i.situacao})`).join(', '));

      if (irmaos) {
        irmaos.forEach(irmao => {
          if (!irmao.data_nascimento) return;

          const dataNasc = new Date(irmao.data_nascimento + 'T00:00:00');
          const proximoAniv = new Date(hoje.getFullYear(), dataNasc.getMonth(), dataNasc.getDate());
          
          const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
          if (proximoAniv < hojeZerado) {
            proximoAniv.setFullYear(hoje.getFullYear() + 1);
          }

          const ehHoje = proximoAniv.getDate() === hoje.getDate() && 
                        proximoAniv.getMonth() === hoje.getMonth() &&
                        proximoAniv.getFullYear() === hoje.getFullYear();

          const deveMostrar = filtroParam === 'todos' || 
            (filtroParam === 'hoje' && ehHoje) ||
            (filtroParam === 'semana' && proximoAniv <= new Date(hoje.getTime() + 7*24*60*60*1000)) ||
            (filtroParam === 'mes' && proximoAniv.getMonth() === hoje.getMonth()) ||
            (filtroParam === 'mes_especifico' && proximoAniv.getMonth() + 1 === mesFiltro);

          if (deveMostrar) {
            const idade = hoje.getFullYear() - dataNasc.getFullYear();
            aniversariantesIrmaos.push({
              tipo: 'Irmão',
              nome: irmao.nome,
              cim: irmao.cim,
              proximo_aniversario: proximoAniv,
              data_nascimento: dataNasc,
              idade,
              cargo: irmao.cargo,
              foto_url: irmao.foto_url,
              irmao_id: irmao.id,
              nivel: 1,
              email: irmao.email || null,
            });
          }
        });
      }

      // IDs dos irmãos vivos (para filtrar familiares)
      const irmaoVivosIds = irmaos?.map(i => i.id) || [];

      // ── Otimização: disparar todas as queries dependentes em paralelo ──
      const [
        { data: paisVivosRaw },
        { data: esposasRaw },
        { data: filhosVivosRaw },
        { data: irmaosFalecidosRaw, error: errorIrmaosFalecidos },
        { data: paisFalecidosRaw, error: errorPaisFalecidos },
        { data: filhosFalecidosRaw, error: errorFilhosFalecidos },
        eventosCustomizadosResult,
        esposasCasamentoResult,
      ] = await Promise.all([
        supabase.from('pais').select('nome, data_nascimento, irmao_id, falecido, tipo, irmaos(nome, situacao)').in('irmao_id', irmaoVivosIds),
        supabase.from('esposas').select('id, nome, data_nascimento, email, irmao_id, irmaos(nome, situacao)').in('irmao_id', irmaoVivosIds),
        supabase.from('filhos').select('nome, data_nascimento, irmao_id, vivo, data_obito, tipo_vinculo, sexo, irmaos(nome, situacao)').in('irmao_id', irmaoVivosIds),
        supabase.from('irmaos').select('id, cim, nome, data_nascimento, data_falecimento, cargo, foto_url, situacao').eq('situacao', 'falecido'),
        supabase.from('pais').select('nome, data_nascimento, data_obito, irmao_id, falecido, tipo, irmaos(nome, situacao)').in('irmao_id', irmaoVivosIds),
        supabase.from('filhos').select('nome, data_nascimento, data_obito, irmao_id, vivo, tipo_vinculo, sexo, irmaos(nome, situacao)').in('irmao_id', irmaoVivosIds),
        supabase.from('eventos_comemorativos').select('*').then(r => r).catch(e => ({ data: null, error: e })),
        supabase.from('esposas').select('id, nome, data_casamento, email, irmao_id, irmaos(id, nome, email, situacao)').in('irmao_id', irmaoVivosIds).then(r => r).catch(e => ({ data: null, error: e })),
      ]);

      const eventosCustomizados = eventosCustomizadosResult?.data;
      const esposasCasamento = esposasCasamentoResult?.data;

      // ===== NÍVEL 2: FAMILIARES (Pais, Esposas e Filhos VIVOS de irmãos vivos) =====
      
      // PAIS VIVOS de irmãos vivos (considera null como vivo)
      let paisVivos = paisVivosRaw;
      
      // Filtrar apenas os vivos (falecido = false ou null)
      paisVivos = paisVivos?.filter(p => !p.falecido) || [];

      console.log('✅ Pais vivos:', paisVivos?.length);

      if (paisVivos) {
        paisVivos.forEach(pai => {
          // Garantir que o irmão não está falecido
          if (!pai.irmaos || pai.irmaos.situacao === 'falecido') {
            console.log('⚠️ Pai/Mãe de irmão falecido ignorado:', pai.nome, 'do irmão', pai.irmaos?.nome);
            return;
          }
          if (!pai.data_nascimento) return;

          const dataNasc = new Date(pai.data_nascimento + 'T00:00:00');
          const proximoAniv = new Date(hoje.getFullYear(), dataNasc.getMonth(), dataNasc.getDate());
          
          const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
          if (proximoAniv < hojeZerado) {
            proximoAniv.setFullYear(hoje.getFullYear() + 1);
          }

          const ehHoje = proximoAniv.getDate() === hoje.getDate() && 
                        proximoAniv.getMonth() === hoje.getMonth() &&
                        proximoAniv.getFullYear() === hoje.getFullYear();

          const deveMostrar = filtroParam === 'todos' || 
            (filtroParam === 'hoje' && ehHoje) ||
            (filtroParam === 'semana' && proximoAniv <= new Date(hoje.getTime() + 7*24*60*60*1000)) ||
            (filtroParam === 'mes' && proximoAniv.getMonth() === hoje.getMonth()) ||
            (filtroParam === 'mes_especifico' && proximoAniv.getMonth() + 1 === mesFiltro);

          if (deveMostrar) {
            const idade = hoje.getFullYear() - dataNasc.getFullYear();
            const sexo = pai.tipo === 'mae' ? 'F' : 'M';
            const tipoExibicao = pai.tipo === 'mae' ? 'Mãe' : 'Pai';
            
            aniversariantesFamiliares.push({
              tipo: tipoExibicao,
              nome: pai.nome,
              sexo: sexo,
              proximo_aniversario: proximoAniv,
              data_nascimento: dataNasc,
              idade,
              irmao_responsavel: pai.irmaos?.nome,
              nivel: 2
            });
          }
        });
      }

      // ESPOSAS de irmãos vivos
      const esposas = esposasRaw;

      console.log('✅ Esposas:', esposas?.length);

      if (esposas) {
        esposas.forEach(esposa => {
          // Garantir que o irmão não está falecido (redundante, mas mantém segurança)
          if (!esposa.irmaos || esposa.irmaos.situacao === 'falecido') {
            console.log('⚠️ Esposa de irmão falecido ignorada:', esposa.nome, 'do irmão', esposa.irmaos?.nome);
            return;
          }
          if (!esposa.data_nascimento) return;

          const dataNasc = new Date(esposa.data_nascimento + 'T00:00:00');
          const proximoAniv = new Date(hoje.getFullYear(), dataNasc.getMonth(), dataNasc.getDate());
          
          const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
          if (proximoAniv < hojeZerado) {
            proximoAniv.setFullYear(hoje.getFullYear() + 1);
          }

          const ehHoje = proximoAniv.getDate() === hoje.getDate() && 
                        proximoAniv.getMonth() === hoje.getMonth() &&
                        proximoAniv.getFullYear() === hoje.getFullYear();

          const deveMostrar = filtroParam === 'todos' || 
            (filtroParam === 'hoje' && ehHoje) ||
            (filtroParam === 'semana' && proximoAniv <= new Date(hoje.getTime() + 7*24*60*60*1000)) ||
            (filtroParam === 'mes' && proximoAniv.getMonth() === hoje.getMonth()) ||
            (filtroParam === 'mes_especifico' && proximoAniv.getMonth() + 1 === mesFiltro);

          if (deveMostrar) {
            const idade = hoje.getFullYear() - dataNasc.getFullYear();
            aniversariantesFamiliares.push({
              tipo: 'Esposa',
              nome: esposa.nome,
              sexo: 'F',
              proximo_aniversario: proximoAniv,
              data_nascimento: dataNasc,
              idade,
              irmao_responsavel: esposa.irmaos?.nome,
              irmao_id: esposa.irmao_id,
              esposa_id: esposa.id,
              email: esposa.email || null,
              nivel: 2
            });
          }
        });
      }

      // FILHOS VIVOS de irmãos vivos (vivo = true ou null)
      let filhosVivos = filhosVivosRaw;
      
      // Filtrar apenas os vivos: vivo deve ser true ou null E sem data_obito
      filhosVivos = filhosVivos?.filter(f => {
        if (f.vivo === false) return false;
        if (f.data_obito && f.data_obito !== '' && f.data_obito !== null) return false;
        return true;
      }) || [];

      console.log('✅ Filhos vivos:', filhosVivos?.length);

      if (filhosVivos) {
        filhosVivos.forEach(filho => {
          // Garantir que o irmão não está falecido
          if (!filho.irmaos || filho.irmaos.situacao === 'falecido') {
            console.log('⚠️ Filho de irmão falecido ignorado:', filho.nome, 'do irmão', filho.irmaos?.nome);
            return;
          }
          if (!filho.data_nascimento) return;

          const dataNasc = new Date(filho.data_nascimento + 'T00:00:00');
          const proximoAniv = new Date(hoje.getFullYear(), dataNasc.getMonth(), dataNasc.getDate());
          
          const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
          if (proximoAniv < hojeZerado) {
            proximoAniv.setFullYear(hoje.getFullYear() + 1);
          }

          const ehHoje = proximoAniv.getDate() === hoje.getDate() && 
                        proximoAniv.getMonth() === hoje.getMonth() &&
                        proximoAniv.getFullYear() === hoje.getFullYear();

          const deveMostrar = filtroParam === 'todos' || 
            (filtroParam === 'hoje' && ehHoje) ||
            (filtroParam === 'semana' && proximoAniv <= new Date(hoje.getTime() + 7*24*60*60*1000)) ||
            (filtroParam === 'mes' && proximoAniv.getMonth() === hoje.getMonth()) ||
            (filtroParam === 'mes_especifico' && proximoAniv.getMonth() + 1 === mesFiltro);

          if (deveMostrar) {
            const idade = hoje.getFullYear() - dataNasc.getFullYear();
            
            // Usar tipo_vinculo do banco, com fallback para lógica antiga
            let tipoExibicao = 'Filho(a)';
            if (filho.tipo_vinculo) {
              // Capitalizar primeira letra
              tipoExibicao = filho.tipo_vinculo.charAt(0).toUpperCase() + filho.tipo_vinculo.slice(1);
            } else if (filho.sexo) {
              tipoExibicao = filho.sexo === 'M' ? 'Filho' : 'Filha';
            }
            
            aniversariantesFamiliares.push({
              tipo: tipoExibicao,
              nome: filho.nome,
              sexo: filho.sexo || 'M',
              proximo_aniversario: proximoAniv,
              data_nascimento: dataNasc,
              idade,
              irmao_responsavel: filho.irmaos?.nome,
              nivel: 2
            });
          }
        });
      }

      // ===== NÍVEL 3: IN MEMORIAM =====
      
      // IRMÃOS FALECIDOS
      let irmaosFalecidos = irmaosFalecidosRaw;

      if (errorIrmaosFalecidos) {
        console.error('❌ Erro ao buscar irmãos falecidos:', errorIrmaosFalecidos);
        irmaosFalecidos = [];
      }
      
      console.log('✅ Irmãos falecidos:', irmaosFalecidos?.length);

      if (irmaosFalecidos) {
        irmaosFalecidos.forEach(irmao => {
          // In Memoriam é referenciado pela data de nascimento (não pela data de falecimento)
          const dataRef = irmao.data_nascimento;
          if (!dataRef) return;

          const dataBase = new Date(dataRef + 'T00:00:00');
          const dataNasc = irmao.data_nascimento ? new Date(irmao.data_nascimento + 'T00:00:00') : dataBase;
          const proximoAniv = new Date(hoje.getFullYear(), dataBase.getMonth(), dataBase.getDate());
          
          const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
          if (proximoAniv < hojeZerado) proximoAniv.setFullYear(hoje.getFullYear() + 1);

          const ehHoje = proximoAniv.getDate() === hoje.getDate() && proximoAniv.getMonth() === hoje.getMonth() && proximoAniv.getFullYear() === hoje.getFullYear();
          const deveMostrar = filtroParam === 'todos' || 
            (filtroParam === 'hoje' && ehHoje) ||
            (filtroParam === 'semana' && proximoAniv <= new Date(hoje.getTime() + 7*24*60*60*1000)) ||
            (filtroParam === 'mes' && proximoAniv.getMonth() === hoje.getMonth()) ||
            (filtroParam === 'mes_especifico' && proximoAniv.getMonth() + 1 === mesFiltro);

          if (deveMostrar) {
            const idade = dataNasc ? hoje.getFullYear() - dataNasc.getFullYear() : null;
            aniversariantesInMemoriam.push({
              tipo: 'Irmão',
              nome: irmao.nome,
              cim: irmao.cim,
              proximo_aniversario: proximoAniv,
              data_nascimento: dataNasc,
              data_falecimento: irmao.data_falecimento ? new Date(irmao.data_falecimento + 'T00:00:00') : null,
              idade,
              cargo: irmao.cargo,
              foto_url: irmao.foto_url,
              irmao_id: irmao.id,
              nivel: 3,
              falecido: true
            });
          }
        });
      }

      // PAIS FALECIDOS de irmãos VIVOS
      let paisFalecidos = paisFalecidosRaw;

      if (errorPaisFalecidos) {
        console.error('❌ Erro ao buscar pais falecidos:', errorPaisFalecidos);
        paisFalecidos = [];
      }
      
      paisFalecidos = paisFalecidos?.filter(p => p.falecido === true) || [];
      console.log('✅ Pais falecidos:', paisFalecidos?.length);

      if (paisFalecidos) {
        paisFalecidos.forEach(pai => {
          if (pai.irmaos?.situacao === 'falecido') return;
          const dataRef = pai.data_nascimento;
          if (!dataRef) return;

          const dataBase = new Date(dataRef + 'T00:00:00');
          const dataNasc = pai.data_nascimento ? new Date(pai.data_nascimento + 'T00:00:00') : dataBase;
          const proximoAniv = new Date(hoje.getFullYear(), dataBase.getMonth(), dataBase.getDate());
          
          const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
          if (proximoAniv < hojeZerado) proximoAniv.setFullYear(hoje.getFullYear() + 1);

          const ehHoje = proximoAniv.getDate() === hoje.getDate() && proximoAniv.getMonth() === hoje.getMonth() && proximoAniv.getFullYear() === hoje.getFullYear();
          const deveMostrar = filtroParam === 'todos' || 
            (filtroParam === 'hoje' && ehHoje) ||
            (filtroParam === 'semana' && proximoAniv <= new Date(hoje.getTime() + 7*24*60*60*1000)) ||
            (filtroParam === 'mes' && proximoAniv.getMonth() === hoje.getMonth()) ||
            (filtroParam === 'mes_especifico' && proximoAniv.getMonth() + 1 === mesFiltro);

          if (deveMostrar) {
            const idade = dataNasc ? hoje.getFullYear() - dataNasc.getFullYear() : null;
            const sexo = pai.tipo === 'mae' ? 'F' : 'M';
            const tipoExibicao = pai.tipo === 'mae' ? 'Mãe' : 'Pai';
            aniversariantesInMemoriam.push({
              tipo: tipoExibicao,
              nome: pai.nome,
              sexo,
              proximo_aniversario: proximoAniv,
              data_nascimento: dataNasc,
              data_falecimento: pai.data_obito ? new Date(pai.data_obito + 'T00:00:00') : null,
              idade,
              irmao_responsavel: pai.irmaos?.nome,
              nivel: 3,
              falecido: true
            });
          }
        });
      }

      // FILHOS FALECIDOS de irmãos VIVOS
      let filhosFalecidos = filhosFalecidosRaw;

      if (errorFilhosFalecidos) {
        console.error('❌ Erro ao buscar filhos falecidos:', errorFilhosFalecidos);
        filhosFalecidos = [];
      }
      
      // Filtrar apenas os falecidos (vivo = false OU data_obito preenchida)
      filhosFalecidos = filhosFalecidos?.filter(f => {
        if (f.vivo === false) return true;
        if (f.data_obito && f.data_obito !== '' && f.data_obito !== null) return true;
        return false;
      }) || [];
      
      console.log('✅ Filhos falecidos:', filhosFalecidos?.length);

      if (filhosFalecidos) {
        filhosFalecidos.forEach(filho => {
          if (filho.irmaos?.situacao === 'falecido') return;
          const dataRef = filho.data_nascimento;
          if (!dataRef) return;

          const dataBase = new Date(dataRef + 'T00:00:00');
          const dataNasc = filho.data_nascimento ? new Date(filho.data_nascimento + 'T00:00:00') : dataBase;
          const proximoAniv = new Date(hoje.getFullYear(), dataBase.getMonth(), dataBase.getDate());
          
          const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
          if (proximoAniv < hojeZerado) proximoAniv.setFullYear(hoje.getFullYear() + 1);

          const ehHoje = proximoAniv.getDate() === hoje.getDate() && 
                        proximoAniv.getMonth() === hoje.getMonth() &&
                        proximoAniv.getFullYear() === hoje.getFullYear();

          const deveMostrar = filtroParam === 'todos' || 
            (filtroParam === 'hoje' && ehHoje) ||
            (filtroParam === 'semana' && proximoAniv <= new Date(hoje.getTime() + 7*24*60*60*1000)) ||
            (filtroParam === 'mes' && proximoAniv.getMonth() === hoje.getMonth()) ||
            (filtroParam === 'mes_especifico' && proximoAniv.getMonth() + 1 === mesFiltro);

          if (deveMostrar) {
            const idade = dataNasc ? hoje.getFullYear() - dataNasc.getFullYear() : null;
            
            // Usar tipo_vinculo do banco, com fallback para lógica antiga
            let tipoExibicao = 'Filho(a)';
            if (filho.tipo_vinculo) {
              // Capitalizar primeira letra
              tipoExibicao = filho.tipo_vinculo.charAt(0).toUpperCase() + filho.tipo_vinculo.slice(1);
            } else if (filho.sexo) {
              tipoExibicao = filho.sexo === 'M' ? 'Filho' : 'Filha';
            }
            
            aniversariantesInMemoriam.push({
              tipo: tipoExibicao,
              nome: filho.nome,
              proximo_aniversario: proximoAniv,
              data_nascimento: dataNasc,
              data_falecimento: filho.data_obito ? new Date(filho.data_obito + 'T00:00:00') : null,
              idade,
              irmao_responsavel: filho.irmaos?.nome,
              nivel: 3,
              falecido: true
            });
          }
        });
      }

      // Ordenar cada nível por data de aniversário
      aniversariantesIrmaos.sort((a, b) => a.proximo_aniversario - b.proximo_aniversario);
      aniversariantesFamiliares.sort((a, b) => a.proximo_aniversario - b.proximo_aniversario);
      aniversariantesInMemoriam.sort((a, b) => a.proximo_aniversario - b.proximo_aniversario);

      // ===== NÍVEL 4: EVENTOS MAÇÔNICOS E CÍVICOS =====
      const aniversariantesEventos = [];
      
      // Buscar eventos cadastrados
      try {
        if (eventosCustomizados && eventosCustomizados.length > 0) {
          eventosCustomizados.forEach(evento => {
            if (!evento.dia || !evento.mes) return;
            
            const proximoEvento = new Date(hoje.getFullYear(), evento.mes - 1, evento.dia);
            
            const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
            if (proximoEvento < hojeZerado) {
              proximoEvento.setFullYear(hoje.getFullYear() + 1);
            }

            const ehHoje = proximoEvento.getDate() === hoje.getDate() && 
                          proximoEvento.getMonth() === hoje.getMonth() &&
                          proximoEvento.getFullYear() === hoje.getFullYear();

            const deveMostrar = filtroParam === 'todos' || 
              (filtroParam === 'hoje' && ehHoje) ||
              (filtroParam === 'semana' && proximoEvento <= new Date(hoje.getTime() + 7*24*60*60*1000)) ||
              (filtroParam === 'mes' && proximoEvento.getMonth() === hoje.getMonth()) ||
              (filtroParam === 'mes_especifico' && proximoEvento.getMonth() + 1 === mesFiltro);

            if (deveMostrar) {
              aniversariantesEventos.push({
                id: evento.id,
                tipo: evento.tipo || 'Evento',
                nome: evento.nome,
                descricao: evento.descricao,
                proximo_aniversario: proximoEvento,
                nivel: 4,
                icone: '📅',
                envio_automatico: evento.envio_automatico || false
              });
            }
          });
        }
      } catch (error) {
        // Tabela ainda não existe, ignorar
        console.log('ℹ️ Tabela eventos_comemorativos não encontrada (será criada futuramente)');
      }
      
      // Buscar ANIVERSÁRIOS DE CASAMENTO das esposas (se o campo existir)
      try {
        if (esposasCasamento) {
          esposasCasamento.forEach(esposa => {
            if (esposa.irmaos?.situacao === 'falecido') return;
            if (!esposa.data_casamento) return;

            const dataCas = new Date(esposa.data_casamento + 'T00:00:00');
            const proximoAniv = new Date(hoje.getFullYear(), dataCas.getMonth(), dataCas.getDate());
            
            const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
            if (proximoAniv < hojeZerado) {
              proximoAniv.setFullYear(hoje.getFullYear() + 1);
            }

            const ehHoje = proximoAniv.getDate() === hoje.getDate() && 
                          proximoAniv.getMonth() === hoje.getMonth() &&
                          proximoAniv.getFullYear() === hoje.getFullYear();

            const deveMostrar = filtroParam === 'todos' || 
              (filtroParam === 'hoje' && ehHoje) ||
              (filtroParam === 'semana' && proximoAniv <= new Date(hoje.getTime() + 7*24*60*60*1000)) ||
              (filtroParam === 'mes' && proximoAniv.getMonth() === hoje.getMonth()) ||
            (filtroParam === 'mes_especifico' && proximoAniv.getMonth() + 1 === mesFiltro);

            if (deveMostrar) {
              const anosDeUniao = hoje.getFullYear() - dataCas.getFullYear();
              aniversariantesFamiliares.push({
                tipo: 'Bodas',
                nome: `${esposa.irmaos?.nome} & ${esposa.nome}`,
                proximo_aniversario: proximoAniv,
                data_nascimento: dataCas,
                idade: anosDeUniao,
                irmao_responsavel: esposa.irmaos?.nome,
                esposa_id: esposa.id,
                irmao_id: esposa.irmao_id,
                email_esposa: esposa.email || null,
                email_irmao: esposa.irmaos?.email || null,
                nivel: 2,
                icone: '💑'
              });
            }
          });
        }
      } catch (error) {
        // Campo data_casamento ainda não existe na tabela esposas
        console.log('ℹ️ Campo data_casamento não encontrado (adicione na tabela esposas futuramente)');
      }
      
      // ===== CONSOLIDAR FAMILIARES DUPLICADOS =====
      // Agrupar por nome + data de nascimento para consolidar duplicatas
      const familiaresMap = new Map();
      
      aniversariantesFamiliares.forEach(familiar => {
        // Normalizar nome: remover espaços extras, lowercase, remover acentos
        const nomeNormalizado = familiar.nome
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove acentos
          .replace(/\s+/g, ' '); // Remove espaços múltiplos
        
        // Criar chave única: nome normalizado + timestamp da data de nascimento
        const timestamp = familiar.data_nascimento.getTime();
        const chave = `${nomeNormalizado}-${timestamp}`;
        
        if (familiaresMap.has(chave)) {
          // Familiar já existe - adicionar vínculo
          const familiarExistente = familiaresMap.get(chave);
          
          // Criar array de vínculos se não existir
          if (!familiarExistente.vinculos) {
            familiarExistente.vinculos = [{
              tipo: familiarExistente.tipo,
              irmao: familiarExistente.irmao_responsavel
            }];
          }
          
          // Adicionar novo vínculo
          familiarExistente.vinculos.push({
            tipo: familiar.tipo,
            irmao: familiar.irmao_responsavel
          });
          
          // Atualizar tipo para mostrar que tem múltiplos vínculos
          const tipos = familiarExistente.vinculos.map(v => v.tipo);
          familiarExistente.tipo = tipos.join(' / ');

          // Se o novo vínculo é Esposa, preservar esposa_id e email
          if (familiar.tipo === 'Esposa') {
            familiarExistente.esposa_id = familiar.esposa_id;
            familiarExistente.email = familiar.email;
          }
          
        } else {
          // Primeiro registro deste familiar
          familiaresMap.set(chave, familiar);
        }
      });
      
      // Converter Map de volta para array
      const familiaresConsolidados = Array.from(familiaresMap.values());
      
      // Reordenar após consolidação
      familiaresConsolidados.sort((a, b) => a.proximo_aniversario - b.proximo_aniversario);
      aniversariantesEventos.sort((a, b) => a.proximo_aniversario - b.proximo_aniversario);

      // Combinar todos em uma lista única mantendo os níveis
      // Deduplicar: se mesmo nome e mesma data, manter Esposa sobre Filha
      const todosRaw = [
        ...aniversariantesIrmaos,
        ...familiaresConsolidados,
        ...aniversariantesEventos,
        ...aniversariantesInMemoriam
      ];

      const todosAniversariantes = todosRaw.reduce((acc, item) => {
        const chave = `${item.nome?.toLowerCase().trim()}_${item.data_nascimento ? new Date(item.data_nascimento).toISOString().split('T')[0] : ''}`;
        const existente = acc.findIndex(a => {
          const c = `${a.nome?.toLowerCase().trim()}_${a.data_nascimento ? new Date(a.data_nascimento).toISOString().split('T')[0] : ''}`;
          return c === chave;
        });
        if (existente === -1) {
          acc.push(item);
        } else {
          // Priorizar Esposa sobre Filha (tem botão de felicitações)
          if (item.tipo === 'Esposa' && acc[existente].tipo !== 'Esposa') {
            acc[existente] = item;
          }
        }
        return acc;
      }, []);

      console.log('🎂 Total Irmãos:', aniversariantesIrmaos.length);
      console.log('🎂 Total Familiares:', aniversariantesFamiliares.length);
      console.log('🎂 Total Eventos:', aniversariantesEventos.length);
      console.log('🎂 Total In Memoriam:', aniversariantesInMemoriam.length);
      console.log('🎂 Total Final:', todosAniversariantes.length);

      setFn(todosAniversariantes);
      setLoading(false);
    } catch (error) {
      console.error('❌ ERRO:', error);
      setAniversariantes([]);
      setLoading(false);
    }
  };

  // ── helpers de estilo ──────────────────────────────────────────
  const inputStyle = {
    width: '100%', padding: '0.6rem 0.85rem', fontSize: '0.875rem',
    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', color: 'var(--color-text)', outline: 'none',
    boxSizing: 'border-box',
  };
  const labelStyle = {
    display: 'block', fontSize: '0.75rem', fontWeight: 600,
    color: 'var(--color-text-muted)', marginBottom: '0.3rem',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  };

  // ── cores por nível ────────────────────────────────────────────
  const nivelConfig = {
    1: { cor: 'var(--color-accent)', corHex: '#c9a84c', label: 'Irmãos',                   icone: '👤' },
    2: { cor: '#10b981',             corHex: '#10b981', label: 'Familiares',                icone: '👨‍👩‍👧‍👦' },
    4: { cor: '#8b5cf6',             corHex: '#8b5cf6', label: 'Eventos Maçônicos e Cívicos', icone: '🔷' },
    3: { cor: 'var(--color-text-muted)', corHex: '#888', label: 'In Memoriam',             icone: '🕊️' },
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '16rem' }}>
        <div style={{
          width: '3rem', height: '3rem', borderRadius: '50%',
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--color-accent)',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  const renderCard = (aniv, index, prefixo) => {
    const hoje = new Date();
    const ehHoje = aniv.proximo_aniversario.toDateString() === hoje.toDateString();
    const cfg = nivelConfig[aniv.nivel] || nivelConfig[1];
    const isInMemoriam = aniv.nivel === 3;

    return (
      <div key={`${prefixo}-${index}`} style={{
        background: 'var(--color-surface)',
        border: `1px solid ${ehHoje ? cfg.corHex : 'var(--color-border)'}`,
        borderLeft: `4px solid ${ehHoje ? '#f59e0b' : cfg.corHex}`,
        borderRadius: 'var(--radius-lg)',
        padding: '1rem',
        boxShadow: ehHoje ? `0 0 12px rgba(245,158,11,0.15)` : 'none',
        transition: 'border-color 0.15s',
        opacity: isInMemoriam ? 0.85 : 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Avatar */}
          {aniv.foto_url ? (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <img
                src={aniv.foto_url}
                alt={aniv.nome}
                style={{
                  width: '52px', height: '52px', borderRadius: '50%',
                  objectFit: 'cover',
                  border: `2px solid ${cfg.corHex}`,
                  filter: isInMemoriam ? 'grayscale(80%)' : 'none',
                }}
              />
              {isInMemoriam && (
                <span style={{ position: 'absolute', top: '-4px', right: '-4px', fontSize: '0.9rem' }}>🕊️</span>
              )}
            </div>
          ) : (
            <div style={{
              width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
              background: ehHoje ? 'rgba(245,158,11,0.15)' : `rgba(${cfg.corHex === '#10b981' ? '16,185,129' : cfg.corHex === '#8b5cf6' ? '139,92,246' : cfg.corHex === '#c9a84c' ? '201,168,76' : '136,136,136'},0.12)`,
              border: `2px solid ${ehHoje ? '#f59e0b' : cfg.corHex}`,
            }}>
              {isInMemoriam ? '🕊️' : aniv.tipo === 'Bodas' ? '💑' : aniv.nivel === 4 ? (aniv.icone || '📅') : obterEmojiPessoa(aniv.idade, aniv.sexo, aniv.tipo?.toLowerCase())}
            </div>
          )}

          {/* Dados */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '0.9rem', fontWeight: 700,
                color: isInMemoriam ? 'var(--color-text-muted)' : 'var(--color-text)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {aniv.nome}
              </span>
              {ehHoje && <span style={{ fontSize: '1.1rem' }}>{isInMemoriam ? '🙏' : '🎉'}</span>}
            </div>

            <div style={{ fontSize: '0.775rem', color: cfg.corHex, fontWeight: 600, marginTop: '0.1rem' }}>
              {aniv.tipo === 'Bodas'
                ? `${aniv.tipo} · ${aniv.idade} anos de união`
                : aniv.nivel === 4
                  ? aniv.tipo
                  : `${aniv.tipo} · ${aniv.idade} anos`}
            </div>

            {aniv.cim && (
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>
                CIM: {aniv.cim}
              </div>
            )}

            {aniv.cargo && (
              <div style={{ fontSize: '0.7rem', color: 'var(--color-accent)', marginTop: '0.1rem' }}>
                {aniv.cargo}
              </div>
            )}

            {aniv.vinculos && aniv.vinculos.length > 1 ? (
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                {aniv.vinculos.map((v, i) => <span key={i}>• {v.tipo} do Ir∴ {v.irmao} </span>)}
              </div>
            ) : aniv.irmao_responsavel && (
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>
                Ir∴ {aniv.irmao_responsavel}
              </div>
            )}

            {aniv.descricao && (
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>
                {aniv.descricao}
              </div>
            )}

            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem', fontWeight: 500 }}>
              📅 {aniv.proximo_aniversario.toLocaleDateString('pt-BR')}
            </div>

            {/* Botão enviar email — só para irmãos com email cadastrado */}
            {aniv.nivel === 1 && aniv.email && (
              <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {emailEnviados[aniv.irmao_id] && (
                  <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>
                    ✅ Já felicitado
                  </span>
                )}
                {podeEnviarEmail ? (
                <button
                  onClick={e => { e.stopPropagation(); setModalEmail(aniv); }}
                  style={{
                    padding: '0.3rem 0.75rem', fontSize: '0.75rem', fontWeight: 600,
                    background: emailEnviados[aniv.irmao_id] ? 'transparent' : 'rgba(201,168,76,0.12)',
                    border: emailEnviados[aniv.irmao_id] ? '1px solid var(--color-border)' : '1px solid rgba(201,168,76,0.4)',
                    borderRadius: 'var(--radius-md)',
                    color: emailEnviados[aniv.irmao_id] ? 'var(--color-text-muted)' : 'var(--color-accent)',
                    cursor: 'pointer',
                  }}>
                  📧 {emailEnviados[aniv.irmao_id] ? 'Enviar novamente' : 'Enviar Parabéns'}
                </button>
                ) : !emailEnviados[aniv.irmao_id] && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    🔒 Sem permissão para enviar
                  </span>
                )}
              </div>
            )}

            {/* Botão enviar email — para esposas/cunhadas (pelo tipo ou pelo esposa_id) */}
            {(aniv.tipo === 'Esposa' || aniv.tipo?.includes('Esposa')) && (
              <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {emailEnviadosEsposas[aniv.esposa_id] && (
                  <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>
                    ✅ Já felicitada
                  </span>
                )}
                {aniv.email ? (
                  podeEnviarEmail ? (
                  <button
                    onClick={e => { e.stopPropagation(); handleEnviarEmailEsposa(aniv); }}
                    disabled={enviandoEmail === `esposa_${aniv.esposa_id}`}
                    style={{
                      padding: '0.3rem 0.75rem', fontSize: '0.75rem', fontWeight: 600,
                      background: emailEnviadosEsposas[aniv.esposa_id] ? 'transparent' : 'rgba(236,72,153,0.10)',
                      border: emailEnviadosEsposas[aniv.esposa_id] ? '1px solid var(--color-border)' : '1px solid rgba(236,72,153,0.4)',
                      borderRadius: 'var(--radius-md)',
                      color: emailEnviadosEsposas[aniv.esposa_id] ? 'var(--color-text-muted)' : '#ec4899',
                      cursor: enviandoEmail === `esposa_${aniv.esposa_id}` ? 'not-allowed' : 'pointer',
                    }}>
                    🌸 {enviandoEmail === `esposa_${aniv.esposa_id}` ? 'Enviando...' : emailEnviadosEsposas[aniv.esposa_id] ? 'Enviar novamente' : 'Enviar Felicitações'}
                  </button>
                  ) : !emailEnviadosEsposas[aniv.esposa_id] && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      🔒 Sem permissão para enviar
                    </span>
                  )
                ) : (
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    📭 Sem e-mail cadastrado
                  </span>
                )}
              </div>
            )}

            {/* Botão enviar — para Bodas */}
            {aniv.tipo === 'Bodas' && (
              <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {emailEnviadosBodas[aniv.esposa_id] && (
                  <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>
                    ✅ Já parabenizados
                  </span>
                )}
                {(aniv.email_irmao || aniv.email_esposa) ? (
                  podeEnviarEmail ? (
                  <button
                    onClick={e => { e.stopPropagation(); handleEnviarBodas(aniv); }}
                    disabled={enviandoEmail === `bodas_${aniv.esposa_id}`}
                    style={{
                      padding: '0.3rem 0.75rem', fontSize: '0.75rem', fontWeight: 600,
                      background: emailEnviadosBodas[aniv.esposa_id] ? 'transparent' : 'rgba(201,168,76,0.12)',
                      border: emailEnviadosBodas[aniv.esposa_id] ? '1px solid var(--color-border)' : '1px solid rgba(201,168,76,0.4)',
                      borderRadius: 'var(--radius-md)',
                      color: emailEnviadosBodas[aniv.esposa_id] ? 'var(--color-text-muted)' : 'var(--color-accent)',
                      cursor: enviandoEmail === `bodas_${aniv.esposa_id}` ? 'not-allowed' : 'pointer',
                    }}>
                    💑 {enviandoEmail === `bodas_${aniv.esposa_id}` ? 'Enviando...' : emailEnviadosBodas[aniv.esposa_id] ? 'Enviar novamente' : 'Parabéns pelas Bodas'}
                  </button>
                  ) : !emailEnviadosBodas[aniv.esposa_id] && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      🔒 Sem permissão para enviar
                    </span>
                  )
                ) : (
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    📭 Nenhum e-mail cadastrado
                  </span>
                )}
              </div>
            )}

            {/* Botão enviar email — Eventos Maçônicos/Cívicos (envio para todos os irmãos ativos) */}
            {aniv.nivel === 4 && aniv.id && (
              <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {emailEnviadosEventos[aniv.id] && (
                  <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>
                    ✅ Já enviado este ano
                  </span>
                )}
                {aniv.envio_automatico && (
                  <span style={{ fontSize: '0.7rem', color: '#8b5cf6', fontWeight: 600 }}>
                    🔁 Envio automático ligado
                  </span>
                )}
                {ehHoje ? (
                  podeEnviarEmail ? (
                    <button
                      onClick={e => { e.stopPropagation(); handleEnviarEmailEvento(aniv); }}
                      disabled={enviandoEventoId === aniv.id}
                      style={{
                        padding: '0.3rem 0.75rem', fontSize: '0.75rem', fontWeight: 600,
                        background: emailEnviadosEventos[aniv.id] ? 'transparent' : 'rgba(139,92,246,0.12)',
                        border: emailEnviadosEventos[aniv.id] ? '1px solid var(--color-border)' : '1px solid rgba(139,92,246,0.4)',
                        borderRadius: 'var(--radius-md)',
                        color: emailEnviadosEventos[aniv.id] ? 'var(--color-text-muted)' : '#8b5cf6',
                        cursor: enviandoEventoId === aniv.id ? 'not-allowed' : 'pointer',
                      }}>
                      📧 {enviandoEventoId === aniv.id ? 'Enviando...' : emailEnviadosEventos[aniv.id] ? 'Enviar novamente' : 'Enviar para todos os Irmãos Ativos'}
                    </button>
                  ) : !emailEnviadosEventos[aniv.id] && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      🔒 Sem permissão para enviar
                    </span>
                  )
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Calcula as semanas (seg-dom) que um mês cobre ────────────────────────
  const obterSemanasDoMes = (ano, mesIndex) => {
    const primeiroDia = new Date(ano, mesIndex, 1);
    const ultimoDia = new Date(ano, mesIndex + 1, 0);

    // Encontrar a segunda-feira da semana que contém o dia 1
    const diaSemanaPrimeiro = primeiroDia.getDay();
    const diasAteSeg = diaSemanaPrimeiro === 0 ? -6 : 1 - diaSemanaPrimeiro;
    let segAtual = new Date(primeiroDia);
    segAtual.setDate(primeiroDia.getDate() + diasAteSeg);

    const semanas = [];
    while (segAtual <= ultimoDia) {
      const dom = new Date(segAtual);
      dom.setDate(segAtual.getDate() + 6);
      semanas.push({
        inicio: new Date(segAtual.getFullYear(), segAtual.getMonth(), segAtual.getDate(), 0, 0, 0, 0),
        fim: new Date(dom.getFullYear(), dom.getMonth(), dom.getDate(), 23, 59, 59, 999),
      });
      segAtual = new Date(segAtual);
      segAtual.setDate(segAtual.getDate() + 7);
    }
    return semanas;
  };

  // ── Cálculo de intervalos por período ────────────────────────────────────
  const calcularIntervalo = (periodo) => {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    switch (periodo) {
      case 'semanal': {
        const semanasDoMes = obterSemanasDoMes(ano, hoje.getMonth());
        let idx = semanaSel;
        if (idx === null || idx === undefined || idx >= semanasDoMes.length) {
          // Semana atual como padrão: encontrar a semana que contém hoje
          const hojeZero = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
          idx = semanasDoMes.findIndex(s => hojeZero >= s.inicio && hojeZero <= s.fim);
          if (idx === -1) idx = 0;
        }
        const semana = semanasDoMes[idx] || semanasDoMes[0];
        const nomesMes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
        return {
          inicio: semana.inicio, fim: semana.fim,
          label: `Semana ${idx + 1} — ${semana.inicio.toLocaleDateString('pt-BR')} — ${semana.fim.toLocaleDateString('pt-BR')} (${nomesMes[hoje.getMonth()]})`,
          totalSemanas: semanasDoMes.length, semanaIdx: idx,
        };
      }
      case 'trimestral': {
        const inicio = new Date(ano, trimestreSel * 3, 1);
        const fim = new Date(ano, trimestreSel * 3 + 3, 0);
        const nomes = ['1º Trim (Jan–Mar)', '2º Trim (Abr–Jun)', '3º Trim (Jul–Set)', '4º Trim (Out–Dez)'];
        return { inicio, fim, label: `${nomes[trimestreSel]} / ${ano}` };
      }
      case 'semestral': {
        const inicio = new Date(ano, semestreSel * 6, 1);
        const fim = new Date(ano, semestreSel * 6 + 6, 0);
        return { inicio, fim, label: `${semestreSel === 0 ? '1º' : '2º'} Semestre / ${ano}` };
      }
      default:
        if (periodo === 'mes_visao') {
          const ano = hoje.getFullYear();
          const inicio = new Date(ano, mesFiltro - 1, 1);
          const fim = new Date(ano, mesFiltro, 0);
          const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
          return { inicio, fim, label: `${nomes[mesFiltro - 1]} / ${ano}` };
        }
        return { inicio: new Date(ano, 0, 1), fim: new Date(ano, 11, 31), label: `Ano ${ano}` };
    }
  };

  const filtrarPorPeriodo = (lista, periodo) => {
    const { inicio, fim } = calcularIntervalo(periodo);
    const hoje = new Date(); hoje.setHours(0,0,0,0);

    return lista.filter(item => {
      const d = item.proximo_aniversario;
      if (!d) return false;
      const data = d instanceof Date ? d : new Date(d);
      // Comparar dia e mês dentro do intervalo, ignorando ano
      const diaMes = new Date(inicio.getFullYear(), data.getMonth(), data.getDate());
      // Para semanal, o intervalo pode cruzar o ano-novo
      if (periodo === 'semanal') {
        return diaMes >= inicio && diaMes <= fim;
      }
      // Para os demais: verificar se mês/dia caem dentro do intervalo
      const mesInicio = inicio.getMonth();
      const mesFim = fim.getMonth();
      const mes = data.getMonth();
      const dia = data.getDate();
      const diaNoIntervalo = new Date(inicio.getFullYear(), mes, dia);
      return diaNoIntervalo >= inicio && diaNoIntervalo <= fim;
    }).sort((a, b) => {
      const getMesDia = (item) => {
        const d = item.proximo_aniversario instanceof Date ? item.proximo_aniversario : new Date(item.proximo_aniversario);
        return d.getMonth() * 100 + d.getDate();
      };
      return getMesDia(a) - getMesDia(b);
    });
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1500px', margin: '0 auto' }}>

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', borderBottom: '2px solid var(--color-border)', paddingBottom: '0' }}>
        {[
          { id: 'festividades', label: '🎂 Festividades' },
          { id: 'visao_geral',  label: '📊 Visão Geral — Comemorativos e Eventos' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setAbaAtiva(tab.id)} style={{
            padding: '0.55rem 1.1rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
            border: 'none', borderBottom: abaAtiva === tab.id ? '2px solid var(--color-accent)' : '2px solid transparent',
            background: 'transparent', color: abaAtiva === tab.id ? 'var(--color-accent)' : 'var(--color-text-muted)',
            marginBottom: '-2px', transition: 'all 0.15s',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Aba Festividades (conteúdo existente) ─────────────── */}
      {abaAtiva === 'festividades' && (<>

      {/* ── Cabeçalho ─────────────────────────────────────────── */}
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)', padding: '1.5rem', marginBottom: '1.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.15rem' }}>
              📅 Datas Comemorativas
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              {aniversariantes.length} data{aniversariantes.length !== 1 ? 's' : ''} encontrada{aniversariantes.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {podeGerenciarEventos && (
<button onClick={() => setModalEventos(true)} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.55rem 1rem', borderRadius: 'var(--radius-md)',
              background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.35)',
              color: '#8b5cf6', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
            }}>
              ⚙️ Gerenciar Eventos
            </button>
)}
            {podeGerarRelatorio && (
<button onClick={gerarRelatorioPDF} disabled={loading} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.55rem 1rem', borderRadius: 'var(--radius-md)',
              background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.35)',
              color: 'var(--color-accent)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
            }}>
              📄 Gerar PDF
            </button>
)}
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { id: 'hoje',   label: '📅 Hoje' },
            { id: 'semana', label: '📆 7 Dias' },
            { id: 'mes',    label: '📊 Este Mês' },
            { id: 'mes_especifico', label: '🗓️ Mês' },
            { id: 'todos',  label: '📋 Todos' },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setFiltro(id)} style={{
              padding: '0.45rem 1rem', borderRadius: 'var(--radius-md)',
              border: filtro === id ? '1px solid rgba(201,168,76,0.4)' : '1px solid var(--color-border)',
              background: filtro === id ? 'rgba(201,168,76,0.12)' : 'var(--color-surface-2)',
              color: filtro === id ? 'var(--color-accent)' : 'var(--color-text-muted)',
              fontSize: '0.85rem', fontWeight: filtro === id ? 600 : 500, cursor: 'pointer',
              transition: 'all 0.15s',
            }}>
              {label}
            </button>
          ))}
          {filtro === 'mes_especifico' && (
            <select value={mesFiltro} onChange={e => setMesFiltro(parseInt(e.target.value))}
              style={{ padding: '0.42rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(201,168,76,0.4)', background: 'var(--color-surface-2)', color: 'var(--color-accent)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
              {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
                .map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* ── Vazio ─────────────────────────────────────────────── */}
      {aniversariantes.length === 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '240px', gap: '0.75rem',
          background: 'var(--color-surface)', border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius-xl)', padding: '2rem',
        }}>
          <div style={{ fontSize: '2.5rem' }}>🎂</div>
          <p style={{ fontWeight: 600, color: 'var(--color-text)' }}>Nenhuma data encontrada</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Tente outro filtro</p>
        </div>
      )}

      {/* ── Grupos por nível ──────────────────────────────────── */}
      {aniversariantes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {[1, 2, 4, 3].map(nivel => {
            const grupo = aniversariantes.filter(a => a.nivel === nivel);
            if (!grupo.length) return null;
            const cfg = nivelConfig[nivel];
            return (
              <div key={nivel}>
                {/* Título do grupo */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  marginBottom: '0.85rem', paddingBottom: '0.6rem',
                  borderBottom: `1px solid var(--color-border)`,
                }}>
                  <span style={{ fontSize: '1.2rem' }}>{cfg.icone}</span>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: cfg.corHex }}>
                    {cfg.label}
                  </span>
                  <span style={{
                    padding: '0.1rem 0.55rem', borderRadius: '999px', fontSize: '0.75rem',
                    fontWeight: 600, background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)', color: 'var(--color-text-muted)',
                  }}>
                    {grupo.length}
                  </span>
                </div>

                {/* Grid de cards */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '0.75rem',
                }}>
                  {grupo.map((aniv, i) => renderCard(aniv, i, `n${nivel}`))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal Gerenciar Eventos ───────────────────────────── */}
      {modalEventos && podeGerenciarEventos && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          padding: '1.5rem', overflowY: 'auto',
        }} onClick={e => e.target === e.currentTarget && setModalEventos(false)}>
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '860px',
            boxShadow: 'var(--shadow-xl)',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-surface-2)',
              borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
            }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>
                ⚙️ Gerenciar Eventos e Datas Especiais
              </h3>
              <button onClick={() => setModalEventos(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-muted)', fontSize: '1.5rem', lineHeight: 1,
              }}>×</button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Formulário novo evento */}
              <div style={{
                background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)', padding: '1.25rem',
              }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '1rem' }}>
                  ➕ Cadastrar Novo Evento
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Nome do Evento *</label>
                    <input style={inputStyle} type="text" value={novoEvento.nome}
                      onChange={e => setNovoEvento({...novoEvento, nome: e.target.value})}
                      placeholder="Ex: Aniversário da Loja" />
                  </div>
                  <div>
                    <label style={labelStyle}>Tipo *</label>
                    <select style={inputStyle} value={novoEvento.tipo}
                      onChange={e => setNovoEvento({...novoEvento, tipo: e.target.value})}>
                      <option value="Maçônico">Maçônico</option>
                      <option value="Cívico">Cívico</option>
                      <option value="Loja">Loja</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Dia *</label>
                    <input style={inputStyle} type="number" min="1" max="31" value={novoEvento.dia}
                      onChange={e => setNovoEvento({...novoEvento, dia: e.target.value})} placeholder="1–31" />
                  </div>
                  <div>
                    <label style={labelStyle}>Mês *</label>
                    <select style={inputStyle} value={novoEvento.mes}
                      onChange={e => setNovoEvento({...novoEvento, mes: e.target.value})}>
                      <option value="">Selecione...</option>
                      {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((m, i) => (
                        <option key={i+1} value={i+1}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Descrição</label>
                    <input style={inputStyle} type="text" value={novoEvento.descricao}
                      onChange={e => setNovoEvento({...novoEvento, descricao: e.target.value})}
                      placeholder="Descrição opcional" />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text)' }}>
                      <input type="checkbox" checked={novoEvento.envio_automatico}
                        onChange={e => setNovoEvento({...novoEvento, envio_automatico: e.target.checked})}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                      📧 Enviar e-mail automaticamente todo ano, na data do evento, para todos os irmãos ativos
                    </label>
                  </div>
                </div>
                <button onClick={salvarEvento} disabled={salvandoEvento} style={{
                  marginTop: '1rem', padding: '0.6rem 1.25rem',
                  borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.875rem',
                  background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)',
                  color: '#10b981', cursor: salvandoEvento ? 'wait' : 'pointer',
                }}>
                  {salvandoEvento ? 'Salvando...' : '💾 Salvar Evento'}
                </button>
              </div>

              {/* Tabela de eventos cadastrados */}
              {eventosCustomizados.length > 0 ? (
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.75rem' }}>
                    📅 Eventos Cadastrados ({eventosCustomizados.length})
                  </h4>
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                          {['Evento', 'Data', 'Tipo', '📧 Auto', 'Ações'].map(h => (
                            <th key={h} style={{ padding: '0.65rem 0.85rem', textAlign: h === 'Evento' ? 'left' : 'center', fontWeight: 600, fontSize: '0.78rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {eventosCustomizados.map((evento, idx) => (
                          <tr key={evento.id} style={{ borderBottom: '1px solid var(--color-border)', background: idx % 2 === 0 ? 'transparent' : 'var(--color-surface-2)' }}>
                            <td style={{ padding: '0.65rem 0.85rem' }}>
                              <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{evento.nome}</div>
                              {evento.descricao && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{evento.descricao}</div>}
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center', fontWeight: 600, color: 'var(--color-text)' }}>{evento.dia}/{evento.mes}</td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                              <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)' }}>
                                {evento.tipo || 'Evento'}
                              </span>
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                              {evento.envio_automatico ? (
                                <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                                  ✅ Ligado
                                </span>
                              ) : (
                                <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                                  — Desligado
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                <button onClick={() => editarEvento(evento)} style={{ padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-accent)', cursor: 'pointer' }}>✏️ Editar</button>
                                <button onClick={() => excluirEvento(evento.id)} style={{ padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-danger)', cursor: 'pointer' }}>🗑️ Excluir</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-lg)', color: 'var(--color-text-muted)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📅</div>
                  <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.25rem' }}>Nenhum evento cadastrado</p>
                  <p style={{ fontSize: '0.85rem' }}>Use o formulário acima para adicionar</p>
                </div>
              )}

              {/* Botão fechar */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
                <button onClick={() => setModalEventos(false)} style={{ padding: '0.6rem 1.25rem', borderRadius: 'var(--radius-md)', fontWeight: 500, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Preview Email ────────────────────────────────── */}
      {modalEmail && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1200,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
          <div style={{
            background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)',
            width: '100%', maxWidth: '520px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ padding: '1.1rem 1.4rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-surface-2)' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', margin: 0 }}>
                📧 Enviar Email de Parabéns
              </h3>
              <button onClick={() => setModalEmail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.5rem', lineHeight: 1 }}>×</button>
            </div>

            {/* Preview */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Dados do envio */}
              <div style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                <div><span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>Para:</span> <span style={{ color: 'var(--color-text)' }}>{modalEmail.nome} &lt;{modalEmail.email}&gt;</span></div>
                <div><span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>Assunto:</span> <span style={{ color: 'var(--color-text)' }}>🎉 Feliz Aniversário, Ir∴ {modalEmail.nome.split(' ')[0]}!</span></div>
                <div><span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>Assinado por:</span> <span style={{ color: 'var(--color-accent)' }}>{chanceler || 'Chanceler'} · {dadosLoja.nome_loja || 'Loja'}</span></div>
              </div>

              {/* Mini preview do email */}
              <div style={{ border: '1px solid #c9a84c', borderRadius: 'var(--radius-md)', overflow: 'hidden', fontSize: '0.82rem' }}>
                <div style={{ height: '4px', background: 'linear-gradient(135deg,#c9a84c,#e8cc7a,#c9a84c)' }}/>
                <div style={{ padding: '1.5rem', background: '#fff', textAlign: 'center', color: '#333', lineHeight: '1.7' }}>
                  {dadosLoja.logo_url && <img src={dadosLoja.logo_url} alt="Logo" style={{ width: '80px', height: '80px', objectFit: 'contain', display: 'block', margin: '0 auto 10px' }}/>}
                  <p style={{ fontWeight: 700, margin: '0 0 10px', fontSize: '0.95rem' }}>Ir∴ {modalEmail.nome.toUpperCase()},</p>
                  <p style={{ margin: '0 0 8px' }}>Parabéns pelos {modalEmail.idade} anos bem vividos.</p>
                  <p style={{ margin: '0 0 8px' }}>Nesta data tão especial, os Irmãos da <strong>{dadosLoja.nome_loja || 'Loja'}</strong> elevam suas preces ao <strong>Grande Arquiteto do Universo</strong> por mais um ano de sua jornada.</p>
                  <p style={{ margin: '0 0 8px' }}>Que a <strong>Sabedoria</strong> ilumine, a <strong>Força</strong> sustente e a <strong>Beleza</strong> adorne cada momento da sua vida.</p>
                  <p style={{ margin: '0 0 14px', fontStyle: 'italic', color: '#888', fontSize: '0.8rem' }}>Saúde, Força e União</p>
                  <div style={{ width: '60px', height: '2px', background: 'linear-gradient(90deg,transparent,#c9a84c,transparent)', margin: '0 auto 12px' }}/>
                  <p style={{ fontWeight: 700, margin: '0', fontSize: '0.9rem' }}>Ir∴ {chanceler || 'Chanceler'}</p>
                  <p style={{ margin: '4px 0 0', color: '#888', fontSize: '0.75rem' }}>Chanceler · {dadosLoja.nome_loja || 'Loja'}</p>
                </div>
                <div style={{ background: 'linear-gradient(135deg,#c9a84c,#e8cc7a,#c9a84c)', padding: '10px', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: '#5a4a1a', fontWeight: 600 }}>{dadosLoja.nome_loja} · Oriente de Paranatinga – MT</p>
                </div>
              </div>

              {/* Aviso já felicitado */}
              {emailEnviados[modalEmail.irmao_id] && (
                <div style={{ padding: '0.6rem 0.85rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: '#10b981' }}>
                  ✅ Este irmão já foi felicitado este ano. Você pode enviar novamente sem problema.
                </div>
              )}

              {/* Aviso se chanceler não encontrado */}
              {!chanceler && (
                <div style={{ padding: '0.6rem 0.85rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: '#b45309' }}>
                  ⚠️ Chanceler não encontrado no Corpo Administrativo do ano atual. Cadastre o cargo para aparecer na assinatura.
                </div>
              )}
            </div>

            {/* Botões */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', background: 'var(--color-surface-2)' }}>
              <button onClick={() => setModalEmail(null)} style={{ padding: '0.55rem 1.1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', fontSize: '0.875rem', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button
                onClick={() => handleEnviarEmail(modalEmail, 'manual')}
                disabled={enviandoEmail === modalEmail.id}
                style={{ padding: '0.55rem 1.25rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-accent)', color: 'white', fontWeight: 600, fontSize: '0.875rem', cursor: enviandoEmail ? 'wait' : 'pointer' }}>
                {enviandoEmail === modalEmail.id ? '📤 Enviando...' : '📧 Confirmar Envio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Editar Evento ───────────────────────────────── */}
      {eventoEditando && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '520px',
            boxShadow: 'var(--shadow-xl)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1.1rem 1.4rem', borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-surface-2)',
              borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>✏️ Editar Evento</h3>
              <button onClick={cancelarEdicao} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.5rem', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Nome do Evento *</label>
                <input style={inputStyle} type="text" value={eventoEditando.nome}
                  onChange={e => setEventoEditando({...eventoEditando, nome: e.target.value})} />
              </div>
              <div>
                <label style={labelStyle}>Tipo *</label>
                <select style={inputStyle} value={eventoEditando.tipo}
                  onChange={e => setEventoEditando({...eventoEditando, tipo: e.target.value})}>
                  <option value="Maçônico">Maçônico</option>
                  <option value="Cívico">Cívico</option>
                  <option value="Loja">Loja</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Dia *</label>
                <input style={inputStyle} type="number" min="1" max="31" value={eventoEditando.dia}
                  onChange={e => setEventoEditando({...eventoEditando, dia: e.target.value})} />
              </div>
              <div>
                <label style={labelStyle}>Mês *</label>
                <select style={inputStyle} value={eventoEditando.mes}
                  onChange={e => setEventoEditando({...eventoEditando, mes: e.target.value})}>
                  <option value="">Selecione...</option>
                  {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((m, i) => (
                    <option key={i+1} value={i+1}>{m}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Descrição</label>
                <input style={inputStyle} type="text" value={eventoEditando.descricao}
                  onChange={e => setEventoEditando({...eventoEditando, descricao: e.target.value})} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text)' }}>
                  <input type="checkbox" checked={eventoEditando.envio_automatico}
                    onChange={e => setEventoEditando({...eventoEditando, envio_automatico: e.target.checked})}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                  📧 Enviar e-mail automaticamente todo ano, na data do evento, para todos os irmãos ativos
                </label>
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button onClick={cancelarEdicao} style={{ padding: '0.6rem 1.1rem', borderRadius: 'var(--radius-md)', fontWeight: 500, background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={atualizarEvento} disabled={salvandoEvento} style={{ padding: '0.6rem 1.25rem', borderRadius: 'var(--radius-md)', fontWeight: 600, background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)', color: 'var(--color-accent)', cursor: salvandoEvento ? 'wait' : 'pointer' }}>
                  {salvandoEvento ? 'Salvando...' : '💾 Salvar Alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </> )}

      {/* ── Aba Visão Geral ───────────────────────────────────── */}
      {abaAtiva === 'visao_geral' && (() => {
        const { label } = calcularIntervalo(periodoRelatorio);
        const todos = todosAniversariantes.length > 0 ? todosAniversariantes : aniversariantes;

        const buscaAtiva = buscaNomeVisaoGeral.trim().length >= 2;
        const normalizar = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const termoBusca = normalizar(buscaNomeVisaoGeral);

        const bateBusca = (item) => {
          if (!buscaAtiva) return true;
          const nomePessoa = normalizar(item.nome);
          const nomeIrmao = normalizar(item.irmao_responsavel);
          return nomePessoa.includes(termoBusca) || nomeIrmao.includes(termoBusca);
        };

        const aplicarFiltro = (lista) => buscaAtiva
          ? lista.filter(bateBusca).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
          : filtrarPorPeriodo(lista, periodoRelatorio);

        const felicitacoes  = aplicarFiltro(todos.filter(a => (a.tipo === 'Irmão' || a.tipo?.includes('Esposa') || a.tipo === 'Esposa') && a.nivel !== 3 && !a.falecido));
        const familia       = aplicarFiltro(todos.filter(a => ehFamilia(a) && a.nivel !== 3 && !a.falecido));
        const comemorativas = buscaAtiva ? [] : filtrarPorPeriodo(todos.filter(a => a.nivel === 4), periodoRelatorio);
        const inMemoriam    = aplicarFiltro(todos.filter(a => a.nivel === 3));

        const fmtData = (d) => {
          if (!d) return '—';
          const dt = d instanceof Date ? d : new Date(d);
          return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        };

        // Abrevia nome: pega os 2 primeiros nomes; se o 2º for preposição, usa o último nome
        const PREPOSICOES = ['de', 'da', 'do', 'das', 'dos', 'e'];
        const abreviarNome = (nomeCompleto) => {
          if (!nomeCompleto) return nomeCompleto;
          const partes = nomeCompleto.trim().split(/\s+/);
          if (partes.length <= 2) return nomeCompleto;
          const segundo = partes[1].toLowerCase();
          if (PREPOSICOES.includes(segundo)) {
            return `${partes[0]} ${partes[partes.length - 1]}`;
          }
          return `${partes[0]} ${partes[1]}`;
        };

        // Para registros de Bodas, abrevia cada lado do "&" separadamente
        const abreviarNomeExibicao = (item) => {
          const nome = item.nome || '';
          if (item.tipo === 'Bodas' && nome.includes(' & ')) {
            const [ladoIrmao, ladoEsposa] = nome.split(' & ');
            return `${abreviarNome(ladoIrmao)} & ${abreviarNome(ladoEsposa)}`;
          }
          // Irmãos, Cunhadas (Esposa) e In Memoriam (Irmão/Esposa/Cunhada) são abreviados
          if (item.tipo === 'Irmão' || item.tipo === 'Esposa' || item.tipo?.includes('Esposa') || item.tipo === 'Cunhada') {
            return abreviarNome(nome);
          }
          return nome;
        };

        const hoje2 = new Date(); hoje2.setHours(0,0,0,0);

        const isPassado = (item) => {
          const d = item.proximo_aniversario;
          if (!d) return false;
          const data = d instanceof Date ? d : new Date(d);
          const diaMes = new Date(hoje2.getFullYear(), data.getMonth(), data.getDate());
          return diaMes < hoje2;
        };

        const gerarPDFVisaoGeral = (felic, fam, com, inMem, labelPeriodo) => {
          if (!podeGerarRelatorio) return;
          const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
          const margin = 14; const colRight = 196; let y = 14;
          const nomesLoja = dadosLoja?.nome_loja || 'ARLS Acácia de Paranatinga nº 30';

          const txt = (text, x, yy, opts = {}) => {
            doc.setFontSize(opts.size || 9); doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
            if (opts.color) doc.setTextColor(...opts.color); else doc.setTextColor(30, 30, 30);
            doc.text(String(text), x, yy, { align: opts.align || 'left', maxWidth: opts.maxWidth });
            doc.setTextColor(30, 30, 30);
          };

          // Cabeçalho
          doc.setFillColor(30, 58, 95); doc.roundedRect(margin, y, colRight - margin, 14, 2, 2, 'F');
          txt('Relatorio de Comemorativos e Eventos', margin + 3, y + 5.5, { bold: true, size: 11, color: [255,255,255] });
          txt(labelPeriodo, colRight - 3, y + 5.5, { size: 8, color: [180,210,255], align: 'right' });
          txt(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, colRight - 3, y + 10.5, { size: 7, color: [150,190,230], align: 'right' });
          y += 18;

          const renderTabela = (titulo, dados, colunas, corRgb) => {
            if (dados.length === 0) return;
            if (y > 240) { doc.addPage(); y = 14; }
            doc.setFillColor(...corRgb); doc.roundedRect(margin, y, colRight - margin, 7, 1, 1, 'F');
            txt(titulo, margin + 3, y + 4.8, { bold: true, size: 9, color: [255,255,255] });
            txt(`${dados.length} registro${dados.length !== 1 ? 's' : ''}`, colRight - 3, y + 4.8, { size: 8, color: [220,230,255], align: 'right' });
            y += 9;
            // header cols
            doc.setFillColor(240, 242, 248); doc.rect(margin, y, colRight - margin, 5.5, 'F');
            colunas.forEach(c => txt(c.label, c.x, y + 3.8, { size: 7, bold: true, color: [80,80,120] }));
            y += 6;
            dados.forEach((item, idx) => {
              if (y > 270) { doc.addPage(); y = 14; }
              if (idx % 2 === 0) { doc.setFillColor(248,249,252); doc.rect(margin, y - 1, colRight - margin, 6.5, 'F'); }
              colunas.forEach(c => {
                const corCol = typeof c.color === 'function' ? c.color(item) : c.color;
                txt(c.render ? c.render(item) : String(item[c.key] || '—'), c.x, y + 3.5, { size: 7.5, bold: c.bold, maxWidth: c.maxWidth, color: corCol });
              });
              y += 6.5;
            });
            y += 4;
          };

          const fmtD = (item) => {
            const d = item.proximo_aniversario;
            if (!d) return '—';
            const dt = d instanceof Date ? d : new Date(d);
            return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          };

          renderTabela('Felicitacoes - Irmaos e Cunhadas', felic, [
            { label: 'DATA', x: margin + 2, render: fmtD },
            { label: 'NOME', x: margin + 20, render: i => {
                const nome = abreviarNomeExibicao(i);
                return i.tipo !== 'Irmão' && i.irmao_responsavel ? `${nome} (Ir. ${abreviarNome(i.irmao_responsavel)})` : nome;
              }, bold: true, maxWidth: 95, color: i => i.tipo === 'Irmão' ? [37,99,235] : [219,39,119] },
            { label: 'TIPO', x: margin + 125, render: i => i.tipo === 'Irmão' ? 'Irmao' : 'Cunhada' },
            { label: 'IDADE', x: margin + 160, render: i => i.idade ? `${i.idade} anos` : '—' },
          ], [30, 70, 130]);

          renderTabela('Familia - Pais, Filhos, Netos e Bodas', fam, [
            { label: 'DATA', x: margin + 2, render: fmtD },
            { label: 'NOME', x: margin + 20, render: i => abreviarNomeExibicao(i), bold: true, maxWidth: 65,
              color: i => i.tipo === 'Bodas' ? [201,168,76] : null },
            { label: 'TIPO', x: margin + 95, key: 'tipo' },
            { label: 'IRMAO RESP.', x: margin + 130, render: i => i.irmao_responsavel ? `Ir. ${abreviarNome(i.irmao_responsavel)}` : '—', maxWidth: 60 },
          ], [16, 120, 90]);

          renderTabela('Datas Comemorativas', com, [
            { label: 'DATA', x: margin + 2, render: fmtD },
            { label: 'EVENTO', x: margin + 20, key: 'nome', bold: true, maxWidth: 100 },
            { label: 'TIPO', x: margin + 130, key: 'tipo' },
          ], [200, 130, 10]);

          renderTabela('In Memoriam', inMem, [
            { label: 'DATA', x: margin + 2, render: fmtD },
            { label: 'NOME', x: margin + 20, render: i => abreviarNomeExibicao(i), bold: true, maxWidth: 60,
              color: i => (i.tipo === 'Irmão') ? [37,99,235] : (i.tipo === 'Esposa' || i.tipo?.includes('Esposa')) ? [219,39,119] : null },
            { label: 'PARENTESCO', x: margin + 90, key: 'tipo' },
            { label: 'REF.', x: margin + 135, render: i => i.irmao_responsavel ? `Ir. ${abreviarNome(i.irmao_responsavel)}` : '—', maxWidth: 55 },
          ], [120, 120, 130]);

          const total = doc.internal.getNumberOfPages();
          for (let i = 1; i <= total; i++) {
            doc.setPage(i); doc.setFontSize(7); doc.setTextColor(150,150,160);
            doc.text(`Pagina ${i} de ${total}`, colRight - 3, 290, { align: 'right' });
            doc.text(`SysMacom - ${nomesLoja}`, margin, 290);
          }
          doc.save(`comemorativos-${labelPeriodo.replace(/[^a-zA-Z0-9]/g,'-')}.pdf`);
        };

        const TabelaSection = ({ titulo, cor, dados, colunas }) => dados.length === 0 ? null : (
          <div style={{ marginBottom: '1.5rem', borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: `1px solid ${cor}40` }}>
            <div style={{ background: `${cor}18`, padding: '0.65rem 1rem', borderBottom: `1px solid ${cor}30`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.88rem', color: cor }}>{titulo}</span>
              <span style={{ fontSize: '0.75rem', color: cor, background: `${cor}20`, padding: '0.15rem 0.55rem', borderRadius: '999px', fontWeight: 600 }}>{dados.length} registro{dados.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-2)' }}>
                    {colunas.map(c => <th key={c.key} style={{ padding: '0.45rem 0.75rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {dados.map((item, idx) => {
                    const passou = isPassado(item);
                    return (
                    <tr key={idx} style={{ borderTop: '1px solid var(--color-border)', background: passou ? 'rgba(0,0,0,0.04)' : idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)', opacity: passou ? 0.6 : 1 }}>
                      {colunas.map(c => (
                        <td key={c.key} style={{ padding: '0.5rem 0.75rem', color: passou ? 'var(--color-text-muted)' : c.color || 'var(--color-text)', fontWeight: c.bold ? 700 : 400, whiteSpace: c.nowrap ? 'nowrap' : 'normal' }}>
                          {c.render ? c.render(item) : item[c.key] || '—'}
                        </td>
                      ))}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );

        return (
          <div>
            {/* Busca por nome */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '0.85rem 1.25rem', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1rem' }}>🔍</span>
              <input
                type="text"
                value={buscaNomeVisaoGeral}
                onChange={e => setBuscaNomeVisaoGeral(e.target.value)}
                placeholder="Buscar por nome do irmão... (mostra todos os vínculos: esposa, pais, filhos, in memoriam)"
                style={{
                  flex: 1, padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface-2)', color: 'var(--color-text)',
                  border: '1px solid var(--color-border)', fontSize: '0.85rem', outline: 'none',
                }}
              />
              {buscaNomeVisaoGeral && (
                <button onClick={() => setBuscaNomeVisaoGeral('')} style={{
                  padding: '0.4rem 0.7rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                  border: '1px solid var(--color-border)', background: 'var(--color-surface-2)',
                  color: 'var(--color-text-muted)', borderRadius: 'var(--radius-md)',
                }}>
                  ✕ Limpar
                </button>
              )}
            </div>

            {/* Seletor de período — oculto durante busca por nome */}
            {!buscaAtiva && (
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: periodoRelatorio === 'trimestral' || periodoRelatorio === 'semestral' ? '0.75rem' : 0 }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text)' }}>📅 Período:</span>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {[
                    { id: 'semanal',      label: '📆 Semanal' },
                    { id: 'mes_visao',    label: '📅 Mensal' },
                    { id: 'trimestral',   label: '📊 Trimestral' },
                    { id: 'semestral',    label: '📈 Semestral' },
                    { id: 'anual',        label: '🗓️ Anual' },
                  ].map(p => (
                    <button key={p.id} onClick={() => setPeriodoRelatorio(p.id)} style={{
                      padding: '0.38rem 0.85rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                      border: periodoRelatorio === p.id ? '1px solid rgba(201,168,76,0.5)' : '1px solid var(--color-border)',
                      background: periodoRelatorio === p.id ? 'rgba(201,168,76,0.12)' : 'var(--color-surface-2)',
                      color: periodoRelatorio === p.id ? 'var(--color-accent)' : 'var(--color-text-muted)',
                      borderRadius: 'var(--radius-md)', transition: 'all 0.15s',
                    }}>{p.label}</button>
                  ))}
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>📍 {label}</span>
                {podeGerarRelatorio && (
<button onClick={() => gerarPDFVisaoGeral(felicitacoes, familia, comemorativas, inMemoriam, label)}
                  style={{ padding: '0.38rem 0.85rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.1)', color: '#6366f1', borderRadius: 'var(--radius-md)' }}>
                  📄 Gerar PDF
                </button>
)}
              </div>
              {/* Seletor de semana do mês atual */}
              {periodoRelatorio === 'semanal' && (() => {
                const hoje = new Date();
                const semanasDoMes = obterSemanasDoMes(hoje.getFullYear(), hoje.getMonth());
                const nomesMes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
                return (
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', paddingTop: '0.6rem', borderTop: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Semana de {nomesMes[hoje.getMonth()]}:</span>
                    {semanasDoMes.map((s, i) => {
                      const ativo = (semanaSel === null ? calcularIntervalo('semanal').semanaIdx : semanaSel) === i;
                      return (
                        <button key={i} onClick={() => setSemanaSel(i)} style={{
                          padding: '0.3rem 0.65rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                          border: ativo ? '1px solid rgba(201,168,76,0.5)' : '1px solid var(--color-border)',
                          background: ativo ? 'rgba(201,168,76,0.12)' : 'var(--color-surface-2)',
                          color: ativo ? 'var(--color-accent)' : 'var(--color-text-muted)',
                          borderRadius: 'var(--radius-md)',
                        }}>
                          Semana {i + 1}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Seletor de mês específico */}
              {periodoRelatorio === 'mes_visao' && (
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', paddingTop: '0.6rem', borderTop: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 600, alignSelf: 'center' }}>Mês:</span>
                  {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((m, i) => (
                    <button key={i+1} onClick={() => setMesFiltro(i+1)} style={{
                      padding: '0.3rem 0.65rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                      border: mesFiltro === i+1 ? '1px solid rgba(201,168,76,0.5)' : '1px solid var(--color-border)',
                      background: mesFiltro === i+1 ? 'rgba(201,168,76,0.12)' : 'var(--color-surface-2)',
                      color: mesFiltro === i+1 ? 'var(--color-accent)' : 'var(--color-text-muted)',
                      borderRadius: 'var(--radius-md)',
                    }}>{m.slice(0,3)}</button>
                  ))}
                </div>
              )}

              {/* Seletor de trimestre */}
              {periodoRelatorio === 'trimestral' && (
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', paddingTop: '0.6rem', borderTop: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 600, alignSelf: 'center' }}>Trimestre:</span>
                  {[['1º Trim (Jan–Mar)',0],['2º Trim (Abr–Jun)',1],['3º Trim (Jul–Set)',2],['4º Trim (Out–Dez)',3]].map(([l,v]) => (
                    <button key={v} onClick={() => setTrimestreSel(v)} style={{
                      padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                      border: trimestreSel === v ? '1px solid rgba(201,168,76,0.5)' : '1px solid var(--color-border)',
                      background: trimestreSel === v ? 'rgba(201,168,76,0.12)' : 'var(--color-surface-2)',
                      color: trimestreSel === v ? 'var(--color-accent)' : 'var(--color-text-muted)',
                      borderRadius: 'var(--radius-md)',
                    }}>{l}</button>
                  ))}
                </div>
              )}
              {/* Seletor de semestre */}
              {periodoRelatorio === 'semestral' && (
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', paddingTop: '0.6rem', borderTop: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 600, alignSelf: 'center' }}>Semestre:</span>
                  {[['1º Semestre (Jan–Jun)',0],['2º Semestre (Jul–Dez)',1]].map(([l,v]) => (
                    <button key={v} onClick={() => setSemestreSel(v)} style={{
                      padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                      border: semestreSel === v ? '1px solid rgba(201,168,76,0.5)' : '1px solid var(--color-border)',
                      background: semestreSel === v ? 'rgba(201,168,76,0.12)' : 'var(--color-surface-2)',
                      color: semestreSel === v ? 'var(--color-accent)' : 'var(--color-text-muted)',
                      borderRadius: 'var(--radius-md)',
                    }}>{l}</button>
                  ))}
                </div>
              )}
            </div>
            )}

            {/* Indicador de busca ativa */}
            {buscaAtiva && (
              <div style={{ marginBottom: '1.25rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                Mostrando todos os vínculos para <strong style={{ color: 'var(--color-text)' }}>"{buscaNomeVisaoGeral}"</strong>, sem filtro de período.
              </div>
            )}

            {/* Tabela 1 — Felicitações */}
            <TabelaSection
              titulo="🎉 Felicitações — Irmãos e Cunhadas"
              cor="#6366f1"
              dados={felicitacoes}
              colunas={[
                { key: 'data', label: 'Data', nowrap: true, render: i => fmtData(i.proximo_aniversario) },
                { key: 'nome', label: 'Nome', bold: true, render: i => (
                  <span style={{ color: i.tipo === 'Irmão' ? '#3b82f6' : '#ec4899', fontWeight: 700 }}>
                    {abreviarNomeExibicao(i)}
                  </span>
                )},
                { key: 'tipo', label: 'Tipo', render: i => (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px',
                    background: i.tipo === 'Irmão' ? 'rgba(59,130,246,0.12)' : 'rgba(236,72,153,0.12)',
                    color: i.tipo === 'Irmão' ? '#3b82f6' : '#ec4899' }}>
                    {i.tipo === 'Irmão' ? '👤 Irmão' : '🌸 Cunhada'}
                  </span>
                )},
                { key: 'idade', label: 'Idade', render: i => i.idade ? `${i.idade} anos` : '—', nowrap: true },
              ]}
            />

            {/* Tabela 2 — Família */}
            <TabelaSection
              titulo="👨‍👩‍👧‍👦 Família — Pais, Filhos, Netos e Bodas"
              cor="#10b981"
              dados={familia}
              colunas={[
                { key: 'data', label: 'Data', nowrap: true, render: i => fmtData(i.proximo_aniversario) },
                { key: 'nome', label: 'Nome', bold: true, render: i => (
                  i.tipo === 'Bodas'
                    ? <span style={{ color: '#c9a84c', fontWeight: 700 }}>{abreviarNomeExibicao(i)}</span>
                    : <span>{abreviarNomeExibicao(i)}</span>
                )},
                { key: 'tipo', label: 'Tipo', render: i => (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px',
                    background: i.tipo === 'Bodas' ? 'rgba(201,168,76,0.12)' : 'rgba(16,185,129,0.12)',
                    color: i.tipo === 'Bodas' ? '#c9a84c' : '#10b981' }}>
                    {i.tipo}
                  </span>
                )},
                { key: 'irmao_responsavel', label: 'Irmão Responsável', render: i => i.irmao_responsavel ? `Ir∴ ${abreviarNome(i.irmao_responsavel)}` : '—' },
                { key: 'idade', label: 'Anos', render: i => i.tipo === 'Bodas' ? `${i.idade} anos de união` : i.idade ? `${i.idade} anos` : '—', nowrap: true },
              ]}
            />

            {/* Tabela 3 — Datas Comemorativas */}
            <TabelaSection
              titulo="📅 Datas Comemorativas"
              cor="#f59e0b"
              dados={comemorativas}
              colunas={[
                { key: 'data', label: 'Data', nowrap: true, render: i => fmtData(i.proximo_aniversario) },
                { key: 'nome', label: 'Evento', bold: true },
                { key: 'tipo', label: 'Tipo', render: i => (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px', background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                    {i.tipo || 'Evento'}
                  </span>
                )},
              ]}
            />

            {/* Tabela 4 — In Memoriam */}
            <TabelaSection
              titulo="🕊️ In Memoriam"
              cor="#94a3b8"
              dados={inMemoriam}
              colunas={[
                { key: 'data', label: 'Aniversário', nowrap: true, render: i => fmtData(i.proximo_aniversario) },
                { key: 'nome', label: 'Nome', bold: true, render: i => (
                  <div>
                    <div>{abreviarNomeExibicao(i)}</div>
                    {i.data_falecimento && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 400, marginTop: '0.1rem' }}>
                        🕊️ Falecimento: {(i.data_falecimento instanceof Date ? i.data_falecimento : new Date(i.data_falecimento)).toLocaleDateString('pt-BR')}
                      </div>
                    )}
                  </div>
                )},
                { key: 'tipo', label: 'Parentesco', render: i => (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px', background: 'rgba(148,163,184,0.15)', color: '#94a3b8' }}>
                    {i.tipo || '—'}
                  </span>
                )},
                { key: 'irmao_responsavel', label: 'Referência', render: i => i.irmao_responsavel ? `Ir∴ ${abreviarNome(i.irmao_responsavel)}` : '—' },
                { key: 'idade', label: 'Idade', render: i => i.idade ? `${i.idade} anos` : '—', nowrap: true },
              ]}
            />

            {felicitacoes.length === 0 && familia.length === 0 && comemorativas.length === 0 && inMemoriam.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                Nenhum registro encontrado para o período selecionado.
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
