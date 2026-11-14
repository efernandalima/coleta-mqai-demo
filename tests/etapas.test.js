import { test } from "node:test";
import assert from "node:assert/strict";
import { pendenciasDaAnalise, alertasDaAnalise, etapaDaColeta, somarDias } from "../js/etapas.js";
import { normalizarColeta } from "../js/storage.js";
import { textoObservacoes } from "../js/excel.js";

const HOJE = "2026-10-15";
const ponto = (tipo, extra = {}) => ({ tipo, ph: "7", cor: "5", turb: "1", cloro: "0.5", colTotais: "AUSENTE", eColi: "AUSENTE", ...extra });
const completa = () => ({
  dataColeta: "2026-10-14", dataAnalise: "2026-10-15", responsavel: "Fulana",
  pontos: [ponto("CAPTAÇÃO SUBTERRÂNEA", { cloro: "" }), ponto("SAÍDA DO RESERVATÓRIO COM ÁGUA TRATADA"), ponto("CHAFARIZ (COLETIVO)")],
});

test("coleta completa não tem pendências", () => {
  assert.deepEqual(pendenciasDaAnalise(completa(), HOJE), []);
});

test("cloro não é exigido na captação, mas é nos demais pontos", () => {
  const c = completa(); c.pontos[1].cloro = "";
  assert.deepEqual(pendenciasDaAnalise(c, HOJE), ["Ponto 2: Cloro"]);
});

test("exige data e responsável da análise", () => {
  const p = pendenciasDaAnalise({ ...completa(), dataAnalise: "", responsavel: "" }, HOJE);
  assert.ok(p.includes("Data da análise"));
  assert.ok(p.includes("Responsável técnico pela análise"));
});

test("data da análise não pode ser antes da coleta nem no futuro", () => {
  assert.ok(pendenciasDaAnalise({ ...completa(), dataAnalise: "2026-10-13" }, HOJE)[0].includes("antes da coleta"));
  assert.ok(pendenciasDaAnalise({ ...completa(), dataAnalise: "2026-10-16" }, HOJE)[0].includes("futuro"));
});

test("fora do padrão exige justificativa", () => {
  const c = completa(); c.pontos[2].eColi = "PRESENTE";
  assert.deepEqual(pendenciasDaAnalise(c, HOJE), ["Justificativa (há resultado fora do padrão)"]);
  assert.deepEqual(pendenciasDaAnalise({ ...c, justificativa: "Reforço da cloração" }, HOJE), []);
});

test("alerta quando a análise passa do dia seguinte", () => {
  assert.deepEqual(alertasDaAnalise(completa()), []);
  assert.equal(alertasDaAnalise({ ...completa(), dataAnalise: "2026-10-17" }).length, 1);
});

test("etapas: coletada → analisada → enviada", () => {
  assert.equal(etapaDaColeta({ status: "coletada" }), "coletada");
  assert.equal(etapaDaColeta({ status: "analisada" }), "analisada");
  assert.equal(etapaDaColeta({ status: "analisada", exportadoEm: "2026-10-15" }), "enviada");
});

test("coletas antigas recebem a etapa pela presença de análise", () => {
  assert.equal(normalizarColeta({ ...completa(), id: "a" }).status, "analisada");
  assert.equal(normalizarColeta({ id: "b", dataColeta: "2026-10-14", pontos: [{ ph: "" }] }).status, "coletada");
});

test("somarDias atravessa o mês", () => {
  assert.equal(somarDias("2026-10-31", 1), "2026-11-01");
});

test("observações trazem quem coletou", () => {
  const t = textoObservacoes({ ...completa(), responsavelColeta: "Ana", coordenadasNasObservacoes: false });
  assert.equal(t, "Coleta em 14/10/2026 por Ana");
});

test("valor impossível e coordenada errada bloqueiam a conclusão, sem pedir justificativa", () => {
  const c = completa();
  c.pontos[1].ph = "15";
  c.pontos[2].coord = "-10.71; 50.93";
  assert.deepEqual(pendenciasDaAnalise(c, HOJE), [
    'Corrigir Ponto 2: pH "15" (o pH vai de 0 a 14)',
    "Corrigir Ponto 3: coordenada fora do Brasil (confira o sinal de menos)",
  ]);
});

test("aldeia sem água: 1 ponto basta, com o motivo nas observações", () => {
  const c = completa();
  const vazioP = (i) => ({ ...c.pontos[i], coord: "", ph: "", cor: "", turb: "", cloro: "", colTotais: "", eColi: "" });
  const umPonto = { ...c, pontos: [c.pontos[0], vazioP(1), vazioP(2)], observacoes: "" };
  assert.deepEqual(pendenciasDaAnalise(umPonto, HOJE),
    ["Observações: motivo de não coletar todos os pontos (ex.: aldeia sem água no dia)"]);
  assert.deepEqual(pendenciasDaAnalise({ ...umPonto, observacoes: "Aldeia sem água no dia" }, HOJE), []);
  // só o ponto 3 coletado também vale
  assert.deepEqual(pendenciasDaAnalise({ ...umPonto, pontos: [vazioP(0), vazioP(1), c.pontos[2]], observacoes: "Sem água" }, HOJE), []);
});

test("nenhum ponto coletado não conclui", () => {
  const c = completa();
  const vazioP = (p) => ({ ...p, coord: "", ph: "", cor: "", turb: "", cloro: "", colTotais: "", eColi: "" });
  assert.ok(pendenciasDaAnalise({ ...c, pontos: c.pontos.map(vazioP), observacoes: "x" }, HOJE)
    .includes("Resultado de pelo menos um ponto"));
});
