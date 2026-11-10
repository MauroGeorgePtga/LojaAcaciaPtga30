// Cálculo do rateio de Ágape & Festas com custeio.
//
// Regras:
//  - Valor da cota: calculado como sempre (fora daqui).
//  - Evento: "custeio_percentual_irmao" = % que cada irmão paga da própria FAMÍLIA (ex.: 50).
//    O restante (100 - %) é a fatia padrão dos CUSTEADORES (ex.: 50), dividida igualmente entre eles.
//  - Custeador: paga 100% da própria família e dos convidados (sem desconto) + a sua parte do custeio.
//  - Irmão comum: paga o % do evento, ou o % próprio (percentual_proprio > 0), ou 0% se isento.
//    Os custeadores continuam com a fatia padrão; a diferença que sobrar é da LOJA
//    (ex.: irmão 10% → custeadores 50% + Loja 40%; isento → custeadores 50% + Loja 50%).
//    Isento "somente Loja" (isento_loja): a Loja paga 100% da família; os custeadores não participam.
//    Se o irmão pagar mais que o padrão, a fatia dos custeadores diminui (nunca passa de 100%).
//  - CONVIDADOS DO IRMÃO (conv_adultos / conv_meia): ficam fora de qualquer desconto, isenção ou custeio:
//    o irmão paga 100% deles (custeadores e Loja nunca pagam).
//  - Sem custeadores marcados: a fatia dos custeadores também fica com a Loja.
//  - Convidados externos/visitantes: como sempre (entram nas cotas; não geram cobrança).
//  - Arredondamento: o irmão paga o valor arredondado em centavos e a diferença de centavos
//    fica na parte dos custeadores. Sobra de centavos na divisão entre custeadores: para o primeiro.

const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

export const custeioAtivo = (evento) => {
  const p = parseFloat(evento?.custeio_percentual_irmao);
  return !isNaN(p) && p > 0 && p < 100;
};

// Cotas dos convidados do irmão (adulto = 1 cota; criança 6–11 = meia; até 5 = gratuita)
export const cotasConvidados = (p) =>
  (parseInt(p?.conv_adultos) || 0) + (parseInt(p?.conv_meia) || 0) * 0.5;

// Participante sem nada a cobrar (isento e sem convidados pagos por ele)
export const semCobranca = (p) => !!(p?.irmao_id && p.isento && cotasConvidados(p) <= 0);

export function calcularRateio(participantes, valorCota, evento) {
  const lista = participantes || [];
  const ativo = custeioAtivo(evento) && valorCota > 0;
  const pEvento = ativo ? parseFloat(evento.custeio_percentual_irmao) : 100;
  const fatiaCusteio = ativo ? 100 - pEvento : 0;

  const custeadores = ativo ? lista.filter((p) => p.irmao_id && p.custeador) : [];
  const porParticipante = {};
  let pool = 0;        // quanto os custeadores pagam pelas famílias dos irmãos
  let lojaIrmaos = 0;  // parte da Loja nas famílias dos irmãos

  lista.forEach((p) => {
    const custo = r2(parseFloat(p.cotas || 0) * valorCota);
    const custoConvidados = p.irmao_id ? r2(cotasConvidados(p) * valorCota) : 0;
    const custoFamilia = r2(custo - custoConvidados);

    const item = {
      custo, custoFamilia, custoConvidados,
      pagaProprio: custo, pagaFamilia: custoFamilia,
      parteCusteio: 0, parteLoja: 0, recebeCusteio: 0, pctProprio: 100,
      custeador: !!(ativo && p.irmao_id && p.custeador),
      total: custo,
    };

    if (ativo && p.irmao_id && !p.custeador) {
      const ov = parseFloat(p.percentual_proprio);
      const isentoLoja = !!p.isento && !!p.isento_loja;
      const pProprio = p.isento ? 0 : (ov > 0 ? Math.min(ov, 100) : pEvento);
      const fatiaCust = isentoLoja ? 0 : Math.min(fatiaCusteio, 100 - pProprio);
      const fatiaLoja = 100 - pProprio - fatiaCust;

      const pagaFamilia = r2(custoFamilia * pProprio / 100);
      const parteLoja = r2(custoFamilia * fatiaLoja / 100);
      let parteCusteio = r2(custoFamilia - pagaFamilia - parteLoja); // absorve o arredondamento

      let lojaFinal = parteLoja;
      if (custeadores.length === 0) { lojaFinal = r2(parteLoja + parteCusteio); parteCusteio = 0; }

      item.pctProprio = pProprio;
      item.pagaFamilia = pagaFamilia;
      item.pagaProprio = r2(pagaFamilia + custoConvidados); // família + convidados (100%)
      item.parteLoja = lojaFinal;
      item.parteCusteio = parteCusteio;
      item.total = item.pagaProprio;
      item.isento = !!p.isento;
      item.isentoLoja = isentoLoja;
      item.personalizado = !p.isento && ov > 0;
      pool += parteCusteio;
      lojaIrmaos += lojaFinal;
    }
    porParticipante[p.id] = item;
  });

  // Divisão igual entre custeadores (em centavos; sobra para os primeiros)
  const n = custeadores.length;
  if (n > 0) {
    const poolCent = Math.round(pool * 100);
    const base = Math.floor(poolCent / n);
    let resto = poolCent - base * n;
    custeadores.forEach((c) => {
      const cent = base + (resto > 0 ? 1 : 0);
      if (resto > 0) resto -= 1;
      const parte = cent / 100;
      const it = porParticipante[c.id];
      it.recebeCusteio = parte;
      it.total = r2(it.custo + parte);
    });
  }

  const externosCusto = lista.filter((p) => !p.irmao_id).reduce((s, p) => s + porParticipante[p.id].custo, 0);
  const totalRateio = lista.reduce((s, p) => s + porParticipante[p.id].custo, 0);
  const cobradoIrmaos = lista.filter((p) => p.irmao_id).reduce((s, p) => s + porParticipante[p.id].total, 0);

  return {
    ativo, pEvento, fatiaCusteio, numCusteadores: n,
    porParticipante,
    resumo: {
      totalRateio: r2(totalRateio),
      cobradoIrmaos: r2(cobradoIrmaos),
      custeioPool: r2(pool),
      lojaIrmaos: r2(lojaIrmaos),
      externos: r2(externosCusto),
      lojaTotal: r2(lojaIrmaos + externosCusto),
    },
  };
}

// Sufixo de descrição dos lançamentos (reconhecido ao recalcular, para não duplicar)
const fmtBRL = (v) => (parseFloat(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const SUFIXO_RE = /\s\((?:própria|família) [^)]*\)$/;

export const descricaoComCusteio = (descricaoBase, item) => {
  const base = String(descricaoBase || '').replace(SUFIXO_RE, '');
  if (!item) return base;
  if (item.recebeCusteio > 0) {
    return `${base} (própria ${fmtBRL(item.custo)} + custeio famílias ${fmtBRL(item.recebeCusteio)})`;
  }
  if (item.custoConvidados > 0) {
    return `${base} (família ${fmtBRL(item.pagaFamilia)} + convidados ${fmtBRL(item.custoConvidados)})`;
  }
  return base;
};
