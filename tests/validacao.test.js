import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarParametro, valorImpossivel, avaliarCoordenada, foraDoPadrao, errosDeDigitacao, problemasDaColeta, temResultado } from "../js/validacao.js";

test("pH abaixo de 6 é sinalizado; vírgula decimal é aceita", () => {
  assert.equal(avaliarParametro("ph", "5,59", "CAPTAÇÃO SUBTERRÂNEA"), "abaixo de 6.0");
  assert.equal(avaliarParametro("ph", "7.2", ""), null);
  assert.equal(avaliarParametro("ph", "9.4", ""), "acima de 9.0");
});

test("campo em branco não é avaliado (não analisado ≠ zero)", () => {
  assert.equal(avaliarParametro("cloro", "", "CASA (OU CHAFARIZ INDIVIDUAL)"), null);
  assert.equal(valorImpossivel("cloro", ""), null);
});

test("cloro só é exigido depois do tratamento", () => {
  assert.equal(avaliarParametro("cloro", "0.0", "CAPTAÇÃO SUBTERRÂNEA"), null);
  assert.equal(avaliarParametro("cloro", "0.0", "SAÍDA DO RESERVATÓRIO COM ÁGUA TRATADA"), "abaixo de 0.2 mg/L");
  assert.equal(avaliarParametro("cloro", "0,6", "CASA (OU CHAFARIZ INDIVIDUAL)"), null);
});

test("cor e turbidez acima do VMP", () => {
  assert.equal(avaliarParametro("cor", "16", ""), "acima de 15 uH");
  assert.equal(avaliarParametro("turb", "5.1", ""), "acima de 5 uT");
});

test("valores impossíveis são erro de digitação, não 'fora do padrão'", () => {
  assert.equal(valorImpossivel("ph", "15"), "o pH vai de 0 a 14");
  assert.equal(valorImpossivel("ph", "-7"), "não pode ser negativo");
  assert.equal(valorImpossivel("cloro", "-0.5"), "não pode ser negativo");
  assert.equal(valorImpossivel("turb", "abc"), "não é um número");
  assert.equal(valorImpossivel("ph", "14"), null);
  assert.equal(valorImpossivel("turb", "0"), null);
  // e por isso não entram em "fora do padrão"
  assert.equal(avaliarParametro("ph", "15", ""), null);
  assert.equal(avaliarParametro("cloro", "-1", "CASA (OU CHAFARIZ INDIVIDUAL)"), null);
});

test("coordenada: dentro do Brasil vale; fora é erro de digitação", () => {
  assert.equal(avaliarCoordenada("-10.123456; -50.123456"), null);
  assert.equal(avaliarCoordenada("(-10.80, -50.08)"), null);         // com parênteses e vírgula
  assert.equal(avaliarCoordenada("2.5; -60.7"), null);               // norte do país: latitude positiva vale
  assert.equal(avaliarCoordenada("(-10.709429; 50.935344)"), "fora do Brasil (confira o sinal de menos)");
  assert.equal(avaliarCoordenada("-60.55; -46.63"), "fora do Brasil (confira os números)");
  assert.equal(avaliarCoordenada("-10.70"), "use o formato -10.123456; -50.123456");
});

test("problemas de uma coleta com pH e cloro baixos e uma coordenada sem o sinal", () => {
  const p = (tipo, ph, cloro, coord) => ({ tipo, ph, cor: "6", turb: "0.0", cloro, colTotais: "AUSENTE", eColi: "AUSENTE", coord });
  const coleta = { pontos: [
    p("CAPTAÇÃO SUBTERRÂNEA", "5.59", "0.2", "-10.123456; -50.123456"),
    p("SAÍDA DO RESERVATÓRIO COM ÁGUA TRATADA", "5.33", "0.0", "-10.709429; 50.935344"),
    p("CASA (OU CHAFARIZ INDIVIDUAL)", "5.64", "0.0", "-10.710507; -50.934752"),
  ] };
  assert.equal(foraDoPadrao(coleta).length, 5);     // 3 pH baixos + 2 cloros baixos
  assert.equal(errosDeDigitacao(coleta).length, 1); // coordenada do ponto 2 sem o "-"
  assert.equal(problemasDaColeta(coleta).length, 6);
  assert.equal(temResultado(coleta), true);
});
