// Regras de conformidade (Portaria 888/2021). Módulo puro: roda no navegador e nos testes (Node).
//
// Dois tipos de problema, tratados de forma diferente:
//  - FORA DO PADRÃO: valor possível, mas fora da Portaria (ex.: pH 5.2). Alerta + exige justificativa.
//  - VALOR IMPOSSÍVEL: erro de digitação (ex.: pH -7, cloro "abc", coordenada sem o "-").
//    Avisa na coleta e bloqueia "Concluir análise" até corrigir. Não pede justificativa.
import { VR, PARAMETROS, REGIAO } from "./config.js";
import { numero } from "./util.js";

export const ehCaptacao = (tipo) => /^CAPTAÇÃO/.test(tipo || "");

/** Erro de digitação no parâmetro, ou null. Campo em branco não é erro (não analisado). */
export function valorImpossivel(chave, valor) {
  const n = numero(valor);
  if (n === null) return null;
  if (Number.isNaN(n)) return "não é um número";
  if (n < 0) return "não pode ser negativo";
  if (chave === "ph" && n > 14) return "o pH vai de 0 a 14";
  return null;
}

/** Descrição do resultado fora do padrão, ou null (conforme, em branco ou valor impossível). */
export function avaliarParametro(chave, valor, tipoPonto) {
  if (valorImpossivel(chave, valor)) return null; // erro de digitação não é "fora do padrão"
  const n = numero(valor);
  if (n === null) return null;
  if (chave === "ph") {
    if (n < VR.ph[0]) return "abaixo de 6.0";
    if (n > VR.ph[1]) return "acima de 9.0";
  }
  if (chave === "cor" && n > VR.cor[1]) return "acima de 15 uH";
  if (chave === "turb" && n > VR.turb[1]) return "acima de 5 uT";
  // Cloro residual só é exigido depois do tratamento (não na captação).
  if (chave === "cloro" && !ehCaptacao(tipoPonto)) {
    if (n < VR.cloro[0]) return "abaixo de 0.2 mg/L";
    if (n > VR.cloro[1]) return "acima de 5 mg/L";
  }
  return null;
}

/**
 * Confere a coordenada: formato "-10.123456; -50.123456" (com ou sem parênteses)
 * e se cai dentro do Brasil (config.js → REGIAO), onde a longitude é sempre negativa.
 */
export function avaliarCoordenada(texto) {
  if (!texto) return null;
  const partes = String(texto).replace(/[()]/g, "").split(/[;,\s]+/).filter(Boolean).map(Number);
  if (partes.length !== 2 || partes.some(Number.isNaN)) return "use o formato -10.123456; -50.123456";
  const [lat, lon] = partes;
  if (lat < REGIAO.lat[0] || lat > REGIAO.lat[1] || lon < REGIAO.lon[0] || lon > REGIAO.lon[1]) {
    return lat > 0 || lon > 0
      ? "fora do Brasil (confira o sinal de menos)"
      : "fora do Brasil (confira os números)";
  }
  return null;
}

/** Resultados fora do padrão (são os que exigem justificativa). */
export function foraDoPadrao(coleta) {
  const out = [];
  coleta.pontos.forEach((p, i) => {
    for (const [chave, rotulo] of PARAMETROS) {
      const e = avaliarParametro(chave, p[chave], p.tipo);
      if (e) out.push(`Ponto ${i + 1}: ${rotulo} ${String(p[chave]).replace(/,/g, ".")} (${e})`);
    }
    if (p.colTotais === "PRESENTE") out.push(`Ponto ${i + 1}: coliformes totais presentes`);
    if (p.eColi === "PRESENTE") out.push(`Ponto ${i + 1}: E. coli presente`);
  });
  return out;
}

/** Erros de digitação (valores impossíveis e coordenadas inválidas): precisam ser corrigidos. */
export function errosDeDigitacao(coleta) {
  const out = [];
  coleta.pontos.forEach((p, i) => {
    for (const [chave, rotulo] of PARAMETROS) {
      const e = valorImpossivel(chave, p[chave]);
      if (e) out.push(`Ponto ${i + 1}: ${rotulo} "${String(p[chave]).trim()}" (${e})`);
    }
    const ec = avaliarCoordenada(p.coord);
    if (ec) out.push(`Ponto ${i + 1}: coordenada ${ec}`);
  });
  return out;
}

/** Tudo o que merece atenção (fora do padrão + erros de digitação), em texto pronto para exibir. */
export const problemasDaColeta = (coleta) => [...foraDoPadrao(coleta), ...errosDeDigitacao(coleta)];

/** true se algum parâmetro foi preenchido em algum ponto. */
export const temResultado = (coleta) =>
  coleta.pontos.some((p) => ["ph", "cor", "turb", "cloro", "colTotais", "eColi"].some((k) => String(p[k] ?? "").trim() !== ""));