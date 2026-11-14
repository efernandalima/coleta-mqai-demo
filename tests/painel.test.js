import { test } from "node:test";
import assert from "node:assert/strict";
import { situacaoDoMes, contarEtapas, agruparPorPolo, filtrarSituacao } from "../js/painel.js";

const sistemas = [
  { linha: 20, polo: "POLO A", aldeia: "ALDEIA DEMO 1", sistema: "SAA 1" },
  { linha: 21, polo: "POLO A", aldeia: "ALDEIA DEMO 2", sistema: "SAC" },
  { linha: 35, polo: "POLO B", aldeia: "ALDEIA DEMO 3", sistema: "SAA 1" },
  { linha: 54, polo: "POLO C", aldeia: "ALDEIA DEMO 6", sistema: "SAA 1" },
];
const ok = { ph: "7", cor: "5", turb: "1", cloro: "0.5", colTotais: "AUSENTE", eColi: "AUSENTE" };
const coletas = [
  { id: "a", mes: "OUT", linha: 20, status: "analisada", exportadoEm: "2026-10-15", dataColeta: "2026-10-14", pontos: [ok] },
  { id: "b", mes: "OUT", linha: 21, status: "analisada", dataColeta: "2026-10-14", pontos: [{ ...ok, eColi: "PRESENTE" }] },
  { id: "c", mes: "OUT", linha: 35, status: "coletada", dataColeta: "2026-10-15", pontos: [{ ph: "4" }] },
  { id: "d", mes: "SET", linha: 54, status: "analisada", dataColeta: "2026-09-10", pontos: [ok] },
];

test("cada sistema recebe a etapa da coleta do mês", () => {
  const s = situacaoDoMes(sistemas, coletas, "OUT").map((x) => x.etapa);
  assert.deepEqual(s, ["enviada", "analisada", "coletada", "pendente"]);
});

test("fora do padrão só conta depois da análise", () => {
  const s = situacaoDoMes(sistemas, coletas, "OUT");
  assert.equal(s[1].foraDoPadrao, true);  // E. coli presente, analisada
  assert.equal(s[2].foraDoPadrao, false); // pH 4, mas ainda aguardando análise
});

test("contagem do mês: analisadas inclui as que já estão na planilha", () => {
  assert.deepEqual(contarEtapas(situacaoDoMes(sistemas, coletas, "OUT")),
    { pendente: 1, coletada: 1, analisadas: 2, aEnviar: 1, enviada: 1, foraDoPadrao: 1, total: 4 });
});

test("filtro Analisadas mostra também as enviadas", () => {
  const s = situacaoDoMes(sistemas, coletas, "OUT");
  assert.deepEqual(filtrarSituacao(s, "analisada").map((x) => x.sistema.aldeia), ["ALDEIA DEMO 1", "ALDEIA DEMO 2"]);
  assert.deepEqual(filtrarSituacao(s, "enviada").map((x) => x.sistema.aldeia), ["ALDEIA DEMO 1"]);
});

test("vale a coleta mais recente quando há duas no mês", () => {
  const duas = [...coletas, { id: "e", mes: "OUT", linha: 35, status: "analisada", dataColeta: "2026-10-20", pontos: [ok] }];
  const x = situacaoDoMes(sistemas, duas, "OUT")[2];
  assert.equal(x.coleta.id, "e");
  assert.equal(x.quantidade, 2);
});

test("agrupa por polo na ordem da planilha", () => {
  const g = agruparPorPolo(situacaoDoMes(sistemas, coletas, "OUT"));
  assert.deepEqual(g.map((x) => [x.polo, x.itens.length]), [["POLO A", 2], ["POLO B", 1], ["POLO C", 1]]);
});
