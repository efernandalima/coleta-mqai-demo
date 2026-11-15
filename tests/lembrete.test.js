import test from "node:test";
import assert from "node:assert/strict";
import { coletasAtrasadas } from "../js/lembrete.js";

const HOJE = "2026-11-11";
const c = (id, dataColeta, status, exportadoEm = null) => ({ id, dataColeta, status, exportadoEm });

test("separa analisadas sem enviar e aguardando análise, só as com mais de 2 dias", () => {
  const r = coletasAtrasadas([
    c("a", "2026-11-05", "analisada"),                // 6 dias, não enviada → lembra
    c("b", "2026-11-09", "analisada"),                // 2 dias → ainda não
    c("c", "2026-11-01", "analisada", "2026-11-02"),  // já enviada → não
    c("d", "2026-11-07", "coletada"),                 // 4 dias aguardando análise → lembra
    c("e", "2026-11-10", "coletada"),                 // 1 dia → não
  ], HOJE);
  assert.deepEqual(r.semEnviar.map((x) => x.id), ["a"]);
  assert.deepEqual(r.semAnalise.map((x) => x.id), ["d"]);
});

test("ordena da mais antiga para a mais nova e ignora coleta sem data", () => {
  const r = coletasAtrasadas([c("x", "2026-11-06", "analisada"), c("y", "2026-11-01", "analisada"), c("z", "", "analisada")], HOJE);
  assert.deepEqual(r.semEnviar.map((x) => x.id), ["y", "x"]);
});

test("sem coletas paradas, listas vazias", () => {
  assert.deepEqual(coletasAtrasadas([], HOJE), { semEnviar: [], semAnalise: [] });
});
