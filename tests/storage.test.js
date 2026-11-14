import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizarColeta } from "../js/storage.js";

const valida = () => ({
  id: "c1abc", mes: "SET", linha: 20, dataColeta: "2026-09-24", dataAnalise: "2026-09-24",
  responsavel: "Fulano", pontos: [{ identificacao: "Captação 1", tipo: "CAPTAÇÃO SUBTERRÂNEA", ph: "5.59", colTotais: "AUSENTE", eColi: "AUSENTE" }],
});

test("coleta válida passa", () => {
  const c = sanitizarColeta(valida());
  assert.equal(c.id, "c1abc");
  assert.equal(c.pontos[0].ph, "5.59");
});

test("id com HTML é recusado", () => {
  assert.equal(sanitizarColeta({ ...valida(), id: '"><img src=x onerror=alert(1)>' }), null);
});

test("mês, linha e data inválidos são recusados", () => {
  assert.equal(sanitizarColeta({ ...valida(), mes: "<b>" }), null);
  assert.equal(sanitizarColeta({ ...valida(), linha: "20<script>" }), null);
  assert.equal(sanitizarColeta({ ...valida(), dataColeta: "ontem" }), null);
});

test("opções fora da lista viram vazio e textos são cortados", () => {
  const c = sanitizarColeta({ ...valida(), responsavel: "x".repeat(500),
    pontos: [{ tipo: "<script>", colTotais: "TALVEZ", ph: "7".repeat(50) }] });
  assert.equal(c.pontos[0].tipo, "");
  assert.equal(c.pontos[0].colTotais, "");
  assert.equal(c.responsavel.length, 120);
  assert.equal(c.pontos[0].ph.length, 12);
});

test("campos desconhecidos são descartados", () => {
  const c = sanitizarColeta({ ...valida(), extra: "<script>" });
  assert.equal("extra" in c, false);
});

test("formato da primeira versão (campos abreviados) continua aceito", () => {
  const c = sanitizarColeta({ id: "c_set_demo", mes: "SET", row: 20, dColeta: "2026-09-24",
    pts: [{ ident: "Captação 1", tipo: "CAPTAÇÃO SUBTERRÂNEA", ph: "5.59", ct: "AUSENTE", ec: "AUSENTE" }] });
  assert.equal(c.linha, 20);
  assert.equal(c.pontos[0].colTotais, "AUSENTE");
});
