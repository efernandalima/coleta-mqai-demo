// Situação de cada aldeia/sistema num mês: pendente → aguardando análise → analisada → enviada.
// Módulo puro: roda no navegador e nos testes (Node).
import { etapaDaColeta } from "./etapas.js";
import { foraDoPadrao } from "./validacao.js";

export const ETAPAS_PAINEL = ["pendente", "coletada", "analisada", "enviada"];

/** Mais recente primeiro (data da coleta e, no empate, a última alteração). */
const maisRecente = (a, b) =>
  (b.dataColeta || "").localeCompare(a.dataColeta || "") || (b.atualizadoEm || "").localeCompare(a.atualizadoEm || "");

/**
 * Para cada sistema, a coleta mais recente do mês e a etapa dela.
 * Retorna [{ sistema, coleta, etapa, foraDoPadrao, quantidade }].
 */
export function situacaoDoMes(sistemas, coletas, mes) {
  return sistemas.map((s) => {
    const doMes = coletas.filter((c) => c.mes === mes && Number(c.linha) === s.linha).sort(maisRecente);
    const coleta = doMes[0] || null;
    const etapa = coleta ? etapaDaColeta(coleta) : "pendente";
    return {
      sistema: s,
      coleta,
      etapa,
      // Só conta "fora do padrão" depois da análise concluída (antes os resultados estão incompletos).
      foraDoPadrao: !!coleta && etapa !== "coletada" && foraDoPadrao(coleta).length > 0,
      quantidade: doMes.length,
    };
  });
}

/** true se a análise foi concluída (esteja ou não na planilha). */
export const foiAnalisada = (x) => x.etapa === "analisada" || x.etapa === "enviada";

/**
 * { pendente, coletada, analisadas, aEnviar, enviada, foraDoPadrao, total }
 * "analisadas" inclui as que já estão na planilha; "aEnviar" são as analisadas que ainda não foram.
 */
export function contarEtapas(situacao) {
  const n = { pendente: 0, coletada: 0, analisadas: 0, aEnviar: 0, enviada: 0, foraDoPadrao: 0, total: situacao.length };
  situacao.forEach((x) => {
    if (x.etapa === "pendente") n.pendente++;
    if (x.etapa === "coletada") n.coletada++;
    if (foiAnalisada(x)) n.analisadas++;
    if (x.etapa === "analisada") n.aEnviar++;
    if (x.etapa === "enviada") n.enviada++;
    if (x.foraDoPadrao) n.foraDoPadrao++;
  });
  return n;
}

/** Filtro da tela: "analisada" mostra também as que já estão na planilha. */
export function filtrarSituacao(situacao, filtro) {
  if (filtro === "todas") return situacao;
  if (filtro === "analisada") return situacao.filter(foiAnalisada);
  return situacao.filter((x) => x.etapa === filtro);
}

/** Agrupa por polo, mantendo a ordem da planilha. */
export function agruparPorPolo(situacao) {
  const grupos = new Map();
  situacao.forEach((x) => {
    const polo = (x.sistema.polo || "Sem polo").trim();
    if (!grupos.has(polo)) grupos.set(polo, []);
    grupos.get(polo).push(x);
  });
  return [...grupos].map(([polo, itens]) => ({ polo, itens }));
}
