// Lembrete de coletas paradas no aparelho. Módulo puro: roda no navegador e nos testes (Node).
//   - analisada e ainda não enviada há mais de DIAS_LEMBRETE dias → gerar a planilha
//   - aguardando análise há mais de DIAS_LEMBRETE dias           → concluir a análise
import { etapaDaColeta, diasEntre, hojeISO } from "./etapas.js";

export const DIAS_LEMBRETE = 2;

/** Devolve { semEnviar: [...], semAnalise: [...] }, da coleta mais antiga para a mais nova. */
export function coletasAtrasadas(coletas, hoje = hojeISO(), dias = DIAS_LEMBRETE) {
  const atrasada = (c) => c.dataColeta && diasEntre(c.dataColeta, hoje) > dias;
  const antigaPrimeiro = (a, b) => a.dataColeta.localeCompare(b.dataColeta);
  return {
    semEnviar: coletas.filter((c) => etapaDaColeta(c) === "analisada" && atrasada(c)).sort(antigaPrimeiro),
    semAnalise: coletas.filter((c) => etapaDaColeta(c) === "coletada" && atrasada(c)).sort(antigaPrimeiro),
  };
}
