// Coletas de exemplo da demo (todas fictícias). Módulo puro: roda no navegador e nos testes (Node).
// 6 coletas no mês atual: 2 conformes, 3 fora do padrão e 1 aguardando o resultado da análise.
import { MESES } from "./config.js";
import { hojeISO, somarDias } from "./etapas.js";

const COLETOR = "Técnica de Campo (exemplo)";
const ANALISTA = "Analista de Laboratório (exemplo)";

// Resultados [pH, cor, turbidez, cloro] de um ponto conforme; a captação não tem cloro.
const CONFORME = [
  { ph: "6.8", cor: "5", turb: "0.8", cloro: "" },
  { ph: "7.0", cor: "4", turb: "0.5", cloro: "0.8" },
  { ph: "7.1", cor: "5", turb: "0.6", cloro: "0.5" },
];

// Cada exemplo: posição do sistema em data/sistemas.json, dias atrás da coleta e o que foge do padrão.
const ROTEIRO = [
  { id: "demo1", sistema: 0, diasAtras: 6 },
  { id: "demo2", sistema: 2, diasAtras: 6 },
  { id: "demo3", sistema: 3, diasAtras: 5, ponto: 2, altera: { turb: "7" },
    justificativa: "Turbidez acima do limite na ponta de rede após manutenção na rede de distribuição. Realizada descarga da rede; nova coleta programada." },
  { id: "demo4", sistema: 5, diasAtras: 4, ponto: 1, altera: { cloro: "0.1" },
    justificativa: "Cloro residual abaixo do mínimo na saída do reservatório por falha no dosador. Dosador regulado e cloração reforçada; nova medição programada." },
  { id: "demo5", sistema: 6, diasAtras: 3, ponto: 2, altera: { colTotais: "PRESENTE", eColi: "PRESENTE" },
    justificativa: "Presença de E. coli na ponta de rede. Comunidade orientada a tratar a água no domicílio; reservatório higienizado, desinfecção reforçada e nova coleta programada." },
  { id: "demo6", sistema: 7, diasAtras: 1, aguardando: true },
];

/**
 * Monta as 6 coletas a partir do cadastro (data/sistemas.json).
 * As datas são relativas a "hoje" para a demo parecer sempre recente.
 */
export function coletasDeExemplo(sistemas, hoje = hojeISO()) {
  const mes = MESES[Number(hoje.slice(5, 7)) - 1];
  return ROTEIRO.map((r, n) => {
    const s = sistemas[r.sistema];
    const dataColeta = somarDias(hoje, -r.diasAtras);
    const dataAnalise = r.aguardando ? "" : somarDias(dataColeta, 1);
    const pontos = s.pontosPadrao.slice(0, 3).map((padrao, i) => ({
      identificacao: padrao.identificacao,
      tipo: padrao.tipo,
      coord: `-10.${n + 1}0${i + 1}000; -50.${n + 1}0${i + 1}000`, // coordenadas fictícias
      ...(r.aguardando
        ? { ph: "", cor: "", turb: "", cloro: "", colTotais: "", eColi: "" }
        : { ...CONFORME[i], colTotais: "AUSENTE", eColi: "AUSENTE", ...(r.ponto === i ? r.altera : {}) }),
    }));
    const carimbo = `${dataAnalise || dataColeta}T12:00:00.000Z`;
    return {
      id: r.id, mes, linha: s.linha,
      dataColeta, dataAnalise, dataAnalise2: "",
      responsavelColeta: COLETOR,
      responsavel: r.aguardando ? "" : ANALISTA,
      status: r.aguardando ? "coletada" : "analisada",
      analisadaEm: r.aguardando ? null : carimbo,
      tratamentoEmOperacao: "SIM",
      justificativa: r.justificativa || "",
      observacoes: "",
      coordenadasNasObservacoes: true,
      pontos,
      criadoEm: `${dataColeta}T12:00:00.000Z`, atualizadoEm: carimbo, exportadoEm: null,
    };
  });
}
